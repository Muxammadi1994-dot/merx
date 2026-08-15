// MERX egasi.js (admin.js) | v4.0 | 2026-06-24
// ================================================
// Admin Sozlamalar — Tab tizimi
// Tablar: dokon | narx | cloud | sms | tizim
// ================================================

// ── Aktiv tab ────────────────────────────────────
let _adminTab = "dokon";

// 2026-08-03: sana qurilma vaqtidan (utils.js dagi `today` bilan
// bir xil qoida). `toISOString()` UTC qaytaradi va tunda kechagi
// kunni yozadi — ulgurji do'konlar ertalab 3-4 da ish boshlaydi.
function _dStr(d) {
  const x = d instanceof Date ? d : new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

let _avvalgiTab = null;   // 2026-08-15: bo'lim chindan almashdimi
function adminTabSwitch(tab) {
  _adminTab = tab;
  // ✅ 2026-08-14: chek namunasi FAQAT o'z bo'limida chizilsin.
  // Boshqa bo'limga o'tganda tozalanadi — og'ir iframe sahifani
  // sekinlashtirib, "oyna qotib qoldi" holatini keltirardi.
  try {
    const _f = document.getElementById("chek-preview-frame");
    if (_f && tab !== "sms") { _f.srcdoc = ""; _f.style.height = "0px"; }
  } catch (e) {}
  // \U0001f534 2026-08-14: bo'lim almashganda SAHIFA TEPAGA qaytariladi.
  // Chek bo'limi juda uzun — undan qisqa bo'limga o'tilganda ekran
  // pastda qolib, tepadagi bo'lim tugmalari ko'rinmasdi va surib
  // chiqib bo'lmasdi ("oyna qotib qoldi" — egasining shikoyati).
  // \U0001f534 2026-08-15 ILDIZ-TUZATISH: surish FAQAT bo'lim CHINDAN
  // almashganda tepaga qaytariladi. Avval har chaqiruvda qaytarilardi —
  // sinxron kelganda sozlamalar sahifasi qayta chizilib, bu funksiya
  // O'SHA bo'lim bilan qayta chaqirilardi va ekran TEPAGA sakrardi
  // (egasining takroriy shikoyati: "chek sozlamalarini ko'ryapman,
  // bir necha bor tepaga otib yuboradi").
  if (_avvalgiTab !== tab) {
    try {
      const _p = document.getElementById("pages");
      if (_p) _p.scrollTop = 0;
    } catch (e) {}
  }
  _avvalgiTab = tab;
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
  // 2026-07-25: saqlash tugmasi avtomat rejimda kerak emas
  const saveBtn = $("s-rate-save");
  if (saveBtn) saveBtn.style.display = "none";
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
  const today = _dStr(new Date());
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
  const lbl  = (typeof currencyLabel === "function") ? currencyLabel(cur)
    : (cur === "usd" ? "USD" : cur === "both" ? "SO'M+USD" : "SO'M");
  return `${lbl} (1$=${fmt(rate)})`;
}

// ── saveSetting — o'zgarmadi ──────────────────────
// camelCase → bulut ustuni (server merge uchun)
const _SET_USTUN = {
  rate: "rate", rateMode: "rate_mode", rateUpdatedAt: "rate_updated_at",
  priceCurrency: "price_currency", showChakana: "show_chakana",
  name: "shop_name", shopType: "shop_type", ownerName: "owner_name",
  chekConfig: "chek_config", debtCols: "debt_cols",
  debtPayMethodsShown: "debt_pay_methods_shown",
  unitTags: "unit_tags", packUnitTags: "pack_unit_tags",
  expTagsKunlik: "exp_tags_kunlik", expTagsOylik: "exp_tags_oylik",
  lowStockLimit: "low_stock_limit", posPayBlocked: "pos_pay_blocked",
  posStaffLocked: "pos_staff_locked",
  loyaltyRate: "loyalty_rate", loyaltyValue: "loyalty_value",
  eskizToken: "eskiz_token", eskizSender: "eskiz_sender",
  telegramBotUrl: "telegram_bot", telegramBotUsername: "telegram_bot_username",
  staffGroupId: "staff_group_id", extServices: "ext_services",
  serverPay: "server_pay"
};

function saveSetting(key, val) {
  if (!db.settings) db.settings = {};
  db.settings[key] = val;
  saveDB();
  // ✅ 2026-08-14 (4-band): SERVER REJIMIDA sozlamani SERVER yozadi —
  // FAQAT o'zgargan maydonni (merge). Avval butun qator qayta
  // yozilardi va boshqa kassa yangilagan maydonlar bosilardi
  // (chek shiori yo'qolishi, `server_pay` false bo'lib qolishi).
  try {
    const ustun = _SET_USTUN[key];
    if (ustun && typeof _serverRejimi === "function" && _serverRejimi() &&
        typeof _serverPay === "function") {
      _serverPay({ action: "settings", patch: { [ustun]: val } })
        .then(r => { if (!r || !r.ok) console.warn("Sozlama serverga yozilmadi:",
                        (r && r.error) || "?"); })
        .catch(e => console.warn("Sozlama serverga yozilmadi:", e.message));
    }
  } catch (e) {}
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
// ══════════════════════════════════════════════════════════════
// EGASI KIRISH MA'LUMOTINI O'ZGARTIRADI (2026-08-03)
// ══════════════════════════════════════════════════════════════
// ⚠️ AVVAL NIMA XATO EDI:
//   1. Faqat LOKAL bazaga yozilardi — Supabase Auth hisobiga
//      UMUMAN tegilmasdi. Egasi loginini o'zgartirsa, keyingi
//      kirishda "Invalid login credentials" chiqib, ilova `anon`
//      yo'liga tushardi. Shoetestda aynan shu bo'lgan.
//   2. Parol XESHSIZ saqlanardi (`adminPass = pass`), holbuki
//      `auth.js` da sha256 bilan saqlanadi.
//   3. Joriy parol so'ralmasdi — ochiq qolgan qurilmada kim
//      bo'lsa ham loginni o'zgartira olardi.
//
// ENDI: server orqali, joriy parol bilan tasdiqlanadi. Server
// haqiqiy kirish qilib ko'radi — parol noto'g'ri bo'lsa rad etadi.
async function saveAdminCreds() {
  const email   = ($("s-admin-email")  ||{value:""}).value.trim().toLowerCase();
  const pass    = ($("s-admin-pass")   ||{value:""}).value;
  const curPass = ($("s-admin-curpass")||{value:""}).value;

  if (!email) { toast("Email kiriting","err"); return; }
  if (pass && pass.length < 6) { toast("Yangi parol kamida 6 ta belgi","err"); return; }

  const eskiEmail = (db.settings?.adminEmail || "").toLowerCase();
  const emailOzgardi = email !== eskiEmail;
  if (!emailOzgardi && !pass) { toast("O'zgarish yo'q","info"); return; }

  if (!curPass) {
    toast("Joriy parolni kiriting — xavfsizlik uchun majburiy","err");
    $("s-admin-curpass")?.focus();
    return;
  }

  const btnTxt = "Saqlanmoqda...";
  try {
    const r = await fetch("/api/auth-v2?action=owner_update_creds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId: db.settings?.cloudShopId || null,
        currentEmail: eskiEmail || email,
        currentPassword: curPass,
        newEmail: emailOzgardi ? email : "",
        newPassword: pass || ""
      })
    });
    const d = await r.json();
    if (!d.ok) {
      toast("⚠️ " + (d.error || "O'zgartirilmadi"), "err");
      return;
    }

    // Server tasdiqladi — endi lokal nusxani ham yangilaymiz
    if (!db.settings) db.settings = {};
    db.settings.adminEmail = d.email || email;
    // ⚠️ Parol XESH bilan (auth.js dagi qoida)
    if (pass && typeof sha256 === "function") {
      db.settings.adminPass = await sha256(pass);
    }
    if (typeof getAuthUser === "function") {
      const u = getAuthUser();
      if (u) { u.email = d.email || email; if (typeof authSave === "function") authSave(u); }
    }
    saveDB();

    ["s-admin-pass","s-admin-curpass"].forEach(id => {
      const e = $(id); if (e) { e.value = ""; e.blur(); }
    });

    const nima = [];
    if (d.changed?.email)    nima.push("login");
    if (d.changed?.password) nima.push("parol");
    toast(`✅ ${nima.join(" va ")} o'zgartirildi — keyingi kirishda ishlatiladi`);
  } catch (e) {
    toast("⚠️ Serverga ulanib bo'lmadi: " + e.message, "err");
  }
}

