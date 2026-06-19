// MERX db.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/db.js  (v3 — Barqaror, ishlaydigan)
// ================================================

const CATS = {
  oyoq:  ["Krossovka","Botinka","Tufli","Sandal","Shippak","Sport","Mahsi","Chelsi"],
  kiyim: ["Ko'ylak","Shim","Kurtka","Futbolka","Sviter","Ko'ylak (ayol)","Shorts","Palto"]
};
const SIZES = {
  oyoq:  ["35","36","37","38","39","40","41","42","43","44","45","46"],
  kiyim: ["XS","S","M","L","XL","XXL","3XL"]
};
// Standart oraliq — tovar qo'shishda avtomatik tanlanadi
const SIZES_DEFAULT_RANGE = {
  oyoq:  { from:"39", to:"44" },
  kiyim: { from:"S",  to:"XL" }
};
// To'plam birligi (karobka, pochka va h.k.) — tur bo'yicha
const PACK_UNITS = {
  oyoq:  ["karobka","pochka","quti"],
  kiyim: ["karobka","bog'lam","quti","paket"]
};
const PAYTYPES = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma" };
const EXP_CATS = ["Ijara","Maosh","Transport","Kommunal","Reklama","Yetkazuvchi","Boshqa"];

// Pantone rang ro'yxati (UI uchun)
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

// Karobka tarkibi presetlari
const BOX_PRESETS = {
  "39-44 (8 juft)":  {"39":1,"40":1,"41":2,"42":2,"43":1,"44":1},
  "40-46 (9 juft)":  {"40":1,"41":1,"42":2,"43":2,"44":1,"45":1,"46":1},
  "36-40 (8 juft)":  {"36":1,"37":2,"38":2,"39":2,"40":1},
  "36-41 (10 juft)": {"36":1,"37":2,"38":2,"39":2,"40":2,"41":1},
  "S-XL (12 dona)":  {"S":2,"M":4,"L":4,"XL":2},
  "S-XXL (12 dona)": {"S":2,"M":3,"L":4,"XL":2,"XXL":1}
};

const DBKEY = "merx_v5";
let mem = null;
let db;

function loadDB() {
  try { const r = localStorage.getItem(DBKEY); return r ? JSON.parse(r) : null; }
  catch(e) { return mem; }
}

function saveDB() {
  try { localStorage.setItem(DBKEY, JSON.stringify(db)); }
  catch(e) { mem = db; }
  if (typeof scheduleCloudSync === "function") scheduleCloudSync();
}

// ── Yordamchi funksiyalar (utils.js da aniqlangan) ─
// totalStock, debtSales, isOverdue, visProds — utils.js da

// ── EAN-13 ichki barcode generatsiya ──────────
function genEAN13(seq) {
  const body   = "200" + String(seq).padStart(9, "0");
  const digits = body.split("").map(Number);
  let sum = 0;
  digits.forEach((d, i) => { sum += i % 2 === 0 ? d : d * 3; });
  const check = (10 - (sum % 10)) % 10;
  return body + check;
}

// ── Seed ma'lumotlar ───────────────────────────
function seedDB() {
  return {
    shop:     { name:"MERX Do'koni #1", type:"ikki" },
    settings: {
      rate:          12800,
      priceCurrency: "uzs",
      omborCols:     {}
    },
    customers:  [],
    products:   [],
    sales:      [],
    ombor:      [],
    staff:      [],
    xarajatlar: [],
    chiqimlar:  [],
    returns:    [],
    debtPayments: [],
    seq: 1
  };
}
