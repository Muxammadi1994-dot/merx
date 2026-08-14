// MERX tarix.js | v2.5 | 2026-06-09 | items null fix
// ================================================

let txPeriod  = "today"; // v155 (№14): standart Bugun
let txStatus  = "all";
let txStaffId = "all";
let _sdSaleId = null;

function setTxStaff(id) {
  txStaffId = id;
  renderTarix();
}

function setTxPeriod(p) {
  txPeriod = p;
  txResetLimit();   // 2026-07-31: yangi davr — ro'yxat boshidan
  // Kalendar inputlarni tozalaymiz (custom davr bekor bo'ladi)
  if (p !== "custom") {
    const f = $("tx-date-from"), t = $("tx-date-to");
    if (f) f.value = ""; if (t) t.value = "";
  }
  document.querySelectorAll(".tx-period-btn").forEach(b => {
    const on = b.dataset.p === p;
    b.classList.toggle("on", on);
    b.style.background = on ? "#0D1B2A" : "transparent";
    b.style.color = on ? "#fff" : "var(--mut)";
  });
  renderTarix();
}

function setTxCustomRange() {
  const from = ($("tx-date-from")||{value:""}).value;
  const to   = ($("tx-date-to")||{value:""}).value;
  if (!from && !to) return;
  txPeriod = "custom";
  txResetLimit();
  // Barcha period tugmalarini o'chiramiz
  document.querySelectorAll(".tx-period-btn").forEach(b => {
    b.classList.remove("on");
    b.style.background = "transparent";
    b.style.color = "var(--mut)";
  });
  renderTarix();
}

function setTxStatus(s) {
  txStatus = s;
  document.querySelectorAll(".tx-status-btn").forEach(b => {
    const on = b.dataset.s === s;
    b.classList.toggle("on", on);
    b.style.background = on ? "#0D1B2A" : "#fff";
    b.style.color = on ? "#fff" : (b.dataset.s === "qaytarilgan" ? "var(--red)" : "");
  });
  renderTarix();
}

function txPeriodFilter(s) {
  const d = s.date || "";
  const t = today();
  if (txPeriod === "today")     return d === t;
  if (txPeriod === "yesterday") return d === addDays(t, -1);
  if (txPeriod === "week")      return d >= addDays(t, -6);
  if (txPeriod === "month")     return d.startsWith(t.slice(0, 7));
  if (txPeriod === "year")      return d.startsWith(t.slice(0, 4));
  if (txPeriod === "custom") {
    const from = ($("tx-date-from")||{value:""}).value;
    const to   = ($("tx-date-to")||{value:""}).value;
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  }
  return true; // "all"
}

// ── Sotuv tarixi ustunlari boshqaruvi ─────────────
const TARIX_COL_DEFS = [
  { key:"items",   lbl:"Mahsulotlar",  def:true },
  { key:"pchka",   lbl:"Pochka soni",  def:true },  // №13
  { key:"mijoz",   lbl:"Mijoz",        def:true },
  { key:"tolov",   lbl:"To'lov usuli", def:true },
  { key:"tolandi", lbl:"To'landi",     def:true },
  { key:"qoldi",   lbl:"Qoldi",        def:true },
  { key:"holat",   lbl:"Holat",        def:true },
];

function getTarixCols() {
  const saved = db.settings?.tarixCols;
  const cols = {};
  TARIX_COL_DEFS.forEach(c => { cols[c.key] = saved && c.key in saved ? saved[c.key] : c.def; });
  // 2026-08-02: RUXSAT QATLAMI — `db.settings` ga TEGILMAYDI.
  try {
    if (typeof permSee === "function") {
      ["mijoz","tolandi","qoldi","tolov"].forEach(k => {
        if (!permSee("tarix", k)) cols[k] = false;
      });
    }
  } catch(e) {}
  return cols;
}

function openTarixColsSettings() {
  const cols = getTarixCols();
  const list = $("tarix-cols-settings-list");
  if (list) {
    list.innerHTML = TARIX_COL_DEFS.map(c => `
      <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--brd);border-radius:9px;cursor:pointer">
        <input type="checkbox" ${cols[c.key]?"checked":""} onchange="toggleTarixCol('${c.key}',this.checked)"
          style="width:17px;height:17px;accent-color:var(--acc);cursor:pointer">
        <span style="font-size:13px;font-weight:600">${c.lbl}</span>
      </label>`).join("");
  }
  openModal("tarixcols");
}

function toggleTarixCol(key, val) {
  if (!db.settings) db.settings = {};
  if (!db.settings.tarixCols) db.settings.tarixCols = {};
  db.settings.tarixCols[key] = val;
  saveDB();
  renderTarix();
}

// Sahifalash (2026-07-31) — katalog bilan bir xil uslub
let _txPage = 1;
function txGoPage(p) { _txPage = p; renderTarix(); pagerScrollTop("p-tarix"); }
function txResetLimit() { _txPage = 1; }

// ── Ko'rinish rejimi (2026-08-05) ─────────────────
// Katalog/ombordagi bilan bir xil uslub. Standart — JADVAL,
// ya'ni tugma bosilmaguncha hech narsa o'zgarmaydi.
let txViewMode = viewModeGet("tx");   // qurilmada saqlanadi (utils.js)

function setTxView(v) {
  txViewMode = v;
  viewModeSet("tx", v);
  document.querySelectorAll(".tx-view-btn").forEach(b => {
    const on = b.dataset.v === v;
    b.style.background = on ? "var(--acc)" : "transparent";
    b.style.color      = on ? "#0D1B2A" : "";
  });
  renderTarix();
}

