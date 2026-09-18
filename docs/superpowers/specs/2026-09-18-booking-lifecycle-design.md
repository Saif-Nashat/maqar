# Booking lifecycle — design

**Date:** 2026-09-18
**Status:** approved for planning
**Scope:** the booking state machine, the guest and host journeys built on it, the payment
step, and the permission model that enforces all three.

---

## 1. Why

Three defects found in the 18 September product audit are symptoms of one missing thing: Maqar
has no booking lifecycle. `status` is a string the browser writes, payment state is a label with
nothing behind it, and the arrival code is a random number with no meaning attached.

| Defect | Today |
|---|---|
| Fake payment proof | "Attach proof" sets a boolean. No file input. A `payments` row is then written with `status: 'Paid'` for half the booking value. A guest reaches a confirmed code having transferred nothing |
| Arrival code validates nothing | `verify()` checks `length === 4` and fires a toast. Never compares to the booking, never completes it. Any four digits pass |
| Slot-span double booking | A 4-hour booking at 09:00 marks only `"09:00"` taken. 09:30 stays bookable. The unique index is on `(room_id, date, slot)`, so Postgres does not catch it either |

Fixing these individually would leave the cause in place. This design defines the lifecycle, and
each defect stops being reachable.

## 2. Decisions taken

| Decision | Choice | Rationale |
|---|---|---|
| Payment order | Request → host approves → guest pays | No money moves for a booking that never happens, so denials need no refund path |
| Payment method | Card only. No cash, no CliQ, no split | Confirmation is automatic from the rail. Matches the report's own model: guest pays the listed price, commission comes off the host side after completion |
| Commission rate | 20%, platform-wide | Top of the report's stated 10–20% range. Break-even falls from 731 to 549 bookings a month. The deck's "15% average" line needs correcting |
| Guest cancellation | Tiered by notice period | >24h full refund, ≤24h 50%, after start nothing |
| Admin role | Add now, build the UI later | Changing a CHECK constraint and every dependent RLS policy on live data is the expensive version |
| Card rail | Stubbed behind an interface | No PSP exists yet. The state machine is real; the charge is simulated and a provider drops into one function later |

**Non-decision, recorded:** card payments plus remittance to hosts is exactly the "holding
third-party funds" activity that W1 (payments licensing) was raised to answer. Building is not
blocked. Operating with real guest money is.

## 3. The state machine

Production has 0 bookings, so the status enum can be redesigned without migrating data.

States: `Requested`, `Approved`, `Denied`, `Expired`, `Confirmed`, `Completed`, `NoShow`,
`CancelledByGuest`, `CancelledByHost`.

| From | To | Actor | Trigger |
|---|---|---|---|
| — | `Requested` | guest | Requests a free slot. No money. Slot is held |
| `Requested` | `Approved` | host | Accepts. Payment window opens |
| `Requested` | `Denied` | host | Declines. Reason is required and stored |
| `Requested` | `CancelledByGuest` | guest | Withdraws. No money involved |
| `Approved` | `Confirmed` | system | Card charge succeeds. Code issued |
| `Approved` | `Expired` | system | Payment window elapses. Slot released |
| `Approved` | `CancelledByGuest` | guest | Withdraws before paying. No money involved |
| `Approved` | `CancelledByHost` | host | Withdraws before payment. No money involved |
| `Confirmed` | `Completed` | host | Arrival code validated. Settlement trigger |
| `Confirmed` | `NoShow` | system | `ends_at` passes with no validation |
| `Confirmed` | `CancelledByGuest` | guest | Refund per the snapshotted tier |
| `Confirmed` | `CancelledByHost` | host | Full refund, always |

Terminal: `Denied`, `Expired`, `Completed`, `NoShow`, `CancelledByGuest`, `CancelledByHost`.

**Payment window.** `payment_deadline = least(approved_at + 2 hours, starts_at - 30 minutes)`.
A slot starting less than 1 hour from now cannot be requested, so the window is never empty.
Expiry is applied by `expire_stale_approvals()` (section 5), which runs both on a schedule and
lazily on read — so a stalled cron job cannot leave a slot held forever.

