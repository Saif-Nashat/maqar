# Maqar — session handover

**Written 20 September 2026.** Paste this whole file into a new chat to pick the work up.
Everything below was verified, not remembered: commit SHAs are real, database facts came from
querying production, and the flows described were walked by hand in a browser.

---

## 1. What Maqar is

A room-booking platform for Amman, Jordan. Guests browse verified meeting / private / event
rooms on a map and book them; hosts list rooms and manage bookings. Two account types, `user`
(guest) and `host`. Bilingual EN/AR with full RTL, light and dark themes, installable as a PWA.

It began as an HTU capstone project. **It is no longer a prototype** — as of 20 September 2026
the goal is a real public product that strangers use unsupervised. That reframing matters: demo
mode, offline fallbacks and "good enough for the pitch" no longer count as done.

- **Live:** https://maqar-one.vercel.app/ (Vercel, auto-deploys from `main`)
- **Repo:** https://github.com/Saif-Nashat/maqar — local at `C:\dev\maqar`
- **Supabase:** project `fdsbwmpyzuyclrnsitux`, `ACTIVE_HEALTHY`
- **Owner:** Saif Ibrahim — CTO and product owner. Three cofounders: Yousef Byouk, Tamer Ali,
  Khaled Al-Madhoun.

---

## 2. Where everything lives

| Document | Where | What it is |
|---|---|---|
| **Maqar Redesign Brief** | https://claude.ai/code/artifact/4d629223-874c-43d0-bebc-2db535b9e8bb | **The decision log.** Cofounder-facing. Every decision, finding and status lives here, not in the repo |
| Booking lifecycle **spec** | `docs/superpowers/specs/2026-09-18-booking-lifecycle-design.md` | The design: state machine, permissions, payment rail, journeys |
| Booking lifecycle **plan** | `docs/superpowers/plans/2026-09-18-booking-lifecycle.md` | 15 tasks, TDD, the implementation argument |
| Execution ledger | `.superpowers/sdd/2026-09-18-booking-lifecycle/progress.md` | ~600 lines. Every ruling, every deferred finding, every fix round. **Read this for the "why" behind anything odd** |
| Repo guide | `CLAUDE.md` | Conventions. Note: its "12 lint errors" is stale — see §7 |
| Build history | `maqar-app/SESSION_LOG.md` | Pre-18-September history. **Superseded** as the live log by the brief doc |
| Capstone report | `Maqar Uni Files/Maqar, final report.docx` | 24 sections: survey (132 responses), TAM/SAM/SOM, competitors, budget, financials, BMC |
| Pitch deck | `Maqar Uni Files/Maqar_Startup_Pitch_Deck.pptx` | 17 slides. Numbers live in chart images, not text |

**Logging convention:** all decisions and changes go in the **brief doc**, not `SESSION_LOG.md`.
Saif shares the link with cofounders who do not read the repo.

---

## 3. Where the project stood before this session

The app was deployed and working, backed by live Supabase, with a polished bilingual UI. But a
product audit on 18 September found the business model and the product contradicted each other:

- The capstone deck sells a **15% commission**, and **nothing in the product ever took it**.
  There was no commission calculation, no payout record and no ledger anywhere in the codebase.
- Checkout asked the guest to CliQ 50% to a **hardcoded platform alias** and pay 50% cash in
  person. The cash half was invisible to the platform and could never be reconciled.
- **All six rooms on production had `host_id = null`**, so every host-side permission compared
  against null and the entire host side was non-functional.
- Eleven panels across the two dashboards rendered **hardcoded fabricated data** — a host with
  zero bookings saw 128 JOD revenue and 68% occupancy.

Three defects were picked out as the starting point:

1. A guest could reach a confirmed arrival code and a "Paid" payment record **without paying**.
   "Attach proof of payment" set a boolean; there was no file input.
