import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Check, CreditCard, Clock } from "lucide-react";
import { roomText } from "../data/rooms.js";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";
import { useRequireAccount } from "../lib/guards.jsx";
import { STATUS } from "../lib/bookingMachine.js";

export default function Pay() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const { bookings, payForBooking, arrivalCodeFor, toast, getRoom } = useApp();
  const { t, lang } = useT();
  const blocked = useRequireAccount("user");

  const [card, setCard] = useState({ number: "", exp: "", cvc: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(null);

  const booking = bookings.find((b) => String(b.id) === String(bookingId));

  useEffect(() => {
    if (booking?.status === STATUS.CONFIRMED) arrivalCodeFor(booking.id).then(setCode);
  }, [booking?.status, booking?.id, arrivalCodeFor]);

  if (blocked || !booking) return null;
  // Live-mode bookings arrive with `.room` joined; demo-mode ones only carry
  // `roomId`, so fall back to the room list the same way UserDash/HostDash do.
  const room = booking.room || getRoom(booking.roomId);
  const rt = room ? roomText(room, lang) : { title: "", loc: "" };
  const host = (rt.loc || "").split(/[,،]/)[0].trim();
  const jod = lang === "ar" ? "د.أ" : "JOD";

  if (booking.status === STATUS.CONFIRMED) {
    return (
      <div className="max-w-[760px] mx-auto px-[22px] pt-7 pb-[60px]">
        <div className="surface p-[26px] py-10 text-center">
          <div className="w-[74px] h-[74px] rounded-full grid place-items-center mx-auto mb-[18px] animate-popCheck"
            style={{ background: "rgba(63,122,78,.12)", color: "var(--good)" }}>
            <Check className="w-9 h-9" strokeWidth={3} />
          </div>
          <h2 className="text-[26px] mb-2 font-semibold">{t("pay.confirmed")}</h2>
          <p className="text-[14px] max-w-[420px] mx-auto mb-6" style={{ color: "var(--muted)" }}>{t("pay.codeBody")}</p>
          {code && (
            <div className="inline-flex gap-[10px] my-[22px]" dir="ltr">
              {code.split("").map((d, i) => (
                <div key={i} className="code-digit w-[58px] h-[68px] rounded-[14px] text-[34px]"
                  style={{ animation: `flipIn .5s cubic-bezier(.22,1,.36,1) ${0.25 + i * 0.1}s both` }}>{d}</div>
              ))}
            </div>
          )}
          <button className="btn-primary py-[13px] rounded-xl max-w-[300px] w-full mx-auto block" onClick={() => nav("/me")}>
            {t("booking.goBookings")}
          </button>
        </div>
      </div>
    );
  }

  if (booking.status !== STATUS.APPROVED) {
    return <div className="max-w-[760px] mx-auto px-[22px] pt-7"><div className="surface p-8 text-center text-[14px]" style={{ color: "var(--muted)" }}>{t("pay.notPayable")}</div></div>;
  }

  async function submit() {
    setBusy(true);
    const res = await payForBooking(booking.id, card);
    setBusy(false);
    if (!res.ok) toast(t(`pay.err.${res.error}`) || res.error);
  }

  const deadline = booking.paymentDeadline
    ? new Date(booking.paymentDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="max-w-[760px] mx-auto px-[22px] pt-7 pb-[60px]">
      <div className="surface p-[26px] mb-[18px]">
        <h2 className="text-[22px] font-semibold mb-[6px]">{t("pay.title")}</h2>
        <p className="text-[14px] mb-4" style={{ color: "var(--muted)" }}>{t("pay.sub", { host })}</p>

        {deadline && (
          <div className="flex items-center gap-2 text-[13px] font-semibold mb-5 p-3 rounded-xl"
            style={{ background: "rgba(192,134,59,.08)", border: "1px solid var(--line)", color: "var(--warn)" }}>
            <Clock className="w-4 h-4 shrink-0" /> {t("pay.deadline", { time: deadline })}
          </div>
        )}

        <div className="rounded-xl p-4 px-[18px] mb-5" style={{ background: "var(--foam)", border: "1px solid var(--line)" }}>
          <div className="flex justify-between text-[16px] font-bold" style={{ color: "var(--coffee)" }}>
            <span>{rt.title}</span><span className="num">{booking.total} {jod}</span>
          </div>
        </div>

        <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("pay.card")}</label>
        <input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })}
          inputMode="numeric" autoComplete="cc-number" dir="ltr" placeholder="4242 4242 4242 4242" className="field-input mb-3" />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("pay.exp")}</label>
            <input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })}
              autoComplete="cc-exp" dir="ltr" placeholder="12/30" className="field-input" />
          </div>
          <div>
            <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("pay.cvc")}</label>
            <input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })}
              autoComplete="cc-csc" dir="ltr" placeholder="123" className="field-input" />
          </div>
        </div>

        <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("pay.name")}</label>
        <input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })}
          autoComplete="cc-name" className="field-input mb-4" />

        <p className="text-[12px] mb-4" style={{ color: "var(--muted)" }}>{t("pay.refundNote")}</p>

        <button onClick={submit} disabled={busy || !card.number}
          className="btn-primary w-full py-[13px] rounded-xl text-[15px] flex items-center justify-center gap-2">
          <CreditCard className="w-4 h-4" /> {t("pay.payNow", { amount: booking.total })}
        </button>
      </div>
    </div>
  );
}
