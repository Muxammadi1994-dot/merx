
// ── Sidebar toggle ────────────────────────────────
let _sidebarHidden = false;
function togglePosSidebar() {
  _sidebarHidden = !_sidebarHidden;
  // document.body ga class qo'shamiz — CSS bilan sidebar va pos kengayadi
  document.body.classList.toggle("sb-hidden", _sidebarHidden);
  const btn = document.getElementById("pos-sidebar-btn");
  if (btn) btn.innerHTML = _sidebarHidden
    ? '<i class="ti ti-layout-sidebar-left-expand"></i>'
    : '<i class="ti ti-layout-sidebar-left-collapse"></i>';
}

// MERX pos.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/pos.js  (v4 — To'liq qayta yozildi)
// ================================================

// ── Parallel savatchalar tizimi ──────────────────
// Bir nechta mijozni navbat bilan xizmat qilish uchun: har biri alohida
// savatcha, to'lov holati va mijoz ma'lumoti bilan, localStorage orqali saqlanadi.
const POS_CARTS_KEY = "merx_pos_carts_v1";

function posLoadCarts() {
  try {
    const raw = localStorage.getItem(POS_CARTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.carts) && parsed.carts.length > 0) return parsed;
    }
  } catch (e) {}
  return { activeIdx: 0, carts: [{ id: 1, name: "Savatcha 1", items: [] }] };
}

function posSaveCarts() {
  try {
    posCartsState.carts[posCartsState.activeIdx].items = cart;
    localStorage.setItem(POS_CARTS_KEY, JSON.stringify(posCartsState));
  } catch (e) {}
}

let posCartsState = posLoadCarts();
let cart = posCartsState.carts[posCartsState.activeIdx].items;
let posPayMode = "full", posPayType = "naqd", posPriceType = "chakana";
let posLoyaltyPointsUsed = 0; // joriy chekka qo'llangan ball soni
let posDebtCurrency = "usd";  // Asosiy: USD

// ── Operatsiyalar tarixi (POS log) ────────────────
// Har bir muhim amal (qo'shish, o'chirish, chegirma, sotuv) shu yerga yoziladi.
function posLog(action, details) {
  if (!db.posLogs) db.posLogs = [];
  // Kassir — bloklangan bo'lsa settings dan olamiz
  const staffId = (() => {
    if (_staffLocked && db?.settings?.posLockedStaffId) return db.settings.posLockedStaffId;
    return parseInt(($("pos-staff")||{value:0}).value) || null;
  })();
  const staff = staffId ? (db.staff||[]).find(s => s.id === staffId) : null;
  db.posLogs.push({
    id: db.seq++,
    date: today(), time: nowTime(),
    action, details,
    staffId, staffName: staff ? staff.name : "—",
    cartName: posCartsState.carts[posCartsState.activeIdx]?.name || "—"
  });
  // Faqat oxirgi 500 ta yozuvni saqlaymiz (xotira tejash uchun)
  if (db.posLogs.length > 500) db.posLogs = db.posLogs.slice(-500);
  saveDB();
}
let vmProd = null, selColor = null, selSize = null, vmSellMode = "dona";

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
  let foundColor = null;
  let p = db.products.find(x =>
    x.sku.toLowerCase() === q || (x.barcode && x.barcode.toLowerCase() === q)
  );
  // colorBarcodes dan ham qidirish
  if (!p) {
    for (const prod of db.products) {
      if (!prod.colorBarcodes) continue;
      for (const [clr, bc] of Object.entries(prod.colorBarcodes)) {
        if (bc && bc.toLowerCase() === q) { p = prod; foundColor = clr; break; }
      }
      if (p) break;
    }
  }
  if (p) {
    toast("Topildi: " + p.name + (foundColor ? " — " + foundColor : ""), "info");
    if ($("pos-q")) { $("pos-q").value = p.art || p.sku; posSearch(); }
    // Rang aniqlangan bo'lsa avtomatik highlight
    if (foundColor) {
      setTimeout(() => {
        const rows = document.querySelectorAll("[data-rowkey]");
        rows.forEach(row => {
          if (row.dataset.rowkey && row.dataset.rowkey.includes("|" + foundColor + "|")) {
            row.style.outline = "2px solid #E9A500";
            setTimeout(() => { row.style.outline = ""; }, 2000);
          }
        });
      }, 300);
    }
  } else {
    if ($("pos-q")) { $("pos-q").value = code; posSearch(); }
    toast('Barcode: "' + code + '" — qolda tanlang', "info");
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

// ── Qidiruvda narxni tahrirlash ──────────────────
// Vaqtinchalik narxlar (faqat shu session, db ga saqlanmaydi)
const _priceOverrides = {};

function posEditPrice(rowId, sku, color) {
  const p = db.products.find(x => x.sku === sku);
  if (!p) return;
  const baseNarx = posPriceType === "ulgurji" ? (p.ulgurjiNarx || p.priceUzs) : p.priceUzs;
  const oKey = sku + "|" + color;
  const curNarx = _priceOverrides[oKey] || baseNarx;
  const el = document.getElementById("pripr-" + rowId);
  if (!el) return;

  const inp = document.createElement("input");
  inp.type = "text";
  inp.value = curNarx;
  inp.style.cssText = "width:90px;font-size:13px;font-weight:700;border:1.5px solid #E9A500;border-radius:7px;padding:3px 7px;text-align:right;font-family:inherit;color:#0D1B2A;background:#fff;outline:none";
  el.innerHTML = "";
  el.appendChild(inp);
  inp.focus(); inp.select();

  const save = () => {
    const newVal = parseFloat((inp.value||"").replace(/[\s]/g,"")) || curNarx;
    if (newVal !== baseNarx) {
      _priceOverrides[oKey] = newVal;
    } else {
      delete _priceOverrides[oKey];
    }
    posSearch();
    toast("Narx: " + fmt(newVal) + " so'm (faqat shu sotuv uchun)");
  };
  inp.addEventListener("blur", save);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
}

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

  // Har bir mahsulot + rang + pochka-guruhi = alohida qator (Billz uslubida)
  const rows = [];
  found.forEach(p => {
    const colors = [...new Set(p.variants.map(v => v.color))];
    colors.forEach(color => {
      const groups = typeof regroupPackages === "function"
        ? regroupPackages(p.variants, color)
        : [{ packGroup:0, isBroken:false,
             qty: Math.min(...p.variants.filter(v=>v.color===color).map(v=>v.qty)),
             variants: p.variants.filter(v=>v.color===color) }];
      groups.forEach(g => rows.push({ p, color, packGroup: g.packGroup, isBroken: g.isBroken, groupQty: g.qty, groupVariants: g.variants }));
    });
  });

  $("pos-results").innerHTML = rows.map(({p, color, packGroup, isBroken, groupQty, groupVariants}) => {
    const _oKey  = p.sku + "|" + color;
    const _baseNarx = posPriceType === "ulgurji" ? (p.ulgurjiNarx || p.priceUzs) : p.priceUzs;
    const narx  = (typeof _priceOverrides !== "undefined" && _priceOverrides[_oKey]) || _baseNarx;
    const _hasOverride = narx !== _baseNarx;
    const colorVariants = groupVariants;
    const _pi = packInfo(p, colorVariants);
    const inBox = _pi.inBox;
    const _reservedInOtherCarts = getReservedQty(p.sku, color);
    const maxPochka = Math.max(0, _pi.maxPochka - _reservedInOtherCarts);
    const sizesStr  = typeof sizesToRange === "function"
      ? sizesToRange(colorVariants.map(v => v.size).filter(Boolean), p.type)
      : colorVariants.map(v => v.size).join(", ");
    const hex = colorVariants[0]?.hex || "#888";
    const rowKey = `${p.sku}::${color}::${packGroup}`;
    const rowId = rowKey.replace(/[^a-zA-Z0-9]/g,'_');

    const rowImg = (p.colorImages && p.colorImages[color]) || p.image || "";
    const imgHtml = rowImg
      ? `<img src="${rowImg}" style="width:36px;height:36px;object-fit:cover;border-radius:7px;border:1px solid var(--brd);flex-shrink:0">`
      : "";

    return `<div class="pos-ri" style="align-items:center;flex-direction:column;align-items:stretch;${isBroken?'background:#FFFBF0;border-color:#f0d882':''}" data-rowkey="${rowKey}">
      <div style="display:flex;align-items:center;gap:14px">
        ${imgHtml}
        <div class="pri-body" style="min-width:0">
          <div class="pri-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${p.name}
            ${isBroken ? `<span style="background:#FEF3C7;color:#92400E;font-size:9px;font-weight:700;padding:1px 6px;border-radius:7px;margin-left:5px">ochilgan</span>` : ""}
          </div>
          <div class="pri-meta">
            <span style="width:8px;height:8px;border-radius:2px;background:${hex};border:1px solid rgba(0,0,0,.12);display:inline-block;flex-shrink:0"></span>
            <span style="font-weight:700;color:#1F2937">${color}</span>
            <span style="color:#CBD5E1">·</span>
            <span>${sizesStr || "—"}</span>
            ${p.art ? '<span style="color:#CBD5E1">·</span><span style="font-family:monospace;font-weight:700;color:#6B4FBB">' + p.art + '</span>' : ""}
            <span style="color:#CBD5E1">·</span>
            <span style="color:${maxPochka<=0?'#EF4444':maxPochka<=5?'#F59E0B':'#9CA3AF'}">
              ${maxPochka} pochka${_reservedInOtherCarts > 0 ? ' <span style="color:#E9A500;font-size:10px">('+_reservedInOtherCarts+' band)</span>' : ''}
            </span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <div style="text-align:right">
            <div style="display:flex;align-items:center;gap:5px;justify-content:flex-end;margin-bottom:2px">
              <div class="pri-price" id="pripr-${rowId}">
                ${_hasOverride ? `<span style="text-decoration:line-through;font-size:11px;color:#ccc;margin-right:3px">${priceDisplay(_baseNarx)}</span>` : ""}
                <span style="font-size:14px;font-weight:800;color:${_hasOverride?'#E9A500':'#E9A500'}">${priceDisplay(narx)}</span>
              </div>
              <button onclick="event.stopPropagation();posEditPrice('${rowId}','${p.sku}','${color.replace(/'/g,String.fromCharCode(39))}')" title="Narxni tahrirlash"
                style="width:22px;height:22px;border:1px solid #E8E5E0;border-radius:6px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0">
                <i class="ti ti-edit" style="font-size:11px;color:#94A3B8"></i>
              </button>
            </div>

          </div>
          <input type="number" min="1" max="${maxPochka}" placeholder="1" value="1"
            id="posq-${rowId}"
            style="width:52px;text-align:center;border:1.5px solid var(--brd);border-radius:7px;padding:6px 4px;font-weight:700;font-size:13px"
            onclick="event.stopPropagation();this.select()"
            onfocus="this.select()"
            oninput="event.stopPropagation();var v=parseInt(this.value)||1;if(v>${maxPochka}){this.value=${maxPochka};v=${maxPochka};}">
          <button class="btn btn-ghost btn-sm" style="padding:8px 7px;font-size:10.5px"
            onclick="event.stopPropagation();posToggleDonaMode('${rowId}')"
            title="Dona bo'yicha sotish" id="posdona-btn-${rowId}">
            <i class="ti ti-grid-dots"></i>
          </button>
          <button class="btn btn-acc btn-sm" style="padding:8px 10px"
            onclick="event.stopPropagation();posQuickAdd('${p.sku}','${color.replace(/'/g,"\\'")}','${packGroup}')"
            ${maxPochka<=0?"disabled":""}>
            <i class="ti ti-plus"></i>
          </button>
        </div>
      </div>
      <div id="posdona-panel-${rowId}" style="display:none;margin-top:8px;padding-top:8px;border-top:1px dashed var(--brd)">
        <div style="font-size:10.5px;color:var(--mut);margin-bottom:5px">O'lcham bo'yicha dona sotish:</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${colorVariants.map(v => `
            <div style="display:flex;align-items:center;gap:3px;background:var(--bg);border:1.5px solid var(--brd);border-radius:7px;padding:3px 5px">
              <span style="font-size:11px;font-weight:600;min-width:20px;text-align:center;color:${v.qty<=0?'#ccc':'inherit'}">${v.size}</span>
              <input type="number" min="0" max="${v.qty}" placeholder="0" value="0" ${v.qty<=0?'disabled':''}
                id="posdq-${rowId}-${v.size}"
                style="width:36px;text-align:center;border:none;background:transparent;font-size:11px;font-weight:700">
            </div>`).join("")}
        </div>
        <button class="btn btn-acc btn-sm" style="margin-top:6px;width:100%"
          onclick="posDonaAdd('${p.sku}','${color.replace(/'/g,"\\'")}','${rowId}')">
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
      image: (p.colorImages && p.colorImages[color]) || p.image || null, art: p.art || null, barcode: p.barcode || null
    });
    addedTotal += qtyWanted;
    if ($(inputId)) $(inputId).value = 0;
  });

  if (addedTotal > 0) {
    toast(`${p.name} (${color}) — ${addedTotal} dona savatchaga qo'shildi`);
    posLog("Savatga qo'shildi", `${p.name} (${color}) — ${addedTotal} dona`);
    renderCart();
  } else {
    toast("O'lcham va son kiriting", "err");
  }
}

// Qidiruv natijasidan to'g'ridan-to'g'ri savatga qo'shish (pochka rejimida)
// ── B2 (v161): pochka hisobi — yagona variant (jami dona) yoki eski
// o'lchamlab model, ikkalasiga ham mos ─────────────────────────────
function packInfo(p, variants) {
  const vs = variants || [];
  const single = vs.length === 1;
  const inBox = single ? ((p && p.inBox) || 1) : (vs.length || 1);
  const totalQty = vs.reduce((a, v) => a + (v.qty || 0), 0);
  const maxPochka = single
    ? Math.floor(totalQty / (inBox || 1))
    : (vs.length ? Math.min(...vs.map(v => v.qty || 0)) : 0);
  return { inBox, maxPochka, totalQty, single };
}

function posQuickAdd(sku, color, packGroup) {
  const p = db.products.find(x => x.sku === sku); if (!p) return;
  packGroup = packGroup !== undefined ? parseInt(packGroup) : 0;
  const rowKey = `${sku}::${color}::${packGroup}`;
  const inputId = `posq-${rowKey.replace(/[^a-zA-Z0-9]/g,'_')}`;
  const qtyInput = parseInt(($(inputId)||{value:1}).value) || 1;

  // Shu pochka guruhiga tegishli variantlarni topamiz
  const groups = typeof regroupPackages === "function" ? regroupPackages(p.variants, color) : [];
  const g = groups[packGroup];
  if (!g) { toast("Guruh topilmadi", "err"); return; }

  const groupSizes = g.variants.map(v => v.size);
  const _pi = packInfo(p, g.variants);
  const maxPochka = _pi.maxPochka;
  const inBox = _pi.inBox;

  const alreadyInCart = cart.find(c => c.sku===sku && c.color===color && c.sellMode==="karobka" && c.packGroup===packGroup);
  const alreadyBoxes  = alreadyInCart ? (alreadyInCart.qtyBox||0) : 0;

  // Boshqa savatlarda band qilingan stokni hisobga olamiz
  const _otherReserved = getReservedQty(sku, color) - alreadyBoxes;
  const _limit = Math.max(0, maxPochka - _otherReserved); // aktiv savatga mumkin maksimal
  const _freeAdd = Math.max(0, _limit - alreadyBoxes);    // yana qo'shish mumkin

  if (_freeAdd <= 0 && qtyInput > 0) {
    const msg = _otherReserved > 0
      ? `Boshqa savatlarda ${_otherReserved} pochka band. Stok tugagan`
      : `Stok tugagan`;
    toast(msg, "err"); return;
  }
  // qtyInput limitdan oshsa — avtomat kesib olamiz
  const _actualAdd = Math.min(qtyInput, _freeAdd);
  if (_actualAdd < qtyInput) {
    toast(`${_actualAdd} pochka qo'shildi (limit: ${_limit} pochka${_otherReserved>0?', '+_otherReserved+' boshqa savatda band':''})`, "info");
  }

  const _bNarx = posPriceType === "ulgurji" ? (p.ulgurjiNarx || p.priceUzs) : p.priceUzs;
  const narx = (typeof _priceOverrides !== "undefined" && _priceOverrides[sku+"|"+color]) || _bNarx;
  const _safeAdd  = _actualAdd; // avtomat kesib olingan qiymat
  const totalDona = _safeAdd * inBox;

  if (alreadyInCart) {
    alreadyInCart.qty += totalDona;
    alreadyInCart.qtyBox = (alreadyInCart.qtyBox||0) + _safeAdd;
  } else {
    cart.push({
      sku, name: p.name, color, size: null,
      unit: p.unit||"dona", price: narx, basePrice: _bNarx, priceType: posPriceType,
      qty: totalDona, qtyBox: qtyInput, inBox, sellMode: "karobka",
      packGroup, groupSizes,
      image: (p.colorImages && p.colorImages[color]) || p.image || null, art: p.art || null, barcode: p.barcode || null
    });
  }

  toast(`${p.name} (${color}) × ${qtyInput} pochka savatchaga qo'shildi`);
  posLog("Savatga qo'shildi", `${p.name} (${color}) — ${qtyInput} pochka`);
  renderCart();
  // Inputni 1 ga qaytaramiz
  if ($(inputId)) $(inputId).value = 1;
}

function posClear() {
  if ($("pos-q")) $("pos-q").value = "";
  posSearch();
  $("pos-q")?.focus();
}


// ── Barcha savatlardagi band stok ────────────────
// Boshqa savatlarda band qilingan tovar miqdorini qaytaradi
function getReservedQty(sku, color, packGroup) {
  var total = 0;
  posCartsState.carts.forEach(function(cart, ci) {
    cart.items.forEach(function(it) {
      if (it.sku === sku && it.color === color) {
        total += it.qtyBox || 0;
      }
    });
  });
  return total;
}

// Hozirgi aktiv savatdagi miqdor (boshqalardan tashqari)
// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function getCurrentCartQty(sku, color) {
  var total = 0;
  var cart = posCartsState.carts[posCartsState.activeIdx] || {items:[]};
  cart.items.forEach(function(it) {
    if (it.sku === sku && it.color === color) {
      total += it.qtyBox || 0;
    }
  });
  return total;
}

