import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Check } from "lucide-react";
import { roomText } from "../data/rooms.js";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";
import { canRequestAt, overlaps } from "../lib/bookingMachine.js";

const SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "14:00", "14:30", "15:00", "15:30"];
const DURS = [1, 1.5, 2, 3, 4];

const ERR_KEYS = {
  tooSoon: "booking.tooSoon",
  invalidRange: "booking.noPastDates",
  slotTaken: "booking.slotTaken",
};

export default function Booking() {
  const { id } = useParams();
  const nav = useNavigate();
  const { booking, setBooking, toast, loggedIn, accountType, authReady, pendingAction,
          requestBooking, bookedRanges, getRoom } = useApp();
  const { t, lang } = useT();
  const room = getRoom(id);
  const [step, setStep] = useState(1);
  const d = new Date();
  const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState(todayIso);
  const [ranges, setRanges] = useState([]);

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

  useEffect(() => {
    if (!room) return;
    let alive = true;
    bookedRanges(room.id).then((r) => { if (alive) setRanges(r); });
    return () => { alive = false; };
  }, [room, bookedRanges]);

  if (!authReady || !room || !loggedIn || accountType !== "user") return null;
  const rt = roomText(room, lang);
  const jod = lang === "ar" ? "د.أ" : "JOD";
  const perHr = lang === "ar" ? "د.أ/ساعة" : "JOD/hr";
  const durLabel = (d) => `${d} ${d > 1 ? t("booking.hrs") : t("booking.hr")}`;
  const host = rt.loc.split(/[,،]/)[0].trim();

  // A slot is unavailable if a booking covers ANY part of the session that
  // starting there would occupy. This is what the old `slot`-only check missed.
  const slotStart = (s) => new Date(`${date}T${s}:00`);
  const slotEnd = (s) => new Date(slotStart(s).getTime() + booking.dur * 3600 * 1000);
  const isTaken = (s) =>
    ranges.some((r) => overlaps(r.startsAt, r.endsAt, slotStart(s), slotEnd(s))) ||
    !canRequestAt(slotStart(s), new Date());

  async function next() {
    if (step === 2) {
      const startsAt = slotStart(booking.slot).toISOString();
      const endsAt = slotEnd(booking.slot).toISOString();
      const res = await requestBooking({ room, startsAt, endsAt });
      if (!res.ok) {
        toast(t(ERR_KEYS[res.error] || "booking.slotTaken"));
        setBooking((b) => ({ ...b, slot: null }));
        setStep(1);
        const fresh = await bookedRanges(room.id);
        setRanges(fresh);
        window.scrollTo(0, 0);
        return;
      }
    }
    setStep((s) => s + 1);
    window.scrollTo(0, 0);
  }
  function finish() {
    nav("/me");
    toast(t("booking.requestSent"));
  }

  const total = room.price * booking.dur;

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
              <input type="date" min={todayIso} value={date} onChange={(e) => { setDate(e.target.value); setBooking((b) => ({ ...b, slot: null })); }} className="field-input" />
            </div>

            <div className="mb-4">
              <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("booking.startTime")}</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {SLOTS.map((s) => {
                  const gone = isTaken(s);
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
            <h2 className="text-[22px] font-semibold mb-[6px]">{t("booking.step2TitleReview")}</h2>
            <p className="text-[14px] mb-5" style={{ color: "var(--muted)" }}>{t("booking.step2SubReview")}</p>
            <div className="rounded-xl p-4 px-[18px]" style={{ background: "var(--foam)", border: "1px solid var(--line)" }}>
              <SumRow l={rt.title} r={`${room.price} ${perHr}`} />
              <SumRow l={`${booking.slot} · ${durLabel(booking.dur)}`} r="" />
              <div className="flex justify-between text-[16px] font-bold pt-[13px] mt-[6px]"
                style={{ borderTop: "1px dashed var(--line)", color: "var(--coffee)" }}>
                <span>{t("booking.total")}</span><span>{total} {jod}</span>
              </div>
            </div>
          </div>
          <FlowNav backTxt={t("booking.back")} onBack={() => setStep(1)} nextTxt={t("booking.sendRequest")} onNext={next} />
        </>
      )}

      {step === 3 && (
        <div className="surface p-[26px] py-10 text-center">
          <div className="w-[74px] h-[74px] rounded-full grid place-items-center mx-auto mb-[18px] animate-popCheck" style={{ background: "rgba(63,122,78,.12)", color: "var(--good)" }}>
            <Check className="w-9 h-9" strokeWidth={3} />
          </div>
          <h2 className="text-[26px] mb-2 font-semibold">{t("booking.requested")}</h2>
          <p className="text-[14px] max-w-[420px] mx-auto mb-6" style={{ color: "var(--muted)" }}>
            {t("booking.requestedBody", { host })}
          </p>
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
