export const IMG = {
  room1: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
  room1b: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80",
  room1c: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80",
  room2: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&q=80",
  room2b: "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=800&q=80",
  room3: "https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=800&q=80",
  room3b: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&q=80",
  room4: "https://images.unsplash.com/photo-1577412647305-991150c7d163?w=800&q=80",
  room5: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80",
  room6: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80",
  room6b: "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80",
};

// Stable UUID ids — identical in the local seed and the Supabase `rooms` table,
// so room ids are consistent whether the app runs in demo or live mode.
export const RID = {
  r1: "00000000-0000-0000-0000-000000000001",
  r2: "00000000-0000-0000-0000-000000000002",
  r3: "00000000-0000-0000-0000-000000000003",
  r4: "00000000-0000-0000-0000-000000000004",
  r5: "00000000-0000-0000-0000-000000000005",
  r6: "00000000-0000-0000-0000-000000000006",
};

// "Abdoun, Amman" → "Abdoun"; "Jabal Amman" (no comma) → "Jabal Amman".
// Handles the Arabic comma (،) as well as the Latin one.
export function areaOf(room, lang = "en") {
  const src = (lang === "ar" ? room?.loc_ar || room?.loc : room?.loc) || "";
  return src.split(/[,،]/)[0].trim();
}

export const ROOMS = [
  {
    id: RID.r1, title: "The Crema Boardroom", type: "Meeting", loc: "Abdoun, Amman", cap: 8, price: 9, verified: true,
    rating: 4.9, reviews: 128,
    title_ar: "قاعة كريما للاجتماعات", loc_ar: "عبدون، عمّان",
    feats: ["Whiteboard", "Projector", "Coffee", "Parking"], lat: 31.9454, lng: 35.8806,
    imgs: [IMG.room1, IMG.room1b, IMG.room1c, IMG.room2],
    desc: "A warm, light-filled boardroom built for serious meetings. Acoustic panels keep conversations private, and the in-room espresso bar keeps everyone sharp.",
    desc_ar: "قاعة اجتماعات دافئة وغنيّة بالإضاءة الطبيعية مصمّمة للاجتماعات الجادّة. ألواح عازلة للصوت تحفظ خصوصية الحديث، وركن إسبريسو داخل القاعة يبقي الجميع في كامل تركيزهم.",
  },
  {
    id: RID.r2, title: "Roastery Focus Room", type: "Private", loc: "Jabal Amman", cap: 3, price: 5, verified: true,
    rating: 4.8, reviews: 64,
    title_ar: "غرفة التحميصة للتركيز", loc_ar: "جبل عمّان",
    feats: ["Whiteboard", "Coffee"], lat: 31.9515, lng: 35.9239,
    imgs: [IMG.room2, IMG.room2b, IMG.room1c],
    desc: "A cosy private room for deep work or small calls. Big window, fast wifi, and unlimited filter coffee.",
    desc_ar: "غرفة خاصة مريحة للعمل العميق أو المكالمات الصغيرة. نافذة كبيرة، وإنترنت سريع، وقهوة فلتر بلا حدود.",
  },
  {
    id: RID.r3, title: "Mocha Conference Hall", type: "Event", loc: "Shmeisani, Amman", cap: 16, price: 18, verified: false,
    rating: 4.6, reviews: 41,
    title_ar: "قاعة موكا للمؤتمرات", loc_ar: "الشميساني، عمّان",
    feats: ["Projector", "Parking", "Coffee"], lat: 31.9678, lng: 35.9089,
    imgs: [IMG.room3, IMG.room3b, IMG.room1],
    desc: "Our largest space for workshops and events. Tiered seating, full A/V, and a catering corner.",
    desc_ar: "أكبر مساحاتنا لورش العمل والفعاليات. مقاعد مدرّجة، وأنظمة صوت وصورة متكاملة، وركن للضيافة.",
  },
  {
    id: RID.r4, title: "Latte Studio", type: "Private", loc: "Weibdeh, Amman", cap: 4, price: 6, verified: true,
    rating: 4.9, reviews: 87,
    title_ar: "استوديو لاتيه", loc_ar: "اللويبدة، عمّان",
    feats: ["Whiteboard", "Coffee", "Parking"], lat: 31.9566, lng: 35.9170,
    imgs: [IMG.room4, IMG.room1b, IMG.room2b],
    desc: "A bright studio with movable furniture — reconfigure it for interviews, shoots, or planning sessions.",
    desc_ar: "استوديو مشرق بأثاث قابل للتحريك — أعد ترتيبه للمقابلات أو التصوير أو جلسات التخطيط.",
  },
  {
    id: RID.r5, title: "Espresso Meeting Pod", type: "Meeting", loc: "Sweifieh, Amman", cap: 6, price: 8, verified: true,
    rating: 4.7, reviews: 53,
    title_ar: "كبسولة إسبريسو للاجتماعات", loc_ar: "الصويفية، عمّان",
    feats: ["Whiteboard", "Projector", "Coffee"], lat: 31.9519, lng: 35.8580,
    imgs: [IMG.room5, IMG.room1c, IMG.room3b],
    desc: "A compact glass meeting pod with a smart screen and a dedicated barista station next door.",
    desc_ar: "كبسولة اجتماعات زجاجية مدمجة مع شاشة ذكية ومحطة باريستا مخصّصة بجوارها.",
  },
  {
    id: RID.r6, title: "Cortado Workshop Loft", type: "Event", loc: "Khalda, Amman", cap: 12, price: 14, verified: false,
    rating: 4.5, reviews: 29,
    title_ar: "لوفت كورتادو للورش", loc_ar: "خلدا، عمّان",
    feats: ["Projector", "Parking"], lat: 31.9876, lng: 35.8300,
    imgs: [IMG.room6, IMG.room6b, IMG.room3],
    desc: "An open loft with exposed brick and flexible staging — ideal for training days and meetups.",
    desc_ar: "لوفت مفتوح بجدران من الطوب المكشوف ومنصّة مرنة — مثالي لأيام التدريب واللقاءات.",
  },
];

