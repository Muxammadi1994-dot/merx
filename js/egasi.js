// MERX egasi.js | v3.3 | To'liq maydonlar boshqaruvi
// ================================================

const FIELD_DEFS = {
  // Katalog — mahsulot qo'shish / tahrirlash
  katalog_turi:        { label:"Turi (Oyoq/Kiyim)",       icon:"ti-tag",             default:true },
  katalog_kategoriya:  { label:"Kategoriya",               icon:"ti-category",        default:true },
  katalog_birlik:      { label:"O'lchov birligi",          icon:"ti-ruler",           default:true },
  katalog_karobka:     { label:"Qutida nechta / Karobka",  icon:"ti-box",             default:true },
  katalog_tannarx:     { label:"Tannarx (USD)",            icon:"ti-coin",            default:true },
  katalog_ulgurji:     { label:"Ulgurji narx",             icon:"ti-building-store",  default:true },
  katalog_rang:        { label:"Rang (Pantone)",           icon:"ti-palette",         default:true },
  katalog_olcham:      { label:"O'lcham / razmer",         icon:"ti-resize",          default:true },
  katalog_barcode:     { label:"Barcode / EAN",            icon:"ti-barcode",         default:true },
  katalog_rasm:        { label:"Tovar rasmi",              icon:"ti-photo",           default:true },

  // Ombor — tovar qabul
  ombor_birlik:        { label:"O'lchov birligi",          icon:"ti-ruler",           default:true },
  ombor_rang:          { label:"Rang (Pantone)",           icon:"ti-palette",         default:true },
  ombor_olcham:        { label:"O'lcham / miqdor",         icon:"ti-resize",          default:true },
  ombor_karobka:       { label:"Karobka hisobi paneli",    icon:"ti-box",             default:true },
  ombor_tannarx:       { label:"Tannarx",                  icon:"ti-coin",            default:true },
  ombor_ulgurji_yangi: { label:"Ulgurji narxni yangilash", icon:"ti-refresh",         default:true },
  ombor_yetkazuvchi:   { label:"Yetkazuvchi",              icon:"ti-user-check",      default:true },
  ombor_partiya:       { label:"Partiya raqami",           icon:"ti-hash",            default:true },
  ombor_tolova:        { label:"To'lov holati",            icon:"ti-credit-card",     default:true },
  ombor_barcode:       { label:"Barcode / EAN",            icon:"ti-barcode",         default:true },

  // Ombor — kirim tarixi ustunlari
  ombor_ustun_rang:    { label:"Rang/O'lcham ustuni",      icon:"ti-palette",         default:true  },
  ombor_ustun_barcode: { label:"Barcode ustuni",           icon:"ti-barcode",         default:false },
  ombor_ustun_sup:     { label:"Yetkazuvchi ustuni",       icon:"ti-user-check",      default:true  },
  ombor_ustun_partiya: { label:"Partiya ustuni",           icon:"ti-hash",            default:false },
  ombor_ustun_tolova:  { label:"To'lov holati ustuni",     icon:"ti-credit-card",     default:true  },

  // POS
  pos_chegirma:        { label:"Chegirma maydoni",         icon:"ti-discount",        default:true },
  pos_izoh:            { label:"Izoh maydoni",             icon:"ti-notes",           default:true },
  pos_usd:             { label:"USD nasiya varianti",      icon:"ti-currency-dollar", default:true },
  pos_nasiya_muddat:   { label:"Nasiya muddat sanasi",     icon:"ti-calendar",        default:true },
  pos_ulgurji:         { label:"Ulgurji/Chakana tanlash",  icon:"ti-building-store",  default:true },
};

// ── Global: maydon yoqilganmi? ────────────────────
window.fieldOn = function(key) {
  const f = db.settings?.fields || {};
  return f[key] !== undefined ? f[key] : (FIELD_DEFS[key]?.default !== false);
};

// ════════════════════════════════════════════════
// MAYDONLARNI QO'LLASH
// ════════════════════════════════════════════════

