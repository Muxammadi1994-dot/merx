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
// ✅ OQ (2026-09-07): OYOQ KIYIM va AKSESSUAR uchun — kiydirish modeli
// ularni BILMAYDI (jonli hodisa: krossovka berilganda butunlay boshqa
// odam chizildi). Bular uchun ko'p-rasmli TAHRIR modeli: odam rasmi +
// tovar rasmi + "faqat oyoq kiyimni almashtir" buyrug'i.
// Hujjat: fal.run/fal-ai/nano-banana-2/edit · prompt + image_urls[].
const M_EDIT  = process.env.STUDIO_M_EDIT  || "fal-ai/nano-banana-2/edit";
// ✅ 637: HAR BOSQICHGA ALOHIDA ENV. Bo'sh bo'lsa — eski model (M_EDIT),
// ya'ni hech narsa o'zgarmaydi. Model almashtirish uchun push kerak emas.
// Tavsiya (16-sen): JOY → openai/gpt-image-2.5/sunburst/edit (fazoviy mantiq)
//                   MUHIT → nano-banana (yuz barqarorligi)
//                   SAHNA → openai/gpt-image-2.5/flare/text-to-image
const M_JOY   = process.env.STUDIO_M_JOY   || M_EDIT;   // tovarni sahnaga qo'yish
const M_MUHIT = process.env.STUDIO_M_MUHIT || M_EDIT;   // odamning foni
const M_KIYD  = process.env.STUDIO_M_KIYD  || M_EDIT;   // oyoq kiyim kiydirish
const SIFAT   = process.env.STUDIO_SIFAT   || "high";   // low|medium|high|xhigh|max
const G_IMG   = "gemini-2.5-flash-image";                // Gemini zaxira

const OYLIK_BEPUL = parseInt(process.env.STUDIO_LIMIT) || 10;
const TG_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;      // ✅ S8: kanalga yuborish
// ✅ S7: AMAL OG'IRLIGI — hamma amal bir xil emas.
// Banner va video — BEPUL (brauzerda chiziladi, AI yo'q).
const KREDIT = { fon: 1, sahna: 1, model: 3, kiydir: 3, kiydir_edit: 3, kanal: 0, joylashtir: 2, muhit: 3,
                 ai_hukm: 0, ai_matn: 0, ai_solishtir: 1 };   // ✅ v2: rejissyor amallari

// ═══════════════════════════════════════════════════════════════
// ✅ STUDIO v2 "IKKI MIYA" (2026-09-12) — Claude-REJISSYOR
// Rassom (fal.ai) rasm yasaydi; rejissyor (Claude) suratni baholaydi,
// sahna buyrug'ini yozadi, natijani ASL bilan solishtiradi, uz/ru matn
// yozadi. Kalit FAQAT serverda (3.57). Har chaqiruv studio_log'ga.
// Model nomlari ENV orqali almashtiriladi (kod o'zgarmaydi).
// ═══════════════════════════════════════════════════════════════
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const M_AI      = process.env.STUDIO_AI_MODEL      || "claude-sonnet-5";    // matn, surat hukmi
const M_AI_HUKM = process.env.STUDIO_AI_MODEL_HUKM || "claude-fable-5-1";   // "natija aslga mosmi" (qimmat, aniq)

function _dataUri(str, maxKb) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(str || ""));
  if (!m) return null;
  if (m[2].length > (maxKb || MAX_KB) * 1024) return { xato: "rasm juda katta" };
  return { media: m[1], data: m[2] };
}
// ═══════════════════════════════════════════════════════════════
// ✅ 651 — GEMINI REJISSYOR. Egasi qarori (16-sen): Claude balansi
// tugagan, rejissyor, tekshiruvchi va matn yozuvchi GEMINI'da ishlaydi.
// Kalit — mavjud GEMINI_API_KEY (naklad o'qish uchun ham ishlatiladi —
// kvota UMUMIY, 429 xatosi aniq aytiladi).
// Hujjat: ai.google.dev/api/generate-content — model "gemini-3.8-flash",
// generationConfig.responseMimeType + responseSchema (turlar kichik harf).
// ═══════════════════════════════════════════════════════════════
const M_GEM      = process.env.STUDIO_GEMINI_MODEL || "gemini-3.8-flash";
const M_GEM_ZAX  = "gemini-2.5-flash";            // 3.8 topilmasa (404)
// provayder: "gemini" (sukut, kalit bo'lsa) · "claude" · "avto" (Claude → Gemini)
const AI_PROV    = String(process.env.STUDIO_AI_PROVIDER || (GEMINI_KEY ? "gemini" : "claude")).toLowerCase();

// JSON sxemani Gemini shakliga: additionalProperties qo'llanmaydi — olib
// tashlanadi; maydonlar tartibi propertyOrdering bilan saqlanadi.
function _gemSxema(s) {
  if (!s || typeof s !== "object") return s;
  if (Array.isArray(s)) return s.map(_gemSxema);
  const o = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "additionalProperties") continue;
    if (k === "properties") {
      o.properties = {};
      for (const [pk, pv] of Object.entries(v)) o.properties[pk] = _gemSxema(pv);
      o.propertyOrdering = Object.keys(v);
    } else if (k === "items") o.items = _gemSxema(v);
    else o[k] = v;
  }
  return o;
}

async function geminiChaqir(model, system, content, maxTok, ms, sxema, _qayta) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY sozlanmagan");
  const parts = content.map(c => c.type === "image"
    ? { inlineData: { mimeType: c.source.media_type, data: c.source.data } }
    : { text: String(c.text || "") });
  // tekshiruvchi — aniq (past harorat); rejissyor va matn — ijodiy
  const temp = system === REJ_TEKSHIR ? 0.2 : (system === REJ_MATN ? 0.9 : 0.8);
  const gc = { temperature: temp,
               // Gemini 3.x o'ylaydi — o'ylash tokenlari ham shu chegaraga
               // kiradi; tor chegara Claude'dagi "max_tokens" kesilishini
               // takrorlardi. Shuning uchun keng.
               maxOutputTokens: Math.max(8192, maxTok || 0) };
  if (sxema) { gc.responseMimeType = "application/json"; gc.responseSchema = _gemSxema(sxema); }
  const tana = { systemInstruction: { parts: [{ text: system }] },
                 contents: [{ role: "user", parts }], generationConfig: gc };
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 45000);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { method: "POST", signal: ctl.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify(tana) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = String((j.error && j.error.message) || "").slice(0, 140);
      if (r.status === 404 && !_qayta && model !== M_GEM_ZAX)
        return geminiChaqir(M_GEM_ZAX, system, content, maxTok, ms, sxema, true);
      if (r.status === 429) throw new Error("Gemini kvotasi tugadi (naklad bilan umumiy kalit) — birozdan keyin urinib ko'ring");
      if (r.status === 403 || r.status === 401) throw new Error("Gemini kaliti yaroqsiz yoki ruxsat yo'q");
      if (r.status >= 500) throw new Error("Gemini serveri javob bermadi (" + r.status + ")");
      throw new Error("Gemini xatosi " + r.status + (m ? ": " + m : ""));
    }
    const c0 = (j.candidates || [])[0] || {};
    if (c0.finishReason === "SAFETY" || (j.promptFeedback && j.promptFeedback.blockReason))
      throw new Error("Gemini xavfsizlik filtri to'xtatdi");
    const text = ((c0.content || {}).parts || [])
      .filter(p => p.text && !p.thought).map(p => p.text).join("");
    const u = j.usageMetadata || {};
    return { text, stop: String(c0.finishReason || "").toLowerCase(),
             prov: "gemini", model,
             usage: { input_tokens: u.promptTokenCount || 0,
                      output_tokens: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) } };
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Gemini javob bermadi (vaqt tugadi)");
    throw e;
  } finally { clearTimeout(t); }
}

// Yagona kirish: provayder ENV bo'yicha, "avto" da Claude yiqilsa Gemini.
async function aiChaqir(model, system, content, maxTok, ms, sxema) {
  if (AI_PROV === "gemini" || /^gemini/i.test(model))
    return geminiChaqir(/^gemini/i.test(model) ? model : M_GEM, system, content, maxTok, ms, sxema);
  try {
    const r = await claudeChaqir(model, system, content, maxTok, ms, sxema);
    r.prov = "anthropic"; r.model = model; return r;
  } catch (e) {
    if (AI_PROV === "avto" && GEMINI_KEY) {
      const r = await geminiChaqir(M_GEM, system, content, maxTok, ms, sxema);
      r.zaxira = "claude: " + String(e.message).slice(0, 60);
      return r;
    }
    throw e;
  }
}

