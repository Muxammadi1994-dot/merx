// MERX dashboard.js | v3.0 | 2026-06-18
// ================================================

let dashPeriod     = 0;    // 0=bugun, 1=kecha, 7=hafta, 30=oy, 365=yil, -1=barchasi, -2=custom
let dashCustomFrom = null;
let dashCustomTo   = null;
let dashCalOpen    = false;

// ── Yordamchi funksiyalar ──────────────────────
function fmtK(n) {
  if (!n || isNaN(n)) return "0";
  return Math.round(n).toLocaleString("ru-RU");
}

function dashGreeting() {
  const h = new Date().getHours();
  if (h < 6)  return 'Xayrli tun';
  if (h < 12) return 'Xayrli tong';
  if (h < 18) return 'Xayrli kun';
  return 'Xayrli oqshom';
}

function dashDateStr() {
  const days   = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
  const months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  const d = new Date();
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function priceFmt(uzs, forceSom) {
  const r = db.settings?.rate || 12800;
  const u = !forceSom && db.settings?.priceCurrency === 'usd';
  if (u) return (uzs/r).toFixed(0) + ' $';
  return fmtK(uzs) + " so'm";
}

// ── Davr bo'yicha sales filtrlash ──────────────
function dashPeriodName() {
  if (dashPeriod === -2) return "tanlangan davr";
  return ({ "0":"bugun", "1":"kecha", "7":"7 kun", "30":"30 kun", "365":"1 yil", "-1":"barchasi" })[String(dashPeriod)] || "bugun";
}

function dashGetSales() {
  const t = today();
  if (dashPeriod === -2 && dashCustomFrom && dashCustomTo) {
    return db.sales.filter(s => s.date >= dashCustomFrom && s.date <= dashCustomTo);
  }
  if (dashPeriod === -1) return db.sales; // barchasi
  if (dashPeriod === 0)  return db.sales.filter(s => s.date === t);
  if (dashPeriod === 1)  return db.sales.filter(s => s.date === addDays(t, -1));
  const start = addDays(t, -(dashPeriod - 1));
  return db.sales.filter(s => s.date >= start);
}

function dashGetDateRange() {
  const t = today();
  if (dashPeriod === -2 && dashCustomFrom) return { from: dashCustomFrom, to: dashCustomTo || t };
  if (dashPeriod === -1) {
    const all = db.sales.map(s => s.date).sort();
    return { from: all[0] || t, to: t };
  }
  if (dashPeriod === 0) return { from: t, to: t };
  if (dashPeriod === 1) return { from: addDays(t,-1), to: addDays(t,-1) };
  return { from: addDays(t, -(dashPeriod-1)), to: t };
}

// ── Asosiy render ──────────────────────────────
function renderDashboard() {
  if (typeof checkAutoRate === "function") checkAutoRate(false); // v166: kunlik avtomatik kurs tekshiruvi (faqat 'avtomatik' rejimda, kuniga 1 marta)
  if (!db?.sales) return;
  const t = today();

  const todaySales = db.sales.filter(s => s.date === t);
  const ystSales   = db.sales.filter(s => s.date === addDays(t, -1));
  const todayTotal = todaySales.reduce((a, s) => a + s.total, 0);
  const ystTotal   = ystSales.reduce((a, s) => a + s.total, 0);
  const todayCnt   = todaySales.length;
  const growth     = ystTotal > 0 ? Math.round((todayTotal - ystTotal) / ystTotal * 100) : null;

  const debts       = debtSales();
  const totalDebt   = debts.reduce((a, s) => a + calcSaleState(s).remaining, 0);
  const overdueList = debts.filter(isOverdue);

  // Kassaga tushdi — payBreakdown + debtPayments (nasiyasiz)
  const rate = db.settings?.rate || 12800;
  // 2026-07-17: kassa/naqd ko'rsatkichlari DAVR tugmalariga bo'ysunadi
  const _perSales = dashGetSales();
  const _pr = dashGetDateRange();
  let todayKassa = 0;
  _perSales.forEach(s => {
    const pb = s.payBreakdown;
    if (pb && (pb.naqd||pb.karta||pb.otkazma)) {
      todayKassa += (pb.naqd||0) + (pb.karta||0) + (pb.otkazma||0);
    } else {
      todayKassa += s.payType === "nasiya" ? 0 : (s.paid||0);
    }
  });
  activePays().filter(p => p.date >= _pr.from && p.date <= _pr.to).forEach(p => {
    todayKassa += p.currency === "usd" ? Math.round(p.amount * rate) : (p.amount||0);
  });

  // №16 (v145): KASSA NAQD ko'rsatkichlari.
  // "Naqd tushdi" = sotuv naqd ulushi + qarz to'lovlari naqd ulushi
  // (aralashda FAQAT naqd qismi — methodBreakdown). "Kassada qoldi" =
  // naqd tushum − bugungi NAQD xarajatlar.
  let kassaNaqd = 0;
  _perSales.forEach(s => {
    const pb = s.payBreakdown;
    if (pb && (pb.naqd || pb.karta || pb.otkazma)) kassaNaqd += (pb.naqd || 0);
    else if (s.payType === "naqd") kassaNaqd += (s.paid || 0);
  });
  activePays().filter(p => p.date >= _pr.from && p.date <= _pr.to).forEach(p => {
    const somAmt = p.amountSom || (p.currency === "usd" ? Math.round((p.amount||0) * rate) : (p.amount || 0));
    const mb = p.methodBreakdown;
    const mbHas = mb && Object.keys(mb).some(k => (mb[k]||0) > 0);
    if (mbHas) kassaNaqd += (mb.naqd || 0);
    else if ((p.method || "naqd") === "naqd") kassaNaqd += somAmt;
  });
  const naqdXarajat = (db.xarajatlar || [])
    .filter(x => x.date >= _pr.from && x.date <= _pr.to && (x.method || "naqd") === "naqd")
    .reduce((a, x) => a + (x.amount || 0), 0);
  const kassadaQoldi = kassaNaqd - naqdXarajat;

  const lowThreshold = db.settings?.lowStockLimit || 5;
  const lowStock = [];
  db.products.forEach(p => {
    const minQty = p.minStock || lowThreshold;
    p.variants.forEach(v => {
      if (v.qty >= 0 && v.qty <= minQty)
        lowStock.push({ name: p.name, sku: p.sku, color: v.color, size: v.size, qty: v.qty, unit: p.unit || 'dona', min: minQty, zero: v.qty === 0 });
    });
  });
  lowStock.sort((a, b) => a.qty - b.qty);

  renderDashHeader(todayTotal, todayCnt, growth, todayKassa, kassaNaqd, kassadaQoldi);
  applyDashBanner();
  renderDashKpis(todayCnt, todayTotal, totalDebt, debts.length, overdueList.length);
  renderDashChart();
  renderDashDonut();
  renderDashPriceType();
  renderDashTops();
  renderDashAlerts(lowStock);
  renderDashSalesTable();
  renderDashDebtTable(debts);
  updateDashCurrencyPill();
}

// ── Header ─────────────────────────────────────
function renderDashHeader(todayTotal, todayCnt, growth, kassaTushdi, kassaNaqd, kassadaQoldi) {
  const el = $('dash-header');
  if (!el) return;
  const growHtml = growth !== null
    ? `<span class="dash-growth ${growth >= 0 ? 'up' : 'dn'}">${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth)}%</span>`
    : `<span class="dash-growth" style="color:rgba(255,255,255,.35);font-weight:400">— birinchi kun</span>`;
  const kassaHtml = (kassaTushdi !== undefined && kassaTushdi !== todayTotal)
    ? `<div style="font-size:12px;margin-top:4px;color:rgba(255,255,255,.6)">
        Kassaga tushdi: <span style="color:#4ade80;font-weight:700">${priceFmt(kassaTushdi, true)}</span>
       </div>` : "";
  const naqdHtml = (kassaNaqd !== undefined)
    ? `<div style="font-size:12px;margin-top:2px;color:rgba(255,255,255,.6)">
        Naqd tushdi: <span style="color:#4ade80;font-weight:700">${priceFmt(kassaNaqd, true)}</span>
        &nbsp;·&nbsp; Kassada qoldi: <span style="color:${kassadaQoldi >= 0 ? '#fbbf24' : '#f87171'};font-weight:700">${priceFmt(kassadaQoldi, true)}</span>
       </div>` : "";
  el.innerHTML = `
    <div class="dh-left">
      <div class="dh-greet">${dashGreeting()}, <strong>${db.shop?.name || 'MERX Do\'koni'}</strong></div>
      <div class="dh-date"><i class="ti ti-calendar" style="font-size:12px;margin-right:4px"></i>${dashDateStr()}</div>
    </div>
    <div class="dh-center">
      <div class="dh-lbl">Bugungi sotuv</div>
      <div class="dh-val">${priceFmt(todayTotal, true)}</div>
      <div style="font-size:12px;margin-top:3px;color:rgba(255,255,255,.45)">${todayCnt} ta tranzaksiya ${growHtml}</div>
      ${kassaHtml}
      ${naqdHtml}
    </div>
    <div class="dh-right">
      <button class="btn btn-acc" onclick="nav('pos')" style="font-weight:600">
        <i class="ti ti-plus"></i> Yangi sotuv
      </button>
      <button class="btn" onclick="nav('qarzlar')"
        style="background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.18);font-size:13px">
        <i class="ti ti-credit-card"></i> Qarzlar
      </button>
    </div>
  `;
}

// ── Banner yashirish/ko'rsatish ────────────────
function dashToggleBanner() {
  const hidden = db.settings?.dashHideBanner;
  db.settings.dashHideBanner = !hidden;
  saveDB();
  applyDashBanner();
}

function applyDashBanner() {
  const hidden = db.settings?.dashHideBanner;
  const hdr = $('dash-header');
  if (hdr) hdr.style.display = hidden ? 'none' : '';
  const lbl = $('dash-banner-btn-lbl');
  if (lbl) lbl.textContent = hidden ? "bannerni ko'rsatish" : "bannerni yashirish";
  const btn = lbl?.parentElement;
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) icon.className = hidden ? 'ti ti-eye' : 'ti ti-eye-off';
    icon.style.fontSize = '12px';
  }
}

