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
    "change_sa_pass",
    // 2026-08-07: SA do'konga kirganda unga token beruvchi amal
    // (reja 1.2). SA parolisiz chaqirib BO'LMAYDI — aks holda har
    // kim istalgan do'kon tokenini olardi.
    "sa_shop_session",
    // 2026-08-09: barcha xodimlar guruhlariga e'lon (yangilanish xabari)
    "sa_broadcast_staff",
    // 2026-08-09: SA panelidan egaga xabar — STRICT rejimga tayyorgarlik
    // (brauzer tokensiz; server botga x-merx-key bilan uzatadi)
    "sa_owner_notif"];
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

  // ── 📣 OMBORCHI GURUHLARIGA E'LON (2026-08-09) ────────────────
  // Sabab: yangilanish chiqqanda har do'konga qo'lda yozish o'rniga
  // SuperAdmin paneldan BIR tugma bilan xabar ketadi. SQL o'zi xabar
  // yubora olmaydi — yuboruvchi shu server (Telegram Bot API).
  // Guruh manzillari: settings.staff_group_id (ilovada "Sozlamalar →
  // SMS & Bot → Xodimlar guruhi ID" ga kiritilgan qiymat).
  // dryRun:true — HECH NARSA yubormaydi, faqat qabul qiluvchilar
  // ro'yxatini qaytaradi; panel avval shu ro'yxatni ko'rsatib,
  // tasdiqdan keyingina haqiqiy yuborishni chaqiradi.
  if (action === "sa_broadcast_staff") {
    const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
    const text   = String(body.text || "").trim();
    const dryRun = !!body.dryRun;
    if (!dryRun && !text)
      return res.status(400).json({ ok: false, error: "Xabar matni bo'sh" });
    if (!dryRun && text.length > 3500)
      return res.status(400).json({ ok: false, error: "Matn juda uzun (3500 belgidan oshdi)" });
    const TG = process.env.TELEGRAM_BOT_TOKEN || "";
    if (!dryRun && !TG)
      return res.status(500).json({ ok: false, error: "TELEGRAM_BOT_TOKEN o'rnatilmagan" });

    const { rows: setRows }  = await sbFetchAll(
      "settings?select=shop_id,staff_group_id&staff_group_id=not.is.null&order=shop_id", H);
    const { rows: shopRows } = await sbFetchAll("shops?select=id,name&order=id", H);
    const nameOf = {}; (shopRows || []).forEach(x => { nameOf[x.id] = x.name || x.id; });
    const targets = (setRows || [])
      .filter(r => String(r.staff_group_id || "").trim())
      .map(r => ({ shopId: r.shop_id,
                   name: nameOf[r.shop_id] || r.shop_id,
                   gid: String(r.staff_group_id).trim() }));

    if (dryRun) return res.status(200).json({ ok: true, targets });

    const sent = [], failed = [];
    for (const t of targets) {
      try {
        const tr = await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // parse_mode ATAYLAB berilmaydi: matn qanday yozilsa shunday
          // boradi — maxsus belgi formatlashni buzib xabarni yiqitmaydi
          body: JSON.stringify({ chat_id: t.gid, text })
        });
        const tj = await tr.json().catch(() => ({}));
        if (tj && tj.ok) sent.push(t.name);
        else failed.push(t.name + (tj && tj.description ? ` (${tj.description})` : ""));
      } catch (e) { failed.push(t.name + " (" + e.message + ")"); }
      await new Promise(r2 => setTimeout(r2, 60));   // Telegram tezlik chegarasi
    }
    return res.status(200).json({ ok: true, sentCount: sent.length, sent, failed });
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
    // ✅ 2026-08-13: DO'KON REJIMI ham shu yerdan keladi.
    // Sabab: `server_pay` sozlamasi oddiy sinxron bilan yuborilardi —
    // xodim qurilmasiga yetmasa u JIMGINA lokal yozib boshlardi
    // (egasining haqli xavotiri). Endi rejim KIRISH paytida
    // to'g'ridan-to'g'ri serverdan olinadi — kechikishga bog'liq emas.
    let _srvPay = null;
    try {
      const _sid = String((body && body.shopId) || "");
      if (_sid) {
        const r = await fetch(
          `${SB_URL}/rest/v1/settings?shop_id=eq.${encodeURIComponent(_sid)}` +
          `&select=server_pay&limit=1`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
        if (r.ok) {
          const j = await r.json();
          if (j && j[0] && j[0].server_pay != null) _srvPay = j[0].server_pay === true;
        }
      }
    } catch (e) {}
    return res.status(200).json({
      ok: true,
      url: process.env.SUPABASE_URL || "",
      key: process.env.SUPABASE_KEY || "",
      serverPay: _srvPay
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

      // ✅ 565 (2026-08-26): 12800 O'LDI.
      //  · MAVJUD do'konning kursi HECH QACHON bosilmaydi — kursi bor
      //    bo'lsa `rate` maydoni umuman yuborilmaydi (merge-duplicates
      //    uni tegmay o'tadi). Avval har create_shop jonli kursni 12800
      //    bilan bosib qo'yishi mumkin edi.
      //  · Kursi yo'q YANGI do'konga Markaziy Bank kursi tortiladi
      //    (api/rate.js dagi sinalgan manba, iyuldan beri jonda).
      //  · CBU javob bermasa — kurs bo'sh qoladi, do'kon yaratish
      //    BARIBIR tugaydi, admin birinchi kirishda kiritadi.
      let _rateField = {};
      try {
        const _sChk = await fetch(
          `${SB_URL}/rest/v1/settings?shop_id=eq.${encodeURIComponent(shopId)}&select=rate&limit=1`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
        const _sRows = await _sChk.json().catch(() => null);
        const _aniq  = Array.isArray(_sRows);   // so'rov muvaffaqiyatli bo'ldimi
        const _kursBor = _aniq && _sRows.length > 0 &&
                         _sRows[0] && _sRows[0].rate != null && Number(_sRows[0].rate) > 0;
        // CBU faqat ANIQ "kurs yo'q" holatda tortiladi; tekshiruv
        // xato bersa — hech narsa yuborilmaydi (mavjudni bosmaslik afzal)
        if (_aniq && !_kursBor) {
          const _cr = await fetch("https://cbu.uz/en/arkhiv-kursov-valyut/json/USD/",
            { headers: { "User-Agent": "Mozilla/5.0 (MERX savdo tizimi)" } });
          const _cd = await _cr.json();
          const _row = Array.isArray(_cd)
            ? (_cd.find(x => x && (x.Ccy === "USD" || x.CcyNm_EN === "US Dollar")) || _cd[0])
            : _cd;
          const _cb = parseFloat(_row && _row.Rate);
          if (_cb > 0) _rateField = { rate: Math.round(_cb) };
        }
      } catch (e) { console.error("565 CBU kursi olinmadi:", e.message); }

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
            ..._rateField,   // ✅ 565: 12800 o'rniga — mavjudga tegilmaydi, yangiga CBU
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
          ..._rateField,   // ✅ 565: 12800 o'rniga — mavjudga tegilmaydi, yangiga CBU
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

      // ⚠️ 2026-08-18 TUZATISH — ESKI EMAIL PATCH'DAN OLDIN O'QILADI.
      // Avval u pastdagi Auth blokida, PATCH'dan KEYIN o'qilardi. O'sha
      // paytda `shops` jadvalida allaqachon YANGI email turardi, natijada
      // "eski === yangi" chiqib, Auth yangilash bloki HECH QACHON
      // ishlamasdi va ogohlantirish ham yozilmasdi: panel "yangilandi"
      // derdi, egasi esa yangi login bilan kira olmasdi (jim nuqson).
      // Topilishi: chakana test do'koni — shops=dona2, auth=dona1.
      let _eskiEmail = "";
      if (typeof data.owner_email === "string" && data.owner_email.trim()) {
        try {
          const _curR = await fetch(
            `${SB_URL}/rest/v1/shops?id=eq.${encodeURIComponent(shopId)}&select=owner_email&limit=1`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
          const _curJ = _curR.ok ? await _curR.json() : [];
          _eskiEmail = (_curJ?.[0]?.owner_email || "").toLowerCase();
        } catch (e) { console.warn("eski email o'qilmadi:", e.message); }
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
          // Eski email YUQORIDA, PATCH'dan oldin olingan (2026-08-18).
          // Bu yerda qayta o'qilmaydi — jadvalda endi yangisi turadi.
          if (!_eskiEmail) {
            _authWarn = "Do'konning eski logini topilmadi — Auth hisobi " +
                        "yangilanmadi, egasi eski login bilan kiradi";
          } else if (_eskiEmail !== _yangiEmail) {
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
      // Endi: PIN xeshlanadi (`pin_hash`), so'rov FAQAT xesh bo'yicha.
      // ⚠️ 2026-08-09 (C-1 YAKUNI): eski `pin.eq` zaxira yo'li OLIB
      // TASHLANDI. Shartlari tekshirilib bajarilgan edi:
      //   1) bazada xeshsiz xodim 0 ta (SQL tekshiruvi),
      //   2) bulutda ochiq PIN 0 ta (2b-tozalash + trigger qo'riqchi),
      //   3) klient v261+ yangi xodimga xeshni O'ZI yozadi (formula
      //      bir xilligi sinov bilan isbotlangan: merx.pin.<PIN>).
      // Ochiq PIN endi kirish zanjirining HECH QAYERIDA qatnashmaydi.
      const _sha = (t) => require("crypto").createHash("sha256")
        .update("merx.pin." + t).digest("hex");
      const _pinHash = _sha(pin);

      const r = await fetch(
        `${SB_URL}/rest/v1/staff?select=*&pin_hash=eq.${_pinHash}`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const rows = await r.json();
      if (!r.ok) return res.status(500).json({ ok: false, error: "Xodim o'qilmadi" });

      const row = (rows || []).find(x => phKey(x.phone) === key);
      if (!row) {
        // ⚠️ 2026-08-11: TASHXISLI XATO. Avval "Telefon yoki PIN
        // noto'g'ri" deyilardi — sabab ko'rinmasdi. Endi telefon bo'yicha
        // alohida qidirib aniq aytamiz. Jonli voqea: PIN o'zgarishi
        // sinxroni o'lik kassada qolib, telefon/qayta-kirish bulutdagi
        // ESKI xesh bilan solishtirilib yiqilgan — endi xabar shuni
        // ochiq aytadi. (Ochiq PIN javobda YO'Q — xavfsizlik o'zgarmas.)
        try {
          const r2 = await fetch(
            `${SB_URL}/rest/v1/staff?select=id,phone&shop_id=eq.${encodeURIComponent(shopId)}`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
          const all = r2.ok ? await r2.json() : [];
          const phoneHit = (all || []).some(x => phKey(x.phone) === key);
          if (phoneHit)
            return res.status(200).json({ ok: false,
              error: "PIN mos kelmadi. Agar PIN yaqinda o'zgartirilgan bo'lsa — o'zgartirgan kassaning internetini/sinxronini tekshiring (qizil lenta), so'ng qayta urinib ko'ring." });
        } catch (e) {}
        return res.status(200).json({ ok: false,
          error: "Bu telefon raqamida xodim topilmadi. Raqamni tekshiring (mamlakat kodi bilan)." });
      }

      // ⚠️ 2026-08-05: XESHNI YOZIB QO'YAMIZ.
      // Xodim birinchi marta kirganda `pin_hash` to'ldiriladi.
      // Barcha xodim bir marta kirgach eski `pin` ustunini
      // o'chirish mumkin bo'ladi (§14 chala ishlar).
      // Xato bo'lsa kirish TO'XTAMAYDI — faqat log.
      // 2026-08-09: quyidagi blok endi AMALDA ISHLAMAYDI — qator faqat
      // xesh bo'yicha topilgani uchun row.pin_hash doim to'la. Tarix
      // uchun qoldirildi (zarari yo'q, hech qachon ishga tushmaydi).
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
              // 2026-08-14: parol "barmoq izi" — keyingi kirishlarda parol
              // qayta yozilmasin (aks holda faol sessiyalar bekor bo'ladi)
              user_metadata: { ..._meta,
                pin_fp: _crypto.createHash("sha256").update(_pass).digest("hex").slice(0, 16) }
            })
          });
        } else {
          // 🔴 2026-08-14 ILDIZ-DAVO: XODIM "KAR" BO'LIB QOLISHI.
          // Avval HAR KIRISHDA parol qayta yozilardi. Supabase esa
          // parol o'zgarganda o'sha hisobning BARCHA faol sessiyalarini
          // BEKOR QILADI. Natijada: xodim kompyuterda ishlab turibdi →
          // o'sha xodim telefonda kiradi → kompyuterdagi sessiya O'LADI
          // → bir soatdan keyin qurilma jimgina yozolmay qoladi
          // (ABU SAXIY, bir necha marta takrorlangan).
          // Adminda bu yo'q: admin kirganda hech narsa qayta yozilmaydi.
          //
          // ENDI: parol faqat CHINDAN o'zgarganda yoziladi. Buning
          // uchun parol "barmoq izi" metama'lumotda saqlanadi.
          const _pfp = _crypto.createHash("sha256").update(_pass).digest("hex").slice(0, 16);
          const _oldMeta = (_u && _u.user_metadata) || {};
          const _metaFarq =
            _oldMeta.shop_id  !== _meta.shop_id  ||
            String(_oldMeta.staff_id) !== String(_meta.staff_id) ||
            _oldMeta.role     !== _meta.role;
          if (_oldMeta.pin_fp !== _pfp) {
            // PIN o'zgargan — parol yoziladi (sessiyalar bekor bo'ladi,
            // bu TO'G'RI: eski PIN bilan kirganlar chiqib ketishi kerak)
            await fetch(`${SB_URL}/auth/v1/admin/users/${_u.id}`, {
              method: "PUT",
              headers: {
                apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ password: _pass,
                                     user_metadata: { ..._meta, pin_fp: _pfp } })
            });
          } else if (_metaFarq) {
            // PIN o'sha — faqat ma'lumot yangilanadi (sessiyalar TIRIK qoladi)
            await fetch(`${SB_URL}/auth/v1/admin/users/${_u.id}`, {
              method: "PUT",
              headers: {
                apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ user_metadata: { ..._meta, pin_fp: _pfp } })
            });
          }
          // Aks holda: HECH NARSA yozilmaydi — sessiyalar tirik qoladi.
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
          // \U0001f527 2026-08-14 (2-daraja): O'Z-O'ZINI TUZATISH.
          // Endi parol har kirishda qayta yozilmaydi (sessiyalar
          // bekor bo'lmasin uchun) — lekin parol biror sababdan
          // "adashib" qolsa xodim sessiyasiz qolardi. Shuning uchun:
          // sessiya olinmasa parolni BIR MARTA qayta yozib, qayta
          // urinamiz. Shunda ikkala foyda ham qoladi.
          // ═════════════════════════════════════════════════════════
          // 🔴 547 (2026-08-22): MINA YUMSHATILDI — SABAB AVVAL O'QILADI
          // ═════════════════════════════════════════════════════════
          // Supabase qoidasi: hisob PAROLI o'zgartirilsa o'sha hisobning
          // BARCHA qurilmadagi sessiyalari BEKOR bo'ladi. Yuqoridagi
          // 14-avg mexanizmi esa kirish HAR QANDAY sababdan yiqilsa
          // (429 cheklovi, 5xx, tarmoq uzilishi) parolni qayta yozardi —
          // bitta o'tkinchi xato xodimning HAMMA kassadagi kalitini bir
          // yo'la o'ldirardi. "Xodim tokeni tez o'ladi, adminniki
          // o'lmaydi"ning kod tomonidagi asosiy manbai shu edi (admin
          // hisobiga server hech qachon parol yozmaydi).
          // ENDI:
          //   · avval RAD SABABI o'qiladi;
          //   · o'tkinchi xatoda parolga TEGILMAYDI — 600 ms dan keyin
          //     BIR marta oddiy qayta urinish (sessiyalar tirik qoladi);
          //   · parol faqat Supabase ANIQ "invalid credentials/grant/
          //     password" deganda qayta yoziladi — bu PIN o'zgargan yoki
          //     eski-formulali hisob holati, aynan davolanishi kerak.
          const _le = await _lr.json().catch(() => ({}));
          const _sabab = String(_le.error_description || _le.msg ||
                                _le.error || "");
          const _parolXato = _lr.status === 400 &&
            /invalid/i.test(_sabab + " " + String(_le.error || "")) &&
            /(credential|grant|password)/i
              .test(_sabab + " " + String(_le.error || ""));
          let _tuzaldi = false;
          if (!_parolXato) {
            // O'tkinchi xato — parolga tegmasdan bir qayta urinish
            try {
              await new Promise(rz => setTimeout(rz, 600));
              const _lr3 = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
                method: "POST",
                headers: { apikey: ANON, "Content-Type": "application/json" },
                body: JSON.stringify({ email: _mail, password: _pass })
              });
              if (_lr3.ok) {
                const _sd3 = await _lr3.json();
                _session = {
                  accessToken:  _sd3.access_token,
                  refreshToken: _sd3.refresh_token,
                  expiresAt:    Date.now() + (Number(_sd3.expires_in || 3600) * 1000),
                  email:        _mail,
                  shopId:       row.shop_id
                };
                _tuzaldi = true;
                console.log("[staff_login] o'tkinchi xato (" + _lr.status +
                            ") — 2-urinishda sessiya olindi, parolga tegilmadi");
              }
            } catch (e) {}
          } else if (_u && _u.id) {
          try {
            const _pfp2 = _crypto.createHash("sha256").update(_pass).digest("hex").slice(0, 16);
            const _fix = await fetch(`${SB_URL}/auth/v1/admin/users/${_u.id}`, {
              method: "PUT",
              headers: {
                apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ password: _pass,
                                     user_metadata: { ..._meta, pin_fp: _pfp2 } })
            });
            if (_fix.ok) {
              const _lr2 = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
                method: "POST",
                headers: { apikey: ANON, "Content-Type": "application/json" },
                body: JSON.stringify({ email: _mail, password: _pass })
              });
              if (_lr2.ok) {
                const _sd2 = await _lr2.json();
                _session = {
                  accessToken:  _sd2.access_token,
                  refreshToken: _sd2.refresh_token,
                  expiresAt:    Date.now() + (Number(_sd2.expires_in || 3600) * 1000),
                  email:        _mail,
                  shopId:       row.shop_id
                };
                _tuzaldi = true;
                console.log("[staff_login] parol tiklandi — sessiya olindi");
              }
            }
          } catch (e) { console.warn("[staff_login] tuzatish:", e.message); }
          }
          if (!_tuzaldi) {
            _authWarn = "Sessiya olinmadi: " + (_sabab || _lr.status);
          }
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
    // ⚠️ 2026-08-07: SUPERADMIN DO'KON SESSIYASI (reja 1.2)
    // ══════════════════════════════════════════════════════════
    // Muammo (kontekst §8.3-1): SA do'konga kirganda brauzerda shu
    // do'kon uchun haqiqiy Auth sessiyasi bo'lmasdi — bazadagi
    // shop_isolation_* qoidalari uchun bu "begona" yoki "hech kim"
    // degani. staff kabi yopiq jadvalga yozib bo'lmasdi, anon
    // qoidalar yopilgach esa hamma yozuv to'xtardi.
    // Yechim staff_login bilan BIR XIL naqsh: har do'kon uchun
    // texnik hisob (sa.<shop_id>@merx.local). Parol serverda server
    // sirlaridan hosil qilinadi va brauzerga HECH QACHON bormaydi —
    // faqat tayyor token qaytadi. Do'kon egasining hisobi va
    // paroliga TEGILMAYDI. Darvoza: SA_ACTIONS — SA paroli majburiy.
    if (action === "sa_shop_session") {
      const shopId = String(body.shopId || "").trim();
      if (!shopId)
        return res.status(400).json({ ok: false, error: "shopId majburiy" });

      // Do'kon haqiqatan mavjudligini tekshiramiz
      const shr = await fetch(
        `${SB_URL}/rest/v1/shops?select=id&id=eq.${encodeURIComponent(shopId)}&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
      const shd = shr.ok ? await shr.json() : [];
      if (!Array.isArray(shd) || !shd[0])
        return res.status(404).json({ ok: false, error: "Do'kon topilmadi" });

      try {
        const _crypto = require("crypto");
        const _mail = `sa.${shopId}@merx.local`;
        // Parol — server sirlaridan barqaror xesh. Sir o'zgarsa parol
        // ham o'zgaradi, lekin quyida hisob paroli har safar
        // yangilanadi — tizim o'z-o'zini davolaydi.
        const _pass = _crypto.createHash("sha256")
          .update(`merx.sa.${shopId}.${SA_PASS || ""}.${SERVICE_KEY}`)
          .digest("hex").slice(0, 24);
        const _meta = { shop_id: shopId, name: "SuperAdmin", sa: true };

        // 1) Texnik hisob bormi (staff_login bilan bir xil usul)
        const _fr = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
        const _fd = _fr.ok ? await _fr.json() : {};
        const _u = (_fd?.users || []).find(u => u.email?.toLowerCase() === _mail);

        if (!_u) {
          // 1a) Yo'q — yaratamiz
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
          // 1b) Bor — parol va metama'lumot yangilanadi
          await fetch(`${SB_URL}/auth/v1/admin/users/${_u.id}`, {
            method: "PUT",
            headers: {
              apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ password: _pass, user_metadata: _meta })
          });
        }

        // 2) Sessiya olamiz
        const ANON = process.env.SUPABASE_KEY || "";
        const _lr = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { apikey: ANON, "Content-Type": "application/json" },
          body: JSON.stringify({ email: _mail, password: _pass })
        });
        if (!_lr.ok) {
          const _le = await _lr.json().catch(() => ({}));
          return res.status(200).json({ ok: false,
            error: "Sessiya olinmadi: " + (_le.error_description || _lr.status) });
        }
        const _sd = await _lr.json();
        return res.status(200).json({
          ok: true,
          session: {
            accessToken:  _sd.access_token,
            refreshToken: _sd.refresh_token,
            expiresAt:    Date.now() + (Number(_sd.expires_in || 3600) * 1000),
            email:        _mail,
            shopId
          }
        });
      } catch (e) {
        return res.status(200).json({ ok: false, error: "Auth: " + e.message });
      }
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
  if (action === "sa_owner_notif") {
    // ⚠️ 2026-08-09 (STRICT tayyorgarligi): SA panel brauzeri Supabase
    // tokenisiz ishlaydi, bot esa STRICT rejimda tokensiz so'rovni rad
    // etadi. Yechim: SA parol darvozasidan o'tgan so'rovni server O'ZI
    // botga `x-merx-key` bilan uzatadi (bot.js shu kalitni "server"
    // sifatida qabul qiladi). MERX_BOT_KEY — bitta env, ikkala fayl
    // o'qiydi; o'rnatilmagan bo'lsa STRICT'gacha kalitsiz ham o'tadi.
    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); }
    catch { return res.status(400).json({ ok: false, error: "invalid_json" }); }
    try {
      const _botKey = process.env.MERX_BOT_KEY || "";
      const r = await fetch(`https://${req.headers.host}/api/bot?action=send_owner_notif`, {
        method: "POST",
        headers: { "Content-Type": "application/json",
                   ...(_botKey ? { "x-merx-key": _botKey } : {}) },
        body: JSON.stringify({ shopId: body.shopId, ownerEmail: body.ownerEmail,
                               ownerPhone: body.ownerPhone, text: body.text })
      });
      const j = await r.json().catch(() => ({}));
      return res.status(200).json({ ok: true, ...j });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

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
        // ⚠️ 2026-08-09: `limit=500` OLIB TASHLANDI (§4.4 qoldig'i).
        // Yozuvlar 500 dan oshgach eskilari JIM yo'qolardi — 1000-qator
        // kesishining aynan o'zi. Endi sahifalab TO'LIQ o'qiladi.
        const _all = async (table) => {
          const out = [];
          for (let from = 0; ; from += 1000) {
            const r = await fetch(
              `${SB_URL}/rest/v1/${table}?select=*&order=date.desc,created_at.desc` +
              `&offset=${from}&limit=1000`, { headers: H });
            if (!r.ok) break;
            const j = await r.json();
            out.push(...j);
            if (j.length < 1000) break;
            if (from > 50000) { console.warn("sa_finance:", table, "juda ko'p qator"); break; }
          }
          return out;
        };
        const [tf, inc, exp] = await Promise.all([
          fetch(`${SB_URL}/rest/v1/sa_tariffs?select=*&order=sort_order`, { headers: H }),
          _all("sa_income"),
          _all("sa_expense")
        ]);
        return res.status(200).json({
          ok: true,
          tariffs: tf.ok ? await tf.json() : [],
          income:  inc,
          expense: exp
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

        // ── Qurilma o'zi yuborgan holat (2026-08-06) ──
        // `device_status` — alohida jadval, har qurilma uchun bitta qator.
        // Ilova versiyasi va lokal sonlar CHEKDA yo'q, faqat shu yerda.
        let st = [];
        try {
          const r = await fetch(
            `${SB_URL}/rest/v1/device_status?select=*&limit=500`, { headers: H });
          if (r.ok) st = await r.json();
        } catch (e) { /* jadval hali yaratilmagan bo'lishi mumkin */ }

        const stMap = {};
        for (const s of (st || [])) stMap[s.shop_id + "|" + s.device_code] = s;

        for (const row of list) {
          const s = stMap[row.shopId + "|" + row.device];
          if (!s) continue;
          row.appVersion  = s.app_version || null;
          row.lastSeen    = s.last_seen   || null;
          row.localSales  = s.sales_cnt;
          row.localProds  = s.products_cnt;
          row.pending     = s.pending_cnt;
          row.platform    = s.platform || null;
          row.tzOffset    = s.tz_offset;
          delete stMap[row.shopId + "|" + row.device];
        }
        // Chek yozmagan, lekin holat yuborgan qurilmalar ham ko'rinsin
        for (const k of Object.keys(stMap)) {
          const s = stMap[k];
          list.push({
            shopId: s.shop_id, device: s.device_code, legacy: false,
            today: 0, week: 0, lastDate: null, lastTime: null,
            delayAvg: null, delayMax: 0,
            appVersion: s.app_version, lastSeen: s.last_seen,
            localSales: s.sales_cnt, localProds: s.products_cnt,
            pending: s.pending_cnt, platform: s.platform, tzOffset: s.tz_offset
          });
        }

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
        `${SB_URL}/rest/v1/shops?active=not.is.false&select=id,name,owner_email,owner_name,owner_phone,plan,active,blocked,trial_ends,created_at,shop_type,tier,price_uzs,sync_tools&order=created_at.desc`,
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
        `&select=name,plan,active,blocked,trial_ends,tier,sync_tools&limit=1`,
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
        tier:       sh.tier  || null,
        // ⚠️ 2026-08-08: MAJBURIY SINXRON TUGMALARI — DO'KON DARAJASIDA.
        // Sabab (jonli hodisa): bitta qurilma "Majburiy qayta yuborish"
        // bosganda, uning ESKIRGAN nusxasi boshqa qurilmada qilingan
        // ishni bosib ketdi — CHK-20260808-3301-EG dagi qaytarish
        // shunday yo'qoldi (14:45 da qilingan, 15:54 dagi massaviy
        // qayta yuborish o'chirib yubordi).
        // Endi bu tugmalar STANDART YOPIQ. SuperAdmin kerak bo'lganda
        // do'kon uchun ochadi, ish tugagach yopadi.
        sync_tools: sh.sync_tools === true
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

      // ══════════════════════════════════════════════════════════
      // ⚠️ 2026-08-08: HIMOYA KAMARI (kontekst §5.7, §14.C-7)
      // ══════════════════════════════════════════════════════════
      // Bu amal `wipe=true` bilan do'konning BUTUN jadvalini
      // o'chirib, zaxiradan qayta yozadi. Himoyasiz holda u eng
      // xavfli qurol edi: bitta noto'g'ri chaqiruv butun sotuv
      // tarixini yo'q qilishi mumkin. Uchta qo'riqchi qo'yildi.
      if (wipe) {
        // 1-QO'RIQCHI: BO'SH WIPE — ataylab tasdiqlanishi kerak.
        // ⚠️ Muhim: mavjud tiklash oqimi (cloud.js) uchta o'rinda
        // qonuniy ravishda `rows:[] + wipe:true` yuboradi:
        //   (a) zaxirada bu jadval bo'sh — eskisini tozalash,
        //   (b) `deleted_records` tozalash (tombstone),
        // shuning uchun BLOKLAMAYMIZ, lekin `allowEmpty:true`
        // talab qilamiz. Shu bilan qo'lda/tasodifan yuborilgan
        // "hammasini o'chir, hech narsa yozma" chaqiruvi o'tmaydi,
        // ilovaning o'z oqimi esa (quyida yangilangan) ishlayveradi.
        if (!rows.length && body.allowEmpty !== true)
          return res.status(400).json({ ok: false,
            error: "Bo'sh wipe uchun allowEmpty:true kerak — " +
                   "tasodifan butun jadvalni o'chirib yuborishdan himoya" });

        // 2-QO'RIQCHI: NISBAT tekshiruvi (faqat yoziladigan ma'lumot bor bo'lsa).
        // Jadvalda 3000 qator bo'lib, zaxirada 50 tasi bo'lsa — bu
        // deyarli har doim xato (eski/qisman zaxira). Ataylab bo'lsa
        // `force:true` bilan tasdiqlanadi.
        // ⚠️ Bo'laklab yozishda birinchi bo'lak 100 qatorli bo'lishi
        // mumkin — shuning uchun klient `totalRows` (jami reja)
        // yuborsa, nisbat SHU raqamga qarab hisoblanadi.
        const rejaJami = Number(body.totalRows) || rows.length;
        if (rows.length && body.force !== true) {
          const cntRes = await fetch(
            `${SB_URL}/rest/v1/${table}?shop_id=eq.${encodeURIComponent(shopId)}&select=shop_id`,
            { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
          const cntRange = cntRes.headers.get("content-range") || "";
          const hozirgi = parseInt(String(cntRange).split("/")[1]) || 0;
          if (hozirgi > 0 && rejaJami < hozirgi * 0.5) {
            return res.status(400).json({ ok: false,
              error: `Xavfsizlik to'xtatdi: hozir ${hozirgi} qator bor, zaxirada ${rejaJami} ta ` +
                     `(yarmidan kam). Ataylab bo'lsa force:true bilan qayta yuboring.`,
              hozirgi, zaxirada: rejaJami });
          }
        }

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

        // 3-QO'RIQCHI: IZ QOLDIRAMIZ.
        // Avval bu amal hech qanday iz qoldirmasdi — nima, qachon,
        // qancha o'chgani noma'lum edi. Endi deleted_records ga
        // yozuv tushadi (jadval allaqachon bor, tombstone tizimi).
        try {
          await fetch(`${SB_URL}/rest/v1/deleted_records`, {
            method: "POST",
            headers: { ...H, Prefer: "return=minimal" },
            body: JSON.stringify([{
              shop_id: shopId,
              table_name: "_restore_write",
              record_id: `${table}:${deleted}->${rows.length}:${new Date().toISOString()}`
            }])
          });
        } catch (e) { /* jurnal yozilmasa ham tiklash to'xtamaydi */ }
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
