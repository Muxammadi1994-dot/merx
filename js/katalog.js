// MERX katalog.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/katalog.js  (v3 — Pantone + Yangi dizayn)
// ================================================

let editSku = null;
let katLowFilter = false;
let katCatFilter = "all"; // "all" | "oyoq" | "kiyim" | category name
let katSortBy    = null;  // "name" | "qty" | "price"
let katSortAsc   = true;

// ── Kategoriya filtri ──────────────────────────
function setKatCat(c) {
  katCatFilter = c;
  document.querySelectorAll(".kat-cat-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.c === c));
  renderKatalog();
}

// Dinamik kategoriya tugmalarini yangilash
function updateKatCatBtns() {
  const cats = [...new Set(db.products.map(p => p.category))].slice(0, 6);
  const el = $("kat-cat-dynamic"); if (!el) return;
  el.innerHTML = cats.map(c =>
    `<button class="kat-cat-btn ${katCatFilter===c?"on":""}" data-c="${c}" onclick="setKatCat('${c.replace(/'/g,"\\'")}')">
      ${c}
    </button>`
  ).join("");
}

// ── Kam qoldiq filtri ──────────────────────────
function toggleKatLow() {
  katLowFilter = !katLowFilter;
  const btn = $("kat-low-btn");
  if (btn) {
    btn.style.background  = katLowFilter ? "var(--red)" : "";
    btn.style.color       = katLowFilter ? "#fff"       : "";
    btn.style.borderColor = katLowFilter ? "var(--red)" : "";
  }
  renderKatalog();
}

// ── Katalog jadvali ────────────────────────────
function renderKatalog() {
  const q    = ($("kat-q")||{value:""}).value.toLowerCase();
  const rate = db.settings.rate || 12800;
  const showChakana = db.settings.showChakana || false;

  let ps = db.products.filter(p =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q) ||
    (p.barcode && p.barcode.toLowerCase().includes(q)) ||
    p.category.toLowerCase().includes(q)
  );
  if (katLowFilter) ps = ps.filter(p => totalStock(p) <= 5);
  if (katCatFilter === "oyoq")  ps = ps.filter(p => p.type === "oyoq");
  else if (katCatFilter === "kiyim") ps = ps.filter(p => p.type === "kiyim");
  else if (katCatFilter !== "all")   ps = ps.filter(p => p.category === katCatFilter);

  // Dinamik kategoriya tugmalarini yangilash
  updateKatCatBtns();

  $("katalog-body").innerHTML = ps.length ? ps.map(p => {
    const st      = totalStock(p);
    const inBox   = p.inBox || 1;
    const costUzs = (p.costUsd || 0) * rate;

    // Rang guruhlash
    const colorGroups = {};
    p.variants.forEach(v => {
      if (!colorGroups[v.color]) colorGroups[v.color] = { hex: v.hex||"#888", pantone: v.pantone||"", qty: 0 };
      colorGroups[v.color].qty += v.qty;
    });

    // Ranglar ko'rinishi
    const colorChips = Object.entries(colorGroups).map(([color, info]) =>
      `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <div style="width:14px;height:14px;border-radius:4px;flex-shrink:0;
          background:${info.hex};border:1px solid rgba(0,0,0,.12)"
          title="${info.pantone}"></div>
        <span style="font-size:12.5px;font-weight:500">${color}</span>
        ${info.pantone ? `<span style="font-size:10px;color:#bbb">${info.pantone}</span>` : ""}
      </div>`
    ).join("");

    // Karobka jami
    const totalBoxes = inBox > 1 ? +(st / inBox).toFixed(1) : null;

    // Margin (ulgurji asosida)
    const margin = p.ulgurjiNarx > 0 && costUzs > 0
      ? Math.round((p.ulgurjiNarx - costUzs) / p.ulgurjiNarx * 100) : null;
    const mColor = margin == null ? "#ccc"
      : margin >= 30 ? "var(--grn)" : margin >= 15 ? "#E07B39" : "var(--red)";

    return `<tr onclick="openEditProduct('${p.sku}')" style="cursor:pointer">
      <td onclick="event.stopPropagation()">
        ${p.image
          ? `<img src="${p.image}" class="kat-thumb" onclick="openEditProduct('${p.sku}')" style="cursor:pointer">`
          : `<div class="kat-thumb-empty" onclick="openEditProduct('${p.sku}')" style="cursor:pointer"><i class="ti ti-photo"></i></div>`}
      </td>
      <td style="font-family:monospace;font-size:11px;color:var(--mut)">${p.sku}</td>
      <td>
        <div style="font-weight:700;font-size:13.5px;color:#0D1B2A">${p.name}</div>
        <div style="font-size:11.5px;color:#bbb;margin-top:2px">
          ${p.unit||"dona"} · ${p.category}
          ${inBox > 1 ? `· <span style="color:#856404">📦 ${inBox}/karobka</span>` : ""}
        </div>
      </td>
      <td style="font-family:monospace;font-size:11.5px">
        ${p.barcode
          ? `<span style="background:var(--bg);padding:2px 8px;border-radius:5px;border:1px solid var(--brd)">${p.barcode}</span>`
          : `<span style="color:#ccc">—</span>`}
      </td>
      <td>${colorChips}</td>
      <td class="num">
        ${totalBoxes != null
          ? `<span style="font-weight:700;font-size:14px">${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)}</span>
             <span style="font-size:10.5px;color:#bbb;margin-left:3px">karobka</span>`
          : `<span style="color:#bbb;font-size:12px">donab</span>`}
      </td>
      <td class="num">
        <span class="bg ${st<=0?"bg-r":st<=5?"bg-a":"bg-g"}" style="font-weight:700">
          ${st} ${p.unit||"dona"}
        </span>
      </td>
      <td class="num" style="font-size:12.5px">
        ${costUzs ? `<div style="font-weight:600">${fmt(costUzs)} so'm</div>` : "—"}
        ${costUzs && inBox > 1 ? `<div style="font-size:11px;color:#856404;margin-top:2px">📦 ${fmt(costUzs * inBox)} so'm</div>` : ""}
        ${p.costUsd ? `<div style="font-size:10.5px;color:#bbb">$${p.costUsd}</div>` : ""}
      </td>
      <td class="num" style="font-size:12.5px">
        ${p.ulgurjiNarx ? `<div style="font-weight:700;color:var(--acc)">${fmt(p.ulgurjiNarx)} so'm</div>` : '<span style="color:#ccc">—</span>'}
        ${p.ulgurjiNarx && inBox > 1 ? `<div style="font-size:11px;color:#e9a500;margin-top:2px">📦 ${priceDisplay(p.ulgurjiNarx * inBox)}</div>` : ""}
        ${margin != null ? `<div style="font-size:10px;color:${mColor}">margin ${margin}%</div>` : ""}
      </td>
      ${showChakana ? `<td class="num" style="color:var(--teal);font-size:12.5px">${p.priceUzs ? fmt(p.priceUzs)+" so'm" : "—"}</td>` : ""}
      <td onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditProduct('${p.sku}')">
          <i class="ti ti-edit"></i>
        </button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="9" class="empty-td">
    ${katLowFilter ? "Kam qoldiqli mahsulot yo'q 🎉" : q ? `"${q}" topilmadi` : "Mahsulot yo'q"}
  </td></tr>`;
}

// ══════════════════════════════════════════════
// PANTONE PICKER
// ══════════════════════════════════════════════

function ppRenderGrid(prefix) {
  const grid = $(`${prefix}-pp-grid`);
  if (!grid) return;
  const curCode = $(`${prefix}-pantone`)?.value || "";
  grid.innerHTML = PANTONE_COLORS.map(p => `
    <div class="pp-item ${p.code===curCode?"selected":""}"
      onclick="ppSelect('${prefix}','${p.code}','${p.name.replace(/'/g,"\\'")}','${p.hex}')">
      <div class="pp-dot" style="background:${p.hex}"></div>
      <div>
        <div class="pp-iname">${p.name}</div>
        <div class="pp-icode">${p.code}</div>
      </div>
    </div>`).join("");
}

function ppToggle(prefix) {
  const dd = $(`${prefix}-pp-dd`);
  if (!dd) return;
  const isOpen = dd.classList.contains("open");
  // Barcha ochiq dropdownlarni yopamiz
  document.querySelectorAll(".pp-dd.open").forEach(el => el.classList.remove("open"));
  if (!isOpen) { dd.classList.add("open"); ppRenderGrid(prefix); }
}

// Tashqarini bosganda yopish
document.addEventListener("click", function(e) {
  if (!e.target.closest(".pantone-picker")) {
    document.querySelectorAll(".pp-dd.open").forEach(el => el.classList.remove("open"));
  }
});

function ppSelect(prefix, code, name, hex) {
  if ($(`${prefix}-color`))   $(`${prefix}-color`).value   = name;
  if ($(`${prefix}-pantone`)) $(`${prefix}-pantone`).value = code;
  if ($(`${prefix}-hex`))     $(`${prefix}-hex`).value     = hex;
  if ($(`${prefix}-pp-swatch`)) $(`${prefix}-pp-swatch`).style.background = hex;
  if ($(`${prefix}-pp-code`))   $(`${prefix}-pp-code`).textContent = code;
  if ($(`${prefix}-pp-name`))   $(`${prefix}-pp-name`).textContent = name;
  const dd = $(`${prefix}-pp-dd`);
  if (dd) dd.classList.remove("open");
}

function ppCustomInput(prefix) {
  const val = $(`${prefix}-pp-custom`)?.value.trim();
  const hex = $(`${prefix}-pp-hex-custom`)?.value || "#888888";
  if (!val) return;
  if ($(`${prefix}-color`))   $(`${prefix}-color`).value   = val;
  if ($(`${prefix}-pantone`)) $(`${prefix}-pantone`).value = "Custom";
  if ($(`${prefix}-hex`))     $(`${prefix}-hex`).value     = hex;
  if ($(`${prefix}-pp-swatch`)) $(`${prefix}-pp-swatch`).style.background = hex;
  if ($(`${prefix}-pp-code`))   $(`${prefix}-pp-code`).textContent = val;
  if ($(`${prefix}-pp-name`))   $(`${prefix}-pp-name`).textContent = "Maxsus rang";
}

function ppCustomHex(prefix) {
  const hex = $(`${prefix}-pp-hex-custom`)?.value || "#888888";
  const name = $(`${prefix}-pp-custom`)?.value.trim() || "Maxsus";
  ppSelect(prefix, "Custom", name, hex);
}

function ppReset(prefix) {
  if ($(`${prefix}-color`))   $(`${prefix}-color`).value   = "";
  if ($(`${prefix}-pantone`)) $(`${prefix}-pantone`).value = "";
  if ($(`${prefix}-hex`))     $(`${prefix}-hex`).value     = "#888888";
  if ($(`${prefix}-pp-swatch`)) $(`${prefix}-pp-swatch`).style.background = "#e0ddd8";
  if ($(`${prefix}-pp-code`))   $(`${prefix}-pp-code`).textContent = "Rang tanlang";
  if ($(`${prefix}-pp-name`))   $(`${prefix}-pp-name`).textContent = "Pantone kodi";
  if ($(`${prefix}-pp-custom`)) $(`${prefix}-pp-custom`).value = "";
}

// ── Mahsulot tahrirlash ────────────────────────
function openEditProduct(sku) {
  const p = db.products.find(x => x.sku === sku); if (!p) return;
  editSku = sku;
  $("ep-title").textContent     = p.name + " — tahrirlash";
  $("ep-name").value            = p.name;
  $("ep-cat").value             = p.category;
  $("ep-cost").value            = p.costUsd;
  $("ep-price").value           = p.priceUzs;
  $("ep-ulgurji").value         = p.ulgurjiNarx || 0;
  if ($("ep-unit"))    $("ep-unit").value    = p.unit    || "dona";
  if ($("ep-barcode")) $("ep-barcode").value = p.barcode || "";
  if ($("ep-inbox"))   $("ep-inbox").value   = p.inBox   || 1;

  // Rasm
  if (p.image) {
    if ($("ep-img-preview"))     { $("ep-img-preview").src = p.image; $("ep-img-preview").style.display = "block"; }
    if ($("ep-img-placeholder")) $("ep-img-placeholder").style.display = "none";
    if ($("ep-img-remove"))      $("ep-img-remove").style.display = "";
    if ($("ep-image"))           $("ep-image").value = p.image;
  } else {
    epRemoveImage();
  }
  setTimeout(epUpdateBoxHints, 50);
  renderEpVariants(p);
  openModal("editprod");
}

function renderEpVariants(p) {
  $("ep-variants").innerHTML = p.variants.map((v, i) => `<tr>
    <td>
      <div style="display:flex;align-items:center;gap:7px">
        <div style="width:20px;height:20px;border-radius:5px;flex-shrink:0;
          background:${v.hex||"#888"};border:1px solid rgba(0,0,0,.12)"
          title="${v.pantone||v.color}"></div>
        <input value="${v.color}" id="epv-c-${i}" style="flex:1;min-width:60px">
      </div>
      <div style="font-size:10px;color:#aaa;margin-top:2px;padding-left:27px">
        ${v.pantone||""}
      </div>
    </td>
    <td><input value="${v.size}" id="epv-s-${i}" style="width:64px"></td>
    <td><input type="number" value="${v.qty}" id="epv-q-${i}" min="0" style="width:72px"></td>
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
  p.name        = $("ep-name").value.trim()     || p.name;
  p.category    = $("ep-cat").value.trim()      || p.category;
  p.costUsd     = parseFloat($("ep-cost").value)    || p.costUsd;
  p.priceUzs    = parseFloat($("ep-price").value)   || p.priceUzs;
  p.ulgurjiNarx = parseFloat($("ep-ulgurji").value) || 0;
  if ($("ep-unit"))    p.unit    = $("ep-unit").value    || p.unit;
  if ($("ep-barcode")) p.barcode = $("ep-barcode").value.trim();
  if ($("ep-inbox"))   p.inBox   = parseInt($("ep-inbox").value) || p.inBox || 1;
  if ($("ep-image") && $("ep-image").value) p.image = $("ep-image").value;
  else if ($("ep-image") && $("ep-image").value === "") p.image = "";

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

// ── O'lcham rejimi (bitta / oralig'i) ──────────
let apSizeMode = "single";

function apSetSizeMode(m) {
  apSizeMode = m;
  document.querySelectorAll(".ap-smode").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  $("ap-size-single").style.display = m === "single" ? "" : "none";
  $("ap-size-range").style.display  = m === "range"  ? "" : "none";
}

function apCalcBoxes() {
  const boxes  = parseInt(($("ap-boxes")||{value:1}).value)          || 1;
  const inBoxC = parseInt(($("ap-inbox-calc")||{value:0}).value)     || 0;
  const from   = ($("ap-size-from")||{value:""}).value;
  const to     = ($("ap-size-to")||{value:""}).value;
  const total  = inBoxC > 0 ? boxes * inBoxC : 0;

  if ($("ap-calc-total")) $("ap-calc-total").textContent = total > 0 ? total + " dona" : "— dona";
  if ($("ap-qty-range"))  $("ap-qty-range").value = total;

  const prev = $("ap-size-range-preview");
  if (prev && from && to) prev.textContent = `→ ${from}–${to}`;
  else if (prev) prev.textContent = "";

  // inBox ni asosiy maydondan ham yangilaymiz
  const inBoxMain = $("ap-inbox");
  if (inBoxMain && inBoxC > 0) inBoxMain.value = inBoxC;
  apUpdateBoxHints();
}

function addProduct() {
  const name = ($("ap-name")||{value:""}).value.trim();
  if (!name) { toast("Nom kiriting","err"); return; }

  const color   = ($("ap-color")||{value:""}).value.trim();
  if (!color) { toast("Rang tanlang","err"); return; }

  const t       = ($("ap-type")||{value:"oyoq"}).value;
  const cost    = parseFloat(($("ap-cost")||{value:0}).value)    || 0;
  const price   = parseFloat(($("ap-price")||{value:0}).value)   || 0;
  const ulg     = getRawVal("ap-ulgurji");
  const unit    = ($("ap-unit")||{value:"dona"}).value;
  const pantone = ($("ap-pantone")||{value:""}).value.trim();
  const hex     = ($("ap-hex")||{value:"#888888"}).value;
  const barcode = ($("ap-barcode")||{value:""}).value.trim();

  let inBox, newVariants;

  if (apSizeMode === "range") {
    const from = ($("ap-size-from")||{value:""}).value;
    const to   = ($("ap-size-to")||{value:""}).value;
    if (!from || !to) { toast("Razmer oralig'ini tanlang","err"); return; }
    const qty = parseInt(($("ap-qty-range")||{value:0}).value) || 0;
    if (qty <= 0) { toast("Karobka soni va karobkadagi miqdorni kiriting","err"); return; }
    inBox = parseInt(($("ap-inbox-calc")||{value:1}).value) || 1;
    newVariants = [{ color, size:`${from}–${to}`, qty, pantone, hex }];
  } else {
    const size = ($("ap-size")||{value:""}).value;
    const qty  = parseInt(($("ap-qty")||{value:0}).value) || 0;
    inBox = parseInt(($("ap-inbox")||{value:1}).value) || 1;
    newVariants = [{ color, size, qty, pantone, hex }];
  }

  let p = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (p) {
    newVariants.forEach(nv => {
      const ex = p.variants.find(v => v.color === nv.color && v.size === nv.size);
      if (ex) { ex.qty += nv.qty; if (pantone) { ex.pantone = pantone; ex.hex = hex; } }
      else p.variants.push(nv);
    });
    if (barcode && !p.barcode) p.barcode = barcode;
  } else {
    const autoBarcode = barcode || genEAN13(db.seq);
    db.products.push({
      sku: `${t==="oyoq"?"SHOE":"CLTH"}-${String(db.seq++).padStart(3,"0")}`,
      name, category: ($("ap-cat")||{value:""}).value,
      type:t, unit, inBox,
      costUsd:cost, priceUzs:price, ulgurjiNarx:ulg,
      barcode: autoBarcode,
      variants: newVariants
    });
  }

  saveDB(); closeModal("addprod"); renderKatalog();
  toast(`"${name}" qo'shildi`);

  // Formani tozalash
  if ($("ap-name"))       $("ap-name").value       = "";
  if ($("ap-qty"))        $("ap-qty").value         = "10";
  if ($("ap-boxes"))      $("ap-boxes").value       = "1";
  if ($("ap-inbox-calc")) $("ap-inbox-calc").value  = "";
  if ($("ap-calc-total")) $("ap-calc-total").textContent = "— dona";
  if ($("ap-barcode"))    $("ap-barcode").value     = "";
  if ($("ap-cost-note"))  $("ap-cost-note").innerHTML = "";
  if ($("ap-size-range-preview")) $("ap-size-range-preview").textContent = "";
  ppReset("ap");
  apSetSizeMode("single");
}

function apTypeChange() {
  const t = ($("ap-type")||{value:"oyoq"}).value;
  if ($("ap-cat"))  $("ap-cat").innerHTML  = (CATS[t]||[]).map(c => `<option>${c}</option>`).join("");
  if ($("ap-size")) $("ap-size").innerHTML = (SIZES[t]||[]).map(s => `<option>${s}</option>`).join("");
  apCostNote();
}

function apCostNote() {
  const cur  = db.settings?.priceCurrency || "uzs";
  const rate = db.settings?.rate || 1;
  const c    = parseFloat(($("ap-cost")||{value:0}).value) || 0;
  const u    = getRawVal("ap-ulgurji") || 0;
  const el   = $("ap-cost-note"); if (!el) return;

  if (c > 0) {
    let costUzs, txt;
    if (cur === "usd" || cur === "both") {
      costUzs = c * rate;
      const margin = u > 0 ? Math.round((u - costUzs) / u * 100) : null;
      const mCol   = margin == null ? "#aaa" : margin >= 30 ? "var(--grn)" : margin >= 15 ? "#E07B39" : "var(--red)";
      txt = `$${c} × ${fmt(rate)} = ${fmt(costUzs)} so'm`;
      if (margin != null) txt += ` → <strong style="color:${mCol}">${margin}% foyda</strong>`;
    } else {
      costUzs = c;
      const margin = u > 0 ? Math.round((u - costUzs) / u * 100) : null;
      const mCol   = margin == null ? "#aaa" : margin >= 30 ? "var(--grn)" : margin >= 15 ? "#E07B39" : "var(--red)";
      txt = `Tannarx: ${fmt(costUzs)} so'm`;
      if (margin != null) txt += ` → <strong style="color:${mCol}">${margin}% foyda</strong>`;
    }
    el.innerHTML = txt;
  } else {
    el.innerHTML = "";
  }
  apUpdateBoxHints();
}

function addProduct() {
  const name = ($("ap-name")||{value:""}).value.trim();
  if (!name) { toast("Nom kiriting","err"); return; }

  const color   = ($("ap-color")||{value:""}).value.trim();
  if (!color) { toast("Rang tanlang","err"); return; }

  const t       = ($("ap-type")||{value:"oyoq"}).value;
  const size    = ($("ap-size")||{value:""}).value;
  const qty     = parseInt(($("ap-qty")||{value:0}).value)    || 0;
  const cur     = db.settings?.priceCurrency || "uzs";
  const rate    = db.settings?.rate || 12800;
  const costRaw = parseFloat(($("ap-cost")||{value:0}).value) || 0;
  const cost    = (cur === "usd" || cur === "both") ? costRaw : (costRaw / rate);
  const price   = getRawVal("ap-price") || 0;
  const ulg     = getRawVal("ap-ulgurji");
  const unit    = ($("ap-unit")||{value:"dona"}).value;
  const inBox   = parseInt(($("ap-inbox")||{value:1}).value) || 1;
  const pantone = ($("ap-pantone")||{value:""}).value.trim();
  const hex     = ($("ap-hex")||{value:"#888888"}).value;
  const barcode = ($("ap-barcode")||{value:""}).value.trim();

  let p = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (p) {
    // Mavjud mahsulotga variant qo'shish
    const ex = p.variants.find(v => v.color===color && v.size===size);
    if (ex) { ex.qty += qty; } 
    else { p.variants.push({ color, size, qty, pantone, hex }); }
    if (barcode && !p.barcode) p.barcode = barcode;
  } else {
    // Yangi mahsulot
    const autoBarcode = barcode || genEAN13(db.seq);
    db.products.push({
      sku: `${t==="oyoq"?"SHOE":"CLTH"}-${String(db.seq++).padStart(3,"0")}`,
      name,
      category: ($("ap-cat")||{value:""}).value,
      type: t, unit, inBox,
      costUsd: cost, priceUzs: price, ulgurjiNarx: ulg,
      barcode: autoBarcode,
      variants: [{ color, size, qty, pantone, hex }]
    });
  }

  saveDB(); closeModal("addprod"); renderKatalog();
  toast(`"${name}" qo'shildi`);

  // Formani tozalash
  if ($("ap-name"))    $("ap-name").value    = "";
  if ($("ap-qty"))     $("ap-qty").value     = "10";
  if ($("ap-barcode")) $("ap-barcode").value = "";
  if ($("ap-cost-note")) $("ap-cost-note").innerHTML = "";
  ppReset("ap");
}

// ── Excel eksport ──────────────────────────────
function exportKatalogExcel() {
  const rate = db.settings.rate || 12800;
  const rows = [
    ["SKU", "Nomi", "Kategoriya", "Turi", "Birlik", "Karobka (inBox)",
     "Barcode", "Rang", "Pantone", "O'lcham", "Qoldiq (dona)",
     "Tannarx (USD)", "Tannarx (so'm)", "Ulgurji narx (so'm)", "Margin (%)"]
  ];

  db.products.forEach(p => {
    const costUzs = Math.round((p.costUsd || 0) * rate);
    if (p.variants && p.variants.length) {
      p.variants.forEach(v => {
        const margin = p.ulgurjiNarx > 0 && costUzs > 0
          ? Math.round((p.ulgurjiNarx - costUzs) / p.ulgurjiNarx * 100) : "";
        rows.push([
          p.sku, p.name, p.category, p.type === "oyoq" ? "Oyoq kiyim" : "Kiyim",
          p.unit || "dona", p.inBox || 1,
          p.barcode || "",
          v.color, v.pantone || "", v.size, v.qty,
          p.costUsd || 0, costUzs,
          p.ulgurjiNarx || 0, margin
        ]);
      });
    } else {
      rows.push([p.sku, p.name, p.category, "", p.unit||"dona", p.inBox||1,
        p.barcode||"", "", "", "", 0, p.costUsd||0, costUzs, p.ulgurjiNarx||0, ""]);
    }
  });

  downloadCSV(rows, `merx_katalog_${today()}.csv`);
  toast("Katalog Excel yuklab olindi");
}

// ── CSV yuklab olish ───────────────────────────
// downloadCSV — utils.js da aniqlangan (global)

// ── Tovar rasmi funksiyalari ───────────────────
function epLoadImage(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast("Rasm 5MB dan kichik bo'lishi kerak","err"); return; }

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // 400x400 ga siqish
      const MAX = 400;
      let w = img.width, h = img.height;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
      else       { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }

      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);

      // Sifatni kamaytirish (300KB gacha)
      let q = 0.82, dataUrl;
      do { dataUrl = canvas.toDataURL("image/jpeg", q); q -= 0.08; }
      while (dataUrl.length > 400000 && q > 0.25);

      // UI yangilash
      if ($("ep-img-preview"))     { $("ep-img-preview").src = dataUrl; $("ep-img-preview").style.display = "block"; }
      if ($("ep-img-placeholder")) $("ep-img-placeholder").style.display = "none";
      if ($("ep-img-remove"))      $("ep-img-remove").style.display = "";
      if ($("ep-image"))           $("ep-image").value = dataUrl;

      const kb = Math.round(dataUrl.length * 0.75 / 1024);
      toast(`✅ Rasm yuklandi (${kb}KB)`);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function epRemoveImage() {
  if ($("ep-image"))           $("ep-image").value = "";
  if ($("ep-img-preview"))     { $("ep-img-preview").src = ""; $("ep-img-preview").style.display = "none"; }
  if ($("ep-img-placeholder")) $("ep-img-placeholder").style.display = "flex";
  if ($("ep-img-remove"))      $("ep-img-remove").style.display = "none";
  if ($("ep-img-input"))       $("ep-img-input").value = "";
}

