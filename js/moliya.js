// ================================================
// MERX — js/moliya.js  (v3 — To'liq qayta yozildi)
// ================================================

let molPeriod = "month"; // default: bu oy
let _expChart = null;

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
  const q = ($("exp-q")||{value:""}).value.toLowerCase();

  const periodSales = db.sales.filter(s => s.date >= from && s.date <= to);
  const periodExps  = (db.xarajatlar||[]).filter(x => x.date >= from && x.date <= to);

  const sotuv  = periodSales.reduce((a, s) => a + (s.paid||0), 0);
  const chiqim = periodExps.reduce((a, x) => a + (x.amount||0), 0);
  const profit = sotuv - chiqim;

  // Jami kassa balansi (barcha vaqt)
  const allPaid = db.sales.reduce((a, s) => a + (s.paid||0), 0);
  const allExp  = (db.xarajatlar||[]).reduce((a, x) => a + (x.amount||0), 0);
  const balans  = allPaid - allExp;

  // KPI
  if ($("mol-balans"))    $("mol-balans").textContent    = fmt(balans) + " so'm";
  if ($("mol-kirim"))     $("mol-kirim").textContent     = fmt(sotuv);
  if ($("mol-chiqim"))    $("mol-chiqim").textContent    = fmt(chiqim);
  if ($("mol-month-rev")) $("mol-month-rev").textContent = fmt(sotuv)  + " so'm";
  if ($("mol-month-exp")) $("mol-month-exp").textContent = fmt(chiqim) + " so'm";
  if ($("mol-exp-cnt"))   $("mol-exp-cnt").textContent   = periodExps.length + " ta";

  const profitEl = $("mol-profit");
  if (profitEl) {
    profitEl.textContent = (profit < 0 ? "−" : "") + fmt(Math.abs(profit)) + " so'm";
    profitEl.style.color = profit >= 0 ? "var(--grn)" : "var(--red)";
  }

  // Kategoriya bo'yicha umumiy
  const catTotals = {};
  periodExps.forEach(x => {
    const c = x.category || "Boshqa";
    catTotals[c] = (catTotals[c]||0) + (x.amount||0);
  });

  // Jadval
  let exps = [...periodExps].sort((a,b) => (b.date||"") > (a.date||"") ? 1 : -1);
  if (q) exps = exps.filter(x =>
    (x.category||"").toLowerCase().includes(q) ||
    (x.note||"").toLowerCase().includes(q) ||
    (x.recipient||"").toLowerCase().includes(q) ||
    (x.paidBy||"").toLowerCase().includes(q)
  );

  const tbody = $("exp-body");
  if (tbody) {
    tbody.innerHTML = exps.length ? exps.map(x => {
      const catIdx = MOL_CATS.indexOf(x.category);
      const color  = MOL_COLORS[catIdx >= 0 ? catIdx : MOL_COLORS.length-1];
      const icon   = ["🏠","👤","🚗","💡","📢","📦","📋"][catIdx >= 0 ? catIdx : 6];
      return `<tr>
        <td style="font-size:12.5px;white-space:nowrap;font-weight:600">${x.date||"—"}</td>
        <td>
          <span class="bg" style="font-size:12px;background:${color}18;color:${color}">
            ${icon} ${x.category||"—"}
          </span>
        </td>
        <td style="font-size:12px;color:#666">
          ${x.recipient ? `<div style="font-weight:600">${x.recipient}</div>` : ""}
          ${x.paidBy    ? `<div style="font-size:11px;color:#aaa">To'ladi: ${x.paidBy}</div>` : ""}
        </td>
        <td class="num" style="font-weight:800;color:var(--red);font-size:13px">
          ${fmt(x.amount||0)} so'm
        </td>
        <td style="font-size:12px;color:#aaa;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${x.note||""}
        </td>
        <td>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteExp(${x.id})" style="color:var(--red)">
            <i class="ti ti-trash"></i>
          </button>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="6" class="empty-td">
      ${q ? `"${q}" topilmadi` : "Bu davrda xarajat yo'q"}
    </td></tr>`;
  }

  // Jadval sarlavhasini yangilaymiz (recipient ustuni qo'shildi)
  const thead = tbody?.closest("table")?.querySelector("thead");
  if (thead) {
    thead.innerHTML = `<tr>
      <th>Sana</th><th>Kategoriya</th><th>Kim/Kimga</th>
      <th class="num">Summa</th><th>Izoh</th><th></th>
    </tr>`;
  }

  renderExpChart(catTotals, chiqim);
  renderFlowBars(sotuv, chiqim);
}

// ── Donut chart ───────────────────────────────────
function renderExpChart(catTotals, total) {
  const canvas = document.getElementById("expChart");
  if (!canvas) return;
  if (_expChart) { _expChart.destroy(); _expChart = null; }

  const legend = $("exp-legend");
  if (!total || total === 0) {
    if (legend) legend.innerHTML = `<span style="color:#ccc;font-size:12px">Xarajat yo'q</span>`;
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
}

// ── Kirim/Chiqim bars ─────────────────────────────
function renderFlowBars(kirim, chiqim) {
  const el = $("mol-flow-bars"); if (!el) return;
  const max    = Math.max(kirim, chiqim, 1);
  const profit = kirim - chiqim;

  el.innerHTML = `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
        <span style="color:var(--grn);font-weight:700">📈 Kirim (sotuvlar)</span>
        <span style="font-weight:700">${fmt(kirim)} so'm</span>
      </div>
      <div style="height:10px;background:#f0ede7;border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${Math.round(kirim/max*100)}%;background:var(--grn);border-radius:5px"></div>
      </div>
    </div>
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
        <span style="color:var(--red);font-weight:700">📉 Chiqim (xarajatlar)</span>
        <span style="font-weight:700">${fmt(chiqim)} so'm</span>
      </div>
      <div style="height:10px;background:#f0ede7;border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${Math.round(chiqim/max*100)}%;background:var(--red);border-radius:5px"></div>
      </div>
    </div>
    <div style="padding:12px 14px;border-radius:10px;
      background:${profit>=0?"#F0FDF4":"#FEF2F2"};
      border:1.5px solid ${profit>=0?"#BBF7D0":"#FECACA"};
      display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;font-weight:700;color:${profit>=0?"var(--grn)":"var(--red)"}">
        ${profit >= 0 ? "✅ Sof foyda" : "⚠️ Zarar"}
      </span>
      <span style="font-size:16px;font-weight:900;color:${profit>=0?"var(--grn)":"var(--red)"}">
        ${profit>=0?"+":"−"}${fmt(Math.abs(profit))} so'm
      </span>
    </div>`;
}

// ── Kategoriya tanlaganda qo'shimcha maydon ───────
function expCatPick(el) {
  document.querySelectorAll(".mcat").forEach(b => b.classList.remove("on"));
  el.classList.add("on");
  const cat = el.dataset.c;
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
  const cat    = ($("exp-cat-val")||{value:"Boshqa"}).value;
  const sum    = parseFloat(($("ax-sum")||{value:0}).value) || 0;
  const date   = ($("ax-date")||{value:""}).value || today();
  const note   = ($("ax-note")||{value:""}).value.trim();
  const paidBy = ($("ax-who")||{value:""}).value;

  // Recipient
  let recipient = "";
  const recSel = $("ax-recipient");
  const recMan = $("ax-recipient-manual");
  if (recMan && recMan.style.display !== "none") {
    recipient = recMan.value.trim();
  } else if (recSel) {
    recipient = recSel.value !== "__manual__" ? recSel.value : "";
  }

  if (sum <= 0) { toast("Summani kiriting","err"); return; }
  if ((cat === "Maosh" || cat === "Yetkazuvchi") && !recipient) {
    toast("Kimga ekanligini tanlang","err"); return;
  }

  if (!db.xarajatlar) db.xarajatlar = [];
  db.xarajatlar.push({ id: db.seq++, date, category: cat, amount: sum, recipient, paidBy, note });
  saveDB(); renderMoliya(); closeModal("addxarajat");

  const recTxt = recipient ? ` → ${recipient}` : "";
  toast(`✅ ${cat}${recTxt}: ${fmt(sum)} so'm`);

  // Formani tozalash
  ["ax-sum","ax-note"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("ax-who")) $("ax-who").value = "";
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

  const bom = "\uFEFF";
  const csv = bom + rows.map(r =>
    r.map(c => { const s=String(c); return s.includes(",") ? `"${s}"` : s; }).join(",")
  ).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `merx_xarajatlar_${today()}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast("Excel yuklab olindi");
}

// ── Modal ochilganda initializ ────────────────────
// openModal override — addxarajat uchun
const _origOpenModal = typeof openModal === "function" ? openModal : null;
function openModal(id) {
  if (typeof _origOpenModal === "function") _origOpenModal(id);
  if (id === "addxarajat") {
    setTimeout(() => {
      if ($("ax-date") && !$("ax-date").value) $("ax-date").value = today();
      initExpWhoSelect();
      renderExpExtraField($("exp-cat-val")?.value || "Ijara");
    }, 30);
  }
}
