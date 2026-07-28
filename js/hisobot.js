// MERX hisobot.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/hisobot.js  (v2)
// ================================================

let repRange  = "today"; // v144 (№14): standart Bugun
let _repCharts = {};

function setRepRange(r) {
  repRange = r;
  if (r !== "custom") {
    const f = $("rep-date-from"), t = $("rep-date-to");
    if (f) f.value = ""; if (t) t.value = "";
  }
  document.querySelectorAll(".rfbtn").forEach(b => {
    const on = b.dataset.r === r;
    b.classList.toggle("on", on);
    b.style.background = on ? "#0D1B2A" : "transparent";
    b.style.color = on ? "#fff" : "var(--mut)";
  });
  renderHisobot();
}

function setRepCustomRange() {
  const from = ($("rep-date-from")||{value:""}).value;
  const to   = ($("rep-date-to")||{value:""}).value;
  if (!from && !to) return;
  repRange = "custom";
  document.querySelectorAll(".rfbtn").forEach(b => {
    b.classList.remove("on");
    b.style.background = "transparent";
    b.style.color = "var(--mut)";
  });
  renderHisobot();
}

// ── Davr oralig'ini hisoblash ─────────────────────
function repDateRange() {
  const t = today();
  if (repRange === "yesterday") return { from: addDays(t,-1), to: addDays(t,-1) };
  if (repRange === "today")     return { from: t, to: t };
  if (repRange === "week")      return { from: addDays(t,-6), to: t };
  if (repRange === "month")     return { from: t.slice(0,7)+"-01", to: t };
  if (repRange === "quarter")   return { from: addDays(t,-89), to: t };
  if (repRange === "year")      return { from: t.slice(0,4)+"-01-01", to: t };
  if (repRange === "custom") {
    const from = ($("rep-date-from")||{value:""}).value;
    const to   = ($("rep-date-to")||{value:""}).value;
    return { from: from||t, to: to||t };
  }
  return { from: "2000-01-01", to: t };
}

function repSales() {
  const { from, to } = repDateRange();
  return activeSales().filter(s => s.date >= from && s.date <= to);
}

