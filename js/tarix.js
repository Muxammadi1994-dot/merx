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

function renderTarix() {
  const q = ($("tarix-q")||{value:""}).value.toLowerCase().trim();
  // Tozalash tugmasini ko'rsatish/yashirish
  const clrBtn = $("tarix-q-clr");
  if (clrBtn) clrBtn.style.display = q ? "block" : "none";

  let list = (db.sales || []).slice().sort((a,b) => ((a.date||"")+(a.time||"") < (b.date||"")+(b.time||"")) ? 1 : -1).filter(s => { // v154 (№13): aniq yangi-birinchi
    if (!s) return false;
    if (!txPeriodFilter(s)) return false;
    if (txStatus === "tolandan"    && s.status !== "tolandan")    return false;
    if (txStatus === "qarz"        && s.status !== "qarz")        return false;
    if (txStatus === "qaytarilgan" && s.status !== "qaytarilgan") return false;
    if (txStaffId !== "all" && String(s.staffId) !== String(txStaffId)) return false;
    if (!q) return true;
    return (
      (s.customerName||"").toLowerCase().includes(q) ||
      // 2026-07-20 (№4) ILDIZ: q'da raqam bo'lsagina telefonni tekshiramiz.
      // Aks holda ism (harflar) yozilganda q.replace(\D)="" bo'lib,
      // phone.includes("")=TRUE bo'lardi -> HAMMA sotuv "mos" chiqib,
      // ism bo'yicha filtr ishlamas edi (aloqasiz sotuvlar aralashardi).
      (/\d/.test(q) && (s.customerPhone||"").replace(/\D/g,"").includes(q.replace(/\D/g,""))) ||
      (s.chekNum||"").toLowerCase().includes(q) ||
      (s.note||"").toLowerCase().includes(q) ||
      String(s.id).includes(q) ||
      (s.items||[]).filter(Boolean).some(i =>
        (i.name||"").toLowerCase().includes(q) ||
        (i.art||"").toLowerCase().includes(q) ||
        (i.sku||"").toLowerCase().includes(q) ||
        (i.color||"").toLowerCase().includes(q)
      )
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

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-td">
      ${q || txPeriod !== "all" || txStatus !== "all" ? "Filtr bo'yicha sotuv topilmadi" : "Sotuv tarixi bo'sh"}
    </td></tr>`;
    return;
  }

  // Har bir qatorni alohida try/catch bilan render qilamiz
  let html = "";
  list.forEach(s => {
    try {
      const isDebt     = s.status === "qarz" && (s.remaining||0) > 0;
      const isReturned = s.status === "qaytarilgan";
      const chekN      = s.chekNum || `#${s.id}`;

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

      html += `<tr style="cursor:pointer;${isReturned?"opacity:.6;background:#FEF2F2":""}" onclick="openSaleDetail(${s.id})">
        <td>
          <div style="font-family:monospace;font-size:11px;font-weight:700;color:#0D1B2A">${chekN}</div>
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
          <span class="bg ${isReturned?"bg-r":isDebt?"bg-a":"bg-g"}" style="font-size:11px">
            ${isReturned ? "↩ Qaytarilgan" : isDebt ? "💳 Qarzda" : "✅ To'langan"}
          </span>
        </td>` : ""}
        <td onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="openSaleDetail(${s.id})" title="Ko'rish">
            <i class="ti ti-eye"></i>
          </button>
        </td>
      </tr>`;
    } catch(e) {
      console.warn("Sotuv render xatosi:", s.id, e.message);
    }
  });

  tbody.innerHTML = html || `<tr><td colspan="10" class="empty-td">Render xatosi — console ni tekshiring</td></tr>`;
}

// ── Sotuv detail modal ────────────────────────────
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
    $("sd-totals").innerHTML = `
      ${s.subtotal && s.subtotal !== s.total ? `
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#888;margin-bottom:4px">
          <span>Subtotal</span><span>${fmt(s.subtotal)} so'm</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#E05A5A;margin-bottom:4px">
          <span>Chegirma</span><span>−${fmt(disc)} so'm</span>
        </div>` : ""}
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
        const perBox = item.inBox || prod.inBox || 1;
        colorVars[0].qty += boxesReturned * perBox;
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
  const id = saleId || _sdSaleId;
  const s  = db.sales.find(x => x.id === id);
  if (!s) return;
  if (s.status === "qaytarilgan") { toast("Bu sotuv allaqachon qaytarilgan","err"); return; }

  _refundSaleId = id;
  const el = $("refund-items"); if (!el) return;

  const safeItems = (s.items||[]).filter(Boolean);
  el.innerHTML = safeItems.map((item, i) => {
    const isBox = item.sellMode === "karobka" && item.inBox > 0;
    const unitLabel = isBox ? "pochka" : (item.unit || "dona");
    const displayMax = isBox ? (item.qtyBox || Math.round(item.qty/item.inBox)) : item.qty;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--brd)">
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">${item.name||"?"}</div>
        <div style="font-size:12px;color:var(--mut)">${item.variant||""} · ${fmt(item.price||0)} so'm/dona</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:12px;color:var(--mut)">Sotilgan: ${displayMax} ${unitLabel}</span>
        <input type="number" id="ref-qty-${i}" min="0" max="${displayMax}"
          value="${displayMax}" data-isbox="${isBox?1:0}" data-inbox="${item.inBox||1}"
          style="width:64px;font-family:inherit;font-size:14px;font-weight:700;
            text-align:center;border:1.5px solid var(--brd);border-radius:8px;padding:5px 8px"
          oninput="updateRefundTotal()">
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--red);min-width:90px;text-align:right"
        id="ref-sum-${i}">${fmt((item.price||0)*(item.qty||0))} so'm</div>
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
  let total = 0;
  safeItems.forEach((item, i) => {
    const inp = $(`ref-qty-${i}`); if (!inp) return;
    const rawVal = parseInt(inp.value) || 0;
    const isBox  = inp.dataset.isbox === "1";
    const inBox  = parseInt(inp.dataset.inbox) || 1;
    const qtyDona = isBox ? rawVal * inBox : rawVal;
    const sum = qtyDona * (item.price||0);
    total += sum;
    const sumEl = $(`ref-sum-${i}`);
    if (sumEl) sumEl.textContent = fmt(sum) + " so'm";
  });
  const el = $("refund-total");
  if (el) el.textContent = fmt(total) + " so'm";
}

function confirmRefund() {
  const s = db.sales.find(x => x.id === _refundSaleId); if (!s) return;
  const reason     = $("refund-reason")?.value.trim() || "Sabab ko'rsatilmagan";
  const safeItems  = (s.items||[]).filter(Boolean);
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
    refundTotal += qty * (item.price||0);
  });

  if (hasError) return;
  if (!refundItems.length) { toast("Kamida 1 ta tovar tanlang","err"); return; }
  if (!confirm(`${fmt(refundTotal)} so'm qaytarilsinmi?\n${refundItems.length} ta tovar omborga qaytadi.`)) return;

  let returnedCount = 0;
  refundItems.forEach(item => { if (returnItemToStock(item)) returnedCount++; });

  const isFullRefund = refundTotal >= (s.total||0);
  if (isFullRefund) {
    s.status = "qaytarilgan"; s.refundDate = today(); s.refundReason = reason;
    s.refundTotal = refundTotal; s.remaining = 0;
  } else {
    s.total     -= refundTotal;
    s.paid       = Math.max(0, (s.paid||0) - refundTotal);
    s.remaining  = Math.max(0, (s.remaining||0) - Math.min(refundTotal, s.remaining||0));
    if (s.remaining <= 0) { s.remaining = 0; s.status = "tolandan"; }
    s.refundDate = today();
    s.refundNote = `Qisman qaytarish: ${fmt(refundTotal)} so'm`;
    s.items = safeItems.map(item => {
      const refItem = refundItems.find(r => r.name===item.name && r.variant===item.variant);
      if (!refItem) return item;
      const newQty = (item.qty||0) - refItem.qty;
      if (newQty <= 0) return null;
      const newQtyBox = item.qtyBox != null ? (item.qtyBox - (refItem.qtyBox||0)) : null;
      return { ...item, qty: newQty, qtyBox: newQtyBox };
    }).filter(Boolean);
  }

  if (!db.returns) db.returns = [];
  db.returns.push({
    id: db.seq++, date: today(), time: nowTime(),
    origSaleId: s.id, origChekNum: s.chekNum || "#"+s.id,
    items: refundItems, total: refundTotal, reason,
    customerName: s.customerName||"", staffId: s.staffId
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
  const q    = ($("tarix-q")||{value:""}).value.toLowerCase();
  const list = (db.sales||[]).slice().sort((a,b) => ((a.date||"")+(a.time||"") < (b.date||"")+(b.time||"")) ? 1 : -1).filter(s => { // v154 (№13)
    if (!s) return false;
    if (!txPeriodFilter(s)) return false;
    if (txStatus === "tolandan"    && s.status !== "tolandan")    return false;
    if (txStatus === "qarz"        && s.status !== "qarz")        return false;
    if (txStatus === "qaytarilgan" && s.status !== "qaytarilgan") return false;
    if (!q) return true;
    return (s.customerName||"").toLowerCase().includes(q) ||
           (s.items||[]).filter(Boolean).some(i=>(i.name||"").toLowerCase().includes(q));
  });

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
    style: chekCfg2.tarixStyle || "merx"
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
