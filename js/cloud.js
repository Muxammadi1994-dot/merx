// MERX cloud.js | v2.3 | 2026-06-11
// ================================================
// MERX — js/cloud.js  (v2 — Supabase sync)
// ================================================

let _sb = null; // Supabase client
let _sbUsedAnon = true; // oxirgi ulanish anon key bilan bo'ldimi

// ── Supabase clientini yaratish ───────────────────
// ── Shop ID — multi-tenant izolyatsiya ───────────
function getCloudShopId() {
  // 1. db.settings da saqlangan cloudShopId — eng ishonchli
  if (db.settings?.cloudShopId && db.settings.cloudShopId !== "local") {
    return db.settings.cloudShopId;
  }
  // 2. Auth session dan
  if (typeof getShopId === "function") {
    const sid = getShopId();
    if (sid && sid !== "local") return sid;
  }
  // 3. Do'kon ID topilmadi — sinxronlash MUMKIN EMAS.
  // ESKI USUL OLIB TASHLANDI: avval bu yerda Supabase URL'dan ID
  // yasalardi (masalan "satsriyleuzlrxnohecu") — bu turli qurilmalar
  // ma'lumotlarini bitta egasiz ID ostiga aralashtirib yuborardi.
  return null;
}

// ── TOKEN AVTO-YANGILASH (v166) ────────────────────────────────
// Kirish kaliti muddati tugashidan 5 daqiqa oldin (yoki tugagan
// bo'lsa darhol) yangisi olinadi — tizim endi hech qachon jimgina
// "kar" (yozolmaydigan) rejimga tushmaydi. AbuSaxiy hodisasi davosi.
let _refreshBusy = false;
async function ensureFreshToken() {
  if (_refreshBusy) return;
  try {
    const raw = localStorage.getItem("merx_sb_session")
             || sessionStorage.getItem("merx_sb_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!s?.refreshToken) return; // eski sessiya (refreshsiz) — yangilab bo'lmaydi
    if (s.expiresAt && Date.now() < s.expiresAt - 5 * 60 * 1000) return; // hali yangi
    const url = db.settings?.supabaseUrl?.trim();
    const key = db.settings?.supabaseKey?.trim();
    if (!url || !key) return;
    _refreshBusy = true;
    const r = await fetch(url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refreshToken })
    });
    const d = await r.json();
    if (d.access_token) {
      s.accessToken  = d.access_token;
      s.refreshToken = d.refresh_token || s.refreshToken;
      s.expiresAt    = Date.now() + ((d.expires_in || 3600) * 1000);
      localStorage.setItem("merx_sb_session", JSON.stringify(s));
      if (typeof setSupabaseTestSession === "function") setSupabaseTestSession(s);
      console.log("🔄 Kirish kaliti avtomatik yangilandi");
    } else if (r.status === 400 || r.status === 401) {
      console.warn("❌ Sessiya butunlay eskirgan — chiqib, qayta kiring");
      if (typeof toast === "function") toast("Sessiya eskirdi — chiqib, qayta kiring", "err");
    }
  } catch (e) { console.warn("token yangilash xato:", e.message); }
  finally { _refreshBusy = false; }
}

async function initSupabase() {
  // Har ulanish oldidan token yangiligini ta'minlaymiz (v166)
  await ensureFreshToken();
  // 1. settings dan, 2. global config dan
  const url = (db.settings?.supabaseUrl?.trim()) || 
              (typeof MERX_SUPABASE_URL !== "undefined" ? MERX_SUPABASE_URL : "");
  const key = (db.settings?.supabaseKey?.trim()) || 
              (typeof MERX_SUPABASE_KEY !== "undefined" ? MERX_SUPABASE_KEY : "");
  if (!url || !key) {
    console.warn("❌ initSupabase: kalitlar topilmadi (db.settings bo'sh) — bulut o'chiq");
    return false; // endi JIM yiqilmaydi (v161)
  }
  // Settings ga ham yozamiz (bo'lmasa)
  if (db.settings && !db.settings.supabaseUrl) {
    db.settings.supabaseUrl = url;
    db.settings.supabaseKey = key;
  }

  try {
    // SEKIN INTERNET DAVOSI (v160): Supabase kutubxonasi CDN'dan hali
    // yetib kelmagan bo'lishi mumkin — 10 soniyagacha kutamiz.
    // (Guest/yangi qurilmalarda "do'kon bo'sh" muammosining sababi shu edi)
    let _lib = window.supabase || (typeof supabase !== "undefined" ? supabase : null);
    for (let i = 0; i < 40 && !_lib; i++) {
      await new Promise(r => setTimeout(r, 250));
      _lib = window.supabase || (typeof supabase !== "undefined" ? supabase : null);
    }
    if (!_lib) {
      console.warn("❌ Supabase kutubxonasi yuklanmadi (internet juda sekin) — birozdan keyin qayta uriniladi");
      return false;
    }
    const { createClient } = _lib;

    // Auth token holati
    const sbSession = typeof getSupabaseTestSession === "function"
      ? getSupabaseTestSession()
      : null;

    // Agar allaqachon token bilan ulangan bo'lsa — qaytadan yaratmaymiz
    // (bu "Multiple GoTrueClient" ogohlantirishini oldini oladi)
    // v159: token ALMASHGANini ham sezamiz — hisob almashganda eski
    // token bilan qolgan client RLS'da yangi do'konni ko'rmasdi
    const needNewClient = !_sb
      || ((sbSession?.accessToken || null) !== _sbLastToken)
      || (sbSession?.accessToken && _sbUsedAnon) || (!sbSession?.accessToken && !_sbUsedAnon);
    _sbLastToken = sbSession?.accessToken || null;

    if (needNewClient) {
      if (sbSession?.accessToken) {
        // Yangi yo'l: Supabase Auth token bilan
        _sb = createClient(url, key, {
          auth: { persistSession: false },
          global: { headers: { Authorization: `Bearer ${sbSession.accessToken}` } }
        });
        _sbUsedAnon = false;
        console.log("✅ Cloud: Supabase Auth token bilan ulandi (yangi, xavfsiz yo'l)");
      } else {
        // Eski zaxira yo'l: anon key bilan
        _sb = createClient(url, key, { auth: { persistSession: false } });
        _sbUsedAnon = true;
        console.log("ℹ️ Cloud: anon key bilan ulandi (eski yo'l, hali ham ishlaydi)");
      }
    }

    // Test ulanish — settings jadvalini tekshiramiz
    const { error } = await _sb.from("settings").select("shop_id").limit(1);
    if (error) throw error;

    updateCloudUI(true);
    return true;
  } catch(e) {
    console.warn("Supabase ulanmadi:", e.message);
    updateCloudUI(false);
    _sb = null;
    return false;
  }
}