// ⚠️ 640: token chegarasi oshgach VAQT chegarasi ham yetmay qoldi —
// rejissyor endi 2 200 token yozadi va 40 s ga sig'maydi (jonli xato,
// 16-sen 13:48). 52 s ga oshirildi; Vercel funksiya devori 60 s.
// ⚠️ 638 SABOQ: chegara javob uzunligiga qarab yangilanadi. Rejissyorga
// poza, uslub ogohi va 9 bandli sahna qo'shilgach javob 1319 tokenga
// yetdi, chegara esa 1600 edi — uch urinishdan IKKITASI "max_tokens"
// bilan kesildi (jonli jurnal, 16-sen 13:24 va 13:25). Endi 3000.
// ✅ v2.6 (2026-09-12) — JSON SXEMA BILAN MAJBURIY (output_config.format).
// Tarix: v2.5 da "{" bilan boshlab qo'yish (prefill) sinaldi — jonli
// xato: "This model does not support assistant message prefill".
// Endi rasmiy yo'l: so'rovga JSON sxemasi beriladi, API javobni shu
// sxemaga MAJBURAN moslaydi (grammatika bilan) — muqaddima, izoh,
// yaroqsiz JSON chiqmaydi. Hujjat: platform.claude.com/docs/en/
// build-with-claude/structured-outputs (Sonnet 5, Fable 5.1 — qo'llanadi).
// Cheklov: har maydon `required`, `additionalProperties:false`, union yo'q.
// stop_reason qaytadi: "max_tokens" = javob kesilgan (jurnalga tushadi).
async function claudeChaqir(model, system, content, maxTok, ms, sxema) {
  if (!ANTHROPIC_KEY) throw new Error("AI kaliti sozlanmagan (Vercel ENV: ANTHROPIC_API_KEY)");
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 40000);
  try {
    const tana = { model, max_tokens: maxTok || 900, system, messages: [{ role: "user", content }] };
    if (sxema) tana.output_config = { format: { type: "json_schema", schema: sxema } };
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(tana),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = (j && j.error && j.error.message) || ("HTTP " + r.status);
      if (r.status === 401) throw new Error("AI kaliti yaroqsiz yoki muddati tugagan — Console'da yangilang");
      if (r.status === 402 || /credit|balance|billing/i.test(msg)) throw new Error("AI balansi tugagan — Console'da to'ldiring");
      if (r.status === 429) throw new Error("AI band (limit) — biroz kutib qayta urining");
      if (r.status === 404 && /model/i.test(msg)) throw new Error("AI modeli topilmadi: " + model);
      throw new Error("AI xatosi: " + String(msg).slice(0, 160));
    }
    const text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    return { text, usage: j.usage || {}, stop: j.stop_reason || "" };
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("AI javob bermadi (vaqt tugadi)");
    throw e;
  } finally { clearTimeout(t); }
}
function _jsonAjrat(t) {
  const s = String(t || "").replace(/```json|```/g, "").trim();
  const a = s.indexOf("{");
  // ✅ v2.5: sabab ko'rinsin — javobning boshi xatoga qo'shiladi (B8)
  const izi = () => " · javob: \u00ab" + s.replace(/\s+/g, " ").slice(0, 140) + (s.length > 140 ? "\u2026" : "") + "\u00bb";
  if (a < 0) throw new Error("AI javobi JSON emas" + izi());
  const b = s.lastIndexOf("}");
  if (b > a) {
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { /* pastda tiklashga urinamiz */ }
  }
  // ✅ v2.4: KESILGAN JAVOBNI TIKLASH. Model token chegarasiga urilsa
  // yopuvchi qavs yo'qoladi va butun javob behuda ketardi. Endi oxirgi
  // tugallangan maydongacha kesib, qavslar yopiladi. Tiklab bo'lmasa —
  // o'sha eski xato qaytadi (jim yutish yo'q, B8).
  let q = s.slice(a);
  const yop = bol => {
    let ochiq = 0, kv = 0, ichida = false, qoch = false;
    for (const c of bol) {
      if (qoch) { qoch = false; continue; }
      if (c === "\\") { qoch = true; continue; }
      if (c === '"') { ichida = !ichida; continue; }
      if (ichida) continue;
      if (c === "{") ochiq++; else if (c === "}") ochiq--;
      else if (c === "[") kv++; else if (c === "]") kv--;
    }
    if (ichida || ochiq < 0 || kv < 0) return null;
    try { return JSON.parse(bol + "]".repeat(kv) + "}".repeat(ochiq)); } catch (e) { return null; }
  };
  for (let i = q.length - 1; i > 0; i--) {
    const ch = q[i];
    if (ch !== "}" && ch !== "]" && ch !== '"' && !/[0-9a-z]/i.test(ch)) continue;
    const bol = q.slice(0, i + 1);
    let r = yop(bol);                              // avval butunicha
    if (r) return r;
    if (ch === '"' || /[0-9a-z]/i.test(ch)) {      // chala maydon — tashlaymiz
      const v = bol.lastIndexOf(",");
      if (v > 0) { r = yop(bol.slice(0, v)); if (r) return r; }
    }
  }
  throw new Error("AI javobi JSON emas (kesilgan)" + izi());
}
function _tovarMatn(t) {
  t = t || {};
  return ["Nomi: " + (t.nom || "—"), t.art ? "Artikul: " + t.art : "", t.kat ? "Toifa: " + t.kat : "",
          t.rang ? "Rang: " + t.rang : "", t.narx ? "Narx: " + t.narx + " so'm" : "", t.olcham ? "O'lchamlar: " + t.olcham : ""]
         .filter(Boolean).join("\n");
}
// ✅ v2.4 (2026-09-12) — HAR AMALGA O'Z BUYRUG'I.
// Xato tarixi: REJISSYOR buyrug'i uchala amalga (hukm, matn, tekshiruv)
// berilardi. v2.1-2.3 da u uzaydi (9 sahna qonuni + "tovarni tanish"),
// natijada TEKSHIRUV amalida model javobni uzun boshlab yubordi va
// 500 token chegarasida kesildi → "AI javobi JSON emas". Endi tekshiruv
// va matn o'z qisqa buyruqlaridan ishlaydi; sahna qonunlari faqat hukmda.
// ✅ v2.6 — JSON SXEMALARI. Maydon nomlari normalizatorlar bilan bir xil.
// Hamma maydon required (API limiti: ixtiyoriy maydon qimmat), union yo'q.
const S_STR = { type: "string" }, S_INT = { type: "integer" }, S_BOOL = { type: "boolean" };
const S_STRLIST = { type: "array", items: S_STR };
const _obj = (p) => ({ type: "object", properties: p, required: Object.keys(p), additionalProperties: false });
const HUKM_SXEMA = _obj({
  tovar_turi: { type: "string", enum: ["oyoq kiyim", "ust kiyim", "past kiyim", "libos", "aksessuar"] },
  ishonch:    { type: "string", enum: ["yuqori", "o'rta", "past"] },
  yaroqli: S_BOOL, daraja: S_INT, sarlavha: S_STR, bandlar: S_STRLIST,
  // ✅ 641: 9 ta qisqa band o'rniga — QAROR + bitta to'liq brif.
  // Sabab: bandlar rassomga ro'yxat bo'lib borardi, brif esa fotograf
  // topshirig'i bo'lib boradi. Klient joy/yuza/buyruq ni o'qiydi.
  sahna: _obj({
    yondashuv: { type: "string", enum: ["hayot_tarzi", "qahramon", "tahririy", "makro", "flat_lay", "ugc", "aksiya"] },
    sabab: S_STR, joy: S_STR, yuza: S_STR, balandlik: S_STR,
    kadr: S_STR, yoruglik: S_STR, palitra: S_STR, buyruq: S_STR }),
  poza: S_STR, uslub_ogoh: S_STRLIST, neytral: S_STR,   // ✅ 634 (odamli turlar)
  joylashuv: _obj({ foiz: S_INT, markaz_x: S_INT, gorizont: S_INT,
                    soya_yon: { type: "string", enum: ["chap", "ong", "past"] }, soya_kuch: S_INT }),
});
const TEKSHIR_SXEMA = _obj({
  mos: S_BOOL, ishonch: S_INT, farqlar: S_STRLIST,
  tavsiya: { type: "string", enum: ["qabul", "qayta", "rad"] },
});
const MATN_SXEMA = _obj({
  uz: _obj({ sarlavha: S_STR, matn: S_STR, heshteg: S_STRLIST }),
  ru: _obj({ sarlavha: S_STR, matn: S_STR, heshteg: S_STRLIST }),
});

const REJ_TEKSHIR = `Sen MERX Studio nazoratchisisan. Ikki rasm beriladi: ASL tovar surati va AI yasagan reklama. Vazifang bitta — tovarning O'ZI ikkalasida bir xilmi, shuni aniqlash.
Fon, yorug'lik, poza, kadr, soya — BAHOLANMAYDI. Faqat tovar: rang, shakl, tag, tugma, zamok, naqsh, tikuv, logotip, cho'ntak, material fakturasi.
Javob qisqa va faqat so'ralgan JSON bo'lsin — izoh, muqaddima, tushuntirish yozma. Farqlar o'zbekcha (lotin, apostrof: o', g').`;

const REJ_MATN = `Sen MERX Studio matn yozuvchisisan — O'zbekistondagi do'konlar uchun Instagram va Telegram posti yozasan.
Til: tabiiy o'zbekcha (lotin, to'g'ri apostrof: o', g') va tabiiy ruscha. Ruscha matn tarjima emas — ruschada boshqacha yoziladi.
Har safar boshqa boshlanish; "Yangi kelgan" kabi shablon iboralarni takrorlama. Narx faqat berilgan bo'lsa yoziladi.
Faqat so'ralgan JSON ni qaytar, boshqa hech narsa yozma.`;

