// ═══════════════════════════════════════════════════════════════
// MERX STUDIO — AI DARVOZASI  |  api/reklama.js
// 2026-09-06 · 1-bosqich
// ═══════════════════════════════════════════════════════════════
// NIMA QILADI:
//   1. `fon`    — tovar fondan KESIB olinadi (shaffof PNG).
//   2. `sahna`  — kesilgan tovar ostiga YANGI FON quriladi.
//   3. `limit`  — do'konning shu oydagi sarfi va chegarasi.
//   4. `sinov`  — kalit ishlayotganini tekshirish (faqat tashxis).
//
// ⚠️ ASOSIY ME'MORIY QOIDA (rejadagi 7-band):
//   TOVAR PIKSELI GENERATIV AI'DAN O'TMAYDI. Fon tozalash — segmentatsiya
//   (kesish), qayta chizish emas. Sahna esa TOVARSIZ generatsiya
//   qilinadi va tovar ustiga QO'YILADI (kompozitsiya klientda).
//   Shu tufayli "rasmda boshqacha edi" muammosi tug'ilmaydi.
//
// XAVFSIZLIK:
//   · Kalitlar FAQAT shu yerda (klientga hech qachon chiqmaydi).
//   · Har so'rovda token: shop_id JWT'dan, haqiqiyligi Supabase'da
//     tekshiriladi (pul.js naqshi) — begona so'rov kalitni ishlata olmaydi.
//   · Oylik chegara `studio_log` bo'yicha sanaladi (do'kon bo'yicha).
//   · Kirish rasmi hajmi cheklangan; javob hech qayerga saqlanmaydi.
// ═══════════════════════════════════════════════════════════════

const SB_URL      = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAL_KEY     = process.env.FAL_KEY;                 // 2026-09-06
const GEMINI_KEY  = process.env.GEMINI_API_KEY;          // naklad kaliti (zaxira)

// Modellar — o'zgarsa faqat shu yer tahrirlanadi (kod tegilmaydi)
const M_FON   = process.env.STUDIO_M_FON   || "fal-ai/birefnet/v2";
const M_FON2  = "fal-ai/imageutils/rembg";               // zaxira
const M_SAHNA = process.env.STUDIO_M_SAHNA || "fal-ai/flux/schnell";
// ✅ S4: kiyimni modelga kiydirish — hujjat bilan tasdiqlangan
// (fal.run/fal-ai/fashn/tryon/v1.6 · model_image + garment_image ·
//  864x1296 · $0.075/generatsiya · 5-17 soniya).
const M_TRYON = process.env.STUDIO_M_TRYON || "fal-ai/fashn/tryon/v1.6";
const G_IMG   = "gemini-2.5-flash-image";                // Gemini zaxira

const OYLIK_BEPUL = parseInt(process.env.STUDIO_LIMIT) || 10;
const TG_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;      // ✅ S8: kanalga yuborish
// ✅ S7: AMAL OG'IRLIGI — hamma amal bir xil emas.
// Banner va video — BEPUL (brauzerda chiziladi, AI yo'q).
const KREDIT = { fon: 1, sahna: 1, model: 3, kiydir: 3, kanal: 0 };
// ⚠️ Vercel so'rov tanasi chegarasi ~4.5 MB. Undan katta rasm
// PLATFORMA darajasida rad etiladi (413) va bizning tushunarli
// xatomiz o'rniga tushunarsiz javob chiqadi. Shuning uchun 3.6 MB.
const MAX_KB      = 3600;

// ── Auth (pul.js naqshi) ───────────────────────────────────────
function shopFromJwt(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    const d = JSON.parse(json);
    return (d && d.user_metadata && d.user_metadata.shop_id) || null;
  } catch (e) { return null; }
}
async function verifyToken(token, shopId) {
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return false;
    const u = await r.json();
    return !!(u && u.user_metadata && u.user_metadata.shop_id === shopId);
  } catch (e) { return false; }
}

// ── Jurnal va oylik hisob ──────────────────────────────────────
function oyBoshi() {
  const t = new Date(Date.now() + 5 * 3600 * 1000);      // Toshkent
  return t.toISOString().slice(0, 8) + "01";
}
// ✅ S7: oylik sarf — KREDIT yig'indisi (satr soni emas)
async function oySarfi(shopId) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/studio_log` +
      `?shop_id=eq.${encodeURIComponent(shopId)}` +
      `&created_at=gte.${oyBoshi()}&ok=eq.true&select=kredit`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    const j = await r.json().catch(() => []);
    return (j || []).reduce((a, x) => a + (Number(x.kredit) || 1), 0);
  } catch (e) { return 0; }
}
// ✅ S7/S8: do'kon sozlamasi (kanal, IG, chegara)
async function sozlamaOl(shopId) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/studio_sozlama` +
      `?shop_id=eq.${encodeURIComponent(shopId)}` +
      `&select=kanal_id,kanal_nom,ig_rejim,ig_user,oylik_kredit,` +
      `dokon_nom,tel,brend_rang,brend_rang2,shrift&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    const j = await r.json().catch(() => []);
    return (j && j[0]) || {};
  } catch (e) { return {}; }
}
async function chegaraOl(shopId) {
  const s = await sozlamaOl(shopId);
  return { chegara: Number(s.oylik_kredit) || OYLIK_BEPUL, sozlama: s };
}
async function jurnal(shopId, amal, provayder, model, ok, izoh) {
  try {
    const bosh = String(amal).split(":")[0];
    await fetch(`${SB_URL}/rest/v1/studio_log`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify([{ shop_id: shopId, amal, provayder, model,
        ok: !!ok, kredit: (KREDIT[bosh] != null ? KREDIT[bosh] : 1),   // ✅ S7
        izoh: String(izoh || "").slice(0, 200) }]),
    });
  } catch (e) {}
}

// ── fal.ai chaqiruvi ───────────────────────────────────────────
// Hujjat: POST https://fal.run/{model} · "Authorization: Key <FAL_KEY>"
// Kirish rasmi base64 data URI bo'lishi mumkin; `sync_mode:true` bilan
// natija ham data URI bo'lib qaytadi (qo'shimcha yuklab olish shart emas).
async function falRun(model, input, ms) {
  if (!FAL_KEY) throw new Error("FAL_KEY sozlanmagan (Vercel ENV)");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 60000);
  try {
    const r = await fetch(`https://fal.run/${model}`, {
      method: "POST", signal: ctl.signal,
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`fal ${r.status}: ` +
      String(j && (j.detail || j.error || j.message) || "").slice(0, 160));
    return j;
  } finally { clearTimeout(t); }
}
function falRasm(j) {
  if (!j) return null;
  if (j.image && j.image.url) return j.image.url;
  if (Array.isArray(j.images) && j.images[0] && j.images[0].url) return j.images[0].url;
  return null;
}

