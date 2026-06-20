// MERX pos.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/pos.js  (v4 — To'liq qayta yozildi)
// ================================================

let cart = [], posPayMode = "full", posPayType = "naqd", posPriceType = "chakana";
let vmProd = null, selColor = null, selSize = null, vmSellMode = "dona";
let posDebtCurrency = "uzs";

// ── USB Barcode scanner (global listener) ───────
let _usbBuf = "", _usbTimer = null;
document.addEventListener("keydown", function(e) {
  if (!$("p-pos")?.classList.contains("on")) return;
  const tag = document.activeElement?.tagName;
  const id  = document.activeElement?.id;
  // Faqat pos-q bo'lmagan inputlarda to'xtatamiz
  if (["INPUT","TEXTAREA","SELECT"].includes(tag) && id !== "pos-q") return;

  if (e.key === "Enter") {
    if (_usbBuf.length >= 3) { e.preventDefault(); processBarcode(_usbBuf.trim()); }
    _usbBuf = ""; clearTimeout(_usbTimer);
  } else if (e.key.length === 1) {
    _usbBuf += e.key;
    clearTimeout(_usbTimer);
    _usbTimer = setTimeout(() => { _usbBuf = ""; }, 80);
  }
});

// ── Barcode ishlov berish ────────────────────────
function processBarcode(code) {
  const q = code.toLowerCase();
  const p = db.products.find(x =>
    x.sku.toLowerCase() === q || (x.barcode && x.barcode.toLowerCase() === q)
  );
  if (p) {
    toast(`📦 Topildi: ${p.name}`, "info");
    openVariantModal(p.sku);
  } else {
    if ($("pos-q")) { $("pos-q").value = code; posSearch(); }
    toast(`Barcode: "${code}" — qo'lda tanlang`, "info");
  }
}

// ── Kamera barcode scanner ───────────────────────
let _camStream = null, _camInterval = null, _barcodeDetector = null;

async function openBarcodeCamera() {
  if (!("BarcodeDetector" in window)) {
    toast("Chrome 83+ kerak yoki USB skaner ishlating","err"); return;
  }
  try {
    _barcodeDetector = new BarcodeDetector({
      formats: ["ean_13","ean_8","code_128","code_39","qr_code","upc_a","upc_e","itf"]
    });
    _camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:"environment" } });
    const vid = $("barcode-video");
    vid.srcObject = _camStream; vid.play();
    openModal("barcode-cam");
    const canvas = document.createElement("canvas");
    _camInterval = setInterval(async () => {
      if (!vid.videoWidth) return;
      canvas.width = vid.videoWidth; canvas.height = vid.videoHeight;
      canvas.getContext("2d").drawImage(vid, 0, 0);
      try {
        const codes = await _barcodeDetector.detect(canvas);
        if (codes.length > 0) { closeBarcodeCamera(); processBarcode(codes[0].rawValue); }
      } catch(e) {}
    }, 300);
  } catch(e) {
    toast("Kamera ochib bo'lmadi: " + e.message, "err");
  }
}

function closeBarcodeCamera() {
  clearInterval(_camInterval);
  if (_camStream) { _camStream.getTracks().forEach(t => t.stop()); _camStream = null; }
  closeModal("barcode-cam");
}

// ── Mahsulot qidirish ────────────────────────────
function posSearch() {
  const q = ($("pos-q")||{value:""}).value.trim();
  const clrBtn = $("pos-q-clr");
  if (clrBtn) clrBtn.style.display = q ? "flex" : "none";

  if (!q) {
    // Bo'sh qidiruvda hech narsa ko'rsatilmaydi (Billz uslubi)
    $("pos-results").innerHTML = `
      <div class="pos-empty">
        <i class="ti ti-search"></i>
        <div>Mahsulot qidiring...</div>
      </div>`;
    return;
  }
  const ql = q.toLowerCase();
  const found = visProds().filter(p =>
    p.name.toLowerCase().includes(ql) ||
    p.sku.toLowerCase().includes(ql) ||
    (p.art && p.art.toLowerCase().includes(ql)) ||
    p.category.toLowerCase().includes(ql) ||
    (p.barcode && p.barcode.toLowerCase().includes(ql))
  );

  if (!found.length) {
    $("pos-results").innerHTML = `
      <div class="pos-empty">
        <i class="ti ti-search-off"></i>
        <div>"${q}" topilmadi</div>
      </div>`;
    return;
  }

  // Har bir mahsulot + rang = alohida qator (Billz uslubida)
  const rows = [];
  found.forEach(p => {
    const colors = [...new Set(p.variants.map(v => v.color))];
    colors.forEach(color => rows.push({ p, color }));
  });

  $("pos-results").innerHTML = rows.map(({p, color}) => {
    const narx  = posPriceType === "ulgurji" ? (p.ulgurjiNarx || p.priceUzs) : p.priceUzs;
    const inBox = p.inBox || 1;
    const colorVariants = p.variants.filter(v => v.color === color);
    const maxPochka = colorVariants.length > 0 ? Math.min(...colorVariants.map(v => v.qty)) : 0;
    const totalDona = colorVariants.reduce((a,v) => a+v.qty, 0);
    const sizesStr  = typeof sizesToRange === "function"
      ? sizesToRange(colorVariants.map(v => v.size).filter(Boolean), p.type)
      : colorVariants.map(v => v.size).join(", ");
    const hex = colorVariants[0]?.hex || "#888";
    const rowKey = `${p.sku}::${color}`;

    const imgHtml = p.image
      ? `<img src="${p.image}" style="width:44px;height:44px;object-fit:cover;border-radius:7px;border:1px solid var(--brd);flex-shrink:0">`
      : `<div style="width:44px;height:44px;border:1.5px dashed #e0ddd8;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#ddd;font-size:16px;flex-shrink:0"><i class="ti ti-photo"></i></div>`;

    return `<div class="pos-ri" style="align-items:center;flex-direction:column;align-items:stretch" data-rowkey="${rowKey}">
      <div style="display:flex;align-items:center;gap:14px">
        ${imgHtml}
        <div class="pri-body" style="min-width:0">
          <div class="pri-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
          <div class="pri-meta">${color} · ${sizesStr || "—"}${p.art ? " · "+p.art : ""}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <div style="text-align:right">
            <div class="pri-price" style="font-size:13px">${priceDisplay(narx)}</div>
            <div style="font-size:10.5px;color:${maxPochka<=0?'var(--red)':maxPochka<=5?'#d97706':'var(--mut)'}">
              ${maxPochka} pochka
            </div>
          </div>
          <input type="number" min="1" max="${maxPochka}" placeholder="1" value="1"
            id="posq-${rowKey.replace(/[^a-zA-Z0-9]/g,'_')}"
            style="width:48px;text-align:center;border:1.5px solid var(--brd);border-radius:7px;padding:6px 4px;font-weight:700;font-size:13px"
            onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" style="padding:8px 7px;font-size:10.5px"
            onclick="event.stopPropagation();posToggleDonaMode('${rowKey.replace(/[^a-zA-Z0-9]/g,'_')}')"
            title="Dona bo'yicha sotish" id="posdona-btn-${rowKey.replace(/[^a-zA-Z0-9]/g,'_')}">
            <i class="ti ti-grid-dots"></i>
          </button>
          <button class="btn btn-acc btn-sm" style="padding:8px 10px"
            onclick="event.stopPropagation();posQuickAdd('${p.sku}','${color.replace(/'/g,"\\'")}')"
            ${maxPochka<=0?"disabled":""}>
            <i class="ti ti-plus"></i>
          </button>
        </div>
      </div>
      <div id="posdona-panel-${rowKey.replace(/[^a-zA-Z0-9]/g,'_')}" style="display:none;margin-top:8px;padding-top:8px;border-top:1px dashed var(--brd)">
        <div style="font-size:10.5px;color:var(--mut);margin-bottom:5px">O'lcham bo'yicha dona sotish:</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${colorVariants.map(v => `
            <div style="display:flex;align-items:center;gap:3px;background:var(--bg);border:1.5px solid var(--brd);border-radius:7px;padding:3px 5px">
              <span style="font-size:11px;font-weight:600;min-width:20px;text-align:center;color:${v.qty<=0?'#ccc':'inherit'}">${v.size}</span>
              <input type="number" min="0" max="${v.qty}" placeholder="0" value="0" ${v.qty<=0?'disabled':''}
                id="posdq-${rowKey.replace(/[^a-zA-Z0-9]/g,'_')}-${v.size}"
                style="width:36px;text-align:center;border:none;background:transparent;font-size:11px;font-weight:700">
            </div>`).join("")}
        </div>
        <button class="btn btn-acc btn-sm" style="margin-top:6px;width:100%"
          onclick="posDonaAdd('${p.sku}','${color.replace(/'/g,"\\'")}','${rowKey.replace(/[^a-zA-Z0-9]/g,'_')}')">
          <i class="ti ti-plus"></i> Donalab qo'shish
        </button>
      </div>
    </div>`;
  }).join("");
}

