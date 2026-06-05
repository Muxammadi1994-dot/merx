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

const visProds   = () => db.shop.type === "ikki" ? db.products : db.products.filter(p => p.type === db.shop.type);
const totalStock = p  => p.variants.reduce((a, v) => a + v.qty, 0);
const debtSales  = () => db.sales.filter(s => s.remaining > 0.5);
const isOverdue  = s  => s.due && s.due < today();

function priceDisplay(priceUzs) {
  const c = db.settings.priceCurrency || "uzs";
  const r = db.settings.rate || 1;
  if (c === "usd")  return fmtUsd(priceUzs / r);
  if (c === "both") return fmt(priceUzs) + " / " + fmtUsd(priceUzs / r);
  return fmt(priceUzs) + " so'm";
}

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
  if (p === "pos") { refreshCustList(); refreshStaffList(); renderPosGrid(); }
}

// ── Chakana rejim toggle ───────────────────────
function toggleChakanaMode(val) {
  if (!db.settings) db.settings = {};
  db.settings.showChakana = val;
  saveDB();
  const lbl = $("s-chakana-lbl");
  if (lbl) lbl.textContent = val
    ? "✅ Chakana narx ko'rinyapti"
    : "Chakana narx ko'rinmayapti (ulgurji rejim)";
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
}

function toggleCurrency() {
  const opts = ["uzs", "usd", "both"];
  const cur = db.settings.priceCurrency || "uzs";
  db.settings.priceCurrency = opts[(opts.indexOf(cur) + 1) % 3];
  saveDB(); updateRatePill(); renderKatalog(); renderPosGrid();
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
    $("qb-list").innerHTML = db.products.map(p => `<option value="${p.name}">`).join("");
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
