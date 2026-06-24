// MERX cloud.js | v2.3 | 2026-06-11
// ================================================
// MERX — js/cloud.js  (v2 — Supabase sync)
// ================================================

let _sb = null; // Supabase client

// ── Supabase clientini yaratish ───────────────────
// ── Shop ID — multi-tenant izolyatsiya ───────────
function getCloudShopId() {
  // 1. Auth session dan (eng ishonchli manba)
  if (typeof getShopId === "function") return getShopId();
  // 2. db.settings da saqlangan
  if (db.settings?.cloudShopId) return db.settings.cloudShopId;
  // 3. Supabase URL dan hash (eski usul)
  const url = db.settings?.supabaseUrl || "";
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : "default";
}

async function initSupabase() {
  // 1. settings dan, 2. global config dan
  const url = (db.settings?.supabaseUrl?.trim()) || 
              (typeof MERX_SUPABASE_URL !== "undefined" ? MERX_SUPABASE_URL : "");
  const key = (db.settings?.supabaseKey?.trim()) || 
              (typeof MERX_SUPABASE_KEY !== "undefined" ? MERX_SUPABASE_KEY : "");
  if (!url || !key) return false;
  // Settings ga ham yozamiz (bo'lmasa)
  if (db.settings && !db.settings.supabaseUrl) {
    db.settings.supabaseUrl = url;
    db.settings.supabaseKey = key;
  }

  try {
    const { createClient } = window.supabase || supabase;
    _sb = createClient(url, key, { auth: { persistSession: false } });

    // Test ulanish — shops jadvalini tekshiramiz (har doim mavjud)
    const { error } = await _sb.from("shops").select("id").limit(1);
    if (error) {
      // shops yo'q bo'lsa — eski schema, settings dan tekshiramiz
      const { error: e2 } = await _sb.from("settings").select("id").limit(1);
      if (e2) throw e2;
    }

    // Do'konni shops jadvaliga ro'yxatdan o'tkazish
    const sid = getCloudShopId();
    if (sid && sid !== "local") {
      try {
        const { data: shop } = await _sb.from("shops").select("id").eq("id", sid).single();
        if (!shop) {
          const auth = typeof getAuthUser === "function" ? getAuthUser() : null;
          await _sb.from("shops").upsert({
            id:          sid,
            name:        db.shop?.name || "MERX Do'koni",
            owner_email: auth?.email || "",
            active:      true
          });
        }
      } catch(e) {
        // shops jadvali yo'q (eski schema) — davom etamiz
        console.warn("shops jadvali topilmadi, eski schema bo'lishi mumkin");
      }
    }

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
async function connectCloud() {
  const url = ($("s-sup-url")||{value:""}).value.trim();
  const key = ($("s-sup-key")||{value:""}).value.trim();
  if (!url || !key) { toast("URL va Key kiriting","err"); return; }
  if (!url.includes("supabase.co") && !url.includes("localhost")) {
    toast("URL noto'g'ri — https://xxxx.supabase.co bo'lishi kerak","err"); return;
  }

  db.settings.supabaseUrl = url;
  db.settings.supabaseKey = key;
  saveDB();

  toast("Ulanmoqda...", "info");
  const ok = await initSupabase();
  if (!ok) {
    toast("Ulanmadi — URL va Key ni tekshiring. Console da batafsil xato bor.", "err");
    return;
  }

  toast("✅ Ulandi! Sinxronlash boshlandi...", "info");
  await pushToCloud();
}

// ── LocalDB → Supabase ────────────────────────────
async function pushToCloud() {
  if (!_sb) { toast("Avval ulaning","err"); return; }
  const sid = getCloudShopId();
  try {
    // Settings
    // Settings — eski schema id=1, yangi schema shop_id
    try {
      await _sb.from("settings").upsert({
        shop_id: sid,
        shop_name: db.shop?.name || "MERX",
        rate: db.settings?.rate || 12800,
        price_currency: db.settings?.priceCurrency || "uzs"
      });
    } catch(e) {
      // Eski schema — id bilan urinib ko'ramiz
      try {
        await _sb.from("settings").upsert({
          id: 1,
          shop_name: db.shop?.name || "MERX",
          rate: db.settings?.rate || 12800,
          price_currency: db.settings?.priceCurrency || "uzs"
        });
      } catch(e2) { console.warn("settings sync xato:", e2.message); }
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
          if (c.loyaltyPoints !== undefined) row.loyalty_points = c.loyaltyPoints || 0;
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
      const prodRows = db.products?.map(p => ({
        shop_id: sid, sku: p.sku, name: p.name,
        category: p.category, type: p.type,
        unit: p.unit || "dona",
        art: p.art || "",
        cost_usd: p.costUsd || 0,
        price_uzs: p.priceUzs || 0,
        ulgurji: p.ulgurjiNarx || 0,
        variants: p.variants || [],
        image: p.image || null
      }));
      if (prodRows?.length) {
        const chunk = 20; // image katta bo'lgani uchun kichik chunk
        for (let i = 0; i < prodRows.length; i += chunk) {
          const { error } = await _sb.from("products")
            .upsert(prodRows.slice(i, i+chunk), { onConflict: "sku,shop_id", ignoreDuplicates: false });
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
        return {
          shop_id: sid, id: s.id, name: s.name,
          phone: s.phone || null,
          role: s.role || "kassir"
        };
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
        product_name: o.productName,
        unit: o.unit, color: o.color,
        size: o.size, qty: o.qty || 0,
        kirim_narxi: o.kirimNarxi || 0,
        ulgurji: o.ulgurji || 0,
        supplier: o.supplier || null,
        pay_status: o.payStatus || "tolandan"
      })));
    } catch(e) { syncErrors.push("ombor: " + e.message); console.warn("sync ombor xato:", e.message); }

    try {
      await sync("xarajatlar", (db.xarajatlar||[]).map(x => ({
        shop_id: sid, id: x.id, date: x.date,
        category: x.category,
        amount: x.amount || 0,
        note: x.note || null
      })));
    } catch(e) { syncErrors.push("xarajatlar: " + e.message); console.warn("sync xarajatlar xato:", e.message); }

    try {
      await sync("debt_payments", (db.debtPayments||[]).map(p => ({
        shop_id: sid,
        id: p.id,
        date: p.date,
        amount: p.amount || 0,
        currency: p.currency || "uzs",
        method: p.method || "naqd"
      })));
    } catch(e) { syncErrors.push("debt_payments: " + e.message); console.warn("sync debt_payments xato:", e.message); }

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

// ── Supabase → LocalDB ────────────────────────────
async function pullFromCloud() {
  if (!_sb) {
    const ok = await initSupabase();
    if (!ok) { toast("Avval ulaning","err"); return; }
  }

  try {
    toast("Cloud dan yuklanmoqda...", "info");

    const sid = getCloudShopId();

    // Products — faqat bu do'kon
    const { data: prods } = await _sb.from("products").select("*").eq("shop_id", sid);
    if (prods && prods.length > 0) {
      db.products = prods.map(p => ({
        shop_id: sid, sku: p.sku, name: p.name, category: p.category || "",
        type: p.type || "oyoq", unit: p.unit || "dona",
        inBox: p.in_box || 1, art: p.art || "", barcode: p.barcode, image: p.image || null,
        costUsd: p.cost_usd || 0, priceUzs: p.price_uzs || 0,
        ulgurjiNarx: p.ulgurji || 0, variants: p.variants || [],
        image: p.image || null, pantone: p.pantone || null,
        colorName: p.color_name || null, hex: p.hex || null
      }));
    }

    // Customers
    const { data: custs } = await _sb.from("customers").select("*").eq("shop_id", sid);
    if (custs && custs.length > 0) {
      db.customers = custs.map(c => ({
        id: c.id, name: c.name, phone: c.phone || "", phone2: c.phone2 || "",
        type: c.type || "ulgurji", note: c.note || "", company: c.company || "",
        importantNote: c.important_note || "", birthday: c.birthday || "",
        source: c.source || "", debtLimit: c.debt_limit || null,
        loyaltyPoints: c.loyalty_points || 0,
        balanceUzs: c.balance_uzs || 0, balanceUsd: c.balance_usd || 0
      }));
    }

    // Staff
    const { data: staffData } = await _sb.from("staff").select("*").eq("shop_id", sid);
    if (staffData && staffData.length > 0) {
      db.staff = staffData.map(s => ({
        id: s.id, name: s.name, phone: s.phone || "", role: s.role || "kassir",
        pin: s.pin || null, salary: s.salary || 0, bonusPct: s.bonus_pct || 0,
        monthTarget: s.month_target || 0,
        permDiscount: s.perm_discount || false, maxDiscount: s.max_discount || 0,
        permNasiya: s.perm_nasiya || false, permReturn: s.perm_return || false,
        paidMonths: s.paid_months || [], salaryHistory: s.salary_history || []
      }));
    }

    // Sales
    const { data: salesData } = await _sb.from("sales").select("*").eq("shop_id", sid).order("local_id");
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
    if (xarData) {
      db.xarajatlar = xarData.map(x => ({
        id: x.id, date: x.date, category: x.category,
        amount: x.amount, amountUsd: x.amount_usd || null,
        recipient: x.recipient, paidBy: x.paid_by,
        method: x.method || "naqd", note: x.note,
        recurring: x.recurring || false
      }));
    }

    // Settings
    const { data: sets } = await _sb.from("settings").select("*").eq("shop_id", sid).single();
    if (sets) {
      db.shop = { name: sets.shop_name };
      db.settings.rate           = sets.rate || 12800;
      db.settings.priceCurrency  = sets.price_currency || "uzs";
      db.settings.shopType       = sets.shop_type;
      db.settings.showChakana    = sets.show_chakana || false;
      if (sets.eskiz_token)  db.settings.eskizToken  = sets.eskiz_token;
      if (sets.eskiz_sender) db.settings.eskizSender = sets.eskiz_sender;
    }

    // Chiqimlar
    const { data: chiqData } = await _sb.from("chiqimlar").select("*").eq("shop_id", sid).order("local_id");
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
    if (payData) {
      db.debtPayments = payData.map(p => ({
        id:       p.id,
        saleId:   p.sale_id || null,
        date:     p.date,
        amount:   p.amount || 0,
        currency: p.currency || "uzs",
        method:   p.method || "naqd",
        staffId:  p.staff_id || null,
        note:     p.note || null
      }));
    }

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
      db.seq || 0
    );
    db.seq = maxId + 1;

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
    await pushToCloud();
    const txt = $("cloud-txt");
    if (txt) {
      txt.textContent = "Saqlandi ✓";
      setTimeout(() => { if (txt) txt.textContent = "Cloud"; }, 2000);
    }
  }, 5000); // 5 soniya — bir nechta o'zgarish birlashtirilib yuboriladi
}
