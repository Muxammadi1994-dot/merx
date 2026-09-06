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

// ── Sahna buyruqlari (tovarsiz — faqat FON) ────────────────────
const SAHNALAR = {
  studiya: "Professional product photography backdrop, seamless studio " +
    "sweep, soft warm gradient from light beige to soft grey, subtle " +
    "floor reflection line, no objects, no text, no people, clean, " +
    "high resolution, square composition",
  tabiiy: "Minimal natural product backdrop, soft daylight from a window, " +
    "warm neutral wall with gentle shadow, light wooden surface at the " +
    "bottom, no objects, no text, no people, photographic, square",
  bayram: "Festive seasonal product backdrop, deep rich color gradient, " +
    "soft bokeh lights in the background, elegant and premium, no objects, " +
    "no text, no people, square composition",
};

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
          sync_mode: true }, 70000);
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
    const tur = SAHNALAR[body.sahna] ? body.sahna : "studiya";
    const matn = SAHNALAR[tur];
    let chiq = null, xato = "", prov = "fal", model = M_SAHNA;
    try {
      const j = await falRun(M_SAHNA, { prompt: matn, image_size: "square_hd",
        num_images: 1, sync_mode: true }, 60000);
      chiq = falRasm(j);
    } catch (e) { xato = e.message; }
    if (!chiq && GEMINI_KEY) {                       // zaxira yo'l
      try { chiq = await geminiSahna(matn); prov = "gemini"; model = G_IMG; }
      catch (e) { xato += " | " + e.message; }
    }
    await jurnal(shopId, "sahna:" + tur, prov, model, !!chiq, chiq ? "" : xato);
    if (!chiq) return res.status(200).json({ ok: false, error: xato || "Sahna chiqmadi" });
    const n = await oySarfi(shopId);
    return res.status(200).json({ ok: true, image: chiq, sahna: tur,
      sarf: n, chegara: OYLIK_BEPUL });
  }

  return res.status(400).json({ ok: false, error: "Noma'lum amal: " + amal });
};