function renderTarix() {
  const q = ($("tarix-q")||{value:""}).value.toLowerCase().trim();
  // Tozalash tugmasini ko'rsatish/yashirish
  const clrBtn = $("tarix-q-clr");
  if (clrBtn) clrBtn.style.display = q ? "block" : "none";

  // 2026-07-25: bekor qilingan sotuvlar ro'yxatda KO'RSATILMAYDI.
  // Yozuv bazada qoladi (sinxron va audit uchun), faqat yashiriladi.
  let list = (db.sales || []).filter(s => !s.cancelled)
    .slice().sort((a,b) => ((a.date||"")+(a.time||"") < (b.date||"")+(b.time||"")) ? 1 : -1).filter(s => { // v154 (№13): aniq yangi-birinchi
    if (!s) return false;
    if (!txPeriodFilter(s)) return false;
    if (txStatus === "tolandan"    && s.status !== "tolandan")    return false;
    if (txStatus === "qarz"        && s.status !== "qarz")        return false;
    if (txStatus === "qaytarilgan" && s.status !== "qaytarilgan") return false;
    if (txStaffId !== "all" && String(s.staffId) !== String(txStaffId)) return false;
    if (!q) return true;
    // 2026-08-02: ko'p parametrli qidiruv (utils.js → srchMatcher).
    // Telefon ALOHIDA qoladi: unda faqat raqamlar solishtiriladi.
    // (2026-07-20 dagi tuzatish saqlandi — ism yozilganda telefon
    //  filtri hammani "mos" deb chiqarib yubormasin.)
    const _m = srchMatcher(q);
    const _phOk = /\d/.test(q) &&
      (s.customerPhone||"").replace(/\D/g,"").includes(q.replace(/\D/g,""));
    return _phOk || _m(
      s.customerName, s.chekNum, s.note, String(s.id),
      (s.items||[]).filter(Boolean).map(i =>
        [i.name, i.art, i.sku, i.color].filter(Boolean).join(" ")).join(" ")
    );
  });

  // Kassir select yangilash
  const staffSel = $("tx-staff-sel");
  if (staffSel && staffSel.options.length <= 1) {
    (db.staff||[]).forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name + " (" + (s.role||"kassir") + ")";
      staffSel.appendChild(opt);
    });
  }

  // KPI
  const total = list.reduce((a, s) => a + (s.total||0), 0);
  const paid  = list.reduce((a, s) => a + (s.paid ||0), 0);
  const rem   = list.reduce((a, s) => a + (s.remaining||0), 0);
  // №13: jami pochkalar (faqat pochka rejimidagi tovarlar)
  const jamiPchka = list.reduce((a, s) =>
    a + (s.items||[]).filter(Boolean).reduce((b, i) =>
      i.sellMode === "karobka" && i.inBox > 0
        ? b + (i.qtyBox || Math.round((i.qty||0)/(i.inBox||1)))
        : b, 0), 0);

  // Faol davr belgisini aniqlaymiz
  const periodNames = { all:"(barchasi)", today:"(bugun)", yesterday:"(kecha)", week:"(hafta)", month:"(oy)", year:"(yil)", custom:"(tanlangan davr)" };
  const statusNames = { all:"", tolandan:" · to'langan", qarz:" · nasiya", qaytarilgan:" · qaytarilgan" };
  const periodLabel = (periodNames[txPeriod]||"") + (statusNames[txStatus]||"");
  if ($("tx-period-label")) $("tx-period-label").textContent = periodLabel;

  if ($("tx-cnt"))   $("tx-cnt").textContent   = list.length + " ta";
  if ($("tx-total")) $("tx-total").textContent = fmt(total) + " so'm";
  if ($("tx-paid"))  $("tx-paid").textContent  = fmt(paid)  + " so'm";
  if ($("tx-rem"))   $("tx-rem").textContent   = fmt(rem)   + " so'm";
  // №13: jami DONA (barcha sotilgan tovarlar bo'yicha)
  const jamiDona = list.reduce((a, s) =>
    a + (s.items||[]).filter(Boolean).reduce((b, i) => b + (i.qty || 0), 0), 0);
  const pchDonaEl = $("tx-pch-dona");
  if (pchDonaEl) pchDonaEl.textContent = jamiDona > 0 ? fmt(jamiDona) + " dona" : "";

  // №13: pochka statistikasi
  const pchEl = $("tx-pch");
  if (pchEl) { pchEl.textContent = jamiPchka > 0 ? jamiPchka + " pch" : "—";
               pchEl.closest && pchEl.closest(".tx-pch-wrap") &&
               (pchEl.closest(".tx-pch-wrap").style.display = jamiPchka > 0 ? "" : "none"); }

  const cols = getTarixCols();

  // Jadval header ni cols ga qarab yangilaymiz
  const thead = document.querySelector("#p-tarix thead tr");
  if (thead) {
    const colCount = 4 + Object.values(cols).filter(Boolean).length;
    thead.innerHTML = `
      <th>Chek</th><th>Sana / Vaqt</th>
      ${cols.items   ? "<th>Mahsulotlar</th>" : ""}
      ${cols.pchka   ? '<th class="num">Pochka</th>' : ""}
      ${cols.mijoz   ? "<th>Mijoz</th>" : ""}
      ${cols.tolov   ? "<th>To'lov</th>" : ""}
      <th class="num">Jami</th>
      ${cols.tolandi ? '<th class="num">To\'landi</th>' : ""}
      ${cols.qoldi   ? '<th class="num">Qoldi</th>' : ""}
      ${cols.holat   ? "<th>Holat</th>" : ""}
      <th></th>`;
  }

  const tbody = $("tarix-body");
  if (!tbody) return;

  // ── Ko'rinish rejimi (2026-08-05) ───────────────
  // ⚠️ Quyidagi JADVAL kodi butunlay tegilmagan — u har doim
  // chiziladi. Bu yerda faqat qaysi biri KO'RINISHI hal qilinadi.
  const _txTW = $("tarix-table-wrap");
  const _txGW = $("tarix-grid-wrap");
  if (_txTW) _txTW.style.display = txViewMode === "grid" ? "none" : "";
  if (_txGW) _txGW.style.display = txViewMode === "grid" ? "" : "none";
  if (txViewMode === "grid" && !list.length) _renderTxGrid([], cols, "", q);

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-td">
      ${q || txPeriod !== "all" || txStatus !== "all" ? "Filtr bo'yicha sotuv topilmadi" : "Sotuv tarixi bo'sh"}
    </td></tr>`;
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // SAHIFALASH (2026-07-31)
  // ══════════════════════════════════════════════════════════════
  // AVVAL: mos kelgan HAMMA sotuv birdan chizilardi. "Yil" tanlansa
  // 2853 qator HTML qilib yasalib, bir yo'la joylashtirilardi — har
  // qatorda tovarlar ro'yxati, qaytarishlar, holat hisobi bor.
  // Shu sababli filtr almashtirilganda ilova qotib qolardi.
  // Endi bir martada 100 qator chiziladi, qolgani tugma bilan.
  // Yuqoridagi jamlanma (KPI) hisoblari TO'LIQ ro'yxatdan olinadi —
  // ular o'zgarmadi.
  // 2026-08-02: EKSPORT uchun yakuniy ro'yxat (sahifalashdan OLDIN)
  try { setExportList("tarix", list); } catch(e) {}
  const _txTotal = list.length;
  _txPage = clampPage(_txPage, _txTotal);
  const _txList = pageSlice(list, _txPage);

  // Har bir qatorni alohida try/catch bilan render qilamiz
  let html = "";
  _txList.forEach(s => {
    try {
      const isDebt     = s.status === "qarz" && (s.remaining||0) > 0;
      const isReturned = s.status === "qaytarilgan";
      const chekN      = s.chekNum || `#${s.id}`;
      // 2026-07-25: qisman qaytarish belgisi — chek raqami yonida
      const _refs      = s.refunds || [];
      const _partialRef = _refs.length > 0 && !isReturned;
      const _refBadge  = _refs.length
        ? `<div style="font-size:10.5px;color:#B91C1C;font-weight:700;margin-top:2px"
             title="${_refs.map(r => r.no + ": " + fmt(r.total) + " so'm").join("&#10;")}">
             ↩ ${isReturned ? "To'liq qaytarilgan" : "Qisman qaytarilgan"}
             · ${fmt(s.refundedTotal || 0)} so'm</div>`
        : "";

      // items null bo'lishi mumkin — filter qilamiz
      const safeItems  = (s.items||[]).filter(Boolean);
      const itemsHtml  = safeItems.length
        ? safeItems.map(i => {
            const isBox = i.sellMode === "karobka" && i.inBox > 0;
            const dispQty = isBox ? (i.qtyBox || Math.round((i.qty||0)/(i.inBox||1))) : (i.qty||0);
            const dispUnit = isBox ? "pch" : (i.unit || "dona");
            const donaSuffix = isBox ? ` <span style="color:#aaa;font-size:10px">(${i.qty||0} ${i.unit||"dona"})</span>` : "";
            return `<div style="font-size:12px">${i.name||"?"} <span style="color:#bbb">×${dispQty} ${dispUnit}${donaSuffix}</span></div>`;
          }).join("")
        : "—";

      const debtCell = isDebt
        ? `<span style="color:var(--red);font-weight:700">${
            s.debtCurrency==="usd" && s.debtUsd
              ? `$${(+s.debtUsd).toFixed(2)}`
              : fmt(s.remaining||0)+" so'm"
          }</span>`
        : `<span style="color:var(--grn);font-size:11px">—</span>`;

      const _cxl = !!s.cancelled;
      html += `<tr style="cursor:pointer;${_cxl?"opacity:.5;background:#F3F4F6;text-decoration:line-through":isReturned?"opacity:.6;background:#FEF2F2":""}" onclick="openSaleDetail(${s.id})">
        <td>
          <div style="font-family:monospace;font-size:11px;font-weight:700;color:#0D1B2A">${chekN}</div>
          ${_refBadge}
          ${s.note ? `<div style="font-size:10px;color:#856404;margin-top:1px">📝 ${s.note}</div>` : ""}
        </td>
        <td style="font-size:12px">
          <div style="font-weight:600">${s.date||"—"}</div>
          <div style="color:#aaa">${s.time||""}</div>
        </td>
        ${cols.items ? `<td>${itemsHtml}</td>` : ""}
        ${cols.pchka ? `<td class="num" style="font-size:12px">${
          (() => {
            // Jami pochkalar: sellMode=karobka bo'lgan itemlar qtyBox yig'indisi
            const total = safeItems.reduce((a, i) => {
              if (i.sellMode === "karobka" && i.inBox > 0)
                return a + (i.qtyBox || Math.round((i.qty||0)/(i.inBox||1)));
              return a;
            }, 0);
            return total > 0 ? `<span style="font-weight:700">${total}</span> pch` : "<span style='color:#ccc'>—</span>";
          })()
        }</td>` : ""}
        ${cols.mijoz ? `<td style="font-size:12.5px">
          <div style="font-weight:600">${s.customerName||"—"}</div>
          ${s.customerPhone ? `<div style="font-size:11px;color:#aaa">${s.customerPhone}</div>` : ""}
        </td>` : ""}
        ${cols.tolov ? `<td>
          <span class="bg" style="font-size:11px">${(() => {
            if (s.payType === "aralash" && s.payBreakdown) {
              const lbls = {naqd:"Naqd",karta:"Karta",otkazma:"O'tkazma"};
              return Object.entries(s.payBreakdown).filter(([m,v])=>m!=="qarz"&&v>0).map(([m])=>lbls[m]||m).join("+") || "Aralash";
            }
            if (s.payType === "qarz") return "Nasiya";
            return PAYTYPES[s.payType]||s.payType||"—";
          })()}</span>
          <div style="margin-top:3px">
            <span class="bg ${s.priceType==="ulgurji"?"bg-a":""}" style="font-size:10.5px">
              ${s.priceType==="ulgurji"?"📦 Ulgurji":"👤 Chakana"}
            </span>
          </div>
        </td>` : ""}
        <td class="num" style="font-weight:700;font-size:13px">${fmt(s.total||0)} so'm</td>
        ${cols.tolandi ? `<td class="num" style="color:var(--grn);font-size:12.5px">${fmt(s.paid||0)} so'm</td>` : ""}
        ${cols.qoldi  ? `<td class="num">${debtCell}</td>` : ""}
        ${cols.holat  ? `<td>
          <span class="bg ${_cxl?"bg-r":isReturned?"bg-r":isDebt?"bg-a":"bg-g"}" style="font-size:11px">
            ${_cxl ? "🚫 Bekor qilingan" : isReturned ? "↩ Qaytarilgan" : isDebt ? "💳 Qarzda" : "✅ To'langan"}
          </span>
        </td>` : ""}
        <td onclick="event.stopPropagation()" style="white-space:nowrap">
          <div style="display:inline-flex;align-items:center;gap:10px">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="openSaleDetail(${s.id})" title="Ko'rish">
              <i class="ti ti-eye"></i>
            </button>
            ${(!isReturned && !s.cancelled && _canCancelSaleBtn()) ? `
            <button class="btn btn-ghost btn-icon btn-sm" onclick="openSaleCancel(${s.id})"
              title="Sotuvni bekor qilish" style="color:var(--red)">
              <i class="ti ti-trash"></i>
            </button>` : ""}
          </div>
        </td>
      </tr>`;
    } catch(e) {
      console.warn("Sotuv render xatosi:", s.id, e.message);
    }
  });

  html += pagerRow(10, _txTotal, _txPage, "txGoPage", "chek");
  tbody.innerHTML = html || `<tr><td colspan="10" class="empty-td">Render xatosi — console ni tekshiring</td></tr>`;

  if (txViewMode === "grid") {
    _renderTxGrid(_txList, cols,
      pagerRow(1, _txTotal, _txPage, "txGoPage", "chek"), q);
  }
}

// ── Sotuv tarixi: katak ko'rinish (2026-08-05) ────
// ⚠️ HISOB YO'Q. renderTarix tayyorlagan ro'yxatdan o'qiydi.
// ⚠️ `cols` — getTarixCols() dan (ustun sozlamalari hisobga olinadi).
// ⚠️ Kartochkaga bosish YO'Q — chek faqat 👁 tugmasi orqali ochiladi.
//    🗑 (bekor qilish) jadvaldagi shartning aynan o'zi bilan:
//    qaytarilmagan + bekor qilinmagan + hasRole("admin").
function _renderTxGrid(list, cols, pagerHtml, q) {
  const el = $("tarix-grid-wrap");
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--mut)">
      ${q || txPeriod !== "all" || txStatus !== "all" ? "Filtr bo'yicha sotuv topilmadi" : "Sotuv tarixi bo'sh"}
    </div>`;
    return;
  }

  const css = `<style>
    .tgw{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;padding:16px}
    .tg-card{border:1.5px solid var(--brd);border-radius:10px;padding:10px 12px;position:relative;display:flex;flex-direction:column;transition:.13s}
    .tg-card:hover{border-color:var(--acc)}
    .tg-head{padding-right:74px}
    .tg-chek{font-family:monospace;font-size:11.5px;font-weight:700;color:#0D1B2A}
    .tg-dt{font-size:11.5px;color:var(--mut);margin-top:1px}
    .tg-cust{font-size:12.5px;font-weight:600;margin-top:5px}
    .tg-ph{font-size:11px;color:#aaa;font-weight:400}
    .tg-items{margin-top:5px;font-size:11.5px;color:#444;line-height:1.45}
    .tg-badges{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:6px}
    .tg-money{margin-top:7px;font-size:12px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
    .tg-total{font-weight:800;font-size:13.5px;color:#0D1B2A}
    .tg-lbl{color:var(--mut);font-weight:400;font-size:11px}
    .tg-foot{position:absolute;right:6px;top:6px;display:flex;gap:4px}
    @media (max-width:560px){
      .tgw{grid-template-columns:1fr;gap:7px;padding:9px}
      .tg-card{padding:8px 10px}
      .tg-items{font-size:11px}
    }
  </style>`;

  const cards = list.map(s => {
    try {
      const isDebt     = s.status === "qarz" && (s.remaining||0) > 0;
      const isReturned = s.status === "qaytarilgan";
      const _cxl       = !!s.cancelled;
      const chekN      = s.chekNum || `#${s.id}`;
      const _refs      = s.refunds || [];
      const _refBadge  = _refs.length
        ? `<div style="font-size:10.5px;color:#B91C1C;font-weight:700;margin-top:2px">
             ↩ ${isReturned ? "To'liq qaytarilgan" : "Qisman qaytarilgan"} · ${fmt(s.refundedTotal || 0)} so'm</div>`
        : "";

      const safeItems = (s.items||[]).filter(Boolean);
      // Kartochkada eng ko'pi 3 ta tovar, qolgani "+N ta" (jadvalda hammasi)
      const shown = safeItems.slice(0, 3);
      const itemsHtml = !cols.items ? "" : (safeItems.length
        ? `<div class="tg-items">${shown.map(i => {
            const isBox = i.sellMode === "karobka" && i.inBox > 0;
            const dispQty = isBox ? (i.qtyBox || Math.round((i.qty||0)/(i.inBox||1))) : (i.qty||0);
            const dispUnit = isBox ? "pch" : (i.unit || "dona");
            return `<div>${i.name||"?"} <span style="color:#bbb">×${dispQty} ${dispUnit}</span></div>`;
          }).join("")}${safeItems.length > 3
            ? `<div style="color:#aaa">+${safeItems.length - 3} ta yana</div>` : ""}</div>`
        : "");

      const pchTotal = safeItems.reduce((a, i) =>
        (i.sellMode === "karobka" && i.inBox > 0)
          ? a + (i.qtyBox || Math.round((i.qty||0)/(i.inBox||1))) : a, 0);
      const pchBadge = (cols.pchka && pchTotal > 0)
        ? `<span class="bg" style="font-size:10.5px">📦 ${pchTotal} pch</span>` : "";

      const payLabel = (() => {
        if (s.payType === "aralash" && s.payBreakdown) {
          const lbls = {naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma"};
          return Object.entries(s.payBreakdown).filter(([m,v])=>m!=="qarz"&&v>0)
            .map(([m])=>lbls[m]||m).join("+") || "Aralash";
        }
        if (s.payType === "qarz") return "Nasiya";
        return PAYTYPES[s.payType]||s.payType||"—";
      })();
      const payBadge = cols.tolov
        ? `<span class="bg" style="font-size:10.5px">${payLabel}</span>
           <span class="bg ${s.priceType==="ulgurji"?"bg-a":""}" style="font-size:10.5px">${s.priceType==="ulgurji"?"📦 Ulgurji":"👤 Chakana"}</span>`
        : "";
      const statusBadge = cols.holat
        ? `<span class="bg ${_cxl?"bg-r":isReturned?"bg-r":isDebt?"bg-a":"bg-g"}" style="font-size:10.5px">
             ${_cxl ? "🚫 Bekor qilingan" : isReturned ? "↩ Qaytarilgan" : isDebt ? "💳 Qarzda" : "✅ To'langan"}</span>`
        : "";

      const remTxt = s.debtCurrency === "usd" && s.debtUsd
        ? `$${(+s.debtUsd).toFixed(2)}` : fmt(s.remaining||0) + " so'm";

      const canCancel = !isReturned && !s.cancelled && _canCancelSaleBtn();

      return `<div class="tg-card" style="${_cxl?"opacity:.5;background:#F3F4F6":isReturned?"opacity:.75;background:#FEF2F2":""}">
        <div class="tg-foot">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="openSaleDetail(${s.id})" title="Ko'rish">
            <i class="ti ti-eye"></i>
          </button>
          ${canCancel ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="openSaleCancel(${s.id})"
            title="Sotuvni bekor qilish" style="color:var(--red)"><i class="ti ti-trash"></i></button>` : ""}
        </div>
        <div class="tg-head">
          <div class="tg-chek">${chekN}</div>
          <div class="tg-dt">${s.date||"—"} · ${s.time||""}</div>
        </div>
        ${_refBadge}
        ${s.note ? `<div style="font-size:10.5px;color:#856404;margin-top:2px">📝 ${s.note}</div>` : ""}
        ${cols.mijoz ? `<div class="tg-cust">${s.customerName||"—"}${
          s.customerPhone ? ` <span class="tg-ph">${s.customerPhone}</span>` : ""}</div>` : ""}
        ${itemsHtml}
        <div class="tg-badges">${payBadge}${pchBadge}${statusBadge}</div>
        <div class="tg-money">
          <span class="tg-total">${fmt(s.total||0)} so'm</span>
          ${cols.tolandi ? `<span style="color:var(--grn)"><span class="tg-lbl">To'landi:</span> ${fmt(s.paid||0)} so'm</span>` : ""}
          ${cols.qoldi ? (isDebt
            ? `<span style="color:var(--red);font-weight:700"><span class="tg-lbl">Qoldi:</span> ${remTxt}</span>`
            : "") : ""}
        </div>
      </div>`;
    } catch(e) {
      console.warn("Sotuv katak render xatosi:", s.id, e.message);
      return "";
    }
  }).join("");

  // Sahifalash — mavjud pagerRow() dan (yagona manba). U <tr> qaytaradi,
  // shuning uchun kichik jadval ichiga o'raladi.
  const pager = pagerHtml ? `<table style="width:100%;border:none"><tbody>${pagerHtml}</tbody></table>` : "";
  el.innerHTML = css + `<div class="tgw">` + cards + `</div>` + pager;
}

// ── Sotuv detail modal ────────────────────────────
// ⚠️ 2026-08-08: OSILGAN CHEKNI BULUTGA ITARISH (JS 3177 hodisasi).
// Eskirgan sessiyada qilingan yozuv rad etilib qolsa, sessiya
// yangilangach ham barmoq izi tufayli qayta ketmasligi mumkin.
// Bu tugma yozuvga yangi vaqt muhri beradi, kesh izini o'chiradi
// va pushni darhol uyg'otadi. Ma'lumotning o'ziga TEGMAYDI —
// istalgan chekda bosish xavfsiz.
function saleForcePush() {
  const s = (db.sales || []).find(x => x.id === _sdSaleId);
  if (!s) { toast("Sotuv topilmadi", "err"); return; }
  // ⚠️ 2026-08-08: ISO MATN (son EMAS). Tizimning qolgan qismi
  // muhrni `Date.parse(...)` bilan o'qiydi — u sonni tushunmaydi va
  // 0 qaytaradi, ya'ni bu yozuv "eng eski" bo'lib qolardi va
  // tortishda bulut nusxasi uni bosib ketardi. Endi `_stamp` bilan
  // bir xil format.
  s.updatedAt = new Date().toISOString();
  try { if (typeof _pushCache !== "undefined") delete _pushCache[String(s.id)]; } catch(e) {}
  try { saveDB(); } catch(e) {}
  try { if (typeof pushToCloud === "function") pushToCloud(); } catch(e) {}
  toast("🔁 Chek bulutga qayta yuborilmoqda — 20 soniyadan keyin tekshiring");
}

function openSaleDetail(id) {
  const s = db.sales.find(x => x.id === id); if (!s) return;
  _sdSaleId = id;

  if ($("sd-cheknum")) $("sd-cheknum").textContent = s.chekNum || `#${s.id}`;
  if ($("sd-dt"))      $("sd-dt").textContent      = `${s.date||""} ${s.time||""}`;

  if ($("sd-items")) {
    const safeItems = (s.items||[]).filter(Boolean);
    $("sd-items").innerHTML = `
      <div style="font-size:10px;color:#aaa;font-weight:700;text-transform:uppercase;margin-bottom:8px">Mahsulotlar</div>
      ${safeItems.map(i => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--brd)">
          <div>
            <div style="font-weight:600;font-size:13px">${i.name||"?"}</div>
            <div style="font-size:11.5px;color:#aaa">${i.variant||""} · ${i.qty||0} ${i.unit||"dona"}</div>
          </div>
          <div style="font-weight:700;font-size:13px">${fmt((i.price||0)*(i.qty||0))} so'm</div>
        </div>`
      ).join("") || "<div style='color:#ccc;padding:8px 0'>Mahsulot ma'lumoti yo'q</div>"}`;
  }

  if ($("sd-totals")) {
    const disc = s.discount || 0;
    // ⚠️ 2026-08-08: ETALON (utils.js:1463) bilan tenglashtirildi.
    // Avval bu yerda "Subtotal" deb `s.subtotal` yozilardi va u
    // faqat `subtotal !== total` bo'lganda chiqardi — tovar
    // darajasidagi chegirmani ko'rsatmasdi. Endi yorliq, shart va
    // qiymat ilova cheki bilan bir xil.
    const _itemDisc = (s.items || []).reduce((a, it) =>
      a + ((Number(it.basePrice) > Number(it.price || 0))
           ? (Number(it.basePrice) - Number(it.price || 0)) * Number(it.qty || 1) : 0), 0);
    $("sd-totals").innerHTML = `
      ${(_itemDisc + disc) > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#888;margin-bottom:4px">
          <span>Jami (chegirmasiz)</span><span>${fmt((s.total || 0) + _itemDisc + disc)} so'm</span>
        </div>
        ${_itemDisc > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#B91C1C;margin-bottom:4px">
          <span>Tovar chegirmalari</span><span>−${fmt(_itemDisc)} so'm</span>
        </div>` : ""}
        ${disc > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#E05A5A;margin-bottom:4px">
          <span>Umumiy chegirma</span><span>−${fmt(disc)} so'm</span>
        </div>` : ""}` : ""}
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;font-size:14px">Jami</span>
        <span style="font-weight:900;font-size:18px">${fmt(s.total||0)} so'm</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--grn);margin-top:5px">
        <span>To'landi</span><span>${fmt(s.paid||0)} so'm</span>
      </div>
      ${(s.remaining||0) > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--red);margin-top:3px;font-weight:600">
          <span>Qolgan qarz</span>
          <span>${s.debtCurrency==="usd"&&s.debtUsd ? `$${(+s.debtUsd).toFixed(2)} USD` : fmt(s.remaining)+" so'm"}</span>
        </div>
        ${s.due ? `<div style="font-size:12px;color:#D97706;margin-top:2px;text-align:right">Muddat: ${s.due}</div>` : ""}
      ` : ""}`;
  }

  if ($("sd-info")) {
    const staff = (db.staff||[]).find(x => x.id === s.staffId);
    $("sd-info").innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12.5px">
        <div><span style="color:#aaa">Mijoz: </span><strong>${s.customerName||"—"}</strong></div>
        <div><span style="color:#aaa">Tel: </span><strong>${s.customerPhone||"—"}</strong></div>
        <div><span style="color:#aaa">To'lov: </span><strong>${(() => {
            if (s.payType === "aralash" && s.payBreakdown) {
              const lbls = {naqd:"Naqd",karta:"Karta",otkazma:"O'tkazma"};
              const parts = Object.entries(s.payBreakdown).filter(([m,v])=>m!=="qarz"&&v>0).map(([m,v])=>`${lbls[m]||m}: ${fmt(v)} so'm`);
              return parts.join(", ") || "Aralash";
            }
            if (s.payType === "qarz") return "Nasiya";
            return PAYTYPES[s.payType]||s.payType||"—";
          })()}</strong></div>
        <div><span style="color:#aaa">Narx turi: </span><strong>${s.priceType==="ulgurji"?"Ulgurji":"Chakana"}</strong></div>
        <div><span style="color:#aaa">Kassir: </span><strong>${staff?.name||"—"}</strong></div>
        <div><span style="color:#aaa">Holat: </span><strong>${s.status==="qarz"?"Qarzda":s.status==="qaytarilgan"?"Qaytarilgan":"To'langan"}</strong></div>
      </div>`;
  }

  const noteWrap = $("sd-note-wrap");
  if (noteWrap) {
    if (s.note) { noteWrap.style.display = "block"; if ($("sd-note")) $("sd-note").textContent = s.note; }
    else noteWrap.style.display = "none";
  }

  const waBtn = $("sd-wa-btn");
  if (waBtn) waBtn.style.display = s.customerPhone ? "inline-flex" : "none";

  const refBtn = $("sd-refund-btn");
  if (refBtn) refBtn.style.display = s.status !== "qaytarilgan" ? "inline-flex" : "none";

  // ⚠️ 2026-08-08: "Bulutga" tugmasi majburiy sinxron kalitiga bog'langan
  // (§5.8). Oyna ochilganda holatni qayta qo'llaymiz — SA yaqinda ochgan
  // bo'lsa darhol ko'rinsin, yopgan bo'lsa darhol yo'qolsin.
  try { if (typeof applySyncToolsLock === "function") applySyncToolsLock(); } catch(e) {}

  // Qarz to'lash endi faqat Qarzlar sahifasidan amalga oshiriladi —
  // sotuv chekining o'zi (sd-pay-block) bu yerda o'zgartirilmaydi.
  // Faqat shu sotuvda hali yopilmagan qarz bor-yo'qligini ko'rsatamiz.
  const payBlock = $("sd-pay-block");
  if (payBlock) {
    const hasOpenDebt = s.status !== "qaytarilgan" && typeof calcSaleState === "function"
      && calcSaleState(s).remaining > 0.5;
    payBlock.style.display = hasOpenDebt ? "block" : "none";
  }

  openModal("saledetail");
}

// ════════════════════════════════════════════════
// QAYTARISH TIZIMI
// ════════════════════════════════════════════════

let _refundSaleId = null;

function parseVariant(variantStr) {
  if (!variantStr) return { color: null, size: null, isBox: false };
  if (variantStr.includes("karobka")) {
    return { color: variantStr.split("(")[0].trim(), size: null, isBox: true };
  }
  if (variantStr.includes("/")) {
    const parts = variantStr.split("/").map(x => x.trim());
    return { color: parts[0], size: parts[1], isBox: false };
  }
  return { color: variantStr.trim(), size: null, isBox: false };
}

function returnItemToStock(item) {
  const prod = (db.products||[]).find(p => p.sku === item.sku) ||
               (db.products||[]).find(p => p.name === item.name);
  if (!prod) { console.warn("Mahsulot topilmadi:", item.name); return false; }

  const parsed = parseVariant(item.variant);
  const color  = item.color || parsed.color;
  const size   = item.size  || parsed.size;
  const sellMode = item.sellMode || (parsed.isBox ? "karobka" : (size ? "dona" : "karobka"));

  if (sellMode === "karobka") {
    // Pochka rejimi: har bir pochka = qaysi o'lchamlardan 1 tadan olingan bo'lsa,
    // o'sha aynan o'lchamlarga qaytariladi (qtyBox soni bilan, teng miqdorda).
    const boxesReturned = item.qtyBox || Math.round((item.qty||0) / (item.inBox||1)) || 0;
    if (boxesReturned <= 0) return false;

    // Qaysi o'lchamlarga qaytarish kerakligini aniqlaymiz:
    // 1) Agar item.groupSizes saqlangan bo'lsa — aynan o'sha o'lchamlar (eng ishonchli)
    // 2) Bo'lmasa — shu rangdagi BARCHA o'lchamlar (eski format, fallback)
    let targetSizes = item.groupSizes;
    if (!targetSizes || !targetSizes.length) {
      targetSizes = prod.variants.filter(v => v.color === color).map(v => v.size);
    }

    if (targetSizes.length > 0) {
      // B2 (v152): yagona-variant tovarda 1 pochka = inBox DONA qaytadi
      // (sotuvdagi v161 tuzatishining ko'zgu-jufti)
      const colorVars = prod.variants.filter(v => v.color === color);
      if (colorVars.length === 1) {
        // ⚠️ 2026-07-25: item.qty ALLAQACHON jami DONA (sotuvda totalDona
        // saqlanadi). Avval pochka soni × inBox qayta hisoblanardi va
        // inBox mos kelmasa qoldiq QO'SH hisoblanardi (2 pochka sotilsa
        // 4 pochka qaytardi). Endi to'g'ridan-to'g'ri dona qaytariladi.
        const donaBack = (item.qty > 0)
          ? item.qty
          : boxesReturned * (item.inBox || prod.inBox || 1);
        colorVars[0].qty += donaBack;
      } else {
        targetSizes.forEach(sz => {
          const v = prod.variants.find(x => x.color === color && x.size === sz);
          if (v) v.qty += boxesReturned;
          else prod.variants.push({ color: color||"Noma'lum", size: sz, qty: boxesReturned });
        });
      }
    } else if (prod.variants.length > 0) {
      // O'lcham umuman aniqlanmasa — birinchi variantga to'liq qaytaramiz (oxirgi chora)
      prod.variants[0].qty += item.qty;
    } else {
      prod.variants.push({ color: color||"Noma'lum", size: "", qty: item.qty });
    }
  } else {
    // Dona rejimi: aniq bitta o'lchamga qaytariladi
    const v = prod.variants.find(x =>
      x.color === color && (x.size === size || String(x.size) === String(size))
    );
    if (v) { v.qty += item.qty; }
    else    { prod.variants.push({ color: color||"Noma'lum", size: size||"", qty: item.qty }); }
  }
  return true;
}

function openRefundModal(saleId) {
  // 2026-08-02: amal darajasidagi ruxsat
  if (typeof requireDo === "function" && !requireDo("tarix","ret")) return;

  const id = saleId || _sdSaleId;
  const s  = db.sales.find(x => x.id === id);
  if (!s) return;
  if (s.status === "qaytarilgan") { toast("Bu sotuv allaqachon qaytarilgan","err"); return; }

  _refundSaleId = id;
  const el = $("refund-items"); if (!el) return;

  const safeItems = (s.items||[]).filter(Boolean);

  // 2026-07-25: allaqachon qaytarilgan miqdorni hisobga olamiz
  const already = {};
  (s.refunds || []).forEach(r =>
    (r.items || []).forEach(ri => {
      const k = (ri.name||"") + "|" + (ri.variant||"");
      already[k] = (already[k] || 0) + (ri.qty || 0);
    }));

  el.innerHTML = safeItems.map((item, i) => {
    const isBox = item.sellMode === "karobka" && item.inBox > 0;
    const unitLabel = isBox ? "pochka" : (item.unit || "dona");
    const soldRaw = isBox ? (item.qtyBox || Math.round(item.qty/item.inBox)) : item.qty;
    // Avval qaytarilgani ayiriladi — ikki marta qaytarib bo'lmasin
    const usedDona = already[(item.name||"") + "|" + (item.variant||"")] || 0;
    const usedRaw  = isBox ? Math.round(usedDona / (item.inBox||1)) : usedDona;
    const displayMax = Math.max(0, soldRaw - usedRaw);

    const cellCss = "width:70px;font-family:inherit;font-size:14px;font-weight:700;" +
      "text-align:center;border:1.5px solid var(--brd);border-radius:8px;padding:6px 8px";

    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--brd)">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px">${item.name||"?"}</div>
        <div style="font-size:12px;color:var(--mut)">${item.variant||""} · ${fmt(item.price||0)} so'm/dona</div>
        ${usedRaw > 0 ? `<div style="font-size:11px;color:var(--red)">Avval qaytarilgan: ${usedRaw} ${unitLabel}</div>` : ""}
      </div>
      <!-- Sotilgan: KATAK ko'rinishida, o'zgartirib bo'lmaydi -->
      <input type="text" value="${displayMax}" readonly tabindex="-1"
        title="Sotilgan (qaytarish mumkin) — o'zgartirib bo'lmaydi"
        style="${cellCss};background:var(--bg);color:var(--mut);cursor:not-allowed">
      <!-- Qaytariladigan: BO'SH, foydalanuvchi yozadi -->
      <input type="number" id="ref-qty-${i}" min="0" max="${displayMax}" value=""
        placeholder="0" inputmode="numeric"
        data-isbox="${isBox?1:0}" data-inbox="${item.inBox||1}" data-max="${displayMax}"
        oninput="refClampQty(this);updateRefundTotal()"
        style="${cellCss};border-color:var(--acc)">
      <div style="font-size:13px;font-weight:700;color:var(--red);min-width:90px;text-align:right"
        id="ref-sum-${i}">0 so'm</div>
    </div>`;
  }).join("");

  const infoEl = $("refund-sale-info");
  if (infoEl) infoEl.innerHTML = `${s.date||""} · ${s.customerName||"Noma'lum"} · ${fmt(s.total||0)} so'm`;

  updateRefundTotal();
  openModal("refund");
}

