// MERX utils.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/utils.js
// Yordamchi funksiyalar, toast, navigatsiya
// ================================================

const fmt    = n  => Math.round(n).toLocaleString("ru-RU");
// 2026-07-20: USD ko'rsatishda ham MING AJRATGICHI (probel): $4 500.00
// Butun qismga probel (ru-RU), o'nlik ikki xona. Bu YAGONA USD-ko'rsatish
// funksiyasi — qarzlar, katalog, POS, hisobot HAMMA joyda shu ishlaydi.
// 2026-07-25: butun va kasr qism ALOHIDA yaxlitlanardi — kasr .995 dan
// katta bo'lsa butun qism oshmay qolardi ($161.995 → "$161.00").
// Endi avval to'liq son yaxlitlanadi, keyin ajratiladi.
const fmtUsd = n => {
  const v = +n || 0;
  const neg = v < 0 ? "-" : "";
  const fixed = Math.abs(v).toFixed(2);          // "161.99" / "162.00"
  const dot = fixed.indexOf(".");
  const intPart = Number(fixed.slice(0, dot)).toLocaleString("ru-RU");
  return neg + "$" + intPart + "." + fixed.slice(dot + 1);
};
const $      = id => document.getElementById(id);
const today  = () => new Date().toISOString().slice(0, 10);
const nowTime= () => new Date().toLocaleTimeString("uz-UZ", {hour:"2-digit", minute:"2-digit"});

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().slice(0, 10);
}

// Do'kon turi (2026-07): kod 2 maxsus turni biladi (oyoq, kiyim);
// boshqa har qanday qiymat (aralash, kanstovar...) XAVFSIZ "ikki"
// (universal) rejimga tushadi — hech narsa buzilmaydi.
const getShopType = () => {
  const t = db.settings?.shopType || db.shop?.type || "ikki";
  return (t === "oyoq" || t === "kiyim") ? t : "ikki";
};
const visProds    = () => { const t = getShopType(); return t === "ikki" ? db.products : db.products.filter(p => p.type === t); };
const totalStock = p  => p.variants.reduce((a, v) => a + v.qty, 0);

// O'lchamlar ro'yxatini ixcham formatga aylantirish: ["39","40","41","42","43","44"] → "39-44"
// Ketma-ket bo'lmasa: ["39","42"] → "39, 42". Bitta bo'lsa: ["39"] → "39"
function sizesToRange(sizeList, type) {
  if (!sizeList || sizeList.length === 0) return "";
  if (sizeList.length === 1) return sizeList[0];
  const allSizes = (typeof SIZES !== "undefined" && SIZES[type]) ? SIZES[type] : null;
  if (allSizes) {
    const indices = sizeList.map(s => allSizes.indexOf(s)).filter(i => i !== -1).sort((a,b)=>a-b);
    if (indices.length === sizeList.length) {
      const isConsecutive = indices.every((idx, i) => i === 0 || idx === indices[i-1] + 1);
      if (isConsecutive) {
        const first = allSizes[indices[0]], last = allSizes[indices[indices.length-1]];
        return `${first}-${last}`;
      }
    }
  }
  // Ketma-ket emas yoki SIZES topilmadi — vergul bilan
  return sizeList.join(", ");
}

// ── Pochka guruhlash ──────────────────────────────
// Dona sotuvi natijasida o'lchamlar nomutanosib bo'lib qolsa,
// variantlarni "to'liq pochka" va "ochilgan pochka" guruhlariga ajratadi.
function regroupPackages(variants, color, inBox) {
  const colorVariants = variants.filter(v => v.color === color);
  if (colorVariants.length === 0) return [];

  // ═══ 2026-07-25: O'LCHAMSIZ TOVAR uchun yangi mantiq ═══
  // O'lcham shablonidan voz kechilgach har rang BITTA variant bo'lib qoldi,
  // shuning uchun eski "o'lchamlar teng emas" mantiqi ochilgan pochkani
  // umuman topa olmasdi. Endi qoldiq quti sig'imiga bo'linmasa —
  // qolgani OCHILGAN pochka deb hisoblanadi.
  //   88 dona, 1 pochkada 5 → 17 to'liq pochka + 3 dona ochilgan
  // 2026-07-26: O'LCHAMSIZ tovar deb hisoblaymiz — variantlarda haqiqiy
  // o'lcham bo'lmasa (bo'sh yoki "-"), ular bitta qoldiq sifatida
  // birlashtiriladi. Avval faqat colorVariants.length===1 tekshirilardi
  // va import bir necha "-" o'lchamli variant yaratsa eski mantiq ishga
  // tushib, ochilgan pochka noto'g'ri hisoblanardi.
  // 2026-07-26: quti sig'imi RANG darajasida bo'lishi mumkin (bitta
  // tovarning turli ranglari har xil pochkada kelishi mumkin: qora 5,
  // oq 6, ko'k 7). Variantda inBox bo'lsa u USTUVOR.
  const _vIb = parseInt(colorVariants[0] && colorVariants[0].inBox) || 0;
  const _ib = _vIb > 0 ? _vIb : (parseInt(inBox) || 0);
  const _noSize = colorVariants.every(v => {
    const sz = String(v.size || "").trim();
    return !sz || sz === "-";
  });
  if (_noSize && _ib > 1) {
    const _total = colorVariants.reduce((a, v) => a + (v.qty || 0), 0);
    const full = Math.floor(_total / _ib);
    const rest = _total - full * _ib;
    const out = [];
    if (full > 0) out.push({
      packGroup: 0, qty: full, isBroken: false,
      variants: [{ ...colorVariants[0], qty: full * _ib }]
    });
    if (rest > 0) out.push({
      packGroup: out.length, qty: rest, isBroken: true, brokenDona: rest,
      variants: [{ ...colorVariants[0], qty: rest }]
    });
    return out.length ? out
      : [{ packGroup: 0, qty: 0, isBroken: false, variants: colorVariants }];
  }
  if (colorVariants.length === 1 && _ib > 1) {
    const total = colorVariants[0].qty || 0;
    const full  = Math.floor(total / _ib);          // to'liq pochkalar
    const rest  = total - full * _ib;               // ochilgan qoldiq (dona)
    const out = [];
    if (full > 0) out.push({
      packGroup: 0, qty: full, isBroken: false,
      variants: [{ ...colorVariants[0], qty: full * _ib }]
    });
    if (rest > 0) out.push({
      packGroup: out.length, qty: rest, isBroken: true, brokenDona: rest,
      variants: [{ ...colorVariants[0], qty: rest }]
    });
    // Hech narsa qolmasa — bo'sh guruh (qoldiq 0)
    return out.length ? out
      : [{ packGroup: 0, qty: 0, isBroken: false, variants: colorVariants }];
  }

  // ── Eski (o'lchamli) tovarlar uchun avvalgi mantiq — TEGILMAYDI ──
  const qtys = colorVariants.map(v => v.qty);
  const minQty = Math.min(...qtys);
  const allEqual = qtys.every(q => q === minQty);

  if (allEqual) {
    return [{ packGroup: 0, qty: minQty, isBroken: false, variants: colorVariants }];
  }

  const groups = [{ packGroup: 0, qty: minQty, isBroken: false, variants: colorVariants.map(v => ({...v, qty: minQty})) }];

  let groupIdx = 1;
  let rem = colorVariants.map(v => ({ ...v, qty: v.qty - minQty })).filter(v => v.qty > 0);
  while (rem.length > 0) {
    const rQtys = rem.map(v => v.qty);
    const rMin = Math.min(...rQtys);
    groups.push({
      packGroup: groupIdx,
      qty: rMin,
      isBroken: true,
      variants: rem.map(v => ({...v, qty: rMin}))
    });
    rem = rem.map(v => ({ ...v, qty: v.qty - rMin })).filter(v => v.qty > 0);
    groupIdx++;
  }

  return groups;
}

// debtSales: joriy (hisoblangan) qoldig'i bor sotuvlar — db.sales ning o'zi
// o'zgartirilmaydi, faqat calcSaleState() orqali tekshiriladi.
const debtSales  = () => db.sales.filter(s => calcSaleState(s).remaining > 0.5);
const isOverdue  = s  => s.due && s.due < today();

// ── Qarz to'lov chek raqami ────────────────────
function genPayChekNum() {
  const datePart = today().replace(/-/g, "");
  const seq = (db.debtPayments || []).filter(p => p.chekNum?.includes(datePart)).length + 1;
  return `PAY-${datePart}-${String(seq).padStart(4, "0")}`;
}

// ── Bitta sotuv bo'yicha barcha to'lovlarni topish ─
// v150 (№3 atkaz): FAOL to'lovlar — atkaz (bekor) qilinganlari chiqariladi.
// Barcha summa-hisoblar (dashboard, hisobot, moliya, xodimlar...) shu
// yordamchidan o'qiydi — atkazdan keyin sonlar hamma joyda o'zi to'g'rilanadi.
// 2026-07-25: bekor qilinmagan sotuvlar — statistika uchun YAGONA manba
function activeSales() {
  return (db.sales || []).filter(s => !s.cancelled);
}

// 2026-07-26: STATISTIKA uchun sotuvlar — daftardan ko'chirilgan
// ESKI QARZLAR (isOldDebt) haqiqiy sotuv EMAS, shuning uchun tushum,
// foyda va sotuv summasiga KIRMAYDI. Qarz hisobida esa to'liq ishlaydi.
function statSales() {
  return (db.sales || []).filter(s => !s.cancelled && !s.isOldDebt);
}

function activePays() {
  return (db.debtPayments || []).filter(p => !p.cancelled);
}

// 2026-07-25: KASSA/TUSHUM hisobiga kiradigan qarz to'lovlari.
// Tovar qaytarish hisobidan yopilgan qarz (source="refund") HAQIQIY PUL
// EMAS — kunlik tushumga va kassaga qo'shilmaydi. Qarz hisobida esa
// u to'liq ishlaydi (qarz kamayadi).
function cashPays() {
  return (db.debtPayments || []).filter(p => !p.cancelled && p.source !== "refund");
}

function getSalePayments(saleId, includeCancelled) {
  // v150 (№3): atkaz qilingan to'lovlar qarz hisobiga KIRMAYDI —
  // shu bitta filtr tufayli calcSaleState qarzni o'zi "qaytaradi".
  return (db.debtPayments || [])
    .filter(p => includeCancelled || !p.cancelled)
    .flatMap(p => (p.allocations || []).map(a => ({ ...a, paymentId: p.id, paymentChekNum: p.chekNum, payDate: p.date, payTime: p.time, payMethod: p.method || "naqd" })))
    .filter(a => a.saleId === saleId)
    .sort((a, b) => (a.payDate+a.payTime < b.payDate+b.payTime) ? -1 : 1);
}

// ── Shu sotuv uchun keyingi T-raqamini hosil qilish (T1, T2, T3...) ─
function nextPartNum(saleId) {
  // v150: atkaz qilinganlar HAM sanaladi — T-raqamlar takrorlanmasin
  const existing = getSalePayments(saleId, true);
  return existing.length + 1;
}

// ── Barcha sotuvlarni joriy holatga sinxronlash ────
// db.sales dagi har bir elementning paid/remaining/debtUsd/status maydonlarini
// calcSaleState() natijasi bilan yangilaydi. orig* maydonlar (asl, o'zgarmas
// qiymatlar) saqlanib qoladi — chek har doim "qanday sotilgan edi"ni biladi,
// faqat hisobot/ro'yxat ko'rinishidagi joriy holat yangilanadi.
// ── Sotuvning JORIY holatini hisoblash (asl sale o'zgarmaydi) ─
// Sale yaratilgandagi asl paid/remaining + barcha keyingi to'lovlar yig'indisi.
function calcSaleState(sale) {
  // 2026-07-25: BEKOR QILINGAN sotuv — hech qanday qarz/to'lov qoldirmaydi
  if (sale && sale.cancelled) {
    return { remaining: 0, debtUsd: 0, paid: 0, status: "bekor", cancelled: true };
  }
  const payments = getSalePayments(sale.id);
  const extraPaidUzs = payments.filter(p => p.currency !== "usd").reduce((a,p) => a+(p.amount||0), 0);
  const extraPaidUsd = payments.filter(p => p.currency === "usd").reduce((a,p) => a+(p.amount||0), 0);
  const rate = db.settings?.rate || 12800;

  const isUsdDebt = sale.debtCurrency === "usd" && sale.origDebtUsd != null;
  let currentPaid, currentRemaining, currentDebtUsd, currentStatus;

  if (isUsdDebt) {
    currentDebtUsd   = Math.max(0, (sale.origDebtUsd||0) - extraPaidUsd);
    currentRemaining = Math.round(currentDebtUsd * rate);
    currentPaid      = (sale.origPaid||sale.paid||0) + extraPaidUzs + extraPaidUsd*rate;
  } else {
    currentRemaining = Math.max(0, (sale.origRemaining != null ? sale.origRemaining : sale.remaining||0) - extraPaidUzs);
    currentDebtUsd   = 0;
    currentPaid      = (sale.origPaid||sale.paid||0) + extraPaidUzs;
  }
  currentStatus = currentRemaining < 100 ? "tolandan" : "qarz";

  return {
    paid: currentPaid, remaining: currentRemaining,
    debtUsd: currentDebtUsd, status: currentStatus,
    paymentsCount: payments.length, payments
  };
}

// ── Valyuta formatlash (qarz to'lovlari uchun) ─
function fmtMoney(amount, currency) {
  return currency === "usd" ? `$${(+amount).toFixed(2)}` : `${fmt(amount)} so'm`;
}

function priceDisplay(priceUzs) {
  const c = db.settings.priceCurrency || "uzs";
  const r = db.settings.rate || 1;
  if (c === "usd")  return fmtUsd(priceUzs / r);
  if (c === "both") return fmt(priceUzs) + " / " + fmtUsd(priceUzs / r);
  return fmt(priceUzs) + " so'm";
}

let toastT;
function toast(msg, type = "ok") {
  const icons = { ok:"ti-check", err:"ti-alert-circle", info:"ti-info-circle" };
  $("toast-ico").className = "ti " + (icons[type] || "ti-check");
  $("toast-msg").textContent = msg;
  $("toast").classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => $("toast").classList.remove("on"), 4000);
}

// ═══ MOBIL SIDEBAR (2026-07-21) — gamburger menyu ═══
function toggleMobSidebar() {
  const sb = document.getElementById("sb");
  const ov = document.getElementById("mob-overlay");
  if (!sb) return;
  const open = sb.classList.toggle("mob-open");
  if (ov) ov.classList.toggle("on", open);
}
function closeMobSidebar() {
  const sb = document.getElementById("sb");
  const ov = document.getElementById("mob-overlay");
  if (sb) sb.classList.remove("mob-open");
  if (ov) ov.classList.remove("on");
}

