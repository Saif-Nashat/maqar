import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LayoutGrid, Users, MapPin, Star } from "lucide-react";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";
import { roomText, areaOf } from "../data/rooms.js";

const TYPES = ["all", "Meeting", "Private", "Event"];
const CAPS = [
  { v: 1, key: "cap.any" },
  { v: 2, key: "cap.2" },
  { v: 4, key: "cap.4" },
  { v: 8, key: "cap.8" },
  { v: 12, key: "cap.12" },
];

export default function HeroSearch({ onSearch }) {
  const { filters, setFilters, setCurrentRoom, rooms } = useApp();
  const { t, lang } = useT();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  // Districts present in the current room set. Keyed by the English name so the selected
  // value survives a language switch; the label is localised for display.
  const areas = useMemo(() => {
    const m = new Map();
    rooms.forEach((r) => {
      const key = areaOf(r, "en");
      if (key && !m.has(key)) m.set(key, areaOf(r, lang) || key);
    });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rooms, lang]);

  const ql = q.trim().toLowerCase();
  const matches = ql
    ? rooms.filter((r) =>
        [r.title, r.title_ar, r.loc, r.loc_ar].some((s) => (s || "").toLowerCase().includes(ql))
      ).slice(0, 5)
    : [];

  function pick(room) {
    setCurrentRoom(room);
    setOpen(false);
    setQ("");
    nav(`/room/${room.id}`);
  }

  return (
    <div className="surface p-[7px]" style={{ borderRadius: 16 }}>
      {/* autocomplete search */}
      <div className="relative mb-[8px]">
        <div className="flex items-center gap-[10px] px-[13px] py-[8px] rounded-[12px]" style={{ background: "var(--foam)", border: "1px solid var(--line)" }}>
          <Search className="w-[18px] h-[18px] shrink-0" style={{ color: "var(--muted)" }} />
          {/* 16px below sm so iOS Safari does not zoom the page on focus — see .field-input */}
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={t("search.placeholder")}
            className="bg-transparent outline-none w-full text-[16px] sm:text-[15px] font-medium"
            style={{ color: "var(--ink)" }}
          />
        </div>
        {open && ql && (
          <div className="absolute left-0 right-0 mt-2 z-[40] rounded-[14px] overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}>
            {matches.length === 0 ? (
              <div className="p-4 text-[14px] text-center" style={{ color: "var(--muted)" }}>{t("search.noResults")}</div>
            ) : (
              matches.map((r, i) => {
                const rt = roomText(r, lang);
                return (
                  <button key={r.id} onMouseDown={(e) => { e.preventDefault(); pick(r); }}
                    className="w-full flex items-center gap-3 p-[10px] text-start transition-colors hover:bg-foam"
                    style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                    <img src={r.imgs[0]} alt="" className="w-[46px] h-[40px] rounded-[9px] object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-sans text-[14px] font-bold truncate">{rt.title}</div>
                      <div className="text-[12px] truncate" style={{ color: "var(--muted)" }}>{rt.loc}</div>
                    </div>
                    <span className="flex items-center gap-[3px] text-[12px] font-bold shrink-0" style={{ color: "var(--espresso)" }}>
                      <Star className="w-[12px] h-[12px]" style={{ fill: "var(--crema)", color: "var(--crema)" }} /> {r.rating}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* filters row */}
      {/* lg, not sm: three icon+label+value segments plus the search button need roughly
          1024px to sit on one line. At the old `sm` (640px) they were crammed together and
          the selects rendered truncated ("Any roor", "Any si:"). Below lg they stack full
          width instead, which reads fine and never clips. */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-[8px]">
        <Segment icon={<LayoutGrid className="w-[18px] h-[18px]" />} label={t("search.type")}>
          <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            className="bg-transparent font-semibold text-[14px] outline-none cursor-pointer w-full" style={{ color: "var(--espresso)" }}>
            {TYPES.map((ty) => <option key={ty} value={ty}>{ty === "all" ? t("search.anyRoom") : t(`type.${ty}`)}</option>)}
          </select>
        </Segment>

        <Divider />

        <Segment icon={<Users className="w-[18px] h-[18px]" />} label={t("search.capacity")}>
          <select value={filters.minCap} onChange={(e) => setFilters((f) => ({ ...f, minCap: +e.target.value }))}
            className="bg-transparent font-semibold text-[14px] outline-none cursor-pointer w-full" style={{ color: "var(--espresso)" }}>
            {CAPS.map((c) => <option key={c.v} value={c.v}>{t(c.key)}</option>)}
          </select>
        </Segment>

        <Divider />

        {/* This was a static <div> reading "Amman & nearby" — it looked like a control but
            filtered nothing, and the filter state had no location key at all. It is now a
            real select over the districts present in the room data. */}
        <Segment icon={<MapPin className="w-[18px] h-[18px]" />} label={t("search.where")}>
          <select value={filters.area} onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))}
            className="bg-transparent font-semibold text-[14px] outline-none cursor-pointer w-full" style={{ color: "var(--espresso)" }}>
            <option value="all">{t("search.amman")}</option>
            {areas.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Segment>

        <button onClick={onSearch}
          className="btn-primary rounded-[11px] px-[20px] py-[10px] text-[14px] flex items-center justify-center gap-[7px] shrink-0">
          <Search className="w-[16px] h-[16px]" /> {t("search.button")}
        </button>
      </div>
    </div>
  );
}

function Segment({ icon, label, children }) {
  return (
    // flex-auto, not flex-1: flex-1 is `flex: 1 1 0%`, which splits the row into equal
    // thirds and ignores how wide each segment's content actually is — that is what
    // clipped "Any room" to "Any roor" and wrapped "Amman & nearby" onto two lines.
    // flex-auto (`flex: 1 1 auto`) sizes each segment from its content first, then
    // shares out what is left. Below `lg` the row stacks, so nothing needs to shrink.
    <div className="flex items-center gap-[9px] px-[10px] py-[3px] flex-auto">
      <span className="grid place-items-center w-[31px] h-[31px] rounded-[9px] shrink-0"
        style={{ background: "var(--foam)", color: "var(--coffee)" }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="eyebrow mb-[1px]">{label}</div>
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <span className="hidden lg:block w-px self-stretch my-[8px]" style={{ background: "var(--line)" }} />;
}