function renderPosGrid() {
  // Bloklash holatini settings dan yuklaymiz
  if (db && db.settings) {
    _payBlocked = JSON.parse(JSON.stringify(db.settings.posPayBlocked || {}));
  }
  _applyPayBlocked();
  posUpdatePriceTypeVisibility();
  posSearch();
  renderCartTabs();
  renderCart();
  setTimeout(() => {
    const n = $("pos-note");
    if (n) { n.value = ""; n.setAttribute("readonly", true); }
  }, 150);
}

// Agar hech bir mahsulotda chakana narx (priceUzs) kiritilmagan bo'lsa,
// "Ulgurji/Chakana" tanlash panelini butunlay yashiramiz — kerak emas.
function posUpdatePriceTypeVisibility() {
  const hasChakana = db.products.some(p => p.priceUzs > 0);
  const wrap = $("price-type-wrap");
  if (wrap) wrap.style.display = hasChakana ? "block" : "none";
  if (!hasChakana && posPriceType !== "ulgurji") {
    posPriceType = "ulgurji";
  }
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

  // Savatchadagi mavjud mahsulotlar narxini ham yangilaymiz —
  // faqat qo'lda o'zgartirilmagan (override qilinmagan) narxlarni
  let updatedCount = 0;
  cart.forEach(c => {
    const isOverride = c.basePrice && c.basePrice !== c.price;
    if (isOverride) return; // sotuvchi qasddan boshqa narx qo'ygan — tegmaymiz
    const p = db.products.find(x => x.sku === c.sku); if (!p) return;
    const newBase = t === "ulgurji" ? (p.ulgurjiNarx || p.priceUzs) : p.priceUzs;
    if (newBase !== c.price) updatedCount++;
    c.price = newBase;
    c.basePrice = newBase;
    c.priceType = t;
  });
  if (updatedCount > 0) {
    toast(`${updatedCount} ta tovar narxi ${t === "ulgurji" ? "ulgurji" : "chakana"}ga yangilandi`, "info");
  }

  posSearch(); renderCart();
}

