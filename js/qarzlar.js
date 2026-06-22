// MERX qarzlar.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/qarzlar.js  (v3 — To'liq qarz tizimi)
// ================================================

let debtFilter  = "all";   // "all" | "overdue" | "usd" | "month"
let debtGrouped = false;   // mijoz bo'yicha guruhlash

// ── KPI panellarni ko'rsatish/yashirish boshqaruvi ─
const DEBT_KPI_LABELS = {
  total:    "Umumiy qarz (so'm)",
  totalUsd: "Umumiy qarz (USD)",
  over:     "Muddati o'tgan",
  cnt:      "Qarzdorlar soni",
  chart:    "Qarz dinamikasi grafigi"
};

function getHiddenDebtKpis() {
  return db.settings?.hiddenDebtKpis || [];
}

function hideDebtKpi(key) {
  if (!db.settings) db.settings = {};
  const hidden = new Set(db.settings.hiddenDebtKpis || []);
  hidden.add(key);
  db.settings.hiddenDebtKpis = [...hidden];
  saveDB();
  applyDebtKpiVisibility();
}

function showDebtKpi(key) {
  if (!db.settings) db.settings = {};
  const hidden = new Set(db.settings.hiddenDebtKpis || []);
  hidden.delete(key);
  db.settings.hiddenDebtKpis = [...hidden];
  saveDB();
  applyDebtKpiVisibility();
  // Grafik qaytadan ko'rsatilganda Chart.js uni qaytadan chizishi kerak
  if (key === "chart") renderDebtTrendChart();
}

function applyDebtKpiVisibility() {
  const hidden = new Set(getHiddenDebtKpis());
  document.querySelectorAll("#debt-kpi-grid .stb").forEach(el => {
    const key = el.dataset.kpi;
    el.style.display = hidden.has(key) ? "none" : "block";
  });
  // Grafik kartasi alohida joyda (debt-kpi-grid tashqarisida)
  const chartCard = $("debt-chart-card");
  if (chartCard) chartCard.style.display = hidden.has("chart") ? "none" : "flex";
  // Agar grafik yashirilgan/ko'rsatilgan bo'lsa, KPI ustunlari kengligini moslashtiramiz
  const wrap = $("debt-kpi-trend-wrap");
  if (wrap) wrap.style.gridTemplateColumns = hidden.has("chart") ? "1fr" : "1fr 1.15fr";
}

// ── Qarz jadvali ustunlari boshqaruvi ──────────────
const DEBT_COL_DEFS = [
  { key:"phone",    lbl:"Telefon",      def:true },
  { key:"items",    lbl:"Mahsulotlar",  def:true },
  { key:"paid",     lbl:"To'langan",    def:true },
  { key:"due",      lbl:"Muddat",       def:true },
  { key:"status",   lbl:"Holat",        def:true },
];

function getDebtCols() {
  const saved = db.settings?.debtCols;
  const cols = {};
  DEBT_COL_DEFS.forEach(c => { cols[c.key] = saved && c.key in saved ? saved[c.key] : c.def; });
  return cols;
}

function openDebtColsSettings() {
  const cols = getDebtCols();
  const list = $("debt-cols-settings-list");
  if (list) {
    list.innerHTML = DEBT_COL_DEFS.map(c => `
      <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--brd);border-radius:9px;cursor:pointer">
        <input type="checkbox" ${cols[c.key]?"checked":""} onchange="toggleDebtCol('${c.key}',this.checked)"
          style="width:17px;height:17px;accent-color:var(--acc);cursor:pointer">
        <span style="font-size:13px;font-weight:600">${c.lbl}</span>
      </label>`).join("");
  }
  openModal("debtcols");
}

function toggleDebtCol(key, val) {
  if (!db.settings) db.settings = {};
  if (!db.settings.debtCols) db.settings.debtCols = {};
  db.settings.debtCols[key] = val;
  saveDB();
  renderDebts();
}

// ── Qarz tushumi tahlili ────────────────────────────
let debtRevenuePeriod = "today";

function setDebtRevenuePeriod(p) {
  debtRevenuePeriod = p;
  document.querySelectorAll(".dr-period-btn").forEach(b => {
    const on = b.dataset.p === p;
    b.classList.toggle("on", on);
    b.style.background = on ? "#0D1B2A" : "transparent";
    b.style.color = on ? "#fff" : "var(--mut)";
  });
  renderDebtRevenue();
}

function getDebtRevenueRange() {
  const todayStr = today();
  const now = new Date();
  if (debtRevenuePeriod === "custom") {
    const from = ($("dr-date-from")||{value:""}).value;
    const to   = ($("dr-date-to")||{value:""}).value;
    return { from: from || "0000-00-00", to: to || todayStr };
  }
  if (debtRevenuePeriod === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate()-1);
    const ys = y.toISOString().slice(0,10);
    return { from: ys, to: ys };
  }
  if (debtRevenuePeriod === "week") {
    const w = new Date(now); w.setDate(w.getDate()-6);
    return { from: w.toISOString().slice(0,10), to: todayStr };
  }
  if (debtRevenuePeriod === "month") {
    return { from: todayStr.slice(0,7) + "-01", to: todayStr };
  }
  if (debtRevenuePeriod === "year") {
    return { from: todayStr.slice(0,4) + "-01-01", to: todayStr };
  }
  // "today"
  return { from: todayStr, to: todayStr };
}

function renderDebtRevenue() {
  const { from, to } = getDebtRevenueRange();
  const payments = (db.debtPayments||[]).filter(p => p.date >= from && p.date <= to);

  const rate = db.settings?.rate || 12800;
  const toUzs = p => p.currency === "usd" ? p.amount * rate : p.amount;

  const total = payments.reduce((a,p) => a + toUzs(p), 0);
  const byMethod = { naqd:0, karta:0, otkazma:0, balans:0 };
  payments.forEach(p => { byMethod[p.method||"naqd"] = (byMethod[p.method||"naqd"]||0) + toUzs(p); });

  if ($("dr-total"))   $("dr-total").textContent   = fmt(Math.round(total)) + " so'm";
  if ($("dr-count"))   $("dr-count").textContent   = payments.length;
  if ($("dr-naqd"))    $("dr-naqd").textContent    = fmt(Math.round(byMethod.naqd))    + " so'm";
  if ($("dr-karta"))   $("dr-karta").textContent   = fmt(Math.round(byMethod.karta))   + " so'm";
  if ($("dr-otkazma")) $("dr-otkazma").textContent = fmt(Math.round(byMethod.otkazma)) + " so'm";
  if ($("dr-balans"))  $("dr-balans").textContent  = fmt(Math.round(byMethod.balans))  + " so'm";
  if ($("dr-toggle-cnt")) $("dr-toggle-cnt").textContent = payments.length;

  const list = $("dr-list");
  if (!list) return;
  if (!payments.length) {
    list.innerHTML = `<div style="padding:30px;text-align:center;color:#bbb;font-size:13px">Shu davrda to'lov bo'lmagan</div>`;
    return;
  }
  const sorted = payments.slice().sort((a,b) => (a.date+a.time < b.date+b.time) ? 1 : -1);
  list.innerHTML = sorted.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--brd)">
      <div>
        <span style="font-size:12.5px;font-weight:700;color:#0D1B2A">${p.customerName||"Noma'lum"}</span>
        <span style="font-size:11px;color:#aaa;margin-left:6px">${p.chekNum} · ${p.date} ${p.time||""}</span>
        <span style="font-size:11px;color:var(--mut);margin-left:6px">· ${payMethodLabel(p.method)}</span>
      </div>
      <strong style="font-size:13px;color:var(--grn)">${fmtMoney(p.amount, p.currency)}</strong>
    </div>`).join("");
}

function toggleDrList() {
  const list = $("dr-list");
  const icon = $("dr-toggle-icon");
  if (!list) return;
  const isOpen = list.style.display !== "none";
  list.style.display = isOpen ? "none" : "block";
  if (icon) icon.style.transform = isOpen ? "" : "rotate(180deg)";
}

function openDebtKpiSettings() {
  const list = $("debt-kpi-settings-list");
  if (list) {
    const hidden = new Set(getHiddenDebtKpis());
    list.innerHTML = Object.entries(DEBT_KPI_LABELS).map(([key, label]) => {
      const isShown = !hidden.has(key);
      return `<label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--brd);border-radius:9px;cursor:pointer">
        <input type="checkbox" ${isShown?"checked":""} onchange="this.checked?showDebtKpi('${key}'):hideDebtKpi('${key}')"
          style="width:17px;height:17px;accent-color:var(--acc);cursor:pointer">
        <span style="font-size:13px;font-weight:600">${label}</span>
      </label>`;
    }).join("");
  }
  openModal("debtkpi");
}

let _debtTrendChart = null;
let debtTrendPeriod = "month"; // "week" | "month" | "year"

function setDebtTrendPeriod(p) {
  debtTrendPeriod = p;
  document.querySelectorAll(".dt-period-btn").forEach(b => {
    b.classList.toggle("on", b.dataset.p === p);
  });
  renderDebtTrendChart();
}

function renderDebtTrendChart() {
  const canvas = $("debt-trend-chart");
  if (!canvas || typeof Chart === "undefined") return;

  const rate = db.settings?.rate || 12800;
  const now = new Date();

  // Davrga qarab nuqtalar ro'yxatini hosil qilamiz — har doim JORIY davrni
  // ham qamrab oladi (oxirgi nuqta = bugun).
  let points = []; // [{label, endDate}]
  if (debtTrendPeriod === "week") {
    // So'nggi 7 kun, kunma-kun
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0,10);
      points.push({ label: `${d.getDate()}.${d.getMonth()+1}`, endDate: ds });
    }
  } else if (debtTrendPeriod === "year") {
    // So'nggi 12 oy
    const names = ["Yan","Fev","Mar","Apr","May","Iyun","Iyul","Avg","Sen","Okt","Noy","Dek"];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const lastDay = new Date(d.getFullYear(), d.getMonth()+1, 0);
      points.push({ label: names[d.getMonth()] + " " + String(d.getFullYear()).slice(2), endDate: lastDay.toISOString().slice(0,10) });
    }
  } else {
    // "month" — joriy oyning har bir kuni (yoki so'nggi 30 kun agar oy boshida bo'lsa)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const today_ = now.getDate();
    // Juda zich bo'lib ketmasligi uchun, agar 15+ kun bo'lsa har 2 kunda bitta nuqta
    const step = today_ > 15 ? 2 : 1;
    for (let d = 1; d <= today_; d += step) {
      const dt = new Date(now.getFullYear(), now.getMonth(), d);
      points.push({ label: String(d), endDate: dt.toISOString().slice(0,10) });
    }
    // Oxirgi nuqta har doim BUGUN bo'lishi kerak
    const todayStr = now.toISOString().slice(0,10);
    if (points[points.length-1]?.endDate !== todayStr) {
      points.push({ label: String(today_), endDate: todayStr });
    }
  }

  const labels = points.map(p => p.label);

  // Har nuqtadagi UMUMIY ochiq qarzni hisoblaymiz (shu sanagacha yaratilgan,
  // shu sanagacha to'lov qilingan hisobga olinadi)
  const dataPoints = points.map(p => {
    const endDate = p.endDate;
    let total = 0;
    (db.sales||[]).forEach(s => {
      if (!s.date || s.date > endDate) return;
      const origDebtCheck = s.debtCurrency === "usd"
        ? (s.origDebtUsd != null ? s.origDebtUsd : (s.debtUsd||0))
        : (s.origRemaining != null ? s.origRemaining : (s.remaining||0));
      if (origDebtCheck <= 0) return;

      const payments = getSalePayments(s.id).filter(pay => pay.date <= endDate);
      const paidUzs = payments.filter(pay=>pay.currency!=="usd").reduce((a,pay)=>a+pay.amount,0);
      const paidUsd = payments.filter(pay=>pay.currency==="usd").reduce((a,pay)=>a+pay.amount,0);

      if (s.debtCurrency === "usd") {
        const rem = Math.max(0, origDebtCheck - paidUsd);
        total += rem * rate;
      } else {
        const rem = Math.max(0, origDebtCheck - paidUzs);
        total += rem;
      }
    });
    return Math.round(total);
  });

  if (_debtTrendChart) { _debtTrendChart.destroy(); _debtTrendChart = null; }

  _debtTrendChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: dataPoints,
        borderColor: "#E9A500",
        backgroundColor: "rgba(233,165,0,.1)",
        fill: true, tension: .3, pointRadius: 2.5, pointBackgroundColor: "#E9A500"
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: ctx => fmt(ctx.parsed.y) + " so'm" } } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => fmtK(v) }, grid: { color: "#F0EEE8" } },
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }
      }
    }
  });
}

function setDebtFilter(f) {
  debtFilter = f;
  document.querySelectorAll(".debt-filter-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.f === f));
  renderDebts();
}

function toggleDebtGroup() {
  debtGrouped = !debtGrouped;
  const btn = $("debt-group-btn");
  if (btn) {
    btn.style.background = debtGrouped ? "#0D1B2A" : "";
    btn.style.color      = debtGrouped ? "#fff"    : "";
  }
  renderDebts();
}

// Yordamchi funksiyalar
function debtCust(s) {
  const c = s.customerId ? db.customers.find(x => x.id === s.customerId) : null;
  return {
    name:  c ? c.name  : (s.customerName  || "—"),
    phone: c ? c.phone : (s.customerPhone || "—")
  };
}

function debtRemDisplay(s, st) {
  st = st || calcSaleState(s);
  if (s.debtCurrency === "usd" && st.debtUsd != null) {
    return `<span style="font-weight:800;color:#1B4F72;font-size:14px">$${(+st.debtUsd).toFixed(2)}</span>
            <span style="font-size:10px;color:#aaa;display:block">USD</span>`;
  }
  return `<span style="font-weight:800;color:var(--red);font-size:14px">${fmt(st.remaining)}</span>
          <span style="font-size:10px;color:#aaa;display:block">so'm</span>`;
}