// ── Karobka narx hintlari ─────────────────────
function _showBoxHint(hintId, donaUzs, inBox) {
  const el = $(hintId); if (!el) return;
  if (!donaUzs || donaUzs <= 0 || !inBox || inBox < 2) { el.style.display = "none"; return; }
  const total = donaUzs * inBox;
  const span  = el.querySelector("span");
  if (span) span.textContent = `1 karobka = ${fmt(total)} so'm (${inBox} × ${fmt(donaUzs)})`;
  el.style.display = "inline-flex";
}

function apUpdateBoxHints() {
  const rate  = db.settings.rate || 12800;
  const inBox = parseInt(($("ap-inbox")||{value:0}).value) ||
                parseInt(($("ap-inbox-calc")||{value:0}).value) || 0;
  const costUsd = parseFloat(($("ap-cost")||{value:0}).value) || 0;
  const ulg     = getRawVal("ap-ulgurji");
  _showBoxHint("ap-cost-hint", Math.round(costUsd * rate), inBox);
  _showBoxHint("ap-ulg-hint",  ulg, inBox);
}

function epUpdateBoxHints() {
  const rate  = db.settings.rate || 12800;
  const inBox = parseInt(($("ep-inbox")||{value:0}).value) || 0;
  const costUsd = parseFloat(($("ep-cost")||{value:0}).value) || 0;
  const ulg     = getRawVal("ep-ulgurji");
  _showBoxHint("ep-cost-hint", Math.round(costUsd * rate), inBox);
  _showBoxHint("ep-ulg-hint",  ulg, inBox);
}

