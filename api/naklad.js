// ════════════════════════════════════════════════════════════════
// MERX AI-Naklad  |  api/naklad.js  |  2026-07
// Vebsayt (katalog) uchun: naklad rasmidan Gemini orqali tovar
// jadvalini chiqarib, MERX import shabloniga mos CSV qaytaradi.
// Telegram bot oqimi (api/bot.js) bilan bir xil mantiq, lekin bu
// yerda kirish — brauzerdan yuklangan rasm (base64), Telegram emas.
// ════════════════════════════════════════════════════════════════

const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";  // 2026-07: 2.0-flash Google tomonidan o'chirildi; "latest" alias avtomatik yangi modelga ishora qiladi

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
o'tkazib yubor. Qiymatni aniq o'qib bo'lmasa ham eng mantiqiy taxminni ber
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

  return res.status(400).json({ ok: false, error: "Noma'lum action" });
}
