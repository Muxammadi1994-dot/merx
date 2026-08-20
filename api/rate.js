// ════════════════════════════════════════════════════════════════
// MERX — VALYUTA KURSI  |  api/rate.js  |  2026-08-20
// ════════════════════════════════════════════════════════════════
// Ikki rejim:
//   1) (standart)        — Markaziy Bank rasmiy kursi (2026-07-09 dan beri)
//   2) ?mode=banks       — TIJORAT BANKLARI: har birining SOTUV kursi
//                          ro'yxati qaytariladi, klient eng yuqorisini
//                          (yoki admin belgilagan banklardan eng yuqorisini)
//                          tanlaydi.
//   3) ?debug=1          — har manba nima qaytargani (tekshiruv uchun)
//
// ⚠️ NEGA KO'P MANBA: bank.uz da ochiq JSON API yo'q (/api/v1/currency
// → 404, 2026-08-20 da tekshirildi). Sahifadan o'qish esa sayt
// tuzilishi o'zgarsa buziladi. Shuning uchun bir nechta manba
// ketma-ket sinaladi va BIRORTASI ishlasa yetarli. Hech biri
// ishlamasa — Markaziy Bank kursi qaytariladi (`fallback: true`),
// ya'ni kurs HECH QACHON yo'qolmaydi.
//
// QOIDA: bu yerda faqat MA'LUMOT yig'iladi. Qaysi bankni olish va
// qanday qo'llash — klient qarori (sozlamalarda).
// ════════════════════════════════════════════════════════════════

const UA = { "User-Agent": "Mozilla/5.0 (MERX savdo tizimi)" };

// ── 1. Markaziy Bank (asos — har doim ishlaydi) ──────────────────
async function cbuOl() {
  const r = await fetch("https://cbu.uz/en/arkhiv-kursov-valyut/json/USD/", { headers: UA });
  if (!r.ok) throw new Error("CBU: " + r.status);
  const data = await r.json();
  const row = Array.isArray(data)
    ? (data.find(x => x && (x.Ccy === "USD" || x.CcyNm_EN === "US Dollar")) || data[0])
    : data;
  const rate = parseFloat(row?.Rate);
  if (!rate || rate <= 0) throw new Error("CBU: kurs noto'g'ri");
  return { rate, date: row?.Date || null };
}

// ── 2. NBU (Milliy bank) — ochiq JSON ────────────────────────────
async function nbuOl() {
  const r = await fetch("https://nbu.uz/exchange-rates/json/", { headers: UA });
  if (!r.ok) throw new Error("NBU: " + r.status);
  const j = await r.json();
  const arr = Array.isArray(j) ? j : (j.data || j.result || []);
  const usd = arr.find(x => (x.code === "USD" || x.title === "USD" ||
                             x.ccy === "USD" || x.currency === "USD"));
  if (!usd) throw new Error("NBU: USD topilmadi");
  // Sotuv maydoni turli nomlarda uchraydi — hammasini sinaymiz
  const sell = parseFloat(usd.nbu_cell_price ?? usd.cell_price ?? usd.sell ??
                          usd.sale ?? usd.sell_price ?? usd.nbu_sell);
  const buy  = parseFloat(usd.nbu_buy_price ?? usd.buy_price ?? usd.buy ??
                          usd.purchase ?? usd.nbu_buy);
  if (!sell || sell <= 0) throw new Error("NBU: sotuv kursi yo'q");
  return [{ bank: "NBU (Milliy bank)", sell, buy: buy || null }];
}

