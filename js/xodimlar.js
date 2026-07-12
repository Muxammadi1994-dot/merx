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
  const staff    = db.staff.find(s => s.id === staffId);
  const bonusPct = staff?.bonusPct || 0;
  const salary   = staff?.salary   || 0;
  const rate     = db.settings?.rate || 12800;

  const total    = sales.reduce((a, s) => a + (s.total||0), 0);
  const returned = sales.filter(s => s.status === "qaytarilgan").length;

  // Kassaga tushdi — payBreakdown + debtPayments (hisobot/moliya bilan bir xil)
  let kassaTushdi = 0;
  sales.forEach(s => {
    const pb = s.payBreakdown;
    if (pb && (pb.naqd||pb.karta||pb.otkazma)) kassaTushdi += (pb.naqd||0)+(pb.karta||0)+(pb.otkazma||0);
    else kassaTushdi += s.payType==="nasiya" ? 0 : (s.paid||0);
  });
  const debtPaid = (db.debtPayments||[]).filter(p =>
    sales.some(s => s.id === p.saleId) && p.date >= from && p.date <= to
  ).reduce((a,p)=>a+(p.currency==="usd"?Math.round(p.amount*rate):(p.amount||0)),0);
  kassaTushdi += debtPaid;

  // Qarz ulushi
  const nasiyaCnt = sales.filter(s => s.payType === "nasiya").length;
  const nasiyaPct = sales.length ? Math.round(nasiyaCnt/sales.length*100) : 0;

  // O'rtacha chek (qaytarilganlar chiqarilgan)
  const validSales = sales.filter(s => s.status !== "qaytarilgan");
  const avgCheck   = validSales.length ? Math.round(total/validSales.length) : 0;

  const bonus    = Math.round(kassaTushdi * bonusPct / 100);
  const totalPay = salary + bonus;

  return {
    cnt: sales.length, validCnt: validSales.length, returned,
    total, kassaTushdi, debtPaid,
    nasiyaCnt, nasiyaPct, avgCheck,
    bonus, salary, bonusPct, totalPay
  };
}

// ── Maosh to'lash ─────────────────────────────────
function payStaffSalary(staffId) {
  const s  = db.staff.find(x => x.id === staffId); if (!s) return;
  const m  = today().slice(0,7);
  const ms = staffStats(staffId, m+"-01", today());

  const modal = document.createElement("div");
  modal.className = "ov"; modal.id = "salary-modal";
  modal.style.cssText = "display:flex";
  modal.innerHTML = `
    <div class="modal" style="max-width:420px">
      <button class="m-close" onclick="$(\'salary-modal\').remove()"><i class="ti ti-x"></i></button>
      <h2 style="margin-bottom:4px">💰 Maosh to\'lash</h2>
      <p style="font-size:13px;color:var(--mut);margin-bottom:16px"><b>${s.name}</b> · ${m} oyi</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
        <div style="padding:10px;background:var(--bg);border-radius:10px;text-align:center">
          <div style="font-size:10px;color:var(--mut);font-weight:700;margin-bottom:3px">OYLIK</div>
          <div style="font-size:14px;font-weight:800">${fmt(ms.salary)}</div>
        </div>
        <div style="padding:10px;background:#FFFBEB;border-radius:10px;text-align:center">
          <div style="font-size:10px;color:#D97706;font-weight:700;margin-bottom:3px">BONUS (${ms.bonusPct}%)</div>
          <div style="font-size:14px;font-weight:800;color:#D97706">${fmt(ms.bonus)}</div>
        </div>
        <div style="padding:10px;background:#0D1B2A;border-radius:10px;text-align:center">
          <div style="font-size:10px;color:#aaa;font-weight:700;margin-bottom:3px">JAMI</div>
          <div style="font-size:15px;font-weight:800;color:#E9A500">${fmt(ms.totalPay)}</div>
        </div>
      </div>
      <div class="fld">
        <label>To\'lov summasi</label>
        <input id="sal-sum" type="text" data-price value="${fmt(ms.totalPay)}" oninput="fmtInput(this)"
          style="font-size:16px;font-weight:700;font-family:inherit;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 12px;width:100%">
        <div style="font-size:11.5px;color:var(--mut);margin-top:3px">Qisman to\'lash mumkin</div>
      </div>
      <div class="r2">
        <div class="fld"><label>To\'lov usuli</label>
          <select id="sal-method" style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%;background:#fff">
            <option value="naqd">💵 Naqd</option>
            <option value="karta">💳 Karta</option>
            <option value="otkazma">🏦 O\'tkazma</option>
          </select>
        </div>
        <div class="fld"><label>Izoh</label>
          <input id="sal-note" placeholder="${m} oyi maoshi"
            style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);padding:8px 10px;width:100%">
        </div>
      </div>
      <button class="btn btn-acc" style="width:100%;margin-top:4px" onclick="confirmPaySalary(${staffId},\'${m}\',${ms.totalPay})">
        <i class="ti ti-check"></i> To\'lashni tasdiqlash
      </button>
    </div>`;
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  document.body.appendChild(modal);
  setTimeout(()=>{ const el=$("sal-sum"); if(el){el.dataset.raw=ms.totalPay; el.select();} },50);
}

