import { describe, it, expect } from "vitest";
import { charge, PROVIDER } from "./paymentRail.js";

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

  it("rejects a non-positive amount", async () => {
    const res = await charge({ bookingId: "b1", amount: 0, currency: "JOD", card: good });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid_amount");
  });

  it("names itself so a real provider can replace it", () => {
    expect(PROVIDER).toBe("stub");
  });
});
