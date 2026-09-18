import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext.jsx";
import { useSettings } from "../store/SettingsContext.jsx";
import { useT } from "../i18n/index.jsx";
import { roomText, AMMAN_CENTER } from "../data/rooms.js";
import { TILES, TILE_ATTRIB } from "../lib/tiles.js";


// Escape before interpolating: room titles are user-supplied once hosts can list rooms,
// and this string goes into divIcon as raw HTML.
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Pins carry a shortened room name, not the full title — a full name makes the pin wider
// than the thing it points at. Truncation is at a word boundary so labels never cut
// mid-word ("The Crema…", not "The Crema Boa…"). The full name is in the tooltip and the
// popup, and the price is already on every room card.
const PIN_CHARS = 15;
function shortLabel(title) {
  const s = String(title).trim();
  if (s.length <= PIN_CHARS) return s;
  let out = "";
  for (const word of s.split(/\s+/)) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > PIN_CHARS) break;
    out = next;
  }
  return `${out || s.slice(0, PIN_CHARS)}…`;
}

function titleIcon(title, active) {
  const label = shortLabel(title);
  const w = Math.min(126, Math.max(50, label.length * 7 + 22));
  return L.divIcon({
    className: "maqar-pin-wrap",
    html: `<div class="maqar-pin${active ? " active" : ""}" title="${esc(title)}">${esc(label)}</div>`,
    iconSize: [w, 32],
    iconAnchor: [w / 2, 34],
    popupAnchor: [0, -34],
  });
}
const userIcon = L.divIcon({
  className: "maqar-userloc-wrap",
  html: `<div class="maqar-userloc"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function MapView({ rooms, activeId, onHoverPin, userLoc }) {
  const nav = useNavigate();
  const { setCurrentRoom } = useApp();
  const { theme } = useSettings();
  const { t, lang } = useT();
  const perHr = lang === "ar" ? "د.أ/ساعة" : "JOD/hr";

  function openDetail(room) {
    setCurrentRoom(room);
    nav(`/room/${room.id}`);
  }

  return (
    <div className="relative rounded-r overflow-hidden h-[380px] card-hover"
      style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow),0 0 0 1px rgba(201,162,126,.18)", isolation: "isolate" }}>
      <MapContainer center={[AMMAN_CENTER.lat, AMMAN_CENTER.lng]} zoom={13} scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}>
        <TileLayer key={theme} url={theme === "dark" ? TILES.dark : TILES.light} attribution={TILE_ATTRIB} />
        {userLoc && <Marker position={[userLoc.lat, userLoc.lng]} icon={userIcon} />}
        {rooms.map((r) => {
          const rt = roomText(r, lang);
          return (
            <Marker key={r.id} position={[r.lat, r.lng]} icon={titleIcon(rt.title, activeId === r.id)}
              eventHandlers={{ mouseover: () => onHoverPin?.(r.id), mouseout: () => onHoverPin?.(null) }}>
              <Popup>
                <div className="w-[200px] cursor-pointer" onClick={() => openDetail(r)}>
                  <img src={r.imgs[0]} alt="" className="w-full h-[90px] object-cover" />
                  <div className="p-[10px]">
                    <h4 className="font-sans text-[13px] font-bold leading-tight" style={{ color: "var(--ink)" }}>{rt.title}</h4>
                    <div className="text-[12px] mt-[3px] mb-[8px]" style={{ color: "var(--muted)" }}>{rt.loc} · {r.price} {perHr}</div>
                    <button onClick={(e) => { e.stopPropagation(); openDetail(r); }}
                      className="btn-primary w-full py-[8px] rounded-[9px] text-[12px]">{t("common.viewDetails")}</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

    </div>
  );
}
