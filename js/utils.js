// MERX utils.js | v2.2 | 2026-06-06 06:00
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

const getShopType = () => db.settings?.shopType || db.shop?.type || "ikki";
const visProds    = () => { const t = getShopType(); return t === "ikki" ? db.products : db.products.filter(p => p.type === t); };
const totalStock = p  => p.variants.reduce((a, v) => a + v.qty, 0);

// O'lchamlar ro'yxatini ixcham formatga aylantirish: ["39","40","41","42","43","44"] → "39-44"
// Ketma-ket bo'lmasa: ["39","42"] → "39, 42". Bitta bo'lsa: ["39"] → "39"
function sizesToRange(sizeList, type) {
  if (!sizeList || sizeList.length === 0) return "";
  if (sizeList.length === 1) return sizeList[0];
  const allSizes = (typeof SIZES !== "undefined" && SIZES[type]) ? SIZES[type] : null;
  if (allSizes) {
    const indices = sizeList.map(s => allSizes.indexOf(s)).filter(i => i !== -1).sort((a,b)=>a-b);
    if (indices.length === sizeList.length) {
      const isConsecutive = indices.every((idx, i) => i === 0 || idx === indices[i-1] + 1);
      if (isConsecutive) {
        const first = allSizes[indices[0]], last = allSizes[indices[indices.length-1]];
        return `${first}-${last}`;
      }
    }
  }
  // Ketma-ket emas yoki SIZES topilmadi — vergul bilan
  return sizeList.join(", ");
}

// ── Pochka guruhlash ──────────────────────────────
// Dona sotuvi natijasida o'lchamlar nomutanosib bo'lib qolsa,
// variantlarni "to'liq pochka" va "ochilgan pochka" guruhlariga ajratadi.
function regroupPackages(variants, color) {
  const colorVariants = variants.filter(v => v.color === color);
  if (colorVariants.length === 0) return [];

  const qtys = colorVariants.map(v => v.qty);
  const minQty = Math.min(...qtys);
  const allEqual = qtys.every(q => q === minQty);

  if (allEqual) {
    return [{ packGroup: 0, qty: minQty, isBroken: false, variants: colorVariants }];
  }

  const groups = [{ packGroup: 0, qty: minQty, isBroken: false, variants: colorVariants.map(v => ({...v, qty: minQty})) }];

  let groupIdx = 1;
  let rem = colorVariants.map(v => ({ ...v, qty: v.qty - minQty })).filter(v => v.qty > 0);
  while (rem.length > 0) {
    const rQtys = rem.map(v => v.qty);
    const rMin = Math.min(...rQtys);
    groups.push({
      packGroup: groupIdx,
      qty: rMin,
      isBroken: true,
      variants: rem.map(v => ({...v, qty: rMin}))
    });
    rem = rem.map(v => ({ ...v, qty: v.qty - rMin })).filter(v => v.qty > 0);
    groupIdx++;
  }

  return groups;
}

const debtSales  = () => db.sales.filter(s => s.remaining > 0.5);
const isOverdue  = s  => s.due && s.due < today();

// ── Qarz to'lov chek raqami ────────────────────
function genPayChekNum() {
  const datePart = today().replace(/-/g, "");
  const seq = (db.debtPayments || []).filter(p => p.chekNum?.includes(datePart)).length + 1;
  return `PAY-${datePart}-${String(seq).padStart(4, "0")}`;
}

// ── Valyuta formatlash (qarz to'lovlari uchun) ─
function fmtMoney(amount, currency) {
  return currency === "usd" ? `$${(+amount).toFixed(2)}` : `${fmt(amount)} so'm`;
}

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
    hisobot:"Hisobot va tahlil", xodimlar:"Xodimlar", moliya:"Moliya",
    portal:"Mijoz portali", egasi:"Egasi / Sozlamalar" };
  $("ptitle").textContent = T[p] || p;
  const fn = { dashboard:renderDashboard, katalog:renderKatalog, ombor:renderOmbor,
    mijozlar:renderMijozlar, qarzlar:renderDebts, tarix:renderTarix,
    hisobot:renderHisobot, xodimlar:renderXodimlar, moliya:renderMoliya,
    portal:renderPortal, egasi:renderEgasi };
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

