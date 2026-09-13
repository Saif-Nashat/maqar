// Seed data for the prototype's in-session/persisted stores.
// Keyed by the same UUID room ids used everywhere (see RID in rooms.js).
import { RID } from "./rooms.js";

export const DEFAULT_DATE = "2026-06-15";

// Reviews keyed by roomId
export const SEED_REVIEWS = {
  [RID.r1]: [
    { id: "rv1", author: "Lana N.", rating: 5, text: "Spotless room and the espresso bar is a real perk. Booked again the same week.", ts: "2026-05-30" },
    { id: "rv2", author: "Omar H.", rating: 5, text: "Quiet, professional, great for client meetings.", ts: "2026-05-22" },
    { id: "rv3", author: "Dana K.", rating: 4, text: "Lovely space, parking filled up fast though.", ts: "2026-05-11" },
  ],
  [RID.r2]: [
    { id: "rv4", author: "Yousef A.", rating: 5, text: "Perfect little focus room. Fast wifi, endless coffee.", ts: "2026-05-18" },
  ],
  [RID.r4]: [
    { id: "rv5", author: "Maya S.", rating: 5, text: "Bright and flexible — we reshaped it for interviews easily.", ts: "2026-05-15" },
    { id: "rv6", author: "Tariq R.", rating: 5, text: "Great light for our shoot. Will rebook.", ts: "2026-04-29" },
  ],
};

// Slots already taken, keyed by `${roomId}|${date}`
export const SEED_TAKEN = {
  [`${RID.r1}|${DEFAULT_DATE}`]: ["10:30", "12:00", "15:00"],
  [`${RID.r2}|${DEFAULT_DATE}`]: ["09:00", "09:30", "14:00"],
  [`${RID.r5}|${DEFAULT_DATE}`]: ["11:00", "11:30", "12:00", "12:30"],
};

// Message threads keyed by roomId (guest ↔ that room's host)
export const SEED_THREADS = {
  [RID.r1]: [
    { from: "host", text: "Hi! Thanks for your interest in The Crema Boardroom. Let me know if you need the projector set up.", ts: "09:12" },
  ],
  [RID.r5]: [
    { from: "host", text: "Welcome — the barista station next door opens at 8am.", ts: "08:40" },
    { from: "user", text: "Perfect, we'll arrive around 10.", ts: "08:46" },
  ],
};

// Wallet / payment history
export const SEED_PAYMENTS = [
  { id: "pay1", roomId: RID.r1, label: "Deposit (50%)", amount: 9, date: "2026-06-13", method: "CliQ", status: "Paid" },
  { id: "pay2", roomId: RID.r5, label: "Deposit (50%)", amount: 6, date: "2026-06-12", method: "CliQ", status: "Paid" },
  { id: "pay3", roomId: RID.r3, label: "Full payment", amount: 36, date: "2026-05-28", method: "CliQ", status: "Paid" },
];

// Host agenda — upcoming confirmed bookings across the host's rooms
export const SEED_AGENDA = [
  { id: "ag1", roomId: RID.r1, who: "L. Nasser", date: "2026-06-15", start: "14:00", end: "16:00", status: "Confirmed" },
  { id: "ag2", roomId: RID.r5, who: "R. Haddad", date: "2026-06-15", start: "10:00", end: "11:30", status: "Confirmed" },
  { id: "ag3", roomId: RID.r1, who: "S. Odeh", date: "2026-06-16", start: "09:00", end: "11:00", status: "Confirmed" },
  { id: "ag4", roomId: RID.r4, who: "M. Ali", date: "2026-06-16", start: "13:00", end: "14:30", status: "Confirmed" },
  { id: "ag5", roomId: RID.r2, who: "K. Saleh", date: "2026-06-17", start: "16:30", end: "18:00", status: "Confirmed" },
];
