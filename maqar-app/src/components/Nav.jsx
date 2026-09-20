import { useNavigate } from "react-router-dom";
import { Sun, Moon, User, Building2, MessageCircle, Download } from "lucide-react";
import { useApp } from "../store/AppContext.jsx";
import { useSettings } from "../store/SettingsContext.jsx";
import { useT } from "../i18n/index.jsx";
import { useInstallPrompt } from "../lib/usePwa.js";

export default function Nav() {
  const nav = useNavigate();
  const { accountType, loggedIn, signOut } = useApp();
  const { theme, toggleTheme, lang, toggleLang } = useSettings();
  const { t } = useT();
  const { canInstall, promptInstall } = useInstallPrompt();

  function goDash() {
    if (!loggedIn) { nav("/login"); return; }
    nav(accountType === "host" ? "/host" : "/me");
  }
  async function handleAuth() {
    if (loggedIn) { await signOut(); nav("/"); }
    else nav("/login");
  }

  const iconBtn = "w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] shrink-0 grid place-items-center rounded-full transition-colors hover:bg-foam";
  const isHost = accountType === "host";

  return (
    <nav className="sticky top-0 z-[60] border-b"
      style={{
        background: "var(--nav-bg)",
        backdropFilter: "blur(18px) saturate(1.3)",
        borderColor: "rgba(201,162,126,.35)",
        boxShadow: "0 1px 0 rgba(255,255,255,.6) inset,0 6px 24px rgba(43,29,23,.05)",
      }}>
      {/* Tighter gutters and gaps below sm. At 375px the signed-in nav was 502px wide —
          127px past the viewport — so every page clipped its right-hand controls. */}
      <div className="max-w-wrap mx-auto px-[14px] sm:px-[22px] py-3 flex items-center gap-[7px] sm:gap-[14px]">
        <div className="flex items-center cursor-pointer" onClick={() => nav("/")}>
          {/* Wordmark only. The MQR badge was removed; the wordmark now carries the brand
              on its own, so it is sized up from 24px to 27px to hold the same weight. */}
          <div className="font-serif font-semibold text-[27px] tracking-[-.6px] leading-none"
            style={{
              background: "linear-gradient(110deg,var(--espresso) 60%,var(--coffee))",
              WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
            {lang === "ar" ? "مَقَر" : "Maqar"}
          </div>
        </div>

        <div className="flex-1" />

        {canInstall && (
          <button onClick={promptInstall} className="hidden sm:flex items-center gap-[6px] h-[38px] px-[13px] rounded-full text-[13px] font-bold transition-colors hover:bg-foam"
            style={{ color: "var(--coffee)", border: "1px solid var(--line)" }} title={t("pwa.install")}>
            <Download className="w-[15px] h-[15px]" /> {t("pwa.install")}
          </button>
        )}
        <button onClick={toggleTheme} className={iconBtn} style={{ color: "var(--coffee)" }} aria-label="Toggle theme" title="Theme">
          {theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        <button onClick={toggleLang}
          className="h-[34px] sm:h-[38px] min-w-[34px] sm:min-w-[40px] shrink-0 px-2 sm:px-3 grid place-items-center rounded-full text-[13px] font-bold transition-colors hover:bg-foam"
          style={{ color: "var(--coffee)", border: "1px solid var(--line)" }} aria-label="Toggle language" title="Language">
          {lang === "ar" ? "EN" : "ع"}
        </button>

        {loggedIn && (
          <>
            <button onClick={() => nav("/messages")} className={iconBtn} style={{ color: "var(--coffee)" }} aria-label={t("nav.messages")} title={t("nav.messages")}>
              <MessageCircle className="w-[18px] h-[18px]" />
            </button>
            {/* Account badge and Dashboard button were two separate items saying the same
                thing — the badge named the account type, the button went to that account's
                dashboard. Merged into one chip: it still shows which account you are, and
                tapping it goes there. Saves ~100px and one redundant control.
                The label is hidden below sm so the chip collapses to its icon. */}
            <button onClick={goDash}
              aria-label={t("nav.dashboard")} title={t("nav.dashboard")}
              className="flex items-center gap-[6px] h-[34px] sm:h-[38px] px-[9px] sm:px-[13px] rounded-full text-[13px] font-bold transition-colors hover:bg-foam"
              style={{ background: "var(--foam)", border: "1px solid var(--line)", color: "var(--coffee)" }}>
              {isHost ? <Building2 className="w-[15px] h-[15px] shrink-0" /> : <User className="w-[15px] h-[15px] shrink-0" />}
              <span className="hidden sm:inline whitespace-nowrap">
                {isHost ? t("nav.hostBadge") : t("nav.guestBadge")}
              </span>
            </button>
          </>
        )}
        <button onClick={handleAuth} className="btn-primary shrink-0 px-[12px] sm:px-[18px] py-[8px] sm:py-[9px] rounded-full text-[13px] sm:text-[14px] whitespace-nowrap">
          {loggedIn ? t("nav.signout") : t("nav.signin")}
        </button>
      </div>
    </nav>
  );
}
