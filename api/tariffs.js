// ═══════════════════════════════════════════════════════════
// TARIFLAR API (2026-07-26)
// Landing sahifa (merx.uz) tarif narxlarini shu nuqtadan oladi.
// Supabase kaliti serverda qoladi — saytda oshkor bo'lmaydi.
// SuperAdmin narxni o'zgartirsa, sayt ham darhol o'zgaradi.
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // Landing boshqa domenda (merx.uz) — CORS ruxsati
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, max-age=300"); // 5 daqiqa kesh

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ ok: false, error: "Faqat GET" });

  const SB_URL = process.env.SUPABASE_URL || process.env.MERX_SUPABASE_URL;
  const KEY    = process.env.SUPABASE_SERVICE_KEY
              || process.env.MERX_SUPABASE_SERVICE_KEY
              || process.env.SUPABASE_ANON_KEY;

  if (!SB_URL || !KEY)
    return res.status(500).json({ ok: false, error: "Server sozlanmagan" });

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/tariffs?active=eq.true&select=tier,title,price_uzs,period,features,sort_order&order=sort_order.asc`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
    );
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ ok: false, error: "Tariflar o'qilmadi", detail: t });
    }
    const rows = await r.json();
    return res.status(200).json({ ok: true, tariffs: rows || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
