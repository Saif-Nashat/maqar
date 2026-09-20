import { describe, it, expect } from "vitest";
import { charge, refund, PROVIDER } from "./paymentRail.js";

const good = { number: "4242424242424242", exp: "12/30", cvc: "123", name: "S Ibrahim" };

describe("charge", () => {
  it("succeeds with a valid test card and returns a provider reference", async () => {
    const res = await charge({ bookingId: "b1", amount: 18, currency: "JOD", card: good });
    expect(res.ok).toBe(true);
    expect(res.providerRef).toMatch(/^stub_/);
  });

  it("declines the designated decline card", async () => {
    const res = await charge({ bookingId: "b1", amount: 18, currency: "JOD",
                              card: { ...good, number: "4000000000000002" } });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("card_declined");
  });

  it("reports a network failure for the designated error card", async () => {
    const res = await charge({ bookingId: "b1", amount: 18, currency: "JOD",
                              card: { ...good, number: "4000000000000119" } });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("network_error");
  });

  it("accepts card numbers with spaces", async () => {
    const res = await charge({ bookingId: "b1", amount: 18, currency: "JOD",
                              card: { ...good, number: "4242 4242 4242 4242" } });
    expect(res.ok).toBe(true);
  });

  it("rejects a missing or short card number", async () => {
    const missing = await charge({ bookingId: "b1", amount: 18, currency: "JOD", card: {} });
    const short = await charge({ bookingId: "b1", amount: 18, currency: "JOD",
                                card: { ...good, number: "4242" } });
    expect(missing).toEqual({ ok: false, error: "invalid_card" });
    expect(short).toEqual({ ok: false, error: "invalid_card" });
  });

  it("rejects a non-positive amount", async () => {
    const res = await charge({ bookingId: "b1", amount: 0, currency: "JOD", card: good });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid_amount");
  });

  it("rejects a non-positive refund", async () => {
    const res = await refund({ paymentId: "p1", amount: 0 });
    expect(res).toEqual({ ok: false, error: "invalid_amount" });
  });

  it("names itself so a real provider can replace it", () => {
    expect(PROVIDER).toBe("stub");
  });
});
