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

// ⚠️ 2026-08-06: SANA TOSHKENT VAQTIDAN (kontekst §4.6).
// Server UTC da ishlaydi. Avval `new Date().toISOString()` ishlatilardi —
// Toshkentda soat 00:00-05:00 oraligida KECHAGI sana chiqardi va
// "bugungi sotuv", "bu oy tushum" xato hisoblanardi. Ulgurji do'konlar
// ertalab 3-4 da ochiladi, ya'ni bu aynan ish vaqtiga to'g'ri keladi.
// Ilova (utils.js) va bot (api/bot.js) da bu allaqachon tuzatilgan edi.
const TZ_OFFSET_MIN  = 5 * 60;
const tashkentNow    = () => new Date(Date.now() + TZ_OFFSET_MIN * 60000);

// ⚠️ 2026-08-06: 1000 QATOR CHEGARASI.
// Supabase bitta so'rovga ko'pi bilan 1000 qator qaytaradi va
// `limit=20000` yozilsa ham SHU chegara ishlaydi — xato ham bermaydi,
// jimgina kam ma'lumot beradi. Ilovada bu allaqachon hisobga olingan
// (cloud.js → _selectAll, kontekst §4.4), serverda esa YO'Q edi:
// do'kon 1000 sotuvga yetganda statistika sekin-asta yolg'on
// ko'rsatib boshlardi. Quyidagi ikki yordamchi shuni yopadi.

const SB_PAGE     = 1000;   // bir so'rovdagi eng ko'p qator
const SB_MAX_PAGE = 20;     // xavfsizlik: ko'pi bilan 20 000 yozuv

// Sahifalab to'liq o'qish. Chegaraga urilsa capped=true qaytadi —
// raqam JIMGINA kesilmasin, panelda ogohlantirish chiqsin.
async function sbFetchAll(pathWithQuery, H) {
  const out = [];
  let capped = false;
  for (let page = 0; page < SB_MAX_PAGE; page++) {
    const sep = pathWithQuery.includes("?") ? "&" : "?";
    const url = `${SB_URL}/rest/v1/${pathWithQuery}${sep}limit=${SB_PAGE}&offset=${page * SB_PAGE}`;
    const r = await fetch(url, { headers: H });
    if (!r.ok) break;
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < SB_PAGE) return { rows: out, capped };
    if (page === SB_MAX_PAGE - 1) capped = true;
  }
  return { rows: out, capped };
}

