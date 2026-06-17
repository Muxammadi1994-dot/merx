// MERX katalog.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/katalog.js  (v3 — Pantone + Yangi dizayn)
// ================================================

let editSku = null;
let katLowFilter = false;
let katCatFilter = "all"; // "all" | "oyoq" | "kiyim" | category name
let katSortBy      = null;
let katSortAsc     = true;
let _katSelected   = new Set(); // tanlangan SKU lar

// ── Kategoriya filtri ──────────────────────────
function setKatCat(c) {
  katCatFilter = c;
  document.querySelectorAll(".kat-cat-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.c === c));
  renderKatalog();
}

// ── Ommaviy tanlash ──────────────────────────────
function katToggleSel(sku, checked) {
  if (checked) _katSelected.add(sku);
  else _katSelected.delete(sku);
  updateKatSelBar();
  // Faqat qatorni rang o'zgartir (to'liq render emas)
  const rows = document.querySelectorAll("#kat-body tr");
  rows.forEach(row => {
    const cb = row.querySelector("input[type=checkbox]");
    if (cb) row.style.background = cb.checked ? "#fffbf0" : "";
  });
}

function katSelectAll() {
  const visible = document.querySelectorAll("#kat-body input[type=checkbox]");
  visible.forEach(cb => {
    cb.checked = true;
    _katSelected.add(cb.getAttribute("onchange").match(/'([^']+)'/)[1]);
    cb.closest("tr").style.background = "#fffbf0";
  });
  updateKatSelBar();
}

function katClearSel() {
  _katSelected.clear();
  document.querySelectorAll("#kat-body input[type=checkbox]").forEach(cb => {
    cb.checked = false;
    cb.closest("tr").style.background = "";
  });
  updateKatSelBar();
}

function updateKatSelBar() {
  const bar = document.getElementById("kat-sel-bar");
  const cnt = document.getElementById("kat-sel-cnt");
  if (!bar) return;
  if (_katSelected.size > 0) {
    bar.style.display = "flex";
    if (cnt) cnt.textContent = _katSelected.size + " ta tanlandi";
  } else {
    bar.style.display = "none";
  }
}

function openBulkPrice() {
  if (_katSelected.size === 0) { toast("Avval mahsulot tanlang","err"); return; }
  const cntEl = document.getElementById("bulk-sel-cnt");
  if (cntEl) cntEl.textContent = _katSelected.size;
  if (document.getElementById("bulk-pct"))   document.getElementById("bulk-pct").value   = "10";
  if (document.getElementById("bulk-type"))  document.getElementById("bulk-type").value  = "chegirma";
  if (document.getElementById("bulk-field")) document.getElementById("bulk-field").value = "chakana";
  openModal("bulkprice");
  updateBulkPreview();
}

function updateBulkPreview() {
  const pct  = parseFloat(document.getElementById("bulk-pct")?.value) || 0;
  const type = document.getElementById("bulk-type")?.value || "chegirma";
  const base = 400000;
  const result = type === "chegirma"
    ? Math.round(base * (1 - pct/100) / 1000) * 1000
    : Math.round(base * (1 + pct/100) / 1000) * 1000;
  const diff = result - base;
  const valEl = document.getElementById("bulk-preview-val");
  const pctEl = document.getElementById("bulk-preview-pct");
  if (valEl) {
    valEl.textContent = fmt(result) + " so'm";
    valEl.style.color = type === "chegirma" ? "var(--grn)" : "#E9A500";
  }
  if (pctEl) pctEl.textContent = (diff > 0 ? "+" : "") + diff.toLocaleString() + " so'm";
}

function applyBulkPrice() {
  const pct   = parseFloat(document.getElementById("bulk-pct")?.value) || 0;
  const type  = document.getElementById("bulk-type")?.value  || "chegirma";
  const field = document.getElementById("bulk-field")?.value || "chakana";

  if (pct <= 0 || pct > 100) { toast("0 dan 100 gacha foiz kiriting","err"); return; }

  const rate     = db.settings?.rate || 12800;
  const isUsd    = db.settings?.priceCurrency === "usd";
  let   changed  = 0;

  _katSelected.forEach(sku => {
    const p = db.products.find(x => x.sku === sku); if (!p) return;

    const multiply = type === "chegirma"
      ? (1 - pct / 100)
      : (1 + pct / 100);

    if (field === "chakana" || field === "ikkalasi") {
      p.priceUzs = Math.round((p.priceUzs || 0) * multiply / 1000) * 1000;
    }
    if (field === "ulgurji" || field === "ikkalasi") {
      p.ulgurjiNarx = Math.round((p.ulgurjiNarx || 0) * multiply / 1000) * 1000;
    }
    changed++;
  });

  saveDB();
  closeModal("bulkprice");
  katClearSel();
  renderKatalog();

  const typeText = type === "chegirma" ? `−${pct}% chegirma` : `+${pct}% oshirma`;
  const fieldText = { chakana:"chakana", ulgurji:"ulgurji", ikkalasi:"ikkalasi" }[field];
  toast(`✅ ${changed} ta mahsulot ${fieldText} narxi ${typeText} qilindi`);
}

function katSortToggle(key) {
  if (katSortBy === key) {
    katSortAsc = !katSortAsc;
  } else {
    katSortBy  = key;
    katSortAsc = key === "name"; // nom: A→Z, boshqalar: kattadan kichikka
  }
  // Tugma ko'rinishini yangilash
  document.querySelectorAll(".kat-sort-btn").forEach(b => {
    b.style.background  = "";
    b.style.color       = "";
    b.style.borderColor = "";
  });
  const ids = { name:"kat-sort-name", qty:"kat-sort-qty", price:"kat-sort-price" };
  const btn = document.getElementById(ids[key]);
  if (btn) {
    btn.style.background  = "#0D1B2A";
    btn.style.color       = "#fff";
    btn.style.borderColor = "#0D1B2A";
    // O'q ikonini yangilaymiz
    const ico = btn.querySelector("i");
    if (ico) {
      if (key === "name") {
        ico.className = katSortAsc ? "ti ti-sort-az" : "ti ti-sort-za";
      } else {
        ico.className = katSortAsc ? "ti ti-sort-ascending-2" : "ti ti-sort-descending-2";
      }
    }
  }
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
    (p.art && p.art.toLowerCase().includes(q)) ||
    (p.barcode && p.barcode.toLowerCase().includes(q)) ||
    p.category.toLowerCase().includes(q)
  );
  if (katLowFilter) ps = ps.filter(p => totalStock(p) <= 5);
  if (katCatFilter === "oyoq")  ps = ps.filter(p => p.type === "oyoq");
  else if (katCatFilter === "kiyim") ps = ps.filter(p => p.type === "kiyim");
  else if (katCatFilter !== "all")   ps = ps.filter(p => p.category === katCatFilter);

  // Saralash
  if (katSortBy) {
    const rate = db.settings.rate || 12800;
    ps.sort((a, b) => {
      let va, vb;
      if (katSortBy === "name")  { va = a.name;         vb = b.name; }
      if (katSortBy === "qty")   { va = totalStock(a);  vb = totalStock(b); }
      if (katSortBy === "price") { va = a.ulgurjiNarx || (a.costUsd||0)*rate;
                                   vb = b.ulgurjiNarx || (b.costUsd||0)*rate; }
      if (typeof va === "string") return katSortAsc ? va.localeCompare(vb,"uz") : vb.localeCompare(va,"uz");
      return katSortAsc ? va - vb : vb - va;
    });
  }

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
    const totalBoxes = inBox > 1 ? Math.floor(st / inBox) : null;

    // Margin (ulgurji asosida)
    const margin = p.ulgurjiNarx > 0 && costUzs > 0
      ? Math.round((p.ulgurjiNarx - costUzs) / p.ulgurjiNarx * 100) : null;
    const mColor = margin == null ? "#ccc"
      : margin >= 30 ? "var(--grn)" : margin >= 15 ? "#E07B39" : "var(--red)";

    const isSel = _katSelected.has(p.sku);
    return `<tr onclick="openEditProduct('${p.sku}')" style="cursor:pointer;background:${isSel?"#fffbf0":""}">
      <td style="width:28px;padding:8px 4px" onclick="event.stopPropagation()">
        <input type="checkbox" ${isSel?"checked":""} onchange="katToggleSel('${p.sku}',this.checked)"
          style="width:16px;height:16px;accent-color:var(--acc);cursor:pointer">
      </td>
      <td onclick="event.stopPropagation()">
        <div style="position:relative;display:inline-block">
          ${p.image
            ? `<img src="${p.image}" class="kat-thumb" style="cursor:pointer"
                onclick="katImgClick('${p.sku}')"
                title="Rasmni o'zgartirish">`
            : `<div class="kat-thumb-empty" style="cursor:pointer"
                onclick="katImgClick('${p.sku}')"
                title="Rasm qo'shish">
                <i class="ti ti-camera-plus" style="font-size:16px"></i>
              </div>`}
        </div>
        <input type="file" id="kat-img-inp-${p.sku}" accept="image/*" style="display:none"
          onchange="katImgSave('${p.sku}',this)">
      </td>
      <td style="font-family:monospace;font-size:11px;color:var(--mut)">${p.sku}</td>
      <td style="font-family:monospace;font-size:12px;font-weight:700;color:#0D1B2A">${p.art || '<span style="color:#ddd">—</span>'}</td>
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
          ? `<span style="font-weight:700;font-size:14px">${totalBoxes}</span>
             <span style="font-size:10.5px;color:#bbb;margin-left:3px">karobka</span>`
          : `<span style="color:#bbb;font-size:12px">donab</span>`}
      </td>
      <td class="num">
        <span class="bg ${st<=0?"bg-r":st<=5?"bg-a":"bg-g"}" style="font-weight:700">
          ${st} ${p.unit||"dona"}
        </span>
      </td>
      <td class="num" style="font-size:12.5px">
        ${costUzs ? `<div style="font-weight:600">${priceDisplay(costUzs)}</div>` : "—"}
        ${costUzs && inBox > 1 ? `<div style="font-size:11px;color:#856404;margin-top:2px">📦 ${priceDisplay(costUzs * inBox)}</div>` : ""}
        ${p.costUsd && (db.settings?.priceCurrency||"uzs")==="uzs" ? `<div style="font-size:10.5px;color:#bbb">$${(+p.costUsd).toFixed(2)}</div>` : ""}
      </td>
      <td class="num" style="font-size:12.5px">
        ${p.ulgurjiNarx ? `<div style="font-weight:700;color:var(--acc)">${priceDisplay(p.ulgurjiNarx)}</div>` : '<span style="color:#ccc">—</span>'}
        ${p.ulgurjiNarx && inBox > 1 ? `<div style="font-size:11px;color:#e9a500;margin-top:2px">📦 ${priceDisplay(p.ulgurjiNarx * inBox)}</div>` : ""}
        ${margin != null ? `<div style="font-size:10px;color:${mColor}">margin ${margin}%</div>` : ""}
      </td>
      ${showChakana ? `<td class="num" style="color:var(--teal);font-size:12.5px">${p.priceUzs ? fmt(p.priceUzs)+" so'm" : "—"}</td>` : ""}
      <td onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="duplicateProduct('${p.sku}',event)"
          title="Nusxalash" style="color:#8B5CF6">
          <i class="ti ti-copy"></i>
        </button>
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
// ── Mahsulot nusxalash ───────────────────────────
function duplicateProduct(sku, event) {
  if (event) event.stopPropagation();
  const p = db.products.find(x => x.sku === sku);
  if (!p) return;

  // Yangi SKU yaratamiz
  const newSku = p.sku + "-copy-" + Date.now().toString().slice(-4);

  const copy = JSON.parse(JSON.stringify(p)); // deep copy
  copy.sku  = newSku;
  copy.name = p.name + " (nusxa)";
  copy.barcode = genEAN13 ? genEAN13(db.seq++) : "";
  // Variantlar qoldig'ini 0 qilamiz
  copy.variants = copy.variants.map(v => ({ ...v, qty: 0 }));

  db.products.push(copy);
  db.seq = (db.seq || 1) + 1;
  saveDB();
  renderKatalog();
  toast(`✅ "${p.name}" nusxalandi — tahrirlashingiz mumkin`);

  // Nusxani darhol ochib beramiz
  setTimeout(() => openEditProduct(newSku), 300);
}

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
  if ($("ep-art"))     $("ep-art").value     = p.art     || "";
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
  if ($("ep-art"))     p.art     = $("ep-art").value.trim();
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
  const costRaw = parseFloat(($("ap-cost")||{value:0}).value.replace(/\s/g,"")) || 0;
  const cur1    = db.settings?.priceCurrency || "uzs";
  const rate1   = db.settings?.rate || 12800;
  // Har doim USD da saqlaymiz
  const cost    = (cur1 === "usd" || cur1 === "both") ? costRaw : costRaw / rate1;
  const price   = parseFloat(($("ap-price")||{value:0}).value)   || 0;
  const ulg     = getRawVal("ap-ulgurji");
  const unit    = ($("ap-unit")||{value:"dona"}).value;
  const pantone = ($("ap-pantone")||{value:""}).value.trim();
  const hex     = ($("ap-hex")||{value:"#888888"}).value;
  const art     = ($("ap-art")||{value:""}).value.trim();
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
    if (art) p.art = art;
    if (barcode && !p.barcode) p.barcode = barcode;
  } else {
    const autoBarcode = barcode || genEAN13(db.seq);
    db.products.push({
      sku: `${t==="oyoq"?"SHOE":"CLTH"}-${String(db.seq++).padStart(3,"0")}`,
      name, category: ($("ap-cat")||{value:""}).value,
      type:t, unit, inBox,
      art: art || "",
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
  if ($("ap-art"))        $("ap-art").value         = "";
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
    ["SKU", "ART", "Nomi", "Kategoriya", "Turi", "Birlik", "Karobka (inBox)",
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
          p.sku, p.art || "", p.name, p.category, p.type === "oyoq" ? "Oyoq kiyim" : "Kiyim",
          p.unit || "dona", p.inBox || 1,
          p.barcode || "",
          v.color, v.pantone || "", v.size, v.qty,
          p.costUsd || 0, costUzs,
          p.ulgurjiNarx || 0, margin
        ]);
      });
    } else {
      rows.push([p.sku, p.name, p.category, "", p.unit||"dona", p.inBox||1,
        p.art||"", p.barcode||"", "", "", "", 0, p.costUsd||0, costUzs, p.ulgurjiNarx||0, ""]);
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
  const rate   = db.settings?.rate || 12800;
  const cur    = db.settings?.priceCurrency || "uzs";
  const inBox  = parseInt(($("ap-inbox")||{value:0}).value) ||
                 parseInt(($("ap-inbox-calc")||{value:0}).value) || 0;
  const costRaw = parseFloat(($("ap-cost")||{value:0}).value.replace(/\s/g,"").replace(/,/g,"")) || 0;
  // USD rejimida → UZS ga o'giramiz; so'm rejimida → to'g'ridan
  const costUzs = (cur === "usd" || cur === "both") ? Math.round(costRaw * rate) : costRaw;
  const ulg     = getRawVal("ap-ulgurji");
  _showBoxHint("ap-cost-hint", costUzs, inBox);
  _showBoxHint("ap-ulg-hint",  ulg, inBox);
}

function epUpdateBoxHints() {
  const rate    = db.settings?.rate || 12800;
  const cur     = db.settings?.priceCurrency || "uzs";
  const inBox   = parseInt(($("ep-inbox")||{value:0}).value) || 0;
  const costRaw = parseFloat(($("ep-cost")||{value:0}).value.replace(/\s/g,"").replace(/,/g,"")) || 0;
  const costUzs = (cur === "usd" || cur === "both") ? Math.round(costRaw * rate) : costRaw;
  const ulg     = getRawVal("ep-ulgurji");
  _showBoxHint("ep-cost-hint", costUzs, inBox);
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
    "Karobkada nechta","ART","Barcode","Rang","Pantone kodi","O'lcham",
    "Qoldiq","Tannarx (USD)","Ulgurji narx (so'm)"];
  const rows = [
    ["Nike Air Max","Krossovka","oyoq","juft","8","AM-001","'8600000000001","Qora","PMS Black C","39-44","48","25","380000"],
    ["Nike Air Max","Krossovka","oyoq","juft","8","AM-001","'8600000000001","Oq","PMS White","39-44","24","25","380000"],
    ["Erkaklar ko'ylagi","Ko'ylak","kiyim","dona","12","EK-2025","","Ko'k","PMS 286 C","S-XL","60","8","150000"],
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
      art:     ["art","artikul","article","kod"],
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
      art:     cols.art     >= 0 ? vals[cols.art]?.trim()     : "",
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
        art:         r.art || "",
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

// ════════════════════════════════════════════════
// NARXNOMA / YORLIQ CHOP ETISH
// ════════════════════════════════════════════════

let _narxnomaSelected = new Set();

function openNarxnoma() {
  _narxnomaSelected.clear();
  const ovEl = document.getElementById("ov-narxnoma");
  if (ovEl) ovEl.classList.add("on");
  setTimeout(() => {
    renderNarxnomaList();
    renderNarxnomaPreview();
  }, 30);
}

function renderNarxnomaList() {
  const el = document.getElementById("nm-list");
  if (!el) return;
  const q = (document.getElementById("nm-q")||{value:""}).value.toLowerCase();
  const ps = db.products.filter(p =>
    !q || p.name.toLowerCase().includes(q) || (p.sku||"").toLowerCase().includes(q)
  );
  el.innerHTML = ps.map(p => {
    const st  = totalStock(p);
    const sel = _narxnomaSelected.has(p.sku);
    return `<label class="nm-prod-item ${sel?"nm-sel":""}" onclick="toggleNmProd('${p.sku}')">
      <div class="nm-check">${sel?"✓":""}</div>
      <div class="nm-prod-info">
        <div class="nm-prod-name">${p.name}</div>
        <div class="nm-prod-meta">${p.category} · ${st} ${p.unit||"dona"} · ${fmt(p.priceUzs)} so'm</div>
      </div>
      <div class="nm-prod-right">${p.variants.length} rang/o'lcham</div>
    </label>`;
  }).join("") || `<div style="text-align:center;padding:20px;color:var(--mut)">Mahsulot yo'q</div>`;
  updateNmCount();
}