// ✅ v2.1 (2026-09-12) — REJISSYOR QONUNLARI.
// Eski matnda uslub QOTIRIB yozilgan edi ("iliq neytral, pampas o'ti,
// shisha vaza") — shuning uchun har reklama bir xil chiqardi. Endi
// uslub yo'q, QONUN bor; xilma-xillikni har chaqiruvda _ijod() beradi (646).
// Eng muhim yangilik — TAYANCH QONUNI (tovar havoda qolmasligi uchun).
const REJISSYOR = `Sen MERX Studio bosh art-direktorisan — O'zbekistondagi do'konlar uchun reklama suratlarini SAHNALASHTIRASAN.

ISHLASH USULI (641 dan beri): tovar surati rassomga NAMUNA sifatida beriladi va u BUTUNLAY YANGI fotografiya chizadi. Ya'ni sen fon tasvirlovchi emassan — sen suratni QANDAY OLISH kerakligini hal qilasan: rakurs, kadr, obyektiv, yorug'lik sxemasi, kompozitsiya, kayfiyat.

BIRINCHI VAZIFA — TOVARNI O'RGANISH. Suratga qarab o'zing aniqla: nima bu (oyoq kiyim · ust kiyim · past kiyim · libos · aksessuar), qanday material (teri, zamsh, lak, trikotaj, jinsi, rezina), qanday silueti, qaysi mavsum, qanday odam kiyadi, narxi qaysi darajada. Katalogdagi nom NOTO'G'RI bo'lishi mumkin — surat hal qiladi.

IKKINCHI VAZIFA — YONDAShUV TANLASh. Tovarni o'rganib, END QAYSI USULDA suratga olish eng kuchli natija berishini hal qil va sababini bir jumlada yoz:
· hayot_tarzi — odam kiygan holda, ko'chada, harakatda. Kundalik oyoq kiyim va krossovka uchun ENG KUCHLI usul: tovar hayotda ko'rinadi, o'lchov beriladi, mijoz o'zini tasavvur qiladi.
· qahramon — tovar yolg'iz, sokin sahnada, katta va aniq. Yangi kelgan yoki asosiy model uchun.
· tahririy — dramatik yorug'lik, jurnal uslubi. Qimmat va brend tovar uchun.
· makro — juda yaqin kadr, faktura qahramon. Material kuchli bo'lsa (zamsh, qo'pol teri, tikuv).
· flat_lay — ustdan kadr, tartibli. Komplekt yoki bir necha tovar uchun.
· ugc — "do'stim tushirgan" hissi, tabiiy. Yosh auditoriya, Stories.
· aksiya — rang va energiya, matn uchun joy.

⚠️ SUKUT BO'YIChA "qahramon" TANLAMA. Oyoq kiyim va kiyimda hayot_tarzi ko'pincha kuchliroq: jonli surat sotadi, katalog surati emas.

UChINChI VAZIFA — SURATGA OLISh BRIFI ("buyruq", INGLIZCHA, 700-1400 belgi). Bu matnni rassom o'qiydi. U professional fotograf brifi bo'lsin, ro'yxat emas — oqib turgan matn. Ichida majburan bo'lsin:
1. Kadr nima haqida: kim/nima, qayerda, nima qilyapti.
2. Tovar rakursi va holati: 3/4, yon profil, ustdan, past nuqta. OYOQ KIYIM BO'LSA — JUFTLIK, ikkalasi ham ko'rinsin, biri oldinda ikkinchisi yarim burchakda yoki qadam holatida.
3. Agar hayot_tarzi bo'lsa: odam qaysi qismi ko'rinadi (oyoq kiyim → tizzadan pastga; ust kiyim → bo'yindan belgacha), nima kiygan (tovarga mos, neytral), qanday harakat (yurayotgan, zinadan chiqayotgan, burilayotgan). Yuz ko'rinmasin yoki kadr chetida bo'lsin.
4. Joy: aniq, mahalliy, tirik. Toshko'cha, eski shahar burchagi, g'ishtli devor, metro zinapoyasi, kuzgi park, kafe oldi, yomg'irdan keyingi asfalt. Klişe emas.
5. Obyektiv va diafragma: 35mm keng · 50mm tabiiy · 85mm siqilgan portret · 100mm makro; f/1.8-2.8 xira orqa fon · f/5.6 toza.
6. Yorug'lik sxemasi: manba qayerdan, qattiqmi yumshoqmi, orqa nur bormi, soya qayerga tushadi. Vaqt: ertalabki nur, oltin soat, bulutli tekis, oqshom chiroqlari.
7. Material talabi: teri yumshoq aks bersin · zamsh matlashsin, tuk ko'rinsin · lak yaltirasin, lekin dog' bo'lmasin · trikotaj hajmli chiqsin.
8. Kompozitsiya va chuqurlik: tovar kadrning 55-70% i, uchdan bir qoidasi yoki diagonal, orqa plan xira, tovar eng o'tkir nuqta.
9. Kayfiyat va rang: 3 rangdan oshmasin, iliq yoki sovuq, "film donasi" yoki "raqamli toza".
10. Taqiqlar: no text, no letters, no logos of other brands, no watermark, no collage, no border, no frame, no studio backdrop unless asked.

TOVAR SADOQATI (eng muhim): rassom tovarni namunadagidek chizishi shart — rang, shakl, tag, tugma, zamok, tikuv chizig'i, logotip, naqsh, material fakturasi, nisbatlar. Brifda buni ALOHIDA jumla bilan talab qil.

XILMA-XILLIK: har safar boshqa joy, boshqa yorug'lik, boshqa rakurs. Oldingi sahnani takrorlama.

Javob tili: qisqa maydonlar — o'zbekcha (lotin, o', g'); "buyruq" — INGLIZCHA.
Faqat so'ralgan JSON ni qaytar.`;


// ✅ v2.1 — XILMA-XILLIK URUG'I. Rejissyorga har chaqiruvda boshqa
// yo'nalish beriladi, aks holda u har safar eng "xavfsiz" sahnani
// (neytral studiya) yozadi. Tovarga mos kelmasa — o'zi almashtiradi.
// ✅ 646 — IJODIY DVIGATEL. Sabab: 641 da savol qayta yozilganda xilma-xillik
// urug'i savolga qo'shilmay qolgan — rejissyor hech qanday yo'nalish olmadi va
// har safar "eski shahar ko'chasi" yozdi. Egasi: "kuzatuvchilar birxillikdan
// tez zerikadi". Endi har chaqiruvda OLTI o'q bo'yicha tasodifiy yo'nalish
// beriladi va u TOVAR TURIGA qarab tanlanadi.
const I_JANR = [
  "studiya minimalizmi — toza yuza, bitta yorug'lik, ortiqcha narsa yo'q",
  "ko'cha reportaji — tirik lahza, tasodifiy kadr hissi",
  "tahririy drama — qattiq soya, kuchli kontrast, jurnal muqovasi kayfiyati",
  "retro plyonka — dona, iliq tus, 90-yillar reklamasi hissi",
  "yuqori moda — grafik kompozitsiya, kutilmagan burchak",
  "tabiat va organik — yog'och, tosh, o't, tabiiy nur",
  "sport va harakat — muzlatilgan lahza, kuch hissi",
  "uy jimjitligi — sokin xona, parda nuri, kundalik hayot",
  "sanoat xomligi — beton, metall, quvur, qo'pol yuza",
  "mahalliy bozor iliqligi — rang, mato, gavjumlik (xira)",
  "tungi neon — rangli chiroq aksi, nam asfalt",
  "suv va aks — ko'lmak, oyna, sayqal yuza aksidan foydalanish",
  "ustdan grafik kadr — tartib, simmetriya, bo'sh joy",
  "makro faktura — material qahramon, juda yaqin kadr",
];
const I_VAQT = [
  "tong tumani, sovuq yumshoq nur", "erta tong, uzun yumshoq soyalar",
  "tush oldi, toza va tekis nur", "peshin, qattiq nur va aniq soya",
  "bulutli kun, soyasiz tekis nur", "oltin soat, iliq yon nur",
  "ko'k soat, quyoshdan keyingi salqin nur", "oqshom, shahar chiroqlari yonadi",
  "tun, neon va ko'cha chiroqlari", "deraza nuri, ichkarida",
  "iliq lampa, kechki xona", "studiya softboxi, boshqariladigan nur",
];
const I_FASL = ["bahor — yangi barg, gullar, yengil havo",
  "yoz — yorqin nur, issiq havo, soya izlash",
  "kuz — oltin barglar, iliq tuslar, salqin havo",
  "qish — qor, sovuq nur, iliq kiyim", "yomg'irdan keyin — nam yuza va aks"];
const I_RANG = ["iliq tuproq ranglari", "sovuq kulrang-ko'k", "deyarli monoxrom",
  "pastel va yumshoq", "to'q fon va kuchli kontrast", "oq ustiga oq, nozik",
  "kuzgi oltin va jigarrang", "neon binafsha-ko'k"];
const I_KAMERA = ["35mm, past nuqtadan, keng sahna", "50mm, ko'z darajasida, tabiiy",
  "85mm, siqilgan fon, tovar ajralib turadi", "100mm makro, faktura",
  "ustdan tik kadr", "yerga juda yaqin, past nuqta",
  "oyna yoki ko'zgu aksi orqali", "old planda xira element (ramka effekti)",
  "yengil harakat izi (panning)", "uzoq fokus, kuchli siqilish"];
// dunyo — TOVAR TURIGA qarab
const I_DUNYO = {
  shoes: ["sport maydonchasi chizig'i", "skeytpark beton yoyi", "basketbol maydoni",
    "avtomobil salonidan chiqayotgan oyoq", "velosiped pedali yonida", "yugurish yo'lakchasi",
    "qumli plyaj chizig'i", "yog'och piristan", "o'tloq, ertalabki shudring",
    "tog' so'qmog'i, mayda tosh", "metro eskalatori", "vokzal perroni",
    "tom ustidagi teras", "basseyn chekkasi, nam kafel", "kutubxona narvoni",
    "galereya poli, oq devor", "muzlagan ko'lmak, qor", "avtoturargoh chizig'i",
    "kafe oldidagi stul ostida", "zinapoya spirali", "gilam chekkasi, uy ichi",
    "stadion o'rindiqlari orasida"],
  tops: ["tom ustidagi teras, shahar manzarasi", "san'at galereyasi, oq devor",
    "issiqxona, o'simliklar orasida", "kutubxona javonlari", "mehmonxona koridori",
    "vintaj avtomobil yonida", "kafe derazasi, ichkaridan", "spiral zinapoya",
    "parda nuri tushgan xona", "oynali studiya, aks", "kuzgi park xiyoboni",
    "qorli ko'cha, iliq lampa", "dengiz bo'yi taxta yo'lakchasi", "ofis shisha devori",
    "sahna orqasi, kiyimlar orasida", "gulchi do'koni", "kitob do'koni",
    "poyezd perroni", "ko'prik ustida, shamol", "universitet hovlisi"],
  bottoms: null, "one-pieces": null,
  aksessuar: ["marmar tokcha, tong nuri", "kafe stoli, qahva yonida", "taksi orqa o'rindig'i",
    "ochiq chamadon ustida", "kitoblar ustida", "zanjirda osilgan", "ofis stoli, hujjatlar",
    "mehmonxona krovati", "baxmal yuza, makro", "suv tomchilari bilan tosh",
    "qorong'i fon, bitta yorug'lik chizig'i", "kostyum yengi yonida", "bozor devori",
    "shisha vitrina ichida"],
  bolalar: ["yumshoq gilam, pastel", "yog'och o'yinchoq bloklar", "quyoshli bolalar xonasi",
    "bog'cha stoli", "o'yin maydonchasi", "chodir ichida", "ko'rpacha ustida", "gulli maysazor"],
  umumiy: ["shuvoq devor, chinor soyasi", "choyxona supasi", "ganch naqsh yonida",
    "zamonaviy kvartira", "biznes-markaz oldi", "yog'och ustaxona stoli",
    "eski g'isht ombor", "oq studiya fon", "bozor ustuni", "tarixiy darvoza yonida"],
};
// oxirgi paytda ko'p ishlatilgan — ijodiy o'q nomlamasa, TAQIQ
const I_KLISHE = ["eski shahar tor ko'chasi", "g'ishtli devor", "toshko'cha",
  "beton zina pog'onasi", "yomg'irdan keyingi asfalt"];

