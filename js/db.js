// ================================================
// MERX — js/db.js  (v2 — Yangi ma'lumotlar modeli)
// ================================================

const CATS = {
  oyoq:  ["Krossovka","Botinka","Tufli","Sandal","Shippak","Sport","Mahsi","Chelsi"],
  kiyim: ["Ko'ylak","Shim","Kurtka","Futbolka","Sviter","Ko'ylak (ayol)","Shorts","Palto"]
};

// Oyoq kiyim razmer standartlari
const SHOE_SIZE_PRESETS = {
  "36-40": ["36","37","38","39","40"],
  "39-44": ["39","40","41","42","43","44"],
  "40-46": ["40","41","42","43","44","45","46"],
  "36-44": ["36","37","38","39","40","41","42","43","44"],
  "35-39": ["35","36","37","38","39"]
};

// Kiyim o'lchamlari
const CLOTHING_SIZES = ["XS","S","M","L","XL","XXL","3XL"];

// Xalqaro Pantone rang standartlari (kiyim-kechak uchun)
const PANTONE_COLORS = [
  { code:"PMS Black C",   name:"Qora",       hex:"#1A1A1A" },
  { code:"PMS White",     name:"Oq",         hex:"#F8F8F8" },
  { code:"PMS 286 C",     name:"Ko'k",       hex:"#154360" },
  { code:"PMS 485 C",     name:"Qizil",      hex:"#C0392B" },
  { code:"PMS 7547 C",    name:"To'q kulrang",hex:"#2C3E50"},
  { code:"PMS 428 C",     name:"Kulrang",    hex:"#95A5A6" },
  { code:"PMS 7509 C",    name:"Jigarrang",  hex:"#784212" },
  { code:"PMS 7548 C",    name:"Sariq",      hex:"#D4AC0D" },
  { code:"PMS 354 C",     name:"Yashil",     hex:"#1E8449" },
  { code:"PMS 2593 C",    name:"Binafsha",   hex:"#7D3C98" },
  { code:"PMS 1635 C",    name:"To'q sariq", hex:"#CA6F1E" },
  { code:"PMS 812 C",     name:"Pushti",     hex:"#E91E8C" },
  { code:"PMS 298 C",     name:"Moviy",      hex:"#5DADE2" },
  { code:"PMS 364 C",     name:"To'q yashil",hex:"#1D6A39" },
  { code:"PMS 7601 C",    name:"Zangori",    hex:"#1A5276" },
  { code:"PMS 7527 C",    name:"Krем",       hex:"#F0E6D3" },
  { code:"PMS 876 C",     name:"Bronza",     hex:"#A04000" },
  { code:"Custom",        name:"Boshqa",     hex:"#888888" }
];

const PAYTYPES = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma" };
const EXP_CATS = ["Ijara","Maosh","Transport","Kommunal","Reklama","Yetkazuvchi","Boshqa"];
const DBKEY    = "merx_v4";  // v3 dan v4 ga o'tish — eski data tozalanadi

let mem = null;
let db;

// ── Yuklab olish / Saqlash ─────────────────────
function loadDB() {
  try {
    const r = localStorage.getItem(DBKEY);
    return r ? JSON.parse(r) : null;
  } catch(e) { return mem; }
}

function saveDB() {
  try { localStorage.setItem(DBKEY, JSON.stringify(db)); }
  catch(e) { mem = db; }
  if (typeof scheduleCloudSync === "function") scheduleCloudSync();
}

// ── Artikul generatsiya ────────────────────────
function genArticul(type, seq, pantoneCode) {
  const prefix  = type === "oyoq" ? "SH" : "CL";
  const num     = String(seq).padStart(4, "0");
  // Pantone kodidan qisqa tag: "PMS 286 C" → "286C"
  const colTag  = pantoneCode
    .replace("PMS ","").replace(" C","").replace(" ","").toUpperCase()
    .substring(0, 5);
  return `MRX-${prefix}${num}-${colTag}`;
}

// ── EAN-13 ichki barcode generatsiya ──────────
// Prefiks 200 = do'kon ichki foydalanish (GS1 standarti)
function genEAN13(productSeq, colorSeq) {
  const body = "200"
    + String(productSeq).padStart(5, "0")
    + String(colorSeq).padStart(4, "0");
  // 12 ta raqam, 13-si — tekshiruv raqami
  const digits = body.split("").map(Number);
  let sum = 0;
  digits.forEach((d, i) => { sum += i % 2 === 0 ? d : d * 3; });
  const check = (10 - (sum % 10)) % 10;
  return body + check;
}

// ── Karobka tarkibidan jami dona hisoblash ─────
function calcBoxTotal(inBox) {
  // inBox: {"39":1, "40":1, "41":2, "42":2, "43":1, "44":1}
  if (!inBox || typeof inBox !== "object") return 1;
  return Object.values(inBox).reduce((a, v) => a + (parseInt(v)||0), 0);
}