function confirmPaySalary(staffId, month, fullPay) {
  const s      = db.staff.find(x => x.id === staffId); if (!s) return;
  const rawSum = getRawVal("sal-sum");
  const method = ($("sal-method")||{value:"naqd"}).value;
  const note   = ($("sal-note")||{value:""}).value || `${month} oyi maoshi`;
  if (!rawSum || rawSum <= 0) { toast("Summani kiriting","err"); return; }
  if (!db.xarajatlar) db.xarajatlar = [];
  db.xarajatlar.push({
    id: db.seq++, date: today(), category: "Maosh",
    amount: rawSum, recipient: s.name, paidBy: "kassa", method, note
  });
  if (!s.paidMonths) s.paidMonths = [];
  if (!s.paidMonths.includes(month)) s.paidMonths.push(month);
  if (!s.salaryHistory) s.salaryHistory = [];
  s.salaryHistory.push({ month, amount: rawSum, method, note, date: today() });
  saveDB();
  $("salary-modal")?.remove();
  closeModal("staffdetail");
  renderXodimlar();
  toast(`✅ ${s.name}: ${fmt(rawSum)} so'm maosh to'landi`);
}

function isSalaryPaid(staffId, month) {
  const s = db.staff.find(x => x.id === staffId);
  return (s?.paidMonths||[]).includes(month) ||
    (s?.salaryHistory||[]).some(h => h.month === month);
}

