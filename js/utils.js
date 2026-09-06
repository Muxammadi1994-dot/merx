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
// ══════════════════════════════════════════════════════════════
// ⚠️ 2026-08-03: SANA QURILMA VAQTIDAN OLINADI
// ══════════════════════════════════════════════════════════════
// MUAMMO: `toISOString()` HAR DOIM UTC qaytaradi, qurilma vaqtini
// emas. Toshkent UTC dan 5 soat oldinda, ya'ni har kuni
// 00:00–05:00 oralig'ida ilova KECHAGI sanani yozardi.
// Ulgurji do'konlar aynan ertalab 3-4 da ish boshlaydi —
// ertalabki savdo KECHAGI kunga tushib qolardi.
//
// Soat (`nowTime`) allaqachon to'g'ri edi — u qurilmadan olinadi.
// Ya'ni bitta sotuvda sana UTC, soat esa mahalliy bo'lardi.
//
// Endi ikkalasi ham qurilma vaqtidan. Kunduzi hech narsa
// o'zgarmaydi — farq faqat o'sha tungi oynada bilinadi.
// ESKI yozuvlar tegilmaydi (kelishilgan).
const _p2 = (n) => String(n).padStart(2, "0");
const today  = () => {
  const d = new Date();
  return `${d.getFullYear()}-${_p2(d.getMonth() + 1)}-${_p2(d.getDate())}`;
};
const nowTime= () => new Date().toLocaleTimeString("uz-UZ", {hour:"2-digit", minute:"2-digit"});


// ══════════════════════════════════════════════════════════════
// QURILMA RAQAMI VA NOYOB ID (2026-08-04)
// ══════════════════════════════════════════════════════════════
// ⚠️ MA'LUMOT YO'QOLISHI: har qurilma o'z `db.seq` ini yuritadi
// (u bulutga sinxronlanmaydi). Ikki kassa bir vaqtda sotuv qilsa
// IKKALASI HAM bir xil `id` oladi, sinxronda esa keyingisi
// birinchisini USTIGA YOZADI — sotuv butunlay yo'qoladi.
//
// 2026-08-04, B20: CHK-20260804-2037 aynan shunday yo'qolgan.
// Xabarda 06:21 dagi sotuv, bazada esa 06:29 dagi boshqa sotuv.
//
// YECHIM: har qurilmaga bir martalik raqam (1-99). Yangi `id`
// shu raqam bilan tugaydi — ikki qurilma bir xil `id` bera
// olmaydi. Chek raqamiga ham qurilma harfi qo'shiladi (mini-app
// chekni RAQAM bo'yicha qidiradi).
//
// Eski yozuvlar TEGILMAYDI — faqat yangilari.
// Qurilma kodi — IKKI HARF (AA..ZZ, 676 variant).
// ⚠️ 2026-08-04 tuzatildi: avval 1-99 raqam edi va 52 dan katta
// bo'lsa harf o'rniga RAQAM qaytarardi. Natijada chek raqami
// "CHK-20260804-429665" ko'rinishida yopishib ketardi.
// ═══════════════════════════════════════════════════════════════════
// 🔴 551 (2026-08-23): QURILMA KODI ENDI KO'R TAVAKKAL EMAS
// ═══════════════════════════════════════════════════════════════════
// ILDIZ (raqam-auditi, 2026-08-23): kod 676 variantdan TASODIFIY
// tanlanardi — do'kondagi boshqa qurilmalarda nima borligini bilmasdan.
// 9 qurilmada ikkitasi bir xil kod olish ehtimoli ~5%, 12 tada ~9%.
// To'qnashsa UCH zarba birdan: nextId() bir xil (yozuv jimgina bosiladi,
// jonli isbot: CHK-20260804-2037 yo'qolgan) · chek raqami bir xil ·
// to'lov raqami bir xil.
// ENDI: (1) yangi kod tanlanayotganda LOKAL bazadagi barcha hujjat
// raqamlaridan (CHK/PAY/QT/QTQ oxiridagi harflar) BAND kodlar yig'ilib,
// bo'shi olinadi; (2) qurilma birinchi HUJJAT yozguncha "yangi" bayroq
// bilan yuradi — shu davrda sinxron kod band ekanini ko'rsatsa,
// _devHeal jimgina almashtiradi (pastda); birinchi hujjatdan keyin kod
// MUZLAYDI. Ishlab turgan (meros) qurilmalarga bayroq yo'q — ularning
// kodi HECH QACHON o'zgarmaydi (chek raqamlari chalkashmasin).
function _devBandlar() {
  const band = new Set();
  try {
    const ol = (arr, f) => (arr || []).forEach(x => {
      const m = /-([A-Z]{2})$/.exec(String((x && x[f]) || ""));
      if (m) band.add(m[1]);
    });
    ol(db.sales,        "chekNum");
    ol(db.debtPayments, "chekNum");
    ol(db.returns,      "refundNo");
  } catch (e) {}
  return band;
}
function _devCode() {
  try {
    let c = localStorage.getItem("merx_dev_code");
    if (!/^[A-Z]{2}$/.test(c || "")) {
      const A = 65;
      const band = _devBandlar();
      let guard = 0;
      do {
        c = String.fromCharCode(A + Math.floor(Math.random() * 26))
          + String.fromCharCode(A + Math.floor(Math.random() * 26));
      } while (band.has(c) && ++guard < 200);
      localStorage.setItem("merx_dev_code", c);
      localStorage.setItem("merx_dev_new", "1");   // 551: hujjatgacha davolash faol
      console.log("🔤 Qurilma kodi tanlandi:", c, band.size
        ? "· " + band.size + " ta band kod chetlab o'tildi"
        : "· band ro'yxat hali bo'sh (birinchi sinxronda tekshiriladi)");
    }
    return c;
  } catch (e) { return "AA"; }
}
// 551: sinxrondan keyin chaqiriladi (cloud.js). Qurilma hali birorta
// hujjat yozmagan bo'lsa-yu, kodi bulutdan kelgan hujjatlarda BAND
// ko'rinsa — jimgina bo'shiga almashtiradi. Hujjat yozilgan zahoti
// (_nextDocSeq) kod muzlaydi va bu tekshiruv abadiy o'chadi.
function _devHeal() {
  try {
    if (localStorage.getItem("merx_dev_used") === "1") return;   // muzlagan
    if (localStorage.getItem("merx_dev_new")  !== "1") return;   // meros qurilma
    const c = localStorage.getItem("merx_dev_code");
    if (!/^[A-Z]{2}$/.test(c || "")) return;
    if (!_devBandlar().has(c)) return;                           // toza
    localStorage.removeItem("merx_dev_code");
    const yangi = _devCode();
    console.warn("🔤 Qurilma kodi band ekan (" + c + ") — hujjat " +
                 "yozilmasdan oldin yangisiga almashtirildi: " + yangi);
  } catch (e) {}
}

// Kod → 0..675 oralig'idagi raqam (`id` uchun)
function _devIdx() {
  const c = _devCode();
  return (c.charCodeAt(0) - 65) * 26 + (c.charCodeAt(1) - 65);
}

// Yangi noyob id: `db.seq` × 1000 + qurilma raqami.
// Ikki qurilma bir xil `seq` da bo'lsa ham id FARQ QILADI.
// ⚠️ 2026-08-04: SANOQ ALOHIDA — `db.seq` SHISHMAYDI.
// Avval `id = db.seq × 1000 + kod` edi. Sinxrondan keyin esa
// `db.seq` eng katta `id` dan qayta hisoblanardi — ikkisi
// bir-birini surib, chek raqami "430771" bo'lib ketdi.
//
// Endi `db.seq` FAQAT sanoq (chek raqami uchun), `id` esa
// undan MUSTAQIL: vaqt muhri + qurilma kodi.
// Vaqt muhri har millisekundda o'sadi va ikki qurilmada
// bir xil bo'lsa ham qurilma kodi ularni ajratadi.
let _lastId = 0;
function nextId() {
  db.seq = (db.seq || 1) + 1;              // sanoq o'z yo'lida
  // Vaqt muhri (soniya) × 1000 + qurilma kodi (0..675).
  // 2026-yilda ~1.78 mlrd → id ~1.78e12, JS uchun xavfsiz.
  let id = Math.floor(Date.now() / 1000) * 1000 + _devIdx();
  // ⚠️ Bir soniyada bir nechta yozuv bo'lsa (masalan sotuv +
  // mijoz + qarz to'lovi) id takrorlanmasin.
  if (id <= _lastId) id = _lastId + 1000;
  _lastId = id;
  return id;
}

// Sanoqni sog'lom oraliqda ushlaydi (chek raqami uchun).
// Shishib ketgan qurilmalarda bir marta tiklanadi.
function _seqSane() {
  if ((db.seq || 0) >= 100000) {
    const small = (db.sales || []).map(x => +x.id || 0)
      .filter(n => n > 0 && n < 100000);
    db.seq = small.length ? Math.max(...small) + 1 : 1;
  }
  return db.seq || 1;
}


function addDays(d, n) {
  // 2026-08-03: natija ham qurilma vaqtida (yuqoridagi izoh)
  const r = new Date(d); r.setDate(r.getDate() + n);
  return `${r.getFullYear()}-${_p2(r.getMonth() + 1)}-${_p2(r.getDate())}`;
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
// ✅ 2026-08-17: TO'LIQ QAYTARILGAN sotuv RO'YXATGA KIRMAYDI — to'lov
// yo'li (findCustomerDebts) va server (pul.js) bilan BIR QOIDA.
// Jonli isbot (B20): qaytarilgan chekning qoplovchi QTQ'si atkaz
// bo'lsa, "arvoh" qarz kartada qolardi — Nuriddin aka $640,
// Abduqodir aka $105.12. Karta $44 023,93 derdi, server va chek
// $43 383,93 — sotuvchi "1000 to'ladim, 1640 kamaydi" deb chalg'irdi.
const debtSales  = () => db.sales.filter(s =>
  s.status !== "qaytarilgan" && calcSaleState(s).remaining > 0.5);
const isOverdue  = s  => s.due && s.due < today();

// ── Qarz to'lov chek raqami ────────────────────
// ═══ HUJJAT RAQAMI — TO'QNASHUVSIZ (2026-08-12) ══════════
// ILDIZ: raqamlar LOKAL SANOQDAN (`db.seq`, ro'yxat uzunligi) olinardi.
// Sanoq shishib ketsa `_seqSane()` uni ORQAGA tiklardi — o'sha zahoti
// bir xil raqam qayta berilardi. Jonli isbotlar: `CHK-20260805-4326-DW`
// ikki sotuvda; `QT-260805-01` ikki qaytarishda; to'lovda 6 juft takror.
// YECHIM: raqam MA'LUMOTNING O'ZIDAN — shu kun + shu qurilma bo'yicha
// eng katta raqam + 1. Sanoq qanday buzilsa ham takror bo'lmaydi.
function _nextDocSeq(list, field, prefix, pad, datePart) {
  try {
    const d   = datePart || today().replace(/-/g, "");
    const dev = (typeof _devCode === "function") ? _devCode() : "AA";
    const re  = new RegExp("^" + prefix + "-" + d + "-(\\d+)-" + dev + "$");
    try {   // 551: birinchi hujjat raqami berildi — qurilma kodi MUZLAYDI
      localStorage.setItem("merx_dev_used", "1");
      localStorage.removeItem("merx_dev_new");
    } catch (e2) {}
    let mx = 0;
    (list || []).forEach(x => {
      const m = re.exec(String((x && x[field]) || ""));
      if (m) { const n = parseInt(m[1], 10) || 0; if (n > mx) mx = n; }
    });
    return String(mx + 1).padStart(pad || 4, "0");
  } catch (e) {
    return String(Date.now() % 10000).padStart(pad || 4, "0");
  }
}

function genPayChekNum() {
  const datePart = today().replace(/-/g, "");
  // ✅ 2026-08-12: ro'yxat UZUNLIGI emas — mavjud raqamlardan MAX+1.
  const seq = _nextDocSeq(db.debtPayments, "chekNum", "PAY", 4, datePart);
  // ⚠️ PUL-QALQON (2026-08-12): raqam oxiriga KASSA HARFI qo'shildi —
  // sanoq lokal bo'lgani uchun ikki kassa bir kunda BIR XIL raqam
  // berardi (auditda 6 juft topildi). Endi sotuv cheki kabi ajralади.
  const dev = (typeof _devCode === "function") ? ("-" + _devCode()) : "";
  return `PAY-${datePart}-${seq}${dev}`;
}

// ⚠️ PUL-QALQON B (2026-08-12): to'lov id endi VAQT-ASOSLI.
// Avval `db.seq` (lokal sanoq) edi — ikki kassa to'qnashsa bulutda
// (id,shop_id) upsert BIRINI IKKINCHISI BILAN BOSIB KETARDI —
// "yo'qolgan to'lov"ning isbotlangan mexanizmlaridan biri.
// ═══════════════════════════════════════════════════════════════════
// 🔴 553 (2026-08-23): QURILMA BELGISI QO'SHILDI
// ═══════════════════════════════════════════════════════════════════
// Chuqur audit topdi: 12-avgustda vaqt-asosli qilingan, lekin QURILMA
// raqami qo'shilmagan — holbuki `nextId()` (2026-08-04) da u bor edi.
// Natijada himoya faqat O'SHA qurilma ichida ishlardi (`_lastPayIdTs`):
// ikki kassa bir MILLISEKUNDDA to'lov yozsa — id AYNAN bir xil va
// upsert biri ikkinchisini jimgina bosardi. Ehtimoli kichik, oqibati
// og'ir (yo'qolgan to'lov). Endi `nextId` bilan bir xil shakl:
//   sekund × 1000 + qurilma raqami (0…675)
// Ikki qurilma bir soniyada ham har xil id oladi; bir qurilmada
// ketma-ket chaqiruvlar +1000 bilan oldinga suriladi.
// Eski id lar (o'tmishdagi millisekundlar) bilan urishmaydi — yangi
// id doim JORIY soniyadan, ya'ni kattaroq.
let _lastPayIdTs = 0;
function payNewId() {
  let t = (typeof nextId === "function")
    ? nextId()                          // 553: vaqt + qurilma
    : Date.now();                       // zaxira (nextId yo'q bo'lsa)
  if (t <= _lastPayIdTs) t = _lastPayIdTs + 1;
  _lastPayIdTs = t;
  return t;
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

// ═══════════════════════════════════════════════════════════════════
// 🔴 552 (2026-08-23): TO'LOVLAR INDEKSLANADI (tezlik)
// ═══════════════════════════════════════════════════════════════════
// ILDIZ: `getSalePayments` HAR chaqiruvda butun `db.debtPayments` ni
// aylanib, har taqsimotdan YANGI obyekt yasab, keyin bittasini olib
// qolganini tashlardi. Qarzlar oynasida bir harf bosilganda ~1200
// chaqiruv → ~437 000 vaqtinchalik obyekt → ~80 ms (o'lchandi).
// Egasi sezgan "harflar kechikib yoziladi" shundan edi.
// ENDI: bir marta `saleId → to'lovlar` xaritasi quriladi, keyingi
// chaqiruvlar tayyoridan oladi (o'lchov: 82,9 ms → 2,2 ms).
// Foyda 6 modulda: qarzlar, dashboard, hisobot, mijozlar, pos, tarix.
//
// ⚠️ XARITA ESKIRMASLIGI — UCH QO'RIQCHI:
//   1) massiv HAVOLASI o'zgarsa (sinxron `db.debtPayments = ...`),
//   2) UZUNLIGI o'zgarsa (yangi to'lov `push`),
//   3) ichkarida bayroq o'zgarsa (atkaz `p.cancelled = true`, bot
//      singdirishida `Object.assign`) — bu ikkisida na havola, na
//      uzunlik o'zgaradi, shuning uchun `_gspBekor()` QO'LDA
//      chaqiriladi (qarzlar.js atkaz, qarzlar.js bot-singdirish).
// Natija HAR DOIM nusxa qilib qaytariladi — chaqiruvchi uni
// o'zgartirsa xarita buzilmasin.
// Taqqoslash `String()` bilan: `saleId` ba'zan matn bo'lishi mumkin
// (server sotuv `id` ni matn qaytaradi) — jonli bazada bunday holat
// yo'q (513 taqsimotning hammasi son), ya'ni natija o'zgarmaydi,
// lekin kelajakda jimgina yo'qolgan to'lov bo'lmaydi.
let _gspKesh = null;
function _gspBekor() { _gspKesh = null; }
function _gspQur() {
  const arr = db.debtPayments || [];
  const faol = new Map(), hammasi = new Map();
  const cmp = (a, b) => (a.payDate + a.payTime < b.payDate + b.payTime) ? -1 : 1;
  for (const p of arr) {
    const alloc = p.allocations || [];
    for (const a of alloc) {
      const rec = { ...a, paymentId: p.id, paymentChekNum: p.chekNum,
                    payDate: p.date, payTime: p.time, payMethod: p.method || "naqd" };
      const k = String(a.saleId);
      let h = hammasi.get(k); if (!h) hammasi.set(k, h = []); h.push(rec);
      if (!p.cancelled) { let f = faol.get(k); if (!f) faol.set(k, f = []); f.push(rec); }
    }
  }
  faol.forEach(v => v.sort(cmp));
  hammasi.forEach(v => v.sort(cmp));
  _gspKesh = { ref: arr, len: arr.length, faol, hammasi };
}
function getSalePayments(saleId, includeCancelled) {
  // v150 (№3): atkaz qilingan to'lovlar qarz hisobiga KIRMAYDI —
  // shu bitta filtr tufayli calcSaleState qarzni o'zi "qaytaradi".
  const arr = db.debtPayments || [];
  if (!_gspKesh || _gspKesh.ref !== arr || _gspKesh.len !== arr.length) _gspQur();
  const m = includeCancelled ? _gspKesh.hammasi : _gspKesh.faol;
  const l = m.get(String(saleId));
  return l ? l.slice() : [];
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
  const rate = kursOl();

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
// ═══ ✅ 566a (2026-08-26): KURS — YAGONA MANBA ═══════════════════
// Qoida: dollar kursi FAQAT do'kon sozlamasidan olinadi. Yo'q bo'lsa
// 0 qaytadi — TAXMIN YO'Q (12800 kabi soxta zaxira TAQIQ).
// Chaqiruvchi 0 ko'rsa: ko'rsatishda "—", pul amalida to'xtab
// "kurs yuklanmadi" deydi. Qolgan eski `|| 12800` zaxiralari 566b/c
// sessiyalarida shu funksiyaga almashtiriladi.
function kursOl() {
  return Number(typeof db !== "undefined" && db.settings && db.settings.rate) || 0;
}

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

// ══════════════════════════════════════════════════════════════
// SAHIFANI TIKLASH QOIDASI (2026-07-30)
// ══════════════════════════════════════════════════════════════
// F5 dan keyin amaldagi sahifada qolish v151 da ataylab qilingan —
// avval har yangilashda Dashboard'ga otib yuborardi va ish uzilardi.
// U xato QAYTMASLIGI shart.
//
// Yangi talab: uzoq tanaffusdan keyin (ertasi kun yoki 4 soatdan
// ko'p) yangi ish kunini Dashboard'dan boshlash.
//
// Xavfsizlik qoidasi: bu qaror FAQAT ilova ochilganda, init() ichida,
// BIR MARTA qabul qilinadi. Ishlash paytida, yangilashda yoki oyna
// fokusga qaytganda sahifa HECH QACHON o'zgartirilmaydi.
const PAGE_STALE_MS = 4 * 60 * 60 * 1000;   // 4 soat

// Foydalanuvchi ishlayotganini belgilab boramiz — aks holda POS'da
// 5 soat tinmay ishlagan odam F5 bosganda Dashboard'ga otilardi.
function _touchPageStamp() {
  try {
    const now = Date.now();
    if (window._lastStampAt && now - window._lastStampAt < 60000) return; // daqiqada bir marta
    window._lastStampAt = now;
    localStorage.setItem("merx_last_page_at", String(now));
  } catch(e) {}
}
["pointerdown","keydown"].forEach(ev =>
  document.addEventListener(ev, _touchPageStamp, { passive: true })
);

// Oxirgi sahifani tiklash mumkinmi?
function shouldRestoreLastPage() {
  try {
    const at = parseInt(localStorage.getItem("merx_last_page_at") || "0");
    if (!at) return false;                                  // vaqt yo'q
    if (Date.now() - at > PAGE_STALE_MS) return false;      // uzoq tanaffus
    const prev = new Date(at), now = new Date();
    if (prev.toDateString() !== now.toDateString()) return false;  // boshqa kun
    return true;
  } catch(e) { return false; }
}

// Rolga mos standart sahifa — YAGONA MANBA (init ham, login ham ishlatadi)
function defaultPageForRole(user) {
  const r = user && user.role;
  if (r === "kassir")   return "pos";
  if (r === "omborchi") return "ombor";
  return "dashboard";
}

// ══════════════════════════════════════════════════════════════
// ILOVANI YANGILASH — tepadagi ⟳ tugmasi (2026-07-30)
// ══════════════════════════════════════════════════════════════
// Kompyuterda F5 / Ctrl+Shift+R bor. Telefonda va kassa ekranida esa
// bu qiyin. Bu tugma o'sha ishni bajaradi: kutayotgan o'zgarishlarni
// bulutga yuboradi, eski keshni tozalaydi, service worker'ni
// yangilaydi va sahifani qayta yuklaydi.
async function appHardReload() {
  try { toast("Yangilanmoqda..."); } catch(e) {}

  // 1) Yuborilmagan o'zgarishlar yo'qolmasin
  try { if (typeof flushCloudSync === "function") await flushCloudSync(true); } catch(e) {}

  // 2) Eski keshni tozalaymiz
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch(e) {}

  // 3) Service worker'ni yangi versiyaga o'tkazamiz
  try {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        try { if (r.waiting) r.waiting.postMessage("skipWaiting"); } catch(e) {}
        try { await r.update(); } catch(e) {}
      }
    }
  } catch(e) {}

  // ⚠️ 2026-08-05: AVVAL KUTILAYOTGAN YOZUVNI YUBORAMIZ.
  // Ilova yangilanganda sahifa qayta yuklanadi. Sotuv yoki tahrir
  // bulutga yetmagan bo'lsa yo'qolardi (chiqishdagi bilan bir xil
  // xato — 2026-08-05, Shoetest'da ikki sotuv).
  try {
    if (typeof pushToCloud === "function") {
      await Promise.race([
        pushToCloud(),
        new Promise(r => setTimeout(r, 8000))
      ]);
    }
  } catch (e) { console.warn("yangilashdan oldin sinxron:", e.message); }

  // 4) Qayta yuklash. index.html Vercel'da no-cache, kesh esa
  //    yuqorida tozalandi — shuning uchun yangi kod keladi.
  setTimeout(() => { try { location.reload(); } catch(e) {} }, 250);
}


// ══════════════════════════════════════════════════════════════
// RO'YXAT SAHIFALASH — YAGONA MANBA (2026-07-31)
// ══════════════════════════════════════════════════════════════
// Talab: o'sib boradigan HAMMA ro'yxat bir xil ishlasin — bir
// sahifada 50 ta, pastda sahifa raqamlari. Avval katalogda shunday
// edi, tarix/mijozlarda "yana ko'rsatish" tugmasi, omborda esa
// umuman yo'q edi.
// Uslub katalogdan olindi, shuning uchun ko'rinish o'zgarmaydi.
const LIST_PER_PAGE = 50;

function pageCount(total) { return Math.ceil(total / LIST_PER_PAGE) || 1; }
function clampPage(page, total) {
  const tp = pageCount(total);
  return (page > tp || page < 1) ? 1 : page;
}
function pageSlice(arr, page) {
  const p = clampPage(page, arr.length);
  return arr.slice((p - 1) * LIST_PER_PAGE, p * LIST_PER_PAGE);
}

// Jadval oxiriga qo'yiladigan sahifa qatori.
// colspan — jadvaldagi ustunlar soni, goFn — sahifaga o'tish funksiyasi nomi.
function pagerRow(colspan, total, page, goFn, unit) {
  const totalPages = pageCount(total);
  if (totalPages <= 1) return "";
  const cur = clampPage(page, total);
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - cur) <= 2) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }
  return `<tr class="pager-row"><td colspan="${colspan}" style="padding:0;background:#fff">
    <div style="display:flex;align-items:center;gap:4px;padding:10px 18px;
      border-top:1px solid var(--brd);flex-wrap:wrap">
      <span style="font-size:12px;color:var(--mut);margin-right:8px">${total} ta ${unit || "qator"}</span>
      ${cur > 1 ? `<button class="btn btn-ghost btn-sm" onclick="${goFn}(${cur-1})">‹</button>` : ""}
      ${pages.map(p => p === "..."
        ? `<span style="padding:0 4px;color:var(--mut)">...</span>`
        : `<button class="btn btn-sm ${p===cur?"btn-acc":"btn-ghost"}" onclick="${goFn}(${p})">${p}</button>`
      ).join("")}
      ${cur < totalPages ? `<button class="btn btn-ghost btn-sm" onclick="${goFn}(${cur+1})">›</button>` : ""}
      <span style="font-size:12px;color:var(--mut);margin-left:8px">${cur}/${totalPages} sahifa</span>
    </div>
  </td></tr>`;
}

