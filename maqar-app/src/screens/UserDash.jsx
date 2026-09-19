import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MapPin, KeyRound, Wallet, Receipt, Heart } from "lucide-react";
import { roomText } from "../data/rooms.js";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";
import { useRequireAccount } from "../lib/guards.jsx";
import { STATUS, refundAmount, REFUND_POLICY } from "../lib/bookingMachine.js";

export default function UserDash() {
  const nav = useNavigate();
  const { openModal, toast, setCurrentRoom, resetBooking, favorites, payments, getRoom,
          bookings, cancelBooking, arrivalCodeFor } = useApp();
  const { t, lang } = useT();
  const blocked = useRequireAccount("user");
  const [tab, setTab] = useState("bookings");

  const jod = lang === "ar" ? "د.أ" : "JOD";
  const favRooms = favorites.map((id) => getRoom(id)).filter(Boolean);

  const rows = bookings
    .map((b) => ({ ...b, room: b.room || getRoom(b.roomId) }))
    .filter((b) => b.room);

  const [codes, setCodes] = useState({});
  const codeKey = rows.filter((b) => b.status === STATUS.CONFIRMED).map((b) => b.id).join(",");
  useEffect(() => {
    let alive = true;
    const ids = codeKey ? codeKey.split(",") : [];
    Promise.all(ids.map(async (id) => [id, await arrivalCodeFor(id)]))
      .then((pairs) => { if (alive) setCodes(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [codeKey, arrivalCodeFor]);

  function bookAgain(room) { setCurrentRoom(room); resetBooking(); nav(`/book/${room.id}`); }

  function confirmCancel(b) {
    const refund = b.status === STATUS.CONFIRMED
      ? refundAmount(b.total, b.startsAt, new Date(), b.refundPolicy || REFUND_POLICY)
      : 0;
    openModal({
      title: t("ud.cancelTitle"),
      msg: `${t("ud.cancelMsg")}${b.status === STATUS.CONFIRMED ? " " + t("ud.refundNote", { amount: refund }) : ""}`,
      cancelTxt: t("ud.keepBooking"), okTxt: t("ud.cancelBooking"), variant: "bad",
      onConfirm: async () => {
        const res = await cancelBooking(b.id);
        // cancelBooking's error is either a raw Postgres message (live) or a plain
        // English sentence (demo) — never a translated code, so it must never be
        // shown directly. Fall back to a generic, translated message instead.
        toast(res.ok ? t("ud.cancelledToast") : t("ud.cancelFailed"));
      },
    });
  }

  if (blocked) return null;

  return (
    <div className="wrap pt-[26px] pb-[50px]">
      <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-.5px] title-rule">{t("ud.title")}</h1>
          <p className="text-[14px] mt-2" style={{ color: "var(--muted)" }}>{t("ud.sub")}</p>
        </div>
        <button className="btn-primary px-[18px] py-[9px] rounded-full text-[14px] flex items-center gap-1" onClick={() => nav("/")}>
          <Plus className="w-4 h-4" /> {t("ud.bookAnother")}
        </button>
      </div>

      <Tabbar tabs={[["bookings", t("ud.tabBookings")], ["favorites", t("ud.tabFavorites")], ["payments", t("ud.tabPayments")]]} tab={tab} setTab={setTab} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-[22px]">
        <div>
          {tab === "bookings" && (rows.length ? rows.map((b) => (
            <BookingItem key={b.id} b={b} code={codes[b.id]} t={t} lang={lang}
              onPay={() => nav(`/pay/${b.id}`)}
              onCancel={() => confirmCancel(b)} />
          )) : (
            <div className="surface p-8 text-center text-[14px]" style={{ color: "var(--muted)" }}>{t("ud.noBookings")}</div>
          ))}

          {tab === "favorites" && (
            favRooms.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
                {favRooms.map((r) => <FavCard key={r.id} room={r} t={t} lang={lang} jod={jod} onBook={() => bookAgain(r)} onOpen={() => { setCurrentRoom(r); nav(`/room/${r.id}`); }} />)}
              </div>
            ) : (
              <div className="surface p-8 text-center text-[14px]" style={{ color: "var(--muted)" }}>
                <Heart className="w-7 h-7 mx-auto mb-2 opacity-50" />
                {t("home.noMatch")}
              </div>
            )
          )}

          {tab === "payments" && <Payments payments={payments} jod={jod} t={t} lang={lang} getRoom={getRoom} />}
        </div>

        <div>
          <div className="surface p-5">
            <h3 className="font-sans text-[15px] font-bold mb-[14px]">{t("ud.arrivalCodesTitle")}</h3>
            <div className="flex gap-[11px] items-start">
              <div className="w-[38px] h-[38px] rounded-[10px] grid place-items-center shrink-0" style={{ background: "var(--fill-dark)", color: "var(--cream)" }}>
                <KeyRound className="w-[18px] h-[18px]" />
              </div>
              <p className="text-[13px] leading-[1.55]" style={{ color: "var(--muted)" }}>{t("ud.arrivalCodesBody")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tabbar({ tabs, tab, setTab }) {
  return (
    <div className="flex gap-2 mb-[18px]" style={{ borderBottom: "1px solid var(--line)" }}>
      {tabs.map(([v, label]) => {
        const on = tab === v;
        return (
          <button key={v} onClick={() => setTab(v)} className="py-[10px] mx-[9px] text-[14px] font-semibold transition-colors"
            style={{ color: on ? "var(--espresso)" : "var(--muted)", borderBottom: `2px solid ${on ? "var(--crema)" : "transparent"}` }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function CodeDigits({ code }) {
  return <span dir="ltr" className="inline-flex gap-[6px]">{code.split("").map((d, i) => <span key={i} className="code-digit w-[26px] h-[32px] rounded-[7px] text-[16px]">{d}</span>)}</span>;
}

// Requested/Approved read as "still moving" (warm/pending); Confirmed/Completed read as
// settled (green). Denied/Expired/NoShow/Cancelled* have no dedicated chip class, so they
// fall back to an inline "bad"-toned style below rather than borrowing an unrelated color.
function statusCls(status) {
  if (status === STATUS.CONFIRMED || status === STATUS.COMPLETED) return "st-confirmed";
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

function BookingItem({ b, code, t, lang, onPay, onCancel }) {
  const rt = roomText(b.room, lang);
  const when = formatWhen(b.startsAt, b.endsAt, lang);
  const cls = statusCls(b.status);
  const deadline = b.status === STATUS.APPROVED && b.paymentDeadline
    ? new Date(b.paymentDeadline).toLocaleTimeString(lang === "ar" ? "ar" : undefined, { hour: "2-digit", minute: "2-digit" })
    : null;
  const canCancel = [STATUS.REQUESTED, STATUS.APPROVED, STATUS.CONFIRMED].includes(b.status);

  return (
    // Below sm this stacks into two rows so the action buttons always have room, instead of
    // one rigid row that used to slice buttons off the right edge at 375px. Desktop is a
    // single row via sm:flex-row / sm:contents below.
    <div className="surface p-4 mb-[14px] flex flex-col sm:flex-row gap-[12px] sm:gap-[15px] sm:items-center"
      style={{ animation: "biIn .5s cubic-bezier(.22,1,.36,1) both" }}>
      <div className="flex gap-[12px] sm:gap-[15px] items-center flex-1 min-w-0">
        <img src={b.room.imgs[0]} alt="" className="w-[72px] h-[56px] sm:w-[84px] sm:h-16 object-cover rounded-[10px] shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-sans text-[15px] font-bold">{rt.title}</h4>
          <div className="text-[13px] mt-[2px]" style={{ color: "var(--muted)" }}>{rt.loc} · {when}</div>
          <span className={`status ${cls || ""} mt-[6px]`} style={cls ? undefined : { background: "var(--foam)", color: "var(--bad)" }}>
            {t(`st.${b.status}`)}
          </span>

          {b.status === STATUS.DENIED && b.denialReason && (
            <div className="text-[12px] italic mt-[6px]" style={{ color: "var(--bad)" }}>
              {t("ud.deniedReason", { reason: b.denialReason })}
            </div>
          )}
          {deadline && (
            <div className="text-[12px] mt-[6px]" style={{ color: "var(--warn)" }}>{t("pay.deadline", { time: deadline })}</div>
          )}
          {b.status === STATUS.CONFIRMED && code && (
            <div className="flex items-center gap-[6px] mt-[9px] flex-wrap">
              <span className="eyebrow" style={{ marginInlineEnd: 2 }}>{t("ud.arrivalCode")}</span><CodeDigits code={code} />
            </div>
          )}
        </div>
      </div>

      {/* sm:contents dissolves this wrapper on desktop, so the buttons become direct
          children of the row again and stack vertically via sm:flex-col below. */}
      <div className="flex items-center justify-end gap-[12px] sm:contents">
        <div className="flex sm:flex-col gap-[6px] shrink-0">
          {b.status === STATUS.APPROVED && (
            <button onClick={onPay}
              className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold text-white whitespace-nowrap"
              style={{ background: "var(--good)" }}>{t("ud.payNow")}</button>
          )}
          {canCancel && (
            <button onClick={onCancel}
              className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold whitespace-nowrap"
              style={{ background: "var(--foam)", color: "var(--bad)", border: "1px solid var(--line)" }}>{t("ud.cancel")}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function FavCard({ room, onBook, onOpen, t, lang, jod }) {
  const rt = roomText(room, lang);
  return (
    <div className="surface card-hover overflow-hidden flex flex-col group">
      <div className="relative h-[172px] overflow-hidden cursor-pointer" onClick={onOpen}>
        <img src={room.imgs[0]} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {room.verified && <div className="verify-badge top-[10px] left-[10px]">✓ {t("common.verified")}</div>}
        <div className="price-badge absolute bottom-[10px] right-[10px]">{room.price} {jod}<small className="font-normal opacity-70">{lang === "ar" ? "/ساعة" : "/hr"}</small></div>
      </div>
      <div className="p-[15px] flex flex-col gap-2">
        <h3 className="font-sans text-[16px] font-bold cursor-pointer" onClick={onOpen}>{rt.title}</h3>
        <div className="flex items-center gap-[5px] text-[13px]" style={{ color: "var(--muted)" }}><MapPin className="w-[14px] h-[14px]" /> {rt.loc}</div>
        <button className="btn-primary py-[10px] rounded-[10px] text-[13px]" onClick={onBook}>{t("common.bookNow")}</button>
      </div>
    </div>
  );
}

function Payments({ payments, jod, t, lang, getRoom }) {
  const total = payments.reduce((a, p) => a + p.amount, 0);
  if (!payments.length) return <div className="surface p-8 text-center text-[14px]" style={{ color: "var(--muted)" }}>{t("wallet.empty")}</div>;
  return (
    <div>
      <div className="surface p-5 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[42px] h-[42px] rounded-[12px] grid place-items-center" style={{ background: "var(--fill-dark)", color: "var(--cream)" }}><Wallet className="w-5 h-5" /></div>
          <div>
            <div className="eyebrow">{t("wallet.totalPaid")}</div>
            <div className="font-serif text-[26px] font-semibold" style={{ color: "var(--espresso)" }}>{total} <span className="text-[15px]" style={{ color: "var(--muted)" }}>{jod}</span></div>
          </div>
        </div>
      </div>
      <div className="surface overflow-hidden">
        {payments.map((p, i) => {
          const room = getRoom(p.roomId);
          const rt = room ? roomText(room, lang) : { title: "—" };
          return (
            <div key={p.id} className="flex items-center gap-3 p-4" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
              <div className="w-[38px] h-[38px] rounded-[10px] grid place-items-center shrink-0" style={{ background: "var(--foam)", color: "var(--coffee)" }}><Receipt className="w-[18px] h-[18px]" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-sans text-[14px] font-bold truncate">{rt.title}</div>
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>{p.label} · {p.method} · {p.date}</div>
              </div>
              <div className="text-end">
                <div className="font-bold text-[15px]" style={{ color: "var(--espresso)" }}>{p.amount} {jod}</div>
                <span className="status st-confirmed mt-[2px]">{t("wallet.paid")}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