function _ijod(tur) {
  const r = a => a[Math.floor(Math.random() * a.length)];
  const k = (tur === "shoes") ? "shoes"
          : (tur === "aksessuar") ? "aksessuar"
          : (tur === "tops" || tur === "bottoms" || tur === "one-pieces") ? "tops"
          : "umumiy";
  const dunyo = I_DUNYO[k] || I_DUNYO.umumiy;
  // yarim hollarda umumiy (mahalliy) dunyodan — aralashib tursin
  const ro = Math.random() < .7 ? dunyo : I_DUNYO.umumiy;
  return { janr: r(I_JANR), vaqt: r(I_VAQT), fasl: r(I_FASL),
           rang: r(I_RANG), kamera: r(I_KAMERA), dunyo: r(ro) };
}

function _tovarTuri(v) {
  const s = String(v || "").toLowerCase();
  if (!s) return "";
  if (/shoe|oyoq|krossovka|botinka|tufli|poyabzal|ked|sandal|shippak|sneaker/.test(s)) return "shoes";
  if (/one-?piece|libos|ko'ylak-libos|sarafan|kombinezon|xalat|plat|dress/.test(s)) return "one-pieces";
  if (/bottom|past|shim|jins|yubka|short|bryuk|ishton|losin|trouser|pant/.test(s)) return "bottoms";
  if (/top|ust|ko'ylak|koylak|futbolka|sviter|kofta|kurtka|palto|pidjak|jaket|bluzka|tolstovka|hoodie|shirt/.test(s)) return "tops";
  if (/aksessuar|sumka|soat|kamar|ko'zoynak|hamyon|ryukzak|zargar|taqinchoq|watch|bag|belt/.test(s)) return "aksessuar";
  return "";
}

function _joylashuv(j, sahna) {
  j = j || {};
  const n = (v, min, max, zax) => {
    const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
    return (isFinite(x) && x >= min && x <= max) ? Math.round(x) : zax;
  };
  // gorizont kelmasa — sahnadagi "balandlik" bandidan olinadi (bir xil narsa)
  let gz = n(j.gorizont, 5, 80, null);
  if (gz === null) gz = n(sahna && sahna.balandlik, 5, 80, 32);
  let yon = String(j.soya_yon || "past").toLowerCase().trim();
  if (/^(chap|left)$/.test(yon)) yon = "chap";
  else if (/^(o'ng|ong|right)$/.test(yon)) yon = "ong";
  else yon = "past";
  return {
    foiz:     n(j.foiz, 25, 85, 60),
    markaz_x: n(j.markaz_x, 10, 90, 50),
    gorizont: gz,
    soya_yon: yon,
    soya_kuch: n(j.soya_kuch, 1, 10, 6),
  };
}

function _sahnaRetsept(r, x) {
  r = r || {};
  const b = (k, n) => String(r[k] || "").replace(/\s+/g, " ").trim().slice(0, n || 120);
  const yon = ["hayot_tarzi","qahramon","tahririy","makro","flat_lay","ugc","aksiya"]
    .includes(r.yondashuv) ? r.yondashuv : "";
  const joy = b("joy"), yuza = b("yuza") || (x && x.dunyo) || "";
  // ✅ 641: brif 1400 belgigacha (ilgari 600 edi — rassom uchun juda qisqa)
  let buyruq = String(r.buyruq || "").replace(/\s+/g, " ").trim();
  if (!buyruq) buyruq = [joy, yuza, b("kadr"), b("yoruglik"), b("palitra")].filter(Boolean).join(", ");
  return { yondashuv: yon, sabab: b("sabab"), joy, yuza, balandlik: b("balandlik"),
           kadr: b("kadr", 200), yoruglik: b("yoruglik"), palitra: b("palitra"),
           buyruq: buyruq.slice(0, 1400) };
}


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
// ═══ ✅ NAVBAT (2026-09-07) — "This operation was aborted" davosi ═══
// Kiydirish/tahrir/model ba'zan 60 soniyadan uzoq (fal navbati). Vercel
// funksiyasi 60 s da uziladi. Endi uzun amallar NAVBATGA topshiriladi:
// server darhol `request_id` qaytaradi, klient har 2.5 s da holatni
// so'raydi, tayyor bo'lgach natija olinadi. Funksiya uzoq ushlanmaydi.
// ✅ 637 — MODEL MOSLAShTIRGIChI.
// Har model oilasi boshqa parametr kutadi. Biz bitta "umumiy" to'plam
// bilan ishlaymiz, moslashtirgich uni model oilasiga tarjima qiladi.
//   umumiy: { prompt, rasmlar[], nisbat, sifat }
//   nano-banana / flux → aspect_ratio · num_images · output_format
//   openai/gpt-image   → image_size (WxH yoki "auto") · quality · background
// GPT o'lchov qoidasi (fal hujjati): tomonlar 16 ga bo'linsin, hech bir
// tomon 3840 dan oshmasin, jami piksel 655 360 … 8 294 400 oralig'ida.
const _GPT_OLCH = {
  "1:1":  "1024x1024",    // 1 048 576 px
  "4:5":  "1024x1280",    // 1 310 720 px
  "9:16": "864x1536",     // 1 327 104 px
  "16:9": "1536x864",
  "auto": "auto",
};
function _gptMi(model) { return /^openai\/gpt-image/.test(String(model || "")); }

function _falPar(model, u) {
  const nisbat = String(u.nisbat || "auto");
  const rasmlar = Array.isArray(u.rasmlar) ? u.rasmlar.filter(Boolean) : [];
  if (_gptMi(model)) {
    const p = {
      prompt: u.prompt,
      image_size: _GPT_OLCH[nisbat] || "auto",
      quality: String(u.sifat || SIFAT),
      background: u.shaffof ? "transparent" : "auto",
      num_images: 1,
      output_format: "png",
    };
    if (rasmlar.length) p.image_urls = rasmlar;      // tahrir manzili
    return p;
  }
  // eski oila (nano-banana, flux, boshqalar) — hozirgi shakl
  const p = { prompt: u.prompt, num_images: 1, output_format: "png" };
  if (nisbat !== "auto" || rasmlar.length) p.aspect_ratio = nisbat;
  if (rasmlar.length) p.image_urls = rasmlar;
  return p;
}

// ✅ 637: SAHNA (matndan rasm) uchun moslashtirgich. Flux nomli o'lchamlar
// ("square_hd", "portrait_16_9") GPT da yo'q — ular pikselga aylantiriladi.
const _FLUX_OLCH = { square_hd: "1024x1024", portrait_16_9: "864x1536",
                     portrait_4_3: "1024x1280", landscape_16_9: "1536x864" };
function _falSahna(model, prompt, olcham) {
  if (_gptMi(model)) {
    return { prompt, image_size: _FLUX_OLCH[olcham] || "1024x1024",
             quality: SIFAT, background: "auto", num_images: 1, output_format: "png" };
  }
  return { prompt, image_size: olcham, num_images: 1, sync_mode: false };
}

async function falSubmit(model, input) {
  if (!FAL_KEY) throw new Error("FAL_KEY sozlanmagan");
  const r = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.request_id) throw new Error(`fal navbat ${r.status}: ` +
    String(j && (j.detail || j.error || j.message) || "").slice(0, 160));
  return { request_id: j.request_id, status_url: j.status_url, response_url: j.response_url };
}
function _falUrlOk(u) { return /^https:\/\/queue\.fal\.run\//.test(String(u || "")); }
async function falHolat(status_url) {
  const r = await fetch(status_url, { headers: { Authorization: `Key ${FAL_KEY}` } });
  const j = await r.json().catch(() => ({}));
  return { status: j.status || "?", navbat: j.queue_position };
}
async function falNatija(response_url) {
  const r = await fetch(response_url, { headers: { Authorization: `Key ${FAL_KEY}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("fal natija " + r.status + ": " +
    String(j && (j.detail || j.error) || "").slice(0, 120));
  return j;
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
    const j = await falRun(M_SAHNA, _falSahna(M_SAHNA, f.buyruq,        // ✅ 637
      f.sinf === "tovar" ? "square_hd" : "portrait_16_9"), 52000);
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
      fal: !!FAL_KEY, gemini: !!GEMINI_KEY, tg: !!TG_TOKEN, ai: !!ANTHROPIC_KEY,
      rejissyor: AI_PROV === "gemini" ? M_GEM : M_AI });   // ✅ 651: kim rejissyorlik qilyapti
  }

  // ── ✅ v2: REJISSYOR — surat hukmi + sahna retsepti ──
  if (amal === "ai_hukm") {
    const im = _dataUri(body.image, 1600);
    if (!im || im.xato) return res.status(200).json({ ok: false, error: im && im.xato ? im.xato : "Rasm yuborilmadi" });
    const tovar = body.tovar || {}, turi = String(body.turi || "tovar");
    const x = _ijod(_tovarTuri(String(tovar.kat || "") + " " + String(tovar.nom || "")));   // ✅ 646
    const savol = "Tovar:\n" + _tovarMatn(tovar) + "\nReklama turi: " + turi +
      "\n\n1) SURATNI BAHOLA. Tekshir: yorug'lik va soya · fokus (qimirlaganmi) · rakurs · kadr to'liqmi · " +
      "ortiqcha narsalar (qo'l, birka, qisqich, qog'oz, javon, gilam, oyna aksi, sim) · qiyshiqlik · chang va iz · " +
      "MATERIAL (teri, zamsh, lak, trikotaj, jinsi, shoyi, paxta, jun, rezina, to'r) va unga mos yorug'lik · " +
      "KIYIMDA G'IJIM bormi va qayerda (yeng, bel, etak, yoqa). " +
      "Eslatma: tovar pikseli AI dan o'tmaydi, shuning uchun g'ijim, chang va iflos joyni FAQAT qayta suratga olish tuzatadi — " +
      "shuni aniq maslahat qilib yoz (masalan: dazmollab, deraza yonida, 3/4 burchakdan qayta oling).\n" +
      (/^(real|model|kop)$/.test(turi)
        ? "2) MUHIT BRIFINI YOZ. Tovar ODAMDA bo'ladi (kiydiriladi), sen esa odam turgan/yurgan MUHITni yozasan: joy, yer, yorug'lik, chuqurlik. " +
          "'kadr' — TOVARGA qaratilgan kadrlash (oyoq kiyim: tizzadan pastga, past nuqtadan; ust kiyim: bo'yindan belgacha). " +
          "'buyruq' — English: the ENVIRONMENT for a person wearing the product; do not describe the person.\n" +
          "3) POZA ('poza'): tik turish EMAS — yurayotgan, zinadan chiqayotgan, burilayotgan, bog'ich bog'layotgan. Yuz kameradan chetga. Bitta jumla.\n" +
          "4) USLUB MUVOFIQLIGI ('uslub_ogoh'): odamning boshqa kiyimlari tovarga mos keladimi — fasl, uslub, rang, daraja, yosh. " +
          "Mos kelmasa qisqa ogoh; tuzatish mumkin bo'lsa 'neytral' ga yoz (masalan: shimni to'q ko'kka).\n" +
          "\nBU SAFARGI IJODIY O'Q: janr — " + x.janr + "; vaqt — " + x.vaqt + "; fasl — " + x.fasl +
          "; rang — " + x.rang + "; kamera — " + x.kamera + "; dunyo — " + x.dunyo + ". " +
          "Muhit shu o'qdan kelib chiqsin. Klişe taqiq: " + I_KLISHE.join(" · ") + ".\n"
        : "2) TOVARNI O'RGAN va YONDAShUV tanla ('yondashuv' + 'sabab'). Oyoq kiyim/kiyimda hayot_tarzi ko'pincha kuchliroq — sukut bo'yicha 'qahramon' tanlama.\n" +
          "3) TO'LIQ SURATGA OLISh BRIFINI YOZ ('buyruq', inglizcha, 700-1400 belgi) — yuqoridagi 10 bandli tuzilma bo'yicha. " +
          "Rassom BUTUNLAY YANGI kadr chizadi, shuning uchun rakurs, juftlik, poza, obyektiv, yorug'lik sxemasi, kompozitsiya — hammasi senga bog'liq.\n" +
          "4) Qisqa maydonlar: 'joy' (qayerda), 'yuza' (tovar nimaning ustida yoki kimda), 'balandlik' (yuza pastdan necha foiz), 'kadr', 'yoruglik', 'palitra'.\n" +
          // ✅ 646: IJODIY O'Q — bu qator 641 da tushib qolgandi va rejissyor
          // hech qanday yo'nalish olmay, har safar bir xil sahna yozardi.
          "\nBU SAFARGI IJODIY O'Q (oltita o'q, tasodifiy tanlangan):\n" +
          "· janr: " + x.janr + "\n· vaqt va yorug'lik: " + x.vaqt + "\n· fasl: " + x.fasl +
          "\n· rang kayfiyati: " + x.rang + "\n· kamera: " + x.kamera + "\n· dunyo: " + x.dunyo + "\n" +
          "Shu o'qni ASOS qil — sahna, yorug'lik va kadr shundan kelib chiqsin. " +
          "Tovarga mutlaqo mos kelmasa (masalan qishki etikka plyaj) eng yaqin variantni o'zing tanla va sababini 'sabab' ga yoz. " +
          "⚠️ Quyidagilar oxirgi paytda haddan tashqari ko'p ishlatildi — ijodiy o'q ularni nomlamasa, ISHLATMA: " +
          I_KLISHE.join(" · ") + ".\n" +
          "'poza', 'uslub_ogoh', 'neytral' — faqat odamli kadrda to'ldiriladi.\n") +
      "Faqat shu JSON: {\"tovar_turi\":\"oyoq kiyim|ust kiyim|past kiyim|libos|aksessuar — SURATGA qarab\"," +
      "\"ishonch\":\"yuqori|o'rta|past\"," +
      "\"yaroqli\":true|false,\"daraja\":1-5,\"sarlavha\":\"8 so'zgacha qisqa hukm\"," +
      "\"bandlar\":[\"3 tagacha aniq maslahat — material va g'ijim bo'lsa shu yerda\"]," +
      "\"sahna\":{\"joy\":\"qayerda\",\"yuza\":\"tovar nimaning ustida turadi\",\"balandlik\":\"yuza kadrning pastdan necha foizida\"," +
      "\"yoruglik\":\"yo'nalish va turi\",\"kamera\":\"balandlik va linza\",\"chuqurlik\":\"orqada nima, qanchalik xira\"," +
      "\"rekvizit\":\"0-2 ta yoki yo'q\",\"palitra\":\"3 rang\"," +
      "\"buyruq\":\"English prompt, 40-70 words, built from these bands: place, the support surface and its height in frame, light direction and quality, camera height and lens, background depth, props, colour palette. Background only: no product, no people, no text.\"}," +
      "\"joylashuv\":{\"foiz\":\"tovar kadr balandligining necha foizini egallasin, 50-70\"," +
      "\"markaz_x\":\"tovar markazi chapdan, foiz 0-100\",\"gorizont\":\"yuza chizig'i pastdan, foiz 0-100 — tovarning TAGI shu chiziqqa qo'yiladi\"," +
      "\"soya_yon\":\"chap|ong|past — yorug'likka teskari tomon\",\"soya_kuch\":\"1-10, qattiq yorug'likda katta\"}}";
    let hukm = null, xato = "", tok = {};
    try {
      const r = await aiChaqir(M_AI, REJISSYOR, [
        { type: "image", source: { type: "base64", media_type: im.media, data: im.data } },
        { type: "text", text: savol }], 3000, 52000, HUKM_SXEMA);   // ✅ 640: 40 s ham kam edi (jonli: 13:48 vaqt tugadi)
      tok = Object.assign({}, r.usage, { stop: r.stop, prov: r.prov, model: r.model, zaxira: r.zaxira }); hukm = _jsonAjrat(r.text);
      hukm.yaroqli = !!hukm.yaroqli; hukm.daraja = Math.max(1, Math.min(5, Number(hukm.daraja) || 3));
      hukm.tovar_turi = _tovarTuri(hukm.tovar_turi);            // ✅ 3-bosqich
      hukm.ishonch = /past|low/.test(String(hukm.ishonch || "")) ? "past"
                   : /o'rta|orta|mid|medium/.test(String(hukm.ishonch || "")) ? "orta" : "yuqori";
      hukm.sarlavha = String(hukm.sarlavha || "").slice(0, 80);
      hukm.bandlar = Array.isArray(hukm.bandlar) ? hukm.bandlar.slice(0, 3).map(x => String(x).slice(0, 140)) : [];
      // ✅ v2.1: 9 band saqlanadi; "buyruq" kelmasa — bandlardan YIG'ILADI,
      // ya'ni klient har doim ishlaydigan matn oladi (eski shartnoma buzilmaydi).
      hukm.sahna = _sahnaRetsept(hukm.sahna, x);
      hukm.joylashuv = _joylashuv(hukm.joylashuv, hukm.sahna);   // ✅ 2-bosqich
      hukm.poza = String(hukm.poza || "").replace(/\s+/g, " ").trim().slice(0, 160);   // ✅ 634
      hukm.neytral = String(hukm.neytral || "").replace(/\s+/g, " ").trim().slice(0, 160);
      hukm.uslub_ogoh = Array.isArray(hukm.uslub_ogoh)
        ? hukm.uslub_ogoh.slice(0, 3).map(z => String(z).slice(0, 140)).filter(Boolean) : [];
    } catch (e) { xato = e.message; }
    await jurnal(shopId, "ai_hukm", tok.prov || "ai", tok.model || M_AI, !xato, (xato || ("in " + (tok.input_tokens || 0) + " out " + (tok.output_tokens || 0))) + (tok.stop ? " · " + tok.stop : ""));
    if (xato) return res.status(200).json({ ok: false, error: xato });
    return res.status(200).json({ ok: true, hukm });
  }

  // ── ✅ v2: REJISSYOR — uz/ru post matni ──
  if (amal === "ai_matn") {
    const tovar = body.tovar || {}, til = String(body.til || "ikkalasi");
    const savol = "Tovar:\n" + _tovarMatn(tovar) + "\nReklama turi: " + String(body.turi || "tovar") +
      (body.sahna ? "\nSahna: " + String(body.sahna).slice(0, 80) : "") + (body.sarlavha ? "\nDo'kon sarlavhasi: " + String(body.sarlavha).slice(0, 40) : "") +
      "\n\nInstagram/Telegram uchun post matni yoz: 2-4 jumla, samimiy va aniq, oxirida \"buyurtma — xabar yozing\" ma'nosidagi chaqiriq, emoji ko'pi bilan bitta. " +
      // ✅ 648: MATNDA NIMA BO'LISHINI EGASI GALOCHKA BILAN BELGILAYDI.
      // Rasm ustida ko'rsatilmagan ma'lumot matnga tushishi mumkin, lekin
      // faqat ruxsat berilgan bo'lsa. Ruxsat yo'q bo'lsa — umuman yozilmaydi.
      "MATNGA KIRITISH RUXSATLARI (qat'iy): " +
      (body.mt_nom === false ? "tovar NOMINI yozma. " : "tovar nomini yoz. ") +
      (String(body.narx || "") ? "narxni yoz (" + String(body.narx).slice(0, 20) + " so'm). " : "NARXNI umuman yozma — raqam ham, taxmin ham. ") +
      (body.mt_art === false ? "artikul va rang kodini yozma. " : "artikul va rangni yoz. ") + " " +
      "Faqat shu JSON: {\"uz\":{\"sarlavha\":\"\",\"matn\":\"\",\"heshteg\":[\"#..\"]},\"ru\":{\"sarlavha\":\"\",\"matn\":\"\",\"heshteg\":[\"#..\"]}}" +
      (til === "uz" ? " (ru bo'sh qolsin)" : til === "ru" ? " (uz bo'sh qolsin)" : "");
    let matn = null, xato = "", tok = {};
    try {
      const r = await aiChaqir(M_AI, REJ_MATN, [{ type: "text", text: savol }], 900, 30000, MATN_SXEMA);
      tok = Object.assign({}, r.usage, { prov: r.prov, model: r.model }); matn = _jsonAjrat(r.text);
      for (const k of ["uz", "ru"]) { const o = matn[k] || {}; matn[k] = { sarlavha: String(o.sarlavha || "").slice(0, 80), matn: String(o.matn || "").slice(0, 600),
        heshteg: (Array.isArray(o.heshteg) ? o.heshteg : []).slice(0, 8).map(x => String(x).slice(0, 30)) }; }
    } catch (e) { xato = e.message; }
    await jurnal(shopId, "ai_matn", tok.prov || "ai", tok.model || M_AI, !xato, xato || ("in " + (tok.input_tokens || 0) + " out " + (tok.output_tokens || 0)));
    if (xato) return res.status(200).json({ ok: false, error: xato });
    return res.status(200).json({ ok: true, matn });
  }

  // ── ✅ v2: REJISSYOR — natija ASL tovarga mosmi (2-rasm sinfi xatosini ushlaydi) ──
  if (amal === "ai_solishtir") {
    const [n0, ch0] = await Promise.all([oySarfi(shopId), chegaraOl(shopId)]);
    if (n0 >= ch0.chegara)
      return res.status(200).json({ ok: false, limit: true, sarf: n0, chegara: ch0.chegara, error: `Bu oydagi ${ch0.chegara} kredit tugadi.` });
    const asl = _dataUri(body.asl, 1400), nat = _dataUri(body.natija, 1400);
    if (!asl || asl.xato || !nat || nat.xato) return res.status(200).json({ ok: false, error: "Ikkala rasm kerak (asl va natija), 1,4 MB gacha" });
    // ✅ 634: MUHIT REJIMI. Muhit qadamida ikki rasmda ham AYNI kadr bo'ladi,
    // faqat fon almashadi — u yerda "tovar kadrda asosiy obyektmi" deb
    // so'rash NOTO'G'RI (to'liq bo'yli kadrda tovar har doim kichik).
    // 633 da shu sabab muhit deyarli har safar rad etilardi.
    // ✅ 642: YANGI SURAT REJIMI. 641 da rassom endi BUTUNLAY YANGI kadr
    // chizadi — burchak, yorug'lik, kadr ataylab boshqa. Eski 15 bandli
    // tekshiruv esa piksel darajasida solishtirardi va yangi yo'lni HAR
    // SAFAR rad etardi (jonli: 16-sen, "AI tovarni o'zgartirib qo'ydi").
    // Bu yerda savol boshqacha: MIJOZ buni o'sha tovar deb taniydimi?
    if (String(body.rejim || "") === "yangi") {
      const savolY = "Birinchi rasm — tovarning ASL surati (do'kon telefonda olgan). " +
        "Ikkinchi rasm — SHU tovarning professional reklama uchun QAYTA olingan surati. " +
        "Burchak, kadr, yorug'lik, fon, tovar holati ATAYLAB boshqacha — bular farq emas, buni yozma. " +
        "Yagona savol: mijoz ikkinchi rasmda AYNI SHU tovarni taniydimi? " +
        "Faqat MODELNI o'zgartiradigan farqlarni yoz: asosiy rang boshqa · siluet/shakl boshqa · " +
        "tag turi yoki qalinligi boshqa · logotip yo'q, qo'shilgan yoki boshqa joyda · " +
        "bog'ich turi boshqa (ip ↔ tasma) · material boshqa (teri ↔ zamsh ↔ mato) · " +
        "tugma/zamok soni boshqa · naqsh boshqa · qo'shimcha element qo'shilgan. " +
        "Yorug'likdan kelib chiqqan tus farqi, aks, soya, faktura o'tkirligi — FARQ EMAS. " +
        "'mos' = mijoz uni o'sha tovar deb taniydi. Har farq: [og'irlik] QAYERDA — NIMA. Tovar: " +
        _tovarMatn(body.tovar || {});
      try {
        const r = await aiChaqir(M_AI_HUKM, REJ_TEKSHIR, [
          { type: "image", source: { type: "base64", media_type: asl.media, data: asl.data } },
          { type: "image", source: { type: "base64", media_type: nat.media, data: nat.data } },
          { type: "text", text: savolY }], 700, 45000, TEKSHIR_SXEMA);
        const hh = _jsonAjrat(r.text);
        const h2 = { mos: !!hh.mos, ishonch: Math.max(0, Math.min(100, Number(hh.ishonch) || 0)),
          farqlar: Array.isArray(hh.farqlar) ? hh.farqlar.slice(0, 4).map(z => String(z).slice(0, 150)) : [],
          tavsiya: String(hh.tavsiya || "qabul") };
        await jurnal(shopId, "ai_solishtir:yangi", r.prov || "ai", r.model || M_AI_HUKM, true,
          (h2.mos ? "MOS" : "MOS EMAS") + " " + h2.ishonch + "% · " + (h2.farqlar[0] || "farq yo'q"));
        return res.status(200).json({ ok: true, hukm: h2 });
      } catch (e) {
        await jurnal(shopId, "ai_solishtir:yangi", "ai", AI_PROV === "gemini" ? M_GEM : M_AI_HUKM, false, e.message);
        return res.status(200).json({ ok: false, error: e.message });
      }
    }
    // ✅ 636: KADR REJIMI — "tovar kadrda ko'rinyaptimi" (sifat qiyosi emas).
    // Sabab: 632 da kadr qo'lda yaqinlashtirilgandi va odamli kadrda tovar
    // butunlay chiqib ketdi. Qo'lda raqam ishlamaydi — ko'z bilan tekshiriladi.
    if (String(body.rejim || "") === "kadr") {
      const savolK = "Birinchi rasm — ASL tovar. Ikkinchi rasm — tayyor reklama kadri. " +
        "Bitta savol: shu tovar reklama kadrida KO'RINYAPTIMI va tanib bo'ladimi? " +
        "'mos' = tovar kadrda to'liq yoki deyarli to'liq ko'rinadi va kadrning asosiy mavzusi. " +
        "'mos' EMAS = tovar kadrdan chiqib ketgan, kesilgan, juda kichik yoki umuman yo'q. " +
        "Rang, sifat, material — bu yerda tekshirilmaydi. Farqda QISQA yoz: kadrda nima ko'rinyapti. " +
        "Tovar: " + _tovarMatn(body.tovar || {});
      try {
        const r = await aiChaqir(M_AI_HUKM, REJ_TEKSHIR, [
          { type: "image", source: { type: "base64", media_type: asl.media, data: asl.data } },
          { type: "image", source: { type: "base64", media_type: nat.media, data: nat.data } },
          { type: "text", text: savolK }], 500, 40000, TEKSHIR_SXEMA);
        const hh = _jsonAjrat(r.text);
        await jurnal(shopId, "ai_solishtir:kadr", r.prov || "ai", r.model || M_AI_HUKM, true,
          "in " + (r.usage.input_tokens || 0) + " out " + (r.usage.output_tokens || 0));
        return res.status(200).json({ ok: true, hukm: {
          mos: !!hh.mos, ishonch: Math.max(0, Math.min(100, Number(hh.ishonch) || 0)),
          farqlar: Array.isArray(hh.farqlar) ? hh.farqlar.slice(0, 3).map(z => String(z).slice(0, 140)) : [],
          tavsiya: String(hh.tavsiya || "qabul") } });
      } catch (e) {
        await jurnal(shopId, "ai_solishtir:kadr", "ai", AI_PROV === "gemini" ? M_GEM : M_AI_HUKM, false, e.message);
        return res.status(200).json({ ok: false, error: e.message });
      }
    }
    if (String(body.rejim || "") === "muhit") {
      const savolM = "Ikkala rasmda ham AYNI ODAM va ayni kiyim bor. Birinchi — muhit qo'yilishidan OLDIN, ikkinchi — KEYIN. " +
        "Faqat bitta savol: odam kiygan TOVAR o'zgardimi? Tekshir: rang, shakl, tag, tugma, zamok, naqsh, tikuv, logotip, bog'ich, material fakturasi. " +
        "Fon, joy, yorug'lik, soya, poza, kadr, odamning boshqa kiyimlari — ATAYLAB o'zgartirilgan, ular farq qilishi NORMAL, ular haqida yozma. " +
        "Odamning yuzi yoki tanasi o'zgargan bo'lsa — buni farq deb yoz. " +
        "'mos' = tovar o'zgarmagan. Har farq: [og'irlik] QAYERDA — NIMA. Tovar: " + _tovarMatn(body.tovar || {});
      try {
        const r = await aiChaqir(M_AI_HUKM, REJ_TEKSHIR, [
          { type: "image", source: { type: "base64", media_type: asl.media, data: asl.data } },
          { type: "image", source: { type: "base64", media_type: nat.media, data: nat.data } },
          { type: "text", text: savolM }], 900, 45000, TEKSHIR_SXEMA);
        const hh = _jsonAjrat(r.text);
        await jurnal(shopId, "ai_solishtir:muhit", r.prov || "ai", r.model || M_AI_HUKM, true,
          "in " + (r.usage.input_tokens || 0) + " out " + (r.usage.output_tokens || 0));
        return res.status(200).json({ ok: true, hukm: {
          mos: !!hh.mos, ishonch: Math.max(0, Math.min(100, Number(hh.ishonch) || 0)),
          farqlar: Array.isArray(hh.farqlar) ? hh.farqlar.slice(0, 6).map(z => String(z).slice(0, 160)) : [],
          tavsiya: String(hh.tavsiya || "qabul") } });
      } catch (e) {
        await jurnal(shopId, "ai_solishtir:muhit", "ai", AI_PROV === "gemini" ? M_GEM : M_AI_HUKM, false, e.message);
        return res.status(200).json({ ok: false, error: e.message });
      }
    }
    // ✅ 633: 15 bandli tekshiruv (bilim ro'yxati §7) + farq QAYERDA + og'irligi
    const savol = "Birinchi rasm — ASL tovar surati. Ikkinchi rasm — AI yasagan reklama. Tovar (kiyim/oyoq kiyim/aksessuar) ikkinchi rasmda ASL bilan bir xilmi? " +
      "15 band: 1 rang va tus · 2 shakl va silu · 3 TAG (oyoq kiyim: qalin/yupqa, rezina/charm) · 4 tugma va zamok · 5 naqsh va tikuv · 6 logotip va yozuv · 7 cho'ntaklar · " +
      "8 MATERIAL fakturasi (teri plastikka aylanmaganmi) · 9 o'lcham nisbati (poshna, yeng, etak) · 10 bog'ich, tasma, zanjir, ilgak · 11 yoqa turi · " +
      "12 naqsh yo'nalishi va o'lchami · 13 chok va qirralar (qo'shimcha chok paydo bo'lganmi) · 14 rang soni (ikki rangli bir rangga aylanganmi) · 15 TOVAR KO'RINADIMI — kadrda to'liq va asosiy obyektmi. " +
      "Fon, yorug'lik, poza, odam, kadr burchagi — E'TIBORGA OLINMAYDI. " +
      "Har farqni shunday yoz: [og'irlik: kichik|sezilarli|qabul qilib bo'lmaydi] QAYERDA (masalan: o'ng poyabzal tashqi tomoni) — NIMA. " +
      "'mos' faqat sezilarli yoki qabul qilib bo'lmaydigan farq YO'Q bo'lsa true. " +
      "Tovar:\n" + _tovarMatn(body.tovar) +
      "\nFaqat shu JSON: {\"mos\":true|false,\"ishonch\":0-100,\"farqlar\":[\"aniq farq, o'zbekcha, 3 tagacha\"],\"tavsiya\":\"qabul|qayta|rad\"}";
    let hukm = null, xato = "", tok = {};
    try {
      const r = await aiChaqir(M_AI_HUKM, REJ_TEKSHIR, [
        { type: "image", source: { type: "base64", media_type: asl.media, data: asl.data } },
        { type: "image", source: { type: "base64", media_type: nat.media, data: nat.data } },
        { type: "text", text: savol }], 900, 45000, TEKSHIR_SXEMA);   // ✅ v2.6: sxema
      tok = Object.assign({}, r.usage, { prov: r.prov, model: r.model }); hukm = _jsonAjrat(r.text);
      hukm = { mos: !!hukm.mos, ishonch: Math.max(0, Math.min(100, Number(hukm.ishonch) || 0)),
        farqlar: (Array.isArray(hukm.farqlar) ? hukm.farqlar : []).slice(0, 3).map(x => String(x).slice(0, 120)),
        tavsiya: ["qabul", "qayta", "rad"].includes(hukm.tavsiya) ? hukm.tavsiya : (hukm.mos ? "qabul" : "qayta") };
    } catch (e) { xato = e.message; }
    // ✅ 639: HUKM JURNALGA. Ilgari faqat token yozilardi; natija rad
    // etilganda sababi ekrandagi toastda o'tib ketardi va tahlil qilib
    // bo'lmasdi. Endi: mos/emas · ishonch · birinchi farq.
    await jurnal(shopId, "ai_solishtir", tok.prov || "ai", tok.model || M_AI_HUKM, !xato,
      xato || ((hukm && hukm.mos ? "MOS" : "MOS EMAS") +
        " " + ((hukm && hukm.ishonch) || 0) + "% · " +
        ((hukm && hukm.farqlar && hukm.farqlar[0]) || "farq yo'q") +
        " · in " + (tok.input_tokens || 0) + " out " + (tok.output_tokens || 0)).slice(0, 200));
    if (xato) return res.status(200).json({ ok: false, error: xato });
    return res.status(200).json({ ok: true, hukm });
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
    const tur = s.id;
    // ✅ v2: rejissyor buyrug'i bo'lsa — u ishlatiladi (faqat FON: tovar/matn/odam yo'q)
    const aiB = String(body.ai_buyruq || "").replace(/\s+/g, " ").trim().slice(0, 600);
    // ✅ v2.1: yuza KO'RINSIN va uning o'rtasi BO'SH qolsin — aks holda
    // rassom yuzani kadrdan chiqarib yuboradi yoki ustiga narsa qo'yadi,
    // natijada tovar havoda qolgandek ko'rinadi.
    const matn = aiB ? (aiB + ". The described support surface must be clearly " +
      "visible in the lower half of the frame, well lit, and completely empty — " +
      "nothing placed or standing on it. Background only: no product, no people, " +
      "no hands, no text, no logo. Photorealistic, high resolution.") : s.matn;
    let chiq = null, xato = "", prov = "fal", model = M_SAHNA;
    try {
      const j = await falRun(M_SAHNA,                                    // ✅ 637
        Object.assign(_falSahna(M_SAHNA, matn, "square_hd"),
                      _gptMi(M_SAHNA) ? {} : { sync_mode: true }), 46000);
      chiq = falRasm(j);
    } catch (e) { xato = e.message; }
    const falXato = xato;                            // ✅ 639: fal sababi saqlanadi
    if (!chiq && GEMINI_KEY) {                       // zaxira yo'l
      try { chiq = await geminiSahna(matn); prov = "gemini"; model = G_IMG; }
      catch (e) { xato += " | " + e.message; }
    }
    // ✅ 639 (B8): zaxira yo'l QUTQARSA HAM asosiy model xatosi yozilsin.
    // Ilgari Gemini ishlagach `izoh` bo'sh qolardi va fal nega yiqilgani
    // butunlay ko'rinmasdi (jonli holat: 16-sen 13:32 va 13:40).
    await jurnal(shopId, "sahna:" + kat + ":" + tur, prov, model, !!chiq,
      chiq ? (falXato ? ("zaxira · fal: " + String(falXato).slice(0, 150)) : "") : xato);
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
      const j = await falRun(M_SAHNA,                                    // ✅ 637
        Object.assign(_falSahna(M_SAHNA, matn, "portrait_16_9"),
                      _gptMi(M_SAHNA) ? {} : { seed }), 52000);
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
    // ✅ NAVBAT: darhol topshirib, request_id qaytaramiz
    try {
      const q = await falSubmit(M_TRYON, {
        model_image: shaxsRasm, garment_image: kiyim,
        category: String(body.turi || "auto"),
        mode: "balanced", garment_photo_type: "auto",
        num_samples: 1, segmentation_free: true, output_format: "png",
      });
      return res.status(200).json({ ok: true, navbat: true, amal: "kiydir:" + jins,
        model: M_TRYON, status_url: q.status_url, response_url: q.response_url });
    } catch (e) {
      await jurnal(shopId, "kiydir:" + jins, "fal", M_TRYON, false, e.message);
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── ✅ TUR (2026-09-07): KATALOG RASMINI OLISh ──
  // Tovarning o'z rasmi (Supabase storage) canvas'ga to'g'ridan
  // yuklansa "iflos" bo'ladi — server orqali data qilib beramiz.
  // Faqat O'Z omborimizdan (SUPABASE_URL) ruxsat.
  if (amal === "rasm_ol") {
    const u = String(body.url || "");
    if (!/^https?:\/\//.test(u) || u.indexOf(String(SB_URL).replace(/^https?:\/\//, "")) < 0)
      return res.status(200).json({ ok: false, error: "Faqat o'z omboridagi rasm" });
    try { return res.status(200).json({ ok: true, image: await fonData(u) }); }
    catch (e) { return res.status(200).json({ ok: false, error: e.message }); }
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
    // ✅ TUR: odam kadri uchun ko'cha/shahar/interyer afzal (egasi: "shahar
    // yoki bino foni"), studiya fonlari kamroq
    if (sinf !== "tovar" && body.uslub !== "studiya") {
      const sh = ro.filter(f => f.kat === "kocha" || f.kat === "interyer" || f.kat === "tabiat");
      if (sh.length) ro = sh;
    }
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

  // ── ✅ NAVBAT: holatni so'rash va natijani olish ──
  if (amal === "fal_holat") {
    const su = String(body.status_url || ""), ru = String(body.response_url || "");
    if (!_falUrlOk(su) || !_falUrlOk(ru))
      return res.status(200).json({ ok: false, error: "Navbat manzili yaroqsiz" });
    try {
      const h = await falHolat(su);
      if (h.status !== "COMPLETED")
        return res.status(200).json({ ok: true, navbat: true, holat: h.status, pozitsiya: h.navbat });
      const j = await falNatija(ru);
      const url = falRasm(j);
      if (!url) throw new Error("natijada rasm yo'q");
      const data = /^data:/.test(url) ? url : await fonData(url);
      const nomi = String(body.amal || "navbat");
      await jurnal(shopId, nomi, "fal", String(body.model || ""), true, "");
      const n = await oySarfi(shopId);
      return res.status(200).json({ ok: true, image: data, sarf: n,
        chegara: (await chegaraOl(shopId)).chegara });
    } catch (e) {
      await jurnal(shopId, String(body.amal || "navbat"), "fal", String(body.model || ""), false, e.message);
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── ✅ OQ: OYOQ KIYIM / AKSESSUAR — tahrir modeli bilan ──
  if (amal === "kiydir_edit") {
    const shaxs = String(body.model_image || ""), tovar = String(body.image || "");
    if (!/^data:image\//.test(tovar)) return res.status(200).json({ ok: false, error: "Tovar rasmi yo'q" });
    if (tovar.length + shaxs.length > MAX_KB * 1024)
      return res.status(200).json({ ok: false, error: "Rasmlar juda katta" });
    const [n0, ch0] = await Promise.all([oySarfi(shopId), chegaraOl(shopId)]);
    if (n0 >= ch0.chegara)
      return res.status(200).json({ ok: false, limit: true, error: `Bu oydagi ${ch0.chegara} kredit tugadi.` });
    let shaxsRasm = /^data:image\//.test(shaxs) || /^https?:\/\//.test(shaxs) ? shaxs : "";
    if (!shaxsRasm) {
      const m = await modelOl(shopId, body.jins === "ayol" ? "ayol" : "erkak");
      if (!m || !m.url) return res.status(200).json({ ok: false, model_yoq: true, error: "Model yo'q" });
      shaxsRasm = m.url;
    }
    const tur = String(body.turi || "shoes");
    const nima = tur === "shoes" ? "footwear (shoes)" :
                 tur === "soat"  ? "wrist watch" :
                 tur === "sumka" ? "bag" : "accessory";
    const matn =
      `Edit the first image (the person). Replace ONLY the person's ${nima} with the exact ` +
      `product shown in the second image. Keep the product's design, colour, material, ` +
      `logo and shape exactly as in the second image. Do NOT change the person's face, ` +
      `hair, skin, body, pose, clothing or the background in any way. Photorealistic, ` +
      `natural lighting and shadows matching the original photo.` +
      // ✅ 631: oyoq kiyim — JUFTLIK va oyoqlar kadrdan chiqmasin (egasi:
      // "biror marta ham juft yaratmadi"; natija kadri oyoqni kesib yuborardi)
      (tur === "shoes" ? ` The person wears the PAIR — both shoes fully visible on both feet, ` +
        `laced and worn naturally. Keep the full frame including the feet; do not crop or zoom.` : "");
    try {                                          // ✅ NAVBAT
      const q = await falSubmit(M_KIYD, _falPar(M_KIYD,                  // ✅ 637
        { prompt: matn, rasmlar: [shaxsRasm, tovar], nisbat: "auto" }));
      return res.status(200).json({ ok: true, navbat: true, amal: "kiydir_edit:" + tur,
        model: M_KIYD, status_url: q.status_url, response_url: q.response_url });
    } catch (e) {
      await jurnal(shopId, "kiydir_edit:" + tur, "fal", M_KIYD, false, e.message);
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── ✅ 631 · JOYLASHTIR — tovarni sahnaga AI qo'yadi (o'rta yo'l, 3.54 ning
  // yangi shakli: taqiq emas — TEKSHIRUV). Tahrir modeli tovar suratini oladi
  // va rejissyor sahnasiga qo'yadi: yuza, kontakt soyasi, yorug'lik bitta
  // kadrda. Natija klientda `ai_solishtir` dan o'tadi; mos bo'lmasa klient
  // eski yo'lga (kesish + fon + brauzer) qaytadi. ──
  if (amal === "joylashtir") {
    const tovar = String(body.image || "");
    if (!/^data:image\//.test(tovar))
      return res.status(200).json({ ok: false, error: "Tovar rasmi yuborilmadi" });
    if (tovar.length > MAX_KB * 1024)
      return res.status(200).json({ ok: false, error: "Rasm juda katta" });
    const [n0, ch0] = await Promise.all([oySarfi(shopId), chegaraOl(shopId)]);
    if (n0 >= ch0.chegara)
      return res.status(200).json({ ok: false, limit: true, error: `Bu oydagi ${ch0.chegara} kredit tugadi.` });
    const S = body.sahna || {}, J = _joylashuv(body.joylashuv, S);
    const b = k => String(S[k] || "").replace(/\s+/g, " ").trim();
    const brif = String(S.buyruq || "").replace(/\s+/g, " ").trim().slice(0, 1400);
    const tur = String(body.turi || "") || _tovarTuri(body.tovar_turi || "");
    // ✅ 641 — "YOPIShTIRISh" DAN "SURATGA OLISh" GA.
    // Eski buyruq: "shu tovarni shu sahnaga QO'Y" → tahrir modeli kesilgan
    // rasmni fonga yopishtirardi: qiyshiqlik, bitta poyabzal, yorug'lik
    // mos emas, chuqurlik yo'q. Endi: namunadagi tovar bilan BUTUNLAY
    // YANGI fotografiya. Rakurs, juftlik, poza, kadr — rejissyor brifidan.
    // Himoya — tovar sadoqati bandi + klientdagi tekshiruv darvozasi.
    const matn =
      "Create a completely NEW professional advertising photograph of the product shown in the reference image. " +
      "Do not copy the reference framing, angle or lighting — the reference is only there to define WHAT the product is. " +
      "Re-photograph it properly, as a commercial photographer would.\n\n" +
      (String(body.tuzat || "").trim()
        ? "PREVIOUS ATTEMPT WAS REJECTED. The product was rendered incorrectly: " +
          String(body.tuzat).replace(/\s+/g, " ").trim().slice(0, 300) +
          ". Fix exactly this while keeping everything else in the brief.\n\n" : "") +
      "ART DIRECTION:\n" + (brif || (
        "A natural, modern lifestyle shot of the product in an everyday city setting, soft directional daylight, " +
        "shallow depth of field, product sharp and dominant in frame.")) + "\n\n" +
      (tur === "shoes"
        ? "FOOTWEAR: show the PAIR, both shoes visible and correctly oriented, standing on a real surface with " +
          "natural contact shadows. Never a single shoe floating. "
        : "") +
      "PRODUCT FIDELITY — this is the strictest requirement: the product must match the reference EXACTLY in " +
      "colour, shape, silhouette, sole, laces, buttons, zips, stitching lines, logo and its placement, pattern, " +
      "material texture and proportions. Do not restyle, recolour, simplify or add anything to the product.\n" +
      "FRAME: the product occupies about " + J.foiz + "% of the frame height and is the sharpest, most contrasted " +
      "element in the image. Everything else falls away in soft focus.\n" +
      // ✅ 642: TOZALASh — namunadagi do'kon buyumlari yangi kadrga o'tmasin
      "CLEAN UP: the reference may contain shop items that must NOT appear in the new photograph — " +
      "shoe trees or wooden lasts inside the shoe, paper stuffing, price tags, barcode labels, hands or fingers, " +
      "hangers, clips, cardboard, shop shelves. The product must look worn-ready and empty inside.\n" +
      "FORBIDDEN: no text, no letters, no numbers, no price tags, no watermarks, no borders or frames, no collage, " +
      "no duplicated product, no other brand logos, no flat colour panels. Photorealistic, high resolution.";
    try {                                          // NAVBAT — kiydir_edit bilan bir xil
      const q = await falSubmit(M_JOY, _falPar(M_JOY,                    // ✅ 637
        { prompt: matn, rasmlar: [tovar], nisbat: "4:5" }));
      return res.status(200).json({ ok: true, navbat: true, amal: "joylashtir",
        model: M_JOY, status_url: q.status_url, response_url: q.response_url });
    } catch (e) {
      await jurnal(shopId, "joylashtir", "fal", M_JOY, false, e.message);
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── ✅ 633 · MUHIT — kiydirilgan odamning FONINI rejissyor muhitiga
  // almashtiradi (bilim ro'yxati §4.3-4.4). Odam, tovar, poza — daxlsiz;
  // faqat fon, yer, yorug'lik. Natija klientda tekshiruvdan o'tadi;
  // tovar o'zgargan bo'lsa — muhitsiz natija qoladi. ──
  if (amal === "muhit") {
    const odam = String(body.image || "");
    if (!/^data:image\//.test(odam))
      return res.status(200).json({ ok: false, error: "Odam rasmi yuborilmadi" });
    if (odam.length > MAX_KB * 1024)
      return res.status(200).json({ ok: false, error: "Rasm juda katta" });
    const [n0, ch0] = await Promise.all([oySarfi(shopId), chegaraOl(shopId)]);
    if (n0 >= ch0.chegara)
      return res.status(200).json({ ok: false, limit: true, error: `Bu oydagi ${ch0.chegara} kredit tugadi.` });
    const S = body.sahna || {};
    const b = k => String(S[k] || "").replace(/\s+/g, " ").trim().slice(0, 140);
    const tur = String(body.turi || "");
    const poza = String(body.poza || "").replace(/\s+/g, " ").trim().slice(0, 160);
    const neytral = String(body.neytral || "").replace(/\s+/g, " ").trim().slice(0, 160);
    const kadr = tur === "shoes" ? "Camera low, near ground level, so the footwear is the main subject. " :
                 tur === "aksessuar" ? "Camera at waist level, the accessory clearly visible. " : "";
    // ✅ 650: REJISSYOR BRIFI ISHLATILADI. Ilgari faqat qisqa maydonlardan
    // (joy, yuza, yorug'lik) buyruq yig'ilardi va rejissyorning to'liq
    // muhit brifi ("buyruq") TAShLAB YUBORILARDI — natijada muhit zaif
    // chiqib, model studiya fonini saqlab qolardi (jonli: AI-model kadri
    // bo'm-bo'sh kulrang fonda chiqdi).
    const brif = String(S.buyruq || "").replace(/\s+/g, " ").trim().slice(0, 1400);
    const matn =
      `Edit this photo of a person. Replace ONLY the background and the ground with a real environment.\n\n` +
      `ENVIRONMENT BRIEF:\n` + (brif ||
        (`${b("joy") || "a quiet city street"}; the person stands on ${b("yuza") || "the pavement"}; ` +
         `lighting: ${b("yoruglik") || "soft natural light"}`)) + `\n\n` +
      `The background must be a REAL place with depth — never a plain studio backdrop, never a flat grey or ` +
      `white wall, never an empty seamless background. Buildings, street, interior, nature — something with ` +
      `distance and detail behind the person.\n` +
      `The person's feet are in natural contact with the ground, with a soft contact shadow. ` +
      `The same light now falls on the person, so their shadows and highlights match the new scene. ` +
      // ✅ 644: `chuqurlik` 641 da sxemadan chiqarilgan — endi `kadr` dan
      // olinadi, bo'sh bo'lsa xavfsiz sukut. Ilgari bu yerda har doim
      // sukut ishlatilib, rejissyorning kadrlash ko'rsatmasi yo'qolardi.
      `Background: softly blurred, shallow depth of field; the person and especially the worn product stay sharp. ` +
      (b("kadr") ? `Framing: ${b("kadr")}. ` : "") +
      (b("palitra") ? `Colour mood: ${b("palitra")}. ` : "") + kadr +
      // ✅ 634: POZA — odam tik turmasin (bilim §4.4/§5.2). Yuz, tana, teri,
      // soch va TOVAR daxlsiz; faqat gavda holati o'zgaradi.
      (poza ? `Change the person's pose to: ${poza}. Keep the same face, same identity, same body shape, ` +
              `same skin tone and hair. The pose must look natural and the worn product must stay fully visible. ` : "") +
      // ✅ 634: NEYTRALLASh — rejissyor uslub nomuvofiqligini topsa, faqat
      // SHU qismni o'zgartirishga ruxsat (masalan: shimni to'q ko'kka).
      (neytral ? `One allowed wardrobe change: ${neytral}. Change nothing else. ` : "") +
      `CRITICAL: do NOT change the person's face, hair, skin, body shape or hands, and do NOT change ` +
      `the product they wear: same colour, shape, logo, laces, stitching, material. Keep the framing and crop. ` +
      `No text, no other people, no added objects. Photorealistic, high resolution.`;
    try {
      const q = await falSubmit(M_MUHIT, _falPar(M_MUHIT,                // ✅ 637
        { prompt: matn, rasmlar: [odam], nisbat: "auto" }));
      return res.status(200).json({ ok: true, navbat: true, amal: "muhit",
        model: M_MUHIT, status_url: q.status_url, response_url: q.response_url });
    } catch (e) {
      await jurnal(shopId, "muhit", "fal", M_MUHIT, false, e.message);
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ✅ S3: sahna ro'yxati (klient tugmalar chizishi uchun)
  if (amal === "sahnalar") {
    const kat = SAHNA_KUTUB[body.kat] ? body.kat : "umumiy";
    return res.status(200).json({ ok: true, kat,
      royxat: SAHNA_KUTUB[kat].map(s => ({ id: s.id, nom: s.nom })) });
  }

  return res.status(400).json({ ok: false, error: "Noma'lum amal: " + amal });
};
