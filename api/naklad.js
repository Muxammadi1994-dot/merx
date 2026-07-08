// ════════════════════════════════════════════════════════════════
// MERX AI-Naklad  |  api/naklad.js  |  2026-07
// Vebsayt (katalog) uchun: naklad rasmidan Gemini orqali tovar
// jadvalini chiqarib, MERX import shabloniga mos CSV qaytaradi.
// Telegram bot oqimi (api/bot.js) bilan bir xil mantiq, lekin bu
// yerda kirish — brauzerdan yuklangan rasm (base64), Telegram emas.
// ════════════════════════════════════════════════════════════════

const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";  // 2026-07-08: flash-latest o'rniga — bir xil ishlaydi, ~4-5x arzon oddiy tuzilma-chiqarish vazifalari uchun  // 2026-07: 2.0-flash Google tomonidan o'chirildi; "latest" alias avtomatik yangi modelga ishora qiladi

const NAKLAD_PROMPT = `Bu — Xitoydan kelayotgan tovar nakladnoyi (proforma invoice) jadvali rasmi.
Jadvaldagi HAR BIR qatorni (har rang/variant alohida qator) JSON sifatida chiqar.

Har element uchun:
- nom: tovar nomi/turi (masalan "Krossovka", "Ayollar tufli"). Aniq nom yo'q
  bo'lsa, LOGO/brend nomidan foydalanib qisqa umumiy nom yoz.
- artikul: model/stil kodi (Styles NO, Art.No, model raqami — jadvalda odatda
  bor ustun). MAJBURIY va NOYOB bo'lishi kerak: bir xil rangli lekin boshqa
  model kodli qatorlarni ALOHIDA element deb hisobla, birlashtirma.
- rang: rang nomi (COLOR ustuni qiymati, masalan "navy", "black").
- olcham: agar jadvalda o'lcham ustunlari (39,40,41...) bo'lib qiymatlari
  bir xil takrorlansa — eng kichik va eng katta o'lchamni "39-44" formatida
  yoz. O'lcham ustunlari yo'q bo'lsa — bo'sh qoldir ("").
- pochka_soni: CTN ustuni (karobka/karton soni).
- birlik_soni: 1 karobkada nechta DONA (PRS/CTN nisbati, yoki o'lcham
  ustunlaridagi qiymatlar yig'indisi, masalan 2+2+2+2+2+2=12).
- birlik_narx_cny: U.Price ustuni — bitta DONA narxi, Xitoy yuanida (CNY),
  faqat raqam (valyuta belgisiz).

Faqat jadvaldagi haqiqiy tovar qatorlarini chiqar, jami/summary qatorlarni
o'tkazib yubor.

MUHIM — NARX HAR DOIM TO'LDIRILISHI SHART (bu eng ko'p xato qiladigan joy):
- Ba'zi jadvallarda narx ustuni faqat GURUHNING BIRINCHI qatorida
  ko'rsatilib, qolgan rang/variant qatorlarida katak BO'SH yoki
  birlashtirilgan (merged) bo'ladi — bunda o'sha narxni guruhdagi
  BARCHA qatorlarga (pastga qarab) qo'llash kerak, HECH QAYSI qatorni
  narxsiz qoldirma.
- Ba'zan ustunda T.Price (JAMI summa) ko'rsatiladi, U.Price (bitta
  DONA narxi) emas — bunday holda birlik_narx_cny ni T.Price ni
  jami donaga (pochka_soni × birlik_soni) BO'LIB hisobla.
- Agar bir nechta narx ustuni bo'lsa (masalan turli hajm/rangga oid),
  o'sha QATORGA tegishli ustundagi narxni ol, boshqa qatorning
  narxini ishlatma.
- Qiymatni aniq o'qib bo'lmasa ham eng mantiqiy taxminni ber
— hech qachon maydonni bo'sh/noaniq qoldirma.`;

const NAKLAD_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nom:             { type: "STRING" },
          artikul:         { type: "STRING" },
          rang:            { type: "STRING" },
          olcham:          { type: "STRING" },
          pochka_soni:     { type: "NUMBER" },
          birlik_soni:     { type: "NUMBER" },
          birlik_narx_cny: { type: "NUMBER" },
        },
        required: ["rang", "pochka_soni", "birlik_soni", "birlik_narx_cny"],
      },
    },
  },
  required: ["items"],
};

async function geminiExtractNaklad(images) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY sozlanmagan (Vercel ENV)");
  const parts = [
    { text: NAKLAD_PROMPT },
    ...images.map(im => ({ inlineData: { mimeType: im.mimeType, data: im.data } })),
  ];
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: NAKLAD_SCHEMA, temperature: 0.1 },
  };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const data = await r.json();
  if (!r.ok) throw new Error("Gemini xato: " + (data?.error?.message || r.status));
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini bo'sh javob qaytardi");
  const parsed = JSON.parse(text);
  return parsed.items || [];
}

// Kurs + yo'l xarajatini QIYMATGA mutanosib taqsimlab, har dona tannarxini hisoblash
function computeNakladCosts(items, kurs, logistics) {
  const withValue = items.map(it => {
    const jamiDona = Math.max(0, Math.round((it.pochka_soni || 0) * (it.birlik_soni || 0)));
    const valueCny = (it.birlik_narx_cny || 0) * jamiDona;
    return { ...it, jamiDona, valueCny };
  });
  const totalValueCny = withValue.reduce((a, it) => a + it.valueCny, 0) || 1;
  return withValue.map(it => {
    const valueSom = it.valueCny * (kurs || 0);
    const share = logistics > 0 ? logistics * (it.valueCny / totalValueCny) : 0;
    const costPerUnitSom = it.jamiDona > 0 ? Math.round((valueSom + share) / it.jamiDona) : 0;
    return { ...it, costPerUnitSom };
  });
}

