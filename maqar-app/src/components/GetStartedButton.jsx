import { useRef, useState } from "react";
import { useT } from "../i18n/index.jsx";

// Adapted from "Get Started Button" by @marcellinleclercq on 21st.dev.
// Changes from the original: TypeScript types stripped (this project is plain JSX), the
// Next.js "use client" directive dropped (Vite has no such concept), hardcoded zinc
// colours swapped for the Maqar tokens so it follows light/dark, plus RTL and
// reduced-motion handling which the original did not have.

// Rotating from 350deg to 10deg should travel 20deg forward, not 340deg backward.
// This normalises the delta into [-180, 180] so the arrow always takes the short way.
function shortestAngle(from, to) {
  const diff = ((to - from + 540) % 360) - 180;
  return from + diff;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function GetStartedButton({ label, onClick, className = "" }) {
  const { t, lang } = useT();
  // Resting arrow direction points "forward", which mirrors in Arabic.
  const restAngle = lang === "ar" ? -135 : -45;

  const btnRef = useRef(null);
  // The original kept a parallel ref to accumulate the angle. A functional updater does
  // the same job from the previous state, so there is one source of truth instead of two.
  const [angle, setAngle] = useState(restAngle);

  function pointAt(next) {
    setAngle((cur) => shortestAngle(cur, next));
  }

  function handleMouseMove(e) {
    if (prefersReducedMotion()) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    pointAt(Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI));
  }

  const text = label ?? t("cta.getStarted");

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => pointAt(restAngle)}
      className={`group relative inline-flex h-14 items-center justify-center gap-2 overflow-hidden
        rounded-full border-2 border-transparent px-7 text-[14px] font-bold
        bg-fill-dark text-cream transition-colors duration-300
        hover:border-fill-dark hover:text-fill-dark
        focus-visible:border-fill-dark focus-visible:text-fill-dark
        motion-reduce:transition-none ${className}`}
    >
      {/* The fill that floods the pill on hover. scale-[40] on a 20px dot covers the
          whole button; it animates transform only, and is disabled under reduced motion. */}
      <span aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2
          scale-0 rounded-full bg-cream transition-transform duration-500 ease-out
          group-hover:scale-[40] group-focus-visible:scale-[40]
          motion-reduce:transition-none motion-reduce:group-hover:scale-0" />
      <span className="relative z-10">{text}</span>
      <svg aria-hidden="true" width={18} height={18} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        className="relative z-10 transition-transform duration-150 ease-linear motion-reduce:transition-none"
        style={{ transform: `rotate(${angle}deg)` }}>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  );
}
