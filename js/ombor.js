// MERX ombor.js | v2.2 | 2026-06-06 06:00
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
  if (omActiveTab === "qoldiq")   omRenderQoldiq();
  else if (omActiveTab === "kirim") omRenderKirim();
  else if (omActiveTab === "sup")   omRenderSuppliers();
}

function omSetTab(tab) {
  omActiveTab = tab;
  document.querySelectorAll(".om-tab").forEach(b =>
    b.classList.toggle("on", b.dataset.tab === tab));
  $("om-tab-qoldiq").style.display = tab === "qoldiq" ? "" : "none";
  $("om-tab-kirim").style.display  = tab === "kirim"  ? "" : "none";
  $("om-tab-sup").style.display    = tab === "sup"    ? "" : "none";
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

function omRenderQoldiq() {
  const rate = db.settings.rate || 1;
  const q    = ($("om-q")||{value:""}).value.toLowerCase();
  const showChakana = db.settings.showChakana || false;

  let rows = [];
  db.products.forEach(p => {
    // Rang bo'yicha guruhlash
    const colorGroups = {};
    p.variants.forEach(v => {
      if (!colorGroups[v.color]) {
        colorGroups[v.color] = {
          color:   v.color,
          hex:     v.hex    || "#888",
          pantone: v.pantone || "",
          qty:     0
        };
      }
      colorGroups[v.color].qty += v.qty;
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
        <div style="display:flex;align-items:center;gap:7px">
          <div style="width:18px;height:18px;border-radius:5px;flex-shrink:0;
            background:${r.hex};border:1px solid rgba(0,0,0,.12)"
            title="${r.pantone}"></div>
          <div>
            <div style="font-weight:500;font-size:13px">${r.color}</div>
            ${r.pantone ? `<div style="font-size:10px;color:#aaa">${r.pantone}</div>` : ""}
          </div>
        </div>
      </td>
      <td class="num">${boxCell}</td>
      <td class="num">${qBadge}</td>
      <td class="num" style="font-size:12.5px">
        ${r.costUzs ? `<div style="font-weight:600">${fmt(r.costUzs)} so'm</div>` : "—"}
        ${r.costUzs && r.inBox > 1 ? `<div style="font-size:11px;color:#856404;margin-top:2px">📦 ${fmt(r.costUzs * r.inBox)} so'm</div>` : ""}
      </td>
      <td class="num" style="font-size:12.5px">
        ${r.ulgurji ? `<div style="font-weight:700;color:var(--acc)">${fmt(r.ulgurji)} so'm</div>` : '<span style="color:#ccc">—</span>'}
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
  if ($("qb-ulgurji")) $("qb-ulgurji").placeholder = fmt(p.ulgurjiNarx||0) + " (joriy)";

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

  const kirimN    = getRawVal("qb-cost");
  const newChk    = parseFloat(($("qb-price")||{value:0}).value)   || 0;
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
    p.unit = unit;
  } else {
    db.products.push({
      sku:`RECV-${String(db.seq++).padStart(3,"0")}`,
      name, category:"Qabul qilingan", type:"oyoq",
      unit, inBox: inBoxEd > 1 ? inBoxEd : 1,
      costUsd: kirimN / (db.settings.rate||1),
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
  const bom = "\uFEFF";
  const csv = bom + rows.map(r =>
    r.map(cell => {
      const s = String(cell == null ? "" : cell);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")
  ).join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Karobka narx hintlari ─────────────────────
function qbUpdateBoxHints() {
  const inBox = parseInt(($("qb-inbox-edit")||{value:0}).value) || 0;

  function showHint(hintId, donaVal) {
    const el = $(hintId); if (!el) return;
    if (!donaVal || donaVal <= 0 || inBox < 2) { el.style.display = "none"; return; }
    const total = donaVal * inBox;
    const span  = el.querySelector("span");
    if (span) span.textContent = `1 karobka = ${fmt(total)} so'm (${inBox} × ${fmt(donaVal)})`;
    el.style.display = "inline-flex";
  }

  const cost = getRawVal("qb-cost");
  const ulg  = getRawVal("qb-ulgurji");
  showHint("qb-cost-hint", cost);
  showHint("qb-ulg-hint",  ulg);
}
