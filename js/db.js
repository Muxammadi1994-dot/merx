// MERX db.js | v3.0 | Multi-tenant
// ================================================

const CATS = {
  oyoq:  ["Krossovka","Botinka","Tufli","Sandal","Shippak","Sport","Mahsi","Chelsi"],
  kiyim: ["Ko'ylak","Shim","Kurtka","Futbolka","Sviter","Ko'ylak (ayol)","Shorts","Palto"]
};
const SIZES = {
  oyoq:  ["35","36","37","38","39","40","41","42","43","44","45","46"],
  kiyim: ["XS","S","M","L","XL","XXL","3XL"]
};
const SIZES_DEFAULT_RANGE = {
  oyoq:  { from:"39", to:"44" },
  kiyim: { from:"S",  to:"XL" }
};
const PACK_UNITS = {
  oyoq:  ["karobka","pochka","quti"],
  kiyim: ["karobka","bog'lam","quti","paket"]
};
// ── №11a (v156): BIRLIK TEGLARI — sozlamalarda saqlanadi, sinxronlanadi ──
// Admin (egasi) Sozlamalarda qo'sha/o'chira oladi. "juft" ATAYLAB yo'q —
// standart "dona". Barcha kiritish oqimlari (qo'lda, tahrir, Excel, AI)
// FAQAT shu ikkala funksiyadan o'qiydi.
const UNIT_TAGS_DEFAULT = ["dona","quti","paket"];
const PACK_TAGS_DEFAULT = ["pochka","karobka","quti","bog'lam","paket"];
// ═══════════════════════════════════════════════════════════
// CHEK KONSTRUKTORI — POYDEVOR (2026-07-18, 1-bosqich)
// Barcha cheklar (sotuv/qarz/savat/bot) chek sozlamalarini SHU YAGONA
// funksiyadan oladi. Kelajak bosqichlarda yangi maydonlar (shrift, blok
// sozlamalari, chek-turi ustunlari) FAQAT shu yerga qo'shiladi — 4 joyni
// alohida tahrirlash kerak bo'lmaydi (regressiya manbai shu edi).
//
// `type` — chek turi: "sotuv" | "qarz" | "savat" | "bot".
// Umumiy sozlama hammaga; agar cfg.perType[type] bo'lsa — u USTUN turadi
// (admin shu chek turi uchun farqni qo'shsa). Hozircha perType bo'sh —
// ko'rinish 100% avvalgidek (bu bosqich faqat birlashtirish).
// ═══════════════════════════════════════════════════════════
function getChekCfg(type) {
  const c = (typeof db !== "undefined" && db.settings && db.settings.chekConfig) || {};
  const per = (c.perType && type && c.perType[type]) ? c.perType[type] : {};
  // ══ USLUB SOZLAMALARI (2026-08-12) ═════════════════════
  // Har uslub o'z sozlamasiga ega bo'lishi (egasining talabi). Qatlam
  // tartibi: BO'LIM (perType) → USLUB (perStyle) → UMUMIY (c) → standart.
  // perStyle bo'sh bo'lsa — hech narsa o'zgarmaydi (umumiy sozlama
  // ishlaydi), ya'ni mavjud do'konlarga ta'sir yo'q.
  const _styKey = (type === "qarz")  ? "qarzStyle"
                : (type === "tarix") ? "tarixStyle"
                : "posStyle";
  const _sty = (c.styleV2 ? (c[_styKey] || "unified") : "unified");
  const perS = (c.perStyle && c.perStyle[_sty]) ? c.perStyle[_sty] : {};
  const pick = (k, dflt) => {
    if (per[k]  !== undefined) return per[k];
    if (perS[k] !== undefined) return perS[k];
    if (c[k]    !== undefined) return c[k];
    return dflt;
  };
  return {
    // Umumiy
    logo:       pick("logo", ""),
    shopName:   pick("shopName", (typeof db !== "undefined" && db.shop && db.shop.name) || "MERX"),
    addr:       pick("addr", ""),
    tagline:    pick("tagline", "Ulgurji savdo tizimi"),
    footer:     pick("footer", "Rahmat! Yana kutamiz 🙏"),
    paperWidth: parseInt(pick("paperWidth", 72)) || 72,
    // Telefonlar: bitta "contact" (vergulli) YOKI "phones" massivi — ikkalasi
    // ham qo'llab-quvvatlanadi (eski konfig buzilmaydi)
    contact:    (() => {
      const ph = pick("phones", null);
      if (Array.isArray(ph) && ph.length) return ph.filter(Boolean).join(", ");
      return pick("contact", "");
    })(),
    // Ko'rsatish bayroqlari
    showContact:     pick("showContact", true) !== false,
    // ✅ 2026-08-14: bu sozlamalar USLUB darajasida (past blok)
    dualCurrency:    pick("dualCurrency", true) !== false,
    showDebtHistory: pick("showDebtHistory", true) !== false,
    extraLines:      pick("extraLines", []),
    showStaff:       pick("showStaff", true) !== false,
    showDebtHistory: pick("showDebtHistory", true) !== false,
    // Tipografiya (2-bosqich, 2026-07-18)
    fontScale:   pick("fontScale", "normal"),   // small|normal|large|xlarge yoki son
    fontFamily:  pick("fontFamily", "dm"),      // dm|sans|serif|mono
    footerItalic: pick("footerItalic", true) !== false,
    footerBold:   pick("footerBold", false) === true,
    unifiedSotuv: pick("unifiedSotuv", false) === true, // 2026-07-18: yangi sotuv cheki (test)
    extraLines: pick("extraLines", null),
    fonts:      pick("fonts", null),
    blocks:     pick("blocks", null), // 2026-07-18 (Qadam D): blok-darajali sozlamalar
    headerStyle: pick("headerStyle", "dark"), // 2026-07-18: banner fon (dark/light/none)
    // \U0001f534 2026-08-15 ILDIZ-TUZATISH: bu kalitlar YO'Q edi.
    // POS `cfg.styleV2 ? cfg.posStyle : "unified"` deb so'raydi \u2014
    // ikkalasi `undefined` bo'lgani uchun HAR DOIM "unified" chiqardi.
    // Egasi Jadvalni tanlab saqlasa ham (bazada `posStyle:"table"`)
    // sotuvda Yagona chek chiqardi \u2014 jonli isbot, 15-avgust.
    styleV2:    c.styleV2 === true,
    posStyle:   c.posStyle   || "unified",
    tarixStyle: c.tarixStyle || "unified",
    qarzStyle:  c.qarzStyle  || "unified",
    _type: type || "sotuv",
    _style: _sty
  };
}

