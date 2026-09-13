// Supabase data access. Only called in live mode (isSupabaseConfigured === true).
import { supabase } from "../lib/supabase.js";
import { mapRoomRow } from "../data/rooms.js";

/* ---------------- favorites ---------------- */
export async function fetchFavorites() {
  const { data } = await supabase.from("favorites").select("room_id");
  return (data || []).map((r) => r.room_id);
}
export async function addFavoriteDb(userId, roomId) {
  await supabase.from("favorites").insert({ user_id: userId, room_id: roomId });
}
export async function removeFavoriteDb(userId, roomId) {
  await supabase.from("favorites").delete().eq("user_id", userId).eq("room_id", roomId);
}

/* ---------------- reviews ---------------- */
export async function fetchReviews(roomId) {
  const { data } = await supabase.from("reviews").select("*").eq("room_id", roomId).order("created_at", { ascending: false });
  return (data || []).map((r) => ({ id: r.id, author: r.author_name, rating: r.rating, text: r.text, ts: (r.created_at || "").slice(0, 10) }));
}
export async function addReviewDb({ roomId, authorId, authorName, rating, text }) {
  const { data, error } = await supabase.from("reviews")
    .insert({ room_id: roomId, author_id: authorId, author_name: authorName, rating, text })
    .select().single();
  return { data, error };
}

/* ---------------- payments ---------------- */
export async function fetchPayments() {
  const { data } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
  return (data || []).map((p) => ({ id: p.id, roomId: p.room_id, label: p.label, amount: Number(p.amount), method: p.method, status: p.status, date: (p.created_at || "").slice(0, 10) }));
}
export async function addPaymentDb({ userId, roomId, label, amount, method = "CliQ", status = "Paid" }) {
  const { data } = await supabase.from("payments").insert({ user_id: userId, room_id: roomId, label, amount, method, status }).select().single();
  return data;
}

/* ---------------- bookings ---------------- */
// RLS returns: the guest's own bookings + bookings for rooms the host owns.
export async function fetchBookings() {
  const { data } = await supabase.from("bookings").select("*, rooms(*)").order("created_at", { ascending: false });
  return (data || []).map((b) => ({
    id: b.id, roomId: b.room_id, guestId: b.guest_id, date: b.date, slot: b.slot, dur: Number(b.dur),
    status: b.status, code: b.code, total: Number(b.total), createdAt: b.created_at,
    room: b.rooms ? mapRoomRow(b.rooms) : null,
  }));
}
export async function createBookingDb({ roomId, guestId, date, slot, dur, status, code, total }) {
  const { data, error } = await supabase.from("bookings")
    .insert({ room_id: roomId, guest_id: guestId, date, slot, dur, status, code, total })
    .select("*, rooms(*)").single();
  return { data, error };
}
export async function updateBookingDb(id, patch) {
  const { data, error } = await supabase.from("bookings").update(patch).eq("id", id).select("*, rooms(*)").single();
  return { data, error };
}
export async function takenSlotsDb(roomId, date) {
  const { data } = await supabase.from("bookings").select("slot")
    .eq("room_id", roomId).eq("date", date)
    .in("status", ["PendingHost", "Confirmed", "Upcoming"]);
  return (data || []).map((b) => b.slot);
}

/* ---------------- messages ---------------- */
export async function fetchThreads() {
  const { data } = await supabase.from("messages").select("*").order("created_at", { ascending: true });
  const threads = {};
  for (const m of data || []) {
    (threads[m.room_id] ||= []).push({ from: m.sender_type, text: m.text, ts: fmtTime(m.created_at), guestId: m.guest_id });
  }
  return threads;
}
export async function sendMessageDb({ roomId, guestId, senderId, senderType, text }) {
  await supabase.from("messages").insert({ room_id: roomId, guest_id: guestId, sender_id: senderId, sender_type: senderType, text });
}
export function subscribeMessages(onInsert) {
  const ch = supabase.channel("messages-rt")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => onInsert(payload.new))
    .subscribe();
  return () => supabase.removeChannel(ch);
}

/* ---------------- storage ---------------- */
export async function uploadRoomPhoto(file, userId) {
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId || "anon"}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const { error } = await supabase.storage.from("room-photos").upload(path, file, { upsert: false });
  if (error) return { error };
  const { data } = supabase.storage.from("room-photos").getPublicUrl(path);
  return { url: data.publicUrl };
}

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