function nav(p) {
  // Rol tekshiruvi — ruxsati yo'q sahifaga o'tmaslik
  if (typeof canAccessPage === "function" && !canAccessPage(p)) {
    toast("Bu sahifaga kirishga ruxsatingiz yo'q", "err");
    return;
  }
  // v152 (№9): sahifa HAQIQATAN almashganda qidiruvlar tozalanadi
  // (realtime pull nav(joriy) chaqiradi — u tozalamaydi, guard shu yerda)
  if (window._navPrevPage && window._navPrevPage !== p) clearPageSearches();
  window._navPrevPage = p;
  document.querySelectorAll(".ni").forEach(n => n.classList.toggle("on", n.dataset.p === p));
  document.querySelectorAll("[id^='p-']").forEach(el => el.classList.remove("on"));
  const el = $("p-" + p); if (el) el.classList.add("on");
  // v151 (№4): amaldagi sahifa eslab qolinadi — F5'dan keyin init shu yerdan tiklaydi
  if (el) { try { localStorage.setItem("merx_last_page", p); } catch(e) {} }
  const T = { dashboard:"Dashboard", pos:"Sotuv (POS)", katalog:"Katalog", ombor:"Ombor",
    mijozlar:"Mijozlar", qarzlar:"Qarzlar", qarztarix:"Qarzlar tarixi", tarix:"Sotuv tarixi",
    hisobot:"Hisobot va tahlil", xodimlar:"Xodimlar", moliya:"Moliya",
    portal:"Mijoz portali", egasi:"Egasi / Sozlamalar" };
  $("ptitle").textContent = T[p] || p;
  // Mobil: sahifa tanlangach sidebar avtomat yopiladi
  if (typeof closeMobSidebar === "function") closeMobSidebar();
  const fn = { dashboard:renderDashboard, katalog:renderKatalog, ombor:renderOmbor,
    mijozlar:renderMijozlar, qarzlar:renderDebts, qarztarix:renderQarzlarTarixi, tarix:renderTarix,
    hisobot:renderHisobot, xodimlar:renderXodimlar, moliya:renderMoliya,
    portal:renderPortal, egasi:renderEgasi };
  if (fn[p]) fn[p]();
  if (p === "pos") {
    refreshCustList(); refreshStaffList(); renderPosGrid();
    if (typeof checkDebtAlerts === "function") checkDebtAlerts();
  }
}