function updateRefundTotal() {
  const s = db.sales.find(x => x.id === _refundSaleId); if (!s) return;
  const safeItems = (s.items||[]).filter(Boolean);
  // ⚠️ 2026-08-08: OYNADAGI SUMMA HAM CHEGIRMA BILAN.
  // `confirmRefund` chegirmani hisobga oladi; bu yer esa eski
  // hisobda qolsa — oynada bir raqam, saqlanganda boshqasi
  // chiqardi. Ikkalasi bir manbadan hisoblanadi.
  const _eff = (typeof spreadSaleDiscount === "function")
    ? spreadSaleDiscount({ items: safeItems, discount: Number(s.discount || 0) })
    : safeItems.map(it => ({ ...it, effPrice: Number(it.price || 0) }));
  let total = 0;
  safeItems.forEach((item, i) => {
    const inp = $(`ref-qty-${i}`); if (!inp) return;
    const rawVal = parseInt(inp.value) || 0;
    const isBox  = inp.dataset.isbox === "1";
    const inBox  = parseInt(inp.dataset.inbox) || 1;
    const qtyDona = isBox ? rawVal * inBox : rawVal;
    const _p = Number((_eff[i] && _eff[i].effPrice) != null ? _eff[i].effPrice : (item.price || 0));
    const sum = qtyDona * _p;
    total += sum;
    const sumEl = $(`ref-sum-${i}`);
    if (sumEl) sumEl.textContent = fmt(sum) + " so'm";
  });
  const el = $("refund-total");
  if (el) el.textContent = fmt(total) + " so'm";
  // 2026-07-25: pul qanday qoplanishi darhol ko'rsatiladi
  try { updateRefundPayPlan(total); } catch(e) {}
}

