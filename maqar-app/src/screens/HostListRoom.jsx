import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import {
  ChevronLeft, Building2, MapPin, Camera, Sparkles, ClipboardCheck,
  Check, X, Plus, Minus, ArrowRight, ArrowLeft, PartyPopper,
} from "lucide-react";
import { useApp } from "../store/AppContext.jsx";
import { useSettings } from "../store/SettingsContext.jsx";
import { useT } from "../i18n/index.jsx";
import { FeatIcon } from "../lib/icons.jsx";
import ListingCard from "../components/ListingCard.jsx";
import { useRequireAccount } from "../lib/guards.jsx";
import { uploadRoomPhoto } from "../services/db.js";
import { IMG, AREA_COORDS, AMMAN_CENTER } from "../data/rooms.js";
import { TILES, TILE_ATTRIB } from "../lib/tiles.js";

const pinIcon = (price, cur) =>
  L.divIcon({ className: "maqar-pin-wrap", html: `<div class="maqar-pin">${price}<span>${cur}</span></div>`, iconSize: [54, 32], iconAnchor: [27, 34] });

const AREAS = ["Abdoun", "Jabal Amman", "Shmeisani", "Weibdeh", "Sweifieh", "Khalda", "Dabouq", "Tla Al Ali"];
const TYPES = ["Meeting", "Private", "Event"];
const AMENITIES = ["Whiteboard", "Projector", "Coffee", "Parking", "Wifi", "Air conditioning"];
const POOL = [IMG.room1, IMG.room2, IMG.room4, IMG.room5, IMG.room3, IMG.room6, IMG.room1b, IMG.room2b];

const STEPS = [
  { key: "basics", labelKey: "list.stepBasics", Icon: Building2 },
  { key: "location", labelKey: "list.stepLocation", Icon: MapPin },
  { key: "photos", labelKey: "list.stepPhotos", Icon: Camera },
  { key: "amenities", labelKey: "list.stepAmenities", Icon: Sparkles },
  { key: "review", labelKey: "list.stepReview", Icon: ClipboardCheck },
];

const blank = { name: "", type: "Meeting", area: "", cap: 6, price: 8, lat: null, lng: null, imgs: [], feats: ["Whiteboard", "Coffee"], desc: "" };