// ── Asosiy render ─────────────────────────────────
function renderHisobot() {
  const sales   = repSales();
  const rate    = db.settings?.rate || 12800;
  const { from, to } = repDateRange();

  // KPI
  const cnt  = sales.length;
  const rev  = sales.reduce((a, s) => a + (s.total||0), 0);
  const debt = sales.reduce((a, s) => a + calcSaleState(s).remaining, 0);

  // Kassaga tushdi — moliya bilan BIR XIL mantiq:
  // payBreakdown + debtPayments (qarz to'lovlari ham)
  let paid = 0;
  sales.forEach(s => {
    const pb = s.payBreakdown;
    if (pb && (pb.naqd||pb.karta||pb.otkazma)) {
      paid += (pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
    } else {
      paid += s.payType==="nasiya" ? 0 : (s.paid||0);
    }
  });
  // 2026-07-25: qaytarish hisobidan yopilgan qarz TUSHUM emas
  const debtPaid = cashPays().filter(p=>p.date>=from&&p.date<=to)
    .reduce((a,p)=>a+(p.currency==="usd"?Math.round(p.amount*rate):(p.amount||0)),0);
  paid += debtPaid;

  // Foyda hisoblash
  let costTotal = 0, grossProfit = 0, realProfit = 0;

  sales.forEach(s => {
    let saleCost = 0;
    s.items?.forEach(item => {
      const p = (db.products||[]).find(x => x.name === item.name);
      if (!p) return;
      const costUzs = Math.round((p.costUsd||0) * rate);
      saleCost += costUzs * (item.qty||0);
    });
    costTotal   += saleCost;
    grossProfit += (s.total||0) - saleCost;
    // Checkout to'lovi — payBreakdown orqali (aralash to'lov to'g'ri)
    const sPaid = (() => {
      const pb = s.payBreakdown;
      if (pb && (pb.naqd||pb.karta||pb.otkazma)) return (pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
      return s.payType==="nasiya" ? 0 : (s.paid||0);
    })();
    const paidRatio = s.total>0 ? sPaid/s.total : 0;
    realProfit += ((s.total||0) - saleCost) * paidRatio;
  });
  // Qarz to'lovlaridan foyda ulushi
  const grossMargin = (rev > 0) ? grossProfit/rev : 0;
  realProfit += debtPaid * grossMargin;
  grossProfit = Math.round(grossProfit);
  realProfit  = Math.round(realProfit);
  const margin     = rev  > 0 ? Math.round(grossProfit/rev*100)  : 0;
  const realMargin = paid > 0 ? Math.round(realProfit/paid*100) : 0;

  if ($("rep-cnt"))  $("rep-cnt").textContent  = cnt + " ta";
  if ($("rep-rev"))  $("rep-rev").textContent  = fmtK(rev)  + " so'm";
  if ($("rep-paid")) $("rep-paid").textContent = fmtK(paid) + " so'm";
  if ($("rep-debt")) $("rep-debt").textContent = fmtK(debt) + " so'm";

  // Foyda KPI — hisoblangan (barcha sotuv asosida)
  if ($("rep-profit")) {
    $("rep-profit").textContent = fmtK(grossProfit) + " so'm";
    $("rep-profit").style.color = grossProfit >= 0 ? "var(--grn)" : "var(--red)";
  }
  if ($("rep-margin")) {
    $("rep-margin").textContent = margin + "%";
    $("rep-margin").style.color = margin >= 20 ? "var(--grn)" : margin >= 10 ? "#E07B39" : "var(--red)";
  }
  // Kassaga tushgan foyda (agar element bor bo'lsa)
  if ($("rep-real-profit")) {
    $("rep-real-profit").textContent = fmtK(realProfit) + " so'm";
    $("rep-real-profit").style.color = realProfit >= 0 ? "var(--grn)" : "var(--red)";
  }
  if ($("rep-real-margin")) {
    $("rep-real-margin").textContent = realMargin + "%";
  }
  // Tannarx jami
  if ($("rep-cost")) $("rep-cost").textContent = fmtK(costTotal) + " so'm";

  // ── Xarajatlar (shu davrdagi) → sof foyda ──────
  const periodExp = (db.xarajatlar||[])
    .filter(x => x.date >= from && x.date <= to)
    .reduce((a, x) => a + (x.amount||0), 0);
  const netProfit = realProfit - periodExp;
  const netMargin = paid > 0 ? Math.round(netProfit / paid * 100) : 0;

  if ($("rep-expenses")) $("rep-expenses").textContent = fmtK(periodExp) + " so'm";
  if ($("rep-net-profit")) {
    $("rep-net-profit").textContent = fmtK(netProfit) + " so'm";
    $("rep-net-profit").style.color = netProfit >= 0 ? "var(--grn)" : "var(--red)";
  }
  if ($("rep-net-margin")) {
    $("rep-net-margin").textContent = netMargin + "%";
    $("rep-net-margin").style.color = netMargin >= 15 ? "var(--grn)" : netMargin >= 5 ? "#E07B39" : "var(--red)";
  }

  // ── Ombor qiymati ───────────────────────────────
  const omborCost = (db.products||[]).reduce((a, p) => {
    const costUzs = Math.round((p.costUsd||0) * rate);
    return a + costUzs * (p.variants||[]).reduce((b,v)=>b+(v.qty||0),0);
  }, 0);
  const omborSellVal = (db.products||[]).reduce((a, p) => {
    return a + (p.priceUzs||0) * (p.variants||[]).reduce((b,v)=>b+(v.qty||0),0);
  }, 0);
  if ($("rep-ombor-cost"))   $("rep-ombor-cost").textContent   = fmtK(omborCost) + " so'm";
  if ($("rep-ombor-sell"))   $("rep-ombor-sell").textContent   = fmtK(omborSellVal) + " so'm";
  if ($("rep-ombor-profit")) {
    const op = omborSellVal - omborCost;
    $("rep-ombor-profit").textContent = fmtK(op) + " so'm";
    $("rep-ombor-profit").style.color = op >= 0 ? "var(--grn)" : "var(--red)";
  }

  renderRepExpenseChart(periodExp, costTotal, realProfit);
  renderRepTrendChart(sales);
  renderRepPayChart(sales);
  renderRepProducts(sales, rev);
  renderRepCustomers(sales);
  renderRepPriceType(sales);
  renderRepStaff(sales);
  renderRepGrowth(rev, cnt);
  renderRepHourly(sales);
  renderRepTurnover(sales);
  renderRepABC(sales);
  renderRepCustomerSegment(sales);
  applyRepKpiVisibility();
}

// ── Sotuv dinamikasi grafigi ──────────────────────
let _repTrendChart = null;
function renderRepTrendChart(sales) {
  const el = $("repTrendChart"); if (!el || typeof Chart === "undefined") return;
  if (_repTrendChart) { _repTrendChart.destroy(); _repTrendChart = null; }

  const { from, to } = repDateRange();
  const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;

  // Kunlik guruhlash
  const byDate = {};
  sales.forEach(s => { byDate[s.date] = (byDate[s.date]||0) + (s.total||0); });

  let labels = [], data = [];
  for (let i = 0; i < Math.min(days, 90); i++) {
    const d = addDays(from, i);
    if (d > to) break;
    labels.push(d.slice(5)); // MM-DD
    data.push(byDate[d] || 0);
  }

  _repTrendChart = new Chart(el, {
    type: days <= 31 ? "bar" : "line",
    data: {
      labels,
      datasets: [{ data, borderColor:"#E9A500", backgroundColor: days<=31 ? "#E9A50060":"rgba(233,165,0,.15)",
        fill: true, tension: .3, borderRadius: 4, borderWidth: days<=31?0:2, pointRadius: days<=31?0:2 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>fmtK(c.parsed.y)+" so'm"}}},
      scales:{y:{ticks:{callback:v=>fmtK(v)},grid:{color:"#F0EEE8"}},x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:10}}}
    }
  });
}

// ── To'lov usullari diagrammasi ───────────────────
let _repPayChart = null;
function renderRepPayChart(sales) {
  const el = $("repPayChart"); if (!el || typeof Chart === "undefined") return;
  if (_repPayChart) { _repPayChart.destroy(); _repPayChart = null; }
  const legEl = $("rep-pay-legend");

  const rate = db.settings?.rate || 12800;
  const methods = { naqd:0, karta:0, nasiya:0 };
  sales.forEach(s => {
    const amt = s.total || 0;
    const pay = s.payType || "naqd";
    if (pay === "nasiya" || s.status === "qarz") methods.nasiya += amt;
    else if (pay === "karta") methods.karta += amt;
    else methods.naqd += amt;
  });

  const labels  = ["Naqd","Karta","Nasiya"];
  const data    = [methods.naqd, methods.karta, methods.nasiya];
  const colors  = ["#36B48C","#4C9BE8","#E05A5A"];
  const total   = data.reduce((a,b)=>a+b,0)||1;

  if (legEl) legEl.innerHTML = labels.map((l,i)=>
    `<span style="display:flex;align-items:center;gap:5px">
      <span style="width:10px;height:10px;border-radius:50%;background:${colors[i]};flex-shrink:0"></span>
      <span style="font-size:12px;color:#555">${l}</span>
      <strong style="font-size:12px">${Math.round(data[i]/total*100)}%</strong>
    </span>`).join("");

  _repPayChart = new Chart(el, {
    type:"doughnut",
    data:{ labels, datasets:[{ data, backgroundColor:colors, borderWidth:2, borderColor:"#fff" }]},
    options:{
      responsive:true, maintainAspectRatio:false, cutout:"60%",
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>`${c.label}: ${fmtK(c.parsed)}  (${Math.round(c.parsed/total*100)}%)`}}}
    }
  });
}