**Slot holding.** `Requested`, `Approved` and `Confirmed` all hold the slot. `Denied`, `Expired`
and any cancellation release it.

## 4. Data model

### 4.1 `bookings` — changed

```
starts_at          timestamptz not null   -- replaces date + slot
ends_at            timestamptz not null
status             text not null          -- new CHECK, states above
total               numeric(10,3) not null -- JOD, 3 dp (1000 fils)
commission_rate     numeric(5,4) not null default 0.20
commission_amount   numeric(10,3)          -- set at Confirmed
host_payout_amount  numeric(10,3)          -- set at Confirmed
refund_policy       jsonb not null         -- snapshot, so policy changes cannot rewrite history
approved_at         timestamptz
payment_deadline    timestamptz
confirmed_at        timestamptz
completed_at        timestamptz
cancelled_at        timestamptz
denial_reason       text                   -- required when Denied, shown to the guest
```

`code` is **removed from this table** — see 4.2.

Commission fields are stored even though payouts are out of scope. They cost nothing now and
avoid a migration over live money later. The rate is a **single platform-wide default of 0.20**,
read from one place at `Confirmed` and snapshotted onto the booking. Per-room or per-host rates
(the report's 10–20% range) are a later change that this shape already accommodates.

20% is the top of the range the capstone report states and within what the deck claims, but the
deck's "15% average commission" line is now wrong and needs updating. At 20% an average 14 JOD
booking yields 2.80 JOD, which moves operational break-even from 731 bookings a month to 549.

Overlap is enforced by the database, not the client:

```sql
create extension if not exists btree_gist;

alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('Requested','Approved','Confirmed'));
```

This is the whole fix for defect 3. Two concurrent overlapping inserts cannot both succeed
regardless of any client bug.

### 4.2 `booking_codes` — new

```
booking_id  uuid primary key references bookings(id) on delete cascade
code        text not null            -- 4 digits, generated server-side
created_at  timestamptz not null default now()
```

A separate table because **the host must not be able to read the code.** If the host can see it,
validating it proves nothing — they could complete a booking with no guest present. Today
`HostDash` displays it to them. RLS here grants select to the guest and to admin only; the host
never reads it, and validation happens inside a `security definer` function that can.

### 4.3 `payments` — replaced

The current table cannot serve: it references `room_id` not a booking, has no direction, no
provider reference, and cascades away with the profile.

```
id             uuid primary key
booking_id     uuid not null references bookings(id) on delete restrict
kind           text not null check (kind in ('charge','refund'))
status         text not null check (status in ('pending','succeeded','failed'))
amount         numeric(10,3) not null
currency       text not null default 'JOD'
provider       text not null            -- 'stub' until a PSP exists
provider_ref   text                     -- the rail's transaction id
created_at     timestamptz not null default now()
```

`on delete restrict` is deliberate: financial history must not be destroyed by deleting a user.

### 4.4 `profiles`

`type` CHECK extended to `('user','host','admin')`.

## 5. Permissions

The principle: **the browser has no write access to anything that carries meaning.** It reads,
and it calls functions that check the rules.

| Table | Client write access |
|---|---|
| `bookings` | None. `INSERT` and `UPDATE` both revoked — creation goes through `request_booking()` |
| `booking_codes` | None |
| `payments` | None |
| `reviews` | `INSERT` only, gated on a `Completed` booking |

Every transition, including creation, is a `security definer` function that verifies the caller's
role, the current state, and that the transition is legal:

```
request_booking(room_id, starts_at, ends_at)   -- creates Requested
approve_booking(booking_id)
deny_booking(booking_id, reason)
cancel_booking(booking_id)                     -- resolves actor, applies refund tier
confirm_booking_payment(booking_id, provider_ref)
validate_arrival_code(booking_id, code)        -- compares, then completes
expire_stale_approvals()                       -- Approved → Expired past the deadline
mark_no_shows()                                -- Confirmed → NoShow past ends_at
```

The last two are the system transitions. Both are idempotent and safe to re-run. They are called
two ways: by a scheduled sweep, and lazily whenever a booking is read, so a stalled cron job
cannot leave a slot held forever.

RLS read policies:

| Table | Who reads |
|---|---|
| `bookings` | Guest (own), host (for their rooms), admin |
| `booking_codes` | Guest (own), admin. **Never the host** |
| `payments` | Guest (own bookings), admin. Host sees payout amounts via the booking |
| `profiles` | Yourself, a counterparty in a shared booking or message thread, admin |
| `reviews` | Public read, unchanged |

`profiles_read using (true)` is replaced. Today any signed-in visitor can enumerate every user's
name and account type.

**What the host sees about a guest:** display name at `Requested` — enough to decide. Name plus
completed-booking count from `Approved` onward. Never email or phone; `profiles` carries neither,
and the arrival code is the identity check.

## 6. The shared rules module

`maqar-app/src/lib/bookingMachine.js` — plain JS, no React, no Supabase.

Owns: the transition table, `canTransition(from, to, actor)`, refund tier calculation,
payment-deadline calculation, and slot/overlap maths.

Two executors use it:

- **Demo mode** runs it against `localStorage`. This is the whole reason the rules are not
  only in Postgres — `CLAUDE.md` requires demo mode to keep working, and rules living solely in
  the database would give it none.
- **Live mode** runs it client-side for UI only (which buttons are enabled, what state to show),
  while the Postgres functions enforce the same rules server-side.

The client copy is for responsiveness. The server copy is the authority. Both are written from
section 3's table, and the test suite asserts the same cases against both.

## 7. Payment rail

```js
// src/services/paymentRail.js
export async function charge({ bookingId, amount, currency }) // → { ok, providerRef, error }
export async function refund({ paymentId, amount })           // → { ok, providerRef, error }
```

The stub simulates success, decline and network failure so error paths are built and tested from
the start rather than discovered at integration. A real PSP replaces this one module; nothing
above it changes.

The card form collects details but **never sends them to Maqar's database or logs** — with a real
provider these fields become the provider's hosted iframe or tokenizer. The stub keeps the same
shape so that substitution is a swap, not a rewrite.

## 8. Journeys

**Guest.** Browse → room detail → pick a slot → `Requested` (free, slot held) → notified on the
host's decision → on approval, pay within the window, with the deadline and refund policy shown
→ `Confirmed`, code issued → arrive and present the code → `Completed` → prompted to review.

**Host.** Request lands showing guest display name, time, duration and their payout →
approve, or deny with a reason the guest actually receives → awaiting-payment state is visible →
on payment it enters the real agenda → guest arrives, host types the code the guest shows →
`Completed`.

Every state one party is in is visible to the other. Today both sides guess.

## 9. Testing

The repo has no tests. This adds the first ones, targeted at the logic most likely to be wrong.

- **Vitest** on `bookingMachine.js`: every legal transition, every illegal transition rejected,
  refund tiers at the 24h boundary from both sides, payment-deadline clamping, overlap maths.
  Pure functions — no mocking, no DOM.
- **SQL tests** on the transition functions and constraints: each function rejects a caller with
  the wrong role, rejects an illegal source state, and the exclusion constraint rejects the
  second of two overlapping bookings.
- **One concurrency test**, because it is the case the old design got wrong: two overlapping
  inserts issued together, exactly one must succeed.

## 10. Rollout

1. Split staging from production first (W2 in the brief — roughly an hour of Vercel config, no
   application code). Every preview deploy currently reads and writes production Postgres, so
   there is nowhere safe to test this otherwise.
2. Migration: new columns, new tables, new CHECK, exclusion constraint, functions, policies.
3. Assign the six orphaned seed rooms a real `host_id`, or replace them with rooms created
   through the wizard while signed in as a host. Until then no host-side path can be tested at
   all — every host policy compares against `null`.
4. Ship behind the existing demo/live gate, verifying demo mode at each step.

## 11. Out of scope

Deliberately excluded so this stays one coherent change. Each builds on it:

- Date, time and price filters in discovery
- Host-defined opening hours (the fixed 09:00–15:30 grid stays for now)
- Listing edit and soft delete
- The commission ledger, payouts and settlement execution
- Admin UI (the role and its policies exist; the queue does not)
- Notifications, email confirmation, phone OTP
- Removing the staged dashboard panels (tracked separately as Tier 0)