async function confirmRefund() {
  const s = db.sales.find(x => x.id === _refundSaleId); if (!s) return;
  const reason     = $("refund-reason")?.value.trim() || "Sabab ko'rsatilmagan";
  const safeItems  = (s.items||[]).filter(Boolean);
  // ⚠️ 2026-08-08: QAYTARISH ENDI CHEGIRMANI HISOBGA OLADI.
  // Avval `qty * item.price` ishlatilardi — ya'ni CHEGIRMASIZ asl
  // narx. Umumiy chegirma esa alohida maydonda turadi va tovar
  // narxiga tegmaydi. Natijada chegirmali chek qaytarilganda do'kon
  // chegirma miqdoricha ORTIQCHA qaytarardi — jonli isbot:
  // CHK-20260807-3014-EG, mijoz 19 490 000 to'lagan, qaytarilgan
  // 20 280 000 (790 000 ortiqcha = aynan chegirma).
  // `spreadSaleDiscount` (utils.js) chegirmani foydaga mutanosib
  // tovarlarga yoyadi va HAQIQIY narxni beradi. Saqlangan
  // ma'lumotga tegilmaydi — hisob har safar qaytadan qilinadi.
  const _eff = (typeof spreadSaleDiscount === "function")
    ? spreadSaleDiscount({ items: safeItems, discount: Number(s.discount || 0) })
    : safeItems.map(it => ({ ...it, effPrice: Number(it.price || 0) }));
  const refundItems = [];
  let   refundTotal = 0;
  let   hasError    = false;

  safeItems.forEach((item, i) => {
    const inp = $(`ref-qty-${i}`); if (!inp) return;
    const rawVal = parseInt(inp.value) || 0;
    if (rawVal <= 0) return;
    const isBox  = inp.dataset.isbox === "1";
    const inBox  = parseInt(inp.dataset.inbox) || 1;
    const qty    = isBox ? rawVal * inBox : rawVal; // dona ko'rinishida
    const maxQty = item.qty || 0;

    if (qty > maxQty) {
      toast(`${item.name}: ${maxQty} ta sotilgan, ${qty} ta qaytara olmaysiz`,"err");
      hasError = true; return;
    }
    // Pochka rejimida qtyBox — foydalanuvchi to'g'ridan-to'g'ri pochka sonini kiritgan
    const adjustedQtyBox = isBox ? rawVal : item.qtyBox;
    refundItems.push({ ...item, qty, qtyBox: adjustedQtyBox });
    const _p = Number((_eff[i] && _eff[i].effPrice) != null ? _eff[i].effPrice : (item.price || 0));
    refundTotal += qty * _p;
  });

  if (hasError) return;
  if (!refundItems.length) { toast("Kamida 1 ta tovar tanlang","err"); return; }
  if (!confirm(`${fmt(refundTotal)} so'm qaytarilsinmi?\n${refundItems.length} ta tovar omborga qaytadi.`)) return;

  let returnedCount = 0;
  // ✅ 2026-08-14 (3-band): qaytarishda qoldiq SERVERDA ham oshadi
  // ⚠️ 2026-08-14: ikki marta qaytarish bo'lmasin (yuqoridagi izoh)
  let _srvRestock2 = false;
  if (typeof _serverRejimi === "function" && _serverRejimi()) {
    try {
      const _r = await _serverPay({
        action: "restock",
        items: refundItems.filter(Boolean).map(it => ({
          sku: it.sku, color: it.color || "", size: it.size || "",
          qty: Number(it.qty) || 0
        }))
      });
      _srvRestock2 = !!(_r && _r.ok);
    } catch (e) { console.warn("Serverda qoldiq qaytarilmadi:", e.message); }
  }
  if (_srvRestock2) { returnedCount = refundItems.length; }
  else { refundItems.forEach(item => { if (returnItemToStock(item)) returnedCount++; }); }

  // ═══ 2026-07-25: ASL CHEK HIMOYASI ═══
  // s.items va s.total ENDI O'ZGARTIRILMAYDI. Avval qisman qaytarishda
  // tovarlar chekdan olib tashlanardi va summa kamayardi — asl chek
  // qayta chiqarilganda BOSHQA chek chiqardi. Endi asl sotuv qanday
  // bo'lsa shunday qoladi, qaytarishlar alohida ro'yxatda yuritiladi.
  // ✅ 2026-08-12: TO'QNASHUVSIZ (avval bitta sotuvning qaytarishlar
  // soni edi — turli sotuvlarda bir xil raqam chiqardi).
  const _rdp = today().replace(/-/g,"").slice(2);
  const refundNo = "QT-" + _rdp + "-" +
    _nextDocSeq((db.returns || []), "refundNo", "QT", 2, _rdp) + "-" + _devCode();

  // 2026-07-25: CHEK HIMOYASI — sotuv paytidagi asl qarzni muhrlaymiz.
  // Bundan keyin remaining/status o'zgarsa ham chek asl holatni ko'rsatadi.
  if (s.origRemaining == null) s.origRemaining = Number(s.remaining || 0);
  if (s.origPaid      == null) s.origPaid      = Number(s.paid || 0);
  if (s.debtCurrency === "usd" && s.origDebtUsd == null)
    s.origDebtUsd = Number(s.debtUsd || 0);

  if (!s.refunds) s.refunds = [];
  s.refunds.push({
    no: refundNo, date: today(), time: nowTime(),
    total: refundTotal, reason,
    items: refundItems.map(r => ({
      // ✅ 2026-08-15: ART va RANG ham saqlanadi — chekdagi qaytarish
      // ro'yxatida tovarni aniq ko'rsatish uchun (egasining talabi).
      name: r.name, variant: r.variant, qty: r.qty,
      art: r.art || "", color: r.color || r.variant || "",
      size: r.size || "", unit: r.unit || "",
      qtyBox: r.qtyBox, price: r.price
    }))
  });
  s.refundedTotal = (s.refundedTotal || 0) + refundTotal;

  const isFullRefund = s.refundedTotal >= (s.total || 0);
  if (isFullRefund) {
    s.status = "qaytarilgan";
    s.refundDate = today();
    s.refundReason = reason;
    s.refundTotal = s.refundedTotal;
    s.remaining = 0;
  } else {
    s.refundDate = today();
    s.refundNote = `Qisman qaytarilgan: ${fmt(s.refundedTotal)} so'm · ${refundNo}`;
  }

  // ═══ 2026-07-25 (B): PULNI QOPLASH ═══
  // Tartib: shu sotuv qarzi → boshqa qarzlar → kassadan naqd.
  // Qarzdan qoplanganda QARZ TO'LOVI yozuvi ochiladi (source="refund"),
  // u kunlik tushumga KIRMAYDI — haqiqiy pul kelmagan.
  const plan = _refundPayPlan(s, refundTotal);

  // ⚠️ 2026-07-25: s.remaining O'ZGARTIRILMAYDI. Qarz qoldig'i
  // calcSaleState() orqali to'lovlardan hisoblanadi — qo'lda ham
  // kamaytirsak qarz IKKI MARTA kamayardi (oddiy qarz to'lovi ham
  // shu tamoyilda ishlaydi).
  const _stateOf = (x) => (typeof calcSaleState === "function")
    ? calcSaleState(x) : { remaining: x.remaining || 0, debtUsd: 0 };

  // Mijozning JAMI qarzi (chek va bot xabari uchun) — qarz valyutasida
  const _custTotals = (cid) => {
    let uzs = 0, usd = 0;
    (db.sales || []).forEach(x => {
      if (!cid || x.customerId !== cid || x.status === "qaytarilgan") return;
      const st = _stateOf(x);
      uzs += Math.max(0, st.remaining || 0);
      usd += Math.max(0, st.debtUsd  || 0);
    });
    return { uzs, usd };
  };

  if (plan.fromThisDebt > 0) {
    const t = _custTotals(s.customerId);
    _refundAddDebtPayment(s, plan.fromThisDebt, refundNo, t);
    if (!isFullRefund) {
      const after = _stateOf(s);
      if ((after.remaining || 0) <= 0) s.status = "tolandan";
    }
  }

  plan.otherSales.forEach(o => {
    const os = db.sales.find(x => x.id === o.id);
    if (!os) return;
    const t = _custTotals(os.customerId);
    _refundAddDebtPayment(os, o.amount, refundNo, t);
    const after = _stateOf(os);
    if ((after.remaining || 0) <= 0) os.status = "tolandan";
  });

  if (plan.fromCash > 0) {
    if (!db.xarajatlar) db.xarajatlar = [];
    db.xarajatlar.push({
      id: nextId(),
      date: today(),
      category: "Tovar qaytarish",
      amount: plan.fromCash,
      method: "naqd",
      recipient: s.customerName || "Mijoz",
      note: `Qaytarish ${refundNo} · chek ${s.chekNum || "#"+s.id}`,
      paidBy: (typeof _expDefaultWho === "function" ? _expDefaultWho() : ""),
      xarajatType: "kunlik",
      refundNo
    });
  }

  if (!db.returns) db.returns = [];
  db.returns.push({
    id: nextId(), date: today(), time: nowTime(),
    refundNo,                                  // qaytarish cheki raqami
    origSaleId: s.id, origChekNum: s.chekNum || "#"+s.id,
    items: refundItems, total: refundTotal, reason,
    customerName: s.customerName||"", customerId: s.customerId || null,
    staffId: s.staffId,
    isFull: isFullRefund
  });

  saveDB();
  closeModal("refund");
  closeModal("saledetail");
  // Filterni "Barchasi" ga qaytaramiz
  txStatus = "all";
  document.querySelectorAll(".tx-status-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.s === "all"));
  renderTarix();
  toast(isFullRefund
    ? `✅ To'liq qaytarildi: ${fmt(refundTotal)} so'm. ${returnedCount} ta tovar omborga qaytdi.`
    : `✅ Qisman qaytarildi: ${fmt(refundTotal)} so'm. ${returnedCount} ta tovar omborga qaytdi.`
  );

  // ⚠️ 2026-08-05: QAYTARISHDAN KEYIN CHEK QAYTA YUBORILADI.
  // Avval qaytarishda Telegram xabari UMUMAN yuborilmasdi — mijoz
  // qaytarganini bilardi-yu, yangilangan chekni ko'rmasdi.
  // ASL CHEK yuboriladi: unda qaytarish belgisi bor (bot chekiga
  // 2026-08-04 da qo'shilgan) va qoldiq summa yangilangan.
  // Mijozga ham, guruhga ham — boshqa cheklardagi kabi.
  // Xato bo'lsa qaytarish O'ZI buzilmaydi (try-catch).
  try {
    if (typeof sendTelegramReceipt === "function") {
      sendTelegramReceipt(s.customerId, s, s.customerPhone);
    }
  } catch (e) { console.warn("qaytarish cheki yuborilmadi:", e.message); }
}

// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function refundSale() { openRefundModal(_sdSaleId); }

// ── Chek va WhatsApp ──────────────────────────────
function printSaleDetail() {
  const s = db.sales.find(x => x.id === _sdSaleId); if (!s) return;
  if (typeof showReceiptModal === "function") { closeModal("saledetail"); showReceiptModal(s); }
}

// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function shareSaleWhatsApp() {
  const s = db.sales.find(x => x.id === _sdSaleId); if (!s) return;
  if (typeof shareWhatsApp === "function") { _lastSale = s; shareWhatsApp(); }
}

