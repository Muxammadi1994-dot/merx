// MERX egasi.js (admin.js) | v4.0 | 2026-06-24
// ================================================
// Admin Sozlamalar — Tab tizimi
// Tablar: dokon | narx | cloud | sms | tizim
// ================================================

// ── Aktiv tab ────────────────────────────────────
let _adminTab = "dokon";

function adminTabSwitch(tab) {
  _adminTab = tab;
  document.querySelectorAll(".adm-tab-btn").forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("adm-tab-on", on);
  });
  document.querySelectorAll(".adm-tab-pane").forEach(p => {
    p.style.display = p.dataset.tab === tab ? "block" : "none";
  });
}

// ── saveSetting — o'zgarmadi ──────────────────────
function saveSetting(key, val) {
  if (!db.settings) db.settings = {};
  db.settings[key] = val;
  saveDB();
  if (key === "priceCurrency") {
    document.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === val));
    if (typeof updateCostCurrency === "function") updateCostCurrency();
    if (typeof updateRatePill     === "function") updateRatePill();
    if (typeof renderKatalog      === "function") renderKatalog();
    if (typeof renderPosGrid      === "function") renderPosGrid();
  }
  if (key === "rate") {
    if (typeof updateRatePill === "function") updateRatePill();
  }
  if (key === "name") {
    if (!db.shop) db.shop = {};
    db.shop.name = val;
    const sbShop = document.getElementById("sb-shop");
    if (sbShop) sbShop.textContent = val;
    saveDB();
  }
  if (key === "telegramBotUrl") {
    _updateTgBadge(!!val);
  }
}

function _updateTgBadge(has) {
  const b = document.getElementById("tg-bot-status-badge");
  if (!b) return;
  b.textContent = has ? "Sozlangan ✅" : "Sozlanmagan";
  b.className   = has ? "bg bg-g"      : "bg bg-gr";
}

// ── Admin login ma'lumotlarini saqlash ────────────
function saveAdminCreds() {
  const email = ($("s-admin-email")||{value:""}).value.trim().toLowerCase();
  const pass  = ($("s-admin-pass") ||{value:""}).value;
  if (!email) { toast("Email kiriting","err"); return; }
  if (pass && pass.length < 4) { toast("Parol kamida 4 ta belgi","err"); return; }
  if (!db.settings) db.settings = {};
  db.settings.adminEmail = email;
  if (pass) db.settings.adminPass = pass;
  if (typeof getAuthUser === "function") {
    const u = getAuthUser();
    if (u) { u.email = email; if (typeof authSave === "function") authSave(u); }
  }
  saveDB();
  if ($("s-admin-pass")) $("s-admin-pass").value = "";
  toast("✅ Login ma'lumotlari saqlandi");
}