2. The arrival code **validated nothing** — the check tested only that four digits were typed.
3. A 4-hour booking at 09:00 **did not block a 09:30 start**. The unique index covered only the
   start slot, so Postgres did not catch it either.

---

## 4. Decisions made (these are settled — do not relitigate without Saif)

| Decision | Choice |
|---|---|
| Payment model | **Full escrow.** Guest pays the whole booking value online by card, before the session |
| Payment order | Guest requests free → **host approves** → guest pays. No money moves for a booking that never happens, so a denial needs no refund |
| Cash | **Removed entirely.** No CliQ, no cash on arrival, no 50/50 split |
| Commission | **20%**, platform-wide, snapshotted per booking. (Top of the report's stated 10–20% range; the deck's "15% average" line is now wrong and needs updating) |
| Guest cancellation | Tiered: **>24h = 100% refund, ≤24h = 50%, after start = 0%**. Policy snapshotted onto each booking |
| Host cancellation | Always a full refund |
| Admin role | Added to the data model now (`profiles.type` accepts `admin`), UI deferred |
| Payment rail | **Stubbed** behind `src/services/paymentRail.js`. Real PSP replaces that one file |
| Database work | Runs against **production**; staging split deferred by Saif |
| Branching | Commit directly to `main`. Solo repo, branches are ceremony |

**Commercial consequence worth knowing:** at 20% an average 14 JOD booking yields 2.80 JOD, which
moves operational break-even from 731 bookings/month to **549**. The capstone's monthly cost of
1,535 JOD includes 1,160 JOD of founder salaries (290 each); non-salary opex is only 375 JOD,
i.e. 179 bookings.

---

## 5. What was built this session

**26 commits**, `6a97ef6..d4c3d28`. A 15-task plan executed with a fresh subagent per task, an
independent review after each, and a final whole-branch review. Seven tasks passed first time;
seven needed a fix round.

### The core change

**The browser lost the ability to write anything that matters.** It can no longer create a
booking, change a booking's status, record a payment, or issue an arrival code. Every transition
goes through a `security definer` Postgres function that checks who is asking and whether the
transition is legal. Table privileges are revoked, so no future policy mistake can re-open writes.

### The booking state machine

`Requested → Approved → Confirmed → Completed`, plus `Denied`, `Expired`, `NoShow`,
`CancelledByGuest`, `CancelledByHost`. Rules live in **one JS module**
(`src/lib/bookingMachine.js`) mirrored by the Postgres functions.

### Database (all applied to production)

| Migration | What it did |
|---|---|
| `20260918_booking_lifecycle.sql` | `starts_at`/`ends_at` timestamps replacing date+slot; commission/refund/timestamp columns; `booking_codes` table; `payments` rebuilt around `booking_id`; **gist exclusion constraint** making overlap impossible |
| `20260918_booking_functions.sql` | 10 security-definer functions |
| `20260918_booking_policies.sql` | Revokes client writes; restricts profile reads; gates reviews on a completed stay |
| `20260919_payment_kill_switch.sql` | `platform_settings.live_payments` flag — see §6 |
| `20260919_arrival_code_lockout.sql` | 5 wrong guesses → 15-minute lockout |

Functions: `request_booking`, `approve_booking`, `deny_booking`, `cancel_booking`,
`confirm_booking_payment`, `validate_arrival_code`, `expire_stale_approvals`, `mark_no_shows`,
`is_admin`, `account_type`.

### The three original defects

1. **Fake payment** — the browser has no INSERT privilege on `payments`. `Confirmed` is reachable
   only via the function that records the charge.
2. **Arrival code** — compared against `booking_codes`, which **hosts cannot read** (that is the
   point: a host who can see it could check in with no guest present). Brute-force locked out.
3. **Double booking** — `EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at, ends_at) WITH &&)`.
   **Proven** by a SQL test that attempts the exact historical bug and confirms rejection.

### Front end

