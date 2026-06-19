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
let qbSelectedProduct = null;

function qbAutofill(val) {
  $("qb-list").innerHTML = db.products
    .filter(p => p.name.toLowerCase().includes(val.toLowerCase()))
    .slice(0, 30)
    .map(p => `<option value="${p.name}">`).join("");

  const p = db.products.find(x => x.name.toLowerCase() === val.toLowerCase().trim());
  const infoBox  = $("qb-info-box");
  const cardsBox = $("qb-color-cards");

  if (!p) {
    qbSelectedProduct = null;
    if (infoBox)  infoBox.style.display  = "none";
    if (cardsBox) cardsBox.style.display = "none";
    qbCloseNewColor();
    return;
  }

  qbSelectedProduct = p;
  const totalQty = p.variants.reduce((a,v) => a + v.qty, 0);

  if (infoBox) {
    infoBox.style.display = "block";
    infoBox.innerHTML = `
      <strong style="color:#0D1B2A">${p.name}</strong> ${p.art ? `· ART: ${p.art}` : ""}
      <br>Joriy qoldiq: <strong>${totalQty} ${p.unit||"dona"}</strong>
      · Ulgurji narx: <strong style="color:var(--acc)">${fmt(p.ulgurjiNarx||0)} so'm</strong>`;
  }

  qbRenderColorCards(p);
  if (cardsBox) cardsBox.style.display = "block";
  qbCloseNewColor();
}

// ── Rang kartalar — har biriga to'g'ridan-to'g'ri miqdor qo'shish ──
function qbRenderColorCards(p) {
  const colors = [...new Set(p.variants.map(v => v.color))];
  const el = $("qb-colors-list");
  el.innerHTML = colors.map(color => {
    const variants = p.variants.filter(v => v.color === color);
    const totalQty = variants.reduce((a,v) => a + v.qty, 0);
    const pantone  = variants[0]?.pantone || "";
    return `<div style="border:1.5px solid var(--brd);border-radius:10px;padding:10px 14px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-weight:700;font-size:13.5px">${color}</span>
        ${pantone ? `<span style="font-size:11px;color:#bbb">${pantone}</span>` : ""}
        <span style="font-size:12px;color:var(--mut);margin-left:auto">${totalQty} dona</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px">
        ${variants.map(v => `
          <div style="display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--brd);border-radius:7px;padding:5px 8px">
            <span style="font-size:11.5px;color:var(--mut);min-width:24px">${v.size}</span>
            <span style="font-size:11px;color:#bbb">qoldiq ${v.qty}</span>
            <span style="font-size:13px;color:#bbb;margin-left:auto">+</span>
            <input type="number" min="0" placeholder="0" data-qbqty="${color}::${v.size}"
              style="width:48px;border:none;background:transparent;font-size:13px;font-weight:700;text-align:right;padding:2px;color:var(--acc)">
          </div>`).join("")}
      </div>
    </div>`;
  }).join("") + `
    <button class="btn btn-acc" style="width:100%;margin-top:6px" onclick="qbSaveColorQty()">
      <i class="ti ti-check"></i> Kirim qilish
    </button>`;
}

function qbSaveColorQty() {
  const p = qbSelectedProduct; if (!p) return;
  const inputs = document.querySelectorAll("[data-qbqty]");
  let totalAdded = 0;
  const addedList = [];

  inputs.forEach(inp => {
    const val = parseInt(inp.value) || 0;
    if (val <= 0) return;
    const [color, size] = inp.dataset.qbqty.split("::");
    const v = p.variants.find(x => x.color === color && x.size === size);
    if (v) {
      v.qty += val;
      totalAdded += val;
      addedList.push(`${color}/${size} +${val}`);
    }
  });

  if (totalAdded === 0) { toast("Miqdor kiriting", "err"); return; }

  // Ombor kirim tarixiga yozamiz (bitta yozuv, jamlangan)
  db.ombor.push({
    id: db.seq++, date: today(), sku: p.sku,
    productName: p.name, art: p.art || "", unit: p.unit || "dona",
    color: addedList.length === 1 ? addedList[0].split(" ")[0].split("/")[0] : "Aralash",
    size: addedList.length === 1 ? addedList[0].split(" ")[0].split("/")[1] : "—",
    qty: totalAdded,
    kirimNarxi: Math.round((p.costUsd||0) * (db.settings?.rate||12800)),
    chakana: p.priceUzs || 0,
    ulgurji: p.ulgurjiNarx || 0,
    supplier:  ($("qb-sup")||{value:""}).value,
    partiya:   ($("qb-partiya")||{value:""}).value,
    payStatus: ($("qb-pay")||{value:"tolangan"}).value
  });

  saveDB(); closeModal("qabul"); renderOmbor();
  if (typeof renderKatalog === "function") renderKatalog();

  toast(`✅ ${p.name} — ${totalAdded} ${p.unit||"dona"} kirim qilindi`);
  qbResetModal();
}

