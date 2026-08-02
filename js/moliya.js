// MERX moliya.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/moliya.js  (v3 — To'liq qayta yozildi)
// ================================================

let molPeriod = "today"; // v157 (№14): standart Bugun (HTML tugmasi bilan endi MOS — avval nomuvofiq edi!)
let _expType   = "kunlik"; // "kunlik" | "oylik"
let _expForMonth = ""; // "2026-06" kabi
let _expForMonthSel = "cur"; // "prev"|"cur"|"next"
let _expChart = null;

let expDatePeriod = "today"; // v157 (№14): standart Bugun

function setExpDatePeriod(p) {
  expDatePeriod = p;
  const t = today();
  // Segment tugmalar uslubi
  document.querySelectorAll(".exp-date-btn").forEach(b => {
    const on = b.dataset.p === p;
    b.style.background = on ? "#0D1B2A" : "transparent";
    b.style.color      = on ? "#fff"    : "var(--mut)";
  });
  // Kalendar inputlarni period ga qarab to'ldirish
  const fromEl = $("exp-date-from"), toEl = $("exp-date-to");
  if (p === "all") {
    if (fromEl) fromEl.value = ""; if (toEl) toEl.value = "";
  } else if (p === "yesterday") {
    const y = addDays(t,-1);
    if (fromEl) fromEl.value = y; if (toEl) toEl.value = y;
  } else if (p === "today") {
    if (fromEl) fromEl.value = t; if (toEl) toEl.value = t;
  } else if (p === "week") {
    if (fromEl) fromEl.value = addDays(t,-6); if (toEl) toEl.value = t;
  } else if (p === "month") {
    if (fromEl) fromEl.value = t.slice(0,7)+"-01"; if (toEl) toEl.value = t;
  } else if (p === "year") {
    if (fromEl) fromEl.value = t.slice(0,4)+"-01-01"; if (toEl) toEl.value = t;
  } else if (p === "custom") {
    // Kalendardan o'zgartirilganda — tugmalarni bekor qil
    document.querySelectorAll(".exp-date-btn").forEach(b => {
      b.style.background = "transparent"; b.style.color = "var(--mut)";
    });
  }
  renderMoliya();
}

// 2026-07-24 (№14): xarajatlar sahifalanishi (katalogdagidek)
let expPage = 1;
let _lastExpSig = null;
const EXP_PER_PAGE = 50;

const MOL_KPI_LABELS = {
  // Banner (qora fon)
  banner_balans: "🏦 Banner: Kassa balansi",
  banner_kirim:  "📈 Banner: Kassaga tushdi",
  banner_chiqim: "📉 Banner: Xarajatlar",
  // KPI kartalar
  rev:     "Kassaga tushdi (jami)",
  sotuv:   "Sotuv tushumi",
  qarz:    "Qarz tushumi",
  exp:     "Xarajatlar (davr)",
  gross:   "Brutto foyda (nasiya bilan)",
  net:     "Sof foyda",
  supdebt: "Yetkazuvchi qarzi",
  usd:     "USD tushum",
  cnt:     "Xarajatlar soni"
};

// Banner + KPI wrapper map
const MOL_BANNER_MAP = {
  banner_balans: "banner-balans-wrap",
  banner_kirim:  ["banner-kirim-wrap","banner-kirim2-wrap"],
  banner_chiqim: "banner-chiqim-wrap",
};

function hideMolKpi(key) {
  if (!db.settings) db.settings={};
  const h=new Set(db.settings.hiddenMolKpis||[]);
  h.add(key); db.settings.hiddenMolKpis=[...h]; saveDB(); applyMolKpiVisibility();
}
function showMolKpi(key) {
  if (!db.settings) db.settings={};
  const h=new Set(db.settings.hiddenMolKpis||[]);
  h.delete(key); db.settings.hiddenMolKpis=[...h]; saveDB(); applyMolKpiVisibility();
}
function applyMolKpiVisibility() {
  const hidden=new Set(db.settings?.hiddenMolKpis||[]);
  // KPI kartalar
  document.querySelectorAll("#mol-kpi-row .stb").forEach(el=>{
    el.style.display=hidden.has(el.dataset.mkpi)?"none":"block";
  });
  // Banner elementlari
  Object.entries(MOL_BANNER_MAP).forEach(([key, ids]) => {
    const show = !hidden.has(key);
    (Array.isArray(ids)?ids:[ids]).forEach(id => {
      const el=$(id); if(el) el.style.display=show?"":"none";
    });
  });
}
function openMolKpiSettings() {
  const hidden=new Set(db.settings?.hiddenMolKpis||[]);
  const list=$("mol-kpi-settings-list"); if(!list) return;
  // Banner va KPI larni ajratib ko'rsatamiz
  const bannerKeys = ["banner_balans","banner_kirim","banner_chiqim"];
  const kpiKeys    = Object.keys(MOL_KPI_LABELS).filter(k=>!bannerKeys.includes(k));
  list.innerHTML =
    `<div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;
      letter-spacing:.5px;margin-bottom:6px;padding:0 4px">Banner</div>` +
    bannerKeys.map(k=>`
    <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--brd);border-radius:9px;cursor:pointer">
      <input type="checkbox" ${!hidden.has(k)?"checked":""} onchange="this.checked?showMolKpi('${k}'):hideMolKpi('${k}')"
        style="width:17px;height:17px;accent-color:var(--acc);cursor:pointer">
      <span style="font-size:13px;font-weight:600">${MOL_KPI_LABELS[k]}</span>
    </label>`).join("") +
    `<div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;
      letter-spacing:.5px;margin:12px 0 6px;padding:0 4px">KPI kartalar</div>` +
    kpiKeys.map(k=>`
    <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--brd);border-radius:9px;cursor:pointer">
      <input type="checkbox" ${!hidden.has(k)?"checked":""} onchange="this.checked?showMolKpi('${k}'):hideMolKpi('${k}')"
        style="width:17px;height:17px;accent-color:var(--acc);cursor:pointer">
      <span style="font-size:13px;font-weight:600">${MOL_KPI_LABELS[k]}</span>
    </label>`).join("");
  openModal("molkpi");
}

const EXP_COL_DEFS = [
  { key:"date",      lbl:"Sana",          def:true },
  { key:"cat",       lbl:"Kategoriya",    def:true },
  { key:"recipient", lbl:"Kimga/Nima",    def:true },
  { key:"method",    lbl:"To'lov usuli",  def:true },
  { key:"amount",    lbl:"Summa",         def:true },
  { key:"note",      lbl:"Izoh",          def:true },
];

function getExpCols() {
  const saved = db.settings?.expCols || {};
  const cols = {};
  EXP_COL_DEFS.forEach(c => { cols[c.key] = c.key in saved ? saved[c.key] : c.def; });
  return cols;
}

function openExpColsSettings() {
  const cols = getExpCols();
  const list = $("exp-cols-list"); if (!list) return;
  list.innerHTML = EXP_COL_DEFS.map(c => `
    <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--brd);border-radius:9px;cursor:pointer">
      <input type="checkbox" ${cols[c.key]?"checked":""} onchange="toggleExpCol('${c.key}',this.checked)"
        style="width:17px;height:17px;accent-color:var(--acc);cursor:pointer">
      <span style="font-size:13px;font-weight:600">${c.lbl}</span>
    </label>`).join("");
  openModal("expcols");
}

function toggleExpCol(key, val) {
  if (!db.settings) db.settings={};
  if (!db.settings.expCols) db.settings.expCols={};
  db.settings.expCols[key] = val;
  saveDB(); renderMoliya();
}

// EXP_CATS allaqachon db.js da bo'lishi mumkin — xavfsiz e'lon
if (typeof window.EXP_CATS === "undefined") {
  window.EXP_CATS   = ["Ijara","Maosh","Transport","Kommunal","Reklama","Yetkazuvchi","Soliq","Jihozlar","Boshqa"];
  window.EXP_COLORS = ["#E9A500","#4C9BE8","#36B48C","#F59E0B","#EC4899","#8B5CF6","#EF4444","#06B6D4","#94A3B8"];
}
const MOL_CATS   = window.EXP_CATS;
const MOL_COLORS = window.EXP_COLORS;

// ── Davr ─────────────────────────────────────────
function setMolPeriod(p) {
  molPeriod = p;
  if (p !== "custom") {
    const f = $("mol-date-from"), t = $("mol-date-to");
    if (f) f.value = ""; if (t) t.value = "";
  }
  document.querySelectorAll(".mol-period-btn").forEach(b => {
    const on = b.dataset.p === p;
    b.classList.toggle("on", on);
    b.style.background = on ? "#E9A500" : "rgba(255,255,255,.1)";
    b.style.color = on ? "#fff" : "rgba(255,255,255,.7)";
    b.style.borderColor = on ? "#E9A500" : "rgba(255,255,255,.2)";
  });
  renderMoliya();
}

function setMolCustomRange() {
  const from = ($("mol-date-from")||{value:""}).value;
  const to   = ($("mol-date-to")||{value:""}).value;
  if (!from && !to) return;
  molPeriod = "custom";
  document.querySelectorAll(".mol-period-btn").forEach(b => {
    b.classList.remove("on");
    b.style.background = "rgba(255,255,255,.1)";
    b.style.color = "rgba(255,255,255,.7)";
    b.style.borderColor = "rgba(255,255,255,.2)";
  });
  renderMoliya();
}

// ── Xarajatlar RO'YXATI uchun mustaqil davr (2026-07-31) ──────
// Avval ro'yxat yuqoridagi banner davriga (molPeriod) bog'langan edi:
// jadval ustidagi tugma faqat SHU davr ICHIDA ishlardi. Ya'ni banner
// "Bugun" bo'lsa, jadvalda "Yil" bosilsa ham bugundan chiqmasdi.
// Endi ro'yxat o'z filtriga bo'ysunadi, KPI kartalar esa avvalgidek
// banner davriga (o'zgarmadi).
function expDateRange() {
  const t = today();
  if (expDatePeriod === "all")       return { from: "2000-01-01", to: "2100-01-01" };
  if (expDatePeriod === "yesterday") return { from: addDays(t,-1), to: addDays(t,-1) };
  if (expDatePeriod === "today")     return { from: t, to: t };
  if (expDatePeriod === "week")      return { from: addDays(t,-6), to: t };
  if (expDatePeriod === "month")     return { from: t.slice(0,7)+"-01", to: t };
  if (expDatePeriod === "year")      return { from: t.slice(0,4)+"-01-01", to: t };
  if (expDatePeriod === "custom") {
    const f = ($("exp-date-from")||{value:""}).value;
    const o = ($("exp-date-to")  ||{value:""}).value;
    return { from: f || "2000-01-01", to: o || "2100-01-01" };
  }
  return { from: t, to: t };
}

function molDateRange() {
  const t = today();
  if (molPeriod === "yesterday") return { from: addDays(t,-1), to: addDays(t,-1) };
  if (molPeriod === "today")     return { from: t, to: t };
  if (molPeriod === "week")      return { from: addDays(t,-6), to: t };
  if (molPeriod === "month")     return { from: t.slice(0,7)+"-01", to: t };
  if (molPeriod === "year")      return { from: t.slice(0,4)+"-01-01", to: t };
  if (molPeriod === "custom") {
    const from = ($("mol-date-from")||{value:""}).value;
    const to   = ($("mol-date-to")||{value:""}).value;
    return { from: from||t, to: to||t };
  }
  return { from: t, to: t };
}

// ── Asosiy render ─────────────────────────────────

// Kategoriya filter options ni xarajat turiga qarab yangilash
function _updateCatFilterOptions(typeFilter) {
  const sel = $("exp-cat-filter"); if (!sel) return;
  const curVal = sel.value;
  
  // Qaysi teglar ko'rsatilsin
  let tags = [];
  if (typeFilter === "kunlik") {
    tags = getExpTags("kunlik");
  } else if (typeFilter === "oylik") {
    tags = getExpTags("oylik");
  } else {
    // Barcha teglar
    tags = [...getExpTags("kunlik"), ...getExpTags("oylik")];
    // Dublikatlarni olib tashlaymiz
    tags = [...new Set(tags)];
  }

  sel.innerHTML = '<option value="">📂 Barcha kategoriyalar</option>' +
    tags.map(t => `<option value="${t}" ${t===curVal?"selected":""}>${t}</option>`).join("");
}

