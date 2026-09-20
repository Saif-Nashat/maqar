import { describe, it, expect } from "vitest";
import { STATUS, ACTOR, canTransition, allowedTransitions, isTerminal, holdsSlot,
  COMMISSION_RATE, refundFraction, refundAmount, paymentDeadline,
  canRequestAt, overlaps, bookingTotal,
} from "./bookingMachine.js";

describe("canTransition", () => {
  it("lets a host approve a requested booking", () => {
    expect(canTransition(STATUS.REQUESTED, STATUS.APPROVED, ACTOR.HOST)).toBe(true);
  });

  it("does not let a guest approve their own booking", () => {
    expect(canTransition(STATUS.REQUESTED, STATUS.APPROVED, ACTOR.GUEST)).toBe(false);
  });

  it("does not let a guest confirm their own booking", () => {
    expect(canTransition(STATUS.APPROVED, STATUS.CONFIRMED, ACTOR.GUEST)).toBe(false);
  });

  it("lets the system confirm an approved booking once paid", () => {
    expect(canTransition(STATUS.APPROVED, STATUS.CONFIRMED, ACTOR.SYSTEM)).toBe(true);
  });

  it("lets a host complete a confirmed booking", () => {
    expect(canTransition(STATUS.CONFIRMED, STATUS.COMPLETED, ACTOR.HOST)).toBe(true);
  });

  it("refuses to complete a booking that was never confirmed", () => {
    expect(canTransition(STATUS.APPROVED, STATUS.COMPLETED, ACTOR.HOST)).toBe(false);
  });

  it("refuses any transition out of a terminal state", () => {
    expect(canTransition(STATUS.COMPLETED, STATUS.CANCELLED_BY_GUEST, ACTOR.GUEST)).toBe(false);
    expect(canTransition(STATUS.DENIED, STATUS.APPROVED, ACTOR.HOST)).toBe(false);
  });

  it("rejects unknown states and actors", () => {
    expect(canTransition("Unknown", STATUS.APPROVED, ACTOR.HOST)).toBe(false);
    expect(canTransition(STATUS.REQUESTED, STATUS.APPROVED, "unknown")).toBe(false);
  });

  it("lets a guest cancel at every pre-terminal stage", () => {
    expect(canTransition(STATUS.REQUESTED, STATUS.CANCELLED_BY_GUEST, ACTOR.GUEST)).toBe(true);
    expect(canTransition(STATUS.APPROVED, STATUS.CANCELLED_BY_GUEST, ACTOR.GUEST)).toBe(true);
    expect(canTransition(STATUS.CONFIRMED, STATUS.CANCELLED_BY_GUEST, ACTOR.GUEST)).toBe(true);
  });
});

describe("allowedTransitions", () => {
  it("gives a host exactly approve and deny from Requested", () => {
    expect(allowedTransitions(STATUS.REQUESTED, ACTOR.HOST).sort())
      .toEqual([STATUS.APPROVED, STATUS.DENIED].sort());
  });
});

describe("isTerminal", () => {
  it("marks the six end states terminal", () => {
    for (const s of [STATUS.DENIED, STATUS.EXPIRED, STATUS.COMPLETED, STATUS.NO_SHOW,
                     STATUS.CANCELLED_BY_GUEST, STATUS.CANCELLED_BY_HOST]) {
      expect(isTerminal(s)).toBe(true);
    }
    expect(isTerminal(STATUS.REQUESTED)).toBe(false);
  });
});

describe("holdsSlot", () => {
  it("holds the slot only while the booking is alive", () => {
    expect(holdsSlot(STATUS.REQUESTED)).toBe(true);
    expect(holdsSlot(STATUS.APPROVED)).toBe(true);
    expect(holdsSlot(STATUS.CONFIRMED)).toBe(true);
    expect(holdsSlot(STATUS.EXPIRED)).toBe(false);
    expect(holdsSlot(STATUS.COMPLETED)).toBe(false);
  });
});

const at = (iso) => new Date(iso);