// ── KPI kartochkalar ───────────────────────────
const KPI_DEFAULTS = {
  kassa: true, naqdtushdi: true, kassaqoldi: true, sotuvlar: true, ortacha: true, qarz: true, muddati: true, ombor: true,
  kartatushum: true, naqdxarajat: true, kartaxarajat: true, umumiyxarajat: true // 2026-07-19
};

function dashGetKpiCols() {
  return Object.assign({}, KPI_DEFAULTS, db.settings?.dashKpiCols || {});
}

function dashToggleKpis() {
  const panel = $('dash-kpi-panel');
  if (!panel) return;
  const open = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  if (open) dashRenderKpiPanel();
}

function dashRenderKpiPanel() {
  const cols = dashGetKpiCols();
  const defs = [
    { key:'kassa',    lbl:'Kassaga tushdi' },
    { key:'naqdtushdi', lbl:'Naqd tushdi' },
    { key:'kassaqoldi', lbl:'Kassada qoldi' },
    { key:'sotuvlar', lbl:'Sotuvlar soni' },
    { key:'ortacha',  lbl:"O'rtacha chek" },
    { key:'qarz',     lbl:'Jami qarz' },
    { key:'muddati',  lbl:"Muddati o'tgan" },
    { key:'ombor',    lbl:'Kam qoldiq' },
    { key:'kartatushum',   lbl:'Kartaga tushum' },
    { key:'naqdxarajat',   lbl:'Naqd xarajatlar' },
    { key:'kartaxarajat',  lbl:'Karta xarajatlar' },
    { key:'umumiyxarajat', lbl:'Umumiy xarajatlar' },
  ];
  $('dash-kpi-panel').innerHTML = `
    <div style="padding:10px 4px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em">Ko'rinadigan kartochkalar:</span>
      ${defs.map(d => `
        <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;
          background:${cols[d.key]?"#E9A50018":"var(--bg)"};
          border:1.5px solid ${cols[d.key]?"#E9A500":"var(--brd)"};
          padding:4px 11px;border-radius:8px;transition:.15s">
          <input type="checkbox" ${cols[d.key]?"checked":""} onchange="dashToggleKpi('${d.key}',this.checked)"
            style="accent-color:var(--acc)">
          ${d.lbl}
        </label>`).join('')}
    </div>`;
}