// ── Top mahsulotlar ───────────────────────────────
function renderRepProducts(sales, totalRev) {
  const el = $("rep-products"); if (!el) return;
  const prods = {};
  sales.forEach(s => s.items?.forEach(i => {
    if (!prods[i.name]) prods[i.name] = { qty:0, total:0 };
    prods[i.name].qty   += i.qty || 0;
    prods[i.name].total += (i.price||0) * (i.qty||0);
  }));

  const sorted = Object.entries(prods).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
  if (!sorted.length) { el.innerHTML=`<tr><td colspan="4" class="empty-td">Ma'lumot yo'q</td></tr>`; return; }

  el.innerHTML = sorted.map(([name,d],i) => {
    const pct = totalRev>0 ? Math.round(d.total/totalRev*100) : 0;
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;color:#bbb;font-weight:700;width:16px">${i+1}</span>
          <span style="font-weight:600;font-size:13px">${name}</span>
        </div>
      </td>
      <td class="num">${d.qty} ta</td>
      <td class="num" style="font-weight:700;color:var(--acc)">${fmtK(d.total)} so'm</td>
      <td class="num">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:6px;background:#f0ede7;border-radius:3px;min-width:50px">
            <div style="height:100%;width:${pct}%;background:var(--acc);border-radius:3px"></div>
          </div>
          <span style="font-size:11.5px;color:#888;width:28px;text-align:right">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ── Top mijozlar ──────────────────────────────────
function renderRepCustomers(sales) {
  const el = $("rep-customers"); if (!el) return;
  const custs = {};
  sales.forEach(s => {
    const name = s.customerName || "Noma'lum";
    if (!custs[name]) custs[name] = { cnt:0, total:0, debt:0 };
    custs[name].cnt++;
    custs[name].total += s.total || 0;
    custs[name].debt  += calcSaleState(s).remaining;
  });

  const sorted = Object.entries(custs).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
  if (!sorted.length) { el.innerHTML=`<tr><td colspan="4" class="empty-td">Ma'lumot yo'q</td></tr>`; return; }

  el.innerHTML = sorted.map(([name,d],i) => `<tr>
    <td>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;color:#bbb;font-weight:700;width:16px">${i+1}</span>
        <span style="font-weight:600">${name}</span>
      </div>
    </td>
    <td class="num">${d.cnt} ta</td>
    <td class="num" style="font-weight:700">${fmtK(d.total)} so'm</td>
    <td class="num" style="color:${d.debt>0?"var(--red)":"var(--grn)"};font-weight:${d.debt>0?"700":"400"}">
      ${d.debt>0?fmtK(d.debt)+" so'm":"✅"}
    </td>
  </tr>`).join("");
}

// ── Qarz tushumi (to'lov usuli) ───────────────────
function renderRepPriceType(sales) {
  const el = $("rep-pricetype"); if (!el) return;
  const { from, to } = repDateRange();
  const rate = db.settings?.rate || 12800;

  // 2026-07-25: qaytarish hisobidan yopilgan qarz to'lov USULI emas
  const payments = cashPays().filter(p => p.date >= from && p.date <= to);
  const toUzs = p => p.currency==="usd" ? p.amount*rate : p.amount;
  const methodColors = { naqd:"#36B48C", karta:"#4C9BE8", otkazma:"#8B5CF6", balans:"#E9A500" };
  const methodLabels = { naqd:"💵 Naqd", karta:"💳 Karta", otkazma:"🏦 O'tkazma", balans:"💰 Balansdan" };

  const byMethod = {};
  payments.forEach(p => {
    // v145 (audit): ARALASH to'lov usullarga BO'LINADI (methodBreakdown,
    // so'mda saqlanadi) — endi doira "Naqd"i KPI "Naqd tushdi" bilan mos.
    // amountSom (v165) — kiritilgan asl so'm, yaxlitlash adashuvi yo'q.
    const somAmt = p.amountSom || (p.currency === 'usd' ? Math.round((p.amount||0) * rate) : (p.amount || 0));
    const mb = p.methodBreakdown;
    const mbHas = mb && Object.keys(mb).some(k => (mb[k]||0) > 0);
    if (mbHas) {
      Object.keys(mb).forEach(k => { if ((mb[k]||0) > 0) byMethod[k] = (byMethod[k] || 0) + (mb[k]||0); });
    } else {
      const m = p.method || 'naqd';
      byMethod[m] = (byMethod[m] || 0) + somAmt;
    }
  });
  const total = Object.values(byMethod).reduce((a,b)=>a+b,0);

  if (!total) { el.innerHTML=`<tr><td colspan="3" class="empty-td">Shu davrda to'lov bo'lmagan</td></tr>`; return; }

  el.innerHTML = Object.entries(byMethod).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])
    .map(([key,val]) => {
      const pct = Math.round(val/total*100);
      const color = methodColors[key]||"#aaa";
      return `<tr>
        <td><span style="display:flex;align-items:center;gap:6px">
          <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
          ${methodLabels[key]||key}
        </span></td>
        <td class="num" style="font-weight:700">${fmtK(val)} so'm</td>
        <td class="num">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:7px;background:#f0ede7;border-radius:4px;min-width:60px">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:4px"></div>
            </div>
            <span style="font-size:12px;font-weight:700;width:32px;text-align:right">${pct}%</span>
          </div>
        </td>
      </tr>`;
    }).join("");
}

const REP_KPI_LABELS = {
  cnt:"Sotuvlar soni", rev:"Jami sotuv", paid:"Kassaga tushdi", debt:"Qolgan qarz",
  profit:"Hisoblangan foyda", realprofit:"Kassaga tushgan foyda", margin:"Margin",
  cost:"Jami tannarx", expenses:"Xarajatlar", netprofit:"Sof foyda", netmargin:"Sof margin"
};

function hideRepKpi(key) {
  if (!db.settings) db.settings={};
  const h=new Set(db.settings.hiddenRepKpis||[]);
  h.add(key); db.settings.hiddenRepKpis=[...h]; saveDB(); applyRepKpiVisibility();
}
function showRepKpi(key) {
  if (!db.settings) db.settings={};
  const h=new Set(db.settings.hiddenRepKpis||[]);
  h.delete(key); db.settings.hiddenRepKpis=[...h]; saveDB(); applyRepKpiVisibility();
}
function applyRepKpiVisibility() {
  const hidden=new Set(db.settings?.hiddenRepKpis||[]);
  document.querySelectorAll("#rep-kpis .kpi").forEach(el=>{
    el.style.display=hidden.has(el.dataset.kpi)?"none":"block";
  });
}
function openRepKpiSettings() {
  const hidden=new Set(db.settings?.hiddenRepKpis||[]);
  const list=$("rep-kpi-settings-list"); if(!list) return;
  list.innerHTML=Object.entries(REP_KPI_LABELS).map(([k,l])=>`
    <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--brd);border-radius:9px;cursor:pointer">
      <input type="checkbox" ${!hidden.has(k)?"checked":""} onchange="this.checked?showRepKpi('${k}'):hideRepKpi('${k}')"
        style="width:17px;height:17px;accent-color:var(--acc);cursor:pointer">
      <span style="font-size:13px;font-weight:600">${l}</span>
    </label>`).join("");
  openModal("repkpi");
}

// ── O'sish taqqoslovi ─────────────────────────────
function renderRepGrowth(curRev, curCnt) {
  const el = document.getElementById("rep-growth"); if (!el) return;
  const { from, to } = repDateRange();
  const diff = new Date(to) - new Date(from);
  const prevTo   = addDays(from, -1);
  const prevFrom = addDays(prevTo, -Math.round(diff/86400000));
  const prevSales = activeSales().filter(s => s.date >= prevFrom && s.date <= prevTo);
  const prevRev   = prevSales.reduce((a,s)=>a+(s.total||0),0);
  const prevCnt   = prevSales.length;

  const revGrowth = prevRev > 0 ? Math.round((curRev - prevRev)/prevRev*100) : null;
  const cntGrowth = prevCnt > 0 ? Math.round((curCnt - prevCnt)/prevCnt*100) : null;

  el.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px">
        <div style="font-size:11px;color:var(--mut);margin-bottom:3px">Avvalgi davr sotuv</div>
        <div style="font-size:14px;font-weight:700">${fmtK(prevRev)} so'm</div>
        ${revGrowth !== null ? `<div style="font-size:12px;font-weight:700;color:${revGrowth>=0?"var(--grn)":"var(--red)"}">
          ${revGrowth>=0?"▲":"▼"} ${Math.abs(revGrowth)}% o'zgarish</div>` : ""}
      </div>
      <div style="flex:1;min-width:120px">
        <div style="font-size:11px;color:var(--mut);margin-bottom:3px">Avvalgi davr sotuvlar</div>
        <div style="font-size:14px;font-weight:700">${prevCnt} ta</div>
        ${cntGrowth !== null ? `<div style="font-size:12px;font-weight:700;color:${cntGrowth>=0?"var(--grn)":"var(--red)"}">
          ${cntGrowth>=0?"▲":"▼"} ${Math.abs(cntGrowth)}% o'zgarish</div>` : ""}
      </div>
    </div>`;
}

// ── Kassir tahlili ────────────────────────────────
// ══════════════════════════════════════════════════
// ── Pul oqimi grafigi va xarajat kategoriyalari ───
let _repExpChart = null;
function renderRepExpenseChart(periodExp, costTotal, realProfit) {
  const el = $("rep-expense-chart"); if (!el || typeof Chart === "undefined") return;
  if (_repExpChart) { _repExpChart.destroy(); _repExpChart = null; }

  const { from, to } = repDateRange();
  const exps = (db.xarajatlar||[]).filter(x => x.date >= from && x.date <= to);
  const byCat = {};
  exps.forEach(x => { const c = x.category||"Boshqa"; byCat[c]=(byCat[c]||0)+(x.amount||0); });

  const catEl = $("rep-expense-cats");
  if (catEl) {
    const total = Object.values(byCat).reduce((a,b)=>a+b,0)||1;
    catEl.innerHTML = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt]) => `
      <tr>
        <td style="font-weight:600">${cat}</td>
        <td class="num" style="font-weight:700;color:var(--red)">${fmtK(amt)} so'm</td>
        <td class="num">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:6px;background:#f0ede7;border-radius:4px;min-width:60px">
              <div style="height:100%;width:${Math.round(amt/total*100)}%;background:var(--red);border-radius:4px"></div>
            </div>
            <span style="font-size:11.5px;font-weight:700;width:30px">${Math.round(amt/total*100)}%</span>
          </div>
        </td>
      </tr>`).join("") || `<tr><td colspan="3" class="empty-td">Shu davrda xarajat yo'q</td></tr>`;
  }

  const kassaTushdi = Math.max(0, realProfit + periodExp);
  _repExpChart = new Chart(el, {
    type: "bar",
    data: {
      labels: ["Kassaga tushdi", "Xarajatlar", "Tovar tannarxi"],
      datasets: [{ data: [kassaTushdi, periodExp, costTotal],
        backgroundColor: ["#36B48C", "#E05A5A", "#8B5CF6"],
        borderRadius: 6, borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{display:false}, tooltip:{ callbacks:{ label: c=>fmtK(c.parsed.y)+" so'm" }}},
      scales: { y:{ ticks:{callback:v=>fmtK(v)}, grid:{color:"#F0EEE8"}}, x:{grid:{display:false}}}
    }
  });
}

// 1. SOAT BO'YICHA TAHLIL
// ══════════════════════════════════════════════════
let _repHourChart = null;
function renderRepHourly(sales) {
  const el = $("rep-hourly-chart"); if (!el || typeof Chart === "undefined") return;
  if (_repHourChart) { _repHourChart.destroy(); _repHourChart = null; }

  const hours = Array(24).fill(0);
  const counts = Array(24).fill(0);
  sales.forEach(s => {
    if (!s.time) return;
    const h = parseInt(s.time.split(":")[0]);
    if (h >= 0 && h < 24) { hours[h] += s.total || 0; counts[h]++; }
  });

  const labels = hours.map((_, i) => `${String(i).padStart(2,"0")}:00`);
  const peakHour = hours.indexOf(Math.max(...hours));
  if ($("rep-peak-hour")) $("rep-peak-hour").textContent =
    `${String(peakHour).padStart(2,"0")}:00–${String(peakHour+1).padStart(2,"0")}:00`;
  if ($("rep-peak-cnt")) $("rep-peak-cnt").textContent = counts[peakHour] + " ta sotuv";

  _repHourChart = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: hours,
        backgroundColor: hours.map((_,i) => i === peakHour ? "#E9A500" : "#4C9BE840"),
        borderRadius: 4, borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: c => fmtK(c.parsed.y) + " so'm | " + counts[c.dataIndex] + " ta" }}},
      scales: {
        y: { ticks: { callback: v => fmtK(v) }, grid: { color: "#F0EEE8" }},
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }}
      }
    }
  });
}