// ── Tannarx valyutasini yangilash ─────────────────
function updateCostCurrency() {
  const cur  = db.settings?.priceCurrency || "uzs";
  const rate = db.settings?.rate || 12800;
  const isUsd  = cur === "usd";
  const isBoth = cur === "both";

  // Label va unit lar
  const configs = [
    ["ap-cost-lbl", "ap-cost-unit", "ap-cost"],
    ["ep-cost-lbl", "ep-cost-unit", "ep-cost"],
    ["qb-cost-lbl", "qb-cost-unit", "qb-cost"],
  ];

  configs.forEach(([lblId, unitId, inputId]) => {
    const lbl  = $(lblId);
    const unit = $(unitId);
    const inp  = $(inputId);
    if (!lbl || !unit) return;

    if (isUsd) {
      lbl.textContent  = "Tannarx (USD)";
      unit.textContent = "USD";
      unit.style.color = "#4C9BE8";
      if (inp) inp.step = "0.5";
    } else if (isBoth) {
      lbl.textContent  = "Tannarx (USD yoki so'm)";
      unit.textContent = "USD/so'm";
      unit.style.color = "#856404";
    } else {
      // UZS
      lbl.textContent  = "Tannarx (so'm)";
      unit.textContent = "so'm";
      unit.style.color = "#888";
      if (inp) inp.step = "1000";
    }
  });
}

