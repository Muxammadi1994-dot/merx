// MERX mijozlar.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/mijozlar.js  (v2 — To'liq mijoz tizimi)
// ================================================

let custFilter = "all";
let _custCardId = null;

// ── Ustunlar boshqaruvi ───────────────────────────
const CUST_KPI_LABELS = {
  total:    "Jami mijozlar",
  ulg:      "Ulgurji",
  chak:     "Chakana",
  debt:     "Qarzli mijozlar",
  debtSum:  "Jami qarz summasi",
  vip:      "⭐ VIP mijozlar",
};

function hideCustKpi(key) {
  if (!db.settings) db.settings={};
  const h=new Set(db.settings.hiddenCustKpis||[]);
  h.add(key); db.settings.hiddenCustKpis=[...h]; saveDB(); applyCustKpiVisibility();
}
function showCustKpi(key) {
  if (!db.settings) db.settings={};
  const h=new Set(db.settings.hiddenCustKpis||[]);
  h.delete(key); db.settings.hiddenCustKpis=[...h]; saveDB(); applyCustKpiVisibility();
}
function applyCustKpiVisibility() {
  const hidden=new Set(db.settings?.hiddenCustKpis||[]);
  document.querySelectorAll("#cust-kpi-row .stb").forEach(el=>{
    el.style.display=hidden.has(el.dataset.ckpi)?"none":"block";
  });
}
function openCustKpiSettings() {
  const hidden=new Set(db.settings?.hiddenCustKpis||[]);
  const list=$("cust-kpi-list"); if(!list) return;
  list.innerHTML=Object.entries(CUST_KPI_LABELS).map(([k,l])=>`
    <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--brd);border-radius:9px;cursor:pointer">
      <input type="checkbox" ${!hidden.has(k)?"checked":""} onchange="this.checked?showCustKpi('${k}'):hideCustKpi('${k}')"
        style="width:17px;height:17px;accent-color:var(--acc);cursor:pointer">
      <span style="font-size:13px;font-weight:600">${l}</span>
    </label>`).join("");
  openModal("custkpi");
}

const CUST_COL_DEFS = [
  { key:"name",      lbl:"Ism",            def:true  },
  { key:"phone",     lbl:"Telefon",        def:true  },
  { key:"segment",   lbl:"Segment",        def:true  },
  { key:"count",     lbl:"Sotuvlar soni",  def:true  },
  { key:"totalBuy",  lbl:"Jami xarid",     def:true  },
  { key:"avgCheck",  lbl:"O'rtacha chek",  def:true  },
  { key:"lastDate",  lbl:"Oxirgi xarid",   def:true  },
  { key:"debt",      lbl:"Joriy qarz",     def:true  },
  { key:"debtLimit", lbl:"Qarz limiti",    def:false },
  { key:"company",   lbl:"Kompaniya",      def:false },
];

function getCustCols() {
  const saved = db.settings?.custCols || {};
  const cols = {};
  CUST_COL_DEFS.forEach(c => { cols[c.key] = c.key in saved ? saved[c.key] : c.def; });
  // ⚠️ 2026-08-02: RUXSAT QATLAMI — `db.settings` GA TEGILMAYDI.
  // Sozlama egasiniki va bulutga sinxronlanadi. Ruxsat esa xodim
  // yozuvida. Ustun ko'rinadi = sozlamada yoqilgan VA ruxsatda
  // yashirilmagan. Egasi kirsa cheklov umuman ishlamaydi.
  try {
    if (typeof permSee === "function") {
      ["totalBuy","avgCheck","debt","debtLimit"].forEach(k => {
        if (!permSee("mijozlar", k)) cols[k] = false;
      });
    }
  } catch(e) {}
  return cols;
}

function openCustColsSettings() {
  const cols = getCustCols();
  const list = $("cust-cols-list"); if (!list) return;
  list.innerHTML = CUST_COL_DEFS.map(c => `
    <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--brd);border-radius:9px;cursor:pointer">
      <input type="checkbox" ${cols[c.key]?"checked":""} onchange="toggleCustCol('${c.key}',this.checked)"
        style="width:17px;height:17px;accent-color:var(--acc);cursor:pointer">
      <span style="font-size:13px;font-weight:600">${c.lbl}</span>
    </label>`).join("");
  openModal("custcols");
}

function toggleCustCol(key, val) {
  if (!db.settings) db.settings = {};
  if (!db.settings.custCols) db.settings.custCols = {};
  db.settings.custCols[key] = val;
  saveDB(); renderMijozlar();
}


