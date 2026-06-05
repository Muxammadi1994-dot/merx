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
  const cols = omGetCols();
  const rate = db.settings.rate || 1;
  const q    = ($("om-q")||{value:""}).value.toLowerCase();

  let rows = [];
  db.products.forEach(p => {
    p.variants.forEach(v => {
      rows.push({
        sku:     p.sku, name:p.name, category:p.category,
        color:   v.color, size:v.size, qty:v.qty,
        hex:     v.hex || "#888",
        pantone: v.pantone || "",
        costUzs: Math.round((p.costUsd||0) * rate),
        chakana: p.priceUzs, ulgurji: p.ulgurjiNarx || 0,
        qiymati: Math.round(v.qty * (p.costUsd||0) * rate),
        barcode: p.barcode || "", inBox: p.inBox || 1, unit: p.unit || "dona"
      });
    });
  });

  if (omStockFilter === "low") rows = rows.filter(r => r.qty > 0 && r.qty <= 5);
  if (omStockFilter === "out") rows = rows.filter(r => r.qty <= 0);
  if (q) rows = rows.filter(r =>
    r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) ||
    r.color.toLowerCase().includes(q) || r.pantone.toLowerCase().includes(q) ||
    r.barcode.toLowerCase().includes(q)
  );

  const thead = `<tr>
    <th>Mahsulot</th>
    ${cols.sku        ? "<th>SKU</th>"              : ""}
    ${cols.kategoriya ? "<th>Kategoriya</th>"        : ""}
    <th>Rang / O'lcham</th>
    <th class="num">Qoldiq</th>
    ${cols.tannarx    ? "<th class='num'>Tannarx</th>"        : ""}
    ${cols.chakana    ? "<th class='num'>Chakana</th>"        : ""}
    ${cols.ulgurji    ? "<th class='num'>Ulgurji</th>"        : ""}
    ${cols.qiymati    ? "<th class='num'>Qoldiq qiymati</th>" : ""}
    ${cols.barcode    ? "<th>Barcode</th>"           : ""}
  </tr>`;

  const tbody = rows.length ? rows.map(r => {
    const qBadge = r.qty <= 0
      ? `<span class="bg bg-r">Tugagan</span>`
      : r.qty <= 3
        ? `<span class="bg bg-a" style="font-weight:700">${r.qty} ${r.unit}</span>`
        : r.qty <= 5
          ? `<span class="bg" style="background:#FFF8E7;color:#856404;font-weight:600">${r.qty} ${r.unit}</span>`
          : `<span class="bg bg-g">${r.qty} ${r.unit}</span>`;
    const margin = r.chakana > 0 && r.costUzs > 0
      ? Math.round((r.chakana - r.costUzs) / r.chakana * 100) : null;

    return `<tr>
      <td>
        <div style="font-weight:600;font-size:13px">${r.name}</div>
        ${r.inBox > 1 ? `<div style="font-size:10.5px;color:#bbb">📦 ${r.inBox} ${r.unit}/karobka</div>` : ""}
      </td>
      ${cols.sku        ? `<td style="font-family:monospace;font-size:11.5px;color:var(--mut)">${r.sku}</td>` : ""}
      ${cols.kategoriya ? `<td><span class="bg bg-t" style="font-size:11px">${r.category}</span></td>` : ""}
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <div style="width:16px;height:16px;border-radius:4px;flex-shrink:0;
            background:${r.hex};border:1px solid rgba(0,0,0,.12)"
            title="${r.pantone}"></div>
          <span style="font-weight:500">${r.color}</span>
          <span style="color:#bbb">/</span>
          <span>${r.size}</span>
        </div>
        ${r.pantone ? `<div style="font-size:10px;color:#aaa;padding-left:23px">${r.pantone}</div>` : ""}
      </td>
      <td class="num">${qBadge}</td>
      ${cols.tannarx ? `<td class="num" style="font-size:12.5px">${r.costUzs ? fmt(r.costUzs)+" so'm" : "—"}</td>` : ""}
      ${cols.chakana ? `<td class="num" style="color:var(--teal);font-size:12.5px">
        ${fmt(r.chakana)} so'm
        ${margin != null ? `<div style="font-size:10px;color:${margin>=30?"var(--grn)":margin>=15?"#E07B39":"var(--red)"}">${margin}%</div>` : ""}
      </td>` : ""}
      ${cols.ulgurji    ? `<td class="num" style="color:var(--acc);font-size:12.5px">${r.ulgurji ? fmt(r.ulgurji)+" so'm" : "—"}</td>` : ""}
      ${cols.qiymati    ? `<td class="num" style="font-size:12.5px">${r.qiymati ? fmt(r.qiymati)+" so'm" : "—"}</td>` : ""}
      ${cols.barcode    ? `<td style="font-family:monospace;font-size:12px">${r.barcode || "<span style='color:#ccc'>—</span>"}</td>` : ""}
    </tr>`;
  }).join("") : `<tr><td colspan="15" class="empty-td">
    ${omStockFilter !== "all" ? "Bu filtrda mahsulot yo'q" : q ? `"${q}" topilmadi` : "Mahsulot yo'q"}
  </td></tr>`;

  const el = $("om-qoldiq-table"); if (!el) return;
  el.querySelector("thead").innerHTML = thead;
  el.querySelector("tbody").innerHTML = tbody;

  const totalVal   = rows.reduce((a,r) => a + r.qiymati, 0);
  const totalUnits = rows.reduce((a,r) => a + r.qty, 0);
  const foot = $("om-qoldiq-foot");
  if (foot) foot.innerHTML = rows.length
    ? `<div style="display:flex;gap:20px;font-size:13px;padding:10px 16px;color:var(--mut)">
        <span>Jami: <strong style="color:#0D1B2A">${rows.length} ta variant</strong></span>
        <span><strong>${totalUnits}</strong> dona qoldiq</span>
        ${cols.qiymati ? `<span>Qiymati: <strong style="color:var(--acc)">${fmt(totalVal)} so'm</strong></span>` : ""}
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
      <td class="num" style="color:var(--teal);font-size:12.5px">${o.chakana ? fmt(o.chakana)+" so'm" : "—"}</td>
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

  // Karobka panel
  const inBox = p.inBox || 1;
  const boxPanel    = $("qb-box-panel");
  const normalPanel = $("qb-normal-panel");
  if (boxPanel)    boxPanel.style.display    = inBox > 1 ? "block" : "none";
  if (normalPanel) normalPanel.style.display = inBox > 1 ? "none"  : "block";
  if (inBox > 1) {
    if ($("qb-inbox-edit")) $("qb-inbox-edit").value = inBox;
    qbCalcBoxes();
  }

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

  const kirimN  = parseFloat(($("qb-cost")||{value:0}).value)    || 0;
  const newChk  = parseFloat(($("qb-price")||{value:0}).value)   || 0;
  const newUlg  = parseFloat(($("qb-ulgurji")||{value:0}).value) || 0;
  const unit    = ($("qb-unit")||{value:"dona"}).value;

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
    p.unit = unit;
  } else {
    db.products.push({
      sku:`RECV-${String(db.seq++).padStart(3,"0")}`,
      name, category:"Qabul qilingan", type:"oyoq", unit, inBox:1,
      costUsd: kirimN / (db.settings.rate||1),
      priceUzs:newChk||0, ulgurjiNarx:newUlg||0,
      barcode: genEAN13(db.seq),
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

  ["qb-name","qb-size","qb-sup","qb-partiya"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("qb-qty"))  $("qb-qty").value  = "10";
  if ($("qb-cost")) $("qb-cost").value = "";
  if ($("qb-info")) $("qb-info").textContent = "";
  if ($("qb-box-panel")) $("qb-box-panel").style.display = "none";
  if (typeof ppReset === "function") ppReset("qb");

  toast(`✅ ${name} (${color}/${size}) — ${qty} ${unit} qabul qilindi`);
}