function getUnitTags() {
  const t = db.settings && Array.isArray(db.settings.unitTags) ? db.settings.unitTags : null;
  return (t && t.length) ? t : UNIT_TAGS_DEFAULT.slice();
}
function getPackUnitTags() {
  const t = db.settings && Array.isArray(db.settings.packUnitTags) ? db.settings.packUnitTags : null;
  return (t && t.length) ? t : PACK_TAGS_DEFAULT.slice();
}
// Ro'yxatda yo'q birlik (Excel/AI'dan kelgan) — "dona"ga tushadi
function normalizeUnit(u) {
  u = (u || "").trim().toLowerCase();
  return getUnitTags().includes(u) ? u : "dona";
}
const PAYTYPES = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash", qarz:"Nasiya" };
const EXP_CATS = ["Ijara","Maosh","Transport","Kommunal","Reklama","Yetkazuvchi","Soliq","Jihozlar","Boshqa"];

const PANTONE_COLORS = [
  { code:"PMS Black C",  name:"Qora",        hex:"#1A1A1A" },
  { code:"PMS White",    name:"Oq",          hex:"#F5F5F5" },
  { code:"PMS 286 C",    name:"Ko'k",        hex:"#154360" },
  { code:"PMS 485 C",    name:"Qizil",       hex:"#C0392B" },
  { code:"PMS 7547 C",   name:"To'q kulrang",hex:"#2C3E50" },
  { code:"PMS 428 C",    name:"Kulrang",     hex:"#95A5A6" },
  { code:"PMS 7509 C",   name:"Jigarrang",   hex:"#784212" },
  { code:"PMS 7548 C",   name:"Sariq",       hex:"#D4AC0D" },
  { code:"PMS 354 C",    name:"Yashil",      hex:"#1E8449" },
  { code:"PMS 2593 C",   name:"Binafsha",    hex:"#7D3C98" },
  { code:"PMS 1635 C",   name:"To'q sariq",  hex:"#CA6F1E" },
  { code:"PMS 812 C",    name:"Pushti",      hex:"#E91E8C" },
  { code:"PMS 298 C",    name:"Moviy",       hex:"#5DADE2" },
  { code:"PMS 7527 C",   name:"Krem",        hex:"#F0E6D3" },
  { code:"Custom",       name:"Boshqa",      hex:"#888888" }
];

