import { describe, it, expect } from "vitest";
import { STATUS, ACTOR, canTransition, allowedTransitions, isTerminal, holdsSlot } from "./bookingMachine.js";

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
