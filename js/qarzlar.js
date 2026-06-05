// ================================================
// MERX — js/qarzlar.js  (v2 — Valyuta qarz tizimi)
// ================================================

// Qarzga bog'langan mijozni topish
function debtCust(s) {
  const c = s.customerId ? db.customers.find(x => x.id === s.customerId) : null;
  return {
    name:  c ? c.name  : (s.customerName  || "—"),
    phone: c ? c.phone : (s.customerPhone || "—")
  };
}

// Qarz miqdorini to'g'ri valyutada ko'rsatish
function debtRemDisplay(s) {
  if (s.debtCurrency === "usd" && s.debtUsd != null) {
    return `<span style="font-weight:800;color:#1B4F72;font-size:14px">$${(+s.debtUsd).toFixed(2)}</span> <span style="font-size:10px;color:#aaa">USD</span>`;
  }
  return `<span style="font-weight:800;color:var(--red);font-size:14px">${fmt(s.remaining)}</span> <span style="font-size:10px;color:#aaa">so'm</span>`;
}

// To'lov input placeholder va step
function debtPayPlaceholder(s) {
  return s.debtCurrency === "usd" ? "USD miqdor" : "so'm miqdor";
}
function debtPayStep(s) {
  return s.debtCurrency === "usd" ? "0.01" : "10000";
}

function renderDebts() {
  const q = ($("debt-q")||{value:""}).value.toLowerCase();
  const list = debtSales().filter(s => {
    const cu = debtCust(s);
    return !q || (cu.name||"").toLowerCase().includes(q) || (cu.phone||"").includes(q);
  });

  const totalRemUzs  = debtSales().reduce((a, s) => a + s.remaining, 0);
  const over         = debtSales().filter(isOverdue);
  const thisMonth    = today().slice(0, 7);
  const collected    = db.sales.filter(s => s.date.startsWith(thisMonth) && s.status !== "qarz").reduce((a, s) => a + s.paid, 0);

  $("st-total").textContent  = fmt(totalRemUzs) + " so'm";
  $("st-cnt").textContent    = debtSales().length + " kishi";
  $("st-over").textContent   = over.length + " ta";
  $("st-month").textContent  = fmt(collected) + " so'm";
  $("debt-count").textContent = debtSales().length;

  $("debt-body").innerHTML = list.length ? list.map(s => {
    const cu    = debtCust(s);
    const isUsd = s.debtCurrency === "usd" && s.debtUsd != null;
    return `<tr>
      <td><div style="font-weight:600">${cu.name||"—"}</div></td>
      <td style="font-size:12.5px">${cu.phone||"—"}</td>
      <td style="font-size:12.5px">${s.items.map(i => i.name).join(", ")}</td>
      <td class="num">${fmt(s.total)} <span style="font-size:10px;color:#aaa">so'm</span></td>
      <td class="num">${fmt(s.paid)} <span style="font-size:10px;color:#aaa">so'm</span></td>
      <td class="num">${debtRemDisplay(s)}</td>
      <td><span class="bg ${isOverdue(s)?"bg-r":"bg-a"}">${s.due||"—"}</span></td>
      <td><span class="bg ${isOverdue(s)?"bg-r":"bg-g"}">${isOverdue(s)?"Muddati o'tgan":"Kutilmoqda"}</span></td>
      <td>
        <div style="display:flex;gap:6px;align-items:center">
          ${isUsd ? `<span class="bg" style="background:#EBF5FB;color:#1B4F72;font-size:10.5px;font-weight:700;padding:3px 7px;border-radius:5px">$</span>` : `<span class="bg" style="font-size:10.5px;padding:3px 7px;border-radius:5px">so'm</span>`}
          <input type="number"
            placeholder="${debtPayPlaceholder(s)}"
            step="${debtPayStep(s)}"
            style="font-family:inherit;font-size:13px;border:1px solid var(--brd);border-radius:6px;padding:5px 8px;width:110px"
            id="pay-${s.id}">
          <button class="btn btn-teal btn-sm" onclick="recordPayment(${s.id})">To'lov</button>
        </div>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="9" class="empty-td">Qarz yo'q 🎉</td></tr>`;
}

async function recordPayment(id) {
  const s = db.sales.find(x => x.id === id); if (!s) return;
  const amt = parseFloat(($("pay-"+id)||{value:0}).value) || 0;
  if (amt <= 0) { toast("Summani kiriting","err"); return; }

  const rate = db.settings.rate || 12800;
  const isUsd = s.debtCurrency === "usd" && s.debtUsd != null;

  let amtDisplay, debtLeft;

  if (isUsd) {
    // Foydalanuvchi USD kiritdi
    const amtSom = amt * rate;          // hisobot uchun so'mga o'tkazamiz
    s.paid      += amtSom;
    s.remaining  = Math.max(0, s.total - s.paid);
    s.debtUsd    = Math.max(0, (s.debtUsd || 0) - amt);

    if (s.debtUsd < 0.005) {
      s.debtUsd   = 0;
      s.remaining = 0;
      s.status    = "tolandan";
    }

    amtDisplay = "$" + amt.toFixed(2) + " USD";
    debtLeft   = s.debtUsd > 0 ? "$" + s.debtUsd.toFixed(2) + " USD" : "To'liq to'landi";
  } else {
    // Foydalanuvchi so'm kiritdi
    s.paid      += amt;
    s.remaining  = Math.max(0, s.total - s.paid);
    if (s.remaining < 0.5) s.status = "tolandan";

    amtDisplay = fmt(amt) + " so'm";
    debtLeft   = s.remaining > 0 ? fmt(s.remaining) + " so'm" : "To'liq to'landi";
  }

  saveDB(); renderDebts();

  // SMS
  const phone = debtCust(s).phone;
  if (phone && phone.replace(/\D/g,"").length >= 9) {
    await sendSms(phone,
      `MERX: To'lov qabul qilindi: ${amtDisplay}. Qolgan qarz: ${debtLeft}.`
    );
  }

  toast(`✅ ${amtDisplay} qabul qilindi. Qoldi: ${debtLeft}`);
}
