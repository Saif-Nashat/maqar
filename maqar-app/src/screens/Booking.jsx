import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Check, Paperclip, Copy } from "lucide-react";
import { roomText } from "../data/rooms.js";
import { DEFAULT_DATE } from "../data/seed.js";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";

const SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "14:00", "14:30", "15:00", "15:30"];
const DURS = [1, 1.5, 2, 3, 4];

export default function Booking() {
  const { id } = useParams();
  const nav = useNavigate();
  const { booking, setBooking, matchCode, setMatchCode, toast, loggedIn, accountType, authReady, pendingAction, takenFor, submitBooking, getRoom } = useApp();
  const { t, lang } = useT();
  const room = getRoom(id);
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [date, setDate] = useState(DEFAULT_DATE);

  // booking is for guest accounts only
  useEffect(() => {
    if (!authReady) return;
    if (!loggedIn) {
      pendingAction.current = () => nav(`/book/${id}`);
      toast(t("guard.signInFirst"));
      nav("/login", { replace: true });
    } else if (accountType === "host") {
      toast(t("guard.hostsCantBook"));
      nav("/", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, accountType, authReady]);

  if (!authReady || !room || !loggedIn || accountType !== "user") return null;
  const rt = roomText(room, lang);
  const jod = lang === "ar" ? "د.أ" : "JOD";
  const perHr = lang === "ar" ? "د.أ/ساعة" : "JOD/hr";
  const durLabel = (d) => `${d} ${d > 1 ? t("booking.hrs") : t("booking.hr")}`;
  const host = rt.loc.split(/[,،]/)[0].trim();
  const taken = takenFor(room.id, date);

  async function next() {
    if (step === 2) {
      // someone may have grabbed the slot meanwhile → conflict
      if (takenFor(room.id, date).includes(booking.slot)) {
        toast(t("book.conflict"));
        setBooking((b) => ({ ...b, slot: null }));
        setStep(1);
        window.scrollTo(0, 0);
        return;
      }
      const code = matchCode || String(Math.floor(1000 + Math.random() * 9000));
      if (!matchCode) setMatchCode(code);
      const res = await submitBooking({ room, date, slot: booking.slot, dur: booking.dur, code, total: room.price * booking.dur });
      if (!res.ok) { toast(res.error || t("book.conflict")); return; }
    }
    setStep((s) => s + 1);
    window.scrollTo(0, 0);
  }
  function finish() {
    nav("/me");
    toast(t("booking.requestSent"));
  }
  function copyAlias() {
    try { navigator.clipboard?.writeText("MAQAR.PAY"); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const total = room.price * booking.dur;
  const half = (total / 2).toFixed(total % 2 ? 2 : 0);

  return (
    <div className="max-w-[760px] mx-auto px-[22px] pt-7 pb-[60px]">
      <button onClick={() => nav(`/room/${room.id}`)} className="inline-flex items-center gap-[6px] font-semibold text-[14px] my-[18px] px-[13px] py-[7px] rounded-full hover:bg-foam transition-colors" style={{ color: "var(--coffee)" }}>
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" /> {t("booking.backToRoom")}
      </button>

      <div className="flex gap-2 mb-7">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-[5px] rounded-[3px] transition"
            style={{ background: i <= step ? "var(--crema)" : "var(--line)", boxShadow: i <= step ? "0 0 0 1px rgba(201,162,126,.5)" : "none" }} />
        ))}
      </div>

      {step === 1 && (
        <>
          <div className="surface p-[26px] mb-[18px]">
            <h2 className="text-[22px] font-semibold mb-[6px]">{t("booking.step1Title")}</h2>
            <p className="text-[14px] mb-5" style={{ color: "var(--muted)" }}>{t("booking.step1Sub", { title: rt.title, loc: rt.loc })}</p>

            <div className="mb-4">
              <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("booking.date")}</label>
              <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setBooking((b) => ({ ...b, slot: null })); }} className="field-input" />
            </div>

            <div className="mb-4">
              <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("booking.startTime")}</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {SLOTS.map((s) => {
                  const gone = taken.includes(s);
                  const on = booking.slot === s;
                  return (
                    <button key={s} disabled={gone} onClick={() => setBooking((b) => ({ ...b, slot: s }))}
                      title={gone ? t("book.taken") : undefined}
                      className={`slot py-[11px] rounded-[10px] text-[13px] font-semibold transition ${gone ? "line-through cursor-not-allowed" : "hover:-translate-y-[2px]"}`}
                      style={on
                        ? { background: "linear-gradient(150deg,var(--fill-dark),var(--fill-mid))", color: "var(--cream)", border: "1px solid var(--fill-dark)", boxShadow: "0 4px 12px rgba(43,29,23,.25)" }
                        : { background: "var(--surface)", color: "var(--coffee)", border: "1px solid var(--line)", opacity: gone ? 0.4 : 1 }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("booking.duration")}</label>
              <div className="flex gap-2 flex-wrap">
                {DURS.map((d) => {
                  const on = booking.dur === d;
                  return (
                    <button key={d} onClick={() => setBooking((b) => ({ ...b, dur: d }))}
                      className="flex-1 min-w-[80px] py-[11px] rounded-[10px] text-[13px] font-semibold transition hover:-translate-y-[2px]"
                      style={on
                        ? { background: "linear-gradient(150deg,var(--fill-dark),var(--fill-mid))", color: "var(--cream)", border: "1px solid var(--fill-dark)", boxShadow: "0 4px 12px rgba(43,29,23,.25)" }
                        : { background: "var(--surface)", color: "var(--coffee)", border: "1px solid var(--line)" }}>
                      {durLabel(d)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <FlowNav backTxt={t("booking.cancel")} onBack={() => nav(`/room/${room.id}`)} nextTxt={t("booking.continuePayment")} onNext={next} disabled={!booking.slot} />
        </>
      )}

      {step === 2 && (
        <>
          <div className="surface p-[26px] mb-[18px]">
            <h2 className="text-[22px] font-semibold mb-[6px]">{t("booking.step2Title")}</h2>
            <p className="text-[14px] mb-5" style={{ color: "var(--muted)" }}>{t("booking.step2Sub")}</p>

            <div className="rounded-xl p-4 px-[18px]" style={{ background: "var(--foam)", border: "1px solid var(--line)" }}>
              <SumRow l={rt.title} r={`${room.price} ${perHr}`} />
              <SumRow l={`${booking.slot} · ${durLabel(booking.dur)}`} r="" />
              <div className="flex justify-between text-[16px] font-bold pt-[13px] mt-[6px]" style={{ borderTop: "1px dashed var(--line)", color: "var(--coffee)" }}>
                <span>{t("booking.total")}</span><span>{total} {jod}</span>
              </div>
              <div className="flex justify-between py-[7px] font-bold" style={{ color: "var(--espresso)" }}>
                <span>{t("booking.payNow")}</span><span>{half} {jod}</span>
              </div>
              <SumRow l={t("booking.payArrival")} r={`${half} ${jod}`} />
            </div>

            <div className="rounded-[14px] p-5 text-center my-[18px]"
              style={{ background: "linear-gradient(155deg,#33231B,#241812)", color: "var(--cream)", boxShadow: "0 14px 36px rgba(43,29,23,.3),0 0 0 1px rgba(201,162,126,.2) inset" }}>
              <div className="text-[13px] opacity-80">{t("booking.cliqSend")}</div>
              <button onClick={copyAlias}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full transition-colors"
                style={{ background: "rgba(201,162,126,.14)", border: "1px solid rgba(201,162,126,.35)" }}>
                <span className="font-serif text-[24px] font-semibold tracking-[.06em]" style={{ color: "var(--crema)" }}>MAQAR.PAY</span>
                {copied ? <Check className="w-4 h-4" style={{ color: "var(--crema)" }} strokeWidth={3} /> : <Copy className="w-4 h-4" style={{ color: "var(--crema)" }} />}
              </button>
              <small className="opacity-70 text-[12px] block mt-2">{t("booking.cliqNote")}</small>
            </div>

            <button onClick={() => setBooking((b) => ({ ...b, proof: true }))}
              className="w-full rounded-[14px] p-7 text-center transition"
              style={booking.proof
                ? { border: "2px solid var(--good)", color: "var(--good)", background: "rgba(63,122,78,.06)" }
                : { border: "2px dashed var(--line)", color: "var(--muted)" }}>
              {booking.proof
                ? <span className="flex items-center justify-center gap-2"><Check className="w-4 h-4" strokeWidth={3} /> {t("booking.attached")}</span>
                : <span className="flex items-center justify-center gap-2"><Paperclip className="w-4 h-4" /> {t("booking.attach")}</span>}
            </button>
          </div>
          <FlowNav backTxt={t("booking.back")} onBack={() => setStep(1)} nextTxt={t("booking.confirmReq")} onNext={next} disabled={!booking.proof} />
        </>
      )}

      {step === 3 && (
        <div className="surface p-[26px] py-10 text-center">
          <div className="w-[74px] h-[74px] rounded-full grid place-items-center mx-auto mb-[18px] animate-popCheck" style={{ background: "rgba(63,122,78,.12)", color: "var(--good)" }}>
            <Check className="w-9 h-9" strokeWidth={3} />
          </div>
          <h2 className="text-[26px] mb-2 font-semibold">{t("booking.step3Title")}</h2>
          <p className="text-[14px] max-w-[420px] mx-auto mb-6" style={{ color: "var(--muted)" }}>
            {t("booking.step3Body", { host })}
          </p>
          <div className="inline-flex gap-[10px] my-[22px]" dir="ltr">
            {(matchCode || "").split("").map((d, i) => (
              <div key={i} className="code-digit w-[58px] h-[68px] rounded-[14px] text-[34px]" style={{ animation: `flipIn .5s cubic-bezier(.22,1,.36,1) ${0.25 + i * 0.1}s both` }}>{d}</div>
            ))}
          </div>
          <p className="text-[14px] max-w-[420px] mx-auto mb-6" style={{ color: "var(--muted)" }}>{t("booking.step3Private")}</p>
          <button className="btn-primary py-[13px] rounded-xl max-w-[300px] w-full mx-auto block" onClick={finish}>{t("booking.goBookings")}</button>
        </div>
      )}
    </div>
  );
}

function SumRow({ l, r }) {
  return <div className="flex justify-between text-[14px] py-[7px]" style={{ color: "var(--coffee)" }}><span>{l}</span><span>{r}</span></div>;
}

function FlowNav({ backTxt, onBack, nextTxt, onNext, disabled }) {
  return (
    <div className="flex justify-between gap-3">
      <button className="btn-soft px-[26px] py-[13px] rounded-xl text-[15px]" onClick={onBack}>{backTxt}</button>
      <button className="btn-primary px-[26px] py-[13px] rounded-xl text-[15px]" disabled={disabled} onClick={onNext}>{nextTxt}</button>
    </div>
  );
}