// ── renderEgasi (renderAdmin) — barcha tablarni to'ldiradi ──
function renderEgasi() {
  // 2026-07-26: valyuta rejimi qat'iy bo'lsa tanlovni yopamiz
  try { applyCurrencyLock(); } catch(e) {}
  // 2026-07-26: chek valyuta sozlamasini formaga tiklaymiz
  try { loadChekDualSetting(); } catch(e) {}
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
  // 2026-07-30: bu ikki maydonga HAQIQIY qiymat qo'yilmaydi.
  // Sabab: ular yopiq (readonly) va kodda HECH QAYERDA o'qilmaydi —
  // ilova kalitlarni faqat db.settings dan oladi. Ekranga chiqarishning
  // hojati yo'q, chiqarilsa esa brauzer ularni parol deb hisoblab
  // "parolni saqlaymizmi?" oynasini chiqaraverardi.
  const _MASK = "••••••••••••••••••••";
  if ($("s-sup-url")) $("s-sup-url").value = url ? _MASK : "";
  if ($("s-sup-key")) $("s-sup-key").value = key ? _MASK : "";
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
  const ceHdr = document.getElementById("chek-header-style");
  if (ceHdr)     ceHdr.value     = chekCfg.headerStyle || "dark";
  // 2026-08-15: ceUni olib tashlandi (tugma yo'q)
    // 2026-08-15: "yagona sotuv cheki" tugmasi olib tashlandi (doimiy yoqiq)
  // Qadam D (per-type): har chek turi uchun ALOHIDA blok sozlamalari.
  // _chekBlocksAll = {umumiy:{}, sotuv:{}, qarz:{}, savat:{}}. Joriy tahrir
  // turi _previewType (Sotuv/Qarz/Savat tugmasi bilan almashadi).
  const _rawCfg = (typeof db !== "undefined" && db.settings && db.settings.chekConfig) || {};
  window._chekBlocksAll = {
    umumiy: (chekCfg.blocks && typeof chekCfg.blocks === "object") ? JSON.parse(JSON.stringify(chekCfg.blocks)) : {},
    sotuv:  _perTypeBlocks(_rawCfg, "sotuv"),
    qarz:   _perTypeBlocks(_rawCfg, "qarz"),
    savat:  _perTypeBlocks(_rawCfg, "savat"),
  };
  _loadBlocksForType(_previewType || "sotuv");
  if (ceFooter)  ceFooter.value  = chekCfg.footer   || "Rahmat! Yana kutamiz 🙏";
  if (ceStaff)   ceStaff.checked   = chekCfg.showStaff   !== false;
  if (ceContact2) ceContact2.checked = chekCfg.showContact !== false;
  if (ceDebtH)   ceDebtH.checked  = chekCfg.showDebtHistory !== false;
  // ══ USLUB TANLOVLARI (2026-08-12: yagona ro'yxat) ════════
  // Avval uch joyda uch xil ro'yxat bor edi va kartalar (To'liq/Ixcham/
  // Jadval) amaldagi uslublardan farq qilardi. Endi BITTA manba.
  // ⚠️ 2026-08-12 (TUZATILDI): standart BIRINCHI, eski uslublar ham
  // ro'yxatda — hech biri yo'qolmaydi (365 da "To'liq" tushib qolgandi).
  const CHEK_USLUBLAR = [
    // "To'liq (eski)" OLIB TASHLANDI: kodda u uchun alohida chizuvchi
    // yo'q edi — "Yagona" bilan AYNAN bir xil chek berardi (ikkita bir
    // xil nom chalkashtirardi). Eski `full` qiymati yuklashda
    // "unified" ga o'giriladi — natija o'zgarmaydi.
    { v:"unified",   l:"Yagona — hozirgi standart" },
    { v:"merx",      l:"MERX brend (zamonaviy)" },
    { v:"thermal",   l:"Termal (tor, tejamkor)" },
    { v:"wholesale", l:"Ulgurji (model + $ va so'm)" },
    // "Ixcham" RO'YXATDAN OLINDI (2026-08-12, egasining qarori): Termal
    // bilan deyarli bir xil edi, alohida foydasi yo'q. Chizuvchi
    // (buildReceiptCompact) KODDA QOLADI — eski saqlangan qiymat
    // bo'lgan do'konda chek buzilmasin (mavjud funksiyaga tegmaymiz).
    { v:"table",     l:"Jadval (USD + so'm)" },
  ];
  const _fillStyle = (el, val) => {
    if (!el) return;
    el.innerHTML = CHEK_USLUBLAR.map(o =>
      `<option value="${o.v}">${o.l}</option>`).join("");
    el.value = val || "merx";
  };
  // Eski/o'lik qiymatlar ekranda ham HAQIQATNI ko'rsatsin: styleV2
  // muhri yo'q bo'lsa chek hozir "unified" da chiziladi — ro'yxat ham
  // shuni ko'rsatadi (aks holda ega "merx tanlangan" deb o'ylardi).
  const _sv2 = chekCfg.styleV2 === true;
  const _norm = v => (!_sv2 || !v || v === "full") ? "unified" : v;
  _fillStyle(cePosStyle,   _norm(chekCfg.posStyle));
  _fillStyle(ceTarixStyle, _norm(chekCfg.tarixStyle));
  _fillStyle(ceQarzStyle,  _norm(chekCfg.qarzStyle));
  try { ceMarkStyle(); } catch (e) {}
  try { csInitCards(); } catch (e) {}
  try { csLoadStyleOpts(); } catch (e) {}

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
// ROLE_PERMS_TABLE olib tashlandi (2026-08-02): faqat ko'rsatuvchi
// jadval edi, hech narsani boshqarmasdi. Ruxsatlar endi har xodimga
// alohida beriladi (xodimlar.js → PERM_PAGES).

function renderAdminXodimlar() {
  // Rol jadvali
  // (rol jadvali olib tashlandi)


  // 2026-08-12: tashqi xizmatlar paneli
  try { tsRender(); } catch (e) {}
  try { _loadServerPay(); } catch (e) {}

  // Xodimlar ruxsatlari (panel olib tashlandi — null bo'lsa jim o'tadi)
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

  // \u2705 2026-08-14 (egasining talabi): KO'RINISH sozlamalari TANLANGAN
  // USLUBGA yoziladi (qog'oz, shrift, fon, shior, matn, bloklar).
  // DO'KON ma'lumotlari (logo, manzil, telefon) UMUMIY qoladi \u2014 ular
  // do'konniki, chek turiga bog'liq emas.
  // \u26a0\ufe0f Element mavjud bo'lsagina o'qiladi \u2014 chizilmagan maydon
  // eski qiymatni O'CHIRIB yubormasin (\u00a713.32 oilasidagi kasal).
  const _st = _csStyleNow ? _csStyleNow() : "unified";
  if (!cfg.perStyle) cfg.perStyle = {};
  const _sc = cfg.perStyle[_st] || {};
  const _rd = (id) => { const el = document.getElementById(id); return el ? el.value : undefined; };

  // ✅ 2026-08-14 (egasining talabi) — CHEGARA:
  //   TEPA BLOK (logo, manzil, shior, qog'oz, shrift, sarlavha foni)
  //   → UMUMIY: bir o'zgartirish BARCHA 5 ko'rinishga tegadi.
  //   PAST BLOK (yagona-chek, ikki valyuta, bloklar, telefonlar,
  //   altbilgi, qo'shimcha matn, ko'rsatish belgilagichlari)
  //   → HAR USLUB uchun ALOHIDA.
  { const v = _rd("chek-addr");         if (v !== undefined) cfg.addr        = v; }
  { const v = _rd("chek-tagline");      if (v !== undefined) cfg.tagline     = v; }
  { const v = _rd("chek-paper");        if (v !== undefined) cfg.paperWidth  = parseInt(v) || 72; }
  { const v = _rd("chek-font-scale");   if (v !== undefined) cfg.fontScale   = v; }
  { const v = _rd("chek-font-family");  if (v !== undefined) cfg.fontFamily  = v; }
  { const v = _rd("chek-header-style"); if (v !== undefined) cfg.headerStyle = v; }
  // ⚠️ 2026-08-15: bu qator OLIB TASHLANDI. Tugma yo'q bo'lgani uchun
  // u har saqlashda `unifiedSotuv: false` yozib, chek quruvchisini
  // O'CHIRIB qo'yardi — sozlamalar yana chekka ta'sir qilmay qolardi.
  // Qadam D (per-type): avval joriy tahrirni _chekBlocksAll'ga saqlaymiz
  _saveCurrentBlocks();
  const _all = window._chekBlocksAll || {};
  // ✅ 2026-08-14: BLOK o'lchamlari ham TANLANGAN USLUBGA yoziladi
  {
    const _b = (_all.umumiy && Object.keys(_all.umumiy).length) ? _all.umumiy : null;
    if (_b) _sc.blocks = _b; else delete _sc.blocks;
  }
  cfg.perType = cfg.perType || {};
  ["sotuv","qarz","savat"].forEach(t => {
    if (_all[t] && Object.keys(_all[t]).length) {
      cfg.perType[t] = cfg.perType[t] || {};
      cfg.perType[t].blocks = _all[t];
    } else if (cfg.perType[t]) {
      delete cfg.perType[t].blocks;
    }
  });
  // 2026-07-18 (2-bosqich): telefonlar massivi + qo'shimcha matnlar.
  // Eski "contact" (vergulli) o'rniga phones[]; getChekCfg ikkalasini biladi.
  // ✅ 2026-08-14: telefonlar va qo'shimcha matn — PAST BLOK, ya'ni
  // HAR USLUB uchun alohida (egasining talabi).
  _sc.phones     = Array.isArray(window._chekPhones) ? window._chekPhones.slice() : [];
  _sc.contact    = _sc.phones.join(", ");
  _sc.extraLines = Array.isArray(window._chekExtra) ? window._chekExtra.slice() : [];
  // Moslik: bot va eski oqimlar `cfg.contact` ni o'qiydi
  if (!cfg.contact) cfg.contact = _sc.contact;
  if (!Array.isArray(cfg.phones) || !cfg.phones.length) cfg.phones = _sc.phones.slice();
  // ⚠️ 2026-08-12: STANDART MATN FOYDALANUVCHINIKINI BOSMAYDI.
  // Avval `el?.value || "Rahmat! Yana kutamiz"` edi — maydon hali
  // chizilmagan (yoki bo'sh) bo'lsa, standart matn adminning o'z
  // yozuvini O'CHIRIB yozardi. Endi element mavjud bo'lsagina
  // o'qiladi; yo'q bo'lsa avvalgi qiymat saqlanadi.
  {
    const _fEl = document.getElementById("chek-footer");
    // ✅ 2026-08-14: pastki matn ham USLUBGA tegishli
    if (_fEl) _sc.footer = _fEl.value;
  }
  // ✅ 2026-08-14 (egasining talabi): belgilagichlar ham TANLANGAN
  // USLUBGA tegishli — kassir, aloqa, qarz tarixi, ikki valyuta.
  {
    const _ck = (id) => { const el = document.getElementById(id);
      return el ? (el.checked !== false) : undefined; };
    let v;
    v = _ck("chek-show-staff");         if (v !== undefined) _sc.showStaff       = v;
    v = _ck("chek-show-contact");       if (v !== undefined) _sc.showContact     = v;
    v = _ck("chek-show-debt-history");  if (v !== undefined) _sc.showDebtHistory = v;
    v = _ck("chek-dual-cur");           if (v !== undefined) _sc.dualCurrency    = v;
    // 2026-08-15: "yagona sotuv cheki" tugmasi olib tashlandi (doimiy yoqiq)
  }
  // ⚠️ 2026-08-12: STANDART QIYMAT TANLANGANNI BOSMAYDI (kecha
  // footer matnida topilgan `el?.value || "standart"` kasalining
  // o'sha oilasi). Element yo'q yoki ro'yxat hali to'lmagan bo'lsa —
  // avvalgi tanlov SAQLANADI, "merx" ga tushib qolmaydi.
  {
    const _sty = (id, eski) => {
      const el = document.getElementById(id);
      // \U0001f534 2026-08-15: `dataset.pick` USTUVOR — ro'yxatda variant
      // bo'lmasa `value` bo'sh qoladi va tanlov yo'qolardi.
      const v  = (el && (el.dataset.pick || el.value)) || "";
      return v ? v : (eski || "unified");
    };
    cfg.posStyle   = _sty("chek-pos-style",   cfg.posStyle);
    cfg.tarixStyle = _sty("chek-tarix-style", cfg.tarixStyle);
    cfg.qarzStyle  = _sty("chek-qarz-style",  cfg.qarzStyle);
    // ✅ Muhr: shu saqlashdan boshlab tanlov KUCHGA KIRADI.
    cfg.styleV2 = true;
    // ✅ USLUB SOZLAMALARI (2026-08-12): faqat TANLANGAN uslub uchun.
    // Bo'sh maydon — umumiy sozlamadan olinadi (kalit o'chiriladi).
    try {
      // 2026-08-14: sozlamalar SOTUV uslubiga yoziladi
      const _st = cfg.posStyle || "unified";
      if (!cfg.perStyle) cfg.perStyle = {};
      const _o = cfg.perStyle[_st] || {};
      const _put = (id, key, num) => {
        const el = document.getElementById(id);
        if (!el) return;
        const v = (el.value || "").trim();
        if (v === "") delete _o[key];
        else _o[key] = num ? (parseInt(v) || undefined) : v;
      };
      _put("cs-paper",  "paperWidth", true);
      _put("cs-header", "headerStyle");
      _put("cs-font",   "fontScale");
      _put("cs-footer", "footer");
      // Blok o'lchamlari — shu uslub uchun
      const _bl = _o.blocks || {};
      const _putB = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        const v = (el.value || "").trim();
        if (v === "") { if (_bl[key]) delete _bl[key].size;
                        if (_bl[key] && !Object.keys(_bl[key]).length) delete _bl[key]; }
        else { _bl[key] = { ...(_bl[key] || {}), size: v + "px" }; }
      };
      _putB("cs-b-shop",  "shop");
      _putB("cs-b-item",  "itemName");
      _putB("cs-b-total", "total");
      if (Object.keys(_bl).length) _o.blocks = _bl; else delete _o.blocks;

      if (Object.keys(_o).length) cfg.perStyle[_st] = _o;
      else delete cfg.perStyle[_st];
    } catch (e) {}
  }

  // ✅ Uslub sozlamalarini joyiga qo'yamiz (bo'sh bo'lsa kalit o'chadi)
  if (Object.keys(_sc).length) cfg.perStyle[_st] = _sc;
  else delete cfg.perStyle[_st];
  cfg.styleV2 = true;   // tanlov endi KUCHGA kiradi

  db.settings.chekConfig = cfg;
  saveDB();
  // ✅ 2026-08-15: chek sozlamalari ham SERVER orqali maydon-merge
  // bilan yoziladi (14-avgustdagi 4-band mexanizmi). Shu bilan ikki
  // kassa bir vaqtda sozlama o'zgartirsa biri ikkinchisini bosmaydi
  // va o'zgarish barcha qurilmalarga tezroq yetadi.
  try {
    if (typeof _serverRejimi === "function" && _serverRejimi() &&
        typeof _serverPay === "function") {
      _serverPay({ action: "settings", patch: { chek_config: cfg } })
        .then(r => { if (!r || !r.ok)
          console.warn("Chek sozlamasi serverga yozilmadi:", (r && r.error) || "?"); })
        .catch(e => console.warn("Chek sozlamasi serverga yozilmadi:", e.message));
    }
  } catch (e) {}
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
    date: _dStr(new Date()),
    time: new Date().toLocaleTimeString("uz-UZ").slice(0,5),
    payType: "naqd",
    // 2026-08-12: namuna boyitildi — ulgurji uslubi MODEL (art), rang,
    // pochka va ikki valyutani ko'rsatadi; usiz namuna chala ko'rinardi.
    items: [
      { name: "Krossovka", art: "W4149-4YS", color: "Ko'k", size: "42",
        variant: "Ko'k / 42", qty: 12, price: 850000, unit: "juft",
        sellMode: "karobka", qtyBox: 2, inBox: 6, groupSizes: "40-45" },
      { name: "Futbolka",  art: "C10200", color: "Oq", size: "L",
        variant: "Oq / L", qty: 3, price: 120000, unit: "dona" },
    ],
    total: 10560000, paid: 4000000, remaining: 6560000,
    discount: 0, debtCurrency: "uzs",
    rate: (db.settings?.rate || 12100),
    customerName: "Alisher Karimov", customerPhone: "+998 90 123 45 67",
    prevDebtUzs: 500000, due: "2026-07-15"
  };
  const staffObj = db.staff?.[0];
  // ✅ 2026-08-12: namuna endi USLUB SOZLAMALARINI ham hisobga oladi
  // (qog'oz eni, sarlavha foni, shrift) — avval umumiy sozlama bilan
  // chizardi va "58mm qo'ydim, namunada ko'rinmadi" holati bo'lardi.
  const _pv = (() => {
    try {
      const c = (db.settings && db.settings.chekConfig) || {};
      const o = (c.perStyle && c.perStyle[style]) || {};
      const base = (typeof getChekCfg === "function") ? getChekCfg("sotuv") : {};
      return { ...base, ...o };
    } catch (e) { return null; }
  })();
  const html = buildReceiptHtml(testSale, {
    shopName: db.shop?.name || "MERX",
    staffName: staffObj?.name || "Kassir",
    style, type: "sotuv",
    ...(_pv ? { _previewCfg: _pv } : {})
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
  // Qadam D (per-type): tur almashishdan OLDIN joriy blokni saqlaymiz,
  // keyin yangi tur blokini yuklaymiz — har chek turi mustaqil.
  if (typeof _saveCurrentBlocks === "function") _saveCurrentBlocks();
  _previewType = t;
  document.querySelectorAll(".prev-tab").forEach(b => {
    const on = b.dataset.pt === t;
    b.classList.toggle("btn-acc", on);
    b.classList.toggle("btn-ghost", !on);
  });
  if (typeof _loadBlocksForType === "function") _loadBlocksForType(t);
  // ✅ 2026-08-14: BIR MARTA bosilishi bilan yangilansin. Avval
  // iframe eski mazmun bilan qolib, ikkinchi bosishda yangilanardi
  // (srcdoc bir xil bo'lsa brauzer qayta yuklamaydi).
  // ⚠️ 2026-08-14: srcdoc tozalanmaydi (sahifa sakramasin)
  renderChekPreview();
  // ⚠️ 2026-08-14: takroriy chizish OLIB TASHLANDI — oyna balandligi
  // ikki marta o'zgarib, sahifa yuqoriga sakrardi (egasining shikoyati).
}

// ─── Qadam D (per-type) yordamchilari (2026-07-19) ───
function _perTypeBlocks(rawCfg, type) {
  const pt = rawCfg && rawCfg.perType && rawCfg.perType[type];
  return (pt && pt.blocks && typeof pt.blocks === "object")
    ? JSON.parse(JSON.stringify(pt.blocks)) : {};
}
// Joriy turdagi tahrirni _chekBlocks -> _chekBlocksAll[tur] ga ko'chiradi
function _saveCurrentBlocks() {
  window._chekBlocksAll = window._chekBlocksAll || {};
  const t = _previewType || "sotuv";
  window._chekBlocksAll[t] = (window._chekBlocks && Object.keys(window._chekBlocks).length)
    ? JSON.parse(JSON.stringify(window._chekBlocks)) : {};
}
// Tanlangan tur blokini tahrirga (_chekBlocks) yuklaydi. Agar shu tur uchun
// maxsus sozlama yo'q bo'lsa — umumiydan meros (bo'sh = standart ko'rinish).
function _loadBlocksForType(type) {
  const all = window._chekBlocksAll || {};
  const specific = all[type] && Object.keys(all[type]).length ? all[type] : null;
  const src = specific || all.umumiy || {};
  window._chekBlocks = JSON.parse(JSON.stringify(src));
  if (typeof renderChekBlocks === "function") renderChekBlocks();
}


// Joriy input qiymatlaridan vaqtinchalik chek-config yig'ish
// ✅ 2026-08-14: namuna va sozlamalar TANLANGAN USLUB darajasida.
// Qatlam: uslub sozlamasi (perStyle) > umumiy (chekConfig) > standart.
// Do'kon ma'lumotlari (logo, manzil, telefon) UMUMIY qoladi — ular
// do'konniki, chek turiga bog'liq emas.
function _csStyleNow() {
  try {
    const el = document.getElementById("chek-pos-style");
    return (el && (el.dataset.pick || el.value)) || "unified";
  } catch (e) { return "unified"; }
}
function _csStyleCfg(base) {
  try {
    const c  = (db.settings && db.settings.chekConfig) || {};
    const st = _csStyleNow();
    const o  = (c.perStyle && c.perStyle[st]) || {};
    return { ...base, ...o };
  } catch (e) { return base; }
}

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
    headerStyle:  document.getElementById("chek-header-style")?.value || "dark",
    // ✅ 2026-08-15: namunada ham IKKI VALYUTA sozlamasi hisobga olinsin —
    // avval bu maydon ro'yxatda yo'q edi, shuning uchun namunada har doim
    // yoqiq ko'rinardi (haqiqiy chekda esa to'g'ri ishlardi).
    dualCurrency: document.getElementById("chek-dual-cur")?.checked !== false,
    fontFamily:   document.getElementById("chek-font-family")?.value || "dm",
    fontScale:    document.getElementById("chek-font-scale")?.value || "normal",
    extraLines:   Array.isArray(window._chekExtra) ? window._chekExtra.slice() : [],
    blocks:       (window._chekBlocks && Object.keys(window._chekBlocks).length) ? window._chekBlocks : null, // joriy tur (per-type)
  };
}