function toggleNmProd(sku) {
  if (_narxnomaSelected.has(sku)) _narxnomaSelected.delete(sku);
  else _narxnomaSelected.add(sku);
  renderNarxnomaList();
  renderNarxnomaPreview();
}

function nmSelectAll() {
  const q = (document.getElementById("nm-q")||{value:""}).value.toLowerCase();
  db.products.filter(p => !q || p.name.toLowerCase().includes(q))
    .forEach(p => _narxnomaSelected.add(p.sku));
  renderNarxnomaList();
  renderNarxnomaPreview();
}

function nmClearAll() {
  _narxnomaSelected.clear();
  renderNarxnomaList();
  renderNarxnomaPreview();
}

function updateNmCount() {
  const el = document.getElementById("nm-count");
  if (el) el.textContent = _narxnomaSelected.size + " ta tanlandi";
}

function renderNarxnomaPreview() {
  const el = document.getElementById("nm-preview-area");
  if (!el) return;
  const style    = document.getElementById("nm-style")?.value || "standard";
  const showLogo = document.getElementById("nm-logo")?.checked !== false;
  const showBarc = document.getElementById("nm-barcode-chk")?.checked !== false;
  const showSku  = document.getElementById("nm-sku")?.checked || false;
  const showUlg  = document.getElementById("nm-ulg")?.checked || false;
  const cols     = parseInt(document.getElementById("nm-cols")?.value) || 3;
  const rate     = db.settings.rate || 12800;
  const shopName = db.shop?.name || "MERX";

  const prods = db.products.filter(p => _narxnomaSelected.has(p.sku));
  if (!prods.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--mut)">
      <i class="ti ti-tag" style="font-size:32px;display:block;margin-bottom:10px;opacity:.4"></i>
      Chap tomondan mahsulot tanlang</div>`;
    return;
  }

  const labels = [];
  prods.forEach(p => {
    p.variants.forEach(v => {
      if ((v.qty||0) <= 0) return;
      labels.push({p, v});
    });
  });

  if (!labels.length) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:#E05A5A">Qoldiq yo'q (0 ta)</div>`;
    return;
  }

  el.innerHTML = `<div class="nm-label-grid" style="grid-template-columns:repeat(${cols},1fr)">
    ${labels.map(({p,v}) => buildLabel(p, v, {style,showLogo,showBarc,showSku,showUlg,shopName,rate})).join("")}
  </div>`;
}