// ── Variant modal ─────────────────────────────────
// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
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
    const maxPochka = packInfo(vmProd, colorVariants).maxPochka;
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
    const colorVariants = vmProd.variants.filter(v => v.color===selColor);
    const maxPochka = packInfo(vmProd, colorVariants).maxPochka;
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
  posSaveCarts(); // savatcha holatini har render da localStorage ga saqlaymiz
  renderCartTabs();
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
    $("cart-total").textContent = "0 so'm"; updatePayTotal(); updatePayRemaining(); return;
  }

  $("cart-items").innerHTML = cart.map((c, i) => {
    // Rang hex
    const _vHex = (() => {
      const p2 = db.products.find(x => x.sku === c.sku);
      const v2 = p2?.variants.find(v => v.color === c.color);
      return v2?.hex || "#888";
    })();
    const variantLine = c.sellMode === "karobka"
      ? `<span style="width:9px;height:9px;border-radius:2px;background:${_vHex};border:1px solid rgba(0,0,0,.12);display:inline-block;vertical-align:middle;margin-right:3px"></span><span style="font-weight:700;color:#111">${c.color}</span> <span style="color:#9CA3AF">·</span> <span style="font-weight:700;color:#E9A500">📦 ${c.qtyBox} pochka</span>${c.art ? ' <span style="color:#9CA3AF">·</span> <span style="font-family:monospace;font-weight:700;color:#6B4FBB;font-size:11px">' + c.art + '</span>' : ''}`
      : `<span style="width:9px;height:9px;border-radius:2px;background:${_vHex};border:1px solid rgba(0,0,0,.12);display:inline-block;vertical-align:middle;margin-right:3px"></span><span style="font-weight:700;color:#111">${c.color}</span>${c.size ? ' <span style="color:#9CA3AF">·</span> ' + c.size : ''}${c.art ? ' <span style="color:#9CA3AF">·</span> <span style="font-family:monospace;font-weight:700;color:#6B4FBB;font-size:11px">' + c.art + '</span>' : ''}`;
    const isOverride = c.basePrice && c.basePrice !== c.price;
    const priceTag = `<span style="display:flex;align-items:center;gap:4px;justify-content:flex-end">
      ${isOverride ? `<span style="text-decoration:line-through;color:#ccc;font-size:10.5px">${priceDisplay(c.basePrice*c.qty)}</span>` : ""}
      <span class="ci-pr" style="color:${isOverride?'#E9A500':'inherit'};cursor:pointer" onclick="event.stopPropagation();ciEditPrice(${i})" title="Narxni o'zgartirish">${priceDisplay(c.price*c.qty)}</span>
      <button onclick="event.stopPropagation();ciEditPrice(${i})" title="Narxni o'zgartirish"
        style="width:20px;height:20px;border:1px solid #E8E5E0;border-radius:5px;background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;flex-shrink:0">
        <i class="ti ti-edit" style="font-size:10px;color:#94A3B8"></i>
      </button>
    </span>`;
    const subLine = c.sellMode === "karobka"
      ? `${c.qty} ${c.unit} · ${priceDisplay(c.price)}/${c.unit}${isOverride?` <span style="color:#E9A500;font-size:10px">(o'zgartirilgan)</span>`:""}`
      : isOverride ? `<span style="color:#E9A500;font-size:10.5px">Narx o'zgartirilgan: ${priceDisplay(c.basePrice)} → ${priceDisplay(c.price)}</span>` : "";
    return `<div class="ci">
      <div class="ci-inf">
        <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin-bottom:2px">
          <span class="ci-nm">${c.name}</span>
          <span style="font-size:11.5px">${variantLine}</span>
        </div>
        ${subLine ? `<div style="font-size:11px;color:#9CA3AF;margin-bottom:2px">${subLine}</div>` : ""}
        <div class="ci-row">
          <div class="qty-ctrl">
            <button onclick="ciQty(${i},-1)">−</button>
            <input type="number" value="${c.sellMode==='karobka' ? c.qtyBox : c.qty}" min="1"
              onfocus="this.select()"
              onclick="this.select()"
              oninput="ciQtyLimit(${i},this)"
              onblur="ciQtySet(${i},+this.value)"
              onkeydown="if(event.key==='Enter'){this.blur();}"
              style="width:44px;text-align:center;border:none;outline:none;font-weight:600">
            <button onclick="ciQty(${i},1)">+</button>
            ${c.sellMode==='karobka' ? `<span style="font-size:10px;color:#bbb;margin-left:3px">${c.unit==='dona'?'pochka':'pochka'}</span>` : ""}
          </div>
          ${priceTag}
          <button class="ci-rm" onclick="removeFromCart(${i})"><i class="ti ti-x"></i></button>
        </div>
      </div>
    </div>`;
  }).join("");

  // cart-total: chegirmadan keyingi narx
  const cartTotalEl = $("cart-total");
  if (cartTotalEl) {
    if (discount > 0) {
      cartTotalEl.innerHTML = `<span style="text-decoration:line-through;font-size:12px;color:#bbb;margin-right:4px">${priceDisplay(subtotal)}</span><span style="color:#E9A500">${priceDisplay(total)}</span>`;
    } else {
      cartTotalEl.textContent = priceDisplay(total);
    }
  }
  // Savat qiymati badge
  const cvv = $("cart-value-val");
  if (cvv) {
    if (discount > 0) {
      cvv.innerHTML = `<span style="text-decoration:line-through;font-size:11px;color:#aaa;margin-right:3px">${priceDisplay(subtotal)}</span>${priceDisplay(total)}`;
    } else {
      cvv.textContent = priceDisplay(total);
    }
  }
  updatePayTotal();
  updatePayRemaining();
  if (posPayType === "aralash") updateMixedTotal();
}

// Savatchadagi mahsulot uchun maksimal mumkin bo'lgan miqdorni hisoblash
function ciGetMax(c) {
  const p = db.products.find(x => x.sku === c.sku); if (!p) return Infinity;
  // Boshqa savatlarda band qilingan miqdor (aktiv savatdagi bu item ni chiqarib)
  var otherReserved = 0;
  posCartsState.carts.forEach(function(ct, ci) {
    if (ci === posCartsState.activeIdx) return; // aktiv savatni o'tkazib yuboramiz
    ct.items.forEach(function(it) {
      if (it.sku === c.sku && it.color === c.color) {
        otherReserved += it.qtyBox || 0;
      }
    });
  });

  if (c.sellMode === "karobka") {
    const groups = typeof regroupPackages === "function" ? regroupPackages(p.variants, c.color) : [];
    const g = groups[c.packGroup || 0];
    const totalQty = g ? g.qty : 0;
    return Math.max(0, totalQty - otherReserved);
  } else {
    const v = p.variants.find(x => x.color === c.color && x.size === c.size);
    const totalQty = v ? v.qty : 0;
    return Math.max(0, totalQty - otherReserved);
  }
}


// ── Savatda narxni tahrirlash ─────────────────────
function ciEditPrice(idx) {
  const c = cart[idx]; if (!c) return;
  if (!c.basePrice) c.basePrice = c.price;
  const oldPrice = c.price;
  const newPriceStr = prompt(
    c.name + " narxini o'zgartiring\n" +
    "Hozirgi: " + fmt(oldPrice) + " so'm\n" +
    "Yangi narxni kiriting:",
    oldPrice
  );
  if (newPriceStr === null) return;
  const newPrice = parseFloat((newPriceStr||"").replace(/\s/g,"")) || oldPrice;
  if (newPrice <= 0) { toast("Narx 0 bo'lishi mumkin emas","err"); return; }
  c.price = newPrice;
  if (!c.basePrice || c.basePrice === newPrice) c.basePrice = null;
  renderCart();
  toast("Narx o'zgartirildi: " + fmt(newPrice) + " so'm");
}

function ciQty(i, d) {
  const c = cart[i];
  const max = ciGetMax(c);
  if (c.sellMode === "karobka" && c.inBox) {
    // Pochka rejimi: avval pochka sonini o'zgartiramiz, keyin jami donani hisoblaymiz
    const newBoxes = Math.max(1, (c.qtyBox || 1) + d);
    if (newBoxes > max) { toast(`Faqat ${max} pochka bor`, "err"); return; }
    c.qtyBox = newBoxes;
    c.qty = c.qtyBox * c.inBox;
  } else {
    const newQty = Math.max(1, c.qty + d);
    if (newQty > max) { toast(`Faqat ${max} ${c.unit||"dona"} bor`, "err"); return; }
    c.qty = newQty;
  }
  renderCart();
}

// Savatda qty input — yozish paytida faqat limit tekshiradi
function ciQtyLimit(i, inp) {
  const c = cart[i]; if (!c) return;
  const v = parseInt(inp.value) || 1;
  const max = ciGetMax(c);
  if (v > max && max > 0) {
    inp.value = max;
    inp.style.color = "#E9A500";
    setTimeout(() => { inp.style.color = ""; }, 800);
  } else {
    inp.style.color = "";
  }
}

function ciQtySet(i, v) {
  const c = cart[i];
  const max = ciGetMax(c);
  if (c.sellMode === "karobka" && c.inBox) {
    let newBoxes = Math.max(1, v || 1);
    if (newBoxes > max) { toast(`Faqat ${max} pochka bor`, "err"); newBoxes = max; }
    c.qtyBox = newBoxes;
    c.qty = c.qtyBox * c.inBox;
  } else {
    let newQty = Math.max(1, v || 1);
    if (newQty > max) { toast(`Faqat ${max} ${c.unit||"dona"} bor`, "err"); newQty = max; }
    c.qty = newQty;
  }
  renderCart();
}
function removeFromCart(i) {
  const c = cart[i];
  if (c) posLog("Savatdan o'chirildi", `${c.name} (${c.color||""}) — ${c.qty} ${c.unit||"dona"}`);
  cart.splice(i, 1); posSaveCarts(); renderCart();
}
function clearCart() {
  if (cart.length > 0) posLog("Savatcha tozalandi", `${cart.length} ta tovar olib tashlandi`);
  cart.length = 0; posSaveCarts(); renderCart();
  // 2026-07-12: to'lov maydonlari HAM tozalanadi. Avval faqat savat
  // bo'shatilib, Naqd/Karta/O'tkazma summalari QOLIB ketardi — sotuvni
  // tugatmasdan savatni tozalab qayta to'ldirsa, ESKI summalar
  // saqlanib qolardi va shu tufayli auto-to'ldirish (payFocusAutofill)
  // "allaqachon qiymat bor" deb ishlamay qolgandek ko'rinardi.
  if (typeof posResetPayFields === "function") posResetPayFields();
}

