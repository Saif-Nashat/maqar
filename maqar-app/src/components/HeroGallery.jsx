import { useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";
import { roomText } from "../data/rooms.js";
import GetStartedButton from "./GetStartedButton.jsx";

// Adapted from the "Gallery" component by @designali-in on 21st.dev.
// Differences from the original: framer-motion springs replaced with CSS transforms (no
// new dependencies), next/image replaced with plain <img> (Vite has no next/image), stock
// photos replaced with real Maqar rooms that link to their detail page, and rotations made
// deterministic — the original called Math.random() during render, which is impure and
// produces a different result on every render.
const FAN = [
  { x: "-320px", y: "18px", rot: "-3deg", z: 50 },
  { x: "-160px", y: "34px", rot: "2deg", z: 40 },
  { x: "0px", y: "6px", rot: "-1.5deg", z: 30 },
  { x: "160px", y: "26px", rot: "2.5deg", z: 20 },
  { x: "320px", y: "46px", rot: "-2deg", z: 10 },
];

export default function HeroGallery({ onCta }) {
  const { rooms } = useApp();
  const { t, lang } = useT();
  const nav = useNavigate();

  const picks = rooms.filter((r) => r.imgs?.length).slice(0, FAN.length);

  return (
    <section className="relative pt-[14px]">
      <p className="eyebrow text-center mb-[12px]">{t("hero.eyebrow")}</p>
      <h1 className="display font-semibold text-center mx-auto max-w-[780px] mb-[30px]">
        {t("hero.title")}
      </h1>

      <div className="fan mx-auto max-w-[1100px]">
        {picks.map((room, i) => {
          const f = FAN[i];
          const rt = roomText(room, lang);
          return (
            <div
              key={room.id}
              className="fan-card"
              style={{
                "--fx": f.x, "--fy": f.y, "--fr": f.rot,
                zIndex: f.z,
                animationDelay: `${0.12 + i * 0.09}s`,
              }}
            >
              {/* A button, not a bare image: these navigate, so they must be reachable
                  by keyboard and announce where they go. */}
              <button type="button" className="fan-inner" onClick={() => nav(`/room/${room.id}`)}>
                <img src={room.imgs[0]} alt={`${rt.title} — ${rt.loc}`}
                  className="w-full h-full object-cover" draggable={false} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Scrolls down to the room grid rather than sending people to sign-in. Browsing is
          open to everyone, so the first step is looking at rooms, not making an account.
          Shown to signed-in visitors too, since it is now a browse action. */}
      <div className="flex justify-center mt-[30px]">
        <GetStartedButton key={lang} onClick={onCta} />
      </div>
    </section>
  );
}