window.applyKatalogFields = function() {
  const fo = window.fieldOn;

  // ── ADD PRODUCT MODAL ──
  // Turi (do'kon) — r2 ichida 2-fld
  const apR2 = document.querySelector("#ov-addprod .modal > .r2");
  if (apR2) {
    const flds = apR2.querySelectorAll(".fld");
    if (flds[1]) flds[1].style.display = fo("katalog_turi") ? "" : "none";
  }

  // Kategoriya + O'lchov birligi + Qutida nechta (r3)
  const apR3 = document.querySelector("#ov-addprod .modal .r3");
  if (apR3) {
    const flds = apR3.querySelectorAll(".fld");
    if (flds[0]) flds[0].style.display = fo("katalog_kategoriya") ? "" : "none";
    if (flds[1]) flds[1].style.display = fo("katalog_birlik")     ? "" : "none";
    if (flds[2]) flds[2].style.display = fo("katalog_karobka")    ? "" : "none";
  }

  // Rang
  const apRang = document.querySelector("#ov-addprod .fld:has(#ap-pp-wrap)");
  if (apRang) apRang.style.display = fo("katalog_rang") ? "" : "none";

  // O'lcham + razmer bloki
  const apSize = document.querySelector("#ov-addprod .modal > div:has(.ap-smode)");
  if (apSize) apSize.style.display = fo("katalog_olcham") ? "" : "none";

  // Tannarx
  const apCost = document.getElementById("ap-cost-wrap");
  if (apCost) apCost.style.display = fo("katalog_tannarx") ? "" : "none";

  // Ulgurji narx
  const apUlg = document.querySelector("#ov-addprod .fld:has(#ap-ulgurji)");
  if (apUlg) apUlg.style.display = fo("katalog_ulgurji") ? "" : "none";

  // Barcode
  const apBarcode = document.querySelector("#ov-addprod .fld:has(#ap-barcode)");
  if (apBarcode) apBarcode.style.display = fo("katalog_barcode") ? "" : "none";

  // ── EDIT PRODUCT MODAL ──
  // r3: nom(doim), kategoriya, birlik
  const epR3 = document.querySelector("#ov-editprod .modal .r3");
  if (epR3) {
    const flds = epR3.querySelectorAll(".fld");
    if (flds[1]) flds[1].style.display = fo("katalog_kategoriya") ? "" : "none";
    if (flds[2]) flds[2].style.display = fo("katalog_birlik")     ? "" : "none";
  }
  const epBarcode = document.querySelector("#ov-editprod .fld:has(#ep-barcode)");
  if (epBarcode) epBarcode.style.display = fo("katalog_barcode") ? "" : "none";

  const epRasm = document.querySelector("#ov-editprod .fld:has(#ep-img-preview)");
  if (epRasm) epRasm.style.display = fo("katalog_rasm") ? "" : "none";

  const epCost = document.getElementById("ep-cost-wrap");
  if (epCost) epCost.style.display = fo("katalog_tannarx") ? "" : "none";

  const epUlg = document.querySelector("#ov-editprod .fld:has(#ep-ulgurji)");
  if (epUlg) epUlg.style.display = fo("katalog_ulgurji") ? "" : "none";

  const epInbox = document.querySelector("#ov-editprod .fld:has(#ep-inbox)");
  if (epInbox) epInbox.style.display = fo("katalog_karobka") ? "" : "none";
};

window.applyOmborFields = function() {
  const fo = window.fieldOn;

  // r2 ichida 2-fld = O'lchov birligi
  const qbR2 = document.querySelector("#ov-qabul .modal > .r2");
  if (qbR2) {
    const flds = qbR2.querySelectorAll(".fld");
    if (flds[1]) flds[1].style.display = fo("ombor_birlik") ? "" : "none";
  }

  // Rang
  const qbRang = document.querySelector(".fld:has(#qb-pp-wrap)");
  if (qbRang) qbRang.style.display = fo("ombor_rang") ? "" : "none";

  // Karobka paneli (sariq box)
  const qbBox = document.getElementById("qb-box-panel");
  if (qbBox) {
    // karobka o'chirilsa normal panel ko'rsatilsin
    if (!fo("ombor_karobka")) {
      qbBox.style.display = "none";
      const np = document.getElementById("qb-normal-panel");
      if (np) np.style.display = "";
    }
  }

  // Normal panel (o'lcham + miqdor)
  const qbNormal = document.getElementById("qb-normal-panel");
  if (qbNormal) qbNormal.style.display = fo("ombor_olcham") ? "" : "none";

  // Tannarx
  const qbCost = document.getElementById("qb-cost-wrap");
  if (qbCost) qbCost.style.display = fo("ombor_tannarx") ? "" : "none";

  // Ulgurji yangilash
  const qbUlg = document.querySelector(".fld:has(#qb-ulgurji)");
  if (qbUlg) qbUlg.style.display = fo("ombor_ulgurji_yangi") ? "" : "none";

  // r3: yetkazuvchi, partiya, to'lov holati
  const qbR3 = document.querySelector("#ov-qabul .modal .r3");
  if (qbR3) {
    const flds = qbR3.querySelectorAll(".fld");
    if (flds[0]) flds[0].style.display = fo("ombor_yetkazuvchi") ? "" : "none";
    if (flds[1]) flds[1].style.display = fo("ombor_partiya")     ? "" : "none";
    if (flds[2]) flds[2].style.display = fo("ombor_tolova")      ? "" : "none";
  }

  // Barcode
  const qbBarcode = document.querySelector(".fld:has(#qb-barcode)");
  if (qbBarcode) qbBarcode.style.display = fo("ombor_barcode") ? "" : "none";
};

