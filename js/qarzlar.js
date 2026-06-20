// MERX qarzlar.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/qarzlar.js  (v3 — To'liq qarz tizimi)
// ================================================

let debtFilter  = "all";   // "all" | "overdue" | "usd" | "month"
let debtGrouped = false;   // mijoz bo'yicha guruhlash

function setDebtFilter(f) {
  debtFilter = f;
  document.querySelectorAll(".debt-filter-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.f === f));
  renderDebts();
}

function toggleDebtGroup() {
  debtGrouped = !debtGrouped;
  const btn = $("debt-group-btn");
  if (btn) {
    btn.style.background = debtGrouped ? "#0D1B2A" : "";
    btn.style.color      = debtGrouped ? "#fff"    : "";
  }
  renderDebts();
}

// Yordamchi funksiyalar
function debtCust(s) {
  const c = s.customerId ? db.customers.find(x => x.id === s.customerId) : null;
  return {
    name:  c ? c.name  : (s.customerName  || "—"),
    phone: c ? c.phone : (s.customerPhone || "—")
  };
}

function debtRemDisplay(s) {
  if (s.debtCurrency === "usd" && s.debtUsd != null) {
    return `<span style="font-weight:800;color:#1B4F72;font-size:14px">$${(+s.debtUsd).toFixed(2)}</span>
            <span style="font-size:10px;color:#aaa;display:block">USD</span>`;
  }
  return `<span style="font-weight:800;color:var(--red);font-size:14px">${fmt(s.remaining)}</span>
          <span style="font-size:10px;color:#aaa;display:block">so'm</span>`;
}

// ── Render ────────────────────────────────────────
function renderDebts() {
  syncSaleStatesFromPayments();
  const q    = ($("debt-q")||{value:""}).value.toLowerCase();
  const rate = db.settings.rate || 12800;
  const thisMonth = today().slice(0, 7);

  let list = debtSales();

  // Filtr
  if (debtFilter === "overdue") list = list.filter(isOverdue);
  if (debtFilter === "usd")     list = list.filter(s => s.debtCurrency === "usd");
  if (debtFilter === "month")   list = list.filter(s => s.date?.startsWith(thisMonth));

  // Qidiruv
  if (q) list = list.filter(s => {
    const cu = debtCust(s);
    return (cu.name||"").toLowerCase().includes(q) ||
           (cu.phone||"").includes(q) ||
           s.items?.some(i => i.name.toLowerCase().includes(q));
  });

  // Muddati o'tganlar tepaga
  list.sort((a, b) => {
    if (isOverdue(a) && !isOverdue(b)) return -1;
    if (!isOverdue(a) && isOverdue(b))  return 1;
    return (a.due||"") < (b.due||"") ? -1 : 1;
  });

  // KPI
  const allDebt    = debtSales();
  const totalUzs   = allDebt.reduce((a, s) => a + s.remaining, 0);
  const totalUsd   = allDebt.filter(s => s.debtCurrency === "usd" && s.debtUsd)
                            .reduce((a, s) => a + s.debtUsd, 0);
  const overCount  = allDebt.filter(isOverdue).length;
  // Qarz to'lovlari: status "qarz" bo'lgan yoki "tolandan" lekin originally qarz edi
  const debtPaid = db.sales
    .filter(s => s.remaining === 0 && s.paid < s.total && (s.total - s.paid) === 0)
    .reduce((a, s) => a + 0, 0);
  // Oddiy hisob: bu oy qilingan sotuvlardagi paid (nasiya + to'liq)
  const collected = db.sales
    .filter(s => s.date?.startsWith(thisMonth))
    .reduce((a, s) => a + (s.paid || 0), 0);
  const custCount  = new Set(allDebt.map(s => debtCust(s).name)).size;

  $("st-total").textContent     = fmt(totalUzs) + " so'm";
  if ($("st-total-usd")) $("st-total-usd").textContent = totalUsd > 0 ? `$${totalUsd.toFixed(2)}` : "$0";
  $("st-over").textContent      = overCount + " ta";
  $("st-cnt").textContent       = custCount + " kishi";
  $("st-month").textContent     = fmt(collected) + " so'm";
  $("debt-count").textContent   = allDebt.length;

  if (debtGrouped) {
    renderDebtsGrouped(list, rate);
  } else {
    renderDebtsList(list, rate);
  }
  renderDebtCustCards();
  renderDebtPaymentsHistory();
}

// ── Mijoz umumiy qarz kartalar paneli ─────────────
let _debtCustFilter = null; // null = hammasi

function renderDebtCustCards() {
  const el = $("debt-cust-cards"); if (!el) return;
  const allDebt = debtSales();

  // Mijoz bo'yicha guruhlash
  const groups = {};
  allDebt.forEach(s => {
    const cu  = debtCust(s);
    const key = cu.name;
    if (!groups[key]) groups[key] = {
      name: cu.name, phone: cu.phone,
      totalUzs: 0, totalUsd: 0, cnt: 0, anyOverdue: false
    };
    groups[key].totalUzs += (s.debtCurrency !== "usd") ? s.remaining : 0;
    groups[key].totalUsd += (s.debtCurrency === "usd" && s.debtUsd) ? s.debtUsd : 0;
    groups[key].cnt++;
    if (isOverdue(s)) groups[key].anyOverdue = true;
  });

  const gList = Object.values(groups).sort((a, b) => {
    if (a.anyOverdue && !b.anyOverdue) return -1;
    if (!a.anyOverdue && b.anyOverdue)  return 1;
    return (b.totalUzs + b.totalUsd*(db.settings?.rate||12800)) -
           (a.totalUzs + a.totalUsd*(db.settings?.rate||12800));
  });

  if (!gList.length) { el.style.display = "none"; return; }
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.gap = "10px";

  // Dropdown select — istalgancha mijoz sig'adi
  const selVal = _debtCustFilter || "";
  const opts = gList.map(g => {
    const overMark = g.anyOverdue ? "⚠️ " : "";
    const amtTxt   = g.totalUsd > 0 && g.totalUzs > 0
      ? `$${g.totalUsd.toFixed(2)} + ${fmtK(g.totalUzs)} so'm`
      : g.totalUsd > 0 ? `$${g.totalUsd.toFixed(2)}`
      : fmtK(g.totalUzs) + " so'm";
    return `<option value="${g.name.replace(/"/g,"&quot;")}" ${selVal===g.name?"selected":""}>
      ${overMark}${g.name} — ${amtTxt} (${g.cnt} ta)
    </option>`;
  }).join("");

  el.innerHTML = `
    <span style="font-size:12px;color:var(--mut);white-space:nowrap;font-weight:600">Mijoz:</span>
    <select onchange="debtCustFilter(this.value||null)"
      style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);
      padding:6px 10px;background:#fff;min-width:220px;max-width:340px">
      <option value="">— Barchasi (${allDebt.length} ta sotuv) —</option>
      ${opts}
    </select>
    ${_debtCustFilter ? `
      <div style="padding:6px 12px;background:#fffbf0;border:1.5px solid #c8a84b;border-radius:var(--rs);font-size:12.5px;font-weight:600">
        ${(() => {
          const g = gList.find(x => x.name === _debtCustFilter);
          if (!g) return "";
          const amtTxt = g.totalUsd > 0 && g.totalUzs > 0
            ? `$${g.totalUsd.toFixed(2)} + ${fmtK(g.totalUzs)} so'm`
            : g.totalUsd > 0 ? `$${g.totalUsd.toFixed(2)} USD`
            : fmtK(g.totalUzs) + " so'm";
          return `<span style="color:var(--mut)">Jami qarz:</span> <span style="color:var(--acc)">${amtTxt}</span>
                  <span style="color:var(--mut);margin-left:6px">${g.cnt} ta sotuv</span>`;
        })()}
      </div>
      <button onclick="debtCustFilter(null)" class="btn btn-ghost btn-sm btn-icon" title="Filtrni tozalash">
        <i class="ti ti-x"></i>
      </button>` : ""}`;
}

function debtCustFilter(name) {
  _debtCustFilter = name;
  const qEl = $("debt-q");
  if (qEl) qEl.value = name || "";
  renderDebts();
}

// ── Tanlangan mijozning to'lovlar tarixi ──────────
function renderDebtPaymentsHistory() {
  const el = $("debt-payments-history"); if (!el) return;

  if (!_debtCustFilter) { el.style.display = "none"; el.innerHTML = ""; return; }

  const payments = (db.debtPayments || [])
    .filter(p => p.customerName === _debtCustFilter)
    .sort((a, b) => (a.date+a.time < b.date+b.time) ? 1 : -1);

  if (!payments.length) { el.style.display = "none"; el.innerHTML = ""; return; }

  el.style.display = "block";
  el.style.padding = "12px 18px";
  el.style.borderBottom = "1px solid var(--brd)";
  el.style.background = "#fafaf8";

  el.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
      <i class="ti ti-receipt"></i> ${_debtCustFilter} — to'lovlar tarixi (${payments.length} ta)
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${payments.map(p => {
        const allocSummary = (p.allocations||[]).map(a =>
          `${a.saleDate}: ${fmtMoney(a.amount, a.currency)}${a.fullyPaid?" (yopildi)":""}`
        ).join(", ") || "—";
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid var(--brd);border-radius:var(--rs);padding:8px 12px">
          <div style="min-width:0;flex:1">
            <div style="font-size:12.5px;font-weight:700;color:#0D1B2A">
              ${p.chekNum} <span style="color:#aaa;font-weight:400">· ${p.date} ${p.time||""}</span>
            </div>
            <div style="font-size:11px;color:#888;margin-top:2px">${allocSummary}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-left:12px">
            <div style="font-weight:800;color:#0D1B2A;font-size:13.5px;white-space:nowrap">${fmtMoney(p.amount, p.currency)}</div>
            <button class="btn btn-sm" onclick="reprintDebtPayment(${p.id})" title="Chekni ko'rish">
              <i class="ti ti-printer"></i>
            </button>
          </div>
        </div>`;
      }).join("")}
    </div>`;
}

// ── Sotuv bo'yicha ro'yxat ────────────────────────
function renderDebtsList(list, rate) {
  const thead = $("debt-head");
  const tbody = $("debt-body");
  if (thead) thead.innerHTML = `<tr>
    <th>Mijoz</th><th>Telefon</th><th>Mahsulotlar</th>
    <th class="num">To'langan</th>
    <th class="num">Qolgan qarz</th>
    <th>Muddat</th><th>Holat</th>
    <th>To'lov</th>
  </tr>`;

  if (!tbody) return;
  tbody.innerHTML = list.length ? list.map(s => {
    const cu    = debtCust(s);
    const over  = isOverdue(s);
    const isUsd = s.debtCurrency === "usd" && s.debtUsd != null;
    return `<tr class="${over?"debt-row-overdue":""}">
      <td>
        <div style="font-weight:600;font-size:13px">${cu.name||"—"}</div>
        <div style="font-size:10.5px;color:#aaa">${s.date||""}</div>
      </td>
      <td style="font-size:12.5px">
        ${cu.phone && cu.phone !== "—"
          ? `<a href="tel:${cu.phone}" style="color:inherit;text-decoration:none">${cu.phone}</a>` : "—"}
      </td>
      <td style="font-size:12px;max-width:160px">
        ${s.items?.map(i => `<div>${i.name} <span style="color:#aaa">×${i.qty}</span></div>`).join("") || "—"}
      </td>
      <td class="num" style="font-size:12.5px;color:var(--grn)">${fmt(s.paid)} so'm</td>
      <td class="num">${debtRemDisplay(s)}</td>
      <td>
        <span class="bg ${over?"bg-r":"bg-a"}" style="font-size:11.5px">
          ${s.due||"—"}
        </span>
      </td>
      <td>
        <span class="bg ${over?"bg-r":"bg-g"}" style="font-size:11px">
          ${over?"⚠️ Muddati o'tgan":"⏳ Kutilmoqda"}
        </span>
      </td>
      <td>
        <div style="display:flex;flex-direction:column;gap:5px;min-width:180px">
          <div style="display:flex;gap:5px">
            <input type="number" id="pay-${s.id}"
              placeholder="${isUsd?"$ summa":"so'm"}"
              step="${isUsd?"0.01":"10000"}"
              style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:8px;padding:5px 8px;width:90px;flex:1;outline:none">
            <select id="pay-method-${s.id}"
              style="font-family:inherit;font-size:12px;border:1.5px solid var(--brd);border-radius:8px;padding:5px 4px;width:78px">
              <option value="naqd">💵 Naqd</option>
              <option value="karta">💳 Karta</option>
              <option value="otkazma">🏦 O'tkazma</option>
            </select>
            <button class="btn btn-teal btn-sm" onclick="recordPayment(${s.id})">To'lov</button>
          </div>
          ${(() => {
            const others = findCustomerDebts(s).filter(x => x.id !== s.id);
            return others.length
              ? `<div style="font-size:10.5px;color:#aaa">+ ${others.length} ta boshqa qarz — avtomatik taqsimlanadi</div>`
              : "";
          })()}
          ${cu.phone && cu.phone !== "—"
            ? `<button class="btn btn-sm" onclick="sendDebtReminder(${s.id})" style="font-size:11px;color:#856404">
                <i class="ti ti-message"></i> SMS eslatma
               </button>`
            : ""}
        </div>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="8" class="empty-td">
    ${debtFilter !== "all" ? "Bu filtrda qarz yo'q" : "Qarz yo'q 🎉"}
  </td></tr>`;
}

// ── Mijoz bo'yicha guruhlangan ko'rinish ──────────
function renderDebtsGrouped(list, rate) {
  const thead = $("debt-head");
  const tbody = $("debt-body");
  if (thead) thead.innerHTML = `<tr>
    <th>Mijoz</th><th>Telefon</th>
    <th class="num">Sotuvlar</th>
    <th class="num">Umumiy qarz</th>
    <th>Eng yaqin muddat</th>
    <th>Holat</th><th>Amallar</th>
  </tr>`;
  if (!tbody) return;

  // Mijoz bo'yicha guruhlash
  const groups = {};
  list.forEach(s => {
    const cu  = debtCust(s);
    const key = cu.name + "|" + cu.phone;
    if (!groups[key]) groups[key] = { name:cu.name, phone:cu.phone, sales:[], totalRem:0, totalUzs:0, totalUsd:0 };
    groups[key].sales.push(s);
    groups[key].totalRem += s.remaining;
    if (s.debtCurrency === "usd" && s.debtUsd) {
      groups[key].totalUsd += s.debtUsd;
    } else {
      groups[key].totalUzs += s.remaining;
    }
  });

  if (!Object.keys(groups).length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-td">Qarz yo'q 🎉</td></tr>`;
    return;
  }

  tbody.innerHTML = Object.values(groups).map(g => {
    const anyOverdue  = g.sales.some(isOverdue);
    const nearestDue  = g.sales.map(s => s.due).filter(Boolean).sort()[0] || "—";
    const ids         = g.sales.map(s => s.id).join(",");
    return `<tr class="${anyOverdue?"debt-row-overdue":""}">
      <td>
        <div style="font-weight:700;font-size:13.5px">${g.name}</div>
        <div style="font-size:10.5px;color:#aaa">${g.sales.length} ta sotuv</div>
      </td>
      <td style="font-size:12.5px">
        ${g.phone && g.phone !== "—"
          ? `<a href="tel:${g.phone}" style="color:inherit">${g.phone}</a>` : "—"}
      </td>
      <td class="num" style="font-weight:600">${g.sales.length}</td>
      <td class="num">
        ${g.totalUzs > 0 ? `<div style="font-weight:800;color:var(--red);font-size:14px">${fmt(g.totalUzs)} so'm</div>` : ""}
        ${g.totalUsd > 0 ? `<div style="font-weight:800;color:#1B4F72;font-size:14px">$${g.totalUsd.toFixed(2)} USD</div>` : ""}
        ${!g.totalUzs && !g.totalUsd ? `<span style="color:#ccc">—</span>` : ""}
      </td>
      <td>
        <span class="bg ${anyOverdue?"bg-r":"bg-a"}">${nearestDue}</span>
      </td>
      <td>
        <span class="bg ${anyOverdue?"bg-r":"bg-g"}">
          ${anyOverdue?"⚠️ Muddati o'tgan":"⏳ Kutilmoqda"}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-sm" onclick="expandDebtGroup('${ids}')"
            style="font-size:11.5px"><i class="ti ti-eye"></i> Ko'rish</button>
          ${g.phone && g.phone !== "—"
            ? `<button class="btn btn-sm" onclick="sendGroupReminder('${g.phone}','${g.name}',${g.totalRem},${g.totalUsd})"
                style="font-size:11px;color:#856404"><i class="ti ti-message"></i> SMS</button>` : ""}
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ── Ko'rish (expand) ──────────────────────────────
function expandDebtGroup(idsStr) {
  debtGrouped = false;
  const btn = $("debt-group-btn");
  if (btn) { btn.style.background = ""; btn.style.color = ""; }
  const ids = idsStr.split(",").map(Number);
  // Filter by these sale IDs
  const list = debtSales().filter(s => ids.includes(s.id));
  const rate = db.settings.rate || 12800;
  renderDebtsList(list, rate);
}

// ── Mijozning barcha ochiq qarzlarini topish (sana bo'yicha) ──
function findCustomerDebts(s) {
  const cu = debtCust(s);
  let candidates;
  if (s.customerId) {
    candidates = db.sales.filter(x => x.customerId === s.customerId && x.status !== "qaytarilgan");
  } else {
    // customerId yo'q bo'lsa — ism+telefon bo'yicha
    candidates = db.sales.filter(x =>
      !x.customerId &&
      (x.customerName||"") === (s.customerName||"") &&
      (x.customerPhone||"") === (s.customerPhone||"") &&
      x.status !== "qaytarilgan"
    );
  }
  // Joriy holatni (calcSaleState orqali) tekshirib, hali ham qarzi bor bo'lganlarni qoldiramiz
  const list = candidates.filter(x => calcSaleState(x).remaining > 0.5);
  // Eng eski sana birinchi (sana bo'sh bo'lsa oxiriga)
  return list.sort((a, b) => (a.date||"9999") < (b.date||"9999") ? -1 : 1);
}

// ── To'lov qabul qilish (ko'p qarzga avtomatik taqsimlash) ──
async function recordPayment(id) {
  const clicked = db.sales.find(x => x.id === id); if (!clicked) return;
  const amt = parseFloat(($("pay-"+id)||{value:0}).value) || 0;
  if (amt <= 0) { toast("Summani kiriting","err"); return; }

  const method = ($("pay-method-"+id)||{value:"naqd"}).value || "naqd";

  const rate    = db.settings.rate || 12800;
  const clickedState = calcSaleState(clicked);
  const payCur  = (clicked.debtCurrency === "usd" && clickedState.debtUsd > 0) ? "usd" : "uzs";

  // Mijozning shu valyutadagi barcha ochiq qarzlari, sotuv sanasi bo'yicha (eng eski birinchi)
  const allDebts = findCustomerDebts(clicked);
  const sameCurDebts = allDebts.filter(s => {
    const st = calcSaleState(s);
    const isUsd = s.debtCurrency === "usd" && st.debtUsd > 0;
    return payCur === "usd" ? isUsd : !isUsd;
  });

  // Bosilgan qarz ro'yxatning boshida bo'lishi shart emas — lekin
  // taqsimlash har doim eng eski SOTUVDAN boshlanadi (FIFO, muddat emas)
  let remainingPay = amt;
  const allocations = [];

  for (const s of sameCurDebts) {
    if (remainingPay <= 0) break;
    const st = calcSaleState(s);

    if (payCur === "usd") {
      const debtAmt = st.debtUsd || 0;
      if (debtAmt <= 0) continue;
      const applied = Math.min(remainingPay, debtAmt);
      const remainingAfter = Math.max(0, debtAmt - applied);

      allocations.push({
        saleId: s.id, saleDate: s.date, chekNum: s.chekNum || ("#"+s.id),
        partNum: nextPartNum(s.id),
        amount: applied, currency: "usd",
        fullyPaid: remainingAfter < 0.005,
        remainingAfter
      });
      remainingPay -= applied;
    } else {
      const debtAmt = st.remaining || 0;
      if (debtAmt <= 0) continue;
      const applied = Math.min(remainingPay, debtAmt);
      const remainingAfter = Math.max(0, debtAmt - applied);

      allocations.push({
        saleId: s.id, saleDate: s.date, chekNum: s.chekNum || ("#"+s.id),
        partNum: nextPartNum(s.id),
        amount: applied, currency: "uzs",
        fullyPaid: remainingAfter < 100,
        remainingAfter
      });
      remainingPay -= applied;
    }
  }

  // Agar haligacha ortiqcha qoldiq bo'lsa (boshqa qarzlar yo'q) — oxirgi
  // taqsimotga "ortiqcha" sifatida qo'shamiz (mijozga qaytariladi deb hisoblanadi)
  const leftover = Math.round(remainingPay * 100) / 100;

  // ── To'lov yozuvini saqlash (sale o'zi o'zgarmaydi!) ──
  const cu = debtCust(clicked);
  const payment = {
    id:            (db.seq = (db.seq||1) + 1),
    chekNum:       genPayChekNum(),
    date:          today(),
    time:          nowTime(),
    customerId:    clicked.customerId || null,
    customerName:  cu.name,
    customerPhone: cu.phone,
    amount:        amt,
    currency:      payCur,
    method:        method,
    allocations:   allocations,
    leftover:      leftover > 0 ? leftover : 0
  };
  db.debtPayments = db.debtPayments || [];
  db.debtPayments.push(payment);

  saveDB(); renderDebts();
  if (typeof renderQarzlarTarixi === "function") renderQarzlarTarixi();

  // ── Xabar matni ────────────────────────────────
  const amtDisplay = fmtMoney(amt, payCur);
  let summary;
  if (allocations.length === 1) {
    const a = allocations[0];
    summary = a.fullyPaid
      ? `To'liq to'landi ✅ (${a.chekNum} ${String(a.partNum).padStart(3,"0")})`
      : `${fmtMoney(a.remainingAfter, a.currency)} qoldi`;
  } else if (allocations.length > 1) {
    summary = allocations.map(a =>
      `${a.saleDate} (${a.chekNum} ${String(a.partNum).padStart(3,"0")}): ${a.fullyPaid ? "to'liq yopildi" : fmtMoney(a.amount, a.currency)+" o'tkazildi"}`
    ).join("; ");
  } else {
    summary = "Taqsimlanmadi";
  }
  if (leftover > 0) summary += ` | Ortiqcha: ${fmtMoney(leftover, payCur)}`;

  toast(`✅ ${amtDisplay} qabul qilindi. ${summary}`);

  // ── Chek modalini ko'rsatish ────────────────────
  if (typeof showDebtPaymentReceipt === "function") {
    showDebtPaymentReceipt(payment);
  }

  // ── SMS ──────────────────────────────────────────
  const phone = cu.phone;
  if (phone && phone.replace(/\D/g,"").length >= 9) {
    const shopName = db.shop?.name || "MERX";
    let smsTxt = `${shopName}: To'lov qabul qilindi: ${amtDisplay}.`;
    if (allocations.length > 1) {
      smsTxt += " " + allocations.map(a =>
        `${a.saleDate}: ${a.fullyPaid ? "yopildi" : fmtMoney(a.amount,a.currency)+" hisobga o'tdi"}`
      ).join(", ") + ".";
    } else if (allocations.length === 1) {
      const a = allocations[0];
      smsTxt += a.fullyPaid ? " Qarz to'liq yopildi." : ` ${fmtMoney(a.remainingAfter,a.currency)} qoldi.`;
    }
    await sendSms(phone, smsTxt);
  }
}


// ── SMS eslatma (bitta) ───────────────────────────
async function sendDebtReminder(id) {
  const s     = db.sales.find(x => x.id === id); if (!s) return;
  const cu    = debtCust(s);
  const phone = cu.phone;
  if (!phone || phone === "—") { toast("Telefon raqam yo'q","err"); return; }

  const shopName = db.shop?.name || "MERX";
  const isUsd    = s.debtCurrency === "usd" && s.debtUsd;
  const debtTxt  = isUsd ? `$${s.debtUsd.toFixed(2)} USD` : `${fmt(s.remaining)} so'm`;
  const msg      = `${shopName}: Hurmatli ${cu.name}, sizda ${debtTxt} qarz bor. Muddat: ${s.due||"belgilanmagan"}. Iltimos to'lovni amalga oshiring.`;

  await sendSms(phone, msg);
  toast(`📲 SMS eslatma yuborildi: ${cu.name}`);
}

// ── SMS eslatma (guruhlangan) ─────────────────────
async function sendGroupReminder(phone, name, totalUzs, totalUsd) {
  const shopName = db.shop?.name || "MERX";
  const debtTxt  = totalUsd > 0
    ? `$${totalUsd.toFixed(2)} USD (${fmt(totalUzs)} so'm)`
    : `${fmt(totalUzs)} so'm`;
  const msg = `${shopName}: Hurmatli ${name}, umumiy qarzingiz: ${debtTxt}. Iltimos to'lovni amalga oshiring.`;
  await sendSms(phone, msg);
  toast(`📲 SMS eslatma yuborildi: ${name}`);
}

// ── Barcha muddati o'tganlarga SMS ────────────────
async function sendOverdueReminders() {
  const overdue = debtSales().filter(isOverdue);
  if (!overdue.length) { toast("Muddati o'tgan qarz yo'q","info"); return; }

  // Telefon bo'yicha guruhlash
  const byPhone = {};
  overdue.forEach(s => {
    const cu = debtCust(s);
    if (!cu.phone || cu.phone === "—") return;
    if (!byPhone[cu.phone]) byPhone[cu.phone] = { name:cu.name, phone:cu.phone, total:0, totalUsd:0 };
    byPhone[cu.phone].total    += s.remaining;
    byPhone[cu.phone].totalUsd += s.debtUsd || 0;
  });

  const phones = Object.values(byPhone);
  if (!phones.length) { toast("Telefon raqamlari yo'q","err"); return; }

  if (!confirm(`${phones.length} ta mijozga SMS eslatma yuborilsinmi?`)) return;

  let sent = 0;
  for (const p of phones) {
    const shopName = db.shop?.name || "MERX";
    const debtTxt  = p.totalUsd > 0
      ? `$${p.totalUsd.toFixed(2)} USD`
      : `${fmt(p.total)} so'm`;
    await sendSms(p.phone,
      `${shopName}: Hurmatli ${p.name}, qarz muddati o'tdi. Qarz: ${debtTxt}. Tezroq to'lang.`
    );
    sent++;
  }
  toast(`✅ ${sent} ta mijozga SMS yuborildi`);
}

// ════════════════════════════════════════════════
// QARZ TO'LOV CHEKI (modal)
// ════════════════════════════════════════════════

function showDebtPaymentReceipt(payment) {
  const shopName = db.shop?.name || "MERX";
  const allocHtml = (payment.allocations||[]).map(a => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;font-size:13px;padding-bottom:8px;border-bottom:1px solid #F6F4EF">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:#0D1B2A">${a.saleDate} qarzi <span style="color:#aaa;font-weight:400">(${a.chekNum})</span></div>
        <div style="font-size:11.5px;color:${a.fullyPaid?'#059669':'#d97706'};margin-top:2px">
          ${a.fullyPaid ? "✓ To'liq yopildi" : `Qisman to'landi — ${fmtMoney(a.remainingAfter, a.currency)} qoldi`}
        </div>
      </div>
      <div style="font-weight:700;color:#0D1B2A;margin-left:12px;white-space:nowrap">${fmtMoney(a.amount, a.currency)}</div>
    </div>`).join("");

  const leftoverHtml = payment.leftover > 0 ? `
    <div style="margin-top:10px;background:#FFFBEB;border-radius:10px;padding:10px 12px;font-size:12.5px;color:#92400E">
      <i class="ti ti-info-circle"></i> Ortiqcha to'lov: <b>${fmtMoney(payment.leftover, payment.currency)}</b> — boshqa ochiq qarz topilmadi
    </div>` : "";

  const html = `<!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>To'lov cheki ${payment.chekNum}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'DM Sans',sans-serif;background:#F2F0EB;display:flex;justify-content:center;padding:24px 12px}
      .receipt{background:#fff;width:380px;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(13,27,42,.08)}
      .head{background:#0D1B2A;color:#fff;padding:24px 22px 20px;text-align:center}
      .head .logo{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;letter-spacing:.5px}
      .head .sub{font-size:11px;color:#9aa7b5;margin-top:2px;letter-spacing:1px;text-transform:uppercase}
      .head .check{display:inline-block;margin-top:14px;width:36px;height:36px;border-radius:50%;background:#E9A500;color:#0D1B2A;font-size:18px;line-height:36px;font-weight:800}
      .body{padding:20px 22px}
      .meta{display:flex;justify-content:space-between;font-size:11.5px;color:#8a8f98;margin-bottom:16px;padding-bottom:14px;border-bottom:1px dashed #E8E5E0}
      .meta b{color:#0D1B2A;font-weight:700}
      .total-row{display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding-top:14px;border-top:2px solid #0D1B2A}
      .total-row .lbl{font-family:'Sora',sans-serif;font-weight:700;font-size:14px;color:#0D1B2A;letter-spacing:.5px}
      .total-row .val{font-family:'Sora',sans-serif;font-weight:800;font-size:22px;color:#0D1B2A}
      .badge-row{display:flex;justify-content:space-between;font-size:11px;color:#a3a8af;margin-top:14px;padding-top:12px;border-top:1px dashed #E8E5E0}
      .footer{padding:18px 22px 24px;text-align:center}
      .footer .thanks{font-family:'Sora',sans-serif;font-weight:700;font-size:14px;color:#0D1B2A;margin-bottom:4px}
      .footer .sub{font-size:11px;color:#a3a8af}
      .section-lbl{font-size:11px;color:#a3a8af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;font-weight:600}
      .actions{max-width:380px;margin:14px auto 0;display:flex;gap:10px}
      .actions button{flex:1;border:none;border-radius:12px;padding:12px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;cursor:pointer}
      .btn-print{background:#0D1B2A;color:#fff}
      .btn-close{background:#fff;color:#0D1B2A;border:1.5px solid #E8E5E0 !important}
      @media print{
        body{background:#fff;padding:0}
        .receipt{box-shadow:none;border-radius:0;width:100%;max-width:380px}
        .actions{display:none}
      }
    </style></head><body>
    <div>
      <div class="receipt">
        <div class="head">
          <div class="logo">${shopName.toUpperCase()}</div>
          <div class="sub">Qarz to'lov cheki</div>
          <div class="check">✓</div>
        </div>
        <div class="body">
          <div class="meta">
            <span>${payment.chekNum}</span>
            <b>${payment.date} ${payment.time||""}</b>
          </div>
          <div class="section-lbl">Yopilgan / kamaytirilgan qarzlar</div>
          ${allocHtml || `<div style="font-size:12.5px;color:#aaa">Mos qarz topilmadi</div>`}
          <div class="total-row">
            <span class="lbl">QABUL QILINDI</span>
            <span class="val">${fmtMoney(payment.amount, payment.currency)}</span>
          </div>
          <div style="text-align:right;font-size:11.5px;color:#a3a8af;margin-top:4px">${payMethodLabel(payment.method)} orqali</div>
          ${leftoverHtml}
          <div class="badge-row">
            <span>Mijoz: <b style="color:#0D1B2A">${payment.customerName||"—"}</b></span>
            <span>${payment.customerPhone||""}</span>
          </div>
        </div>
        <div class="footer">
          <div class="thanks">Rahmat! Yana kutamiz 🙏</div>
          <div class="sub">${shopName} · ${payment.date}</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn-print" onclick="window.print()">🖨 Chop etish</button>
        <button class="btn-close" onclick="window.close()">Yopish</button>
      </div>
    </div>
    </body></html>`;

  const w = window.open("","_blank","width=440,height=720");
  if (!w) { toast("Pop-up bloklangan","err"); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

// ── Tarixdan to'lov chekini qayta ochish ──────────
function reprintDebtPayment(id) {
  const p = (db.debtPayments||[]).find(x => x.id === id);
  if (!p) { toast("To'lov topilmadi","err"); return; }
  showDebtPaymentReceipt(p);
}

// ════════════════════════════════════════════════
// QARZLAR TARIXI — yangi sahifa
// ════════════════════════════════════════════════
// Har bir QARZGA SOTILGAN chekni 3 holatga ajratadi:
//   🟢 paid    — to'liq to'langan (lekin qarz sifatida boshlangan edi)
//   🟡 partial — qisman to'langan, hali qoldiq bor
//   🔴 unpaid  — umuman to'lov qilinmagan
let qtStatus = "all";

function setQtStatus(s) {
  qtStatus = s;
  document.querySelectorAll(".qt-status-btn").forEach(b => {
    const on = b.dataset.s === s;
    b.classList.toggle("on", on);
    b.style.background = on ? "#0D1B2A" : "#fff";
    b.style.color = on ? "#fff" : (b.dataset.s === "paid" ? "var(--grn)" : b.dataset.s === "partial" ? "#D97706" : b.dataset.s === "unpaid" ? "var(--red)" : "inherit");
  });
  renderQarzlarTarixi();
}

function renderQarzlarTarixi() {
  const el = $("qt-list"); if (!el) return;
  const q = ($("qt-q")||{value:""}).value.toLowerCase();

  // Qarzga sotilgan barcha cheklar. Yangi sotuvlarda origRemaining bor,
  // eski (oldin yaratilgan) sotuvlarda bu maydon yo'q — fallback sifatida
  // joriy total/paid asosida "boshlang'ich qarz bor edimi" deb tekshiramiz.
  const isUsdSale = s => s.debtCurrency === "usd";
  const getOrigDebt = s => {
    // USD qarz bo'lsa, dollar asosida qaytaramiz
    if (isUsdSale(s)) {
      if (s.origDebtUsd != null) return s.origDebtUsd;
      // Eski format: debtUsd dan kamida hozirgi qiymat, ortiqcha to'lov yo'q deb hisoblaymiz
      const payments = getSalePayments(s.id);
      const paidUsd = payments.filter(p=>p.currency==="usd").reduce((a,p)=>a+(p.amount||0),0);
      return Math.max(0, (s.debtUsd||0) + paidUsd);
    }
    if (s.origRemaining != null) return s.origRemaining;
    const payments = getSalePayments(s.id);
    const paidViaPayments = payments.reduce((a,p) => a + (p.currency==="usd" ? p.amount*(db.settings?.rate||12800) : p.amount), 0);
    const origPaidGuess = Math.max(0, (s.paid||0) - paidViaPayments);
    return Math.max(0, (s.total||0) - origPaidGuess);
  };
  const getOrigPaid = s => s.origPaid != null ? s.origPaid : Math.max(0, (s.total||0) - getOrigDebt(s));

  const debtSalesAll = (db.sales||[]).filter(s => getOrigDebt(s) > 0 && s.status !== "qaytarilgan");

  const rows = debtSalesAll.map(s => {
    const st = calcSaleState(s);
    const origPaid = getOrigPaid(s);
    const payments = getSalePayments(s.id);
    let status;
    if (st.remaining <= 0.5) status = "paid";
    else if (payments.length > 0) status = "partial";
    else status = "unpaid";
    return { sale: s, state: st, status, origDebt: getOrigDebt(s), origPaid };
  });

  let filtered = rows;
  if (qtStatus !== "all") filtered = filtered.filter(r => r.status === qtStatus);
  if (q) filtered = filtered.filter(r =>
    (r.sale.customerName||"").toLowerCase().includes(q) ||
    (r.sale.chekNum||"").toLowerCase().includes(q) ||
    (r.sale.customerPhone||"").includes(q)
  );

  const cntAll = rows.length;
  const cntPaid = rows.filter(r => r.status === "paid").length;
  const cntPartial = rows.filter(r => r.status === "partial").length;
  const cntUnpaid = rows.filter(r => r.status === "unpaid").length;
  if ($("qt-cnt-all")) $("qt-cnt-all").textContent = cntAll;
  if ($("qt-cnt-paid")) $("qt-cnt-paid").textContent = cntPaid;
  if ($("qt-cnt-partial")) $("qt-cnt-partial").textContent = cntPartial;
  if ($("qt-cnt-unpaid")) $("qt-cnt-unpaid").textContent = cntUnpaid;

  filtered.sort((a,b) => (a.sale.date+ (a.sale.time||"") < b.sale.date+(b.sale.time||"")) ? 1 : -1);

  if (!filtered.length) {
    el.innerHTML = `<div style="padding:50px;text-align:center;color:var(--mut)">
      <i class="ti ti-receipt-2" style="font-size:36px;display:block;margin-bottom:10px;opacity:.4"></i>
      Hech narsa topilmadi</div>`;
    return;
  }

  const statusMeta = {
    paid:    { color: "var(--grn)", bg: "#F0FDF4", border: "#86EFAC", label: "To'liq to'langan", dot: "🟢" },
    partial: { color: "#D97706",    bg: "#FFFBEB", border: "#FCD34D", label: "Qisman to'langan",  dot: "🟡" },
    unpaid:  { color: "var(--red)", bg: "#FEF2F2", border: "#FECACA", label: "To'lanmagan",        dot: "🔴" },
  };

  el.innerHTML = filtered.map(({sale: s, state: st, status, origDebt}) => {
    const meta = statusMeta[status];
    const payments = getSalePayments(s.id);
    const isUsd = s.debtCurrency === "usd";
    const origTotal = origDebt || 0;
    // Foiz hisoblash uchun har doim so'm ekvivalentida solishtiramiz
    const rate = db.settings?.rate || 12800;
    const origTotalUzs = isUsd ? origTotal * rate : origTotal;
    const remainingUzs = isUsd ? st.debtUsd * rate : st.remaining;
    const payPct = origTotalUzs > 0 ? Math.min(100, Math.round((origTotalUzs - remainingUzs) / origTotalUzs * 100)) : 100;
    const fmtCur = v => isUsd ? `$${(+v).toFixed(2)}` : `${fmt(v)} so'm`;
    const rowId = `qt-row-${s.id}`;

    return `<div style="border-bottom:1px solid var(--brd)">
      <div onclick="qtToggleExpand(${s.id})" style="display:flex;align-items:center;gap:14px;padding:14px 18px;cursor:pointer;background:${meta.bg}">
        <div style="width:10px;height:10px;border-radius:50%;background:${meta.color};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <strong style="font-size:13.5px;color:#0D1B2A">${s.customerName||"Noma'lum mijoz"}</strong>
            <span style="font-size:11.5px;color:#aaa">${s.chekNum||"#"+s.id} · ${s.date}</span>
          </div>
          <div style="font-size:11.5px;color:${meta.color};font-weight:600;margin-top:2px">${meta.dot} ${meta.label}${payments.length ? ` · ${payments.length} ta to'lov` : ""}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:13px;font-weight:700;color:#0D1B2A">${fmt(s.total||0)} so'm</div>
          <div style="font-size:11px;color:var(--mut)">
            ${status==="paid" ? "To'liq yopildi" : `Qoldiq: ${fmtCur(isUsd ? st.debtUsd : st.remaining)}`}
          </div>
        </div>
        <i class="ti ti-chevron-down" id="${rowId}-icon" style="color:var(--mut);transition:.2s;flex-shrink:0"></i>
      </div>
      <div id="${rowId}-detail" style="display:none;padding:0 18px 16px 42px;background:${meta.bg}">
        <div style="background:#fff;border-radius:10px;padding:4px;margin-bottom:8px">
          <div style="height:6px;background:#F0EEE8;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${payPct}%;background:${meta.color};border-radius:3px"></div>
          </div>
        </div>
        <div style="font-size:11.5px;color:var(--mut);margin-bottom:10px">
          Boshlang'ich qarz: <strong>${fmtCur(origTotal)}</strong> ·
          To'langan: <strong style="color:var(--grn)">${fmtCur(origTotal - (isUsd ? st.debtUsd : st.remaining))}</strong> (${payPct}%)
        </div>
        ${payments.length ? `
          <div style="display:flex;flex-direction:column;gap:6px">
            ${payments.map(p => `
              <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid var(--brd);border-radius:8px;padding:8px 12px">
                <div>
                  <span style="font-size:11.5px;font-weight:700;color:#0D1B2A">№${String(p.partNum).padStart(3,"0")}</span>
                  <span style="font-size:11px;color:#aaa;margin-left:6px">${p.payDate} ${p.payTime||""}</span>
                  <span style="font-size:11px;color:var(--mut);margin-left:6px">· ${payMethodLabel(p.payMethod)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <strong style="font-size:12.5px;color:var(--grn)">${fmtMoney(p.amount, p.currency)}</strong>
                  <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();reprintDebtPayment(${p.paymentId})" title="Chekni ko'rish">
                    <i class="ti ti-printer" style="font-size:13px"></i>
                  </button>
                </div>
              </div>`).join("")}
          </div>` : `<div style="font-size:12px;color:#bbb;padding:8px 0">Hali to'lov qilinmagan</div>`}
      </div>
    </div>`;
  }).join("");
}

function qtToggleExpand(saleId) {
  const detail = $(`qt-row-${saleId}-detail`);
  const icon = $(`qt-row-${saleId}-icon`);
  if (!detail) return;
  const isOpen = detail.style.display !== "none";
  detail.style.display = isOpen ? "none" : "block";
  if (icon) icon.style.transform = isOpen ? "" : "rotate(180deg)";
}

function payMethodLabel(m) {
  const labels = { naqd: "Naqd", karta: "Karta", otkazma: "O'tkazma" };
  return labels[m] || "Naqd";
}
