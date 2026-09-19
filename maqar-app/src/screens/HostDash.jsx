import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { roomText } from "../data/rooms.js";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";
import ListingCard from "../components/ListingCard.jsx";
import { useRequireAccount } from "../lib/guards.jsx";
import { STATUS, COMMISSION_RATE } from "../lib/bookingMachine.js";

// Requested/Approved read as "still moving" (warm/pending); Confirmed reads as settled
// (green) — mirrors the chip logic UserDash uses for the guest-facing equivalent.
function statusCls(status) {
  if (status === STATUS.CONFIRMED) return "st-confirmed";
  if (status === STATUS.REQUESTED || status === STATUS.APPROVED) return "st-pending";
  return null;
}

function formatWhen(startsAt, endsAt, lang) {
  const locale = lang === "ar" ? "ar" : undefined;
  const day = new Date(startsAt).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const start = new Date(startsAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const end = new Date(endsAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${start}–${end}`;
}

export default function HostDash() {
  const nav = useNavigate();
  const { openModal, toast, myListings, rooms, account, isLiveBackend, getRoom,
          bookings, approveBooking, denyBooking, validateArrivalCode } = useApp();
  const { t, lang } = useT();
  const blocked = useRequireAccount("host");

  // The demo seed rooms in src/data/rooms.js carry no host_id at all, so a demo host's
  // listings still have to come from myListings — only live rooms carry a real host_id.
  const hostRooms = isLiveBackend
    ? rooms.filter((r) => r.host_id && r.host_id === account?.id).map((r) => ({ ...r, name: r.title }))
    : myListings;

  const [tab, setTab] = useState("requests");
  const [arrivalId, setArrivalId] = useState("");
  const [verifyVal, setVerifyVal] = useState("");

  const requests = bookings
    .map((b) => ({ ...b, room: b.room || getRoom(b.roomId) }))
    .filter((b) => b.room && [STATUS.REQUESTED, STATUS.APPROVED, STATUS.CONFIRMED].includes(b.status));

  async function approve(id) {
    const res = await approveBooking(id);
    // approveBooking's error is either a raw Postgres message (live) or a plain English
    // sentence (demo) — never a translated key, so it must never be shown directly.
    toast(res.ok ? t("hd.approveToast") : t("hd.approveFailed"));
  }

  function deny(id) {
    openModal({
      title: t("hd.denyTitle"), msg: t("hd.denyMsg"), okTxt: t("hd.denyConfirm"),
      variant: "bad", textarea: true,
      onConfirm: async (text) => {
        const res = await denyBooking(id, text);
        toast(res.ok ? t("hd.denyToast") : t("hd.denyFailed"));
      },
    });
  }

  async function checkIn() {
    const res = await validateArrivalCode(arrivalId, verifyVal);
    toast(res.ok ? t("hd.checkedIn") : t("hd.codeWrong"));
    if (res.ok) { setVerifyVal(""); setArrivalId(""); }
  }

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

      <div className="flex gap-2 mb-[18px]" style={{ borderBottom: "1px solid var(--line)" }}>
        {[["requests", t("hd.tabRequests")], ["arrivals", t("hd.tabArrivals")]].map(([v, label]) => {
          const on = tab === v;
          return (
            <button key={v} onClick={() => setTab(v)} className="py-[10px] mx-[9px] text-[14px] font-semibold transition-colors"
              style={{ color: on ? "var(--espresso)" : "var(--muted)", borderBottom: `2px solid ${on ? "var(--crema)" : "transparent"}` }}>
              {label}
            </button>
          );
        })}
      </div>

      {tab === "requests" && (
        requests.length ? requests.map((b) => {
          const rt = roomText(b.room, lang);
          return (
            <div key={b.id} className="surface p-4 mb-[14px] flex gap-[15px] items-center" style={{ animation: "biIn .5s cubic-bezier(.22,1,.36,1) both" }}>
              <img src={b.room.imgs[0]} alt="" className="w-[84px] h-16 object-cover rounded-[10px]" />
              <div className="flex-1">
                <h4 className="font-sans text-[15px] font-bold">{rt.title}</h4>
                <div className="text-[13px] mt-[2px]" style={{ color: "var(--muted)" }}>{formatWhen(b.startsAt, b.endsAt, lang)}</div>
                <span className={`status ${statusCls(b.status) || ""} mt-[6px]`}>{t(`st.${b.status}`)}</span>
                {b.status === STATUS.APPROVED && (
                  <div className="text-[12px] font-semibold mt-[6px]" style={{ color: "var(--warn)" }}>{t("hd.awaitingPayment")}</div>
                )}
                <div className="text-[12px] font-semibold mt-[6px]" style={{ color: "var(--good)" }}>
                  {t("hd.yourPayout", {
                    amount: (b.hostPayoutAmount != null
                      ? b.hostPayoutAmount
                      : b.total * (1 - (b.commissionRate ?? COMMISSION_RATE))
                    ).toFixed(2),
                  })}
                </div>
              </div>
              {b.status === STATUS.REQUESTED && (
                <div className="flex flex-col gap-[6px]">
                  <button onClick={() => approve(b.id)} className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold text-white" style={{ background: "var(--good)" }}>{t("hd.approve")}</button>
                  <button onClick={() => deny(b.id)} className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold" style={{ background: "var(--foam)", color: "var(--bad)", border: "1px solid var(--line)" }}>{t("hd.deny")}</button>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="surface p-8 text-center text-[14px]" style={{ color: "var(--muted)" }}>{t("hd.noRequests")}</div>
        )
      )}

      {tab === "arrivals" && (() => {
        const arrivals = requests.filter((b) => b.status === STATUS.CONFIRMED);
        if (!arrivals.length) return <div className="surface p-8 text-center text-[14px]" style={{ color: "var(--muted)" }}>{t("hd.noArrivals")}</div>;
        return (
          <div className="surface p-[26px]">
            <h2 className="text-[18px] font-semibold mb-[6px]">{t("hd.checkInTitle")}</h2>
            <p className="text-[14px] mb-5" style={{ color: "var(--muted)" }}>{t("hd.checkInSub")}</p>
            <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("hd.pickBooking")}</label>
            <select value={arrivalId} onChange={(e) => setArrivalId(e.target.value)} className="field-input mb-4">
              <option value="">—</option>
              {arrivals.map((b) => (
                <option key={b.id} value={b.id}>
                  {roomText(b.room, lang).title} · {formatWhen(b.startsAt, b.endsAt, lang)}
                </option>
              ))}
            </select>
            <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("hd.enterCode")}</label>
            <input value={verifyVal} onChange={(e) => setVerifyVal(e.target.value.replace(/\D/g, ""))}
              maxLength={4} placeholder={t("hd.fourDigits")} dir="ltr"
              className="field-input text-center text-[22px] font-bold tracking-[8px] mb-4" />
            <button className="btn-primary w-full py-[13px] rounded-xl text-[15px]" onClick={checkIn}
              disabled={!arrivalId || verifyVal.length !== 4}>{t("hd.verifyArrival")}</button>
          </div>
        );
      })()}
    </div>
  );
}