// ── Gemini zaxira (fon uchun emas — faqat sahna) ───────────────
async function geminiSahna(matn) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY sozlanmagan");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${G_IMG}:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: matn }] }] }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("gemini " + r.status);
  const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
  const im = parts.find(p => p.inlineData || p.inline_data);
  const d = im && (im.inlineData || im.inline_data);
  if (!d || !d.data) throw new Error("gemini rasm qaytarmadi");
  return `data:${d.mimeType || d.mime_type || "image/png"};base64,${d.data}`;
}

// ═══ ✅ S3 (2026-09-06) — AQLLI SAHNA KUTUBXONASI ═══
// Sahna endi UMUMIY emas: kategoriya, TOVAR RANGI va MAVSUM'dan
// buyruq quriladi. Har kategoriyada bir necha sahna — tizim
// tasodifiy tanlaydi, ya'ni bir do'konning reklamalari bir-biriga
// o'xshab qolmaydi. Yangi sahna qo'shish = bitta qator (kod emas).
//
// QAT'IY QOIDA: buyruqda TOVAR YO'Q — faqat fon generatsiya qilinadi
// ("no products, no objects"), tovar brauzerda ustiga qo'yiladi.
const SAHNA_QOIDA = ", empty scene, no products, no objects, no text, " +
  "no people, no hands, photorealistic, professional product photography " +
  "backdrop, high resolution, centered composition, soft natural shadows";

const SAHNA_KUTUB = {
  oyoq: [
    { id: "podium",  nom: "Oq podium",     p: "seamless white studio sweep with a low round podium, crisp soft light from the top left" },
    { id: "tosh",    nom: "Tosh plita",    p: "dark polished concrete surface, moody side light, subtle haze in the background" },
    { id: "qum",     nom: "Qum",           p: "warm sand coloured seamless backdrop with a soft dune curve, golden hour light" },
    { id: "yogoch",  nom: "Yog'och stol",  p: "light oak wooden surface with a soft beige wall behind, daylight from a window" },
    { id: "beton",   nom: "Beton",         p: "grey micro cement wall and floor, minimal architectural light" },
    { id: "shisha",  nom: "Shisha",        p: "glossy reflective glass shelf with a gradient studio background" },
  ],
  kiyim: [
    { id: "interyer",nom: "Interyer",      p: "minimal interior corner, warm plaster wall, wooden floor, soft daylight from a tall window" },
    { id: "mato",    nom: "Mato fon",      p: "draped linen fabric backdrop in warm neutral tone, gentle folds, studio softbox light" },
    { id: "kafe",    nom: "Kafe",          p: "blurred cosy cafe interior background, warm bokeh, shallow depth of field" },
    { id: "kocha",   nom: "Ko'cha",        p: "blurred european street background at golden hour, soft bokeh, shallow depth of field" },
    { id: "studiya", nom: "Studiya",       p: "seamless studio backdrop in soft grey with a smooth gradient and floor line" },
    { id: "sof",     nom: "Sof rang",      p: "solid pastel colour backdrop with subtle vignette and soft floor shadow" },
  ],
  sumka: [
    { id: "marmar",  nom: "Marmar",        p: "white marble surface with a soft beige background, elegant soft light" },
    { id: "charm",   nom: "To'q fon",      p: "deep chocolate brown seamless backdrop, warm directional light" },
    { id: "podium",  nom: "Podium",        p: "minimal stone podium with a neutral gradient background" },
  ],
  umumiy: [
    { id: "studiya", nom: "Studiya",       p: "seamless neutral studio sweep, soft gradient, gentle floor reflection line" },
    { id: "tabiiy",  nom: "Tabiiy",        p: "warm neutral wall with soft daylight and a light wooden surface" },
    { id: "gradient",nom: "Gradient",      p: "smooth two tone colour gradient backdrop, clean and modern" },
  ],
};

// Mavsum — Toshkent oyiga qarab (buyruqqa kayfiyat qo'shadi)
function mavsumIzoh() {
  const oy = new Date(Date.now() + 5 * 3600 * 1000).getUTCMonth() + 1;
  if (oy === 12 || oy === 1)  return ", winter mood, cool soft light, subtle festive bokeh in the far background";
  if (oy === 2)               return ", late winter mood, clean cool light";
  if (oy === 3)               return ", early spring mood, fresh light, soft warm tones";
  if (oy >= 4 && oy <= 5)     return ", spring mood, bright airy daylight";
  if (oy >= 6 && oy <= 8)     return ", summer mood, bright sunlight, crisp shadows";
  return ", autumn mood, warm golden light, soft long shadows";
}
// Tovar rangiga MOS fon (kontrast bo'lsin — tovar yo'qolmasin)
function rangIzoh(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return "";
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  const yorq = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
  if (yorq < 0.30) return ", light and airy background so the dark product stands out";
  if (yorq > 0.72) return ", medium toned background so the light product stands out";
  return ", background tone clearly different from mid grey";
}
function sahnaBuyruq(kat, sahnaId, rang) {
  const ro = SAHNA_KUTUB[kat] || SAHNA_KUTUB.umumiy;
  const s = (sahnaId && ro.find(x => x.id === sahnaId))
    || ro[Math.floor(Math.random() * ro.length)];
  return { id: s.id, nom: s.nom,
    matn: s.p + rangIzoh(rang) + mavsumIzoh() + SAHNA_QOIDA };
}