function renderMoliya() {
  const { from, to } = molDateRange();
  const rate = db.settings?.rate || 12800;
  const q = ($("exp-q")||{value:""}).value.toLowerCase();

  const periodSales = statSales().filter(s => s.date >= from && s.date <= to);
  const periodExps  = (db.xarajatlar||[]).filter(x => x.date >= from && x.date <= to);

  // 2: payBreakdown orqali aralash tolov togri hisoblanadi
  let naqd = 0, karta = 0, otkazma = 0;
  periodSales.forEach(s => {
    const pb = s.payBreakdown;
    if (pb && (pb.naqd || pb.karta || pb.otkazma)) {
      naqd    += (pb.naqd    || 0);
      karta   += (pb.karta   || 0);
      otkazma += (pb.otkazma || 0);
    } else {
      const paid = s.payType === "nasiya" ? 0 : (s.paid || 0);
      if      (s.payType === "karta")   karta   += paid;
      else if (s.payType === "otkazma") otkazma += paid;
      else                              naqd    += paid;
    }
  });

  // 3: Qarz tushumi - db.debtPayments dan
  const periodDebtPays = cashPays().filter(p => p.date >= from && p.date <= to);
  let debtNaqd = 0, debtKarta = 0, debtOtkazma = 0, debtBalans = 0;
  let usdQarzTushum = 0; // USD qarz to'lovlari (dollar hisobida)
  periodDebtPays.forEach(p => {
    // v158 (audit): ARALASH endi usullarga bo'linadi (avval butun summa
    // NAQDGA yozilardi — karta qismi ham!). amountSom — aniq so'm.
    const amt = (p.amountSom || (p.currency === "usd" ? Math.round((p.amount||0) * rate) : (p.amount || 0)));
    if (p.currency === "usd") usdQarzTushum += p.amount;
    const mb = p.methodBreakdown;
    const mbHas = mb && Object.keys(mb).some(k => (mb[k]||0) > 0);
    if (mbHas) {
      debtNaqd    += (mb.naqd    || 0);
      debtKarta   += (mb.karta   || 0);
      debtOtkazma += (mb.otkazma || 0);
      debtBalans  += (mb.balans  || 0);
    }
    else if (p.method === "karta")   debtKarta   += amt;
    else if (p.method === "otkazma") debtOtkazma += amt;
    else if (p.method === "balans")  debtBalans  += amt;
    else                             debtNaqd    += amt;
  });

  // 5: USD sotuv tushumi (dollar hisobida, alohida ko'rsatish uchun)
  let usdSotuvSom = 0, usdSotuvDollar = 0;
  periodSales.forEach(s => {
    if (s.debtCurrency === "usd" || s.payType === "usd") {
      // USD qilib sotilgan tovar
      const origUsd = s.origDebtUsd || s.debtUsd || 0;
      const paidUsd = origUsd > 0 && s.total > 0 ? (s.paid/s.total)*origUsd : 0;
      usdSotuvDollar += paidUsd;
      usdSotuvSom += Math.round(paidUsd * rate);
    }
  });
  const totalUsdDollar = usdSotuvDollar + usdQarzTushum;
  if ($("mol-usd-tushum")) {
    $("mol-usd-tushum").textContent = totalUsdDollar > 0
      ? `${fmtUsd(totalUsdDollar)} (${fmt(Math.round(totalUsdDollar*rate))} so'm)`
      : "—";
  }

  const sotuvTushum = naqd + karta + otkazma;
  const qarzTushum  = debtNaqd + debtKarta + debtOtkazma + debtBalans;
  const sotuv       = sotuvTushum + qarzTushum;
  const chiqim      = periodExps.reduce((a, x) => a + (x.amount||0), 0);

  // Tannarx va foyda — hisobot bilan bir xil mantiq
  // grossProfit = barcha sotuv (nasiya ham) − tannarx (to'g'ri iqtisodiy ko'rsatkich)
  // realProfit  = kassaga tushgan foyda (checkout to'lovi + qarz to'lovidan ulush)
  let periodCost = 0, grossProfit = 0, realProfit = 0;
  periodSales.forEach(s => {
    let saleCost = 0;
    (s.items||[]).forEach(i => {
      const p = (db.products||[]).find(x => x.name === i.name);
      if (p) saleCost += getCostUzs(p) * (i.qty||0);
    });
    periodCost  += saleCost;
    grossProfit += (s.total||0) - saleCost;
    // Checkout paytida to'langan qism foydasi
    const sPaid = (() => {
      const pb = s.payBreakdown;
      if (pb && (pb.naqd||pb.karta||pb.otkazma)) return (pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
      return s.payType==="nasiya" ? 0 : (s.paid||0);
    })();
    const paidRatio = s.total>0 ? sPaid/s.total : 0;
    realProfit += ((s.total||0) - saleCost) * paidRatio;
  });
  // Qarz to'lovlaridan kelgan foyda ulushi (tannarx allaqachon checkout da hisoblangan)
  const grossMargin = grossProfit / (periodSales.reduce((a,s)=>a+(s.total||0),0)||1);
  realProfit += qarzTushum * grossMargin;
  realProfit = Math.round(realProfit);
  grossProfit = Math.round(grossProfit);

  const netProfit = realProfit - chiqim;

  // Yetkazuvchi qarzi
  const supDebt = (db.ombor||[]).filter(o=>o.payStatus==="qarz")
    .reduce((a,o)=>a+(o.kirimNarxi||0)*(o.qty||0),0);

  // Kassa balansi — barcha vaqt
  const allSotuvPaid = statSales().reduce((a, s) => {
    const pb = s.payBreakdown;
    if (pb && (pb.naqd||pb.karta||pb.otkazma))
      return a + (pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
    return a + (s.payType==="nasiya"?0:(s.paid||0));
  }, 0);
  const allDebtPaid = activePays().reduce((a,p) =>
    a + (p.currency==="usd"?Math.round(p.amount*rate):(p.amount||0)), 0);
  const allExp  = (db.xarajatlar||[]).reduce((a,x)=>a+(x.amount||0),0);
  const balans  = allSotuvPaid + allDebtPaid - allExp;

  // KPI
  if ($("mol-balans"))       $("mol-balans").textContent       = fmtK(balans)+" so'm";
  if ($("mol-kirim"))        $("mol-kirim").textContent        = fmtK(sotuv)+" so'm";
  if ($("mol-chiqim"))       $("mol-chiqim").textContent       = fmtK(chiqim)+" so'm";
  if ($("mol-month-rev"))    $("mol-month-rev").textContent    = fmtK(sotuv)+" so'm";
  if ($("mol-month-exp"))    $("mol-month-exp").textContent    = fmtK(chiqim)+" so'm";
  if ($("mol-exp-cnt"))      $("mol-exp-cnt").textContent      = periodExps.length+" ta";
  if ($("mol-sup-debt"))     $("mol-sup-debt").textContent     = fmt(supDebt)+" so'm";
  if ($("mol-sotuv-tushum")) $("mol-sotuv-tushum").textContent = fmt(sotuvTushum)+" so'm";
  if ($("mol-qarz-tushum"))  $("mol-qarz-tushum").textContent  = fmt(qarzTushum)+" so'm";
  if ($("mol-gross")) {
    $("mol-gross").textContent = fmt(grossProfit)+" so'm";
    $("mol-gross").style.color = grossProfit>=0?"var(--grn)":"var(--red)";
  }
  const profitEl = $("mol-profit");
  if (profitEl) {
    profitEl.textContent = (netProfit<0?"−":"+")+fmt(Math.abs(netProfit))+" so'm";
    profitEl.style.color = netProfit>=0?"var(--grn)":"var(--red)";
  }

  renderSupDebtList();
  renderKassaBalances();
  renderKirimManbalar(naqd+debtNaqd, karta+debtKarta, otkazma+debtOtkazma, debtBalans, sotuv);

  const catTotals = {};
  periodExps.forEach(x => { const c=x.category||"Boshqa"; catTotals[c]=(catTotals[c]||0)+(x.amount||0); });

  // 2026-07-31: ro'yxat endi O'Z davridan oladi (periodExps emas).
  // KPI kartalar yuqorida periodExps bilan ishlashda davom etadi.
  const _er = expDateRange();
  let exps = (db.xarajatlar||[])
    .filter(x => (x.date||"") >= _er.from && (x.date||"") <= _er.to)
    .sort((a,b)=>{
    if ((b.date||"") !== (a.date||"")) return ((b.date||"") > (a.date||"")) ? 1 : -1;
    return (b.id||0) - (a.id||0); // v156 (№13): kun ichida ham yangi tepada
  });
  // Tekst qidiruv
  // 2026-08-02: ko'p parametrli qidiruv (utils.js → srchMatcher)
  if (q) {
    const _m = srchMatcher(q);
    exps = exps.filter(x => _m(x.category, x.subCategory, x.note, x.recipient, x.paidBy));
  }
  // Xarajat turi filtri (kunlik/oylik)
  const typeFilter = ($("exp-type-filter")||{value:""}).value;
  if (typeFilter) exps = exps.filter(x => (x.xarajatType || "kunlik") === typeFilter);
  // Kategoriya filter options ni yangilaymiz (tanga qarab)
  _updateCatFilterOptions(typeFilter);
  // Kategoriya filtri (select)
  const catFilter = ($("exp-cat-filter")||{value:""}).value;
  if (catFilter) exps = exps.filter(x => (x.category||"") === catFilter);
  // To'lov usuli filtri
  const methodFilter = ($("exp-method-filter")||{value:""}).value;
  if (methodFilter) exps = exps.filter(x => (x.method||"naqd") === methodFilter);
  // 2026-07-31: sana oralig'i endi yuqorida expDateRange() orqali
  // qo'llanadi (kalendar "custom" holatida o'sha yerda o'qiladi).

  const cols = getExpCols();
  const colCount = Object.values(cols).filter(Boolean).length + 1; // +1 amallar ustuni

  const thead = $("exp-thead");
  if (thead) {
    thead.innerHTML =
      (cols.date      ? "<th>Sana</th>"               : "") +
      (cols.cat       ? "<th>Kategoriya</th>"          : "") +
      (cols.recipient ? "<th>Kimga / Nima uchun</th>" : "") +
      (cols.method    ? "<th>Usul</th>"                : "") +
      (cols.amount    ? '<th class="num">Summa</th>'   : "") +
      (cols.note      ? "<th>Izoh</th>"                : "") +
      '<th style="width:72px"></th>';
  }

  // 2026-07-24 (№14): filtr/qidiruv o'zgarsa — birinchi sahifaga qaytamiz
  const _expSig = [q, typeFilter, catFilter, from, to].join("|");
  if (_expSig !== _lastExpSig) { expPage = 1; _lastExpSig = _expSig; }

  // Sahifalash — faqat joriy sahifa qatorlari chiziladi
  const expTotalPages = Math.ceil(exps.length / EXP_PER_PAGE) || 1;
  if (expPage > expTotalPages) expPage = 1;
  // 2026-08-02: EKSPORT uchun yakuniy ro'yxat (sahifalashdan OLDIN)
  try { setExportList("moliya", exps); } catch(e) {}
  const expPageRows = exps.slice((expPage-1)*EXP_PER_PAGE, expPage*EXP_PER_PAGE);
  renderExpPagination(expTotalPages, exps.length);

  const tbody = $("exp-body");
  if (tbody) {
    tbody.innerHTML = expPageRows.length ? expPageRows.map(x => {
      const catIdx = MOL_CATS.indexOf(x.category);
      const color  = MOL_COLORS[catIdx>=0?catIdx:MOL_COLORS.length-1];
      const icon   = ["🏠","👤","🚗","💡","📢","📦","🏛️","🔧","📋"][catIdx>=0?catIdx:8];
      const methodIcon = x.method==="karta"?"💳 Karta":x.method==="otkazma"?"🏦 O'tkazma":"💵 Naqd";
      return `<tr>
        ${cols.date      ? `<td style="font-size:12.5px;white-space:nowrap;font-weight:600">${x.date||"—"}</td>` : ""}
        ${cols.cat ? `<td>
          <span class="bg" style="font-size:12px;background:${color}18;color:${color}">${icon} ${x.category||"—"}</span>
          ${x.subCategory?`<span style="font-size:11px;color:#6B7280;margin-left:4px">→ ${x.subCategory}</span>`:""}
          ${x.xarajatType==="oylik"?`<span style="font-size:10px;color:#8B5CF6;background:#EEF2FF;padding:2px 6px;border-radius:10px;margin-left:4px;font-weight:700">oylik</span>`:""}
          ${x.forMonth?`<div style="font-size:11px;color:#9CA3AF;margin-top:2px">${x.forMonth} oy uchun</div>`:""}
        </td>` : ""}
        ${cols.recipient ? `<td style="font-size:12px;color:#666">${x.recipient?`<div style="font-weight:600">${x.recipient}</div>`:""}${x.paidBy?`<div style="font-size:11px;color:#aaa">To'ladi: ${x.paidBy}</div>`:""}</td>` : ""}
        ${cols.method    ? `<td style="font-size:11.5px;color:var(--mut);white-space:nowrap">${methodIcon}</td>` : ""}
        ${cols.amount    ? `<td class="num" style="font-weight:800;color:var(--red);font-size:13px;white-space:nowrap">${fmt(x.amount||0)} so'm${x.amountUsd?`<div style="font-size:10.5px;color:#aaa;font-weight:400">${fmtUsd(x.amountUsd)}</div>`:""}</td>` : ""}
        ${cols.note      ? `<td style="font-size:12px;color:#aaa;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.note||""}</td>` : ""}
        <td style="white-space:nowrap">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="editExp(${x.id})" title="Tahrirlash"><i class="ti ti-pencil"></i></button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteExp(${x.id})" style="color:var(--red)" title="O'chirish"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="${colCount}" class="empty-td">${q?`"${q}" topilmadi`:"Bu davrda xarajat yo'q"}</td></tr>`;
  }

  renderExpChart(catTotals, chiqim, periodExps);
  renderFlowBars(sotuv, chiqim, realProfit, netProfit, periodCost);
  renderMolTrendChart();
  applyMolKpiVisibility();
}

// ── Donut chart ───────────────────────────────────
function renderExpChart(catTotals, total, exps) {
  const canvas = document.getElementById("expChart");
  if (!canvas) return;
  if (_expChart) { _expChart.destroy(); _expChart = null; }

  const legend = $("exp-legend");
  if (!total || total === 0) {
    if (legend) legend.innerHTML = `<span style="color:#ccc;font-size:12px">Xarajat yo'q</span>`;
    // To'lov usuli blokini ham tozalaymiz
    const mel = $("exp-method-breakdown"); if (mel) mel.innerHTML = "";
    return;
  }

  const entries  = Object.entries(catTotals).filter(([,v]) => v > 0);
  const labels   = entries.map(([k]) => k);
  const data     = entries.map(([,v]) => v);
  const bgColors = labels.map(l => {
    const i = MOL_CATS.indexOf(l);
    return MOL_COLORS[i >= 0 ? i : MOL_COLORS.length-1];
  });

  _expChart = new Chart(canvas, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 2, borderColor:"#fff" }] },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)} so'm (${Math.round(ctx.raw/total*100)}%)` } }
      },
      cutout: "62%"
    }
  });

  if (legend) {
    legend.innerHTML = entries.map(([cat, val]) => {
      const i = MOL_CATS.indexOf(cat);
      const clr = MOL_COLORS[i >= 0 ? i : MOL_COLORS.length-1];
      return `<div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
        <div style="width:9px;height:9px;border-radius:3px;background:${clr}"></div>
        <span style="color:#666;font-size:12px">${cat}</span>
        <span style="font-weight:700;font-size:11.5px">${fmt(val)} so'm</span>
        <span style="color:#bbb;font-size:11px">(${Math.round(val/total*100)}%)</span>
      </div>`;
    }).join("");
  }

  // To'lov usuli bo'yicha taqsimot
  const mel = $("exp-method-breakdown"); if (!mel || !exps) return;
  const byMethod = { naqd:0, karta:0, otkazma:0 };
  (exps||[]).forEach(x => {
    const m = x.method||"naqd";
    byMethod[m] = (byMethod[m]||0) + (x.amount||0);
  });
  const mLabels = { naqd:"💵 Naqd", karta:"💳 Karta", otkazma:"🏦 O'tkazma" };
  const mColors = { naqd:"#36B48C", karta:"#4C9BE8", otkazma:"#8B5CF6" };
  mel.innerHTML = Object.entries(byMethod).filter(([,v])=>v>0)
    .sort((a,b)=>b[1]-a[1])
    .map(([m,v])=>`
      <div style="margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span style="font-weight:600;color:${mColors[m]}">${mLabels[m]}</span>
          <span style="font-weight:700">${fmt(v)} so'm
            <span style="color:#bbb;font-weight:400">(${Math.round(v/total*100)}%)</span>
          </span>
        </div>
        <div style="height:6px;background:#f0ede7;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${Math.round(v/total*100)}%;background:${mColors[m]};border-radius:3px"></div>
        </div>
      </div>`).join("") || `<span style="font-size:12px;color:#bbb">Ma'lumot yo'q</span>`;
}