const BOX_PRESETS = {
  "39-44 (8 juft)":  {"39":1,"40":1,"41":2,"42":2,"43":1,"44":1},
  "40-46 (9 juft)":  {"40":1,"41":1,"42":2,"43":2,"44":1,"45":1,"46":1},
  "36-40 (8 juft)":  {"36":1,"37":2,"38":2,"39":2,"40":1},
  "36-41 (10 juft)": {"36":1,"37":2,"38":2,"39":2,"40":2,"41":1},
  "S-XL (12 dona)":  {"S":2,"M":4,"L":4,"XL":2},
  "S-XXL (12 dona)": {"S":2,"M":3,"L":4,"XL":2,"XXL":1}
};

// ── Session dan shopId va dbKey ───────────────────
function getSession() {
  try { return JSON.parse(localStorage.getItem("merx_auth_v1") || "null"); }
  catch(e) { return null; }
}

function getShopId() {
  const s = getSession();
  if (s?.shopId && s.shopId !== "local") return s.shopId;
  const urlShop = new URLSearchParams(location.search).get("shop");
  if (urlShop) return urlShop;
  return "local";
}

function getDBKEY() {
  const s = getSession();
  // dbKey session da saqlangan bo'lsa — to'g'ridan ishlatamiz
  if (s?.dbKey) return s.dbKey;
  const shopId = getShopId();
  return shopId === "local" ? "merx_v5" : "merx_v5_" + shopId;
}

const DBKEY = "merx_v5"; // eski moslik uchun
let mem = null;
let db;

function loadDB() {
  try {
    const key = getDBKEY();
    const r = localStorage.getItem(key);
    if (r) return JSON.parse(r);
    // 4-BOSQICH: legacy "merx_v5" (eski yagona-do'kon davri) o'qishi
    // olib tashlandi — toza holatni har doim bulutdagi pull to'ldiradi.
    return null;
  } catch(e) { return mem; }
}


// ══════════════════════════════════════════════════════════════
// OG'IR JADVALLAR — IndexedDB (2026-07-31, 2-bosqich)
// ══════════════════════════════════════════════════════════════
// MUAMMO: butun baza localStorage'da BITTA JSON edi. Brauzer
// chegarasi ~5 MB. Sotuv tarixi vaqt o'tgani sari cheksiz o'sadi —
// 8 oylik tarix 4,74 MB egallab ilova qotib qoldi.
//
// YECHIM: vaqt bo'yicha CHEKSIZ o'sadigan jadvallar IndexedDB'ga
// ko'chirildi. U yuzlab MB ko'taradi va har o'zgarishda butun
// bazani qayta yozmaydi — shuning uchun tez.
//
// ⚠️ ATAYLAB CHEKLANGAN QAMROV: kirish/do'kon almashtirish yo'liga
// (auth.js) TEGILMADI. Tovarlar, mijozlar, sozlamalar avvalgidek
// localStorage'da — ular biznes hajmi bilan cheklangan va POS'da
// darhol kerak. Og'irlik esa sotuvlarda edi.
//
// XAVFSIZLIK QOIDALARI:
//  1. IndexedDB ochilmasa — hech narsa o'zgarmaydi, eski yo'l ishlaydi
//  2. Ma'lumot localStorage'dan O'CHIRILMAYDI, toki IndexedDB'ga
//     yozilib, QAYTA O'QIB tasdiqlanmaguncha
//  3. Har yozuvdan keyin natija tekshiriladi
//  4. USE_IDB = false qilinsa — bir zumda eski holatga qaytadi
const USE_IDB = true;
const IDB_NAME = "merx_heavy", IDB_STORE = "heavy", IDB_VER = 1;
// Vaqt bo'yicha cheksiz o'sadigan jadvallar
// 2026-07-31: TOVARLAR va MIJOZLAR ham qo'shildi.
// Sabab: ba'zi do'konlarda 10 000+ tovar bo'lishi mumkin (bir kelishda
// 5 000 tagacha). 10 000 tovar localStorage'da ~4 MB — chegaraga urilardi.
// Endi localStorage'da faqat sozlamalar qoladi va u HECH QACHON to'lmaydi.
const IDB_TABLES = ["sales", "xarajatlar", "debtPayments", "ombor", "chiqimlar",
                    "products", "customers"];

