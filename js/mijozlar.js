// MERX mijozlar.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/mijozlar.js  (v2 — To'liq mijoz tizimi)
// ================================================

let custFilter = "all";
let _custCardId = null;

function setCustFilter(f) {
  custFilter = f;
  document.querySelectorAll(".cust-filter-btn").forEach(b =>
    b.classList.toggle("on", b.dataset.f === f));
  renderMijozlar();
}

// ── Mijoz statistikasi ────────────────────────────
function custStats(custId) {
  const sales = db.sales.filter(s =>
    s.customerId === custId ||
    (s.customerName && db.customers.find(c => c.id === custId && c.name === s.customerName))
  );
  const totalBuy   = sales.reduce((a, s) => a + (s.total || 0), 0);
  const debtList   = sales.filter(s => s.status !== "qaytarilgan")
    .map(s => ({ sale: s, state: calcSaleState(s) }))
    .filter(x => x.state.remaining > 0.5);
  const totalDebt  = debtList.filter(x => x.sale.debtCurrency !== "usd").reduce((a,x) => a + x.state.remaining, 0);
  const totalDebtUsd = debtList.filter(x => x.sale.debtCurrency === "usd" && x.state.debtUsd).reduce((a,x) => a + x.state.debtUsd, 0);
  const lastSale   = [...sales].sort((a, b) => b.date > a.date ? 1 : -1)[0];
  return { count: sales.length, totalBuy, totalDebt, totalDebtUsd, lastDate: lastSale?.date || null, sales };
}

// ── Render jadval ─────────────────────────────────
let _custSortKey = null;
let _custSortAsc = true;

function custSortToggle(key) {
  if (_custSortKey === key) { _custSortAsc = !_custSortAsc; }
  else { _custSortKey = key; _custSortAsc = key === "name"; }
  renderMijozlar();
}

