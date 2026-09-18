// The booking lifecycle rules, in one place.
//
// Demo mode executes these against localStorage; live mode uses them for UI
// while the Postgres functions in supabase/migrations enforce the same table
// server-side. Both are written from this transition list — if you change one,
// change the other and the tests that cover them.

export const STATUS = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  DENIED: "Denied",
  EXPIRED: "Expired",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  NO_SHOW: "NoShow",
  CANCELLED_BY_GUEST: "CancelledByGuest",
  CANCELLED_BY_HOST: "CancelledByHost",
};

export const ACTOR = { GUEST: "guest", HOST: "host", SYSTEM: "system" };

const TRANSITIONS = [
  { from: STATUS.REQUESTED, to: STATUS.APPROVED, actor: ACTOR.HOST },
  { from: STATUS.REQUESTED, to: STATUS.DENIED, actor: ACTOR.HOST },
  { from: STATUS.REQUESTED, to: STATUS.CANCELLED_BY_GUEST, actor: ACTOR.GUEST },
  { from: STATUS.APPROVED, to: STATUS.CONFIRMED, actor: ACTOR.SYSTEM },
  { from: STATUS.APPROVED, to: STATUS.EXPIRED, actor: ACTOR.SYSTEM },
  { from: STATUS.APPROVED, to: STATUS.CANCELLED_BY_GUEST, actor: ACTOR.GUEST },
  { from: STATUS.APPROVED, to: STATUS.CANCELLED_BY_HOST, actor: ACTOR.HOST },
  { from: STATUS.CONFIRMED, to: STATUS.COMPLETED, actor: ACTOR.HOST },
  { from: STATUS.CONFIRMED, to: STATUS.NO_SHOW, actor: ACTOR.SYSTEM },
  { from: STATUS.CONFIRMED, to: STATUS.CANCELLED_BY_GUEST, actor: ACTOR.GUEST },
  { from: STATUS.CONFIRMED, to: STATUS.CANCELLED_BY_HOST, actor: ACTOR.HOST },
];

const TERMINAL = new Set([
  STATUS.DENIED, STATUS.EXPIRED, STATUS.COMPLETED, STATUS.NO_SHOW,
  STATUS.CANCELLED_BY_GUEST, STATUS.CANCELLED_BY_HOST,
]);

const HOLDS_SLOT = new Set([STATUS.REQUESTED, STATUS.APPROVED, STATUS.CONFIRMED]);

export function isTerminal(status) {
  return TERMINAL.has(status);
}

export function holdsSlot(status) {
  return HOLDS_SLOT.has(status);
}

export function canTransition(from, to, actor) {
  if (isTerminal(from)) return false;
  return TRANSITIONS.some((t) => t.from === from && t.to === to && t.actor === actor);
}

export function allowedTransitions(from, actor) {
  if (isTerminal(from)) return [];
  return TRANSITIONS.filter((t) => t.from === from && t.actor === actor).map((t) => t.to);
}