// ── Render ────────────────────────────────────────
function renderDebts() {
  const q    = ($("debt-q")||{value:""}).value.toLowerCase();
  const rate = db.settings.rate || 12800;
  const thisMonth = today().slice(0, 7);

  let list = debtSales();

  // Filtr
  if (debtFilter === "overdue") list = list.filter(isOverdue);
  if (debtFilter === "usd")     list = list.filter(s => s.debtCurrency === "usd");
  if (debtFilter === "month")   list = list.filter(s => s.date?.startsWith(thisMonth));

  // Qidiruv
  if (q) list = list.filter(s => {
    const cu = debtCust(s);
    return (cu.name||"").toLowerCase().includes(q) ||
           (cu.phone||"").includes(q) ||
           s.items?.some(i => i.name.toLowerCase().includes(q));
  });

  // Muddati o'tganlar tepaga
  list.sort((a, b) => {
    if (isOverdue(a) && !isOverdue(b)) return -1;
    if (!isOverdue(a) && isOverdue(b))  return 1;
    return (a.due||"") < (b.due||"") ? -1 : 1;
  });

  // KPI — har doim calcSaleState() orqali joriy holatni hisoblaymiz (mutatsiyasiz)
  const allDebt    = debtSales();
  // Muhim: totalUzs faqat SO'M qarzlardan, USD qarzning so'm ekvivalenti
  // (calcSaleState().remaining) bu yerga aralashtirilmasligi kerak — aks holda
  // bitta qarz ikki marta (USD da ham, so'mda ham) hisoblanib ketadi.
  const totalUzs   = allDebt
    .filter(s => !(s.debtCurrency === "usd" && calcSaleState(s).debtUsd > 0))
    .reduce((a, s) => a + calcSaleState(s).remaining, 0);
  const totalUsd   = allDebt.filter(s => s.debtCurrency === "usd")
                            .reduce((a, s) => a + calcSaleState(s).debtUsd, 0);
  const overCount  = allDebt.filter(isOverdue).length;
  const custCount  = new Set(allDebt.map(s => debtCust(s).name)).size;

  $("st-total").textContent     = fmt(totalUzs) + " so'm";
  if ($("st-total-usd")) $("st-total-usd").textContent = totalUsd > 0 ? `$${totalUsd.toFixed(2)}` : "$0";
  $("st-over").textContent      = overCount + " ta";
  $("st-cnt").textContent       = custCount + " kishi";
  $("debt-count").textContent   = allDebt.length;
  renderDebtRevenue();

  if (debtGrouped) {
    renderDebtsGrouped(list, rate);
  } else {
    renderDebtsList(list, rate);
  }
  renderDebtCustCards();
  renderDebtPaymentsHistory();
  applyDebtKpiVisibility();
  renderDebtTrendChart();
}

// ── Mijoz umumiy qarz kartalar paneli ─────────────
function renderDebtCustCards() {
  const el = $("debt-cust-cards"); if (!el) return;
  const allDebt = debtSales();

  // Tepadagi qidiruv (debt-q) bilan sinxron — _debtCustFilter endi
  // dropdown emas, shu qidiruv natijasidan keladi.
  const q = ($("debt-q")||{value:""}).value.trim().toLowerCase();

  // Mijoz bo'yicha guruhlash
  const groups = {};
  allDebt.forEach(s => {
    const cu  = debtCust(s);
    const key = cu.name;
    if (!groups[key]) groups[key] = {
      name: cu.name, phone: cu.phone,
      totalUzs: 0, totalUsd: 0, cnt: 0, anyOverdue: false
    };
    const st = calcSaleState(s);
    groups[key].totalUzs += (s.debtCurrency !== "usd") ? st.remaining : 0;
    groups[key].totalUsd += (s.debtCurrency === "usd" && st.debtUsd) ? st.debtUsd : 0;
    groups[key].cnt++;
    if (isOverdue(s)) groups[key].anyOverdue = true;
  });

  let gList = Object.values(groups).sort((a, b) => {
    if (a.anyOverdue && !b.anyOverdue) return -1;
    if (!a.anyOverdue && b.anyOverdue)  return 1;
    return (b.totalUzs + b.totalUsd*(db.settings?.rate||12800)) -
           (a.totalUzs + a.totalUsd*(db.settings?.rate||12800));
  });

  // Qidiruv mos kelganda mijoz ro'yxatini filtrlaymiz (faqat ko'rsatish uchun,
  // jami statistika hali ham barcha qarzlardan hisoblanadi)
  if (q) gList = gList.filter(g =>
    g.name.toLowerCase().includes(q) || (g.phone||"").includes(q)
  );

  if (!debtGrouped) { el.style.display = "none"; return; }
  if (!gList.length) {
    el.style.display = "block";
    el.innerHTML = `<div style="padding:16px;text-align:center;color:#bbb;font-size:13px">Mijoz topilmadi</div>`;
    return;
  }
  el.style.display = "block";
}

// ── Tanlangan mijozning to'lovlar tarixi ──────────
// Qidiruv qatoriga mijoz nomi aniq mos kelganda (yoki faqat 1 ta natija
// qolganda) shu mijozning to'lovlar tarixini pastda ko'rsatamiz.
// Qidiruv ostidagi "To'lovlar tarixi" bloki olib tashlandi — bu ma'lumot
// endi Qarzlar tarixi sahifasida (openCustPayHistory orqali) ko'rsatiladi,
// shu yerda takror chiqarish ortiqcha edi.
function renderDebtPaymentsHistory() {
  const el = $("debt-payments-history"); if (!el) return;
  el.style.display = "none";
  el.innerHTML = "";
}

