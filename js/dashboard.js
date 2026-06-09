// MERX dashboard.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/dashboard.js  (v2 — To'liq qayta yozildi)
// ================================================

let dashPeriod = 7;

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

// ── Asosiy render ──────────────────────────────
function renderDashboard() {
  const t    = today();
  const rate = db.settings?.rate || 12800;
  const isUsd = db.settings?.priceCurrency === "usd";

  // Valyutaga qarab formatlash
  function dashFmt(uzs) {
    if (isUsd) {
      const usd = uzs / rate;
      return usd >= 1000 ? (usd/1000).toFixed(1)+"K $"
           : usd >= 1    ? usd.toFixed(0)+" $"
           : usd.toFixed(2)+" $";
    }
    return fmtK(uzs) + " so'm";
  }

  // Hisob-kitoblar
  const todaySales  = db.sales.filter(s => s.date === t);
  const ystSales    = db.sales.filter(s => s.date === addDays(t, -1));
  const todayTotal  = todaySales.reduce((a, s) => a + s.total, 0);
  const ystTotal    = ystSales.reduce((a, s)   => a + s.total, 0);
  const todayCnt    = todaySales.length;
  const avgCheck    = todayCnt ? Math.round(todayTotal / todayCnt) : 0;
  const debts       = debtSales();
  const totalDebt   = debts.reduce((a, s) => a + s.remaining, 0);
  const overdueList = debts.filter(isOverdue);
  const growth      = ystTotal > 0 ? Math.round((todayTotal - ystTotal) / ystTotal * 100) : null;

  // Kam qoldiq — chegara settings dan yoki default 5
  const lowThreshold = db.settings?.lowStockLimit || 5;
  const lowStock = [];
  db.products.forEach(p => {
    const minQty = p.minStock || lowThreshold;
    p.variants.forEach(v => {
      if (v.qty >= 0 && v.qty <= minQty)
        lowStock.push({
          name: p.name, sku: p.sku,
          color: v.color, size: v.size,
          qty: v.qty, unit: p.unit || 'dona',
          min: minQty,
          zero: v.qty === 0
        });
    });
  });
  // 0 ta bo'lganlar tepaga
  lowStock.sort((a, b) => a.qty - b.qty);

  renderDashHeader(todayTotal, todayCnt, growth);
  renderDashKpis(todayCnt, avgCheck, totalDebt, debts.length, overdueList.length);
  renderDashChart(dashPeriod);
  renderDashDonut(dashPeriod);
  renderDashPriceType(dashPeriod);
  renderDashAlerts(lowStock);
  renderDashSalesTable();
  renderDashDebtTable(debts);
  updateDashCurrencyPill();
}

// ── Header (qoʻngʻiroq strip) ──────────────────
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
      <div class="dh-val">${(()=>{const r=db.settings?.rate||12800;const u=db.settings?.priceCurrency==="usd";return u?(todayTotal/r).toFixed(0)+" $":fmtK(todayTotal)+" so'm";})()} </div>
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

