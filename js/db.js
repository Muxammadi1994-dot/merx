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
  const pick = (k, dflt) => {
    if (per[k] !== undefined) return per[k];
    if (c[k]   !== undefined) return c[k];
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
    showStaff:       pick("showStaff", true) !== false,
    showDebtHistory: pick("showDebtHistory", true) !== false,
    // Tipografiya (2-bosqich, 2026-07-18)
    fontScale:   pick("fontScale", "normal"),   // small|normal|large|xlarge yoki son
    fontFamily:  pick("fontFamily", "dm"),      // dm|sans|serif|mono
    footerItalic: pick("footerItalic", true) !== false,
    footerBold:   pick("footerBold", false) === true,
    unifiedSotuv: pick("unifiedSotuv", false) === true, // 2026-07-18: yangi sotuv cheki (test)
    extraLines: pick("extraLines", null),
    fonts:      pick("fonts", null), // kelajak: blok-darajali
    _type: type || "sotuv"
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

let _saveFailAt = 0;
function saveDB() {
  const key = getDBKEY();
  try { localStorage.setItem(key, JSON.stringify(db)); }
  catch(e) {
    // XAVFLI HOLAT: brauzer xotirasi to'ldi yoki yozib bo'lmadi.
    // Ma'lumot faqat operativ xotirada — brauzer yopilsa yo'qoladi.
    // Bulutga yuborish (quyidagi scheduleCloudSync) baribir ishlaydi,
    // shuning uchun asosiy himoya — foydalanuvchini OCHIQ ogohlantirish.
    mem = db;
    console.error("❌ localStorage saqlash xatosi:", e.message);
    if (Date.now() - _saveFailAt > 60000 && typeof toast === "function") {
      _saveFailAt = Date.now();
      toast("⚠️ DIQQAT: qurilma xotirasi to'ldi! Ma'lumot faqat bulutga saqlanmoqda — internetni uzmang va MERX ni yopishdan oldin sinxronlanishini kuting", "err");
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
    shop:     { name:"MERX Do'koni", type:"ikki" },
    settings: {
      rate: 12800, priceCurrency: "uzs",
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