// Og'ir jadvallar yuklanganini bildiradi. Bulutga YOZISH shu bayroqsiz
// boshlanmaydi — aks holda hali yuklanmagan (bo'sh) tovarlar ro'yxati
// bulutga yozilib, ma'lumot o'chib ketishi mumkin edi.
window._heavyHydrated = false;
// ⚠️ 2026-08-09: TOVARLAR ALOHIDA BAYROQ BILAN ERTAROQ OCHILADI.
// Skanerga faqat `products` kerak, lekin u ro'yxatda OLTINCHI turardi —
// birinchi skan butun yillik sotuvlar tarixi (eng katta jadval!)
// o'qib bo'linishini kutardi. ABU SAXIY'dagi "birinchisini topishda
// kutish bor, keyingilari tez" holatining asosiy ildizi shu edi.
// Android telefonlarda sezilmasligi sababi: PWA xotirada tirik qoladi
// va qayta ochilganda hydratsiya UMUMAN qayta yurmaydi; kompyuterda
// esa brauzer har tong yangidan yuklanadi.
window._productsHydrated = false;

let _idb = null, _idbOk = false, _idbVerified = false;

function idbOpen() {
  if (!USE_IDB || !window.indexedDB) return Promise.resolve(null);
  if (_idb) return Promise.resolve(_idb);
  return new Promise(res => {
    try {
      const rq = indexedDB.open(IDB_NAME, IDB_VER);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        if (!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE);
      };
      rq.onsuccess = () => { _idb = rq.result; _idbOk = true; res(_idb); };
      rq.onerror   = () => { console.warn("IndexedDB ochilmadi — localStorage'da davom etamiz");
        try { window._qqHodisa && window._qqHodisa("idb_ochilmadi", String(rq.error || "")); } catch (e9) {}
        res(null); };   // ✅ XD-3
      rq.onblocked = () => res(null);
    } catch(e) { res(null); }
  });
}

function idbPut(key, val) {
  return idbOpen().then(d => new Promise(res => {
    if (!d) return res(false);
    try {
      const tx = d.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = () => res(true);
      // ✅ XD-4c (2026-09-10): xato NOMI saqlanadi — avval jimgina
      // yutilardi, qora quti "idb_yozmadi" ni sababsiz yuborardi.
      tx.onerror    = () => { try { window._idbXato = String((tx.error && (tx.error.name + ": " + tx.error.message)) || "tx.onerror"); } catch (e9) {} res(false); };
      tx.onabort    = () => { try { window._idbXato = String((tx.error && (tx.error.name + ": " + tx.error.message)) || "tx.onabort"); } catch (e9) {} res(false); };
    } catch(e) { try { window._idbXato = String((e && (e.name + ": " + e.message)) || e || "put-exception"); } catch (e9) {} res(false); }
  }));
}

function idbGet(key) {
  return idbOpen().then(d => new Promise(res => {
    if (!d) return res(undefined);
    try {
      const rq = d.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
      rq.onsuccess = () => res(rq.result);
      rq.onerror   = () => res(undefined);
    } catch(e) { res(undefined); }
  }));
}

const _idbKey = t => getDBKEY() + "::" + t;

