// MERX hisobot.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/hisobot.js  (v2)
// ================================================

let repRange  = "week";
let _repCharts = {};

function setRepRange(r) {
  repRange = r;
  document.querySelectorAll(".rfbtn").forEach(b =>
    b.classList.toggle("on", b.dataset.r === r));
  renderHisobot();
}

// ── Davr oralig'ini hisoblash ─────────────────────
function repDateRange() {
  const t = today();
  if (repRange === "today")   return { from: t, to: t };
  if (repRange === "week")    return { from: addDays(t, -6), to: t };
  if (repRange === "month")   return { from: t.slice(0,7) + "-01", to: t };
  if (repRange === "quarter") return { from: addDays(t, -89), to: t };
  if (repRange === "year")    return { from: t.slice(0,4) + "-01-01", to: t };
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
  const debt    = sales.reduce((a, s) => a + (s.remaining||0), 0);

  // Foyda hisoblash: paid - tannarx (nasiya hisobga olinadi)
  let profit = 0, costTotal = 0;
  sales.forEach(s => {
    s.items?.forEach(item => {
      const p = db.products.find(x => x.name === item.name);
      if (!p) return;
      const costUzs = (p.costUsd || 0) * rate;
      costTotal += costUzs * item.qty;
    });
    // Faqat to'langan qismini foydaga hisoblaymiz
    profit += (s.paid || 0);
  });
  profit -= costTotal;
  const margin = rev > 0 ? Math.round(profit / rev * 100) : 0;

  if ($("rep-cnt"))  $("rep-cnt").textContent  = cnt + " ta";
  if ($("rep-rev"))  $("rep-rev").textContent  = fmtK(rev)  + " so'm";
  if ($("rep-paid")) $("rep-paid").textContent = fmtK(paid) + " so'm";
  if ($("rep-debt")) $("rep-debt").textContent = fmtK(debt) + " so'm";

  // Foyda KPI (agar element bor bo'lsa)
  if ($("rep-profit")) $("rep-profit").textContent = fmtK(profit) + " so'm";
  if ($("rep-margin")) $("rep-margin").textContent = margin + "%";

  renderRepTrendChart(sales);
  renderRepPayChart(sales);
  renderRepProducts(sales, rev);
  renderRepCustomers(sales);
  renderRepPriceType(sales);
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
  sales.forEach(s => { if (s.payType in types) types[s.payType] += s.total; });
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
  const total = sales.reduce((a, s) => a + s.total, 0) || 1;

  const types = {};
  sales.forEach(s => {
    const k = s.priceType || "chakana";
    if (!types[k]) types[k] = { cnt: 0, total: 0 };
    types[k].cnt++;
    types[k].total += s.total || 0;
  });

  const labels = { ulgurji: "📦 Ulgurji", chakana: "👤 Chakana" };

  if (!Object.keys(types).length) {
    el.innerHTML = `<tr><td colspan="5" class="empty-td">Ma'lumot yo'q</td></tr>`;
    return;
  }

  el.innerHTML = Object.entries(types)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([k, d]) => {
      const avg = d.cnt ? Math.round(d.total / d.cnt) : 0;
      const pct = Math.round(d.total / total * 100);
      return `<tr>
        <td><span class="bg ${k==="ulgurji"?"bg-a":""}" style="font-size:12px">${labels[k]||k}</span></td>
        <td class="num">${d.cnt} ta</td>
        <td class="num" style="font-weight:700">${fmtK(d.total)} so'm</td>
        <td class="num">${fmtK(avg)} so'm</td>
        <td class="num">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:7px;background:#f0ede7;border-radius:4px;min-width:60px">
              <div style="height:100%;width:${pct}%;background:${k==="ulgurji"?"var(--acc)":"var(--teal)"};border-radius:4px"></div>
            </div>
            <span style="font-size:12px;font-weight:700;width:32px;text-align:right">${pct}%</span>
          </div>
        </td>
      </tr>`;
    }).join("");
}
