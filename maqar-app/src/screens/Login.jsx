import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, User, Building2, Check, ShieldCheck } from "lucide-react";
import { useApp } from "../store/AppContext.jsx";
import { useSettings } from "../store/SettingsContext.jsx";
import { useT } from "../i18n/index.jsx";
import { roomText } from "../data/rooms.js";

// Identifier-first auth, following the flow in the Dumyah prototype (itself the Amazon
// pattern): one field decides where you go, and the identifier then rides along at the top
// of every later step with a Change affordance.
//
//   identify ──┬─ known email ──▶ signin
//              └─ new email   ──▶ new ──▶ create
//
// On "known": Supabase deliberately gives no way to ask whether an email is registered —
// that would be an account-enumeration hole, and both "no such user" and "wrong password"
// return the identical error. So the branch is decided from emails this device has signed
// in with before. A returning user on a fresh device therefore lands on "new"; that screen
// carries a sign-in link so it is never a dead end.
const KNOWN_KEY = "maqar-known-emails";

function knownEmails() {
  try { return JSON.parse(localStorage.getItem(KNOWN_KEY) || "[]"); } catch { return []; }
}
function rememberEmail(addr) {
  try {
    const list = knownEmails();
    if (!list.includes(addr)) localStorage.setItem(KNOWN_KEY, JSON.stringify([...list, addr]));
  } catch { /* private mode — the flow still works, it just always shows "new" */ }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { signUp, signIn, toast, consumePendingAction, rooms } = useApp();
  const { lang, toggleLang } = useSettings();
  const { t } = useT();
  const nav = useNavigate();

  const [step, setStep] = useState("identify");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pw2, setPw2] = useState("");
  const [acctType, setAcctType] = useState("user");
  const [showPw, setShowPw] = useState(false);
  const [keep, setKeep] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const addr = email.trim().toLowerCase();

  function goIdentify() {
    if (!EMAIL_RE.test(addr)) { setErr(t("auth.badEmail")); return; }
    setErr("");
    setStep(knownEmails().includes(addr) ? "signin" : "new");
  }

  function reset() {
    setStep("identify"); setPassword(""); setName(""); setPw2(""); setErr("");
  }

  // Both paths land here: sign in or create, then resume whatever sent the user to login.
  async function finish(isSignup) {
    setBusy(true);
    const res = isSignup
      ? await signUp({ email: addr, password, type: acctType, name })
      : await signIn({ email: addr, password, type: acctType });
    setBusy(false);
    if (!res.ok) { setErr(res.error || t("auth.signinFailed")); return; }
    rememberEmail(addr);
    if (isSignup) toast(t("login.welcomeToast"));
    const destinationType = res.type || acctType;
    const action = consumePendingAction();
    if (destinationType === "user" && action) action();
    else nav(destinationType === "host" ? "/host" : "/me");
  }

  function submitCreate() {
    if (!name.trim()) { setErr(t("auth.nameRequired")); return; }
    if (password.length < 6) { setErr(t("auth.pwTooShort")); return; }
    if (password !== pw2) { setErr(t("auth.pwMismatch")); return; }
    setErr("");
    finish(true);
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,420px)_1fr] min-h-[calc(100dvh-64px)]">
      <BrandPanel rooms={rooms} lang={lang} t={t} />

      <div className="flex flex-col px-[22px] py-[18px]">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => nav("/")} className="flex items-center gap-[6px] text-[13px] font-semibold transition-colors hover:opacity-70"
            style={{ color: "var(--muted)" }}>
            <ArrowLeft className="w-[15px] h-[15px] rtl:rotate-180" /> {t("auth.backToRooms")}
          </button>
          <div className="flex-1" />
          <button onClick={toggleLang} className="chip !py-[5px] !text-[12px]">{lang === "ar" ? "English" : "العربية"}</button>
        </div>

        <div className="flex-1 grid place-items-center py-[28px]">
          <div className="w-full max-w-[360px]">
            {step === "identify" && (
              <Identify
                t={t} email={email} setEmail={setEmail} err={err} onContinue={goIdentify} />
            )}

            {step === "new" && (
              <NewHere t={t} addr={addr} onChange={reset}
                onCreate={() => { setErr(""); setStep("create"); }}
                onSignin={() => { setErr(""); setStep("signin"); }} />
            )}

            {step === "signin" && (
              <SignIn t={t} addr={addr} onChange={reset} err={err} busy={busy}
                password={password} setPassword={setPassword}
                showPw={showPw} setShowPw={setShowPw} keep={keep} setKeep={setKeep}
                onSubmit={() => finish(false)}
                onCreate={() => { setErr(""); setStep("create"); }} />
            )}

            {step === "create" && (
              <CreateAccount t={t} addr={addr} onChange={reset} err={err} busy={busy}
                acctType={acctType} setAcctType={setAcctType}
                name={name} setName={setName}
                password={password} setPassword={setPassword} pw2={pw2} setPw2={setPw2}
                showPw={showPw} setShowPw={setShowPw}
                onSubmit={submitCreate}
                onSignin={() => { setErr(""); setStep("signin"); }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- left brand panel ---------- */

function BrandPanel({ rooms, lang, t }) {
  const picks = useMemo(() => rooms.filter((r) => r.imgs?.length).slice(0, 3), [rooms]);
  return (
    <aside className="hidden lg:flex flex-col justify-between p-[30px] relative overflow-hidden"
      style={{ background: "linear-gradient(165deg,var(--fill-mid),var(--fill-dark))" }}>
      <div className="font-serif font-semibold text-[27px] tracking-[-.6px] leading-none relative z-[1]"
        style={{ color: "var(--cream)" }}>
        {lang === "ar" ? "مَقَر" : "Maqar"}
      </div>

      <div className="relative z-[1] flex flex-col gap-[14px] my-[26px]">
        {picks.map((r, i) => {
          const rt = roomText(r, lang);
          return (
            <div key={r.id} className="rounded-[16px] overflow-hidden relative"
              style={{
                boxShadow: "0 18px 40px rgba(0,0,0,.35)",
                transform: `rotate(${i % 2 ? 1.4 : -1.4}deg)`,
                border: "4px solid rgba(251,247,240,.12)",
              }}>
              <img src={r.imgs[0]} alt="" className="w-full h-[104px] object-cover" />
              <span className="absolute bottom-[8px] start-[10px] text-[12px] font-semibold px-[9px] py-[3px] rounded-full"
                style={{ background: "rgba(36,24,18,.72)", color: "var(--cream)", backdropFilter: "blur(6px)" }}>
                {rt.loc}
              </span>
            </div>
          );
        })}
      </div>

      <div className="relative z-[1]">
        <span className="inline-flex items-center gap-[6px] text-[12px] font-bold px-[11px] py-[5px] rounded-full mb-[14px]"
          style={{ background: "rgba(251,247,240,.14)", color: "var(--cream)" }}>
          <ShieldCheck className="w-[13px] h-[13px]" />
          <span className="num">{t("auth.heroStat", { n: rooms.length })}</span>
        </span>
        <p className="display-sm font-semibold" style={{ color: "var(--cream)" }}>{t("auth.heroHeadline")}</p>
      </div>
    </aside>
  );
}

/* ---------- shared bits ---------- */

function IdChip({ addr, onChange, t }) {
  return (
    <div className="flex items-center gap-2 mb-[16px] px-[13px] py-[10px] rounded-[11px]"
      style={{ background: "var(--surface-sunken)", border: "1px solid var(--line)" }}>
      <span className="flex-1 min-w-0 truncate text-[14px] font-medium" dir="ltr" style={{ color: "var(--ink)" }}>{addr}</span>
      <button onClick={onChange} className="text-[13px] font-bold shrink-0 hover:underline" style={{ color: "var(--gold)" }}>
        {t("auth.change")}
      </button>
    </div>
  );
}

function Err({ msg }) {
  if (!msg) return null;
  return <p className="text-[13px] font-medium mt-[7px]" style={{ color: "var(--bad)" }} role="alert">{msg}</p>;
}

function Primary({ children, onClick, busy }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="btn-primary w-full rounded-[11px] py-[12px] text-[15px] flex items-center justify-center gap-[7px] mt-[16px] disabled:opacity-60">
      {children}
    </button>
  );
}

function PwField({ label, value, onChange, placeholder, show, setShow, extra }) {
  return (
    <>
      <div className="flex items-baseline justify-between mb-[6px]">
        <label className="text-[13px] font-bold" style={{ color: "var(--coffee)" }}>{label}</label>
        {extra}
      </div>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} className="field-input pe-[42px]" dir="ltr" />
        <button type="button" onClick={() => setShow(!show)} tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute end-[12px] top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }}>
          {show ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
        </button>
      </div>
    </>
  );
}

