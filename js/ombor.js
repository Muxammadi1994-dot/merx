// MERX ombor.js | v2.3 | 2026-06-06
// ================================================
// MERX — js/ombor.js
// Ombor = kirim tarixi + haqiqiy qoldiq hisob
// ================================================
// O'ZGARISHLAR (v2.3):
//   - omRenderKpis() → getStock() ishlatadi (variants[].qty emas)
//   - omRenderQoldiq() → getStockGroupedByColor() ishlatadi
//   - Tovar qabul → faqat ombor kirim yozuvi (narx katalogdan)
//   - qb-name → katalog dropdown bilan almashtirildi
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

// ── KPI — getStock() asosida ──────────────────────
function omRenderKpis() {
  const rate = db.settings.rate || 1;
  const t    = today(), m = t.slice(0,7);

  // Bugungi kirim (ombor yozuvlaridan)
  const todayIn = (db.ombor || [])
    .filter(o => o.date === t)
    .reduce((a, o) => a + (o.qty || 0), 0);

  // Bu oy kirim tannarxi
  const monthVal = (db.ombor || [])
    .filter(o => (o.date || "").startsWith(m))
    .reduce((a, o) => a + (o.kirimNarxi || 0) * (o.qty || 0), 0);

  // Yetkazuvchi qarzi
  const supDebt = (db.ombor || [])
    .filter(o => o.payStatus === "qarz")
    .reduce((a, o) => a + (o.kirimNarxi || 0) * (o.qty || 0), 0);

  // Jami qoldiq va qiymat — getStock() asosida
  let totalUnits = 0, totalVal = 0;
  db.products.forEach(p => {
    const stock = totalStock(p); // totalStock → getStock() ga yo'naltiradi
    totalUnits += stock;
    const costUzs = (p.costUsd || 0) * rate;
    totalVal += stock * costUzs;
  });

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

// ── Joriy qoldiq — getStockGroupedByColor() asosida ─
function omRenderQoldiq() {
  const rate = db.settings.rate || 1;
  const q    = ($("om-q")||{value:""}).value.toLowerCase();
  const showChakana = db.settings.showChakana || false;

  let rows = [];
  db.products.forEach(p => {
    // Rang bo'yicha qoldiqlarni getStock() orqali olamiz
    const colorGroups = getStockGroupedByColor(p.name);

    Object.entries(colorGroups).forEach(([color, info]) => {
      const qty     = info.qty || 0;
      const inBox   = p.inBox || 1;
      const boxes   = inBox > 1 ? qty / inBox : null;
      const costUzs = Math.round((p.costUsd || 0) * rate);

      rows.push({
        sku:     p.sku,
        name:    p.name,
        color,
        hex:     info.hex    || "#888",
        pantone: info.pantone || "",
        qty,
        inBox,
        boxes,
        unit:    p.unit || "dona",
        costUzs,
        chakana: p.priceUzs    || 0,
        ulgurji: p.ulgurjiNarx || 0,
        qiymati: Math.round(qty * costUzs)
      });
    });
  });

  // Filtr
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
          <div>
            <div style="font-weight:600;font-size:13px">${r.name}</div>
            <div style="font-size:11px;color:#bbb">${p?.category || ""} · ${r.unit}</div>
          </div>
        </div>
      </td>
      <td style="font-family:monospace;font-size:11px;color:var(--mut)">${r.sku}</td>
      <td style="font-family:monospace;font-size:11.5px;color:#aaa">${barcode || "—"}</td>
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <div style="width:16px;height:16px;border-radius:4px;flex-shrink:0;background:${r.hex};border:1px solid rgba(0,0,0,.1)"></div>
          <div>
            <div style="font-size:13px;font-weight:500">${r.color}</div>
            ${r.pantone ? `<div style="font-size:10.5px;color:#bbb">${r.pantone}</div>` : ""}
          </div>
        </div>
      </td>
      <td class="num">${boxCell}</td>
      <td class="num">${qBadge}</td>
      <td class="num" style="font-size:12.5px">
        ${r.costUzs
          ? `<div style="font-weight:600">${fmt(r.costUzs)} so'm</div>
             ${r.inBox > 1 ? `<div style="font-size:10.5px;color:#856404">📦 ${fmt(r.costUzs * r.inBox)} so'm</div>` : ""}`
          : `<span style="color:#ccc">—</span>`}
      </td>
      <td class="num" style="font-size:12.5px">
        ${r.ulgurji
          ? `<div style="font-weight:700;color:var(--acc)">${fmt(r.ulgurji)} so'm</div>
             ${margin != null ? `<div style="font-size:10px;color:${margin>=30?"var(--grn)":margin>=15?"#E07B39":"var(--red)"}">margin ${margin}%</div>` : ""}`
          : `<span style="color:#ccc">—</span>`}
      </td>
      ${showChakana ? `<td class="num" style="color:var(--teal);font-size:12.5px">${r.chakana ? fmt(r.chakana)+" so'm" : "—"}</td>` : ""}
      <td>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditProduct('${r.sku}')" title="Tahrirlash">
          <i class="ti ti-edit"></i>
        </button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="${showChakana?10:9}" class="empty-td">
    ${omStockFilter==="low" ? "Kam qoldiqli tovar yo'q 🎉" : q ? `"${q}" topilmadi` : "Ombor bo'sh"}
  </td></tr>`;

  const table = $("om-table");
  if (table) {
    const th = table.querySelector("thead");
    const tb = table.querySelector("tbody");
    if (th) th.innerHTML = thead;
    if (tb) tb.innerHTML = tbody;
  }
}

// ── Kirim tarixi ──────────────────────────────────
function omRenderKirim() {
  const q = ($("om-kirim-q")||{value:""}).value.toLowerCase();
  const filterVal = ($("om-kirim-filter")||{value:"all"}).value;
  const rate = db.settings.rate || 1;

  let list = [...(db.ombor || [])].sort((a, b) =>
    (b.date || "") > (a.date || "") ? 1 : -1
  );

  if (filterVal !== "all") list = list.filter(o => o.payStatus === filterVal);
  if (q) list = list.filter(o =>
    (o.productName || "").toLowerCase().includes(q) ||
    (o.supplier    || "").toLowerCase().includes(q) ||
    (o.color       || "").toLowerCase().includes(q) ||
    (o.sku         || "").toLowerCase().includes(q)
  );

  const tbody = $("om-kirim-body"); if (!tbody) return;
  tbody.innerHTML = list.length ? list.map(o => {
    const jami = (o.kirimNarxi || 0) * (o.qty || 0);
    const p = db.products.find(x => x.name === o.productName || x.sku === o.sku);
    return `<tr>
      <td style="font-size:12.5px;white-space:nowrap;font-weight:600">${o.date || "—"}</td>
      <td>
        <div style="font-weight:600;font-size:13px">${o.productName || "—"}</div>
        <div style="font-size:11px;color:#aaa">${o.sku || ""}</div>
      </td>
      <td style="font-size:12.5px">${o.unit || "—"}</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:12px;height:12px;border-radius:3px;background:${o.hex||"#888"};border:1px solid rgba(0,0,0,.1)"></div>
          <span style="font-size:12.5px">${o.color || "—"}</span>
          ${o.size ? `<span style="font-size:11px;color:#aaa">/ ${o.size}</span>` : ""}
        </div>
      </td>
      <td class="num" style="font-weight:700;font-size:13px">
        ${o.qty || 0}
        ${o.boxes ? `<div style="font-size:10.5px;color:#856404">${o.boxes} karobka</div>` : ""}
      </td>
      <td class="num" style="font-size:12.5px">
        ${o.kirimNarxi ? fmt(o.kirimNarxi) + " so'm" : "—"}
      </td>
      <td class="num" style="font-weight:700;font-size:13px">${jami ? fmt(jami) + " so'm" : "—"}</td>
      <td style="font-size:12.5px">
        ${o.supplier ? `<div style="font-weight:500">${o.supplier}</div>` : ""}
        ${o.partiya  ? `<div style="font-size:11px;color:#aaa">${o.partiya}</div>`  : ""}
      </td>
      <td>
        <span class="bg ${o.payStatus==="qarz"?"bg-r":"bg-g"}" style="font-size:11px">
          ${o.payStatus === "qarz" ? "⚠️ Qarz" : "✅ To'langan"}
        </span>
        ${o.payStatus === "qarz"
          ? `<button class="btn btn-sm btn-teal" style="margin-top:4px;font-size:11px" onclick="omMarkPaid(${o.id})">
               To'landi
             </button>` : ""}
      </td>
      <td>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="omDeleteKirim(${o.id})" style="color:var(--red)" title="O'chirish">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="10" class="empty-td">Kirim tarixi bo'sh</td></tr>`;
}

// ── Yetkazuvchilar ────────────────────────────────
function omRenderSuppliers() {
  const sups = {};
  (db.ombor || []).forEach(o => {
    const name = o.supplier || "Noma'lum";
    if (!sups[name]) sups[name] = { cnt:0, total:0, paid:0, debt:0 };
    const val = (o.kirimNarxi || 0) * (o.qty || 0);
    sups[name].cnt++;
    sups[name].total += val;
    if (o.payStatus === "qarz") sups[name].debt += val;
    else sups[name].paid += val;
  });

  const el = $("om-sup-body"); if (!el) return;
  const entries = Object.entries(sups).sort((a, b) => b[1].total - a[1].total);

  el.innerHTML = entries.length ? entries.map(([name, s]) => `<tr>
    <td style="font-weight:600;font-size:13.5px">${name}</td>
    <td class="num">${s.cnt} ta</td>
    <td class="num" style="font-weight:700">${fmt(s.total)} so'm</td>
    <td class="num" style="color:var(--grn)">${fmt(s.paid)} so'm</td>
    <td class="num">
      ${s.debt > 0
        ? `<span style="color:var(--red);font-weight:700">${fmt(s.debt)} so'm</span>`
        : `<span class="bg bg-g" style="font-size:11px">✅</span>`}
    </td>
  </tr>`).join("") : `<tr><td colspan="5" class="empty-td">Yetkazuvchi yo'q</td></tr>`;
}

// ── Kirimni to'langan deb belgilash ───────────────
function omMarkPaid(id) {
  const o = (db.ombor || []).find(x => x.id === id); if (!o) return;
  o.payStatus = "tolangan";
  saveDB(); omRenderKirim();
  toast("✅ To'langan deb belgilandi");
}

// ── Kirimni o'chirish ─────────────────────────────
function omDeleteKirim(id) {
  const o = (db.ombor || []).find(x => x.id === id); if (!o) return;
  if (!confirm(`${o.productName} — ${o.qty} ${o.unit} — ${o.date}\nBu kirimni o'chirilsinmi?\n(Qoldiq avtomatik kamayadi)`)) return;
  db.ombor = db.ombor.filter(x => x.id !== id);
  saveDB(); renderOmbor();
  toast("Kirim o'chirildi");
}

// ── Excel eksport ─────────────────────────────────
function exportOmborExcel() {
  const rows = [["Sana","Mahsulot","SKU","Birlik","Rang","O'lcham","Miqdor","Karobka","Tannarx","Jami","Yetkazuvchi","Partiya","To'lov"]];
  (db.ombor || []).forEach(o => {
    rows.push([
      o.date||"", o.productName||"", o.sku||"", o.unit||"",
      o.color||"", o.size||"", o.qty||0, o.boxes||"",
      o.kirimNarxi||0, (o.kirimNarxi||0)*(o.qty||0),
      o.supplier||"", o.partiya||"",
      o.payStatus==="qarz"?"Qarz":"To'langan"
    ]);
  });
  downloadCSV(rows, `merx_ombor_${today()}.xls`);
  toast("Ombor Excel yuklab olindi");
}

// ══════════════════════════════════════════════════
// TOVAR QABUL — YANGI FORMA
// Katalogdan tanlash → faqat kirim ma'lumotlari
// ══════════════════════════════════════════════════

// Qabul formasini ochganda katalog ro'yxatini to'ldirish
function openQabulModal() {
  // Katalog mahsulotlar ro'yxati (datalist uchun)
  const list = $("qb-prod-list");
  if (list) {
    list.innerHTML = db.products.map(p =>
      `<option value="${p.name}" data-sku="${p.sku}" data-inbox="${p.inBox||1}" data-unit="${p.unit||'dona'}">`
    ).join("");
  }
  // Formani tozalash
  qbReset();
  openModal("qabul");
}

// Mahsulot tanlanganda — katalogdan narx va unit keladi
function qbOnProdSelect() {
  const name = ($("qb-name")||{value:""}).value.trim();
  const p    = db.products.find(x => x.name === name);
  if (!p) {
    // Yangi mahsulot — barcha maydonlar bo'sh
    if ($("qb-inbox"))   $("qb-inbox").value   = "";
    if ($("qb-unit-lbl"))$("qb-unit-lbl").textContent = "dona";
    if ($("qb-ulgurji-row")) $("qb-ulgurji-row").style.display = "none";
    return;
  }
  // Katalogdan ma'lumot
  if ($("qb-inbox"))    $("qb-inbox").value    = p.inBox || 1;
  if ($("qb-unit-lbl")) $("qb-unit-lbl").textContent = p.unit || "dona";

  // Ulgurji narx yangilash (ixtiyoriy)
  const ulgurjiRow = $("qb-ulgurji-row");
  if (ulgurjiRow) {
    ulgurjiRow.style.display = "block";
    const el = $("qb-ulgurji");
    if (el) {
      el.value = p.ulgurjiNarx || "";
      el.placeholder = `Joriy: ${fmt(p.ulgurjiNarx||0)} so'm`;
    }
  }
  qbCalcTotal();
}

// Karobka/dona o'zgarganda jami hisoblash
function qbCalcTotal() {
  const boxes  = parseFloat(($("qb-boxes")||{value:0}).value)  || 0;
  const inBox  = parseFloat(($("qb-inbox")||{value:1}).value)  || 1;
  const manual = parseFloat(($("qb-qty")||{value:0}).value)    || 0;
  const total  = boxes > 0 ? Math.round(boxes * inBox) : manual;
  if ($("qb-total-lbl")) $("qb-total-lbl").textContent = total + " dona/juft";
}

function qbReset() {
  ["qb-name","qb-boxes","qb-qty","qb-cost","qb-ulgurji","qb-supplier","qb-partiya"].forEach(id => {
    if ($(id)) $(id).value = "";
  });
  if ($("qb-pay")) $("qb-pay").value = "tolangan";
  if ($("qb-date")) $("qb-date").value = today();
  if ($("qb-total-lbl")) $("qb-total-lbl").textContent = "— dona";
  if ($("qb-ulgurji-row")) $("qb-ulgurji-row").style.display = "none";
}

// ── Tovarni qabul qilish ──────────────────────────
function qabulTovar() {
  const name      = ($("qb-name")||{value:""}).value.trim();
  const color     = ($("qb-color")||{value:""}).value.trim()   || "Standart";
  const pantone   = ($("qb-pantone")||{value:""}).value.trim() || "";
  const hexVal    = ($("qb-hex")||{value:""}).value.trim()     || "#888888";
  const size      = ($("qb-size")||{value:""}).value.trim()    || "Aralash";
  const boxes     = parseFloat(($("qb-boxes")||{value:0}).value) || 0;
  const inBox     = parseFloat(($("qb-inbox")||{value:1}).value) || 1;
  const manualQty = parseFloat(($("qb-qty")||{value:0}).value)   || 0;
  const qty       = boxes > 0 ? Math.round(boxes * inBox) : manualQty;
  const kirimNarxi= getRawVal("qb-cost");
  const supplier  = ($("qb-supplier")||{value:""}).value.trim();
  const partiya   = ($("qb-partiya")||{value:""}).value.trim();
  const payStatus = ($("qb-pay")||{value:"tolangan"}).value;
  const date      = ($("qb-date")||{value:""}).value || today();

  // Yangi ulgurji narx (ixtiyoriy)
  const newUlgurji = getRawVal("qb-ulgurji");

  if (!name)  { toast("Mahsulot nomini kiriting", "err"); return; }
  if (qty <= 0) { toast("Miqdorni kiriting", "err"); return; }

  // Ombor yozuvi
  const kirim = {
    id:          db.seq++,
    date,
    sku:         db.products.find(x => x.name === name)?.sku || "",
    productName: name,
    unit:        db.products.find(x => x.name === name)?.unit || "dona",
    color,
    size,
    qty,
    boxes:       boxes > 0 ? boxes : null,
    pantone,
    hex:         hexVal,
    kirimNarxi,
    supplier:    supplier || null,
    partiya:     partiya  || null,
    payStatus
  };
  if (!db.ombor) db.ombor = [];
  db.ombor.push(kirim);

  // Agar katalogda yo'q bo'lsa — yangi mahsulot yaratamiz
  let p = db.products.find(x => x.name === name);
  if (!p) {
    p = {
      sku:         `RECV-${String(db.seq).padStart(3,"0")}`,
      name,
      category:    "Qabul qilingan",
      type:        db.settings?.shopType === "kiyim" ? "kiyim" : "oyoq",
      unit:        kirim.unit,
      inBox:       inBox,
      barcode:     genEAN13(db.seq),
      costUsd:     0,
      priceUzs:    0,
      ulgurjiNarx: newUlgurji || 0,
      variants:    []   // variants bo'sh — qoldiq getStock() dan hisoblanadi
    };
    db.products.push(p);
    toast(`✅ "${name}" katalogga ham qo'shildi`);
  }

  // Ulgurji narxni yangilash (agar kiritilgan bo'lsa)
  if (newUlgurji > 0 && p.ulgurjiNarx !== newUlgurji) {
    p.ulgurjiNarx = newUlgurji;
  }

  // inBox ni yangilash (agar karobkada soni o'zgargan bo'lsa)
  if (boxes > 0 && inBox !== p.inBox) {
    p.inBox = inBox;
  }

  saveDB();
  renderOmbor();
  closeModal("qabul");
  toast(`✅ ${name} — ${qty} ${kirim.unit} qabul qilindi`);
}

// ══════════════════════════════════════════════════
// INVENTARIZATSIYA
// systemQty ham getStock() dan keladi
// ══════════════════════════════════════════════════

let _invData   = [];
let _invFilter = "all";

function openInvent() {
  // Har bir mahsulot × rang × o'lcham kombinatsiyasi
  // systemQty = getStock(name, color, size) — haqiqiy hisob
  _invData = [];

  db.products.forEach(p => {
    // Ombordagi barcha rang/o'lcham kombinatsiyalarini topamiz
    const variants = new Map();

    // Ombor kirimi asosida
    (db.ombor || []).forEach(o => {
      if (o.productName !== p.name) return;
      const key = `${o.color}|${o.size || "—"}`;
      if (!variants.has(key)) {
        variants.set(key, { color: o.color, size: o.size || "—", hex: o.hex || "#888", barcode: p.barcode || "" });
      }
    });

    // Variants dan ham (eski ma'lumotlar uchun fallback)
    (p.variants || []).forEach(v => {
      const key = `${v.color}|${v.size || "—"}`;
      if (!variants.has(key)) {
        variants.set(key, { color: v.color, size: v.size || "—", hex: v.hex || "#888", barcode: p.barcode || "" });
      }
    });

    variants.forEach((info, key) => {
      const systemQty = getStock(p.name, info.color, info.size !== "—" ? info.size : undefined);
      _invData.push({
        sku:        p.sku,
        name:       p.name,
        unit:       p.unit || "dona",
        color:      info.color,
        size:       info.size,
        hex:        info.hex,
        barcode:    info.barcode,
        systemQty,
        actualQty:  null,
        counted:    false
      });
    });
  });

  renderInvTable();
  updateInvStats();

  const ov = $("ov-invent");
  if (ov) ov.style.display = "flex";
  setTimeout(() => { if ($("inv-scan")) $("inv-scan").focus(); }, 100);
}

function closeInvent() {
  const ov = $("ov-invent");
  if (ov) ov.style.display = "none";
}

function setInvFilter(f) {
  _invFilter = f;
  document.querySelectorAll(".inv-filter-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.f === f));
  renderInvTable();
}

function invSearch() { renderInvTable(); }

function invScanEnter() {
  const q = ($("inv-scan")||{value:""}).value.trim();
  if (!q) return;

  const row = _invData.find(r =>
    r.barcode === q ||
    r.name.toLowerCase() === q.toLowerCase()
  );

  if (row) {
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

function invSetQty(sku, color, size, val) {
  const row = _invData.find(r => r.sku===sku && r.color===color && r.size===size);
  if (!row) return;
  const n = parseInt(val);
  row.actualQty = isNaN(n) ? null : Math.max(0, n);
  row.counted   = row.actualQty !== null;
  updateInvStats();
  renderInvTable();
}

function renderInvTable() {
  const q = ($("inv-scan")||{value:""}).value.toLowerCase();
  const tbody = $("inv-body"); if (!tbody) return;

  let rows = _invData;
  if (_invFilter === "diff")    rows = rows.filter(r => r.counted && r.actualQty !== r.systemQty);
  if (_invFilter === "done")    rows = rows.filter(r => r.counted);
  if (_invFilter === "notdone") rows = rows.filter(r => !r.counted);
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

function updateInvStats() {
  const total = _invData.length;
  const done  = _invData.filter(r => r.counted).length;
  const diff  = _invData.filter(r => r.counted && r.actualQty !== r.systemQty).length;
  if ($("inv-total-cnt")) $("inv-total-cnt").textContent = total;
  if ($("inv-done-cnt"))  $("inv-done-cnt").textContent  = done;
  if ($("inv-diff-cnt"))  $("inv-diff-cnt").textContent  = diff;
  if ($("inv-progress"))  $("inv-progress").textContent  = `${done}/${total} sanalgan`;
}

// ── Inventarizatsiyani tasdiqlash ─────────────────
// Farq bo'lsa → tuzatish yozuvi ombor ga qo'shiladi
function confirmInvent() {
  const counted = _invData.filter(r => r.counted);
  if (!counted.length) { toast("Hech narsa sanalmadi","err"); return; }

  const diffs = counted.filter(r => r.actualQty !== r.systemQty);
  const msg = diffs.length > 0
    ? `${counted.length} ta variant sanalgan. ${diffs.length} ta farq bor.\n\nFarqlar ombor tuzatish yozuvi sifatida qo'shiladi.`
    : `${counted.length} ta variant sanalgan. Farq yo'q. Tasdiqlaysizmi?`;

  if (!confirm(msg)) return;

  // Farq bo'lsa — tuzatish kirim yozuvi qo'shamiz
  let updated = 0;
  diffs.forEach(r => {
    const diff = r.actualQty - r.systemQty;
    if (diff === 0) return;

    // Tuzatish yozuvi: + bo'lsa kirim, - bo'lsa chiqim (manfiy qty)
    db.ombor.push({
      id:          db.seq++,
      date:        today(),
      sku:         r.sku,
      productName: r.name,
      unit:        r.unit,
      color:       r.color,
      size:        r.size !== "—" ? r.size : "",
      qty:         diff,   // manfiy bo'lishi mumkin (kamomad)
      boxes:       null,
      kirimNarxi:  0,
      supplier:    "Inventarizatsiya tuzatish",
      partiya:     today(),
      payStatus:   "tolangan",
      hex:         r.hex || "#888"
    });
    updated++;
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
  toast(`✅ ${updated} ta tuzatish yozildi. Inventarizatsiya tugadi.`);
}

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
  downloadCSV(rows, `merx_invent_${today()}.xls`);
  toast("Inventarizatsiya Excel yuklab olindi");
}