`Booking.jsx` requests a slot instead of faking a payment. New `Pay.jsx` at `/pay/:bookingId`.
`UserDash.jsx` and `HostDash.jsx` rewritten — **eleven fabricated panels deleted**. `Detail.jsx`
gates reviews on a real stay. `db.js` points at RPCs. `AppContext.jsx` serves both run modes.

### Tests

The repo had **no test framework**. Now: Vitest, **31 tests** over `bookingMachine.js` and
`paymentRail.js`, plus two SQL test scripts. `npm run build` clean. `npm run lint` **8 errors**
(down from 11 — deleted helpers carried some).

---

## 6. Two things that are deliberately unsafe, and why

**`confirm_booking_payment` trusts the client.** It is a normal RPC; any signed-in user can call
it directly with any string and reach `Confirmed` having paid nothing. This **cannot** be fixed
without a server-side payment authority (a PSP webhook, or a charge the server initiates), and
neither exists. Rather than fake a fix, there is a kill switch: `platform_settings.live_payments`
is `false`, and the function **refuses to run** if it is ever set true. So the day someone enables
real payments without doing the integration, every payment fails loudly instead of silently
accepting fabricated proof. **Rewriting this function is a hard prerequisite for taking money.**

**Demo mode duplicates every booking rule.** It exists so the capstone demo worked offline. The
rules therefore live in two places, and those two copies **drifted four times during this session**
— producing a permission bypass, a money bug, a guest-only cancel path, and a hardcoded rate.
Each was caught by review, not by tests. Recommendation on the table: **delete demo mode.** For a
public product it is dead weight with its own bugs, and removing it halves the booking engine.

---

## 7. Gotchas that will bite you

- **`t()` returns the key itself when a key is missing** (`dict[key] ?? EN[key] ?? key`), which is
  always truthy. So `t(x) || fallback` is **dead code**, and a missing key renders its own name
  into the UI as a sentence. This caused two shipped bugs. Add every key to **both** EN and AR.
- **PL/pgSQL rolls back on `raise exception`** — including writes made earlier in the same
  function. An attempt counter incremented then raised is silently undone. This made the lockout
  a no-op on the first attempt; the fix returns `NULL` instead.
- **A NULL boolean in PL/pgSQL fails *open*.** `not (NULL or NULL)` is NULL, which `IF` treats as
  false, so a permission check that cannot evaluate lets the caller through. Use
  `coalesce(x, false)` on anything gating access.
- **A composite variable cannot share an `INTO` list with scalars** (ERROR 42601). Permission
  checks that also fetch the row therefore need two statements — and two guards.
- **`new Date().toISOString().slice(0,10)` is the UTC day.** In Amman (UTC+3) that is *yesterday*
  between midnight and 3am. Build dates from local components. Note `new Date("YYYY-MM-DDTHH:mm")`
  *is* local — only date-only strings parse as UTC.
- **Postgres `numeric` arrives as a JS string** through PostgREST. Money must be `Number()`-coerced
  or it will concatenate instead of add.
- **`tstzrange` defaults to `[)`**, which is what allows back-to-back bookings. Do not "tidy" it.
- **Vite inlines `VITE_*` at build time.** Changing a Vercel env var does nothing until a redeploy.
- **`VITE_CARTO_KEY` lives in `.env.local` next to the Supabase vars**, so removing that file to
  enter demo mode also kills the map (CARTO shows an "API KEY REQUIRED" watermark). They should
  be separated — the mode switch and the map key are unrelated concerns.
- **Free-tier Supabase auto-pauses after ~7 days idle.** If the live site cannot reach the
  backend, check project status before debugging the app.
- **CLAUDE.md says 12 lint errors. It is 8.** The doc is stale.
- **Every Vercel preview reads and writes production Postgres.** There is no staging.

---

## 8. Nothing is in progress

No agents running, no uncommitted work, working tree clean, `main` is `d4c3d28`. The booking
lifecycle plan is complete. **One task from it remains and it needs a human:**

