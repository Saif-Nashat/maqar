// A stand-in for a real payment provider.
//
// No PSP exists for Maqar yet, so this simulates one — including the failure
// paths, so they get built and tested now rather than discovered at
// integration. Replacing this file with a real provider is the whole
// integration: nothing above it knows what a card is.
//
// Card numbers below follow the usual test-card conventions.

export const PROVIDER = "stub";

const DECLINE = "4000000000000002";
const NETWORK_ERROR = "4000000000000119";
const LATENCY_MS = 600;

const ref = () => `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// eslint-disable-next-line no-unused-vars
export async function charge({ bookingId, amount, currency, card }) {
  if (!(amount > 0)) return { ok: false, error: "invalid_amount" };
  const number = (card?.number || "").replace(/\s/g, "");
  await wait(LATENCY_MS);
  if (number === DECLINE) return { ok: false, error: "card_declined" };
  if (number === NETWORK_ERROR) return { ok: false, error: "network_error" };
  if (number.length < 13) return { ok: false, error: "invalid_card" };
  return { ok: true, providerRef: ref() };
}

// eslint-disable-next-line no-unused-vars
export async function refund({ paymentId, amount }) {
  if (!(amount > 0)) return { ok: false, error: "invalid_amount" };
  await wait(LATENCY_MS);
  return { ok: true, providerRef: ref() };
}
