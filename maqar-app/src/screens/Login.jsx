import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, User, Building2, Check } from "lucide-react";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";

export default function Login() {
  const nav = useNavigate();
  const { signUp, signIn, toast, pendingAction } = useApp();
  const { t } = useT();
  const [signup, setSignup] = useState(false);
  const [method, setMethod] = useState("phone");
  const [acctType, setAcctType] = useState("user");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("demo@maqar.app");
  const [password, setPassword] = useState("demo1234");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = signup
      ? await signUp({ email, password, type: acctType, name })
      : await signIn({ email, password, type: acctType });
    setBusy(false);
    if (!res.ok) { toast(res.error || "Could not sign in."); return; }
    if (signup) toast(t("login.welcomeToast"));
    const action = pendingAction.current;
    pendingAction.current = null;
    if (acctType === "user" && action) {
      action(); // resume e.g. a booking
    } else {
      nav(acctType === "host" ? "/host" : "/me");
    }
  }

  return (
    <div className="max-w-[430px] mx-auto my-[50px] px-[22px]">
      <div className="surface p-[30px]" style={{ boxShadow: "var(--shadow-lg)" }}>
        <h1 className="text-[26px] font-semibold mb-1">{signup ? t("login.createTitle") : t("login.welcomeBack")}</h1>
        <p className="text-[14px] mb-6" style={{ color: "var(--muted)" }}>
          {signup ? t("login.subSignup") : t("login.subSignin")}
        </p>

        {/* account-type chooser */}
        <span className="eyebrow block mb-[10px]">{t("auth.chooseType")}</span>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <TypeCard active={acctType === "user"} onClick={() => setAcctType("user")} Icon={User} title={t("auth.guest")} sub={t("auth.guestSub")} />
          <TypeCard active={acctType === "host"} onClick={() => setAcctType("host")} Icon={Building2} title={t("auth.host")} sub={t("auth.hostSub")} />
        </div>

        <Tabs options={[["signin", t("login.signinTab")], ["signup", t("login.signupTab")]]} value={signup ? "signup" : "signin"} onChange={(v) => setSignup(v === "signup")} pill />

        {signup && <Field label={t("login.fullName")}><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sara Odeh" className="field-input" /></Field>}

        <div className="mb-[14px] mt-4">
          <Tabs options={[["phone", t("login.phoneTab")], ["email", t("login.emailTab")]]} value={method} onChange={setMethod} />
        </div>

        {method === "phone"
          ? <Field label={t("login.phone")}><input type="tel" defaultValue="07 9 123 4567" className="field-input" dir="ltr" /></Field>
          : null}
        <Field label={t("login.email")}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="field-input" dir="ltr" /></Field>

        <Field label={t("login.password")}><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field-input" dir="ltr" /></Field>
        {signup && <Field label={t("login.confirmPw")}><input type="password" placeholder="••••••••" className="field-input" dir="ltr" /></Field>}

        <div className="flex gap-[9px] rounded-rs p-[13px] px-[15px] text-[12.5px] my-[14px] mb-[18px]" style={{ background: "var(--foam)", border: "1px solid var(--line)", color: "var(--muted)" }}>
          <ShieldCheck className="w-[18px] h-[18px] shrink-0" style={{ color: "var(--crema)" }} />
          <span>{t("login.guarantee")}</span>
        </div>

        <button className="btn-primary w-full py-[13px] rounded-xl text-[15px]" onClick={submit} disabled={busy}>
          {signup ? t("login.submitSignup") : t("login.submitSignin")}
        </button>

        <p className="text-center text-[13px] mt-4" style={{ color: "var(--muted)" }}>
          {signup ? t("login.haveAccount") + " " : t("login.noAccount") + " "}
          <button onClick={() => setSignup(!signup)} className="font-bold underline underline-offset-2" style={{ color: "var(--coffee)" }}>
            {signup ? t("login.signinLink") : t("login.createOne")}
          </button>
        </p>
      </div>
    </div>
  );
}

function TypeCard({ active, onClick, Icon, title, sub }) {
  return (
    <button onClick={onClick} className="relative text-start p-[14px] rounded-[14px] transition-all"
      style={active
        ? { background: "var(--surface)", border: "1.5px solid var(--crema)", boxShadow: "0 6px 16px rgba(201,162,126,.22)" }
        : { background: "var(--foam)", border: "1.5px solid var(--line)" }}>
      <span className="w-[36px] h-[36px] rounded-[10px] grid place-items-center mb-[10px]"
        style={active ? { background: "var(--crema)", color: "var(--fill-dark)" } : { background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--line)" }}>
        <Icon className="w-[19px] h-[19px]" />
      </span>
      <div className="font-bold text-[14px]" style={{ color: active ? "var(--espresso)" : "var(--coffee)" }}>{title}</div>
      <div className="text-[12px] mt-[2px]" style={{ color: "var(--muted)" }}>{sub}</div>
      {active && (
        <span className="absolute top-[12px] end-[12px] w-[20px] h-[20px] rounded-full grid place-items-center" style={{ background: "var(--verify)", color: "#fff" }}>
          <Check className="w-[13px] h-[13px]" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{label}</label>
      {children}
    </div>
  );
}

function Tabs({ options, value, onChange, pill }) {
  return (
    <div className={pill ? "flex rounded-rs p-1 mb-5" : "flex gap-2"} style={pill ? { background: "var(--foam)" } : undefined}>
      {options.map(([v, label]) => {
        const on = value === v;
        return (
          <button key={v} onClick={() => onChange(v)}
            className={`flex-1 py-[9px] rounded-lg text-[14px] font-semibold transition-all`}
            style={on
              ? { background: "var(--surface)", color: "var(--espresso)", boxShadow: "var(--shadow)" }
              : { color: "var(--muted)" }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