function qbResetModal() {
  qbSelectedProduct = null;
  if ($("qb-name"))     $("qb-name").value = "";
  if ($("qb-sup"))      $("qb-sup").value = "";
  if ($("qb-partiya"))  $("qb-partiya").value = "";
  if ($("qb-info-box")) $("qb-info-box").style.display = "none";
  if ($("qb-color-cards")) $("qb-color-cards").style.display = "none";
  qbCloseNewColor();
}

// ── Yangi rang qo'shish (mavjud tovarga) ──────────
let qbnSizeEditing = false;

function qbOpenNewColor() {
  const p = qbSelectedProduct; if (!p) return;
  $("qbn-color").value = "";
  $("qbn-pantone").value = "";
  $("qbn-boxes").value = "1";
  $("qbn-inbox").value = p.inBox || 6;
  const t = p.type || "oyoq";
  $("qbn-size-from").innerHTML = (SIZES[t]||[]).map(s => `<option>${s}</option>`).join("");
  $("qbn-size-to").innerHTML   = (SIZES[t]||[]).map(s => `<option>${s}</option>`).join("");
  qbnResetSizeToStandard();
  $("qb-newcolor-panel").style.display = "block";
}

function qbCloseNewColor() {
  const panel = $("qb-newcolor-panel");
  if (panel) panel.style.display = "none";
}

function qbnToggleSizeEdit() {
  qbnSizeEditing = !qbnSizeEditing;
  const p = qbSelectedProduct;
  const t = p?.type || "oyoq";
  const fromEl = $("qbn-size-from"), toEl = $("qbn-size-to");
  if (fromEl) fromEl.disabled = !qbnSizeEditing;
  if (toEl)   toEl.disabled   = !qbnSizeEditing;
  const btn = $("qbn-size-edit-btn");
  if (qbnSizeEditing) {
    if (btn) btn.innerHTML = `<i class="ti ti-lock"></i> Standartga qaytarish`;
  } else {
    if (btn) btn.innerHTML = `<i class="ti ti-edit"></i> O'zgartirish`;
    const def = SIZES_DEFAULT_RANGE[t] || { from:(SIZES[t]||[])[0], to:(SIZES[t]||[])[0] };
    if (fromEl) fromEl.value = def.from;
    if (toEl)   toEl.value   = def.to;
  }
  qbnCalc();
}

function qbnResetSizeToStandard() {
  qbnSizeEditing = false;
  const p = qbSelectedProduct;
  const t = p?.type || "oyoq";
  const fromEl = $("qbn-size-from"), toEl = $("qbn-size-to");
  if (fromEl) fromEl.disabled = true;
  if (toEl)   toEl.disabled   = true;
  const btn = $("qbn-size-edit-btn");
  if (btn) btn.innerHTML = `<i class="ti ti-edit"></i> O'zgartirish`;
  const def = SIZES_DEFAULT_RANGE[t] || { from:(SIZES[t]||[])[0], to:(SIZES[t]||[])[0] };
  if (fromEl) fromEl.value = def.from;
  if (toEl)   toEl.value   = def.to;
  qbnCalc();
}

function qbnCalc() {
  const from = ($("qbn-size-from")||{value:""}).value;
  const to   = ($("qbn-size-to")||{value:""}).value;
  const boxes  = parseInt(($("qbn-boxes")||{value:1}).value)  || 1;
  const inBoxC = parseInt(($("qbn-inbox")||{value:1}).value)  || 1;
  if ($("qbn-qty")) $("qbn-qty").value = boxes * inBoxC;
  const lbl = $("qbn-size-lbl");
  if (lbl) lbl.textContent = from && to ? (from===to?from:`${from}–${to}`) : "";
}