// ── Og'ir jadvallarni IndexedDB'dan yuklash ──
// init() va kirishdan keyin chaqiriladi. localStorage'da bu jadvallar
// bo'lsa (birinchi marta yoki eski qurilma) — ular USTUN, chunki
// hali ko'chirilmagan bo'lishi mumkin.
async function hydrateHeavy() {
  if (!USE_IDB) { window._productsHydrated = true; window._heavyHydrated = true; return false; }
  const d = await idbOpen();
  if (!d) { window._productsHydrated = true; window._heavyHydrated = true; return false; }   // eski yo'l ishlaydi
  let loaded = 0;
  // ⚠️ 2026-08-09: `products` BIRINCHI o'qiladi (skaner faqat shunga
  // muhtoj) va o'qib bo'linishi bilan _productsHydrated ochiladi —
  // qolgan og'ir jadvallar (yillik sotuvlar!) fonda davom etaveradi.
  const order = ["products", ...IDB_TABLES.filter(t => t !== "products")];
  for (const t of order) {
    try {
      const v = await idbGet(_idbKey(t));
      if (Array.isArray(v)) {
        // localStorage'da ham bor va u BO'SH EMAS bo'lsa — hali
        // ko'chirilmagan, uni yo'qotmaymiz
        const cur = db[t];
        if (Array.isArray(cur) && cur.length > v.length) { /* pastdagi bayroqqa tushamiz */ }
        else { db[t] = v; loaded += v.length; }
      }
    } catch(e) {}
    if (t === "products") {
      window._productsHydrated = true;   // skaner yo'li shu zahoti ochiq
      // Navbatda kutayotgan skan bo'lsa — uni kuzatuvchi interval
      // (pos.js) 250 ms ichida o'zi ushlab ishlaydi.
    }
  }
  if (loaded) console.log("💾 IndexedDB'dan yuklandi:", loaded, "yozuv");
  // Ko'chirilmagan bo'lsa — hozir ko'chiramiz
  await migrateHeavyToIdb();
  window._heavyHydrated = true;      // endi bulutga yozish mumkin
  return true;
}

// ── Bir martalik ko'chirish (tasdiqlash bilan) ──
async function migrateHeavyToIdb() {
  if (!USE_IDB || _idbVerified) return;
  let ok = true, moved = 0, _mSabab = "";
  for (const t of IDB_TABLES) {
    const arr = Array.isArray(db[t]) ? db[t] : [];
    const w = await idbPut(_idbKey(t), arr);
    if (!w) { ok = false; _mSabab = t + " · " + (window._idbXato || "yozuv"); break; }
    // TASDIQLASH: qayta o'qib, uzunligi mos kelishini tekshiramiz
    const back = await idbGet(_idbKey(t));
    if (!Array.isArray(back) || back.length !== arr.length) { ok = false; _mSabab = t + " · tasdiq mos kelmadi"; break; }
    moved += arr.length;
  }
  if (!ok) {
    console.warn("⚠️ IndexedDB tasdiqlanmadi — localStorage'da davom etamiz");
    try { window._qqHodisa && window._qqHodisa("idb_tasdiqlanmadi", _mSabab); } catch (e9) {}   // ✅ XD-3 + XD-4c
    _idbVerified = false;
    return;
  }
  _idbVerified = true;   // shundan keyingina localStorage yengillashadi
  console.log("✅ Og'ir jadvallar IndexedDB'ga ko'chdi:", moved, "yozuv");
  try { saveDB(); } catch(e) {}   // localStorage'ni yengil holatda qayta yozamiz
}

// ── Kechiktirilgan yozish ──
let _idbTimer = null, _idbDirty = false;
function scheduleHeavySave() {
  if (!USE_IDB || !_idbVerified) return;
  _idbDirty = true;
  clearTimeout(_idbTimer);
  _idbTimer = setTimeout(flushHeavy, 200);
}