// Sahifa almashganda jadval tepasiga qaytamiz
function pagerScrollTop(elId) {
  try {
    const el = document.getElementById(elId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch(e) {}
}


// srchClr() OLIB TASHLANDI (2026-08-01): ✕ tugmasini setupSearchUX()
// allaqachon qo'shadi. Ikki xil mexanizm bo'lmasin (yagona manba).

// ══════════════════════════════════════════════════════════════
// KO'P PARAMETRLI QIDIRUV (2026-08-02)
// ══════════════════════════════════════════════════════════════
// AVVAL: qidiruv matni BUTUNLIGICHA qidirilardi —
//   `p.name.toLowerCase().includes(q)`
// Shu sabab "c1 krossovka" deb yozilsa hech narsa topilmasdi:
// aynan shunday matn hech bir maydonda yo'q edi.
//
// ENDI: matn so'zlarga bo'linadi va HAR BIR so'z biror maydonda
// topilishi shart. "c1 krossovka" →
//   · "c1"        artikulda bor
//   · "krossovka" nomida bor
//   · ikkalasi topildi → chiqadi
//
// Bitta so'z yozilsa xatti-harakat O'ZGARMAYDI (avvalgidek).
//
// Ishlatish:
//   const m = srchMatcher(q);          // bir marta tayyorlanadi
//   list.filter(x => m(x.name, x.sku, x.art));
function srchMatcher(query) {
  const words = String(query || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return () => true;          // bo'sh qidiruv — hammasi
  return function (...fields) {
    // Maydonlarni bitta matnga yig'amiz (massiv/obyekt ham bo'lishi mumkin)
    let hay = "";
    for (const f of fields) {
      if (f == null) continue;
      if (Array.isArray(f)) hay += " " + f.join(" ");
      else if (typeof f === "object") hay += " " + Object.values(f).join(" ");
      else hay += " " + f;
    }
    hay = hay.toLowerCase();
    return words.every(w => hay.includes(w));
  };
}

// ══════════════════════════════════════════════════════════════
// EKSPORT MANBAI — EKRANDAGI RO'YXAT (2026-08-02)
// ══════════════════════════════════════════════════════════════
// MUAMMO: har eksport o'z filtrini QAYTA YOZARDI (yoki umuman
// filtrlamasdi). Natijada ekranda bir narsa, faylda boshqasi
// chiqardi va ekran filtri o'zgarganda eksport orqada qolardi.
//
// ENDI: render funksiyasi yakuniy ro'yxatni shu yerga qo'yadi,
// eksport o'shani oladi. Filtr, qidiruv, saralash — hammasi
// avtomat mos keladi, chunki manba BITTA.
//
// ⚠️ Sahifalash ta'sir qilmaydi: bu YAKUNIY ro'yxat (hamma qator),
// ekranda ko'rinib turgan 50 ta emas.
const _lastLists = {};

function setExportList(page, arr) {
  try { _lastLists[page] = Array.isArray(arr) ? arr.slice() : []; } catch(e) {}
}

// Ro'yxat bo'lmasa (sahifa hali ochilmagan) — zaxira qiymat qaytadi,
// ya'ni eski xatti-harakat saqlanadi va eksport hech qachon bo'sh
// fayl bermaydi.
function getExportList(page, fallback) {
  const v = _lastLists[page];
  return (Array.isArray(v) && v.length) ? v : (fallback || []);
}

function nav(p) {
  // ⚡ 2026-08-13: chek qatlami ochiq qolsa navigatsiyani TO'SARDI
  // ("boshqa oynaga o'tmayapti" — jonli shikoyat). Sahifa almashganda
  // qoldiq qatlamlar tozalanadi.
  try {
    document.getElementById("chek-overlay")?.remove();
    const _ovr = document.getElementById("ov-receipt");
    if (_ovr && _ovr.classList.contains("on")) closeModal("receipt");
  } catch (e) {}

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
  // \U0001f534 2026-08-14: SAHIFA ALMASHGANDA SURISH TEPAGA QAYTADI.
  // Sozlamalar sahifasi juda uzun — undan qisqa sahifaga (Katalog,
  // Ombor) o'tilganda konteyner PASTDA qolib, ekran bo'sh ko'rinardi
  // va "o'tmadi, qotib qoldi" degan taassurot tug'ilardi
  // (egasining shikoyati, Tizim bo'limida ayniqsa sezilardi).
  try {
    ["pages", "main"].forEach(id => { const c = document.getElementById(id);
      if (c) c.scrollTop = 0; });
    if (el) el.scrollTop = 0;
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    window.scrollTo(0, 0);
    // Og'ir chek namunasi boshqa sahifada kerak emas
    const _pf = document.getElementById("chek-preview-frame");
    if (_pf && p !== "egasi") { _pf.srcdoc = ""; _pf.style.height = "0px"; }
  } catch (e) {}
  // v151 (№4): amaldagi sahifa eslab qolinadi — F5'dan keyin init shu yerdan tiklaydi
  if (el) {
    try {
      localStorage.setItem("merx_last_page", p);
      // 2026-07-30: sahifa bilan birga VAQTI ham yoziladi (pastdagi izohga qarang)
      localStorage.setItem("merx_last_page_at", String(Date.now()));
      window._lastStampAt = Date.now();
    } catch(e) {}
  }
  const T = { dashboard:"Dashboard", pos:"Sotuv (POS)", katalog:"Katalog", ombor:"Ombor",
    mijozlar:"Mijozlar", qarzlar:"Qarzlar", qarztarix:"Qarzlar tarixi", tarix:"Sotuv tarixi",
    hisobot:"Hisobot va tahlil", xodimlar:"Xodimlar", moliya:"Moliya",
    portal:"Mijoz portali", egasi:"Egasi / Sozlamalar",
    studio:"Studio — reklama" };   // ✅ Studio
  $("ptitle").textContent = T[p] || p;
  // Mobil: sahifa tanlangach sidebar avtomat yopiladi
  if (typeof closeMobSidebar === "function") closeMobSidebar();
  // 🔴 2026-08-21 ILDIZ-DAVO: chizuvchilar NOMI bilan chaqiriladi.
  // Avval bu yerda `{ hisobot: renderHisobot, ... }` deb TO'G'RIDAN-
  // TO'G'RI yozilgan edi. Obyekt tuzilayotganda hamma funksiya
  // MAVJUD bo'lishi shart edi — agar bittasi hali yuklanmagan bo'lsa
  // (`hisobot.js` skript ro'yxatida `utils.js` dan KEYIN turadi),
  // "renderHisobot is not defined" xatosi butun `nav()` ni yiqitardi.
  // U esa pull ichidan chaqiriladi → PULL TO'XTAB QOLARDI va
  // ma'lumot umuman qo'llanmasdi: Katalog, Ombor, Mijozlar — hammasi
  // BO'SH ko'rinardi (21-avgust, jonli hodisa).
  // Endi nomi bo'yicha qidiriladi, yo'q bo'lsa jim o'tkazib yuboriladi.
  const _fnNom = { dashboard:"renderDashboard", katalog:"renderKatalog",
    ombor:"renderOmbor", mijozlar:"renderMijozlar", qarzlar:"renderDebts",
    qarztarix:"renderQarzlarTarixi", tarix:"renderTarix",
    hisobot:"renderHisobot", xodimlar:"renderXodimlar", moliya:"renderMoliya",
    portal:"renderPortal", egasi:"renderEgasi", audit:"renderAudit",
    studio:"renderStudio" };   // ✅ Studio (2026-09-06)
  try {
    const _nm = _fnNom[p];
    const _f  = _nm ? window[_nm] : null;
    if (typeof _f === "function") _f();
    else if (_nm) console.warn("[nav] " + _nm + " hali yuklanmagan — o'tkazildi");
  } catch (e) { console.warn("[nav] chizishda xato:", e.message); }
  if (p === "pos") {
    refreshCustList(); refreshStaffList(); renderPosGrid();
    if (typeof checkDebtAlerts === "function") checkDebtAlerts();
  }
  // 2026-08-02: sahifa chizilgach ruxsat bo'yicha bloklar yashiriladi
  try { if (typeof applyPermBlocks === "function") applyPermBlocks(); } catch(e) {}
  try { if (typeof applyPermButtons === "function") applyPermButtons(); } catch(e) {}
}

// 2026-07-10: bu yerdagi ESKI toggleCurrency O'CHIRILDI (8-qoida —
// nom to'qnashuvi). Amaldagi yagona nusxa: dashboard.js (saveSetting
// orqali, bulutga sinxronlanadi). Bu yerda qayta e'lon QILINMASIN!
function updateRatePill() {
  // ⚠️ 2026-08-11 (egasining talabi): kurs YUKLANGUNCHA soxta qiymat
  // (12800/0) KO'RSATILMAYDI — "—" turadi. Aks holda kirishda standart
  // raqam haqiqiy kursdek ko'rinib, chalg'itardi (jonli voqea: admin
  // 12800 ni ko'rib qo'lda to'g'rilagan).
  // ⚠️ 2026-08-12 (davomi): ESKI 12800 IZI ham yashiriladi. Ba'zi
  // qurilmalar lokalida o'sha mashhur kurs-xatosi davridan MUHRSIZ
  // 12800 qolgan — pill uni haqiqiy kursdek ko'rsatib yuborardi
  // (jonli: xodim kirishida). Muhrsiz 12800 = qoldiq deb qaraladi,
  // haqiqiy qiymat pull bilan kelganda o'z-o'zidan almashadi.
  // ⚠️ 2026-08-14 (3-tahrir): shart ALMASHTIRILDI. Avval "muhri yo'q
  // 12800" yashirilardi — lekin eski qurilmalarda muhr BOR edi va
  // 12800 haqiqiy kursdek ko'rinaverardi (egasining shikoyati).
  // Endi qoida sodda: 12800 faqat BULUTDAN sozlama kelgandan keyin
  // ko'rsatiladi. Kelmaguncha "—" turadi va o'zi to'ladi.
  // ✅ 2026-08-14 (egasining talabi): BIRINCHI KIRISHDA "—" tursin.
  // Kurs faqat BULUTDAN kelgani ANIQ bo'lsa ko'rsatiladi (`_pulledAt`
  // muhri sozlamalar bulutdan tortilganini bildiradi). Shu bilan eski
  // yoki soxta qiymat haqiqiy kursdek ko'rinmaydi.
  const _r = db.settings?.rate;
  const _keldi = !!db.settings?._pulledAt;
  $("tb-rate").textContent = (_r && _keldi) ? fmt(_r) : "—";
  // 2026-07-26: valyuta yorlig'i YAGONA manbadan (avval uch faylda
  // uch xil yozilib, tugma goh "SO'M+USD", goh "so'm/USD" ko'rinardi)
  $("tb-cur").textContent = currencyLabel();
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
  let d = inp.value.replace(/\D/g, "");

  // 2026-07-31: ODATIY BOSHLANISHLARNI TANIYMIZ.
  // Odam raqamni ko'pincha to'liq yozadi ("87012345678" yoki
  // "77012345678", "998901234567"). Avval ortiqcha raqamlar
  // OXIRIDAN kesilardi — Qozog'iston raqamida oxirgi raqam
  // yo'qolib, mijoz telefoni noto'g'ri saqlanardi.
  // Endi boshidagi ortiqcha kod olib tashlanadi.
  const dial = String(c.dial || "").replace("+", "");
  if (d.length > c.max) {
    if (dial && d.startsWith(dial))       d = d.slice(dial.length);
    else if (c.dial === "+7" && d[0] === "8") d = d.slice(1);   // 8701... → 701...
    else if (d[0] === "0")                d = d.slice(1);       // 0XX... → XX...
  }
  inp.value = d.slice(0, c.max);
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
  // ⚠️ 2026-08-12 (TUZATILDI): sozlama BO'LIM bo'yicha olinadi.
  // Avval doim getChekCfg("bot") edi — ya'ni uslub-sozlamalari
  // (qog'oz eni, sarlavha foni) chekka YETMASDI: sotuv ham, tarix ham
  // "bot" qatlamini olardi. Endi haqiqiy bo'lim uzatiladi.
  const _sect = opts.type === "savat" ? "sotuv" : (opts.type || "sotuv");
  const chekCfg = opts._previewCfg
                ? opts._previewCfg
                : ((typeof getChekCfg === "function") ? getChekCfg(_sect)
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
  // ⚠️ 2026-08-12: uslub-chizuvchilarga SOZLAMALAR ham uzatiladi.
  // Avval ular faqat nom/kontakt/footer olardi — "Sarlavha foni" va
  // qog'oz eni sozlamalari ularga YETIB BORMASDI, shuning uchun har
  // uslub o'z QORA fonini chizardi (egasining shikoyati).
  const _cfg = {shopName,staffName,botUser,receiptUrl,logo,contact,footer,
    showStaff,showContact,
    // ✅ 2026-08-14: bu sozlamalar ham USLUB darajasida (egasining talabi)
    dualCurrency:    chekCfg.dualCurrency,
    showDebtHistory: chekCfg.showDebtHistory,
    addr: chekCfg.addr || "", tagline: chekCfg.tagline || "",
    headerStyle: _hdrStyle, hdrCss: _hdrCss,
    paperWidth: chekCfg.paperWidth || 72,
    // \U0001f534 2026-08-14 ILDIZ-TUZATISH: bu sozlamalar chizuvchilarga
    // UMUMAN UZATILMAS EDI — shu sabab blok o'lchamlari, tekislash,
    // shrift va qo'shimcha matn faqat "Yagona" chekda ishlardi
    // (egasining takroriy shikoyati). Endi hammasi uzatiladi.
    blocks:     chekCfg.blocks || null,
    fontScale:  chekCfg.fontScale  || "normal",
    fontFamily: chekCfg.fontFamily || "dm",
    extraLines: chekCfg.extraLines || [],
    phones:     chekCfg.phones     || [],
    rate:       (typeof db !== "undefined" && db.settings?.rate) || 0,
    F:n=>Math.round(n||0).toLocaleString("ru-RU")};
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
  const _pcRate = Number(sale.rate) || kursOl();   // ✅ 566b
  // ═══ 2026-07-26: CHEK HAR DOIM IKKI VALYUTADA ═══
  // Barcha qatorlar (tovar narxi, chegirma, jami, to'lov) ikkala
  // valyutada ko'rsatiladi. Faqat TARTIB rejimga qarab o'zgaradi:
  //   so'm / ikki valyuta  →  "540 000 / $42.19"
  //   dollar               →  "$42.19 / 540 000"
  // Kurs sotuv paytidagi (_pcRate) — keyin o'zgarsa chek o'zgarmaydi.
  const _usdStr = som => "$" + (_pcRate > 0 ? (som / _pcRate) : 0)
    .toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 2026-07-26: do'kon xohlasa chek FAQAT bitta valyutada bo'lishi mumkin.
  // Sotuvda muhrlangan qiymat ustuvor (eski cheklar o'zgarmasin).
  const _dual = (sale.chekDual != null)
    ? !!sale.chekDual
    // ✅ 2026-08-14: USLUB sozlamasi ustun (bo'lmasa umumiy)
    : (chekCfg && chekCfg.dualCurrency !== undefined
       ? chekCfg.dualCurrency !== false
       : (db.settings?.chekDualCurrency !== false));

  const FC = n => {
    const som = Math.round(n || 0);
    if (!_dual) return _pcMode === "usd" ? _usdStr(som) : F(som);
    return _pcMode === "usd"
      ? `${_usdStr(som)} / ${F(som)}`
      : `${F(som)} / ${_usdStr(som)}`;
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
  // 2026-07-26: JAMI ham har doim ikki valyutada (tartib rejimga qarab)

  // 2026-07-25: qaytarish eslatmasi — asl chek O'ZGARMAYDI, faqat
  // pastida "qisman qaytarilgan" belgisi va qaytarish cheki raqami turadi.
  let _refundNote = "";
  const _refs = (typeof _chekRefundDocs === "function")
    ? _chekRefundDocs(sale) : (sale.refunds || []);   // ✅ 2026-08-19
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
        ${(() => {
          // ✅ QP-3: PUL XULOSASI standart (unified) chekda ham.
          // Avval faqat uslub muhrlangan cheklarda chiqardi — muhrsiz
          // eski cheklar (jonli: 42 ta) pul satrlarisiz qolardi.
          try {
            const _p = _refundPulYig(_refs, db.debtPayments, db.xarajatlar);
            return _refundPulSatrlar(_p, F).map(([k, v]) =>
              `<div style="font-size:10.5px;color:#000;margin-top:1px">${k}: <b>${v}</b></div>`).join("");
          } catch (e) { return ""; }
        })()}
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
    // ⚠️ 2026-07-26: QARZ O'Z VALYUTASIDA QOTADI. Agar qarz DOLLARDA
    // yuritilsa (isUsd), tizim so'mda tursa ham dollarda ko'rsatiladi —
    // aks holda mijoz bilan hisob-kitob buzilardi.
    // Ikki valyuta o'chirilgan bo'lsa — faqat QARZ VALYUTASI.
    // ═══ QARZ QOIDASI (2026-07-26) ═══
    // SO'M qarz — shunchaki so'mda. Aylantirish bo'lmagan, kurs
    //   ko'rsatishning ma'nosi yo'q.
    // DOLLAR qarz — "so'm / kurs = $USD". Qarz sotuv paytida so'mdan
    //   dollarga aylantirilgan, shuning uchun qaysi kursda ekani
    //   chekda qolishi SHART (keyin kurs o'zgarsa ham o'zgarmaydi).
    //   Ikki valyuta o'chirilgan bo'lsa — faqat dollarda.
    if (!isUsd) return `${_s} so'm`;
    // ⚠️ Dollar qarzda kurs KO'RSATILISHI SHART — bu "ikki valyuta
    // ko'rinishi" emas, balki QAYSI KURSDA hisoblanganini hujjatda
    // qoldirish. Shuning uchun _dual sozlamasiga BOG'LIQ EMAS.
    return _pcRate > 0 ? `${_s} / ${F(_pcRate)} = ${_uStr}` : _uStr;
  };

  let debtHtml = "";
  if (remaining > 0) {
    // \u2705 2026-08-14: IKKALA VALYUTA \u2014 yagona manbadan (debtLines)
    const _dl = (typeof debtLines === "function")
      ? debtLines(sale, { F, rate: _pcRate }) : null;
    if (showDebtHistory && _dl && _dl.bor) {
      debtHtml = `
        <div class="sep-dash" style="margin:6px 0"></div>
        ${_dl.oldin ? `<div class="pr pr-sm"><span>Xariddan oldingi qarz</span><span>${_dl.oldin}</span></div>` : ""}
        ${_dl.qoshildi ? `<div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>${_dl.qoshildi}</span></div>` : ""}
        ${_dl.keyin ? `<div class="pr pr-debt"><span>Xariddan keyingi qarz</span><span>${_dl.keyin}</span></div>` : ""}`;
    } else if (false && showDebtHistory && isUsd && prevUsd > 0) {
      const tot = prevUsd + debtUsd;
      // 2026-07-25: OLDINGI va KEYINGI qarz — allaqachon USD da QOTGAN,
      // ular turli kurslarda yig'ilgan. Ularni qayta hisoblash MUMKIN EMAS.
      // Faqat SHU XARIDDA qo'shilayotgan summa so'mdan aylantiriladi.
      // Dollar qarz: "so'm / kurs = $USD" (o'chiq bo'lsa faqat $)
      // Kurs har doim ko'rsatiladi (sozlamadan mustaqil — hujjat uchun)
      const _added = (_pcRate > 0)
        ? `${F(remaining)} / ${F(_pcRate)} = $${debtUsd.toFixed(2)}`
        : `$${debtUsd.toFixed(2)}`;
      debtHtml = `
        <div class="sep-dash" style="margin:6px 0"></div>
        <div class="pr pr-sm"><span>Xariddan oldingi qarz</span><span>$${prevUsd.toFixed(2)}</span></div>
        <div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>${_added}</span></div>
        <div class="pr pr-debt"><span>Xariddan keyingi qarz</span><span>$${tot.toFixed(2)} USD</span></div>`;
    } else if (false && showDebtHistory && !isUsd && prevUzs > 0) {
      // Qarz so'mda yuritiladi — oldingi va keyingi summalar SO'MDA qoladi.
      // Faqat qo'shilayotgan summa yonida joriy kurs bo'yicha USD ko'rsatiladi.
      const _added = FD(remaining);
      debtHtml = `
        <div class="sep-dash" style="margin:6px 0"></div>
        <div class="pr pr-sm"><span>Xariddan oldingi qarz</span><span>${F(prevUzs)} so'm</span></div>
        <div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>${_added}</span></div>
        <div class="pr pr-debt"><span>Xariddan keyingi qarz</span><span>${F(prevUzs + remaining)} so'm</span></div>`;
    } else {
      // 2026-07-25: dollar ishlatiladigan HAR QANDAY rejimda (both/usd)
      // qarz "summa / kurs = $" ko'rinishida — qaysi kursda hisoblangani
      // chekdan ko'rinsin va keyin kurs o'zgarsa ham o'zgarmasin.
      const amt = FD(remaining, isUsd ? debtUsd : null);
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
  ${_tasdiqBelgisi(sale, opts && opts.type)}
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
      <div class="tot-val">${!_dual
        ? (_pcMode === "usd" ? _usdStr(total) : `${F(total)}<span class="tot-uzs"> so'm</span>`)
        : _pcMode === "usd"
          ? `${_usdStr(total)}<span class="tot-uzs"> / ${F(total)} so'm</span>`
          : `${F(total)}<span class="tot-uzs"> so'm / ${_usdStr(total)}</span>`}</div>
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
      <span style="flex:1;min-width:0;overflow:hidden">${idx+1}. <b>${i.art || i.name}</b>${
        i.art ? `<span style="color:#555;font-size:11px"> \u00b7 ${i.name}</span>` : ""} <span style="color:#555">${
        i.variant || [i.color, i.size].filter(Boolean).join(" / ") || ""}</span></span>
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
.hd{${cfg.headerStyle === "dark" ? "background:#0D1B2A;color:#fff" : "background:#fff;color:#000;border-bottom:2px solid #000"};padding:12px 14px;text-align:center}
.hd-n{font-size:17px;font-weight:800;letter-spacing:1px}
.hd-s{font-size:9px;color:#fff;letter-spacing:2px;text-transform:uppercase;margin-top:2px}
.info{padding:8px 12px;font-size:11px;border-bottom:1px dashed #ddd;color:#000;display:flex;flex-wrap:wrap;gap:2px 16px}
.items{padding:6px 12px}
.tot{margin:0 12px;padding:7px 0;border-top:2px solid #0D1B2A;display:flex;justify-content:space-between;font-size:14px;font-weight:800;color:#0D1B2A}
.pay{padding:6px 12px;font-size:11.5px;border-top:1px dashed #ddd}
.pr{display:flex;justify-content:space-between;padding:2px 0}
.ok{background:#fff;color:#000;border:1px solid #000;font-weight:700;font-size:11px;text-align:center;padding:5px;border-radius:6px;margin-top:4px}
.debt{color:#000;font-weight:800;text-decoration:underline}
.ft{padding:8px 12px;text-align:center;font-size:11px;color:#000;border-top:1px dashed #ddd}
.acts{max-width:none;margin:14px 10px 10px;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:8px;padding:11px 8px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #ddd}
@media print{@page{size:${cfg.paperWidth || 72}mm auto;margin:0}
  body{background:#fff;padding:0}
  .w{border-radius:0;box-shadow:none;width:${cfg.paperWidth || 72}mm;max-width:${cfg.paperWidth || 72}mm}
  .acts{display:none}}
</style></head><body>
<div class="w">
  ${_tasdiqBelgisi(sale, opts && opts.type)}
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
    ${discount > 0 ? `<div class="pr"><span>Chegirma</span><span style="font-weight:700">−${F(discount)} so'm</span></div>` : ""}
    <div class="pr"><span>${payLabels[sale.payType]||sale.payType||"—"}</span><span style="font-weight:800">${F(paid)} so'm</span></div>
    ${remaining > 0
      ? `<div class="pr debt"><span>Qarz</span><span>${debtAmt}</span></div>
         ${sale.due ? `<div class="pr" style="font-size:10px;color:#666"><span>Muddat</span><span>${sale.due}</span></div>` : ""}`
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
  // \u2550\u2550 JADVAL (2026-08-12: PDF namunasi darajasiga chiqarildi) \u2550\u2550
  // Egasining namunasi (ALEX GIARDINI hujjati) tuzilishi:
  //   sarlavha + tel + KURS \u2192 mijoz/sotuvchi \u2192 chek \u2116 va sana \u2192
  //   BOSHLANG'ICH QOLDIQ ($) \u2192 jadval: \u2116 | Model | Soni |
  //   Narx ($ va so'm) | Jami ($ va so'm) \u2192 ITOGO ikki valyutada \u2192
  //   To'landi \u2192 QOLDIQ. Oq fon, qora yozuv; eni sozlamadan (58/72/80).
  const {shopName, staffName, contact, footer, showStaff, showContact, F} = cfg;
  const W        = parseInt(cfg.paperWidth) || 72;
  const dark     = (cfg.headerStyle || "dark") === "dark";
  const chekNum  = sale.chekNum || ("#" + sale.id);
  const date     = (sale.date||"").split("-").reverse().join(".");
  const time     = sale.time || "";
  const total    = Number(sale.total    || 0);
  const paid     = Number(sale.paid     || 0);
  const remaining= Number(sale.remaining|| 0);
  const discount = Number(sale.discount || 0);
  const subtotal = Number(sale.subtotal || (total + discount));   // 2026-08-14
  const items    = (sale.items||[]).filter(Boolean);
  const payType  = sale.payType || "";
  const isUsd    = sale.debtCurrency === "usd" && sale.debtUsd;
  const debtUsd  = Number(sale.debtUsd || 0);
  const prevUsd  = Number(sale.prevDebtUsd || 0);
  const prevUzs  = Number(sale.prevDebtUzs || 0);
  const due      = sale.due  || "";
  const rate     = Number(sale.rate) || kursOl();   // ✅ 566b
  const payLabels= {naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash"};
  const D  = n => (Number(n)||0).toFixed(2);
  const hdrCss = dark ? "background:#0D1B2A;color:#fff"
                      : "background:#fff;color:#000;border-bottom:2px solid #000";

  const totalDona  = items.reduce((a,i) => a + (i.qty||0), 0);
  const totalBoxes = items.reduce((a,i) => a + (i.qtyBox||0), 0);
  const totalUsd   = total / (rate || 1);

  // ✅ 2026-08-15: chegirma tovar narxiga taqsimlanadi (yagona chekdagi kabi)
  const _dMap = (typeof chekItemDisc === "function") ? chekItemDisc(sale) : {};
  const rows = items.map((it, idx) => {
    const isBox   = it.sellMode === "karobka" && it.qtyBox;
    // ✅ 2026-08-15: TOVAR NOMI birinchi. Avval `it.art || it.name` edi —
    // artikul bo'lsa NOM umuman chiqmasdi, chekda faqat kod ko'rinardi
    // ("Q.17", "LR-01" — egasining shikoyati).
    const model   = it.name || it.art || "\u2014";
    const _artSub = (it.art && it.art !== it.name) ? it.art : "";
    // ✅ 2026-08-15: RANG zaxirasi — savat namunasida rang `variant`
    // maydonida keladi ("Qora (1 pochka)"), `color` bo'sh bo'lishi
    // mumkin. Shu sabab savat chekida rang ko'rinmasdi.
    const _rangY  = it.color ||
      (it.variant ? String(it.variant).split(" (")[0].split(" / ")[0] : "");
    const izoh    = [_artSub, _rangY, isBox ? (it.groupSizes||"") : (it.size||"")]
                      .filter(Boolean).join(" / ");
    const qtyShow = isBox ? (it.qtyBox + " pchk") : String(it.qty || 0);
    const qtySub  = isBox ? ((it.qty||0) + " dona") : (it.unit || "dona");
    const perUzs  = (typeof chekItemPrice === "function")
      ? chekItemPrice(sale, idx, it, _dMap) : Number(it.price||0);
    const sumUzs  = perUzs * Number(it.qty||0);
    // PDF namunasidagi kabi: dona narx $ da yaxlitlanadi, jami esa
    // O'SHA yaxlitlangan narx \u00d7 soni (aks holda tiyinlarda farq chiqadi).
    const perUsd  = Math.round((perUzs / (rate||1)) * 100) / 100;
    return `<tr>
      <td class="c">${idx+1}</td>
      <td class="l"><b>${model}</b>${izoh ? `<div class="sub">${izoh}</div>` : ""}</td>
      <td class="c">${qtyShow}<div class="sub">${qtySub}</div></td>
      <td class="r">${D(perUsd)}<div class="sub">${(() => {
        const _b = (typeof chekItemBase === "function") ? chekItemBase(sale, idx, it, _dMap) : null;
        return (_b && _b > perUzs)
          ? `<span style="text-decoration:line-through;color:#666;display:block;line-height:1.15">${F(_b)}</span><span style="display:block">${F(perUzs)}</span>`
          : F(perUzs);
      })()}</div></td>
      <td class="r b">${D(perUsd * Number(it.qty||0))}<div class="sub">${F(sumUzs)}</div></td>
    </tr>`;
  }).join("");

  // \u2705 2026-08-14: IKKALA valyuta (yagona manba)
  let _dJ = (typeof debtLines === "function") ? debtLines(sale, { F, rate }) : null;
  // ✅ 2026-08-14: "Qarz tarixi" belgilagichi hamma uslubga ta'sir qiladi
  if (cfg && cfg.showDebtHistory === false) _dJ = null;
  const boshRow = (_dJ && _dJ.oldin)
    ? `<div class="mrow"><span>Oldingi qarz</span><b>${_dJ.oldin}</b></div>` : "";

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',Arial,sans-serif;background:#fff;color:#000;
     padding:6px;font-size:11px;line-height:1.35}
.doc{width:${W}mm;max-width:${W}mm;margin:0 auto;background:#fff}
.hd{${hdrCss};padding:9px 10px;text-align:center}
.shop{font-size:14px;font-weight:800;letter-spacing:.02em}
.sm{font-size:9.5px;opacity:.85}
.meta{font-size:10px;padding:5px 0;border-bottom:1px solid #000}
.mrow{display:flex;justify-content:space-between;gap:6px;padding:1px 0}
table{width:100%;border-collapse:collapse;font-size:10px;margin-top:5px;border:1px solid #000}
th{border:1px solid #000;padding:3px 1px;font-size:9px;font-weight:700}
th .u{display:block;font-size:8px;font-weight:600;opacity:.7}
td{padding:3px 2px;border:1px solid #000;vertical-align:top}
.c{text-align:center}.r{text-align:right}.l{text-align:left}.b{font-weight:700}
.sub{font-size:8.5px;opacity:.72;margin-top:1px}
.tot{border-top:1px solid #000;margin-top:4px;padding-top:4px}
.trow{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0;font-size:11px}
.trow.big{font-size:12.5px;font-weight:800;border-top:1px dashed #000;
          border-bottom:1px dashed #000;padding:3px 0;margin:3px 0}
.ft{text-align:center;font-size:9.5px;margin-top:6px;border-top:1px dashed #000;padding-top:5px}
@media print{ @page{margin:0} body{padding:0} .doc{width:${W}mm} }

  ${typeof chekPrintFix === "function" ? chekPrintFix(cfg && cfg.paperWidth) : ""}
  ${typeof chekStyleCss === "function" ? chekStyleCss(cfg, {shop:".shop",tagline:".sm",meta:".meta",
      itemName:".l",itemPrice:".r",total:".tot,.big",
      debt:".trow",footer:".ft"}) : ""}
  </style></head><body>
<div class="doc">
  ${_tasdiqBelgisi(sale, opts && opts.type)}
  ${cfg.logo ? `<div style="text-align:center;padding:6px 0 2px"><img src="${cfg.logo}" style="max-height:44px;max-width:70%;object-fit:contain"></div>` : ""}
  <div class="hd">
    <div class="shop">${shopName}</div>
    ${cfg.tagline ? `<div class="sm tagline">${cfg.tagline}</div>` : ""}
    ${cfg.addr ? `<div class="sm addr">${cfg.addr}</div>` : ""}
    ${showContact && contact ? `<div class="sm">Tel: ${contact}</div>` : ""}
    <div class="sm">Kurs: ${F(rate)}</div>
  </div>
  <div class="meta">
    ${sale.customerName ? `<div class="mrow"><span>Mijoz</span><b>${sale.customerName}</b></div>` : ""}
    ${sale.customerPhone ? `<div class="mrow"><span>Mijoz raqami</span><span>${sale.customerPhone}</span></div>` : ""}
    ${showStaff && staffName ? `<div class="mrow"><span>Sotuvchi</span><span>${staffName}</span></div>` : ""}
    <div class="mrow"><span>Chek \u2116</span><b>${chekNum}</b></div>
    <div class="mrow"><span>Sana</span><span>${date} ${time}</span></div>
    <!-- ✅ 2026-08-14: "Oldingi qarz" TEPADAN olib tashlandi — u endi
         pastdagi QARZ bo'limida, yagona tartib bo'yicha -->
  </div>
  <table style="table-layout:fixed;width:100%">
    <thead><tr>
      <th style="width:7%">\u2116</th>
      <th class="l" style="width:33%">Model</th>
      <th style="width:15%">Soni</th>
      <th class="r" style="width:23%">Narx<span class="u">$ / so'm</span></th>
      <th class="r" style="width:22%">Jami<span class="u">$ / so'm</span></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${(() => {
    // \u2705 2026-08-14: BO'LIMLAR YAGONA TARTIBDA (chekRows)
    try {
      const _R = chekRows(sale, cfg, F);
      const _H = chekRowsHtml(_R, { row:"trow", sep:"", ft:"ft",
                                    big:"big", total:"tot", debt:"b" });
      return `<div class="tot">${_H.summary}${_H.payment}${_H.debt}</div>${(typeof chekRefundNote === "function" ? chekRefundNote(sale, F) : "")}${_H.footer}`;
    } catch (e) { return ""; }
  })()}
  </div>
  </body></html>`;
}

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
  // ✅ 2026-08-15: chegirma hisobga olinadi (boshqa uslublardagi kabi)
  const _dMapT = (typeof chekItemDisc === "function") ? chekItemDisc(sale) : {};
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
    // Chegirmali narx; asl narx qavsda (matnli chekda chizish yo'q)
    const _pT   = (typeof chekItemPrice === "function")
      ? Math.round(chekItemPrice(sale, i, it, _dMapT)) : price;
    const _bT   = (typeof chekItemBase === "function")
      ? chekItemBase(sale, i, it, _dMapT) : null;
    const _aslT = (_bT && _bT > _pT) ? ` (asl ${F(_bT)})` : "";
    const calc  = `${color ? color+"  " : ""}${F(qty)}${unit} x ${F(_pT)}${_aslT} = ${F(_pT * qty)}`;
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
    // \u2705 2026-08-14: IKKALA VALYUTA \u2014 yagona manba (debtLines)
    // ⚠️ Termal ichida `debtLines` nomli MAHALLIY funksiya bor —
    // global yagona manbani `window` orqali chaqiramiz (aks holda
    // o'zini-o'zi chaqirib cheksiz halqaga tushardi).
    const _fn = (typeof window !== "undefined" && window.debtLines) ||
                (typeof globalThis !== "undefined" && globalThis.debtLines);
    let _dT = (typeof _fn === "function") ? _fn(sale, { F }) : null;
  // ✅ 2026-08-14: "Qarz tarixi" belgilagichi hamma uslubga ta'sir qiladi
  if (cfg && cfg.showDebtHistory === false) _dT = null;
    if (_dT && (_dT.oldin || _dT.keyin)) {
      if (_dT.oldin)    lines.push(lr("  Oldingi qarz:", _dT.oldin));
      if (_dT.qoshildi) lines.push(lr("  Qarzga qo'shildi:", _dT.qoshildi));
      if (_dT.keyin)    lines.push(lr("  JAMI QARZ:", _dT.keyin));

    }
    if (due) lines.push(lr("  Muddat:", due));
    return lines.join("\n");
  };

  const rows = [
    EQ,
    center(shopName.toUpperCase()),
    // ✅ 2026-08-14: shior va manzil — yagona chekdagi kabi
    cfg.tagline ? center(cfg.tagline) : null,
    cfg.addr    ? center(cfg.addr)    : null,
    showContact && contact ? center(contact) : null,
    priceType === "ulgurji" ? center("[ ULGURJI SAVDO ]") : null,
    EQ,
    lr("Chek: " + chekNum, date + " " + time),
    showStaff && staffName && staffName !== "—" ? ("Kassir: " + staffName) : null,
    sale.customerName ? ("Mijoz: " + sale.customerName) : null,
    sale.customerPhone ? ("Tel:   " + sale.customerPhone) : null,
    DA,
    itemLines,
    // \u2705 2026-08-14: BO'LIMLAR YAGONA TARTIBDA (chekRows) \u2014
    // yig'indi \u2192 to'lov \u2192 qarz. Tovarlar qismi yuqorida (matnli).
    EQ,
    ...(() => {
      try {
        const _R = chekRows(sale, cfg, F);
        const out = [];
        _R.summary.forEach(x => out.push(lr(x[0] + ":", x[1])));
        if (_R.payment.length) { out.push(EQ); _R.payment.forEach(x => out.push(lr(x[0] + ":", x[1]))); }
        if (_R.debt.length)    { out.push(DA); _R.debt.forEach(x => out.push(lr(x[0] + ":", x[1]))); }
        return out;
      } catch (e) { return []; }
    })(),
    note ? (DA + "\nIzoh: " + note) : null,
    EQ,
    (typeof chekRefundNote === "function" ? chekRefundNote(sale, F, true) : null),
    center(footer || "Rahmat! Yana kutamiz"),
    // ✅ 2026-08-14: qo'shimcha matn qatorlari
    ...(() => { try {
      const _R = chekRows(sale, cfg, F);
      return _R.footer.slice(1).map(t => center(t));
    } catch (e) { return []; } })(),
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
.rc{background:#fff;padding:18px 16px;
    /* ✅ 2026-08-14: ZAMONAVIY ko'rinish (egasining talabi) — avval
       eski matn-terminal uslubida edi. Endi tiniq monoshrift, yumshoq
       oraliq va tabiiy rang. Tuzilma o'zgarmagan: chop etishda
       avvalgidek tekis chiqadi. */
    /* \u26a0\ufe0f 2026-08-15: satr 40 BELGI. Shrift katta bo'lsa satrlar
       sig'may O'RALIB ketadi va ikki tomonlama tekislash buziladi
       (chap tomonga yopishib qoladi \u2014 egasining shikoyati).
       Endi: oralish YOQ (pre) va shrift 40 belgi bemalol
       sig'adigan o'lchamda. */
    white-space:pre;word-break:normal;
    font-family:'JetBrains Mono','SF Mono','Consolas','Courier New',monospace;
    font-size:11.5px;line-height:1.65;color:#111;letter-spacing:0;
    /* ✅ 2026-08-15: blok MATN ENIGA moslashadi va markazda turadi —
       avval o'ngda katta bo'sh joy qolardi (egasining shikoyati). */
    width:fit-content;max-width:100%;margin:0 auto;overflow-x:hidden;
    border-radius:14px;box-shadow:0 2px 14px rgba(0,0,0,.07);
    border:1px solid #ECEAE6}
.acts{width:340px;max-width:100%;margin:10px 0 0;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:7px;padding:11px;
             font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#000;color:#fff}
.btn-c{background:#fff;color:#000;border:1.5px solid #ccc}
@media print{
  /* \u2705 2026-08-12: qog'oz eni SOZLAMADAN (avval 72mm qotib qolgandi \u2014
     58/80 mm tanlansa ham termal chek 72mm da chiqardi). Shrift ham
     uslub sozlamasiga ergashadi. */
  @page{size:${cfg.paperWidth || 72}mm auto;margin:0}
  body{background:#fff;padding:0}
  .rc{width:${cfg.paperWidth || 72}mm;max-width:${cfg.paperWidth || 72}mm;
      border-radius:0;box-shadow:none;
      font-size:${({small:10,normal:11,large:12.5,xlarge:14})[cfg.fontScale] || 11}px;
      line-height:1.5;padding:4px 6px}
  .acts{display:none}
}

  ${typeof chekPrintFix === "function" ? chekPrintFix(cfg && cfg.paperWidth) : ""}
  ${typeof chekStyleCss === "function" ? chekStyleCss(cfg, {_noAlign:true,
      shop:".rc",tagline:".rc",meta:".rc",
      itemName:".rc",itemPrice:".rc",total:".rc",debt:".rc",footer:".rc"}) : ""}
  </style></head><body>
${cfg.logo ? `<div style="text-align:center;padding:6px 0 2px"><img src="${cfg.logo}" style="max-height:44px;max-width:70%;object-fit:contain"></div>` : ""}
  <div class="rc">
  ${_tasdiqBelgisi(sale, opts && opts.type)}${rows.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
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
  // \u2550\u2550 ULGURJI CHEK (2026-08-12, qayta yozildi) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // Egasining talabi: PDF namunadagi ULGURJI HUJJAT tarkibi, lekin
  // A4 emas \u2014 TERMAL qog'ozda (58/72/80 mm, sozlamadan). Ranglar,
  // soyalar, to'q sarlavha YO'Q: faqat OQ FON + QORA YOZUV (printerda
  // aniq chiqadi va siyoh tejaydi).
  // Namunadan olingan tarkib: boshlang'ich qoldiq, MODEL (artikul)
  // ustuni, dona narx va jami IKKI VALYUTADA, oxirida
  // Jami / To'landi / Qoldiq uch qatori.
  const {shopName, staffName, contact, footer, showStaff, showContact, F} = cfg;
  const W        = parseInt(cfg.paperWidth) || 72;
  const chekNum  = sale.chekNum || ("#" + sale.id);
  const date     = (sale.date||"").split("-").reverse().join(".");
  const time     = sale.time || "";
  const total    = Number(sale.total    || 0);
  const paid     = Number(sale.paid     || 0);
  const remaining= Number(sale.remaining|| 0);
  const discount = Number(sale.discount || 0);
  const subtotal = Number(sale.subtotal || (total + discount));   // 2026-08-14
  const items    = (sale.items||[]).filter(Boolean);
  const payType  = sale.payType || "";
  const isUsd    = sale.debtCurrency === "usd" && sale.debtUsd;
  const debtUsd  = Number(sale.debtUsd || 0);
  const prevUsd  = Number(sale.prevDebtUsd || 0);
  const prevUzs  = Number(sale.prevDebtUzs || 0);
  const due      = sale.due  || "";
  const rate     = Number(sale.rate) || kursOl();   // ✅ 566b
  const payLabels= {naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash"};
  const D        = n => "$" + (Number(n)||0).toFixed(2);

  const totalDona  = items.reduce((a,i) => a + (i.qty||0), 0);
  const totalBoxes = items.reduce((a,i) => a + (i.qtyBox||0), 0);

  // Tovar qatorlari: MODEL / soni / dona narx ($ va so'm) / jami
  // ✅ 2026-08-15: CHEGIRMA tovar narxiga taqsimlanadi — yagona
  // chekdagi kabi (avval bu uslublarda chegirma HIS QILINMASDI).
  const _dMap = (typeof chekItemDisc === "function") ? chekItemDisc(sale) : {};
  const itemRows = items.map((it, idx) => {
    const isBox   = it.sellMode === "karobka" && it.qtyBox;
    // ✅ 2026-08-15: TOVAR NOMI birinchi. Avval `it.art || it.name` edi —
    // artikul bo'lsa NOM umuman chiqmasdi, chekda faqat kod ko'rinardi
    // ("Q.17", "LR-01" — egasining shikoyati).
    const model   = it.name || it.art || "\u2014";
    const _artSub = (it.art && it.art !== it.name) ? it.art : "";
    // ✅ 2026-08-15: RANG zaxirasi — savat namunasida rang `variant`
    // maydonida keladi ("Qora (1 pochka)"), `color` bo'sh bo'lishi
    // mumkin. Shu sabab savat chekida rang ko'rinmasdi.
    const _rangY  = it.color ||
      (it.variant ? String(it.variant).split(" (")[0].split(" / ")[0] : "");
    const rang    = [_artSub, _rangY, isBox ? (it.groupSizes||"") : (it.size||"")]
                      .filter(Boolean).join(" / ");
    const qtyShow = isBox ? (it.qtyBox + " pchk (" + (it.qty||0) + ")")
                          : ((it.qty||0) + " " + (it.unit||"dona"));
    const perUzs  = (typeof chekItemPrice === "function")
      ? chekItemPrice(sale, idx, it, _dMap) : Number(it.price||0);
    const sumUzs  = perUzs * Number(it.qty||0);
    return `<tr>
      <td class="c">${idx+1}</td>
      <td class="l"><b>${model}</b>${rang ? `<div class="sub">${rang}</div>` : ""}</td>
      <td class="c">${qtyShow}</td>
      <td class="r">${(() => {
        // ✅ 2026-08-15: ASL narx chizib ko'rsatiladi (yagona chekdagi kabi)
        const _b = (typeof chekItemBase === "function") ? chekItemBase(sale, idx, it, _dMap) : null;
        return (_b && _b > perUzs)
          ? `<span style="text-decoration:line-through;color:#666;display:block;line-height:1.15">${F(_b)}</span><span style="display:block">${F(perUzs)}</span>`
          : F(perUzs);
      })()}<div class="sub">${D(perUzs / (rate||1))}</div></td>
      <td class="r b">${F(sumUzs)}<div class="sub">${D(sumUzs / (rate||1))}</div></td>
    </tr>`;
  }).join("");

  // Oldingi qarz (namunadagi "\u041d\u0430\u0447\u0430\u043b\u044c\u043d\u0430\u044f \u043e\u0441\u0442\u0430\u0442\u043a\u0430")
  // \u2705 2026-08-14: IKKALA valyuta (yagona manba)
  let _dW = (typeof debtLines === "function") ? debtLines(sale, { F, rate }) : null;
  // ✅ 2026-08-14: "Qarz tarixi" belgilagichi hamma uslubga ta'sir qiladi
  if (cfg && cfg.showDebtHistory === false) _dW = null;
  const boshRow = (_dW && _dW.oldin)
    ? `<div class="row"><span>Oldingi qarz</span><b>${_dW.oldin}</b></div>` : "";

  // Yakun: Jami / To'landi / Qoldiq
  const yakun =
    `<div class="row big"><span>JAMI</span><b>${F(total)} so'm${
      isUsd || prevUsd > 0 ? " / " + D(total / (rate||1)) : ""}</b></div>` +
    // ✅ 2026-08-14: chegirmasiz jami — yagona chekdagi kabi
    (discount > 0 ? `<div class="row"><span>Jami (chegirmasiz)</span><span>${F(subtotal)}</span></div>` : "") +
    (discount > 0 ? `<div class="row"><span>Chegirma</span><b>-${F(discount)}</b></div>` : "") +
    `<div class="row"><span>To'landi (${payLabels[payType]||payType||"\u2014"})</span><b>${F(paid)} so'm</b></div>` +
    (remaining > 0
      ? `<div class="row big"><span>QOLDIQ</span><b>${
          isUsd ? D(debtUsd) : F(remaining) + " so'm"}</b></div>` +
        ((_dW && _dW.keyin)
          ? `<div class="row"><span>Umumiy qarz</span><b>${_dW.keyin}</b></div>` : "") +
        (due ? `<div class="row"><span>Muddat</span><b>${due}</b></div>` : "")
      : `<div class="row big"><span>QOLDIQ</span><b>0</b></div>`);

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ulgurji chek ${chekNum}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',Arial,sans-serif;background:#fff;color:#000;
     padding:6px;font-size:11.5px;line-height:1.35}
.doc{width:${W}mm;max-width:${W}mm;margin:0 auto;background:#fff}
.hd{text-align:center;border-bottom:1px solid #000;padding-bottom:5px;margin-bottom:5px}
.shop{font-size:15px;font-weight:800;letter-spacing:.02em}
.sm{font-size:10px}
.meta{font-size:10.5px;margin-bottom:5px}
.meta div{display:flex;justify-content:space-between;gap:6px}
table{width:100%;border-collapse:collapse;font-size:10.5px;border:0}
th{border-top:1px solid #000;border-bottom:1px solid #000;padding:3px 2px;
   font-size:9.5px;font-weight:700;text-align:center}
td{padding:3px 2px;border-bottom:1px dotted #999;vertical-align:top}
.c{text-align:center}.r{text-align:right}.l{text-align:left}.b{font-weight:700}
.sub{font-size:9px;color:#000;opacity:.75}
.tot{border-top:1px solid #000;margin-top:5px;padding-top:4px}
.row{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0;font-size:11px}
.row.big{font-size:13px;font-weight:800;border-top:1px dashed #000;
         border-bottom:1px dashed #000;padding:3px 0;margin:3px 0}
.ft{text-align:center;font-size:10px;margin-top:6px;border-top:1px dashed #000;padding-top:5px}
@media print{
  @page{margin:0}
  body{padding:0}
  .doc{width:${W}mm}
}

  ${typeof chekPrintFix === "function" ? chekPrintFix(cfg && cfg.paperWidth) : ""}
  ${typeof chekStyleCss === "function" ? chekStyleCss(cfg, {shop:".shop",tagline:".sm",meta:".meta",
      itemName:".l",itemPrice:".r",total:".tot,.big",
      debt:".row",footer:".ft"}) : ""}
  </style></head><body>
<div class="doc">
  ${_tasdiqBelgisi(sale, opts && opts.type)}
  ${cfg.logo ? `<div style="text-align:center;padding:6px 0 2px"><img src="${cfg.logo}" style="max-height:44px;max-width:70%;object-fit:contain"></div>` : ""}
  <div class="hd">
    <div class="shop">${shopName}</div>
    ${cfg.tagline ? `<div class="sm tagline">${cfg.tagline}</div>` : ""}
    ${cfg.addr ? `<div class="sm addr">${cfg.addr}</div>` : ""}
    ${showContact && contact ? `<div class="sm">${contact}</div>` : ""}
  </div>
  <div class="meta">
    <div><span>Chek</span><b>${chekNum}</b></div>
    <div><span>Sana</span><span>${date} ${time}</span></div>
    ${sale.customerName ? `<div><span>Mijoz</span><b>${sale.customerName}</b></div>` : ""}
    ${sale.customerPhone ? `<div><span>Mijoz raqami</span><span>${sale.customerPhone}</span></div>` : ""}
    ${showStaff && staffName ? `<div><span>Sotuvchi</span><span>${staffName}</span></div>` : ""}
    <div><span>Kurs</span><span>${F(rate)}</span></div>
  </div>
  <!-- ✅ 2026-08-14: "Oldingi qarz" endi pastdagi QARZ bo'limida -->
  <table style="table-layout:fixed;width:100%">
    <thead><tr>
      <th style="width:7%">\u2116</th><th class="l" style="width:33%">Model</th>
      <th style="width:15%">Soni</th><th class="r" style="width:23%">Narx</th><th class="r" style="width:22%">Jami</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  ${(() => {
    // \u2705 2026-08-14: BO'LIMLAR YAGONA TARTIBDA (chekRows) \u2014
    // meta \u2192 tovarlar \u2192 yig'indi \u2192 to'lov \u2192 qarz \u2192 altbilgi.
    // Faqat TOVARLAR qismi uslubga xos (yuqoridagi jadval).
    try {
      const _R = chekRows(sale, cfg, F);
      const _H = chekRowsHtml(_R, { row:"row", sep:"", ft:"ft",
                                    big:"big", total:"tot", debt:"b" });
      return `<div class="tot">${_H.summary}${_H.payment}${_H.debt}</div>${(typeof chekRefundNote === "function" ? chekRefundNote(sale, F) : "")}${_H.footer}`;
    } catch (e) { return ""; }
  })()}
  </div>
  </body></html>`;
}

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
  const _dMapM = (typeof chekItemDisc === "function") ? chekItemDisc(sale) : {};
  const itemsHtml = items.map((it, idx) => {
    const isBox  = it.sellMode === "karobka" && it.qtyBox;
    const art    = it.art ? `<span class="it-art">${it.art}</span>` : "";
    // ✅ 2026-08-15: chegirma taqsimlangan narx (yagona chekdagi kabi)
    const _pShow  = (typeof chekItemPrice === "function")
      ? chekItemPrice(sale, idx, it, _dMapM) : (it.price||0);
    const sum     = _pShow*(it.qty||0);
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
    // ✅ 2026-08-15: CHEGIRMA ko'rinadi — asl narx chizib beriladi
    // (Ulgurji/Jadvaldagi kabi). Avval `pricePer` chegirmasiz edi.
    const _bM = (typeof chekItemBase === "function")
      ? chekItemBase(sale, idx, it, _dMapM) : null;
    const _narxM = (_bM && _bM > _pShow)
      ? `<s style="color:#666">${F(_bM)}</s> ${F(_pShow)}`
      : F(_pShow);
    const calcStr = `${F(qtyShow)} ${unitShow} × ${_narxM} = ${F(sum)}${pchkNote}`;
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
    payHtml = `<div class="pr"><span>${payLabels[payType]||payType}</span><span style="color:#000;font-weight:700">${F(paid)} so'm</span></div>`;
  }

  // Qarz bo'limi
  let debtHtml = "";
  if (remaining > 0) {
    const newDebtAmt = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${F(remaining)} so'm`;
    debtHtml += `<div class="sep-dash" style="margin:6px 0"></div>`;
    // \u2705 2026-08-14: IKKALA VALYUTA \u2014 yagona manba (debtLines).
    // Avval faqat dollar qarzi ko'rsatilardi, so'm qarzi tushib qolardi.
    let _dM = (typeof debtLines === "function") ? debtLines(sale, { F }) : null;
  // ✅ 2026-08-14: "Qarz tarixi" belgilagichi hamma uslubga ta'sir qiladi
  if (cfg && cfg.showDebtHistory === false) _dM = null;
    if (_dM && (_dM.oldin || _dM.keyin)) {
      if (_dM.oldin)
        debtHtml += `<div class="pr pr-sm"><span>Oldingi qarz</span><span>${_dM.oldin}</span></div>`;
      if (_dM.qoshildi)
        debtHtml += `<div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>${_dM.qoshildi}</span></div>`;
      if (_dM.keyin)
        debtHtml += `<div class="pr pr-debt-total"><span>JAMI QARZ</span><span>${_dM.keyin}</span></div>`;

    } else {
      debtHtml += `<div class="pr pr-debt"><span>QARZ</span><span>${newDebtAmt}</span></div>`;
    }
    if (due) debtHtml += `<div class="pr pr-sm"><span>Muddat</span><span style="color:#000;font-weight:700">${due}</span></div>`;
  } else {
    debtHtml = `<div class="paid-ok">✓ To'liq to'landi</div>`;
  }

  // ✅ 2026-08-14: chegirmasiz jami — yagona chekdagi kabi
  const discHtml = discount > 0
    ? `<div class="pr pr-sm"><span>Jami (chegirmasiz)</span><span>${F(subtotal)} so'm</span></div>` +
      `<div class="pr" style="color:#000"><span>Chegirma${sale.discountPct ? " -"+sale.discountPct+"%" : ""}</span><span>−${F(discount)} so'm</span></div>` : "";

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
.hd{${cfg.headerStyle === "dark" ? "background:#0D1B2A;color:#fff" : "background:#fff;color:#000;border-bottom:2px solid #000"};padding:14px 18px;text-align:center}
.hd-name{font-family:'Sora',sans-serif;font-size:18px;font-weight:800;letter-spacing:1.5px}
.hd-meta{font-size:12px;color:#b8c5d0;margin-top:4px;line-height:1.6;font-weight:500}
.hd-meta b{color:#E9A500}
.badge-ulgurji{display:inline-block;background:#E9A500;color:#0D1B2A;font-size:9px;font-weight:800;padding:1px 7px;border-radius:8px;letter-spacing:.5px;margin-top:3px}
.cust{padding:7px 16px;background:#F0F8FF;border-bottom:1px dashed #C7E3F5;font-size:12px;color:#0D1B2A;display:flex;justify-content:space-between}
.note-w{padding:6px 16px;background:#FFFBEB;border-bottom:1px dashed #FDE68A;font-size:11.5px;color:#000}
.items-lbl{padding:8px 16px 4px;font-size:10px;font-weight:800;color:#555;letter-spacing:1.5px;text-transform:uppercase}
.items{padding:0 16px}
.it{padding:7px 0;border-bottom:1px dashed #E8E5E0}
.it:last-child{border-bottom:none}
.it-top{display:flex;align-items:baseline;gap:6px}
.it-num{font-size:10px;color:#555;font-weight:700;min-width:14px}
.it-name{flex:1;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#0D1B2A}
.it-art{font-family:'DM Sans',sans-serif;font-size:10px;color:#000;background:#EEF2FF;padding:1px 6px;border-radius:4px;font-weight:600;margin-left:4px;vertical-align:middle}
.it-sum{font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:#0D1B2A;white-space:nowrap}
.it-info{font-size:12px;color:#333;margin-top:3px;padding-left:20px;font-weight:500}
.it-color{color:#333;font-weight:600;margin-right:8px}.it-calc{color:#111;font-weight:700}
.tot{margin:0 16px;padding:8px 0;border-top:2px solid #0D1B2A;display:flex;justify-content:space-between;align-items:center}
.tot-l{font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:#0D1B2A}
.tot-cnt{font-size:11px;color:#555;font-weight:600;margin-top:1px}
.tot-v{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;color:#0D1B2A}
.pay{padding:8px 16px 10px;border-top:1px dashed #ddd}
.pay-lbl{font-size:10px;font-weight:800;color:#333;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.pr{display:flex;justify-content:space-between;font-size:13px;color:#000;padding:3px 0;font-weight:500}
.pr.pr-sm{font-size:12px;color:#555;font-weight:600}
.pr.pr-debt{color:#000;font-weight:800;font-size:14px;border-top:1px solid #fca5a5;padding-top:6px;margin-top:2px}
.pr.pr-debt-total{color:#000;font-weight:800;font-size:16px;border-top:2px solid #dc2626;padding-top:8px;margin-top:4px}
.sep-dash{border-top:1px dashed #ddd}
.paid-ok{background:#ECFDF5;color:#000;font-weight:700;font-size:12px;text-align:center;padding:7px;border-radius:8px;margin-top:4px}
.ft{padding:10px 16px 14px;text-align:center;border-top:1px dashed #ddd}
.ft-txt{font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:#0D1B2A}
.ft-sub{font-size:11px;color:#444;margin-top:3px}
.ft-bot{font-size:11px;color:#000;margin-top:6px}
.acts{width:340px;max-width:100%;margin:10px 0 0;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:10px;padding:11px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #E8E5E0}
@media print{
  body{background:#fff;padding:0}
  .wrap,.rc{width:${cfg.paperWidth || 72}mm;max-width:${cfg.paperWidth || 72}mm;border-radius:0;box-shadow:none}
  .acts{display:none}
  .hd,.hd-meta b{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pr.pr-debt,.pr.pr-debt-total{color:#000!important}
}

  ${typeof chekPrintFix === "function" ? chekPrintFix(cfg && cfg.paperWidth) : ""}
  ${typeof chekStyleCss === "function" ? chekStyleCss(cfg, {shop:".hd-name",tagline:".hd-meta",meta:".cust",
      itemName:".it-name",itemPrice:".it-calc,.it-sum",total:".tot-v,.tot",
      debt:".pr-debt,.pr-debt-total,.pr",footer:".ft"}) : ""}
  </style></head><body>
<div class="wrap">
  ${_tasdiqBelgisi(sale, opts && opts.type)}
  <div class="rc">

    ${logoHtml}
    <div class="hd">
      <div class="hd-name">${shopName.toUpperCase()}</div>
      ${cfg.tagline ? `<div class="hd-meta tagline" style="margin-top:2px">${cfg.tagline}</div>` : ""}
      ${cfg.addr ? `<div class="hd-meta addr" style="margin-top:1px">${cfg.addr}</div>` : ""}
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

    ${(() => {
    // \u2705 2026-08-14: BO'LIMLAR YAGONA TARTIBDA (chekRows) \u2014
    // yig'indi \u2192 to'lov \u2192 qarz. Tovarlar qismi yuqorida, o'z uslubida.
    try {
      const _R = chekRows(sale, cfg, F);
      const _H = chekRowsHtml(_R, { row:"pr", sep:"sep-dash", ft:"ft",
                                    big:"pr-sm", total:"pr-debt-total", debt:"pr-debt" });
      return `<div class="tot"><div><div class="tot-l">JAMI</div>` +
             `<div class="tot-cnt">${items.length} xil \u00b7 ${totalBoxes ? totalBoxes + " pochka" : totalDona + " dona"}</div></div>` +
             `<div class="tot-v">${F(total)} <span style="font-size:13px;font-weight:600">so'm</span></div></div>` +
             `<div class="pay"><div class="pay-lbl">To'lov</div>` +
             _H.summary + _H.payment + _H.debt +
             (typeof chekRefundNote === "function" ? chekRefundNote(sale, F) : "");
    } catch (e) { return ""; }
  })()}
    </div>

    <div class="ft">
      <div class="ft-txt">${footer || "Rahmat! Yana kutamiz 🙏"}</div>
    ${(() => { try {
      const _R = chekRows(sale, cfg, F);
      // ✅ 2026-08-14: qo'shimcha matn qatorlari (reklama, ish vaqti)
      return _R.footer.slice(1).map(t =>
        `<div class="ft-sub" style="font-size:11px;opacity:.8">${t}</div>`).join("");
    } catch (e) { return ""; } })()}
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
    // ⚠️ 2026-08-01: O'LCHAM ENDI BU YERDA BELGILANMAYDI.
    // Avval shu funksiya fontSize/padding/width ni QAYTA YOZARDI va
    // `.srch-inp` klassini (hamda HTML dagi uslubni) bosib ketardi —
    // qidiruv qatorini kattalashtirish urinishlari ta'sir qilmasdi.
    // Endi ko'rinish faqat CSS klassida (yagona manba).

    // O'rab, ✕ qo'shamiz (input DOM'da joyida qoladi — listener'lar saqlanadi)
    // ⚠️ `inline-flex` edi — o'ram MAZMUNIGA QARAB kichrayardi va
    // input'ning `width:100%` i tor blokka nisbatan hisoblanardi.
    // Endi `flex` + `width:100%` — qator to'liq kenglikda.
    const wrap = document.createElement("span");
    wrap.style.cssText = "position:relative;display:flex;width:100%;align-items:center";
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const btn = document.createElement("button");
    btn.type = "button"; btn.textContent = "✕"; btn.setAttribute("data-qclr", cfg.id);
    // Kattaroq va aniqroq ✕ (avval 15px, ko'zga tashlanmasdi)
    btn.style.cssText = "display:none;position:absolute;right:12px;background:none;border:none;cursor:pointer;color:#9CA3AF;font-size:20px;line-height:1;padding:2px 6px;border-radius:8px";
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
      // 2026-08-15: soxta himoya juftligi — chetlab o'tiladi
      if (el.dataset.afFake === "1") return;
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
  const rate = kursOl();
  return Math.round((p.costUsd || 0) * rate);
}

// Ko'rsatish uchun USD ekvivalenti (joriy kurs bo'yicha — faqat ko'rinish)
function getCostUsdView(p) {
  const rate = kursOl();
  return rate > 0 ? (getCostUzs(p) / (rate || Infinity)) : 0;
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
  const rate = kursOl();
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


// Valyuta rejimi yorlig'i — BARCHA joyda shu funksiya ishlatiladi
function currencyLabel(cur) {
  const c = cur || db.settings?.priceCurrency || "uzs";
  return c === "usd" ? "USD" : c === "both" ? "SO'M+USD" : "SO'M";
}

// ═══ VALYUTA REJIMI — SUPERADMIN BOSHQARADI (2026-07-26) ═══
// Do'kon ochilganda SuperAdmin belgilaydi:
//   "uzs"   — faqat so'm (egasi o'zgartira olmaydi)
//   "usd"   — faqat dollar (egasi o'zgartira olmaydi)
//   "multi" — ko'p valyutali, egasi o'zi tanlaydi (eski xulq)
// Sabab: ko'p do'konlar ko'p valyutali rejimda chalg'ib, tannarx va
// ulgurji narxlar dollarga o'tib ketardi.
function getShopCurrencyMode() {
  const m = db.settings?.currencyMode;
  return (m === "uzs" || m === "usd" || m === "multi") ? m : "multi";
}

// Egasi valyutani o'zgartira oladimi?
function canChangeCurrency() {
  return getShopCurrencyMode() === "multi";
}

// Amaldagi ko'rsatish valyutasi — qat'iy rejimda MAJBURIY
function effectivePriceCurrency() {
  const mode = getShopCurrencyMode();
  if (mode === "uzs") return "uzs";
  if (mode === "usd") return "usd";
  return db.settings?.priceCurrency || "uzs";
}

// Qat'iy rejimda sozlamani ham to'g'rilab qo'yamiz (bir marta)
function enforceCurrencyMode() {
  const mode = getShopCurrencyMode();
  if (mode === "multi") return false;
  if (db.settings && db.settings.priceCurrency !== mode) {
    db.settings.priceCurrency = mode;
    saveDB();
    console.log(`💱 Valyuta rejimi qat'iy: ${mode} (SuperAdmin belgilagan)`);
    return true;
  }
  return false;
}

// ═══ OBUNA TARIFI (2026-07-26) ═══
// SuperAdmin belgilaydi: "start" (bot yopiq) yoki "pro" (hammasi ochiq).
// Do'kon egasi o'zgartira olmaydi — bulutdan keladi.
function getShopTier() {
  const t = db.settings?.tier;
  return t === "start" ? "start" : "pro";
}

// Bot bilan bog'liq imkoniyatlar (portal, Telegram chek, eslatmalar)
function canUseBot() {
  return getShopTier() === "pro";
}

// Yopiq imkoniyat bosilganda ko'rsatiladigan xabar
function tierLockedToast(nima) {
  toast(`🔒 ${nima || "Bu imkoniyat"} — PRO tarifda mavjud. ` +
        `Yangilash uchun MERX bilan bog'laning.`, "info");
}

// Start tarifida bot bo'limlarini yashirish (sahifa yuklangach)
function applyTierLock() {
  const locked = !canUseBot();
  document.querySelectorAll("[data-tier-pro]").forEach(el => {
    if (locked) {
      el.style.display = "none";
    } else {
      el.style.display = "";
    }
  });
  // Yon menyudagi "Mijoz portali" bo'limi
  const navPortal = document.querySelector('.ni[data-p="portal"]');
  if (navPortal) navPortal.style.display = locked ? "none" : "";
  return locked;
}

// ═══ MOBIL: TEPA QATORNI YIG'ISH (2026-08-06) ═══
// Telefonda #topbar doim ~50px joy egallaydi. Endi pastga
// surilganda yig'iladi, yuqoriga surilganda qaytadi.
//
// ⚠️ Surish OYNADA emas, #pages ichida bo'ladi
//    (#pages{overflow-y:auto}) — tinglovchi o'shanga ulanadi.
// ⚠️ Balandlik O'LCHANADI, qotirilmaydi (lenta chiqsa o'zgaradi).
// ⚠️ Uch himoya: faqat <=768px · yon menyu ochiq bo'lsa yig'ilmaydi ·
//    tepaga yaqin bo'lsa (40px) doim ochiq.
// ⚠️ POS sahifasiga tegmaydi — u o'z ichida suriladi, #pages da
//    scroll hodisasi umuman bo'lmaydi.
function initTopbarAutoHide() {
  const pages  = document.getElementById("pages");
  const topbar = document.getElementById("topbar");
  if (!pages || !topbar) return;

  // ⚠️ 2026-08-09: SILKINISH (qaltirash) DAVOSI. Avval hide/show
  // margin'ni o'zgartirardi — margin butun joylashuvni suradi, surish
  // O'ZI yangi scroll hodisasini tug'dirardi, kod uni "yo'nalish
  // o'zgardi" deb panelni qaytarardi — o'z-o'zini qo'zg'atuvchi halqa.
  // Qaysi sahifada tebranishi kontent balandligiga bog'liq edi (shu
  // sabab katalogda sezilmay, hisobot/mijozlarda sezilardi). Endi:
  //   1) o'zimiz qo'zg'atgan hodisalar 250 ms e'tiborsiz (selfAdj);
  //   2) yig'ish uchun 24px, qaytarish uchun 12px YIG'ILGAN masofa
  //      kerak (bir martalik mayda tebranish yetmaydi);
  //   3) o'tish silliq (margin-top .18s) — keskin sakrash yo'q.
  // Xulq saqlanadi: pastga surilganda yig'iladi, yuqoriga — qaytadi.
  let lastY = 0, hidden = false, ticking = false, selfAdj = false, acc = 0;
  try { topbar.style.transition = "margin-top .18s ease"; } catch(e) {}

  const _apply = (m) => {
    selfAdj = true;
    topbar.style.marginTop = m;
    setTimeout(() => { selfAdj = false; lastY = pages.scrollTop; }, 250);
  };
  const show = () => { if (!hidden) return; _apply(""); hidden = false; };
  const hide = () => {
    if (hidden) return;
    const h = topbar.offsetHeight;
    if (!h) return;
    _apply("-" + h + "px"); hidden = true;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (selfAdj) { lastY = pages.scrollTop; return; }   // o'z sakrashimiz
      // Faqat telefon o'lchamida
      if (window.innerWidth > 768) { show(); lastY = pages.scrollTop; return; }
      // Yon menyu ochiq bo'lsa tegilmaydi
      const sb = document.getElementById("sb");
      if (sb && sb.classList.contains("mob-open")) { show(); return; }

      const y = pages.scrollTop;
      if (y < 40) { show(); lastY = y; acc = 0; return; } // tepada — doim ochiq
      const d = y - lastY;
      lastY = y;
      if (Math.abs(d) < 2) return;
      acc = (acc > 0) === (d > 0) ? acc + d : d;          // bir yo'nalishda yig'amiz
      if (acc > 24)      { hide(); acc = 0; }
      else if (acc < -12){ show(); acc = 0; }
    });
  };

  pages.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { if (window.innerWidth > 768) show(); });
}

if (document.readyState !== "loading") initTopbarAutoHide();
else document.addEventListener("DOMContentLoaded", initTopbarAutoHide);

// ═══ KO'RINISH REJIMINI ESLAB QOLISH (2026-08-06) ═══
// Jadval / katak tanlovi QURILMADA saqlanadi (localStorage).
// ⚠️ ATAYLAB `db.settings` ga YOZILMAYDI — u bulutga sinxronlanadi
//    va telefondagi tanlov kompyuterga ham o'tib ketardi. Har
//    qurilma o'z tanlovini yuritadi: telefonda katak, kompyuterda
//    jadval bo'lib qolaveradi.
// ⚠️ Ma'lumotga aloqasi yo'q — faqat ko'rinish. Sinxron, sotuv,
//    qarz, ombor — hech biriga tegmaydi.
function viewModeGet(key, def) {
  try {
    const v = localStorage.getItem("merx_view_" + key);
    return (v === "grid" || v === "table") ? v : (def || "table");
  } catch (e) { return def || "table"; }
}

function viewModeSet(key, v) {
  try { localStorage.setItem("merx_view_" + key, v); } catch (e) {}
}

// Sahifa ochilganda tugmalarni saqlangan holatga moslaydi.
// ⚠️ Render CHAQIRILMAYDI — har bo'lim o'zi ochilganda o'z rejim
//    o'zgaruvchisini o'qiydi, u esa yuqorida allaqachon tiklangan.
function viewModeInitBtns() {
  [ ["kat", "kat-view-btn", "class"],
    ["om",  "om-view-btn",  "style"],
    ["tx",  "tx-view-btn",  "style"],
    ["mj",  "mj-view-btn",  "style"],
    ["db",  "db-view-btn",  "style"] ].forEach(([key, cls, kind]) => {
    const v = viewModeGet(key, "table");
    document.querySelectorAll("." + cls).forEach(b => {
      const on = b.dataset.v === v;
      if (kind === "class") b.classList.toggle("on", on);
      else {
        b.style.background = on ? "var(--acc)" : "transparent";
        b.style.color      = on ? "#0D1B2A" : "";
      }
    });
  });
}

if (document.readyState !== "loading") viewModeInitBtns();
else document.addEventListener("DOMContentLoaded", viewModeInitBtns);

// ══════════════════════════════════════════════════════════════
// UMUMIY CHEGIRMANI TOVARLARGA YOYISH (2026-08-08)
// ══════════════════════════════════════════════════════════════
// MUAMMO (jonli holatda isbotlangan): savatga qo'yilgan UMUMIY
// chegirma (masalan 790 000) alohida maydonda saqlanadi, tovar
// narxlariga esa TEGMAYDI. Oqibatlari:
//   1) Chekda mijoz to'lagan narxni tovar bo'yicha ko'rmaydi —
//      faqat pastda bitta "Chegirma" qatori turadi.
//   2) ⚠️ QAYTARISHDA PUL OQADI: qaytarish tovar narxidan
//      hisoblanadi (tarix.js), ya'ni chegirmasiz asl narxdan.
//      CHK-20260807-3014-EG: mijoz 19 490 000 to'lagan, qaytarilgan
//      20 280 000 — aynan chegirma miqdori 790 000 ortiqcha.
//
// YECHIM: saqlangan ma'lumotga TEGMAYMIZ (eski cheklar o'zgarmaydi),
// balki kerak bo'lganda "haqiqiy narx" hisoblanadi. Bitta funksiya —
// uch joyda ishlatiladi: PDF chek, Telegram xabari, qaytarish hisobi.
//
// TAQSIMLASH ASOSI — FOYDA (pos.js:2476 dagi `item.cost` shu uchun
// saqlanadi): chegirma ko'proq foyda beradigan tovarga ko'proq
// tushadi, tannarxga yaqin tovar deyarli tegilmaydi. Tannarx
// noma'lum bo'lsa — qator qiymatiga (narx×miqdor) mutanosib.
// ⚠️ Yig'indi ANIQ mos kelishi shart: yaxlitlash qoldig'i eng katta
// qatorga qo'shiladi, aks holda tiyinlar yo'qoladi.
function spreadSaleDiscount(sale) {
  const items = (sale && sale.items) ? sale.items : [];
  const disc  = Number(sale && sale.discount || 0);
  const out   = items.map(it => ({
    ...it,
    effPrice: Number(it.price || 0),           // yoyilgandan keyingi narx
    origPrice: Number(it.basePrice || it.price || 0) // chizilgan asl narx
  }));
  if (!(disc > 0) || !out.length) return out;

  const lineVal = it => Number(it.price || 0) * Number(it.qty || 0);
  const subtotal = out.reduce((a, it) => a + lineVal(it), 0);
  if (!(subtotal > 0) || disc >= subtotal) return out;

  // Foyda asosi (tannarx bo'lsa), aks holda qiymat asosi
  const profit = it => {
    const c = Number(it.cost || 0);
    return c > 0 ? Math.max(0, (Number(it.price || 0) - c) * Number(it.qty || 0)) : 0;
  };
  const profitSum = out.reduce((a, it) => a + profit(it), 0);
  const basis = profitSum > 0 ? profit : lineVal;
  const basisSum = profitSum > 0 ? profitSum : subtotal;

  let berilgan = 0, maxIdx = 0, maxVal = -1;
  out.forEach((it, i) => {
    const ulush = Math.round(disc * (basis(it) / basisSum));
    it._disc = ulush;
    berilgan += ulush;
    if (lineVal(it) > maxVal) { maxVal = lineVal(it); maxIdx = i; }
  });
  // Yaxlitlash qoldig'i — eng katta qatorga
  out[maxIdx]._disc += (disc - berilgan);

  out.forEach(it => {
    const qty = Number(it.qty || 0) || 1;
    const yangi = Number(it.price || 0) - (it._disc / qty);
    it.effPrice = Math.max(0, Math.round(yangi));
    if (it._disc > 0) it.origPrice = Number(it.price || 0); // chizish uchun
    delete it._disc;
  });
  return out;
}

// Bitta tovarning yoyilgandan keyingi qator summasi (qaytarish uchun)
function effLineTotal(sale, itemIdx, qty) {
  const arr = spreadSaleDiscount(sale);
  const it = arr[itemIdx];
  if (!it) return 0;
  return Math.round(Number(it.effPrice || 0) * Number(qty || 0));
}

// ══════════════════════════════════════════════════════════════
// MAJBURIY SINXRON TUGMALARINI YOPISH (2026-08-08)
// ══════════════════════════════════════════════════════════════
// SABAB (jonli hodisa, isbotlangan): "Majburiy qayta yuborish"
// qurilmaning BUTUN lokal nusxasini bulutga bosadi. Agar o'sha
// qurilmada boshqa kassada qilingan ish hali tortilmagan bo'lsa —
// u YO'QOLADI. CHK-20260808-3301-EG dagi 10 mln lik qaytarish
// aynan shunday o'chdi: 14:45 da EG telefonda qilingan, 15:54 da
// boshqa qurilma 40 ta chekni majburiy yuborganda bosib ketilgan.
// (3177 dagi qaytarish omon qoldi — u bulutga tushib ulgurgandi.)
//
// YECHIM: ikkala majburiy tugma STANDART YOPIQ. SuperAdmin
// do'kon uchun kerak bo'lganda ochadi (SA → do'kon → "Sinxron
// tugmalari"), ish tugagach yopadi. Sinxron tashxisi va oddiy
// "Yangilash" ochiq qoladi — ular xavfsiz.
function applySyncToolsLock() {
  try {
    const on = (window._syncToolsOn === true) ||
               (localStorage.getItem("merx_sync_tools") === "1");
    document.querySelectorAll("[data-sync-tool]").forEach(el => {
      el.style.display = on ? "" : "none";
    });
    const note = document.getElementById("sync-tools-note");
    if (note) note.style.display = on ? "none" : "";
  } catch (e) {}
}
if (document.readyState !== "loading") applySyncToolsLock();
else document.addEventListener("DOMContentLoaded", applySyncToolsLock);

// ══════════════════════════════════════════════════════════════
// EKRAN QALTIRASHI — SAHIFANI QAYTA QURMASDAN YANGILASH (2026-08-08)
// ══════════════════════════════════════════════════════════════
// MUAMMO (video bilan isbotlangan): bulutdan har o'zgarish kelganda
// `nav(_page)` chaqirilardi — u sahifani BUTUNLAY qaytadan quradi
// (sarlavha, ruxsat bloklari, ro'yxat, surish holati). Faol do'konda
// uch kassa birdan sotayotganda signal ketma-ket keladi va ekran
// to'xtovsiz sakraydi. Qarzlar sahifasida qidiruv yozayotganda ayniqsa
// bilinadi: 5 soniyada har yarim soniyada butun ro'yxat qayta chizilgan.
// (POS uchun bu istisno allaqachon bor edi — qolgan sahifalar chetda
// qolgan ekan.)
//
// YECHIM: (1) faqat o'sha sahifaning ro'yxati qayta chiziladi;
// (2) foydalanuvchi maydonga YOZAYOTGAN bo'lsa — yangilash kuttiriladi
// va u to'xtagach bajariladi. Ma'lumot baribir yangi, faqat ekran
// tinch turadi.
const _PAGE_RENDER_FN = {
  dashboard: "renderDashboard", katalog: "renderKatalog", ombor: "renderOmbor",
  mijozlar: "renderMijozlar", qarzlar: "renderDebts", qarztarix: "renderQarzlarTarixi",
  tarix: "renderTarix", hisobot: "renderHisobot", xodimlar: "renderXodimlar",
  moliya: "renderMoliya", portal: "renderPortal", egasi: "renderEgasi"
};
let _pageRerenderTimer = null;
function renderPageOnly(p) {
  const nm = _PAGE_RENDER_FN[p];
  if (!nm) return;
  const fn = window[nm];
  if (typeof fn !== "function") return;
  const ae = document.activeElement;
  const yozyapti = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" ||
                          ae.isContentEditable);
  if (yozyapti) {
    // Yozib bo'lgach yangilaymiz — ekran yozuv paytida qimirlamaydi
    clearTimeout(_pageRerenderTimer);
    _pageRerenderTimer = setTimeout(() => renderPageOnly(p), 2000);
    return;
  }
  try { fn(); } catch (e) { console.warn("renderPageOnly:", e.message); }
}


// ═══ BOT XABARLARI NAVBATI (2026-08-09, C-9) ═══════════════
// Muammo: sotuv/to'lov xabari botga BIR marta yuborilardi — ayni
// o'sha soniyada internet uzilsa, omborchi guruhidagi buyurtma
// kartochkasi va mijoz cheki BUTUNLAY yo'qolardi (v32 §11.4).
// Endi muvaffaqiyatsiz yuborish navbatga tushadi (localStorage) va
// har 90 soniyada hamda internet qaytganda qayta uriniladi.
// Takror-himoya: bitta kalit (chek raqami) navbatda ikki marta
// turmaydi. Kamdan-kam holatda (xabar yetib borib, JAVOB yo'qolsa)
// TAKROR kartochka chiqishi mumkin — omborchi uchun takror
// yo'qolgandan YAXSHI, bu ongli tanlov.
const _BOTQ_KEY = "merx_botq";
function _botqLoad() {
  try { return JSON.parse(localStorage.getItem(_BOTQ_KEY) || "[]"); }
  catch (e) { return []; }
}
function _botqSave(q) {
  try { localStorage.setItem(_BOTQ_KEY, JSON.stringify(q.slice(-30))); }
  catch (e) {}
}
function _botqHeaders() {
  try { if (typeof _botHeaders === "function") return _botHeaders(); } catch (e) {}
  return { "Content-Type": "application/json" };
}
// ✅ 2026-08-18: KALITNI MAJBURAN YANGILASH (401 javobidan keyin).
// `ensureFreshToken` faqat MUDDAT yaqinlashganda yangilaydi; kalit
// soat bo'yicha "tirik" turib server tomonda kuchdan qolgan bo'lsa,
// u hech narsa qilmasdi. Bu yerda muhr "eskirgan" deb belgilanib,
// yangilash majburlanadi (sessiya qaysi qutida bo'lsa — o'shanda).
async function _botForceRefresh() {
  try {
    const K = "merx_sb_session";
    let store = null, raw = localStorage.getItem(K);
    if (raw) store = localStorage;
    else { raw = sessionStorage.getItem(K); if (raw) store = sessionStorage; }
    if (raw && store) {
      const s = JSON.parse(raw);
      s.expiresAt = 0;
      store.setItem(K, JSON.stringify(s));
    }
    if (typeof ensureFreshToken === "function") await ensureFreshToken();
  } catch (e) {}
}
// Asosiy yuboruvchi: muvaffaqiyatda javob (obyekt), aks holda null
// (xabar navbatga tushdi). key — takror-himoya kaliti (chek raqami).
// ═══════════════════════════════════════════════════════════════
// ✅ 2026-08-18 (3-teshik): QOLDIQNI SERVER O'ZGARTIRADI — DELTA bilan
// ═══════════════════════════════════════════════════════════════
// Chaqiruvchi LOKAL qoldiqni allaqachon o'zgartirgan bo'ladi; bu yerda
// serverga faqat FARQ yuboriladi (qulf ostida qo'llanadi), javobdagi
// yangi qoldiq esa haqiqat sifatida lokalga yoziladi. Shuning uchun
// ikki kassa bir vaqtda ombor amali qilsa ham raqamlar QO'SHILADI,
// biri ikkinchisini bosmaydi ("oxirgisi yutadi" tugaydi).
// Muvaffaqiyatda `_qtyLocal` bayrog'i tushadi — push endi server
// qoldig'iga tayanaveradi (cloud.js himoyasi).
// Server rejimi o'chiq / aloqa yo'q bo'lsa `false` qaytadi va lokal
// qiymat o'z holicha qoladi (bayroq bilan pushga chiqadi) — oflayn
// ish buzilmaydi.
// Server javobidagi qoldiqni lokalga yozish (yagona joy)
function _stockApply(products) {
  (products || []).forEach(sp => {
    const lp = (db.products || []).find(x => String(x.sku) === String(sp.sku));
    if (!lp || !Array.isArray(sp.variants)) return;
    sp.variants.forEach(sv => {
      const lv = (lp.variants || []).find(v =>
        String(v.color || "") === String(sv.color || "") &&
        String(v.size  || "") === String(sv.size  || ""));
      if (lv) lv.qty = Number(sv.qty) || 0;      // SERVER haqiqati
    });
    delete lp._qtyLocal;                          // server bilan tenglashdi
  });
  try { saveDB(); } catch (e) {}
  try { if (typeof renderKatalog === "function") renderKatalog(); } catch (e) {}
}

// ✅ 2026-08-18: KUTIB-YIG'ADIGAN VARIANT (tahrir maydonlari uchun).
// Qoldiq maydonlari `oninput` bilan ishlaydi — "150" yozilganda uch
// marta (1 → 15 → 150) chaqiriladi. Har chaqiruvda serverga so'rov
// yuborilsa: ortiqcha yuk, va oradagi so'rov yiqilsa hisob chalkashadi.
// Endi farqlar 0,9 soniya davomida YIG'ILADI va BITTA so'rovda ketadi
// (bir nechta rang/o'lcham ham bitta so'rovga jamlanadi).
let _stockQ  = new Map();
let _stockQT = null;
function _serverStockQueue(p, color, size, delta) {
  if (!p || !delta) return;
  try { p._qtyLocal = true; } catch (e) {}
  const k = `${p.sku}|${color || ""}|${size || ""}`;
  const cur = _stockQ.get(k) || { sku: p.sku, color: color || "", size: size || "", delta: 0 };
  cur.delta += Number(delta) || 0;
  _stockQ.set(k, cur);
  clearTimeout(_stockQT);
  _stockQT = setTimeout(_serverStockFlush, 900);
}
async function _serverStockFlush() {
  const list = [..._stockQ.values()].filter(x => x.delta);
  _stockQ = new Map();
  if (!list.length) return;
  try {
    if (typeof _serverRejimi !== "function" || !_serverRejimi()) return;
    if (typeof _serverPay !== "function") return;
    const r = await _serverPay({
      action: "stock",
      items: list.map(x => ({ sku: x.sku, color: x.color, size: x.size,
                              qty: -x.delta }))
    });
    if (r && r.ok && Array.isArray(r.products)) _stockApply(r.products);
    else console.warn("[stock] navbat qo'llanmadi:", r && r.error);
  } catch (e) { console.warn("[stock] navbat xatosi:", e.message); }
}

// ═══════════════════════════════════════════════════════════════
// ✅ 2026-08-19 (3-bosqich): MIJOZ/XODIM YOZUVINI SERVERGA YOZISH
// ═══════════════════════════════════════════════════════════════
// Yagona darvoza — `mijozlar.js` ham, `xodimlar.js` ham shu yerdan
// yuradi (§10.3 yagona manba). Server: do'konni O'ZI qo'yadi,
// takrorni to'sadi, tahrirda to'qnashuvni aniqlaydi.
// Qaytaradi: {ok:true,row} · {ok:false,code:"dup"|"conflict",row}
//            · null (aloqa yo'q — chaqiruvchi lokal yo'ldan ketadi)
// ══════════════════════════════════════════════════════════════════
// 🔴 543 (2026-08-22) — SERVER YOZMASA ENDI JIM O'TMAYDI
// ══════════════════════════════════════════════════════════════════
// JONLI DALIL (egasi, Shoetest): XODIM roli bilan kiritilgan DONA
// tovar boshqa qurilmaga UMUMAN yetib bormadi (rasm emas, tovarning
// O'ZI). Variativ yo'lda tovar kelardi, rasm kelmasdi.
//
// ILDIZ — bitta emas, NAQSH. Kodni sanab chiqqanda: `serverSaveRecord`
// O'N BIR joyda chaqiriladi va BIRORTASI ham "yozildimi?" deb
// tekshirmaydi — faqat `code === "dup"` (takror) holati qaraladi.
// Chaqiruv shakli hamma yerda bir xil:
//     let _r = await serverSaveRecord("products", p, null);
//     if (_r && _r.ok === false && _r.code === "dup") { ... }
//     db.products.push(p);          // ← QOLGAN HAMMA XATO JIM O'TADI
//
// Xodimda zanjir shunday tugaydi:
//   · `_serverPay` (qarzlar.js:1751): token yo'q bo'lsa serverga
//     UMUMAN bormaydi — `{ok:false, error:"Token yo'q — qayta kiring"}`;
//   · chaqiruvchi buni tekshirmaydi → yozuv faqat lokalga tushadi;
//   · `pushToCloud` esa `_staffNoToken` bilan to'silgan;
//   · natijada yozuv HECH QAYERGA chiqmaydi va kassir bilmaydi.
// Adminda token doim bor — shuning uchun adminda ko'rinmasdi.
//
// YECHIM SHU YERDA, chunki o'n bitta chaqiruv joyini o'zgartirish
// (va birortasini unutish) xavfli. Bu funksiya:
//   1) muvaffaqiyatsizlikni ANIQ aytadi (kassir biladi);
//   2) yozuvni SINXRON NAVBATIGA qo'yadi — token tiklangach o'zi ketadi
//      (`scheduleCloudSync`), ya'ni ma'lumot YO'QOLMAYDI;
//   3) `dup` va boshqa MANTIQIY javoblarni avvalgidek qaytaradi —
//      chaqiruvchilarning xulqi o'zgarmaydi.
let _srvXatoOgoh = 0;   // ogohlantirish toshqini bo'lmasin

async function serverSaveRecord(table, row, baseAt, force) {
  try {
    if (typeof _serverRejimi !== "function" || !_serverRejimi()) return null;
    if (typeof _serverPay   !== "function") return null;
    // `force` — takror ogohlantirishidan keyin "baribir yozaman" javobi
    const r = await _serverPay({ action: "save_record", table, row,
                                 baseAt: baseAt || null,
                                 force: force === true });
    if (!r) { _srvYozilmadi(table, "javob yo'q"); return null; }
    // `dup`/`conflict` — MANTIQIY javob, xato emas: chaqiruvchi hal qiladi
    if (r.ok === false && r.code !== "dup" && r.code !== "conflict") {
      _srvYozilmadi(table, r.error || r.code || "noma'lum");
    }
    return r;
  } catch (e) {
    _srvYozilmadi(table, e.message);
    return null;
  }
}

// 543: serverga yozilmagan yozuvni navbatga qo'yadi va bir marta aytadi
function _srvYozilmadi(table, sabab) {
  try {
    console.warn("[yozuv] " + table + " serverga yozilmadi: " + sabab +
                 " — sinxron navbatiga qo'yildi");
    // Navbat: token tiklangach yoki internet qaytgach o'zi ketadi
    if (typeof scheduleCloudSync === "function") scheduleCloudSync();
    // Xodim tokeni yo'q bo'lsa — darhol tiklashga urinamiz
    if (typeof window !== "undefined" &&
        typeof window._staffTokenRetry === "function") window._staffTokenRetry();
    // Kassirga: 60 soniyada ko'pi bilan bir marta
    const now = Date.now();
    if (now - _srvXatoOgoh > 60000) {
      _srvXatoOgoh = now;
      if (typeof toast === "function") {
        toast("⚠️ Yozuv serverga chiqmadi — qurilmada saqlandi. " +
              "Davom etsa: chiqib qayta kiring", "err");
      }
    }
  } catch (e) {}
}

// ✅ 2026-08-19: TO'PLAMLI tovar yozuvi (import uchun). Bitta so'rovda
// 500 tagacha. Qaytaradi: {ok:true,soni} yoki null (oflayn — eski yo'l).
async function serverSaveBulkProducts(rows) {
  try {
    if (!Array.isArray(rows) || !rows.length) return null;
    if (typeof _serverRejimi !== "function" || !_serverRejimi()) return null;
    if (typeof _serverPay   !== "function") return null;
    let jami = 0;
    // 🔴 531 (2026-08-22): SERVER QAYTARGAN QATORLAR SAQLANADI.
    // Server har yozilgan qatorni `rows` ichida qaytaradi (`api/pul.js`
    // `save_bulk_products`: `{ok, soni, rows: j}`) va ular ichida
    // SERVER QO'YGAN `data.updatedAt` bor. Ilgari bu yerda faqat `soni`
    // olinib, qatorlar TASHLAB YUBORILARDI — chaqiruvchi server muhrini
    // bila olmasdi va lokal nusxada QURILMA vaqti qolib ketardi.
    // Oqibati (jonli, 2026-08-22): variativ jadvalda rang saqlangandan
    // keyin asosiy oynada "Saqlash" bosilsa — YAKKA qurilmada ham
    // "Bu tovarni boshqa kassa yangiladi" chiqardi.
    const _qatorlar = [];
    // 200 tadan bo'lib yuboramiz — so'rov hajmi cheklangan
    for (let i = 0; i < rows.length; i += 200) {
      const _b = rows.slice(i, i + 200);
      const r = await _serverPay({ action: "save_bulk_products", rows: _b });
      if (!r || !r.ok) return null;
      jami += r.soni || 0;
      if (Array.isArray(r.rows)) r.rows.forEach(x => _qatorlar.push(x));
    }
    return { ok: true, soni: jami, rows: _qatorlar };
  } catch (e) {
    console.warn("[import] serverga yozilmadi:", e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// ✅ 2026-08-19: QARZ KO'RSATKICHLARI — YAGONA MANBA (o'zak)
// ═══════════════════════════════════════════════════════════════
// Qarzlar bo'limi ham, Dashboard ham SHU funksiyadan oladi.
// Sabab: avval har biri LOKAL `db.sales` dan alohida hisoblardi —
// natijada bir ekranda 6,29 mlrd, ikkinchisida 9,65 mlrd chiqardi
// (18-avg dashboard hodisasi), lokal ro'yxat chala tortilganda esa
// ikkalasi ham yolg'on raqam ko'rsatardi (19-avg videolari).
// Endi hisob SERVERDA, natija 20 soniya keshlanadi va IKKALA bo'lim
// bir xil raqamni ko'radi (§10.3 — yagona manba qoidasi).
// Aloqa yo'q bo'lsa `null` qaytadi — chaqiruvchi lokal zaxirani
// ko'rsatib turaveradi (oflayn ish buzilmaydi).
let _dstKesh = { t: 0, r: null };
let _dstBusy = null;
async function serverDebtStats(force) {
  try {
    if (typeof _serverRejimi !== "function" || !_serverRejimi()) return null;
    if (typeof _serverPay   !== "function") return null;
    if (!force && _dstKesh.r && (Date.now() - _dstKesh.t) < 20000) return _dstKesh.r;
    if (_dstBusy) return await _dstBusy;          // bir vaqtda ikki so'rov bo'lmasin
    _dstBusy = (async () => {
      try {
        const r = await _serverPay({ action: "debt_stats" });
        if (r && r.ok) { _dstKesh = { t: Date.now(), r }; return r; }
        return null;
      } finally { _dstBusy = null; }
    })();
    return await _dstBusy;
  } catch (e) {
    console.warn("[qarz] server ko'rsatkichlari:", e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// ✅ 2026-08-18 (2-sessiya): OFLAYN SOTUV QOLDIG'INI TASDIQLASH NAVBATI
// ═══════════════════════════════════════════════════════════════
// Internet yo'qda sotuv lokal saqlanadi (chek raqami xavfsiz — unda
// qurilma kodi bor), lekin QOLDIQ server tomonda tekshirilmay qolardi.
// Endi: sotilgan miqdorlar navbatga yoziladi; aloqa qaytgach server
// qulf ostida ayiradi (`stock` + opKey — takror MUMKIN EMAS).
// Yetmasa (boshqa kassa sotib bo'lgan) — chek o'z kuchida qoladi,
// sotuvga QIZIL belgi qo'yiladi va ekranda "inventarizatsiya kerak"
// lentasi chiqadi. Qaror odamda: sanab, to'g'rilanadi.
// O'chirish sozlamasi: db.settings.offStockConfirm = false.
function _offsqLoad() {
  try { return JSON.parse(localStorage.getItem("merx_offstock_q") || "[]"); }
  catch (e) { return []; }
}
function _offsqSave(q) {
  try { localStorage.setItem("merx_offstock_q", JSON.stringify(q || [])); } catch (e) {}
}
function offStockQueueAdd(entry) {
  try {
    const q = _offsqLoad();
    if (q.some(x => String(x.saleId) === String(entry.saleId))) return;  // takror emas
    q.push({ ...entry, ts: Date.now() });
    _offsqSave(q);
    console.log("📮 Oflayn qoldiq navbatga:", entry.chekNum, entry.items.length + " qator");
  } catch (e) {}
}
let _offsqBusy = false;
async function _offStockFlush() {
  if (_offsqBusy) return;
  if (db && db.settings && db.settings.offStockConfirm === false) return;
  const q = _offsqLoad();
  if (!q.length) return;
  if (typeof _serverRejimi !== "function" || !_serverRejimi()) return;
  if (typeof _serverPay !== "function") return;
  _offsqBusy = true;
  try {
    let ozgardi = false;
    for (const e of q.slice()) {
      let r = null;
      try {
        r = await _serverPay({ action: "stock", items: e.items,
                               opKey: "stockq:" + e.saleId });
      } catch (err) { break; }                       // aloqa yo'q — keyin
      if (!r) break;
      const sale = (db.sales || []).find(s => String(s.id) === String(e.saleId));
      if (r.ok) {
        if (Array.isArray(r.products) && typeof _stockApply === "function")
          _stockApply(r.products);                   // server haqiqati + bayroqlar tushadi
        if (sale) { sale.stockPending = false; sale.stockConfirmed = true; }
        _offsqSave(_offsqLoad().filter(x => String(x.saleId) !== String(e.saleId)));
        ozgardi = true;
        console.log("✅ Oflayn qoldiq tasdiqlandi:", e.chekNum, r.dup ? "(takror edi)" : "");
      } else if (r.code === "stock") {
        // Boshqa kassa sotib bo'lgan — chek kuchda, lekin sanash kerak.
        // Lokal ayirma SAQLANADI (mol jismonan ketgan), bayroq turadi —
        // push lokal haqiqatni olib chiqadi; inventarizatsiya hal qiladi.
        if (sale) {
          sale.stockPending = false;
          sale.stockMismatch = true;
          sale.stockMismatchItems = r.items || [];
        }
        _offsqSave(_offsqLoad().filter(x => String(x.saleId) !== String(e.saleId)));
        ozgardi = true;
        try { toast("⚠️ " + (e.chekNum || "") +
          ": qoldiq nomuvofiq — inventarizatsiya kerak", "err"); } catch (err) {}
        console.warn("⚠️ Oflayn qoldiq nomuvofiq:", e.chekNum, r.items);
      } else {
        break;                                       // boshqa xato — keyin urinamiz
      }
    }
    if (ozgardi) { try { saveDB(); } catch (e2) {} _offStockBanner(); }
  } finally { _offsqBusy = false; }
}
// Qizil lenta: tasdiqlanmagan nomuvofiqliklar bor ekan — ko'rinib turadi
function _offStockBanner() {
  try {
    const bad = (db.sales || []).filter(s => s.stockMismatch && !s.stockMismatchAck);
    let el = document.getElementById("merx-offstock-warn");
    if (!bad.length) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div");
      el.id = "merx-offstock-warn";
      el.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9999;" +
        "background:#E05A5A;color:#fff;padding:9px 12px;font-size:13px;" +
        "font-weight:700;display:flex;gap:10px;align-items:center;" +
        "justify-content:center;box-shadow:0 -2px 10px rgba(0,0,0,.25)";
      document.body.appendChild(el);
    }
    const ro = bad.map(s => "• " + (s.chekNum || s.id) + " — " +
      (s.stockMismatchItems || []).map(i =>
        [i.sku, i.color, i.size].filter(Boolean).join("/")).join(", ")).join("\n");
    el.innerHTML = "";
    const txt = document.createElement("span");
    txt.textContent = "⚠️ " + bad.length +
      " ta oflayn sotuvda qoldiq nomuvofiq — inventarizatsiya kerak";
    const b1 = document.createElement("button");
    b1.textContent = "Batafsil";
    b1.style.cssText = "background:#fff;color:#E05A5A;border:0;border-radius:6px;" +
      "padding:4px 10px;font-weight:800;cursor:pointer";
    b1.onclick = () => alert("Qoldiq nomuvofiq cheklar:\n\n" + ro +
      "\n\nShu tovarlarni sanab, Ombor > Inventarizatsiya orqali to'g'rilang.");
    const b2 = document.createElement("button");
    b2.textContent = "✕ Ko'rdim";
    b2.style.cssText = "background:transparent;color:#fff;border:1.5px solid #fff;" +
      "border-radius:6px;padding:4px 10px;font-weight:700;cursor:pointer";
    b2.onclick = () => {
      if (!confirm("Belgini olib tashlaysizmi? (inventarizatsiya qilingan bo'lsin)")) return;
      bad.forEach(s => { s.stockMismatchAck = true; });
      try { saveDB(); } catch (e) {}
      _offStockBanner();
    };
    el.appendChild(txt); el.appendChild(b1); el.appendChild(b2);
  } catch (e) {}
}
try {
  setTimeout(() => { try { _offStockFlush(); _offStockBanner(); } catch (e) {} }, 8000);
  setInterval(() => { try { _offStockFlush(); } catch (e) {} }, 90000);
  setInterval(() => { try { _offStockBanner(); } catch (e) {} }, 30000);
  window.addEventListener("online", () => {
    try { setTimeout(_offStockFlush, 2500); } catch (e) {}
  });
} catch (e) {}

async function _serverStock(p, color, size, delta) {
  if (!p || !delta) return false;
  // ✅ 2026-08-18: BAYROQ SHU YERDA QO'YILADI — har bir chaqiruvchi
  // avtomat himoyalanadi. Bayroq push'ga aytadi: bu tovarning qoldig'i
  // LOKALDA ataylab o'zgargan, uni server nusxasi bilan ALMASHTIRMA.
  // Server javobi kelgach (pastda) bayroq tushadi — o'shanda lokal
  // qiymat allaqachon server haqiqatiga teng bo'ladi.
  try { p._qtyLocal = true; } catch (e) {}
  try {
    if (typeof _serverRejimi !== "function" || !_serverRejimi()) return false;
    if (typeof _serverPay !== "function") return false;
    const r = await _serverPay({
      action: "stock",
      items: [{ sku: p.sku, color: color || "", size: size || "",
                qty: -delta }]   // manfiy = qo'shiladi, musbat = ayiriladi
    });
    if (!r || !r.ok || !Array.isArray(r.products)) return false;
    _stockApply(r.products);
    return true;
  } catch (e) {
    console.warn("[stock] serverda qoldiq o'zgarmadi:", e.message);
    return false;
  }
}

async function botSend(url, bodyObj, key) {
  const body = JSON.stringify(bodyObj);
  // \U0001f534 2026-08-14: YUBORISHDAN OLDIN KALIT YANGILANADI.
  // STRICT yoqilgandan keyin bot tokensiz so'rovni RAD ETADI. Xodim
  // seansida token eskirsa chek JIMGINA yuborilmasdi va 📮 navbatga
  // tushardi — kassir bilmasdi ("ba'zi mijozlarga chek kelmayapti",
  // ABU SAXIY 14-avgust). Endi kalit yangilanadi, so'ng yuboriladi.
  try { if (typeof ensureFreshToken === "function") await ensureFreshToken(); } catch (e) {}
  // ✅ 2026-08-18: 401 BO'LSA — KALIT MAJBURAN YANGILANIB, BIR MARTA
  // QAYTA URINILADI. Jonli isbot (B20, 18-avg 11:31): `send_staff_notif`
  // va `send_receipt` 401 bilan rad etilgan — kalit soat bo'yicha hali
  // "tirik" edi, lekin server uni kuchdan qoldirgan (odatiy sabab:
  // bitta xodim ikkinchi qurilmada kirgan). Yuqoridagi yangilash esa
  // faqat muddat yaqinlashganda ishlaydi — shu bo'shliq yopildi.
  for (let urinish = 0; urinish < 2; urinish++) {
    try {
      const r = await fetch(url, { method: "POST", headers: _botqHeaders(), body });
      if (r.ok) return await r.json().catch(() => ({ ok: true }));
      // Rad etilgan bo'lsa — sababi ko'rinsin (jim yutilmasin)
      try {
        const _t = await r.text();
        console.warn("\u26d4 Bot rad etdi (" + r.status + "):", String(_t).slice(0, 160));
      } catch (e) {}
      if (r.status === 401 && urinish === 0) { await _botForceRefresh(); continue; }
    } catch (e) {}
    break;
  }
  const q = _botqLoad();
  if (!(key && q.some(x => x.key === key)) && body.length < 60000) {
    q.push({ url, body, key: key || ("k" + Date.now()), ts: Date.now(), tries: 0 });
    _botqSave(q);
    console.warn("📮 Bot xabari navbatga qo'yildi:", key || "(kalitsiz)");
  }
  return null;
}
async function _botqFlush() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const q = _botqLoad();
  if (!q.length) return;
  const it = q[0];
  if (Date.now() - it.ts > 24 * 3600 * 1000 || it.tries > 60) {
    console.warn("📮 Bot navbati: eskirdi, tashlab yuborildi:", it.key);
    _botqSave(q.slice(1));
    return;
  }
  try {
    const r = await fetch(it.url, { method: "POST", headers: _botqHeaders(), body: it.body });
    if (r.ok) {
      console.log("📮 Bot navbati: yuborildi ✅", it.key);
      _botqSave(q.slice(1));
      return;
    }
    // ✅ 2026-08-18: navbat 401 ga tiqilib qolmasin — kalit yangilanadi,
    // keyingi aylanishda (90 s) o'zi ketadi.
    if (r.status === 401) { try { await _botForceRefresh(); } catch (e) {} }
  } catch (e) {}
  it.tries++;
  _botqSave(q);
}
setInterval(_botqFlush, 90000);
window.addEventListener("online", () => setTimeout(_botqFlush, 1500));


// ═══ AUDIT LOG (2026-08-12, 1-bosqich) ═══════════════
// "Kim, qachon, qaysi qurilmada nima qildi" — tizimdagi eng katta
// bo'shliq edi (jonli misol: Atelier Q.27 qora qatorini kim o'chirgani
// faqat egadan so'rab bilindi). 1-bosqich FAQAT o'chirish va bekor
// amallarini yozadi — eng kam uchraydigan, eng qimmatli izlar.
//
// ⚠️ QAT'IY QOIDA: audit HECH QACHON asosiy amalni to'xtatmaydi.
// Butun tana try/catch ichida — xato bo'lsa jim o'tib ketadi.
// Sotuv/o'chirish/atkaz audit tufayli yiqilmaydi.
function auditLog(action, entity, entityId, label, extra) {
  try {
    if (!db.auditLog) db.auditLog = [];
    const u = (typeof _authUser !== "undefined" && _authUser) ? _authUser : null;
    db.auditLog.push({
      id:        String(Date.now()) + "-" + Math.random().toString(36).slice(2, 6),
      ts:        new Date().toISOString(),
      date:      (typeof today === "function") ? today() : "",
      time:      (typeof nowTime === "function") ? nowTime() : "",
      actor:     u ? (u.name || u.role || "?") : "Egasi",
      actorId:   u ? String(u.id || "") : "",
      device:    (typeof _devCode === "function") ? _devCode() : "",
      action, entity,
      entityId:  entityId != null ? String(entityId) : "",
      label:     label || "",
      before:    extra && extra.before != null ? String(extra.before) : "",
      after:     extra && extra.after  != null ? String(extra.after)  : "",
      note:      extra && extra.note   ? String(extra.note) : ""
    });
    // 90 kundan eski yozuvlar qurilmada saqlanmaydi (hajm nazorati;
    // bulutdagi nusxa qoladi)
    if (db.auditLog.length > 3000) db.auditLog = db.auditLog.slice(-2000);
  } catch (e) { /* audit hech qachon to'xtatmaydi */ }
}


// ═══ AUDIT SAHIFASI (2026-08-12, 2-bosqich) ════════════
// Egasi/admin uchun: kim, qachon, qaysi qurilmada, nimani o'zgartirdi.
// FAQAT O'QIYDI. Manba — db.auditLog (bulut bilan sinxron).
function renderAudit() {
  const body = document.getElementById("au-body");
  if (!body) return;
  if (typeof hasRole === "function" && !hasRole("admin")) {
    body.innerHTML = `<div style="color:var(--mut);font-size:13px">
      Bu sahifa faqat egasi va admin uchun.</div>`;
    const st = document.getElementById("au-stat"); if (st) st.textContent = "";
    return;
  }
  const all = (db.auditLog || []).slice().sort((a,b) =>
    String(b.ts || "").localeCompare(String(a.ts || "")));

  // Xodim ro'yxatini bir marta to'ldiramiz
  const selA = document.getElementById("au-actor");
  if (selA && selA.options.length <= 1) {
    [...new Set(all.map(x => x.actor).filter(Boolean))].sort().forEach(n => {
      const o = document.createElement("option"); o.value = n; o.textContent = n;
      selA.appendChild(o);
    });
  }

  const fAct   = (document.getElementById("au-act")   || {}).value || "";
  const fActor = (document.getElementById("au-actor") || {}).value || "";
  const q      = ((document.getElementById("au-q")    || {}).value || "").toLowerCase().trim();

  const list = all.filter(x =>
    (!fAct   || x.action === fAct) &&
    (!fActor || x.actor  === fActor) &&
    (!q || (String(x.label||"") + " " + String(x.entityId||"") + " " +
            String(x.actor||"") + " " + String(x.note||"")).toLowerCase().includes(q)));

  const NOM = { delete:"Tovar o'chirildi", restore:"Arxivdan tiklandi",
    cancel:"Sotuv bekor qilindi", atkaz:"To'lov atkaz qilindi",
    // ⚖️ 528: PUL AMALLARI (§9.1). Ilgari audit faqat BEKOR QILISHNI
    // yozardi — ya'ni pul kirgani emas, chiqqani. Endi uchalasi ham bor.
    sotuv:"Sotuv qilindi", tolov:"Qarz to'lovi", qaytarish:"Tovar qaytarildi",
    narx:"Narx o'zgardi", kurs:"Kurs o'zgardi",
    inventar:"Qoldiq sanaldi", qoldiq:"Qoldiq harakati",
    // ✅ 2026-08-19: TOVAR YARATILISHI. Ildiz — 19-avgust forenzikasida
    // "bu kartani kim yaratdi?" savoliga javob yo'q edi: audit faqat
    // tahrir va o'chirishni yozardi. Endi oltala yaratish yo'li ham
    // yoziladi (qo'lda, rang, nusxa, import, to'plam, ajratish).
    yaratish:"Tovar yaratildi" };
  const RANG = { delete:"#A32D2D", restore:"#0F6E56", cancel:"#A32D2D",
    sotuv:"#0F6E56", tolov:"#0F6E56", qaytarish:"#B45309",   // 528
    atkaz:"#8A6D1F", narx:"#185FA5", kurs:"#6B4FBB",
    inventar:"#5F5E5A", qoldiq:"#0F6E56", yaratish:"#0F6E56" };

  const st = document.getElementById("au-stat");
  if (st) st.textContent = list.length + " ta yozuv" +
    (all.length !== list.length ? " (jami " + all.length + ")" : "");

  body.innerHTML = list.length ? list.slice(0, 300).map(x =>
    `<div style="display:flex;gap:10px;align-items:flex-start;
                 border-left:3px solid ${RANG[x.action] || "#ccc"};
                 background:var(--bg2,#FAFAF8);padding:8px 10px;
                 border-radius:0 8px 8px 0;margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">
          ${NOM[x.action] || x.action} — ${x.label || x.entityId || ""}
        </div>
        <div style="font-size:11.5px;color:var(--mut);margin-top:2px">
          ${x.date || ""} ${x.time || ""} · <b>${x.actor || "?"}</b>${
            x.device ? " (" + x.device + ")" : ""}${
            x.entityId ? " · " + x.entityId : ""}
        </div>
        ${(x.before || x.after) && String(x.before||"").length < 60
          ? `<div style="font-size:11.5px;margin-top:3px">
               ${x.before ? "<s>" + x.before + "</s> → " : ""}<b>${x.after || ""}</b></div>`
          : ""}
        ${x.note && x.note.length < 120
          ? `<div style="font-size:11px;color:var(--mut);margin-top:2px">${x.note}</div>` : ""}
      </div>
    </div>`).join("") + (list.length > 300
      ? `<div style="font-size:11.5px;color:var(--mut);margin-top:6px">
           Eng yangi 300 tasi ko'rsatildi.</div>` : "")
    : `<div style="color:var(--mut);font-size:13px">Yozuv topilmadi.</div>`;
}

// 90 kundan eski yozuvlar QURILMADAN tozalanadi (bulutdagi nusxa qoladi)
function _auditPrune() {
  try {
    if (!Array.isArray(db.auditLog) || !db.auditLog.length) return;
    const chek = new Date(Date.now() - 90 * 86400000).toISOString();
    const oldN = db.auditLog.length;
    db.auditLog = db.auditLog.filter(x => String(x.ts || "") >= chek);
    if (db.auditLog.length !== oldN) saveDB();
  } catch (e) {}
}
setTimeout(_auditPrune, 20000);


// \u2550\u2550\u2550 QARZ TO'LOVI CHEKI \u2014 USLUBLI (2026-08-12) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// Egasining talabi: "har bo'lim o'z tanloviga ega bo'lsin". Sotuv
// cheki uslublari to'lov chitigiga to'g'ridan-to'g'ri yaramaydi
// (ular tovar jadvali uchun), shuning uchun to'lov uchun ALOHIDA
// chizuvchi \u2014 lekin BIR XIL uslub tilida (fon, qog'oz eni, zichlik).
//
// \u26a0\ufe0f QAT'IY: debtBefore/debtAfter MUHRLANGAN qiymatlar (\u00a73.5) \u2014
// faqat O'QILADI, hech qachon qayta hisoblanmaydi.
//
// Egasi so'ragan qator: to'lov so'mda bo'lsa-yu qarz dollarda bo'lsa,
// hisob OCHIQ ko'rsatiladi: "10 000 000 / 12 100 = $826.45".
function buildPayReceiptStyled(payment, opts) {
  const o = opts || {};
  const style = o.style || "unified";
  const cfg   = o.cfg || {};
  const W     = parseInt(cfg.paperWidth) || 72;
  const dark  = (cfg.headerStyle || "dark") === "dark";
  const F     = n => Math.round(Number(n) || 0).toLocaleString("ru-RU");
  const D     = n => "$" + (Number(n) || 0).toFixed(2);

  const cur   = payment.currency === "usd" ? "usd" : "uzs";
  const rate  = Number(payment.rate) || kursOl();   // ✅ 566b
  const somAmt = Number(payment.amountSom) ||
                 (cur === "usd" ? Math.round(Number(payment.amount || 0) * rate) : Number(payment.amount || 0));

  // To'landi qatori + OCHIQ HISOB (egasining talabi)
  const paidMain = cur === "usd" ? D(payment.amount) : F(payment.amount) + " so'm";
  const hisobLine = (cur === "usd" && somAmt)
    ? F(somAmt) + " / " + F(rate) + " = " + D(payment.amount)
    : "";

  // Muhrlangan qarz holati \u2014 FAQAT O'QIYMIZ
  const dB = payment.debtBefore, dA = payment.debtAfter;
  const M  = v => (v == null) ? "" : (cur === "usd" ? D(v) : F(v) + " so'm");

  // \U0001f534 2026-08-15 (egasining talabi): IKKALA VALYUTA ALOHIDA,
  // KONVERTATSIYASIZ. Mijozda so'm VA dollar qarzi bir vaqtda bo'lishi
  // mumkin \u2014 to'lov bittasini kamaytiradi, ikkinchisi O'Z holicha
  // qoladi. Masalan: "3800$ + 20 000 000 so'm".
  // Nol bo'lgan valyuta KO'RSATILMAYDI.
  // (\u00a73.1: qarz belgilangan valyutada qotadi \u2014 shuning uchun
  //  umumiy qarzni so'mga aylantirib ko'rsatish NOTO'G'RI edi.)
  const _ikki = (uzs, usd) => {
    const p = [];
    if (Number(usd) > 0) p.push(D(usd));
    if (Number(uzs) > 0) p.push(F(uzs) + " so'm");
    return p.length ? p.join(" + ") : "0";
  };
  const _bIkki = (payment.debtBeforeUzs != null || payment.debtBeforeUsd != null)
    ? _ikki(payment.debtBeforeUzs, payment.debtBeforeUsd) : null;
  const _aIkki = (payment.debtAfterUzs != null || payment.debtAfterUsd != null)
    ? _ikki(payment.debtAfterUzs, payment.debtAfterUsd) : null;
  // Muhr bo'lsa ikkala valyuta, bo'lmasa (eski cheklar) avvalgidek
  const MB = _bIkki != null ? _bIkki : M(dB);
  const MA = _aIkki != null ? _aIkki : M(dA);

  // To'lov usuli
  const payLabels = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash" };
  const mb = payment.methodBreakdown || null;
  const mbRows = mb ? Object.keys(mb).filter(k => (mb[k] || 0) > 0) : [];
  const usulHtml = mbRows.length > 1
    ? mbRows.map(k => `<div class="r"><span>${payLabels[k] || k}</span><b>${F(mb[k])} so'm</b></div>`).join("")
    : `<div class="r"><span>Usul</span><b>${payLabels[payment.method] || payment.method || "\u2014"}</b></div>`;

  const ixcham = (style === "compact" || style === "thermal");
  const oq     = (style === "wholesale") || !dark;
  const hdrCss = oq ? "background:#fff;color:#000;border-bottom:2px solid #000"
                    : "background:#0D1B2A;color:#fff";
  const bodyFs = ixcham ? "11px" : "12px";

  // Jadval uslubi: ikki valyuta ustunda
  const jadval = (style === "table");

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>To'lov cheki ${payment.chekNum || ""}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',Arial,sans-serif;background:#fff;color:#000;
     padding:6px;font-size:${bodyFs};line-height:1.4}
.doc{width:${W}mm;max-width:${W}mm;margin:0 auto;background:#fff}
.hd{${hdrCss};padding:${ixcham ? "8px 10px" : "11px 14px"};text-align:center}
.shop{font-size:${ixcham ? "13px" : "15px"};font-weight:800}
.sm{font-size:10px;opacity:.85}
.meta{font-size:10.5px;padding:5px 0;border-bottom:1px dashed #000}
.meta div{display:flex;justify-content:space-between;gap:6px}
.sec{padding:6px 0;border-bottom:1px dashed #000}
.lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;
     letter-spacing:.04em;opacity:.7;margin-bottom:3px}
.r{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0}
.big{font-size:${ixcham ? "15px" : "18px"};font-weight:800;text-align:right}
.calc{font-size:10px;text-align:right;opacity:.75;margin-top:1px}
.qold{font-size:${ixcham ? "13px" : "15px"};font-weight:800}
table{width:100%;border-collapse:collapse;font-size:10.5px}
th{border-top:1px solid #000;border-bottom:1px solid #000;padding:3px 2px;
   font-size:9.5px;font-weight:700}
td{padding:3px 2px;border-bottom:1px dotted #999}
.r2{text-align:right}
.ft{text-align:center;font-size:10px;margin-top:6px;padding-top:5px;
    border-top:1px dashed #000}
@media print{ @page{margin:0} body{padding:0} .doc{width:${W}mm} }
  /* ✅ 2026-08-15: oq fon, qora yozuv — xiralashtirilmagan (egasining talabi) */
  .doc,.doc *{color:#000}
  .doc{background:#fff}
  .sm,.lbl,.calc{opacity:1}
  ${typeof chekPrintFix === "function" ? chekPrintFix(cfg && cfg.paperWidth) : ""}
  ${typeof chekStyleCss === "function" ? chekStyleCss(cfg, {
      shop:".shop", tagline:".sm.tagline", meta:".meta",
      itemPrice:".calc", total:".big", debt:".qold,.r2", footer:".ft"
    }) : ""}

  /* \U0001f534 2026-08-15: USLUBLAR CHINDAN FARQ QILSIN.
     Tekshiruv ko'rsatdi: Termal va Ixcham Yagona bilan AYNAN bir xil
     chiqardi \u2014 nomi bor, ichi yo'q edi (egasining kuzatuvi).
     Endi:
       \u2022 TERMAL  \u2014 monoshrift, tor, ramkasiz (tor qog'oz uchun)
       \u2022 IXCHAM  \u2014 faqat asosiy: summa, hisob, edi \u2192 qoldi
                    (sarlavha tafsilotlari va meta qisqaradi) */
  ${o.style === "thermal" ? `
    .doc{font-family:'JetBrains Mono','Consolas','Courier New',monospace;
         font-size:11.5px;line-height:1.55;letter-spacing:0}
    .hd{border-bottom:1px dashed #000;padding-bottom:6px}
    .shop{font-size:13px;letter-spacing:.06em}
    .sec{border:none;border-top:1px dashed #000;border-radius:0;padding:6px 0}
    .big{font-size:15px}
    .doc *{border-radius:0 !important}
  ` : ""}
  ${o.style === "compact" ? `
    .hd .sm:not(.addr){display:none}
    .hd .addr{display:none}
    .meta div:nth-child(n+3){display:none}
    .sec{padding:6px 8px}
    .lbl{font-size:10px}
    .big{font-size:19px}
    .doc{font-size:12px}
  ` : ""}
  </style>
  </head><body>
<div class="doc">
  ${_tasdiqBelgisi(payment, "qarz")}
  ${cfg.logo ? `<div style="text-align:center;padding:6px 0 2px"><img src="${cfg.logo}" style="max-height:44px;max-width:70%;object-fit:contain"></div>` : ""}
  <div class="hd">
    <div class="shop">${cfg.shopName || o.shopName || "MERX"}</div>
    ${cfg.tagline ? `<div class="sm tagline">${cfg.tagline}</div>` : ""}
    ${cfg.addr    ? `<div class="sm addr">${cfg.addr}</div>` : ""}
    ${cfg.showContact && cfg.contact ? `<div class="sm">${cfg.contact}</div>` : ""}
    <div class="sm">TO'LOV CHEKI</div>
  </div>
  <div class="meta">
    <div><span>Chek</span><b>${payment.chekNum || ""}</b></div>
    <div><span>Sana</span><span>${payment.date || ""} ${payment.time || ""}</span></div>
    ${payment.customerName ? `<div><span>Mijoz</span><b>${payment.customerName}</b></div>` : ""}
    ${payment.customerPhone ? `<div><span>Mijoz raqami</span><span>${payment.customerPhone}</span></div>` : ""}
    ${cfg.showStaff && o.staffName ? `<div><span>Qabul qildi</span><span>${o.staffName}</span></div>` : ""}
  </div>

  <div class="sec">
    <div class="lbl">To'landi</div>
    <div class="big">${paidMain}</div>
    ${hisobLine ? `<div class="calc">${hisobLine}</div>` : ""}
    ${cur === "usd" ? `<div class="calc">Kurs: ${F(rate)} so'm</div>` : ""}
  </div>

  <div class="sec">
    <div class="lbl">To'lov usuli</div>
    ${usulHtml}
  </div>

  <div class="sec">
    <div class="lbl">Qarz holati</div>
    ${jadval
      ? `<table>
           <tr><th>&nbsp;</th><th class="r2">So'm</th><th class="r2">USD</th></tr>
           ${dB != null ? `<tr><td>Edi</td><td class="r2">${
             cur === "usd" ? F(dB * rate) : F(dB)}</td><td class="r2">${
             cur === "usd" ? D(dB) : D(dB / (rate || 1))}</td></tr>` : ""}
           <tr><td>To'landi</td><td class="r2">${F(somAmt)}</td><td class="r2">${
             D(cur === "usd" ? payment.amount : somAmt / (rate || 1))}</td></tr>
           ${dA != null ? `<tr><td><b>Qoldi</b></td><td class="r2"><b>${
             cur === "usd" ? F(dA * rate) : F(dA)}</b></td><td class="r2"><b>${
             cur === "usd" ? D(dA) : D(dA / (rate || 1))}</b></td></tr>` : ""}
         </table>`
      : `${dB != null ? `<div class="r"><span>Jami qarz edi</span><b>${MB}</b></div>` : ""}
         ${dA != null ? `<div class="r qold"><span>${
           Number(dA) > 0 ? "Qoldi" : "To'liq yopildi"}</span><b>${MA}</b></div>` : ""}`}
    ${o.dueLine ? `<div class="r"><span>Muddat</span><b>${o.dueLine}</b></div>` : ""}
  </div>

  <div class="ft">${cfg.footer || "Rahmat! Yana kutamiz"}</div>
  ${(Array.isArray(cfg.extraLines) ? cfg.extraLines : [])
      .filter(Boolean)
      .map(t => `<div class="ft" style="font-size:11px">${t}</div>`).join("")}
</div>
</body></html>`;
}


// ═══ 517 (2026-08-21) — BELGI ENDI KECHIKMAYDI VA QOG'OZDA CHIQADI ═══
// Ikki nuqson tuzatildi (ikkalasi ham kod dalili bilan):
//
// 1) 30 SONIYALIK KO'R NUQTA. Sotuv yakunlangach chek DARHOL ochiladi —
//    yozuv "yosh" bo'lgani uchun belgi chiqmasdi. Ya'ni oflayn sotuvning
//    ENG BIRINCHI cheki (mijoz qo'liga ketadigani) toza chiqardi; belgi
//    faqat keyinroq, tarixdan ochilganda ko'rinardi. Holbuki shu paytda
//    javob ANIQ ma'lum: server sotuvni yozganda `serverWritten: true`
//    muhrini qaytaradi (`api/pul.js` — `sale` 408-qator, `pay` 291-qator).
//    Ya'ni taxmin kerak emas: muhr bor yoki yo'q. Endi SERVER REJIMIDA
//    muhr yo'q bo'lsa belgi DARHOL chiqadi, 30 soniya kutilmaydi.
//
// 2) QOG'OZDA CHIQMASLIGI (§9.1 qarori). 2026-08-13 da belgi ataylab
//    faqat ekranda qoldirilgan edi ("mijozda shubha uyg'otmasin").
//    2026-08-20/21 inqirozi shuni ko'rsatdi: tasdiqlanmagan chek mijoz
//    qo'lida qolsa va yozuv yo'qolsa — HECH QANDAY iz qolmaydi
//    (§7: 5 usul sinaldi, hech biri summani topmadi). Endi qog'ozda ham
//    chiqadi. Zaxira yo'l: `db.settings.chekTasdiqPrint === false` —
//    eski xulq qaytadi (sozlama bilan, yangi deploy kerak emas).
//
// ⚠️ ESKI CHEKLAR HIMOYASI: `serverWritten` muhri 2026-08-13 da paydo
//    bo'lgan; undan oldingi sotuvlarda muhr YO'Q. Ular tarixdan qayta
//    ochilganda bejiz belgilanmasligi uchun to'rt darvoza qo'yildi.
function _tasdiqBelgisi(sale, tur) {
  try {
    if (!sale) return "";
    // Namuna/savat ko'rinishi — hali sotuv yo'q, belgi ma'nosiz
    if (sale._preview) return "";

    const jadval = (tur === "qarz") ? "debt_payments" : "sales";
    const kalit  = String(sale.id || "");

    // ── DARVOZA 1: SERVER MUHRI BOR — tasdiqlangan ──
    if (sale.serverWritten === true) return "";

    // ── DARVOZA 2: BULUTDA KO'RILGAN (oxirgi pull'da) — tasdiqlangan ──
    // Eski (muhrsiz) cheklarni ham, boshqa qurilma yozganini ham qamraydi.
    try {
      if (typeof _cloudIds !== "undefined" && _cloudIds && _cloudIds[jadval]
          && _cloudIds[jadval].has(kalit)) return "";
    } catch (e) {}

    // ── DARVOZA 3: SHU QURILMA PUSH QILGAN ──
    if (typeof isRecordSent === "function" && isRecordSent(jadval, kalit)) return "";

    // ── DARVOZA 4: 2026-08-13 DAN OLDINGI YOZUV (muhr hali yo'q edi) ──
    const _ts = (() => {
      const t = Number(kalit.slice(0, 13));
      return (t > 1600000000000) ? t : 0;
    })();
    if (_ts && _ts < 1786561200000) return "";   // 2026-08-13 00:00 Toshkent

    // ── SERVER REJIMI O'CHIQ bo'lsa — ESKI XULQ (30 soniya muhlat) ──
    // Bunda yozuvni oddiy sinxron yuboradi va "tasdiqlanmagan" degani
    // noto'g'ri bo'lardi. Xulq 2026-08-13 dagidek qoladi.
    let _srvRej = false;
    try { _srvRej = (typeof _serverRejimi === "function") ? _serverRejimi() : false; }
    catch (e) { _srvRej = false; }
    if (!_srvRej) {
      if (!_ts || (Date.now() - _ts) < 30000) return "";
    }

    // ── BELGI ──
    const _chop = !(typeof db !== "undefined" && db.settings &&
                    db.settings.chekTasdiqPrint === false);
    return `<div class="_noprint-warn" style="border:2px dashed #000;
              padding:6px 8px;margin:6px 0;text-align:center;font-size:11px;
              font-weight:800;letter-spacing:.03em">
              \u26a0\ufe0f TASDIQLANMAGAN \u2014 serverga yozilmagan<br>
              <span style="font-weight:600;font-size:10px">
                Aloqa tiklangach o'zi yuboriladi va bu belgi yo'qoladi.<br>
                Chekni qayta chiqaring.
              </span>
            </div>` +
            (_chop ? "" :
            `<style>@media print{._noprint-warn{display:none !important}}</style>`);
  } catch (e) { return ""; }
}


// \u2550\u2550\u2550 QARZ SATRLARI \u2014 YAGONA MANBA (2026-08-14) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// Egasining talabi: chekda IKKALA valyutadagi qarz ko'rinsin, faqat
// qo'shilayotgani emas. Avval har chizuvchida `isUsd ? ... : ...`
// shohobchasi bor edi \u2014 ikkinchi valyuta TUSHIB QOLARDI (jonli:
// B20, mijozda 3 500 000 so'm qarz bor-u dollar qo'shilganda chekda
// so'm qarzi ko'rinmagan \u2014 kassir chalg'igan).
//
// QOIDA: nol bo'lmagan valyuta DOIM ko'rsatiladi, nol yashiriladi.
// Qo'shilayotgan valyuta o'z hisobi bilan ("so'm / kurs = $"),
// ikkinchi valyuta O'ZGARMASDAN o'tadi.
//
// Qaytaradi: { oldin, qoshildi, keyin } \u2014 tayyor matnlar (HTML emas),
// har chizuvchi o'z uslubida joylashtiradi.
function debtLines(sale, opts) {
  const o = opts || {};
  const F = o.F || (n => Math.round(Number(n) || 0).toLocaleString("ru-RU"));
  const rate = Number(o.rate) || Number(sale.rate) ||
               (typeof db !== "undefined" && db.settings?.rate) || 0;

  const isUsd   = sale.debtCurrency === "usd" && Number(sale.debtUsd) > 0;
  const qoldiq  = Number(sale.remaining) || 0;          // shu xaridda qo'shilgan (so'm)
  const debtUsd = Number(sale.debtUsd)   || 0;          // shu xaridda qo'shilgan ($)
  const pUsd    = Number(sale.prevDebtUsd) || 0;        // oldingi $ qarz
  const pUzs    = Number(sale.prevDebtUzs) || 0;        // oldingi so'm qarz

  // ── OLDINGI QARZ: nol bo'lmaganlari ──
  const oldinQ = [];
  if (pUzs > 0) oldinQ.push(F(pUzs) + " so'm");
  if (pUsd > 0) oldinQ.push("$" + pUsd.toFixed(2));

  // ── QO'SHILDI: faqat shu xarid ──
  let qoshildi = "";
  if (qoldiq > 0) {
    qoshildi = isUsd
      ? (rate > 0 ? F(qoldiq) + " / " + F(rate) + " = $" + debtUsd.toFixed(2)
                  : "$" + debtUsd.toFixed(2))
      : F(qoldiq) + " so'm";
  }

  // ── KEYINGI QARZ: qo'shilgan valyuta yig'iladi, ikkinchisi o'zgarmaydi ──
  const keyinQ = [];
  const yUzs = pUzs + (isUsd ? 0 : qoldiq);
  const yUsd = pUsd + (isUsd ? debtUsd : 0);
  if (yUzs > 0) keyinQ.push(F(yUzs) + " so'm");
  if (yUsd > 0) keyinQ.push("$" + yUsd.toFixed(2));

  return {
    oldin:    oldinQ.join(" + "),
    qoshildi: qoshildi,
    keyin:    keyinQ.join(" + "),
    bor:      (oldinQ.length > 0 || keyinQ.length > 0)
  };
}


// \u2550\u2550\u2550 SOZLAMALARNI USLUBLARGA YETKAZISH (2026-08-14) \u2550\u2550\u2550\u2550\u2550
// Muammo (egasining kuzatuvi): blok o'lchamlari, shrift, sarlavha foni
// va ikki-valyuta ko'rsatkichi FAQAT "Yagona" chekka ta'sir qilardi \u2014
// qolgan to'rt uslub ularni umuman O'QIMASDI (audit bilan tasdiqlandi).
// Bu funksiya har uslub uchun CSS ishlab beradi va uni chizuvchining
// <style> blokiga qo'shish kifoya.
//
// `sel` \u2014 uslubning sinf xaritasi: qaysi blok qaysi CSS selektorga.
// `sel._noAlign` — tekislash qo'llanmasin (Termal uchun: u BITTA matn
// bloki, shuning uchun bitta blokka "markaz" qo'yilsa BUTUN chek
// markazlashib qolardi — egasining shikoyati, 15-avgust).
// \U0001f534 2026-08-15: CHOP ETISH TUZATISHLARI (egasining shikoyati)
//   1) Ikkinchi darajali yozuvlar printerda JUDA XIRA chiqardi \u2014
//      och kulrang (#555, #888) termal printerda deyarli ko'rinmaydi.
//      Chop etishda hammasi QORA bo'ladi.
//   2) Chek o'ng tomondan KESILIB ketardi \u2014 jadval qog'ozdan keng
//      edi. Endi jadval qog'oz eniga majburan sig'adi.
function chekPrintFix(W) {
  // \U0001f534 2026-08-15 ILDIZ (uch urinishdan keyin aniqlandi):
  // Chizuvchida `@page{size:Wmm}` bor edi, men esa `size:auto` qo'ydim.
  // `auto` \u2014 QOG'OZ enini oladi (80mm), BOSILADIGAN enni emas
  // (72.1mm). Shuning uchun o'ng ~8mm qirqilardi. Egasining o'lchovi
  // buni tasdiqladi: printer "80(72.1)".
  // YECHIM: sahifa eni chizuvchi bilan BIR XIL qoladi, hujjat esa
  // undan 4mm TOR \u2014 shunda har qanday drayverda sig'adi.
  const w  = Number(W) || 72;
  // Chapga tekislanganda katta zaxira kerak emas — 2mm yetadi.
  // (4mm edi: markazga qo'yilgani uchun ikki tomondan olinardi.)
  const wd = Math.max(40, w - 2);
  return `
  @media print {
    /* \U0001f534 2026-08-15 (4-urinish, endi ildiz): SAHIFA o'lchami
       QOG'OZDAN olinadi (size:auto \u2014 80mm), hujjat esa BOSILADIGAN
       enda (72mm) va CHAPGA yopishadi.
       Avval sahifa 72mm deb belgilangandi \u2014 drayver uni 80mm
       qog'ozga KATTALASHTIRIB bosardi (72\u219280 = +11%), shuning uchun
       o'ng chekka bosiladigan qismdan chiqib ketardi. Endi sahifa =
       qog'oz, kattalashtirish YO'Q. */
    @page { size: auto; margin: 0 }
    html, body { width:auto !important; margin:0 !important; padding:0 !important }
    .doc, .wrap, .rc {
      width:${w}mm !important; max-width:${w}mm !important;
      /* \U0001f534 2026-08-15: CHAPGA tekislanadi, MARKAZGA emas.
         Rasm ko'rsatdi: chapda katta bo'sh joy, o'ngda kesik \u2014
         yani mazmun ongga surilgan. Sabab: markazga qoyish hujjatni
         QOG'OZ o'rtasiga qo'yardi, bosiladigan qism esa CHAPDAN
         boshlanadi. Endi chapga yopishadi \u2014 o'ng chekka chiqmaydi. */
      margin:0 !important; padding:0 !important;
      box-shadow:none !important; border:none !important;
      box-sizing:border-box !important }
    table { width:100% !important; table-layout:fixed !important;
            border-collapse:collapse !important }
    table, td, th { box-sizing:border-box !important }
    td, th { word-break:break-word !important; overflow-wrap:anywhere !important;
             padding-left:1px !important; padding-right:1px !important }
    /* \u2116 ustuni: ikki xonali raqam BO'LINMASIN */
    td.c:first-child, th.c:first-child, td:first-child, th:first-child {
      white-space:nowrap !important; padding:0 !important; text-align:center !important }
    td.r, th.r { white-space:nowrap !important }
    /* Chizilgan asl narx: AYRIM qatorda, o'lchami yangisiga TENG */
    td.r s, td.r span[style*="line-through"] {
      display:block !important; line-height:1.15 !important;
      font-size:inherit !important; color:#000 !important; opacity:1 !important }
    /* Barcha matn QORA \u2014 termal printer xira rangni bosmaydi */
    *, .sub, .sm, .lbl, .calc, .it-art, .it-info, .tot-cnt, .hd-meta,
    .ft-sub, .meta span, small, s, del,
    span[style*="line-through"], span[style*="opacity"] {
      color:#000 !important; opacity:1 !important }
  }`;
}

function chekStyleCss(cfg, sel) {
  try {
    if (!cfg) return "";
    const b = cfg.blocks || {};
    const out = [];

    // 1) SHRIFT OILASI (butun chek)
    const FAM = {
      dm:      "'DM Sans',system-ui,sans-serif",
      inter:   "Inter,system-ui,sans-serif",
      roboto:  "Roboto,system-ui,sans-serif",
      mono:    "'Courier New',monospace",
      serif:   "Georgia,'Times New Roman',serif"
    };
    // \U0001f534 2026-08-15: TERMALGA shrift QO'LLANMAYDI. U bo'shliqlar
    // bilan ikki tomonlama tekislanadi va faqat MONOSHRIFTDA to'g'ri
    // chiqadi. Avval "DM Sans" ga almashib, chek chapga yopishib
    // qolardi (egasining shikoyati, 15-avgust).
    if (cfg.fontFamily && FAM[cfg.fontFamily] && !(sel && sel._noAlign))
      out.push(`.doc,.wrap{font-family:${FAM[cfg.fontFamily]}}`);

    // 2) UMUMIY O'LCHAM (kichik / normal / katta)
    const SC = { kichik: 0.9, normal: 1, katta: 1.12 };
    const k = SC[cfg.fontScale] || 1;
    // Termalda o'lcham ham cheklangan — 40 belgi sig'masa tekislash buziladi
    if (k !== 1) out.push((sel && sel._noAlign)
      ? `.doc,.wrap{font-size:${(13 * k).toFixed(1)}px}`
      : `.doc,.wrap,.rc{font-size:${(13 * k).toFixed(1)}px}`);

    // 3) BLOK BO'YICHA: o'lcham, qalin, kursiv, tekislash, ko'rsatish
    for (const key in (sel || {})) {
      const cssSel = sel[key];
      const o = b[key];
      if (!cssSel || !o) continue;
      const d = [];
      if (o.size)   d.push(`font-size:${Number(o.size) * k}px`);
      if (o.bold)   d.push("font-weight:800");
      if (o.italic) d.push("font-style:italic");
      if (o.align && !(sel && sel._noAlign)) d.push(`text-align:${o.align}`);
      if (d.length) out.push(`${cssSel}{${d.join(";")} !important}`);
      if (o.show === false) out.push(`${cssSel}{display:none !important}`);
    }

    // 4) SARLAVHA FONI (och / to'q)
    if (cfg.headerStyle === "light")
      out.push(".hd{background:#fff !important;color:#000 !important}" +
               ".hd *{color:#000 !important}");
    else if (cfg.headerStyle === "dark")
      out.push(".hd{background:#0D1B2A !important;color:#fff !important}" +
               ".hd *{color:#fff !important}");

    return out.join("\n");
  } catch (e) { return ""; }
}

// Chek pastidagi qo'shimcha qatorlar (reklama, ish vaqti) \u2014 hamma uslubga
function chekExtraHtml(cfg, cls) {
  try {
    const ex = cfg && cfg.extraLines;
    if (!Array.isArray(ex) || !ex.length) return "";
    return ex.filter(Boolean).map(t =>
      `<div class="${cls || "ft"}" style="font-size:11px;opacity:.85">${t}</div>`).join("");
  } catch (e) { return ""; }
}


// \u2550\u2550\u2550 CHEK BO'LIMLARI \u2014 YAGONA TARTIB (2026-08-14) \u2550\u2550\u2550\u2550\u2550\u2550\u2550
// Egasining talabi: BARCHA cheklarda bir xil bo'limlar va bir xil
// KETMA-KETLIK bo'lsin; faqat TOVARLAR bo'limining tuzilishi uslubga
// qarab o'zgarsin (jadval, ulgurji ro'yxati, termal matn).
// Shu funksiya barcha qatorlarni tayyorlab beradi \u2014 har chizuvchi
// ularni o'z sinflari bilan chizadi. Tartib bir joyda saqlanadi,
// kelajakda o'zgartirish ham bir joyda bo'ladi.
//
// Tartib: META \u2192 (TOVARLAR) \u2192 YIG'INDI \u2192 TO'LOV \u2192 QARZ \u2192 ALTBILGI
function chekRows(sale, cfg, F) {
  const _f0 = F || (n => Math.round(Number(n) || 0).toLocaleString("ru-RU"));
  // \u2705 2026-08-14: IKKI VALYUTA \u2014 barcha uslublarda (egasining talabi).
  // Avval faqat "Yagona" chekda ishlardi. Yoqilgan bo'lsa har summa
  // "540 000 / $43.20" ko'rinishida chiqadi.
  const _rt = Number((cfg && cfg.rate)) ||
              (typeof db !== "undefined" && db.settings?.rate) || 0;
  const _dual = (cfg && cfg.dualCurrency !== false) && _rt > 0;
  const f = (n) => {
    const som = Math.round(Number(n) || 0);
    const t = _f0(som);
    if (!_dual) return t;
    return t + " / $" + (som / _rt).toFixed(2);
  };
  const c = cfg || {};
  const items    = (sale.items || []).filter(Boolean);
  const total    = Number(sale.total || 0);
  const paid     = Number(sale.paid  || 0);
  const discount = Number(sale.discount || 0);
  const subtotal = Number(sale.subtotal || (total + discount));
  const rate     = Number(sale.rate) || Number(c.rate) ||
                   (typeof db !== "undefined" && db.settings?.rate) || 0;
  const PAY = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash" };

  // ── 1) META (chek boshi) ──
  const meta = [];
  meta.push(["Sotuv", sale.chekNum || ("#" + sale.id)]);
  if (c.shopName)                 meta.push(["Do'kon", c.shopName]);
  meta.push(["Sana", (sale.date || "") + (sale.time ? " " + sale.time : "")]);
  if (c.showStaff !== false && c.staffName && c.staffName !== "\u2014")
    meta.push(["Sotuvchi / Kassir", c.staffName]);
  if (c.showContact !== false && c.contact) meta.push(["Kontaktlar", c.contact]);
  if (sale.customerName)  meta.push(["Mijoz", sale.customerName]);
  if (sale.customerPhone) meta.push(["Mijoz raqami", sale.customerPhone]);

  // ── 2) YIG'INDI (tovarlardan keyin) ──
  const summary = [];
  let pochka = 0, dona = 0;
  items.forEach(it => {
    const q = Number(it.qty) || 0;
    if (it.sellMode === "karobka" || it.qtyBox) pochka += Number(it.qtyBox || q) || 0;
    dona += q;
  });
  if (pochka > 0) summary.push(["JAMI POCHKA", pochka + " pochka", "big"]);
  // ✅ 2026-08-15: IKKI XIL CHEGIRMA (egasining savoli):
  //   (a) TOVAR chegirmasi — savatda har tovarga alohida berilgan.
  //       `basePrice` da asl narx, `price` da pasaytirilgani turadi.
  //   (b) UMUMIY chegirma — `sale.discount` (butun chekka).
  // Avval faqat (b) ko'rsatilardi, (a) esa boshqa uslublarda umuman
  // yo'q edi — yagona chekdagidan farq qilardi.
  const _itemDisc = items.reduce((a, i) =>
    a + ((i.basePrice && i.basePrice > (i.price || 0))
         ? (i.basePrice - i.price) * (i.qty || 1) : 0), 0);
  const _bazaJami = items.reduce((a, i) =>
    a + ((i.basePrice || i.price || 0) * (i.qty || 0)), 0);

  if (_itemDisc > 0 || discount > 0) {
    summary.push(["Jami (chegirmasiz)",
                  f(_itemDisc > 0 ? _bazaJami : subtotal) + " so'm"]);
    if (_itemDisc > 0)
      summary.push(["Tovar chegirmalari", "\u2212" + f(_itemDisc) + " so'm", "disc"]);
    if (discount > 0)
      summary.push(["Umumiy chegirma", "\u2212" + f(discount) + " so'm", "disc"]);
  }
  summary.push(["JAMI", f(total) + " so'm",
                "total", items.length + " xil \u00b7 " + dona + " dona"]);

  // ── 3) TO'LOV ──
  const payment = [];
  if (sale.payType) payment.push(["To'lov turi", PAY[sale.payType] || sale.payType]);
  const pb = sale.payBreakdown || {};
  if (Number(pb.naqd)    > 0) payment.push(["Naqd pul", f(pb.naqd)    + " so'm"]);
  if (Number(pb.karta)   > 0) payment.push(["Karta",    f(pb.karta)   + " so'm"]);
  if (Number(pb.otkazma) > 0) payment.push(["O'tkazma", f(pb.otkazma) + " so'm"]);
  if (paid > 0) payment.push(["To'landi", f(paid) + " so'm", "ok"]);

  // ── 4) QARZ (yagona manba: debtLines) ──
  const debt = [];
  const _fn = (typeof globalThis !== "undefined" && globalThis.debtLines) ||
              (typeof debtLines === "function" ? debtLines : null);
  // \u26a0\ufe0f 2026-08-15: qarz satrlariga ODDIY formatchi beriladi (_f0),
  // ikki-valyutali EMAS. `debtLines` allaqachon "so'm / kurs = $"
  // ko'rinishida yozadi — ikki-valyutali formatchi berilsa ustiga yana
  // "/ $..." qo'shib yuborardi: "10 000 000 / $837.66 / 11 938 / $1.00"
  // (jonli: Jadval cheki, 15-avgust).
  const d = (c.showDebtHistory === false || !_fn) ? null : _fn(sale, { F: _f0, rate });
  if (d && d.oldin)    debt.push(["Xariddan oldingi qarz", d.oldin]);
  if (d && d.qoshildi) debt.push(["Qarzga qo'shildi",      d.qoshildi]);
  if (d && d.keyin)    debt.push(["Xariddan keyingi qarz", d.keyin, "debt"]);
  if (sale.due)        debt.push(["To'lov muddati", sale.due, "debt"]);

  // ── 5) ALTBILGI ──
  const footer = [];
  if (c.footer) footer.push(c.footer);
  (Array.isArray(c.extraLines) ? c.extraLines : []).forEach(t => { if (t) footer.push(t); });

  return { meta, summary, payment, debt, footer, pochka, dona };
}


// Qatorlarni HTML ga aylantirish \u2014 uslub o'z sinflarini beradi.
// `K` = {row, label, val, sep, big, total, disc, ok, debt, ft}
function chekRowsHtml(R, K) {
  const k = K || {};
  const row = (l, v, c, sub) =>
    `<div class="${k.row || "row"}${c ? " " + (k[c] || c) : ""}">` +
    `<span class="${k.label || ""}">${l}${sub ? `<br><small style="opacity:.6">${sub}</small>` : ""}</span>` +
    `<b class="${k.val || ""}">${v}</b></div>`;
  const sep = k.sep ? `<div class="${k.sep}"></div>` : "";
  const blok = (arr) => arr.map(x => row(x[0], x[1], x[2], x[3])).join("");
  return {
    meta:    blok(R.meta),
    summary: blok(R.summary),
    payment: R.payment.length ? sep + blok(R.payment) : "",
    debt:    R.debt.length    ? sep + blok(R.debt)    : "",
    footer:  R.footer.map((t, i) =>
      `<div class="${k.ft || "ft"}"${i ? ' style="font-size:11px;opacity:.8"' : ""}>${t}</div>`).join("")
  };
}


// \u2550\u2550\u2550 QAYTARISH OGOHLANTIRISHI \u2014 HAMMA USLUBGA (2026-08-15) \u2550\u2550
// Egasining kuzatuvi: qaytarish belgisi FAQAT "Yagona" chekda bor edi \u2014
// boshqa uslub tanlansa mijoz chekda qaytarilganini KO'RMASDI.
// Asl chek o'zgarmaydi (\u00a73.6), faqat pastiga qizil belgi qo'shiladi.
// ✅ 2026-08-19 (Shermuhammad hodisasi, KO'RINISH ildizi): CHEKDAGI
// QIZIL BELGI ENDI IKKI MANBADAN. Uchala chiquvchi (yagona chek,
// uslublar bloki, Telegram matni) faqat `sale.refunds` ni o'qirdi —
// bu maydon sotuv JSONida yashaydi: qaytarish BOSHQA qurilmada
// qilinsa yoki sinxron oralig'i to'g'ri kelsa, u BO'SH bo'ladi va
// kassir chekda hech narsa ko'rmasdi. Aynan shu sabab u "ishlamadi"
// deb QAYTA qaytargan (B20, 19-avg, QT-02/QT-03). `db.returns` —
// chidamli hujjatlar, pull o'chirmaydi. refundNo bo'yicha de-dup:
// bitta hujjat ikkala manbada bo'lsa BIR marta sanaladi.
function _chekRefundDocs(sale) {
  try {
    const docs = new Map();
    (((sale && sale.refunds) || [])).forEach(r => {
      if (!r) return;
      docs.set(String(r.no || ("s" + docs.size)),
        { no: r.no || "", total: Number(r.total) || 0, items: r.items || [] });
    });
    if (typeof db !== "undefined" && Array.isArray(db.returns) && sale) {
      db.returns.forEach(r => {
        if (!r || String(r.origSaleId || "") !== String(sale.id)) return;
        const no = String(r.refundNo || r.id || ("d" + docs.size));
        if (!docs.has(no))
          docs.set(no, { no: r.refundNo || "", total: Number(r.total) || 0,
                         items: r.items || [] });
      });
    }
    return [...docs.values()];
  } catch (e) { return (sale && sale.refunds) || []; }
}

// ═══ ✅ QP-1 (2026-08-26): QAYTARISH PUL XULOSASI — yagona yig'uvchi ═══
// Qizil eslatma uchun refundNo bo'yicha MAVJUD yozuvlar o'qiladi:
// QTQ to'lovlari (qarzdan qoplangan qism + o'sha paytdagi jami qarz)
// va "Tovar qaytarish" xarajati (kassadan qaytarilgan qism).
// FAQAT O'QIYDI — pul mantiqiga tegmaydi; xato → null (eslatma
// avvalgidek chiqadi). Egizak: utils.js ↔ bot.js (C8) — BIR XIL.
function _refundPulYig(refs, pays, xars) {
  try {
    const nos = new Set((refs || []).map(r => r && r.no).filter(Boolean));
    if (!nos.size) return null;
    let bU=null,bD=null,aU=null,aD=null,qU=0,qD=0,somU=0,kSum=0,kMet="";
    let qRate=0, qRateBir=true;
    const mx=(o,v)=>(o==null?v:Math.max(o,v)), mn=(o,v)=>(o==null?v:Math.min(o,v));
    (pays || []).forEach(p => {
      const d = p && (p.data || p);
      if (!d || d.source !== "refund" || !nos.has(d.refundNo)) return;
      const cur = d.currency || p.currency || "uzs";
      const am  = Number(d.amount != null ? d.amount : p.amount) || 0;
      // ✅ QP-2: yangi yozuvlarda IKKALA valyuta muhri bor — ustuvor;
      // eski yozuvlarda faqat o'z valyutasi (halol: borini ko'rsatamiz).
      const bfU=Number(d.debtBeforeUzs), bfD=Number(d.debtBeforeUsd);
      const afU=Number(d.debtAfterUzs),  afD=Number(d.debtAfterUsd);
      if (!isNaN(bfU) || !isNaN(bfD)) {
        if (!isNaN(bfU)) bU=mx(bU,bfU);  if (!isNaN(bfD)) bD=mx(bD,bfD);
        if (!isNaN(afU)) aU=mn(aU,afU);  if (!isNaN(afD)) aD=mn(aD,afD);
      } else {
        const bf=Number(d.debtBefore), af=Number(d.debtAfter);
        if (cur === "usd") { if(!isNaN(bf)) bD=mx(bD,bf); if(!isNaN(af)) aD=mn(aD,af); }
        else               { if(!isNaN(bf)) bU=mx(bU,bf); if(!isNaN(af)) aU=mn(aU,af); }
      }
      if (cur === "usd") {
        qD += am; somU += Number(d.amountSom) || 0;
        const r = Number(d.rate) || 0;
        if (r > 0) { if (qRate > 0 && Math.abs(qRate - r) > 1) qRateBir = false; qRate = r; }
      } else qU += am;
    });
    (xars || []).forEach(x => {
      const d = x && (x.data || x);
      if (!d || !nos.has(d.refundNo)) return;
      kSum += Number(x.amount != null ? x.amount : d.amount) || 0;
      if (!kMet) kMet = ((x.method || d.method) === "karta") ? "Karta" : "Naqd";
    });
    if (!qRateBir) qRate = 0;   // kurslar har xil — bo'lish ko'rsatilmaydi
    if (qU<=0 && qD<=0 && kSum<=0) return null;
    return { bU,bD,aU,aD,qU,qD,somU,qRate,kSum,kMet };
  } catch (e) { return null; }
}
// Xulosani [nom, qiymat] satrlarga aylantiradi — hamma chizuvchi
// (HTML, termal, Telegram matni) BIR XIL satrlarni ishlatadi.
function _refundPulSatrlar(pl, f) {
  const S = [];
  if (!pl) return S;
  const iq = (u, d) => { const p=[]; const _d=Number(d)||0, _u=Number(u)||0;
    if (_d>0) p.push("$"+_d.toFixed(2)); if (_u>0) p.push(f(_u)+" so'm");
    return p.length ? p.join(" + ") : "0"; };
  if (pl.bU!=null || pl.bD!=null) S.push(["Qaytarishdan oldingi qarz", iq(pl.bU,pl.bD)]);
  if (pl.qU>0 || pl.qD>0) {
    // ✅ QP-2: sotuv chekidagi uslub — "12 000 000 / 11 779 = $1018.76".
    // Kurs — QTQ yozuvidagi qotgan kurs; har xil bo'lsa bo'lish yozilmaydi.
    let v;
    if (pl.qD > 0) {
      v = (pl.somU > 0
            ? f(pl.somU) + (pl.qRate > 0 ? " / " + f(pl.qRate) : "") + " = "
            : "") + "$" + pl.qD.toFixed(2);
      if (pl.qU > 0) v += " + " + f(pl.qU) + " so'm";
    } else v = f(pl.qU) + " so'm";
    S.push(["Qarzdan qoplandi", v]);
  }
  if (pl.aU!=null || pl.aD!=null) {
    const v = iq(pl.aU,pl.aD);
    S.push(["Qaytarishdan keyingi qarz", v === "0" ? "0 — qarz yo'q" : v]);
  }
  if (pl.kSum>0) S.push(["Kassadan qaytarildi ("+(pl.kMet||"Naqd")+")", f(pl.kSum)+" so'm"]);
  return S;
}

function chekRefundNote(sale, F, matnli) {
  try {
    const refs = _chekRefundDocs(sale);   // ✅ 2026-08-19: ikki manba
    if (!refs.length) return "";
    const f = F || (n => Math.round(Number(n) || 0).toLocaleString("ru-RU"));
    const tot  = sale.refundedTotal || refs.reduce((a, r) => a + (r.total || 0), 0);
    const full = sale.status === "qaytarilgan";
    const nos  = refs.map(r => r.no).filter(Boolean).join(", ");
    const bosh = full ? "TO'LIQ QAYTARILGAN" : "QISMAN QAYTARILGAN";
    // ✅ QP-1: pul xulosasi — botda oldindan yuklangan (sale._refPul),
    // kassada lokal bazadan yig'iladi. Topilmasa — satrlar shunchaki yo'q.
    const _pl = (sale && sale._refPul) ||
      ((typeof db !== "undefined" && db)
        ? _refundPulYig(refs, db.debtPayments, db.xarajatlar) : null);
    const pulSatr = _refundPulSatrlar(_pl, f);
    if (matnli) {
      // Termal (matnli chek) uchun
      const out = ["", "=".repeat(40), "  " + bosh,
                   "  Qaytarilgan: " + f(tot) + " so'm"];
      if (nos) out.push("  Qaytarish cheki: " + nos);
      pulSatr.forEach(([k, v]) => out.push("  " + k + ": " + v));   // ✅ QP-1
      refs.forEach(r => (r.items || []).forEach(it => {
        if (!it) return;
        const q = Number(it.qty) || 0;
        const _r = it.color || it.variant || "";
        // ✅ 2026-08-16 (egasining talabi): pochka ham — "2 pochka (10 dona)"
        const _qb = Number(it.qtyBox) || 0;
        const _bl = it.unit || "dona";
        const _mk = q ? (_qb > 0 ? _qb + " pochka (" + q + " " + _bl + ")" : q + " " + _bl) : "";
        out.push("  • " + (it.name || "") + (_r ? " " + _r : "") +
                 (it.art ? " " + it.art : "") + (_mk ? " — " + _mk : ""));
      }));
      out.push("=".repeat(40));
      return out.join("\n");
    }
    // ✅ 2026-08-15: QAYSI TOVARLAR qaytgani ham yoziladi (egasining
    // talabi — avval faqat summa va chek raqami bor edi).
    // ✅ 2026-08-15: NOM · RANG · ART — eski yozuvlarda rang `variant`
    // maydonida saqlangan, shuning uchun ikkalasi ham tekshiriladi.
    const tovarlar = [];
    refs.forEach(r => (r.items || []).forEach(it => {
      if (!it) return;
      const q    = Number(it.qty) || 0;
      const rang = it.color || it.variant || "";
      const art  = it.art || "";
      // ✅ 2026-08-16 (egasining talabi): pochka ham — "2 pochka (10 dona)"
      const qb   = Number(it.qtyBox) || 0;
      const bl   = it.unit || "dona";
      const mk   = q ? (qb > 0 ? qb + " pochka (" + q + " " + bl + ")" : q + " " + bl) : "";
      tovarlar.push((it.name || "") +
        (rang ? " · " + rang : "") +
        (art  ? " · " + art  : "") +
        (mk ? " — " + mk : ""));
    }));
    return `<div style="margin:8px 0 0;padding:8px 10px;border:1px dashed #B91C1C;
        border-radius:6px;background:#FEF2F2">
        <div style="font-size:11.5px;font-weight:800;color:#B91C1C">${bosh}</div>
        <div style="font-size:11px;color:#000;margin-top:2px">
          Qaytarilgan summa: <b>${f(tot)} so'm</b>
          ${nos ? `<br>Qaytarish cheki: <b>${nos}</b>` : ""}
          ${pulSatr.map(([k, v]) => `<br>${k}: <b>${v}</b>`).join("")}
        </div>
        ${tovarlar.length ? `<div style="font-size:10.5px;color:#000;margin-top:4px;
          border-top:1px dotted #B91C1C;padding-top:4px">
          ${tovarlar.map(t => "• " + t).join("<br>")}</div>` : ""}
      </div>`;
  } catch (e) { return ""; }
}


// \u2550\u2550\u2550 BOT CHEKI \u2014 SOTUV CHEKI BILAN PARALLEL (2026-08-15) \u2550\u2550
// Egasining talabi: botdagi chek sotuv cheki bilan BIR XIL bo'lsin \u2014
// qaysi uslub tanlangan bo'lsa, uning BO'LIMLARI va TARTIBI botga ham
// o'tsin. Telegram HTML qabul qiladi (CSS emas), shuning uchun ko'rinish
// emas, MAZMUN va TARTIB birlashtiriladi \u2014 manba bitta: chekRows().
function chekTelegramText(sale, cfg) {
  try {
    const F = n => Math.round(Number(n) || 0).toLocaleString("ru-RU");
    const c = cfg || (typeof getChekCfg === "function" ? getChekCfg("bot") : {});
    const R = chekRows(sale, { ...c, rate: (typeof db !== "undefined" && db.settings?.rate) || 0 }, F);
    const esc = t => String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const L = [];
    L.push("\ud83e\uddfe <b>" + esc(c.shopName || (typeof db !== "undefined" && db.shop?.name) || "MERX") + "</b>");
    if (c.tagline) L.push("<i>" + esc(c.tagline) + "</i>");
    L.push("");
    R.meta.forEach(x => L.push(esc(x[0]) + ": <b>" + esc(x[1]) + "</b>"));
    L.push("");
    L.push("\ud83d\udce6 <b>Tovarlar</b>");
    // ✅ 2026-08-15: CHEGIRMA va POCHKA hisobga olinadi — sotuv
    // chekidagi kabi (egasining kuzatuvi: bot narxni chegirmasiz
    // yozardi va pochka sonini ko'rsatmasdi).
    const _dm = (typeof chekItemDisc === "function") ? chekItemDisc(sale) : {};
    (sale.items || []).filter(Boolean).forEach((it, i) => {
      const q  = Number(it.qty) || 0;
      const px = (typeof chekItemPrice === "function")
                 ? chekItemPrice(sale, i, it, _dm) : (it.price || 0);
      const bz = (typeof chekItemBase === "function")
                 ? chekItemBase(sale, i, it, _dm) : null;
      const isBox = it.sellMode === "karobka" && it.qtyBox;
      const soni  = isBox ? (it.qtyBox + " pchk (" + q + " dona)")
                          : (q + " " + (it.unit || "dona"));
      const nomi  = esc(it.name || "") +
                    (it.art && it.art !== it.name ? " \u00b7 " + esc(it.art) : "") +
                    (it.color ? " \u00b7 " + esc(it.color) : "");
      const narx  = (bz && bz > px)
        ? "<s>" + F(bz) + "</s> " + F(px)
        : F(px);
      L.push((i + 1) + ". " + nomi + " \u2014 " + soni + " \u00d7 " + narx);
    });
    L.push("");
    R.summary.forEach(x => L.push(esc(x[0]) + ": <b>" + esc(x[1]) + "</b>"));
    if (R.payment.length) { L.push(""); R.payment.forEach(x => L.push(esc(x[0]) + ": " + esc(x[1]))); }
    if (R.debt.length)    { L.push(""); R.debt.forEach(x => L.push(esc(x[0]) + ": <b>" + esc(x[1]) + "</b>")); }
    // Qaytarish belgisi \u2014 sotuv chekidagi kabi
    const refs = (typeof _chekRefundDocs === "function")
      ? _chekRefundDocs(sale) : (sale.refunds || []);   // ✅ 2026-08-19
    if (refs.length) {
      const tot = sale.refundedTotal || refs.reduce((a, r) => a + (r.total || 0), 0);
      L.push("");
      L.push("\u26a0\ufe0f <b>" + (sale.status === "qaytarilgan" ? "TO'LIQ QAYTARILGAN" : "QISMAN QAYTARILGAN") + "</b>");
      L.push("Qaytarilgan: <b>" + F(tot) + " so'm</b>");
      // ✅ QP-1: TG xabarida ham eslatma bilan BIR XIL pul satrlari
      try {
        const _plT = _refundPulYig(refs, db.debtPayments, db.xarajatlar);
        _refundPulSatrlar(_plT, F).forEach(([k, v]) =>
          L.push(k + ": <b>" + v + "</b>"));
      } catch (e) {}
    }
    if (R.footer.length) { L.push(""); R.footer.forEach(t => L.push(esc(t))); }
    return L.join("\n");
  } catch (e) { return ""; }
}


// \u2550\u2550\u2550 CHEGIRMANI TOVARLARGA TAQSIMLASH (2026-08-15) \u2550\u2550\u2550\u2550\u2550
// Egasining kuzatuvi: chegirma FAQAT "Yagona" chekda his qilinardi \u2014
// boshqa uslublarda va bot xabarida tovar narxi chegirmasiz chiqardi.
// Bu \u2014 yagona chekdagi mantiqning aynan o'zi, umumiy funksiyaga
// chiqarildi (bir joyda tuzatilsin).
//
// Qoida: umumiy chegirma har tovarga FOYDAGA mutanosib taqsimlanadi;
// foyda bilinmasa (tannarx yo'q) \u2014 narxga mutanosib. Butun sonlarda,
// qoldiq oxirgi tovarga \u2014 pul yo'qolmaydi.
// \u26a0\ufe0f Faqat CHEK KO'RINISHI. Summa, foyda, qarz TEGILMAYDI.
function chekItemDisc(sale) {
  const map = {};
  try {
    const items = (sale.items || []).filter(Boolean);
    const disc  = Number(sale.discount) || 0;
    if (!(disc > 0) || !items.length) return map;

    const profits = items.map(i => {
      const line = (i.price || 0) * (i.qty || 0);
      const cost = (i.cost != null ? i.cost : 0) * (i.qty || 0);
      const p = line - cost;
      return p > 0 ? p : 0;
    });
    let weights = profits, totW = profits.reduce((a, b) => a + b, 0);
    if (totW <= 0) {
      weights = items.map(i => (i.price || 0) * (i.qty || 0));
      totW = weights.reduce((a, b) => a + b, 0);
    }
    if (totW <= 0) return map;

    let allocated = 0, lastIdx = -1;
    items.forEach((it, ix) => { if (weights[ix] > 0) lastIdx = ix; });
    items.forEach((it, ix) => {
      if (weights[ix] <= 0) { map[ix] = 0; return; }
      const d = Math.floor(disc * weights[ix] / totW);
      map[ix] = d; allocated += d;
    });
    if (lastIdx >= 0) map[lastIdx] += (disc - allocated);  // qoldiq
  } catch (e) {}
  return map;
}

// Tovarning chekda ko'rsatiladigan DONA narxi (chegirma taqsimlangan)
function chekItemPrice(sale, idx, it, discMap) {
  try {
    const q = Number(it.qty) || 0;
    const p = Number(it.price) || 0;
    if (!q) return p;
    const d = (discMap || {})[idx] || 0;
    return Math.max(0, p - (d / q));
  } catch (e) { return Number(it.price) || 0; }
}

// Tovarning ASL narxi (chegirmadan oldingi) \u2014 chekda chizib
// ko'rsatish uchun. Savatda tovarga chegirma berilgan bo'lsa
// `basePrice` da asl narx turadi; umumiy chegirma bo'lsa joriy narx.
// Chegirma yo'q bo'lsa \u2014 null (asl narx ko'rsatilmaydi).
function chekItemBase(sale, idx, it, discMap) {
  try {
    const p = Number(it.price) || 0;
    const b = Number(it.basePrice) || 0;
    const d = (discMap || {})[idx] || 0;
    if (b > p) return b;          // savatdagi tovar chegirmasi
    if (d > 0) return p;          // umumiy chegirma taqsimlangan
    return null;
  } catch (e) { return null; }
}


// \u2550\u2550\u2550 BRAUZER ARALASHUVIDAN HIMOYA (2026-08-15) \u2550\u2550\u2550\u2550\u2550\u2550\u2550
// Egasining ikki shikoyati, ildizi BITTA \u2014 Chrome maydonlarni
// "login/parol" deb o'ylaydi:
//   1) Yangilashdan keyin do'kon LOGINI qaysidir qatorga yozilib
//      qolardi (avval qidiruv qatorlariga himoya qo'yilgan, lekin
//      POS to'lov maydonlariga yetmagan);
//   2) Qarz to'laganda "Parolni saqlash?" oynasi chiqardi \u2014
//      summani login deb olardi (jonli: "\u0418\u043c\u044f: 100 0000").
//
// \u26a0\ufe0f NIMAGA TEGMAYDI: maydon qiymati, `oninput`, hisob-kitob,
// `datalist` takliflari (rang, kategoriya) va POS skaner dvijoki
// (`document.activeElement` orqali ishlaydi) \u2014 hammasi o'z holicha.
// Faqat brauzerning O'Z xotirasidan to'ldirishi to'xtaydi.
function autofillGuard(root) {
  try {
    const box = root || document;
    const els = box.querySelectorAll("input, textarea");
    els.forEach(el => {
      const t = (el.type || "").toLowerCase();
      if (t === "checkbox" || t === "radio" || t === "file" ||
          t === "submit" || t === "button" || t === "hidden") return;
      if (el.dataset.afFake === "1") return;       // soxta juftlik — tegmaymiz
      if (el.dataset.afGuard === "1") return;      // bir marta yetadi
      // Parol maydonlari \u2014 brauzer menejeri KERAK bo'lishi mumkin
      if (t === "password") { el.setAttribute("autocomplete", "new-password"); }
      else if (!el.getAttribute("autocomplete")) {
        el.setAttribute("autocomplete", "off");
      }
      // Parol menejerlari (LastPass, 1Password, Chrome) uchun belgi
      el.setAttribute("data-lpignore", "true");
      el.setAttribute("data-form-type", "other");
      el.setAttribute("data-1p-ignore", "true");
      // Noyob nom \u2014 brauzer "bu o'sha maydon" deb tanimaydi
      if (!el.name) el.name = "f" + Math.random().toString(36).slice(2, 9);
      el.dataset.afGuard = "1";
    });
  } catch (e) {}
}

// Yangi chizilgan maydonlarga ham avtomat qo'llanadi (POS savati,
// modallar, jadval qatorlari) \u2014 kuzatuvchi orqali.
function autofillGuardWatch() {
  try {
    // \U0001f512 SOXTA MAYDON: Chrome modal ichida ikkita matn maydoni
    // ko'rsa "login + parol" deb o'ylab saqlashni taklif qiladi.
    // Ko'rinmas soxta juftlik qo'ysak — u o'shani oladi va haqiqiy
    // maydonlarga tegmaydi. Hech qanday ishga aralashmaydi:
    // `data-af-fake` belgisi bor, tashqarida ko'rinmaydi.
    if (!document.getElementById("af-fake-user")) {
      const box = document.createElement("div");
      box.setAttribute("aria-hidden", "true");
      box.style.cssText = "position:absolute;left:-9999px;top:-9999px;" +
                          "width:1px;height:1px;overflow:hidden;opacity:0";
      box.innerHTML =
        '<input id="af-fake-user" data-af-fake="1" type="text" tabindex="-1" ' +
        'autocomplete="username" name="af_user">' +
        '<input id="af-fake-pass" data-af-fake="1" type="password" tabindex="-1" ' +
        'autocomplete="current-password" name="af_pass">';
      document.body.appendChild(box);
    }
    // ✅ 2026-08-18: ALDOV-MAYDON FAQAT KIRISH EKRANIDA FAOL.
    // U doimiy yoqiq turganda Chrome uni "login+parol" juftligi deb
    // bilib, ilova ichida RAQAM terib Enter bosilgan sayin "Parolni
    // saqlaymi?" oynasini chiqarardi (egasining shikoyati: sonli
    // amaliyotlarda ko'p joyda). `disabled` parol maydonini brauzer
    // butunlay e'tiborsiz qoldiradi; kirish ekrani ko'ringandagina
    // yoqiladi va o'z ishini (autofillni yutish) qilaveradi.
    const _afDecoyTune = () => {
      try {
        const u = document.getElementById("af-fake-user");
        const p = document.getElementById("af-fake-pass");
        if (!u || !p) return;
        const login = ["auth-pass", "auth-pin", "auth-sa-pass", "sa-pass"]
          .map(id => document.getElementById(id))
          .some(el => el && el.offsetParent !== null);
        u.disabled = p.disabled = !login;
      } catch (e) {}
    };
    _afDecoyTune();
    setInterval(_afDecoyTune, 3000);
    autofillGuard(document);
    const obs = new MutationObserver(muts => {
      let bor = false;
      muts.forEach(m => m.addedNodes && m.addedNodes.forEach(n => {
        if (n.nodeType === 1) bor = true;
      }));
      if (bor) { autofillGuard(document); _afDecoyTune(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
// ✅ XD-3 (2026-09-05) — "QORA QUTI": konsolning oxirgi 300 satri
// XOTIRADA aylanma buferda saqlanadi. Maqsad: B20-iPhone "xotira
// to'ldi" sinfidagi hodisada telefon O'ZI hisobot yuborsin (kassir
// bezovta qilinmaydi). Xavfsizlik: bufer FAQAT xotirada (sandiq/
// cho'ntak buzilgan rejimda ham ishlaydi, o'zi bosim qo'shmaydi);
// satr ≤300 belgi, jami ≤300 satr (~90KB shift); rekursiya
// qo'riqchisi bor; asl console saqlanadi (window._qqOrig).
(function () {
  if (window._qqTayyor) return;
  window._qqTayyor = true;
  const MAXL = 300, MAXS = 300;
  const buf = [];
  window._qqBuf = buf;
  const orig = {
    log:   console.log.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
  };
  window._qqOrig = orig;
  let _ich = false;                       // rekursiyadan himoya
  function push(lvl, args) {
    if (_ich) return;
    _ich = true;
    try {
      const t = new Date(Date.now() + 5 * 3600 * 1000)
        .toISOString().slice(11, 19);     // Toshkent HH:MM:SS
      let s = args.map(a => {
        try { return typeof a === "string" ? a : JSON.stringify(a); }
        catch (e) { return String(a); }
      }).join(" ");
      if (s.length > MAXS) s = s.slice(0, MAXS) + "…";
      buf.push(t + " " + lvl + " " + s);
      if (buf.length > MAXL) buf.splice(0, buf.length - MAXL);
    } catch (e) {}
    _ich = false;
  }
  console.warn  = function () { push("W", [...arguments]); orig.warn(...arguments); };
  console.error = function () { push("E", [...arguments]); orig.error(...arguments); };
  window._qqYoz = m => push("I", [m]);    // muhim voqealarni qo'lda yozish
})();

// ═══ ✅ KF-1 (2026-09-06): KATEGORIYA RO'YXATI — Katalog va Ombor
// filtri uchun YAGONA quruvchi (C10: ikki nusxa bo'lmasin). Bo'sh/
// probelli qiymatlar tashlanadi, alifbo tartibida qaytadi.
function toifaRoyxati(ps) {
  const s = new Set();
  (ps || []).forEach(p => {
    const c = String(p.category || "").trim();
    if (c) s.add(c);
  });
  return [...s].sort((a, b) => a.localeCompare(b, "uz"));
}