function getSalaryHistory(staffId) {
  const s = db.staff.find(x => x.id === staffId);
  return [...(s?.salaryHistory||[])].reverse().slice(0,12);
}


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
    if (st.kassaTushdi > topTotal) { topTotal = st.kassaTushdi; topStaff = s; }
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
          <div style="font-size:13px;font-weight:800;color:var(--acc)">${fmtK(st.kassaTushdi)}</div>
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
  })).sort((a, b) => b.kassaTushdi - a.kassaTushdi);

  el.innerHTML = rows.map((r, i) => {
    const s = r.staff;
    const m = today().slice(0,7);
    const paid = isSalaryPaid(s.id, m);
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          ${i === 0 && r.kassaTushdi > 0 ? `<span title="Top kassir">🏆</span>` : `<span style="color:#bbb;font-size:11px;width:16px">${i+1}</span>`}
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
      <td class="num" style="font-weight:700;color:var(--acc)">${r.kassaTushdi ? fmtK(r.kassaTushdi)+" so'm" : "—"}</td>
      <td class="num" style="font-size:12.5px;color:var(--mut)">${r.avgCheck ? fmtK(r.avgCheck)+" so'm" : "—"}</td>
      <td class="num" style="font-size:12px">
        ${r.nasiyaPct > 0 ? `<span style="color:${r.nasiyaPct>30?"var(--red)":"var(--mut)"}">${r.nasiyaPct}%</span>` : "—"}
      </td>
      <td class="num" style="color:#8B5CF6;font-size:12.5px;font-weight:600">
        ${r.totalPay > 0 ? fmtK(r.totalPay)+" so'm" : "—"}
      </td>
      <td class="num">
        ${paid
          ? `<span class="bg bg-g" style="font-size:11px">✅ To'landi</span>`
          : r.totalPay > 0
            ? `<button class="btn btn-sm" style="font-size:11px;color:var(--acc);padding:3px 8px" onclick="payStaffSalary(${s.id})">💰 To'lash</button>`
            : "—"}
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
        {lbl:"Bugun",  cnt:todayStats.cnt,  total:todayStats.kassaTushdi},
        {lbl:"7 kun",  cnt:weekStats.cnt,   total:weekStats.kassaTushdi},
        {lbl:"Bu oy",  cnt:monthStats.cnt,  total:monthStats.kassaTushdi},
        {lbl:"Jami",   cnt:allStats.cnt,    total:allStats.kassaTushdi},
      ].map(d=>`
        <div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--mut);font-weight:700;text-transform:uppercase;margin-bottom:4px">${d.lbl}</div>
          <div style="font-size:16px;font-weight:800">${d.cnt}</div>
          <div style="font-size:10.5px;color:var(--acc);font-weight:600">${fmtK(d.total)}</div>
        </div>`).join("")}
    </div>

    <!-- Qo'shimcha ko'rsatkichlar -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <span class="bg" style="font-size:12px">
        O'rtacha chek: <b>${fmtK(monthStats.avgCheck)} so'm</b>
      </span>
      <span class="bg" style="font-size:12px;${monthStats.nasiyaPct>30?"background:#FEF2F2;color:var(--red)":""}">
        Nasiya ulushi: <b>${monthStats.nasiyaPct}%</b>
      </span>
      ${monthStats.returned>0?`<span class="bg bg-r" style="font-size:12px">
        Qaytarilgan: <b>${monthStats.returned} ta</b>
      </span>`:""}
      ${s.startDate?`<span class="bg" style="font-size:12px">
        Ishga kirgan: <b>${s.startDate}</b>
      </span>`:""}
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
          <div id="staff-bonus-disp-${s.id}" style="font-size:14px;font-weight:800;color:var(--acc)">${fmt(monthStats.bonus)} so'm</div>
        </div>
        <div style="background:#0D1B2A;border-radius:8px;padding:8px 10px;text-align:center">
          <div style="font-size:10px;color:#aaa;margin-bottom:2px">Jami to'lov</div>
          <div id="staff-total-disp-${s.id}" style="font-size:15px;font-weight:800;color:#E9A500">${fmt(monthStats.totalPay)} so'm</div>
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
    }).join("") : `<div style="text-align:center;color:var(--mut);padding:16px;font-size:13px">Sotuv yo'q</div>`}

    <!-- Ruxsatlar -->
    ${s.permDiscount||s.permNasiya||s.permReturn ? `
    <div style="font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px">
      Ruxsatlar
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${s.permDiscount?`<span class="bg" style="font-size:11.5px;background:#EFF6FF;color:#3B82F6">✂️ Chegirma ${s.maxDiscount?s.maxDiscount+"%":""}max</span>`:""}
      ${s.permNasiya  ?`<span class="bg" style="font-size:11.5px;background:#FEF3C7;color:#D97706">💳 Nasiya</span>`:""}
      ${s.permReturn  ?`<span class="bg" style="font-size:11.5px;background:#F0FDF4;color:var(--grn)">↩ Qaytarish</span>`:""}
    </div>` : ""}

    <!-- Smena tarixi -->
    ${(() => {
      const shifts = (db.shifts||[]).filter(sh=>sh.staffId===s.id).slice(-5).reverse();
      if (!shifts.length) return "";
      return `<div style="font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px">
        So'nggi smenalar
      </div>
      ${shifts.map(sh=>`
        <div style="display:flex;align-items:center;justify-content:space-between;
          padding:8px 10px;border-radius:8px;margin-bottom:4px;background:var(--bg);border:1px solid var(--brd)">
          <div>
            <div style="font-size:12.5px;font-weight:600">${sh.openTime||""} → ${sh.closeTime||"<span style='color:var(--grn)'>Faol</span>"}</div>
            ${sh.diff!==null&&sh.diff!==undefined?`<div style="font-size:11px;color:${sh.diff<0?"var(--red)":sh.diff>0?"var(--grn)":"var(--mut)"}">
              Farq: ${sh.diff>=0?"+":""}${fmt(sh.diff||0)} so'm
            </div>`:""}
          </div>
          <div style="font-size:12px;font-weight:700;color:#0D1B2A">${fmt(sh.openCash||0)} so'm</div>
        </div>`).join("")}`;
    })()}

    <!-- Maosh tarixi -->
    ${(() => {
      const hist = getSalaryHistory(s.id);
      if (!hist.length) return "";
      const micons = {naqd:"💵",karta:"💳",otkazma:"🏦"};
      return `<div style="font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px">
        Maosh tarixi
      </div>
      ${hist.map(h=>`
        <div style="display:flex;align-items:center;justify-content:space-between;
          padding:8px 10px;border-radius:8px;margin-bottom:4px;background:#F0FDF4;border:1px solid #BBF7D0">
          <div>
            <div style="font-size:12.5px;font-weight:700;color:var(--grn)">${h.month} oyi</div>
            <div style="font-size:11px;color:#aaa">${h.date||""} · ${micons[h.method]||"💵"} ${h.method||"naqd"}</div>
          </div>
          <div style="font-size:14px;font-weight:800;color:var(--grn)">+${fmt(h.amount)} so'm</div>
        </div>`).join("")}`;
    })()}`;

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
  // Maosh panelini real-time yangilaymiz
  const m  = today().slice(0,7);
  const ms = staffStats(id, m+"-01", today());
  const bonusEl  = document.getElementById(`staff-bonus-disp-${id}`);
  const totalEl  = document.getElementById(`staff-total-disp-${id}`);
  if (bonusEl) bonusEl.textContent = fmt(ms.bonus) + " so'm";
  if (totalEl) totalEl.textContent = fmt(ms.totalPay) + " so'm";
}

// ── Xodim qo'shish ────────────────────────────────
function _getStaffFormData() {
  const permDiscount = ($("as-perm-discount")||{checked:false}).checked;
  return {
    name:        ($("as-name")    ||{value:""}).value.trim(),
    phone:       ($("as-phone")   ||{value:""}).value.trim(),
    role:        ($("as-role")    ||{value:"kassir"}).value,
    salary:      parseFloat(($("as-salary")||{value:"0"}).value) || 0,
    bonusPct:    parseFloat(($("as-bonus") ||{value:"0"}).value) || 0,
    startDate:   ($("as-startdate")||{value:""}).value,
    birthday:    ($("as-birthday") ||{value:""}).value,
    address:     ($("as-address")  ||{value:""}).value.trim(),
    note:        ($("as-note")     ||{value:""}).value.trim(),
    permDiscount,
    maxDiscount: permDiscount ? (parseFloat(($("as-max-discount")||{value:"0"}).value)||0) : 0,
    permNasiya:  ($("as-perm-nasiya")||{checked:false}).checked,
    permReturn:  ($("as-perm-return")||{checked:false}).checked,
  };
}

function _resetStaffForm() {
  ["as-name","as-phone","as-pin","as-salary","as-bonus","as-startdate","as-birthday","as-address","as-note","as-max-discount"]
    .forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("as-role")) $("as-role").value = "kassir";
  ["as-perm-discount","as-perm-nasiya","as-perm-return"].forEach(id => { if($(id)) $(id).checked=false; });
  if ($("as-discount-wrap")) $("as-discount-wrap").style.display = "none";
  const h2 = document.querySelector("#ov-addstaff h2"); if(h2) h2.textContent = "Xodim qo\'shish";
  const btn = document.querySelector("#ov-addstaff .btn-acc");
  if (btn) { btn.innerHTML = '<i class="ti ti-check"></i> Saqlash'; btn.onclick = addStaff; }
}

function addStaff() {
  const d = _getStaffFormData();
  if (!d.name) { toast("Ism kiriting","err"); return; }
  db.staff.push({ id: db.seq++, ...d, paidMonths:[], salaryHistory:[], monthTarget:0 });
  saveDB(); renderXodimlar(); closeStaffModal();
  toast(`\u2705 ${d.name} qo\'shildi`);
  _resetStaffForm();
}

