# Maqar — Session Log & Roadmap

_Last updated: 2026-09-17_

This file logs what was built in this session and what's left for the future. Treat it as the
single source of truth for picking the project back up.

---

## 1. What Maqar is

A room-booking platform for Jordan (Amman): people browse verified meeting / private / event
rooms on a map, book them with a 50% CliQ deposit, and get a 4-digit arrival code. There are two
account types — **guests** (book rooms) and **hosts** (list & manage rooms). Coffee-shop visual
identity (espresso/crema/cream palette, Fraunces + Inter type).

Two implementations exist in `C:\Users\VICTUS\OneDrive\Desktop\Bootcamp`:

- **`maqar-prototype.html`** — the original single-file vanilla HTML/CSS/JS prototype (kept for reference).
- **`maqar-app/`** — the real app: **Vite + React + Tailwind v3**, now backed by **Supabase**. ← this is the project.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Framework | React 19 + Vite |
| Styling | Tailwind CSS v3 + a custom token system (`src/index.css`, `tailwind.config.js`) |
| Routing | react-router-dom v7 |
| Icons | lucide-react |
| Maps | Leaflet + react-leaflet v5, CARTO tiles (light/dark, no API key) |
| State | React Context (`src/store/AppContext.jsx`) + `localStorage` (demo) |
| Backend | **Supabase** (Postgres + Auth + Storage + Realtime) |
| i18n | custom (`src/i18n/index.jsx`), English + Arabic with full RTL |
| PWA | manifest + service worker (`public/`) |

---

## 3. What we built this session

Roughly in order:

1. **Rebuilt the prototype as a React app** (`maqar-app/`) preserving every feature — browse, map,
   detail, 3-step booking flow, user & host dashboards.
2. **Design refinements** — room-card rating/trust cue, hero quick-search, CliQ copy button.
3. **Dark mode** — "late-night café" theme via a CSS-variable token system; the light theme is
   byte-identical, a `.dark` class swaps surface/text tokens. Toggle in the nav.
4. **Arabic + full RTL** — complete EN/AR i18n (`useT()` hook), Tajawal font, `dir`/`lang` on `<html>`.
5. **Host "list a new room" wizard** — 5 steps (basics → map pin-drop → photos → amenities → review)
   with a live preview card and a publish celebration.
6. **True account separation** — replaced the old free role toggle with a real account model
   (`account.type`), chosen at login, enforced by route/action guards (`src/lib/guards.jsx`).
7. **Real Amman map** — Leaflet + CARTO tiles, real lat/lng per room, brand price-pin markers,
   theme-aware basemap; the host locator is click-to-place + draggable.
8. **12 features** — persistence, map↔list hover sync + favorites layer + "near me" geolocation,
   availability + conflict detection, reviews & ratings, host agenda, messaging, favorites,
   hero autocomplete search, wallet/payments, PWA + install button, photo lightbox, host revenue chart.
9. **Supabase backend** — schema + RLS + auth, then wired **all** data (rooms, bookings, reviews,
   favorites, payments, messages, photos) to live Postgres, gated so the demo still works offline.

---

## 4. Current status

### Deployed — LIVE and public
- **Production URL: <https://maqar-one.vercel.app/>** (Vercel, auto-deploys from `main`).
- Repo: <https://github.com/Saif-Nashat/maqar>
- Verified 2026-09-17 that the deployed bundle built in **live mode** — `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` are inlined in `/assets/index-*.js`, so `isSupabaseConfigured` is `true`
  in production and the site reads real Postgres (public `rooms` read returns 200 + rows).
- Bundle scanned: **no** `service_role` / `sb_secret` / raw JWT present — only the `sb_publishable_…`
  key, which is safe by design.

> **Gotcha that bit us once already:** Vite inlines `VITE_*` at **build** time, not runtime. Adding
> or changing env vars in the Vercel dashboard does nothing to existing deployments — you must
> **redeploy** for new values to be baked into the bundle. A build that ran without the vars ships a
> permanently demo-mode bundle that looks completely healthy.

### Backend — LIVE and connected
- Project ref: `fdsbwmpyzuyclrnsitux` · URL: `https://fdsbwmpyzuyclrnsitux.supabase.co`
- Keys live in `maqar-app/.env.local` (publishable key — safe for frontend; RLS protects data).
- Schema applied from `supabase/schema.sql` (tables + row-level security + sign-up trigger + 6 seed rooms).
- **Free-tier projects auto-pause after ~7 days idle** (status goes `INACTIVE`). This happened between
  2026-06-14 and 2026-09-13; restored 2026-09-17, now `ACTIVE_HEALTHY`. If the live site suddenly
  can't reach the backend, check the project status before debugging anything in the app.

### Verified live (via API, RLS-enforced) ✅
- Rooms public read · Auth sign-up · **profile trigger** (account type written to DB)
- **Full booking loop**: host creates a room → guest books it → host sees the booking
- Favorites · Reviews (public read) · Payments

### Modes
- **Demo mode** (no env keys): everything runs on `localStorage` + seed data. Nothing breaks.
- **Live mode** (keys present, current state): real auth + real Postgres data.
- The app auto-detects via `isSupabaseConfigured` in `src/lib/supabase.js`.

