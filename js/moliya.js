// ================================================
// MERX — js/moliya.js  (v2)
// ================================================

let molPeriod  = "today";
let _expChart  = null;
const EXP_CATS = ["Ijara","Maosh","Transport","Kommunal","Reklama","Yetkazuvchi to'lov","Boshqa"];
const EXP_COLORS = ["#E9A500","#4C9BE8","#36B48C","#8B5CF6","#E07B39","#E05A5A","#aaa"];

function setMolPeriod(p) {
  molPeriod = p;
  document.querySelectorAll(".mol-period-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.p === p));
  renderMoliya();
}

function molDateRange() {
  const t = today();
  if (molPeriod === "today") return { from: t, to: t };
  if (molPeriod === "week")  return { from: addDays(t, -6), to: t };
  if (molPeriod === "month") return { from: t.slice(0,7)+"-01", to: t };
  if (molPeriod === "year")  return { from: t.slice(0,4)+"-01-01", to: t };
  return { from: t, to: t };
}

// ── Asosiy render ─────────────────────────────────
function renderMoliya() {
  const { from, to } = molDateRange();
  const q    = ($("exp-q")||{value:""}).value.toLowerCase();
  const rate = db.settings.rate || 12800;

  // Davr boyicha ma'lumotlar
  const periodSales = db.sales.filter(s => s.date >= from && s.date <= to);
  const periodExps  = (db.xarajatlar||[]).filter(x => x.date >= from && x.date <= to);

  // Kirim hisoblash
  const sotuv   = periodSales.reduce((a, s) => a + (s.paid||0), 0);
  const qarzColl = db.sales.filter(s => {
    // Qarz to'lovlari: status tolandan bo'lgan, lekin oldin qarz bo'lgan
    return s.date >= from && s.date <= to && s.status === "tolandan" && s.remaining === 0;
  }).reduce((a, s) => a + 0, 0); // Simple: sotuv kirimga qo'shilgan

  const chiqim  = periodExps.reduce((a, x) => a + (x.amount||0), 0);
  const profit  = sotuv - chiqim;

  // Bugungi kassa balansi (hammasi)
  const allPaid  = db.sales.reduce((a, s) => a + (s.paid||0), 0);
  const allExp   = (db.xarajatlar||[]).reduce((a, x) => a + (x.amount||0), 0);
  const balans   = allPaid - allExp;

  // KPI
  if ($("mol-balans"))    $("mol-balans").textContent    = fmt(balans) + " so'm";
  if ($("mol-kirim"))     $("mol-kirim").textContent     = fmt(sotuv);
  if ($("mol-chiqim"))    $("mol-chiqim").textContent    = fmt(chiqim);
  if ($("mol-month-rev")) $("mol-month-rev").textContent = fmt(sotuv) + " so'm";
  if ($("mol-debt-coll")) $("mol-debt-coll").textContent = "—";
  if ($("mol-month-exp")) $("mol-month-exp").textContent = fmt(chiqim) + " so'm";
  if ($("mol-exp-cnt"))   $("mol-exp-cnt").textContent   = periodExps.length + " ta";

  const profitEl = $("mol-profit");
  if (profitEl) {
    profitEl.textContent = fmt(Math.abs(profit)) + " so'm";
    profitEl.style.color = profit >= 0 ? "var(--grn)" : "var(--red)";
    profitEl.textContent = (profit < 0 ? "−" : "") + fmt(Math.abs(profit)) + " so'm";
  }

  // Xarajatlar jadvali
  let exps = [...periodExps].reverse();
  if (q) exps = exps.filter(x =>
    (x.category||"").toLowerCase().includes(q) ||
    (x.note||"").toLowerCase().includes(q)
  );

  const tbody = $("exp-body");
  if (tbody) {
    tbody.innerHTML = exps.length ? exps.map(x => {
      const catIdx = EXP_CATS.indexOf(x.category);
      const color  = EXP_COLORS[catIdx >= 0 ? catIdx : EXP_COLORS.length-1];
      return `<tr>
        <td style="font-size:12.5px;white-space:nowrap">${x.date||"—"}</td>
        <td>
          <span class="bg" style="font-size:11.5px;background:${color}22;color:${color};border:1px solid ${color}44">
            ${x.category||"—"}
          </span>
        </td>
        <td class="num" style="font-weight:700;color:var(--red)">${fmt(x.amount||0)} so'm</td>
        <td style="font-size:12.5px;color:#888">${x.note||"—"}</td>
        <td>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteExp(${x.id})" title="O'chirish" style="color:var(--red)">
            <i class="ti ti-trash"></i>
          </button>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="5" class="empty-td">
      ${q ? `"${q}" topilmadi` : "Xarajat yo'q"}
    </td></tr>`;
  }

  renderExpChart(periodExps);
  renderFlowBars(sotuv, chiqim);
}

// ── Xarajat donut chart ───────────────────────────
function renderExpChart(exps) {
  const canvas = document.getElementById("expChart");
  if (!canvas) return;
  if (_expChart) { _expChart.destroy(); _expChart = null; }

  const cats = {};
  exps.forEach(x => {
    const c = x.category || "Boshqa";
    if (!cats[c]) cats[c] = 0;
    cats[c] += x.amount || 0;
  });

  const total = Object.values(cats).reduce((a, b) => a + b, 0);
  const legend = $("exp-legend");

  if (!total) {
    if (legend) legend.innerHTML = `<span style="color:#ccc">Ma'lumot yo'q</span>`;
    return;
  }

  const labels  = Object.keys(cats);
  const data    = Object.values(cats);
  const bgColors = labels.map(l => {
    const idx = EXP_CATS.indexOf(l);
    return EXP_COLORS[idx >= 0 ? idx : EXP_COLORS.length-1];
  });

  _expChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data, backgroundColor: bgColors, borderWidth: 2, borderColor: "#fff" }]
    },
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
    legend.innerHTML = Object.entries(cats).map(([cat, val]) => {
      const idx = EXP_CATS.indexOf(cat);
      const clr = EXP_COLORS[idx >= 0 ? idx : EXP_COLORS.length-1];
      return `<div style="display:flex;align-items:center;gap:5px">
        <div style="width:9px;height:9px;border-radius:3px;background:${clr};flex-shrink:0"></div>
        <span style="color:#666;font-size:12px">${cat}</span>
        <strong style="font-size:11.5px">${Math.round(val/total*100)}%</strong>
      </div>`;
    }).join("");
  }
}

