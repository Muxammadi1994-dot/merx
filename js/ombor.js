// MERX ombor.js | v2.3 | 2026-06-06 12:54 | 2026-06-06 06:00
// ================================================
// MERX — js/ombor.js  (v3 — Pantone + Karobka)
// ================================================

let omActiveTab   = "qoldiq";
let omStockFilter = "all";

// ── Ustunlar sozlash (Katalogdagi kabi to'liq) ────
const OM_ALL_COLS = [
  { key:"image",      lbl:"Rasm",             def:true  },
  { key:"art",        lbl:"ART (artikul)",    def:true  },
  { key:"sku",        lbl:"SKU kodi",         def:false },
  { key:"kategoriya", lbl:"Kategoriya",       def:false },
  { key:"barcode",    lbl:"Barcode",          def:false },
  { key:"sizes",      lbl:"O'lchamlar",       def:true  },
  { key:"boxes",      lbl:"Pochka soni",      def:true  },
  { key:"tannarx",    lbl:"Tannarx",          def:true  },
  { key:"ulgurji",    lbl:"Ulgurji narx",     def:true  },
  { key:"chakana",    lbl:"Chakana narx",     def:false },
  { key:"qiymati",    lbl:"Qoldiq qiymati",   def:true  },
  { key:"margin",     lbl:"Margin %",         def:false },
];

const OM_DEFAULT_COLS = Object.fromEntries(OM_ALL_COLS.map(c => [c.key, c.def]));

// ── Sahifalash (2026-07-31) — katalog bilan bir xil uslub ──
// Avval ombor ro'yxati BUTUNLAY chizilardi (1046 qator). Endi
// bir sahifada 50 ta, pastda sahifa raqamlari.
let _omPage = 1;
function omGoPage(p) { _omPage = p; omRenderQoldiq(); pagerScrollTop("p-ombor"); }
function omResetPage() { _omPage = 1; }

function omGetCols() {
  const cols = Object.assign({}, OM_DEFAULT_COLS, db.settings.omborCols || {});
  // ⚠️ 2026-08-02: RUXSAT QATLAMI — `db.settings` GA TEGILMAYDI.
  // Sozlama egasiniki va bulutga sinxronlanadi. Ruxsat esa xodim
  // yozuvida. Ustun ko'rinadi = sozlamada yoqilgan VA ruxsatda
  // yashirilmagan. Egasi kirsa cheklov umuman ishlamaydi.
  try {
    if (typeof permSee === "function") {
      // ruxsat kaliti → ustun kaliti
      const map = { cost:"tannarx", value:"qiymati", margin:"margin" };
      Object.entries(map).forEach(([pk, ck]) => {
        if (!permSee("ombor", pk)) cols[ck] = false;
      });
    }
  } catch(e) {}
  return cols;
}

function renderOmbor() {
  omRenderKpis();
  if (omActiveTab === "qoldiq")      omRenderQoldiq();
  else if (omActiveTab === "kirim")  omRenderKirim();
  else if (omActiveTab === "sup")    omRenderSuppliers();
  else if (omActiveTab === "kam")    omRenderKamQoldiq();
  else if (omActiveTab === "chiqim") omRenderChiqim();
}

function omSetTab(tab) {
  omActiveTab = tab;
  document.querySelectorAll(".om-tab").forEach(b =>
    b.classList.toggle("on", b.dataset.tab === tab));
  $("om-tab-qoldiq").style.display = tab === "qoldiq" ? "" : "none";
  $("om-tab-kirim").style.display  = tab === "kirim"  ? "" : "none";
  $("om-tab-sup").style.display    = tab === "sup"    ? "" : "none";
  const kamEl = $("om-tab-kam");
  if (kamEl) kamEl.style.display   = tab === "kam"    ? "" : "none";
  const chiqimEl = $("om-tab-chiqim");
  if (chiqimEl) chiqimEl.style.display = tab === "chiqim" ? "" : "none";
  renderOmbor();
}