// ── Excel eksport ─────────────────────────────────
function exportTarixExcel() {
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("tarix","excel")) return;

  // ⚠️ 2026-08-02: EKRANDAGI RO'YXATDAN.
  // Avval bu yerda filtr QAYTA YOZILGAN edi va u ekrandagidan
  // orqada qolgandi: qidiruv faqat ism va tovar nomida ishlardi,
  // ekranda esa chek raqami, telefon, izoh ham qidirilardi.
  // Natijada Excel va ekran har xil natija berardi.
  // Endi manba bitta — render tayyorlagan yakuniy ro'yxat.
  const list = getExportList("tarix", (db.sales||[]).filter(s => s && !s.cancelled));

  const rows = [["Chek","Sana","Vaqt","Mahsulotlar","Mijoz","Telefon","To'lov turi","Narx turi","Jami","To'landi","Qolgan","Holat","Izoh"]];
  list.forEach(s => {
    rows.push([
      s.chekNum||`#${s.id}`, s.date||"", s.time||"",
      (s.items||[]).filter(Boolean).map(i=>`${i.name}×${i.qty}`).join(", ")||"",
      s.customerName||"", s.customerPhone||"",
      PAYTYPES[s.payType]||"", s.priceType==="ulgurji"?"Ulgurji":"Chakana",
      s.total||0, s.paid||0, calcSaleState(s).remaining||0,
      s.status==="qarz"?"Qarzda":s.status==="qaytarilgan"?"Qaytarilgan":"To'langan",
      s.note||""
    ]);
  });

  downloadCSV(rows, `merx_tarix_${today()}.csv`);
  toast("Sotuv tarixi yuklab olindi");
}