function buildLabel(p, v, opts) {
  const {style, showLogo, showBarc, showSku, showUlg, shopName, rate} = opts;
  const hex       = v.hex || "#888";
  const colorDot  = `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${hex};border:1px solid rgba(0,0,0,.12);vertical-align:middle;margin-right:4px"></span>`;
  const priceUzs  = p.priceUzs || 0;
  const ulgUzs    = p.ulgurjiNarx || 0;
  const priceUsd  = rate > 0 ? (priceUzs / rate).toFixed(2) : "0.00";
  const barcodeHtml = showBarc && p.barcode
    ? `<div class="nm-barcode"><div class="nm-barcode-num">${p.barcode}</div></div>` : "";

  if (style === "mini") return `
    <div class="nm-label nm-mini">
      ${showLogo?`<div class="nm-shop">${shopName}</div>`:""}
      <div class="nm-name-sm">${p.name}</div>
      <div class="nm-var-sm">${colorDot}${v.color||""} ${v.size?"· "+v.size:""}</div>
      <div class="nm-price-main">${fmt(priceUzs)} so'm</div>
      ${barcodeHtml}
    </div>`;

  if (style === "premium") return `
    <div class="nm-label nm-premium">
      <div class="nm-prem-top">
        ${showLogo?`<div class="nm-prem-shop">${shopName}</div>`:""}
        <div class="nm-prem-name">${p.name}</div>
        <div class="nm-prem-cat">${p.category}</div>
      </div>
      <div class="nm-prem-mid">
        <div class="nm-prem-color">${colorDot}${v.color||""}${v.size?" · "+v.size:""}</div>
        ${showSku?`<div class="nm-prem-sku">${p.sku}</div>`:""}
      </div>
      <div class="nm-prem-bot">
        <div class="nm-prem-price">${fmt(priceUzs)} <span>so'm</span></div>
        ${showUlg&&ulgUzs?`<div class="nm-prem-ulg">Ulgurji: ${fmt(ulgUzs)} so'm</div>`:""}
        <div class="nm-prem-usd">≈ $${priceUsd}</div>
      </div>
      ${barcodeHtml}
    </div>`;

  return `
    <div class="nm-label nm-standard">
      ${showLogo?`<div class="nm-shop">${shopName}</div>`:""}
      <div class="nm-name">${p.name}</div>
      <div class="nm-var">${colorDot}${v.color||""} ${v.size?"· "+v.size:""}</div>
      <div class="nm-prices">
        <div class="nm-price-main">${fmt(priceUzs)} so'm</div>
        ${showUlg&&ulgUzs?`<div class="nm-price-ulg">Ulgurji: ${fmt(ulgUzs)}</div>`:""}
        <div class="nm-price-usd">$${priceUsd}</div>
      </div>
      ${showSku?`<div class="nm-sku">${p.sku}</div>`:""}
      ${barcodeHtml}
    </div>`;
}

function printNarxnoma() {
  const style    = document.getElementById("nm-style")?.value || "standard";
  const showLogo = document.getElementById("nm-logo")?.checked !== false;
  const showBarc = document.getElementById("nm-barcode-chk")?.checked !== false;
  const showSku  = document.getElementById("nm-sku")?.checked || false;
  const showUlg  = document.getElementById("nm-ulg")?.checked || false;
  const cols     = parseInt(document.getElementById("nm-cols")?.value) || 3;
  const rate     = db.settings.rate || 12800;
  const shopName = db.shop?.name || "MERX";

  const prods = db.products.filter(p => _narxnomaSelected.has(p.sku));
  if (!prods.length) { toast("Mahsulot tanlang","err"); return; }

  const labels = [];
  prods.forEach(p => { p.variants.forEach(v => labels.push({p,v})); });

  const labelHtml = labels.map(({p,v}) =>
    buildLabel(p, v, {style,showLogo,showBarc,showSku,showUlg,shopName,rate})
  ).join("");

  const w = window.open("","_blank","width=900,height=700");
  if (!w) { toast("Pop-up bloklangan","err"); return; }

  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Narxnoma — ${shopName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;background:#fff}
.nm-label-grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;padding:8px}
.nm-standard{border:1px solid #ddd;border-radius:6px;padding:8px;background:#fff;break-inside:avoid}
.nm-mini{border:1px solid #eee;border-radius:4px;padding:6px;background:#fff;break-inside:avoid}
.nm-premium{border:2px solid #0D1B2A;border-radius:8px;overflow:hidden;break-inside:avoid}
.nm-shop{font-size:9px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
.nm-name{font-size:12px;font-weight:700;color:#111;margin-bottom:3px}
.nm-var{font-size:10px;color:#666;margin-bottom:5px}
.nm-price-main{font-size:15px;font-weight:800;color:#0D1B2A}
.nm-price-ulg{font-size:10px;color:#888}
.nm-price-usd{font-size:10px;color:#666}
.nm-sku{font-size:9px;color:#bbb;font-family:monospace}
.nm-barcode-num{font-size:8px;font-family:monospace;color:#555;letter-spacing:1px;text-align:center;margin-top:4px}
.nm-name-sm{font-size:11px;font-weight:700;margin-bottom:2px}
.nm-var-sm{font-size:9px;color:#777;margin-bottom:3px}
.nm-prem-top{background:#0D1B2A;padding:8px 10px}
.nm-prem-shop{font-size:8px;color:#E9A500;text-transform:uppercase;letter-spacing:2px}
.nm-prem-name{font-size:12px;font-weight:700;color:#fff}
.nm-prem-cat{font-size:9px;color:#aaa}
.nm-prem-mid{padding:5px 10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between}
.nm-prem-color{font-size:10px;color:#444}
.nm-prem-sku{font-size:9px;color:#bbb;font-family:monospace}
.nm-prem-bot{padding:7px 10px}
.nm-prem-price{font-size:16px;font-weight:800;color:#0D1B2A}
.nm-prem-price span{font-size:10px;font-weight:400}
.nm-prem-ulg{font-size:10px;color:#666}
.nm-prem-usd{font-size:10px;color:#888}
@media print{body{margin:0}@page{margin:5mm;size:A4}}
</style></head><body>
<div class="nm-label-grid">${labelHtml}</div>
<script>window.onload=()=>{setTimeout(()=>window.print(),300)}<\/script>
</body></html>`);
  w.document.close();
  toast("✅ Chop etish oynasi ochildi");
}

// ── Katalog jadvalidan rasm yuklash ──────────────
function katImgClick(sku) {
  const inp = document.getElementById("kat-img-inp-" + sku);
  if (inp) inp.click();
}

function katImgSave(sku, input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast("Rasm 2MB dan katta", "err"); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const raw = e.target.result;
    // Siqish
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
      if (!p) return;
      p.image = dataUrl;
      saveDB();
      renderKatalog();
      toast("✅ Rasm saqlandi");
    };
    img.src = raw;
  };
  reader.readAsDataURL(file);
}
