// MERX dashboard.js | v3.0 | 2026-06-18
// ================================================

let dashPeriod     = 0;    // 0=bugun, 1=kecha, 7=hafta, 30=oy, 365=yil, -1=barchasi, -2=custom
let dashCustomFrom = null;
let dashCustomTo   = null;
let dashCalOpen    = false;

// ── Yordamchi funksiyalar ──────────────────────
function fmtK(n) {
  if (!n) return '0';
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + ' mlrd';
  if (n >= 1000000)    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + ' mln';
  if (n >= 1000)       return Math.round(n / 1000) + 'K';
  return fmt(n);
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

function priceFmt(uzs) {
  const r = db.settings?.rate || 12800;
  const u = db.settings?.priceCurrency === 'usd';
  return u ? (uzs/r).toFixed(0) + ' $' : fmtK(uzs) + " so'm";
}

// ── Davr bo'yicha sales filtrlash ──────────────
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
  if (!db?.sales) return;
  const t = today();

  const todaySales = db.sales.filter(s => s.date === t);
  const ystSales   = db.sales.filter(s => s.date === addDays(t, -1));
  const todayTotal = todaySales.reduce((a, s) => a + s.total, 0);
  const ystTotal   = ystSales.reduce((a, s) => a + s.total, 0);
  const todayCnt   = todaySales.length;
  const growth     = ystTotal > 0 ? Math.round((todayTotal - ystTotal) / ystTotal * 100) : null;

  const debts       = debtSales();
  const totalDebt   = debts.reduce((a, s) => a + s.remaining, 0);
  const overdueList = debts.filter(isOverdue);

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

  renderDashHeader(todayTotal, todayCnt, growth);
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
function renderDashHeader(todayTotal, todayCnt, growth) {
  const el = $('dash-header');
  if (!el) return;
  const growHtml = growth !== null
    ? `<span class="dash-growth ${growth >= 0 ? 'up' : 'dn'}">${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth)}%</span>`
    : `<span class="dash-growth" style="color:rgba(255,255,255,.35);font-weight:400">— birinchi kun</span>`;
  el.innerHTML = `
    <div class="dh-left">
      <div class="dh-greet">${dashGreeting()}, <strong>${db.shop?.name || 'MERX Do\'koni'}</strong></div>
      <div class="dh-date"><i class="ti ti-calendar" style="font-size:12px;margin-right:4px"></i>${dashDateStr()}</div>
    </div>
    <div class="dh-center">
      <div class="dh-lbl">Bugungi sotuv</div>
      <div class="dh-val">${priceFmt(todayTotal)}</div>
      <div style="font-size:12px;margin-top:3px;color:rgba(255,255,255,.45)">${todayCnt} ta tranzaksiya ${growHtml}</div>
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
  sotuvlar: true, ortacha: true, qarz: true, muddati: true, ombor: true
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
    { key:'sotuvlar', lbl:'Sotuvlar soni' },
    { key:'ortacha',  lbl:"O'rtacha chek" },
    { key:'qarz',     lbl:'Jami qarz' },
    { key:'muddati',  lbl:"Muddati o'tgan" },
    { key:'ombor',    lbl:'Kam qoldiq' },
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
  // Agar argumentsiz chaqirilsa — hisoblash
  if (todayCnt === undefined) {
    const t = today();
    const td = db.sales.filter(s => s.date === t);
    todayCnt   = td.length;
    todayTotal = td.reduce((a,s) => a+s.total, 0);
    const dts  = debtSales();
    totalDebt  = dts.reduce((a,s) => a+s.remaining, 0);
    debtCnt    = dts.length;
    overdueCnt = dts.filter(isOverdue).length;
  }

  const cols    = dashGetKpiCols();
  const avgCheck = todayCnt ? Math.round(todayTotal / todayCnt) : 0;

  const lowThreshold = db.settings?.lowStockLimit || 5;
  const lowCnt = db.products.reduce((a, p) =>
    a + p.variants.filter(v => v.qty >= 0 && v.qty <= lowThreshold).length, 0);

  const allCards = [
    {
      key: 'sotuvlar',
      icon: 'ti-shopping-bag', color: '#4C9BE8',
      label: 'Sotuvlar soni', val: todayCnt + ' ta',
      sub: 'bugungi tranzaksiya', click: "nav('tarix')"
    },
    {
      key: 'ortacha',
      icon: 'ti-receipt', color: '#36B48C',
      label: "O'rtacha chek", val: todayCnt ? priceFmt(avgCheck) : '—',
      sub: "bir sotuvga o'rtacha", click: "nav('tarix')"
    },
    {
      key: 'qarz',
      icon: 'ti-credit-card', color: '#E07B39',
      label: 'Jami qarz', val: priceFmt(totalDebt),
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
  renderDashChart();
  renderDashDonut();
  renderDashPriceType();
  renderDashTops();
  renderDashSalesTable();
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
  renderDashChart();
  renderDashDonut();
  renderDashPriceType();
  renderDashTops();
  renderDashSalesTable();
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
  const sales = dashGetSales();
  const ch = sales.filter(s => s.priceType === 'chakana').reduce((a, s) => a + s.total, 0);
  const ul = sales.filter(s => s.priceType === 'ulgurji').reduce((a, s) => a + s.total, 0);
  const total = ch + ul || 1;
  const chPct = Math.round(ch / total * 100);
  const ulPct = 100 - chPct;

  el.innerHTML = `
    <div style="padding:4px 0 8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <div style="text-align:center;flex:1">
          <div style="font-size:18px;font-weight:800;color:#4C9BE8">${fmtK(ch)}</div>
          <div style="font-size:11px;color:#888">Chakana (${chPct}%)</div>
        </div>
        <div style="width:1px;background:var(--brd)"></div>
        <div style="text-align:center;flex:1">
          <div style="font-size:18px;font-weight:800;color:#8B5CF6">${fmtK(ul)}</div>
          <div style="font-size:11px;color:#888">Ulgurji (${ulPct}%)</div>
        </div>
      </div>
      <div style="height:8px;border-radius:4px;background:#f0ede8;overflow:hidden">
        <div style="height:100%;width:${chPct}%;background:linear-gradient(90deg,#4C9BE8,#8B5CF6);border-radius:4px;transition:.4s"></div>
      </div>
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
  el.innerHTML = last.map(s => `
    <tr>
      <td>${s.customerName||s.customer_name||'<span style="color:#ccc">—</span>'}</td>
      <td><span class="bg bg-t" style="font-size:11px">${s.priceType==='ulgurji'?'Ulgurji':'Chakana'}</span></td>
      <td style="font-size:12px">${payLabels[s.payType||s.pay_type]||s.payType||'—'}</td>
      <td class="num" style="font-weight:700">${fmtK(s.total)} so'm</td>
      <td><span class="bg ${s.remaining>0?'bg-r':'bg-g'}" style="font-size:11px">${s.remaining>0?'Nasiya':'To\'langan'}</span></td>
    </tr>`).join('');
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

// ── Valyuta pill ────────────────────────────────
function updateDashCurrencyPill() {
  const el = $('tb-rate');
  if (el) el.textContent = (db.settings?.rate || 12800).toLocaleString('ru-RU');
  const cur = $('tb-cur');
  if (cur) cur.textContent = db.settings?.priceCurrency === 'usd' ? 'USD' : "so'm";
}

function toggleCurrency() {
  db.settings.priceCurrency = db.settings.priceCurrency === 'usd' ? 'uzs' : 'usd';
  saveDB(); renderDashboard();
}
