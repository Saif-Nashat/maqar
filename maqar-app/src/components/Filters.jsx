import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";

const TYPES = ["all", "Meeting", "Private", "Event"];
const FEATURES = ["Whiteboard", "Projector", "Coffee", "Parking"];

export default function Filters() {
  const { filters, setFilters } = useApp();
  const { t, lang } = useT();

  const setType = (type) => setFilters((f) => ({ ...f, type }));
  const toggleFeat = (feat) =>
    setFilters((f) => ({
      ...f,
      feats: f.feats.includes(feat) ? f.feats.filter((x) => x !== feat) : [...f.feats, feat],
    }));
  const setCap = (minCap) => setFilters((f) => ({ ...f, minCap }));
  const setSort = (sort) => setFilters((f) => ({ ...f, sort }));

  return (
    <div className="flex gap-3 flex-wrap items-center mt-[22px] mb-[6px] p-[14px] rounded-r"
      style={{ background: "var(--foam)", border: "1px solid var(--line)" }}>
      <div className="flex flex-col gap-1">
        <span className="eyebrow">{t("filters.roomType")}</span>
        <div className="flex gap-[6px] flex-wrap">
          {TYPES.map((ty) => (
            <button key={ty} className={`chip ${filters.type === ty ? "on" : ""}`} onClick={() => setType(ty)}>
              {ty === "all" ? t("filters.all") : t(`type.${ty}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="eyebrow">{t("filters.features")}</span>
        <div className="flex gap-[6px] flex-wrap">
          {FEATURES.map((f) => (
            <button key={f} className={`chip ${filters.feats.includes(f) ? "on" : ""}`} onClick={() => toggleFeat(f)}>
              {t(`feat.${f}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="eyebrow">{t("filters.minCap")}</span>
        <div className="flex items-center gap-[10px]">
          <input type="range" min="1" max="20" value={filters.minCap}
            onChange={(e) => setCap(+e.target.value)} className="w-[150px]" style={{ accentColor: "var(--coffee)" }} />
          <span className="font-bold text-[14px] min-w-[60px]" style={{ color: "var(--coffee)" }}>
            {lang === "ar" ? `+${filters.minCap} أشخاص` : `${filters.minCap}+ people`}
          </span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-1">
        <span className="eyebrow">{t("filters.sortBy")}</span>
        <select value={filters.sort} onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 rounded-[10px] font-semibold cursor-pointer"
          style={{ border: "1px solid var(--line)", background: "var(--surface)", color: "var(--coffee)" }}>
          <option value="rec">{t("sort.rec")}</option>
          <option value="price-low">{t("sort.priceLow")}</option>
          <option value="price-high">{t("sort.priceHigh")}</option>
          <option value="cap">{t("sort.cap")}</option>
          <option value="verified">{t("sort.verified")}</option>
        </select>
      </div>
    </div>
  );
}
