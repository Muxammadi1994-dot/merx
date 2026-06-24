// MERX egasi.js | v3.3 | To'liq maydonlar boshqaruvi
// ================================================

// ── Asosiy sozlamalarni saqlash ───────────────────
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
  if (key === "rate") { if (typeof updateRatePill === "function") updateRatePill(); }
  if (key === "name") { if (!db.shop) db.shop = {}; db.shop.name = val; saveDB(); }
  if (key === "telegramBotUrl") {
    const tgBadge = $("tg-bot-status-badge");
    if (tgBadge) {
      const has = !!val;
      tgBadge.textContent = has ? "Sozlangan ✅" : "Sozlanmagan";
      tgBadge.className   = has ? "bg bg-g" : "bg bg-gr";
    }
  }
}

function renderEgasi() {
  if ($("s-name")) $("s-name").value = db.shop?.name || db.settings?.name || "";
  if ($("s-rate")) $("s-rate").value = db.settings?.rate || 12800;

  const cur = db.settings?.priceCurrency || "uzs";
  document.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === cur));

  const st = db.settings?.shopType || "ikki";
  document.querySelectorAll("[data-t]").forEach(b => b.classList.toggle("on", b.dataset.t === st));

  const url = db.settings?.supabaseUrl || "";
  const key = db.settings?.supabaseKey || "";
  if ($("s-sup-url")) $("s-sup-url").value = url;
  if ($("s-sup-key")) $("s-sup-key").value = key;

  // Parol va PIN bo'limi
  if (typeof renderPasswordSettings === "function") renderPasswordSettings();

  // Super Admin tugmasi olib tashlandi — login ekranidan kirish kerak
  const saSection = $("sa-pass-section");
  if (saSection) saSection.innerHTML = "";

  const badge = $("cloud-status-badge");
  if (badge) {
    badge.textContent = (url && key) ? "Ulangan ✅" : "Ulanmagan";
    badge.className   = (url && key) ? "bg bg-g"    : "bg bg-gr";
  }

  if ($("s-eskiz-token"))  $("s-eskiz-token").value  = db.settings?.eskizToken  || "";
  if ($("s-eskiz-sender")) $("s-eskiz-sender").value = db.settings?.eskizSender || "";
  if ($("s-loyalty-rate"))  $("s-loyalty-rate").value  = db.settings?.loyaltyRate  || "";
  if ($("s-loyalty-value")) $("s-loyalty-value").value = db.settings?.loyaltyValue || "";
  // Admin hisob
  if ($("s-admin-email")) $("s-admin-email").value = db.settings?.adminEmail || "";
  if ($("s-admin-pass"))  $("s-admin-pass").value  = "";
  // SMS, narx, telegram kabi UI yangilashlar
  if (typeof _renderEgasiExtra === "function") _renderEgasiExtra();
}

function saveAdminCreds() {
  const email = ($("s-admin-email")||{value:""}).value.trim().toLowerCase();
  const pass  = ($("s-admin-pass") ||{value:""}).value;
  if (!email) { toast("Email kiriting","err"); return; }
  if (pass && pass.length < 4) { toast("Parol kamida 4 ta belgi","err"); return; }
  if (!db.settings) db.settings = {};
  db.settings.adminEmail = email;
  if (pass) db.settings.adminPass = pass;
  // Auth session ni ham yangilaymiz
  if (typeof getAuthUser === "function") {
    const u = getAuthUser();
    if (u) { u.email = email; if (typeof authSave === "function") authSave(u); }
  }
  saveDB();
  if ($("s-admin-pass")) $("s-admin-pass").value = "";
  toast("✅ Administrator ma'lumotlari saqlandi");
}

// renderEgasi qolgan qismi (SMS va boshqa UI)
function _renderEgasiExtra() {
  if (typeof updateSmsUI        === "function") updateSmsUI();
  if (typeof updateCostCurrency === "function") updateCostCurrency();

  // Telegram bot
  if ($("s-tg-bot-url")) $("s-tg-bot-url").value = db.settings?.telegramBotUrl || "";
  if ($("s-tg-bot-username")) $("s-tg-bot-username").value = db.settings?.telegramBotUsername || "";
  if ($("s-staff-group-id")) $("s-staff-group-id").value = db.settings?.staffGroupId || "";
  const tgBadge = $("tg-bot-status-badge");
  if (tgBadge) {
    const has = !!db.settings?.telegramBotUrl;
    tgBadge.textContent = has ? "Sozlangan ✅" : "Sozlanmagan";
    tgBadge.className   = has ? "bg bg-g" : "bg bg-gr";
  }

  // Kam qoldiq chegara
  const lsInput = $("s-low-stock");
  if (lsInput) lsInput.value = db.settings?.lowStockLimit || 5;
  const lsCount = $("s-low-stock-count");
  if (lsCount) {
    const th = db.settings?.lowStockLimit || 5;
    let cnt = 0;
    db.products.forEach(p => p.variants.forEach(v => { if (v.qty <= th) cnt++; }));
    lsCount.textContent = cnt;
  }
}