export default function HostListRoom() {
  const nav = useNavigate();
  const { createRoom, account, isLiveBackend } = useApp();
  const { t, lang } = useT();
  const blocked = useRequireAccount("host");
  const [draft, setDraft] = useState(blank);
  const [step, setStep] = useState(1);
  const [published, setPublished] = useState(false);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const addImg = (url) => setDraft((d) => ({ ...d, imgs: [...d.imgs, url] }));

  const stepValid = {
    1: draft.name.trim() && draft.area,
    2: draft.lat != null,
    3: draft.imgs.length > 0,
    4: draft.feats.length > 0,
    5: true,
  };
  const canNext = stepValid[step];

  function next() {
    if (step < 5) { setStep((s) => s + 1); window.scrollTo(0, 0); }
  }
  async function publish() {
    await createRoom(draft);
    setPublished(true);
    window.scrollTo(0, 0);
  }
  function reset() {
    setDraft(blank); setStep(1); setPublished(false); window.scrollTo(0, 0);
  }

  if (blocked) return null;
  if (published) return <Published draft={draft} t={t} lang={lang} onDash={() => nav("/host")} onAnother={reset} />;

  return (
    <div className="wrap pt-5 pb-[60px]">
      <button onClick={() => nav("/host")} className="inline-flex items-center gap-[6px] font-semibold text-[14px] my-[18px] px-[13px] py-[7px] rounded-full hover:bg-foam transition-colors" style={{ color: "var(--coffee)" }}>
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" /> {t("list.back")}
      </button>

      <div className="mb-2">
        <h1 className="text-[30px] font-semibold tracking-[-.5px] title-rule">{t("list.title")}</h1>
        <p className="text-[14px] mt-2" style={{ color: "var(--muted)" }}>{t("list.subtitle")}</p>
      </div>

      <Stepper step={step} setStep={setStep} t={t} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[26px] mt-6">
        <div>
          {step === 1 && <Basics draft={draft} set={set} t={t} />}
          {step === 2 && <Locator draft={draft} set={set} t={t} lang={lang} />}
          {step === 3 && <Photos draft={draft} set={set} t={t} live={isLiveBackend} userId={account?.id} addImg={addImg} />}
          {step === 4 && <Amenities draft={draft} set={set} t={t} />}
          {step === 5 && <Review draft={draft} t={t} lang={lang} />}

          <div className="flex justify-between gap-3 mt-[18px]">
            <button onClick={() => (step > 1 ? setStep(step - 1) : nav("/host"))}
              className="btn-soft px-[24px] py-[13px] rounded-xl text-[15px] flex items-center gap-2">
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {step > 1 ? t("list.backStep") : t("common.cancel")}
            </button>
            {step < 5 ? (
              <button onClick={next} disabled={!canNext} className="btn-primary px-[26px] py-[13px] rounded-xl text-[15px] flex items-center gap-2">
                {t("list.continue")} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            ) : (
              <button onClick={publish} className="btn-primary px-[26px] py-[13px] rounded-xl text-[15px] flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> {t("list.publish")}
              </button>
            )}
          </div>
        </div>

        {/* live preview rail */}
        <div>
          <div className="lg:sticky lg:top-[90px]">
            <div className="eyebrow mb-[10px] flex items-center gap-[6px]">
              <span className="inline-block w-[7px] h-[7px] rounded-full animate-pulse" style={{ background: "var(--good)" }} />
              {t("list.preview")}
            </div>
            <ListingCard listing={draft} t={t} lang={lang} variant="preview" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Stepper ---------------- */
function Stepper({ step, setStep, t }) {
  return (
    <div className="surface p-[14px] mt-5 flex items-center gap-1 overflow-x-auto">
      {STEPS.map(({ key, labelKey, Icon }, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={key} className="flex items-center flex-1 min-w-fit">
            {/* Tighter on phones: five steps at the desktop spacing need ~330px inside a
                card that offers ~295px at 375px, so the fifth step was clipped off the
                edge and the host could not see which step they were on. */}
            <button onClick={() => n < step && setStep(n)} disabled={n > step}
              className="flex items-center gap-[9px] px-[4px] sm:px-[10px] py-[7px] rounded-xl transition-colors"
              style={{ cursor: n < step ? "pointer" : active ? "default" : "not-allowed" }}>
              <span className="w-[26px] h-[26px] sm:w-[30px] sm:h-[30px] rounded-full grid place-items-center transition shrink-0"
                style={active
                  ? { background: "linear-gradient(150deg,var(--fill-dark),var(--fill-mid))", color: "var(--cream)", boxShadow: "0 4px 12px rgba(43,29,23,.28)" }
                  : done
                    ? { background: "var(--crema)", color: "var(--fill-dark)" }
                    : { background: "var(--foam)", color: "var(--muted)", border: "1px solid var(--line)" }}>
                {done ? <Check className="w-[15px] h-[15px]" strokeWidth={3} /> : <Icon className="w-[15px] h-[15px]" />}
              </span>
              <span className="text-[13px] font-semibold whitespace-nowrap hidden sm:block"
                style={{ color: active ? "var(--espresso)" : done ? "var(--coffee)" : "var(--muted)" }}>
                {t(labelKey)}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="flex-1 h-[2px] mx-[2px] sm:mx-1 rounded-full min-w-[5px] sm:min-w-[12px]" style={{ background: done ? "var(--crema)" : "var(--line)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Step 1: Basics ---------------- */
function Basics({ draft, set, t }) {
  return (
    <div className="surface p-[26px]">
      <h2 className="text-[20px] font-semibold mb-1">{t("list.basicsTitle")}</h2>
      <p className="text-[14px] mb-5" style={{ color: "var(--muted)" }}>{t("list.basicsSub")}</p>

      <Field label={t("list.roomName")}>
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder={t("list.roomNamePh")} className="field-input" maxLength={42} />
      </Field>

      <Field label={t("list.type")}>
        <div className="flex gap-2 flex-wrap">
          {TYPES.map((ty) => (
            <button key={ty} onClick={() => set({ type: ty })} className={`chip ${draft.type === ty ? "on" : ""}`}>{t(`type.${ty}`)}</button>
          ))}
        </div>
      </Field>

      <Field label={t("list.area")}>
        <select value={draft.area} onChange={(e) => set({ area: e.target.value })} className="field-input cursor-pointer">
          <option value="" disabled>{t("list.pickArea")}</option>
          {AREAS.map((a) => <option key={a} value={a}>{t(`area.${a}`)}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-1">
        <div>
          <label className="block text-[13px] font-bold mb-[10px]" style={{ color: "var(--coffee)" }}>{t("list.capacity")}</label>
          <div className="flex items-center gap-3">
            <Stepperctrl onMinus={() => set({ cap: Math.max(1, draft.cap - 1) })} onPlus={() => set({ cap: Math.min(40, draft.cap + 1) })} />
            <div className="font-serif text-[26px] font-semibold tabular-nums" style={{ color: "var(--espresso)" }}>{draft.cap}</div>
            <span className="text-[13px]" style={{ color: "var(--muted)" }}>{t("list.capUnit", { n: "" }).trim()}</span>
          </div>
        </div>
        <div>
          <label className="block text-[13px] font-bold mb-[10px]" style={{ color: "var(--coffee)" }}>{t("list.price")}</label>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-serif text-[26px] font-semibold" style={{ color: "var(--espresso)" }}>{draft.price}</span>
            <span className="text-[13px] font-semibold" style={{ color: "var(--muted)" }}>JOD/hr</span>
          </div>
          <input type="range" min="2" max="40" value={draft.price} onChange={(e) => set({ price: +e.target.value })} className="w-full" style={{ accentColor: "var(--coffee)" }} />
          <p className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>{t("list.priceHint")}</p>
        </div>
      </div>
    </div>
  );
}

function Stepperctrl({ onMinus, onPlus }) {
  const b = "w-[34px] h-[34px] grid place-items-center rounded-[10px] transition-transform active:scale-90";
  return (
    <div className="flex gap-1">
      <button onClick={onMinus} className={b} style={{ background: "var(--foam)", border: "1px solid var(--line)", color: "var(--coffee)" }}><Minus className="w-4 h-4" /></button>
      <button onClick={onPlus} className={b} style={{ background: "var(--foam)", border: "1px solid var(--line)", color: "var(--coffee)" }}><Plus className="w-4 h-4" /></button>
    </div>
  );
}

/* ---------------- Step 2: Locator map ---------------- */
function ClickToPlace({ onPlace }) {
  useMapEvents({ click(e) { onPlace(e.latlng.lat, e.latlng.lng); } });
  return null;
}
function Recenter({ area }) {
  const map = useMap();
  useEffect(() => {
    const c = AREA_COORDS[area];
    if (c) map.setView([c.lat, c.lng], 15, { animate: true });
  }, [area, map]);
  return null;
}

function Locator({ draft, set, t, lang }) {
  const { theme } = useSettings();
  const cur = lang === "ar" ? "د.أ" : "JOD";
  const placed = draft.lat != null;
  const start = AREA_COORDS[draft.area] || AMMAN_CENTER;

  return (
    <div className="surface p-[26px]">
      <h2 className="text-[20px] font-semibold mb-1">{t("list.locationTitle")}</h2>
      <p className="text-[14px] mb-4" style={{ color: "var(--muted)" }}>{t("list.locationSub")}</p>

      <div className="relative rounded-r overflow-hidden h-[340px]" style={{ border: "1px solid var(--line)", isolation: "isolate" }}>
        <MapContainer center={[start.lat, start.lng]} zoom={14} scrollWheelZoom={false} style={{ height: "100%", width: "100%", cursor: "crosshair" }}>
          <TileLayer key={theme} url={theme === "dark" ? TILES.dark : TILES.light} attribution={TILE_ATTRIB} />
          <Recenter area={draft.area} />
          <ClickToPlace onPlace={(lat, lng) => set({ lat, lng })} />
          {placed && (
            <Marker
              position={[draft.lat, draft.lng]}
              icon={pinIcon(draft.price, cur)}
              draggable
              eventHandlers={{ dragend: (e) => { const { lat, lng } = e.target.getLatLng(); set({ lat, lng }); } }}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex items-center gap-2 mt-3 text-[13px] font-semibold" style={{ color: placed ? "var(--verify)" : "var(--muted)" }}>
        {placed ? <Check className="w-4 h-4" strokeWidth={3} /> : <MapPin className="w-4 h-4" />}
        {placed ? `${t("list.locationSet")} · ${draft.area ? t(`area.${draft.area}`) : ""}` : t("list.locationNone")}
      </div>
    </div>
  );
}

/* ---------------- Step 3: Photos ---------------- */
function Photos({ draft, set, t, live, userId, addImg }) {
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  function addPhoto() {
    const nextImg = POOL.find((p) => !draft.imgs.includes(p)) || POOL[draft.imgs.length % POOL.length];
    set({ imgs: [...draft.imgs, nextImg] });
  }
  function removePhoto(i) { set({ imgs: draft.imgs.filter((_, idx) => idx !== i) }); }
  function makeCover(i) { const arr = [...draft.imgs]; const [m] = arr.splice(i, 1); set({ imgs: [m, ...arr] }); }
  async function onFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    setUploading(true);
    for (const f of files) {
      const { url } = await uploadRoomPhoto(f, userId);
      if (url) addImg(url);
    }
    setUploading(false);
  }

  return (
    <div className="surface p-[26px]">
      <h2 className="text-[20px] font-semibold mb-1">{t("list.photosTitle")}</h2>
      <p className="text-[14px] mb-5" style={{ color: "var(--muted)" }}>{t("list.photosSub")}</p>

      {live && (
        <label className="block w-full rounded-[16px] p-5 text-center mb-3 cursor-pointer transition"
          style={{ border: "2px solid var(--crema)", background: "rgba(201,162,126,.08)", color: "var(--coffee)" }}>
          <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
          <Camera className="w-6 h-6 mx-auto mb-1 opacity-80" />
          <div className="text-[13px] font-bold">{uploading ? t("map.locating") : t("list.addPhoto")}</div>
        </label>
      )}

      <button onClick={addPhoto}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addPhoto(); }}
        className="w-full rounded-[16px] p-9 text-center transition"
        style={{
          border: `2px dashed ${drag ? "var(--crema)" : "var(--line)"}`,
          background: drag ? "rgba(201,162,126,.1)" : "var(--foam)",
          color: "var(--muted)",
        }}>
        <Camera className="w-8 h-8 mx-auto mb-2 opacity-70" />
        <div className="text-[14px] font-semibold" style={{ color: "var(--coffee)" }}>{t("list.dropHere")}</div>
        <div className="inline-flex items-center gap-1 mt-3 px-[13px] py-[7px] rounded-full text-[13px] font-bold" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--coffee)" }}>
          <Plus className="w-4 h-4" /> {t("list.addPhoto")}
        </div>
      </button>

      {draft.imgs.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
          {draft.imgs.map((img, i) => (
            <div key={i} className="relative group rounded-[12px] overflow-hidden aspect-[4/3]" style={{ border: "1px solid var(--line)", animation: "galRise .4s var(--ease) both" }}>
              <img src={img} alt="" className="w-full h-full object-cover" />
              {i === 0 ? (
                <span className="absolute top-1 left-1 px-[7px] py-[2px] rounded-full text-[10px] font-bold" style={{ background: "var(--crema)", color: "var(--fill-dark)" }}>{t("list.cover")}</span>
              ) : (
                <button onClick={() => makeCover(i)} className="absolute bottom-1 left-1 px-[7px] py-[2px] rounded-full text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(251,247,240,.92)", color: "var(--fill-dark)" }}>{t("list.makeCover")}</button>
              )}
              <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-[22px] h-[22px] grid place-items-center rounded-full transition-transform active:scale-90"
                style={{ background: "rgba(36,24,18,.7)", color: "#fff" }}><X className="w-[13px] h-[13px]" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Step 4: Amenities ---------------- */
function Amenities({ draft, set, t }) {
  const toggle = (f) => set({ feats: draft.feats.includes(f) ? draft.feats.filter((x) => x !== f) : [...draft.feats, f] });
  return (
    <div className="surface p-[26px]">
      <h2 className="text-[20px] font-semibold mb-1">{t("list.amenitiesTitle")}</h2>
      <p className="text-[14px] mb-5" style={{ color: "var(--muted)" }}>{t("list.amenitiesSub")}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {AMENITIES.map((f) => {
          const on = draft.feats.includes(f);
          return (
            <button key={f} onClick={() => toggle(f)}
              className="relative flex items-center gap-[10px] p-[13px] rounded-[12px] text-[14px] font-semibold transition"
              style={on
                ? { background: "var(--surface)", border: "1.5px solid var(--crema)", color: "var(--espresso)", boxShadow: "0 4px 14px rgba(201,162,126,.22)" }
                : { background: "var(--foam)", border: "1.5px solid var(--line)", color: "var(--coffee)" }}>
              <span className="w-[34px] h-[34px] rounded-[9px] grid place-items-center shrink-0"
                style={on ? { background: "var(--crema)", color: "var(--fill-dark)" } : { background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--line)" }}>
                <FeatIcon name={f} className="w-[17px] h-[17px]" />
              </span>
              {t(`feat.${f}`)}
              {on && <Check className="w-4 h-4 ms-auto" strokeWidth={3} style={{ color: "var(--verify)" }} />}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <label className="block text-[13px] font-bold mb-[6px]" style={{ color: "var(--coffee)" }}>{t("list.descTitle")}</label>
        <textarea value={draft.desc} onChange={(e) => set({ desc: e.target.value })} placeholder={t("list.descPh")} maxLength={240}
          className="field-input min-h-[96px] resize-y" />
        <div className="text-[11px] mt-1 text-end" style={{ color: "var(--muted)" }}>{draft.desc.length}/240</div>
      </div>
    </div>
  );
}

/* ---------------- Step 5: Review ---------------- */
function Review({ draft, t, lang }) {
  const rows = [
    [t("list.type"), t(`type.${draft.type}`)],
    [t("list.area"), draft.area ? t(`area.${draft.area}`) : t("list.naLocation")],
    [t("list.capacity"), t("list.capUnit", { n: draft.cap })],
    [t("list.price"), `${draft.price} ${lang === "ar" ? "د.أ/ساعة" : "JOD/hr"}`],
    [t("list.stepPhotos"), `${draft.imgs.length}`],
    [t("list.stepAmenities"), `${draft.feats.length}`],
  ];
  return (
    <div className="surface p-[26px]">
      <h2 className="text-[20px] font-semibold mb-1">{t("list.reviewTitle")}</h2>
      <p className="text-[14px] mb-5" style={{ color: "var(--muted)" }}>{t("list.reviewSub")}</p>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
        {rows.map(([k, v], i) => (
          <div key={k} className="flex justify-between items-center px-4 py-[11px] text-[14px]"
            style={{ background: i % 2 ? "transparent" : "var(--foam)", color: "var(--coffee)" }}>
            <span style={{ color: "var(--muted)" }}>{k}</span>
            <span className="font-semibold" style={{ color: "var(--espresso)" }}>{v}</span>
          </div>
        ))}
      </div>

      {draft.desc.trim() && (
        <p className="text-[14px] leading-[1.6] mt-4 p-4 rounded-xl" style={{ background: "var(--foam)", border: "1px solid var(--line)", color: "var(--coffee)" }}>
          {draft.desc}
        </p>
      )}
    </div>
  );
}

/* ---------------- Published celebration ---------------- */
function Published({ draft, t, lang, onDash, onAnother }) {
  return (
    <div className="max-w-[520px] mx-auto px-[22px] pt-[40px] pb-[60px] text-center">
      <div className="w-[78px] h-[78px] rounded-full grid place-items-center mx-auto mb-5 animate-popCheck" style={{ background: "rgba(63,122,78,.14)", color: "var(--good)" }}>
        <PartyPopper className="w-9 h-9" />
      </div>
      <h1 className="text-[28px] font-semibold mb-2">{t("list.publishedTitle")}</h1>
      <p className="text-[14px] max-w-[400px] mx-auto mb-7" style={{ color: "var(--muted)" }}>
        {t("list.publishedBody", { title: draft.name.trim() || t("list.untitled") })}
      </p>

      <div className="max-w-[300px] mx-auto mb-7" style={{ animation: "galRise .5s var(--ease) .15s both" }}>
        <ListingCard listing={draft} t={t} lang={lang} variant="dash" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={onDash} className="btn-primary px-[24px] py-[13px] rounded-xl text-[15px]">{t("list.goDash")}</button>
        <button onClick={onAnother} className="btn-soft px-[24px] py-[13px] rounded-xl text-[15px] flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> {t("list.addAnother")}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-5">
      <label className="block text-[13px] font-bold mb-[8px]" style={{ color: "var(--coffee)" }}>{label}</label>
      {children}
    </div>
  );
}
