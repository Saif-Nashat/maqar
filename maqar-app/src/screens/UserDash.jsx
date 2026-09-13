import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MapPin, KeyRound, GraduationCap, Wallet, Receipt, Heart } from "lucide-react";
import { ROOMS, roomText } from "../data/rooms.js";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";
import { useRequireAccount } from "../lib/guards.jsx";

export default function UserDash() {
  const nav = useNavigate();
  const { matchCode, openModal, toast, setCurrentRoom, resetBooking, favorites, payments, getRoom, bookings: liveBookings, updateBooking, isLiveBackend } = useApp();
  const { t, lang } = useT();
  const blocked = useRequireAccount("user");
  const [tab, setTab] = useState("bookings");
  const [cancelled, setCancelled] = useState({});

  const jod = lang === "ar" ? "د.أ" : "JOD";
  const favRooms = favorites.map((id) => getRoom(id)).filter(Boolean);
  const liveCode = matchCode || "4821";
  const demoBookings = [
    { key: "b1", room: ROOMS[0], when: `${t("when.today")} · 14:00–16:00`, sk: "Confirmed", timer: "1h 42m", timerLbl: t("ud.left"), code: liveCode },
    { key: "b2", room: ROOMS[4], when: `${t("when.tomorrow")} · 10:00–11:30`, sk: "Upcoming", timer: t("when.startsIn", { h: 19 }), timerLbl: t("ud.untilStart"), code: "3607" },
    { key: "b3", room: ROOMS[1], when: `${t("when.awaitingAt")} 16:30`, sk: "PendingHost", timer: "—", timerLbl: "", code: null },
  ];
  const bookings = isLiveBackend
    ? liveBookings.map((b) => ({ key: b.id, id: b.id, room: b.room || getRoom(b.roomId), when: `${b.date} · ${b.slot} · ${b.dur}h`, sk: b.status, timer: "—", timerLbl: "", code: b.code })).filter((b) => b.room)
    : demoBookings;

  function bookAgain(room) { setCurrentRoom(room); resetBooking(); nav(`/book/${room.id}`); }
  function lateModal(title) {
    openModal({
      title: t("ud.lateTitle"), msg: t("ud.lateMsg", { title }),
      cancelTxt: t("ud.nevermind"), okTxt: t("ud.notifyHost"), variant: "warn",
      onConfirm: () => toast(t("ud.lateToast")),
    });
  }
  function cancelBooking(key) {
    openModal({
      title: t("ud.cancelTitle"), msg: t("ud.cancelMsg"),
      cancelTxt: t("ud.keepBooking"), okTxt: t("ud.cancelBooking"), variant: "bad",
      onConfirm: () => { setCancelled((c) => ({ ...c, [key]: true })); toast(t("ud.cancelledToast")); },
    });
  }
  function cancelLive(id) {
    openModal({
      title: t("ud.cancelTitle"), msg: t("ud.cancelMsg"),
      cancelTxt: t("ud.keepBooking"), okTxt: t("ud.cancelBooking"), variant: "bad",
      onConfirm: async () => { await updateBooking(id, { status: "Cancelled" }); toast(t("ud.cancelledToast")); },
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

      <Tabbar tabs={[["bookings", t("ud.tabBookings")], ["favorites", t("ud.tabFavorites")], ["history", t("ud.tabHistory")], ["payments", t("ud.tabPayments")]]} tab={tab} setTab={setTab} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-[22px]">
        <div>
          {tab === "bookings" && (bookings.length ? bookings.map((b) => (
            <BookingItem key={b.key} {...b} room={b.room} t={t} lang={lang}
              cancelled={isLiveBackend ? b.sk === "Cancelled" : cancelled[b.key]}
              onLate={() => lateModal(roomText(b.room, lang).title)}
              onCancel={() => (isLiveBackend ? cancelLive(b.id) : cancelBooking(b.key))} />
          )) : (
            <div className="surface p-8 text-center text-[14px]" style={{ color: "var(--muted)" }}>{t("home.noMatch")}</div>
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

          {tab === "history" && [
            [ROOMS[2], `${t("when.today")} − ${lang === "ar" ? "ساعتان" : "2 hrs"}`, `36 ${jod}`],
            [ROOMS[3], `${lang === "ar" ? "قبل أسبوع" : "May 15"} · ${lang === "ar" ? "ساعة ونصف" : "1.5 hrs"}`, `9 ${jod}`],
            [ROOMS[4], `${lang === "ar" ? "قبل شهر" : "Apr 30"} · ${lang === "ar" ? "ساعة" : "1 hr"}`, `8 ${jod}`],
          ].map(([r, when, paid], i) => <HistRow key={i} room={r} when={when} paid={paid} t={t} lang={lang} onAgain={() => bookAgain(r)} />)}
        </div>

        <div>
          <div className="surface p-5 mb-[18px]">
            <h3 className="font-sans text-[15px] font-bold mb-[14px]">{t("ud.arrivalCodesTitle")}</h3>
            <div className="flex gap-[11px] items-start">
              <div className="w-[38px] h-[38px] rounded-[10px] grid place-items-center shrink-0" style={{ background: "var(--fill-dark)", color: "var(--cream)" }}>
                <KeyRound className="w-[18px] h-[18px]" />
              </div>
              <p className="text-[13px] leading-[1.55]" style={{ color: "var(--muted)" }}>{t("ud.arrivalCodesBody")}</p>
            </div>
          </div>

          <div className="surface p-5">
            <h3 className="font-sans text-[15px] font-bold mb-[14px]">{t("ud.studentPerks")}</h3>
            <div className="flex items-center gap-[11px] p-[13px] rounded-xl" style={{ background: "var(--foam)", border: "1px solid var(--line)" }}>
              <div className="w-10 h-10 rounded-[10px] grid place-items-center text-white" style={{ background: "var(--verify)" }}>
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-sans text-[13px] font-bold">{t("ud.linkUni")}</h4>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>{t("ud.unlock")}</p>
              </div>
              <button className="btn-primary px-[13px] py-[7px] rounded-[9px] text-[12px]" onClick={() => toast(t("ud.uniToast"))}>{t("ud.link")}</button>
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

function BookingItem({ room, when, sk, timer, timerLbl, code, cancelled, onLate, onCancel, t, lang }) {
  const rt = roomText(room, lang);
  const stCls = sk === "Confirmed" ? "st-confirmed" : sk === "Upcoming" ? "st-upcoming" : "st-pending";
  const showCode = code && sk !== "PendingHost";
  return (
    <div className="surface p-4 mb-[14px] flex gap-[15px] items-center" style={{ animation: "biIn .5s cubic-bezier(.22,1,.36,1) both", opacity: cancelled ? 0.4 : 1 }}>
      <img src={room.imgs[0]} alt="" className="w-[84px] h-16 object-cover rounded-[10px]" />
      <div className="flex-1">
        <h4 className="font-sans text-[15px] font-bold">{rt.title}</h4>
        <div className="text-[13px] mt-[2px]" style={{ color: "var(--muted)" }}>{rt.loc} · {when}</div>
        <span className={`status ${cancelled ? "st-pending" : stCls} mt-[6px]`}>{cancelled ? t("st.Cancelled") : t(`st.${sk}`)}</span>
        {!cancelled && showCode && (
          <div className="flex items-center gap-[6px] mt-[9px] flex-wrap">
            <span className="eyebrow" style={{ marginInlineEnd: 2 }}>{t("ud.arrivalCode")}</span><CodeDigits code={code} />
          </div>
        )}
        {!cancelled && sk === "PendingHost" && (
          <div className="mt-[9px]"><span className="text-[12px] italic" style={{ color: "var(--muted)" }}>{t("ud.codeAfterApprove")}</span></div>
        )}
      </div>
      {timer !== "—" && !cancelled && (
        <div className="text-center">
          <div className="font-serif text-[22px] font-semibold" style={{ color: "var(--espresso)" }}>{timer}</div>
          <div className="text-[11px] uppercase tracking-[.4px]" style={{ color: "var(--muted)" }}>{timerLbl}</div>
        </div>
      )}
      {!cancelled && (
        <div className="flex flex-col gap-[6px]">
          {sk === "Confirmed" && (
            <button onClick={onLate} className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold whitespace-nowrap" style={{ background: "rgba(192,134,59,.14)", color: "var(--warn)" }}>{t("ud.runningLate")}</button>
          )}
          <button onClick={onCancel} className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold whitespace-nowrap" style={{ background: "var(--foam)", color: "var(--bad)", border: "1px solid var(--line)" }}>{t("ud.cancel")}</button>
        </div>
      )}
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

function HistRow({ room, when, paid, onAgain, t, lang }) {
  const rt = roomText(room, lang);
  return (
    <div className="surface p-4 mb-[14px] flex gap-[15px] items-center">
      <img src={room.imgs[0]} alt="" className="w-[84px] h-16 object-cover rounded-[10px]" />
      <div className="flex-1">
        <h4 className="font-sans text-[15px] font-bold">{rt.title}</h4>
        <div className="text-[13px] mt-[2px]" style={{ color: "var(--muted)" }}>{rt.loc} · {when}</div>
        <span className="status st-confirmed mt-[6px]">{t("st.Completed")}</span>
      </div>
      <div className="text-center">
        <div className="font-serif text-[22px] font-semibold" style={{ color: "var(--espresso)" }}>{paid}</div>
        <div className="text-[11px] uppercase tracking-[.4px]" style={{ color: "var(--muted)" }}>{t("ud.paid")}</div>
      </div>
      <button onClick={onAgain} className="px-[13px] py-[7px] rounded-[9px] text-[12px] font-bold whitespace-nowrap" style={{ background: "rgba(192,134,59,.14)", color: "var(--warn)" }}>{t("ud.bookAgain")}</button>
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