// ── Kirim/Chiqim bars ─────────────────────────────
function renderFlowBars(kirim, chiqim, realProfit, netProfit, periodCost) {
  const el = $("mol-flow-bars"); if (!el) return;

  // O'tgan davr bilan taqqos
  const { from, to } = molDateRange();
  const rate = db.settings?.rate || 12800;
  const daysDiff = Math.max(1, Math.round((new Date(to)-new Date(from))/86400000)+1);
  const prevTo   = new Date(from); prevTo.setDate(prevTo.getDate()-1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate()-daysDiff+1);
  const pf = prevFrom.toISOString().slice(0,10);
  const pt = prevTo.toISOString().slice(0,10);

  let prevKirim = 0;
  statSales().filter(s=>s.date>=pf&&s.date<=pt).forEach(s=>{
    const pb=s.payBreakdown;
    if(pb&&(pb.naqd||pb.karta||pb.otkazma)) prevKirim+=(pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
    else prevKirim+=s.payType==="nasiya"?0:(s.paid||0);
  });
  prevKirim += cashPays().filter(p=>p.date>=pf&&p.date<=pt)
    .reduce((a,p)=>a+(p.currency==="usd"?Math.round(p.amount*rate):(p.amount||0)),0);
  const prevChiqim = (db.xarajatlar||[]).filter(x=>x.date>=pf&&x.date<=pt)
    .reduce((a,x)=>a+(x.amount||0),0);

  const kirimChange  = prevKirim>0  ? Math.round((kirim-prevKirim)/prevKirim*100)   : null;
  const chiqimChange = prevChiqim>0 ? Math.round((chiqim-prevChiqim)/prevChiqim*100) : null;

  const badge = v => v===null ? "" :
    `<span style="font-size:11px;padding:2px 7px;border-radius:5px;font-weight:700;margin-left:5px;
      background:${v>=0?"#DCFCE7":"#FEE2E2"};color:${v>=0?"var(--grn)":"var(--red)"}">
      ${v>=0?"+":""}${v}%</span>`;

  const bar = (val, max, color) =>
    `<div style="height:10px;background:#f0ede7;border-radius:5px;overflow:hidden;margin-top:5px">
      <div style="height:100%;width:${Math.min(100,Math.round(val/Math.max(max,1)*100))}%;
        background:${color};border-radius:5px;transition:.4s"></div></div>`;

  const maxVal = Math.max(kirim, periodCost, chiqim, 1);

  el.innerHTML = `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px">
        <span style="color:var(--grn);font-weight:700">📈 Kassaga tushdi${badge(kirimChange)}</span>
        <span style="font-weight:800">${fmtK(kirim)} so'm</span>
      </div>
      ${bar(kirim, maxVal, "var(--grn)")}
    </div>
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px">
        <span style="color:#8B5CF6;font-weight:700">📦 Tovar tannarxi
          <span style="font-size:11px;color:#bbb;font-weight:400"> — kirimning ${kirim>0?Math.round(periodCost/kirim*100):0}%</span>
        </span>
        <span style="font-weight:800">${fmtK(periodCost)} so'm</span>
      </div>
      ${bar(periodCost, maxVal, "#8B5CF6")}
    </div>
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px">
        <span style="color:var(--red);font-weight:700">📉 Xarajatlar${badge(chiqimChange)}
          <span style="font-size:11px;color:#bbb;font-weight:400"> — kirimning ${kirim>0?Math.round(chiqim/kirim*100):0}%</span>
        </span>
        <span style="font-weight:800">${fmtK(chiqim)} so'm</span>
      </div>
      ${bar(chiqim, maxVal, "var(--red)")}
    </div>
    <div style="display:flex;gap:8px">
      <div style="flex:1;padding:12px 14px;border-radius:10px;
        background:${realProfit>=0?"#F3F0FF":"#FEF2F2"};
        border:1.5px solid ${realProfit>=0?"#C4B5FD":"#FECACA"}">
        <div style="font-size:11px;color:#8B5CF6;font-weight:700;margin-bottom:3px">Kassaga tushgan foyda
          <span style="font-weight:400;color:#aaa"> (tannarx ayirilgan)</span>
        </div>
        <div style="font-size:15px;font-weight:900;color:#8B5CF6">
          ${realProfit>=0?"+":"−"}${fmtK(Math.abs(realProfit))} so'm
        </div>
      </div>
      <div style="flex:1;padding:12px 14px;border-radius:10px;
        background:${netProfit>=0?"#F0FDF4":"#FEF2F2"};
        border:1.5px solid ${netProfit>=0?"#BBF7D0":"#FECACA"}">
        <div style="font-size:11px;color:${netProfit>=0?"var(--grn)":"var(--red)"};font-weight:700;margin-bottom:3px">
          ${netProfit>=0?"✅":"⚠️"} Sof foyda
          <span style="font-weight:400;color:#aaa"> (xarajat ham ayirilgan)</span>
        </div>
        <div style="font-size:15px;font-weight:900;color:${netProfit>=0?"var(--grn)":"var(--red)"}">
          ${netProfit>=0?"+":"−"}${fmtK(Math.abs(netProfit))} so'm
        </div>
      </div>
    </div>`;
}

// ── Kirim manbalar ────────────────────────────────
function renderKirimManbalar(naqd, karta, otkazma, balans, total) {
  const el = $("mol-kirim-manbalar"); if (!el || !total) return;
  const items = [
    { lbl:"💵 Naqd",          val:naqd,    color:"#36B48C" },
    { lbl:"💳 Karta",         val:karta,   color:"#4C9BE8" },
    { lbl:"🏦 O'tkazma",      val:otkazma, color:"#8B5CF6" },
    { lbl:"💰 Balansdan",     val:balans,  color:"#E9A500" },
  ].filter(i => i.val > 0);

  el.innerHTML = items.map(i => `
    <div style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="color:${i.color};font-weight:600">${i.lbl}</span>
        <span style="font-weight:700">${fmt(i.val)} so'm
          <span style="color:#bbb;font-size:10.5px">(${Math.round(i.val/total*100)}%)</span>
        </span>
      </div>
      <div style="height:6px;background:#f0ede7;border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.round(i.val/total*100)}%;background:${i.color};border-radius:3px"></div>
      </div>
    </div>`).join("") || `<span style="color:var(--mut);font-size:12px">Ma'lumot yo'q</span>`;
}

// ── Moliyaviy trend grafigi (6 oy kirim/chiqim) ──
let _molTrendChart = null;
let molTrendPeriod = "6month"; // "week"|"month"|"6month"|"year"

function setMolTrendPeriod(p) {
  molTrendPeriod = p;
  document.querySelectorAll(".mol-trend-btn").forEach(b => {
    const on = b.dataset.p === p;
    b.style.background = on ? "#0D1B2A" : "transparent";
    b.style.color      = on ? "#fff" : "var(--mut)";
    b.style.borderColor= on ? "#0D1B2A" : "var(--brd)";
  });
  renderMolTrendChart();
}

function renderMolTrendChart() {
  const el = $("mol-trend-chart"); if (!el || typeof Chart === "undefined") return;
  if (_molTrendChart) { _molTrendChart.destroy(); _molTrendChart = null; }

  const rate = db.settings?.rate || 12800;
  const now  = new Date();
  const t    = now.toISOString().slice(0,10);

  let points = []; // [{label, from, to}]

  if (molTrendPeriod === "week") {
    // So'nggi 7 kun — kunlik
    for (let i = 6; i >= 0; i--) {
      const d  = new Date(now); d.setDate(d.getDate()-i);
      const ds = d.toISOString().slice(0,10);
      const dd = d.getDate(), mo = d.getMonth();
      const names = ["Yan","Fev","Mar","Apr","May","Iyun","Iyul","Avg","Sen","Okt","Noy","Dek"];
      points.push({ label: `${dd} ${names[mo]}`, from: ds, to: ds });
    }
  } else if (molTrendPeriod === "month") {
    // So'nggi 30 kun — kunlik (har 2 kunda bitta label)
    for (let i = 29; i >= 0; i--) {
      const d  = new Date(now); d.setDate(d.getDate()-i);
      const ds = d.toISOString().slice(0,10);
      const dd = d.getDate();
      const names = ["Yan","Fev","Mar","Apr","May","Iyun","Iyul","Avg","Sen","Okt","Noy","Dek"];
      points.push({ label: i%3===0 ? `${dd} ${names[d.getMonth()]}` : "", from: ds, to: ds });
    }
  } else if (molTrendPeriod === "6month") {
    // So'nggi 6 oy — oylik
    for (let i = 5; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const m  = d.toISOString().slice(0,7);
      const [y,mo] = m.split("-");
      const names  = ["Yan","Fev","Mar","Apr","May","Iyun","Iyul","Avg","Sen","Okt","Noy","Dek"];
      const lastDay = new Date(+y, +mo, 0).getDate();
      points.push({ label: names[+mo-1]+" "+y.slice(2), from: m+"-01", to: m+"-"+String(lastDay).padStart(2,"0") });
    }
  } else { // year
    // So'nggi 12 oy — oylik
    for (let i = 11; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const m  = d.toISOString().slice(0,7);
      const [y,mo] = m.split("-");
      const names  = ["Yan","Fev","Mar","Apr","May","Iyun","Iyul","Avg","Sen","Okt","Noy","Dek"];
      const lastDay = new Date(+y, +mo, 0).getDate();
      points.push({ label: names[+mo-1]+" "+y.slice(2), from: m+"-01", to: m+"-"+String(lastDay).padStart(2,"0") });
    }
  }

  const calcKirim = ({from,to}) => {
    let sotuv=0, jami=0;
    statSales().filter(s=>s.date>=from&&s.date<=to).forEach(s=>{
      const pb=s.payBreakdown;
      if(pb&&(pb.naqd||pb.karta||pb.otkazma)) sotuv+=(pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
      else sotuv+=(s.paid||0);
      jami+=(s.total||0);
    });
    const qarz=cashPays().filter(p=>p.date>=from&&p.date<=to)
      .reduce((a,p)=>a+(p.currency==="usd"?Math.round(p.amount*rate):(p.amount||0)),0);
    return { kassa:Math.round((sotuv+qarz)/1000000*10)/10, jami:Math.round(jami/1000000*10)/10 };
  };

  const calcChiqim = ({from,to}) =>
    Math.round((db.xarajatlar||[]).filter(x=>x.date>=from&&x.date<=to)
      .reduce((a,x)=>a+(x.amount||0),0)/1000000*10)/10;

  const labels     = points.map(p=>p.label);
  const kirimData  = points.map(calcKirim);
  const chiqimData = points.map(calcChiqim);
  const jamiData   = kirimData.map(d=>d.jami);
  const kassaData  = kirimData.map(d=>d.kassa);
  const foydaData  = kassaData.map((k,i)=>Math.round((k-chiqimData[i])*10)/10);

  _molTrendChart = new Chart(el, {
    type:"bar",
    data:{
      labels,
      datasets:[
        { label:"Jami sotuv",    data:jamiData,   backgroundColor:"#4C9BE840", borderColor:"#4C9BE8", borderWidth:1.5, borderRadius:3 },
        { label:"Kassaga tushdi",data:kassaData,  backgroundColor:"#36B48C80", borderColor:"#36B48C", borderWidth:1.5, borderRadius:3 },
        { label:"Xarajatlar",    data:chiqimData, backgroundColor:"#E05A5A80", borderColor:"#E05A5A", borderWidth:1.5, borderRadius:3 },
        { label:"Sof foyda", data:foydaData, type:"line", borderColor:"#E9A500",
          backgroundColor:"transparent", borderWidth:2, pointRadius:3, pointBackgroundColor:"#E9A500" }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:"top",labels:{font:{size:11},boxWidth:12}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.parsed.y} mln so'm`}}
      },
      scales:{
        y:{beginAtZero:true, ticks:{callback:v=>v+" mln"}, grid:{color:"#F0EEE8"}},
        x:{grid:{display:false}, ticks:{maxRotation:0, autoSkip:true, maxTicksLimit:12}}
      }
    }
  });
}

// ── Kategoriya tanlaganda qo'shimcha maydon ───────
function expCatPick(el) {
  document.querySelectorAll(".mcat").forEach(b => b.classList.remove("on"));
  el.classList.add("on");
  const cat = el.dataset.c;
  if (cat === "__custom__") {
    // Custom kategoriya inputini ko'rsatish
    const wrap = $("ax-extra-wrap");
    if (wrap) wrap.innerHTML = `
      <div class="fld">
        <label>Yangi kategoriya nomi</label>
        <input id="ax-custom-cat" placeholder="Kategoriya nomini kiriting..."
          style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%"
          oninput="if(this.value.trim()){$('exp-cat-val').value=this.value.trim()}">
      </div>`;
    if ($("exp-cat-val")) $("exp-cat-val").value = "";
    return;
  }
  if ($("exp-cat-val")) $("exp-cat-val").value = cat;
  renderExpExtraField(cat);
  renderExpSubCats(_expType, cat);
  // Sub-cat reset
  const scv = document.getElementById("exp-subcat-val");
  if (scv) scv.value = "";
  // Maosh + oylik bo'lsa oy tanlash ko'rsatish
  const fmw = document.getElementById("ax-formonth-wrap");
  if (fmw) fmw.style.display = (_expType==="oylik" && cat==="Maosh") ? "block" : "none";
}

function renderExpExtraField(cat) {
  const wrap = $("ax-extra-wrap"); if (!wrap) return;

  if (cat === "Ijara") {
    wrap.innerHTML = `
      <div class="fld">
        <label>Uy egasi / Ijara beruvchi <span style="font-size:11px;color:var(--mut)">(ixtiyoriy)</span></label>
        <input id="ax-recipient" placeholder="Masalan: Abdullayev Jasur..." style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%">
      </div>`;
  } else if (cat === "Maosh") {
    // Xodim tanlash
    const staffOpts = (db.staff||[]).map(s =>
      `<option value="${s.name}">${s.name} (${s.role||"xodim"})</option>`
    ).join("");
    wrap.innerHTML = `
      <div class="fld">
        <label>Kimga maosh <span style="font-size:11px;color:var(--mut)">(xodim)</span></label>
        <select id="ax-recipient" style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%;background:#fff">
          <option value="">— Xodimni tanlang —</option>
          ${staffOpts}
        </select>
      </div>`;

  } else if (cat === "Yetkazuvchi") {
    // Yetkazuvchi tanlash
    const sups = [...new Set((db.ombor||[]).map(o => o.supplier).filter(Boolean))];
    const supOpts = sups.map(s => `<option value="${s}">${s}</option>`).join("");
    wrap.innerHTML = `
      <div class="fld">
        <label>Qaysi yetkazuvchiga <span style="font-size:11px;color:var(--mut)">(qarz to'lash)</span></label>
        <select id="ax-recipient" style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%;background:#fff">
          <option value="">— Yetkazuvchini tanlang —</option>
          ${supOpts}
          <option value="__manual__">Qo'lda kiriting...</option>
        </select>
        <input id="ax-recipient-manual" placeholder="Yetkazuvchi nomi..." style="display:none;margin-top:6px;font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%"
          oninput="">
      </div>`;
    // Manual input toggle
    setTimeout(() => {
      const sel = $("ax-recipient");
      if (sel) sel.onchange = () => {
        const m = $("ax-recipient-manual");
        if (m) m.style.display = sel.value === "__manual__" ? "block" : "none";
      };
    }, 50);

  } else if (cat === "Transport") {
    wrap.innerHTML = `
      <div class="fld">
        <label>Transport turi / manzil <span style="font-size:11px;color:var(--mut)">(ixtiyoriy)</span></label>
        <input id="ax-recipient" placeholder="Masalan: Yetkazma, Benzin, Toshkent..." style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%">
      </div>`;
  } else {
    wrap.innerHTML = "";
    // ax-recipient ni tozalaymiz
    setTimeout(() => { if ($("ax-recipient")) $("ax-recipient").value = ""; }, 50);
  }
}

// ── "Kim to'ladi" selectni to'ldirish ─────────────
function initExpWhoSelect() {
  const sel = $("ax-who"); if (!sel) return;
  // 2026-08-02: xodim kirgan bo'lsa — o'zi tanlangan va o'zgartirib
  // bo'lmaydi. Egasi uchun ro'yxat avvalgidek ochiq.
  const _lockTo = (() => {
    try {
      const u = typeof getAuthUser === "function" ? getAuthUser() : null;
      if (u && u.staffId) {
        const me = (db.staff||[]).find(x => x.id === u.staffId);
        return me && me.name ? me.name : null;
      }
    } catch(e) {}
    return null;
  })();
  sel.innerHTML = '<option value="">— Tanlang —</option>' +
    (db.staff||[]).map(s => `<option value="${s.name}">${s.name}</option>`).join("") +
    '<option value="Ega">' + ((db.settings?.ownerName || "").trim()
       ? db.settings.ownerName.trim() + " (admin)" : "Do\'kon egasi") + '</option>';
  // ⚠️ 2026-08-02: EGASI HAM QOTIRILADI.
  // Avval faqat xodim bloklanardi, egasi esa xohlagan kishini
  // tanlashi mumkin edi — xarajat boshqa odam nomiga yozilardi.
  // Endi kim kirgan bo'lsa, o'sha yoziladi.
  if (_lockTo) { sel.value = _lockTo; sel.disabled = true; sel.title = "Kirgan xodim"; }
  else {
    const u = (typeof getAuthUser === "function") ? getAuthUser() : null;
    if (u) { sel.value = "Ega"; sel.disabled = true; sel.title = "Do'kon egasi"; }
    else sel.disabled = false;
  }
  // 2026-07-24 (№15): kirgan foydalanuvchi profilidan AVTOMAT tanlanadi.
  // Tahrirlashda bu qiymat keyinroq (setTimeout) o'z qiymati bilan almashadi.
  const def = _expDefaultWho();
  if (def) sel.value = def;
}

// Kirgan foydalanuvchiga mos "Kim to'ladi" qiymati
function _expDefaultWho() {
  const u = (typeof getAuthUser === "function") ? getAuthUser() : null;
  if (!u) return "";
  // Xodim sifatida kirgan bo'lsa — ro'yxatda bor ismini tanlaymiz
  if (u.name && (db.staff||[]).some(s => s.name === u.name)) return u.name;
  // Admin / do'kon egasi
  if (u.role === "admin" || u.role === "superadmin" || u.role === "menejer") return "Ega";
  return "";
}

// ── Xarajat qo'shish ──────────────────────────────
function addXarajat() {
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("moliya","add")) return;

  if (typeof requireUse === "function" && !requireUse("moliya")) return;

  const cat      = ($("exp-cat-val")||{value:"Boshqa"}).value;
  const currency = ($("ax-currency")||{value:"uzs"}).value;
  const method   = ($("ax-pay-method")||{value:"naqd"}).value;
  const date     = ($("ax-date")||{value:""}).value || today();
  const note     = ($("ax-note")||{value:""}).value.trim();
  // ⚠️ 2026-08-02: KIRGAN XODIM USTUVOR (POS bilan bir xil qoida).
  // Avval faqat ro'yxatdan tanlangani olinardi — xodim o'z hisobi
  // bilan kirgan bo'lsa ham, xarajatni BOSHQA odam nomiga yozib
  // yuborishi mumkin edi. Endi kim kirgan bo'lsa, o'sha yoziladi.
  // `ax-who` ISM saqlaydi (id emas) — shuning uchun ism olinadi.
  // Egasi kirsa (staffId yo'q) — avvalgidek ro'yxatdan.
  const paidBy = (() => {
    try {
      const u = typeof getAuthUser === "function" ? getAuthUser() : null;
      if (u && u.staffId) {
        const me = (db.staff||[]).find(x => x.id === u.staffId);
        if (me && me.name) return me.name;
      }
      if (u) return "Ega";        // egasi kirgan — o'zi
    } catch(e) {}
    return ($("ax-who")||{value:""}).value;
  })();
  const recurring= ($("ax-recurring")||{checked:false}).checked;
  const rate     = db.settings?.rate || 12800;

  // Summa — agar USD bo'lsa, so'mga ham aylantiramiz
  const rawSum = getRawVal("ax-sum");
  const sum    = currency === "usd" ? Math.round(rawSum * rate) : rawSum;
  const sumUsd = currency === "usd" ? rawSum : null;

  // Recipient (kimga)
  let recipient = "";
  const recSel = $("ax-recipient");
  const recMan = $("ax-recipient-manual");
  if (recMan && recMan.style.display !== "none") {
    recipient = recMan.value.trim();
  } else if (recSel) {
    recipient = recSel.value !== "__manual__" ? recSel.value : "";
  }

  if (rawSum <= 0) { toast("Summani kiriting","err"); return; }
  if ((cat === "Maosh" || cat === "Yetkazuvchi") && !recipient) {
    toast("Kimga ekanligini tanlang","err"); return;
  }

  if (!db.xarajatlar) db.xarajatlar = [];
  const subCat = ($("exp-subcat-val")||{value:""}).value.trim();
  const entry = {
    id: db.seq++, date, category: cat, amount: sum,
    subCategory: subCat || null,
    recipient, paidBy, note, method,
    xarajatType: _expType || "kunlik",
    forMonth: (_expType === "oylik" && cat === "Maosh")
      ? (_expForMonth || today().slice(0,7))
      : null
  };
  if (sumUsd) entry.amountUsd = sumUsd;
  if (recurring) entry.recurring = true;
  db.xarajatlar.push(entry);

  // Takroriy xarajat — keyingi oyga ham qo'shish
  if (recurring) {
    const nextMonth = new Date(date);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    // Faqat eslatma — avtomatik qo'shmaymiz, toast da aytamiz
  }

  saveDB(); renderMoliya(); closeModal("addxarajat");

  const recTxt = recipient ? ` → ${recipient}` : "";
  const amtTxt = sumUsd ? `${fmtUsd(sumUsd)} (${fmt(sum)} so'm)` : `${fmt(sum)} so'm`;
  toast(`✅ ${cat}${recTxt}: ${amtTxt}${recurring?" | Takroriy belgilandi":""}`);

  // Formani tozalash
  ["ax-sum","ax-note"].forEach(id => { const el=$(id); if(el)el.value=""; });
  if ($("ax-who")) $("ax-who").value = "";
  if ($("ax-currency")) $("ax-currency").value = "uzs";
  if ($("ax-pay-method")) $("ax-pay-method").value = "naqd";
  if ($("ax-recurring")) $("ax-recurring").checked = false;
  const wrap = $("ax-extra-wrap"); if (wrap) wrap.innerHTML = "";
  document.querySelectorAll(".mcat").forEach((b,i) => b.classList.toggle("on", i===0));
  if ($("exp-cat-val")) $("exp-cat-val").value = "Ijara";
}