// ── Sotuv bo'yicha ro'yxat ────────────────────────
function renderDebtsList(list, rate) {
  const thead = $("debt-head");
  const tbody = $("debt-body");
  const cols = getDebtCols();
  if (thead) thead.innerHTML = `<tr>
    <th>Mijoz</th>
    ${cols.phone  ? "<th>Telefon</th>" : ""}
    ${cols.items  ? "<th>Mahsulotlar</th>" : ""}
    ${cols.paid   ? '<th class="num">To\'langan</th>' : ""}
    <th class="num">Qolgan qarz</th>
    ${cols.due    ? "<th>Muddat</th>" : ""}
    ${cols.status ? "<th>Holat</th>" : ""}
    <th>To'lov</th>
  </tr>`;

  if (!tbody) return;
  const colCount = 3 + [cols.phone,cols.items,cols.paid,cols.due,cols.status].filter(Boolean).length;
  tbody.innerHTML = list.length ? list.map(s => {
    const cu    = debtCust(s);
    const over  = isOverdue(s);
    const st    = calcSaleState(s);
    const isUsd = s.debtCurrency === "usd" && st.debtUsd != null;
    return `<tr class="${over?"debt-row-overdue":""}">
      <td>
        <div style="font-weight:600;font-size:13px">${cu.name||"—"}</div>
        <div style="font-size:10.5px;color:#aaa">${s.date||""}</div>
      </td>
      ${cols.phone ? `<td style="font-size:12.5px">
        ${cu.phone && cu.phone !== "—"
          ? `<a href="tel:${cu.phone}" style="color:inherit;text-decoration:none">${cu.phone}</a>` : "—"}
      </td>` : ""}
      ${cols.items ? `<td style="font-size:12px;max-width:160px">
        ${s.items?.map(i => `<div>${i.name} <span style="color:#aaa">×${i.qty}</span></div>`).join("") || "—"}
      </td>` : ""}
      ${cols.paid ? `<td class="num" style="font-size:12.5px;color:var(--grn)">${fmt(st.paid)} so'm</td>` : ""}
      <td class="num">${debtRemDisplay(s, st)}</td>
      ${cols.due ? `<td>
        <span class="bg ${over?"bg-r":"bg-a"}" style="font-size:11.5px">
          ${s.due||"—"}
        </span>
      </td>` : ""}
      ${cols.status ? `<td>
        <span class="bg ${over?"bg-r":"bg-g"}" style="font-size:11px">
          ${over?"⚠️ Muddati o'tgan":"⏳ Kutilmoqda"}
        </span>
      </td>` : ""}
      <td>
        <div style="display:flex;flex-direction:column;gap:5px;min-width:180px">
          <div style="display:flex;gap:5px">
            <input type="number" id="pay-${s.id}"
              placeholder="${isUsd?"$ summa":"so'm"}"
              step="${isUsd?"0.01":"10000"}"
              style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:8px;padding:5px 8px;width:90px;flex:1;outline:none">
            <select id="pay-method-${s.id}"
              style="font-family:inherit;font-size:12px;border:1.5px solid var(--brd);border-radius:8px;padding:5px 4px;width:78px">
              <option value="naqd">💵 Naqd</option>
              <option value="karta">💳 Karta</option>
              <option value="otkazma">🏦 O'tkazma</option>
            </select>
            <button class="btn btn-teal btn-sm" onclick="recordPayment(${s.id})">To'lov</button>
          </div>
          ${(() => {
            const others = findCustomerDebts(s).filter(x => x.id !== s.id);
            return others.length
              ? `<div style="font-size:10.5px;color:#aaa">+ ${others.length} ta boshqa qarz — avtomatik taqsimlanadi</div>`
              : "";
          })()}
          ${(() => {
            if (!s.customerId) return "";
            const cust = (db.customers||[]).find(c => c.id === s.customerId);
            if (!cust) return "";
            const bal = isUsd ? (cust.balanceUsd||0) : (cust.balanceUzs||0);
            if (bal <= 0) return "";
            return `<button class="btn btn-sm" onclick="useBalanceForDebt(${s.id})"
              style="font-size:11px;color:#0E7490;border-color:#0E7490;text-align:left">
              <i class="ti ti-wallet"></i> Balansdan yech (${fmtMoney(bal, isUsd?"usd":"uzs")} bor)
            </button>`;
          })()}
          ${cu.phone && cu.phone !== "—"
            ? `<div style="display:flex;gap:5px">
                <button class="btn btn-sm" onclick="sendDebtReminder(${s.id})" style="font-size:11px;color:#856404">
                  <i class="ti ti-message"></i> SMS
                </button>
                <button class="btn btn-sm" onclick="sendDebtReminderBot(${s.id})" style="font-size:11px;color:#0E7490">
                  <i class="ti ti-brand-telegram"></i> Bot
                </button>
               </div>`
            : ""}
        </div>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="${colCount}" class="empty-td">
    ${debtFilter !== "all" ? "Bu filtrda qarz yo'q" : "Qarz yo'q 🎉"}
  </td></tr>`;
}

// ── Mijoz bo'yicha guruhlangan ko'rinish ──────────
function renderDebtsGrouped(list, rate) {
  const thead = $("debt-head");
  const tbody = $("debt-body");
  if (thead) thead.innerHTML = `<tr>
    <th>Mijoz</th><th>Telefon</th>
    <th class="num">Sotuvlar</th>
    <th class="num">Umumiy qarz</th>
    <th>Eng yaqin muddat</th>
    <th>Holat</th><th>To'lov qabul qilish</th><th>Eslatma</th>
  </tr>`;
  if (!tbody) return;

  // Mijoz bo'yicha guruhlash
  const groups = {};
  list.forEach(s => {
    const cu  = debtCust(s);
    const key = cu.name + "|" + cu.phone;
    if (!groups[key]) groups[key] = { name:cu.name, phone:cu.phone, customerId:s.customerId||null, sales:[], totalRem:0, totalUzs:0, totalUsd:0 };
    const st = calcSaleState(s);
    groups[key].sales.push(s);
    groups[key].totalRem += st.remaining;
    if (s.debtCurrency === "usd" && st.debtUsd) {
      groups[key].totalUsd += st.debtUsd;
    } else {
      groups[key].totalUzs += st.remaining;
    }
  });

  if (!Object.keys(groups).length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-td">Qarz yo'q 🎉</td></tr>`;
    return;
  }

  tbody.innerHTML = Object.values(groups).map((g, gi) => {
    const anyOverdue  = g.sales.some(isOverdue);
    const nearestDue  = g.sales.map(s => s.due).filter(Boolean).sort()[0] || "—";
    const ids         = g.sales.map(s => s.id).join(",");
    const gKey        = `gp-${gi}`;
    const isUsdPrimary = g.totalUsd > 0;
    return `<tr class="${anyOverdue?"debt-row-overdue":""}">
      <td>
        <div style="font-weight:700;font-size:13.5px;cursor:pointer;text-decoration:underline;text-decoration-style:dotted"
          onclick="openCustPayHistory('${g.name.replace(/'/g,"\\'")}','${(g.phone||"").replace(/'/g,"\\'")}')"
          title="Bu mijozning barcha to'lovlari">${g.name}</div>
        <div style="font-size:10.5px;color:#aaa">${g.sales.length} ta sotuv</div>
      </td>
      <td style="font-size:12.5px">
        ${g.phone && g.phone !== "—"
          ? `<a href="tel:${g.phone}" style="color:inherit">${g.phone}</a>` : "—"}
      </td>
      <td class="num" style="font-weight:600">${g.sales.length}</td>
      <td class="num">
        ${g.totalUzs > 0 ? `<div style="font-weight:800;color:var(--red);font-size:14px">${fmt(g.totalUzs)} so'm</div>` : ""}
        ${g.totalUsd > 0 ? `<div style="font-weight:800;color:#1B4F72;font-size:14px">$${g.totalUsd.toFixed(2)} USD</div>` : ""}
        ${!g.totalUzs && !g.totalUsd ? `<span style="color:#ccc">—</span>` : ""}
      </td>
      <td>
        <span class="bg ${anyOverdue?"bg-r":"bg-a"}">${nearestDue}</span>
      </td>
      <td>
        <span class="bg ${anyOverdue?"bg-r":"bg-g"}">
          ${anyOverdue?"⚠️ Muddati o'tgan":"⏳ Kutilmoqda"}
        </span>
      </td>
      <td>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:200px">
          ${g.totalUzs > 0 ? `
          <div style="display:flex;gap:5px;align-items:center">
            <input type="number" id="gpay-${gKey}-uzs"
              placeholder="so'm" step="10000"
              style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:8px;padding:5px 8px;width:80px;flex:1;outline:none">
            <select id="gpay-method-${gKey}-uzs"
              style="font-family:inherit;font-size:12px;border:1.5px solid var(--brd);border-radius:8px;padding:5px 6px;width:110px">
              <option value="naqd">💵 Naqd</option>
              <option value="karta">💳 Karta</option>
              <option value="otkazma">🏦 O'tkazma</option>
            </select>
            <button class="btn btn-teal btn-sm" style="font-size:11px;white-space:nowrap"
              onclick="recordGroupPayment('${ids}','uzs','${gKey}')">To'lov</button>
          </div>` : ""}
          ${g.totalUsd > 0 ? `
          <div style="display:flex;gap:5px;align-items:center">
            <input type="number" id="gpay-${gKey}-usd"
              placeholder="$ summa" step="0.01"
              style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:8px;padding:5px 8px;width:80px;flex:1;outline:none">
            <select id="gpay-method-${gKey}-usd"
              style="font-family:inherit;font-size:12px;border:1.5px solid var(--brd);border-radius:8px;padding:5px 6px;width:110px">
              <option value="naqd">💵 Naqd</option>
              <option value="karta">💳 Karta</option>
              <option value="otkazma">🏦 O'tkazma</option>
            </select>
            <button class="btn btn-teal btn-sm" style="font-size:11px;white-space:nowrap"
              onclick="recordGroupPayment('${ids}','usd','${gKey}')">To'lov</button>
          </div>` : ""}
        </div>
      </td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-sm" onclick="expandDebtGroup('${ids}')"
            style="font-size:11.5px"><i class="ti ti-eye"></i></button>
          ${g.phone && g.phone !== "—" ? `
            <button class="btn btn-sm" onclick="sendGroupReminder('${g.phone}','${g.name}',${g.totalUzs},${g.totalUsd})"
              style="font-size:11px;color:#856404" title="SMS"><i class="ti ti-message"></i></button>
            <button class="btn btn-sm" onclick="sendGroupReminderBot(${g.customerId||"null"},'${g.phone}','${g.name.replace(/'/g,"\\'")}',${g.totalUzs},${g.totalUsd})"
              style="font-size:11px;color:#0E7490" title="Telegram bot"><i class="ti ti-brand-telegram"></i></button>
          ` : ""}
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ── Guruhda to'lov qabul qilish (eng eski qarzdan FIFO) ────
async function recordGroupPayment(idsStr, currency, gKey) {
  const ids = idsStr.split(",").map(Number);
  const sales = ids.map(id => db.sales.find(s => s.id === id)).filter(Boolean);
  if (!sales.length) return;

  const inputId  = `gpay-${gKey}-${currency}`;
  const methodId = `gpay-method-${gKey}-${currency}`;
  const amt = parseFloat(($(inputId)||{value:0}).value) || 0;
  if (amt <= 0) { toast("Summani kiriting","err"); return; }
  const method = ($(methodId)||{value:"naqd"}).value || "naqd";

  // Shu valyutadagi qarzlar orasidan eng eski sotuvni topamiz (FIFO boshlanish nuqtasi)
  const sameCurSales = sales.filter(s => {
    const st = calcSaleState(s);
    const isUsd = s.debtCurrency === "usd" && st.debtUsd > 0;
    return currency === "usd" ? isUsd : !isUsd;
  });
  if (!sameCurSales.length) { toast(`${currency==="usd"?"USD":"So'm"} qarz topilmadi`,"err"); return; }

  const sortedByDate = sameCurSales.slice().sort((a,b) => (a.date||"") < (b.date||"") ? -1 : 1);
  const oldest = sortedByDate[0];

  // recordPayment ichidagi inputlarni vaqtinchalik shu yerdan o'qitamiz
  const tempInputId = "pay-" + oldest.id;
  const tempMethodId = "pay-method-" + oldest.id;
  let createdTemp = false, createdMethodTemp = false;

  if (!$(tempInputId)) {
    const inp = document.createElement("input");
    inp.type = "hidden"; inp.id = tempInputId; inp.value = amt;
    document.body.appendChild(inp); createdTemp = true;
  } else { $(tempInputId).value = amt; }

  if (!$(tempMethodId)) {
    const sel = document.createElement("input");
    sel.type = "hidden"; sel.id = tempMethodId; sel.value = method;
    document.body.appendChild(sel); createdMethodTemp = true;
  } else { $(tempMethodId).value = method; }

  // Valyutani aniq belgilab uzatamiz — mijozda ikkala valyutada qarz
  // bo'lganda ham to'g'ri taqsimlanishi uchun.
  await recordPayment(oldest.id, currency);

  if (createdTemp) $(tempInputId)?.remove();
  if (createdMethodTemp) $(tempMethodId)?.remove();
}

// ── Ko'rish (expand) ──────────────────────────────
function expandDebtGroup(idsStr) {
  debtGrouped = false;
  const btn = $("debt-group-btn");
  if (btn) { btn.style.background = ""; btn.style.color = ""; }
  const ids = idsStr.split(",").map(Number);
  // Filter by these sale IDs
  const list = debtSales().filter(s => ids.includes(s.id));
  const rate = db.settings.rate || 12800;
  renderDebtsList(list, rate);
}

// ── Mijozning barcha ochiq qarzlarini topish (sana bo'yicha) ──
function findCustomerDebts(s) {
  const cu = debtCust(s);
  let candidates;
  if (s.customerId) {
    candidates = db.sales.filter(x => x.customerId === s.customerId && x.status !== "qaytarilgan");
  } else {
    // customerId yo'q bo'lsa — ism+telefon bo'yicha
    candidates = db.sales.filter(x =>
      !x.customerId &&
      (x.customerName||"") === (s.customerName||"") &&
      (x.customerPhone||"") === (s.customerPhone||"") &&
      x.status !== "qaytarilgan"
    );
  }
  // Joriy holatni (calcSaleState orqali) tekshirib, hali ham qarzi bor bo'lganlarni qoldiramiz
  const list = candidates.filter(x => calcSaleState(x).remaining > 0.5);
  // Eng eski sana birinchi (sana bo'sh bo'lsa oxiriga)
  return list.sort((a, b) => (a.date||"9999") < (b.date||"9999") ? -1 : 1);
}

// ── To'lov qabul qilish (ko'p qarzga avtomatik taqsimlash) ──
// ── Mijoz balansidan qarzga o'tkazish (qo'lda, sotuvchi tanlaganda) ─
async function useBalanceForDebt(saleId) {
  const sale = db.sales.find(x => x.id === saleId); if (!sale) return;
  if (!sale.customerId) { toast("Bu sotuvda mijoz ro'yxatdan tanlanmagan","err"); return; }
  const cust = (db.customers||[]).find(c => c.id === sale.customerId);
  if (!cust) { toast("Mijoz topilmadi","err"); return; }

  const st = calcSaleState(sale);
  const isUsd = sale.debtCurrency === "usd" && st.debtUsd > 0;
  const balance = isUsd ? (cust.balanceUsd||0) : (cust.balanceUzs||0);

  if (balance <= 0) { toast(`Mijozning ${isUsd?"USD":"so'm"} balansi bo'sh`,"err"); return; }

  const debtAmt = isUsd ? st.debtUsd : st.remaining;
  const useAmt = Math.min(balance, debtAmt);

  if (!confirm(`Mijoz balansidan ${fmtMoney(useAmt, isUsd?"usd":"uzs")} shu chekka (${sale.chekNum||"#"+sale.id}) o'tkazilsinmi?`)) return;

  // Balansdan ayiramiz
  if (isUsd) cust.balanceUsd = Math.round(((cust.balanceUsd||0) - useAmt) * 100) / 100;
  else cust.balanceUzs = (cust.balanceUzs||0) - useAmt;

  // To'lov sifatida yozamiz (manba: balans)
  const payment = {
    id: (db.seq = (db.seq||1) + 1),
    chekNum: genPayChekNum(),
    date: today(), time: nowTime(),
    customerId: sale.customerId,
    customerName: cust.name, customerPhone: cust.phone,
    amount: useAmt, currency: isUsd ? "usd" : "uzs",
    method: "balans",
    allocations: [{
      saleId: sale.id, saleDate: sale.date, chekNum: sale.chekNum || ("#"+sale.id),
      partNum: nextPartNum(sale.id),
      amount: useAmt, currency: isUsd ? "usd" : "uzs",
      fullyPaid: (debtAmt - useAmt) < (isUsd ? 0.005 : 100),
      remainingAfter: Math.max(0, debtAmt - useAmt)
    }],
    leftover: 0, leftoverToBalance: false
  };
  db.debtPayments = db.debtPayments || [];
  db.debtPayments.push(payment);

  saveDB();
  toast(`✅ Balansdan ${fmtMoney(useAmt, isUsd?"usd":"uzs")} o'tkazildi`);
  renderDebts();
  if (typeof renderQarzlarTarixi === "function") renderQarzlarTarixi();
}

async function recordPayment(id, forcedCurrency) {
  const clicked = db.sales.find(x => x.id === id); if (!clicked) return;
  const amt = parseFloat(($("pay-"+id)||{value:0}).value) || 0;
  if (amt <= 0) { toast("Summani kiriting","err"); return; }

  const method = ($("pay-method-"+id)||{value:"naqd"}).value || "naqd";

  const rate    = db.settings.rate || 12800;
  const clickedState = calcSaleState(clicked);
  // forcedCurrency berilgan bo'lsa (masalan guruhlangan ko'rinishdan, mijozda
  // ikkala valyutada qarz bo'lganda) — shuni ishlatamiz, aks holda bosilgan
  // chekning o'z valyutasidan avtomatik aniqlaymiz.
  const payCur  = forcedCurrency || ((clicked.debtCurrency === "usd" && clickedState.debtUsd > 0) ? "usd" : "uzs");

  // Mijozning shu valyutadagi barcha ochiq qarzlari, sotuv sanasi bo'yicha (eng eski birinchi)
  const allDebts = findCustomerDebts(clicked);
  const sameCurDebts = allDebts.filter(s => {
    const st = calcSaleState(s);
    const isUsd = s.debtCurrency === "usd" && st.debtUsd > 0;
    return payCur === "usd" ? isUsd : !isUsd;
  });

  // Bosilgan qarz ro'yxatning boshida bo'lishi shart emas — lekin
  // taqsimlash har doim eng eski SOTUVDAN boshlanadi (FIFO, muddat emas)
  let remainingPay = amt;
  const allocations = [];

  for (const s of sameCurDebts) {
    if (remainingPay <= 0) break;
    const st = calcSaleState(s);

    if (payCur === "usd") {
      const debtAmt = st.debtUsd || 0;
      if (debtAmt <= 0) continue;
      const applied = Math.min(remainingPay, debtAmt);
      const remainingAfter = Math.max(0, debtAmt - applied);

      allocations.push({
        saleId: s.id, saleDate: s.date, chekNum: s.chekNum || ("#"+s.id),
        partNum: nextPartNum(s.id),
        amount: applied, currency: "usd",
        fullyPaid: remainingAfter < 0.005,
        remainingAfter
      });
      remainingPay -= applied;
    } else {
      const debtAmt = st.remaining || 0;
      if (debtAmt <= 0) continue;
      const applied = Math.min(remainingPay, debtAmt);
      const remainingAfter = Math.max(0, debtAmt - applied);

      allocations.push({
        saleId: s.id, saleDate: s.date, chekNum: s.chekNum || ("#"+s.id),
        partNum: nextPartNum(s.id),
        amount: applied, currency: "uzs",
        fullyPaid: remainingAfter < 100,
        remainingAfter
      });
      remainingPay -= applied;
    }
  }

  // Agar haligacha ortiqcha qoldiq bo'lsa (boshqa qarzlar yo'q) — mijoz
  // balansiga (depozit sifatida) qo'shamiz. Avtomatik ishlatilmaydi —
  // sotuvchi keyinroq "Balansdan yech" tugmasi orqali qo'lda foydalanadi.
  const leftover = Math.round(remainingPay * 100) / 100;

  if (leftover > 0 && clicked.customerId) {
    const cust = (db.customers||[]).find(c => c.id === clicked.customerId);
    if (cust) {
      if (payCur === "usd") cust.balanceUsd = Math.round(((cust.balanceUsd||0) + leftover) * 100) / 100;
      else cust.balanceUzs = (cust.balanceUzs||0) + leftover;
    }
  }

  // ── To'lov yozuvini saqlash (sale o'zi o'zgarmaydi!) ──
  const cu = debtCust(clicked);
  const payment = {
    id:            (db.seq = (db.seq||1) + 1),
    chekNum:       genPayChekNum(),
    date:          today(),
    time:          nowTime(),
    customerId:    clicked.customerId || null,
    customerName:  cu.name,
    customerPhone: cu.phone,
    amount:        amt,
    currency:      payCur,
    method:        method,
    allocations:   allocations,
    leftover:      leftover > 0 ? leftover : 0,
    leftoverToBalance: leftover > 0 && clicked.customerId ? true : false
  };
  db.debtPayments = db.debtPayments || [];
  db.debtPayments.push(payment);

  saveDB(); renderDebts();
  if (typeof renderQarzlarTarixi === "function") renderQarzlarTarixi();

  // ── Xabar matni ────────────────────────────────
  const amtDisplay = fmtMoney(amt, payCur);
  let summary;
  if (allocations.length === 1) {
    const a = allocations[0];
    summary = a.fullyPaid
      ? `To'liq to'landi ✅ (${a.chekNum} ${String(a.partNum).padStart(3,"0")})`
      : `${fmtMoney(a.remainingAfter, a.currency)} qoldi`;
  } else if (allocations.length > 1) {
    summary = allocations.map(a =>
      `${a.saleDate} (${a.chekNum} ${String(a.partNum).padStart(3,"0")}): ${a.fullyPaid ? "to'liq yopildi" : fmtMoney(a.amount, a.currency)+" o'tkazildi"}`
    ).join("; ");
  } else {
    summary = "Taqsimlanmadi";
  }
  if (leftover > 0) {
    summary += clicked.customerId
      ? ` | Ortiqcha: ${fmtMoney(leftover, payCur)} — mijoz balansiga qo'shildi`
      : ` | Ortiqcha: ${fmtMoney(leftover, payCur)} (mijoz ro'yxatda emas, balansga qo'shilmadi)`;
  }

  toast(`✅ ${amtDisplay} qabul qilindi. ${summary}`);

  // ── Chek modalini ko'rsatish ────────────────────
  if (typeof showDebtPaymentReceipt === "function") {
    showDebtPaymentReceipt(payment);
  }

  // ── SMS ──────────────────────────────────────────
  const phone = cu.phone;
  if (phone && phone.replace(/\D/g,"").length >= 9) {
    const shopName = db.shop?.name || "MERX";
    let smsTxt = `${shopName}: To'lov qabul qilindi: ${amtDisplay}.`;
    if (allocations.length > 1) {
      smsTxt += " " + allocations.map(a =>
        `${a.saleDate}: ${a.fullyPaid ? "yopildi" : fmtMoney(a.amount,a.currency)+" hisobga o'tdi"}`
      ).join(", ") + ".";
    } else if (allocations.length === 1) {
      const a = allocations[0];
      smsTxt += a.fullyPaid ? " Qarz to'liq yopildi." : ` ${fmtMoney(a.remainingAfter,a.currency)} qoldi.`;
    }
    await sendSms(phone, smsTxt);
  }
}


// ── SMS eslatma (bitta) ───────────────────────────
async function sendDebtReminder(id) {
  const s     = db.sales.find(x => x.id === id); if (!s) return;
  const cu    = debtCust(s);
  const phone = cu.phone;
  if (!phone || phone === "—") { toast("Telefon raqam yo'q","err"); return; }

  // Mijozning UMUMIY qarzini hisoblaymiz (faqat shu chek emas) — SMS va
  // Bot xabar matni har doim bir xil, umumiy qarz asosida bo'lishi kerak.
  const allDebts = findCustomerDebts(s);
  let totalUzs = 0, totalUsd = 0;
  allDebts.forEach(x => {
    const st = calcSaleState(x);
    if (x.debtCurrency === "usd" && st.debtUsd) totalUsd += st.debtUsd;
    else totalUzs += st.remaining;
  });

  const msg = buildDebtReminderText(cu.name, totalUzs, totalUsd);
  await sendSms(phone, msg);
  toast(`📲 SMS eslatma yuborildi: ${cu.name}`);
}

async function sendDebtReminderBot(id) {
  const s     = db.sales.find(x => x.id === id); if (!s) return;
  const cu    = debtCust(s);

  const allDebts = findCustomerDebts(s);
  let totalUzs = 0, totalUsd = 0;
  allDebts.forEach(x => {
    const st = calcSaleState(x);
    if (x.debtCurrency === "usd" && st.debtUsd) totalUsd += st.debtUsd;
    else totalUzs += st.remaining;
  });

  const msg = buildDebtReminderText(cu.name, totalUzs, totalUsd);
  await sendTelegramText(s.customerId, cu.phone, msg);
}

// ── SMS eslatma (guruhlangan) ─────────────────────
// Qarz eslatma matnini hosil qilish (SMS va Bot uchun bir xil)
function buildDebtReminderText(name, totalUzs, totalUsd) {
  const shopName = db.shop?.name || "MERX";
  const debtTxt  = totalUsd > 0
    ? `$${totalUsd.toFixed(2)} USD${totalUzs>0?` + ${fmt(totalUzs)} so'm`:""}`
    : `${fmt(totalUzs)} so'm`;
  return `${shopName}: Hurmatli ${name}, umumiy qarzingiz: ${debtTxt}. Iltimos to'lovni amalga oshiring.`;
}

async function sendGroupReminder(phone, name, totalUzs, totalUsd) {
  const msg = buildDebtReminderText(name, totalUzs, totalUsd);
  await sendSms(phone, msg);
  toast(`📲 SMS eslatma yuborildi: ${name}`);
}

async function sendGroupReminderBot(customerId, phone, name, totalUzs, totalUsd) {
  const msg = buildDebtReminderText(name, totalUzs, totalUsd);
  await sendTelegramText(customerId, phone, msg);
}

// ── BARCHA qarzdorlarga (muddatidan qat'iy nazar) eslatma ─
function getAllDebtorsGrouped() {
  const allDebt = debtSales();
  const byPhone = {};
  allDebt.forEach(s => {
    const cu = debtCust(s);
    if (!cu.phone || cu.phone === "—") return;
    if (!byPhone[cu.phone]) byPhone[cu.phone] = { name:cu.name, phone:cu.phone, customerId:s.customerId||null, total:0, totalUsd:0 };
    const st = calcSaleState(s);
    const isUsd = s.debtCurrency === "usd" && st.debtUsd > 0;
    if (isUsd) {
      byPhone[cu.phone].totalUsd += st.debtUsd;
    } else {
      byPhone[cu.phone].total += st.remaining;
    }
  });
  return Object.values(byPhone);
}

async function sendAllDebtorsReminders() {
  const debtors = getAllDebtorsGrouped();
  if (!debtors.length) { toast("Qarzdorlar yo'q","info"); return; }
  if (!confirm(`${debtors.length} ta mijozga (barcha qarzdorlarga) SMS yuborilsinmi?`)) return;

  let sent = 0;
  for (const p of debtors) {
    const msg = buildDebtReminderText(p.name, p.total, p.totalUsd);
    await sendSms(p.phone, msg);
    sent++;
  }
  toast(`✅ ${sent} ta mijozga SMS yuborildi`);
}

async function sendAllDebtorsRemindersBot() {
  const debtors = getAllDebtorsGrouped();
  if (!debtors.length) { toast("Qarzdorlar yo'q","info"); return; }
  if (!confirm(`${debtors.length} ta mijozga (barcha qarzdorlarga) Telegram orqali yuborilsinmi?`)) return;

  let sent = 0;
  for (const p of debtors) {
    const msg = buildDebtReminderText(p.name, p.total, p.totalUsd);
    const r = await sendTelegramText(p.customerId, p.phone, msg);
    if (r?.sent) sent++;
  }
  toast(`✅ ${sent}/${debtors.length} ta mijozga Telegram orqali yuborildi`);
}

// ── Barcha muddati o'tganlarga SMS ────────────────
async function sendOverdueReminders() {
  const overdue = debtSales().filter(isOverdue);
  if (!overdue.length) { toast("Muddati o'tgan qarz yo'q","info"); return; }

  // Telefon bo'yicha guruhlash
  const byPhone = {};
  overdue.forEach(s => {
    const cu = debtCust(s);
    if (!cu.phone || cu.phone === "—") return;
    if (!byPhone[cu.phone]) byPhone[cu.phone] = { name:cu.name, phone:cu.phone, customerId:s.customerId||null, total:0, totalUsd:0 };
    const st = calcSaleState(s);
    const isUsd = s.debtCurrency === "usd" && st.debtUsd > 0;
    if (isUsd) byPhone[cu.phone].totalUsd += st.debtUsd;
    else byPhone[cu.phone].total += st.remaining;
  });

  const phones = Object.values(byPhone);
  if (!phones.length) { toast("Telefon raqamlari yo'q","err"); return; }

  if (!confirm(`${phones.length} ta mijozga SMS eslatma yuborilsinmi?`)) return;

  let sent = 0;
  for (const p of phones) {
    const msg = buildOverdueText(p.name, p.total, p.totalUsd);
    await sendSms(p.phone, msg);
    sent++;
  }
  toast(`✅ ${sent} ta mijozga SMS yuborildi`);
}

function buildOverdueText(name, totalUzs, totalUsd) {
  const shopName = db.shop?.name || "MERX";
  const debtTxt  = totalUsd > 0
    ? `$${totalUsd.toFixed(2)} USD${totalUzs>0?` + ${fmt(totalUzs)} so'm`:""}`
    : `${fmt(totalUzs)} so'm`;
  return `${shopName}: Hurmatli ${name}, qarz muddati o'tdi. Qarz: ${debtTxt}. Tezroq to'lang.`;
}

async function sendOverdueRemindersBot() {
  const overdue = debtSales().filter(isOverdue);
  if (!overdue.length) { toast("Muddati o'tgan qarz yo'q","info"); return; }

  const byPhone = {};
  overdue.forEach(s => {
    const cu = debtCust(s);
    if (!cu.phone || cu.phone === "—") return;
    if (!byPhone[cu.phone]) byPhone[cu.phone] = { name:cu.name, phone:cu.phone, customerId:s.customerId||null, total:0, totalUsd:0 };
    const st = calcSaleState(s);
    const isUsd = s.debtCurrency === "usd" && st.debtUsd > 0;
    if (isUsd) byPhone[cu.phone].totalUsd += st.debtUsd;
    else byPhone[cu.phone].total += st.remaining;
  });

  const phones = Object.values(byPhone);
  if (!phones.length) { toast("Telefon raqamlari yo'q","err"); return; }

  if (!confirm(`${phones.length} ta mijozga Telegram orqali eslatma yuborilsinmi?`)) return;

  let sent = 0;
  for (const p of phones) {
    const msg = buildOverdueText(p.name, p.total, p.totalUsd);
    const r = await sendTelegramText(p.customerId, p.phone, msg);
    if (r?.sent) sent++;
  }
  toast(`✅ ${sent}/${phones.length} ta mijozga Telegram orqali yuborildi`);
}

// ════════════════════════════════════════════════
// QARZ TO'LOV CHEKI (modal)
// ════════════════════════════════════════════════

function showDebtPaymentReceipt(payment) {
  const shopName = db.shop?.name || "MERX";
  const allocHtml = (payment.allocations||[]).map(a => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;font-size:13px;padding-bottom:8px;border-bottom:1px solid #F6F4EF">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:#0D1B2A">${a.saleDate} qarzi <span style="color:#aaa;font-weight:400">(${a.chekNum})</span></div>
        <div style="font-size:11.5px;color:${a.fullyPaid?'#059669':'#d97706'};margin-top:2px">
          ${a.fullyPaid ? "✓ To'liq yopildi" : `Qisman to'landi — ${fmtMoney(a.remainingAfter, a.currency)} qoldi`}
        </div>
      </div>
      <div style="font-weight:700;color:#0D1B2A;margin-left:12px;white-space:nowrap">${fmtMoney(a.amount, a.currency)}</div>
    </div>`).join("");

  const leftoverHtml = payment.leftover > 0 ? `
    <div style="margin-top:10px;background:#FFFBEB;border-radius:10px;padding:10px 12px;font-size:12.5px;color:#92400E">
      <i class="ti ti-info-circle"></i> Ortiqcha to'lov: <b>${fmtMoney(payment.leftover, payment.currency)}</b> — boshqa ochiq qarz topilmadi
    </div>` : "";

  const html = `<!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>To'lov cheki ${payment.chekNum}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'DM Sans',sans-serif;background:#F2F0EB;display:flex;justify-content:center;padding:24px 12px}
      .receipt{background:#fff;width:380px;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(13,27,42,.08)}
      .head{background:#0D1B2A;color:#fff;padding:24px 22px 20px;text-align:center}
      .head .logo{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;letter-spacing:.5px}
      .head .sub{font-size:11px;color:#9aa7b5;margin-top:2px;letter-spacing:1px;text-transform:uppercase}
      .head .check{display:inline-block;margin-top:14px;width:36px;height:36px;border-radius:50%;background:#E9A500;color:#0D1B2A;font-size:18px;line-height:36px;font-weight:800}
      .body{padding:20px 22px}
      .meta{display:flex;justify-content:space-between;font-size:11.5px;color:#8a8f98;margin-bottom:16px;padding-bottom:14px;border-bottom:1px dashed #E8E5E0}
      .meta b{color:#0D1B2A;font-weight:700}
      .total-row{display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding-top:14px;border-top:2px solid #0D1B2A}
      .total-row .lbl{font-family:'Sora',sans-serif;font-weight:700;font-size:14px;color:#0D1B2A;letter-spacing:.5px}
      .total-row .val{font-family:'Sora',sans-serif;font-weight:800;font-size:22px;color:#0D1B2A}
      .badge-row{display:flex;justify-content:space-between;font-size:11px;color:#a3a8af;margin-top:14px;padding-top:12px;border-top:1px dashed #E8E5E0}
      .footer{padding:18px 22px 24px;text-align:center}
      .footer .thanks{font-family:'Sora',sans-serif;font-weight:700;font-size:14px;color:#0D1B2A;margin-bottom:4px}
      .footer .sub{font-size:11px;color:#a3a8af}
      .section-lbl{font-size:11px;color:#a3a8af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;font-weight:600}
      .actions{max-width:380px;margin:14px auto 0;display:flex;gap:10px}
      .actions button{flex:1;border:none;border-radius:12px;padding:12px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;cursor:pointer}
      .btn-print{background:#0D1B2A;color:#fff}
      .btn-close{background:#fff;color:#0D1B2A;border:1.5px solid #E8E5E0 !important}
      @media print{
        body{background:#fff;padding:0}
        .receipt{box-shadow:none;border-radius:0;width:100%;max-width:380px}
        .actions{display:none}
      }
    </style></head><body>
    <div>
      <div class="receipt">
        <div class="head">
          <div class="logo">${shopName.toUpperCase()}</div>
          <div class="sub">Qarz to'lov cheki</div>
          <div class="check">✓</div>
        </div>
        <div class="body">
          <div class="meta">
            <span>${payment.chekNum}</span>
            <b>${payment.date} ${payment.time||""}</b>
          </div>
          <div class="section-lbl">Yopilgan / kamaytirilgan qarzlar</div>
          ${allocHtml || `<div style="font-size:12.5px;color:#aaa">Mos qarz topilmadi</div>`}
          <div class="total-row">
            <span class="lbl">QABUL QILINDI</span>
            <span class="val">${fmtMoney(payment.amount, payment.currency)}</span>
          </div>
          <div style="text-align:right;font-size:11.5px;color:#a3a8af;margin-top:4px">${payMethodLabel(payment.method)} orqali</div>
          ${leftoverHtml}
          <div class="badge-row">
            <span>Mijoz: <b style="color:#0D1B2A">${payment.customerName||"—"}</b></span>
            <span>${payment.customerPhone||""}</span>
          </div>
        </div>
        <div class="footer">
          <div class="thanks">Rahmat! Yana kutamiz 🙏</div>
          <div class="sub">${shopName} · ${payment.date}</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn-print" onclick="window.print()">🖨 Chop etish</button>
        <button class="btn-close" onclick="window.close()">Yopish</button>
      </div>
    </div>
    </body></html>`;

  const w = window.open("","_blank","width=440,height=720");
  if (!w) { toast("Pop-up bloklangan","err"); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

// ── Tarixdan to'lov chekini qayta ochish ──────────
function reprintDebtPayment(id) {
  const p = (db.debtPayments||[]).find(x => x.id === id);
  if (!p) { toast("To'lov topilmadi","err"); return; }
  showDebtPaymentReceipt(p);
}

// ════════════════════════════════════════════════
// QARZLAR TARIXI — yangi sahifa
// ════════════════════════════════════════════════
// Har bir QARZGA SOTILGAN chekni 3 holatga ajratadi:
//   🟢 paid    — to'liq to'langan (lekin qarz sifatida boshlangan edi)
//   🟡 partial — qisman to'langan, hali qoldiq bor
//   🔴 unpaid  — umuman to'lov qilinmagan
let qtStatus = "all";
let qtViewMode = "split"; // "split" = chek bo'yicha taqsimot, "total" = umumiy to'lov harakati

function setQtStatus(s) {
  qtStatus = s;
  document.querySelectorAll(".qt-status-btn").forEach(b => {
    const on = b.dataset.s === s;
    b.classList.toggle("on", on);
    b.style.background = on ? "#0D1B2A" : "#fff";
    b.style.color = on ? "#fff" : (b.dataset.s === "paid" ? "var(--grn)" : b.dataset.s === "partial" ? "#D97706" : b.dataset.s === "unpaid" ? "var(--red)" : "inherit");
  });
  renderQarzlarTarixi();
}

function setQtViewMode(mode) {
  qtViewMode = mode;
  document.querySelectorAll(".qt-view-btn").forEach(b => {
    const on = b.dataset.v === mode;
    b.classList.toggle("on", on);
    b.style.background = on ? "#0D1B2A" : "#fff";
    b.style.color = on ? "#fff" : "#666";
  });
  // "total" rejimida status filtri (paid/partial/unpaid) mantiqsiz —
  // chunki bu yerda CHEKLAR emas, TO'LOVLAR ro'yxati. Shu sababli yashiramiz.
  const statusBar = $("qt-status-bar");
  if (statusBar) statusBar.style.display = mode === "split" ? "flex" : "none";
  renderQarzlarTarixi();
}

function renderQarzlarTarixi() {
  if (qtViewMode === "total") { renderQarzlarTarixiTotal(); return; }
  renderQarzlarTarixiSplit();
}

function renderQarzlarTarixiSplit() {
  const el = $("qt-list"); if (!el) return;
  const q = ($("qt-q")||{value:""}).value.toLowerCase();
  const rate = db.settings?.rate || 12800;

  // Faqat qarzga sotilgan cheklar (debtCurrency/debtUsd yoki remaining > 0 bo'lgan tarix)
  const isUsdSale = s => s.debtCurrency === "usd";

  // Boshlang'ich qarz miqdorini (sotilgan paytdagi, valyutasiga mos) aniqlaymiz
  const getOrigDebt = s => {
    if (isUsdSale(s)) {
      if (s.origDebtUsd != null) return s.origDebtUsd;
      const paidUsd = getSalePayments(s.id).filter(p=>p.currency==="usd").reduce((a,p)=>a+(p.amount||0),0);
      return Math.max(0, (s.debtUsd||0) + paidUsd);
    }
    if (s.origRemaining != null) return s.origRemaining;
    const paidViaPayments = getSalePayments(s.id).reduce((a,p) => a + (p.currency==="usd" ? p.amount*rate : p.amount), 0);
    const origPaidGuess = Math.max(0, (s.paid||0) - paidViaPayments);
    return Math.max(0, (s.total||0) - origPaidGuess);
  };

  const debtSalesAll = (db.sales||[]).filter(s => getOrigDebt(s) > 0.005 && s.status !== "qaytarilgan");

  const rows = debtSalesAll.map(s => {
    const st = calcSaleState(s);
    const isUsd = isUsdSale(s);
    const origDebt = getOrigDebt(s);
    const currentDebt = isUsd ? st.debtUsd : st.remaining;
    const payments = getSalePayments(s.id);

    let status;
    if (currentDebt <= (isUsd ? 0.005 : 0.5)) status = "paid";
    else if (payments.length > 0) status = "partial";
    else status = "unpaid";

    return { sale: s, isUsd, origDebt, currentDebt, payments, status };
  });

  let filtered = rows;
  if (qtStatus !== "all") filtered = filtered.filter(r => r.status === qtStatus);

  // Sana oralig'i filtri (to'lov sanasi bo'yicha)
  const dateFrom = ($("qt-date-from")||{value:""}).value;
  const dateTo   = ($("qt-date-to")||{value:""}).value;
  if (dateFrom || dateTo) {
    filtered = filtered.filter(r => {
      // Shu chekka tegishli to'lovlardan kamida bittasi sana oralig'iga to'g'ri kelsa
      return r.payments.some(p => {
        if (dateFrom && p.payDate < dateFrom) return false;
        if (dateTo   && p.payDate > dateTo)   return false;
        return true;
      });
    });
  }

  if (q) filtered = filtered.filter(r =>
    (r.sale.customerName||"").toLowerCase().includes(q) ||
    (r.sale.chekNum||"").toLowerCase().includes(q) ||
    (r.sale.customerPhone||"").includes(q) ||
    // To'lov sanasi yoki to'lov cheki raqami bo'yicha ham qidirish
    r.payments.some(p => p.payDate.includes(q) || `${r.sale.chekNum}-${String(r.payments.indexOf(p)+1).padStart(3,"0")}`.toLowerCase().includes(q))
  );

  const cntAll = rows.length;
  const cntPaid = rows.filter(r => r.status === "paid").length;
  const cntPartial = rows.filter(r => r.status === "partial").length;
  const cntUnpaid = rows.filter(r => r.status === "unpaid").length;
  if ($("qt-cnt-all")) $("qt-cnt-all").textContent = cntAll;
  if ($("qt-cnt-paid")) $("qt-cnt-paid").textContent = cntPaid;
  if ($("qt-cnt-partial")) $("qt-cnt-partial").textContent = cntPartial;
  if ($("qt-cnt-unpaid")) $("qt-cnt-unpaid").textContent = cntUnpaid;

  // Statistik xulosa paneli (jami qarz / jami to'langan / jami qoldiq)
  const origUzs = rows.filter(r=>!r.isUsd).reduce((a,r)=>a+r.origDebt,0);
  const origUsdSum = rows.filter(r=>r.isUsd).reduce((a,r)=>a+r.origDebt,0);
  const remUzs = rows.filter(r=>!r.isUsd).reduce((a,r)=>a+r.currentDebt,0);
  const remUsdSum = rows.filter(r=>r.isUsd).reduce((a,r)=>a+r.currentDebt,0);
  const paidUzs = origUzs - remUzs;
  const paidUsdSum = origUsdSum - remUsdSum;

  const fmtPair = (uzs, usd) => {
    const parts = [];
    if (usd > 0.005) parts.push("$"+usd.toFixed(2));
    if (uzs > 0.5) parts.push(fmt(Math.round(uzs))+" so'm");
    return parts.join(" + ") || "0";
  };
  if ($("qt-sum-orig"))  $("qt-sum-orig").textContent  = fmtPair(origUzs, origUsdSum);
  if ($("qt-sum-paid"))  $("qt-sum-paid").textContent  = fmtPair(paidUzs, paidUsdSum);
  if ($("qt-sum-rem"))   $("qt-sum-rem").textContent   = fmtPair(remUzs, remUsdSum);

  filtered.sort((a,b) => (a.sale.date+(a.sale.time||"") < b.sale.date+(b.sale.time||"")) ? 1 : -1);

  if (!filtered.length) {
    el.innerHTML = `<div style="padding:50px;text-align:center;color:var(--mut)">
      <i class="ti ti-receipt-2" style="font-size:36px;display:block;margin-bottom:10px;opacity:.4"></i>
      Hech narsa topilmadi</div>`;
    return;
  }

  const statusMeta = {
    paid:    { color: "var(--grn)", bg: "#F0FDF4", label: "To'liq to'langan", dot: "🟢" },
    partial: { color: "#D97706",    bg: "#FFFBEB", label: "Qisman to'langan",  dot: "🟡" },
    unpaid:  { color: "var(--red)", bg: "#FEF2F2", label: "To'lanmagan",        dot: "🔴" },
  };

  el.innerHTML = filtered.map(({sale: s, isUsd, origDebt, currentDebt, payments, status}) => {
    const meta = statusMeta[status];
    const fmtCur = v => isUsd ? `$${(+v).toFixed(2)}` : `${fmt(v)} so'm`;
    const paidAmount = origDebt - currentDebt;
    const payPct = origDebt > 0 ? Math.min(100, Math.round(paidAmount / origDebt * 100)) : 100;
    const rowId = `qt-row-${s.id}`;
    const baseChekNum = s.chekNum || ("#"+s.id);

    return `<div style="border-bottom:1px solid var(--brd)">
      <div onclick="qtToggleExpand(${s.id})" style="display:flex;align-items:center;gap:14px;padding:14px 18px;cursor:pointer;background:${meta.bg}">
        <div style="width:10px;height:10px;border-radius:50%;background:${meta.color};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <strong style="font-size:13.5px;color:#0D1B2A;cursor:pointer;text-decoration:underline;text-decoration-style:dotted"
              onclick="event.stopPropagation();openCustPayHistory('${(s.customerName||"").replace(/'/g,"\\'")}','${(s.customerPhone||"").replace(/'/g,"\\'")}')"
              title="Bu mijozning barcha to'lovlari">${s.customerName||"Noma'lum mijoz"}</strong>
            <span style="font-size:11.5px;color:#aaa;font-family:monospace">${baseChekNum}-000</span>
          </div>
          <div style="font-size:11.5px;color:${meta.color};font-weight:600;margin-top:2px">${meta.dot} ${meta.label}${payments.length ? ` · ${payments.length} ta to'lov` : ""} · ${s.date}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:13px;font-weight:700;color:#0D1B2A">${fmtCur(origDebt)}</div>
          <div style="font-size:11px;color:var(--mut)">
            ${status==="paid" ? "Qarz yopildi" : `Qoldiq: ${fmtCur(currentDebt)}`}
          </div>
        </div>
        <i class="ti ti-chevron-down" id="${rowId}-icon" style="color:var(--mut);transition:.2s;flex-shrink:0"></i>
      </div>
      <div id="${rowId}-detail" style="display:none;padding:0 18px 16px 42px;background:${meta.bg}">
        <div style="background:#fff;border-radius:10px;padding:4px;margin-bottom:8px">
          <div style="height:6px;background:#F0EEE8;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${payPct}%;background:${meta.color};border-radius:3px"></div>
          </div>
        </div>
        <div style="font-size:11.5px;color:var(--mut);margin-bottom:10px">
          Qarz: <strong>${fmtCur(origDebt)}</strong> ·
          To'langan: <strong style="color:var(--grn)">${fmtCur(paidAmount)}</strong> (${payPct}%)
        </div>
        ${payments.length ? `
          <div style="display:flex;flex-direction:column;gap:6px">
            ${payments.map((p, idx) => `
              <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid var(--brd);border-radius:8px;padding:8px 12px">
                <div>
                  <span style="font-size:11.5px;font-weight:700;color:#0D1B2A;font-family:monospace">${baseChekNum}-${String(idx+1).padStart(3,"0")}</span>
                  <span style="font-size:11px;color:#aaa;margin-left:6px">${p.payDate} ${p.payTime||""}</span>
                  <span style="font-size:11px;color:var(--mut);margin-left:6px">· ${payMethodLabel(p.payMethod)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <strong style="font-size:12.5px;color:var(--grn)">${fmtMoney(p.amount, p.currency)}</strong>
                  <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();reprintDebtPayment(${p.paymentId})" title="Chekni ko'rish">
                    <i class="ti ti-printer" style="font-size:13px"></i>
                  </button>
                </div>
              </div>`).join("")}
          </div>` : `<div style="font-size:12px;color:#bbb;padding:8px 0">Hali to'lov qilinmagan</div>`}
      </div>
    </div>`;
  }).join("");
}

// ── Mijozning barcha to'lovlari (barcha cheklar bo'yicha) ────
// Mijoz "men XX.YY.ZZZZ sanada $250 to'lagandim" desa, shu funksiya
// orqali uning BARCHA to'lovlarini (qaysi chekka tegishli bo'lishidan
// qat'iy nazar) bitta ro'yxatda, sana bo'yicha ko'rsatish mumkin.
let _cphViewMode = "split"; // "split" = chek bo'yicha, "total" = umumiy to'lov bo'yicha
let _cphCustomer = { name: "", phone: "" };

function openCustPayHistory(customerName, customerPhone) {
  _cphCustomer = { name: customerName, phone: customerPhone };
  _cphViewMode = "split";
  renderCustPayHistory();
  openModal("custpayhist");
}

function cphSetMode(mode) {
  _cphViewMode = mode;
  document.querySelectorAll(".cph-mode-btn").forEach(b => {
    const on = b.dataset.m === mode;
    b.classList.toggle("on", on);
    b.style.background = on ? "#0D1B2A" : "#fff";
    b.style.color = on ? "#fff" : "#666";
  });
  renderCustPayHistory();
}

function renderCustPayHistory() {
  const { name: customerName, phone: customerPhone } = _cphCustomer;

  // Mijozga tegishli sotuvlar (chek bo'yicha taqsimot uchun)
  const allPayments = [];
  (db.sales||[]).forEach(s => {
    const cu = debtCust(s);
    if (cu.name !== customerName || cu.phone !== customerPhone) return;
    getSalePayments(s.id).forEach((p, idx) => {
      allPayments.push({ ...p, saleChekNum: s.chekNum || ("#"+s.id), partLabel: String(idx+1).padStart(3,"0") });
    });
  });
  allPayments.sort((a,b) => (a.payDate+a.payTime < b.payDate+b.payTime) ? 1 : -1);

  // Mijozga tegishli UMUMIY to'lovlar (taqsimlanmagan, asl harakat)
  const totalPayments = (db.debtPayments||[])
    .filter(p => p.customerName === customerName && p.customerPhone === customerPhone)
    .slice()
    .sort((a,b) => (a.date+a.time < b.date+b.time) ? 1 : -1);

  if ($("cph-name")) $("cph-name").textContent = customerName || "Noma'lum mijoz";
  if ($("cph-phone")) $("cph-phone").textContent = customerPhone || "";

  const totalUzs = allPayments.filter(p=>p.currency!=="usd").reduce((a,p)=>a+p.amount,0);
  const totalUsd = allPayments.filter(p=>p.currency==="usd").reduce((a,p)=>a+p.amount,0);
  if ($("cph-total")) {
    const parts = [];
    if (totalUzs > 0) parts.push(fmt(totalUzs)+" so'm");
    if (totalUsd > 0) parts.push("$"+totalUsd.toFixed(2));
    $("cph-total").textContent = parts.join(" + ") || "0";
  }

  const body = $("cph-body");
  if (!body) return;

  if (_cphViewMode === "total") {
    // Umumiy to'lov bo'yicha — har bir to'lov HARAKATI bitta qator,
    // ichida qaysi cheklarga qanday bo'linganini ko'rsatadi.
    body.innerHTML = totalPayments.length ? totalPayments.map(p => {
      const allocs = p.allocations || [];
      const allocHtml = allocs.length > 1 ? `
        <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--brd);display:flex;flex-direction:column;gap:3px">
          ${allocs.map(a => `
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--mut)">
              <span>${a.chekNum}-${String(a.partNum).padStart(3,"0")} ${a.fullyPaid?"✓ yopildi":""}</span>
              <span>${fmtMoney(a.amount, a.currency)}</span>
            </div>`).join("")}
        </div>` : "";
      return `
        <div style="padding:10px 14px;border-bottom:1px solid var(--brd)">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:12.5px;font-weight:700;color:#0D1B2A;font-family:monospace">${p.chekNum}</div>
              <div style="font-size:11px;color:#aaa;margin-top:1px">${p.date} ${p.time||""} · ${payMethodLabel(p.method)}${allocs.length>1?` · ${allocs.length} ta chekka bo'lindi`:""}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <strong style="font-size:14px;color:var(--grn)">${fmtMoney(p.amount, p.currency)}</strong>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="reprintDebtPayment(${p.id})" title="Chekni ko'rish">
                <i class="ti ti-printer" style="font-size:13px"></i>
              </button>
            </div>
          </div>
          ${allocHtml}
        </div>`;
    }).join("") : `<div style="padding:30px;text-align:center;color:#bbb">Hali to'lov qilinmagan</div>`;
  } else {
    // Chek bo'yicha taqsimot — har bir chekka tushgan qism alohida qator
    body.innerHTML = allPayments.length ? allPayments.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--brd)">
        <div>
          <div style="font-size:12.5px;font-weight:700;color:#0D1B2A;font-family:monospace">${p.saleChekNum}-${p.partLabel}</div>
          <div style="font-size:11px;color:#aaa;margin-top:1px">${p.payDate} ${p.payTime||""} · ${payMethodLabel(p.payMethod)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <strong style="font-size:13px;color:var(--grn)">${fmtMoney(p.amount, p.currency)}</strong>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="reprintDebtPayment(${p.paymentId})" title="Chekni ko'rish">
            <i class="ti ti-printer" style="font-size:13px"></i>
          </button>
        </div>
      </div>`).join("") : `<div style="padding:30px;text-align:center;color:#bbb">Hali to'lov qilinmagan</div>`;
  }

}

// ── Umumiy to'lov rejimi ───────────────────────────
// Har bir TO'LOV HARAKATI (db.debtPayments yozuvi) bitta qator —
// taqsimlanmagan, asl summa. Mijoz "300 to'laganman" desa, shu yerda
// bitta qatorda topiladi, ichida qaysi cheklarga bo'lingani ko'rinadi.
function renderQarzlarTarixiTotal() {
  const el = $("qt-list"); if (!el) return;
  const q = ($("qt-q")||{value:""}).value.toLowerCase();

  let payments = (db.debtPayments||[]).slice();

  const dateFrom = ($("qt-date-from")||{value:""}).value;
  const dateTo   = ($("qt-date-to")||{value:""}).value;
  if (dateFrom) payments = payments.filter(p => p.date >= dateFrom);
  if (dateTo)   payments = payments.filter(p => p.date <= dateTo);

  if (q) payments = payments.filter(p =>
    (p.customerName||"").toLowerCase().includes(q) ||
    (p.customerPhone||"").includes(q) ||
    (p.chekNum||"").toLowerCase().includes(q) ||
    (p.allocations||[]).some(a => (a.chekNum||"").toLowerCase().includes(q))
  );

  payments.sort((a,b) => (a.date+a.time < b.date+b.time) ? 1 : -1);

  // Statistika
  const cntAll = payments.length;
  const sumUzs = payments.filter(p=>p.currency!=="usd").reduce((a,p)=>a+p.amount,0);
  const sumUsd = payments.filter(p=>p.currency==="usd").reduce((a,p)=>a+p.amount,0);
  if ($("qt-stat-count")) $("qt-stat-count").textContent = cntAll;
  if ($("qt-stat-sum")) {
    const parts = [];
    if (sumUzs > 0) parts.push(fmt(sumUzs)+" so'm");
    if (sumUsd > 0) parts.push("$"+sumUsd.toFixed(2));
    $("qt-stat-sum").textContent = parts.join(" + ") || "0";
  }

  if (!payments.length) {
    el.innerHTML = `<div style="padding:50px;text-align:center;color:var(--mut)">
      <i class="ti ti-receipt-2" style="font-size:36px;display:block;margin-bottom:10px;opacity:.4"></i>
      Hech narsa topilmadi</div>`;
    return;
  }

  el.innerHTML = payments.map(p => {
    const allocs = p.allocations || [];
    const allocHtml = allocs.length ? `
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--brd);display:flex;flex-direction:column;gap:4px">
        ${allocs.map(a => `
          <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--mut)">
            <span>${a.chekNum}-${String(a.partNum).padStart(3,"0")} ${a.fullyPaid?'<span style="color:var(--grn)">✓ yopildi</span>':""}</span>
            <span>${fmtMoney(a.amount, a.currency)}</span>
          </div>`).join("")}
      </div>` : "";

    return `<div style="padding:14px 18px;border-bottom:1px solid var(--brd)">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <strong style="font-size:13.5px;color:#0D1B2A;cursor:pointer;text-decoration:underline;text-decoration-style:dotted"
              onclick="openCustPayHistory('${(p.customerName||"").replace(/'/g,"\\'")}','${(p.customerPhone||"").replace(/'/g,"\\'")}')"
              title="Bu mijozning barcha to'lovlari">${p.customerName||"Noma'lum mijoz"}</strong>
            <span style="font-size:11.5px;color:#aaa;font-family:monospace">${p.chekNum}</span>
          </div>
          <div style="font-size:11.5px;color:var(--mut);margin-top:2px">${p.date} ${p.time||""} · ${payMethodLabel(p.method)}${allocs.length>1?` · ${allocs.length} ta chekka bo'lindi`:""}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <strong style="font-size:15px;color:var(--grn)">${fmtMoney(p.amount, p.currency)}</strong>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="reprintDebtPayment(${p.id})" title="Chekni ko'rish">
            <i class="ti ti-printer" style="font-size:14px"></i>
          </button>
        </div>
      </div>
      ${allocHtml}
    </div>`;
  }).join("");
}

function qtToggleExpand(saleId) {
  const detail = $(`qt-row-${saleId}-detail`);
  const icon = $(`qt-row-${saleId}-icon`);
  if (!detail) return;
  const isOpen = detail.style.display !== "none";
  detail.style.display = isOpen ? "none" : "block";
  if (icon) icon.style.transform = isOpen ? "" : "rotate(180deg)";
}

function payMethodLabel(m) {
  const labels = { naqd: "Naqd", karta: "Karta", otkazma: "O'tkazma", balans: "💰 Balans" };
  return labels[m] || "Naqd";
}

// ── Excel eksport ──────────────────────────────────
function exportQarzTarixiExcel() {
  if (qtViewMode === "total") {
    // Umumiy to'lov rejimi — har bir to'lov harakati bitta qator
    const rows = [["To'lov chek raqami","Sana","Vaqt","Mijoz","Telefon","Summa","Valyuta","Usul","Nechta chekka bo'lindi","Tafsilot"]];
    let payments = (db.debtPayments||[]).slice();
    const dateFrom = ($("qt-date-from")||{value:""}).value;
    const dateTo   = ($("qt-date-to")||{value:""}).value;
    if (dateFrom) payments = payments.filter(p => p.date >= dateFrom);
    if (dateTo)   payments = payments.filter(p => p.date <= dateTo);
    payments.sort((a,b) => (a.date+a.time < b.date+b.time) ? -1 : 1);

    payments.forEach(p => {
      const allocs = p.allocations || [];
      const detail = allocs.map(a => `${a.chekNum}-${String(a.partNum).padStart(3,"0")}: ${fmtMoney(a.amount,a.currency)}`).join("; ");
      rows.push([
        p.chekNum, p.date, p.time||"", p.customerName||"", p.customerPhone||"",
        p.amount, p.currency==="usd"?"USD":"UZS", payMethodLabel(p.method),
        allocs.length, detail
      ]);
    });
    downloadCSV(rows, `merx_qarz_tolovlari_${today()}.csv`);
    toast("Excel yuklab olindi");
    return;
  }

  // Split rejimi — har bir chek bitta qator, boshlang'ich/joriy qarz bilan
  const rate = db.settings?.rate || 12800;
  const isUsdSale = s => s.debtCurrency === "usd";
  const getOrigDebt = s => {
    if (isUsdSale(s)) {
      if (s.origDebtUsd != null) return s.origDebtUsd;
      const paidUsd = getSalePayments(s.id).filter(p=>p.currency==="usd").reduce((a,p)=>a+(p.amount||0),0);
      return Math.max(0, (s.debtUsd||0) + paidUsd);
    }
    if (s.origRemaining != null) return s.origRemaining;
    const paidViaPayments = getSalePayments(s.id).reduce((a,p) => a + (p.currency==="usd" ? p.amount*rate : p.amount), 0);
    const origPaidGuess = Math.max(0, (s.paid||0) - paidViaPayments);
    return Math.max(0, (s.total||0) - origPaidGuess);
  };

  const rows = [["Chek raqami","Sana","Mijoz","Telefon","Valyuta","Boshlang'ich qarz","Joriy qoldiq","To'langan","Holat","To'lovlar soni"]];
  const statusLabels = { paid:"To'liq to'langan", partial:"Qisman to'langan", unpaid:"To'lanmagan" };

  (db.sales||[]).forEach(s => {
    const origDebt = getOrigDebt(s);
    if (origDebt <= 0.005 || s.status === "qaytarilgan") return;
    const st = calcSaleState(s);
    const isUsd = isUsdSale(s);
    const currentDebt = isUsd ? st.debtUsd : st.remaining;
    const payments = getSalePayments(s.id);
    let status;
    if (currentDebt <= (isUsd?0.005:0.5)) status = "paid";
    else if (payments.length > 0) status = "partial";
    else status = "unpaid";

    if (qtStatus !== "all" && status !== qtStatus) return;

    rows.push([
      s.chekNum||("#"+s.id), s.date, s.customerName||"", s.customerPhone||"",
      isUsd?"USD":"UZS", origDebt, currentDebt, origDebt-currentDebt,
      statusLabels[status], payments.length
    ]);
  });

  downloadCSV(rows, `merx_qarzlar_tarixi_${today()}.csv`);
  toast("Excel yuklab olindi");
}