// Dona rejimi panelini ochish/yopish
function posToggleDonaMode(rowId) {
  const panel = $(`posdona-panel-${rowId}`);
  if (!panel) return;
  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "block";
}

// O'lcham bo'yicha donalab savatga qo'shish
function posDonaAdd(sku, color, rowId) {
  const p = db.products.find(x => x.sku === sku); if (!p) return;
  const colorVariants = p.variants.filter(v => v.color === color);
  const narx = posPriceType === "ulgurji" ? (p.ulgurjiNarx || p.priceUzs) : p.priceUzs;

  let addedTotal = 0;
  colorVariants.forEach(v => {
    const inputId = `posdq-${rowId}-${v.size}`;
    const qtyWanted = parseInt(($(inputId)||{value:0}).value) || 0;
    if (qtyWanted <= 0) return;
    if (qtyWanted > v.qty) { toast(`${v.size}: faqat ${v.qty} ta bor`, "err"); return; }

    const ex = cart.find(c => c.sku===sku && c.color===color && c.size===v.size && c.sellMode==="dona");
    if (ex) ex.qty += qtyWanted;
    else cart.push({
      sku, name: p.name, color, size: v.size,
      unit: p.unit||"dona", price: narx, basePrice: narx, priceType: posPriceType,
      qty: qtyWanted, qtyBox: null, inBox: null, sellMode: "dona",
      image: p.image || null, art: p.art || null, barcode: p.barcode || null
    });
    addedTotal += qtyWanted;
    if ($(inputId)) $(inputId).value = 0;
  });

  if (addedTotal > 0) {
    toast(`${p.name} (${color}) — ${addedTotal} dona savatchaga qo'shildi`);
    renderCart();
  } else {
    toast("O'lcham va son kiriting", "err");
  }
}

// Qidiruv natijasidan to'g'ridan-to'g'ri savatga qo'shish (pochka rejimida)
function posQuickAdd(sku, color) {
  const p = db.products.find(x => x.sku === sku); if (!p) return;
  const rowKey = `${sku}::${color}`;
  const inputId = `posq-${rowKey.replace(/[^a-zA-Z0-9]/g,'_')}`;
  const qtyInput = parseInt(($(inputId)||{value:1}).value) || 1;

  const colorVariants = p.variants.filter(v => v.color === color);
  const maxPochka = colorVariants.length > 0 ? Math.min(...colorVariants.map(v => v.qty)) : 0;
  const inBox = p.inBox || 1;

  const alreadyInCart = cart.find(c => c.sku===sku && c.color===color && c.sellMode==="karobka");
  const alreadyBoxes  = alreadyInCart ? (alreadyInCart.qtyBox||0) : 0;

  if (alreadyBoxes + qtyInput > maxPochka) {
    toast(`Faqat ${maxPochka - alreadyBoxes} pochka bor`, "err");
    return;
  }

  const narx = posPriceType === "ulgurji" ? (p.ulgurjiNarx || p.priceUzs) : p.priceUzs;
  const totalDona = qtyInput * inBox;

  if (alreadyInCart) {
    alreadyInCart.qty += totalDona;
    alreadyInCart.qtyBox = (alreadyInCart.qtyBox||0) + qtyInput;
  } else {
    cart.push({
      sku, name: p.name, color, size: null,
      unit: p.unit||"dona", price: narx, basePrice: narx, priceType: posPriceType,
      qty: totalDona, qtyBox: qtyInput, inBox, sellMode: "karobka",
      image: p.image || null, art: p.art || null, barcode: p.barcode || null
    });
  }

  toast(`${p.name} (${color}) × ${qtyInput} pochka savatchaga qo'shildi`);
  renderCart();
  // Inputni 1 ga qaytaramiz
  if ($(inputId)) $(inputId).value = 1;
}

function posClear() {
  if ($("pos-q")) $("pos-q").value = "";
  posSearch();
  $("pos-q")?.focus();
}

// ── renderPosGrid — utils.js bilan moslik ────────
function renderPosGrid() {
  posSearch();
  setTimeout(() => {
    const n = $("pos-note");
    if (n) { n.value = ""; n.setAttribute("readonly", true); }
  }, 150);
}

// ── Narx turi ─────────────────────────────────────
function setPriceType(t) {
  posPriceType = t;
  document.querySelectorAll("#price-type-seg button").forEach(b => {
    const on = b.dataset.pt === t;
    b.classList.toggle("on", on);
    b.style.background = on ? "#0D1B2A" : "#fff";
    b.style.color      = on ? "#fff"    : "#666";
  });
  posSearch(); renderCart();
}

// ── Variant modal ─────────────────────────────────
function openVariantModal(sku) {
  vmProd = db.products.find(p => p.sku === sku); if (!vmProd) return;
  selColor = null; selSize = null;
  $("vm-title").textContent = vmProd.name;

  // Meta
  if ($("vm-meta")) $("vm-meta").textContent =
    `${vmProd.category} · ${vmProd.unit||"dona"}${vmProd.art ? " · " + vmProd.art : ""}`;

  // Rasm
  const imgWrap = $("vm-img-wrap");
  if (imgWrap) {
    if (vmProd.image) {
      imgWrap.innerHTML = `<img src="${vmProd.image}" style="width:100%;height:100%;object-fit:cover">`;
    } else {
      imgWrap.innerHTML = `<i class="ti ti-photo"></i>`;
    }
  }

  // Narx header
  const narx = posPriceType === "ulgurji"
    ? (vmProd.ulgurjiNarx || vmProd.priceUzs || 0)
    : (vmProd.priceUzs || 0);
  const inBox = vmProd.inBox || 1;
  if ($("vm-price-header")) {
    let pTxt = priceDisplay(narx);
    if (inBox > 1) pTxt += `<div style="font-size:10px;font-weight:600;color:#856404">📦 ${priceDisplay(narx*inBox)}/pochka</div>`;
    $("vm-price-header").innerHTML = pTxt;
  }

  // Qoldiq header
  const totalQty = (vmProd.variants||[]).reduce((a,v) => a+v.qty, 0);
  if ($("vm-stock-header")) {
    const boxes = inBox > 1 ? `<div style="font-size:10px">${Math.floor(totalQty/inBox)} pochka</div>` : "";
    $("vm-stock-header").innerHTML = `${totalQty} ${vmProd.unit||"dona"}${boxes}`;
    const tag = $("vm-stock-tag");
    if (tag) {
      if (totalQty <= 0) { tag.style.background="#FEF2F2"; tag.style.borderColor="#FECACA"; tag.querySelector("div").style.color="#991B1B"; $("vm-stock-header").style.color="#991B1B"; }
      else if (totalQty <= 5) { tag.style.background="#FFF8E7"; tag.style.borderColor="#f0d882"; }
    }
  }

  const isBox   = posPriceType === "ulgurji" && inBox > 1;
  vmSellMode    = isBox ? "karobka" : "dona";

  // Toggle ko'rsatish
  if ($("vm-unit-toggle")) $("vm-unit-toggle").style.display = isBox ? "block" : "none";
  if ($("vm-box-info"))    $("vm-box-info").style.display    = "none";
  if ($("vm-sizes-row"))   $("vm-sizes-row").style.display   = isBox ? "none" : "block";
  if ($("vm-qty-lbl"))     $("vm-qty-lbl").textContent       = isBox ? "Pochka soni" : "Miqdor";
  document.querySelectorAll(".vmut-btn").forEach(b => b.classList.toggle("on", b.dataset.m === vmSellMode));

  renderVmChips(); openModal("variant");
}