function qbConfirmNewColor() {
  const p = qbSelectedProduct; if (!p) return;
  const color = ($("qbn-color")||{value:""}).value.trim();
  if (!color) { toast("Rang nomini kiriting","err"); return; }
  if (p.variants.some(v => v.color.toLowerCase() === color.toLowerCase())) {
    toast("Bu rang allaqachon mavjud — quyidagi ro'yxatdan miqdor qo'shing","err"); return;
  }
  const pantone = ($("qbn-pantone")||{value:""}).value.trim();
  const from    = ($("qbn-size-from")||{value:""}).value;
  const to      = ($("qbn-size-to")||{value:""}).value;
  if (!from || !to) { toast("O'lchamni tanlang","err"); return; }

  const totalQty = parseInt(($("qbn-qty")||{value:0}).value) || 0;
  if (totalQty <= 0) { toast("To'plam soni va miqdorni kiriting","err"); return; }

  const allSizes = SIZES[p.type] || [];
  const iFrom = allSizes.indexOf(from), iTo = allSizes.indexOf(to);
  let sizeRange;
  if (from === to) sizeRange = [from];
  else if (iFrom !== -1 && iTo !== -1 && iFrom <= iTo) sizeRange = allSizes.slice(iFrom, iTo+1);
  else sizeRange = [from, to];

  const perSize = Math.floor(totalQty / sizeRange.length);
  let remainder = totalQty - perSize * sizeRange.length;
  sizeRange.forEach(sz => {
    const q = perSize + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    p.variants.push({ color, size: sz, qty: q, pantone, hex: "#888888" });
  });

  // Kirim tarixiga yozamiz
  db.ombor.push({
    id: db.seq++, date: today(), sku: p.sku,
    productName: p.name, art: p.art || "", unit: p.unit || "dona",
    color, size: sizeRange.length===1 ? sizeRange[0] : `${from}–${to}`, qty: totalQty,
    pantone, boxes: parseInt(($("qbn-boxes")||{value:1}).value) || 1,
    kirimNarxi: Math.round((p.costUsd||0) * (db.settings?.rate||12800)),
    chakana: p.priceUzs || 0, ulgurji: p.ulgurjiNarx || 0,
    supplier:  ($("qb-sup")||{value:""}).value,
    partiya:   ($("qb-partiya")||{value:""}).value,
    payStatus: ($("qb-pay")||{value:"tolangan"}).value
  });

  saveDB();
  qbRenderColorCards(p);
  qbCloseNewColor();
  toast(`"${color}" qo'shildi — ${totalQty} dona`);
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
  const rows = [["Mahsulot nomi","SKU","ART","Barcode","Rang","Pantone","Karobka soni","Dona soni","Tannarx (so'm)","Ulgurji narx (so'm)","Margin (%)"]];
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
      rows.push([p.name, p.sku, p.art||"", p.barcode||"", color, info.pantone,
        boxes, info.qty, costUzs, p.ulgurjiNarx||0, margin]);
    });
  });
  return rows;
}

function exportOmborKirim() {
  const rows = [["Sana","Mahsulot","SKU","ART","Rang","Pantone","O'lcham","Miqdor","Karobka soni","Tannarx","Jami","Yetkazuvchi","Partiya","To'lov holati"]];
  db.ombor.slice().reverse().forEach(o => {
    rows.push([o.date, o.productName, o.sku||"", o.art||"", o.color||"", o.pantone||"",
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

  // Boshqa ochiq modallarni yopamiz
  document.querySelectorAll(".ov.on").forEach(ov => ov.classList.remove("on"));

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
      <div>
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

// ── Rasm yuklash (qabul modal) ───────────────────
function qbImgLoad(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast("Rasm 2MB dan katta", "err"); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    if ($("qb-img-data")) $("qb-img-data").value = data;
    const prev = $("qb-img-preview");
    if (prev) prev.innerHTML = `<img src="${data}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
    if ($("qb-img-remove")) $("qb-img-remove").style.display = "inline-flex";
  };
  reader.readAsDataURL(file);
}

function qbImgRemove() {
  if ($("qb-img-data")) $("qb-img-data").value = "";
  if ($("qb-img-remove")) $("qb-img-remove").style.display = "none";
  const prev = $("qb-img-preview");
  if (prev) prev.innerHTML = '<i class="ti ti-photo" id="qb-img-icon"></i>';
  if ($("qb-img-inp")) $("qb-img-inp").value = "";
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
