// MERX egasi.js | v3.1 | Maydonlar boshqaruvi — to'liq ishlaydi
// ================================================

// ── Maydonlar default holati ──────────────────────
const FIELD_DEFS = {
  katalog_rasm:        { label:"Tovar rasmi",               icon:"ti-photo",           default:true  },
  katalog_barcode:     { label:"Barcode / EAN",              icon:"ti-barcode",         default:true  },
  katalog_rang:        { label:"Rang (Pantone)",             icon:"ti-palette",         default:true  },
  katalog_olcham:      { label:"O'lcham / razmer",           icon:"ti-resize",          default:true  },
  katalog_karobka:     { label:"Karobka hisobi",             icon:"ti-box",             default:true  },
  katalog_ulgurji:     { label:"Ulgurji narx maydoni",       icon:"ti-building-store",  default:true  },
  ombor_rang:          { label:"Rang (Pantone)",             icon:"ti-palette",         default:true  },
  ombor_barcode:       { label:"Barcode / EAN",              icon:"ti-barcode",         default:true  },
  ombor_partiya:       { label:"Partiya raqami",             icon:"ti-hash",            default:true  },
  ombor_yetkazuvchi:   { label:"Yetkazuvchi",                icon:"ti-user-check",      default:true  },
  ombor_ulgurji_yangi: { label:"Ulgurji narxni yangilash",   icon:"ti-refresh",         default:true  },
  ombor_ustun_rang:    { label:"Rang/O'lcham ustuni",        icon:"ti-palette",         default:true  },
  ombor_ustun_barcode: { label:"Barcode ustuni",             icon:"ti-barcode",         default:false },
  ombor_ustun_sup:     { label:"Yetkazuvchi ustuni",         icon:"ti-user-check",      default:true  },
  ombor_ustun_partiya: { label:"Partiya ustuni",             icon:"ti-hash",            default:false },
  ombor_ustun_tolova:  { label:"To'lov holati ustuni",       icon:"ti-credit-card",     default:true  },
  pos_chegirma:        { label:"Chegirma maydoni",           icon:"ti-discount",        default:true  },
  pos_izoh:            { label:"Izoh maydoni",               icon:"ti-notes",           default:true  },
  pos_usd:             { label:"USD (nasiya valyutasi)",      icon:"ti-currency-dollar", default:true  },
  pos_nasiya_muddat:   { label:"Nasiya muddat sanasi",       icon:"ti-calendar",        default:true  },
  pos_ulgurji:         { label:"Ulgurji/Chakana narx tanlash",icon:"ti-building-store", default:true  },
};

// ── Global: maydon yoqilganmi? ────────────────────
window.fieldOn = function(key) {
  const f = db.settings?.fields || {};
  return f[key] !== undefined ? f[key] : (FIELD_DEFS[key]?.default !== false);
};

// ── Maydonlarni qo'llash (modal ochilganda chaqiriladi) ──

// Katalog: "Yangi mahsulot" modal
window.applyKatalogFields = function() {
  // Rasm (edit modal da)
  const epRasmRow = document.querySelector("#ov-editprod .fld:has(#ep-img-preview)");
  if (epRasmRow) epRasmRow.closest(".fld").style.display = fieldOn("katalog_rasm") ? "" : "none";

  // Barcode (add modal)
  const apBarcodeWrap = document.querySelector(".fld:has(#ap-barcode)");
  if (apBarcodeWrap) apBarcodeWrap.style.display = fieldOn("katalog_barcode") ? "" : "none";

  // Barcode (edit modal)
  const epBarcodeWrap = document.querySelector(".fld:has(#ep-barcode)");
  if (epBarcodeWrap) epBarcodeWrap.style.display = fieldOn("katalog_barcode") ? "" : "none";

  // Rang (add modal)
  const apRangWrap = document.querySelector(".fld:has(#ap-pp-wrap)");
  if (apRangWrap) apRangWrap.style.display = fieldOn("katalog_rang") ? "" : "none";

  // O'lcham (add modal) - bitta o'lcham va oraliq
  const apSizeArea = document.querySelector("#ov-addprod > .modal > div:has(.ap-smode)");
  if (apSizeArea) apSizeArea.style.display = fieldOn("katalog_olcham") ? "" : "none";

  // Karobka (add modal ichida oraliq karobka)
  // Karobka hisobi - ap-size-range ichida allaqachon bor, alohida toggle shart emas

  // Ulgurji narx (add modal)
  const apUlgWrap = document.querySelector(".fld:has(#ap-ulgurji)");
  if (apUlgWrap) apUlgWrap.style.display = fieldOn("katalog_ulgurji") ? "" : "none";

  // Ulgurji narx (edit modal)
  const epUlgWrap = document.querySelector(".fld:has(#ep-ulgurji)");
  if (epUlgWrap) epUlgWrap.style.display = fieldOn("katalog_ulgurji") ? "" : "none";
};

