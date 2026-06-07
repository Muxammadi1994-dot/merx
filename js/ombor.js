// MERX ombor.js | v2.3 | 2026-06-06 12:54 | 2026-06-06 06:00
// ================================================
// MERX — js/ombor.js  (v3 — Pantone + Karobka)
// ================================================

let omActiveTab   = "qoldiq";
let omStockFilter = "all";
let omColsOpen    = false;

const OM_DEFAULT_COLS = {
  sku:false, kategoriya:false, tannarx:true,
  qiymati:true, barcode:false, ulgurji:true, chakana:true
};

function omGetCols() {
  return Object.assign({}, OM_DEFAULT_COLS, db.settings.omborCols || {});
}

function renderOmbor() {
  omRenderKpis();
  if (omActiveTab === "qoldiq")      omRenderQoldiq();
  else if (omActiveTab === "kirim")  omRenderKirim();
  else if (omActiveTab === "sup")    omRenderSuppliers();
  else if (omActiveTab === "kam")    omRenderKamQoldiq();
  else if (omActiveTab === "chiqim") omRenderChiqim();
}

function omSetTab(tab) {
  omActiveTab = tab;
  document.querySelectorAll(".om-tab").forEach(b =>
    b.classList.toggle("on", b.dataset.tab === tab));
  $("om-tab-qoldiq").style.display = tab === "qoldiq" ? "" : "none";
  $("om-tab-kirim").style.display  = tab === "kirim"  ? "" : "none";
  $("om-tab-sup").style.display    = tab === "sup"    ? "" : "none";
  const kamEl = $("om-tab-kam");
  if (kamEl) kamEl.style.display   = tab === "kam"    ? "" : "none";
  const chiqimEl = $("om-tab-chiqim");
  if (chiqimEl) chiqimEl.style.display = tab === "chiqim" ? "" : "none";
  renderOmbor();
}

function omRenderKpis() {
  const rate = db.settings.rate || 1;
  const t    = today(), m = t.slice(0,7);
  const todayIn  = db.ombor.filter(o => o.date === t).reduce((a,o) => a + o.qty, 0);
  const monthVal = db.ombor.filter(o => o.date.startsWith(m)).reduce((a,o) => a + (o.kirimNarxi||0)*o.qty, 0);
  const supDebt  = db.ombor.filter(o => o.payStatus === "qarz").reduce((a,o) => a + (o.kirimNarxi||0)*o.qty, 0);
  const totalVal = db.products.reduce((a,p) =>
    a + p.variants.reduce((b,v) => b + (p.costUsd*rate)*v.qty, 0), 0);
  const totalUnits = db.products.reduce((a,p) =>
    a + p.variants.reduce((b,v) => b + v.qty, 0), 0);

  const el = $("om-kpi-row"); if (!el) return;
  el.innerHTML = [
    { icon:"ti-arrow-down-circle", color:"#4C9BE8", lbl:"Bugungi kirim",    val:todayIn+" dona",       sub:"bugun qabul qilindi" },
    { icon:"ti-box",               color:"#36B48C", lbl:"Jami qoldiq",      val:totalUnits+" dona",    sub:db.products.length+" turdagi tovar" },
    { icon:"ti-currency-dollar",   color:"#E9A500", lbl:"Bu oy kirim",      val:fmt(monthVal)+" so'm", sub:"tannarxda" },
    { icon:"ti-wallet",            color:"#8B5CF6", lbl:"Ombor qiymati",    val:fmt(totalVal)+" so'm", sub:"tannarxda" },
    { icon:"ti-alert-circle",      color:supDebt>0?"#E05A5A":"#36B48C",
      lbl:"Yetkazuvchi qarzi", val:fmt(supDebt)+" so'm",
      sub:supDebt>0?"To'lanmagan qarz":"Hammasi to'langan" }
  ].map(k => `
    <div class="stb2">
      <div class="stb2-top">
        <div class="stb2-ico" style="background:${k.color}18;color:${k.color}">
          <i class="ti ${k.icon}"></i>
        </div>
        <span class="stb2-lbl">${k.lbl}</span>
      </div>
      <div class="stb2-val">${k.val}</div>
      <div class="stb2-sub">${k.sub}</div>
    </div>`).join("");
}

function omToggleCols() {
  omColsOpen = !omColsOpen;
  const panel = $("om-cols-panel");
  if (!panel) return;
  panel.style.display = omColsOpen ? "block" : "none";
  if (omColsOpen) omRenderColsPanel();
}

function omRenderColsPanel() {
  const cols = omGetCols();
  const defs = [
    { key:"sku",        lbl:"SKU kodi" },
    { key:"kategoriya", lbl:"Kategoriya" },
    { key:"tannarx",    lbl:"Tannarx" },
    { key:"chakana",    lbl:"Chakana narx" },
    { key:"ulgurji",    lbl:"Ulgurji narx" },
    { key:"qiymati",    lbl:"Qoldiq qiymati" },
    { key:"barcode",    lbl:"Barcode" }
  ];
  $("om-cols-panel").innerHTML = `
    <div style="padding:12px 16px;background:#fff;border:1px solid var(--brd);border-radius:10px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">
        ⚙️ Ko'rinadigan ustunlar
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${defs.map(d => `
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;
            background:${cols[d.key]?"#E9A50018":"var(--bg)"};
            border:1.5px solid ${cols[d.key]?"#E9A500":"var(--brd)"};
            padding:5px 12px;border-radius:8px;transition:.15s">
            <input type="checkbox" ${cols[d.key]?"checked":""} onchange="omToggleCol('${d.key}',this.checked)"
              style="accent-color:var(--acc)">
            ${d.lbl}
          </label>`).join("")}
      </div>
    </div>`;
}

function omToggleCol(key, val) {
  if (!db.settings.omborCols) db.settings.omborCols = {};
  db.settings.omborCols[key] = val;
  saveDB(); omRenderColsPanel(); omRenderQoldiq();
}