async function flushHeavy() {
  if (!USE_IDB || !_idbVerified || !_idbDirty) return;
  _idbDirty = false;
  for (const t of IDB_TABLES) {
    const arr = Array.isArray(db[t]) ? db[t] : [];
    const ok = await idbPut(_idbKey(t), arr);
    if (!ok) {
      // Yozib bo'lmadi — localStorage'ga qaytamiz, ma'lumot yo'qolmasin
      console.error("❌ IndexedDB yozmadi — localStorage'ga qaytildi");
      try { window._qqHodisa && window._qqHodisa("idb_yozmadi",
        t + " · " + (window._idbXato || "")); } catch (e9) {}   // ✅ XD-3 + XD-4c: qaysi jadval, qanday xato
      _idbVerified = false;
      try { saveDB(); } catch(e) {}
      return;
    }
  }
}

// Sahifa yopilishida yoki fonga o'tganda darhol yozamiz
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { try { flushHeavy(); } catch(e) {} }
});
window.addEventListener("beforeunload", () => { try { flushHeavy(); } catch(e) {} });

let _saveFailAt = 0;

// localStorage uchun: og'ir jadvallar TASDIQLANGANDAN keyin chiqarib
// tashlanadi (ular IndexedDB'da). Tasdiqlanmaguncha — avvalgidek
// hammasi yoziladi, ya'ni ma'lumot hech qachon ikki joydan ham
// yo'qolmaydi.
function _dbForLocal() {
  if (!USE_IDB || !_idbVerified) return db;
  const light = {};
  for (const k in db) if (!IDB_TABLES.includes(k)) light[k] = db[k];
  IDB_TABLES.forEach(t => { light[t] = []; });   // tuzilma buzilmasin
  light._heavyInIdb = true;
  return light;
}

