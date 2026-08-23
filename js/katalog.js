// MERX katalog.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/katalog.js  (v3 — Pantone + Yangi dizayn)
// ================================================

let editSku = null;
let katLowFilter = false;
let katCatFilter = "all"; // "all" | "oyoq" | "kiyim" | category name
let katSortBy      = "date";  // v171 (№5): standart — kiritilgan sana, YANGI TEPADA
let katSortAsc     = false;   // nom/narx saralash tugmalar orqali avvalgidek ishlaydi
let _katSelected   = new Set(); // tanlangan SKU lar
let _katAllRowKeys = [];           // filtrlangan BARCHA qator kalitlari
let katStatusFilter = "all"; // "all" | "faol" | "nol" | "kam"
let katViewMode    = viewModeGet("kat"); // "table" | "grid" — qurilmada saqlanadi (utils.js)
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
  viewModeSet("kat", v);
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
  const rows = document.querySelectorAll("#katalog-body tr");
  rows.forEach(row => {
    const cb = row.querySelector("input[type=checkbox]");
    if (cb) row.style.background = cb.checked ? "#fffbf0" : "";
  });
  _katSyncAllCb();
}

// 2026-07-24 (№5): ikkita "hammasini belgilash" katakchasi bor edi
// (asboblar panelida va jadval sarlavhasida) — ular bir-biridan
// XABARSIZ ishlardi. Endi ikkalasi ham bir holatda turadi.
function _katSyncAllCb() {
  const total = _katAllRowKeys.length;
  const sel   = _katSelected.size;
  document.querySelectorAll(".kat-sel-all").forEach(cb => {
    cb.checked       = total > 0 && sel >= total;
    cb.indeterminate = sel > 0 && sel < total;   // qisman tanlangan
  });
}

function katSelectAll() {
  // 2026-07-24 (№5): kalit endi data-rowkey dan olinadi.
  // Avval onchange MATNIDAN regex bilan ajratilardi — rang nomida
  // apostrof bo'lsa (masalan "Ko'k") noto'g'ri qiymat olinardi.
  // Barcha sahifalardagi qatorlar (faqat ko'rinayotganlar emas)
  if (_katAllRowKeys.length) _katAllRowKeys.forEach(k => _katSelected.add(k));
  // Ekrandagi checkboxlarni belgilab chiqamiz
  document.querySelectorAll("#katalog-body input[type=checkbox][data-rowkey]").forEach(cb => {
    cb.checked = true;
    _katSelected.add(cb.dataset.rowkey);
    const tr = cb.closest("tr"); if (tr) tr.style.background = "#fffbf0";
  });
  _katSyncAllCb();
  updateKatSelBar();
}

function katClearSel() {
  _katSelected.clear();
  document.querySelectorAll("#katalog-body input[type=checkbox]").forEach(cb => {
    cb.checked = false;
    const tr = cb.closest("tr"); if (tr) tr.style.background = "";
  });
  _katSyncAllCb();
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

// 2026-07-24 (№5): HAQIQIY preview — avval qat'iy 400 000 so'mlik xayoliy
// tovar ko'rsatilardi (aldamchi edi). Endi TANLANGAN tovarlar bo'yicha hisob.
function _bulkCalc() {
  const pct   = parseFloat(document.getElementById("bulk-pct")?.value) || 0;
  const type  = document.getElementById("bulk-type")?.value  || "chegirma";
  const field = document.getElementById("bulk-field")?.value || "chakana";
  const mult  = type === "chegirma" ? (1 - pct/100) : (1 + pct/100);

  const skus = new Set([..._katSelected].map(k => String(k).split("::")[0]));
  let oldSum = 0, newSum = 0, cnt = 0;

  skus.forEach(sku => {
    const p = (db.products||[]).find(x => x.sku === sku);
    if (!p) return;
    cnt++;
    const take = [];
    if (field === "chakana" || field === "ikkalasi") take.push(p.priceUzs || 0);
    if (field === "ulgurji" || field === "ikkalasi") take.push(p.ulgurjiNarx || 0);
    take.forEach(v => {
      oldSum += v;
      newSum += Math.round(v * mult / 1000) * 1000;
    });
  });

  return { pct, type, field, cnt, oldSum, newSum, diff: newSum - oldSum };
}

function updateBulkPreview() {
  const c = _bulkCalc();
  const valEl = document.getElementById("bulk-preview-val");
  const pctEl = document.getElementById("bulk-preview-pct");
  const isDisc = c.type === "chegirma";

  if (valEl) {
    valEl.textContent = fmt(c.oldSum) + " → " + fmt(c.newSum) + " so'm";
    valEl.style.color = isDisc ? "var(--grn)" : "#E9A500";
    valEl.style.fontSize = "15px";
  }
  if (pctEl) {
    pctEl.innerHTML = (c.diff > 0 ? "+" : "") + fmt(c.diff) + " so'm" +
      `<div style="font-size:11.5px;color:var(--mut);margin-top:3px;font-weight:400">
        ${c.cnt} ta tovar · barcha ranglari uchun
      </div>`;
  }
}

async function applyBulkPrice() {   // ✅ 2026-08-19: server orqali (async)
  if (typeof requireUse === "function" && !requireUse("katalog")) return;

  const pct   = parseFloat(document.getElementById("bulk-pct")?.value) || 0;
  const type  = document.getElementById("bulk-type")?.value  || "chegirma";
  const field = document.getElementById("bulk-field")?.value || "chakana";

  if (pct <= 0 || pct > 100) { toast("0 dan 100 gacha foiz kiriting","err"); return; }

  // 2026-07-24 (№5): pul o'zgarishidan oldin ANIQ tasdiq
  const _c = _bulkCalc();

  // Tanlangan tovarlarda bu narx turi umuman belgilanmagan bo'lsa —
  // amal jim o'tib ketardi ("chegirma ta'sir qilmadi" muammosi)
  if (_c.oldSum <= 0) {
    const _fn = { chakana:"chakana", ulgurji:"ulgurji", ikkalasi:"chakana/ulgurji" }[field];
    toast(`Tanlangan ${_c.cnt} ta tovarda ${_fn} narx belgilanmagan — o'zgarish yo'q`, "err");
    return;
  }
  const _fieldName = { chakana:"chakana", ulgurji:"ulgurji", ikkalasi:"chakana va ulgurji" }[field];
  const _act = type === "chegirma" ? `−${pct}% chegirma` : `+${pct}% oshirish`;
  if (!confirm(
      "NARX O'ZGARTIRISH\n\n" +
      `${_c.cnt} ta tovar · ${_fieldName} narxi\n` +
      `Amal: ${_act}\n\n` +
      `${fmt(_c.oldSum)} → ${fmt(_c.newSum)} so'm\n` +
      `Farq: ${_c.diff > 0 ? "+" : ""}${fmt(_c.diff)} so'm\n\n` +
      "Eslatma: tovarning BARCHA ranglari uchun narx o'zgaradi.\n\nDavom etasizmi?"
  )) return;

  const rate     = db.settings?.rate || 12800;
  const isUsd    = db.settings?.priceCurrency === "usd";
  let   changed  = 0;
  const _bulkYangilar = [];   // ✅ 2026-08-19: serverga to'plamli

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
    try { p.updatedAt = new Date().toISOString(); _bulkYangilar.push(p); } catch (e) {}
  });

  // ═══════════════════════════════════════════════════════════
  // ✅ 2026-08-19: OMMAVIY NARX SERVERGA (to'plamli)
  // ═══════════════════════════════════════════════════════════
  // Avval bu amal yuzlab tovarni LOKAL o'zgartirib, push bilan
  // jo'natardi va MUHR SOLISHTIRMASDI — ikki kassa bir vaqtda
  // ishlatsa biri ikkinchisini ogohlantirishsiz bosib ketardi.
  // Endi server yozadi: do'kon serverda qo'yiladi, QOLDIQ esa
  // har doim SERVERDAN olinadi (narx amali qoldiqqa tegmaydi).
  // Aloqa yo'q bo'lsa eski yo'l: lokal + push (ish to'xtamaydi).
  if (typeof serverSaveBulkProducts === "function" && _bulkYangilar.length) {
    const _r = await serverSaveBulkProducts(_bulkYangilar);
    if (_r && _r.ok) {
      console.log("📤 Ommaviy narx: " + _r.soni + " tovar serverga yozildi");
      // Server qaytargan qoldiqni lokalga qaytaramiz (sonlar server haqiqati)
      try {
        (_r.rows || []).forEach(row => {
          const lp = db.products.find(x => String(x.sku) === String(row.sku));
          if (lp && Array.isArray(row.variants)) lp.variants = row.variants;
        });
      } catch (e) {}
    } else {
      console.warn("📤 Ommaviy narx serverga yozilmadi — lokal saqlandi");
    }
  }

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
  { key:"margin",   lbl:"Ustama %",        def:false },
  { key:"sku",      lbl:"SKU kodi",         def:false },
];

const KAT_DEFAULT_COLS = Object.fromEntries(KAT_ALL_COLS.map(c => [c.key, c.def]));

