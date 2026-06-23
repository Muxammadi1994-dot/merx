// MERX moliya.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/moliya.js  (v3 — To'liq qayta yozildi)
// ================================================

let molPeriod = "month"; // default: bu oy
let _expChart = null;

let expDatePeriod = "all";

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

const MOL_KPI_LABELS = {
  rev:"Kassaga tushdi (jami)", sotuv:"Sotuv tushumi", qarz:"Qarz tushumi",
  exp:"Xarajatlar", gross:"Yalpi foyda", net:"Sof foyda",
  supdebt:"Yetkazuvchi qarzi", usd:"USD tushum", cnt:"Xarajatlar soni"
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
  document.querySelectorAll("#mol-kpi-row .stb").forEach(el=>{
    el.style.display=hidden.has(el.dataset.mkpi)?"none":"block";
  });
}
function openMolKpiSettings() {
  const hidden=new Set(db.settings?.hiddenMolKpis||[]);
  const list=$("mol-kpi-settings-list"); if(!list) return;
  list.innerHTML=Object.entries(MOL_KPI_LABELS).map(([k,l])=>`
    <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--brd);border-radius:9px;cursor:pointer">
      <input type="checkbox" ${!hidden.has(k)?"checked":""} onchange="this.checked?showMolKpi('${k}'):hideMolKpi('${k}')"
        style="width:17px;height:17px;accent-color:var(--acc);cursor:pointer">
      <span style="font-size:13px;font-weight:600">${l}</span>
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
  window.EXP_CATS   = ["Ijara","Maosh","Transport","Kommunal","Reklama","Yetkazuvchi","Boshqa"];
  window.EXP_COLORS = ["#E9A500","#4C9BE8","#36B48C","#8B5CF6","#E07B39","#E05A5A","#aaa"];
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
function renderMoliya() {
  const { from, to } = molDateRange();
  const rate = db.settings?.rate || 12800;
  const q = ($("exp-q")||{value:""}).value.toLowerCase();

  const periodSales = db.sales.filter(s => s.date >= from && s.date <= to);
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
  const periodDebtPays = (db.debtPayments||[]).filter(p => p.date >= from && p.date <= to);
  let debtNaqd = 0, debtKarta = 0, debtOtkazma = 0, debtBalans = 0;
  let usdQarzTushum = 0; // USD qarz to'lovlari (dollar hisobida)
  periodDebtPays.forEach(p => {
    const amt = p.currency === "usd" ? Math.round(p.amount * rate) : (p.amount || 0);
    if (p.currency === "usd") usdQarzTushum += p.amount;
    if      (p.method === "karta")   debtKarta   += amt;
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
      ? `$${totalUsdDollar.toFixed(2)} (${fmt(Math.round(totalUsdDollar*rate))} so'm)`
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
      if (p) saleCost += Math.round((p.costUsd||0) * rate) * (i.qty||0);
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
  const allSotuvPaid = (db.sales||[]).reduce((a, s) => {
    const pb = s.payBreakdown;
    if (pb && (pb.naqd||pb.karta||pb.otkazma))
      return a + (pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
    return a + (s.payType==="nasiya"?0:(s.paid||0));
  }, 0);
  const allDebtPaid = (db.debtPayments||[]).reduce((a,p) =>
    a + (p.currency==="usd"?Math.round(p.amount*rate):(p.amount||0)), 0);
  const allExp  = (db.xarajatlar||[]).reduce((a,x)=>a+(x.amount||0),0);
  const balans  = allSotuvPaid + allDebtPaid - allExp;

  // KPI
  if ($("mol-balans"))       $("mol-balans").textContent       = fmt(balans)+" so'm";
  if ($("mol-kirim"))        $("mol-kirim").textContent        = fmt(sotuv)+" so'm";
  if ($("mol-chiqim"))       $("mol-chiqim").textContent       = fmt(chiqim)+" so'm";
  if ($("mol-month-rev"))    $("mol-month-rev").textContent    = fmt(sotuv)+" so'm";
  if ($("mol-month-exp"))    $("mol-month-exp").textContent    = fmt(chiqim)+" so'm";
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
  renderKirimManbalar(naqd+debtNaqd, karta+debtKarta, otkazma+debtOtkazma, debtBalans, sotuv);

  const catTotals = {};
  periodExps.forEach(x => { const c=x.category||"Boshqa"; catTotals[c]=(catTotals[c]||0)+(x.amount||0); });

  let exps = [...periodExps].sort((a,b)=>((b.date||"")>(a.date||""))?1:-1);
  // Tekst qidiruv
  if (q) exps = exps.filter(x =>
    (x.category||"").toLowerCase().includes(q) ||
    (x.note||"").toLowerCase().includes(q) ||
    (x.recipient||"").toLowerCase().includes(q) ||
    (x.paidBy||"").toLowerCase().includes(q)
  );
  // Kategoriya filtri (select)
  const catFilter = ($("exp-cat-filter")||{value:""}).value;
  if (catFilter) exps = exps.filter(x => (x.category||"") === catFilter);
  // To'lov usuli filtri
  const methodFilter = ($("exp-method-filter")||{value:""}).value;
  if (methodFilter) exps = exps.filter(x => (x.method||"naqd") === methodFilter);
  // Sana oralig'i filtri
  const dateFrom = ($("exp-date-from")||{value:""}).value;
  const dateTo   = ($("exp-date-to")||{value:""}).value;
  if (dateFrom) exps = exps.filter(x => (x.date||"") >= dateFrom);
  if (dateTo)   exps = exps.filter(x => (x.date||"") <= dateTo);

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

  const tbody = $("exp-body");
  if (tbody) {
    tbody.innerHTML = exps.length ? exps.map(x => {
      const catIdx = MOL_CATS.indexOf(x.category);
      const color  = MOL_COLORS[catIdx>=0?catIdx:MOL_COLORS.length-1];
      const icon   = ["🏠","👤","🚗","💡","📢","📦","📋"][catIdx>=0?catIdx:6];
      const methodIcon = x.method==="karta"?"💳 Karta":x.method==="otkazma"?"🏦 O'tkazma":"💵 Naqd";
      return `<tr>
        ${cols.date      ? `<td style="font-size:12.5px;white-space:nowrap;font-weight:600">${x.date||"—"}</td>` : ""}
        ${cols.cat       ? `<td><span class="bg" style="font-size:12px;background:${color}18;color:${color}">${icon} ${x.category||"—"}</span></td>` : ""}
        ${cols.recipient ? `<td style="font-size:12px;color:#666">${x.recipient?`<div style="font-weight:600">${x.recipient}</div>`:""}${x.paidBy?`<div style="font-size:11px;color:#aaa">To'ladi: ${x.paidBy}</div>`:""}</td>` : ""}
        ${cols.method    ? `<td style="font-size:11.5px;color:var(--mut);white-space:nowrap">${methodIcon}</td>` : ""}
        ${cols.amount    ? `<td class="num" style="font-weight:800;color:var(--red);font-size:13px;white-space:nowrap">${fmt(x.amount||0)} so'm${x.amountUsd?`<div style="font-size:10.5px;color:#aaa;font-weight:400">$${x.amountUsd.toFixed(2)}</div>`:""}</td>` : ""}
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
  // Grafik faqat birinchi marta yoki period o'zgarganda chiziladi
  if (!_molTrendChart) renderMolTrendChart();
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
  (db.sales||[]).filter(s=>s.date>=pf&&s.date<=pt).forEach(s=>{
    const pb=s.payBreakdown;
    if(pb&&(pb.naqd||pb.karta||pb.otkazma)) prevKirim+=(pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
    else prevKirim+=s.payType==="nasiya"?0:(s.paid||0);
  });
  prevKirim += (db.debtPayments||[]).filter(p=>p.date>=pf&&p.date<=pt)
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
    (db.sales||[]).filter(s=>s.date>=from&&s.date<=to).forEach(s=>{
      const pb=s.payBreakdown;
      if(pb&&(pb.naqd||pb.karta||pb.otkazma)) sotuv+=(pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
      else sotuv+=(s.paid||0);
      jami+=(s.total||0);
    });
    const qarz=(db.debtPayments||[]).filter(p=>p.date>=from&&p.date<=to)
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
}

function renderExpExtraField(cat) {
  const wrap = $("ax-extra-wrap"); if (!wrap) return;

  if (cat === "Maosh") {
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
  sel.innerHTML = '<option value="">— Tanlang —</option>' +
    (db.staff||[]).map(s => `<option value="${s.name}">${s.name}</option>`).join("") +
    '<option value="Ega">Do\'kon egasi</option>';
}

// ── Xarajat qo'shish ──────────────────────────────
function addXarajat() {
  const cat      = ($("exp-cat-val")||{value:"Boshqa"}).value;
  const currency = ($("ax-currency")||{value:"uzs"}).value;
  const method   = ($("ax-pay-method")||{value:"naqd"}).value;
  const date     = ($("ax-date")||{value:""}).value || today();
  const note     = ($("ax-note")||{value:""}).value.trim();
  const paidBy   = ($("ax-who")||{value:""}).value;
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
  const entry = { id: db.seq++, date, category: cat, amount: sum, recipient, paidBy, note, method };
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
  const amtTxt = sumUsd ? `$${sumUsd.toFixed(2)} (${fmt(sum)} so'm)` : `${fmt(sum)} so'm`;
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
  const x = (db.xarajatlar||[]).find(e => e.id === id); if (!x) return;
  const catIcon = ["🏠","👤","🚗","💡","📢","📦","📋"][MOL_CATS.indexOf(x.category)] || "📋";
  const info = x.recipient ? ` (${x.recipient})` : "";
  if (!confirm(`${catIcon} ${x.category}${info}\n${fmt(x.amount)} so'm — o'chirilsinmi?`)) return;
  db.xarajatlar = db.xarajatlar.filter(e => e.id !== id);
  saveDB(); renderMoliya();
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
    if (sumEl) { sumEl.value = fmt(x.amountUsd || x.amount || 0); sumEl.dataset.raw = x.amountUsd || x.amount || 0; }
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
  const { from, to } = molDateRange();
  const exps = (db.xarajatlar||[]).filter(x => x.date >= from && x.date <= to);
  const rows = [["Sana","Kategoriya","Kimga/Nima uchun","Kim to'ladi","Summa (so'm)","Izoh"]];
  exps.forEach(x => rows.push([
    x.date||"", x.category||"", x.recipient||"", x.paidBy||"", x.amount||0, x.note||""
  ]));
  const total = exps.reduce((a,x)=>a+(x.amount||0),0);
  rows.push(["","","","","JAMI:", total]);

  downloadCSV(rows, `merx_xarajatlar_${today()}.csv`);
  toast("Excel yuklab olindi");
}

// ── Modal ochilganda initializ ────────────────────
function initExpModal() {
  setTimeout(() => {
    if ($("ax-date") && !$("ax-date").value) $("ax-date").value = today();
    initExpWhoSelect();
    renderExpExtraField($("exp-cat-val")?.value || "Ijara");
  }, 30);
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

  const msg = `"${supplier}" ga ${fmt(totalDebt)} so'm to'lansinmi?\n(${sups.length} ta partiya to'langan deb belgilanadi)`;
  if (!confirm(msg)) return;

  // Xarajatlarga qo'shamiz
  if (!db.xarajatlar) db.xarajatlar = [];
  db.xarajatlar.push({
    id:        db.seq++,
    date:      today(),
    category:  "Yetkazuvchi",
    amount:    totalDebt,
    recipient: supplier,
    paidBy:    "kassa",
    note:      `${supplier} — ${sups.length} ta partiya uchun qarz to'lovi`
  });

  // Ombordagi partiyalarni to'langan deb belgilaymiz
  sups.forEach(o => { o.payStatus = "tolandan"; });

  saveDB();
  renderMoliya();
  toast(`✅ "${supplier}" ga ${fmt(totalDebt)} so'm to'landi. ${sups.length} ta partiya to'langan deb belgilandi.`);
}