// ── renderEgasi (renderAdmin) — barcha tablarni to'ldiradi ──
function renderEgasi() {
  // ── DO'KON TAB ──
  if ($("s-name"))      $("s-name").value      = db.shop?.name || db.settings?.name || "";
  if ($("s-low-stock")) $("s-low-stock").value = db.settings?.lowStockLimit || 5;

  // Do'kon turi — faqat ko'rish (superadmin belgilaydi)
  const shopTypeEl = $("s-shop-type-display");
  if (shopTypeEl) {
    const typeLabels = {
      oyoq:    "👟 Faqat Oyoq kiyim",
      kiyim:   "👕 Faqat Kiyim-kechak",
      ikki:    "🧩 Oyoq kiyim + Kiyim",
      aralash: "🔀 Aralash (boshqa)"
    };
    const t = db.settings?.shopType || db.shop?.type || "ikki";
    shopTypeEl.textContent = typeLabels[t] || t;
  }

  // Kam qoldiq hisob
  const lsCount = $("s-low-stock-count");
  if (lsCount) {
    const th  = db.settings?.lowStockLimit || 5;
    let   cnt = 0;
    (db.products||[]).forEach(p => p.variants?.forEach(v => { if ((v.qty||0) <= th) cnt++; }));
    lsCount.textContent = cnt;
  }

  // ── NARX TAB ──
  if ($("s-rate")) $("s-rate").value = db.settings?.rate || 12800;
  const cur = db.settings?.priceCurrency || "uzs";
  document.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === cur));
  if ($("s-loyalty-rate"))  $("s-loyalty-rate").value  = db.settings?.loyaltyRate  || "";
  if ($("s-loyalty-value")) $("s-loyalty-value").value = db.settings?.loyaltyValue || 100;

  // ── CLOUD TAB ──
  const url = db.settings?.supabaseUrl || "";
  const key = db.settings?.supabaseKey || "";
  if ($("s-sup-url")) $("s-sup-url").value = url;
  if ($("s-sup-key")) $("s-sup-key").value = key;
  const cloudBadge = $("cloud-status-badge");
  if (cloudBadge) {
    cloudBadge.textContent = (url && key) ? "Ulangan ✅" : "Ulanmagan";
    cloudBadge.className   = (url && key) ? "bg bg-g"    : "bg bg-gr";
  }

  // ── SMS TAB ──
  if ($("s-eskiz-token"))  $("s-eskiz-token").value  = db.settings?.eskizToken  || "";
  if ($("s-eskiz-sender")) $("s-eskiz-sender").value = db.settings?.eskizSender || "";
  if (typeof updateSmsUI === "function") updateSmsUI();

  // Telegram
  if ($("s-tg-bot-url"))      $("s-tg-bot-url").value      = db.settings?.telegramBotUrl      || "";
  if ($("s-tg-bot-username")) $("s-tg-bot-username").value = db.settings?.telegramBotUsername || "";
  if ($("s-staff-group-id"))  $("s-staff-group-id").value  = db.settings?.staffGroupId        || "";
  _updateTgBadge(!!db.settings?.telegramBotUrl);

  // ── TIZIM TAB ──
  if ($("s-admin-email")) $("s-admin-email").value = db.settings?.adminEmail || "";
  if ($("s-admin-pass"))  $("s-admin-pass").value  = "";

  // Login ma'lumoti (do'kon egasiga berish uchun)
  const loginInfo = $("s-login-info");
  if (loginInfo) {
    loginInfo.textContent = db.settings?.adminEmail || "—";
  }

  if (typeof updateCostCurrency === "function") updateCostCurrency();

  // Statistika yangilash
  adminRefreshStats();
  adminRefreshSyncStats();
  // Birinchi tabni aktivlashtirish
  adminTabSwitch(_adminTab);
}

// ── setShopType — hozir admin uchun o'chirilgan ──
// Superadmin belgilaydi, bu funksiya faqat moslik uchun qolgan
function setShopType(t) {
  // Admin uchun o'chirilgan — superadmin belgilaydi
  toast("Do'kon turini faqat Super Admin o'zgartira oladi", "info");
}

// ── Sync statistikasi ─────────────────────────────
function adminRefreshSyncStats() {
  const prod  = (db.products||[]).length;
  const sales = (db.sales||[]).length;
  const custs = (db.customers||[]).length;
  const sc = id => document.getElementById(id);
  if (sc("sc-prod"))  sc("sc-prod").textContent  = prod;
  if (sc("sc-sales")) sc("sc-sales").textContent = sales;
  if (sc("sc-custs")) sc("sc-custs").textContent = custs;
}

// ── Tizim statistikasi ────────────────────────────
function adminRefreshStats() {
  const sc = id => document.getElementById(id);
  if (sc("tiz-prod"))  sc("tiz-prod").textContent  = (db.products||[]).length  + " ta";
  if (sc("tiz-sales")) sc("tiz-sales").textContent = (db.sales||[]).length     + " ta";
  if (sc("tiz-custs")) sc("tiz-custs").textContent = (db.customers||[]).length + " ta";
  if (sc("tiz-staff")) sc("tiz-staff").textContent = (db.staff||[]).length     + " ta";

  // Login card
  const loginCard = sc("s-login-info-card");
  if (loginCard) loginCard.textContent = db.settings?.adminEmail || "—";
  const loginWrap = sc("s-login-info");
  if (loginWrap) loginWrap.textContent = db.settings?.adminEmail || "—";
}

// renderEgasi chaqirilganda statistikani ham yangilash