/* ---------- step 1 ---------- */

function Identify({ t, email, setEmail, err, onContinue }) {
  return (
    <>
      <h1 className="display-sm font-semibold mb-[6px]">{t("auth.identifyTitle")}</h1>
      <p className="text-[14px] mb-[20px]" style={{ color: "var(--muted)" }}>{t("auth.identifySub")}</p>

      <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("login.email")}</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onContinue()}
        placeholder="you@example.com" className="field-input" dir="ltr" autoFocus />
      <Err msg={err} />

      {/* Mobile sign-in needs Supabase's Phone provider plus an SMS gateway; neither is set
          up, so it is shown as coming rather than as a control that does nothing. */}
      <p className="text-[12px] mt-[9px] flex items-center gap-[6px]" style={{ color: "var(--muted)" }}>
        {t("auth.mobileSoon")} <SoonChip t={t} />
      </p>

      <Primary onClick={onContinue}>{t("auth.continue")} <ArrowRight className="w-[16px] h-[16px] rtl:rotate-180" /></Primary>
      <p className="text-[12px] mt-[11px] leading-[1.5]" style={{ color: "var(--muted)" }}>{t("auth.privacy")}</p>

      <SocialRow t={t} />
    </>
  );
}

function SoonChip({ t }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[.06em] px-[6px] py-[2px] rounded-full"
      style={{ background: "var(--surface-sunken)", color: "var(--muted)" }}>{t("login.soon")}</span>
  );
}