function katGetCols() {
  const cols = Object.assign({}, KAT_DEFAULT_COLS, db.settings.katCols || {});
  // ⚠️ 2026-08-02: RUXSAT QATLAMI — `db.settings` GA TEGILMAYDI.
  // Sozlama egasiniki va bulutga sinxronlanadi. Ruxsat esa xodim
  // yozuvida. Ustun ko'rinadi = sozlamada yoqilgan VA ruxsatda
  // yashirilmagan. Egasi kirsa cheklov umuman ishlamaydi.
  try {
    if (typeof permSee === "function") {
      ["cost","ulgurji","chakana","margin","supplier","sku"].forEach(k => {
        if (!permSee("katalog", k)) cols[k] = false;
      });
    }
  } catch(e) {}
  return cols;
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
  // ✅ 2026-08-19 (4-bosqich · 6-qism): KATALOG SERVERDAN TO'LDIRILADI.
  // Manba `ombor.js` dagi `_omEnsureFull` — u tovarlar VA ombor
  // yozuvlarini birga to'ldiradi (ikki joyda ikki xil so'rov
  // bo'lmasin). Qoldiq SERVERDAN olinadi, rasm lokalda saqlanadi.
  // ⚠️ POS ATAYLAB TEGILMAYDI: tovar qidiruvi va savat lokal keshdan
  // ishlaydi — tez va oflaynda ham ochiladi (kelishilgan qoida).
  try { if (typeof _omEnsureFull === "function") _omEnsureFull(); } catch (e) {}
  // 2026-07-24 (№9): kod berilmagan ranglarga bir martalik to'ldirish
  try { if (typeof ensureAllColorBarcodes === "function") ensureAllColorBarcodes(); } catch(e) {}
  // 2026-07-25: tannarx so'mga bir martalik o'tkaziladi (migratsiya)
  try { if (typeof migrateCostToUzs === "function") migrateCostToUzs(); } catch(e) {}
  try { if (typeof migrateVariantInBox === "function") migrateVariantInBox(); } catch(e) {}

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
  // 2026-08-02: KO'P PARAMETRLI qidiruv (utils.js → srchMatcher).
  // "c1 krossovka" — har bir so'z biror maydonda topilishi shart.
  // Rang barcode'lari ham qidiriladi (etiketkada shu kod chop etiladi).
  const _km = typeof srchMatcher === "function" ? srchMatcher(q) : null;
  let ps = visProds().filter(p =>
    !q || (_km
      ? _km(p.name, p.sku, p.art, p.barcode, p.category,
            p.colorBarcodes, (p.variants||[]).map(v => v.color).join(" "))
      : p.name.toLowerCase().includes(q))
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
      const groups = regroupPackages(p.variants, color, p.inBox);
      groups.forEach(g => {
        rows.push({ product: p, color, packGroup: g.packGroup, isBroken: g.isBroken, groupQty: g.qty, groupVariants: g.variants });
      });
    });
  });

  // "Ochilgan pochka" filtri — faqat shu maxsus tab tanlanganda
  if (katStatusFilter === "broken") rows = rows.filter(r => r.isBroken);

  // 2026-07-24 (№5): BARCHA (filtrlangan) qator kalitlari — "hammasini
  // belgilash" endi faqat joriy sahifani emas, hammasini qamraydi
  _katAllRowKeys = rows.map(r => r.product.sku + "::" + r.color + "::" + r.packGroup);

  // Statistika (mahsulot darajasida — nechta turdagi tovar bor)
  const totalAll   = ps.length;
  const totalFaol  = ps.filter(p => totalStock(p) > 0).length;
  const totalBroken = (() => {
    let cnt = 0;
    ps.forEach(p => {
      [...new Set(p.variants.map(v=>v.color))].forEach(c => {
        cnt += regroupPackages(p.variants, c, p.inBox).filter(g => g.isBroken).length;
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

  // 2026-08-02: EKSPORT uchun yakuniy ro'yxatni saqlaymiz.
  // `ps` — filtr, qidiruv va saralashdan O'TGAN to'liq ro'yxat
  // (sahifalashdan OLDIN). Excel shu ro'yxatdan oladi.
  try { setExportList("katalog", ps); } catch(e) {}

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

    // v149: inBox — mahsulotning O'Z qiymatidan (B2 modeli); eski
    // o'lchamlab kiritilganlarda avvalgidek variantlar sonidan
    // 2026-07-26: VARIANTDAGI quti sig'imi USTUVOR — bitta tovarning
    // turli ranglari har xil pochkada kelishi mumkin (qora 5, oq 6,
    // ko'k 7). Avval tovar darajasidagi yagona qiymat ishlatilib,
    // pochka soni noto'g'ri chiqardi (150 dona / 7 = 21, aslida 30).
    const _cvIb = parseInt(colorVariants[0] && colorVariants[0].inBox) || 0;
    const inBox   = _cvIb > 0 ? _cvIb
                    : (colorVariants.length === 1 ? (p.inBox || 1)
                       : (colorVariants.length || 1));
    const costUzs = getCostUzs(p);

    // Jami dona (shu guruh uchun)
    const colorQty = colorVariants.reduce((a,v) => a + v.qty, 0);
    // Pochka soni = jami dona ÷ 1 pochkadagi dona (B2); eski modelda
    // groupQty (har o'lchamdan bir xil son) o'z-o'zidan shuni beradi
    const pochkaSoni = colorVariants.length === 1
      ? Math.floor(colorQty / (inBox || 1))
      : groupQty;
    const pantone  = colorVariants[0]?.pantone || "";

    // Margin (ulgurji asosida)
    // 2026-07-25: ustama (tannarxdan) asosiy, marja kichik yozuvda
    const _mk = calcMarkup(costUzs, p.ulgurjiNarx);
    const margin = _mk ? _mk.markup : null;   // ustunda USTAMA ko'rsatiladi
    const mColor = markupColor(margin);

    const rowKey = p.sku + "::" + color + "::" + packGroup;
    const isSel = _katSelected.has(rowKey);
    // ⚠️ 2026-08-03: QATORGA BOSISH OLIB TASHLANDI.
    // Avval qatorning ISTALGAN joyiga bosilsa tahrir oynasi ochilardi —
    // galochka, rasm, barcode ustiga bosganda ham. Tasodifan ochilib,
    // ma'lumot o'zgartirib yuborish xavfi bor edi.
    // Endi faqat ✏️ tugmasi orqali. Katak ko'rinishida (3767) qoldi —
    // u yerda bosish tabiiy va boshqa element yo'q.
    return `<tr style="background:${isSel?"#fffbf0":(isBroken?"#FFFBF0":"")}">
      <td style="width:28px;padding:8px 4px" onclick="event.stopPropagation()">
        <input type="checkbox" ${isSel?"checked":""} data-rowkey="${String(rowKey).replace(/"/g,'&quot;')}"
          onchange="katToggleSel('${jsEsc(rowKey)}',this.checked)"
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
                  onclick="katImgView('${p.sku}','${jsEsc(color)}')" title="Rasmni ko'rish">`
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
          : false
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
        ${margin != null ? `<span style="color:${mColor};font-weight:700">+${margin}%</span>` +
          `<div style="font-size:10px;color:var(--mut);font-weight:400">${_mk.margin}% marja</div>` : '<span style="color:#ddd">—</span>'}
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
async function epDuplicate() {   // ✅ 2026-08-18: SKU serverdan (async)
  if (typeof editSku === "undefined" || !editSku) return;
  if (!confirm("Shu mahsulotdan nusxa olinsinmi? (qoldiqlar 0 bilan)")) return;
  await duplicateProduct(editSku);
  if (typeof closeModal === "function") closeModal("editprod");
}

// ═══════════════════════════════════════════════════════════════════
// 🔴 550 (2026-08-23): SHTRIX-KOD ENDI SANOQDAN EMAS
// ═══════════════════════════════════════════════════════════════════
// FALOKAT ILDIZI (B20, 16-23 avg: 51 egizak juftlik, 49 chek): kod
// `genEAN13(db.seq)` dan yasalardi. `db.seq` — bulutga sinxronlanmaydigan
// QURILMA sanog'i; kirishda esa faqat sotuv/mijoz raqamlaridan tiklanadi
// (cloud.js) va katalog qayerga yetganini bilmaydi. Bo'sh/yangi qurilma
// sanoqni orqadan boshlab, ESKI tovarlarning kodini QAYTADAN yasab
// berdi — skaner ikki tovarni ajrata olmay, cheklarga boshqa tovar
// yozildi. ENDI ikki qavat himoya:
//   1) urug' — nextId() (vaqt muhri × 1000 + qurilma kodi): ikki
//      qurilma hech qachon bir xil son yasay olmaydi;
//   2) tayyor kod BUTUN katalogdan (umumiy kod + barcha rang kodlari)
//      tekshiriladi — band bo'lsa yangisi olinadi.
// `db.seq` ga tegilmaydi — u faqat SKU/hujjat sanog'i bo'lib qoladi.
function yangiBarcode() {
  const band = new Set();
  try {
    (db.products || []).forEach(pp => {
      if (pp.barcode) band.add(String(pp.barcode));
      if (pp.colorBarcodes)
        Object.values(pp.colorBarcodes).forEach(b => { if (b) band.add(String(b)); });
    });
  } catch (e) {}
  let guard = 0;
  while (guard++ < 50) {
    const urug = (typeof nextId === "function")
      ? nextId()
      : Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const bc = genEAN13(urug);
    if (!band.has(bc)) return bc;
  }
  return genEAN13(Date.now() * 1000000 + Math.floor(Math.random() * 1000000));
}

async function duplicateProduct(sku, event) {   // ✅ 2026-08-19: qulf
  return _katGuard(() => _duplicateProductIchki(sku, event));
}
async function _duplicateProductIchki(sku, event) {   // ✅ 2026-08-18: SKU serverdan
  if (event) event.stopPropagation();
  const p = db.products.find(x => x.sku === sku);
  if (!p) return;

  // ✅ 2026-08-18 (lokal teshik): raqam SERVERDAN olinadi.
  // Avval `<sku>-copy-<vaqtning oxirgi 4 raqami>` edi — bu 10 soniyada
  // bir TAKRORLANADI: ikki kassa bir tovardan shu oraliqda nusxa olsa
  // SKU ustma-ust tushib, push birini ikkinchisi bilan bosardi
  // (tovar jimgina yo'qolardi). Aloqa bo'lmasa eski usul zaxira.
  let newSku, newId;
  try {
    const _r = await _apNextSkuAsync(p.type, 1);
    newSku = _r.sku; newId = _r.id;
  } catch (e) {
    newSku = p.sku + "-copy-" + Date.now().toString().slice(-4);
    newId  = (typeof nextId === "function") ? nextId() : db.seq;   // 545
  }
  if (!newSku) { newSku = p.sku + "-copy-" + Date.now().toString().slice(-4);
    newId = (typeof nextId === "function") ? nextId() : db.seq; }   // 545

  const copy = JSON.parse(JSON.stringify(p)); // deep copy
  copy.sku  = newSku;
  copy.id   = newId;
  copy.name = p.name + " (nusxa)";
  copy.barcode = (typeof yangiBarcode === "function") ? yangiBarcode() : "";   // 550
  // 2026-07-25: rang barcode'lari NUSXALANMAYDI — aks holda ikki xil
  // tovarda bir xil kod bo'lib, skanerlanganda qaysi biri ekani noaniq edi
  copy.colorBarcodes = {};
  // Variantlar qoldig'ini 0 qilamiz
  copy.variants = copy.variants.map(v => ({ ...v, qty: 0 }));

  // ✅ 2026-08-19: nusxa ham SERVER orqali (506 naqshi).
  // Nomga "(nusxa)" qo'shilgani uchun takror chiqmaydi — lekin
  // yozuvning O'ZI serverdan o'tadi: do'kon serverda qo'yiladi va
  // boshqa qurilma bir vaqtda nusxa olsa ikkinchisi ogohlantiriladi.
  copy.updatedAt = new Date().toISOString();
  if (typeof serverSaveRecord === "function") {
    let _r = await serverSaveRecord("products", copy, null);
    if (_r && _r.ok === false && _r.code === "dup")
      _r = await serverSaveRecord("products", copy, null, true);
    // 🔴 545 (3.33): server id va vaqt muhri qabul qilinadi (409 davosi)
    if (_r && _r.ok && _r.row) {
      if (_r.row.id != null) copy.id = _r.row.id;
      const _sm = _r.row.data && _r.row.data.updatedAt;
      if (_sm) copy.updatedAt = _sm;
    }
  }
  db.products.push(copy);
  try {
    auditLog("yaratish", "product", copy.sku, copy.name,
      { after: "nusxa", note: "manba: " + (p.sku || "") });
  } catch (e) {}
  try { ensureColorBarcodes(copy); } catch(e) {}
  db.seq = (db.seq || 1) + 1;
  saveDB();
  renderKatalog();
  toast(`✅ "${p.name}" nusxalandi — tahrirlashingiz mumkin`);

  // Nusxani darhol ochib beramiz
  setTimeout(() => openEditProduct(newSku), 300);
}

let _epBaseAt = "";   // ✅ 2026-08-18: tahrir boshlangandagi vaqt muhri
function openEditProduct(sku) {
  // ✅ 2026-08-18 RUXSAT TESHIGI: OYNA ham qo'riqlanadi. Ichidagi
  // variant-saqlash, rang o'chirish, rasm o'chirish yo'llari himoyasiz
  // edi — xodim "ruxsat yo'q" xabarini ko'rib turib, variant jadvali
  // orqali tovarni baribir tahrirlay olardi (egasi topgan, 18-avg).
  if (typeof requireDo === "function" && !requireDo("katalog","edit")) return;
  const p = db.products.find(x => x.sku === sku); if (!p) return;
  // ✅ 2026-08-18: QAYSI NUSXA TAHRIRLANAYOTGANI ESLAB QOLINADI.
  // Saqlashda shu muhr bulutdagi bilan solishtiriladi — oradan boshqa
  // kassa tahrir qilgan bo'lsa, uning ishi jimgina o'chib ketmasin.
  _epBaseAt = String(p.updatedAt || "");
  editSku = sku;
  // 2026-07-25: variativ guruh bo'lsa — "Variativ tahrirlash" tugmasi chiqadi
  try { epVarInit(p); } catch(e) {}
  // 2026-07-26: kategoriya takliflari (erkin teg)
  try { fillCatSuggest(p.type); } catch(e) {}
  $("ep-title").textContent     = p.name + " — tahrirlash";
  $("ep-name").value            = p.name;
  $("ep-cat").value             = p.category;
  // Tannarx: bazada har doim USD da saqlanadi (costUsd). Valyuta rejimiga qarab ko'rsatamiz.
  // 2026-07-25: tannarx HAR DOIM SO'MDA ko'rsatiladi va kiritiladi
  $("ep-cost").value = (typeof getCostUzs === "function")
    ? getCostUzs(p)
    : Math.round((p.costUsd || 0) * (db.settings?.rate || 12800));
  $("ep-price").value           = p.priceUzs;
  {
    // 2026-07-26: ulgurji narx HAR DOIM SO'MDA ko'rsatiladi va
    // kiritiladi. Avval "USD/ikki valyuta" rejimida dollarga
    // aylantirilib ko'rsatilardi va saqlashda qayta ko'paytirilib
    // narx buzilardi.
    const _ulgEl = $("ep-ulgurji");
    if (_ulgEl) {
      _ulgEl.value = fmt(p.ulgurjiNarx || 0);
      _ulgEl.dataset.raw = String(p.ulgurjiNarx || 0);
    }
  }
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
  // №11a (v175): ep-unit teglardan; tovar birligi ro'yxatda bo'lmasa ham ko'rsatiladi
  if ($("ep-unit")) {
    const _ut = getUnitTags(); const _cu = p.unit || "dona";
    if (!_ut.includes(_cu)) _ut.unshift(_cu);
    $("ep-unit").innerHTML = _ut.map(u => `<option${u===_cu?" selected":""}>${u}</option>`).join("");
  }
  epUpdateInboxDisplay(p, true); // v171 (№6): faqat ochilishda to'ldiriladi
  if ($("ep-packunit")) {
    const _epTags = getPackUnitTags(); if (p.packUnit && !_epTags.includes(p.packUnit)) _epTags.unshift(p.packUnit); // eski qiymat yo'qolmasin
    $("ep-packunit").innerHTML = _epTags.map(u =>
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
function epUpdateInboxDisplay(p, initial) {
  const colors = [...new Set(p.variants.map(v => v.color))];
  let maxSizes = 1;
  colors.forEach(c => {
    const cnt = p.variants.filter(v => v.color === c).length;
    if (cnt > maxSizes) maxSizes = cnt;
  });
  // v145: qo'lda kiritilgan inBox saqlanadi; faqat bo'sh bo'lsa taklif
  if (!p.inBox) p.inBox = maxSizes;
  // v171 (№6): maydon FAQAT oyna ochilganda (initial) yoki bo'sh bo'lsa
  // to'ldiriladi. Avval har variant o'zgarishida foydalanuvchi yangi
  // kiritgan qiymat eski p.inBox bilan QAYTA YOZILIB, maydon "qotib"
  // qolardi (saqlashgacha p.inBox o'zgarmaydi — shuning uchun).
  const inp = $("ep-inbox");
  if (inp && (initial || !inp.value)) inp.value = p.inBox;
  epUpdateBoxHints();
}

// Rang bo'yicha rasm yuklash (har rang o'z rasmiga ega bo'ladi)
function epLoadColorImage(input, color) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 15 * 1024 * 1024) { toast("Fayl juda katta (15MB+) — bu rasm emasga o'xshaydi","err"); return; }  // 2026-07-24: 5MB darvozasi OLIB TASHLANDI — u SIQISHDAN oldin turib
  // telefon suratlarini (3-8MB) bekorga rad etardi. Siqish baribir
  // rasmni ~50-150KB ga tushiradi.

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
      while (dataUrl.length > 150000 && q > 0.25);

      const p = db.products.find(x => x.sku === editSku); if (!p) return;
      if (!p.colorImages) p.colorImages = {};
      p.colorImages[color] = dataUrl;      // darhol ko'rinsin
      epRenderColorCards(p);
      saveDB();
      toast(`✅ "${color}" rangiga rasm yuklandi`);
      // 2026-07-31: rasm omborga (Storage) yuklanadi, ma'lumotda
      // faqat havola qoladi. Yuklanmasa base64 joyida qolaveradi.
      if (typeof uploadImageToStorage === "function") {
        uploadImageToStorage(dataUrl, `${p.sku}_${color}`).then(url => {
          if (url && url !== dataUrl) {
            p.colorImages[color] = url;
            saveDB();
            try { epRenderColorCards(p); } catch(e) {}
          }
        }).catch(() => {});
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function epRemoveColorImage(color) {
  // ✅ 2026-08-18 RUXSAT: darhol saqlaydigan yozish yo'li — qulf.
  if (typeof requireDo === "function" && !requireDo("katalog","edit")) return;
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
    const groups   = typeof regroupPackages === "function" ? regroupPackages(p.variants, color, p.inBox) : [];

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

      ${(() => {
        // v172 (B2): O'LCHAMSIZ (bitta variantli) tovarda variant.qty = JAMI DONA.
        // "Pochka" endi dona emas, POCHKA sonini ko'rsatadi va shu birlikda
        // tahrirlanadi (dona = pochka × inBox avtomatik). Klassik ko'p
        // o'lchamli tovarlar quyidagi eski groups-oqimida O'ZGARISHSIZ.
        if (variants.length === 1) {
          const v = variants[0];
          const inBoxEff = parseInt(($("ep-inbox")||{value:0}).value) || p.inBox || 1;
          const pochka = Math.floor((v.qty||0) / inBoxEff);
          const qoldiq = (v.qty||0) - pochka * inBoxEff;
          return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 0">
            <div style="font-size:12px;color:var(--mut);min-width:90px">
              O'lcham: <strong style="color:#0D1B2A">${v.size || "O'lchamsiz"}</strong>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:12px;color:var(--mut)">Pochka:</span>
              <input type="number" value="${pochka}" min="0" data-epb2="${color}"
                onchange="epUpdateB2Pochka('${jsEsc(color)}',this.value)"
                style="width:60px;border:1px solid var(--brd);border-radius:6px;padding:4px 8px;font-size:13px;font-weight:700;text-align:center">
              <span style="font-size:11px;color:#bbb">${p.packUnit||"pochka"}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:12px;color:var(--mut)">Jami dona:</span>
              <input type="number" value="${v.qty||0}" min="0" data-epb2dona="${color}"
                onchange="epUpdateB2Dona('${jsEsc(color)}',this.value)"
                style="width:70px;border:1px solid var(--acc);border-radius:6px;padding:4px 8px;font-size:13px;font-weight:700">
            </div>
            ${qoldiq > 0 ? `<span style="font-size:11px;color:#B45309;font-weight:700">
              ${pochka} pch + ${qoldiq} dona ochilgan</span>` : ""}
          </div>`;
        }
        return groups.map((g, gi) => {
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
      }).join("");
      })()}

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
// v172 (B2): pochka sonini kiritish — dona avtomatik (pochka × inBox)
function epUpdateB2Pochka(color, val) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const v = p.variants.find(x => x.color === color); if (!v) return;
  // Variantdagi quti sig'imi ustuvor (rang darajasida)
  const inBoxEff = parseInt(v.inBox) ||
    parseInt(($("ep-inbox")||{value:0}).value) || p.inBox || 1;
  const pochka = Math.max(0, parseInt(val) || 0);
  // ⚠️ 2026-07-26: OCHILGAN QOLDIQ SAQLANADI. Avval "ataylab nolga
  // tushardi" — 14 pochka + 3 dona bo'lgan tovarni 15 pochka qilsa
  // 3 dona YO'QOLARDI. Endi qoldiq o'z holicha qo'shiladi.
  const oldRest = (v.qty || 0) % inBoxEff;
  const _eskiQ = Number(v.qty) || 0;
  v.qty = pochka * inBoxEff + oldRest;
  // ✅ 2026-08-18: qo'lda qoldiq tahriri ham SERVERGA (farq bilan).
  // Avval bu yo'llar serverni chetlab o'tardi — natijada ikki kassa
  // to'qnashuvida raqam bosilardi, 477-himoyasi esa tahrirni server
  // nusxasi bilan qaytarib yuborardi (tahrir jimgina yo'qolardi).
  if (typeof _serverStockQueue === "function")
    _serverStockQueue(p, color, v.size || "", (Number(v.qty) || 0) - _eskiQ);
  epRenderColorCards(p);
  epUpdateBoxHints();
}

// v172 (B2): "1 pochkada nechta" o'zgarsa — B2 kartalardagi pochka soni
// qayta hisoblanadi (dona o'zgarmaydi, faqat ko'rinish yangilanadi)
function epInboxChanged() {
  epUpdateBoxHints();
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const colors = [...new Set(p.variants.map(v => v.color))];
  const hasB2 = colors.some(c => p.variants.filter(v => v.color === c).length === 1);
  if (hasB2) epRenderColorCards(p);
}

function epUpdateGroupQty(color, groupIdx, val) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const newQty = parseInt(val) || 0;
  const groups = regroupPackages(p.variants, color, p.inBox);
  const g = groups[groupIdx]; if (!g) return;
  // Shu guruhdagi har bir o'lchamning farqini hisoblab, asl variantga qo'shamiz
  g.variants.forEach(gv => {
    const v = p.variants.find(x => x.color === color && x.size === gv.size);
    if (!v) return;
    const _eskiQ = Number(v.qty) || 0;
    v.qty = v.qty - g.qty + newQty;
    if (typeof _serverStockQueue === "function")   // ✅ 2026-08-18: farq serverga
      _serverStockQueue(p, color, v.size || "", (Number(v.qty) || 0) - _eskiQ);
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
  p.variants.forEach(v => {
    if (v.color !== color) return;
    const _eskiQ = Number(v.qty) || 0;
    v.qty = newQty;
    if (typeof _serverStockQueue === "function")   // ✅ 2026-08-18: farq serverga
      _serverStockQueue(p, color, v.size || "", newQty - _eskiQ);
  });
  epRenderColorCards(p);
  epUpdateInboxDisplay(p);
}

function epUpdateQty(color, size, val) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const v = p.variants.find(x => x.color === color && x.size === size);
  if (!v) return;
  const _eskiQ = Number(v.qty) || 0;
  v.qty = parseInt(val) || 0;
  if (typeof _serverStockQueue === "function")     // ✅ 2026-08-18: farq serverga
    _serverStockQueue(p, color, size || "", (Number(v.qty) || 0) - _eskiQ);
}

function epUpdateColorField(oldColor, input) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const newColor = input.value.trim();
  if (!newColor || newColor === oldColor) return;
  p.variants.forEach(v => { if (v.color === oldColor) v.color = newColor; });
}

function epDeleteColor(color) {
  // ✅ 2026-08-18 RUXSAT: buzuvchi amal — alohida qulf.
  if (typeof requireDo === "function" && !requireDo("katalog","edit")) return;
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

  // 2026-07-31: sig'im o'lchamdan mustaqil (yuqoridagi izoh).
  // Bo'sh bo'lsagina oraliqdan taklif qilamiz, aks holda tegmaymiz.
  const _epaManual = parseInt(($("epa-inbox")||{value:""}).value) || 0;
  if ($("epa-inbox") && !_epaManual && from && to) $("epa-inbox").value = sizeCount;
  const _epaInbox = parseInt(($("epa-inbox")||{value:""}).value) || 1;
  if ($("epa-qty")) $("epa-qty").value = boxes * _epaInbox;
  const lbl = $("epa-size-lbl");
  if (lbl) lbl.textContent = from && to ? (from===to?from:`${from}–${to}`) : "";
}

async function epConfirmAddColor() { return _katGuard(_epConfirmAddColorIchki); }   // ✅ 2026-08-19: qulf
async function _epConfirmAddColorIchki() {   // ✅ 2026-08-18: SKU serverdan (async)
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
  // 2026-07-25 (№10 regressiyasi): o'lcham endi IXTIYORIY — standart
  // "39-44" shabloni olib tashlangach bu tekshiruv rang qo'shishni
  // butunlay to'sib qo'ygan edi.

  const boxes = parseInt(($("epa-boxes")||{value:0}).value) || 0;
  if (boxes <= 0) { toast("Pochka sonini kiriting","err"); return; }

  const allSizes = SIZES[p.type] || [];
  const iFrom = allSizes.indexOf(from), iTo = allSizes.indexOf(to);
  let sizeRange;
  if (!from && !to)      sizeRange = [""];        // o'lcham belgilanmagan
  else if (from === to)  sizeRange = [from || to];
  else if (iFrom !== -1 && iTo !== -1 && iFrom <= iTo) sizeRange = allSizes.slice(iFrom, iTo+1);
  else sizeRange = [from, to].filter(Boolean);

  // B1 (v147): yangi rang SHU tovarga qo'shilmaydi — ALOHIDA TOVAR
  // sifatida ochiladi (narxlar nusxalanadi, keyin mustaqil o'zgaradi)
  // 2026-08-03: SKU noyobligi kafolatlanadi
  const { id: newId, sku: _newSku3 } = await _apNextSkuAsync(p.type, 1);
  const _yangiRang = {
    id: newId,
    sku: _newSku3,
    name: p.name, category: p.category, type: p.type, unit: p.unit,
    inBox: sizeRange.length, packUnit: p.packUnit,
    art: p.art || "", barcode: yangiBarcode(),   // 550
    costUsd: p.costUsd, priceUzs: p.priceUzs, ulgurjiNarx: p.ulgurjiNarx,
    // 🔴 535 (2026-08-22): RASM OTA-TOVARDAN OLINADI — ILGARI BO'SH EDI.
    // JONLI DALIL (B20, 2026-08-22 SQL tahlili): yangi rang bilan
    // yaratilgan tovarlarda `image` ustuni BO'SH chiqdi, `data` ichida
    // ham rasm yo'q edi. Ya'ni rasm sinxronda yo'qolmagan — u UMUMAN
    // YOZILMAGAN. Naqsh aniq ko'rindi: rasmi yo'q tovarlar soni
    // "uzun SKU" li tovarlar soni bilan mos tushdi (03:00 → 3 ta tovar,
    // 3 tasi uzun SKU, 0 tasida rasm), ikkalasi ham AYNAN shu yo'ldan
    // keladi.
    // Rasm rang bo'yicha saqlanadi (`colorImages[rang] || image` —
    // `katalog.js:604` va `:1007` shu tartibda o'qiydi), shuning uchun
    // avval o'sha rangning rasmi, keyin umumiy rasm olinadi.
    image: (p.colorImages && p.colorImages[color]) || p.image || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [{ color, size: (from === to ? from : from + "-" + to),
                 qty: boxes * sizeRange.length, pantone, hex }]
  };
  // ✅ 2026-08-19: yangi rang ham SERVER orqali (506 naqshi).
  // Takror = artikul+rang; ya'ni boshqa kassa shu rangni allaqachon
  // ochgan bo'lsa — kassirdan so'raladi (§3.2: har rang alohida tovar).
  if (typeof serverSaveRecord === "function") {
    let _r = await serverSaveRecord("products", _yangiRang, null);
    if (_r && _r.ok === false && _r.code === "dup") {
      const _b = _r.row || {};
      if (!confirm("⚠️ Bu rang allaqachon ochilgan:\n\n" +
            (_b.name || "") + "  ·  " + (_b.sku || "") + "\n\n" +
            "OK — baribir yarataman\nBekor — yaratmayman")) {
        toast("Yaratilmadi", "info"); return;
      }
      _r = await serverSaveRecord("products", _yangiRang, null, true);
    }
    // 🔴 545 (3.33): server id va vaqt muhri qabul qilinadi (409 davosi)
    if (_r && _r.ok && _r.row) {
      if (_r.row.id != null) _yangiRang.id = _r.row.id;
      const _sm = _r.row.data && _r.row.data.updatedAt;
      if (_sm) _yangiRang.updatedAt = _sm;
    }
  }
  db.products.push(_yangiRang);
  try {
    auditLog("yaratish", "product", _yangiRang.sku,
      _yangiRang.name + " · " + color,
      { after: "yangi rang", note: "rang qo'shildi" });
  } catch (e) {}
  try { ensureColorBarcodes(db.products[db.products.length-1]); } catch(e) {}
  // ✅ 2026-08-12: KIRIM YOZUVI (avval YO'Q edi — qoldiq izsiz kirardi)
  try {
    const _np = db.products[db.products.length - 1];
    const _v  = (_np.variants || [])[0];
    if (_v && _v.qty > 0) _stockMove(_np, _v.color, _v.size, _v.qty, "Yangi rang qo'shildi");
  } catch (e) {}
  saveDB(); renderKatalog();
  toast(`"${color}" alohida tovar sifatida ochildi (narxlar nusxalandi)`);
  epCloseAddColor();
  return;

  epRenderColorCards(p);
  epUpdateInboxDisplay(p);
  epCloseAddColor();
  toast(`"${color}" qo'shildi`);
}

async function saveEditProduct() { return _katGuard(_saveEditProductIchki); }   // ✅ 2026-08-19: qulf
async function _saveEditProductIchki() {   // ✅ 2026-08-18: to'qnashuv tekshiruvi (async)
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("katalog","edit")) return;

  if (typeof requireUse === "function" && !requireUse("katalog")) return;

  const p = db.products.find(x => x.sku === editSku); if (!p) return;

  // ═══════════════════════════════════════════════════════════════
  // ✅ 2026-08-18: "BOSHQA KASSA YANGILADIMI?" TEKSHIRUVI
  // ═══════════════════════════════════════════════════════════════
  // Ildiz: sinxronda BUTUN yozuv g'olib bo'ladi — kimning vaqt muhri
  // yangiroq bo'lsa, o'shaniki. Ya'ni A nomni, B narxni o'zgartirsa,
  // keyin saqlagani BIRINCHISINING ISHINI BUTUNLAY O'CHIRADI — na
  // xato, na ogohlantirish (jimgina yo'qolish).
  // Endi saqlashdan oldin bulutdagi muhr solishtiriladi. Yangiroq
  // bo'lsa — kassirdan so'raladi: qayta yuklaymizmi yoki baribir
  // saqlaymizmi. Qaror ODAMDA qoladi.
  // Aloqa yo'q / server rejimi o'chiq bo'lsa — tekshiruv o'tkazib
  // yuboriladi (oflayn ish bloklanmaydi).
  // ⚠️ 2026-08-19 (5-bosqich): TEKSHIRUV SAQLASHDAN KEYINGA KO'CHDI.
  // 486 da bu yerda faqat OGOHLANTIRISH bor edi: bulutdagi muhr
  // o'qilib, "boshqa kassa yangiladi" deyilardi — lekin yozuv baribir
  // lokal ketardi va push oxirida kim yangiroq bo'lsa o'sha yutardi.
  // Endi hakam SERVER: maydonlar `save_record` orqali yoziladi, u
  // do'konni o'zi qo'yadi, muhrni solishtiradi va QOLDIQNI SAQLAB
  // qoladi (qoldiq faqat `stock` orqali o'zgaradi — §3.23).
  // Tekshiruv pastda, maydonlar o'qilgandan keyin.
  // NARX O'QISH TUZATISHI (v144): fmtInput qiymatni "540 000" ko'rinishida
  // formatlaydi — parseFloat probelda to'xtab 540 qilib yuborardi.
  // _pv: probel/vergulni tozalab, kasrni saqlab o'qiydi.
  const _pv = id => parseFloat(String($(id)?.value || "")
    .replace(/[\s\u00A0\u202F]/g, "").replace(",", ".")) || 0;
  // Narx 0 ogohlantirish
  const _newPrice = _pv("ep-price");
  if (_newPrice === 0 && !confirm("Chakana narx 0 so'm qilib saqlansin?")) return;
  // ⚖️ AUDIT 2-bosqich (2026-08-12): narx/tannarx o'zgarishlarini
  // yozish uchun ESKI qiymatlarni eslab qolamiz.
  const _oldVals = { cost: p.costUzs || 0, ulg: p.ulgurjiNarx || 0,
                     price: p.priceUzs || 0, name: p.name };
  p.name        = $("ep-name").value.trim()     || p.name;
  p.category    = $("ep-cat").value.trim()      || p.category;
  // Tannarx: input qiymati joriy valyuta rejimida, bazaga har doim USD saqlanadi
  {
    const cur1  = db.settings?.priceCurrency || "uzs";
    const rate1 = db.settings?.rate || 12800;
    const raw   = _pv("ep-cost");
    // 2026-07-25: TANNARX SO'MDA. Yaxlitlash drifti muammosi ham
    // shu bilan yo'qoladi — aylantirish umuman bo'lmaydi.
    p.costUzs = Math.round(raw);
    p.costUsd = rate1 > 0 ? (raw / rate1) : 0;   // eski kod uchun zaxira
  }
  p.priceUzs    = _pv("ep-price")   || p.priceUzs;
  p.ulgurjiNarx = readUlgAsUzs("ep-ulgurji");
  // ⚖️ AUDIT: nima o'zgarganini nomma-nom yozamiz
  try {
    const _chg = [];
    if ((p.costUzs || 0)     !== _oldVals.cost)  _chg.push(["Tannarx", _oldVals.cost, p.costUzs || 0]);
    if ((p.ulgurjiNarx || 0) !== _oldVals.ulg)   _chg.push(["Ulgurji narx", _oldVals.ulg, p.ulgurjiNarx || 0]);
    if ((p.priceUzs || 0)    !== _oldVals.price) _chg.push(["Chakana narx", _oldVals.price, p.priceUzs || 0]);
    if (p.name !== _oldVals.name)                _chg.push(["Nomi", _oldVals.name, p.name]);
    _chg.forEach(([nomi, eski, yangi]) =>
      auditLog("narx", "product", p.sku, p.name + " · " + nomi,
        { before: String(eski), after: String(yangi) }));
  } catch (e) {}
  if ($("ep-unit"))     p.unit     = $("ep-unit").value     || p.unit;
  if ($("ep-art"))      p.art      = $("ep-art").value.trim();
  if ($("ep-barcode"))  p.barcode  = $("ep-barcode").value.trim();
  // ⚠️ 2026-08-04: POCHKA SIG'IMI RANG DARAJASIGA HAM YOZILADI.
  // Avval faqat `p.inBox` yangilanardi. POS esa `variant.inBox` ni
  // BIRINCHI o'qiydi (kontekst §3.3) — ya'ni tahrir POS'ga YETIB
  // BORMASDI. B20 da "Loro 003" 6 talik qilingan, POS esa 5 talik
  // bo'yicha sotardi (2026-08-04 da 20 tovarda topilgan).
  // Rang darajasida ALOHIDA sig'im ataylab qo'yilgan bo'lsa, u
  // `epUpdateColorField` orqali keyin qayta yoziladi.
  if ($("ep-inbox")) {
    const _newIb = parseInt($("ep-inbox").value) || p.inBox || 1;
    const _oldIb = parseInt(p.inBox) || 0;
    p.inBox = _newIb;
    // Faqat O'ZGARGAN bo'lsa tegamiz — qo'lda qo'yilgan farqli
    // qiymatlar bekorga yo'qolmasin.
    if (_newIb !== _oldIb && Array.isArray(p.variants)) {
      p.variants.forEach(v => { v.inBox = _newIb; });
    }
  }
  if ($("ep-packunit")) p.packUnit = $("ep-packunit").value || p.packUnit;
  if ($("ep-image") && $("ep-image").value) p.image = $("ep-image").value;
  else if ($("ep-image") && $("ep-image").value === "") p.image = "";

  // Variant qiymatlari allaqachon epUpdateQty/epUpdateColorField orqali to'g'ridan-to'g'ri saqlangan
  // ⚠️ 2026-07-26: O'LCHAMSIZ tovarlar variantida size BO'SH bo'ladi.
  // Avval bu filtr ularni O'CHIRIB tashlardi — saqlashdan keyin tovar
  // butunlay yo'qolardi (telefonda ayniqsa sezilardi). Endi faqat rang
  // talab qilinadi, o'lcham ixtiyoriy.
  p.variants = p.variants.filter(v => v.color);

  p.updatedAt = new Date().toISOString(); // v173: SAQLASH paytida ISO muhr (v180 taqqosi Date.parse) — pull poygasida tahrir g'olib

  try { ensureColorBarcodes(p); } catch(e) {}

  // 2026-07-26: tahrirlangan tovar EKRANDA O'Z JOYIDA qolsin —
  // saqlashdan keyin ro'yxat tepaga sakrab ketmasin
  const _scrollEl = document.scrollingElement || document.documentElement;
  const _scrollY  = _scrollEl.scrollTop;
  const _tblWrap  = document.querySelector("#p-katalog .card:has(table)");
  const _tblScroll = _tblWrap ? _tblWrap.scrollTop : 0;

  // ✅ 2026-08-19 (5-bosqich): KARTOCHKA MAYDONLARI SERVERGA.
  // Server javobi: ok · conflict (boshqa qurilma yangilagan).
  // Aloqa yo'q bo'lsa `null` — eski yo'l (lokal + push) ishlaydi.
  if (typeof serverSaveRecord === "function") {
    let _r = await serverSaveRecord("products", p, _epBaseAt);
    // ═══════════════════════════════════════════════════════════════
    // 532 (2026-08-22) — TO'QNASHUV TAHLILI (faqat o'lchov)
    // ═══════════════════════════════════════════════════════════════
    // 530 va 531 da ikki xil yo'l tuzatildi, lekin ogohlantirish jonli
    // sinovda BARIBIR chiqdi. Ya'ni sabab men o'ylagan ikkala narsa
    // ham EMAS. Uchinchi marta taxmin qilmayman (§0.2 A) — solishtirilgan
    // AYNAN SHU uch sonni konsolga chiqaramiz:
    //   · biz yuborgan taqqoslash nuqtasi (`_epBaseAt`)
    //   · bulutdagi muhr (server javobda `row` ni qaytaradi)
    //   · qurilma soati
    // Uchtasidan sabab bir qarashda ko'rinadi:
    //   – bulut muhri SERVER vaqtida va oldinda  → soat farqi, muhr olinmagan
    //   – bulut muhri QURILMA vaqtida va oldinda → boshqa lokal yo'l yozgan
    //   – `_epBaseAt` bo'sh yoki juda eski      → oyna ochilishida olinmagan
    // HECH QANDAY MANTIQ O'ZGARMAYDI — faqat yozuv.
    try {
      if (_r && _r.ok === false && _r.code === "conflict") {
        const _bulut = (_r.row && _r.row.data && _r.row.data.updatedAt) || "(yo'q)";
        const _b = Date.parse(_epBaseAt) || 0, _c = Date.parse(_bulut) || 0;
        console.warn(
          "⚠️ TO'QNASHUV TAHLILI (532)\n" +
          "   taqqoslash nuqtasi (_epBaseAt) : " + (_epBaseAt || "(BO'SH)") + "\n" +
          "   bulutdagi muhr                : " + _bulut + "\n" +
          "   farq (bulut − nuqta)          : " + (_b && _c ? (_c - _b) + " ms" : "?") + "\n" +
          "   lokal tovar p.updatedAt       : " + (p.updatedAt || "(yo'q)") + "\n" +
          "   qurilma soati (hozir)         : " + new Date().toISOString() + "\n" +
          "   tovar SKU                     : " + (p.sku || "?"));
      }
    } catch (e) {}
    // ═══════════════════════════════════════════════════════════════
    // 🔴 533 (2026-08-22): OGOHLANTIRISH OLIB TASHLANDI — SO'RAMASDAN
    //    SAQLANADI. O'LCHOV ESA QOLADI.
    // ═══════════════════════════════════════════════════════════════
    // EGASINING QARORI (2026-08-22, jonli sinovdan keyin):
    // "tahrir server yo'lida bo'lsa, qaysi kassada tahrirlangani
    //  qanchalik muhim — baribir keyingisi ustiga tahrirlaydi".
    //
    // TAHLIL — bu asosan TO'G'RI:
    //   · ogohlantirish hech narsani TO'XTATMAYDI, faqat so'raydi;
    //   · yakka qurilmada foydalanuvchi doim "OK" bosadi — foydasi nol;
    //   · kartochka tahririni odatda ega/admin qiladi, ikki kassir bir
    //     vaqtda BIR tovar kartochkasini tahrirlashi kam uchraydi;
    //   · sotuv bu yo'ldan o'tmaydi (qoldiq alohida — §3.23);
    //   · 2026-08-22 da soxta ogohlantirish yakka qurilmada TAKROR-TAKROR
    //     chiqdi va ishni to'sdi (530 va 531 tuzatishlaridan keyin ham).
    //
    // NIMA YO'QOTILADI (ochiq yozib qo'yiladi): sinxronda BUTUN yozuv
    // g'olib bo'ladi. Ya'ni A nomni, B narxni o'zgartirsa — keyin
    // saqlagani birinchisining ishini jimgina o'chiradi. Endi bu haqda
    // ogohlantirilmaydi. To'g'ri davo — maydon-maydon birlashtirish
    // (server tomonda), u alohida ish sifatida rejaga olindi.
    //
    // ⚠️ O'LCHOV ATAYLAB QOLDIRILDI (532). Soxta to'qnashuv — ALOMAT:
    // u `updatedAt` muhri ishonchsizligini ko'rsatadi. O'sha muhr esa
    // BUTUN sinxronda "kim g'olib" qarorini beradi (`_mergeById`:
    // `_lt > _ct`). Ya'ni sabab topilmasa, ma'lumot boshqa joyda
    // JIMGINA bosib ketilishi mumkin — ogohlantirishdan jiddiyroq.
    // Shuning uchun konsolga yozuv qoladi, foydalanuvchi bezovta
    // qilinmaydi.
    if (_r && _r.ok === false && _r.code === "conflict") {
      _r = await serverSaveRecord("products", p, null);   // so'ramasdan yoziladi
    }
    // ═══════════════════════════════════════════════════════════════
    // 🔴 530 (2026-08-22): SERVER MUHRI QABUL QILINADI — SOXTA
    //    "BOSHQA KASSA YANGILADI" OGOHLANTIRISHI SHUNDAN EDI
    // ═══════════════════════════════════════════════════════════════
    // JONLI HODISA: egasi YAKKA qurilmada, sinov do'konida rang/o'lcham
    // tahrir qilganda "Bu tovarni boshqa kassa yangiladi" chiqdi —
    // holbuki ikkinchi qurilma umuman ishlatilmagan.
    //
    // ILDIZ — IKKI XIL SOAT:
    //   · yuqorida (`p.updatedAt = new Date()...`) muhrni QURILMA
    //     soati bilan qo'yamiz;
    //   · server esa `save_record` da uni O'Z soati bilan qayta yozadi
    //     (`api/pul.js`: `data.updatedAt = now`).
    // Server javobda yangi muhrni QAYTARADI (`return=representation`),
    // lekin klient uni OLMASDI — lokal nusxada qurilma vaqti qolardi.
    // Keyingi tahrirda `_epBaseAt` o'sha eski (qurilma) vaqti bo'lib
    // ketardi va server solishtirganda o'zining vaqti YANGIROQ chiqardi:
    //     `_sAt > _bAt + 1000`  →  "conflict"
    // Ya'ni qurilma soati serverdan 1 soniyadan ko'proq orqada bo'lsa,
    // YAKKA qurilmada ham har ikkinchi tahrirda ogohlantirish chiqardi.
    //
    // Endi §3.23 (SERVER HAQIQAT) va §3.13 (`updatedAt` — sinxron muhri)
    // bo'yicha: yozuv muvaffaqiyatli bo'lsa SERVER bergan muhr olinadi.
    // Shu bilan qurilma soati qanday bo'lishidan qat'i nazar solishtiruv
    // to'g'ri ishlaydi. To'qnashuv himoyasi O'CHIRILMADI — u endi
    // faqat CHINDAN boshqa qurilma yozganda ishlaydi.
    try {
      const _srvAt = (_r && _r.ok && _r.row &&
                      ((_r.row.data && _r.row.data.updatedAt) || _r.row.updated_at)) || "";
      if (_srvAt) { p.updatedAt = _srvAt; _epBaseAt = String(_srvAt); }
    } catch (e) {}
    // Server javobidagi QOLDIQ lokalga qaytariladi (sonlar server
    // haqiqati — kartochka tahriri qoldiqqa tegmaydi)
    try {
      if (_r && _r.ok && _r.row && Array.isArray(_r.row.variants))
        p.variants = _r.row.variants;
    } catch (e) {}
  }

  saveDB();
  try { if (typeof flushCloudSync === "function") flushCloudSync(); } catch(e) {}
  closeModal("editprod");
  renderKatalog();

  // Joyni tiklaymiz + tahrirlangan qatorni qisqa vaqt ajratib ko'rsatamiz
  requestAnimationFrame(() => {
    _scrollEl.scrollTop = _scrollY;
    const w = document.querySelector("#p-katalog .card:has(table)");
    if (w) w.scrollTop = _tblScroll;
    document.querySelectorAll(`#katalog-body tr`).forEach(tr => {
      if ((tr.textContent || "").includes(p.sku)) {
        tr.style.transition = "background .6s";
        tr.style.background = "#FFF7ED";
        setTimeout(() => { tr.style.background = ""; }, 1200);
      }
    });
  });

  toast(`"${p.name}" saqlandi`);
}

function deleteProduct() {
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("katalog","del")) return;

  if (typeof requireUse === "function" && !requireUse("katalog")) return;

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
    const _omCnt = (db.ombor || []).filter(o => o.sku === p.sku).length;
    const _omMsg = _omCnt > 0
      ? `\n\nOmbordagi ${_omCnt} ta kirim yozuvi ham o'chadi.` : "";
    if (!confirm(`"${p.name}" ni o'chirasizmi?${_omMsg}\n\nBu amalni qaytarib bo'lmaydi.`)) return;
  }

  // ⚖️ AUDIT (2026-08-12): o'chirish izi — tovar ketadi, iz QOLADI.
  try {
    const _q = (p.variants || []).reduce((a,v) => a + (v.qty || 0), 0);
    auditLog("delete", "product", p.sku,
      p.name + (p.art ? " · " + p.art : ""),
      { before: "qoldiq " + _q + " dona",
        // ⭐ A (2026-08-12): O'LIM NUSXASI — tovar ketadi, TO'LIQ ma'lumoti
        // audit ichida qoladi: kartochka + kirim yozuvlari. Shu bilan
        // o'chirilgan tovarning tarixini ham ko'rsa bo'ladi (arxiv), va
        // kerak bo'lsa qo'lda qayta tiklash uchun hamma narsa bor.
        note: JSON.stringify({
          sku: p.sku, art: p.art || "", name: p.name,
          category: p.category || "", type: p.type || "",
          unit: p.unit || "dona", inBox: p.inBox || null,
          costUsd: p.costUsd || 0, costUzs: (typeof getCostUzs === "function" ? getCostUzs(p) : 0),
          ulgurjiNarx: p.ulgurjiNarx || 0, priceUzs: p.priceUzs || 0,
          variants: (p.variants || []).map(v => ({
            color: v.color, size: v.size, qty: v.qty, inBox: v.inBox || null })),
          colorBarcodes: p.colorBarcodes || {},
          ombor: (db.ombor || []).filter(o => o.sku === p.sku).map(o => ({
            date: o.date, time: o.time || "", color: o.color, qty: o.qty,
            kirimNarxi: o.kirimNarxi || 0, supplier: o.supplier || "",
            partiya: o.partiya || "" }))
        }).slice(0, 12000) });
  } catch (e) {}

  // 2026-07-25 (№4): ombor va katalog PARALLEL — tovar o'chsa, uning
  // kirim tarixi ham o'chadi (avval omborda "arvoh" yozuvlar qolardi)
  const _omBefore = (db.ombor || []).length;
  const _omRemovedIds = (db.ombor || []).filter(o => o.sku === p.sku).map(o => o.id);
  db.ombor = (db.ombor || []).filter(o => o.sku !== p.sku);
  const _omRemoved = _omBefore - db.ombor.length;

  // 2026-07-26: o'chirishni NAVBATGA yozamiz — bulutga yetishi
  // kafolatlanadi (pull tugamagan bo'lsa ham tirilmaydi)
  try {
    if (typeof queueCloudDelete === "function") {
      queueCloudDelete("products", "sku", p.sku);
      _omRemovedIds.forEach(oid => queueCloudDelete("ombor", "id", oid));
    }
  } catch(e) {}

  // 2026-08-02: BULUTGA HAM AYTAMIZ (tombstone). Busiz yozuv
  // keyingi tortishda QAYTIB kelardi.
  try { if (typeof queueCloudDelete === "function") queueCloudDelete("products", "sku", editSku); } catch(e) {}
  db.products = db.products.filter(x => x.sku !== editSku);
  saveDB();
  try { if (typeof flushCloudSync === "function") flushCloudSync(true); } catch(e) {}
  // 2026-07-25: o'chirish DARHOL bulutga
  try { if (typeof flushCloudSync === "function") flushCloudSync(true); } catch(e) {}
  closeModal("editprod"); renderKatalog();
  toast(_omRemoved > 0
    ? `"${p.name}" o'chirildi (${_omRemoved} ta kirim yozuvi ham)`
    : `"${p.name}" o'chirildi`, "info");
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
  if (file.size > 15 * 1024 * 1024) { toast("Fayl juda katta (15MB+) — bu rasm emasga o'xshaydi","err"); return; }  // 2026-07-24: 5MB darvozasi OLIB TASHLANDI — u SIQISHDAN oldin turib
  // telefon suratlarini (3-8MB) bekorga rad etardi. Siqish baribir
  // rasmni ~50-150KB ga tushiradi.
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      // ⚠️ 2026-08-03: SIFAT KO'TARILDI (600px/150KB → 1200px/400KB).
      // Eski chegara rasm base64 ko'rinishida BAZAGA yozilgan paytda
      // qo'yilgan — hajm muhim edi. Endi rasmlar Supabase Storage'da
      // (§6), hajm chegarasi ancha erkin.
      // Eski qiymatda sifat 0.3 gacha tushib, rasm sezilarli XIRA
      // chiqardi (B20 e'tirozi).
      const MAX = 1200;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      let q = 0.85, dataUrl;
      do { dataUrl = canvas.toDataURL("image/jpeg", q); q -= 0.08; }
      while (dataUrl.length > 400000 && q > 0.55);

      apPendingImage = dataUrl;
      const prev = $("ap-img-preview");
      if (prev) prev.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
      // 2026-07-31: fonda omborga yuklaymiz. Tovar saqlanganda
      // allaqachon havola bo'ladi; ulgurmasa base64 ketadi (zarar yo'q).
      if (typeof uploadImageToStorage === "function") {
        uploadImageToStorage(dataUrl, "yangi").then(url => {
          if (url && url !== dataUrl && apPendingImage === dataUrl) apPendingImage = url;
        }).catch(() => {});
      }
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
  // 2026-07-25 (№10): STANDART "39-44" SHABLONIDAN VOZ KECHILDI.
  // Sabab: pochkalar endi har xil tarkibda keladi (40x1, 41x2, 42x2),
  // shuning uchun "har o'lchamdan bittadan" degan taxmin noto'g'ri.
  // O'lcham endi IXTIYORIY — kim yozadi, kim yozmaydi.
  if ($("ap-size-from")) $("ap-size-from").value = "";
  if ($("ap-size-to"))   $("ap-size-to").value   = "";
  const lbl = $("ap-size-standard-lbl");
  if (lbl) lbl.textContent = "belgilanmagan";
  apCalcBoxes();
}

function apCalcBoxes() {
  // v146: aralash tarkib yozilgan bo'lsa — hisob mix bo'yicha
  if (($("ap-pack-mix")||{value:""}).value.trim()) { apMixHint(); return; }
  const boxes  = parseInt(($("ap-boxes")||{value:""}).value)          || 0; // v169: bo'sh=0
  const from   = ($("ap-size-from")||{value:""}).value;
  const to     = ($("ap-size-to")||{value:""}).value;

  // v159 — MUHIM TUZATISH: O'lcham bo'limi YOPIQ bo'lsa, "1 pochkada
  // nechta" endi HECH QACHON avtomatik qayta yozilmaydi — bu maydon
  // o'lchamdan TO'LIQ mustaqil (foydalanuvchi to'liq nazorat qiladi).
  // Avval: Pochka sonini o'zgartirganda bu funksiya har safar ishga
  // tushib, qo'lda kiritilgan qiymatni (masalan 7) yashiringan standart
  // o'lcham oralig'idan hisoblangan songa (masalan 6) qaytarib qo'yardi
  // — natijada "Jami dona" VA pos.js dagi pochka narxi (ular ham shu
  // inBox ga tayanadi) ikkalasi ham noto'g'ri chiqardi.
  const sizesOn = db.settings?.apFields?.sizes !== false;

  const t = currentApType || "oyoq";
  const allSizes = SIZES[t] || [];
  const iFrom = allSizes.indexOf(from), iTo = allSizes.indexOf(to);
  let sizeCount = 1;
  if (from && to) {
    if (from === to) sizeCount = 1;
    else if (iFrom !== -1 && iTo !== -1 && iFrom <= iTo) sizeCount = iTo - iFrom + 1;
  }

  // v169: bo'sh maydonlar "1" ga emas, 0 ga tushadi — natijada "Jami
  // dona" ham bo'sh ko'rinadi (foydalanuvchi hali to'ldirmagan bo'lsa)
  const manualInbox = parseInt(($("ap-inbox-calc")||{value:""}).value) || 0;
  // ══════════════════════════════════════════════════════════════
  // 2026-07-31: "1 POCHKADA NECHTA" — O'LCHAMDAN TO'LIQ MUSTAQIL
  // ══════════════════════════════════════════════════════════════
  // §3.2 bo'yicha "39-44" standarti OLIB TASHLANGAN, o'lcham ixtiyoriy.
  // Lekin kod hali ham pochka sig'imini o'lchamlar sonidan hisoblab,
  // qo'lda yozilgan qiymatni ustidan yozardi (oraliq tanlanmasa 1 ga
  // qaytarardi) — dona tovar kiritib bo'lmasdi.
  // §3.3: sig'im RANG darajasidagi mustaqil qiymat, o'lchamga bog'liq
  // emas. Endi FAQAT foydalanuvchi yozgani ishlatiladi.
  const effectiveInbox = manualInbox;
  const total = boxes * effectiveInbox;

  // Faqat O'lcham bo'limi OCHIQ bo'lganda "1 pochkada"ni oraliqdan
  // avtomatik to'ldiramiz — yopiq bo'lsa qo'lda kiritilgan qiymatga
  // TEGILMAYMIZ.
  // Maydon endi HECH QACHON avtomat qayta yozilmaydi (yuqoridagi izoh).
  // O'lcham oralig'i tanlanganda ham foydalanuvchi qiymati saqlanadi.
  // Faqat maydon BO'SH bo'lsa taklif sifatida oraliqdan to'ldiramiz.
  if (sizesOn && from && to && !manualInbox && $("ap-inbox-calc"))
    $("ap-inbox-calc").value = sizeCount;
  // 2026-07-26: dona QO'LDA yozilayotgan bo'lsa ustidan yozmaymiz
  if ($("ap-qty-range") && !_apDonaEditing) $("ap-qty-range").value = total || "";

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

// ── B1 MIGRATSIYA (v147): mavjud ko'p rangli tovarlarni ajratish ──
// Konsoldan bir marta: splitColors()  — har qo'shimcha rang alohida
// tovar bo'ladi (narxlar nusxalanadi, qoldiqlar o'z rangida qoladi).
function splitColors() {
  const _splitYangilar = [];   // ✅ 2026-08-19: serverga yuboriladiganlar
  let made = 0;
  const multi = db.products.filter(p =>
    new Set((p.variants||[]).map(v => v.color)).size > 1);
  if (!multi.length) { console.log("Ko'p rangli tovar yo'q — ajratish kerak emas"); return; }
  if (!confirm(`${multi.length} ta ko'p rangli tovar topildi. Har rang alohida tovarga ajratilsinmi?`)) return;
  multi.forEach(p => {
    const colors = [...new Set(p.variants.map(v => v.color))];
    colors.slice(1).forEach(c => {
      const newId = nextId();
      db.products.push({
        ...JSON.parse(JSON.stringify(p)),
        id: newId,
        sku: p.sku + "-" + (++made),
        barcode: (p.colorBarcodes && p.colorBarcodes[c]) || yangiBarcode(),   // 550
        updatedAt: new Date().toISOString(),
        variants: p.variants.filter(v => v.color === c)
      });
      try { ensureColorBarcodes(db.products[db.products.length-1]); } catch(e) {}
      try { _splitYangilar.push(db.products[db.products.length-1]); } catch(e) {}
      try {
        const _sp = db.products[db.products.length-1];
        auditLog("yaratish", "product", _sp.sku, _sp.name + " · " + c,
          { after: "ranglar ajratildi", note: "manba: " + (p.sku || "") });
      } catch (e) {}
    });
    p.variants = p.variants.filter(v => v.color === colors[0]);
  });
  // ✅ 2026-08-19: ajratilgan tovarlar SERVERGA yoziladi (506 naqshi).
  // Bu amal ko'p tovar yaratadi, shuning uchun ogohlantirish
  // ko'rsatilmaydi — `force` bilan to'g'ridan-to'g'ri yoziladi
  // (kassir ataylab ajratyapti, takror bo'lishi kutilgan holat).
  // Aloqa yo'q bo'lsa eski yo'l: lokal + push.
  if (typeof serverSaveRecord === "function" && _splitYangilar.length) {
    (async () => {
      for (const _np of _splitYangilar) {
        try { await serverSaveRecord("products", _np, null, true); } catch (e) {}
      }
      console.log("📤 Ajratilgan " + _splitYangilar.length + " tovar serverga yozildi");
    })();
  }
  saveDB(); renderKatalog();
  console.log(`✅ ${made} ta yangi tovar ochildi (ranglar ajratildi)`);
  toast(`✅ Ranglar ajratildi: ${made} ta yangi tovar`);
}

// ── Aralash pochka tarkibi (v145) ─────────────────────────────
// "40x2, 41x2, 43x1" → [{size:"40",per:2},{size:"41",per:2},{size:"43",per:1}]
function parsePackMix(raw) {
  const out = [];
  // v146: vergul, nuqtali vergul VA PROBEL — hammasi ajratuvchi
  String(raw || "").trim().split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
    .forEach(tok => {
      const m = tok.match(/^(.+?)\s*[x×X*:]\s*(\d+)$/);
      if (m) out.push({ size: m[1].trim(), per: parseInt(m[2]) || 1 });
      else out.push({ size: tok, per: 1 });
    });
  return out;
}

function apMixHint() {
  const raw = ($("ap-pack-mix") || {value:""}).value.trim();
  const el = $("ap-mix-hint");
  if (!raw) {
    if (el) el.textContent = "";
    if (typeof apCalcBoxes === "function") apCalcBoxes();
    return;
  }
  const mix = parsePackMix(raw);
  const tot = mix.reduce((s, t) => s + t.per, 0);
  if (el) el.textContent = `1 pochkada: ${tot} dona (${mix.map(t => t.size + "×" + t.per).join(", ")})`;
  if ($("ap-inbox-calc")) $("ap-inbox-calc").value = tot;
  // Jami dona = pochka soni × 1 pochkadagi dona
  const _bx = parseInt(($("ap-boxes")||{value:1}).value) || 1;
  if ($("ap-qty-range") && !_apDonaEditing) $("ap-qty-range").value = _bx * tot;
  const _pv = $("ap-size-range-preview");
  if (_pv) _pv.textContent = "→ " + mix.map(t => t.size + "×" + t.per).join(", ");
}

// ═══════════════════════════════════════════════════════════════
// ✅ 2026-08-19 (B20 hodisasi): IKKI BOSISH QULFI — §3.16 sinfi
// ═══════════════════════════════════════════════════════════════
// 481 da yaratish ASYNC bo'ldi (SKU serverdan olinadi): tugma
// bosilgach javob kelguncha bir necha soniya o'tishi mumkin, tugma
// esa FAOL qolardi, "qo'shildi" xabari faqat oxirida chiqardi.
// Sekin tarmoqda kassir "ishlamadi" deb yana bosgan/qayta kiritgan —
// natijada BITTA tovar IKKI karta bo'lib tushgan (AP-17 Polzamok,
// ikki barcode, 2×30 pochka). Server SKU noyobligi ikkinchisiga
// BOSHQA raqam bergani uchun ustma-ust yozilmay, ikkala karta ham
// qolgan. Endi barcha kirituvchi amallar bitta qulf ostida:
// birinchisi tugamaguncha takror bosishga "⏳ kuting" javobi.
// Tanalar O'ZGARMAGAN — faqat yupqa o'ram (xavfsizlik qoidasi).
let _katSaveBusy = false;
async function _katGuard(fn) {
  if (_katSaveBusy) { toast("⏳ Saqlanmoqda — kuting...", "err"); return; }
  _katSaveBusy = true;
  try { return await fn(); }
  finally { _katSaveBusy = false; }
}

async function addProduct() { return _katGuard(_addProductIchki); }
async function _addProductIchki() {   // ✅ 2026-08-18: SKU serverdan (async)
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("katalog","add")) return;

  if (typeof requireUse === "function" && !requireUse("katalog")) return;

  const name = ($("ap-name")||{value:""}).value.trim();
  if (!name) { toast("Nom kiriting","err"); return; }

  // 2026-07-25 (№3): VARIATIV rejim — butunlay alohida oqim.
  // Rang, pochka, narx jadvalda kiritilgani uchun quyidagi
  // tekshiruvlar (rang, pochka) bu yerda o'tkazilmaydi.
  if (_apVarOn) { await apAddVariativ(name); return; }

  const color   = ($("ap-color")||{value:""}).value.trim();
  if (!color) { toast("Rang tanlang","err"); return; }

  const t       = currentApType || "oyoq";
  const costRaw = getRawVal("ap-cost"); // v169: endi vergul-formatlangan (fmtInput/priceInputHandler)
  const rate1   = db.settings?.rate || 12800;
  // 2026-07-25: TANNARX HAR DOIM SO'MDA kiritiladi va so'mda saqlanadi.
  // Tizim valyutasi qanday bo'lishidan qat'i nazar — kurs o'zgarganda
  // tovar narxi O'ZGARMAYDI.
  const costUzsVal = costRaw;                       // kiritilgan so'm
  const cost       = rate1 > 0 ? costRaw / rate1 : 0; // eski kod uchun zaxira
  // v151: chakana narx — endi mavjud maydondan, probelga chidamli o'qiladi
  const price   = ($("ap-price") && typeof getRawVal === "function") ? (getRawVal("ap-price") || 0) : 0;
  const ulg     = readUlgAsUzs("ap-ulgurji");
  const unit    = ($("ap-unit")||{value:"dona"}).value;
  const packUnit = ($("ap-packunit")||{value:"karobka"}).value;
  const pantone = ($("ap-pantone")||{value:""}).value.trim();
  const hex     = ($("ap-hex")||{value:"#888888"}).value;
  const art     = ($("ap-art")||{value:""}).value.trim();
  const barcode = ($("ap-barcode")||{value:""}).value.trim();

  // O'lcham oralig'i — har doim from/to dan o'qiladi (standart yoki tahrirlangan)
  const from = ($("ap-size-from")||{value:""}).value;
  const to   = ($("ap-size-to")||{value:""}).value;
  const mixRaw = ($("ap-pack-mix")||{value:""}).value.trim();
  // B2 (v148): o'lcham SHART EMAS — u endi faqat tavsif matni

  const boxes  = parseInt(($("ap-boxes")||{value:1}).value)      || 1;
  const inBox  = parseInt(($("ap-inbox-calc")||{value:1}).value) || 1;
  // 2026-07-26: JAMI DONA yozilgan bo'lsa u USTUVOR — ochilgan qoldiq
  // shu yerdan keladi (153 dona = 30 pochka × 5 + 3 dona ochilgan).
  const _donaInput = parseInt(($("ap-qty-range")||{value:""}).value) || 0;
  if (boxes <= 0 && _donaInput <= 0) { toast("Pochka soni yoki jami donani kiriting","err"); return; }

  // ── B2 (v148): ULGURJI-BIRINCHI MODEL ─────────────────────────
  // Hisob POCHKA darajasida: jami dona = pochka soni × 1 pochkada nechta.
  // O'lcham hisobga TA'SIR QILMAYDI — faqat tavsif matni sifatida
  // saqlanadi ("39-44" yoki "40x2 41x2 43x1") va chek/katalogda ko'rinadi.
  let sizeText = "";
  let autoIn = 0;
  if (mixRaw) {
    const mix = parsePackMix(mixRaw);
    if (!mix.length) { toast("Pochka tarkibi tushunarsiz. Namuna: 40x2 41x2 43x1","err"); return; }
    sizeText = mix.map(tk => tk.size + "x" + tk.per).join(" ");
    autoIn   = mix.reduce((s, tk) => s + tk.per, 0);
  } else if (from && to) {
    sizeText = (from === to) ? from : (from + "-" + to);
    const allSizes = SIZES[t] || [];
    const iF = allSizes.indexOf(from), iT = allSizes.indexOf(to);
    autoIn = (iF !== -1 && iT !== -1 && iF <= iT) ? (iT - iF + 1) : 1;
  }
  // Qo'lda kiritilgan "1 pochkada" USTUVOR, bo'lmasa avtomat taklif
  const effectiveInBox = (inBox > 0 ? inBox : (autoIn || 1));
  // Jami dona yozilgan bo'lsa o'shani olamiz (ochilgan qoldiq bilan),
  // aks holda pochka × pochkada (eski usul — buzilmaydi)
  const _totalQty = _donaInput > 0 ? _donaInput : (boxes * effectiveInBox);
  const newVariants = [{ color, size: sizeText || "-", qty: _totalQty,
    inBox: effectiveInBox, pantone, hex }];

  // B1 (v152): HAR RANG = ALOHIDA TOVAR, ARTIKUL ham hisobga olinadi.
  // Nom+rang bir xil bo'lsa-da, ARTIKUL boshqa bo'lsa — bu boshqa tovar
  // (masalan xitoy nakladnoylarida bir xil "navy" rang, har xil kod).
  // Artikul kiritilmagan bo'lsa — avvalgidek nom+rang bo'yicha qidiriladi.
  let p = db.products.find(x =>
    x.name.toLowerCase() === name.toLowerCase() &&
    (x.variants || []).some(v => (v.color || "").toLowerCase() === color.toLowerCase()) &&
    (art ? (x.art || "").toLowerCase() === art.toLowerCase() : !(x.art || "").trim())
  );
  if (p) {
    // B2: rang bo'yicha yagona variantga qo'shamiz (o'lcham matni farq
    // qilsa ham qoldiq bitta joyda yig'iladi)
    newVariants.forEach(nv => {
      const ex = p.variants.find(v => v.color === nv.color);
      if (ex) { ex.qty += nv.qty;
        // ✅ 2026-08-18: mavjud rangga qo'shilgan qoldiq ham serverga
        if (typeof _serverStock === "function")
          _serverStock(p, ex.color || "", ex.size || "", Number(nv.qty) || 0);
        if (pantone) { ex.pantone = pantone; ex.hex = hex; }
        // Fayldagi quti sig'imi variantga yoziladi
        if ((parseInt(r.inbox) || 0) > 0) ex.inBox = parseInt(r.inbox);
                if (nv.size && nv.size !== "-") ex.size = nv.size; }
      else p.variants.push(nv);
    });
    if (art) p.art = art;
    if (barcode && !p.barcode) p.barcode = barcode;
    if (packUnit) p.packUnit = packUnit;
    if (apPendingImage) p.image = apPendingImage;
    // Narxlarni ham yangilaymiz — foydalanuvchi modalda kiritgan narx ustuvor
    if (cost > 0 && Math.abs(cost - (p.costUsd || 0)) >= 0.01) p.costUsd = cost; // v150: drift himoyasi
    if (price > 0) p.priceUzs    = price;
    if (ulg > 0)   p.ulgurjiNarx = ulg;
    // B2: inBox = shu kirimda aniqlangani (qo'lda yozilgani ustuvor)
    // ⚠️ 2026-08-04: RANG DARAJASIGA HAM. POS `variant.inBox` ni
    // birinchi o'qiydi — busiz kirimdagi yangi sig'im POS'ga yetib
    // bormasdi (tahrir yo'lidagi bilan bir xil xato).
    {
      const _oldIb = parseInt(p.inBox) || 0;
      p.inBox = effectiveInBox;
      if (effectiveInBox !== _oldIb && Array.isArray(p.variants)) {
        p.variants.forEach(v => { v.inBox = effectiveInBox; });
      }
    }
  } else {
    // 🔴 546: YAKKA YO'LDA HAM RASM AVVAL YUKLANADI (545/B3 varianti).
    // Yuklash fonda ketardi; kassir tez saqlasa tovar base64 bilan
    // ketib, server uni tashlar (539) va boshqa qurilmaga RASMSIZ
    // borardi; kech kelgan havola esa apResetImage'dan keyin bekorga
    // ketardi. Bitta rasm — kutish odatda 1 soniyadan kam; ulgurmasa
    // yoki oflaynda — eski yo'l (ish to'xtamaydi).
    if (apPendingImage && String(apPendingImage).startsWith("data:image") &&
        typeof uploadImageToStorage === "function" &&
        (typeof navigator === "undefined" || navigator.onLine !== false)) {
      try {
        const _u = await Promise.race([
          uploadImageToStorage(apPendingImage, "yangi"),
          new Promise(res => setTimeout(() => res(null), 8000))
        ]);
        if (_u && _u !== apPendingImage) apPendingImage = _u;
      } catch (e) {}
    }
    const autoBarcode = barcode || yangiBarcode();   // 550
    // 2026-08-03: SKU noyobligi kafolatlanadi
    // ✅ 2026-08-18: raqam SERVERDAN (ikki kassa to'qnashuvi yopiladi);
    // aloqa bo'lmasa lokal yo'l — oflaynda ish to'xtamaydi.
    const { id: newProdId, sku: _newSku2 } = await _apNextSkuAsync(t, 1);
    const _yangiTovar = {
      id: newProdId,
      sku: _newSku2,
      name, category: (($("ap-cat")||{value:""}).value || "").trim(),
      type:t, unit, inBox: effectiveInBox, packUnit,
      art: art || "",
      costUzs:costUzsVal, costUsd:cost, priceUzs:price, ulgurjiNarx:ulg,
      barcode: autoBarcode,
      image: apPendingImage || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      variants: newVariants
    };
    // ═══════════════════════════════════════════════════════════
    // ✅ 2026-08-19: YANGI TOVAR SERVER ORQALI YOZILADI
    // ═══════════════════════════════════════════════════════════
    // Avval SKU serverdan olinardi (18-avg), YOZUVNING O'ZI esa lokal
    // ketardi. Shuning uchun AP-17 da (19-avg) ikki qurilma bir tovarni
    // kiritganda SKU lar har xil bo'ldi — to'qnashuv yo'q, lekin IKKI
    // KARTA paydo bo'ldi. Endi server bilib turadi: artikul+rang
    // bo'yicha takror bo'lsa — kassirdan so'raladi.
    // ⚠️ Nom bo'yicha tekshirilmaydi: bir nom har xil rangda TABIIY (§3.2).
    // Aloqa yo'q bo'lsa eski yo'l ishlaydi — oflaynda ish to'xtamaydi.
    if (typeof serverSaveRecord === "function") {
      let _r = await serverSaveRecord("products", _yangiTovar, null);
      if (_r && _r.ok === false && _r.code === "dup") {
        const _b = _r.row || {};
        const _bq = ((_b.variants || [])[0] || {}).qty;
        if (!confirm("⚠️ Shu artikul va rangda tovar allaqachon bor:\n\n" +
              (_b.name || "") + (_b.art ? "  ·  " + _b.art : "") +
              "  ·  " + (_b.sku || "") +
              (_bq != null ? "\nQoldiq: " + _bq : "") + "\n\n" +
              "Ehtimol boshqa kassa kiritgan.\n\n" +
              "OK — baribir YANGI karta yarataman\n" +
              "Bekor — yaratmayman (mavjudiga kirim qilaman)")) {
          toast("Yaratilmadi — mavjud tovarga kirim qiling", "info");
          return;
        }
        _r = await serverSaveRecord("products", _yangiTovar, null, true);   // majburiy
      }
      // 🔴 545 (3.33-qoida): SERVER BERGAN id VA VAQT MUHRI QABUL
      // QILINADI. Aks holda: server 409 da id ni almashtirsa, lokalda
      // eski (band) id qolib, push o'sha 409 ni qaytadan olaverardi.
      if (_r && _r.ok && _r.row) {
        if (_r.row.id != null) _yangiTovar.id = _r.row.id;
        const _sm = _r.row.data && _r.row.data.updatedAt;
        if (_sm) _yangiTovar.updatedAt = _sm;
      }
    }
    db.products.push(_yangiTovar);
    // ✅ 2026-08-19: TOVAR YARATILISHI AUDITGA YOZILADI.
    // Ildiz: 19-avgust forenzikasida "bu kartani kim yaratdi?" savoliga
    // javob topilmadi — audit faqat tahrir va o'chirishni yozardi.
    try {
      auditLog("yaratish", "product", _yangiTovar.sku,
        _yangiTovar.name + (((_yangiTovar.variants || [])[0] || {}).color
          ? " · " + _yangiTovar.variants[0].color : ""),
        { after: "yangi tovar", note: "qo'lda qo'shildi" +
          (_yangiTovar.art ? " · art " + _yangiTovar.art : "") });
    } catch (e) {}
    // 2026-07-24 (№9): yangi tovarning har rangiga alohida barcode
    try { ensureColorBarcodes(db.products[db.products.length-1]); } catch(e) {}
  }

  // v174 (№8): QO'LDA qo'shish ham KIRIM TARIXIGA yoziladi (avval faqat
  // Excel/AI-import yozardi — shuning uchun tab "ishlamayapti" ko'rinardi).
  // Ikkala tarmoq uchun ham: yangi tovar va mavjudga qo'shish.
  const _rate = (db.settings?.rate || 12800);
  newVariants.forEach(nv => {
    if (!nv.qty || nv.qty <= 0) return;
    db.ombor.push({
      id:          nextId(),
      date:        today(),
      time:        (typeof nowTime === "function" ? nowTime() : ""),
      sku:         p ? p.sku : db.products[db.products.length-1].sku,
      art:         art || "",
      productName: name,
      unit:        unit || "dona",
      color:       nv.color,
      size:        nv.size,
      qty:         nv.qty,
      pantone:     nv.pantone || pantone || "",
      hex:         nv.hex || hex || "",
      boxes:       (effectiveInBox > 1 && newVariants.length === 1)
                     ? Math.floor(nv.qty / effectiveInBox) : null,
      kirimNarxi:  Math.round((cost || 0) * _rate),
      chakana:     price || 0,
      ulgurji:     ulg || 0,
      supplier:    "",
      partiya:     "Qo'lda",
      payStatus:   "tolandan"
    });
  });

  // 2026-07-25 (№3): jadvalda qo'shimcha ranglar bo'lsa — har biri uchun
  // ALOHIDA tovar yaratamiz (B1 qarori). Jadval bo'sh bo'lsa hech narsa
  // o'zgarmaydi — eski oqim aynan avvalgidek ishlaydi.
  saveDB(); closeModal("addprod"); renderKatalog();
  apResetAddForm(); // v160: keyingi tovar uchun forma toza turishi kerak
  toast(`"${name}" qo'shildi`);

  // Formani tozalash
  if ($("ap-name"))       $("ap-name").value       = "";
  if ($("ap-boxes"))      $("ap-boxes").value       = "1";
  if ($("ap-inbox-calc")) $("ap-inbox-calc").value  = "6";
  if ($("ap-pack-mix")) $("ap-pack-mix").value = "";
  if ($("ap-mix-hint")) $("ap-mix-hint").textContent = "";
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
  { key:"inbox",     lbl:"Import: '1 pochkada nechta' ustuni", def:false },
  { key:"sizes",     lbl:"O'lcham bo'limi (Dan/Gacha)",        def:true  },
  { key:"chakana",   lbl:"Chakana narx maydoni",               def:false },
];

function apGetFields() {
  return Object.assign({}, Object.fromEntries(AP_FIELDS.map(f=>[f.key,f.def])), db.settings.apFields||{});
}

function apApplyFields() {
  const fields = apGetFields();
  document.querySelectorAll('.ap-field[data-apf]').forEach(el => {
    const key = el.dataset.apf;
    // 2026-07-25: variativ yoqilgan bo'lsa — jadvalga ko'chgan maydonlar
    // (tannarx, chakana, rasm) yashirin QOLADI. Aks holda bu funksiya
    // har chaqirilganda ularni qaytarib chiqarardi.
    if (typeof _apVarOn !== "undefined" && _apVarOn && el.classList.contains("ap-hide-var")) {
      el.style.display = "none"; return;
    }
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
  // ⚠️ 2026-08-09: TAKLIF RO'YXATI OLIB TASHLANDI (egasining talabi).
  // Nomlar yuzlab-minglab bo'lganda datalist taklifi kiritishga
  // yordam emas, TO'SIQ bo'ldi — endi nom har safar yangidan yoziladi.
  // Bu funksiya faqat "bu nomli tovar mavjud" ogohlantirishini qoldirdi.

  const note = $("ap-existing-note");
  const p = db.products.find(x => x.name.toLowerCase() === val.toLowerCase().trim());

  if (!p) {
    if (note) note.style.display = "none";
    return;
  }

  // ⚠️ 2026-08-02: MAYDONLARNI AVTOMAT TO'LDIRISH OLIB TASHLANDI.
  // Avval nom mavjud tovarga mos kelsa, kod uchta maydonga
  // ARALASHARDI:
  //     ap-art      ← eski tovar artikuli YOZILARDI
  //     ap-ulgurji  ← eski tovar ulgurji narxi YOZILARDI
  //     ap-cost     ← BO'SHATILARDI (kiritilgan tannarx yo'qolardi)
  // Telefonda taklif ro'yxatidan nom tanlangan zahoti shu sodir
  // bo'lardi va yangi tovar eski tovarning narxlari bilan to'lib
  // ketardi. Har tovarning nomi, artikuli va narxlari ALOHIDA
  // kiritiladi — avtomat to'ldirish xato edi.
  //
  // QOLDI (2026-08-09 dan keyin): faqat "bu tovar mavjud" ogohlantirishi
  // (ular foydali — takror kiritishdan saqlaydi).
  // TEGILMADI: rang tanlash, kategoriya, pochka sig'imi, rasm, barcode.

  const totalQty = p.variants.reduce((a,v) => a+v.qty, 0);
  if (note) {
    note.style.display = "block";
    note.innerHTML = `<i class="ti ti-info-circle"></i> Bu tovar allaqachon mavjud (joriy qoldiq: ${totalQty} ${p.unit||"dona"}). Yangi rang shu tovarga qo'shiladi, narxlar yangilanadi.`;
  }
  apCostNote();
}

// ── Rasm manbai tanlash (2026-07-09, v163) ──────────────────────
// Rasm belgisiga BITTA bosish — "Kamera" yoki "Galereya" so'raladigan
// KICHIK MODAL ochiladi (mavjud openModal/closeModal tizimi orqali —
// bu ishonchli, chunki bu tizim allaqachon boshqa ichma-ich modallarda
// (masalan AI-naklad) sinovdan o'tgan; alohida qo'lda pozitsiyalangan
// popup esa vaqt bo'yicha o'zini yopib qo'yish xatosiga uchragan edi).
let _imgSrcGalId = null, _imgSrcCamId = null;
function imgSrcAsk(galId, camId) {
  // 2026-07-10 SINOV XULOSASI: capture'siz input Android'ning yangi
  // rasm-tanlagichini ochadi, unda KAMERA YO'Q (bu OS cheklovi —
  // kamera tugmasi faqat o'rnatiladigan ilovalarga beriladi, veb-sayt
  // uchun emas). Shuning uchun kamera kafolati uchun ORALIQ TANLOV
  // QAYTARILDI. Kamera-input yo'q joylarda to'g'ridan-to'g'ri
  // galereya ochiladi (modalsiz).
  _imgSrcGalId = galId; _imgSrcCamId = camId;
  if (!camId || !$(camId)) { const el = $(galId); if (el) el.click(); return; }
  // 2026-07-24: tovar oynasi USTIGA ochiladi — ostidagi oyna YOPILMAYDI
  // (avval yopilib, foydalanuvchini katalogga otib yuborardi)
  openModal("img-src", true);
}
function imgSrcPick(kind) {
  closeModal("img-src");
  const id = kind === "cam" ? _imgSrcCamId : _imgSrcGalId;
  if (id && $(id)) $(id).click();
}

// v160: "Yangi tovar" formasini to'liq tozalash — tovar saqlangandan
// keyin va modal qaytadan ochilganda eski ma'lumot (nom, rang, pochka,
// rasm...) qolib ketmasligi uchun
function apResetAddForm() {
  // 2026-07-25 (№3): qo'shimcha ranglar jadvali ham tozalanadi
  try { _apVarReset(); } catch(e) {}
  ["ap-name","ap-art","ap-color"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("ap-boxes")) $("ap-boxes").value = "";
  if ($("ap-inbox-calc")) $("ap-inbox-calc").value = "";
  if ($("ap-qty-range")) $("ap-qty-range").value = "";
  if ($("ap-pack-mix")) $("ap-pack-mix").value = "";
  if ($("ap-mix-hint")) $("ap-mix-hint").textContent = "";
  if ($("ap-cost")) $("ap-cost").value = "";
  if ($("ap-cost-note")) $("ap-cost-note").textContent = "";
  ["ap-ulgurji","ap-price"].forEach(id => {
    const el = $(id); if (el) { el.value = ""; el.dataset.raw = ""; }
  });
  if (typeof apResetImage === "function") apResetImage();
  if (typeof apTypeChange === "function") apTypeChange(currentApType || "oyoq");
}

function apOpenAddProduct() {
  apResetAddForm();
  // 2026-07-26: kategoriya takliflari HAR ochilganda yangilanadi —
  // oldingi sessiyada qo'shilgan yangi kategoriya ham chiqsin
  try { fillCatSuggest(currentApType); } catch(e) {}
  openModal("addprod");
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
  // 2026-07-26: kategoriya endi ERKIN TEG — tanlash o'rniga yozish.
  // Avval ishlatilgan kategoriyalar taklif qilinadi (datalist).
  if (typeof fillCatSuggest === "function") fillCatSuggest(t);
  if ($("ap-size-from")) $("ap-size-from").innerHTML = (SIZES[t]||[]).map(s => `<option>${s}</option>`).join("");
  if ($("ap-size-to"))   $("ap-size-to").innerHTML   = (SIZES[t]||[]).map(s => `<option>${s}</option>`).join("");
  // №11a (v175): birliklar TEG ro'yxatidan — "dona" birinchi/standart
  if ($("ap-unit"))      $("ap-unit").innerHTML      = getUnitTags().map(u => `<option${u==="dona"?" selected":""}>${u}</option>`).join("");
  if ($("ap-packunit"))  $("ap-packunit").innerHTML  = getPackUnitTags().map(u => `<option>${u}</option>`).join("");
  apResetSizeToStandard(); // standart oraliqqa o'rnatish (39-44 yoki S-XL)
  apApplyFields();
  apCostNote();
}

function apCostNote() {
  const cur  = db.settings?.priceCurrency || "uzs";
  const rate = db.settings?.rate || 1;
  const c    = getRawVal("ap-cost"); // v169
  // v168: marja/foyda hisobi uchun Ulgurji narx HAR DOIM SO'MGA
  // aylantirib o'qiladi (avval xom USD raqami to'g'ridan-to'g'ri
  // so'm deb solishtirilib, mantiqsiz foiz chiqarardi)
  const u    = (typeof readUlgAsUzs === "function") ? readUlgAsUzs("ap-ulgurji") : (getRawVal("ap-ulgurji") || 0);
  const inBoxC = parseInt(($("ap-inbox-calc")||{value:1}).value) || 1;
  const packUnit = ($("ap-packunit")||{value:"karobka"}).value;
  const el   = $("ap-cost-note"); if (!el) return;
  const elU  = $("ap-ulgurji-note");

  let costUzs = 0;
  if (c > 0) {
    let txt;
    {
      // 2026-07-25: TANNARX HAR DOIM SO'MDA kiritiladi (tizim valyutasi
      // qanday bo'lishidan qat'i nazar) va so'mda qotadi.
      costUzs = c;
      const _m = calcMarkup(costUzs, u);
      const mCol = markupColor(_m ? _m.markup : null);
      txt = `Tannarx: ${fmt(costUzs)} so'm`;
      if (_m) txt += ` → <strong style="color:${mCol}">+${_m.markup}% ustama</strong>` +
                     `<span style="color:var(--mut);font-size:11px"> · ${_m.margin}% marja</span>`;
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
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("katalog","excel")) return;

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
  headers.push("Ulgurji narx (so'm)", "Ustama (%)", "Marja (%)");

  const rows = [headers];

  // 2026-08-02: EKRANDAGI ro'yxatdan olamiz — filtr, qidiruv va
  // saralash avtomat mos keladi. Avval `db.products` dan olinardi
  // va ekranda nima ko'rinishidan qat'i nazar HAMMA tovar chiqardi.
  getExportList("katalog", db.products).forEach(p => {
    const costUzs = getCostUzs(p);
    // 2026-07-25: eksportda ikkala ko'rsatkich alohida ustunda
    const _mk = calcMarkup(costUzs, p.ulgurjiNarx);
    const markup = _mk ? _mk.markup : "";
    const margin = _mk ? _mk.margin : "";

    const colors = [...new Set((p.variants||[]).map(v => v.color))];
    const colorList = colors.length ? colors : [""];

    colorList.forEach(color => {
      // ⚠️ 2026-08-02: EKRAN BILAN AYNAN BIR XIL HISOB.
      // Avval eksport o'z mantiqini ishlatardi va uch joyda xato edi:
      //   1. pochka soni = eng kichik variant miqdori (Math.min) —
      //      aslida jami dona ÷ pochka sig'imi bo'lishi kerak
      //   2. "pochkada nechta" p.inBox dan olinardi — RANG darajasidagi
      //      qiymat (variant.inBox) e'tiborsiz qolardi
      //   3. to'liq va OCHILGAN pochka bitta qatorga qo'shilib ketardi
      // Endi ekrandagi `regroupPackages()` ishlatiladi (yagona manba):
      //   to'liq  → pochka 30, pochkada 5, jami dona 150
      //   ochilgan → pochka 0,  pochkada 5, jami dona 3
      const groups = typeof regroupPackages === "function"
        ? regroupPackages(p.variants, color, p.inBox) : [];
      const _fallback = [{ packGroup: 0, isBroken: false,
                           variants: p.variants.filter(v => v.color === color) }];
      (groups.length ? groups : _fallback).forEach(g => {
        const gv = g.groupVariants || g.variants ||
                   p.variants.filter(v => v.color === color);
        const sizesStr = gv.map(v => v.size).filter(x => x && x !== "-").join(", ");
        const jamiDona = gv.reduce((a,v) => a + (v.qty||0), 0);
        // Sig'im: RANG darajasi ustuvor (ekrandagi qoida)
        const _vIb = parseInt(gv[0] && gv[0].inBox) || 0;
        const inBoxEff = _vIb > 0 ? _vIb
                         : (gv.length === 1 ? (p.inBox || 1) : (gv.length || 1));
        // Ochilgan pochkada pochka soni 0 — ekranda ham shunday
        const pochkaSoni = g.isBroken ? 0
          : (gv.length === 1 ? Math.floor(jamiDona / (inBoxEff || 1))
                             : (g.packGroup || 0));
        const pantone = gv[0]?.pantone || "";

        const row = [p.name, p.art || ""];
        if (fields.category) row.push(p.category);
        if (shopType === "ikki") row.push(p.type === "oyoq" ? "Oyoq kiyim" : "Kiyim");
        if (fields.unit) row.push(p.unit || "dona");
        if (fields.packunit) row.push(p.packUnit || "pochka");
        if (fields.barcode) row.push((p.colorBarcodes && p.colorBarcodes[color]) || p.barcode || "");
        row.push(color + (g.isBroken ? " (ochilgan)" : ""));
        if (fields.pantone) row.push(pantone);
        row.push(sizesStr, pochkaSoni, inBoxEff, jamiDona);
        if (fields.cost) row.push(p.costUsd || 0, costUzs);
        row.push(p.ulgurjiNarx || 0, markup, margin);
        rows.push(row);
      });
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
  if (file.size > 15 * 1024 * 1024) { toast("Fayl juda katta (15MB+) — bu rasm emasga o'xshaydi","err"); return; }  // 2026-07-24: 5MB darvozasi OLIB TASHLANDI — u SIQISHDAN oldin turib
  // telefon suratlarini (3-8MB) bekorga rad etardi. Siqish baribir
  // rasmni ~50-150KB ga tushiradi.

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
      while (dataUrl.length > 150000 && q > 0.25);

      // UI yangilash
      if ($("ep-img-preview"))     { $("ep-img-preview").src = dataUrl; $("ep-img-preview").style.display = "block"; }
      if ($("ep-img-placeholder")) $("ep-img-placeholder").style.display = "none";
      if ($("ep-img-remove"))      $("ep-img-remove").style.display = "";
      if ($("ep-image"))           $("ep-image").value = dataUrl;
      // 2026-07-31: fonda omborga yuklaymiz — saqlanganda havola ketadi
      if (typeof uploadImageToStorage === "function") {
        uploadImageToStorage(dataUrl, editSku || "tovar").then(url => {
          const el = $("ep-image");
          if (url && url !== dataUrl && el && el.value === dataUrl) el.value = url;
        }).catch(() => {});
      }

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
  const costRaw = getRawVal("ep-cost"); // v169
  // ep-cost input qiymati endi joriy valyuta rejimida (UZS bo'lsa to'g'ridan-to'g'ri so'm)
  const costUzs = (cur === "usd" || cur === "both") ? Math.round(costRaw * rate) : costRaw;
  // v168: xuddi apCostNote dagidek — SO'MGA aylantirib o'qiymiz
  const ulg     = (typeof readUlgAsUzs === "function") ? readUlgAsUzs("ep-ulgurji") : getRawVal("ep-ulgurji");
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

    // 2026-07-25: TANNARX HAR DOIM SO'MDA — tizim valyutasi qanday
    // bo'lishidan qat'i nazar. Narx so'mda qotadi, kurs ta'sir qilmaydi.
    lbl.textContent  = "Tannarx (so'm)";
    unit.textContent = "so'm";
    unit.style.color = "#888";
    if (inp) inp.step = "1000";
  });

  // v167: "Ulgurji narx" (sotuv narxi) yorlig'i ham — Tannarx bilan
  // BIR XIL izchillikda (both rejimi ham USD deb o'qiladi, mavjud
  // Tannarx konvensiyasiga mos). ICHKI SAQLASH baribir so'mda qoladi
  // (ulgurjiNarx maydoni o'zgarmaydi) — faqat kiritish/ko'rsatish
  // qatlami valyutaga moslashadi.
  ["ap-ulgurji-lbl", "ep-ulgurji-lbl"].forEach(id => {
    const lbl = $(id); if (!lbl) return;
    // 2026-07-25: sotuv narxi ham HAR DOIM SO'MDA kiritiladi
    lbl.textContent = "Sotuv narxi (so'm)";
  });
}

// v167: Ulgurji narx maydoni uchun aqlli input — SO'M rejimida
// vergul-guruhlab butun son (avvalgidek), USD/Both rejimida esa
// kasr songa ruxsat beruvchi (masalan 15.50) formatlashsiz kiritish.
function priceInputHandler(el) {
  // 2026-07-26: BARCHA narxlar SO'MDA kiritiladi — valyuta rejimidan
  // qat'i nazar. Bu funksiya endi faqat so'm formatlaydi (eski
  // chaqiruvlar uchun zaxira sifatida qoldirilgan).
  fmtInput(el);
  return;
  /* eski kod (o'chirilgan):
  const cur = db.settings?.priceCurrency || "uzs";
  if (cur === "usd" || cur === "both") {
    // 2026-07-20: USD rejimida ham MING AJRATGICHI (probel) qo'shamiz —
    // 34500 -> 34 500 (butun qismga), o'nlik (.5) saqlanadi.
    let clean = el.value.replace(/[^\d.]/g, "");
    // faqat bitta nuqtaga ruxsat (ikkinchisini olib tashlaymiz)
    const parts = clean.split(".");
    const intPart = parts[0] || "";
    const decPart = parts.length > 1 ? "." + parts.slice(1).join("").slice(0, 2) : "";
    const intFmt = intPart ? parseInt(intPart, 10).toLocaleString("ru-RU") : "";
    el.value = (intFmt || (decPart ? "0" : "")) + decPart;
    el.dataset.raw = intPart + (parts.length > 1 ? "." + parts.slice(1).join("") : "");
  } else {
    fmtInput(el);
  } */
}

// Ulgurji narxni (so'm/USD rejimidan qat'iy nazar) HAR DOIM to'g'ri
// SO'M qiymatiga aylantirib o'qiydi — ADD va EDIT uchun umumiy
function readUlgAsUzs(inputId) {
  // 2026-07-25: narx HAR DOIM SO'MDA kiritiladi — aylantirish yo'q
  return getRawVal(inputId);
}

// ================================================
// EXCEL / CSV IMPORT
// ================================================

let _importRows = [];
let _importRawText = "";   // 2026-07-25: valyuta o'zgarsa qayta o'qish uchun

function openKatalogImport() {
  // 2026-08-02: import oynasini ochish ham ruxsatga bog'liq
  if (typeof requireDo === "function" && !requireDo("katalog","import")) return;

  _importRows = [];
  const prev = $("import-preview"); if (prev) prev.style.display = "none";
  const res  = $("import-result");  if (res)  res.style.display  = "none";
  const btn  = $("import-confirm-btn"); if (btn) btn.disabled = true;
  if ($("import-file")) $("import-file").value = "";
  openModal("import");
}

// ── OVOZ+RASM TEZKOR KIRITISH (2026-07-08) ──────────────────────
// Pres/nakladnoysiz tovar uchun: rasm+ovoz Gemini'ga birga yuboriladi,
// natija MAVJUD "Yangi tovar" formasiga to'ldiriladi — bu forma va
// addProduct() funksiyasi BUTUNLAY o'zgarishsiz qoladi (xavfsizlik).
let _vcPhoto = null;      // { data, mimeType }
let _vcRecorder = null;
let _vcChunks = [];
let _vcCancelled = false;
let _vcAutoStopTimer = null;

// Telefon kamerasi rasmi (ko'pincha 3-8 MB) yuborishdan oldin
// kichraytirib siqamiz — aks holda server "so'rov juda katta" deb
// rad etadi va tahlil sekinlashadi (v157 tuzatishi)
function _vcCompressImage(file, maxSide) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        const scale = maxSide / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      resolve({ data: dataUrl.split(",")[1] || "", mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function vcOnPhoto(input) {
  const f = input.files?.[0];
  if (!f) return;
  const st = $("vc-photo-status");
  if (st) { st.textContent = "⏳ Rasm tayyorlanmoqda..."; st.style.color = "#6B7280"; }
  try {
    _vcPhoto = await _vcCompressImage(f, 1024);
    if (st) { st.textContent = "✅ Surat olindi"; st.style.color = "#059669"; }
    const btn = $("vc-mic-btn");
    if (btn) { btn.disabled = false; btn.style.background = "#DB2777"; btn.style.color = "#fff"; }
  } catch (e) {
    if (st) { st.textContent = "❌ Rasmni o'qib bo'lmadi"; st.style.color = "#DC2626"; }
  }
}

async function vcStartRec() {
  if ($("vc-mic-btn")?.disabled) return;
  try {
    _vcCancelled = false;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    _vcRecorder = new MediaRecorder(stream, { mimeType: mime });
    _vcChunks = [];
    _vcRecorder.ondataavailable = e => { if (e.data.size > 0) _vcChunks.push(e.data); };
    _vcRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (_vcCancelled) return;
      const blob = new Blob(_vcChunks, { type: mime });
      vcAnalyze(blob, mime);
    };
    _vcRecorder.start();
    const st = $("vc-status"); if (st) { st.textContent = "🔴 Yozilmoqda... (qo'yib yuboring)"; st.style.color = "#DC2626"; }
    // Xavfsizlik chegarasi: 25s dan keyin avtomatik to'xtaydi (juda katta
    // audio fayl hosil bo'lib qolmasin)
    clearTimeout(_vcAutoStopTimer);
    _vcAutoStopTimer = setTimeout(() => vcStopRec(), 25000);
  } catch (e) {
    const st = $("vc-status"); if (st) { st.textContent = "❌ Mikrofonga ruxsat berilmadi"; st.style.color = "#DC2626"; }
  }
}

function vcStopRec() {
  clearTimeout(_vcAutoStopTimer);
  if (_vcRecorder && _vcRecorder.state === "recording") _vcRecorder.stop();
}

function vcCancelIfRecording() {
  // Barmoq/sichqoncha tugmadan tashqariga chiqib ketsa — bekor qilamiz
  if (_vcRecorder && _vcRecorder.state === "recording") { _vcCancelled = true; _vcRecorder.stop(); }
}

function _vcBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function vcAnalyze(blob, mime) {
  const st = $("vc-status");
  if (st) { st.textContent = "⏳ AI tahlil qilmoqda..."; st.style.color = "#6B7280"; }
  try {
    const audioB64 = await _vcBlobToBase64(blob);
    const res = await fetch("/api/naklad?action=capture_item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: _vcPhoto,
        audio: { data: audioB64, mimeType: mime },
      }),
    });
    let data;
    try { data = await res.json(); }
    catch (e) {
      // Server JSON qaytarmadi — odatda "so'rov juda katta" degani
      throw new Error(res.status === 413
        ? "Ma'lumot hajmi katta — qisqaroq gapirib, qayta urinib ko'ring"
        : `Server xatosi (${res.status})`);
    }
    if (!data.ok) throw new Error(data.error || "Noma'lum xato");
    vcFillAddProductForm(data.item);
  } catch (e) {
    if (st) { st.textContent = "❌ Xato: " + e.message; st.style.color = "#DC2626"; }
  }
}

// Natijani MAVJUD "Yangi tovar" formasiga to'ldiradi — saqlash tugmasi
// va addProduct() funksiyasi butunlay o'zgarishsiz ishlatiladi
function vcFillAddProductForm(item) {
  closeModal("voice-cap");
  openModal("addprod");

  // v158: olingan surat mahsulot rasmi sifatida ham to'ldiriladi
  // (avval faqat matn maydonlari to'ldirilar, rasm o'tkazib yuborilardi)
  if (_vcPhoto && _vcPhoto.data) {
    const dataUrl = `data:${_vcPhoto.mimeType};base64,${_vcPhoto.data}`;
    apPendingImage = dataUrl;
    const prev = $("ap-img-preview");
    if (prev) prev.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
    const rmBtn = $("ap-img-remove-btn");
    if (rmBtn) rmBtn.style.display = "";
    // 🔴 544 (2026-08-22): "Ovoz+Rasm" yo'li ham darhol yuklaydi.
    // Bu yo'l suratni faqat ekranga qo'yardi va Storage'ga
    // yuklamasdi — boshqa yo'llar bilan bir xil nuqson.
    try {
      if (typeof uploadImageToStorage === "function") {
        uploadImageToStorage(dataUrl, "ovoz").then(url => {
          if (url && url !== dataUrl && apPendingImage === dataUrl)
            apPendingImage = url;
        }).catch(() => {});
      }
    } catch (e) {}
  }

  if ($("ap-name"))  $("ap-name").value  = item.nom || "";
  if ($("ap-art"))   $("ap-art").value   = item.artikul || "";
  if ($("ap-color")) $("ap-color").value = item.rang || "";
  if ($("ap-boxes")) $("ap-boxes").value = item.pochka_soni > 0 ? item.pochka_soni : 1;
  if ($("ap-inbox-calc")) $("ap-inbox-calc").value = item.birlik_soni > 0 ? item.birlik_soni : 1;
  // 2026-07-26: AI/ovoz orqali kiritishda ham JAMI DONA hisoblanadi.
  // AI "jami_dona" bergan bo'lsa u ustuvor (presdan kelgan tovar),
  // aks holda pochka × pochkada.
  if ($("ap-qty-range")) {
    const _b  = parseInt(item.pochka_soni) || 0;
    const _ib = parseInt(item.birlik_soni) || 1;
    const _d  = parseInt(item.jami_dona || item.dona) || 0;
    $("ap-qty-range").value = _d > 0 ? _d : (_b * _ib);
    try { apDonaChanged(); } catch(e) {}
  }

  const rate = db.settings?.rate || 12800;
  // 2026-07-26: tannarx HAR DOIM SO'MDA (AI ham so'mda beradi)
  if ($("ap-cost") && item.tannarx_som > 0) {
    $("ap-cost").value = item.tannarx_som;
    if (typeof fmtInput === "function") fmtInput($("ap-cost"));
  }
  if ($("ap-ulgurji") && item.sotuv_narxi_som > 0) {
    $("ap-ulgurji").value = fmt(item.sotuv_narxi_som);
    $("ap-ulgurji").dataset.raw = String(item.sotuv_narxi_som);
  }
  if (typeof apCalcBoxes === "function") apCalcBoxes();
  if (typeof apCostNote === "function") apCostNote();

  // Reset — keyingi safar modal ochilganda toza boshlansin
  // (mahsulot rasmini TOZALAMAYMIZ — u endi "Yangi tovar" formasining
  // o'z holati, foydalanuvchi shu yerda ko'rib-o'zgartiradi/saqlaydi)
  _vcPhoto = null;
  if ($("vc-photo")) $("vc-photo").value = "";
  if ($("vc-photo-status")) $("vc-photo-status").textContent = "";
  const btn = $("vc-mic-btn");
  if (btn) { btn.disabled = true; btn.style.background = "#E5E7EB"; btn.style.color = "#9CA3AF"; }
  if ($("vc-status")) $("vc-status").textContent = "";

  let hint = `✅ AI aniqladi: ${item.nom || "tovar"}`;
  if (item.izoh) hint += ` (${item.izoh})`;
  toast(hint + " — tekshirib, saqlang");
}

// ── AI-Naklad (2026-07): naklad rasmidan avtomatik shablon ─────
let _aiNkFiles = [];

function aiNkOnFiles(input) {
  _aiNkFiles = Array.from(input.files || []);
  const el = $("ai-nk-filelist");
  if (el) el.textContent = _aiNkFiles.length
    ? `${_aiNkFiles.length} ta rasm tanlandi`
    : "";
}

function _aiNkFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function aiNkAnalyze() {
  const statusEl = $("ai-nk-status");
  const btn = $("ai-nk-go-btn");
  const kurs = parseFloat(($("ai-nk-kurs")||{value:0}).value) || 0;
  const logistics = parseFloat(($("ai-nk-logistics")||{value:0}).value) || 0;

  if (!_aiNkFiles.length) { if (statusEl) { statusEl.textContent = "Kamida 1 ta rasm tanlang"; statusEl.style.color = "#DC2626"; } return; }
  if (kurs <= 0) { if (statusEl) { statusEl.textContent = "Kursni kiriting (masalan 1750)"; statusEl.style.color = "#DC2626"; } return; }

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> Tahlil qilinmoqda...'; }
  if (statusEl) { statusEl.textContent = "⏳ AI naklad rasmini o'qimoqda, biroz kuting..."; statusEl.style.color = "#6B7280"; }

  try {
    const images = [];
    for (const f of _aiNkFiles) {
      images.push({ data: await _aiNkFileToBase64(f), mimeType: f.type || "image/jpeg" });
    }
    const res = await fetch("/api/naklad?action=analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images, kurs, logistics }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Noma'lum xato");

    // Natijani MAVJUD import parserining o'ziga uzatamiz — bir xil
    // ko'rib chiqish/tasdiqlash oynasidan foydalanish uchun
    // Import oynasi "Naklad rasmini yuklash" bosilganda YOPIB qo'yilgan edi
    // (openModal — bir vaqtda faqat bitta oyna ochiq turishini ta'minlaydi).
    // Shuning uchun shunchaki yopish emas, IMPORT oynasini qayta ochamiz —
    // bu ai-naklad'ni ham yopadi va foydalanuvchi natija jadvalini ko'radi.
    openModal("import");
    _aiNkFiles = [];
    if ($("ai-nk-files")) $("ai-nk-files").value = "";
    if ($("ai-nk-filelist")) $("ai-nk-filelist").textContent = "";
    parseImportCSV(data.csv);
    toast(`✅ AI ${data.count} ta tovarni aniqladi — tekshirib, importni tasdiqlang`);
  } catch (e) {
    if (statusEl) { statusEl.textContent = "❌ Xato: " + e.message; statusEl.style.color = "#DC2626"; }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-sparkles"></i> Aniqlash'; }
  }
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
  // v145: "O'lcham" va "1 pochkada nechta" ALOHIDA yoqiladi —
  // ko'p do'konlarga o'lchamdan ko'ra pochkadagi soni muhimroq
  if (fields.sizerange) {
    headers.push("O'lcham");
    sampleBase.push("39-44"); sampleBase2.push("39-44"); sampleBase3.push("S-XL");
  }
  if (fields.sizerange || fields.inbox) {
    headers.push("1 pochkada nechta");
    sampleBase.push("6"); sampleBase2.push("6"); sampleBase3.push("4");
  }

  headers.push("Pochka soni");
  sampleBase.push("100"); sampleBase2.push("80"); sampleBase3.push("50");

  // 2026-07-26: JAMI DONA ustuni — presdan kelgan tovar uchun.
  // Ikkala usul ham ishlaydi:
  //   Pochka soni to'ldirilsa → dona avtomat (pochka × pochkada)
  //   Jami dona to'ldirilsa   → pochka va ochilgan qoldiq avtomat
  //                             (153 dona, pochkada 5 → 30 pochka + 3 dona)
  headers.push("Jami dona");
  sampleBase.push(""); sampleBase2.push(""); sampleBase3.push("153");

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
  _importRawText = text;   // valyuta almashsa shu matndan qayta o'qiladi
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
      qty:     ["jami dona","qoldiq","qoldiq (dona)","qty","miqdor","soni","dona","jami"],
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
        barcodeMap[bKey] = yangiBarcode();   // 550
      }
      barcode = barcodeMap[bKey];
    }
    // colorBarcode — bu rang uchun barcode (keyinroq ishlatiladi)
    const colorBarcode = barcode;

    // Pochka soni (har bir o'lchamga bir xil son beriladi)
    const boxesVal = cols.boxes >= 0 ? (parseInt(vals[cols.boxes]) || 0) : 0;
    // 2026-07-26: JAMI DONA yozilgan bo'lsa pochka soni BO'SH bo'lishi
    // mumkin (presdan kelgan tovar: 153 dona, pochkada 5). Avval bunday
    // qator butunlay o'tkazib yuborilardi.
    const _qtyRaw = cols.qty >= 0
      ? (parseInt(String(vals[cols.qty] || "").replace(/[\s,]/g,"")) || 0) : 0;
    if (boxesVal <= 0 && _qtyRaw <= 0) { return; } // ikkalasi ham bo'sh — o'tkazamiz

    // 2026-07-25 (№11): VALYUTA TAXMIN QILINMAYDI.
    // Avval "1000 dan katta bo'lsa so'm" degan taxmin bor edi — qimmat
    // USD tovar ($1200) so'm deb o'qilib, narx 13000 barobar buzilardi.
    // Endi foydalanuvchi oynada aniq tanlaydi; qatordagi "$" ustuvor.
    const rate = db.settings?.rate || 12800;
    // 2026-07-25: import HAR DOIM SO'MDA — valyuta tanlovi olib tashlandi
    const _impCur = "uzs";

    const _toUsd = (raw) => {
      const txt = String(raw || "").trim();
      if (!txt) return 0;
      const hasDollar = txt.startsWith("$");
      const num = parseFloat(txt.replace(/[$\s,]/g,"")) || 0;
      if (num <= 0) return 0;
      // "$" bo'lsa — qator darajasida USD (tanlovdan ustun)
      if (hasDollar) return num;
      return _impCur === "usd" ? num : (rate > 0 ? num / rate : 0);
    };
    const _toUzs = (raw) => {
      const txt = String(raw || "").trim();
      if (!txt) return 0;
      const hasDollar = txt.startsWith("$");
      const num = parseFloat(txt.replace(/[$\s,]/g,"")) || 0;
      if (num <= 0) return 0;
      if (hasDollar) return Math.round(num * rate);
      return _impCur === "usd" ? Math.round(num * rate) : num;
    };

    const costRaw = cols.cost >= 0 ? (vals[cols.cost] || "0") : "0";
    const costUsd = _toUsd(costRaw);

    // Ulgurji narx SO'MDA saqlanadi — avval valyuta umuman tekshirilmasdi
    const ulgVal = cols.ulg >= 0 ? _toUzs(vals[cols.ulg] || "0") : 0;
    const typeVal = cols.type >= 0 ? (vals[cols.type]?.trim() || "oyoq") : "oyoq";
    const catVal  = cols.cat  >= 0 ? (vals[cols.cat]?.trim()  || "Qabul qilingan") : "Qabul qilingan";
    const unitVal = normalizeUnit(cols.unit >= 0 ? vals[cols.unit] : ""); // №11a: ro'yxatda yo'q -> dona

    // B2 (v148): O'lcham — faqat TAVSIF MATNI, qator o'lchamlarga
    // YOYILMAYDI. Jami dona = pochka soni × 1 pochkada nechta.
    const sizeRaw = cols.size >= 0 ? (vals[cols.size]?.trim() || "") : "";

    // 1 pochkada nechta: ustunda berilgani USTUVOR; bo'lmasa o'lcham
    // matnidan taxmin qilinadi (masalan 39-44 → 6), u ham bo'lmasa 1
    const _inboxGiven = cols.inbox >= 0 && parseInt(vals[cols.inbox]) > 0;
    let autoIn = 1;
    const rangeMatch = sizeRaw.match(/^(.+?)\s*[-–]\s*(.+)$/);
    if (rangeMatch) {
      const allSizes = SIZES[typeVal] || [];
      const iF = allSizes.indexOf(rangeMatch[1].trim()), iT = allSizes.indexOf(rangeMatch[2].trim());
      if (iF !== -1 && iT !== -1 && iF <= iT) autoIn = iT - iF + 1;
    }
    const inboxVal = _inboxGiven ? parseInt(vals[cols.inbox]) : autoIn;

    // 2026-07-26: faylda JAMI DONA ustuni bo'lsa u USTUVOR — tizim
    // pochka va ochilgan qoldiqni o'zi ajratadi (153 dona, pochkada 5
    // → 30 pochka + 3 dona ochilgan). Bo'lmasa pochka × pochkada.
    const _qtyVal = _qtyRaw > 0 ? _qtyRaw : (boxesVal * inboxVal);
    const _boxesCalc = (inboxVal > 0) ? Math.floor(_qtyVal / inboxVal) : boxesVal;

    _importRows.push({
      nom, cat: catVal, type: typeVal, unit: unitVal,
      inbox: inboxVal, _inboxExplicit: true, boxes: _boxesCalc || boxesVal || null,
      art, barcode, color: colorRaw, pantone, hex,
      size: sizeRaw || "-", qty: _qtyVal, costUsd, ulg: ulgVal,
    });
  }

  showImportPreview();
}

// ── Preview ───────────────────────────────────────
// v154: qator ichidagi bitta maydonni yangilash (matn maydonlari uchun)
function impSetField(i, field, value) {
  if (_importRows[i]) _importRows[i][field] = value;
}

// v154: Pochka soni / 1 pochkada o'zgarsa — Jami dona qayta hisoblanadi
function impRecalcQty(i) {
  const r = _importRows[i]; if (!r) return;
  const boxes = parseInt(($("imp-boxes-"+i)||{value:0}).value) || 0;
  const inbox = parseInt(($("imp-inbox-"+i)||{value:0}).value) || 0;
  r.boxes = boxes || null;
  r.inbox = inbox || 1;
  r._inboxExplicit = true;
  r.qty = boxes * (inbox || 0);
  _impShowQty(i, r);
}

// 2026-07-26: preview'da ochilgan qoldiq ham ko'rinsin
function _impShowQty(i, r) {
  const hint = $("imp-qty-"+i);
  const inp  = $("imp-dona-"+i);
  if (inp && String(inp.value) !== String(r.qty)) inp.value = r.qty || "";
  if (!hint) return;
  const inbox = r.inbox || 1;
  const rest  = (inbox > 1 && r.qty > 0) ? (r.qty % inbox) : 0;
  const full  = (inbox > 1) ? Math.floor(r.qty / inbox) : r.qty;
  hint.innerHTML = (inbox > 1 && r.qty > 0)
    ? `${full} pch${rest > 0 ? ` <span style="color:#B45309">+ ${rest} dona</span>` : ""}`
    : "";
}

// Preview'da JAMI DONA yozilganda pochka qayta hisoblanadi (2026-07-26)
function impDonaChanged(i) {
  const r = _importRows[i]; if (!r) return;
  const dona = parseInt(($("imp-dona-"+i)||{value:0}).value) || 0;
  const inbox = r.inbox || 1;
  r.qty = dona;
  r.boxes = (inbox > 0) ? Math.floor(dona / inbox) : dona;
  const bEl = $("imp-boxes-"+i);
  if (bEl) bEl.value = r.boxes;
  _impShowQty(i, r);
}

// v154: Tannarx (so'm ko'rinishida tahrirlanadi, ichida costUsd saqlanadi)
function impSetCost(i, inputEl) {
  fmtInput(inputEl);
  const rate = db.settings?.rate || 12800;
  const som = parseInt(inputEl.dataset.raw) || 0;
  if (_importRows[i]) _importRows[i].costUsd = som / rate;
}

// v154: Sotuv (ulgurji) narxi — to'g'ridan-to'g'ri so'mda saqlanadi
function impSetUlg(i, inputEl) {
  fmtInput(inputEl);
  if (_importRows[i]) _importRows[i].ulg = parseInt(inputEl.dataset.raw) || 0;
}

function showImportPreview() {
  if (!_importRows.length) { toast("Qatorlar topilmadi","err"); return; }

  const prev = $("import-preview"); if (prev) prev.style.display = "block";
  const lbl  = $("import-preview-lbl");
  if (lbl) lbl.textContent = `${_importRows.length} ta qator — har birini tekshiring, xato bo'lsa ustiga bosib tuzating:`;
  const rate = db.settings?.rate || 12800;

  const head = $("import-preview-head");
  if (head) head.innerHTML = `<tr>${["Nom","ART","Rang","O'lcham","Pochka","1 pochkada","Jami dona","Tannarx (so'm)","Sotuv narxi (so'm)"].map(h =>
    `<th style="padding:6px 8px;font-weight:700;text-align:left;white-space:nowrap">${h}</th>`).join("")}</tr>`;

  const inpCss = "width:100%;min-width:70px;border:1px solid var(--brd);border-radius:6px;padding:4px 6px;font-size:12px;font-family:inherit";

  const body = $("import-preview-body");
  if (body) body.innerHTML = _importRows.map((r,i) => `<tr>
    <td style="padding:4px;border-top:1px solid var(--brd)">
      <input value="${(r.nom||"").replace(/"/g,'&quot;')}" style="${inpCss};min-width:100px;font-weight:600"
        oninput="impSetField(${i},'nom',this.value)">
    </td>
    <td style="padding:4px;border-top:1px solid var(--brd)">
      <input value="${(r.art||"").replace(/"/g,'&quot;')}" style="${inpCss};min-width:60px;font-family:monospace"
        oninput="impSetField(${i},'art',this.value)">
    </td>
    <td style="padding:4px;border-top:1px solid var(--brd)">
      <div style="display:flex;align-items:center;gap:5px">
        <div style="width:12px;height:12px;border-radius:3px;background:${r.hex||'#888'};border:1px solid rgba(0,0,0,.15);flex-shrink:0"></div>
        <input value="${(r.color||"").replace(/"/g,'&quot;')}" style="${inpCss};min-width:60px"
          oninput="impSetField(${i},'color',this.value)">
      </div>
    </td>
    <td style="padding:4px;border-top:1px solid var(--brd)">
      <input value="${(r.size||"").replace(/"/g,'&quot;')}" style="${inpCss};min-width:55px"
        oninput="impSetField(${i},'size',this.value)">
    </td>
    <td style="padding:4px;border-top:1px solid var(--brd)">
      <input id="imp-boxes-${i}" type="number" value="${r.boxes||''}" style="${inpCss};min-width:50px"
        oninput="impRecalcQty(${i})">
    </td>
    <td style="padding:4px;border-top:1px solid var(--brd)">
      <input id="imp-inbox-${i}" type="number" value="${r.inbox||1}" style="${inpCss};min-width:50px"
        oninput="impRecalcQty(${i})">
    </td>
    <td style="padding:4px;border-top:1px solid var(--brd)">
      <!-- 2026-07-26: JAMI DONA tahrirlanadi — yozilsa pochka va
           ochilgan qoldiq avtomat qayta hisoblanadi -->
      <input id="imp-dona-${i}" type="number" min="0" value="${r.qty || ""}"
        style="${inpCss};min-width:60px" oninput="impDonaChanged(${i})">
      <div id="imp-qty-${i}" style="font-size:10.5px;color:var(--mut);margin-top:2px"></div>
    </td>
    <td style="padding:4px;border-top:1px solid var(--brd)">
      <input data-price value="${fmt(Math.round((r.costUsd||0)*rate))}" style="${inpCss};min-width:80px"
        oninput="impSetCost(${i},this)">
    </td>
    <td style="padding:4px;border-top:1px solid var(--brd)">
      <input data-price value="${fmt(r.ulg||0)}" style="${inpCss};min-width:90px;border-color:#059669"
        oninput="impSetUlg(${i},this)">
    </td>
  </tr>`).join("");

  const btn = $("import-confirm-btn");
  if (btn) btn.disabled = false;
}

// ── Import tasdiqlash ─────────────────────────────
async function confirmImport() { return _katGuard(_confirmImportIchki); }   // ✅ 2026-08-19: qulf
async function _confirmImportIchki() {   // ✅ 2026-08-18: SKU zaxirasi serverdan
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("katalog","import")) return;

  if (typeof requireUse === "function" && !requireUse("katalog")) return;

  if (!_importRows.length) return;
  // 2026-07-26: butun import uchun YAGONA vaqt muhri — aks holda har
  // tovarga o'z millisekundi tushib, "yangi birinchi" tartibi Excel
  // qatorlarini TESKARI qilib qo'yardi.
  const _impStamp = new Date().toISOString();
  console.log("📥 Import boshlandi:", _importRows.map(r =>
    `${r.nom}/${r.color}: ${r.qty} dona, pochkada ${r.inbox}`).join(" | "));
  const skipDup = $("import-skip-dup")?.checked ?? true;
  const rate    = db.settings?.rate || 12800;

  let added = 0, updated = 0, skipped = 0;
  const _impYangilar = [];   // ✅ 2026-08-19: serverga to'plamli yuboriladi

  // ✅ 2026-08-18 (3-teshik yakuni): IMPORT RAQAMLARI SERVERDAN.
  // Avval `IMP-0001` lokal sanoqdan berilardi — ikki kassa bir vaqtda
  // import qilsa raqamlar ustma-ust tushib, push birini ikkinchisi
  // bilan bosardi (tovar va qoldiq jimgina yo'qolardi).
  // Kerakli miqdor BIR chaqiruvda olinadi (server 200 tagacha beradi);
  // yetmasa yoki aloqa bo'lmasa lokal sanoq zaxira bo'lib qoladi.
  let _impSku = [];
  try {
    const _yangiCh = _importRows.length;
    if (_yangiCh > 0 && typeof _serverRejimi === "function" && _serverRejimi() &&
        typeof _serverPay === "function") {
      const _r = await _serverPay({ action: "next_sku", prefix: "IMP",
                                    count: Math.min(_yangiCh, 200) });
      if (_r && _r.ok && Array.isArray(_r.skus)) {
        const _band = new Set((db.products || []).map(x => String(x.sku || "")));
        _impSku = _r.skus.filter(x => !_band.has(x));
      }
    }
  } catch (e) { console.warn("[import] SKU zaxirasi olinmadi:", e.message); }

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
    // B1 (v152): har rang = alohida tovar, ARTIKUL ham hisobga olinadi.
    // Nom+rang mos kelib, ARTIKUL boshqa bo'lsa — boshqa tovar (xitoy
    // nakladnoylarida bir xil rang, har xil kod holati uchun tuzatildi).
    // Eski "artikulni e'tiborsiz qoldiruvchi" zaxira qidiruv OLIB TASHLANDI.
    const _colorMatch = x => (x.variants || []).some(v =>
      (v.color || "").toLowerCase() === (r.color || "").toLowerCase());
    let p = db.products.find(x =>
      x.name.toLowerCase() === r.nom.toLowerCase() &&
      _colorMatch(x) &&
      (r.art ? (x.art||"").toLowerCase() === r.art.toLowerCase() : !(x.art||"").trim())
    );

    // 2026-07-26: quti sig'imi VARIANTGA ham yoziladi — bitta tovarning
    // turli ranglari har xil pochkada kelishi mumkin (qora 5, oq 6, ko'k 7)
    const variant = { color: r.color, size: r.size, qty: r.qty,
      inBox: parseInt(r.inbox) || 1,
      pantone: r.pantone, hex: r.hex || "#888888" };

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
        colorBarcode = yangiBarcode();   // 550
      }
    }

    if (p) {
      // 2026-07-26: faylda "1 pochkada nechta" ANIQ berilgan bo'lsa,
      // mavjud tovarning quti sig'imi ham YANGILANADI. Avval eski qiymat
      // qolib, dona/pochka hisobi noto'g'ri chiqardi (153 dona pochkada 5
      // yozilsa ham eski inBox=7 ishlatilardi).
      // 2026-07-26: p.inBox BOSIB YOZILMAYDI — har rang o'z quti
      // sig'imini variantda saqlaydi (avval oxirgi qator hammasiga
      // qo'llanib, 153/5 o'rniga 153/7 hisoblanardi)
      // Mavjud mahsulotga variant qo'shish
      const ex = p.variants.find(v =>
        v.color.toLowerCase() === r.color.toLowerCase() &&
        v.size === r.size
      );
      if (ex) {
        if (!skipDup) {
          ex.qty += r.qty; updated++;
          // ✅ 2026-08-18: mavjud tovarga IMPORT KIRIMI ham serverga —
          // aks holda 477-himoyasi kirimni server nusxasi bilan
          // qaytarib yuborardi (import jimgina yo'qolardi).
          if (typeof _serverStock === "function")
            _serverStock(p, ex.color || "", ex.size || "", Number(r.qty) || 0);
        }
        else skipped++;
        // Mavjud variant uchun ham colorBarcodes to'ldiramiz
        if (!p.colorBarcodes) p.colorBarcodes = {};
        if (colorBarcode && !p.colorBarcodes[colorRaw]) {
          p.colorBarcodes[colorRaw] = colorBarcode;
        }
      } else {
        p.variants.push(variant);
        if (r.art && !p.art)   p.art         = r.art;
        if (r.costUsd > 0) {
          p.costUsd = r.costUsd;
          p.costUzs = Math.round(r.costUsd * (db.settings?.rate || 12800));
        }
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
      // ⚠️ 2026-08-04: SKU SANOQDAN, id esa `nextId()` dan.
      // Avval ikkalasi bir manbadan edi — `nextId()` vaqt muhri
      // qaytargach SKU "IMP-1785848660110" bo'lib ketardi.
      // 🔴 552: zaxira SKU ga QURILMA HARFI — `IMP-0001-DY`. Sanoq lokal,
      // ikki kassa bir vaqtda import qilsa bir xil SKU chiqardi; bulutda
      // noyoblik (sku, shop_id) — biri ikkinchisini BOSIB ketardi.
      // Raqam avvalgidek sanoqdan (2026-08-04 qarori kuchda).
      const newProdId = nextId();
      // ✅ 2026-08-18: avval SERVER zaxirasidan, tugasa lokal sanoqdan
      let sku = _impSku.shift();
      if (!sku) sku = `IMP-${String(db.seq++).padStart(4,"0")}` +
                      ((typeof _devCode === "function") ? "-" + _devCode() : "");
      const _bc = colorBarcode || r.barcode || yangiBarcode();   // 550
      const newProd = {
        id: newProdId,
        sku,
        name:        r.nom,
        category:    r.cat || "Qabul qilingan",
        type:        r.type === "kiyim" ? "kiyim" : "oyoq",
        unit:        r.unit || "dona",
        inBox:       parseInt(r.inbox) || 1,
        art:         r.art || "",
        barcode:     _bc,
        colorBarcodes: { [colorRaw]: _bc },
        // 2026-07-25: tannarx so'mda muzlaydi
        costUzs:     Math.round((r.costUsd || 0) * (db.settings?.rate || 12800)),
        costUsd:     r.costUsd || 0,
        priceUzs:    0,
        ulgurjiNarx: r.ulg || 0,
        createdAt:   _impStamp,
        variants:    [variant]
      };
      db.products.push(newProd);
      try { newProd.updatedAt = new Date().toISOString();
            _impYangilar.push(newProd); } catch (e) {}   // ✅ 2026-08-19
      try {
        auditLog("yaratish", "product", newProd.sku, newProd.name,
          { after: "import", note: "Excel/AI import" });
      } catch (e) {}
      p = newProd;
      added++;
    }

    // Ombor kirim yozuvi (har bir qator uchun)
    if (r.qty > 0) {
      db.ombor.push({
        id:          nextId(),
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
  // v146: fayldagi "1 pochkada nechta" USTUVOR — avtomat hisob uni
  // bosib yozmaydi. Fayl ustun bermagan bo'lsagina avtomat ishlaydi.
  const explicitInbox = new Map();
  _importRows.forEach(r => {
    if (r._inboxExplicit) explicitInbox.set(r.nom.toLowerCase(), r.inbox);
  });
  touchedSkus.forEach(sku => {
    const pp = db.products.find(x => x.sku === sku); if (!pp) return;
    const exp = explicitInbox.get(pp.name.toLowerCase());
    if (exp) { pp.inBox = exp; return; }
    const colors = [...new Set(pp.variants.map(v => v.color))];
    let maxSizes = 1;
    colors.forEach(c => {
      const cnt = pp.variants.filter(v => v.color === c).length;
      if (cnt > maxSizes) maxSizes = cnt;
    });
    pp.inBox = maxSizes;
  });

  // ═══════════════════════════════════════════════════════════
  // ✅ 2026-08-19: IMPORT QILINGAN TOVARLAR SERVERGA (to'plamli)
  // ═══════════════════════════════════════════════════════════
  // Har tovar uchun alohida so'rov yuborilsa 100 ta tovar = 100 marta
  // kutish. Shuning uchun BITTA so'rovda (200 tadan bo'lib) yuboriladi.
  // Aloqa yo'q bo'lsa eski yo'l: lokal + push (ish to'xtamaydi).
  if (typeof serverSaveBulkProducts === "function" && _impYangilar.length) {
    try {
      const _r = await serverSaveBulkProducts(_impYangilar);
      if (_r && _r.ok) {
        console.log("📤 Import: " + _r.soni + " tovar serverga yozildi");
        // 🔴 546 (3.33): SERVER MUHRI (va id) QABUL QILINADI.
        // 531 yordamchini qatorlarni qaytaradigan qilgan edi, lekin BU
        // chaqiruvchi ularni tashlab yuborardi — lokalda qurilma muhri
        // qolib, keyingi tahrirda YAKKA qurilmada ham soxta "boshqa
        // kassa yangiladi" chiqishi mumkin edi (531 dagi sinf, import
        // yo'lida chala qolgani).
        try {
          if (Array.isArray(_r.rows) && _r.rows.length) {
            const _bySku = new Map(_r.rows.map(x => [String(x.sku), x]));
            _impYangilar.forEach(lp => {
              const sr = _bySku.get(String(lp.sku));
              if (!sr) return;
              if (sr.id != null) lp.id = sr.id;
              const _sm = sr.data && sr.data.updatedAt;
              if (_sm) lp.updatedAt = _sm;
            });
          }
        } catch (e) {}
      }
      else
        console.warn("📤 Import serverga yozilmadi — lokal saqlandi, push bilan ketadi");
    } catch (e) { console.warn("[import] server:", e.message); }
  }
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
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("katalog","narxnoma")) return;

  _narxnomaSelected.clear();
  openModal("narxnoma");
  // ⚠️ 2026-08-09: KIRGANDA DOIM BIR XIL STANDART TANLOV.
  // Ulgurji do'kon uchun asosiy to'plam: Nomi + Rang + Barcode + Ulgurji
  // narx. Qolganlari o'chiq (oldin "Chakana + USD + O'lcham" yoqig'liq
  // kelardi — chakana ko'pincha 0 bo'lgani uchun chalg'itardi).
  // DOM'da oldingi ochilishdagi belgilar saqlanib qolgani uchun
  // har ochilishda MAJBURIY qayta o'rnatiladi.
  const _nmDef = { "nm-logo":false, "nm-name":true, "nm-color":true,
    "nm-size":false, "nm-price":false, "nm-usd":false, "nm-cat":false,
    "nm-art":false, "nm-barcode-chk":true, "nm-sku":false,
    "nm-ulg":true, "nm-by-pochka":false };
  Object.keys(_nmDef).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = _nmDef[id];
  });
  setTimeout(() => {
    // 2026-07-25: standart o'lcham (58x40) uchun ustunlar bloklanadi
    if (typeof nmPaperChange === "function") nmPaperChange();
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
       || (p.art||"").toLowerCase().includes(q) // 2026-07-20 (№5): art bo'yicha ham
       // 2026-07-25: BARCODE bo'yicha ham (skanerlab yorliq chiqarish uchun)
       || (p.barcode && String(p.barcode).toLowerCase().includes(q))
       || (p.colorBarcodes && Object.values(p.colorBarcodes).some(bc =>
            bc && String(bc).toLowerCase().includes(q)))
  );
  // ⚠️ 2026-08-02: TARTIB KATALOGDAGIDEK — YANGI TEPADA.
  // Avval tartib `db.products` dagi tabiiy tartibda edi va katalogdan
  // farq qilardi: endigina kiritilgan tovarni topish uchun ro'yxatni
  // aylantirish kerak bo'lardi.
  // Qoida katalogdan olindi (yagona manba): `createdAt` bo'yicha,
  // bo'lmasa SKU ichidagi ketma-ket raqam bo'yicha (SKU har doim
  // oshib boruvchi tartibda yaratiladi).
  const _nmKey = (p) => p.createdAt
    ? String(p.createdAt)
    : String(parseInt((p.sku||"").match(/\d+/g)?.pop()) || 0).padStart(14, "0");
  ps.sort((a, b) => _nmKey(b).localeCompare(_nmKey(a)));

  // 2026-07-25: ro'yxat RANG darajasida — etiketka ham rang bo'yicha
  // chiqadi. Qoldig'i 0 bo'lganlar KO'RSATILMAYDI (chop etish ma'nosiz).
  const rows = [];
  ps.forEach(p => {
    [...new Set(p.variants.map(v => v.color).filter(Boolean))].forEach(color => {
      const vars = p.variants.filter(v => v.color === color);
      const dona = vars.reduce((a, v) => a + (v.qty || 0), 0);
      if (dona <= 0) return;                       // nol qoldiq — chiqmaydi
      const pi = (typeof packInfo === "function") ? packInfo(p, vars) : {maxPochka:0};
      rows.push({ p, color, dona, pochka: pi.maxPochka || 0, sizes: vars.length });
    });
  });

  el.innerHTML = rows.map(({p, color, dona, pochka, sizes}) => {
    const key = p.sku + "::" + color;
    const sel = _narxnomaSelected.has(key);
    const art = p.art ? ` <span style="color:var(--mut)">${p.art}</span>` : "";
    const parts = [];
    if (pochka > 0) parts.push(`<b>${pochka}</b> pochka`);
    parts.push(`<b>${dona}</b> dona`);
    if (sizes > 1) parts.push(`${sizes} o'lcham`);
    return `<label class="nm-prod-item ${sel?"nm-sel":""}" onclick="toggleNmProd('${jsEsc(key)}')">
      <div class="nm-check">${sel?"✓":""}</div>
      <div class="nm-prod-info">
        <div class="nm-prod-name">${p.name}${art}</div>
        <div class="nm-prod-meta">
          <span style="font-weight:700;color:#0D1B2A">${color}</span> ·
          ${parts.join(" · ")} · ${fmt(p.priceUzs || p.ulgurjiNarx || 0)} so'm
        </div>
      </div>
    </label>`;
  }).join("") || `<div style="text-align:center;padding:20px;color:var(--mut)">
      Qoldiqli mahsulot yo'q</div>`;
  updateNmCount();
}

function toggleNmProd(sku) {
  if (_narxnomaSelected.has(sku)) {
    _narxnomaSelected.delete(sku);
  } else {
    _narxnomaSelected.add(sku);
    // ⚠️ 2026-08-09: "Tovar (barcha ranglar)" yoqiq bo'lsa — bitta rang
    // tanlanganda shu tovarning QOLDIQLI barcha ranglari avtomat
    // qo'shiladi (har rangga 1 ta yorliq — pochkalarga yopishtirish
    // uchun). Olib tashlash esa donabay qoladi: keraksiz rangni
    // alohida bosib chiqarib tashlash mumkin.
    if (document.getElementById("nm-by-pochka")?.checked) {
      _nmAddAllColors(String(sku).split("::")[0]);
    }
  }
  renderNarxnomaList();
  renderNarxnomaPreview();
}

// Tovarning qoldig'i bor BARCHA ranglarini tanlovga qo'shadi.
// ⚠️ 2026-08-09 (2-tuzatish): birinchi urinish ranglarni faqat BITTA
// tovar yozuvining ichidan (p.variants) qidirardi. Lekin bu bazada
// HAR RANG KO'PINCHA ALOHIDA TOVAR (§3.2, B1 qarori: variativ rang
// alohida tovar bo'lib yaratiladi, nom va ARTIKUL asosiydan meros
// oladi). Ya'ni "shu tovarning boshqa ranglari" — ART'i BIR XIL
// bo'lgan qo'shni tovarlarda yashaydi. Endi guruh = o'zi + bir xil
// ART'li tovarlar (katta-kichik harf va bo'sh joy farqi e'tiborsiz).
// Nom bo'yicha birlashtirish ATAYLAB yo'q: §3.2 ogohlantiradi —
// bir xil nom 23 marta = 23 TURLI model bo'lishi mumkin (Billz).
// ART bo'sh bo'lsa — faqat tovarning o'z ichidagi ranglar olinadi.
function _nmAddAllColors(psku) {
  const p0 = (db.products || []).find(x => x.sku === psku);
  if (!p0) return;
  const art = String(p0.art || "").trim().toUpperCase();
  const group = (db.products || []).filter(x =>
    x.sku === p0.sku ||
    (art && String(x.art || "").trim().toUpperCase() === art));
  group.forEach(p => {
    [...new Set((p.variants || []).map(v => v.color).filter(Boolean))].forEach(color => {
      const dona = p.variants.filter(v => v.color === color)
                             .reduce((a, v) => a + (v.qty||0), 0);
      if (dona > 0) _narxnomaSelected.add(p.sku + "::" + color);
    });
  });
}

// "Tovar (barcha ranglar)" galochkasi bosilganda: yoqilsa — allaqachon
// tanlab qo'yilgan tovarlarning qolgan ranglari ham darhol qo'shiladi
function nmByPochkaChange() {
  if (document.getElementById("nm-by-pochka")?.checked) {
    const skus = [...new Set([..._narxnomaSelected]
      .map(k => String(k).split("::")[0]))];
    skus.forEach(_nmAddAllColors);
  }
  renderNarxnomaList();
  renderNarxnomaPreview();
}

function nmSelectAll() {
  // 2026-07-25: rang darajasida, faqat QOLDIQLI ranglar
  const q = (document.getElementById("nm-q")||{value:""}).value.toLowerCase();
  db.products.filter(p => !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku||"").toLowerCase().includes(q) ||
      (p.art||"").toLowerCase().includes(q))
    .forEach(p => {
      [...new Set(p.variants.map(v => v.color).filter(Boolean))].forEach(color => {
        const dona = p.variants.filter(v => v.color === color)
                               .reduce((a,v) => a + (v.qty||0), 0);
        if (dona > 0) _narxnomaSelected.add(p.sku + "::" + color);
      });
    });
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
  if (!el) return;
  const total = _narxnomaSelected.size;
  // 2026-07-24 (№8): qidiruvdan tashqarida qolgan tanlovlarni ham aytamiz —
  // aks holda "ro'yxatda yo'q, lekin preview'da bor" chalkashligi chiqadi
  const q = (document.getElementById("nm-q")||{value:""}).value.toLowerCase();
  let hidden = 0;
  if (q) {
    (db.products||[]).forEach(p => {
      const anySel = [..._narxnomaSelected]
        .some(k => String(k).split("::")[0] === p.sku);
      if (!anySel) return;
      const match = p.name.toLowerCase().includes(q) ||
        (p.sku||"").toLowerCase().includes(q) || (p.art||"").toLowerCase().includes(q);
      if (!match) hidden++;
    });
  }
  el.textContent = total + " ta tanlandi" +
    (hidden > 0 ? ` (${hidden} tasi qidiruvdan tashqarida)` : "");
}

function _nmOpts() {
  // 2026-07-20 (№6): barcha qator-tanlovlari yagona joyda o'qiladi
  const $c = id => document.getElementById(id);
  return {
    style:    $c("nm-style")?.value || "standard",
    paper:    $c("nm-paper")?.value || "a4",
    cols:     parseInt($c("nm-cols")?.value) || 3,
    showLogo: $c("nm-logo")?.checked || false,
    showName: $c("nm-name")?.checked !== false,
    showColor:$c("nm-color")?.checked !== false,
    // 2026-08-09: standart to'plam o'zgardi (ulgurji do'kon) —
    // zaxira qiymatlar ham yangi standartga tenglashtirildi:
    // O'lcham/Chakana/USD endi standartda O'CHIQ, Ulgurji — YOQIQ.
    showSize: $c("nm-size")?.checked || false,
    showPrice:$c("nm-price")?.checked || false,
    showUsd:  $c("nm-usd")?.checked || false,
    showCat:  $c("nm-cat")?.checked || false,
    showArt:  $c("nm-art")?.checked || false,
    showBarc: $c("nm-barcode-chk")?.checked !== false,
    showSku:  $c("nm-sku")?.checked || false,
    showUlg:  $c("nm-ulg")?.checked !== false,
    rate:     db.settings.rate || 12800,
    shopName: db.shop?.name || "MERX"
  };
}

// 2026-07-20 (№8): etiketka o'lchami tanlanganda ustunni 1 ga majburlaymiz
function nmPaperChange() {
  const paper = document.getElementById("nm-paper")?.value || "a4";
  const colsSel = document.getElementById("nm-cols");
  if (colsSel) colsSel.disabled = (paper !== "a4"); // etiketkada 1 ustun
}

function renderNarxnomaPreview() {
  const el = document.getElementById("nm-preview-area");
  if (!el) return;
  const o = _nmOpts();
  const cols = o.paper === "a4" ? o.cols : 1; // etiketka = 1 ustun

  // 2026-07-25: tanlov endi "sku::rang" ko'rinishida
  const prods = db.products.filter(p =>
    [..._narxnomaSelected].some(k => String(k).split("::")[0] === p.sku));
  if (!prods.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--mut)">
      <i class="ti ti-tag" style="font-size:32px;display:block;margin-bottom:10px;opacity:.4"></i>
      Chap tomondan mahsulot tanlang</div>`;
    return;
  }

  const labels = [];

  prods.forEach(p => {
    // Shu tovardan qaysi ranglar tanlangan
    const selColors = [..._narxnomaSelected]
      .filter(k => String(k).split("::")[0] === p.sku)
      .map(k => String(k).split("::")[1]);

    selColors.forEach(color => {
      const colorVars = p.variants.filter(v => v.color === color);
      if (!colorVars.length) return;
      const totalQty = colorVars.reduce((a, v) => a + (v.qty||0), 0);
      if (totalQty <= 0) return;
      // Barcode HAR DOIM rang darajasida (umumiy kod eskirgan)
      const barcode = (p.colorBarcodes && p.colorBarcodes[color]) || p.barcode;
      // ⚠️ 2026-08-09: HAR RANG = 1 YORLIQ, DOIM. Avval "Pochka barcode"
      // o'chiq bo'lsa har O'LCHAMGA alohida yorliq chiqardi — o'lchamdan
      // voz kechilganidan keyin (§3.2) bu bir xil shtrix-kodli TAKROR
      // yorliqlar edi. Rang darajasidan boshqa daraja qolmadi.
      labels.push({ p,
        v: {...colorVars[0], color,
            size: colorVars.length === 1 ? colorVars[0].size : ""},
        barcode });
    });
  });

  if (!labels.length) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:#E05A5A">Qoldiq yo'q (0 ta)</div>`;
    return;
  }

  // 2026-07-25: preview endi CHOP ETISH bilan bir xil o'lchamdan foydalanadi
  // (avval boshqa-boshqa sozlama edi — ekranda boshqa, qog'ozda boshqa chiqardi)
  // 2026-08-09: + dizayn (mini/premium) o'lchamlari ham shu yerda qo'llanadi
  const c = _nmStyleCfg(_nmSizeCfg(o.paper), o.style);
  const gridStyle = o.paper === "a4"
    ? `grid-template-columns:repeat(${cols},1fr)`
    : "grid-template-columns:1fr;justify-items:start";

  el.innerHTML = `<style>${_nmLabelCss(c)}</style>
  <div class="nm-label-grid" style="${gridStyle}">
    ${labels.map(({p, v, barcode}) => buildLabel(p, v, {...o, barcode})).join("")}
  </div>`;

  if (o.showBarc && typeof JsBarcode !== "undefined") {
    el.querySelectorAll(".nm-barcode-svg").forEach(svg => {
      const code = svg.dataset.code;
      if (!code) return;
      try {
        JsBarcode(svg, code, {
          format: "CODE128", width: c.barW, height: c.barH,
          displayValue: true, fontSize: c.barFont,
          // Tinch zona (CODE128 talabi) — faqat YON tomonlarda kerak.
          // ⚠️ 2026-08-09: avvalgi `margin` TO'RTALA tomonga tushib,
          // shtrix tepasida/pastida keraksiz bo'sh joy ochgan edi
          // (yorliqda joy tanqis). Endi: yon = 10 modul, tepa/past = 0.
          marginLeft: Math.round(c.barW * 10),
          marginRight: Math.round(c.barW * 10),
          marginTop: 0, marginBottom: 0,
          textMargin: c.thermal ? 1 : 2
        });
      } catch (e) { /* noto'g'ri format */ }
    });
  }
}

function buildLabel(p, v, opts) {
  const {style, showLogo, showName, showColor, showSize, showPrice, showUsd,
         showCat, showArt, showSku, showUlg, showBarc, shopName, rate} = opts;
  const hex       = v.hex || "#888";
  const colorDot  = `<span class="nm-color-dot" style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${hex};border:1px solid rgba(0,0,0,.12);vertical-align:middle;margin-right:4px"></span>`;

  // ⚠️ 2026-08-09: NARX QAT'IY QOIDA — QAYSI GALOCHKA, O'SHA NARX.
  // Avval "Chakana narx" belgilansa-yu chakana 0 bo'lsa (ulgurji
  // do'konda odatiy hol), yorliqqa JIMGINA ULGURJI narx chiqardi —
  // "Chakana" yozuvi ostida ulgurji ko'rsatilardi. "Ulgurji narx"
  // galochkasi esa faqat chakana>0 bo'lgandagina ishlardi (teskari
  // shart). Endi: chakana → faqat chakana, ulgurji → faqat ulgurji;
  // narx 0 bo'lsa o'sha qator umuman chiqmaydi (yolg'on chiqmaydi).
  const chakanaUzs = p.priceUzs || 0;
  const ulgUzs     = p.ulgurjiNarx || 0;
  const chakanaOn  = showPrice && chakanaUzs > 0;
  const ulgOn      = showUlg && ulgUzs > 0;
  // Katta (asosiy) qator: chakana yoqiq bo'lsa — chakana; bo'lmasa ulgurji
  const mainUzs    = chakanaOn ? chakanaUzs : (ulgOn ? ulgUzs : 0);
  // USD ham xuddi shu asosiy narxdan (avval fallback aralashmasidan edi)
  const priceUsd   = (mainUzs > 0 && rate > 0) ? (mainUzs / rate).toFixed(2) : "";
  // Ikkalasi ham yoqiq bo'lsa: katta qator = chakana, kichik qator = ulgurji
  const mainLine = mainUzs > 0 ? `<div class="nm-price-main">${fmt(mainUzs)} so'm</div>` : "";
  const ulgLine  = (chakanaOn && ulgOn) ? `<div class="nm-price-ulg">Ulgurji: ${fmt(ulgUzs)}</div>` : "";
  const usdLine  = (showUsd && priceUsd) ? `<div class="nm-price-usd">$${priceUsd}</div>` : "";

  const barcodeId = `bc-${p.sku}-${(v.color||"")}-${(v.size||"")}`.replace(/[^a-zA-Z0-9-]/g,"_");
  const useBarcode = opts.barcode || p.barcode || "";
  const barcodeHtml = showBarc && useBarcode
    ? `<div class="nm-barcode"><svg class="nm-barcode-svg" id="${barcodeId}" data-code="${useBarcode}"></svg></div>` : "";

  // Rang + o'lcham qatori (ikkalasi tanlovga bog'liq)
  const varParts = [];
  if (showColor && v.color) varParts.push(colorDot + v.color);
  // 2026-07-25 (№10): o'lcham belgilanmagan bo'lsa ("-" yoki bo'sh) —
  // yorliqda KO'RSATILMAYDI (avval "Yashil · -" bo'lib chalg'itardi)
  const _sz = String(v.size || "").trim();
  if (showSize && _sz && _sz !== "-") varParts.push((varParts.length?"· ":"") + _sz);
  const varLine = varParts.length ? varParts.join(" ") : "";

  if (style === "mini") return `
    <div class="nm-label nm-mini">
      ${barcodeHtml}
      <div class="nm-l-body">
        ${showLogo?`<div class="nm-shop">${shopName}</div>`:""}
        ${varLine?`<div class="nm-var-sm">${varLine}</div>`:""}
        ${showName?`<div class="nm-name-sm">${p.name}</div>`:""}
        ${showCat?`<div class="nm-var-sm">${p.category||""}</div>`:""}
        ${showArt&&p.art?`<div class="nm-sku">${p.art}</div>`:""}
        ${showSku?`<div class="nm-sku">${p.sku}</div>`:""}
        ${mainLine}
        ${ulgLine}
        ${usdLine}
      </div>
    </div>`;

  if (style === "premium") return `
    <div class="nm-label nm-premium">
      <div class="nm-prem-top">
        ${showLogo?`<div class="nm-prem-shop">${shopName}</div>`:""}
        ${showName?`<div class="nm-prem-name">${p.name}</div>`:""}
        ${showCat?`<div class="nm-prem-cat">${p.category||""}</div>`:""}
      </div>
      <div class="nm-prem-mid">
        ${varLine?`<div class="nm-prem-color">${varLine}</div>`:""}
        ${showArt&&p.art?`<div class="nm-prem-sku">${p.art}</div>`:""}
        ${showSku?`<div class="nm-prem-sku">${p.sku}</div>`:""}
      </div>
      ${barcodeHtml}
      <div class="nm-prem-bot">
        ${mainUzs>0?`<div class="nm-prem-price">${fmt(mainUzs)} <span>so'm</span></div>`:""}
        ${(chakanaOn&&ulgOn)?`<div class="nm-prem-ulg">Ulgurji: ${fmt(ulgUzs)} so'm</div>`:""}
        ${(showUsd&&priceUsd)?`<div class="nm-prem-usd">≈ $${priceUsd}</div>`:""}
      </div>
    </div>`;

  // 2026-07-25: tartib do'kon namunasiga moslashtirildi —
  // SHTRIX TEPADA (katta), ostida kod, keyin rang/nom, eng pastda narx.
  // Skaner uchun qulay: shtrix etiketkaning eng ko'rinadigan joyida.
  return `
    <div class="nm-label nm-standard">
      ${barcodeHtml}
      <div class="nm-l-body">
        ${showLogo?`<div class="nm-shop">${shopName}</div>`:""}
        ${varLine?`<div class="nm-var">${varLine}</div>`:""}
        ${showName?`<div class="nm-name">${p.name}</div>`:""}
        ${showCat?`<div class="nm-var">${p.category||""}</div>`:""}
        ${showArt&&p.art?`<div class="nm-sku">ART: ${p.art}</div>`:""}
        ${showSku?`<div class="nm-sku">${p.sku}</div>`:""}
        ${mainLine}
        ${ulgLine}
        ${usdLine}
      </div>
    </div>`;
}

function printNarxnoma() {
  const o = _nmOpts();
  const cols = o.paper === "a4" ? o.cols : 1;
  const shopName = o.shopName;

  const prods = db.products.filter(p =>
    [..._narxnomaSelected].some(k => String(k).split("::")[0] === p.sku));
  if (!prods.length) { toast("Mahsulot tanlang","err"); return; }

  const labels = [];

  // 2026-08-09: preview bilan AYNAN bir xil — HAR RANG = 1 YORLIQ, doim.
  // (Eski "har o'lchamga alohida" tarmog'i olib tashlandi — o'lchamdan
  // voz kechilgan, u bir xil kodli takror yorliqlar chiqarardi.)
  prods.forEach(p => {
    const selColors = [..._narxnomaSelected]
      .filter(k => String(k).split("::")[0] === p.sku)
      .map(k => String(k).split("::")[1]);

    selColors.forEach(color => {
      const colorVars = p.variants.filter(v => v.color === color);
      if (!colorVars.length) return;
      const totalQty = colorVars.reduce((a, v) => a + (v.qty||0), 0);
      if (totalQty <= 0) return;
      const barcode = (p.colorBarcodes && p.colorBarcodes[color]) || p.barcode;
      labels.push({ p,
        v: {...colorVars[0], color,
            size: colorVars.length === 1 ? colorVars[0].size : ""},
        barcode });
    });
  });

  const labelHtml = labels.map(({p,v,barcode}) =>
    buildLabel(p, v, {...o, barcode})
  ).join("");

  // 2026-07-25: o'lcham YAGONA manbadan (_nmSizeCfg) — preview bilan bir xil
  // 2026-08-09: + dizayn o'lchamlari (_nmStyleCfg) ham preview bilan bir xil
  const c = _nmStyleCfg(_nmSizeCfg(o.paper), o.style);
  const thermal = c.thermal;
  const barcodeH = c.barH;
  let pageCss, gridCss;
  if (o.paper === "40x30") {
    pageCss = "@page{margin:0;size:40mm 30mm}";
    gridCss = ".nm-label-grid{display:block}.nm-label{page-break-after:always;border:none !important}";
  } else if (o.paper === "58x40") {
    pageCss = "@page{margin:0;size:58mm 40mm}";
    gridCss = ".nm-label-grid{display:block}.nm-label{page-break-after:always;border:none !important}";
  } else {
    pageCss = "@page{margin:5mm;size:A4}";
    gridCss = `.nm-label-grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;padding:8px}
               .nm-label{border:1px solid #ddd;border-radius:4px}`;
  }

  const w = window.open("","_blank","width=900,height=700");
  if (!w) { toast("Pop-up bloklangan","err"); return; }

  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Narxnoma — ${shopName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;background:#fff}
${gridCss}
/* ═══ YAGONA ETIKETKA SHABLONI (2026-07-25) ═══
   Preview bilan AYNAN bir xil — _nmLabelCss() dan keladi */
${_nmLabelCss(c)}
/* 2026-08-09: mini/premium CSS'lari endi YAGONA manbada — _nmLabelCss(c).
   Avval shu yerda premium CSS IKKI nusxada takrorlanib yotardi (biri
   ikkinchisini bosardi), preview'da esa umuman yo'q edi. */
@media print{
  body{margin:0}
  ${pageCss}
  /* v182 — B&W termal/lazer/etiketka printer uchun */
  *{background:#fff !important;background-image:none !important;
    color:#000 !important;box-shadow:none !important;
    text-shadow:none !important}
  [style*="border"]{border-color:#000 !important}
}
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
        JsBarcode(svg, code, { format:"CODE128", width:${c.barW}, height:${c.barH}, displayValue:true, fontSize:${c.barFont}, textMargin:${c.thermal ? 1 : 2}, marginLeft:${Math.round(c.barW * 10)}, marginRight:${Math.round(c.barW * 10)}, marginTop:0, marginBottom:0 });
      } catch(e) {}
    });
  }
  setTimeout(() => window.print(), 400);
};
<\/script>
</body></html>`);
  w.document.close();

  // 2026-07-25: chop etilgach tanlov va qidiruv AVTOMAT tozalanadi —
  // keyingi tovarni qidirganda eskilari aralashib qolmasin
  try {
    _narxnomaSelected.clear();
    const qEl = document.getElementById("nm-q");
    if (qEl) qEl.value = "";
    renderNarxnomaList();
    renderNarxnomaPreview();
  } catch(e) {}

  toast("✅ Chop etish oynasi ochildi — tanlov tozalandi");
}

// ── Katalog jadvalidan rasm yuklash ──────────────
// v165: Kamera/Galereya tanlash oynasi orqali (avval faqat galereyaga
// yo'naltirardi, chunki mustaqil, capture atributisiz input yaratilgan
// edi — xuddi ombor.js dagi omImgClick bilan bir xil eski naqsh)
function katImgClick(sku, color) {
  const key = sku + "-" + (color || "_");
  let galInp = document.getElementById("kat-img-inp-" + key);
  if (!galInp) {
    galInp = document.createElement("input");
    galInp.type = "file";
    galInp.accept = "image/*";
    galInp.style.display = "none";
    galInp.id = "kat-img-inp-" + key;
    galInp.onchange = function() { katImgSave(sku, color, this); };
    document.body.appendChild(galInp);
  }
  let camInp = document.getElementById("kat-img-cam-" + key);
  if (!camInp) {
    camInp = document.createElement("input");
    camInp.type = "file";
    camInp.accept = "image/*";
    camInp.capture = "environment";
    camInp.style.display = "none";
    camInp.id = "kat-img-cam-" + key;
    camInp.onchange = function() { katImgSave(sku, color, this); };
    document.body.appendChild(camInp);
  }
  if (typeof imgSrcAsk === "function") imgSrcAsk(galInp.id, camInp.id);
  else galInp.click(); // zaxira yo'l
}

function katImgSave(sku, color, input) {
  // ✅ 2026-08-18 RUXSAT: bu yo'l OYNADAN TASHQARIDA (katalog
  // qatoridan to'g'ridan-to'g'ri) — alohida qulf shart.
  if (typeof requireDo === "function" && !requireDo("katalog","edit")) { if (input) input.value = ""; return; }
  const file = input.files[0]; if (!file) return;
  // 2026-07-10: 2MB darvozasi OLIB TASHLANDI — u pastdagi SIQISHDAN
  // OLDIN turib, telefon suratlarini (3-8MB) bekorga rad etardi.
  // Siqish baribir rasmni ~50-150KB ga tushiradi. 15MB — faqat
  // xato fayl (video va h.k.) dan himoya.
  if (file.size > 15 * 1024 * 1024) { toast("Fayl juda katta (15MB+) — bu rasm emasga o'xshaydi", "err"); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const raw = e.target.result;
    // Siqish
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      // ⚠️ 2026-08-03: SIFAT KO'TARILDI (600px/150KB → 1200px/400KB).
      // Eski chegara rasm base64 ko'rinishida BAZAGA yozilgan paytda
      // qo'yilgan — hajm muhim edi. Endi rasmlar Supabase Storage'da
      // (§6), hajm chegarasi ancha erkin.
      // Eski qiymatda sifat 0.3 gacha tushib, rasm sezilarli XIRA
      // chiqardi (B20 e'tirozi).
      const MAX = 1200;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      let q = 0.85, dataUrl;
      do { dataUrl = canvas.toDataURL("image/jpeg", q); q -= 0.08; }
      while (dataUrl.length > 400000 && q > 0.55);

      const p = db.products.find(x => x.sku === sku);
      if (!p) return;
      // Rang ko'rsatilgan bo'lsa — shu rangga, aks holda umumiy rasmga saqlaymiz
      if (color) {
        if (!p.colorImages) p.colorImages = {};
        p.colorImages[color] = dataUrl;
      } else {
        p.image = dataUrl;
      // 🔴 544 (2026-08-22): RASM DARHOL STORAGE'GA YUKLANADI.
      // Sakkizta rasm yo'lidan faqat ikkitasi shunday qilardi; qolganlari
      // base64 ni qoldirib `_migrateImagesToStorage` ga tayanardi — u esa
      // `pushToCloud` ichida, push esa xodim tokeniga bog'liq. Zanjir
      // xodimda uzilardi (2026-08-22: `storage.objects` 60 daqiqada bo'sh,
      // tovarlarda `image` BO'SH). Endi har yo'l o'zi yuklaydi.
      try {
        if (typeof uploadImageToStorage === "function") {
          uploadImageToStorage(dataUrl, (p.sku || "img") + "_" + color)
            .then(url => {
              if (!url || url === dataUrl) return;
              if (p.colorImages && p.colorImages[color] === dataUrl)
                p.colorImages[color] = url;
              if (p.image === dataUrl) p.image = url;
              try { if (typeof saveDB === "function") saveDB(); } catch (e) {}
            }).catch(() => {});
        }
      } catch (e) {}
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
// 2026-08-05: TELEFON UCHUN QAYTA ISHLANDI.
//   - kompyuterda: ustunli, rasm 110px (o'zgarmadi)
//   - telefonda (<=560px): yon-ma-yon — rasm CHAP TOMONDA, kartochkaning
//     butun balandligini to'ldiradi (absolute), ma'lumot o'ngda.
// 2026-08-05 (2-bosqich, telefon talabi):
//   - tahrir tugmasi — faqat BELGI, o'ng yuqori burchakda (bo'sh joyda)
//   - pochka narxi (📦) narx bilan BIR QATORDA
//   - rang · kategoriya bir qatorda
//   → bitta tovarga ketadigan balandlik ~230px dan ~110px ga tushdi
// Rasm: RANG rasmi ustuvor (jadval ko'rinishidagidek), yo'q bo'lsa umumiy.
// ⚠️ HISOB-KITOB JADVAL BILAN BIR XIL (518-qatordan ko'chirilgan):
//   pochka/dona — SHU POCHKA GURUHI bo'yicha (groupVariants, groupQty).
// ⚠️ Bosish: rasm → katImgView (kattalashadi), ✏️ → openEditProduct.
// ⚠️ Jadval ko'rinishiga TEGILMAGAN — u alohida funksiya.
function _renderKatGrid(rows, rate, showChakana) {
  const el = $("kat-grid-wrap");
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--mut)">Mahsulot topilmadi</div>`;
    return;
  }

  const css = `<style>
    .kgw{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;padding:16px}
    .kg-card{border:1.5px solid var(--brd);border-radius:10px;overflow:hidden;transition:.13s;display:flex;flex-direction:column;position:relative}
    .kg-card:hover{border-color:var(--acc)}
    .kg-img{width:100%;height:110px;object-fit:cover;flex:none;display:block;cursor:zoom-in}
    .kg-noimg{width:100%;height:110px;background:var(--bg2);flex:none;display:flex;align-items:center;justify-content:center;color:#ddd;cursor:pointer}
    .kg-body{padding:9px 11px;min-width:0;flex:1;display:flex;flex-direction:column}
    .kg-art{font-size:11px;color:var(--mut);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .kg-name{font-weight:700;font-size:13px;margin:2px 0;line-height:1.3}
    .kg-sub{font-size:11.5px;color:var(--mut);line-height:1.35}
    .kg-cat{display:block}
    .kg-badges{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-top:6px}
    .kg-qty{font-size:12px;color:var(--mut)}
    .kg-cost{font-size:12px;color:#0D1B2A;font-weight:600;margin-top:6px}
    .kg-price{font-weight:700;color:var(--acc);font-size:13px;margin-top:4px}
    .kg-boxc{display:block;font-size:11px;color:#856404;font-weight:400;margin-top:1px}
    .kg-boxu{display:block;font-size:11px;color:#e9a500;font-weight:400;margin-top:1px}
    .kg-lbl{color:var(--mut);font-weight:400;font-size:11px}
    .kg-foot{margin-top:auto;padding-top:8px;display:flex;justify-content:flex-end}
    @media (max-width:560px){
      .kgw{grid-template-columns:1fr;gap:7px;padding:9px}
      .kg-card{display:block}
      .kg-img,.kg-noimg{position:absolute;left:0;top:0;bottom:0;width:84px;height:auto}
      .kg-body{display:block;margin-left:84px;padding:7px 36px 8px 10px}
      .kg-art{font-size:10.5px}
      .kg-name{font-size:13px;margin:1px 0 2px}
      .kg-cat{display:inline}
      .kg-cat::before{content:"· "}
      .kg-badges{margin-top:4px;gap:4px}
      .kg-cost{margin-top:4px;font-size:11.5px}
      .kg-price{margin-top:2px;font-size:12.5px}
      .kg-boxc,.kg-boxu{display:inline;margin-left:5px;font-size:10.5px}
      .kg-foot{position:absolute;right:4px;top:4px;margin:0;padding:0}
      .kg-btxt{display:none}
    }
  </style>`;

  el.innerHTML = css + `<div class="kgw">` +
    rows.map(({product:p, color, isBroken, groupQty, groupVariants}) => {
      // ⚠️ Jadvaldagi (520–541) hisob AYNAN takrorlanadi
      const colorVariants = groupVariants;
      const _cvIb = parseInt(colorVariants[0] && colorVariants[0].inBox) || 0;
      const inBox   = _cvIb > 0 ? _cvIb
                      : (colorVariants.length === 1 ? (p.inBox || 1)
                         : (colorVariants.length || 1));
      const costUzs  = getCostUzs(p);
      const colorQty = colorVariants.reduce((a,v) => a + v.qty, 0);
      const pochkaSoni = colorVariants.length === 1
        ? Math.floor(colorQty / (inBox || 1))
        : groupQty;
      const pantone = colorVariants[0] && colorVariants[0].pantone || "";

      const pochkaBadge = `<span class="bg ${isBroken?"bg-a":pochkaSoni<=0?"bg-r":pochkaSoni<=5?"bg-a":"bg-g"}" style="font-size:10px;font-weight:700">${pochkaSoni} ${p.packUnit||"pochka"}</span>`;
      const qtyText = `<span class="kg-qty">${colorQty} ${p.unit||"dona"}</span>`;
      const brokenBadge = isBroken
        ? `<span style="background:#FEF3C7;color:#92400E;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:8px;white-space:nowrap">ochilgan</span>`
        : "";

      // Rasmga bosilsa kattalashadi; rasm yo'q bo'lsa katImgView o'zi
      // tanlagichni ochadi (3868-qator) — tahrir oynasi OCHILMAYDI
      const cImg = (p.colorImages && p.colorImages[color]) || p.image || "";
      const imgClick = `onclick="katImgView('${p.sku}','${jsEsc(color)}')"`;
      const imgHtml = cImg
        ? `<img class="kg-img" src="${cImg}" ${imgClick} title="Rasmni ko'rish">`
        : `<div class="kg-noimg" ${imgClick} title="Rasm qo'shish"><i class="ti ti-photo" style="font-size:28px"></i></div>`;

      return `<div class="kg-card">
        ${imgHtml}
        <div class="kg-body">
          <div class="kg-art">${p.art || p.sku}</div>
          <div class="kg-name">${p.name}</div>
          <div class="kg-sub">${color}${pantone ? " · " + pantone : ""}${p.category ? `<span class="kg-cat">${p.category}</span>` : ""}</div>
          <div class="kg-badges">${pochkaBadge}${qtyText}${brokenBadge}</div>
          ${costUzs ? `<div class="kg-cost"><span class="kg-lbl">Tannarx:</span> ${priceDisplay(costUzs)}${
            inBox > 1 ? `<span class="kg-boxc">📦 ${priceDisplay(costUzs * inBox)}</span>` : ""}</div>` : ""}
          <div class="kg-price"><span class="kg-lbl">Ulgurji:</span> ${p.ulgurjiNarx ? priceDisplay(p.ulgurjiNarx) : "—"}${
            (p.ulgurjiNarx && inBox > 1) ? `<span class="kg-boxu">📦 ${priceDisplay(p.ulgurjiNarx * inBox)}</span>` : ""}</div>
          <div class="kg-foot">
            <button class="btn btn-ghost btn-sm" onclick="openEditProduct('${p.sku}')" title="Tahrirlash">
              <i class="ti ti-edit"></i><span class="kg-btxt"> Tahrirlash</span>
            </button>
          </div>
        </div>
      </div>`;
    }).join("") + `</div>`;
}


// ── Rang barcodeini yangilash ─────────────────────
function updateColorBarcode(sku, color, newBarcode) {
  // 2026-08-09 RUXSAT AUDITI: katalogdagi "Barcode" kaliti endi amalda —
  // rang shtrix-kodini qo'lda o'zgartirish shu kalit bilan qo'riqlanadi.
  if (typeof requireDo === "function" && !requireDo("katalog", "barcode")) return;
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
      const bc = i === 0 && p.barcode ? p.barcode : yangiBarcode();   // 550
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

// ═══ RASM BOSILGANDA: bor bo'lsa KATTALASHTIRIB ko'rsatamiz,
// yo'q bo'lsa tanlagichni ochamiz (2026-07-24, №2) ═══

// Katalog jadvalidagi rasm (rang darajasida)
function katImgView(sku, color) {
  const p = (db.products || []).find(x => x.sku === sku);
  const src = (p && ((p.colorImages && p.colorImages[color]) || p.image)) || "";
  if (!src) { katImgClick(sku, color); return; }   // rasm yo'q — tanlagich
  showImageBig(src, () => katImgClick(sku, color));
}

// "Yangi tovar" oynasidagi rasm
function apImgView() {
  const img = document.querySelector("#ap-img-preview img");
  const src = img ? img.getAttribute("src") : "";
  if (!src) { imgSrcAsk("ap-img-inp", "ap-img-cam-hidden"); return; }
  showImageBig(src, () => imgSrcAsk("ap-img-inp", "ap-img-cam-hidden"));
}

// "Tahrirlash" oynasidagi rasm
function epImgView() {
  const img = document.getElementById("ep-img-preview");
  const src = (img && img.style.display !== "none") ? img.getAttribute("src") : "";
  if (!src) { imgSrcAsk("ep-img-input", "ep-img-cam-hidden"); return; }
  showImageBig(src, () => imgSrcAsk("ep-img-input", "ep-img-cam-hidden"));
}

// ═══ HAR RANGGA ALOHIDA BARCODE (2026-07-24, №9) ═══
// Tovar rang bo'yicha ajratilgani uchun barcode ham rang darajasida
// bo'lishi kerak. Bu funksiya har rang uchun kod yo'q bo'lsa yaratadi.
// Umumiy tovar barcode'i endi YARATILMAYDI (eskilari qidiruvda qoladi).
function ensureColorBarcodes(p) {
  if (!p || !Array.isArray(p.variants)) return false;
  if (!p.colorBarcodes) p.colorBarcodes = {};
  let changed = false;
  [...new Set(p.variants.map(v => v.color).filter(Boolean))].forEach(color => {
    if (!p.colorBarcodes[color]) {
      p.colorBarcodes[color] = yangiBarcode();   // 550
      changed = true;
    }
  });
  return changed;
}

// Barcha tovarlarga bir martalik to'ldirish (kod yo'q ranglar uchun)
function ensureAllColorBarcodes() {
  let changed = 0;
  (db.products || []).forEach(p => { if (ensureColorBarcodes(p)) changed++; });
  if (changed > 0) {
    saveDB();
    console.log(`🏷 ${changed} ta tovarga rang barcode'lari yaratildi`);
  }
  return changed;
}

// ═══ ETIKETKA O'LCHAM SOZLAMALARI (2026-07-25) ═══
// YAGONA manba: preview ham, chop etish ham shu yerdan o'lcham oladi.
// Shu sabab ekranda ko'ringan narsa qog'ozda ham AYNAN shunday chiqadi.
// Yangi o'lcham qo'shish uchun shu ro'yxatga bitta qator qo'shiladi.
function _nmSizeCfg(paper) {
  const CFG = {
    "40x30": {                       // Xprinter va shunga o'xshash termal
      wMm: 40, hMm: 30, padMm: 1,
      barH: 44, barW: 1.8, barFont: 15,   // barFont: kod raqami (11 -> 15)
      fName: 11.5, fVar: 10, fPrice: 16, fSmall: 9.5,
      thermal: true
    },
    "58x40": {
      wMm: 58, hMm: 40, padMm: 1.5,
      barH: 58, barW: 2.2, barFont: 18,   // (13 -> 18)
      fName: 14, fVar: 12, fPrice: 20, fSmall: 11,
      thermal: true
    },
    "a4": {                          // oddiy printer, ko'p ustun
      wMm: 0,  hMm: 0,  padMm: 2.5,  // 0 = grid o'zi belgilaydi
      barH: 38, barW: 1.5, barFont: 14,   // (10 -> 14)
      fName: 13, fVar: 10, fPrice: 18, fSmall: 10,
      thermal: false
    }
  };
  return CFG[paper] || CFG["a4"];
}

// ⚠️ 2026-08-09: DIZAYN tanlovi o'lchamlarga TA'SIR QILADI.
// Avval "Mini" standartdan deyarli farq qilmasdi (hamma shrift bir xil
// edi), "Premium" esa etiketkaga sig'may, pastdagi qismi kesilardi.
// Endi: Mini — hamma narsa ixchamroq (kichik yorliqqa ko'p narsa
// sig'adi); Premium — shtrix balandligi biroz qisqarib, sarlavha va
// narxga joy ochiladi.
function _nmStyleCfg(c, style) {
  if (style === "mini") return {...c,
    barH: Math.round(c.barH * 0.7),
    barFont: Math.max(10, c.barFont - 3),
    fName: c.fName - 2, fVar: c.fVar - 1.5,
    fPrice: c.fPrice - 4, fSmall: c.fSmall - 1};
  if (style === "premium") return {...c,
    barH: Math.round(c.barH * 0.75)};
  return c;
}

// Etiketka ichki uslubi — preview va chop etishda BIR XIL
// ⚠️ 2026-08-09: etiketkada (termal) tarkib TEPADAN boshlanadi
// (flex-start). Avval markazlash (center) ortiqcha joyni tepa/pastga
// bo'lib, shtrix tepasida bo'sh hoshiya ochardi; tarkib sig'may qolsa
// esa shtrixning O'ZI ham kesilib ketishi mumkin edi. Endi shtrix eng
// tepada, bo'sh joy pastda to'planadi — boshqa qatorlar belgilansa
// ham joy yetadi. A4 kartochkalarida markazlash chiroyli — qoladi.
function _nmLabelCss(c) {
  const box = c.wMm > 0
    ? `width:${c.wMm - c.padMm*2}mm;height:${c.hMm - c.padMm*2}mm;`
    : "";
  return `
.nm-label{${box}padding:${c.padMm}mm;font-family:Arial,sans-serif;background:#fff;
  display:flex;flex-direction:column;justify-content:${c.thermal ? "flex-start" : "center"};align-items:center;
  text-align:center;overflow:hidden;break-inside:avoid;box-sizing:border-box}
.nm-l-top{display:flex;flex-direction:column;gap:1px;min-height:0}
.nm-name,.nm-name-sm{font-size:${c.fName}px;font-weight:800;color:#000;line-height:1.15;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0}
.nm-var,.nm-var-sm{font-size:${c.fVar}px;font-weight:600;color:#000;line-height:1.15;
  overflow:hidden;white-space:nowrap;margin:0}
.nm-price-main{font-size:${c.fPrice}px;font-weight:900;color:#000;line-height:1.15;margin:0}
.nm-price-usd,.nm-price-ulg,.nm-sku,.nm-shop{font-size:${c.fSmall}px;color:#000;line-height:1.15;margin:0}
.nm-barcode{width:100%;margin:0 0 1px;text-align:center}
.nm-barcode-svg{width:100%;height:auto;display:block}
.nm-l-body{display:flex;flex-direction:column;gap:0;min-height:0;overflow:hidden;
  align-items:center;text-align:center;width:100%}
/* ═══ PREMIUM dizayn (2026-08-09) ═══
   Avval bu CSS faqat chop etish oynasida (ikki nusxada!) bor edi,
   preview'da esa umuman yo'q — "Premium" ekranda yalang'och divlar
   bo'lib ko'rinardi. Endi YAGONA manba shu yer: preview = qog'oz.
   Chop etishda @media print hamma fonni oq qiladi (B&W termal) —
   shuning uchun sarlavha ostiga qora chiziq qo'yilgan: rangsiz
   printerda ham bo'limlar ajralib turadi. */
.nm-premium{align-items:stretch;text-align:left;padding:0;
  border:1.5px solid #000;border-radius:5px}
.nm-prem-top{background:#0D1B2A;color:#fff;padding:3px 7px 4px;
  border-bottom:1.5px solid #000}
.nm-prem-shop{font-size:${Math.max(7, c.fSmall-2)}px;color:#E9A500;
  text-transform:uppercase;letter-spacing:1.5px}
.nm-prem-name{font-size:${c.fName}px;font-weight:800;line-height:1.15;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm-prem-cat{font-size:${Math.max(7, c.fSmall-2)}px;color:#ddd}
.nm-prem-mid{display:flex;justify-content:space-between;align-items:center;
  gap:6px;padding:2px 7px;border-bottom:1px solid #ccc}
.nm-prem-color{font-size:${c.fVar}px;font-weight:600}
.nm-prem-sku{font-size:${c.fSmall}px;font-family:monospace}
.nm-prem-bot{display:flex;align-items:baseline;flex-wrap:wrap;
  gap:2px 8px;padding:1px 7px 2px}
.nm-prem-price{font-size:${c.fPrice}px;font-weight:900;line-height:1.1}
.nm-prem-price span{font-size:${c.fSmall}px;font-weight:400}
.nm-prem-ulg,.nm-prem-usd{font-size:${c.fSmall}px;color:#222}
.nm-premium .nm-barcode{padding:0 5px;margin:0}
${c.thermal ? ".nm-color-dot{display:none}" : ""}
`;
}


// ═══ IMPORT VALYUTASI O'ZGARGANDA (2026-07-25, №11) ═══
// Narxlar tanlangan valyuta bo'yicha QAYTA o'qiladi.
function impCurrencyChanged() {
  if (!_importRawText) { showImportPreview(); return; }
  try {
    parseImportCSV(_importRawText);   // ichida showImportPreview() chaqiriladi
  } catch(e) {
    showImportPreview();
  }
}

// Variativ rang uchun ALOHIDA tovar yaratadi (B1 qarori, v147 bo'yicha).
// Nom, artikul, tur asosiy tovardan; pochka, narx — jadvaldan.
// batchId berilsa — kirim tarixida BITTA partiya bo'lib ko'rinadi.
// ══════════════════════════════════════════════════════════════
// SKU YARATISH — NOYOBLIK KAFOLATI (2026-08-03)
// ══════════════════════════════════════════════════════════════
// MUAMMO: SKU `CLTH-1234` ko'rinishida `db.seq` dan yaratilardi va
// takrorlanish UMUMAN tekshirilmasdi. Shu raqamli tovar allaqachon
// bo'lsa, bulutda ikkalasi BIR XIL kalitga tushardi
// (`products` da noyob kalit — `shop_id, sku`) va bittasi
// ikkinchisini BOSIB YOZARDI.
//
// Amalda: B20 da 6 rang kiritilib 4 tasi qolgan. Bazada 183 tovar,
// 183 noyob SKU — chunki takrorlanganlari YO'QOLGAN.
//
// Endi: band bo'lsa keyingi raqam olinadi. Rang darajasidagi
// barcode'ga tegilmaydi (u alohida mexanizm, §3.10).
// ⚠️ 2026-08-04: SANOQQA QAYTARILDI.
// SKU va barkod `db.seq` dan hosil bo'ladi — ular QISQA bo'lishi
// shart (CLTH-1785, 13 xonali EAN). `nextId()` esa vaqt muhri
// qaytaradi va SKU "CLTH-1785848660110" bo'lib ketdi, barkod ham
// yorliqdagi kod bilan mos kelmay qoldi (B20, 187 tovar).
// Yozuv `id` lari uchun `nextId()` TO'G'RI — u faqat noyoblik
// uchun. Kod/SKU uchun esa sanoq kerak.
// ✅ 2026-08-18 (3-teshik yakuni): SKU SERVERDAN OLINADI.
// Lokal `_apNextSku` ikki kassada BIR XIL raqam berardi va push
// birini ikkinchisi bilan bosardi (tovar + qoldiq jimgina yo'qolardi).
// Endi raqam serverdan so'raladi; aloqa/server rejimi bo'lmasa eski
// lokal yo'l ishlaydi (oflaynda ish to'xtamaydi).
// `_apSkuZaxira` — serverdan olingan, hali ishlatilmagan raqamlar
// (ko'p rang qo'shishda bir chaqiruvda bir nechta olinadi).
let _apSkuZaxira = [];
async function _apNextSkuAsync(type, count) {
  const pref = type === "oyoq" ? "SHOE" : "CLTH";
  const n = Math.max(1, parseInt(count) || 1);
  try {
    if (typeof _serverRejimi === "function" && _serverRejimi() &&
        typeof _serverPay === "function") {
      const r = await _serverPay({ action: "next_sku", prefix: pref, count: n });
      if (r && r.ok && Array.isArray(r.skus) && r.skus.length) {
        // Lokalda band bo'lganlarini tashlaymiz (sinxron kechikkan holat)
        const band = new Set((db.products || []).map(x => String(x.sku || "")));
        const toza = r.skus.filter(s => !band.has(s));
        if (toza.length) {
          _apSkuZaxira = toza.slice(1);
          // 🔴 545 (2026-08-22): id endi VAQT MUHRIDAN (nextId), kichik
          // sanoqdan emas. Bazada bosh kalit (shop_id, id); sanoq id si
          // do'konning eski tovarlari band qilgan raqamga tushib, yozuv
          // 409 "products_pkey" bilan rad etilardi (jonli skrinshot).
          // SKU raqamiga tegilmagan — u avvalgidek serverdan/sanoqdan.
          const _id = (typeof nextId === "function") ? nextId() : db.seq++;
          return { id: _id, sku: toza[0], server: true };
        }
      }
    }
  } catch (e) { console.warn("[sku] serverdan olinmadi:", e.message); }
  return { ..._apNextSku(type), server: false };
}
// Zaxiradan olish (bir amalda ko'p tovar yaratilganda)
function _apSkuNavbat(type) {
  if (_apSkuZaxira.length) {
    const band = new Set((db.products || []).map(x => String(x.sku || "")));
    while (_apSkuZaxira.length) {
      const s = _apSkuZaxira.shift();
      if (!band.has(s)) return {
        id: (typeof nextId === "function") ? nextId() : db.seq++,   // 545
        sku: s, server: true };
    }
  }
  return { ..._apNextSku(type), server: false };
}

function _apNextSku(type) {
  const pref = type === "oyoq" ? "SHOE" : "CLTH";
  const band = new Set((db.products || []).map(x => String(x.sku || "")));
  // 🔴 552 (2026-08-23): OFLAYN ZAXIRA SKU GA QURILMA HARFI.
  // Bu yo'l faqat server SKU bermaganda (internet yo'q) ishlaydi.
  // Sanoq lokal va sinxronlanmaydi — ikki kassa oflaynda bir vaqtda
  // tovar yaratsa AYNAN bir xil `CLTH-004` chiqardi; bulutda noyoblik
  // (sku, shop_id) bo'lgani uchun biri ikkinchisini JIMGINA bosardi.
  // Endi `CLTH-004-DY`: raqam avvalgidek o'qiladi (2026-08-04 qarori),
  // saralash va yorliq raqami ham o'zgarmaydi (ikkalasi SKU dagi
  // RAQAMNI oladi, harflarni emas). Server yo'liga TEGILMAGAN —
  // ulanish bor paytda SKU avvalgidek `CLTH-4412` ko'rinishida.
  const _dv = (typeof _devCode === "function") ? ("-" + _devCode()) : "";
  let guard = 0;
  while (guard++ < 10000) {
    const n   = db.seq++;                 // SKU raqami — sanoqdan (o'zgarmadi)
    const sku = `${pref}-${String(n).padStart(3, "0")}${_dv}`;
    if (!band.has(sku)) return {
      id: (typeof nextId === "function") ? nextId() : n,   // 545: id vaqt muhridan
      sku };
  }
  // Bu yerga yetib kelish deyarli imkonsiz — zaxira yo'l
  const n = db.seq++;
  return { id: (typeof nextId === "function") ? nextId() : n,   // 545
           sku: `${pref}-${n}${_dv}-${Date.now().toString(36)}` };
}

function _apCreateExtraColor(base, cd, batchId) {
  if (!base || !cd || !cd.color) return null;

  const rate  = db.settings?.rate || 12800;
  const inBox = cd.inbox > 0 ? cd.inbox : (base.inBox || 1);
  // 2026-07-26: JAMI DONA yozilgan bo'lsa u ustuvor (ochilgan qoldiq bilan)
  const qty   = (cd.dona > 0) ? cd.dona : ((cd.boxes || 0) * inBox);

  // 2026-07-26: NARX HAR DOIM SO'MDA kiritiladi (tizim valyutasidan
  // qat'i nazar). Avval "both" rejimda kiritilgan raqam DOLLAR deb
  // qabul qilinardi va 300 000 → 3 615 000 000 bo'lib ketardi.
  const costUzsVal = cd.cost > 0 ? Math.round(cd.cost) : (base.costUzs || 0);
  const costUsd    = rate > 0 ? (costUzsVal / rate) : 0;   // eski kod uchun zaxira
  const ulg = cd.ulg > 0 ? Math.round(cd.ulg) : (base.ulgurjiNarx || 0);

  // 2026-08-03: SKU noyobligi kafolatlanadi (yuqoridagi izoh)
  const { id: newId, sku: newSku } = _apSkuNavbat(base.type);   // ✅ 2026-08-18
  const prod = {
    id: newId,
    sku: newSku,
    name: base.name,
    category: base.category || "",
    type: base.type,
    unit: base.unit,
    inBox: inBox,
    packUnit: base.packUnit,
    art: base.art || "",
    costUzs: costUzsVal,
    costUsd: costUsd,
    priceUzs: base.priceUzs || 0,
    ulgurjiNarx: ulg,
    barcode: (typeof yangiBarcode === "function") ? yangiBarcode() : "",   // 550
    image: cd.image || base.image || "",   // rangning o'z rasmi ustuvor
    createdAt: new Date().toISOString(),
    variantGroup: batchId || "",      // variativ guruh belgisi
    variants: [{
      color: cd.color, size: "",
      qty: qty, inBox: inBox, pantone: "", hex: cd.hex || "#888888"
    }]
  };

  db.products.push(prod);
  try {
    auditLog("yaratish", "product", prod.sku,
      prod.name + " · " + (cd.color || ""),
      { after: "ranglar to'plami", note: "AP to'plam" });
  } catch (e) {}
  // ✅ 2026-08-19: SERVERGA ham yoziladi (506 naqshi). Bu funksiya
  // ranglar to'plamidan chaqiriladi (bir amalda bir necha rang) —
  // shuning uchun ogohlantirishsiz, `force` bilan: kassir ataylab
  // shu ranglarni ochyapti. Fon rejimida — ekran kutmaydi.
  try {
    prod.updatedAt = new Date().toISOString();
    if (typeof serverSaveRecord === "function") {
      // 🔴 545 (3.33): fon rejimida ham server bergan id va vaqt muhri
      // qabul qilinadi — band id lokalda qolib 409 aylanmasin.
      const _sv = serverSaveRecord("products", prod, null, true);
      if (_sv && _sv.then) _sv.then(_r => {
        if (_r && _r.ok && _r.row) {
          if (_r.row.id != null) prod.id = _r.row.id;
          const _sm = _r.row.data && _r.row.data.updatedAt;
          if (_sm) prod.updatedAt = _sm;
        }
      }).catch(() => {});
    }
  } catch (e) {}
  try { ensureColorBarcodes(prod); } catch(e) {}

  // Kirim tarixi — mavjud yozuv tuzilishi bilan AYNAN bir xil maydonlar.
  // partiya bir xil bo'lgani uchun variativ kirim BITTA partiya bo'lib ko'rinadi.
  if (qty > 0) {
    db.ombor.push({
      id:          nextId(),
      date:        today(),
      time:        (typeof nowTime === "function" ? nowTime() : ""),
      sku:         prod.sku,
      art:         prod.art || "",
      productName: prod.name,
      unit:        prod.unit || "dona",
      color:       cd.color,
      size:        "",
      qty:         qty,
      pantone:     "",
      hex:         cd.hex || "",
      boxes:       cd.boxes || null,
      kirimNarxi:  Math.round(costUsd * rate),
      chakana:     prod.priceUzs || 0,
      ulgurji:     ulg || 0,
      supplier:    "",
      partiya:     batchId || "Qo'lda",
      payStatus:   "tolandan"
    });
  }

  return prod;
}

// ═══════════════════════════════════════════════════════════════
// VARIATIV KIRITISH (2026-07-25, №3)
// Bir xil tovar, bir necha rang. Har rangga o'z pochkasi va narxi.
// Yoqilmasa — oyna avvalgidek bitta rang bilan ishlaydi.
// ═══════════════════════════════════════════════════════════════
let _apVarOn     = false;
let _apVarColors = [];   // [{name, hex}]

function apToggleVariativ() {
  _apVarOn = !_apVarOn;
  const panel = document.getElementById("ap-var-panel");
  const txt   = document.getElementById("ap-var-toggle-txt");
  const btn   = document.getElementById("ap-var-toggle");
  if (panel) panel.style.display = _apVarOn ? "block" : "none";
  if (txt)   txt.textContent = _apVarOn
    ? "Variativ kiritish yoqilgan — o'chirish"
    : "Variativ kiritish — bir necha rang";
  if (btn) {
    btn.style.background  = _apVarOn ? "#0D1B2A" : "#FFF7ED";
    btn.style.color       = _apVarOn ? "#fff" : "#0D1B2A";
    btn.style.borderStyle = _apVarOn ? "solid" : "dashed";
  }
  // 2026-07-25: variativda pochka/o'lcham/rang maydonlari YASHIRILADI —
  // ular jadvalda kiritiladi, pastda turishi chalg'itardi
  const single = document.getElementById("ap-single-fields");
  if (single) single.style.display = _apVarOn ? "none" : "";
  // Tannarx, ulgurji, chakana, rasm — jadvalda kiritiladi
  document.querySelectorAll(".ap-hide-var").forEach(el => {
    el.style.display = _apVarOn ? "none" : "";
  });
  // O'chirilganda maydon sozlamalari qayta qo'llansin (ba'zilari
  // sozlamada o'chirilgan bo'lishi mumkin)
  if (!_apVarOn && typeof apApplyFields === "function") apApplyFields();

  if (_apVarOn) {
    apVarFillSuggestions();
    setTimeout(() => document.getElementById("ap-var-colorinp")?.focus(), 50);
  }
}

// Avval ishlatilgan ranglarni taklif qilamiz
function apVarFillSuggestions() {
  const dl = document.getElementById("ap-var-colorlist");
  if (!dl) return;
  const used = new Map();
  (db.products || []).forEach(p =>
    (p.variants || []).forEach(v => {
      if (v.color && !used.has(v.color)) used.set(v.color, v.hex || "#888888");
    }));
  dl.innerHTML = [...used.keys()].sort((a,b) => a.localeCompare(b,"uz"))
    .map(c => `<option value="${c}">`).join("");
}

// Enter bosilganda rang "chip" bo'lib qo'shiladi
function apVarColorKey(e) {
  if (e.key !== "Enter" && e.key !== ",") return;
  e.preventDefault();
  apVarAddColor();
}

// Rang qo'shish — Enter ham, "Qo'shish" tugmasi ham shu yerga keladi
function apVarAddColor() {
  const inp = document.getElementById("ap-var-colorinp");
  if (!inp) return;
  const name = (inp.value || "").trim();
  if (!name) { toast("Rang nomini yozing", "err"); inp.focus(); return; }
  if (_apVarColors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    toast("Bu rang allaqachon qo'shilgan", "err");
    inp.value = ""; inp.focus(); return;
  }
  // Avval ishlatilgan bo'lsa — o'sha rang kodini olamiz
  let hex = "#888888";
  outer: for (const p of (db.products || [])) {
    for (const v of (p.variants || [])) {
      if (v.color && v.color.toLowerCase() === name.toLowerCase() && v.hex) {
        hex = v.hex; break outer;
      }
    }
  }
  _apVarColors.push({ name, hex });
  inp.value = "";
  inp.focus();                 // ketma-ket yozish uchun
  apVarRenderChips();
  apVarRenderTable();
}

function apVarRemoveColor(i) {
  _apVarColors.splice(i, 1);
  apVarRenderChips();
  apVarRenderTable();
}

function apVarRenderChips() {
  const box = document.getElementById("ap-var-chips");
  if (!box) return;
  box.innerHTML = _apVarColors.map((c, i) => `
    <span style="display:inline-flex;align-items:center;gap:6px;background:#fff;
      border:1.5px solid var(--brd);border-radius:20px;padding:5px 10px 5px 7px;font-size:12.5px">
      <span style="width:12px;height:12px;border-radius:3px;background:${c.hex};
        border:1px solid rgba(0,0,0,.15)"></span>
      <b>${c.name}</b>
      <button type="button" onclick="apVarRemoveColor(${i})" title="Olib tashlash"
        style="background:none;border:none;color:var(--red);font-size:15px;
        cursor:pointer;padding:0 0 0 2px;line-height:1">×</button>
    </span>`).join("");
}

// Ranglar soniga qarab jadval quriladi
function apVarRenderTable() {
  const wrap  = document.getElementById("ap-var-table-wrap");
  const tbody = document.getElementById("ap-var-tbody");
  if (!wrap || !tbody) return;

  if (!_apVarColors.length) { wrap.style.display = "none"; tbody.innerHTML = ""; return; }
  wrap.style.display = "block";

  const inpCss = "width:100%;font-family:inherit;font-size:12.5px;border:1px solid var(--brd);" +
                 "border-radius:6px;padding:6px 8px;box-sizing:border-box";

  tbody.innerHTML = _apVarColors.map((c, i) => `
    <tr data-vrow="${i}" style="border-top:1px solid var(--brd)">
      <td style="padding:4px;text-align:center">
        <div onclick="apVarPickImage(${i})" title="Rasm qo'shish"
          style="width:32px;height:32px;border-radius:6px;border:1.5px dashed var(--brd);
          cursor:pointer;display:flex;align-items:center;justify-content:center;
          overflow:hidden;background:var(--bg)" id="vr-img-${i}">
          ${c.image ? `<img src="${c.image}" style="width:100%;height:100%;object-fit:cover">`
                    : `<i class="ti ti-camera-plus" style="font-size:14px;color:#bbb"></i>`}
        </div>
      </td>
      <td style="padding:5px 8px;white-space:nowrap">
        <span style="display:inline-block;width:11px;height:11px;border-radius:3px;
          background:${c.hex};border:1px solid rgba(0,0,0,.15);vertical-align:middle"></span>
        <b style="margin-left:5px">${c.name}</b>
      </td>
      <td style="padding:4px"><input class="vr-boxes" type="number" min="0" inputmode="numeric"
        placeholder="0" style="${inpCss}" oninput="apVarFillHint(${i},'boxes');apVarDonaSync(${i},'boxes');apVarTotals()"></td>
      <td style="padding:4px"><input class="vr-inbox" type="number" min="1" inputmode="numeric"
        placeholder="1" style="${inpCss}" oninput="apVarFillHint(${i},'inbox');apVarDonaSync(${i},'inbox');apVarTotals()"></td>
      <td style="padding:4px"><input class="vr-dona" type="number" min="0" inputmode="numeric"
        placeholder="0" style="${inpCss}" oninput="apVarFillHint(${i},'dona');apVarDonaSync(${i},'dona');apVarTotals()"></td>
      <td style="padding:4px"><input class="vr-cost" type="text" data-price
        placeholder="0" style="${inpCss}" oninput="fmtInput(this);apVarFillHint(${i},'cost')"></td>
      <td style="padding:4px"><input class="vr-ulg" type="text" data-price
        placeholder="0" style="${inpCss}" oninput="fmtInput(this);apVarFillHint(${i},'ulg')"></td>
      <td style="padding:4px;text-align:center">
        <button type="button" onclick="apVarRemoveColor(${i})" title="O'chirish"
          style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer">×</button>
      </td>
    </tr>`).join("");
  apVarTotals();
}

// Birinchi qatorga yozilganda "barchasini to'ldirish" taklifi
function apVarFillHint(rowIdx, field) {
  if (rowIdx !== 0 || _apVarColors.length < 2) return;
  const cls = { boxes:"vr-boxes", inbox:"vr-inbox", dona:"vr-dona", cost:"vr-cost", ulg:"vr-ulg" }[field];
  const first = document.querySelector(`#ap-var-tbody tr[data-vrow="0"] .${cls}`);
  if (!first || !first.value.trim()) return;

  const td = first.parentElement;
  let hint = td.querySelector(".vr-fill-hint");
  if (!hint) {
    hint = document.createElement("div");
    hint.className = "vr-fill-hint";
    hint.style.cssText = "font-size:10.5px;color:#0D1B2A;background:#FFF7ED;border:1px solid #FCD9A8;" +
      "border-radius:5px;padding:3px 6px;margin-top:3px;cursor:pointer;text-align:center;font-weight:600";
    hint.onclick = () => { apVarFillAll(field); hint.remove(); };
    td.appendChild(hint);
  }
  hint.textContent = `↓ Barcha qatorlarga (${_apVarColors.length - 1} ta)`;
}

// Birinchi qator qiymatini qolganlariga tarqatamiz
function apVarFillAll(field) {
  const cls = { boxes:"vr-boxes", inbox:"vr-inbox", dona:"vr-dona", cost:"vr-cost", ulg:"vr-ulg" }[field];
  const rows = [...document.querySelectorAll("#ap-var-tbody tr")];
  if (rows.length < 2) return;
  const val = rows[0].querySelector(`.${cls}`)?.value || "";
  rows.slice(1).forEach((r, idx) => {
    const el = r.querySelector(`.${cls}`);
    if (el) el.value = val;
    // 2026-07-26: pochka/dona/pochkada — biri to'ldirilsa qolgani ham
    // qayta hisoblansin (aks holda jadval nomuvofiq qolardi)
    if (["boxes","dona","inbox"].includes(field)) {
      try { apVarDonaSync(idx + 1, field); } catch(e) {}
    }
  });
  apVarTotals();
  toast(`✅ ${rows.length - 1} ta qatorga qo'llandi`);
}

// Jami hisob
function apVarTotals() {
  const el = document.getElementById("ap-var-total");
  if (!el) return;
  const rows = _apVarReadRows();
  const pochka = rows.reduce((a, r) => a + r.boxes, 0);
  // 2026-07-26: dona ustuni ustuvor (ochilgan qoldiq bilan)
  const dona   = rows.reduce((a, r) => a + (r.dona > 0 ? r.dona : r.boxes * r.inbox), 0);
  el.innerHTML = rows.length
    ? `Jami: <b>${_apVarColors.length}</b> rang · <b>${pochka}</b> pochka · <b>${dona}</b> dona`
    : "";
}

// Jadvaldan ma'lumot o'qish
function _apVarReadRows() {
  return [...document.querySelectorAll("#ap-var-tbody tr")].map((r, i) => ({
    color: _apVarColors[i]?.name || "",
    hex:   _apVarColors[i]?.hex  || "#888888",
    image: _apVarColors[i]?.image || "",
    boxes: parseInt(r.querySelector(".vr-boxes")?.value) || 0,
    dona:  parseInt(r.querySelector(".vr-dona")?.value)  || 0,
    inbox: parseInt(r.querySelector(".vr-inbox")?.value) || 1,
    cost:  _numFromInput(r.querySelector(".vr-cost")),
    ulg:   _numFromInput(r.querySelector(".vr-ulg"))
  })).filter(r => r.color);
}

function _apVarReset() {
  _apVarOn = false;
  _apVarColors = [];
  const p = document.getElementById("ap-var-panel");   if (p) p.style.display = "none";
  const t = document.getElementById("ap-var-toggle-txt");
  if (t) t.textContent = "Variativ kiritish — bir necha rang";
  const b = document.getElementById("ap-var-toggle");
  if (b) { b.style.background = "#FFF7ED"; b.style.color = "#0D1B2A"; b.style.borderStyle = "dashed"; }
  const c = document.getElementById("ap-var-chips");   if (c) c.innerHTML = "";
  const w = document.getElementById("ap-var-table-wrap"); if (w) w.style.display = "none";
  const tb = document.getElementById("ap-var-tbody");  if (tb) tb.innerHTML = "";
  const sf = document.getElementById("ap-single-fields"); if (sf) sf.style.display = "";
  document.querySelectorAll(".ap-hide-var").forEach(el => { el.style.display = ""; });
  if (typeof apApplyFields === "function") apApplyFields();
}

// ═══ VARIATIV TOVAR QO'SHISH (2026-07-25, №3) ═══
// Jadvaldagi har rang uchun alohida tovar yaratiladi.
// Kirim tarixida hammasi BITTA partiya bo'lib ko'rinadi.
async function apAddVariativ(name) {   // ✅ 2026-08-18: SKU zaxirasi serverdan
  if (typeof requireUse === "function" && !requireUse("katalog")) return;

  const rows = _apVarReadRows();
  if (!rows.length) { toast("Kamida bitta rang qo'shing", "err"); return; }

  const bad = rows.find(r => r.boxes <= 0 && r.dona <= 0);
  if (bad) { toast(`"${bad.color}" uchun pochka soni yoki jami donani kiriting`, "err"); return; }

  // ═══════════════════════════════════════════════════════════════
  // 🔴 545 (2026-08-22): RASMLAR AVVAL YUKLANADI, KEYIN TOVAR
  // ═══════════════════════════════════════════════════════════════
  // Poyga davosi. Rasm Storage'ga FONDA yuklanardi (544); kassir
  // "Saqlash"ni yuklash tugashidan OLDIN bossa, tovar base64 bilan
  // ketardi — server esa base64 ni ataylab tashlaydi (539) va boshqa
  // qurilmalarga tovar RASMSIZ borardi. Kech kelgan havola tozalangan
  // formaga yozilib, bekorga ketardi. Endi: base64 qolgan rasmlar shu
  // yerda KUTIB yuklanadi (jami 8 soniya chegara). Ulgurmasa yoki
  // oflaynda — eski yo'l (base64 qoladi, ish to'xtamaydi).
  const _b64Rows = rows.filter(r =>
    r.image && String(r.image).startsWith("data:image"));
  // 🔴 549: har qator yuklashining VA'DASI saqlanadi — 8 soniyaga
  // ulgurmasa ham fonda davom etadi va pastda (tovar yaratilgach)
  // natijasi TOVARNING O'ZIGA biriktiriladi.
  const _imgVaada = new Map();
  if (_b64Rows.length && typeof uploadImageToStorage === "function" &&
      (typeof navigator === "undefined" || navigator.onLine !== false)) {
    toast("🖼️ Rasm yuklanmoqda...", "info");
    await Promise.race([
      Promise.allSettled(_b64Rows.map(r => {
        const _v = (async () => {
          try {
            const u = await uploadImageToStorage(r.image, "var");
            if (u && u !== r.image) { r.image = u; return u; }
          } catch (e) {}
          return null;
        })();
        _imgVaada.set(r, _v);
        return _v;
      })),
      new Promise(res => setTimeout(res, 8000))
    ]);
  }

  const t        = currentApType || "oyoq";
  const art      = ($("ap-art")||{value:""}).value.trim();
  const category = (($("ap-cat")||{value:""}).value || "").trim();
  const unit     = ($("ap-unit")||{value:"dona"}).value;
  const packUnit = ($("ap-packunit")||{value:"karobka"}).value;

  // Barcha ranglar uchun umumiy "asos" — jadvalda narx yozilmagan
  // qatorlar shundan oladi
  // 2026-07-25: variativda narxlar FAQAT jadvaldan olinadi — yuqoridagi
  // tannarx/ulgurji/chakana maydonlari yashirilgan (chalg'itmasin)
  const base = {
    name, art, category, type: t, unit, packUnit,
    inBox: 1, costUsd: 0, priceUzs: 0, ulgurjiNarx: 0,
    image: ""
  };

  // Bitta partiya — kirim tarixida bir joyda turadi
  const batchId = "Variativ " + today() +
    (typeof nowTime === "function" ? " " + nowTime() : "");

  // ✅ 2026-08-18: kerakli raqamlar BIR chaqiruvda serverdan olinadi —
  // har rang uchun alohida so'rov yubormaymiz. Aloqa bo'lmasa
  // `_apSkuNavbat` lokal yo'lga tushadi.
  try {
    const _n = rows.length;
    if (_n > 0 && typeof _serverRejimi === "function" && _serverRejimi() &&
        typeof _serverPay === "function") {
      const _pref = (base.type === "oyoq") ? "SHOE" : "CLTH";
      const _r = await _serverPay({ action: "next_sku", prefix: _pref, count: _n });
      if (_r && _r.ok && Array.isArray(_r.skus)) {
        const _band = new Set((db.products || []).map(x => String(x.sku || "")));
        _apSkuZaxira = _r.skus.filter(x => !_band.has(x));
      }
    }
  } catch (e) { console.warn("[sku] zaxira olinmadi:", e.message); }

  let created = 0;
  const _juft = [];   // 549: qator ↔ yaratilgan tovar
  rows.forEach(cd => {
    const _p = _apCreateExtraColor(base, cd, batchId);
    if (_p) { created++; _juft.push([cd, _p]); }
  });

  if (!created) { toast("Tovar qo'shilmadi", "err"); return; }

  // ═══════════════════════════════════════════════════════════════
  // 🔴 549 (2026-08-22): KECH KELGAN RASM ENDI YO'QOLMAYDI
  // ═══════════════════════════════════════════════════════════════
  // Jonli keyz (gost komp, sekin tarmoq): 8 soniyada rasm ulgurmadi →
  // tovar base64 bilan ketdi → server tashladi (539) → bulutda rasm
  // BO'SH, boshqa qurilmalar rasmsiz ko'rdi. Kech kelgan havola esa
  // ilgari TOZALANGAN formaga yozilib bekor ketardi.
  // Endi: yuklash tugashi bilan havola YARATILGAN TOVARGA yoziladi
  // va serverga darhol yuboriladi; butunlay yuklanolmasa konsolda
  // ochiq aytiladi (jim yutqazish yo'q). Qurilma ochiq turgan har
  // holatda rasm oxir-oqibat yetib boradi.
  try {
    _juft.forEach(([cd, _p]) => {
      const _v = _imgVaada.get(cd);
      if (!_v) return;                       // rasm yo'q yoki boshidan URL
      _v.then(u => {
        if (!String(_p.image || "").startsWith("data:image")) return; // allaqachon URL
        if (!u) {
          console.warn("🖼️ Rasm yuklanmadi (tarmoq):", _p.sku,
            "— rasmsiz ketdi; keyingi sinxron o'zi urinadi, bo'lmasa tahrirda qayta qo'ying");
          return;
        }
        _p.image = u;
        _p.updatedAt = new Date().toISOString();
        try {
          if (typeof serverSaveRecord === "function")
            serverSaveRecord("products", _p, null, true);
        } catch (e) {}
        try { saveDB(); } catch (e) {}
        console.log("🖼️ Kech yuklangan rasm tovarga biriktirildi:", _p.sku);
      }).catch(() => {});
    });
  } catch (e) {}

  saveDB();
  closeModal("addprod");
  renderKatalog();
  apResetAddForm();
  toast(`✅ "${name}" — ${created} ta rang qo'shildi`);
}

// ═══ VARIATIV JADVALDA RASM (2026-07-25, №3) ═══
// Katalog/ombordagi bilan AYNAN bir xil: kamera yoki galereya tanlovi,
// 15MB aql-sinovi, 600px gacha siqish, ~150KB gacha sifat pasaytirish.
let _apVarImgRow = -1;

function apVarPickImage(i) {
  // Rasm BOR bo'lsa — avval kattalashtirib ko'rsatamiz (katalogdagi kabi),
  // ichida "Almashtirish" tugmasi bilan
  const cur = _apVarColors[i] && _apVarColors[i].image;
  if (cur && typeof showImageBig === "function") {
    showImageBig(cur, () => apVarChooseImage(i));
    return;
  }
  apVarChooseImage(i);
}

// Manba tanlash (kamera / galereya)
function apVarChooseImage(i) {
  _apVarImgRow = i;
  // imgSrcAsk oraliq tanlov oynasini ochadi (kamera / galereya).
  // Kamera inputi yo'q qurilmada to'g'ridan-to'g'ri galereya ochiladi.
  if (typeof imgSrcAsk === "function") {
    imgSrcAsk("ap-var-img-gal", "ap-var-img-cam");
  } else {
    document.getElementById("ap-var-img-gal")?.click();
  }
}

function apVarImgSave(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) {
    toast("Fayl juda katta (15MB+) — bu rasm emasga o'xshaydi", "err");
    input.value = ""; return;
  }
  const i = _apVarImgRow;
  if (i < 0 || !_apVarColors[i]) { input.value = ""; return; }

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = function() {
      // Katalogdagi bilan bir xil: 600px, ~150KB gacha
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      // ⚠️ 2026-08-03: SIFAT KO'TARILDI (600px/150KB → 1200px/400KB).
      // Eski chegara rasm base64 ko'rinishida BAZAGA yozilgan paytda
      // qo'yilgan — hajm muhim edi. Endi rasmlar Supabase Storage'da
      // (§6), hajm chegarasi ancha erkin.
      // Eski qiymatda sifat 0.3 gacha tushib, rasm sezilarli XIRA
      // chiqardi (B20 e'tirozi).
      const MAX = 1200;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      let q = 0.85, dataUrl;
      do { dataUrl = canvas.toDataURL("image/jpeg", q); q -= 0.08; }
      while (dataUrl.length > 400000 && q > 0.55);

      _apVarColors[i].image = dataUrl;
      // 🔴 544 (2026-08-22): RASM DARHOL STORAGE'GA YUKLANADI.
      // Sakkizta rasm yo'lidan faqat IKKITASI (`apImgSave`,
      // `epLoadColorImage`) shunday qilardi. Qolganlari base64 ni
      // qoldirib, `_migrateImagesToStorage` ga tayanardi — u esa
      // `pushToCloud` ichida, push esa xodim tokeniga bog'liq.
      // Zanjir uzun va xodimda uzilardi: 2026-08-22 da `storage.objects`
      // da 60 daqiqada BITTA HAM fayl bo'lmadi, tovarlarda `image`
      // BO'SH chiqdi. Endi har yo'l o'zi yuklaydi — hech nimaga
      // bog'liq emas. Ulgurmasa base64 qoladi va eski yo'l ishlaydi.
      try {
        if (typeof uploadImageToStorage === "function") {
          uploadImageToStorage(dataUrl, "var").then(url => {
            if (url && url !== dataUrl && _apVarColors[i].image === dataUrl)
              _apVarColors[i].image = url;
          }).catch(() => {});
        }
      } catch (e) {}
      const cell = document.getElementById("vr-img-" + i);
      if (cell) cell.innerHTML =
        `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
      toast("Rasm qo'shildi");
      input.value = "";     // bir xil faylni qayta tanlash mumkin bo'lsin
      _apVarImgRow = -1;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}


// ═══════════════════════════════════════════════════════════════
// VARIATIV TAHRIRLASH (2026-07-25, №3 davomi)
// Bitta partiyada kiritilgan tovarlarni birgalikda tahrirlash.
// Guruh: variantGroup maydoni (kiritishda yozilgan).
// ═══════════════════════════════════════════════════════════════
let _epVarOn = false;

// Shu tovar bilan BIRGA kiritilgan tovarlar
function _epVarGroup(p) {
  if (!p) return [];
  const g = p.variantGroup;
  if (!g) return [];
  return (db.products || []).filter(x => x.variantGroup === g);
}

// Tahrirlash oynasi ochilganda chaqiriladi
function epVarInit(p) {
  _epVarOn = false;
  const block = document.getElementById("ep-var-block");
  const panel = document.getElementById("ep-var-panel");
  const txt   = document.getElementById("ep-var-toggle-txt");
  if (panel) panel.style.display = "none";
  if (txt)   txt.textContent = "Variativ tahrirlash — birga kiritilgan ranglar";

  const grp = _epVarGroup(p);
  // Guruhda kamida 2 ta tovar bo'lsagina ma'no bor
  if (!block) return;
  block.style.display = (grp.length >= 2) ? "block" : "none";
}

function epToggleVariativ() {
  _epVarOn = !_epVarOn;
  const panel = document.getElementById("ep-var-panel");
  const txt   = document.getElementById("ep-var-toggle-txt");
  const btn   = document.getElementById("ep-var-toggle");
  if (panel) panel.style.display = _epVarOn ? "block" : "none";
  if (txt)   txt.textContent = _epVarOn
    ? "Variativ tahrirlash yopilsin"
    : "Variativ tahrirlash — birga kiritilgan ranglar";
  if (btn) {
    btn.style.background  = _epVarOn ? "#0D1B2A" : "#FFF7ED";
    btn.style.color       = _epVarOn ? "#fff" : "#0D1B2A";
    btn.style.borderStyle = _epVarOn ? "solid" : "dashed";
  }
  if (_epVarOn) epVarRenderTable();
}

// ✅ 2026-08-18 (egasining talabi): "↓ Barcha qatorlarga" TAHRIR
// jadvalida ham — qo'shishdagi (apVarFillHint/apVarFillAll) bilan
// bir xil UX. BIRINCHI qatorga yozilganda katak ostida tugmacha
// chiqadi; bosilsa qiymat qolgan ranglarga tarqaladi. Shu bilan
// "faqat kirilgan rang tahrirlanadi" shikoyati ham yopiladi —
// narx/sig'im/qoldiq bir bosishda butun guruhga ketadi.
function epVarFillHint(el, field) {
  const rows = [...document.querySelectorAll("#ep-var-tbody tr")];
  if (rows.length < 2) return;
  const tr = el.closest("tr");
  if (tr !== rows[0]) return;                    // faqat birinchi qator
  const td = el.parentElement;
  if (!el.value.trim()) {
    td.querySelector(".evr-fill-hint")?.remove();
    return;
  }
  let hint = td.querySelector(".evr-fill-hint");
  if (!hint) {
    hint = document.createElement("div");
    hint.className = "evr-fill-hint";
    hint.style.cssText = "font-size:10.5px;color:#0D1B2A;background:#FFF7ED;" +
      "border:1px solid #FCD9A8;border-radius:5px;padding:3px 6px;margin-top:3px;" +
      "cursor:pointer;text-align:center;font-weight:600";
    hint.onclick = () => { epVarFillAll(field); hint.remove(); };
    td.appendChild(hint);
  }
  hint.textContent = `↓ Barcha qatorlarga (${rows.length - 1} ta)`;
}

// Birinchi qator qiymatini qolgan ranglarga tarqatamiz
function epVarFillAll(field) {
  const cls = { boxes: "evr-boxes", inbox: "evr-inbox", dona: "evr-qty",
                cost: "evr-cost", ulg: "evr-ulg" }[field];
  if (!cls) return;
  const rows = [...document.querySelectorAll("#ep-var-tbody tr")];
  if (rows.length < 2) return;
  const val = rows[0].querySelector(`.${cls}`)?.value || "";
  rows.slice(1).forEach(r => {
    const el = r.querySelector(`.${cls}`);
    if (!el) return;
    el.value = val;
    // pochka/sig'im/dona o'zaro bog'liq — mavjud qayta-hisob ishlatiladi
    if (["boxes", "inbox", "dona"].includes(field)) {
      try { epVarRecalc(el, field); } catch (e) {}
    }
  });
  if (typeof epVarTotals === "function") epVarTotals();
  toast(`✅ ${rows.length - 1} ta rangga qo'llandi`);
}

function epVarRenderTable() {
  const tbody = document.getElementById("ep-var-tbody");
  if (!tbody) return;
  const cur = (db.products || []).find(x => x.sku === editSku);
  const grp = _epVarGroup(cur);
  if (!grp.length) { tbody.innerHTML = ""; return; }

  const rate   = db.settings?.rate || 12800;
  const mode   = db.settings?.priceCurrency || "uzs";
  const inpCss = "width:100%;font-family:inherit;font-size:12.5px;border:1px solid var(--brd);" +
                 "border-radius:6px;padding:6px 8px;box-sizing:border-box";

  tbody.innerHTML = grp.map(pr => {
    const color = (pr.variants || [])[0]?.color || "—";
    const qty   = (pr.variants || []).reduce((a, v) => a + (v.qty || 0), 0);
    // Pochka hisobi: 1 pochkadagi dona (inBox) va pochka soni
    // Variantdagi quti sig'imi ustuvor (rang darajasida)
    const _v0 = (pr.variants || [])[0];
    const inBox = (parseInt(_v0 && _v0.inBox) || 0) > 0
      ? parseInt(_v0.inBox)
      : (pr.inBox && pr.inBox > 0 ? pr.inBox : 1);
    // 2026-07-26: pochka BUTUN son (o'nli kasr chalg'itardi), qoldiq
    // esa "ochilgan" bo'lib ajraladi
    const pochka = inBox > 0 ? Math.floor(qty / inBox) : 0;
    const _rest  = inBox > 0 ? (qty - pochka * inBox) : 0;
    // 2026-07-26: tannarx HAR DOIM SO'MDA ko'rsatiladi
    const cost = (typeof getCostUzs === "function")
      ? getCostUzs(pr)
      : Math.round((pr.costUsd || 0) * rate);
    const isCurrent = pr.sku === editSku;
    return `
      <tr data-sku="${pr.sku}" style="border-top:1px solid var(--brd);
        ${isCurrent ? "background:#FFFBF0" : ""}">
        <td style="padding:4px;text-align:center">
          <div style="width:32px;height:32px;border-radius:6px;border:1px solid var(--brd);
            overflow:hidden;background:var(--bg);display:flex;align-items:center;justify-content:center">
            ${pr.image ? `<img src="${pr.image}" style="width:100%;height:100%;object-fit:cover">`
                       : `<i class="ti ti-photo" style="font-size:13px;color:#ccc"></i>`}
          </div>
        </td>
        <td style="padding:5px 8px;white-space:nowrap">
          <b>${color}</b>
          ${isCurrent ? `<div style="font-size:10px;color:var(--acc);font-weight:700">joriy</div>` : ""}
        </td>
        <td style="padding:4px"><input class="evr-boxes" type="number" min="0" step="1"
          inputmode="numeric" value="${pochka}" style="${inpCss}"
          oninput="epVarRecalc(this,'boxes');epVarFillHint(this,'boxes')"></td>
        <td style="padding:4px"><input class="evr-inbox" type="number" min="1" inputmode="numeric"
          value="${inBox}" style="${inpCss}" oninput="epVarRecalc(this,'inbox');epVarFillHint(this,'inbox')"></td>
        <td style="padding:4px">
          <input class="evr-qty" type="number" min="0" inputmode="numeric"
            value="${qty}" style="${inpCss}" oninput="epVarRecalc(this,'dona');epVarFillHint(this,'dona')">
          <div class="evr-hint" style="font-size:10px;color:var(--mut);margin-top:2px">
            ${_rest > 0 ? `${pochka} pch + <span style="color:#B45309">${_rest} dona</span>` : ""}
          </div>
        </td>
        <td style="padding:4px"><input class="evr-cost" type="text" data-price
          value="${fmt(cost)}" oninput="fmtInput(this);epVarFillHint(this,'cost')" style="${inpCss}"></td>
        <td style="padding:4px"><input class="evr-ulg" type="text" data-price
          value="${fmt(pr.ulgurjiNarx || 0)}" oninput="fmtInput(this);epVarFillHint(this,'ulg')" style="${inpCss}"></td>
      </tr>`;
  }).join("");

  epVarTotals();
}

// Guruhdagi barcha tovarlarni saqlash
async function epSaveVariativ() {   // ✅ 2026-08-19: server orqali (async)
  // ✅ 2026-08-18 RUXSAT: bevosita yozish yo'li — oyna qulfiga
  // qo'shimcha ikkinchi qavat (kelajakda boshqa yo'ldan chaqirilsa ham).
  if (typeof requireDo === "function" && !requireDo("katalog","edit")) return;
  const rows = [...document.querySelectorAll("#ep-var-tbody tr")];
  if (!rows.length) { toast("Tahrirlanadigan qator yo'q", "err"); return; }

  const rate = db.settings?.rate || 12800;
  const mode = db.settings?.priceCurrency || "uzs";
  let changed = 0;
  const _varYangilar = [];   // ✅ 2026-08-19: serverga to'plamli

  // 2026-07-26: NOLGA TUSHISH HIMOYASI — qoldiq 0 bo'lsa tovar
  // katalog/ombordan yo'qolib qolardi. Endi ogohlantiriladi.
  const _zeroRows = rows.filter(r =>
    (parseInt(r.querySelector(".evr-qty")?.value) || 0) <= 0);
  if (_zeroRows.length) {
    const _names = _zeroRows.map(r => {
      const sku = r.dataset.sku;
      const p = (db.products || []).find(x => x.sku === sku);
      return (p?.variants || [])[0]?.color || sku;
    }).join(", ");
    if (!confirm(`⚠️ Quyidagi ranglar qoldig'i NOL bo'ladi:\n${_names}\n\n` +
                 `Ular katalog va omborda "qoldiq yo'q" bo'lib ko'rinadi.\nDavom etasizmi?`)) return;
  }

  rows.forEach(r => {
    const sku = r.dataset.sku;
    const p = (db.products || []).find(x => x.sku === sku);
    if (!p) return;

    const qty   = parseInt(r.querySelector(".evr-qty")?.value) || 0;
    const inBox = parseInt(r.querySelector(".evr-inbox")?.value) || 1;
    const cost  = _numFromInput(r.querySelector(".evr-cost"));
    const ulg   = _numFromInput(r.querySelector(".evr-ulg"));

    // 2026-07-26: TANNARX SO'MDA — kiritilgan raqam to'g'ridan-to'g'ri
    // so'm (avval "both" rejimda dollar deb qabul qilinardi)
    const costUzsVal = Math.round(cost);
    const costUsd    = rate > 0 ? (costUzsVal / rate) : 0;

    // Qoldiq — variantlar bo'yicha taqsimlanadi (bittadan ko'p bo'lsa nisbatan)
    const vars = p.variants || [];
    const oldTotal = vars.reduce((a, v) => a + (v.qty || 0), 0);
    if (vars.length === 1) {
      vars[0].qty = qty;
    } else if (oldTotal > 0) {
      // Nisbatni saqlab qayta taqsimlaymiz
      let left = qty;
      vars.forEach((v, i) => {
        if (i === vars.length - 1) { v.qty = Math.max(0, left); return; }
        const share = Math.round(qty * ((v.qty || 0) / oldTotal));
        v.qty = share; left -= share;
      });
    } else if (vars.length) {
      vars[0].qty = qty;
    }

    // 2026-07-26: quti sig'imi VARIANTGA ham yoziladi (rang darajasida)
    if (inBox > 0) {
      if ((p.inBox || 1) !== inBox) { p.inBox = inBox; changed++; }
      (p.variants || []).forEach(v => { v.inBox = inBox; });
    }
    if ((p.costUzs || 0) !== costUzsVal) { p.costUzs = costUzsVal; changed++; }
    p.costUsd = costUsd;   // zaxira (eski kod uchun)
    if ((p.ulgurjiNarx || 0) !== ulg) { p.ulgurjiNarx = ulg; changed++; }
    // ✅ 2026-08-12: QOLDIQ O'ZGARISHI endi IZ QOLDIRADI (kirim/chiqim +
    // audit). Avval bu yerda son jimgina qayta yozilardi.
    if (oldTotal !== qty) {
      _stockMove(p, (vars[0] || {}).color || "", "", qty - oldTotal,
                 "Qoldiq tahriri (variativ)");
      changed++;
    }
    try { p.updatedAt = new Date().toISOString(); _varYangilar.push(p); } catch (e) {}
  });

  // ✅ 2026-08-19: VARIATIV TAHRIR SERVERGA (to'plamli).
  // Bu jadval bir amalda bir necha tovarning TANNARX, ULGURJI NARX va
  // POCHKA SIG'IMINI o'zgartiradi — pulga tegadigan maydonlar. Avval
  // hammasi lokal ketardi va muhr solishtirilmasdi.
  // ⚠️ Qoldiq bu yerda `_stockMove` (server yo'li) orqali o'zgaradi;
  // to'plamli yozuvda esa qoldiq SERVERDAN olinadi — ikki marta
  // qo'llanmasin. Ya'ni sonni faqat bitta mexanizm boshqaradi.
  if (typeof serverSaveBulkProducts === "function" && _varYangilar.length) {
    const _r = await serverSaveBulkProducts(_varYangilar);
    if (_r && _r.ok) {
      console.log("📤 Variativ tahrir: " + _r.soni + " tovar serverga yozildi");
      // 532: server qanday muhr qaytardi — o'lchov
      try {
        const _s0 = (_r.rows && _r.rows[0]) || null;
        console.log("   532 · server muhri: " +
          ((_s0 && _s0.data && _s0.data.updatedAt) || "(QAYTMADI)") +
          " · qurilma soati: " + new Date().toISOString() +
          " · qatorlar: " + ((_r.rows || []).length));
      } catch (e) {}
      // ═══════════════════════════════════════════════════════════════
      // 🔴 531 (2026-08-22): SERVER MUHRI QABUL QILINADI (§3.23).
      // ═══════════════════════════════════════════════════════════════
      // 530 da AYNAN shu nuqson asosiy oyna yo'lida tuzatilgan edi,
      // lekin VARIATIV jadval yo'li ochiq qolgan ekan — jonli sinovda
      // ogohlantirish shundan qaytdi (egasi: "pushdan keyin ham
      // yo'qolmadi", ekranda "3 ta rang saqlandi" ko'rinib turibdi).
      // Yuqorida (5326-qator) muhr QURILMA soati bilan qo'yiladi,
      // server esa uni O'Z soati bilan qayta yozadi
      // (`api/pul.js` — `d.updatedAt = now`). Lokal nusxa qurilma
      // vaqtida qolsa, keyingi "Saqlash" da server o'z vaqtini
      // yangiroq deb topadi va SOXTA to'qnashuv chiqaradi.
      // Endi server bergan muhr olinadi — ham tovarga, ham ochiq
      // oynaning taqqoslash nuqtasiga (`_epBaseAt`).
      try {
        (_r.rows || []).forEach(sr => {
          const _at = (sr && sr.data && sr.data.updatedAt) || (sr && sr.updated_at);
          if (!_at || !sr.sku) return;
          const lp = (db.products || []).find(x => String(x.sku) === String(sr.sku));
          if (lp) lp.updatedAt = _at;
          if (typeof editSku !== "undefined" && String(sr.sku) === String(editSku))
            _epBaseAt = String(_at);
        });
      } catch (e) {}
    } else {
      console.warn("📤 Variativ tahrir serverga yozilmadi — lokal saqlandi");
    }
  }

  saveDB();
  // ✅ 2026-08-18 (egasi topgan): ASOSIY OYNA MAYDONLARI YANGILANADI.
  // Ildiz: variativ jadval ham, asosiy oyna ham AYNAN SHU (kirilgan)
  // tovarga yozadi. Asosiy oyna maydonlari esa oyna OCHILGANDAGI eski
  // qiymatlarda turardi — keyin "Saqlash" bosilsa `saveEditProduct`
  // ularni qaytadan yozib, kirilgan rangning tahririni ORQAGA QAYTARARDI.
  // Natija: 6 rangdan 5 tasi saqlanib, aynan kirilgani qaytardi
  // (tannarx, ulgurji narx, pochka sig'imi — pulga tegadigan maydonlar).
  // Endi maydonlar yangi qiymat bilan to'ldiriladi — saqlash tartibi
  // qanday bo'lishidan qat'i nazar natija bir xil bo'ladi.
  try {
    const _cur = (db.products || []).find(x => x.sku === editSku);
    if (_cur) {
      if ($("ep-cost")) {
        $("ep-cost").value = (typeof getCostUzs === "function")
          ? getCostUzs(_cur) : Math.round(_cur.costUzs || 0);
      }
      const _ul = $("ep-ulgurji");
      if (_ul) {
        _ul.value = fmt(_cur.ulgurjiNarx || 0);
        _ul.dataset.raw = String(_cur.ulgurjiNarx || 0);
      }
      if ($("ep-inbox")) $("ep-inbox").value = _cur.inBox || 1;
      if (typeof epUpdateBoxHints === "function") epUpdateBoxHints();
    }
  } catch (e) {}
  try { if (typeof flushCloudSync === "function") flushCloudSync(); } catch(e) {}
  renderKatalog();
  epVarRenderTable();
  toast(changed > 0 ? `✅ ${rows.length} ta rang saqlandi` : "O'zgarish yo'q");
}

// Pochka yoki "pochkada nechta" o'zgarganda DONA qayta hisoblanadi
function epVarRecalc(inp, changed) {
  const tr = inp.closest("tr");
  if (!tr) return;
  const bEl = tr.querySelector(".evr-boxes");
  const iEl = tr.querySelector(".evr-inbox");
  const qEl = tr.querySelector(".evr-qty");
  if (!bEl || !iEl || !qEl) return;

  const inBox = parseInt(iEl.value) || 1;

  if (changed === "dona") {
    // Dona yozildi → pochka avtomat (ochilgan qoldiq bilan)
    const dona = parseInt(qEl.value) || 0;
    bEl.value = inBox > 0 ? Math.floor(dona / inBox) : 0;
  } else {
    // Pochka yoki pochkada o'zgardi → dona avtomat
    const boxes = parseInt(bEl.value) || 0;
    qEl.value = boxes * inBox;
  }

  // Izoh: ochilgan qoldiq
  const dona  = parseInt(qEl.value) || 0;
  const full  = inBox > 0 ? Math.floor(dona / inBox) : 0;
  const rest  = inBox > 0 ? (dona - full * inBox) : 0;
  const hint = tr.querySelector(".evr-hint");
  if (hint) hint.innerHTML = rest > 0
    ? `${full} pch + <span style="color:#B45309">${rest} dona</span>` : "";

  epVarTotals();
}


// Guruh bo'yicha jami
function epVarTotals() {
  const el = document.getElementById("ep-var-total");
  if (!el) return;
  const rows = [...document.querySelectorAll("#ep-var-tbody tr")];
  const pochka = rows.reduce((a, r) => a + (parseFloat(r.querySelector(".evr-boxes")?.value) || 0), 0);
  const dona   = rows.reduce((a, r) => a + (parseInt(r.querySelector(".evr-qty")?.value) || 0), 0);
  el.innerHTML = `Guruhda <b>${rows.length}</b> ta rang · ` +
    `<b>${Math.round(pochka * 100) / 100}</b> pochka · <b>${fmt(dona)}</b> dona`;
}

// ═══════════════════════════════════════════════════════════════
// JAMI DONA'DAN POCHKA HISOBI (2026-07-26)
// Ba'zi do'konlarga tovar pres bilan keladi va ortiqcha donalar
// bo'lishi mumkin: 30 pochka × 5 + 3 dona = 153 dona.
// Endi "Jami dona" ga 153 yozilsa, tizim o'zi 30 pochka va 3 dona
// ochilgan qoldiq deb qabul qiladi.
// Ikki tomonlama:
//   pochka + pochkada  →  dona avtomat  (eski usul, buzilmaydi)
//   dona  + pochkada   →  pochka avtomat (yangi usul)
// ═══════════════════════════════════════════════════════════════
let _apDonaEditing = false;   // dona qo'lda yozilyaptimi

function apDonaChanged() {
  _apDonaEditing = true;
  const donaEl  = $("ap-qty-range");
  const boxEl   = $("ap-boxes");
  const inBoxEl = $("ap-inbox-calc");
  if (!donaEl || !boxEl || !inBoxEl) return;

  const dona  = parseInt(donaEl.value) || 0;
  const inBox = parseInt(inBoxEl.value) || 0;

  if (dona > 0 && inBox > 0) {
    const full = Math.floor(dona / inBox);
    const rest = dona - full * inBox;
    boxEl.value = full;                      // pochka avtomat to'ladi
    _apShowDonaHint(full, rest, inBox, dona);
  } else {
    _apShowDonaHint(0, 0, inBox, dona);
  }
  _apDonaEditing = false;
}

function _apShowDonaHint(full, rest, inBox, dona) {
  const el = $("ap-dona-hint");
  if (!el) return;
  if (!dona || !inBox) { el.textContent = ""; return; }
  el.innerHTML = rest > 0
    ? `<b>${full}</b> pochka × ${inBox} = ${fmt(full*inBox)} dona
       <span style="color:#B45309">+ <b>${rest}</b> dona ochilgan</span>`
    : `<b>${full}</b> pochka × ${inBox} = ${fmt(dona)} dona`;
}

// Variativ jadvalda pochka ↔ dona ikki tomonlama bog'lanish (2026-07-26)
function apVarDonaSync(i, changed) {
  const tr = document.querySelector(`#ap-var-tbody tr[data-vrow="${i}"]`);
  if (!tr) return;
  const bEl = tr.querySelector(".vr-boxes");
  const iEl = tr.querySelector(".vr-inbox");
  const dEl = tr.querySelector(".vr-dona");
  if (!bEl || !iEl || !dEl) return;

  const inBox = parseInt(iEl.value) || 0;

  if (changed === "dona") {
    // Dona yozildi → pochka avtomat (ochilgan qoldiq bilan)
    const dona = parseInt(dEl.value) || 0;
    if (dona > 0 && inBox > 0) bEl.value = Math.floor(dona / inBox);
  } else {
    // Pochka yoki pochkada o'zgardi → dona avtomat
    const boxes = parseInt(bEl.value) || 0;
    if (boxes > 0 && inBox > 0) dEl.value = boxes * inBox;
  }
}


// Narx maydonidan aniq son o'qish (2026-07-26)
// fmtInput probel bilan formatlaydi va dataset.raw ga xom qiymatni
// yozadi. Telefon klaviaturasi maxsus probel qo'yishi mumkin, shuning
// uchun avval dataset.raw, keyin tozalangan matn o'qiladi.
function _numFromInput(el) {
  if (!el) return 0;
  const raw = el.dataset && el.dataset.raw;
  if (raw != null && raw !== "") return parseFloat(raw) || 0;
  return parseFloat(String(el.value || "").replace(/[^\d.]/g, "")) || 0;
}

// Tahrirlashda JAMI DONA to'g'ridan-to'g'ri o'zgartirish (2026-07-26)
// Ochilgan qoldiq shu yerdan boshqariladi: 78 dona, pochkada 5 →
// 15 pochka + 3 dona ochilgan.
function epUpdateB2Dona(color, val) {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  const v = p.variants.find(x => x.color === color); if (!v) return;
  const _eskiQ = Number(v.qty) || 0;
  v.qty = Math.max(0, parseInt(val) || 0);
  if (typeof _serverStockQueue === "function")     // ✅ 2026-08-18: farq serverga
    _serverStockQueue(p, color, v.size || "", (Number(v.qty) || 0) - _eskiQ);
  epRenderColorCards(p);
}

// ═══ KATEGORIYA TEGLARI (2026-07-26) ═══
// Kategoriya endi qat'iy ro'yxat emas — erkin yoziladi. Avval
// ishlatilganlari avtomat taklif qilinadi, yangisi shunchaki qo'shiladi.
// Manba: mavjud tovarlar + tur bo'yicha standart ro'yxat (CATS).

// ═══════════════════════════════════════════════════════════════
// KATEGORIYA TAKLIFI (2026-07-30)
// ═══════════════════════════════════════════════════════════════
// Variativ rang kiritish uslubi: maydon BO'SH turadi, yozishni
// boshlaganda avval ishlatilganlari taklif bo'ladi, mos keladigani
// bo'lmasa "qo'shish" qatori chiqadi.
//
// Nega kerak edi: avval `<datalist>` ishlatilardi — u telefonda
// deyarli ochilmaydi, shu bois har safar to'liq qo'lda yozishga
// to'g'ri kelardi va kichik farq bilan yozilgan nom ("krossovka" /
// "Krossovka") ikkinchi kategoriya yaratib yuborardi.
//
// Qiymat AVVALGIDEK #ap-cat / #ep-cat maydonining o'zida turadi —
// saqlash kodi (katalog.js:1664, 1232, 4115) tegilmadi.

// Qo'lda qo'shilgan kategoriyalar
function _catCustom() {
  try { return Array.isArray(db.settings?.categories) ? db.settings.categories : []; }
  catch(e) { return []; }
}

// Barcha ma'lum kategoriyalar (takrorsiz, katta-kichik harf farqisiz)
function allCategories(type) {
  const map = new Map();
  const add = c => {
    const t = String(c || "").trim();
    if (t && !map.has(t.toLowerCase())) map.set(t.toLowerCase(), t);
  };
  (db.products || []).forEach(p => add(p.category));
  _catCustom().forEach(add);
  const t = type || (typeof currentApType !== "undefined" ? currentApType : "oyoq");
  ((typeof CATS !== "undefined" && CATS[t]) || []).forEach(add);
  return [...map.values()].sort((a, b) => a.localeCompare(b, "uz"));
}

// prefix: "ap" (qo'shish) yoki "ep" (tahrirlash)
// Yozilgan matnga qarab taklif ro'yxatini chizadi. Bo'sh bo'lsa —
// hech narsa ko'rsatilmaydi (oyna to'lib ketmasin).
function catSuggest(prefix) {
  const inp = document.getElementById(prefix + "-cat");
  const box = document.getElementById(prefix + "-cat-sug");
  if (!inp || !box) return;

  const q = (inp.value || "").trim();
  if (!q) { box.style.display = "none"; box.innerHTML = ""; return; }

  const ql   = q.toLowerCase();
  const all  = allCategories(prefix === "ap"
    ? (typeof currentApType !== "undefined" ? currentApType : null) : null);
  const hits = all.filter(c => c.toLowerCase().includes(ql)).slice(0, 6);
  const same = all.some(c => c.toLowerCase() === ql);
  const esc  = v => (typeof jsEsc === "function" ? jsEsc(v) : String(v));

  let html = hits.map(c => `
    <div onmousedown="event.preventDefault();catSuggestPick('${prefix}','${esc(c)}')"
      style="padding:9px 12px;font-size:14px;cursor:pointer;border-bottom:1px solid var(--brd)"
      onmouseover="this.style.background='var(--bg)'"
      onmouseout="this.style.background='#fff'">${c}</div>`).join("");

  // Aynan shunday kategoriya yo'q — qo'shish taklif qilinadi
  if (!same) {
    html += `
      <div onmousedown="event.preventDefault();catSuggestAdd('${prefix}')"
        style="padding:9px 12px;font-size:14px;cursor:pointer;color:#0D1B2A;
        background:#FFF7ED;font-weight:700">
        <i class="ti ti-plus"></i> "${q}" ni qo'shish
      </div>`;
  }

  box.innerHTML = html;
  box.style.display = html ? "block" : "none";
}

function catSuggestPick(prefix, name) {
  const inp = document.getElementById(prefix + "-cat");
  const box = document.getElementById(prefix + "-cat-sug");
  if (inp) inp.value = name;
  if (box) { box.style.display = "none"; box.innerHTML = ""; }
}

// Yangi kategoriyani ro'yxatga saqlaydi — tovar saqlanmasdan
// oldin ham keyingi safar taklifda chiqsin
function catSuggestAdd(prefix) {
  const inp = document.getElementById(prefix + "-cat");
  if (!inp) return;
  const n = (inp.value || "").trim();
  if (!n) return;
  try {
    if (!db.settings) db.settings = {};
    if (!Array.isArray(db.settings.categories)) db.settings.categories = [];
    if (!db.settings.categories.some(c => String(c).toLowerCase() === n.toLowerCase())) {
      db.settings.categories.push(n);
      saveDB();
    }
  } catch(e) {}
  catSuggestPick(prefix, n);
  toast(`✅ "${n}" qo'shildi`);
}

// Maydondan chiqilganda ro'yxat yopiladi. Kechikish kerak — aks holda
// taklif bosilishidan oldin yopilib, bosish ishlamay qolardi.
function catSuggestClose(prefix) {
  setTimeout(() => {
    const box = document.getElementById(prefix + "-cat-sug");
    if (box) { box.style.display = "none"; box.innerHTML = ""; }
  }, 150);
}

// Enter — birinchi taklifni oladi, bo'lmasa yozilganini qo'shadi
function catSuggestKey(prefix, e) {
  if (!e) return;
  if (e.key === "Escape") { catSuggestClose(prefix); return; }
  if (e.key !== "Enter") return;
  e.preventDefault();
  const inp = document.getElementById(prefix + "-cat");
  const q   = ((inp && inp.value) || "").trim();
  if (!q) return;
  const hit = allCategories().find(c => c.toLowerCase().includes(q.toLowerCase()));
  if (hit) catSuggestPick(prefix, hit);
  else catSuggestAdd(prefix);
}

function fillCatSuggest(type) {
  const dl = document.getElementById("cat-suggest");
  if (!dl) return;
  const set = new Set();
  // 1) Do'konda allaqachon ishlatilgan kategoriyalar (eng qimmatlisi)
  (db.products || []).forEach(p => {
    const c = (p.category || "").trim();
    if (c) set.add(c);
  });
  // 2) Tur bo'yicha standartlar (bo'sh do'kon uchun boshlang'ich)
  const t = type || currentApType || "oyoq";
  ((typeof CATS !== "undefined" && CATS[t]) || []).forEach(c => {
    if (c && String(c).trim()) set.add(String(c).trim());
  });
  dl.innerHTML = [...set]
    .sort((a, b) => a.localeCompare(b, "uz"))
    .map(c => `<option value="${String(c).replace(/"/g, "&quot;")}">`)
    .join("");
}


// ═══ TOVAR TARIXI v1 (2026-08-12) ═════════════════════
// FAQAT O'QIYDI — hech narsa yozmaydi, o'zgartirmaydi. Mavjud
// ma'lumotdan (id-vaqtmuhri, ombor, chiqimlar, sotuvlar) tovarning
// yo'lini tiklaydi: qachon kiritildi, qachon kirim bo'ldi, kimga
// nechta sotildi, qachon tahrirlandi, qachon qoldiq nolga tushdi.
// v2 (audit_log bilan) keyinroq: kim kiritdi/tahrirladi/o'chirdi.
function showProductHistory(sku, vp) {
  // 2026-08-12 (arxiv): `vp` — O'CHIRILGAN tovarning saqlangan nusxasi.
  // Tovar katalogda yo'q bo'lsa ham tarixi ko'rsatiladi (sotuvlar
  // cheklarda qolgan, kirimlar esa o'lim-nusxasida).
  const p = (db.products || []).find(x => x.sku === sku) || vp;
  if (!p) { toast("Tovar topilmadi", "err"); return; }
  const _virt = !((db.products || []).some(x => x.sku === sku));

  // 2026-08-12: sonlar POCHKA + DONA ko'rinishida (§3.3: variant.inBox
  // ustuvor, p.inBox zaxira). Quti sig'imi 1 bo'lsa faqat dona.
  const _inBox = (() => {
    const v0 = (p.variants || [])[0];
    return parseInt(v0 && v0.inBox) || parseInt(p.inBox) || 1;
  })();
  const _pd = (n, box) => {
    n = parseInt(n) || 0;
    const bx = parseInt(box) || _inBox;
    if (bx <= 1) return n + " dona";
    const po = Math.floor(n / bx), d = n % bx;
    return (po ? po + " pochka" : "") + (po && d ? " " : "") +
           (d || !po ? d + " dona" : "");
  };

  const ev = [];   // {ts, sana, vaqt, tur, matn, oʻng}
  const _d = (dt, tm) => (dt || "") + (tm ? " " + tm : "");

  // 1) Yaratilgan — id vaqt muhridan (§3.14)
  const _idTs = (() => {
    const n = parseInt(String(p.id || "").slice(0, 13), 10);
    return (n > 1600000000000 && n < 4000000000000) ? n : null;
  })();
  if (_idTs) {
    const d = new Date(_idTs);
    ev.push({ ts: _idTs, sana: d.toISOString().slice(0,10),
      vaqt: d.toTimeString().slice(0,5), tur: "yaratildi",
      matn: "Tovar katalogga kiritildi", ong: "" });
  }

  // 2) KIRIMLAR (ombor)
  (_virt && Array.isArray(p._ombor) ? p._ombor
        : (db.ombor || []).filter(o => o.sku === sku)).forEach(o => {
    ev.push({ ts: new Date(_d(o.date, o.time || "00:00")).getTime() || 0,
      sana: o.date || "", vaqt: o.time || "",
      tur: "kirim", n: (parseInt(o.qty) || 0),
      matn: "Kirim · " + (o.color || "—") + " · " + _pd(o.qty) +
            (o.supplier ? " · " + o.supplier : "") +
            (o.partiya ? " (" + o.partiya + ")" : ""),
      ong: o.kirimNarxi ? fmt(o.kirimNarxi) + " so'm/dona" : "" });
  });

  // 3) CHIQIMLAR (yozib tashlash / ichki chiqim)
  (db.chiqimlar || []).filter(c => c.sku === sku).forEach(c => {
    ev.push({ ts: new Date(_d(c.date, c.time || "00:00")).getTime() || 0,
      sana: c.date || "", vaqt: c.time || "", tur: "chiqim", n: (parseInt(c.qty) || 0),
      matn: "Chiqim · " + (c.color || "—") + " · " + _pd(c.qty) +
            (c.reason ? " · " + c.reason : ""),
      ong: "" });
  });

  // 4) SOTUVLAR (cheklar ichidan)
  (db.sales || []).forEach(sale => {
    (sale.items || []).forEach(it => {
      if (it.sku !== sku) return;
      ev.push({ ts: new Date(_d(sale.date, sale.time || "00:00")).getTime() || 0,
        sana: sale.date || "", vaqt: sale.time || "",
        tur: sale.cancelled ? "bekor" : "sotuv", n: (sale.cancelled ? 0 : (parseInt(it.qty) || 0)),
        matn: (sale.cancelled ? "BEKOR: " : "") + "Sotuv · " +
              (it.color || "—") + (it.size ? " / " + it.size : "") +
              " · " + _pd(it.qty, it.inBox) + " · " +
              (sale.customerName || "Mijozsiz"),
        saleId: sale.id,
        ong: (sale.chekNum || "") });
    });
  });

  // 4b) QAYTARISHLAR (2026-08-12) — avval HISOBGA OLINMASDI:
  // "Jami sotildi" qaytarilgan tovarlarni ham sanab, kirimdan katta
  // chiqardi (jonli: 30 pochka kirim / 35 pochka "sotildi"). Endi
  // qaytarish alohida voqea va sotuv yig'indisidan AYIRILADI.
  (db.returns || []).forEach(r => {
    (r.items || []).forEach(it => {
      if (it.sku !== sku) return;
      ev.push({ ts: new Date(_d(r.date, r.time || "00:00")).getTime() || 0,
        sana: r.date || "", vaqt: r.time || "", tur: "qaytarish",
        n: -(parseInt(it.qty) || 0),
        matn: "Qaytarish · " + (it.color || "—") +
              (it.size ? " / " + it.size : "") + " · " + _pd(it.qty) +
              " · " + (r.customerName || "Mijozsiz") +
              (r.reason ? " · " + r.reason : ""),
        ong: r.refundNo || r.origChekNum || "" });
    });
  });

  // 5) ⚠️ 2026-08-12: "Oxirgi tahrir" OLIB TASHLANDI — ALDAMCHI edi.
  // `updatedAt` tovar TAHRIRLANGANDA emas, SINXRON paytida qo'yiladi
  // (cloud.js push ichida) — shu sabab hamma tovarda BIR XIL vaqt
  // ko'rinardi. Haqiqiy tahrir vaqti audit (v2) bilan keladi.

  // 6) AUDIT yozuvlari (v2, 2026-08-12) — "kim qildi"
  (db.auditLog || []).filter(a => a.entity === "product" && a.entityId === sku)
    .forEach(a => {
      ev.push({ ts: new Date(a.ts).getTime() || 0, sana: a.date || "",
        vaqt: a.time || "",
        tur: (a.action === "inventar" || a.action === "narx") ? "inventar" : "audit",
        matn: (a.action === "delete" ? "O'CHIRILDI"
              : a.action === "narx"
                ? (a.label || "").split(" · ").slice(-1)[0] + ": " +
                  fmt(Number(a.before) || 0) + " → " + fmt(Number(a.after) || 0)
              : a.action === "restore" ? "ARXIVDAN TIKLANDI"
              : a.action === "inventar"
                ? "Qoldiq tuzatildi: " + (a.before || "?") + " → " + (a.after || "?") + " dona"
                : a.action) + " — " +
              (a.actor || "?") + (a.device ? " (" + a.device + ")" : ""),
        ong: a.action === "inventar" ? (a.note || "") : (a.before || "") });
    });

  ev.sort((a,b) => (a.ts || 0) - (b.ts || 0));

  // Yig'indilar
  const kirimJami = ev.filter(x => x.tur === "kirim").reduce((a,x) => a + (x.n || 0), 0);
  const qaytJami  = ev.filter(x => x.tur === "qaytarish").reduce((a,x) => a - (x.n || 0), 0);
  const sotuvJami = ev.filter(x => x.tur === "sotuv" || x.tur === "qaytarish")
    .reduce((a,x) => a + (x.n || 0), 0);   // qaytarish MANFIY
  const qoldiq = (p.variants || []).reduce((a,v) => a + (v.qty || 0), 0);
  // ⚠️ 2026-08-12: BALANS QATORI. Kirim − sof sotildi = qoldiq bo'lishi
  // kerak. Farq chiqsa — tovar KIRIM YOZUVISIZ kelgan: (a) Billz/Excel
  // importida qoldiq bilan yaratilgan, (b) kirim yozuvi keyin o'chirilgan
  // yoki tahrirlangan. Buni yashirmaymiz — ochiq ko'rsatamiz, aks holda
  // raqamlar "mos kelmayapti" bo'lib qoladi (jonli: 30 kirim / 33 sotildi).
  // ⚠️ 2026-08-12 (2-tahrir): NOM NEYTRAL. Avval "boshlang'ich qoldiq"
  // deb atalgandi — sababi ANIQLANMAGAN holda nom qo'yish xato edi.
  // Ma'lum sabablar: (a) inventarizatsiya (endi iz qoladi), (b) import,
  // (c) o'chirilgan kirim yozuvi.
  const farq = qoldiq + sotuvJami - kirimJami;
  if (farq !== 0) {
    ev.unshift({ ts: 0, sana: "", vaqt: "", tur: "farq", n: 0,
      matn: "⚠️ Balans farqi: " + _pd(Math.abs(farq)) +
            (farq > 0 ? " — kirimsiz kelgan" : " — chiqimsiz ketgan") +
            " (inventarizatsiya, import yoki o'chirilgan yozuv)", ong: "" });
  }

  const _ico = { yaratildi:"➕", kirim:"📥", chiqim:"📤",
                 sotuv:"🛒", bekor:"❌", tahrir:"✏️",
                 audit:"⚖️", qaytarish:"↩️", farq:"⚠️", inventar:"📋" };
  const _clr = { yaratildi:"#6B4FBB", kirim:"#0F6E56", chiqim:"#993C1D",
                 sotuv:"#185FA5", bekor:"#A32D2D", tahrir:"#5F5E5A",
                 audit:"#A32D2D", qaytarish:"#8A6D1F", farq:"#8A6D1F", inventar:"#5F5E5A" };

  $("ph-title").textContent = p.name + (_virt ? " — tarix (O'CHIRILGAN)" : " — tarix");
  $("ph-body").innerHTML =
    `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      ${[["Jami kirim", _pd(kirimJami)],
         ["Sof sotildi", _pd(sotuvJami)],
         ...(qaytJami ? [["Qaytarildi", _pd(qaytJami)]] : []),
         ...(farq !== 0 ? [["⚠️ Balans farqi", _pd(Math.abs(farq))]] : []),
         ["Hozirgi qoldiq", _pd(qoldiq)],
         ["Voqealar", ev.length + " ta"]].map(([k,v]) =>
        `<div style="background:var(--bg2,#F5F5F3);border-radius:8px;padding:8px 12px;min-width:110px">
           <div style="font-size:11px;color:var(--mut)">${k}</div>
           <div style="font-size:16px;font-weight:600">${v}</div>
         </div>`).join("")}
    </div>` +
    (ev.length ? `<div style="display:flex;flex-direction:column;gap:6px">` +
      ev.map(x =>
        `<div style="display:flex;gap:10px;align-items:flex-start;
                     border-left:3px solid ${_clr[x.tur]||"#ccc"};
                     background:var(--bg2,#FAFAF8);padding:8px 10px;border-radius:0 8px 8px 0">
           <div style="font-size:15px">${_ico[x.tur]||"•"}</div>
           <div style="flex:1;min-width:0">
             <div style="font-size:13px;font-weight:500">${x.matn}</div>
             <div style="font-size:11px;color:var(--mut)">${x.sana}${x.vaqt ? " · " + x.vaqt : ""}${
               x.ong ? " · " + (x.saleId
                 ? `<a href="#" onclick="phOpenSale(${x.saleId});return false"
                      style="color:#185FA5;font-weight:600">${x.ong}</a>`
                 : x.ong) : ""}</div>
           </div>
         </div>`).join("") + `</div>`
      : `<div style="color:var(--mut);font-size:13px">Bu tovar bo'yicha yozuv topilmadi.</div>`) +
    `<div style="margin-top:12px;font-size:11px;color:var(--mut)">
       ℹ️ Tarix qurilmadagi ma'lumotdan chiziladi (sinxron oynasi 365 kun).
       "Kim qildi" ma'lumoti keyingi bosqichda (audit) qo'shiladi.
     </div>`;
  openModal("prodhist", true);
}


// 2026-08-12: tarixdagi chek raqamidan sotuv tafsilotiga o'tish.
// Xavfsiz: mavjud openSaleDetail chaqiriladi, yangi mantiq yo'q.
function phOpenSale(saleId) {
  try {
    closeModal("prodhist");
    closeModal("editprod");
    if (typeof nav === "function") nav("tarix");
    setTimeout(() => {
      if (typeof openSaleDetail === "function") openSaleDetail(saleId);
    }, 260);
  } catch (e) { toast("Sotuvni ochib bo'lmadi", "err"); }
}


// ═══ B · O'CHIRILGANLAR ARXIVI (2026-08-12) ═════════════
// FAQAT O'QIYDI. Manba: audit_log dagi "delete" yozuvlari (ular
// ichida o'chirish lahzasidagi TO'LIQ nusxa bor — A bosqichi).
// Sotuvlar baribir cheklarda qolgani uchun o'chirilgan tovarning
// sotuv tarixi ham to'liq ko'rinadi.
function showDeletedProducts() {
  // ARXIV v2 (2026-08-12). Ikki manba: (1) audit \u2014 12-avgustdan keyingi
  // o'chirishlar, to'liq nusxasi bilan (TIKLASH mumkin); (2) SOTUVLARDAN \u2014
  // katalogda yo'q, lekin cheklarda uchraydigan SKU'lar = eski davr
  // o'chirishlari (nusxasi yo'q, lekin sotuv tarixi bor).
  const dels = (db.auditLog || [])
    .filter(a => a.action === "delete" && a.entity === "product")
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  const bor = new Set((db.products || []).map(x => String(x.sku)));
  const auditSku = new Set(dels.map(a => String(a.entityId)));

  const eski = {};
  (db.sales || []).forEach(sa => {
    (sa.items || []).forEach(it => {
      const k = String(it.sku || "");
      if (!k || bor.has(k) || auditSku.has(k)) return;
      if (!eski[k]) eski[k] = { sku: k, name: it.name || k, qty: 0, oxirgi: "" };
      if (!sa.cancelled) eski[k].qty += (parseInt(it.qty) || 0);
      if ((sa.date || "") > eski[k].oxirgi) eski[k].oxirgi = sa.date || "";
    });
  });
  const eskiList = Object.values(eski).sort((a, b) => b.oxirgi.localeCompare(a.oxirgi));

  const satildi = (sku) => (db.sales || []).reduce((n, sa) =>
    n + (sa.cancelled ? 0 : (sa.items || [])
      .filter(i => i.sku === sku)
      .reduce((m, i) => m + (parseInt(i.qty) || 0), 0)), 0);

  $("ph-title").textContent = "O'chirilgan tovarlar";
  $("ph-body").innerHTML =
    (dels.length ? `<div style="font-size:12px;font-weight:600;color:var(--mut);margin:2px 0 6px">
        \u2696\ufe0f IZI BOR (tiklash mumkin)</div>` + dels.map(a => {
      let snap = null;
      try { snap = JSON.parse(a.note || "{}"); } catch (e) {}
      const nusxa = snap && snap.sku;
      return `<div style="border-left:3px solid #A32D2D;background:var(--bg2,#FAFAF8);
                   padding:10px 12px;border-radius:0 8px 8px 0;margin-bottom:8px">
        <div style="font-weight:600;font-size:14px">${a.label || a.entityId}</div>
        <div style="font-size:11.5px;color:var(--mut);margin-top:2px">
          \u2696\ufe0f ${a.actor || "?"}${a.device ? " (" + a.device + ")" : ""}
          \u00b7 ${a.date || ""} ${a.time || ""} \u00b7 ${a.before || ""}
        </div>
        <div style="font-size:12px;margin-top:6px">
          SKU: <b>${a.entityId}</b>${snap && snap.art ? " \u00b7 ART: " + snap.art : ""}
          ${snap && snap.ulgurjiNarx ? " \u00b7 Ulgurji: " + fmt(snap.ulgurjiNarx) : ""}
          \u00b7 Sotilgan: <b>${satildi(a.entityId)}</b> dona
        </div>
        ${snap && snap.colorBarcodes && Object.keys(snap.colorBarcodes).length
          ? `<div style="font-size:11px;color:var(--mut);margin-top:4px">Kodlari: ${
              Object.entries(snap.colorBarcodes).map(([c, b]) => c + "=" + b).join(" \u00b7 ")}</div>` : ""}
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-ghost btn-sm" onclick="phDeletedHistory('${a.id}')">
            <i class="ti ti-history"></i> Tarix
          </button>
          ${nusxa ? `<button class="btn btn-ghost btn-sm" onclick="phRestoreProduct('${a.id}')"
             style="color:#0F6E56"><i class="ti ti-refresh"></i> Tiklash</button>` : ""}
        </div>
      </div>`;
    }).join("") : "") +
    (eskiList.length ? `<div style="font-size:12px;font-weight:600;color:var(--mut);margin:14px 0 6px">
        🕓 ESKI DAVR (12-avgustgacha \u2014 nusxasi yo'q)</div>` + eskiList.map(e =>
      `<div style="border-left:3px solid #8A6D1F;background:var(--bg2,#FAFAF8);
                   padding:9px 12px;border-radius:0 8px 8px 0;margin-bottom:6px">
        <div style="font-weight:600;font-size:13.5px">${e.name}</div>
        <div style="font-size:11.5px;color:var(--mut);margin-top:2px">
          SKU: <b>${e.sku}</b> \u00b7 Sotilgan: <b>${e.qty}</b> dona
          \u00b7 Oxirgi sotuv: ${e.oxirgi || "\u2014"}
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:6px"
          onclick='showProductHistory(${JSON.stringify(e.sku)}, {sku:${JSON.stringify(e.sku)}, name:${JSON.stringify(e.name)}, variants:[], _ombor:[]})'>
          <i class="ti ti-history"></i> Tarix
        </button>
      </div>`).join("") : "") +
    ((!dels.length && !eskiList.length)
      ? `<div style="color:var(--mut);font-size:13px">O'chirilgan tovar topilmadi.</div>` : "");
  openModal("prodhist", true);
}

// Arxiv yozuvidan TARIX oynasi (o'lim-nusxasi bilan)
function phDeletedHistory(auditId) {
  const a = (db.auditLog || []).find(x => String(x.id) === String(auditId));
  if (!a) { toast("Yozuv topilmadi", "err"); return; }
  let snap = {};
  try { snap = JSON.parse(a.note || "{}"); } catch (e) {}
  showProductHistory(a.entityId, {
    sku: a.entityId, name: snap.name || a.label || a.entityId,
    art: snap.art || "", inBox: snap.inBox || 1,
    variants: snap.variants || [], _ombor: snap.ombor || []
  });
}

// \u267b\ufe0f TIKLASH \u2014 saqlangan nusxadan YANGI SKU bilan qayta yaratadi.
// Eski SKU QAYTARILMAYDI: uning sotuv tarixi eski SKU'ga bog'langan,
// qayta ishlatilsa ikki davr aralashib ketardi.
function phRestoreProduct(auditId) {
  const a = (db.auditLog || []).find(x => String(x.id) === String(auditId));
  if (!a) { toast("Yozuv topilmadi", "err"); return; }
  let snap = null;
  try { snap = JSON.parse(a.note || "{}"); } catch (e) {}
  if (!snap || !snap.sku) { toast("Bu yozuvda nusxa yo'q \u2014 tiklab bo'lmaydi", "err"); return; }
  const _q = (snap.variants || []).reduce((n, v) => n + (parseInt(v.qty) || 0), 0);
  if (!confirm(`"${snap.name}" tiklansinmi?\n\n` +
      `\u00b7 Yangi SKU bilan yaratiladi (eski: ${snap.sku})\n` +
      `\u00b7 Ranglar: ${(snap.variants || []).length} ta, qoldiq: ${_q} dona\n` +
      `\u00b7 Eski barcode kodlari SAQLANADI (bosilgan yorliqlar ishlaydi)`)) return;
  try {
    const { id: newId, sku: newSku } = _apNextSku(snap.type || "");
    const np = {
      id: newId, sku: newSku,
      name: snap.name, art: snap.art || "", category: snap.category || "",
      type: snap.type || "", unit: snap.unit || "dona", inBox: snap.inBox || 1,
      costUsd: snap.costUsd || 0, costUzs: snap.costUzs || 0,
      ulgurjiNarx: snap.ulgurjiNarx || 0, priceUzs: snap.priceUzs || 0,
      // 535: tiklashda ham rasm SAQLANADI (yuqoridagi bilan bir sinf).
      // `colorBarcodes` allaqachon ko'chirilardi — rasm esa tushib
      // qolardi, ya'ni tiklangan tovar rasmsiz chiqardi.
      image: snap.image || "",
      colorImages: snap.colorImages || {},
      createdAt: new Date().toISOString(),
      colorBarcodes: snap.colorBarcodes || {},
      variants: (snap.variants || []).map(v => ({
        color: v.color, size: v.size, qty: parseInt(v.qty) || 0,
        inBox: v.inBox || snap.inBox || null })),
      note: "Tiklangan (eski SKU: " + snap.sku + ", o'chirilgan: " + (a.date || "") + ")"
    };
    db.products.push(np);
    // 🔴 546: tiklangan tovar ham SERVER orqali — boshqa yaratish
    // yo'llari (yakka/rang/nusxa/variativ) bilan bir xil. Avval faqat
    // push'ga tayanardi: token o'lik xodimda tovar qurilmada kutib
    // qolardi. Aloqa bo'lmasa eski yo'l (lokal + push) o'z kuchida.
    try {
      if (typeof serverSaveRecord === "function") {
        const _sv = serverSaveRecord("products", np, null, true);
        if (_sv && _sv.then) _sv.then(_r => {
          if (_r && _r.ok && _r.row) {
            if (_r.row.id != null) np.id = _r.row.id;
            const _sm = _r.row.data && _r.row.data.updatedAt;
            if (_sm) np.updatedAt = _sm;
          }
        }).catch(() => {});
      }
    } catch (e) {}
    (np.variants || []).forEach(v => {
      if (v.qty > 0) _stockMove(np, v.color, v.size, v.qty, "Arxivdan tiklandi");
    });
    auditLog("restore", "product", newSku, np.name,
      { before: snap.sku, after: newSku, note: "arxivdan tiklandi" });
    saveDB();
    renderKatalog();
    closeModal("prodhist");
    toast(`\u267b\ufe0f "${np.name}" tiklandi \u2014 yangi SKU: ${newSku}`);
  } catch (e) {
    toast("Tiklashda xato: " + e.message, "err");
  }
}


// ═══ QOLDIQ HARAKATINI YOZISH (2026-08-12) ═════════════
// ILDIZ TASHXISI: tovarga qoldiq kirishning TO'RT yo'li bor edi, lekin
// faqat IKKITASI ombor yozuvi yaratardi:
//   ✅ addProduct (yangi tovar)      ✅ confirmImport (Excel/AI import)
//   ❌ epConfirmAddColor (yangi rang) ❌ epSaveVariativ (qoldiq tahriri)
// Oqibat: ombor "kirimlar" hisoboti va tovar tarixi CHALA edi — jonli
// isbot: ABU SAXIY "Bartoni: kirim 0, sotuv 0, qoldiq 180" va B20
// "Kuylak A4: 210 kirim / 250 qoldiq". Qoldiqning O'ZI to'g'ri edi
// (u variant.qty da yashaydi), faqat KELIB CHIQISHI yozilmasdi.
// Endi ikkala yo'l ham shu yordamchi orqali iz qoldiradi.
function _stockMove(p, color, size, delta, sabab) {
  try {
    if (!delta) return;
    // ✅ 2026-08-14 (5-band): QOLDIQNI SERVER O'ZGARTIRADI (qulf bilan).
    // Kirim, rang qo'shish, qoldiq tahriri, inventarizatsiya, arxivdan
    // tiklash — hammasi shu yerdan o'tadi. Server yangi qoldiqni
    // qaytaradi va kassa AYNAN shuni qo'yadi — "ikki marta qo'shildi"
    // holati bo'lmaydi (sotuvda shu xato bo'lgan edi).
    // MUHIM: chaqiruvchi qoldiqni ALLAQACHON o'zgartirgan — shuning
    // uchun serverga o'zgarish yuboriladi, javob esa haqiqat sifatida
    // ustiga yoziladi.
    // ✅ 2026-08-18: yagona o'zak yordamchi (utils.js `_serverStock`) —
    // avval shu mantiq faqat SHU YERDA edi, ombor amallari esa undan
    // foydalanmasdi (3-teshik). Endi ikkala tomon bitta yo'ldan yuradi.
    if (typeof _serverStock === "function") _serverStock(p, color, size, delta);
    const _rate = (db.settings?.rate || 12800);
    const _cost = (typeof getCostUzs === "function") ? getCostUzs(p)
                  : Math.round((p.costUsd || 0) * _rate);
    // ✅ 2026-08-19: HUJJAT ham SERVERGA yoziladi.
    // Avval qoldiq serverda o'zgarardi-yu (yuqoridagi `_serverStock`),
    // KIRIM/CHIQIM YOZUVI esa faqat lokal edi va push bilan ketardi.
    // Push yiqilsa — qoldiq o'zgargan, hujjat yo'q: ombor tarixi
    // haqiqatni ko'rsatmaydi (AP-17 tozalashida shunday "soxta kirim"
    // topilgan edi). Endi ikkalasi ham serverdan o'tadi.
    // Fon rejimida — sotuv/kirim tezligiga ta'sir qilmaydi.
    let _hujjat = null, _jadval = "";
    if (delta > 0) {
      if (!db.ombor) db.ombor = [];
      _hujjat = {
        id: nextId(), date: today(),
        time: (typeof nowTime === "function" ? nowTime() : ""),
        sku: p.sku, art: p.art || "", productName: p.name,
        unit: p.unit || "dona", color: color || "", size: size || "",
        qty: delta, kirimNarxi: _cost,
        supplier: "", partiya: sabab,
        boxes: (p.inBox > 1) ? Math.floor(delta / p.inBox) : null,
        updatedAt: new Date().toISOString()
      };
      db.ombor.push(_hujjat); _jadval = "ombor";
    } else {
      if (!db.chiqimlar) db.chiqimlar = [];
      _hujjat = {
        id: nextId(), date: today(),
        time: (typeof nowTime === "function" ? nowTime() : ""),
        productName: p.name, sku: p.sku,
        color: color || "", size: size || "", qty: -delta,
        unit: p.unit || "dona", reason: sabab, note: "",
        costUzs: _cost * (-delta), costUsdEach: p.costUsd || 0,
        updatedAt: new Date().toISOString()
      };
      db.chiqimlar.push(_hujjat); _jadval = "chiqimlar";
    }
    try {
      if (typeof serverSaveRecord === "function" && _hujjat && _jadval)
        serverSaveRecord(_jadval, _hujjat, null);
    } catch (e) {}
    auditLog("qoldiq", "product", p.sku,
      p.name + (color ? " · " + color : ""),
      { before: "", after: (delta > 0 ? "+" : "") + delta + " dona", note: sabab });
  } catch (e) { /* hisob yozuvi asosiy amalni to'xtatmaydi */ }
}