// Namuna (soxta) sotuv — preview uchun
function _previewSampleSale(type) {
  const rate = db.settings?.rate || 12800;
  const base = {
    // ✅ 2026-08-15: NAMUNA — "Bulutga yuborilmagan" eslatmasi chiqmasin
    serverWritten: true,
    chekNum: "CHK-NAMUNA-0001",
    date: _dStr(new Date()),
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
    const _c  = db.settings?.priceCurrency || "uzs";
    const _r  = db.settings?.rate || 12800;
    const _ds = (_c === "uzs")
      ? { prevDebtUzs: 3000000, debtCurrency: "uzs" }
      : { prevDebtUsd: +(3000000 / _r).toFixed(2),
          debtUsd:     +(2000000 / _r).toFixed(2), debtCurrency: "usd" };
    return { ...base, remaining: 2000000, paid: 2750000, payType: "aralash",
      payBreakdown: { naqd: 1750000, karta: 1000000 },
      ..._ds, due: base.date };
  }
  if (type === "savat") {
    return { ...base, _preview: true, paid: 0, remaining: 0 };
  }
  // sotuv (nasiya bilan namuna)
  // 2026-07-25: namuna JORIY valyuta rejimiga moslashadi — foydalanuvchi
  // o'z sozlamasiga mos ko'rinishni ko'rsin (avval har doim so'm edi).
  const _cur  = db.settings?.priceCurrency || "uzs";
  const _rate = db.settings?.rate || 12800;
  const _debtSample = (_cur === "uzs")
    ? { prevDebtUzs: 3000000, debtCurrency: "uzs" }
    : { prevDebtUsd: +(3000000 / _rate).toFixed(2),
        debtUsd:     +(2000000 / _rate).toFixed(2),
        debtCurrency: "usd" };

  return { ...base, paid: 2750000, remaining: 2000000, payType: "aralash",
    payBreakdown: { naqd: 1750000, karta: 1000000 },
    // 2026-07-26: namuna JORIY rejim va kursda ko'rsatiladi
    priceCurrency: _cur, rate: _rate,
    ..._debtSample, due: base.date };
}