// MERX import shabloniga mos CSV (Ulgurji narx bo'sh — sotuvchi to'ldiradi)
function buildNakladCsv(rows) {
  const headers = ["Nom", "ART", "Rang", "O'lcham", "1 pochkada nechta", "Pochka soni", "Tannarx", "Ulgurji narx"];
  const esc = v => { const s = String(v ?? ""); return (s.includes(";") || s.includes(",") || s.includes('"')) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = rows.map(r => [
    r.nom || "Tovar", r.artikul || "", r.rang || "", r.olcham || "",
    r.birlik_soni || "", r.pochka_soni || "", r.costPerUnitSom || "", "",
  ]);
  return "sep=;\r\n" + [headers, ...lines].map(r => r.map(esc).join(";")).join("\r\n");
}

// ═══ TEZKOR KIRITISH: rasm + ovoz BITTA so'rovda (2026-07-08) ═══
// Pres/nakladnoysiz tovar uchun: xodim suratga oladi + tavsiflaydi,
// AI B2 maydonlariga taqsimlaydi. Mavjud analyze() dan MUSTAQIL.
const ITEM_PROMPT = `Sen do'kondagi xodimga tovar kiritishda yordam berasan.
Senga BITTA tovarning surati va xodimning ovozli tavsifi beriladi.
Ovozdagi ma'lumotni tuzilgan JSON qilib chiqar. Surat rangni/turini
tasdiqlash uchun yordamchi, asosiy ma'lumot manbasi — OVOZ.

Maydonlar:
- nom: tovar nomi/turi (masalan "Adidas erkaklar shimi").
- artikul: agar ovozda aytilgan bo'lsa model/artikul kodi, aks holda "".
- rang: agar aytilgan bo'lsa rang nomi, aks holda suratdan taxmin qil.
- pochka_soni: agar aytilgan bo'lsa (masalan "50 pochka"), aks holda 1.
- birlik_soni: "1 pochkada nechta" (masalan "pochkada 5 ta" → 5),
  aytilmagan bo'lsa 1 (yakka dona tovar degani).
- tannarx_som: agar aytilgan bo'lsa (so'mda, masalan "tannarx 60 ming"
  → 60000), aytilmagan bo'lsa 0.
- sotuv_narxi_som: agar aytilgan bo'lsa (masalan "sotuv 100 ming" yoki
  shunchaki narx aytilsa) → so'mda, aytilmagan bo'lsa 0.
- izoh: agar daraja/holat aytilgan bo'lsa (masalan "ikkinchi daraja",
  "kichik nuqson bor") shu yerga yoz, aks holda "".

Faqat JSON qaytar, boshqa hech narsa yozma.`;

const ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    nom:             { type: "STRING" },
    artikul:         { type: "STRING" },
    rang:            { type: "STRING" },
    pochka_soni:     { type: "NUMBER" },
    birlik_soni:     { type: "NUMBER" },
    tannarx_som:      { type: "NUMBER" },
    sotuv_narxi_som:  { type: "NUMBER" },
    izoh:            { type: "STRING" },
  },
  required: ["nom", "rang", "pochka_soni", "birlik_soni"],
};

async function geminiCaptureItem(image, audio) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY sozlanmagan (Vercel ENV)");
  const parts = [{ text: ITEM_PROMPT }];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  if (audio) parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.data } });
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: ITEM_SCHEMA, temperature: 0.1 },
  };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const data = await r.json();
  if (!r.ok) throw new Error("Gemini xato: " + (data?.error?.message || r.status));
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini bo'sh javob qaytardi");
  return JSON.parse(text);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Faqat POST so'rovlar qabul qilinadi" });
  }

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ ok: false, error: "invalid_json" }); }

  const action = req.query?.action || body?.action;

  if (action === "analyze") {
    try {
      const { images, kurs, logistics } = body || {};
      if (!Array.isArray(images) || !images.length) {
        return res.status(400).json({ ok: false, error: "Kamida 1 ta rasm kerak (images)" });
      }
      if (!kurs || kurs <= 0) {
        return res.status(400).json({ ok: false, error: "Kurs (1 CNY necha so'm) kerak" });
      }
      // images: [{ data: base64 (prefiks-siz), mimeType }]
      const items = await geminiExtractNaklad(images);
      if (!items.length) {
        return res.status(200).json({ ok: false, error: "Tovarlar aniqlanmadi — rasm sifatini tekshirib qayta urining" });
      }
      const computed = computeNakladCosts(items, Number(kurs), Number(logistics || 0));
      const csv = buildNakladCsv(computed);
      return res.status(200).json({ ok: true, csv, count: computed.length, rows: computed });
    } catch (e) {
      console.error("naklad analyze xato:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  if (action === "capture_item") {
    try {
      const { image, audio } = body || {};
      if (!audio) return res.status(400).json({ ok: false, error: "Ovoz yozuvi kerak" });
      const item = await geminiCaptureItem(image || null, audio);
      return res.status(200).json({ ok: true, item });
    } catch (e) {
      console.error("naklad capture_item xato:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  return res.status(400).json({ ok: false, error: "Noma'lum action" });
}