// ── Xarajatni o'chirish ───────────────────────────
function deleteExp(id) {
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("moliya","del")) return;

  if (typeof requireUse === "function" && !requireUse("moliya")) return;

  const x = (db.xarajatlar||[]).find(e => e.id === id); if (!x) return;
  const catIcon = ["🏠","👤","🚗","💡","📢","📦","🏛️","🔧","📋"][MOL_CATS.indexOf(x.category)] || "📋";
  const info = x.recipient ? ` (${x.recipient})` : "";
  if (!confirm(`${catIcon} ${x.category}${info}\n${fmt(x.amount)} so'm — o'chirilsinmi?`)) return;
  db.xarajatlar = db.xarajatlar.filter(e => e.id !== id);
  // 2026-08-02: BULUTGA HAM AYTAMIZ (kontekst §5.3 — chala ish edi).
  // Avval `queueCloudDelete` chaqirilmasdi: xarajat faqat qurilmadan
  // o'chib, keyingi tortishda bulutdagi nusxa QAYTIB kelardi.
  // Mijozlarda ham xuddi shu bo'lgan edi.
  try { if (typeof queueCloudDelete === "function") queueCloudDelete("xarajatlar", "id", id); } catch(e) {}
  saveDB();
  try { if (typeof flushCloudSync === "function") flushCloudSync(true); } catch(e) {}
  renderMoliya();
  toast("Xarajat o'chirildi");
}

