// MERX mijozlar.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/mijozlar.js  (v2 — To'liq mijoz tizimi)
// ================================================

let custFilter = "all";
let _custCardId = null;

function setCustFilter(f) {
  custFilter = f;
  document.querySelectorAll(".cust-filter-btn").forEach(b => {
    const on = b.dataset.f === f;
    b.classList.toggle("on", on);
    b.style.background = on ? "#0D1B2A" : "transparent";
    b.style.color      = on ? "#fff"    : "var(--mut)";
  });
  renderMijozlar();
}

// ── Mijoz statistikasi ────────────────────────────
function custSegment(st, c) {
  // Segment mezonlari:
  // VIP: 10+ sotuv YOKI 50mln+ xarid
  // Faolsiz: 90+ kun xarid qilmagan (va kamida 1 sotuv bo'lgan)
  // Yangi: birinchi xarid 30 kun ichida
  // Qarzli: joriy qarzi bor
  // Oddiy: qolganlari
  const rate = db.settings?.rate || 12800;
  const totalUzs = st.totalBuy + (st.totalDebtUsd||0)*rate;

  if (c.debtLimit && (st.totalDebt + (st.totalDebtUsd||0)*rate) >= c.debtLimit)
    return { key:"limit", label:"⛔ Limit to'lgan", color:"#E05A5A", bg:"#FEE2E2" };
  if (st.count >= 10 || totalUzs >= 50_000_000)
    return { key:"vip", label:"⭐ VIP", color:"#E9A500", bg:"#FEF3C7" };
  if (st.totalDebt > 0 || st.totalDebtUsd > 0)
    return { key:"debt", label:"💳 Qarzli", color:"#E05A5A", bg:"#FEE2E2" };
  if (st.lastDate) {
    const days = Math.round((new Date() - new Date(st.lastDate)) / 86400000);
    if (days > 90)
      return { key:"inactive", label:"💤 Faolsiz", color:"#94A3B8", bg:"#F1F5F9" };
  }
  if (st.lastDate) {
    const days = Math.round((new Date() - new Date(st.lastDate)) / 86400000);
    if (days <= 30 && st.count <= 2)
      return { key:"new", label:"🆕 Yangi", color:"#36B48C", bg:"#DCFCE7" };
  }
  return { key:"regular", label:"👤 Oddiy", color:"#4C9BE8", bg:"#DBEAFE" };
}

