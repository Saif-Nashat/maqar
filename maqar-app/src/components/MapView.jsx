import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useApp } from "../store/AppContext.jsx";
import { useSettings } from "../store/SettingsContext.jsx";
import { useT } from "../i18n/index.jsx";
import { roomText, AMMAN_CENTER } from "../data/rooms.js";

// CARTO now watermarks keyless basemap tiles with "API KEY REQUIRED". Supply a key
// via VITE_CARTO_KEY and the watermark goes away; without one the map still works,
// same demo-vs-live spirit as the Supabase gate.
// NOTE: confirm the query-parameter name against your CARTO dashboard when you get
// the key — this assumes `api_key`, which is their documented basemap parameter.
const CARTO_KEY = import.meta.env.VITE_CARTO_KEY;
const KEY_Q = CARTO_KEY ? `?api_key=${CARTO_KEY}` : "";
const TILES = {
  light: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${KEY_Q}`,
  dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${KEY_Q}`,
};
const ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function priceIcon(price, cur, active) {
  return L.divIcon({
    className: "maqar-pin-wrap",
    html: `<div class="maqar-pin${active ? " active" : ""}">${price}<span>${cur}</span></div>`,
    iconSize: [54, 32],
    iconAnchor: [27, 34],
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
  const cur = lang === "ar" ? "د.أ" : "JOD";
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
        <TileLayer key={theme} url={theme === "dark" ? TILES.dark : TILES.light} attribution={ATTRIB} />
        {userLoc && <Marker position={[userLoc.lat, userLoc.lng]} icon={userIcon} />}
        {rooms.map((r) => {
          const rt = roomText(r, lang);
          return (
            <Marker key={r.id} position={[r.lat, r.lng]} icon={priceIcon(r.price, cur, activeId === r.id)}
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

      {/* overlays */}
      <div className="absolute top-[14px] left-[14px] right-[14px] flex gap-[10px] items-center z-[500] pointer-events-none">
        <div className="flex items-center gap-1 rounded-full px-[14px] py-2 text-[13px] font-semibold"
          style={{ background: "rgba(251,247,240,.92)", backdropFilter: "blur(8px)", border: "1px solid var(--line)", color: "var(--fill-dark)", boxShadow: "var(--shadow)" }}>
          <MapPin className="w-[14px] h-[14px]" /> {t("search.amman")}
        </div>
        <div className="rounded-full px-[14px] py-2 text-[13px] font-semibold"
          style={{ background: "rgba(251,247,240,.92)", backdropFilter: "blur(8px)", border: "1px solid var(--line)", color: "var(--fill-dark)", boxShadow: "var(--shadow)" }}>
          {t("map.roomsShown", { n: rooms.length })}
        </div>
      </div>
    </div>
  );
}
