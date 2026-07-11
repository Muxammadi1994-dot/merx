// ════════════════════════════════════════════════════════════════
// MERX — Markaziy Bank (CBU) kursi  |  api/rate.js  |  2026-07-09
// O'zbekiston Markaziy banki rasmiy ochiq API'sidan USD/UZS kursini
// oladi (server orqali — brauzerdan to'g'ridan-to'g'ri CORS bloklanadi).
// ════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  try {
    const r = await fetch("https://cbu.uz/en/arkhiv-kursov-valyut/json/USD/", {
      headers: { "User-Agent": "Mozilla/5.0 (MERX savdo tizimi)" },
    });
    if (!r.ok) throw new Error("CBU javob bermadi: " + r.status);
    const data = await r.json();
    // 2026-07-10: oxirgi element o'rniga ANIQ USD qatori qidiriladi
    // (CBU tartibni o'zgartirsa ham buzilmaydi); topilmasa — birinchisi.
    const row = Array.isArray(data)
      ? (data.find(x => x && (x.Ccy === "USD" || x.CcyNm_EN === "US Dollar")) || data[0])
      : data;
    const rate = parseFloat(row?.Rate);
    if (!rate || rate <= 0) throw new Error("CBU kursi noto'g'ri qaytdi");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate"); // 1 soatlik keshlash — CBU'ga ortiqcha yuklama bermaslik
    return res.status(200).json({ ok: true, rate, date: row?.Date || null, source: "CBU (Markaziy Bank)" });
  } catch (e) {
    console.error("rate.js xato:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
