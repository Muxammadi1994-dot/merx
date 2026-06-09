// MERX xodimlar.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/xodimlar.js  (v2)
// ================================================

let xodPeriod = "today";

function setXodPeriod(p) {
  xodPeriod = p;
  document.querySelectorAll(".xod-period-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.p === p));
  renderXodimlar();
}

function xodDateRange() {
  const t = today();
  if (xodPeriod === "today") return { from: t, to: t };
  if (xodPeriod === "week")  return { from: addDays(t, -6), to: t };
  if (xodPeriod === "month") return { from: t.slice(0,7) + "-01", to: t };
  return { from: t, to: t };
}

// ── Xodim statistikasi ────────────────────────────
function staffStats(staffId, from, to) {
  const sales = db.sales.filter(s =>
    s.staffId === staffId && s.date >= from && s.date <= to
  );
  const total = sales.reduce((a, s) => a + (s.total||0), 0);
  const staff = db.staff.find(s => s.id === staffId);
  const bonusPct = staff?.bonusPct || 0;
  const salary   = staff?.salary   || 0;
  return {
    cnt:      sales.length,
    total,
    paid:     sales.reduce((a, s) => a + (s.paid||0),  0),
    debt:     sales.reduce((a, s) => a + (s.remaining||0), 0),
    avgCheck: sales.length ? Math.round(total/sales.length) : 0,
    bonus:    Math.round(total * bonusPct / 100),
    salary,
    bonusPct,
    totalPay: salary + Math.round(total * bonusPct / 100)
  };
}

// ── Maosh to'lash ─────────────────────────────────
function payStaffSalary(staffId) {
  const s = db.staff.find(x => x.id === staffId); if (!s) return;
  const m = today().slice(0,7);
  const ms = staffStats(staffId, m+"-01", today());

  if (ms.totalPay <= 0) { toast("Maosh 0 so'm — avval oylik yoki bonus % o'rnating", "err"); return; }
  if (!confirm(`${s.name} uchun ${fmt(ms.totalPay)} so'm to'lansinmi?
(Oylik: ${fmt(ms.salary)} + Bonus: ${fmt(ms.bonus)})`)) return;

  // Xarajatlar ga qo'shamiz
  if (!db.xarajatlar) db.xarajatlar = [];
  db.xarajatlar.push({
    id:        db.seq++,
    date:      today(),
    category:  "maosh",
    amount:    ms.totalPay,
    recipient: s.name,
    paidBy:    "kassa",
    note:      `${m} oyi maoshi. Oylik: ${fmt(ms.salary)}, Bonus: ${fmt(ms.bonus)}`
  });

  // To'langan oyni belgilaymiz
  if (!s.paidMonths) s.paidMonths = [];
  s.paidMonths.push(m);

  saveDB();
  renderXodimlar();
  toast(`✅ ${s.name} maoshi to'landi: ${fmt(ms.totalPay)} so'm`);
}

function isSalaryPaid(staffId, month) {
  const s = db.staff.find(x => x.id === staffId);
  return (s?.paidMonths || []).includes(month);
}

// ── Asosiy render ─────────────────────────────────
function renderXodimlar() {
  const { from, to } = xodDateRange();
  const t = today();
  const thisMonth = t.slice(0,7) + "-01";

  // KPI
  const todaySales = db.sales.filter(s => s.date === t);
  const monthSales = db.sales.filter(s => s.date >= thisMonth && s.date <= t);

  if ($("xod-cnt"))   $("xod-cnt").textContent   = db.staff.length + " ta";
  if ($("xod-today")) $("xod-today").textContent = fmt(todaySales.reduce((a,s)=>a+s.total,0)) + " so'm";
  if ($("xod-month")) $("xod-month").textContent = fmt(monthSales.reduce((a,s)=>a+s.total,0)) + " so'm";

  // Top kassir (bu oy)
  let topStaff = null, topTotal = 0;
  db.staff.forEach(s => {
    const st = staffStats(s.id, thisMonth, t);
    if (st.total > topTotal) { topTotal = st.total; topStaff = s; }
  });
  if ($("xod-top")) $("xod-top").textContent = topStaff
    ? `${topStaff.name} (${fmtK(topTotal)} so'm)` : "—";

  renderStaffCards(from, to, topStaff?.id);
  renderStaffTable(from, to);
}

// ── Kartochkalar ──────────────────────────────────
function renderStaffCards(from, to, topId) {
  const el = $("staff-cards"); if (!el) return;
  const roleLabel = { kassir:"💼 Kassir", menejer:"📊 Menejer", omborchi:"📦 Omborchi" };
  const roleColor = { kassir:"#4C9BE8", menejer:"#8B5CF6", omborchi:"#36B48C" };

  if (!db.staff.length) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:#bbb;font-size:14px;width:100%">
      <i class="ti ti-users" style="font-size:32px;display:block;margin-bottom:8px"></i>
      Xodimlar yo'q. "Xodim qo'shish" tugmasini bosing.
    </div>`;
    return;
  }

  el.innerHTML = db.staff.map(s => {
    const st      = staffStats(s.id, from, to);
    const isTop   = s.id === topId;
    const initials = s.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
    const color   = roleColor[s.role] || "#888";

    return `<div class="staff-card ${isTop?"top-performer":""}" onclick="openStaffDetail(${s.id})">
      ${isTop ? `<div style="position:absolute;top:12px;right:12px;font-size:18px" title="Top kassir">🏆</div>` : ""}
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:46px;height:46px;border-radius:12px;background:${color}22;color:${color};
          display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;flex-shrink:0">
          ${initials}
        </div>
        <div>
          <div style="font-weight:700;font-size:14px;color:#0D1B2A">${s.name}</div>
          <span style="font-size:11.5px;background:${color}18;color:${color};padding:2px 8px;border-radius:5px;font-weight:600">
            ${roleLabel[s.role]||s.role||"—"}
          </span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--bg);border-radius:8px;padding:8px 10px;text-align:center">
          <div style="font-size:10px;color:#aaa;font-weight:600;text-transform:uppercase;margin-bottom:2px">Sotuvlar</div>
          <div style="font-size:18px;font-weight:800;color:#0D1B2A">${st.cnt}</div>
        </div>
        <div style="background:var(--bg);border-radius:8px;padding:8px 10px;text-align:center">
          <div style="font-size:10px;color:#aaa;font-weight:600;text-transform:uppercase;margin-bottom:2px">Jami</div>
          <div style="font-size:14px;font-weight:800;color:var(--acc)">${fmtK(st.total)}</div>
        </div>
      </div>
      ${s.phone ? `<div style="margin-top:10px;font-size:12px;color:#aaa;text-align:center">${s.phone}</div>` : ""}
    </div>`;
  }).join("");
}

// ── Jadval ────────────────────────────────────────
function renderStaffTable(from, to) {
  const el = $("staff-table"); if (!el) return;
  const roleLabel = { kassir:"Kassir", menejer:"Menejer", omborchi:"Omborchi" };

  if (!db.staff.length) {
    el.innerHTML = `<tr><td colspan="8" class="empty-td">Xodimlar yo'q</td></tr>`;
    return;
  }

  const rows = db.staff.map(s => ({
    staff: s,
    ...staffStats(s.id, from, to)
  })).sort((a, b) => b.total - a.total);

  el.innerHTML = rows.map((r, i) => {
    const s = r.staff;
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          ${i === 0 && r.total > 0 ? `<span title="Top kassir">🏆</span>` : `<span style="color:#bbb;font-size:11px;width:16px">${i+1}</span>`}
          <div>
            <div style="font-weight:600;font-size:13.5px">${s.name}</div>
            ${s.phone ? `<div style="font-size:11px;color:#aaa">${s.phone}</div>` : ""}
          </div>
        </div>
      </td>
      <td>
        <span class="bg" style="font-size:11.5px">${roleLabel[s.role]||s.role||"—"}</span>
      </td>
      <td class="num" style="font-weight:700;font-size:14px">${r.cnt}</td>
      <td class="num" style="font-weight:700;color:var(--acc)">${r.total ? fmt(r.total)+" so'm" : "—"}</td>
      <td class="num" style="font-size:12.5px">${r.avgCheck ? fmt(r.avgCheck)+" so'm" : "—"}</td>
      <td class="num" style="color:var(--grn);font-size:12.5px">${r.paid ? fmt(r.paid)+" so'm" : "—"}</td>
      <td class="num" style="color:#8B5CF6;font-size:12.5px;font-weight:600">
        ${r.totalPay > 0 ? fmt(r.totalPay)+" so'm" : "—"}
      </td>
      <td class="num">
        ${r.debt > 0
          ? `<span style="color:var(--red);font-weight:700;font-size:12.5px">${fmt(r.debt)} so'm</span>`
          : r.cnt > 0 ? `<span class="bg bg-g" style="font-size:11px">✅</span>` : "—"}
      </td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="openStaffDetail(${s.id})" title="Ko'rish">
            <i class="ti ti-eye"></i>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="editStaff(${s.id})" title="Tahrirlash">
            <i class="ti ti-edit"></i>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteStaff(${s.id})" title="O'chirish" style="color:var(--red)">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ── Xodim detail modal ───────────────────────────
function openStaffDetail(id) {
  const s = db.staff.find(x => x.id === id); if (!s) return;
  const allStats   = staffStats(id, "2000-01-01", today());
  const todayStats = staffStats(id, today(), today());
  const monthStats = staffStats(id, today().slice(0,7)+"-01", today());
  const weekStats  = staffStats(id, addDays(today(),-6), today());

  const sales = db.sales.filter(x => x.staffId === id)
    .sort((a,b) => b.date > a.date ? 1 : -1).slice(0, 8);

  const roleLabel = { kassir:"💼 Kassir", menejer:"📊 Menejer", omborchi:"📦 Omborchi" };
  const roleColor = { kassir:"#4C9BE8", menejer:"#8B5CF6", omborchi:"#36B48C" };
  const initials  = s.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const color     = roleColor[s.role] || "#888";

  const modal = $("staff-detail-modal");
  if (!modal) return;

  modal.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
      <div style="width:52px;height:52px;border-radius:14px;background:${color}22;color:${color};
        display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;flex-shrink:0">
        ${initials}
      </div>
      <div>
        <div style="font-weight:700;font-size:17px">${s.name}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:3px">
          <span class="bg" style="font-size:12px;background:${color}18;color:${color}">${roleLabel[s.role]||s.role||"—"}</span>
          ${s.phone ? `<a href="tel:${s.phone}" style="font-size:12.5px;color:var(--mut)">${s.phone}</a>` : ""}
        </div>
      </div>
      <button class="btn btn-ghost btn-icon btn-sm" onclick="editStaff(${s.id});closeStaffDetail()"
        style="margin-left:auto" title="Tahrirlash"><i class="ti ti-edit"></i></button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
      ${[
        {lbl:"Bugun", cnt:todayStats.cnt, total:todayStats.total},
        {lbl:"7 kun",  cnt:weekStats.cnt,  total:weekStats.total},
        {lbl:"Bu oy",  cnt:monthStats.cnt, total:monthStats.total},
        {lbl:"Jami",   cnt:allStats.cnt,   total:allStats.total},
      ].map(d=>`
        <div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--mut);font-weight:700;text-transform:uppercase;margin-bottom:4px">${d.lbl}</div>
          <div style="font-size:16px;font-weight:800">${d.cnt}</div>
          <div style="font-size:10.5px;color:var(--acc);font-weight:600">${fmtK(d.total)}</div>
        </div>`).join("")}
    </div>

    <!-- Maosh paneli -->
    <div style="background:var(--bg);border-radius:12px;padding:14px;margin-bottom:16px;border:1.5px solid var(--brd)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em">
          Bu oy maoshi
        </div>
        <div style="font-size:11px;color:var(--mut)">${today().slice(0,7)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="background:#fff;border-radius:8px;padding:8px 10px;text-align:center">
          <div style="font-size:10px;color:var(--mut);margin-bottom:2px">Oylik</div>
          <div style="font-size:14px;font-weight:800">${fmt(monthStats.salary)} so'm</div>
        </div>
        <div style="background:#fff;border-radius:8px;padding:8px 10px;text-align:center">
          <div style="font-size:10px;color:var(--mut);margin-bottom:2px">Bonus (${monthStats.bonusPct}%)</div>
          <div style="font-size:14px;font-weight:800;color:var(--acc)">${fmt(monthStats.bonus)} so'm</div>
        </div>
        <div style="background:#0D1B2A;border-radius:8px;padding:8px 10px;text-align:center">
          <div style="font-size:10px;color:#aaa;margin-bottom:2px">Jami to'lov</div>
          <div style="font-size:15px;font-weight:800;color:#E9A500">${fmt(monthStats.totalPay)} so'm</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <div style="flex:1">
          <label style="font-size:11px;color:var(--mut);display:block;margin-bottom:3px">Oylik (so'm)</label>
          <input type="number" id="staff-salary-${s.id}" value="${s.salary||0}" placeholder="0"
            onchange="updateStaffPay(${s.id},'salary',this.value)"
            style="width:100%;font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:8px;padding:6px 10px">
        </div>
        <div style="flex:1">
          <label style="font-size:11px;color:var(--mut);display:block;margin-bottom:3px">Bonus % (sotuvdan)</label>
          <input type="number" id="staff-bonus-${s.id}" value="${s.bonusPct||0}" min="0" max="20" placeholder="0"
            onchange="updateStaffPay(${s.id},'bonusPct',this.value)"
            style="width:100%;font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:8px;padding:6px 10px">
        </div>
        ${isSalaryPaid(s.id, today().slice(0,7))
          ? `<div style="padding:6px 14px;background:#dcfce7;color:#16a34a;border-radius:8px;font-size:12px;font-weight:600;margin-top:16px">✅ To'landi</div>`
          : `<button class="btn btn-acc btn-sm" onclick="payStaffSalary(${s.id});closeStaffDetail()"
              style="margin-top:16px;white-space:nowrap">
              💰 To'lash
            </button>`}
      </div>
    </div>

    <div style="font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">
      Oxirgi sotuvlar
    </div>
    ${sales.length ? sales.map(sale => {
      const isDebt = sale.status === "qarz" && sale.remaining > 0;
      return `<div style="display:flex;align-items:center;justify-content:space-between;
        padding:8px 10px;border-radius:8px;margin-bottom:4px;
        background:${isDebt?"#FEF2F2":"var(--bg)"};border:1px solid ${isDebt?"#FECACA":"var(--brd)"}">
        <div>
          <div style="font-weight:600;font-size:13px">${sale.customerName||"Noma'lum"}</div>
          <div style="font-size:11px;color:var(--mut)">${sale.date} ${sale.time||""}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:13px">${fmt(sale.total)} so'm</div>
          ${isDebt ? `<div style="font-size:11px;color:var(--red)">Qarz: ${fmt(sale.remaining)} so'm</div>` : ""}
        </div>
      </div>`;
    }).join("") : `<div style="text-align:center;color:var(--mut);padding:16px;font-size:13px">Sotuv yo'q</div>`}`;

  openModal("staffdetail");
}

function closeStaffDetail() {
  closeModal("staffdetail");
}

// ── Maosh sozlamalari ────────────────────────────
function updateStaffPay(id, field, val) {
  const s = db.staff.find(x => x.id === id); if (!s) return;
  s[field] = parseFloat(val) || 0;
  saveDB();
  // Maosh panelini yangilaymiz
  const m = today().slice(0,7);
  const ms = staffStats(id, m+"-01", today());
  // Jami to'lov ni yangilaymiz
  const totEl = document.querySelector(`[data-staff-total="${id}"]`);
  if (totEl) totEl.textContent = fmt(ms.totalPay) + " so'm";
}

// ── Xodim qo'shish ────────────────────────────────
function addStaff() {
  const name     = ($("as-name")||{value:""}).value.trim();
  const phone    = ($("as-phone")||{value:""}).value.trim();
  const role     = ($("as-role")||{value:"kassir"}).value;
  const salary   = parseFloat(($("as-salary")||{value:"0"}).value) || 0;
  const bonusPct = parseFloat(($("as-bonus")||{value:"0"}).value)  || 0;
  if (!name) { toast("Ism kiriting","err"); return; }

  db.staff.push({ id: db.seq++, name, phone, role, salary, bonusPct });
  saveDB(); renderXodimlar(); closeModal("addstaff");
  toast(`✅ ${name} qo'shildi`);
  ["as-name","as-phone","as-salary","as-bonus"].forEach(id => { if ($(id)) $(id).value = ""; });
}

// ── Xodimni tahrirlash ────────────────────────────
function editStaff(id) {
  const s = db.staff.find(x => x.id === id); if (!s) return;
  if ($("as-name"))   $("as-name").value   = s.name;
  if ($("as-phone"))  $("as-phone").value  = s.phone || "";
  if ($("as-role"))   $("as-role").value   = s.role  || "kassir";
  if ($("as-salary")) $("as-salary").value = s.salary   || 0;
  if ($("as-bonus"))  $("as-bonus").value  = s.bonusPct || 0;
  const btn = document.querySelector("#ov-addstaff .btn-acc");
  if (btn) { btn.innerHTML = '<i class="ti ti-check"></i> Saqlash'; btn.onclick = () => saveStaff(id); }
  openModal("addstaff");
}

function saveStaff(id) {
  const s = db.staff.find(x => x.id === id); if (!s) return;
  s.name     = ($("as-name")||{value:""}).value.trim()  || s.name;
  s.phone    = ($("as-phone")||{value:""}).value.trim();
  s.role     = ($("as-role")||{value:"kassir"}).value;
  s.salary   = parseFloat(($("as-salary")||{value:"0"}).value) || 0;
  s.bonusPct = parseFloat(($("as-bonus")||{value:"0"}).value)  || 0;
  saveDB(); renderXodimlar(); closeModal("addstaff");
  toast("Xodim ma'lumotlari yangilandi");
  const btn = document.querySelector("#ov-addstaff .btn-acc");
  if (btn) { btn.innerHTML = '<i class="ti ti-check"></i>Saqlash'; btn.onclick = addStaff; }
}

// ── Xodimni o'chirish ─────────────────────────────
function deleteStaff(id) {
  const s = db.staff.find(x => x.id === id); if (!s) return;
  const cnt = db.sales.filter(x => x.staffId === id).length;
  const msg = cnt > 0
    ? `"${s.name}" — ${cnt} ta sotuv bor. O'chirilsa sotuvlarda "kassir: —" bo'ladi. O'chirishni tasdiqlaysizmi?`
    : `"${s.name}" o'chirilsinmi?`;
  if (!confirm(msg)) return;
  db.staff = db.staff.filter(x => x.id !== id);
  saveDB(); renderXodimlar();
  toast(`"${s.name}" o'chirildi`);
}
