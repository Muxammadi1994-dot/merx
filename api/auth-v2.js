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
  // 2026-07-10: zaxira parol OLIB TASHLANDI (repo public — ochiq
  // koddagi parol xavfsizlik teshigi edi). SA parol endi FAQAT
  // Vercel ENV'dagi MERX_SA_PASS'dan olinadi. ENV o'rnatilmagan
  // bo'lsa — SA amallari BUTUNLAY yopiq (xavfsiz standart).
  const SA_PASS = process.env.MERX_SA_PASS || "";
  const SA_ACTIONS = ["sa_login","create_shop","update_shop",
    "update_shop_password","get_shops","link_existing_shop",
    "delete_test_user","signup_test",
    // 2026-07-26: SuperAdmin amallari SERVER orqali (SERVICE_KEY bilan).
    // Brauzerdagi ochiq kalit boshqa do'kon yozuvini o'zgartira olmaydi
    // (RLS to'sadi) — shuning uchun o'chirish va valyuta rejimi
    // bulutga umuman yetmasdi.
    "delete_shop","set_currency_mode",
    // 2026-07-26: landing tarif narxlarini boshqarish
    "get_tariffs","update_tariff"];
  if (SA_ACTIONS.includes(action)) {
    // MUHIM: SA_PASS bo'sh bo'lsa HAM rad etiladi — aks holda bo'sh
    // parol bilan kirish mumkin bo'lib qolardi.
    if (!SA_PASS) {
      return res.status(500).json({ ok: false, error: "Server sozlanmagan: Vercel ENV'da MERX_SA_PASS o'rnating" });
    }
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
        refreshToken: loginData.refresh_token, // v175: avto-yangilash uchun
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
      const { email, password, shopId, shopName, shopType } = body;
      // 2026-07-26: tarif, narx, valyuta rejimi
      const _tier  = body.tier === "start" ? "start" : "pro";
      const _price = parseInt(body.priceUzs) || null;
      const _cmode = ["uzs","usd","multi"].includes(body.currencyMode) ? body.currencyMode : "uzs";
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
          shop_type: shopType || "ikki",
          active: true,
          trial_ends: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,10)
        ,
          tier: _tier,
          price_uzs: _price};
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
            // 2026-07-26: valyuta rejimi va tarif SuperAdmin belgilaganidek
            price_currency: (_cmode === "usd") ? "usd" : "uzs",
            currency_mode: _cmode,
            tier: _tier,
            shop_type: shopType || "ikki"
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
          shop_type: shopType || "ikki",
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
          price_currency: "uzs",
          shop_type: shopType || "ikki"
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

      // 2026-07-26: TARIF settings jadvaliga ham yoziladi — do'kon
      // ilovasi shu jadvaldan o'qiydi (cheklovni qo'llash uchun)
      if (data.tier) {
        try {
          await fetch(`${SB_URL}/rest/v1/settings?on_conflict=shop_id`, {
            method: "POST",
            headers: {
              apikey: SERVICE_KEY,
              Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates"
            },
            body: JSON.stringify([{ shop_id: shopId, tier: data.tier }])
          });
        } catch(e) { /* settings yozilmasa shops baribir yangilandi */ }
      }

      return res.status(200).json({ ok: true, message: "✅ Do'kon yangilandi", shopId });
    }

    // ── 7. Barcha do'konlar ro'yxatini olish (SuperAdmin uchun) ────
    // ═══ DO'KONNI O'CHIRISH (2026-07-26) ═══
    // SERVICE_KEY bilan — brauzerdan RLS to'sardi
    if (action === "delete_shop") {
      const shopId = body.shopId || body.shop_id;
      if (!shopId) return res.status(400).json({ ok: false, error: "shopId majburiy" });
      const r = await fetch(`${SB_URL}/rest/v1/shops?id=eq.${encodeURIComponent(shopId)}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({ active: false })
      });
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ ok: false, error: "O'chirilmadi", detail: d });
      return res.status(200).json({ ok: true, shop: d?.[0] || null });
    }

    // ═══ VALYUTA REJIMINI BELGILASH (2026-07-26) ═══
    if (action === "set_currency_mode") {
      const shopId = body.shopId || body.shop_id;
      const mode   = body.mode;
      if (!shopId || !["uzs","usd","multi"].includes(mode))
        return res.status(400).json({ ok: false, error: "shopId va mode majburiy" });

      const payload = { shop_id: shopId, currency_mode: mode };
      if (mode === "uzs" || mode === "usd") payload.price_currency = mode;

      const r = await fetch(`${SB_URL}/rest/v1/settings?on_conflict=shop_id`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify([payload])
      });
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ ok: false, error: "Yozilmadi", detail: d });
      return res.status(200).json({ ok: true, settings: d?.[0] || null });
    }

    // ═══ TARIF NARXLARI (2026-07-26) — landing sahifa uchun ═══
    if (action === "get_tariffs") {
      const r = await fetch(
        `${SB_URL}/rest/v1/tariffs?select=tier,title,price_uzs,period,features,sort_order,active&order=sort_order.asc`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ ok: false, error: "Tariflar o'qilmadi", detail: d });
      return res.status(200).json({ ok: true, tariffs: d || [] });
    }

    if (action === "update_tariff") {
      const { tier } = body;
      if (!tier) return res.status(400).json({ ok: false, error: "tier majburiy" });
      const payload = { tier, updated_at: new Date().toISOString() };
      if (body.title     != null) payload.title     = body.title;
      if (body.price_uzs != null) payload.price_uzs = parseInt(body.price_uzs) || 0;
      if (body.period    != null) payload.period    = body.period;
      if (body.features  != null) payload.features  = body.features;
      if (body.active    != null) payload.active    = !!body.active;

      const r = await fetch(`${SB_URL}/rest/v1/tariffs?on_conflict=tier`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify([payload])
      });
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ ok: false, error: "Saqlanmadi", detail: d });
      return res.status(200).json({ ok: true, tariff: d?.[0] || null });
    }

    if (action === "get_shops") {
      const shopsRes = await fetch(
        `${SB_URL}/rest/v1/shops?active=not.is.false&select=id,name,owner_email,plan,active,blocked,trial_ends,created_at,shop_type,tier,price_uzs&order=created_at.desc`,
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

      // 2026-07-26: valyuta rejimi SETTINGS jadvalida — uni ham o'qib
      // do'kon yozuviga qo'shamiz. Avval o'qilmagani uchun SuperAdmin
      // tahrirlash oynasi har safar "ko'p valyutali" ni ko'rsatardi.
      try {
        const setRes = await fetch(
          `${SB_URL}/rest/v1/settings?select=shop_id,currency_mode,price_currency,tier`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        );
        if (setRes.ok) {
          const sets = await setRes.json();
          const byShop = {};
          (sets || []).forEach(r => { byShop[r.shop_id] = r; });
          (shopsData || []).forEach(sh => {
            const st = byShop[sh.id];
            sh.currency_mode  = st?.currency_mode  || "multi";
            sh.price_currency = st?.price_currency || "uzs";
          });
        }
      } catch(e) { /* settings o'qilmasa do'konlar baribir qaytadi */ }

      return res.status(200).json({ ok: true, shops: shopsData });
    }

    // ── 9. DO'KON HOLATI — OCHIQ action (2026-07-30) ────────────
    // Do'kon ilovasi o'zining obuna holatini shu yerdan biladi.
    // AVVAL: bloklash/muddat FAQAT SuperAdmin panelida ko'rinardi,
    // do'kon egasi esa hech qanday cheklovsiz ishlashda davom etardi.
    //
    // Hukmni SERVER chiqaradi — qurilma soati orqaga surilsa ham
    // muddat "cho'zilmaydi".
    // SA paroli KERAK EMAS (SA_ACTIONS ro'yxatiga qo'shilmagan):
    // faqat holat qaytadi, sir ma'lumot yo'q.
    if (action === "shop_status") {
      const shopId = body.shopId || body.shop_id;
      if (!shopId) return res.status(400).json({ ok: false, error: "shopId majburiy" });

      const stRes = await fetch(
        `${SB_URL}/rest/v1/shops?id=eq.${encodeURIComponent(shopId)}` +
        `&select=name,plan,active,blocked,trial_ends,tier&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );

      // Bulut javob bermasa — CHEKLAMAYMIZ. "Ochiq qolish" xatosi
      // "noto'g'ri qulflash" xatosidan ancha yengil.
      if (!stRes.ok) {
        return res.status(200).json({ ok: true, status: "unknown", reason: "shops o'qilmadi" });
      }
      const stRows = await stRes.json();
      const sh = (Array.isArray(stRows) && stRows[0]) || null;
      if (!sh) return res.status(200).json({ ok: true, status: "unknown", reason: "yozuv yo'q" });

      let status = "ok";
      let daysLeft = null;

      if (sh.blocked === true) {
        status = "blocked";
      } else if (sh.active === false) {
        status = "blocked";          // o'chirilgan do'kon
      } else if (sh.plan !== "lifetime" && sh.trial_ends) {
        // trial_ends turli ko'rinishda kelishi mumkin: "2026-08-25"
        // yoki to'liq ISO. Ikkalasi ham ishlashi uchun sanani kesamiz.
        const day = String(sh.trial_ends).slice(0, 10);
        const end = new Date(day + "T23:59:59Z").getTime();  // kun oxirigacha amal qiladi
        if (!isNaN(end)) {
          const now = Date.now();
          if (now > end) status = "expired";
          else daysLeft = Math.ceil((end - now) / 86400000);
        }
      }

      return res.status(200).json({
        ok: true,
        status,                       // ok | blocked | expired | unknown
        days_left:  daysLeft,
        name:       sh.name  || null,
        plan:       sh.plan  || null,
        expires_at: sh.trial_ends || null,
        tier:       sh.tier  || null
      });
    }

    return res.status(400).json({ ok: false, error: "Noma'lum action. Mavjud: signup_test, login_test, create_shop, update_shop_password, delete_test_user, shop_status" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server xatosi: " + e.message });
  }
};