// ══════════════════════════════════════════════════
// 2. TOVAR AYLANMASI — eng sekin/tez ketuvchilar
// ══════════════════════════════════════════════════
function renderRepTurnover(sales) {
  const el = $("rep-turnover"); if (!el) return;
  const { from, to } = repDateRange();
  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const rate = db.settings?.rate || 12800;

  // Sotilgan miqdor (davr ichida)
  const soldQty = {};
  sales.forEach(s => s.items?.forEach(i => {
    soldQty[i.name] = (soldQty[i.name]||0) + (i.qty||0);
  }));

  // Joriy zaxira + aylanma hisobi
  const rows = (db.products||[]).map(p => {
    const totalQty = (p.variants||[]).reduce((a,v) => a + (v.qty||0), 0);
    const sold = soldQty[p.name] || 0;
    // Kunlik sotish tezligi
    const dailyRate = sold / days;
    // Necha kunda tugaydi (0 = tez tugaydi, null = umuman sotilmadi)
    const daysLeft = dailyRate > 0 ? Math.round(totalQty / dailyRate) : null;
    const costUzs = Math.round((p.costUsd||0) * rate);
    return { name: p.name, qty: totalQty, sold, dailyRate, daysLeft, stockVal: costUzs * totalQty };
  }).filter(r => r.qty > 0 || r.sold > 0);

  if (!rows.length) {
    el.innerHTML = `<tr><td colspan="5" class="empty-td">Ma'lumot yo'q</td></tr>`; return;
  }

  // Eng sekin aylanadigan (zaxirada ko'p, kam sotiladi)
  const sorted = rows.sort((a,b) => {
    if (a.daysLeft === null && b.daysLeft === null) return b.qty - a.qty;
    if (a.daysLeft === null) return 1;
    if (b.daysLeft === null) return -1;
    return b.daysLeft - a.daysLeft;
  });

  el.innerHTML = sorted.slice(0, 15).map(r => {
    const badge = r.daysLeft === null
      ? `<span class="bg bg-r" style="font-size:11px">Sotilmayapti</span>`
      : r.daysLeft <= 7
        ? `<span class="bg bg-g" style="font-size:11px">Tez ketmoqda</span>`
        : r.daysLeft <= 30
          ? `<span class="bg bg-a" style="font-size:11px">${r.daysLeft} kun</span>`
          : `<span class="bg" style="font-size:11px;color:#888">${r.daysLeft} kun</span>`;
    return `<tr>
      <td style="font-weight:600">${r.name}</td>
      <td class="num">${r.qty} ta</td>
      <td class="num" style="color:var(--grn)">${r.sold > 0 ? r.sold + " ta" : "—"}</td>
      <td class="num">${r.dailyRate > 0 ? r.dailyRate.toFixed(1) + "/kun" : "—"}</td>
      <td>${badge}</td>
    </tr>`;
  }).join("");
}

