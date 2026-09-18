import { useMemo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, LayoutGrid, Navigation } from "lucide-react";
import { useApp } from "../store/AppContext.jsx";
import GetStartedButton from "../components/GetStartedButton.jsx";
import { useT } from "../i18n/index.jsx";
import { distanceKm } from "../lib/geo.js";
import MapView from "../components/MapView.jsx";
import Filters from "../components/Filters.jsx";
import RoomCard from "../components/RoomCard.jsx";
import HeroSearch from "../components/HeroSearch.jsx";

function useFiltered(filters, all) {
  return useMemo(() => {
    let r = all.filter((rm) => {
      if (filters.type !== "all" && rm.type !== filters.type) return false;
      if (rm.cap < filters.minCap) return false;
      if (filters.feats.length && !filters.feats.every((f) => rm.feats.includes(f))) return false;
      return true;
    });
    const s = filters.sort;
    if (s === "price-low") r = [...r].sort((a, b) => a.price - b.price);
    else if (s === "price-high") r = [...r].sort((a, b) => b.price - a.price);
    else if (s === "cap") r = [...r].sort((a, b) => b.cap - a.cap);
    else if (s === "verified") r = [...r].sort((a, b) => b.verified - a.verified);
    return r;
  }, [filters, all]);
}

export default function Home() {
  const { filters, favorites, toast, rooms: allRooms, loggedIn } = useApp();
  const { t, lang } = useT();
  const nav = useNavigate();
  const base = useFiltered(filters, allRooms);
  const gridRef = useRef(null);
  const resultsRef = useRef(null);

  const [hoveredId, setHoveredId] = useState(null);
  const [layer, setLayer] = useState("all");
  const [userLoc, setUserLoc] = useState(null);
  const [locating, setLocating] = useState(false);

  // apply favorites layer + distance sort
  const display = useMemo(() => {
    let list = layer === "fav" ? base.filter((r) => favorites.includes(r.id)) : base;
    let withDist = list.map((r) => ({ room: r, dist: userLoc ? distanceKm(userLoc, { lat: r.lat, lng: r.lng }) : null }));
    if (userLoc) withDist = [...withDist].sort((a, b) => a.dist - b.dist);
    return withDist;
  }, [base, layer, favorites, userLoc]);

  const rooms = display.map((d) => d.room);
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  function nearMe() {
    if (!navigator.geolocation) { toast(t("map.geoDenied")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); toast(t("map.nearMe")); },
      () => { setLocating(false); toast(t("map.geoDenied")); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    gridRef.current?.querySelectorAll(".reveal").forEach((c, i) => {
      c.style.transitionDelay = i * 60 + "ms";
      obs.observe(c);
    });
    return () => obs.disconnect();
  }, [rooms]);

  return (
    <>
      <div className="wrap relative pt-[30px] pb-[10px]">
        {/* right-0, not -right-16: the negative offset pushed this 64px past the viewport
            and gave the whole page a horizontal scrollbar. It is a blurred radial gradient
            that fades out by 65%, so moving it flush costs nothing visually. */}
        <div className="absolute -top-10 right-0 w-[420px] h-[420px] pointer-events-none -z-0 blur-[8px]"
          style={{ background: "radial-gradient(circle,rgba(201,162,126,.22),transparent 65%)" }} />
        <div className="absolute left-0 right-0 -top-[10%] h-[380px] -z-0 pointer-events-none blur-[10px] animate-mesh"
          style={{ background: "radial-gradient(40% 50% at 15% 30%,rgba(201,162,126,.18),transparent 70%),radial-gradient(35% 45% at 80% 20%,rgba(74,52,42,.10),transparent 70%),radial-gradient(45% 55% at 60% 70%,rgba(232,220,203,.35),transparent 70%)" }} />

        <div className="relative z-[1] flex items-end justify-between gap-5 flex-wrap mb-[18px]">
          <h1 className="display font-semibold max-w-[620px]"
            style={{ animation: "riseIn .9s cubic-bezier(.22,1,.36,1) .08s both" }}>
            {t("home.heroPre")} <em className="italic" style={{ color: "var(--crema)" }}>{t("home.heroEm")}</em> {t("home.heroPost")}
          </h1>
          <div className="max-w-[330px] pb-[6px]" style={{ animation: "riseIn .9s cubic-bezier(.22,1,.36,1) .22s both" }}>
            <p className="text-[15px] leading-[1.65]" style={{ color: "var(--muted)" }}>
              {t("home.heroSub")}
            </p>
            {/* Signed-out visitors previously had no prominent way to create an account —
                only "Sign in" in the nav. Browsing stays open; this is the sign-up path. */}
            {/* key={lang}: the arrow's resting direction mirrors for Arabic, and it is a
                useState initial value — which React only reads on mount. Keying by lang
                remounts the button on a language switch so the angle actually follows. */}
            {!loggedIn && (
              <GetStartedButton key={lang} className="mt-[18px]" onClick={() => nav("/login")} />
            )}
          </div>
        </div>

        <div className="relative z-[1] mb-[18px]" style={{ animation: "riseIn .95s cubic-bezier(.22,1,.36,1) .3s both" }}>
          <HeroSearch onSearch={scrollToResults} />
        </div>

        <div className="relative z-[1]" style={{ animation: "riseIn 1s cubic-bezier(.22,1,.36,1) .42s both" }}>
          <MapView rooms={rooms} activeId={hoveredId} onHoverPin={setHoveredId} userLoc={userLoc} />
        </div>

        <div className="relative z-[1]" style={{ animation: "riseIn .9s cubic-bezier(.22,1,.36,1) .46s both" }}>
          <Filters />
        </div>

        <div ref={resultsRef} className="relative z-[1] flex items-end justify-between gap-3 flex-wrap mt-[34px] mb-4 scroll-mt-[80px]">
          <h2 className="text-[26px] font-semibold tracking-[-.4px] title-rule">{t("home.roomsNear")}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* layer toggle */}
            <div className="flex p-[3px] rounded-full" style={{ background: "var(--foam)", border: "1px solid var(--line)" }}>
              <button onClick={() => setLayer("all")} className="flex items-center gap-1 px-[12px] py-[6px] rounded-full text-[12px] font-bold transition-colors"
                style={layer === "all" ? { background: "var(--fill-dark)", color: "var(--cream)" } : { color: "var(--muted)" }}>
                <LayoutGrid className="w-[13px] h-[13px]" /> {t("map.layerAll")}
              </button>
              <button onClick={() => setLayer("fav")} className="flex items-center gap-1 px-[12px] py-[6px] rounded-full text-[12px] font-bold transition-colors"
                style={layer === "fav" ? { background: "var(--fill-dark)", color: "var(--cream)" } : { color: "var(--muted)" }}>
                <Heart className="w-[13px] h-[13px]" style={{ fill: layer === "fav" ? "var(--cream)" : "transparent" }} /> {t("map.layerFav")}
              </button>
            </div>
            <button onClick={nearMe} disabled={locating}
              className="flex items-center gap-[6px] px-[14px] py-[8px] rounded-full text-[12px] font-bold transition-colors"
              style={{ background: userLoc ? "var(--verify)" : "var(--foam)", color: userLoc ? "#fff" : "var(--coffee)", border: "1px solid var(--line)" }}>
              <Navigation className="w-[13px] h-[13px]" /> {locating ? t("map.locating") : t("map.nearMe")}
            </button>
            <span className="text-[13px] font-medium" style={{ color: "var(--muted)" }}>
              {lang === "ar" ? `${rooms.length} قاعة` : `${rooms.length} room${rooms.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-10">
          {display.length ? (
            display.map(({ room, dist }) => (
              <div key={room.id} className="reveal">
                <RoomCard room={room} onHover={setHoveredId} active={hoveredId === room.id}
                  distanceKm={dist != null ? dist.toFixed(1) : undefined} />
              </div>
            ))
          ) : (
            <div className="text-center py-10 col-span-full" style={{ color: "var(--muted)" }}>
              {t("home.noMatch")}
            </div>
          )}
        </div>
      </div>

      <footer className="text-center py-[30px] text-[13px]" style={{ borderTop: "1px solid rgba(201,162,126,.3)", color: "var(--muted)" }}>
        <div className="inline-block px-3 py-[5px] rounded-full font-semibold mb-[10px]"
          style={{ background: "var(--foam)", border: "1px solid var(--line)", color: "var(--coffee)" }}>
          {t("footer.proto")}
        </div>
        <div>{t("footer.tagline")}</div>
      </footer>
    </>
  );
}