// 2026-07-26: "ikki valyuta" sozlamasini formaga tiklash
function loadChekDualSetting() {
  const el = document.getElementById("chek-dual-cur");
  if (el) el.checked = db.settings?.chekDualCurrency !== false;
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
    // \U0001f534 2026-08-15: NAMUNA HAQIQIY CHIZUVCHINI ishlatadi.
    // Avval `_buildDebtReceiptPreview` degan ALOHIDA nusxa chizardi —
    // u pastdagi uslub tanloviga (qarzStyle) BOG'LANMAGAN edi.
    // Termal tanlansa ham namunada "yagona" ko'rinardi va qarz
    // chekiga qilingan tuzatishlar unda aks etmasdi (egasining
    // kuzatuvi). Endi manba bitta: buildPayReceiptStyled.
    if (_previewType === "qarz" && typeof buildPayReceiptStyled === "function") {
      const _qEl = document.getElementById("chek-qarz-style");
      const _qSt = (_qEl && (_qEl.dataset.pick || _qEl.value)) || "unified";
      html = buildPayReceiptStyled(_previewPayment(), {
        style: _qSt,
        shopName: cfg.shopName,
        staffName: cfg.staffName || "Sotuvchi",
        cfg
      });
    } else if (typeof buildReceiptHtml === "function") {
      const sale = _previewSampleSale(_previewType);
      // ✅ 2026-08-14: namuna TANLANGAN USLUBDA chiziladi — karta
      // bosilganda o'ng tomonda darhol o'sha chek ko'rinadi.
      const _st = (document.getElementById("chek-pos-style") || {}).value || "unified";
      html = buildReceiptHtml(sale, {
        style: _st,
        type: _previewType,
        shopName: cfg.shopName, staffName: cfg.staffName || "Sotuvchi",
        logo: cfg.logo, addr: cfg.addr, contact: cfg.showContact ? cfg.contact : "",
        tagline: cfg.tagline, footer: cfg.footer, extraLines: cfg.extraLines,
        showStaff: cfg.showStaff, showContact: cfg.showContact,
        _previewCfg: cfg
      });
    }
    // ✅ 2026-08-14: noyob belgi — mazmun bir xil bo'lsa ham brauzer
    // qayta chizadi (avval "ikki marta bosish kerak" muammosi bor edi).
    // ✅ 2026-08-14: bir xil mazmun QAYTA chizilmaydi — aks holda
    // oyna qayta yuklanib, sahifa surilishi buzilardi.
    const _yangi = html || "<div style='padding:20px;font-family:sans-serif;color:#999'>Preview mavjud emas</div>";
    if (frame._oxirgi === _yangi) return;    // o'zgarish yo'q
    frame._oxirgi = _yangi;
    if (!frame.style.height || frame.style.height === "0px")
      frame.style.minHeight = "300px";
    frame.srcdoc = _yangi;
    // 2026-07-19: iframe chek TO'LIQ uzunligiga cho'ziladi (skrollsiz) —
    // o'ng ustun chap sozlamalar balandligича tabiiy egallaydi.
    frame.onload = () => {
      try {
        const doc = frame.contentDocument || frame.contentWindow.document;
        const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
        // ✅ 2026-08-14: balandlik faqat SEZILARLI o'zgarishda yangilanadi.
        // Har chizishda o'zgartirilsa sahifa "sakrardi" — surish
        // joyidan uchib ketardi (egasining shikoyati).
        const yangi = Math.min(h + 10, 760);
        const eski  = parseInt(frame.style.height) || 0;
        if (h > 100 && Math.abs(yangi - eski) > 24) {
          frame.style.height = yangi + "px";
          frame.style.minHeight = "";
        }
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
               "chek-font-scale","chek-font-family","chek-header-style"];
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
// ⚠️ 2026-08-15: `_buildDebtReceiptPreview` OLIB TASHLANDI (~4.7 KB).
// U qarz chekining IKKINCHI nusxasi edi va uslub tanloviga
// bog'lanmagan edi — "bir joyni tuzatib ikkinchisi eskicha qolishi"
// xavfi shundan. Endi namuna ham, haqiqiy chek ham bitta manbadan:
// buildPayReceiptStyled (utils.js).
// \U0001f534 2026-08-15 TIKLANDI: bu ro'yxat men o'chirgan
// `_buildDebtReceiptPreview` funksiyasining ICHIDA turgan ekan —
// funksiya o'chirilgach "_CHEK_BLOCK_DEFS is not defined" xatosi
// chiqdi va Sozlamalar buzildi (egasining shikoyati).
// Kalitlar chizuvchidagi nomlar bilan AYNAN bir xil bo'lishi shart
// (\u00a74: shop, tagline, meta, itemName, itemPrice, total, debt, footer).
const _CHEK_BLOCK_DEFS = [
  { key: "shop",      label: "Do'kon nomi (tepa)",        dSize: 20, canHide: false },
  { key: "tagline",   label: "Shior (do'kon nomi ostida)", dSize: 10, canHide: true  },
  { key: "meta",      label: "Ma'lumotlar (sotuv/sana/mijoz)", dSize: 12, canHide: true },
  { key: "itemName",  label: "Tovar nomi",                dSize: 11, canHide: false },
  { key: "itemPrice", label: "Tovar narxi / hisobi",      dSize: 9,  canHide: false },
  { key: "total",     label: "JAMI / summalar",           dSize: 20, canHide: false },
  { key: "debt",      label: "Qarz bo'limi",              dSize: 12, canHide: true  },
  { key: "footer",    label: "Altbilgi (pastdagi yozuv)", dSize: 13, canHide: true  }
];

function renderChekBlocks() {
  const box = document.getElementById("chek-blocks-box");
  if (!box) return;
  const B = window._chekBlocks || {};
  box.innerHTML = _CHEK_BLOCK_DEFS.map(def => {
    const b = B[def.key] || {};
    const size = parseInt(b.size) || def.dSize;
    const bold = b.bold === true, ital = b.italic === true;
    const align = ["left","center","right"].includes(b.align) ? b.align : "";
    const show = b.show !== false;
    const aBtn = (val, icon, title) => `<button type="button" title="${title||''}" onclick="setBlockAlign('${def.key}','${val}')" style="border:1px solid ${align===val?'var(--acc)':'var(--brd)'};background:${align===val?'var(--acc)':'#fff'};color:${align===val?'#fff':'#555'};border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:13px"><i class="ti ti-align-${icon}"></i></button>`;
    return `
    <div style="border:1px solid var(--brd);border-radius:9px;padding:10px 12px;background:#fff">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
        <span style="font-size:12.5px;font-weight:700;color:#0D1B2A">${def.label}</span>
        ${def.canHide ? `<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:#555;cursor:pointer"><input type="checkbox" ${show?"checked":""} onchange="setBlockShow('${def.key}',this.checked)" style="width:15px;height:15px;accent-color:var(--acc)"> Ko'rsatish</label>` : ""}
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:11px;color:#777">O'lcham</span>
          <input type="number" min="6" max="40" value="${size}" onchange="setBlockSize('${def.key}',this.value)" style="width:52px;font-family:inherit;font-size:13px;border:1px solid var(--brd);border-radius:6px;padding:5px 6px;text-align:center">
          <span style="font-size:11px;color:#aaa">px</span>
        </div>
        <button type="button" onclick="toggleBlock('${def.key}','bold')" style="border:1px solid ${bold?'var(--acc)':'var(--brd)'};background:${bold?'var(--acc)':'#fff'};color:${bold?'#fff':'#555'};border-radius:6px;width:30px;height:30px;cursor:pointer;font-weight:800;font-size:13px">B</button>
        <button type="button" onclick="toggleBlock('${def.key}','italic')" style="border:1px solid ${ital?'var(--acc)':'var(--brd)'};background:${ital?'var(--acc)':'#fff'};color:${ital?'#fff':'#555'};border-radius:6px;width:30px;height:30px;cursor:pointer;font-style:italic;font-size:13px">I</button>
        <div style="display:flex;gap:3px;margin-left:auto">${aBtn("left","left","Chapga")}${aBtn("center","center","O'rtaga")}${aBtn("right","right","O'ngga")}${(def.key==="itemName"||def.key==="itemPrice")?aBtn("justify","justified","Ikki chetdan (nom chap, narx o'ng)"):""}</div>
      </div>
    </div>`;
  }).join("");
}

function _ensureBlock(key) {
  window._chekBlocks = window._chekBlocks || {};
  window._chekBlocks[key] = window._chekBlocks[key] || {};
  return window._chekBlocks[key];
}
function setBlockSize(key, val) { _ensureBlock(key).size = parseInt(val) || undefined; _afterBlockChange(); }
function toggleBlock(key, prop) { const b = _ensureBlock(key); b[prop] = !b[prop]; renderChekBlocks(); _afterBlockChange(); }
function setBlockAlign(key, val) { const b = _ensureBlock(key); b.align = (b.align === val ? undefined : val); renderChekBlocks(); _afterBlockChange(); }
function setBlockShow(key, val) { _ensureBlock(key).show = val; _afterBlockChange(); }
function _afterBlockChange() { try { if (typeof renderChekPreview === "function") renderChekPreview(); } catch(e){} }

// ─── Bosmadan oldin test chop (2026-07-19, 3-tavsiya) ───
// Jonli test iframe'ining O'ZINI chop qiladi (ichida to'liq chek + @page).
function printChekPreview() {
  const frame = document.getElementById("chek-preview-frame");
  if (!frame || !frame.contentWindow) { toast("Preview topilmadi", "err"); return; }
  try { frame.contentWindow.focus(); frame.contentWindow.print(); }
  catch (e) { toast("Chop xatosi: " + (e.message||e), "err"); }
}

// ═══ KURSNI QO'LDA SAQLASH (2026-07-25) ═══
// Avval har harfda saqlanardi — yarim yozilgan raqam ham tizimga
// tushib chalg'itardi. Endi "Saqlash" tugmasi bilan.
function rateInputChanged() {
  const btn = document.getElementById("s-rate-save");
  const inp = document.getElementById("s-rate");
  if (!btn || !inp) return;
  const cur = Number(db.settings?.rate) || 0;
  const val = Number(inp.value) || 0;
  // Qiymat o'zgargan bo'lsa tugma ko'rinadi
  btn.style.display = (val > 0 && val !== cur) ? "" : "none";
}

function saveRateManual() {
  const inp = document.getElementById("s-rate");
  if (!inp) return;
  const val = Number(inp.value) || 0;
  if (val <= 0) { toast("Kursni kiriting", "err"); return; }
  if (val < 1000 || val > 100000) {
    if (!confirm(`Kurs ${fmt(val)} so'm — bu to'g'rimi?`)) return;
  }
  // Qo'lda o'zgartirilsa rejim ham "manual" ga o'tadi
  if (db.settings?.rateMode !== "manual") {
    saveSetting("rateMode", "manual");
  }
  saveSetting("rate", val);
  const btn = document.getElementById("s-rate-save");
  if (btn) btn.style.display = "none";
  toast(`✅ Kurs saqlandi: ${fmt(val)} so'm`);
  // Joriy sahifa narxlari yangilansin
  try { if (typeof renderEgasi === "function") renderEgasi(); } catch(e) {}
}


// ══════════════════════════════════════════════════════════
// 💱 KURS TEZ-TAHRIRI (2026-08-09, C-3 kurs qismi)
// Muammo: kurs faqat Egasi sahifasida (admin qulfi) edi — menejer
// sotuv kuni kursni o'zgartira olmasdi. Endi topbar'dagi 💱 tugma
// menejer+ uchun mini-oynani ochadi. IKKI QATLAM himoya:
//   1) rol: hasRole("menejer") — kassirga tahrir umuman ochilmaydi
//      (unga tugma faqat joriy kursni ko'rsatadi);
//   2) ruxsat: permDo("sotuv","kurs") — egasi Xodimlar oynasida
//      istalgan menejerdan olib qo'yishi mumkin (yangi band).
// Avto (CBU) rejimda tahrir yopiq — faqat ma'lumot.
// Saqlash saveSetting orqali — pill, saveDB va bulut push o'sha yerda.
// ══════════════════════════════════════════════════════════
function kursCanEdit() {
  try { return hasRole("menejer") && permDo("sotuv", "kurs"); }
  catch(e) { return false; }
}
function kursPillTap() {
  const rate = Number(db.settings?.rate) || 0;
  if (!kursCanEdit()) {
    toast(`💱 Kurs: ${fmt(rate)} so'm / $ (o'zgartirish — menejer+)`);
    return;
  }
  if (getRateMode() === "auto") {
    toast(`💱 Kurs avtomatik (Markaziy Bank): ${fmt(rate)} so'm`);
    return;
  }
  openKursQuick();
}
function openKursQuick() {
  let ov = document.getElementById("kurs-quick-ov");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "kurs-quick-ov";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px";
    ov.innerHTML = `
      <div style="background:var(--card,#fff);border-radius:14px;padding:20px 22px;max-width:320px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.25)">
        <div style="font-weight:800;font-size:15px;margin-bottom:4px">💱 Dollar kursi</div>
        <div id="kurs-quick-cur" style="font-size:12.5px;color:var(--mut);margin-bottom:12px"></div>
        <input id="kurs-quick-inp" type="number" step="50" inputmode="numeric"
          style="width:100%;font-size:22px;font-weight:800;text-align:center;padding:10px;border:1.5px solid var(--brd,#ddd);border-radius:10px;box-sizing:border-box"
          onkeydown="if(event.key==='Enter')saveKursQuick()">
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn btn-sm" style="flex:1" onclick="closeKursQuick()">Bekor</button>
          <button class="btn btn-acc btn-sm" style="flex:1" onclick="saveKursQuick()"><i class="ti ti-check"></i> Saqlash</button>
        </div>
      </div>`;
    ov.addEventListener("click", ev => { if (ev.target === ov) closeKursQuick(); });
    document.body.appendChild(ov);
  }
  const rate = Number(db.settings?.rate) || 0;
  const c = document.getElementById("kurs-quick-cur");
  if (c) c.textContent = "Hozirgi: " + fmt(rate) + " so'm / $";
  const inp = document.getElementById("kurs-quick-inp");
  if (inp) { inp.value = rate || ""; setTimeout(() => { try { inp.focus(); inp.select(); } catch(e) {} }, 60); }
  ov.style.display = "flex";
}
function closeKursQuick() {
  const ov = document.getElementById("kurs-quick-ov");
  if (ov) ov.style.display = "none";
}
function saveKursQuick() {
  // Qo'riqchi FUNKSIYA ICHIDA ham — tugmani chetlab o'tishga qarshi
  if (!kursCanEdit()) { toast("Ruxsat yo'q: kursni menejer+ o'zgartiradi", "err"); return; }
  const inp = document.getElementById("kurs-quick-inp");
  const val = Number(inp && inp.value) || 0;
  if (val <= 0) { toast("Kursni kiriting", "err"); return; }
  if (val < 1000 || val > 100000) {
    if (!confirm(`Kurs ${fmt(val)} so'm — bu to'g'rimi?`)) return;
  }
  const eski = Number(db.settings?.rate) || 0;
  if (db.settings?.rateMode !== "manual") saveSetting("rateMode", "manual");
  saveSetting("rate", val);
  // ⚖️ AUDIT 2-bosqich (2026-08-12): kurs o'zgarishi izi
  try {
    if (eski !== val) auditLog("kurs", "settings", "rate", "Dollar kursi",
      { before: String(eski), after: String(val) });
  } catch (e) {}
  closeKursQuick();
  toast(`✅ Kurs: ${fmt(eski)} → ${fmt(val)} so'm`);
}

// ── C-6: EGANI BOTGA ULASH havolasi ──────────────────────────────
// Bot tomoni allaqachon tayyor (/start own_shop_... · 2026-07-30,
// "birinchi ega" bir martalik himoyasi bilan) — ilovada havola
// KO'RSATILMAS edi. Endi Sozlamalar → SMS & Bot'dagi tugma ochadi.
function ownerBotLink() {
  if (!hasRole("admin")) { toast("Bu amal faqat egasi uchun", "err"); return; }
  const u = (db.settings?.telegramBotUsername || "").replace(/^@/, "").trim();
  if (!u) { toast("Bot username hali sozlanmagan (yuqoridagi maydon)", "err"); return; }
  const sid = (typeof getCloudShopId === "function" && getCloudShopId()) ||
              (typeof getAuthUser === "function" && getAuthUser()?.shopId) || "";
  if (!sid || sid === "local") { toast("Do'kon aniqlanmadi — avval tizimga kiring", "err"); return; }
  const link = `https://t.me/${u}?start=own_${sid}`;
  try { if (navigator.clipboard) navigator.clipboard.writeText(link); } catch(e) {}
  try { window.open(link, "_blank"); } catch(e) {}
  toast("🔗 Havola ochildi va nusxalandi. Telegram'da «Start» bosing.");
}

// Valyuta tanlovini qulflash (SuperAdmin qat'iy rejim belgilagan bo'lsa)
function applyCurrencyLock() {
  const seg    = document.getElementById("cur-seg");
  const locked = document.getElementById("cur-locked");
  const mode   = (typeof getShopCurrencyMode === "function") ? getShopCurrencyMode() : "multi";

  if (mode === "multi") {
    if (seg) seg.style.display = "";
    if (locked) locked.style.display = "none";
    return;
  }
  // Qat'iy rejim — tanlov yopiq, sozlama majburlanadi
  try { if (typeof enforceCurrencyMode === "function") enforceCurrencyMode(); } catch(e) {}
  if (seg) seg.style.display = "none";
  if (locked) {
    locked.style.display = "";
    locked.innerHTML = `🔒 <b>${mode === "usd" ? "Dollar" : "So'm"}</b> rejimi ` +
      `<span style="color:var(--mut)">— tizim sozlamasi</span><br>` +
      `<span style="font-size:11px">O'zgartirish uchun MERX qo'llab-quvvatlash xizmatiga murojaat qiling.</span>`;
  }
}


// 2026-08-12: POS uchun tanlangan uslub kartasi ajratib ko'rsatiladi.
// 2026-08-12: tanlangan uslub sozlamalarini panelga yuklash.
function csLoadStyleOpts() {
  try {
    const cfg = (db.settings && db.settings.chekConfig) || {};
    // 2026-08-12: panel qaysi BO'LIM uslubini sozlashi — tanlagichdan
    // 2026-08-14: bo'lim tanlagichi OLIB TASHLANDI — sozlamalar doim
    // SOTUV uslubiga tegishli (u sotuv/savat/tarix/bot uchun bitta).
    const st = (document.getElementById("chek-pos-style") || {}).value || "unified";
    const NOM = { unified:"Yagona", merx:"MERX brend", thermal:"Termal",
                  wholesale:"Ulgurji", compact:"Ixcham", table:"Jadval" };
    ["cs-opts-name","cs-opts-name2"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = NOM[st] || st;
    });
    const o = (cfg.perStyle && cfg.perStyle[st]) || {};
    const set = (id, v) => { const el = document.getElementById(id);
      if (el) el.value = (v === undefined || v === null) ? "" : String(v); };
    set("cs-paper",  o.paperWidth);
    set("cs-header", o.headerStyle);
    set("cs-font",   o.fontScale);
    set("cs-footer", o.footer);
    // 2026-08-12: blok o'lchamlari HAM uslubga bog'landi
    const _b = o.blocks || {};
    set("cs-b-shop",  _b.shop     && parseInt(_b.shop.size));
    set("cs-b-item",  _b.itemName && parseInt(_b.itemName.size));
    set("cs-b-total", _b.total    && parseInt(_b.total.size));
  } catch (e) {}
}

function ceMarkStyle() {
  try { csLoadStyleOpts(); } catch (e) {}
  // Kartalar POS uslubini belgilaydi (asosiy bo'lim)
  try {
    const v = (document.getElementById("chek-pos-style") || {}).value || "unified";
    document.querySelectorAll("#chek-style-cards .cs-card").forEach(c => {
      const on = c.dataset.s === v;
      c.style.border = on ? "2px solid var(--acc)" : "1.5px solid var(--brd)";
      c.style.background = on ? "var(--bg2,#FAFAF8)" : "";
    });
  } catch (e) {}
}


// \u2550\u2550\u2550 TASHQI XIZMATLAR (2026-08-12, 1-bosqich) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// \u26a0\ufe0f 1-BOSQICH: FAQAT SOZLAMALARNI SAQLAYDI. Hech qanday tashqi
// ulanish, so'rov yoki pul amali YO'Q \u2014 mavjud oqimlarga tegilmagan.
// Me'moriy qaror: MERX fiskal chek BOSMAYDI, faqat do'konning fiskal
// apparatiga ma'lumot uzatadi (keyingi bosqichda) \u2014 mas'uliyat do'konda.
// \u26a0\ufe0f Belgilar ICHKI SVG (2026-08-12): rasmiy logotiplar internetdan
// tortilmaydi \u2014 (a) PWA oflaynda ishlashi kerak, (b) brend fayllari
// huquqiy jihatdan rasmiy manbadan olinishi lozim. Shuning uchun brend
// RANGIDAGI ixcham belgilar. Rasmiy logotip fayllari bo'lsa \u2014 shu
// yerdagi `svg` qiymatini almashtirish kifoya.
function _tsMark(bg, txt, fg) {
  return `<span style="display:inline-flex;align-items:center;justify-content:center;
    width:28px;height:28px;border-radius:7px;background:${bg};color:${fg || "#fff"};
    font-weight:800;font-size:13px;letter-spacing:-.02em;flex:0 0 28px">${txt}</span>`;
}
const TS_PAY_SYS = [
  { k:"payme",  n:"Payme",  bg:"#00CFC8", txt:"P",  f:["Merchant ID","Kalit (key)"] },
  { k:"click",  n:"Click",  bg:"#00A3E0", txt:"C",  f:["Merchant ID","Service ID","Kalit"] },
  { k:"paynet", n:"Paynet", bg:"#00A651", txt:"PN", f:["Terminal ID","Kalit"] },
  { k:"uzum",   n:"Uzum",   bg:"#7000FF", txt:"U",  f:["Merchant ID","Kalit"] },
];

function tsGet() {
  try { return (db.settings && db.settings.extServices) || {}; }
  catch (e) { return {}; }
}

function tsRender() {
  try {
    const c = tsGet();
    // Fiskal
    const on = document.getElementById("ts-fiskal-on");
    if (on) on.checked = !!(c.fiskal && c.fiskal.enabled);
    const set = (id, v) => { const el = document.getElementById(id);
      if (el) el.value = v == null ? "" : String(v); };
    set("ts-inn",         c.fiskal && c.fiskal.inn);
    set("ts-fiskal-type", c.fiskal && c.fiskal.type);
    set("ts-fiskal-addr", c.fiskal && c.fiskal.addr);
    set("ts-fiskal-sn",   c.fiskal && c.fiskal.sn);
    tsToggleFiskal();

    // To'lov tizimlari
    const box = document.getElementById("ts-pay-list");
    if (!box) return;
    const P = c.pay || {};
    box.innerHTML = TS_PAY_SYS.map(sys => {
      const v = P[sys.k] || {};
      return `<div style="border:1.5px solid var(--brd);border-radius:10px;padding:12px 13px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px">
          <input type="checkbox" data-ts="${sys.k}" ${v.enabled ? "checked" : ""}
                 onchange="tsTogglePay('${sys.k}')" style="width:17px;height:17px">
          ${_tsMark(sys.bg, sys.txt)}
          <span style="font-weight:700;font-size:13px">${sys.n}</span>
        </label>
        <div id="ts-pay-${sys.k}" style="display:${v.enabled ? "flex" : "none"};flex-direction:column;gap:7px">
          ${sys.f.map((lbl, i) =>
            `<div class="fld"><label>${lbl}</label>
               <input id="ts-${sys.k}-${i}" value="${(v.fields && v.fields[i]) || ""}"
                      placeholder="${lbl}"></div>`).join("")}
          <label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer">
            <input type="checkbox" id="ts-${sys.k}-test" ${v.test ? "checked" : ""}
                   style="width:15px;height:15px">
            Sinov rejimi (test)
          </label>
        </div>
      </div>`;
    }).join("");
  } catch (e) { console.warn("tashqi xizmatlar:", e.message); }
}

function tsToggleFiskal() {
  const on  = document.getElementById("ts-fiskal-on");
  const box = document.getElementById("ts-fiskal-box");
  if (box) box.style.display = (on && on.checked) ? "flex" : "none";
}

function tsTogglePay(k) {
  const cb  = document.querySelector(`[data-ts="${k}"]`);
  const box = document.getElementById("ts-pay-" + k);
  if (box) box.style.display = (cb && cb.checked) ? "flex" : "none";
}

// Saqlash \u2014 sozlamalar bilan birga (yagona push nuqtasidan o'tadi)
function tsSave() {
  try {
    const c = { fiskal: {}, pay: {} };
    const g = id => { const el = document.getElementById(id); return el ? (el.value || "").trim() : ""; };
    const on = document.getElementById("ts-fiskal-on");
    c.fiskal = {
      enabled: !!(on && on.checked),
      inn:  g("ts-inn"), type: g("ts-fiskal-type"),
      addr: g("ts-fiskal-addr"), sn: g("ts-fiskal-sn")
    };
    TS_PAY_SYS.forEach(sys => {
      const cb = document.querySelector(`[data-ts="${sys.k}"]`);
      const tt = document.getElementById(`ts-${sys.k}-test`);
      c.pay[sys.k] = {
        enabled: !!(cb && cb.checked),
        test:    !!(tt && tt.checked),
        fields:  sys.f.map((_, i) => g(`ts-${sys.k}-${i}`))
      };
    });
    if (!db.settings) db.settings = {};
    db.settings.extServices = c;
    saveDB();
    if (typeof cloudSync === "function") { try { cloudSync(); } catch (e) {} }
    toast("\u2705 Tashqi xizmatlar sozlamasi saqlandi");
  } catch (e) { toast("Saqlashda xato: " + e.message, "err"); }
}


// 2026-08-13: server rejimi tugmachasi (A-bosqich)
function toggleServerPay() {
  try {
    const el = document.getElementById("set-server-pay");
    if (!db.settings) db.settings = {};
    db.settings.serverPay = !!(el && el.checked);
    saveDB();
    // ✅ 2026-08-13: DO'KON sozlamasi — darhol bulutga, hamma qurilmaga
    try { if (typeof flushCloudSync === "function") flushCloudSync(); } catch (e) {}
    toast(db.settings.serverPay
      ? "\u2705 Server rejimi YOQILDI \u2014 barcha kassalarga tarqaladi"
      : "Server rejimi o'chirildi \u2014 avvalgi tartib");
  } catch (e) {}
}
function _loadServerPay() {
  try {
    const el = document.getElementById("set-server-pay");
    if (el) el.checked = db.settings?.serverPay === true;
  } catch (e) {}
}


// \u2550\u2550\u2550 CHEK SOZLAMALARI \u2014 YANGI TARTIB (2026-08-14) \u2550\u2550\u2550\u2550\u2550\u2550
// Egasining talabi: ikkita mustaqil bo'lim, har birida
// "tanla \u2192 ko'r \u2192 sozla". Sotuv bo'limi BITTA uslubni belgilaydi va
// u sotuv chekiga, savatga, sotuv tarixiga hamda bot chekiga
// qo'llanadi. Qarz bo'limi alohida.
// \u26a0\ufe0f Chizuvchilarga, qaytarish mantiqiga, sinxronga TEGILMAGAN \u2014
// faqat qaysi tanlov qayerga yozilishi o'zgardi.
const CS_NOM = { unified:"Yagona", merx:"MERX brend", thermal:"Termal",
                 wholesale:"Ulgurji", table:"Jadval" };

// 1-bo'lim: sotuv uslubini tanlash (POS va TARIX birga)
function csPick(style) {
  // \U0001f534 2026-08-15: SURISH HOLATI SAQLANADI. Uslub tanlanganda
  // maydonlar, bloklar va namuna qayta chizilardi — sahifa balandligi
  // o'zgarib, ekran YUQORIGA sakrardi (egasining takroriy shikoyati).
  // Sababni qidirish o'rniga holatni saqlab, tiklaymiz — kafolatli.
  const _sc0 = document.getElementById("pages");
  const _y0  = _sc0 ? _sc0.scrollTop : 0;
  const _tikla = () => { try { if (_sc0) _sc0.scrollTop = _y0; } catch (e) {} };
  try {
    // ⚠️ 2026-08-14 TUZATISH: TARTIB muhim. Avval `_csFillFields`
    // chaqirilardi — u namunani chizganda tanlov hali ESKI uslubda
    // turardi va bo'sh/noto'g'ri chek ko'rinardi (jonli shikoyat).
    // Endi: avval uslub yoziladi, keyin maydonlar va namuna.
    // \U0001f534 2026-08-15 ILDIZ-TUZATISH: yashirin ro'yxatlarda VARIANT
    // yo'q edi — `select.value = "table"` mos variant bo'lmagani uchun
    // BO'SH qolardi va saqlashda "unified" yozilardi. Natijada egasi
    // Jadvalni tanlab saqlasa ham sotuvda Jadval chiqmasdi.
    // Endi tanlov ikki joyda: ro'yxatga variant qo'shiladi VA
    // `dataset` ga yoziladi (ishonchli manba).
    const _qoy = (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!el.querySelector(`option[value="${style}"]`)) {
        const o = document.createElement("option");
        o.value = style; o.textContent = style;
        el.appendChild(o);
      }
      el.value = style;
      el.dataset.pick = style;          // zaxira manba
    };
    _qoy("chek-pos-style");
    _qoy("chek-tarix-style");           // tarix ham SHU uslubda
    _csFillFields(style);
    document.querySelectorAll("#chek-style-cards .cs-card").forEach(c => {
      const on = c.dataset.s === style;
      c.style.border     = on ? "2px solid var(--acc)" : "1.5px solid var(--brd)";
      c.style.background = on ? "var(--bg2,#FAFAF8)" : "";
    });
    ["cs-opts-name", "cs-opts-name2"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = CS_NOM[style] || style;
    });
    csLoadStyleOpts();                 // sozlamalar shu uslubniki bo'lsin
  } catch (e) {}
  // Chizish tugagach surish joyiga qaytariladi (ikki bosqichda —
  // oyna balandligi keyinroq o'zgarishi mumkin)
  _tikla();
  try { requestAnimationFrame(_tikla); } catch (e) {}
  setTimeout(_tikla, 120);
}

