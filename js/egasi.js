// MERX egasi.js (admin.js) | v4.0 | 2026-06-24
// ================================================
// Admin Sozlamalar — Tab tizimi
// Tablar: dokon | narx | cloud | sms | tizim
// ================================================

// ── Aktiv tab ────────────────────────────────────
let _adminTab = "dokon";

function adminTabSwitch(tab) {
  _adminTab = tab;
  try { renderUnitTags(); } catch(e) {} // №11a: birlik chiplar yangilanadi
  document.querySelectorAll(".adm-tab-btn").forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("adm-tab-on", on);
  });
  document.querySelectorAll(".adm-tab-pane").forEach(p => {
    p.style.display = p.dataset.tab === tab ? "block" : "none";
  });
}

// ── Valyuta kursi: Qo'lda / Avtomatik (CBU) — 2026-07-09 ──────────
// MUHIM: standart holat ("rateMode" sozlamasi hali belgilanmagan)
// HAR DOIM "manual" deb hisoblanadi — mavjud do'konlarning hech
// birida xatti-harakat o'zgarmaydi, faqat ANIQ ravishda "Avtomatik"
// tanlangandagina yangi oqim ishga tushadi.
function getRateMode() { return db.settings?.rateMode === "auto" ? "auto" : "manual"; }

function renderRateModeUI() {
  const mode = getRateMode();
  document.querySelectorAll('[data-ratemode]').forEach(b =>
    b.classList.toggle("on", b.dataset.ratemode === mode));
  const inp = $("s-rate");
  if (inp) inp.readOnly = (mode === "auto");
  const statusEl = $("s-rate-status");
  if (statusEl) {
    if (mode === "auto") {
      const upd = db.settings?.rateUpdatedAt
        ? new Date(db.settings.rateUpdatedAt).toLocaleString("uz-UZ", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})
        : "hali yangilanmagan";
      statusEl.innerHTML = `🏦 Markaziy Bank kursi · oxirgi yangilanish: ${upd} <button class="btn btn-ghost btn-sm" onclick="checkAutoRate(true)" style="margin-left:8px;padding:2px 8px"><i class="ti ti-refresh"></i> Hozir yangilash</button>`;
    } else {
      statusEl.textContent = "";
    }
  }
}

let _rateCheckBusy = false;
async function checkAutoRate(force) {
  if (getRateMode() !== "auto") return;
  if (_rateCheckBusy) return;
  const today = new Date().toISOString().slice(0,10);
  const lastDate = (db.settings?.rateUpdatedAt || "").slice(0,10);
  if (!force && lastDate === today) return; // bugun allaqachon yangilangan
  _rateCheckBusy = true;
  try {
    const res = await fetch("/api/rate");
    const data = await res.json();
    if (data.ok && data.rate > 0) {
      db.settings.rate = Math.round(data.rate);
      db.settings.rateUpdatedAt = new Date().toISOString();
      saveDB();
      if ($("s-rate")) $("s-rate").value = db.settings.rate;
      renderRateModeUI();
      if (typeof updateRatePill === "function") updateRatePill();
      if (typeof updateCostCurrency === "function") updateCostCurrency();
      if (typeof renderKatalog === "function" && document.getElementById("page-katalog")?.style.display !== "none") renderKatalog();
      if (typeof pushToCloud === "function") pushToCloud();
      if (force) toast(`✅ Kurs yangilandi: 1$ = ${fmt(db.settings.rate)} so'm (Markaziy Bank)`);
    } else if (force) {
      toast("❌ Markaziy Bank kursini olib bo'lmadi", "err");
    }
  } catch (e) {
    if (force) toast("❌ Kursni yangilashda xato: " + e.message, "err");
  } finally {
    _rateCheckBusy = false;
  }
}

// ── Valyuta yorlig'i — SOZLAMALAR va yuqori panel uchun YAGONA format,
// shu bilan ikkalasi HAR DOIM bir xil ko'rinishda bo'ladi ──────────
function currencyPillText() {
  const cur  = db.settings?.priceCurrency || "uzs";
  const rate = db.settings?.rate || 12800;
  const lbl  = cur === "usd" ? "USD" : cur === "both" ? "SO'M+USD" : "SO'M";
  return `${lbl} (1$=${fmt(rate)})`;
}