// ══════════════════════════════════════════════════
// 3. ABC TAHLIL — 80/15/5 qoida
// ══════════════════════════════════════════════════
function renderRepABC(sales) {
  const el = $("rep-abc"); if (!el) return;

  const prods = {};
  sales.forEach(s => s.items?.forEach(i => {
    if (!prods[i.name]) prods[i.name] = { qty: 0, total: 0 };
    prods[i.name].qty   += i.qty || 0;
    prods[i.name].total += (i.price||0) * (i.qty||0);
  }));

  const totalRev = Object.values(prods).reduce((a,p) => a + p.total, 0);
  if (!totalRev) { el.innerHTML = `<tr><td colspan="5" class="empty-td">Ma'lumot yo'q</td></tr>`; return; }

  let cumulative = 0;
  const sorted = Object.entries(prods)
    .sort((a,b) => b[1].total - a[1].total)
    .map(([name, d]) => {
      const pct = d.total / totalRev * 100;
      cumulative += pct;
      const cls = cumulative <= 80 ? "A" : cumulative <= 95 ? "B" : "C";
      return { name, qty: d.qty, total: d.total, pct, cumulative, cls };
    });

  const clsColor = { A: "var(--grn)", B: "#E9A500", C: "var(--red)" };
  el.innerHTML = sorted.map(r => `<tr>
    <td>
      <span style="display:inline-block;width:22px;height:22px;border-radius:50%;
        background:${clsColor[r.cls]};color:#fff;font-size:11px;font-weight:800;
        text-align:center;line-height:22px;margin-right:6px">${r.cls}</span>
      <span style="font-weight:600">${r.name}</span>
    </td>
    <td class="num">${r.qty} ta</td>
    <td class="num" style="font-weight:700">${fmtK(r.total)} so'm</td>
    <td class="num">${r.pct.toFixed(1)}%</td>
    <td class="num" style="color:#aaa">${r.cumulative.toFixed(1)}%</td>
  </tr>`).join("");
}

