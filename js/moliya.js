// ================================================
// MERX — js/moliya.js
// ================================================

let expChart = null;

function renderMoliya() {
  const t = today(), m = t.slice(0, 7);
  const todayIn  = db.sales.filter(s => s.date === t).reduce((a, s) => a + s.paid, 0);
  const todayExp = db.xarajatlar.filter(x => x.date === t).reduce((a, x) => a + x.amount, 0);
  const monthRev = db.sales.filter(s => s.date.startsWith(m)).reduce((a, s) => a + s.paid, 0);
  const monthExp = db.xarajatlar.filter(x => x.date.startsWith(m)).reduce((a, x) => a + x.amount, 0);
  const profit   = monthRev - monthExp;

  $("mol-balans").textContent  = fmt(todayIn - todayExp) + " so'm";
  $("mol-kirim").textContent   = fmt(todayIn) + " so'm";
  $("mol-chiqim").textContent  = fmt(todayExp) + " so'm";
  $("mol-month-rev").textContent = fmt(monthRev) + " so'm";
  $("mol-month-exp").textContent = fmt(monthExp) + " so'm";
  $("mol-profit").textContent  = fmt(profit) + " so'm";
  $("mol-exp-cnt").textContent = db.xarajatlar.length + " ta";

  // Expense list
  const q = ($("exp-q")||{value:""}).value.toLowerCase();
  const list = db.xarajatlar.filter(x => !q || x.category.toLowerCase().includes(q) || (x.note||"").toLowerCase().includes(q)).slice().reverse();
  $("exp-body").innerHTML = list.length ? list.map(x => `<tr>
    <td style="font-size:12px">${x.date}</td>
    <td><span class="bg bg-r">${x.category}</span></td>
    <td class="num" style="font-weight:600;color:var(--red)">${fmt(x.amount)} so'm</td>
    <td style="color:var(--mut);font-size:12.5px">${x.note||"—"}</td>
  </tr>`).join("") : `<tr><td colspan="4" class="empty-td">Xarajat yo'q</td></tr>`;

  // Expense chart
  const catMap = {};
  db.xarajatlar.forEach(x => { catMap[x.category] = (catMap[x.category]||0) + x.amount; });
  const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const ectx = $("expChart").getContext("2d");
  if (expChart) expChart.destroy();
  const eColors = ["#DC2626","#E9A500","#2563EB","#0D9488","#7C3AED","#059669","#EA580C"];
  expChart = new Chart(ectx, {
    type:"doughnut",
    data:{ labels:cats.map(c=>c[0]), datasets:[{ data:cats.map(c=>c[1]), backgroundColor:eColors.slice(0,cats.length), borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }
  });
  $("exp-legend").innerHTML = cats.map((c, i) =>
    `<span style="display:flex;align-items:center;gap:3px;font-size:11.5px"><span style="width:9px;height:9px;border-radius:50%;background:${eColors[i]||"#888"};flex-shrink:0"></span>${c[0]}</span>`
  ).join("");
}

function expCatPick(el) {
  document.querySelectorAll(".mcat").forEach(x => x.classList.remove("on"));
  el.classList.add("on");
  if ($("exp-cat-val")) $("exp-cat-val").value = el.dataset.c;
}

function addXarajat() {
  const sum  = parseFloat(($("ax-sum")||{value:0}).value) || 0; if (!sum) { toast("Summani kiriting","err"); return; }
  const cat  = ($("exp-cat-val")||{value:"Boshqa"}).value || "Boshqa";
  const date = ($("ax-date")||{value:today()}).value || today();
  db.xarajatlar.push({ id:db.seq++, date, category:cat, amount:sum, note:($("ax-note")||{value:""}).value });
  saveDB(); closeModal("addxarajat"); renderMoliya();
  if ($("ax-sum")) $("ax-sum").value = "";
  if ($("ax-note")) $("ax-note").value = "";
  toast(`${cat}: ${fmt(sum)} so'm xarajat qo'shildi`, "info");
}