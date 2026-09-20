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

const HOUR_MS = 3600 * 1000;

export const COMMISSION_RATE = 0.2;
export const REFUND_POLICY = { fullRefundHours: 24, partialFraction: 0.5 };
export const MIN_LEAD_MS = 1 * HOUR_MS;
const PAYMENT_WINDOW_MS = 2 * HOUR_MS;
const PAYMENT_CUTOFF_BEFORE_START_MS = 30 * 60 * 1000;

const ms = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());
const round3 = (n) => Math.round(n * 1000) / 1000;

/** 1 when cancelling early, the partial fraction inside the window, 0 once started. */
export function refundFraction(startsAt, now, policy = REFUND_POLICY) {
  const remaining = ms(startsAt) - ms(now);
  if (remaining <= 0) return 0;
  if (remaining > policy.fullRefundHours * HOUR_MS) return 1;
  return policy.partialFraction;
}

export function refundAmount(total, startsAt, now, policy = REFUND_POLICY) {
  return round3(total * refundFraction(startsAt, now, policy));
}

/** Two hours to pay, but never later than 30 minutes before the session starts. */
export function paymentDeadline(approvedAt, startsAt) {
  return new Date(Math.min(ms(approvedAt) + PAYMENT_WINDOW_MS, ms(startsAt) - PAYMENT_CUTOFF_BEFORE_START_MS));
}

export function canRequestAt(startsAt, now) {
  return ms(startsAt) - ms(now) >= MIN_LEAD_MS;
}

/** Half-open [start, end): a booking may begin exactly when another ends. */
export function overlaps(aStart, aEnd, bStart, bEnd) {
  if (ms(aStart) >= ms(aEnd) || ms(bStart) >= ms(bEnd)) return false;
  return ms(aStart) < ms(bEnd) && ms(bStart) < ms(aEnd);
}

export function bookingTotal(pricePerHour, startsAt, endsAt) {
  return round3(pricePerHour * ((ms(endsAt) - ms(startsAt)) / HOUR_MS));
}