// ── UI yangilash ──────────────────────────────────
function updateCloudUI(connected) {
  const badge = $("cloud-status-badge");
  const pill  = $("cloud-pill");
  const txt   = $("cloud-txt");

  if (badge) {
    badge.textContent = connected ? "Ulangan ✅" : "Ulanmagan";
    badge.className   = connected ? "bg bg-g" : "bg bg-gr";
  }
  if (pill) pill.style.display = connected ? "flex" : "none";
  if (txt)  txt.textContent    = connected ? "Cloud" : "";
}

// ── LocalDB → Supabase (to'liq push) ─────────────
// ── connectCloud (ESKI YO'L) OLIB TASHLANDI, 2026-07 (3-bosqich) ──
// Sabab: bu qo'lda ulash yo'li ichida "shop_"+Date.now() bilan do'kon
// yaratadigan alohida kanal bor edi — "yagona yozish kanali" prinsipiga
// zid. Endi ulanish faqat login orqali (avtomatik).
function connectCloud() {
  toast("Bu funksiya olib tashlandi — bulut login paytida avtomatik ulanadi", "err");
}
async function _setShopContext(sid) {
  if (!sid || !_sb) return;
  // v183 — MUHIM TUZATISH: avval bu yerdagi xato faqat konsolga
  // yozilib, JIM YUTILARDI. Bu funksiya RLS (xavfsizlik) uchun qaysi
  // do'kon ekanini bildiradi — agar u ishlamasa, Supabase HECH QANDAY
  // qatorni ko'rsatmaydi (0 natija), lekin bu XATO EMAS deb
  // hisoblanardi — natijada "muvaffaqiyatli, lekin BO'SH" pull qayd
  // etilib, qayta urinish TO'XTAB QOLARDI (katalog abadiy bo'sh qolib
  // ketardi, ayniqsa yangi qurilmada birinchi kirishda). Endi xato
  // QAYTA OTILADI (throw) — shunda pullFromCloud() to'xtaydi va
  // ensureCloudPull() buni HAQIQIY muvaffaqiyatsizlik deb bilib,
  // qayta uradi (token/tarmoq tayyor bo'lguncha).
  await _sb.rpc('set_current_shop_id', { p_shop_id: sid });
}

// Bu sessiyada bulutdan yuklab olish (pull) muvaffaqiyatli tugadimi?
// Push FAQAT shundan keyin ruxsat etiladi — eskirgan lokal nusxa
// bulutdagi yangi ma'lumotlarni yozib yubormasligi uchun.
let _sbLastToken = null; // client qaysi token bilan qurilgani (v159)
let _cloudPullDone = false;

// O'chirish sinxroni uchun holat:
// _cloudIds — oxirgi pull'da bulutda KO'RILGAN yozuvlar (jadval bo'yicha).
//   Push paytida lokaldan yo'qolganlari = foydalanuvchi o'chirgan.
// _tombstones — "o'chirilganlar daftari" (deleted_records jadvalidan),
//   pull/merge ularni qayta tiriltirmasligi uchun.
let _cloudIds = {};
let _tombstones = new Set();
// Pull QAYSI do'kon uchun bo'lgan — SA do'kon almashtirganda
// eski ro'yxat yangi do'konga qo'llanib ketmasligi uchun (KRITIK)
let _pulledShopId = null;