// Ombor: "Tovar qabul" modal
window.applyOmborFields = function() {
  // Rang
  const qbRangWrap = document.querySelector(".fld:has(#qb-pp-wrap)");
  if (qbRangWrap) qbRangWrap.style.display = fieldOn("ombor_rang") ? "" : "none";

  // Ulgurji yangilash
  const qbUlgWrap = document.querySelector(".fld:has(#qb-ulgurji)");
  if (qbUlgWrap) qbUlgWrap.style.display = fieldOn("ombor_ulgurji_yangi") ? "" : "none";

  // Yetkazuvchi
  const qbSupWrap = document.querySelector(".fld:has(#qb-sup)");
  if (qbSupWrap) qbSupWrap.style.display = fieldOn("ombor_yetkazuvchi") ? "" : "none";

  // Partiya
  const qbPartWrap = document.querySelector(".fld:has(#qb-partiya)");
  if (qbPartWrap) qbPartWrap.style.display = fieldOn("ombor_partiya") ? "" : "none";

  // Barcode
  const qbBarcodeWrap = document.querySelector(".fld:has(#qb-barcode)");
  if (qbBarcodeWrap) qbBarcodeWrap.style.display = fieldOn("ombor_barcode") ? "" : "none";
};

// POS: checkout paneli
window.applyPosFields = function() {
  // Chegirma bloki
  const chegirmaBlock = document.querySelector("#ov\\-pos .modal div:has(#discount-val)");
  // POS to'g'ridan-to'g'ri sahifada (modal emas), ID orqali topamiz
  _applyPosFieldsById();
};

function _applyPosFieldsById() {
  // Chegirma
  const chegirmaWrap = document.querySelector(".checkout-panel div:has(#discount-val)");
  if (chegirmaWrap) chegirmaWrap.style.display = fieldOn("pos_chegirma") ? "" : "none";

  // Izoh
  const izohWrap = document.querySelector(".checkout-panel div:has(#pos-note)");
  if (izohWrap) izohWrap.style.display = fieldOn("pos_izoh") ? "" : "none";

  // Nasiya: USD tugmasi
  const usdBtn = document.querySelector("button[data-c='usd'][onclick*='setDebtCurrency']");
  if (usdBtn) usdBtn.style.display = fieldOn("pos_usd") ? "" : "none";

  // Nasiya: muddat
  const muddatWrap = document.querySelector(".fld:has(#c-due)");
  if (muddatWrap) muddatWrap.style.display = fieldOn("pos_nasiya_muddat") ? "" : "none";

  // Ulgurji/Chakana narx tanlash
  const ptWrap = document.getElementById("price-type-wrap");
  if (ptWrap) {
    // Faqat showChakana yoqilgan bo'lsa ko'rsatiladi — ikki shartni birga tekshiramiz
    const shouldShow = fieldOn("pos_ulgurji") && (db.settings?.showChakana || false);
    ptWrap.style.display = shouldShow ? "block" : "none";
  }
}

// ── openModal hook: modal ochilganda avtomatik qo'llanadi ──
const _origOpenModal = window.openModal;
window.openModal = function(id) {
  if (typeof _origOpenModal === "function") _origOpenModal(id);
  if (id === "addprod" || id === "editprod") {
    setTimeout(window.applyKatalogFields, 30);
  }
  if (id === "qabul") {
    setTimeout(window.applyOmborFields, 30);
  }
};

// POS har yangilanganda ham qo'llansin
const _origRenderPosGrid = window.renderPosGrid;
window.renderPosGrid = function() {
  if (typeof _origRenderPosGrid === "function") _origRenderPosGrid();
  setTimeout(_applyPosFieldsById, 50);
};

// ── Asosiy sozlamalarni saqlash ───────────────────
function saveSetting(key, val) {
  if (!db.settings) db.settings = {};
  db.settings[key] = val;
  saveDB();

  if (key === "priceCurrency") {
    document.querySelectorAll("[data-c]").forEach(b =>
      b.classList.toggle("on", b.dataset.c === val));
    if (typeof updateCostCurrency === "function") updateCostCurrency();
    if (typeof updateRatePill      === "function") updateRatePill();
    if (typeof renderKatalog       === "function") renderKatalog();
    if (typeof renderPosGrid       === "function") renderPosGrid();
  }
  if (key === "rate") {
    if (typeof updateRatePill === "function") updateRatePill();
  }
  if (key === "name") {
    if (!db.shop) db.shop = {};
    db.shop.name = val;
    saveDB();
  }
}

