// ================================================
// MERX — js/katalog.js  (v2 — Barcode + Margin)
// ================================================

let editSku = null;
let katLowFilter = false;

// ── Kam qoldiq filtri ──────────────────────────
function toggleKatLow() {
  katLowFilter = !katLowFilter;
  const btn = $("kat-low-btn");
  if (btn) {
    btn.style.background    = katLowFilter ? "var(--red)"  : "";
    btn.style.color         = katLowFilter ? "#fff"        : "";
    btn.style.borderColor   = katLowFilter ? "var(--red)"  : "";
  }
  renderKatalog();
}

// ── Katalog jadvali ────────────────────────────
function renderKatalog() {
  const q   = ($("kat-q")||{value:""}).value.toLowerCase();
  const rate = db.settings.rate || 12800;
  let ps = db.products.filter(p =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q) ||
    (p.barcode && p.barcode.toLowerCase().includes(q)) ||
    p.category.toLowerCase().includes(q)
  );
  if (katLowFilter) ps = ps.filter(p => totalStock(p) <= 5);

  $("katalog-body").innerHTML = ps.length ? ps.map(p => {
    const st       = totalStock(p);
    const costUzs  = (p.costUsd || 0) * rate;
    const margin   = p.priceUzs > 0 && costUzs > 0
      ? Math.round((p.priceUzs - costUzs) / p.priceUzs * 100)
      : null;
    const mColor   = margin == null ? "#ccc"
      : margin >= 30 ? "var(--grn)"
      : margin >= 15 ? "#E07B39"
      : "var(--red)";

    const chips = p.variants.map(v =>
      `<span class="vb ${v.qty<=3?"lo":""}">${v.color}/${v.size}: ${v.qty}</span>`
    ).join("");

    return `<tr>
      <td style="font-size:11px;color:var(--mut);font-family:monospace">${p.sku}</td>
      <td>
        <div style="font-weight:600">${p.name}</div>
        <div style="font-size:11px;color:#aaa">${p.unit||"dona"} · ${p.category}</div>
        ${p.inBox>1?`<div style="font-size:10.5px;color:#bbb">📦 1 karobka = ${p.inBox} ${p.unit||"dona"}</div>`:""}
      </td>
      <td>
        ${p.barcode
          ? `<span style="font-family:monospace;font-size:12px;background:var(--bg);padding:2px 7px;border-radius:4px;border:1px solid var(--brd)">${p.barcode}</span>`
          : `<span style="color:#ccc;font-size:12px">—</span>`}
      </td>
      <td><span class="bg bg-gr">${p.category}</span></td>
      <td><div class="vsum">${chips}</div></td>
      <td>
        ${margin != null
          ? `<span style="font-weight:700;color:${mColor};font-size:13px">${margin}%</span>
             <div style="font-size:10.5px;color:#bbb">${Math.round(costUzs/1000)}K → ${Math.round(p.priceUzs/1000)}K</div>`
          : `<span style="color:#ccc">—</span>`}
      </td>
      <td class="num" style="color:var(--teal);font-weight:600">${priceDisplay(p.priceUzs)}</td>
      <td class="num" style="color:var(--acc);font-weight:600">${p.ulgurjiNarx ? priceDisplay(p.ulgurjiNarx) : '<span style="color:#ccc">—</span>'}</td>
      <td>
        <span class="bg ${st<=0?"bg-r":st<=5?"bg-a":"bg-g"}">
          ${st} ${p.unit||"dona"}
        </span>
      </td>
      <td>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditProduct('${p.sku}')">
          <i class="ti ti-edit"></i>
        </button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="10" class="empty-td">
    ${katLowFilter ? "Kam qoldiqli mahsulot yo'q 🎉" : "Mahsulot topilmadi"}
  </td></tr>`;
}

// ── Mahsulot tahrirlash ────────────────────────
function openEditProduct(sku) {
  const p = db.products.find(x => x.sku === sku); if (!p) return;
  editSku = sku;
  $("ep-title").textContent   = p.name + " — tahrirlash";
  $("ep-name").value          = p.name;
  $("ep-cat").value           = p.category;
  $("ep-cost").value          = p.costUsd;
  $("ep-price").value         = p.priceUzs;
  $("ep-ulgurji").value       = p.ulgurjiNarx || 0;
  if ($("ep-unit"))    $("ep-unit").value    = p.unit    || "dona";
  if ($("ep-barcode")) $("ep-barcode").value = p.barcode || "";
  renderEpVariants(p);
  openModal("editprod");
}

function renderEpVariants(p) {
  $("ep-variants").innerHTML = p.variants.map((v, i) => `<tr>
    <td><input value="${v.color}" id="epv-c-${i}"></td>
    <td><input value="${v.size}" id="epv-s-${i}" style="width:70px"></td>
    <td><input type="number" value="${v.qty}" id="epv-q-${i}" min="0" style="width:80px"></td>
    <td><button class="btn btn-ghost btn-icon btn-sm" onclick="epDelVariant(${i})">
      <i class="ti ti-trash" style="color:var(--red)"></i>
    </button></td>
  </tr>`).join("");
}

function epAddVariantRow() {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  p.variants.push({ color:"", size:"", qty:0 }); renderEpVariants(p);
}

function epDelVariant(i) {
  const p = db.products.find(x => x.sku === editSku);
  if (!p || p.variants.length <= 1) { toast("Kamida 1 ta variant kerak","err"); return; }
  if (!confirm("Bu variantni o'chirasizmi?")) return;
  p.variants.splice(i, 1); renderEpVariants(p);
}

function saveEditProduct() {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  p.name        = $("ep-name").value.trim()    || p.name;
  p.category    = $("ep-cat").value.trim()     || p.category;
  p.costUsd     = parseFloat($("ep-cost").value)    || p.costUsd;
  p.priceUzs    = parseFloat($("ep-price").value)   || p.priceUzs;
  p.ulgurjiNarx = parseFloat($("ep-ulgurji").value) || 0;
  if ($("ep-unit"))    p.unit    = $("ep-unit").value    || p.unit;
  if ($("ep-barcode")) p.barcode = $("ep-barcode").value.trim();

  p.variants.forEach((v, i) => {
    v.color = ($("epv-c-"+i)||{value:v.color}).value.trim() || v.color;
    v.size  = ($("epv-s-"+i)||{value:v.size}).value.trim()  || v.size;
    v.qty   = parseInt(($("epv-q-"+i)||{value:v.qty}).value) || 0;
  });
  p.variants = p.variants.filter(v => v.color && v.size);

  saveDB(); closeModal("editprod"); renderKatalog();
  toast(`"${p.name}" saqlandi`);
}

function deleteProduct() {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  if (!confirm(`"${p.name}" ni o'chirasizmi? Bu amalni qaytarib bo'lmaydi.`)) return;
  db.products = db.products.filter(x => x.sku !== editSku);
  saveDB(); closeModal("editprod"); renderKatalog();
  toast(`"${p.name}" o'chirildi`, "info");
}

// ── Yangi mahsulot qo'shish ────────────────────
function apTypeChange() {
  const t = ($("ap-type")||{value:"oyoq"}).value;
  if ($("ap-cat"))  $("ap-cat").innerHTML  = (CATS[t]||[]).map(c => `<option>${c}</option>`).join("");
  if ($("ap-size")) $("ap-size").innerHTML = (SIZES[t]||[]).map(s => `<option>${s}</option>`).join("");
  apCostNote();
}

function apCostNote() {
  const c = parseFloat(($("ap-cost")||{value:0}).value) || 0;
  const r = db.settings.rate || 1;
  const p = parseFloat(($("ap-price")||{value:0}).value) || 0;
  const costUzs = c * r;
  const margin  = p > 0 && costUzs > 0
    ? Math.round((p - costUzs) / p * 100)
    : null;
  const mTxt = margin != null
    ? ` → <strong style="color:${margin>=30?"var(--grn)":margin>=15?"#E07B39":"var(--red)"}">${margin}% foyda</strong>`
    : "";
  if ($("ap-cost-note")) $("ap-cost-note").innerHTML = c
    ? `Tannarx so'mda: $${c} × ${fmt(r)} = ${fmt(costUzs)} so'm${mTxt}`
    : "";
}

function addProduct() {
  const name = ($("ap-name")||{value:""}).value.trim(); if (!name) { toast("Nom kiriting","err"); return; }
  const t       = ($("ap-type")||{value:"oyoq"}).value;
  const color   = ($("ap-color")||{value:"-"}).value.trim() || "-";
  const size    = ($("ap-size")||{value:""}).value;
  const qty     = parseInt(($("ap-qty")||{value:0}).value)   || 0;
  const cost    = parseFloat(($("ap-cost")||{value:0}).value)   || 0;
  const price   = parseFloat(($("ap-price")||{value:0}).value)  || 0;
  const ulg     = parseFloat(($("ap-ulgurji")||{value:0}).value)|| 0;
  const unit    = ($("ap-unit")||{value:"dona"}).value;
  const inBox   = parseInt(($("ap-inbox")||{value:1}).value) || 1;
  const barcode = ($("ap-barcode")||{value:""}).value.trim();

  let p = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (p) {
    const ex = p.variants.find(v => v.color===color && v.size===size);
    if (ex) ex.qty += qty; else p.variants.push({ color, size, qty });
    // Barcode yangilash (agar yangi kiritilgan bo'lsa)
    if (barcode && !p.barcode) p.barcode = barcode;
  } else {
    db.products.push({
      sku: `${t==="oyoq"?"SHOE":"CLTH"}-${String(db.seq++).padStart(3,"0")}`,
      name, category: ($("ap-cat")||{value:""}).value,
      type:t, unit, inBox,
      costUsd:cost, priceUzs:price, ulgurjiNarx:ulg,
      barcode: barcode || undefined,
      variants:[{color, size, qty}]
    });
  }

  saveDB(); closeModal("addprod"); renderKatalog();
  toast(`"${name}" qo'shildi`);
  // Formani tozalash
  if ($("ap-name"))    $("ap-name").value    = "";
  if ($("ap-color"))   $("ap-color").value   = "";
  if ($("ap-qty"))     $("ap-qty").value     = "10";
  if ($("ap-barcode")) $("ap-barcode").value = "";
  if ($("ap-cost-note")) $("ap-cost-note").innerHTML = "";
}
