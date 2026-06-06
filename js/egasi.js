// MERX egasi.js | v3.2 | To'liq maydonlar boshqaruvi
// ================================================

const FIELD_DEFS = {
  // Katalog — mahsulot qo'shish
  katalog_kategoriya:  { label:"Kategoriya",              icon:"ti-category",        default:true  },
  katalog_birlik:      { label:"O'lchov birligi",         icon:"ti-ruler",           default:true  },
  katalog_karobka:     { label:"Qutida nechta / Karobka", icon:"ti-box",             default:true  },
  katalog_tannarx:     { label:"Tannarx (USD)",           icon:"ti-coin",            default:true  },
  katalog_ulgurji:     { label:"Ulgurji narx",            icon:"ti-building-store",  default:true  },
  katalog_rang:        { label:"Rang (Pantone)",          icon:"ti-palette",         default:true  },
  katalog_olcham:      { label:"O'lcham / razmer",        icon:"ti-resize",          default:true  },
  katalog_barcode:     { label:"Barcode / EAN",           icon:"ti-barcode",         default:true  },
  katalog_rasm:        { label:"Tovar rasmi",             icon:"ti-photo",           default:true  },
  // Ombor — tovar qabul
  ombor_rang:          { label:"Rang (Pantone)",          icon:"ti-palette",         default:true  },
  ombor_barcode:       { label:"Barcode / EAN",           icon:"ti-barcode",         default:true  },
  ombor_partiya:       { label:"Partiya raqami",          icon:"ti-hash",            default:true  },
  ombor_yetkazuvchi:   { label:"Yetkazuvchi",             icon:"ti-user-check",      default:true  },
  ombor_ulgurji_yangi: { label:"Ulgurji narxni yangilash",icon:"ti-refresh",         default:true  },
  // Ombor — kirim tarixi ustunlari
  ombor_ustun_rang:    { label:"Rang/O'lcham ustuni",     icon:"ti-palette",         default:true  },
  ombor_ustun_barcode: { label:"Barcode ustuni",          icon:"ti-barcode",         default:false },
  ombor_ustun_sup:     { label:"Yetkazuvchi ustuni",      icon:"ti-user-check",      default:true  },
  ombor_ustun_partiya: { label:"Partiya ustuni",          icon:"ti-hash",            default:false },
  ombor_ustun_tolova:  { label:"To'lov holati ustuni",    icon:"ti-credit-card",     default:true  },
  // POS
  pos_chegirma:        { label:"Chegirma maydoni",        icon:"ti-discount",        default:true  },
  pos_izoh:            { label:"Izoh maydoni",            icon:"ti-notes",           default:true  },
  pos_usd:             { label:"USD nasiya varianti",     icon:"ti-currency-dollar", default:true  },
  pos_nasiya_muddat:   { label:"Nasiya muddat sanasi",    icon:"ti-calendar",        default:true  },
  pos_ulgurji:         { label:"Ulgurji/Chakana tanlash", icon:"ti-building-store",  default:true  },
};

// ── Global: maydon yoqilganmi? ────────────────────
window.fieldOn = function(key) {
  const f = db.settings?.fields || {};
  return f[key] !== undefined ? f[key] : (FIELD_DEFS[key]?.default !== false);
};

// ════════════════════════════════════════════════
// MAYDONLARNI QO'LLASH (modal ochilganda)
// ════════════════════════════════════════════════

// Katalog "Yangi mahsulot" + "Tahrirlash" modallari
window.applyKatalogFields = function() {
  const fo = window.fieldOn;

  // ── ADD PRODUCT MODAL (#ov-addprod) ──

  // Kategoriya + O'lchov birligi + Qutida nechta (r3 bloki)
  const apR3 = document.querySelector("#ov-addprod .modal .r3");
  if (apR3) {
    const flds = apR3.querySelectorAll(".fld");
    if (flds[0]) flds[0].style.display = fo("katalog_kategoriya") ? "" : "none"; // Kategoriya
    if (flds[1]) flds[1].style.display = fo("katalog_birlik")     ? "" : "none"; // O'lchov birligi
    if (flds[2]) flds[2].style.display = fo("katalog_karobka")    ? "" : "none"; // Qutida nechta
  }

  // Rang (Pantone picker)
  const apRangWrap = document.querySelector("#ov-addprod .fld:has(#ap-pp-wrap)");
  if (apRangWrap) apRangWrap.style.display = fo("katalog_rang") ? "" : "none";

  // O'lcham + razmer (ap-smode tugmalar va size bloklari)
  const apSizeBlock = document.querySelector("#ov-addprod .modal > div:has(.ap-smode)");
  if (apSizeBlock) apSizeBlock.style.display = fo("katalog_olcham") ? "" : "none";

  // Tannarx (ap-cost-wrap)
  const apCostWrap = document.getElementById("ap-cost-wrap");
  if (apCostWrap) apCostWrap.style.display = fo("katalog_tannarx") ? "" : "none";

  // Ulgurji narx
  const apUlgWrap = document.querySelector("#ov-addprod .fld:has(#ap-ulgurji)");
  if (apUlgWrap) apUlgWrap.style.display = fo("katalog_ulgurji") ? "" : "none";

  // Barcode
  const apBarcodeWrap = document.querySelector("#ov-addprod .fld:has(#ap-barcode)");
  if (apBarcodeWrap) apBarcodeWrap.style.display = fo("katalog_barcode") ? "" : "none";

  // ── EDIT PRODUCT MODAL (#ov-editprod) ──

  // Kategoriya + birlik (r3 birinchi 2 ta fld)
  const epR3 = document.querySelector("#ov-editprod .modal .r3");
  if (epR3) {
    const flds = epR3.querySelectorAll(".fld");
    // ep-name doim, ep-cat = kategoriya, ep-unit = birlik
    if (flds[1]) flds[1].style.display = fo("katalog_kategoriya") ? "" : "none";
    if (flds[2]) flds[2].style.display = fo("katalog_birlik")     ? "" : "none";
  }

  // Barcode (edit)
  const epBarcodeWrap = document.querySelector("#ov-editprod .fld:has(#ep-barcode)");
  if (epBarcodeWrap) epBarcodeWrap.style.display = fo("katalog_barcode") ? "" : "none";

  // Rasm (edit)
  const epRasmWrap = document.querySelector("#ov-editprod .fld:has(#ep-img-preview)");
  if (epRasmWrap) epRasmWrap.style.display = fo("katalog_rasm") ? "" : "none";

  // Tannarx (edit)
  const epCostWrap = document.getElementById("ep-cost-wrap");
  if (epCostWrap) epCostWrap.style.display = fo("katalog_tannarx") ? "" : "none";

  // Ulgurji narx (edit)
  const epUlgWrap = document.querySelector("#ov-editprod .fld:has(#ep-ulgurji)");
  if (epUlgWrap) epUlgWrap.style.display = fo("katalog_ulgurji") ? "" : "none";

  // Karobkada nechta (edit)
  const epInboxWrap = document.querySelector("#ov-editprod .fld:has(#ep-inbox)");
  if (epInboxWrap) epInboxWrap.style.display = fo("katalog_karobka") ? "" : "none";
};

