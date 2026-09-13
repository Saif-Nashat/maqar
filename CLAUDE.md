# Maqar — repo guide

Room-booking platform for Jordan (Amman). Guests browse verified meeting / private / event rooms on
a map, book with a 50% CliQ deposit, and get a 4-digit arrival code. Two account types: **guest**
(`type: 'user'`) and **host**. Coffee-shop visual identity, bilingual EN/AR with full RTL, light and
dark themes, installable as a PWA.

## Repo layout

```
maqar-app/            ← the real app. Almost all work happens here.
maqar-prototype.html  ← standalone single-file vanilla HTML/CSS/JS design reference (see below)
Maqar Uni Files/      ← coursework deliverables (report, pitch deck, logo). Not code; leave alone.
SupaBase Password.txt ← gitignored secret. Never read, print, or commit it.
```

`maqar-app/` is a Vite project, so **all npm commands run from `maqar-app/`, not the repo root.**

## Stack

| Concern | Choice |
|---|---|
| Framework | React 19 + Vite 8 (`type: "module"`, plain JS + JSX — no TypeScript) |
| Styling | Tailwind CSS v3 (`darkMode: "class"`) + a CSS custom-property token system |
| Routing | react-router-dom v7 |
| Icons | lucide-react |
| Maps | Leaflet + react-leaflet v5, CARTO tiles (no API key) |
| State | React Context + `localStorage` |
| Backend | Supabase — Postgres, Auth, Storage, Realtime |
| i18n | hand-rolled (`src/i18n/index.jsx`), EN + AR |

## Commands

```bash
cd maqar-app
npm run dev      # http://localhost:5173
npm run build    # must stay clean
npm run lint
```

## Source layout

```
maqar-app/src/
  screens/     route-level pages: Home, Detail, Booking, Login, UserDash, HostDash,
               HostListRoom, Messages
  components/  reusable UI: Nav, RoomCard, ListingCard, MapView, Filters, HeroSearch, Modal, Toast
  store/       AppContext.jsx (all data + actions), SettingsContext.jsx (theme/lang), persist.js
  services/    db.js — every Supabase read/write; only called in live mode
  lib/         supabase.js, guards.jsx, geo.js, ratings.js, icons.jsx, usePwa.js
  data/        rooms.js (seed rooms, RID, mapRoomRow), seed.js (demo fixtures)
  i18n/        index.jsx — EN + AR dictionaries and useT()
maqar-app/supabase/schema.sql   tables, RLS policies, signup trigger, seed rooms
maqar-app/public/               PWA manifest, service worker, icons
```

Routes are declared in `src/App.jsx`. `Nav`, `Toast`, and `Modal` render once outside `<Routes>` —
`Toast` and `Modal` are global singletons driven by `AppContext`, never instantiated per screen.

## The one rule that explains most of the code: demo vs live

The app runs with or without a backend and picks automatically:

- **Demo mode** — no Supabase env vars. All data is `localStorage` + seed fixtures.
- **Live mode** — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` present. Real auth and Postgres.

`isSupabaseConfigured` in `src/lib/supabase.js` is the single switch, and `supabase` is `null` in
demo mode. **Every live data path must check it and fall back to the local store.** Demo mode is
not a degraded fallback — it's how the app is pitched and demoed, so never let a change break it.

Other invariants worth knowing before editing:

- **Room ids are stable UUIDs** (`RID` in `src/data/rooms.js`), identical in the seed and in the
  `rooms` table, so a room id means the same thing in both modes. Don't renumber them.
- **`mapRoomRow` is the DB↔UI boundary.** Postgres columns are `snake_case` (and the description
  column is `descr`); UI objects are `camelCase` with `desc`. Convert there, not ad hoc.
- **Account model** is `{ id, type: 'user' | 'host', name }`. `authReady` gates guard redirects so
  they don't fire while a live session is still resolving — keep honouring it.
- **Route/action guards** live in `src/lib/guards.jsx` (`useRequireAccount('user' | 'host')`).
  It returns `true` when the screen should render nothing.
- **Persisted slices** use `usePersistedState(key, initial)` from `src/store/persist.js`, with
  `maqar-`-prefixed keys (`maqar-favorites`, `maqar-theme`, …).

## Conventions

**Imports** — relative, with the file extension written out: `import RoomCard from
"../components/RoomCard.jsx"`. Match this; it's consistent across the codebase.

**Components** — one per file, `export default function Name()`. Screens and components are both
PascalCase `.jsx`. Helper modules are lowercase `.js` (or `.jsx` when they contain JSX).

**Strings** — every user-facing string goes through `useT()`. Keys are flat and dot-namespaced
(`"booking.payNow"`, `"host.step1Title"`), added to **both** `EN` and `AR` in
`src/i18n/index.jsx`. Interpolation is `{name}` placeholders passed as `t("key", { n: 5 })`.
Missing AR keys fall back to EN, but don't rely on that — add both.

**RTL** — `SettingsContext` sets `dir`/`lang` on `<html>` and swaps to the Tajawal font. When you
add layout, check it in Arabic; several rules in `index.css` are `[dir="rtl"]`-specific.

**Motion** — animations are defined as Tailwind keyframes in `tailwind.config.js` and as
`@keyframes` in `index.css`, and they animate `transform`/`opacity` only. Scroll reveals
(`.reveal` / `.reveal.in`) are wrapped in `@media (prefers-reduced-motion: no-preference)` — keep
new scroll-triggered motion inside that guard.

**Styling — read this before writing UI.** The current code mixes Tailwind utilities with heavy
inline `style={{ background: "var(--surface)" }}`. That mix is **legacy, not the target**. The
reason it exists: the colors in `tailwind.config.js` are hard-coded light-theme hex values, so
utilities like `text-ink` don't follow the `.dark` swap, while tokens such as `--surface`, `--bg`,
`--fill-dark`, `--fill-mid`, `--surface-border`, and `--nav-bg` exist only as CSS variables and
have no utility at all.

The preferred direction is to point the Tailwind theme at the CSS custom properties (e.g.
`surface: "var(--surface)"`) so components can write `bg-surface` and stay theme-aware, and to
reserve inline `style` for genuinely dynamic values (a computed transform, a conditional color
driven by state). Migrate opportunistically when you're already touching a file — **no big-bang
refactor.** Where an `@layer components` class already exists in `index.css` (`.surface`,
`.btn-primary`, `.btn-soft`, `.chip`, `.field-input`, `.verify-badge`, `.status`, `.title-rule`,
`.wrap`), use it instead of rebuilding the same styling inline.

## Lint

`npm run build` is clean and must stay clean. `npm run lint` currently reports **12 pre-existing
errors** — `react-hooks/immutability` (4), `react-hooks/purity` (3), `react-hooks/set-state-in-effect`
(3), `react-refresh/only-export-components` (2) — concentrated in `src/store/AppContext.jsx` and
`src/store/SettingsContext.jsx`. They come from the newer react-hooks v7 rules.

Don't add new lint errors. Don't silently "fix" the existing 12 as a side effect of unrelated work —
cleaning them up is a deliberate task to raise separately.

## maqar-prototype.html

A standalone single-file vanilla HTML/CSS/JS design reference, still hand-edited directly. It
shares no code with `maqar-app/` and that is intentional.

- Never refactor it to share code with the app.
- Never sync changes between the two automatically, in either direction.
- If an idea from the prototype should land in the app, it will be asked for explicitly.

## Secrets

`.env.local`, `SupaBase Password.txt`, and `.claude/settings.local.json` are gitignored — keep it
that way. The Supabase **publishable/anon** key is safe in a frontend build (RLS is the real
protection); a **service_role** key must never appear in this repo. `dist/` and `node_modules/` are
ignored too, so don't commit build output.

When changing data access, remember RLS is enforced server-side in `supabase/schema.sql`: guests
read their own bookings, hosts read bookings for rooms they own, rooms and reviews are publicly
readable. A client-side change alone won't grant access — the policy has to allow it.

## Further reading

- `maqar-app/SETUP.md` — creating the Supabase project, schema, storage bucket, Vercel deploy.
- `maqar-app/SESSION_LOG.md` — build history, verified-vs-pending status, and the roadmap.