function vmSetMode(m) {
  vmSellMode = m;
  document.querySelectorAll(".vmut-btn").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  if ($("vm-sizes-row"))  $("vm-sizes-row").style.display  = m === "karobka" ? "none" : "block";
  if ($("vm-qty-lbl"))    $("vm-qty-lbl").textContent      = m === "karobka" ? "Pochka soni" : "Miqdor";
  if ($("vm-box-info"))   $("vm-box-info").style.display   = "none";
  selSize = null;
  $("vm-qty").value = 1;
  renderVmChips();
}

function renderVmChips() {
  if (!vmProd) return;
  const colors = [...new Set(vmProd.variants.map(v => v.color))];
  const sizes  = [...new Set(vmProd.variants.map(v => v.size))];
  const narx   = posPriceType === "ulgurji" ? (vmProd.ulgurjiNarx||vmProd.priceUzs) : vmProd.priceUzs;
  const qty    = parseInt(($("vm-qty")||{value:1}).value) || 1;
  const inBox  = (vmSellMode === "karobka" && (vmProd.inBox||1) > 1) ? (vmProd.inBox||1) : 1;
  const totalDona = qty * inBox;

  // Ranglar
  $("vm-colors").innerHTML = colors.map(c => {
    const cVariants = vmProd.variants.filter(v => v.color===c);
    const cStock = cVariants.reduce((a,v) => a+v.qty, 0);
    const displayStock = vmSellMode === "karobka"
      ? (cVariants.length > 0 ? Math.min(...cVariants.map(v => v.qty)) : 0)
      : cStock;
    const stockLabel = vmSellMode === "karobka" ? `${displayStock} pochka` : `${displayStock}`;
    return `<div class="vchip${cStock>0?"":" out"}${c===selColor?" on":""}"
      onclick="vmSel('c','${c.replace(/'/g,"\\'")}')"> ${c}
      <span style="font-size:10px;opacity:.7">(${stockLabel})</span></div>`;
  }).join("");

  // O'lchamlar — faqat dona rejimida
  if ($("vm-sizes")) {
    $("vm-sizes").innerHTML = sizes.map(s =>
      `<div class="vchip${(!selColor || vmProd.variants.some(v => v.size===s && v.color===selColor && v.qty>0))?"":" out"}${s===selSize?" on":""}"
        onclick="vmSel('s','${s.replace(/'/g,"\\'")}')"> ${s}</div>`
    ).join("");
  }

  // Info matni
  if (vmSellMode === "karobka" && selColor) {
    const colorVariants = vmProd.variants.filter(v => v.color===selColor);
    const maxPochka = colorVariants.length > 0 ? Math.min(...colorVariants.map(v => v.qty)) : 0;
    const sizesStr  = typeof sizesToRange === "function"
      ? sizesToRange(colorVariants.map(v => v.size).filter(Boolean), vmProd.type)
      : colorVariants.map(v => v.size).join(", ");
    $("vm-info").innerHTML = `O'lcham: <strong>${sizesStr}</strong> &middot; Qoldiq: <strong>${maxPochka} pochka</strong>`;
  } else if (vmSellMode === "dona") {
    const v = selColor && selSize ? vmProd.variants.find(x => x.color===selColor && x.size===selSize) : null;
    $("vm-info").textContent = v
      ? `Qoldiq: ${v.qty} ${vmProd.unit||"dona"}`
      : selColor ? "O'lcham tanlang" : "Rang tanlang";
  } else {
    $("vm-info").textContent = "Rang tanlang";
  }

  // Karobka hisob bloki
  const bi = $("vm-box-info");
  if (bi) {
    if (vmSellMode === "karobka" && inBox > 1 && selColor) {
      bi.style.display = "block";
      $("vm-box-detail").textContent =
        `${qty} pochka × ${inBox} ${vmProd.unit||"dona"} = ${totalDona} ${vmProd.unit||"dona"}`;
    } else {
      bi.style.display = "none";
    }
  }

  // Narx
  if ($("vm-price-lbl")) $("vm-price-lbl").textContent =
    `${posPriceType==="ulgurji"?"Ulgurji":"Chakana"} narx × ${totalDona} ${vmProd.unit||"dona"}:`;
  if ($("vm-price-val")) $("vm-price-val").textContent = priceDisplay(narx * totalDona);
}

function vmSel(t, v) {
  if (t === "c") { selColor = v; selSize = null; } else selSize = v;
  renderVmChips();
}

function confirmVariant() {
  if (!selColor) { toast("Rang tanlang","err"); return; }
  if (vmSellMode === "dona" && !selSize) { toast("O'lcham tanlang","err"); return; }

  const inBox     = (vmSellMode === "karobka" && (vmProd.inBox||1) > 1) ? (vmProd.inBox||1) : 1;
  const qtyInput  = Math.max(1, parseInt(($("vm-qty")||{value:1}).value) || 1);
  const totalDona = qtyInput * inBox;
  const baseNarx  = posPriceType === "ulgurji" ? (vmProd.ulgurjiNarx||vmProd.priceUzs) : vmProd.priceUzs;
  const overrideVal = getRawVal("vm-price-input");
  const narx      = overrideVal > 0 ? overrideVal : baseNarx;

  if (vmSellMode === "karobka") {
    // Pochka soni = eng kam o'lchamdagi qoldiq (chunki 1 pochka = barcha o'lchamlardan 1 tadan)
    const colorVariants = vmProd.variants.filter(v => v.color===selColor);
    const maxPochka = colorVariants.length > 0 ? Math.min(...colorVariants.map(v => v.qty)) : 0;
    const alreadyInCart = cart.find(c => c.sku===vmProd.sku && c.color===selColor && !c.size);
    const alreadyBoxes   = alreadyInCart ? (alreadyInCart.qtyBox||0) : 0;
    if (alreadyBoxes + qtyInput > maxPochka) {
      toast(`Faqat ${maxPochka - alreadyBoxes} pochka bor`,"err");
      return;
    }
    const ex = cart.find(c => c.sku===vmProd.sku && c.color===selColor && c.sellMode==="karobka");
    if (ex) { ex.qty += totalDona; ex.qtyBox = (ex.qtyBox||0) + qtyInput; }
    else cart.push({
      sku:vmProd.sku, name:vmProd.name, color:selColor, size:null,
      unit:vmProd.unit||"dona", price:narx, basePrice:baseNarx, priceType:posPriceType,
      qty:totalDona, qtyBox:qtyInput, inBox, sellMode:"karobka",
      image: vmProd.image || null,
      art: vmProd.art || null,
      barcode: vmProd.barcode || null
    });
    toast(`${vmProd.name} (${selColor}) × ${qtyInput} pochka (${totalDona} ${vmProd.unit||"dona"}) savatchaga qo'shildi`);
  } else {
    // Dona rejimi
    const v = vmProd.variants.find(x => x.color===selColor && x.size===selSize);
    if (!v || v.qty <= 0) { toast("Bu variant tugagan","err"); return; }
    const ex      = cart.find(c => c.sku===vmProd.sku && c.color===selColor && c.size===selSize);
    const already = ex ? ex.qty : 0;
    if (already + totalDona > v.qty) {
      toast(`Faqat ${v.qty - already} ${vmProd.unit||"dona"} bor`,"err"); return;
    }
    if (ex) ex.qty += totalDona;
    else cart.push({
      sku:vmProd.sku, name:vmProd.name, color:selColor, size:selSize,
      unit:vmProd.unit||"dona", price:narx, basePrice:baseNarx, priceType:posPriceType,
      qty:totalDona, qtyBox:null, inBox:null, sellMode:"dona",
      image: vmProd.image || null,
      art: vmProd.art || null,
      barcode: vmProd.barcode || null
    });
    toast(`${vmProd.name} (${selColor}/${selSize}) × ${totalDona} savatchaga qo'shildi`);
  }

  closeModal("variant"); renderCart();
}