// Google / Facebook / Apple are all disabled in this project's Supabase auth settings, so
// these advertise the roadmap rather than pretending to work. Enabling any of them means
// an OAuth app and redirect URLs per provider.
const SOCIALS = ["Google", "Facebook", "Apple"];

function SocialRow({ t }) {
  return (
    <>
      <div className="flex items-center gap-3 my-[18px]">
        <span className="flex-1 h-px" style={{ background: "var(--line)" }} />
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>{t("auth.orContinue")}</span>
        <span className="flex-1 h-px" style={{ background: "var(--line)" }} />
      </div>
      <div className="grid grid-cols-3 gap-[8px]">
        {SOCIALS.map((s) => (
          <button key={s} disabled aria-disabled="true" title={t("login.soon")}
            className="flex flex-col items-center gap-[3px] py-[9px] rounded-[10px] text-[12px] font-semibold opacity-50 cursor-not-allowed"
            style={{ border: "1px solid var(--line)", background: "var(--surface)", color: "var(--coffee)" }}>
            {s}
            <span className="text-[9px] font-bold uppercase tracking-[.06em]" style={{ color: "var(--muted)" }}>{t("login.soon")}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ---------- step 2a ---------- */

function NewHere({ t, addr, onChange, onCreate, onSignin }) {
  return (
    <>
      <h1 className="display-sm font-semibold mb-[6px]">{t("auth.newTitle")}</h1>
      <p className="text-[14px] mb-[20px]" style={{ color: "var(--muted)" }}>{t("auth.newSub")}</p>
      <IdChip addr={addr} onChange={onChange} t={t} />
      <Primary onClick={onCreate}>{t("auth.createYourAccount")}</Primary>
      <button onClick={onChange}
        className="w-full rounded-[11px] py-[11px] text-[14px] font-bold mt-[9px] transition-colors hover:bg-foam"
        style={{ border: "1px solid var(--line)", color: "var(--coffee)" }}>
        {t("auth.tryAnother")}
      </button>
      {/* This device has not seen the address before, which is not the same as the account
          not existing. Always offer the way back to sign-in. */}
      <p className="text-[13px] text-center mt-[16px]" style={{ color: "var(--muted)" }}>
        {t("login.haveAccount")}{" "}
        <button onClick={onSignin} className="font-bold hover:underline" style={{ color: "var(--gold)" }}>{t("auth.signinInstead")}</button>
      </p>
    </>
  );
}

/* ---------- step 2b ---------- */

function SignIn({ t, addr, onChange, err, busy, password, setPassword, showPw, setShowPw, keep, setKeep, onSubmit, onCreate }) {
  return (
    <>
      <h1 className="display-sm font-semibold mb-[16px]">{t("auth.signinTitle")}</h1>
      <IdChip addr={addr} onChange={onChange} t={t} />

      <PwField label={t("login.password")} value={password} onChange={setPassword}
        placeholder={t("auth.pwPlaceholder")} show={showPw} setShow={setShowPw}
        extra={<span className="text-[12px] font-semibold flex items-center gap-[5px]" style={{ color: "var(--muted)" }}>
          {t("auth.forgot")} <SoonChip t={t} />
        </span>} />
      <Err msg={err} />

      <label className="flex items-center gap-[9px] mt-[14px] cursor-pointer select-none">
        <span className="w-[19px] h-[19px] rounded-[6px] grid place-items-center shrink-0 transition-colors"
          style={keep
            ? { background: "var(--fill-dark)", color: "var(--cream)" }
            : { border: "1px solid var(--line)", background: "var(--surface)" }}>
          {keep && <Check className="w-[13px] h-[13px]" strokeWidth={3} />}
        </span>
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="sr-only" />
        <span className="text-[13px]" style={{ color: "var(--coffee)" }}>{t("auth.keepSignedIn")}</span>
      </label>

      <Primary onClick={onSubmit} busy={busy}>{t("auth.signinTitle")}</Primary>
      <p className="text-[13px] text-center mt-[16px]" style={{ color: "var(--muted)" }}>
        {t("login.noAccount")}{" "}
        <button onClick={onCreate} className="font-bold hover:underline" style={{ color: "var(--gold)" }}>{t("auth.createYourAccount")}</button>
      </p>
    </>
  );
}

/* ---------- step 3 ---------- */

function CreateAccount({ t, addr, onChange, err, busy, acctType, setAcctType, name, setName, password, setPassword, pw2, setPw2, showPw, setShowPw, onSubmit, onSignin }) {
  return (
    <>
      <h1 className="display-sm font-semibold mb-[4px]">{t("auth.createTitle")}</h1>
      <p className="text-[13px] mb-[18px]" style={{ color: "var(--muted)" }}>{t("auth.allRequired")}</p>
      <IdChip addr={addr} onChange={onChange} t={t} />

      {/* The one addition to the prototype's flow: which kind of account this is. It sits
          first because it changes where the user lands after signing up. */}
      <span className="block text-[13px] font-bold mb-[7px]" style={{ color: "var(--coffee)" }}>{t("auth.chooseType")}</span>
      <div className="grid grid-cols-2 gap-[9px] mb-[16px]">
        <RoleCard active={acctType === "user"} onClick={() => setAcctType("user")} Icon={User} title={t("auth.guest")} sub={t("auth.guestSub")} />
        <RoleCard active={acctType === "host"} onClick={() => setAcctType("host")} Icon={Building2} title={t("auth.host")} sub={t("auth.hostSub")} />
      </div>

      <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("auth.yourName")}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.namePlaceholder")} className="field-input mb-[14px]" />

      <PwField label={t("auth.pwLabel")} value={password} onChange={setPassword}
        placeholder={t("auth.pwCreatePlaceholder")} show={showPw} setShow={setShowPw} />

      <div className="mt-[14px]">
        <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("auth.pw2Label")}</label>
        <input type={showPw ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)}
          placeholder={t("auth.pw2Placeholder")} className="field-input" dir="ltr" />
      </div>
      <Err msg={err} />

      <Primary onClick={onSubmit} busy={busy}>{t("auth.continue")} <ArrowRight className="w-[16px] h-[16px] rtl:rotate-180" /></Primary>
      <p className="text-[12px] mt-[11px] leading-[1.5]" style={{ color: "var(--muted)" }}>{t("auth.createPrivacy")}</p>
      <p className="text-[13px] text-center mt-[14px]" style={{ color: "var(--muted)" }}>
        {t("login.haveAccount")}{" "}
        <button onClick={onSignin} className="font-bold hover:underline" style={{ color: "var(--gold)" }}>{t("auth.signinInstead")}</button>
      </p>
    </>
  );
}

function RoleCard({ active, onClick, Icon, title, sub }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className="text-start p-[11px] rounded-[13px] transition relative"
      style={active
        ? { background: "var(--surface)", border: "2px solid var(--crema)", boxShadow: "var(--shadow)" }
        : { background: "var(--surface-sunken)", border: "2px solid transparent" }}>
      <span className="w-[30px] h-[30px] rounded-[9px] grid place-items-center mb-[7px]"
        style={active
          ? { background: "var(--crema)", color: "var(--fill-dark)" }
          : { background: "var(--surface)", color: "var(--muted)" }}>
        <Icon className="w-[16px] h-[16px]" />
      </span>
      <span className="block font-sans text-[13px] font-bold leading-tight">{title}</span>
      <span className="block text-[11px] mt-[2px] leading-tight" style={{ color: "var(--muted)" }}>{sub}</span>
    </button>
  );
}
