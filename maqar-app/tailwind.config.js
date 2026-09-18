/** @type {import('tailwindcss').Config} */
export default {
  // Wraps every `hover:` utility in `@media (hover: hover)`. Without this, tapping on a
  // touch screen fires :hover and it sticks until you tap elsewhere — so a tapped card
  // stays lifted and a tapped chip stays raised. Default in Tailwind v4; opt-in on v3.
  future: { hoverOnlyWhenSupported: true },
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // These point at the CSS custom properties rather than hard-coded hex, so a
      // utility like `bg-foam` follows the `.dark` swap instead of staying light.
      // Previously `bg-foam` rendered #F6F0E7 in dark mode while --foam was #241A13.
      //
      // Trade-off: Tailwind's slash-opacity modifiers (`bg-foam/50`) do NOT work with
      // plain var() colours — that needs `rgb(var(--x) / <alpha-value>)` with the token
      // holding raw channels. Nothing in the codebase uses those modifiers today; if you
      // want one, write the rgba() inline or convert that token to channel form.
      colors: {
        espresso: "var(--espresso)",
        coffee: "var(--coffee)",
        crema: "var(--crema)",
        latte: "var(--latte)",
        foam: "var(--foam)",
        cream: "var(--cream)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        good: "var(--good)",
        warn: "var(--warn)",
        bad: "var(--bad)",
        verify: "var(--verify)",
        gold: "var(--gold)",
        // Tokens that previously existed only as CSS variables with no utility at all.
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-sunken": "var(--surface-sunken)",
        "surface-raised": "var(--surface-raised)",
        "surface-border": "var(--surface-border)",
        "fill-dark": "var(--fill-dark)",
        "fill-mid": "var(--fill-mid)",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        r: "16px",
        rs: "11px",
      },
      boxShadow: {
        soft: "0 1px 1px rgba(43,29,23,.04),0 4px 10px rgba(43,29,23,.05),0 14px 34px rgba(43,29,23,.08)",
        lg2: "0 2px 4px rgba(43,29,23,.06),0 12px 28px rgba(43,29,23,.10),0 32px 72px rgba(43,29,23,.16)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(.22,1,.36,1)",
      },
      maxWidth: {
        wrap: "1180px",
      },
      keyframes: {
        fade: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        screenIn: {
          from: { opacity: "0", transform: "translateY(10px) scale(.995)" },
          to: { opacity: "1", transform: "none" },
        },
        riseIn: {
          from: { opacity: "0", transform: "translateY(22px)" },
          to: { opacity: "1", transform: "none" },
        },
        popCheck: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        flipIn: {
          from: { opacity: "0", transform: "rotateX(-90deg) translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        modalIn: {
          from: { opacity: "0", transform: "translateY(14px) scale(.97)" },
          to: { opacity: "1", transform: "none" },
        },
        biIn: {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "none" },
        },
        mesh: {
          "0%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(-2%,1.5%) scale(1.05)" },
          "100%": { transform: "translate(1.5%,-1%) scale(1.02)" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        galRise: {
          from: { opacity: "0", transform: "translateY(16px) scale(1.03)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        fade: "fade .35s ease",
        screenIn: "screenIn .45s cubic-bezier(.22,1,.36,1)",
        modalIn: "modalIn .35s cubic-bezier(.22,1,.36,1)",
        floaty: "floaty 5s ease-in-out infinite",
        mesh: "mesh 16s ease-in-out infinite alternate",
        popCheck: "popCheck .6s cubic-bezier(.34,1.56,.64,1) .1s both",
      },
    },
  },
  plugins: [],
};