function omSetFilter(f) {
  omStockFilter = f;
  document.querySelectorAll(".om-filter-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.f === f));
  omRenderQoldiq();
}
let omSortKey = null;
let omSortAsc = true;

function omSortBy(key) {
  if (omSortKey === key) {
    omSortAsc = !omSortAsc;
  } else {
    omSortKey = key;
    omSortAsc = key === "name"; // nom uchun A→Z, qolganlar uchun kattadan kichikka
  }
  // Tugma ko'rinishini yangilash
  document.querySelectorAll(".om-sort-btn").forEach(b => {
    b.style.background  = "";
    b.style.color       = "";
    b.style.borderColor = "";
  });
  const activeMap = { name:"sort-name-btn", qty:"sort-qty-btn", price:"sort-price-btn" };
  const activeBtn = document.getElementById(activeMap[key]);
  if (activeBtn) {
    activeBtn.style.background  = "#0D1B2A";
    activeBtn.style.color       = "#fff";
    activeBtn.style.borderColor = "#0D1B2A";
  }
  omRenderQoldiq();
}



function omRenderQoldiq() {
  const rate = db.settings.rate || 1;
  const q    = ($("om-q")||{value:""}).value.toLowerCase();
  const showChakana = db.settings.showChakana || false;

  let rows = [];
  db.products.forEach(p => {
    // Rang bo'yicha guruhlash — o'lchamlar ham saqlanadi
    const colorGroups = {};
    p.variants.forEach(v => {
      if (!colorGroups[v.color]) {
        colorGroups[v.color] = {
          color:   v.color,
          hex:     v.hex    || "#888",
          pantone: v.pantone || "",
          qty:     0,
          sizes:   []   // [{size, qty}]
        };
      }
      colorGroups[v.color].qty += v.qty;
      if (v.size) {
        const existing = colorGroups[v.color].sizes.find(s => s.size === v.size);
        if (existing) existing.qty += v.qty;
        else colorGroups[v.color].sizes.push({ size: v.size, qty: v.qty });
      }
    });

    Object.values(colorGroups).forEach(cg => {
      const inBox   = p.inBox || 1;
      const boxes   = inBox > 1 ? (cg.qty / inBox) : null;
      const costUzs = Math.round((p.costUsd || 0) * rate);

      rows.push({
        sku:     p.sku,
        name:    p.name,
        color:   cg.color,
        hex:     cg.hex,
        pantone: cg.pantone,
        qty:     cg.qty,
        sizes:   cg.sizes,
        inBox,
        boxes,
        unit:    p.unit || "dona",
        costUzs,
        chakana: p.priceUzs,
        ulgurji: p.ulgurjiNarx || 0,
        qiymati: Math.round(cg.qty * (p.costUsd || 0) * rate)
      });
    });
  });

  if (omStockFilter === "low") rows = rows.filter(r => r.qty > 0 && r.qty <= 5);
  if (omStockFilter === "out") rows = rows.filter(r => r.qty <= 0);
  if (q) rows = rows.filter(r =>
    r.name.toLowerCase().includes(q)    ||
    r.sku.toLowerCase().includes(q)     ||
    r.color.toLowerCase().includes(q)   ||
    r.pantone.toLowerCase().includes(q)
  );

  // Saralash
  if (omSortKey) {
    rows.sort((a, b) => {
      let va, vb;
      if (omSortKey === "name")  { va = a.name;    vb = b.name;    }
      if (omSortKey === "qty")   { va = a.qty;     vb = b.qty;     }
      if (omSortKey === "price") { va = a.ulgurji; vb = b.ulgurji; }
      if (typeof va === "string") return omSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return omSortAsc ? va - vb : vb - va;
    });
  }

  const thead = `<tr>
    <th>Mahsulot nomi</th>
    <th>Kod (SKU)</th>
    <th>Barcode</th>
    <th>Rang</th>
    <th class="num">Karobka</th>
    <th class="num">Dona soni</th>
    <th class="num">Tannarx</th>
    <th class="num">Ulgurji narx</th>
    ${showChakana ? "<th class='num'>Chakana narx</th>" : ""}
    <th></th>
  </tr>`;

  const tbody = rows.length ? rows.map(r => {
    const qBadge = r.qty <= 0
      ? `<span class="bg bg-r">Tugagan</span>`
      : r.qty <= 3
        ? `<span class="bg bg-a" style="font-weight:700">${r.qty} ${r.unit}</span>`
        : r.qty <= 10
          ? `<span class="bg" style="background:#FFF8E7;color:#856404;font-weight:600">${r.qty} ${r.unit}</span>`
          : `<span class="bg bg-g">${r.qty} ${r.unit}</span>`;

    const boxCell = r.inBox > 1
      ? `<span style="font-weight:700;font-size:14px">${r.boxes != null ? (Number.isInteger(r.boxes) ? r.boxes : r.boxes.toFixed(1)) : '—'}</span>
         <span style="font-size:10.5px;color:#bbb;margin-left:3px">karobka</span>
         <div style="font-size:10px;color:#aaa">×${r.inBox} ${r.unit}</div>`
      : `<span style="font-size:12px;color:#bbb">donab</span>`;

    const margin = r.ulgurji > 0 && r.costUzs > 0
      ? Math.round((r.ulgurji - r.costUzs) / r.ulgurji * 100) : null;

      const p = db.products.find(x => x.sku === r.sku);
      const barcode = p?.barcode || "";

      return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${p?.image
            ? `<img src="${p.image}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid var(--brd);flex-shrink:0">`
            : `<div style="width:36px;height:36px;border:1.5px dashed #e0ddd8;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#ddd;font-size:14px;flex-shrink:0"><i class="ti ti-photo"></i></div>`}
          <div style="font-weight:600;font-size:13px">${r.name}</div>
        </div>
      </td>
      <td style="font-family:monospace;font-size:11.5px;color:var(--mut)">${r.sku}</td>
      <td style="font-family:monospace;font-size:12px">
        ${barcode
          ? `<span style="background:var(--bg);padding:2px 7px;border-radius:5px;border:1px solid var(--brd)">${barcode}</span>`
          : `<span style="color:#ccc">—</span>`}
      </td>
      <td>
        <div style="display:flex;align-items:flex-start;gap:7px">
          <div style="width:18px;height:18px;border-radius:5px;flex-shrink:0;margin-top:2px;
            background:${r.hex};border:1px solid rgba(0,0,0,.12)"
            title="${r.pantone}"></div>
          <div style="min-width:0">
            <div style="font-weight:500;font-size:13px">${r.color}</div>
            ${r.pantone ? `<div style="font-size:10px;color:#aaa;margin-bottom:4px">${r.pantone}</div>` : ""}
            ${r.sizes && r.sizes.length > 0 ? `
              <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px">
                ${r.sizes.sort((a,b) => {
                  // Raqamli o'lchamlarni soniga qarab sort
                  const na = parseFloat(a.size), nb = parseFloat(b.size);
                  if (!isNaN(na) && !isNaN(nb)) return na - nb;
                  return a.size.localeCompare(b.size);
                }).map(s => {
                  const lvl = s.qty <= 0 ? "bg-r" : s.qty <= 3 ? "bg-a" : "";
                  return `<span class="bg ${lvl}" style="font-size:10.5px;padding:1px 6px;font-weight:${s.qty<=3?"700":"400"}"
                    title="${s.size}: ${s.qty} ${r.unit}">${s.size}<span style="color:${s.qty<=0?"#dc2626":s.qty<=3?"#92400e":"#888"};margin-left:2px;font-size:9.5px">${s.qty}</span></span>`;
                }).join("")}
              </div>` : ""}
          </div>
        </div>
      </td>
      <td class="num">${boxCell}</td>
      <td class="num">${qBadge}</td>
      <td class="num" style="font-size:12.5px">
        ${r.costUzs ? `<div style="font-weight:600">${priceDisplay(r.costUzs)}</div>` : "—"}
        ${r.costUzs && r.inBox > 1 ? `<div style="font-size:11px;color:#856404;margin-top:2px">📦 ${priceDisplay(r.costUzs * r.inBox)}</div>` : ""}
      </td>
      <td class="num" style="font-size:12.5px">
        ${r.ulgurji ? `<div style="font-weight:700;color:var(--acc)">${priceDisplay(r.ulgurji)}</div>` : '<span style="color:#ccc">—</span>'}
        ${r.ulgurji && r.inBox > 1 ? `<div style="font-size:11px;color:#e9a500;margin-top:2px">📦 ${priceDisplay(r.ulgurji * r.inBox)}</div>` : ""}
        ${margin != null ? `<div style="font-size:10px;color:${margin>=30?"var(--grn)":margin>=15?"#E07B39":"var(--red)"}">margin ${margin}%</div>` : ""}
      </td>
      ${showChakana ? `<td class="num" style="color:var(--teal);font-size:12.5px">${r.chakana ? fmt(r.chakana) + " so'm" : "—"}</td>` : ""}
      <td>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditProduct('${r.sku}')"
          title="Katalogda tahrirlash">
          <i class="ti ti-edit"></i>
        </button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="8" class="empty-td">
    ${omStockFilter !== "all" ? "Bu filtrda mahsulot yo'q" : q ? `"${q}" topilmadi` : "Mahsulot yo'q"}
  </td></tr>`;

  const el = $("om-qoldiq-table"); if (!el) return;
  el.querySelector("thead").innerHTML = thead;
  el.querySelector("tbody").innerHTML = tbody;

  const totalQty  = rows.reduce((a, r) => a + r.qty, 0);
  const totalVal  = rows.reduce((a, r) => a + r.qiymati, 0);
  const totalBoxes = rows.filter(r => r.boxes != null).reduce((a, r) => a + (r.boxes || 0), 0);
  const foot = $("om-qoldiq-foot");
  if (foot) foot.innerHTML = rows.length ? `
    <div style="display:flex;gap:24px;font-size:13px;padding:10px 16px;color:var(--mut);border-top:1px solid var(--brd)">
      <span>Jami: <strong style="color:#0D1B2A">${rows.length} ta rang varianti</strong></span>
      <span><strong>${totalBoxes}</strong> karobka</span>
      <span><strong>${totalQty}</strong> dona qoldiq</span>
      <span>Qiymati: <strong style="color:var(--acc)">${fmt(totalVal)} so'm</strong></span>
    </div>` : "";
}

// ── Kam qoldiq tab ───────────────────────────────
function omRenderKamQoldiq() {
  const el = $("om-tab-kam");
  if (!el) return;

  const threshold = db.settings?.lowStockLimit || 5;
  const rows = [];
  db.products.forEach(p => {
    const minQty = p.minStock || threshold;
    p.variants.forEach(v => {
      if (v.qty <= minQty)
        rows.push({ p, v, minQty });
    });
  });
  rows.sort((a,b) => a.v.qty - b.v.qty);

  const zeros    = rows.filter(r => r.v.qty === 0).length;
  const criticals = rows.filter(r => r.v.qty > 0 && r.v.qty <= 2).length;

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--brd);flex-wrap:wrap">
      <strong style="font-size:14px">Kam qoldiq — ${rows.length} ta variant</strong>
      ${zeros     ? `<span class="bg bg-r" style="font-size:12px">🚫 ${zeros} ta tugagan</span>` : ''}
      ${criticals ? `<span class="bg bg-a" style="font-size:12px">⚠️ ${criticals} ta kritik</span>` : ''}
      <span style="font-size:12px;color:var(--mut);margin-left:auto">
        Chegara:
        <input type="number" value="${threshold}" min="1" max="999"
          style="width:44px;font-size:12px;font-family:inherit;border:1.5px solid var(--brd);border-radius:6px;padding:2px 5px;text-align:center;margin:0 3px"
          onchange="setLowStockLimit(+this.value)">
        ta
      </span>
      <button class="btn btn-sm" onclick="exportLowStock()">
        <i class="ti ti-download"></i> Excel
      </button>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr>
          <th>Mahsulot</th>
          <th>Rang</th>
          <th>O'lcham</th>
          <th class="num">Qoldiq</th>
          <th class="num">Min chegara</th>
          <th>Holat</th>
          <th>Tannarx</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${rows.length ? rows.map(({p, v, minQty}) => {
            const rate = db.settings?.rate || 12800;
            const costUzs = Math.round((p.costUsd||0)*rate);
            const status = v.qty === 0
              ? '<span class="bg bg-r">🚫 Tugagan</span>'
              : v.qty <= 2
                ? '<span class="bg bg-r" style="background:#fff3cd;color:#856404">⚠️ Kritik</span>'
                : '<span class="bg bg-a">📉 Kam</span>';
            return `<tr style="${v.qty===0?'background:#fff5f5':''}">
              <td>
                <div style="font-weight:600;font-size:13px">${p.name}</div>
                <div style="font-size:11px;color:var(--mut)">${p.sku}</div>
              </td>
              <td>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:${v.size?'3px':'0'}">
                  <div style="width:12px;height:12px;border-radius:3px;background:${v.hex||'#888'};border:1px solid rgba(0,0,0,.1);flex-shrink:0"></div>
                  <span style="font-weight:500">${v.color||'—'}</span>
                </div>
              </td>
              <td style="font-weight:600">${v.size||'—'}</td>
              <td class="num">
                <span style="font-size:16px;font-weight:800;color:${v.qty===0?'var(--red)':v.qty<=2?'#d97706':'var(--acc)'}">
                  ${v.qty}
                </span>
                <span style="font-size:11px;color:var(--mut);display:block">${p.unit||'dona'}</span>
              </td>
              <td class="num" style="color:var(--mut);font-size:13px">${minQty} ta</td>
              <td>${status}</td>
              <td class="num" style="font-size:12.5px">${costUzs ? fmt(costUzs)+" so'm" : "—"}</td>
              <td>
                <button class="btn btn-sm btn-ghost" onclick="qabulFromAlert('${p.name.replace(/'/g,"&#39;")}')"
                  title="Tovar qabul">
                  <i class="ti ti-plus"></i> Qabul
                </button>
              </td>
            </tr>`;
          }).join('') : '<tr><td colspan="8" class="empty-td" style="color:var(--grn)">✅ Barcha tovarlar yetarli</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function setLowStockLimit(val) {
  if (!val || val < 1) return;
  if (!db.settings) db.settings = {};
  db.settings.lowStockLimit = val;
  saveDB();
  omRenderKamQoldiq();
  if (typeof renderDashboard === 'function') renderDashboard();
  toast("Chegara " + val + " ta ga o'zgartirildi", "info");
}

function exportLowStock() {
  const threshold = db.settings?.lowStockLimit || 5;
  const rows = [["Mahsulot","SKU","Rang","O'lcham","Qoldiq","Birlik","Holat"]];
  db.products.forEach(p => {
    const minQty = p.minStock || threshold;
    p.variants.forEach(v => {
      if (v.qty <= minQty)
        rows.push([p.name, p.sku, v.color||'', v.size||'', v.qty, p.unit||'dona',
          v.qty===0?'Tugagan':v.qty<=2?'Kritik':'Kam']);
    });
  });
  rows.sort((a,b)=>a[4]-b[4]);
  if (typeof downloadCSV === 'function') {
    downloadCSV(rows, 'merx_kam_qoldiq_'+today()+'.csv');
    toast('Excel yuklab olindi');
  }
}

function omRenderKirim() {
  const q    = ($("om-q")||{value:""}).value.toLowerCase();
  const list = db.ombor.filter(o =>
    !q || o.productName.toLowerCase().includes(q) ||
    (o.supplier||"").toLowerCase().includes(q) ||
    (o.color||"").toLowerCase().includes(q)
  ).slice().reverse();

  const el = $("ombor-body"); if (!el) return;
  el.innerHTML = list.length ? list.map(o => {
    const hex = o.hex || "#888";
    return `<tr>
      <td style="font-size:12px;color:var(--mut)">${o.date}</td>
      <td><div style="font-weight:600;font-size:13px">${o.productName}</div></td>
      <td><span class="bg bg-t" style="font-size:11px">${o.unit||"dona"}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:14px;height:14px;border-radius:3px;background:${hex};border:1px solid rgba(0,0,0,.12);flex-shrink:0"></div>
          ${o.color} <span style="color:#bbb">/</span> ${o.size}
        </div>
        ${o.pantone ? `<div style="font-size:10px;color:#aaa">${o.pantone}</div>` : ""}
        ${o.boxes ? `<div style="font-size:10.5px;color:#856404">📦 ${o.boxes} karobka</div>` : ""}
      </td>
      <td><span class="bg bg-g" style="font-weight:700">+${o.qty}</span></td>
      <td class="num" style="font-size:12.5px">${o.kirimNarxi ? fmt(o.kirimNarxi)+" so'm" : "—"}</td>
      <td class="num" style="font-weight:600;font-size:12.5px">${o.kirimNarxi ? fmt(o.kirimNarxi*o.qty)+" so'm" : "—"}</td>
      <td style="font-size:12.5px">${o.supplier||"—"}</td>
      <td style="font-size:12px;color:var(--mut)">${o.partiya||"—"}</td>
      <td><span class="bg ${o.payStatus==="qarz"?"bg-r":"bg-g"}">${o.payStatus==="qarz"?"To'lanmagan":"To'langan"}</span></td>
    </tr>`;
  }).join("") : `<tr><td colspan="11" class="empty-td">Kirim yo'q</td></tr>`;
}

function omRenderSuppliers() {
  const supMap = {};
  db.ombor.forEach(o => {
    const sup = o.supplier || "Noma'lum yetkazuvchi";
    if (!supMap[sup]) supMap[sup] = { name:sup, items:0, value:0, paid:0, debt:0, lastDate:"" };
    supMap[sup].items += o.qty;
    const val = (o.kirimNarxi||0) * o.qty;
    supMap[sup].value += val;
    if (o.payStatus === "qarz") supMap[sup].debt += val;
    else supMap[sup].paid += val;
    if (!supMap[sup].lastDate || o.date > supMap[sup].lastDate) supMap[sup].lastDate = o.date;
  });

  const list = Object.values(supMap).sort((a,b) => b.value - a.value);
  const el   = $("om-sup-body"); if (!el) return;
  el.innerHTML = list.length ? list.map(s => `<tr>
    <td>
      <div style="font-weight:600;font-size:13px">${s.name}</div>
      <div style="font-size:11px;color:#bbb">Oxirgi: ${s.lastDate||"—"}</div>
    </td>
    <td class="num">${s.items} dona</td>
    <td class="num" style="font-size:13px">${fmt(s.value)} so'm</td>
    <td class="num" style="color:var(--grn)">${fmt(s.paid)} so'm</td>
    <td class="num">
      ${s.debt > 0
        ? `<span style="font-weight:700;color:var(--red)">${fmt(s.debt)} so'm</span>`
        : `<span style="color:var(--grn)">✓ To'liq</span>`}
    </td>
  </tr>`).join("")
  : `<tr><td colspan="5" class="empty-td">Yetkazuvchi yo'q</td></tr>`;
}

function omSearch() { renderOmbor(); }

// ── Qabul formasi logikasi ─────────────────────
function qbAutofill(val) {
  $("qb-list").innerHTML = db.products
    .filter(p => p.name.toLowerCase().includes(val.toLowerCase()))
    .map(p => `<option value="${p.name}">`).join("");

  const p = db.products.find(x => x.name.toLowerCase() === val.toLowerCase().trim());
  if (!p) {
    // Yangi mahsulot — karobka panelini ko'rsatamiz, foydalanuvchi o'zi to'ldiradi
    const boxPanel    = $("qb-box-panel");
    const normalPanel = $("qb-normal-panel");
    if (boxPanel)    boxPanel.style.display    = "block";
    if (normalPanel) normalPanel.style.display = "none";
    if ($("qb-inbox-edit")) $("qb-inbox-edit").value = "";
    if ($("qb-info")) $("qb-info").textContent = "Yangi mahsulot — karobka ma'lumotlarini kiriting";
    return;
  }

  if ($("qb-unit")) $("qb-unit").value = p.unit || "dona";

  // O'lchamlar
  const sizes = [...new Set(p.variants.map(v => v.size))];
  $("qb-sizes").innerHTML = sizes.map(s => `<option value="${s}">`).join("");
  if ($("qb-size-hint")) $("qb-size-hint").textContent = sizes.length
    ? `(${sizes[0]}–${sizes[sizes.length-1]})` : "";

  // Ranglar — Pantone picker orqali tanlanadi (qb-colors datalist olib tashlangan)

  // Karobka panel — DOIM ko'rsatamiz
  const inBox = p.inBox || 1;
  const boxPanel    = $("qb-box-panel");
  const normalPanel = $("qb-normal-panel");
  if (boxPanel)    boxPanel.style.display    = "block";
  if (normalPanel) normalPanel.style.display = "none";
  if ($("qb-inbox-edit")) $("qb-inbox-edit").value = inBox > 1 ? inBox : "";
  qbCalcBoxes();

  // Narx placeholder
  if ($("qb-price"))   $("qb-price").placeholder   = fmt(p.priceUzs) + " (joriy)";
  if ($("qb-ulgurji")) {
    $("qb-ulgurji").placeholder = fmt(p.ulgurjiNarx||0) + " (joriy)";
    // Inputni tozalaymiz — eski qiymat data-raw ni noto'g'ri qilishi mumkin
    $("qb-ulgurji").value = "";
    $("qb-ulgurji").dataset.raw = "";
  }
  if ($("qb-cost")) {
    $("qb-cost").value = "";
    $("qb-cost").dataset.raw = "";
  }

  // Info matni
  const st = p.variants.map(v => `${v.color}/${v.size}(${v.qty})`).join(", ");
  if ($("qb-info")) $("qb-info").textContent =
    `Joriy: chakana ${fmt(p.priceUzs)} · ulgurji ${fmt(p.ulgurjiNarx||0)} · qoldiq: ${st}`;
}

function qbCalcBoxes() {
  const boxes   = parseInt(($("qb-boxes")||{value:1}).value)      || 1;
  const inBoxEd = parseInt(($("qb-inbox-edit")||{value:8}).value) || 8;
  const total   = boxes * inBoxEd;

  if ($("qb-total-show")) $("qb-total-show").textContent = total + " dona";
  if ($("qb-qty-box"))    $("qb-qty-box").value = total;

  // Razmer preview
  const from = ($("qb-size-from")||{value:""}).value;
  const to   = ($("qb-size-to")||{value:""}).value;
  const prev = $("qb-size-preview");
  if (prev && from && to) {
    prev.textContent = `→ ${from}–${to} razmerlar`;
  } else if (prev) {
    prev.textContent = "";
  }
}

function qabulOl() {
  const name = ($("qb-name")||{value:""}).value.trim();
  if (!name)  { toast("Mahsulot nomini kiriting","err"); return; }

  const isBoxMode = ($("qb-box-panel")?.style.display !== "none");
  const pantone = ($("qb-pantone")||{value:""}).value.trim();
  const hex     = ($("qb-hex")||{value:"#888888"}).value;
  const boxes   = parseInt(($("qb-boxes")||{value:0}).value) || null;
  const inBoxEd = parseInt(($("qb-inbox-edit")||{value:8}).value) || 8;

  let color, size, qty;

  if (isBoxMode) {
    color = ($("qb-color")||{value:""}).value.trim();
    if (!color) { toast("Rang tanlang","err"); return; }

    const sizeFrom = ($("qb-size-from")||{value:""}).value;
    const sizeTo   = ($("qb-size-to")||{value:""}).value;
    if (!sizeFrom || !sizeTo) { toast("Razmer oralig'ini tanlang","err"); return; }

    qty  = (boxes || 1) * inBoxEd;
    size = `${sizeFrom}–${sizeTo}`;
  } else {
    color = ($("qb-color")||{value:""}).value.trim();
    size  = ($("qb-size")||{value:""}).value.trim();
    qty   = parseInt(($("qb-qty")||{value:0}).value) || 0;

    if (!color) { toast("Rang tanlang","err"); return; }
    if (!size)  { toast("O'lcham kiriting","err"); return; }
    if (qty <= 0) { toast("Miqdor kiriting","err"); return; }
  }

  const cur_q   = db.settings?.priceCurrency || "uzs";
  const rate_q  = db.settings?.rate || 12800;
  const isUsd_q = cur_q === "usd" || cur_q === "both";
  const kirimRaw  = getRawVal("qb-cost");
  // kirimNarxi omborda har doim so'mda saqlanadi
  const kirimN    = isUsd_q ? Math.round(kirimRaw * rate_q) : kirimRaw;
  // costUsd mahsulotda har doim USD da saqlanadi
  const costUsd_q = isUsd_q ? kirimRaw : (kirimRaw > 0 ? kirimRaw / rate_q : 0);
  const newChk    = getRawVal("qb-price");
  const newUlg    = getRawVal("qb-ulgurji");
  const unit      = ($("qb-unit")||{value:"dona"}).value;
  const qbBarcode = ($("qb-barcode")||{value:""}).value.trim();

  let p = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (p) {
    const v = p.variants.find(x => x.color === color && x.size === size);
    if (v) {
      v.qty += qty;
      if (pantone) { v.pantone = pantone; v.hex = hex; }
    } else {
      p.variants.push({ color, size, qty, pantone, hex });
    }
    if (newChk > 0) p.priceUzs    = newChk;
    if (newUlg > 0) p.ulgurjiNarx = newUlg;
    if (qbBarcode)  p.barcode     = qbBarcode;
    if (kirimRaw > 0) p.costUsd   = costUsd_q;
    if (isBoxMode && inBoxEd > 1) p.inBox = inBoxEd;
    p.unit = unit;
  } else {
    db.products.push({
      sku:`RECV-${String(db.seq++).padStart(3,"0")}`,
      name, category:"Qabul qilingan", type:"oyoq",
      unit, inBox: inBoxEd > 1 ? inBoxEd : 1,
      costUsd: costUsd_q,
      priceUzs:newChk||0, ulgurjiNarx:newUlg||0,
      barcode: qbBarcode || genEAN13(db.seq),
      variants:[{color, size, qty, pantone, hex}]
    });
    p = db.products[db.products.length - 1];
  }

  db.ombor.push({
    id:db.seq++, date:today(), sku:p.sku,
    productName:name, unit, color, size, qty,
    pantone, hex,
    boxes: boxes || null,
    kirimNarxi:  kirimN,
    chakana:     newChk || p.priceUzs    || 0,
    ulgurji:     newUlg || p.ulgurjiNarx || 0,
    supplier:    ($("qb-sup")||{value:""}).value,
    partiya:     ($("qb-partiya")||{value:""}).value,
    payStatus:   ($("qb-pay")||{value:"tolandan"}).value
  });

  saveDB(); closeModal("qabul"); renderOmbor();
  if (typeof renderKatalog === "function") renderKatalog();

  ["qb-name","qb-size","qb-sup","qb-partiya","qb-barcode"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("qb-qty"))  $("qb-qty").value  = "10";
  if ($("qb-cost")) $("qb-cost").value = "";
  if ($("qb-info")) $("qb-info").textContent = "";
  if ($("qb-box-panel")) $("qb-box-panel").style.display = "none";
  if (typeof ppReset === "function") ppReset("qb");

  toast(`✅ ${name} (${color}/${size}) — ${qty} ${unit} qabul qilindi`);
}

// ── Excel eksport ──────────────────────────────
function exportOmborExcel() {
  const rate = db.settings.rate || 12800;
  const tab  = omActiveTab;

  if (tab === "qoldiq" || tab === "kirim") {
    const rows = tab === "qoldiq"
      ? exportOmborQoldiq(rate)
      : exportOmborKirim();
    const name = tab === "qoldiq" ? "joriy_qoldiq" : "kirim_tarixi";
    downloadCSVOmbor(rows, `merx_ombor_${name}_${today()}.csv`);
    toast(`Ombor ${tab === "qoldiq" ? "joriy qoldiq" : "kirim tarixi"} yuklab olindi`);
  } else {
    exportOmborSuppliers(rate);
  }
}

function exportOmborQoldiq(rate) {
  const rows = [["Mahsulot nomi","SKU","Barcode","Rang","Pantone","Karobka soni","Dona soni","Tannarx (so'm)","Ulgurji narx (so'm)","Margin (%)"]];
  db.products.forEach(p => {
    const costUzs = Math.round((p.costUsd||0)*rate);
    const inBox   = p.inBox || 1;
    const colorGroups = {};
    p.variants.forEach(v => {
      if (!colorGroups[v.color]) colorGroups[v.color] = { hex:v.hex||"", pantone:v.pantone||"", qty:0 };
      colorGroups[v.color].qty += v.qty;
    });
    Object.entries(colorGroups).forEach(([color, info]) => {
      const boxes  = inBox > 1 ? (info.qty / inBox).toFixed(1) : "";
      const margin = p.ulgurjiNarx > 0 && costUzs > 0
        ? Math.round((p.ulgurjiNarx - costUzs) / p.ulgurjiNarx * 100) : "";
      rows.push([p.name, p.sku, p.barcode||"", color, info.pantone,
        boxes, info.qty, costUzs, p.ulgurjiNarx||0, margin]);
    });
  });
  return rows;
}

function exportOmborKirim() {
  const rows = [["Sana","Mahsulot","SKU","Rang","Pantone","O'lcham","Miqdor","Karobka soni","Tannarx","Jami","Yetkazuvchi","Partiya","To'lov holati"]];
  db.ombor.slice().reverse().forEach(o => {
    rows.push([o.date, o.productName, o.sku||"", o.color||"", o.pantone||"",
      o.size||"", o.qty, o.boxes||"", o.kirimNarxi||0,
      (o.kirimNarxi||0)*o.qty, o.supplier||"", o.partiya||"",
      o.payStatus === "qarz" ? "To'lanmagan" : "To'langan"]);
  });
  return rows;
}

function exportOmborSuppliers(rate) {
  const supMap = {};
  db.ombor.forEach(o => {
    const s = o.supplier || "Noma'lum";
    if (!supMap[s]) supMap[s] = { items:0, value:0, paid:0, debt:0, last:"" };
    supMap[s].items += o.qty;
    const val = (o.kirimNarxi||0)*o.qty;
    supMap[s].value += val;
    if (o.payStatus==="qarz") supMap[s].debt += val;
    else supMap[s].paid += val;
    if (!supMap[s].last || o.date > supMap[s].last) supMap[s].last = o.date;
  });
  const rows = [["Yetkazuvchi","Jami dona","Jami qiymat (so'm)","To'langan (so'm)","Qarz (so'm)","Oxirgi yetkazma"]];
  Object.entries(supMap).forEach(([name, s]) => {
    rows.push([name, s.items, s.value, s.paid, s.debt, s.last]);
  });
  downloadCSVOmbor(rows, `merx_yetkazuvchilar_${today()}.csv`);
  toast("Yetkazuvchilar ro'yxati yuklab olindi");
}

function downloadCSVOmbor(rows, filename) {
  downloadCSV(rows, filename);
}

// ── Karobka narx hintlari ─────────────────────
function qbUpdateBoxHints() {
  const inBox = parseInt(($("qb-inbox-edit")||{value:0}).value) || 0;
  const rate  = db.settings?.rate || 12800;
  const cur   = db.settings?.priceCurrency || "uzs";
  const isUsd = cur === "usd" || cur === "both";

  function getVal(id) {
    const el = $(id); if (!el) return 0;
    // data-raw ishlatilsa — u fmtInput tomonidan saqlanadi (raqamlar faqat)
    if (el.dataset.raw && el.dataset.raw !== "") return parseInt(el.dataset.raw) || 0;
    // Aks holda valueni tozalab olamiz
    return parseFloat((el.value||"").replace(/[^0-9.]/g,"")) || 0;
  }

  function showHint(hintId, rawVal, convertToUzs) {
    const el = $(hintId); if (!el) return;
    if (!rawVal || rawVal <= 0 || inBox < 2) { el.style.display = "none"; return; }
    const donaUzs = convertToUzs ? Math.round(rawVal * rate) : rawVal;
    const total   = donaUzs * inBox;
    const span    = el.querySelector("span");
    const unitLbl = convertToUzs ? `$${rawVal.toFixed(2)}` : `${fmt(rawVal)} so'm`;
    if (span) span.textContent = `1 karobka = ${fmt(total)} so'm (${inBox} × ${unitLbl})`;
    el.style.display = "inline-flex";
  }

  const costVal = getVal("qb-cost");
  const ulgVal  = getVal("qb-ulgurji");

  // qb-cost: USD rejimida USD kiritiladi, so'm rejimida so'm
  showHint("qb-cost-hint", costVal, isUsd);
  // qb-ulgurji: har doim so'mda
  showHint("qb-ulg-hint",  ulgVal,  false);
}

// ================================================
// INVENTARIZATSIYA
// ================================================

let _invData    = [];  // [{sku, color, size, systemQty, actualQty, counted}]
let _invFilter  = "all";

// ── Ochish ────────────────────────────────────────
function openInvent() {
  // Barcha mahsulot/rang/o'lcham kombinatsiyalarini yaratish
  _invData = [];
  db.products.forEach(p => {
    p.variants.forEach(v => {
      _invData.push({
        sku:       p.sku,
        name:      p.name,
        color:     v.color,
        size:      v.size || "—",
        hex:       v.hex  || "#888",
        pantone:   v.pantone || "",
        unit:      p.unit || "dona",
        inBox:     p.inBox || 1,
        barcode:   p.barcode || "",
        systemQty: v.qty,
        actualQty: null,   // sanalmaganda null
        counted:   false
      });
    });
  });

  // Sana
  const lbl = $("inv-date-lbl");
  if (lbl) lbl.textContent = `Sana: ${today()} | Tizim: ${_invData.length} ta variant`;

  setInvFilter("all");
  renderInvTable();
  updateInvStats();

  // Modalni ochish
  const ov = $("ov-invent");
  if (ov) ov.style.display = "flex";
  setTimeout(() => { if ($("inv-scan")) $("inv-scan").focus(); }, 100);
}

function closeInvent() {
  const ov = $("ov-invent");
  if (ov) ov.style.display = "none";
}

// ── Filter ────────────────────────────────────────
function setInvFilter(f) {
  _invFilter = f;
  document.querySelectorAll(".inv-filter-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.f === f));
  renderInvTable();
}

// ── Qidiruv/skaner ────────────────────────────────
function invSearch() {
  renderInvTable();
}

function invScanEnter() {
  const q = ($("inv-scan")||{value:""}).value.trim();
  if (!q) return;

  // Barcode bo'yicha toping
  const row = _invData.find(r =>
    r.barcode === q ||
    r.name.toLowerCase() === q.toLowerCase()
  );

  if (row) {
    // Topilsa — soni 1 ga oshir yoki focus
    const inputEl = document.querySelector(`input[data-inv-key="${row.sku}_${row.color}_${row.size}"]`);
    if (inputEl) {
      const cur = parseInt(inputEl.value) || 0;
      inputEl.value = cur + 1;
      invSetQty(row.sku, row.color, row.size, cur + 1);
      inputEl.classList.add("changed");
      inputEl.focus();
    }
    if ($("inv-scan")) $("inv-scan").value = "";
  } else {
    toast(`"${q}" topilmadi`, "err");
  }
}

// ── Miqdor o'zgartirish ───────────────────────────
function invSetQty(sku, color, size, val) {
  const row = _invData.find(r => r.sku===sku && r.color===color && r.size===size);
  if (!row) return;
  const n = parseInt(val);
  row.actualQty = isNaN(n) ? null : Math.max(0, n);
  row.counted   = row.actualQty !== null;
  updateInvStats();
  renderInvRow(sku, color, size);
}

// ── Jadval render ─────────────────────────────────
function renderInvTable() {
  const q = ($("inv-scan")||{value:""}).value.toLowerCase();
  const tbody = $("inv-body"); if (!tbody) return;

  let rows = _invData;

  // Filtr
  if (_invFilter === "diff")    rows = rows.filter(r => r.counted && r.actualQty !== r.systemQty);
  if (_invFilter === "done")    rows = rows.filter(r => r.counted);
  if (_invFilter === "notdone") rows = rows.filter(r => !r.counted);

  // Qidiruv
  if (q) rows = rows.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.color.toLowerCase().includes(q) ||
    r.barcode.includes(q) ||
    r.sku.toLowerCase().includes(q)
  );

  tbody.innerHTML = rows.map(r => invRowHtml(r)).join("");
}

function invRowHtml(r) {
  const diff     = r.counted ? (r.actualQty - r.systemQty) : null;
  const rowClass = !r.counted ? "" : diff !== 0 ? "inv-row-diff" : "inv-row-done";
  const diffCell = diff === null ? `<span style="color:#ccc">—</span>`
    : diff > 0 ? `<span style="color:var(--grn);font-weight:700">+${diff}</span>`
    : diff < 0 ? `<span style="color:var(--red);font-weight:700">${diff}</span>`
    : `<span style="color:var(--grn)">✓ 0</span>`;
  const key = `${r.sku}_${r.color}_${r.size}`;

  return `<tr class="${rowClass}" style="border-bottom:1px solid #F0EDE8">
    <td style="padding:10px 16px">
      <div style="font-weight:600;font-size:13px">${r.name}</div>
      <div style="font-size:11px;color:#aaa">${r.sku} ${r.barcode ? "· " + r.barcode : ""}</div>
    </td>
    <td style="padding:10px">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:14px;height:14px;border-radius:4px;background:${r.hex};border:1px solid rgba(0,0,0,.1)"></div>
        <span style="font-size:13px">${r.color}</span>
        ${r.size && r.size!=="—" ? `<span style="color:#bbb;font-size:11px">/ ${r.size}</span>` : ""}
      </div>
    </td>
    <td style="padding:10px;text-align:center">
      <span style="font-weight:700;font-size:14px">${r.systemQty}</span>
      <span style="font-size:11px;color:#aaa"> ${r.unit}</span>
    </td>
    <td style="padding:10px;text-align:center">
      <input type="number" min="0" value="${r.actualQty !== null ? r.actualQty : ""}"
        placeholder="?" class="inv-qty-input ${r.counted?"changed":""}"
        data-inv-key="${key}"
        oninput="invSetQty('${r.sku}','${r.color.replace(/'/g,"\\'")}','${r.size}',this.value)"
        style="width:70px">
    </td>
    <td style="padding:10px;text-align:center">${diffCell}</td>
    <td style="padding:10px;text-align:center">
      ${r.counted
        ? diff === 0
          ? `<span class="bg bg-g" style="font-size:11px">✅ Mos</span>`
          : `<span class="bg bg-r" style="font-size:11.5px">⚠️ Farq</span>`
        : `<span class="bg" style="font-size:11px;color:#bbb">🔲 Kutilmoqda</span>`}
    </td>
  </tr>`;
}

function renderInvRow(sku, color, size) {
  // Bir qatorni qayta render qilish
  const tbody = $("inv-body"); if (!tbody) return;
  renderInvTable(); // Sodda yondashuv
}

// ── Statistika ────────────────────────────────────
function updateInvStats() {
  const total = _invData.length;
  const done  = _invData.filter(r => r.counted).length;
  const diff  = _invData.filter(r => r.counted && r.actualQty !== r.systemQty).length;

  if ($("inv-total-cnt"))   $("inv-total-cnt").textContent   = total;
  if ($("inv-done-cnt"))    $("inv-done-cnt").textContent    = done;
  if ($("inv-diff-cnt"))    $("inv-diff-cnt").textContent    = diff;
  if ($("inv-progress"))    $("inv-progress").textContent    = `${done}/${total} sanalgan`;
}

// ── Tasdiqlash ────────────────────────────────────
function confirmInvent() {
  const counted = _invData.filter(r => r.counted);
  if (!counted.length) { toast("Hech narsa sanalmadi","err"); return; }

  const diffs = counted.filter(r => r.actualQty !== r.systemQty);
  const msg = diffs.length > 0
    ? `${counted.length} ta variant sanalgan. ${diffs.length} ta farq bor.\n\nQoldiqlarni yangilash tasdiqlaysizmi?`
    : `${counted.length} ta variant sanalgan. Farq yo'q. Tasdiqlaysizmi?`;

  if (!confirm(msg)) return;

  // Qoldiqlarni yangilash
  let updated = 0;
  counted.forEach(r => {
    const p = db.products.find(x => x.sku === r.sku);
    if (!p) return;
    const v = p.variants.find(x => x.color === r.color && x.size === r.size);
    if (!v) return;
    if (v.qty !== r.actualQty) {
      v.qty = r.actualQty;
      updated++;
    }
  });

  // Inventarizatsiya tarixini saqlash
  if (!db.inventarizatsiya) db.inventarizatsiya = [];
  db.inventarizatsiya.push({
    id:      db.seq++,
    date:    today(),
    time:    new Date().toTimeString().slice(0,5),
    counted: counted.length,
    diffs:   diffs.length,
    updated,
    items:   counted.map(r => ({
      sku:       r.sku,
      name:      r.name,
      color:     r.color,
      size:      r.size,
      systemQty: r.systemQty,
      actualQty: r.actualQty,
      diff:      r.actualQty - r.systemQty
    }))
  });

  saveDB();
  closeInvent();
  renderOmbor();
  toast(`✅ ${updated} ta variant yangilandi. Inventarizatsiya tugadi.`);
}

// ── Excel eksport ─────────────────────────────────
function exportInventExcel() {
  const rows = [["Mahsulot","SKU","Rang","O'lcham","Tizim qoldig'i","Haqiqiy qoldiq","Farq","Holat"]];
  _invData.forEach(r => {
    const diff = r.counted ? r.actualQty - r.systemQty : null;
    rows.push([
      r.name, r.sku, r.color, r.size,
      r.systemQty,
      r.actualQty !== null ? r.actualQty : "",
      diff !== null ? diff : "",
      !r.counted ? "Sanalmagan" : diff === 0 ? "Mos" : diff > 0 ? "Ortiqcha" : "Kamomad"
    ]);
  });

  const csv = "sep=;\r\n" + rows.map(r =>
    r.map(c => { const s=String(c==null?"":c); return s.includes(";")?`"${s}"`:s; }).join(";")
  ).join("\n");
    downloadCSV(rows, `merx_invent_${today()}.xls`);
  toast("Inventarizatsiya Excel yuklab olindi");
}

// ════════════════════════════════════════════════
// HISOBDAN CHIQARISH (WRITE-OFF)
// ════════════════════════════════════════════════

const CHIQIM_SABABLAR = [
  { key:"nuqson",   label:"🔧 Nuqsonli",    color:"#E07B39" },
  { key:"ogirlik",  label:"🔓 O'g'irlik",   color:"#E05A5A" },
  { key:"yoqolish", label:"❓ Yo'qolish",   color:"#8B5CF6" },
  { key:"qaytarish",label:"↩️ Qaytarildi",  color:"#4C9BE8" },
  { key:"eskirish", label:"📦 Eskirish",    color:"#888"    },
  { key:"boshqa",   label:"📋 Boshqa",      color:"#aaa"    },
];

// ── Modal ochish ──────────────────────────────────
function openChiqimModal() {
  // Forma tozalash
  const nameInp = $("ch-name"); if (nameInp) nameInp.value = "";
  const colorInp = $("ch-color"); if (colorInp) colorInp.value = "";
  const sizeInp = $("ch-size"); if (sizeInp) sizeInp.value = "";
  const qtyInp = $("ch-qty"); if (qtyInp) qtyInp.value = "1";
  const noteInp = $("ch-note"); if (noteInp) noteInp.value = "";
  if ($("ch-reason")) $("ch-reason").value = "nuqson";

  // Mahsulotlar ro'yxati
  const list = $("ch-prod-list");
  if (list) list.innerHTML = db.products.map(p =>
    `<option value="${p.name}">`
  ).join("");

  renderChiqimColorSize();
  openModal("chiqim");
  setTimeout(() => { if ($("ch-name")) $("ch-name").focus(); }, 50);
}

// ── Mahsulot tanlaganda rang/o'lchamlarni yuklash ──
function renderChiqimColorSize() {
  const name = ($("ch-name")||{value:""}).value.trim();
  const p = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());

  const colorSel = $("ch-color");
  const sizeSel  = $("ch-size");
  const stockEl  = $("ch-stock-info");

  if (!p) {
    if (colorSel) colorSel.innerHTML = '<option value="">— avval mahsulot tanlang —</option>';
    if (sizeSel)  sizeSel.innerHTML  = '<option value="">—</option>';
    if (stockEl)  stockEl.textContent = "";
    return;
  }

  // Ranglar
  const colors = [...new Set(p.variants.map(v => v.color))];
  if (colorSel) {
    colorSel.innerHTML = '<option value="">— Rang tanlang —</option>' +
      colors.map(c => {
        const qty = p.variants.filter(v => v.color === c).reduce((a,v) => a+v.qty, 0);
        return `<option value="${c}">${c} (${qty} ${p.unit||"dona"})</option>`;
      }).join("");
  }

  renderChiqimSizes();
}

