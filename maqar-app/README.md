# Maqar

A room-booking platform for Jordan. People browse verified meeting, private, and event rooms on a
map of Amman, book them with a 50% CliQ deposit, and receive a 4-digit arrival code. There are two
account types: **guests** who book rooms, and **hosts** who list and manage them.

Bilingual (English / Arabic with full RTL), light and dark themes, installable as a PWA.

## Stack

React 19 + Vite · Tailwind CSS v3 · react-router-dom v7 · Leaflet + react-leaflet (CARTO tiles) ·
lucide-react · Supabase (Postgres, Auth, Storage, Realtime).

## Running it

```bash
npm install
npm run dev
```

The dev server runs on <http://localhost:5173>.

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint over `**/*.{js,jsx}` |

## Demo mode vs live mode

The app runs in one of two modes and picks automatically, so it never breaks:

- **Demo mode** — no Supabase env vars present. All data lives in `localStorage` seeded from
  `src/data/`. Everything is clickable with no backend at all.
- **Live mode** — both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Real auth, real
  Postgres, real Storage, realtime chat.

The switch is `isSupabaseConfigured` in `src/lib/supabase.js`. To go live, copy `.env.example` to
`.env.local` and fill in your project values — see [SETUP.md](./SETUP.md) for the full walkthrough
(creating the Supabase project, running `supabase/schema.sql`, the storage bucket, and deploying).

## Layout

```
src/
  screens/     route-level pages (Home, Detail, Booking, dashboards, Messages, Login)
  components/  reusable UI (Nav, RoomCard, MapView, Filters, Modal, Toast, …)
  store/       React Context providers — AppContext (data + actions), SettingsContext (theme/lang)
  services/    db.js — all Supabase reads and writes, live mode only
  lib/         small helpers — supabase client, route guards, geo math, ratings, icons, PWA
  data/        seed rooms and demo fixtures
  i18n/        EN/AR dictionaries and the useT() hook
supabase/
  schema.sql   tables, row-level security, signup trigger, seed rooms
public/        PWA manifest, service worker, icons
```

More detail on architecture and the current roadmap lives in [SESSION_LOG.md](./SESSION_LOG.md),
and repo-wide conventions are in [`../CLAUDE.md`](../CLAUDE.md).