function saveDB() {
  const key = getDBKEY();
  // 2026-07-31: LOKAL O'ZGARISH HISOBLAGICHI.
  // Delta sinxron buni ishlatadi: so'rov yuborishdan oldin va javobni
  // qo'llashdan OLDIN solishtiriladi. Oraliqda biror narsa o'zgargan
  // bo'lsa — bulut nusxasi QO'LLANMAYDI. Shu bilan "telefonda qo'yilgan
  // rasm yo'qolishi" kabi holat imkonsiz bo'ladi.
  try { window._dbMutSeq = (window._dbMutSeq || 0) + 1; } catch(e) {}
  scheduleHeavySave();
  // ⚠️ 2026-08-08: RASMLAR localStorage'GA UMUMAN YOZILMAYDI.
  // Avval saveDB() har safar rasmlar bilan yozishga urinardi va
  // faqat SIG'MAGACH ularsiz qayta yozardi. Katta do'konda (ABU
  // SAXIY: 895 tovar) bu har saqlashda ~5 MB chegarani urish, keyin
  // ikki bosqichli qutqaruv va foydalanuvchiga qo'rqinchli
  // ogohlantirish demakdi — jonli holatda ko'rildi.
  // Rasmlar Supabase Storage'da saqlanadi (§6) va bulutdan
  // yuklanadi, ya'ni ularni qurilma xotirasida saqlashning ma'nosi
  // yo'q. Endi ular boshidanoq chiqarib tashlanadi: saqlash tez,
  // xotira bosimi yo'qoladi, rasmlar avvalgidek ko'rinaveradi.
  const _noImg = (k, v) =>
    (k === "image" || k === "colorImages" || k === "photo") ? undefined : v;
  try { localStorage.setItem(key, JSON.stringify(_dbForLocal(), _noImg)); }
  catch(e) {
    // 2026-07-20: XOTIRA TO'LSA — AVTOMAT TIKLANISH (localStorage deyarli
    // hech qachon to'lmaydi). Ikki bosqichli qutqaruv:
    console.warn("localStorage to'ldi — avtomat tozalash boshlandi:", e.message);

    // 1-BOSQICH: begona/eski zaxira kalitlarini tozalab, joy bo'shatamiz
    try {
      // ✅ XD-4b/4c (2026-09-10): tozalagich TO'G'RI manzillarga qaratildi.
      // Jonli isbot (CI/DZ/GT/GU/UC qora qutilari): XD-2 dagi qoida
      // `merx_db_` prefiksiga otilgan edi — ilova esa bazani `merx_v5_`
      // nomi bilan saqlaydi (166-qator), ya'ni u qoida hech narsani
      // supurmasdi. Endi: begona-do'kon bazalari (merx_v5_*), egasiz
      // sinxron izi (merx_pushfp_*_x — kirishdan oldin yozilgan chiqindi,
      // CI/DZ da 97-124K!), begona-do'kon pushfp/txcache izlari ham
      // supuriladi. Joriy do'kon kalitlari va sessiyaga TEGILMAYDI.
      const sid = key.replace(/^merx_v5_?/, "");   // joriy do'kon belgisi ("" = local rejim)
      Object.keys(localStorage).forEach(k => {
        let sup = false;
        if (k.startsWith("merx_lbak_")) sup = true;
        else if (k.startsWith("merx_db_") && k !== key) sup = true;
        else if (sid && k.startsWith("merx_v5_") && k !== key) sup = true;
        else if (k.startsWith("merx_pushfp_") && k.endsWith("_x")) sup = true;
        else if (sid && (k.startsWith("merx_pushfp_") || k.startsWith("merx_txcache_"))
                 && k.indexOf("shop_") >= 0 && k.indexOf(sid) < 0) sup = true;
        else if (!k.startsWith("merx_") && !k.startsWith("supabase") && !k.startsWith("sb-")) sup = true;
        if (sup) { try { localStorage.removeItem(k); } catch(e2) {} }
      });
      // ✅ XD-4b: yozishdan OLDIN eski nusxa olib tashlanadi — Safari
      // yozish payti eski+yangi ni birga sanashi mumkin (cho'qqi yuk).
      // RAM'da to'liq nusxa turibdi, bulut esa haqiqat manbai (3.23).
      try { localStorage.removeItem(key); } catch(e2) {}
      localStorage.setItem(key, JSON.stringify(_dbForLocal(), _noImg)); // qayta urinish
      console.log("✅ Xotira tozalandi — ma'lumot saqlandi");
      if (typeof scheduleCloudSync === "function") scheduleCloudSync();
      return;
    } catch(e2) { /* hali to'la — 2-bosqichga */ }

    // 2-BOSQICH: eng eski sotuvlarni lokal keshdan chiqarib joy bo'shatamiz.
    // (Rasmlar allaqachon yozilmaydi — yuqoriga qarang.) Sotuvlar
    // bulutda to'liq saqlanadi, qurilmaga esa oxirgi 365 kun tortiladi
    // (§4.2), shuning uchun bu yerda eskilarini tashlash xavfsiz.
    try {
      // ✅ XD-4b MUHIM TUZATISH: avval `lite = _dbForLocal()` sandiq-buzuq
      // rejimda `db` ning O'ZI edi — pastdagi kesish RAMdagi sotuvlarni HAM
      // 200 taga qisqartirardi. POS qarzni db.sales dan hisoblaydi
      // (pos.js:2537) — iPhone'larda "ba'zi mijozlarda qarz ko'rinmaydi"
      // ning bevosita sababi shu edi. Endi kesish FAQAT NUSXADA; RAM va
      // ekran to'liq qoladi. products/customers ataylab kesilmaydi
      // (skaner va qarz ko'rsatish ularsiz ishlamaydi).
      const lite = Object.assign({}, _dbForLocal());
      ["sales", "debtPayments", "chiqimlar", "xarajatlar", "ombor"].forEach(t9 => {
        if (Array.isArray(lite[t9]) && lite[t9].length > 200) lite[t9] = lite[t9].slice(-200);
      });
      try { window._qqYoz && window._qqYoz("ls trim: tarix 200 (faqat lokal nusxa)"); } catch (e9) {}
      localStorage.setItem(key, JSON.stringify(lite, _noImg));
      console.log("✅ Eski tarix lokal keshdan chiqarildi — ma'lumot saqlandi (bulutda to'liq)");
      if (typeof scheduleCloudSync === "function") scheduleCloudSync();
      return;
    } catch(e3) {
      // Eng oxirgi holat: bunda ham sig'madi (juda kam ehtimol)
      mem = db;
      console.error("❌ localStorage saqlash xatosi:", e3.message);
      if (Date.now() - _saveFailAt > 60000 && typeof toast === "function") {
        _saveFailAt = Date.now();
        // ✅ XD-2: hisobotga ENG KATTA 5 KALIT (nomi:hajmi) ham kiradi —
        // keyingi safar "kim to'ldirgan" savoli darrov yopiladi.
        let _xar = "", _jami = 0, _urin = 0;
        try {
          _xar = Object.keys(localStorage)
            .map(k2 => { const s2 = (localStorage.getItem(k2) || "").length; _jami += s2; return { k: k2, s: s2 }; })
            .sort((a2, b2) => b2.s - a2.s).slice(0, 5)
            .map(x2 => x2.k + ":" + Math.round(x2.s / 1024) + "K").join(" | ");
        } catch (e8) {}
        try { _urin = JSON.stringify(_dbForLocal(), _noImg).length; } catch (e8) {}
        try { window._qqHodisa && window._qqHodisa("ls_toldi",
          ((e3 && e3.message) || "") + " · jami:" + Math.round(_jami / 1024) +
          "K · urinish:" + Math.round(_urin / 1024) + "K · " + _xar); } catch (e9) {}   // ✅ XD-3 + XD-4c
        toast("⚠️ Qurilma xotirasi to'ldi — ma'lumot bulutga saqlanmoqda. " +
              "Internetni uzmang va MERX ni yopishdan oldin sinxron tugashini kuting", "err");
      }
    }
  }
  if (typeof scheduleCloudSync === "function") scheduleCloudSync();
}