// ── Savatchalar orasida almashish ─────────────────
function renderCartTabs() {
  const el = $("cart-tabs"); if (!el) return;
  el.innerHTML = posCartsState.carts.map((c, i) => {
    const isActive = i === posCartsState.activeIdx;
    const count = c.items.reduce((a, it) => a + it.qty, 0);
    return `<div onclick="posSwitchCart(${i})" style="display:flex;align-items:center;gap:5px;
      padding:6px 10px;border-radius:9px;cursor:pointer;white-space:nowrap;font-size:12.5px;font-weight:600;
      background:${isActive?"var(--acc)":"rgba(255,255,255,.08)"};
      color:${isActive?"#0D1B2A":"rgba(255,255,255,.65)"};transition:.15s">
      <i class="ti ti-shopping-cart" style="font-size:13px"></i>
      <span ondblclick="event.stopPropagation();posRenameCart(${i})" title="Ikki marta bosib nomini o'zgartiring">${c.name}</span>
      ${count > 0 ? `<span style="background:${isActive?"rgba(13,27,42,.2)":"rgba(255,255,255,.15)"};
        border-radius:8px;padding:1px 6px;font-size:10.5px">${count}</span>` : ""}
      ${posCartsState.carts.length > 1 ? `<i class="ti ti-x" style="font-size:12px;margin-left:2px;opacity:.6"
        onclick="event.stopPropagation();posCloseCart(${i})"></i>` : ""}
    </div>`;
  }).join("") + `
    <button onclick="posAddCart()" title="Yangi savatcha" style="background:rgba(255,255,255,.08);
      border:1px dashed rgba(255,255,255,.3);color:rgba(255,255,255,.7);border-radius:9px;
      padding:6px 10px;cursor:pointer;font-size:12.5px;white-space:nowrap">
      <i class="ti ti-plus"></i>
    </button>`;
}

// v170: Tab (savatcha) almashganda TO'LOV PANELINI ham tozalaymiz —
// avval bu maydonlar tab'larga umuman bog'lanmagan edi, natijada
// bir tab'da yozilgan Naqd/Karta boshqa tab'ga o'tganda ham qolib,
// noto'g'ri sotuvga qo'shilib ketishi mumkin edi (jiddiy pul xatosi).
// v170: To'lov maydoniga kursor qo'yilganda (agar bo'sh bo'lsa) avtomat
// "qolgan summa"ni joylaydi — kassir har safar terib o'tirishi shart
// emas, faqat kerak bo'lsa tuzatadi. Bloklangan (lock) maydonlarga
// tegilmaydi.
function payFocusAutofill(method) {
  if (_payBlocked[method]) return; // qulflangan — tegmaymiz
  const el = $("pay-" + method);
  if (!el) return;
  const cur = getRawVal("pay-" + method);
  if (cur > 0) return; // allaqachon qiymat bor — foydalanuvchi o'zi kiritmoqchi, tegmaymiz

  const total = _cartTotal();
  // v171: "qarz" HECH QACHON hisobga olinmaydi — u mustaqil kiritilgan
  // to'lov emas, balki onPayInput() orqali "qolgan summa"ni aks
  // ettiruvchi HOSILA maydon. Uni ham chegirib tashlasak, ikki
  // mexanizm bir-birini bekor qilib, natija noto'g'ri 0 chiqib qolardi
  // (aynan shu sabab Kartaga o'tganda avtomat joylash ishlamagan edi).
  const realMethods = ["naqd", "karta", "otkazma"];
  const others = realMethods
    .filter(m => m !== method)
    .reduce((a, m) => a + (getRawVal("pay-" + m) || 0), 0);
  const remaining = Math.max(0, Math.round(total - others));
  if (remaining > 0) {
    el.value = fmt(remaining);
    el.dataset.raw = String(remaining);
    el.select(); // darhol tahrirlashga tayyor (ustidan yozish oson bo'lsin)
    if (typeof onPayInput === "function") onPayInput(method);
  }
}

function posResetPayFields() {
  ["pay-naqd","pay-karta","pay-otkazma","pay-qarz"].forEach(id => {
    const el = $(id); if (el) { el.value = ""; el.dataset.raw = ""; }
  });
  if (typeof setPayMode === "function") setPayMode("full");
  // 2026-07-12: standart har doim USD (asosiy qarz valyutasi — 46-qator
  // e'lonidagi standart bilan MOS). Avval bu yerda "uzs"ga qaytarilardi —
  // oldingi sotuvda USD tanlangan bo'lsa, indikator bir marta bosilib
  // "yangilanmaguncha" noto'g'ri (so'm) ko'rinib qolardi.
  if (typeof setDebtCurrency === "function") setDebtCurrency("usd");
  const pr = $("pay-remaining"); if (pr) { pr.textContent = "0"; pr.style.color = "#22C55E"; }
  const mb = $("pay-mode-badge"); if (mb) mb.innerHTML = "";
  const nb = $("nasiya-box"); if (nb) nb.style.display = "none";
}

function posSwitchCart(idx) {
  if (idx === posCartsState.activeIdx) return;
  posSaveCarts(); // joriy savatchani saqlab qo'yamiz
  posCartsState.activeIdx = idx;
  cart = posCartsState.carts[idx].items;
  posSaveCarts();
  posResetPayFields(); // v170
  renderCartTabs();
  renderCart();
}


// ── Savat nomini tahrirlash ───────────────────────
function posRenameCart(idx) {
  const cart = posCartsState.carts[idx];
  if (!cart) return;
  const newName = prompt("Savatcha nomi:", cart.name);
  if (newName && newName.trim()) {
    cart.name = newName.trim();
    renderCartTabs();
    toast("Savatcha nomi o'zgartirildi");
  }
}

function posAddCart() {
  posSaveCarts();
  const newId = Math.max(0, ...posCartsState.carts.map(c => c.id)) + 1;
  posCartsState.carts.push({ id: newId, name: `Savatcha ${newId}`, items: [] });
  posCartsState.activeIdx = posCartsState.carts.length - 1;
  cart = posCartsState.carts[posCartsState.activeIdx].items;
  posSaveCarts();
  posResetPayFields(); // v170
  renderCartTabs();
  renderCart();
  toast(`Yangi savatcha ochildi`);
}

function posCloseCart(idx) {
  if (posCartsState.carts.length <= 1) { toast("Kamida 1 ta savatcha qolishi kerak", "err"); return; }
  const c = posCartsState.carts[idx];
  if (c.items.length > 0 && !confirm(`"${c.name}" da ${c.items.length} ta tovar bor. Yopilsinmi?`)) return;

  posCartsState.carts.splice(idx, 1);
  if (posCartsState.activeIdx >= posCartsState.carts.length) {
    posCartsState.activeIdx = posCartsState.carts.length - 1;
  } else if (idx < posCartsState.activeIdx) {
    posCartsState.activeIdx--;
  }
  cart = posCartsState.carts[posCartsState.activeIdx].items;
  posSaveCarts();
  posResetPayFields(); // v170
  renderCartTabs();
  renderCart();
}

// ── To'lov ────────────────────────────────────────
// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function setPayType(t) {
  // Nasiya ruxsatini tekshirish
  if (t === "nasiya") {
    // Kassir — bloklangan bo'lsa settings dan olamiz
  const staffId = (() => {
    if (_staffLocked && db?.settings?.posLockedStaffId) return db.settings.posLockedStaffId;
    return parseInt(($("pos-staff")||{value:0}).value) || null;
  })();
    const staff   = staffId ? (db.staff||[]).find(s=>s.id===staffId) : null;
    if (staff && !staff.permNasiya) {
      toast("Bu kassirda nasiya berish huquqi yo'q","err"); return;
    }
  }
  posPayType = t;
  document.querySelectorAll(".ptbtn").forEach(b => b.classList.toggle("on", b.dataset.pt === t));
  const mixBox = $("mixed-pay-box");
  if (mixBox) mixBox.style.display = t === "aralash" ? "block" : "none";
  if (t === "aralash") updateMixedTotal();
}

// Aralash to'lovda usul checkbox bosilganda — input ni yoqish/o'chirish
// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function toggleMixMethod(method) {
  const chk = $(`mix-${method}-chk`);
  const inp = $(`mix-${method}-sum`);
  if (!chk || !inp) return;
  inp.disabled = !chk.checked;
  if (!chk.checked) inp.value = "";
  updateMixedTotal();
}

// Aralash to'lovdagi barcha usullar yig'indisini hisoblash
function getMixedTotal() {
  let total = 0;
  ["naqd","karta","otkazma"].forEach(m => {
    const chk = $(`mix-${m}-chk`);
    if (chk && chk.checked) total += getRawVal(`mix-${m}-sum`);
  });
  return total;
}

function updateMixedTotal() {
  const mixedTotal = getMixedTotal();
  if ($("mix-total-view")) $("mix-total-view").textContent = priceDisplay(mixedTotal);

  // Savatcha jami summasi bilan solishtirib, qolgan/ortiqcha ko'rsatamiz
  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const discount = calcDiscount(subtotal);
  const cartTotal = subtotal - discount;

  const diffLbl = $("mix-diff-label");
  const diffView = $("mix-diff-view");
  if (!diffLbl || !diffView) return;
  if (diffLbl && diffView) {
    if (posPayMode === "part") {
      // Nasiya rejimida — "Jami summa" ko'rsatiladi, qarz pastda alohida hisoblanadi
      diffLbl.textContent = "Jami summa:";
      diffView.textContent = priceDisplay(cartTotal);
      diffView.style.color = "#0D1B2A";
    } else {
      const diff = cartTotal - mixedTotal;
      if (diff > 0) {
        diffLbl.textContent = "Yetishmaydi:";
        diffView.textContent = priceDisplay(diff);
        diffView.style.color = "var(--red)";
      } else if (diff < 0) {
        diffLbl.textContent = "Ortiqcha:";
        diffView.textContent = priceDisplay(-diff);
        diffView.style.color = "#E07B39";
      } else {
        diffLbl.textContent = "Mos keldi:";
        diffView.textContent = "✓ " + fmt(cartTotal) + " so'm";
        diffView.style.color = "var(--grn)";
      }
    }
  }

  // Aralash to'lov natijasini "Hozir to'landi" maydoniga ham sinxron qilamiz
  // (agar Nasiya rejimida bo'lsa, qarz avtomatik hisoblanishi uchun)
  if (posPayMode === "part" && $("c-paid")) {
    $("c-paid").value = mixedTotal > 0 ? fmt(mixedTotal) : "";
    updateRem();
  }
}

// ── YANGI TO'LOV PANELI ─────────────────────────
// 4 ustun: naqd/karta/otkazma/qarz
// Har biri input — yozilsa qolgan avtomatik hisoblanadi
// Bloklash holatlari — db.settings da saqlanadi (har sessiyada saqlanib qoladi)
var _payBlocked  = {};
var _staffLocked = false;

function onPayInput(method) {
  const total = _cartTotal();
  if (total <= 0) return;
  let vals = _getPayVals();

  // 2026-07-11 (AbuSaxiy №6): ORTIQCHA TO'LOV QULFI — Naqd+Karta+
  // O'tkazma yig'indisi savat jamidan OSHIB KETSA, hozir yozilayotgan
  // maydon avtomatik chegaraga tushiriladi. "Qarz" maydoni hosila —
  // unga tegilmaydi. Kam to'lash (qisman/nasiya) avvalgidek erkin.
  if (method !== "qarz") {
    const paid0 = vals.naqd + vals.karta + vals.otkazma;
    if (paid0 > total) {
      const el = $("pay-" + method);
      if (el) {
        const fixed = Math.max(0, getRawVal("pay-" + method) - (paid0 - total));
        el.value = fixed > 0 ? fmt(fixed) : "";
        // MUHIM: getRawVal dataset.raw'dan o'qiydi — uni ham yangilamasak,
        // qulf faqat ko'rinishda bo'lib, checkout eski katta sonni olardi
        el.dataset.raw = fixed > 0 ? String(fixed) : "";
        toast(`Savat jami ${fmt(total)} so'm — undan ortiq yozib bo'lmaydi`, "err");
        vals = _getPayVals();
      }
    }
  }
  const paid = vals.naqd + vals.karta + vals.otkazma;

  // Avtomat qarz: qolgan summa qarz inputga
  if (method !== "qarz" && !_payBlocked["qarz"]) {
    const rem = Math.max(0, total - paid);
    const qi = $("pay-qarz");
    if (qi) {
      // 2026-07-12: dataset.raw ATAYLAB yangilanadi — bo'lmasa keyingi
      // sotuvda (yoki shu sotuv o'chirilib qayta yozilganda) getRawVal
      // ESKI qiymatni "eslab qolardi" (dataset.raw value'dan USTUN
      // o'qiladi). Aynan shu — "eski qiymatlarni saqlab qolish" bagi.
      qi.value = rem > 0 && paid > 0 ? fmt(rem) : "";
      qi.dataset.raw = rem > 0 && paid > 0 ? String(rem) : "";
    }
  }

  updatePayRemaining();
}

function _getPayVals() {
  return {
    naqd:    getRawVal("pay-naqd"),
    karta:   getRawVal("pay-karta"),
    otkazma: getRawVal("pay-otkazma"),
    qarz:    getRawVal("pay-qarz"),
  };
}

function _cartTotal() {
  const subtotal = cart.reduce((a,c) => a + c.price * c.qty, 0);
  return subtotal - calcDiscount(subtotal);
}

function updatePayRemaining() {
  const total = _cartTotal();
  const vals  = _getPayVals();
  const paid  = vals.naqd + vals.karta + vals.otkazma;
  const qarz  = vals.qarz;
  const sum   = paid + qarz;
  const rem   = Math.max(0, total - sum);

  const remEl  = $("pay-remaining");
  const modeBg = $("pay-mode-badge");

  if (remEl) {
    if (total <= 0) {
      remEl.textContent = "0"; remEl.style.color = "#22C55E";
    } else if (sum <= 0) {
      // Hech narsa yozilmagan — jami summani ko'rsatamiz
      remEl.textContent = priceDisplay(total); remEl.style.color = "#64748B";
    } else if (rem > 0) {
      remEl.textContent = priceDisplay(rem); remEl.style.color = "#E05A5A";
    } else {
      remEl.textContent = "0"; remEl.style.color = "#22C55E";
    }
  }

  if (modeBg) {
    if (qarz > 0) {
      modeBg.innerHTML = `<span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:12px;font-size:11.5px;font-weight:700">Nasiya</span>`;
    } else if (sum >= total && total > 0) {
      modeBg.innerHTML = `<span style="background:#D1FAE5;color:#065F46;padding:2px 8px;border-radius:12px;font-size:11.5px;font-weight:700">To'liq</span>`;
    } else {
      modeBg.innerHTML = "";
    }
  }

  // Nasiya bloki
  const nastBox = $("nasiya-box");
  if (nastBox) nastBox.style.display = qarz > 0 ? "block" : "none";

  // Eski updateRem ham chaqiramiz (qarz to'lov uchun)
  updateRem();
}

