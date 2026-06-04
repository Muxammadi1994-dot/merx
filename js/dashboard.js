// ================================================
// MERX — js/dashboard.js
// ================================================

let chartInst = null;

function renderDashboard() {
  const todaySales = db.sales.filter(s => s.date === today());
  const todayRev   = todaySales.reduce((a, s) => a + s.paid, 0);
  const debts      = debtSales();
  const totalDebt  = debts.reduce((a, s) => a + s.remaining, 0);
  const over       = debts.filter(isOverdue);
  const supDebt    = db.ombor.filter(o => o.payStatus === "qarz").reduce((a, o) => a + (o.kirimNarxi||0) * o.qty, 0);
  const supDebtCnt = new Set(db.ombor.filter(o => o.payStatus === "qarz").map(o => o.supplier)).size;

  $("kpi-today").textContent    = fmt(todayRev) + " so'm";
  $("kpi-today-cnt").textContent = todaySales.length + " sotuv";
  $("kpi-debt").textContent     = fmt(totalDebt) + " so'm";
  $("kpi-debt-cnt").textContent = debts.length + " mijoz";
  $("kpi-over").textContent     = over.length + " ta";
  $("kpi-prods").textContent    = db.products.length;
  $("kpi-low").textContent      = db.products.filter(p => totalStock(p) <= 3).length + " ta kam qoldiq";
  $("kpi-sup").textContent      = fmt(supDebt) + " so'm";
  $("kpi-sup-s").textContent    = supDebtCnt + " ta yetkazuvchi";
  $("debt-count").textContent   = debts.length;

  const days = [], revs = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today(), -i);
    days.push(d.slice(5));
    revs.push(db.sales.filter(s => s.date === d).reduce((a, s) => a + s.total, 0));
  }
  const ctx = $("salesChart").getContext("2d");
  if (chartInst) chartInst.destroy();
  chartInst = new Chart(ctx, {
    type: "bar",
    data: { labels: days, datasets: [{ data: revs, backgroundColor: "rgba(233,165,0,.75)", borderColor: "#E9A500", borderRadius: 6, borderWidth: 0 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: c => fmt(c.raw) + " so'm" } } }, scales:{ y:{ ticks:{ callback: v => fmt(v) }, grid:{ color:"#F3F4F6" } }, x:{ grid:{ display:false } } } }
  });

  $("dash-debt-body").innerHTML = debts.slice(-5).reverse().map(s =>
    `<tr><td style="font-weight:600">${s.customerName||"—"}</td>
     <td style="font-size:12px">${s.items[0]?.name||"—"}</td>
     <td class="num" style="color:var(--red);font-weight:700">${fmt(s.remaining)}</td>
     <td><span class="bg ${isOverdue(s)?"bg-r":"bg-a"}">${s.due||"—"}</span></td></tr>`
  ).join("") || `<tr><td colspan="4" class="empty-td">Qarz yo'q</td></tr>`;

  $("dash-sales-body").innerHTML = db.sales.slice(-6).reverse().map(s =>
    `<tr><td style="color:var(--mut);font-size:11px">#${s.id}</td>
     <td style="font-size:13px">${s.items.map(i => i.name).join(", ")}</td>
     <td>${s.customerName||"—"}</td>
     <td><span class="bg bg-b">${PAYTYPES[s.payType]||"—"}</span></td>
     <td class="num" style="font-weight:600">${fmt(s.total)}</td>
     <td><span class="bg ${s.status==="qarz"?"bg-a":"bg-g"}">${s.status==="qarz"?"Qarzda":"To'langan"}</span></td>
     <td style="font-size:12px">${s.date}</td></tr>`
  ).join("");
}