// ── saveSetting — o'zgarmadi ──────────────────────
function saveSetting(key, val) {
  if (!db.settings) db.settings = {};
  db.settings[key] = val;
  saveDB();
  if (key === "eskizToken") {
    // Token qo'lda yangilandi — eski "eskirgan" ogohlantirishni tozalaymiz
    db.settings.eskizTokenExpired = false;
    saveDB();
    if (typeof updateSmsUI === "function") updateSmsUI();
  }
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
  if (key === "rateMode") {
    renderRateModeUI();
    if (val === "auto") checkAutoRate(true); // darhol bir marta yangilaymiz
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
  if (key === "telegramBotUsername") {
    // Faqat @ belgisi bo'lsa email deb hisoblaymiz (merx_savdo_bot.uz emas)
    // Faqat harf va _ belgisi bo'lishi kerak (telefon, email, URL emas)
    const cleanVal = val.replace(/^@/, "").trim();
    const isPhone = /^[+\d\s\-()]{6,}$/.test(cleanVal);
    const isEmail = cleanVal.includes("@");
    const isUrl   = cleanVal.includes(".");
    if (isPhone || isEmail || isUrl) {
      if (db.settings) db.settings.telegramBotUsername = "";
      const msg = isPhone
        ? "Bu telefon raqam! Bot username kiriting: merx_savdo_bot"
        : "Bot username noto'g'ri — merx_savdo_bot kabi kiriting (@ siz)";
      toast(msg, "err");
      const inp = document.getElementById("s-tg-bot-username");
      if (inp) inp.value = "";
      return;
    }
    _updateTgMijozLink();
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
  renderRateModeUI(); // v166: Qo'lda/Avtomatik holatini ham ko'rsatamiz
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

  // Mijoz Telegram havolasini ko'rsatamiz
  _updateTgMijozLink();

  // Chek sozlamalari
  const chekCfg = db.settings?.chekConfig || {};
  // 2026-07-18: telefonlar va qo'shimcha matnlar (massiv holida)
  window._chekPhones = Array.isArray(chekCfg.phones) && chekCfg.phones.length
    ? chekCfg.phones.slice()
    : (chekCfg.contact ? String(chekCfg.contact).split(",").map(s => s.trim()).filter(Boolean) : []);
  window._chekExtra = Array.isArray(chekCfg.extraLines) ? chekCfg.extraLines.slice() : [];
  renderChekPhones();
  renderChekExtra();
  // 2026-07-18: jonli preview — inputlarni ulash + birinchi render
  setTimeout(() => { try { _bindChekPreviewInputs(); renderChekPreview(); } catch(e) {} }, 100);
  const ceFooter  = document.getElementById("chek-footer");
  const ceStaff   = document.getElementById("chek-show-staff");
  const ceContact2= document.getElementById("chek-show-contact");
  const ceDebtH   = document.getElementById("chek-show-debt-history");
  const cePosStyle   = document.getElementById("chek-pos-style");
  const ceTarixStyle = document.getElementById("chek-tarix-style");
  const ceQarzStyle  = document.getElementById("chek-qarz-style");
  const ceAddr = document.getElementById("chek-addr");
  if (ceAddr)    ceAddr.value    = chekCfg.addr     || "";
  const ceTag = document.getElementById("chek-tagline");
  if (ceTag)     ceTag.value     = chekCfg.tagline  || "";
  const cePaper = document.getElementById("chek-paper");
  if (cePaper)   cePaper.value   = String(chekCfg.paperWidth || 72);
  const ceFScale = document.getElementById("chek-font-scale");
  if (ceFScale)  ceFScale.value  = chekCfg.fontScale  || "normal";
  const ceFFam = document.getElementById("chek-font-family");
  if (ceFFam)    ceFFam.value    = chekCfg.fontFamily || "dm";
  const ceFI = document.getElementById("chek-footer-italic");
  if (ceFI)      ceFI.checked    = chekCfg.footerItalic !== false;
  const ceFB = document.getElementById("chek-footer-bold");
  if (ceFB)      ceFB.checked    = chekCfg.footerBold === true;
  const ceUni = document.getElementById("chek-unified-sotuv");
  if (ceUni)     ceUni.checked   = chekCfg.unifiedSotuv === true;
  if (ceFooter)  ceFooter.value  = chekCfg.footer   || "Rahmat! Yana kutamiz 🙏";
  if (ceStaff)   ceStaff.checked   = chekCfg.showStaff   !== false;
  if (ceContact2) ceContact2.checked = chekCfg.showContact !== false;
  if (ceDebtH)   ceDebtH.checked  = chekCfg.showDebtHistory !== false;
  if (cePosStyle) {
    // Yangi uslublar qo'shamiz (agar yo'q bo'lsa)
    const posStyleOpts = [
      {v:"merx",       l:"MERX brend (zamonaviy)"},
      {v:"thermal",    l:"Termal printer (72mm)"},
      {v:"wholesale",  l:"Ulgurji hujjat (A4)"},
      {v:"full",       l:"To'liq (eski)"},
      {v:"compact",    l:"Ixcham"},
      {v:"table",      l:"Jadval (USD+UZS)"},
    ];
    if (cePosStyle.options.length < 4) {
      cePosStyle.innerHTML = posStyleOpts.map(o =>
        `<option value="${o.v}">${o.l}</option>`).join("");
    }
    cePosStyle.value = chekCfg.posStyle || "merx";
  }
  if (ceTarixStyle) {
    const tarixStyleOpts = [
      {v:"merx",      l:"MERX brend (zamonaviy)"},
      {v:"thermal",   l:"Termal printer (72mm)"},
      {v:"wholesale", l:"Ulgurji hujjat (A4)"},
      {v:"full",      l:"To'liq (eski)"},
      {v:"compact",   l:"Ixcham"},
    ];
    if (ceTarixStyle.options.length < 3) {
      ceTarixStyle.innerHTML = tarixStyleOpts.map(o =>
        `<option value="${o.v}">${o.l}</option>`).join("");
    }
    ceTarixStyle.value = chekCfg.tarixStyle || "merx";
  }
  if (ceQarzStyle) {
    const qarzStyleOpts = [
      {v:"merx",      l:"MERX brend (zamonaviy)"},
      {v:"thermal",   l:"Termal printer (72mm)"},
      {v:"wholesale", l:"Ulgurji hujjat (A4)"},
      {v:"compact",   l:"Ixcham (eski)"},
    ];
    if (ceQarzStyle.options.length < 3) {
      ceQarzStyle.innerHTML = qarzStyleOpts.map(o =>
        `<option value="${o.v}">${o.l}</option>`).join("");
    }
    ceQarzStyle.value = chekCfg.qarzStyle || "merx";
  }
  // Logo preview
  const logoPreview = document.getElementById("chek-logo-preview");
  if (logoPreview) {
    logoPreview.src   = chekCfg.logo || "";
    logoPreview.style.display = chekCfg.logo ? "block" : "none";
  }

  // SMS shablonlar
  const tplDebt = document.getElementById("s-sms-tpl-debt");
  const tplSale = document.getElementById("s-sms-tpl-sale");
  const tplPaid = document.getElementById("s-sms-tpl-paid");
  if (tplDebt) tplDebt.value = db.settings?.smsTemplateDebt ||
    "{dokon}: Hurmatli {ism}, umumiy qarzingiz: {qarz}. Iltimos to'lovni amalga oshiring.";
  if (tplSale) tplSale.value = db.settings?.smsTemplateSale ||
    "{dokon} | {chek}\n{tovarlar}\nJami: {jami}\nTo'landi: {tolandi}\nQarz: {qarz} ({muddat})";
  if (tplPaid) tplPaid.value = db.settings?.smsTemplatePaid ||
    "{dokon} | {chek}\n{tovarlar}\nJami: {jami} - To'liq qabul qilindi. Rahmat!";

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
  // Xodimlar tab
  renderAdminXodimlar();
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
async function adminRefreshSyncStats() {
  const sc = id => document.getElementById(id);

  // Avval local ma'lumotlarni ko'rsatamiz (tez)
  if (sc("sc-prod"))  sc("sc-prod").textContent  = (db.products||[]).length + " (local)";
  if (sc("sc-sales")) sc("sc-sales").textContent = (db.sales||[]).length    + " (local)";
  if (sc("sc-custs")) sc("sc-custs").textContent = (db.customers||[]).length+ " (local)";

  // Oxirgi sync vaqti
  const lastSync = db.settings?.lastSyncAt;
  const el = sc("sc-last-sync");
  if (el) {
    if (lastSync) {
      const d    = new Date(lastSync);
      const diff = Math.round((new Date() - d) / 60000);
      el.textContent = diff < 1 ? "Hozirgina"
        : diff < 60   ? diff + " daqiqa oldin"
        : diff < 1440 ? Math.round(diff/60) + " soat oldin"
        : d.toLocaleDateString("uz-UZ");
    } else {
      el.textContent = "Hali sinxronlanmagan";
    }
  }

  // Supabase dan real raqamlarni olamiz
  if (typeof _sb === "undefined" || !_sb) return;
  try {
    const sid = typeof getCloudShopId === "function" ? getCloudShopId() : null;
    if (!sid) return;
    const [rProd, rSales, rCusts] = await Promise.all([
      _sb.from("products").select("id", { count:"exact", head:true }).eq("shop_id", sid),
      _sb.from("sales").select("id",    { count:"exact", head:true }).eq("shop_id", sid),
      _sb.from("customers").select("id",{ count:"exact", head:true }).eq("shop_id", sid),
    ]);
    if (sc("sc-prod"))  sc("sc-prod").textContent  = (rProd.count  ?? "—") + " (cloud)";
    if (sc("sc-sales")) sc("sc-sales").textContent = (rSales.count ?? "—") + " (cloud)";
    if (sc("sc-custs")) sc("sc-custs").textContent = (rCusts.count ?? "—") + " (cloud)";
  } catch(e) {
    console.warn("Cloud statistika xato:", e.message);
  }
}

// ── Tizim statistikasi ────────────────────────────
function adminRefreshStats() {
  const sc = id => document.getElementById(id);
  if (sc("tiz-prod"))  sc("tiz-prod").textContent  = (db.products||[]).length  + " ta";
  if (sc("tiz-sales")) sc("tiz-sales").textContent = (db.sales||[]).length     + " ta";
  if (sc("tiz-custs")) sc("tiz-custs").textContent = (db.customers||[]).length + " ta";
  if (sc("tiz-staff")) sc("tiz-staff").textContent = (db.staff||[]).length     + " ta";

  // localStorage hajmi
  const lsEl = sc("tiz-ls-size");
  if (lsEl) {
    try {
      const key  = typeof getDBKEY === "function" ? getDBKEY() : "merx_v5";
      const size = (localStorage.getItem(key) || "").length;
      const kb   = (size / 1024).toFixed(0);
      const pct  = Math.round(size / 51200); // ~5MB max
      lsEl.textContent = kb + " KB (" + pct + "% ishlatilgan)";
      lsEl.style.color = pct > 80 ? "#DC2626" : pct > 60 ? "#D97706" : "#059669";
    } catch(e) { lsEl.textContent = "—"; }
  }

  // Login ma'lumotlari
  const loginCard = sc("s-login-info-card");
  if (loginCard) loginCard.textContent = db.settings?.adminEmail || "—";
  const loginWrap = sc("s-login-info");
  if (loginWrap) loginWrap.textContent = db.settings?.adminEmail || "—";

  // Do'kon login ma'lumoti (nusxa olish uchun)
  const loginDisplay = sc("tiz-login-display");
  if (loginDisplay) loginDisplay.textContent = db.settings?.adminEmail || "—";
}

// renderEgasi chaqirilganda statistikani ham yangilash
// ── Xodimlar tab render ───────────────────────────
const ROLE_PERMS_TABLE = [
  { lbl:"Sotuv (POS)",        kassir:true,  menejer:true,  omborchi:false, admin:true  },
  { lbl:"Chegirma berish",    kassir:false, menejer:true,  omborchi:false, admin:true, note:"* Alohida ruxsat bilan" },
  { lbl:"Nasiya sotuv",       kassir:false, menejer:true,  omborchi:false, admin:true, note:"* Alohida ruxsat bilan" },
  { lbl:"Qaytarish",          kassir:false, menejer:true,  omborchi:false, admin:true, note:"* Alohida ruxsat bilan" },
  { lbl:"Mijozlar ko'rish",   kassir:true,  menejer:true,  omborchi:false, admin:true  },
  { lbl:"Qarzlar ko'rish",    kassir:true,  menejer:true,  omborchi:false, admin:true  },
  { lbl:"Ombor",              kassir:false, menejer:true,  omborchi:true,  admin:true  },
  { lbl:"Katalog boshqarish", kassir:false, menejer:true,  omborchi:true,  admin:true  },
  { lbl:"Sotuv tarixi",       kassir:true,  menejer:true,  omborchi:false, admin:true  },
  { lbl:"Hisobot",            kassir:false, menejer:true,  omborchi:false, admin:true  },
  { lbl:"Moliya",             kassir:false, menejer:true,  omborchi:false, admin:true  },
  { lbl:"Xodimlar",          kassir:false, menejer:true,  omborchi:false, admin:true  },
  { lbl:"Sozlamalar",         kassir:false, menejer:false, omborchi:false, admin:true  },
];

function renderAdminXodimlar() {
  // Rol jadvali
  const tbody = document.getElementById("adm-role-table-body");
  if (tbody) {
    const yes = `<td style="text-align:center;padding:10px 12px;border-bottom:1px solid #F3F4F6">
      <span style="color:#059669;font-size:16px">✅</span></td>`;
    const no  = `<td style="text-align:center;padding:10px 12px;border-bottom:1px solid #F3F4F6">
      <span style="color:#E5E7EB;font-size:16px">—</span></td>`;
    const partial = `<td style="text-align:center;padding:10px 12px;border-bottom:1px solid #F3F4F6">
      <span style="color:#D97706;font-size:12px;font-weight:700">✳️</span></td>`;

    tbody.innerHTML = ROLE_PERMS_TABLE.map((row, i) => {
      const bg = i % 2 === 0 ? "" : "background:#FAFAFA";
      const kassirCell = row.note && !row.kassir ? partial : (row.kassir ? yes : no);
      return `<tr style="${bg}">
        <td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-weight:600;color:#374151">
          ${row.lbl}
          ${row.note ? `<span style="font-size:10px;color:#9CA3AF;font-weight:400;display:block">${row.note}</span>` : ""}
        </td>
        ${kassirCell}
        ${row.menejer ? yes : no}
        ${row.omborchi ? yes : no}
        ${row.admin ? yes : no}
      </tr>`;
    }).join("");
  }

  // Xodimlar ruxsatlari
  const permsEl = document.getElementById("adm-staff-perms");
  if (!permsEl) return;

  const staff = db.staff || [];
  if (!staff.length) {
    permsEl.innerHTML = `<div style="text-align:center;padding:32px;color:var(--mut)">
      <i class="ti ti-users-off" style="font-size:32px;display:block;margin-bottom:8px"></i>
      Xodimlar yo'q — avval xodim qo'shing
    </div>`;
    return;
  }

  const roleLabel = { kassir:"💼 Kassir", menejer:"📊 Menejer", omborchi:"📦 Omborchi", admin:"🔑 Admin" };
  const roleColor = { kassir:"#4C9BE8",   menejer:"#8B5CF6",    omborchi:"#36B48C",      admin:"#E9A500" };

  permsEl.innerHTML = staff.map(s => {
    const clr  = roleColor[s.role]  || "#9CA3AF";
    const rlbl = roleLabel[s.role]  || s.role || "—";
    const perms = [];
    if (s.permDiscount) perms.push(`✂️ Chegirma${s.maxDiscount ? " (max "+s.maxDiscount+"%)" : ""}`);
    if (s.permNasiya)   perms.push("💳 Nasiya");
    if (s.permReturn)   perms.push("↩ Qaytarish");

    return `
      <div style="display:flex;align-items:center;gap:14px;padding:12px 0;
        border-bottom:1px solid var(--brd)">
        <div style="width:40px;height:40px;background:${clr}18;border-radius:10px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ti-user" style="color:${clr};font-size:18px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;color:var(--ink);font-size:14px">${s.name}</div>
          <div style="font-size:12px;color:var(--mut)">${s.phone || "—"}</div>
        </div>
        <div style="text-align:right">
          <span style="background:${clr}18;color:${clr};border-radius:6px;
            padding:3px 10px;font-size:12px;font-weight:700;display:inline-block;margin-bottom:4px">
            ${rlbl}
          </span>
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
            ${perms.length
              ? perms.map(p => `<span style="background:#EFF6FF;color:#2563EB;border-radius:5px;
                  padding:2px 8px;font-size:11px;font-weight:600">${p}</span>`).join("")
              : `<span style="font-size:11px;color:var(--mut)">Qo'shimcha ruxsat yo'q</span>`
            }
          </div>
        </div>
        <button onclick="adminEditStaff(${s.id})" title="Tahrirlash"
          style="background:#F3F4F6;border:none;border-radius:8px;padding:7px 10px;
          cursor:pointer;color:#6B7280;flex-shrink:0">
          <i class="ti ti-edit" style="font-size:14px"></i>
        </button>
      </div>`;
  }).join("");
}

// ── SMS UI badge yangilash ────────────────────────
function updateSmsUI() {
  const token  = db.settings?.eskizToken || "";
  const badge  = document.getElementById("sms-status-badge");
  if (!badge) return;
  if (token && db.settings?.eskizTokenExpired) {
    badge.textContent = "⚠️ Token eskirgan — yangilang";
    badge.className   = "bg bg-r";
  } else if (token) {
    badge.textContent = "Ulangan ✅";
    badge.className   = "bg bg-g";
  } else {
    badge.textContent = "Test rejimi";
    badge.className   = "bg bg-gr";
  }
}

// ── Login nusxalash ───────────────────────────────
function adminCopyLogin() {
  const email = db.settings?.adminEmail || "";
  if (!email) { toast("Login ma'lumoti yo'q", "err"); return; }
  const text = `Sayt: merx-rho.vercel.app\nLogin: ${email}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast("✅ Nusxa olindi!"));
  } else {
    const t = document.createElement("textarea");
    t.value = text; document.body.appendChild(t);
    t.select(); document.execCommand("copy");
    document.body.removeChild(t);
    toast("✅ Nusxa olindi!");
  }
}

// ── Kesh tozalash ─────────────────────────────────
function adminClearCache() {
  if (!confirm("Faqat vaqtinchalik kesh tozalanadi. Asosiy ma'lumotlar saqlanib qoladi. Davom etasizmi?")) return;
  try {
    // Faqat merx bo'lmagan kalitlarni o'chirish
    const keys = Object.keys(localStorage);
    let removed = 0;
    keys.forEach(k => {
      if (!k.startsWith("merx_") && !k.startsWith("supabase")) {
        localStorage.removeItem(k);
        removed++;
      }
    });
    adminRefreshStats();
    toast(`✅ Kesh tozalandi (${removed} ta element)`);
  } catch(e) {
    toast("Kesh tozalashda xato", "err");
  }
}

// ── Sozlamalardan xodimni tahrirlash ─────────────
function adminEditStaff(id) {
  // Xodimlar bo'limiga o'tib, o'sha xodimni ochamiz
  nav("xodimlar");
  setTimeout(() => {
    if (typeof openStaffModal === "function") openStaffModal(id);
  }, 150);
}

// ── SMS shablonlarni saqlash ──────────────────────
function saveSmsTemplates() {
  if (!db.settings) db.settings = {};
  const tplDebt = document.getElementById("s-sms-tpl-debt");
  const tplSale = document.getElementById("s-sms-tpl-sale");
  const tplPaid = document.getElementById("s-sms-tpl-paid");
  if (tplDebt) db.settings.smsTemplateDebt = tplDebt.value;
  if (tplSale) db.settings.smsTemplateSale = tplSale.value;
  if (tplPaid) db.settings.smsTemplatePaid = tplPaid.value;
  saveDB();
  toast("✅ SMS shablonlar saqlandi");
}

// ── SMS shablonni standartga qaytarish ────────────
function resetSmsTemplate(type) {
  const defaults = {
    debt: "{dokon}: Hurmatli {ism}, umumiy qarzingiz: {qarz}. Iltimos to'lovni amalga oshiring.",
    sale: "{dokon} | {chek}\n{tovarlar}\nJami: {jami}\nTo'landi: {tolandi}\nQarz: {qarz} ({muddat})",
    paid: "{dokon} | {chek}\n{tovarlar}\nJami: {jami} - To'liq qabul qilindi. Rahmat!"
  };
  const el = document.getElementById("s-sms-tpl-" + type);
  if (el) { el.value = defaults[type]; el.style.borderColor = "#E9A500"; }
}

// ── Chek sozlamalarini saqlash ────────────────────
function saveChekConfig() {
  if (!db.settings) db.settings = {};
  const cfg = db.settings.chekConfig || {};

  cfg.addr    = document.getElementById("chek-addr")?.value    || ""; // v145 (№12): manzil
  cfg.tagline = document.getElementById("chek-tagline")?.value  || ""; // v146: shior
  cfg.paperWidth = parseInt(document.getElementById("chek-paper")?.value) || 72; // 2026-07-17: qog'oz eni
  cfg.fontScale  = document.getElementById("chek-font-scale")?.value  || "normal"; // 2026-07-18: tipografiya
  cfg.fontFamily = document.getElementById("chek-font-family")?.value || "dm";
  cfg.footerItalic = document.getElementById("chek-footer-italic")?.checked !== false;
  cfg.footerBold   = document.getElementById("chek-footer-bold")?.checked === true;
  cfg.unifiedSotuv = document.getElementById("chek-unified-sotuv")?.checked === true; // 2026-07-18: yagona sotuv cheki (test)
  // 2026-07-18 (2-bosqich): telefonlar massivi + qo'shimcha matnlar.
  // Eski "contact" (vergulli) o'rniga phones[]; getChekCfg ikkalasini biladi.
  cfg.phones = Array.isArray(window._chekPhones) ? window._chekPhones.slice() : [];
  cfg.contact = cfg.phones.join(", "); // eski maydonlar/bot mosligi uchun ham
  cfg.extraLines = Array.isArray(window._chekExtra) ? window._chekExtra.slice() : [];
  cfg.footer  = document.getElementById("chek-footer")?.value  || "Rahmat! Yana kutamiz 🙏";
  cfg.showStaff        = document.getElementById("chek-show-staff")?.checked !== false;
  cfg.showContact      = document.getElementById("chek-show-contact")?.checked !== false;
  cfg.showDebtHistory  = document.getElementById("chek-show-debt-history")?.checked !== false;
  cfg.posStyle   = document.getElementById("chek-pos-style")?.value   || "merx";
  cfg.tarixStyle = document.getElementById("chek-tarix-style")?.value || "merx";
  cfg.qarzStyle  = document.getElementById("chek-qarz-style")?.value  || "merx";

  db.settings.chekConfig = cfg;
  saveDB();
  toast("✅ Chek sozlamalari saqlandi");
}

// ── Logo yuklash ──────────────────────────────────
function uploadChekLogo(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 200 * 1024) { toast("Logo 200KB dan kichik bo'lishi kerak", "err"); return; }
  const reader = new FileReader();
  reader.onload = e => {
    if (!db.settings) db.settings = {};
    if (!db.settings.chekConfig) db.settings.chekConfig = {};
    db.settings.chekConfig.logo = e.target.result;
    saveDB();
    const prev = document.getElementById("chek-logo-preview");
    if (prev) { prev.src = e.target.result; prev.style.display = "block"; }
    toast("✅ Logo saqlandi");
  };
  reader.readAsDataURL(file);
}

// ── Logo o'chirish ────────────────────────────────
function removeChekLogo() {
  if (!db.settings?.chekConfig) return;
  db.settings.chekConfig.logo = "";
  saveDB();
  const prev = document.getElementById("chek-logo-preview");
  if (prev) { prev.src = ""; prev.style.display = "none"; }
  const inp = document.getElementById("chek-logo-input");
  if (inp) inp.value = "";
  toast("Logo o'chirildi");
}

// ── Chek preview ──────────────────────────────────
function previewChek(style) {
  // Test sotuv ma'lumotlari bilan preview
  const testSale = {
    id: 999, chekNum: "CHK-TEST-001",
    date: new Date().toISOString().slice(0,10),
    time: new Date().toLocaleTimeString("uz-UZ").slice(0,5),
    payType: "naqd",
    items: [
      { name: "Krossovka", variant: "Ko'k / 42", qty: 2, price: 850000, unit: "juft" },
      { name: "Futbolka",  variant: "Oq / L",    qty: 3, price: 120000, unit: "dona" },
    ],
    total: 2060000, paid: 1000000, remaining: 1060000,
    discount: 0, debtCurrency: "uzs",
    customerName: "Alisher Karimov", customerPhone: "+998 90 123 45 67",
    prevDebtUzs: 500000, due: "2026-07-15"
  };
  const staffObj = db.staff?.[0];
  const html = buildReceiptHtml(testSale, {
    shopName: db.shop?.name || "MERX",
    staffName: staffObj?.name || "Kassir",
    style
  });
  const w = window.open("", "_blank", "width=440,height=700");
  if (!w) { toast("Pop-up bloklangan", "err"); return; }
  w.document.write(html);
  w.document.close();
}


// ── Telegram mijoz havolasi ───────────────────────
function _updateTgMijozLink() {
  const el = document.getElementById("tg-mijoz-link");
  if (!el) return;

  // Bot username — @merx_savdo_bot shaklida, emailni filtrlaymiz
  let botUsername = (db.settings?.telegramBotUsername || "").replace(/^@/, "").trim();
  // Email bo'lsa — bo'sh qilamiz (noto'g'ri kiritilgan)
  // Telefon, email, URL bo'lsa tozalaymiz
  if (botUsername.includes("@") || botUsername.includes(".") ||
      /^[+\d\s\-()]{6,}$/.test(botUsername)) {
    botUsername = "";
  }

  // ShopId — session, cloudShopId yoki local dan
  let shopId = typeof getShopId === "function" ? getShopId() : null;
  if (!shopId || shopId === "local") {
    shopId = db.settings?.cloudShopId || null;
  }

  if (!botUsername) {
    el.textContent = "Bot username kiriting (masalan: merx_savdo_bot)";
    el.style.color = "#9CA3AF";
    return;
  }
  if (!shopId) {
    el.textContent = "Do'kon ID kiriting (Cloud tab → Do'kon ID)";
    el.style.color = "#9CA3AF";
    return;
  }

  const link = `https://t.me/${botUsername}?start=${shopId}`;
  el.textContent = link;
  el.style.color = "#065F46";
}

function copyTgLink() {
  const el = document.getElementById("tg-mijoz-link");
  if (!el || el.textContent === "—" || el.style.color === "rgb(156, 163, 175)") {
    toast("Havola yaratilmagan — Bot username va Cloud ulanish kerak", "err");
    return;
  }
  const link = el.textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(() => toast("✅ Havola nusxa olindi!"));
  } else {
    const t = document.createElement("textarea");
    t.value = link; document.body.appendChild(t);
    t.select(); document.execCommand("copy");
    document.body.removeChild(t);
    toast("✅ Havola nusxa olindi!");
  }
}
// ── Cloud Shop ID qo'lda saqlash ──────────────────
// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function saveCloudShopId() {
  const inp = document.getElementById("s-cloud-shop-id");
  const val = inp?.value.trim();
  if (!val || !val.startsWith("shop_")) {
    toast("Shop ID noto'g'ri — shop_XXXXX ko'rinishida bo'lishi kerak", "err");
    return;
  }
  if (!db.settings) db.settings = {};
  db.settings.cloudShopId = val;
  saveDB();
  const cur = document.getElementById("s-cloud-shop-id-current");
  if (cur) cur.textContent = val;
  if (inp) inp.value = "";
  toast("✅ Shop ID saqlandi: " + val);
  // Havola yangilash
  if (typeof _updateTgMijozLink === "function") _updateTgMijozLink();
}