function custStats(custId) {
  const sales = db.sales.filter(s =>
    s.customerId === custId ||
    (s.customerName && db.customers.find(c => c.id === custId && c.name === s.customerName))
  );
  const totalBuy   = sales.reduce((a, s) => a + (s.total || 0), 0);
  const avgCheck   = sales.length ? Math.round(totalBuy / sales.length) : 0;
  const debtList   = sales.filter(s => s.status !== "qaytarilgan")
    .map(s => ({ sale: s, state: calcSaleState(s) }))
    .filter(x => x.state.remaining > 0.5);
  const totalDebt    = debtList.filter(x => x.sale.debtCurrency !== "usd").reduce((a,x) => a + x.state.remaining, 0);
  const totalDebtUsd = debtList.filter(x => x.sale.debtCurrency === "usd" && x.state.debtUsd).reduce((a,x) => a + x.state.debtUsd, 0);
  const lastSale   = [...sales].sort((a, b) => b.date > a.date ? 1 : -1)[0];
  const firstSale  = [...sales].sort((a, b) => a.date > b.date ? 1 : -1)[0];

  // Top tovar
  const itemMap = {};
  sales.forEach(s => s.items?.forEach(i => {
    itemMap[i.name] = (itemMap[i.name]||0) + (i.qty||0);
  }));
  const topItem = Object.entries(itemMap).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;

  // Qarz to'lovlari soni
  const debtPayCount = (db.debtPayments||[]).filter(p =>
    sales.some(s => s.id === p.saleId)
  ).length;

  // Oxirgi faollikdan necha kun
  const daysSinceLastBuy = lastSale?.date
    ? Math.round((new Date() - new Date(lastSale.date)) / 86400000)
    : null;

  return { count: sales.length, totalBuy, avgCheck, totalDebt, totalDebtUsd,
    lastDate: lastSale?.date || null, firstDate: firstSale?.date || null,
    topItem, debtPayCount, daysSinceLastBuy, sales };
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
  if (custFilter === "ulgurji")  list = list.filter(c => c.type === "ulgurji");
  if (custFilter === "chakana")  list = list.filter(c => c.type === "chakana");
  if (custFilter === "debt")     list = list.filter(c => custStats(c.id).totalDebt > 0 || custStats(c.id).totalDebtUsd > 0);
  if (custFilter === "vip")      list = list.filter(c => custSegment(custStats(c.id),c).key === "vip");
  if (custFilter === "inactive") list = list.filter(c => custSegment(custStats(c.id),c).key === "inactive");
  if (custFilter === "new")      list = list.filter(c => custSegment(custStats(c.id),c).key === "new");

  // Qidiruv
  if (q) list = list.filter(c =>
    (c.name||"").toLowerCase().includes(q) ||
    (c.phone||"").includes(q) ||
    (c.note||"").toLowerCase().includes(q) ||
    (c.company||"").toLowerCase().includes(q)
  );

  // Saralash
  if (_custSortKey) {
    list.sort((a, b) => {
      const sa = custStats(a.id), sb = custStats(b.id);
      let va, vb;
      if (_custSortKey === "name")    { va = a.name;       vb = b.name; }
      if (_custSortKey === "count")   { va = sa.count;     vb = sb.count; }
      if (_custSortKey === "totalBuy"){ va = sa.totalBuy;  vb = sb.totalBuy; }
      if (_custSortKey === "avgCheck"){ va = sa.avgCheck;  vb = sb.avgCheck; }
      if (_custSortKey === "debt")    {
        va = (sa.totalDebt||0) + (sa.totalDebtUsd||0)*(db.settings?.rate||12800);
        vb = (sb.totalDebt||0) + (sb.totalDebtUsd||0)*(db.settings?.rate||12800);
      }
      if (_custSortKey === "lastDate"){ va = sa.lastDate||""; vb = sb.lastDate||""; }
      if (typeof va === "string") return _custSortAsc ? va.localeCompare(vb,"uz") : vb.localeCompare(va,"uz");
      return _custSortAsc ? va - vb : vb - va;
    });
  }

  // KPI
  const all = db.customers;
  const rate = db.settings?.rate || 12800;
  const ulg  = all.filter(c => c.type === "ulgurji").length;
  const chak = all.filter(c => c.type === "chakana").length;
  const debtCount = all.filter(c => { const st=custStats(c.id); return st.totalDebt>0||st.totalDebtUsd>0; }).length;
  const totalDebtSum = all.reduce((a,c) => {
    const st=custStats(c.id); return a+st.totalDebt+(st.totalDebtUsd||0)*rate;
  }, 0);
  const vipCount = all.filter(c => custSegment(custStats(c.id),c).key === "vip").length;

  if ($("mc-total"))     $("mc-total").textContent     = all.length;
  if ($("mc-ulg"))       $("mc-ulg").textContent       = ulg;
  if ($("mc-chak"))      $("mc-chak").textContent      = chak;
  if ($("mc-debt"))      $("mc-debt").textContent      = debtCount;
  if ($("mc-debt-sum"))  $("mc-debt-sum").textContent  = fmtK(totalDebtSum)+" so'm";
  if ($("mc-vip"))       $("mc-vip").textContent       = vipCount;

  const typeLabel = { ulgurji:"📦 Ulgurji", chakana:"👤 Chakana", other:"Boshqa" };
  const typeColor = { ulgurji:"#0D1B2A", chakana:"#0891b2", other:"#888" };

  // Thead
  const thead = document.getElementById("mijozlar-thead");
  if (thead) {
    const si = (key) => {
      if (_custSortKey !== key) return '<i class="ti ti-selector" style="font-size:11px;opacity:.3"></i>';
      return _custSortAsc
        ? '<i class="ti ti-sort-ascending" style="font-size:11px;color:var(--acc)"></i>'
        : '<i class="ti ti-sort-descending" style="font-size:11px;color:var(--acc)"></i>';
    };
    thead.innerHTML = `<tr>
      <th style="cursor:pointer;user-select:none" onclick="custSortToggle('name')">ISM ${si('name')}</th>
      <th>TELEFON</th>
      <th>SEGMENT</th>
      <th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('count')">SOTUVLAR ${si('count')}</th>
      <th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('totalBuy')">JAMI XARID ${si('totalBuy')}</th>
      <th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('avgCheck')">O'RTACHA CHEK ${si('avgCheck')}</th>
      <th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('lastDate')">OXIRGI XARID ${si('lastDate')}</th>
      <th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('debt')">JORIY QARZ ${si('debt')}</th>
      <th></th>
    </tr>`;
  }

  $("mijozlar-body").innerHTML = list.length ? list.map(c => {
    const st  = custStats(c.id);
    const seg = custSegment(st, c);
    const limitWarn = c.debtLimit && (st.totalDebt+(st.totalDebtUsd||0)*(db.settings?.rate||12800)) >= c.debtLimit * 0.8;
    return `<tr style="cursor:pointer${limitWarn?' background:#FFF7F7':''}" onclick="openCustCard(${c.id})">
      <td>
        <div style="font-weight:600;font-size:13.5px">${c.name}</div>
        ${c.company ? `<div style="font-size:11px;color:#aaa">${c.company}</div>` : ""}
        ${c.note && !c.company ? `<div style="font-size:11px;color:#aaa">${c.note}</div>` : ""}
      </td>
      <td style="font-size:12.5px">
        ${c.phone
          ? `<a href="tel:${c.phone}" onclick="event.stopPropagation()" style="color:inherit">${c.phone}</a>`
          : `<span style="color:#ccc">—</span>`}
      </td>
      <td>
        <span class="bg" style="font-size:11px;background:${seg.bg};color:${seg.color};font-weight:600">
          ${seg.label}
        </span>
        ${c.debtLimit ? `<div style="font-size:10px;color:${limitWarn?"var(--red)":"#bbb"};margin-top:2px">
          Limit: ${fmtK(c.debtLimit)} so'm${limitWarn?" ⚠️":""}
        </div>` : ""}
      </td>
      <td class="num" style="font-weight:600">${st.count}</td>
      <td class="num" style="font-size:12.5px">${st.totalBuy ? fmtK(st.totalBuy)+" so'm" : "—"}</td>
      <td class="num" style="font-size:12.5px;color:var(--mut)">${st.avgCheck ? fmtK(st.avgCheck)+" so'm" : "—"}</td>
      <td class="num" style="font-size:12px;color:#aaa">
        ${st.daysSinceLastBuy !== null
          ? st.daysSinceLastBuy === 0 ? "<span style='color:var(--grn)'>Bugun</span>"
          : st.daysSinceLastBuy <= 7 ? `<span style='color:var(--grn)'>${st.daysSinceLastBuy} kun oldin</span>`
          : st.daysSinceLastBuy <= 30 ? `${st.daysSinceLastBuy} kun oldin`
          : `<span style='color:#E9A500'>${st.lastDate}</span>`
          : "—"}
      </td>
      <td class="num">
        ${(st.totalDebt > 0 || st.totalDebtUsd > 0)
          ? `<span style="color:var(--red);font-weight:700;font-size:13px">${
              st.totalDebtUsd>0&&st.totalDebt>0
                ? "$"+st.totalDebtUsd.toFixed(2)+" + "+fmt(st.totalDebt)+" so'm"
                : st.totalDebtUsd>0 ? "$"+st.totalDebtUsd.toFixed(2)+" USD"
                : fmt(st.totalDebt)+" so'm"
            }</span>`
          : `<span style="color:var(--grn);font-size:12px">✅</span>`}
      </td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openCustCard(${c.id})">
          <i class="ti ti-eye"></i>
        </button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="9" class="empty-td">
    ${custFilter !== "all" ? "Bu filtrda mijoz yo'q" : q ? `"${q}" topilmadi` : "Mijoz yo'q"}
  </td></tr>`;
}

// ── Mijoz kartochkasi ─────────────────────────────
function openCustCard(id) {
  const c = db.customers.find(x => x.id === id);
  if (!c) return;
  _custCardId = id;

  const st   = custStats(id);
  const seg  = custSegment(st, c);
  const rate = db.settings?.rate || 12800;

  if ($("cc-name"))  $("cc-name").textContent  = c.name;
  if ($("cc-phone")) $("cc-phone").textContent = c.phone || "Telefon yo'q";
  if ($("cc-note"))  $("cc-note").textContent  = c.note  || "";

  const badge = $("cc-type-badge");
  if (badge) {
    badge.textContent      = seg.label;
    badge.style.background = seg.bg;
    badge.style.color      = seg.color;
  }

  if ($("cc-sales-cnt"))  $("cc-sales-cnt").textContent  = st.count+" ta sotuv";
  if ($("cc-total-buy"))  $("cc-total-buy").textContent  = st.totalBuy ? fmtK(st.totalBuy)+" so'm" : "0";
  if ($("cc-avg-check"))  $("cc-avg-check").textContent  = st.avgCheck ? fmtK(st.avgCheck)+" so'm" : "—";
  if ($("cc-top-item"))   $("cc-top-item").textContent   = st.topItem || "—";
  if ($("cc-first-date")) $("cc-first-date").textContent = st.firstDate || "—";
  if ($("cc-last-date"))  $("cc-last-date").textContent  = st.daysSinceLastBuy !== null
    ? (st.daysSinceLastBuy === 0 ? "Bugun" : st.daysSinceLastBuy+" kun oldin")
    : "—";

  const debtEl = $("cc-debt");
  if (debtEl) {
    if (!st.totalDebt && !st.totalDebtUsd) {
      debtEl.textContent = "Qarz yo'q \u2705"; debtEl.style.color = "var(--grn)";
    } else {
      const parts = [];
      if (st.totalDebtUsd > 0) parts.push("$"+st.totalDebtUsd.toFixed(2)+" USD");
      if (st.totalDebt > 0)    parts.push(fmt(st.totalDebt)+" so'm");
      debtEl.textContent = parts.join(" + "); debtEl.style.color = "var(--red)";
    }
  }

  // Qarz limiti progress bar
  const limitBlock = $("cc-limit-block");
  if (limitBlock) {
    if (c.debtLimit) {
      const curDebt = st.totalDebt + (st.totalDebtUsd||0)*rate;
      const pct = Math.min(100, Math.round(curDebt/c.debtLimit*100));
      const color = pct>=100?"var(--red)":pct>=80?"#E9A500":"var(--grn)";
      limitBlock.style.display = "block";
      limitBlock.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
          <span style="font-weight:600;color:${color}">Qarz limiti</span>
          <span style="font-weight:700">${fmtK(curDebt)} / ${fmtK(c.debtLimit)} so'm</span>
        </div>
        <div style="height:8px;background:#f0ede7;border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px"></div>
        </div>
        <div style="font-size:10.5px;color:${color};margin-top:3px;font-weight:600">${pct}% ishlatilgan</div>`;
    } else { limitBlock.style.display = "none"; }
  }

  const balBlock = $("cc-balance-block");
  if (balBlock) {
    const bUzs=c.balanceUzs||0, bUsd=c.balanceUsd||0;
    if (bUzs>0||bUsd>0) {
      const parts=[];
      if (bUsd>0) parts.push("$"+bUsd.toFixed(2));
      if (bUzs>0) parts.push(fmt(bUzs)+" so'm");
      if ($("cc-balance")) $("cc-balance").textContent = parts.join(" + ");
      balBlock.style.display = "flex";
    } else { balBlock.style.display = "none"; }
  }

  if ($("cc-sms-btn")) $("cc-sms-btn").style.display = c.phone ? "inline-flex" : "none";

  const history = st.sales.sort((a,b)=>b.date>a.date?1:-1).slice(0,10);
  if ($("cc-history")) {
    if (!history.length) {
      $("cc-history").innerHTML = `<div style="text-align:center;color:#ccc;padding:20px;font-size:13px">Xarid tarixi yo'q</div>`;
    } else {
      $("cc-history").innerHTML = history.map(s => {
        const isDebt = s.status !== "qaytarilgan" && calcSaleState(s).remaining > 0.5;
        return `<div style="padding:10px 12px;border-radius:10px;margin-bottom:6px;
          background:${isDebt?"#FEF2F2":"var(--bg)"};border:1px solid ${isDebt?"#FECACA":"var(--brd)"}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <span style="font-weight:700;font-size:13px">${fmt(s.total)} so'm</span>
            <span style="font-size:11px;color:#aaa">${s.date} ${s.time||""}</span>
          </div>
          <div style="font-size:12px;color:#666;margin-bottom:4px">${s.items?.map(i=>i.name+" \xd7"+i.qty).join(", ")||"—"}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <span class="bg" style="font-size:10.5px">${s.payType||"naqd"}</span>
            ${isDebt
              ? `<span class="bg bg-r" style="font-size:10.5px">Qarz: ${s.debtCurrency==="usd"&&s.debtUsd?"$"+s.debtUsd.toFixed(2)+" USD":fmt(s.remaining)+" so'm"}</span>`
              : `<span class="bg bg-g" style="font-size:10.5px">To'langan</span>`}
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
  if ($("ac-name"))       $("ac-name").value       = c.name;
  if ($("ac-phone"))      $("ac-phone").value      = c.phone || "";
  if ($("ac-type"))       $("ac-type").value       = c.type  || "ulgurji";
  if ($("ac-company"))    $("ac-company").value    = c.company || "";
  if ($("ac-note"))       $("ac-note").value       = c.note  || "";
  const limitEl = $("ac-debt-limit");
  if (limitEl) {
    limitEl.dataset.raw = c.debtLimit || 0;
    limitEl.value = c.debtLimit ? fmt(c.debtLimit) : "";
  }
  const h2 = document.querySelector("#ov-addcust h2");
  if (h2) h2.textContent = "Mijozni tahrirlash";
  const btn = document.querySelector("#ov-addcust .btn-acc");
  if (btn) { btn.innerHTML = '<i class="ti ti-check"></i> Saqlash'; btn.onclick = () => editCustomer(_custCardId); }
  openModal("addcust");
}

function editCustomer(id) {
  const c = db.customers.find(x => x.id === id);
  if (!c) return;
  c.name      = ($("ac-name")||{value:""}).value.trim()  || c.name;
  c.phone     = ($("ac-phone")||{value:""}).value.trim() || c.phone;
  c.type      = ($("ac-type")||{value:""}).value         || c.type;
  c.note      = ($("ac-note")||{value:""}).value.trim();
  c.company   = ($("ac-company")||{value:""}).value.trim();
  const limitRaw = getRawVal("ac-debt-limit");
  c.debtLimit = limitRaw > 0 ? limitRaw : null;
  saveDB(); renderMijozlar(); closeModal("addcust");
  toast("Mijoz ma'lumotlari yangilandi");
  const btn = document.querySelector("#ov-addcust .btn-acc");
  if (btn) { btn.textContent = "Saqlash"; btn.onclick = addCustomer; }
}

// ── Yangi mijoz qo'shish ──────────────────────────
function addCustomer() {
  const name  = ($("ac-name")||{value:""}).value.trim();
  const phone = ($("ac-phone")||{value:""}).value.trim();
  if (!name) { toast("Ism kiriting","err"); return; }

  const existing = db.customers.find(c =>
    c.name.toLowerCase() === name.toLowerCase() ||
    (phone && c.phone === phone)
  );
  if (existing) { toast(`"${existing.name}" allaqachon ro'yxatda`,"err"); return; }

  const limitRaw = getRawVal("ac-debt-limit");
  const nc = {
    id:        db.seq++,
    name,
    phone:     phone || "",
    type:      ($("ac-type")||{value:"ulgurji"}).value,
    company:   ($("ac-company")||{value:""}).value.trim(),
    note:      ($("ac-note")||{value:""}).value.trim(),
    debtLimit: limitRaw > 0 ? limitRaw : null
  };
  db.customers.push(nc);
  saveDB(); renderMijozlar(); closeModal("addcust");
  toast(`✅ "${name}" qo'shildi`);
  ["ac-name","ac-phone","ac-note","ac-company","ac-debt-limit"].forEach(id => { if ($(id)) $(id).value = ""; });
}
