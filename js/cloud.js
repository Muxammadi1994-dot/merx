// MERX cloud.js | v2.3 | 2026-06-11
// ================================================
// MERX — js/cloud.js  (v2 — Supabase sync)
// ================================================

let _sb = null; // Supabase client

// ── Supabase clientini yaratish ───────────────────
// ── Shop ID — multi-tenant izolyatsiya ───────────
function getCloudShopId() {
  // Do'kon ID si — Supabase da barcha jadvallar shu ID bilan filtrlanadi
  // Avval settings da saqlangan shopId, aks holda URL hash dan olamiz
  if (db.settings?.cloudShopId) return db.settings.cloudShopId;
  // Yangi do'kon — URL dan olamiz (agar SA do'kon bo'lsa)
  const activeKey = localStorage.getItem("merx_active_shop");
  if (activeKey && activeKey !== "merx_v5") {
    // SA tomonidan yaratilgan do'kon — shopId = dbKey
    return activeKey;
  }
  // Asosiy do'kon — Supabase URL dan hash olamiz
  const url = db.settings?.supabaseUrl || "";
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : "default";
}

async function initSupabase() {
  const url = db.settings?.supabaseUrl?.trim();
  const key = db.settings?.supabaseKey?.trim();
  if (!url || !key) return false;

  try {
    const { createClient } = window.supabase || supabase;
    _sb = createClient(url, key, { auth: { persistSession: false } });
    // Test ulanish
    const { data, error } = await _sb.from("settings").select("id").limit(1);
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
async function connectCloud() {
  const url = ($("s-sup-url")||{value:""}).value.trim();
  const key = ($("s-sup-key")||{value:""}).value.trim();
  if (!url || !key) { toast("URL va Key kiriting","err"); return; }

  db.settings.supabaseUrl = url;
  db.settings.supabaseKey = key;
  saveDB();

  toast("Ulanmoqda...", "info");
  const ok = await initSupabase();
  if (!ok) { toast("Ulanmadi — URL/Key ni tekshiring","err"); return; }

  toast("Sinxronlash boshlandi...", "info");
  await pushToCloud();
}

// ── LocalDB → Supabase ────────────────────────────
async function pushToCloud() {
  if (!_sb) { toast("Avval ulaning","err"); return; }
  const sid = getCloudShopId();
  try {
    // Settings
    await _sb.from("settings").upsert({
      id: 1, shop_name: db.shop?.name || "MERX",
      rate: db.settings?.rate || 12800,
      price_currency: db.settings?.priceCurrency || "uzs"
    });

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
        const batch = customers.slice(i, i+chunk).map(c => ({
          id: c.id, name: c.name,
          phone: c.phone || null,
          type: c.type || "ulgurji"
        }));
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
        sku: p.sku, name: p.name,
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
      await sync("staff", db.staff?.map(s => ({
        id: s.id, name: s.name,
        phone: s.phone || null,
        role: s.role || "kassir"
      })));
    } catch(e) { syncErrors.push("staff: " + e.message); console.warn("sync staff xato:", e.message); }

    try {
      await sync("sales", db.sales?.map(s => ({
        id: s.id,
        chek_num: s.chekNum || null,
        date: s.date, time: s.time || null,
        price_type: s.priceType, pay_type: s.payType,
        items: (s.items || []).map(({ image, ...rest }) => rest), // image base64 ni Supabase ga yubormaymiz (juda katta)
        total: s.total || 0, paid: s.paid || 0,
        remaining: s.remaining || 0,
        due: s.due || null,
        customer_name: s.customerName || null,
        customer_phone: s.customerPhone || null,
        status: s.status || "tolandan"
      })));
    } catch(e) { syncErrors.push("sales: " + e.message); console.warn("sync sales xato:", e.message); }

    try {
      await sync("ombor", db.ombor?.map(o => ({
        id: o.id, date: o.date,
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
        id: x.id, date: x.date,
        category: x.category,
        amount: x.amount || 0,
        note: x.note || null
      })));
    } catch(e) { syncErrors.push("xarajatlar: " + e.message); console.warn("sync xarajatlar xato:", e.message); }

    try {
      await sync("debt_payments", (db.debtPayments||[]).map(p => ({
        id: p.id,
        chek_num: p.chekNum,
        date: p.date, time: p.time || null,
        customer_id: p.customerId || null,
        customer_name: p.customerName || null,
        customer_phone: p.customerPhone || null,
        amount: p.amount || 0,
        currency: p.currency || "uzs",
        allocations: p.allocations || [],
        leftover: p.leftover || 0
      })));
    } catch(e) { syncErrors.push("debt_payments: " + e.message); console.warn("sync debt_payments xato:", e.message); }

    if (syncErrors.length > 0) {
      toast(`⚠️ Saqlandi, lekin xatolar: ${syncErrors.join("; ")}`, "err");
    } else {
      toast("✅ Barcha ma'lumotlar cloud ga saqlandi!");
    }
    updateCloudUI(true);
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
        sku: p.sku, name: p.name, category: p.category || "",
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
        id: c.local_id || c.id, name: c.name, phone: c.phone || "",
        type: c.type || "ulgurji", note: c.note || "",
        telegramChatId: c.telegram_chat_id || null
      }));
    }

    // Staff
    const { data: staffData } = await _sb.from("staff").select("*").eq("shop_id", sid);
    if (staffData && staffData.length > 0) {
      db.staff = staffData.map(s => ({
        id: s.local_id || s.id, name: s.name, phone: s.phone || "", role: s.role || "kassir", pin: s.pin || null
      }));
    }

    // Sales
    const { data: salesData } = await _sb.from("sales").select("*").eq("shop_id", sid).order("local_id");
    if (salesData && salesData.length > 0) {
      db.sales = salesData.map(s => ({
        id: s.local_id || s.id, chekNum: s.chek_num, date: s.date, time: s.time,
        priceType: s.price_type, payType: s.pay_type,
        staffId: s.staff_id, customerId: s.customer_id,
        items: s.items || [], subtotal: s.subtotal, discount: s.discount,
        total: s.total, paid: s.paid, remaining: s.remaining,
        due: s.due, customerName: s.customer_name,
        customerPhone: s.customer_phone, status: s.status,
        debtCurrency: s.debt_currency, debtUsd: s.debt_usd,
        note: s.note
      }));
    }

    // Ombor
    const { data: omborData } = await _sb.from("ombor").select("*").eq("shop_id", sid).order("local_id");
    if (omborData && omborData.length > 0) {
      db.ombor = omborData.map(o => ({
        id: o.local_id || o.id, date: o.date, sku: o.sku,
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
        id: x.local_id || x.id, date: x.date, category: x.category,
        amount: x.amount, recipient: x.recipient,
        paidBy: x.paid_by, note: x.note
      }));
    }

    // Settings
    const { data: sets } = await _sb.from("settings").select("*").eq("id", sid).single();
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
    const { data: payData } = await _sb.from("debt_payments").select("*").order("id");
    if (payData) {
      db.debtPayments = payData.map(p => ({
        id:            p.id,
        chekNum:       p.chek_num,
        date:          p.date,
        time:          p.time || "",
        customerId:    p.customer_id,
        customerName:  p.customer_name,
        customerPhone: p.customer_phone,
        amount:        p.amount || 0,
        currency:      p.currency || "uzs",
        allocations:   p.allocations || [],
        leftover:      p.leftover || 0
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
