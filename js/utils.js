// MERX utils.js | v2.3 | 2026-06-06
// ================================================
// MERX — js/utils.js
// Yordamchi funksiyalar, toast, navigatsiya
// ================================================

const fmt    = n  => Math.round(n).toLocaleString("ru-RU");
const fmtUsd = n  => "$" + (+n).toFixed(2);
const $      = id => document.getElementById(id);
const today  = () => new Date().toISOString().slice(0, 10);
const nowTime= () => new Date().toLocaleTimeString("uz-UZ", {hour:"2-digit", minute:"2-digit"});

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().slice(0, 10);
}

const visProds  = () => db.shop.type === "ikki" ? db.products : db.products.filter(p => p.type === db.shop.type);
const debtSales = () => db.sales.filter(s => s.remaining > 0.5);
const isOverdue = s  => s.due && s.due < today();

// ══════════════════════════════════════════════════
// getStock() — ASOSIY QOLDIQ FUNKSIYASI
// Ombor kirimi - sotuvlardan hisoblaydi
// ══════════════════════════════════════════════════
//
// Ishlatish:
//   getStock("adidas")                    → barcha ranglar va o'lchamlar bo'yicha jami
//   getStock("adidas", "Qora")            → faqat Qora rang jami
//   getStock("adidas", "Qora", "39-44")   → aniq rang+o'lcham
//
// Bu funksiya variants[].qty ga QARAMAYDI.
// Faqat ombor kirim yig'indisi - sotuv yig'indisi = haqiqiy qoldiq.
// ══════════════════════════════════════════════════
function getStock(productName, color, size) {
  // 1. Ombor kirimi (necha dona kelgan)
  let kirim = 0;
  for (const o of (db.ombor || [])) {
    if (o.productName !== productName) continue;
    if (color && o.color !== color) continue;
    if (size  && o.size  !== size)  continue;
    kirim += (o.qty || 0);
  }

  // 2. Sotuvlarda ketgan miqdor
  let chiqim = 0;
  for (const s of (db.sales || [])) {
    // Qaytarilgan sotuvni hisobga olmaymiz
    if (s.status === "qaytarilgan") continue;
    for (const item of (s.items || [])) {
      if (item.name !== productName) continue;

      if (!color && !size) {
        // Jami so'ralganda — hammasini hisobga ol
        chiqim += (item.qty || 0);
      } else {
        // variant = "Qora / 41"  yoki  "Qora (3 karobka)"  yoki  "Qora"
        const v = item.variant || "";
        const itemColor = v.split("/")[0].split("(")[0].trim();
        const itemSize  = v.includes("/") ? v.split("/")[1].trim() : null;

        if (color && itemColor !== color) continue;
        if (size  && itemSize  && itemSize !== size) continue;
        chiqim += (item.qty || 0);
      }
    }
  }

  return Math.max(0, kirim - chiqim);
}

// ── Mahsulot bo'yicha jami qoldiq (katalog uchun) ─
// totalStock(p) → getStock(p.name) ga yo'naltiradi
// Eski kod bilan moslik saqlanadi
function totalStock(p) {
  // Agar ombor ma'lumoti mavjud bo'lsa — getStock ishlatamiz
  const omborExists = (db.ombor || []).some(o => o.productName === p.name);
  if (omborExists) {
    return getStock(p.name);
  }
  // Fallback: eski zaxira fayllarida variants[].qty bo'lishi mumkin
  return p.variants ? p.variants.reduce((a, v) => a + (v.qty || 0), 0) : 0;
}

// ── Rang bo'yicha qoldiq (ombor ko'rinishi uchun) ─
function getStockByColor(productName, color) {
  return getStock(productName, color);
}

// ── Variant bo'yicha qoldiq ───────────────────────
function getStockByVariant(productName, color, size) {
  return getStock(productName, color, size);
}

// ── Mahsulotning barcha rang-qoldiqlari ──────────
// { "Qora": 42, "Krem": 18 } — ombor sahifasi uchun
function getStockGroupedByColor(productName) {
  const result = {};
  // Ombordagi barcha ranglarni topamiz
  for (const o of (db.ombor || [])) {
    if (o.productName !== productName) continue;
    if (!result[o.color]) result[o.color] = { qty: 0, hex: o.hex || "#888", pantone: o.pantone || "" };
  }
  // Har bir rang uchun haqiqiy qoldiqni hisoblaymiz
  for (const color of Object.keys(result)) {
    result[color].qty = getStock(productName, color);
  }
  // Fallback: agar ombor yozuvi yo'q, variants dan olamiz
  if (!Object.keys(result).length && db.products) {
    const p = db.products.find(x => x.name === productName);
    if (p) {
      const groups = {};
      (p.variants || []).forEach(v => {
        if (!groups[v.color]) groups[v.color] = { qty: 0, hex: v.hex || "#888", pantone: v.pantone || "" };
        groups[v.color].qty += (v.qty || 0);
      });
      return groups;
    }
  }
  return result;
}

