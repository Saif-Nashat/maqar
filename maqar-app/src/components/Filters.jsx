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
    // One horizontally scrolling line instead of a wrapping block that grew to three rows
    // on a phone. The stacked eyebrow labels are gone — the chips name themselves — which
    // is what lets everything sit on a single row. `w-max` stops the inner row shrinking
    // to the container, so the container is what scrolls.
    // Two rows: what kind of room, then what it needs to have. They answer different
    // questions, so mixing them on one line made the row read as an undifferentiated
    // wall of chips. Each row scrolls on its own rather than wrapping.
    <div className="mt-[22px] mb-[6px] p-[9px] rounded-r flex flex-col gap-[8px]"
      style={{ background: "var(--foam)", border: "1px solid var(--line)" }}>

      <div className="overflow-x-auto filters-row">
        <div className="flex items-center gap-[7px] w-max">
          {TYPES.map((ty) => (
            <button key={ty} className={`chip shrink-0 ${filters.type === ty ? "on" : ""}`} onClick={() => setType(ty)}>
              {ty === "all" ? t("filters.all") : t(`type.${ty}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto filters-row">
        <div className="flex items-center gap-[7px] w-max">
          {FEATURES.map((f) => (
            <button key={f} className={`chip shrink-0 ${filters.feats.includes(f) ? "on" : ""}`} onClick={() => toggleFeat(f)}>
              {t(`feat.${f}`)}
            </button>
          ))}

          <Sep />

          <div className="flex items-center gap-[9px] shrink-0 ps-[2px]">
            <input type="range" min="1" max="20" value={filters.minCap} aria-label={t("filters.minCap")}
              onChange={(e) => setCap(+e.target.value)} className="w-[110px]" style={{ accentColor: "var(--coffee)" }} />
            <span className="num font-bold text-[13px] whitespace-nowrap" style={{ color: "var(--coffee)" }}>
              {lang === "ar" ? `+${filters.minCap} أشخاص` : `${filters.minCap}+ people`}
            </span>
          </div>

          <Sep />

          <select value={filters.sort} onChange={(e) => setSort(e.target.value)} aria-label={t("filters.sortBy")}
            className="shrink-0 px-[11px] py-[7px] rounded-[10px] font-semibold text-[13px] cursor-pointer"
            style={{ border: "1px solid var(--line)", background: "var(--surface)", color: "var(--coffee)" }}>
            <option value="rec">{t("sort.rec")}</option>
            <option value="price-low">{t("sort.priceLow")}</option>
            <option value="price-high">{t("sort.priceHigh")}</option>
            <option value="cap">{t("sort.cap")}</option>
            <option value="verified">{t("sort.verified")}</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function Sep() {
  return <span className="w-px h-[22px] shrink-0 mx-[3px]" style={{ background: "var(--line)" }} />;
}