// renderEgasi da cloud shop id ko'rsatish
// ════════════════════════════════════════════════
// №11a (v144): BIRLIK TEGLARI boshqaruvi — chip + qo'shish/o'chirish
// Sozlamalarda saqlanadi (unitTags/packUnitTags), sinxronlanadi (cloud v186).
// "dona" o'chirib bo'lmaydi (standart va zaxira birlik).
// ════════════════════════════════════════════════
function renderUnitTags() {
  const boxes = [
    { el: $("unit-tags-box"), tags: getUnitTags(),     kind: "unit" },
    { el: $("pack-tags-box"), tags: getPackUnitTags(), kind: "pack" },
  ];
  boxes.forEach(({ el, tags, kind }) => {
    if (!el) return;
    el.innerHTML = tags.map(t => `
      <span style="display:inline-flex;align-items:center;gap:5px;background:#F2F0EB;border:1px solid var(--brd);border-radius:16px;padding:4px 10px;font-size:12.5px;font-weight:600">
        ${t}
        ${(kind === "unit" && t === "dona") ? "" : `<button onclick="removeUnitTag('${kind}','${t.replace(/'/g,"\\'")}')"
          style="background:none;border:none;cursor:pointer;color:#bbb;font-size:13px;line-height:1;padding:0">✕</button>`}
      </span>`).join("");
  });
}

