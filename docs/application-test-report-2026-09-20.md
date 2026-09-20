# Application test report — 20 September 2026

Tested the current working tree, including pre-existing uncommitted changes. Application source was not changed. No production requests, database migrations, real payments, or messages were sent.

## Executed checks

| Check | Result |
| --- | --- |
| `npm test` | PASS: 31 tests across two files |
| `npm run lint` | PASS: no reported errors or warnings |
| `npm run build` | PASS: 2,006 modules transformed |
| Build size | Warning: main JavaScript bundle 602.90 kB, 181.29 kB gzip |
| Browser end-to-end testing | BLOCKED: browser inventory was empty; both IAB and Chrome creation returned “Browser is not available” |
| SQL lifecycle/concurrency checks | NOT RUN: no disposable database selected |

Tests and build initially encountered sandbox `spawn EPERM`; both passed when rerun with approved process permissions. This was an execution restriction, not an application failure.

The 31 tests cover booking state transitions, terminal states, slot holds, refund timing, payment deadlines, request lead time, overlapping and adjacent reservations, pricing, commission, and simulated payment outcomes. They do not exercise rendered screens, React context integration, Supabase authorization, or browser behavior.

## Findings from source inspection

These findings are based on current code paths, not browser reproductions. They were present before this testing task; their introduction relative to committed HEAD was not assessed.

| Priority | Flow | Finding and evidence |
| --- | --- | --- |
| High | Host listing submission | `src/screens/HostListRoom.jsx:60`: `publish()` ignores the `{ ok, error }` returned by `createRoom()` and always shows the published screen. A rejected database insert appears successful. There is also no submission-in-progress guard. |
| High | Host messaging | `src/services/db.js:159` groups messages by room alone. `src/store/AppContext.jsx` chooses the first guest ID in that room thread for host replies. Two guests enquiring about the same room share a host-side thread, and replies can target the wrong guest. |
| Medium | Host cancellation | `src/screens/HostDash.jsx` exposes approval, denial, and arrival verification, but does not consume or render `cancelBooking`. Hosts cannot reach the implemented cancellation/refund operation through their dashboard. |
| Medium | Demo listing-to-booking journey | `src/store/AppContext.jsx` adds demo listings only to `myListings`; browsing and `getRoom()` use `rooms`. A newly listed demo room appears in the host dashboard but cannot enter the guest discovery/booking flow. |
| Medium | Returning demo host | `src/screens/Login.jsx:45` defaults account type to `user`; remembered email records contain no role. Demo `signIn` uses that supplied type. Signing a host back in through the remembered-email path changes it into a guest. |
| Medium | Review submission failures | `src/store/AppContext.jsx` ignores the error from `addReviewDb` and inserts a local fallback review when the database returned no row. Failed reviews appear successful until data is reloaded. |
| Medium | Demo expiration and no-show | Demo bookings have no clock-driven expiration/no-show sweep. An expired approved booking remains Approved and continues holding its time range, although payment is rejected after the deadline. Live fetching calls the corresponding sweep RPCs. |
| Medium | Demo arrival-code parity | Demo arrival validation checks the code but has no attempt counter or lockout. This does not test or establish the live database lockout behavior. |
| Medium | Payment error display | `src/screens/Pay.jsx` translates every error as `pay.err.${res.error}`. Raw database error messages have no corresponding dictionary entry and can display as raw translation keys. |
| Low | Missing payment record | `src/screens/Pay.jsx` returns null when a booking is missing, with no not-found/error state. A stale or invalid payment link renders no page content beneath navigation. |

## Remaining flow verification

The following must be exercised in an available browser before calling the entire application tested:

1. Guest and host registration, sign-in/out, reload persistence, guarded routes, and resuming a booking after login.
2. Browse, area/type/amenity/capacity filtering, sorting, map selection, geolocation denial, favorites, and room details.
3. Listing creation with photo upload success/failure, validation, duplicate submission, and guest visibility.
4. Request → host approval → simulated payment → guest arrival code → host check-in → completed stay → review.
5. Denial with/without a reason; cancellation before and after payment; all refund boundaries; expiry and no-show.
6. Concurrent overlapping requests from different guests, adjacent bookings, and stale availability.
7. Payment decline/network failure, deadline expiration, repeated payment, and host cancellation while checkout is open. Use only the stub's test data.
8. Two guests messaging the same host/room, realtime replies, and write failures.
9. English/Arabic, LTR/RTL, light/dark, mobile widths, keyboard navigation, visible focus, reduced motion, and loading/empty/error states.
10. Against an explicitly selected disposable Supabase database: SQL lifecycle/concurrency scripts, RLS isolation, room ownership, arrival-code privacy and five-attempt lockout, payment kill switch, and refresh of both users' dashboards.

No claims about current production room ownership, auth configuration, deployed migrations, or live payment readiness were verified. Passing the simulated payment tests is not evidence of a real payment integration.
