# Maqar — going live (Supabase backend + deploy)

The app runs in two modes automatically:

- **Demo mode** (default, no setup): all data lives in the browser (`localStorage` + seed). Great for clicking through and pitching.
- **Live mode**: when Supabase env vars are present, the app uses a real Postgres database, real auth, storage, and realtime.

You flip from demo → live just by adding two env values. Nothing else changes in code.

---

## 1. Create a Supabase project  (~5 min, free tier)

1. Go to <https://supabase.com> → sign in → **New project**.
2. Pick a name (e.g. `maqar`), a strong DB password, and a region near Jordan (e.g. **EU (Frankfurt)** or **EU West**).
3. Wait for it to finish provisioning.

## 2. Create the database

1. In the dashboard, open **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**.
   - This creates all tables, security policies, the sign-up trigger, and seeds the 6 demo rooms.
   - It's safe to re-run.

## 3. Turn on auth

1. **Authentication → Providers → Email**: make sure it's enabled.
2. For quick testing, **Authentication → Providers → Email → "Confirm email"**: turn **OFF** (so sign-up logs you straight in). Turn it back on before real launch.
3. *(Optional, for Jordan launch)* Enable **Phone** provider and connect an SMS provider (Twilio/MessageBird) for OTP login.

## 4. Create the photos storage bucket

1. **Storage → New bucket** → name it `room-photos` → make it **Public**.
   (Host listing uploads go here in live mode; demo mode uses sample Unsplash images.)

## 5. Add your keys to the app

1. In the dashboard: **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
2. In the `maqar-app` folder, copy `.env.example` to `.env.local` and fill them in:

   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

3. Restart the dev server: `npm run dev`.
   The app is now on the real backend. (The anon key is safe to ship in a frontend — Row-Level Security protects the data.)

---

## 6. Deploy the public demo (Vercel, ~5 min)

1. Push `maqar-app` to a GitHub repo.
2. Go to <https://vercel.com> → **Add New → Project** → import the repo.
3. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
4. Add the two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) under **Settings → Environment Variables** (or skip them to deploy in demo mode).
5. **Deploy.** You'll get a public `https://…vercel.app` URL to share.
6. Back in Supabase: **Authentication → URL Configuration** → add your Vercel URL to **Site URL** / redirect allow-list.

> SPA routing note: Vercel handles Vite SPA routing automatically. (For other hosts, add a catch-all rewrite of all paths → `/index.html`.)

---

## What's verified vs. pending

- ✅ Demo mode: fully working and build-clean.
- ⏳ Live mode: the schema, auth wiring, and client are in place, but the live data paths can only be verified once your project exists. After step 5, we'll confirm each table end-to-end (sign-up → list a room → book as another account → host approves) and then convert the remaining reads/realtime to live.
