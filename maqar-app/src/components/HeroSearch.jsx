import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LayoutGrid, Users, MapPin, Star } from "lucide-react";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";
import { roomText } from "../data/rooms.js";

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
    <div className="surface p-[10px]" style={{ borderRadius: 18 }}>
      {/* autocomplete search */}
      <div className="relative mb-[8px]">
        <div className="flex items-center gap-[10px] px-[14px] py-[11px] rounded-[14px]" style={{ background: "var(--foam)", border: "1px solid var(--line)" }}>
          <Search className="w-[18px] h-[18px] shrink-0" style={{ color: "var(--muted)" }} />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={t("search.placeholder")}
            className="bg-transparent outline-none w-full text-[15px] font-medium"
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

        <Segment icon={<MapPin className="w-[18px] h-[18px]" />} label={t("search.where")}>
          <div className="font-semibold text-[14px] whitespace-nowrap" style={{ color: "var(--espresso)" }}>{t("search.amman")}</div>
        </Segment>

        <button onClick={onSearch}
          className="btn-primary rounded-[12px] px-[22px] py-[13px] text-[14px] flex items-center justify-center gap-[7px] shrink-0">
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
    <div className="flex items-center gap-[11px] px-[12px] py-[6px] flex-auto">
      <span className="grid place-items-center w-[36px] h-[36px] rounded-[10px] shrink-0"
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