function setCustFilter(f) {
  try { mjResetLimit(); } catch(e) {}
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

// ══════════════════════════════════════════════════════════════
// custStats — TEZLIK TUZATISHI (2026-07-31)
// ══════════════════════════════════════════════════════════════
// AVVAL: filtr ichida `db.customers.find(...)` bor edi — ya'ni HAR
// SOTUV uchun BARCHA mijozlar aylanardi. 874 sotuv × 856 mijoz =
// 750 000 amal, bitta mijoz uchun. Sahifa esa buni har mijoz uchun
// bir necha marta chaqiradi → milliardlab amal, ilova qotib qolardi.
// Kichik do'konda sezilmagan (3 mijoz, 88 tovar).
//
// TUZATISH: mijozni BIR MARTA topamiz (natija bir xil — u yerda
// aslida "shu mijozning ismi shu sotuvdagi ism bilan bir xilmi"
// degan tekshiruv bor edi, xolos), va natijani keshlaymiz.
let _csCache = new Map(), _csStamp = "";
function _csStampNow() {
  return (db.sales?.length || 0) + "/" + (db.customers?.length || 0) +
         "/" + (db.debtPayments?.length || 0);
}
// Ma'lumot o'zgarganda keshni tozalash uchun (render boshida chaqiriladi)
function custStatsClear() { _csCache.clear(); _csStamp = ""; }

function custStats(custId) {
  const st = _csStampNow();
  if (st !== _csStamp) { _csCache.clear(); _csStamp = st; }
  if (_csCache.has(custId)) return _csCache.get(custId);
  const _res = _custStatsCalc(custId);
  _csCache.set(custId, _res);
  return _res;
}

function _custStatsCalc(custId) {
  const _me   = db.customers.find(c => c.id === custId);
  const _name = _me ? _me.name : null;
  const allSales = db.sales.filter(s =>
    s.customerId === custId ||
    (_name && s.customerName === _name)
  );
  // Qaytarilmaganlar — xarid statistikasi uchun
  const sales    = allSales.filter(s => s.status !== "qaytarilgan");
  const returned = allSales.filter(s => s.status === "qaytarilgan");

  const totalBuy   = sales.reduce((a, s) => a + (s.total || 0), 0);
  const avgCheck   = sales.length ? Math.round(totalBuy / sales.length) : 0;

  // Qarz holati — calcSaleState orqali (to'g'ri, to'lovlar hisobga olingan)
  const debtList = sales
    .map(s => ({ sale: s, state: calcSaleState(s) }))
    .filter(x => x.state.remaining > 0.5);
  const totalDebt    = debtList.filter(x => x.sale.debtCurrency !== "usd")
    .reduce((a,x) => a + x.state.remaining, 0);
  const totalDebtUsd = debtList.filter(x => x.sale.debtCurrency === "usd" && x.state.debtUsd)
    .reduce((a,x) => a + x.state.debtUsd, 0);

  const lastSale  = [...allSales].sort((a, b) => b.date > a.date ? 1 : -1)[0];
  const firstSale = [...allSales].sort((a, b) => a.date > b.date ? 1 : -1)[0];

  // Top tovar
  const itemMap = {};
  sales.forEach(s => s.items?.forEach(i => {
    itemMap[i.name] = (itemMap[i.name]||0) + (i.qty||0);
  }));
  const topItem = Object.entries(itemMap).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;

  // Qarz to'lovlari
  const debtPayments = activePays().filter(p => allSales.some(s => s.id === p.saleId));
  const debtPayCount = debtPayments.length;
  const debtPaidSum  = debtPayments.reduce((a,p)=>a+(p.currency==="usd"
    ?Math.round(p.amount*(db.settings?.rate||12800)):(p.amount||0)),0);

  const daysSinceLastBuy = lastSale?.date
    ? Math.round((new Date() - new Date(lastSale.date)) / 86400000)
    : null;

  return {
    count: sales.length,          // qaytarilganlar chiqarilgan
    returnCount: returned.length, // qaytarilganlar soni
    totalBuy, avgCheck,
    totalDebt, totalDebtUsd,
    lastDate:  lastSale?.date  || null,
    firstDate: firstSale?.date || null,
    topItem, debtPayCount, debtPaidSum, daysSinceLastBuy,
    sales, allSales, debtPayments
  };
}

// ── Render jadval ─────────────────────────────────
let _custSortKey = null;
let _custSortAsc = true;

function custSortToggle(key) {
  if (_custSortKey === key) { _custSortAsc = !_custSortAsc; }
  else { _custSortKey = key; _custSortAsc = key === "name"; }
  renderMijozlar();
}

// ── Sahifalash (2026-07-31) ───────────────────────────────────
// AVVAL: barcha mijozlar (847 ta) birdan chizilardi, har qatorda
// custStats + custSegment hisobi bor. Ro'yxat o'sgani sari
// sekinlashardi. Endi 100 tadan chiziladi.
let _mjPage = 1;
function mjGoPage(p) { _mjPage = p; renderMijozlar(); pagerScrollTop("p-mijozlar"); }
function mjResetLimit() { _mjPage = 1; }

function renderMijozlar() {
  // 2026-07-31: kesh tozalanadi — sahifa doim yangi ma'lumot ko'rsatsin
  try { custStatsClear(); } catch(e) {}
  // Tug'ilgan kun eslatmasi — bugun va yaqin 3 kun
  checkBirthdayAlerts();
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
  // 2026-08-02: ko'p parametrli qidiruv (utils.js → srchMatcher)
  if (q) {
    const _m = srchMatcher(q);
    list = list.filter(c => _m(c.name, c.phone, c.phone2, c.note, c.company));
  }

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
  } else {
    list.reverse(); // v145 (№13): standartda YANGI mijoz tepada
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
  applyCustKpiVisibility();

  const cols = getCustCols();

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
      <th style="width:36px"><input type="checkbox" onclick="selectAllCusts()" style="width:15px;height:15px;cursor:pointer"></th>
      ${cols.name     ? `<th style="cursor:pointer;user-select:none" onclick="custSortToggle('name')">ISM ${si('name')}</th>` : ""}
      ${cols.phone    ? `<th>TELEFON</th>` : ""}
      ${cols.segment  ? `<th>SEGMENT</th>` : ""}
      ${cols.count    ? `<th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('count')">SOTUVLAR ${si('count')}</th>` : ""}
      ${cols.totalBuy ? `<th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('totalBuy')">JAMI XARID ${si('totalBuy')}</th>` : ""}
      ${cols.avgCheck ? `<th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('avgCheck')">O'RTACHA CHEK ${si('avgCheck')}</th>` : ""}
      ${cols.lastDate ? `<th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('lastDate')">OXIRGI XARID ${si('lastDate')}</th>` : ""}
      ${cols.debt      ? `<th class="num" style="cursor:pointer;user-select:none" onclick="custSortToggle('debt')">JORIY QARZ ${si('debt')}</th>` : ""}
      ${cols.debtLimit ? `<th class="num">QARZ LIMITI</th>` : ""}
      ${cols.company   ? `<th>KOMPANIYA</th>` : ""}
      <th></th>
    </tr>`;
  }

  const colCount = Object.values(cols).filter(Boolean).length + 2;
  // 2026-07-31: faqat birinchi _mjLimit ta chiziladi. Yuqoridagi
  // jamlanma raqamlar TO'LIQ ro'yxatdan hisoblanadi — o'zgarmadi.
  // 2026-08-02: EKSPORT uchun yakuniy ro'yxat (sahifalashdan OLDIN)
  try { setExportList("mijozlar", list); } catch(e) {}
  const _mjTotal = list.length;
  _mjPage = clampPage(_mjPage, _mjTotal);
  const _mjMore = pagerRow(colCount, _mjTotal, _mjPage, "mjGoPage", "mijoz");
  $("mijozlar-body").innerHTML = list.length ? pageSlice(list, _mjPage).map(c => {
    const st  = custStats(c.id);
    const seg = custSegment(st, c);
    const limitWarn = c.debtLimit && (st.totalDebt+(st.totalDebtUsd||0)*(db.settings?.rate||12800)) >= c.debtLimit * 0.8;
    return `<tr style="cursor:pointer${limitWarn?' background:#FFF7F7':''}" onclick="openCustCard(${c.id})">
      <td onclick="event.stopPropagation()" style="width:36px">
        <input type="checkbox" data-cust-check="${c.id}" ${_selectedCusts.has(c.id)?"checked":""}
          onclick="toggleCustSelect(${c.id})"
          style="width:15px;height:15px;accent-color:var(--acc);cursor:pointer">
      </td>
      ${cols.name    ? `<td><div style="font-weight:600;font-size:13.5px">${c.name}</div>${c.company&&!cols.company?`<div style="font-size:11px;color:#aaa">${c.company}</div>`:""}</td>` : ""}
      ${cols.phone   ? `<td style="font-size:12.5px">
        ${c.phone?`<a href="tel:${c.phone}" onclick="event.stopPropagation()" style="color:inherit">${c.phone}</a>`:`<span style="color:#ccc">—</span>`}
        ${c.phone2?`<div style="font-size:11px;color:#4C9BE8"><a href="tel:${c.phone2}" onclick="event.stopPropagation()" style="color:#4C9BE8">${c.phone2}</a></div>`:""}
      </td>` : ""}
      ${cols.segment ? `<td>
        <span class="bg" style="font-size:11px;background:${seg.bg};color:${seg.color};font-weight:600">${seg.label}</span>
        ${c.debtLimit?`<div style="font-size:10px;color:${limitWarn?"var(--red)":"#bbb"};margin-top:2px">Limit: ${fmtK(c.debtLimit)}${limitWarn?" ⚠️":""}</div>`:""}
      </td>` : ""}
      ${cols.count    ? `<td class="num" style="font-weight:600">${st.count}</td>` : ""}
      ${cols.totalBuy ? `<td class="num" style="font-size:12.5px">${st.totalBuy?fmtK(st.totalBuy)+" so'm":"—"}</td>` : ""}
      ${cols.avgCheck ? `<td class="num" style="font-size:12.5px;color:var(--mut)">${st.avgCheck?fmtK(st.avgCheck)+" so'm":"—"}</td>` : ""}
      ${cols.lastDate ? `<td class="num" style="font-size:12px;color:#aaa">
        ${st.daysSinceLastBuy!==null
          ? st.daysSinceLastBuy===0?"<span style='color:var(--grn)'>Bugun</span>"
          : st.daysSinceLastBuy<=7?`<span style='color:var(--grn)'>${st.daysSinceLastBuy} kun</span>`
          : st.daysSinceLastBuy<=30?`${st.daysSinceLastBuy} kun`
          : `<span style='color:#E9A500'>${st.lastDate}</span>`
          : "—"}
      </td>` : ""}
      ${cols.debt ? `<td class="num">
        ${(st.totalDebt>0||st.totalDebtUsd>0)
          ? `<span style="color:var(--red);font-weight:700;font-size:13px">${
              st.totalDebtUsd>0&&st.totalDebt>0?fmtUsd(st.totalDebtUsd)+" + "+fmt(st.totalDebt)+" so'm"
              :st.totalDebtUsd>0?fmtUsd(st.totalDebtUsd)+" USD"
              :fmt(st.totalDebt)+" so'm"}</span>`
          : `<span style="color:var(--grn);font-size:12px">✅</span>`}
      </td>` : ""}
      ${cols.debtLimit ? `<td class="num" style="font-size:12px">
        ${c.debtLimit ? (() => {
          const cur = st.totalDebt+(st.totalDebtUsd||0)*(db.settings?.rate||12800);
          const pct = Math.min(100,Math.round(cur/c.debtLimit*100));
          const color = pct>=100?"var(--red)":pct>=80?"#E9A500":"var(--mut)";
          return `<div style="color:${color};font-weight:600">${fmtK(c.debtLimit)} so'm</div>
            <div style="font-size:10px;color:${color}">${pct}% ishlatilgan</div>`;
        })() : `<span style="color:#ccc">—</span>`}
      </td>` : ""}
      ${cols.company ? `<td style="font-size:12px;color:#666">${c.company||"—"}</td>` : ""}
      <td onclick="event.stopPropagation()" style="white-space:nowrap">
        <div style="display:inline-flex;align-items:center;gap:8px">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="_custCardId=${c.id};custCardEdit()"
            title="Tahrirlash"><i class="ti ti-edit"></i></button>
          <!-- 2026-07-26: daftardagi ESKI QARZNI kiritish -->
          <button class="btn btn-ghost btn-icon btn-sm" onclick="openOldDebt(${c.id})"
            title="Eski qarz qo'shish (daftardan)" style="color:var(--acc)">
            <i class="ti ti-notebook"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join("") + _mjMore : `<tr><td colspan="${colCount}" class="empty-td">
    ${custFilter!=="all"?"Bu filtrda mijoz yo'q":q?`"${q}" topilmadi`:"Mijoz yo'q"}
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
  if ($("cc-phone")) $("cc-phone").innerHTML   = c.phone
    ? `<a href="tel:${c.phone}" style="color:inherit">${c.phone}</a>${c.phone2?` · <a href="tel:${c.phone2}" style="color:#4C9BE8">${c.phone2}</a>`:""}`
    : "Telefon yo'q";
  if ($("cc-note"))  $("cc-note").textContent  = c.note  || "";

  const badge = $("cc-type-badge");
  if (badge) {
    badge.textContent      = seg.label;
    badge.style.background = seg.bg;
    badge.style.color      = seg.color;
  }

  if ($("cc-sales-cnt"))  $("cc-sales-cnt").textContent  = st.count+" ta sotuv"+(st.returnCount?` (${st.returnCount} ta qaytarilgan)`:"");
  if ($("cc-total-buy"))  $("cc-total-buy").textContent  = st.totalBuy ? fmtK(st.totalBuy)+" so'm" : "0";
  if ($("cc-avg-check"))  $("cc-avg-check").textContent  = st.avgCheck ? fmtK(st.avgCheck)+" so'm" : "—";
  if ($("cc-top-item"))   $("cc-top-item").textContent   = st.topItem || "—";
  if ($("cc-first-date")) $("cc-first-date").textContent = st.firstDate || "—";
  if ($("cc-last-date"))  $("cc-last-date").textContent  = st.daysSinceLastBuy !== null
    ? (st.daysSinceLastBuy === 0 ? "Bugun" : st.daysSinceLastBuy+" kun oldin") : "—";

  const debtEl = $("cc-debt");
  if (debtEl) {
    if (!st.totalDebt && !st.totalDebtUsd) {
      debtEl.textContent = "Qarz yo'q ✅"; debtEl.style.color = "var(--grn)";
    } else {
      const parts = [];
      if (st.totalDebtUsd > 0) parts.push(fmtUsd(st.totalDebtUsd)+" USD");
      if (st.totalDebt > 0)    parts.push(fmt(st.totalDebt)+" so'm");
      debtEl.textContent = parts.join(" + "); debtEl.style.color = "var(--red)";
    }
  }

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
      const parts=[]; if(bUsd>0) parts.push(fmtUsd(bUsd)); if(bUzs>0) parts.push(fmt(bUzs)+" so'm");
      if ($("cc-balance")) $("cc-balance").textContent = parts.join(" + ");
      balBlock.style.display = "flex";
    } else { balBlock.style.display = "none"; }
  }

  if ($("cc-sms-btn")) $("cc-sms-btn").style.display = c.phone ? "inline-flex" : "none";

  // Muhim qayд
  const impBlock = $("cc-important-note-block");
  const impEl    = $("cc-important-note");
  if (impBlock && impEl) {
    if (c.importantNote) {
      impEl.textContent       = c.importantNote;
      impBlock.style.display  = "flex";
    } else { impBlock.style.display = "none"; }
  }

  // Qo'shimcha info: tug'ilgan kun, manba, sodiqlik ballari
  const extraEl = $("cc-extra-info");
  if (extraEl) {
    const chips = [];
    if (c.birthday) {
      const [, m, d] = c.birthday.split("-");
      const months = ["","Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
      const today = new Date(); const bDay = new Date(today.getFullYear(), +m-1, +d);
      const diff = Math.round((bDay - today) / 86400000);
      const soon = diff >= 0 && diff <= 7;
      const bdayLabel = soon ? ` (${diff===0?"Bugun!":diff+" kun qoldi"})` : "";
      const bdayStyle = soon ? "background:#FEF3C7;color:#D97706;font-weight:700" : "";
      chips.push(`<span class="bg" style="font-size:11.5px;${bdayStyle}">🎂 ${d} ${months[+m]}${bdayLabel}</span>`);
    }
    if (c.source) {
      const src = {"do'kon":"🏪 Do'konga kelib", telegram:"📱 Telegram", instagram:"📸 Instagram", tavsiya:"🤝 Tavsiya", boshqa:"Boshqa"};
      chips.push(`<span class="bg" style="font-size:11.5px">Manba: ${src[c.source]||c.source}</span>`);
    }
    const pts = c.loyaltyPoints || 0;
    if (pts > 0) {
      chips.push(`<span class="bg" style="font-size:11.5px;background:#F0FDF4;color:var(--grn);font-weight:700">
        ⭐ ${pts} ball
      </span>`);
    }
    extraEl.innerHTML = chips.join("") || "";
  }

  // Xarid tarixi — sotuvlar + qarz to'lovlari birlashtirilgan, to'g'ri holat
  const history = st.allSales.sort((a,b)=>b.date>a.date?1:-1).slice(0,15);
  if ($("cc-history")) {
    if (!history.length) {
      $("cc-history").innerHTML = `<div style="text-align:center;color:#ccc;padding:20px;font-size:13px">Xarid tarixi yo'q</div>`;
    } else {
      $("cc-history").innerHTML = history.map(s => {
        const state  = calcSaleState(s);
        const isDebt = state.remaining > 0.5 && s.status !== "qaytarilgan";
        const isRet  = s.status === "qaytarilgan";
        const pays   = st.debtPayments.filter(p => p.saleId === s.id);
        const paid   = state.paid;
        return `<div style="padding:10px 12px;border-radius:10px;margin-bottom:6px;
          background:${isRet?"#F8F8F8":isDebt?"#FEF2F2":"var(--bg)"};
          border:1px solid ${isRet?"#e0e0e0":isDebt?"#FECACA":"var(--brd)"}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <span style="font-weight:700;font-size:13px${isRet?";text-decoration:line-through;color:#aaa":""}">${fmt(s.total)} so'm</span>
            <span style="font-size:11px;color:#aaa">${s.date} ${s.time||""}</span>
          </div>
          <div style="font-size:12px;color:#666;margin-bottom:4px">${s.items?.map(i=>i.name+" ×"+i.qty).join(", ")||"—"}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:${pays.length?"5px":"0"}">
            <span class="bg" style="font-size:10.5px">${s.payType||"naqd"}</span>
            ${isRet?`<span class="bg" style="font-size:10.5px;background:#f0f0f0;color:#888">Qaytarilgan</span>`
              :isDebt?`<span class="bg bg-r" style="font-size:10.5px">Qarz qoldi: ${state.debtUsd>0?fmtUsd(state.debtUsd)+" USD":fmt(state.remaining)+" so'm"}</span>`
              :`<span class="bg bg-g" style="font-size:10.5px">✅ To'langan</span>`}
          </div>
          ${pays.length?`<div style="border-top:1px dashed #eee;padding-top:5px">
            ${pays.map(p=>`<div style="display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:2px">
              <span>💰 To'lov${p.method?` · ${p.method}`:""}${p.date?" · "+p.date:""}:</span>
              <span style="font-weight:700;color:var(--grn)">+${p.currency==="usd"?fmtUsd(p.amount)+" USD":fmt(p.amount)+" so'm"}</span>
            </div>`).join("")}
          </div>`:""}
        </div>`;
      }).join("");
    }
  }
  openModal("custcard");
}
// ── Kartochkadan SMS ──────────────────────────────
async function custCardSms() {
  const c = db.customers.find(x => x.id === _custCardId);
  if (!c) return;
  const st = custStats(c.id);
  const shopName = db.settings?.shopName || db.shop?.name || "MERX";
  const debtTxt = st.totalDebtUsd>0&&st.totalDebt>0
    ? `${fmtUsd(st.totalDebtUsd)} USD + ${fmt(st.totalDebt)} so'm`
    : st.totalDebtUsd>0 ? `${fmtUsd(st.totalDebtUsd)} USD`
    : st.totalDebt>0 ? `${fmt(st.totalDebt)} so'm` : "";
  const defMsg = debtTxt
    ? `${shopName}: Hurmatli ${c.name}, jami qarzingiz: ${debtTxt}. Iltimos to'lovni amalga oshiring.`
    : `${shopName}: Hurmatli ${c.name}, siz bilan hamkorlik qilishdan mamnunmiz!`;

  const hasSms = !!c.phone;
  const hasBot = !!(db.settings?.telegramBotUrl);

  // Modal ochib kanal tanlaymiz
  const modal = document.createElement("div");
  modal.className = "ov"; modal.id = "cust-msg-modal";
  modal.style.cssText = "display:flex";
  modal.innerHTML = `
    <div class="modal" style="max-width:440px">
      <button class="m-close" onclick="$('cust-msg-modal').remove()"><i class="ti ti-x"></i></button>
      <h2 style="margin-bottom:4px"><i class="ti ti-message"></i> Xabar yuborish</h2>
      <p style="font-size:13px;color:var(--mut);margin-bottom:10px">Mijoz: <b>${c.name}</b></p>
      <div style="display:flex;gap:5px;margin-bottom:10px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="setCustMsgTemplate('debt','${c.id}')">💳 Qarz eslatma</button>
        <button class="btn btn-ghost btn-sm" onclick="setCustMsgTemplate('promo','${c.id}')">🎁 Aksiya</button>
        <button class="btn btn-ghost btn-sm" onclick="setCustMsgTemplate('greet','${c.id}')">👋 Salom</button>
      </div>
      <div class="fld">
        <label>Xabar matni</label>
        <textarea id="cust-msg-text" rows="4"
          style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);
          padding:8px 12px;width:100%;resize:vertical;box-sizing:border-box">${defMsg}</textarea>
        <div style="font-size:11.5px;color:var(--mut);margin-top:4px">💡 <b>{ism}</b> — ism, <b>{qarz}</b> — qarz summasi</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        ${hasSms ? `<button class="btn btn-acc" style="flex:1" onclick="sendCustMsg('sms')">
          <i class="ti ti-message"></i> SMS<br>
          <span style="font-size:11px;font-weight:400">${c.phone}</span>
        </button>` : `<button class="btn btn-ghost" style="flex:1;opacity:.4" disabled>
          <i class="ti ti-message"></i> SMS<br><span style="font-size:11px">Telefon yo'q</span>
        </button>`}
        ${c.phone2 ? `<button class="btn" style="flex:1;background:#E0F2FE;color:#0E7490;border:1.5px solid #7DD3FC" onclick="sendCustMsg('sms2')">
          <i class="ti ti-message"></i> SMS 2<br>
          <span style="font-size:11px;font-weight:400">${c.phone2}</span>
        </button>` : ""}
        ${hasBot ? `<button class="btn" style="flex:1;background:#EFF6FF;color:#3B82F6;border:1.5px solid #93C5FD" onclick="sendCustMsg('bot')">
          <i class="ti ti-brand-telegram"></i> Bot<br>
          <span style="font-size:11px;font-weight:400">Telegram</span>
        </button>` : `<button class="btn btn-ghost" style="flex:1;opacity:.4" disabled title="Sozlamalarda bot URL kiriting">
          <i class="ti ti-brand-telegram"></i> Bot<br><span style="font-size:11px">Ulanmagan</span>
        </button>`}
      </div>
    </div>`;
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  document.body.appendChild(modal);
  setTimeout(()=>{ const t=$("cust-msg-text"); if(t){t.focus();t.select();} },50);
}

function setCustMsgTemplate(type, custId) {
  const c = db.customers.find(x=>x.id==custId); if(!c) return;
  const shop = db.settings?.shopName || db.shop?.name || "Do'kon";
  const st = custStats(c.id);
  const debtTxt = st.totalDebtUsd>0?`${fmtUsd(st.totalDebtUsd)} USD`:st.totalDebt>0?`${fmt(st.totalDebt)} so'm`:"0";
  const templates = {
    debt:  `${shop}: Hurmatli ${c.name}, joriy qarzingiz ${debtTxt}. Iltimos to'lovni amalga oshiring. Rahmat!`,
    promo: `${shop}: Hurmatli ${c.name}, yangi mahsulotlar va maxsus chegirmalar mavjud! Siz bilan hamkorlik qilishdan mamnunmiz.`,
    greet: `${shop}: Hurmatli ${c.name}, siz bilan hamkorlik qilishdan mamnunmiz! Yangi kolleksiyamiz bilan tanishib chiqishingizni taklif etamiz.`
  };
  const el = $("cust-msg-text"); if(el) el.value = templates[type]||"";
}

async function sendCustMsg(channel) {
  const c = db.customers.find(x => x.id === _custCardId); if(!c) return;
  const text = ($("cust-msg-text")||{value:""}).value.trim();
  if (!text) { toast("Xabar matnini kiriting","err"); return; }

  $("cust-msg-modal")?.remove();

  if (channel === "sms") {
    await sendSms(c.phone, text);
    toast(`📲 SMS yuborildi: ${c.name}`);
  } else if (channel === "sms2") {
    await sendSms(c.phone2, text);
    toast(`📲 SMS (qo'shimcha) yuborildi: ${c.name}`);
  } else if (channel === "bot") {
    const res = await sendTelegramText(c.id, c.phone, text);
    if (!res?.sent) toast("Bot: mijoz botga ulanmagan yoki xato","err");
  }
}

// ── Kartochkadan tahrirlash ───────────────────────
function custCardEdit() {
  const c = db.customers.find(x => x.id === _custCardId);
  if (!c) return;
  closeModal("custcard");
  if ($("ac-name"))           $("ac-name").value           = c.name;
  if ($("ac-phone"))          { $("ac-phone").value=""; phoneWidgetLoad("ac-phone", c.phone||""); }
  if ($("ac-phone2"))         { $("ac-phone2").value=""; phoneWidgetLoad("ac-phone2", c.phone2||""); }
  if ($("ac-type"))           $("ac-type").value           = c.type          || "ulgurji";
  if ($("ac-company"))        $("ac-company").value        = c.company       || "";
  if ($("ac-note"))           $("ac-note").value           = c.note          || "";
  if ($("ac-birthday"))       $("ac-birthday").value       = c.birthday      || "";
  if ($("ac-important-note")) $("ac-important-note").value = c.importantNote || "";
  if ($("ac-source"))         $("ac-source").value         = c.source        || "";
  const limitEl = $("ac-debt-limit");
  if (limitEl) { limitEl.dataset.raw = c.debtLimit||0; limitEl.value = c.debtLimit ? fmt(c.debtLimit) : ""; }
  const h2 = document.querySelector("#ov-addcust h2");
  if (h2) h2.textContent = "Mijozni tahrirlash";
  const btn = document.querySelector("#ov-addcust .btn-acc");
  if (btn) { btn.innerHTML = '<i class="ti ti-check"></i> Saqlash'; btn.onclick = () => editCustomer(_custCardId); }
  openModal("addcust");
}

function editCustomer(id) {
  const c = db.customers.find(x => x.id === id);
  if (!c) return;
  const newName = ($("ac-name")||{value:""}).value.trim();
  if (!newName) { toast("Ism bo'sh bo'lmasin","err"); return; }
  c.name      = newName;
  c.phone     = phoneFullVal("ac-phone") || ($("ac-phone")||{value:""}).value.trim();
  c.phone2    = phoneFullVal("ac-phone2") || ($("ac-phone2")||{value:""}).value.trim();
  c.type      = ($("ac-type")||{value:""}).value || c.type;
  c.note         = ($("ac-note")||{value:""}).value.trim();
  c.company      = ($("ac-company")||{value:""}).value.trim();
  c.birthday     = ($("ac-birthday")||{value:""}).value;
  c.importantNote= ($("ac-important-note")||{value:""}).value.trim();
  c.source       = ($("ac-source")||{value:""}).value;
  const limitRaw = getRawVal("ac-debt-limit");
  c.debtLimit = limitRaw > 0 ? limitRaw : null;
  // ⚠️ 2026-08-02: BELGI TAHRIRLASH PAYTIDA QO'YILADI.
  // Avval `updatedAt` faqat PUSH paytida qo'yilardi. Tortishda esa
  // shu belgi solishtiriladi: lokal yangiroq bo'lsa lokal g'olib.
  // Natijada kim TAHRIRLAGANI emas, kim OXIRGI YUBORGANI hal
  // qilardi — eski telefoni bo'lgan qurilma yangi raqamni bosib
  // yozardi va tahrir yo'qolardi (POS qidiruvida topilmasdi).
  c.updatedAt = new Date().toISOString();
  saveDB(); renderMijozlar(); closeModal("addcust");
  // 2026-08-02: POS'da shu mijoz tanlangan bo'lsa — kartasi yangilanadi
  try { if (typeof posRefreshCustCard === "function") posRefreshCustCard(); } catch(e) {}
  toast("✅ Mijoz ma'lumotlari yangilandi");
  resetCustForm(); // maydonlar + sarlavha + tugma to'liq tozalanadi
}

// ── Yangi mijoz qo'shish ──────────────────────────
// ── Mijoz o'chirish ───────────────────────────────
function deleteCust(id) {
  if (typeof requireUse === "function" && !requireUse("mijozlar")) return;

  const c = db.customers.find(x => x.id === id); if (!c) return;
  const st = custStats(id);

  // Qarzlarini tekshiramiz
  const openDebts = (db.sales||[]).filter(s =>
    s.customerId === id && s.status === "qarz" &&
    (typeof calcSaleState === "function" ? calcSaleState(s).remaining > 0 : s.remaining > 0)
  );

  // ── 2026-08-01: QARZDOR MIJOZ O'CHIRILMAYDI ──────────────────
  // AVVAL: ogohlantirardi, lekin tasdiqlansa O'CHIRARDI. Natijada
  // mijoz yo'qolib, uning qarzlari `sales` da YETIM qolardi —
  // Qarzlar sahifasida turaveradi, lekin mijozi yo'q, to'lov ham
  // qabul qilib bo'lmaydi. B20 da aynan shu bo'lgan.
  // ENDI: taqiqlanadi. Avval qarz yopilishi kerak.
  if (openDebts.length > 0) {
    const totalDebt = openDebts.reduce((a, s) =>
      a + (typeof calcSaleState === "function" ? calcSaleState(s).remaining : s.remaining||0), 0);
    alert(`⛔ "${c.name}" — o'chirib bo'lmaydi\n\n` +
          `${openDebts.length} ta yopilmagan qarz bor.\n` +
          `Jami: ${Math.round(totalDebt).toLocaleString("ru-RU")} so'm\n\n` +
          `Avval qarzni yoping yoki bekor qiling, keyin o'chiring.`);
    return;
  }
  if (st.count > 0) {
    if (!confirm(`"${c.name}" mijozida ${st.count} ta sotuv tarixi bor.\nO'chirilsa faqat kontakt ma'lumotlari o'chadi, sotuv tarixi saqlanadi.\nDavom etilsinmi?`)) return;
  } else {
    if (!confirm(`"${c.name}" o'chirilsinmi?`)) return;
  }

  db.customers = db.customers.filter(x => x.id !== id);
  // 2026-08-01: BULUTGA HAM AYTAMIZ.
  // Avval `queueCloudDelete` chaqirilmasdi — mijoz faqat qurilmadan
  // o'chib, keyingi tortishda bulutdagi nusxa QAYTIB kelardi.
  // "Mijoz o'chmayapti" muammosining sababi shu edi (§4.2).
  try { if (typeof queueCloudDelete === "function") queueCloudDelete("customers", "id", id); } catch(e) {}
  saveDB();
  try { if (typeof flushCloudSync === "function") flushCloudSync(true); } catch(e) {}
  closeModal("custcard"); renderMijozlar();
  toast(`"${c.name}" o'chirildi`);
}

// ── Guruhli SMS ──────────────────────────────────
let _selectedCusts = new Set(); // tanlangan mijozlar ID lari

function toggleCustSelect(id) {
  if (_selectedCusts.has(id)) _selectedCusts.delete(id);
  else _selectedCusts.add(id);
  const el = document.querySelector(`[data-cust-check="${id}"]`);
  if (el) el.checked = _selectedCusts.has(id);
  updateBulkSmsBar();
}

function selectAllCusts() {
  const visible = [...document.querySelectorAll("[data-cust-check]")].map(el=>+el.dataset.custCheck);
  const allSelected = visible.every(id => _selectedCusts.has(id));
  if (allSelected) visible.forEach(id => _selectedCusts.delete(id));
  else visible.forEach(id => _selectedCusts.add(id));
  visible.forEach(id => {
    const el=document.querySelector(`[data-cust-check="${id}"]`);
    if(el) el.checked=_selectedCusts.has(id);
  });
  updateBulkSmsBar();
}

function updateBulkSmsBar() {
  const bar = $("bulk-sms-bar");
  if (!bar) return;
  const cnt = _selectedCusts.size;
  if (cnt > 0) {
    bar.style.display = "flex";
    const el = $("bulk-sms-cnt"); if(el) el.textContent = cnt+" ta mijoz tanlandi";
  } else {
    bar.style.display = "none";
  }
}

function openBulkSmsModal() {
  if (_selectedCusts.size === 0) { toast("Avval mijozlarni tanlang","err"); return; }
  const custs = db.customers.filter(c => _selectedCusts.has(c.id) && c.phone);
  if (!custs.length) { toast("Tanlangan mijozlarda telefon raqami yo'q","err"); return; }

  const modal = document.createElement("div");
  modal.className = "ov"; modal.id = "bulk-sms-modal";
  modal.style.cssText = "display:flex";
  modal.innerHTML = `
    <div class="modal" style="max-width:440px">
      <button class="m-close" onclick="$('bulk-sms-modal').remove()"><i class="ti ti-x"></i></button>
      <h2 style="margin-bottom:4px"><i class="ti ti-send"></i> Guruhli SMS</h2>
      <p style="font-size:13px;color:var(--mut);margin-bottom:14px">
        ${custs.length} ta mijozga yuboriladi
        ${_selectedCusts.size > custs.length ? ` (${_selectedCusts.size-custs.length} ta telefonsiz o'tkazib yuborildi)` : ""}
      </p>
      <div class="fld">
        <label>Xabar matni</label>
        <textarea id="bulk-sms-text" rows="4" placeholder="Xabar matnini kiriting..."
          style="font-family:inherit;font-size:13px;border:1.5px solid var(--brd);border-radius:var(--rs);
          padding:8px 12px;width:100%;resize:vertical;box-sizing:border-box"></textarea>
        <div style="font-size:11.5px;color:var(--mut);margin-top:4px">
          💡 <b>{ism}</b> — mijoz ismi, <b>{qarz}</b> — joriy qarz summasi
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="setBulkTemplate('debt')">💳 Qarz eslatma</button>
        <button class="btn btn-ghost btn-sm" onclick="setBulkTemplate('promo')">🎁 Aksiya</button>
        <button class="btn btn-ghost btn-sm" onclick="setBulkTemplate('greet')">👋 Salom</button>
      </div>
      <div style="background:var(--bg);border-radius:9px;padding:10px 12px;font-size:12px;color:var(--mut);margin-bottom:14px;max-height:120px;overflow-y:auto">
        ${custs.slice(0,5).map(c=>`<div>• ${c.name} — ${c.phone}</div>`).join("")}
        ${custs.length>5?`<div style="color:#aaa">+${custs.length-5} ta...</div>`:""}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-acc" style="flex:1" onclick="confirmBulkSms('sms')">
          <i class="ti ti-message"></i> SMS yuborish (${custs.length} ta)
        </button>
        ${db.settings?.telegramBotUrl ? `<button class="btn" style="background:#EFF6FF;color:#3B82F6;border:1.5px solid #93C5FD;flex:1" onclick="confirmBulkSms('bot')">
          <i class="ti ti-brand-telegram"></i> Bot yuborish
        </button>` : `<button class="btn btn-ghost" style="flex:1;opacity:.4" disabled title="Sozlamalarda bot URL kiriting">
          <i class="ti ti-brand-telegram"></i> Bot (ulanmagan)
        </button>`}
      </div>
    </div>`;
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  document.body.appendChild(modal);
}

function setBulkTemplate(type) {
  const shop = db.settings?.shopName || "Do'kon";
  const templates = {
    debt:  `${shop}: Hurmatli {ism}, joriy qarzingiz: {qarz}. Iltimos to'lovni amalga oshiring. Rahmat!`,
    promo: `${shop}: Hurmatli {ism}, yangi mahsulotlar va maxsus chegirmalar mavjud! Siz bilan hamkorlik qilishdan mamnunmiz.`,
    greet: `${shop}: Hurmatli {ism}, siz bilan hamkorlik qilishdan mamnunmiz! Yangi mahsulotlarimiz bilan tanishib chiqishingizni taklif etamiz.`
  };
  const el = $("bulk-sms-text"); if(el) el.value = templates[type]||"";
}

async function confirmBulkSms(channel = "sms") {
  const text = ($("bulk-sms-text")||{value:""}).value.trim();
  if (!text) { toast("Xabar matnini kiriting","err"); return; }

  const custs = db.customers.filter(c => _selectedCusts.has(c.id) && c.phone);
  if (!custs.length) { toast("Telefonli mijoz yo'q","err"); return; }
  let sent = 0, failed = 0;

  $("bulk-sms-modal")?.remove();
  toast(`📲 ${custs.length} ta mijozga xabar yuborilmoqda...`);

  for (const c of custs) {
    const st  = custStats(c.id);
    const debtTxt = st.totalDebtUsd>0?`${fmtUsd(st.totalDebtUsd)} USD`:st.totalDebt>0?`${fmt(st.totalDebt)} so'm`:"0";
    const msg = text.replace(/{ism}/g, c.name).replace(/{qarz}/g, debtTxt);
    try {
      if (channel === "bot") {
        const res = await sendTelegramText(c.id, c.phone, msg);
        if (res?.sent) sent++; else failed++;
      } else {
        await sendSms(c.phone, msg);
        sent++;
      }
    } catch(e) { failed++; }
    await new Promise(r=>setTimeout(r,300));
  }

  _selectedCusts.clear();
  updateBulkSmsBar();
  renderMijozlar();
  const ch = channel === "bot" ? "Bot" : "SMS";
  toast(`✅ ${ch}: ${sent} ta yuborildi${failed?` (${failed} ta xato)`:""}`);
}

// ── Excel eksport ────────────────────────────────
function exportMijozlarExcel() {
  const rate = db.settings?.rate || 12800;
  const rows = [["Ism","Telefon","Qo'shimcha tel","Turi","Kompaniya","Manzil/Izoh",
    "Muhim qayд","Manba","Tug'ilgan kun","Sotuvlar","Jami xarid","O'rtacha chek",
    "Oxirgi xarid","Joriy qarz (so'm)","Joriy qarz (USD)","Segment","Qarz limiti","Sodiqlik ballari"]];

  // 2026-08-02: EKRANDAGI ro'yxatdan (filtr va qidiruv bilan).
  // Avval `db.customers` — hamma mijoz chiqardi.
  getExportList("mijozlar", db.customers).forEach(c => {
    const st  = custStats(c.id);
    const seg = custSegment(st, c);
    const typeLabel = { ulgurji:"Ulgurji", chakana:"Chakana", other:"Boshqa" };
    rows.push([
      c.name, c.phone||"", c.phone2||"",
      typeLabel[c.type]||c.type||"", c.company||"", c.note||"",
      c.importantNote||"", c.source||"", c.birthday||"",
      st.count, st.totalBuy, st.avgCheck,
      st.lastDate||"",
      Math.round(st.totalDebt), +(st.totalDebtUsd||0).toFixed(2),
      seg.label.replace(/[⭐🆕💳💤⛔👤]/gu,"").trim(),
      c.debtLimit||"", c.loyaltyPoints||0
    ]);
  });

  const total     = db.customers.reduce((a,c)=>a+custStats(c.id).totalBuy,0);
  const totalDebt = db.customers.reduce((a,c)=>a+custStats(c.id).totalDebt,0);
  rows.push([]);
  rows.push(["JAMI","","","","","","","","",
    db.customers.length+" ta", total, "","", totalDebt,"","","",""]);

  downloadCSV(rows, `merx_mijozlar_${today()}.xls`);
  toast(`✅ ${db.customers.length} ta mijoz yuklab olindi`);
}

// ── Tug'ilgan kun eslatma ─────────────────────────
let _birthdayAlertShown = false;
function checkBirthdayAlerts() {
  if (_birthdayAlertShown) return;
  const today = new Date();
  const todayMD = String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");

  const todayBirthdays = (db.customers||[]).filter(c => {
    if (!c.birthday) return false;
    const [,m,d] = c.birthday.split("-");
    return m && d && (m.padStart(2,"0")+"-"+d.padStart(2,"0")) === todayMD;
  });

  if (!todayBirthdays.length) return;
  _birthdayAlertShown = true;

  const names = todayBirthdays.map(c=>c.name).join(", ");
  const bar = document.createElement("div");
  bar.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9000;"+
    "background:#0D1B2A;color:#fff;padding:12px 20px;border-radius:12px;"+
    "display:flex;align-items:center;gap:12px;box-shadow:0 4px 20px rgba(0,0,0,.3);max-width:420px;";
  bar.innerHTML = `
    <span style="font-size:22px">🎂</span>
    <div>
      <div style="font-weight:700;font-size:13.5px">Bugun tug'ilgan kun!</div>
      <div style="font-size:12px;color:#9CA3AF;margin-top:2px">${names}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="margin-left:auto;background:rgba(255,255,255,.15);
      border:none;color:#fff;border-radius:8px;padding:4px 10px;cursor:pointer;font-size:12px">✕</button>`;
  document.body.appendChild(bar);
  setTimeout(()=>bar.remove(), 8000);
}


// Ixtiyoriy: db.settings.loyaltyRate = har necha so'm uchun 1 ball (masalan: 10000)
// POS sotuv yakunida chaqiriladi
function addLoyaltyPoints(customerId, saleTotal) {
  const rate = db.settings?.loyaltyRate; // 0 yoki undefined = o'chirilgan
  if (!rate || rate <= 0 || !customerId) return 0;
  const pts = Math.floor(saleTotal / rate);
  if (pts <= 0) return 0;
  const c = (db.customers||[]).find(x => x.id === customerId);
  if (!c) return 0;
  c.loyaltyPoints = (c.loyaltyPoints || 0) + pts;
  saveDB();
  return pts;
}

// Ball sarflash (POS da chegirma sifatida)
function spendLoyaltyPoints(customerId, pointsToSpend) {
  const c = (db.customers||[]).find(x => x.id === customerId);
  if (!c || !pointsToSpend) return false;
  if ((c.loyaltyPoints||0) < pointsToSpend) { toast("Ball yetarli emas","err"); return false; }
  c.loyaltyPoints -= pointsToSpend;
  saveDB();
  return true;
}

// Ballni so'mga aylantirish (1 ball = 100 so'm, sozlashda o'zgartiriladi)
function pointsToSom(pts) {
  return pts * (db.settings?.loyaltyValue || 100);
}

// "Yangi mijoz" oynasi HAR DOIM toza ochiladi (tahrirdan keyin eski
// mijoz ma'lumotlari qolib ketmasligi uchun) — AbuSaxiy e'tirozi
function resetCustForm() {
  ["ac-name","ac-phone","ac-phone2","ac-note","ac-company","ac-debt-limit",
   "ac-birthday","ac-important-note"].forEach(id => {
    const el = $(id); if (el) { el.value = ""; if (el.dataset) el.dataset.raw = ""; }
  });
  if ($("ac-type"))   $("ac-type").value   = "ulgurji";
  if ($("ac-source")) $("ac-source").value = "";
  const h2 = document.querySelector("#ov-addcust h2");
  if (h2) h2.textContent = "Yangi mijoz";
  const btn = document.querySelector("#ov-addcust .btn-acc");
  if (btn) { btn.innerHTML = '<i class="ti ti-check"></i> Saqlash'; btn.onclick = addCustomer; }
}
function openAddCustomer() { resetCustForm(); openModal("addcust"); }

function addCustomer() {
  if (typeof requireUse === "function" && !requireUse("mijozlar")) return;

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
    // 2026-07-31: mamlakat kodi bilan saqlanadi (+7701..., +998901...).
    // Avval bu yerda faqat maydondagi qism olinardi va kod tushib
    // qolardi — chet el mijozlarining raqami chalkashardi.
    phone:     (typeof phoneFullVal === "function" ? phoneFullVal("ac-phone") : "") || phone || "",
    phone2:    (typeof phoneFullVal === "function" ? phoneFullVal("ac-phone2") : "")
               || ($("ac-phone2")||{value:""}).value.trim(),
    type:      ($("ac-type")||{value:"ulgurji"}).value,
    company:   ($("ac-company")||{value:""}).value.trim(),
    note:      ($("ac-note")||{value:""}).value.trim(),
    debtLimit:     limitRaw > 0 ? limitRaw : null,
    birthday:      ($("ac-birthday")||{value:""}).value,
    importantNote: ($("ac-important-note")||{value:""}).value.trim(),
    source:        ($("ac-source")||{value:""}).value,
    loyaltyPoints: 0,
    updatedAt: new Date().toISOString()   // 2026-08-02: sinxron solishtiruvi
  };
  db.customers.push(nc);
  saveDB(); renderMijozlar(); closeModal("addcust");
  toast(`✅ "${name}" qo'shildi`);
  ["ac-name","ac-phone","ac-phone2","ac-note","ac-company","ac-debt-limit",
    "ac-birthday","ac-important-note"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("ac-type"))   $("ac-type").value   = "ulgurji";
  if ($("ac-source")) $("ac-source").value = "";
}

// ═══════════════════════════════════════════════════════════════
// ESKI QARZ QO'SHISH (2026-07-26)
// Yangi do'kon ochilganda daftardagi mavjud qarzlarni tizimga
// kiritish. Qarz "sotuv" yozuvi sifatida saqlanadi (chekNum "ESKI-")
// — shunda mavjud qarz mantiqi (to'lov, chek, hisobot) o'zgarishsiz
// ishlaydi va keyingi qarzlar ustiga qo'shilib boradi.
// ═══════════════════════════════════════════════════════════════
let _oldDebtCustId = null;

function openOldDebt(custId) {
  const c = db.customers.find(x => x.id === custId);
  if (!c) { toast("Mijoz topilmadi", "err"); return; }
  _oldDebtCustId = custId;

  const el = $("od-cust");
  if (el) el.innerHTML = `<b style="color:#0D1B2A;font-size:14px">${c.name}</b>` +
    (c.phone ? ` · ${c.phone}` : "");

  // Joriy qarzini ko'rsatamiz
  try {
    const st = (db.sales || [])
      .filter(s => s.customerId === custId && !s.cancelled && s.status !== "qaytarilgan")
      .reduce((a, s) => {
        const _s = (typeof calcSaleState === "function") ? calcSaleState(s) : s;
        a.uzs += Math.max(0, _s.remaining || 0);
        a.usd += Math.max(0, _s.debtUsd  || 0);
        return a;
      }, { uzs: 0, usd: 0 });
    if ((st.uzs > 0 || st.usd > 0) && el) {
      el.innerHTML += `<div style="margin-top:4px;color:#B91C1C;font-weight:700">
        Hozirgi qarzi: ${st.usd > 0 ? fmtUsd(st.usd) : fmt(st.uzs) + " so'm"}</div>`;
    }
  } catch(e) {}

  if ($("od-amt"))  $("od-amt").value  = "";
  if ($("od-note")) $("od-note").value = "";
  if ($("od-date")) $("od-date").value = today();
  if ($("od-due"))  $("od-due").value  = "";
  const r = document.querySelector('input[name="od-cur"][value="uzs"]');
  if (r) r.checked = true;
  odCurChanged();
  openModal("olddebt");
}

function odCurChanged() {
  const cur = (document.querySelector('input[name="od-cur"]:checked') || {value:"uzs"}).value;
  const lbl = $("od-amt-lbl");
  const inp = $("od-amt");
  if (lbl) lbl.textContent = cur === "usd" ? "Qarz summasi ($)" : "Qarz summasi (so'm)";
  if (inp) { inp.value = ""; inp.dataset.raw = ""; }
  odAmtInput(inp);
}

function odAmtInput(el) {
  if (!el) return;
  const cur = (document.querySelector('input[name="od-cur"]:checked') || {value:"uzs"}).value;
  if (cur === "usd") {
    // Dollarda kasr bo'lishi mumkin
    let clean = String(el.value).replace(/[^\d.]/g, "");
    const parts = clean.split(".");
    el.value = parts[0] + (parts.length > 1 ? "." + parts.slice(1).join("").slice(0,2) : "");
    el.dataset.raw = el.value;
  } else {
    if (typeof fmtInput === "function") fmtInput(el);
  }
  const hint = $("od-hint");
  if (!hint) return;
  const rate = db.settings?.rate || 12800;
  const val = parseFloat(String(el.dataset.raw || el.value).replace(/[^\d.]/g,"")) || 0;
  hint.textContent = val > 0
    ? (cur === "usd"
        ? `≈ ${fmt(Math.round(val * rate))} so'm (kurs ${fmt(rate)})`
        : `≈ $${(val / rate).toFixed(2)} (kurs ${fmt(rate)})`)
    : "";
}

function saveOldDebt() {
  if (typeof requireUse === "function" && !requireUse("mijozlar")) return;

  const c = db.customers.find(x => x.id === _oldDebtCustId);
  if (!c) { toast("Mijoz topilmadi", "err"); return; }

  const cur  = (document.querySelector('input[name="od-cur"]:checked') || {value:"uzs"}).value;
  const el   = $("od-amt");
  const val  = parseFloat(String(el?.dataset?.raw || el?.value || "").replace(/[^\d.]/g,"")) || 0;
  if (val <= 0) { toast("Qarz summasini kiriting", "err"); return; }

  const rate = db.settings?.rate || 12800;
  const date = ($("od-date")||{value:""}).value || today();
  const due  = ($("od-due") ||{value:""}).value || "";
  const note = ($("od-note")||{value:""}).value.trim();

  // So'mdagi ekvivalent — ichki hisob har doim so'mda yuritiladi
  const uzs = cur === "usd" ? Math.round(val * rate) : Math.round(val);
  const usd = cur === "usd" ? val : null;

  const _txt = cur === "usd" ? `$${val.toFixed(2)}` : `${fmt(uzs)} so'm`;
  if (!confirm(`ESKI QARZ QO'SHISH\n\n${c.name}\nSumma: ${_txt}\n` +
               (cur === "usd" ? `Kurs: ${fmt(rate)} so'm\n` : "") +
               `Sana: ${date}\n\nDavom etasizmi?`)) return;

  const id = db.seq++;
  const sale = {
    id,
    chekNum: "ESKI-" + String(id).padStart(4, "0"),
    date, time: (typeof nowTime === "function" ? nowTime() : ""),
    customerId: c.id, customerName: c.name, customerPhone: c.phone || "",
    staffId: (typeof currentStaffId !== "undefined" ? currentStaffId : null),
    items: [{
      name: "Eski qarz (daftardan)", sku: "", color: "", size: "",
      qty: 1, price: uzs, unit: "dona", sellMode: "dona"
    }],
    total: uzs, paid: 0, remaining: uzs,
    origPaid: 0, origRemaining: uzs,
    payType: "nasiya", payBreakdown: null,
    status: "qarz",
    due: due || null,
    note: note || "Daftardan ko'chirilgan eski qarz",
    isOldDebt: true,                    // belgi — hisobotlarda ajratish uchun
    rate,
    priceCurrency: db.settings?.priceCurrency || "uzs",
    debtCurrency: cur === "usd" ? "usd" : "uzs",
    debtUsd: usd, origDebtUsd: usd,
    createdAt: new Date().toISOString()
  };

  if (!db.sales) db.sales = [];
  db.sales.push(sale);
  saveDB();
  try { if (typeof flushCloudSync === "function") flushCloudSync(); } catch(e) {}

  closeModal("olddebt");
  if (typeof renderMijozlar === "function") renderMijozlar();
  if (typeof renderDebts === "function") renderDebts();
  toast(`✅ ${c.name}: ${_txt} qarz qo'shildi`);
}