function renderChiqimSizes() {
  const name  = ($("ch-name")||{value:""}).value.trim();
  const color = ($("ch-color")||{value:""}).value;
  const p = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());
  const sizeSel = $("ch-size");
  const stockEl = $("ch-stock-info");

  if (!p || !color) {
    if (sizeSel) sizeSel.innerHTML = '<option value="">— avval rang tanlang —</option>';
    if (stockEl) stockEl.textContent = "";
    return;
  }

  const variants = p.variants.filter(v => v.color === color);
  if (sizeSel) {
    sizeSel.innerHTML = '<option value="">— O\'lcham tanlang —</option>' +
      variants.map(v =>
        `<option value="${v.size}" ${v.qty<=0?"disabled":""}>
          ${v.size} — ${v.qty} ${p.unit||"dona"}${v.qty<=0?" (tugagan)":""}
        </option>`
      ).join("");
  }

  // Jami qoldiq
  const total = variants.reduce((a,v) => a+v.qty, 0);
  if (stockEl) stockEl.textContent = `Qoldiq: ${total} ${p.unit||"dona"}`;
  updateChiqimMax();
}

function updateChiqimMax() {
  const name  = ($("ch-name")||{value:""}).value.trim();
  const color = ($("ch-color")||{value:""}).value;
  const size  = ($("ch-size")||{value:""}).value;
  const qtyInp = $("ch-qty");
  const stockEl = $("ch-stock-info");

  const p = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!p || !color || !size) return;

  const v = p.variants.find(x => x.color === color && x.size === size);
  const maxQty = v ? v.qty : 0;
  if (qtyInp) {
    qtyInp.max = maxQty;
    qtyInp.style.borderColor = maxQty <= 0 ? "var(--red)" : "";
  }
  if (stockEl) {
    stockEl.textContent = `Qoldiq: ${maxQty} ${p.unit||"dona"}`;
    stockEl.style.color = maxQty <= 0 ? "var(--red)" : "var(--mut)";
  }
}

