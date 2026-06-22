// MERX hisobot.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/hisobot.js  (v2)
// ================================================

let repRange  = "week";
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
  return db.sales.filter(s => s.date >= from && s.date <= to);
}

// ── Asosiy render ─────────────────────────────────
function renderHisobot() {
  const sales   = repSales();
  const rate    = db.settings.rate || 12800;

  // KPI
  const cnt     = sales.length;
  const rev     = sales.reduce((a, s) => a + (s.total||0), 0);
  const paid    = sales.reduce((a, s) => a + (s.paid||0), 0);
  // Joriy qoldiq qarz — calcSaleState orqali (to'lovlar hisobga olinadi)
  const debt    = sales.reduce((a, s) => a + calcSaleState(s).remaining, 0);

  // Foyda hisoblash (to'g'ri mantiq)
  // Hisoblangan foyda = sotuv narxi - tannarx (tovar chiqib ketgan)
  // Kassaga tushgan foyda = to'langan qism - tannarx (real kassa)
  let costTotal     = 0;  // jami tannarx (sotilgan tovarlar)
  let grossProfit   = 0;  // hisoblangan foyda (nasiya ham kiradi)
  let realProfit    = 0;  // kassaga tushgan foyda (faqat to'langan)

  sales.forEach(s => {
    let saleCost = 0;
    s.items?.forEach(item => {
      const p = db.products.find(x => x.name === item.name);
      if (!p) return;
      const costUzs = Math.round((p.costUsd || 0) * rate);
      saleCost  += costUzs * (item.qty || 0);
    });
    costTotal   += saleCost;
    // Hisoblangan foyda: sotuv narxi - tannarx
    grossProfit += (s.total || 0) - saleCost;
    // Kassaga tushgan: to'langan qism - (tannarx × to'langan ulush)
    const paidRatio = s.total > 0 ? (s.paid || 0) / s.total : 1;
    realProfit  += ((s.total || 0) - saleCost) * paidRatio;
  });

  grossProfit = Math.round(grossProfit);
  realProfit  = Math.round(realProfit);
  const margin     = rev > 0 ? Math.round(grossProfit / rev * 100) : 0;
  const realMargin = paid > 0 ? Math.round(realProfit / paid * 100) : 0;

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
}