function dashToggleKpi(key, val) {
  if (!db.settings.dashKpiCols) db.settings.dashKpiCols = {};
  db.settings.dashKpiCols[key] = val;
  saveDB(); dashRenderKpiPanel(); renderDashKpis();
}

function renderDashKpis(todayCnt, todayTotal, totalDebt, debtCnt, overdueCnt) {
  // 2026-07-17: kartalar endi DAVR tugmalariga BO'YSUNADI — argumentlar
  // e'tiborga olinmaydi, hamma son dashGetSales/dashGetDateRange'dan
  // (grafiklar bilan BIR manba). Qarz/muddati/ombor — holat, davrsiz.
  {
    const perSales = dashGetSales();
    todayCnt   = perSales.length;
    todayTotal = perSales.reduce((a,s) => a+(s.total||0), 0);
    const dts  = debtSales();
    totalDebt  = dts.reduce((a,s) => a+s.remaining, 0);
    debtCnt    = dts.length;
    overdueCnt = dts.filter(isOverdue).length;
  }

  const cols     = dashGetKpiCols();
  const avgCheck = todayCnt ? Math.round(todayTotal / todayCnt) : 0;

  // Kassaga tushdi — davr bo'yicha
  const _rate = db.settings?.rate || 12800;
  const _pr2  = dashGetDateRange();
  let kassaTushdiKpi = 0;
  dashGetSales().forEach(s => {
    const pb = s.payBreakdown;
    if (pb && (pb.naqd||pb.karta||pb.otkazma)) kassaTushdiKpi += (pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
    else kassaTushdiKpi += s.payType === "nasiya" ? 0 : (s.paid||0);
  });
  activePays().filter(p => p.date >= _pr2.from && p.date <= _pr2.to).forEach(p => {
    kassaTushdiKpi += p.currency === "usd" ? Math.round(p.amount*_rate) : (p.amount||0);
  });

  // №16 (v145): KASSA NAQD ko'rsatkichlari.
  // "Naqd tushdi" = sotuv naqd ulushi + qarz to'lovlari naqd ulushi
  // (aralashda FAQAT naqd qismi — methodBreakdown). "Kassada qoldi" =
  // naqd tushum − bugungi NAQD xarajatlar.
  let kassaNaqd = 0, kartaTushum = 0;
  dashGetSales().forEach(s => {
    const pb = s.payBreakdown;
    if (pb && (pb.naqd || pb.karta || pb.otkazma)) { kassaNaqd += (pb.naqd || 0); kartaTushum += (pb.karta || 0); }
    else if (s.payType === "naqd") kassaNaqd += (s.paid || 0);
    else if (s.payType === "karta") kartaTushum += (s.paid || 0);
  });
  activePays().filter(p => p.date >= _pr2.from && p.date <= _pr2.to).forEach(p => {
    const somAmt = p.amountSom || (p.currency === "usd" ? Math.round((p.amount||0) * _rate) : (p.amount || 0));
    const mb = p.methodBreakdown;
    const mbHas = mb && Object.keys(mb).some(k => (mb[k]||0) > 0);
    if (mbHas) { kassaNaqd += (mb.naqd || 0); kartaTushum += (mb.karta || 0); }
    else if ((p.method || "naqd") === "naqd") kassaNaqd += somAmt;
    else if (p.method === "karta") kartaTushum += somAmt;
  });
  // 2026-07-19: xarajatlar — naqd / karta / umumiy (4 yangi KPI kartasi uchun)
  const _expsInPeriod = (db.xarajatlar || []).filter(x => x.date >= _pr2.from && x.date <= _pr2.to);
  const naqdXarajatKpi  = _expsInPeriod.filter(x => (x.method||"naqd") === "naqd").reduce((a,x)=>a+(x.amount||0),0);
  const kartaXarajatKpi = _expsInPeriod.filter(x => x.method === "karta").reduce((a,x)=>a+(x.amount||0),0);
  const umumiyXarajatKpi= _expsInPeriod.reduce((a,x)=>a+(x.amount||0),0);
  const naqdXarajat = (db.xarajatlar || [])
    .filter(x => x.date >= _pr2.from && x.date <= _pr2.to && (x.method || "naqd") === "naqd")
    .reduce((a, x) => a + (x.amount || 0), 0);
  const kassadaQoldi = kassaNaqd - naqdXarajat;

  const lowThreshold = db.settings?.lowStockLimit || 5;
  const lowCnt = db.products.reduce((a, p) =>
    a + p.variants.filter(v => v.qty >= 0 && v.qty <= lowThreshold).length, 0);

  const allCards = [
    {
      key: 'kassa',
      icon: 'ti-cash', color: '#36B48C',
      label: 'Kassaga tushdi', val: priceFmt(kassaTushdiKpi, true),
      sub: dashPeriodName() + ' (nasiyasiz)', click: "nav('moliya')"
    },
    {
      key: 'naqdtushdi',
      icon: 'ti-coin', color: '#36B48C',
      label: 'Naqd tushdi', val: priceFmt(kassaNaqd, true),
      sub: "naqd · " + dashPeriodName(), click: "nav('moliya')"
    },
    {
      key: 'kassaqoldi',
      icon: 'ti-building-bank', color: kassadaQoldi >= 0 ? '#E9A500' : '#E05A5A',
      label: 'Kassada qoldi', val: priceFmt(kassadaQoldi, true),
      sub: 'tushum − xarajat · ' + dashPeriodName(), click: "nav('moliya')"
    },
    {
      key: 'sotuvlar',
      icon: 'ti-shopping-bag', color: '#4C9BE8',
      label: 'Sotuvlar soni', val: todayCnt + ' ta',
      sub: 'tranzaksiya · ' + dashPeriodName(), click: "nav('tarix')"
    },
    {
      key: 'ortacha',
      icon: 'ti-receipt', color: '#36B48C',
      label: "O'rtacha chek", val: todayCnt ? priceFmt(avgCheck, true) : '—',
      sub: "o'rtacha · " + dashPeriodName(), click: "nav('tarix')"
    },
    {
      key: 'qarz',
      icon: 'ti-credit-card', color: '#E07B39',
      label: 'Jami qarz', val: priceFmt(totalDebt, true),
      sub: debtCnt + ' nafar qarzdor', click: "nav('qarzlar')"
    },
    {
      key: 'muddati',
      icon: 'ti-clock-exclamation',
      color: overdueCnt > 0 ? '#E05A5A' : '#36B48C',
      label: "Muddati o'tgan", val: overdueCnt + ' ta',
      sub: overdueCnt > 0 ? '<span style="color:#E05A5A;font-weight:700">Zudlik bilan!</span>' : 'Hammasi tartibda',
      click: "nav('qarzlar')"
    },
    {
      key: 'ombor',
      icon: 'ti-alert-triangle',
      color: lowCnt > 0 ? '#E9A500' : '#36B48C',
      label: 'Kam qoldiq', val: lowCnt + ' ta variant',
      sub: lowCnt > 0 ? 'zaxirani to\'ldirish kerak' : 'ombor yetarli',
      click: "nav('ombor')"
    },
    {
      key: 'kartatushum',
      icon: 'ti-credit-card', color: '#4C9BE8',
      label: 'Kartaga tushum', val: priceFmt(kartaTushum, true),
      sub: 'karta · ' + dashPeriodName(), click: "nav('moliya')"
    },
    {
      key: 'naqdxarajat',
      icon: 'ti-cash-off', color: '#E05A5A',
      label: 'Naqd xarajatlar', val: priceFmt(naqdXarajatKpi, true),
      sub: 'naqd · ' + dashPeriodName(), click: "nav('moliya')"
    },
    {
      key: 'kartaxarajat',
      icon: 'ti-credit-card-off', color: '#E05A5A',
      label: 'Karta xarajatlar', val: priceFmt(kartaXarajatKpi, true),
      sub: 'karta · ' + dashPeriodName(), click: "nav('moliya')"
    },
    {
      key: 'umumiyxarajat',
      icon: 'ti-receipt-off', color: '#E07B39',
      label: 'Umumiy xarajatlar', val: priceFmt(umumiyXarajatKpi, true),
      sub: 'jami · ' + dashPeriodName(), click: "nav('moliya')"
    },
  ];

  const el = $('dash-kpis');
  if (!el) return;
  el.innerHTML = allCards
    .filter(c => cols[c.key] !== false)
    .map(c => `
    <div class="dkpi-card" onclick="${c.click}" style="cursor:pointer">
      <div class="dkpi-top">
        <div class="dkpi-ico" style="background:${c.color}18;color:${c.color}">
          <i class="ti ${c.icon}"></i>
        </div>
        <span class="dkpi-lbl">${c.label}</span>
      </div>
      <div class="dkpi-val">${c.val}</div>
      <div class="dkpi-sub">${c.sub}</div>
    </div>
  `).join('');
}

// ── Davr tugmalari ─────────────────────────────
function dashSetPeriod(p) {
  dashPeriod = p;
  dashCustomFrom = null;
  dashCustomTo   = null;
  dashCalOpen = false;
  const cal = $('dash-calendar');
  if (cal) cal.style.display = 'none';
  const lbl = $('dash-custom-lbl');
  if (lbl) lbl.style.display = 'none';
  document.querySelectorAll('.dash-ptab').forEach(b => {
    const bp = b.dataset.p !== undefined ? +b.dataset.p : null;
    b.classList.toggle('on', bp === p && p !== -2);
  });
  renderDashboard(); // 2026-07-17: header + KPI kartalar + grafiklar — hammasi davrga mos yangilanadi
}

function dashToggleCalendar() {
  dashCalOpen = !dashCalOpen;
  const cal = $('dash-calendar');
  if (cal) cal.style.display = dashCalOpen ? 'block' : 'none';
  if (dashCalOpen) {
    const t = today();
    const from = $('dash-from');
    const to   = $('dash-to');
    if (from && !from.value) from.value = addDays(t, -30);
    if (to   && !to.value)   to.value   = t;
  }
}

function dashQuick(type) {
  const t = today();
  const from = $('dash-from');
  const to   = $('dash-to');
  if (!from || !to) return;
  const map = {
    today:     { f: t,                   t: t },
    yesterday: { f: addDays(t,-1),       t: addDays(t,-1) },
    week:      { f: addDays(t,-6),       t: t },
    month:     { f: t.slice(0,7)+'-01',  t: t },
    year:      { f: t.slice(0,4)+'-01-01', t: t },
  };
  if (map[type]) { from.value = map[type].f; to.value = map[type].t; }
}

function dashApplyCustom() {
  const from = ($('dash-from')||{value:''}).value;
  const to   = ($('dash-to')||{value:''}).value;
  if (!from || !to) { toast("Sana oraliq tanlang","err"); return; }
  if (from > to)    { toast("'Dan' sanasi 'Gacha' dan kichik bo'lishi kerak","err"); return; }
  dashCustomFrom = from;
  dashCustomTo   = to;
  dashPeriod     = -2;
  document.querySelectorAll('.dash-ptab').forEach(b => b.classList.remove('on'));
  const btn = $('dash-custom-btn');
  if (btn) btn.classList.add('on');
  const lbl = $('dash-custom-lbl');
  if (lbl) {
    lbl.style.display = 'inline';
    lbl.textContent   = from.slice(5) + ' – ' + to.slice(5);
  }
  renderDashboard(); // 2026-07-17: header + KPI kartalar ham davrga mos
  toast(`${from} — ${to} oraliq qo'llandi`);
}

function dashClearCustom() {
  dashCustomFrom = null;
  dashCustomTo   = null;
  const lbl = $('dash-custom-lbl');
  if (lbl) lbl.style.display = 'none';
  dashSetPeriod(0);
}

// ── Ustun diagramma ────────────────────────────
function renderDashChart() {
  const el = $('dash-chart');
  if (!el) return;

  const { from, to } = dashGetDateRange();

  // Kun soni
  const msDay = 86400000;
  const diffDays = Math.round((new Date(to) - new Date(from)) / msDay) + 1;

  const data = [];
  for (let i = 0; i < diffDays; i++) {
    const d = addDays(from, i);
    const total = db.sales.filter(s => s.date === d).reduce((a, s) => a + s.total, 0);
    const dObj = new Date(d);
    const wdays = ['Ya','Du','Se','Ch','Pa','Ju','Sh'];
    let lbl;
    if (diffDays <= 7)  lbl = wdays[dObj.getDay()];
    else if (diffDays <= 31) lbl = String(dObj.getDate());
    else lbl = String(dObj.getMonth() + 1) + '/' + String(dObj.getFullYear()).slice(2);
    data.push({ d, label: lbl, total, isToday: d === today() });
  }

  if (!data.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:#bbb">Ma\'lumot yo\'q</div>'; return; }

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const W = 580, H = 180, pL = 52, pB = 28, pT = 24, pR = 16;
  const cW = W - pL - pR, cH = H - pB - pT;
  // Minimal 7 slot ko'rsatamiz (1-2 kun bo'lsa ham chiroyli ko'rinadi)
  const slots = Math.max(data.length, 7);
  const barW  = Math.min(40, Math.max(4, Math.floor(cW / slots * 0.6)));
  const gap   = cW / slots;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const y = pT + cH - pct * cH;
    return `
      <line x1="${pL}" y1="${y}" x2="${W - pR}" y2="${y}"
            stroke="#e8e5df" stroke-width="1" ${pct > 0 ? 'stroke-dasharray="4 4"' : ''}/>
      <text x="${pL - 6}" y="${y + 4}" text-anchor="end"
            fill="#bbb" font-size="10">${fmtK(maxVal * pct)}</text>`;
  }).join('');

  const bars = data.map((d, i) => {
    // data.length < slots bo'lsa — o'rtaga hizalaymiz
    const offset = (slots - data.length) / 2;
    const x  = pL + gap * (i + offset) + gap / 2;
    const bh = Math.max(2, (d.total / maxVal) * cH);
    const by = pT + cH - bh;
    const fill = '#4C9BE8';
    const tip  = `${d.d}: ${fmtK(d.total)} so'm`;
    return `
      <rect x="${x - barW/2}" y="${by}" width="${barW}" height="${bh}"
            fill="${fill}" rx="3" opacity="${d.total ? 1 : 0.15}">
        <title>${tip}</title>
      </rect>
      <text x="${x}" y="${H - 6}" text-anchor="middle" fill="#aaa" font-size="${slots > 30 ? 8 : 10}">
        ${slots <= 60 ? d.label : ''}
      </text>`;
  }).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;overflow:visible">
    ${gridLines}${bars}
  </svg>`;
}

// ── Donut: to'lov usullari ─────────────────────
function renderDashDonut() {
  const el = $('dash-donut');
  if (!el) return;
  const sales = dashGetSales();

  const payLabels = { naqd:'Naqd', karta:'Karta', otkazma:"O'tkazma", nasiya:'Nasiya', qarz:'Qarz (nasiya)' };
  const payColors = { naqd:'#36B48C', karta:'#4C9BE8', otkazma:'#8B5CF6', nasiya:'#E07B39', qarz:'#E05A5A' };

  const types = {};
  let totalQarz = 0;
  for (const s of sales) {
    const k = s.payType || s.pay_type || 'boshqa';
    const rem = s.remaining || 0;
    if (rem > 0) totalQarz += rem;

    if (k === 'aralash' && (s.payBreakdown || s.pay_breakdown)) {
      // Aralash to'lov — har bir usul summasi o'z turkumiga qo'shiladi
      const breakdown = s.payBreakdown || s.pay_breakdown;
      Object.entries(breakdown).forEach(([method, amount]) => {
        if (amount > 0) types[method] = (types[method] || 0) + amount;
      });
    } else {
      // To'langan summa (nasiya chiqiriladi)
      const paid = s.paid || s.total || 0;
      if (paid > 0) types[k] = (types[k] || 0) + paid;
    }
  }
  // Nasiya alohida ko'rsatamiz
  if (totalQarz > 0) types['qarz'] = totalQarz;

  const total = Object.values(types).reduce((a, b) => a + b, 0);
  if (!total) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:#bbb;font-size:13px">
      <i class="ti ti-chart-donut" style="font-size:24px;display:block;margin-bottom:6px"></i>Ma'lumot yo'q</div>`;
    return;
  }

  // Qarzni oxirga chiqaramiz
  const entries = Object.entries(types)
    .filter(([,v]) => v > 0)
    .sort(([a],[b]) => (a==='qarz'?1:0) - (b==='qarz'?1:0));
  const R = 52, cx = 62, cy = 62, gap = 0.03;
  let angle = -Math.PI / 2;

  const paths = entries.map(([key, val]) => {
    const pct  = val / total;
    const a1   = angle + gap;
    const a2   = angle + pct * Math.PI * 2 - gap;
    const x1   = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const x2   = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
    const large = pct > 0.5 ? 1 : 0;
    const color = payColors[key] || '#aaa';
    const path  = `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}" opacity=".9"/>`;
    angle += pct * Math.PI * 2;
    return { key, val, pct, color, path };
  });

  const legend = entries.map(([key, val]) => {
    const c = payColors[key] || '#aaa';
    const lbl = payLabels[key] || key;
    const isQarz = key === 'qarz';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;
      ${isQarz ? 'border-top:1px dashed #fca5a5;margin-top:4px;padding-top:6px' : ''}">
      <div style="display:flex;align-items:center;gap:7px">
        <div style="width:10px;height:10px;border-radius:${isQarz?'3px':'50%'};background:${c};flex-shrink:0"></div>
        <span style="font-size:12.5px;color:${isQarz?'#E05A5A':'#555'};font-weight:${isQarz?'700':'400'}">${lbl}</span>
      </div>
      <span style="font-size:12px;font-weight:700;color:${isQarz?'#E05A5A':'#0D1B2A'}">${fmtK(val)} so'm</span>
    </div>`;
  }).join('');

  el.innerHTML = `<div style="display:flex;align-items:center;gap:16px;padding:4px 0 8px">
    <svg viewBox="0 0 124 124" style="width:90px;flex-shrink:0">
      ${paths.map(p => p.path).join('')}
      <circle cx="${cx}" cy="${cy}" r="${R*0.52}" fill="white"/>
      <text x="${cx}" y="${cy-5}" text-anchor="middle" font-size="10" fill="#888">Jami</text>
      <text x="${cx}" y="${cy+9}" text-anchor="middle" font-size="11" font-weight="700" fill="#0D1B2A">${fmtK(total)}</text>
    </svg>
    <div style="flex:1;min-width:0">${legend}</div>
  </div>`;
}

// ── Chakana / Ulgurji ──────────────────────────
function renderDashPriceType() {
  const el = $('dash-pricetype');
  if (!el) return;

  const { from, to } = dashGetDateRange();
  const payments = activePays().filter(p => p.date >= from && p.date <= to);

  const rate = db.settings?.rate || 12800;
  const toUzs = p => p.currency === 'usd' ? p.amount * rate : p.amount;
  const methodColors = { naqd:'#36B48C', karta:'#4C9BE8', otkazma:'#8B5CF6', balans:'#E9A500' };
  const methodLabels = { naqd:'Naqd', karta:'Karta', otkazma:"O'tkazma", balans:'Balansdan' };

  const byMethod = {};
  payments.forEach(p => {
    // v147 (audit): ARALASH to'lov usullarga BO'LINADI (methodBreakdown,
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

  const total = Object.values(byMethod).reduce((a, b) => a + b, 0);
  if (!total) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:#bbb;font-size:13px">
      <i class="ti ti-chart-donut" style="font-size:24px;display:block;margin-bottom:6px"></i>Shu davrda to'lov bo'lmagan</div>`;
    return;
  }

  const entries = Object.entries(byMethod).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
  const R = 52, cx = 62, cy = 62, gap = 0.03;
  let angle = -Math.PI / 2;
  const paths = entries.map(([key, val]) => {
    const pct = val / total;
    const a1 = angle + gap, a2 = angle + pct * Math.PI * 2 - gap;
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
    const color = methodColors[key] || '#aaa';
    const path = `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${pct>.5?1:0} 1 ${x2} ${y2} Z" fill="${color}" opacity=".9"/>`;
    angle += pct * Math.PI * 2;
    return { key, val, color, path };
  });

  const legend = entries.map(([key, val]) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0">
      <div style="display:flex;align-items:center;gap:7px">
        <div style="width:10px;height:10px;border-radius:50%;background:${methodColors[key]||'#aaa'};flex-shrink:0"></div>
        <span style="font-size:12.5px;color:#555">${methodLabels[key]||key}</span>
      </div>
      <span style="font-size:12px;font-weight:700;color:#0D1B2A">${fmtK(val)} so'm</span>
    </div>`).join('');

  el.innerHTML = `<div style="display:flex;align-items:center;gap:16px;padding:4px 0 8px">
    <svg viewBox="0 0 124 124" style="width:90px;flex-shrink:0">
      ${paths.map(p => p.path).join('')}
      <circle cx="${cx}" cy="${cy}" r="${R*.52}" fill="white"/>
      <text x="${cx}" y="${cy-5}" text-anchor="middle" font-size="10" fill="#888">Jami</text>
      <text x="${cx}" y="${cy+9}" text-anchor="middle" font-size="11" font-weight="700" fill="#0D1B2A">${fmtK(total)}</text>
    </svg>
    <div style="flex:1;min-width:0">${legend}</div>
  </div>`;
}

// ── Top sotuvchilar + Top mahsulotlar ──────────
function renderDashTops() {
  const el = $('dash-tops');
  if (!el) return;
  const sales = dashGetSales();

  // Top sotuvchilar
  const staffMap = {};
  for (const s of sales) {
    const name = s.staffName || s.staff_name || 'Noma\'lum';
    staffMap[name] = (staffMap[name] || 0) + (s.total || 0);
  }
  const topStaff = Object.entries(staffMap).sort((a,b) => b[1]-a[1]).slice(0,5);

  // Top mahsulotlar
  const prodMap = {};
  for (const s of sales) {
    for (const it of (s.items || [])) {
      if (!it?.name) continue;
      prodMap[it.name] = (prodMap[it.name] || 0) + ((it.price||0) * (it.qty||0));
    }
  }
  const topProds = Object.entries(prodMap).sort((a,b) => b[1]-a[1]).slice(0,5);

  const staffColors = ['#4C9BE8','#36B48C','#8B5CF6','#E07B39','#E05A5A'];

  const staffHtml = topStaff.length ? topStaff.map(([name, sum], i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;
      border-bottom:1px solid var(--brd);last-child:border:none">
      <div style="display:flex;align-items:center;gap:9px">
        <div style="width:28px;height:28px;border-radius:50%;background:${staffColors[i]||'#ccc'}22;
          color:${staffColors[i]||'#ccc'};font-weight:800;font-size:12px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${name[0]?.toUpperCase()}
        </div>
        <span style="font-size:13px;font-weight:600">${name}</span>
      </div>
      <span style="font-size:13px;font-weight:700;color:#0D1B2A">${fmtK(sum)} so'm</span>
    </div>`).join('')
    : '<div style="padding:20px;text-align:center;color:#bbb;font-size:13px">Ma\'lumot yo\'q</div>';

  const prodHtml = topProds.length ? topProds.map(([name, sum], i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;
      border-bottom:1px solid var(--brd)">
      <div style="display:flex;align-items:center;gap:9px">
        <div style="width:22px;height:22px;border-radius:5px;background:#E9A50022;
          color:#E9A500;font-weight:800;font-size:11px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${i+1}
        </div>
        <span style="font-size:13px;font-weight:600;color:#0D1B2A">${name}</span>
      </div>
      <span style="font-size:13px;font-weight:700;color:#E9A500">${fmtK(sum)} so'm</span>
    </div>`).join('')
    : '<div style="padding:20px;text-align:center;color:#bbb;font-size:13px">Ma\'lumot yo\'q</div>';

  el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      <div class="card-hdr" style="padding:12px 16px">
        <span style="font-weight:700">🏆 Top sotuvchilar</span>
      </div>
      <div style="padding:0 16px 8px">${staffHtml}</div>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div class="card-hdr" style="padding:12px 16px">
        <span style="font-weight:700">📦 Top mahsulotlar</span>
      </div>
      <div style="padding:0 16px 8px">${prodHtml}</div>
    </div>`;
}

// ── Ogohlantirishlar ───────────────────────────
function renderDashAlerts(lowStock) {
  const el = $('dash-alerts');
  if (!el) return;
  if (!lowStock.length) { el.innerHTML = ''; return; }
  const zeros    = lowStock.filter(i => i.qty === 0);
  const criticals = lowStock.filter(i => i.qty > 0 && i.qty <= 2);
  const warnings  = lowStock.filter(i => i.qty > 2);

  let html = '<div class="dash-alerts-wrap">';
  if (zeros.length)
    html += `<div class="dal dal-r" onclick="nav('ombor')">🔴 <b>${zeros.length} ta variant tugagan</b> — zudlik bilan to'ldiring</div>`;
  if (criticals.length)
    html += `<div class="dal dal-o" onclick="nav('ombor')">🟠 <b>${criticals.length} ta variant kritik kam</b> (≤2 dona)</div>`;
  if (warnings.length)
    html += `<div class="dal dal-y" onclick="nav('ombor')">🟡 <b>${warnings.length} ta variant kam</b> — zaxirani kuzatib boring</div>`;
  html += '</div>';
  el.innerHTML = html;
}

// ── So'nggi sotuvlar jadval ─────────────────────
function renderDashSalesTable() {
  const el = $('dash-sales-tbody');
  if (!el) return;
  const sales = dashGetSales();
  const last  = [...sales].sort((a,b) => (b.date+b.chekNum||'').localeCompare(a.date+a.chekNum||'')).slice(0,8);
  if (!last.length) { el.innerHTML = '<tr><td colspan="5" class="empty-td">Sotuvlar yo\'q</td></tr>'; return; }
  const payLabels = { naqd:'Naqd', karta:'Karta', otkazma:"O'tkazma", nasiya:'Nasiya', aralash:'Aralash' };
  el.innerHTML = last.map(s => {
    const curRem = s.status !== 'qaytarilgan' ? calcSaleState(s).remaining : 0;
    return `
    <tr>
      <td>${s.customerName||s.customer_name||'<span style="color:#ccc">—</span>'}</td>
      <td><span class="bg bg-t" style="font-size:11px">${s.priceType==='ulgurji'?'Ulgurji':'Chakana'}</span></td>
      <td style="font-size:12px">${payLabels[s.payType||s.pay_type]||s.payType||'—'}</td>
      <td class="num" style="font-weight:700">${fmtK(s.total)} so'm</td>
      <td><span class="bg ${curRem>0.5?'bg-r':'bg-g'}" style="font-size:11px">${curRem>0.5?'Nasiya':'To\'langan'}</span></td>
    </tr>`;
  }).join('');
}

// ── Qarzlar jadval ─────────────────────────────
function renderDashDebtTable(debts) {
  const el = $('dash-debt-tbody');
  if (!el) return;
  if (!debts.length) { el.innerHTML = '<tr><td colspan="3" class="empty-td">Qarz yo\'q</td></tr>'; return; }
  el.innerHTML = debts.slice(0,6).map(s => `
    <tr>
      <td style="font-weight:600">${s.customerName||s.customer_name||'—'}</td>
      <td class="num" style="color:#E07B39;font-weight:700">${fmtK(s.remaining)} so'm</td>
      <td style="font-size:12px;color:${isOverdue(s)?'#E05A5A':'#888'}">${s.due||'—'}</td>
    </tr>`).join('');
}

// ── Valyuta pill (2026-07-09: SOZLAMALAR bilan YAGONA format va
// YAGONA ma'lumot manbasi — ikkalasi endi har doim bir xil ko'rinadi) ──
function updateDashCurrencyPill() {
  const el = $('tb-rate');
  if (el) el.textContent = (db.settings?.rate || 12800).toLocaleString('ru-RU');
  const cur = $('tb-cur');
  const c = db.settings?.priceCurrency || 'uzs';
  if (cur) cur.textContent = c === 'usd' ? 'USD' : c === 'both' ? "SO'M+USD" : "SO'M";
}

// Yuqori paneldagi tugma ham SOZLAMALAR sahifasidagi 3 ta variant
// (So'm / USD / Ikkalasi) bo'ylab aylanadi — bu ikkalasi ENDI bir xil
// funksiyani (saveSetting) chaqiradi, shuning uchun qaysi joydan
// o'zgartirilsa ham BARCHA oynalar (Katalog, POS) birdek yangilanadi.
function toggleCurrency() {
  const order = ["uzs", "usd", "both"];
  const cur = db.settings?.priceCurrency || "uzs";
  const next = order[(order.indexOf(cur) + 1) % order.length];
  if (typeof saveSetting === "function") saveSetting("priceCurrency", next);
  else { db.settings.priceCurrency = next; saveDB(); }
  renderDashboard();
}
