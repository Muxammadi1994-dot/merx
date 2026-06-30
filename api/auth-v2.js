// ════════════════════════════════════════════════════════════════
// MERX — api/auth-v2.js  |  YANGI, SINOV UCHUN
// ════════════════════════════════════════════════════════════════
//
// MUHIM: bu fayl hozircha HECH NARSAGA ULANMAGAN.
// index.html, auth.js yoki boshqa hech qaysi fayl bu endpoint'ni
// chaqirmaydi. Faqat alohida, qo'lda (masalan curl yoki Postman
// orqali) sinash uchun yaratilgan.
//
// Maqsad: Supabase'ning o'z login tizimi (Supabase Auth) orqali
// har bir do'kon uchun HAQIQIY, server tomonida tekshiriladigan
// hisob yaratish — hozirgi "umumiy kalit" muammosini hal qilish
// uchun zamin tayyorlash.
//
// KERAKLI YANGI ENV VARIABLE (Vercel'da qo'shish kerak):
//   SUPABASE_SERVICE_ROLE_KEY — Supabase Dashboard → Settings →
//   API → "service_role" kaliti (sir kalit — HECH QACHON brauzer
//   kodiga qo'yilmaydi, faqat shu yerda, serverda ishlatiladi).
//
//   Buni SUPABASE_KEY (hozirgi, anon kalit) bilan ALMASHTIRMANG —
//   ikkalasi alohida, ikkalasi ham kerak.
// ════════════════════════════════════════════════════════════════

const SB_URL         = process.env.SUPABASE_URL;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY       = process.env.SUPABASE_KEY; // hozirgi, mavjud anon kalit

// ── Xavfsiz, tasodifiy shop_id generatsiya qilish ────────────────
// Eski usul: "shop_" + Date.now() — taxmin qilish oson edi.
// Yangisi: kriptografik tasodifiy, 32 ta belgili qator.
function genSecureShopId() {
  const bytes = require("crypto").randomBytes(16);
  return "shop_" + bytes.toString("hex");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Faqat POST so'rovlar qabul qilinadi" });
  }
  if (!SB_URL || !SERVICE_KEY) {
    return res.status(500).json({
      ok: false,
      error: "SUPABASE_SERVICE_ROLE_KEY sozlanmagan. Vercel > Settings > Environment Variables ga qo'shing."
    });
  }

  const { action } = req.query;
  const body = req.body || {};

  try {
    // ── 1. Yangi do'kon hisobini yaratish (faqat sinov uchun) ──
    if (action === "signup_test") {
      const { email, password, shopName } = body;
      if (!email || !password || password.length < 6) {
        return res.status(400).json({ ok: false, error: "Email va kamida 6 belgili parol kerak" });
      }

      const shopId = genSecureShopId();

      const createRes = await fetch(`${SB_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: true, // sinov uchun — email tasdiqlashni o'tkazib yuboramiz
          user_metadata: { shop_id: shopId, shop_name: shopName || "Test do'kon" },
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        return res.status(createRes.status).json({ ok: false, error: createData.msg || createData.message || "Hisob yaratilmadi" });
      }

      return res.status(200).json({
        ok: true,
        message: "✅ Sinov hisobi yaratildi (hozircha hech narsaga ulanmagan)",
        shopId,
        userId: createData.id,
        email,
      });
    }

    // ── 2. Login — sessiya (JWT) olish ──────────────────────────
    if (action === "login_test") {
      const { email, password } = body;
      if (!email || !password) {
        return res.status(400).json({ ok: false, error: "Email va parol kerak" });
      }

      const loginRes = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY || SERVICE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        return res.status(loginRes.status).json({ ok: false, error: loginData.error_description || loginData.msg || "Kirish muvaffaqiyatsiz" });
      }

      return res.status(200).json({
        ok: true,
        message: "✅ Kirish muvaffaqiyatli (sinov sessiyasi)",
        shopId: loginData.user?.user_metadata?.shop_id || null,
        accessToken: loginData.access_token,
        expiresIn: loginData.expires_in,
      });
    }

    // ── 3. Sinov hisobini o'chirish (tozalash uchun) ────────────
    if (action === "delete_test_user") {
      const { userId } = body;
      if (!userId) return res.status(400).json({ ok: false, error: "userId kerak" });

      const delRes = await fetch(`${SB_URL}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });

      if (!delRes.ok) {
        const errData = await delRes.json().catch(() => ({}));
        return res.status(delRes.status).json({ ok: false, error: errData.msg || "O'chirish muvaffaqiyatsiz" });
      }

      return res.status(200).json({ ok: true, message: "✅ Sinov hisobi o'chirildi" });
    }

    return res.status(400).json({ ok: false, error: "Noma'lum action. Mavjud: signup_test, login_test, delete_test_user" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server xatosi: " + e.message });
  }
};