// ================================================
// EXCEL / CSV IMPORT
// ================================================

let _importRows = [];

function openKatalogImport() {
  _importRows = [];
  const prev = $("import-preview"); if (prev) prev.style.display = "none";
  const res  = $("import-result");  if (res)  res.style.display  = "none";
  const btn  = $("import-confirm-btn"); if (btn) btn.disabled = true;
  if ($("import-file")) $("import-file").value = "";
  openModal("import");
}

// ── Shablon yuklash ───────────────────────────────
function downloadImportTemplate() {
  const headers = ["Nom","Kategoriya","Turi (oyoq/kiyim)","Birlik",
    "Karobkada nechta","Barcode","Rang","Pantone kodi","O'lcham",
    "Qoldiq","Tannarx (USD)","Ulgurji narx (so'm)"];
  const rows = [
    ["Nike Air Max","Krossovka","oyoq","juft","8","'8600000000001","Qora","PMS Black C","39-44","48","25","380000"],
    ["Nike Air Max","Krossovka","oyoq","juft","8","'8600000000001","Oq","PMS White","39-44","24","25","380000"],
    ["Erkaklar ko'ylagi","Ko'ylak","kiyim","dona","12","","Ko'k","PMS 286 C","S-XL","60","8","150000"],
  ];
  // sep=; — Excel ga delimiter bildiradi, BOM kerak emas
  const csv = "sep=;\r\n" + [headers, ...rows].map(r =>
    r.map(c => { const s=String(c); return s.includes(";")||s.includes(",") ? `"${s}"` : s; }).join(";")
  ).join("\r\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download="merx_import_shablon.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Fayl tanlash ──────────────────────────────────
function handleImportDrop(event) {
  const file = event.dataTransfer?.files?.[0];
  if (file) processImportFile(file);
}

function handleImportFile(input) {
  const file = input.files?.[0];
  if (file) processImportFile(file);
}

function processImportFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseImportCSV(text);
  };
  // UTF-8 BOM ni qo'llab-quvvatlash
  reader.readAsText(file, "UTF-8");
}