function omRenderKpis() {
  const rate = db.settings.rate || 1;
  const t    = today(), m = t.slice(0,7);
  const todayIn  = db.ombor.filter(o => o.date === t).reduce((a,o) => a + o.qty, 0);
  const monthVal = db.ombor.filter(o => o.date.startsWith(m)).reduce((a,o) => a + (o.kirimNarxi||0)*o.qty, 0);
  const supDebt  = db.ombor.filter(o => o.payStatus === "qarz").reduce((a,o) => a + (o.kirimNarxi||0)*o.qty, 0);
  const vProds = typeof visProds === "function" ? visProds() : db.products;
  const totalVal = vProds.reduce((a,p) =>
    a + p.variants.reduce((b,v) => b + getCostUzs(p)*v.qty, 0), 0);
  const totalUnits = vProds.reduce((a,p) =>
    a + p.variants.reduce((b,v) => b + v.qty, 0), 0);
  // 2026-07-26: TO'LIQ va OCHILGAN pochkalar ALOHIDA sanaladi.
  // Avval jami dona ÷ inBox qilinib, o'nli kasr chiqardi (masalan 30.6).
  // Endi: 30 to'liq pochka + 3 ta ochilgan pochka (qoldiqlar) ko'rinadi.
  let fullPochka = 0, brokenPacks = 0;
  vProds.forEach(p => {
    const _pIb = parseInt(p.inBox) || 1;
    // Har RANG alohida — quti sig'imi rang darajasida bo'lishi mumkin
    const byColor = {};
    (p.variants || []).forEach(v => {
      const c = v.color || "—";
      if (!byColor[c]) byColor[c] = { qty: 0, ib: parseInt(v.inBox) || _pIb };
      byColor[c].qty += (v.qty || 0);
    });
    Object.values(byColor).forEach(({ qty, ib }) => {
      const _ib = ib > 0 ? ib : 1;
      const full = Math.floor(qty / _ib);
      const rest = qty - full * _ib;
      fullPochka  += full;
      if (rest > 0) brokenPacks += 1;   // ochilgan pochka — bittasi
    });
  });
  const pochkaStr = String(fullPochka);

  // 2026-07-24 (№6): "Sotilsa qancha bo'ladi" — potentsial tushum.
  // Narxlar DONA bo'yicha (POS ham shu asosda ishlaydi):
  //   chakana = priceUzs (yo'q bo'lsa ulgurji), ulgurji = ulgurjiNarx (yo'q bo'lsa chakana)
  const potChakana = vProds.reduce((a,p) => {
    const px = (p.priceUzs > 0 ? p.priceUzs : (p.ulgurjiNarx || 0));
    return a + p.variants.reduce((b,v) => b + px * (v.qty||0), 0);
  }, 0);
  const potUlgurji = vProds.reduce((a,p) => {
    const px = (p.ulgurjiNarx > 0 ? p.ulgurjiNarx : (p.priceUzs || 0));
    return a + p.variants.reduce((b,v) => b + px * (v.qty||0), 0);
  }, 0);

  const el = $("om-kpi-row"); if (!el) return;
  el.innerHTML = [
    { icon:"ti-arrow-down-circle", color:"#4C9BE8", lbl:"Bugungi kirim",    val:todayIn+" dona",       sub:"bugun qabul qilindi" },
    { icon:"ti-box",               color:"#36B48C", lbl:"Jami qoldiq",      val:pochkaStr+" pochka",
      sub:(brokenPacks > 0 ? brokenPacks+" ta ochilgan · " : "")+fmt(totalUnits)+" dona" },
    { icon:"ti-currency-dollar",   color:"#E9A500", lbl:"Bu oy kirim",      val:fmt(monthVal)+" so'm", sub:"tannarxda" },
    { icon:"ti-wallet",            color:"#8B5CF6", lbl:"Ombor qiymati",    val:fmt(totalVal)+" so'm", sub:"tannarxda" },
    { icon:"ti-trending-up",       color:"#0EA5E9", lbl:"Sotilsa qancha bo'ladi",
      val:fmt(potChakana)+" so'm",
      sub:"ulgurjida "+fmt(potUlgurji)+" so'm" },
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
  openModal("omcols");
  omRenderColsPanel();
}

function omRenderColsPanel() {
  const cols = omGetCols();
  const el = $("om-cols-list"); if (!el) return;
  el.innerHTML = OM_ALL_COLS.map(d => `
    <label class="kat-col-item ${cols[d.key]?"active":""}" onclick="omToggleCol('${d.key}',${!cols[d.key]}); return false;">
      <div class="kat-col-check">${cols[d.key]
        ? `<i class="ti ti-check" style="font-size:13px;color:#fff"></i>`
        : ``}</div>
      <span>${d.lbl}</span>
    </label>`).join("");
}

function omToggleCol(key, val) {
  if (!db.settings.omborCols) db.settings.omborCols = {};
  db.settings.omborCols[key] = val;
  saveDB(); omRenderColsPanel(); omRenderQoldiq();
}

function omColsReset() {
  db.settings.omborCols = {};
  saveDB(); omRenderColsPanel(); omRenderQoldiq();
  toast("Ustunlar asl holiga qaytarildi");
}

function omSetFilter(f) {
  try { omResetPage(); } catch(e) {}
  omStockFilter = f;
  document.querySelectorAll(".om-filter-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.f === f));
  omRenderQoldiq();
}
let omSortKey = null;
let omSortAsc = true;

function omSortBy(key) {
  if (omSortKey === key) {
    omSortAsc = !omSortAsc;
  } else {
    omSortKey = key;
    omSortAsc = key === "name"; // nom uchun A→Z, qolganlar uchun kattadan kichikka
  }
  // Tugma ko'rinishini yangilash
  document.querySelectorAll(".om-sort-btn").forEach(b => {
    b.style.background  = "";
    b.style.color       = "";
    b.style.borderColor = "";
  });
  const activeMap = { name:"sort-name-btn", qty:"sort-qty-btn", price:"sort-price-btn" };
  const activeBtn = document.getElementById(activeMap[key]);
  if (activeBtn) {
    activeBtn.style.background  = "#0D1B2A";
    activeBtn.style.color       = "#fff";
    activeBtn.style.borderColor = "#0D1B2A";
  }
  omRenderQoldiq();
}



function omRenderQoldiq() {
  const rate = db.settings.rate || 1;
  const q    = ($("om-q")||{value:""}).value.toLowerCase();
  const showChakana = db.settings.showChakana || false;
  const cols = omGetCols();

  const vp = typeof visProds === "function" ? visProds() : db.products;
  let rows = [];
  vp.forEach(p => {
    const colors = [...new Set(p.variants.map(v => v.color))];
    colors.forEach(color => {
      const groups = typeof regroupPackages === "function"
        ? regroupPackages(p.variants, color, p.inBox)
        : [{ packGroup:0, isBroken:false, qty: Math.min(...p.variants.filter(v=>v.color===color).map(v=>v.qty)),
             variants: p.variants.filter(v=>v.color===color) }];

      groups.forEach(g => {
        const pantone = g.variants[0]?.pantone || "";
        const sizes = g.variants.map(v => ({ size: v.size, qty: v.qty }));
        const groupTotalQty = g.variants.reduce((a,v)=>a+v.qty, 0);
        // v144 (2026-07-10): B2 MODELI TUZATISHI — Katalog (v149) va POS
        // (v161) allaqachon tuzatilgan edi, Ombor unutilgan ekan.
        // Bitta rang = BITTA variant (B2, ulgurji-birinchi model) bo'lsa:
        //   "1 pochkada" — mahsulotning O'Z qiymatidan (p.inBox),
        //   pochka soni  — jami dona ÷ 1 pochkadagi dona.
        // Aks holda (eski, o'lchamlab kiritilgan model) avvalgidek:
        //   inBox = o'lchamlar soni, boxes = to'liq komplektlar (g.qty).
        const _single = g.variants.length === 1;
        // 2026-07-26: variantdagi quti sig'imi USTUVOR (rang darajasida)
        const _gIb = parseInt((g.variants || [])[0]?.inBox) || 0;
        const inBox = _gIb > 0 ? _gIb
                      : (_single ? (p.inBox || 1) : (g.variants.length || 1));
        const boxes = _single ? Math.floor(groupTotalQty / (inBox || 1)) : g.qty;
        const costUzs = getCostUzs(p);
        const margin  = p.ulgurjiNarx > 0 && costUzs > 0
          ? Math.round((p.ulgurjiNarx - costUzs) / p.ulgurjiNarx * 100) : null;

        rows.push({
          sku:     p.sku,
          art:     p.art || "",
          name:    p.name,
          category:p.category || "",
          image:   (p.colorImages && p.colorImages[color]) || p.image || "",
          type:    p.type,
          color:   color,
          pantone: pantone,
          qty:     groupTotalQty,
          sizes:   sizes,
          isBroken: g.isBroken,
          packGroup: g.packGroup,
          inBox,
          boxes,
          packUnit: p.packUnit || "pochka",
          unit:    p.unit || "dona",
          barcode: p.barcode || "",
          costUzs,
          chakana: p.priceUzs,
          ulgurji: p.ulgurjiNarx || 0,
          margin,
          qiymati: Math.round(groupTotalQty * getCostUzs(p))
        });
      });
    });
  });

  if (omStockFilter === "low") rows = rows.filter(r => r.qty > 0 && r.qty <= 5);
  if (omStockFilter === "out") rows = rows.filter(r => r.qty <= 0);
  if (omStockFilter === "broken") rows = rows.filter(r => r.isBroken);
  // 2026-08-02: ko'p parametrli qidiruv (utils.js → srchMatcher).
  // Barcode (tovar va RANG darajasi) avvalgidek qidiriladi —
  // etiketkalarda aynan shu kod chop etiladi.
  if (q) {
    const _m = srchMatcher(q);
    rows = rows.filter(r => {
      const p = (db.products||[]).find(x => x.sku === r.sku);
      const cbc = (p && p.colorBarcodes && p.colorBarcodes[r.color]) || "";
      return _m(r.name, r.sku, r.art, r.color, r.barcode, r.pantone,
                (p && p.barcode) || "", cbc);
    });
  }

  // 2026-07-25: STANDART TARTIB — yangi kiritilgan tovar TEPADA
  // (katalogdagi bilan bir xil). Avval tartibsiz aralash turardi.
  if (!omSortKey) {
    rows.sort((a, b) => {
      const pa = (db.products || []).find(x => x.sku === a.sku);
      const pb = (db.products || []).find(x => x.sku === b.sku);
      const ca = pa?.createdAt || "", cb = pb?.createdAt || "";
      if (ca && cb) {
        if (ca !== cb) return ca < cb ? 1 : -1;
        // BIR XIL vaqt (bitta import/partiya) — Excel tartibi saqlanadi
        return (pa?.id || 0) - (pb?.id || 0);
      }
      // Sanasi yo'q eski tovarlar — PASTDA, o'zaro id bo'yicha yangisi tepada
      if (ca && !cb) return -1;
      if (!ca && cb) return 1;
      return (pb?.id || 0) - (pa?.id || 0);
    });
  }

  // Saralash
  if (omSortKey) {
    rows.sort((a, b) => {
      let va, vb;
      if (omSortKey === "name")  { va = a.name;    vb = b.name;    }
      if (omSortKey === "qty")   { va = a.qty;     vb = b.qty;     }
      if (omSortKey === "price") { va = a.ulgurji; vb = b.ulgurji; }
      if (typeof va === "string") return omSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return omSortAsc ? va - vb : vb - va;
    });
  }

  const thead = `<tr>
    ${cols.image      ? '<th style="width:50px">Rasm</th>' : ""}
    ${cols.sku        ? '<th style="width:70px">SKU</th>' : ""}
    ${cols.art        ? '<th style="width:80px">ART</th>' : ""}
    <th>Mahsulot nomi</th>
    ${cols.kategoriya ? '<th>Kategoriya</th>' : ""}
    ${cols.barcode    ? '<th style="width:130px">Barcode</th>' : ""}
    <th>Rang</th>
    ${cols.sizes      ? "<th>O'lchamlar</th>" : ""}
    ${cols.boxes      ? '<th class="num">Pochka</th>' : ""}
    <th class="num">Jami dona</th>
    ${cols.tannarx    ? "<th class='num'>Tannarx</th>" : ""}
    ${cols.ulgurji    ? "<th class='num'>Ulgurji narx</th>" : ""}
    ${(showChakana && cols.chakana) ? "<th class='num'>Chakana narx</th>" : ""}
    ${cols.margin     ? "<th class='num'>Margin</th>" : ""}
    ${cols.qiymati    ? "<th class='num'>Qoldiq qiymati</th>" : ""}
    <th></th>
  </tr>`;

  // 2026-07-31: sahifalash. Pastdagi jamlanma (jami dona, qiymat)
  // TO'LIQ ro'yxatdan hisoblanadi — o'zgarmadi.
  _omPage = clampPage(_omPage, rows.length);
  const _omPager = pagerRow(14, rows.length, _omPage, "omGoPage", "qator");
  const tbody = rows.length ? pageSlice(rows, _omPage).map(r => {
    const qBadge = `<span style="font-size:12.5px;color:var(--mut)">${r.qty} ${r.unit}</span>`;

    const boxCell = r.boxes != null
      ? `<span class="bg ${r.boxes<=0?"bg-r":r.boxes<=3?"bg-a":"bg-g"}" style="font-weight:700">
           ${r.boxes} ${r.packUnit||"pochka"}
         </span>
         <div style="font-size:10px;color:#aaa;margin-top:2px">×${r.inBox} ${r.unit}</div>`
      : `<span style="font-size:12px;color:#bbb">—</span>`;

    const sortedSizes = (r.sizes||[]).slice().sort((a,b) => {
      const na = parseFloat(a.size), nb = parseFloat(b.size);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.size.localeCompare(b.size);
    });

    const mColor = r.margin == null ? "#ccc"
      : r.margin >= 30 ? "var(--grn)" : r.margin >= 15 ? "#E07B39" : "var(--red)";

    return `<tr>
      ${cols.image ? `<td onclick="event.stopPropagation()">
        <div style="position:relative;flex-shrink:0" onclick="omImgView('${r.sku}','${typeof jsEsc==='function' ? jsEsc(r.color) : r.color}')" title="Rasm qo'shish/o'zgartirish">
          ${r.image
            ? `<img src="${r.image}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid var(--brd);cursor:pointer">`
            : `<div style="width:36px;height:36px;border:1.5px dashed #e0ddd8;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:14px;cursor:pointer"><i class="ti ti-camera-plus"></i></div>`}
        </div>
      </td>` : ""}
      ${cols.sku ? `<td style="font-family:monospace;font-size:11.5px;color:var(--mut)">${r.sku}</td>` : ""}
      ${cols.art ? `<td style="font-family:monospace;font-size:12px;font-weight:700;color:#0D1B2A">${r.art || '<span style="color:#ddd">—</span>'}</td>` : ""}
      <td><div style="font-weight:600;font-size:13px">${r.name}${r.isBroken?` <span style="background:#FEF3C7;color:#92400E;font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:7px;margin-left:5px;white-space:nowrap">ochilgan</span>`:""}</div></td>
      ${cols.kategoriya ? `<td style="font-size:12px;color:var(--mut)">${r.category}</td>` : ""}
      ${cols.barcode ? `<td style="font-family:monospace;font-size:12px">
        ${r.barcode
          ? `<span style="background:var(--bg);padding:2px 7px;border-radius:5px;border:1px solid var(--brd)">${r.barcode}</span>`
          : `<span style="color:#ccc">—</span>`}
      </td>` : ""}
      <td>
        <div style="font-weight:500;font-size:13px">${r.color}</div>
        ${r.pantone ? `<div style="font-size:10px;color:#aaa">${r.pantone}</div>` : ""}
      </td>
      ${cols.sizes ? `<td>
        ${r.isBroken
          ? `<div style="display:flex;flex-wrap:wrap;gap:3px">
              ${sortedSizes.map(s => {
                const lvl = s.qty <= 0 ? "bg-r" : s.qty <= 3 ? "bg-a" : "";
                return `<span class="bg ${lvl}" style="font-size:10.5px;padding:1px 6px;font-weight:${s.qty<=3?"700":"400"}"
                  title="${s.size}: ${s.qty} ${r.unit}">${s.size}<span style="color:${s.qty<=0?"#dc2626":s.qty<=3?"#92400e":"#888"};margin-left:2px;font-size:9.5px">${s.qty}</span></span>`;
              }).join("")}
            </div>`
          : (sortedSizes.length > 0
              ? `<span style="font-size:12.5px;font-weight:600;color:#0D1B2A">${typeof sizesToRange==="function" ? sizesToRange(sortedSizes.map(s=>s.size), r.type) : sortedSizes.map(s=>s.size).join(", ")}</span>`
              : '<span style="color:#ddd;font-size:12px">—</span>')}
      </td>` : ""}
      ${cols.boxes ? `<td class="num">${boxCell}</td>` : ""}
      <td class="num">${qBadge}</td>
      ${cols.tannarx ? `<td class="num" style="font-size:12.5px">
        ${r.costUzs ? `<div style="font-weight:600">${priceDisplay(r.costUzs)}</div>` : "—"}
        ${r.costUzs && r.inBox > 1 ? `<div style="font-size:11px;color:#856404;margin-top:2px">📦 ${priceDisplay(r.costUzs * r.inBox)}</div>` : ""}
      </td>` : ""}
      ${cols.ulgurji ? `<td class="num" style="font-size:12.5px">
        ${r.ulgurji ? `<div style="font-weight:700;color:var(--acc)">${priceDisplay(r.ulgurji)}</div>` : '<span style="color:#ccc">—</span>'}
        ${r.ulgurji && r.inBox > 1 ? `<div style="font-size:11px;color:#e9a500;margin-top:2px">📦 ${priceDisplay(r.ulgurji * r.inBox)}</div>` : ""}
      </td>` : ""}
      ${(showChakana && cols.chakana) ? `<td class="num" style="color:var(--teal);font-size:12.5px">${r.chakana ? fmt(r.chakana) + " so'm" : "—"}</td>` : ""}
      ${cols.margin ? `<td class="num" style="font-size:12px">
        ${r.margin != null ? `<span style="color:${mColor};font-weight:700">${r.margin}%</span>` : '<span style="color:#ddd">—</span>'}
      </td>` : ""}
      ${cols.qiymati ? `<td class="num" style="font-size:12.5px;color:var(--mut)">${r.qiymati ? fmt(r.qiymati) + " so'm" : "—"}</td>` : ""}
      <td>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditProduct('${r.sku}')"
          title="Katalogda tahrirlash">
          <i class="ti ti-edit"></i>
        </button>
      </td>
    </tr>`;
  }).join("") + _omPager : `<tr><td colspan="14" class="empty-td">
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
      <span><strong>${totalBoxes}</strong> pochka</span>
      <span><strong>${totalQty}</strong> dona qoldiq</span>
      <span>Qiymati: <strong style="color:var(--acc)">${fmt(totalVal)} so'm</strong></span>
    </div>` : "";
}

// ── Kam qoldiq tab ───────────────────────────────
function omRenderKamQoldiq() {
  const el = $("om-tab-kam");
  if (!el) return;

  const threshold = db.settings?.lowStockLimit || 5;
  const vp2 = typeof visProds === "function" ? visProds() : db.products;
  const rows = [];
  vp2.forEach(p => {
    const minQty = p.minStock || threshold;
    p.variants.forEach(v => {
      if (v.qty <= minQty)
        rows.push({ p, v, minQty });
    });
  });
  rows.sort((a,b) => a.v.qty - b.v.qty);

  const zeros    = rows.filter(r => r.v.qty === 0).length;
  const criticals = rows.filter(r => r.v.qty > 0 && r.v.qty <= 2).length;

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--brd);flex-wrap:wrap">
      <strong style="font-size:14px">Kam qoldiq — ${rows.length} ta variant</strong>
      ${zeros     ? `<span class="bg bg-r" style="font-size:12px">🚫 ${zeros} ta tugagan</span>` : ''}
      ${criticals ? `<span class="bg bg-a" style="font-size:12px">⚠️ ${criticals} ta kritik</span>` : ''}
      <span style="font-size:12px;color:var(--mut);margin-left:auto">
        Chegara:
        <input type="number" value="${threshold}" min="1" max="999"
          style="width:44px;font-size:12px;font-family:inherit;border:1.5px solid var(--brd);border-radius:6px;padding:2px 5px;text-align:center;margin:0 3px"
          onchange="setLowStockLimit(+this.value)">
        ta
      </span>
      <button class="btn btn-sm" onclick="exportLowStock()">
        <i class="ti ti-download"></i> Excel
      </button>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr>
          <th>Mahsulot</th>
          <th>Rang</th>
          <th>O'lcham</th>
          <th class="num">Qoldiq</th>
          <th class="num">Min chegara</th>
          <th>Holat</th>
          <th>Tannarx</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${rows.length ? rows.map(({p, v, minQty}) => {
            const rate = db.settings?.rate || 12800;
            const costUzs = getCostUzs(p);
            const status = v.qty === 0
              ? '<span class="bg bg-r">🚫 Tugagan</span>'
              : v.qty <= 2
                ? '<span class="bg bg-r" style="background:#fff3cd;color:#856404">⚠️ Kritik</span>'
                : '<span class="bg bg-a">📉 Kam</span>';
            return `<tr style="${v.qty===0?'background:#fff5f5':''}">
              <td>
                <div style="font-weight:600;font-size:13px">${p.name}</div>
                <div style="font-size:11px;color:var(--mut)">${p.sku}</div>
              </td>
              <td>
                <div style="margin-bottom:${v.size?'3px':'0'}">
                  <span style="font-weight:500">${v.color||'—'}</span>
                </div>
              </td>
              <td style="font-weight:600">${v.size||'—'}</td>
              <td class="num">
                <span style="font-size:16px;font-weight:800;color:${v.qty===0?'var(--red)':v.qty<=2?'#d97706':'var(--acc)'}">
                  ${v.qty}
                </span>
                <span style="font-size:11px;color:var(--mut);display:block">${p.unit||'dona'}</span>
              </td>
              <td class="num" style="color:var(--mut);font-size:13px">${minQty} ta</td>
              <td>${status}</td>
              <td class="num" style="font-size:12.5px">${costUzs ? fmt(costUzs)+" so'm" : "—"}</td>
              <td>
                <button class="btn btn-sm btn-ghost" onclick="qabulFromAlert('${p.name.replace(/'/g,"&#39;")}')"
                  title="Tovar qabul">
                  <i class="ti ti-plus"></i> Qabul
                </button>
              </td>
            </tr>`;
          }).join('') : '<tr><td colspan="8" class="empty-td" style="color:var(--grn)">✅ Barcha tovarlar yetarli</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function setLowStockLimit(val) {
  if (!val || val < 1) return;
  if (!db.settings) db.settings = {};
  db.settings.lowStockLimit = val;
  saveDB();
  omRenderKamQoldiq();
  if (typeof renderDashboard === 'function') renderDashboard();
  toast("Chegara " + val + " ta ga o'zgartirildi", "info");
}

function exportLowStock() {
  const threshold = db.settings?.lowStockLimit || 5;
  const rows = [["Mahsulot","SKU","Rang","O'lcham","Qoldiq","Birlik","Holat"]];
  db.products.forEach(p => {
    const minQty = p.minStock || threshold;
    p.variants.forEach(v => {
      if (v.qty <= minQty)
        rows.push([p.name, p.sku, v.color||'', v.size||'', v.qty, p.unit||'dona',
          v.qty===0?'Tugagan':v.qty<=2?'Kritik':'Kam']);
    });
  });
  rows.sort((a,b)=>a[4]-b[4]);
  if (typeof downloadCSV === 'function') {
    downloadCSV(rows, 'merx_kam_qoldiq_'+today()+'.csv');
    toast('Excel yuklab olindi');
  }
}

let omKirimFilter = "all"; // "all" | "excel" | "manual"

// Partiya raqamlari ro'yxati
function getPartiyaList() {
  const parts = new Set();
  (db.ombor||[]).forEach(o => { if (o.partiya) parts.add(o.partiya); });
  return [...parts].sort().reverse();
}

// Partiya filter render
function renderPartiyaFilter() {
  const el = document.getElementById("om-partiya-filter");
  if (!el) return;
  const parts = getPartiyaList();
  el.innerHTML = `<option value="">Barcha partiyalar</option>` +
    parts.map(p => `<option value="${p}">${p}</option>`).join("");
}

let _omPartiyaFilter = "";

function omSetPartiyaFilter(val) {
  _omPartiyaFilter = val;
  omRenderKirim();
  // 2026-07-25: partiya tanlangandagina o'chirish tugmasi ko'rinadi
  const delBtn = document.getElementById("om-del-partiya");
  if (delBtn) delBtn.style.display = _omPartiyaFilter ? "" : "none";
}

// v143: kam-qoldiq ogohlantirishidan tezkor qabul — katalogga o'tib,
// qo'shish oynasini shu tovar nomi bilan ochadi (nom+rang mos kelsa
// mavjudga QO'SHILADI — bu aynan "qabul" degani)
function qabulFromAlert(name) {
  if (typeof nav === "function") nav("katalog");
  setTimeout(() => {
    if (typeof openModal === "function") openModal("addprod");
    const n = $("ap-name");
    if (n) { n.value = name; n.dispatchEvent(new Event("input", { bubbles: true })); }
    const b = $("ap-boxes"); if (b) b.focus();
    toast(`"${name}" uchun qabul: rang va pochka sonini kiriting`);
  }, 200);
}

function omSetKirimFilter(f) {
  omKirimFilter = f;
  document.querySelectorAll("[data-kf]").forEach(b => b.classList.toggle("on", b.dataset.kf === f));
  omRenderKirim();
}

function omRenderKirim() {
  renderPartiyaFilter();
  const q = ($("om-q")||{value:""}).value.toLowerCase();
  const byPochka = $("om-by-pochka")?.checked !== false;

  let list = db.ombor.filter(o =>
    !q || o.productName.toLowerCase().includes(q) ||
    (o.supplier||"").toLowerCase().includes(q) ||
    (o.color||"").toLowerCase().includes(q)
  );
  if (omKirimFilter === "excel")  list = list.filter(o => o.partiya && o.partiya.startsWith("Excel"));
  if (omKirimFilter === "manual") list = list.filter(o => !o.partiya || !o.partiya.startsWith("Excel"));
  if (_omPartiyaFilter) list = list.filter(o => o.partiya === _omPartiyaFilter);

  list = list.slice().sort((a,b) => { // v147 (№13): aniq yangi-birinchi
    const ka = (a.date||"")+(a.time||""), kb = (b.date||"")+(b.time||"");
    if (ka !== kb) return ka < kb ? 1 : -1;
    return (b.id||0) - (a.id||0);
  });

  // Pochka rejimi: partiya+mahsulot+rang bo'yicha guruhlash
  let rows = [];
  if (byPochka) {
    const groups = {};
    list.forEach(o => {
      // Partiya: sana + mahsulot + rang + yetkazuvchi + partiya nomi
      const key = (o.date||"") + "|" + (o.productName||"") + "|" + (o.art||"") + "|" + (o.color||"") + "|" + (o.supplier||"") + "|" + (o.partiya||"");
      if (!groups[key]) {
        groups[key] = { ...o, sizes: [], totalQty: 0, totalBoxes: 0, maxBoxes: 0 };
      }
      if (o.size) groups[key].sizes.push(o.size);
      groups[key].totalQty += o.qty || 0;
      // Pochka soni: bir rangda barcha o'lchamlar uchun bir xil boxes
      // Shuning uchun MAX qiymatni olamiz (yoki birinchi non-zero)
      if ((o.boxes||0) > groups[key].maxBoxes) groups[key].maxBoxes = o.boxes||0;
    });
    // maxBoxes ni totalBoxes sifatida ishlatamiz
    Object.values(groups).forEach(g => { g.totalBoxes = g.maxBoxes || 0; });
    rows = Object.values(groups);
  } else {
    rows = list;
  }

  const el = $("ombor-body"); if (!el) return;
  el.innerHTML = rows.length ? rows.map(o => {
    const isPochka = byPochka;
    const sizesStr = isPochka && o.sizes?.length
      ? [...new Set(o.sizes)].filter(Boolean).join(", ")
      : o.size;
    const qtyDisplay = isPochka
      ? (o.totalBoxes > 0
          ? `<span class="bg bg-g" style="font-weight:700">${o.totalBoxes} pochka</span>
             <div style="font-size:11px;color:#6B7280;margin-top:2px">${[...new Set(o.sizes||[])].filter(Boolean).join(", ")} · ${o.totalQty} dona</div>`
          : `<span class="bg bg-g" style="font-weight:700">+${o.totalQty} dona</span>`)
      : (o.boxes
          ? `<span class="bg bg-g" style="font-weight:700">${o.boxes} pochka</span>`
          : `<span class="bg bg-g" style="font-weight:700">+${o.qty}</span>`);

    const qty    = isPochka ? o.totalQty   : o.qty;
    const boxes  = isPochka ? o.totalBoxes : o.boxes;

    return `<tr>
      <td style="font-size:12px;color:var(--mut)">${o.date}</td>
      <td><div style="font-weight:600;font-size:13px">${o.productName}</div></td>
      <td style="font-family:monospace;font-size:12px;font-weight:700;color:#0D1B2A">${o.art || '<span style="color:#ddd">—</span>'}</td>
      <td><span class="bg bg-t" style="font-size:11px">${o.unit||"dona"}</span></td>
      <td>
        <div style="font-weight:600">${o.color||"—"}</div>
        <div style="font-size:11px;color:var(--mut)">${sizesStr||""}</div>
        ${o.pantone ? `<div style="font-size:10px;color:#aaa">${o.pantone}</div>` : ""}
      </td>
      <td>${qtyDisplay}</td>
      <td class="num" style="font-size:12.5px">
        ${o.kirimNarxi ? `<div>${fmt(o.kirimNarxi)} so'm</div>` : "—"}
        ${o.kirimNarxi && boxes && boxes !== qty ? `<div style="font-size:10.5px;color:#856404;margin-top:1px">📦 ${fmt(Math.round(o.kirimNarxi*(qty/boxes)))} so'm/pochka</div>` : ""}
      </td>
      <td class="num" style="font-weight:600;font-size:12.5px">${o.kirimNarxi ? fmt(o.kirimNarxi*qty)+" so'm" : "—"}</td>
      <td style="font-size:12.5px">${o.supplier||"—"}</td>
      <td style="font-size:12px;color:var(--mut)">
        ${o.partiya === "Excel import"
          ? `<span style="font-size:11px;color:#6B4FBB">Excel</span>`
          : (o.partiya||"—")}
        <button class="btn btn-ghost btn-icon btn-sm" title="Nakladnoy chop etish"
          onclick="omPrintNaklad('${encodeURIComponent(o.date||"")}','${encodeURIComponent(o.partiya||"")}','${encodeURIComponent(o.supplier||"")}')"
          style="margin-left:4px;vertical-align:middle"><i class="ti ti-printer" style="font-size:14px"></i></button>
      </td>
      <td><span class="bg ${o.payStatus==="qarz"?"bg-r":"bg-g"}">${o.payStatus==="qarz"?"To'lanmagan":"To'langan"}</span></td>
      <td style="text-align:center">
        <button class="btn btn-ghost btn-icon btn-sm" title="Kirimni o'chirish"
          onclick="omDeleteKirim(${o.id})" style="color:var(--red)">
          <i class="ti ti-trash" style="font-size:14px"></i></button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="13" class="empty-td">Kirim yo'q</td></tr>`;
}

function omRenderSuppliers() {
  const supMap = {};

  // 1) Qo'lda qo'shilgan yetkazuvchilar (hali kirim bo'lmagan bo'lsa ham ko'rinadi)
  (db.suppliers||[]).forEach(s => {
    supMap[s.name] = { name:s.name, phone:s.phone||"", note:s.note||"", id:s.id,
      items:0, value:0, paid:0, debt:0, lastDate:"" };
  });

  // 2) Kirim tarixidan avtomatik hisoblanadigan statistikalar
  db.ombor.forEach(o => {
    const sup = o.supplier || "Noma'lum yetkazuvchi";
    if (!supMap[sup]) supMap[sup] = { name:sup, phone:"", note:"", items:0, value:0, paid:0, debt:0, lastDate:"" };
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
      ${s.phone ? `<div style="font-size:11px;color:var(--mut)"><i class="ti ti-phone" style="font-size:10px"></i> ${s.phone}</div>` : ""}
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
    <td onclick="event.stopPropagation()">
      ${s.id ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="openEditSupplier(${s.id})" title="Tahrirlash">
        <i class="ti ti-edit"></i>
      </button>` : ""}
    </td>
  </tr>`).join("")
  : `<tr><td colspan="6" class="empty-td">Yetkazuvchi yo'q</td></tr>`;
}

// ── Yetkazuvchi qo'shish/tahrirlash ───────────────
let editingSupplierId = null;

function openAddSupplier() {
  editingSupplierId = null;
  if ($("sup-name"))  $("sup-name").value = "";
  if ($("sup-phone")) $("sup-phone").value = "";
  if ($("sup-note"))  $("sup-note").value = "";
  if ($("sup-modal-title")) $("sup-modal-title").textContent = "Yangi yetkazuvchi";
  if ($("sup-delete-btn")) $("sup-delete-btn").style.display = "none";
  openModal("supplier");
  setTimeout(() => { if ($("sup-name")) $("sup-name").focus(); }, 50);
}

function openEditSupplier(id) {
  const s = (db.suppliers||[]).find(x => x.id === id); if (!s) return;
  editingSupplierId = id;
  if ($("sup-name"))  $("sup-name").value  = s.name;
  if ($("sup-phone")) $("sup-phone").value = s.phone || "";
  if ($("sup-note"))  $("sup-note").value  = s.note || "";
  if ($("sup-modal-title")) $("sup-modal-title").textContent = "Yetkazuvchini tahrirlash";
  if ($("sup-delete-btn")) $("sup-delete-btn").style.display = "";
  openModal("supplier");
}

function saveSupplier() {
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("ombor","supplier")) return;

  if (typeof requireUse === "function" && !requireUse("ombor")) return;

  const name  = ($("sup-name")||{value:""}).value.trim();
  const phone = ($("sup-phone")||{value:""}).value.trim();
  const note  = ($("sup-note")||{value:""}).value.trim();

  if (!name) { toast("Yetkazuvchi nomini kiriting", "err"); return; }
  if (!db.suppliers) db.suppliers = [];

  if (editingSupplierId) {
    const s = db.suppliers.find(x => x.id === editingSupplierId);
    if (s) { s.name = name; s.phone = phone; s.note = note; }
  } else {
    if (db.suppliers.some(x => x.name.toLowerCase() === name.toLowerCase())) {
      toast("Bu nomdagi yetkazuvchi allaqachon mavjud", "err"); return;
    }
    db.suppliers.push({ id: db.seq++, name, phone, note });
  }

  saveDB();
  closeModal("supplier");
  omRenderSuppliers();
  toast(`"${name}" saqlandi`);
}

function deleteSupplier() {
  if (!editingSupplierId) return;
  const s = db.suppliers.find(x => x.id === editingSupplierId); if (!s) return;
  if (!confirm(`"${s.name}" yetkazuvchisini ro'yxatdan o'chirasizmi?\nKirim tarixi saqlanib qoladi.`)) return;
  // 2026-08-02: BULUTGA HAM AYTAMIZ (tombstone). Busiz yozuv
  // keyingi tortishda QAYTIB kelardi.
  try { if (typeof queueCloudDelete === "function") queueCloudDelete("suppliers", "id", editingSupplierId); } catch(e) {}
  db.suppliers = db.suppliers.filter(x => x.id !== editingSupplierId);
  saveDB();
  try { if (typeof flushCloudSync === "function") flushCloudSync(true); } catch(e) {}
  closeModal("supplier");
  omRenderSuppliers();
  toast("Yetkazuvchi o'chirildi", "info");
}

function omSearch() {
  try { omResetPage(); } catch(e) {} renderOmbor(); }

// ── Chiqimlar tarixi (Hisobdan chiqarish tab) ────
const CHIQIM_SABABLAR = [
  { key:"nuqson",   label:"🔧 Nuqsonli",    color:"#E07B39" },
  { key:"ogirlik",  label:"🔓 O'g'irlik",   color:"#E05A5A" },
  { key:"yoqolish", label:"❓ Yo'qolish",   color:"#8B5CF6" },
  { key:"qaytarish",label:"↩️ Qaytarildi",  color:"#4C9BE8" },
  { key:"eskirish", label:"📦 Eskirish",    color:"#888"    },
  { key:"nuqsonli", label:"🔧 Nuqsonli",    color:"#E07B39" },
  { key:"yoqotilgan", label:"❓ Yo'qolgan", color:"#8B5CF6" },
  { key:"muddati",  label:"⏰ Muddati o'tgan", color:"#E05A5A" },
  { key:"boshqa",   label:"📋 Boshqa",      color:"#aaa"    },
];

function omRenderChiqim() {
  const el = $("om-tab-chiqim"); if (!el) return;
  const q  = ($("om-q")||{value:""}).value.toLowerCase();

  let list = [...(db.chiqimlar||[])].reverse();
  if (q) list = list.filter(c =>
    c.productName.toLowerCase().includes(q) ||
    (c.color||"").toLowerCase().includes(q) ||
    (c.reason||"").toLowerCase().includes(q) ||
    (c.note||"").toLowerCase().includes(q)
  );

  const totalQty  = list.reduce((a,c) => a+c.qty, 0);
  const totalCost = list.reduce((a,c) => a+(c.costUzs||0), 0);

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--brd);flex-wrap:wrap">
      <strong style="font-size:13.5px">${list.length} ta yozuv</strong>
      <span style="font-size:12.5px;color:var(--mut)">Jami: <strong style="color:#0D1B2A">${totalQty} dona</strong></span>
      <span style="font-size:12.5px;color:var(--mut)">Zarar: <strong style="color:var(--red)">${fmt(totalCost)} so'm</strong></span>
      <button class="btn btn-sm btn-ghost" onclick="exportChiqimExcel()" style="margin-left:auto;color:#1D6A39">
        <i class="ti ti-file-spreadsheet"></i> Excel
      </button>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr>
          <th>Sana</th><th>Mahsulot</th><th>Rang/O'lcham</th>
          <th class="num">Miqdor</th><th>Sabab</th><th>Izoh</th>
          <th class="num">Zarar</th><th></th>
        </tr></thead>
        <tbody>
          ${list.length ? list.map(c => {
            const sabab = CHIQIM_SABABLAR.find(s => s.key === c.reason) || { label:c.reason, color:"#888" };
            return `<tr>
              <td style="font-size:12px;white-space:nowrap">
                <div>${c.date}</div>
                <div style="color:var(--mut);font-size:10.5px">${c.time||""}</div>
              </td>
              <td>
                <div style="font-weight:600;font-size:13px">${c.productName}</div>
                <div style="font-size:11px;color:var(--mut)">${c.sku}</div>
              </td>
              <td style="font-size:12.5px">${c.color||"—"} / ${c.size||"—"}</td>
              <td class="num" style="font-weight:700;color:var(--red)">−${c.qty} ${c.unit||"ta"}</td>
              <td>
                <span class="bg" style="font-size:11.5px;background:${sabab.color}18;color:${sabab.color}">
                  ${sabab.label}
                </span>
              </td>
              <td style="font-size:12px;color:var(--mut);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${c.note||"—"}
              </td>
              <td class="num" style="color:var(--red);font-size:12.5px">
                ${c.costUzs ? fmt(c.costUzs)+" so'm" : "—"}
              </td>
              <td>
                <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteChiqim(${c.id})"
                  title="O'chirish" style="color:var(--red)">
                  <i class="ti ti-trash"></i>
                </button>
              </td>
            </tr>`;
          }).join("") : '<tr><td colspan="9" class="empty-td">Chiqimlar yo\'q</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function deleteChiqim(id) {
  const c = db.chiqimlar.find(x => x.id === id); if (!c) return;
  if (!confirm(`${c.productName} (${c.color}/${c.size}) — ${c.qty} ta chiqimni o'chirasizmi?\nOmbor qoldig'i TIKLANMAYDI.`)) return;
  // 2026-08-02: BULUTGA HAM AYTAMIZ (tombstone). Busiz yozuv
  // keyingi tortishda QAYTIB kelardi.
  try { if (typeof queueCloudDelete === "function") queueCloudDelete("chiqimlar", "id", id); } catch(e) {}
  db.chiqimlar = db.chiqimlar.filter(x => x.id !== id);
  saveDB();
  try { if (typeof flushCloudSync === "function") flushCloudSync(true); } catch(e) {}
  omRenderChiqim();
  toast("Chiqim o'chirildi", "info");
}

function exportChiqimExcel() {
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("ombor","excel")) return;

  const rows = [["Sana","Mahsulot","SKU","Rang","O'lcham","Miqdor","Birlik","Sabab","Izoh","Zarar (so'm)"]];
  (db.chiqimlar||[]).slice().reverse().forEach(c => {
    const sabab = CHIQIM_SABABLAR.find(s => s.key === c.reason)?.label || c.reason;
    rows.push([c.date, c.productName, c.sku, c.color||"", c.size||"", c.qty, c.unit||"dona", sabab, c.note||"", c.costUzs||0]);
  });
  if (typeof downloadCSV === "function") {
    downloadCSV(rows, "merx_chiqimlar_" + today() + ".csv");
    toast("Excel yuklab olindi");
  }
}

// ── Ombor jadvalidan rasm yuklash ────────────────
// v164: Kamera/Galereya tanlash oynasi orqali (katalog.js dagi umumiy
// imgSrcAsk/imgSrcPick tizimi) — avval faqat galereyaga yo'naltirardi,
// chunki bu yerda mustaqil, capture atributisiz input yaratilgan edi.
function omImgClick(sku, color) {
  const key = sku + "-" + (color || "_");
  let galInp = document.getElementById("om-img-inp-" + key);
  if (!galInp) {
    galInp = document.createElement("input");
    galInp.type = "file";
    galInp.accept = "image/*";
    galInp.style.display = "none";
    galInp.id = "om-img-inp-" + key;
    galInp.onchange = function() { omImgSave(sku, color, this); };
    document.body.appendChild(galInp);
  }
  let camInp = document.getElementById("om-img-cam-" + key);
  if (!camInp) {
    camInp = document.createElement("input");
    camInp.type = "file";
    camInp.accept = "image/*";
    camInp.capture = "environment";
    camInp.style.display = "none";
    camInp.id = "om-img-cam-" + key;
    camInp.onchange = function() { omImgSave(sku, color, this); };
    document.body.appendChild(camInp);
  }
  if (typeof imgSrcAsk === "function") imgSrcAsk(galInp.id, camInp.id);
  else galInp.click(); // zaxira yo'l, agar imgSrcAsk yuklanmagan bo'lsa
}

function omImgSave(sku, color, input) {
  const file = input.files[0]; if (!file) return;
  // 2026-07-10: 2MB darvozasi OLIB TASHLANDI — u pastdagi SIQISHDAN
  // OLDIN turib, telefon suratlarini (3-8MB) bekorga rad etardi.
  // Siqish baribir rasmni ~50-150KB ga tushiradi. 15MB — faqat
  // xato fayl (video va h.k.) dan himoya.
  if (file.size > 15 * 1024 * 1024) { toast("Fayl juda katta (15MB+) — bu rasm emasga o'xshaydi", "err"); return; }
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

      const p = db.products.find(x => x.sku === sku);
      if (!p) { toast("Mahsulot topilmadi", "err"); return; }
      if (color) {
        if (!p.colorImages) p.colorImages = {};
        p.colorImages[color] = dataUrl;
      } else {
        p.image = dataUrl;
      }
      saveDB();
      renderOmbor();
      toast("✅ Rasm saqlandi" + (color ? ` ("${color}" rangiga)` : ""));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ════════════════════════════════════════════════
// INVENTARIZATSIYA v2 — sodda, openModal() orqali
// ════════════════════════════════════════════════

function openInvent2() {
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("ombor","inv")) return;

  openModal("invent2");
  renderInvent2();
}

function renderInvent2() {
  const q = ($("inv2-q")||{value:""}).value.toLowerCase();
  const rows = [];

  db.products.forEach(p => {
    p.variants.forEach(v => {
      if (q && !p.name.toLowerCase().includes(q) && !v.color.toLowerCase().includes(q)) return;
      rows.push({ sku: p.sku, name: p.name, color: v.color, size: v.size, systemQty: v.qty });
    });
  });

  const el = $("inv2-body"); if (!el) return;
  el.innerHTML = rows.length ? rows.map((r, i) => `
    <tr>
      <td style="padding:7px 10px;font-size:13px;font-weight:600">${r.name}</td>
      <td style="padding:7px 10px;font-size:12.5px;color:var(--mut)">${r.color} / ${r.size}</td>
      <td style="padding:7px 10px;text-align:right;font-size:13px">${r.systemQty}</td>
      <td style="padding:7px 10px;text-align:right">
        <input type="number" min="0" placeholder="${r.systemQty}" data-inv2="${r.sku}::${r.color}::${r.size}"
          oninput="inv2CalcDiff(this)"
          style="width:64px;text-align:right;border:1px solid var(--brd);border-radius:6px;padding:3px 6px;font-size:13px">
      </td>
      <td style="padding:7px 10px;text-align:right;font-size:12.5px;font-weight:700" id="inv2-diff-${i}">—</td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-td">Mahsulot topilmadi</td></tr>`;

  // data-row-idx larni saqlash uchun inputlarga index biriktiramiz
  el.querySelectorAll("[data-inv2]").forEach((inp, i) => inp.dataset.rowIdx = i);
}

function inv2CalcDiff(input) {
  const idx = input.dataset.rowIdx;
  const sysQty = parseInt(input.placeholder) || 0;
  const actualQty = input.value === "" ? null : parseInt(input.value) || 0;
  const diffEl = $("inv2-diff-" + idx);
  if (!diffEl) return;
  if (actualQty === null) { diffEl.textContent = "—"; diffEl.style.color = ""; return; }
  const diff = actualQty - sysQty;
  diffEl.textContent = diff === 0 ? "0" : (diff > 0 ? "+" + diff : diff);
  diffEl.style.color = diff === 0 ? "var(--grn)" : diff > 0 ? "var(--teal)" : "var(--red)";
}

function saveInvent2() {
  const inputs = document.querySelectorAll("[data-inv2]");
  let changed = 0;

  inputs.forEach(inp => {
    if (inp.value === "") return;
    const [sku, color, size] = inp.dataset.inv2.split("::");
    const actualQty = parseInt(inp.value) || 0;
    const p = db.products.find(x => x.sku === sku);
    if (!p) return;
    const v = p.variants.find(x => x.color === color && x.size === size);
    if (!v) return;
    if (v.qty !== actualQty) {
      v.qty = actualQty;
      changed++;
    }
  });

  if (changed === 0) { toast("O'zgarish yo'q", "info"); return; }

  saveDB();
  closeModal("invent2");
  renderOmbor();
  if (typeof renderKatalog === "function") renderKatalog();
  toast(`✅ ${changed} ta mahsulot qoldig'i yangilandi`);
}

// ════════════════════════════════════════════════
// HISOBDAN CHIQARISH v2 — sodda, openModal() orqali
// ════════════════════════════════════════════════

let ch2SelectedProduct = null;

function openChiqim2() {
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("ombor","writeoff")) return;

  ch2SelectedProduct = null;
  if ($("ch2-name")) $("ch2-name").value = "";
  if ($("ch2-note")) $("ch2-note").value = "";
  if ($("ch2-qty"))  $("ch2-qty").value = "1";
  if ($("ch2-color-section")) $("ch2-color-section").style.display = "none";
  openModal("chiqim2");
  setTimeout(() => { if ($("ch2-name")) $("ch2-name").focus(); }, 50);
}

function ch2Autofill(val) {
  $("ch2-list").innerHTML = db.products
    .filter(p => p.name.toLowerCase().includes(val.toLowerCase()))
    .slice(0, 30)
    .map(p => `<option value="${p.name}">`).join("");

  const p = db.products.find(x => x.name.toLowerCase() === val.toLowerCase().trim());
  const section = $("ch2-color-section");

  if (!p) {
    ch2SelectedProduct = null;
    if (section) section.style.display = "none";
    return;
  }

  ch2SelectedProduct = p;
  const colors = [...new Set(p.variants.map(v => v.color))];
  if ($("ch2-color")) {
    $("ch2-color").innerHTML = colors.map(c => `<option value="${c}">${c}</option>`).join("");
  }
  if (section) section.style.display = "block";
  ch2UpdateSizes();
}

function ch2UpdateSizes() {
  const p = ch2SelectedProduct; if (!p) return;
  const color = ($("ch2-color")||{value:""}).value;
  const variants = p.variants.filter(v => v.color === color);
  if ($("ch2-size")) {
    // 2026-07-10 (AbuSaxiy №2): B2 tovarlarda o'lcham "-" yoki bo'sh —
    // ro'yxatda ma'nosiz ko'rinardi. Endi "O'lchamsiz" deb yoziladi
    // (qiymat o'zgarishsiz qoladi — tanlash mantig'i buzilmaydi).
    $("ch2-size").innerHTML = variants.map(v =>
      `<option value="${v.size}" ${v.qty<=0?"disabled":""}>${(v.size && v.size !== "-") ? v.size : "O'lchamsiz"} — ${v.qty} ${p.unit||"dona"}${v.qty<=0?" (tugagan)":""}</option>`
    ).join("");
  }
}

function confirmChiqim2() {
  const p = ch2SelectedProduct;
  if (!p) { toast("Mahsulot tanlang", "err"); return; }

  const color = ($("ch2-color")||{value:""}).value;
  const size  = ($("ch2-size")||{value:""}).value;
  const qty   = parseInt(($("ch2-qty")||{value:0}).value) || 0;
  const reason = ($("ch2-reason")||{value:"boshqa"}).value;
  const note  = ($("ch2-note")||{value:""}).value.trim();

  if (!color) { toast("Rangni tanlang", "err"); return; }
  if (qty <= 0) { toast("Miqdor kiriting", "err"); return; }

  // 2026-07-10 (AbuSaxiy №2): B2 tovarda o'lcham "-" yoki BO'SH bo'ladi.
  // Avval `!size` tekshiruvi bo'sh o'lchamli tovarni "Rang va o'lchamni
  // tanlang" deb TO'XTATIB qo'yardi (tanlangan bo'lsa ham). Endi:
  // rangda YAGONA variant bo'lsa, o'lchamdan qat'i nazar o'sha olinadi;
  // ko'p o'lchamli (klassik oyoq) tovarlarda avvalgidek aniq o'lcham shart.
  const cvAll = p.variants.filter(x => x.color === color);
  let v = cvAll.find(x => x.size === size);
  if (!v && cvAll.length === 1) v = cvAll[0];
  if (!v) { toast("O'lchamni tanlang", "err"); return; }
  if (v.qty < qty) { toast(`Faqat ${v.qty} ta mavjud`, "err"); return; }

  const rate = db.settings?.rate || 12800;
  const costUzs = getCostUzs(p);

  v.qty -= qty;

  if (!db.chiqimlar) db.chiqimlar = [];
  db.chiqimlar.push({
    id: db.seq++, date: today(), time: typeof nowTime === "function" ? nowTime() : "",
    productName: p.name, sku: p.sku,
    color, size, qty, unit: p.unit || "dona",
    reason, note: note || "",
    costUzs: costUzs * qty, costUsdEach: p.costUsd || 0
  });

  saveDB();
  closeModal("chiqim2");
  renderOmbor();
  if (typeof renderKatalog === "function") renderKatalog();

  const sababLabel = CHIQIM_SABABLAR.find(s => s.key === reason)?.label || reason;
  toast(`✅ ${p.name} (${color}/${size}) — ${qty} ta hisobdan chiqarildi (${sababLabel})`);
}

// ════════════════════════════════════════════════
// №8 (v148): PARTIYA NAKLADNOYINI CHOP ETISH — A4 ko'rinish
// Bitta kirim (sana + partiya + yetkazuvchi) bo'yicha barcha yozuvlar
// jadval qilib chiqariladi. 58mm chek uslubidan ATAYLAB alohida.
// ════════════════════════════════════════════════
function omPrintNaklad(dateEnc, partiyaEnc, supplierEnc) {
  const date     = decodeURIComponent(dateEnc||"");
  const partiya  = decodeURIComponent(partiyaEnc||"");
  const supplier = decodeURIComponent(supplierEnc||"");

  const recs = (db.ombor||[]).filter(o =>
    (o.date||"") === date &&
    (o.partiya||"") === partiya &&
    (o.supplier||"") === supplier
  );
  if (!recs.length) { toast("Kirim yozuvlari topilmadi", "err"); return; }

  // Mahsulot+rang bo'yicha guruhlash (kirim tabi bilan bir xil mantiq)
  const groups = {};
  recs.forEach(o => {
    const key = (o.productName||"") + "|" + (o.art||"") + "|" + (o.color||"");
    if (!groups[key]) groups[key] = { ...o, sizes: [], totalQty: 0, maxBoxes: 0 };
    if (o.size) groups[key].sizes.push(o.size);
    groups[key].totalQty += o.qty || 0;
    if ((o.boxes||0) > groups[key].maxBoxes) groups[key].maxBoxes = o.boxes||0;
  });
  const rows = Object.values(groups);

  let jamiPochka = 0, jamiDona = 0, jamiSumma = 0;
  const trs = rows.map((g, i) => {
    const pochka = g.maxBoxes || 0;
    const dona   = g.totalQty || 0;
    const narx   = g.kirimNarxi || 0;
    const summa  = narx * dona;
    jamiPochka += pochka; jamiDona += dona; jamiSumma += summa;
    const sizes = [...new Set(g.sizes||[])].filter(Boolean).join(", ");
    return `<tr>
      <td>${i+1}</td>
      <td style="text-align:left">${g.productName}${g.art?` <span style="color:#777">(${g.art})</span>`:""}</td>
      <td>${g.color||"—"}</td>
      <td>${sizes||"—"}</td>
      <td>${pochka ? fmt(pochka) : "—"}</td>
      <td>${fmt(dona)}</td>
      <td style="text-align:right">${narx ? fmt(narx) : "—"}</td>
      <td style="text-align:right">${summa ? fmt(summa) : "—"}</td>
    </tr>`;
  }).join("");

  const shopName = (db.settings && (db.settings.shopName || db.settings.name)) || "MERX";
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) { toast("Brauzer yangi oynani blokladi — ruxsat bering", "err"); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Nakladnoy — ${date}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h2 { margin: 0 0 4px; } .sub { color:#555; font-size:13px; margin-bottom:16px; }
      table { width:100%; border-collapse:collapse; font-size:13px; }
      th, td { border:1px solid #999; padding:6px 8px; text-align:center; }
      th { background:#f0f0f0; }
      .tot td { font-weight:700; background:#fafafa; }
      .foot { margin-top:28px; font-size:13px; display:flex; justify-content:space-between; }
      @media print { body { padding: 8px; } }
    </style></head><body>
    <h2>${shopName} — KIRIM NAKLADNOYI</h2>
    <div class="sub">
      Sana: <b>${date}</b>
      ${partiya ? ` · Partiya: <b>${partiya}</b>` : ""}
      ${supplier ? ` · Yetkazuvchi: <b>${supplier}</b>` : ""}
    </div>
    <table>
      <thead><tr>
        <th>№</th><th>Mahsulot</th><th>Rang</th><th>O'lchamlar</th>
        <th>Pochka</th><th>Dona</th><th>Narx (dona)</th><th>Summa</th>
      </tr></thead>
      <tbody>${trs}</tbody>
      <tfoot><tr class="tot">
        <td colspan="4">JAMI</td>
        <td>${jamiPochka ? fmt(jamiPochka) : "—"}</td>
        <td>${fmt(jamiDona)}</td><td></td>
        <td style="text-align:right">${fmt(jamiSumma)}</td>
      </tr></tfoot>
    </table>
    <div class="foot">
      <div>Topshirdi: ______________</div>
      <div>Qabul qildi: ______________</div>
    </div>
    <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
  </body></html>`);
  w.document.close();
}


// ═══ RASMNI KATTALASHTIRIB KO'RISH (2026-07-24, №2) ═══
// Rasm bor bo'lsa kattalashtiramiz (ichida "Almashtirish"),
// yo'q bo'lsa avvalgidek tanlagichni ochamiz.
function omImgView(sku, color) {
  const p = (db.products || []).find(x => x.sku === sku);
  const src = (p && ((p.colorImages && p.colorImages[color]) || p.image)) || "";
  if (!src || typeof showImageBig !== "function") { omImgClick(sku, color); return; }
  showImageBig(src, () => omImgClick(sku, color));
}

// ═══════════════════════════════════════════════════════════════
// KIRIMNI O'CHIRISH (2026-07-25, №4)
// Ombor va katalog PARALLEL: kirim o'chsa, tovar qoldig'i kamayadi
// va qoldiq 0 bo'lsa tovar katalogdan ham o'chadi.
// ⚠️ O'ta ehtiyot: har qadam tasdiqlanadi, sotilgan tovar tekshiriladi.
// ═══════════════════════════════════════════════════════════════
function omDeleteKirim(id) {
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("ombor","kirim")) return;

  if (typeof requireUse === "function" && !requireUse("ombor")) return;

  const o = (db.ombor || []).find(x => x.id === id);
  if (!o) { toast("Kirim topilmadi", "err"); return; }

  const p = (db.products || []).find(x => x.sku === o.sku);
  const qty = o.qty || 0;

  // Shu tovardan sotuv bo'lganmi — qoldiq manfiy bo'lib qolmasin
  const sold = (db.sales || []).reduce((a, s) =>
    a + (s.items || []).filter(i => i.sku === o.sku).reduce((b, i) => b + (i.qty || 0), 0), 0);

  const curQty = p ? p.variants.reduce((a, v) => a + (v.qty || 0), 0) : 0;

  let msg = `KIRIMNI O'CHIRISH\n\n` +
            `${o.productName || o.sku}\n` +
            `${o.color || ""}${o.size ? " · " + o.size : ""}\n` +
            `Miqdor: ${qty} ${o.unit || "dona"}\n` +
            `Sana: ${o.date || "—"}\n\n`;

  if (sold > 0) {
    msg += `⚠️ Bu tovardan ${sold} dona SOTILGAN!\n` +
           `Hozirgi qoldiq: ${curQty} dona\n\n` +
           `O'chirsangiz qoldiq ${Math.max(0, curQty - qty)} ga tushadi.\n\n`;
  } else {
    msg += `Qoldiq ${curQty} → ${Math.max(0, curQty - qty)} ga tushadi.\n\n`;
  }
  msg += `Davom etasizmi?`;

  if (!confirm(msg)) return;

  // Qoldiqni kamaytiramiz (rang bo'yicha, manfiy bo'lmaydi)
  if (p && qty > 0) {
    let left = qty;
    p.variants.forEach(v => {
      if (left <= 0) return;
      if (o.color && v.color !== o.color) return;
      const take = Math.min(v.qty || 0, left);
      v.qty = (v.qty || 0) - take;
      left -= take;
    });
  }

  // Kirim yozuvini o'chiramiz
  try { if (typeof queueCloudDelete === "function") queueCloudDelete("ombor", "id", id); } catch(e) {}
  db.ombor = (db.ombor || []).filter(x => x.id !== id);

  // Qoldiq 0 va boshqa kirimi yo'q bo'lsa — tovar ham o'chadi
  let prodRemoved = false;
  if (p) {
    const newQty  = p.variants.reduce((a, v) => a + (v.qty || 0), 0);
    const hasMore = (db.ombor || []).some(x => x.sku === p.sku);
    if (newQty <= 0 && !hasMore) {
      try { if (typeof queueCloudDelete === "function") queueCloudDelete("products", "sku", p.sku); } catch(e) {}
      db.products = db.products.filter(x => x.sku !== p.sku);
      prodRemoved = true;
    }
  }

  saveDB();
  // 2026-07-25: o'chirish DARHOL bulutga — aks holda F5 da tovar "tirilardi"
  try { if (typeof flushCloudSync === "function") flushCloudSync(true); } catch(e) {}
  if (typeof renderOmbor === "function") renderOmbor();
  if (typeof renderKatalog === "function") renderKatalog();
  toast(prodRemoved
    ? `Kirim o'chirildi — "${o.productName}" katalogdan ham chiqarildi`
    : `Kirim o'chirildi (${qty} ${o.unit || "dona"})`, "info");
}

// ═══ PARTIYANI BUTUNLAY O'CHIRISH (2026-07-25, №4) ═══
// Variativ yoki import bilan kiritilgan partiya — hammasi birdan.
// Uch bosqichli tasdiq: bu ko'p tovarga tegadi.
function omDeletePartiya(partiya) {
  if (!partiya) { toast("Partiya tanlanmagan", "err"); return; }

  const rows = (db.ombor || []).filter(o => o.partiya === partiya);
  if (!rows.length) { toast("Bu partiyada kirim yo'q", "err"); return; }

  const skus = [...new Set(rows.map(o => o.sku))];
  const totalQty = rows.reduce((a, o) => a + (o.qty || 0), 0);

  // Sotuv bo'lganini tekshiramiz
  const soldSkus = skus.filter(sku =>
    (db.sales || []).some(s => (s.items || []).some(i => i.sku === sku)));

  let msg = `PARTIYANI O'CHIRISH\n\n"${partiya}"\n\n` +
            `${rows.length} ta kirim yozuvi\n` +
            `${skus.length} ta tovar\n` +
            `Jami ${totalQty} dona\n\n`;
  if (soldSkus.length) {
    msg += `⚠️ ${soldSkus.length} ta tovardan SOTUV bo'lgan!\n\n`;
  }
  msg += `Bu tovarlar katalogdan ham o'chishi mumkin.\nDavom etasizmi?`;

  if (!confirm(msg)) return;
  if (!confirm(`TASDIQLANG\n\n${skus.length} ta tovar va ${rows.length} ta kirim yozuvi o'chadi.\n\nBu amalni QAYTARIB BO'LMAYDI.`)) return;

  // Har tovar qoldig'ini kamaytiramiz
  rows.forEach(o => {
    const p = (db.products || []).find(x => x.sku === o.sku);
    if (!p) return;
    let left = o.qty || 0;
    p.variants.forEach(v => {
      if (left <= 0) return;
      if (o.color && v.color !== o.color) return;
      const take = Math.min(v.qty || 0, left);
      v.qty = (v.qty || 0) - take;
      left -= take;
    });
  });

  // Kirim yozuvlarini o'chiramiz
  try {
    if (typeof queueCloudDelete === "function")
      rows.forEach(r => queueCloudDelete("ombor", "id", r.id));
  } catch(e) {}
  db.ombor = (db.ombor || []).filter(o => o.partiya !== partiya);

  // Qoldig'i 0 va boshqa kirimi yo'q tovarlarni katalogdan chiqaramiz
  let removed = 0;
  skus.forEach(sku => {
    const p = (db.products || []).find(x => x.sku === sku);
    if (!p) return;
    const qty     = p.variants.reduce((a, v) => a + (v.qty || 0), 0);
    const hasMore = (db.ombor || []).some(x => x.sku === sku);
    if (qty <= 0 && !hasMore) {
      try { if (typeof queueCloudDelete === "function") queueCloudDelete("products", "sku", sku); } catch(e) {}
      db.products = db.products.filter(x => x.sku !== sku);
      removed++;
    }
  });

  saveDB();
  // 2026-07-25: o'chirish DARHOL bulutga — aks holda F5 da tovar "tirilardi"
  try { if (typeof flushCloudSync === "function") flushCloudSync(true); } catch(e) {}
  if (typeof renderOmbor === "function") renderOmbor();
  if (typeof renderKatalog === "function") renderKatalog();
  toast(`Partiya o'chirildi — ${rows.length} ta kirim, ${removed} ta tovar`, "info");
}