function _applyPosFields() {
  const fo = window.fieldOn;

  const chegirma = document.querySelector(".checkout-panel div:has(#discount-val)");
  if (chegirma) chegirma.style.display = fo("pos_chegirma") ? "" : "none";

  const izoh = document.querySelector(".checkout-panel div:has(#pos-note)");
  if (izoh) izoh.style.display = fo("pos_izoh") ? "" : "none";

  const usdBtn = document.querySelector("button[data-c='usd'][onclick*='setDebtCurrency']");
  if (usdBtn) usdBtn.style.display = fo("pos_usd") ? "" : "none";

  const muddat = document.querySelector(".fld:has(#c-due)");
  if (muddat) muddat.style.display = fo("pos_nasiya_muddat") ? "" : "none";

  const ptWrap = document.getElementById("price-type-wrap");
  if (ptWrap) {
    ptWrap.style.display = (fo("pos_ulgurji") && (db.settings?.showChakana || false)) ? "block" : "none";
  }
}

// ── Parol sozlamalari renderiga qo'shamiz ─────────
function renderPasswordSettings() {
  const el = document.getElementById("owner-pass-section"); if (!el) return;
  const hasPass = !!db.settings.ownerPin;
  el.innerHTML = `
    <div class="card" style="margin-top:16px">
      <div class="ch"><h3><i class="ti ti-lock"></i> Kirish paroli</h3>
        ${hasPass
          ? '<span class="bg bg-g" style="font-size:12px">\u2705 Parol o\u02BBrnatilgan</span>'
          : '<span class="bg bg-r" style="font-size:12px">\u26a0\ufe0f Parol o\u02BBrnatilmagan</span>'}
      </div>
      <div style="padding:16px 18px;display:flex;flex-direction:column;gap:10px;max-width:400px">
        ${hasPass ? `
          <div class="fld"><label>Joriy parol</label>
            <input id="owner-cur-pass" type="password" placeholder="••••••">
          </div>` : ""}
        <div class="fld"><label>Yangi parol</label>
          <input id="owner-new-pass" type="password" placeholder="Kamida 4 ta belgi">
        </div>
        <div class="fld"><label>Takrorlang</label>
          <input id="owner-rep-pass" type="password" placeholder="Takrorlang">
        </div>
        <button class="btn btn-acc" onclick="saveOwnerPassword()" style="align-self:flex-start">
          <i class="ti ti-check"></i> Parolni saqlash
        </button>
        ${hasPass ? `
          <button class="btn btn-ghost btn-sm" onclick="removeOwnerPassword()" style="color:var(--red);align-self:flex-start">
            <i class="ti ti-lock-open"></i> Parolni o'chirish (himoyasiz ishlash)
          </button>` : ""}
      </div>

      <!-- Xodimlar PIN -->
      <div style="border-top:1px solid var(--brd);padding:16px 18px">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px">
          <i class="ti ti-users"></i> Xodimlar PIN kodi
        </div>
        ${(db.staff||[]).length === 0
          ? `<div style="color:var(--mut);font-size:13px">Xodimlar yo'q — avval xodim qo'shing</div>`
          : (db.staff||[]).map(s => `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px 12px;
              background:var(--bg);border-radius:10px">
              <div style="flex:1">
                <div style="font-weight:600;font-size:13px">${s.name}</div>
                <div style="font-size:11.5px;color:var(--mut)">${s.role||"kassir"} · ${s.pin ? "✅ PIN o'rnatilgan" : "❌ PIN yo'q"}</div>
              </div>
              <input id="staff-pin-${s.id}" type="password" maxlength="4" placeholder="PIN (4 raqam)"
                style="width:110px;font-family:inherit;font-size:14px;border:1.5px solid var(--brd);
                border-radius:8px;padding:7px 10px;text-align:center;letter-spacing:4px">
              <button class="btn btn-sm" onclick="saveStaffPin(${s.id})" style="white-space:nowrap">
                <i class="ti ti-check"></i> Saqlash
              </button>
            </div>`).join("")}
      </div>
    </div>`;
}