> **Assign the six seed rooms an owner.** Production has 2 profiles, both type `user`, **zero
> hosts**. Every host permission compares against `rooms.host_id`, which is `null` for all six.
> Until a host account exists and the rooms are assigned to it, nobody can approve a request,
> take a payment or check a guest in on the live site — regardless of what has been built.
>
> **To unblock:** sign up at https://maqar-one.vercel.app/ choosing **Host**, then run
> `maqar-app/supabase/migrations/20260918_seed_room_owner.sql` (or the equivalent `update
> public.rooms set host_id = <the new host's id> where host_id is null;`).

---

## 9. Blocking a public launch

| # | Blocker | Why it stops launch |
|---|---|---|
| 1 | **No password reset** | "Forgot password" is a Soon badge. A user who forgets is locked out permanently |
| 2 | **Email never verified** | Auto-confirm is on; zero confirmation emails have ever been sent. Anyone can sign up as anyone |
| 3 | **No payment provider** | The card form is a stand-in, and confirmation trusts the browser (§6). No real money can be taken |
| 4 | **No host payouts** | Money would arrive with no way to pay a host their 80%, and nothing records what is owed |
| 5 | **Six rooms have no owner** | Host side non-functional on the live site (§8) |
| 6 | **Host message threads merge guests** | Grouped by room, not room + guest. Two enquiries about one room read as one conversation |
| 7 | **`anon` can execute all 11 RPCs** | Supabase's advisor flags it. They defend themselves internally, but should not be reachable signed-out |
| 8 | **No terms, cancellation policy or host agreement** | Do not take payment without published terms |
| 9 | **Payments licensing unresolved** | Holding a guest's money and paying a host later is the regulated activity. Counsel or JoPACC |

---

## 10. Needed soon, not blocking

- Hosts **cannot edit or delete a listing** — a typo is permanent
- The **Verified badge can never become true** — nothing sets it
- **No notifications of anything.** A host does not learn a request arrived; a guest does not
  learn they were approved; the payment window can expire while both wait
- **Leaked-password protection is off** in Supabase auth (one toggle)
- **Every room claims Wi-Fi and A/C** regardless of its actual amenities
- The photo **drag-and-drop area inserts stock images** instead of the dropped file
- **No date / time / price filters** — only room type and features
- **Hosts cannot set opening hours** — every room offers the same fixed slots
- **No tests over any screen or the store.** 31 tests cover only the pure modules. The host-cancel
  bug lived in exactly that uncovered layer and was caught only because a human read it
- **Demo mode: a returning host signs in as a guest** (`maqar-known-emails` stores addresses but
  not account types). Demo-only, but demo is the pitch surface
- The host **approval toast says a code was sent** — it is not sent until payment
- Booking step 1's button says **"Continue to payment"** but leads to a free review step
- Guest dashboard subtitle still mentions **"student perks"** (EN and AR) after that card was cut
- `btree_gist` is installed in the `public` schema (advisor warning)
- 2px horizontal overflow at 375px from a decorative hero element
- No staging environment (§7)

---

## 11. Suggested order

1. **Assign the rooms an owner** (§8) — five minutes, unblocks all host testing
2. **Password reset + email verification** — the two auth blockers, independent of everything
3. **Decide demo mode's fate** (§6) — it changes how everything after is built
4. **Lock down the RPCs** — `revoke execute ... from anon`, and from `authenticated` for the two
   sweeps and `handle_new_user`. Enable leaked-password protection
5. **Fix host message threading** — key on `(room_id, guest_id)`
6. **Notifications** — the product is unusable without them once two real strangers use it
7. **Host tooling** — edit, soft delete
8. **Tests over the store and screens** — the largest deliberate gap
9. **PSP + payouts + terms + licensing** — the money track, gated on W1

Items 1–8 need nothing from anyone outside the team. Item 9 is the long pole.
