// ================================================
// MERX — js/db.js
// Ma'lumotlar qatlami: constants, seed, load/save
// ================================================

const CATS = {
  oyoq: ["Krossovka","Botinka","Tufli","Sandal","Shippak","Sport"],
  kiyim: ["Ko'ylak","Shim","Kurtka","Futbolka","Sviter","Ko'ylak (ayol)","Shorts"]
};
const SIZES = {
  oyoq: ["35","36","37","38","39","40","41","42","43","44","45","46"],
  kiyim: ["XS","S","M","L","XL","XXL"]
};
const PAYTYPES = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma" };
const EXP_CATS = ["Ijara","Maosh","Transport","Kommunal","Reklama","Yetkazuvchi","Boshqa"];

const DBKEY = "merx_v3";
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

function seedDB() {
  const t = today();
  return {
    shop: { name: "MERX Do'koni #1", type: "ikki" },
    settings: { rate: 12800, priceCurrency: "uzs" },
    customers: [
      { id:1, name:"Sardor Toshmatov",  phone:"+998 90 123 45 67", type:"chakana", note:"Chilonzor bozori" },
      { id:2, name:"Nilufar Xasanova",  phone:"+998 91 234 56 78", type:"chakana", note:"Yunusobod" },
      { id:3, name:"Bobur Rahimov",     phone:"+998 93 345 67 89", type:"ulgurji", note:"Ulgurji xaridor" }
    ],
    products: [
      { sku:"SHOE-001", name:"Krossovka Runner Pro", category:"Krossovka", type:"oyoq", unit:"juft", inBox:1,
        costUsd:28, priceUzs:520000, ulgurjiNarx:460000,
        variants:[{color:"Oq",size:"41",qty:8},{color:"Oq",size:"42",qty:5},{color:"Qora",size:"41",qty:10},{color:"Qora",size:"42",qty:7},{color:"Qora",size:"43",qty:3}] },
      { sku:"SHOE-002", name:"Klassik botinka", category:"Botinka", type:"oyoq", unit:"juft", inBox:1,
        costUsd:42, priceUzs:780000, ulgurjiNarx:700000,
        variants:[{color:"Qora",size:"42",qty:6},{color:"Qora",size:"43",qty:4},{color:"Jigarrang",size:"42",qty:5}] },
      { sku:"CLTH-001", name:"Erkaklar ko'ylagi slim", category:"Ko'ylak", type:"kiyim", unit:"dona", inBox:12,
        costUsd:16, priceUzs:290000, ulgurjiNarx:250000,
        variants:[{color:"Oq",size:"M",qty:15},{color:"Oq",size:"L",qty:10},{color:"Ko'k",size:"M",qty:12},{color:"Qora",size:"M",qty:9}] },
      { sku:"CLTH-002", name:"Ayollar bluzkasi", category:"Ko'ylak (ayol)", type:"kiyim", unit:"dona", inBox:10,
        costUsd:22, priceUzs:420000, ulgurjiNarx:370000,
        variants:[{color:"Oq",size:"S",qty:8},{color:"Oq",size:"M",qty:10},{color:"Pushti",size:"S",qty:6}] }
    ],
    sales: [
      { id:1, date:addDays(t,-5), time:"10:30", priceType:"chakana", payType:"naqd", staffId:null,
        items:[{name:"Krossovka Runner Pro",variant:"Oq / 41",qty:2,price:520000,unit:"juft"}],
        total:1040000, paid:1040000, remaining:0, due:"", customerName:"Sardor Toshmatov", customerPhone:"+998 90 123 45 67", status:"tolandan" },
      { id:2, date:addDays(t,-3), time:"14:15", priceType:"ulgurji", payType:"otkazma", staffId:null,
        items:[{name:"Erkaklar ko'ylagi slim",variant:"Ko'k / M",qty:12,price:250000,unit:"dona"}],
        total:3000000, paid:3000000, remaining:0, due:"", customerName:"Bobur Rahimov", customerPhone:"+998 93 345 67 89", status:"tolandan" },
      { id:3, date:addDays(t,-1), time:"11:00", priceType:"chakana", payType:"karta", staffId:null,
        items:[{name:"Klassik botinka",variant:"Qora / 42",qty:1,price:780000,unit:"juft"}],
        total:780000, paid:300000, remaining:480000, due:addDays(t,14),
        customerName:"Nilufar Xasanova", customerPhone:"+998 91 234 56 78", status:"qarz" },
      { id:4, date:t, time:"09:20", priceType:"ulgurji", payType:"naqd", staffId:null,
        items:[{name:"Erkaklar ko'ylagi slim",variant:"Oq / L",qty:5,price:250000,unit:"dona"},{name:"Ayollar bluzkasi",variant:"Oq / M",qty:5,price:370000,unit:"dona"}],
        total:3100000, paid:1000000, remaining:2100000, due:addDays(t,7),
        customerName:"Bobur Rahimov", customerPhone:"+998 93 345 67 89", status:"qarz" }
    ],
    ombor: [
      { id:1, date:addDays(t,-15), sku:"SHOE-001", productName:"Krossovka Runner Pro", unit:"juft",
        color:"Qora", size:"41", qty:20, kirimNarxi:335000, chakana:520000, ulgurji:460000,
        supplier:"Aziz Trade", partiya:"2025-05-15", payStatus:"tolandan" },
      { id:2, date:addDays(t,-10), sku:"CLTH-001", productName:"Erkaklar ko'ylagi slim", unit:"dona",
        color:"Oq", size:"M", qty:30, kirimNarxi:195000, chakana:290000, ulgurji:250000,
        supplier:"Tekstil Savdo", partiya:"2025-05-20", payStatus:"qarz" }
    ],
    staff: [
      { id:1, name:"Aziz Karimov",    phone:"+998 90 111 22 33", role:"kassir" },
      { id:2, name:"Malika Yusupova", phone:"+998 91 222 33 44", role:"menejer" }
    ],
    xarajatlar: [],
    seq: 10
  };
}
