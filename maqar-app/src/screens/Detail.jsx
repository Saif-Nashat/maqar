import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, MapPin, Users, Tag, Check, Star, Heart, MessageCircle, X } from "lucide-react";
import { roomText } from "../data/rooms.js";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";
import { combinedRating } from "../lib/ratings.js";

function Dot() {
  return <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: "var(--crema)" }} />;
}

export default function Detail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { loggedIn, accountType, account, getRoom, setCurrentRoom, resetBooking, pendingAction, toast, isFavorite, toggleFavorite, getReviews, loadReviews, addReview } = useApp();
  const { t, lang } = useT();
  const room = getRoom(id);
  const [agree, setAgree] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => { if (room?.id) loadReviews(room.id); }, [room?.id, loadReviews]);

  if (!room) return null;
  const rt = roomText(room, lang);
  const host = rt.loc.split(/[,،]/)[0].trim();
  const fav = isFavorite(room.id);
  const reviews = getReviews(room.id);
  const rating = combinedRating(room, reviews);

  function startBooking() {
    if (loggedIn && accountType === "host") { toast(t("guard.hostsCantBook")); return; }
    setCurrentRoom(room);
    resetBooking();
    if (!loggedIn) {
      pendingAction.current = () => nav(`/book/${room.id}`);
      nav("/login");
      return;
    }
    nav(`/book/${room.id}`);
  }
  function onFav() { toggleFavorite(room.id); toast(fav ? t("fav.removed") : t("fav.added")); }

  return (
    <div className="wrap pt-5 pb-10">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-[6px] font-semibold text-[14px] my-[18px] px-[13px] py-[7px] rounded-full hover:bg-foam transition-colors" style={{ color: "var(--coffee)" }}>
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" /> {t("common.back")}
      </button>

      <Gallery imgs={room.imgs} title={rt.title} onOpen={setLightbox} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-[34px]">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[32px] font-semibold tracking-[-.6px]">{rt.title}</h1>
            <button onClick={onFav} aria-label="Save" className="shrink-0 w-[40px] h-[40px] grid place-items-center rounded-full transition-transform active:scale-90 hover:scale-105"
              style={{ background: "var(--foam)", border: "1px solid var(--line)", color: fav ? "var(--bad)" : "var(--coffee)" }}>
              <Heart className="w-[18px] h-[18px]" style={{ fill: fav ? "var(--bad)" : "transparent" }} strokeWidth={2.2} />
            </button>
          </div>

          <div className="flex gap-[18px] text-[14px] my-2 mb-[22px] flex-wrap items-center" style={{ color: "var(--muted)" }}>
            <span className="flex items-center gap-[5px] font-bold" style={{ color: "var(--espresso)" }}>
              <Star className="w-4 h-4" style={{ fill: "var(--crema)", color: "var(--crema)" }} /> {rating.avg}
              <span className="font-medium" style={{ color: "var(--muted)" }}>· {t("detail.reviews", { n: rating.count })}</span>
            </span>
            <span className="flex items-center gap-[6px]"><MapPin className="w-4 h-4" /> {rt.loc}</span>
            <span className="flex items-center gap-[6px]"><Users className="w-4 h-4" /> {t("detail.upTo", { n: room.cap })}</span>
            <span className="flex items-center gap-[6px]"><Tag className="w-4 h-4" /> {t("detail.roomType", { type: t(`type.${room.type}`) })}</span>
            {room.verified && (
              <span className="flex items-center gap-[6px] font-bold" style={{ color: "var(--verify)" }}><Check className="w-4 h-4" strokeWidth={3} /> {t("detail.maqarVerified")}</span>
            )}
          </div>

          <p className="text-[15px] leading-[1.65] mb-6" style={{ color: "var(--coffee)" }}>{rt.desc}</p>

          <div className="mb-6">
            <h3 className="eyebrow mb-3">{t("detail.offers")}</h3>
            <div className="grid grid-cols-2 gap-[10px]">
              {room.feats.map((f) => (
                <div key={f} className="flex items-center gap-[9px] text-[14px]" style={{ color: "var(--coffee)" }}><Dot /> {t(`feat.${f}`)}</div>
              ))}
              <div className="flex items-center gap-[9px] text-[14px]" style={{ color: "var(--coffee)" }}><Dot /> {t("detail.wifi")}</div>
              <div className="flex items-center gap-[9px] text-[14px]" style={{ color: "var(--coffee)" }}><Dot /> {t("detail.ac")}</div>
            </div>
          </div>

          {room.verified && (
            <div className="mb-6">
              <div className="rounded-xl p-4 px-[18px] text-[14px]" style={{ color: "var(--coffee)", border: "1px solid var(--verify)", background: "rgba(46,111,94,.06)" }}>
                <h4 className="font-sans font-bold mb-2 flex items-center gap-1" style={{ color: "var(--verify)" }}><Check className="w-4 h-4" strokeWidth={3} /> {t("detail.verifiedTitle")}</h4>
                {t("detail.verifiedBody")}
              </div>
            </div>
          )}

          <Policy title={t("detail.policyTitle")} items={[t("detail.policy1"), t("detail.policy2"), t("detail.policy3"), t("detail.policy4")]} />
          <Policy title={t("detail.hostPolicy", { host })} items={[t("detail.host1"), t("detail.host2"), t("detail.host3")]} />

          <Reviews reviews={reviews} canPost={loggedIn} authorName={account?.name || (accountType === "host" ? t("msg.host") : t("msg.you"))}
            onPost={(rating, text) => { addReview(room.id, { author: account?.name || t("msg.you"), rating, text, ts: new Date().toISOString().slice(0, 10) }); toast(t("rev.thanks")); }}
            onSignIn={() => nav("/login")} t={t} />
        </div>

        <div>
          <div className="surface p-[22px] lg:sticky lg:top-[90px]">
            <div className="font-serif text-[30px] font-semibold" style={{ color: "var(--espresso)" }}>
              {room.price} {lang === "ar" ? "د.أ" : "JOD"} <small className="font-sans text-[14px] font-normal" style={{ color: "var(--muted)" }}>{t("detail.perHour")}</small>
            </div>
            <div className="text-[13px] mt-2 mb-1" style={{ color: "var(--muted)" }}>{t("detail.increments")}</div>
            <label className="flex gap-[9px] items-start my-[18px] text-[13px] cursor-pointer" style={{ color: "var(--coffee)" }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-[3px] w-4 h-4" style={{ accentColor: "var(--coffee)" }} />
              {t("detail.agree")}
            </label>
            <button className="btn-primary w-full py-[13px] rounded-xl text-[15px]" disabled={!agree} onClick={startBooking}>
              {t("detail.continue")}
            </button>
            <button onClick={() => nav(`/messages/${room.id}`)} className="btn-soft w-full py-[11px] rounded-xl text-[14px] mt-[10px] flex items-center justify-center gap-2">
              <MessageCircle className="w-4 h-4" /> {t("msg.messageHost")}
            </button>
            <div className="text-center text-[12px] mt-[10px]" style={{ color: "var(--muted)" }}>{t("detail.noCharge")}</div>
          </div>
        </div>
      </div>

      {lightbox != null && <Lightbox imgs={room.imgs} index={lightbox} setIndex={setLightbox} />}
    </div>
  );
}

