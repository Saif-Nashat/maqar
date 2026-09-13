import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Clock, CalendarDays } from "lucide-react";
import { ROOMS, roomText } from "../data/rooms.js";
import { SEED_AGENDA } from "../data/seed.js";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";
import ListingCard from "../components/ListingCard.jsx";
import { useRequireAccount } from "../lib/guards.jsx";

const REVENUE_7D = [86, 104, 72, 128, 96, 140, 128]; // last 7 days (JOD)

function useCountUp(to, run) {
  const [val, setVal] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!run) return;
    const dur = 900, t0 = performance.now();
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [to, run]);
  return val;
}

const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
const PATTERN = [
  [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

export default function HostDash() {
  const nav = useNavigate();
  const { openModal, toast, myListings, rooms, account, isLiveBackend, bookings: liveBookings, updateBooking, getRoom } = useApp();
  const { t, lang } = useT();
  const blocked = useRequireAccount("host");
  const hostRooms = isLiveBackend
    ? rooms.filter((r) => r.host_id && r.host_id === account?.id).map((r) => ({ ...r, name: r.title }))
    : myListings;
  const [tab, setTab] = useState("requests");
  const rev = useCountUp(128, true);
  const conf = useCountUp(7, true);
  const occ = useCountUp(68, true);

  const [reqs, setReqs] = useState([
    { key: "r1", room: ROOMS[1], who: "M. Khaled", when: `${t("when.today")} · 16:30–18:00`, sk: "AwaitingYou", code: null },
    { key: "r2", room: ROOMS[0], who: "S. Odeh", when: `${t("when.tomorrow")} · 09:00–11:00`, sk: "AwaitingYou", code: null },
    { key: "r3", room: ROOMS[4], who: "L. Nasser", when: `${t("when.today")} · 14:00–16:00`, sk: "Approved", code: "3607" },
  ]);
  const [verifyVal, setVerifyVal] = useState("");

  // live requests: bookings for this host's rooms (RLS already scopes to them)
  const liveReqs = liveBookings
    .map((b) => ({
      key: b.id, id: b.id, room: b.room || getRoom(b.roomId), who: t("nav.guestBadge"),
      when: `${b.date} · ${b.slot} · ${b.dur}h`,
      sk: b.status === "PendingHost" ? "AwaitingYou" : b.status === "Confirmed" ? "Approved" : b.status === "Denied" ? "Denied" : b.status,
      code: b.code, sent: b.status === "Confirmed", denied: b.status === "Denied",
    }))
    .filter((r) => r.room);
  const reqList = isLiveBackend ? liveReqs : reqs;

  function approve(key) {
    if (isLiveBackend) {
      const b = liveBookings.find((x) => x.id === key);
      const code = b?.code || String(Math.floor(1000 + Math.random() * 9000));
      updateBooking(key, { status: "Confirmed", code }).then(() => toast(t("hd.approveToast")));
      return;
    }
    const code = String(Math.floor(1000 + Math.random() * 9000));
    setReqs((rs) => rs.map((r) => r.key === key ? { ...r, sk: "Approved", code, sent: true } : r));
    toast(t("hd.approveToast"));
  }
  function deny(key) {
    if (isLiveBackend) {
      openModal({
        title: t("hd.denyTitle"), msg: t("hd.denyMsg"), okTxt: t("hd.denyConfirm"), variant: "bad", textarea: true,
        onConfirm: async () => { await updateBooking(key, { status: "Denied" }); toast(t("hd.denyToast")); },
      });
      return;
    }
    openModal({
      title: t("hd.denyTitle"), msg: t("hd.denyMsg"), okTxt: t("hd.denyConfirm"), variant: "bad", textarea: true,
      onConfirm: (text) => {
        const reason = (text || "").trim() || t("hd.reasonNone");
        setReqs((rs) => rs.map((r) => r.key === key ? { ...r, sk: "Denied", reason, denied: true } : r));
        toast(t("hd.denyToast"));
      },
    });
  }
  function verify() {
    if (verifyVal.length === 4) toast(t("hd.verifiedToast"));
    else toast(t("hd.enterFull"));
  }

  const statusCls = (sk) => sk === "Approved" ? "st-confirmed" : sk === "Denied" ? "st-pending" : "st-pending";

  if (blocked) return null;

  return (
    <div className="wrap pt-[26px] pb-[50px]">
      <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-.5px] title-rule">{t("hd.title")}</h1>
          <p className="text-[14px] mt-2" style={{ color: "var(--muted)" }}>{t("hd.sub")}</p>
        </div>
        <button className="btn-primary px-[18px] py-[9px] rounded-full text-[14px] flex items-center gap-1" onClick={() => nav("/host/new")}>
          <Plus className="w-4 h-4" /> {t("hd.listNew")}
        </button>
      </div>

      {hostRooms.length > 0 && (
        <div className="mb-7">
          <h2 className="text-[18px] font-semibold mb-3 flex items-center gap-2">
            {t("list.yourListings")}
            <span className="text-[12px] font-bold px-2 py-[2px] rounded-full" style={{ background: "var(--foam)", color: "var(--coffee)", border: "1px solid var(--line)" }}>{hostRooms.length}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {hostRooms.map((l) => <ListingCard key={l.id} listing={l} t={t} lang={lang} variant="dash" />)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-[26px]">
        <Stat lbl={t("hd.revenue")} num={rev} unit={lang === "ar" ? "د.أ" : "JOD"} delta={t("hd.revenueDelta")} />
        <Stat lbl={t("hd.confirmed")} num={conf} unit={t("hd.confirmedUnit")} delta={t("hd.confirmedDelta")} />
        <Stat lbl={t("hd.occupancy")} num={occ} unit="%" delta={t("hd.occDelta")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-[22px]">
        <div>
          <div className="flex gap-2 mb-[18px]" style={{ borderBottom: "1px solid var(--line)" }}>
            {[["requests", t("hd.tabRequests")], ["agenda", t("hd.tabAgenda")], ["arrivals", t("hd.tabArrivals")]].map(([v, label]) => {
              const on = tab === v;
              return (
                <button key={v} onClick={() => setTab(v)} className="py-[10px] mx-[9px] text-[14px] font-semibold transition-colors"
                  style={{ color: on ? "var(--espresso)" : "var(--muted)", borderBottom: `2px solid ${on ? "var(--crema)" : "transparent"}` }}>
                  {label}
                </button>
              );
            })}
          </div>

          {tab === "requests" && isLiveBackend && reqList.length === 0 && (
            <div className="surface p-8 text-center text-[14px]" style={{ color: "var(--muted)" }}>{t("hd.noAgenda")}</div>
          )}
          {tab === "requests" && reqList.map((r) => {
            const rt = roomText(r.room, lang);
            return (
              <div key={r.key} className="surface p-4 mb-[14px] flex gap-[15px] items-center" style={{ animation: "biIn .5s cubic-bezier(.22,1,.36,1) both" }}>
                <img src={r.room.imgs[0]} alt="" className="w-[84px] h-16 object-cover rounded-[10px]" />
                <div className="flex-1">
                  <h4 className="font-sans text-[15px] font-bold">{rt.title}</h4>
                  <div className="text-[13px] mt-[2px]" style={{ color: "var(--muted)" }}>
                    {r.who} · {r.when}
                    {r.reason && <em style={{ color: "var(--bad)" }}> · {t("hd.reason")}: {r.reason}</em>}
                  </div>
                  <span className={`status ${statusCls(r.sk)} mt-[6px]`}>{t(`st.${r.sk}`)}</span>
                  {r.code && (
                    <div className="flex items-center gap-[6px] mt-[9px] flex-wrap">
                      <span className="eyebrow" style={{ marginInlineEnd: 2 }}>{t("hd.bookerCode")}</span>
                      <span dir="ltr" className="inline-flex gap-[6px]">{r.code.split("").map((d, i) => <span key={i} className="code-digit w-[26px] h-[32px] rounded-[7px] text-[16px]">{d}</span>)}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-[6px]">
                  {r.sent ? <span className="text-[12px] font-bold" style={{ color: "var(--good)" }}>✓ {t("hd.codeSent")}</span>
                    : r.denied ? <span className="text-[12px] font-bold" style={{ color: "var(--bad)" }}>{t("hd.bookerNotified")}</span>
                    : r.sk === "AwaitingYou" ? (
                      <>
                        <button onClick={() => approve(r.key)} className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold text-white" style={{ background: "var(--good)" }}>{t("hd.approve")}</button>
                        <button onClick={() => deny(r.key)} className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold" style={{ background: "var(--foam)", color: "var(--bad)", border: "1px solid var(--line)" }}>{t("hd.deny")}</button>
                      </>
                    ) : (
                      <button onClick={() => deny(r.key)} className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold" style={{ background: "var(--foam)", color: "var(--bad)", border: "1px solid var(--line)" }}>{t("hd.cancel")}</button>
                    )}
                </div>
              </div>
            );
          })}

          {tab === "agenda" && <Agenda lang={lang} t={t} />}

          {tab === "arrivals" && (
            <div className="surface p-[26px]">
              <h2 className="text-[18px] font-semibold mb-[6px]">{t("hd.verifyTitle")}</h2>
              <p className="text-[14px] mb-5" style={{ color: "var(--muted)" }}>{t("hd.verifySub")}</p>
              <div className="flex gap-[15px] items-center mb-4">
                <img src={ROOMS[4].imgs[0]} alt="" className="w-[84px] h-16 object-cover rounded-[10px]" />
                <div className="flex-1">
                  <h4 className="font-sans text-[15px] font-bold">{roomText(ROOMS[4], lang).title}</h4>
                  <div className="text-[13px] mt-[2px]" style={{ color: "var(--muted)" }}>L. Nasser · 14:00–16:00</div>
                  <span className="status st-upcoming mt-[6px]">{t("st.ExpectedNow")}</span>
                  <div className="flex items-center gap-[6px] mt-[9px] flex-wrap">
                    <span className="eyebrow" style={{ marginInlineEnd: 2 }}>{t("hd.codeOnFile")}</span>
                    <span dir="ltr" className="inline-flex gap-[6px]">{"3607".split("").map((d, i) => <span key={i} className="code-digit w-[26px] h-[32px] rounded-[7px] text-[16px]">{d}</span>)}</span>
                  </div>
                </div>
              </div>
              <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("hd.enterCode")}</label>
              <input value={verifyVal} onChange={(e) => setVerifyVal(e.target.value.replace(/\D/g, ""))} maxLength={4} placeholder={t("hd.fourDigits")} dir="ltr"
                className="field-input text-center text-[22px] font-bold tracking-[8px] mb-4" />
              <button className="btn-primary w-full py-[13px] rounded-xl text-[15px]" onClick={verify}>{t("hd.verifyArrival")}</button>
            </div>
          )}
        </div>

        <div>
          <div className="surface p-5 mb-[18px]">
            <h3 className="font-sans text-[15px] font-bold mb-[14px]">{t("hd.revenue7")}</h3>
            <RevenueChart data={REVENUE_7D} unit={lang === "ar" ? "د.أ" : "JOD"} />
          </div>

          <div className="surface p-5 mb-[18px]">
            <h3 className="font-sans text-[15px] font-bold mb-[14px]">{t("hd.occToday")}</h3>
            <div className="flex flex-col gap-[6px]">
              {HOURS.map((h, i) => (
                <div key={h} className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold w-[46px]" style={{ color: "var(--muted)" }} dir="ltr">{h}</span>
                  <div className="flex-1 flex gap-[3px]">
                    {PATTERN[i].map((c, j) => (
                      <div key={j} className="flex-1 h-[18px] rounded-[4px]"
                        style={{ background: c === 1 ? "var(--crema)" : c === 2 ? "var(--fill-mid)" : "var(--foam)", animation: "cellIn .5s var(--ease) both" }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-[14px] mt-[14px] text-[12px]" style={{ color: "var(--muted)" }}>
              <span className="flex items-center gap-1"><span className="inline-block w-[11px] h-[11px] rounded-[3px]" style={{ background: "var(--crema)" }} /> {t("hd.booked")}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-[11px] h-[11px] rounded-[3px]" style={{ background: "var(--foam)", border: "1px solid var(--line)" }} /> {t("hd.open")}</span>
            </div>
          </div>

          <div className="surface p-5">
            <h3 className="font-sans text-[15px] font-bold mb-[14px]">{t("hd.lateNotifs")}</h3>
            <div className="flex gap-[10px] p-[11px] rounded-xl mb-[10px]" style={{ background: "rgba(192,134,59,.08)", border: "1px solid var(--line)" }}>
              <Clock className="w-[18px] h-[18px] shrink-0" style={{ color: "var(--warn)" }} />
              <div className="text-[13px]">
                {t("hd.lateItem", { who: "L. Nasser", room: roomText(ROOMS[4], lang).title })}
                <div className="text-[12px] mt-[2px]" style={{ color: "var(--muted)" }}>{t("hd.minutesAgo")}</div>
              </div>
            </div>
            <div className="text-[13px] text-center py-2" style={{ color: "var(--muted)" }}>{t("hd.noOther")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ lbl, num, unit, delta }) {
  return (
    <div className="surface card-hover p-5 relative overflow-hidden">
      <div className="eyebrow mb-2">{lbl}</div>
      <div className="font-serif text-[32px] font-semibold" style={{ color: "var(--espresso)" }}>
        {num}<small className="font-sans text-[14px] font-medium mx-1" style={{ color: "var(--muted)" }}>{unit}</small>
      </div>
      <div className="text-[12px] font-semibold mt-1" style={{ color: "var(--good)" }}>{delta}</div>
    </div>
  );
}

function RevenueChart({ data, unit }) {
  const max = Math.max(...data);
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div>
      <div className="flex items-end gap-[6px] h-[120px]">
        {data.map((v, i) => {
          const last = i === data.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-[6px] h-full">
              <span className="text-[10px] font-bold" style={{ color: last ? "var(--espresso)" : "var(--muted)" }}>{v}</span>
              <div className="w-full rounded-t-[5px] transition-all" title={`${v} ${unit}`}
                style={{
                  height: `${Math.max(8, (v / max) * 88)}%`,
                  background: last ? "linear-gradient(180deg,var(--crema),var(--fill-mid))" : "var(--foam)",
                  border: "1px solid var(--line)",
                  animation: "cellIn .5s var(--ease) both",
                }} />
              <span className="text-[10px]" style={{ color: "var(--muted)" }}>{days[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Agenda({ lang, t }) {
  // group seeded agenda by date
  const byDate = SEED_AGENDA.reduce((acc, a) => { (acc[a.date] ||= []).push(a); return acc; }, {});
  const dates = Object.keys(byDate).sort();
  if (!dates.length) return <div className="surface p-8 text-center text-[14px]" style={{ color: "var(--muted)" }}>{t("hd.noAgenda")}</div>;
  return (
    <div className="flex flex-col gap-5">
      <h3 className="font-sans text-[15px] font-bold flex items-center gap-2"><CalendarDays className="w-[18px] h-[18px]" style={{ color: "var(--crema)" }} /> {t("hd.upcoming")}</h3>
      {dates.map((d) => (
        <div key={d}>
          <div className="eyebrow mb-2" dir="ltr">{d}</div>
          <div className="surface overflow-hidden">
            {byDate[d].map((a, i) => {
              const room = ROOMS.find((r) => r.id === a.roomId);
              const rt = room ? roomText(room, lang) : { title: "—" };
              return (
                <div key={a.id} className="flex items-center gap-3 p-4" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <div className="text-center shrink-0 w-[64px]" dir="ltr">
                    <div className="font-serif text-[16px] font-semibold" style={{ color: "var(--espresso)" }}>{a.start}</div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>{a.end}</div>
                  </div>
                  <div className="w-[2px] self-stretch rounded-full" style={{ background: "var(--crema)" }} />
                  <img src={room?.imgs?.[0]} alt="" className="w-[52px] h-[44px] object-cover rounded-[10px] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-sans text-[14px] font-bold truncate">{rt.title}</div>
                    <div className="text-[12px]" style={{ color: "var(--muted)" }}>{a.who}</div>
                  </div>
                  <span className="status st-confirmed">{t("st.Confirmed")}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