function editExp(id) {
  const x = (db.xarajatlar||[]).find(e => e.id === id); if (!x) return;
  // Modalni ochib, maydonlarni to'ldirish
  openModal("addxarajat"); initExpModal();
  setTimeout(() => {
    // Kategoriya
    if ($("exp-cat-val")) $("exp-cat-val").value = x.category || "Boshqa";
    document.querySelectorAll(".mcat").forEach(b => b.classList.toggle("on", b.dataset.c === (x.category||"Boshqa")));
    renderExpExtraField(x.category);
    // Maydonlar
    if ($("ax-date")) $("ax-date").value = x.date || today();
    if ($("ax-note")) $("ax-note").value = x.note || "";
    if ($("ax-currency")) $("ax-currency").value = x.amountUsd ? "usd" : "uzs";
    if ($("ax-pay-method")) $("ax-pay-method").value = x.method || "naqd";
    if ($("ax-recurring")) $("ax-recurring").checked = !!x.recurring;
    // Summa
    const sumEl = $("ax-sum");
    if (sumEl) {
      const rawVal = x.amountUsd || x.amount || 0;
      sumEl.dataset.raw = rawVal;
      sumEl.value = fmt(rawVal);
    }
    // Kim to'ladi
    setTimeout(() => { if ($("ax-who")) $("ax-who").value = x.paidBy || ""; }, 50);
    // Sarlavhani o'zgartirish + saqlash tugmasi
    const h2 = document.querySelector("#ov-addxarajat h2");
    if (h2) h2.textContent = "Xarajatni tahrirlash";
    const btn = document.querySelector("#ov-addxarajat .btn-red");
    if (btn) { btn.textContent = ""; btn.innerHTML = '<i class="ti ti-check"></i> Saqlash'; btn.onclick = () => saveEditExp(id); }
  }, 50);
}

function saveEditExp(id) {
  const idx = (db.xarajatlar||[]).findIndex(e => e.id === id); if (idx < 0) return;
  const cat      = ($("exp-cat-val")||{value:"Boshqa"}).value;
  const currency = ($("ax-currency")||{value:"uzs"}).value;
  const method   = ($("ax-pay-method")||{value:"naqd"}).value;
  const date     = ($("ax-date")||{value:""}).value || today();
  const note     = ($("ax-note")||{value:""}).value.trim();
  const paidBy   = ($("ax-who")||{value:""}).value;
  const recurring= ($("ax-recurring")||{checked:false}).checked;
  const rate     = db.settings?.rate || 12800;
  const rawSum   = getRawVal("ax-sum");
  const sum      = currency === "usd" ? Math.round(rawSum * rate) : rawSum;
  const sumUsd   = currency === "usd" ? rawSum : null;

  let recipient = "";
  const recSel = $("ax-recipient"), recMan = $("ax-recipient-manual");
  if (recMan && recMan.style.display !== "none") recipient = recMan.value.trim();
  else if (recSel) recipient = recSel.value !== "__manual__" ? recSel.value : "";

  if (rawSum <= 0) { toast("Summani kiriting","err"); return; }

  db.xarajatlar[idx] = { ...db.xarajatlar[idx], date, category:cat, amount:sum, recipient, paidBy, note, method, recurring };
  if (sumUsd) db.xarajatlar[idx].amountUsd = sumUsd; else delete db.xarajatlar[idx].amountUsd;
  saveDB(); renderMoliya(); closeModal("addxarajat");
  toast(`✅ Xarajat yangilandi: ${fmt(sum)} so'm`);
  // Modal sarlavhasini tiklash
  setTimeout(() => {
    const h2 = document.querySelector("#ov-addxarajat h2"); if (h2) h2.textContent = "Xarajat qo'shish";
    const btn = document.querySelector("#ov-addxarajat .btn-red");
    if (btn) { btn.innerHTML = '<i class="ti ti-check"></i> Xarajatni saqlash'; btn.onclick = () => addXarajat(); }
  }, 100);
}

// ── Excel eksport ─────────────────────────────────
function exportExpExcel() {
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("moliya","excel")) return;

  const { from, to } = molDateRange();
  const q = ($("exp-q")||{value:""}).value.toLowerCase();
  const catFilter    = ($("exp-cat-filter")||{value:""}).value;
  const methodFilter = ($("exp-method-filter")||{value:""}).value;
  // 2026-07-31: eksport ham ro'yxat bilan BIR XIL davrni oladi —
  // avval ekranda bir narsa, faylda boshqa narsa chiqishi mumkin edi.
  const _er2 = expDateRange();

  // ⚠️ 2026-08-02: EKRANDAGI RO'YXATDAN.
  // Avval filtr shu yerda qayta yozilardi. Ro'yxat filtri
  // o'zgarganda (xarajat turi, ko'p parametrli qidiruv) eksport
  // orqada qolardi — ekran va fayl har xil chiqardi.
  const exps = getExportList("moliya", (db.xarajatlar||[])
    .filter(x => (x.date||"") >= _er2.from && (x.date||"") <= _er2.to));

  const rows = [["Sana","Kategoriya","Kimga/Nima uchun","Kim to'ladi","To'lov usuli","Summa (so'm)","USD","Izoh"]];
  exps.forEach(x => rows.push([
    x.date||"", x.category||"", x.recipient||"", x.paidBy||"",
    x.method||"naqd", x.amount||0, x.amountUsd||"", x.note||""
  ]));
  const total = exps.reduce((a,x)=>a+(x.amount||0),0);
  rows.push(["","","","","","JAMI:", total, ""]);

  const label = catFilter ? `_${catFilter}` : "";
  downloadCSV(rows, `merx_xarajatlar${label}_${today()}.xls`);
  toast(`✅ ${exps.length} ta xarajat yuklab olindi`);
}
// ── Modal ochilganda initializ ────────────────────
// ── Xarajat teg yordamchilari ─────────────────────
const EXP_TAGS_KUNLIK_DEFAULT = ["Abed","Taksi","Arava","Ovqat","Kanselyariya","Boshqa"];
const EXP_TAGS_OYLIK_DEFAULT  = ["Maosh","Ijara","Kommunal","Soliq","Reklama","Yetkazuvchi","Jihozlar","Boshqa"];

function getExpTags(type) {
  if (type === "kunlik") return [...(db.settings?.expTagsKunlik || EXP_TAGS_KUNLIK_DEFAULT)];
  return [...(db.settings?.expTagsOylik || EXP_TAGS_OYLIK_DEFAULT)];
}