function addUnitTag(kind) {
  const inp = $(kind === "unit" ? "unit-tag-new" : "pack-tag-new");
  const val = (inp?.value || "").trim().toLowerCase();
  if (!val) return;
  if (val.length > 20) { toast("Juda uzun nom", "err"); return; }
  const key = kind === "unit" ? "unitTags" : "packUnitTags";
  const cur = kind === "unit" ? getUnitTags() : getPackUnitTags();
  if (cur.includes(val)) { toast("Bu birlik allaqachon bor", "err"); return; }
  db.settings[key] = [...cur, val];
  if (inp) inp.value = "";
  saveDB(); renderUnitTags();
  toast(`"${val}" qo'shildi`);
}

function removeUnitTag(kind, val) {
  if (kind === "unit" && val === "dona") { toast("'dona' standart — o'chirib bo'lmaydi", "err"); return; }
  const key = kind === "unit" ? "unitTags" : "packUnitTags";
  const cur = kind === "unit" ? getUnitTags() : getPackUnitTags();
  db.settings[key] = cur.filter(t => t !== val);
  saveDB(); renderUnitTags();
  toast(`"${val}" o'chirildi (eski tovarlarga ta'sir qilmaydi)`);
}


// ═══════════════════════════════════════════════════════════
// CHEK KONSTRUKTORI 2-bosqich (2026-07-18): TELEFONLAR + QO'SHIMCHA MATNLAR
// Chip-uslubidagi boshqaruv (birlik teglari kabi). Saqlash saveChekConfig'da.
// ═══════════════════════════════════════════════════════════
function renderChekPhones() {
  try { if (typeof renderChekPreview === 'function') setTimeout(renderChekPreview, 0); } catch(e) {}
  const box = document.getElementById("chek-phones-box");
  if (!box) return;
  const arr = window._chekPhones || [];
  box.innerHTML = arr.length ? arr.map((p, i) => `
    <span style="display:inline-flex;align-items:center;gap:5px;background:#F2F0EB;border:1px solid var(--brd);border-radius:16px;padding:5px 10px;font-size:13px;font-weight:600">
      ${p}
      <button type="button" onclick="removeChekPhone(${i})" style="background:none;border:none;cursor:pointer;color:#bbb;font-size:14px;line-height:1;padding:0">✕</button>
    </span>`).join("") : `<span style="font-size:12px;color:var(--mut)">Hali telefon qo'shilmagan</span>`;
}
function addChekPhone() {
  const inp = document.getElementById("chek-phone-new");
  const v = (inp?.value || "").trim();
  if (!v) return;
  window._chekPhones = window._chekPhones || [];
  if (window._chekPhones.includes(v)) { toast("Bu raqam allaqachon bor", "err"); return; }
  window._chekPhones.push(v);
  if (inp) inp.value = "";
  renderChekPhones();
}
function removeChekPhone(i) {
  if (!window._chekPhones) return;
  window._chekPhones.splice(i, 1);
  renderChekPhones();
}