// ══════════════════════════════════════════════════
// 4. MIJOZ SEGMENTATSIYASI — yangi vs qaytuvchi
// ══════════════════════════════════════════════════
function renderRepCustomerSegment(sales) {
  const el = $("rep-cust-segment"); if (!el) return;
  const { from } = repDateRange();

  // Barcha vaqtdagi sotuvlardan shu davrdan OLDINGI xarid qilgan mijozlar
  const prevBuyers = new Set(
    activeSales().filter(s => s.date < from && s.customerName)
      .map(s => s.customerName)
  );

  let newCnt = 0, retCnt = 0, newRev = 0, retRev = 0;
  const custMap = {};
  sales.forEach(s => {
    const name = s.customerName || "Noma'lum";
    if (!custMap[name]) custMap[name] = { total: 0, cnt: 0, isNew: !prevBuyers.has(name) };
    custMap[name].total += s.total || 0;
    custMap[name].cnt++;
  });

  Object.values(custMap).forEach(c => {
    if (c.isNew) { newCnt++; newRev += c.total; }
    else { retCnt++; retRev += c.total; }
  });

  const total = newRev + retRev || 1;
  el.innerHTML = `
    <tr>
      <td><span class="bg bg-g" style="font-size:12px">🆕 Yangi mijoz</span></td>
      <td class="num" style="font-weight:700">${newCnt} ta</td>
      <td class="num" style="font-weight:700;color:var(--grn)">${fmtK(newRev)} so'm</td>
      <td class="num">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:7px;background:#f0ede7;border-radius:4px">
            <div style="height:100%;width:${Math.round(newRev/total*100)}%;background:var(--grn);border-radius:4px"></div>
          </div>
          <span style="font-size:12px;font-weight:700;width:32px">${Math.round(newRev/total*100)}%</span>
        </div>
      </td>
    </tr>
    <tr>
      <td><span class="bg bg-a" style="font-size:12px">🔄 Qaytuvchi mijoz</span></td>
      <td class="num" style="font-weight:700">${retCnt} ta</td>
      <td class="num" style="font-weight:700;color:var(--acc)">${fmtK(retRev)} so'm</td>
      <td class="num">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:7px;background:#f0ede7;border-radius:4px">
            <div style="height:100%;width:${Math.round(retRev/total*100)}%;background:var(--acc);border-radius:4px"></div>
          </div>
          <span style="font-size:12px;font-weight:700;width:32px">${Math.round(retRev/total*100)}%</span>
        </div>
      </td>
    </tr>`;
}