function updatePayTotal() {
  const total = cart.reduce((a,c)=>a+c.price*c.qty,0)-calcDiscount(cart.reduce((a,c)=>a+c.price*c.qty,0));
  const el = $("pos-pay-total");
  if (el) el.textContent = priceDisplay(total);
}

function toggleStaffLock() {
  _staffLocked = !_staffLocked;
  if (typeof db !== "undefined") {
    if (!db.settings) db.settings = {};
    db.settings.posStaffLocked = _staffLocked;
    // Bloklanganda hozirgi kassir ID ni ham saqlaymiz
    if (_staffLocked) {
      const sel = $("pos-staff");
      const sid = sel ? parseInt(sel.value)||null : null;
      db.settings.posLockedStaffId = sid;
    } else {
      db.settings.posLockedStaffId = null;
    }
    saveDB();
  }
  _applyStaffLock();
  toast(_staffLocked ? "Kassir bloklandi" : "Kassir bloki ochildi");
}

function _applyStaffLock() {
  const btn = $("pos-staff-lock-btn");
  if (btn) btn.innerHTML = _staffLocked
    ? '<i class="ti ti-lock" style="color:#E9A500"></i>'
    : '<i class="ti ti-lock-open" style="color:#94A3B8"></i>';
  const sel = $("pos-staff");
  if (!sel) return;
  // Bloklangan kassirni tanlaymiz
  if (_staffLocked && db?.settings?.posLockedStaffId) {
    sel.value = db.settings.posLockedStaffId;
  }
  sel.disabled = _staffLocked;
  sel.style.opacity = _staffLocked ? ".6" : "1";
}

function togglePayMethodBlock(method, btnEl) {
  // Toggle
  _payBlocked[method] = !_payBlocked[method];
  var blocked = !!_payBlocked[method];

  // DB ga saqlash (scheduleCloudSync chaqirmasdan)
  if (!db.settings) db.settings = {};
  db.settings.posPayBlocked = JSON.parse(JSON.stringify(_payBlocked));
  try {
    var key = typeof getDBKEY === "function" ? getDBKEY() : "merx_db";
    localStorage.setItem(key, JSON.stringify(db));
  } catch(e) {}

  // UI yangilash
  var btn = btnEl || document.getElementById("pay-lock-" + method);
  var inp = document.getElementById("pay-" + method);
  var row = document.getElementById("pay-row-" + method);

  if (btn) btn.innerHTML = blocked
    ? '<i class="ti ti-lock" style="color:#E9A500"></i>'
    : '<i class="ti ti-lock-open" style="color:#CBD5E1"></i>';
  if (inp) { inp.disabled = blocked; if (blocked) inp.value = ""; }
  if (row) { row.style.opacity = blocked ? "0.4" : "1"; row.style.pointerEvents = blocked ? "none" : "auto"; }

  updatePayRemaining();
  toast((blocked ? "Bloklandi: " : "Ochildi: ") + method);
}

// Eski setPayMode — ichida nasiya uchun qarz inputini ishlatamiz
function setPayMode(m) {
  posPayMode = m;
  document.querySelectorAll(".pmode-btn").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  const _pb = $("part-box"); if(_pb) _pb.style.display = m === "part" ? "block" : "none";
  if (m === "full") setDebtCurrency("uzs");
  if (m === "part") {
    if ($("c-due") && !$("c-due").value) $("c-due").value = addDays(today(), 30);
    if (posPayType === "aralash") updateMixedTotal();
    else updateRem();
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
  const rate     = db.settings?.rate || 12800;

  // Yangi panel: naqd+karta+otkazma to'langan, qarz = qolgan
  const _pN = getRawVal("pay-naqd");
  const _pK = getRawVal("pay-karta");
  const _pO = getRawVal("pay-otkazma");
  const _pQ = getRawVal("pay-qarz");
  const _anyNew = _pN + _pK + _pO + _pQ;

  let remUzs;
  if (_anyNew > 0) {
    // Yangi panel: qolgan qarz = jami - (naqd+karta+otkazma)
    const paid = _pN + _pK + _pO;
    remUzs = Math.max(0, total - paid);
  } else {
    // Eski panel
    const paid = getRawVal("c-paid");
    remUzs = Math.max(0, total - paid);
  }

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
    const debts = db.sales.filter(s => s.customerId===c.id && s.status!=="qaytarilgan")
      .map(s => calcSaleState(s)).filter(st => st.remaining > 0.5);
    const totalUzs = debts.reduce((a,st)=>a+st.remaining,0);
    const totalUsd = debts.filter(st=>st.debtUsd>0).reduce((a,st)=>a+st.debtUsd,0);
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

  // Ism va tel to'ldirish (yashirin maydonda, checkout uchun)
  if ($("c-name"))  $("c-name").value  = c.name;
  if ($("c-phone")) $("c-phone").value = c.phone || "";
  // Mijoz tanlangach ism/telefon qatorini yashiramiz — kerak emas
  if ($("c-name-row")) $("c-name-row").style.display = "none";

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

  // Mini modal ochish — mavjud addcust modal ishlatamiz.
  // AVVAL toza tozalaymiz (oldingi mijoz qoldiqlari), KEYIN tezkor
  // rejim o'z qiymatlari va tugmasini o'rnatadi
  if (typeof resetCustForm === "function") resetCustForm();
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
  // 2026-07-10 (AbuSaxiy №3): bu qator checkout'dan keyin ham
  // chaqirilib (checkout -> custClear), v162'da ATAYLAB yashirilgan
  // qo'lda ism/telefon qatorini QAYTA KO'RSATIB yuborardi — "sotuvdan
  // keyin ism nomer qatori paydo bo'lyapti" muammosining ildizi.
  // Maydonlar DOM'da QOLADI (checkout ulardan o'qiydi, custSelect
  // to'ldiradi) — faqat endi yashirinligicha qoladi. Mijoz "Mijoz
  // qidirish" orqali tanlanadi/qo'shiladi (v162 siyosati).
  if ($("c-name-row")) $("c-name-row").style.display = "none";
  showCustDebt(null);
}

// Tashqarini bosganda dropdown yopilsin
document.addEventListener("click", function(e) {
  if (!e.target.closest("#cust-search-wrap")) {
    const dd = $("cust-dropdown");
    if (dd) dd.style.display = "none";
  }
});

// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function custPick() {
  // Eski select bilan moslik — endi ishlatilmaydi
  const id = parseInt(($("c-cust")||{value:""}).value) || null;
  if (!id) { showCustDebt(null); return; }
  custSelect(id);
}

function refreshCustList() {
  // Select yo'q endi — saqlaymiz moslik uchun
}


function _applyPayBlocked() {
  ["naqd","karta","otkazma","qarz"].forEach(function(m) {
    var blocked = _payBlocked[m] === true;
    var btn = $("pay-lock-" + m);
    var inp = $("pay-" + m);
    var row = $("pay-row-" + m);

    // Tugma belgisi
    if (btn) btn.innerHTML = blocked
      ? '<i class="ti ti-lock" style="color:#E9A500"></i>'
      : '<i class="ti ti-lock-open" style="color:#CBD5E1"></i>';

    // Input
    if (inp) {
      inp.disabled = blocked;
      if (blocked) inp.value = "";
    }

    // Qator ko'rinishi — style ni to'liq almashtirish
    if (row) {
      row.style.opacity        = blocked ? "0.4" : "1";
      row.style.pointerEvents  = blocked ? "none" : "auto";
    }
  });
}