function setShopType(t) {
  if (!db.settings) db.settings = {};
  db.settings.shopType = t;
  document.querySelectorAll("[data-t]").forEach(b =>
    b.classList.toggle("on", b.dataset.t === t));
  saveDB();
  toast("Do'kon turi saqlandi");
}

// ── Egasi sahifasini render qilish ───────────────
function renderEgasi() {
  if ($("s-name")) $("s-name").value = db.shop?.name || db.settings?.name || "";
  if ($("s-rate")) $("s-rate").value = db.settings?.rate || 12800;

  const cur = db.settings?.priceCurrency || "uzs";
  document.querySelectorAll("[data-c]").forEach(b =>
    b.classList.toggle("on", b.dataset.c === cur));

  const st = db.settings?.shopType || "ikki";
  document.querySelectorAll("[data-t]").forEach(b =>
    b.classList.toggle("on", b.dataset.t === st));

  const url = db.settings?.supabaseUrl || "";
  const key = db.settings?.supabaseKey || "";
  if ($("s-sup-url")) $("s-sup-url").value = url;
  if ($("s-sup-key")) $("s-sup-key").value = key;

  const badge = $("cloud-status-badge");
  if (badge) {
    if (url && key) { badge.textContent = "Ulangan ✅"; badge.className = "bg bg-g"; }
    else            { badge.textContent = "Ulanmagan";  badge.className = "bg bg-gr"; }
  }

  if ($("s-eskiz-token"))  $("s-eskiz-token").value  = db.settings?.eskizToken  || "";
  if ($("s-eskiz-sender")) $("s-eskiz-sender").value = db.settings?.eskizSender || "";
  if (typeof updateSmsUI       === "function") updateSmsUI();
  if (typeof initChakanaToggle === "function") initChakanaToggle();
  if (typeof updateCostCurrency=== "function") updateCostCurrency();

  renderFieldPanel();

  // POS ga ham hoziroq qo'llash (sahifa ochiq bo'lsa)
  _applyPosFieldsById();
}

// ════════════════════════════════════════════════
// MAYDONLAR BOSHQARUVI PANELI
// ════════════════════════════════════════════════

const FIELD_GROUPS = [
  {
    id:"fg_katalog", icon:"ti-tag",
    title:"Katalog — Mahsulot qo'shish",
    desc:"Yangi/tahrirlash formasidagi maydonlar",
    keys:["katalog_rasm","katalog_barcode","katalog_rang","katalog_olcham","katalog_ulgurji"]
  },
  {
    id:"fg_ombor", icon:"ti-truck-delivery",
    title:"Ombor — Tovar qabul",
    desc:"Kirim formasidagi maydonlar",
    keys:["ombor_rang","ombor_barcode","ombor_partiya","ombor_yetkazuvchi","ombor_ulgurji_yangi"]
  },
  {
    id:"fg_ustun", icon:"ti-table",
    title:"Ombor — Kirim tarixi ustunlari",
    desc:"Kirim tarixida ko'rinadigan ustunlar",
    keys:["ombor_ustun_rang","ombor_ustun_barcode","ombor_ustun_sup","ombor_ustun_partiya","ombor_ustun_tolova"]
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

// ── Toggle bitta maydon ───────────────────────────
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

  // Darhol qo'llaymiz
  _applyPosFieldsById();
  if (key.startsWith("ombor"))   window.applyOmborFields();
  if (key.startsWith("katalog")) window.applyKatalogFields();

  toast(!cur ? "✅ Yoqildi" : "⛔ O'chirildi", "info");
};

// ── Toggle butun guruh ────────────────────────────
window.toggleAllGroup = function(keys, e) {
  if (e) e.stopPropagation();
  if (!db.settings.fields) db.settings.fields = {};
  const allOn = keys.every(k => window.fieldOn(k));
  keys.forEach(k => { db.settings.fields[k] = !allOn; });
  saveDB();
  renderFieldPanel();
  _applyPosFieldsById();
  window.applyOmborFields();
  window.applyKatalogFields();
  toast(allOn ? "⛔ Barchasi o'chirildi" : "✅ Barchasi yoqildi", "info");
};