function editStaff(id) {
  const s = db.staff.find(x => x.id === id); if (!s) return;
  if ($("as-name"))         $("as-name").value         = s.name;
  if ($("as-phone"))        $("as-phone").value        = s.phone       || "";
  if ($("as-role"))         $("as-role").value         = s.role        || "kassir";
  if ($("as-salary"))       $("as-salary").value       = s.salary      || 0;
  if ($("as-bonus"))        $("as-bonus").value        = s.bonusPct    || 0;
  if ($("as-startdate"))    $("as-startdate").value    = s.startDate   || "";
  if ($("as-birthday"))     $("as-birthday").value     = s.birthday    || "";
  if ($("as-address"))      $("as-address").value      = s.address     || "";
  if ($("as-note"))         $("as-note").value         = s.note        || "";
  if ($("as-perm-discount"))$("as-perm-discount").checked = !!s.permDiscount;
  if ($("as-max-discount")) $("as-max-discount").value = s.maxDiscount || "";
  if ($("as-discount-wrap"))$("as-discount-wrap").style.display = s.permDiscount?"block":"none";
  if ($("as-perm-nasiya"))  $("as-perm-nasiya").checked = !!s.permNasiya;
  if ($("as-perm-return"))  $("as-perm-return").checked = !!s.permReturn;
  openStaffModal(id);
}

