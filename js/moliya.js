// MERX moliya.js | v2.2 | 2026-06-06 06:00
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
  periodDebtPays.forEach(p => {
    const amt = p.currency === "usd" ? Math.round(p.amount * rate) : (p.amount || 0);
    if      (p.method === "karta")   debtKarta   += amt;
    else if (p.method === "otkazma") debtOtkazma += amt;
    else if (p.method === "balans")  debtBalans  += amt;
    else                             debtNaqd    += amt;
  });

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
      const color  = MOL_COLORS[catIdx>=0?catIdx:MOL_COLORS.length-1];
      const icon   = ["\uD83C\uDFE0","\uD83D\uDC64","\uD83D\uDE97","\uD83D\uDCA1","\uD83D\uDCE2","\uD83D\uDCE6","\uD83D\uDCCB"][catIdx>=0?catIdx:6];
      return `<tr>
        <td style="font-size:12.5px;white-space:nowrap;font-weight:600">${x.date||"—"}</td>
        <td><span class="bg" style="font-size:12px;background:${color}18;color:${color}">${icon} ${x.category||"—"}</span></td>
        <td style="font-size:12px;color:#666">
          ${x.recipient?`<div style="font-weight:600">${x.recipient}</div>`:""}
          ${x.paidBy?`<div style="font-size:11px;color:#aaa">To'ladi: ${x.paidBy}</div>`:""}
        </td>
        <td class="num" style="font-weight:800;color:var(--red);font-size:13px">${fmt(x.amount||0)} so'm</td>
        <td style="font-size:12px;color:#aaa;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.note||""}</td>
        <td><button class="btn btn-ghost btn-icon btn-sm" onclick="deleteExp(${x.id})" style="color:var(--red)"><i class="ti ti-trash"></i></button></td>
      </tr>`;
    }).join("") : `<tr><td colspan="6" class="empty-td">${q?`"${q}" topilmadi`:"Bu davrda xarajat yo'q"}</td></tr>`;
  }

  const thead = tbody?.closest("table")?.querySelector("thead");
  if (thead) thead.innerHTML = `<tr><th>Sana</th><th>Kategoriya</th><th>Kim/Kimga</th><th class="num">Summa</th><th>Izoh</th><th></th></tr>`;

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
  const sum    = getRawVal("ax-sum");
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