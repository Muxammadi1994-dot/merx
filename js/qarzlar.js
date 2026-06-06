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
  const collected  = db.sales.filter(s => s.date?.startsWith(thisMonth) && s.paid > 0)
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
}

// ── Sotuv bo'yicha ro'yxat ────────────────────────
function renderDebtsList(list, rate) {
  const thead = $("debt-head");
  const tbody = $("debt-body");
  if (thead) thead.innerHTML = `<tr>
    <th>Mijoz</th><th>Telefon</th><th>Mahsulotlar</th>
    <th class="num">Sotuv jami</th><th class="num">To'langan</th>
    <th class="num">Qolgan qarz</th><th>Muddat</th><th>Holat</th>
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
      <td class="num" style="font-size:12.5px">${fmt(s.total)} so'm</td>
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
              style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:8px;padding:5px 8px;width:100px;flex:1;outline:none">
            <button class="btn btn-teal btn-sm" onclick="recordPayment(${s.id})">To'lov</button>
          </div>
          ${cu.phone && cu.phone !== "—"
            ? `<button class="btn btn-sm" onclick="sendDebtReminder(${s.id})" style="font-size:11px;color:#856404">
                <i class="ti ti-message"></i> SMS eslatma
               </button>`
            : ""}
        </div>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="9" class="empty-td">
    ${debtFilter !== "all" ? "Bu filtrda qarz yo'q" : "Qarz yo'q 🎉"}
  </td></tr>`;
}

// ── Mijoz bo'yicha guruhlangan ko'rinish ──────────
function renderDebtsGrouped(list, rate) {
  const thead = $("debt-head");
  const tbody = $("debt-body");
  if (thead) thead.innerHTML = `<tr>
    <th>Mijoz</th><th>Telefon</th>
    <th class="num">Sotuvlar</th><th class="num">Jami qarz</th>
    <th class="num">Qolgan (USD)</th><th>Eng yaqin muddat</th>
    <th>Holat</th><th>Amallar</th>
  </tr>`;
  if (!tbody) return;

  // Mijoz bo'yicha guruhlash
  const groups = {};
  list.forEach(s => {
    const cu  = debtCust(s);
    const key = cu.name + "|" + cu.phone;
    if (!groups[key]) groups[key] = { name:cu.name, phone:cu.phone, sales:[], totalRem:0, totalUsd:0 };
    groups[key].sales.push(s);
    groups[key].totalRem += s.remaining;
    if (s.debtCurrency === "usd" && s.debtUsd) groups[key].totalUsd += s.debtUsd;
  });

  if (!Object.keys(groups).length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-td">Qarz yo'q 🎉</td></tr>`;
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
        <div style="font-weight:800;color:var(--red);font-size:14px">${fmt(g.totalRem)} so'm</div>
        ${g.totalUsd > 0 ? `<div style="font-size:11px;color:#1B4F72">$${g.totalUsd.toFixed(2)} USD</div>` : ""}
      </td>
      <td class="num">
        ${g.totalUsd > 0
          ? `<span style="font-weight:700;color:#1B4F72">$${g.totalUsd.toFixed(2)}</span>` : "—"}
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

// ── To'lov qabul qilish ───────────────────────────
async function recordPayment(id) {
  const s = db.sales.find(x => x.id === id); if (!s) return;
  const amt = parseFloat(($("pay-"+id)||{value:0}).value) || 0;
  if (amt <= 0) { toast("Summani kiriting","err"); return; }

  const rate  = db.settings.rate || 12800;
  const isUsd = s.debtCurrency === "usd" && s.debtUsd != null;
  let amtDisplay, debtLeft;

  if (isUsd) {
    const amtSom = amt * rate;
    s.paid      += amtSom;
    s.remaining  = Math.max(0, s.total - s.paid);
    s.debtUsd    = Math.max(0, (s.debtUsd || 0) - amt);
    if (s.debtUsd < 0.005) { s.debtUsd = 0; s.remaining = 0; s.status = "tolandan"; }
    amtDisplay = `$${amt.toFixed(2)} USD`;
    debtLeft   = s.debtUsd > 0 ? `$${s.debtUsd.toFixed(2)} USD` : "To'liq to'landi ✅";
  } else {
    s.paid      += amt;
    s.remaining  = Math.max(0, s.total - s.paid);
    if (s.remaining < 0.5) s.status = "tolandan";
    amtDisplay = fmt(amt) + " so'm";
    debtLeft   = s.remaining > 0 ? fmt(s.remaining) + " so'm qoldi" : "To'liq to'landi ✅";
  }

  saveDB(); renderDebts();
  toast(`✅ ${amtDisplay} qabul qilindi. ${debtLeft}`);

  // SMS
  const phone = debtCust(s).phone;
  if (phone && phone.replace(/\D/g,"").length >= 9) {
    const shopName = db.shop?.name || "MERX";
    await sendSms(phone,
      `${shopName}: To'lov qabul qilindi: ${amtDisplay}. ${debtLeft}`
    );
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
