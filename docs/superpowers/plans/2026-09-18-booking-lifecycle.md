# Booking Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Maqar's non-existent booking lifecycle with a real state machine enforced in Postgres, so that double booking is impossible, arrival codes actually validate, and no payment record can exist without a payment.

**Architecture:** One plain-JS module owns the transition rules, refund tiers and slot maths; demo mode executes it against `localStorage` and live mode uses it for UI while Postgres `security definer` functions enforce the identical rules server-side. The browser loses `INSERT`/`UPDATE` on every table that carries meaning. Overlap is prevented by a gist exclusion constraint rather than by client checks.

**Tech Stack:** React 19, Vite 8, plain JS (no TypeScript), Tailwind v3, Supabase (Postgres + Auth + RLS), Vitest (added by this plan).

**Spec:** `docs/superpowers/specs/2026-09-18-booking-lifecycle-design.md`

## Global Constraints

- **Demo mode must never break.** No Supabase env vars means all data is `localStorage` + seed fixtures. Every live path checks `isSupabaseConfigured` from `src/lib/supabase.js` and falls back to the local store.
- **All npm commands run from `maqar-app/`**, not the repo root.
- **Imports are relative with the file extension written out**: `import x from "../lib/x.js"`.
- **One component per file**, `export default function Name()`. Screens/components are PascalCase `.jsx`; helper modules are lowercase `.js`.
- **Every user-facing string goes through `useT()`**, with keys added to **both** `EN` and `AR` in `src/i18n/index.jsx`. Keys are flat and dot-namespaced.
- **`npm run build` must stay clean.** `npm run lint` has 11 known pre-existing errors — do not add new ones and do not fix those 11 here.
- **Commission rate is `0.20`** platform-wide.
- **Refund tiers:** more than 24h before `starts_at` → 100%; 24h or less and before start → 50%; at or after start → 0%.
- **Payment window:** `least(approved_at + 2 hours, starts_at - 30 minutes)`.
- **Minimum lead time:** a slot starting less than 1 hour from now cannot be requested.
- **Money is `numeric(10,3)`** (JOD, 1000 fils). Currency code `'JOD'`.
- **Room ids are stable UUIDs** (`RID` in `src/data/rooms.js`) — never renumber them.
- **`mapRoomRow` is the DB↔UI boundary.** Postgres is `snake_case` (description column is `descr`); UI objects are `camelCase` with `desc`.

---

### Task 1: Vitest setup and the transition table

**Files:**
- Modify: `maqar-app/package.json`
- Modify: `maqar-app/vite.config.js`
- Create: `maqar-app/src/lib/bookingMachine.js`
- Test: `maqar-app/src/lib/bookingMachine.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `STATUS` (object of 9 string constants), `ACTOR` (`{GUEST:"guest",HOST:"host",SYSTEM:"system"}`), `canTransition(from, to, actor) → boolean`, `allowedTransitions(from, actor) → string[]`, `isTerminal(status) → boolean`, `holdsSlot(status) → boolean`

- [ ] **Step 1: Install Vitest**

```bash
cd maqar-app && npm install -D vitest@^3
```

- [ ] **Step 2: Add the test script**

In `maqar-app/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Enable the Vitest environment in Vite config**

Replace `maqar-app/vite.config.js` with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
```

- [ ] **Step 4: Write the failing test**

Create `maqar-app/src/lib/bookingMachine.test.js`:

```js
import { describe, it, expect } from "vitest";
import { STATUS, ACTOR, canTransition, allowedTransitions, isTerminal, holdsSlot } from "./bookingMachine.js";

describe("canTransition", () => {
  it("lets a host approve a requested booking", () => {
    expect(canTransition(STATUS.REQUESTED, STATUS.APPROVED, ACTOR.HOST)).toBe(true);
  });

  it("does not let a guest approve their own booking", () => {
    expect(canTransition(STATUS.REQUESTED, STATUS.APPROVED, ACTOR.GUEST)).toBe(false);
  });

  it("does not let a guest confirm their own booking", () => {
    expect(canTransition(STATUS.APPROVED, STATUS.CONFIRMED, ACTOR.GUEST)).toBe(false);
  });

  it("lets the system confirm an approved booking once paid", () => {
    expect(canTransition(STATUS.APPROVED, STATUS.CONFIRMED, ACTOR.SYSTEM)).toBe(true);
  });

  it("lets a host complete a confirmed booking", () => {
    expect(canTransition(STATUS.CONFIRMED, STATUS.COMPLETED, ACTOR.HOST)).toBe(true);
  });

  it("refuses to complete a booking that was never confirmed", () => {
    expect(canTransition(STATUS.APPROVED, STATUS.COMPLETED, ACTOR.HOST)).toBe(false);
  });

  it("refuses any transition out of a terminal state", () => {
    expect(canTransition(STATUS.COMPLETED, STATUS.CANCELLED_BY_GUEST, ACTOR.GUEST)).toBe(false);
    expect(canTransition(STATUS.DENIED, STATUS.APPROVED, ACTOR.HOST)).toBe(false);
  });

  it("lets a guest cancel at every pre-terminal stage", () => {
    expect(canTransition(STATUS.REQUESTED, STATUS.CANCELLED_BY_GUEST, ACTOR.GUEST)).toBe(true);
    expect(canTransition(STATUS.APPROVED, STATUS.CANCELLED_BY_GUEST, ACTOR.GUEST)).toBe(true);
    expect(canTransition(STATUS.CONFIRMED, STATUS.CANCELLED_BY_GUEST, ACTOR.GUEST)).toBe(true);
  });
});

describe("allowedTransitions", () => {
  it("gives a host exactly approve and deny from Requested", () => {
    expect(allowedTransitions(STATUS.REQUESTED, ACTOR.HOST).sort())
      .toEqual([STATUS.APPROVED, STATUS.DENIED].sort());
  });
});

describe("isTerminal", () => {
  it("marks the six end states terminal", () => {
    for (const s of [STATUS.DENIED, STATUS.EXPIRED, STATUS.COMPLETED, STATUS.NO_SHOW,
                     STATUS.CANCELLED_BY_GUEST, STATUS.CANCELLED_BY_HOST]) {
      expect(isTerminal(s)).toBe(true);
    }
    expect(isTerminal(STATUS.REQUESTED)).toBe(false);
  });
});

