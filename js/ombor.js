// MERX ombor.js | v2.3 | 2026-06-06 12:54 | 2026-06-06 06:00
// ================================================
// MERX — js/ombor.js  (v3 — Pantone + Karobka)
// ================================================

let omActiveTab   = "qoldiq";
let omStockFilter = "all";

// ── Ustunlar sozlash (Katalogdagi kabi to'liq) ────
const OM_ALL_COLS = [
  { key:"image",      lbl:"Rasm",             def:true  },
  { key:"art",        lbl:"ART (artikul)",    def:true  },
  { key:"sku",        lbl:"SKU kodi",         def:false },
  { key:"kategoriya", lbl:"Kategoriya",       def:false },
  { key:"barcode",    lbl:"Barcode",          def:false },
  { key:"sizes",      lbl:"O'lchamlar",       def:true  },
  { key:"boxes",      lbl:"Karobka soni",     def:true  },
  { key:"tannarx",    lbl:"Tannarx",          def:true  },
  { key:"ulgurji",    lbl:"Ulgurji narx",     def:true  },
  { key:"chakana",    lbl:"Chakana narx",     def:false },
  { key:"qiymati",    lbl:"Qoldiq qiymati",   def:true  },
  { key:"margin",     lbl:"Margin %",         def:false },
];

const OM_DEFAULT_COLS = Object.fromEntries(OM_ALL_COLS.map(c => [c.key, c.def]));

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
  const vProds = typeof visProds === "function" ? visProds() : db.products;
  const totalVal = vProds.reduce((a,p) =>
    a + p.variants.reduce((b,v) => b + (p.costUsd*rate)*v.qty, 0), 0);
  const totalUnits = vProds.reduce((a,p) =>
    a + p.variants.reduce((b,v) => b + v.qty, 0), 0);

  const el = $("om-kpi-row"); if (!el) return;
  el.innerHTML = [
    { icon:"ti-arrow-down-circle", color:"#4C9BE8", lbl:"Bugungi kirim",    val:todayIn+" dona",       sub:"bugun qabul qilindi" },
    { icon:"ti-box",               color:"#36B48C", lbl:"Jami qoldiq",      val:totalUnits+" dona",    sub:vProds.length+" turdagi tovar" },
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
  openModal("omcols");
  omRenderColsPanel();
}

function omRenderColsPanel() {
  const cols = omGetCols();
  const el = $("om-cols-list"); if (!el) return;
  el.innerHTML = OM_ALL_COLS.map(d => `
    <label class="kat-col-item ${cols[d.key]?"active":""}" onclick="omToggleCol('${d.key}',${!cols[d.key]}); return false;">
      <div class="kat-col-check">${cols[d.key]
        ? `<i class="ti ti-check" style="font-size:13px;color:#fff"></i>`
        : ``}</div>
      <span>${d.lbl}</span>
    </label>`).join("");
}

function omToggleCol(key, val) {
  if (!db.settings.omborCols) db.settings.omborCols = {};
  db.settings.omborCols[key] = val;
  saveDB(); omRenderColsPanel(); omRenderQoldiq();
}

