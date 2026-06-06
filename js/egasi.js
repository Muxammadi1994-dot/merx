// MERX egasi.js | v3.0 | Maydonlar boshqaruvi qo'shildi
// ================================================

// ── Maydonlar default holati ──────────────────────
const FIELD_DEFS = {
  // Katalog — mahsulot qo'shish
  katalog_rasm:        { label:"Tovar rasmi",          icon:"ti-photo",           default:true  },
  katalog_barcode:     { label:"Barcode / EAN",         icon:"ti-barcode",         default:true  },
  katalog_rang:        { label:"Rang (Pantone)",        icon:"ti-palette",         default:true  },
  katalog_olcham:      { label:"O'lcham / razmer",      icon:"ti-resize",          default:true  },
  katalog_karobka:     { label:"Karobka hisobi",        icon:"ti-box",             default:true  },
  katalog_ulgurji:     { label:"Ulgurji narx maydoni",  icon:"ti-building-store",  default:true  },
  // Ombor — tovar qabul
  ombor_rang:          { label:"Rang (Pantone)",        icon:"ti-palette",         default:true  },
  ombor_barcode:       { label:"Barcode / EAN",         icon:"ti-barcode",         default:true  },
  ombor_partiya:       { label:"Partiya raqami",        icon:"ti-hash",            default:true  },
  ombor_yetkazuvchi:   { label:"Yetkazuvchi",           icon:"ti-user-check",      default:true  },
  ombor_ulgurji_yangi: { label:"Ulgurji narxni yangilash",icon:"ti-refresh",       default:true  },
  // Ombor — kirim tarixi jadvali ustunlari
  ombor_ustun_rang:    { label:"Rang/O'lcham ustuni",   icon:"ti-palette",         default:true  },
  ombor_ustun_barcode: { label:"Barcode ustuni",        icon:"ti-barcode",         default:false },
  ombor_ustun_sup:     { label:"Yetkazuvchi ustuni",    icon:"ti-user-check",      default:true  },
  ombor_ustun_partiya: { label:"Partiya ustuni",        icon:"ti-hash",            default:false },
  ombor_ustun_tolova:  { label:"To'lov holati ustuni",  icon:"ti-credit-card",     default:true  },
  // POS
  pos_chegirma:        { label:"Chegirma maydoni",      icon:"ti-discount",        default:true  },
  pos_izoh:            { label:"Izoh maydoni",          icon:"ti-notes",           default:true  },
  pos_usd:             { label:"USD to'lov varianti",   icon:"ti-currency-dollar", default:true  },
  pos_nasiya_muddat:   { label:"Nasiya muddat sanasi",  icon:"ti-calendar",        default:true  },
  pos_ulgurji:         { label:"Ulgurji narx turi",     icon:"ti-building-store",  default:true  },
};

// ── Global: maydon yoqilganmi? ────────────────────
window.fieldOn = function(key) {
  const f = db.settings?.fields || {};
  return f[key] !== undefined ? f[key] : (FIELD_DEFS[key]?.default !== false);
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
  if (typeof updateSmsUI === "function") updateSmsUI();
  if (typeof initChakanaToggle === "function") initChakanaToggle();
  if (typeof updateCostCurrency === "function") updateCostCurrency();

  // Maydonlar boshqaruvi
  renderFieldPanel();
}

// ════════════════════════════════════════════════
// MAYDONLAR BOSHQARUVI PANELI
// ════════════════════════════════════════════════

const FIELD_GROUPS = [
  {
    id:    "fg_katalog",
    icon:  "ti-tag",
    title: "Katalog — Mahsulot qo'shish",
    desc:  "Yangi mahsulot qo'shish formasidagi maydonlar",
    keys:  ["katalog_rasm","katalog_barcode","katalog_rang","katalog_olcham","katalog_karobka","katalog_ulgurji"]
  },
  {
    id:    "fg_ombor",
    icon:  "ti-truck-delivery",
    title: "Ombor — Tovar qabul",
    desc:  "Kirim formasidagi maydonlar",
    keys:  ["ombor_rang","ombor_barcode","ombor_partiya","ombor_yetkazuvchi","ombor_ulgurji_yangi"]
  },
  {
    id:    "fg_ustun",
    icon:  "ti-table",
    title: "Ombor — Kirim tarixi ustunlari",
    desc:  "Kirim tarixida ko'rinadigan ustunlar",
    keys:  ["ombor_ustun_rang","ombor_ustun_barcode","ombor_ustun_sup","ombor_ustun_partiya","ombor_ustun_tolova"]
  },
  {
    id:    "fg_pos",
    icon:  "ti-shopping-cart",
    title: "POS — Sotuv kassasi",
    desc:  "Sotuv jarayonidagi qo'shimcha maydonlar",
    keys:  ["pos_chegirma","pos_izoh","pos_usd","pos_nasiya_muddat","pos_ulgurji"]
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
        <label class="ft-item${on ? " ft-on" : ""}" id="fti_${key}">
          <div class="ft-left">
            <i class="ti ${def.icon}"></i>
            <span>${def.label}</span>
          </div>
          <div class="ft-sw${on ? " ft-sw-on" : ""}" onclick="toggleField('${key}', event)">
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
            onclick="toggleAllGroup(${JSON.stringify(g.keys)}, event)">
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
  if (label) label.classList.toggle("ft-on",  !cur);
  if (sw)    sw.classList.toggle("ft-sw-on",  !cur);

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
  toast(allOn ? "⛔ Barchasi o'chirildi" : "✅ Barchasi yoqildi", "info");
};