### Build / run health
- `npm run build` clean (~1862 modules), `npm run dev` serves on :5173, no errors.

---

## 5. How to run

```bash
cd maqar-app
npm install        # first time only
npm run dev        # http://localhost:5173
```

- With `.env.local` present → **live mode** (real Supabase).
- Delete/empty `.env.local` → **demo mode** (offline, localStorage).
- Toggle the moon (theme) and "ع/EN" (language) buttons in the nav.

---

## 6. Architecture cheat-sheet (where to look)

| Area | File(s) |
|---|---|
| Global store + all data actions | `src/store/AppContext.jsx` |
| Supabase client + env gate | `src/lib/supabase.js` |
| Live data functions (CRUD) | `src/services/db.js` |
| Theme + language (persisted) | `src/store/SettingsContext.jsx` |
| Translations (EN/AR) | `src/i18n/index.jsx` |
| Route/action guards | `src/lib/guards.jsx` |
| Design tokens + dark mode | `src/index.css`, `tailwind.config.js` |
| Rooms data + UUID ids + row mapper | `src/data/rooms.js` (`RID`, `mapRoomRow`) |
| Demo seed data | `src/data/seed.js` |
| DB schema + RLS + seed | `supabase/schema.sql` |
| Setup + deploy guide | `SETUP.md` |

Key patterns to know:
- **Env gating**: every live data path checks `isSupabaseConfigured`; otherwise falls back to local store.
- **Room ids are UUIDs** — identical in the seed and the DB, so demo and live behave the same.
- **Account model**: `account = { id, type: 'user'|'host', name }`; `authReady` flag prevents guard
  flicker while a live session resolves.
- **Design system**: brand fills are fixed tokens (`--fill-dark`/`--fill-mid`); surface/text tokens
  swap under `.dark`.

---

## 7. TODO / next steps (future)

### Immediate — finish going fully live
- [x] **Realtime chat** — `messages` added to the `supabase_realtime` publication (2026-09-17),
      confirmed present in `pg_publication_tables`.
- [x] **Photo uploads** — storage bucket `room-photos` exists and is **public**.
- [x] **Cleanup test data** — done 2026-09-18. Removed the "Acceptance Test Room"
      (`52f99b83-…`) and the 4 `maqar.*@gmail.com` verification logins. Verified after:
      **6 rooms · 0 bookings · 1 profile · 1 auth user**, no orphaned rows.
      - The one surviving account, `demo@maqar.app` ("Saif Ibrahim", `31be9b5c-…`), is the
        owner's real account — **not** a verification user, despite an earlier note here
        implying all 5 profiles were test data. Keep it.
      - Worth remembering: the test booking was already gone before the room was deleted.
        Two cascade paths pointed at it (`bookings.room_id → rooms` and
        `bookings.guest_id → profiles`), and deleting the guest's auth user tripped the
        second one first. Check what a cascade has *already* taken before assuming your
        own delete is what removed a row.

### Deploy the public demo — DONE
- [x] Push `maqar-app` to a GitHub repo — <https://github.com/Saif-Nashat/maqar>
- [x] Import on Vercel (Vite preset), add the two `VITE_SUPABASE_*` env vars, deploy.
- [x] In Supabase → Auth → URL Configuration, add the Vercel URL to the allow-list.
      (Note: not yet load-bearing — `mailer_autoconfirm` is still `true`, so no confirmation
      redirect happens. It starts mattering the moment email confirmation is turned back on.)

### Product / hardening roadmap
- [ ] **Phone OTP auth** (better for Jordan than email) — enable Phone provider + an SMS provider (Twilio).
- [ ] Re-enable **email confirmation** before real launch (it's currently OFF for demo convenience).
- [ ] Real **CliQ payment** integration (currently a manual "upload proof" flow — realistic for Jordan,
      but could integrate JoPACC/a PSP later).
- [ ] Host dashboard: edit/delete own listings; richer occupancy from real bookings.
- [ ] Notifications (email/SMS/push) on booking request, approval, messages.
- [ ] Image optimization / resizing on upload; multiple photos UX.
- [ ] Admin/moderation for room verification (the "Verified" badge is currently a static flag).
- [ ] Tests (component + a few e2e happy paths).

### Known gotchas / notes
- **Magic MCP (21st.dev) was disconnected** the whole back half of the session — all UI after the
  first room card was hand-built. If reconnected, can run a refinement pass on any component.
- Email confirmation is **OFF** in Supabase right now (so signup logs you straight in). Turn back
  ON (or use phone OTP) before launch.
- The `.env.local` publishable key is safe to expose; never commit a **service_role** key.
- SPA routing: Vercel handles it; other hosts need a catch-all rewrite to `/index.html`.

---

## 8. One-line status

**Maqar is deployed, public, and clean at <https://maqar-one.vercel.app/> — a polished,
bilingual, dark-mode React app on a live Supabase backend (verified live-mode, RLS-enforced, no
secrets in the bundle, realtime chat enabled, test data purged), with the full host→guest booking
loop working end-to-end. Everything on the "go live" checklist is done; what remains is the
product-hardening roadmap.**