function renderChekExtra() {
  try { if (typeof renderChekPreview === 'function') setTimeout(renderChekPreview, 0); } catch(e) {}
  const box = document.getElementById("chek-extra-box");
  if (!box) return;
  const arr = window._chekExtra || [];
  box.innerHTML = arr.length ? arr.map((t, i) => `
    <div style="display:flex;align-items:center;gap:6px;background:#F8F7F4;border:1px solid var(--brd);border-radius:8px;padding:6px 10px">
      <span style="flex:1;font-size:13px">${t}</span>
      <button type="button" onclick="removeChekExtra(${i})" style="background:none;border:none;cursor:pointer;color:#bbb;font-size:14px;line-height:1;padding:0">✕</button>
    </div>`).join("") : `<span style="font-size:12px;color:var(--mut)">Qo'shimcha matn yo'q</span>`;
}
function addChekExtra() {
  const inp = document.getElementById("chek-extra-new");
  const v = (inp?.value || "").trim();
  if (!v) return;
  window._chekExtra = window._chekExtra || [];
  window._chekExtra.push(v);
  if (inp) inp.value = "";
  renderChekExtra();
}
function removeChekExtra(i) {
  if (!window._chekExtra) return;
  window._chekExtra.splice(i, 1);
  renderChekExtra();
}

