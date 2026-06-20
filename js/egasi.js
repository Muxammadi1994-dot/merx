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

// Chakana narx rejimi — POS da Ulgurji/Chakana tanlash tugmasini ko'rsatish/yashirish
function toggleChakanaMode(checked) {
  if (!db.settings) db.settings = {};
  db.settings.showChakana = checked;
  saveDB();

  const wrap = $("price-type-wrap");
  if (wrap) wrap.style.display = checked ? "block" : "none";

  const lbl = $("s-chakana-lbl");
  if (lbl) lbl.textContent = checked
    ? "Chakana narx ko'rinmoqda (ikkalasi ham tanlanadi)"
    : "Chakana narx ko'rinmayapti (ulgurji rejim)";

  // Agar o'chirilsa, POS har doim ulgurji rejimda qoladi
  if (!checked && typeof posPriceType !== "undefined") {
    posPriceType = "ulgurji";
    if (typeof setPriceType === "function") setPriceType("ulgurji");
  }

  if (typeof renderOmbor === "function") renderOmbor();
  toast(checked ? "✅ Chakana narx yoqildi" : "⛔ Chakana narx o'chirildi");
}

function setShopType(t) {
  if (!db.settings) db.settings = {};
  db.settings.shopType = t;
  // db.shop.type ham sinxron saqlansin (visProds() to'g'ri ishlashi uchun)
  if (!db.shop) db.shop = {};
  db.shop.type = t;
  document.querySelectorAll("[data-t]").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  saveDB();
  // Barcha sahifalarni yangilash
  if (typeof renderKatalog === "function") renderKatalog();
  if (typeof renderOmbor   === "function") renderOmbor();
  const label = t === "oyoq" ? "Oyoq kiyim" : t === "kiyim" ? "Kiyim-kechak" : "Ikkalasi";
  toast("Do'kon turi: " + label);
}

// ── Egasi sahifasini render qilish ───────────────
// Sahifa ochilganda checkbox va narx turi panelini to'g'ri holatga keltirish
function initChakanaToggle() {
  const checked = db.settings?.showChakana || false;
  const chk = $("s-chakana");
  if (chk) chk.checked = checked;

  const lbl = $("s-chakana-lbl");
  if (lbl) lbl.textContent = checked
    ? "Chakana narx ko'rinmoqda (ikkalasi ham tanlanadi)"
    : "Chakana narx ko'rinmayapti (ulgurji rejim)";

  const wrap = $("price-type-wrap");
  if (wrap) wrap.style.display = checked ? "block" : "none";
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
  // Super admin bo'limi
  if (typeof renderSuperAdminSection === "function") renderSuperAdminSection();

  const badge = $("cloud-status-badge");
  if (badge) {
    badge.textContent = (url && key) ? "Ulangan ✅" : "Ulanmagan";
    badge.className   = (url && key) ? "bg bg-g"    : "bg bg-gr";
  }

  if ($("s-eskiz-token"))  $("s-eskiz-token").value  = db.settings?.eskizToken  || "";
  if ($("s-eskiz-sender")) $("s-eskiz-sender").value = db.settings?.eskizSender || "";
  if (typeof updateSmsUI        === "function") updateSmsUI();
  if (typeof initChakanaToggle  === "function") initChakanaToggle();
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