// ══════════════════════════════════════════════════
// Narx ko'rsatish
// ══════════════════════════════════════════════════
function priceDisplay(priceUzs) {
  const c = db.settings.priceCurrency || "uzs";
  const r = db.settings.rate || 1;
  if (c === "usd")  return fmtUsd(priceUzs / r);
  if (c === "both") return fmt(priceUzs) + " / " + fmtUsd(priceUzs / r);
  return fmt(priceUzs) + " so'm";
}

// ══════════════════════════════════════════════════
// Toast, navigatsiya, modal
// ══════════════════════════════════════════════════
let toastT;
function toast(msg, type = "ok") {
  const icons = { ok:"ti-check", err:"ti-alert-circle", info:"ti-info-circle" };
  $("toast-ico").className = "ti " + (icons[type] || "ti-check");
  $("toast-msg").textContent = msg;
  $("toast").classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => $("toast").classList.remove("on"), 4000);
}

function nav(p) {
  document.querySelectorAll(".ni").forEach(n => n.classList.toggle("on", n.dataset.p === p));
  document.querySelectorAll("[id^='p-']").forEach(el => el.classList.remove("on"));
  const el = $("p-" + p); if (el) el.classList.add("on");
  const T = { dashboard:"Dashboard", pos:"Sotuv (POS)", katalog:"Katalog", ombor:"Ombor",
    mijozlar:"Mijozlar", qarzlar:"Qarzlar", tarix:"Sotuv tarixi",
    hisobot:"Hisobot va tahlil", xodimlar:"Xodimlar", moliya:"Moliya", egasi:"Egasi / Sozlamalar" };
  $("ptitle").textContent = T[p] || p;
  const fn = { dashboard:renderDashboard, katalog:renderKatalog, ombor:renderOmbor,
    mijozlar:renderMijozlar, qarzlar:renderDebts, tarix:renderTarix,
    hisobot:renderHisobot, xodimlar:renderXodimlar, moliya:renderMoliya, egasi:renderEgasi };
  if (fn[p]) fn[p]();
  if (p === "egasi") setTimeout(initChakanaToggle, 50);
  if (p === "pos") {
    refreshCustList(); refreshStaffList(); renderPosGrid();
    const ptw = $("price-type-wrap");
    if (ptw) ptw.style.display = db.settings?.showChakana ? "block" : "none";
    if (!db.settings?.showChakana && typeof setPriceType === "function") setPriceType("ulgurji");
    if (typeof checkDebtAlerts === "function") checkDebtAlerts();
  }
}

// ── Chakana rejim toggle ──────────────────────────
function toggleChakanaMode(val) {
  if (!db.settings) db.settings = {};
  db.settings.showChakana = val;
  saveDB();
  const lbl = $("s-chakana-lbl");
  if (lbl) lbl.textContent = val
    ? "✅ Chakana narx ko'rinyapti"
    : "Chakana narx ko'rinmayapti (ulgurji rejim)";
  const ptw = $("price-type-wrap");
  if (ptw) ptw.style.display = val ? "block" : "none";
  if (!val && typeof setPriceType === "function") setPriceType("ulgurji");
  if (typeof renderKatalog === "function") renderKatalog();
  if (typeof renderOmbor   === "function") renderOmbor();
  toast(val ? "Chakana rejim yoqildi" : "Ulgurji rejimga o'tildi", "info");
}

function initChakanaToggle() {
  const cb  = $("s-chakana"); if (!cb) return;
  const val = db.settings?.showChakana || false;
  cb.checked = val;
  const lbl = $("s-chakana-lbl");
  if (lbl) lbl.textContent = val
    ? "✅ Chakana narx ko'rinyapti"
    : "Chakana narx ko'rinmayapti (ulgurji rejim)";
  const ptw = $("price-type-wrap");
  if (ptw) ptw.style.display = val ? "block" : "none";
}