function saveStaff(id) {
  const s = db.staff.find(x => x.id === id); if (!s) return;
  const d = _getStaffFormData();
  if (!d.name) { toast("Ism kiriting","err"); return; }
  Object.assign(s, d);
  saveDB(); renderXodimlar(); closeStaffModal();
  toast("Xodim ma\'lumotlari yangilandi");
  _resetStaffForm();
}


function deleteStaff(id) {
  const s = db.staff.find(x => x.id === id); if (!s) return;
  const cnt      = (db.sales||[]).filter(x => x.staffId === id).length;
  const debtCnt  = (db.sales||[]).filter(x => x.staffId === id && x.status === "qarz").length;
  const payCnt   = (db.debtPayments||[]).filter(x => x.staffId === id).length;

  let msg = `"${s.name}" ni o'chirasizmi?`;
  if (cnt > 0)    msg += `\n• ${cnt} ta sotuv mavjud`;
  if (debtCnt > 0) msg += ` (${debtCnt} tasi qarzda!)`;
  if (payCnt > 0) msg += `\n• ${payCnt} ta to'lov qabul qilgan`;
  if (cnt > 0 || payCnt > 0) msg += "\nO'chirilsa bu yozuvlarda kassir ko'rsatilmaydi.";

  if (!confirm(msg)) return;
  db.staff = db.staff.filter(x => x.id !== id);
  saveDB(); renderXodimlar();
  toast(`"${s.name}" o'chirildi`);
}

// ── Excel eksport ─────────────────────────────────
function exportStaffExcel() {
  const { from, to } = xodDateRange();
  const rows = [["Ism","Telefon","Lavozim","Oylik","Bonus%","Ishga kirgan","Tug'ilgan kun",
    `Sotuvlar (${from}—${to})`, "Kassaga tushdi", "Bonus", "Jami to'lov",
    "Nasiya%", "O'rtacha chek",
    "Chegirma huquqi","Nasiya huquqi","Qaytarish huquqi"]];

  (db.staff||[]).forEach(s => {
    const st = staffStats(s.id, from, to);
    const roleLabel = { kassir:"Kassir", menejer:"Menejer", omborchi:"Omborchi" };
    rows.push([
      s.name, s.phone||"", roleLabel[s.role]||s.role||"",
      s.salary||0, s.bonusPct||0,
      s.startDate||"", s.birthday||"",
      st.cnt, st.kassaTushdi, st.bonus, st.totalPay,
      st.nasiyaPct+"%", st.avgCheck,
      s.permDiscount?(s.maxDiscount?s.maxDiscount+"% max":"Ha"):"Yo'q",
      s.permNasiya?"Ha":"Yo'q",
      s.permReturn?"Ha":"Yo'q"
    ]);
  });

  downloadCSV(rows, `merx_xodimlar_${today()}.xls`);
  toast(`✅ ${db.staff.length} ta xodim yuklab olindi`);
}