// 2-bo'lim: qarz chitigi uslubi
function csPickQarz(style) {
  // \U0001f534 2026-08-15: surish holati saqlanadi (sotuv kartalaridagi kabi)
  const _sc0 = document.getElementById("pages");
  const _y0  = _sc0 ? _sc0.scrollTop : 0;
  const _tikla = () => { try { if (_sc0) _sc0.scrollTop = _y0; } catch (e) {} };
  try {
    const el = document.getElementById("chek-qarz-style");
    if (el) {
      if (!el.querySelector(`option[value="${style}"]`)) {
        const o = document.createElement("option");
        o.value = style; o.textContent = style;
        el.appendChild(o);
      }
      el.value = style;
      el.dataset.pick = style;         // zaxira manba (yuqoridagi izoh)
    }
    document.querySelectorAll("#cs-qarz-cards .cq-card").forEach(c => {
      const on = c.dataset.q === style;
      c.style.border     = on ? "2px solid var(--acc)" : "1.5px solid var(--brd)";
      c.style.background = on ? "var(--bg2,#FAFAF8)" : "";
    });
    // \U0001f534 2026-08-15: NAMUNA QAYTA CHIZILADI va tepadagi tanlov
    // "Qarz" ga o'tadi. Avval karta bosilganda namuna umuman
    // yangilanmasdi — tepadagi namuna bilan aloqa uzilgan edi
    // (egasining kuzatuvi: "bosgan bilan chaqirmayapti").
    try {
      if (typeof _previewType !== "undefined") _previewType = "qarz";
      document.querySelectorAll(".prev-tab").forEach(b => {
        const on = b.dataset.pt === "qarz";
        b.classList.toggle("btn-acc", on);
        b.classList.toggle("btn-ghost", !on);
      });
      if (typeof renderChekPreview === "function") renderChekPreview();
    } catch (e) {}
  } catch (e) {}
  _tikla();
  try { requestAnimationFrame(_tikla); } catch (e) {}
  setTimeout(_tikla, 120);
}