// ── Chakana rejim toggle ───────────────────────
function toggleChakanaMode(val) {
  if (!db.settings) db.settings = {};
  db.settings.showChakana = val;
  saveDB();
  const lbl = $("s-chakana-lbl");
  if (lbl) lbl.textContent = val
    ? "✅ Chakana narx ko'rinyapti"
    : "Chakana narx ko'rinmayapti (ulgurji rejim)";
  // POS narx turi paneli
  const ptw = $("price-type-wrap");
  if (ptw) ptw.style.display = val ? "block" : "none";
  // Agar chakana o'chirilsa — ulgurjiga qaytamiz
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
  // Barcha ochiq bo'limlarni yangilaymiz
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
  // Aktiv bo'lmasa ham katalog va posni yangilaymiz (har doim kerak)
  if (typeof renderKatalog  === "function") renderKatalog();
  if (typeof renderPosGrid  === "function") renderPosGrid();
  // Tannarx valyutasini yangilash
  if (typeof updateCostCurrency === "function") updateCostCurrency();
}
function updateRatePill() {
  $("tb-rate").textContent = fmt(db.settings.rate || 0);
  const lbl = { uzs:"so'm", usd:"USD", both:"so'm/USD" };
  $("tb-cur").textContent = lbl[db.settings.priceCurrency || "uzs"] || "so'm";
}
function openModal(id) {
  // Avval ochiq turgan boshqa modallarni yopamiz — bir nechta modal
  // bir vaqtda "kutib qolmasligi" uchun
  try {
    document.querySelectorAll(".ov.on").forEach(ov => {
      if (ov.id !== "ov-" + id) ov.classList.remove("on");
    });
    const invEl = document.getElementById("ov-invent");
    if (invEl) invEl.style.display = "none";
  } catch (e) { /* zararsiz, davom etamiz */ }

  const modalEl = document.getElementById("ov-" + id);
  if (modalEl) {
    // Modalni #app konteyneridan tashqariga, to'g'ridan-to'g'ri <body> ga ko'chiramiz.
    // Bu CSS "containing block" muammolarini (flex/transform ota-onalar) chetlab o'tadi —
    // position:fixed har doim butun ekranga nisbatan to'g'ri ishlashini kafolatlaydi.
    if (modalEl.parentElement !== document.body) {
      document.body.appendChild(modalEl);
    }
    modalEl.classList.add("on");
  }

  if (id === "addprod") { apResetImage(); apTypeChange(); setTimeout(() => { if ($("ap-name")) $("ap-name").focus(); }, 50); }
  if (id === "addcust") { setTimeout(() => { if ($("ac-name")) $("ac-name").focus(); }, 50); }
  if (id === "addstaff") { setTimeout(() => { if ($("as-name")) $("as-name").focus(); }, 50); }
  if (id === "addxarajat") {
    if ($("ax-date")) $("ax-date").value = today();
    setTimeout(() => { if ($("ax-sum")) $("ax-sum").focus(); }, 50);
  }
  if (id === "qabul") {
    if (typeof qbResetModal === "function") qbResetModal();
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
// input[data-price] yoki input[data-fmt] atributli maydonlar uchun
function fmtInput(input) {
  const raw   = input.value.replace(/\D/g, "");
  const num   = parseInt(raw) || 0;
  input.value = num > 0 ? num.toLocaleString("ru-RU") : "";
  input.dataset.raw = raw;
}

function getRawVal(id) {
  const el = $(id); if (!el) return 0;
  // data-raw dan o'qish, yoki to'g'ridan raqam
  const raw = el.dataset.raw || el.value.replace(/\s/g,"").replace(/,/g,"");
  return parseFloat(raw) || 0;
}

// Barcha data-price inputlarini ishga tushirish
function initPriceInputs() {
  document.querySelectorAll("input[data-price]").forEach(inp => {
    inp.addEventListener("input", () => fmtInput(inp));
    inp.addEventListener("focus", () => {
      // Focus bo'lganda ham formatlanganligicha qolsin
    });
  });
}

// ── Universal CSV eksport (Excel uchun) ──────────
function downloadCSV(rows, filename) {
  // HTML table orqali Excel ga export — encoding muammosi yo'q
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
  html += '<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>MERX</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>';
  rows.forEach((row, i) => {
    html += '<tr>';
    row.forEach(cell => {
      const tag = i === 0 ? 'th' : 'td';
      const val = String(cell == null ? '' : cell);
      // Raqamlarni matn sifatida saqlash (barcode uchun)
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
// ════════════════════════════════════════════════
// MERX — Universal chek HTML builder  v2.0
// ════════════════════════════════════════════════

function buildReceiptHtml(sale, opts) {
  opts = opts || {};
  const shopName   = opts.shopName   || (typeof db !== "undefined" && db.shop?.name) || "MERX";
  const staffName  = opts.staffName  || "—";
  const botUser    = (opts.botUsername || "").replace(/^@/, "");
  const receiptUrl = opts.receiptUrl || "";

  // ── Maydonlar normalizatsiyasi ─────────────────
  const chekNum   = sale.chekNum    || sale.chek_num    || ("#" + sale.id);
  const rawDate   = sale.date || "";
  const date      = rawDate.includes("-") && rawDate.length === 10
    ? rawDate.split("-").reverse().join(".")   // 2026-06-16 → 16.06.2026
    : rawDate;
  const time      = sale.time       || "";
  const payType   = sale.payType    || sale.pay_type    || "";
  const payBreakdown = sale.payBreakdown || sale.pay_breakdown || null;
  const custName  = sale.customerName || sale.customer_name || "";
  const custPhone = sale.customerPhone || sale.customer_phone || "";
  const total     = Number(sale.total     || 0);
  const paid      = Number(sale.paid      || 0);
  const remaining = Number(sale.remaining || 0);
  const discount  = Number(sale.discount  || 0);
  const due       = sale.due  || "";
  const note      = sale.note || "";
  const debtCur   = sale.debtCurrency || sale.debt_currency || "uzs";
  const debtUsd   = sale.debtUsd   != null ? Number(sale.debtUsd)      : (sale.debt_usd   != null ? Number(sale.debt_usd)   : null);
  const prevUsd   = sale.prevDebtUsd != null ? Number(sale.prevDebtUsd) : null;
  const prevUzs   = sale.prevDebtUzs != null ? Number(sale.prevDebtUzs) : null;
  const isUsd     = debtCur === "usd" && debtUsd != null;
  const items     = (sale.items || []).filter(Boolean);

  const payLabels = { naqd: "Naqd pul", karta: "Karta", otkazma: "Bank o'tkazmasi", aralash: "Aralash" };
  const F = n => Math.round(n || 0).toLocaleString("ru-RU");

  // ── Mahsulotlar ───────────────────────────────
  const itemsHtml = items.map((i, idx) => {
    const sum    = (i.price || 0) * (i.qty || 0);
    const sku    = i.art ? `<span class="it-sku">ART: ${i.art}</span>` : (i.sku ? `<span class="it-sku" style="color:#bbb">SKU: ${i.sku}</span>` : "");
    const boxRow = i.qtyBox && i.inBox
      ? `<div class="it-box">${i.qtyBox} karobka × ${F((i.price||0)*(i.inBox||1))} so'm/karobka</div>` : "";
    return `
      <div class="it">
        <div class="it-num">${idx + 1}</div>
        <div class="it-body">
          <div class="it-top">
            <div class="it-name">${i.name || ""}${sku}</div>
            <div class="it-sum">${F(sum)}</div>
          </div>
          <div class="it-det">${i.variant || ""} &nbsp;·&nbsp; ${i.qty} ${i.unit || "dona"} × ${F(i.price)} so'm</div>
          ${boxRow}
        </div>
      </div>`;
  }).join('<div class="sep-dash"></div>');

  // ── To'lov bo'limi ────────────────────────────
  const discHtml = discount > 0
    ? `<div class="pr"><span>Chegirma</span><span class="c-red">− ${F(discount)} so'm</span></div>` : "";

  let debtHtml = "";
  if (remaining > 0) {
    if (isUsd && prevUsd > 0) {
      const tot = prevUsd + debtUsd;
      debtHtml = `
        <div class="sep-dash" style="margin:6px 0"></div>
        <div class="pr pr-sm"><span>Xariddan oldingi qarz</span><span>$${prevUsd.toFixed(2)}</span></div>
        <div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>$${debtUsd.toFixed(2)}</span></div>
        <div class="pr pr-debt"><span>Xariddan keyingi qarz</span><span>$${tot.toFixed(2)} USD</span></div>`;
    } else if (!isUsd && prevUzs > 0) {
      const tot = prevUzs + remaining;
      debtHtml = `
        <div class="sep-dash" style="margin:6px 0"></div>
        <div class="pr pr-sm"><span>Xariddan oldingi qarz</span><span>${F(prevUzs)} so'm</span></div>
        <div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>${F(remaining)} so'm</span></div>
        <div class="pr pr-debt"><span>Xariddan keyingi qarz</span><span>${F(prevUzs + remaining)} so'm</span></div>`;
    } else {
      const amt = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${F(remaining)} so'm`;
      debtHtml = `<div class="pr pr-debt"><span>Qarzga</span><span>${amt}</span></div>`;
    }
    if (due) debtHtml += `<div class="pr pr-sm"><span>To'lov muddati</span><span class="c-red">${due}</span></div>`;
  } else {
    debtHtml = `<div class="paid-ok">✓ To'liq to'landi</div>`;
  }

  const botHtml  = botUser    ? `<div class="ft-bot">Cheklarni Telegramda olish: <b>@${botUser}</b></div>` : "";
  const pdfHtml  = receiptUrl ? `<div class="ft-pdf"><a href="${receiptUrl}" target="_blank">📄 Chekni yuklab olishingiz mumkin</a></div>` : "";
  const noteHtml = note       ? `<div class="note-wrap"><span class="note-lbl">Izoh</span><span>${note}</span></div>` : "";

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F2F0EB;display:flex;justify-content:center;padding:20px 8px}
.wrap{width:340px;max-width:100%}
.rc{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(13,27,42,.12)}

/* HEAD */
.hd{background:#0D1B2A;padding:18px 20px 14px;text-align:center;color:#fff}
.hd-logo{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;letter-spacing:1.5px}
.hd-sub{font-size:9.5px;color:#9aa7b5;letter-spacing:2px;text-transform:uppercase;margin-top:3px}

/* META */
.meta{padding:10px 16px;font-size:11.5px;border-bottom:1px dashed #E8E5E0}
.mr{display:flex;justify-content:space-between;padding:2px 0;color:#333}
.mr b{color:#0D1B2A;font-weight:600;text-align:right;max-width:60%}
.sep{border-top:1px solid #ddd;margin:5px 0}

/* NOTE */
.note-wrap{padding:7px 16px;background:#FFFBEB;border-bottom:1px dashed #FDE68A;font-size:11.5px;color:#92400E;display:flex;gap:8px}
.note-lbl{font-weight:700;white-space:nowrap}

/* ITEMS */
.it-lbl{padding:8px 16px 4px;font-size:9.5px;font-weight:700;color:#555;letter-spacing:1.5px;text-transform:uppercase}
.items{padding:0 16px}
.it{display:flex;gap:8px;padding:9px 0;align-items:flex-start}
.it-num{font-size:10px;color:#666;font-weight:700;min-width:13px;padding-top:3px}
.it-body{flex:1;min-width:0}
.it-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.it-name{font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#0D1B2A;flex:1}
.it-sku{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;color:#555;display:block;margin-top:1px}
.it-sum{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#0D1B2A;white-space:nowrap}
.it-det{font-size:11px;color:#555;margin-top:2px}
.it-box{font-size:10.5px;color:#9A6E1A;margin-top:2px;font-weight:600}
.sep-dash{border-top:1px dashed #ccc}

/* JAMI */
.tot{margin:0 16px;padding:9px 0;border-top:2px solid #0D1B2A;border-bottom:1px dashed #ccc;display:flex;justify-content:space-between;align-items:center}
.tot-lbl{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#0D1B2A;letter-spacing:.5px}
.tot-cnt{font-size:9.5px;color:#555;margin-top:2px;font-weight:500}
.tot-val{font-family:'Sora',sans-serif;font-weight:800;font-size:20px;color:#0D1B2A}
.tot-uzs{font-size:12px;font-weight:600}

/* TO'LOV */
.pay{padding:9px 16px 10px;border-bottom:1px dashed #ccc}
.pay-lbl{font-size:9.5px;font-weight:700;color:#555;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.pr{display:flex;justify-content:space-between;font-size:12.5px;color:#333;padding:2.5px 0}
.pr.pr-sm{font-size:11px;color:#555}
.pr.pr-sm span:last-child{color:#555}
.pr.pr-debt{border-top:1px dashed #fca5a5;margin-top:3px;padding-top:5px;font-weight:700;color:#dc2626;font-size:13px}
.c-red{color:#dc2626!important;font-weight:600}
.paid-ok{text-align:center;background:#ECFDF5;color:#059669;font-weight:700;font-size:12px;border-radius:8px;padding:6px;margin-top:4px}

/* FOOTER */
.ft{padding:12px 16px 16px;text-align:center}
.ft-thanks{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#0D1B2A}
.ft-date{font-size:10px;color:#555;margin-top:2px}
.ft-bot{font-size:11px;color:#229ED9;margin-top:8px;line-height:1.4}
.ft-pdf{margin-top:5px}
.ft-pdf a{font-size:11.5px;color:#0D1B2A;font-weight:600;text-decoration:none;background:#F0EDE8;padding:5px 14px;border-radius:20px;display:inline-block}

/* ACTIONS */
.acts{max-width:340px;margin:10px auto 0;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:10px;padding:11px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}
.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #E8E5E0!important}
@media print{
  body{background:#fff;padding:0}
  .wrap,.rc{border-radius:0;box-shadow:none;width:72mm;max-width:72mm}
  .acts{display:none}
  .hd{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pr.pr-debt{color:#000 !important;border-top:1px solid #999}
  .paid-ok{color:#000 !important;background:#eee !important}
  .c-red{color:#000 !important}
}
</style></head><body>
<div class="wrap">
  <div class="rc">

    <div class="hd">
      <div class="hd-logo">${shopName.toUpperCase()}</div>
      <div class="hd-sub">Savdo cheki</div>
    </div>

    <div class="meta">
      <div class="mr"><span>Chek raqami</span><b>${chekNum}</b></div>
      <div class="mr"><span>Sana / Vaqt</span><b>${date} ${time}</b></div>
      ${staffName && staffName !== "—" ? `<div class="mr"><span>Kassir</span><b>${staffName}</b></div>` : ""}
      ${custName ? `<div class="sep"></div>
      <div class="mr"><span>Mijoz</span><b>${custName}</b></div>
      ${custPhone ? `<div class="mr"><span>Telefon</span><b>${custPhone}</b></div>` : ""}` : ""}
    </div>

    ${noteHtml}

    <div class="it-lbl">Mahsulotlar</div>
    <div class="items">
      ${itemsHtml}
    </div>

    <div class="tot">
      <div>
        <div class="tot-lbl">JAMI</div>
        <div class="tot-cnt">${items.length} tur · ${items.reduce((a,i)=>a+(+i.qty||0),0)} dona</div>
      </div>
      <div class="tot-val">${F(total)}<span class="tot-uzs"> so'm</span></div>
    </div>

    <div class="pay">
      <div class="pay-lbl">To'lov</div>
      <div class="pr"><span>To'lov turi</span><b style="color:#0D1B2A">${payLabels[payType]||payType||"—"}</b></div>
      ${payType === "aralash" && payBreakdown ? Object.entries(payBreakdown).map(([m,v]) =>
        `<div class="pr" style="padding-left:10px"><span style="color:#999">${payLabels[m]||m}</span><span style="color:#666">${F(v)} so'm</span></div>`
      ).join("") : ""}
      ${discHtml}
      <div class="pr"><span>To'landi</span><span style="color:#059669;font-weight:700">${F(paid)} so'm</span></div>
      ${debtHtml}
    </div>

    <div class="ft">
      <div class="ft-thanks">Rahmat! Yana kutamiz 🙏</div>
      <div class="ft-date">${shopName} · ${date}</div>
      ${botHtml}
      ${pdfHtml}
    </div>

  </div>
  <div class="acts">
    <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
    <button class="btn-c" onclick="window.close?window.close():history.back()">Yopish</button>
  </div>
</div>
</body></html>`;
}