async function pushToCloud() {
  // v166: push oldidan token yangiligi + client mosligi ta'minlanadi
  try { await initSupabase(); } catch(e) {}
  if (!_sb) { toast("Avval ulaning","err"); return; }
  const _sid = getCloudShopId();
  if (!_sid) {
    console.warn("Cloud push o'tkazib yuborildi: do'kon ID yo'q (tizimga kirilmagan)");
    return;
  }
  if (!_cloudPullDone || _pulledShopId !== _sid) {
    console.warn("Cloud push kutmoqda: AYNAN SHU do'kon uchun pull tugashi kerak (do'kon almashgan bo'lishi mumkin)");
    if (typeof ensureCloudPull === "function") ensureCloudPull();
    return;
  }
  // Versiya qo'riqchisi: eski kod bulutga YOZA OLMAYDI
  if (await checkAppVersion() === false) {
    console.warn("Cloud push bloklandi: ilova versiyasi eskirgan — Ctrl+Shift+R kerak");
    return;
  }
  // v183: pull uchun xato qayta otilishi kerak (qayta urinish ishlashi
  // uchun), lekin push uchun shart emas — muvaffaqiyatsiz bo'lsa
  // keyingi rejalashtirilgan sinxronlashda (scheduleCloudSync) o'zi
  // qayta urinadi, hozircha jim chiqib ketamiz.
  try { await _setShopContext(_sid); }
  catch(e) { console.warn("Cloud push: do'kon konteksti o'rnatilmadi, keyinroq qayta urinamiz:", e.message); return; }
  const sid = _sid;
  try {
    // Settings
    // Settings — eski schema id=1, yangi schema shop_id
    // Settings — shop_id asosida upsert
    if (sid && sid !== "local" && sid !== "default") {
      try {
        await _sb.from("settings").upsert({
          shop_id:        sid,
          shop_name:      db.shop?.name || "MERX",
          rate:           db.settings?.rate || 12800,
          price_currency: db.settings?.priceCurrency || "uzs",
          shop_type:      db.settings?.shopType || null,
          eskiz_token:    db.settings?.eskizToken    || null,
          eskiz_sender:   db.settings?.eskizSender   || null,
          telegram_bot:   db.settings?.telegramBotUrl || null,
          telegram_bot_username: db.settings?.telegramBotUsername || null,
          staff_group_id: db.settings?.staffGroupId  || null,
          loyalty_rate:   db.settings?.loyaltyRate   || 0,
          loyalty_value:  db.settings?.loyaltyValue  || 100,
          rate_mode:       db.settings?.rateMode      || "manual",
          rate_updated_at: db.settings?.rateUpdatedAt || null,
          debt_pay_methods_shown: db.settings?.debtPayMethodsShown || null,
          debt_cols:              db.settings?.debtCols            || null,
        }, { onConflict: "shop_id" });
      } catch(e) { console.warn("settings upsert xato:", e.message); }
    }

    // Helper — upsert id asosida, xato bo'lsa warning, davom etadi
    async function sync(table, rows) {
      if (!rows || !rows.length) return;
      const chunk = 50;
      for (let i = 0; i < rows.length; i += chunk) {
        const { error } = await _sb.from(table)
          .upsert(rows.slice(i, i+chunk), {onConflict:"id", ignoreDuplicates:false});
        if (error) throw error;
      }
    }

    // Customers uchun alohida sync — telegram_chat_id ni HECH QACHON o'zgartirmaymiz
    async function syncCustomers(customers) {
      if (!customers || !customers.length) return;
      const chunk = 50;
      for (let i = 0; i < customers.length; i += chunk) {
        const batch = customers.slice(i, i+chunk).map(c => {
          const row = {
            shop_id: sid, id: c.id, name: c.name,
            phone: c.phone || null,
            type: c.type || "ulgurji",
            balance_uzs: c.balanceUzs || 0,
            balance_usd: c.balanceUsd || 0
          };
          // Yangi schema ustunlari — mavjud bo'lsa
          if (c.phone2 !== undefined)        row.phone2         = c.phone2 || null;
          if (c.company !== undefined)       row.company        = c.company || null;
          if (c.note !== undefined)          row.note           = c.note || null;
          if (c.importantNote !== undefined) row.important_note = c.importantNote || null;
          if (c.birthday !== undefined)      row.birthday       = c.birthday || null;
          if (c.source !== undefined)        row.source         = c.source || null;
          if (c.debtLimit !== undefined)     row.debt_limit     = c.debtLimit || null;
          if (c.loyaltyPoints !== undefined)   row.loyalty_points   = c.loyaltyPoints || 0;
          if (c.telegramChatId !== undefined)  row.telegram_chat_id = c.telegramChatId || null;
          return row;
        });
        const { error } = await _sb.from("customers")
          .upsert(batch, {onConflict:"id", ignoreDuplicates:false});
        if (error) throw error;
      }
    }

    // Har bir jadvalni mustaqil sinxronlaymiz
    // Biri xato bersada, qolganlar davom etadi
    const syncErrors = [];

    try {
      // products: sku bo'yicha upsert (id emas) — ikki marta conflict bo'lmasligi uchun
      const prodRows = (db.products||[])
        .filter(p => p.id != null)
        .map(p => ({
          shop_id: sid, id: p.id,
          sku: p.sku, name: p.name,
          category: p.category, type: p.type,
          unit: p.unit || "dona",
          art: p.art || "",
          cost_usd: p.costUsd || 0,
          price_uzs: p.priceUzs || 0,
          ulgurji: p.ulgurjiNarx || 0,
          variants: p.variants || [],
          image: p.image || null,
          color_images: p.colorImages || null
        }));
      if (prodRows?.length) {
        const chunk = 20; // image katta bo'lgani uchun kichik chunk
        for (let i = 0; i < prodRows.length; i += chunk) {
          const { error } = await _sb.from("products")
            .upsert(prodRows.slice(i, i+chunk), { onConflict: "id", ignoreDuplicates: false });
          if (error) throw error;
        }
      }
    } catch(e) { syncErrors.push("products: " + e.message); console.warn("sync products xato:", e.message); }

    try {
      await syncCustomers(db.customers);
    } catch(e) { syncErrors.push("customers: " + e.message); console.warn("sync customers xato:", e.message); }

    try {
      // Avval asosiy ustunlar (eski schema bilan mos)
      const staffRows = db.staff?.map(s => {
        const row = {
          shop_id: sid, id: s.id, name: s.name,
          phone: s.phone || null,
          role: s.role || "kassir"
        };
        // Ruxsatlar va modullarni JSON ga o'tkazamiz
        if (s.permissions) {
          try { row.permissions = typeof s.permissions === "string"
            ? s.permissions : JSON.stringify(s.permissions); } catch(e) {}
        }
        if (s.modules) {
          try { row.modules = typeof s.modules === "string"
            ? s.modules : JSON.stringify(s.modules); } catch(e) {}
        }
        if (s.pin !== undefined) row.pin = s.pin || null;
        // Maosh va ruxsatlar — YANGI (oldin sync bo'lmasdi)
        if (s.salary !== undefined)        row.salary         = s.salary || 0;
        if (s.bonusPct !== undefined)      row.bonus_pct      = s.bonusPct || 0;
        if (s.monthTarget !== undefined)   row.month_target   = s.monthTarget || 0;
        if (s.permDiscount !== undefined)  row.perm_discount  = !!s.permDiscount;
        if (s.maxDiscount !== undefined)   row.max_discount   = s.maxDiscount || 0;
        if (s.permNasiya !== undefined)    row.perm_nasiya    = !!s.permNasiya;
        if (s.permReturn !== undefined)    row.perm_return    = !!s.permReturn;
        if (s.paidMonths !== undefined)    row.paid_months    = s.paidMonths || [];
        if (s.salaryHistory !== undefined) row.salary_history = s.salaryHistory || [];
        return row;
      });
      await sync("staff", staffRows);
    } catch(e) { syncErrors.push("staff: " + e.message); console.warn("sync staff xato:", e.message); }

    try {
      await sync("sales", db.sales?.map(s => ({
        shop_id: sid, id: s.id,
        chek_num: s.chekNum || null,
        date: s.date, time: s.time || null,
        price_type: s.priceType, pay_type: s.payType,
        pay_breakdown: s.payBreakdown || null,
        items: (s.items || []).map(({ image, ...rest }) => rest), // image base64 ni Supabase ga yubormaymiz (juda katta)
        total: s.total || 0, paid: s.paid || 0,
        remaining: s.remaining || 0,
        due: s.due || null,
        customer_id: s.customerId || null,
        customer_name: s.customerName || null,
        customer_phone: s.customerPhone || null,
        staff_id: s.staffId || null,
        status: s.status || "tolandan",
        debt_currency: s.debtCurrency || "uzs",
        debt_usd: s.debtUsd != null ? s.debtUsd : null,
        // Asl (o'zgarmas) qiymatlar — qarz to'lovlari bularga tegmaydi.
        // Bularsiz calcSaleState() boshqa qurilmada noto'g'ri ishlaydi.
        orig_paid: s.origPaid != null ? s.origPaid : (s.paid || 0),
        orig_remaining: s.origRemaining != null ? s.origRemaining : (s.remaining || 0),
        orig_debt_usd: s.origDebtUsd != null ? s.origDebtUsd : null
      })));
    } catch(e) { syncErrors.push("sales: " + e.message); console.warn("sync sales xato:", e.message); }

    try {
      await sync("ombor", db.ombor?.map(o => ({
        shop_id: sid, id: o.id, date: o.date,
        sku: o.sku || null,
        product_name: o.productName,
        unit: o.unit, color: o.color,
        size: o.size, qty: o.qty || 0,
        boxes: o.boxes || null,
        pantone: o.pantone || null,
        hex: o.hex || null,
        kirim_narxi: o.kirimNarxi || 0,
        chakana: o.chakana || 0,
        ulgurji: o.ulgurji || 0,
        supplier: o.supplier || null,
        partiya: o.partiya || null,
        pay_status: o.payStatus || "tolandan",
        barcode: o.barcode || null
      })));
    } catch(e) { syncErrors.push("ombor: " + e.message); console.warn("sync ombor xato:", e.message); }

    try {
      await sync("xarajatlar", (db.xarajatlar||[]).map(x => ({
        shop_id: sid, id: x.id, date: x.date,
        category: x.category,
        amount: x.amount || 0,
        note: x.note || null,
        recipient: x.recipient || null,
        paid_by: x.paidBy || null,
        method: x.method || null,
        amount_usd: x.amountUsd != null ? x.amountUsd : null,
        recurring: !!x.recurring,
        sub_category: x.subCategory || null,
        xarajat_type: x.xarajatType || null,
        for_month: x.forMonth || null
      })));
    } catch(e) { syncErrors.push("xarajatlar: " + e.message); console.warn("sync xarajatlar xato:", e.message); }

    // Chiqimlar (ombordan chiqim) — 2026-07 gacha push qilinmasdi (teshik edi)
    try {
      await sync("chiqimlar", (db.chiqimlar||[]).map(c => ({
        shop_id: sid, id: String(c.id),
        local_id: parseInt(c.id) || null,
        date: c.date, time: c.time || null,
        product_name: c.productName, sku: c.sku || null,
        color: c.color || null, size: c.size || null,
        qty: c.qty || 0, unit: c.unit || "dona",
        reason: c.reason || null, note: c.note || null,
        cost_uzs: Math.round(c.costUzs || 0),
        cost_usd_each: c.costUsdEach != null ? c.costUsdEach : null
      })));
    } catch(e) { syncErrors.push("chiqimlar: " + e.message); console.warn("sync chiqimlar xato:", e.message); }

    try {
      await sync("debt_payments", (db.debtPayments||[]).map(p => ({
        shop_id: sid,
        id: p.id,
        chek_num: p.chekNum || null,
        date: p.date,
        time: p.time || null,
        amount: p.amount || 0,
        currency: p.currency || "uzs",
        method: p.method || "naqd",
        customer_id: p.customerId || null,
        customer_name: p.customerName || null,
        customer_phone: p.customerPhone || null,
        staff_id: p.staffId || null,
        note: p.note || null,
        allocations: p.allocations || [],
        leftover: p.leftover || 0,
        leftover_to_balance: !!p.leftoverToBalance,
        debt_before: p.debtBefore != null ? p.debtBefore : null,
        debt_after:  p.debtAfter  != null ? p.debtAfter  : null,
        method_breakdown: p.methodBreakdown || null,
        rate: p.rate || null
      })));
    } catch(e) { syncErrors.push("debt_payments: " + e.message); console.warn("sync debt_payments xato:", e.message); }

    try {
      await sync("returns", (db.returns||[]).map(r => ({
        shop_id: sid, id: r.id,
        date: r.date, time: r.time || null,
        orig_sale_id: r.origSaleId || null,
        orig_chek_num: r.origChekNum || null,
        items: r.items || [],
        total: r.total || 0,
        reason: r.reason || null,
        customer_name: r.customerName || null,
        staff_id: r.staffId || null
      })));
    } catch(e) { syncErrors.push("returns: " + e.message); console.warn("sync returns xato:", e.message); }

    try {
      await sync("shifts", (db.shifts||[]).map(sh => ({
        shop_id: sid, id: sh.id,
        staff_id: sh.staffId || null,
        open_time: sh.openTime || null,
        open_date: sh.openDate || null,
        open_cash: sh.openCash || 0,
        note: sh.note || null,
        close_time: sh.closeTime || null,
        close_cash: sh.closeCash != null ? sh.closeCash : null,
        diff: sh.diff != null ? sh.diff : null
      })));
    } catch(e) { syncErrors.push("shifts: " + e.message); console.warn("sync shifts xato:", e.message); }

    try {
      await sync("suppliers", (db.suppliers||[]).map(s => ({
        shop_id: sid, id: s.id,
        name: s.name || null,
        phone: s.phone || null,
        note: s.note || null
      })));
    } catch(e) { syncErrors.push("suppliers: " + e.message); console.warn("sync suppliers xato:", e.message); }

    // ── O'CHIRISHLARNI SINXRONLASH ────────────────────────────────
    // Mantiq: pull'da bulutda KO'RILGAN (_cloudIds), lekin hozir lokalda
    // YO'Q yozuv = foydalanuvchi o'chirgan. Uni: (1) o'chirilganlar
    // daftariga (deleted_records) yozamiz — boshqa qurilmalarda ham
    // tirilmasin, (2) bulutdan o'chiramiz.
    // MUHIM: faqat O'ZIMIZ pull'da ko'rgan yozuvlar tekshiriladi —
    // boshqa qurilma shu orada qo'shgan yangi yozuvlarga tegilmaydi.
    try {
      const delMap = {
        products:      { rows: db.products,     key: "sku", col: "sku" },
        customers:     { rows: db.customers,    key: "id",  col: "id" },
        staff:         { rows: db.staff,        key: "id",  col: "id" },
        sales:         { rows: db.sales,        key: "id",  col: "id" },
        ombor:         { rows: db.ombor,        key: "id",  col: "id" },
        xarajatlar:    { rows: db.xarajatlar,   key: "id",  col: "id" },
        chiqimlar:     { rows: db.chiqimlar,    key: "id",  col: "id" },
        debt_payments: { rows: db.debtPayments, key: "id",  col: "id" },
        returns:       { rows: db.returns,      key: "id",  col: "id" },
        shifts:        { rows: db.shifts,       key: "id",  col: "id" },
        suppliers:     { rows: db.suppliers,    key: "id",  col: "id" }
      };
      for (const [table, cfg] of Object.entries(delMap)) {
        const seen = _cloudIds[table];
        if (!seen || seen.size === 0) continue;
        const localSet = new Set((cfg.rows||[]).map(r => String(r[cfg.key])));
        const gone = [...seen.entries()].filter(([k]) => !localSet.has(k));
        if (!gone.length) continue;
        // 1) daftarga yozamiz
        const { error: tErr } = await _sb.from("deleted_records").upsert(
          gone.map(([k]) => ({ shop_id: sid, table_name: table, record_id: k })),
          { onConflict: "shop_id,table_name,record_id" });
        if (tErr) { console.warn("deleted_records yozish xato:", tErr.message); continue; }
        // 2) bulutdan o'chiramiz (asl qiymatlar bilan, 50 talab)
        const rawVals = gone.map(([,v]) => v);
        for (let i = 0; i < rawVals.length; i += 50) {
          const { error: dErr } = await _sb.from(table)
            .delete().eq("shop_id", sid).in(cfg.col, rawVals.slice(i, i+50));
          if (dErr) { console.warn(`${table} delete xato:`, dErr.message); break; }
        }
        gone.forEach(([k]) => { seen.delete(k); _tombstones.add(table + ":" + k); });
        console.log(`🗑 ${table}: ${gone.length} ta o'chirish bulutga sinxronlandi`);
      }
    } catch(e) { console.warn("O'chirish sinxron xato:", e.message); }

    if (syncErrors.length > 0) {
      toast(`⚠️ Saqlandi, lekin xatolar: ${syncErrors.join("; ")}`, "err");
    } else {
      toast("✅ Barcha ma'lumotlar cloud ga saqlandi!");
    }
    updateCloudUI(true);
    // Oxirgi sync vaqtini saqlaymiz
    if (!db.settings) db.settings = {};
    db.settings.lastSyncAt = new Date().toISOString();
    saveDB();
    if (typeof adminRefreshSyncStats === "function") adminRefreshSyncStats();
  } catch(e) {
    toast("Xato: " + e.message, "err");
    console.error("Cloud push error:", e);
  }
}

