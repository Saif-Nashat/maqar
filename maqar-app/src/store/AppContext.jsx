import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { usePersistedState } from "./persist.js";
import { SEED_REVIEWS, SEED_THREADS, SEED_PAYMENTS } from "../data/seed.js";
import { ROOMS, mapRoomRow } from "../data/rooms.js";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import * as db from "../services/db.js";
import { STATUS, ACTOR, canTransition, paymentDeadline, refundAmount, bookingTotal, overlaps, COMMISSION_RATE, canRequestAt, REFUND_POLICY } from "../lib/bookingMachine.js";
import * as rail from "../services/paymentRail.js";

const live = isSupabaseConfigured;

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// `area` is the Amman district taken from a room's `loc` ("Abdoun, Amman" → "Abdoun").
// "all" means no location filter. It is keyed off the English loc so the value stays
// stable when the interface language changes.
const initialFilters = { type: "all", feats: [], minCap: 1, sort: "rec", area: "all" };
const initialBooking = { slot: null, dur: 1 };

export function AppProvider({ children }) {
  // ----- auth / account (live via Supabase, or mock via localStorage) -----
  const [account, setAccountState] = useState(() => {
    if (isSupabaseConfigured) return null;
    try { const s = localStorage.getItem("maqar-account"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  // persist mock account
  useEffect(() => {
    if (isSupabaseConfigured) return;
    try { localStorage.setItem("maqar-account", JSON.stringify(account)); } catch { /* ignore */ }
  }, [account]);

  // live session → load profile (account type) and keep in sync
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    async function loadProfile(session) {
      if (!session?.user) { if (active) { setAccountState(null); setAuthReady(true); } return; }
      const { data } = await supabase.from("profiles").select("type,name").eq("id", session.user.id).single();
      if (active) { setAccountState({ id: session.user.id, type: data?.type || "user", name: data?.name || null }); setAuthReady(true); }
    }
    supabase.auth.getSession().then(({ data }) => loadProfile(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => loadProfile(session));
    return () => { active = false; sub?.subscription?.unsubscribe(); };
  }, []);

  // ----- persisted slices (demo mode) -----
  const [myListings, setMyListings] = usePersistedState("maqar-listings", []);
  const [favorites, setFavorites] = usePersistedState("maqar-favorites", []);
  const [reviews, setReviews] = usePersistedState("maqar-reviews", SEED_REVIEWS);
  const [threads, setThreads] = usePersistedState("maqar-threads", SEED_THREADS);
  const [payments, setPayments] = usePersistedState("maqar-payments", SEED_PAYMENTS);
  const [bookings, setBookings] = useState([]); // live-only; demo dashboards use their own fixtures

  const loggedIn = !!account;
  const accountType = account?.type ?? null;

  // ----- rooms (live from Supabase, or seed in demo) -----
  const [rooms, setRooms] = useState(ROOMS); // seed default so demo + first paint always have data
  const [roomsLoading, setRoomsLoading] = useState(isSupabaseConfigured);
  const loadRooms = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase.from("rooms").select("*").order("created_at", { ascending: true });
    if (data) setRooms(data.map(mapRoomRow));
    setRoomsLoading(false);
  }, []);
  useEffect(() => { loadRooms(); }, [loadRooms]);
  const getRoom = useCallback((id) => rooms.find((r) => String(r.id) === String(id)), [rooms]);

  // ----- live data: load per-user slices on login + realtime chat -----
  useEffect(() => {
    if (!live || !account?.id) {
      if (live && !account?.id) { setBookings([]); }
      return;
    }
    let active = true;
    (async () => {
      const [favs, pays, bks, ths] = await Promise.all([
        db.fetchFavorites(), db.fetchPayments(), db.fetchBookings(), db.fetchThreads(),
      ]);
      if (!active) return;
      setFavorites(favs); setPayments(pays); setBookings(bks); setThreads(ths);
    })();
    const unsub = db.subscribeMessages((m) => {
      if (m.sender_id === account.id) return; // our own messages are added optimistically
      setThreads((t) => {
        const arr = t[m.room_id] || [];
        const ts = (() => { try { return new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } })();
        return { ...t, [m.room_id]: [...arr, { from: m.sender_type, text: m.text, ts }] };
      });
    });
    return () => { active = false; unsub && unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  // ----- ephemeral session state -----
  const [filters, setFilters] = useState(initialFilters);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [booking, setBooking] = useState(initialBooking);
  const [matchCode, setMatchCode] = useState(null);

  // ----- toast -----
  const [toastMsg, setToastMsg] = useState("");
  const [toastShown, setToastShown] = useState(false);
  const toastTimer = useRef(null);
  const toast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastShown(true);
    toastTimer.current = setTimeout(() => setToastShown(false), 3200);
  }, []);

  // ----- modal -----
  const [modal, setModal] = useState(null);
  const openModal = useCallback((cfg) => setModal(cfg), []);
  const closeModal = useCallback(() => setModal(null), []);

  const pendingAction = useRef(null);
  // Reads the queued action and clears it, in one step and inside the provider that owns
  // the ref. Callers used to do `const a = pendingAction.current; pendingAction.current = null`,
  // which mutates a value handed back from a hook — react-hooks/immutability flags that at
  // the assignment *and* at every callback that reaches it.
  const consumePendingAction = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    return action;
  }, []);

  // ----- auth -----
  const signUp = useCallback(async ({ email, password, type, name }) => {
    if (!isSupabaseConfigured) { setAccountState({ type, name: name || null }); return { ok: true }; }
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { type, name } } });
    return { ok: !error, error: error?.message };
  }, []);

  const signIn = useCallback(async ({ email, password, type }) => {
    if (!isSupabaseConfigured) { setAccountState({ type, name: null }); return { ok: true }; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { ok: !error, error: error?.message };
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) { try { await supabase.auth.signOut(); } catch { /* ignore */ } }
    setAccountState(null);
    toast("Signed out.");
  }, [toast]);

  // ----- listings -----
  const addListing = useCallback((room) => {
    setMyListings((list) => [{ ...room, id: `new-${list.length + 1}` }, ...list]);
  }, [setMyListings]);

  // Create a room: live → insert into Supabase (appears for everyone); demo → local listing.
  const createRoom = useCallback(async (draft) => {
    if (!isSupabaseConfigured) { addListing(draft); return { ok: true }; }
    const payload = {
      host_id: account?.id || null,
      title: draft.name, title_ar: draft.name,
      loc: `${draft.area}, Amman`, loc_ar: `${draft.area}، عمّان`, area: draft.area,
      type: draft.type, cap: draft.cap, price: draft.price,
      lat: draft.lat, lng: draft.lng, feats: draft.feats, imgs: draft.imgs,
      descr: draft.desc, descr_ar: draft.desc, verified: false, rating: 0, reviews: 0,
    };
    const { data, error } = await supabase.from("rooms").insert(payload).select().single();
    if (!error && data) setRooms((rs) => [...rs, mapRoomRow(data)]);
    return { ok: !error, error: error?.message };
  }, [account, addListing]);

  // ----- favorites -----
  const isFavorite = useCallback((id) => favorites.includes(id), [favorites]);
  const toggleFavorite = useCallback((id) => {
    const has = favorites.includes(id);
    setFavorites((f) => (has ? f.filter((x) => x !== id) : [...f, id]));
    if (live && account?.id) {
      if (has) db.removeFavoriteDb(account.id, id); else db.addFavoriteDb(account.id, id);
    }
  }, [favorites, account, setFavorites]);

  // ----- reviews -----
  const getReviews = useCallback((roomId) => reviews[roomId] || [], [reviews]);
  const loadReviews = useCallback(async (roomId) => {
    if (!live) return;
    const rows = await db.fetchReviews(roomId);
    setReviews((r) => ({ ...r, [roomId]: rows }));
  }, [setReviews]);
  const addReview = useCallback(async (roomId, review) => {
    if (live && account?.id) {
      const { data } = await db.addReviewDb({ roomId, authorId: account.id, authorName: review.author, rating: review.rating, text: review.text });
      const mapped = data
        ? { id: data.id, author: data.author_name, rating: data.rating, text: data.text, ts: (data.created_at || "").slice(0, 10) }
        : { id: `rv-${Date.now()}`, ...review };
      setReviews((r) => ({ ...r, [roomId]: [mapped, ...(r[roomId] || [])] }));
    } else {
      setReviews((r) => ({ ...r, [roomId]: [{ id: `rv-${Date.now()}`, ...review }, ...(r[roomId] || [])] }));
    }
  }, [account, setReviews]);

  // ----- bookings -----
  // Live mode calls RPCs; demo mode runs the same rules from bookingMachine
  // against a persisted local list. The rules live in one file so the two
  // cannot drift.
  const [demoBookings, setDemoBookings] = usePersistedState("maqar-bookings", []);
  const allBookings = live ? bookings : demoBookings;

  const bookedRanges = useCallback(async (roomId) => {
    if (live) {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 90 * 864e5).toISOString();
      return db.bookedRangesDb(roomId, from, to);
    }
    return demoBookings
      .filter((b) => String(b.roomId) === String(roomId) && ["Requested", "Approved", "Confirmed"].includes(b.status))
      .map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt }));
  }, [demoBookings]);

  const requestBooking = useCallback(async ({ room, startsAt, endsAt }) => {
    if (live && account?.id) {
      const { data, error } = await db.requestBookingDb({ roomId: room.id, startsAt, endsAt });
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      return { ok: true, booking: data };
    }
    if (!(new Date(endsAt) > new Date(startsAt))) return { ok: false, error: "invalidRange" };
    if (!canRequestAt(startsAt, new Date())) return { ok: false, error: "tooSoon" };
    const clash = demoBookings.some((b) =>
      String(b.roomId) === String(room.id) &&
      ["Requested", "Approved", "Confirmed"].includes(b.status) &&
      overlaps(b.startsAt, b.endsAt, startsAt, endsAt));
    if (clash) return { ok: false, error: "That time is no longer free." };
    const booking = {
      id: `bk-${Date.now()}`, roomId: room.id, guestId: "demo-guest",
      startsAt, endsAt, status: STATUS.REQUESTED,
      total: bookingTotal(room.price, startsAt, endsAt),
      commissionRate: COMMISSION_RATE, refundPolicy: REFUND_POLICY,
      denialReason: null, paymentDeadline: null, code: null,
    };
    setDemoBookings((list) => [booking, ...list]);
    return { ok: true, booking };
  }, [account, demoBookings, setDemoBookings]);

  const patchDemo = useCallback((id, patch) => {
    setDemoBookings((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, [setDemoBookings]);

  const approveBooking = useCallback(async (id) => {
    if (live) {
      const { error } = await db.approveBookingDb(id);
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      return { ok: true };
    }
    const b = demoBookings.find((x) => x.id === id);
    if (!b || !canTransition(b.status, STATUS.APPROVED, ACTOR.HOST)) return { ok: false, error: "Not allowed." };
    patchDemo(id, { status: STATUS.APPROVED, paymentDeadline: paymentDeadline(new Date(), b.startsAt).toISOString() });
    return { ok: true };
  }, [demoBookings, patchDemo]);

  const denyBooking = useCallback(async (id, reason) => {
    if (!String(reason || "").trim()) return { ok: false, error: "A reason is required." };
    if (live) {
      const { error } = await db.denyBookingDb(id, reason);
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      return { ok: true };
    }
    const b = demoBookings.find((x) => x.id === id);
    if (!b || !canTransition(b.status, STATUS.DENIED, ACTOR.HOST)) return { ok: false, error: "Not allowed." };
    patchDemo(id, { status: STATUS.DENIED, denialReason: reason.trim() });
    return { ok: true };
  }, [demoBookings, patchDemo]);

  const cancelBooking = useCallback(async (id) => {
    if (live) {
      const { error } = await db.cancelBookingDb(id);
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      setPayments(await db.fetchPayments());
      return { ok: true };
    }
    const b = demoBookings.find((x) => x.id === id);
    if (!b) return { ok: false, error: "Not allowed." };
    const isHost = accountType === "host";
    const actor = isHost ? ACTOR.HOST : ACTOR.GUEST;
    const toStatus = isHost ? STATUS.CANCELLED_BY_HOST : STATUS.CANCELLED_BY_GUEST;
    if (!canTransition(b.status, toStatus, actor)) return { ok: false, error: "Not allowed." };
    // A host cancelling a confirmed booking always refunds in full; a guest gets the
    // time-based fraction from bookingMachine's refund policy.
    const refund = b.status === STATUS.CONFIRMED
      ? (isHost ? b.total : refundAmount(b.total, b.startsAt, new Date(), b.refundPolicy || REFUND_POLICY))
      : 0;
    patchDemo(id, { status: toStatus });
    if (refund > 0) setPayments((p) => [{ id: `pay-${Date.now()}`, bookingId: id, roomId: b.roomId, kind: "refund", status: "pending", amount: refund, currency: "JOD", date: new Date().toISOString().slice(0, 10) }, ...p]);
    return { ok: true };
  }, [demoBookings, patchDemo, setPayments, accountType]);

  const payForBooking = useCallback(async (id, card) => {
    const b = allBookings.find((x) => x.id === id);
    if (!b) return { ok: false, error: "Booking not found." };
    if (!canTransition(b.status, STATUS.CONFIRMED, ACTOR.SYSTEM)) return { ok: false, error: "notPayable" };
    if (b.paymentDeadline && new Date(b.paymentDeadline) < new Date()) return { ok: false, error: "deadlinePassed" };

    if (live) {
      // `b` above can be stale — the host may have cancelled, or the lazy sweep may
      // have expired the booking, in the gap between this screen loading and the
      // guest clicking pay. Re-read the authoritative row right before charging and
      // re-run both guards against it, so a charge is never captured against a
      // booking the server would then refuse to confirm (a captured charge with no
      // booking and no refund). Demo mode's local array is already current, so it
      // needs no re-read.
      const fresh = await db.fetchBooking(id);
      if (!fresh) return { ok: false, error: "Booking not found." };
      if (!canTransition(fresh.status, STATUS.CONFIRMED, ACTOR.SYSTEM)) return { ok: false, error: "notPayable" };
      if (fresh.paymentDeadline && new Date(fresh.paymentDeadline) < new Date()) return { ok: false, error: "deadlinePassed" };
    }

    const res = await rail.charge({ bookingId: id, amount: b.total, currency: "JOD", card });
    if (!res.ok) return { ok: false, error: res.error };
    if (live) {
      const { error } = await db.confirmBookingPaymentDb(id, res.providerRef);
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      setPayments(await db.fetchPayments());
      return { ok: true };
    }
    const code = String(Math.floor(1000 + Math.random() * 9000));
    patchDemo(id, { status: STATUS.CONFIRMED, code });
    setPayments((p) => [{ id: `pay-${Date.now()}`, bookingId: id, roomId: b.roomId, kind: "charge", status: "succeeded", amount: b.total, currency: "JOD", date: new Date().toISOString().slice(0, 10) }, ...p]);
    return { ok: true };
  }, [allBookings, patchDemo, setPayments]);

  const validateArrivalCode = useCallback(async (id, code) => {
    if (live) {
      const { error } = await db.validateArrivalCodeDb(id, code);
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      return { ok: true };
    }
    const b = demoBookings.find((x) => x.id === id);
    if (!b || b.status !== STATUS.CONFIRMED) return { ok: false, error: "Not allowed." };
    if (b.code !== code) return { ok: false, error: "That code does not match." };
    patchDemo(id, { status: STATUS.COMPLETED });
    return { ok: true };
  }, [demoBookings, patchDemo]);

  const arrivalCodeFor = useCallback(async (id) => {
    if (live) return db.fetchArrivalCode(id);
    return demoBookings.find((x) => x.id === id)?.code || null;
  }, [demoBookings]);

  // ----- messaging (live → DB insert + realtime; demo → local) -----
  const getThread = useCallback((roomId) => threads[roomId] || [], [threads]);
  const sendMessage = useCallback((roomId, from, text) => {
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setThreads((th) => ({ ...th, [roomId]: [...(th[roomId] || []), { from, text, ts }] }));
    if (live && account?.id) {
      const existing = threads[roomId] || [];
      const guestId = from === "user" ? account.id : (existing.find((m) => m.guestId)?.guestId || account.id);
      db.sendMessageDb({ roomId, guestId, senderId: account.id, senderType: from, text });
    }
  }, [threads, account, setThreads]);
  const threadCount = Object.keys(threads).length;

  const resetBooking = useCallback(() => { setBooking(initialBooking); setMatchCode(null); }, []);

  const value = {
    account, accountType, loggedIn, authReady, signUp, signIn, signOut,
    isLiveBackend: isSupabaseConfigured,
    filters, setFilters,
    currentRoom, setCurrentRoom,
    booking, setBooking,
    matchCode, setMatchCode,
    rooms, roomsLoading, getRoom, createRoom, refreshRooms: loadRooms,
    myListings, addListing,
    favorites, isFavorite, toggleFavorite,
    reviews, getReviews, loadReviews, addReview,
    bookings: allBookings, bookedRanges,
    requestBooking, approveBooking, denyBooking, cancelBooking,
    payForBooking, validateArrivalCode, arrivalCodeFor,
    threads, getThread, sendMessage, threadCount,
    payments,
    resetBooking,
    toast, toastMsg, toastShown,
    modal, openModal, closeModal,
    pendingAction, consumePendingAction,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