// 2026-07-10: bu yerdagi ESKI toggleCurrency O'CHIRILDI (8-qoida —
// nom to'qnashuvi). Amaldagi yagona nusxa: dashboard.js (saveSetting
// orqali, bulutga sinxronlanadi). Bu yerda qayta e'lon QILINMASIN!
function updateRatePill() {
  $("tb-rate").textContent = fmt(db.settings.rate || 0);
  const lbl = { uzs:"so'm", usd:"USD", both:"so'm/USD" };
  $("tb-cur").textContent = lbl[db.settings.priceCurrency || "uzs"] || "so'm";
}
function openModal(id, keepOthers) {
  // Mobil: modal ichidagi raqamli maydonlarga raqam klaviaturasi (2026-07-24)
  try { setTimeout(() => applyInputModes(document.getElementById("ov-" + id)), 0); } catch(e) {}
  // Avval ochiq turgan boshqa modallarni yopamiz — bir nechta modal
  // bir vaqtda "kutib qolmasligi" uchun.
  // 2026-07-24: keepOthers=true bo'lsa YOPMAYMIZ — modal ustiga modal
  // ochiladi (masalan tovar oynasidan rasm manbasini tanlash).
  try {
    if (!keepOthers) {
      document.querySelectorAll(".ov.on").forEach(ov => {
        if (ov.id !== "ov-" + id) ov.classList.remove("on");
      });
    }
    const invEl = document.getElementById("ov-invent");
    if (invEl && !keepOthers) invEl.style.display = "none";
  } catch (e) { /* zararsiz, davom etamiz */ }

  const modalEl = document.getElementById("ov-" + id);
  if (modalEl) {
    // Modalni #app konteyneridan tashqariga, to'g'ridan-to'g'ri <body> ga ko'chiramiz.
    // Bu CSS "containing block" muammolarini (flex/transform ota-onalar) chetlab o'tadi —
    // position:fixed har doim butun ekranga nisbatan to'g'ri ishlashini kafolatlaydi.
    if (modalEl.parentElement !== document.body) {
      document.body.appendChild(modalEl);
    }
    modalEl.classList.add("on");
  }

  if (id === "addprod") { apResetImage(); apTypeChange(); setTimeout(() => { if ($("ap-name")) $("ap-name").focus(); }, 50); }
  if (id === "addcust") { setTimeout(() => { if ($("ac-name")) $("ac-name").focus(); }, 50); }
  if (id === "addstaff") { setTimeout(() => { if ($("as-name")) $("as-name").focus(); }, 50); }
  if (id === "addxarajat") {
    if ($("ax-date")) $("ax-date").value = today();
    setTimeout(() => { if ($("ax-sum")) $("ax-sum").focus(); }, 50);
  }
  if (id === "qabul") {
    if (typeof qbResetModal === "function") qbResetModal();
    setTimeout(() => { if ($("qb-name")) $("qb-name").focus(); }, 50);
  }
}
function closeModal(id) { $("ov-" + id).classList.remove("on"); }
function exportDB() {
  const b = new Blob([JSON.stringify(db, null, 2)], { type:"application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(b);
  a.download = "merx_zaxira_" + today() + ".json"; a.click();
  toast("Zaxira yuklab olindi");
}
function importDB(inp) {
  const f = inp.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { db = JSON.parse(r.result); saveDB(); init(); toast("Zaxiradan tiklandi"); }
    catch(e) { toast("Fayl noto'g'ri", "err"); }
  };
  r.readAsText(f);
}

// ── Narx inputi formatlash ────────────────────────
// input[data-price] yoki input[data-fmt] atributli maydonlar uchun
function fmtInput(input) {
  const raw   = input.value.replace(/\D/g, "");
  const num   = parseInt(raw) || 0;
  input.value = num > 0 ? num.toLocaleString("ru-RU") : "";
  input.dataset.raw = raw;
}

function getRawVal(id) {
  const el = $(id); if (!el) return 0;
  // data-raw dan o'qish, yoki to'g'ridan raqam
  const raw = el.dataset.raw || el.value.replace(/\s/g,"").replace(/,/g,"");
  return parseFloat(raw) || 0;
}

// ── 2026-07-12 (AbuSaxiy №4 v2): XALQARO TELEFON TANLASH ──────
// Bayroq + mamlakat kodi + raqam kiritish.
// Foydalanish: phoneWidgetHTML(inputId) — HTML qaytaradi,
//              phoneWidgetInit(inputId) — hodisalarni ulaydi.
// Standart: O'zbekiston (+998). Qidiruv: nom yoki kod (+7, 998...).
const _PH_COUNTRIES = [
  {code:"UZ",flag:"🇺🇿",name:"O'zbekiston",dial:"+998",max:9},
  {code:"RU",flag:"🇷🇺",name:"Rossiya",dial:"+7",max:10},
  {code:"KZ",flag:"🇰🇿",name:"Qozog'iston",dial:"+7",max:10},
  {code:"KG",flag:"🇰🇬",name:"Qirg'iziston",dial:"+996",max:9},
  {code:"TJ",flag:"🇹🇯",name:"Tojikiston",dial:"+992",max:9},
  {code:"TM",flag:"🇹🇲",name:"Turkmaniston",dial:"+993",max:8},
  {code:"AZ",flag:"🇦🇿",name:"Ozarbayjon",dial:"+994",max:9},
  {code:"GE",flag:"🇬🇪",name:"Gruziya",dial:"+995",max:9},
  {code:"AM",flag:"🇦🇲",name:"Armaniston",dial:"+374",max:8},
  {code:"TR",flag:"🇹🇷",name:"Turkiya",dial:"+90",max:10},
  {code:"CN",flag:"🇨🇳",name:"Xitoy",dial:"+86",max:11},
  {code:"AF",flag:"🇦🇫",name:"Afg'oniston",dial:"+93",max:9},
  {code:"PK",flag:"🇵🇰",name:"Pokiston",dial:"+92",max:10},
  {code:"IN",flag:"🇮🇳",name:"Hindiston",dial:"+91",max:10},
  {code:"DE",flag:"🇩🇪",name:"Germaniya",dial:"+49",max:11},
];
let _phSel = {}; // inputId -> tanlangan mamlakat

// Telefon widget HTML'ini qaytaradi (input yoniga joylashadi)
function phoneWidgetHTML(inputId, extraStyle) {
  const c = _phSel[inputId] || _PH_COUNTRIES[0];
  return `<div id="ph-w-${inputId}" style="display:flex;align-items:center;gap:4px;${extraStyle||''}">
  <div style="position:relative">
    <button type="button" id="ph-btn-${inputId}" onclick="phToggle('${inputId}')"
      style="display:flex;align-items:center;gap:3px;padding:6px 7px;border:1.5px solid var(--brd);
      border-radius:var(--rs);background:#fff;cursor:pointer;font-size:13px;white-space:nowrap;height:38px">
      <span id="ph-flag-${inputId}">${c.flag}</span>
      <span id="ph-dial-${inputId}" style="font-weight:600;color:#0D1B2A;font-size:12px">${c.dial}</span>
      <i class="ti ti-chevron-down" style="font-size:10px;color:#94A3B8"></i>
    </button>
    <div id="ph-dd-${inputId}" style="display:none;position:absolute;top:42px;left:0;z-index:9999;
      background:#fff;border:1.5px solid var(--brd);border-radius:10px;
      box-shadow:0 8px 24px rgba(0,0,0,.12);width:220px;overflow:hidden">
      <div style="padding:6px 8px;border-bottom:1px solid var(--brd)">
        <input id="ph-q-${inputId}" placeholder="Mamlakat yoki +kod..."
          oninput="phSearch('${inputId}',this.value)"
          style="width:100%;font-family:inherit;font-size:12px;border:1px solid var(--brd);
          border-radius:7px;padding:5px 8px;outline:none">
      </div>
      <div id="ph-list-${inputId}" style="max-height:180px;overflow-y:auto"></div>
    </div>
  </div>
  <input id="${inputId}" type="tel" placeholder="90 123 45 67"
    oninput="phInput('${inputId}')"
    style="flex:1;font-family:inherit;font-size:13px;font-weight:600;
    border:1.5px solid var(--brd);border-radius:var(--rs);padding:7px 10px;background:#fff;outline:none">
</div>`;
}

function phSearch(inputId, q) {
  const Q = q.trim().toLowerCase().replace(/^\+/,'');
  const list = document.getElementById("ph-list-" + inputId);
  if (!list) return;
  const res = _PH_COUNTRIES.filter(c =>
    !Q || c.name.toLowerCase().includes(Q) ||
    c.dial.replace('+','').startsWith(Q) ||
    c.code.toLowerCase().includes(Q)
  );
  list.innerHTML = res.map(c =>
    `<div onclick="phSelect('${inputId}','${c.code}')"
      style="display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;font-size:13px"
      onmouseover="this.style.background='#F8F7F4'" onmouseout="this.style.background=''">
      <span style="font-size:16px">${c.flag}</span>
      <span style="flex:1;font-weight:600">${c.name}</span>
      <span style="color:#64748B;font-size:12px">${c.dial}</span>
    </div>`
  ).join('');
}

function phSelect(inputId, countryCode) {
  const c = _PH_COUNTRIES.find(x => x.code === countryCode);
  if (!c) return;
  _phSel[inputId] = c;
  const flag = document.getElementById("ph-flag-" + inputId);
  const dial = document.getElementById("ph-dial-" + inputId);
  if (flag) flag.textContent = c.flag;
  if (dial) dial.textContent = c.dial;
  phHide(inputId);
  // Inputni tozalab, focusga olib borish
  const inp = document.getElementById(inputId);
  if (inp) { inp.value = ""; inp.focus(); }
}

function phToggle(inputId) {
  const dd = document.getElementById("ph-dd-" + inputId);
  if (!dd) return;
  const isOpen = dd.style.display === "block";
  // Barcha boshqa dropdownlarni yopish
  document.querySelectorAll("[id^='ph-dd-']").forEach(el => el.style.display = "none");
  if (!isOpen) {
    dd.style.display = "block";
    phSearch(inputId, ""); // ro'yxatni to'ldirish
    setTimeout(() => { const q = document.getElementById("ph-q-" + inputId); if (q) q.focus(); }, 50);
  }
}
function phHide(inputId) {
  const dd = document.getElementById("ph-dd-" + inputId);
  if (dd) dd.style.display = "none";
}

// Tashqariga bosilganda yopish
document.addEventListener("click", e => {
  if (!e.target.closest("[id^='ph-w-']")) {
    document.querySelectorAll("[id^='ph-dd-']").forEach(el => el.style.display = "none");
  }
});

// Raqam kiritishda faqat raqamlar + max uzunlik
function phInput(inputId) {
  const c = _phSel[inputId] || _PH_COUNTRIES[0];
  const inp = document.getElementById(inputId);
  if (!inp) return;
  let d = inp.value.replace(/\D/g, "").slice(0, c.max);
  inp.value = d;
}

// To'liq raqam (saqlash uchun): +998901234567
function phoneFullVal(inputId) {
  const c = _phSel[inputId] || _PH_COUNTRIES[0];
  const inp = document.getElementById(inputId);
  const d = ((inp && inp.value) || "").replace(/\D/g, "");
  return d ? c.dial + d : "";
}

// Mavjud saqlangan qiymatni widgetga yuklash (+998901234567 -> bayroq + raqam)
function phoneWidgetLoad(inputId, fullVal) {
  if (!fullVal) return;
  const d = fullVal.replace(/\s/g, "");
  // Mamlakat kodini aniqlash (uzunroqdan boshlaymiz)
  const sorted = [..._PH_COUNTRIES].sort((a,b) => b.dial.length - a.dial.length);
  const c = sorted.find(x => d.startsWith(x.dial));
  if (c) {
    _phSel[inputId] = c;
    const flag = document.getElementById("ph-flag-" + inputId);
    const dial = document.getElementById("ph-dial-" + inputId);
    if (flag) flag.textContent = c.flag;
    if (dial) dial.textContent = c.dial;
    const inp = document.getElementById(inputId);
    if (inp) inp.value = d.slice(c.dial.length);
  } else {
    const inp = document.getElementById(inputId);
    if (inp) inp.value = fullVal;
  }
}

// ESKI fmtPhone — moslashuvchilik uchun saqlanadi (to'g'ridan-to'g'ri input bo'lsa)
function fmtPhone(input) {
  if (!input) return;
  let d = (input.value || "").replace(/\D/g, "");
  if (d.length > 0 && !d.startsWith("998")) {
    if (d.startsWith("0")) d = "998" + d.slice(1);
    else if (d.length <= 9) d = "998" + d;
  }
  d = d.slice(0, 12);
  let out = "";
  if (d.length > 0)  out = "+" + d.slice(0, 3);
  if (d.length > 3)  out += " " + d.slice(3, 5);
  if (d.length > 5)  out += " " + d.slice(5, 8);
  if (d.length > 8)  out += " " + d.slice(8, 10);
  if (d.length > 10) out += " " + d.slice(10, 12);
  input.value = out;
}
function cleanPhone(val) {
  const d = (val || "").replace(/\D/g, "");
  return d.length >= 9 ? "+" + (d.startsWith("998") ? d : "998" + d.slice(-9)) : val;
}

// Barcha data-price inputlarini ishga tushirish
function initPriceInputs() {
  document.querySelectorAll("input[data-price]").forEach(inp => {
    inp.addEventListener("input", () => fmtInput(inp));
    inp.addEventListener("focus", () => {
      // Focus bo'lganda ham formatlanganligicha qolsin
    });
  });
}

// ── Universal CSV eksport (Excel uchun) ──────────
function downloadCSV(rows, filename) {
  // HTML table orqali Excel ga export — encoding muammosi yo'q
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
  html += '<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>MERX</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>';
  rows.forEach((row, i) => {
    html += '<tr>';
    row.forEach(cell => {
      const tag = i === 0 ? 'th' : 'td';
      const val = String(cell == null ? '' : cell);
      // Raqamlarni matn sifatida saqlash (barcode uchun)
      const style = /^\d{8,}$/.test(val) ? ' style="mso-number-format:\'@\'"' : '';
      html += `<${tag}${style}>${val.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</${tag}>`;
    });
    html += '</tr>';
  });
  html += '</table></body></html>';
  
  const blob = new Blob([html], {type: 'application/vnd.ms-excel;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename.replace('.csv', '.xls');
  a.click();
  URL.revokeObjectURL(url);
}

// ── Barcode generatsiya ───────────────────────────
function genEAN13(seed) {
  const base = String(Math.abs(seed || Date.now()) % 1000000000000).padStart(12, "0");
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}
// ════════════════════════════════════════════════
// MERX — Universal chek HTML builder  v2.0
// ════════════════════════════════════════════════

function buildReceiptHtml(sale, opts) {
  opts = opts || {};
  const shopName   = opts.shopName   || (typeof db !== "undefined" && db.shop?.name) || "MERX";
  const staffName  = opts.staffName  || "—";
  const botUser    = (opts.botUsername || "").replace(/^@/, "");
  const receiptUrl = opts.receiptUrl || "";

  // Chek sozlamalari — YAGONA manbadan (1-bosqich). type: bot/PDF cheki.
  // 2026-07-18: preview uchun opts._previewCfg (saqlanmagan joriy qiymatlar) USTUN.
  const chekCfg = opts._previewCfg
                ? opts._previewCfg
                : ((typeof getChekCfg === "function") ? getChekCfg("bot")
                : ((typeof db !== "undefined" && db.settings?.chekConfig) || {}));
  const style   = opts.style || "unified";
  // 2026-07-18 (birlashtirish A): chek turi — sotuv/savat/qarz/bot.
  // savat: to'lov/qarz bloklari YO'Q (hali to'lov qilinmagan — faqat ro'yxat).
  const _type = opts.type || (sale && sale._preview ? "savat" : "sotuv");
  const logo    = chekCfg.logo    || "";   // base64 yoki bo'sh
  const contact = chekCfg.contact || "";   // do'kon telefoni
  const addr    = chekCfg.addr    || "";   // 2026-07-17: manzil (namuna params)
  const tagline = chekCfg.tagline || "Ulgurji savdo tizimi";
  const footer  = chekCfg.footer  || "Rahmat! Yana kutamiz 🙏";
  const showStaff   = chekCfg.showStaff   !== false;
  const showContact = chekCfg.showContact !== false;
  const showDebtHistory = chekCfg.showDebtHistory !== false;
  // 2026-07-18 (2-bosqich tipografiya): global shrift o'lchami/oilasi/altbilgi
  // uslubi. zoom — barcha ichki o'lchamlarni (px/padding/shrift) bir tekis
  // masshtablaydi (377 ta px'ni birma-bir tuzatmasdan — regressiyasiz).
  const _fscale = (() => {
    const s = chekCfg.fontScale;
    if (s === "small") return 0.9;
    if (s === "large") return 1.12;
    if (s === "xlarge") return 1.25;
    const n = parseFloat(s);
    return (n >= 0.7 && n <= 1.5) ? n : 1;
  })();
  const _ffamily = (() => {
    const f = chekCfg.fontFamily;
    // 2026-07-20: 20 ta veb-xavfsiz shrift (termal printer + brauzerda ishonchli)
    const _fontMap = {
      dm:        "'DM Sans', sans-serif",
      sans:      "'Arial', sans-serif",
      serif:     "'Georgia', serif",
      mono:      "'Courier New', monospace",
      helvetica: "'Helvetica Neue', Helvetica, sans-serif",
      verdana:   "'Verdana', sans-serif",
      tahoma:    "'Tahoma', sans-serif",
      trebuchet: "'Trebuchet MS', sans-serif",
      segoe:     "'Segoe UI', sans-serif",
      calibri:   "'Calibri', sans-serif",
      century:   "'Century Gothic', sans-serif",
      times:     "'Times New Roman', serif",
      garamond:  "'Garamond', serif",
      palatino:  "'Palatino Linotype', 'Book Antiqua', serif",
      cambria:   "'Cambria', serif",
      consolas:  "'Consolas', monospace",
      lucida:    "'Lucida Console', monospace",
      impact:    "'Impact', sans-serif",
      franklin:  "'Franklin Gothic Medium', sans-serif",
      system:    "system-ui, -apple-system, sans-serif"
    };
    return _fontMap[f] || _fontMap.dm;
  })();
  const _footItalic = chekCfg.footerItalic !== false; // standart kursiv
  const _footBold   = chekCfg.footerBold === true;
  // 2026-07-18 (Qadam D-1): BLOK-DARAJALI tahrir. Har blok uchun
  // {size, bold, italic, align, show}. Standart qiymatlar = HOZIRGI ko'rinish
  // (admin tegmasa hech narsa o'zgarmaydi — regressiya himoyasi).
  const _blocks = chekCfg.blocks || {};
  const _blk = (name, dSize, dWeight, dStyle, dAlign) => {
    const b = _blocks[name] || {};
    const sz = parseInt(b.size);
    return {
      size:   (sz >= 6 && sz <= 40) ? sz + "px" : dSize,
      weight: b.bold === true ? "800" : (b.bold === false ? "400" : dWeight),
      style:  b.italic === true ? "italic" : (b.italic === false ? "normal" : dStyle),
      align:  ["left","center","right","justify"].includes(b.align) ? b.align : dAlign,
      show:   b.show !== false
    };
  };
  const _bShop  = _blk("shop",     "20px", "800", "normal", "center");
  const _bTag   = _blk("tagline",  "9.5px","400", "normal", "center");
  const _bMeta  = _blk("meta",     "12px", "500", "normal", "left");
  const _bIName = _blk("itemName", "13px", "400", "normal", "left");
  const _bIPrice= _blk("itemPrice","11px", "400", "normal", "left");
  const _bTotal = _blk("total",    "20px", "800", "normal", "left");
  const _bDebt  = _blk("debt",     "12px", "600", "normal", "left");
  const _bFoot  = _blk("footer",   "13px", "400", "normal", "center");
  // 2026-07-18: sarlavha (banner) fon uslubi — termal printer uchun muhim.
  // dark: qora fon oq yozuv (ekranда chiroyli, bosmada qora). light: oq fon
  // qora yozuv (bosmaga eng mos). none: fonsiz. Standart: dark (hozirgidek).
  const _hdrStyle = ["dark","light","none"].includes(chekCfg.headerStyle) ? chekCfg.headerStyle : "dark";
  const _hdrCss = _hdrStyle === "light"
      ? "background:#fff;color:#0D1B2A;border-bottom:2px solid #0D1B2A"
      : _hdrStyle === "none"
      ? "background:#fff;color:#0D1B2A"
      : "background:#0D1B2A;color:#fff";
  const _hdrSubColor = _hdrStyle === "dark" ? "#fff" : "#000";

  // Ixcham uslub uchun — faqat asosiylarni ko'rsatish
  const _cfg = {shopName,staffName,botUser,receiptUrl,logo,contact,footer,showStaff,showContact,F:n=>Math.round(n||0).toLocaleString("ru-RU")};
  if (style === "compact")   return buildReceiptCompact(sale, opts, _cfg);
  if (style === "table")     return buildReceiptTable(sale, opts, _cfg);
  if (style === "thermal")   return buildReceiptThermal(sale, opts, _cfg);
  if (style === "wholesale") return buildReceiptWholesale(sale, opts, _cfg);
  if (style === "merx")      return buildReceiptMerx(sale, opts, _cfg);

  // ── Maydonlar normalizatsiyasi ─────────────────
  const chekNum   = sale.chekNum    || sale.chek_num    || ("#" + sale.id);
  const rawDate   = sale.date || "";
  const date      = rawDate.includes("-") && rawDate.length === 10
    ? rawDate.split("-").reverse().join(".")   // 2026-06-16 → 16.06.2026
    : rawDate;
  const time      = sale.time       || "";
  const payType   = sale.payType    || sale.pay_type    || "";
  const payBreakdown = sale.payBreakdown || sale.pay_breakdown || null;
  const custName  = sale.customerName || sale.customer_name || "";
  const custPhone = sale.customerPhone || sale.customer_phone || "";
  const total     = Number(sale.total     || 0);
  const paid      = Number(sale.paid      || 0);
  // 2026-07-25: CHEK ASL HOLATNI ko'rsatadi. Qaytarish yoki keyingi
  // to'lovlar sotuvning joriy qoldig'ini o'zgartiradi, lekin CHEK
  // sotuv paytida qanday bo'lgan bo'lsa shunday qolishi kerak.
  // origRemaining — sotuv paytidagi asl qarz (bor bo'lsa ustuvor).
  const remaining = Number(sale.origRemaining != null ? sale.origRemaining : (sale.remaining || 0));
  const discount  = Number(sale.discount  || 0);
  const due       = sale.due  || "";
  const note      = sale.note || "";
  const debtCur   = sale.debtCurrency || sale.debt_currency || "uzs";
  const debtUsd   = sale.origDebtUsd != null ? Number(sale.origDebtUsd)
                  : (sale.debtUsd != null ? Number(sale.debtUsd)
                  : (sale.debt_usd != null ? Number(sale.debt_usd) : null));
  const prevUsd   = sale.prevDebtUsd != null ? Number(sale.prevDebtUsd) : null;
  const prevUzs   = sale.prevDebtUzs != null ? Number(sale.prevDebtUzs) : null;
  const isUsd     = debtCur === "usd" && debtUsd != null;
  const items     = (sale.items || []).filter(Boolean);

  const payLabels = { naqd: "Naqd pul", karta: "Karta", otkazma: "Bank o'tkazmasi", aralash: "Aralash" };
  const F = n => Math.round(n || 0).toLocaleString("ru-RU");
  // 2026-07-20: tovar narxini valyutaga qarab ko'rsatuvchi helper.
  // priceCurrency "both" bo'lsa: "540 000 / $42.19"; aks holda avvalgidek so'm.
  // (Faqat tovar narx qatorlarida ishlatiladi — jami/to'lov F() da qoladi.)
  // 2026-07-25: CHEK MUZLATILADI — sotuv paytidagi valyuta rejimi va kursi
  // ishlatiladi. Keyin sozlama o'zgarsa (so'm → ikki valyuta) yoki kurs
  // o'zgarsa, ESKI CHEK O'ZGARMAYDI. Eski sotuvlarda (maydon yo'q) joriy
  // sozlamaga tayanamiz — ular uchun boshqa manba yo'q.
  const _pcMode = sale.priceCurrency || db.settings?.priceCurrency || "uzs";
  const _pcRate = Number(sale.rate) || Number(db.settings?.rate) || 12800;
  const FC = n => {
    const som = Math.round(n || 0);
    if (_pcMode === "both") {
      const usd = _pcRate > 0 ? (som / _pcRate) : 0;
      return F(som) + " / $" + usd.toLocaleString("ru-RU", {minimumFractionDigits:2, maximumFractionDigits:2});
    }
    if (_pcMode === "usd") {
      const usd = _pcRate > 0 ? (som / _pcRate) : 0;
      return "$" + usd.toLocaleString("ru-RU", {minimumFractionDigits:2, maximumFractionDigits:2});
    }
    return F(som);
  };

  // ── Mahsulotlar ───────────────────────────────
  // 2026-07-19: UMUMIY chegirmani chekda har tovarga FOYDAGA MUTANOSIB
  // taqsimlash (faqat CHEK ko'rinishi — summa/foyda/qarz TEGILMAYDI).
  // Butun sonlarda; qoldiq oxirgi (chegirma olgan) tovarga — pul yo'qolmaydi.
  // Tannarx (i.cost) faqat ICHKI hisob uchun — mijozga KO'RINMAYDI.
  const _discTotal = Number(sale.discount) || 0;
  const _itemDiscMap = {}; // index -> shu tovarga tushgan chegirma (so'm, jami)
  if (_discTotal > 0 && items.length) {
    // Har tovar foydasi = (narx - tannarx) * qty. Tannarx bo'lmasa (eski chek) — narx.
    const profits = items.map(i => {
      const line = (i.price || 0) * (i.qty || 0);
      const cost = (i.cost != null ? i.cost : 0) * (i.qty || 0);
      const p = line - cost;
      return p > 0 ? p : 0; // manfiy/nol foyda — 0 (chegirma olmaydi)
    });
    let totProfit = profits.reduce((a, b) => a + b, 0);
    // Agar hech kimda foyda yo'q (yoki tannarx yo'q) — narxga mutanosib zaxira
    let weights = profits, totW = totProfit;
    if (totW <= 0) {
      weights = items.map(i => (i.price || 0) * (i.qty || 0));
      totW = weights.reduce((a, b) => a + b, 0);
    }
    if (totW > 0) {
      let allocated = 0, lastIdx = -1;
      items.forEach((i, ix) => { if (weights[ix] > 0) lastIdx = ix; });
      items.forEach((i, ix) => {
        if (ix === lastIdx) {
          _itemDiscMap[ix] = _discTotal - allocated; // qoldiq oxirgiga (pul yo'qolmasin)
        } else if (weights[ix] > 0) {
          const share = Math.round(_discTotal * weights[ix] / totW);
          _itemDiscMap[ix] = share;
          allocated += share;
        } else {
          _itemDiscMap[ix] = 0;
        }
      });
    }
  }
  // Tovarning chekda ko'rsatiladigan (chegirma taqsimlangan) DONA narxi
  const _effPrice = (i, ix) => {
    const d = _itemDiscMap[ix] || 0;
    if (d <= 0 || !(i.qty > 0)) return { price: i.price, base: i.basePrice };
    const perUnit = d / i.qty;
    const newPrice = Math.max(0, Math.round((i.price || 0) - perUnit));
    // eski narx = chegirmadan oldingi narx (basePrice bo'lsa u, aks holda price)
    const oldBase = (i.basePrice && i.basePrice > (i.price||0)) ? i.basePrice : i.price;
    return { price: newPrice, base: oldBase };
  };
  // 2026-07-17: POS sotuv cheki bilan BIR XIL format —
  // "TOVAR / Rang / ART" + "2pch × (6 dona × ~~550 000~~ 540 000) = ..."
  const itemsHtml = items.map((i, _ix) => {
    const _ep   = _effPrice(i, _ix);
    const _pr   = _ep.price;
    const sum   = _pr * (i.qty || 0);
    const clean = (i.variant || "").replace(/\(\d+ pochka\)/gi,"").replace(/\(\d+ pch\)/gi,"").trim().replace(/\/\s*$/,"").trim();
    const nm    = [i.name || "", clean, i.art || ""].filter(Boolean).join(" / ");
    const _showOld = (_ep.base && _ep.base > _pr);
    const bp    = _showOld ? `<s style="color:#000;text-decoration-thickness:1px">${FC(_ep.base)}</s> ` : "";
    const isBox = i.sellMode === "karobka" && i.qtyBox && i.inBox;
    const calc  = isBox
      ? `${i.qtyBox}pch × (${i.inBox} ${i.unit||"dona"} × ${bp}${FC(_pr)}) = ${FC(sum)}`
      : `${i.qty} ${i.unit||"dona"} × ${bp}${FC(_pr)} = ${FC(sum)}`;
    return `
      <div class="it">
        <div class="it-body">
          <div class="it-name">${_ix + 1}. ${nm}</div>
          <div class="it-det">${calc}</div>
        </div>
      </div>`;
  }).join('<div class="sep-dash"></div>');

  // JAMI POCHKA va tovar chegirmalari (POS chek bilan bir xil)
  const jamiPch = items.reduce((a,i)=> a + ((i.sellMode==="karobka" && i.qtyBox) ? i.qtyBox : 0), 0);
  const itemDisc = items.reduce((a,i)=> a + ((i.basePrice && i.basePrice > (i.price||0)) ? (i.basePrice - i.price)*(i.qty||1) : 0), 0);
  // 2026-07-24: sotuvda kurs saqlanmagan bo'lsa (eski cheklar) joriy
  // kursga tayanamiz — aks holda JAMI'da USD umuman ko'rinmasdi
  const rate = Number(sale.rate) || Number(db.settings?.rate) || 0;
  // 2026-07-25: JAMI yonidagi USD FAQAT ikki valyuta rejimida chiqadi.
  // Avval rejimdan qat'i nazar chiqardi — "faqat so'm" tanlangan bo'lsa ham.
  const usdLine = (_pcMode === "both" && rate > 0)
    ? ` / $${(total / rate).toFixed(2)}` : "";

  // 2026-07-25: qaytarish eslatmasi — asl chek O'ZGARMAYDI, faqat
  // pastida "qisman qaytarilgan" belgisi va qaytarish cheki raqami turadi.
  let _refundNote = "";
  const _refs = sale.refunds || [];
  if (_refs.length) {
    const _rTot = sale.refundedTotal || _refs.reduce((a,r) => a + (r.total||0), 0);
    const _full = sale.status === "qaytarilgan";
    const _nos  = _refs.map(r => r.no).filter(Boolean).join(", ");
    _refundNote = `
      <div style="margin:8px 16px 0;padding:8px 10px;border:1px dashed #B91C1C;
        border-radius:6px;background:#FEF2F2">
        <div style="font-size:11.5px;font-weight:800;color:#B91C1C">
          ${_full ? "TO'LIQ QAYTARILGAN" : "QISMAN QAYTARILGAN"}
        </div>
        <div style="font-size:11px;color:#000;margin-top:2px">
          Qaytarilgan summa: <b>${F(_rTot)} so'm</b>
        </div>
        ${_nos ? `<div style="font-size:10.5px;color:#000;margin-top:1px">
          Qaytarish cheki: ${_nos}</div>` : ""}
      </div>`;
  }

  // ── To'lov bo'limi ────────────────────────────
  const discHtml = discount > 0
    ? `<div class="pr"><span>Chegirma</span><span class="c-red">− ${FC(discount)}</span></div>` : "";

  // 2026-07-25: QARZ ham ikki valyutada — "2 400 000 / $200".
  // Kurs SOTUV PAYTIDAGI (_pcRate) — keyin o'zgarsa ham chek o'zgarmaydi.
  // "usd" rejimida avvalgidek faqat $ (bu ataylab shunday edi).
  // Format: "2 400 000 / 12 000 = $200.00"
  //   so'm summasi ÷ SOTUV PAYTIDAGI kurs = dollar qiymati.
  //   Kurs ko'rsatilishi shart: keyin kurs o'zgarsa ham, qarz qaysi
  //   kurs bo'yicha hisoblanganini chekdan bilib olish mumkin bo'lsin.
  const FD = (som, usd) => {
    const _s = F(Math.round(som || 0));
    const _u = (usd != null ? usd : (_pcRate > 0 ? (som || 0) / _pcRate : 0));
    const _uStr = "$" + _u.toLocaleString("ru-RU",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (_pcMode === "usd")  return _uStr;
    if (_pcMode === "both") return _s + " / " + F(_pcRate) + " = " + _uStr;
    return _s + " so'm";
  };

  let debtHtml = "";
  if (remaining > 0) {
    if (showDebtHistory && isUsd && prevUsd > 0) {
      const tot = prevUsd + debtUsd;
      // 2026-07-25: OLDINGI va KEYINGI qarz — allaqachon USD da QOTGAN,
      // ular turli kurslarda yig'ilgan. Ularni qayta hisoblash MUMKIN EMAS.
      // Faqat SHU XARIDDA qo'shilayotgan summa so'mdan aylantiriladi.
      const _added = (_pcRate > 0)
        ? `${F(remaining)} / ${F(_pcRate)} = $${debtUsd.toFixed(2)}`
        : `$${debtUsd.toFixed(2)}`;
      debtHtml = `
        <div class="sep-dash" style="margin:6px 0"></div>
        <div class="pr pr-sm"><span>Xariddan oldingi qarz</span><span>$${prevUsd.toFixed(2)}</span></div>
        <div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>${_added}</span></div>
        <div class="pr pr-debt"><span>Xariddan keyingi qarz</span><span>$${tot.toFixed(2)} USD</span></div>`;
    } else if (showDebtHistory && !isUsd && prevUzs > 0) {
      // Qarz so'mda yuritiladi — oldingi va keyingi summalar SO'MDA qoladi.
      // Faqat qo'shilayotgan summa yonida joriy kurs bo'yicha USD ko'rsatiladi.
      const _added = ((_pcMode === "both" || _pcMode === "usd") && _pcRate > 0)
        ? `${F(remaining)} / ${F(_pcRate)} = $${(remaining / _pcRate).toFixed(2)}`
        : `${F(remaining)} so'm`;
      debtHtml = `
        <div class="sep-dash" style="margin:6px 0"></div>
        <div class="pr pr-sm"><span>Xariddan oldingi qarz</span><span>${F(prevUzs)} so'm</span></div>
        <div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>${_added}</span></div>
        <div class="pr pr-debt"><span>Xariddan keyingi qarz</span><span>${F(prevUzs + remaining)} so'm</span></div>`;
    } else {
      // 2026-07-25: dollar ishlatiladigan HAR QANDAY rejimda (both/usd)
      // qarz "summa / kurs = $" ko'rinishida — qaysi kursda hisoblangani
      // chekdan ko'rinsin va keyin kurs o'zgarsa ham o'zgarmasin.
      const _usdMode = (_pcMode === "both" || _pcMode === "usd");
      const _dUsd = isUsd ? debtUsd : (_pcRate > 0 ? remaining / _pcRate : 0);
      const amt = _usdMode
        ? `${F(remaining)} / ${F(_pcRate)} = $${_dUsd.toFixed(2)}`
        : `${F(remaining)} so'm`;
      debtHtml = `<div class="pr pr-debt"><span>Qarzga</span><span>${amt}</span></div>`;
    }
    if (due) debtHtml += `<div class="pr pr-sm"><span>To'lov muddati</span><span class="c-red">${due}</span></div>`;
  } else {
    // 2026-07-19: to'liq to'langan sotuvда ham mijozning MAVJUD qarzi.
    // MUHIM: to'lovда debtUsd=0 bo'lgani uchun isUsd=false bo'lib qoladi —
    // valyutani MAVJUD qarzga qarab aniqlaymiz (aks holda $ qarz "0 so'm" edi).
    const _pdUsd = Number(prevUsd) || 0, _pdUzs = Number(prevUzs) || 0;
    const _pIsUsd = _pdUsd > 0;
    const _pd = _pIsUsd ? _pdUsd : _pdUzs;
    if (showDebtHistory && _pd > 0) {
      // 2026-07-25: MAVJUD qarz — turli kurslarda yig'ilgan, QOTGAN.
      // Uni joriy kursga aylantirish ma'lumotni buzadi (avval shunday
      // qilingan edi — tuzatildi). Qanday saqlangan bo'lsa shunday chiqadi.
      const P = v => _pIsUsd ? `$${Number(v||0).toFixed(2)}` : `${F(v||0)} so'm`;
      debtHtml = `
        <div class="sep-dash" style="margin:6px 0"></div>
        <div class="pr pr-sm"><span>Xariddan oldingi qarz</span><span>${P(_pd)}</span></div>
        <div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>${P(0)}</span></div>
        <div class="pr pr-debt"><span>Xariddan keyingi qarz</span><span>${P(_pd)}${_pIsUsd ? " USD" : ""}</span></div>`;
    } else {
      debtHtml = `<div class="paid-ok">✓ To'liq to'landi</div>`;
    }
  }

  const botHtml  = botUser    ? `<div class="ft-bot">Cheklarni Telegramda olish: <b>@${botUser}</b></div>` : "";
  const pdfHtml  = receiptUrl ? `<div class="ft-pdf"><a href="${receiptUrl}" target="_blank">📄 Chekni yuklab olishingiz mumkin</a></div>` : "";
  const noteHtml = note       ? `<div class="note-wrap"><span class="note-lbl">Izoh</span><span>${note}</span></div>` : "";

  // Logo HTML
  const logoHtml = logo
    ? `<div style="text-align:center;padding:10px 0 4px"><img src="${logo}" style="max-height:60px;max-width:180px;object-fit:contain"></div>`
    : ``;

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:${_ffamily};background:#F2F0EB;display:flex;justify-content:center;padding:20px 8px}
.wrap{width:340px;max-width:100%;zoom:${_fscale}}
.rc{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(13,27,42,.12)}

/* HEAD */
.hd{${_hdrCss};padding:18px 20px 14px;text-align:center}
.hd-logo{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;letter-spacing:1.5px}
.hd-sub{font-size:${_bTag.size} !important;font-weight:${_bTag.weight} !important;font-style:${_bTag.style} !important;color:${_hdrSubColor};letter-spacing:2px;text-transform:uppercase;margin-top:3px;text-align:${_bTag.align} !important}
${!_bTag.show ? ".hd-sub{display:none !important}" : ""}

/* META */
.meta{padding:10px 16px;font-size:11.5px;border-bottom:1px dashed #E8E5E0}
.mr{display:flex;justify-content:space-between;padding:2px 0;color:#000}
.mr b{color:#000;font-weight:600;text-align:right;max-width:60%}
.sep{border-top:1px solid #ddd;margin:5px 0}

/* NOTE */
.note-wrap{padding:7px 16px;background:#FFFBEB;border-bottom:1px dashed #FDE68A;font-size:11.5px;color:#92400E;display:flex;gap:8px}
.note-lbl{font-weight:700;white-space:nowrap}

/* ITEMS */
.it-lbl{padding:8px 16px 4px;font-size:9.5px;font-weight:700;color:#000;letter-spacing:1.5px;text-transform:uppercase}
.items{padding:0 16px}
.it{display:flex;gap:8px;padding:9px 0;align-items:flex-start}
.it-num{font-size:10px;color:#000;font-weight:700;min-width:13px;padding-top:3px}
.it-body{flex:1;min-width:0}
.it-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.it-name{font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#000;flex:1}
.it-sku{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;color:#000;display:block;margin-top:1px}
.it-sum{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#000;white-space:nowrap}
.it-det{font-size:11px;color:#000;margin-top:2px}
.it-box{font-size:10.5px;color:#9A6E1A;margin-top:2px;font-weight:600}
.sep-dash{border-top:1px dashed #ccc}

/* JAMI */
.tot{margin:0 16px;padding:9px 0;border-top:2px solid #0D1B2A;border-bottom:1px dashed #ccc;display:flex;justify-content:space-between;align-items:center}
.tot-lbl{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#000;letter-spacing:.5px}
.tot-cnt{font-size:9.5px;color:#000;margin-top:2px;font-weight:500}
.tot-val{font-family:'Sora',sans-serif;font-weight:800;font-size:20px;color:#000}
.tot-uzs{font-size:12px;font-weight:600}

/* TO'LOV */
.pay{padding:9px 16px 10px;border-bottom:1px dashed #ccc}
.pay-lbl{font-size:9.5px;font-weight:700;color:#000;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.pr{display:flex;justify-content:space-between;font-size:13px;color:#000;padding:3px 0;font-weight:500}
.pr.pr-sm{font-size:11px;color:#000}
.pr.pr-sm span:last-child{color:#000}
.pr.pr-debt{border-top:1px dashed #fca5a5;margin-top:3px;padding-top:5px;font-weight:700;color:#dc2626;font-size:13px}
.c-red{color:#dc2626!important;font-weight:600}
.paid-ok{text-align:center;background:#ECFDF5;color:#059669;font-weight:700;font-size:12px;border-radius:8px;padding:6px;margin-top:4px}

/* FOOTER */
.ft{padding:12px 16px 16px;text-align:center}
.ft-thanks{font-family:'Sora',sans-serif;font-weight:${_bFoot.weight};font-style:${_bFoot.style};font-size:${_bFoot.size};color:#000;text-align:${_bFoot.align}}
.ft-date{font-size:10px;color:#000;margin-top:2px}
.ft-bot{font-size:11px;color:#229ED9;margin-top:8px;line-height:1.4}
.ft-pdf{margin-top:5px}
.ft-pdf a{font-size:11.5px;color:#000;font-weight:600;text-decoration:none;background:#F0EDE8;padding:5px 14px;border-radius:20px;display:inline-block}

/* ACTIONS */
.acts{max-width:340px;margin:10px auto 0;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:10px;padding:11px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}
.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #E8E5E0!important}
/* 2026-07-18 (Qadam D-1): blok-darajali sozlamalar (standart=hozirgi) */
.hd-logo{font-size:${_bShop.size} !important;font-weight:${_bShop.weight} !important;font-style:${_bShop.style} !important}
.hd{text-align:${_bShop.align} !important}
.meta .mr{font-size:${_bMeta.size} !important;font-weight:${_bMeta.weight} !important;font-style:${_bMeta.style} !important;text-align:${_bMeta.align} !important}
.it-name{font-size:${_bIName.size} !important;font-weight:${_bIName.weight} !important;font-style:${_bIName.style} !important;text-align:${_bIName.align === "justify" ? "left" : _bIName.align} !important}
.it-det{font-size:${_bIPrice.size} !important;font-weight:${_bIPrice.weight} !important;font-style:${_bIPrice.style} !important;text-align:${_bIPrice.align === "justify" ? "left" : _bIPrice.align} !important}
${_bIPrice.align === "justify" ? ".it-det{display:flex !important;justify-content:space-between !important;gap:8px}" : ""}
${_bIName.align === "justify" ? ".it{display:flex !important;flex-wrap:wrap;justify-content:space-between !important}.it-name{flex:1 1 auto}" : ""}
.tot-val{font-size:${_bTotal.size} !important;font-weight:${_bTotal.weight} !important;font-style:${_bTotal.style} !important}
.pr-debt,.pay .pr{font-size:${_bDebt.size} !important;font-weight:${_bDebt.weight} !important;font-style:${_bDebt.style} !important}
${!_bMeta.show ? ".meta{display:none !important}" : ""}
${!_bDebt.show ? ".pay,.pr-debt{display:none !important}" : ""}
${!_bFoot.show ? ".ft-thanks{display:none !important}" : ""}
@media print{
  @page{size:${chekCfg.paperWidth || 72}mm auto;margin:0}
  body{background:#fff;padding:0}
  .wrap,.rc{border-radius:0;box-shadow:none;width:${chekCfg.paperWidth || 72}mm;max-width:${chekCfg.paperWidth || 72}mm}
  .acts{display:none}
  /* 2026-07-18: barcha PRINTERLAR oq-qora — hamma yozuv SOF QORA (xira rang yo'q) */
  .wrap, .wrap *{color:#000 !important}
  .hd{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  ${_hdrStyle === "dark" ? ".hd, .hd *{color:#fff !important}" : ".hd, .hd *{color:#000 !important}"}
  .pr.pr-debt{border-top:1px solid #999}
  .paid-ok{background:#eee !important}
  s{text-decoration-thickness:1.5px}
}
</style></head><body>
<div class="wrap">
  <div class="rc">

    ${logoHtml}
    <div class="hd">
      <div class="hd-logo">${shopName.toUpperCase()}</div>
      <div class="hd-sub">${tagline}</div>
      <!-- 2026-07-24 (№1): shior ostidagi telefon OLIB TASHLANDI —
           u pastdagi "Kontaktlar" qatorida allaqachon bor edi (takror) -->
    </div>

    <div class="meta">
      <div class="mr"><span>${_type === "savat" ? "Savat" : "Sotuv"}</span><b>${_type === "savat" ? "OLDINDAN KO'RISH" : chekNum}</b></div>
      ${addr ? `<div class="mr"><span>Do'kon</span><b>${addr}</b></div>` : ""}
      <div class="mr"><span>Sana</span><b>${date} ${time}</b></div>
      ${showStaff && staffName && staffName !== "—" ? `<div class="mr"><span>Sotuvchi / Kassir</span><b>${staffName}</b></div>` : ""}
      ${showContact && contact ? `<div class="mr"><span>Kontaktlar</span><b>${contact}</b></div>` : ""}
      <div class="mr"><span>Mijoz</span><b>${custName || "Noma'lum"}</b></div>
      ${custPhone ? `<div class="mr"><span>Mijoz raqami</span><b>${custPhone}</b></div>` : ""}
    </div>

    ${noteHtml}

    <div class="it-lbl">Mahsulotlar</div>
    <div class="items">
      ${itemsHtml}
    </div>

    ${jamiPch > 0 ? `<div class="pr" style="padding:5px 16px;font-weight:800;border-top:1px dashed #ddd"><span>JAMI POCHKA</span><span>${jamiPch} pochka</span></div>` : ""}
    ${(itemDisc + discount) > 0 ? `
    <div class="pr" style="padding:4px 16px 0"><span>Jami (chegirmasiz)</span><span>${FC(total + itemDisc + discount)}</span></div>` : ""}
    ${itemDisc > 0 ? `<div class="pr" style="padding:2px 16px;color:#B91C1C;font-weight:700"><span>Tovar chegirmalari</span><span>−${FC(itemDisc)}</span></div>` : ""}
    ${discount > 0 ? `<div class="pr" style="padding:2px 16px"><span>Umumiy chegirma</span><span class="c-red">− ${FC(discount)}</span></div>` : ""}
    <div class="tot">
      <div>
        <div class="tot-lbl">JAMI</div>
        <div class="tot-cnt">${items.length} xil · ${items.reduce((a,i)=>a+(+i.qty||0),0)} dona</div>
      </div>
      <div class="tot-val">${F(total)}<span class="tot-uzs"> so'm${usdLine}</span></div>
    </div>

    ${_type === "savat" ? `
    <div class="pay">
      <div class="pay-lbl">Savat (oldindan ko'rish)</div>
      <div class="pr" style="color:#92400E;font-weight:600"><span>Holat</span><span>Hali sotuv yakunlanmagan</span></div>
    </div>` : `
    <div class="pay">
      <div class="pay-lbl">To'lov</div>
      <div class="pr"><span>To'lov turi</span><b style="color:#000">${payLabels[payType]||payType||"—"}</b></div>
      ${payType === "aralash" && payBreakdown ? Object.entries(payBreakdown).map(([m,v]) =>
        `<div class="pr" style="padding-left:10px"><span style="color:#000">${payLabels[m]||m}</span><span style="color:#000">${FC(v)}</span></div>`
      ).join("") : ""}
      <div class="pr"><span>To'landi</span><span style="color:#059669;font-weight:700">${FC(paid)}</span></div>
      ${debtHtml}
    </div>`}
    ${_refundNote}

    <div class="ft">
      <div class="ft-thanks">${footer}</div>
      ${(Array.isArray(chekCfg.extraLines) && chekCfg.extraLines.length) ? `<div style="text-align:center;font-size:11px;color:#333;padding:2px 0 4px">${chekCfg.extraLines.filter(Boolean).map(t=>`<div>${t}</div>`).join("")}</div>` : ""}
      <div class="ft-date">${shopName} · ${date}</div>
      ${botHtml}
      ${pdfHtml}
    </div>

  </div>
  <div class="acts">
    <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
    <button class="btn-c" onclick="window.close?window.close():history.back()">Yopish</button>
  </div>
</div>
</body></html>`;
}

// ════════════════════════════════════════════════
// COMPACT CHEK — ixcham, qisqa
// ════════════════════════════════════════════════
function buildReceiptCompact(sale, opts, cfg) {
  const {shopName, staffName, botUser, receiptUrl, logo, contact, footer, showStaff, showContact, F} = cfg;
  const chekNum  = sale.chekNum || ("#" + sale.id);
  const date     = (sale.date||"").split("-").reverse().join(".");
  const time     = sale.time || "";
  const total    = Number(sale.total || 0);
  const paid     = Number(sale.paid  || 0);
  const remaining= Number(sale.remaining || 0);
  const discount = Number(sale.discount  || 0);
  const items    = (sale.items||[]).filter(Boolean);
  const payLabels= {naqd:"Naqd",karta:"Karta",otkazma:"O'tkazma",aralash:"Aralash"};
  const isUsd    = sale.debtCurrency === "usd" && sale.debtUsd;
  const debtAmt  = isUsd ? `$${Number(sale.debtUsd).toFixed(2)}` : `${F(remaining)} so'm`;
  const logoHtml = logo ? `<div style="text-align:center;padding:8px 0 2px"><img src="${logo}" style="max-height:50px;max-width:160px;object-fit:contain"></div>` : "";

  const itemRows = items.map((i,idx) =>
    `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px dashed #eee">
      <span style="flex:1;min-width:0;overflow:hidden">${idx+1}. ${i.name} <span style="color:#aaa">${i.variant||""}</span></span>
      <span style="white-space:nowrap;margin-left:8px;font-weight:700">${i.qty}×${F(i.price)} = ${F(i.price*i.qty)}</span>
    </div>`
  ).join("");

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#f5f5f5;display:flex;justify-content:center;padding:16px 8px}
.w{width:300px;max-width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
.hd{background:#0D1B2A;padding:12px 14px;text-align:center;color:#fff}
.hd-n{font-size:17px;font-weight:800;letter-spacing:1px}
.hd-s{font-size:9px;color:#fff;letter-spacing:2px;text-transform:uppercase;margin-top:2px}
.info{padding:8px 12px;font-size:11px;border-bottom:1px dashed #ddd;color:#000;display:flex;flex-wrap:wrap;gap:2px 16px}
.items{padding:6px 12px}
.tot{margin:0 12px;padding:7px 0;border-top:2px solid #0D1B2A;display:flex;justify-content:space-between;font-size:14px;font-weight:800;color:#0D1B2A}
.pay{padding:6px 12px;font-size:11.5px;border-top:1px dashed #ddd}
.pr{display:flex;justify-content:space-between;padding:2px 0}
.ok{background:#ECFDF5;color:#059669;font-weight:700;font-size:11px;text-align:center;padding:5px;border-radius:6px;margin-top:4px}
.debt{color:#dc2626;font-weight:700}
.ft{padding:8px 12px;text-align:center;font-size:11px;color:#000;border-top:1px dashed #ddd}
.acts{max-width:300px;margin:8px auto 0;display:flex;gap:6px}
.acts button{flex:1;border:none;border-radius:8px;padding:9px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #ddd}
@media print{body{background:#fff;padding:0}.w{border-radius:0;box-shadow:none;width:72mm}.acts{display:none}}
</style></head><body>
<div class="w">
  ${logoHtml}
  <div class="hd">
    <div class="hd-n">${shopName.toUpperCase()}</div>
    <div class="hd-s">Savdo cheki</div>
    ${showContact && contact ? `<div style="font-size:10px;color:#fff;margin-top:2px">${contact}</div>` : ""}
  </div>
  <div class="info">
    <span><b>${chekNum}</b></span>
    <span>${date} ${time}</span>
    ${showStaff && staffName && staffName!=="—" ? `<span>Kassir: ${staffName}</span>` : ""}
    ${sale.customerName ? `<span>Mijoz: ${sale.customerName}</span>` : ""}
  </div>
  <div class="items">${itemRows}</div>
  <div class="tot">
    <span>JAMI <span style="font-size:10px;font-weight:500;color:#000">(${items.length} xil)</span></span>
    <span>${F(total)} so'm</span>
  </div>
  <div class="pay">
    ${discount > 0 ? `<div class="pr"><span>Chegirma</span><span style="color:#dc2626">−${F(discount)} so'm</span></div>` : ""}
    <div class="pr"><span>${payLabels[sale.payType]||sale.payType||"—"}</span><span style="color:#059669;font-weight:700">${F(paid)} so'm</span></div>
    ${remaining > 0
      ? `<div class="pr debt"><span>Qarz</span><span>${debtAmt}</span></div>
         ${sale.due ? `<div class="pr" style="font-size:10px;color:#aaa"><span>Muddat</span><span>${sale.due}</span></div>` : ""}`
      : `<div class="ok">✓ To'liq to'landi</div>`}
  </div>
  <div class="ft">${footer}<br><span style="font-size:10px">${shopName} · ${date}</span></div>
</div>
<div class="acts">
  <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
  <button class="btn-c" onclick="window.close?window.close():history.back()">Yopish</button>
</div>
</body></html>`;
}

// ════════════════════════════════════════════════
// TABLE CHEK — jadval ko'rinishida (USD+UZS)
// ════════════════════════════════════════════════
function buildReceiptTable(sale, opts, cfg) {
  const {shopName, staffName, botUser, receiptUrl, logo, contact, footer, showStaff, showContact, F} = cfg;
  const chekNum  = sale.chekNum || ("#" + sale.id);
  const date     = (sale.date||"").split("-").reverse().join(".");
  const time     = sale.time || "";
  const total    = Number(sale.total || 0);
  const paid     = Number(sale.paid  || 0);
  const remaining= Number(sale.remaining || 0);
  const discount = Number(sale.discount  || 0);
  const items    = (sale.items||[]).filter(Boolean);
  const rate     = (typeof db !== "undefined" && db.settings?.rate) || 12800;
  const payLabels= {naqd:"Naqd",karta:"Karta",otkazma:"O'tkazma",aralash:"Aralash"};
  const isUsd    = sale.debtCurrency === "usd" && sale.debtUsd;
  const debtAmt  = isUsd ? `$${Number(sale.debtUsd).toFixed(2)}` : `${F(remaining)} so'm`;
  const logoHtml = logo ? `<div style="text-align:center;padding:8px 0 0"><img src="${logo}" style="max-height:55px;max-width:170px;object-fit:contain"></div>` : "";

  const itemRows = items.map((i,idx) => {
    const sumUzs = (i.price||0) * (i.qty||0);
    const sumUsd = sumUzs / rate;
    return `<tr>
      <td style="padding:5px 6px;border:1px solid #ddd;font-size:11px">${idx+1}</td>
      <td style="padding:5px 6px;border:1px solid #ddd;font-size:11px">
        <div style="font-weight:700">${i.name}</div>
        <div style="font-size:10px;color:#000">${i.variant||""}</div>
      </td>
      <td style="padding:5px 6px;border:1px solid #ddd;font-size:11px;text-align:center">${i.qty}</td>
      <td style="padding:5px 6px;border:1px solid #ddd;font-size:11px;text-align:right">
        <div>${(i.price/rate).toFixed(2)}</div>
        <div style="color:#000">${F(i.price)}</div>
      </td>
      <td style="padding:5px 6px;border:1px solid #ddd;font-size:11px;text-align:right;font-weight:700">
        <div>${sumUsd.toFixed(2)}</div>
        <div style="color:#000">${F(sumUzs)}</div>
      </td>
    </tr>`;
  }).join("");

  const totalUsd = total / rate;
  const paidUsd  = paid  / rate;
  const debtUsd2 = remaining / rate;

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#f5f5f5;display:flex;justify-content:center;padding:16px 8px}
.w{width:380px;max-width:100%;background:#fff;border-radius:10px;padding:14px;box-shadow:0 2px 12px rgba(0,0,0,.1)}
.shop{font-size:20px;font-weight:800;text-align:center;letter-spacing:1px;color:#0D1B2A;margin-bottom:2px}
.sub{font-size:10px;color:#aaa;text-align:center;margin-bottom:8px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;margin-bottom:10px;padding:8px;background:#f9f9f9;border-radius:6px}
.info-grid span{color:#000}.info-grid b{color:#0D1B2A}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
th{background:#0D1B2A;color:#fff;padding:6px;font-size:10px;text-align:center}
th:first-child,th:nth-child(3){width:30px}
.col-cur{font-size:9px;color:#ccc;font-weight:400}
.tot-row td{background:#f0f0f0;font-weight:800;font-size:12px;padding:6px}
.pay-row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px dashed #eee}
.debt{color:#dc2626;font-weight:700}
.ok{background:#ECFDF5;color:#059669;font-weight:700;font-size:11px;text-align:center;padding:5px;border-radius:6px;margin-top:4px}
.ft{text-align:center;font-size:11px;color:#000;margin-top:10px;padding-top:8px;border-top:1px dashed #ddd}
.acts{max-width:380px;margin:8px auto 0;display:flex;gap:6px}
.acts button{flex:1;border:none;border-radius:8px;padding:9px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #ddd}
@media print{body{background:#fff;padding:0}.w{border-radius:0;box-shadow:none;width:100%}.acts{display:none}}
</style></head><body>
<div class="w">
  ${logoHtml}
  <div class="shop">${shopName.toUpperCase()}</div>
  <div class="sub">Savdo cheki ${showContact && contact ? "· " + contact : ""}</div>
  <div class="info-grid">
    <span>Chek №</span><b>${chekNum}</b>
    <span>Sana</span><b>${date} ${time}</b>
    ${showStaff && staffName && staffName!=="—" ? `<span>Kassir</span><b>${staffName}</b>` : ""}
    ${sale.customerName ? `<span>Mijoz</span><b>${sale.customerName}</b>` : ""}
    ${sale.customerPhone ? `<span>Telefon</span><b>${sale.customerPhone}</b>` : ""}
    <span>Kurs</span><b>1$ = ${F(rate)} so'm</b>
  </div>
  <table>
    <thead>
      <tr>
        <th>№</th>
        <th>Mahsulot</th>
        <th>Qty</th>
        <th>Narx<br><span class="col-cur">$ / so'm</span></th>
        <th>Summa<br><span class="col-cur">$ / so'm</span></th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="tot-row">
        <td colspan="3" style="padding:6px;border:1px solid #ddd;text-align:right">JAMI</td>
        <td style="border:1px solid #ddd"></td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right">
          <div>${totalUsd.toFixed(2)}</div>
          <div style="color:#000">${F(total)}</div>
        </td>
      </tr>
    </tbody>
  </table>
  <div>
    ${discount > 0 ? `<div class="pay-row"><span>Chegirma</span><span style="color:#dc2626">−${F(discount)} so'm</span></div>` : ""}
    <div class="pay-row">
      <span>${payLabels[sale.payType]||sale.payType||"—"}</span>
      <span style="color:#059669;font-weight:700">${paidUsd.toFixed(2)} $ / ${F(paid)} so'm</span>
    </div>
    ${remaining > 0
      ? `<div class="pay-row debt"><span>Qarz</span><span>${isUsd ? "$"+Number(sale.debtUsd).toFixed(2) : debtUsd2.toFixed(2)+" $ / "+F(remaining)+" so'm"}</span></div>
         ${sale.due ? `<div class="pay-row" style="font-size:10px;color:#aaa"><span>Muddat</span><span>${sale.due}</span></div>` : ""}`
      : `<div class="ok">✓ To'liq to'landi</div>`}
  </div>
  <div class="ft">${footer}<br>${shopName} · ${date}</div>
</div>
<div class="acts">
  <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
  <button class="btn-c" onclick="window.close?window.close():history.back()">Yopish</button>
</div>
</body></html>`;
}

// ════════════════════════════════════════════════
// THERMAL CHEK — Korzinka uslubi, oq-qora
// 80mm termal printer, Courier font
// ════════════════════════════════════════════════
function buildReceiptThermal(sale, opts, cfg) {
  const {shopName, staffName, botUser, contact, footer, showStaff, showContact, F} = cfg;
  const chekNum  = sale.chekNum || ("#" + sale.id);
  const date     = (sale.date||"").split("-").reverse().join(".");
  const time     = sale.time || "";
  const total    = Number(sale.total    || 0);
  const subtotal = Number(sale.subtotal || total);
  const paid     = Number(sale.paid     || 0);
  const remaining= Number(sale.remaining|| 0);
  const discount = Number(sale.discount || 0);
  const items    = (sale.items||[]).filter(Boolean);
  const payType  = sale.payType || "";
  const payBreakdown = sale.payBreakdown || null;
  const isUsd    = sale.debtCurrency === "usd" && sale.debtUsd;
  const debtUsd  = Number(sale.debtUsd  || 0);
  const prevUsd  = Number(sale.prevDebtUsd || 0);
  const prevUzs  = Number(sale.prevDebtUzs || 0);
  const note     = sale.note || "";
  const due      = sale.due  || "";
  const priceType= sale.priceType || "";
  const payLabels= {naqd:"Naqd", karta:"Karta", otkazma:"Otkazma", aralash:"Aralash"};
  const W = 40;
  const EQ = "=".repeat(W);
  const DA = "-".repeat(W);

  const totalBoxes = items.reduce((a,i) => a+(i.qtyBox||0), 0);
  const totalDona  = items.reduce((a,i) => a+(i.qty||0), 0);

  // Chiziqni markazga
  const center = (s) => {
    const sp = Math.max(0, W - s.length);
    return " ".repeat(Math.floor(sp/2)) + s;
  };
  // Ikki ustun
  const lr = (l, r) => {
    const lStr = String(l), rStr = String(r);
    const gap = Math.max(1, W - lStr.length - rStr.length);
    return lStr + " ".repeat(gap) + rStr;
  };

  // TOVARLAR — 2 qator
  // Qator 1: N. Nom [ART]
  // Qator 2:   Rang  Qty x Narx = Summa
  const itemLines = items.map((it, i) => {
    const isBox   = it.sellMode === "karobka" && it.qtyBox;
    const qty     = it.qty || 0;  // jami dona soni
    const unit    = it.unit || "dona";
    const price   = it.price || 0;  // 1 dona narxi
    const sum     = price * qty;
    const art     = it.art ? ` [${it.art}]` : "";
    const color   = it.color || "";
    // Pochka bo'lsa: "(3 pchk)" ko'rsatamiz
    const pchkStr = isBox && it.qtyBox ? ` (${it.qtyBox} pchk)` : "";

    const row1 = `${i+1}. ${it.name}${art}${pchkStr}`;
    const calc  = `${color ? color+"  " : ""}${F(qty)}${unit} x ${F(price)} = ${F(sum)}`;
    return row1 + "\n   " + calc;
  }).join("\n" + DA + "\n");

  // TO'LOV
  const payLines = () => {
    const lbls = {naqd:"Naqd", karta:"Karta", otkazma:"Otkazma"};
    if (payType === "aralash" && payBreakdown) {
      return Object.entries(payBreakdown)
        .filter(([m,v]) => m !== "qarz" && v > 0)
        .map(([m,v]) => lr(lbls[m]||m+":", F(v)+" som"))
        .join("\n");
    }
    if (payType !== "qarz") return lr((payLabels[payType]||payType)+":", F(paid)+" som");
    return "";
  };

  // QARZ
  const debtLines = () => {
    if (remaining <= 0) return lr("TO'LIQ TO'LANDI", "✓");
    const dAmt = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${F(remaining)} som`;
    const lines = [lr("QARZ:", dAmt)];
    if (isUsd && prevUsd > 0) {
      lines.push(lr("  Oldingi qarz:", `$${prevUsd.toFixed(2)}`));
      lines.push(lr("  Yangi qarz:", `$${debtUsd.toFixed(2)}`));
      lines.push(lr("  JAMI QARZ:", `$${(prevUsd+debtUsd).toFixed(2)} USD`));
    } else if (!isUsd && prevUzs > 0) {
      lines.push(lr("  Oldingi qarz:", F(prevUzs)+" som"));
      lines.push(lr("  Yangi qarz:", F(remaining)+" som"));
      lines.push(lr("  JAMI QARZ:", F(prevUzs+remaining)+" som"));
    }
    if (due) lines.push(lr("  Muddat:", due));
    return lines.join("\n");
  };

  const rows = [
    EQ,
    center(shopName.toUpperCase()),
    showContact && contact ? center(contact) : null,
    priceType === "ulgurji" ? center("[ ULGURJI SAVDO ]") : null,
    EQ,
    lr("Chek: " + chekNum, date + " " + time),
    showStaff && staffName && staffName !== "—" ? ("Kassir: " + staffName) : null,
    sale.customerName ? ("Mijoz: " + sale.customerName) : null,
    sale.customerPhone ? ("Tel:   " + sale.customerPhone) : null,
    DA,
    itemLines,
    EQ,
    lr("Jami (" + (totalBoxes ? totalBoxes+" pchk" : totalDona+" dona") + "):", F(subtotal)+" som"),
    discount > 0 ? lr("Chegirma" + (sale.discountPct ? " -"+sale.discountPct+"%" : "") + ":", "-"+F(discount)+" som") : null,
    discount > 0 ? lr("TO'LOV:", F(total)+" som") : null,
    EQ,
    payLines(),
    DA,
    debtLines(),
    note ? (DA + "\nIzoh: " + note) : null,
    EQ,
    center(footer || "Rahmat! Yana kutamiz"),
    botUser ? center("@" + botUser) : null,
    EQ,
  ].filter(l => l !== null && l !== "").join("\n");

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',Courier,monospace;background:#f0f0f0;
     display:flex;flex-direction:column;align-items:center;padding:16px 8px}
.rc{background:#fff;padding:16px 14px;white-space:pre;
    font-size:13.5px;line-height:1.6;color:#000;
    width:340px;max-width:100%;
    border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.acts{width:340px;max-width:100%;margin:10px 0 0;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:7px;padding:11px;
             font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#000;color:#fff}
.btn-c{background:#fff;color:#000;border:1.5px solid #ccc}
@media print{
  body{background:#fff;padding:0}
  .rc{width:72mm;max-width:72mm;border-radius:0;box-shadow:none;
      font-size:11px;line-height:1.5;padding:4px 6px}
  .acts{display:none}
}
</style></head><body>
<div class="rc">${rows.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
<div class="acts">
  <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
  <button class="btn-c" onclick="window.close?window.close():history.back()">Yopish</button>
</div>
</body></html>`;
}

// ════════════════════════════════════════════════
// WHOLESALE CHEK — Compact ulgurji hujjat
// B5 format, jadval, imzo joyi
// ════════════════════════════════════════════════
function buildReceiptWholesale(sale, opts, cfg) {
  const {shopName, staffName, botUser, logo, contact, footer, showStaff, showContact, F} = cfg;
  const chekNum  = sale.chekNum || ("#" + sale.id);
  const date     = (sale.date||"").split("-").reverse().join(".");
  const time     = sale.time || "";
  const total    = Number(sale.total    || 0);
  const subtotal = Number(sale.subtotal || total);
  const paid     = Number(sale.paid     || 0);
  const remaining= Number(sale.remaining|| 0);
  const discount = Number(sale.discount || 0);
  const items    = (sale.items||[]).filter(Boolean);
  const payType  = sale.payType || "";
  const payBreakdown = sale.payBreakdown || null;
  const isUsd    = sale.debtCurrency === "usd" && sale.debtUsd;
  const debtUsd  = Number(sale.debtUsd || 0);
  const prevUsd  = Number(sale.prevDebtUsd || 0);
  const prevUzs  = Number(sale.prevDebtUzs || 0);
  const note     = sale.note || "";
  const due      = sale.due  || "";
  const priceType= sale.priceType || "";
  const rate     = (typeof db !== "undefined" && db.settings?.rate) || 12800;
  const payLabels= {naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash"};

  const totalBoxes = items.reduce((a,i) => a + (i.qtyBox||0), 0);
  const totalDona  = items.reduce((a,i) => a + (i.qty||0), 0);

  const itemRows = items.map((it, idx) => {
    const isBox   = it.sellMode === "karobka" && it.qtyBox;
    const colorStr= it.color || "—";
    const sizeStr = isBox ? (it.groupSizes||"—") : (it.size||"—");
    const qtyShow = isBox ? `${it.qtyBox} pchk` : `${it.qty} ${it.unit||"dona"}`;
    const pricePer= isBox ? F((it.price||0)*(it.inBox||1)) : F(it.price||0);
    const sum     = (it.price||0)*(it.qty||0);
    const art     = it.art ? `<div style="font-size:10px;color:#555;margin-top:1px">${it.art}</div>` : "";
    return `<tr>
      <td class="c n">${idx+1}</td>
      <td class="l"><b>${it.name}</b>${art}</td>
      <td class="c">${colorStr}</td>
      <td class="c">${sizeStr}</td>
      <td class="c"><b>${qtyShow}</b></td>
      <td class="r">${pricePer}</td>
      <td class="r b">${F(sum)}</td>
    </tr>`;
  }).join("");

  // To'lov
  let payHtml = "";
  if (payType === "aralash" && payBreakdown) {
    const lblMap = {naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma"};
    payHtml = Object.entries(payBreakdown)
      .filter(([m,v]) => m !== "qarz" && v > 0)
      .map(([m,v]) => `<div class="prow"><span>${lblMap[m]||m}</span><b>${F(v)} so'm</b></div>`).join("");
  } else {
    payHtml = `<div class="prow"><span>${payLabels[payType]||payType}</span><b style="color:#059669">${F(paid)} so'm</b></div>`;
  }

  // Qarz
  let debtHtml = "";
  if (remaining > 0) {
    const newDebt = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${F(remaining)} so'm`;
    debtHtml = `<div class="prow dr"><span>QARZ</span><b>${newDebt}</b></div>`;
    if (isUsd && prevUsd > 0) {
      debtHtml += `<div class="prow sm"><span>Oldingi qarz</span><span>$${prevUsd.toFixed(2)}</span></div>`;
      debtHtml += `<div class="prow sm"><span>Yangi qarz</span><span>$${debtUsd.toFixed(2)}</span></div>`;
      debtHtml += `<div class="prow dt"><span>JAMI QARZ</span><b>$${(prevUsd+debtUsd).toFixed(2)} USD</b></div>`;
    } else if (!isUsd && prevUzs > 0) {
      debtHtml += `<div class="prow sm"><span>Oldingi qarz</span><span>${F(prevUzs)} so'm</span></div>`;
      debtHtml += `<div class="prow sm"><span>Yangi qarz</span><span>${F(remaining)} so'm</span></div>`;
      debtHtml += `<div class="prow dt"><span>JAMI QARZ</span><b>${F(prevUzs+remaining)} so'm</b></div>`;
    }
    if (due) debtHtml += `<div class="prow sm"><span>Muddat</span><span style="color:#dc2626;font-weight:700">${due}</span></div>`;
  } else {
    debtHtml = `<div class="paid">✓ To'liq to'landi</div>`;
  }

  const logoHtml = logo ? `<img src="${logo}" style="max-height:40px;max-width:120px;object-fit:contain">` : "";

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Savdo hujjati ${chekNum}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#eee;padding:16px 8px;color:#111}
.doc{background:#fff;max-width:520px;margin:0 auto;border-radius:6px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.15)}
/* HEADER */
.hdr{background:#0D1B2A;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
.shop{font-size:17px;font-weight:800;color:#fff;letter-spacing:.5px}
.hdr-sub{font-size:10px;color:#9aa7b5;margin-top:2px}
.hdr-r{text-align:right}
.chek-num{font-size:14px;font-weight:800;color:#E9A500}
.chek-dt{font-size:11px;color:#cdd5de;margin-top:2px}
/* META */
.meta{display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:8px 14px;font-size:11.5px;border-bottom:1px solid #E8E5E0;background:#FAFAF8}
.ml{color:#555}.mv{font-weight:700;color:#111}
.badge-u{display:inline-block;background:#E9A500;color:#0D1B2A;font-size:9px;font-weight:800;padding:1px 7px;border-radius:8px}
/* JADVAL */
table{width:100%;border-collapse:collapse;font-size:11.5px}
th{background:#0D1B2A;color:#fff;padding:6px 8px;font-size:10px;font-weight:700}
td{padding:5px 8px;border-bottom:1px solid #eee;vertical-align:middle}
.c{text-align:center}.r{text-align:right}.l{text-align:left}.n{width:24px}.b{font-weight:700}
.tot-row td{background:#F0EDE8;font-weight:800;border-top:2px solid #0D1B2A}
.disc-row td{color:#dc2626;font-size:11px}
/* PASTKI QISM */
.bottom{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #ddd}
.pay-box{padding:10px 14px;border-right:1px solid #eee}
.pay-ttl{font-size:9px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.prow{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px dashed #eee;color:#111}
.prow.dr{color:#dc2626;font-weight:800;font-size:13px;border-top:1px solid #fca5a5;padding-top:5px;margin-top:3px;border-bottom:none}
.prow.dt{color:#dc2626;font-weight:800;font-size:14px;border-top:2px solid #dc2626;padding-top:6px;margin-top:2px;border-bottom:none}
.prow.sm{font-size:11px;color:#666}
.paid{background:#ECFDF5;color:#059669;font-weight:700;font-size:12px;text-align:center;padding:8px;border-radius:5px}
/* IMZO */
.sign-box{padding:10px 14px}
.sign-ttl{font-size:9px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.sign-line{width:110px;border-top:1px solid #999;margin-top:28px;font-size:9px;color:#888;padding-top:3px}
/* FOOTER */
.note-row{padding:6px 14px;background:#FFFBEB;border-top:1px dashed #FDE68A;font-size:11px;color:#92400E}
.foot{padding:7px 14px;text-align:center;font-size:10px;color:#888;border-top:1px dashed #ddd}
/* PRINT */
.acts{max-width:520px;margin:10px auto 0;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:8px;padding:10px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #ccc}
@media print{
  body{background:#fff;padding:0}
  .doc{border-radius:0;box-shadow:none;max-width:100%}
  .acts{display:none}
  .hdr,.tot-row{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style></head><body>
<div class="doc">
  <div class="hdr">
    <div>
      ${logoHtml}
      <div class="shop">${shopName.toUpperCase()}</div>
      <div class="hdr-sub">Savdo hujjati${showContact && contact ? " · " + contact : ""}
        ${priceType==="ulgurji" ? ` · <span class="badge-u">ULGURJI</span>` : ""}
      </div>
    </div>
    <div class="hdr-r">
      <div class="chek-num">${chekNum}</div>
      <div class="chek-dt">${date} ${time}</div>
      ${showStaff && staffName && staffName!=="—" ? `<div class="chek-dt">Kassir: ${staffName}</div>` : ""}
    </div>
  </div>

  <div class="meta">
    ${sale.customerName ? `<span class="ml">Mijoz</span><span class="mv">${sale.customerName}</span>` : ""}
    ${sale.customerPhone ? `<span class="ml">Telefon</span><span class="mv">${sale.customerPhone}</span>` : ""}
    <span class="ml">Tovarlar</span><span class="mv">${items.length} xil · ${totalBoxes||totalDona} ${totalBoxes?"pochka":"dona"}</span>
    ${isUsd ? `<span class="ml">Kurs</span><span class="mv">1$=${F(rate)} so'm</span>` : ""}
  </div>

  <table>
    <thead><tr>
      <th>№</th><th style="text-align:left">Mahsulot</th>
      <th>Rang</th><th>O'lcham</th><th>Miqdor</th>
      <th style="text-align:right">Narx</th>
      <th style="text-align:right">Summa</th>
    </tr></thead>
    <tbody>
      ${itemRows}
      ${discount > 0 ? `
      <tr class="tot-row">
        <td colspan="6" class="r">Jami:</td><td class="r">${F(subtotal)} so'm</td>
      </tr>
      <tr class="disc-row">
        <td colspan="6" class="r">Chegirma${sale.discountPct ? " -"+sale.discountPct+"%" : ""}:</td>
        <td class="r">-${F(discount)} so'm</td>
      </tr>` : ""}
      <tr class="tot-row">
        <td colspan="6" class="r" style="font-size:13px">TO'LOV:</td>
        <td class="r" style="font-size:15px">${F(total)} so'm</td>
      </tr>
    </tbody>
  </table>

  <div class="bottom">
    <div class="pay-box">
      <div class="pay-ttl">To'lov</div>
      ${payHtml}
      ${debtHtml}
    </div>
    <div class="sign-box">
      <div class="sign-ttl">Imzolar</div>
      <div class="sign-line">Sotuvchi</div>
      <div class="sign-line" style="margin-top:18px">Xaridor</div>
    </div>
  </div>

  ${note ? `<div class="note-row">📝 Izoh: ${note}</div>` : ""}
  <div class="foot">${footer||"Rahmat!"} · ${shopName} · ${date}</div>
</div>
<div class="acts">
  <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
  <button class="btn-c" onclick="window.close?window.close():history.back()">Yopish</button>
</div>
</body></html>`;
}


// ════════════════════════════════════════════════
// MERX BREND CHEK — Zamonaviy, optimallashgan
// ════════════════════════════════════════════════
function buildReceiptMerx(sale, opts, cfg) {
  const {shopName, staffName, botUser, logo, contact, footer, showStaff, showContact, F} = cfg;
  const chekNum  = sale.chekNum || ("#" + sale.id);
  const date     = (sale.date||"").split("-").reverse().join(".");
  const time     = sale.time || "";
  const total    = Number(sale.total    || 0);
  const subtotal = Number(sale.subtotal || total);
  const paid     = Number(sale.paid     || 0);
  const remaining= Number(sale.remaining|| 0);
  const discount = Number(sale.discount || 0);
  const items    = (sale.items||[]).filter(Boolean);
  const payType  = sale.payType || "";
  const payBreakdown = sale.payBreakdown || null;
  const isUsd    = sale.debtCurrency === "usd" && sale.debtUsd;
  const debtUsd  = Number(sale.debtUsd || 0);
  const prevUsd  = Number(sale.prevDebtUsd || 0);
  const prevUzs  = Number(sale.prevDebtUzs || 0);
  const note     = sale.note || "";
  const due      = sale.due  || "";
  const priceType= sale.priceType || "";
  const payLabels= {naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash"};

  const totalBoxes = items.reduce((a,i) => a + (i.qtyBox||0), 0);
  const totalDona  = items.reduce((a,i) => a + (i.qty||0), 0);

  // Tovarlar — 2 qator: nom+art / rang+o'lcham+pochka
  const itemsHtml = items.map((it, idx) => {
    const isBox  = it.sellMode === "karobka" && it.qtyBox;
    const art    = it.art ? `<span class="it-art">${it.art}</span>` : "";
    const sum     = (it.price||0)*(it.qty||0);
    // Har doim: dona soni × dona narxi = summa
    const qtyShow = it.qty || 0;       // jami dona
    const unitShow= it.unit || "dona"; // birlik
    const pricePer= it.price || 0;     // 1 dona narxi
    const colorStr= it.color || "";
    // Pochka bo'lsa qavs ichida pochka soni
    const pchkNote= isBox && it.qtyBox ? ` (${it.qtyBox} pchk)` : "";
    // info: rang · o'lcham (agar dona) yoki rang (pochkada o'lcham yo'q)
    const colorStr2 = it.color || "";
    // Tovar qatori: Rang  Qty dona/pchk × Narx = Summa
    const calcStr = `${F(qtyShow)} ${unitShow} × ${F(pricePer)} = ${F(sum)}${pchkNote}`;
    return `<div class="it">
      <div class="it-top">
        <div class="it-num">${idx+1}</div>
        <div class="it-name">${it.name} ${art}</div>
        <div class="it-sum">${F(sum)}</div>
      </div>
      <div class="it-info">
        ${colorStr2 ? `<span class="it-color">${colorStr2}</span>` : ""}
        <span class="it-calc">${calcStr}</span>
      </div>
    </div>`;
  }).join("");

  // To'lov
  let payHtml = "";
  if (payType === "aralash" && payBreakdown) {
    const lblMap = {naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma"};
    payHtml = Object.entries(payBreakdown)
      .filter(([m,v]) => m !== "qarz" && v > 0)
      .map(([m,v]) => `<div class="pr"><span>${lblMap[m]||m}</span><span>${F(v)} so'm</span></div>`).join("");
  } else if (payType !== "qarz") {
    payHtml = `<div class="pr"><span>${payLabels[payType]||payType}</span><span style="color:#059669;font-weight:700">${F(paid)} so'm</span></div>`;
  }

  // Qarz bo'limi
  let debtHtml = "";
  if (remaining > 0) {
    const newDebtAmt = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${F(remaining)} so'm`;
    debtHtml += `<div class="sep-dash" style="margin:6px 0"></div>`;
    if (isUsd && prevUsd > 0) {
      debtHtml += `<div class="pr pr-sm"><span>Oldingi qarz</span><span>$${prevUsd.toFixed(2)}</span></div>`;
      debtHtml += `<div class="pr pr-sm"><span>Yangi qarz</span><span>$${debtUsd.toFixed(2)}</span></div>`;
      debtHtml += `<div class="pr pr-debt-total"><span>JAMI QARZ</span><span>$${(prevUsd+debtUsd).toFixed(2)} USD</span></div>`;
    } else if (!isUsd && prevUzs > 0) {
      debtHtml += `<div class="pr pr-sm"><span>Oldingi qarz</span><span>${F(prevUzs)} so'm</span></div>`;
      debtHtml += `<div class="pr pr-sm"><span>Yangi qarz</span><span>${F(remaining)} so'm</span></div>`;
      debtHtml += `<div class="pr pr-debt-total"><span>JAMI QARZ</span><span>${F(prevUzs+remaining)} so'm</span></div>`;
    } else {
      debtHtml += `<div class="pr pr-debt"><span>QARZ</span><span>${newDebtAmt}</span></div>`;
    }
    if (due) debtHtml += `<div class="pr pr-sm"><span>Muddat</span><span style="color:#dc2626;font-weight:700">${due}</span></div>`;
  } else {
    debtHtml = `<div class="paid-ok">✓ To'liq to'landi</div>`;
  }

  const discHtml = discount > 0
    ? `<div class="pr" style="color:#dc2626"><span>Chegirma${sale.discountPct ? " -"+sale.discountPct+"%" : ""}</span><span>−${F(discount)} so'm</span></div>` : "";

  const logoHtml = logo
    ? `<div style="text-align:center;padding:10px 0 4px"><img src="${logo}" style="max-height:55px;max-width:170px;object-fit:contain"></div>` : "";

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F2F0EB;display:flex;flex-direction:column;align-items:center;padding:16px 8px}
.wrap{width:340px;max-width:100%}
.rc{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(13,27,42,.12)}
.hd{background:#0D1B2A;padding:14px 18px;text-align:center;color:#fff}
.hd-name{font-family:'Sora',sans-serif;font-size:18px;font-weight:800;letter-spacing:1.5px}
.hd-meta{font-size:12px;color:#b8c5d0;margin-top:4px;line-height:1.6;font-weight:500}
.hd-meta b{color:#E9A500}
.badge-ulgurji{display:inline-block;background:#E9A500;color:#0D1B2A;font-size:9px;font-weight:800;padding:1px 7px;border-radius:8px;letter-spacing:.5px;margin-top:3px}
.cust{padding:7px 16px;background:#F0F8FF;border-bottom:1px dashed #C7E3F5;font-size:12px;color:#0D1B2A;display:flex;justify-content:space-between}
.note-w{padding:6px 16px;background:#FFFBEB;border-bottom:1px dashed #FDE68A;font-size:11.5px;color:#92400E}
.items-lbl{padding:8px 16px 4px;font-size:10px;font-weight:800;color:#555;letter-spacing:1.5px;text-transform:uppercase}
.items{padding:0 16px}
.it{padding:7px 0;border-bottom:1px dashed #E8E5E0}
.it:last-child{border-bottom:none}
.it-top{display:flex;align-items:baseline;gap:6px}
.it-num{font-size:10px;color:#999;font-weight:700;min-width:14px}
.it-name{flex:1;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#0D1B2A}
.it-art{font-family:'DM Sans',sans-serif;font-size:10px;color:#6366F1;background:#EEF2FF;padding:1px 6px;border-radius:4px;font-weight:600;margin-left:4px;vertical-align:middle}
.it-sum{font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:#0D1B2A;white-space:nowrap}
.it-info{font-size:12px;color:#374151;margin-top:3px;padding-left:20px;font-weight:500}
.it-color{color:#374151;font-weight:600;margin-right:8px}.it-calc{color:#111;font-weight:700}
.tot{margin:0 16px;padding:8px 0;border-top:2px solid #0D1B2A;display:flex;justify-content:space-between;align-items:center}
.tot-l{font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:#0D1B2A}
.tot-cnt{font-size:11px;color:#555;font-weight:600;margin-top:1px}
.tot-v{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;color:#0D1B2A}
.pay{padding:8px 16px 10px;border-top:1px dashed #ddd}
.pay-lbl{font-size:10px;font-weight:800;color:#374151;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.pr{display:flex;justify-content:space-between;font-size:13px;color:#000;padding:3px 0;font-weight:500}
.pr.pr-sm{font-size:12px;color:#555;font-weight:600}
.pr.pr-debt{color:#dc2626;font-weight:800;font-size:14px;border-top:1px solid #fca5a5;padding-top:6px;margin-top:2px}
.pr.pr-debt-total{color:#dc2626;font-weight:800;font-size:16px;border-top:2px solid #dc2626;padding-top:8px;margin-top:4px}
.sep-dash{border-top:1px dashed #ddd}
.paid-ok{background:#ECFDF5;color:#059669;font-weight:700;font-size:12px;text-align:center;padding:7px;border-radius:8px;margin-top:4px}
.ft{padding:10px 16px 14px;text-align:center;border-top:1px dashed #ddd}
.ft-txt{font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:#0D1B2A}
.ft-sub{font-size:11px;color:#666;margin-top:3px}
.ft-bot{font-size:11px;color:#229ED9;margin-top:6px}
.acts{width:340px;max-width:100%;margin:10px 0 0;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:10px;padding:11px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #E8E5E0}
@media print{
  body{background:#fff;padding:0}
  .wrap,.rc{width:72mm;max-width:72mm;border-radius:0;box-shadow:none}
  .acts{display:none}
  .hd,.hd-meta b{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pr.pr-debt,.pr.pr-debt-total{color:#000!important}
}
</style></head><body>
<div class="wrap">
  <div class="rc">
    ${logoHtml}
    <div class="hd">
      <div class="hd-name">${shopName.toUpperCase()}</div>
      <div class="hd-meta">
        <b>${chekNum}</b> · ${date} · ${time}
        ${showStaff && staffName && staffName !== "—" ? `<br>${staffName}` : ""}
        ${showContact && contact ? `<br>${contact}` : ""}
      </div>
      ${priceType === "ulgurji" ? `<div class="badge-ulgurji">ULGURJI SAVDO</div>` : ""}
    </div>

    ${sale.customerName ? `<div class="cust">
      <span>👤 ${sale.customerName}</span>
      <span>${sale.customerPhone||""}</span>
    </div>` : ""}

    ${note ? `<div class="note-w">📝 ${note}</div>` : ""}

    <div class="items-lbl">Mahsulotlar</div>
    <div class="items">${itemsHtml}</div>

    <div class="tot">
      <div>
        <div class="tot-l">JAMI</div>
        <div class="tot-cnt">${items.length} xil · ${totalBoxes ? totalBoxes + " pochka" : totalDona + " dona"}</div>
      </div>
      <div class="tot-v">${F(total)} <span style="font-size:13px;font-weight:600">so'm</span></div>
    </div>

    <div class="pay">
      <div class="pay-lbl">To'lov</div>
      ${discHtml}
      ${payHtml}
      ${debtHtml}
    </div>

    <div class="ft">
      <div class="ft-txt">${footer || "Rahmat! Yana kutamiz 🙏"}</div>
      <div class="ft-sub">${shopName} · ${date}</div>
      ${botUser ? `<div class="ft-bot">@${botUser}</div>` : ""}
    </div>
  </div>
  <div class="acts">
    <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
    <button class="btn-c" onclick="window.close?window.close():history.back()">Yopish</button>
  </div>
</div>
</body></html>`;
}


// ════════════════════════════════════════════════
// №9 (v152): QIDIRUV QATORLARI — YAGONA UX
// Har qidiruvda ✕ (bir bosishda tozalash), POS'dagidek qulay o'lcham,
// sahifadan chiqilganda avtomatik tozalanish (nav ichidagi guard bilan).
// pos-q va tarix-q allaqachon o'z ✕ tugmasiga ega — ular faqat
// avto-tozalash ro'yxatida.
// ════════════════════════════════════════════════
const _SEARCH_UX = [
  { id: "kat-q",   render: () => { if (typeof renderKatalog === "function") renderKatalog(); } },
  { id: "om-q",    render: () => { if (typeof omSearch === "function") omSearch(); } },
  { id: "cust-q",  render: () => { if (typeof renderMijozlar === "function") renderMijozlar(); } },
  { id: "debt-q",  render: () => { if (typeof renderDebts === "function") renderDebts(); } },
  { id: "qt-q",    render: () => { if (typeof renderQarzlarTarixi === "function") renderQarzlarTarixi(); } },
  { id: "exp-q",   render: () => { if (typeof renderMoliya === "function") renderMoliya(); } },
];
const _SEARCH_PRE = [ // o'z ✕ tugmasi bor maydonlar: [input, tugma, render]
  { id: "pos-q",   btn: "pos-q-clr",   render: () => { if (typeof posSearch === "function") posSearch(); } },
  { id: "tarix-q", btn: "tarix-q-clr", render: () => { if (typeof renderTarix === "function") renderTarix(); } },
];

function setupSearchUX() {
  _SEARCH_UX.forEach(cfg => {
    const inp = $(cfg.id);
    if (!inp || inp.dataset.uxDone) return;
    inp.dataset.uxDone = "1";
    // Qulay o'lcham (POS uslubiga yaqin)
    inp.style.fontSize = "14px";
    inp.style.padding = "9px 32px 9px 12px";
    if ((parseInt(inp.style.width) || 0) < 220 && !inp.style.width.includes("%")) inp.style.width = "240px";
    // O'rab, ✕ qo'shamiz (input DOM'da joyida qoladi — listener'lar saqlanadi)
    const wrap = document.createElement("span");
    wrap.style.cssText = "position:relative;display:inline-flex;align-items:center";
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const btn = document.createElement("button");
    btn.type = "button"; btn.textContent = "✕"; btn.setAttribute("data-qclr", cfg.id);
    btn.style.cssText = "display:none;position:absolute;right:9px;background:none;border:none;cursor:pointer;color:#bbb;font-size:15px;line-height:1;padding:2px";
    btn.onclick = e => { e.preventDefault(); inp.value = ""; btn.style.display = "none"; cfg.render(); inp.focus(); };
    wrap.appendChild(btn);
    inp.addEventListener("input", () => { btn.style.display = inp.value ? "" : "none"; });
  });
}

function clearPageSearches() {
  _SEARCH_UX.forEach(cfg => {
    const inp = $(cfg.id);
    if (inp && inp.value) {
      inp.value = "";
      const b = inp.parentNode && inp.parentNode.querySelector('[data-qclr="' + cfg.id + '"]');
      if (b) b.style.display = "none";
      try { cfg.render(); } catch(e) {}
    }
  });
  _SEARCH_PRE.forEach(cfg => {
    const inp = $(cfg.id);
    if (inp && inp.value) {
      inp.value = "";
      const b = $(cfg.btn); if (b) b.style.display = "none";
      try { cfg.render(); } catch(e) {}
    }
  });
}

// Ulanish: DOM tayyor bo'lishi bilan (skriptlar body oxirida — darhol ishlaydi)
if (document.readyState !== "loading") setupSearchUX();
else document.addEventListener("DOMContentLoaded", setupSearchUX);

// ═══ MOBIL: RAQAMLI KLAVIATURA (2026-07-24) ═══
// Narx/miqdor/telefon maydonlariga inputmode qo'yamiz — telefonda
// alifbo emas, RAQAM klaviaturasi ochiladi. Faqat ko'rsatishga ta'sir
// qiladi, kiritilgan qiymat va mantiq O'ZGARMAYDI.
function applyInputModes(root) {
  try {
    const scope = root || document;
    scope.querySelectorAll("input:not([data-im])").forEach(el => {
      el.dataset.im = "1";
      const t = (el.type || "text").toLowerCase();
      // Tegishli bo'lmagan turlar
      if (["checkbox","radio","file","date","color","range","time"].includes(t)) return;

      const key = ((el.id||"") + " " + (el.name||"") + " " + (el.placeholder||"")).toLowerCase();
      // Qidiruv maydonlari matn bo'lib qolsin (nom/ism bo'yicha ham qidiriladi)
      if (/qidir|search|nom|ism|izoh|note|manzil|addr|email|parol|pass/.test(key)) return;

      let mode = null;
      if (t === "number") mode = "decimal";
      else if (t === "tel" || /telefon|phone|\btel\b|raqam/.test(key)) mode = "tel";
      else if (/narx|price|summa|\bsum\b|miqdor|qty|soni|dona|pochka|karobka|chegirma|discount|ball|bonus|kurs|rate|barcode|shtrix|foiz|percent/.test(key)) mode = "numeric";

      if (mode) el.setAttribute("inputmode", mode);
    });
  } catch(e) {}
}

// Sahifa yuklanganda + har modal ochilganda qo'llanadi
window.addEventListener("load", () => applyInputModes());

// ═══ RASMNI KATTALASHTIRIB KO'RISH (2026-07-24, №2) ═══
// Dinamik oyna — HTML o'zgartirish shart emas. Rasm ustiga bosilganda
// to'liq ekranda ochiladi; ichida "Almashtirish" tugmasi (agar berilgan).
let _imgBigChangeFn = null;

function showImageBig(src, changeFn) {
  if (!src) return;
  _imgBigChangeFn = (typeof changeFn === "function") ? changeFn : null;
  document.getElementById("img-big-ov")?.remove();

  const ov = document.createElement("div");
  ov.id = "img-big-ov";
  ov.style.cssText = "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.9);" +
    "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:18px";
  ov.innerHTML =
    '<img src="' + src + '" style="max-width:94vw;max-height:74vh;object-fit:contain;' +
      'border-radius:10px;box-shadow:0 14px 48px rgba(0,0,0,.55)">' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' +
      (_imgBigChangeFn ? '<button onclick="imgBigChange()" style="background:#E9A500;border:none;' +
        'color:#0D1B2A;border-radius:10px;padding:11px 20px;font-family:inherit;font-size:14px;' +
        'font-weight:700;cursor:pointer">Almashtirish</button>' : '') +
      '<button onclick="closeImageBig()" style="background:rgba(255,255,255,.14);' +
        'border:1px solid rgba(255,255,255,.28);color:#fff;border-radius:10px;padding:11px 20px;' +
        'font-family:inherit;font-size:14px;font-weight:700;cursor:pointer">Yopish</button>' +
    '</div>';

  ov.onclick = (e) => { if (e.target === ov) closeImageBig(); };
  document.body.appendChild(ov);
  document.addEventListener("keydown", _imgBigEsc);
}

function _imgBigEsc(e) { if (e.key === "Escape") closeImageBig(); }

function closeImageBig() {
  document.getElementById("img-big-ov")?.remove();
  document.removeEventListener("keydown", _imgBigEsc);
  _imgBigChangeFn = null;
}

function imgBigChange() {
  const f = _imgBigChangeFn;
  closeImageBig();
  if (f) f();
}

// ═══ USTAMA va MARJA HISOBI (2026-07-25) ═══
// YAGONA manba — katalog, tovar oynasi, eksport shu yerdan oladi.
//   Ustama = (sotuv − tannarx) / TANNARX   → "tannarxga qancha qo'shdim"
//   Marja  = (sotuv − tannarx) / SOTUV     → "tushumning qancha qismi foyda"
// Ikkalasi ham to'g'ri o'lchov, lekin har xil savolga javob beradi.
function calcMarkup(costUzs, sellUzs) {
  const c = Number(costUzs) || 0, s = Number(sellUzs) || 0;
  if (c <= 0 || s <= 0) return null;
  return {
    markup: Math.round((s - c) / c * 100),   // ustama
    margin: Math.round((s - c) / s * 100),   // marja
    profit: Math.round(s - c)
  };
}

// Ustama bo'yicha rang (yashil 40%+, sariq 20-40%, qizil 20% dan past)
function markupColor(markup) {
  if (markup == null) return "#ccc";
  return markup >= 40 ? "var(--grn)" : markup >= 20 ? "#E07B39" : "var(--red)";
}

// ═══════════════════════════════════════════════════════════════
// TANNARX — SO'MDA QOTADI (2026-07-25)
// Avval tannarx USD da saqlanardi va kurs o'zgarganda so'mdagi
// qiymati ham o'zgarardi (500 000 → 497 600). Endi tannarx SO'MDA
// saqlanadi va MUZLAYDI — kurs o'zgarishi ta'sir qilmaydi.
//   costUzs — asosiy manba (so'm)
//   costUsd — eski tovarlar uchun zaxira (migratsiyagacha)
// ═══════════════════════════════════════════════════════════════
function getCostUzs(p) {
  if (!p) return 0;
  if (p.costUzs != null && p.costUzs > 0) return Math.round(p.costUzs);
  // Eski tovar: USD dan joriy kurs bo'yicha (migratsiyadan keyin bo'lmaydi)
  const rate = db.settings?.rate || 12800;
  return Math.round((p.costUsd || 0) * rate);
}

// Ko'rsatish uchun USD ekvivalenti (joriy kurs bo'yicha — faqat ko'rinish)
function getCostUsdView(p) {
  const rate = db.settings?.rate || 12800;
  return rate > 0 ? (getCostUzs(p) / rate) : 0;
}

// Bir martalik migratsiya: costUsd → costUzs
// 2026-07-26: eski tovarlarda variantga inBox yo'q — tovar darajasidagi
// qiymatdan bir marta to'ldiriladi. Shundan keyin har rang mustaqil.
function migrateVariantInBox() {
  let n = 0;
  (db.products || []).forEach(p => {
    const ib = parseInt(p.inBox) || 1;
    (p.variants || []).forEach(v => {
      if (v.inBox == null) { v.inBox = ib; n++; }
    });
  });
  if (n > 0) { saveDB(); console.log(`📦 ${n} ta variantga quti sig'imi yozildi`); }
  return n;
}

function migrateCostToUzs() {
  const rate = db.settings?.rate || 12800;
  let n = 0;
  (db.products || []).forEach(p => {
    if (p.costUzs == null && (p.costUsd || 0) > 0) {
      p.costUzs = Math.round(p.costUsd * rate);
      n++;
    } else if (p.costUzs == null) {
      p.costUzs = 0;
    }
  });
  if (n > 0) {
    saveDB();
    console.log(`💰 ${n} ta tovar tannarxi so'mga o'tkazildi (kurs ${rate})`);
  }
  return n;
}