describe("refundFraction", () => {
  const start = at("2026-10-01T12:00:00Z");

  it("refunds in full more than 24h before the start", () => {
    expect(refundFraction(start, at("2026-09-30T11:59:00Z"))).toBe(1);
  });

  it("refunds half at exactly 24h before the start", () => {
    expect(refundFraction(start, at("2026-09-30T12:00:00Z"))).toBe(0.5);
  });

  it("refunds half just inside 24h", () => {
    expect(refundFraction(start, at("2026-10-01T11:59:00Z"))).toBe(0.5);
  });

  it("refunds nothing at the start time", () => {
    expect(refundFraction(start, start)).toBe(0);
  });

  it("refunds nothing after the start", () => {
    expect(refundFraction(start, at("2026-10-01T13:00:00Z"))).toBe(0);
  });
});

describe("refundAmount", () => {
  it("rounds to three decimals", () => {
    const start = at("2026-10-01T12:00:00Z");
    expect(refundAmount(13.5, start, at("2026-10-01T11:00:00Z"))).toBe(6.75);
    expect(refundAmount(10, start, at("2026-09-01T00:00:00Z"))).toBe(10);
    expect(refundAmount(10, start, at("2026-10-01T12:00:00Z"))).toBe(0);
  });
});

describe("paymentDeadline", () => {
  it("is two hours after approval when the start is far away", () => {
    const approved = at("2026-10-01T09:00:00Z");
    const start = at("2026-10-05T12:00:00Z");
    expect(paymentDeadline(approved, start).toISOString()).toBe("2026-10-01T11:00:00.000Z");
  });

  it("is clamped to 30 minutes before the start when the start is soon", () => {
    const approved = at("2026-10-01T09:00:00Z");
    const start = at("2026-10-01T10:00:00Z");
    expect(paymentDeadline(approved, start).toISOString()).toBe("2026-10-01T09:30:00.000Z");
  });
});

describe("canRequestAt", () => {
  it("rejects a start less than an hour away", () => {
    const now = at("2026-10-01T09:00:00Z");
    expect(canRequestAt(at("2026-10-01T09:59:00Z"), now)).toBe(false);
    expect(canRequestAt(at("2026-10-01T10:01:00Z"), now)).toBe(true);
  });
});

describe("overlaps", () => {
  const a = [at("2026-10-01T09:00:00Z"), at("2026-10-01T13:00:00Z")];

  it("catches a slot starting inside an existing booking", () => {
    // This is the exact bug: a 4h booking at 09:00 did not block 09:30.
    expect(overlaps(...a, at("2026-10-01T09:30:00Z"), at("2026-10-01T10:30:00Z"))).toBe(true);
  });

  it("catches an enclosing slot", () => {
    expect(overlaps(...a, at("2026-10-01T08:00:00Z"), at("2026-10-01T14:00:00Z"))).toBe(true);
  });

  it("allows a booking that starts exactly when the other ends", () => {
    expect(overlaps(...a, at("2026-10-01T13:00:00Z"), at("2026-10-01T14:00:00Z"))).toBe(false);
  });

  it("allows a booking entirely before", () => {
    expect(overlaps(...a, at("2026-10-01T07:00:00Z"), at("2026-10-01T09:00:00Z"))).toBe(false);
  });

  it("does not treat a zero-length interval as overlapping", () => {
    expect(overlaps(...a, at("2026-10-01T10:00:00Z"), at("2026-10-01T10:00:00Z"))).toBe(false);
  });
});

describe("bookingTotal", () => {
  it("multiplies price by hours, including half hours", () => {
    expect(bookingTotal(9, at("2026-10-01T09:00:00Z"), at("2026-10-01T11:00:00Z"))).toBe(18);
    expect(bookingTotal(9, at("2026-10-01T09:00:00Z"), at("2026-10-01T10:30:00Z"))).toBe(13.5);
  });
});

describe("COMMISSION_RATE", () => {
  it("is 20 percent", () => {
    expect(COMMISSION_RATE).toBe(0.2);
    expect(Math.round(bookingTotal(7, at("2026-10-01T09:00:00Z"), at("2026-10-01T11:00:00Z")) * COMMISSION_RATE * 1000) / 1000).toBe(2.8);
  });
});
