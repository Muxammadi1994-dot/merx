// ================================================
// MERX — js/mijozlar.js
// ================================================

function renderMijozlar() {
  const typeLabel = { chakana:"Chakana", ulgurji:"Ulgurji", other:"Boshqa" };
  $("mijozlar-body").innerHTML = db.customers.length ? db.customers.map(c => {
    const cs = db.sales.filter(s => s.customerPhone === c.phone);
    const tb = cs.reduce((a, s) => a + s.total, 0);
    const cd = cs.reduce((a, s) => a + s.remaining, 0);
    return `<tr>
      <td style="font-weight:600">${c.name}</td>
      <td>${c.phone}</td>
      <td><span class="bg ${c.type==="ulgurji"?"bg-b":"bg-gr"}">${typeLabel[c.type]||"—"}</span></td>
      <td>${cs.length}</td>
      <td class="num">${fmt(tb)}</td>
      <td>${cd > 0 ? `<span class="bg bg-r num">${fmt(cd)}</span>` : `<span class="bg bg-g">Yo'q</span>`}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="6" class="empty-td">Mijoz yo'q</td></tr>`;
}

function addCustomer() {
  const name = ($("ac-name")||{value:""}).value.trim(); if (!name) { toast("Ism kiriting","err"); return; }
  db.customers.push({ id:db.seq++, name, phone:($("ac-phone")||{value:""}).value.trim(),
    type:($("ac-type")||{value:"chakana"}).value, note:($("ac-note")||{value:""}).value });
  saveDB(); closeModal("addcust"); renderMijozlar(); refreshCustList();
  if ($("ac-name")) $("ac-name").value = "";
  if ($("ac-phone")) $("ac-phone").value = "";
  toast("Mijoz qo'shildi");
}

function refreshCustList() {
  const sel = $("c-cust"); if (!sel) return;
  sel.innerHTML = `<option value="">— Ro'yxatdan tanlang —</option>` +
    db.customers.map(c => `<option value="${c.id}">${c.name} (${c.phone})</option>`).join("");
}

function custPick() {
  const id = parseInt($("c-cust").value); if (!id) return;
  const c = db.customers.find(x => x.id === id); if (!c) return;
  if ($("c-name")) $("c-name").value = c.name;
  if ($("c-phone")) $("c-phone").value = c.phone;
}