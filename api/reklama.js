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
const MAX_KB      = 6000;   // kirish rasmi (base64) chegarasi

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
async function oySarfi(shopId) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/studio_log` +
      `?shop_id=eq.${encodeURIComponent(shopId)}` +
      `&created_at=gte.${oyBoshi()}&select=id`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "count=exact", Range: "0-0" }
    });
    const cr = r.headers.get("content-range") || "";
    const n = parseInt(String(cr).split("/")[1]);
    return isNaN(n) ? 0 : n;
  } catch (e) { return 0; }
}
async function jurnal(shopId, amal, provayder, model, ok, izoh) {
  try {
    await fetch(`${SB_URL}/rest/v1/studio_log`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify([{ shop_id: shopId, amal, provayder, model,
        ok: !!ok, izoh: String(izoh || "").slice(0, 200) }]),
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
    const n = await oySarfi(shopId);
    return res.status(200).json({ ok: true, sarf: n, chegara: OYLIK_BEPUL,
      fal: !!FAL_KEY, gemini: !!GEMINI_KEY });
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
    const n = await oySarfi(shopId);
    if (n >= OYLIK_BEPUL)
      return res.status(200).json({ ok: false, limit: true, sarf: n,
        chegara: OYLIK_BEPUL,
        error: `Bu oyda ${OYLIK_BEPUL} ta bepul generatsiya tugadi. ` +
               `Keyingi oy yangilanadi.` });
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
    return res.status(200).json({ ok: true, image: chiq, sarf: n, chegara: OYLIK_BEPUL });
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
      sahnaNom: s.nom, kat, sarf: n, chegara: OYLIK_BEPUL });
  }

  // ── ✅ S4: do'kon modellari ro'yxati ──
  if (amal === "modellar") {
    const [e, a] = await Promise.all([modelOl(shopId, "erkak"), modelOl(shopId, "ayol")]);
    return res.status(200).json({ ok: true, erkak: e, ayol: a });
  }

  // ── ✅ S4: model yaratish (do'kon boshiga bir marta) ──
  if (amal === "model_yarat") {
    const jins = body.jins === "ayol" ? "ayol" : "erkak";
    const n0 = await oySarfi(shopId);
    if (n0 >= OYLIK_BEPUL)
      return res.status(200).json({ ok: false, limit: true,
        error: `Bu oyda ${OYLIK_BEPUL} ta bepul generatsiya tugadi.` });
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
      sarf: n, chegara: OYLIK_BEPUL });
  }

  // ── ✅ S4: kiyimni modelga kiydirish ──
  if (amal === "kiydir") {
    const jins = body.jins === "ayol" ? "ayol" : "erkak";
    const kiyim = String(body.image || "");
    if (!/^data:image\//.test(kiyim) && !/^https?:\/\//.test(kiyim))
      return res.status(200).json({ ok: false, error: "Kiyim rasmi yuborilmadi" });
    if (kiyim.length > MAX_KB * 1024)
      return res.status(200).json({ ok: false, error: "Rasm juda katta" });
    const n0 = await oySarfi(shopId);
    if (n0 >= OYLIK_BEPUL)
      return res.status(200).json({ ok: false, limit: true,
        error: `Bu oyda ${OYLIK_BEPUL} ta bepul generatsiya tugadi.` });
    const m = await modelOl(shopId, jins);
    if (!m || !m.url)
      return res.status(200).json({ ok: false, model_yoq: true,
        error: "Avval " + jins + " modelini yarating" });
    let chiq = null, xato = "";
    try {
      const j = await falRun(M_TRYON, {
        model_image: m.url, garment_image: kiyim,
        category: "auto", mode: "balanced", garment_photo_type: "auto",
        num_samples: 1, segmentation_free: true,
        output_format: "png", sync_mode: true,
      }, 52000);
      chiq = falRasm(j);
    } catch (e) { xato = e.message; }
    await jurnal(shopId, "kiydir:" + jins, "fal", M_TRYON, !!chiq, chiq ? "" : xato);
    if (!chiq) return res.status(200).json({ ok: false, error: xato || "Kiydirish chiqmadi" });
    const n = await oySarfi(shopId);
    return res.status(200).json({ ok: true, image: chiq, jins,
      sarf: n, chegara: OYLIK_BEPUL });
  }

  // ✅ S3: sahna ro'yxati (klient tugmalar chizishi uchun)
  if (amal === "sahnalar") {
    const kat = SAHNA_KUTUB[body.kat] ? body.kat : "umumiy";
    return res.status(200).json({ ok: true, kat,
      royxat: SAHNA_KUTUB[kat].map(s => ({ id: s.id, nom: s.nom })) });
  }

  return res.status(400).json({ ok: false, error: "Noma'lum amal: " + amal });
};