// ── 3. bank.uz sahifasidan o'qish (JSON API yo'q) ────────────────
// Sahifadagi jadvaldan bank nomi + sotuv kursini ajratamiz.
// Sayt tuzilishi o'zgarsa bu manba jim yiqiladi — qolganlari ishlaydi.
async function bankUzOl() {
  const r = await fetch("https://bank.uz/uz/currency", { headers: UA });
  if (!r.ok) throw new Error("bank.uz: " + r.status);
  const html = await r.text();

  // Yondashuv: avval RAQAM JUFTLARINI topamiz (oluv/sotuv), keyin
  // ulardan OLDINGI teg ichidagi matndan bank nomini olamiz.
  // Sabab: sayt tuzilishi (div/td/span) o'zgarsa ham raqam juftligi
  // qoladi — nomi topilmasa ham kurs olinadi.
  const juft = /(1[0-9][\s\u00a0]?[0-9]{3}(?:[.,][0-9]{1,2})?)[^0-9]{1,80}?(1[0-9][\s\u00a0]?[0-9]{3}(?:[.,][0-9]{1,2})?)/g;
  const N = x => parseFloat(String(x).replace(/[\s\u00a0]/g, "").replace(",", "."));
  const nomOl = (oldMatn) => {
    const toza = oldMatn.replace(/<[^>]*>/g, "|").replace(/&[a-z]+;/gi, " ");
    const bolaklar = toza.split("|").map(x => x.trim())
      .filter(x => /[A-Za-z\u0410-\u044f]{3,}/.test(x));
    return (bolaklar[bolaklar.length - 1] || "").replace(/\s+/g, " ").slice(0, 40);
  };

  const out = [];
  let m, sanoq = 0;
  while ((m = juft.exec(html)) !== null && sanoq < 80) {
    const a = N(m[1]), b = N(m[2]);
    if (!a || !b) continue;
    const sell = Math.max(a, b), buy = Math.min(a, b);
    if (sell < 8000 || sell > 30000) continue;          // aql chegarasi
    if (Math.abs(sell - buy) > sell * 0.15) continue;   // juft emas, tasodif
    const nom = nomOl(html.slice(Math.max(0, m.index - 150), m.index));
    if (/markaziy|central|cbu/i.test(nom)) continue;    // MB alohida olinadi
    out.push({ bank: nom || "Bank", sell, buy });
    sanoq++;
  }
  if (!out.length) throw new Error("bank.uz: jadval o'qilmadi");
  return out;
}

export default async function handler(req, res) {
  const mode  = String(req.query?.mode || "");
  const debug = String(req.query?.debug || "") === "1";

  // ── Standart: Markaziy Bank (eski xatti-harakat — o'zgarmagan) ──
  if (mode !== "banks" && !debug) {
    try {
      const { rate, date } = await cbuOl();
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
      return res.status(200).json({ ok: true, rate, date,
                                    source: "CBU (Markaziy Bank)" });
    } catch (e) {
      console.error("rate.js CBU xato:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── Tijorat banklari ────────────────────────────────────────────
  const tashxis = [];
  let banklar = [];
  for (const [nom, fn] of [["nbu", nbuOl], ["bank.uz", bankUzOl]]) {
    try {
      const r = await fn();
      banklar = banklar.concat(r);
      tashxis.push({ manba: nom, ok: true, soni: r.length,
                     namuna: r.slice(0, 3) });
    } catch (e) {
      tashxis.push({ manba: nom, ok: false, xato: e.message });
    }
  }

  // Bir bank ikki manbadan kelsa — bittasini qoldiramiz (eng yuqorisi)
  const xarita = new Map();
  banklar.forEach(b => {
    const k = b.bank.toLowerCase().replace(/[^a-zа-я0-9]/gi, "").slice(0, 20);
    if (!xarita.has(k) || xarita.get(k).sell < b.sell) xarita.set(k, b);
  });
  banklar = [...xarita.values()].sort((a, b) => b.sell - a.sell);

  let cb = null;
  try { cb = (await cbuOl()).rate; } catch (e) {}

  if (debug)
    return res.status(200).json({ ok: true, cb, banklar, tashxis });

  if (!banklar.length) {
    // Hech bir manba ishlamadi — MB kursi bilan qaytamiz (kurs yo'qolmaydi)
    if (!cb) return res.status(500).json({ ok: false, error: "Manbalar ishlamadi" });
    return res.status(200).json({ ok: true, rate: cb, cb, banklar: [],
      fallback: true, source: "CBU (Markaziy Bank) — tijorat manbalari ishlamadi" });
  }

  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate");
  return res.status(200).json({ ok: true,
    rate: banklar[0].sell, bank: banklar[0].bank,
    cb, banklar, source: "Tijorat banklari (eng yuqori sotuv)" });
}