// ═══════════════════════════════════════════════════════════
// CHEK KONSTRUKTORI 2-bosqich (2026-07-18): JONLI TEST-CHEK (preview)
// Admin biror sozlamani o'zgartirsa — test-chek DARHOL yangilanadi.
// Joriy INPUT qiymatlaridan vaqtinchalik cfg yig'iladi (hali saqlanmagan
// bo'lsa ham ko'rinadi). buildReceiptHtml (utils) ishlatiladi — u string
// qaytaradi, iframe'ga joylanadi. Chek turi: sotuv/qarz/savat.
// ═══════════════════════════════════════════════════════════
let _previewType = "sotuv";

function setPreviewType(t) {
  _previewType = t;
  document.querySelectorAll(".prev-tab").forEach(b => {
    const on = b.dataset.pt === t;
    b.classList.toggle("btn-acc", on);
    b.classList.toggle("btn-ghost", !on);
  });
  renderChekPreview();
}

// Joriy input qiymatlaridan vaqtinchalik chek-config yig'ish
function _livePreviewCfg() {
  return {
    logo:       (document.getElementById("chek-logo-preview")?.src || "").startsWith("data:") ? document.getElementById("chek-logo-preview").src : (db.settings?.chekConfig?.logo || ""),
    shopName:   db.shop?.name || "MERX",
    addr:       document.getElementById("chek-addr")?.value || "",
    tagline:    document.getElementById("chek-tagline")?.value || "Ulgurji savdo tizimi",
    footer:     document.getElementById("chek-footer")?.value || "Rahmat! Yana kutamiz 🙏",
    paperWidth: parseInt(document.getElementById("chek-paper")?.value) || 72,
    phones:     Array.isArray(window._chekPhones) ? window._chekPhones.slice() : [],
    contact:    (window._chekPhones || []).join(", "),
    extraLines: Array.isArray(window._chekExtra) ? window._chekExtra.slice() : [],
    showContact:     document.getElementById("chek-show-contact")?.checked !== false,
    showStaff:       document.getElementById("chek-show-staff")?.checked !== false,
    showDebtHistory: document.getElementById("chek-show-debt-history")?.checked !== false,
    fontScale:  document.getElementById("chek-font-scale")?.value  || "normal",
    fontFamily: document.getElementById("chek-font-family")?.value || "dm",
    footerItalic: document.getElementById("chek-footer-italic")?.checked !== false,
    footerBold:   document.getElementById("chek-footer-bold")?.checked === true,
  };
}