// Tanlangan sotuv uslubining namunasi
function csPreviewCurrent() {
  const v = (document.getElementById("chek-pos-style") || {}).value || "unified";
  try { previewChek(v); } catch (e) { toast("Namuna ochilmadi", "err"); }
}

// Qarz chitigi namunasi
function previewPayChek() {
  try {
    const style = (document.getElementById("chek-qarz-style") || {}).value || "unified";
    if (typeof buildPayReceiptStyled !== "function") {
      toast("Namuna hozircha mavjud emas", "err"); return;
    }
    const cfg  = (db.settings && db.settings.chekConfig) || {};
    const rate = db.settings?.rate || 12000;
    const pay  = {
      chekNum: "PAY-NAMUNA-0001", date: today(),
      time: (typeof nowTime === "function" ? nowTime() : "12:00"),
      customerName: "Namuna mijoz", amount: 100, amountSom: 100 * rate,
      currency: "usd", rate, method: "naqd",
      debtBefore: 500, debtAfter: 400
    };
    const html = buildPayReceiptStyled(pay, {
      style, shopName: db.shop?.name || "MERX",
      staffName: "Kassir",
      cfg: { ...cfg, shopName: db.shop?.name || "MERX" }
    });
    const w = window.open("", "_blank", "width=420,height=700");
    if (!w) { toast("Pop-up bloklangan", "err"); return; }
    w.document.write(html); w.document.close(); w.focus();
  } catch (e) { toast("Namuna xatosi: " + e.message, "err"); }
}

