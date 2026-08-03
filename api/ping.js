// ══════════════════════════════════════════════════════════════
// api/ping.js — SUPABASE'NI UYG'OQ TUTISH (2026-08-03)
// ══════════════════════════════════════════════════════════════
// MUAMMO: Supabase bepul rejada loyiha BIR HAFTA so'rovsiz qolsa
// to'xtatiladi. Vercel'ni tekshiradigan xizmat bu masalani HAL
// QILMAYDI — sayt ochilishi bazaga umuman tegmaydi. Ular ikki
// alohida xizmat.
//
// Bu nuqta AYNAN BAZAGA yengil so'rov yuboradi (bitta qator).
// Shu sabab uni chaqirish Supabase uchun "faollik" hisoblanadi.
//
// Ishlatish:
//   1) Vercel cron — kuniga bir marta (vercel.json da)
//   2) Yoki tashqi xizmat: https://app.merx.uz/api/ping
//
// Javob holatni ham ko'rsatadi — brauzerda ochib tekshirsa bo'ladi.
// FAQAT O'QIYDI: hech narsa yozilmaydi, o'chirilmaydi.

export default async function handler(req, res) {
  const t0 = Date.now();
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SB_URL || !SB_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Muhit o'zgaruvchilari yo'q: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
    });
  }

  try {
    // Eng yengil so'rov: bitta do'kon qatori.
    // `head=true` bo'lmagani muhim — haqiqiy o'qish bo'lsin.
    const r = await fetch(`${SB_URL}/rest/v1/shops?select=id&limit=1`, {
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        // Jami sonni ham olamiz — javobda foydali bo'ladi
        Prefer: "count=exact"
      }
    });

    if (!r.ok) {
      return res.status(502).json({
        ok: false, db: "xato", status: r.status,
        error: (await r.text()).slice(0, 200),
        ms: Date.now() - t0
      });
    }

    // Content-Range: "0-0/3" ko'rinishida — oxirgi son jami
    const range = r.headers.get("content-range") || "";
    const jami  = parseInt(range.split("/")[1]) || null;

    return res.status(200).json({
      ok: true,
      db: "active",
      shops: jami,
      ms: Date.now() - t0,
      at: new Date().toISOString()
    });
  } catch (e) {
    return res.status(500).json({
      ok: false, db: "ulanmadi", error: e.message, ms: Date.now() - t0
    });
  }
}
