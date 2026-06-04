// ================================================
// MERX — js/xodimlar.js
// ================================================

function renderXodimlar() {
  const t = today();
  const roleLabel = { kassir:"Kassir", menejer:"Menejer", omborchi:"Omborchi" };
  $("staff-cards").innerHTML = db.staff.length ? db.staff.map(s => {
    const sSales  = db.sales.filter(x => x.staffId === s.id);
    const todayS  = sSales.filter(x => x.date === t);
    const initials = s.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    return `<div class="staff-card">
      <div class="staff-av">${initials}</div>
      <div class="staff-nm">${s.name}</div>
      <div class="staff-role">${roleLabel[s.role]||s.role} · ${s.phone||""}</div>
      <div class="staff-stat">
        <div>Jami: <b>${sSales.length}</b> sotuv</div>
        <div>Bugun: <b>${todayS.length}</b> ta · <b>${fmt(todayS.reduce((a, x) => a + x.total, 0))}</b> so'm</div>
      </div>
      <div style="margin-top:10px;display:flex;gap:6px;justify-content:center">
        <button class="btn btn-red btn-sm btn-icon" onclick="removeStaff(${s.id})" title="O'chirish"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join("") : `<div style="color:var(--mut);font-size:13px;grid-column:1/-1;padding:8px">Xodim yo'q. Qo'shish tugmasini bosing.</div>`;

  $("staff-table").innerHTML = db.staff.length ? db.staff.map(s => {
    const sSales  = db.sales.filter(x => x.staffId === s.id);
    const todayS  = sSales.filter(x => x.date === t);
    return `<tr>
      <td style="font-weight:600">${s.name}</td>
      <td><span class="bg bg-gr">${s.role}</span></td>
      <td>${s.phone||"—"}</td>
      <td>${sSales.length}</td>
      <td class="num">${fmt(sSales.reduce((a, x) => a + x.total, 0))}</td>
      <td class="num" style="color:var(--teal)">${fmt(todayS.reduce((a, x) => a + x.total, 0))}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="6" class="empty-td">Xodim yo'q</td></tr>`;

  refreshStaffList();
}

function addStaff() {
  const name = ($("as-name")||{value:""}).value.trim(); if (!name) { toast("Ism kiriting","err"); return; }
  db.staff.push({ id:db.seq++, name, phone:($("as-phone")||{value:""}).value.trim(), role:($("as-role")||{value:"kassir"}).value });
  saveDB(); closeModal("addstaff"); renderXodimlar();
  if ($("as-name")) $("as-name").value = "";
  if ($("as-phone")) $("as-phone").value = "";
  toast("Xodim qo'shildi");
}

function removeStaff(id) {
  const s = db.staff.find(x => x.id === id); if (!s) return;
  if (!confirm(`${s.name} ni o'chirasizmi?`)) return;
  db.staff = db.staff.filter(x => x.id !== id); saveDB(); renderXodimlar();
  toast(`${s.name} o'chirildi`, "info");
}

function refreshStaffList() {
  const sel = $("pos-staff"); if (!sel) return;
  sel.innerHTML = `<option value="">— Kassirni tanlang —</option>` +
    db.staff.map(s => `<option value="${s.id}">${s.name} (${s.role})</option>`).join("");
}