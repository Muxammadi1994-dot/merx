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
let katStatusFilter = "all"; // "all" | "faol" | "nol" | "kam"
let katViewMode    = "table"; // "table" | "grid"
let katPage        = 1;
const KAT_PER_PAGE = 50;

// ── Kategoriya filtri ──────────────────────────
function setKatStatus(s) {
  katStatusFilter = s;
  katPage = 1;
  document.querySelectorAll(".kat-status-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.s === s));
  renderKatalog();
}

function setKatView(v) {
  katViewMode = v;
  document.querySelectorAll(".kat-view-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.v === v));
  renderKatalog();
}

function katGoPage(p) {
  katPage = p;
  renderKatalog();
  document.getElementById("p-katalog")?.scrollIntoView({behavior:"smooth",block:"start"});
}

// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function setKatCat(c) {
  katCatFilter = c;
  katPage = 1;
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

  // rowKey lardan unique sku to'plamini olamiz (bir mahsulotning bir necha rang qatori tanlangan bo'lishi mumkin)
  const uniqueSkus = new Set([..._katSelected].map(k => k.split("::")[0]));
  uniqueSkus.forEach(sku => {
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
  const ids = { name:"kat-sort-name", qty:"kat-sort-qty", price:"kat-sort-price", date:"kat-sort-date" };
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
// updateKatCatBtns olib tashlandi — kategoriya tugmalari endi mahsulot kartasi ichida ko'rinadi,
// alohida filtr tugmasi sifatida shart emas edi

// ── Kam qoldiq filtri ──────────────────────────
// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
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
// ── Katalog ustunlar boshqaruvi ─────────────────────────────
// ── Ustunlar sozlash ──────────────────────────────
// Barcha mumkin ustunlar va default ko'rinishlari
const KAT_ALL_COLS = [
  { key:"image",    lbl:"Rasm",             def:true  },
  { key:"art",      lbl:"ART (artikul)",    def:true  },
  { key:"name",     lbl:"Nomi",             def:true  },
  { key:"category", lbl:"Toifa",            def:false },
  { key:"barcode",  lbl:"Barcode",          def:true  },
  { key:"supplier", lbl:"Yetkazuvchi",      def:false },
  { key:"colors",   lbl:"Ranglar",          def:true  },
  { key:"boxes",    lbl:"Pochka soni",       def:true  },
  { key:"qty",      lbl:"Jami dona",         def:true  },
  { key:"cost",     lbl:"Tannarx",          def:true  },
  { key:"ulgurji",  lbl:"Ulgurji narx",     def:true  },
  { key:"chakana",  lbl:"Chakana narx",     def:false },
  { key:"margin",   lbl:"Margin %",         def:false },
  { key:"sku",      lbl:"SKU kodi",         def:false },
];

const KAT_DEFAULT_COLS = Object.fromEntries(KAT_ALL_COLS.map(c => [c.key, c.def]));

function katGetCols() {
  return Object.assign({}, KAT_DEFAULT_COLS, db.settings.katCols || {});
}

function katToggleCols() {
  openModal("katcols");
  katRenderColsPanel();
}

function katRenderColsPanel() {
  const cols = katGetCols();
  const el = $("kat-cols-list"); if (!el) return;
  el.innerHTML = KAT_ALL_COLS.map(d => `
    <label class="kat-col-item ${cols[d.key]?"active":""}" onclick="katToggleCol('${d.key}',${!cols[d.key]}); return false;">
      <div class="kat-col-check">${cols[d.key]
        ? `<i class="ti ti-check" style="font-size:13px;color:#fff"></i>`
        : ``}</div>
      <span>${d.lbl}</span>
    </label>`).join("");
}

function katToggleCol(key, val) {
  if (!db.settings.katCols) db.settings.katCols = {};
  db.settings.katCols[key] = val;
  saveDB(); katRenderColsPanel(); renderKatalog();
}

function katColsReset() {
  db.settings.katCols = {};
  saveDB(); katRenderColsPanel(); renderKatalog();
  toast("Ustunlar asl holiga qaytarildi");
}

// ─────────────────────────────────────────────────────────────
function renderKatalog() {
  const q    = ($("kat-q")||{value:""}).value.toLowerCase();
  const rate = db.settings.rate || 12800;
  const showChakana = db.settings.showChakana || false;
  const katCols = katGetCols();
  const shopType = typeof getShopType === "function" ? getShopType() : (db.settings?.shopType || "ikki");

  // shopType ga mos tab tugmalarini ko'rsatish/yashirish
  const btnOyoq  = document.querySelector(".kat-cat-btn[data-c='oyoq']");
  const btnKiyim = document.querySelector(".kat-cat-btn[data-c='kiyim']");
  if (btnOyoq)  btnOyoq.style.display  = shopType === "kiyim" ? "none" : "";
  if (btnKiyim) btnKiyim.style.display = shopType === "oyoq"  ? "none" : "";

  // visProds() shopType ga qarab filtrlaydi
  let ps = visProds().filter(p =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q) ||
    (p.art && p.art.toLowerCase().includes(q)) ||
    (p.barcode && p.barcode.toLowerCase().includes(q)) ||
    p.category.toLowerCase().includes(q)
  );
  if (katLowFilter) ps = ps.filter(p => totalStock(p) <= 5);
  // katCatFilter endi faqat kategoriya bo'yicha — tur esa visProds() orqali
  if (katCatFilter === "oyoq")  ps = ps.filter(p => p.type === "oyoq");
  else if (katCatFilter === "kiyim") ps = ps.filter(p => p.type === "kiyim");
  else if (katCatFilter !== "all")   ps = ps.filter(p => p.category === katCatFilter);

  // Status filtri
  if (katStatusFilter === "faol")  ps = ps.filter(p => totalStock(p) > 0);
  if (katStatusFilter === "nol")   ps = ps.filter(p => totalStock(p) === 0);
  if (katStatusFilter === "kam")   ps = ps.filter(p => { const s = totalStock(p); return s > 0 && s <= 5; });

  // Saralash
  if (katSortBy) {
    const rate = db.settings.rate || 12800;
    ps.sort((a, b) => {
      let va, vb;
      if (katSortBy === "name")  { va = a.name;         vb = b.name; }
      if (katSortBy === "qty")   { va = totalStock(a);  vb = totalStock(b); }
      if (katSortBy === "price") { va = a.ulgurjiNarx || (a.costUsd||0)*rate;
                                   vb = b.ulgurjiNarx || (b.costUsd||0)*rate; }
      if (katSortBy === "date") {
        // createdAt mavjud bo'lsa shu bo'yicha, bo'lmasa (eski tovarlar) SKU ichidagi
        // ketma-ket raqam bo'yicha (SKU har doim oshib boruvchi tartibda yaratiladi)
        if (a.createdAt && b.createdAt) { va = a.createdAt; vb = b.createdAt; }
        else {
          const numA = parseInt((a.sku||"").match(/\d+/g)?.pop()) || 0;
          const numB = parseInt((b.sku||"").match(/\d+/g)?.pop()) || 0;
          va = numA; vb = numB;
        }
      }
      if (typeof va === "string") return katSortAsc ? va.localeCompare(vb,"uz") : vb.localeCompare(va,"uz");
      return katSortAsc ? va - vb : vb - va;
    });
  }

  // Billz uslubida: har bir mahsulot+rang+pochka-guruhi alohida qator
  // (Ombor sahifasida bir xil mahsulot guruhlangan holatda qoladi — bu yerga tegmaydi)
  let rows = [];
  ps.forEach(p => {
    const colorsInProduct = [...new Set(p.variants.map(v => v.color))];
    colorsInProduct.forEach(color => {
      const groups = regroupPackages(p.variants, color);
      groups.forEach(g => {
        rows.push({ product: p, color, packGroup: g.packGroup, isBroken: g.isBroken, groupQty: g.qty, groupVariants: g.variants });
      });
    });
  });

  // "Ochilgan pochka" filtri — faqat shu maxsus tab tanlanganda
  if (katStatusFilter === "broken") rows = rows.filter(r => r.isBroken);

  // Statistika (mahsulot darajasida — nechta turdagi tovar bor)
  const totalAll   = ps.length;
  const totalFaol  = ps.filter(p => totalStock(p) > 0).length;
  const totalBroken = (() => {
    let cnt = 0;
    ps.forEach(p => {
      [...new Set(p.variants.map(v=>v.color))].forEach(c => {
        cnt += regroupPackages(p.variants, c).filter(g => g.isBroken).length;
      });
    });
    return cnt;
  })();
  const totalNol   = ps.filter(p => totalStock(p) === 0).length;
  const totalKam   = ps.filter(p => { const s=totalStock(p); return s>0&&s<=5; }).length;

  // Status tab badge larini yangilash
  const statEl = $("kat-stat-all");
  if (statEl) {
    const badge = (id, n) => { const el=$(id); if(el) el.textContent=n; };
    badge("kat-stat-all",   totalAll);
    badge("kat-stat-faol",  totalFaol);
    badge("kat-stat-nol",   totalNol);
    badge("kat-stat-kam",   totalKam);
    badge("kat-stat-broken", totalBroken);
  }

  // Pagination — endi rang-qatorlar bo'yicha
  const totalPages = Math.ceil(rows.length / KAT_PER_PAGE) || 1;
  if (katPage > totalPages) katPage = 1;
  const pageRows = rows.slice((katPage-1)*KAT_PER_PAGE, katPage*KAT_PER_PAGE);

  // Pagination UI
  const pgEl = $("kat-pagination");
  if (pgEl) {
    if (totalPages <= 1) {
      pgEl.innerHTML = "";
    } else {
      let pages = [];
      for (let i=1; i<=totalPages; i++) {
        if (i===1||i===totalPages||Math.abs(i-katPage)<=2) pages.push(i);
        else if (pages[pages.length-1]!=="...") pages.push("...");
      }
      pgEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:4px;padding:10px 18px;border-top:1px solid var(--brd);flex-wrap:wrap">
          <span style="font-size:12px;color:var(--mut);margin-right:8px">${rows.length} ta qator · ${ps.length} ta mahsulot</span>
          ${katPage>1?`<button class="btn btn-ghost btn-sm" onclick="katGoPage(${katPage-1})">‹</button>`:""}
          ${pages.map(p => p==="..."
            ? `<span style="padding:0 4px;color:var(--mut)">...</span>`
            : `<button class="btn btn-sm ${p===katPage?"btn-acc":("btn-ghost")}" onclick="katGoPage(${p})">${p}</button>`
          ).join("")}
          ${katPage<totalPages?`<button class="btn btn-ghost btn-sm" onclick="katGoPage(${katPage+1})">›</button>`:""}
          <span style="font-size:12px;color:var(--mut);margin-left:8px">${katPage}/${totalPages} sahifa</span>
        </div>`;
    }
  }

  // Barcha ustunlarni ko'rinishini yangilash
  KAT_ALL_COLS.forEach(c => {
    document.querySelectorAll(`.kat-col-${c.key}`).forEach(el => {
      el.style.display = katCols[c.key] ? "" : "none";
    });

  });

  // Dinamik kategoriya tugmalarini yangilash
  // (kategoriya tugmalari olib tashlandi)

  // Ko'rinish rejimi
  const tableWrap = $("kat-table-wrap");
  const gridWrap  = $("kat-grid-wrap");
  if (tableWrap) tableWrap.style.display = katViewMode==="grid" ? "none" : "";
  if (gridWrap)  gridWrap.style.display  = katViewMode==="table"? "none" : "";

  if (katViewMode === "grid") {
    _renderKatGrid(pageRows, rate, showChakana);
    return;
  }

  $("katalog-body").innerHTML = pageRows.length ? pageRows.map(({product:p, color, packGroup, isBroken, groupQty, groupVariants}) => {
    // Shu guruhga oid variantlar (turli o'lchamlar, lekin bir xil miqdorda)
    const colorVariants = groupVariants;
    const sizesStr = sizesToRange(colorVariants.map(v => v.size).filter(Boolean), p.type);

    const inBox   = colorVariants.length || 1;
    const costUzs = (p.costUsd || 0) * rate;

    // Pochka soni: bu guruhdagi barcha o'lchamlar uchun bir xil (groupQty)
    const pochkaSoni = groupQty;
    // Jami dona (shu guruh uchun)
    const colorQty = colorVariants.reduce((a,v) => a + v.qty, 0);
    const pantone  = colorVariants[0]?.pantone || "";

    // Margin (ulgurji asosida)
    const margin = p.ulgurjiNarx > 0 && costUzs > 0
      ? Math.round((p.ulgurjiNarx - costUzs) / p.ulgurjiNarx * 100) : null;
    const mColor = margin == null ? "#ccc"
      : margin >= 30 ? "var(--grn)" : margin >= 15 ? "#E07B39" : "var(--red)";

    const rowKey = p.sku + "::" + color + "::" + packGroup;
    const isSel = _katSelected.has(rowKey);
    return `<tr onclick="openEditProduct('${p.sku}')" style="cursor:pointer;background:${isSel?"#fffbf0":(isBroken?"#FFFBF0":"")}">
      <td style="width:28px;padding:8px 4px" onclick="event.stopPropagation()">
        <input type="checkbox" ${isSel?"checked":""} onchange="katToggleSel('${rowKey}',this.checked)"
          style="width:16px;height:16px;accent-color:var(--acc);cursor:pointer">
      </td>
      <td class="kat-col-image" onclick="event.stopPropagation()">
        <div style="position:relative;display:inline-block">
          ${(() => {
            // Rang bo'yicha rasm — agar shu rangga alohida rasm yuklangan bo'lsa
            // shuni ko'rsatamiz, aks holda mahsulotning umumiy rasmi
            const rowImg = (p.colorImages && p.colorImages[color]) || p.image || "";
            return rowImg
              ? `<img src="${rowImg}" class="kat-thumb" style="cursor:pointer"
                  onclick="katImgClick('${p.sku}','${jsEsc(color)}')" title="Rasmni o'zgartirish">`
              : `<div class="kat-thumb-empty" style="cursor:pointer"
                  onclick="katImgClick('${p.sku}','${jsEsc(color)}')" title="Rasm qo'shish">
                  <i class="ti ti-camera-plus" style="font-size:16px"></i>
                </div>`;
          })()}
        </div>
      </td>
      <td class="kat-col-sku" style="font-family:monospace;font-size:11px;color:var(--mut)">${p.sku}</td>
      <td class="kat-col-art" style="font-family:monospace;font-size:12px;font-weight:700;color:#0D1B2A">${p.art || '<span style="color:#ddd">—</span>'}</td>
      <td class="kat-col-name">
        <div style="font-weight:700;font-size:13.5px;color:#0D1B2A">${p.name}</div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:2px">
          ${sizesStr ? `<span style="font-size:11.5px;color:#bbb">${sizesStr}</span>` : ""}
          ${isBroken ? `<span style="background:#FEF3C7;color:#92400E;font-size:9.5px;font-weight:700;padding:1px 7px;border-radius:8px;white-space:nowrap">ochilgan</span>` : ""}
        </div>
      </td>
      <td class="kat-col-category" style="font-size:12px;color:var(--mut)">${p.category}</td>
      <td class="kat-col-barcode" style="font-family:monospace;font-size:12px">
        ${p.colorBarcodes && p.colorBarcodes[color]
          ? `<span style="background:var(--bg);padding:2px 8px;border-radius:5px;border:1px solid var(--brd)">${p.colorBarcodes[color]}</span>`
          : p.barcode
            ? `<span style="background:var(--bg);padding:2px 8px;border-radius:5px;border:1px solid var(--brd)">${p.barcode}</span>`
            : `<span style="color:#ccc">—</span>`}
      </td>
      <td class="kat-col-supplier" style="font-size:12px;color:var(--mut)">${p.supplier||'<span style="color:#ddd">—</span>'}</td>
      <td class="kat-col-colors">
        <div style="font-size:12.5px;font-weight:500">${color}</div>
        ${pantone ? `<div style="font-size:10px;color:#bbb">${pantone}</div>` : ""}
      </td>
      <td class="kat-col-boxes num">
        <span class="bg ${isBroken?"bg-a":pochkaSoni<=0?"bg-r":pochkaSoni<=5?"bg-a":"bg-g"}" style="font-weight:700">
          ${pochkaSoni} ${p.packUnit||"pochka"}
        </span>
      </td>
      <td class="kat-col-qty num">
        <span style="font-size:12.5px;color:var(--mut)">${colorQty} ${p.unit||"dona"}</span>
      </td>
      <td class="kat-col-cost num" style="font-size:12.5px">
        ${costUzs ? `<div style="font-weight:600">${priceDisplay(costUzs)}</div>` : "—"}
        ${costUzs && inBox > 1 ? `<div style="font-size:11px;color:#856404;margin-top:2px">📦 ${priceDisplay(costUzs * inBox)}</div>` : ""}
        ${p.costUsd && (db.settings?.priceCurrency||"uzs")==="uzs" ? `<div style="font-size:10.5px;color:#bbb">$${(+p.costUsd).toFixed(2)}</div>` : ""}
      </td>
      <td class="kat-col-ulgurji num" style="font-size:12.5px">
        ${p.ulgurjiNarx ? `<div style="font-weight:700;color:var(--acc)">${priceDisplay(p.ulgurjiNarx)}</div>` : '<span style="color:#ccc">—</span>'}
        ${p.ulgurjiNarx && inBox > 1 ? `<div style="font-size:11px;color:#e9a500;margin-top:2px">📦 ${priceDisplay(p.ulgurjiNarx * inBox)}</div>` : ""}
      </td>
      <td class="kat-col-chakana num" style="color:var(--teal);font-size:12.5px">${p.priceUzs ? priceDisplay(p.priceUzs) : "—"}</td>
      <td class="kat-col-margin num" style="font-size:12px">
        ${margin != null ? `<span style="color:${mColor};font-weight:700">${margin}%</span>` : '<span style="color:#ddd">—</span>'}
      </td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditProduct('${p.sku}')">
          <i class="ti ti-edit"></i>
        </button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="15" class="empty-td">
    ${katLowFilter ? "Kam qoldiqli mahsulot yo'q 🎉" : q ? `"${q}" topilmadi` : "Mahsulot yo'q"}
  </td></tr>`;

  // tbody render bo'lganidan KEYIN th va td larni sinxron yangilash
  KAT_ALL_COLS.forEach(c => {
    const disp = katCols[c.key] ? "" : "none";
    document.querySelectorAll(`.kat-col-${c.key}`).forEach(el => {
      el.style.display = disp;
    });
  });
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

// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
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

// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
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

// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
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
// Tahrir modalidan nusxalash (v144): tugma qator ichidan modal
// ichiga ko'chirildi — tasodifiy bosishda katalog ifloslanmasin
function epDuplicate() {
  if (typeof editSku === "undefined" || !editSku) return;
  if (!confirm("Shu mahsulotdan nusxa olinsinmi? (qoldiqlar 0 bilan)")) return;
  duplicateProduct(editSku);
  if (typeof closeModal === "function") closeModal("editprod");
}

function duplicateProduct(sku, event) {
  if (event) event.stopPropagation();
  const p = db.products.find(x => x.sku === sku);
  if (!p) return;

  // Yangi SKU yaratamiz
  const newSku = p.sku + "-copy-" + Date.now().toString().slice(-4);

  const copy = JSON.parse(JSON.stringify(p)); // deep copy
  copy.sku  = newSku;
  copy.id   = db.seq;
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
  // Tannarx: bazada har doim USD da saqlanadi (costUsd). Valyuta rejimiga qarab ko'rsatamiz.
  {
    const cur1  = db.settings?.priceCurrency || "uzs";
    const rate1 = db.settings?.rate || 12800;
    if (cur1 === "usd" || cur1 === "both") {
      $("ep-cost").value = p.costUsd;
    } else {
      $("ep-cost").value = Math.round((p.costUsd || 0) * rate1);
    }
  }
  $("ep-price").value           = p.priceUzs;
  $("ep-ulgurji").value         = p.ulgurjiNarx || 0;
  if ($("ep-unit"))    $("ep-unit").value    = p.unit    || "dona";
  if ($("ep-art"))     $("ep-art").value     = p.art     || "";
  if ($("ep-barcode")) $("ep-barcode").value = p.barcode || "";
  // colorBarcodes ko'rsatish
  const cbEl = document.getElementById("ep-color-barcodes");
  if (cbEl) {
    if (p.colorBarcodes && Object.keys(p.colorBarcodes).length > 0) {
      cbEl.innerHTML = Object.entries(p.colorBarcodes).map(([clr, bc]) =>
        `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="min-width:60px;font-size:12px;color:var(--mut)">${clr}</span>
          <input value="${bc}" onchange="updateColorBarcode('${jsEsc(p.sku)}','${jsEsc(clr)}',this.value)"
            style="font-family:monospace;font-size:12px;border:1px solid var(--brd);border-radius:6px;padding:3px 7px;width:140px">
        </div>`
      ).join("");
      cbEl.style.display = "block";
    } else {
      cbEl.style.display = "none";
    }
  }
  epUpdateInboxDisplay(p);
  if ($("ep-packunit")) {
    $("ep-packunit").innerHTML = (PACK_UNITS[p.type]||["karobka"]).map(u =>
      `<option ${u===p.packUnit?"selected":""}>${u}</option>`).join("");
  }

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
  epRenderColorCards(p);
  epCloseAddColor();
  openModal("editprod");
}

// ── Ranglar bo'yicha karta ko'rinish ──────────────

// 1 pochkada nechta o'lcham borligini avtomatik hisoblab ko'rsatish
// (mahsulotdagi eng ko'p o'lchamga ega rang guruhi asosida)
function epUpdateInboxDisplay(p) {
  const colors = [...new Set(p.variants.map(v => v.color))];
  let maxSizes = 1;
  colors.forEach(c => {
    const cnt = p.variants.filter(v => v.color === c).length;
    if (cnt > maxSizes) maxSizes = cnt;
  });
  p.inBox = maxSizes;
  if ($("ep-inbox")) $("ep-inbox").value = maxSizes;
  epUpdateBoxHints();
}

// Rang bo'yicha rasm yuklash (har rang o'z rasmiga ega bo'ladi)
function epLoadColorImage(input, color) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast("Rasm 5MB dan kichik bo'lishi kerak","err"); return; }

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const MAX = 400;
      let w = img.width, h = img.height;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
      else       { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }

      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);

      let q = 0.82, dataUrl;
      do { dataUrl = canvas.toDataURL("image/jpeg", q); q -= 0.08; }
      while (dataUrl.length > 400000 && q > 0.25);

      const p = db.products.find(x => x.sku === editSku); if (!p) return;
      if (!p.colorImages) p.colorImages = {};
      p.colorImages[color] = dataUrl;
      epRenderColorCards(p);
      saveDB();
      toast(`✅ "${color}" rangiga rasm yuklandi`);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function epRemoveColorImage(color) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  if (p.colorImages) delete p.colorImages[color];
  epRenderColorCards(p);
  saveDB();
  toast(`"${color}" rasmi o'chirildi`);
}

// HTML onclick/onchange ichida xavfsiz ishlatish uchun — apostrof va
// boshqa maxsus belgilarni escape qiladi (masalan "Ko'k" rangidagi apostrof)
function jsEsc(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
}

function epRenderColorCards(p) {
  const colors = [...new Set(p.variants.map(v => v.color))];
  const el = $("ep-color-cards");
  el.innerHTML = colors.map(color => {
    const variants = p.variants.filter(v => v.color === color);
    const totalQty = variants.reduce((a,v) => a + v.qty, 0);
    const pantone  = variants[0]?.pantone || "";
    const hex      = variants[0]?.hex || "#888";
    const groups   = typeof regroupPackages === "function" ? regroupPackages(p.variants, color) : [];

    const colorImg = (p.colorImages && p.colorImages[color]) || p.image || "";
    const colorImgId = `epcimg_${color.replace(/[^a-zA-Z0-9]/g,"_")}`;
    return `<div class="ep-color-card" style="border:1.5px solid var(--brd);border-radius:10px;padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="position:relative;width:40px;height:40px;flex-shrink:0;border-radius:8px;overflow:hidden;border:1.5px solid var(--brd);background:${hex}33;cursor:pointer"
             onclick="document.getElementById('${colorImgId}').click()">
          ${colorImg ? `<img src="${colorImg}" style="width:100%;height:100%;object-fit:cover">` : `<div style="width:18px;height:18px;border-radius:5px;position:absolute;top:11px;left:11px;background:${hex};border:1px solid rgba(0,0,0,.12)"></div>`}
          <div style="position:absolute;bottom:0;right:0;background:#0D1B2A;color:#fff;width:16px;height:16px;border-radius:4px 0 0 0;display:flex;align-items:center;justify-content:center">
            <i class="ti ti-camera" style="font-size:10px"></i>
          </div>
        </div>
        <input type="file" id="${colorImgId}" accept="image/*" style="display:none" onchange="epLoadColorImage(this,'${jsEsc(color)}')">
        <input value="${color}" data-epcolor="${color}" data-field="color"
          oninput="epUpdateColorField('${jsEsc(color)}',this)"
          style="font-weight:700;font-size:13.5px;border:none;background:transparent;flex:1;padding:2px 0">
        <span style="font-size:11px;color:#555">${pantone}</span>
        <span style="font-size:10.5px;color:#555">Jami: ${totalQty} dona</span>
        ${colorImg ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="epRemoveColorImage('${jsEsc(color)}')" title="Rasmni o'chirish">
          <i class="ti ti-photo-off" style="font-size:13px;color:var(--mut)"></i>
        </button>` : ""}
        <button class="btn btn-ghost btn-icon btn-sm" onclick="epDeleteColor('${jsEsc(color)}')" title="Bu rangni butunlay o'chirish">
          <i class="ti ti-trash" style="color:var(--red)"></i>
        </button>
      </div>

      ${groups.map((g, gi) => {
        const sizesStr = sizesToRange(g.variants.map(v => v.size).filter(Boolean), p.type);
        const cardId = `epcard_${color.replace(/[^a-zA-Z0-9]/g,"_")}_${gi}`;
        return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 0;${gi>0?'border-top:1px dashed var(--brd)':''}">
          <div style="font-size:12px;color:var(--mut);min-width:90px">
            O'lcham: <strong style="color:#0D1B2A">${sizesStr || "—"}</strong>
            ${g.isBroken ? `<span style="background:#FEF3C7;color:#92400E;font-size:9px;font-weight:700;padding:1px 6px;border-radius:7px;margin-left:4px">ochilgan</span>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px;color:var(--mut)">Pochka:</span>
            <input type="number" value="${g.qty}" min="0" data-epgroupqty="${color}::${gi}"
              onchange="epUpdateGroupQty('${jsEsc(color)}',${gi},this.value)"
              style="width:60px;border:1px solid var(--brd);border-radius:6px;padding:4px 8px;font-size:13px;font-weight:700;text-align:center">
            <span style="font-size:11px;color:#bbb">${p.packUnit||"pochka"}</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="epToggleDetail('${cardId}')" style="font-size:11px;color:var(--mut)">
            <i class="ti ti-list-details" style="font-size:13px"></i> Tafsilot
          </button>
          <div id="${cardId}" style="display:none;width:100%;margin-top:6px">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:5px">
              ${g.variants.map(v => `
                <div style="display:flex;align-items:center;gap:3px;background:var(--bg);border:1px solid var(--brd);border-radius:7px;padding:3px 5px">
                  <span style="font-size:10.5px;color:var(--mut);min-width:22px">${v.size}</span>
                  <input type="number" value="${v.qty}" min="0" data-epqty="${color}::${v.size}"
                    oninput="epUpdateQty('${jsEsc(color)}','${v.size}',this.value)"
                    style="width:100%;border:none;background:transparent;font-size:11px;font-weight:600;text-align:right;padding:1px">
                </div>`).join("")}
            </div>
          </div>
        </div>`;
      }).join("")}

      <div style="padding-top:8px">
        <button class="btn btn-ghost btn-sm" onclick="epAddSizeToColor('${jsEsc(color)}')"
          style="border:1.5px dashed var(--brd);border-radius:7px;padding:4px 10px;font-size:11px;color:var(--mut)">
          <i class="ti ti-plus" style="font-size:13px"></i> o'lcham qo'shish
        </button>
      </div>
    </div>`;
  }).join("");
}

// Pochka guruhidagi barcha o'lchamlarga teng qiymat o'rnatish
function epUpdateGroupQty(color, groupIdx, val) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const newQty = parseInt(val) || 0;
  const groups = regroupPackages(p.variants, color);
  const g = groups[groupIdx]; if (!g) return;
  // Shu guruhdagi har bir o'lchamning farqini hisoblab, asl variantga qo'shamiz
  g.variants.forEach(gv => {
    const v = p.variants.find(x => x.color === color && x.size === gv.size);
    if (v) v.qty = v.qty - g.qty + newQty;
  });
  epRenderColorCards(p);
  epUpdateInboxDisplay(p);
}

// Tafsilot panelini ochish/yopish
function epToggleDetail(cardId) {
  const el = $(cardId); if (!el) return;
  el.style.display = el.style.display === "none" ? "block" : "none";
}

// Pochka sonini bitta input orqali barcha o'lchamlarga teng qilib o'rnatish
// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function epUpdateAllQty(color, val) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const newQty = parseInt(val) || 0;
  p.variants.forEach(v => { if (v.color === color) v.qty = newQty; });
  epRenderColorCards(p);
  epUpdateInboxDisplay(p);
}

function epUpdateQty(color, size, val) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const v = p.variants.find(x => x.color === color && x.size === size);
  if (v) v.qty = parseInt(val) || 0;
}

function epUpdateColorField(oldColor, input) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const newColor = input.value.trim();
  if (!newColor || newColor === oldColor) return;
  p.variants.forEach(v => { if (v.color === oldColor) v.color = newColor; });
}

function epDeleteColor(color) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const colorCount = [...new Set(p.variants.map(v=>v.color))].length;
  if (colorCount <= 1) { toast("Kamida 1 ta rang qolishi kerak","err"); return; }
  if (!confirm(`"${color}" rangini butunlay o'chirasizmi?`)) return;
  p.variants = p.variants.filter(v => v.color !== color);
  epRenderColorCards(p);
  epUpdateInboxDisplay(p);
  toast(`"${color}" o'chirildi`, "info");
}

function epAddSizeToColor(color) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const size = prompt("Qaysi o'lchamni qo'shmoqchisiz?");
  if (!size) return;
  const ex = p.variants.find(v => v.color === color && v.size === size.trim());
  if (ex) { toast("Bu o'lcham allaqachon mavjud","err"); return; }
  const ref = p.variants.find(v => v.color === color);
  p.variants.push({ color, size: size.trim(), qty: 0, pantone: ref?.pantone||"", hex: ref?.hex||"#888" });
  epRenderColorCards(p);
  epUpdateInboxDisplay(p);
}

// ── Yangi rang qo'shish paneli ──────────────────────
let epaSizeEditing = false;

function epOpenAddColor() {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  $("epa-color").value = "";
  $("epa-pantone").value = "";
  $("epa-hex").value = "#1A1A1A";
  $("epa-boxes").value = "1";
  $("epa-inbox").value = p.inBox || 6;
  const t = p.type || "oyoq";
  $("epa-size-from").innerHTML = (SIZES[t]||[]).map(s => `<option>${s}</option>`).join("");
  $("epa-size-to").innerHTML   = (SIZES[t]||[]).map(s => `<option>${s}</option>`).join("");
  epaResetSizeToStandard(); // standartga o'rnatish
  apApplyFields();
  $("ep-addcolor-panel").style.display = "block";
}

function epCloseAddColor() {
  $("ep-addcolor-panel").style.display = "none";
}

function epaToggleSizeEdit() {
  epaSizeEditing = !epaSizeEditing;
  const p = db.products.find(x => x.sku === editSku);
  const t = p?.type || "oyoq";
  const fromEl = $("epa-size-from"), toEl = $("epa-size-to");
  if (fromEl) fromEl.disabled = !epaSizeEditing;
  if (toEl)   toEl.disabled   = !epaSizeEditing;
  const btn = $("epa-size-edit-btn");
  if (epaSizeEditing) {
    if (btn) btn.innerHTML = `<i class="ti ti-lock"></i> Standartga qaytarish`;
  } else {
    if (btn) btn.innerHTML = `<i class="ti ti-edit"></i> O'zgartirish`;
    const def = SIZES_DEFAULT_RANGE[t] || { from:(SIZES[t]||[])[0], to:(SIZES[t]||[])[0] };
    if (fromEl) fromEl.value = def.from;
    if (toEl)   toEl.value   = def.to;
  }
  epaCalc();
}

// epOpenAddColor chaqirganda ishlatiladi — faqat UI ni standart holatga tiklaydi,
// "usesCustomSizeRange" belgisiga tegmaydi
function epaResetSizeToStandard() {
  epaSizeEditing = false;
  const p = db.products.find(x => x.sku === editSku);
  const t = p?.type || "oyoq";
  const fromEl = $("epa-size-from"), toEl = $("epa-size-to");
  if (fromEl) fromEl.disabled = true;
  if (toEl)   toEl.disabled   = true;
  const btn = $("epa-size-edit-btn");
  if (btn) btn.innerHTML = `<i class="ti ti-edit"></i> O'zgartirish`;
  const def = SIZES_DEFAULT_RANGE[t] || { from:(SIZES[t]||[])[0], to:(SIZES[t]||[])[0] };
  if (fromEl) fromEl.value = def.from;
  if (toEl)   toEl.value   = def.to;
  epaCalc();
}

function epaCalc() {
  const from = ($("epa-size-from")||{value:""}).value;
  const to   = ($("epa-size-to")||{value:""}).value;
  const boxes = parseInt(($("epa-boxes")||{value:1}).value) || 1;

  const p = db.products.find(x => x.sku === editSku);
  const t = p?.type || "oyoq";
  const allSizes = SIZES[t] || [];
  const iFrom = allSizes.indexOf(from), iTo = allSizes.indexOf(to);
  let sizeCount = 1;
  if (from && to) {
    if (from === to) sizeCount = 1;
    else if (iFrom !== -1 && iTo !== -1 && iFrom <= iTo) sizeCount = iTo - iFrom + 1;
  }

  if ($("epa-inbox")) $("epa-inbox").value = sizeCount;
  if ($("epa-qty"))   $("epa-qty").value   = boxes * sizeCount;
  const lbl = $("epa-size-lbl");
  if (lbl) lbl.textContent = from && to ? (from===to?from:`${from}–${to}`) : "";
}

function epConfirmAddColor() {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const color = ($("epa-color")||{value:""}).value.trim();
  if (!color) { toast("Rang nomini kiriting","err"); return; }
  if (p.variants.some(v => v.color.toLowerCase() === color.toLowerCase())) {
    toast("Bu rang allaqachon mavjud","err"); return;
  }
  const pantone = ($("epa-pantone")||{value:""}).value.trim();
  const hex     = ($("epa-hex")||{value:"#888"}).value;
  const from    = ($("epa-size-from")||{value:""}).value;
  const to      = ($("epa-size-to")||{value:""}).value;
  if (!from || !to) { toast("O'lchamni tanlang","err"); return; }

  const boxes = parseInt(($("epa-boxes")||{value:0}).value) || 0;
  if (boxes <= 0) { toast("Pochka sonini kiriting","err"); return; }

  const allSizes = SIZES[p.type] || [];
  const iFrom = allSizes.indexOf(from), iTo = allSizes.indexOf(to);
  let sizeRange;
  if (from === to) sizeRange = [from];
  else if (iFrom !== -1 && iTo !== -1 && iFrom <= iTo) sizeRange = allSizes.slice(iFrom, iTo+1);
  else sizeRange = [from, to];

  // Pochka mantig'i: har bir o'lchamga bir xil son (boxes)
  sizeRange.forEach(sz => {
    p.variants.push({ color, size: sz, qty: boxes, pantone, hex });
  });

  epRenderColorCards(p);
  epUpdateInboxDisplay(p);
  epCloseAddColor();
  toast(`"${color}" qo'shildi`);
}

function saveEditProduct() {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  // NARX O'QISH TUZATISHI (v144): fmtInput qiymatni "540 000" ko'rinishida
  // formatlaydi — parseFloat probelda to'xtab 540 qilib yuborardi.
  // _pv: probel/vergulni tozalab, kasrni saqlab o'qiydi.
  const _pv = id => parseFloat(String($(id)?.value || "")
    .replace(/[\s\u00A0\u202F]/g, "").replace(",", ".")) || 0;
  // Narx 0 ogohlantirish
  const _newPrice = _pv("ep-price");
  if (_newPrice === 0 && !confirm("Chakana narx 0 so'm qilib saqlansin?")) return;
  p.name        = $("ep-name").value.trim()     || p.name;
  p.category    = $("ep-cat").value.trim()      || p.category;
  // Tannarx: input qiymati joriy valyuta rejimida, bazaga har doim USD saqlanadi
  {
    const cur1  = db.settings?.priceCurrency || "uzs";
    const rate1 = db.settings?.rate || 12800;
    const raw   = _pv("ep-cost");
    p.costUsd = (cur1 === "usd" || cur1 === "both") ? raw : (raw / rate1);
  }
  p.priceUzs    = _pv("ep-price")   || p.priceUzs;
  p.ulgurjiNarx = _pv("ep-ulgurji");
  if ($("ep-unit"))     p.unit     = $("ep-unit").value     || p.unit;
  if ($("ep-art"))      p.art      = $("ep-art").value.trim();
  if ($("ep-barcode"))  p.barcode  = $("ep-barcode").value.trim();
  if ($("ep-inbox"))    p.inBox    = parseInt($("ep-inbox").value) || p.inBox || 1;
  if ($("ep-packunit")) p.packUnit = $("ep-packunit").value || p.packUnit;
  if ($("ep-image") && $("ep-image").value) p.image = $("ep-image").value;
  else if ($("ep-image") && $("ep-image").value === "") p.image = "";

  // Variant qiymatlari allaqachon epUpdateQty/epUpdateColorField orqali to'g'ridan-to'g'ri saqlangan
  p.variants = p.variants.filter(v => v.color && v.size);

  saveDB(); closeModal("editprod"); renderKatalog();
  toast(`"${p.name}" saqlandi`);
}

function deleteProduct() {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;

  // Aktiv sotuvlarda bormi?
  const activeSales = (db.sales||[]).filter(s =>
    s.status !== "qaytarilgan" &&
    (s.items||[]).some(i => i.sku === p.sku || i.name === p.name)
  );
  if (activeSales.length > 0) {
    const inDebt = activeSales.filter(s => s.status === "qarz").length;
    const msg = inDebt > 0
      ? `"${p.name}" ${activeSales.length} ta sotuvda mavjud, shundan ${inDebt} tasi qarzda!\nBaribir o'chirasizmi?`
      : `"${p.name}" ${activeSales.length} ta sotuvda mavjud.\nBaribir o'chirasizmi?`;
    if (!confirm(msg)) return;
  } else {
    if (!confirm(`"${p.name}" ni o'chirasizmi? Bu amalni qaytarib bo'lmaydi.`)) return;
  }

  db.products = db.products.filter(x => x.sku !== editSku);
  saveDB(); closeModal("editprod"); renderKatalog();
  toast(`"${p.name}" o'chirildi`, "info");
}

// ── O'lcham oralig'i: standart yopiq, kerak bo'lsa o'zgartiriladi ──
let apSizeEditing = false; // false = standart oraliq ishlatiladi, true = qo'lda tahrirlash
let currentApType = "oyoq"; // joriy tanlangan tur
let apPendingImage = ""; // tovar qo'shishda tanlangan rasm (base64)

function apImgClick() {
  const inp = $("ap-img-inp");
  if (inp) inp.click();
}

function apImgRemove() {
  apPendingImage = "";
  const prev = $("ap-img-preview");
  if (prev) prev.innerHTML = `<i class="ti ti-camera-plus" style="font-size:20px;color:#bbb"></i>`;
  const btn = $("ap-img-remove-btn");
  if (btn) btn.style.display = "none";
  const inp = $("ap-img-inp");
  if (inp) inp.value = "";
}

function apImgSave(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast("Rasm 5MB dan katta", "err"); return; }
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

      apPendingImage = dataUrl;
      const prev = $("ap-img-preview");
      if (prev) prev.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
      const btn = $("ap-img-remove-btn");
      if (btn) btn.style.display = "";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function apResetImage() {
  apPendingImage = "";
  const prev = $("ap-img-preview");
  if (prev) prev.innerHTML = `<i class="ti ti-camera-plus" style="font-size:20px;color:#bbb"></i>`;
  const btn = $("ap-img-remove-btn");
  if (btn) btn.style.display = "none";
  const inp = $("ap-img-inp");
  if (inp) inp.value = "";
}

function apToggleSizeEdit() {
  apSizeEditing = !apSizeEditing;
  const fromEl = $("ap-size-from"), toEl = $("ap-size-to");
  if (fromEl) fromEl.disabled = !apSizeEditing;
  if (toEl)   toEl.disabled   = !apSizeEditing;
  const btn = $("ap-size-edit-btn");
  const lbl = $("ap-size-standard-lbl");
  if (apSizeEditing) {
    if (btn) btn.innerHTML = `<i class="ti ti-lock"></i> Standartga qaytarish`;
    if (lbl) lbl.style.display = "none";
  } else {
    if (btn) btn.innerHTML = `<i class="ti ti-edit"></i> O'lchamni o'zgartirish`;
    if (lbl) lbl.style.display = "";
    apSetStandardSizeRange();
  }
}

// Modal ochilganda chaqiriladi — faqat UI ni standart holatga tiklaydi,
// "usesCustomSizeRange" belgisiga tegmaydi
function apResetSizeToStandard() {
  apSizeEditing = false;
  const fromEl = $("ap-size-from"), toEl = $("ap-size-to");
  if (fromEl) fromEl.disabled = true;
  if (toEl)   toEl.disabled   = true;
  const btn = $("ap-size-edit-btn");
  const lbl = $("ap-size-standard-lbl");
  if (btn) btn.innerHTML = `<i class="ti ti-edit"></i> O'lchamni o'zgartirish`;
  if (lbl) lbl.style.display = "";
  apSetStandardSizeRange();
}

function apSetStandardSizeRange() {
  const t = currentApType || "oyoq";
  const def = (typeof SIZES_DEFAULT_RANGE !== "undefined" && SIZES_DEFAULT_RANGE[t])
    ? SIZES_DEFAULT_RANGE[t] : { from: (SIZES[t]||[])[0], to: (SIZES[t]||[])[0] };
  if ($("ap-size-from")) $("ap-size-from").value = def.from;
  if ($("ap-size-to"))   $("ap-size-to").value   = def.to;
  const lbl = $("ap-size-standard-lbl");
  if (lbl) lbl.textContent = def.from === def.to ? def.from : `${def.from}–${def.to}`;
  apCalcBoxes();
}

function apCalcBoxes() {
  const boxes  = parseInt(($("ap-boxes")||{value:1}).value)          || 1;
  const from   = ($("ap-size-from")||{value:""}).value;
  const to     = ($("ap-size-to")||{value:""}).value;

  // O'lchamlar sonini hisoblash (39-44 = 6 ta o'lcham)
  const t = currentApType || "oyoq";
  const allSizes = SIZES[t] || [];
  const iFrom = allSizes.indexOf(from), iTo = allSizes.indexOf(to);
  let sizeCount = 1;
  if (from && to) {
    if (from === to) sizeCount = 1;
    else if (iFrom !== -1 && iTo !== -1 && iFrom <= iTo) sizeCount = iTo - iFrom + 1;
  }

  const total = boxes * sizeCount;

  if ($("ap-inbox-calc")) $("ap-inbox-calc").value = sizeCount;
  if ($("ap-qty-range"))  $("ap-qty-range").value  = total;

  const prev = $("ap-size-range-preview");
  if (prev && from && to) prev.textContent = from === to ? `→ faqat ${from}` : `→ ${from}–${to}`;
  else if (prev) prev.textContent = "";

  // Standart yorliqni ham yangilaymiz (agar tahrirlanmasa)
  if (!apSizeEditing) {
    const lbl = $("ap-size-standard-lbl");
    if (lbl && from && to) lbl.textContent = from === to ? from : `${from}–${to}`;
  }

  apCostNote();
}

function addProduct() {
  const name = ($("ap-name")||{value:""}).value.trim();
  if (!name) { toast("Nom kiriting","err"); return; }

  const color   = ($("ap-color")||{value:""}).value.trim();
  if (!color) { toast("Rang tanlang","err"); return; }

  const t       = currentApType || "oyoq";
  const costRaw = parseFloat(($("ap-cost")||{value:0}).value.replace(/\s/g,"")) || 0;
  const cur1    = db.settings?.priceCurrency || "uzs";
  const rate1   = db.settings?.rate || 12800;
  // Har doim USD da saqlaymiz
  const cost    = (cur1 === "usd" || cur1 === "both") ? costRaw : costRaw / rate1;
  const price   = parseFloat(($("ap-price")||{value:0}).value)   || 0;
  const ulg     = getRawVal("ap-ulgurji");
  const unit    = ($("ap-unit")||{value:"dona"}).value;
  const packUnit = ($("ap-packunit")||{value:"karobka"}).value;
  const pantone = ($("ap-pantone")||{value:""}).value.trim();
  const hex     = ($("ap-hex")||{value:"#888888"}).value;
  const art     = ($("ap-art")||{value:""}).value.trim();
  const barcode = ($("ap-barcode")||{value:""}).value.trim();

  // O'lcham oralig'i — har doim from/to dan o'qiladi (standart yoki tahrirlangan)
  const from = ($("ap-size-from")||{value:""}).value;
  const to   = ($("ap-size-to")||{value:""}).value;
  if (!from || !to) { toast("O'lchamni tanlang","err"); return; }

  const boxes  = parseInt(($("ap-boxes")||{value:1}).value)      || 1;
  const inBox  = parseInt(($("ap-inbox-calc")||{value:1}).value) || 1;
  if (boxes <= 0) { toast("Pochka sonini kiriting","err"); return; }

  // SIZES ro'yxatidan from..to oralig'ini olish
  const allSizes = SIZES[t] || [];
  const iFrom = allSizes.indexOf(from), iTo = allSizes.indexOf(to);
  let sizeRange;
  if (from === to) {
    sizeRange = [from];
  } else if (iFrom !== -1 && iTo !== -1 && iFrom <= iTo) {
    sizeRange = allSizes.slice(iFrom, iTo + 1);
  } else {
    sizeRange = [from, to]; // fallback
  }

  // Pochka mantig'i: har bir pochkada har o'lchamdan 1 tadan bo'ladi.
  // "boxes" soni = nechta pochka keldi. Har bir o'lcham shu songa teng dona oladi
  // (masalan 100 pochka × har birida 39-44 dan 1 tadan = har o'lchamda 100 dona).
  const newVariants = sizeRange.map(sz => ({ color, size: sz, qty: boxes, pantone, hex }));
  // 1 pochkada nechta dona bor — bu o'lchamlar soniga teng (39-44 = 6 ta o'lcham = 6 dona)
  const effectiveInBox = sizeRange.length;

  let p = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (p) {
    newVariants.forEach(nv => {
      const ex = p.variants.find(v => v.color === nv.color && v.size === nv.size);
      if (ex) { ex.qty += nv.qty; if (pantone) { ex.pantone = pantone; ex.hex = hex; } }
      else p.variants.push(nv);
    });
    if (art) p.art = art;
    if (barcode && !p.barcode) p.barcode = barcode;
    if (packUnit) p.packUnit = packUnit;
    if (apPendingImage) p.image = apPendingImage;
    // Narxlarni ham yangilaymiz — foydalanuvchi modalda kiritgan narx ustuvor
    if (cost > 0)  p.costUsd     = cost;
    if (price > 0) p.priceUzs    = price;
    if (ulg > 0)   p.ulgurjiNarx = ulg;
    // inBox ni real holatdan yangilaymiz — yangi rang boshqa sonli o'lchamga
    // ega bo'lishi mumkin (masalan eski rang 39-44, yangisi faqat 40-42)
    {
      const colors = [...new Set(p.variants.map(v => v.color))];
      let maxSizes = 1;
      colors.forEach(c => {
        const cnt = p.variants.filter(v => v.color === c).length;
        if (cnt > maxSizes) maxSizes = cnt;
      });
      p.inBox = maxSizes;
    }
  } else {
    const autoBarcode = barcode || genEAN13(db.seq);
    const newProdId = db.seq++;
    db.products.push({
      id: newProdId,
      sku: `${t==="oyoq"?"SHOE":"CLTH"}-${String(newProdId).padStart(3,"0")}`,
      name, category: ($("ap-cat")||{value:""}).value,
      type:t, unit, inBox: effectiveInBox, packUnit,
      art: art || "",
      costUsd:cost, priceUzs:price, ulgurjiNarx:ulg,
      barcode: autoBarcode,
      image: apPendingImage || "",
      createdAt: new Date().toISOString(),
      variants: newVariants
    });
  }

  saveDB(); closeModal("addprod"); renderKatalog();
  toast(`"${name}" qo'shildi`);

  // Formani tozalash
  if ($("ap-name"))       $("ap-name").value       = "";
  if ($("ap-boxes"))      $("ap-boxes").value       = "1";
  if ($("ap-inbox-calc")) $("ap-inbox-calc").value  = "6";
  if ($("ap-art"))        $("ap-art").value         = "";
  if ($("ap-barcode"))    $("ap-barcode").value     = "";
  if ($("ap-cost-note"))  $("ap-cost-note").innerHTML = "";
  if ($("ap-ulgurji-note")) $("ap-ulgurji-note").innerHTML = "";
  if ($("ap-color"))      $("ap-color").value       = "";
  if ($("ap-existing-note")) $("ap-existing-note").style.display = "none";
  apResetImage();
  ppReset("ap");
  apResetSizeToStandard();
}

// Tovar qo'shish fieldlari sozlamalari
const AP_FIELDS = [
  { key:"image",     lbl:"Rasm yuklash",            def:true  },
  { key:"art",       lbl:"ART (artikul)",           def:true  },
  { key:"category",  lbl:"Kategoriya",              def:true  },
  { key:"unit",      lbl:"O'lchov birligi",         def:true  },
  { key:"barcode",   lbl:"Barcode",                 def:false },
  { key:"cost",      lbl:"Tannarx",                 def:true  },
  { key:"packunit",  lbl:"To'plam birligi",         def:true  },
  { key:"pantone",   lbl:"Pantone kodi",            def:false },
  { key:"hex",       lbl:"Rang (hex)",              def:true  },
  { key:"sizerange", lbl:"O'lchamni o'zgartirish",  def:false },
];

function apGetFields() {
  return Object.assign({}, Object.fromEntries(AP_FIELDS.map(f=>[f.key,f.def])), db.settings.apFields||{});
}

function apApplyFields() {
  const fields = apGetFields();
  document.querySelectorAll('.ap-field[data-apf]').forEach(el => {
    const key = el.dataset.apf;
    el.style.display = fields[key] !== false ? '' : 'none';
  });
}

function openApFieldSettings() {
  const panel = $("ap-fields-panel"); if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  if (isOpen) { panel.style.display = 'none'; return; }
  apRenderFieldList();
  panel.style.display = 'block';
}

function closeApFieldSettings() {
  const panel = $("ap-fields-panel"); if (panel) panel.style.display = 'none';
}

function apRenderFieldList() {
  const fields = apGetFields();
  const el = $("ap-field-list"); if (!el) return;
  el.innerHTML = AP_FIELDS.map(f => `
    <label class="kat-col-item ${fields[f.key]!==false?'active':''}"
      onclick="apToggleField('${f.key}',${fields[f.key]===false}); return false;"
      style="padding:7px 12px">
      <div class="kat-col-check">${fields[f.key]!==false
        ? '<i class="ti ti-check" style="font-size:13px;color:#fff"></i>' : ''}</div>
      <span style="font-size:13px">${f.lbl}</span>
    </label>`).join('');
}

function apToggleField(key, val) {
  if (!db.settings.apFields) db.settings.apFields = {};
  db.settings.apFields[key] = val;
  saveDB();
  apRenderFieldList();
  apApplyFields();
}

// Mahsulot nomi yozilganda — agar mavjud tovar bo'lsa, narxlarni ko'rsatish
function apNameAutofill(val) {
  const listEl = $("ap-name-list");
  if (listEl) {
    listEl.innerHTML = db.products
      .filter(p => p.name.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 20)
      .map(p => `<option value="${p.name}">`).join("");
  }

  const note = $("ap-existing-note");
  const p = db.products.find(x => x.name.toLowerCase() === val.toLowerCase().trim());

  if (!p) {
    if (note) note.style.display = "none";
    return;
  }

  // Mavjud tovar topildi — narxlarni avtomatik to'ldiramiz va ogohlantiramiz
  const rate = db.settings?.rate || 12800;
  const cur1 = db.settings?.priceCurrency || "uzs";
  if ($("ap-cost")) $("ap-cost").value = (cur1 === "usd" || cur1 === "both") ? p.costUsd : Math.round((p.costUsd||0)*rate);
  if ($("ap-ulgurji")) { $("ap-ulgurji").value = p.ulgurjiNarx || 0; if (typeof fmtInput === "function") fmtInput($("ap-ulgurji")); }
  if ($("ap-art") && p.art) $("ap-art").value = p.art;

  const totalQty = p.variants.reduce((a,v) => a+v.qty, 0);
  if (note) {
    note.style.display = "block";
    note.innerHTML = `<i class="ti ti-info-circle"></i> Bu tovar allaqachon mavjud (joriy qoldiq: ${totalQty} ${p.unit||"dona"}). Yangi rang shu tovarga qo'shiladi, narxlar yangilanadi.`;
  }
  apCostNote();
}

function apTypeChange(t) {
  // shopType dan tur olish - foydalanuvchi o'zgartira olmaydi
  const shopType = typeof getShopType === 'function' ? getShopType() : 'ikki';
  // Agar shopType bitta bo'lsa — shuni ishlatamiz
  if (shopType !== 'ikki') t = shopType;
  // Agar t berilmasa
  if (!t) t = shopType === 'ikki' ? 'oyoq' : shopType;

  // Tur ko'rsatkichi
  const display = $("ap-type-display");
  if (display) {
    if (shopType === 'ikki') {
      // Ikkalasi bo'lsa — tanlov ko'rsatamiz (info ko'rinishda, bosilmaydi)
      display.innerHTML = `
        <div style="display:flex;gap:8px;width:100%">
          <div style="flex:1;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;
            background:${t==='oyoq'?'var(--sb)':'var(--bg2)'};color:${t==='oyoq'?'#fff':'var(--mut)'};
            border:1.5px solid ${t==='oyoq'?'var(--sb)':'var(--brd)'};cursor:pointer"
            onclick="apTypeChange('oyoq')">👟 Oyoq kiyim</div>
          <div style="flex:1;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;
            background:${t==='kiyim'?'var(--sb)':'var(--bg2)'};color:${t==='kiyim'?'#fff':'var(--mut)'};
            border:1.5px solid ${t==='kiyim'?'var(--sb)':'var(--brd)'};cursor:pointer"
            onclick="apTypeChange('kiyim')">👕 Kiyim-kechak</div>
        </div>`;
    } else {
      // Faqat bitta tur — info band
      const icon = shopType==='oyoq' ? '👟' : '👕';
      const lbl  = shopType==='oyoq' ? 'Oyoq kiyim' : 'Kiyim-kechak';
      display.innerHTML = `
        <div style="flex:1;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;
          background:var(--sb);color:#fff;border:1.5px solid var(--sb);text-align:center">
          ${icon} ${lbl}
          <span style="font-size:10px;opacity:.7;margin-left:8px">(egasi tomonidan belgilangan)</span>
        </div>`;
    }
  }

  // Joriy turni saqlash
  currentApType = t;
  // Kategoriya va o'lchamlarni yangilash
  if ($("ap-cat"))       $("ap-cat").innerHTML       = (CATS[t]||[]).map(c => `<option>${c}</option>`).join("");
  if ($("ap-size-from")) $("ap-size-from").innerHTML = (SIZES[t]||[]).map(s => `<option>${s}</option>`).join("");
  if ($("ap-size-to"))   $("ap-size-to").innerHTML   = (SIZES[t]||[]).map(s => `<option>${s}</option>`).join("");
  if ($("ap-packunit"))  $("ap-packunit").innerHTML  = (PACK_UNITS[t]||["karobka"]).map(u => `<option>${u}</option>`).join("");
  apResetSizeToStandard(); // standart oraliqqa o'rnatish (39-44 yoki S-XL)
  apApplyFields();
  apCostNote();
}

function apCostNote() {
  const cur  = db.settings?.priceCurrency || "uzs";
  const rate = db.settings?.rate || 1;
  const c    = parseFloat(($("ap-cost")||{value:0}).value) || 0;
  const u    = getRawVal("ap-ulgurji") || 0;
  const inBoxC = parseInt(($("ap-inbox-calc")||{value:1}).value) || 1;
  const packUnit = ($("ap-packunit")||{value:"karobka"}).value;
  const el   = $("ap-cost-note"); if (!el) return;
  const elU  = $("ap-ulgurji-note");

  let costUzs = 0;
  if (c > 0) {
    let txt;
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
    // To'plam narxini qo'shamiz (masalan: 1 karobka = 1 800 000 so'm)
    if (inBoxC > 1) txt += `<br>1 ${packUnit} (${inBoxC} dona) = ${fmt(costUzs * inBoxC)} so'm`;
    el.innerHTML = txt;
  } else {
    el.innerHTML = "";
  }

  // Ulgurji narx ostida ham to'plam narxi
  if (elU) {
    if (u > 0 && inBoxC > 1) {
      elU.innerHTML = `1 ${packUnit} (${inBoxC} dona) = ${fmt(u * inBoxC)} so'm`;
    } else {
      elU.innerHTML = "";
    }
  }
  apUpdateBoxHints();
}

// ── Excel eksport ──────────────────────────────
function exportKatalogExcel() {
  const rate = db.settings.rate || 12800;
  const fields = apGetFields();
  const shopType = typeof getShopType === "function" ? getShopType() : "ikki";

  const headers = ["Nomi", "ART"];
  if (fields.category) headers.push("Kategoriya");
  if (shopType === "ikki") headers.push("Turi");
  if (fields.unit) headers.push("Birlik");
  if (fields.packunit) headers.push("To'plam birligi");
  if (fields.barcode) headers.push("Barcode");
  headers.push("Rang");
  if (fields.pantone) headers.push("Pantone");
  headers.push("O'lchamlar", "Pochka soni", "1 pochkada", "Jami dona");
  if (fields.cost) headers.push("Tannarx (USD)", "Tannarx (so'm)");
  headers.push("Ulgurji narx (so'm)", "Margin (%)");

  const rows = [headers];

  db.products.forEach(p => {
    const costUzs = Math.round((p.costUsd || 0) * rate);
    const margin = p.ulgurjiNarx > 0 && costUzs > 0
      ? Math.round((p.ulgurjiNarx - costUzs) / p.ulgurjiNarx * 100) : "";

    const colors = [...new Set((p.variants||[]).map(v => v.color))];
    const colorList = colors.length ? colors : [""];

    colorList.forEach(color => {
      const variants = p.variants.filter(v => v.color === color);
      const sizesStr = variants.map(v => v.size).filter(Boolean).join(", ");
      const pochkaSoni = variants.length > 0 ? Math.min(...variants.map(v => v.qty)) : 0;
      const jamiDona = variants.reduce((a,v) => a + v.qty, 0);
      const pantone = variants[0]?.pantone || "";

      const row = [p.name, p.art || ""];
      if (fields.category) row.push(p.category);
      if (shopType === "ikki") row.push(p.type === "oyoq" ? "Oyoq kiyim" : "Kiyim");
      if (fields.unit) row.push(p.unit || "dona");
      if (fields.packunit) row.push(p.packUnit || "pochka");
      if (fields.barcode) row.push(p.barcode || "");
      row.push(color);
      if (fields.pantone) row.push(pantone);
      row.push(sizesStr, pochkaSoni, p.inBox || 1, jamiDona);
      if (fields.cost) row.push(p.costUsd || 0, costUzs);
      row.push(p.ulgurjiNarx || 0, margin);
      rows.push(row);
    });
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
  // ep-cost input qiymati endi joriy valyuta rejimida (UZS bo'lsa to'g'ridan-to'g'ri so'm)
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
  const fields = apGetFields();

  // Har doim majburiy bo'lgan ustunlar: Nom, ART, Rang, Pochka soni, Ulgurji narx
  // "O'lcham" va "1 pochkada nechta" faqat sizerange yoqilgan bo'lsa qo'shiladi
  // (chunki standart holatda ular avtomatik aniqlanadi: standart oraliq va shu oraliq uzunligi)
  const headers = ["Nom", "ART", "Rang"];
  const sampleBase  = ["Adidas Ultra", "ADI-001", "Qora"];
  const sampleBase2 = ["Adidas Ultra", "ADI-001", "Oq"];
  const sampleBase3 = ["Ko'ylak slim", "SLM-05", "Ko'k"];

  // "O'lcham" va "1 pochkada nechta" faqat "O'lchamni o'zgartirish" yoqilgan bo'lsa chiqadi
  if (fields.sizerange) {
    headers.push("O'lcham");
    sampleBase.push("39-44"); sampleBase2.push("39-44"); sampleBase3.push("S-XL");

    headers.push("1 pochkada nechta");
    sampleBase.push("6"); sampleBase2.push("6"); sampleBase3.push("4");
  }

  headers.push("Pochka soni");
  sampleBase.push("100"); sampleBase2.push("80"); sampleBase3.push("50");

  if (fields.category) {
    headers.push("Kategoriya");
    sampleBase.push("Krossovka"); sampleBase2.push("Krossovka"); sampleBase3.push("Ko'ylak");
  }
  if (fields.cost) {
    headers.push("Tannarx");
    sampleBase.push("450000"); sampleBase2.push("450000"); sampleBase3.push("80000");
  }

  headers.push("Ulgurji narx");
  sampleBase.push("550000"); sampleBase2.push("550000"); sampleBase3.push("150000");

  if (fields.unit) {
    headers.push("Birlik");
    sampleBase.push("juft"); sampleBase2.push("juft"); sampleBase3.push("dona");
  }
  if (fields.packunit) {
    headers.push("To'plam birligi");
    sampleBase.push("pochka"); sampleBase2.push("pochka"); sampleBase3.push("pochka");
  }
  if (fields.pantone) {
    headers.push("Pantone");
    sampleBase.push(""); sampleBase2.push(""); sampleBase3.push("");
  }

  // Tur — agar do'kon "ikkalasi" rejimida bo'lsa kerak, aks holda shart emas
  const shopType = typeof getShopType === "function" ? getShopType() : "ikki";
  if (shopType === "ikki") {
    headers.push("Turi");
    sampleBase.push("oyoq"); sampleBase2.push("oyoq"); sampleBase3.push("kiyim");
  }

  const rows = [sampleBase, sampleBase2, sampleBase3];
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

  // Pantone rangdan hex olish
  function pantoneToHex(pantone, color) {
    if (!pantone && !color) return "#888888";
    const name = (color || "").toLowerCase();
    const map = {
      "qora":"#1A1A1A","black":"#1A1A1A","oq":"#F5F5F5","white":"#F5F5F5",
      "ko'k":"#154360","blue":"#154360","ko\u2019k":"#154360",
      "qizil":"#C0392B","red":"#C0392B","yashil":"#1E8449","green":"#1E8449",
      "sariq":"#D4AC0D","yellow":"#D4AC0D","kulrang":"#95A5A6","gray":"#95A5A6","grey":"#95A5A6",
      "pushti":"#E91E8C","pink":"#E91E8C","binafsha":"#7D3C98","purple":"#7D3C98",
      "jigarrang":"#784212","brown":"#784212","moviy":"#5DADE2","light blue":"#5DADE2",
      "krem":"#F0E6D3","cream":"#F0E6D3","to'q kulrang":"#2C3E50","dark gray":"#2C3E50",
      "to'q sariq":"#CA6F1E","orange":"#CA6F1E","to'q ko'k":"#154360",
    };
    return map[name] || map[name.replace(/[^a-z]/g,"")] || "#888888";
  }

  // Ustun mapping — sodda nomlar bilan
  const col = (name) => {
    const variants = {
      nom:     ["nom","name","nomi","mahsulot"],
      cat:     ["kategoriya","category","kat"],
      type:    ["turi","type","tur"],
      unit:    ["birlik","unit","o'lchov"],
      inbox:   ["1 pochkada nechta","karobkada nechta","karobkada","inbox","qutida nechta","pochkada"],
      boxes:   ["pochka soni","karobka soni","karobkalar","boxes","nechta karobka","nechta pochka"],
      art:     ["art","artikul","article","kod"],
      barcode: ["barcode","ean","barkod","shtrix"],
      color:   ["rang","color","rang nomi"],
      pantone: ["pantone","pantone kodi"],
      size:    ["o'lcham","size","olcham","razmer"],
      qty:     ["qoldiq","qoldiq (dona)","qty","miqdor","soni","dona"],
      cost:    ["tannarx","cost","tannarx so'm","tannarx usd","narx usd","tannarx (usd)","tannarx (so'm)"],
      ulg:     ["ulgurji","ulgurji narx","ulgurji narx (so'm)","sotuv narxi"],
    };
    const keys = variants[name] || [];
    for (const k of keys) {
      const idx = headers.findIndex(h => h.replace(/[()]/g,"").trim().includes(k));
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
    boxes:   col("boxes"),
    art:     col("art"),
    barcode: col("barcode"),
    color:   col("color"),
    pantone: col("pantone"),
    size:    col("size"),
    qty:     col("qty"),
    cost:    col("cost"),
    ulg:     col("ulg"),
  };

  if (cols.nom < 0) { toast("'Nom' ustuni topilmadi","err"); return; }

  // Barcode: bir xil nomli tovarlar bir xil barcode olmasligi uchun
  // Har bir noyob nom+art kombinatsiyasiga bitta barcode
  const barcodeMap = {};

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const nom  = vals[cols.nom]?.trim();
    if (!nom) continue;

    const art     = cols.art     >= 0 ? (vals[cols.art]?.trim()  || "") : "";
    const colorRaw= cols.color   >= 0 ? (vals[cols.color]?.trim()|| "Standart") : "Standart";
    const pantone = cols.pantone >= 0 ? (vals[cols.pantone]?.trim() || "") : "";
    const hex     = pantoneToHex(pantone, colorRaw);

    // Barcode: shablondan olish, yo'q bo'lsa nom+art+rang bo'yicha barcode
    // Har xil rangli tovar o'z barcodeiga ega bo'ladi (rang darajasida)
    let barcode = cols.barcode >= 0 ? vals[cols.barcode]?.trim().replace(/^'/,"") : "";
    if (!barcode) {
      // nom+art+RANG bo'yicha barcode — har xil rang alohida barcode oladi
      const bKey = (nom + "|" + art + "|" + colorRaw).toLowerCase();
      if (!barcodeMap[bKey]) {
        barcodeMap[bKey] = genEAN13(db.seq++);
      }
      barcode = barcodeMap[bKey];
    }
    // colorBarcode — bu rang uchun barcode (keyinroq ishlatiladi)
    const colorBarcode = barcode;

    // Pochka soni (har bir o'lchamga bir xil son beriladi)
    const boxesVal = cols.boxes >= 0 ? (parseInt(vals[cols.boxes]) || 0) : 0;
    if (boxesVal <= 0) { return; } // pochka soni bo'lmasa qatorni o'tkazib yuboramiz

    // Tannarx: "$" bilan boshlansa USD, aks holda so'm → USD konversiya
    const rate = db.settings?.rate || 12800;
    let costRaw = cols.cost >= 0 ? (vals[cols.cost]?.trim() || "0") : "0";
    let costUsd = 0;
    if (costRaw.startsWith("$")) {
      costUsd = parseFloat(costRaw.slice(1).replace(/[\s,]/g,"")) || 0;
    } else {
      const costNum = parseFloat(costRaw.replace(/[\s,]/g,"")) || 0;
      costUsd = costNum > 1000 ? costNum / rate : costNum;
    }

    const ulgVal = cols.ulg >= 0 ? (parseFloat((vals[cols.ulg]||"0").replace(/[\s,]/g,"")) || 0) : 0;
    const typeVal = cols.type >= 0 ? (vals[cols.type]?.trim() || "oyoq") : "oyoq";
    const catVal  = cols.cat  >= 0 ? (vals[cols.cat]?.trim()  || "Qabul qilingan") : "Qabul qilingan";
    const unitVal = cols.unit >= 0 ? (vals[cols.unit]?.trim()  || "dona") : "dona";

    // O'lcham: ustun bo'sh/yo'q bo'lsa — standart oraliq ishlatiladi (39-44 yoki S-XL)
    const sizeRaw = cols.size >= 0 ? (vals[cols.size]?.trim() || "") : "";
    let sizeList;
    if (sizeRaw) {
      // "39-44" yoki "S-XL" formatini oraliqqa yoyish, yoki "42" bitta o'lcham
      const rangeMatch = sizeRaw.match(/^(.+?)\s*[-–]\s*(.+)$/);
      if (rangeMatch) {
        const allSizes = SIZES[typeVal] || [];
        const iF = allSizes.indexOf(rangeMatch[1].trim()), iT = allSizes.indexOf(rangeMatch[2].trim());
        sizeList = (iF !== -1 && iT !== -1 && iF <= iT) ? allSizes.slice(iF, iT+1) : [rangeMatch[1].trim(), rangeMatch[2].trim()];
      } else {
        sizeList = [sizeRaw];
      }
    } else {
      const def = SIZES_DEFAULT_RANGE[typeVal] || { from:(SIZES[typeVal]||["Aralash"])[0], to:(SIZES[typeVal]||["Aralash"])[0] };
      const allSizes = SIZES[typeVal] || [];
      const iF = allSizes.indexOf(def.from), iT = allSizes.indexOf(def.to);
      sizeList = (iF !== -1 && iT !== -1) ? allSizes.slice(iF, iT+1) : [def.from];
    }

    // 1 pochkada nechta — agar ustun bo'lmasa, o'lchamlar soniga teng (avtomatik)
    const inboxVal = cols.inbox >= 0 ? (parseInt(vals[cols.inbox]) || sizeList.length) : sizeList.length;

    // Pochka mantig'i: har bir o'lchamga bir xil son (boxesVal)
    sizeList.forEach(sz => {
      _importRows.push({
        nom, cat: catVal, type: typeVal, unit: unitVal,
        inbox: inboxVal, boxes: boxesVal || null,
        art, barcode, color: colorRaw, pantone, hex,
        size: sz, qty: boxesVal, costUsd, ulg: ulgVal,
      });
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
  if (head) head.innerHTML = `<tr>${["Nom","ART","Rang","O'lcham","Qoldiq","Tannarx (USD)","Ulgurji"].map(h =>
    `<th style="padding:6px 10px;font-weight:700;text-align:left;white-space:nowrap">${h}</th>`).join("")}</tr>`;

  const body = $("import-preview-body");
  if (body) body.innerHTML = _importRows.slice(0,5).map(r => `<tr>
    <td style="padding:5px 10px;border-top:1px solid var(--brd);font-weight:600">${r.nom}</td>
    <td style="padding:5px 10px;border-top:1px solid var(--brd);font-family:monospace;color:#666">${r.art||"—"}</td>
    <td style="padding:5px 10px;border-top:1px solid var(--brd)">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:14px;height:14px;border-radius:3px;background:${r.hex};border:1px solid rgba(0,0,0,.15);flex-shrink:0"></div>
        ${r.color}
      </div>
    </td>
    <td style="padding:5px 10px;border-top:1px solid var(--brd)">${r.size}</td>
    <td style="padding:5px 10px;border-top:1px solid var(--brd);font-weight:700">
      ${r.boxes ? `${r.boxes} pochka` : ""}${r.qty} ${r.unit||"dona"}
    </td>
    <td style="padding:5px 10px;border-top:1px solid var(--brd)">$${r.costUsd.toFixed(2)}</td>
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

  // Avtomatik partiya raqami: P-YYYY-NNN
  const _genPartiyaNum = () => {
    const year = new Date().getFullYear();
    const prefix = "P-" + year + "-";
    // Mavjud partiyalar orasidan eng katta raqamni topamiz
    let maxNum = 0;
    (db.ombor||[]).forEach(o => {
      if (o.partiya && o.partiya.startsWith(prefix)) {
        const n = parseInt(o.partiya.slice(prefix.length)) || 0;
        if (n > maxNum) maxNum = n;
      }
    });
    return prefix + String(maxNum + 1).padStart(3, "0");
  };
  const importPartiya = _genPartiyaNum();

  _importRows.forEach(r => {
    // Mavjud mahsulotni topish (nom + art bo'yicha)
    let p = db.products.find(x =>
      x.name.toLowerCase() === r.nom.toLowerCase() &&
      (r.art ? (x.art||"").toLowerCase() === r.art.toLowerCase() : true)
    ) || db.products.find(x => x.name.toLowerCase() === r.nom.toLowerCase());

    const variant = { color: r.color, size: r.size, qty: r.qty, pantone: r.pantone, hex: r.hex || "#888888" };

    // Rang barcode — nom+art+rang bo'yicha
    const colorRaw = r.color || "Standart";
    const nom = r.nom || "";
    const art = r.art || "";
    const bKey = (nom + "|" + art + "|" + colorRaw).toLowerCase();
    let colorBarcode = r.barcode || "";
    if (!colorBarcode) {
      // barcodeMap confirmImport da mavjud emas — seq++ bilan yaratamiz
      // Mavjud mahsulotda bu rang uchun barcode bormi?
      if (p && p.colorBarcodes && p.colorBarcodes[colorRaw]) {
        colorBarcode = p.colorBarcodes[colorRaw];
      } else {
        colorBarcode = genEAN13(db.seq++);
      }
    }

    if (p) {
      // Mavjud mahsulotga variant qo'shish
      const ex = p.variants.find(v =>
        v.color.toLowerCase() === r.color.toLowerCase() &&
        v.size === r.size
      );
      if (ex) {
        if (!skipDup) { ex.qty += r.qty; updated++; }
        else skipped++;
        // Mavjud variant uchun ham colorBarcodes to'ldiramiz
        if (!p.colorBarcodes) p.colorBarcodes = {};
        if (colorBarcode && !p.colorBarcodes[colorRaw]) {
          p.colorBarcodes[colorRaw] = colorBarcode;
        }
      } else {
        p.variants.push(variant);
        if (r.art && !p.art)   p.art         = r.art;
        if (r.costUsd > 0)     p.costUsd     = r.costUsd;
        if (r.ulg  > 0)        p.ulgurjiNarx = r.ulg;
        // colorBarcodes yangilash
        if (!p.colorBarcodes) p.colorBarcodes = {};
        if (colorBarcode && !p.colorBarcodes[colorRaw]) {
          p.colorBarcodes[colorRaw] = colorBarcode;
        }
        updated++;
      }
    } else {
      // Yangi mahsulot
      const newProdId = db.seq++;
      const sku = `IMP-${String(newProdId).padStart(4,"0")}`;
      const _bc = colorBarcode || r.barcode || genEAN13(db.seq++);
      const newProd = {
        id: newProdId,
        sku,
        name:        r.nom,
        category:    r.cat || "Qabul qilingan",
        type:        r.type === "kiyim" ? "kiyim" : "oyoq",
        unit:        r.unit || "dona",
        inBox:       r.inbox || 1,
        art:         r.art || "",
        barcode:     _bc,
        colorBarcodes: { [colorRaw]: _bc },
        costUsd:     r.costUsd || 0,
        priceUzs:    0,
        ulgurjiNarx: r.ulg || 0,
        createdAt:   new Date().toISOString(),
        variants:    [variant]
      };
      db.products.push(newProd);
      p = newProd;
      added++;
    }

    // Ombor kirim yozuvi (har bir qator uchun)
    if (r.qty > 0) {
      db.ombor.push({
        id:          db.seq++,
        date:        today(),
        sku:         p.sku,
        art:         p.art || "",
        productName: p.name,
        unit:        p.unit || "dona",
        color:       r.color,
        size:        r.size,
        qty:         r.qty,
        pantone:     r.pantone || "",
        hex:         r.hex || "#888888",
        boxes:       r.boxes || (p.inBox > 1 ? Math.round(r.qty / p.inBox) : null),
        kirimNarxi:  Math.round((r.costUsd || 0) * rate),
        chakana:     p.priceUzs    || 0,
        ulgurji:     p.ulgurjiNarx || r.ulg || 0,
        supplier:    "",
        partiya:     importPartiya,
        payStatus:   "tolandan"
      });
    }
  });

  // Ta'sirlangan barcha mahsulotlarning inBox ini real holatdan yangilaymiz
  // (yangi rang qo'shilgan bo'lsa, o'lchamlar soni o'zgargan bo'lishi mumkin)
  const touchedSkus = new Set(_importRows.map(r => {
    const pp = db.products.find(x => x.name.toLowerCase() === r.nom.toLowerCase());
    return pp ? pp.sku : null;
  }).filter(Boolean));
  touchedSkus.forEach(sku => {
    const pp = db.products.find(x => x.sku === sku); if (!pp) return;
    const colors = [...new Set(pp.variants.map(v => v.color))];
    let maxSizes = 1;
    colors.forEach(c => {
      const cnt = pp.variants.filter(v => v.color === c).length;
      if (cnt > maxSizes) maxSizes = cnt;
    });
    pp.inBox = maxSizes;
  });

  saveDB(); renderKatalog(); if (typeof renderOmbor === "function") renderOmbor(); closeModal("import");

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
  openModal("narxnoma");
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

  const byPochka = document.getElementById("nm-by-pochka")?.checked || false;
  const labels = [];

  prods.forEach(p => {
    if (byPochka) {
      // Pochka rejimi: har rang uchun bitta yorliq
      const colors = [...new Set(p.variants.map(v => v.color))];
      colors.forEach(color => {
        const colorVars = p.variants.filter(v => v.color === color);
        const totalQty  = colorVars.reduce((a, v) => a + (v.qty||0), 0);
        if (totalQty <= 0) return;
        // Ushbu rang uchun birinchi variantni asos sifatida olamiz
        const v0 = colorVars[0];
        const barcode = (p.colorBarcodes && p.colorBarcodes[color]) || p.barcode;
        labels.push({ p, v: {...v0, color}, pochkaMode: true, barcode });
      });
    } else {
      // Standart: har variant uchun yorliq
      p.variants.forEach(v => {
        if ((v.qty||0) <= 0) return;
        labels.push({ p, v, pochkaMode: false, barcode: p.barcode });
      });
    }
  });

  if (!labels.length) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:#E05A5A">Qoldiq yo'q (0 ta)</div>`;
    return;
  }

  el.innerHTML = `<div class="nm-label-grid" style="grid-template-columns:repeat(${cols},1fr)">
    ${labels.map(({p, v, pochkaMode, barcode}) => buildLabel(p, v, {style,showLogo,showBarc,showSku,showUlg,shopName,rate,pochkaMode,barcode})).join("")}
  </div>`;

  // Har bir yorliqdagi shtrix-kodni chizamiz (skanerlanadigan, raqam emas)
  if (showBarc && typeof JsBarcode !== "undefined") {
    el.querySelectorAll(".nm-barcode-svg").forEach(svg => {
      const code = svg.dataset.code;
      if (!code) return;
      try {
        JsBarcode(svg, code, {
          format: "CODE128", width: 1.3, height: 28,
          displayValue: true, fontSize: 9, margin: 0, textMargin: 2
        });
      } catch (e) { /* noto'g'ri format bo'lsa shtrix chizilmaydi, raqam ko'rinmaydi */ }
    });
  }
}

function buildLabel(p, v, opts) {
  const {style, showLogo, showBarc, showSku, showUlg, shopName, rate} = opts;
  const hex       = v.hex || "#888";
  const colorDot  = `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${hex};border:1px solid rgba(0,0,0,.12);vertical-align:middle;margin-right:4px"></span>`;
  // Chakana narx bo'lmasa (ulgurji do'kon), ulgurji narxni asosiy sifatida ko'rsatamiz
  const hasChakana = p.priceUzs > 0;
  const priceUzs  = hasChakana ? p.priceUzs : (p.ulgurjiNarx || 0);
  const ulgUzs    = p.ulgurjiNarx || 0;
  const priceUsd  = rate > 0 ? (priceUzs / rate).toFixed(2) : "0.00";
  const barcodeId = `bc-${p.sku}-${(v.color||"")}-${(v.size||"")}`.replace(/[^a-zA-Z0-9-]/g,"_");
  // Pochka rejimda rang barcodeini, standart rejimda asosiy barcodeini ishlatamiz
  const useBarcode = opts.barcode || p.barcode || "";
  const barcodeHtml = showBarc && useBarcode
    ? `<div class="nm-barcode"><svg class="nm-barcode-svg" id="${barcodeId}" data-code="${useBarcode}"></svg></div>` : "";

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
        ${showUlg&&ulgUzs&&hasChakana?`<div class="nm-prem-ulg">Ulgurji: ${fmt(ulgUzs)} so'm</div>`:""}
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
        ${showUlg&&ulgUzs&&hasChakana?`<div class="nm-price-ulg">Ulgurji: ${fmt(ulgUzs)}</div>`:""}
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
  const byPochkaP = document.getElementById("nm-by-pochka")?.checked || false;

  prods.forEach(p => {
    if (byPochkaP) {
      // Pochka rejimi: har rang uchun bitta yorliq (o'lchamlar birlashtirilgan)
      const colors = [...new Set(p.variants.map(v => v.color))];
      colors.forEach(color => {
        const colorVars = p.variants.filter(v => v.color === color);
        const totalQty  = colorVars.reduce((a, v) => a + (v.qty||0), 0);
        if (totalQty <= 0) return;
        const v0      = colorVars[0];
        const barcode = (p.colorBarcodes && p.colorBarcodes[color]) || p.barcode;
        labels.push({ p, v: {...v0, color}, pochkaMode: true, barcode });
      });
    } else {
      // Standart: har rang uchun bitta yorliq (dona, lekin ranglar alohida)
      const colors = [...new Set(p.variants.map(v => v.color))];
      colors.forEach(color => {
        const colorVars = p.variants.filter(v => v.color === color);
        const totalQty  = colorVars.reduce((a, v) => a + (v.qty||0), 0);
        if (totalQty <= 0) return;
        const v0      = colorVars[0];
        const sizes   = colorVars.map(v => v.size).filter(Boolean);
        const barcode = (p.colorBarcodes && p.colorBarcodes[color]) || p.barcode;
        labels.push({ p, v: {...v0, color, size: sizes.join("-")}, pochkaMode: false, barcode });
      });
    }
  });

  const labelHtml = labels.map(({p,v,pochkaMode,barcode}) =>
    buildLabel(p, v, {style,showLogo,showBarc,showSku,showUlg,shopName,rate,pochkaMode,barcode})
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
.nm-barcode{text-align:center;margin-top:4px}
.nm-barcode-svg{max-width:100%}
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
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<script>
window.onload = () => {
  if (typeof JsBarcode !== "undefined") {
    document.querySelectorAll(".nm-barcode-svg").forEach(svg => {
      const code = svg.dataset.code;
      if (!code) return;
      try {
        JsBarcode(svg, code, { format:"CODE128", width:1.3, height:28, displayValue:true, fontSize:9, margin:0, textMargin:2 });
      } catch(e) {}
    });
  }
  setTimeout(() => window.print(), 400);
};
<\/script>
</body></html>`);
  w.document.close();
  toast("✅ Chop etish oynasi ochildi");
}

// ── Katalog jadvalidan rasm yuklash ──────────────
function katImgClick(sku, color) {
  // Inputni dinamik yaratamiz (sku+color uchun noyob bo'lishi shart)
  let inp = document.getElementById("kat-img-inp-" + sku + "-" + (color||"_"));
  if (!inp) {
    inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.style.display = "none";
    inp.id = "kat-img-inp-" + sku + "-" + (color||"_");
    inp.onchange = function() { katImgSave(sku, color, this); };
    document.body.appendChild(inp);
  }
  inp.click();
}

function katImgSave(sku, color, input) {
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
      // Rang ko'rsatilgan bo'lsa — shu rangga, aks holda umumiy rasmga saqlaymiz
      if (color) {
        if (!p.colorImages) p.colorImages = {};
        p.colorImages[color] = dataUrl;
      } else {
        p.image = dataUrl;
      }
      saveDB();
      renderKatalog();
      toast("✅ Rasm saqlandi" + (color ? ` ("${color}" rangiga)` : ""));
    };
    img.src = raw;
  };
  reader.readAsDataURL(file);
}

// ── Karta ko'rinish ─────────────────────────────
function _renderKatGrid(rows, rate, showChakana) {
  const el = $("kat-grid-wrap");
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--mut)">Mahsulot topilmadi</div>`;
    return;
  }
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;padding:18px">` +
    rows.map(({product:p, color}) => {
      const colorVariants = p.variants.filter(v => v.color === color);
      const st = colorVariants.reduce((a,v) => a + v.qty, 0);
      const badge = st <= 0
        ? `<span class="bg bg-r" style="font-size:10px">Tugagan</span>`
        : st <= 5
          ? `<span class="bg bg-a" style="font-size:10px">${st} dona</span>`
          : `<span class="bg bg-g" style="font-size:10px">${st} dona</span>`;
      const imgHtml = p.image
        ? `<img src="${p.image}" style="width:100%;height:130px;object-fit:cover;border-radius:8px 8px 0 0">`
        : `<div style="width:100%;height:130px;background:var(--bg2);border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;color:#ddd"><i class="ti ti-photo" style="font-size:32px"></i></div>`;
      return `<div onclick="openEditProduct('${p.sku}')" style="border:1.5px solid var(--brd);border-radius:10px;cursor:pointer;transition:.13s;overflow:hidden" onmouseover="this.style.borderColor='var(--acc)'" onmouseout="this.style.borderColor='var(--brd)'">
        ${imgHtml}
        <div style="padding:10px 12px">
          <div style="font-size:11px;color:var(--mut);font-family:monospace">${p.art || p.sku}</div>
          <div style="font-weight:700;font-size:13px;margin:3px 0;line-height:1.3">${p.name}</div>
          <div style="font-size:11.5px;color:var(--mut)">${color} · ${p.category}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <span style="font-weight:700;color:var(--acc);font-size:13px">${p.ulgurjiNarx ? fmt(p.ulgurjiNarx)+' so\'m' : '—'}</span>
            ${badge}
          </div>
        </div>
      </div>`;
    }).join("") + `</div>`;
}


// ── Rang barcodeini yangilash ─────────────────────
function updateColorBarcode(sku, color, newBarcode) {
  const p = db.products.find(x => x.sku === sku); if (!p) return;
  if (!p.colorBarcodes) p.colorBarcodes = {};
  newBarcode = newBarcode.trim();
  if (newBarcode) {
    p.colorBarcodes[color] = newBarcode;
  } else {
    delete p.colorBarcodes[color];
  }
  // Birinchi rang barcodeini asosiy barcode sifatida saqlaymiz
  const first = Object.values(p.colorBarcodes)[0];
  if (first) p.barcode = first;
  saveDB();
  toast("✅ Barcode yangilandi");
}


// ── Mavjud mahsulotlar uchun colorBarcodes migratsiyasi ──────
// Eski mahsulotlarda colorBarcodes yo'q — ranglar bo'yicha barcode yaratib to'ldiramiz
function migrateColorBarcodes() {
  let fixed = 0;
  db.products.forEach(p => {
    if (p.colorBarcodes && Object.keys(p.colorBarcodes).length > 0) return; // allaqachon bor
    const colors = [...new Set((p.variants||[]).map(v => v.color).filter(Boolean))];
    if (!colors.length) return;
    p.colorBarcodes = {};
    colors.forEach((clr, i) => {
      // Birinchi rang uchun p.barcode ni ishlat, qolganlariga yangi barcode
      const bc = i === 0 && p.barcode ? p.barcode : genEAN13(db.seq++);
      p.colorBarcodes[clr] = bc;
    });
    fixed++;
  });
  if (fixed > 0) {
    saveDB();
    toast("✅ " + fixed + " ta mahsulotga rang barcodelari qo'shildi");
    renderKatalog();
  } else {
    toast("Barcha mahsulotlarda barcode mavjud");
  }
}
