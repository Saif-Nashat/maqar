import { MapPin, Users, Star, ImageIcon, ArrowRight } from "lucide-react";
import { FeatIcon } from "../lib/icons.jsx";

/**
 * Presentational card for a host-created listing draft.
 * variant: "preview" (live wizard preview) | "dash" (dashboard strip)
 */
export default function ListingCard({ listing, t, lang, variant = "preview" }) {
  const jod = lang === "ar" ? "د.أ" : "JOD";
  const perHr = lang === "ar" ? "/ساعة" : "/hr";
  const cover = listing.imgs?.[0];
  const loc = listing.area ? t(`area.${listing.area}`) : t("list.naLocation");
  const title = listing.name?.trim() || t("list.untitled");

  return (
    <div className="surface overflow-hidden flex flex-col">
      <div className="relative h-[176px] overflow-hidden" style={{ background: "var(--foam)" }}>
        {cover ? (
          <img src={cover} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center" style={{ color: "var(--muted)" }}>
            <div className="flex flex-col items-center gap-2 text-[13px]">
              <ImageIcon className="w-7 h-7 opacity-60" />
              {t("list.naPhotos")}
            </div>
          </div>
        )}
        <div className="absolute top-[10px] left-[10px] px-[10px] py-[5px] rounded-full text-[11px] font-bold flex items-center gap-[5px]"
          style={{ background: "linear-gradient(150deg,var(--crema),#B8905F)", color: "var(--fill-dark)", boxShadow: "0 4px 12px rgba(184,144,95,.4)" }}>
          {variant === "dash" ? `● ${t("list.live")}` : `✦ ${t("list.newBadge")}`}
        </div>
        {!!listing.price && (
          <div className="price-badge absolute bottom-[10px] right-[10px] flex items-baseline gap-[2px]">
            <span className="text-[15px] leading-none">{listing.price}</span>
            <span className="text-[11px]">{jod}</span>
            <small className="font-normal opacity-70 text-[11px]">{perHr}</small>
          </div>
        )}
      </div>

      <div className="p-[16px] pt-[14px] flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-sans text-[16px] font-bold leading-tight" style={{ color: title === t("list.untitled") ? "var(--muted)" : "inherit" }}>
            {title}
          </h3>
          <span className="flex items-center gap-[3px] text-[12px] font-bold shrink-0 mt-[1px]" style={{ color: "var(--crema)" }}>
            <Star className="w-[14px] h-[14px]" style={{ fill: "var(--crema)", color: "var(--crema)" }} />
            {t("list.newBadge")}
          </span>
        </div>

        <div className="flex items-center justify-between mt-[5px] mb-[12px]">
          <span className="flex items-center gap-[5px] text-[13px]" style={{ color: "var(--muted)" }}>
            <MapPin className="w-[14px] h-[14px]" /> {loc}
          </span>
          <span className="flex items-center gap-1 text-[12px] font-semibold px-[10px] py-[2px] rounded-full"
            style={{ color: "var(--coffee)", background: "var(--foam)" }}>
            <Users className="w-[13px] h-[13px]" /> {listing.cap}
          </span>
        </div>

        <div className="flex gap-[6px] flex-wrap mb-[14px] min-h-[26px]">
          {(listing.feats || []).slice(0, 3).map((f) => (
            <span key={f} className="flex items-center gap-1 text-[11px] font-semibold px-[9px] py-1 rounded-[7px]"
              style={{ color: "var(--coffee)", background: "var(--foam)", border: "1px solid var(--line)" }}>
              <FeatIcon name={f} className="w-3 h-3" /> {t(`feat.${f}`)}
            </span>
          ))}
        </div>

        <div className="mt-auto flex gap-2">
          <span className="btn-soft flex-1 py-[10px] rounded-[10px] text-[13px] text-center opacity-70">{t("common.viewDetails")}</span>
          <span className="btn-primary flex-1 py-[10px] rounded-[10px] text-[13px] flex items-center justify-center gap-1 opacity-90">
            {t("common.bookNow")} <ArrowRight className="w-[14px] h-[14px] rtl:rotate-180" />
          </span>
        </div>
      </div>
    </div>
  );
}