// ── O'sish taqqoslovi ─────────────────────────────
function renderRepGrowth(curRev, curCnt) {
  const el = document.getElementById("rep-growth"); if (!el) return;
  const { from, to } = repDateRange();
  const diff = new Date(to) - new Date(from);
  const prevTo   = addDays(from, -1);
  const prevFrom = addDays(prevTo, -Math.round(diff/86400000));
  const prevSales = db.sales.filter(s => s.date >= prevFrom && s.date <= prevTo);
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
function renderRepStaff(sales) {
  const el = document.getElementById("rep-staff"); if (!el) return;
  if (!db.staff?.length) { el.innerHTML = `<tr><td colspan="5" class="empty-td">Xodimlar yo'q</td></tr>`; return; }

  const staffMap = {};
  sales.forEach(s => {
    const sid = s.staffId;
    if (!staffMap[sid]) staffMap[sid] = { cnt:0, total:0, paid:0, debt:0 };
    staffMap[sid].cnt++;
    staffMap[sid].total += s.total||0;
    staffMap[sid].paid  += s.paid||0;
    staffMap[sid].debt  += s.remaining||0;
  });

  const totalRev = Object.values(staffMap).reduce((a,x)=>a+x.total,0)||1;
  const rows = db.staff.map(s => ({
    ...s, ...(staffMap[s.id]||{cnt:0,total:0,paid:0,debt:0})
  })).sort((a,b)=>b.total-a.total);

  el.innerHTML = rows.map((s,i) => {
    const pct = Math.round((s.total||0)/totalRev*100);
    const avg = s.cnt ? Math.round(s.total/s.cnt) : 0;
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <span style="font-size:11px;color:#bbb;width:16px">${i+1}</span>
          <div>
            <div style="font-weight:600;font-size:13px">${s.name}</div>
            <div style="font-size:11px;color:var(--mut)">${s.role||"kassir"}</div>
          </div>
        </div>
      </td>
      <td class="num">${s.cnt} ta</td>
      <td class="num" style="font-weight:700;color:var(--acc)">${s.total?fmtK(s.total)+" so'm":"—"}</td>
      <td class="num" style="font-size:12px">${avg?fmtK(avg)+" so'm":"—"}</td>
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

// ── Sotuv dinamikasi chart ─────────────────────────
function renderRepTrendChart(sales) {
  const canvas = document.getElementById("repTrendChart");
  if (!canvas) return;

  // Eski chart ni yo'q qilish
  if (_repCharts.trend) { _repCharts.trend.destroy(); delete _repCharts.trend; }

  const { from, to } = repDateRange();
  const days = [];
  let cur = from;
  while (cur <= to && days.length < 60) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  // Haftalik/oylik guruhlanish
  let labels = [], data = [];
  if (days.length <= 14) {
    // Kunlik
    const wdays = ["Ya","Du","Se","Ch","Pa","Ju","Sh"];
    labels = days.map(d => {
      const dObj = new Date(d);
      return d === today() ? "Bugun" : wdays[dObj.getDay()] + " " + d.slice(8);
    });
    data = days.map(d => sales.filter(s => s.date === d).reduce((a, s) => a + s.total, 0));
  } else if (days.length <= 60) {
    // Haftalik
    const weeks = {};
    days.forEach(d => {
      const dObj = new Date(d);
      const wStart = addDays(d, -dObj.getDay());
      const key = wStart;
      if (!weeks[key]) weeks[key] = { label: d.slice(5), total: 0 };
      const daySales = sales.filter(s => s.date === d).reduce((a, s) => a + s.total, 0);
      weeks[key].total += daySales;
    });
    labels = Object.values(weeks).map(w => w.label);
    data   = Object.values(weeks).map(w => w.total);
  } else {
    // Oylik
    const months = {};
    sales.forEach(s => {
      const m = (s.date||"").slice(0, 7);
      if (!months[m]) months[m] = 0;
      months[m] += s.total;
    });
    const sorted = Object.keys(months).sort();
    labels = sorted.map(m => m.slice(5) + " oy");
    data   = sorted.map(m => months[m]);
  }

  _repCharts.trend = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Sotuv (so'm)",
        data,
        backgroundColor: data.map((_, i) => i === data.length - 1 ? "#E9A500" : "#4C9BE888"),
        borderColor:     data.map((_, i) => i === data.length - 1 ? "#d49400" : "#4C9BE8"),
        borderWidth: 1.5,
        borderRadius: 5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          grid: { color: "#f0ede7" },
          ticks: {
            font: { size: 11 },
            callback: v => fmtK(v)
          }
        },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

// ── To'lov usullari chart ─────────────────────────
function renderRepPayChart(sales) {
  const canvas = document.getElementById("repPayChart");
  if (!canvas) return;
  if (_repCharts.pay) { _repCharts.pay.destroy(); delete _repCharts.pay; }

  const types  = { naqd: 0, karta: 0, otkazma: 0 };
  sales.forEach(s => {
    if (s.payType === "aralash" && (s.payBreakdown || s.pay_breakdown)) {
      const breakdown = s.payBreakdown || s.pay_breakdown;
      Object.entries(breakdown).forEach(([m, v]) => {
        if (m in types) types[m] += v;
      });
    } else if (s.payType in types) {
      types[s.payType] += s.total;
    }
  });
  const total  = Object.values(types).reduce((a, b) => a + b, 0);
  const labels = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma" };
  const colors = { naqd:"#E9A500", karta:"#4C9BE8", otkazma:"#36B48C" };

  if (!total) {
    const legend = $("rep-pay-legend");
    if (legend) legend.innerHTML = `<span style="color:#ccc;font-size:12px">Ma'lumot yo'q</span>`;
    return;
  }

  _repCharts.pay = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: Object.keys(types).map(k => labels[k]),
      datasets: [{
        data:            Object.values(types),
        backgroundColor: Object.keys(types).map(k => colors[k]),
        borderWidth: 2,
        borderColor: "#fff"
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmtK(ctx.raw)} so'm (${Math.round(ctx.raw/total*100)}%)` } }
      },
      cutout: "65%"
    }
  });

  // Legend
  const legend = $("rep-pay-legend");
  if (legend) {
    legend.innerHTML = Object.entries(types).filter(([,v]) => v > 0).map(([k, v]) =>
      `<div style="display:flex;align-items:center;gap:5px">
        <div style="width:10px;height:10px;border-radius:3px;background:${colors[k]}"></div>
        <span style="color:#666">${labels[k]}</span>
        <strong>${Math.round(v/total*100)}%</strong>
      </div>`
    ).join("");
  }
}

// ── Top mahsulotlar ───────────────────────────────
function renderRepProducts(sales, totalRev) {
  const el = $("rep-products"); if (!el) return;

  const prods = {};
  sales.forEach(s => {
    s.items?.forEach(item => {
      if (!prods[item.name]) prods[item.name] = { qty: 0, total: 0 };
      prods[item.name].qty   += item.qty;
      prods[item.name].total += (item.price||0) * item.qty;
    });
  });

  const sorted = Object.entries(prods)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  if (!sorted.length) {
    el.innerHTML = `<tr><td colspan="4" class="empty-td">Ma'lumot yo'q</td></tr>`;
    return;
  }

  el.innerHTML = sorted.map(([name, d], i) => {
    const pct  = totalRev > 0 ? Math.round(d.total / totalRev * 100) : 0;
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;color:#bbb;font-weight:700;width:16px">${i+1}</span>
          <div>
            <div style="font-weight:600;font-size:13px">${name}</div>
          </div>
        </div>
      </td>
      <td class="num" style="font-weight:600">${d.qty} ta</td>
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
    if (!custs[name]) custs[name] = { cnt: 0, total: 0, debt: 0 };
    custs[name].cnt++;
    custs[name].total += s.total || 0;
    custs[name].debt  += s.remaining || 0;
  });

  const sorted = Object.entries(custs)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  if (!sorted.length) {
    el.innerHTML = `<tr><td colspan="4" class="empty-td">Ma'lumot yo'q</td></tr>`;
    return;
  }

  el.innerHTML = sorted.map(([name, d], i) =>
    `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <span style="font-size:11px;color:#bbb;font-weight:700;width:16px">${i+1}</span>
          <div style="font-weight:600;font-size:13px">${name}</div>
        </div>
      </td>
      <td class="num">${d.cnt} ta</td>
      <td class="num" style="font-weight:700">${fmtK(d.total)} so'm</td>
      <td class="num">
        ${d.debt > 0
          ? `<span style="color:var(--red);font-weight:700">${fmtK(d.debt)} so'm</span>`
          : `<span class="bg bg-g" style="font-size:11px">✅</span>`}
      </td>
    </tr>`
  ).join("");
}

// ── Narx turi tahlili ─────────────────────────────
function renderRepPriceType(sales) {
  const el = $("rep-pricetype"); if (!el) return;
  const { from, to } = repDateRange();
  const rate = db.settings?.rate || 12800;

  // Davr ichidagi qarz to'lovlari
  const payments = (db.debtPayments||[]).filter(p => p.date >= from && p.date <= to);
  const toUzs = p => p.currency === "usd" ? p.amount * rate : p.amount;

  const methodColors = { naqd:"#36B48C", karta:"#4C9BE8", otkazma:"#8B5CF6", balans:"#E9A500" };
  const methodLabels = { naqd:"💵 Naqd", karta:"💳 Karta", otkazma:"🏦 O'tkazma", balans:"💰 Balansdan" };

  const byMethod = {};
  payments.forEach(p => {
    const m = p.method || "naqd";
    byMethod[m] = (byMethod[m]||0) + toUzs(p);
  });

  const total = Object.values(byMethod).reduce((a,b)=>a+b,0);

  if (!total) {
    el.innerHTML = `<tr><td colspan="3" class="empty-td">Shu davrda qarz to'lovi bo'lmagan</td></tr>`;
    return;
  }

  el.innerHTML = Object.entries(byMethod)
    .filter(([,v]) => v > 0)
    .sort((a,b) => b[1]-a[1])
    .map(([key, val]) => {
      const pct = Math.round(val/total*100);
      const color = methodColors[key]||"#aaa";
      return `<tr>
        <td><span style="display:flex;align-items:center;gap:6px">
          <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block"></span>
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


// ══════════════════════════════════════════════════
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
    (db.sales||[]).filter(s => s.date < from && s.customerName)
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

  const staffMap = {};
  sales.forEach(s => {
    const name = (db.staff||[]).find(x => x.id === s.staffId)?.name || "Noma'lum";
    if (!staffMap[name]) staffMap[name] = { cnt: 0, total: 0, paid: 0, debt: 0, cost: 0 };
    staffMap[name].cnt++;
    staffMap[name].total += s.total || 0;
    staffMap[name].paid  += s.paid || 0;
    staffMap[name].debt  += calcSaleState(s).remaining;
    s.items?.forEach(i => {
      const p = (db.products||[]).find(x => x.name === i.name);
      staffMap[name].cost += Math.round((p?.costUsd||0) * rate) * (i.qty||0);
    });
  });

  const sorted = Object.entries(staffMap).sort((a,b) => b[1].total - a[1].total);
  if (!sorted.length) {
    el.innerHTML = `<tr><td colspan="7" class="empty-td">Ma'lumot yo'q</td></tr>`; return;
  }
  const totalRev = sorted.reduce((a,[,d]) => a + d.total, 0) || 1;

  el.innerHTML = sorted.map(([name, d]) => {
    const avg = d.cnt ? Math.round(d.total / d.cnt) : 0;
    const profit = d.paid - d.cost;
    const debtPct = d.total > 0 ? Math.round(d.debt / d.total * 100) : 0;
    const pct = Math.round(d.total / totalRev * 100);
    return `<tr>
      <td style="font-weight:700">${name}</td>
      <td class="num">${d.cnt} ta</td>
      <td class="num" style="font-weight:700">${fmtK(d.total)} so'm</td>
      <td class="num">${fmtK(avg)} so'm</td>
      <td class="num" style="color:${profit>=0?"var(--grn)":"var(--red)"};font-weight:700">${fmtK(profit)} so'm</td>
      <td class="num" style="color:${debtPct>30?"var(--red)":debtPct>10?"#E9A500":"var(--grn)"}">
        ${debtPct}%
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
function exportHisobotExcel() {
  const { from, to } = repDateRange();
  const sales = repSales();

  const rows = [["Sana","Vaqt","Kassir","Mijoz","Telefon","Mahsulotlar","Jami","To'landi","Qarz","To'lov turi","Narx turi","Holat"]];
  sales.forEach(s => {
    const staffName = (db.staff||[]).find(x=>x.id===s.staffId)?.name || "—";
    const items = (s.items||[]).map(i=>i.name+"×"+i.qty).join(", ");
    const st = calcSaleState(s);
    rows.push([
      s.date||"", s.time||"", staffName,
      s.customerName||"—", s.customerPhone||"",
      items, s.total||0, s.paid||0,
      st.remaining||0, s.payType||"", s.priceType||"",
      s.status==="qarz"?"Qarzda":s.status==="qaytarilgan"?"Qaytarilgan":"To'langan"
    ]);
  });

  downloadCSV(rows, `merx_hisobot_${from}_${to}.xls`);
  toast("✅ Hisobot yuklab olindi");
}