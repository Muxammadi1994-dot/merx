// MERX tarix.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/tarix.js  (v2 — To'liq sotuv tarixi)
// ================================================


let txPeriod  = "all";
let txStatus  = "all";
let _sdSaleId = null;

function setTxPeriod(p) {
  txPeriod = p;
  document.querySelectorAll(".tx-period-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.p === p));
  renderTarix();
}

function setTxStatus(s) {
  txStatus = s;
  document.querySelectorAll(".tx-status-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.s === s));
  renderTarix();
}

// ── Davr filtri ───────────────────────────────────
function txPeriodFilter(s) {
  const d = s.date || "";
  if (txPeriod === "today") return d === today();
  if (txPeriod === "week")  return d >= addDays(today(), -7);
  if (txPeriod === "month") return d.startsWith(today().slice(0, 7));
  return true;
}

// ── Render ────────────────────────────────────────
function renderTarix() {
  const q = ($("tarix-q")||{value:""}).value.toLowerCase();

  let list = db.sales.slice().reverse().filter(s => {
    if (!txPeriodFilter(s)) return false;
    if (txStatus !== "all" && s.status !== txStatus) return false;
    if (!q) return true;
    return (s.customerName||"").toLowerCase().includes(q) ||
           s.items?.some(i => i.name.toLowerCase().includes(q)) ||
           (s.chekNum||"").toLowerCase().includes(q) ||
           (s.note||"").toLowerCase().includes(q);
  });

  // KPI
  const total = list.reduce((a, s) => a + (s.total||0), 0);
  const paid  = list.reduce((a, s) => a + (s.paid ||0), 0);
  const rem   = list.reduce((a, s) => a + (s.remaining||0), 0);
  if ($("tx-cnt"))   $("tx-cnt").textContent   = list.length + " ta";
  if ($("tx-total")) $("tx-total").textContent = fmt(total) + " so'm";
  if ($("tx-paid"))  $("tx-paid").textContent  = fmt(paid)  + " so'm";
  if ($("tx-rem"))   $("tx-rem").textContent   = fmt(rem)   + " so'm";

  $("tarix-body").innerHTML = list.length ? list.map(s => {
    const isDebt = s.status === "qarz" && s.remaining > 0;
    const chekN  = s.chekNum || `#${s.id}`;
    const items  = s.items?.map(i =>
      `<div style="font-size:12px">${i.name} <span style="color:#bbb">×${i.qty} ${i.unit||""}</span></div>`
    ).join("") || "—";

    const debtCell = isDebt
      ? `<span style="color:var(--red);font-weight:700">${
          s.debtCurrency==="usd" && s.debtUsd
            ? `$${(+s.debtUsd).toFixed(2)}`
            : fmt(s.remaining)+" so'm"
        }</span>`
      : `<span style="color:var(--grn);font-size:11px">—</span>`;

    return `<tr style="cursor:pointer" onclick="openSaleDetail(${s.id})">
      <td>
        <div style="font-family:monospace;font-size:11px;font-weight:700;color:#0D1B2A">${chekN}</div>
        ${s.note ? `<div style="font-size:10px;color:#856404;margin-top:1px">📝 ${s.note}</div>` : ""}
      </td>
      <td style="font-size:12px">
        <div style="font-weight:600">${s.date||"—"}</div>
        <div style="color:#aaa">${s.time||""}</div>
      </td>
      <td>${items}</td>
      <td style="font-size:12.5px">
        <div style="font-weight:600">${s.customerName||"—"}</div>
        ${s.customerPhone ? `<div style="font-size:11px;color:#aaa">${s.customerPhone}</div>` : ""}
      </td>
      <td>
        <span class="bg" style="font-size:11px">${PAYTYPES[s.payType]||"—"}</span>
        <div style="margin-top:3px">
          <span class="bg ${s.priceType==="ulgurji"?"bg-a":""}" style="font-size:10.5px">
            ${s.priceType==="ulgurji"?"📦 Ulgurji":"👤 Chakana"}
          </span>
        </div>
      </td>
      <td class="num" style="font-weight:700;font-size:13px">${fmt(s.total)} so'm</td>
      <td class="num" style="color:var(--grn);font-size:12.5px">${fmt(s.paid)} so'm</td>
      <td class="num">${debtCell}</td>
      <td>
        <span class="bg ${isDebt?"bg-a":"bg-g"}" style="font-size:11px">
          ${isDebt ? "💳 Qarzda" : "✅ To'langan"}
        </span>
      </td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openSaleDetail(${s.id})" title="Ko'rish">
          <i class="ti ti-eye"></i>
        </button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="10" class="empty-td">
    ${q || txPeriod !== "all" || txStatus !== "all" ? "Filtr bo'yicha sotuv topilmadi" : "Sotuv tarixi bo'sh"}
  </td></tr>`;
}

// ── Sotuv detail modal ────────────────────────────
function openSaleDetail(id) {
  const s = db.sales.find(x => x.id === id); if (!s) return;
  _sdSaleId = id;

  if ($("sd-cheknum")) $("sd-cheknum").textContent = s.chekNum || `#${s.id}`;
  if ($("sd-dt"))      $("sd-dt").textContent      = `${s.date||""} ${s.time||""}`;

  // Mahsulotlar
  if ($("sd-items")) {
    $("sd-items").innerHTML = `
      <div style="font-size:10px;color:#aaa;font-weight:700;text-transform:uppercase;margin-bottom:8px">Mahsulotlar</div>
      ${s.items?.map(i => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--brd)">
          <div>
            <div style="font-weight:600;font-size:13px">${i.name}</div>
            <div style="font-size:11.5px;color:#aaa">${i.variant||""} · ${i.qty} ${i.unit||"dona"}</div>
          </div>
          <div style="font-weight:700;font-size:13px">${fmt(i.price*i.qty)} so'm</div>
        </div>`
      ).join("") || "<div style='color:#ccc'>—</div>"}`;
  }

  // Totals
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
        <span style="font-weight:900;font-size:18px">${fmt(s.total)} so'm</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--grn);margin-top:5px">
        <span>To'landi</span><span>${fmt(s.paid)} so'm</span>
      </div>
      ${s.remaining > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--red);margin-top:3px;font-weight:600">
          <span>Qolgan qarz</span>
          <span>${s.debtCurrency==="usd"&&s.debtUsd ? `$${(+s.debtUsd).toFixed(2)} USD` : fmt(s.remaining)+" so'm"}</span>
        </div>
        ${s.due ? `<div style="font-size:12px;color:#D97706;margin-top:2px;text-align:right">Muddat: ${s.due}</div>` : ""}
      ` : ""}`;
  }

  // Info
  if ($("sd-info")) {
    const staff = db.staff.find(x => x.id === s.staffId);
    $("sd-info").innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12.5px">
        <div><span style="color:#aaa">Mijoz: </span><strong>${s.customerName||"—"}</strong></div>
        <div><span style="color:#aaa">Tel: </span><strong>${s.customerPhone||"—"}</strong></div>
        <div><span style="color:#aaa">To'lov: </span><strong>${PAYTYPES[s.payType]||"—"}</strong></div>
        <div><span style="color:#aaa">Narx turi: </span><strong>${s.priceType==="ulgurji"?"Ulgurji":"Chakana"}</strong></div>
        <div><span style="color:#aaa">Kassir: </span><strong>${staff?.name||"—"}</strong></div>
        <div><span style="color:#aaa">Holat: </span><strong>${s.status==="qarz"?"Qarzda":"To'langan"}</strong></div>
      </div>`;
  }

  // Izoh
  const noteWrap = $("sd-note-wrap");
  if (noteWrap) {
    if (s.note) {
      noteWrap.style.display = "block";
      if ($("sd-note")) $("sd-note").textContent = s.note;
    } else {
      noteWrap.style.display = "none";
    }
  }

  // WhatsApp tugmasi
  const waBtn = $("sd-wa-btn");
  if (waBtn) waBtn.style.display = s.customerPhone ? "inline-flex" : "none";

  // Qaytarish tugmasi
  const refBtn = $("sd-refund-btn");
  if (refBtn) refBtn.style.display = s.status !== "qaytarilgan" ? "inline-flex" : "none";

  openModal("saledetail");
}

// ── Chek print ────────────────────────────────────
function printSaleDetail() {
  const s = db.sales.find(x => x.id === _sdSaleId); if (!s) return;
  if (typeof showReceiptModal === "function") {
    closeModal("saledetail");
    showReceiptModal(s);
  } else {
    printReceipt(_sdSaleId);
  }
}

// ── WhatsApp ulashish ─────────────────────────────
function shareSaleWhatsApp() {
  const s = db.sales.find(x => x.id === _sdSaleId); if (!s) return;
  if (typeof shareWhatsApp === "function") {
    _lastSale = s;
    shareWhatsApp();
  }
}

// ── Qaytarish ─────────────────────────────────────
function refundSale() {
  const s = db.sales.find(x => x.id === _sdSaleId); if (!s) return;
  if (!confirm(`#${s.id} sotuvni qaytarish? Ombor qoldig'i tiklanadi.`)) return;

  // Ombor qoldig'ini tiklash
  s.items?.forEach(item => {
    const p = db.products.find(x => x.name === item.name);
    if (!p) return;
    if (item.variant && item.variant.includes("/")) {
      const [color, size] = item.variant.split("/").map(x => x.trim());
      const v = p.variants.find(x => x.color===color && x.size===size);
      if (v) v.qty += item.qty;
    } else {
      const color = item.variant?.split("(")[0]?.trim();
      if (color) {
        const v = p.variants.find(x => x.color===color);
        if (v) v.qty += item.qty;
      }
    }
  });

  s.status = "qaytarilgan";
  s.remaining = 0;
  saveDB();
  renderTarix();
  closeModal("saledetail");
  toast(`✅ Sotuv qaytarildi. Ombor tiklandi.`);
}

// ── Excel eksport ─────────────────────────────────
function exportTarixExcel() {
  const q = ($("tarix-q")||{value:""}).value.toLowerCase();
  const list = db.sales.slice().reverse().filter(s => {
    if (!txPeriodFilter(s)) return false;
    if (txStatus !== "all" && s.status !== txStatus) return false;
    if (!q) return true;
    return (s.customerName||"").toLowerCase().includes(q) ||
           s.items?.some(i => i.name.toLowerCase().includes(q));
  });

  const rows = [["Chek","Sana","Vaqt","Mahsulotlar","Mijoz","Telefon","To'lov turi","Narx turi","Jami","To'landi","Qolgan","Holat","Izoh"]];
  list.forEach(s => {
    rows.push([
      s.chekNum||`#${s.id}`, s.date||"", s.time||"",
      s.items?.map(i=>`${i.name}×${i.qty}`).join(", ")||"",
      s.customerName||"", s.customerPhone||"",
      PAYTYPES[s.payType]||"", s.priceType==="ulgurji"?"Ulgurji":"Chakana",
      s.total||0, s.paid||0, s.remaining||0,
      s.status==="qarz"?"Qarzda":s.status==="qaytarilgan"?"Qaytarilgan":"To'langan",
      s.note||""
    ]);
  });

  downloadCSV(rows, `merx_tarix_${today()}.csv`);
  toast("Sotuv tarixi yuklab olindi");
}

// Eski printReceipt uchun moslik
function printReceipt(id) {
  const s = db.sales.find(x => x.id === id); if (!s) return;
  if (typeof showReceiptModal === "function") { showReceiptModal(s); return; }
  // Fallback: eski print
  const w = window.open("","_blank","width=420,height=640");
  if (!w) { toast("Pop-up bloklangan","err"); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Chek</title>
  <style>body{font-family:monospace;font-size:13px;padding:16px;max-width:300px;margin:0 auto}hr{border:none;border-top:1px dashed #ccc;margin:8px 0}.row{display:flex;justify-content:space-between;margin:3px 0}@media print{body{padding:4px}}</style></head><body>
  <div style="text-align:center;font-size:16px;font-weight:700">${db.shop?.name||"MERX"}</div><hr>
  <div class="row"><span>${s.chekNum||"#"+s.id}</span><span>${s.date} ${s.time||""}</span></div><hr>
  ${s.items?.map(i=>`<div>${i.name} ×${i.qty} ${i.unit||""} = ${fmt(i.price*i.qty)} so'm</div>`).join("")||""}
  <hr><div class="row" style="font-weight:700"><span>JAMI</span><span>${fmt(s.total)} so'm</span></div>
  <div class="row"><span>To'landi</span><span>${fmt(s.paid)} so'm</span></div>
  ${s.remaining>0?`<div class="row"><span>Qarz</span><span>${fmt(s.remaining)} so'm</span></div>`:""}
  <hr><div style="text-align:center;font-size:11px">Rahmat!</div>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
