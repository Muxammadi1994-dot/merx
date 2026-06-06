// ================================================
// MERX — js/cloud.js  (v2 — Supabase sync)
// ================================================

let _sb = null; // Supabase client

// ── Supabase clientini yaratish ───────────────────
async function initSupabase() {
  const url = db.settings?.supabaseUrl?.trim();
  const key = db.settings?.supabaseKey?.trim();
  if (!url || !key) return false;

  try {
    const { createClient } = supabase;
    _sb = createClient(url, key);
    // Test ulanish
    const { error } = await _sb.from("settings").select("id").limit(1);
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

  try {
    // Settings
    await _sb.from("settings").upsert({
      id: 1,
      shop_name:      db.shop?.name || "MERX",
      rate:           db.settings?.rate || 12800,
      price_currency: db.settings?.priceCurrency || "uzs",
      shop_type:      db.settings?.shopType || "ikki",
      show_chakana:   db.settings?.showChakana || false,
      eskiz_token:    db.settings?.eskizToken || null,
      eskiz_sender:   db.settings?.eskizSender || null,
    });

    // Products
    if (db.products?.length) {
      const rows = db.products.map(p => ({
        id: p.id || p.sku,
        sku: p.sku, name: p.name, category: p.category,
        type: p.type, unit: p.unit, in_box: p.inBox || 1,
        barcode: p.barcode, cost_usd: p.costUsd || 0,
        price_uzs: p.priceUzs || 0, ulgurji: p.ulgurjiNarx || 0,
        variants: p.variants || []
      }));
      await _sb.from("products").upsert(rows);
    }

    // Customers
    if (db.customers?.length) {
      await _sb.from("customers").upsert(db.customers.map(c => ({
        id: c.id, name: c.name, phone: c.phone || null,
        type: c.type || "ulgurji", note: c.note || null
      })));
    }

    // Staff
    if (db.staff?.length) {
      await _sb.from("staff").upsert(db.staff.map(s => ({
        id: s.id, name: s.name, phone: s.phone || null, role: s.role || "kassir"
      })));
    }

    // Sales
    if (db.sales?.length) {
      await _sb.from("sales").upsert(db.sales.map(s => ({
        id: s.id, chek_num: s.chekNum || null,
        date: s.date, time: s.time || null,
        price_type: s.priceType, pay_type: s.payType,
        staff_id: s.staffId || null, customer_id: s.customerId || null,
        items: s.items || [], subtotal: s.subtotal || s.total || 0,
        discount: s.discount || 0, total: s.total || 0,
        paid: s.paid || 0, remaining: s.remaining || 0,
        due: s.due || null, customer_name: s.customerName || null,
        customer_phone: s.customerPhone || null,
        status: s.status || "tolandan",
        debt_currency: s.debtCurrency || "uzs",
        debt_usd: s.debtUsd || null, note: s.note || null
      })));
    }

    // Ombor
    if (db.ombor?.length) {
      await _sb.from("ombor").upsert(db.ombor.map(o => ({
        id: o.id, date: o.date, sku: o.sku || null,
        product_name: o.productName, unit: o.unit,
        color: o.color, size: o.size, qty: o.qty || 0,
        boxes: o.boxes || null, pantone: o.pantone || null,
        hex: o.hex || null, kirim_narxi: o.kirimNarxi || 0,
        ulgurji: o.ulgurji || 0, supplier: o.supplier || null,
        partiya: o.partiya || null, pay_status: o.payStatus || "tolandan",
        barcode: o.barcode || null
      })));
    }

    // Xarajatlar
    if (db.xarajatlar?.length) {
      await _sb.from("xarajatlar").upsert((db.xarajatlar||[]).map(x => ({
        id: x.id, date: x.date, category: x.category,
        amount: x.amount || 0, recipient: x.recipient || null,
        paid_by: x.paidBy || null, note: x.note || null
      })));
    }

    toast("✅ Barcha ma'lumotlar cloud ga saqlandi!");
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

    // Products
    const { data: prods } = await _sb.from("products").select("*");
    if (prods) {
      db.products = prods.map(p => ({
        sku: p.sku, name: p.name, category: p.category || "",
        type: p.type || "oyoq", unit: p.unit || "dona",
        inBox: p.in_box || 1, barcode: p.barcode,
        costUsd: p.cost_usd || 0, priceUzs: p.price_uzs || 0,
        ulgurjiNarx: p.ulgurji || 0, variants: p.variants || []
      }));
    }

    // Customers
    const { data: custs } = await _sb.from("customers").select("*");
    if (custs) {
      db.customers = custs.map(c => ({
        id: c.id, name: c.name, phone: c.phone || "",
        type: c.type || "ulgurji", note: c.note || ""
      }));
    }

    // Staff
    const { data: staffData } = await _sb.from("staff").select("*");
    if (staffData) {
      db.staff = staffData.map(s => ({
        id: s.id, name: s.name, phone: s.phone || "", role: s.role || "kassir"
      }));
    }

    // Sales
    const { data: salesData } = await _sb.from("sales").select("*").order("id");
    if (salesData) {
      db.sales = salesData.map(s => ({
        id: s.id, chekNum: s.chek_num, date: s.date, time: s.time,
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
    const { data: omborData } = await _sb.from("ombor").select("*").order("id");
    if (omborData) {
      db.ombor = omborData.map(o => ({
        id: o.id, date: o.date, sku: o.sku,
        productName: o.product_name, unit: o.unit,
        color: o.color, size: o.size, qty: o.qty,
        boxes: o.boxes, pantone: o.pantone, hex: o.hex,
        kirimNarxi: o.kirim_narxi, ulgurji: o.ulgurji,
        supplier: o.supplier, partiya: o.partiya,
        payStatus: o.pay_status, barcode: o.barcode
      }));
    }

    // Xarajatlar
    const { data: xarData } = await _sb.from("xarajatlar").select("*").order("id");
    if (xarData) {
      db.xarajatlar = xarData.map(x => ({
        id: x.id, date: x.date, category: x.category,
        amount: x.amount, recipient: x.recipient,
        paidBy: x.paid_by, note: x.note
      }));
    }

    // Settings
    const { data: sets } = await _sb.from("settings").select("*").eq("id",1).single();
    if (sets) {
      db.shop = { name: sets.shop_name };
      db.settings.rate           = sets.rate || 12800;
      db.settings.priceCurrency  = sets.price_currency || "uzs";
      db.settings.shopType       = sets.shop_type;
      db.settings.showChakana    = sets.show_chakana || false;
      if (sets.eskiz_token)  db.settings.eskizToken  = sets.eskiz_token;
      if (sets.eskiz_sender) db.settings.eskizSender = sets.eskiz_sender;
    }

    // seq yangilash
    const maxId = Math.max(
      ...( db.products.map((_,i)=>i) ),
      ...(db.customers.map(c=>c.id||0)),
      ...(db.staff.map(s=>s.id||0)),
      ...(db.sales.map(s=>s.id||0)),
      ...(db.ombor.map(o=>o.id||0)),
      ...((db.xarajatlar||[]).map(x=>x.id||0)),
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

// ── Auto-sync: har sotuv/saqlashda ───────────────
async function autoSync(table, data) {
  if (!_sb) return;
  try {
    await _sb.from(table).upsert(data);
  } catch(e) {
    console.warn("Auto-sync xato:", e.message);
  }
}
