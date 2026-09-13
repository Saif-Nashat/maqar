import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// When both env vars are present we run on the real backend; otherwise the app
// stays in local "demo" mode (localStorage + seed data) so it always works.
export const isSupabaseConfigured = Boolean(url && anon);

export const supabase = isSupabaseConfigured ? createClient(url, anon) : null;