function removeOwnerPassword() {
  if (!confirm("Parolni o'chirasizmi? Tizim himoyasiz ishlaydi.")) return;
  db.settings.ownerPin = null;
  saveDB();
  renderPasswordSettings();
  toast("Parol o'chirildi");
}

// Super admin paroli o'rnatish (egasi bo'limida)
function renderSuperAdminSection() {
  const el = document.getElementById("sa-pass-section"); if (!el) return;
  const hasSaPass = !!db.settings?.superAdminPin;
  el.innerHTML = `
    <div class="card" style="margin-top:16px;border-top:3px solid #8B5CF6">
      <div class="ch">
        <h3><i class="ti ti-shield-lock" style="color:#8B5CF6"></i> Super Admin Paroli</h3>
        <span class="bg" style="font-size:12px;background:#8B5CF622;color:#8B5CF6">
          ${hasSaPass ? "✅ O'rnatilgan" : "⚠️ O'rnatilmagan (default: merx2024)"}
        </span>
      </div>
      <div style="padding:14px 18px;max-width:400px">
        <div style="font-size:12.5px;color:var(--mut);margin-bottom:12px">
          Bu parol bilan <strong>Ctrl+Shift+A</strong> kombinatsiyasi orqali super admin panelga kirasiz.
          Barcha do'konlarni boshqarish imkoni beradi.
        </div>
        <div class="fld">
          <label>Yangi super admin paroli (kamida 6 ta belgi)</label>
          <input id="sa-new-superpass" type="password" placeholder="Parol...">
        </div>
        <button class="btn" onclick="saveSuperAdminPass()"
          style="background:#8B5CF6;color:#fff;border-color:#8B5CF6;margin-top:4px">
          <i class="ti ti-check"></i> Saqlash
        </button>
      </div>
    </div>`;
}

function saveSuperAdminPass() {
  const pass = ($("sa-new-superpass")||{value:""}).value.trim();
  if (!pass || pass.length < 6) { toast("Kamida 6 ta belgi","err"); return; }
  if (!db.settings) db.settings = {};
  db.settings.superAdminPin = pass;
  saveDB();
  if ($("sa-new-superpass")) $("sa-new-superpass").value = "";
  toast("✅ Super admin paroli saqlandi");
  renderSuperAdminSection();
}

// openModal hook
const _origOpenModal = window.openModal;
window.openModal = function(id) {
  if (typeof _origOpenModal === "function") _origOpenModal(id);
  if (id === "addprod" || id === "editprod") setTimeout(window.applyKatalogFields, 30);
  if (id === "qabul")                        setTimeout(window.applyOmborFields,   30);
  if (id === "narxnoma") {
    setTimeout(() => {
      if (typeof renderNarxnomaList    === "function") renderNarxnomaList();
      if (typeof renderNarxnomaPreview === "function") renderNarxnomaPreview();
    }, 30);
  }
};

// renderPosGrid hook
const _origRenderPosGrid = window.renderPosGrid;
window.renderPosGrid = function() {
  if (typeof _origRenderPosGrid === "function") _origRenderPosGrid();
  setTimeout(_applyPosFields, 50);
};

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

function setShopType(t) {
  if (!db.settings) db.settings = {};
  db.settings.shopType = t;
  document.querySelectorAll("[data-t]").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  saveDB();
  toast("Do'kon turi saqlandi");
}

// ── Egasi sahifasini render qilish ───────────────
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

  renderFieldPanel();
  _applyPosFields();
}