// ═══ ✅ S4 (2026-09-06) — DO'KONNING O'Z MODELI ═══
// Egasining talabi: har do'konga O'Z modeli (bir erkak, bir ayol).
// Bir marta yaratiladi, `studio_models` ga yoziladi va KEYIN DOIM
// o'sha shaxs ishlatiladi — do'konning reklamalari yuzidan tanilib
// qoladi. `seed` saqlanadi: havola eskirsa ham AYNAN o'sha odam
// qayta yaratiladi (seed + buyruq = bir xil shaxs).
const MODEL_BUYRUQ = {
  erkak: "full body studio photograph of a young Central Asian man, " +
    "Uzbek features, short dark hair, calm friendly face, athletic slim " +
    "build, standing straight facing the camera, arms relaxed at the sides, " +
    "wearing a plain fitted white t-shirt and plain dark trousers",
  ayol: "full body studio photograph of a young Central Asian woman, " +
    "Uzbek features, dark hair tied back, calm friendly face, slim build, " +
    "standing straight facing the camera, arms relaxed at the sides, " +
    "wearing a plain fitted white top and plain dark trousers",
};
const MODEL_QOIDA = ", plain light grey seamless studio background, soft even " +
  "studio lighting, sharp focus, natural skin texture, photorealistic, " +
  "full body from head to shoes, vertical composition, no text, no logo";

async function modelOl(shopId, jins) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/studio_models` +
      `?shop_id=eq.${encodeURIComponent(shopId)}&jins=eq.${encodeURIComponent(jins)}` +
      `&select=jins,url,seed&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    const j = await r.json().catch(() => []);
    return (j && j[0]) || null;
  } catch (e) { return null; }
}
async function modelSaqla(shopId, jins, url, seed) {
  try {
    await fetch(`${SB_URL}/rest/v1/studio_models?on_conflict=shop_id,jins`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ shop_id: shopId, jins, url, seed }]),
    });
  } catch (e) {}
}