// Amman city center + per-area coordinates (for maps)
export const AMMAN_CENTER = { lat: 31.9566, lng: 35.9039 };
export const AREA_COORDS = {
  Abdoun: { lat: 31.9454, lng: 35.8806 },
  "Jabal Amman": { lat: 31.9515, lng: 35.9239 },
  Shmeisani: { lat: 31.9678, lng: 35.9089 },
  Weibdeh: { lat: 31.9566, lng: 35.9170 },
  Sweifieh: { lat: 31.9519, lng: 35.8580 },
  Khalda: { lat: 31.9876, lng: 35.8300 },
  Dabouq: { lat: 32.0167, lng: 35.8000 },
  "Tla Al Ali": { lat: 31.9930, lng: 35.8660 },
};

// Map a Supabase `rooms` row to the shape the UI expects.
export function mapRoomRow(r) {
  return {
    id: r.id, title: r.title, title_ar: r.title_ar, loc: r.loc, loc_ar: r.loc_ar, area: r.area,
    type: r.type, cap: r.cap, price: r.price, verified: r.verified, rating: r.rating || 0, reviews: r.reviews || 0,
    lat: r.lat, lng: r.lng, feats: r.feats || [], imgs: r.imgs || [],
    desc: r.descr, desc_ar: r.descr_ar, host_id: r.host_id,
  };
}

// Localized room text helper
export function roomText(room, lang) {
  if (lang === "ar") {
    return { title: room.title_ar || room.title, loc: room.loc_ar || room.loc, desc: room.desc_ar || room.desc };
  }
  return { title: room.title, loc: room.loc, desc: room.desc };
}

export const fmt = (p) => p + " JOD/hr";