// Xarajat turini o'rnatish
function setExpType(type) {
  _expType = type;
  // Tugmalar
  const kb = document.getElementById("ax-type-kunlik");
  const ob = document.getElementById("ax-type-oylik");
  if (kb) {
    kb.style.background   = type==="kunlik" ? "#0D1B2A" : "#fff";
    kb.style.color        = type==="kunlik" ? "#fff"    : "var(--mut)";
    kb.style.borderColor  = type==="kunlik" ? "#0D1B2A" : "var(--brd)";
  }
  if (ob) {
    ob.style.background   = type==="oylik" ? "#0D1B2A" : "#fff";
    ob.style.color        = type==="oylik" ? "#fff"    : "var(--mut)";
    ob.style.borderColor  = type==="oylik" ? "#0D1B2A" : "var(--brd)";
  }
  // Teglarni render qilish
  renderExpCatTags(type);
  // Oylik bo'lsa — oy tanlash ko'rsatish
  const forMonthWrap = document.getElementById("ax-formonth-wrap");
  if (forMonthWrap) forMonthWrap.style.display = type==="oylik" ? "block" : "none";
}

// Kategoriya teglarini render qilish
function renderExpCatTags(type) {
  const el = document.getElementById("exp-cats"); if (!el) return;
  const tags    = getExpTags(type);
  const catVal  = document.getElementById("exp-cat-val");
  const subVal  = document.getElementById("exp-subcat-val");
  const curVal  = catVal?.value || tags[0];

  el.innerHTML = tags.map(t => {
    const on = t === curVal;
    return `<span class="mcat ${on?"on":""}" data-c="${t}" onclick="expCatPick(this)">${t}</span>`;
  }).join("") +
  `<button onclick="openExpTagSettings('${type}')" title="Teglarni boshqarish"
    style="padding:4px 10px;border:1.5px solid var(--brd);border-radius:20px;background:#fff;color:var(--mut);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
    ⚙️ Teglar
  </button>`;

  // Birinchi tegni tanlash
  if (!tags.includes(curVal) && catVal) catVal.value = tags[0] || "Boshqa";

  const curCat = catVal?.value || "";
  renderExpExtraField(curCat);
  renderExpSubCats(type, curCat);

  // Maosh uchun oy tanlash
  const forMonthWrap = document.getElementById("ax-formonth-wrap");
  if (forMonthWrap) {
    forMonthWrap.style.display = (type==="oylik" && curCat==="Maosh") ? "block" : "none";
  }
}

// Sub-kategoriyalarni render qilish
function renderExpSubCats(type, parentTag) {
  const el = document.getElementById("ax-subcat-wrap"); if (!el) return;
  const subTags = getSubTags(type, parentTag);
  if (!subTags.length) { el.style.display = "none"; return; }

  el.style.display = "block";
  const subVal = document.getElementById("exp-subcat-val");
  const curSub = subVal?.value || "";

  el.innerHTML = `<div class="fld" style="margin-bottom:8px">
    <label style="font-size:11.5px;color:var(--mut);font-weight:700">${parentTag} — tur tanlang</label>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
      ${subTags.map(st => `<span class="mcat ${st===curSub?"on":""}" data-sub="${st}"
        onclick="pickSubCat(this)">${st}</span>`).join("")}
    </div>
    <input id="exp-subcat-val" type="hidden" value="${curSub}">
  </div>`;
}

function pickSubCat(el) {
  document.querySelectorAll("[data-sub]").forEach(b => b.classList.remove("on"));
  el.classList.add("on");
  const subVal = document.getElementById("exp-subcat-val");
  if (subVal) subVal.value = el.dataset.sub;
}

// Yangi teg qo'shish
// ── Teglar boshqaruvi ─────────────────────────────

// Teg sozlamalari modali — tahrirlash, o'chirish, qayta tartib
function openExpTagSettings(type) {
  const title    = type === "kunlik" ? "⚡ Kunlik xarajat teglari" : "📅 Oylik xarajat teglari";
  const tags     = getExpTags(type);
  const defaults = type === "kunlik" ? EXP_TAGS_KUNLIK_DEFAULT : EXP_TAGS_OYLIK_DEFAULT;

  const rows = tags.map((tag, i) => {
    const isDefault  = defaults.includes(tag);
    const subTags    = getSubTags(type, tag);
    const hasSubTags = subTags.length > 0;
    return `<div class="exp-tag-row" id="etr-${i}" style="display:flex;align-items:center;gap:8px;padding:9px 12px;border:1.5px solid #E8E5E0;border-radius:10px;margin-bottom:6px;background:#fff">
      <span style="flex:1;font-size:14px;font-weight:600;color:#0D1B2A">${tag}
        ${hasSubTags ? `<span style="font-size:11px;color:#9CA3AF;font-weight:400;margin-left:6px">${subTags.length} sub-teg</span>` : ""}
      </span>
      <button onclick="editExpTag('${type}',${i})"
        style="padding:5px 10px;border:1px solid #E8E5E0;border-radius:7px;background:#fff;cursor:pointer;font-size:12px;font-weight:600;color:#374151">
        ✏️ Tahrir
      </button>
      <button onclick="openSubTagSettings('${type}','${tag}')"
        style="padding:5px 10px;border:1px solid #E8E5E0;border-radius:7px;background:#EEF2FF;cursor:pointer;font-size:12px;font-weight:600;color:#4F46E5">
        + Sub
      </button>
      ${!isDefault ? `<button onclick="deleteExpTag('${type}',${i})"
        style="padding:5px 8px;border:1px solid #FEE2E2;border-radius:7px;background:#FFF5F5;cursor:pointer;font-size:12px;color:#E05A5A">
        🗑
      </button>` : `<span style="font-size:11px;color:#CBD5E1;padding:0 8px">asosiy</span>`}
    </div>`;
  }).join("");

  const modal = document.createElement("div");
  modal.className = "ov"; modal.id = "ov-exp-tags";
  modal.style.cssText = "display:flex";
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal" style="max-width:480px">
      <button class="m-close" onclick="document.getElementById('ov-exp-tags').remove()"><i class="ti ti-x"></i></button>
      <h2 style="margin-bottom:4px">${title}</h2>
      <p style="font-size:12.5px;color:var(--mut);margin-bottom:14px">Tahrirlash, o'chirish yoki sub-teg qo'shish</p>
      <div id="exp-tags-list">${rows}</div>
      <button onclick="openAddExpTag('${type}')"
        style="width:100%;padding:11px;border:2px dashed #E9A500;border-radius:10px;background:transparent;color:#E9A500;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px">
        + Yangi teg qo'shish
      </button>
    </div>`;
  document.body.appendChild(modal);
}

function editExpTag(type, idx) {
  const tags = getExpTags(type);
  const old  = tags[idx];
  const name = prompt("Teg nomini o'zgartiring:", old);
  if (!name || !name.trim() || name.trim() === old) return;
  const key  = type === "kunlik" ? "expTagsKunlik" : "expTagsOylik";
  const cur  = [...getExpTags(type)];
  cur[idx] = name.trim();
  if (!db.settings) db.settings = {};
  db.settings[key] = cur;
  // Sub-teglarni ham yangilaymiz
  const subKey = "expSubTags_" + type + "_" + old;
  if (db.settings[subKey]) {
    db.settings["expSubTags_" + type + "_" + name.trim()] = db.settings[subKey];
    delete db.settings[subKey];
  }
  saveDB();
  document.getElementById("ov-exp-tags")?.remove();
  openExpTagSettings(type);
  toast(`"${old}" → "${name.trim()}" o'zgartirildi`);
}

function deleteExpTag(type, idx) {
  const tags = getExpTags(type);
  const tag  = tags[idx];
  if (!confirm(`"${tag}" tegini o'chirasizmi?`)) return;
  const key  = type === "kunlik" ? "expTagsKunlik" : "expTagsOylik";
  const cur  = [...getExpTags(type)];
  cur.splice(idx, 1);
  if (!db.settings) db.settings = {};
  db.settings[key] = cur;
  // Sub-teglarni ham o'chiramiz
  delete db.settings["expSubTags_" + type + "_" + tag];
  saveDB();
  document.getElementById("ov-exp-tags")?.remove();
  openExpTagSettings(type);
  toast(`"${tag}" tegi o'chirildi`);
}

// ── Sub-teglar ─────────────────────────────────────
function getSubTags(type, parentTag) {
  const key = "expSubTags_" + type + "_" + parentTag;
  return db.settings?.[key] || [];
}