// ═══ ✅ C1 (2026-09-06) — UMUMIY FON KUTUBXONASI ═══
// Fonda TOVAR YO'Q — shuning uchun fon universal: bir marta
// yaratiladi va HAMMA do'konga umumiy bo'ladi (bazada saqlanadi).
// Uch sinf: tovar · model · real xodim. Fasllar bo'yicha.
// Xarajat: 70 fon = bir martalik ~$3, keyin hamma uchun bepul.
const FON_KATALOG = [
  { id:"t01", sinf:"tovar", kat:"studiya", mavsum:"hamma", nom:"Oq podium",
    buyruq:"seamless white studio sweep with a low round podium, crisp softbox light, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t02", sinf:"tovar", kat:"studiya", mavsum:"hamma", nom:"Kulrang gradient",
    buyruq:"smooth grey studio gradient backdrop with a soft floor line, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t03", sinf:"tovar", kat:"studiya", mavsum:"hamma", nom:"Qora premium",
    buyruq:"deep black studio backdrop with a single soft top light and glossy floor, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t04", sinf:"tovar", kat:"studiya", mavsum:"hamma", nom:"Marmar",
    buyruq:"white marble surface with soft beige wall, elegant diffused light, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t05", sinf:"tovar", kat:"studiya", mavsum:"hamma", nom:"Beton",
    buyruq:"grey micro cement wall and floor, minimal architectural light, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t06", sinf:"tovar", kat:"studiya", mavsum:"hamma", nom:"Yog'och",
    buyruq:"light oak wooden surface with warm beige wall, window daylight, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t07", sinf:"tovar", kat:"abstrakt", mavsum:"hamma", nom:"Pastel to'lqin",
    buyruq:"soft pastel gradient waves, smooth and clean, studio lighting, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t08", sinf:"tovar", kat:"abstrakt", mavsum:"hamma", nom:"Shisha",
    buyruq:"frosted glass shelf with soft colour gradient behind, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t09", sinf:"tovar", kat:"abstrakt", mavsum:"hamma", nom:"Qum",
    buyruq:"warm sand coloured backdrop with a soft dune curve, golden light, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t10", sinf:"tovar", kat:"tabiat", mavsum:"kuz", nom:"Kuzgi barglar",
    buyruq:"autumn leaves on a wooden table, warm golden hour light, blurred background, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t11", sinf:"tovar", kat:"tabiat", mavsum:"qish", nom:"Qor",
    buyruq:"fresh snow surface with soft blue winter light and bokeh, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t12", sinf:"tovar", kat:"tabiat", mavsum:"bahor", nom:"Bahor gullari",
    buyruq:"soft spring blossom branches, pastel background, airy daylight, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t13", sinf:"tovar", kat:"tabiat", mavsum:"yoz", nom:"Yozgi soya",
    buyruq:"bright summer light with palm leaf shadows on a warm wall, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t14", sinf:"tovar", kat:"abstrakt", mavsum:"bayram", nom:"Yangi yil",
    buyruq:"festive deep blue backdrop with warm golden bokeh lights, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t15", sinf:"tovar", kat:"abstrakt", mavsum:"bayram", nom:"Navro'z",
    buyruq:"fresh green and gold festive backdrop with soft floral pattern hints, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"t16", sinf:"tovar", kat:"abstrakt", mavsum:"bayram", nom:"Chegirma",
    buyruq:"bold red and white dynamic backdrop, energetic, sale mood, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m01", sinf:"model", kat:"studiya", mavsum:"hamma", nom:"Studiya oq",
    buyruq:"full height seamless white studio backdrop for fashion photography, soft even light, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m02", sinf:"model", kat:"studiya", mavsum:"hamma", nom:"Studiya kulrang",
    buyruq:"full height grey seamless fashion studio backdrop with soft shadow, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m03", sinf:"model", kat:"studiya", mavsum:"hamma", nom:"To'q fon",
    buyruq:"dark charcoal fashion studio backdrop with dramatic side light, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m04", sinf:"model", kat:"interyer", mavsum:"hamma", nom:"Minimal xona",
    buyruq:"minimal interior with warm plaster wall, wooden floor, tall window daylight, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m05", sinf:"model", kat:"interyer", mavsum:"hamma", nom:"Loft",
    buyruq:"industrial loft interior with brick wall and large windows, soft daylight, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m06", sinf:"model", kat:"interyer", mavsum:"hamma", nom:"Kafe",
    buyruq:"cosy blurred cafe interior, warm bokeh, shallow depth of field, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m07", sinf:"model", kat:"kocha", mavsum:"hamma", nom:"Ko'cha",
    buyruq:"blurred european street at golden hour, soft bokeh, shallow depth of field, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m08", sinf:"model", kat:"kocha", mavsum:"hamma", nom:"Shahar",
    buyruq:"modern city plaza with glass buildings, soft overcast light, blurred, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m09", sinf:"model", kat:"tabiat", mavsum:"kuz", nom:"Kuzgi xiyobon",
    buyruq:"autumn park alley with golden leaves, warm light, blurred background, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m10", sinf:"model", kat:"tabiat", mavsum:"qish", nom:"Qishki ko'cha",
    buyruq:"winter street with soft snow and warm shop lights, blurred bokeh, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m11", sinf:"model", kat:"tabiat", mavsum:"bahor", nom:"Bahor bog'i",
    buyruq:"spring garden with blossom trees, fresh pastel light, blurred, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m12", sinf:"model", kat:"tabiat", mavsum:"yoz", nom:"Yozgi sohil",
    buyruq:"summer seaside promenade with warm light, blurred background, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m13", sinf:"model", kat:"interyer", mavsum:"bayram", nom:"Bayram xonasi",
    buyruq:"festive interior with warm string lights and elegant decor, blurred, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"m14", sinf:"model", kat:"abstrakt", mavsum:"hamma", nom:"Rangli fon",
    buyruq:"solid pastel colour backdrop with subtle vignette, fashion studio, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r01", sinf:"real", kat:"interyer", mavsum:"hamma", nom:"Do'kon ichi",
    buyruq:"modern clothing shop interior, soft warm light, blurred racks in background, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r02", sinf:"real", kat:"interyer", mavsum:"hamma", nom:"Oq devor",
    buyruq:"clean white wall with soft natural window light and gentle shadow, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r03", sinf:"real", kat:"interyer", mavsum:"hamma", nom:"Neytral",
    buyruq:"warm neutral studio corner with soft gradient light, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r04", sinf:"real", kat:"kocha", mavsum:"hamma", nom:"Ko'cha oqshom",
    buyruq:"evening city street with warm bokeh lights, blurred, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r05", sinf:"real", kat:"kocha", mavsum:"hamma", nom:"Devor grafiti",
    buyruq:"urban textured wall, soft daylight, muted colours, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r06", sinf:"real", kat:"tabiat", mavsum:"kuz", nom:"Kuz parki",
    buyruq:"autumn park with warm golden leaves, soft blurred background, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r07", sinf:"real", kat:"tabiat", mavsum:"qish", nom:"Qishki oqshom",
    buyruq:"winter evening street with soft snow and warm lights, blurred, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r08", sinf:"real", kat:"tabiat", mavsum:"bahor", nom:"Bahor ko'chasi",
    buyruq:"spring street with blossom trees, fresh light, blurred, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r09", sinf:"real", kat:"tabiat", mavsum:"yoz", nom:"Yozgi bog'",
    buyruq:"summer green park with warm sunlight through leaves, blurred, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r10", sinf:"real", kat:"interyer", mavsum:"bayram", nom:"Bayram bezagi",
    buyruq:"festive interior with elegant decoration and warm bokeh, blurred, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r11", sinf:"real", kat:"abstrakt", mavsum:"hamma", nom:"Yumshoq gradient",
    buyruq:"smooth two tone soft gradient backdrop, portrait friendly, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },
  { id:"r12", sinf:"real", kat:"studiya", mavsum:"hamma", nom:"Portret studiya",
    buyruq:"professional portrait studio backdrop, soft key light, subtle vignette, empty scene, no products, no objects, no people, no text, photorealistic, professional photography backdrop, high resolution" },

  // ═══ ✅ BEZAKLI SAHNALAR (2026-09-06) ═══
  // Egasi namuna ko'rsatdi: pampas gullari, yog'och stol, iliq devor.
  // Bu sinfda REKVIZIT ATAYLAB bor (vaza, gul, kitob, mato), lekin
  // TOVAR YO'Q — tovar keyin brauzerda ustiga qo'yiladi va uning
  // pikseliga hech qachon tegilmaydi.
  { id:"b01", sinf:"tovar", kat:"bezak", mavsum:"hamma", nom:"Pampas va yog'och",
    buyruq:"warm beige wall, light wooden round table in the lower third, a glass vase with dried pampas grass behind, soft warm side light, cosy premium mood, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b02", sinf:"tovar", kat:"bezak", mavsum:"hamma", nom:"Quruq gullar",
    buyruq:"soft taupe wall, light oak table surface, dried flowers in a ceramic vase to the side, gentle shadows, minimal styling, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b03", sinf:"tovar", kat:"bezak", mavsum:"hamma", nom:"Marmar va o'simlik",
    buyruq:"white marble surface, soft grey wall, a small green plant in a stone pot at the side, bright diffused daylight, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b04", sinf:"tovar", kat:"bezak", mavsum:"hamma", nom:"Tosh va mato",
    buyruq:"dark stone slab surface, draped linen fabric behind, moody warm light from the side, luxury editorial mood, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b05", sinf:"tovar", kat:"bezak", mavsum:"hamma", nom:"Deraza yorug'ligi",
    buyruq:"light wooden table by a window, soft white curtain, warm morning sunlight and long soft shadows, airy scandinavian mood, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b06", sinf:"tovar", kat:"bezak", mavsum:"hamma", nom:"Kitob va shamchiroq",
    buyruq:"warm wooden desk, stacked books and a small candle at the side, cosy amber light, blurred background, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b07", sinf:"tovar", kat:"bezak", mavsum:"hamma", nom:"Beton podium",
    buyruq:"grey concrete podium in the lower third, soft gradient studio wall, one dried branch at the side, minimal gallery mood, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b08", sinf:"tovar", kat:"bezak", mavsum:"hamma", nom:"Charm va latun",
    buyruq:"dark brown leather surface, brass tray at the side, warm dramatic light, premium boutique mood, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b09", sinf:"tovar", kat:"bezak", mavsum:"kuz", nom:"Kuzgi stol",
    buyruq:"wooden table with a few autumn leaves and a warm knit fabric at the side, golden hour light through a window, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b10", sinf:"tovar", kat:"bezak", mavsum:"kuz", nom:"Kashtan va mato",
    buyruq:"warm terracotta wall, wooden surface, dried leaves and chestnuts to the side, soft autumn light, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b11", sinf:"tovar", kat:"bezak", mavsum:"qish", nom:"Qishki stol",
    buyruq:"white wooden surface, soft knitted wool fabric and pine branch at the side, cool winter daylight, calm mood, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b12", sinf:"tovar", kat:"bezak", mavsum:"qish", nom:"Bayram bezagi",
    buyruq:"dark green surface with warm string lights bokeh behind, small pine branch and golden ornament at the side, festive evening mood, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b13", sinf:"tovar", kat:"bezak", mavsum:"bahor", nom:"Bahor gullari",
    buyruq:"light wooden table, fresh blossom branch in a glass vase behind, soft pastel light, fresh spring mood, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b14", sinf:"tovar", kat:"bezak", mavsum:"bahor", nom:"Yashil o'simlik",
    buyruq:"light stone surface, fresh green leaves and a small vase behind, bright airy daylight, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b15", sinf:"tovar", kat:"bezak", mavsum:"yoz", nom:"Yozgi soya",
    buyruq:"sunlit warm wall with palm leaf shadows, light wooden surface, bright summer light, vivid mood, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
  { id:"b16", sinf:"tovar", kat:"bezak", mavsum:"yoz", nom:"Sohil",
    buyruq:"light sand coloured surface with a few smooth stones and dried grass, warm bright daylight, relaxed summer mood, empty product staging area in the front, no products, no shoes, no bags, no clothing, no people, no text, photorealistic interior product photography, shallow depth of field, soft natural light, vertical composition, clear flat surface in the lower third where a product will be placed" },
];
async function fonRoyxat(sinf, mavsum) {
  try {
    let q = `?select=id,sinf,kat,mavsum,nom,url&order=id`;
    if (sinf)  q += `&sinf=eq.${encodeURIComponent(sinf)}`;
    const r = await fetch(`${SB_URL}/rest/v1/studio_fon` + q, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    const bor = await r.json().catch(() => []);
    const xarita = {};
    (bor || []).forEach(x => { xarita[x.id] = x; });
    // katalogda bor-u, bazada yo'q bo'lganlarini ham qaytaramiz (url: null)
    return FON_KATALOG
      .filter(f => (!sinf || f.sinf === sinf) &&
                   (!mavsum || mavsum === "hamma" || f.mavsum === mavsum || f.mavsum === "hamma"))
      .map(f => ({ id: f.id, sinf: f.sinf, kat: f.kat, mavsum: f.mavsum,
                   nom: f.nom, url: (xarita[f.id] || {}).url || null }));
  } catch (e) { return []; }
}
async function fonYarat(fid) {
  const f = FON_KATALOG.find(x => x.id === fid);
  if (!f) return { ok: false, error: "Fon topilmadi" };
  try {                                    // allaqachon bormi
    const r0 = await fetch(`${SB_URL}/rest/v1/studio_fon?id=eq.${encodeURIComponent(fid)}&select=url&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    const j0 = await r0.json().catch(() => []);
    if (j0 && j0[0] && j0[0].url) return { ok: true, url: j0[0].url, kesh: true };
  } catch (e) {}
  let url = null, xato = "";
  try {
    const j = await falRun(M_SAHNA, {
      prompt: f.buyruq,
      image_size: f.sinf === "tovar" ? "square_hd" : "portrait_16_9",
      num_images: 1, sync_mode: false }, 52000);
    url = falRasm(j);
  } catch (e) { xato = e.message; }
  if (!url) return { ok: false, error: xato || "Fon chiqmadi" };
  try {
    await fetch(`${SB_URL}/rest/v1/studio_fon?on_conflict=id`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ id: f.id, sinf: f.sinf, kat: f.kat, mavsum: f.mavsum,
        nom: f.nom, buyruq: f.buyruq, url, yaratilgan: new Date().toISOString() }]),
    });
  } catch (e) {}
  return { ok: true, url };
}
// Rasmni SERVER orqali olib berish: canvas "iflos" bo'lmasin
// (tashqi havoladan to'g'ridan olingan rasm bilan yuklab olish ishlamaydi).
async function fonData(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("fon yuklanmadi " + r.status);
  const b = Buffer.from(await r.arrayBuffer());
  // ✅ yuklama nazorati: fon 6 MB dan katta bo'lsa qaytarilmaydi
  if (b.length > 6 * 1024 * 1024) throw new Error("fon juda katta");
  const tur = r.headers.get("content-type") || "image/png";
  return `data:${tur};base64,${b.toString("base64")}`;
}

// ═══════════════════════════════════════════════════════════════
module.exports = async (req, res) => {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, info: "MERX reklama darvozasi" });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); }
  catch { body = {}; }

  const amal  = String(body.action || "");
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const shopId = shopFromJwt(token);
  if (!shopId)
    return res.status(401).json({ ok: false, error: "Token yaroqsiz — qayta kiring" });
  if (!(await verifyToken(token, shopId)))
    return res.status(401).json({ ok: false, error: "Token tasdiqlanmadi" });

  // ── limit ──
  if (amal === "limit") {
    const [n, ch] = await Promise.all([oySarfi(shopId), chegaraOl(shopId)]);
    return res.status(200).json({ ok: true, sarf: n, chegara: ch.chegara,
      sozlama: ch.sozlama, narx: KREDIT,
      fal: !!FAL_KEY, gemini: !!GEMINI_KEY, tg: !!TG_TOKEN });
  }

  // ── ✅ S8: DO'KON SOZLAMASI — reklama kanali va Instagram ──
  if (amal === "sozlama_saqla") {
    const qator = {
      shop_id: shopId,
      kanal_id:  String(body.kanal_id  || "").trim().slice(0, 40) || null,
      kanal_nom: String(body.kanal_nom || "").trim().slice(0, 80) || null,
      ig_rejim:  body.ig_rejim === "merx" ? "merx" : "ozi",
      ig_user:   String(body.ig_user || "").replace(/^@/, "").trim().slice(0, 60) || null,
      // ✅ A2: brend to'plami
      dokon_nom:  String(body.dokon_nom || "").trim().slice(0, 60) || null,
      tel:        String(body.tel || "").trim().slice(0, 30) || null,
      brend_rang: /^#[0-9a-fA-F]{6}$/.test(String(body.brend_rang || ""))
                    ? body.brend_rang : null,
      brend_rang2:/^#[0-9a-fA-F]{6}$/.test(String(body.brend_rang2 || ""))
                    ? body.brend_rang2 : null,
      shrift:     String(body.shrift || "").trim().slice(0, 24) || null,
      updated_at: new Date().toISOString(),
    };
    try {
      await fetch(`${SB_URL}/rest/v1/studio_sozlama?on_conflict=shop_id`, {
        method: "POST",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([qator]),
      });
      return res.status(200).json({ ok: true, sozlama: qator });
    } catch (e) { return res.status(200).json({ ok: false, error: e.message }); }
  }

  // ── ✅ S8: REKLAMANI KANALGA YUBORISh ──
  // Do'konning O'Z reklama kanaliga bot orqali chiqadi. Bot kanalga
  // ADMIN qilib qo'shilgan bo'lishi shart — aks holda Telegram aniq
  // xato qaytaradi va biz uni to'g'ridan ko'rsatamiz.
  if (amal === "kanalga") {
    if (!TG_TOKEN)
      return res.status(200).json({ ok: false, error: "Bot tokeni sozlanmagan" });
    const s = await sozlamaOl(shopId);
    const kanal = String(body.kanal_id || s.kanal_id || "").trim();
    if (!kanal)
      return res.status(200).json({ ok: false, error: "Kanal ID kiritilmagan" });
    const rasm = String(body.image || "");
    if (!/^data:(image|video)\//.test(rasm))
      return res.status(200).json({ ok: false, error: "Fayl yuborilmadi" });
    const video = rasm.indexOf("data:video") === 0;
    try {
      const b64 = rasm.split(",")[1] || "";
      const buf = Buffer.from(b64, "base64");
      if (buf.length > 4 * 1024 * 1024)
        return res.status(200).json({ ok: false, error: "Fayl juda katta (9 MB dan ortiq)" });
      const fd = new FormData();
      fd.append("chat_id", kanal);
      const izoh = String(body.matn || "").slice(0, 900);
      if (izoh) { fd.append("caption", izoh); fd.append("parse_mode", "HTML"); }
      fd.append(video ? "video" : "photo",
        new Blob([buf], { type: video ? "video/mp4" : "image/png" }),
        video ? "reklama.mp4" : "reklama.png");
      const r = await fetch(
        `https://api.telegram.org/bot${TG_TOKEN}/${video ? "sendVideo" : "sendPhoto"}`,
        { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) {
        const d = String(j.description || "").toLowerCase();
        let izohli = j.description || "Yuborilmadi";
        if (d.includes("chat not found"))
          izohli = "Kanal topilmadi — ID xato yoki bot kanalga qo'shilmagan";
        else if (d.includes("not enough rights") || d.includes("administrator"))
          izohli = "Botga kanalda ADMIN huquqi berilmagan";
        await jurnal(shopId, "kanal", "telegram", "sendPhoto", false, izohli);
        return res.status(200).json({ ok: false, error: izohli });
      }
      await jurnal(shopId, "kanal", "telegram",
        video ? "sendVideo" : "sendPhoto", true, "");
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── sinov (kalit ishlayaptimi) ──
  if (amal === "sinov") {
    if (!FAL_KEY) return res.status(200).json({ ok: false, error: "FAL_KEY yo'q" });
    try {
      const j = await falRun(M_FON, {
        image_url: "https://storage.googleapis.com/falserverless/example_inputs/birefnet-input.jpeg",
        output_format: "png", sync_mode: false,
      }, 45000);
      return res.status(200).json({ ok: !!falRasm(j), model: M_FON });
    } catch (e) { return res.status(200).json({ ok: false, error: e.message }); }
  }

  // ── chegara (yozadigan amallardan oldin) ──
  if (amal === "fon" || amal === "sahna") {
    const [n, ch] = await Promise.all([oySarfi(shopId), chegaraOl(shopId)]);
    if (n >= ch.chegara)
      return res.status(200).json({ ok: false, limit: true, sarf: n,
        chegara: ch.chegara,
        error: `Bu oydagi ${ch.chegara} kredit tugadi. Keyingi oy yangilanadi ` +
               `yoki tarifni ko'taring.` });
  }

  // ── fon: tovarni kesib olish (segmentatsiya) ──
  if (amal === "fon") {
    const rasm = String(body.image || "");
    if (!/^data:image\//.test(rasm))
      return res.status(200).json({ ok: false, error: "Rasm yuborilmadi" });
    if (rasm.length > MAX_KB * 1024)
      return res.status(200).json({ ok: false,
        error: "Rasm juda katta — kichikroq surat yuboring" });
    let chiq = null, xato = "";
    for (const m of [M_FON, M_FON2]) {
      try {
        const j = await falRun(m, { image_url: rasm, output_format: "png",
          sync_mode: true }, 52000);   // ✅ vercel maxDuration=60 ichida
        chiq = falRasm(j);
        if (chiq) { await jurnal(shopId, "fon", "fal", m, true, ""); break; }
      } catch (e) { xato = e.message; }
    }
    if (!chiq) {
      await jurnal(shopId, "fon", "fal", M_FON, false, xato);
      return res.status(200).json({ ok: false, error: xato || "Fon tozalanmadi" });
    }
    const n = await oySarfi(shopId);
    return res.status(200).json({ ok: true, image: chiq, sarf: n, chegara: (await chegaraOl(shopId)).chegara });
  }

  // ── sahna: TOVARSIZ fon generatsiyasi ──
  if (amal === "sahna") {
    // ✅ S3: kategoriya + rang + mavsum → buyruq
    const kat = SAHNA_KUTUB[body.kat] ? body.kat : "umumiy";
    const s = sahnaBuyruq(kat, body.sahna, body.rang);
    const tur = s.id, matn = s.matn;
    let chiq = null, xato = "", prov = "fal", model = M_SAHNA;
    try {
      const j = await falRun(M_SAHNA, { prompt: matn, image_size: "square_hd",
        num_images: 1, sync_mode: true }, 46000);
      chiq = falRasm(j);
    } catch (e) { xato = e.message; }
    if (!chiq && GEMINI_KEY) {                       // zaxira yo'l
      try { chiq = await geminiSahna(matn); prov = "gemini"; model = G_IMG; }
      catch (e) { xato += " | " + e.message; }
    }
    await jurnal(shopId, "sahna:" + kat + ":" + tur, prov, model, !!chiq, chiq ? "" : xato);
    if (!chiq) return res.status(200).json({ ok: false, error: xato || "Sahna chiqmadi" });
    const n = await oySarfi(shopId);
    return res.status(200).json({ ok: true, image: chiq, sahna: tur,
      sahnaNom: s.nom, kat, sarf: n, chegara: (await chegaraOl(shopId)).chegara });
  }

  // ── ✅ S4: do'kon modellari ro'yxati ──
  if (amal === "modellar") {
    const [e, a] = await Promise.all([modelOl(shopId, "erkak"), modelOl(shopId, "ayol")]);
    return res.status(200).json({ ok: true, erkak: e, ayol: a });
  }

  // ── ✅ S4: model yaratish (do'kon boshiga bir marta) ──
  if (amal === "model_yarat") {
    const jins = body.jins === "ayol" ? "ayol" : "erkak";
    const [n0, ch0] = await Promise.all([oySarfi(shopId), chegaraOl(shopId)]);
    if (n0 >= ch0.chegara)
      return res.status(200).json({ ok: false, limit: true,
        error: `Bu oydagi ${ch0.chegara} kredit tugadi.` });
    const seed = parseInt(body.seed) || Math.floor(Math.random() * 1e9);
    const matn = MODEL_BUYRUQ[jins] + MODEL_QOIDA;
    let url = null, xato = "";
    try {
      // sync_mode: FALSE — havola qaytadi (bazaga havola yoziladi,
      // og'ir base64 emas: rasm ombori 51% to'lgan).
      const j = await falRun(M_SAHNA, { prompt: matn, image_size: "portrait_16_9",
        num_images: 1, seed, sync_mode: false }, 52000);
      url = falRasm(j);
    } catch (e) { xato = e.message; }
    await jurnal(shopId, "model:" + jins, "fal", M_SAHNA, !!url, url ? "" : xato);
    if (!url) return res.status(200).json({ ok: false, error: xato || "Model chiqmadi" });
    await modelSaqla(shopId, jins, url, seed);
    const n = await oySarfi(shopId);
    return res.status(200).json({ ok: true, jins, url, seed,
      sarf: n, chegara: (await chegaraOl(shopId)).chegara });
  }

  // ── ✅ S4: kiyimni modelga kiydirish ──
  if (amal === "kiydir") {
    const jins = body.jins === "ayol" ? "ayol" : "erkak";
    const kiyim = String(body.image || "");
    if (!/^data:image\//.test(kiyim) && !/^https?:\/\//.test(kiyim))
      return res.status(200).json({ ok: false, error: "Kiyim rasmi yuborilmadi" });
    if (kiyim.length > MAX_KB * 1024)
      return res.status(200).json({ ok: false, error: "Rasm juda katta" });
    const [n0, ch0] = await Promise.all([oySarfi(shopId), chegaraOl(shopId)]);
    if (n0 >= ch0.chegara)
      return res.status(200).json({ ok: false, limit: true,
        error: `Bu oydagi ${ch0.chegara} kredit tugadi.` });
    // ✅ KK (2026-09-06): shaxs surati IKKI manbadan bo'lishi mumkin:
    //   (a) do'konning O'Z XODIMI — klient data URI yuboradi;
    //   (b) do'konning AI-modeli — bazadagi havola.
    // Ketma-ket kiydirishda oldingi natija keyingi so'rovga shaxs
    // sifatida uzatiladi (shim → ko'ylak → oyoq kiyim).
    let shaxsRasm = String(body.model_image || "");
    if (shaxsRasm && !/^data:image\//.test(shaxsRasm) && !/^https?:\/\//.test(shaxsRasm))
      shaxsRasm = "";
    if (shaxsRasm && shaxsRasm.length > MAX_KB * 1024)
      return res.status(200).json({ ok: false, error: "Shaxs surati juda katta" });
    if (!shaxsRasm) {
      const m = await modelOl(shopId, jins);
      if (!m || !m.url)
        return res.status(200).json({ ok: false, model_yoq: true,
          error: "Avval " + jins + " modelini yarating yoki xodim suratini yuklang" });
      shaxsRasm = m.url;
    }
    let chiq = null, xato = "";
    try {
      const j = await falRun(M_TRYON, {
        model_image: shaxsRasm, garment_image: kiyim,
        category: String(body.turi || "auto"),      // ✅ KK: tepa/past/oyoq
        mode: "balanced", garment_photo_type: "auto",
        num_samples: 1, segmentation_free: true,
        output_format: "png", sync_mode: true,
      }, 52000);
      chiq = falRasm(j);
    } catch (e) { xato = e.message; }
    await jurnal(shopId, "kiydir:" + jins, "fal", M_TRYON, !!chiq, chiq ? "" : xato);
    if (!chiq) return res.status(200).json({ ok: false, error: xato || "Kiydirish chiqmadi" });
    const n = await oySarfi(shopId);
    return res.status(200).json({ ok: true, image: chiq, jins,
      sarf: n, chegara: (await chegaraOl(shopId)).chegara });
  }

  // ── ✅ ODDIY (2026-09-07): AVTO-FON — tizim o'zi tanlaydi ──
  // Do'konchi hech narsa tanlamaydi: kategoriya + mavsumga mos BEZAKLI
  // sahna (pampas, marmar, yog'och...) yoki odam kadri uchun real fon
  // tasodifiy olinadi, yo'q bo'lsa yaratiladi (bir marta, hamma uchun).
  if (amal === "fon_avto") {
    const sinf = body.sinf === "real" ? "real" : body.sinf === "model" ? "model" : "tovar";
    const oy = new Date(Date.now() + 5 * 3600 * 1000).getUTCMonth() + 1;
    const mavsum = (oy === 12 || oy <= 2) ? "qish" : oy <= 5 ? "bahor" : oy <= 8 ? "yoz" : "kuz";
    let ro = FON_KATALOG.filter(f => f.sinf === sinf &&
      (sinf === "tovar" ? f.kat === "bezak" : true) &&
      (f.mavsum === mavsum || f.mavsum === "hamma"));
    // mavsumiylarni afzal ko'ramiz (3 tadan 1 tasi mavsumiy bo'lsin)
    const mavs = ro.filter(f => f.mavsum === mavsum);
    if (mavs.length && Math.random() < .45) ro = mavs;
    if (!ro.length) ro = FON_KATALOG.filter(f => f.sinf === sinf);
    const oldingi = String(body.oldingi || "");
    const tanlov = ro.filter(f => f.id !== oldingi);
    const f = (tanlov.length ? tanlov : ro)[Math.floor(Math.random() * (tanlov.length || ro.length))];
    if (!f) return res.status(200).json({ ok: false, error: "Fon topilmadi" });
    const y = await fonYarat(f.id);
    if (!y.ok) return res.status(200).json(y);
    try {
      const data = await fonData(y.url);
      if (!y.kesh) await jurnal(shopId, "fonkutub", "fal", M_SAHNA, true, f.id);
      return res.status(200).json({ ok: true, image: data, fon: f.id, nom: f.nom, kesh: !!y.kesh });
    } catch (e) { return res.status(200).json({ ok: false, error: e.message }); }
  }

  // ── ✅ C1: FON KUTUBXONASI ──
  if (amal === "fonlar") {
    const r = await fonRoyxat(body.sinf || null, body.mavsum || null);
    return res.status(200).json({ ok: true, royxat: r });
  }
  // Fonni olish: yo'q bo'lsa YARATILADI (bir marta, hamma uchun),
  // so'ng data URI qilib qaytariladi.
  if (amal === "fon_ol") {
    const fid = String(body.fon || "");
    const y = await fonYarat(fid);
    if (!y.ok) return res.status(200).json(y);
    try {
      const data = await fonData(y.url);
      // sanoq (qaysi fon mashhur)
      try {
        await fetch(`${SB_URL}/rest/v1/rpc/`, { method: "HEAD" }).catch(() => {});
      } catch (e) {}
      if (!y.kesh) await jurnal(shopId, "fonkutub", "fal", M_SAHNA, true, fid);
      return res.status(200).json({ ok: true, image: data, kesh: !!y.kesh });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }
  // ✅ C1: ShAXSNI AJRATISh — model yoki real xodim kadridan odamni
  // kesib olish (portret rejimi), so'ng tanlangan fonga qo'yiladi.
  if (amal === "shaxs") {
    const rasm = String(body.image || "");
    if (!/^data:image\//.test(rasm))
      return res.status(200).json({ ok: false, error: "Rasm yuborilmadi" });
    const [n0, ch0] = await Promise.all([oySarfi(shopId), chegaraOl(shopId)]);
    if (n0 >= ch0.chegara)
      return res.status(200).json({ ok: false, limit: true,
        error: `Bu oydagi ${ch0.chegara} kredit tugadi.` });
    let chiq = null, xato = "";
    try {
      const j = await falRun(M_FON, { image_url: rasm, output_format: "png",
        model: "General Use (Heavy)", sync_mode: true }, 52000);
      chiq = falRasm(j);
    } catch (e) { xato = e.message; }
    if (!chiq) {
      try {
        const j2 = await falRun(M_FON2, { image_url: rasm, sync_mode: true }, 45000);
        chiq = falRasm(j2);
      } catch (e) { xato += " | " + e.message; }
    }
    await jurnal(shopId, "shaxs", "fal", M_FON, !!chiq, chiq ? "" : xato);
    if (!chiq) return res.status(200).json({ ok: false, error: xato || "Ajratilmadi" });
    const n = await oySarfi(shopId);
    return res.status(200).json({ ok: true, image: chiq, sarf: n,
      chegara: (await chegaraOl(shopId)).chegara });
  }

  // ✅ S3: sahna ro'yxati (klient tugmalar chizishi uchun)
  if (amal === "sahnalar") {
    const kat = SAHNA_KUTUB[body.kat] ? body.kat : "umumiy";
    return res.status(200).json({ ok: true, kat,
      royxat: SAHNA_KUTUB[kat].map(s => ({ id: s.id, nom: s.nom })) });
  }

  return res.status(400).json({ ok: false, error: "Noma'lum amal: " + amal });
};