function refreshStaffList() {
  // Bloklash holatini settings dan yuklaymiz (har POS ochilganda)
  if (typeof db !== "undefined" && db.settings) {
    var _pb = db.settings.posPayBlocked;
    _payBlocked  = (_pb && typeof _pb === "object") ? Object.assign({}, _pb) : {};
    _staffLocked = db.settings.posStaffLocked === true;
  } else {
    _payBlocked  = {};
    _staffLocked = false;
  }
  const sel = $("pos-staff"); if (!sel) return;
  // Kassirlar ro'yxatini to'ldiramiz
  const lockedId = db?.settings?.posLockedStaffId;
  const cur = _staffLocked && lockedId ? lockedId : sel.value;
  // v162: JORIY FOYDALANUVCHI avtomat tanlanadi —
  // egasi (admin) bilan kirilsa "Egasi (admin)", xodim bilan kirilsa o'sha xodim.
  const _u = (typeof authLoad === "function" ? authLoad() : null);
  let _autoSel = cur;
  if (!_autoSel && _u) {
    if (_u.role === "staff" && _u.id != null) _autoSel = _u.id;          // xodim o'zi
    else if (_u.role !== "staff") _autoSel = "admin";                     // egasi/admin
  }
  sel.innerHTML = '<option value="admin"' + (String(_autoSel)==="admin"?" selected":"") + '>Egasi (admin)</option>' +
    (db.staff||[]).map(s => `<option value="${s.id}"${String(s.id)===String(_autoSel)?" selected":""}>${s.name}</option>`).join("");
  _applyPayBlocked();
  _applyStaffLock();
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

  // Aralash to'lov bo'yicha breakdown (har bir usul bo'yicha summa)
  let payBreakdown = null;
  if (posPayType === "aralash") {
    payBreakdown = {};
    // Yangi 4-ustunli to'lov panelidan o'qiymiz
    const _n = getRawVal("pay-naqd");
    const _k = getRawVal("pay-karta");
    const _o = getRawVal("pay-otkazma");
    if (_n > 0) payBreakdown["naqd"]    = _n;
    if (_k > 0) payBreakdown["karta"]   = _k;
    if (_o > 0) payBreakdown["otkazma"] = _o;
    // Eski mix-checkbox elementlar ham tekshiramiz (moslik uchun)
    ["naqd","karta","otkazma"].forEach(m => {
      const chk = $(`mix-${m}-chk`);
      if (chk && chk.checked) {
        const v = getRawVal(`mix-${m}-sum`);
        if (v > 0 && !payBreakdown[m]) payBreakdown[m] = v;
      }
    });
    if (Object.keys(payBreakdown).length === 0) {
      toast("Kamida bitta to'lov usulini kiriting", "err");
      return;
    }
  }

  // YANGI: 4-ustunli to'lov panelidan o'qiymiz
  const _payN = getRawVal("pay-naqd");
  const _payK = getRawVal("pay-karta");
  const _payO = getRawVal("pay-otkazma");
  const _payQ = getRawVal("pay-qarz");
  const _anyNew = _payN + _payK + _payO + _payQ;

  // 2026-07-12 (AbuSaxiy, KRITIK): QAT'IY TO'LOV TEKSHIRUVI.
  // Avval: (a) hammasi bo'sh bo'lsa "to'liq naqd" deb qabul qilinardi;
  // (b) yig'indi savatdan KAM bo'lsa ham (masalan 4.6 mln savatga
  // naqd 1 + karta 2, qarz o'chirilgan) sotuv "to'liq to'landi" deb
  // yopilardi — 1.6 mln JIMGINA yo'qolardi. Endi: kamida bitta usulda
  // summa bo'lishi VA yig'indi (qarz bilan birga) savat jamiga ANIQ
  // teng bo'lishi SHART. Jonli qulf (№6) yig'indini oshirib yubormaydi,
  // bu tekshiruv esa KAM bo'lishiga yo'l qo'ymaydi.
  if (_anyNew <= 0) {
    toast("To'lov kiritilmadi — kamida bitta usulga summa yozing (qolgani avtomat Qarz qatoriga tushadi)", "err");
    return;
  }
  if (Math.abs(_anyNew - total) > 1) {
    toast(`To'lov yig'indisi ${fmt(_anyNew)} so'm — savat jami ${fmt(total)} so'mga TENG EMAS. Farqni to'g'rilang yoki qolganini Qarz qatoriga yozing`, "err");
    return;
  }

  if (_anyNew > 0) {
    paid = _payN + _payK + _payO;
    if (_payQ > 0) {
      if (!cName) { toast("Nasiyada mijoz ismi shart","err"); return; }
      due = ($("pos-due")||{value:""}).value;
      if (!due) { toast("Nasiyada muddat majburiy","err"); $("pos-due")?.focus(); return; }
      rem    = Math.max(0, total - paid);
      status = rem > 0 ? "qarz" : "tolandan";
      if (posDebtCurrency === "usd" && rem > 0) debtUsd = parseFloat((rem/(db.settings.rate||12800)).toFixed(2));
      posPayMode = "part";
    }
    // payBreakdown faqat naqd to'lovlar (qarz alohida saqlanadi)
    const _pb = {};
    if (_payN>0) _pb.naqd=_payN;
    if (_payK>0) _pb.karta=_payK;
    if (_payO>0) _pb.otkazma=_payO;
    // qarz payBreakdown ga kirmaydi — u alohida "remaining" sifatida saqlanadi
    if (Object.keys(_pb).length>1){payBreakdown=_pb;posPayType="aralash";}
    else if (Object.keys(_pb).length===1) posPayType=Object.keys(_pb)[0];
    else if (_payQ>0) posPayType="qarz"; // faqat qarz bo'lsa
  } else if (posPayMode === "part") {
    if (!cName) { toast("Qisman to'lovda mijoz ismi shart","err"); return; }
    paid    = posPayType === "aralash" ? getMixedTotal() : getRawVal("c-paid");
    due     = ($("c-due")||{value:""}).value;
    rem     = Math.max(0, total - paid);
    status  = rem > 0 ? "qarz" : "tolandan";
    if (posDebtCurrency === "usd" && rem > 0) {
      debtUsd = parseFloat((rem / (db.settings.rate||12800)).toFixed(2));
    }

  } else if (posPayType === "aralash") {
    // To'liq to'lov rejimida ham aralash bo'lsa, kiritilgan summa = jami bo'lishi kerak
    const mixedPaid = getMixedTotal();
    if (Math.abs(mixedPaid - total) > 1) {
      toast(`Aralash to'lov yig'indisi (${fmt(mixedPaid)}) jami summaga (${fmt(total)}) teng emas`, "err");
      return;
    }
    paid = mixedPaid;
  }

  // Kassir — bloklangan bo'lsa settings dan olamiz
  const staffId = (() => {
    if (_staffLocked && db?.settings?.posLockedStaffId) return db.settings.posLockedStaffId;
    return parseInt(($("pos-staff")||{value:0}).value) || null;
  })();
  // Kassir majburiy — xodimlar bo'lsa; "Egasi (admin)" tanlovi ham
  // to'g'ri hisoblanadi (v162: staffId null, lekin tanlov aniq)
  const _selVal = ($("pos-staff")||{value:""}).value;
  if (!staffId && _selVal !== "admin" && db.staff && db.staff.length > 0) {
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
      // Pochka mantig'i: har bir pochka = shu guruh o'lchamlaridan 1 tadan.
      // qtyBox = nechta pochka sotildi — shuncha son shu guruhdagi har bir o'lchamdan ayiriladi.
      const boxesSold = c.qtyBox || 0;
      const targetSizes = c.groupSizes || null;
      const affected = p.variants.filter(v => v.color === c.color && (!targetSizes || targetSizes.includes(v.size)));
      if (affected.length === 1) {
        // B2: yagona variant — dona = pochka × 1 pochkadagi dona
        const perBox = c.inBox || p.inBox || 1;
        affected[0].qty = Math.max(0, affected[0].qty - boxesSold * perBox);
      } else {
        // Eski model: har o'lchamdan pochka soniga teng ayiriladi
        affected.forEach(v => { v.qty = Math.max(0, v.qty - boxesSold); });
      }
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
    const prevDebts = db.sales.filter(s => s.customerId === customerId && s.status !== "qaytarilgan")
      .map(s => ({ sale: s, state: calcSaleState(s) }))
      .filter(x => x.state.remaining > 0.5);
    prevDebtUsd = prevDebts
      .filter(x => x.sale.debtCurrency === "usd" && x.state.debtUsd)
      .reduce((a, x) => a + x.state.debtUsd, 0);
    prevDebtUzs = prevDebts
      .filter(x => x.sale.debtCurrency !== "usd")
      .reduce((a, x) => a + x.state.remaining, 0);
  }

  const newSale = {
    id:db.seq++, chekNum, date:today(), time:nowTime(),
    priceType: posPriceType,
    payType: posPayType, payBreakdown, staffId, customerId,
    discount, discountType: discType,
    discountPct: discType === "pct" ? (getRawVal("discount-val") || 0) : null,
    items: cart.map(c => ({
      name: c.name, sku: c.sku || null,
      art: c.art || null,
      variant: c.sellMode==="karobka" ? `${c.color} (${c.qtyBox} pochka)` : `${c.color} / ${c.size}`,
      color: c.color || null,
      size: c.size || null,
      qty: c.qty, qtyBox: c.qtyBox||null, inBox: c.inBox||null,
      sellMode: c.sellMode || "dona",
      packGroup: c.packGroup != null ? c.packGroup : null,
      groupSizes: c.groupSizes || null,
      price: c.price, unit: c.unit,
      image: c.image || null,
      barcode: c.barcode || null
    })),
    subtotal, total, paid, remaining:rem, due,
    customerName:cName, customerPhone:cPhone, status,
    debtCurrency: posPayMode==="part" ? posDebtCurrency : "uzs",
    debtUsd, note: saleNote || null,
    // Asl (o'zgarmas) qiymatlar — keyingi qarz to'lovlari bularga tegmaydi.
    // Joriy holat har doim calcSaleState() orqali hisoblanadi.
    origPaid: paid, origRemaining: rem, origDebtUsd: debtUsd,
    // Oldingi qarz ma'lumotlari (chekda ko'rsatish uchun)
    prevDebtUsd: prevDebtUsd > 0 ? prevDebtUsd : null,
    prevDebtUzs: prevDebtUzs > 0 ? prevDebtUzs : null,
  };
  db.sales.push(newSale); saveDB();

  // Sodiqlik balli — avtomatik hisoblanadi (Sozlamalar > Narx bo'limida yoqilsa)
  if (typeof addLoyaltyPoints === "function" && customerId) {
    addLoyaltyPoints(customerId, total);
  }

  // Ishlatilgan ball bo'lsa — mijoz balansidan ayiramiz va chekka yozamiz
  if (typeof spendLoyaltyPoints === "function" && customerId && posLoyaltyPointsUsed > 0) {
    const ok = spendLoyaltyPoints(customerId, posLoyaltyPointsUsed);
    if (ok) newSale.loyaltyPointsUsed = posLoyaltyPointsUsed;
  }
  posLoyaltyPointsUsed = 0;

  // Telegram bot orqali avtomatik chek (mijoz botga ulangan bo'lsa)
  if (typeof sendTelegramReceipt === "function") {
    sendTelegramReceipt(customerId, newSale, cPhone);
  }

  // Ishchilar guruhiga sotuv bildirishnomasi
  if (typeof sendStaffNotification === "function") {
    sendStaffNotification(newSale);
  }

  // SMS (boyitilgan) — try-catch ichida, xato chekni bloklamasin
  try {
  if (cPhone && cPhone.replace(/\D/g,"").length >= 9) {
    const shopName = db.shop?.name || "MERX";
    const debtTxt  = debtUsd != null
      ? `$${debtUsd.toFixed(2)} USD`
      : rem > 0 ? `${fmt(rem)} so'm` : "";
    const itemsTxt = newSale.items.map(i =>
      `${i.name} x${i.qty}${i.unit} = ${fmt(i.price*i.qty)} so'm`
    ).join(", ");
    // Shablon: settings dan olinadi yoki standart
    let sms;
    if (rem > 0) {
      const tpl = db.settings?.smsTemplateSale ||
        "{dokon} | {chek}\n{tovarlar}\nJami: {jami}\nTo'landi: {tolandi}\nQarz: {qarz} ({muddat})";
      sms = tpl
        .replace("{dokon}",   shopName)
        .replace("{chek}",    chekNum)
        .replace("{tovarlar}",itemsTxt)
        .replace("{jami}",    fmt(total)+" so'm")
        .replace("{tolandi}", fmt(paid)+" so'm")
        .replace("{qarz}",    debtTxt)
        .replace("{muddat}",  due||"muddatsiz");
    } else {
      const tpl = db.settings?.smsTemplatePaid ||
        "{dokon} | {chek}\n{tovarlar}\nJami: {jami} - To'liq qabul qilindi. Rahmat!";
      sms = tpl
        .replace("{dokon}",   shopName)
        .replace("{chek}",    chekNum)
        .replace("{tovarlar}",itemsTxt)
        .replace("{jami}",    fmt(total)+" so'm");
    }
    await sendSms(cPhone, sms);
  }
  } catch(smsErr) { console.warn("SMS xato:", smsErr.message); }

  // Sotuv yakunlanganini loglaymiz
  posLog("Sotuv yakunlandi", `${chekNum} — ${fmt(total)} so'm (${newSale.items.length} tur, ${posPayType})`);

  // Reset
  cart.length = 0;
  // Mijoz ma'lumotlarini tozalaymiz (qarz badge ham yashiriladi)
  custClear();
  // "Savat qiymati" belgisi ham darhol 0 ga qaytadi (AbuSaxiy e'tirozi)
  const _cvv = $("cart-value-val"); if (_cvv) _cvv.textContent = "0 so'm";
  // Chegirmani tozalaymiz
  if ($("discount-val")) { $("discount-val").value = ""; $("discount-val").dataset.raw = ""; }
  const _dres = $("discount-result"); if (_dres) _dres.style.display = "none";
  renderCart();
  // Yangi to'lov panelini tozalash
  ["pay-naqd","pay-karta","pay-otkazma","pay-qarz"].forEach(id => {
    const el=$(id); if(el){el.value="";el.disabled=false;}
  });
  ["naqd","karta","otkazma","qarz"].forEach(m => {
    if(_payBlocked[m])return;
    const row=$("pay-row-"+m);
    if(row){row.style.opacity="1";row.style.pointerEvents="auto";}
  });
  const _nb=$("nasiya-box"); if(_nb)_nb.style.display="none";
  const _mb=$("pay-mode-badge"); if(_mb)_mb.innerHTML="";
  const _pr=$("pay-remaining"); if(_pr){_pr.textContent="0";_pr.style.color="#22C55E";}
  const _posdue=$("pos-due"); if(_posdue)_posdue.value="";
  setPayMode("full"); setDebtCurrency("uzs");
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
  // Yangi to'lov panelini tozalash
  ["pay-naqd","pay-karta","pay-otkazma","pay-qarz"].forEach(id => { const el=$(id); if(el){el.value="";el.disabled=false;} });
  ["naqd","karta","otkazma","qarz"].forEach(m => { if(_payBlocked[m])return; const row=$("pay-row-"+m); if(row){row.style.opacity="1";row.style.pointerEvents="auto";} });
  const nb=$("nasiya-box"); if(nb)nb.style.display="none";
  const mb=$("pay-mode-badge"); if(mb)mb.innerHTML="";
  const pr=$("pay-remaining"); if(pr){pr.textContent="0";pr.style.color="#22C55E";}
  // Muddat reset
  const posdue=$("pos-due"); if(posdue)posdue.value="";
  if ($("debt-count")) $("debt-count").textContent = debtSales().length;
  refreshCustList();
  // Chek modali — try-catch ichida xavfsiz
  try {
    showReceiptModal(newSale);
  } catch(e) {
    console.error("Chek xato:", e);
    toast("Sotuv saqlandi! Chek: " + (newSale.chekNum||""), "info");
  }
}