// Yuklashda kartalarni belgilash
function csInitCards() {
  try {
    const cfg = (db.settings && db.settings.chekConfig) || {};
    const sv2 = cfg.styleV2 === true;
    const pos = sv2 ? (cfg.posStyle  || "unified") : "unified";
    const qrz = sv2 ? (cfg.qarzStyle || "unified") : "unified";
    csPick(pos);
    csPickQarz(qrz);
  } catch (e) {}
}


// Uslub sozlamalarini maydonlarga tushirish (2026-08-14)
// Qatlam: uslub (perStyle) > umumiy (chekConfig) > standart.
function _csFillFields(style) {
  try {
    const c  = (db.settings && db.settings.chekConfig) || {};
    const o  = (c.perStyle && c.perStyle[style]) || {};
    const g  = (k, dflt) => (o[k] !== undefined ? o[k]
                          : (c[k] !== undefined ? c[k] : dflt));
    const set = (id, v) => { const el = document.getElementById(id);
      if (el && v !== undefined && v !== null) el.value = String(v); };

    set("chek-tagline",      g("tagline", ""));
    set("chek-paper",        g("paperWidth", 72));
    set("chek-font-scale",   g("fontScale", "normal"));
    set("chek-font-family",  g("fontFamily", "dm"));
    set("chek-header-style", g("headerStyle", "dark"));
    set("chek-footer",       g("footer", "Rahmat! Yana kutamiz \ud83d\ude4f"));

    // Telefonlar va qo'shimcha matn — uslub darajasida (2026-08-14)
    try {
      const ph = (o.phones !== undefined) ? o.phones : (c.phones || []);
      const ex = (o.extraLines !== undefined) ? o.extraLines : (c.extraLines || []);
      window._chekPhones = Array.isArray(ph) ? ph.slice() : [];
      window._chekExtra  = Array.isArray(ex) ? ex.slice() : [];
      if (typeof renderChekPhones === "function") renderChekPhones();
      if (typeof renderChekExtra  === "function") renderChekExtra();
    } catch (e) {}

    // Belgilagichlar — uslub darajasida (2026-08-14)
    const chk = (id, val, dflt) => { const el = document.getElementById(id);
      if (el) el.checked = (val !== undefined ? val !== false : dflt); };
    chk("chek-show-staff",        g("showStaff",       undefined), true);
    chk("chek-show-contact",      g("showContact",     undefined), true);
    chk("chek-show-debt-history", g("showDebtHistory", undefined), true);
    chk("chek-dual-cur",          g("dualCurrency",    undefined), true);
    // 2026-08-15: "yagona sotuv cheki" tugmasi olib tashlandi (doimiy yoqiq)

    // Blok o'lchamlari — shu uslubniki
    try {
      const b = o.blocks || c.blocks || {};
      window._chekBlocks = JSON.parse(JSON.stringify(b));
      if (!window._chekBlocksAll) window._chekBlocksAll = {};
      window._chekBlocksAll.umumiy = window._chekBlocks;
      if (typeof renderChekBlocks === "function") renderChekBlocks();
    } catch (e) {}

    // ✅ 2026-08-14: namuna BIR MARTA bosishda yangilansin — avval
    // iframe tozalanadi (bir xil mazmun qayta yuklanmasdi).
    // ⚠️ 2026-08-14: srcdoc TOZALANMAYDI — oyna balandligi nolga
    // tushib, sahifa yuqoriga SAKRARDI (egasining shikoyati).
    // Yangilash `renderChekPreview` ichidagi noyob belgi bilan bo'ladi.
    if (typeof renderChekPreview === "function") renderChekPreview();
    // ⚠️ 2026-08-14: takroriy chizish OLIB TASHLANDI — oyna balandligi
  // ikki marta o'zgarib, sahifa yuqoriga sakrardi (egasining shikoyati).
  } catch (e) {}
}


// Namuna uchun to'lov yozuvi (qarz chiti) \u2014 2026-08-15
function _previewPayment() {
  return {
    chekNum: "PAY-NAMUNA-0001",
    date: "2026-08-15", time: "12:34",
    customerName: "Namuna Mijoz",
    customerPhone: "+998 90 000 00 00",
    amount: 1500000, amountSom: 1500000,
    currency: "uzs", rate: (db.settings && db.settings.rate) || 0,
    method: "naqd",
    debtBefore: 5000000, debtAfter: 3500000,
    due: "2026-08-15",
    // ✅ 2026-08-15: bu NAMUNA, haqiqiy to'lov emas — shuning uchun
    // "Bulutga yuborilmagan" ogohlantirishi chiqmasligi kerak
    // (egasining kuzatuvi: Termal namunasida eslatma turardi).
    serverWritten: true
  };
}