// ════════════════════════════════════════════════
// MAYDONLAR PANELI
// ════════════════════════════════════════════════

const FIELD_GROUPS = [
  {
    id:"fg_katalog", icon:"ti-tag",
    title:"Katalog — Mahsulot qo'shish / tahrirlash",
    desc:"Mahsulot nomidan boshqa hamma maydon boshqariladi",
    keys:["katalog_turi","katalog_kategoriya","katalog_birlik","katalog_karobka",
          "katalog_tannarx","katalog_ulgurji","katalog_rang","katalog_olcham",
          "katalog_barcode","katalog_rasm"]
  },
  {
    id:"fg_ombor_qabul", icon:"ti-truck-delivery",
    title:"Ombor — Tovar qabul",
    desc:"Mahsulot nomidan boshqa hamma maydon boshqariladi",
    keys:["ombor_birlik","ombor_rang","ombor_olcham","ombor_karobka",
          "ombor_tannarx","ombor_ulgurji_yangi","ombor_yetkazuvchi",
          "ombor_partiya","ombor_tolova","ombor_barcode"]
  },
  {
    id:"fg_ombor_ustun", icon:"ti-table",
    title:"Ombor — Kirim tarixi ustunlari",
    desc:"Kirim tarixida ko'rinadigan ustunlar",
    keys:["ombor_ustun_rang","ombor_ustun_barcode","ombor_ustun_sup",
          "ombor_ustun_partiya","ombor_ustun_tolova"]
  },
  {
    id:"fg_pos", icon:"ti-shopping-cart",
    title:"POS — Sotuv kassasi",
    desc:"Sotuv panelida ko'rinadigan maydonlar",
    keys:["pos_chegirma","pos_izoh","pos_usd","pos_nasiya_muddat","pos_ulgurji"]
  },
];

function renderFieldPanel() {
  const container = $("field-panel");
  if (!container) return;

  container.innerHTML = FIELD_GROUPS.map(g => {
    const items = g.keys.map(key => {
      const def = FIELD_DEFS[key];
      const on  = window.fieldOn(key);
      return `
        <label class="ft-item${on?" ft-on":""}" id="fti_${key}">
          <div class="ft-left">
            <i class="ti ${def.icon}"></i>
            <span>${def.label}</span>
          </div>
          <div class="ft-sw${on?" ft-sw-on":""}" onclick="toggleField('${key}',event)">
            <div class="ft-knob"></div>
          </div>
        </label>`;
    }).join("");

    return `
      <div class="fg-block">
        <div class="fg-head">
          <div class="fg-title">
            <i class="ti ${g.icon}"></i>
            <div>
              <strong>${g.title}</strong>
              <span class="fg-desc">${g.desc}</span>
            </div>
          </div>
          <button class="btn btn-sm btn-ghost" style="font-size:12px;white-space:nowrap"
            onclick="toggleAllGroup(${JSON.stringify(g.keys)},event)">
            Barchasini yoq/o'chir
          </button>
        </div>
        <div class="ft-grid">${items}</div>
      </div>`;
  }).join("");
}

window.toggleField = function(key, e) {
  if (e) e.stopPropagation();
  if (!db.settings.fields) db.settings.fields = {};
  const cur = window.fieldOn(key);
  db.settings.fields[key] = !cur;
  saveDB();

  const label = $("fti_" + key);
  const sw    = label?.querySelector(".ft-sw");
  if (label) label.classList.toggle("ft-on",   !cur);
  if (sw)    sw.classList.toggle("ft-sw-on",   !cur);

  _applyPosFields();
  window.applyOmborFields();
  window.applyKatalogFields();

  toast(!cur ? "✅ Yoqildi" : "⛔ O'chirildi", "info");
};

window.toggleAllGroup = function(keys, e) {
  if (e) e.stopPropagation();
  if (!db.settings.fields) db.settings.fields = {};
  const allOn = keys.every(k => window.fieldOn(k));
  keys.forEach(k => { db.settings.fields[k] = !allOn; });
  saveDB();
  renderFieldPanel();
  _applyPosFields();
  window.applyOmborFields();
  window.applyKatalogFields();
  toast(allOn ? "⛔ Barchasi o'chirildi" : "✅ Barchasi yoqildi", "info");
};