// Namuna (soxta) sotuv — preview uchun
function _previewSampleSale(type) {
  const rate = db.settings?.rate || 12800;
  const base = {
    chekNum: "CHK-NAMUNA-0001",
    date: new Date().toISOString().slice(0,10),
    time: "12:34",
    customerName: "Namuna Mijoz",
    customerPhone: "+998 90 000 00 00",
    staffName: "Sotuvchi",
    items: [
      { name: "LORO PIANA", variant: "Oq", art: "LR-01", qty: 6, qtyBox: 1, inBox: 6, sellMode: "karobka", unit: "dona", price: 550000, basePrice: 600000 },
      { name: "DANIEL'S", variant: "Ko'k", art: "Q-02", qty: 5, qtyBox: 1, inBox: 5, sellMode: "karobka", unit: "dona", price: 350000 },
    ],
    subtotal: 5050000, discount: 300000, total: 4750000,
  };
  if (type === "qarz") {
    return { ...base, remaining: 2000000, paid: 2750000, payType: "aralash",
      payBreakdown: { naqd: 1750000, karta: 1000000 },
      prevDebtUzs: 3000000, debtCurrency: "uzs", due: base.date };
  }
  if (type === "savat") {
    return { ...base, _preview: true, paid: 0, remaining: 0 };
  }
  // sotuv (nasiya bilan namuna)
  return { ...base, paid: 2750000, remaining: 2000000, payType: "aralash",
    payBreakdown: { naqd: 1750000, karta: 1000000 },
    prevDebtUzs: 3000000, debtCurrency: "uzs", due: base.date };
}