// ── Xodim modal (JS dan render) ───────────────────
// index.html ga tegmaymiz — modal to'liq JS da
function openStaffModal(editId = null) {
  document.getElementById("xodim-modal")?.remove();

  const isEdit = editId !== null;
  const s      = isEdit ? db.staff.find(x => x.id === editId) : null;
  const title  = isEdit ? "Xodimni tahrirlash" : "Xodim qo'shish";

  const iStyle = "font-family:inherit;font-size:13px;color:var(--ink);background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:8px;padding:9px 11px;width:100%;box-sizing:border-box;outline:none";
  const lStyle = "display:block;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px";

  const modal = document.createElement("div");
  modal.id    = "xodim-modal";
  modal.className = "ov";
  modal.onclick = e => { if (e.target === modal) closeStaffModal(); };
  modal.style.cssText = "display:flex";

  modal.innerHTML = `
    <div class="modal" style="max-width:520px;padding:0;overflow:hidden">

      <!-- Header -->
      <div style="padding:18px 20px;background:#0D1B2A;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:16px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px">
          <i class="ti ti-user-plus" style="color:#E9A500"></i> ${title}
        </div>
        <button onclick="closeStaffModal()"
          style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
          color:#fff;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:16px">✕</button>
      </div>

      <!-- Tab bar -->
      <div style="display:flex;background:#F3F2EF;padding:4px;gap:3px;border-bottom:1px solid #E5E7EB">
        <button id="sm-tab-asosiy" onclick="smTab('asosiy')"
          style="flex:1;padding:8px;border:none;border-radius:7px;background:#fff;
          font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;
          box-shadow:0 1px 3px rgba(0,0,0,.1);color:var(--ink)">
          👤 Asosiy
        </button>
        <button id="sm-tab-ruxsat" onclick="smTab('ruxsat')"
          style="flex:1;padding:8px;border:none;border-radius:7px;background:transparent;
          font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;color:#9CA3AF">
          🔐 Ruxsatlar
        </button>
        <button id="sm-tab-moliya" onclick="smTab('moliya')"
          style="flex:1;padding:8px;border:none;border-radius:7px;background:transparent;
          font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;color:#9CA3AF">
          💰 Moliya
        </button>
      </div>

      <!-- Tab: Asosiy -->
      <div id="sm-pane-asosiy" style="padding:20px;display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="${lStyle}">Ism familiya <span style="color:var(--red)">*</span></label>
          <input id="as-name" placeholder="Alisher Karimov" value="${s?.name||''}" style="${iStyle}"
            onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='#E5E7EB'">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="${lStyle}">Telefon</label>
            <input id="as-phone" placeholder="+998 90 000 00 00" value="${s?.phone||''}" oninput="fmtPhone(this)" style="${iStyle}"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='#E5E7EB'">
          </div>
          <div>
            <label style="${lStyle}">PIN kod <span style="font-size:10px;font-weight:400;text-transform:none">(kirish uchun)</span></label>
            <input id="as-pin" type="password" maxlength="6" inputmode="numeric"
              placeholder="4-6 raqam" value="${s?.pin||''}"
              style="${iStyle};letter-spacing:4px"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='#E5E7EB'">
          </div>
        </div>
        <div>
          <label style="${lStyle}">Lavozim</label>
          <select id="as-role" style="${iStyle}">
            <option value="kassir"   ${(s?.role||'kassir')==='kassir'   ?'selected':''}>💼 Kassir</option>
            <option value="menejer"  ${s?.role==='menejer'  ?'selected':''}>📊 Menejer</option>
            <option value="omborchi" ${s?.role==='omborchi' ?'selected':''}>📦 Omborchi</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="${lStyle}">Ishga kirgan sana</label>
            <input id="as-startdate" type="date" value="${s?.startDate||''}" style="${iStyle}"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='#E5E7EB'">
          </div>
          <div>
            <label style="${lStyle}">Tug'ilgan kun</label>
            <input id="as-birthday" type="date" value="${s?.birthday||''}" style="${iStyle}"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='#E5E7EB'">
          </div>
        </div>
        <div>
          <label style="${lStyle}">Manzil</label>
          <input id="as-address" placeholder="ixtiyoriy" value="${s?.address||''}" style="${iStyle}"
            onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='#E5E7EB'">
        </div>
      </div>

      <!-- Tab: Ruxsatlar -->
      <div id="sm-pane-ruxsat" style="padding:20px;display:none">
        <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:9px;
          padding:12px 14px;margin-bottom:16px;font-size:13px;color:#1E40AF;line-height:1.5">
          <strong>Rol asosida ruxsatlar:</strong><br>
          💼 Kassir — faqat sotuv | 📊 Menejer — barcha operatsiyalar | 📦 Omborchi — ombor
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <label style="display:flex;align-items:center;gap-12px;padding:12px 14px;
            background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:9px;cursor:pointer;gap:12px">
            <input type="checkbox" id="as-perm-discount"
              ${s?.permDiscount?'checked':''}
              style="width:18px;height:18px;accent-color:var(--acc);flex-shrink:0"
              onchange="document.getElementById('as-discount-wrap').style.display=this.checked?'block':'none'">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--ink)">✂️ Chegirma berish</div>
              <div style="font-size:11px;color:#9CA3AF">Kassir uchun qo'shimcha ruxsat</div>
            </div>
          </label>
          <div id="as-discount-wrap" style="display:${s?.permDiscount?'block':'none'};
            margin-left:12px;padding:10px 14px;background:#FFFBEB;border-radius:8px;border:1px solid #FDE68A">
            <label style="${lStyle}">Maksimal chegirma (%)</label>
            <input id="as-max-discount" type="number" min="0" max="50" placeholder="10"
              value="${s?.maxDiscount||''}"
              style="width:120px;font-family:inherit;font-size:14px;font-weight:700;
              border:1.5px solid #E5E7EB;border-radius:7px;padding:7px 10px;text-align:center">
          </div>
          <label style="display:flex;align-items:center;padding:12px 14px;
            background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:9px;cursor:pointer;gap:12px">
            <input type="checkbox" id="as-perm-nasiya"
              ${s?.permNasiya?'checked':''}
              style="width:18px;height:18px;accent-color:var(--acc);flex-shrink:0">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--ink)">💳 Nasiya berish</div>
              <div style="font-size:11px;color:#9CA3AF">Qarzga sotuv qilish huquqi</div>
            </div>
          </label>
          <label style="display:flex;align-items:center;padding:12px 14px;
            background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:9px;cursor:pointer;gap:12px">
            <input type="checkbox" id="as-perm-return"
              ${s?.permReturn?'checked':''}
              style="width:18px;height:18px;accent-color:var(--acc);flex-shrink:0">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--ink)">↩ Qaytarish qabul</div>
              <div style="font-size:11px;color:#9CA3AF">Tovar qaytarishni rasmiylashtirish</div>
            </div>
          </label>
        </div>
      </div>

      <!-- Tab: Moliya -->
      <div id="sm-pane-moliya" style="padding:20px;display:none;flex-direction:column;gap:12px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="${lStyle}">Oylik maosh (so'm)</label>
            <input id="as-salary" type="number" placeholder="0" step="100000"
              value="${s?.salary||''}" style="${iStyle}"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='#E5E7EB'">
          </div>
          <div>
            <label style="${lStyle}">Sotuv bonusi (%)</label>
            <input id="as-bonus" type="number" placeholder="0" min="0" max="20" step="0.5"
              value="${s?.bonusPct||''}" style="${iStyle}"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='#E5E7EB'">
          </div>
        </div>
        <div>
          <label style="${lStyle}">Qo'shimcha eslatma</label>
          <input id="as-note" placeholder="Masalan: Qiyinchilik soatlarida ishlay oladi..."
            value="${s?.note||''}" style="${iStyle}"
            onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='#E5E7EB'">
        </div>
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:9px;
          padding:12px 14px;font-size:12.5px;color:#065F46;line-height:1.6">
          <strong>Bonus hisob:</strong> Kassaga tushgan summaning belgilangan foizi xodimga bonus sifatida qo'shiladi.
          Masalan: 5% bonus → 10 000 000 so'm sotuvdan 500 000 so'm bonus.
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:14px 20px;border-top:1px solid #E5E7EB;background:#F9FAFB;
        display:flex;gap:8px">
        <button id="sm-save-btn" onclick="${isEdit ? `saveStaff(${editId})` : 'addStaff()'}"
          style="flex:1;background:#0D1B2A;border:none;border-radius:10px;padding:12px;
          font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;color:#E9A500">
          <i class="ti ti-check"></i> ${isEdit ? "Saqlash" : "Xodim qo'shish"}
        </button>
        <button onclick="closeStaffModal()"
          style="background:#F3F4F6;border:none;border-radius:10px;padding:12px 18px;
          font-family:inherit;font-size:13px;cursor:pointer;color:#6B7280;font-weight:600">
          Bekor
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  setTimeout(() => document.getElementById("as-name")?.focus(), 50);
}

function smTab(tab) {
  ["asosiy","ruxsat","moliya"].forEach(t => {
    const pane = document.getElementById("sm-pane-" + t);
    const btn  = document.getElementById("sm-tab-" + t);
    if (!pane || !btn) return;
    const on = t === tab;
    pane.style.display     = on ? (t === "moliya" ? "flex" : "block") : "none";
    btn.style.background   = on ? "#fff" : "transparent";
    btn.style.color        = on ? "var(--ink)" : "#9CA3AF";
    btn.style.fontWeight   = on ? "700" : "600";
    btn.style.boxShadow    = on ? "0 1px 3px rgba(0,0,0,.1)" : "none";
  });
}

function closeStaffModal() {
  document.getElementById("xodim-modal")?.remove();
}
