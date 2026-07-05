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

  // ── SuperAdmin himoyasi ──────────────────────────────────────
  // SA parol serverda tekshiriladi. Vercel ENV'da MERX_SA_PASS
  // o'rnatilsa — o'sha, bo'lmasa vaqtincha "merx2024".
  // TAVSIYA: Vercel > Settings > Environment Variables ga kuchli
  // MERX_SA_PASS qo'shing — shunda parol kodda umuman turmaydi.
  const SA_PASS = process.env.MERX_SA_PASS || "merx2024";
  const SA_ACTIONS = ["sa_login","create_shop","update_shop",
    "update_shop_password","get_shops","link_existing_shop",
    "delete_test_user","signup_test"];
  if (SA_ACTIONS.includes(action)) {
    const given = req.headers["x-sa-pass"] || body.saPass || "";
    if (given !== SA_PASS) {
      return res.status(401).json({ ok: false, error: "SuperAdmin paroli noto'g'ri" });
    }
  }
  // SA parolni tekshirish (SA panelga kirish uchun)
  if (action === "sa_login") {
    return res.status(200).json({ ok: true });
  }

  // Ochiq: klient ulanish sozlamalari. Anon kalit ochiq bo'lishi normal —
  // himoya RLS zimmasida. Busiz toza qurilma bulutga ulana olmasdi.
  if (action === "client_config") {
    return res.status(200).json({
      ok: true,
      url: process.env.SUPABASE_URL || "",
      key: process.env.SUPABASE_KEY || ""
    });
  }

  try {
    // ── 1b. MAVJUD do'konni yangi tizimga bog'lash ─────────────
    // Farqi: shopId TASODIFIY yaratilmaydi, balki sizning haqiqiy,
    // hozirgi ma'lumotlaringiz bog'langan shop_id'ingiz qo'lda beriladi.
    // Shu orqali eski ma'lumotlar yangi login bilan "uzilmaydi".
    if (action === "link_existing_shop") {
      const { email, password, shopId, shopName } = body;
      if (!email || !password || password.length < 6) {
        return res.status(400).json({ ok: false, error: "Email va kamida 6 belgili parol kerak" });
      }
      if (!shopId || !shopId.startsWith("shop_")) {
        return res.status(400).json({ ok: false, error: "Haqiqiy shopId kerak (masalan shop_1782763300535)" });
      }

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
          email_confirm: true,
          user_metadata: { shop_id: shopId, shop_name: shopName || "MERX Do'koni" },
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        return res.status(createRes.status).json({ ok: false, error: createData.msg || createData.message || "Hisob yaratilmadi" });
      }

      return res.status(200).json({
        ok: true,
        message: "✅ Mavjud do'kon yangi tizimga bog'landi (hozircha hech narsaga ulanmagan)",
        shopId,
        userId: createData.id,
        email,
      });
    }

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

    // ── 4. Yangi do'kon uchun Supabase Auth hisobi yaratish ────────
    if (action === "create_shop") {
      const { email, password, shopId, shopName } = body;
      if (!email || !password || password.length < 4) {
        return res.status(400).json({ ok: false, error: "Email va kamida 4 belgili parol kerak" });
      }
      if (!shopId) {
        return res.status(400).json({ ok: false, error: "shopId kerak" });
      }

      // Avval bu email bilan hisob borligini tekshiramiz (to'g'ri endpoint)
      const checkRes = await fetch(
        `${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const checkData = await checkRes.json();
      const existingUser = (checkData?.users || []).find(
        u => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (existingUser) {
        // Hisob bor — shop_id VA parolni yangilaymiz
        await fetch(`${SB_URL}/auth/v1/admin/users/${existingUser.id}`, {
          method: "PUT",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            password,
            user_metadata: { shop_id: shopId, shop_name: shopName || "MERX Do'koni" }
          })
        });

        // shops va settings ni ham yangilaymiz
        const shopRow = {
          id: shopId,
          name: shopName || "MERX Do'koni",
          owner_email: email,
          plan: body.plan || "trial",
          active: true,
          trial_ends: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,10)
        };
        await fetch(`${SB_URL}/rest/v1/shops`, {
          method: "POST",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
          },
          body: JSON.stringify(shopRow)
        }).catch(e => console.error("shops yangilash xato:", e.message));

        await fetch(`${SB_URL}/rest/v1/settings`, {
          method: "POST",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
          },
          body: JSON.stringify({
            shop_id: shopId,
            shop_name: shopName || "MERX Do'koni",
            rate: 12800,
            price_currency: "uzs"
          })
        }).catch(e => console.error("settings yangilash xato:", e.message));

        return res.status(200).json({
          ok: true,
          message: "✅ Mavjud hisob yangilandi (parol + shop_id)",
          shopId, userId: existingUser.id, email, existing: true
        });
      }

      // Yangi hisob yaratish
      const createRes = await fetch(`${SB_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { shop_id: shopId, shop_name: shopName || "MERX Do'koni" }
        })
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        return res.status(createRes.status).json({
          ok: false,
          error: createData.msg || createData.message || "Hisob yaratilmadi"
        });
      }

      // shops va settings jadvallariga yozamiz (service_role bilan)
      const shopRow = {
        id: shopId,
        name: shopName || "MERX Do'koni",
        owner_email: email,
        plan: body.plan || "trial",
        active: true,
        trial_ends: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,10)
      };
      await fetch(`${SB_URL}/rest/v1/shops`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify(shopRow)
      }).catch(e => console.error("shops yozish xato:", e.message));

      await fetch(`${SB_URL}/rest/v1/settings`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          shop_id: shopId,
          shop_name: shopName || "MERX Do'koni",
          rate: 12800,
          price_currency: "uzs"
        })
      }).catch(e => console.error("settings yozish xato:", e.message));

      return res.status(200).json({
        ok: true,
        message: "✅ Yangi do'kon uchun Supabase Auth hisobi yaratildi",
        shopId, userId: createData.id, email, existing: false
      });
    }

    // ── 5. Do'kon paroli o'zgartirish ──────────────────────────────
    if (action === "update_shop_password") {
      const { email, newPassword } = body;
      if (!email || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ ok: false, error: "Email va yangi parol kerak" });
      }

      // Barcha foydalanuvchilar orasidan email bo'yicha topamiz
      const findRes = await fetch(
        `${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const findData = await findRes.json();
      const foundUser = (findData?.users || []).find(
        u => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (!foundUser) {
        return res.status(404).json({ ok: false, error: `"${email}" emailli hisob topilmadi` });
      }

      const updRes = await fetch(`${SB_URL}/auth/v1/admin/users/${foundUser.id}`, {
        method: "PUT",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: newPassword })
      });

      if (!updRes.ok) {
        const updData = await updRes.json().catch(() => ({}));
        return res.status(updRes.status).json({ ok: false, error: updData.msg || "Parol o'zgartirilmadi" });
      }

      return res.status(200).json({ ok: true, message: "✅ Parol muvaffaqiyatli o'zgartirildi", email });
    }

    // ── 6. Do'kon ma'lumotlarini yangilash ─────────────────────────
    if (action === "update_shop") {
      const { shopId, data } = body;
      if (!shopId || !data) {
        return res.status(400).json({ ok: false, error: "shopId va data kerak" });
      }

      const updRes = await fetch(
        `${SB_URL}/rest/v1/shops?id=eq.${encodeURIComponent(shopId)}`,
        {
          method: "PATCH",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(data)
        }
      );

      if (!updRes.ok) {
        const errData = await updRes.json().catch(() => ({}));
        return res.status(updRes.status).json({ ok: false, error: errData.message || "Yangilash muvaffaqiyatsiz" });
      }

      return res.status(200).json({ ok: true, message: "✅ Do'kon yangilandi", shopId });
    }

    // ── 7. Barcha do'konlar ro'yxatini olish (SuperAdmin uchun) ────
    if (action === "get_shops") {
      const shopsRes = await fetch(
        `${SB_URL}/rest/v1/shops?select=id,name,owner_email,plan,active,blocked,trial_ends,created_at&order=created_at.desc`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`
          }
        }
      );
      const shopsData = await shopsRes.json();
      if (!shopsRes.ok) {
        return res.status(shopsRes.status).json({ ok: false, error: "Do'konlar yuklanmadi" });
      }
      return res.status(200).json({ ok: true, shops: shopsData });
    }

    return res.status(400).json({ ok: false, error: "Noma'lum action. Mavjud: signup_test, login_test, create_shop, update_shop_password, delete_test_user" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server xatosi: " + e.message });
  }
};