// Ombor "Tovar qabul" modal
window.applyOmborFields = function() {
  const fo = window.fieldOn;

  const qbRangWrap   = document.querySelector(".fld:has(#qb-pp-wrap)");
  if (qbRangWrap)    qbRangWrap.style.display   = fo("ombor_rang")          ? "" : "none";

  const qbUlgWrap    = document.querySelector(".fld:has(#qb-ulgurji)");
  if (qbUlgWrap)     qbUlgWrap.style.display    = fo("ombor_ulgurji_yangi") ? "" : "none";

  const qbSupWrap    = document.querySelector(".fld:has(#qb-sup)");
  if (qbSupWrap)     qbSupWrap.style.display    = fo("ombor_yetkazuvchi")   ? "" : "none";

  const qbPartWrap   = document.querySelector(".fld:has(#qb-partiya)");
  if (qbPartWrap)    qbPartWrap.style.display   = fo("ombor_partiya")       ? "" : "none";

  const qbBarcodeWrap= document.querySelector(".fld:has(#qb-barcode)");
  if (qbBarcodeWrap) qbBarcodeWrap.style.display= fo("ombor_barcode")       ? "" : "none";
};

// POS checkout paneli
function _applyPosFields() {
  const fo = window.fieldOn;

  const chegirmaWrap = document.querySelector(".checkout-panel div:has(#discount-val)");
  if (chegirmaWrap) chegirmaWrap.style.display = fo("pos_chegirma") ? "" : "none";

  const izohWrap = document.querySelector(".checkout-panel div:has(#pos-note)");
  if (izohWrap) izohWrap.style.display = fo("pos_izoh") ? "" : "none";

  const usdBtn = document.querySelector("button[data-c='usd'][onclick*='setDebtCurrency']");
  if (usdBtn) usdBtn.style.display = fo("pos_usd") ? "" : "none";

  const muddatWrap = document.querySelector(".fld:has(#c-due)");
  if (muddatWrap) muddatWrap.style.display = fo("pos_nasiya_muddat") ? "" : "none";

  const ptWrap = document.getElementById("price-type-wrap");
  if (ptWrap) {
    const show = fo("pos_ulgurji") && (db.settings?.showChakana || false);
    ptWrap.style.display = show ? "block" : "none";
  }
}

// openModal hook
const _origOpenModal = window.openModal;
window.openModal = function(id) {
  if (typeof _origOpenModal === "function") _origOpenModal(id);
  if (id === "addprod" || id === "editprod") setTimeout(window.applyKatalogFields, 30);
  if (id === "qabul")                        setTimeout(window.applyOmborFields,   30);
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
  if (typeof updateSmsUI        === "function") updateSmsUI();
  if (typeof initChakanaToggle  === "function") initChakanaToggle();
  if (typeof updateCostCurrency === "function") updateCostCurrency();

  renderFieldPanel();
  _applyPosFields();
}

// ════════════════════════════════════════════════
// MAYDONLAR BOSHQARUVI PANELI
// ════════════════════════════════════════════════

const FIELD_GROUPS = [
  {
    id:"fg_katalog", icon:"ti-tag",
    title:"Katalog — Mahsulot qo'shish / tahrirlash",
    desc:"Yangi mahsulot formasidagi maydonlar",
    keys:["katalog_kategoriya","katalog_birlik","katalog_karobka","katalog_tannarx",
          "katalog_ulgurji","katalog_rang","katalog_olcham","katalog_barcode","katalog_rasm"]
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
  if (label) label.classList.toggle("ft-on",  !cur);
  if (sw)    sw.classList.toggle("ft-sw-on",  !cur);

  // Darhol qo'llaymiz
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