function renderMijozlar() {
  const q = ($("cust-q")||{value:""}).value.toLowerCase();
  let list = [...db.customers];

  // Filtr
  if (custFilter === "ulgurji") list = list.filter(c => c.type === "ulgurji");
  if (custFilter === "chakana") list = list.filter(c => c.type === "chakana");
  if (custFilter === "debt")    list = list.filter(c => custStats(c.id).totalDebt > 0);

  // Qidiruv
  if (q) list = list.filter(c =>
    (c.name||"").toLowerCase().includes(q) ||
    (c.phone||"").includes(q) ||
    (c.note||"").toLowerCase().includes(q)
  );

  // Saralash
  if (_custSortKey) {
    list.sort((a, b) => {
      const sa = custStats(a.id);
      const sb = custStats(b.id);
      let va, vb;
      if (_custSortKey === "name")    { va = a.name;       vb = b.name; }
      if (_custSortKey === "count")   { va = sa.count;     vb = sb.count; }
      if (_custSortKey === "totalBuy"){ va = sa.totalBuy;  vb = sb.totalBuy; }
      if (_custSortKey === "debt")    {
        va = (sa.totalDebt || 0) + (sa.totalDebtUsd || 0) * (db.settings?.rate || 12800);
        vb = (sb.totalDebt || 0) + (sb.totalDebtUsd || 0) * (db.settings?.rate || 12800);
      }
      if (_custSortKey === "lastDate"){ va = sa.lastDate || ""; vb = sb.lastDate || ""; }
      if (typeof va === "string") return _custSortAsc ? va.localeCompare(vb,"uz") : vb.localeCompare(va,"uz");
      return _custSortAsc ? va - vb : vb - va;
    });
  }

  // KPI
  const all  = db.customers;
  const ulg  = all.filter(c => c.type === "ulgurji").length;
  const chak = all.filter(c => c.type === "chakana").length;
  const debt = all.filter(c => custStats(c.id).totalDebt > 0).length;
  if ($("mc-total")) $("mc-total").textContent = all.length;
  if ($("mc-ulg"))   $("mc-ulg").textContent   = ulg;
  if ($("mc-chak"))  $("mc-chak").textContent  = chak;
  if ($("mc-debt"))  $("mc-debt").textContent  = debt;

  const typeLabel = { ulgurji:"📦 Ulgurji", chakana:"👤 Chakana", other:"Boshqa" };
  const typeColor = { ulgurji:"#0D1B2A", chakana:"#0891b2", other:"#888" };

  // Thead saralash tugmalarini yangilash
  const thead = document.getElementById("mijozlar-thead");
  if (thead) {
    const sortIcon = (key) => {
      if (_custSortKey !== key) return '<i class="ti ti-selector" style="font-size:11px;opacity:.3"></i>';
      return _custSortAsc
        ? '<i class="ti ti-sort-ascending" style="font-size:11px;color:var(--acc)"></i>'
        : '<i class="ti ti-sort-descending" style="font-size:11px;color:var(--acc)"></i>';
    };
    thead.innerHTML = `<tr>
      <th style="cursor:pointer;user-select:none" onclick="custSortToggle('name')">ISM ${sortIcon('name')}</th>
      <th>TELEFON</th>
      <th>TURI</th>
      <th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('count')">SOTUVLAR ${sortIcon('count')}</th>
      <th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('totalBuy')">JAMI XARID ${sortIcon('totalBuy')}</th>
      <th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('lastDate')">OXIRGI XARID ${sortIcon('lastDate')}</th>
      <th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('debt')">JORIY QARZ ${sortIcon('debt')}</th>
      <th></th>
    </tr>`;
  }

  $("mijozlar-body").innerHTML = list.length ? list.map(c => {
    const st = custStats(c.id);
    return `<tr style="cursor:pointer" onclick="openCustCard(${c.id})">
      <td>
        <div style="font-weight:600;font-size:13.5px">${c.name}</div>
        ${c.note ? `<div style="font-size:11px;color:#aaa">${c.note}</div>` : ""}
      </td>
      <td style="font-size:12.5px">
        ${c.phone
          ? `<a href="tel:${c.phone}" onclick="event.stopPropagation()" style="color:inherit">${c.phone}</a>`
          : `<span style="color:#ccc">—</span>`}
      </td>
      <td>
        <span class="bg" style="font-size:11px;background:${typeColor[c.type]||"#888"}22;color:${typeColor[c.type]||"#888"}">
          ${typeLabel[c.type]||c.type||"—"}
        </span>
      </td>
      <td class="num" style="font-weight:600">${st.count}</td>
      <td class="num" style="font-size:12.5px">
        ${st.totalBuy ? fmt(st.totalBuy) + " so'm" : "—"}
      </td>
      <td class="num" style="font-size:12.5px;color:#aaa">
        ${st.lastDate || "—"}
      </td>
      <td class="num">
        ${(st.totalDebt > 0 || st.totalDebtUsd > 0)
          ? `<span style="color:var(--red);font-weight:700;font-size:13px">${
              st.totalDebtUsd > 0 && st.totalDebt > 0
                ? "$"+st.totalDebtUsd.toFixed(2)+" + "+fmt(st.totalDebt)+" so'm"
                : st.totalDebtUsd > 0 ? "$"+st.totalDebtUsd.toFixed(2)+" USD"
                : fmt(st.totalDebt)+" so'm"
            }</span>`
          : `<span style="color:var(--grn);font-size:12px">✅ Qarz yo'q</span>`}
      </td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openCustCard(${c.id})" title="Kartochka">
          <i class="ti ti-eye"></i>
        </button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="8" class="empty-td">
    ${custFilter !== "all" ? "Bu filtrda mijoz yo'q" : q ? `"${q}" topilmadi` : "Mijoz yo'q"}
  </td></tr>`;
}

// ── Mijoz kartochkasi ─────────────────────────────
function openCustCard(id) {
  const c = db.customers.find(x => x.id === id);
  if (!c) return;
  _custCardId = id;

  const st         = custStats(id);
  const typeLabel  = { ulgurji:"📦 Ulgurji xaridor", chakana:"👤 Chakana", other:"Boshqa" };
  const typeColor  = { ulgurji:"#0D1B2A", chakana:"#0891b2", other:"#888" };

  if ($("cc-name"))  $("cc-name").textContent  = c.name;
  if ($("cc-phone")) $("cc-phone").textContent = c.phone || "Telefon yo'q";
  if ($("cc-note"))  $("cc-note").textContent  = c.note  || "";

  const badge = $("cc-type-badge");
  if (badge) {
    badge.textContent   = typeLabel[c.type] || c.type || "—";
    badge.style.background = (typeColor[c.type]||"#888") + "22";
    badge.style.color      =  typeColor[c.type] || "#888";
  }

  if ($("cc-sales-cnt"))  $("cc-sales-cnt").textContent  = st.count;
  if ($("cc-total-buy"))  $("cc-total-buy").textContent  = st.totalBuy ? fmt(st.totalBuy) + " so'm" : "0";
  const debtEl = $("cc-debt");
  if (debtEl) {
    if (!st.totalDebt && !st.totalDebtUsd) {
      debtEl.textContent = "Qarz yo'q ✅";
      debtEl.style.color = "var(--grn)";
    } else {
      const parts = [];
      if (st.totalDebtUsd > 0) parts.push(`$${st.totalDebtUsd.toFixed(2)} USD`);
      if (st.totalDebt > 0)    parts.push(`${fmt(st.totalDebt)} so'm`);
      debtEl.textContent = parts.join(" + ");
      debtEl.style.color = "var(--red)";
    }
  }

  // Mijoz balansi (ortiqcha to'lovlardan yig'ilgan depozit)
  const balBlock = $("cc-balance-block");
  if (balBlock) {
    const bUzs = c.balanceUzs || 0, bUsd = c.balanceUsd || 0;
    if (bUzs > 0 || bUsd > 0) {
      const parts = [];
      if (bUsd > 0) parts.push(`$${bUsd.toFixed(2)}`);
      if (bUzs > 0) parts.push(`${fmt(bUzs)} so'm`);
      if ($("cc-balance")) $("cc-balance").textContent = parts.join(" + ");
      balBlock.style.display = "flex";
    } else {
      balBlock.style.display = "none";
    }
  }

  // SMS tugmasi
  const smsBtn = $("cc-sms-btn");
  if (smsBtn) smsBtn.style.display = c.phone ? "inline-flex" : "none";

  // Xarid tarixi
  const history = st.sales.sort((a, b) => b.date > a.date ? 1 : -1).slice(0, 10);
  if ($("cc-history")) {
    if (!history.length) {
      $("cc-history").innerHTML = `<div style="text-align:center;color:#ccc;padding:20px;font-size:13px">Xarid tarixi yo'q</div>`;
    } else {
      $("cc-history").innerHTML = history.map(s => {
        const isDebt = s.status !== "qaytarilgan" && calcSaleState(s).remaining > 0.5;
        return `<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:10px;margin-bottom:6px;background:${isDebt?"#FEF2F2":"var(--bg)"};border:1px solid ${isDebt?"#FECACA":"var(--brd)"}">
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
              <span style="font-weight:700;font-size:13px;color:#0D1B2A">${fmt(s.total)} so'm</span>
              <span style="font-size:11px;color:#aaa">${s.date} ${s.time||""}</span>
            </div>
            <div style="font-size:12px;color:#666;margin-bottom:3px">
              ${s.items?.map(i => `${i.name} ×${i.qty}`).join(", ") || "—"}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <span class="bg" style="font-size:10.5px">${s.payType||"naqd"}</span>
              ${isDebt
                ? `<span class="bg bg-r" style="font-size:10.5px">Qarz: ${
                    s.debtCurrency==="usd"&&s.debtUsd
                      ? "$"+s.debtUsd.toFixed(2)+" USD"
                      : fmt(s.remaining)+" so'm"
                  }</span>`
                : `<span class="bg bg-g" style="font-size:10.5px">To'langan</span>`}
              ${s.note ? `<span class="bg" style="font-size:10.5px;color:#856404">${s.note}</span>` : ""}
            </div>
          </div>
        </div>`;
      }).join("");
    }
  }

  openModal("custcard");
}

// ── Kartochkadan SMS ──────────────────────────────
async function custCardSms() {
  const c = db.customers.find(x => x.id === _custCardId);
  if (!c || !c.phone) return;
  const st = custStats(c.id);
  const shopName = db.shop?.name || "MERX";
  const debtTxt = st.totalDebtUsd > 0 && st.totalDebt > 0
    ? `$${st.totalDebtUsd.toFixed(2)} USD + ${fmt(st.totalDebt)} so'm`
    : st.totalDebtUsd > 0 ? `$${st.totalDebtUsd.toFixed(2)} USD`
    : st.totalDebt > 0 ? `${fmt(st.totalDebt)} so'm` : "";
  const msg = debtTxt
    ? `${shopName}: Hurmatli ${c.name}, jami qarzingiz: ${debtTxt}. Iltimos to'lovni amalga oshiring.`
    : `${shopName}: Hurmatli ${c.name}, siz bilan hamkorlik qilishdan mamnunmiz! Yangi mahsulotlar keldi.`;
  await sendSms(c.phone, msg);
  toast(`📲 SMS yuborildi: ${c.name}`);
}

// ── Kartochkadan tahrirlash ───────────────────────
function custCardEdit() {
  const c = db.customers.find(x => x.id === _custCardId);
  if (!c) return;
  closeModal("custcard");
  // Addcust modalini tahrirlash rejimida ochish
  if ($("ac-name"))  $("ac-name").value  = c.name;
  if ($("ac-phone")) $("ac-phone").value = c.phone || "";
  if ($("ac-type"))  $("ac-type").value  = c.type  || "ulgurji";
  if ($("ac-note"))  $("ac-note").value  = c.note  || "";
  // Tugmani o'zgartiramiz
  const btn = document.querySelector("#ov-addcust .btn-acc");
  if (btn) {
    btn.textContent = "Saqlash (tahrirlash)";
    btn.onclick = () => editCustomer(_custCardId);
  }
  openModal("addcust");
}

function editCustomer(id) {
  const c = db.customers.find(x => x.id === id);
  if (!c) return;
  c.name  = ($("ac-name")||{value:""}).value.trim()  || c.name;
  c.phone = ($("ac-phone")||{value:""}).value.trim() || c.phone;
  c.type  = ($("ac-type")||{value:""}).value         || c.type;
  c.note  = ($("ac-note")||{value:""}).value.trim();
  saveDB(); renderMijozlar(); closeModal("addcust");
  toast("Mijoz ma'lumotlari yangilandi");
  // Tugmani qaytaramiz
  const btn = document.querySelector("#ov-addcust .btn-acc");
  if (btn) { btn.textContent = "Saqlash"; btn.onclick = addCustomer; }
}

// ── Yangi mijoz qo'shish ──────────────────────────
function addCustomer() {
  const name  = ($("ac-name")||{value:""}).value.trim();
  const phone = ($("ac-phone")||{value:""}).value.trim();
  if (!name) { toast("Ism kiriting","err"); return; }

  // Takrorlanishni tekshirish
  const existing = db.customers.find(c =>
    c.name.toLowerCase() === name.toLowerCase() ||
    (phone && c.phone === phone)
  );
  if (existing) { toast(`"${existing.name}" allaqachon ro'yxatda`,"err"); return; }

  const nc = {
    id:    db.seq++,
    name,
    phone: phone || "",
    type:  ($("ac-type")||{value:"ulgurji"}).value,
    note:  ($("ac-note")||{value:""}).value.trim()
  };
  db.customers.push(nc);
  saveDB(); renderMijozlar(); closeModal("addcust");
  toast(`✅ "${name}" qo'shildi`);
  ["ac-name","ac-phone","ac-note"].forEach(id => { if ($(id)) $(id).value = ""; });
}