// The gallery shapes its grid around how many photos a room actually has. The previous
// fixed 3x2 grid always left at least one cell empty — image 0 spans two rows, so six
// cells needed five images and only four were ever passed. A three-photo room showed a
// large blank block where photos four and five would have gone.
const GALLERY_LAYOUTS = {
  1: { cols: "1fr", rows: "270px", take: 1 },
  2: { cols: "1fr 1fr", rows: "270px", take: 2 },
  3: { cols: "2fr 1fr", rows: "130px 130px", take: 3, spanFirst: true },
  4: { cols: "2fr 1fr 1fr", rows: "130px 130px", take: 4, spanFirst: true, spanLast: true },
  5: { cols: "2fr 1fr 1fr", rows: "130px 130px", take: 5, spanFirst: true },
};

function Gallery({ imgs = [], title, onOpen }) {
  if (!imgs.length) return null;
  const layout = GALLERY_LAYOUTS[Math.min(imgs.length, 5)];
  const shown = imgs.slice(0, layout.take);
  const extra = imgs.length - shown.length;

  return (
    <div className="grid gap-[10px] rounded-r overflow-hidden mb-[26px]"
      style={{ gridTemplateColumns: layout.cols, gridTemplateRows: layout.rows, boxShadow: "var(--shadow)" }}>
      {shown.map((img, i) => {
        const isLast = i === shown.length - 1;
        return (
          <button key={i} type="button" onClick={() => onOpen(i)}
            className={`relative w-full h-full overflow-hidden cursor-zoom-in group
              ${i === 0 && layout.spanFirst ? "row-span-2" : ""} ${isLast && layout.spanLast ? "col-span-2" : ""}`}
            style={{ animation: `galRise .6s cubic-bezier(.22,1,.36,1) ${0.05 + i * 0.07}s both` }}>
            <img src={img} alt={`${title} — photo ${i + 1} of ${imgs.length}`}
              className="w-full h-full object-cover transition-all group-hover:brightness-105 group-hover:saturate-[1.06]" />
            {isLast && extra > 0 && (
              <span className="absolute inset-0 grid place-items-center text-[15px] font-semibold"
                style={{ background: "rgba(43,29,23,.55)", color: "var(--cream)" }}>+{extra}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Reviews({ reviews, canPost, onPost, onSignIn, t }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  return (
    <div className="mb-2">
      <h3 className="eyebrow mb-3">{t("rev.title")}</h3>

      {canPost ? (
        <div className="surface p-4 mb-4">
          <div className="text-[13px] font-bold mb-2" style={{ color: "var(--coffee)" }}>{t("rev.your")}</div>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className="transition-transform active:scale-90">
                <Star className="w-[22px] h-[22px]" style={{ fill: n <= rating ? "var(--crema)" : "transparent", color: "var(--crema)" }} />
              </button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("rev.placeholder")} maxLength={200} className="field-input min-h-[70px] resize-y mb-3" />
          <button onClick={() => { if (text.trim()) { onPost(rating, text.trim()); setText(""); setRating(5); } }}
            className="btn-primary px-[20px] py-[10px] rounded-xl text-[14px]">{t("rev.submit")}</button>
        </div>
      ) : (
        <button onClick={onSignIn} className="btn-soft px-[18px] py-[10px] rounded-xl text-[14px] mb-4">{t("rev.leave")}</button>
      )}

      {reviews.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--muted)" }}>{t("rev.none")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((rv) => (
            <div key={rv.id} className="surface p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[14px]">{rv.author}</span>
                <span className="flex items-center gap-[2px]">
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} className="w-[13px] h-[13px]" style={{ fill: n <= rv.rating ? "var(--crema)" : "transparent", color: "var(--crema)" }} />)}
                </span>
              </div>
              <p className="text-[14px] leading-[1.55]" style={{ color: "var(--coffee)" }}>{rv.text}</p>
              <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>{rv.ts}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Lightbox({ imgs, index, setIndex }) {
  const prev = () => setIndex((i) => (i - 1 + imgs.length) % imgs.length);
  const next = () => setIndex((i) => (i + 1) % imgs.length);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setIndex(null);
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgs.length]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6" style={{ background: "rgba(20,14,9,.86)", backdropFilter: "blur(6px)" }} onClick={() => setIndex(null)}>
      <button className="absolute top-5 right-5 w-[42px] h-[42px] grid place-items-center rounded-full" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }} onClick={() => setIndex(null)}><X className="w-5 h-5" /></button>
      <button className="absolute left-4 w-[46px] h-[46px] grid place-items-center rounded-full" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }} onClick={(e) => { e.stopPropagation(); prev(); }}><ChevronLeft className="w-6 h-6" /></button>
      <img src={imgs[index]} alt="" className="max-w-[90vw] max-h-[82vh] rounded-xl object-contain" style={{ boxShadow: "0 30px 80px rgba(0,0,0,.6)" }} onClick={(e) => e.stopPropagation()} />
      <button className="absolute right-4 w-[46px] h-[46px] grid place-items-center rounded-full" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }} onClick={(e) => { e.stopPropagation(); next(); }}><ChevronRight className="w-6 h-6" /></button>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {imgs.map((_, i) => <span key={i} className="w-[8px] h-[8px] rounded-full" style={{ background: i === index ? "var(--crema)" : "rgba(255,255,255,.3)" }} />)}
      </div>
    </div>
  );
}

function Policy({ title, items }) {
  return (
    <div className="mb-6">
      <h3 className="eyebrow mb-3">{title}</h3>
      <div className="rounded-xl p-4 px-[18px] text-[14px]" style={{ background: "var(--foam)", border: "1px solid var(--line)", color: "var(--coffee)" }}>
        <ul className="flex flex-col gap-[7px]">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2"><span style={{ color: "var(--crema)", fontWeight: 700 }}>•</span> {it}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