// ── Chegirma ──────────────────────────────────
let discType = "sum"; // "pct" | "sum" — asosiy: so'm

function setDiscType(t) {
  discType = t;
  document.querySelectorAll(".disc-type-btn").forEach(b => b.classList.toggle("on", b.dataset.d === t));
  applyDiscount();
}

function applyDiscount() {
  // Kassir ruxsatini tekshirish — faqat maxDiscount chegarasi qo'yilgan bo'lsa
  const staffId = (() => {
    if (_staffLocked && db?.settings?.posLockedStaffId) return db.settings.posLockedStaffId;
    return parseInt(($("pos-staff")||{value:0}).value) || null;
  })();
  const staff = staffId ? (db.staff||[]).find(s=>s.id===staffId) : null;

  // maxDiscount chegarasi bo'lsa va foiz rejimida bo'lsa tekshiramiz
  if (staff && staff.maxDiscount > 0 && discType === "pct") {
    const val = getRawVal("discount-val") || 0;
    if (val > staff.maxDiscount) {
      toast(`Maksimal chegirma: ${staff.maxDiscount}%`, "err");
      if ($("discount-val")) { $("discount-val").value = staff.maxDiscount; $("discount-val").dataset.raw = String(staff.maxDiscount); }
    }
  }
  // Har doim renderCart chaqiramiz
  renderCart();
}

function calcDiscount(total) {
  const val = getRawVal("discount-val");
  if (!val || val <= 0) return 0;
  if (discType === "pct") return Math.round(total * val / 100);
  return Math.min(val, total);
}

// ── Sodiqlik ballini chegirma sifatida qo'llash ──
function applyLoyaltyPointsPos() {
  const custId = parseInt(($("c-cust")||{value:""}).value) || null;
  if (!custId) { toast("Avval mijoz tanlang","err"); return; }
  const cust = (db.customers||[]).find(c => c.id === custId);
  if (!cust) return;
  const avail = cust.loyaltyPoints || 0;
  const wantPts = parseInt(($("loyalty-pts-input")||{value:0}).value) || 0;
  if (wantPts <= 0) { toast("Ball sonini kiriting","err"); return; }
  if (wantPts > avail) { toast("Yetarli ball yo'q","err"); return; }
  if (typeof pointsToSom !== "function") return;

  const somValue = pointsToSom(wantPts);

  // Avvalgi qo'llangan ball bo'lsa — uni chegirmadan ayirib, qaytadan qo'shamiz
  // (ikki marta qo'shilib ketmasligi uchun)
  if (discType !== "sum") setDiscType("sum");
  const currentRaw = Number(getRawVal("discount-val") || 0) - (posLoyaltyPointsUsed ? pointsToSom(posLoyaltyPointsUsed) : 0);
  const newRaw = Math.max(0, currentRaw) + somValue;
  const discInput = $("discount-val");
  if (discInput) {
    discInput.value = fmt(newRaw);
    discInput.dataset.raw = String(newRaw);
  }

  posLoyaltyPointsUsed = wantPts;
  const note = $("loyalty-applied-note");
  if (note) {
    note.textContent = `✅ ${wantPts} ball qo'llandi (${fmt(somValue)} so'm chegirma)`;
    note.style.display = "block";
  }
  if ($("loyalty-pts-input")) $("loyalty-pts-input").value = "";
  applyDiscount();
  toast(`✅ ${wantPts} ball ishlatildi`);
}

// ── Mijoz qarzi ko'rinishi ────────────────────
function showCustDebt(custId) {
  const badge = $("cust-debt-badge");
  const val   = $("cust-debt-val");
  const balBadge = $("cust-balance-badge");
  const balVal   = $("cust-balance-val");

  if (badge && val) {
    if (!custId) { badge.style.display = "none"; }
    else {
      // Joriy holatni calcSaleState() orqali hisoblaymiz — s.status/s.remaining
      // asl (o'zgarmas) qiymat, qarz to'langan-to'lanmaganini bilmaydi.
      const candidates = db.sales.filter(s => s.customerId === custId && s.status !== "qaytarilgan");
      const debts = candidates
        .map(s => ({ sale: s, state: calcSaleState(s) }))
        .filter(x => x.state.remaining > 0.5);
      const totalUzs = debts.filter(x => x.sale.debtCurrency !== "usd").reduce((a,x) => a + x.state.remaining, 0);
      const totalUsd = debts.filter(x => x.sale.debtCurrency === "usd" && x.state.debtUsd).reduce((a,x) => a + x.state.debtUsd, 0);
      const cntAll   = debts.length;

      if (cntAll === 0) { badge.style.display = "none"; }
      else {
        let txt = "";
        if (totalUsd > 0 && totalUzs > 0) txt = `$${totalUsd.toFixed(2)} USD + ${fmt(totalUzs)} so'm`;
        else if (totalUsd > 0) txt = `$${totalUsd.toFixed(2)} USD`;
        else txt = `${fmt(totalUzs)} so'm`;
        val.innerHTML = `${txt} <span style="font-size:10.5px;font-weight:400;color:#a16207">(${cntAll} ta sotuv)</span>`;
        badge.style.display = "block";
      }
    }
  }

  // Sodiqlik balli ko'rsatish
  const loyBadge = $("cust-loyalty-badge");
  const loyVal   = $("cust-loyalty-val");
  const loyNote  = $("loyalty-applied-note");
  const loyInput = $("loyalty-pts-input");
  posLoyaltyPointsUsed = 0; // mijoz almashganda/tozalanganda qayta hisoblanadi
  if (loyNote) loyNote.style.display = "none";
  if (loyInput) loyInput.value = "";
  if (loyBadge && loyVal) {
    const cust = custId ? (db.customers||[]).find(c => c.id === custId) : null;
    const pts = cust?.loyaltyPoints || 0;
    if (!custId || pts <= 0 || !(db.settings?.loyaltyRate > 0)) {
      loyBadge.style.display = "none";
    } else {
      loyVal.textContent = `${pts} ball (${fmt(pointsToSom(pts))} so'm)`;
      loyBadge.style.display = "block";
    }
  }

  // Mijoz balansi (ortiqcha to'lovlardan yig'ilgan depozit)
  if (balBadge && balVal) {
    if (!custId) { balBadge.style.display = "none"; return; }
    const cust = (db.customers||[]).find(c => c.id === custId);
    const bUzs = cust?.balanceUzs || 0;
    const bUsd = cust?.balanceUsd || 0;
    if (!cust || (bUzs <= 0 && bUsd <= 0)) { balBadge.style.display = "none"; return; }

    const parts = [];
    if (bUsd > 0) parts.push(`$${bUsd.toFixed(2)}`);
    if (bUzs > 0) parts.push(`${fmt(bUzs)} so'm`);
    balVal.textContent = parts.join(" + ");
    balBadge.style.display = "block";
  }
}

// ── Chek modal ────────────────────────────────
let _lastSale = null;