function renderChekPreview() {
  const frame = document.getElementById("chek-preview-frame");
  if (!frame) return;
  try {
    const cfg = _livePreviewCfg();
    let html = "";
    // 2026-07-18: har chek turi FARQLI ko'rsatiladi.
    // qarz — to'lov cheki (boshqa struktura) → showDebtPaymentReceipt uslubi.
    // sotuv/savat — buildReceiptHtml (type bilan: savatda to'lov/qarz yo'q).
    if (_previewType === "qarz" && typeof _buildDebtReceiptPreview === "function") {
      html = _buildDebtReceiptPreview(cfg);
    } else if (typeof buildReceiptHtml === "function") {
      const sale = _previewSampleSale(_previewType);
      html = buildReceiptHtml(sale, {
        type: _previewType,
        shopName: cfg.shopName, staffName: cfg.staffName || "Sotuvchi",
        logo: cfg.logo, addr: cfg.addr, contact: cfg.showContact ? cfg.contact : "",
        tagline: cfg.tagline, footer: cfg.footer, extraLines: cfg.extraLines,
        showStaff: cfg.showStaff, showContact: cfg.showContact,
        _previewCfg: cfg
      });
    }
    frame.srcdoc = html || "<div style='padding:20px;font-family:sans-serif;color:#999'>Preview mavjud emas</div>";
    // 2026-07-18: iframe balandligini chek uzunligiga moslashtirish (kesilmasin)
    frame.onload = () => {
      try {
        const doc = frame.contentDocument || frame.contentWindow.document;
        const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
        if (h > 100) frame.style.height = (h + 20) + "px";
      } catch (e) {}
    };
  } catch (e) {
    frame.srcdoc = "<div style='padding:20px;font-family:sans-serif;color:#c00'>Preview xatosi: " + (e.message||e) + "</div>";
  }
}

// Barcha chek inputlariga jonli tinglovchi ulash (bir marta)
function _bindChekPreviewInputs() {
  const ids = ["chek-addr","chek-tagline","chek-footer","chek-paper",
               "chek-show-contact","chek-show-staff","chek-show-debt-history",
               "chek-font-scale","chek-font-family","chek-footer-italic","chek-footer-bold"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.pvBound) {
      el.dataset.pvBound = "1";
      el.addEventListener("input", renderChekPreview);
      el.addEventListener("change", renderChekPreview);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// QARZ CHEKI PREVIEW (2026-07-18): namuna to'lov cheki (qarzlar.js uslubida).
// Preview'da qarz turi tanlanganda ishlatiladi — sotuv chekidan FARQLI
// struktura (To'landi / usul / qarz holati). Joriy sozlamalarni oladi.
// ═══════════════════════════════════════════════════════════
function _buildDebtReceiptPreview(cfg) {
  const F = n => Math.round(n||0).toLocaleString("ru-RU");
  const sc = ({ small:0.9, large:1.12, xlarge:1.25 })[cfg.fontScale] || (parseFloat(cfg.fontScale) >= 0.7 && parseFloat(cfg.fontScale) <= 1.5 ? parseFloat(cfg.fontScale) : 1);
  const ff = ({ mono:"'Courier New',monospace", serif:"'Georgia',serif", sans:"'Arial',sans-serif" })[cfg.fontFamily] || "'DM Sans',Arial,sans-serif";
  const fi = cfg.footerItalic !== false;
  const logo = cfg.logo, shopName = cfg.shopName || "MERX";
  const contact = cfg.showContact ? (cfg.contact || "") : "";
  const extra = Array.isArray(cfg.extraLines) ? cfg.extraLines.filter(Boolean) : [];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:${ff};margin:0;padding:0;display:flex;justify-content:center;background:#eee}
    .rc{width:300px;background:#fff;padding:0 0 10px;zoom:${sc}}
    .logo{text-align:center;padding:8px 6px 4px}.logo img{width:100%;max-height:64px;object-fit:contain}
    .hd{background:#0D1B2A;color:#fff;text-align:center;padding:12px 8px}
    .hd .nm{font-size:17px;font-weight:800;letter-spacing:.03em}.hd .sub{font-size:10.5px;color:rgba(255,255,255,.85);margin-top:2px}
    .sec{padding:7px 12px;border-bottom:1px dashed #ddd;font-size:12px}
    .lbl{font-size:9.5px;color:#777;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
    .r{display:flex;justify-content:space-between;margin:2px 0}
    .big{font-size:17px;font-weight:900;color:#0D1B2A;text-align:right}.grn{color:#059669}.red{color:#DC2626}
    .ft{text-align:center;font-size:10.5px;color:#555;padding:8px 6px 0;font-style:${fi?"italic":"normal"}}
    </style></head><body><div class="rc">
    ${logo ? `<div class="logo"><img src="${logo}"></div>` : ""}
    <div class="hd"><div class="nm">${shopName.toUpperCase()}</div>
      ${cfg.addr ? `<div class="sub">${cfg.addr}</div>` : ""}
      ${contact ? `<div class="sub" style="font-weight:700">${contact}</div>` : ""}
      <div class="sub">${cfg.tagline || "Ulgurji savdo tizimi"}</div></div>
    <div class="sec"><div class="r"><span style="font-weight:800;font-family:monospace">PAY-NAMUNA-0001</span><span>${new Date().toISOString().slice(0,10)}</span></div>
      <div class="r"><span>Namuna Mijoz</span><span>+998 90 000 00 00</span></div></div>
    <div class="sec"><div class="lbl">To'landi</div><div class="big grn">${F(1500000)} so'm</div></div>
    <div class="sec"><div class="lbl">To'lov usuli</div><div class="r"><span>Usul</span><span>Naqd pul</span></div></div>
    <div class="sec"><div class="lbl">Qarz holati</div>
      <div class="r"><span>Avvalgi qarz</span><span>${F(5000000)} so'm</span></div>
      <div class="r"><span>To'landi</span><span>${F(1500000)} so'm</span></div>
      <div class="r"><span>Qolgan qarz</span><span class="red">${F(3500000)} so'm</span></div>
      <div class="r"><span>Muddat</span><span style="font-weight:700">${new Date().toISOString().slice(0,10)}</span></div></div>
    <div class="ft">${cfg.footer || "Rahmat! Yana kutamiz 🙏"}</div>
    ${extra.length ? `<div style="text-align:center;font-size:11px;color:#333;padding:4px 6px">${extra.map(t=>`<div>${t}</div>`).join("")}</div>` : ""}
    </div></body></html>`;
}