// ── EAN-13 ────────────────────────────────────────
// 2026-07-10: bu yerdagi genEAN13 O'CHIRILDI (8-qoida — nom
// to'qnashuvi). Amaldagi yagona nusxa: utils.js (yuklash tartibida
// baribir shu g'olib edi, xatti-harakat O'ZGARMAGAN).

// ── Seed ──────────────────────────────────────────
function seedDB() {
  return {
    // ⚠️ 2026-08-14 (egasining talabi): YANGI qurilmada SOXTA qiymat
    // ko'rsatilmaydi. Avval urug'da "MERX Do'koni" va 12800 turardi —
    // xodim yangi qurilmada kirganda o'sha ko'rinib, haqiqiy kurs deb
    // qabul qilinardi (jonli: admin 12800 ni ko'rib qo'lda to'g'rilagan).
    // Endi bo'sh: bulutdan kelguncha "—" turadi, keyin O'ZI to'ladi.
    shop:     { name:"", type:"ikki" },
    settings: {
      priceCurrency: "uzs",
      supabaseUrl: typeof MERX_SUPABASE_URL !== "undefined" ? MERX_SUPABASE_URL : "",
      supabaseKey: typeof MERX_SUPABASE_KEY !== "undefined" ? MERX_SUPABASE_KEY : "",
      omborCols: {}
    },
    customers:[], suppliers:[], products:[], sales:[],
    ombor:[], staff:[], xarajatlar:[], chiqimlar:[],
    returns:[], debtPayments:[], shifts:[], kassaBalances:{}, seq:1
  };
}

// Global db yuklanishi
db = loadDB() || seedDB();
// Sahifa QAYSI do'kon kaliti bilan yuklangani — login paytida boshqa
// do'konga kirilsa, majburiy reload uchun (aralashishga qarshi qo'riqchi)
window._loadedDbKey = (typeof getDBKEY === "function") ? getDBKEY() : null;

// ── Migratsiya: id'siz mahsulotlarga (eski yozuvlar) id berish ──
// Sabab: Supabase'da products.id ustuni majburiy, lekin ba'zi eski
// yozuvlar (masalan import orqali qo'shilganlar) id'siz qolgan edi —
// shu sababli ular cloud sync'ga umuman yuborilmasdi.
(function migrateProductIds() {
  if (!db.products || !db.products.length) return;
  let changed = false;
  db.products.forEach(p => {
    if (p.id == null) {
      p.id = (db.seq || 1);
      db.seq = (db.seq || 1) + 1;
      changed = true;
    }
  });
  if (changed) saveDB();
})();

