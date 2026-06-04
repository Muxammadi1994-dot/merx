// ================================================
// MERX — js/hisobot.js
// ================================================

let repRange = "week", repTrendChart = null, repPayChart = null;

function setRepRange(r) {
  repRange = r;
  document.querySelectorAll(".rfbtn").forEach(b => b.classList.toggle("on", b.dataset.r === r));
  renderHisobot();
}

function repDates() {
  const t = today(), d = new Date(t);
  if (repRange === "today") return [t, t];
  if (repRange === "week")  return [addDays(t, -6), t];
  if (repRange === "month") return [t.slice(0,7) + "-01", t];
  if (repRange === "quarter") { d.setMonth(d.getMonth()-3); return [d.toISOString().slice(0,10), t]; }
  return [t.slice(0,4) + "-01-01", t];
}

function renderHisobot() {
  const [s, e] = repDates();
  const sales = db.sales.filter(x => x.date >= s && x.date <= e);
  const rev   = sales.reduce((a, x) => a + x.total, 0);
  const paid  = sales.reduce((a, x) => a + x.paid, 0);
  const debt  = sales.reduce((a, x) => a + x.remaining, 0);

  $("rep-cnt").textContent  = sales.length;
  $("rep-rev").textContent  = fmt(rev) + " so'm";
  $("rep-paid").textContent = fmt(paid) + " so'm";
  $("rep-debt").textContent = fmt(debt) + " so'm";

  // Trend chart
  const dateMap = {};
  sales.forEach(s => { dateMap[s.date] = (dateMap[s.date]||0) + s.total; });
  const dates = Object.keys(dateMap).sort(), vals = dates.map(d => dateMap[d]);
  const tctx = $("repTrendChart").getContext("2d");
  if (repTrendChart) repTrendChart.destroy();
  repTrendChart = new Chart(tctx, {
    type:"bar", data:{ labels:dates.map(d=>d.slice(5)), datasets:[{ data:vals, backgroundColor:"rgba(13,148,136,.75)", borderColor:"#0D9488", borderRadius:5, borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>fmt(c.raw)+" so'm" } } }, scales:{ y:{ ticks:{ callback:v=>fmt(v) }, grid:{ color:"#F3F4F6" } }, x:{ grid:{ display:false } } } }
  });

  // Pay type chart
  const payMap = { naqd:0, karta:0, otkazma:0 };
  sales.forEach(s => { if (payMap[s.payType] !== undefined) payMap[s.payType] += s.total; });
  const payLabels = ["Naqd","Karta","O'tkazma"];
  const payVals   = [payMap.naqd, payMap.karta, payMap.otkazma];
  const payColors = ["#0D9488","#2563EB","#E9A500"];
  const pctx = $("repPayChart").getContext("2d");
  if (repPayChart) repPayChart.destroy();
  repPayChart = new Chart(pctx, {
    type:"doughnut", data:{ labels:payLabels, datasets:[{ data:payVals, backgroundColor:payColors, borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }
  });
  $("rep-pay-legend").innerHTML = payLabels.map((l, i) =>
    `<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:${payColors[i]};flex-shrink:0"></span>${l}: ${fmt(payVals[i])}</span>`
  ).join("");

  // Top products
  const prodMap = {};
  sales.forEach(s => s.items.forEach(it => {
    if (!prodMap[it.name]) prodMap[it.name] = { qty:0, rev:0 };
    prodMap[it.name].qty += it.qty; prodMap[it.name].rev += it.price * it.qty;
  }));
  const prods = Object.entries(prodMap).sort((a, b) => b[1].rev - a[1].rev).slice(0, 8);
  const totalRev = prods.reduce((a, p) => a + p[1].rev, 0) || 1;
  $("rep-products").innerHTML = prods.length ? prods.map(([nm, d]) =>
    `<tr><td style="font-weight:500">${nm}</td><td>${d.qty}</td>
     <td class="num">${fmt(d.rev)}</td>
     <td><div style="display:flex;align-items:center;gap:6px">
       <div style="height:6px;border-radius:3px;background:var(--teal);width:${Math.round(d.rev/totalRev*90)}px;max-width:90px"></div>
       <span style="font-size:11.5px;color:var(--mut)">${Math.round(d.rev/totalRev*100)}%</span>
     </div></td></tr>`
  ).join("") : `<tr><td colspan="4" class="empty-td">Ma'lumot yo'q</td></tr>`;

  // Top customers
  const custMap = {};
  sales.filter(s => s.customerName).forEach(s => {
    if (!custMap[s.customerName]) custMap[s.customerName] = { cnt:0, total:0, rem:0 };
    custMap[s.customerName].cnt++; custMap[s.customerName].total += s.total; custMap[s.customerName].rem += s.remaining;
  });
  const custs = Object.entries(custMap).sort((a, b) => b[1].total - a[1].total).slice(0, 6);
  $("rep-customers").innerHTML = custs.length ? custs.map(([nm, d]) =>
    `<tr><td style="font-weight:500">${nm}</td><td>${d.cnt}</td>
     <td class="num">${fmt(d.total)}</td>
     <td>${d.rem > 0 ? `<span class="bg bg-r">${fmt(d.rem)}</span>` : `<span class="bg bg-g">Yo'q</span>`}</td></tr>`
  ).join("") : `<tr><td colspan="4" class="empty-td">Ma'lumot yo'q</td></tr>`;

  // Price type analysis
  const ptMap = { chakana:{ cnt:0, rev:0 }, ulgurji:{ cnt:0, rev:0 } };
  sales.forEach(s => { const pt = s.priceType||"chakana"; if (ptMap[pt]) { ptMap[pt].cnt++; ptMap[pt].rev += s.total; } });
  const ptTotal = (ptMap.chakana.rev + ptMap.ulgurji.rev) || 1;
  $("rep-pricetype").innerHTML = Object.entries(ptMap).map(([k, v]) =>
    `<tr><td><span class="bg ${k==="ulgurji"?"bg-a":"bg-gr"}">${k==="ulgurji"?"Ulgurji":"Chakana"}</span></td>
     <td>${v.cnt}</td><td class="num">${fmt(v.rev)}</td>
     <td class="num">${v.cnt ? fmt(Math.round(v.rev/v.cnt)) : 0}</td>
     <td><div style="display:flex;align-items:center;gap:6px">
       <div style="height:6px;border-radius:3px;background:var(--acc);width:${Math.round(v.rev/ptTotal*80)}px"></div>
       <span style="font-size:12px;color:var(--mut)">${Math.round(v.rev/ptTotal*100)}%</span>
     </div></td></tr>`
  ).join("");
}