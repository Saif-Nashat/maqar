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

/* ---------------- bookings ---------------- */
// Reads come straight from the table (RLS scopes them). Every WRITE goes
// through an RPC — the client has no insert or update privilege on bookings.

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

// A single fresh row, bypassing the cached client-side list. Used right before a
// charge is captured, so a stale local copy (host cancelled, or the lazy sweep
// expired it) can't let a payment through that the server would then refuse to confirm.
export async function fetchBooking(id) {
  const { data } = await supabase
    .from("bookings")
    .select("*, rooms(*)")
    .eq("id", id)
    .maybeSingle();
  return data ? mapBookingRow(data) : null;
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
  // The RPC returns NULL (not a Postgres error) on a code mismatch, so its counter
  // write commits instead of being rolled back by a raised exception. Surface that
  // as an error here so the caller can't mistake "no data" for success.
  if (!error && !data) return { data: null, error: { message: "codeWrong" } };
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
