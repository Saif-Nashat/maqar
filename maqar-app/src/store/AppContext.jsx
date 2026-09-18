import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { usePersistedState } from "./persist.js";
import { SEED_REVIEWS, SEED_TAKEN, SEED_THREADS, SEED_PAYMENTS } from "../data/seed.js";
import { ROOMS, mapRoomRow } from "../data/rooms.js";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import * as db from "../services/db.js";

const live = isSupabaseConfigured;

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// `area` is the Amman district taken from a room's `loc` ("Abdoun, Amman" → "Abdoun").
// "all" means no location filter. It is keyed off the English loc so the value stays
// stable when the interface language changes.
const initialFilters = { type: "all", feats: [], minCap: 1, sort: "rec", area: "all" };
const initialBooking = { slot: null, dur: 1, proof: false };

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
  const [taken, setTaken] = usePersistedState("maqar-taken", SEED_TAKEN);
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

  // ----- availability (live → derived from real bookings; demo → local store) -----
  const takenFor = useCallback((roomId, date) => {
    if (live) return bookings.filter((b) => String(b.roomId) === String(roomId) && b.date === date && ["PendingHost", "Confirmed", "Upcoming"].includes(b.status)).map((b) => b.slot);
    return taken[`${roomId}|${date}`] || [];
  }, [taken, bookings]);
  const takeSlot = useCallback((roomId, date, slot) => {
    setTaken((tk) => {
      const key = `${roomId}|${date}`;
      const cur = tk[key] || [];
      return cur.includes(slot) ? tk : { ...tk, [key]: [...cur, slot] };
    });
  }, [setTaken]);

  // ----- bookings (live) -----
  const submitBooking = useCallback(async ({ room, date, slot, dur, code, total }) => {
    if (live && account?.id) {
      const { error } = await db.createBookingDb({ roomId: room.id, guestId: account.id, date, slot, dur, status: "PendingHost", code, total });
      if (error) return { ok: false, error: error.message };
      setBookings(await db.fetchBookings());
      await db.addPaymentDb({ userId: account.id, roomId: room.id, label: "Deposit (50%)", amount: +(total / 2).toFixed(2) });
      setPayments(await db.fetchPayments());
      return { ok: true };
    }
    takeSlot(room.id, date, slot);
    setPayments((p) => [{ id: `pay-${Date.now()}`, roomId: room.id, label: "Deposit (50%)", amount: +(total / 2).toFixed(2), date, method: "CliQ", status: "Paid" }, ...p]);
    return { ok: true };
  }, [account, takeSlot, setPayments]);

  const updateBooking = useCallback(async (id, patch) => {
    if (!live) return { ok: true };
    const { data, error } = await db.updateBookingDb(id, patch);
    if (!error && data) setBookings(await db.fetchBookings());
    return { ok: !error, error: error?.message };
  }, []);

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

  // ----- payments -----
  const addPayment = useCallback((entry) => {
    setPayments((p) => [{ id: `pay-${Date.now()}`, ...entry }, ...p]);
  }, [setPayments]);

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
    takenFor, takeSlot,
    bookings, submitBooking, updateBooking,
    threads, getThread, sendMessage, threadCount,
    payments, addPayment,
    resetBooking,
    toast, toastMsg, toastShown,
    modal, openModal, closeModal,
    pendingAction, consumePendingAction,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