// ── Chiqimni saqlash ─────────────────────────────
function saveChiqim() {
  const name   = ($("ch-name")||{value:""}).value.trim();
  const color  = ($("ch-color")||{value:""}).value;
  const size   = ($("ch-size")||{value:""}).value;
  const qty    = parseInt(($("ch-qty")||{value:0}).value) || 0;
  const reason = ($("ch-reason")||{value:"boshqa"}).value;
  const note   = ($("ch-note")||{value:""}).value.trim();

  if (!name)  { toast("Mahsulot tanlang","err"); return; }
  if (!color) { toast("Rang tanlang","err"); return; }
  if (!size)  { toast("O'lcham tanlang","err"); return; }
  if (qty <= 0) { toast("Miqdor kiriting","err"); return; }

  const p = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!p) { toast("Mahsulot topilmadi","err"); return; }

  const v = p.variants.find(x => x.color === color && x.size === size);
  if (!v) { toast("Bu variant topilmadi","err"); return; }
  if (v.qty < qty) { toast(`Faqat ${v.qty} ta mavjud`,"err"); return; }

  const rate    = db.settings.rate || 12800;
  const costUzs = Math.round((p.costUsd || 0) * rate);

  // Ombordan ayirish
  v.qty -= qty;

  // Chiqim yozuvi
  db.chiqimlar.push({
    id:          db.seq++,
    date:        today(),
    time:        nowTime(),
    productName: p.name,
    sku:         p.sku,
    color, size, qty,
    unit:        p.unit || "dona",
    reason,
    note:        note || "",
    costUzs:     costUzs * qty,
    costUsdEach: p.costUsd || 0
  });

  saveDB();
  closeModal("chiqim");
  renderOmbor();

  const sababLabel = CHIQIM_SABABLAR.find(s => s.key === reason)?.label || reason;
  toast(`✅ ${name} (${color}/${size}) — ${qty} ta hisobdan chiqarildi (${sababLabel})`);
}

