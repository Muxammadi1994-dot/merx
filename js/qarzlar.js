// ================================================
// MERX — js/qarzlar.js
// ================================================

function renderDebts() {
  const q = ($("debt-q")||{value:""}).value.toLowerCase();
  const list = debtSales().filter(s => !q || (s.customerName||"").toLowerCase().includes(q) || (s.customerPhone||"").includes(q));
  const totalRem  = debtSales().reduce((a, s) => a + s.remaining, 0);
  const over      = debtSales().filter(isOverdue);
  const thisMonth = today().slice(0, 7);
  const collected = db.sales.filter(s => s.date.startsWith(thisMonth) && s.status !== "qarz").reduce((a, s) => a + s.paid, 0);

  $("st-total").textContent  = fmt(totalRem) + " so'm";
  $("st-cnt").textContent    = debtSales().length + " kishi";
  $("st-over").textContent   = over.length + " ta";
  $("st-month").textContent  = fmt(collected) + " so'm";
  $("debt-count").textContent = debtSales().length;

  $("debt-body").innerHTML = list.length ? list.map(s => `<tr>
    <td><div style="font-weight:600">${s.customerName||"—"}</div></td>
    <td style="font-size:12.5px">${s.customerPhone||"—"}</td>
    <td style="font-size:12.5px">${s.items.map(i => i.name).join(", ")}</td>
    <td class="num">${fmt(s.total)}</td>
    <td class="num" style="color:var(--grn)">${fmt(s.paid)}</td>
    <td class="num" style="font-weight:700;color:var(--red)">${fmt(s.remaining)}</td>
    <td><span class="bg ${isOverdue(s)?"bg-r":"bg-a"}">${s.due||"—"}</span></td>
    <td><span class="bg ${isOverdue(s)?"bg-r":"bg-g"}">${isOverdue(s)?"Muddati o'tgan":"Kutilmoqda"}</span></td>
    <td><div style="display:flex;gap:6px">
      <input type="number" placeholder="so'm" step="10000" style="font-family:inherit;font-size:13px;border:1px solid var(--brd);border-radius:6px;padding:5px 8px;width:120px" id="pay-${s.id}">
      <button class="btn btn-teal btn-sm" onclick="recordPayment(${s.id})">To'lov</button>
    </div></td>
  </tr>`).join("") : `<tr><td colspan="9" class="empty-td">Qarz yo'q</td></tr>`;
}

async function recordPayment(id) {
  const s = db.sales.find(x => x.id === id); if (!s) return;
  const amt = parseFloat(($("pay-"+id)||{value:0}).value) || 0;
  if (amt <= 0) { toast("Summani kiriting","err"); return; }
  s.paid += amt; s.remaining = Math.max(0, s.total - s.paid);
  if (s.remaining < 0.5) s.status = "tolandan";
  saveDB(); renderDebts();
  await sendSms(s.customerPhone, `MERX: To'lov qabul qilindi: ${fmt(amt)} so'm. Qolgan qarz: ${fmt(s.remaining)} so'm.`);
  toast(`✅ ${fmt(amt)} so'm qabul qilindi. Qoldi: ${fmt(s.remaining)} so'm`);
}