function omColsReset() {
  db.settings.omborCols = {};
  saveDB(); omRenderColsPanel(); omRenderQoldiq();
  toast("Ustunlar asl holiga qaytarildi");
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
  const cols = omGetCols();

  const vp = typeof visProds === "function" ? visProds() : db.products;
  let rows = [];
  vp.forEach(p => {
    // Rang bo'yicha guruhlash — o'lchamlar ham saqlanadi
    const colorGroups = {};
    p.variants.forEach(v => {
      if (!colorGroups[v.color]) {
        colorGroups[v.color] = {
          color:   v.color,
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
      const margin  = p.ulgurjiNarx > 0 && costUzs > 0
        ? Math.round((p.ulgurjiNarx - costUzs) / p.ulgurjiNarx * 100) : null;

      rows.push({
        sku:     p.sku,
        art:     p.art || "",
        name:    p.name,
        category:p.category || "",
        image:   p.image || "",
        color:   cg.color,
        pantone: cg.pantone,
        qty:     cg.qty,
        sizes:   cg.sizes,
        inBox,
        boxes,
        packUnit: p.packUnit || "karobka",
        unit:    p.unit || "dona",
        barcode: p.barcode || "",
        costUzs,
        chakana: p.priceUzs,
        ulgurji: p.ulgurjiNarx || 0,
        margin,
        qiymati: Math.round(cg.qty * (p.costUsd || 0) * rate)
      });
    });
  });

  if (omStockFilter === "low") rows = rows.filter(r => r.qty > 0 && r.qty <= 5);
  if (omStockFilter === "out") rows = rows.filter(r => r.qty <= 0);
  if (q) rows = rows.filter(r =>
    r.name.toLowerCase().includes(q)    ||
    r.sku.toLowerCase().includes(q)     ||
    (r.art && r.art.toLowerCase().includes(q)) ||
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
    ${cols.image      ? '<th style="width:50px">Rasm</th>' : ""}
    ${cols.sku        ? '<th style="width:70px">SKU</th>' : ""}
    ${cols.art        ? '<th style="width:80px">ART</th>' : ""}
    <th>Mahsulot nomi</th>
    ${cols.kategoriya ? '<th>Kategoriya</th>' : ""}
    ${cols.barcode    ? '<th style="width:130px">Barcode</th>' : ""}
    <th>Rang</th>
    ${cols.sizes      ? "<th>O'lchamlar</th>" : ""}
    ${cols.boxes      ? '<th class="num">Karobka</th>' : ""}
    <th class="num">Dona soni</th>
    ${cols.tannarx    ? "<th class='num'>Tannarx</th>" : ""}
    ${cols.ulgurji    ? "<th class='num'>Ulgurji narx</th>" : ""}
    ${(showChakana && cols.chakana) ? "<th class='num'>Chakana narx</th>" : ""}
    ${cols.margin     ? "<th class='num'>Margin</th>" : ""}
    ${cols.qiymati    ? "<th class='num'>Qoldiq qiymati</th>" : ""}
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
         <span style="font-size:10.5px;color:#bbb;margin-left:3px">${r.packUnit}</span>
         <div style="font-size:10px;color:#aaa">×${r.inBox} ${r.unit}</div>`
      : `<span style="font-size:12px;color:#bbb">donab</span>`;

    const sortedSizes = (r.sizes||[]).slice().sort((a,b) => {
      const na = parseFloat(a.size), nb = parseFloat(b.size);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.size.localeCompare(b.size);
    });

    const mColor = r.margin == null ? "#ccc"
      : r.margin >= 30 ? "var(--grn)" : r.margin >= 15 ? "#E07B39" : "var(--red)";

    return `<tr>
      ${cols.image ? `<td onclick="event.stopPropagation()">
        <div style="position:relative;flex-shrink:0" onclick="omImgClick('${r.sku}')" title="Rasm qo'shish/o'zgartirish">
          ${r.image
            ? `<img src="${r.image}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid var(--brd);cursor:pointer">`
            : `<div style="width:36px;height:36px;border:1.5px dashed #e0ddd8;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:14px;cursor:pointer"><i class="ti ti-camera-plus"></i></div>`}
        </div>
        <input type="file" id="om-img-inp-${r.sku}" accept="image/*" style="display:none"
          onchange="omImgSave('${r.sku}',this)">
      </td>` : ""}
      ${cols.sku ? `<td style="font-family:monospace;font-size:11.5px;color:var(--mut)">${r.sku}</td>` : ""}
      ${cols.art ? `<td style="font-family:monospace;font-size:12px;font-weight:700;color:#0D1B2A">${r.art || '<span style="color:#ddd">—</span>'}</td>` : ""}
      <td><div style="font-weight:600;font-size:13px">${r.name}</div></td>
      ${cols.kategoriya ? `<td style="font-size:12px;color:var(--mut)">${r.category}</td>` : ""}
      ${cols.barcode ? `<td style="font-family:monospace;font-size:12px">
        ${r.barcode
          ? `<span style="background:var(--bg);padding:2px 7px;border-radius:5px;border:1px solid var(--brd)">${r.barcode}</span>`
          : `<span style="color:#ccc">—</span>`}
      </td>` : ""}
      <td>
        <div style="font-weight:500;font-size:13px">${r.color}</div>
        ${r.pantone ? `<div style="font-size:10px;color:#aaa">${r.pantone}</div>` : ""}
      </td>
      ${cols.sizes ? `<td>
        ${sortedSizes.length > 0 ? `
          <div style="display:flex;flex-wrap:wrap;gap:3px">
            ${sortedSizes.map(s => {
              const lvl = s.qty <= 0 ? "bg-r" : s.qty <= 3 ? "bg-a" : "";
              return `<span class="bg ${lvl}" style="font-size:10.5px;padding:1px 6px;font-weight:${s.qty<=3?"700":"400"}"
                title="${s.size}: ${s.qty} ${r.unit}">${s.size}<span style="color:${s.qty<=0?"#dc2626":s.qty<=3?"#92400e":"#888"};margin-left:2px;font-size:9.5px">${s.qty}</span></span>`;
            }).join("")}
          </div>` : '<span style="color:#ddd;font-size:12px">—</span>'}
      </td>` : ""}
      ${cols.boxes ? `<td class="num">${boxCell}</td>` : ""}
      <td class="num">${qBadge}</td>
      ${cols.tannarx ? `<td class="num" style="font-size:12.5px">
        ${r.costUzs ? `<div style="font-weight:600">${priceDisplay(r.costUzs)}</div>` : "—"}
        ${r.costUzs && r.inBox > 1 ? `<div style="font-size:11px;color:#856404;margin-top:2px">📦 ${priceDisplay(r.costUzs * r.inBox)}</div>` : ""}
      </td>` : ""}
      ${cols.ulgurji ? `<td class="num" style="font-size:12.5px">
        ${r.ulgurji ? `<div style="font-weight:700;color:var(--acc)">${priceDisplay(r.ulgurji)}</div>` : '<span style="color:#ccc">—</span>'}
        ${r.ulgurji && r.inBox > 1 ? `<div style="font-size:11px;color:#e9a500;margin-top:2px">📦 ${priceDisplay(r.ulgurji * r.inBox)}</div>` : ""}
      </td>` : ""}
      ${(showChakana && cols.chakana) ? `<td class="num" style="color:var(--teal);font-size:12.5px">${r.chakana ? fmt(r.chakana) + " so'm" : "—"}</td>` : ""}
      ${cols.margin ? `<td class="num" style="font-size:12px">
        ${r.margin != null ? `<span style="color:${mColor};font-weight:700">${r.margin}%</span>` : '<span style="color:#ddd">—</span>'}
      </td>` : ""}
      ${cols.qiymati ? `<td class="num" style="font-size:12.5px;color:var(--mut)">${r.qiymati ? fmt(r.qiymati) + " so'm" : "—"}</td>` : ""}
      <td>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditProduct('${r.sku}')"
          title="Katalogda tahrirlash">
          <i class="ti ti-edit"></i>
        </button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="14" class="empty-td">
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
  const vp2 = typeof visProds === "function" ? visProds() : db.products;
  const rows = [];
  vp2.forEach(p => {
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
                <div style="margin-bottom:${v.size?'3px':'0'}">
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

let omKirimFilter = "all"; // "all" | "excel" | "manual"

function omSetKirimFilter(f) {
  omKirimFilter = f;
  document.querySelectorAll("[data-kf]").forEach(b => b.classList.toggle("on", b.dataset.kf === f));
  omRenderKirim();
}

function omRenderKirim() {
  const q    = ($("om-q")||{value:""}).value.toLowerCase();
  let list = db.ombor.filter(o =>
    !q || o.productName.toLowerCase().includes(q) ||
    (o.supplier||"").toLowerCase().includes(q) ||
    (o.color||"").toLowerCase().includes(q)
  );
  // Manba bo'yicha filtr: Excel import partiya="Excel import" deb belgilanadi
  if (omKirimFilter === "excel")  list = list.filter(o => o.partiya === "Excel import");
  if (omKirimFilter === "manual") list = list.filter(o => o.partiya !== "Excel import");

  list = list.slice().reverse();

  const el = $("ombor-body"); if (!el) return;
  el.innerHTML = list.length ? list.map(o => {
    return `<tr>
      <td style="font-size:12px;color:var(--mut)">${o.date}</td>
      <td><div style="font-weight:600;font-size:13px">${o.productName}</div></td>
      <td style="font-family:monospace;font-size:12px;font-weight:700;color:#0D1B2A">${o.art || '<span style="color:#ddd">—</span>'}</td>
      <td><span class="bg bg-t" style="font-size:11px">${o.unit||"dona"}</span></td>
      <td>
        <div>
          ${o.color} <span style="color:#bbb">/</span> ${o.size}
        </div>
        ${o.pantone ? `<div style="font-size:10px;color:#aaa">${o.pantone}</div>` : ""}
        ${o.boxes ? `<div style="font-size:10.5px;color:#856404">📦 ${o.boxes} karobka</div>` : ""}
      </td>
      <td><span class="bg bg-g" style="font-weight:700">+${o.qty}</span></td>
      <td class="num" style="font-size:12.5px">${o.kirimNarxi ? fmt(o.kirimNarxi)+" so'm" : "—"}</td>
      <td class="num" style="font-weight:600;font-size:12.5px">${o.kirimNarxi ? fmt(o.kirimNarxi*o.qty)+" so'm" : "—"}</td>
      <td style="font-size:12.5px">${o.supplier||"—"}</td>
      <td style="font-size:12px;color:var(--mut)">
        ${o.partiya === "Excel import"
          ? `<span class="bg" style="background:#EEE9FF;color:#6B4FBB;font-size:10.5px"><i class="ti ti-file-spreadsheet" style="font-size:11px"></i> Excel</span>`
          : (o.partiya||"—")}
      </td>
      <td><span class="bg ${o.payStatus==="qarz"?"bg-r":"bg-g"}">${o.payStatus==="qarz"?"To'lanmagan":"To'langan"}</span></td>
    </tr>`;
  }).join("") : `<tr><td colspan="12" class="empty-td">Kirim yo'q</td></tr>`;
}

function omRenderSuppliers() {
  const supMap = {};

  // 1) Qo'lda qo'shilgan yetkazuvchilar (hali kirim bo'lmagan bo'lsa ham ko'rinadi)
  (db.suppliers||[]).forEach(s => {
    supMap[s.name] = { name:s.name, phone:s.phone||"", note:s.note||"", id:s.id,
      items:0, value:0, paid:0, debt:0, lastDate:"" };
  });

  // 2) Kirim tarixidan avtomatik hisoblanadigan statistikalar
  db.ombor.forEach(o => {
    const sup = o.supplier || "Noma'lum yetkazuvchi";
    if (!supMap[sup]) supMap[sup] = { name:sup, phone:"", note:"", items:0, value:0, paid:0, debt:0, lastDate:"" };
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
      ${s.phone ? `<div style="font-size:11px;color:var(--mut)"><i class="ti ti-phone" style="font-size:10px"></i> ${s.phone}</div>` : ""}
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
    <td onclick="event.stopPropagation()">
      ${s.id ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="openEditSupplier(${s.id})" title="Tahrirlash">
        <i class="ti ti-edit"></i>
      </button>` : ""}
    </td>
  </tr>`).join("")
  : `<tr><td colspan="6" class="empty-td">Yetkazuvchi yo'q</td></tr>`;
}

// ── Yetkazuvchi qo'shish/tahrirlash ───────────────
let editingSupplierId = null;

function openAddSupplier() {
  editingSupplierId = null;
  if ($("sup-name"))  $("sup-name").value = "";
  if ($("sup-phone")) $("sup-phone").value = "";
  if ($("sup-note"))  $("sup-note").value = "";
  if ($("sup-modal-title")) $("sup-modal-title").textContent = "Yangi yetkazuvchi";
  if ($("sup-delete-btn")) $("sup-delete-btn").style.display = "none";
  openModal("supplier");
  setTimeout(() => { if ($("sup-name")) $("sup-name").focus(); }, 50);
}

function openEditSupplier(id) {
  const s = (db.suppliers||[]).find(x => x.id === id); if (!s) return;
  editingSupplierId = id;
  if ($("sup-name"))  $("sup-name").value  = s.name;
  if ($("sup-phone")) $("sup-phone").value = s.phone || "";
  if ($("sup-note"))  $("sup-note").value  = s.note || "";
  if ($("sup-modal-title")) $("sup-modal-title").textContent = "Yetkazuvchini tahrirlash";
  if ($("sup-delete-btn")) $("sup-delete-btn").style.display = "";
  openModal("supplier");
}

function saveSupplier() {
  const name  = ($("sup-name")||{value:""}).value.trim();
  const phone = ($("sup-phone")||{value:""}).value.trim();
  const note  = ($("sup-note")||{value:""}).value.trim();

  if (!name) { toast("Yetkazuvchi nomini kiriting", "err"); return; }
  if (!db.suppliers) db.suppliers = [];

  if (editingSupplierId) {
    const s = db.suppliers.find(x => x.id === editingSupplierId);
    if (s) { s.name = name; s.phone = phone; s.note = note; }
  } else {
    if (db.suppliers.some(x => x.name.toLowerCase() === name.toLowerCase())) {
      toast("Bu nomdagi yetkazuvchi allaqachon mavjud", "err"); return;
    }
    db.suppliers.push({ id: db.seq++, name, phone, note });
  }

  saveDB();
  closeModal("supplier");
  omRenderSuppliers();
  toast(`"${name}" saqlandi`);
}

function deleteSupplier() {
  if (!editingSupplierId) return;
  const s = db.suppliers.find(x => x.id === editingSupplierId); if (!s) return;
  if (!confirm(`"${s.name}" yetkazuvchisini ro'yxatdan o'chirasizmi?\nKirim tarixi saqlanib qoladi.`)) return;
  db.suppliers = db.suppliers.filter(x => x.id !== editingSupplierId);
  saveDB();
  closeModal("supplier");
  omRenderSuppliers();
  toast("Yetkazuvchi o'chirildi", "info");
}

function omSearch() { renderOmbor(); }

// ── Chiqimlar tarixi (Hisobdan chiqarish tab) ────
const CHIQIM_SABABLAR = [
  { key:"nuqson",   label:"🔧 Nuqsonli",    color:"#E07B39" },
  { key:"ogirlik",  label:"🔓 O'g'irlik",   color:"#E05A5A" },
  { key:"yoqolish", label:"❓ Yo'qolish",   color:"#8B5CF6" },
  { key:"qaytarish",label:"↩️ Qaytarildi",  color:"#4C9BE8" },
  { key:"eskirish", label:"📦 Eskirish",    color:"#888"    },
  { key:"nuqsonli", label:"🔧 Nuqsonli",    color:"#E07B39" },
  { key:"yoqotilgan", label:"❓ Yo'qolgan", color:"#8B5CF6" },
  { key:"muddati",  label:"⏰ Muddati o'tgan", color:"#E05A5A" },
  { key:"boshqa",   label:"📋 Boshqa",      color:"#aaa"    },
];

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
          }).join("") : '<tr><td colspan="9" class="empty-td">Chiqimlar yo\'q</td></tr>'}
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

// ── Ombor jadvalidan rasm yuklash ────────────────
function omImgClick(sku) {
  const inp = document.getElementById("om-img-inp-" + sku);
  if (inp) inp.click();
}

function omImgSave(sku, input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast("Rasm 2MB dan katta", "err"); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      const MAX = 600;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      let q = 0.85, dataUrl;
      do { dataUrl = canvas.toDataURL("image/jpeg", q); q -= 0.08; }
      while (dataUrl.length > 150000 && q > 0.3);

      const p = db.products.find(x => x.sku === sku);
      if (!p) { toast("Mahsulot topilmadi", "err"); return; }
      p.image = dataUrl;
      saveDB();
      renderOmbor();
      toast("✅ Rasm saqlandi");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ════════════════════════════════════════════════
// INVENTARIZATSIYA v2 — sodda, openModal() orqali
// ════════════════════════════════════════════════

function openInvent2() {
  openModal("invent2");
  renderInvent2();
}

function renderInvent2() {
  const q = ($("inv2-q")||{value:""}).value.toLowerCase();
  const rows = [];

  db.products.forEach(p => {
    p.variants.forEach(v => {
      if (q && !p.name.toLowerCase().includes(q) && !v.color.toLowerCase().includes(q)) return;
      rows.push({ sku: p.sku, name: p.name, color: v.color, size: v.size, systemQty: v.qty });
    });
  });

  const el = $("inv2-body"); if (!el) return;
  el.innerHTML = rows.length ? rows.map((r, i) => `
    <tr>
      <td style="padding:7px 10px;font-size:13px;font-weight:600">${r.name}</td>
      <td style="padding:7px 10px;font-size:12.5px;color:var(--mut)">${r.color} / ${r.size}</td>
      <td style="padding:7px 10px;text-align:right;font-size:13px">${r.systemQty}</td>
      <td style="padding:7px 10px;text-align:right">
        <input type="number" min="0" placeholder="${r.systemQty}" data-inv2="${r.sku}::${r.color}::${r.size}"
          oninput="inv2CalcDiff(this)"
          style="width:64px;text-align:right;border:1px solid var(--brd);border-radius:6px;padding:3px 6px;font-size:13px">
      </td>
      <td style="padding:7px 10px;text-align:right;font-size:12.5px;font-weight:700" id="inv2-diff-${i}">—</td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-td">Mahsulot topilmadi</td></tr>`;

  // data-row-idx larni saqlash uchun inputlarga index biriktiramiz
  el.querySelectorAll("[data-inv2]").forEach((inp, i) => inp.dataset.rowIdx = i);
}

function inv2CalcDiff(input) {
  const idx = input.dataset.rowIdx;
  const sysQty = parseInt(input.placeholder) || 0;
  const actualQty = input.value === "" ? null : parseInt(input.value) || 0;
  const diffEl = $("inv2-diff-" + idx);
  if (!diffEl) return;
  if (actualQty === null) { diffEl.textContent = "—"; diffEl.style.color = ""; return; }
  const diff = actualQty - sysQty;
  diffEl.textContent = diff === 0 ? "0" : (diff > 0 ? "+" + diff : diff);
  diffEl.style.color = diff === 0 ? "var(--grn)" : diff > 0 ? "var(--teal)" : "var(--red)";
}

function saveInvent2() {
  const inputs = document.querySelectorAll("[data-inv2]");
  let changed = 0;

  inputs.forEach(inp => {
    if (inp.value === "") return;
    const [sku, color, size] = inp.dataset.inv2.split("::");
    const actualQty = parseInt(inp.value) || 0;
    const p = db.products.find(x => x.sku === sku);
    if (!p) return;
    const v = p.variants.find(x => x.color === color && x.size === size);
    if (!v) return;
    if (v.qty !== actualQty) {
      v.qty = actualQty;
      changed++;
    }
  });

  if (changed === 0) { toast("O'zgarish yo'q", "info"); return; }

  saveDB();
  closeModal("invent2");
  renderOmbor();
  if (typeof renderKatalog === "function") renderKatalog();
  toast(`✅ ${changed} ta mahsulot qoldig'i yangilandi`);
}

// ════════════════════════════════════════════════
// HISOBDAN CHIQARISH v2 — sodda, openModal() orqali
// ════════════════════════════════════════════════

let ch2SelectedProduct = null;

function openChiqim2() {
  ch2SelectedProduct = null;
  if ($("ch2-name")) $("ch2-name").value = "";
  if ($("ch2-note")) $("ch2-note").value = "";
  if ($("ch2-qty"))  $("ch2-qty").value = "1";
  if ($("ch2-color-section")) $("ch2-color-section").style.display = "none";
  openModal("chiqim2");
  setTimeout(() => { if ($("ch2-name")) $("ch2-name").focus(); }, 50);
}

function ch2Autofill(val) {
  $("ch2-list").innerHTML = db.products
    .filter(p => p.name.toLowerCase().includes(val.toLowerCase()))
    .slice(0, 30)
    .map(p => `<option value="${p.name}">`).join("");

  const p = db.products.find(x => x.name.toLowerCase() === val.toLowerCase().trim());
  const section = $("ch2-color-section");

  if (!p) {
    ch2SelectedProduct = null;
    if (section) section.style.display = "none";
    return;
  }

  ch2SelectedProduct = p;
  const colors = [...new Set(p.variants.map(v => v.color))];
  if ($("ch2-color")) {
    $("ch2-color").innerHTML = colors.map(c => `<option value="${c}">${c}</option>`).join("");
  }
  if (section) section.style.display = "block";
  ch2UpdateSizes();
}

function ch2UpdateSizes() {
  const p = ch2SelectedProduct; if (!p) return;
  const color = ($("ch2-color")||{value:""}).value;
  const variants = p.variants.filter(v => v.color === color);
  if ($("ch2-size")) {
    $("ch2-size").innerHTML = variants.map(v =>
      `<option value="${v.size}" ${v.qty<=0?"disabled":""}>${v.size} — ${v.qty} ${p.unit||"dona"}${v.qty<=0?" (tugagan)":""}</option>`
    ).join("");
  }
}

function confirmChiqim2() {
  const p = ch2SelectedProduct;
  if (!p) { toast("Mahsulot tanlang", "err"); return; }

  const color = ($("ch2-color")||{value:""}).value;
  const size  = ($("ch2-size")||{value:""}).value;
  const qty   = parseInt(($("ch2-qty")||{value:0}).value) || 0;
  const reason = ($("ch2-reason")||{value:"boshqa"}).value;
  const note  = ($("ch2-note")||{value:""}).value.trim();

  if (!color || !size) { toast("Rang va o'lchamni tanlang", "err"); return; }
  if (qty <= 0) { toast("Miqdor kiriting", "err"); return; }

  const v = p.variants.find(x => x.color === color && x.size === size);
  if (!v) { toast("Variant topilmadi", "err"); return; }
  if (v.qty < qty) { toast(`Faqat ${v.qty} ta mavjud`, "err"); return; }

  const rate = db.settings?.rate || 12800;
  const costUzs = Math.round((p.costUsd || 0) * rate);

  v.qty -= qty;

  if (!db.chiqimlar) db.chiqimlar = [];
  db.chiqimlar.push({
    id: db.seq++, date: today(), time: typeof nowTime === "function" ? nowTime() : "",
    productName: p.name, sku: p.sku,
    color, size, qty, unit: p.unit || "dona",
    reason, note: note || "",
    costUzs: costUzs * qty, costUsdEach: p.costUsd || 0
  });

  saveDB();
  closeModal("chiqim2");
  renderOmbor();
  if (typeof renderKatalog === "function") renderKatalog();

  const sababLabel = CHIQIM_SABABLAR.find(s => s.key === reason)?.label || reason;
  toast(`✅ ${p.name} (${color}/${size}) — ${qty} ta hisobdan chiqarildi (${sababLabel})`);
}