function showReceiptModal(sale) {
  _lastSale = sale;
  const shopName = db.shop?.name || "MERX";
  const payLabels = { naqd:"Naqd pul", karta:"Karta", otkazma:"Bank o'tkazmasi", aralash:"Aralash", qarz:"Nasiya" };

  // Shop nomi
  if ($("rcp-shop")) $("rcp-shop").textContent = shopName;

  // Chek raqami va sana
  if ($("rcp-num")) $("rcp-num").textContent = sale.chekNum || `#${sale.id}`;
  if ($("rcp-dt"))  $("rcp-dt").textContent  = `${sale.date} / ${sale.time||""}`;

  // Mahsulotlar
  if ($("rcp-items")) {
    // 2026-07-12 (AbuSaxiy): IXCHAM 2-QATORLI FORMAT (namunadagi chek
    // kabi). Avval 2-qator matni juda uzun edi ("Rang (1 pochka) · 6
    // juft · 400 000 so'm/dona") — tor (54mm) joyda o'zi 3-4 qatorga
    // bo'linib ketardi, tovar ko'p bo'lsa chek metrlab uzayardi.
    // Endi: 1-qator — nom (+rang, joy bo'lsa), 2-qator — faqat
    // "soni × narx ... jami" (nuqtali chiziq bilan, raqamlar aniq
    // o'ngga tekislangan). HISOB-KITOBGA (sale obyektiga) TEGILMAYDI —
    // faqat ko'rinish.
    // 2026-07-12 v4: CHEK FORMATI (AbuSaxiy talabi):
    // POCHKA: "2pch × (6 juft × 400 000) = 2 400 000"  (mantiqiy B2 format)
    // DONA:   "6 juft × 400 000 = 2 400 000"            (oddiy format)
    // "so'm" faqat jami qatorida (oxirida), oraliq narxlarda YO'Q
    $("rcp-items").innerHTML = sale.items.map(i => {
      const lineTotal = (i.price||0) * (i.qty||1);
      const unitPrice = i.price||0;
      // Variantdan rang/o'lchamni chiqarish
      const raw = i.variant || "";
      const clean = raw.replace(/\(\d+ pochka\)/gi,"").replace(/\(\d+ pch\)/gi,"").trim().replace(/\/\s*$/,"").trim();
      // ART (artikul) qo'shildi: "TAPICHKA / Army / D3119"
      const artPart = i.art ? ` / ${i.art}` : "";
      const varName = clean ? `${i.name} / ${clean}${artPart}` : `${i.name}${artPart}`;
      // Hisob qatori: pochkali yoki oddiy
      const isBox = i.sellMode === "karobka" && i.qtyBox && i.inBox;
      let calcStr;
      if (isBox) {
        // 2pch × (6 juft × 400 000) = 2 400 000
        calcStr = `${i.qtyBox}pch × (${i.inBox} ${i.unit||"juft"} × ${fmt(unitPrice)}) = ${fmt(lineTotal)}`;
      } else {
        // 6 juft × 400 000 = 2 400 000
        calcStr = `${i.qty} ${i.unit||"dona"} × ${fmt(unitPrice)} = ${fmt(lineTotal)}`;
      }
      return `<div style="margin-bottom:3px;padding-bottom:3px;font-size:10px;line-height:1.3;border-bottom:1px dashed #ddd">
        <div style="font-weight:700;color:#0D1B2A">${varName}</div>
        <div style="color:#374151;font-weight:600">${calcStr}</div>
      </div>`;
    }).join("");
  }

  // Subtotal va chegirma
  const subtotal = sale.subtotal || sale.total;
  const disc     = sale.discount || 0;
  if ($("rcp-subtotal")) $("rcp-subtotal").textContent = priceDisplay(subtotal);
  const discRow = $("rcp-disc-row");
  if (discRow) {
    if (disc > 0) {
      discRow.style.display = "flex";
      const lbl = sale.discountType === "pct" && sale.discountPct
        ? `Chegirma (${sale.discountPct}%)`
        : sale.discountType === "pct" ? "Chegirma (%)" : "Chegirma";
      if ($("rcp-disc-lbl")) $("rcp-disc-lbl").textContent = lbl;
      if ($("rcp-disc-val")) $("rcp-disc-val").textContent = "−" + priceDisplay(disc);
    } else {
      discRow.style.display = "none";
    }
  }
  if ($("rcp-total")) $("rcp-total").textContent = priceDisplay(sale.total);

  // To'lov
  const mixedWrap = $("rcp-mixed-wrap");
  const _simpleRow = $("rcp-simple-row");
  if (sale.payType === "aralash" && sale.payBreakdown) {
    // Aralash: oddiy qator yashiriladi, aralash blok ko'rinadi
    if (_simpleRow) _simpleRow.style.display = "none";
    if (mixedWrap)  mixedWrap.style.display  = "block";
    const icons = { naqd:"💵", karta:"💳", otkazma:"🏦" };
    // Aralashda "To'landi jami" sarlavha qatori + har usul alohida
    const pt = $("rcp-paid-total");
    if (pt) pt.textContent = priceDisplay(sale.paid);
    if ($("rcp-mixed-rows")) {
      $("rcp-mixed-rows").innerHTML = Object.entries(sale.payBreakdown)
        .filter(([m]) => m !== "qarz")
        .map(([m, v]) => `
        <div style="display:flex;justify-content:space-between">
          <span style="color:#374151;font-weight:600">${icons[m]||""} ${payLabels[m]||m}</span>
          <span style="font-weight:700;color:#0D1B2A">${priceDisplay(v)}</span>
        </div>`).join("");
    }
  } else {
    // Oddiy: aralash blok yashiriladi, oddiy qator ko'rinadi
    if (_simpleRow) _simpleRow.style.display = "flex";
    if (mixedWrap)  mixedWrap.style.display  = "none";
    if ($("rcp-paytype")) $("rcp-paytype").textContent = payLabels[sale.payType]||sale.payType;
    if ($("rcp-paid"))    $("rcp-paid").textContent    = priceDisplay(sale.paid);
  }

  const debtWrap = $("rcp-debt-wrap");
  const dueWrap  = $("rcp-due-wrap");
  if (sale.remaining > 0) {
    if (debtWrap) debtWrap.style.display = "block"; // "flex" emas — ichki qatorlar alohida ko'rsatilsin
    const isUsd = sale.debtCurrency === "usd" && sale.debtUsd;

    // Oldingi qarz satrlari
    const prevEl    = $("rcp-debt-prev");
    const prevValEl = $("rcp-debt-prev-val");
    const newEl     = $("rcp-debt-new");
    const newValEl  = $("rcp-debt-new-val");
    const lblEl     = $("rcp-debt-lbl");
    const debtEl    = $("rcp-debt");

    if (isUsd && sale.prevDebtUsd > 0) {
      if (prevEl)    prevEl.style.display = "flex";
      if (prevValEl) prevValEl.textContent = `$${sale.prevDebtUsd.toFixed(2)}`;
      if (newEl)     newEl.style.display = "flex";
      if (newValEl)  newValEl.textContent = `$${sale.debtUsd.toFixed(2)}`;
      if (lblEl)     lblEl.textContent = "Umumiy qarz";
      if (debtEl)    debtEl.textContent = `$${(sale.prevDebtUsd + sale.debtUsd).toFixed(2)} USD`;
    } else if (!isUsd && sale.prevDebtUzs > 0) {
      if (prevEl)    prevEl.style.display = "flex";
      if (prevValEl) prevValEl.textContent = fmt(sale.prevDebtUzs) + " so'm";
      if (newEl)     newEl.style.display = "flex";
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
    // Muddat: flex qator sifatida (chap-o'ng)
    const dueEl = $("rcp-due");
    const dueWrapEl = $("rcp-due-wrap");
    if (dueWrapEl && sale.due) {
      dueWrapEl.style.display = "flex";
      // Sanani dd.mm.yyyy formatiga o'tkazish (2026-08-07 -> 07.08.2026)
      const dueFmt = sale.due.split("-").reverse().join(".");
      if (dueEl) dueEl.textContent = dueFmt;
    } else if (dueWrapEl) dueWrapEl.style.display = "none";
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
    rcpBotEl.style.display = "block";
    // 2026-07-12: "Rahmat! Yana kutamiz" — chek sozlamalaridan yoki standart
    const footerTxt = db.settings?.receiptFooter || "Haridingiz uchun rahmat!\nYana kutamiz 🙏";
    rcpBotEl.innerHTML = [
      `<div style="text-align:center;font-size:11px;color:#555;padding:6px 0;border-top:1px dashed #ddd;font-style:italic">${footerTxt}</div>`,
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

// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function shareTelegram() {
  if (!_lastSale) return;
  const sale     = _lastSale;
  const shopName = db.shop?.name || "MERX";
  const payLabels = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash" };
  const lines = [
    `🧾 ${shopName} — Chek`,
    `📌 ${sale.chekNum || "#"+sale.id} | ${sale.date} ${sale.time||""}`,
    ``,
    ...sale.items.map(i => `▪ ${i.name} (${i.variant}) × ${i.qty} ${i.unit} = ${fmt(i.price*i.qty)} so'm`),
    ``,
    sale.discount > 0 ? `Chegirma: -${fmt(sale.discount)} so'm` : null,
    `Jami: ${fmt(sale.total)} so'm`,
    (() => {
      if (sale.payType === "aralash" && sale.payBreakdown) {
        const lbls = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma" };
        const parts = Object.entries(sale.payBreakdown)
          .filter(([m,v]) => m !== "qarz" && v > 0)
          .map(([m,v]) => `${lbls[m]||m}: ${fmt(v)} so'm`);
        return parts.length ? `To'lov: ${parts.join(", ")}` : null;
      }
      if (sale.payType === "qarz") return null; // faqat qarz — pastda ko'rsatiladi
      return `To'lov: ${payLabels[sale.payType]||sale.payType}`;
    })(),
    sale.remaining > 0 ? `Qarz: ${sale.debtCurrency==="usd"&&sale.debtUsd ? "$"+sale.debtUsd.toFixed(2) : fmt(sale.remaining)+" so'm"}` : `✅ To'liq to'landi`,
    sale.due ? `Muddat: ${sale.due}` : null,
    ``,
    `Rahmat! Yana kutamiz 🙏`
  ].filter(l => l !== null).join("\n");

  // Telegram share dialog — istalgan chatga yuborish mumkin
  const url = `https://t.me/share/url?url=&text=${encodeURIComponent(lines)}`;
  window.open(url, "_blank");
}

// v180: TUZATISH — avval bu funksiya mavjud bo'lmagan buildReceiptHtml()
// funksiyasini chaqirar edi (loyihaning hech qayerida yo'q edi), shuning
// uchun "Print" tugmasi bosilganda HECH NARSA chop etilmasdi (xato,
// hech kim payqamagan). Endi eng ishonchli yo'l: ekranda ALLAQACHON
// to'liq tayyor turgan chek oynasining O'ZINI chop etamiz (window.print),
// buning uchun index.html'da @media print qoidasi qo'shildi — chop
// etishda faqat chek qoladi, boshqa hech narsa (tugmalar, asosiy ilova)
// ko'rinmaydi.
function printReceiptPos() {
  if (!_lastSale) return;
  // 2026-07-12: CSS !important zanjiri brauzerda ishlamadi — JS orqali
  // to'g'ridan-to'g'ri yashirish eng ishonchli usul
  const btns = document.getElementById("rcp-btn-row");
  if (btns) btns.style.display = "none";
  window.print();
  if (btns) btns.style.display = "grid";
}

// 2026-07-12 (AbuSaxiy №1): SAVATNI SOTUVDAN OLDIN CHOP ETISH.
// Savatdan vaqtinchalik "chek" yasab, mavjud chek oynasida ko'rsatamiz —
// u yerdagi "Chop etish" 58mm sozlamalar bilan chiqaradi (yoki chop
// etish oynasida "PDF sifatida saqlash" tanlanadi). Bu VAQTINCHALIK
// ko'rinish: sotuv YARATILMAYDI, ombor/kassaga TEGILMAYDI.
function posPrintCart() {
  if (!cart.length) { toast("Savat bo'sh", "err"); return; }
  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const disc = calcDiscount(subtotal);
  const fake = {
    id: 0,
    chekNum: "OLDINDAN KO'RISH",
    date: today(), time: nowTime(),
    payType: "-",
    items: cart.map(c => ({
      name: c.name,
      variant: [c.color, c.size].filter(v => v && v !== "-").join(" / "),
      qty: c.qty, price: c.price, unit: c.unit || "dona"
    })),
    subtotal, discount: disc,
    total: subtotal - disc,
    // paid=0, remaining=0 — oldindan-ko'rishda "Qarz" bo'limi
    // chiqib chalg'itmasligi uchun (bu hali sotuv EMAS)
    paid: 0, remaining: 0,
    customerName: ($("c-name") ? $("c-name").value : "") || "",
    customerPhone: ($("c-phone") ? $("c-phone").value : "") || ""
  };
  showReceiptModal(fake);
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
// ── Oxirgi sotuv ──────────────────────────────
// ── Operatsiyalar tarixi (POS log) ko'rsatish ──────
function openPosLogs() {
  openModal("poslogs");
  renderPosLogs();
}

function renderPosLogs() {
  const el = $("poslogs-body"); if (!el) return;
  const logs = (db.posLogs || []).filter(l => l.date === today()).slice().reverse();

  if (!logs.length) {
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--mut)">
      <i class="ti ti-history" style="font-size:32px;display:block;margin-bottom:10px;opacity:.4"></i>
      Bugun hali operatsiya bo'lmagan</div>`;
    return;
  }

  const actionIcons = {
    "Savatga qo'shildi": { icon: "ti-plus", color: "var(--grn)" },
    "Savatdan o'chirildi": { icon: "ti-minus", color: "var(--red)" },
    "Savatcha tozalandi": { icon: "ti-trash", color: "var(--red)" },
    "Sotuv yakunlandi": { icon: "ti-check", color: "var(--acc)" },
  };

  el.innerHTML = `<table style="width:100%">
    <thead><tr>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--mut)">VAQT</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--mut)">AMAL</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--mut)">TAFSILOT</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--mut)">KASSIR</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--mut)">SAVATCHA</th>
    </tr></thead>
    <tbody>
      ${logs.map(l => {
        const ai = actionIcons[l.action] || { icon: "ti-point", color: "var(--mut)" };
        return `<tr style="border-top:1px solid var(--brd)">
          <td style="padding:8px 12px;font-size:12px;color:var(--mut);white-space:nowrap">${l.time}</td>
          <td style="padding:8px 12px;font-size:12.5px">
            <i class="ti ${ai.icon}" style="color:${ai.color};margin-right:5px"></i>${l.action}
          </td>
          <td style="padding:8px 12px;font-size:12px;color:var(--mut)">${l.details||"—"}</td>
          <td style="padding:8px 12px;font-size:12px">${l.staffName||"—"}</td>
          <td style="padding:8px 12px;font-size:11.5px;color:#bbb">${l.cartName||"—"}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>`;
}

function showLastSale() {
  if (!db.sales.length) { toast("Hali sotuv yo'q","err"); return; }
  const last = db.sales[db.sales.length - 1];
  showReceiptModal(last);
}

// ── Muddati o'tgan qarz eslatmasi ────────────
function checkDebtAlerts() {
  // 2026-07-11 (AbuSaxiy №9): POS'dagi "muddati o'tgan qarz" banneri
  // OLIB TASHLANDI — kassirni chalg'itardi. Muddati o'tganlar Qarzlar
  // bo'limida ko'rinishda davom etadi (qizil qatorlar + Holat ustuni).
  // Funksiya chaqiruvchilar buzilmasligi uchun saqlanadi — banner
  // endi DOIM yashirin.
  const banner = $("debt-alert-banner");
  if (banner) banner.style.display = "none";
}