// ── VERSIYA QO'RIQCHISI (2026-07) ──────────────────────────────
// index.html — versiyalar manifesti (7-qoida: JS bilan birga push).
// Qurilma serverdagi yangi index.html'ni keshsiz o'qib, o'zining
// cloud.js versiyasi bilan solishtiradi. Eski bo'lsa: ogohlantiradi
// va PUSH bloklanadi — eski kod bulutga yozolmaydi (telefon saboqi).
let _versionOk = null;
let _versionCheckedAt = 0;
let _verWarnAt = 0;
async function checkAppVersion() {
  if (_versionOk !== null && Date.now() - _versionCheckedAt < 10 * 60 * 1000)
    return _versionOk; // 10 daqiqada bir tekshirish yetadi
  try {
    const my = parseInt((document.querySelector('script[src*="cloud.js?v="]')
      ?.src.match(/v=(\d+)/) || [])[1]) || 0;
    const r = await fetch("/index.html", { cache: "no-store" });
    const html = await r.text();
    const srv = parseInt((html.match(/cloud\.js\?v=(\d+)/) || [])[1]) || 0;
    _versionOk = !srv || !my || my >= srv;
    _versionCheckedAt = Date.now();
    if (!_versionOk) {
      console.warn(`❗ ESKI VERSIYA: sizda cloud v${my}, serverda v${srv} — push bloklandi`);
      if (Date.now() - _verWarnAt > 60000 && typeof toast === "function") {
        _verWarnAt = Date.now();
        toast("⚠️ MERX yangilandi! Davom etishdan avval sahifani to'liq yangilang: Ctrl+Shift+R (telefonda: brauzer keshini tozalang)", "err");
      }
    }
  } catch(e) { _versionOk = true; _versionCheckedAt = Date.now(); } // tekshirib bo'lmasa — bloklamaymiz
  return _versionOk;
}