// ── CSV parse ─────────────────────────────────────
function parseImportCSV(text) {
  // BOM ni olib tashlash
  const clean = text.replace(/^\uFEFF/, "").trim();
  const allLines = clean.split(/\r?\n/).filter(l => l.trim());
  // sep= satrini o'tkazib yuborish
  const lines = allLines.filter(l => !l.startsWith("sep="));
  if (lines.length < 2) { toast("Fayl bo'sh yoki noto'g'ri format","err"); return; }

  // Avtomatic delimiter aniqlash
  const delim = lines[0].includes(";") ? ";" : ",";

  function parseLine(line) {
    const result = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === delim && !inQ) { result.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    result.push(cur.trim());
    return result;
  }

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g,"").trim());
  _importRows = [];

  // Ustun mapping
  const col = (name) => {
    const variants = {
      nom: ["nom","name","nomi","mahsulot"],
      cat: ["kategoriya","category","kat"],
      type: ["turi","type","tur"],
      unit: ["birlik","unit","o'lchov"],
      inbox: ["karobkada nechta","inbox","karobka","qutida nechta"],
      barcode: ["barcode","ean","barkod"],
      color: ["rang","color","rang nomi"],
      pantone: ["pantone","pantone kodi"],
      size: ["o'lcham","size","olcham","razmer"],
      qty: ["qoldiq","qty","miqdor","soni"],
      cost: ["tannarx","cost","tannarx (usd)","narx usd"],
      ulg: ["ulgurji","ulgurji narx","ulgurji narx (so'm)","sotuv narxi"],
    };
    const keys = variants[name] || [];
    for (const k of keys) {
      const idx = headers.findIndex(h => h.includes(k));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const cols = {
    nom:     col("nom"),
    cat:     col("cat"),
    type:    col("type"),
    unit:    col("unit"),
    inbox:   col("inbox"),
    barcode: col("barcode"),
    color:   col("color"),
    pantone: col("pantone"),
    size:    col("size"),
    qty:     col("qty"),
    cost:    col("cost"),
    ulg:     col("ulg"),
  };

  if (cols.nom < 0) { toast("'Nom' ustuni topilmadi","err"); return; }

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const nom  = vals[cols.nom]?.trim();
    if (!nom) continue;

    _importRows.push({
      nom,
      cat:     cols.cat >= 0     ? vals[cols.cat]?.trim()          : "Qabul qilingan",
      type:    cols.type >= 0    ? vals[cols.type]?.trim()         : "oyoq",
      unit:    cols.unit >= 0    ? vals[cols.unit]?.trim()         : "dona",
      inbox:   cols.inbox >= 0   ? (parseInt(vals[cols.inbox])||1) : 1,
      barcode: cols.barcode >= 0 ? vals[cols.barcode]?.trim().replace(/^'/,"") : "",
      color:   cols.color >= 0   ? vals[cols.color]?.trim()        : "Standart",
      pantone: cols.pantone >= 0 ? vals[cols.pantone]?.trim()      : "",
      size:    cols.size >= 0    ? vals[cols.size]?.trim()         : "Aralash",
      qty:     cols.qty >= 0     ? (parseInt(vals[cols.qty])||0)   : 0,
      cost:    cols.cost >= 0    ? (parseFloat(vals[cols.cost])||0): 0,
      ulg:     cols.ulg >= 0     ? (parseFloat((vals[cols.ulg]||"0").replace(/\s/g,"").replace(/,/g,""))||0) : 0,
    });
  }

  showImportPreview();
}

// ── Preview ───────────────────────────────────────
function showImportPreview() {
  if (!_importRows.length) { toast("Qatorlar topilmadi","err"); return; }

  const prev = $("import-preview"); if (prev) prev.style.display = "block";
  const lbl  = $("import-preview-lbl");
  if (lbl) lbl.textContent = `${_importRows.length} ta qator topildi — birinchi 5 tasi:`;

  const head = $("import-preview-head");
  if (head) head.innerHTML = `<tr>${["Nom","Rang","O'lcham","Qoldiq","Tannarx","Ulgurji"].map(h =>
    `<th style="padding:6px 10px;font-weight:700;text-align:left;white-space:nowrap">${h}</th>`).join("")}</tr>`;

  const body = $("import-preview-body");
  if (body) body.innerHTML = _importRows.slice(0,5).map(r => `<tr>
    <td style="padding:5px 10px;border-top:1px solid var(--brd)">${r.nom}</td>
    <td style="padding:5px 10px;border-top:1px solid var(--brd)">${r.color}</td>
    <td style="padding:5px 10px;border-top:1px solid var(--brd)">${r.size}</td>
    <td style="padding:5px 10px;border-top:1px solid var(--brd)">${r.qty}</td>
    <td style="padding:5px 10px;border-top:1px solid var(--brd)">$${r.cost}</td>
    <td style="padding:5px 10px;border-top:1px solid var(--brd)">${fmt(r.ulg)} so'm</td>
  </tr>`).join("");

  const btn = $("import-confirm-btn");
  if (btn) btn.disabled = false;
}

// ── Import tasdiqlash ─────────────────────────────
function confirmImport() {
  if (!_importRows.length) return;
  const skipDup = $("import-skip-dup")?.checked ?? true;
  const rate    = db.settings?.rate || 12800;

  let added = 0, updated = 0, skipped = 0;

  _importRows.forEach(r => {
    // Mavjud mahsulotni topish
    let p = db.products.find(x => x.name.toLowerCase() === r.nom.toLowerCase());

    if (p) {
      // Mavjud mahsulotga variant qo'shish
      const ex = p.variants.find(v =>
        v.color.toLowerCase() === r.color.toLowerCase() &&
        v.size === r.size
      );
      if (ex) {
        if (!skipDup) { ex.qty += r.qty; updated++; }
        else skipped++;
      } else {
        p.variants.push({ color: r.color, size: r.size, qty: r.qty, pantone: r.pantone, hex: "#888888" });
        // Narxlarni yangilash
        if (r.cost > 0) p.costUsd     = r.cost;
        if (r.ulg  > 0) p.ulgurjiNarx = r.ulg;
        updated++;
      }
    } else {
      // Yangi mahsulot
      const sku = `IMP-${String(db.seq++).padStart(4,"0")}`;
      db.products.push({
        sku,
        name:        r.nom,
        category:    r.cat,
        type:        r.type === "kiyim" ? "kiyim" : "oyoq",
        unit:        r.unit || "dona",
        inBox:       r.inbox || 1,
        barcode:     r.barcode || genEAN13(db.seq),
        costUsd:     r.cost,
        priceUzs:    0,
        ulgurjiNarx: r.ulg,
        variants:    [{ color: r.color, size: r.size, qty: r.qty, pantone: r.pantone, hex: "#888888" }]
      });
      added++;
    }
  });

  saveDB(); renderKatalog(); closeModal("import");

  const res = $("import-result");
  if (res) { res.style.display = "block"; }
  toast(`✅ Import tugadi: ${added} ta yangi, ${updated} ta yangilandi, ${skipped} ta o'tkazildi`);
}