function toggleCurrency() {
  const opts = ["uzs", "usd", "both"];
  const cur = db.settings.priceCurrency || "uzs";
  db.settings.priceCurrency = opts[(opts.indexOf(cur) + 1) % 3];
  saveDB(); updateRatePill();
  const renders = [
    ["katalog",  renderKatalog],
    ["ombor",    renderOmbor],
    ["tarix",    renderTarix],
    ["qarzlar",  renderDebts],
    ["hisobot",  renderHisobot],
    ["pos",      renderPosGrid],
  ];
  renders.forEach(([page, fn]) => {
    const el = $("p-" + page);
    if (el && el.classList.contains("on") && typeof fn === "function") fn();
  });
  if (typeof renderKatalog  === "function") renderKatalog();
  if (typeof renderPosGrid  === "function") renderPosGrid();
  if (typeof updateCostCurrency === "function") updateCostCurrency();
}

function updateRatePill() {
  $("tb-rate").textContent = fmt(db.settings.rate || 0);
  const lbl = { uzs:"so'm", usd:"USD", both:"so'm/USD" };
  $("tb-cur").textContent = lbl[db.settings.priceCurrency || "uzs"] || "so'm";
}

function openModal(id) {
  $("ov-" + id).classList.add("on");
  if (id === "addprod") { apTypeChange(); setTimeout(() => { if ($("ap-name")) $("ap-name").focus(); }, 50); }
  if (id === "addcust") { setTimeout(() => { if ($("ac-name")) $("ac-name").focus(); }, 50); }
  if (id === "addstaff") { setTimeout(() => { if ($("as-name")) $("as-name").focus(); }, 50); }
  if (id === "addxarajat") {
    if ($("ax-date")) $("ax-date").value = today();
    setTimeout(() => { if ($("ax-sum")) $("ax-sum").focus(); }, 50);
  }
  if (id === "qabul") {
    // Katalogdan mahsulotlar ro'yxati
    const list = $("qb-prod-list");
    if (list) list.innerHTML = db.products.map(p => `<option value="${p.name}">`).join("");
    setTimeout(() => { if ($("qb-name")) $("qb-name").focus(); }, 50);
  }
}

function closeModal(id) { $("ov-" + id).classList.remove("on"); }

function exportDB() {
  const b = new Blob([JSON.stringify(db, null, 2)], { type:"application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(b);
  a.download = "merx_zaxira_" + today() + ".json"; a.click();
  toast("Zaxira yuklab olindi");
}

function importDB(inp) {
  const f = inp.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { db = JSON.parse(r.result); saveDB(); init(); toast("Zaxiradan tiklandi"); }
    catch(e) { toast("Fayl noto'g'ri", "err"); }
  };
  r.readAsText(f);
}

// ── Narx inputi formatlash ────────────────────────
function fmtInput(input) {
  const raw   = input.value.replace(/\D/g, "");
  const num   = parseInt(raw) || 0;
  input.value = num > 0 ? num.toLocaleString("ru-RU") : "";
  input.dataset.raw = raw;
}

function getRawVal(id) {
  const el = $(id); if (!el) return 0;
  const raw = el.dataset.raw || el.value.replace(/\s/g,"").replace(/,/g,"");
  return parseFloat(raw) || 0;
}

function initPriceInputs() {
  document.querySelectorAll("input[data-price]").forEach(inp => {
    inp.addEventListener("input", () => fmtInput(inp));
  });
}

// ── Universal CSV eksport (Excel uchun) ──────────
function downloadCSV(rows, filename) {
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
  html += '<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>MERX</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>';
  rows.forEach((row, i) => {
    html += '<tr>';
    row.forEach(cell => {
      const tag = i === 0 ? 'th' : 'td';
      const val = String(cell == null ? '' : cell);
      const style = /^\d{8,}$/.test(val) ? ' style="mso-number-format:\'@\'"' : '';
      html += `<${tag}${style}>${val.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</${tag}>`;
    });
    html += '</tr>';
  });
  html += '</table></body></html>';
  const blob = new Blob([html], {type: 'application/vnd.ms-excel;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename.replace('.csv', '.xls');
  a.click();
  URL.revokeObjectURL(url);
}

// ── Barcode generatsiya ───────────────────────────
function genEAN13(seed) {
  const base = String(Math.abs(seed || Date.now()) % 1000000000000).padStart(12, "0");
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}