// ── Pull kafolati: muvaffaqiyatgacha qayta urinish ─────────────
// Pull o'tmasa push bloklangani uchun, bu funksiya pullni bir necha
// bor takrorlaydi (5s, 15s oraliq), keyin ham bo'lmasa har 60
// soniyada fonda urinib turadi — internet qaytishi bilan tiklanadi.
let _pullBusy = false;
async function ensureCloudPull(tries = 3) {
  const want = getCloudShopId();
  const ok = () => _cloudPullDone && _pulledShopId === want;
  if (_pullBusy || ok()) return ok();
  _pullBusy = true;
  try {
  for (let i = 0; i < tries && !ok(); i++) {
    if (i > 0) {
      console.warn(`Pull qayta urinish ${i}/${tries-1}...`);
      await new Promise(r => setTimeout(r, i * 10000 - 5000));
    }
    try { await pullFromCloud(); } catch(e) { console.warn("pull xato:", e.message); }
  }

  } finally { _pullBusy = false; }
  if (!ok()) {
    console.warn("Pull hali o'tmadi — 60 soniyadan keyin fonda yana urinamiz");
    setTimeout(() => { if (!ok()) ensureCloudPull(2); }, 60000);
  }
  return ok();
}

// ── Supabase → LocalDB ────────────────────────────
async function pullFromCloud() {
  if (!_sb) {
    const ok = await initSupabase();
    if (!ok) { toast("Avval ulaning","err"); return; }
  }
  // Versiya tekshiruvi (fonda — pull bloklanmaydi, faqat ogohlantiradi)
  checkAppVersion();

  // RLS: do'kon kontekstini o'rnatamiz
  const _pullSid = getCloudShopId();
  if (!_pullSid) {
    toast("Sinxronlash uchun avval tizimga kiring", "err");
    return;
  }
  await _setShopContext(_pullSid);

  try {
    toast("Cloud dan yuklanmoqda...", "info");

    const sid = _pullSid;

    // O'chirilganlar daftarini o'qiymiz — bular hech qachon tirilmasin
    _tombstones = new Set();
    _cloudIds = {};
    try {
      const { data: delRecs } = await _sb.from("deleted_records")
        .select("table_name,record_id").eq("shop_id", sid);
      (delRecs||[]).forEach(d => _tombstones.add(d.table_name + ":" + d.record_id));
    } catch(e) { console.warn("deleted_records o'qish xato:", e.message); }

    // MERGE uchun lokal holatni suratga olamiz: bulut yozuvlari ustun,
    // lekin lokaldagi hali bulutga yetib bormagan YANGI yozuvlar
    // (masalan, internet uzilganda qilingan sotuvlar) yo'qolmaydi.
    const _loc = {
      products:     db.products     || [],
      customers:    db.customers    || [],
      staff:        db.staff        || [],
      sales:        db.sales        || [],
      ombor:        db.ombor        || [],
      xarajatlar:   db.xarajatlar   || [],
      chiqimlar:    db.chiqimlar    || [],
      debtPayments: db.debtPayments || [],
      returns:      db.returns      || [],
      shifts:       db.shifts       || [],
      suppliers:    db.suppliers    || []
    };

    // Products — faqat bu do'kon
    const { data: prods } = await _sb.from("products").select("*").eq("shop_id", sid);
    _cloudIds["products"] = new Map((prods||[]).map(r => [String(r.sku), r.sku]));
    if (prods && prods.length > 0) {
      db.products = prods.map(p => ({
        shop_id: sid, id: p.id, // id SAQLANADI — busiz push filtri (p.id != null)
                                // pull'dan kelgan mahsulotlarni o'tkazmasdi va
                                // boshqa qurilmadagi TAHRIR bulutga qaytmasdi
        sku: p.sku, name: p.name, category: p.category || "",
        type: p.type || "oyoq", unit: p.unit || "dona",
        inBox: p.in_box || 1, art: p.art || "", barcode: p.barcode, image: p.image || null,
        costUsd: p.cost_usd || 0, priceUzs: p.price_uzs || 0,
        ulgurjiNarx: p.ulgurji || 0, variants: p.variants || [],
        image: p.image || null, pantone: p.pantone || null,
        colorName: p.color_name || null, hex: p.hex || null,
        colorImages: p.color_images || null
      }));
    }

    // Customers
    const { data: custs } = await _sb.from("customers").select("*").eq("shop_id", sid);
    _cloudIds["customers"] = new Map((custs||[]).map(r => [String(r.id), r.id]));
    if (custs && custs.length > 0) {
      db.customers = custs.map(c => ({
        id: c.id, name: c.name, phone: c.phone || "", phone2: c.phone2 || "",
        type: c.type || "ulgurji", note: c.note || "", company: c.company || "",
        telegramChatId: c.telegram_chat_id || null,
        importantNote: c.important_note || "", birthday: c.birthday || "",
        source: c.source || "", debtLimit: c.debt_limit || null,
        loyaltyPoints: c.loyalty_points || 0,
        balanceUzs: c.balance_uzs || 0, balanceUsd: c.balance_usd || 0
      }));
    }

    // Staff
    const { data: staffData } = await _sb.from("staff").select("*").eq("shop_id", sid);
    _cloudIds["staff"] = new Map((staffData||[]).map(r => [String(r.id), r.id]));
    if (staffData && staffData.length > 0) {
      db.staff = staffData.map(s => {
        const st = {
          id: s.id, name: s.name, phone: s.phone || "", role: s.role || "kassir",
          pin: s.pin || null, salary: s.salary || 0, bonusPct: s.bonus_pct || 0,
          monthTarget: s.month_target || 0,
          permDiscount: s.perm_discount || false, maxDiscount: s.max_discount || 0,
          permNasiya: s.perm_nasiya || false, permReturn: s.perm_return || false,
          paidMonths: s.paid_months || [], salaryHistory: s.salary_history || []
        };
        if (s.permissions) {
          try { st.permissions = typeof s.permissions === "string"
            ? JSON.parse(s.permissions) : s.permissions; } catch(e) {}
        }
        if (s.modules) {
          try { st.modules = typeof s.modules === "string"
            ? JSON.parse(s.modules) : s.modules; } catch(e) {}
        }
        return st;
      });
    }

    // Sales
    const { data: salesData } = await _sb.from("sales").select("*").eq("shop_id", sid).order("local_id");
    _cloudIds["sales"] = new Map((salesData||[]).map(r => [String(r.id), r.id]));
    if (salesData && salesData.length > 0) {
      db.sales = salesData.map(s => ({
        id: s.id, chekNum: s.chek_num, date: s.date, time: s.time,
        priceType: s.price_type, payType: s.pay_type,
        payBreakdown: s.pay_breakdown || null,
        staffId: s.staff_id, customerId: s.customer_id,
        items: s.items || [], subtotal: s.subtotal, discount: s.discount,
        total: s.total, paid: s.paid, remaining: s.remaining,
        due: s.due, customerName: s.customer_name,
        customerPhone: s.customer_phone, status: s.status,
        debtCurrency: s.debt_currency, debtUsd: s.debt_usd,
        note: s.note,
        origPaid: s.orig_paid != null ? s.orig_paid : s.paid,
        origRemaining: s.orig_remaining != null ? s.orig_remaining : s.remaining,
        origDebtUsd: s.orig_debt_usd != null ? s.orig_debt_usd : null
      }));
    }

    // Ombor
    const { data: omborData } = await _sb.from("ombor").select("*").eq("shop_id", sid).order("local_id");
    _cloudIds["ombor"] = new Map((omborData||[]).map(r => [String(r.id), r.id]));
    if (omborData && omborData.length > 0) {
      db.ombor = omborData.map(o => ({
        id: o.id, date: o.date, sku: o.sku,
        productName: o.product_name, unit: o.unit,
        color: o.color, size: o.size, qty: o.qty,
        boxes: o.boxes, pantone: o.pantone, hex: o.hex,
        kirimNarxi: o.kirim_narxi, ulgurji: o.ulgurji,
        supplier: o.supplier, partiya: o.partiya,
        payStatus: o.pay_status, barcode: o.barcode,
        pantone: o.pantone || null, hex: o.hex || null,
        chakana: o.chakana || 0
      }));
    }

    // Xarajatlar
    const { data: xarData } = await _sb.from("xarajatlar").select("*").eq("shop_id", sid).order("local_id");
    _cloudIds["xarajatlar"] = new Map((xarData||[]).map(r => [String(r.id), r.id]));
    if (xarData) {
      db.xarajatlar = xarData.map(x => ({
        id: x.id, date: x.date, category: x.category,
        amount: x.amount, amountUsd: x.amount_usd || null,
        recipient: x.recipient, paidBy: x.paid_by,
        method: x.method || "naqd", note: x.note,
        recurring: x.recurring || false,
        subCategory: x.sub_category || null,
        xarajatType: x.xarajat_type || null,
        forMonth: x.for_month || null
      }));
    }

    // Settings
    const { data: setsArr } = await _sb.from("settings").select("*").eq("shop_id", sid).limit(1);
    const sets = setsArr?.[0] || null;
    if (sets) {
      // MUHIM: db.shop ni butunlay almashtirmaymiz — type (do'kon turi)
      // kabi lokal maydonlar saqlanib qolishi kerak
      db.shop = { ...(db.shop || {}), name: sets.shop_name };
      db.settings.rate           = sets.rate || 12800;
      db.settings.priceCurrency  = sets.price_currency || "uzs";
      if (sets.shop_type) db.settings.shopType = sets.shop_type;
      db.settings.showChakana    = sets.show_chakana || false;
      if (sets.eskiz_token)    db.settings.eskizToken         = sets.eskiz_token;
      if (sets.eskiz_sender)   db.settings.eskizSender        = sets.eskiz_sender;
      if (sets.telegram_bot)   db.settings.telegramBotUrl     = sets.telegram_bot;
      if (sets.telegram_bot_username) db.settings.telegramBotUsername = sets.telegram_bot_username;
      if (sets.staff_group_id) db.settings.staffGroupId       = sets.staff_group_id;
      if (sets.loyalty_rate)   db.settings.loyaltyRate        = sets.loyalty_rate;
      if (sets.loyalty_value)  db.settings.loyaltyValue       = sets.loyalty_value;
      db.settings.rateMode      = sets.rate_mode === "auto" ? "auto" : "manual";
      if (sets.rate_updated_at) db.settings.rateUpdatedAt      = sets.rate_updated_at;
      if (sets.debt_pay_methods_shown) db.settings.debtPayMethodsShown = sets.debt_pay_methods_shown;
      if (sets.debt_cols)              db.settings.debtCols            = sets.debt_cols;
    }

    // Chiqimlar
    const { data: chiqData } = await _sb.from("chiqimlar").select("*").eq("shop_id", sid).order("local_id");
    _cloudIds["chiqimlar"] = new Map((chiqData||[]).map(r => [String(r.id), r.id]));
    if (chiqData && chiqData.length > 0) {
      db.chiqimlar = chiqData.map(c => ({
        id:          c.local_id || c.id,
        date:        c.date,
        time:        c.time || "",
        productName: c.product_name,
        sku:         c.sku || "",
        color:       c.color,
        size:        c.size,
        qty:         c.qty,
        unit:        c.unit || "dona",
        reason:      c.reason,
        note:        c.note || "",
        costUzs:     c.cost_uzs || 0
      }));
    }

    // Qarz to'lovlari
    const { data: payData } = await _sb.from("debt_payments").select("*").eq("shop_id", sid).order("created_at");
    _cloudIds["debt_payments"] = new Map((payData||[]).map(r => [String(r.id), r.id]));
    if (payData) {
      db.debtPayments = payData.map(p => ({
        id:        p.id,
        chekNum:   p.chek_num || null,
        saleId:    p.sale_id || null,
        date:      p.date,
        time:      p.time || null,
        amount:    p.amount || 0,
        currency:  p.currency || "uzs",
        method:    p.method || "naqd",
        staffId:   p.staff_id || null,
        note:      p.note || null,
        customerId:    p.customer_id || null,
        customerName:  p.customer_name || null,
        customerPhone: p.customer_phone || null,
        allocations:   p.allocations || [],
        debtBefore:    p.debt_before,
        debtAfter:     p.debt_after,
        methodBreakdown: p.method_breakdown || null,
        rate:            p.rate || null,
        leftover:      p.leftover || 0,
        leftoverToBalance: !!p.leftover_to_balance
      }));
    }

    // Qaytarilgan tovarlar
    const { data: retData } = await _sb.from("returns").select("*").eq("shop_id", sid).order("created_at");
    _cloudIds["returns"] = new Map((retData||[]).map(r => [String(r.id), r.id]));
    if (retData) {
      db.returns = retData.map(r => ({
        id: r.id, date: r.date, time: r.time || null,
        origSaleId: r.orig_sale_id || null,
        origChekNum: r.orig_chek_num || null,
        items: r.items || [],
        total: r.total || 0,
        reason: r.reason || null,
        customerName: r.customer_name || null,
        staffId: r.staff_id || null
      }));
    }

    // Kassa smenalari
    const { data: shiftData } = await _sb.from("shifts").select("*").eq("shop_id", sid).order("created_at");
    _cloudIds["shifts"] = new Map((shiftData||[]).map(r => [String(r.id), r.id]));
    if (shiftData) {
      db.shifts = shiftData.map(sh => ({
        id: sh.id, staffId: sh.staff_id || null,
        openTime: sh.open_time || null,
        openDate: sh.open_date || null,
        openCash: sh.open_cash || 0,
        note: sh.note || null,
        closeTime: sh.close_time || null,
        closeCash: sh.close_cash != null ? sh.close_cash : null,
        diff: sh.diff != null ? sh.diff : null
      }));
    }

    // Ta'minotchilar
    const { data: supData } = await _sb.from("suppliers").select("*").eq("shop_id", sid).order("created_at");
    _cloudIds["suppliers"] = new Map((supData||[]).map(r => [String(r.id), r.id]));
    if (supData) {
      db.suppliers = supData.map(s => ({
        id: s.id, name: s.name || "", phone: s.phone || "", note: s.note || ""
      }));
    }

    // ── MERGE: bulut + lokal yangi yozuvlar ──────────────────────
    // Bulutdagi yozuv ustun (bir xil id bo'lsa bulutniki qoladi),
    // bulutda YO'Q lokal yozuvlar saqlanadi va keyingi push bilan ketadi.
    const _mrg = (cur, old, key, table) => {
      cur = cur || []; old = old || [];
      const dead = (r) => _tombstones.has(table + ":" + String(r[key]));
      // Bulut ustun, lekin: (a) o'chirilganlar daftaridagilar chiqarib
      // tashlanadi, (b) bulutda yo'q lokal YANGI yozuvlar saqlanadi.
      cur = cur.filter(r => r && !dead(r));
      const seen = new Set(cur.map(r => String(r[key])));
      return cur.concat(old.filter(r => r && r[key] != null
        && !seen.has(String(r[key])) && !dead(r)));
    };
    db.products     = _mrg(db.products,     _loc.products,     "sku", "products");
    db.customers    = _mrg(db.customers,    _loc.customers,    "id",  "customers");
    db.staff        = _mrg(db.staff,        _loc.staff,        "id",  "staff");
    db.sales        = _mrg(db.sales,        _loc.sales,        "id",  "sales");
    db.ombor        = _mrg(db.ombor,        _loc.ombor,        "id",  "ombor");
    db.xarajatlar   = _mrg(db.xarajatlar,   _loc.xarajatlar,   "id",  "xarajatlar");
    db.chiqimlar    = _mrg(db.chiqimlar,    _loc.chiqimlar,    "id",  "chiqimlar");
    db.debtPayments = _mrg(db.debtPayments, _loc.debtPayments, "id",  "debt_payments");
    db.returns      = _mrg(db.returns,      _loc.returns,      "id",  "returns");
    db.shifts       = _mrg(db.shifts,       _loc.shifts,       "id",  "shifts");
    db.suppliers    = _mrg(db.suppliers,    _loc.suppliers,    "id",  "suppliers");

    // seq yangilash
    const maxId = Math.max(
      ...( db.products.map((_,i)=>i) ),
      ...(db.customers.map(c=>c.id||0)),
      ...(db.staff.map(s=>s.id||0)),
      ...(db.sales.map(s=>s.id||0)),
      ...(db.ombor.map(o=>o.id||0)),
      ...((db.xarajatlar||[]).map(x=>x.id||0)),
      ...((db.chiqimlar||[]).map(c=>c.id||0)),
      ...((db.debtPayments||[]).map(p=>p.id||0)),
      ...((db.returns||[]).map(r=>r.id||0)),
      ...((db.shifts||[]).map(sh=>sh.id||0)),
      ...((db.suppliers||[]).map(s=>s.id||0)),
      db.seq || 0
    );
    db.seq = maxId + 1;

    // Pull muvaffaqiyatli tugadi — endi push ga ruxsat beriladi
    _cloudPullDone = true;
    _pulledShopId = sid;

    // ── 4-BOSQICH: localStorage — faqat JORIY do'kon keshi ─────────
    // Boshqa do'konlarning eski nusxalarini o'chiramiz:
    //  (1) umumiy kompyuterda begona do'kon ma'lumoti qolmaydi (maxfiylik),
    //  (2) do'konlararo qoldiq/aralashish manbalari butunlay yopiladi.
    // Bulut — yagona haqiqat: kerak bo'lsa pull qayta to'ldiradi.
    try {
      const _curKey = "merx_v5_" + sid;
      Object.keys(localStorage)
        .filter(k => (k.indexOf("merx_v5") === 0) && k !== _curKey)
        .forEach(k => {
          localStorage.removeItem(k);
          console.log("🧹 Boshqa do'kon keshi tozalandi:", k);
        });
    } catch(e) { console.warn("kesh tozalash xato:", e.message); }

    saveDB();
    updateCloudUI(true);
    nav("dashboard");
    toast("✅ Cloud dan yuklandi! Dashboard yangilandi.");
  } catch(e) {
    toast("Yuklash xatosi: " + e.message, "err");
    console.error("Cloud pull error:", e);
  }
}

// ── Auto-sync: saveDB() chaqirilganda ────────────
let _syncTimer = null;
let _syncPending = false;

function scheduleCloudSync() {
  if (!_sb) return;
  _syncPending = true;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    if (!_syncPending) return;
    _syncPending = false;
    try { await pushToCloud(); } catch(e) { console.warn("scheduleCloudSync push xato:", e.message); }
    const txt = $("cloud-txt");
    if (txt) {
      txt.textContent = "Saqlandi ✓";
      setTimeout(() => { if (txt) txt.textContent = "Cloud"; }, 2000);
    }
  }, 5000); // 5 soniya — bir nechta o'zgarish birlashtirilib yuboriladi
}