function openSubTagSettings(type, parentTag) {
  const subTags = getSubTags(type, parentTag);
  const key     = "expSubTags_" + type + "_" + parentTag;

  const rows = subTags.map((st, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #E8E5E0;border-radius:9px;margin-bottom:5px;background:#fff">
      <span style="flex:1;font-size:13.5px;font-weight:600;color:#374151">${st}</span>
      <button onclick="editSubTag('${type}','${parentTag}',${i})"
        style="padding:4px 9px;border:1px solid #E8E5E0;border-radius:7px;background:#fff;cursor:pointer;font-size:12px;font-weight:600">✏️</button>
      <button onclick="deleteSubTag('${type}','${parentTag}',${i})"
        style="padding:4px 8px;border:1px solid #FEE2E2;border-radius:7px;background:#FFF5F5;cursor:pointer;font-size:12px;color:#E05A5A">🗑</button>
    </div>`).join("") || `<div style="color:var(--mut);font-size:13px;text-align:center;padding:12px">Sub-teglar yo'q</div>`;

  const modal = document.createElement("div");
  modal.className = "ov"; modal.id = "ov-subtags";
  modal.style.cssText = "display:flex";
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal" style="max-width:420px">
      <button class="m-close" onclick="document.getElementById('ov-subtags').remove()"><i class="ti ti-x"></i></button>
      <h2 style="margin-bottom:4px">${parentTag} — sub-teglar</h2>
      <p style="font-size:12.5px;color:var(--mut);margin-bottom:14px">Masalan: Kommunal → Gaz, Suv, Elektr</p>
      <div id="subtags-list">${rows}</div>
      <button onclick="addSubTag('${type}','${parentTag}')"
        style="width:100%;padding:11px;border:2px dashed #8B5CF6;border-radius:10px;background:transparent;color:#8B5CF6;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px">
        + Sub-teg qo'shish
      </button>
    </div>`;
  document.body.appendChild(modal);
}

function addSubTag(type, parentTag) {
  const name = prompt(`"${parentTag}" uchun sub-teg:`);
  if (!name || !name.trim()) return;
  const key  = "expSubTags_" + type + "_" + parentTag;
  if (!db.settings) db.settings = {};
  const cur  = [...(db.settings[key] || [])];
  if (!cur.includes(name.trim())) { cur.push(name.trim()); db.settings[key] = cur; saveDB(); }
  document.getElementById("ov-subtags")?.remove();
  openSubTagSettings(type, parentTag);
  toast(`Sub-teg "${name.trim()}" qo'shildi`);
}

function editSubTag(type, parentTag, idx) {
  const key  = "expSubTags_" + type + "_" + parentTag;
  const cur  = [...(db.settings?.[key] || [])];
  const old  = cur[idx];
  const name = prompt("Sub-teg nomini o'zgartiring:", old);
  if (!name || !name.trim() || name.trim() === old) return;
  cur[idx] = name.trim();
  if (!db.settings) db.settings = {};
  db.settings[key] = cur;
  saveDB();
  document.getElementById("ov-subtags")?.remove();
  openSubTagSettings(type, parentTag);
  toast(`"${old}" → "${name.trim()}" o'zgartirildi`);
}

function deleteSubTag(type, parentTag, idx) {
  const key  = "expSubTags_" + type + "_" + parentTag;
  const cur  = [...(db.settings?.[key] || [])];
  const tag  = cur[idx];
  if (!confirm(`"${tag}" sub-tegini o'chirasizmi?`)) return;
  cur.splice(idx, 1);
  if (!db.settings) db.settings = {};
  db.settings[key] = cur;
  saveDB();
  document.getElementById("ov-subtags")?.remove();
  openSubTagSettings(type, parentTag);
  toast(`"${tag}" o'chirildi`);
}

function openAddExpTag(type) {
  const name = prompt(`Yangi ${type} xarajat tegi:`);
  if (!name || !name.trim()) return;
  const tag = name.trim();
  if (!db.settings) db.settings = {};
  const key = type === "kunlik" ? "expTagsKunlik" : "expTagsOylik";
  const cur = db.settings[key] || (type==="kunlik" ? [...EXP_TAGS_KUNLIK_DEFAULT] : [...EXP_TAGS_OYLIK_DEFAULT]);
  if (!cur.includes(tag)) { cur.push(tag); db.settings[key] = cur; saveDB(); }
  renderExpCatTags(type);
  // Yangi tegni tanlash
  const catVal = document.getElementById("exp-cat-val");
  if (catVal) catVal.value = tag;
  document.querySelectorAll(".mcat").forEach(b => b.classList.toggle("on", b.dataset.c === tag));
  toast(`"${tag}" tegi qo'shildi`);
}

// Oylik — qaysi oy
function setForMonth(sel) {
  _expForMonthSel = sel;
  const t = today();
  const d = new Date(t);
  if (sel === "prev") d.setMonth(d.getMonth()-1);
  if (sel === "next") d.setMonth(d.getMonth()+1);
  _expForMonth = d.toISOString().slice(0,7); // "2026-06"
  const el = document.getElementById("ax-formonth");
  if (el) el.value = _expForMonth;
  // Label
  const lbl = document.getElementById("ax-formonth-lbl");
  if (lbl) {
    const months = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
    lbl.textContent = months[d.getMonth()] + " " + d.getFullYear();
  }
  // Tugmalar
  ["prev","cur","next"].forEach(s => {
    const b = document.getElementById("ax-fm-" + s);
    if (!b) return;
    const on = s === sel;
    b.style.background  = on ? "#0D1B2A" : "#fff";
    b.style.color       = on ? "#fff"    : "var(--mut)";
    b.style.borderColor = on ? "#0D1B2A" : "var(--brd)";
  });
}

function initExpModal() {
  setTimeout(() => {
    if ($("ax-date") && !$("ax-date").value) $("ax-date").value = today();
    initExpWhoSelect();
    // Xarajat turi va teglarni yuklash
    setExpType(_expType || "kunlik");
    // Maosh uchun oy — default bu oy
    setForMonth(_expForMonthSel || "cur");
  }, 30);
}


// ══════════════════════════════════════════════════
// KASSA SMENASI BOSHQARUVI
// ══════════════════════════════════════════════════

function renderKassaBalances() {
  const el = $("mol-kassa-balances"); if (!el) return;
  const rate = db.settings?.rate || 12800;

  if (!(db.staff||[]).length) {
    el.innerHTML = `<div style="color:var(--mut);font-size:13px;text-align:center;padding:12px">Xodimlar yo'q</div>`;
    return;
  }

  const kassirlar = (db.staff||[]).filter(s => s.role === "kassir" || !s.role);

  el.innerHTML = kassirlar.map(s => {
    const bal = (db.kassaBalances||{})[s.id] || 0;
    // Shu kassirning faol smenasi bormi?
    const activeShift = (db.shifts||[]).find(sh => sh.staffId === s.id && !sh.closeTime);

    return `<div style="display:flex;align-items:center;justify-content:space-between;
      padding:12px 14px;border:1.5px solid var(--brd);border-radius:10px;margin-bottom:8px">
      <div>
        <div style="font-weight:700;font-size:13px">${s.name}</div>
        <div style="font-size:11px;color:var(--mut);margin-top:2px">
          ${activeShift
            ? `<span style="color:var(--grn);font-weight:600">● Smena ochiq</span> · ${activeShift.openTime||""}`
            : `<span style="color:#bbb">○ Smena yopiq</span>`}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:800;color:${bal>0?"#0D1B2A":"#bbb"}">${fmt(bal)} so'm</div>
        <div style="display:flex;gap:5px;margin-top:5px;justify-content:flex-end">
          ${activeShift
            ? `<button class="btn btn-sm" style="color:var(--red);font-size:11.5px" onclick="openCloseShift('${s.id}')">
                <i class="ti ti-lock"></i> Kassani yopish
              </button>`
            : `<button class="btn btn-sm btn-acc" style="font-size:11.5px" onclick="openStartShift('${s.id}')">
                <i class="ti ti-lock-open"></i> Smena ochish
              </button>`}
          <button class="btn btn-ghost btn-sm" style="font-size:11.5px" onclick="showShiftHistory('${s.id}')">
            <i class="ti ti-history"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join("") || `<div style="color:var(--mut);font-size:13px;text-align:center;padding:12px">Kassirlar yo'q</div>`;
}

function openStartShift(staffId) {
  const s = (db.staff||[]).find(x => x.id == staffId); if (!s) return;
  const bal = (db.kassaBalances||{})[staffId] || 0;

  const modal = document.createElement("div");
  modal.className = "ov"; modal.id = "shift-modal";
  modal.style.cssText = "display:flex";
  modal.innerHTML = `
    <div class="modal" style="max-width:400px">
      <button class="m-close" onclick="$('shift-modal').remove()"><i class="ti ti-x"></i></button>
      <h2 style="margin-bottom:4px"><i class="ti ti-lock-open"></i> Smena ochish</h2>
      <p style="font-size:13px;color:var(--mut);margin-bottom:16px">Kassir: <b>${s.name}</b></p>
      <div class="fld">
        <label>Kassadagi naqd pul (boshlang'ich)</label>
        <input id="shift-open-cash" type="text" data-price placeholder="0" oninput="fmtInput(this)"
          style="font-size:16px;font-weight:700;font-family:inherit;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 12px;width:100%">
        ${bal > 0 ? `<div style="font-size:11.5px;color:var(--mut);margin-top:4px">Joriy balans: ${fmt(bal)} so'm</div>` : ""}
      </div>
      <div class="fld">
        <label>Izoh <span style="color:var(--mut);font-weight:400">(ixtiyoriy)</span></label>
        <input id="shift-open-note" placeholder="Masalan: Ertalabki smena..."
          style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%">
      </div>
      <button class="btn btn-acc" style="width:100%" onclick="confirmStartShift('${staffId}')">
        <i class="ti ti-check"></i> Smenani boshlash
      </button>
    </div>`;
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  document.body.appendChild(modal);
  setTimeout(()=>{ const el=$("shift-open-cash"); if(el){el.dataset.raw=0; el.focus();} },50);
}

function confirmStartShift(staffId) {
  const openCash = getRawVal("shift-open-cash") || 0;
  const note     = ($("shift-open-note")||{value:""}).value;
  const now      = new Date();

  if (!db.shifts) db.shifts = [];
  db.shifts.push({
    id: db.seq++, staffId,
    openTime: now.toISOString().slice(0,16).replace("T"," "),
    openDate: now.toISOString().slice(0,10),
    openCash, note, closeTime: null, closeCash: null, diff: null
  });

  // Kassir balansini boshlang'ich pul bilan o'rnatamiz
  if (!db.kassaBalances) db.kassaBalances = {};
  db.kassaBalances[staffId] = openCash;

  saveDB();
  $("shift-modal")?.remove();
  renderKassaBalances();
  toast(`✅ ${(db.staff||[]).find(x=>x.id==staffId)?.name} smenasi boshlandi`);
}

function openCloseShift(staffId) {
  const s = (db.staff||[]).find(x => x.id == staffId); if (!s) return;
  const shift = (db.shifts||[]).find(sh => sh.staffId == staffId && !sh.closeTime); if (!shift) return;
  const rate = db.settings?.rate || 12800;

  // Smena davomidagi sotuv hisoblash
  const shiftSales = statSales().filter(s => s.staffId == staffId && s.date >= shift.openDate);
  let cashIn = 0;
  shiftSales.forEach(s => {
    const pb = s.payBreakdown;
    if (pb && pb.naqd) cashIn += pb.naqd;
    else if (s.payType === "naqd") cashIn += s.paid||0;
  });
  // Qarz to'lovlari (naqd)
  const debtCash = cashPays()
    .filter(p => p.staffId == staffId && p.date >= shift.openDate)
    .reduce((a,p) => {
      // v158: aralashning NAQD ulushi ham kiradi (avval butunlay tushib qolardi)
      const mb = p.methodBreakdown;
      const mbHas = mb && Object.keys(mb).some(k => (mb[k]||0) > 0);
      if (mbHas) return a + (mb.naqd || 0);
      if ((p.method||"naqd") !== "naqd") return a;
      return a + (p.amountSom || (p.currency === "usd" ? Math.round((p.amount||0) * rate) : (p.amount || 0)));
    }, 0);
  // Xarajatlar (naqd, shu kassir)
  const expCash = (db.xarajatlar||[])
    .filter(x => x.paidBy === s.name && x.date >= shift.openDate && (x.method||"naqd")==="naqd")
    .reduce((a,x)=>a+(x.amount||0),0);

  const expectedCash = (shift.openCash||0) + cashIn + debtCash - expCash;
  const curBal = (db.kassaBalances||{})[staffId] || 0;

  const modal = document.createElement("div");
  modal.className = "ov"; modal.id = "shift-modal";
  modal.style.cssText = "display:flex";
  modal.innerHTML = `
    <div class="modal" style="max-width:430px">
      <button class="m-close" onclick="$('shift-modal').remove()"><i class="ti ti-x"></i></button>
      <h2 style="margin-bottom:4px"><i class="ti ti-lock"></i> Kassani yopish</h2>
      <p style="font-size:13px;color:var(--mut);margin-bottom:14px">Kassir: <b>${s.name}</b> · Boshlangan: ${shift.openTime}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        <div style="padding:10px 12px;background:var(--bg);border-radius:9px">
          <div style="font-size:10.5px;color:var(--mut);font-weight:700;text-transform:uppercase">Boshlang'ich</div>
          <div style="font-size:15px;font-weight:800;margin-top:3px">${fmt(shift.openCash||0)} so'm</div>
        </div>
        <div style="padding:10px 12px;background:#F0FDF4;border-radius:9px">
          <div style="font-size:10.5px;color:var(--grn);font-weight:700;text-transform:uppercase">Naqd tushum</div>
          <div style="font-size:15px;font-weight:800;margin-top:3px;color:var(--grn)">+${fmt(cashIn+debtCash)} so'm</div>
        </div>
        <div style="padding:10px 12px;background:#FEF2F2;border-radius:9px">
          <div style="font-size:10.5px;color:var(--red);font-weight:700;text-transform:uppercase">Xarajatlar</div>
          <div style="font-size:15px;font-weight:800;margin-top:3px;color:var(--red)">−${fmt(expCash)} so'm</div>
        </div>
        <div style="padding:10px 12px;background:#EEF2FF;border-radius:9px">
          <div style="font-size:10.5px;color:#4C9BE8;font-weight:700;text-transform:uppercase">Kutilgan</div>
          <div style="font-size:15px;font-weight:800;margin-top:3px;color:#4C9BE8">${fmt(expectedCash)} so'm</div>
        </div>
      </div>

      <div class="fld">
        <label>Faktik naqd pul (sanab ko'ring)</label>
        <input id="shift-close-cash" type="text" data-price oninput="fmtInput(this);updateShiftDiff(${expectedCash})"
          placeholder="${fmt(expectedCash)}"
          style="font-size:16px;font-weight:700;font-family:inherit;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 12px;width:100%">
      </div>

      <div id="shift-diff-block" style="display:none;padding:10px 14px;border-radius:9px;margin-bottom:12px;text-align:center">
        <div id="shift-diff-text" style="font-size:14px;font-weight:700"></div>
      </div>

      <div class="fld">
        <label>Izoh</label>
        <input id="shift-close-note" placeholder="Kun yopish, inkassatsiya..."
          style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%">
      </div>
      <button class="btn btn-red" style="width:100%" onclick="confirmCloseShift('${staffId}', ${expectedCash})">
        <i class="ti ti-lock"></i> Kassani yopish
      </button>
    </div>`;
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  document.body.appendChild(modal);
  setTimeout(()=>{ const el=$("shift-close-cash"); if(el){el.dataset.raw=expectedCash; el.value=fmt(expectedCash); el.focus(); el.select();} updateShiftDiff(expectedCash);},80);
}

function updateShiftDiff(expectedCash) {
  const actual = getRawVal("shift-close-cash") || 0;
  const diff   = actual - expectedCash;
  const block  = $("shift-diff-block");
  const text   = $("shift-diff-text");
  if (!block || !text) return;
  if (diff === 0) {
    block.style.display = "block"; block.style.background = "#F0FDF4"; block.style.border = "1.5px solid #BBF7D0";
    text.innerHTML = `✅ Farq yo'q — kassa to'g'ri`;  text.style.color = "var(--grn)";
  } else {
    block.style.display = "block";
    block.style.background = diff > 0 ? "#F0FDF4" : "#FEF2F2";
    block.style.border = `1.5px solid ${diff>0?"#BBF7D0":"#FECACA"}`;
    text.innerHTML = diff > 0
      ? `📈 Ortiqcha: +${fmt(diff)} so'm`
      : `⚠️ Kamomad: −${fmt(Math.abs(diff))} so'm`;
    text.style.color = diff > 0 ? "var(--grn)" : "var(--red)";
  }
}

function confirmCloseShift(staffId, expectedCash) {
  const closeCash = getRawVal("shift-close-cash");
  const note      = ($("shift-close-note")||{value:""}).value;
  const diff      = closeCash - expectedCash;
  const now       = new Date();

  const shift = (db.shifts||[]).find(sh => sh.staffId == staffId && !sh.closeTime);
  if (!shift) return;

  shift.closeTime  = now.toISOString().slice(0,16).replace("T"," ");
  shift.closeCash  = closeCash;
  shift.expectedCash = expectedCash;
  shift.diff       = diff;
  shift.closeNote  = note;

  // Kassir balansini yangilaymiz
  if (!db.kassaBalances) db.kassaBalances = {};
  db.kassaBalances[staffId] = closeCash;

  // Agar kamomad bo'lsa — xarajat sifatida yozamiz
  if (diff < 0) {
    if (!db.xarajatlar) db.xarajatlar = [];
    db.xarajatlar.push({
      id: db.seq++, date: now.toISOString().slice(0,10),
      category: "Boshqa", amount: Math.abs(diff),
      recipient: (db.staff||[]).find(x=>x.id==staffId)?.name || "Kassir",
      note: `Kassa kamomadi (${shift.openTime} — ${shift.closeTime})`,
      method: "naqd", paidBy: "kassa"
    });
  }

  saveDB();
  $("shift-modal")?.remove();
  renderMoliya();
  toast(diff === 0
    ? `✅ Kassa yopildi. Farq yo'q.`
    : diff > 0
      ? `✅ Kassa yopildi. Ortiqcha: +${fmt(diff)} so'm`
      : `⚠️ Kassa yopildi. Kamomad: ${fmt(Math.abs(diff))} so'm`);
}

function showShiftHistory(staffId) {
  const s = (db.staff||[]).find(x => x.id == staffId);
  const shifts = (db.shifts||[]).filter(sh => sh.staffId == staffId).slice(-10).reverse();

  const modal = document.createElement("div");
  modal.className = "ov"; modal.id = "shift-modal";
  modal.style.cssText = "display:flex";
  modal.innerHTML = `
    <div class="modal" style="max-width:480px">
      <button class="m-close" onclick="$('shift-modal').remove()"><i class="ti ti-x"></i></button>
      <h2 style="margin-bottom:14px"><i class="ti ti-history"></i> ${s?.name||"Kassir"} — smena tarixi</h2>
      ${!shifts.length ? `<div style="text-align:center;color:var(--mut);padding:20px">Smena tarixi yo'q</div>` :
        shifts.map(sh => `
          <div style="border:1.5px solid var(--brd);border-radius:10px;padding:12px 14px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div style="font-size:12.5px;font-weight:700">${sh.openTime}</div>
              <span class="bg ${sh.closeTime?"bg-g":"bg-a"}" style="font-size:11px">
                ${sh.closeTime ? "Yopilgan" : "Faol"}
              </span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:12px">
              <div><span style="color:var(--mut)">Boshlandi:</span><br><b>${fmt(sh.openCash||0)}</b></div>
              ${sh.closeTime ? `
                <div><span style="color:var(--mut)">Kutilgan:</span><br><b>${fmt(sh.expectedCash||0)}</b></div>
                <div><span style="color:var(--mut)">Farq:</span><br>
                  <b style="color:${sh.diff>0?"var(--grn)":sh.diff<0?"var(--red)":"#aaa"}">
                    ${sh.diff>0?"+":""}${fmt(sh.diff||0)}
                  </b>
                </div>` : "<div></div><div></div>"}
            </div>
            ${sh.note||sh.closeNote ? `<div style="font-size:11px;color:#aaa;margin-top:6px">${sh.note||""} ${sh.closeNote||""}</div>` : ""}
          </div>`).join("")}
    </div>`;
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  document.body.appendChild(modal);
}

// ── Yetkazuvchi qarzlar ro'yxati ──────────────────
function renderSupDebtList() {
  const el = document.getElementById("mol-sup-list"); if (!el) return;

  // Yetkazuvchi bo'yicha guruhlaymiz
  const supMap = {};
  (db.ombor||[]).filter(o => o.payStatus === "qarz").forEach(o => {
    const sup = o.supplier || "Noma'lum";
    if (!supMap[sup]) supMap[sup] = { items:[], debt:0 };
    const val = (o.kirimNarxi||0) * (o.qty||0);
    supMap[sup].items.push(o);
    supMap[sup].debt += val;
  });

  const sups = Object.entries(supMap).sort((a,b) => b[1].debt - a[1].debt);

  if (!sups.length) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--mut);font-size:13px">
      ✅ Barcha yetkazuvchi qarzlari to'langan</div>`;
    return;
  }

  el.innerHTML = sups.map(([sup, data]) => `
    <div style="border:1.5px solid var(--brd);border-radius:10px;padding:12px 14px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div>
          <div style="font-weight:700;font-size:14px">${sup}</div>
          <div style="font-size:12px;color:var(--mut)">${data.items.length} ta partiya qarz</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:800;color:var(--red)">${fmt(data.debt)} so'm</div>
          <button class="btn btn-sm btn-acc" onclick="paySupplierDebt('${sup}', ${data.debt})"
            style="margin-top:4px;font-size:12px">
            <i class="ti ti-cash"></i> To'lash
          </button>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${data.items.slice(0,3).map(o => `
          <div style="background:var(--bg);border-radius:6px;padding:4px 8px;font-size:11px;color:var(--mut)">
            ${o.productName} · ${o.qty} ${o.unit||"dona"} · ${fmt((o.kirimNarxi||0)*o.qty)} so'm
          </div>`).join("")}
        ${data.items.length > 3 ? `<div style="background:var(--bg);border-radius:6px;padding:4px 8px;font-size:11px;color:var(--mut)">
          +${data.items.length-3} ta partiya</div>` : ""}
      </div>
    </div>`
  ).join("");
}

// ── Yetkazuvchi qarzini to'lash ────────────────────
function paySupplierDebt(supplier, totalDebt) {
  const sups = (db.ombor||[]).filter(o => o.payStatus === "qarz" && (o.supplier||"Noma'lum") === supplier);
  if (!sups.length) { toast("Qarz topilmadi","err"); return; }

  // Modal orqali to'lash
  const modalId = "sup-pay-modal";
  let existing = $(modalId);
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.className = "ov";
  modal.id = modalId;
  modal.style.cssText = "display:flex";
  modal.innerHTML = `
    <div class="modal" style="max-width:400px">
      <button class="m-close" onclick="$(\'${modalId}\').remove()"><i class="ti ti-x"></i></button>
      <h2 style="margin-bottom:4px">Yetkazuvchiga to'lash</h2>
      <p style="font-size:13px;color:var(--mut);margin-bottom:14px">
        <b>${supplier}</b> · Jami qarz: <b style="color:var(--red)">${fmt(totalDebt)} so'm</b>
      </p>
      <div class="fld">
        <label>To'lov summasi</label>
        <input id="sup-pay-sum" type="text" data-price placeholder="${fmt(totalDebt)}"
          value="${fmt(totalDebt)}" oninput="fmtInput(this)"
          style="font-size:15px;font-weight:700;font-family:inherit;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 12px;width:100%">
        <div style="font-size:11.5px;color:var(--mut);margin-top:4px">Qisman to'lash mumkin</div>
      </div>
      <div class="fld">
        <label>To'lov usuli</label>
        <select id="sup-pay-method" style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%;background:#fff">
          <option value="naqd">💵 Naqd</option>
          <option value="karta">💳 Karta</option>
          <option value="otkazma">🏦 O'tkazma</option>
        </select>
      </div>
      <div class="fld">
        <label>Izoh</label>
        <input id="sup-pay-note" placeholder="${supplier} — qarz to'lovi"
          style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%">
      </div>
      <button class="btn btn-acc" style="width:100%;margin-top:4px"
        onclick="confirmSupPay('${supplier.replace(/'/g,"\\'")}', ${totalDebt})">
        <i class="ti ti-check"></i> To'lashni tasdiqlash
      </button>
    </div>`;
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  document.body.appendChild(modal);

  // Summa inputi focus
  setTimeout(()=>{ const s=$(("sup-pay-sum")); if(s){s.dataset.raw=totalDebt; s.select();}}, 50);
}

function confirmSupPay(supplier, totalDebt) {
  const rawSum = getRawVal("sup-pay-sum");
  const method = ($("sup-pay-method")||{value:"naqd"}).value;
  const note   = ($("sup-pay-note")||{value:""}).value || `${supplier} — qarz to'lovi`;

  if (!rawSum || rawSum <= 0) { toast("Summani kiriting","err"); return; }
  if (rawSum > totalDebt) { toast("To'lov summasi qarzdan ko'p","err"); return; }

  const sups = (db.ombor||[]).filter(o => o.payStatus === "qarz" && (o.supplier||"Noma'lum") === supplier);

  // Xarajatlarga qo'shamiz
  if (!db.xarajatlar) db.xarajatlar = [];
  db.xarajatlar.push({
    id: db.seq++, date: today(), category: "Yetkazuvchi",
    amount: rawSum, recipient: supplier, paidBy: "kassa",
    method, note
  });

  // Agar to'liq to'lansa — partiyalarni to'langan deb belgilaymiz
  if (rawSum >= totalDebt) {
    sups.forEach(o => { o.payStatus = "tolandan"; });
    toast(`✅ "${supplier}" ga ${fmt(rawSum)} so'm to'landi. ${sups.length} ta partiya yopildi.`);
  } else {
    // Qisman to'lov — birinchi partiyalardan boshlab yopiladi
    let remaining = rawSum;
    for (const o of sups) {
      const val = (o.kirimNarxi||0) * (o.qty||0);
      if (remaining >= val) { o.payStatus = "tolandan"; remaining -= val; }
      else break;
    }
    toast(`✅ "${supplier}" ga ${fmt(rawSum)} so'm to'landi (qisman).`);
  }

  saveDB();
  $("sup-pay-modal")?.remove();
  renderMoliya();
}

// ═══ XARAJATLAR SAHIFALASHI (2026-07-24, №14) ═══
function renderExpPagination(totalPages, totalRows) {
  const el = $("exp-pagination");
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ""; return; }

  const btn = (label, page, active, disabled) =>
    `<button onclick="setExpPage(${page})" ${disabled ? "disabled" : ""}
       style="font-family:inherit;font-size:13px;font-weight:${active?700:500};
       border:1px solid ${active?'#0D1B2A':'var(--brd)'};background:${active?'#0D1B2A':'#fff'};
       color:${active?'#fff':(disabled?'#bbb':'var(--ink)')};border-radius:8px;
       padding:6px 11px;cursor:${disabled?'default':'pointer'}">${label}</button>`;

  let pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - expPage) <= 2) pages.push(i);
    else if (pages[pages.length-1] !== "...") pages.push("...");
  }

  el.innerHTML =
    btn("‹", Math.max(1, expPage-1), false, expPage === 1) +
    pages.map(p => p === "..."
      ? `<span style="color:var(--mut);padding:0 2px">…</span>`
      : btn(p, p, p === expPage, false)).join("") +
    btn("›", Math.min(totalPages, expPage+1), false, expPage === totalPages) +
    `<span style="font-size:12px;color:var(--mut);margin-left:8px">${totalRows} ta yozuv</span>`;
}

function setExpPage(p) {
  expPage = p;
  renderMoliya();
  const el = $("exp-body");
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
}