// ── KPI kartochkalari ──────────────────────────
function renderDashKpis(todayCnt, avgCheck, totalDebt, debtCnt, overdueCnt) {
  const el = $('dash-kpis');
  if (!el) return;

  const cards = [
    {
      icon: 'ti-shopping-bag', color: '#4C9BE8',
      label: 'Sotuvlar soni', val: todayCnt + ' ta',
      sub: 'bugungi tranzaksiya', click: "nav('tarix')"
    },
    {
      icon: 'ti-receipt', color: '#36B48C',
      label: "O'rtacha check", val: todayCnt ? (()=>{const r=db.settings?.rate||12800;const u=db.settings?.priceCurrency==="usd";return u?(avgCheck/r).toFixed(0)+" $":fmtK(avgCheck)+" so'm"})() : '—',
      sub: 'bir sotuvga o\'rtacha', click: "nav('tarix')"
    },
    {
      icon: 'ti-credit-card', color: '#E07B39',
      label: 'Jami qarz', val: (()=>{const r=db.settings?.rate||12800;const u=db.settings?.priceCurrency==="usd";return u?(totalDebt/r).toFixed(0)+" $":fmtK(totalDebt)+" so'm"})(),
      sub: debtCnt + ' nafar qarzdor', click: "nav('qarzlar')"
    },
    {
      icon: 'ti-clock-exclamation',
      color: overdueCnt > 0 ? '#E05A5A' : '#36B48C',
      label: "Muddati o'tgan", val: overdueCnt + ' ta',
      sub: overdueCnt > 0 ? '<span style="color:#E05A5A;font-weight:700">Zudlik bilan!</span>' : 'Hammasi tartibda',
      click: "nav('qarzlar')"
    },
    {
      icon: 'ti-box', color: '#8B5CF6',
      label: 'Katalogdagi tovar', val: db.products.length + ' tur',
      sub: db.products.reduce((a, p) => a + p.variants.reduce((b, v) => b + v.qty, 0), 0) + ' dona omborda',
      click: "nav('katalog')"
    }
  ];

  el.innerHTML = cards.map(c => `
    <div class="dash-kpi" onclick="${c.click}">
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
  document.querySelectorAll('.dash-ptab').forEach(b => b.classList.toggle('on', +b.dataset.p === p));
  renderDashChart(p);
  renderDashDonut(p);
  renderDashPriceType(p);
}

// ── Ustun diagramma ────────────────────────────
function renderDashChart(days) {
  const el = $('dash-chart');
  if (!el) return;

  const t = today();
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(t, -i);
    const total = db.sales.filter(s => s.date === d).reduce((a, s) => a + s.total, 0);
    const dObj = new Date(d);
    const wdays = ['Ya','Du','Se','Ch','Pa','Ju','Sh'];
    const lbl = days <= 7
      ? wdays[dObj.getDay()]
      : (i === 0 ? 'Bugun' : d.slice(8) + '/' + String(dObj.getMonth() + 1).padStart(2, '0'));
    data.push({ d, label: lbl, total, isToday: d === t });
  }

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const W = 580, H = 180, pL = 52, pB = 28, pT = 24, pR = 16;
  const cW = W - pL - pR, cH = H - pB - pT;
  const barW = Math.max(10, Math.floor(cW / data.length * 0.55));
  const gap = cW / data.length;

  // Y gridlines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const y = pT + cH - pct * cH;
    return `
      <line x1="${pL}" y1="${y}" x2="${W - pR}" y2="${y}"
            stroke="#e8e5df" stroke-width="1" ${pct > 0 ? 'stroke-dasharray="4 4"' : ''}/>
      <text x="${pL - 7}" y="${y + 4}" text-anchor="end" font-size="9" fill="#bbb">
        ${pct > 0 ? fmtK(Math.round(pct * maxVal)) : '0'}
      </text>`;
  }).join('');

  const bars = data.map((d, i) => {
    const bh  = Math.max(4, Math.round(d.total / maxVal * cH));
    const x   = pL + i * gap + gap / 2 - barW / 2;
    const y   = pT + cH - bh;
    const gid = `dg${i}`;
    const clr = d.isToday ? '#E9A500' : '#4C9BE8';
    return `
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${clr}" stop-opacity="${d.isToday ? '1' : '0.8'}"/>
          <stop offset="100%" stop-color="${clr}" stop-opacity="${d.isToday ? '0.5' : '0.15'}"/>
        </linearGradient>
      </defs>
      <rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="5" fill="url(#${gid})"/>
      ${d.total > 0 ? `<text x="${x + barW/2}" y="${y - 5}" text-anchor="middle" font-size="8.5"
            fill="${d.isToday ? '#b07d00' : '#999'}" font-weight="${d.isToday ? '700' : '400'}">${fmtK(d.total)}</text>` : ''}
      <text x="${x + barW/2}" y="${H - 8}" text-anchor="middle"
            font-size="${days > 14 ? '8' : '10'}"
            fill="${d.isToday ? '#E9A500' : '#bbb'}"
            font-weight="${d.isToday ? '700' : '400'}">${d.label}</text>`;
  }).join('');

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
      ${gridLines}
      <line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT + cH}" stroke="#e0ddd8" stroke-width="1"/>
      ${bars}
    </svg>`;
}

// ── Donut diagramma ─────────────────────────────
function renderDashDonut(days) {
  const el = $('dash-donut');
  if (!el) return;
  const start = addDays(today(), -(days - 1));
  const ps = db.sales.filter(s => s.date >= start);
  const types = { naqd: 0, karta: 0, otkazma: 0 };
  ps.forEach(s => { if (s.payType in types) types[s.payType] += s.total; });
  const total = Object.values(types).reduce((a, b) => a + b, 0);

  if (!total) {
    el.innerHTML = `<div style="text-align:center;padding:18px 0;color:#ccc;font-size:12.5px">
      <i class="ti ti-chart-donut" style="font-size:24px;display:block;margin-bottom:6px"></i>Ma'lumot yo'q</div>`;
    return;
  }

  const colors = { naqd: '#E9A500', karta: '#4C9BE8', otkazma: '#36B48C' };
  const labels = { naqd: 'Naqd', karta: 'Karta', otkazma: "O'tkazma" };
  const cx = 56, cy = 56, R = 48, r = 30;
  let ang = -90;

  const paths = Object.entries(types).filter(([, v]) => v > 0).map(([key, val]) => {
    const sweep = val / total * 360;
    const a1 = ang * Math.PI / 180;
    const a2 = (ang + sweep) * Math.PI / 180;
    ang += sweep;
    const lg = sweep > 180 ? 1 : 0;
    return `<path d="M${cx+R*Math.cos(a1)},${cy+R*Math.sin(a1)} A${R},${R},0,${lg},1,${cx+R*Math.cos(a2)},${cy+R*Math.sin(a2)} L${cx+r*Math.cos(a2)},${cy+r*Math.sin(a2)} A${r},${r},0,${lg},0,${cx+r*Math.cos(a1)},${cy+r*Math.sin(a1)}Z" fill="${colors[key]}"/>`;
  }).join('');

  const legend = Object.entries(types).map(([key, val]) => val > 0 ? `
    <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
      <div style="width:9px;height:9px;border-radius:2px;background:${colors[key]};flex-shrink:0"></div>
      <span style="font-size:12px;color:#666">${labels[key]}</span>
      <span style="margin-left:auto;font-size:12px;font-weight:700;color:#333">${Math.round(val / total * 100)}%</span>
    </div>` : '').join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px">
      <svg viewBox="0 0 112 112" style="width:82px;flex-shrink:0">
        ${paths}
        <text x="56" y="53" text-anchor="middle" font-size="9" fill="#bbb">Jami</text>
        <text x="56" y="65" text-anchor="middle" font-size="10.5" font-weight="800" fill="#333">${fmtK(total)}</text>
      </svg>
      <div style="flex:1">${legend}</div>
    </div>`;
}

// ── Chakana/Ulgurji nisbati ─────────────────────
function renderDashPriceType(days) {
  const el = $('dash-pricetype');
  if (!el) return;
  const start = addDays(today(), -(days - 1));
  const ps  = db.sales.filter(s => s.date >= start);
  const ch  = ps.filter(s => s.priceType === 'chakana').reduce((a, s) => a + s.total, 0);
  const ul  = ps.filter(s => s.priceType === 'ulgurji').reduce((a, s) => a + s.total, 0);
  const tot = ch + ul || 1;
  const chP = Math.round(ch / tot * 100);

  el.innerHTML = `
    <div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
        <span style="color:#E9A500;font-weight:700">Chakana ${chP}%</span>
        <span style="color:#4C9BE8;font-weight:700">Ulgurji ${100 - chP}%</span>
      </div>
      <div style="height:9px;border-radius:5px;background:#eae7e0;overflow:hidden">
        <div style="height:100%;width:${chP}%;background:linear-gradient(90deg,#E9A500,#f5c842);border-radius:5px;transition:width .5s ease"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#bbb;margin-top:5px">
        <span>${fmtK(ch)} so'm</span>
        <span>${fmtK(ul)} so'm</span>
      </div>
    </div>`;
}

// ── Kam qoldiq ogohlantirishlari ────────────────
function renderDashAlerts(lowStock) {
  const el = $('dash-alerts');
  if (!el) return;

  if (!lowStock.length) {
    el.innerHTML = `
      <div class="dash-alert" style="border-color:#d1fae5;background:#f0fdf4">
        <div class="da-hdr" style="color:#166534">
          <i class="ti ti-circle-check" style="font-size:18px;color:#22c55e"></i>
          <strong>Barcha tovarlar yetarli</strong>
          <span style="font-size:12px;color:#16a34a;margin-left:8px">Chegara: ${db.settings?.lowStockLimit||5} ta</span>
        </div>
      </div>`;
    return;
  }

  const zeros    = lowStock.filter(i => i.qty === 0);
  const criticals = lowStock.filter(i => i.qty > 0 && i.qty <= 2);
  const warnings  = lowStock.filter(i => i.qty > 2);
  const threshold = db.settings?.lowStockLimit || 5;

  el.innerHTML = `
    <div class="dash-alert">
      <div class="da-hdr">
        <i class="ti ti-alert-triangle" style="font-size:17px"></i>
        <strong>Kam qolgan tovarlar</strong>
        ${zeros.length     ? `<span class="da-badge crit" style="background:#fee2e2;color:#991b1b">🚫 ${zeros.length} ta tugagan</span>` : ''}
        ${criticals.length ? `<span class="da-badge crit">⚠️ ${criticals.length} ta kritik</span>` : ''}
        ${warnings.length  ? `<span class="da-badge warn">${warnings.length} ta kam</span>` : ''}
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;color:#aaa">Chegara:
            <input type="number" value="${threshold}" min="1" max="99"
              style="width:38px;font-size:12px;font-family:inherit;border:1px solid #ddd;border-radius:5px;padding:1px 4px;text-align:center"
              onchange="setLowStockLimit(+this.value)" title="Kam qoldiq chegarasi">
            ta</span>
          <button class="btn btn-sm" onclick="exportLowStock()" title="Excel yuklab olish">
            <i class="ti ti-download"></i>
          </button>
          <button class="btn btn-sm" onclick="nav('ombor')" style="white-space:nowrap">Omborga →</button>
        </div>
      </div>
      <div class="da-items">
        ${lowStock.slice(0, 20).map(i => `
          <div class="da-item ${i.qty === 0 ? 'crit' : i.qty <= 2 ? 'crit' : 'warn'}"
               style="${i.qty===0?'border-color:#fca5a5;background:#fff5f5':''}"
               title="${i.name} — min: ${i.min} ta">
            <span class="da-nm">${i.name}</span>
            <span class="da-var">${i.color||''} ${i.color&&i.size?' · ':''} ${i.size||''}</span>
            <span class="da-q" style="${i.qty===0?'color:#dc2626;font-weight:800':''}">
              ${i.qty === 0 ? '🚫 Tugagan' : i.qty + ' ' + i.unit}
            </span>
          </div>`).join('')}
        ${lowStock.length > 20
          ? `<div class="da-item more" onclick="nav('ombor')">+${lowStock.length - 20} ta ko'proq →</div>`
          : ''}
      </div>
    </div>`;
}

// Chegara sozlamasi
function setLowStockLimit(val) {
  if (!val || val < 1) return;
  if (!db.settings) db.settings = {};
  db.settings.lowStockLimit = val;
  saveDB();
  renderDashboard();
  toast("Chegara " + val + " ta ga o\u02BCzgartirildi", "info");
}

// Excel eksport
function exportLowStock() {
  const threshold = db.settings?.lowStockLimit || 5;
  const rows = [['Mahsulot', 'Rang', "O'lcham", 'Qoldiq', 'Birlik', 'Holat']];
  const lowStock = [];
  db.products.forEach(p => {
    const minQty = p.minStock || threshold;
    p.variants.forEach(v => {
      if (v.qty <= minQty)
        lowStock.push([p.name, v.color||'', v.size||'', v.qty, p.unit||'dona',
          v.qty===0 ? 'Tugagan' : v.qty<=2 ? 'Kritik' : 'Kam']);
    });
  });
  lowStock.sort((a,b) => a[3]-b[3]);
  if (typeof downloadCSV === 'function') {
    downloadCSV([rows[0], ...lowStock], 'merx_kam_qoldiq_' + today() + '.csv');
    toast('Excel yuklab olindi');
  }
}

// ── So'nggi sotuvlar ───────────────────────────
function renderDashSalesTable() {
  const el = $('dash-sales-body');
  if (!el) return;
  const rows = [...db.sales].reverse().slice(0, 6);

  el.innerHTML = rows.length ? rows.map(s => `
    <tr>
      <td>
        <div style="font-weight:600;font-size:13px">${s.customerName || "Noma'lum"}</div>
        <div style="font-size:11px;color:#bbb">${s.date}${s.time ? ' · ' + s.time : ''}</div>
      </td>
      <td><span class="bg ${s.priceType === 'ulgurji' ? 'bg-t' : 'bg-g'}" style="font-size:10.5px">${s.priceType === 'ulgurji' ? 'Ulgurji' : 'Chakana'}</span></td>
      <td><span class="bg" style="font-size:10.5px;background:#f0ede7;color:#555">${PAYTYPES[s.payType] || s.payType}</span></td>
      <td class="num" style="font-weight:700;font-size:13px">${fmt(s.total)}</td>
      <td><span class="bg ${s.status === 'qarz' ? 'bg-r' : 'bg-g'}" style="font-size:10.5px">${s.status === 'qarz' ? 'Qarz' : "To'langan"}</span></td>
    </tr>`) .join('')
    : `<tr><td colspan="5" class="empty-td">Sotuvlar yo'q</td></tr>`;
}

// ── Shoshilinch qarzlar ────────────────────────
function renderDashDebtTable(debts) {
  const el = $('dash-debt-body');
  if (!el) return;
  const sorted = [...debts].sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  }).slice(0, 6);

  el.innerHTML = sorted.length ? sorted.map(s => {
    const cu  = typeof debtCust === 'function' ? debtCust(s) : { name: s.customerName || '—', phone: s.customerPhone || '' };
    const ov  = isOverdue(s);
    return `<tr>
      <td>
        <div style="font-weight:600;font-size:13px">${cu.name}</div>
        <div style="font-size:11px;color:#bbb">${cu.phone}</div>
      </td>
      <td class="num" style="color:#E05A5A;font-weight:800;font-size:13px">${fmt(s.remaining)} <span style="font-size:10px;font-weight:400;color:#bbb">so'm</span></td>
      <td><span class="bg ${ov ? 'bg-r' : 'bg-a'}" style="font-size:10.5px">${ov ? "Muddati o'tgan" : (s.due || '—')}</span></td>
    </tr>`;
  }).join('')
    : `<tr><td colspan="3" class="empty-td" style="color:#36B48C">
        <i class="ti ti-circle-check" style="font-size:20px;display:block;margin-bottom:4px"></i>Qarz yo'q 🎉
       </td></tr>`;
}