// ── Chek print fallback ───────────────────────────
// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function printReceipt(id) {
  const s = db.sales.find(x => x.id === id); if (!s) return;
  if (typeof showReceiptModal === "function") { showReceiptModal(s); return; }
  const shopName = db.shop?.name || "MERX";
  const staffObj = db.staff?.find(st => st.id === s.staffId);
  const botUser  = (db.settings?.telegramBotUsername || "").replace(/^@/,"");
  const botUrl   = db.settings?.telegramBotUrl || "";
  const receiptUrl = botUrl
    ? `${botUrl}?action=receipt&id=${encodeURIComponent(s.chekNum||("ID"+s.id))}`
    : "";
  const chekCfg2 = (typeof db !== "undefined" && db.settings?.chekConfig) || {};
  const html = buildReceiptHtml(s, {
    shopName, staffName: staffObj?.name || "—",
    botUsername: botUser, receiptUrl,
    // 2026-08-12: eski qiymat kuchga kirmaydi (styleV2 muhri — pos.js dagi izoh)
    type: "tarix",   // 2026-08-12: sozlama shu bo'lim bo'yicha olinsin
    // \U0001f534 2026-08-15: MUHRLANGAN uslub USTUVOR (\u00a73.5). Sotuv
    // paytida qaysi ko'rinishda chizilgan bo'lsa, tarixda ham SHUNDAY
    // chiqadi. Muhr yo'q (eski sotuvlar) — "unified", ya'ni ular
    // avvalgidek qoladi. Yangi tanlov faqat YANGI sotuvlarga ta'sir
    // qiladi (egasining talabi).
    // ⚠️ Muhr YO'Q bo'lsa — "unified". Eski sotuvlar aynan shu
    // ko'rinishda chizilgan edi, shuning uchun ular O'ZGARMAYDI.
    style: (s.chekStyle || "unified")
  });
  const w = window.open("","_blank","width=420,height=700");
  if (!w) { toast("Pop-up bloklangan","err"); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

// ── Qarz to'lovi qatori (tarix jadvalida) ─────────
// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
function renderDebtPaymentRow(p) {
  const allocSummary = (p.allocations||[]).map(a =>
    `<div style="font-size:11px">${a.saleDate} <span style="color:#aaa">qarzi</span> — ${fmtMoney(a.amount, a.currency)}${a.fullyPaid?` <span style="color:#059669">✓ yopildi</span>`:""}</div>`
  ).join("") || `<span style="color:#bbb;font-size:11px">—</span>`;

  return `<tr style="cursor:pointer;background:#F0F9FF" onclick="reprintDebtPayment(${p.id})">
    <td>
      <div style="font-family:monospace;font-size:11px;font-weight:700;color:#0E7490">${p.chekNum}</div>
      <div style="font-size:10px;color:#0E7490;margin-top:1px">💰 Qarz to'lovi</div>
    </td>
    <td style="font-size:12px">
      <div style="font-weight:600">${p.date||"—"}</div>
      <div style="color:#aaa">${p.time||""}</div>
    </td>
    <td>${allocSummary}</td>
    <td style="font-size:12.5px">
      <div style="font-weight:600">${p.customerName||"—"}</div>
      ${p.customerPhone ? `<div style="font-size:11px;color:#aaa">${p.customerPhone}</div>` : ""}
    </td>
    <td><span class="bg" style="font-size:11px">Qarz to'lovi</span></td>
    <td class="num" style="font-weight:700;font-size:13px;color:#0E7490">${fmtMoney(p.amount, p.currency)}</td>
    <td class="num" style="color:var(--grn);font-size:12.5px">${fmtMoney(p.amount, p.currency)}</td>
    <td class="num"><span style="color:#ccc">—</span></td>
    <td><span class="bg bg-g" style="font-size:11px">💰 To'lov qabul qilindi</span></td>
    <td onclick="event.stopPropagation()">
      <button class="btn btn-ghost btn-icon btn-sm" onclick="reprintDebtPayment(${p.id})" title="Chekni ko'rish">
        <i class="ti ti-printer"></i>
      </button>
    </td>
  </tr>`;
}

// ═══ QAYTARISH: MIQDOR NAZORATI (2026-07-25) ═══
// Sotilgandan ko'p yozib bo'lmaydi — kiritish paytida darhol cheklanadi.
function refClampQty(inp) {
  const max = parseInt(inp.dataset.max) || 0;
  let v = parseInt(inp.value);
  if (isNaN(v)) return;                 // bo'sh qoldirish mumkin
  if (v < 0) v = 0;
  if (v > max) {
    v = max;
    toast(`Ko'pi bilan ${max} ta qaytarish mumkin`, "err");
  }
  inp.value = v;
}

// "Barchasini qaytarish" — hamma kataklarni to'ldiradi (xato sotuv uchun)
function refFillAll() {
  const rows = document.querySelectorAll('#refund-items input[id^="ref-qty-"]');
  if (!rows.length) return;
  rows.forEach(inp => { inp.value = parseInt(inp.dataset.max) || 0; });
  updateRefundTotal();
  toast("Barcha tovarlar qaytarishga belgilandi");
}

// ═══════════════════════════════════════════════════════════════
// QAYTARISH PULI QANDAY QOPLANADI (2026-07-25, B bosqichi)
// Tartib: 1) shu sotuvdagi qarz  2) mijozning boshqa qarzlari
//         3) qolgani — kassadan naqd (xarajat sifatida yoziladi)
// ═══════════════════════════════════════════════════════════════
function _refundPayPlan(sale, total) {
  // 2026-07-25: qarz qoldig'i calcSaleState orqali olinadi (to'lovlarni
  // hisobga oladi). USD qarzda summa DOLLARGA aylantiriladi.
  const plan = { fromThisDebt: 0, fromOtherDebt: 0, fromCash: 0, otherSales: [] };
  let left = total;   // so'mda

  const _st = (x) => (typeof calcSaleState === "function")
    ? calcSaleState(x) : { remaining: x.remaining || 0, debtUsd: 0 };

  // 1) Shu sotuvdagi qarz
  const st = _st(sale);
  const thisDebt = Math.max(0, st.remaining || 0);
  plan.fromThisDebt = Math.min(thisDebt, left);
  left -= plan.fromThisDebt;

  // 2) Mijozning boshqa qarzlari (eng eski birinchi)
  if (left > 0 && sale.customerId) {
    const others = (db.sales || [])
      .filter(x => x.id !== sale.id && x.customerId === sale.customerId &&
                   x.status !== "qaytarilgan")
      .map(x => ({ sale: x, st: _st(x) }))
      .filter(o => (o.st.remaining || 0) > 0)
      .sort((a, b) => (a.sale.date || "").localeCompare(b.sale.date || ""));
    others.forEach(o => {
      if (left <= 0) return;
      const take = Math.min(o.st.remaining || 0, left);
      if (take > 0) {
        plan.otherSales.push({
          id: o.sale.id, chekNum: o.sale.chekNum || ("#" + o.sale.id), amount: take
        });
        plan.fromOtherDebt += take;
        left -= take;
      }
    });
  }

  // 3) Qolgani — kassadan
  plan.fromCash = Math.max(0, left);
  return plan;
}

// Rejani ekranda ko'rsatamiz
function updateRefundPayPlan(total) {
  const el = $("refund-pay-plan");
  if (!el) return;
  const s = db.sales.find(x => x.id === _refundSaleId);
  if (!s || !total) { el.innerHTML = `<span style="color:var(--mut)">Miqdorni kiriting</span>`; return; }

  const p = _refundPayPlan(s, total);
  // 2026-07-25: qarz dollarda yuritilsa — summalar so'm / $ ko'rinishida
  const _rate  = Number(s.rate) || Number(db.settings?.rate) || 12800;
  const _isUsd = s.debtCurrency === "usd";
  const M = v => _isUsd
    ? `${fmt(v)} so'm / $${(v / _rate).toFixed(2)}`
    : `${fmt(v)} so'm`;

  const rows = [];
  if (p.fromThisDebt > 0)
    rows.push(`<div style="display:flex;justify-content:space-between;gap:8px">
      <span>Shu sotuvdagi qarzdan</span><b style="text-align:right">${M(p.fromThisDebt)}</b></div>`);
  if (p.fromOtherDebt > 0)
    rows.push(`<div style="display:flex;justify-content:space-between;gap:8px">
      <span>Boshqa qarzlaridan <span style="color:var(--mut);font-size:11px">(${p.otherSales.map(o=>o.chekNum).join(", ")})</span></span>
      <b style="text-align:right">${M(p.fromOtherDebt)}</b></div>`);
  if (p.fromCash > 0)
    rows.push(`<div style="display:flex;justify-content:space-between;color:#B91C1C">
      <span>Kassadan naqd <span style="font-size:11px">(xarajat sifatida)</span></span>
      <b>${fmt(p.fromCash)} so'm</b></div>`);

  el.innerHTML = rows.join("") || `<span style="color:var(--mut)">—</span>`;
}

// Qaytarish hisobidan qarz to'lovi yozuvi (2026-07-25)
// source="refund" — bu HAQIQIY PUL EMAS, tovar qaytarish hisobidan.
// Shuning uchun kunlik tushum va kassa hisobiga KIRMAYDI.
function _refundAddDebtPayment(sale, amountUzs, refundNo, custTotals) {
  if (!amountUzs || amountUzs <= 0) return;
  if (!db.debtPayments) db.debtPayments = [];

  const rate = Number(sale.rate) || Number(db.settings?.rate) || 12800;

  // 2026-07-25: QARZ VALYUTASI. Sotuv qarzi dollarda yuritilsa —
  // qaytarilgan tovar qiymati ham DOLLARGA aylantiriladi va chek/xabar
  // dollarda chiqadi (mijoz va sotuvchi chalg'imasin).
  const isUsdDebt = sale.debtCurrency === "usd";
  const amount   = isUsdDebt ? +(amountUzs / rate).toFixed(2) : amountUzs;
  const currency = isUsdDebt ? "usd" : "uzs";

  const before = isUsdDebt ? (custTotals?.usd || 0) : (custTotals?.uzs || 0);
  const after  = Math.max(0, +(before - amount).toFixed(2));

  // ✅ 2026-08-12: TO'QNASHUVSIZ (avval ro'yxat uzunligi edi).
  const _qdp = today().replace(/-/g,"").slice(2);
  const chekNum = "QTQ-" + _qdp + "-" +
    _nextDocSeq((db.debtPayments || []), "chekNum", "QTQ", 3, _qdp) + "-" + _devCode();

  const payment = {
    id: nextId(),
    chekNum,
    date: today(),
    time: (typeof nowTime === "function" ? nowTime() : ""),
    customerId:   sale.customerId || null,
    customerName: sale.customerName || "",
    staffId:      sale.staffId || null,
    amount,                       // qarz valyutasida
    amountSom: amountUzs,         // statistika uchun so'mdagi qiymati
    currency,
    rate,
    method: "qaytarish",
    source: "refund",             // ⚠️ tushumga kirmaydi
    refundNo,
    debtBefore: before,
    debtAfter:  after,
    note: `Tovar qaytarish hisobidan (${refundNo})`,
    // ⚠️ 2026-07-25: allocation ICHIDA ham currency bo'lishi SHART —
    // calcSaleState qarzni shu maydondan aniqlaydi. U bo'lmasa USD
    // qarz umuman kamaymasdi (oddiy to'lov ham shu tuzilishda).
    allocations: [{
      saleId:   sale.id,
      saleDate: sale.date || "",
      chekNum:  sale.chekNum || ("#" + sale.id),
      partNum:  (typeof nextPartNum === "function") ? nextPartNum(sale.id) : 1,
      amount,
      currency,
      fullyPaid: after <= 0.005,
      remainingAfter: after
    }],
    leftover: 0
  };

  db.debtPayments.push(payment);

  // Mijozga Telegram orqali chek (oddiy qarz to'lovi kabi)
  try {
    const _cust = (db.customers || []).find(c => c.id === sale.customerId);
    if (typeof sendTelegramPayReceipt === "function" &&
        (typeof canUseBot !== "function" || canUseBot()) &&
        (sale.customerId || _cust?.phone)) {
      sendTelegramPayReceipt(sale.customerId || null, _cust?.phone || null, payment);
    }
  } catch(e) { console.warn("Qaytarish cheki botga yuborilmadi:", e.message); }
}


// ═══════════════════════════════════════════════════════════════
// SOTUVNI TO'LIQ BEKOR QILISH (2026-07-25)
// Xato kiritilgan sotuv uchun. Barcha summalar joyiga qaytadi:
//   • naqd/karta/o'tkazma — o'sha hisobdan chiqadi
//   • qarz — qarzdan ayriladi
//   • tovarlar — omborga qaytadi
// Sotuv O'CHIRILMAYDI, "cancelled" belgisi qo'yiladi (qarz to'lovi
// atkazi bilan bir xil tamoyil — audit izi qoladi).
// ═══════════════════════════════════════════════════════════════
// 2026-08-09 RUXSAT AUDITI: bekor tugmasi endi AMAL bilan BIR XIL
// shartda ko'rinadi (ruxsat + admin daraja). Avval faqat rol tekshirilardi:
// admin-xodimda tarix "ko'rish"da bo'lsa tugma KO'RINIB, bosilganda
// "ruxsat yo'q" derdi (ABU SAXIY 16941 jonli holati); tarix "ishlatish"
// berilgan xodim esa tugmani ko'rmasdi ham.
function _canCancelSaleBtn() {
  return typeof hasRole === "function" && hasRole("admin") &&
         (typeof permDo !== "function" || permDo("tarix", "cancel"));
}

async function openSaleCancel(saleId) {
  // 2026-08-02: amal darajasidagi ruxsat (4-bosqich)
  if (typeof requireDo === "function" && !requireDo("tarix","cancel")) return;

  if (typeof hasRole !== "function" || !hasRole("admin")) {
    toast("Bekor qilish faqat egasi/admin uchun", "err"); return;
  }
  const s = db.sales.find(x => x.id === saleId);
  if (!s) { toast("Sotuv topilmadi", "err"); return; }
  if (s.cancelled)  { toast("Bu sotuv allaqachon bekor qilingan", "err"); return; }
  if (s.status === "qaytarilgan") { toast("Bu sotuv qaytarilgan — bekor qilib bo'lmaydi", "err"); return; }

  // Bu sotuv bo'yicha qarz to'lovlari bo'lganmi
  const pays = (db.debtPayments || []).filter(p => !p.cancelled &&
    (p.allocations || []).some(a => a.saleId === saleId));
  if (pays.length) {
    toast(`Avval ${pays.length} ta qarz to'lovini atkaz qiling`, "err"); return;
  }

  const pb  = s.payBreakdown || {};
  const rem = Math.max(0, s.remaining || 0);
  const lines = [];
  if (pb.naqd)    lines.push(`Naqd:      ${fmt(pb.naqd)} so'm`);
  if (pb.karta)   lines.push(`Karta:     ${fmt(pb.karta)} so'm`);
  if (pb.otkazma) lines.push(`O'tkazma:  ${fmt(pb.otkazma)} so'm`);
  if (!lines.length && (s.paid || 0) > 0) lines.push(`To'landi:  ${fmt(s.paid)} so'm`);
  if (rem > 0) lines.push(`Qarz:      ${fmt(rem)} so'm`);

  const itemCnt = (s.items || []).filter(Boolean).length;

  if (!confirm(
    "SOTUVNI BEKOR QILISH\n\n" +
    `${s.chekNum || "#"+s.id} · ${s.date} ${s.time || ""}\n` +
    `${s.customerName || "Mijoz yo'q"}\n\n` +
    lines.join("\n") + "\n\n" +
    `${itemCnt} ta tovar omborga qaytadi.\n` +
    "Barcha summalar hisobdan chiqariladi.\n\nDavom etasizmi?"
  )) return;

  if (!confirm("TASDIQLANG\n\nBu amalni qaytarib bo'lmaydi.\nSotuv barcha hisobotlardan chiqariladi.")) return;

  // 1) Tovarlarni omborga qaytaramiz
  // ✅ 2026-08-14 (3-band): qoldiq SERVERDA ham qaytariladi (qulf bilan),
  // aks holda bulutdagi qoldiq bekor qilingan sotuvniki bo'lib qolardi.
  // ⚠️ 2026-08-14 TUZATISH: IKKI MARTA QAYTARISH bo'lardi — server
  // ham qaytarardi, kassa ham lokal qaytarardi (jonli: 49 → 2 sotildi →
  // bekor → 51 bo'lib qoldi). Endi: server qaytargan bo'lsa LOKAL
  // qaytarilmaydi (keyingi pull bulutdagi haqiqiy qiymatni keltiradi).
  let _srvRestock = false;
  if (typeof _serverRejimi === "function" && _serverRejimi()) {
    try {
      const _r = await _serverPay({
        action: "restock",
        items: (s.items || []).filter(Boolean).map(it => ({
          sku: it.sku, color: it.color || "", size: it.size || "",
          qty: Number(it.qty) || 0
        }))
      });
      _srvRestock = !!(_r && _r.ok);
    } catch (e) { console.warn("Serverda qoldiq qaytarilmadi:", e.message); }
  }
  if (!_srvRestock) {
    (s.items || []).filter(Boolean).forEach(item => {
      try { returnItemToStock(item); } catch(e) { console.warn("Ombor qaytarish:", e.message); }
    });
  }

  // 2) Sotuvni bekor qilingan deb belgilaymiz
  // ⚖️ AUDIT (2026-08-12): sotuv bekori izi
  try {
    auditLog("cancel", "sale", s.chekNum || s.id,
      (s.customerName || "Mijozsiz") + " · " + fmt(s.total || 0),
      { before: "faol", after: "bekor" });
  } catch (e) {}
  // ✅ 2026-08-14 (3-band): BEKOR QILISHNI SERVER YOZADI.
  // Sabab: sotuv serverda yozilgan, bekor qilish esa lokalda edi —
  // "bekor qilingan-qilinmagan" holati kassalar orasida vaqtincha
  // HAR XIL bo'lardi (Nuriddin voqeasining ildizi).
  if (typeof _serverRejimi === "function" && _serverRejimi()) {
    try {
      const _u = (typeof _authUser !== "undefined" && _authUser) ? _authUser : null;
      const _sr = await _serverPay({
        action: "cancel", tur: "sale", id: s.id,
        by: _u ? (_u.name || _u.role || "admin") : "admin",
        reason: (typeof _cancelReason !== "undefined" ? _cancelReason : "")
      });
      if (!_sr || !_sr.ok) {
        toast("Bekor qilinmadi: " + ((_sr && _sr.error) || "server javob bermadi"), "err");
        return;
      }
    } catch (e) {
      toast("Server bilan aloqa yo'q — bekor qilinmadi", "err");
      return;
    }
  }
  s.cancelled     = true;
  s.cancelledAt   = today();
  s.cancelledTime = (typeof nowTime === "function" ? nowTime() : "");
  s.remaining     = 0;          // qarz yo'qoladi
  s.status        = "bekor";

  saveDB();
  try { if (typeof flushCloudSync === "function") flushCloudSync(true); } catch(e) {}
  renderTarix();
  if (typeof renderKatalog === "function") renderKatalog();
  toast(`Sotuv bekor qilindi — ${itemCnt} ta tovar omborga qaytdi`, "info");
}