// ══════════════════════════════════════════════════
// 5. XODIM CHUQUR TAHLILI — foyda va nasiya ulushi
// ══════════════════════════════════════════════════
function renderRepStaff(sales) {
  const el = $("rep-staff"); if (!el) return;
  const rate = db.settings?.rate || 12800;
  const { from, to } = repDateRange();

  const staffMap = {};
  sales.forEach(s => {
    const name = (db.staff||[]).find(x => x.id === s.staffId)?.name || "Noma'lum";
    if (!staffMap[name]) staffMap[name] = { cnt:0, total:0, kassaTushdi:0, debt:0, cost:0, nasiyaCnt:0 };
    staffMap[name].cnt++;
    staffMap[name].total += s.total || 0;
    // kassaTushdi — payBreakdown asosida
    const pb = s.payBreakdown;
    if (pb&&(pb.naqd||pb.karta||pb.otkazma))
      staffMap[name].kassaTushdi += (pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
    else staffMap[name].kassaTushdi += s.payType==="nasiya"?0:(s.paid||0);
    if (s.payType==="nasiya") staffMap[name].nasiyaCnt++;
    staffMap[name].debt += calcSaleState(s).remaining;
    s.items?.forEach(i => {
      const p = (db.products||[]).find(x => x.name === i.name);
      staffMap[name].cost += Math.round((p?.costUsd||0)*rate)*(i.qty||0);
    });
  });
  // debtPayments ham qo'shamiz
  // 2026-07-25: xodim "kassaga tushirgan" summasiga qaytarish kirmaydi
  const debtPays = cashPays().filter(p=>p.date>=from&&p.date<=to);
  debtPays.forEach(p => {
    const sale = (db.sales||[]).find(s=>s.id===p.saleId); if(!sale) return;
    const name = (db.staff||[]).find(x=>x.id===sale.staffId)?.name||"Noma'lum";
    if (staffMap[name]) staffMap[name].kassaTushdi +=
      p.currency==="usd"?Math.round(p.amount*rate):(p.amount||0);
  });

  const sorted = Object.entries(staffMap).sort((a,b)=>b[1].kassaTushdi-a[1].kassaTushdi);
  if (!sorted.length) {
    el.innerHTML=`<tr><td colspan="7" class="empty-td">Ma'lumot yo'q</td></tr>`; return;
  }
  const totalKassa = sorted.reduce((a,[,d])=>a+d.kassaTushdi,0)||1;

  el.innerHTML = sorted.map(([name,d]) => {
    const avg      = d.cnt ? Math.round(d.total/d.cnt) : 0;
    const grossPro = d.kassaTushdi - d.cost;
    const nasiyaPct= d.cnt ? Math.round(d.nasiyaCnt/d.cnt*100) : 0;
    const pct      = Math.round(d.kassaTushdi/totalKassa*100);
    return `<tr>
      <td style="font-weight:700">${name}</td>
      <td class="num">${d.cnt} ta</td>
      <td class="num" style="font-weight:700;color:var(--acc)">${fmtK(d.kassaTushdi)} so'm</td>
      <td class="num" style="color:var(--mut)">${fmtK(avg)} so'm</td>
      <td class="num" style="color:${grossPro>=0?"var(--grn)":"var(--red)"};font-weight:700">${fmtK(grossPro)} so'm</td>
      <td class="num" style="color:${nasiyaPct>30?"var(--red)":nasiyaPct>10?"#E9A500":"var(--grn)"}">
        ${nasiyaPct}%
      </td>
      <td class="num">
        <div style="display:flex;align-items:center;gap:5px">
          <div style="flex:1;height:6px;background:#f0ede7;border-radius:3px;min-width:50px">
            <div style="height:100%;width:${pct}%;background:var(--acc);border-radius:3px"></div>
          </div>
          <span style="font-size:11px;color:#888;width:26px">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ── Excel eksport ─────────────────────────────────
// Har bir tahlil uchun alohida CSV yuklab olinadi

// ── Hisobotni chop etish ─────────────────────────
function printHisobot() { window.print(); }

function exportHisobotExcel() {
  // 1. Asosiy sotuv tarixi
  const { from, to } = repDateRange();
  const sales = repSales();
  const rate  = db.settings?.rate || 12800;

  const rows = [["Sana","Vaqt","Kassir","Mijoz","Telefon","Mahsulotlar","Jami","To'landi","Qarz","To'lov turi","Narx turi","Holat"]];
  sales.forEach(s => {
    const staffName = (db.staff||[]).find(x=>x.id===s.staffId)?.name || "—";
    const items = (s.items||[]).map(i=>i.name+"×"+i.qty).join(", ");
    const st = calcSaleState(s);
    rows.push([s.date||"", s.time||"", staffName, s.customerName||"—", s.customerPhone||"",
      items, s.total||0, s.paid||0, st.remaining||0, s.payType||"", s.priceType||"",
      s.status==="qarz"?"Qarzda":s.status==="qaytarilgan"?"Qaytarilgan":"To'langan"]);
  });
  downloadCSV(rows, `merx_sotuv_${from}_${to}.xls`);
  toast("✅ Sotuv hisoboti yuklab olindi");
}

function exportHisobotProductsExcel() {
  // 2. Top mahsulotlar (ABC tahlil bilan)
  const { from, to } = repDateRange();
  const sales = repSales();

  const prods = {};
  sales.forEach(s => s.items?.forEach(i => {
    if (!prods[i.name]) prods[i.name] = { qty:0, total:0 };
    prods[i.name].qty   += i.qty||0;
    prods[i.name].total += (i.price||0)*(i.qty||0);
  }));
  const totalRev = Object.values(prods).reduce((a,p)=>a+p.total,0)||1;
  let cum = 0;
  const rows = [["Mahsulot","Soni","Sotuv summasi","Ulush %","Kumulativ %","ABC sinf"]];
  Object.entries(prods).sort((a,b)=>b[1].total-a[1].total).forEach(([name,d]) => {
    const pct = Math.round(d.total/totalRev*100*10)/10;
    cum += pct;
    const cls = cum<=80?"A":cum<=95?"B":"C";
    rows.push([name, d.qty, d.total, pct, Math.round(cum*10)/10, cls]);
  });
  downloadCSV(rows, `merx_mahsulotlar_${from}_${to}.xls`);
  toast("✅ Mahsulotlar hisoboti yuklab olindi");
}

function exportHisobotStaffExcel() {
  // 3. Kassirlar tahlili
  const { from, to } = repDateRange();
  const sales = repSales();
  const rate  = db.settings?.rate || 12800;

  const staffMap = {};
  sales.forEach(s => {
    const name = (db.staff||[]).find(x=>x.id===s.staffId)?.name||"Noma'lum";
    if (!staffMap[name]) staffMap[name]={cnt:0,total:0,paid:0,debt:0,cost:0};
    staffMap[name].cnt++;
    staffMap[name].total += s.total||0;
    staffMap[name].paid  += s.paid||0;
    staffMap[name].debt  += calcSaleState(s).remaining;
    s.items?.forEach(i=>{
      const p=(db.products||[]).find(x=>x.name===i.name);
      staffMap[name].cost += Math.round((p?.costUsd||0)*rate)*(i.qty||0);
    });
  });

  const rows = [["Kassir","Sotuvlar","Jami sotuv","O'rtacha chek","Kassaga tushgan foyda","Nasiya %","Ulush %"]];
  const totalRev = Object.values(staffMap).reduce((a,d)=>a+d.total,0)||1;
  Object.entries(staffMap).sort((a,b)=>b[1].total-a[1].total).forEach(([name,d]) => {
    const avg = d.cnt?Math.round(d.total/d.cnt):0;
    const profit = d.paid-d.cost;
    const debtPct = d.total>0?Math.round(d.debt/d.total*100):0;
    rows.push([name, d.cnt, d.total, avg, profit, debtPct, Math.round(d.total/totalRev*100)]);
  });
  downloadCSV(rows, `merx_kassirlar_${from}_${to}.xls`);
  toast("✅ Kassirlar hisoboti yuklab olindi");
}

function exportHisobotExpensesExcel() {
  // 4. Xarajatlar tahlili
  const { from, to } = repDateRange();
  const exps = (db.xarajatlar||[]).filter(x=>x.date>=from&&x.date<=to)
    .sort((a,b)=>a.date>b.date?1:-1);

  const rows = [["Sana","Kategoriya","Summa","Izoh","Kim to'ladi"]];
  exps.forEach(x => rows.push([x.date, x.category||"—", x.amount||0, x.note||"", x.paidBy||"—"]));

  // Kategoriya bo'yicha yig'indi
  rows.push([]);
  rows.push(["--- Kategoriya bo'yicha yig'indi ---"]);
  rows.push(["Kategoriya","Jami"]);
  const byCat={};
  exps.forEach(x=>{const c=x.category||"Boshqa";byCat[c]=(byCat[c]||0)+(x.amount||0);});
  Object.entries(byCat).sort((a,b)=>b[1]-a[1]).forEach(([c,a])=>rows.push([c,a]));
  rows.push(["JAMI", exps.reduce((a,x)=>a+(x.amount||0),0)]);

  downloadCSV(rows, `merx_xarajatlar_${from}_${to}.xls`);
  toast("✅ Xarajatlar hisoboti yuklab olindi");
}

function exportHisobotTurnoverExcel() {
  // 5. Tovar aylanmasi + ombor qiymati
  const { from, to } = repDateRange();
  const sales = repSales();
  const rate  = db.settings?.rate || 12800;
  const days  = Math.max(1, Math.round((new Date(to)-new Date(from))/86400000)+1);

  const soldQty={};
  sales.forEach(s=>s.items?.forEach(i=>{soldQty[i.name]=(soldQty[i.name]||0)+(i.qty||0);}));

  const rows = [["Mahsulot","Joriy zaxira","Sotildi","Kunlik tezlik","Necha kun yetadi","Tannarxi (so'm)","Sotuv narxi (so'm)","Ombor tannarxi","Ombor sotuv qiymati"]];
  (db.products||[]).forEach(p=>{
    const totalQty=(p.variants||[]).reduce((a,v)=>a+(v.qty||0),0);
    const sold=soldQty[p.name]||0;
    const dailyRate=sold/days;
    const daysLeft=dailyRate>0?Math.round(totalQty/dailyRate):null;
    const costUzs=Math.round((p.costUsd||0)*rate);
    rows.push([p.name,totalQty,sold,Math.round(dailyRate*10)/10,daysLeft||"Sotilmayapti",
      costUzs, p.priceUzs||0, costUzs*totalQty, (p.priceUzs||0)*totalQty]);
  });
  rows.push([]);
  const omborCost=(db.products||[]).reduce((a,p)=>a+Math.round((p.costUsd||0)*rate)*(p.variants||[]).reduce((b,v)=>b+(v.qty||0),0),0);
  const omborSell=(db.products||[]).reduce((a,p)=>a+(p.priceUzs||0)*(p.variants||[]).reduce((b,v)=>b+(v.qty||0),0),0);
  rows.push(["JAMI OMBOR TANNARXI", omborCost]);
  rows.push(["JAMI OMBOR SOTUV QIYMATI", omborSell]);
  rows.push(["POTENSIAL FOYDA", omborSell-omborCost]);

  downloadCSV(rows, `merx_ombor_${from}_${to}.xls`);
  toast("✅ Ombor hisoboti yuklab olindi");
}

function exportHisobotCustomersExcel() {
  // 6. Mijozlar tahlili
  const { from, to } = repDateRange();
  const sales = repSales();

  const custs={};
  sales.forEach(s=>{
    const name=s.customerName||"Noma'lum";
    if(!custs[name])custs[name]={cnt:0,total:0,debt:0,phone:s.customerPhone||""};
    custs[name].cnt++;custs[name].total+=s.total||0;
    custs[name].debt+=calcSaleState(s).remaining;
  });

  const rows=[["Mijoz","Telefon","Sotuvlar soni","Jami sotuv","Joriy qarz","O'rtacha chek"]];
  Object.entries(custs).sort((a,b)=>b[1].total-a[1].total).forEach(([name,d])=>{
    rows.push([name,d.phone,d.cnt,d.total,d.debt,d.cnt?Math.round(d.total/d.cnt):0]);
  });
  downloadCSV(rows, `merx_mijozlar_${from}_${to}.xls`);
  toast("✅ Mijozlar hisoboti yuklab olindi");
}
