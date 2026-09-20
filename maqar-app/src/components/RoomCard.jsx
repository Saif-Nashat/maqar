import { useNavigate } from "react-router-dom";
import { MapPin, Users, Check, Star, ArrowRight, Heart } from "lucide-react";
import { useApp } from "../store/AppContext.jsx";
import { FeatIcon } from "../lib/icons.jsx";
import { useT } from "../i18n/index.jsx";
import { roomText } from "../data/rooms.js";
import { combinedRating } from "../lib/ratings.js";

// `featured` renders the same card at a larger scale for the lead slot in the grid. It only
// changes size and surface tier — not structure — so every badge, price and interaction
// stays identical and there is no second card component to keep in sync.
export default function RoomCard({ room, onHover, active, distanceKm, featured = false }) {
  const nav = useNavigate();
  const { loggedIn, accountType, setCurrentRoom, resetBooking, pendingAction: pendingActionRef, toast, isFavorite, toggleFavorite, getReviews } = useApp();
  const { t, lang } = useT();
  const rt = roomText(room, lang);
  const fav = isFavorite(room.id);
  const rating = combinedRating(room, getReviews(room.id));

  function onFav(e) {
    e.stopPropagation();
    toggleFavorite(room.id);
    toast(fav ? t("fav.removed") : t("fav.added"));
  }

  function openDetail() {
    setCurrentRoom(room);
    nav(`/room/${room.id}`);
  }

  function bookNow(e) {
    e.stopPropagation();
    if (loggedIn && accountType === "host") { toast(t("guard.hostsCantBook")); return; }
    setCurrentRoom(room);
    resetBooking();
    if (!loggedIn) {
      pendingActionRef.current = () => nav(`/book/${room.id}`);
      nav("/login");
      return;
    }
    nav(`/book/${room.id}`);
  }

  return (
    <div className={`${featured ? "surface-raised" : "surface"} card-hover overflow-hidden flex flex-col group`}
      onMouseEnter={() => onHover?.(room.id)} onMouseLeave={() => onHover?.(null)}
      style={active ? { borderColor: "var(--crema)", boxShadow: "var(--shadow-lg),0 0 0 2px var(--crema)" } : undefined}>
      <div className={`relative overflow-hidden cursor-pointer ${featured ? "h-[176px] lg:h-[332px]" : "h-[176px]"}`} onClick={openDetail}>
        <img src={room.imgs[0]} alt={rt.title}
          className="w-full h-full object-cover transition-transform duration-[600ms] ease-smooth group-hover:scale-105 group-hover:saturate-[1.08]" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "linear-gradient(to top, rgba(43,29,23,.38), transparent 55%)" }} />
        {/* favorite heart */}
        <button onClick={onFav} aria-label="Save"
          className="absolute top-[10px] right-[10px] w-[34px] h-[34px] grid place-items-center rounded-full transition-transform active:scale-90 hover:scale-110"
          style={{ background: "rgba(251,247,240,.92)", backdropFilter: "blur(6px)", boxShadow: "0 3px 10px rgba(43,29,23,.2)" }}>
          <Heart className="w-[17px] h-[17px]" style={{ color: fav ? "var(--bad)" : "var(--coffee)", fill: fav ? "var(--bad)" : "transparent" }} strokeWidth={2.2} />
        </button>
        {distanceKm != null && (
          <div className="absolute top-[10px] left-[10px] px-[9px] py-[4px] rounded-full text-[11px] font-bold flex items-center gap-1"
            style={{ background: "rgba(251,247,240,.92)", color: "var(--fill-dark)", backdropFilter: "blur(6px)" }}>
            <MapPin className="w-3 h-3" /> {t("card.away", { km: distanceKm })}
          </div>
        )}
        {room.verified && distanceKm == null && (
          <div className="verify-badge top-[10px] left-[10px]">
            <Check className="w-3 h-3" strokeWidth={3} /> {t("common.verified")}
          </div>
        )}
        <div className="price-badge num absolute bottom-[10px] right-[10px] flex items-baseline gap-[2px]">
          <span className="text-[15px] leading-none">{room.price}</span>
          <span className="text-[11px]">{lang === "ar" ? "د.أ" : "JOD"}</span>
          <small className="font-normal opacity-70 text-[11px]">{lang === "ar" ? "/ساعة" : "/hr"}</small>
        </div>
        {/* type tag, slides up on hover */}
        <div className="absolute bottom-[10px] left-[10px] px-[9px] py-[4px] rounded-full text-[11px] font-semibold translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition duration-300"
          style={{ background: "rgba(251,247,240,.92)", color: "var(--fill-dark)", backdropFilter: "blur(6px)" }}>
          {t(`type.${room.type}`)}
        </div>
      </div>

      <div className="p-[16px] pt-[14px] flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`font-sans font-bold leading-tight cursor-pointer group-hover:text-[var(--crema)] transition-colors ${featured ? "text-[16px] lg:text-[21px]" : "text-[16px]"}`} onClick={openDetail}>
            {rt.title}
          </h3>
          <span className="num flex items-center gap-[3px] text-[13px] font-bold shrink-0 mt-[1px]" style={{ color: "var(--espresso)" }}>
            <Star className="w-[14px] h-[14px]" style={{ fill: "var(--crema)", color: "var(--crema)" }} />
            {rating.avg}
            <span className="font-medium text-[12px]" style={{ color: "var(--muted)" }}>({rating.count})</span>
          </span>
        </div>

        <div className="flex items-center justify-between mt-[5px] mb-[12px]">
          <span className="flex items-center gap-[5px] text-[13px]" style={{ color: "var(--muted)" }}>
            <MapPin className="w-[14px] h-[14px]" /> {rt.loc}
          </span>
          <span className="flex items-center gap-1 text-[12px] font-semibold px-[10px] py-[2px] rounded-full"
            style={{ color: "var(--coffee)", background: "var(--foam)" }}>
            <Users className="w-[13px] h-[13px]" /> {room.cap}
          </span>
        </div>

        <div className="flex gap-[6px] flex-wrap mb-[14px]">
          {room.feats.slice(0, 3).map((f) => (
            <span key={f} className="flex items-center gap-1 text-[11px] font-semibold px-[9px] py-1 rounded-[7px]"
              style={{ color: "var(--coffee)", background: "var(--foam)", border: "1px solid var(--line)" }}>
              <FeatIcon name={f} className="w-3 h-3" /> {t(`feat.${f}`)}
            </span>
          ))}
        </div>

        <div className="mt-auto flex gap-2">
          <button className="btn-soft flex-1 py-[10px] rounded-[10px] text-[13px]" onClick={openDetail}>
            {t("common.viewDetails")}
          </button>
          <button className="btn-primary flex-1 py-[10px] rounded-[10px] text-[13px] flex items-center justify-center gap-1 group/btn" onClick={bookNow}>
            {t("common.bookNow")}
            <ArrowRight className="w-[14px] h-[14px] -ml-[2px] transition-transform duration-300 group-hover/btn:translate-x-[3px] rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