// ── Chiqimlar tarixini ko'rsatish ─────────────────
function omRenderChiqim() {
  const el = $("om-tab-chiqim"); if (!el) return;
  const q  = ($("om-q")||{value:""}).value.toLowerCase();

  let list = [...(db.chiqimlar||[])].reverse();
  if (q) list = list.filter(c =>
    c.productName.toLowerCase().includes(q) ||
    (c.color||"").toLowerCase().includes(q) ||
    (c.reason||"").toLowerCase().includes(q) ||
    (c.note||"").toLowerCase().includes(q)
  );

  const totalQty  = list.reduce((a,c) => a+c.qty, 0);
  const totalCost = list.reduce((a,c) => a+(c.costUzs||0), 0);

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--brd);flex-wrap:wrap">
      <strong style="font-size:13.5px">${list.length} ta yozuv</strong>
      <span style="font-size:12.5px;color:var(--mut)">Jami: <strong style="color:#0D1B2A">${totalQty} dona</strong></span>
      <span style="font-size:12.5px;color:var(--mut)">Zarar: <strong style="color:var(--red)">${fmt(totalCost)} so'm</strong></span>
      <button class="btn btn-sm btn-ghost" onclick="exportChiqimExcel()" style="margin-left:auto;color:#1D6A39">
        <i class="ti ti-file-spreadsheet"></i> Excel
      </button>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr>
          <th>Sana</th><th>Mahsulot</th><th>Rang/O'lcham</th>
          <th class="num">Miqdor</th><th>Sabab</th><th>Izoh</th>
          <th class="num">Zarar</th><th></th>
        </tr></thead>
        <tbody>
          ${list.length ? list.map(c => {
            const sabab = CHIQIM_SABABLAR.find(s => s.key === c.reason) || { label:c.reason, color:"#888" };
            return `<tr>
              <td style="font-size:12px;white-space:nowrap">
                <div>${c.date}</div>
                <div style="color:var(--mut);font-size:10.5px">${c.time||""}</div>
              </td>
              <td>
                <div style="font-weight:600;font-size:13px">${c.productName}</div>
                <div style="font-size:11px;color:var(--mut)">${c.sku}</div>
              </td>
              <td style="font-size:12.5px">${c.color||"—"} / ${c.size||"—"}</td>
              <td class="num" style="font-weight:700;color:var(--red)">−${c.qty} ${c.unit||"ta"}</td>
              <td>
                <span class="bg" style="font-size:11.5px;background:${sabab.color}18;color:${sabab.color}">
                  ${sabab.label}
                </span>
              </td>
              <td style="font-size:12px;color:var(--mut);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${c.note||"—"}
              </td>
              <td class="num" style="color:var(--red);font-size:12.5px">
                ${c.costUzs ? fmt(c.costUzs)+" so'm" : "—"}
              </td>
              <td>
                <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteChiqim(${c.id})"
                  title="O'chirish" style="color:var(--red)">
                  <i class="ti ti-trash"></i>
                </button>
              </td>
            </tr>`;
          }).join("") : '<tr><td colspan="8" class="empty-td">Chiqimlar yo\'q</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function deleteChiqim(id) {
  const c = db.chiqimlar.find(x => x.id === id); if (!c) return;
  if (!confirm(`${c.productName} (${c.color}/${c.size}) — ${c.qty} ta chiqimni o'chirasizmi?\nOmbor qoldig'i TIKLANMAYDI.`)) return;
  db.chiqimlar = db.chiqimlar.filter(x => x.id !== id);
  saveDB(); omRenderChiqim();
  toast("Chiqim o'chirildi", "info");
}

function exportChiqimExcel() {
  const rows = [["Sana","Mahsulot","SKU","Rang","O'lcham","Miqdor","Birlik","Sabab","Izoh","Zarar (so'm)"]];
  (db.chiqimlar||[]).slice().reverse().forEach(c => {
    const sabab = CHIQIM_SABABLAR.find(s => s.key === c.reason)?.label || c.reason;
    rows.push([c.date, c.productName, c.sku, c.color||"", c.size||"", c.qty, c.unit||"dona", sabab, c.note||"", c.costUzs||0]);
  });
  if (typeof downloadCSV === "function") {
    downloadCSV(rows, "merx_chiqimlar_" + today() + ".csv");
    toast("Excel yuklab olindi");
  }
}