// ── Razmer oralig'i matn ───────────────────────
function sizeRange(inBox) {
  if (!inBox || typeof inBox !== "object") return "";
  const sizes = Object.keys(inBox).sort((a,b) => parseFloat(a)-parseFloat(b));
  if (!sizes.length) return "";
  return sizes[0] === sizes[sizes.length-1]
    ? sizes[0]
    : `${sizes[0]}–${sizes[sizes.length-1]}`;
}

// ── Jami dona (mahsulot + rang) ────────────────
function colorTotalDona(product, colorIdx) {
  const c   = product.colors[colorIdx];
  if (!c) return 0;
  const dpp = calcBoxTotal(product.inBox); // dona per box
  return (c.boxes || 0) * dpp;
}

// ── Mahsulot umumiy qoldiq (barcha ranglar) ────
function productTotalDona(product) {
  if (!product.colors) return 0;
  const dpp = calcBoxTotal(product.inBox);
  return product.colors.reduce((a, c) => a + (c.boxes||0) * dpp, 0);
}

// ── totalStock (mavjud funksiya bilan moslik) ──
function totalStock(p) {
  return productTotalDona(p);
}

// ── Seed ma'lumotlar ───────────────────────────
function seedDB() {
  const t = today();

  // Karobka tarkibi namunalari
  const inBox_39_44 = {"39":1,"40":1,"41":2,"42":2,"43":1,"44":1}; // 8 juft
  const inBox_36_40 = {"36":1,"37":2,"38":2,"39":2,"40":1};         // 8 juft
  const inBox_40_46 = {"40":1,"41":1,"42":2,"43":2,"44":1,"45":1,"46":1}; // 9 juft

  const products = [
    {
      sku:       "SHOE-0001",
      articuls:  [], // har rang uchun alohida artikul (colors massivida)
      name:      "Krossovka Runner Pro",
      category:  "Krossovka",
      type:      "oyoq",
      unit:      "juft",
      inBox:     inBox_39_44,       // karobka tarkibi
      costUsd:   28,                // tannarx (dollar)
      priceUzs:  520000,            // chakana narx (barcha ranglar uchun)
      ulgurjiNarx: 460000,
      colors: [
        {
          pantone:  "PMS White",
          name:     "Oq",
          hex:      "#F8F8F8",
          articul:  genArticul("oyoq", 1, "PMS White"),
          barcode:  genEAN13(1, 1),
          boxes:    8               // karobka soni
        },
        {
          pantone:  "PMS Black C",
          name:     "Qora",
          hex:      "#1A1A1A",
          articul:  genArticul("oyoq", 1, "PMS Black C"),
          barcode:  genEAN13(1, 2),
          boxes:    10
        },
        {
          pantone:  "PMS 286 C",
          name:     "Ko'k",
          hex:      "#154360",
          articul:  genArticul("oyoq", 1, "PMS 286 C"),
          barcode:  genEAN13(1, 3),
          boxes:    6
        }
      ]
    },
    {
      sku:       "SHOE-0002",
      name:      "Klassik botinka",
      category:  "Botinka",
      type:      "oyoq",
      unit:      "juft",
      inBox:     inBox_40_46,
      costUsd:   42,
      priceUzs:  780000,
      ulgurjiNarx: 700000,
      colors: [
        {
          pantone:  "PMS Black C",
          name:     "Qora",
          hex:      "#1A1A1A",
          articul:  genArticul("oyoq", 2, "PMS Black C"),
          barcode:  genEAN13(2, 1),
          boxes:    6
        },
        {
          pantone:  "PMS 7509 C",
          name:     "Jigarrang",
          hex:      "#784212",
          articul:  genArticul("oyoq", 2, "PMS 7509 C"),
          barcode:  genEAN13(2, 2),
          boxes:    4
        }
      ]
    },
    {
      sku:       "CLTH-0001",
      name:      "Erkaklar ko'ylagi slim",
      category:  "Ko'ylak",
      type:      "kiyim",
      unit:      "dona",
      inBox:     {"S":2,"M":4,"L":4,"XL":2},  // kiyim karobkasi
      costUsd:   16,
      priceUzs:  290000,
      ulgurjiNarx: 250000,
      colors: [
        {
          pantone:  "PMS White",
          name:     "Oq",
          hex:      "#F8F8F8",
          articul:  genArticul("kiyim", 3, "PMS White"),
          barcode:  genEAN13(3, 1),
          boxes:    15
        },
        {
          pantone:  "PMS 286 C",
          name:     "Ko'k",
          hex:      "#154360",
          articul:  genArticul("kiyim", 3, "PMS 286 C"),
          barcode:  genEAN13(3, 2),
          boxes:    12
        },
        {
          pantone:  "PMS Black C",
          name:     "Qora",
          hex:      "#1A1A1A",
          articul:  genArticul("kiyim", 3, "PMS Black C"),
          barcode:  genEAN13(3, 3),
          boxes:    9
        }
      ]
    },
    {
      sku:       "CLTH-0002",
      name:      "Ayollar bluzkasi",
      category:  "Ko'ylak (ayol)",
      type:      "kiyim",
      unit:      "dona",
      inBox:     {"S":3,"M":4,"L":3},
      costUsd:   22,
      priceUzs:  420000,
      ulgurjiNarx: 370000,
      colors: [
        {
          pantone:  "PMS White",
          name:     "Oq",
          hex:      "#F8F8F8",
          articul:  genArticul("kiyim", 4, "PMS White"),
          barcode:  genEAN13(4, 1),
          boxes:    8
        },
        {
          pantone:  "PMS 812 C",
          name:     "Pushti",
          hex:      "#E91E8C",
          articul:  genArticul("kiyim", 4, "PMS 812 C"),
          barcode:  genEAN13(4, 2),
          boxes:    6
        }
      ]
    }
  ];

  const sales = [
    {
      id:1, date:addDays(t,-5), time:"10:30",
      priceType:"chakana", payType:"naqd", staffId:null,
      customerId:null,
      items:[{
        name:"Krossovka Runner Pro",
        pantone:"PMS White", colorName:"Oq",
        boxes:2, donaDonated:16,
        price:520000, unit:"juft"
      }],
      total:1040000, paid:1040000, remaining:0,
      due:"", customerName:"Sardor Toshmatov",
      customerPhone:"+998 90 123 45 67",
      status:"tolandan",
      debtCurrency:"uzs", debtUsd:null
    },
    {
      id:2, date:addDays(t,-3), time:"14:15",
      priceType:"ulgurji", payType:"otkazma", staffId:null,
      customerId:null,
      items:[{
        name:"Erkaklar ko'ylagi slim",
        pantone:"PMS 286 C", colorName:"Ko'k",
        boxes:3, donaDonated:36,
        price:250000, unit:"dona"
      }],
      total:3000000, paid:3000000, remaining:0,
      due:"", customerName:"Bobur Rahimov",
      customerPhone:"+998 93 345 67 89",
      status:"tolandan",
      debtCurrency:"uzs", debtUsd:null
    },
    {
      id:3, date:addDays(t,-1), time:"11:00",
      priceType:"chakana", payType:"karta", staffId:null,
      customerId:null,
      items:[{
        name:"Klassik botinka",
        pantone:"PMS Black C", colorName:"Qora",
        boxes:1, donaDonated:9,
        price:780000, unit:"juft"
      }],
      total:780000, paid:300000, remaining:480000,
      due:addDays(t,14),
      customerName:"Nilufar Xasanova",
      customerPhone:"+998 91 234 56 78",
      status:"qarz",
      debtCurrency:"uzs", debtUsd:null
    }
  ];

  const ombor = [
    {
      id:1, date:addDays(t,-15),
      sku:"SHOE-0001", productName:"Krossovka Runner Pro",
      pantone:"PMS Black C", colorName:"Qora",
      unit:"juft", boxes:10,
      donaDonated: 10 * calcBoxTotal(inBox_39_44),
      sizeRange:"39–44",
      kirimNarxi: Math.round(28 * 12800),
      chakana:520000, ulgurji:460000,
      supplier:"Aziz Trade", partiya:"2025-05-15",
      payStatus:"tolandan"
    },
    {
      id:2, date:addDays(t,-10),
      sku:"CLTH-0001", productName:"Erkaklar ko'ylagi slim",
      pantone:"PMS White", colorName:"Oq",
      unit:"dona", boxes:15,
      donaDonated: 15 * calcBoxTotal({"S":2,"M":4,"L":4,"XL":2}),
      sizeRange:"S–XL",
      kirimNarxi: Math.round(16 * 12800),
      chakana:290000, ulgurji:250000,
      supplier:"Tekstil Savdo", partiya:"2025-05-20",
      payStatus:"qarz"
    }
  ];

  return {
    shop:     { name:"MERX Do'koni #1", type:"ikki" },
    settings: {
      rate:           12800,
      priceCurrency:  "uzs",
      omborCols:      {}
    },
    customers: [
      { id:1, name:"Sardor Toshmatov",  phone:"+998 90 123 45 67", type:"chakana", note:"" },
      { id:2, name:"Nilufar Xasanova",  phone:"+998 91 234 56 78", type:"chakana", note:"" },
      { id:3, name:"Bobur Rahimov",     phone:"+998 93 345 67 89", type:"ulgurji", note:"Ulgurji xaridor" }
    ],
    products,
    sales,
    ombor,
    staff: [
      { id:1, name:"Aziz Karimov",    phone:"+998 90 111 22 33", role:"kassir" },
      { id:2, name:"Malika Yusupova", phone:"+998 91 222 33 44", role:"menejer" }
    ],
    xarajatlar: [],
    seq: 20
  };
}