describe("holdsSlot", () => {
  it("holds the slot only while the booking is alive", () => {
    expect(holdsSlot(STATUS.REQUESTED)).toBe(true);
    expect(holdsSlot(STATUS.APPROVED)).toBe(true);
    expect(holdsSlot(STATUS.CONFIRMED)).toBe(true);
    expect(holdsSlot(STATUS.EXPIRED)).toBe(false);
    expect(holdsSlot(STATUS.COMPLETED)).toBe(false);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd maqar-app && npm test`
Expected: FAIL — cannot resolve `./bookingMachine.js`

- [ ] **Step 6: Write the implementation**

Create `maqar-app/src/lib/bookingMachine.js`:

```js
// The booking lifecycle rules, in one place.
//
// Demo mode executes these against localStorage; live mode uses them for UI
// while the Postgres functions in supabase/migrations enforce the same table
// server-side. Both are written from this transition list — if you change one,
// change the other and the tests that cover them.

export const STATUS = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  DENIED: "Denied",
  EXPIRED: "Expired",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  NO_SHOW: "NoShow",
  CANCELLED_BY_GUEST: "CancelledByGuest",
  CANCELLED_BY_HOST: "CancelledByHost",
};

export const ACTOR = { GUEST: "guest", HOST: "host", SYSTEM: "system" };

const TRANSITIONS = [
  { from: STATUS.REQUESTED, to: STATUS.APPROVED, actor: ACTOR.HOST },
  { from: STATUS.REQUESTED, to: STATUS.DENIED, actor: ACTOR.HOST },
  { from: STATUS.REQUESTED, to: STATUS.CANCELLED_BY_GUEST, actor: ACTOR.GUEST },
  { from: STATUS.APPROVED, to: STATUS.CONFIRMED, actor: ACTOR.SYSTEM },
  { from: STATUS.APPROVED, to: STATUS.EXPIRED, actor: ACTOR.SYSTEM },
  { from: STATUS.APPROVED, to: STATUS.CANCELLED_BY_GUEST, actor: ACTOR.GUEST },
  { from: STATUS.APPROVED, to: STATUS.CANCELLED_BY_HOST, actor: ACTOR.HOST },
  { from: STATUS.CONFIRMED, to: STATUS.COMPLETED, actor: ACTOR.HOST },
  { from: STATUS.CONFIRMED, to: STATUS.NO_SHOW, actor: ACTOR.SYSTEM },
  { from: STATUS.CONFIRMED, to: STATUS.CANCELLED_BY_GUEST, actor: ACTOR.GUEST },
  { from: STATUS.CONFIRMED, to: STATUS.CANCELLED_BY_HOST, actor: ACTOR.HOST },
];

const TERMINAL = new Set([
  STATUS.DENIED, STATUS.EXPIRED, STATUS.COMPLETED, STATUS.NO_SHOW,
  STATUS.CANCELLED_BY_GUEST, STATUS.CANCELLED_BY_HOST,
]);

const HOLDS_SLOT = new Set([STATUS.REQUESTED, STATUS.APPROVED, STATUS.CONFIRMED]);

export function isTerminal(status) {
  return TERMINAL.has(status);
}

export function holdsSlot(status) {
  return HOLDS_SLOT.has(status);
}

export function canTransition(from, to, actor) {
  if (isTerminal(from)) return false;
  return TRANSITIONS.some((t) => t.from === from && t.to === to && t.actor === actor);
}

export function allowedTransitions(from, actor) {
  if (isTerminal(from)) return [];
  return TRANSITIONS.filter((t) => t.from === from && t.actor === actor).map((t) => t.to);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd maqar-app && npm test`
Expected: PASS, 11 tests

- [ ] **Step 8: Commit**

```bash
git add maqar-app/package.json maqar-app/package-lock.json maqar-app/vite.config.js maqar-app/src/lib/bookingMachine.js maqar-app/src/lib/bookingMachine.test.js
git commit -m "Add Vitest and the booking transition table"
```

---

### Task 2: Refund tiers, payment deadline and overlap maths

**Files:**
- Modify: `maqar-app/src/lib/bookingMachine.js`
- Test: `maqar-app/src/lib/bookingMachine.test.js`

**Interfaces:**
- Consumes: `STATUS` from Task 1
- Produces: `COMMISSION_RATE` (`0.20`), `REFUND_POLICY` (`{fullRefundHours:24, partialFraction:0.5}`), `MIN_LEAD_MS`, `refundFraction(startsAt, now, policy?) → 1|0.5|0`, `refundAmount(total, startsAt, now, policy?) → number`, `paymentDeadline(approvedAt, startsAt) → Date`, `canRequestAt(startsAt, now) → boolean`, `overlaps(aStart, aEnd, bStart, bEnd) → boolean`, `bookingTotal(pricePerHour, startsAt, endsAt) → number`

- [ ] **Step 1: Write the failing tests**

Append to `maqar-app/src/lib/bookingMachine.test.js`:

```js
import {
  COMMISSION_RATE, refundFraction, refundAmount, paymentDeadline,
  canRequestAt, overlaps, bookingTotal,
} from "./bookingMachine.js";

const HOUR = 3600 * 1000;
const at = (iso) => new Date(iso);

describe("refundFraction", () => {
  const start = at("2026-10-01T12:00:00Z");

  it("refunds in full more than 24h before the start", () => {
    expect(refundFraction(start, at("2026-09-30T11:59:00Z"))).toBe(1);
  });

  it("refunds half at exactly 24h before the start", () => {
    expect(refundFraction(start, at("2026-09-30T12:00:00Z"))).toBe(0.5);
  });

  it("refunds half just inside 24h", () => {
    expect(refundFraction(start, at("2026-10-01T11:59:00Z"))).toBe(0.5);
  });

  it("refunds nothing at the start time", () => {
    expect(refundFraction(start, start)).toBe(0);
  });

  it("refunds nothing after the start", () => {
    expect(refundFraction(start, at("2026-10-01T13:00:00Z"))).toBe(0);
  });
});

describe("refundAmount", () => {
  it("rounds to three decimals", () => {
    const start = at("2026-10-01T12:00:00Z");
    expect(refundAmount(13.5, start, at("2026-10-01T11:00:00Z"))).toBe(6.75);
    expect(refundAmount(10, start, at("2026-09-01T00:00:00Z"))).toBe(10);
    expect(refundAmount(10, start, at("2026-10-01T12:00:00Z"))).toBe(0);
  });
});

describe("paymentDeadline", () => {
  it("is two hours after approval when the start is far away", () => {
    const approved = at("2026-10-01T09:00:00Z");
    const start = at("2026-10-05T12:00:00Z");
    expect(paymentDeadline(approved, start).toISOString()).toBe("2026-10-01T11:00:00.000Z");
  });

  it("is clamped to 30 minutes before the start when the start is soon", () => {
    const approved = at("2026-10-01T09:00:00Z");
    const start = at("2026-10-01T10:00:00Z");
    expect(paymentDeadline(approved, start).toISOString()).toBe("2026-10-01T09:30:00.000Z");
  });
});

describe("canRequestAt", () => {
  it("rejects a start less than an hour away", () => {
    const now = at("2026-10-01T09:00:00Z");
    expect(canRequestAt(at("2026-10-01T09:59:00Z"), now)).toBe(false);
    expect(canRequestAt(at("2026-10-01T10:01:00Z"), now)).toBe(true);
  });
});

describe("overlaps", () => {
  const a = [at("2026-10-01T09:00:00Z"), at("2026-10-01T13:00:00Z")];

  it("catches a slot starting inside an existing booking", () => {
    // This is the exact bug: a 4h booking at 09:00 did not block 09:30.
    expect(overlaps(...a, at("2026-10-01T09:30:00Z"), at("2026-10-01T10:30:00Z"))).toBe(true);
  });

  it("catches an enclosing slot", () => {
    expect(overlaps(...a, at("2026-10-01T08:00:00Z"), at("2026-10-01T14:00:00Z"))).toBe(true);
  });

  it("allows a booking that starts exactly when the other ends", () => {
    expect(overlaps(...a, at("2026-10-01T13:00:00Z"), at("2026-10-01T14:00:00Z"))).toBe(false);
  });

  it("allows a booking entirely before", () => {
    expect(overlaps(...a, at("2026-10-01T07:00:00Z"), at("2026-10-01T09:00:00Z"))).toBe(false);
  });
});

describe("bookingTotal", () => {
  it("multiplies price by hours, including half hours", () => {
    expect(bookingTotal(9, at("2026-10-01T09:00:00Z"), at("2026-10-01T11:00:00Z"))).toBe(18);
    expect(bookingTotal(9, at("2026-10-01T09:00:00Z"), at("2026-10-01T10:30:00Z"))).toBe(13.5);
  });
});

describe("COMMISSION_RATE", () => {
  it("is 20 percent", () => {
    expect(COMMISSION_RATE).toBe(0.2);
    expect(Math.round(bookingTotal(7, at("2026-10-01T09:00:00Z"), at("2026-10-01T11:00:00Z")) * COMMISSION_RATE * 1000) / 1000).toBe(2.8);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd maqar-app && npm test`
Expected: FAIL — `refundFraction is not a function`

- [ ] **Step 3: Write the implementation**

Append to `maqar-app/src/lib/bookingMachine.js`:

```js
const HOUR_MS = 3600 * 1000;

export const COMMISSION_RATE = 0.2;
export const REFUND_POLICY = { fullRefundHours: 24, partialFraction: 0.5 };
export const MIN_LEAD_MS = 1 * HOUR_MS;
const PAYMENT_WINDOW_MS = 2 * HOUR_MS;
const PAYMENT_CUTOFF_BEFORE_START_MS = 30 * 60 * 1000;

const ms = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());
const round3 = (n) => Math.round(n * 1000) / 1000;

/** 1 when cancelling early, the partial fraction inside the window, 0 once started. */
export function refundFraction(startsAt, now, policy = REFUND_POLICY) {
  const remaining = ms(startsAt) - ms(now);
  if (remaining <= 0) return 0;
  if (remaining > policy.fullRefundHours * HOUR_MS) return 1;
  return policy.partialFraction;
}

export function refundAmount(total, startsAt, now, policy = REFUND_POLICY) {
  return round3(total * refundFraction(startsAt, now, policy));
}

/** Two hours to pay, but never later than 30 minutes before the session starts. */
export function paymentDeadline(approvedAt, startsAt) {
  return new Date(Math.min(ms(approvedAt) + PAYMENT_WINDOW_MS, ms(startsAt) - PAYMENT_CUTOFF_BEFORE_START_MS));
}

export function canRequestAt(startsAt, now) {
  return ms(startsAt) - ms(now) >= MIN_LEAD_MS;
}

/** Half-open [start, end): a booking may begin exactly when another ends. */
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return ms(aStart) < ms(bEnd) && ms(bStart) < ms(aEnd);
}

export function bookingTotal(pricePerHour, startsAt, endsAt) {
  return round3(pricePerHour * ((ms(endsAt) - ms(startsAt)) / HOUR_MS));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd maqar-app && npm test`
Expected: PASS, all tests

- [ ] **Step 5: Commit**

```bash
git add maqar-app/src/lib/bookingMachine.js maqar-app/src/lib/bookingMachine.test.js
git commit -m "Add refund tiers, payment deadline and overlap maths"
```

---

### Task 3: Schema migration — tables, columns and the overlap constraint

**Files:**
- Create: `maqar-app/supabase/migrations/20260918_booking_lifecycle.sql`

**Interfaces:**
- Consumes: nothing
- Produces: `bookings` with `starts_at`/`ends_at`/money/timestamp columns and no `date`/`slot`/`code`; `booking_codes(booking_id, code, created_at)`; `payments(id, booking_id, kind, status, amount, currency, provider, provider_ref, created_at)`; `profiles.type` accepting `'admin'`; constraint `bookings_no_overlap`

- [ ] **Step 1: Write the migration**

Create `maqar-app/supabase/migrations/20260918_booking_lifecycle.sql`:

```sql
-- ============================================================
--  Booking lifecycle: real states, real money, no double booking
--  Safe on an empty bookings table. Production had 0 bookings.
-- ============================================================

create extension if not exists btree_gist;

-- ---------- profiles: add the admin role ----------
alter table public.profiles drop constraint if exists profiles_type_check;
alter table public.profiles add constraint profiles_type_check
  check (type in ('user','host','admin'));

-- ---------- bookings: new shape ----------
drop index if exists bookings_slot_unique;

alter table public.bookings
  add column if not exists starts_at          timestamptz,
  add column if not exists ends_at            timestamptz,
  add column if not exists commission_rate    numeric(5,4) not null default 0.20,
  add column if not exists commission_amount  numeric(10,3),
  add column if not exists host_payout_amount numeric(10,3),
  add column if not exists refund_policy      jsonb not null
    default '{"fullRefundHours":24,"partialFraction":0.5}'::jsonb,
  add column if not exists approved_at        timestamptz,
  add column if not exists payment_deadline   timestamptz,
  add column if not exists confirmed_at       timestamptz,
  add column if not exists completed_at       timestamptz,
  add column if not exists cancelled_at       timestamptz,
  add column if not exists denial_reason      text;

-- the old shape is gone; `code` moves to its own table (see below)
alter table public.bookings
  drop column if exists date,
  drop column if exists slot,
  drop column if exists dur,
  drop column if exists code;

delete from public.bookings where starts_at is null or ends_at is null;

alter table public.bookings
  alter column starts_at set not null,
  alter column ends_at   set not null,
  alter column total     type numeric(10,3);

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('Requested','Approved','Denied','Expired','Confirmed',
                    'Completed','NoShow','CancelledByGuest','CancelledByHost'));
alter table public.bookings alter column status set default 'Requested';

alter table public.bookings drop constraint if exists bookings_time_order;
alter table public.bookings add constraint bookings_time_order check (ends_at > starts_at);

-- The whole fix for slot-span double booking. Two concurrent overlapping
-- bookings cannot both commit, whatever the client does.
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('Requested','Approved','Confirmed'));

-- ---------- booking_codes: the host must never read these ----------
create table if not exists public.booking_codes (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  code       text not null check (code ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

-- ---------- payments: replaced ----------
drop table if exists public.payments cascade;
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete restrict,
  kind         text not null check (kind in ('charge','refund')),
  status       text not null check (status in ('pending','succeeded','failed')),
  amount       numeric(10,3) not null check (amount >= 0),
  currency     text not null default 'JOD',
  provider     text not null default 'stub',
  provider_ref text,
  created_at   timestamptz not null default now()
);
create index if not exists payments_booking_idx on public.payments (booking_id);

alter table public.booking_codes enable row level security;
alter table public.payments      enable row level security;
```

- [ ] **Step 2: Apply the migration**

Apply the file's contents in the Supabase SQL editor for project `fdsbwmpyzuyclrnsitux`, or via the Supabase MCP `apply_migration` tool with name `booking_lifecycle`.

- [ ] **Step 3: Verify the constraint exists and works**

Run in the SQL editor:

```sql
select conname from pg_constraint where conrelid = 'public.bookings'::regclass
  and conname in ('bookings_no_overlap','bookings_time_order','bookings_status_check');
```

Expected: three rows.

- [ ] **Step 4: Commit**

```bash
git add maqar-app/supabase/migrations/20260918_booking_lifecycle.sql
git commit -m "Migrate bookings to timestamps with a gist overlap constraint"
```

---

### Task 4: Transition functions

**Files:**
- Create: `maqar-app/supabase/migrations/20260918_booking_functions.sql`

**Interfaces:**
- Consumes: the tables from Task 3
- Produces: SQL functions `is_admin()`, `account_type()`, `request_booking(uuid, timestamptz, timestamptz) → bookings`, `approve_booking(uuid) → bookings`, `deny_booking(uuid, text) → bookings`, `cancel_booking(uuid) → bookings`, `confirm_booking_payment(uuid, text) → bookings`, `validate_arrival_code(uuid, text) → bookings`, `expire_stale_approvals() → int`, `mark_no_shows() → int`

- [ ] **Step 1: Write the functions**

Create `maqar-app/supabase/migrations/20260918_booking_functions.sql`:

```sql
-- ============================================================
--  Every booking transition. The client calls these; it cannot
--  UPDATE bookings directly (see the policies migration).
--  Mirrors src/lib/bookingMachine.js — change both together.
-- ============================================================

-- security definer so a policy ON profiles can call it without recursing
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and type = 'admin');
$$;

create or replace function public.account_type() returns text
language sql security definer stable set search_path = public as $$
  select type from profiles where id = auth.uid();
$$;

create or replace function public.request_booking(
  p_room_id uuid, p_starts_at timestamptz, p_ends_at timestamptz
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_price numeric; v_booking public.bookings;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if account_type() <> 'user' then raise exception 'Only guests can request bookings'; end if;
  if p_ends_at <= p_starts_at then raise exception 'End must be after start'; end if;
  if p_starts_at < now() + interval '1 hour' then
    raise exception 'Bookings must start at least 1 hour from now';
  end if;

  select price into v_price from rooms where id = p_room_id;
  if v_price is null then raise exception 'Room not found'; end if;

  insert into bookings (room_id, guest_id, starts_at, ends_at, status, total)
  values (p_room_id, auth.uid(), p_starts_at, p_ends_at, 'Requested',
          round(v_price * (extract(epoch from (p_ends_at - p_starts_at)) / 3600.0)::numeric, 3))
  returning * into v_booking;
  return v_booking;
end $$;

create or replace function public.approve_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings;
begin
  select b.* into v_booking from bookings b
    join rooms r on r.id = b.room_id
   where b.id = p_booking_id and r.host_id = auth.uid();
  if not found then raise exception 'Not your booking to approve'; end if;
  if v_booking.status <> 'Requested' then
    raise exception 'Cannot approve a booking that is %', v_booking.status;
  end if;

  update bookings set status = 'Approved', approved_at = now(),
         payment_deadline = least(now() + interval '2 hours', starts_at - interval '30 minutes')
   where id = p_booking_id returning * into v_booking;
  return v_booking;
end $$;

create or replace function public.deny_booking(p_booking_id uuid, p_reason text)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  select b.* into v_booking from bookings b
    join rooms r on r.id = b.room_id
   where b.id = p_booking_id and r.host_id = auth.uid();
  if not found then raise exception 'Not your booking to deny'; end if;
  if v_booking.status <> 'Requested' then
    raise exception 'Cannot deny a booking that is %', v_booking.status;
  end if;

  update bookings set status = 'Denied', denial_reason = trim(p_reason), cancelled_at = now()
   where id = p_booking_id returning * into v_booking;
  return v_booking;
end $$;

create or replace function public.confirm_booking_payment(p_booking_id uuid, p_provider_ref text)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings; v_code text;
begin
  select * into v_booking from bookings where id = p_booking_id and guest_id = auth.uid();
  if not found then raise exception 'Not your booking'; end if;
  if v_booking.status <> 'Approved' then
    raise exception 'Cannot pay for a booking that is %', v_booking.status;
  end if;
  if v_booking.payment_deadline < now() then raise exception 'The payment window has closed'; end if;

  v_code := lpad((floor(random() * 10000))::int::text, 4, '0');

  update bookings set
      status = 'Confirmed',
      confirmed_at = now(),
      commission_amount = round(total * commission_rate, 3),
      host_payout_amount = round(total - round(total * commission_rate, 3), 3)
   where id = p_booking_id returning * into v_booking;

  insert into booking_codes (booking_id, code) values (p_booking_id, v_code)
    on conflict (booking_id) do update set code = excluded.code;

  insert into payments (booking_id, kind, status, amount, provider_ref)
  values (p_booking_id, 'charge', 'succeeded', v_booking.total, p_provider_ref);

  return v_booking;
end $$;

create or replace function public.validate_arrival_code(p_booking_id uuid, p_code text)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings; v_expected text;
begin
  select b.* into v_booking from bookings b
    join rooms r on r.id = b.room_id
   where b.id = p_booking_id and r.host_id = auth.uid();
  if not found then raise exception 'Not your booking'; end if;
  if v_booking.status <> 'Confirmed' then
    raise exception 'Cannot check in a booking that is %', v_booking.status;
  end if;

  select code into v_expected from booking_codes where booking_id = p_booking_id;
  if v_expected is null or v_expected <> p_code then
    raise exception 'That code does not match';
  end if;

  update bookings set status = 'Completed', completed_at = now()
   where id = p_booking_id returning * into v_booking;
  return v_booking;
end $$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings; v_is_guest boolean; v_is_host boolean;
        v_fraction numeric; v_refund numeric; v_remaining interval;
begin
  -- Two statements, not one. PL/pgSQL rejects a composite variable sharing an INTO
  -- list with scalars (ERROR 42601), so `v_booking` cannot be fetched alongside the
  -- permission booleans. Do not "tidy" these back into a single SELECT.
  -- Both guards on the second SELECT are load-bearing: `not found` catches a missing
  -- join row, and the coalesce pair stops a NULL boolean from passing the permission
  -- test, since PL/pgSQL treats a NULL condition as false.
  select b.* into v_booking from bookings b where b.id = p_booking_id;
  if not found then raise exception 'Not your booking'; end if;

  select (b.guest_id = auth.uid()), (r.host_id = auth.uid())
    into v_is_guest, v_is_host
    from bookings b join rooms r on r.id = b.room_id
   where b.id = p_booking_id;
  if not found or not (coalesce(v_is_guest, false) or coalesce(v_is_host, false)) then
    raise exception 'Not your booking';
  end if;
  if v_booking.status not in ('Requested','Approved','Confirmed') then
    raise exception 'Cannot cancel a booking that is %', v_booking.status;
  end if;
  if v_is_host and v_booking.status = 'Requested' then
    raise exception 'Deny the request instead';
  end if;

  if v_booking.status = 'Confirmed' then
    if v_is_host then
      v_fraction := 1;  -- a host cancelling a paid booking always refunds in full
    else
      v_remaining := v_booking.starts_at - now();
      if v_remaining <= interval '0' then v_fraction := 0;
      elsif v_remaining > make_interval(hours => (v_booking.refund_policy->>'fullRefundHours')::int)
        then v_fraction := 1;
      else v_fraction := (v_booking.refund_policy->>'partialFraction')::numeric;
      end if;
    end if;
    v_refund := round(v_booking.total * v_fraction, 3);
    if v_refund > 0 then
      insert into payments (booking_id, kind, status, amount)
      values (p_booking_id, 'refund', 'pending', v_refund);
    end if;
  end if;

  update bookings
     set status = case when v_is_guest then 'CancelledByGuest' else 'CancelledByHost' end,
         cancelled_at = now()
   where id = p_booking_id returning * into v_booking;
  return v_booking;
end $$;

create or replace function public.expire_stale_approvals() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update bookings set status = 'Expired', cancelled_at = now()
   where status = 'Approved' and payment_deadline < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.mark_no_shows() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update bookings set status = 'NoShow'
   where status = 'Confirmed' and ends_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase SQL editor or MCP `apply_migration` with name `booking_functions`.

- [ ] **Step 3: Verify every function exists**

```sql
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('is_admin','account_type','request_booking','approve_booking','deny_booking',
                   'cancel_booking','confirm_booking_payment','validate_arrival_code',
                   'expire_stale_approvals','mark_no_shows')
 order by proname;
```

Expected: 10 rows.

- [ ] **Step 4: Commit**

```bash
git add maqar-app/supabase/migrations/20260918_booking_functions.sql
git commit -m "Add booking transition functions"
```

---

### Task 5: Permissions — revoke client writes, restrict reads

**Files:**
- Create: `maqar-app/supabase/migrations/20260918_booking_policies.sql`

**Interfaces:**
- Consumes: tables from Task 3, `is_admin()` from Task 4
- Produces: no `INSERT`/`UPDATE`/`DELETE` on `bookings`, `payments`, `booking_codes` for role `authenticated`; `booking_codes` readable by guest and admin only; `profiles` no longer world-readable; reviews gated on a completed booking

- [ ] **Step 1: Write the policies**

Create `maqar-app/supabase/migrations/20260918_booking_policies.sql`:

```sql
-- ============================================================
--  The browser reads. It does not write anything that matters.
-- ============================================================

-- ---------- bookings ----------
revoke insert, update, delete on public.bookings from authenticated, anon;
grant select on public.bookings to authenticated;

drop policy if exists bookings_insert on public.bookings;
drop policy if exists bookings_update on public.bookings;
drop policy if exists bookings_read   on public.bookings;
create policy bookings_read on public.bookings for select using (
  auth.uid() = guest_id
  or auth.uid() = (select host_id from public.rooms r where r.id = room_id)
  or public.is_admin()
);

-- ---------- booking_codes: the guest's code, never the host's ----------
revoke insert, update, delete on public.booking_codes from authenticated, anon;
grant select on public.booking_codes to authenticated;

drop policy if exists booking_codes_read on public.booking_codes;
create policy booking_codes_read on public.booking_codes for select using (
  auth.uid() = (select guest_id from public.bookings b where b.id = booking_id)
  or public.is_admin()
);

-- ---------- payments ----------
revoke insert, update, delete on public.payments from authenticated, anon;
grant select on public.payments to authenticated;

drop policy if exists payments_read   on public.payments;
drop policy if exists payments_insert on public.payments;
create policy payments_read on public.payments for select using (
  auth.uid() = (select guest_id from public.bookings b where b.id = booking_id)
  or auth.uid() = (select r.host_id from public.bookings b join public.rooms r on r.id = b.room_id
                    where b.id = booking_id)
  or public.is_admin()
);

-- ---------- reviews: only after a completed stay ----------
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert with check (
  auth.uid() = author_id
  and exists (
    select 1 from public.bookings b
     where b.room_id = reviews.room_id
       and b.guest_id = auth.uid()
       and b.status = 'Completed'
  )
);

-- ---------- profiles: no more enumerating every user ----------
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.bookings b join public.rooms r on r.id = b.room_id
     where (b.guest_id = profiles.id and r.host_id = auth.uid())
        or (r.host_id  = profiles.id and b.guest_id = auth.uid())
  )
  or exists (
    select 1 from public.messages m join public.rooms r on r.id = m.room_id
     where (m.guest_id = profiles.id and r.host_id = auth.uid())
        or (r.host_id  = profiles.id and m.guest_id = auth.uid())
  )
);
```

- [ ] **Step 2: Apply the migration**

Apply via the SQL editor or MCP `apply_migration` with name `booking_policies`.

- [ ] **Step 3: Verify the client cannot write bookings**

```sql
select has_table_privilege('authenticated', 'public.bookings', 'INSERT') as can_insert,
       has_table_privilege('authenticated', 'public.bookings', 'UPDATE') as can_update,
       has_table_privilege('authenticated', 'public.booking_codes', 'INSERT') as code_insert;
```

Expected: all three `false`.

- [ ] **Step 4: Commit**

```bash
git add maqar-app/supabase/migrations/20260918_booking_policies.sql
git commit -m "Revoke client writes and restrict booking, code and profile reads"
```

---

### Task 6: SQL tests for the functions and the constraint

**Files:**
- Create: `maqar-app/supabase/tests/booking-lifecycle.test.sql`

**Interfaces:**
- Consumes: everything from Tasks 3–5
- Produces: a runnable assertion script; no application code depends on it

- [ ] **Step 1: Write the test script**

Create `maqar-app/supabase/tests/booking-lifecycle.test.sql`:

```sql
-- Run in the Supabase SQL editor. Everything happens inside one DO block so
-- ids can be held in variables, and the whole thing rolls back, leaving no
-- rows behind. A failed assertion raises and aborts.
begin;

do $$
declare
  v_host uuid := gen_random_uuid();
  v_guest uuid := gen_random_uuid();
  v_room uuid := gen_random_uuid();
  v_base timestamptz := date_trunc('hour', now()) + interval '2 days';
begin
  insert into public.profiles (id, type, name) values (v_host, 'host', 'T Host');
  insert into public.profiles (id, type, name) values (v_guest, 'user', 'T Guest');
  insert into public.rooms (id, host_id, title, loc, area, type, cap, price)
  values (v_room, v_host, 'T Room', 'Abdoun, Amman', 'Abdoun', 'Meeting', 4, 10);

  -- a live 4-hour booking
  insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
  values (v_room, v_guest, v_base, v_base + interval '4 hours', 'Confirmed', 40);

  -- 1. the exact bug that shipped: 30 minutes into a 4-hour booking
  begin
    insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
    values (v_room, v_guest, v_base + interval '30 minutes', v_base + interval '90 minutes',
            'Requested', 10);
    raise exception 'FAIL: an overlapping booking was accepted';
  exception when exclusion_violation then
    raise notice 'PASS: overlapping booking rejected';
  end;

  -- 2. abutting is fine: starts exactly when the other ends
  insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
  values (v_room, v_guest, v_base + interval '4 hours', v_base + interval '5 hours',
          'Requested', 10);
  raise notice 'PASS: abutting booking accepted';

  -- 3. the status CHECK rejects the old vocabulary
  begin
    insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
    values (v_room, v_guest, v_base + interval '9 days', v_base + interval '9 days 1 hour',
            'PendingHost', 10);
    raise exception 'FAIL: legacy status accepted';
  exception when check_violation then
    raise notice 'PASS: legacy status rejected';
  end;

  -- 4. cancelling releases the slot
  update public.bookings set status = 'CancelledByGuest'
   where room_id = v_room and status = 'Confirmed';
  insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
  values (v_room, v_guest, v_base, v_base + interval '1 hour', 'Requested', 10);
  raise notice 'PASS: cancelled booking released its slot';

  -- 5. ends_at must follow starts_at
  begin
    insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
    values (v_room, v_guest, v_base + interval '20 days', v_base + interval '19 days',
            'Requested', 10);
    raise exception 'FAIL: backwards booking accepted';
  exception when check_violation then
    raise notice 'PASS: backwards booking rejected';
  end;
end $$;

rollback;
```

- [ ] **Step 2: Run it**

Paste into the Supabase SQL editor and execute. Expected: four `PASS:` notices and no `FAIL:` exception. The transaction rolls back, leaving no rows.

- [ ] **Step 3: Commit**

```bash
git add maqar-app/supabase/tests/booking-lifecycle.test.sql
git commit -m "Add SQL tests for the overlap constraint and status vocabulary"
```

---

### Task 7: The stubbed card rail

**Files:**
- Create: `maqar-app/src/services/paymentRail.js`
- Test: `maqar-app/src/services/paymentRail.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `charge({ bookingId, amount, currency, card }) → Promise<{ok, providerRef, error}>`, `refund({ paymentId, amount }) → Promise<{ok, providerRef, error}>`, `PROVIDER` (`"stub"`)

- [ ] **Step 1: Write the failing test**

Create `maqar-app/src/services/paymentRail.test.js`:

```js
import { describe, it, expect } from "vitest";
import { charge, PROVIDER } from "./paymentRail.js";

const good = { number: "4242424242424242", exp: "12/30", cvc: "123", name: "S Ibrahim" };

describe("charge", () => {
  it("succeeds with a valid test card and returns a provider reference", async () => {
    const res = await charge({ bookingId: "b1", amount: 18, currency: "JOD", card: good });
    expect(res.ok).toBe(true);
    expect(res.providerRef).toMatch(/^stub_/);
  });

  it("declines the designated decline card", async () => {
    const res = await charge({ bookingId: "b1", amount: 18, currency: "JOD",
                              card: { ...good, number: "4000000000000002" } });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("card_declined");
  });

  it("reports a network failure for the designated error card", async () => {
    const res = await charge({ bookingId: "b1", amount: 18, currency: "JOD",
                              card: { ...good, number: "4000000000000119" } });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("network_error");
  });

  it("rejects a non-positive amount", async () => {
    const res = await charge({ bookingId: "b1", amount: 0, currency: "JOD", card: good });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid_amount");
  });

  it("names itself so a real provider can replace it", () => {
    expect(PROVIDER).toBe("stub");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd maqar-app && npm test`
Expected: FAIL — cannot resolve `./paymentRail.js`

- [ ] **Step 3: Implement the stub**

Create `maqar-app/src/services/paymentRail.js`:

```js
// A stand-in for a real payment provider.
//
// No PSP exists for Maqar yet, so this simulates one — including the failure
// paths, so they get built and tested now rather than discovered at
// integration. Replacing this file with a real provider is the whole
// integration: nothing above it knows what a card is.
//
// Card numbers below follow the usual test-card conventions.

export const PROVIDER = "stub";

const DECLINE = "4000000000000002";
const NETWORK_ERROR = "4000000000000119";
const LATENCY_MS = 600;

const ref = () => `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function charge({ amount, card }) {
  if (!(amount > 0)) return { ok: false, error: "invalid_amount" };
  const number = (card?.number || "").replace(/\s/g, "");
  await wait(LATENCY_MS);
  if (number === DECLINE) return { ok: false, error: "card_declined" };
  if (number === NETWORK_ERROR) return { ok: false, error: "network_error" };
  if (number.length < 13) return { ok: false, error: "invalid_card" };
  return { ok: true, providerRef: ref() };
}

export async function refund({ amount }) {
  if (!(amount > 0)) return { ok: false, error: "invalid_amount" };
  await wait(LATENCY_MS);
  return { ok: true, providerRef: ref() };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd maqar-app && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add maqar-app/src/services/paymentRail.js maqar-app/src/services/paymentRail.test.js
git commit -m "Add a stubbed card rail with real failure paths"
```

---

### Task 8: Data access layer for the new RPCs

**Files:**
- Modify: `maqar-app/src/services/db.js`

**Interfaces:**
- Consumes: Supabase client from `../lib/supabase.js`
- Produces: `requestBookingDb({roomId, startsAt, endsAt})`, `approveBookingDb(id)`, `denyBookingDb(id, reason)`, `cancelBookingDb(id)`, `confirmBookingPaymentDb(id, providerRef)`, `validateArrivalCodeDb(id, code)`, `fetchArrivalCode(bookingId)`, all returning `{ data, error }`; `fetchBookings()` updated to the new column shape

- [ ] **Step 1: Replace the bookings section of `db.js`**

In `maqar-app/src/services/db.js`, replace the whole `/* ---------------- bookings ---------------- */` block with:

```js
/* ---------------- bookings ---------------- */
// Reads come straight from the table (RLS scopes them). Every WRITE goes
// through an RPC — the client has no insert or update privilege on bookings.

export async function fetchBookings() {
  const { data } = await supabase
    .from("bookings")
    .select("*, rooms(*)")
    .order("starts_at", { ascending: true });
  return (data || []).map(mapBookingRow);
}

export function mapBookingRow(b) {
  return {
    id: b.id,
    roomId: b.room_id,
    guestId: b.guest_id,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    status: b.status,
    total: Number(b.total),
    commissionRate: Number(b.commission_rate),
    commissionAmount: b.commission_amount == null ? null : Number(b.commission_amount),
    hostPayoutAmount: b.host_payout_amount == null ? null : Number(b.host_payout_amount),
    refundPolicy: b.refund_policy,
    approvedAt: b.approved_at,
    paymentDeadline: b.payment_deadline,
    confirmedAt: b.confirmed_at,
    completedAt: b.completed_at,
    cancelledAt: b.cancelled_at,
    denialReason: b.denial_reason,
    room: b.rooms ? mapRoomRow(b.rooms) : null,
  };
}

export async function requestBookingDb({ roomId, startsAt, endsAt }) {
  const { data, error } = await supabase.rpc("request_booking", {
    p_room_id: roomId, p_starts_at: startsAt, p_ends_at: endsAt,
  });
  return { data: data ? mapBookingRow(data) : null, error };
}

export async function approveBookingDb(id) {
  const { data, error } = await supabase.rpc("approve_booking", { p_booking_id: id });
  return { data: data ? mapBookingRow(data) : null, error };
}

export async function denyBookingDb(id, reason) {
  const { data, error } = await supabase.rpc("deny_booking", { p_booking_id: id, p_reason: reason });
  return { data: data ? mapBookingRow(data) : null, error };
}

export async function cancelBookingDb(id) {
  const { data, error } = await supabase.rpc("cancel_booking", { p_booking_id: id });
  return { data: data ? mapBookingRow(data) : null, error };
}

export async function confirmBookingPaymentDb(id, providerRef) {
  const { data, error } = await supabase.rpc("confirm_booking_payment", {
    p_booking_id: id, p_provider_ref: providerRef,
  });
  return { data: data ? mapBookingRow(data) : null, error };
}

export async function validateArrivalCodeDb(id, code) {
  const { data, error } = await supabase.rpc("validate_arrival_code", {
    p_booking_id: id, p_code: code,
  });
  return { data: data ? mapBookingRow(data) : null, error };
}

// Guests only — RLS denies this to the host, deliberately.
export async function fetchArrivalCode(bookingId) {
  const { data } = await supabase.from("booking_codes").select("code").eq("booking_id", bookingId).maybeSingle();
  return data?.code || null;
}

export async function bookedRangesDb(roomId, fromIso, toIso) {
  const { data } = await supabase
    .from("bookings").select("starts_at, ends_at")
    .eq("room_id", roomId)
    .in("status", ["Requested", "Approved", "Confirmed"])
    .gte("starts_at", fromIso).lt("starts_at", toIso);
  return (data || []).map((b) => ({ startsAt: b.starts_at, endsAt: b.ends_at }));
}
```

- [ ] **Step 2: Replace the payments section**

Replace the whole `/* ---------------- payments ---------------- */` block with:

```js
/* ---------------- payments ---------------- */
// Written only by the transition functions. The client reads and nothing else.

export async function fetchPayments() {
  const { data } = await supabase
    .from("payments")
    .select("*, bookings(room_id, starts_at)")
    .order("created_at", { ascending: false });
  return (data || []).map((p) => ({
    id: p.id,
    bookingId: p.booking_id,
    roomId: p.bookings?.room_id || null,
    kind: p.kind,
    status: p.status,
    amount: Number(p.amount),
    currency: p.currency,
    date: (p.created_at || "").slice(0, 10),
  }));
}
```

- [ ] **Step 3: Delete the stale helpers**

Remove `addPaymentDb`, `createBookingDb`, `updateBookingDb` and `takenSlotsDb` entirely — every caller is replaced in Task 9.

- [ ] **Step 4: Verify the build**

Run: `cd maqar-app && npm run build`
Expected: fails with unresolved imports in `AppContext.jsx` — that is correct at this point and Task 9 fixes it.

- [ ] **Step 5: Commit**

```bash
git add maqar-app/src/services/db.js
git commit -m "Point the data layer at the booking RPCs"
```

---

### Task 9: Store actions and the demo-mode executor

**Files:**
- Modify: `maqar-app/src/store/AppContext.jsx`

**Interfaces:**
- Consumes: `bookingMachine.js` (Task 1–2), `paymentRail.js` (Task 7), `db.js` (Task 8)
- Produces: context values `requestBooking({room, startsAt, endsAt})`, `approveBooking(id)`, `denyBooking(id, reason)`, `cancelBooking(id)`, `payForBooking(id, card)`, `validateArrivalCode(id, code)`, `arrivalCodeFor(id)`, `bookedRanges(roomId, date)` — each returning `{ ok, error }` or the requested value, and each working in both modes

- [ ] **Step 1: Add the imports**

At the top of `maqar-app/src/store/AppContext.jsx`, add:

```js
import { STATUS, ACTOR, canTransition, paymentDeadline, refundAmount, bookingTotal, overlaps } from "../lib/bookingMachine.js";
import * as rail from "../services/paymentRail.js";
```

- [ ] **Step 2: Replace the bookings section**

Replace the `// ----- bookings (live) -----` block and the `// ----- availability ... -----` block with:

```js
  // ----- bookings -----
  // Live mode calls RPCs; demo mode runs the same rules from bookingMachine
  // against a persisted local list. The rules live in one file so the two
  // cannot drift.
  const [demoBookings, setDemoBookings] = usePersistedState("maqar-bookings", []);
  const allBookings = live ? bookings : demoBookings;

  const bookedRanges = useCallback(async (roomId) => {
    if (live) {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 90 * 864e5).toISOString();
      return db.bookedRangesDb(roomId, from, to);
    }
    return demoBookings
      .filter((b) => String(b.roomId) === String(roomId) && ["Requested", "Approved", "Confirmed"].includes(b.status))
      .map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt }));
  }, [demoBookings]);

  const requestBooking = useCallback(async ({ room, startsAt, endsAt }) => {
    if (live && account?.id) {
      const { data, error } = await db.requestBookingDb({ roomId: room.id, startsAt, endsAt });
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      return { ok: true, booking: data };
    }
    const clash = demoBookings.some((b) =>
      String(b.roomId) === String(room.id) &&
      ["Requested", "Approved", "Confirmed"].includes(b.status) &&
      overlaps(b.startsAt, b.endsAt, startsAt, endsAt));
    if (clash) return { ok: false, error: "That time is no longer free." };
    const booking = {
      id: `bk-${Date.now()}`, roomId: room.id, guestId: "demo-guest",
      startsAt, endsAt, status: STATUS.REQUESTED,
      total: bookingTotal(room.price, startsAt, endsAt),
      commissionRate: 0.2, denialReason: null, paymentDeadline: null, code: null,
    };
    setDemoBookings((list) => [booking, ...list]);
    return { ok: true, booking };
  }, [account, demoBookings, setDemoBookings]);

  const patchDemo = useCallback((id, patch) => {
    setDemoBookings((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, [setDemoBookings]);

  const approveBooking = useCallback(async (id) => {
    if (live) {
      const { error } = await db.approveBookingDb(id);
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      return { ok: true };
    }
    const b = demoBookings.find((x) => x.id === id);
    if (!b || !canTransition(b.status, STATUS.APPROVED, ACTOR.HOST)) return { ok: false, error: "Not allowed." };
    patchDemo(id, { status: STATUS.APPROVED, paymentDeadline: paymentDeadline(new Date(), b.startsAt).toISOString() });
    return { ok: true };
  }, [demoBookings, patchDemo]);

  const denyBooking = useCallback(async (id, reason) => {
    if (!String(reason || "").trim()) return { ok: false, error: "A reason is required." };
    if (live) {
      const { error } = await db.denyBookingDb(id, reason);
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      return { ok: true };
    }
    const b = demoBookings.find((x) => x.id === id);
    if (!b || !canTransition(b.status, STATUS.DENIED, ACTOR.HOST)) return { ok: false, error: "Not allowed." };
    patchDemo(id, { status: STATUS.DENIED, denialReason: reason.trim() });
    return { ok: true };
  }, [demoBookings, patchDemo]);

  const cancelBooking = useCallback(async (id) => {
    if (live) {
      const { error } = await db.cancelBookingDb(id);
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      setPayments(await db.fetchPayments());
      return { ok: true };
    }
    const b = demoBookings.find((x) => x.id === id);
    if (!b || !canTransition(b.status, STATUS.CANCELLED_BY_GUEST, ACTOR.GUEST)) return { ok: false, error: "Not allowed." };
    const refund = b.status === STATUS.CONFIRMED ? refundAmount(b.total, b.startsAt, new Date()) : 0;
    patchDemo(id, { status: STATUS.CANCELLED_BY_GUEST });
    if (refund > 0) setPayments((p) => [{ id: `pay-${Date.now()}`, bookingId: id, roomId: b.roomId, kind: "refund", status: "pending", amount: refund, currency: "JOD", date: new Date().toISOString().slice(0, 10) }, ...p]);
    return { ok: true };
  }, [demoBookings, patchDemo, setPayments]);

  const payForBooking = useCallback(async (id, card) => {
    const b = allBookings.find((x) => x.id === id);
    if (!b) return { ok: false, error: "Booking not found." };
    const res = await rail.charge({ bookingId: id, amount: b.total, currency: "JOD", card });
    if (!res.ok) return { ok: false, error: res.error };
    if (live) {
      const { error } = await db.confirmBookingPaymentDb(id, res.providerRef);
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      setPayments(await db.fetchPayments());
      return { ok: true };
    }
    const code = String(Math.floor(1000 + Math.random() * 9000));
    patchDemo(id, { status: STATUS.CONFIRMED, code });
    setPayments((p) => [{ id: `pay-${Date.now()}`, bookingId: id, roomId: b.roomId, kind: "charge", status: "succeeded", amount: b.total, currency: "JOD", date: new Date().toISOString().slice(0, 10) }, ...p]);
    return { ok: true };
  }, [allBookings, patchDemo, setPayments]);

  const validateArrivalCode = useCallback(async (id, code) => {
    if (live) {
      const { error } = await db.validateArrivalCodeDb(id, code);
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      return { ok: true };
    }
    const b = demoBookings.find((x) => x.id === id);
    if (!b || b.status !== STATUS.CONFIRMED) return { ok: false, error: "Not allowed." };
    if (b.code !== code) return { ok: false, error: "That code does not match." };
    patchDemo(id, { status: STATUS.COMPLETED });
    return { ok: true };
  }, [demoBookings, patchDemo]);

  const arrivalCodeFor = useCallback(async (id) => {
    if (live) return db.fetchArrivalCode(id);
    return demoBookings.find((x) => x.id === id)?.code || null;
  }, [demoBookings]);
```

- [ ] **Step 3: Update the context value**

In the `const value = { ... }` object, remove `takenFor`, `takeSlot`, `submitBooking`, `updateBooking` and `addPayment`, and add:

```js
    bookings: allBookings, bookedRanges,
    requestBooking, approveBooking, denyBooking, cancelBooking,
    payForBooking, validateArrivalCode, arrivalCodeFor,
```

- [ ] **Step 4: Remove the dead availability state**

Delete the `taken` persisted slice, the `SEED_TAKEN` import, and `takenFor`/`takeSlot`. Availability now comes from bookings in both modes.

- [ ] **Step 5: Verify demo mode still runs**

Run: `cd maqar-app && npm run dev` with `.env.local` renamed away, and confirm the home page renders and a room detail page opens.

- [ ] **Step 6: Commit**

```bash
git add maqar-app/src/store/AppContext.jsx
git commit -m "Wire store actions to the lifecycle in both modes"
```

---

### Task 10: Booking screen becomes a request, not a purchase

**Files:**
- Modify: `maqar-app/src/screens/Booking.jsx`
- Modify: `maqar-app/src/i18n/index.jsx`

**Interfaces:**
- Consumes: `requestBooking`, `bookedRanges` from Task 9; `canRequestAt`, `overlaps`, `bookingTotal` from Task 2
- Produces: a two-step flow ending in `Requested`. No payment, no code, no proof upload

- [ ] **Step 1: Add the i18n keys**

In `maqar-app/src/i18n/index.jsx`, add to **both** `EN` and `AR`:

```js
// EN
"booking.step2TitleReview": "Review your request",
"booking.step2SubReview": "Nothing is charged yet. The host reviews your request, and you pay only once they accept.",
"booking.sendRequest": "Send request",
"booking.requested": "Request sent",
"booking.requestedBody": "{host} has your request. You'll be asked to pay once they accept — we'll hold this time until then.",
"booking.noPastDates": "Pick a date from today onwards.",
"booking.tooSoon": "Bookings need at least an hour's notice.",
"booking.slotTaken": "That time was just taken.",
```

```js
// AR
"booking.step2TitleReview": "راجع طلبك",
"booking.step2SubReview": "لن يتم خصم أي مبلغ الآن. يراجع المضيف طلبك، وتدفع فقط بعد قبوله.",
"booking.sendRequest": "إرسال الطلب",
"booking.requested": "تم إرسال الطلب",
"booking.requestedBody": "وصل طلبك إلى {host}. سنطلب منك الدفع بعد القبول، ونحجز لك هذا الوقت حتى ذلك الحين.",
"booking.noPastDates": "اختر تاريخاً من اليوم فصاعداً.",
"booking.tooSoon": "يلزم حجز الغرفة قبل ساعة على الأقل.",
"booking.slotTaken": "تم حجز هذا الوقت للتو.",
```

- [ ] **Step 2: Add the imports**

At the top of `maqar-app/src/screens/Booking.jsx`, add:

```js
import { canRequestAt, overlaps } from "../lib/bookingMachine.js";
```

and change the `useApp()` destructure to take the new actions:

```js
const { booking, setBooking, toast, loggedIn, accountType, authReady, pendingAction,
        requestBooking, bookedRanges, getRoom } = useApp();
```

Remove `matchCode`, `setMatchCode`, `takenFor` and `submitBooking` from that destructure — they no longer exist.

- [ ] **Step 3: Fix the date default**

In `maqar-app/src/screens/Booking.jsx`, replace:

```js
import { DEFAULT_DATE } from "../data/seed.js";
```

with nothing, and replace:

```js
const [date, setDate] = useState(DEFAULT_DATE);
```

with:

```js
const todayIso = new Date().toISOString().slice(0, 10);
const [date, setDate] = useState(todayIso);
```

Then add `min={todayIso}` to the date `<input type="date">`.

- [ ] **Step 4: Derive taken slots from real ranges**

Replace `const taken = takenFor(room.id, date);` with:

```js
const [ranges, setRanges] = useState([]);
useEffect(() => {
  let alive = true;
  bookedRanges(room.id).then((r) => { if (alive) setRanges(r); });
  return () => { alive = false; };
}, [room.id, bookedRanges]);

// A slot is unavailable if a booking covers ANY part of the session that
// starting there would occupy. This is what the old `slot`-only check missed.
const slotStart = (s) => new Date(`${date}T${s}:00`);
const slotEnd = (s) => new Date(slotStart(s).getTime() + booking.dur * 3600 * 1000);
const isTaken = (s) =>
  ranges.some((r) => overlaps(r.startsAt, r.endsAt, slotStart(s), slotEnd(s))) ||
  !canRequestAt(slotStart(s), new Date());
```

Replace every `taken.includes(s)` with `isTaken(s)`.

- [ ] **Step 5: Replace the payment step with a review step**

Delete the entire `{step === 2 && (...)}` block (the CliQ panel, the alias copy button and the proof attach button) and replace it with:

```jsx
      {step === 2 && (
        <>
          <div className="surface p-[26px] mb-[18px]">
            <h2 className="text-[22px] font-semibold mb-[6px]">{t("booking.step2TitleReview")}</h2>
            <p className="text-[14px] mb-5" style={{ color: "var(--muted)" }}>{t("booking.step2SubReview")}</p>
            <div className="rounded-xl p-4 px-[18px]" style={{ background: "var(--foam)", border: "1px solid var(--line)" }}>
              <SumRow l={rt.title} r={`${room.price} ${perHr}`} />
              <SumRow l={`${booking.slot} · ${durLabel(booking.dur)}`} r="" />
              <div className="flex justify-between text-[16px] font-bold pt-[13px] mt-[6px]"
                style={{ borderTop: "1px dashed var(--line)", color: "var(--coffee)" }}>
                <span>{t("booking.total")}</span><span>{total} {jod}</span>
              </div>
            </div>
          </div>
          <FlowNav backTxt={t("booking.back")} onBack={() => setStep(1)} nextTxt={t("booking.sendRequest")} onNext={next} />
        </>
      )}
```

- [ ] **Step 6: Replace `next()` so step 2 requests rather than pays**

```js
  async function next() {
    if (step === 2) {
      const startsAt = slotStart(booking.slot).toISOString();
      const endsAt = slotEnd(booking.slot).toISOString();
      const res = await requestBooking({ room, startsAt, endsAt });
      if (!res.ok) {
        toast(res.error || t("booking.slotTaken"));
        setBooking((b) => ({ ...b, slot: null }));
        setStep(1);
        window.scrollTo(0, 0);
        return;
      }
    }
    setStep((s) => s + 1);
    window.scrollTo(0, 0);
  }
```

- [ ] **Step 7: Replace the confirmation step**

In the `{step === 3 && (...)}` block, delete the `matchCode` digit grid entirely (no code exists yet) and change the heading to `t("booking.requested")` and the body to `t("booking.requestedBody", { host })`.

- [ ] **Step 8: Verify the build and demo mode**

Run: `cd maqar-app && npm run build` — expected clean.
Then run the dev server in demo mode and walk a booking through to "Request sent".

- [ ] **Step 9: Commit**

```bash
git add maqar-app/src/screens/Booking.jsx maqar-app/src/i18n/index.jsx
git commit -m "Booking flow requests a slot instead of faking a payment"
```

---

### Task 11: The payment screen

**Files:**
- Create: `maqar-app/src/screens/Pay.jsx`
- Modify: `maqar-app/src/App.jsx`
- Modify: `maqar-app/src/i18n/index.jsx`

**Interfaces:**
- Consumes: `payForBooking`, `arrivalCodeFor`, `bookings` from Task 9
- Produces: route `/pay/:bookingId`, guest-only, which charges the stubbed rail and shows the arrival code on success

- [ ] **Step 1: Add the i18n keys**

Add to **both** `EN` and `AR` in `maqar-app/src/i18n/index.jsx`:

```js
// EN
"pay.title": "Pay to confirm",
"pay.sub": "{host} accepted your request. Pay the full amount to confirm and get your arrival code.",
"pay.deadline": "Pay before {time} or the room is released.",
"pay.card": "Card number", "pay.exp": "Expiry", "pay.cvc": "CVC", "pay.name": "Name on card",
"pay.payNow": "Pay {amount} JOD",
"pay.refundNote": "Free cancellation until 24 hours before the start. After that, 50% is refunded. Nothing is refunded once the session begins.",
"pay.confirmed": "Booking confirmed",
"pay.codeBody": "Show this code at the door. The host types it in to check you in.",
"pay.err.card_declined": "That card was declined. Try another.",
"pay.err.network_error": "We couldn't reach the payment provider. Try again.",
"pay.err.invalid_card": "Check the card number.",
"pay.err.invalid_amount": "Something is wrong with this booking's amount.",
"pay.notPayable": "This booking isn't awaiting payment.",
```

```js
// AR
"pay.title": "ادفع للتأكيد",
"pay.sub": "قَبِل {host} طلبك. ادفع المبلغ كاملاً للتأكيد والحصول على رمز الدخول.",
"pay.deadline": "ادفع قبل {time} وإلا تم تحرير الغرفة.",
"pay.card": "رقم البطاقة", "pay.exp": "تاريخ الانتهاء", "pay.cvc": "الرمز السري", "pay.name": "الاسم على البطاقة",
"pay.payNow": "ادفع {amount} د.أ",
"pay.refundNote": "إلغاء مجاني حتى 24 ساعة قبل الموعد. بعدها يُسترد 50%. ولا يُسترد شيء بعد بدء الجلسة.",
"pay.confirmed": "تم تأكيد الحجز",
"pay.codeBody": "اعرض هذا الرمز عند الباب. يُدخله المضيف لتسجيل وصولك.",
"pay.err.card_declined": "تم رفض البطاقة. جرّب بطاقة أخرى.",
"pay.err.network_error": "تعذّر الوصول إلى مزوّد الدفع. حاول مجدداً.",
"pay.err.invalid_card": "تحقق من رقم البطاقة.",
"pay.err.invalid_amount": "هناك مشكلة في مبلغ هذا الحجز.",
"pay.notPayable": "هذا الحجز ليس بانتظار الدفع.",
```

- [ ] **Step 2: Create the screen**

Create `maqar-app/src/screens/Pay.jsx`:

```jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Check, CreditCard, Clock } from "lucide-react";
import { roomText } from "../data/rooms.js";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";
import { useRequireAccount } from "../lib/guards.jsx";
import { STATUS } from "../lib/bookingMachine.js";

export default function Pay() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const { bookings, payForBooking, arrivalCodeFor, toast } = useApp();
  const { t, lang } = useT();
  const blocked = useRequireAccount("user");

  const [card, setCard] = useState({ number: "", exp: "", cvc: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(null);

  const booking = bookings.find((b) => String(b.id) === String(bookingId));

  useEffect(() => {
    if (booking?.status === STATUS.CONFIRMED) arrivalCodeFor(booking.id).then(setCode);
  }, [booking?.status, booking?.id, arrivalCodeFor]);

  if (blocked || !booking) return null;
  const room = booking.room;
  const rt = room ? roomText(room, lang) : { title: "", loc: "" };
  const host = (rt.loc || "").split(/[,،]/)[0].trim();
  const jod = lang === "ar" ? "د.أ" : "JOD";

  if (booking.status === STATUS.CONFIRMED) {
    return (
      <div className="max-w-[760px] mx-auto px-[22px] pt-7 pb-[60px]">
        <div className="surface p-[26px] py-10 text-center">
          <div className="w-[74px] h-[74px] rounded-full grid place-items-center mx-auto mb-[18px] animate-popCheck"
            style={{ background: "rgba(63,122,78,.12)", color: "var(--good)" }}>
            <Check className="w-9 h-9" strokeWidth={3} />
          </div>
          <h2 className="text-[26px] mb-2 font-semibold">{t("pay.confirmed")}</h2>
          <p className="text-[14px] max-w-[420px] mx-auto mb-6" style={{ color: "var(--muted)" }}>{t("pay.codeBody")}</p>
          {code && (
            <div className="inline-flex gap-[10px] my-[22px]" dir="ltr">
              {code.split("").map((d, i) => (
                <div key={i} className="code-digit w-[58px] h-[68px] rounded-[14px] text-[34px]"
                  style={{ animation: `flipIn .5s cubic-bezier(.22,1,.36,1) ${0.25 + i * 0.1}s both` }}>{d}</div>
              ))}
            </div>
          )}
          <button className="btn-primary py-[13px] rounded-xl max-w-[300px] w-full mx-auto block" onClick={() => nav("/me")}>
            {t("booking.goBookings")}
          </button>
        </div>
      </div>
    );
  }

  if (booking.status !== STATUS.APPROVED) {
    return <div className="max-w-[760px] mx-auto px-[22px] pt-7"><div className="surface p-8 text-center text-[14px]" style={{ color: "var(--muted)" }}>{t("pay.notPayable")}</div></div>;
  }

  async function submit() {
    setBusy(true);
    const res = await payForBooking(booking.id, card);
    setBusy(false);
    if (!res.ok) toast(t(`pay.err.${res.error}`) || res.error);
  }

  const deadline = booking.paymentDeadline
    ? new Date(booking.paymentDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="max-w-[760px] mx-auto px-[22px] pt-7 pb-[60px]">
      <div className="surface p-[26px] mb-[18px]">
        <h2 className="text-[22px] font-semibold mb-[6px]">{t("pay.title")}</h2>
        <p className="text-[14px] mb-4" style={{ color: "var(--muted)" }}>{t("pay.sub", { host })}</p>

        {deadline && (
          <div className="flex items-center gap-2 text-[13px] font-semibold mb-5 p-3 rounded-xl"
            style={{ background: "rgba(192,134,59,.08)", border: "1px solid var(--line)", color: "var(--warn)" }}>
            <Clock className="w-4 h-4 shrink-0" /> {t("pay.deadline", { time: deadline })}
          </div>
        )}

        <div className="rounded-xl p-4 px-[18px] mb-5" style={{ background: "var(--foam)", border: "1px solid var(--line)" }}>
          <div className="flex justify-between text-[16px] font-bold" style={{ color: "var(--coffee)" }}>
            <span>{rt.title}</span><span className="num">{booking.total} {jod}</span>
          </div>
        </div>

        <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("pay.card")}</label>
        <input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })}
          inputMode="numeric" autoComplete="cc-number" dir="ltr" placeholder="4242 4242 4242 4242" className="field-input mb-3" />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("pay.exp")}</label>
            <input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })}
              autoComplete="cc-exp" dir="ltr" placeholder="12/30" className="field-input" />
          </div>
          <div>
            <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("pay.cvc")}</label>
            <input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })}
              autoComplete="cc-csc" dir="ltr" placeholder="123" className="field-input" />
          </div>
        </div>

        <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("pay.name")}</label>
        <input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })}
          autoComplete="cc-name" className="field-input mb-4" />

        <p className="text-[12px] mb-4" style={{ color: "var(--muted)" }}>{t("pay.refundNote")}</p>

        <button onClick={submit} disabled={busy || !card.number}
          className="btn-primary w-full py-[13px] rounded-xl text-[15px] flex items-center justify-center gap-2">
          <CreditCard className="w-4 h-4" /> {t("pay.payNow", { amount: booking.total })}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register the route**

In `maqar-app/src/App.jsx`, add the import and the route:

```jsx
import Pay from "./screens/Pay.jsx";
```

```jsx
          <Route path="/pay/:bookingId" element={<Pay />} />
```

- [ ] **Step 4: Verify**

Run: `cd maqar-app && npm run build` — expected clean.
In demo mode, request a booking, approve it from the host dashboard (Task 13), then visit `/pay/<id>` and pay with `4242424242424242`. Confirm a code appears. Repeat with `4000000000000002` and confirm the decline message.

- [ ] **Step 5: Commit**

```bash
git add maqar-app/src/screens/Pay.jsx maqar-app/src/App.jsx maqar-app/src/i18n/index.jsx
git commit -m "Add the card payment screen behind the stubbed rail"
```

---

### Task 12: Guest dashboard shows real state

**Files:**
- Modify: `maqar-app/src/screens/UserDash.jsx`
- Modify: `maqar-app/src/i18n/index.jsx`

**Interfaces:**
- Consumes: `bookings`, `cancelBooking`, `arrivalCodeFor` from Task 9
- Produces: a bookings list driven entirely by real state, with a Pay call-to-action on `Approved` and the denial reason on `Denied`

- [ ] **Step 1: Add the i18n keys**

Add to **both** `EN` and `AR`:

```js
// EN
"st.Requested": "Awaiting host", "st.Approved": "Pay to confirm", "st.Expired": "Expired",
"st.NoShow": "Missed", "st.CancelledByGuest": "Cancelled", "st.CancelledByHost": "Cancelled by host",
"ud.payNow": "Pay now", "ud.deniedReason": "Host's reason: {reason}",
"ud.refundNote": "You'll be refunded {amount} JOD.",
"ud.noBookings": "No bookings yet.",
```

```js
// AR
"st.Requested": "بانتظار المضيف", "st.Approved": "ادفع للتأكيد", "st.Expired": "منتهي",
"st.NoShow": "لم يتم الحضور", "st.CancelledByGuest": "ملغى", "st.CancelledByHost": "ألغاه المضيف",
"ud.payNow": "ادفع الآن", "ud.deniedReason": "سبب المضيف: {reason}",
"ud.refundNote": "سيتم ردّ {amount} د.أ لك.",
"ud.noBookings": "لا توجد حجوزات بعد.",
```

- [ ] **Step 2: Fix the imports**

At the top of `maqar-app/src/screens/UserDash.jsx`, add:

```js
import { STATUS, refundAmount } from "../lib/bookingMachine.js";
```

Change the `useApp()` destructure to:

```js
const { openModal, toast, setCurrentRoom, resetBooking, favorites, payments, getRoom,
        bookings, cancelBooking, arrivalCodeFor } = useApp();
```

Remove `matchCode`, `updateBooking` and `isLiveBackend` from it, and drop the now-unused `ROOMS` import.

- [ ] **Step 3: Delete the staged data**

Remove the `demoBookings` array literal, the `liveCode` fallback `"4821"`, the entire `history` tab content array, and the `history` entry from the `Tabbar` tabs list. Remove the "Student perks" card (`ud.studentPerks`) and its toast handler.

- [ ] **Step 4: Drive the list from real bookings**

Replace the `bookings` derivation with:

```js
  const rows = bookings
    .map((b) => ({ ...b, room: b.room || getRoom(b.roomId) }))
    .filter((b) => b.room);
```

and render `rows`, passing `b.status` straight through to `t(\`st.${b.status}\`)`.

- [ ] **Step 5: Add the pay and reason affordances**

Inside the booking row, replace the action buttons with:

```jsx
  {b.status === STATUS.APPROVED && (
    <button onClick={() => nav(`/pay/${b.id}`)}
      className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold text-white whitespace-nowrap"
      style={{ background: "var(--good)" }}>{t("ud.payNow")}</button>
  )}
  {[STATUS.REQUESTED, STATUS.APPROVED, STATUS.CONFIRMED].includes(b.status) && (
    <button onClick={() => confirmCancel(b)}
      className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold whitespace-nowrap"
      style={{ background: "var(--foam)", color: "var(--bad)", border: "1px solid var(--line)" }}>{t("ud.cancel")}</button>
  )}
```

and below the status chip:

```jsx
  {b.status === STATUS.DENIED && b.denialReason && (
    <div className="text-[12px] italic mt-[6px]" style={{ color: "var(--bad)" }}>
      {t("ud.deniedReason", { reason: b.denialReason })}
    </div>
  )}
```

- [ ] **Step 6: Show the refund amount before cancelling**

```js
  function confirmCancel(b) {
    const refund = b.status === STATUS.CONFIRMED ? refundAmount(b.total, b.startsAt, new Date()) : 0;
    openModal({
      title: t("ud.cancelTitle"),
      msg: `${t("ud.cancelMsg")}${b.status === STATUS.CONFIRMED ? " " + t("ud.refundNote", { amount: refund }) : ""}`,
      cancelTxt: t("ud.keepBooking"), okTxt: t("ud.cancelBooking"), variant: "bad",
      onConfirm: async () => {
        const res = await cancelBooking(b.id);
        toast(res.ok ? t("ud.cancelledToast") : res.error);
      },
    });
  }
```

- [ ] **Step 7: Fetch the code only for confirmed bookings**

```js
  const [codes, setCodes] = useState({});
  useEffect(() => {
    let alive = true;
    Promise.all(rows.filter((b) => b.status === STATUS.CONFIRMED)
      .map(async (b) => [b.id, await arrivalCodeFor(b.id)]))
      .then((pairs) => { if (alive) setCodes(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [rows.map((b) => `${b.id}:${b.status}`).join(","), arrivalCodeFor]);
```

Render `codes[b.id]` in the digit strip, only when present.

- [ ] **Step 8: Verify**

Run: `cd maqar-app && npm run build` and `npm run lint` — clean, still 11 pre-existing lint errors.

- [ ] **Step 9: Commit**

```bash
git add maqar-app/src/screens/UserDash.jsx maqar-app/src/i18n/index.jsx
git commit -m "Guest dashboard reflects real booking state"
```

---

### Task 13: Host dashboard — real requests, real check-in, no code on screen

**Files:**
- Modify: `maqar-app/src/screens/HostDash.jsx`
- Modify: `maqar-app/src/i18n/index.jsx`

**Interfaces:**
- Consumes: `bookings`, `approveBooking`, `denyBooking`, `validateArrivalCode` from Task 9
- Produces: a request list from real bookings, a working check-in, and **no arrival code anywhere in the host UI**

- [ ] **Step 1: Add the i18n keys**

Add to **both** `EN` and `AR`:

```js
// EN
"hd.awaitingPayment": "Awaiting guest payment",
"hd.checkInTitle": "Check a guest in",
"hd.checkInSub": "Ask the guest for their 4-digit code and type it here.",
"hd.pickBooking": "Which booking?",
"hd.checkedIn": "Checked in.",
"hd.noArrivals": "No confirmed bookings to check in.",
"hd.yourPayout": "You receive {amount} JOD",
"hd.noRequests": "No requests right now.",
```

```js
// AR
"hd.awaitingPayment": "بانتظار دفع الضيف",
"hd.checkInTitle": "تسجيل وصول ضيف",
"hd.checkInSub": "اطلب من الضيف رمزه المكوّن من 4 أرقام وأدخله هنا.",
"hd.pickBooking": "أي حجز؟",
"hd.checkedIn": "تم تسجيل الوصول.",
"hd.noArrivals": "لا توجد حجوزات مؤكدة لتسجيل وصولها.",
"hd.yourPayout": "ستحصل على {amount} د.أ",
"hd.noRequests": "لا توجد طلبات حالياً.",
```

- [ ] **Step 2: Fix the imports**

At the top of `maqar-app/src/screens/HostDash.jsx`, add:

```js
import { STATUS } from "../lib/bookingMachine.js";
```

Change the `useApp()` destructure to:

```js
const { openModal, toast, rooms, account, getRoom,
        bookings, approveBooking, denyBooking, validateArrivalCode } = useApp();
```

Remove `myListings`, `isLiveBackend` and `updateBooking`. Keep `hostRooms` working by deriving it from `rooms` in both modes now that seed rooms have an owner:

```js
const hostRooms = rooms.filter((r) => r.host_id && r.host_id === account?.id).map((r) => ({ ...r, name: r.title }));
```

- [ ] **Step 3: Delete every staged panel**

Remove `REVENUE_7D`, `PATTERN`, `HOURS`, the `useCountUp` calls for `rev`/`conf`/`occ`, the three `<Stat>` tiles, the `RevenueChart` block, the occupancy heatmap block, the "late notifications" card, the `Agenda` component and its `SEED_AGENDA` import, and the hardcoded `reqs` state array. Delete the `ROOMS` import if nothing else uses it.

- [ ] **Step 4: Drive requests from real bookings**

```js
  const requests = bookings
    .map((b) => ({ ...b, room: b.room || getRoom(b.roomId) }))
    .filter((b) => b.room && [STATUS.REQUESTED, STATUS.APPROVED, STATUS.CONFIRMED].includes(b.status));
```

Render each with title, `starts_at`–`ends_at` formatted in local time, the status chip, and the host's share:

```jsx
  <div className="text-[12px] font-semibold" style={{ color: "var(--good)" }}>
    {t("hd.yourPayout", { amount: (b.total - b.total * 0.2).toFixed(2) })}
  </div>
```

**Do not render the arrival code anywhere on this screen.** RLS will not return it, and showing it would defeat check-in.

- [ ] **Step 5: Wire approve and deny**

```js
  async function approve(id) {
    const res = await approveBooking(id);
    toast(res.ok ? t("hd.approveToast") : res.error);
  }

  function deny(id) {
    openModal({
      title: t("hd.denyTitle"), msg: t("hd.denyMsg"), okTxt: t("hd.denyConfirm"),
      variant: "bad", textarea: true,
      onConfirm: async (text) => {
        const res = await denyBooking(id, text);
        toast(res.ok ? t("hd.denyToast") : res.error);
      },
    });
  }
```

Show approve/deny only when `b.status === STATUS.REQUESTED`, and the `hd.awaitingPayment` chip when `STATUS.APPROVED`.

- [ ] **Step 6: Replace the arrivals tab with a working check-in**

```jsx
  {tab === "arrivals" && (() => {
    const arrivals = requests.filter((b) => b.status === STATUS.CONFIRMED);
    if (!arrivals.length) return <div className="surface p-8 text-center text-[14px]" style={{ color: "var(--muted)" }}>{t("hd.noArrivals")}</div>;
    return (
      <div className="surface p-[26px]">
        <h2 className="text-[18px] font-semibold mb-[6px]">{t("hd.checkInTitle")}</h2>
        <p className="text-[14px] mb-5" style={{ color: "var(--muted)" }}>{t("hd.checkInSub")}</p>
        <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("hd.pickBooking")}</label>
        <select value={arrivalId} onChange={(e) => setArrivalId(e.target.value)} className="field-input mb-4">
          <option value="">—</option>
          {arrivals.map((b) => (
            <option key={b.id} value={b.id}>
              {roomText(b.room, lang).title} · {new Date(b.startsAt).toLocaleString()}
            </option>
          ))}
        </select>
        <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("hd.enterCode")}</label>
        <input value={verifyVal} onChange={(e) => setVerifyVal(e.target.value.replace(/\D/g, ""))}
          maxLength={4} placeholder={t("hd.fourDigits")} dir="ltr"
          className="field-input text-center text-[22px] font-bold tracking-[8px] mb-4" />
        <button className="btn-primary w-full py-[13px] rounded-xl text-[15px]" onClick={checkIn}
          disabled={!arrivalId || verifyVal.length !== 4}>{t("hd.verifyArrival")}</button>
      </div>
    );
  })()}
```

with:

```js
  const [arrivalId, setArrivalId] = useState("");
  const [verifyVal, setVerifyVal] = useState("");

  async function checkIn() {
    const res = await validateArrivalCode(arrivalId, verifyVal);
    toast(res.ok ? t("hd.checkedIn") : res.error);
    if (res.ok) { setVerifyVal(""); setArrivalId(""); }
  }
```

- [ ] **Step 7: Remove the agenda tab**

Drop `["agenda", t("hd.tabAgenda")]` from the tab list — real agenda comes with host tooling, and a seeded one is worse than none.

- [ ] **Step 8: Verify**

Run: `cd maqar-app && npm run build` and `npm test` — both clean.
In demo mode: request a booking as a guest, approve it as a host, pay, then check in with the code shown to the guest. Confirm a wrong code is rejected.

- [ ] **Step 9: Commit**

```bash
git add maqar-app/src/screens/HostDash.jsx maqar-app/src/i18n/index.jsx
git commit -m "Host dashboard drives real requests and a working check-in"
```

---

### Task 14: Give the seed rooms an owner and refresh schema.sql

**Files:**
- Modify: `maqar-app/supabase/schema.sql`
- Create: `maqar-app/supabase/migrations/20260918_seed_room_owner.sql`

**Interfaces:**
- Consumes: everything above
- Produces: six rooms with a real `host_id`, and a `schema.sql` that reproduces the current database from scratch

- [ ] **Step 1: Create a host account**

Sign up on the deployed site (or locally against live mode) choosing **Host**, then note the new profile id:

```sql
select id, name, type from public.profiles where type = 'host';
```

- [ ] **Step 2: Write the ownership migration**

Create `maqar-app/supabase/migrations/20260918_seed_room_owner.sql`:

```sql
-- The six seed rooms shipped with host_id null, which made every host-side
-- RLS policy compare against null and fail. Assign them to a real host.
update public.rooms
   set host_id = (select id from public.profiles where type = 'host' order by created_at limit 1)
 where host_id is null;
```

- [ ] **Step 3: Apply and verify**

```sql
select count(*) filter (where host_id is null) as orphaned, count(*) as total from public.rooms;
```

Expected: `orphaned = 0`.

- [ ] **Step 4: Update `schema.sql` to match**

Fold every migration from Tasks 3, 4 and 5 into `maqar-app/supabase/schema.sql` so a fresh project can be created from that one file, and change the seed room `insert` so `host_id` is not hardcoded `null` — add a comment directing the operator to run the ownership migration after creating a host.

- [ ] **Step 5: Run the full suite one last time**

```bash
cd maqar-app && npm test && npm run build && npm run lint
```

Expected: tests pass, build clean, exactly the 11 known pre-existing lint errors.

- [ ] **Step 6: Commit**

```bash
git add maqar-app/supabase/schema.sql maqar-app/supabase/migrations/20260918_seed_room_owner.sql
git commit -m "Give the seed rooms an owner and fold migrations into schema.sql"
```

---

### Task 15: Lazy sweeps and the review gate

**Files:**
- Modify: `maqar-app/src/services/db.js`
- Modify: `maqar-app/src/screens/Detail.jsx`
- Modify: `maqar-app/src/i18n/index.jsx`

**Interfaces:**
- Consumes: `expire_stale_approvals()` / `mark_no_shows()` from Task 4, `bookings` from Task 9
- Produces: `fetchBookings()` runs both sweeps first; the review form appears only to a guest with a `Completed` booking for that room

This closes two spec requirements the earlier tasks left open: the spec says the system
transitions run "lazily on read" so a stalled cron cannot hold a slot forever, and it gates
reviews on a completed booking — which the RLS policy from Task 5 enforces, but the UI would
still offer a form that always fails.

- [ ] **Step 1: Sweep before reading bookings**

In `maqar-app/src/services/db.js`, change `fetchBookings` to run the sweeps first:

```js
export async function fetchBookings() {
  // Run the clock-driven transitions before reading, so a stalled scheduled
  // job cannot leave a slot held by an unpaid booking forever. Both are
  // idempotent and cheap.
  await Promise.all([
    supabase.rpc("expire_stale_approvals"),
    supabase.rpc("mark_no_shows"),
  ]);
  const { data } = await supabase
    .from("bookings")
    .select("*, rooms(*)")
    .order("starts_at", { ascending: true });
  return (data || []).map(mapBookingRow);
}
```

- [ ] **Step 2: Add the i18n keys**

Add to **both** `EN` and `AR` in `maqar-app/src/i18n/index.jsx`:

```js
// EN
"rev.needStay": "You can review this room after a completed booking.",
```

```js
// AR
"rev.needStay": "يمكنك تقييم هذه الغرفة بعد إتمام حجز فيها.",
```

- [ ] **Step 3: Gate the review form on a completed stay**

In `maqar-app/src/screens/Detail.jsx`, add to the `useApp()` destructure: `bookings`. Then replace the `canPost={loggedIn}` prop on `<Reviews>` with:

```jsx
canPost={loggedIn && accountType === "user" && bookings.some(
  (b) => String(b.roomId) === String(room.id) && b.status === "Completed"
)}
```

- [ ] **Step 4: Show why, rather than nothing**

In the `Reviews` component, replace the `onSignIn` fallback branch so a signed-in guest without a
completed stay sees the reason instead of a sign-in button:

```jsx
      ) : loggedIn ? (
        <p className="text-[14px] mb-4" style={{ color: "var(--muted)" }}>{t("rev.needStay")}</p>
      ) : (
        <button onClick={onSignIn} className="btn-soft px-[18px] py-[10px] rounded-xl text-[14px] mb-4">{t("rev.leave")}</button>
      )}
```

Pass `loggedIn` into `Reviews` as a prop alongside `canPost`.

- [ ] **Step 5: Verify**

Run: `cd maqar-app && npm run build && npm test` — both clean.
In demo mode, confirm the review form is hidden on a room you have not completed a booking for,
and appears after a booking reaches `Completed` via the host check-in.

- [ ] **Step 6: Commit**

```bash
git add maqar-app/src/services/db.js maqar-app/src/screens/Detail.jsx maqar-app/src/i18n/index.jsx
git commit -m "Run lifecycle sweeps on read and gate reviews on a completed stay"
```

---

## Notes for the executor

**Before Task 3 touches the database**, confirm the staging split is done, or accept that these migrations run against production. Every Vercel environment currently points at the one Supabase project, so there is no safe target otherwise. This is a decision for Saif, not for the executor to make silently.

**When a task changes `bookingMachine.js`, it must change the matching SQL function**, and vice versa. The two are written from the same transition table in the spec. That duplication is deliberate — demo mode needs the rules in JS, and the server must not trust the client — but it is the one place in this design where drift is possible.

**Out of scope, do not build:** date/time/price filters, host opening hours, listing edit or soft delete, the commission ledger and payouts, the admin UI, notifications, and removing the remaining staged panels outside the two dashboards.