// ── Savatcha ──────────────────────────────────────
function renderCart() {
  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const discount = calcDiscount(subtotal);
  const total    = subtotal - discount;
  const count    = cart.reduce((a, c) => a + c.qty, 0);
  const rate     = db.settings.rate || 12800;

  $("cart-cnt").textContent = cart.length ? count + " ta" : "bo'sh";
  if ($("cart-items-count")) $("cart-items-count").textContent = cart.length ? count + " ta" : "0 ta";
  if ($("pos-pay-total")) $("pos-pay-total").textContent = priceDisplay(total);

  // Chegirma natija
  const discEl = $("discount-result");
  if (discEl) {
    if (discount > 0) {
      discEl.style.display = "block";
      discEl.innerHTML = `−${priceDisplay(discount)} → Jami: <strong style="color:#0D1B2A">${priceDisplay(total)}</strong>`;
    } else {
      discEl.style.display = "none";
    }
  }

  // USD ekvivalent
  const usdEl = $("cart-total-usd");
  if (usdEl) {
    usdEl.textContent = total > 0 ? `≈ $${(total/rate).toFixed(0)}` : "";
  }

  if (!cart.length) {
    $("cart-items").innerHTML = `<div class="cart-mt"><i class="ti ti-shopping-cart"></i><p style="font-size:13px">Mahsulot tanlang</p></div>`;
    $("cart-total").textContent = "0 so'm"; updateRem(); return;
  }

  $("cart-items").innerHTML = cart.map((c, i) => {
    const variantLine = c.sellMode === "karobka"
      ? `${c.color} <span class="ci-box-badge">📦 ${c.qtyBox} pochka</span>`
      : `${c.color} / ${c.size}`;
    const isOverride = c.basePrice && c.basePrice !== c.price;
    const priceTag = isOverride
      ? `<span style="text-decoration:line-through;color:#bbb;font-size:11px;margin-right:4px">${fmt(c.basePrice*c.qty)} so'm</span>
         <span class="ci-pr" style="color:#E9A500">${fmt(c.price*c.qty)} so'm</span>`
      : `<span class="ci-pr">${priceDisplay(c.price * c.qty)}</span>`;
    const subLine = c.sellMode === "karobka"
      ? `${c.qty} ${c.unit} · ${priceDisplay(c.price)}/${c.unit}${isOverride?` <span style="color:#E9A500;font-size:10px">(o'zgartirilgan)</span>`:""}`
      : isOverride ? `<span style="color:#E9A500;font-size:10.5px">Narx o'zgartirilgan: ${priceDisplay(c.basePrice)} → ${priceDisplay(c.price)}</span>` : "";
    return `<div class="ci">
      <div class="ci-inf">
        <div class="ci-nm">${c.name}</div>
        <div class="ci-vr">${variantLine}</div>
        ${subLine ? `<div style="font-size:11px;color:#bbb;margin-top:1px">${subLine}</div>` : ""}
        <div class="ci-row">
          <div class="qty-ctrl">
            <button onclick="ciQty(${i},-1)">−</button>
            <input type="number" value="${c.sellMode==='karobka' ? c.qtyBox : c.qty}" min="1"
              oninput="ciQtySet(${i},+this.value)"
              style="width:38px;text-align:center;border:none;outline:none;font-weight:600">
            <button onclick="ciQty(${i},1)">+</button>
            ${c.sellMode==='karobka' ? `<span style="font-size:10px;color:#bbb;margin-left:3px">${c.unit==='dona'?'pochka':'pochka'}</span>` : ""}
          </div>
          ${priceTag}
          <button class="ci-rm" onclick="removeFromCart(${i})"><i class="ti ti-x"></i></button>
        </div>
      </div>
    </div>`;
  }).join("");

  $("cart-total").textContent = priceDisplay(total); updateRem();
}

function ciQty(i, d) {
  const c = cart[i];
  if (c.sellMode === "karobka" && c.inBox) {
    // Pochka rejimi: avval pochka sonini o'zgartiramiz, keyin jami donani hisoblaymiz
    c.qtyBox = Math.max(1, (c.qtyBox || 1) + d);
    c.qty = c.qtyBox * c.inBox;
  } else {
    c.qty = Math.max(1, c.qty + d);
  }
  renderCart();
}
function ciQtySet(i, v) {
  const c = cart[i];
  if (c.sellMode === "karobka" && c.inBox) {
    c.qtyBox = Math.max(1, v || 1);
    c.qty = c.qtyBox * c.inBox;
  } else {
    c.qty = Math.max(1, v || 1);
  }
  renderCart();
}
function removeFromCart(i) { cart.splice(i, 1); renderCart(); }
function clearCart()        { cart = []; renderCart(); }

// ── To'lov ────────────────────────────────────────
function setPayType(t) {
  posPayType = t;
  document.querySelectorAll(".ptbtn").forEach(b => b.classList.toggle("on", b.dataset.pt === t));
}

function setPayMode(m) {
  posPayMode = m;
  document.querySelectorAll(".pmode-btn").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  $("part-box").style.display = m === "part" ? "block" : "none";
  if (m === "full") setDebtCurrency("uzs");
  if (m === "part") {
    if ($("c-due") && !$("c-due").value) $("c-due").value = addDays(today(), 30);
    updateRem();
  }
}

function setDebtCurrency(c) {
  posDebtCurrency = c;
  document.querySelectorAll(".dcur-btn").forEach(b => b.classList.toggle("on", b.dataset.c === c));
  const box = $("rem-box"); const lbl = $("rem-lbl");
  if (box) box.className = "rem-box " + c;
  if (lbl) { lbl.className = "rem-lbl-" + c; lbl.textContent = c === "usd" ? "Qolgan qarz (USD):" : "Qolgan qarz:"; }
  updateRem();
}

function updateRem() {
  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const discount = calcDiscount(subtotal);
  const total    = subtotal - discount;
  const paid     = getRawVal("c-paid");
  const remUzs   = Math.max(0, total - paid);
  const rate     = db.settings.rate || 12800;
  if ($("rem-view")) $("rem-view").textContent = posDebtCurrency === "usd"
    ? "$" + (remUzs / rate).toFixed(2)
    : fmt(remUzs) + " so'm";
}

// ── Mijoz qidiruv (yangi) ────────────────────────
let _custSearchTimer = null;

function custSearch(q) {
  const dd = $("cust-dropdown"); if (!dd) return;
  const clearBtn = $("cust-clear-btn");
  const val = q.trim();

  if (clearBtn) clearBtn.style.display = val ? "flex" : "none";

  if (!val) { dd.style.display = "none"; return; }

  const ql = val.toLowerCase();
  const qlDigits = ql.replace(/\D/g,""); // faqat raqamlar
  const found = db.customers.filter(c => {
    if (c.name.toLowerCase().includes(ql)) return true;
    // Telefon bo'yicha: faqat raqamlar kiritilgan bo'lsa va kamida 2 ta raqam bo'lsa
    if (qlDigits.length >= 2) {
      const phoneDigits = (c.phone||"").replace(/\D/g,"");
      if (phoneDigits && phoneDigits.includes(qlDigits)) return true;
    }
    if ((c.note||"").toLowerCase().includes(ql)) return true;
    return false;
  }).slice(0, 8);

  if (!found.length) {
    dd.style.display = "block";
    dd.innerHTML = `
      <div style="padding:10px 14px;font-size:12.5px;color:var(--mut);text-align:center;border-bottom:1px solid var(--brd)">
        "${val}" topilmadi
      </div>
      <div onclick="custQuickAdd('${val.replace(/'/g,"&#39;")}')"
        style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;color:#0D1B2A;font-weight:600;font-size:13px"
        onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background=''">
        <i class="ti ti-user-plus" style="font-size:16px;color:#36B48C"></i>
        + Yangi mijoz qo'shish: "<strong>${val}</strong>"
      </div>`;
    return;
  }

  // Natijalar oxiriga "Yangi qo'shish" ham qo'shamiz
  const addNewHtml = `
    <div onclick="custQuickAdd('${val.replace(/'/g,"&#39;")}')"
      style="padding:9px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;border-top:1px solid var(--brd);color:#36B48C;font-size:12.5px;font-weight:600"
      onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background=''">
      <i class="ti ti-user-plus" style="font-size:14px"></i>
      + Yangi mijoz sifatida qo'shish
    </div>`;

  dd.style.display = "block";
  dd.innerHTML = found.map(c => {
    const debts = db.sales.filter(s => s.customerId===c.id && s.status==="qarz" && s.remaining>0);
    const totalUzs = debts.reduce((a,s)=>a+s.remaining,0);
    const totalUsd = debts.filter(s=>s.debtCurrency==="usd"&&s.debtUsd).reduce((a,s)=>a+s.debtUsd,0);
    const debtHtml = totalUzs > 0 || totalUsd > 0
      ? `<span style="font-size:10.5px;color:#E05A5A;font-weight:600;margin-left:6px">
          ⚠️ ${totalUsd>0?"$"+totalUsd.toFixed(2)+" USD":fmt(totalUzs)+" so'm"} qarz
         </span>`
      : `<span style="font-size:10px;color:#36B48C;margin-left:6px">✓</span>`;
    return `<div onclick="custSelect(${c.id})"
      style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between"
      onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
      <div>
        <div style="font-weight:600;font-size:13px">${c.name}${debtHtml}</div>
        <div style="font-size:11.5px;color:var(--mut)">${c.phone||"Telefon yo'q"} · ${c.type==="ulgurji"?"Ulgurji":"Chakana"}</div>
      </div>
      <i class="ti ti-chevron-right" style="font-size:14px;color:#bbb"></i>
    </div>`;
  }).join("") + addNewHtml;
}

function custSelect(id) {
  const c = db.customers.find(x => x.id === id); if (!c) return;

  // Hidden input
  if ($("c-cust")) $("c-cust").value = id;

  // Search input tozalash + yopish
  const inp = $("cust-search-inp");
  if (inp) inp.value = "";
  const dd = $("cust-dropdown");
  if (dd) dd.style.display = "none";
  const clearBtn = $("cust-clear-btn");
  if (clearBtn) clearBtn.style.display = "none";

  // Tanlangan karta ko'rsatish
  const card = $("cust-selected-card");
  if (card) {
    card.style.display = "block";
    if ($("cust-sel-name"))  $("cust-sel-name").textContent  = c.name;
    if ($("cust-sel-phone")) $("cust-sel-phone").textContent = c.phone || "Telefon yo'q";
  }

  // Ism va tel to'ldirish
  if ($("c-name"))  $("c-name").value  = c.name;
  if ($("c-phone")) $("c-phone").value = c.phone || "";

  showCustDebt(id);
}

function custQuickAdd(val) {
  // Dropdown yopamiz
  const dd = $("cust-dropdown");
  if (dd) dd.style.display = "none";

  // val ni ism yoki telefon deb aniqlaymiz
  const isPhone = /^[+\d\s\-()]{6,}$/.test(val.trim());
  const newName  = isPhone ? "" : val.trim();
  const newPhone = isPhone ? val.trim() : "";

  // Mini modal ochish — mavjud addcust modal ishlatamiz
  if ($("ac-name"))  $("ac-name").value  = newName;
  if ($("ac-phone")) $("ac-phone").value = newPhone;
  if ($("ac-type"))  $("ac-type").value  = posPriceType === "ulgurji" ? "ulgurji" : "chakana";
  if ($("ac-note"))  $("ac-note").value  = "";

  // Saqlash tugmasini POS ga qaytadigan qilamiz
  const btn = document.querySelector("#ov-addcust .btn-acc");
  if (btn) {
    btn.textContent = "Saqlash va tanlash";
    btn.onclick = custQuickSave;
  }
  openModal("addcust");
  setTimeout(() => {
    const focus = newName ? $("ac-phone") : $("ac-name");
    if (focus) focus.focus();
  }, 80);
}

function custQuickSave() {
  const name  = ($("ac-name")||{value:""}).value.trim();
  const phone = ($("ac-phone")||{value:""}).value.trim();
  if (!name) { toast("Ism kiriting","err"); return; }

  const nc = {
    id:    db.seq++,
    name,
    phone: phone || "",
    type:  ($("ac-type")||{value:"ulgurji"}).value,
    note:  ($("ac-note")||{value:""}).value.trim()
  };
  db.customers.push(nc);
  saveDB();
  closeModal("addcust");

  // Tugmani qaytaramiz
  const btn = document.querySelector("#ov-addcust .btn-acc");
  if (btn) { btn.textContent = "Saqlash"; btn.onclick = addCustomer; }

  // POS da tanlash
  custSelect(nc.id);
  toast(`✅ "${name}" qo'shildi va tanlandi`, "ok");
}

function custClear() {
  if ($("c-cust"))           $("c-cust").value           = "";
  if ($("c-name"))           $("c-name").value           = "";
  if ($("c-phone"))          $("c-phone").value          = "";
  if ($("cust-search-inp"))  $("cust-search-inp").value  = "";
  if ($("cust-dropdown"))    $("cust-dropdown").style.display = "none";
  if ($("cust-clear-btn"))   $("cust-clear-btn").style.display = "none";
  const card = $("cust-selected-card");
  if (card) card.style.display = "none";
  showCustDebt(null);
}

// Tashqarini bosganda dropdown yopilsin
document.addEventListener("click", function(e) {
  if (!e.target.closest("#cust-search-wrap")) {
    const dd = $("cust-dropdown");
    if (dd) dd.style.display = "none";
  }
});

function custPick() {
  // Eski select bilan moslik — endi ishlatilmaydi
  const id = parseInt(($("c-cust")||{value:""}).value) || null;
  if (!id) { showCustDebt(null); return; }
  custSelect(id);
}

function refreshCustList() {
  // Select yo'q endi — saqlaymiz moslik uchun
}

function refreshStaffList() {
  const sel = $("pos-staff"); if (!sel) return;
  sel.innerHTML = '<option value="">— Kassirni tanlang —</option>' +
    db.staff.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
}

// ── Savdo yakunlash ───────────────────────────────
async function checkout() {
  if (!cart.length) { toast("Savatcha bo'sh","err"); return; }
  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const discount = calcDiscount(subtotal);
  const total    = subtotal - discount;
  let paid = total, rem = 0, due = "", cName = "", cPhone = "", status = "tolandan";
  let customerId = null, debtUsd = null;

  // Mijoz — ikkala rejimda ham o'qiymiz
  const selId      = parseInt(($("c-cust")||{value:""}).value) || null;
  const nameTyped  = ($("c-name")||{value:""}).value.trim();
  const phoneTyped = ($("c-phone")||{value:""}).value.trim();
  const norm       = s => (s||"").toLowerCase().replace(/\s/g,"");

  if (selId) {
    const c = db.customers.find(x => x.id === selId);
    if (c) {
      customerId = c.id; cName = c.name; cPhone = c.phone || "";
      if (!c.phone && phoneTyped) { c.phone = phoneTyped; cPhone = phoneTyped; }
    }
  }
  if (!customerId && nameTyped) {
    const ex = db.customers.find(x =>
      norm(x.name) === norm(nameTyped) && (!phoneTyped || norm(x.phone) === norm(phoneTyped))
    );
    if (ex) {
      customerId = ex.id; cName = ex.name; cPhone = ex.phone || phoneTyped;
      if (!ex.phone && phoneTyped) ex.phone = phoneTyped;
    } else {
      const nc = { id:db.seq++, name:nameTyped, phone:phoneTyped,
        type: posPriceType==="ulgurji"?"ulgurji":"chakana", note:"POS orqali qo'shildi" };
      db.customers.push(nc);
      customerId = nc.id; cName = nc.name; cPhone = nc.phone;
    }
  }

  if (posPayMode === "part") {
    if (!cName) { toast("Qisman to'lovda mijoz ismi shart","err"); return; }
    paid    = getRawVal("c-paid");
    due     = ($("c-due")||{value:""}).value;
    rem     = Math.max(0, total - paid);
    status  = rem > 0 ? "qarz" : "tolandan";
    if (posDebtCurrency === "usd" && rem > 0) {
      debtUsd = parseFloat((rem / (db.settings.rate||12800)).toFixed(2));
    }
  }

  const staffId = parseInt(($("pos-staff")||{value:0}).value) || null;
  // Kassir majburiy — xodimlar ro'yxati bo'sh bo'lmasa
  if (!staffId && db.staff && db.staff.length > 0) {
    toast("Kassirni tanlang", "err");
    const staffSel = $("pos-staff");
    if (staffSel) {
      staffSel.style.border = "2px solid var(--red)";
      staffSel.focus();
      setTimeout(() => { staffSel.style.border = ""; }, 2000);
    }
    return;
  }
  const saleNote = ($("pos-note")||{value:""}).value.trim();

  // Qoldiqdan ayirish
  cart.forEach(c => {
    const p = db.products.find(x => x.sku === c.sku); if (!p) return;
    if (c.sellMode === "karobka") {
      // Pochka mantig'i: har bir pochka = barcha o'lchamlardan 1 tadan.
      // qtyBox = nechta pochka sotildi — shuncha son har bir o'lchamdan ayiriladi.
      const boxesSold = c.qtyBox || 0;
      p.variants.filter(v => v.color === c.color).forEach(v => {
        v.qty = Math.max(0, v.qty - boxesSold);
      });
    } else {
      const v = p.variants.find(x => x.color===c.color && x.size===c.size);
      if (v) v.qty = Math.max(0, v.qty - c.qty);
    }
  });

  // Chek raqami
  const chekNum = `CHK-${today().replace(/-/g,"")}` +
    `-${String(db.seq).padStart(4,"0")}`;

  // Mijozning oldingi qarzlarini hisoblaymiz
  let prevDebtUsd = 0, prevDebtUzs = 0;
  if (customerId) {
    const prevDebts = db.sales.filter(s =>
      s.customerId === customerId && s.status === "qarz" && s.remaining > 0
    );
    prevDebtUsd = prevDebts
      .filter(s => s.debtCurrency === "usd" && s.debtUsd)
      .reduce((a, s) => a + s.debtUsd, 0);
    prevDebtUzs = prevDebts
      .filter(s => s.debtCurrency !== "usd")
      .reduce((a, s) => a + s.remaining, 0);
  }

  const newSale = {
    id:db.seq++, chekNum, date:today(), time:nowTime(),
    priceType: posPriceType,
    payType: posPayType, staffId, customerId,
    discount, discountType: discType,
    discountPct: discType === "pct" ? (getRawVal("discount-val") || 0) : null,
    items: cart.map(c => ({
      name: c.name, sku: c.sku || null,
      art: c.art || null,
      variant: c.sellMode==="karobka" ? `${c.color} (${c.qtyBox} pochka)` : `${c.color} / ${c.size}`,
      color: c.color || null,
      size: c.size || null,
      qty: c.qty, qtyBox: c.qtyBox||null, inBox: c.inBox||null,
      price: c.price, unit: c.unit,
      image: c.image || null,
      barcode: c.barcode || null
    })),
    subtotal, total, paid, remaining:rem, due,
    customerName:cName, customerPhone:cPhone, status,
    debtCurrency: posPayMode==="part" ? posDebtCurrency : "uzs",
    debtUsd, note: saleNote || null,
    // Oldingi qarz ma'lumotlari (chekda ko'rsatish uchun)
    prevDebtUsd: prevDebtUsd > 0 ? prevDebtUsd : null,
    prevDebtUzs: prevDebtUzs > 0 ? prevDebtUzs : null,
  };
  db.sales.push(newSale); saveDB();

  // Telegram bot orqali avtomatik chek (mijoz botga ulangan bo'lsa)
  if (typeof sendTelegramReceipt === "function") {
    sendTelegramReceipt(customerId, newSale, cPhone);
  }

  // Ishchilar guruhiga sotuv bildirishnomasi
  if (typeof sendStaffNotification === "function") {
    sendStaffNotification(newSale);
  }

  // SMS (boyitilgan)
  if (cPhone && cPhone.replace(/\D/g,"").length >= 9) {
    const shopName = db.shop?.name || "MERX";
    const debtTxt  = debtUsd != null
      ? `$${debtUsd.toFixed(2)} USD`
      : rem > 0 ? `${fmt(rem)} so'm` : "";
    const itemsTxt = newSale.items.map(i =>
      `${i.name} x${i.qty}${i.unit} = ${fmt(i.price*i.qty)} so'm`
    ).join(", ");
    const sms = rem > 0
      ? `${shopName} | ${chekNum}\n${itemsTxt}\nJami: ${fmt(total)} so'm\nTo'landi: ${fmt(paid)} so'm\nQarz: ${debtTxt} (${due||"muddatsiz"})`
      : `${shopName} | ${chekNum}\n${itemsTxt}\nJami: ${fmt(total)} so'm - To'liq qabul qilindi. Rahmat!`;
    await sendSms(cPhone, sms);
  }

  // Reset
  cart = []; renderCart(); setPayMode("full"); setDebtCurrency("uzs");
  if ($("c-name"))       $("c-name").value       = "";
  if ($("c-phone"))      $("c-phone").value       = "";
  if ($("c-paid"))       $("c-paid").value        = "0";
  if ($("c-due"))        $("c-due").value         = "";
  if ($("c-cust"))       $("c-cust").value        = "";
  if ($("cust-search-inp"))  $("cust-search-inp").value  = "";
  if ($("cust-selected-card")) $("cust-selected-card").style.display = "none";
  if ($("cust-dropdown"))    $("cust-dropdown").style.display = "none";
  if ($("discount-val"))   $("discount-val").value  = "0";
  if ($("discount-result")) $("discount-result").style.display = "none";
  const pn1=$("pos-note"); if(pn1){pn1.value="";pn1.setAttribute("readonly",true);}
  if ($("vm-price-input")) $("vm-price-input").value = "";
  $("debt-count").textContent = debtSales().length;
  refreshCustList();
  showReceiptModal(newSale);
}

// ── Chegirma ──────────────────────────────────
let discType = "pct"; // "pct" | "sum"

function setDiscType(t) {
  discType = t;
  document.querySelectorAll(".disc-type-btn").forEach(b => b.classList.toggle("on", b.dataset.d === t));
  applyDiscount();
}

function applyDiscount() {
  renderCart();
}

function calcDiscount(total) {
  const val = getRawVal("discount-val");
  if (!val || val <= 0) return 0;
  if (discType === "pct") return Math.round(total * val / 100);
  return Math.min(val, total);
}

// ── Mijoz qarzi ko'rinishi ────────────────────
function showCustDebt(custId) {
  const badge = $("cust-debt-badge");
  const val   = $("cust-debt-val");
  if (!badge || !val) return;
  if (!custId) { badge.style.display = "none"; return; }

  const debts   = db.sales.filter(s => s.customerId === custId && s.status === "qarz" && s.remaining > 0);
  const totalUzs = debts.filter(s => s.debtCurrency !== "usd").reduce((a,s) => a + s.remaining, 0);
  const totalUsd = debts.filter(s => s.debtCurrency === "usd" && s.debtUsd).reduce((a,s) => a + s.debtUsd, 0);
  const cntAll   = debts.length;

  if (cntAll === 0) { badge.style.display = "none"; return; }

  let txt = "";
  if (totalUsd > 0 && totalUzs > 0) {
    txt = `$${totalUsd.toFixed(2)} USD + ${fmt(totalUzs)} so'm`;
  } else if (totalUsd > 0) {
    txt = `$${totalUsd.toFixed(2)} USD`;
  } else {
    txt = `${fmt(totalUzs)} so'm`;
  }
  val.innerHTML = `${txt} <span style="font-size:10.5px;font-weight:400;color:#a16207">(${cntAll} ta sotuv)</span>`;
  badge.style.display = "block";
}

// ── Chek modal ────────────────────────────────
let _lastSale = null;

function showReceiptModal(sale) {
  _lastSale = sale;
  const shopName = db.shop?.name || "MERX";
  const payLabels = { naqd:"Naqd pul", karta:"Karta", otkazma:"Bank o'tkazmasi" };

  // Shop nomi
  if ($("rcp-shop")) $("rcp-shop").textContent = shopName;

  // Chek raqami va sana
  if ($("rcp-num")) $("rcp-num").textContent = sale.chekNum || `#${sale.id}`;
  if ($("rcp-dt"))  $("rcp-dt").textContent  = `${sale.date} / ${sale.time||""}`;

  // Mahsulotlar
  if ($("rcp-items")) {
    $("rcp-items").innerHTML = sale.items.map(i => `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;font-size:13px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:#0D1B2A">${i.name}</div>
          <div style="font-size:11.5px;color:#aaa">${i.variant} · ${i.qty} ${i.unit||"dona"}</div>
        </div>
        <div style="font-weight:700;color:#0D1B2A;margin-left:12px;white-space:nowrap">${priceDisplay(i.price*i.qty)}</div>
      </div>`
    ).join("");
  }

  // Subtotal va chegirma
  const subtotal = sale.subtotal || sale.total;
  const disc     = sale.discount || 0;
  if ($("rcp-subtotal")) $("rcp-subtotal").textContent = fmt(subtotal) + " so'm";
  const discRow = $("rcp-disc-row");
  if (discRow) {
    if (disc > 0) {
      discRow.style.display = "flex";
      const lbl = sale.discountType === "pct" && sale.discountPct
        ? `Chegirma (${sale.discountPct}%)`
        : sale.discountType === "pct" ? "Chegirma (%)" : "Chegirma";
      if ($("rcp-disc-lbl")) $("rcp-disc-lbl").textContent = lbl;
      if ($("rcp-disc-val")) $("rcp-disc-val").textContent = "−" + fmt(disc) + " so'm";
    } else {
      discRow.style.display = "none";
    }
  }
  if ($("rcp-total")) $("rcp-total").textContent = fmt(sale.total) + " so'm";

  // To'lov
  if ($("rcp-paytype")) $("rcp-paytype").textContent = payLabels[sale.payType] || sale.payType;
  if ($("rcp-paid"))    $("rcp-paid").textContent    = fmt(sale.paid) + " so'm";

  const debtWrap = $("rcp-debt-wrap");
  const dueWrap  = $("rcp-due-wrap");
  if (sale.remaining > 0) {
    if (debtWrap) debtWrap.style.display = "flex";
    const isUsd = sale.debtCurrency === "usd" && sale.debtUsd;

    // Oldingi qarz satrlari
    const prevEl    = $("rcp-debt-prev");
    const prevValEl = $("rcp-debt-prev-val");
    const newEl     = $("rcp-debt-new");
    const newValEl  = $("rcp-debt-new-val");
    const lblEl     = $("rcp-debt-lbl");
    const debtEl    = $("rcp-debt");

    if (isUsd && sale.prevDebtUsd > 0) {
      if (prevEl)    { prevEl.style.display = "flex"; }
      if (prevValEl) prevValEl.textContent = `$${sale.prevDebtUsd.toFixed(2)}`;
      if (newEl)     { newEl.style.display = "flex"; }
      if (newValEl)  newValEl.textContent = `$${sale.debtUsd.toFixed(2)}`;
      if (lblEl)     lblEl.textContent = "Umumiy qarz";
      if (debtEl)    debtEl.textContent = `$${(sale.prevDebtUsd + sale.debtUsd).toFixed(2)} USD`;
    } else if (!isUsd && sale.prevDebtUzs > 0) {
      if (prevEl)    { prevEl.style.display = "flex"; }
      if (prevValEl) prevValEl.textContent = fmt(sale.prevDebtUzs) + " so'm";
      if (newEl)     { newEl.style.display = "flex"; }
      if (newValEl)  newValEl.textContent = fmt(sale.remaining) + " so'm";
      if (lblEl)     lblEl.textContent = "Umumiy qarz";
      if (debtEl)    debtEl.textContent = fmt(sale.prevDebtUzs + sale.remaining) + " so'm";
    } else {
      if (prevEl) prevEl.style.display = "none";
      if (newEl)  newEl.style.display  = "none";
      if (lblEl)  lblEl.textContent    = "Qolgan qarz";
      if (debtEl) debtEl.textContent   = isUsd
        ? `$${sale.debtUsd.toFixed(2)} USD`
        : fmt(sale.remaining) + " so'm";
    }
    if (dueWrap && sale.due) { dueWrap.style.display = "block"; if ($("rcp-due")) $("rcp-due").textContent = sale.due; }
    else if (dueWrap) dueWrap.style.display = "none";
  } else {
    if (debtWrap) debtWrap.style.display = "none";
    if (dueWrap)  dueWrap.style.display  = "none";
    // Oldingi qarz elementlarini ham yashirish
    const prevEl = $("rcp-debt-prev"); if (prevEl) prevEl.style.display = "none";
    const newEl  = $("rcp-debt-new");  if (newEl)  newEl.style.display  = "none";
  }

  // Mijoz va kassir
  if ($("rcp-cust")) $("rcp-cust").textContent =
    sale.customerName ? `${sale.customerName}${sale.customerPhone?" · "+sale.customerPhone:""}` : "Noma'lum";
  const staff = db.staff.find(s => s.id === sale.staffId);
  if ($("rcp-staff")) $("rcp-staff").textContent = staff ? staff.name : "—";

  // Izoh
  const noteWrap = $("rcp-note-wrap");
  if (noteWrap) {
    if (sale.note) {
      noteWrap.style.display = "block";
      if ($("rcp-note")) $("rcp-note").textContent = sale.note;
    } else {
      noteWrap.style.display = "none";
    }
  }

  // Bot va PDF havola
  const botUser = (db.settings?.telegramBotUsername || "").replace(/^@/,"");
  const botUrl  = db.settings?.telegramBotUrl || "";
  const chekId  = sale.chekNum || ("ID" + sale.id);
  const rcpUrl  = botUrl ? `${botUrl}?action=receipt&id=${encodeURIComponent(chekId)}` : "";

  const rcpBotEl = $("rcp-bot-info");
  if (rcpBotEl) {
    rcpBotEl.style.display = (botUser || rcpUrl) ? "block" : "none";
    rcpBotEl.innerHTML = [
      botUser ? `<div style="font-size:11px;color:#229ED9;text-align:center;padding:4px 0">🤖 Cheklarni Telegramda olish: <b>@${botUser}</b></div>` : "",
      rcpUrl  ? `<div style="text-align:center;padding:4px 0"><a href="${rcpUrl}" target="_blank" style="font-size:11.5px;color:#0D1B2A;font-weight:600;text-decoration:none;background:#F0EDE8;padding:4px 14px;border-radius:20px;display:inline-block">📄 PDF havolasi</a></div>` : ""
    ].join("");
  }

  openModal("receipt");
}

function closeReceipt() {
  closeModal("receipt");
  const pn2=$("pos-note"); if(pn2){pn2.value="";pn2.setAttribute("readonly",true);}
}

function shareTelegram() {
  if (!_lastSale) return;
  const sale     = _lastSale;
  const shopName = db.shop?.name || "MERX";
  const payLabels = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma" };
  const lines = [
    `🧾 ${shopName} — Chek`,
    `📌 ${sale.chekNum || "#"+sale.id} | ${sale.date} ${sale.time||""}`,
    ``,
    ...sale.items.map(i => `▪ ${i.name} (${i.variant}) × ${i.qty} ${i.unit} = ${fmt(i.price*i.qty)} so'm`),
    ``,
    sale.discount > 0 ? `Chegirma: -${fmt(sale.discount)} so'm` : null,
    `Jami: ${fmt(sale.total)} so'm`,
    `To'lov: ${payLabels[sale.payType]||sale.payType}`,
    sale.remaining > 0 ? `Qarz: ${sale.debtCurrency==="usd"&&sale.debtUsd ? "$"+sale.debtUsd.toFixed(2) : fmt(sale.remaining)+" so'm"}` : `✅ To'liq to'landi`,
    sale.due ? `Muddat: ${sale.due}` : null,
    ``,
    `Rahmat! Yana kutamiz 🙏`
  ].filter(l => l !== null).join("\n");

  // Telegram share dialog — istalgan chatga yuborish mumkin
  const url = `https://t.me/share/url?url=&text=${encodeURIComponent(lines)}`;
  window.open(url, "_blank");
}

function printReceiptPos() {
  if (!_lastSale) return;
  const sale     = _lastSale;
  const shopName = db.shop?.name || "MERX";
  const staffObj = db.staff.find(s => s.id === sale.staffId);
  const botUser  = (db.settings?.telegramBotUsername || "").replace(/^@/,"");
  const botUrl   = db.settings?.telegramBotUrl || "";
  const receiptUrl = botUrl
    ? `${botUrl}?action=receipt&id=${encodeURIComponent(sale.chekNum||("ID"+sale.id))}`
    : "";

  const html = buildReceiptHtml(sale, {
    shopName, staffName: staffObj?.name || "—",
    botUsername: botUser, receiptUrl
  });

  const w = window.open("","_blank","width=420,height=700");
  if (!w) { toast("Pop-up bloklangan","err"); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

// ── Tezkor miqdor ─────────────────────────────
function vmSetQty(n) {
  if ($("vm-qty")) { $("vm-qty").value = n; renderVmChips(); }
}

// ── Klaviatura shortcuts ──────────────────────
document.addEventListener("keydown", function(e) {
  // Agar input/textarea fokusda bo'lsa — qo'shmaymiz
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  // Faqat POS sahifasi ochiq bo'lganda
  if (!document.getElementById("p-pos")?.classList.contains("active")) return;

  if (e.key === "/" || e.key === "F2") {
    e.preventDefault();
    $("pos-q")?.focus();
  }
  if (e.key === "Escape") {
    ["variant","receipt","barcode"].forEach(m => closeModal(m));
    if ($("pos-q")) { $("pos-q").value = ""; posClear(); }
  }
  if (e.key === "Enter" && document.getElementById("ov-variant")?.style.display !== "none") {
    e.preventDefault();
    confirmVariant();
  }
  if (e.key === "F9") checkout();
});

// ── So'nggi mahsulotlar (qidiruv bo'sh bo'lganda) ──
function posShowRecent() {
  // Eng ko'p sotiladigan 8 ta (bugun yoki so'nggi 7 kunda)
  const salesCount = {};
  const weekAgo = addDays(today(), -7);
  db.sales.filter(s => s.date >= weekAgo).forEach(s => {
    s.items?.forEach(i => {
      const p = db.products.find(x => x.name === i.name);
      if (p) salesCount[p.sku] = (salesCount[p.sku]||0) + i.qty;
    });
  });
  const recent = [...db.products]
    .filter(p => totalStock(p) > 0)
    .sort((a, b) => (salesCount[b.sku]||0) - (salesCount[a.sku]||0))
    .slice(0, 8);

  if (!recent.length) {
    $("pos-results").innerHTML = `<div class="pos-empty">
      <i class="ti ti-search" style="font-size:42px;color:#e0ddd8;display:block;margin-bottom:14px"></i>
      <div style="font-size:14px;color:#bbb;margin-bottom:6px;font-weight:500">Mahsulot qidiring</div>
      <div style="font-size:12px;color:#ccc">Nom, SKU yoki barcode skanerlang</div>
    </div>`;
    return;
  }

  const rate = db.settings.rate || 12800;
  $("pos-results").innerHTML = `
    <div style="font-size:11px;color:#bbb;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;padding:0 2px">
      So'nggi qo'shilgan mahsulotlar
    </div>` +
    recent.map(p => {
      const narx  = posPriceType === "ulgurji" ? (p.ulgurjiNarx||p.priceUzs) : p.priceUzs;
      const st    = totalStock(p);
      const inBox = p.inBox || 1;
      const imgHtml = p.image
        ? `<img src="${p.image}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid var(--brd);flex-shrink:0">`
        : `<div style="width:52px;height:52px;border:1.5px dashed #e0ddd8;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#ddd;font-size:20px;flex-shrink:0"><i class="ti ti-photo"></i></div>`;
      const colorDots = [...new Set(p.variants.map(v => v.color))].slice(0,4).map(c => {
        const v = p.variants.find(x => x.color===c);
        return `<span class="pri-clr">
          <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${v?.hex||"#888"};border:1px solid rgba(0,0,0,.15);vertical-align:middle;margin-right:3px"></span>${c}</span>`;
      }).join("");
      return `<div class="pos-ri" onclick="openVariantModal('${p.sku}')">
        ${imgHtml}
        <div class="pri-body">
          <div class="pri-name">${p.name}</div>
          <div class="pri-meta">${p.category}${p.art ? ' · ' + p.art : ' · ' + p.sku}</div>
          <div class="pri-colors">${colorDots}</div>
        </div>
        <div class="pri-right">
          <div class="pri-price">${priceDisplay(narx)}</div>
          <div class="pri-stock ${st<=5?"low":""}">${st} ${p.unit||"dona"}${inBox>1?` (${Math.floor(st/inBox)} pochka)`:""}</div>
        </div>
      </div>`;
    }).join("");
}

// ── Oxirgi sotuv ──────────────────────────────
function showLastSale() {
  if (!db.sales.length) { toast("Hali sotuv yo'q","err"); return; }
  const last = db.sales[db.sales.length - 1];
  showReceiptModal(last);
}

// ── Muddati o'tgan qarz eslatmasi ────────────
function checkDebtAlerts() {
  const today_ = today();
  const overdue = db.sales.filter(s =>
    s.status === "qarz" && s.remaining > 0 && s.due && s.due < today_
  );
  const banner = $("debt-alert-banner");
  const text   = $("debt-alert-text");
  if (!banner || !text) return;

  if (overdue.length > 0) {
    const totalDebt = overdue.reduce((a, s) => a + (s.remaining||0), 0);
    text.textContent = `${overdue.length} ta muddati o'tgan qarz: ${fmt(totalDebt)} so'm`;
    banner.style.display = "block";
  } else {
    banner.style.display = "none";
  }
}