// Faqat SANASH — qatorlar umuman tortilmaydi, baza aniq sonni
// `content-range` sarlavhasida qaytaradi. Tez va chegarasiz.
async function sbCount(pathWithQuery, H) {
  const sep = pathWithQuery.includes("?") ? "&" : "?";
  const r = await fetch(`${SB_URL}/rest/v1/${pathWithQuery}${sep}select=id&limit=1`, {
    headers: { ...H, Prefer: "count=exact" }
  });
  if (!r.ok) return 0;
  const cr = r.headers.get("content-range") || "";   // masalan "0-0/1061"
  const n  = parseInt(cr.split("/")[1], 10);
  return isNaN(n) ? 0 : n;
}
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
    "get_tariffs","update_tariff",
    // 2026-07-30: zaxira/tiklash — brauzerdagi anon kalit BOSHQA
    // do'kon yozuviga tega olmaydi (RLS), xato jimgina yutilardi
    "list_backups","get_backup","restore_write",
    // 2026-08-03: server hajmi — faqat SuperAdmin ko'radi
    "server_stats",
    // 2026-08-03: SuperAdmin moliyasi — shaxsiy hisob
    "sa_finance",
    // 2026-08-03: parolni o'zgartirish — joriy parol bilan
    "change_sa_pass"];
  if (SA_ACTIONS.includes(action)) {
    // MUHIM: SA_PASS bo'sh bo'lsa HAM rad etiladi — aks holda bo'sh
    // parol bilan kirish mumkin bo'lib qolardi.
    const given = req.headers["x-sa-pass"] || body.saPass || "";

    // ⚠️ 2026-08-03: IKKI YO'L — bazadagi parol yoki ENV.
    // Avval parol FAQAT `MERX_SA_PASS` da edi: uni o'zgartirish
    // uchun Vercel'ga kirish shart bo'lardi. Hisobga kira
    // olmasangiz parolni ham o'zgartira olmasdingiz.
    // Endi panel orqali o'zgartiriladi, ENV esa ZAXIRA bo'lib
    // qoladi — ikkalasi ham ishlaydi.
    let dbHash = "";
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/sa_settings?id=eq.pass_hash&select=value&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
      if (r.ok) { const j = await r.json(); dbHash = j?.[0]?.value || ""; }
    } catch (e) { console.warn("sa_settings o'qilmadi:", e.message); }

    const sha = (t) => require("crypto").createHash("sha256").update(t).digest("hex");
    const bazaOk = dbHash && sha(given) === dbHash;
    const envOk  = SA_PASS && given === SA_PASS;

    if (!dbHash && !SA_PASS) {
      return res.status(500).json({ ok: false,
        error: "Server sozlanmagan: Vercel ENV'da MERX_SA_PASS o'rnating" });
    }
    if (!bazaOk && !envOk) {
      return res.status(401).json({ ok: false, error: "SuperAdmin paroli noto'g'ri" });
    }
  }

  // ── PAROLNI O'ZGARTIRISH (2026-08-03) ─────────────────────────
  // Yuqoridagi darvozadan o'tgan bo'lsa — joriy parol to'g'ri.
  if (action === "change_sa_pass") {
    let body2;
    try {
      body2 = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    } catch { return res.status(400).json({ ok: false, error: "invalid_json" }); }

    const yangi = (body2.newPass || "").trim();
    if (yangi.length < 6) {
      return res.status(400).json({ ok: false, error: "Parol kamida 6 belgi bo'lsin" });
    }
    try {
      const hash = require("crypto").createHash("sha256").update(yangi).digest("hex");
      const r = await fetch(`${SB_URL}/rest/v1/sa_settings?on_conflict=id`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify([{ id: "pass_hash", value: hash,
                                updated_at: new Date().toISOString() }])
      });
      if (!r.ok) return res.status(500).json({ ok: false, error: await r.text() });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }
  // SA parolni tekshirish (SA panelga kirish uchun)
  if (action === "sa_login") {
    return res.status(200).json({ ok: true });
  }

  // ══════════════════════════════════════════════════════════
  // EGASI O'Z KIRISH MA'LUMOTINI O'ZGARTIRADI (2026-08-03)
  // ══════════════════════════════════════════════════════════
  // ⚠️ MUAMMO: `saveAdminCreds()` (egasi.js) faqat LOKAL bazaga
  // yozardi — Supabase Auth hisobiga UMUMAN tegmasdi. Natijada
  // egasi o'z loginini yoki parolini o'zgartirsa, keyingi kirishda
  // `400 Invalid login credentials` chiqib, ilova `anon` yo'liga
  // tushardi. Ustiga parol XESHSIZ saqlanardi.
  //
  // XAVFSIZLIK: SuperAdmin paroli talab qilinmaydi (egasi uni
  // bilmaydi), lekin JORIY PAROL majburiy — u serverda haqiqiy
  // kirish bilan tekshiriladi. Ya'ni parolni bilmagan odam
  // o'zgartira olmaydi.
  if (action === "owner_update_creds") {
    let body2;
    try {
      body2 = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    } catch { return res.status(400).json({ ok: false, error: "invalid_json" }); }

    const curEmail = (body2.currentEmail || "").trim().toLowerCase();
    const curPass  = body2.currentPassword || "";
    const newEmail = (body2.newEmail || "").trim().toLowerCase();
    const newPass  = body2.newPassword || "";

    if (!curEmail || !curPass) {
      return res.status(400).json({ ok: false, error: "Joriy email va parol kerak" });
    }
    if (!newEmail && !newPass) {
      return res.status(400).json({ ok: false, error: "O'zgartirish uchun yangi qiymat kerak" });
    }
    if (newPass && newPass.length < 6) {
      return res.status(400).json({ ok: false, error: "Yangi parol kamida 6 belgi bo'lsin" });
    }

    try {
      // ── 1) JORIY PAROLNI TEKSHIRAMIZ ──
      // Haqiqiy kirish qilib ko'ramiz. Muvaffaqiyatsiz bo'lsa —
      // o'zgartirishga huquq yo'q.
      const ANON = process.env.SUPABASE_KEY || "";
      const lr = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email: curEmail, password: curPass })
      });
      if (!lr.ok) {
        return res.status(401).json({ ok: false, error: "Joriy parol noto'g'ri" });
      }
      const sess = await lr.json();
      const uid  = sess?.user?.id;
      if (!uid) return res.status(500).json({ ok: false, error: "Hisob aniqlanmadi" });

      // ── 2) YANGI EMAIL band emasligini tekshiramiz ──
      if (newEmail && newEmail !== curEmail) {
        const fr = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
        const fd = fr.ok ? await fr.json() : {};
        const band = (fd?.users || []).find(
          u => u.email?.toLowerCase() === newEmail && u.id !== uid);
        if (band) {
          return res.status(409).json({ ok: false,
            error: `"${newEmail}" allaqachon band — boshqa email tanlang` });
        }
      }

      // ── 3) AUTH HISOBINI YANGILAYMIZ ──
      const payload = {};
      if (newEmail && newEmail !== curEmail) {
        payload.email = newEmail;
        payload.email_confirm = true;
      }
      if (newPass) payload.password = newPass;

      if (Object.keys(payload).length) {
        const ur = await fetch(`${SB_URL}/auth/v1/admin/users/${uid}`, {
          method: "PUT",
          headers: {
            apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        if (!ur.ok) {
          const ud = await ur.json().catch(() => ({}));
          return res.status(500).json({ ok: false,
            error: "Auth hisobi yangilanmadi: " + (ud.msg || ur.status) });
        }
      }

      // ── 4) `shops.owner_email` ni ham moslaymiz ──
      if (newEmail && newEmail !== curEmail && body2.shopId) {
        try {
          await fetch(
            `${SB_URL}/rest/v1/shops?id=eq.${encodeURIComponent(body2.shopId)}`, {
            method: "PATCH",
            headers: {
              apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json", Prefer: "return=minimal"
            },
            body: JSON.stringify({ owner_email: newEmail })
          });
        } catch (e) { console.warn("shops.owner_email:", e.message); }
      }

      return res.status(200).json({ ok: true,
        email: newEmail || curEmail,
        changed: { email: !!(newEmail && newEmail !== curEmail), password: !!newPass } });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
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

      // ══ 2026-07-30: DO'KON NOMI — barcha joyga tarqatiladi ══════
      // Muammo: SuperAdmin nomni o'zgartirsa FAQAT `shops.name` yozilardi.
      // Do'konning o'z ilovasi esa nomni `settings.shop_name` dan oladi
      // (cloud.js: db.shop = {...db.shop, name: sets.shop_name}), chekda
      // ham o'sha ishlatiladi. Natijada SuperAdmin panelida yangi nom,
      // do'konning o'zida va cheklarda esa ESKI nom qolardi.
      // Bot ham `bot_sessions` / `shop_owners` dagi nusxadan o'qiydi.
      // ⚠️ 2026-08-03: LOGIN (EMAIL) O'ZGARSA — AUTH HISOBI HAM.
      // Avval `update_shop` faqat `shops.owner_email` ni yangilardi,
      // Supabase Auth hisobi esa ESKI email bilan qolardi. Natijada
      // egasi yangi login bilan kira olmasdi:
      //     login_test → 400 Invalid login credentials
      // Ilova `anon` yo'liga tushib ishlardi, lekin token yo'q edi.
      //
      // Xato bo'lsa do'kon yangilanishi TO'XTAMAYDI — faqat
      // ogohlantirish yoziladi va javobda bildiriladi.
      let _authWarn = null;
      if (typeof data.owner_email === "string" && data.owner_email.trim()) {
        const _yangiEmail = data.owner_email.trim().toLowerCase();
        try {
          // Do'konning HOZIRGI emailini olamiz — o'zgarganini bilish uchun
          const _cur = await fetch(
            `${SB_URL}/rest/v1/shops?id=eq.${encodeURIComponent(shopId)}&select=owner_email&limit=1`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
          const _curJson = _cur.ok ? await _cur.json() : [];
          const _eskiEmail = (_curJson?.[0]?.owner_email || "").toLowerCase();

          if (_eskiEmail && _eskiEmail !== _yangiEmail) {
            const _fr = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`,
              { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
            const _fd = _fr.ok ? await _fr.json() : {};
            const _user = (_fd?.users || []).find(
              u => u.email?.toLowerCase() === _eskiEmail);

            if (!_user) {
              _authWarn = `Eski email "${_eskiEmail}" bilan Auth hisobi topilmadi — ` +
                          `egasi yangi login bilan kira olmasligi mumkin`;
            } else {
              const _ur = await fetch(`${SB_URL}/auth/v1/admin/users/${_user.id}`, {
                method: "PUT",
                headers: {
                  apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ email: _yangiEmail, email_confirm: true })
              });
              if (!_ur.ok) {
                const _ud = await _ur.json().catch(() => ({}));
                _authWarn = "Auth hisobi yangilanmadi: " + (_ud.msg || _ur.status);
              }
            }
          }
        } catch (e) {
          _authWarn = "Auth hisobi tekshirilmadi: " + e.message;
        }
      }

      // ⚠️ 2026-08-03: EGASI ISMI — `settings` GA HAM YOZILADI.
      // Do'kon ilovasi `shops` jadvalini o'qimaydi, u `settings` dan
      // ishlaydi. Ism u yerga yozilmasa POS'da "Akmal (admin)" deb
      // ko'rsatib bo'lmasdi.
      // Bo'sh qiymat yuborilmaydi — mavjudini o'chirmasin.
      if (typeof data.owner_name === "string" && data.owner_name.trim()) {
        try {
          await fetch(`${SB_URL}/rest/v1/settings?on_conflict=shop_id`, {
            method: "POST",
            headers: {
              apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates"
            },
            body: JSON.stringify([{ shop_id: shopId, owner_name: data.owner_name.trim() }])
          });
        } catch (e) { console.warn("owner_name → settings:", e.message); }
      }

      if (typeof data.name === "string" && data.name.trim()) {
        const _nm = data.name.trim();
        const _H  = {
          apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json"
        };
        // 1) settings.shop_name — ilova va chek shu yerdan o'qiydi
        try {
          await fetch(`${SB_URL}/rest/v1/settings?on_conflict=shop_id`, {
            method: "POST",
            headers: { ..._H, Prefer: "resolution=merge-duplicates" },
            body: JSON.stringify([{ shop_id: shopId, shop_name: _nm }])
          });
        } catch(e) { console.warn("shop_name → settings:", e.message); }
        // 2) Botdagi nusxalar — eski nom ko'rinib qolmasin
        for (const _t of ["bot_sessions", "shop_owners"]) {
          try {
            await fetch(`${SB_URL}/rest/v1/${_t}?shop_id=eq.${encodeURIComponent(shopId)}`, {
              method: "PATCH",
              headers: { ..._H, Prefer: "return=minimal" },
              body: JSON.stringify({ shop_name: _nm })
            });
          } catch(e) { console.warn(`shop_name → ${_t}:`, e.message); }
        }
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

      return res.status(200).json({ ok: true,
        message: _authWarn ? "⚠️ Do'kon yangilandi, lekin: " + _authWarn
                           : "✅ Do'kon yangilandi",
        authWarn: _authWarn || null, shopId });
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
    // ══════════════════════════════════════════════════════════
    // XODIM KIRISHI (2026-08-02)
    // ══════════════════════════════════════════════════════════
    // Klient (`auth.js` → `_staffLoginCloud`) shu amalni chaqiradi,
    // lekin u SERVERDA UMUMAN YO'Q edi — so'rov "noma'lum amal"
    // deb rad etilardi va bulutdan qidirish hech qachon ishlamasdi.
    // Natijada xodim faqat O'ZI QO'SHILGAN qurilmada kira olardi:
    // egasi bir kompyuterda xodim yaratsa, kassada kirib bo'lmasdi.
    //
    // Telefon RAQAMGACHA keltirib solishtiriladi (+998, bo'shliq,
    // qavs — hammasi tashlanadi), 998 prefiksi hisobga olinadi.
    // Shu bilan eski (kodsiz) yozuvlar ham ishlaydi.
    if (action === "staff_login") {
      const phone = String(body.phone || "").trim();
      const pin   = String(body.pin   || "").trim();
      if (!phone || !pin)
        return res.status(400).json({ ok: false, error: "Telefon va PIN majburiy" });

      const phKey = (v) => {
        let d = String(v || "").replace(/\D/g, "");
        if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
        return d;
      };
      const key = phKey(phone);
      if (!key) return res.status(400).json({ ok: false, error: "Telefon noto'g'ri" });

      // ⚠️ 2026-08-05: PIN XESH BILAN TEKSHIRILADI.
      // Avval `?pin=eq.<ochiq PIN>` so'ralardi va PIN jadvalda
      // OCHIQ MATNDA turardi. `staff` da esa `anon_all_staff`
      // qoidasi bor — ya'ni anon kalitni bilgan har kim BARCHA
      // do'konning BARCHA xodimi PIN va telefonini o'qiy olardi,
      // keyin o'sha PIN bilan kira olardi.
      //
      // Endi: PIN xeshlanadi (`pin_hash`), so'rov xesh bo'yicha.
      // ⚠️ ESKI `pin` USTUNI HAM QABUL QILINADI — barcha xodim
      // bir marta kirib xeshi yozilgunicha ishlashda davom etadi.
      const _sha = (t) => require("crypto").createHash("sha256")
        .update("merx.pin." + t).digest("hex");
      const _pinHash = _sha(pin);

      const r = await fetch(
        `${SB_URL}/rest/v1/staff?select=*&or=(pin_hash.eq.${_pinHash},` +
        `pin.eq.${encodeURIComponent(pin)})`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const rows = await r.json();
      if (!r.ok) return res.status(500).json({ ok: false, error: "Xodim o'qilmadi" });

      const row = (rows || []).find(x => phKey(x.phone) === key);
      if (!row)
        return res.status(200).json({ ok: false, error: "Telefon yoki PIN noto'g'ri" });

      // ⚠️ 2026-08-05: XESHNI YOZIB QO'YAMIZ.
      // Xodim birinchi marta kirganda `pin_hash` to'ldiriladi.
      // Barcha xodim bir marta kirgach eski `pin` ustunini
      // o'chirish mumkin bo'ladi (§14 chala ishlar).
      // Xato bo'lsa kirish TO'XTAMAYDI — faqat log.
      if (!row.pin_hash) {
        try {
          await fetch(`${SB_URL}/rest/v1/staff?id=eq.${encodeURIComponent(row.id)}` +
                      `&shop_id=eq.${encodeURIComponent(row.shop_id)}`, {
            method: "PATCH",
            headers: {
              apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json", Prefer: "return=minimal"
            },
            body: JSON.stringify({ pin_hash: _pinHash })
          });
        } catch (e) { console.warn("pin_hash yozilmadi:", e.message); }
      }

      // To'liq nusxa `data` ustunida bo'lsa — undan (ruxsatlar ham keladi)
      const d = (row.data && typeof row.data === "object" && !Array.isArray(row.data))
                ? row.data : {};

      // Do'kon nomi
      let shopName = "MERX Do'koni";
      try {
        const sr = await fetch(
          `${SB_URL}/rest/v1/shops?select=name&id=eq.${encodeURIComponent(row.shop_id)}&limit=1`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        );
        const sd = await sr.json();
        if (Array.isArray(sd) && sd[0]?.name) shopName = sd[0].name;
      } catch (e) {}

      // ══════════════════════════════════════════════════════════
      // ⚠️ 2026-08-03: XODIMGA HAM SUPABASE AUTH SESSIYASI
      // ══════════════════════════════════════════════════════════
      // Avval xodim `anon` kalit bilan ulanardi. Bazadagi
      // `shop_isolation_*` qoidalari esa tokendagi
      // `user_metadata.shop_id` ni tekshiradi — token bo'lmagani
      // uchun ular xodimga UMUMAN qo'llanmasdi.
      //
      // Endi har xodim uchun Auth hisobi bo'ladi:
      //   email  — sun'iy: `staff.<id>.<shop>@merx.local`
      //            (xodim uni KO'RMAYDI, telefon+PIN bilan kiradi)
      //   parol  — PIN dan hosil qilinadi (PIN 4 raqam bo'lishi
      //            mumkin, Supabase esa 6 belgi talab qiladi)
      //
      // ⚠️ XATO BO'LSA KIRISH TO'XTAMAYDI — xodim avvalgidek
      // `anon` bilan ishlaydi. Ya'ni bu QO'SHIMCHA, almashtirish emas.
      let _session = null, _authWarn = null;
      try {
        const _crypto = require("crypto");
        const _mail = `staff.${row.id}.${String(row.shop_id).slice(-8)}@merx.local`;
        // Parol: PIN + do'kon + xodim id dan barqaror xesh.
        // PIN o'zgarsa parol ham o'zgaradi — eski PIN ishlamaydi.
        const _pass = _crypto.createHash("sha256")
          .update(`merx.staff.${row.id}.${row.shop_id}.${pin}`)
          .digest("hex").slice(0, 24);
        const _meta = { shop_id: row.shop_id, staff_id: row.id,
                        role: d.role || row.role || "kassir" };

        // 1) Hisob bormi
        const _fr = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
        const _fd = _fr.ok ? await _fr.json() : {};
        const _u = (_fd?.users || []).find(u => u.email?.toLowerCase() === _mail);

        if (!_u) {
          // 2a) Yo'q — yaratamiz
          await fetch(`${SB_URL}/auth/v1/admin/users`, {
            method: "POST",
            headers: {
              apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email: _mail, password: _pass, email_confirm: true,
              user_metadata: _meta
            })
          });
        } else {
          // 2b) Bor — parol va metama'lumotni yangilaymiz
          // (PIN yoki do'kon o'zgargan bo'lishi mumkin)
          await fetch(`${SB_URL}/auth/v1/admin/users/${_u.id}`, {
            method: "PUT",
            headers: {
              apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ password: _pass, user_metadata: _meta })
          });
        }

        // 3) Sessiya olamiz
        const ANON = process.env.SUPABASE_KEY || "";
        const _lr = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { apikey: ANON, "Content-Type": "application/json" },
          body: JSON.stringify({ email: _mail, password: _pass })
        });
        if (_lr.ok) {
          const _sd = await _lr.json();
          _session = {
            accessToken:  _sd.access_token,
            refreshToken: _sd.refresh_token,
            expiresAt:    Date.now() + (Number(_sd.expires_in || 3600) * 1000),
            email:        _mail,
            shopId:       row.shop_id
          };
        } else {
          const _le = await _lr.json().catch(() => ({}));
          _authWarn = "Sessiya olinmadi: " + (_le.error_description || _lr.status);
        }
      } catch (e) {
        _authWarn = "Auth: " + e.message;
        console.warn("staff auth:", e.message);
      }

      return res.status(200).json({
        ok: true,
        session: _session,          // 2026-08-03: bo'lsa token yo'li
        authWarn: _authWarn,        // bo'lmasa anon — ishlash to'xtamaydi
        staff: {
          id:       row.id,
          shopId:   row.shop_id,
          shopName,
          name:     d.name  || row.name  || "Xodim",
          phone:    d.phone || row.phone || "",
          role:     d.role  || row.role  || "kassir",
          pin:      row.pin,
          perms:        d.perms        || null,
          permDiscount: !!d.permDiscount,
          permNasiya:   !!d.permNasiya,
          permReturn:   !!d.permReturn,
          maxDiscount:  d.maxDiscount || 0
        }
      });
    }

    // ══════════════════════════════════════════════════════════
  // SERVER HAJMI (2026-08-03)
  // ══════════════════════════════════════════════════════════
  // Baza va rasm hajmini qaytaradi. Bepul rejada baza 500 MB,
  // Storage 1 GB — chegaraga yaqinlashganini SEZMAY QOLMASLIK
  // uchun SuperAdmin panelida ko'rsatiladi.
  // Hajm REST orqali olinmaydi — `sa_db_stats()` Postgres
  // funksiyasi kerak (SA3-HAJM.sql bilan yaratiladi).
  if (action === "server_stats") {
    try {
      const H = {
        apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json"
      };
      // 1) Baza hajmi va jadvallar
      let db = null;
      try {
        const r = await fetch(`${SB_URL}/rest/v1/rpc/sa_db_stats`, {
          method: "POST", headers: H, body: "{}"
        });
        if (r.ok) db = await r.json();
      } catch (e) { console.warn("sa_db_stats:", e.message); }

      // 2) Rasmlar (Storage)
      // ⚠️ 2026-08-03: PAPKALAR ICHIGA KIRAMIZ.
      // Rasmlar `product-images/<shop_id>/<fayl>` ko'rinishida
      // saqlanadi (`_uploadOneImage` da shunday). Ildizdan ro'yxat
      // olinsa faqat PAPKALAR chiqadi — shuning uchun "3 ta fayl,
      // 0 MB" deb ko'rsatardi.
      let imgBytes = 0, imgCount = 0;
      const _list = async (prefix) => {
        const r = await fetch(`${SB_URL}/storage/v1/object/list/product-images`, {
          method: "POST", headers: H,
          body: JSON.stringify({ limit: 1000, offset: 0, prefix,
                                 sortBy: { column: "name", order: "asc" } })
        });
        return r.ok ? await r.json() : [];
      };
      try {
        const roots = await _list("");
        for (const it of (Array.isArray(roots) ? roots : [])) {
          if (it?.id && it?.metadata) {              // ildizdagi fayl
            imgCount++; imgBytes += it.metadata.size || 0;
            continue;
          }
          // papka — ichini sahifalab o'qiymiz
          let off = 0;
          for (let page = 0; page < 20; page++) {
            const r = await fetch(`${SB_URL}/storage/v1/object/list/product-images`, {
              method: "POST", headers: H,
              body: JSON.stringify({ limit: 1000, offset: off,
                                     prefix: it.name + "/",
                                     sortBy: { column: "name", order: "asc" } })
            });
            const files = r.ok ? await r.json() : [];
            if (!Array.isArray(files) || !files.length) break;
            files.forEach(f => {
              if (f?.metadata) { imgCount++; imgBytes += f.metadata.size || 0; }
            });
            if (files.length < 1000) break;
            off += 1000;
          }
        }
      } catch (e) { console.warn("storage list:", e.message); }

      return res.status(200).json({
        ok: true,
        db_bytes:    db?.db_bytes || 0,
        total_rows:  db?.total_rows || 0,
        tables:      db?.tables || [],
        img_bytes:   imgBytes,
        img_count:   imgCount,
        db_limit:    500 * 1024 * 1024,    // bepul reja: 500 MB
        img_limit:  1024 * 1024 * 1024     // bepul reja: 1 GB
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ══════════════════════════════════════════════════════════
  // SUPERADMIN MOLIYASI (2026-08-03)
  // ══════════════════════════════════════════════════════════
  // Tariflar, daromad va xarajat. Jadvallarda RLS yoqilgan —
  // brauzerdan to'g'ridan o'qilmaydi, faqat shu yerdan
  // SERVICE_KEY bilan. Bu SuperAdminning shaxsiy hisobi,
  // do'kon egalari ko'rmasligi kerak.
  if (action === "sa_finance") {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    } catch { return res.status(400).json({ ok: false, error: "invalid_json" }); }

    const H = {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json"
    };
    const op = body.op || "";

    try {
      // ── O'QISH ──
      if (op === "load") {
        const [tf, inc, exp] = await Promise.all([
          fetch(`${SB_URL}/rest/v1/sa_tariffs?select=*&order=sort_order`, { headers: H }),
          // 2026-08-03: bir kunda qo'shilganlar ham yangisi tepada
          fetch(`${SB_URL}/rest/v1/sa_income?select=*&order=date.desc,created_at.desc&limit=500`, { headers: H }),
          fetch(`${SB_URL}/rest/v1/sa_expense?select=*&order=date.desc,created_at.desc&limit=500`, { headers: H })
        ]);
        return res.status(200).json({
          ok: true,
          tariffs: tf.ok  ? await tf.json()  : [],
          income:  inc.ok ? await inc.json() : [],
          expense: exp.ok ? await exp.json() : []
        });
      }

      // ── DO'KON FAOLLIGI (2026-08-03) ──
      // Har do'konning oxirgi sotuv sanasi va bugungi soni.
      // Avval bu `localStorage` dan olinardi — SuperAdmin kirmagan
      // do'kon "Ma'lumot yo'q" ko'rsatardi. Endi BULUTDAN.
      if (op === "activity") {
        const bugun = tashkentNow().toISOString().slice(0, 10);   // Toshkent
        // ⚠️ 2026-08-06: AVVAL `limit=20000` yozilgan edi, lekin Supabase
        // baribir 1000 qator qaytaradi. Bazada 3500 dan ortiq sotuv bor —
        // ya'ni faqat eng yangi 1000 tasi ko'rinardi va uzoq vaqt sotuv
        // qilmagan do'kon "ma'lumot yo'q" bo'lib chiqardi. Endi sahifalab
        // o'qiladi.
        const { rows, capped } = await sbFetchAll(
          `sales?select=shop_id,date&order=date.desc`, H);
        const map = {};
        for (const x of (rows || [])) {
          const sid = x.shop_id; if (!sid) continue;
          if (!map[sid]) map[sid] = { last: null, today: 0 };
          if (!map[sid].last || x.date > map[sid].last) map[sid].last = x.date;
          if (x.date === bugun) map[sid].today++;
        }
        return res.status(200).json({ ok: true, activity: map, capped });
      }

      // ── BITTA DO'KON STATISTIKASI (2026-08-03) ──
      // Avval bu `localStorage` dan hisoblanardi — SuperAdmin
      // ── QURILMALAR FAOLLIGI (2026-08-06) ──
      // Har chek raqamida qurilma kodi bor: CHK-20260806-2611-JS
      // Bulutga birinchi yozilgan vaqt — `created_at` (§13.15:
      // `updated_at` qayta yozilganda o'zgaradi, kechikish o'lchamaydi).
      // ⚠️ FAQAT O'QISH. Yangi jadval yaratilmaydi, hech narsa yozilmaydi.
      if (op === "devices") {
        const kun = (n) => new Date(Date.now() + TZ_OFFSET_MIN * 60000
                                    - n * 86400000).toISOString().slice(0, 10);
        const bugun = kun(0), hafta = kun(6);

        const { rows, capped } = await sbFetchAll(
          `sales?select=shop_id,chek_num,date,time,created_at` +
          `&date=gte.${hafta}&order=created_at.desc`, H);

        const map = {};
        for (const x of (rows || [])) {
          const ch = x.chek_num || "";
          if (!ch.startsWith("CHK-")) continue;          // ESKI- va boshqalar emas
          // ⚠️ 2026-08-06: QURILMA KODI — IKKI HARF (§3.14).
          // Avval oxirgi ikki belgi ko'r-ko'rona olinardi va eski
          // formatdagi cheklar (CHK-20260804-2565 — kodsiz) "55",
          // "66", "41" degan SOXTA qurilma bo'lib chiqardi.
          // Endi format tekshiriladi: CHK-<sana>-<raqam>-<XX>.
          const parts = ch.split("-");
          const raw   = parts.length >= 4 ? parts[3] : "";
          const isDev = /^[A-Za-z]{2}$/.test(raw);
          const dev   = isDev ? raw.toUpperCase() : "—";
          const key = x.shop_id + "|" + dev;
          if (!map[key]) map[key] = {
            shopId: x.shop_id, device: dev, legacy: !isDev,
            today: 0, week: 0, lastDate: null, lastTime: null,
            delaySum: 0, delayCnt: 0, delayMax: 0
          };
          const m = map[key];
          m.week++;
          if (x.date === bugun) m.today++;
          if (!m.lastDate || (x.date + (x.time || "")) > (m.lastDate + (m.lastTime || ""))) {
            m.lastDate = x.date; m.lastTime = x.time || "";
          }
          // Kechikish: bulutga kelgan vaqt (Toshkentga o'girilgan) − chek vaqti
          if (x.created_at && x.date && x.time) {
            const arrived = new Date(x.created_at).getTime() + TZ_OFFSET_MIN * 60000;
            const made    = Date.parse(`${x.date}T${x.time}:00Z`);
            if (!isNaN(made)) {
              const min = Math.round((arrived - made) / 60000);
              if (min > -600 && min < 60 * 24 * 7) {     // aql bovar qiladigan oraliq
                m.delaySum += min; m.delayCnt++;
                if (min > m.delayMax) m.delayMax = min;
              }
            }
          }
        }
        const list = Object.values(map).map(m => ({
          ...m,
          delayAvg: m.delayCnt ? Math.round(m.delaySum / m.delayCnt) : null
        })).sort((a, b) => (a.legacy - b.legacy) || (b.week - a.week));

        return res.status(200).json({ ok: true, devices: list, capped, bugun });
      }

      // kirmagan do'konda raqamlar BO'SH chiqardi. Endi bulutdan.
      if (op === "shop_stats") {
        const sid = body.shopId;
        if (!sid) return res.status(400).json({ ok: false, error: "shopId majburiy" });
        const q = encodeURIComponent(sid);
        const oy = tashkentNow().toISOString().slice(0, 7);        // Toshkent

        const [slR, prR, custCnt, omborCnt] = await Promise.all([
          // Yig'indi kerak — barcha qatorlar sahifalab o'qiladi
          sbFetchAll(`sales?shop_id=eq.${q}&select=total,remaining,status,date,debt_currency,debt_usd&order=id`, H),
          // Qoldiq dona `data` ichida — tovarlar ham sahifalanadi
          sbFetchAll(`products?shop_id=eq.${q}&select=data&order=sku`, H),
          // Bularga faqat SON kerak — qatorlar tortilmaydi
          sbCount(`customers?shop_id=eq.${q}`, H),
          sbCount(`ombor?shop_id=eq.${q}`, H)
        ]);
        const sales = slR.rows;
        const prods = prR.rows;
        const capped = slR.capped || prR.capped;

        // 2026-08-06: QARZ IKKI VALYUTADA ALOHIDA.
        // Avval hammasi `remaining` ga qo'shilardi — dollar qarzning
        // so'mdagi ekvivalenti so'm qarzlar bilan ARALASHIB ketardi.
        // Ilovadagi qoidaning o'zi (qarzlar.js → renderDebts):
        // dollar qarz `debt_usd` da, qolganlari `remaining` da.
        let totalRev = 0, monthRev = 0, monthCnt = 0, debtUzs = 0, debtUsd = 0, salesCnt = 0;
        for (const x of sales) {
          if (x.status === "bekor") continue;
          salesCnt++;
          const t = +x.total || 0;
          totalRev += t;
          const isUsd = x.debt_currency === "usd" && (+x.debt_usd || 0) > 0;
          if (isUsd) debtUsd += +x.debt_usd || 0;
          else       debtUzs += +x.remaining || 0;
          if ((x.date || "").startsWith(oy)) { monthRev += t; monthCnt++; }
        }
        // Ombordagi jami dona — tovar variantlaridan
        let stockCnt = 0;
        for (const p of prods) {
          const v = p?.data?.variants;
          if (Array.isArray(v)) v.forEach(x => stockCnt += (+x.qty || 0));
        }
        return res.status(200).json({ ok: true, stats: {
          totalRev, monthRev, monthCnt,
          totalDebt: debtUzs,   // eskicha nom — faqat SO'M qarzlar
          debtUzs, debtUsd,
          salesCnt,
          custCnt: custCnt, prodCnt: prods.length,
          stockCnt, omborCnt: omborCnt,
          capped,               // true bo'lsa raqamlar TO'LIQ EMAS
          profit: null      // tannarx `data` ichida — alohida hisob kerak
        }});
      }

      // ── TARIF SAQLASH ──
      if (op === "save_tariff") {
        const t = body.tariff || {};
        if (!t.id) return res.status(400).json({ ok: false, error: "id majburiy" });
        const r = await fetch(`${SB_URL}/rest/v1/sa_tariffs?on_conflict=id`, {
          method: "POST",
          headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify([{
            id: t.id, title: t.title || t.id,
            price_month: Number(t.price_month) || 0,
            price_year:  Number(t.price_year)  || 0,
            discount_pct: Number(t.discount_pct) || 0,
            currency: t.currency || "uzs",
            active: t.active !== false,
            sort_order: Number(t.sort_order) || 0,
            updated_at: new Date().toISOString()
          }])
        });
        if (!r.ok) return res.status(500).json({ ok: false, error: await r.text() });
        return res.status(200).json({ ok: true });
      }

      // ── DAROMAD / XARAJAT QO'SHISH ──
      if (op === "add_income" || op === "add_expense") {
        const tbl = op === "add_income" ? "sa_income" : "sa_expense";
        const d = body.row || {};
        if (!(Number(d.amount) > 0))
          return res.status(400).json({ ok: false, error: "Summa 0 dan katta bo'lsin" });
        // ⚠️ 2026-08-03: KURS YOZUV BILAN MUZLATILADI (kontekst §3.5).
        // Avval hisoblash paytidagi kurs ishlatilardi va u
        // SuperAdmin qaysi do'konga kirganiga bog'liq edi. Kurs
        // o'zgarsa O'TMISH ham o'zgarardi.
        // Endi kurs Markaziy bankdan olinadi va yozuvda qoladi.
        const cur = d.currency || "uzs";
        let rate = Number(d.rate) || 0;
        if (cur === "usd" && !(rate > 0)) {
          try {
            const rr = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/");
            const rj = await rr.json();
            rate = parseFloat(rj?.[0]?.Rate) || 0;
          } catch (e) { console.warn("kurs olinmadi:", e.message); }
        }
        if (cur === "uzs") rate = 1;
        if (!(rate > 0)) rate = 12100;      // oxirgi chora

        const row = op === "add_income"
          ? { shop_id: d.shop_id || null, shop_name: d.shop_name || null,
              tariff: d.tariff || null, period: d.period || null,
              amount: Number(d.amount), currency: cur, rate,
              date: d.date || null, note: d.note || null }
          : { tag: d.tag || "Boshqa", amount: Number(d.amount),
              currency: cur, rate, date: d.date || null, note: d.note || null };
        const r = await fetch(`${SB_URL}/rest/v1/${tbl}`, {
          method: "POST", headers: { ...H, Prefer: "return=minimal" },
          body: JSON.stringify([row])
        });
        if (!r.ok) return res.status(500).json({ ok: false, error: await r.text() });
        return res.status(200).json({ ok: true });
      }

      // ── O'CHIRISH ──
      if (op === "del_income" || op === "del_expense") {
        const tbl = op === "del_income" ? "sa_income" : "sa_expense";
        if (!body.id) return res.status(400).json({ ok: false, error: "id majburiy" });
        const r = await fetch(`${SB_URL}/rest/v1/${tbl}?id=eq.${encodeURIComponent(body.id)}`, {
          method: "DELETE", headers: H
        });
        if (!r.ok) return res.status(500).json({ ok: false, error: await r.text() });
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: "noma'lum op: " + op });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

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
        `${SB_URL}/rest/v1/shops?active=not.is.false&select=id,name,owner_email,owner_name,owner_phone,plan,active,blocked,trial_ends,created_at,shop_type,tier,price_uzs&order=created_at.desc`,
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

    // ══════════════════════════════════════════════════════════════
    // ZAXIRA / TIKLASH — SERVER ORQALI (2026-07-30)
    // Avval bularning hammasi brauzerda, anon kalit bilan bajarilardi.
    // §4.5: anon kalit boshqa do'kon yozuviga tega olmaydi va xato
    // JIMGINA YUTILADI — shuning uchun "✅ TIKLANDI" yozilib, aslida
    // hech nima tiklanmagan bo'lishi mumkin edi.
    // ══════════════════════════════════════════════════════════════

    // ── Do'kon zaxiralari ro'yxati ──────────────────────────────
    if (action === "list_backups") {
      const shopId = body.shopId || body.shop_id;
      if (!shopId) return res.status(400).json({ ok: false, error: "shopId majburiy" });
      const r = await fetch(
        `${SB_URL}/rest/v1/backups?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&select=id,date,records,created_at&order=date.desc`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const rows = await r.json().catch(() => null);
      if (!r.ok) return res.status(r.status).json({ ok: false, error: "Zaxiralar o'qilmadi", detail: rows });
      return res.status(200).json({ ok: true, backups: rows || [] });
    }

    // ── Bitta zaxirani to'liq o'qish ────────────────────────────
    if (action === "get_backup") {
      const backupId = body.backupId || body.backup_id;
      if (!backupId) return res.status(400).json({ ok: false, error: "backupId majburiy" });
      const r = await fetch(
        `${SB_URL}/rest/v1/backups?id=eq.${encodeURIComponent(backupId)}` +
        `&select=id,shop_id,date,records,data&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const rows = await r.json().catch(() => null);
      if (!r.ok) return res.status(r.status).json({ ok: false, error: "Zaxira o'qilmadi", detail: rows });
      const bk = (Array.isArray(rows) && rows[0]) || null;
      if (!bk) return res.status(404).json({ ok: false, error: "Zaxira topilmadi" });
      return res.status(200).json({ ok: true, backup: bk });
    }

    // ── Tiklash uchun YOZISH (bir jadval, bir bo'lak) ───────────
    // Klient jadvalga o'girishni O'ZI bajaradi (cloud.js dagi _bkMap*
    // funksiyalari — YAGONA MANBA, serverda takrorlanmaydi), server
    // faqat SERVICE_KEY bilan o'chirish/yozishni bajaradi.
    // wipe=true bo'lsa avval shu do'konning eski qatorlari o'chiriladi.
    if (action === "restore_write") {
      const shopId = body.shopId || body.shop_id;
      const table  = body.table;
      const rows   = Array.isArray(body.rows) ? body.rows : [];
      const wipe   = body.wipe === true;

      const ALLOWED = ["products","customers","sales","debt_payments",
                       "ombor","xarajatlar","staff","deleted_records"];
      if (!shopId) return res.status(400).json({ ok: false, error: "shopId majburiy" });
      if (!ALLOWED.includes(table))
        return res.status(400).json({ ok: false, error: "Ruxsat berilmagan jadval: " + table });

      const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
                  "Content-Type": "application/json" };
      let deleted = 0;

      if (wipe) {
        const dr = await fetch(
          `${SB_URL}/rest/v1/${table}?shop_id=eq.${encodeURIComponent(shopId)}`,
          { method: "DELETE", headers: { ...H, Prefer: "count=exact" } }
        );
        if (!dr.ok) {
          const t = await dr.text().catch(() => "");
          // MUHIM: o'chirish muvaffaqiyatsiz bo'lsa TO'XTAYMIZ — yozib
          // yuborsak ma'lumot ikkilanib ketardi
          return res.status(dr.status).json({ ok: false, step: "delete", table, error: t || "O'chirish muvaffaqiyatsiz" });
        }
        const cr = dr.headers.get("content-range") || "";
        deleted = parseInt(String(cr).split("/")[1]) || 0;
      }

      if (!rows.length) return res.status(200).json({ ok: true, table, deleted, inserted: 0 });

      const ir = await fetch(`${SB_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify(rows)
      });
      if (!ir.ok) {
        const t = await ir.text().catch(() => "");
        return res.status(ir.status).json({ ok: false, step: "insert", table, deleted, error: t || "Yozish muvaffaqiyatsiz" });
      }
      return res.status(200).json({ ok: true, table, deleted, inserted: rows.length });
    }

    return res.status(400).json({ ok: false, error: "Noma'lum action. Mavjud: signup_test, login_test, create_shop, update_shop_password, delete_test_user, shop_status" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server xatosi: " + e.message });
  }
};