// ── Kirim-Chiqim taqqos ───────────────────────────
function renderFlowBars(kirim, chiqim) {
  const el = $("mol-flow-bars"); if (!el) return;
  const max = Math.max(kirim, chiqim, 1);
  const profit = kirim - chiqim;

  el.innerHTML = `
    <div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">
        <span style="color:var(--grn);font-weight:600">📈 Kirim</span>
        <span style="font-weight:700">${fmt(kirim)} so'm</span>
      </div>
      <div style="height:10px;background:#f0ede7;border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${Math.round(kirim/max*100)}%;background:var(--grn);border-radius:5px;transition:width .5s"></div>
      </div>
    </div>
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">
        <span style="color:var(--red);font-weight:600">📉 Chiqim</span>
        <span style="font-weight:700">${fmt(chiqim)} so'm</span>
      </div>
      <div style="height:10px;background:#f0ede7;border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${Math.round(chiqim/max*100)}%;background:var(--red);border-radius:5px;transition:width .5s"></div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;
      background:${profit>=0?"#F0FDF4":"#FEF2F2"};border-radius:10px;
      border:1px solid ${profit>=0?"#BBF7D0":"#FECACA"}">
      <span style="font-size:12px;font-weight:700;color:${profit>=0?"var(--grn)":"var(--red)"}">
        ${profit >= 0 ? "✅ Foyda" : "⚠️ Zarar"}
      </span>
      <span style="font-size:14px;font-weight:900;color:${profit>=0?"var(--grn)":"var(--red)"}">
        ${profit>=0?"+":"−"}${fmt(Math.abs(profit))} so'm
      </span>
    </div>`;
}

// ── Xarajat qo'shish ──────────────────────────────
function expCatPick(el) {
  document.querySelectorAll(".mcat").forEach(b => b.classList.remove("on"));
  el.classList.add("on");
  if ($("exp-cat-val")) $("exp-cat-val").value = el.dataset.c;
}

function addXarajat() {
  const cat  = ($("exp-cat-val")||{value:"Boshqa"}).value;
  const sum  = parseFloat(($("ax-sum")||{value:0}).value) || 0;
  const date = ($("ax-date")||{value:""}).value || today();
  const note = ($("ax-note")||{value:""}).value.trim();

  if (sum <= 0) { toast("Summani kiriting","err"); return; }

  if (!db.xarajatlar) db.xarajatlar = [];
  db.xarajatlar.push({ id: db.seq++, date, category: cat, amount: sum, note });
  saveDB(); renderMoliya(); closeModal("addxarajat");
  toast(`✅ ${cat} — ${fmt(sum)} so'm xarajat kiritildi`);
  if ($("ax-sum"))  $("ax-sum").value  = "";
  if ($("ax-note")) $("ax-note").value = "";
}

// ── Xarajatni o'chirish ───────────────────────────
function deleteExp(id) {
  const x = (db.xarajatlar||[]).find(e => e.id === id);
  if (!x) return;
  if (!confirm(`"${x.category}" — ${fmt(x.amount)} so'm xarajat o'chirilsinmi?`)) return;
  db.xarajatlar = db.xarajatlar.filter(e => e.id !== id);
  saveDB(); renderMoliya();
  toast("Xarajat o'chirildi");
}

// ── Excel eksport ─────────────────────────────────
function exportExpExcel() {
  const { from, to } = molDateRange();
  const exps = (db.xarajatlar||[]).filter(x => x.date >= from && x.date <= to);
  const rows = [["Sana","Kategoriya","Summa (so'm)","Izoh"]];
  exps.forEach(x => rows.push([x.date||"", x.category||"", x.amount||0, x.note||""]));
  // Jami
  rows.push(["","JAMI:", exps.reduce((a,x)=>a+(x.amount||0),0), ""]);

  const bom = "\uFEFF";
  const csv = bom + rows.map(r =>
    r.map(c => { const s=String(c); return s.includes(",") ? `"${s}"` : s; }).join(",")
  ).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `merx_xarajatlar_${today()}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast("Xarajatlar yuklab olindi");
}
