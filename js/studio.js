// ═══════════════════════════════════════════════════════════════
// MERX STUDIO — REKLAMA SHABLON DVIGATELI  |  js/studio.js
// 2026-09-06 · 0-bosqich (kod boshlanishi)
// ═══════════════════════════════════════════════════════════════
// MAQSAD: do'kon tovarni telefonda suratga oladi → ma'lumot
// KATALOGDAN o'zi to'ladi → bir bosishda 4 formatli professional
// reklama chiqadi (Telegram, Instagram post, Stories, kanal).
//
// ME'MORIY QARORLAR (rejadan):
//  1. Shablon = KOD EMAS, RETSEPT (`STU_SHAB` massivi). Dizayner
//     yangi uslub qo'shsa — bitta JSON yozuvi qo'shiladi, chizuvchi
//     kodga TEGILMAYDI. Shuning uchun uslublarni keyin kuchli
//     dizaynerlarga topshirish mumkin.
//  2. Koordinatalar KASR (0..1) — shu tufayli bitta retsept 1:1,
//     4:5, 9:16 va 16:9 da bir xil to'g'ri joylashadi.
//  3. Hamma ish BRAUZERDA (canvas) — server yuki 0, trafik 0.
//  4. Tayyor rasm SAQLANMAYDI (rasm ombori 51% to'lgan) — to'g'ridan
//     yuklab olinadi.
//  5. Tovar rasmiga AI TEGMAYDI (0-bosqichda AI umuman yo'q).
//
// XAVFSIZLIK: bu modul FAQAT O'QIYDI (db.products dan nom/narx/art).
// Bazaga, sotuvga, sinxronga, botga hech narsa yozmaydi.
// ═══════════════════════════════════════════════════════════════

// ── Palitralar (rang to'plamlari) ──────────────────────────────
// a=fon · b=urg'u · c=matn(fon ustida) · d=ikkilamchi matn
const STU_PAL = [
  { id:"navy",  nom:"MERX asosiy", a:"#0D1B2A", b:"#F2A20C", c:"#FFFFFF", d:"#8FA2B3" },
  { id:"qogoz", nom:"Qog'oz",      a:"#EFEDE8", b:"#0D1B2A", c:"#0D1B2A", d:"#6B6355" },
  { id:"amber", nom:"Amber",       a:"#F2A20C", b:"#0D1B2A", c:"#0D1B2A", d:"#7A5A08" },
  { id:"yashil",nom:"To'q yashil", a:"#0F5C52", b:"#E8C547", c:"#FFFFFF", d:"#9BC3BC" },
  { id:"qizil", nom:"Chegirma",    a:"#D62828", b:"#FFFFFF", c:"#FFFFFF", d:"#FFC9C9" },
  { id:"oq",    nom:"Oq (katalog)",a:"#FFFFFF", b:"#0D1B2A", c:"#0D1B2A", d:"#7A828C" },
  { id:"qora",  nom:"Qora-oq",     a:"#1A1A1A", b:"#FFFFFF", c:"#FFFFFF", d:"#9A9A9A" },
  { id:"siyoh", nom:"Klassik",     a:"#1B2A4A", b:"#C9A227", c:"#FFFFFF", d:"#A8B4CC" },
];

// ── Formatlar ──────────────────────────────────────────────────
const STU_FMT = [
  { id:"post",  nom:"Instagram 4:5", w:1080, h:1350 },
  { id:"kv",    nom:"Telegram 1:1",  w:1080, h:1080 },
  { id:"story", nom:"Stories 9:16",  w:1080, h:1920 },
  { id:"gor",   nom:"Kanal 16:9",    w:1920, h:1080 },
];

// ── SHABLON RETSEPTLARI ────────────────────────────────────────
// Qatlam turlari: fon · blok · burchak · rasm · matn · narx ·
//                 belgi · doira · chiziq · logo
// Barcha o'lchamlar KASR: x/y/w/h — kadr eni va bo'yiga nisbatan.
// `o` — shrift o'lchami (kadr ENIga nisbatan).
// `rang` — palitradagi kalit: "a" | "b" | "c" | "d" yoki to'g'ridan hex.
const STU_SHAB = [
  {
    id:"narx", nom:"Katta narx", uchun:"Ulgurji — narx birinchi", kat:["oyoq","kiyim","sumka","umumiy"],
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"matn", manba:"nom", x:.06, y:.055, o:.042, vazn:800, rang:"c", max:.88 },
      { tur:"matn", manba:"tafsilot", x:.06, y:.105, o:.028, vazn:600, rang:"d", max:.88 },
      { tur:"rasm", x:.5, y:.46, w:.80, h:.46, anchor:"center" },
      { tur:"narx", x:.06, y:.90, o:.135, vazn:900, rang:"b" },
      { tur:"belgi", manba:"yorliq", x:.94, y:.055, o:.032, anchor:"right",
        fonRang:"b", matnRang:"a" },
      { tur:"logo", x:.94, y:.965, o:.022, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"lenta", nom:"Yon lenta", uchun:"Kiyim — tovar katta ko'rinadi", kat:["kiyim","umumiy"],
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"blok", x:0, y:0, w:.13, h:1, rang:"b" },
      { tur:"matn", manba:"yorliq", x:.065, y:.5, o:.038, vazn:800, rang:"a",
        anchor:"center", burchak:-90 },
      { tur:"rasm", x:.58, y:.44, w:.72, h:.56, anchor:"center" },
      { tur:"matn", manba:"nom", x:.18, y:.855, o:.040, vazn:800, rang:"c", max:.55 },
      { tur:"matn", manba:"tafsilot", x:.18, y:.905, o:.026, vazn:600, rang:"d", max:.55 },
      { tur:"narx", x:.94, y:.90, o:.058, vazn:900, rang:"c", anchor:"right",
        qopqa:"b", qopqaMatn:"a" },
      { tur:"logo", x:.94, y:.965, o:.022, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"sarlavha", nom:"Sarlavha", uchun:"To'plam va mavsum e'loni", kat:["umumiy","kiyim","oyoq"],
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"matn", manba:"yorliq", x:.06, y:.10, o:.105, vazn:900, rang:"c",
        max:.88, satr:2 },
      { tur:"rasm", x:.5, y:.66, w:.88, h:.52, anchor:"center" },
      { tur:"narx", x:.94, y:.115, o:.050, vazn:900, rang:"a", anchor:"right",
        qopqa:"b", qopqaMatn:"a" },
      { tur:"matn", manba:"nom", x:.06, y:.955, o:.030, vazn:700, rang:"d", max:.7 },
      { tur:"logo", x:.94, y:.965, o:.022, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"burchak", nom:"Diagonal", uchun:"E'lon va narx bir kadrda", kat:["oyoq","umumiy"],
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"burchak", rang:"b", balandlik:.44, qiya:.10 },
      { tur:"matn", manba:"yorliq", x:.06, y:.09, o:.055, vazn:800, rang:"a",
        max:.85, satr:2 },
      { tur:"rasm", x:.5, y:.56, w:.76, h:.44, anchor:"center" },
      { tur:"doira", x:.80, y:.86, r:.13, fonRang:"b", matnRang:"a", manba:"narxQisqa" },
      { tur:"matn", manba:"nom", x:.06, y:.90, o:.034, vazn:800, rang:"c", max:.6 },
      { tur:"matn", manba:"tafsilot", x:.06, y:.94, o:.024, vazn:600, rang:"d", max:.6 },
      { tur:"logo", x:.06, y:.975, o:.022, rang:"d" },
    ],
  },
  {
    id:"katalog", nom:"Katalog", uchun:"Ulgurji xaridor — hamma ma'lumot", kat:["oyoq","kiyim","sumka","umumiy"],
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:.5, y:.40, w:.74, h:.50, anchor:"center" },
      { tur:"matn", manba:"nom", x:.07, y:.735, o:.046, vazn:800, rang:"c",
        max:.86, satr:2 },
      { tur:"matn", manba:"tafsilot", x:.07, y:.815, o:.026, vazn:700, rang:"d", max:.86 },
      { tur:"chiziq", x:.07, y:.845, w:.86, rang:"d" },
      { tur:"narx", x:.07, y:.925, o:.060, vazn:900, rang:"b" },
      { tur:"matn", manba:"yorliq", x:.93, y:.925, o:.026, vazn:700, rang:"d",
        anchor:"right", max:.4 },
      { tur:"logo", x:.93, y:.975, o:.020, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"afisha", nom:"Afisha", kat:["oyoq","sumka","umumiy"],
    uchun:"Naqshli fon, doira maska, muhr-stiker",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:120 },
      { tur:"naqsh", naqsh:"suzani", rang:"c", alfa:.10, zich:.055 },
      { tur:"rasm", x:.5, y:.44, w:.72, h:.50, anchor:"center", maska:"doira" },
      { tur:"ramka", uslub:"burchak", rang:"b", chet:.05, qalin:.005 },
      { tur:"sticker", manba:"yorliq", shakl:"muhr", x:.80, y:.20, r:.115,
        fonRang:"b", matnRang:"a", burchak:-12 },
      { tur:"matn", manba:"nom", x:.5, y:.79, o:.052, vazn:800, rang:"c",
        anchor:"center", max:.82, katta:true },
      { tur:"matn", manba:"tafsilot", x:.5, y:.835, o:.024, vazn:600, rang:"d",
        anchor:"center", max:.8 },
      { tur:"narx", x:.5, y:.93, o:.10, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:.94, y:.975, o:.020, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"kollaj", nom:"Kollaj", kat:["kiyim","sumka","umumiy"],
    uchun:"Ikki tovar bir kadrda, mesh fon",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:.45 },
      { tur:"rasm", x:.36, y:.42, w:.56, h:.48, anchor:"center", maska:"yumaloq", radius:.06 },
      { tur:"rasm2", x:.74, y:.60, w:.36, h:.30, anchor:"center" },
      { tur:"panel", x:.06, y:.80, w:.88, h:.145, rang:"c", alfa:.92, radius:.035 },
      { tur:"matn", manba:"nom", x:.10, y:.855, o:.044, vazn:800, rang:"a", max:.62 },
      { tur:"matn", manba:"tafsilot", x:.10, y:.895, o:.022, vazn:600, rang:"a", max:.62 },
      { tur:"narx", x:.90, y:.885, o:.058, vazn:900, rang:"a", anchor:"right" },
      { tur:"lenta", manba:"yorliq", tomon:"ong", y:.10, en:.34, qalin:.062,
        o:.028, fonRang:"b", matnRang:"a" },
      { tur:"logo", x:.06, y:.975, o:.020, rang:"c" },
    ],
  },
  {
    id:"premium", nom:"Premium", kat:["kiyim","sumka"],
    uchun:"To'q fon, nur, arch maska, ikki chiziqli ramka",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"chiziq", rang:"b", alfa:.07, zich:.06 },
      { tur:"rasm", x:.5, y:.46, w:.66, h:.56, anchor:"center", maska:"arch" },
      { tur:"nur", kuch:.13, siljish:-.15 },
      { tur:"ramka", uslub:"ikki", rang:"b", chet:.035, qalin:.0035, oraliq:.010 },
      { tur:"ikonka", ikona:"yulduz", x:.5, y:.80, r:.026, rang:"b" },
      { tur:"matn", manba:"nom", x:.5, y:.865, o:.048, vazn:800, rang:"c",
        anchor:"center", max:.78, katta:true, soya:true },
      { tur:"narx", x:.5, y:.935, o:.085, vazn:900, rang:"b", anchor:"center" },
      { tur:"textura", alfa:.045, rang:"c" },
      { tur:"logo", x:.94, y:.978, o:.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"kadr", nom:"Kadr", uchun:"Real shaxs — to'liq kadr, pastda yozuv", kat:["real"],
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:.5, y:.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"matn", manba:"nom", x:.06, y:.83, o:.058, vazn:800, rang:"c", max:.86 },
      { tur:"matn", manba:"tafsilot", x:.06, y:.876, o:.026, vazn:600, rang:"d", max:.86 },
      { tur:"narx", x:.06, y:.95, o:.105, vazn:900, rang:"b" },
      { tur:"belgi", manba:"yorliq", x:.94, y:.05, o:.030, anchor:"right",
        fonRang:"b", matnRang:"a" },
      { tur:"logo", x:.94, y:.975, o:.020, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"yonkadr", nom:"Yon yozuv", uchun:"Real shaxs — yon lentali", kat:["real"],
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:.5, y:.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"blok", x:0, y:.72, w:.62, h:.10, rang:"b" },
      { tur:"matn", manba:"nom", x:.04, y:.79, o:.046, vazn:800, rang:"a", max:.55 },
      { tur:"narx", x:.04, y:.90, o:.095, vazn:900, rang:"c" },
      { tur:"matn", manba:"tafsilot", x:.04, y:.945, o:.024, vazn:600, rang:"d", max:.6 },
      { tur:"logo", x:.94, y:.975, o:.020, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"sokin", nom:"Sokin", uchun:"Real shaxs — minimal, faqat narx", kat:["real"],
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:.5, y:.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"matn", manba:"nom", x:.5, y:.09, o:.040, vazn:700, rang:"c",
        anchor:"center", max:.8 },
      { tur:"narx", x:.94, y:.94, o:.075, vazn:900, rang:"a", anchor:"right",
        qopqa:"b", qopqaMatn:"a" },
      { tur:"logo", x:.06, y:.955, o:.020, rang:"d" },
    ],
  },
  {
    id:"model", nom:"Modelda", uchun:"Kiyim — to'liq kadr (modelli surat)", kat:["model"],
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:.5, y:.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"matn", manba:"nom", x:.06, y:.815, o:.055, vazn:800, rang:"c", max:.86 },
      { tur:"matn", manba:"tafsilot", x:.06, y:.862, o:.026, vazn:600, rang:"d", max:.86 },
      { tur:"narx", x:.06, y:.945, o:.105, vazn:900, rang:"b" },
      { tur:"belgi", manba:"yorliq", x:.94, y:.05, o:.030, anchor:"right",
        fonRang:"b", matnRang:"a" },
      { tur:"logo", x:.94, y:.975, o:.020, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"chegirma", nom:"Chegirma", uchun:"Aksiya — eski narx chizilgan", kat:["umumiy","oyoq","kiyim"],
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"belgi", manba:"yorliq", x:.06, y:.07, o:.055, fonRang:"b",
        matnRang:"a", burchak:-6 },
      { tur:"rasm", x:.5, y:.52, w:.74, h:.48, anchor:"center" },
      { tur:"matn", manba:"eskiNarx", x:.94, y:.10, o:.034, vazn:700, rang:"d",
        anchor:"right", chizilgan:true },
      { tur:"narx", x:.06, y:.92, o:.115, vazn:900, rang:"c" },
      { tur:"matn", manba:"muddat", x:.94, y:.90, o:.024, vazn:700, rang:"d",
        anchor:"right", max:.4 },
      { tur:"logo", x:.94, y:.965, o:.022, rang:"d", anchor:"right" },
    ],
  },

  // ═══ ✅ B2 (2026-09-06) — OYOQ KIYIM TO'PLAMI (30 shablon) ═══
  {
    id:"oy01", nom:"Podium 1", kat:["oyoq"],
    uchun:"Doira maska, gradient fon",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:120 },
      { tur:"naqsh", naqsh:"nuqta", rang:"c", alfa:0.09, zich:0.05 },
      { tur:"rasm", x:0.5, y:0.43, w:0.74, h:0.5, anchor:"center", maska:"doira" },
      { tur:"sticker", manba:"yorliq", shakl:"muhr", x:0.8, y:0.19, r:0.115, fonRang:"b", matnRang:"a", burchak:-10 },
      { tur:"matn", manba:"nom", x:0.5, y:0.78, o:0.05, vazn:800, rang:"c", anchor:"center", max:0.84, katta:true },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.826, o:0.023, vazn:600, rang:"d", anchor:"center", max:0.8 },
      { tur:"narx", x:0.5, y:0.93, o:0.1, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy02", nom:"Podium 2", kat:["oyoq"],
    uchun:"Doira maska, gradient fon",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:45 },
      { tur:"naqsh", naqsh:"katak", rang:"c", alfa:0.09, zich:0.05 },
      { tur:"rasm", x:0.5, y:0.43, w:0.74, h:0.5, anchor:"center", maska:"doira" },
      { tur:"sticker", manba:"yorliq", shakl:"yulduz", x:0.8, y:0.19, r:0.115, fonRang:"b", matnRang:"a", burchak:-10 },
      { tur:"matn", manba:"nom", x:0.5, y:0.78, o:0.05, vazn:800, rang:"c", anchor:"center", max:0.84, katta:true },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.826, o:0.023, vazn:600, rang:"d", anchor:"center", max:0.8 },
      { tur:"narx", x:0.5, y:0.93, o:0.1, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy03", nom:"Podium 3", kat:["oyoq"],
    uchun:"Doira maska, gradient fon",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:200 },
      { tur:"naqsh", naqsh:"suzani", rang:"c", alfa:0.09, zich:0.05 },
      { tur:"rasm", x:0.5, y:0.43, w:0.74, h:0.5, anchor:"center", maska:"doira" },
      { tur:"sticker", manba:"yorliq", shakl:"doira", x:0.8, y:0.19, r:0.115, fonRang:"b", matnRang:"a", burchak:-10 },
      { tur:"matn", manba:"nom", x:0.5, y:0.78, o:0.05, vazn:800, rang:"c", anchor:"center", max:0.84, katta:true },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.826, o:0.023, vazn:600, rang:"d", anchor:"center", max:0.8 },
      { tur:"narx", x:0.5, y:0.93, o:0.1, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy04", nom:"Diagonal 1", kat:["oyoq","umumiy"],
    uchun:"Rangli kesim va narx doirasi",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"burchak", rang:"b", balandlik:0.44, qiya:0.1 },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.11, o:0.058, vazn:800, rang:"a", max:0.84, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.58, w:0.78, h:0.44, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.06, y:0.9, o:0.036, vazn:800, rang:"c", max:0.58 },
      { tur:"doira", x:0.8, y:0.86, r:0.13, fonRang:"b", matnRang:"a", manba:"narxQisqa" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"oy05", nom:"Diagonal 2", kat:["oyoq","umumiy"],
    uchun:"Rangli kesim va narx doirasi",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"burchak", rang:"b", balandlik:0.52, qiya:-0.08 },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.11, o:0.058, vazn:800, rang:"a", max:0.84, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.58, w:0.78, h:0.44, anchor:"center", maska:"yumaloq" },
      { tur:"matn", manba:"nom", x:0.06, y:0.9, o:0.036, vazn:800, rang:"c", max:0.58 },
      { tur:"doira", x:0.8, y:0.86, r:0.13, fonRang:"b", matnRang:"a", manba:"narxQisqa" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"oy06", nom:"Diagonal 3", kat:["oyoq","umumiy"],
    uchun:"Rangli kesim va narx doirasi",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"burchak", rang:"b", balandlik:0.38, qiya:0.14 },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.11, o:0.058, vazn:800, rang:"a", max:0.84, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.58, w:0.78, h:0.44, anchor:"center", maska:"blob" },
      { tur:"matn", manba:"nom", x:0.06, y:0.9, o:0.036, vazn:800, rang:"c", max:0.58 },
      { tur:"doira", x:0.8, y:0.86, r:0.13, fonRang:"b", matnRang:"a", manba:"narxQisqa" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"oy07", nom:"Afisha 1", kat:["oyoq","umumiy"],
    uchun:"Yirik sarlavha, tovar pastda",
    qatlamlar:[
      { tur:"fon", rang:"b" },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.1, o:0.105, vazn:900, rang:"a", max:0.88, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.62, w:0.92, h:0.52, anchor:"center" },
      { tur:"narx", x:0.94, y:0.115, o:0.05, vazn:900, rang:"a", anchor:"right", qopqa:"a", qopqaMatn:"b" },
      { tur:"matn", manba:"nom", x:0.06, y:0.955, o:0.03, vazn:700, rang:"a", max:0.7 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy08", nom:"Afisha 2", kat:["oyoq","umumiy"],
    uchun:"Yirik sarlavha, tovar pastda",
    qatlamlar:[
      { tur:"fon", rang:"b" },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.1, o:0.095, vazn:900, rang:"a", max:0.88, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.62, w:0.92, h:0.52, anchor:"center" },
      { tur:"ramka", uslub:"ikki", rang:"a", chet:0.035, qalin:0.004, oraliq:0.012 },
      { tur:"narx", x:0.94, y:0.115, o:0.05, vazn:900, rang:"a", anchor:"right", qopqa:"a", qopqaMatn:"b" },
      { tur:"matn", manba:"nom", x:0.06, y:0.955, o:0.03, vazn:700, rang:"a", max:0.7 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy09", nom:"Afisha 3", kat:["oyoq","umumiy"],
    uchun:"Yirik sarlavha, tovar pastda",
    qatlamlar:[
      { tur:"fon", rang:"b" },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.1, o:0.115, vazn:900, rang:"a", max:0.88, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.62, w:0.92, h:0.52, anchor:"center" },
      { tur:"ramka", uslub:"burchak", rang:"a", chet:0.035, qalin:0.004, oraliq:0.012 },
      { tur:"narx", x:0.94, y:0.115, o:0.05, vazn:900, rang:"a", anchor:"right", qopqa:"a", qopqaMatn:"b" },
      { tur:"matn", manba:"nom", x:0.06, y:0.955, o:0.03, vazn:700, rang:"a", max:0.7 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy10", nom:"Muhr 1", kat:["oyoq"],
    uchun:"Katta stiker va toza fon",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"shevron", rang:"b", alfa:0.08, zich:0.07 },
      { tur:"rasm", x:0.5, y:0.46, w:0.8, h:0.5, anchor:"center" },
      { tur:"sticker", manba:"yorliq", shakl:"muhr", x:0.22, y:0.22, r:0.13, uch:20, fonRang:"b", matnRang:"a", burchak:-14 },
      { tur:"panel", x:0.06, y:0.8, w:0.88, h:0.145, rang:"c", alfa:0.94, radius:0.035 },
      { tur:"matn", manba:"nom", x:0.1, y:0.855, o:0.042, vazn:800, rang:"a", max:0.6 },
      { tur:"narx", x:0.9, y:0.885, o:0.055, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy11", nom:"Muhr 2", kat:["oyoq"],
    uchun:"Katta stiker va toza fon",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"shevron", rang:"b", alfa:0.08, zich:0.07 },
      { tur:"rasm", x:0.5, y:0.46, w:0.8, h:0.5, anchor:"center" },
      { tur:"sticker", manba:"yorliq", shakl:"yulduz", x:0.22, y:0.22, r:0.13, uch:12, fonRang:"b", matnRang:"a", burchak:8 },
      { tur:"panel", x:0.06, y:0.8, w:0.88, h:0.145, rang:"c", alfa:0.94, radius:0.035 },
      { tur:"matn", manba:"nom", x:0.1, y:0.855, o:0.042, vazn:800, rang:"a", max:0.6 },
      { tur:"narx", x:0.9, y:0.885, o:0.055, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy12", nom:"Muhr 3", kat:["oyoq"],
    uchun:"Katta stiker va toza fon",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"shevron", rang:"b", alfa:0.08, zich:0.07 },
      { tur:"rasm", x:0.5, y:0.46, w:0.8, h:0.5, anchor:"center" },
      { tur:"sticker", manba:"yorliq", shakl:"blob", x:0.22, y:0.22, r:0.13, uch:8, fonRang:"b", matnRang:"a", burchak:0 },
      { tur:"panel", x:0.06, y:0.8, w:0.88, h:0.145, rang:"c", alfa:0.94, radius:0.035 },
      { tur:"matn", manba:"nom", x:0.1, y:0.855, o:0.042, vazn:800, rang:"a", max:0.6 },
      { tur:"narx", x:0.9, y:0.885, o:0.055, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy13", nom:"Katalog 1", kat:["oyoq","sumka"],
    uchun:"Artikul, o'lcham, narx — ulgurjiga",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"naqsh", naqsh:"katak", rang:"a", alfa:0.05, zich:0.04 },
      { tur:"rasm", x:0.5, y:0.38, w:0.76, h:0.48, anchor:"center" },
      { tur:"chiziq", x:0.07, y:0.72, w:0.86, rang:"a" },
      { tur:"ikonka", ikona:"yorliq", x:0.1, y:0.775, r:0.026, rang:"b" },
      { tur:"matn", manba:"nom", x:0.17, y:0.785, o:0.042, vazn:800, rang:"a", max:0.76 },
      { tur:"matn", manba:"tafsilot", x:0.07, y:0.845, o:0.025, vazn:700, rang:"d", max:0.86 },
      { tur:"narx", x:0.07, y:0.935, o:0.065, vazn:900, rang:"b" },
      { tur:"matn", manba:"tel", x:0.93, y:0.935, o:0.026, vazn:700, rang:"d", anchor:"right", max:0.4 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy14", nom:"Katalog 2", kat:["oyoq","sumka"],
    uchun:"Artikul, o'lcham, narx — ulgurjiga",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"naqsh", naqsh:"nuqta", rang:"a", alfa:0.05, zich:0.04 },
      { tur:"rasm", x:0.5, y:0.38, w:0.76, h:0.48, anchor:"center" },
      { tur:"chiziq", x:0.07, y:0.72, w:0.86, rang:"a" },
      { tur:"ikonka", ikona:"yuk", x:0.1, y:0.775, r:0.026, rang:"b" },
      { tur:"matn", manba:"nom", x:0.17, y:0.785, o:0.042, vazn:800, rang:"a", max:0.76 },
      { tur:"matn", manba:"tafsilot", x:0.07, y:0.845, o:0.025, vazn:700, rang:"d", max:0.86 },
      { tur:"narx", x:0.07, y:0.935, o:0.065, vazn:900, rang:"b" },
      { tur:"matn", manba:"tel", x:0.93, y:0.935, o:0.026, vazn:700, rang:"d", anchor:"right", max:0.4 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy15", nom:"Katalog 3", kat:["oyoq","sumka"],
    uchun:"Artikul, o'lcham, narx — ulgurjiga",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"naqsh", naqsh:"chiziq", rang:"a", alfa:0.05, zich:0.04 },
      { tur:"rasm", x:0.5, y:0.38, w:0.76, h:0.48, anchor:"center" },
      { tur:"chiziq", x:0.07, y:0.72, w:0.86, rang:"a" },
      { tur:"ikonka", ikona:"belgi", x:0.1, y:0.775, r:0.026, rang:"b" },
      { tur:"matn", manba:"nom", x:0.17, y:0.785, o:0.042, vazn:800, rang:"a", max:0.76 },
      { tur:"matn", manba:"tafsilot", x:0.07, y:0.845, o:0.025, vazn:700, rang:"d", max:0.86 },
      { tur:"narx", x:0.07, y:0.935, o:0.065, vazn:900, rang:"b" },
      { tur:"matn", manba:"tel", x:0.93, y:0.935, o:0.026, vazn:700, rang:"d", anchor:"right", max:0.4 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy16", nom:"Chegirma 1", kat:["oyoq","umumiy"],
    uchun:"Eski narx chizilgan, lenta",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"lenta", manba:"yorliq", tomon:"ong", y:0.1, en:0.34, qalin:0.068, o:0.03, fonRang:"b", matnRang:"a" },
      { tur:"rasm", x:0.5, y:0.5, w:0.78, h:0.48, anchor:"center" },
      { tur:"matn", manba:"eskiNarx", x:0.06, y:0.845, o:0.032, vazn:700, rang:"d", chizilgan:true, max:0.5 },
      { tur:"narx", x:0.06, y:0.925, o:0.115, vazn:900, rang:"b" },
      { tur:"matn", manba:"muddat", x:0.94, y:0.9, o:0.024, vazn:700, rang:"d", anchor:"right", max:0.42 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy17", nom:"Chegirma 2", kat:["oyoq","umumiy"],
    uchun:"Eski narx chizilgan, lenta",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"lenta", manba:"yorliq", tomon:"chap", y:0.12, en:0.34, qalin:0.068, o:0.03, fonRang:"b", matnRang:"a" },
      { tur:"rasm", x:0.5, y:0.5, w:0.78, h:0.48, anchor:"center" },
      { tur:"matn", manba:"eskiNarx", x:0.06, y:0.845, o:0.032, vazn:700, rang:"d", chizilgan:true, max:0.5 },
      { tur:"narx", x:0.06, y:0.925, o:0.115, vazn:900, rang:"b" },
      { tur:"matn", manba:"muddat", x:0.94, y:0.9, o:0.024, vazn:700, rang:"d", anchor:"right", max:0.42 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy18", nom:"Chegirma 3", kat:["oyoq","umumiy"],
    uchun:"Eski narx chizilgan, lenta",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"lenta", manba:"yorliq", tomon:"ong", y:0.16, en:0.34, qalin:0.068, o:0.03, fonRang:"b", matnRang:"a" },
      { tur:"rasm", x:0.5, y:0.5, w:0.78, h:0.48, anchor:"center" },
      { tur:"matn", manba:"eskiNarx", x:0.06, y:0.845, o:0.032, vazn:700, rang:"d", chizilgan:true, max:0.5 },
      { tur:"narx", x:0.06, y:0.925, o:0.115, vazn:900, rang:"b" },
      { tur:"matn", manba:"muddat", x:0.94, y:0.9, o:0.024, vazn:700, rang:"d", anchor:"right", max:0.42 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy19", nom:"Arch 1", kat:["oyoq","sumka"],
    uchun:"Nafis, gumbaz maska",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"suzani", rang:"b", alfa:0.07, zich:0.06 },
      { tur:"rasm", x:0.5, y:0.44, w:0.64, h:0.56, anchor:"center", maska:"arch" },
      { tur:"nur", kuch:0.14, siljish:-0.12 },
      { tur:"ramka", uslub:"ikki", rang:"b", chet:0.035, qalin:0.0035, oraliq:0.011 },
      { tur:"ikonka", ikona:"yulduz", x:0.5, y:0.785, r:0.024, rang:"b" },
      { tur:"matn", manba:"nom", x:0.5, y:0.85, o:0.046, vazn:800, rang:"c", anchor:"center", max:0.78, katta:true, soya:true },
      { tur:"narx", x:0.5, y:0.93, o:0.085, vazn:900, rang:"b", anchor:"center" },
      { tur:"textura", alfa:0.04, rang:"c" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy20", nom:"Arch 2", kat:["oyoq","sumka"],
    uchun:"Nafis, gumbaz maska",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"suzani", rang:"b", alfa:0.07, zich:0.06 },
      { tur:"rasm", x:0.5, y:0.44, w:0.64, h:0.56, anchor:"center", maska:"arch" },
      { tur:"nur", kuch:0.09, siljish:-0.12 },
      { tur:"ikonka", ikona:"yulduz", x:0.5, y:0.785, r:0.024, rang:"b" },
      { tur:"matn", manba:"nom", x:0.5, y:0.85, o:0.046, vazn:800, rang:"c", anchor:"center", max:0.78, katta:true, soya:true },
      { tur:"narx", x:0.5, y:0.93, o:0.085, vazn:900, rang:"b", anchor:"center" },
      { tur:"textura", alfa:0.04, rang:"c" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy21", nom:"Arch 3", kat:["oyoq","sumka"],
    uchun:"Nafis, gumbaz maska",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"suzani", rang:"b", alfa:0.07, zich:0.06 },
      { tur:"rasm", x:0.5, y:0.44, w:0.64, h:0.56, anchor:"center", maska:"arch" },
      { tur:"nur", kuch:0.18, siljish:-0.12 },
      { tur:"ramka", uslub:"burchak", rang:"b", chet:0.035, qalin:0.0035, oraliq:0.011 },
      { tur:"ikonka", ikona:"yulduz", x:0.5, y:0.785, r:0.024, rang:"b" },
      { tur:"matn", manba:"nom", x:0.5, y:0.85, o:0.046, vazn:800, rang:"c", anchor:"center", max:0.78, katta:true, soya:true },
      { tur:"narx", x:0.5, y:0.93, o:0.085, vazn:900, rang:"b", anchor:"center" },
      { tur:"textura", alfa:0.04, rang:"c" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy22", nom:"Mesh 1", kat:["oyoq","umumiy"],
    uchun:"Yumshoq rangli fon, panel",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.5 },
      { tur:"rasm", x:0.5, y:0.44, w:0.78, h:0.5, anchor:"center", maska:"yumaloq", radius:0.07 },
      { tur:"panel", x:0.08, y:0.775, w:0.84, h:0.16, rang:"a", alfa:0.86, radius:0.04 },
      { tur:"matn", manba:"nom", x:0.12, y:0.835, o:0.044, vazn:800, rang:"c", max:0.62 },
      { tur:"matn", manba:"tafsilot", x:0.12, y:0.878, o:0.022, vazn:600, rang:"d", max:0.62 },
      { tur:"narx", x:0.88, y:0.862, o:0.055, vazn:900, rang:"b", anchor:"right" },
      { tur:"belgi", manba:"yorliq", x:0.92, y:0.05, o:0.028, anchor:"right", fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"oy23", nom:"Mesh 2", kat:["oyoq","umumiy"],
    uchun:"Yumshoq rangli fon, panel",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.38 },
      { tur:"rasm", x:0.5, y:0.44, w:0.78, h:0.5, anchor:"center", maska:"doira", radius:0.07 },
      { tur:"panel", x:0.08, y:0.775, w:0.84, h:0.16, rang:"a", alfa:0.86, radius:0.04 },
      { tur:"matn", manba:"nom", x:0.12, y:0.835, o:0.044, vazn:800, rang:"c", max:0.62 },
      { tur:"matn", manba:"tafsilot", x:0.12, y:0.878, o:0.022, vazn:600, rang:"d", max:0.62 },
      { tur:"narx", x:0.88, y:0.862, o:0.055, vazn:900, rang:"b", anchor:"right" },
      { tur:"belgi", manba:"yorliq", x:0.92, y:0.05, o:0.028, anchor:"right", fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"oy24", nom:"Mesh 3", kat:["oyoq","umumiy"],
    uchun:"Yumshoq rangli fon, panel",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.62 },
      { tur:"rasm", x:0.5, y:0.44, w:0.78, h:0.5, anchor:"center" },
      { tur:"panel", x:0.08, y:0.775, w:0.84, h:0.16, rang:"a", alfa:0.86, radius:0.04 },
      { tur:"matn", manba:"nom", x:0.12, y:0.835, o:0.044, vazn:800, rang:"c", max:0.62 },
      { tur:"matn", manba:"tafsilot", x:0.12, y:0.878, o:0.022, vazn:600, rang:"d", max:0.62 },
      { tur:"narx", x:0.88, y:0.862, o:0.055, vazn:900, rang:"b", anchor:"right" },
      { tur:"belgi", manba:"yorliq", x:0.92, y:0.05, o:0.028, anchor:"right", fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"oy25", nom:"Minimal 1", kat:["oyoq","sumka"],
    uchun:"Ko'p bo'sh joy, sokin narx",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"rasm", x:0.5, y:0.46, w:0.7, h:0.54, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.5, y:0.1, o:0.038, vazn:700, rang:"a", anchor:"center", max:0.8 },
      { tur:"narx", x:0.94, y:0.93, o:0.07, vazn:900, rang:"a", anchor:"right", qopqa:"b", qopqaMatn:"a" },
      { tur:"matn", manba:"dokon", x:0.06, y:0.955, o:0.022, vazn:700, rang:"d", max:0.5 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy26", nom:"Minimal 2", kat:["oyoq","sumka"],
    uchun:"Ko'p bo'sh joy, sokin narx",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"rasm", x:0.5, y:0.46, w:0.7, h:0.54, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.5, y:0.1, o:0.038, vazn:700, rang:"a", anchor:"center", max:0.8 },
      { tur:"narx", x:0.5, y:0.9, o:0.09, vazn:900, rang:"a", anchor:"center" },
      { tur:"matn", manba:"dokon", x:0.06, y:0.955, o:0.022, vazn:700, rang:"d", max:0.5 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy27", nom:"Minimal 3", kat:["oyoq","sumka"],
    uchun:"Ko'p bo'sh joy, sokin narx",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"rasm", x:0.5, y:0.46, w:0.7, h:0.54, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.5, y:0.1, o:0.038, vazn:700, rang:"a", anchor:"center", max:0.8 },
      { tur:"narx", x:0.94, y:0.95, o:0.07, vazn:900, rang:"a", anchor:"right", qopqa:"b", qopqaMatn:"a" },
      { tur:"matn", manba:"dokon", x:0.06, y:0.955, o:0.022, vazn:700, rang:"d", max:0.5 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"oy28", nom:"Kollaj 1", kat:["oyoq","umumiy"],
    uchun:"Ikki tovar bir kadrda",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"b", burchak:160 },
      { tur:"naqsh", naqsh:"nuqta", rang:"c", alfa:0.1, zich:0.05 },
      { tur:"rasm", x:0.36, y:0.42, w:0.58, h:0.5, anchor:"center", maska:"yumaloq", radius:0.06 },
      { tur:"rasm2", x:0.74, y:0.62, w:0.36, h:0.3, anchor:"center" },
      { tur:"panel", x:0.06, y:0.8, w:0.88, h:0.145, rang:"c", alfa:0.93, radius:0.035 },
      { tur:"matn", manba:"nom", x:0.1, y:0.855, o:0.042, vazn:800, rang:"a", max:0.6 },
      { tur:"narx", x:0.9, y:0.885, o:0.055, vazn:900, rang:"a", anchor:"right" },
      { tur:"lenta", manba:"yorliq", tomon:"ong", y:0.09, en:0.32, qalin:0.06, o:0.027, fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"oy29", nom:"Kollaj 2", kat:["oyoq","umumiy"],
    uchun:"Ikki tovar bir kadrda",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"b", burchak:160 },
      { tur:"naqsh", naqsh:"nuqta", rang:"c", alfa:0.1, zich:0.05 },
      { tur:"rasm", x:0.36, y:0.42, w:0.58, h:0.5, anchor:"center", maska:"doira", radius:0.06 },
      { tur:"rasm2", x:0.7, y:0.62, w:0.36, h:0.3, anchor:"center" },
      { tur:"panel", x:0.06, y:0.8, w:0.88, h:0.145, rang:"c", alfa:0.93, radius:0.035 },
      { tur:"matn", manba:"nom", x:0.1, y:0.855, o:0.042, vazn:800, rang:"a", max:0.6 },
      { tur:"narx", x:0.9, y:0.885, o:0.055, vazn:900, rang:"a", anchor:"right" },
      { tur:"lenta", manba:"yorliq", tomon:"ong", y:0.09, en:0.32, qalin:0.06, o:0.027, fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"oy30", nom:"Kollaj 3", kat:["oyoq","umumiy"],
    uchun:"Ikki tovar bir kadrda",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"b", burchak:160 },
      { tur:"naqsh", naqsh:"nuqta", rang:"c", alfa:0.1, zich:0.05 },
      { tur:"rasm", x:0.36, y:0.42, w:0.58, h:0.5, anchor:"center" },
      { tur:"rasm2", x:0.78, y:0.62, w:0.36, h:0.3, anchor:"center" },
      { tur:"panel", x:0.06, y:0.8, w:0.88, h:0.145, rang:"c", alfa:0.93, radius:0.035 },
      { tur:"matn", manba:"nom", x:0.1, y:0.855, o:0.042, vazn:800, rang:"a", max:0.6 },
      { tur:"narx", x:0.9, y:0.885, o:0.055, vazn:900, rang:"a", anchor:"right" },
      { tur:"lenta", manba:"yorliq", tomon:"ong", y:0.09, en:0.32, qalin:0.06, o:0.027, fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },

  // ═══ ✅ B3 (2026-09-06) — KIYIM TO'PLAMI (30 shablon) ═══
  {
    id:"ki01", nom:"Lookbook 1", kat:["kiyim","model"],
    uchun:"To'liq kadr, pastda yozuv",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"matn", manba:"nom", x:0.06, y:0.82, o:0.055, vazn:800, rang:"c", max:0.86, katta:true, soya:true },
      { tur:"matn", manba:"tafsilot", x:0.06, y:0.865, o:0.024, vazn:600, rang:"d", max:0.86 },
      { tur:"narx", x:0.06, y:0.945, o:0.1, vazn:900, rang:"b" },
      { tur:"belgi", manba:"yorliq", x:0.93, y:0.05, o:0.028, anchor:"right", fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki02", nom:"Lookbook 2", kat:["kiyim","model"],
    uchun:"To'liq kadr, pastda yozuv",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"matn", manba:"nom", x:0.5, y:0.8, o:0.05, vazn:800, rang:"c", max:0.86, katta:true, soya:true, anchor:"center" },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.8450000000000001, o:0.024, vazn:600, rang:"d", max:0.86, anchor:"center" },
      { tur:"narx", x:0.5, y:0.945, o:0.1, vazn:900, rang:"b", anchor:"center" },
      { tur:"belgi", manba:"yorliq", x:0.93, y:0.05, o:0.028, anchor:"right", fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki03", nom:"Lookbook 3", kat:["kiyim","model"],
    uchun:"To'liq kadr, pastda yozuv",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"matn", manba:"nom", x:0.06, y:0.86, o:0.048, vazn:800, rang:"c", max:0.86, katta:true, soya:true },
      { tur:"matn", manba:"tafsilot", x:0.06, y:0.905, o:0.024, vazn:600, rang:"d", max:0.86 },
      { tur:"narx", x:0.06, y:0.945, o:0.1, vazn:900, rang:"b" },
      { tur:"belgi", manba:"yorliq", x:0.93, y:0.05, o:0.028, anchor:"right", fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki04", nom:"Lookbook 4", kat:["kiyim","model"],
    uchun:"To'liq kadr, pastda yozuv",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"matn", manba:"nom", x:0.5, y:0.78, o:0.058, vazn:800, rang:"c", max:0.86, katta:true, soya:true, anchor:"center" },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.8250000000000001, o:0.024, vazn:600, rang:"d", max:0.86, anchor:"center" },
      { tur:"narx", x:0.5, y:0.945, o:0.1, vazn:900, rang:"b", anchor:"center" },
      { tur:"belgi", manba:"yorliq", x:0.93, y:0.05, o:0.028, anchor:"right", fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki05", nom:"Editorial 1", kat:["kiyim","umumiy"],
    uchun:"Jurnal uslubi, bo'lingan kadr",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"burchak", rang:"a", balandlik:0.58, qiya:0.06 },
      { tur:"rasm", x:0.5, y:0.44, w:0.72, h:0.6, anchor:"center" },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.1, o:0.052, vazn:900, rang:"c", max:0.6, satr:2, katta:true },
      { tur:"matn", manba:"nom", x:0.06, y:0.86, o:0.044, vazn:800, rang:"a", max:0.6 },
      { tur:"matn", manba:"tafsilot", x:0.06, y:0.9, o:0.023, vazn:600, rang:"d", max:0.6 },
      { tur:"narx", x:0.94, y:0.895, o:0.062, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki06", nom:"Editorial 2", kat:["kiyim","umumiy"],
    uchun:"Jurnal uslubi, bo'lingan kadr",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"burchak", rang:"a", balandlik:0.5, qiya:-0.1 },
      { tur:"rasm", x:0.5, y:0.44, w:0.72, h:0.6, anchor:"center", maska:"yumaloq" },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.1, o:0.052, vazn:900, rang:"c", max:0.6, satr:2, katta:true },
      { tur:"matn", manba:"nom", x:0.06, y:0.86, o:0.044, vazn:800, rang:"a", max:0.6 },
      { tur:"matn", manba:"tafsilot", x:0.06, y:0.9, o:0.023, vazn:600, rang:"d", max:0.6 },
      { tur:"narx", x:0.94, y:0.895, o:0.062, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki07", nom:"Editorial 3", kat:["kiyim","umumiy"],
    uchun:"Jurnal uslubi, bo'lingan kadr",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"burchak", rang:"a", balandlik:0.64, qiya:0.1 },
      { tur:"rasm", x:0.5, y:0.44, w:0.72, h:0.6, anchor:"center", maska:"arch" },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.1, o:0.052, vazn:900, rang:"c", max:0.6, satr:2, katta:true },
      { tur:"matn", manba:"nom", x:0.06, y:0.86, o:0.044, vazn:800, rang:"a", max:0.6 },
      { tur:"matn", manba:"tafsilot", x:0.06, y:0.9, o:0.023, vazn:600, rang:"d", max:0.6 },
      { tur:"narx", x:0.94, y:0.895, o:0.062, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki08", nom:"Editorial 4", kat:["kiyim","umumiy"],
    uchun:"Jurnal uslubi, bo'lingan kadr",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"burchak", rang:"a", balandlik:0.46, qiya:0 },
      { tur:"rasm", x:0.5, y:0.44, w:0.72, h:0.6, anchor:"center", maska:"doira" },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.1, o:0.052, vazn:900, rang:"c", max:0.6, satr:2, katta:true },
      { tur:"matn", manba:"nom", x:0.06, y:0.86, o:0.044, vazn:800, rang:"a", max:0.6 },
      { tur:"matn", manba:"tafsilot", x:0.06, y:0.9, o:0.023, vazn:600, rang:"d", max:0.6 },
      { tur:"narx", x:0.94, y:0.895, o:0.062, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki09", nom:"To'plam 1", kat:["kiyim","umumiy"],
    uchun:"Mavsumiy to'plam e'loni",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:150 },
      { tur:"naqsh", naqsh:"suzani", rang:"c", alfa:0.09, zich:0.05 },
      { tur:"matn", manba:"yorliq", x:0.5, y:0.13, o:0.085, vazn:900, rang:"c", anchor:"center", max:0.86, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.6, w:0.8, h:0.52, anchor:"center" },
      { tur:"ramka", uslub:"ikki", rang:"b", chet:0.04, qalin:0.004, oraliq:0.012 },
      { tur:"matn", manba:"nom", x:0.5, y:0.9, o:0.036, vazn:700, rang:"d", anchor:"center", max:0.7 },
      { tur:"narx", x:0.5, y:0.955, o:0.058, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki10", nom:"To'plam 2", kat:["kiyim","umumiy"],
    uchun:"Mavsumiy to'plam e'loni",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:150 },
      { tur:"naqsh", naqsh:"chiziq", rang:"c", alfa:0.09, zich:0.05 },
      { tur:"matn", manba:"yorliq", x:0.5, y:0.13, o:0.085, vazn:900, rang:"c", anchor:"center", max:0.86, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.6, w:0.8, h:0.52, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.5, y:0.9, o:0.036, vazn:700, rang:"d", anchor:"center", max:0.7 },
      { tur:"narx", x:0.5, y:0.955, o:0.058, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki11", nom:"To'plam 3", kat:["kiyim","umumiy"],
    uchun:"Mavsumiy to'plam e'loni",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:150 },
      { tur:"naqsh", naqsh:"nuqta", rang:"c", alfa:0.09, zich:0.05 },
      { tur:"matn", manba:"yorliq", x:0.5, y:0.13, o:0.085, vazn:900, rang:"c", anchor:"center", max:0.86, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.6, w:0.8, h:0.52, anchor:"center" },
      { tur:"ramka", uslub:"burchak", rang:"b", chet:0.04, qalin:0.004, oraliq:0.012 },
      { tur:"matn", manba:"nom", x:0.5, y:0.9, o:0.036, vazn:700, rang:"d", anchor:"center", max:0.7 },
      { tur:"narx", x:0.5, y:0.955, o:0.058, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki12", nom:"To'plam 4", kat:["kiyim","umumiy"],
    uchun:"Mavsumiy to'plam e'loni",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:150 },
      { tur:"naqsh", naqsh:"shevron", rang:"c", alfa:0.09, zich:0.05 },
      { tur:"matn", manba:"yorliq", x:0.5, y:0.13, o:0.085, vazn:900, rang:"c", anchor:"center", max:0.86, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.6, w:0.8, h:0.52, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.5, y:0.9, o:0.036, vazn:700, rang:"d", anchor:"center", max:0.7 },
      { tur:"narx", x:0.5, y:0.955, o:0.058, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki13", nom:"Lookbook kollaj 1", kat:["kiyim","umumiy"],
    uchun:"Ikki kiyim bir kadrda",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.42 },
      { tur:"rasm", x:0.35, y:0.44, w:0.56, h:0.62, anchor:"center", maska:"yumaloq", radius:0.06 },
      { tur:"rasm2", x:0.76, y:0.6, w:0.34, h:0.34, anchor:"center" },
      { tur:"panel", x:0.06, y:0.8, w:0.88, h:0.15, rang:"c", alfa:0.93, radius:0.035 },
      { tur:"matn", manba:"nom", x:0.1, y:0.855, o:0.042, vazn:800, rang:"a", max:0.58 },
      { tur:"matn", manba:"tafsilot", x:0.1, y:0.895, o:0.021, vazn:600, rang:"a", max:0.58 },
      { tur:"narx", x:0.9, y:0.885, o:0.052, vazn:900, rang:"a", anchor:"right" },
      { tur:"lenta", manba:"yorliq", tomon:"ong", y:0.09, en:0.32, qalin:0.06, o:0.027, fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"ki14", nom:"Lookbook kollaj 2", kat:["kiyim","umumiy"],
    uchun:"Ikki kiyim bir kadrda",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.42 },
      { tur:"rasm", x:0.35, y:0.44, w:0.56, h:0.62, anchor:"center", maska:"doira", radius:0.06 },
      { tur:"rasm2", x:0.72, y:0.6, w:0.34, h:0.34, anchor:"center" },
      { tur:"panel", x:0.06, y:0.8, w:0.88, h:0.15, rang:"c", alfa:0.93, radius:0.035 },
      { tur:"matn", manba:"nom", x:0.1, y:0.855, o:0.042, vazn:800, rang:"a", max:0.58 },
      { tur:"matn", manba:"tafsilot", x:0.1, y:0.895, o:0.021, vazn:600, rang:"a", max:0.58 },
      { tur:"narx", x:0.9, y:0.885, o:0.052, vazn:900, rang:"a", anchor:"right" },
      { tur:"lenta", manba:"yorliq", tomon:"ong", y:0.09, en:0.32, qalin:0.06, o:0.027, fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"ki15", nom:"Lookbook kollaj 3", kat:["kiyim","umumiy"],
    uchun:"Ikki kiyim bir kadrda",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.42 },
      { tur:"rasm", x:0.35, y:0.44, w:0.56, h:0.62, anchor:"center" },
      { tur:"rasm2", x:0.8, y:0.6, w:0.34, h:0.34, anchor:"center" },
      { tur:"panel", x:0.06, y:0.8, w:0.88, h:0.15, rang:"c", alfa:0.93, radius:0.035 },
      { tur:"matn", manba:"nom", x:0.1, y:0.855, o:0.042, vazn:800, rang:"a", max:0.58 },
      { tur:"matn", manba:"tafsilot", x:0.1, y:0.895, o:0.021, vazn:600, rang:"a", max:0.58 },
      { tur:"narx", x:0.9, y:0.885, o:0.052, vazn:900, rang:"a", anchor:"right" },
      { tur:"lenta", manba:"yorliq", tomon:"ong", y:0.09, en:0.32, qalin:0.06, o:0.027, fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"ki16", nom:"Lookbook kollaj 4", kat:["kiyim","umumiy"],
    uchun:"Ikki kiyim bir kadrda",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.42 },
      { tur:"rasm", x:0.35, y:0.44, w:0.56, h:0.62, anchor:"center", maska:"blob", radius:0.06 },
      { tur:"rasm2", x:0.68, y:0.6, w:0.34, h:0.34, anchor:"center" },
      { tur:"panel", x:0.06, y:0.8, w:0.88, h:0.15, rang:"c", alfa:0.93, radius:0.035 },
      { tur:"matn", manba:"nom", x:0.1, y:0.855, o:0.042, vazn:800, rang:"a", max:0.58 },
      { tur:"matn", manba:"tafsilot", x:0.1, y:0.895, o:0.021, vazn:600, rang:"a", max:0.58 },
      { tur:"narx", x:0.9, y:0.885, o:0.052, vazn:900, rang:"a", anchor:"right" },
      { tur:"lenta", manba:"yorliq", tomon:"ong", y:0.09, en:0.32, qalin:0.06, o:0.027, fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"ki17", nom:"Narx urg'uli 1", kat:["kiyim"],
    uchun:"Narx birinchi o'rinda",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"katak", rang:"c", alfa:0.06, zich:0.045 },
      { tur:"rasm", x:0.5, y:0.44, w:0.76, h:0.54, anchor:"center" },
      { tur:"ikonka", ikona:"yorliq", x:0.1, y:0.815, r:0.028, rang:"b" },
      { tur:"matn", manba:"nom", x:0.18, y:0.825, o:0.04, vazn:800, rang:"c", max:0.72 },
      { tur:"narx", x:0.06, y:0.93, o:0.075, vazn:900, rang:"a", qopqa:"b", qopqaMatn:"a" },
      { tur:"matn", manba:"tafsilot", x:0.94, y:0.875, o:0.023, vazn:600, rang:"d", anchor:"right", max:0.5 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki18", nom:"Narx urg'uli 2", kat:["kiyim"],
    uchun:"Narx birinchi o'rinda",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"katak", rang:"c", alfa:0.06, zich:0.045 },
      { tur:"rasm", x:0.5, y:0.44, w:0.76, h:0.54, anchor:"center" },
      { tur:"ikonka", ikona:"belgi", x:0.1, y:0.815, r:0.028, rang:"b" },
      { tur:"matn", manba:"nom", x:0.18, y:0.825, o:0.04, vazn:800, rang:"c", max:0.72 },
      { tur:"narx", x:0.06, y:0.94, o:0.115, vazn:900, rang:"b" },
      { tur:"matn", manba:"tafsilot", x:0.94, y:0.875, o:0.023, vazn:600, rang:"d", anchor:"right", max:0.5 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki19", nom:"Narx urg'uli 3", kat:["kiyim"],
    uchun:"Narx birinchi o'rinda",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"katak", rang:"c", alfa:0.06, zich:0.045 },
      { tur:"rasm", x:0.5, y:0.44, w:0.76, h:0.54, anchor:"center" },
      { tur:"ikonka", ikona:"olov", x:0.1, y:0.815, r:0.028, rang:"b" },
      { tur:"matn", manba:"nom", x:0.18, y:0.825, o:0.04, vazn:800, rang:"c", max:0.72 },
      { tur:"narx", x:0.06, y:0.93, o:0.075, vazn:900, rang:"a", qopqa:"b", qopqaMatn:"a" },
      { tur:"matn", manba:"tafsilot", x:0.94, y:0.875, o:0.023, vazn:600, rang:"d", anchor:"right", max:0.5 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki20", nom:"Narx urg'uli 4", kat:["kiyim"],
    uchun:"Narx birinchi o'rinda",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"katak", rang:"c", alfa:0.06, zich:0.045 },
      { tur:"rasm", x:0.5, y:0.44, w:0.76, h:0.54, anchor:"center" },
      { tur:"ikonka", ikona:"yulduz", x:0.1, y:0.815, r:0.028, rang:"b" },
      { tur:"matn", manba:"nom", x:0.18, y:0.825, o:0.04, vazn:800, rang:"c", max:0.72 },
      { tur:"narx", x:0.06, y:0.94, o:0.115, vazn:900, rang:"b" },
      { tur:"matn", manba:"tafsilot", x:0.94, y:0.875, o:0.023, vazn:600, rang:"d", anchor:"right", max:0.5 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki21", nom:"Xodim kadri 1", kat:["kiyim","real"],
    uchun:"Real shaxs — tabiiy kadr",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"panel", x:0.05, y:0.78, w:0.62, h:0.115, rang:"b", alfa:0.92, radius:0.03 },
      { tur:"matn", manba:"nom", x:0.08, y:0.8500000000000001, o:0.042, vazn:800, rang:"a", max:0.56, soya:false },
      { tur:"narx", x:0.94, y:0.94, o:0.085, vazn:900, rang:"b", anchor:"right" },
      { tur:"matn", manba:"dokon", x:0.06, y:0.955, o:0.024, vazn:700, rang:"c", max:0.5, soya:true },
      { tur:"belgi", manba:"yorliq", x:0.93, y:0.05, o:0.028, anchor:"right", fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"ki22", nom:"Xodim kadri 2", kat:["kiyim","real"],
    uchun:"Real shaxs — tabiiy kadr",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"matn", manba:"nom", x:0.08, y:0.89, o:0.042, vazn:800, rang:"c", max:0.56, soya:true },
      { tur:"narx", x:0.94, y:0.94, o:0.085, vazn:900, rang:"b", anchor:"right" },
      { tur:"matn", manba:"dokon", x:0.06, y:0.955, o:0.024, vazn:700, rang:"c", max:0.5, soya:true },
      { tur:"belgi", manba:"yorliq", x:0.93, y:0.05, o:0.028, anchor:"right", fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"ki23", nom:"Xodim kadri 3", kat:["kiyim","real"],
    uchun:"Real shaxs — tabiiy kadr",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"panel", x:0.05, y:0.76, w:0.62, h:0.115, rang:"b", alfa:0.92, radius:0.03 },
      { tur:"matn", manba:"nom", x:0.08, y:0.8300000000000001, o:0.042, vazn:800, rang:"a", max:0.56, soya:false },
      { tur:"narx", x:0.94, y:0.94, o:0.085, vazn:900, rang:"b", anchor:"right" },
      { tur:"matn", manba:"dokon", x:0.06, y:0.955, o:0.024, vazn:700, rang:"c", max:0.5, soya:true },
      { tur:"belgi", manba:"yorliq", x:0.93, y:0.05, o:0.028, anchor:"right", fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"ki24", nom:"Xodim kadri 4", kat:["kiyim","real"],
    uchun:"Real shaxs — tabiiy kadr",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.5, w:1, h:1, anchor:"center", moda:"cover" },
      { tur:"matn", manba:"nom", x:0.08, y:0.91, o:0.042, vazn:800, rang:"c", max:0.56, soya:true },
      { tur:"narx", x:0.94, y:0.94, o:0.085, vazn:900, rang:"b", anchor:"right" },
      { tur:"matn", manba:"dokon", x:0.06, y:0.955, o:0.024, vazn:700, rang:"c", max:0.5, soya:true },
      { tur:"belgi", manba:"yorliq", x:0.93, y:0.05, o:0.028, anchor:"right", fonRang:"b", matnRang:"a" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"ki25", nom:"Nafis 1", kat:["kiyim"],
    uchun:"Premium kiyim uchun",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"suzani", rang:"b", alfa:0.06, zich:0.07 },
      { tur:"rasm", x:0.5, y:0.44, w:0.62, h:0.58, anchor:"center", maska:"arch", radius:0.08 },
      { tur:"nur", kuch:0.12, siljish:-0.1 },
      { tur:"ramka", uslub:"ikki", rang:"b", chet:0.035, qalin:0.003, oraliq:0.01 },
      { tur:"matn", manba:"nom", x:0.5, y:0.85, o:0.044, vazn:800, rang:"c", anchor:"center", max:0.76, katta:true },
      { tur:"narx", x:0.5, y:0.925, o:0.078, vazn:900, rang:"b", anchor:"center" },
      { tur:"textura", alfa:0.035, rang:"c" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki26", nom:"Nafis 2", kat:["kiyim"],
    uchun:"Premium kiyim uchun",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"suzani", rang:"b", alfa:0.06, zich:0.07 },
      { tur:"rasm", x:0.5, y:0.44, w:0.62, h:0.58, anchor:"center", maska:"yumaloq", radius:0.08 },
      { tur:"nur", kuch:0.16, siljish:-0.1 },
      { tur:"ramka", uslub:"ikki", rang:"b", chet:0.035, qalin:0.003, oraliq:0.01 },
      { tur:"matn", manba:"nom", x:0.5, y:0.85, o:0.044, vazn:800, rang:"c", anchor:"center", max:0.76, katta:true },
      { tur:"narx", x:0.5, y:0.925, o:0.078, vazn:900, rang:"b", anchor:"center" },
      { tur:"textura", alfa:0.035, rang:"c" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki27", nom:"Nafis 3", kat:["kiyim"],
    uchun:"Premium kiyim uchun",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"naqsh", naqsh:"suzani", rang:"b", alfa:0.06, zich:0.07 },
      { tur:"rasm", x:0.5, y:0.44, w:0.62, h:0.58, anchor:"center", maska:"doira", radius:0.08 },
      { tur:"nur", kuch:0.09, siljish:-0.1 },
      { tur:"ramka", uslub:"ikki", rang:"b", chet:0.035, qalin:0.003, oraliq:0.01 },
      { tur:"matn", manba:"nom", x:0.5, y:0.85, o:0.044, vazn:800, rang:"c", anchor:"center", max:0.76, katta:true },
      { tur:"narx", x:0.5, y:0.925, o:0.078, vazn:900, rang:"b", anchor:"center" },
      { tur:"textura", alfa:0.035, rang:"c" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki28", nom:"Kiyim chegirma 1", kat:["kiyim","umumiy"],
    uchun:"Aksiya — katta stiker",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"b", burchak:100 },
      { tur:"rasm", x:0.5, y:0.46, w:0.74, h:0.52, anchor:"center" },
      { tur:"sticker", manba:"yorliq", shakl:"muhr", x:0.22, y:0.2, r:0.135, fonRang:"c", matnRang:"a", burchak:-12 },
      { tur:"matn", manba:"eskiNarx", x:0.06, y:0.85, o:0.03, vazn:700, rang:"d", chizilgan:true, max:0.45 },
      { tur:"narx", x:0.06, y:0.93, o:0.11, vazn:900, rang:"c" },
      { tur:"matn", manba:"muddat", x:0.94, y:0.9, o:0.023, vazn:700, rang:"d", anchor:"right", max:0.42 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki29", nom:"Kiyim chegirma 2", kat:["kiyim","umumiy"],
    uchun:"Aksiya — katta stiker",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"b", burchak:100 },
      { tur:"rasm", x:0.5, y:0.46, w:0.74, h:0.52, anchor:"center" },
      { tur:"sticker", manba:"yorliq", shakl:"yulduz", x:0.22, y:0.2, r:0.135, fonRang:"c", matnRang:"a", burchak:10 },
      { tur:"matn", manba:"eskiNarx", x:0.06, y:0.85, o:0.03, vazn:700, rang:"d", chizilgan:true, max:0.45 },
      { tur:"narx", x:0.06, y:0.93, o:0.11, vazn:900, rang:"c" },
      { tur:"matn", manba:"muddat", x:0.94, y:0.9, o:0.023, vazn:700, rang:"d", anchor:"right", max:0.42 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"ki30", nom:"Kiyim chegirma 3", kat:["kiyim","umumiy"],
    uchun:"Aksiya — katta stiker",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"b", burchak:100 },
      { tur:"rasm", x:0.5, y:0.46, w:0.74, h:0.52, anchor:"center" },
      { tur:"sticker", manba:"yorliq", shakl:"blob", x:0.22, y:0.2, r:0.135, fonRang:"c", matnRang:"a", burchak:0 },
      { tur:"matn", manba:"eskiNarx", x:0.06, y:0.85, o:0.03, vazn:700, rang:"d", chizilgan:true, max:0.45 },
      { tur:"narx", x:0.06, y:0.93, o:0.11, vazn:900, rang:"c" },
      { tur:"matn", manba:"muddat", x:0.94, y:0.9, o:0.023, vazn:700, rang:"d", anchor:"right", max:0.42 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },

  // ═══ ✅ B4 (2026-09-06) — SUMKA · BOLALAR · SPORT · UNIVERSAL (30) ═══
  {
    id:"su01", nom:"Aksessuar 1", kat:["sumka","umumiy"],
    uchun:"Sumka va aksessuar uchun",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:135 },
      { tur:"naqsh", naqsh:"nuqta", rang:"c", alfa:0.08, zich:0.05 },
      { tur:"rasm", x:0.5, y:0.44, w:0.7, h:0.52, anchor:"center", maska:"doira", radius:0.07 },
      { tur:"sticker", manba:"yorliq", shakl:"muhr", x:0.8, y:0.2, r:0.11, fonRang:"b", matnRang:"a", burchak:-8 },
      { tur:"matn", manba:"nom", x:0.5, y:0.8, o:0.048, vazn:800, rang:"c", anchor:"center", max:0.82, katta:true },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.845, o:0.023, vazn:600, rang:"d", anchor:"center", max:0.8 },
      { tur:"narx", x:0.5, y:0.935, o:0.095, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"su02", nom:"Aksessuar 2", kat:["sumka","umumiy"],
    uchun:"Sumka va aksessuar uchun",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:135 },
      { tur:"naqsh", naqsh:"suzani", rang:"c", alfa:0.08, zich:0.05 },
      { tur:"rasm", x:0.5, y:0.44, w:0.7, h:0.52, anchor:"center", maska:"yumaloq", radius:0.07 },
      { tur:"sticker", manba:"yorliq", shakl:"yulduz", x:0.8, y:0.2, r:0.11, fonRang:"b", matnRang:"a", burchak:-8 },
      { tur:"matn", manba:"nom", x:0.5, y:0.8, o:0.048, vazn:800, rang:"c", anchor:"center", max:0.82, katta:true },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.845, o:0.023, vazn:600, rang:"d", anchor:"center", max:0.8 },
      { tur:"narx", x:0.5, y:0.935, o:0.095, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"su03", nom:"Aksessuar 3", kat:["sumka","umumiy"],
    uchun:"Sumka va aksessuar uchun",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:135 },
      { tur:"naqsh", naqsh:"chiziq", rang:"c", alfa:0.08, zich:0.05 },
      { tur:"rasm", x:0.5, y:0.44, w:0.7, h:0.52, anchor:"center", maska:"arch", radius:0.07 },
      { tur:"sticker", manba:"yorliq", shakl:"doira", x:0.8, y:0.2, r:0.11, fonRang:"b", matnRang:"a", burchak:-8 },
      { tur:"matn", manba:"nom", x:0.5, y:0.8, o:0.048, vazn:800, rang:"c", anchor:"center", max:0.82, katta:true },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.845, o:0.023, vazn:600, rang:"d", anchor:"center", max:0.8 },
      { tur:"narx", x:0.5, y:0.935, o:0.095, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"su04", nom:"Aksessuar 4", kat:["sumka","umumiy"],
    uchun:"Sumka va aksessuar uchun",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:135 },
      { tur:"naqsh", naqsh:"katak", rang:"c", alfa:0.08, zich:0.05 },
      { tur:"rasm", x:0.5, y:0.44, w:0.7, h:0.52, anchor:"center" },
      { tur:"sticker", manba:"yorliq", shakl:"blob", x:0.8, y:0.2, r:0.11, fonRang:"b", matnRang:"a", burchak:-8 },
      { tur:"matn", manba:"nom", x:0.5, y:0.8, o:0.048, vazn:800, rang:"c", anchor:"center", max:0.82, katta:true },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.845, o:0.023, vazn:600, rang:"d", anchor:"center", max:0.8 },
      { tur:"narx", x:0.5, y:0.935, o:0.095, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"su05", nom:"Aksessuar 5", kat:["sumka","umumiy"],
    uchun:"Sumka va aksessuar uchun",
    qatlamlar:[
      { tur:"gradient", rang:"a", rang2:"d", burchak:135 },
      { tur:"naqsh", naqsh:"shevron", rang:"c", alfa:0.08, zich:0.05 },
      { tur:"rasm", x:0.5, y:0.44, w:0.7, h:0.52, anchor:"center", maska:"blob", radius:0.07 },
      { tur:"sticker", manba:"yorliq", shakl:"muhr", x:0.8, y:0.2, r:0.11, fonRang:"b", matnRang:"a", burchak:-8 },
      { tur:"matn", manba:"nom", x:0.5, y:0.8, o:0.048, vazn:800, rang:"c", anchor:"center", max:0.82, katta:true },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.845, o:0.023, vazn:600, rang:"d", anchor:"center", max:0.8 },
      { tur:"narx", x:0.5, y:0.935, o:0.095, vazn:900, rang:"b", anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"su06", nom:"Charm 1", kat:["sumka"],
    uchun:"Premium — to'q fon, nur",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.45, w:0.66, h:0.54, anchor:"center" },
      { tur:"nur", kuch:0.14, siljish:-0.1 },
      { tur:"ramka", uslub:"ikki", rang:"b", chet:0.04, qalin:0.0035, oraliq:0.011 },
      { tur:"ikonka", ikona:"yulduz", x:0.5, y:0.79, r:0.023, rang:"b" },
      { tur:"matn", manba:"nom", x:0.5, y:0.85, o:0.044, vazn:800, rang:"c", anchor:"center", max:0.76, katta:true },
      { tur:"narx", x:0.5, y:0.925, o:0.08, vazn:900, rang:"b", anchor:"center" },
      { tur:"textura", alfa:0.04, rang:"c" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"su07", nom:"Charm 2", kat:["sumka"],
    uchun:"Premium — to'q fon, nur",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.45, w:0.66, h:0.54, anchor:"center" },
      { tur:"nur", kuch:0.1, siljish:-0.1 },
      { tur:"ikonka", ikona:"yulduz", x:0.5, y:0.79, r:0.023, rang:"b" },
      { tur:"matn", manba:"nom", x:0.5, y:0.85, o:0.044, vazn:800, rang:"c", anchor:"center", max:0.76, katta:true },
      { tur:"narx", x:0.5, y:0.925, o:0.08, vazn:900, rang:"b", anchor:"center" },
      { tur:"textura", alfa:0.04, rang:"c" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"su08", nom:"Charm 3", kat:["sumka"],
    uchun:"Premium — to'q fon, nur",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.45, w:0.66, h:0.54, anchor:"center" },
      { tur:"nur", kuch:0.18, siljish:-0.1 },
      { tur:"ramka", uslub:"burchak", rang:"b", chet:0.04, qalin:0.0035, oraliq:0.011 },
      { tur:"ikonka", ikona:"yulduz", x:0.5, y:0.79, r:0.023, rang:"b" },
      { tur:"matn", manba:"nom", x:0.5, y:0.85, o:0.044, vazn:800, rang:"c", anchor:"center", max:0.76, katta:true },
      { tur:"narx", x:0.5, y:0.925, o:0.08, vazn:900, rang:"b", anchor:"center" },
      { tur:"textura", alfa:0.04, rang:"c" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"su09", nom:"Charm 4", kat:["sumka"],
    uchun:"Premium — to'q fon, nur",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.45, w:0.66, h:0.54, anchor:"center" },
      { tur:"nur", kuch:0.12, siljish:-0.1 },
      { tur:"ramka", uslub:"ikki", rang:"b", chet:0.04, qalin:0.0035, oraliq:0.011 },
      { tur:"ikonka", ikona:"yulduz", x:0.5, y:0.79, r:0.023, rang:"b" },
      { tur:"matn", manba:"nom", x:0.5, y:0.85, o:0.044, vazn:800, rang:"c", anchor:"center", max:0.76, katta:true },
      { tur:"narx", x:0.5, y:0.925, o:0.08, vazn:900, rang:"b", anchor:"center" },
      { tur:"textura", alfa:0.04, rang:"c" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"bo01", nom:"Bolalar 1", kat:["bolalar","umumiy"],
    uchun:"Yorqin, quvnoq kompozitsiya",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.6 },
      { tur:"naqsh", naqsh:"nuqta", rang:"c", alfa:0.14, zich:0.06 },
      { tur:"rasm", x:0.5, y:0.43, w:0.72, h:0.5, anchor:"center", maska:"blob", radius:0.1 },
      { tur:"sticker", manba:"yorliq", shakl:"blob", x:0.79, y:0.19, r:0.125, fonRang:"c", matnRang:"a", burchak:-8 },
      { tur:"panel", x:0.07, y:0.78, w:0.86, h:0.155, rang:"c", alfa:0.95, radius:0.05 },
      { tur:"matn", manba:"nom", x:0.11, y:0.835, o:0.044, vazn:800, rang:"a", max:0.6 },
      { tur:"matn", manba:"tafsilot", x:0.11, y:0.878, o:0.021, vazn:600, rang:"a", max:0.6 },
      { tur:"narx", x:0.89, y:0.868, o:0.055, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"bo02", nom:"Bolalar 2", kat:["bolalar","umumiy"],
    uchun:"Yorqin, quvnoq kompozitsiya",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.6 },
      { tur:"naqsh", naqsh:"suzani", rang:"c", alfa:0.14, zich:0.06 },
      { tur:"rasm", x:0.5, y:0.43, w:0.72, h:0.5, anchor:"center", maska:"doira", radius:0.1 },
      { tur:"sticker", manba:"yorliq", shakl:"blob", x:0.79, y:0.19, r:0.125, fonRang:"c", matnRang:"a", burchak:6 },
      { tur:"panel", x:0.07, y:0.78, w:0.86, h:0.155, rang:"c", alfa:0.95, radius:0.05 },
      { tur:"matn", manba:"nom", x:0.11, y:0.835, o:0.044, vazn:800, rang:"a", max:0.6 },
      { tur:"matn", manba:"tafsilot", x:0.11, y:0.878, o:0.021, vazn:600, rang:"a", max:0.6 },
      { tur:"narx", x:0.89, y:0.868, o:0.055, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"bo03", nom:"Bolalar 3", kat:["bolalar","umumiy"],
    uchun:"Yorqin, quvnoq kompozitsiya",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.6 },
      { tur:"naqsh", naqsh:"shevron", rang:"c", alfa:0.14, zich:0.06 },
      { tur:"rasm", x:0.5, y:0.43, w:0.72, h:0.5, anchor:"center", maska:"yumaloq", radius:0.1 },
      { tur:"sticker", manba:"yorliq", shakl:"blob", x:0.79, y:0.19, r:0.125, fonRang:"c", matnRang:"a", burchak:0 },
      { tur:"panel", x:0.07, y:0.78, w:0.86, h:0.155, rang:"c", alfa:0.95, radius:0.05 },
      { tur:"matn", manba:"nom", x:0.11, y:0.835, o:0.044, vazn:800, rang:"a", max:0.6 },
      { tur:"matn", manba:"tafsilot", x:0.11, y:0.878, o:0.021, vazn:600, rang:"a", max:0.6 },
      { tur:"narx", x:0.89, y:0.868, o:0.055, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"bo04", nom:"Bolalar 4", kat:["bolalar","umumiy"],
    uchun:"Yorqin, quvnoq kompozitsiya",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.6 },
      { tur:"naqsh", naqsh:"katak", rang:"c", alfa:0.14, zich:0.06 },
      { tur:"rasm", x:0.5, y:0.43, w:0.72, h:0.5, anchor:"center", maska:"blob", radius:0.1 },
      { tur:"sticker", manba:"yorliq", shakl:"blob", x:0.79, y:0.19, r:0.125, fonRang:"c", matnRang:"a", burchak:-12 },
      { tur:"panel", x:0.07, y:0.78, w:0.86, h:0.155, rang:"c", alfa:0.95, radius:0.05 },
      { tur:"matn", manba:"nom", x:0.11, y:0.835, o:0.044, vazn:800, rang:"a", max:0.6 },
      { tur:"matn", manba:"tafsilot", x:0.11, y:0.878, o:0.021, vazn:600, rang:"a", max:0.6 },
      { tur:"narx", x:0.89, y:0.868, o:0.055, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"bo05", nom:"Bolalar 5", kat:["bolalar","umumiy"],
    uchun:"Yorqin, quvnoq kompozitsiya",
    qatlamlar:[
      { tur:"mesh", rang:"a", rang2:"b", kuch:0.6 },
      { tur:"naqsh", naqsh:"nuqta", rang:"c", alfa:0.14, zich:0.06 },
      { tur:"rasm", x:0.5, y:0.43, w:0.72, h:0.5, anchor:"center", maska:"doira", radius:0.1 },
      { tur:"sticker", manba:"yorliq", shakl:"blob", x:0.79, y:0.19, r:0.125, fonRang:"c", matnRang:"a", burchak:10 },
      { tur:"panel", x:0.07, y:0.78, w:0.86, h:0.155, rang:"c", alfa:0.95, radius:0.05 },
      { tur:"matn", manba:"nom", x:0.11, y:0.835, o:0.044, vazn:800, rang:"a", max:0.6 },
      { tur:"matn", manba:"tafsilot", x:0.11, y:0.878, o:0.021, vazn:600, rang:"a", max:0.6 },
      { tur:"narx", x:0.89, y:0.868, o:0.055, vazn:900, rang:"a", anchor:"right" },
      { tur:"logo", x:0.06, y:0.975, o:0.019, rang:"d" },
    ],
  },
  {
    id:"sp01", nom:"Sport 1", kat:["sport","umumiy"],
    uchun:"Dinamik kesim, kuchli tipografika",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"burchak", rang:"b", balandlik:0.42, qiya:0.14 },
      { tur:"naqsh", naqsh:"chiziq", rang:"c", alfa:0.1, zich:0.05 },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.11, o:0.075, vazn:900, rang:"a", max:0.86, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.58, w:0.8, h:0.46, anchor:"center" },
      { tur:"ikonka", ikona:"olov", x:0.1, y:0.855, r:0.028, rang:"b" },
      { tur:"matn", manba:"nom", x:0.18, y:0.865, o:0.04, vazn:800, rang:"c", max:0.7 },
      { tur:"narx", x:0.06, y:0.945, o:0.095, vazn:900, rang:"b" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"sp02", nom:"Sport 2", kat:["sport","umumiy"],
    uchun:"Dinamik kesim, kuchli tipografika",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"burchak", rang:"b", balandlik:0.55, qiya:-0.1 },
      { tur:"naqsh", naqsh:"chiziq", rang:"c", alfa:0.1, zich:0.05 },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.11, o:0.075, vazn:900, rang:"a", max:0.86, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.58, w:0.8, h:0.46, anchor:"center" },
      { tur:"ikonka", ikona:"belgi", x:0.1, y:0.855, r:0.028, rang:"b" },
      { tur:"matn", manba:"nom", x:0.18, y:0.865, o:0.04, vazn:800, rang:"c", max:0.7 },
      { tur:"narx", x:0.06, y:0.945, o:0.095, vazn:900, rang:"b" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"sp03", nom:"Sport 3", kat:["sport","umumiy"],
    uchun:"Dinamik kesim, kuchli tipografika",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"burchak", rang:"b", balandlik:0.36, qiya:0.18 },
      { tur:"naqsh", naqsh:"chiziq", rang:"c", alfa:0.1, zich:0.05 },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.11, o:0.075, vazn:900, rang:"a", max:0.86, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.58, w:0.8, h:0.46, anchor:"center" },
      { tur:"ikonka", ikona:"yulduz", x:0.1, y:0.855, r:0.028, rang:"b" },
      { tur:"matn", manba:"nom", x:0.18, y:0.865, o:0.04, vazn:800, rang:"c", max:0.7 },
      { tur:"narx", x:0.06, y:0.945, o:0.095, vazn:900, rang:"b" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"sp04", nom:"Sport 4", kat:["sport","umumiy"],
    uchun:"Dinamik kesim, kuchli tipografika",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"burchak", rang:"b", balandlik:0.48, qiya:0.08 },
      { tur:"naqsh", naqsh:"chiziq", rang:"c", alfa:0.1, zich:0.05 },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.11, o:0.075, vazn:900, rang:"a", max:0.86, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.58, w:0.8, h:0.46, anchor:"center" },
      { tur:"ikonka", ikona:"olov", x:0.1, y:0.855, r:0.028, rang:"b" },
      { tur:"matn", manba:"nom", x:0.18, y:0.865, o:0.04, vazn:800, rang:"c", max:0.7 },
      { tur:"narx", x:0.06, y:0.945, o:0.095, vazn:900, rang:"b" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"sp05", nom:"Sport 5", kat:["sport","umumiy"],
    uchun:"Dinamik kesim, kuchli tipografika",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"burchak", rang:"b", balandlik:0.6, qiya:-0.14 },
      { tur:"naqsh", naqsh:"chiziq", rang:"c", alfa:0.1, zich:0.05 },
      { tur:"matn", manba:"yorliq", x:0.06, y:0.11, o:0.075, vazn:900, rang:"a", max:0.86, satr:2, katta:true },
      { tur:"rasm", x:0.5, y:0.58, w:0.8, h:0.46, anchor:"center" },
      { tur:"ikonka", ikona:"yorliq", x:0.1, y:0.855, r:0.028, rang:"b" },
      { tur:"matn", manba:"nom", x:0.18, y:0.865, o:0.04, vazn:800, rang:"c", max:0.7 },
      { tur:"narx", x:0.06, y:0.945, o:0.095, vazn:900, rang:"b" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"un01", nom:"Ulgurji 1", kat:["umumiy"],
    uchun:"Artikul, pochka, telefon — to'liq",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"naqsh", naqsh:"katak", rang:"a", alfa:0.05, zich:0.04 },
      { tur:"rasm", x:0.5, y:0.36, w:0.74, h:0.46, anchor:"center" },
      { tur:"chiziq", x:0.07, y:0.68, w:0.86, rang:"a" },
      { tur:"ikonka", ikona:"yuk", x:0.1, y:0.735, r:0.026, rang:"b" },
      { tur:"matn", manba:"nom", x:0.17, y:0.745, o:0.042, vazn:800, rang:"a", max:0.76 },
      { tur:"matn", manba:"tafsilot", x:0.07, y:0.805, o:0.025, vazn:700, rang:"d", max:0.86 },
      { tur:"narx", x:0.07, y:0.895, o:0.07, vazn:900, rang:"b" },
      { tur:"matn", manba:"dokon", x:0.07, y:0.945, o:0.024, vazn:700, rang:"d", max:0.5 },
      { tur:"matn", manba:"tel", x:0.93, y:0.945, o:0.026, vazn:800, rang:"a", anchor:"right", max:0.45 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"un02", nom:"Ulgurji 2", kat:["umumiy"],
    uchun:"Artikul, pochka, telefon — to'liq",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"naqsh", naqsh:"nuqta", rang:"a", alfa:0.05, zich:0.04 },
      { tur:"rasm", x:0.5, y:0.36, w:0.74, h:0.46, anchor:"center" },
      { tur:"chiziq", x:0.07, y:0.68, w:0.86, rang:"a" },
      { tur:"ikonka", ikona:"yorliq", x:0.1, y:0.735, r:0.026, rang:"b" },
      { tur:"matn", manba:"nom", x:0.17, y:0.745, o:0.042, vazn:800, rang:"a", max:0.76 },
      { tur:"matn", manba:"tafsilot", x:0.07, y:0.805, o:0.025, vazn:700, rang:"d", max:0.86 },
      { tur:"narx", x:0.07, y:0.895, o:0.07, vazn:900, rang:"b" },
      { tur:"matn", manba:"dokon", x:0.07, y:0.945, o:0.024, vazn:700, rang:"d", max:0.5 },
      { tur:"matn", manba:"tel", x:0.93, y:0.945, o:0.026, vazn:800, rang:"a", anchor:"right", max:0.45 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"un03", nom:"Ulgurji 3", kat:["umumiy"],
    uchun:"Artikul, pochka, telefon — to'liq",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"naqsh", naqsh:"chiziq", rang:"a", alfa:0.05, zich:0.04 },
      { tur:"rasm", x:0.5, y:0.36, w:0.74, h:0.46, anchor:"center" },
      { tur:"chiziq", x:0.07, y:0.68, w:0.86, rang:"a" },
      { tur:"ikonka", ikona:"belgi", x:0.1, y:0.735, r:0.026, rang:"b" },
      { tur:"matn", manba:"nom", x:0.17, y:0.745, o:0.042, vazn:800, rang:"a", max:0.76 },
      { tur:"matn", manba:"tafsilot", x:0.07, y:0.805, o:0.025, vazn:700, rang:"d", max:0.86 },
      { tur:"narx", x:0.07, y:0.895, o:0.07, vazn:900, rang:"b" },
      { tur:"matn", manba:"dokon", x:0.07, y:0.945, o:0.024, vazn:700, rang:"d", max:0.5 },
      { tur:"matn", manba:"tel", x:0.93, y:0.945, o:0.026, vazn:800, rang:"a", anchor:"right", max:0.45 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"un04", nom:"Ulgurji 4", kat:["umumiy"],
    uchun:"Artikul, pochka, telefon — to'liq",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"naqsh", naqsh:"shevron", rang:"a", alfa:0.05, zich:0.04 },
      { tur:"rasm", x:0.5, y:0.36, w:0.74, h:0.46, anchor:"center" },
      { tur:"chiziq", x:0.07, y:0.68, w:0.86, rang:"a" },
      { tur:"ikonka", ikona:"yulduz", x:0.1, y:0.735, r:0.026, rang:"b" },
      { tur:"matn", manba:"nom", x:0.17, y:0.745, o:0.042, vazn:800, rang:"a", max:0.76 },
      { tur:"matn", manba:"tafsilot", x:0.07, y:0.805, o:0.025, vazn:700, rang:"d", max:0.86 },
      { tur:"narx", x:0.07, y:0.895, o:0.07, vazn:900, rang:"b" },
      { tur:"matn", manba:"dokon", x:0.07, y:0.945, o:0.024, vazn:700, rang:"d", max:0.5 },
      { tur:"matn", manba:"tel", x:0.93, y:0.945, o:0.026, vazn:800, rang:"a", anchor:"right", max:0.45 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"un05", nom:"Ulgurji 5", kat:["umumiy"],
    uchun:"Artikul, pochka, telefon — to'liq",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"naqsh", naqsh:"suzani", rang:"a", alfa:0.05, zich:0.04 },
      { tur:"rasm", x:0.5, y:0.36, w:0.74, h:0.46, anchor:"center" },
      { tur:"chiziq", x:0.07, y:0.68, w:0.86, rang:"a" },
      { tur:"ikonka", ikona:"yuk", x:0.1, y:0.735, r:0.026, rang:"b" },
      { tur:"matn", manba:"nom", x:0.17, y:0.745, o:0.042, vazn:800, rang:"a", max:0.76 },
      { tur:"matn", manba:"tafsilot", x:0.07, y:0.805, o:0.025, vazn:700, rang:"d", max:0.86 },
      { tur:"narx", x:0.07, y:0.895, o:0.07, vazn:900, rang:"b" },
      { tur:"matn", manba:"dokon", x:0.07, y:0.945, o:0.024, vazn:700, rang:"d", max:0.5 },
      { tur:"matn", manba:"tel", x:0.93, y:0.945, o:0.026, vazn:800, rang:"a", anchor:"right", max:0.45 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"un06", nom:"Minimal 1", kat:["umumiy"],
    uchun:"Sokin, ko'p bo'sh joy",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"rasm", x:0.5, y:0.44, w:0.68, h:0.52, anchor:"center", maska:"doira", radius:0.08 },
      { tur:"matn", manba:"nom", x:0.5, y:0.115, o:0.04, vazn:700, rang:"a", max:0.82, anchor:"center" },
      { tur:"narx", x:0.5, y:0.905, o:0.07, vazn:900, rang:"a", qopqa:"b", qopqaMatn:"a", anchor:"center" },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.955, o:0.022, vazn:600, rang:"d", max:0.7, anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"un07", nom:"Minimal 2", kat:["umumiy"],
    uchun:"Sokin, ko'p bo'sh joy",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"rasm", x:0.5, y:0.44, w:0.68, h:0.52, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.07, y:0.115, o:0.04, vazn:700, rang:"a", max:0.82 },
      { tur:"narx", x:0.07, y:0.915, o:0.09, vazn:900, rang:"a" },
      { tur:"matn", manba:"tafsilot", x:0.07, y:0.955, o:0.022, vazn:600, rang:"d", max:0.7 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"un08", nom:"Minimal 3", kat:["umumiy"],
    uchun:"Sokin, ko'p bo'sh joy",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"rasm", x:0.5, y:0.44, w:0.68, h:0.52, anchor:"center", maska:"yumaloq", radius:0.08 },
      { tur:"matn", manba:"nom", x:0.07, y:0.115, o:0.04, vazn:700, rang:"a", max:0.82 },
      { tur:"narx", x:0.07, y:0.905, o:0.07, vazn:900, rang:"a", qopqa:"b", qopqaMatn:"a" },
      { tur:"matn", manba:"tafsilot", x:0.07, y:0.955, o:0.022, vazn:600, rang:"d", max:0.7 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"un09", nom:"Minimal 4", kat:["umumiy"],
    uchun:"Sokin, ko'p bo'sh joy",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"rasm", x:0.5, y:0.44, w:0.68, h:0.52, anchor:"center", maska:"arch", radius:0.08 },
      { tur:"matn", manba:"nom", x:0.5, y:0.115, o:0.04, vazn:700, rang:"a", max:0.82, anchor:"center" },
      { tur:"narx", x:0.5, y:0.915, o:0.09, vazn:900, rang:"a", anchor:"center" },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.955, o:0.022, vazn:600, rang:"d", max:0.7, anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"un10", nom:"Minimal 5", kat:["umumiy"],
    uchun:"Sokin, ko'p bo'sh joy",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"rasm", x:0.5, y:0.44, w:0.68, h:0.52, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.5, y:0.115, o:0.04, vazn:700, rang:"a", max:0.82, anchor:"center" },
      { tur:"narx", x:0.5, y:0.905, o:0.07, vazn:900, rang:"a", qopqa:"b", qopqaMatn:"a", anchor:"center" },
      { tur:"matn", manba:"tafsilot", x:0.5, y:0.955, o:0.022, vazn:600, rang:"d", max:0.7, anchor:"center" },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"un11", nom:"Minimal 6", kat:["umumiy"],
    uchun:"Sokin, ko'p bo'sh joy",
    qatlamlar:[
      { tur:"fon", rang:"c" },
      { tur:"rasm", x:0.5, y:0.44, w:0.68, h:0.52, anchor:"center", maska:"blob", radius:0.08 },
      { tur:"matn", manba:"nom", x:0.07, y:0.115, o:0.04, vazn:700, rang:"a", max:0.82 },
      { tur:"narx", x:0.07, y:0.915, o:0.09, vazn:900, rang:"a" },
      { tur:"matn", manba:"tafsilot", x:0.07, y:0.955, o:0.022, vazn:600, rang:"d", max:0.7 },
      { tur:"logo", x:0.94, y:0.975, o:0.019, rang:"d", anchor:"right" },
    ],
  },

  // ═══ ✅ FOTOSAHNA (2026-09-06) — bezakli sahna uchun ═══
  {
    id:"fs01", nom:"Fotosahna 1", kat:["oyoq","kiyim","sumka","umumiy"],
    uchun:"Sahna hukmron, matn kam — katalog uslubi",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.6, w:0.8, h:0.52, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.07, y:0.905, o:0.034, vazn:700, rang:"c", max:0.7, soya:true },
      { tur:"narx", x:0.07, y:0.955, o:0.052700000000000004, vazn:900, rang:"c" },
      { tur:"logo", x:0.93, y:0.965, o:0.017, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"fs02", nom:"Fotosahna 2", kat:["oyoq","kiyim","sumka","umumiy"],
    uchun:"Sahna hukmron, matn kam — katalog uslubi",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.58, w:0.8, h:0.52, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.93, y:0.905, o:0.03, vazn:700, rang:"c", max:0.7, soya:true, anchor:"right" },
      { tur:"narx", x:0.93, y:0.955, o:0.0465, vazn:900, rang:"c", anchor:"right" },
      { tur:"logo", x:0.93, y:0.965, o:0.016, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"fs03", nom:"Fotosahna 3", kat:["oyoq","kiyim","sumka","umumiy"],
    uchun:"Sahna hukmron, matn kam — katalog uslubi",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.62, w:0.8, h:0.52, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.5, y:0.905, o:0.036, vazn:700, rang:"c", max:0.7, soya:true, anchor:"center" },
      { tur:"narx", x:0.5, y:0.955, o:0.055799999999999995, vazn:900, rang:"c", anchor:"center" },
      { tur:"logo", x:0.93, y:0.965, o:0.017, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"fs04", nom:"Fotosahna 4", kat:["oyoq","kiyim","sumka","umumiy"],
    uchun:"Sahna hukmron, matn kam — katalog uslubi",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.57, w:0.8, h:0.52, anchor:"center" },
      { tur:"matn", manba:"nom", x:0.07, y:0.905, o:0.028, vazn:700, rang:"c", max:0.7, soya:true },
      { tur:"narx", x:0.07, y:0.955, o:0.0434, vazn:900, rang:"c" },
      { tur:"logo", x:0.93, y:0.965, o:0.015, rang:"d", anchor:"right" },
    ],
  },
  {
    id:"fs05", nom:"Fotosahna 5", kat:["oyoq","kiyim","sumka","umumiy"],
    uchun:"Sahna + kichik narx qopqasi",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.58, w:0.82, h:0.54, anchor:"center" },
      { tur:"narx", x:0.93, y:0.93, o:0.052, vazn:900, rang:"a", qopqa:"b", qopqaMatn:"a", anchor:"right" },
      { tur:"matn", manba:"nom", x:0.07, y:0.935, o:0.03, vazn:700, rang:"c", max:0.5, soya:true },
      { tur:"logo", x:0.5, y:0.975, o:0.016, rang:"d", anchor:"center" },
    ],
  },
  {
    id:"fs06", nom:"Fotosahna 6", kat:["oyoq","kiyim","sumka","umumiy"],
    uchun:"Sahna + kichik narx qopqasi",
    qatlamlar:[
      { tur:"fon", rang:"a" },
      { tur:"rasm", x:0.5, y:0.58, w:0.82, h:0.54, anchor:"center" },
      { tur:"narx", x:0.07, y:0.93, o:0.052, vazn:900, rang:"a", qopqa:"b", qopqaMatn:"a" },
      { tur:"matn", manba:"nom", x:0.93, y:0.935, o:0.03, vazn:700, rang:"c", max:0.5, soya:true, anchor:"right" },
      { tur:"logo", x:0.5, y:0.975, o:0.016, rang:"d", anchor:"center" },
    ],
  },
];

// ── Holat ──────────────────────────────────────────────────────
const STU = {
  shab: "narx", pal: "navy", fmt: "post",
  tipo: "kuchli",              // ✅ A2: tipografika juftligi
  rasmlar: [],                 // ✅ KK: tovar suratlari (4 slotgacha)
  shaxs: null,                 // ✅ KK: xodim/model surati (o'zimizniki)
  asosiy: 0,                   // qaysi slot asosiy rasm
  katFiltr: "hammasi",         // ✅ B1: shablon brauzeri filtri
  qidiruv: "",                 // ✅ B1: shablon qidiruvi
  sevimli: [],                 // ✅ B1: sevimli shablonlar
  brend: {},                   // ✅ A2: dokon_nom, tel, brend_rang, logo
  real: false,                 // ✅ S6: real shaxs rejimi (AI yuzga tegmaydi)
  fokus: { x: .5, y: .38 },    // ✅ S6: kadrlash nuqtasi (yuz odatda tepada)
  tovar: null,          // {nom, art, rang, olcham, narx}
  img: null,            // Image (telefonda olingan surat)
  imgAdj: { zoom: 1, dx: 0, dy: 0 },
  yorliq: "YANGI KELDI",
  muddat: "",
  eskiNarx: 0,
  narxKorsat: true,
  belgi: true,          // merx.uz yozuvi
};

// ── Yordamchilar ───────────────────────────────────────────────
function stRang(pal, k) {
  if (!k) return "#000";
  if (String(k).charAt(0) === "#") return k;
  return pal[k] || "#000";
}
function stBrendPal() {                       // ✅ A2
  const b = STU.brend || {};
  if (!b.brend_rang) return null;
  return { id:"brend", nom:"Brend", a: b.brend_rang,
           b: b.brend_rang2 || "#FFFFFF", c:"#FFFFFF", d:"#D8DCE3" };
}
function stPal() {
  if (STU.pal === "brend") { const p = stBrendPal(); if (p) return p; }   // ✅ A2
  if (STU.pal === "auto" && STU.avtoPal) return STU.avtoPal;   // ✅ S1
  return STU_PAL.find(p => p.id === STU.pal) || STU_PAL[0];
}
function stShab() { return STU_SHAB.find(s => s.id === STU.shab) || STU_SHAB[0]; }
function stFmt()  { return STU_FMT.find(f => f.id === STU.fmt)  || STU_FMT[0]; }
function stSon(n) {
  n = Math.round(Number(n) || 0);
  let t = String(n), o = "", c = 0;
  for (let i = t.length - 1; i >= 0; i--) {
    o = t.charAt(i) + o; c++;
    if (c % 3 === 0 && i > 0) o = " " + o;
  }
  return o;
}
// matnni kenglikka sig'dirish (shriftni kichraytiradi)
function stFit(ctx, matn, maxW, px, vazn, fam) {
  fam = fam || (STU_TIPO[0].d + "," + STU_ZAX);
  let p = px;
  while (p > 8) {
    ctx.font = `${vazn} ${p}px ${fam}`;
    if (ctx.measureText(matn).width <= maxW) break;
    p -= Math.max(1, Math.round(p * 0.04));
  }
  return p;
}
// ikki satrga bo'lish
function stWrap(ctx, matn, maxW, px, vazn, satr, fam) {
  fam = fam || (STU_TIPO[0].d + "," + STU_ZAX);
  ctx.font = `${vazn} ${px}px ${fam}`;
  if (satr < 2 || ctx.measureText(matn).width <= maxW) return [matn];
  const soz = String(matn).split(/\s+/), qatorlar = [];
  let joriy = "";
  soz.forEach(s => {
    const sinov = joriy ? joriy + " " + s : s;
    if (ctx.measureText(sinov).width > maxW && joriy) { qatorlar.push(joriy); joriy = s; }
    else joriy = sinov;
  });
  if (joriy) qatorlar.push(joriy);
  return qatorlar.slice(0, satr);
}
// ═══ ✅ S2 (2026-09-06) — SIFAT QATLAMI (hammasi KOD, AI'siz) ═══
// · _stuTrim  — fon kesilgandan keyin qolgan SHAFFOF chekkalarni
//   olib tashlaydi. Busiz tovar kadrda kichkina bo'lib qolardi.
// · _lum      — matn ORTIDAGI yorqinlikni o'lchaydi → matn rangi
//   avtomatik oq yoki to'q bo'ladi (har fonda o'qiladi).
// · _sz       — XAVFSIZ ZONA: Stories (9:16) da tepa/past qismini
//   Telegram va Instagram tugmalari yopadi — matn u yerga tushmaydi.
function _stuTrim(im) {
  try {
    const c = document.createElement("canvas");
    c.width = im.width; c.height = im.height;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0, bor = false;
    for (let y = 0; y < c.height; y++) {
      for (let xx = 0; xx < c.width; xx++) {
        if (d[(y * c.width + xx) * 4 + 3] > 12) {
          bor = true;
          if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
          if (y  < y0) y0 = y;  if (y  > y1) y1 = y;
        }
      }
    }
    if (!bor || x1 <= x0 || y1 <= y0) return im;
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * .02);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(c.width  - 1, x1 + pad);
    y1 = Math.min(c.height - 1, y1 + pad);
    const o = document.createElement("canvas");
    o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o;                       // canvas ham drawImage uchun yaroqli
  } catch (e) { return im; }
}
function _lum(ctx, x, y, w, h) {
  try {
    x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    const d = ctx.getImageData(x, y, w, h).data;
    let s = 0, k = 0;
    for (let i = 0; i < d.length; i += 4 * 9) {
      s += (0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2]); k++;
    }
    return k ? s / k / 255 : .5;
  } catch (e) { return .5; }
}
function _sz(y, F) {
  const uzun = F.h / F.w > 1.5;          // 9:16 — Stories
  const t = uzun ? .10 : .025, b = uzun ? .86 : .975;
  return Math.min(Math.max(y, t), b);
}
// ═══ ✅ A2 (2026-09-06) — TIPOGRAFIKA JUFTLIKLARI ═══
// Har juftlikda: sarlavha shrifti + matn shrifti + harflar orasi +
// katta harf qoidasi. Shablon o'zgarmaydi, TIPOGRAFIKA o'zgaradi —
// shu tufayli bitta layout bir necha xil "kayfiyatda" chiqadi.
// Hammasi ochiq litsenziyali (Google Fonts) — huquqi toza.
const STU_TIPO = [
  { id:"kuchli",   nom:"Kuchli",    d:'"Archivo Black"',      b:'"Manrope"',       tr:-.02, katta:false },
  { id:"zamon",    nom:"Zamonaviy", d:'"Space Grotesk"',      b:'"Space Grotesk"', tr:-.01, katta:false },
  { id:"nafis",    nom:"Nafis",     d:'"Playfair Display"',   b:'"Manrope"',       tr:0,    katta:false },
  { id:"baland",   nom:"Baland",    d:'"Oswald"',             b:'"Rubik"',         tr:.02,  katta:true  },
  { id:"yumshoq",  nom:"Yumshoq",   d:'"Rubik"',              b:'"Rubik"',         tr:0,    katta:false },
  { id:"jasur",    nom:"Jasur",     d:'"Unbounded"',          b:'"Manrope"',       tr:-.01, katta:true  },
];
const STU_ZAX = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
function stTipo() { return STU_TIPO.find(t => t.id === STU.tipo) || STU_TIPO[0]; }
// Qatlam roliga qarab shrift: sarlavha va narx — display, qolgani — matn
function _fam(L) {
  const T = stTipo();
  const disp = L.shrift === "body" ? false
    : (L.shrift === "disp" || L.manba === "nom" || L.tur === "narx" ||
       L.tur === "sticker" || (L.vazn || 700) >= 800);
  return (disp ? T.d : T.b) + "," + STU_ZAX;
}
// ✅ A2: O'ZBEK BELGILARI — ʻ va ʼ hamma shriftda yo'q; oddiy
// apostrofga aylantiramiz, shunda "tofu" kvadrat chiqmaydi.
function _uz(s) {
  return String(s == null ? "" : s)
    .replace(/[\u02bb\u02bc\u2018\u2019\u0060\u00b4]/g, "'");
}
const STU_SHRIFT = '"Inter","Archivo",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

// manba → matn
function stManba(m) {
  const t = STU.tovar || {};
  switch (m) {
    case "nom":       return _uz(t.nom || "Tovar nomi");
    case "tafsilot": {
      // ✅ S4b: bo'sh qiymatlar tashlanadi — jonlida "qora · ·"
      // ko'rinishida ortiqcha ajratkichlar chiqib qolgan edi.
      return [t.art ? "ART " + t.art : "", t.rang || "", t.olcham || ""]
        .map(x => _uz(x).trim()).filter(Boolean).join("  ·  ");
    }
    case "yorliq":    return _uz(STU.yorliq || "");
    case "tel":       return _uz((STU.brend && STU.brend.tel) || "");
    case "dokon":     return _uz((STU.brend && STU.brend.dokon_nom) || "");
    case "muddat":    return STU.muddat || "";
    case "eskiNarx":  return STU.eskiNarx ? stSon(STU.eskiNarx) + " so'm" : "";
    case "narxQisqa": {
      const n = Number(t.narx) || 0;
      return n >= 1000000 ? (Math.round(n / 100000) / 10) + " mln"
           : n >= 1000    ? Math.round(n / 1000) + "k" : String(n);
    }
    default: return "";
  }
}

// ═══ ✅ A1 (2026-09-06) — ShAKL VA EFFEKT YORDAMChILARI ═══
// Bularsiz shablon "matn + to'rtburchak"dan nariga o'tmaydi.
// Hammasi KOD bilan chiziladi: xarajat 0, cheksiz takrorlanadi.
function _yumT(ctx, x, y, w, h, r) {          // yumaloq to'rtburchak
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function _yulduz(ctx, cx, cy, r, uch, ich) {   // yulduz / muhr shakli
  ctx.beginPath();
  const n = uch * 2;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = i % 2 ? r * ich : r;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}
function _blob(ctx, cx, cy, r) {               // yumshoq "tomchi" shakl
  ctx.beginPath();
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const rr = r * (i % 2 ? .88 : 1.06);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (!i) ctx.moveTo(x, y);
    else {
      const a0 = (Math.PI * 2 * (i - .5)) / n;
      ctx.quadraticCurveTo(cx + Math.cos(a0) * r * 1.14,
                           cy + Math.sin(a0) * r * 1.14, x, y);
    }
  }
  ctx.closePath();
}
function _arch(ctx, x, y, w, h) {              // yuqorisi yarim doira (arch)
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}
// Naqsh: kod bilan chiziladigan fon bezaklari (AI'siz, cheksiz)
function _naqsh(ctx, W, H, tur, rang, zich, alfa) {
  ctx.save();
  ctx.globalAlpha = alfa == null ? .12 : alfa;
  ctx.fillStyle = rang; ctx.strokeStyle = rang;
  const q = Math.max(18, W * (zich || .045));
  if (tur === "nuqta") {
    for (let y = q / 2; y < H; y += q)
      for (let x = q / 2; x < W; x += q) {
        ctx.beginPath(); ctx.arc(x, y, q * .09, 0, Math.PI * 2); ctx.fill();
      }
  } else if (tur === "katak") {
    ctx.lineWidth = Math.max(1, W * .0015);
    for (let x = 0; x < W; x += q) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += q) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  } else if (tur === "chiziq") {
    ctx.lineWidth = Math.max(1, W * .006);
    for (let x = -H; x < W; x += q) {
      ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke();
    }
  } else if (tur === "shevron") {
    ctx.lineWidth = Math.max(1, W * .005);
    for (let y = 0; y < H + q; y += q)
      for (let x = 0; x < W + q; x += q) {
        ctx.beginPath(); ctx.moveTo(x, y + q * .5);
        ctx.lineTo(x + q * .5, y); ctx.lineTo(x + q, y + q * .5); ctx.stroke();
      }
  } else if (tur === "suzani") {
    // ✅ O'ZBEK NAQShI — bizning ustunligimiz: chet shablonlarda yo'q
    for (let y = q; y < H + q; y += q * 1.7)
      for (let x = q; x < W + q; x += q * 1.7) {
        _yulduz(ctx, x, y, q * .42, 8, .45); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, q * .13, 0, Math.PI * 2);
        ctx.globalCompositeOperation = "destination-out"; ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
  }
  ctx.restore();
}

// ── ChIZUVChI (retseptni o'qiydi) ──────────────────────────────
function stChiz(cvs, fmt, opt) {
  // ✅ S1: `opt` — {shab, pal} bo'lsa O'ShA variant chiziladi
  // (galereyadagi 6 namuna shu bilan quriladi), aks holda joriy holat.
  const F = fmt || stFmt();
  const S = (opt && opt.shab)
    ? (STU_SHAB.find(x => x.id === opt.shab) || stShab()) : stShab();
  const P = (opt && opt.pal)
    ? (typeof opt.pal === "object" ? opt.pal
       : (opt.pal === "brend" && stBrendPal() ? stBrendPal()
          : opt.pal === "auto" && STU.avtoPal ? STU.avtoPal
          : (STU_PAL.find(x => x.id === opt.pal) || stPal())))
    : stPal();
  const c = cvs || document.getElementById("stu-cvs");
  if (!c) return;
  c.width = F.w; c.height = F.h;
  const ctx = c.getContext("2d");
  const W = F.w, H = F.h;
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // ✅ S5: ANIMATSIYA — `STU._anim` o'rnatilgan bo'lsa har qatlam
  // o'z vaqtida chiqadi (video yozishda). Bo'sh bo'lsa — oddiy chizish,
  // ya'ni rasm rejimida hech narsa o'zgarmaydi.
  const AN = STU._anim;                       // {t: 0..1} yoki null
  const _ea = x => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);  // yumshoq
  let _qi = 0;

  S.qatlamlar.forEach(L => {
    // qatlamning "chiqish" payti: rasm birinchi, matnlar ketma-ket
    let _a = 1, _dy = 0, _sc = 1;
    if (AN) {
      const t = AN.t;
      if (L.tur === "rasm") { _a = _ea(t / .12); _sc = 1 + .085 * t; }
      // ✅ A1: FON SINFIDAGI qatlamlar animatsiyada DOIM ko'rinadi
      // (gradient, mesh, naqsh, textura, ramka, nur ham fon hisoblanadi —
      //  stend 0-kadrda bo'sh kadr ushlab qoldi).
      else if (["fon","blok","burchak","gradient","mesh","naqsh","textura",
                "ramka","nur","panel"].indexOf(L.tur) >= 0) { _a = 1; }
      else {
        const bosh = .18 + _qi * .09;         // har element 0.09 kechikadi
        const l = _ea((t - bosh) / .16);
        _a = l; _dy = (1 - l) * (L.o || .03) * H * .5;
        if (L.tur === "narx") _sc = 1 + .18 * (1 - _ea((t - bosh) / .22));
        _qi++;
      }
      if (_a <= 0.001) return;                // hali chiqmagan
    }
    ctx.globalAlpha = _a;
    ctx.save();
    if (_dy) ctx.translate(0, _dy);
    try {
      switch (L.tur) {

        case "fon":
          ctx.fillStyle = stRang(P, L.rang);
          ctx.fillRect(0, 0, W, H);
          break;

        case "blok": {
          ctx.fillStyle = stRang(P, L.rang);
          if (L.radius) { _yumT(ctx, L.x * W, L.y * H, L.w * W, L.h * H, L.radius * W); ctx.fill(); }
          else ctx.fillRect(L.x * W, L.y * H, L.w * W, L.h * H);
          break;
        }

        // ✅ A1: GRADIENT FON — burchak va to'xtash nuqtalari bilan
        case "gradient": {
          const a = (L.burchak || 90) * Math.PI / 180;
          const g = ctx.createLinearGradient(
            W / 2 - Math.cos(a) * W / 2, H / 2 - Math.sin(a) * H / 2,
            W / 2 + Math.cos(a) * W / 2, H / 2 + Math.sin(a) * H / 2);
          g.addColorStop(0, stRang(P, L.rang || "a"));
          if (L.orta) g.addColorStop(.5, stRang(P, L.orta));
          g.addColorStop(1, stRang(P, L.rang2 || "b"));
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          break;
        }

        // ✅ A1: MESH — yumshoq rangli dog'lar (zamonaviy fon)
        case "mesh": {
          ctx.fillStyle = stRang(P, L.rang || "a");
          ctx.fillRect(0, 0, W, H);
          const dogl = [[.22, .18, "b"], [.78, .30, L.rang2 || "d"],
                        [.35, .82, "b"], [.85, .78, L.rang2 || "d"]];
          dogl.forEach(([x, y, r]) => {
            const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, W * .55);
            g.addColorStop(0, stRang(P, r));
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.save(); ctx.globalAlpha = L.kuch || .5;
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
          });
          break;
        }

        // ✅ A1: NAQSh — nuqta, katak, chiziq, shevron, SUZANI
        case "naqsh":
          _naqsh(ctx, W, H, L.naqsh || "nuqta", stRang(P, L.rang || "c"),
                 L.zich, L.alfa);
          break;

        // ✅ A1: TEXTURA — qog'oz/shovqin (rasm "yassi" ko'rinmasin)
        case "textura": {
          ctx.save(); ctx.globalAlpha = L.alfa || .05;
          ctx.fillStyle = stRang(P, L.rang || "c");
          const q = Math.max(2, W * .004);
          for (let i = 0; i < W * H / (q * q * 26); i++) {
            ctx.fillRect(Math.random() * W, Math.random() * H, q, q);
          }
          ctx.restore();
          break;
        }

        // ✅ A1: RAMKA — ichki chiziq / ikki chiziq / burchaklar
        case "ramka": {
          const m = (L.chet || .045) * W;
          ctx.strokeStyle = stRang(P, L.rang || "b");
          ctx.lineWidth = (L.qalin || .004) * W;
          if (L.uslub === "burchak") {
            const u = (L.uzunlik || .10) * W;
            [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]
              .forEach(([x, y, sx, sy]) => {
                ctx.beginPath();
                ctx.moveTo(x, y + sy * u); ctx.lineTo(x, y); ctx.lineTo(x + sx * u, y);
                ctx.stroke();
              });
          } else {
            ctx.strokeRect(m, m, W - m * 2, H - m * 2);
            if (L.uslub === "ikki") {
              const m2 = m + (L.oraliq || .012) * W;
              ctx.lineWidth = ctx.lineWidth * .55;
              ctx.strokeRect(m2, m2, W - m2 * 2, H - m2 * 2);
            }
          }
          break;
        }

        // ✅ A1: BURChAK LENTASI ("YANGI", "-30%")
        case "lenta": {
          const matn = stManba(L.manba) || L.matn || "";
          if (!matn) break;
          const en = (L.en || .30) * W;
          ctx.save();
          const ong = L.tomon !== "chap";
          ctx.translate(ong ? W : 0, 0);
          ctx.rotate((ong ? 45 : -45) * Math.PI / 180);
          ctx.fillStyle = stRang(P, L.fonRang || "b");
          ctx.fillRect(-en, (L.y || .10) * H, en * 2, (L.qalin || .075) * H);
          ctx.fillStyle = stRang(P, L.matnRang || "a");
          const pz = (L.o || .032) * W;
          ctx.font = `800 ${pz}px ${_fam(L)}`;
          ctx.textAlign = "center";
          ctx.fillText(matn.toUpperCase(), 0,
                       (L.y || .10) * H + (L.qalin || .075) * H * .68);
          ctx.textAlign = "left";
          ctx.restore();
          break;
        }

        // ✅ A1: STIKER — doira / yulduz / muhr, ichida matn
        case "sticker": {
          const matn = stManba(L.manba) || L.matn || "";
          const r = (L.r || .11) * W, cx = L.x * W, cy = _sz(L.y, F) * H;
          ctx.save();
          if (L.burchak) { ctx.translate(cx, cy); ctx.rotate(L.burchak * Math.PI / 180);
                           ctx.translate(-cx, -cy); }
          ctx.fillStyle = stRang(P, L.fonRang || "b");
          if (L.shakl === "yulduz")      { _yulduz(ctx, cx, cy, r, L.uch || 12, .82); ctx.fill(); }
          else if (L.shakl === "muhr")   { _yulduz(ctx, cx, cy, r, L.uch || 20, .93); ctx.fill(); }
          else if (L.shakl === "blob")   { _blob(ctx, cx, cy, r); ctx.fill(); }
          else { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
          if (matn) {
            ctx.fillStyle = stRang(P, L.matnRang || "a");
            let pz = stFit(ctx, matn, r * 1.5, r * .46, 900);
            ctx.textAlign = "center";
            ctx.font = `900 ${pz}px ${_fam(L)}`;
            ctx.fillText(matn, cx, cy + pz * .34);
            ctx.textAlign = "left";
          }
          ctx.restore();
          break;
        }

        // ✅ A1: IKONKA — kod bilan chiziladigan belgilar
        case "ikonka": {
          const r = (L.r || .035) * W, cx = L.x * W, cy = _sz(L.y, F) * H;
          ctx.save();
          ctx.strokeStyle = stRang(P, L.rang || "b");
          ctx.fillStyle = stRang(P, L.rang || "b");
          ctx.lineWidth = r * .22; ctx.lineCap = "round"; ctx.lineJoin = "round";
          const ik = L.ikona || "yulduz";
          if (ik === "yulduz") { _yulduz(ctx, cx, cy, r, 5, .45); ctx.fill(); }
          else if (ik === "belgi") {                       // ✓
            ctx.beginPath(); ctx.moveTo(cx - r * .6, cy);
            ctx.lineTo(cx - r * .1, cy + r * .5); ctx.lineTo(cx + r * .65, cy - r * .5);
            ctx.stroke();
          } else if (ik === "yorliq") {                    // narx yorlig'i
            ctx.beginPath();
            ctx.moveTo(cx - r, cy - r * .5); ctx.lineTo(cx + r * .3, cy - r * .5);
            ctx.lineTo(cx + r, cy); ctx.lineTo(cx + r * .3, cy + r * .5);
            ctx.lineTo(cx - r, cy + r * .5); ctx.closePath(); ctx.stroke();
          } else if (ik === "yuk") {                       // yetkazish
            ctx.strokeRect(cx - r, cy - r * .55, r * 1.2, r * 1.1);
            ctx.beginPath(); ctx.moveTo(cx + r * .2, cy - r * .1);
            ctx.lineTo(cx + r * .75, cy - r * .1); ctx.lineTo(cx + r, cy + r * .25);
            ctx.lineTo(cx + r, cy + r * .55); ctx.lineTo(cx + r * .2, cy + r * .55);
            ctx.closePath(); ctx.stroke();
          } else if (ik === "olov") {
            _blob(ctx, cx, cy, r * .8); ctx.fill();
          }
          ctx.restore();
          break;
        }

        // ✅ A1: PANEL — matn ostidagi yumaloq fon
        case "panel": {
          ctx.save();
          ctx.globalAlpha = L.alfa == null ? 1 : L.alfa;
          ctx.fillStyle = stRang(P, L.rang || "a");
          _yumT(ctx, L.x * W, _sz(L.y, F) * H, L.w * W, L.h * H,
                (L.radius == null ? .03 : L.radius) * W);
          ctx.fill();
          ctx.restore();
          break;
        }

        // ✅ A1: NUR — yorug'lik chizig'i (premium ko'rinish)
        case "nur": {
          const g = ctx.createLinearGradient(0, 0, W, H);
          g.addColorStop(0, "rgba(255,255,255,0)");
          g.addColorStop(.45, "rgba(255,255,255," + (L.kuch || .16) + ")");
          g.addColorStop(.55, "rgba(255,255,255,0)");
          ctx.save(); ctx.translate(W * (L.siljish || 0), 0);
          ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore();
          break;
        }

        // ✅ A1: IKKINChI RASM — kollaj (2-3 tovar bir kadrda)
        case "rasm2": {
          // ✅ KK: slot bo'yicha (2-3-4 tovar kollajda)
          const im2 = STU.rasmlar[(L.slot != null ? L.slot : 1)] || STU.img2;
          const bw = L.w * W, bh = L.h * H;
          const bx = (L.anchor === "center" ? L.x * W - bw / 2 : L.x * W);
          const by = (L.anchor === "center" ? L.y * H - bh / 2 : L.y * H);
          if (!im2) {
            ctx.save(); ctx.globalAlpha = .14;
            ctx.fillStyle = stRang(P, "d");
            _yumT(ctx, bx, by, bw, bh, bw * .06); ctx.fill(); ctx.restore();
            break;
          }
          const k2 = Math.min(bw / im2.width, bh / im2.height);
          const dw2 = im2.width * k2, dh2 = im2.height * k2;
          ctx.drawImage(im2, bx + (bw - dw2) / 2, by + (bh - dh2) / 2, dw2, dh2);
          break;
        }

        case "burchak": {   // diagonal kesim
          ctx.fillStyle = stRang(P, L.rang);
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(W, 0);
          ctx.lineTo(W, L.balandlik * H);
          ctx.lineTo(0, (L.balandlik + (L.qiya || 0)) * H);
          ctx.closePath(); ctx.fill();
          break;
        }

        case "chiziq":
          ctx.strokeStyle = stRang(P, L.rang);
          ctx.globalAlpha = .35; ctx.lineWidth = Math.max(1, W * .002);
          ctx.beginPath(); ctx.moveTo(L.x * W, L.y * H);
          ctx.lineTo((L.x + L.w) * W, L.y * H); ctx.stroke();
          ctx.globalAlpha = 1;
          break;

        case "rasm": {
          // ✅ 1-bosqich: sahna foni (agar tanlangan bo'lsa) — TOVAR
          // OSTIGA to'liq kadr bo'lib chiziladi, tovarga tegilmaydi.
          if (STU.fon) {
            const f = STU.fon;
            const kf = Math.max(W / f.width, H / f.height);
            ctx.drawImage(f, (W - f.width * kf) / 2, (H - f.height * kf) / 2,
              f.width * kf, f.height * kf);
          }
          const bw = L.w * W, bh = L.h * H;
          const bx = (L.anchor === "center" ? L.x * W - bw / 2 : L.x * W);
          const by = (L.anchor === "center" ? L.y * H - bh / 2 : L.y * H);
          if (!STU.img) {                     // rasm hali yo'q — o'rinbosar
            ctx.fillStyle = stRang(P, "d"); ctx.globalAlpha = .18;
            ctx.fillRect(bx, by, bw, bh);
            ctx.globalAlpha = 1;
            ctx.fillStyle = stRang(P, "d");
            ctx.font = `600 ${Math.round(W * .028)}px ${_fam(L)}`;
            ctx.textAlign = "center";
            ctx.fillText("Tovar surati", bx + bw / 2, by + bh / 2);
            ctx.textAlign = "left";
            break;
          }
          const im = STU.img, z = STU.imgAdj.zoom || 1;
          // ✅ S4b: "cover" — rasm maydonni TO'LIQ to'ldiradi (modelli
          // kadrda surat kichkina karta bo'lib qolmasin — jonli kuzatuv).
          const k = (L.moda === "cover"
            ? Math.max(bw / im.width, bh / im.height)
            : Math.min(bw / im.width, bh / im.height)) * z * _sc;   // ✅ S5
          const dw = im.width * k, dh = im.height * k;
          let dx = bx + (bw - dw) / 2 + (STU.imgAdj.dx || 0) * W;
          let dy = by + (bh - dh) / 2 + (STU.imgAdj.dy || 0) * H;
          // ✅ S6: FOKUS — to'liq kadrda (cover) surat FOKUS NUQTASI
          // bo'yicha joylashadi. Shu tufayli bitta kadrdan 9:16, 4:5,
          // 1:1 va 16:9 chiqarilganda BOSh KESILMAYDI. Fokusni
          // namoyish ustiga bosib o'zgartirish mumkin.
          if (L.moda === "cover") {
            const fx = (STU.fokus && STU.fokus.x) || .5;
            const fy = (STU.fokus && STU.fokus.y) || .38;
            dx = bx + bw * .5  - dw * fx;
            dy = by + bh * .46 - dh * fy;
            dx = Math.min(bx, Math.max(bx + bw - dw, dx));
            dy = Math.min(by, Math.max(by + bh - dh, dy));
          }
          // ✅ S1: YERGA TUShISh SOYASI — kesilgan tovar "havoda
          // osilib" qolmasin (jonli kuzatuv, 6-sen). Kod bilan chiziladi.
          if (STU.soya !== false) {
            const sx = dx + dw / 2, sy = dy + dh * .985;
            const g = ctx.createRadialGradient(sx, sy, dw * .04, sx, sy, dw * .42);
            g.addColorStop(0, "rgba(0,0,0,.40)");
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.save(); ctx.translate(sx, sy); ctx.scale(1, .19);
            ctx.translate(-sx, -sy);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(sx, sy, dw * .42, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
          // ✅ A1: MASKA — doira / arch / yumaloq to'rtburchak / blob
          if (L.maska || L.moda === "cover") {
            ctx.save(); ctx.beginPath();
            if (L.maska === "doira")
              ctx.arc(bx + bw / 2, by + bh / 2, Math.min(bw, bh) / 2, 0, Math.PI * 2);
            else if (L.maska === "arch") _arch(ctx, bx, by, bw, bh);
            else if (L.maska === "blob") _blob(ctx, bx + bw / 2, by + bh / 2, Math.min(bw, bh) / 2);
            else if (L.maska === "yumaloq") _yumT(ctx, bx, by, bw, bh, bw * (L.radius || .08));
            else ctx.rect(bx, by, bw, bh);
            ctx.clip();
            ctx.drawImage(im, dx, dy, dw, dh); ctx.restore();
          } else ctx.drawImage(im, dx, dy, dw, dh);
          // ✅ S2: AKS (reflection) — sahna ustida tovar "polga qo'ngan"
          // ko'rinadi. Pastga tomon so'nadi, shaffofligi past.
          if (STU.fon && STU.aks !== false && L.moda !== "cover") {
            try {
              const t = document.createElement("canvas");
              t.width = Math.max(2, Math.round(dw));
              t.height = Math.max(2, Math.round(dh * .34));
              const tx = t.getContext("2d");
              tx.save(); tx.scale(1, -1);
              tx.drawImage(im, 0, -dh, dw, dh);
              tx.restore();
              tx.globalCompositeOperation = "destination-in";
              const gm = tx.createLinearGradient(0, 0, 0, t.height);
              gm.addColorStop(0, "rgba(0,0,0,.30)");
              gm.addColorStop(1, "rgba(0,0,0,0)");
              tx.fillStyle = gm; tx.fillRect(0, 0, t.width, t.height);
              ctx.drawImage(t, dx, dy + dh - 1, dw, t.height);
            } catch (e) {}
          }
          // ✅ S2: RANG BIRLAShTIRISh — tovar va sahna bir yorug'likda
          // ko'rinsin: butun kadrga juda yengil issiq qatlam + vinetka.
          // Alfa past (.07) — tovar rangi sezilarli o'zgarmaydi.
          if (STU.fon && STU.grade !== false) {
            ctx.save();
            ctx.globalCompositeOperation = "soft-light";
            ctx.globalAlpha = .07;
            ctx.fillStyle = "#FFB347"; ctx.fillRect(0, 0, W, H);
            ctx.restore();
            const vg = ctx.createRadialGradient(W/2, H*.46, Math.min(W,H)*.28,
                                                W/2, H*.5,  Math.max(W,H)*.72);
            vg.addColorStop(0, "rgba(0,0,0,0)");
            vg.addColorStop(1, "rgba(0,0,0,.28)");
            ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
          }
          // ✅ S1: MATN KONTRASTI — sahna foni ustida narx/nom
          // yo'qolmasin: pastdan yumshoq to'q qatlam.
          if (STU.fon || L.moda === "cover") {
            const g2 = ctx.createLinearGradient(0, H * .58, 0, H);
            g2.addColorStop(0, "rgba(0,0,0,0)");
            g2.addColorStop(1, "rgba(0,0,0,.55)");
            ctx.fillStyle = g2; ctx.fillRect(0, H * .58, W, H * .42);
          }
          break;
        }

        case "matn": {
          let matn = stManba(L.manba);
          if (!matn) break;
          if (L.katta || stTipo().katta) matn = matn.toUpperCase();   // ✅ A1/A2
          const maxW = (L.max || .9) * W;
          let px = stFit(ctx, matn, maxW, L.o * W, L.vazn || 700, _fam(L));
          const qatorlar = stWrap(ctx, matn, maxW, px, L.vazn || 700, L.satr || 1, _fam(L));
          // ✅ S2: xavfsiz zona + fon ustida avtomatik rang
          const _yy0 = _sz(L.y, F) * H;
          let _rang = stRang(P, L.rang);
          if (STU.fon) {
            const _l = _lum(ctx, (L.anchor === "right" ? L.x * W - maxW : L.x * W),
                            _yy0 - px, maxW, px * 1.2);
            _rang = _l > .62 ? "#0B1220" : "#FFFFFF";
          }
          ctx.fillStyle = _rang;
          ctx.textAlign = L.anchor === "right" ? "right"
                        : L.anchor === "center" ? "center" : "left";
          ctx.save();
          // ✅ A1: matn effektlari — soya (fon ustida o'qilishi uchun)
          if (L.soya) {
            ctx.shadowColor = "rgba(0,0,0,.45)";
            ctx.shadowBlur = px * .35; ctx.shadowOffsetY = px * .06;
          }
          if (L.burchak) {
            ctx.translate(L.x * W, L.y * H);
            ctx.rotate(L.burchak * Math.PI / 180);
            ctx.font = `${L.vazn || 700} ${px}px ${_fam(L)}`;
            ctx.fillText(matn, 0, 0);
          } else {
            qatorlar.forEach((q, i) => {
              ctx.font = `${L.vazn || 700} ${px}px ${_fam(L)}`;
              const yy = _yy0 + i * px * 1.06;
              ctx.fillText(q, L.x * W, yy);
              if (L.chizilgan) {
                const w2 = ctx.measureText(q).width;
                const x0 = ctx.textAlign === "right" ? L.x * W - w2 : L.x * W;
                ctx.fillRect(x0, yy - px * .3, w2, Math.max(2, px * .07));
              }
            });
          }
          ctx.restore();
          ctx.textAlign = "left";
          break;
        }

        case "narx": {
          if (!STU.narxKorsat) break;
          const n = Number((STU.tovar || {}).narx) || 0;
          if (!n) break;
          const matn = stSon(n);
          let px = L.o * W;
          ctx.font = `${L.vazn || 900} ${px}px ${_fam(L)}`;
          const wSom = px * .30;
          px = stFit(ctx, matn, W * .86 - wSom, px, L.vazn || 900, _fam(L));
          const wMatn = ctx.measureText(matn).width;
          let x = L.x * W;
          if (L.anchor === "right") x = L.x * W - wMatn - wSom * 1.2;
          if (L.qopqa) {                       // qopqa (pill) ichida
            const pad = px * .34;
            ctx.fillStyle = stRang(P, L.qopqa);
            const bw = wMatn + wSom * 1.2 + pad * 2, bh = px * 1.5;
            const bx = L.anchor === "right" ? L.x * W - bw : L.x * W;
            const by = _sz(L.y, F) * H - bh * .78;   // ✅ S2
            const r = bh / 2;
            ctx.beginPath();
            ctx.moveTo(bx + r, by);
            ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
            ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
            ctx.arcTo(bx, by + bh, bx, by, r);
            ctx.arcTo(bx, by, bx + bw, by, r);
            ctx.closePath(); ctx.fill();
            x = bx + pad;
            ctx.fillStyle = stRang(P, L.qopqaMatn || "a");
          } else {
            ctx.fillStyle = stRang(P, L.rang);
          }
          const _ny = _sz(L.y, F) * H;   // ✅ S2: xavfsiz zona
          if (_sc !== 1) px = px * _sc;  // ✅ S5: narx "portlashi"
          ctx.font = `${L.vazn || 900} ${px}px ${_fam(L)}`;
          ctx.fillText(matn, x, _ny);
          ctx.font = `700 ${px * .30}px ${_fam(L)}`;
          ctx.fillText(" so'm", x + wMatn + px * .06, _ny);
          break;
        }

        case "belgi": {
          const matn = stManba(L.manba);
          if (!matn) break;
          const px = L.o * W, pad = px * .42;
          ctx.font = `800 ${px}px ${_fam(L)}`;
          const wMatn = ctx.measureText(matn).width;
          const bw = wMatn + pad * 2, bh = px * 1.72;
          const bx = L.anchor === "right" ? L.x * W - bw : L.x * W;
          const by = _sz(L.y, F) * H;   // ✅ S2
          ctx.save();
          if (L.burchak) {
            ctx.translate(bx + bw / 2, by + bh / 2);
            ctx.rotate(L.burchak * Math.PI / 180);
            ctx.translate(-(bx + bw / 2), -(by + bh / 2));
          }
          ctx.fillStyle = stRang(P, L.fonRang || "b");
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = stRang(P, L.matnRang || "a");
          ctx.fillText(matn, bx + pad, by + bh * .72);
          ctx.restore();
          break;
        }

        case "doira": {
          const r = L.r * W, cx = L.x * W, cy = L.y * H;
          ctx.fillStyle = stRang(P, L.fonRang || "b");
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
          const matn = stManba(L.manba);
          if (matn) {
            ctx.fillStyle = stRang(P, L.matnRang || "a");
            let px = stFit(ctx, matn, r * 1.6, r * .52, 900, _fam(L));
            ctx.textAlign = "center";
            ctx.font = `900 ${px}px ${_fam(L)}`;
            ctx.fillText(matn, cx, cy + px * .18);
            ctx.font = `700 ${r * .20}px ${_fam(L)}`;
            ctx.fillText("so'm", cx, cy + px * .18 + r * .34);
            ctx.textAlign = "left";
          }
          break;
        }

        // ✅ A2: BREND LOGOTIPI (yuklangan bo'lsa) — matn o'rniga rasm
        case "brendlogo": {
          const lg = STU.brend && STU.brend.logoImg;
          if (!lg) break;
          const h2 = (L.o || .05) * W;
          const w2 = h2 * (lg.width / lg.height || 1);
          const x2 = L.anchor === "right" ? L.x * W - w2 : L.x * W;
          ctx.save(); ctx.globalAlpha = L.alfa == null ? .95 : L.alfa;
          ctx.drawImage(lg, x2, _sz(L.y, F) * H - h2, w2, h2);
          ctx.restore();
          break;
        }

        case "logo": {
          // ✅ S4: AI-modelli natijada halollik belgisi
          if (STU.aiNamoyish) {
            const pz = W * .022, pad = pz * .5;
            ctx.font = `700 ${pz}px ${_fam(L)}`;
            const t2 = "AI namoyish";
            const w2 = ctx.measureText(t2).width;
            ctx.fillStyle = "rgba(0,0,0,.42)";
            ctx.fillRect(W * .04 - pad, H * .955 - pz, w2 + pad * 2, pz * 1.6);
            ctx.fillStyle = "#FFFFFF";
            ctx.fillText(t2, W * .04, H * .955 + pz * .18);
          }
          if (!STU.belgi) break;
          const px = L.o * W;
          ctx.fillStyle = stRang(P, L.rang);
          ctx.globalAlpha = .8;
          ctx.font = `700 ${px}px ${_fam(L)}`;
          ctx.textAlign = L.anchor === "right" ? "right" : "left";
          ctx.fillText("merx.uz", L.x * W, _sz(L.y, F) * H);   // ✅ S2
          ctx.textAlign = "left"; ctx.globalAlpha = 1;
          break;
        }
      }
    } catch (e) { console.warn("[studio] qatlam:", L.tur, e.message); }
    ctx.restore();
    ctx.globalAlpha = 1;
  });
}

// ── UI ─────────────────────────────────────────────────────────
function renderStudio() {
  try { const t = document.getElementById("ptitle");
        if (t) t.textContent = "Studio — reklama"; } catch (e) {}
  // shablon lentasi
  stuBrauzer();                                      // ✅ B1
  // palitra lentasi
  const pl = document.getElementById("stu-pal");
  const _bp = stBrendPal();                          // ✅ A2/D1
  const _plRoy = _bp ? [_bp].concat(STU_PAL) : STU_PAL.slice();
  if (pl) pl.innerHTML = _plRoy.map(p =>
    `<button class="stu-pal${p.id === STU.pal ? " on" : ""}" title="${p.nom}"
       onclick="stuPal('${p.id}')">
       <i style="background:${p.a}"></i><i style="background:${p.b}"></i><i style="background:${p.c}"></i>
     </button>`).join("");
  // format lentasi
  const fm = document.getElementById("stu-fmt");
  if (fm) fm.innerHTML = STU_FMT.map(f =>
    `<button class="stu-chip${f.id === STU.fmt ? " on" : ""}" onclick="stuFmt('${f.id}')">
       ${f.nom}</button>`).join("");
  // tanlangan tovar yozuvi
  const tv = document.getElementById("stu-tovar-nom");
  if (tv) tv.textContent = STU.tovar
    ? (STU.tovar.nom + (STU.tovar.art ? " · ART " + STU.tovar.art : ""))
    : "Tovar tanlanmagan";
  // ✅ D1: tepadagi holat chiplari
  const c1 = document.getElementById("stu-cip-tovar");
  if (c1) {
    c1.textContent = STU.tovar ? ("✓ " + STU.tovar.nom) : "Tovar tanlanmagan";
    c1.className = STU.tovar ? "ok" : "";
  }
  const c2 = document.getElementById("stu-cip-surat");
  if (c2) {
    c2.textContent = STU.img ? (STU.real ? "✓ Real shaxs kadri" : "✓ Surat yuklandi")
                             : "Surat yo'q";
    c2.className = STU.img ? "ok" : "";
  }
  const yr = document.getElementById("stu-yorliq");
  if (yr && yr.value !== STU.yorliq) yr.value = STU.yorliq;
  stChiz();
  stuTipoChiz();                                     // ✅ A2
  if (!STU.rejim) {                                  // ✅ ODDIY: standart
    let r = "oddiy";
    try { r = localStorage.getItem("merx_studio_rejim") || "oddiy"; } catch (e) {}
    STU.rejim = r;
    const od = document.getElementById("stu-oddiy"), pr = document.getElementById("stu-pro");
    if (od) od.style.display = r === "pro" ? "none" : "block";
    if (pr) pr.style.display = r === "pro" ? "block" : "none";
  }
  stuOddiyChiz();
  if (!STU._limitOlindi) {
    STU._limitOlindi = true;
    stuSevTikla();                                   // ✅ B1
    stuLimit(); stuModellar(); stuLogoTikla(); stuShriftYukla();
    stuFonlar(); stuKodFonChiz(); stuSlotChiz();
  }
}
function stuShab(id) { STU.shab = id; renderStudio(); }
// ✅ D2: og'ir qayta chizishni kechiktirish (rang/shrift tez bosilganda)
let _stuTaymer = null;
function _stuKech(fn, ms) {
  clearTimeout(_stuTaymer);
  _stuTaymer = setTimeout(fn, ms == null ? 130 : ms);
}
function stuPanel(id) {                            // ✅ D1: panel almashish
  ["shablon","tovar","surat","fon","ai","brend","tarqat"].forEach(k => {
    const p = document.getElementById("stu-p-" + k);
    if (p) p.style.display = k === id ? "block" : "none";
    const b = document.getElementById("stu-r-" + k);
    if (b) b.classList.toggle("on", k === id);
  });
}
function stuPal(id)  { STU.pal = id; stChiz(); _stuKech(renderStudio); }
function stuFmt(id)  { STU.fmt  = id; renderStudio(); }
function stuYorliq(v){ STU.yorliq = String(v || "").slice(0, 28); STU.yorliqQolda = !!STU.yorliq; stChiz(); }
function stuNarx(on) { STU.narxKorsat = !!on; stChiz(); }
function stuBelgi(on){ STU.belgi = !!on; stChiz(); }
function stuZoom(v)  { STU.imgAdj.zoom = Number(v) || 1; stChiz(); }

// tovar qidirish (faqat o'qiydi)
function stuQidir(q) {
  const el = document.getElementById("stu-natija");
  if (!el) return;
  q = String(q || "").trim().toLowerCase();
  if (!q) { el.innerHTML = ""; el.style.display = "none"; return; }
  const manba = (typeof visProds === "function" ? visProds() : (db.products || []));
  const mos = manba.filter(p => {
    const hay = ((p.name || "") + " " + (p.sku || "") + " " + (p.art || "") + " " +
                 (p.barcode || "") + " " + (p.category || "")).toLowerCase();
    return q.split(/\s+/).every(t => hay.includes(t));
  }).slice(0, 12);
  el.style.display = mos.length ? "block" : "none";
  el.innerHTML = mos.map(p =>
    `<div class="stu-row" onclick="stuTanla('${String(p.sku).replace(/'/g, "\\'")}')">
       <b>${(p.name || "—")}</b>
       <span>${p.art ? "ART " + p.art : ""} ${p.priceUzs ? "· " + stSon(p.priceUzs) + " so'm" : ""}</span>
     </div>`).join("");
}
function stuTanla(sku) {
  const manba = (typeof visProds === "function" ? visProds() : (db.products || []));
  const p = manba.find(x => String(x.sku) === String(sku));
  if (!p) return;
  const ranglar = [...new Set((p.variants || []).map(v => v.color).filter(Boolean))];
  const olch    = [...new Set((p.variants || []).map(v => v.size).filter(Boolean))];
  STU.tovar = {
    nom: p.name || "",
    art: p.art || p.sku || "",
    rang: ranglar.slice(0, 2).join(", "),
    olcham: (() => {                      // ✅ S4b
      const a = olch.map(x => String(x).trim()).filter(Boolean);
      return a.length > 1 ? a[0] + "-" + a[a.length - 1] : (a[0] || "");
    })(),
    narx: Number(p.ulgurjiNarx || p.priceUzs) || 0,
    kat: String(p.category || p.type || ""),   // ✅ S1: sahna tanlash uchun
    createdAt: p.createdAt || null,            // ✅ ODDIY: "yangi keldi" uchun
  };
  const q = document.getElementById("stu-q");   if (q) q.value = "";
  const n = document.getElementById("stu-natija"); if (n) { n.innerHTML = ""; n.style.display = "none"; }
  renderStudio();
}
// telefon surati
function stuRasm(inp) {
  const f = inp && inp.files && inp.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    const im = new Image();
    im.onload = () => {                                // ✅ KK: slotga ham
      STU.img = im; STU.asl = im; STU.imgAdj = { zoom:1, dx:0, dy:0 };
      STU.fokus = { x: .5, y: .38 };
      STU.rasmlar[STU.asosiy || 0] = im;
      if (typeof stuSlotChiz === "function") stuSlotChiz();
      stChiz();
    };
    im.onerror = () => toast("Rasm ochilmadi", "err");
    im.src = e.target.result;
  };
  r.onerror = () => toast("Rasm o'qilmadi", "err");
  r.readAsDataURL(f);
}
// yuklab olish
function stuYukla(hammasi) {
  const nomAsos = ((STU.tovar && STU.tovar.art) || "reklama") + "-" + STU.shab;
  const royxat = hammasi ? STU_FMT : [stFmt()];
  royxat.forEach((F, i) => {
    setTimeout(() => {
      const tmp = document.createElement("canvas");
      stChiz(tmp, F);
      tmp.toBlob(b => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `${nomAsos}-${F.id}.png`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      }, "image/png");
    }, i * 350);
  });
  if (typeof toast === "function")
    toast(hammasi ? "4 format yuklanmoqda" : "Rasm yuklanmoqda", "ok");
  stChiz();   // ko'rinishni joriy formatga qaytarish
}

// ═══════════════════════════════════════════════════════════════
// ✅ 1-BOSQICh (2026-09-06) — AI QATLAMI: fon va sahna
// ═══════════════════════════════════════════════════════════════
// QOIDA: tovar pikseli generativ AI'dan O'TMAYDI.
//   · "Fonni tozalash" — segmentatsiya (kesish), qayta chizish emas;
//   · "Sahna" — fon TOVARSIZ generatsiya qilinadi, tovar ustiga
//     shu yerda (brauzerda) qo'yiladi.
// Asl surat doim saqlanadi — "Asliga qaytar" bir bosishda.
STU.asl = null;      // birinchi yuklangan surat (Image)
STU.fon = null;      // sahna rasmi (Image) yoki null
STU.band = false;    // bir vaqtda bitta so'rov

// ✅ Token — YAGONA joydan. Sessiya localStorage YOKI sessionStorage
// da bo'lishi mumkin (utils.js:3255 naqshi), muddati yaqin bo'lsa
// `ensureFreshToken` yangilaydi. Avval faqat localStorage qaralgan edi.
async function _stuTok() {
  try { if (typeof ensureFreshToken === "function") await ensureFreshToken(); } catch (e) {}
  // ⚠️ Maydon nomi IKKI xil bo'lishi mumkin: access_token yoki
  // accessToken (qarzlar.js:_serverPay naqshi — AYNAN o'sha ifoda).
  // Faqat birinchisiga qaraganim uchun "Token yaroqsiz" chiqqan edi.
  try {
    const K = "merx_sb_session";
    const raw = localStorage.getItem(K) || sessionStorage.getItem(K);
    const d = raw ? JSON.parse(raw) : null;
    return (d && (d.access_token || d.accessToken)) || null;
  } catch (e) { return null; }
}
async function stuAI(amal, qosh) {
  if (STU.band) { toast("Oldingi amal tugashini kuting", "err"); return null; }
  STU.band = true;
  stuHolat(amal === "fon" ? "✂️ Fon tozalanmoqda…" : "🏞 Sahna tayyorlanmoqda…");
  try {
    const tok = await _stuTok();
    if (!tok) { stuHolat(""); toast("Kirish kaliti topilmadi — sahifani yangilang", "err"); return null; }
    const r = await fetch("/api/reklama", {
      method: "POST",
      headers: { "Content-Type": "application/json",
                 Authorization: "Bearer " + (tok || "") },
      body: JSON.stringify(Object.assign({ action: amal }, qosh || {})),
    });
    const d = await r.json().catch(() => null);
    if (!d) {
      // ⚠️ JSON kelmadi — server javob bermadi yoki vaqt tugadi
      // (jonli hodisa 6-sen: vercel.json da maxDuration 15 soniya edi,
      // try-on esa 5-17 soniya oladi → platforma HTML xato qaytardi).
      stuHolat("");
      toast(r.status === 504 || r.status === 502
        ? "Server javob bermadi (vaqt tugadi) — qayta urinib ko'ring"
        : "Server xatosi: " + r.status, "err");
      return null;
    }
    if (!d.ok) {
      stuHolat("");
      toast(d.error || ("Xato (" + r.status + ")"), "err");
      if (d && (d.sarf != null)) stuSarf(d.sarf, d.chegara);
      return null;
    }
    if (d.sarf != null) stuSarf(d.sarf, d.chegara);
    return d;
  } catch (e) {
    stuHolat(""); toast("Internet xatosi", "err"); return null;
  } finally { STU.band = false; }
}
function stuHolat(m) {
  const el = document.getElementById("stu-holat");
  if (el) { el.textContent = m || ""; el.style.display = m ? "block" : "none"; }
}
function stuSarf(n, ch) {
  const el = document.getElementById("stu-sarf");
  if (el) el.textContent = `Bu oyda: ${n}/${ch} kredit`;   // ✅ S7
}
function _stuImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("rasm ochilmadi"));
    im.crossOrigin = "anonymous";
    im.src = src;
  });
}
// Fonni tozalash — tovar shaffof PNG bo'lib qaytadi
async function stuFonTozala(jim) {
  if (!STU.img) { if (!jim) toast("Avval surat yuklang", "err"); return false; }
  if (!STU.asl) STU.asl = STU.img;
  // kichraytirib yuboramiz (tezlik + hajm)
  const c = document.createElement("canvas");
  // ✅ Yuklama: 1200px va 0.85 sifat — odatda 150-300 KB (fal uchun
  // yetarli), Vercel tanasi chegarasidan ancha past.
  const k = Math.min(1, 1200 / Math.max(STU.img.width, STU.img.height));
  c.width = Math.round(STU.img.width * k); c.height = Math.round(STU.img.height * k);
  c.getContext("2d").drawImage(STU.img, 0, 0, c.width, c.height);
  const d = await stuAI("fon", { image: c.toDataURL("image/jpeg", 0.85) });
  if (!d) return false;
  try {
    const _raw = await _stuImg(d.image);
    STU.img = _stuTrim(_raw);        // ✅ S2: shaffof chekkalar kesiladi
    if (!jim) { stuHolat(""); toast("Fon tozalandi", "ok"); stChiz(); }
    return true;
  } catch (e) { stuHolat(""); if (!jim) toast("Natija ochilmadi", "err"); return false; }
}
// Sahna — fon generatsiyasi (tovarsiz), tovar ustiga qo'yiladi
// ✅ S3: sahna endi KATEGORIYA + TOVAR RANGI + MAVSUM bo'yicha
// quriladi (buyruq serverda). `sahnaId` berilmasa — server o'zi
// tanlaydi, ya'ni har safar boshqa fon chiqadi.
// Kesh: bir sessiyada bir xil sahna qayta so'ralmaydi (pul tejaladi).
STU.sahnaKesh = {};
async function stuSahna(sahnaId, jim) {
  const kat  = stuKatTanla();
  const rang = (STU.avtoPal && STU.avtoPal.b) || "";
  const kalit = kat + "|" + (sahnaId || "avto");
  if (sahnaId && STU.sahnaKesh[kat + "|" + sahnaId]) {
    STU.fon = STU.sahnaKesh[kat + "|" + sahnaId];
    if (!jim) { stuHolat(""); stChiz(); }
    return true;
  }
  const d = await stuAI("sahna", { kat, sahna: sahnaId || null, rang });
  if (!d) return false;
  try {
    STU.fon = await _stuImg(d.image);
    if (d.sahna) {                                   // ✅ XOTIRA: 4 ta
      const _sk = Object.keys(STU.sahnaKesh);
      if (_sk.length >= 4) delete STU.sahnaKesh[_sk[0]];
      STU.sahnaKesh[kat + "|" + d.sahna] = STU.fon;
    }
    STU.sahnaNom = d.sahnaNom || "";
    if (!jim) {
      stuHolat("");
      toast("Sahna: " + (d.sahnaNom || "tayyor"), "ok");
      stChiz();
    }
    return true;
  } catch (e) { stuHolat(""); if (!jim) toast("Sahna ochilmadi", "err"); return false; }
}
// Boshqa sahna — o'sha kategoriyadan yangisi
function stuBoshqaSahna() { stuSahna(null, false); }
function stuAsliga() {
  if (STU.asl) STU.img = STU.asl;
  STU.fon = null;
  STU.aiNamoyish = false; STU.soya = true;   // ✅ S4
  toast("Asl suratga qaytdi", "ok");
  stChiz();
}
// oylik hisobni yangilash (sahifa ochilganda)
async function stuLimit() {
  const d = await (async () => {
    try {
      const tok = await _stuTok();
      const r = await fetch("/api/reklama", { method: "POST",
        headers: { "Content-Type": "application/json",
                   Authorization: "Bearer " + (tok || "") },
        body: JSON.stringify({ action: "limit" }) });
      return await r.json().catch(() => null);
    } catch (e) { return null; }
  })();
  if (d && d.ok) {
    stuSarf(d.sarf, d.chegara);
    if (d.sozlama) {                                  // ✅ S8
      STU.sozlama = Object.assign(STU.sozlama, d.sozlama);
      STU.brend = Object.assign(STU.brend || {}, d.sozlama);   // ✅ A2
      if (d.sozlama.shrift &&
          STU_TIPO.some(t => t.id === d.sozlama.shrift)) STU.tipo = d.sozlama.shrift;
      stuSozlamaChiz(); stuTipoChiz(); stChiz();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ✅ S1 (2026-09-06) — AVTO-REJIM: "rasm yukladi → to'plam oldi"
// ═══════════════════════════════════════════════════════════════
// Foydalanuvchi FAQAT tovarni tanlaydi va surat yuklaydi. Qolganini
// tizim qiladi: fonni ajratadi → suratdan RANG PALITRASINI chiqaradi
// → kategoriyaga mos SAHNA tanlaydi → 6 ta tayyor variant chizadi.
// AI faqat IKKI marta chaqiriladi (kesish + sahna) — qolgan hamma
// ish brauzerda, xarajatsiz.
STU.avtoPal  = null;    // suratdan chiqarilgan palitra
STU.variants = [];      // [{shab, pal}]
STU.tanlanganV = 0;

// ── Suratdan palitra: hukmron rangni topib, unga MOS to'plam quriladi
function _hsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  const q = v => ("0" + Math.round((v + m) * 255).toString(16)).slice(-2);
  return "#" + q(r) + q(g) + q(b);
}
function stuPalitraChiqar(im) {
  try {
    const n = 48, c = document.createElement("canvas");
    c.width = n; c.height = n;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(im, 0, 0, n, n);
    const d = ctx.getImageData(0, 0, n, n).data;
    let r = 0, g = 0, b = 0, k = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;                    // shaffof joy
      const mx = Math.max(d[i], d[i+1], d[i+2]), mn = Math.min(d[i], d[i+1], d[i+2]);
      if (mx > 244 && mn > 244) continue;              // oq
      if (mx < 14) continue;                           // qora
      r += d[i]; g += d[i+1]; b += d[i+2]; k++;
    }
    if (!k) return null;
    r /= k; g /= k; b /= k;
    // RGB → HSL (faqat rang burchagi kerak)
    const R = r/255, G = g/255, B = b/255;
    const mx = Math.max(R,G,B), mn = Math.min(R,G,B), dl = mx - mn;
    let h = 0;
    if (dl) {
      if (mx === R)      h = 60 * (((G - B) / dl) % 6);
      else if (mx === G) h = 60 * ((B - R) / dl + 2);
      else               h = 60 * ((R - G) / dl + 4);
    }
    const l = (mx + mn) / 2;
    const sat = dl ? dl / (1 - Math.abs(2 * l - 1)) : 0;
    return {
      id: "auto", nom: "Suratdan",
      a: _hsl(h, Math.min(sat, .34), .11),             // to'q fon
      b: _hsl(h + 180, .74, .56),                      // qarama-qarshi urg'u
      c: "#FFFFFF",
      d: _hsl(h, .16, .74),
    };
  } catch (e) { return null; }
}

// ── Kategoriyaga mos sahna
function stuKatTanla() {
  const t = ((STU.tovar && (STU.tovar.kat + " " + STU.tovar.nom)) || "").toLowerCase();
  const bor = a => a.some(w => t.includes(w));
  // ⚠️ TARTIB MUHIM: "Oyoq kiyim" ichida "kiyim" so'zi bor —
  // shuning uchun OYOQ KIYIM birinchi tekshiriladi (stend xatosi, 6-sen).
  // ✅ S3: natija — SAHNA KUTUBXONASINING kategoriyasi (server
  // shundan mos sahnani tanlaydi va buyruqni o'zi quradi).
  // ✅ ODDIY: bolalar va sport — avval (ular ichida "kurtka"/"krossovka" bo'ladi)
  if (bor(["bolalar", "bola ", "bolajon", "kids", "детск"])) return "bolalar";
  if (bor(["sport", "fitnes", "trenirovka", "futbol", "yoga"])) return "sport";
  if (bor(["oyoq", "krossovka", "botinka", "tufli", "shippak", "sandal",
           "poyabzal", "ked", "sneaker"])) return "oyoq";
  if (bor(["sumka", "ryukzak", "kamar", "aksessuar", "hamyon"])) return "sumka";
  if (bor(["ko'ylak", "koylak", "shim", "kiyim", "kostyum", "futbolka",
           "palto", "kurtka", "sviter", "shortik", "yubka", "kofta"]))
    return "kiyim";
  return "umumiy";
}

// ── Olti variant (uslub × palitra)
// ✅ ODDIY (2026-09-07): variantlar endi 109 shablonlik KUTUBXONADAN,
// tovar KATEGORIYASI bo'yicha va har biri BOShQA arxetipdan (bir xil
// ko'rinishdagi 6 ta emas). Avval eski 6 shablon qattiq yozilgan edi —
// kutubxona umuman ishlatilmasdi (egasining haqli e'tirozi).
function _stuArxetip(id) { return String(id).replace(/\d+$/, ""); }
function stuVariantlar(oldingi) {
  const kat = stuKatTanla();
  const sinf = STU.real ? "real" : (STU.aiNamoyish ? "model" : null);
  // ✅ tartib: o'z kategoriyasi (2) > umumiy (1); bolalar/sport shablonlari
  // faqat o'z kategoriyasida (stend: krossovkaga "Bolalar" tushib qolgan edi)
  const daraja = s => {
    const k = s.kat || [];
    if (sinf) return k.indexOf(sinf) >= 0 ? 2 : 0;
    if (k.indexOf("real") >= 0 || k.indexOf("model") >= 0) return 0;
    if (k.indexOf(kat) >= 0) return 2;
    if ((k.indexOf("bolalar") >= 0 || k.indexOf("sport") >= 0) && kat !== "bolalar" && kat !== "sport") return 0;
    return k.indexOf("umumiy") >= 0 ? 1 : 0;
  };
  let ro = STU_SHAB.filter(s => daraja(s) > 0);
  ro.sort((a, b) => daraja(b) - daraja(a) ||
    ((b.id.indexOf("fs") === 0) - (a.id.indexOf("fs") === 0)));
  const A = STU.avtoPal ? "auto" : "navy";
  const B = stBrendPal() ? "brend" : "qogoz";
  const pallar = [A, "oq", B, A, "qora", "amber"];
  const tanlangan = [], arx = {};
  const eski = new Set((oldingi || []).map(v => v.shab));
  // aralashtirib, har arxetipdan bittadan
  // daraja ichida aralashtiriladi (2-lar avval, keyin 1-lar)
  const ar = ro.filter(x => daraja(x) === 2).sort(() => Math.random() - .5)
    .concat(ro.filter(x => daraja(x) === 1).sort(() => Math.random() - .5));
  for (const s of ar) {
    const a = _stuArxetip(s.id);
    if (arx[a] || eski.has(s.id)) continue;
    arx[a] = 1; tanlangan.push(s);
    if (tanlangan.length >= 6) break;
  }
  for (const s of ar) {                        // yetmasa — to'ldiramiz
    if (tanlangan.length >= 6) break;
    if (tanlangan.indexOf(s) < 0) tanlangan.push(s);
  }
  return tanlangan.map((s, i) => ({ shab: s.id, pal: pallar[i % pallar.length] }));
}
// ✅ ODDIY: yorliq matni holatdan kelib chiqadi
function stuAvtoYorliq() {
  if (STU.yorliqQolda) return STU.yorliq;
  const t = STU.tovar || {};
  if (STU.eskiNarx && STU.eskiNarx > (t.narx || 0)) return "CHEGIRMA";
  const yaratilgan = t.createdAt ? new Date(t.createdAt).getTime() : 0;
  if (yaratilgan && Date.now() - yaratilgan < 14 * 86400000) return "YANGI KELDI";
  const oy = new Date().getMonth() + 1;
  if (oy === 12 || oy <= 2) return "QISHKI TO'PLAM";
  if (oy <= 5) return "BAHOR TO'PLAMI";
  if (oy <= 8) return "YOZGI TO'PLAM";
  return "KUZGI TO'PLAM";
}

// ── ASOSIY: bir bosishda hammasi
async function stuReklamaYasa() {
  if (!STU.tovar) { toast("Avval tovarni tanlang", "err"); return; }
  if (!STU.img)   { toast("Surat yuklang", "err"); return; }
  const b = document.getElementById("stu-avto");
  if (b) { b.disabled = true; b.textContent = "⏳ Tayyorlanmoqda…"; }
  try {
    if (!STU.asl) STU.asl = STU.img;
    // ✅ S6: REAL ShAXS rejimida AI UMUMAN chaqirilmaydi — rang
    // tuzatiladi va variantlar darhol chiziladi (xarajat 0, kutish yo'q).
    if (STU.real) {
      stuHolat("Rang va kadr sozlanmoqda…");
      STU.avtoPal = stuPalitraChiqar(STU.img);
      stuRangTuzat();
      stuReal(true);
      stuHolat("");
      toast("To'plam tayyor — AI ishlatilmadi", "ok");
      return;
    }
    STU.yorliq = stuAvtoYorliq();
    // ✅ ODDIY: odam kadri bo'lsa — shaxs ajratiladi, real fon qo'yiladi
    if (STU.odamKadri) {
      stuHolat("1/3 · Shaxs ajratilmoqda…");
      await stuShaxsAjrat(true);
      STU.avtoPal = stuPalitraChiqar(STU.img);
      stuHolat("2/3 · Fon tanlanmoqda…");
      await stuFonAvto("real", true);
      STU.real = true; STU.soya = true; STU.aks = false;
    } else {
      stuHolat("1/3 · Tovar fondan ajratilmoqda…");
      await stuFonTozala(true);
      STU.avtoPal = stuPalitraChiqar(STU.img);
      stuHolat("2/3 · Bezakli sahna tanlanmoqda…");
      // ✅ ODDIY: bezakli (pampas, marmar, yog'och) — tabiiy ko'rinish
      const bo = await stuFonAvto("tovar", true);
      if (!bo) await stuSahna(null, true);   // zaxira
    }
    stuHolat("3/3 · Variantlar chizilmoqda…");
    STU.variants = stuVariantlar();
    STU.tanlanganV = 0;
    stuVariantChiz();
    const v = STU.variants[0];
    STU.shab = v.shab; STU.pal = v.pal;
    renderStudio();
    stuHolat("");
    toast("6 ta variant tayyor — yoqqanini tanlang", "ok");
    stuNatijaKorsat(true);                          // ✅ ODDIY
  } catch (e) {
    stuHolat(""); toast("Xato: " + e.message, "err");
  } finally {
    if (b) { b.disabled = false; b.textContent = "✨ Reklama yasa"; }
  }
}

// ── Galereya
function stuVariantChiz() {
  const el = document.getElementById("stu-variants");
  if (!el) return;
  if (!STU.variants.length) { el.innerHTML = ""; return; }
  el.innerHTML = STU.variants.map((v, i) =>
    `<button class="stu-vr${i === STU.tanlanganV ? " on" : ""}" onclick="stuVariantTanla(${i})">
       <canvas id="stu-vc${i}" width="180" height="225"></canvas>
       <span>${(STU_SHAB.find(s => s.id === v.shab) || {}).nom || ""}</span>
     </button>`).join("");
  const _imz = _stuImzo();                           // ✅ D2: keraksiz chizish yo'q
  STU.variants.forEach((v, i) => {
    const c = document.getElementById("stu-vc" + i);
    if (!c || c.dataset.sig === _imz + i) return;
    try { stChiz(c, { w: 180, h: 225 }, v); c.dataset.sig = _imz + i; } catch (e) {}
  });
}
function stuVariantTanla(i) {
  const v = STU.variants[i]; if (!v) return;
  STU.tanlanganV = i; STU.shab = v.shab; STU.pal = v.pal;
  renderStudio();
  stuVariantChiz();
}

// ═══════════════════════════════════════════════════════════════
// ✅ S4 (2026-09-06) — DO'KONNING O'Z MODELI + KIYDIRISH
// ═══════════════════════════════════════════════════════════════
// Har do'konga bitta erkak va bitta ayol model. Bir marta yaratiladi,
// keyin DOIM o'sha shaxs — do'kon reklamalari yuzidan tanilib qoladi.
// Natijaga "AI namoyish" belgisi qo'yiladi (halollik qoidasi).
STU.modellar = { erkak: null, ayol: null };
STU.aiNamoyish = false;

async function stuModellar() {
  const d = await stuAI("modellar", {});
  if (!d) return;
  STU.modellar.erkak = d.erkak || null;
  STU.modellar.ayol  = d.ayol  || null;
  stuModelChiz();
}
function stuModelChiz() {
  const el = document.getElementById("stu-modellar");
  if (!el) return;
  el.innerHTML = ["erkak", "ayol"].map(j => {
    const m = STU.modellar[j];
    return `<div class="st-mod">
      ${m && m.url
        ? `<img src="${m.url}" alt="${j}">`
        : `<div class="st-mod-bosh">Model yo'q</div>`}
      <b>${j === "erkak" ? "Erkak" : "Ayol"}</b>
      ${m && m.url
        ? `<button onclick="stuKiydir('${j}')">Kiydirish</button>`
        : `<button onclick="stuModelYarat('${j}')">Yaratish</button>`}
    </div>`;
  }).join("");
}
async function stuModelYarat(jins) {
  stuHolat("🧑 Model yaratilmoqda (bir martalik)…");
  const d = await stuAI("model_yarat", { jins });
  stuHolat("");
  if (!d) return;
  STU.modellar[jins] = { jins, url: d.url, seed: d.seed };
  stuModelChiz();
  toast((jins === "ayol" ? "Ayol" : "Erkak") + " modeli tayyor", "ok");
}
async function stuKiydir(jins) {
  if (!STU.img) { toast("Avval kiyim suratini yuklang", "err"); return; }
  if (!STU.asl) STU.asl = STU.img;
  stuHolat("👗 Kiyim modelga kiydirilmoqda…");
  // kiyim rasmi — asl (kesilmagan) yoki joriy holat, kichraytirilgan
  const c = document.createElement("canvas");
  const src = STU.asl || STU.img;
  const k = Math.min(1, 1100 / Math.max(src.width, src.height));
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  const cx = c.getContext("2d");
  cx.fillStyle = "#FFFFFF"; cx.fillRect(0, 0, c.width, c.height);  // shaffofsiz
  cx.drawImage(src, 0, 0, c.width, c.height);
  const d = await stuAI("kiydir", { jins, image: c.toDataURL("image/jpeg", 0.86) });
  stuHolat("");
  if (!d) return;
  try {
    STU.img = await _stuImg(d.image);
    STU.fon = null;              // natijada o'z foni bor
    STU.soya = false;            // to'liq kadr — soya/aks kerak emas
    STU.aiNamoyish = true;       // belgisi chiqadi
    STU.shab = "model";          // ✅ S4b: to'liq kadr uslubi
    STU.variants = [
      { shab: "model",    pal: STU.avtoPal ? "auto" : "navy" },
      { shab: "model",    pal: "qora" },
      { shab: "sarlavha", pal: "amber" },
      { shab: "katalog",  pal: "oq" },
    ];
    STU.tanlanganV = 0;
    stuVariantChiz();
    renderStudio();
    toast("Modelda tayyor", "ok");
  } catch (e) { toast("Natija ochilmadi", "err"); }
}

// ═══════════════════════════════════════════════════════════════
// ✅ S5 (2026-09-06) — VIDEO REKLAMA (kod-animatsiya, xarajat 0)
// ═══════════════════════════════════════════════════════════════
// Tayyor bannerdan 8 soniyalik klip: rasm sekin yaqinlashadi
// (Ken Burns), matnlar ketma-ket chiqadi, narx "portlaydi".
// genAI ISHLATILMAYDI — hammasi brauzerda chiziladi va yoziladi:
// xarajat nol, natija har safar bir xil, internet kutilmaydi.
//
// Format: brauzer qo'llab-quvvatlaydigan eng yaxshisi tanlanadi
// (mp4 bo'lsa mp4, aks holda webm — Telegram ikkalasini ham oladi).
STU.videoDavom = 8000;   // ms

function _stuMime() {
  const r = ["video/mp4;codecs=avc1.42E01E", "video/mp4",
             "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const m of r) {
    try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; }
    catch (e) {}
  }
  return "";
}
async function stuVideo() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    toast("Bu brauzer video yozishni qo'llamaydi — Chrome yoki Safari'da oching", "err");
    return;
  }
  if (!STU.img) { toast("Avval surat yuklang", "err"); return; }
  const mime = _stuMime();
  if (!mime) { toast("Video format topilmadi", "err"); return; }

  const F0 = stFmt();
  // O'lcham: tezlik uchun eni 720-864 (sifat yetarli, telefon uzmaydi)
  const en = F0.h / F0.w > 1.4 ? 720 : 864;
  const F = { w: en, h: Math.round(en * F0.h / F0.w) };
  const c = document.createElement("canvas");
  c.width = F.w; c.height = F.h;

  const btn = document.getElementById("stu-video");
  if (btn) { btn.disabled = true; btn.textContent = "⏺ Yozilmoqda…"; }

  let rec, parcha = [];
  try {
    const oqim = c.captureStream(30);
    rec = new MediaRecorder(oqim, { mimeType: mime, videoBitsPerSecond: 5500000 });
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "🎬 Video"; }
    toast("Yozib bo'lmadi: " + e.message, "err"); return;
  }
  rec.ondataavailable = e => { if (e.data && e.data.size) parcha.push(e.data); };

  const tugadi = new Promise(res => { rec.onstop = res; });
  rec.start(100);
  const t0 = performance.now();
  await new Promise(res => {
    function kadr() {
      const o = Math.min(1, (performance.now() - t0) / STU.videoDavom);
      STU._anim = { t: o };
      try { stChiz(c, F); } catch (e) {}
      if (btn) btn.textContent = "⏺ " + Math.round(o * 100) + "%";
      if (o < 1) requestAnimationFrame(kadr);
      else res();
    }
    requestAnimationFrame(kadr);
  });
  STU._anim = null;
  stChiz();                       // ekranni oddiy holatga qaytarish
  try { rec.stop(); } catch (e) {}
  await tugadi;

  const blob = new Blob(parcha, { type: mime });
  const ken = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";
  const nom = ((STU.tovar && STU.tovar.art) || "reklama") + "-" + STU.shab +
              "-" + F0.id + "." + ken;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nom;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);

  if (btn) { btn.disabled = false; btn.textContent = "🎬 Video"; }
  toast("Video tayyor: " + Math.round(blob.size / 1024) + " KB", "ok");
}

// ═══════════════════════════════════════════════════════════════
// ✅ S6 (2026-09-06) — REAL ShAXS TO'PLAMI (mobilograf kadri)
// ═══════════════════════════════════════════════════════════════
// Do'kon xodimi yoki mobilograf tushirgan kadr yuklanadi.
// QAT'IY QOIDA: YUZGA VA GAVDAGA AI TEGMAYDI. Faqat:
//   · kadrlash (fokus nuqtasi bo'yicha, bosh kesilmaydi),
//   · rang va yorug'lik tuzatish (KOD bilan, histogramma cho'zish),
//   · shablon, matn va formatlar.
// Ya'ni bu yo'lda AI UMUMAN chaqirilmaydi — xarajat nol, natija
// bir zumda. Mobilograf ishi almashtirilmaydi, TUGATILADI.
function stuReal(on) {
  STU.real = !!on;
  if (STU.real) {
    STU.fon = null; STU.soya = false; STU.aks = false; STU.aiNamoyish = false;
    if (["kadr", "yonkadr", "sokin"].indexOf(STU.shab) < 0) STU.shab = "kadr";
    STU.variants = [
      { shab: "kadr",    pal: STU.avtoPal ? "auto" : "navy" },
      { shab: "sokin",   pal: "qora" },
      { shab: "yonkadr", pal: "amber" },
      { shab: "kadr",    pal: "qizil" },
    ];
    STU.tanlanganV = 0;
    stuVariantChiz();
  } else {
    STU.soya = true; STU.aks = true;
  }
  renderStudio();
  toast(STU.real ? "Real shaxs rejimi — AI yuzga tegmaydi"
                 : "Oddiy rejim", "ok");
}

// ── Fokus: namoyish ustiga bosilsa — kadrlash nuqtasi o'sha yerga
function stuFokus(ev) {
  const c = document.getElementById("stu-cvs");
  if (!c) return;
  const r = c.getBoundingClientRect();
  STU.fokus = {
    x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)),
  };
  stChiz(); stuVariantChiz();
}

// ── Rang va yorug'lik tuzatish (KOD, AI'siz)
// Histogramma cho'zish: eng to'q va eng och nuqtalar bo'yicha
// kontrast tiklanadi + yengil to'yinganlik. Telefon kadrlaridagi
// "xira/sarg'ish" ko'rinishni tabiiy holatga qaytaradi.
function stuRangTuzat() {
  if (!STU.img) { toast("Avval surat yuklang", "err"); return; }
  try {
    if (!STU.asl) STU.asl = STU.img;
    const im = STU.img;
    const c = document.createElement("canvas");
    c.width = im.width; c.height = im.height;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    // 1) yorqinlik chegaralari (2% va 98%)
    const hist = new Uint32Array(256);
    for (let i = 0; i < p.length; i += 4 * 7) {
      const y = (p[i] * 0.2126 + p[i+1] * 0.7152 + p[i+2] * 0.0722) | 0;
      hist[y]++;
    }
    let jami = 0; for (let i = 0; i < 256; i++) jami += hist[i];
    const past = jami * .02, yuq = jami * .98;
    let s = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++) { s += hist[i]; if (s >= past) { lo = i; break; } }
    s = 0;
    for (let i = 0; i < 256; i++) { s += hist[i]; if (s >= yuq) { hi = i; break; } }
    if (hi - lo < 24) { lo = 0; hi = 255; }
    const k = 255 / (hi - lo);
    // 2) qo'llash + yengil to'yinganlik
    for (let i = 0; i < p.length; i += 4) {
      let r = (p[i] - lo) * k, g = (p[i+1] - lo) * k, b = (p[i+2] - lo) * k;
      const y = r * .2126 + g * .7152 + b * .0722;
      r = y + (r - y) * 1.10; g = y + (g - y) * 1.10; b = y + (b - y) * 1.10;
      p[i]   = r < 0 ? 0 : r > 255 ? 255 : r;
      p[i+1] = g < 0 ? 0 : g > 255 ? 255 : g;
      p[i+2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    x.putImageData(d, 0, 0);
    STU.img = c;                       // canvas ham chizishga yaroqli
    stChiz(); stuVariantChiz();
    toast("Rang va yorug'lik tuzatildi", "ok");
  } catch (e) { toast("Tuzatib bo'lmadi", "err"); }
}

// ═══════════════════════════════════════════════════════════════
// ✅ S7 + S8 (2026-09-06) — KREDIT VA DO'KON KANALI
// ═══════════════════════════════════════════════════════════════
// · Kredit: banner va video BEPUL (brauzerda chiziladi), AI fon va
//   sahna 1, model va kiydirish 3 kredit. Hisob serverda.
// · Har do'konning O'Z Telegram reklama kanali: bir marta ID
//   kiritiladi, keyin tayyor reklama bir bosishda kanalga chiqadi.
// · Instagram: hozircha REJIM tanlanadi (o'zi yuritadi / MERX
//   yuritadi) — avto-post keyingi bosqichda (Meta tasdig'i kerak).
STU.sozlama = { kanal_id: "", kanal_nom: "", ig_rejim: "ozi", ig_user: "" };

function stuSozlamaChiz() {
  const q = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.value = v; };
  q("stu-kanal", STU.sozlama.kanal_id || "");
  q("stu-kanal-nom", STU.sozlama.kanal_nom || "");
  q("stu-ig", STU.sozlama.ig_user || "");
  q("stu-dokon", STU.sozlama.dokon_nom || "");     // ✅ A2
  q("stu-tel", STU.sozlama.tel || "");
  q("stu-rang1", STU.sozlama.brend_rang || "#0D1B2A");
  q("stu-rang2", STU.sozlama.brend_rang2 || "#F2A20C");
  const r = document.getElementById("stu-ig-rejim");
  if (r) r.value = STU.sozlama.ig_rejim || "ozi";
}
async function stuSozlamaSaqla() {
  const v = id => (document.getElementById(id) || {}).value || "";
  const d = await stuAI("sozlama_saqla", {
    kanal_id:  v("stu-kanal"),
    kanal_nom: v("stu-kanal-nom"),
    ig_user:   v("stu-ig"),
    ig_rejim:  v("stu-ig-rejim"),
    dokon_nom:   v("stu-dokon"),           // ✅ A2
    tel:         v("stu-tel"),
    brend_rang:  v("stu-rang1"),
    brend_rang2: v("stu-rang2"),
    shrift:      STU.tipo,
  });
  if (!d) return;
  STU.sozlama = d.sozlama || STU.sozlama;
  toast("Sozlama saqlandi", "ok");
}

// ── Tayyor reklamani do'kon kanaliga yuborish
function _stuIzoh() {
  const t = STU.tovar || {};
  const q = [];
  if (t.nom) q.push("<b>" + t.nom + "</b>");
  const tf = [t.art ? "ART " + t.art : "", t.rang || "", t.olcham || ""]
    .filter(Boolean).join(" · ");
  if (tf) q.push(tf);
  if (STU.narxKorsat && t.narx) q.push("💰 " + stSon(t.narx) + " so'm");
  if (STU.yorliq) q.push("✨ " + STU.yorliq);
  return q.join("\n");
}
async function stuKanalga(video) {
  if (!STU.sozlama.kanal_id) {
    toast("Avval kanal ID sini kiriting va saqlang", "err"); return;
  }
  const b = document.getElementById("stu-kanal-yubor");
  if (b) { b.disabled = true; b.textContent = "⏳ Yuborilmoqda…"; }
  try {
    const c = document.createElement("canvas");
    stChiz(c, stFmt());
    const data = c.toDataURL("image/jpeg", 0.92);   // ✅ yuklama: PNG emas
    const d = await stuAI("kanalga", { image: data, matn: _stuIzoh() });
    if (d && d.ok) toast("Kanalga yuborildi ✅", "ok");
  } finally {
    if (b) { b.disabled = false; b.textContent = "📢 Kanalga yuborish"; }
  }
}

// ═══════════════════════════════════════════════════════════════
// ✅ A2 (2026-09-06) — ShRIFT VA BREND TO'PLAMI
// ═══════════════════════════════════════════════════════════════
// Do'kon bir marta kiritadi: nomi, telefoni, firma ranglari,
// logotipi va yoqqan tipografikasi — keyin HAMMA reklamaga o'zi
// tushadi. Logotip qurilmada saqlanadi (256px, ~20-60 KB):
// bazaga og'ir rasm yozilmaydi (rasm ombori 51% to'lgan).
function stuTipoChiz() {
  const el = document.getElementById("stu-tipo");
  if (!el) return;
  el.innerHTML = STU_TIPO.map(t =>
    `<button class="stu-chip${t.id === STU.tipo ? " on" : ""}"
       onclick="stuTipo('${t.id}')">${t.nom}</button>`).join("");
}
function stuTipo(id) { STU.tipo = id; stChiz();
  _stuKech(() => { renderStudio(); stuVariantChiz(); }); }

// ── Logotip: yuklash, kichraytirish, saqlash
// ═══ ✅ XOTIRA QO'RIQChISI (2026-09-06) ═══
// DZ-iPhone saboqi: cho'ntak (localStorage) to'lsa butun ilova
// "xotira to'ldi" holatiga tushadi. Shuning uchun Studio:
//   · qurilmaga FAQAT ikki narsa yozadi (logotip va sevimlilar);
//   · har yozuvdan oldin HAJM tekshiriladi;
//   · kvota xatosi bo'lsa — o'zining eski kalitlarini tozalab,
//     bir marta qayta uriniladi, bo'lmasa xotirada ishlayveradi.
const STU_LS_MAX = 90 * 1024;              // bitta kalit uchun chegara
function _stuLS(kalit, qiymat) {
  try {
    if (String(qiymat).length > STU_LS_MAX) return false;
    localStorage.setItem(kalit, qiymat);
    return true;
  } catch (e) {
    try {                                   // o'z eski izlarini tozalash
      Object.keys(localStorage).forEach(k => {
        if (k.indexOf("merx_studio_") === 0 && k !== kalit) localStorage.removeItem(k);
      });
      localStorage.setItem(kalit, qiymat);
      return true;
    } catch (e2) {
      console.warn("[studio] qurilma xotirasi to'la — xotirada davom etamiz");
      return false;
    }
  }
}
function _stuLogoKalit() {
  return "merx_studio_logo_" + ((window.db && db.shopId) || "x");
}
function stuLogo(inp) {
  const f = inp && inp.files && inp.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    const im = new Image();
    im.onload = () => {
      try {
        // ✅ XOTIRA: 200px yetarli (reklamada logotip kichik chiqadi).
        // Avval PNG (shaffoflik saqlanadi); og'ir bo'lsa JPEG ga o'tamiz.
        const k = Math.min(1, 200 / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        let data = c.toDataURL("image/png");
        if (data.length > STU_LS_MAX) data = c.toDataURL("image/jpeg", 0.85);
        STU.brend.logoImg = c;
        const saqlandi = _stuLS(_stuLogoKalit(), data);
        stChiz(); stuVariantChiz();
        toast(saqlandi ? "Logotip saqlandi"
                       : "Logotip qo'llandi (qurilmada saqlanmadi — xotira to'la)", "ok");
      } catch (e3) { toast("Logotip qo'shilmadi", "err"); }
    };
    im.src = e.target.result;
  };
  r.readAsDataURL(f);
}
function stuLogoTikla() {
  try {
    const d = localStorage.getItem(_stuLogoKalit());
    if (!d) return;
    const im = new Image();
    im.onload = () => { STU.brend.logoImg = im; stChiz(); };
    im.src = d;
  } catch (e) {}
}
function stuLogoOchir() {
  STU.brend.logoImg = null;
  try { localStorage.removeItem(_stuLogoKalit()); } catch (e) {}
  stChiz(); toast("Logotip o'chirildi", "ok");
}

// ── Shriftlarni yuklab, so'ng qayta chizish (canvas tayyor shriftni
//    oladi — aks holda birinchi chizishda zaxira shrift chiqadi)
function stuShriftYukla() {
  try {
    if (!document.fonts || !document.fonts.load) return;
    const p = [];
    STU_TIPO.forEach(t => {
      p.push(document.fonts.load(`900 48px ${t.d}`));
      p.push(document.fonts.load(`700 24px ${t.b}`));
    });
    Promise.all(p).then(() => { stChiz(); stuVariantChiz(); }).catch(() => {});
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
// ✅ B1 (2026-09-06) — ShABLON BRAUZERI
// ═══════════════════════════════════════════════════════════════
// Shablonlar endi RO'YXAT emas, KATALOG: kategoriya tablari,
// qidiruv, sevimlilar va JONLI namoyish (har kartada tovaringiz
// bilan chizilgan haqiqiy natija ko'rinadi).
const STU_KAT = [
  { id:"hammasi", nom:"Hammasi" },
  { id:"oyoq",    nom:"Oyoq kiyim" },
  { id:"kiyim",   nom:"Kiyim" },
  { id:"sumka",   nom:"Sumka · aksessuar" },
  { id:"bolalar", nom:"Bolalar" },
  { id:"sport",   nom:"Sport" },
  { id:"real",    nom:"Real shaxs" },
  { id:"model",   nom:"Modelli" },
  { id:"sevimli", nom:"★ Sevimli" },
];
function _sevKalit() { return "merx_studio_sev"; }
function stuSevTikla() {
  try { STU.sevimli = JSON.parse(localStorage.getItem(_sevKalit()) || "[]"); }
  catch (e) { STU.sevimli = []; }
}
function stuSev(id, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const i = STU.sevimli.indexOf(id);
  if (i >= 0) STU.sevimli.splice(i, 1); else STU.sevimli.push(id);
  _stuLS(_sevKalit(), JSON.stringify(STU.sevimli));   // ✅ XOTIRA
  stuBrauzer();
}
function stuKat(id)   { STU.katFiltr = id; stuBrauzer(); }
function stuQidiruv(v){ STU.qidiruv = String(v || "").trim().toLowerCase(); stuBrauzer(); }

function _shabRoyxat() {
  let r = STU_SHAB.slice();
  const f = STU.katFiltr;
  if (f === "sevimli")      r = r.filter(s => STU.sevimli.indexOf(s.id) >= 0);
  else if (f !== "hammasi") r = r.filter(s => (s.kat || []).indexOf(f) >= 0);
  if (STU.qidiruv) {
    r = r.filter(s => ((s.nom || "") + " " + (s.uchun || "")).toLowerCase()
      .indexOf(STU.qidiruv) >= 0);
  }
  // sevimlilar tepada
  return r.sort((a, b) =>
    (STU.sevimli.indexOf(b.id) >= 0) - (STU.sevimli.indexOf(a.id) >= 0));
}
function stuBrauzer() {
  const tab = document.getElementById("stu-katlar");
  if (tab) tab.innerHTML = STU_KAT.map(k => {
    const n = k.id === "hammasi" ? STU_SHAB.length
      : k.id === "sevimli" ? STU.sevimli.length
      : STU_SHAB.filter(s => (s.kat || []).indexOf(k.id) >= 0).length;
    return `<button class="stu-chip${k.id === STU.katFiltr ? " on" : ""}"
      onclick="stuKat('${k.id}')">${k.nom} <b style="opacity:.55">${n}</b></button>`;
  }).join("");

  const el = document.getElementById("stu-brauzer");
  if (!el) return;
  const r = _shabRoyxat();
  if (!r.length) {
    el.innerHTML = `<div style="padding:18px;text-align:center;color:#8A8578;font-size:12.5px">
      Bu bo'limda shablon yo'q</div>`;
    return;
  }
  el.innerHTML = r.map(s => `
    <button class="stu-sh${s.id === STU.shab ? " on" : ""}" onclick="stuShab('${s.id}')">
      <canvas id="stu-sc-${s.id}" width="164" height="205" data-sh="${s.id}"></canvas>
      <span class="stu-sh-nom">${s.nom}</span>
      <i class="stu-sh-sev${STU.sevimli.indexOf(s.id) >= 0 ? " on" : ""}"
         onclick="stuSev('${s.id}', event)">★</i>
    </button>`).join("");
  _stuNamoyish(el);                                  // ✅ D2
}

// ✅ D2 (2026-09-06): NAMOYIShLAR KO'RINGANDA ChIZILADI.
// 103 shablonni birdan chizish telefonni bir necha soniyaga qotiradi.
// Endi faqat ekranda ko'ringan kartalar chiziladi (IntersectionObserver),
// va bir xil holat ikkinchi marta chizilmaydi (imzo keshi).
function _stuImzo() {
  return [STU.pal, STU.tipo, STU.real ? "r" : "",
          (STU.tovar && STU.tovar.art) || "", STU.img ? "i" : "",
          STU.fon ? "f" : ""].join("|");
}
function _stuNamoyish(el) {
  const imzo = _stuImzo();
  const chiz = c => {
    if (!c || c.dataset.sig === imzo) return;
    try {
      stChiz(c, { w: +c.width, h: +c.height }, { shab: c.dataset.sh, pal: STU.pal });
      c.dataset.sig = imzo;
    } catch (e) {}
  };
  const kartalar = [].slice.call(el.querySelectorAll("canvas[data-sh]"));
  if (!window.IntersectionObserver) { kartalar.slice(0, 12).forEach(chiz); return; }
  if (el._kuzat) el._kuzat.disconnect();
  el._kuzat = new IntersectionObserver(lar => {
    lar.forEach(x => { if (x.isIntersecting) chiz(x.target); });
  }, { rootMargin: "220px" });
  kartalar.forEach(c => el._kuzat.observe(c));
}

// ═══════════════════════════════════════════════════════════════
// ✅ C1 (2026-09-06) — FON KUTUBXONASI (umumiy, fasllar bo'yicha)
// ═══════════════════════════════════════════════════════════════
// Uch sinf uchun fonlar: TOVAR (modelsiz), MODEL kadri va REAL
// XODIM kadri. Har fon bir marta yaratiladi va hamma do'konga
// umumiy — shuning uchun ikkinchi marta BEPUL va bir zumda keladi.
// Odam kadri uchun: "Shaxsni ajratish" → fon almashtiriladi
// (yuzga tegilmaydi — faqat kesib olinadi).
STU.fonSinf = "tovar";
STU.fonMavsum = "hamma";
STU.fonRoyxat = [];
STU.fonKesh = {};

const STU_MAVSUM = [
  { id:"hamma",  nom:"Hammasi" },
  { id:"qish",   nom:"❄ Qish" },
  { id:"bahor",  nom:"🌸 Bahor" },
  { id:"yoz",    nom:"☀ Yoz" },
  { id:"kuz",    nom:"🍂 Kuz" },
  { id:"bayram", nom:"🎆 Bayram" },
];
const STU_FSINF = [
  { id:"tovar", nom:"Tovar" },
  { id:"model", nom:"Model" },
  { id:"real",  nom:"Real xodim" },
];

async function stuFonlar() {
  const d = await stuAI("fonlar", { sinf: STU.fonSinf, mavsum: STU.fonMavsum });
  if (!d) return;
  STU.fonRoyxat = d.royxat || [];
  stuFonChiz();
}
function stuFonSinf(v)   { STU.fonSinf = v; stuFonlar(); }
function stuFonMavsum(v) { STU.fonMavsum = v; stuFonlar(); stuKodFonChiz(); }
function stuFonChiz() {
  const s1 = document.getElementById("stu-fsinf");
  if (s1) s1.innerHTML = STU_FSINF.map(x =>
    `<button class="stu-chip${x.id === STU.fonSinf ? " on" : ""}"
      onclick="stuFonSinf('${x.id}')">${x.nom}</button>`).join("");
  const s2 = document.getElementById("stu-fmavsum");
  if (s2) s2.innerHTML = STU_MAVSUM.map(x =>
    `<button class="stu-chip${x.id === STU.fonMavsum ? " on" : ""}"
      onclick="stuFonMavsum('${x.id}')">${x.nom}</button>`).join("");
  const el = document.getElementById("stu-fonlar");
  if (!el) return;
  if (!STU.fonRoyxat.length) {
    el.innerHTML = `<div style="padding:14px;text-align:center;color:#8A8578;font-size:12.5px">
      Bu bo'limda fon yo'q</div>`;
    return;
  }
  el.innerHTML = STU.fonRoyxat.map(f => `
    <button class="stu-fon" onclick="stuFonTanla('${f.id}')" title="${f.nom}">
      ${f.url ? `<img src="${f.url}" loading="lazy" alt="${f.nom}">`
              : `<div class="stu-fon-bosh">✨ yaratiladi</div>`}
      <span>${f.nom}</span>
    </button>`).join("");
}
async function stuFonTanla(fid) {
  if (STU.fonKesh[fid]) {                    // sessiyada allaqachon olingan
    STU.fon = STU.fonKesh[fid]; stChiz(); stuVariantChiz();
    toast("Fon qo'yildi", "ok"); return;
  }
  stuHolat("🏞 Fon olinmoqda…");
  const d = await stuAI("fon_ol", { fon: fid });
  stuHolat("");
  if (!d) return;
  try {
    const im = await _stuImg(d.image);
    STU.fon = im;
    // ✅ XOTIRA: keshda eng ko'pi 6 ta fon (har biri ~4-8 MB RAM)
    const _fk = Object.keys(STU.fonKesh);
    if (_fk.length >= 6) delete STU.fonKesh[_fk[0]];
    STU.fonKesh[fid] = im;
    stChiz(); stuVariantChiz();
    toast(d.kesh ? "Fon qo'yildi" : "Yangi fon yaratildi", "ok");
    stuFonlar();                              // ro'yxatdagi namoyish yangilansin
  } catch (e) { toast("Fon ochilmadi", "err"); }
}
// ✅ C1: odam kadridan shaxsni ajratish (yuzga tegilmaydi)
async function stuShaxsAjrat(jim) {
  if (!STU.img) { if (!jim) toast("Avval surat yuklang", "err"); return false; }
  if (!STU.asl) STU.asl = STU.img;
  stuHolat("✂️ Shaxs ajratilmoqda…");
  const c = document.createElement("canvas");
  const k = Math.min(1, 1200 / Math.max(STU.img.width, STU.img.height));
  c.width = Math.round(STU.img.width * k); c.height = Math.round(STU.img.height * k);
  c.getContext("2d").drawImage(STU.img, 0, 0, c.width, c.height);
  const d = await stuAI("shaxs", { image: c.toDataURL("image/jpeg", 0.85) });
  stuHolat("");
  if (!d) return;
  try {
    STU.img = _stuTrim(await _stuImg(d.image));
    STU.soya = true; STU.aks = true;
    if (!jim) { stChiz(); stuVariantChiz(); toast("Shaxs ajratildi — endi fon tanlang", "ok"); }
    return true;
  } catch (e) { if (!jim) toast("Natija ochilmadi", "err"); return false; }
}

// ✅ XOTIRA: boshqa sahifaga o'tilganda og'ir rasmlar bo'shatiladi
// (telefonda Studio ochiq qolgani uchun kassa sekinlashmasin).
(function () {
  try {
    const asl = window.nav;
    if (typeof asl !== "function" || window._stuNavUlandi) return;
    window._stuNavUlandi = true;
    window.nav = function (p) {
      if (p !== "studio" && STU && STU._limitOlindi) {
        STU.fonKesh = {}; STU.sahnaKesh = {};
        STU.img2 = null;
        if (STU.asl && STU.asl !== STU.img) STU.asl = null;
      }
      return asl.apply(this, arguments);
    };
  } catch (e) {}
})();

// ═══════════════════════════════════════════════════════════════
// ✅ C2 (2026-09-06) — KOD-FONLAR (AI'siz, bir zumda, cheksiz)
// ═══════════════════════════════════════════════════════════════
// Bu fonlar generatsiya qilinmaydi — BRAUZERDA chiziladi:
// xarajat 0, kutish 0, internet shart emas. Mavsumga bo'lingan.
// AI-fonlar (C1) fotografik sahna kerak bo'lganda ishlatiladi;
// bular esa toza, zamonaviy va bir zumda.
const _KF = {                       // mavsum ranglari
  qish:   ["#0B1E33","#1C3A5E","#7FB2D9","#E8F1F8"],
  bahor:  ["#F7E9F0","#E9C0D4","#9BD1B0","#FFFFFF"],
  yoz:    ["#0F5C52","#19A08A","#FFD166","#FFFFFF"],
  kuz:    ["#3A2416","#8C5A2B","#E0A458","#F5E9DA"],
  bayram: ["#1A0B2E","#4C1D95","#F2A20C","#FFFFFF"],
  neytral:["#0D1B2A","#31465E","#F2A20C","#F1EFEA"],
};
function _kfGrad(ctx, W, H, c1, c2, burchak) {
  const a = (burchak || 120) * Math.PI / 180;
  const g = ctx.createLinearGradient(
    W/2 - Math.cos(a)*W/2, H/2 - Math.sin(a)*H/2,
    W/2 + Math.cos(a)*W/2, H/2 + Math.sin(a)*H/2);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function _kfMesh(ctx, W, H, r) {
  ctx.fillStyle = r[0]; ctx.fillRect(0, 0, W, H);
  [[.2,.22,r[1]],[.8,.28,r[2]],[.3,.8,r[2]],[.85,.78,r[1]]].forEach(([x,y,c])=>{
    const g = ctx.createRadialGradient(x*W, y*H, 0, x*W, y*H, W*.6);
    g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.globalAlpha = .55; ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H); ctx.restore();
  });
}
function _kfPodium(ctx, W, H, r) {
  _kfGrad(ctx, W, H, r[3], r[1], 90);
  ctx.fillStyle = r[0]; ctx.globalAlpha = .10;
  ctx.beginPath(); ctx.ellipse(W*.5, H*.72, W*.42, H*.06, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, H*.70, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.14)");
  ctx.fillStyle = g; ctx.fillRect(0, H*.70, W, H*.30);
}
function _kfHalqa(ctx, W, H, r) {
  ctx.fillStyle = r[0]; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = r[2]; ctx.globalAlpha = .25;
  for (let i = 1; i <= 6; i++) {
    ctx.lineWidth = W*.004;
    ctx.beginPath(); ctx.arc(W*.5, H*.46, W*.12*i, 0, Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function _kfYoy(ctx, W, H, r) {          // katta yoy (arch)
  _kfGrad(ctx, W, H, r[3], r[1], 200);
  ctx.fillStyle = r[2]; ctx.globalAlpha = .9;
  ctx.beginPath();
  ctx.moveTo(W*.14, H*.86); ctx.lineTo(W*.14, H*.42);
  ctx.arc(W*.5, H*.42, W*.36, Math.PI, 0);
  ctx.lineTo(W*.86, H*.86); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}
function _kfChiziq(ctx, W, H, r) {
  ctx.fillStyle = r[0]; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = r[1]; ctx.globalAlpha = .5;
  const q = W*.085;
  for (let x = -H; x < W; x += q*2) {
    ctx.save(); ctx.translate(x, 0); ctx.rotate(-18*Math.PI/180);
    ctx.fillRect(0, -H*.2, q, H*1.6); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function _kfSuzani(ctx, W, H, r) {
  _kfGrad(ctx, W, H, r[0], r[1], 140);
  ctx.fillStyle = r[2]; ctx.globalAlpha = .16;
  const q = W*.16;
  for (let y = q*.6; y < H+q; y += q*1.35)
    for (let x = q*.6; x < W+q; x += q*1.35) {
      _yulduz(ctx, x, y, q*.34, 8, .45); ctx.fill();
    }
  ctx.globalAlpha = 1;
}
function _kfNuqta(ctx, W, H, r) {
  _kfGrad(ctx, W, H, r[3], r[1], 60);
  ctx.fillStyle = r[0]; ctx.globalAlpha = .14;
  const q = W*.055;
  for (let y = q; y < H; y += q) for (let x = q; x < W; x += q) {
    ctx.beginPath(); ctx.arc(x, y, q*.10, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
const STU_KODFON = [];
[["neytral","Neytral"],["qish","Qish"],["bahor","Bahor"],
 ["yoz","Yoz"],["kuz","Kuz"],["bayram","Bayram"]].forEach(([m, nom]) => {
  const r = _KF[m];
  STU_KODFON.push(
    { id: m+"_grad",  mavsum:m, nom:nom+" · gradient", chiz:(c,W,H)=>_kfGrad(c,W,H,r[0],r[1],130) },
    { id: m+"_mesh",  mavsum:m, nom:nom+" · mesh",     chiz:(c,W,H)=>_kfMesh(c,W,H,r) },
    { id: m+"_podium",mavsum:m, nom:nom+" · podium",   chiz:(c,W,H)=>_kfPodium(c,W,H,r) },
    { id: m+"_yoy",   mavsum:m, nom:nom+" · yoy",      chiz:(c,W,H)=>_kfYoy(c,W,H,r) },
    { id: m+"_suzani",mavsum:m, nom:nom+" · suzani",   chiz:(c,W,H)=>_kfSuzani(c,W,H,r) },
    { id: m+"_halqa", mavsum:m, nom:nom+" · halqa",    chiz:(c,W,H)=>_kfHalqa(c,W,H,r) },
    { id: m+"_chiziq",mavsum:m, nom:nom+" · chiziq",   chiz:(c,W,H)=>_kfChiziq(c,W,H,r) },
    { id: m+"_nuqta", mavsum:m, nom:nom+" · nuqta",    chiz:(c,W,H)=>_kfNuqta(c,W,H,r) });
});
// Kod-fonni qo'llash: bir zumda, so'rovsiz
function stuKodFon(id) {
  const f = STU_KODFON.find(x => x.id === id);
  if (!f) return;
  const c = document.createElement("canvas");
  c.width = 1200; c.height = 1500;
  try { f.chiz(c.getContext("2d"), c.width, c.height); } catch (e) { return; }
  STU.fon = c; stChiz(); stuVariantChiz();
  toast(f.nom, "ok");
}
function stuKodFonChiz() {
  const el = document.getElementById("stu-kodfon");
  if (!el) return;
  const r = STU.fonMavsum === "hamma"
    ? STU_KODFON : STU_KODFON.filter(f => f.mavsum === STU.fonMavsum ||
        (STU.fonMavsum === "hamma"));
  const ro = r.length ? r : STU_KODFON.filter(f => f.mavsum === "neytral");
  el.innerHTML = ro.map(f =>
    `<button class="stu-fon" onclick="stuKodFon('${f.id}')" title="${f.nom}">
       <canvas id="stu-kf-${f.id}" width="112" height="112"></canvas>
       <span>${f.nom.split(" · ")[1] || f.nom}</span>
     </button>`).join("");
  ro.forEach(f => {
    const c = document.getElementById("stu-kf-" + f.id);
    if (c) { try { f.chiz(c.getContext("2d"), c.width, c.height); } catch (e) {} }
  });
}

// ═══════════════════════════════════════════════════════════════
// ✅ KK (2026-09-06) — KO'P SURAT VA XODIM KADRI
// ═══════════════════════════════════════════════════════════════
// Avval bitta rasm sloti bor edi — shu sabab (a) do'kon O'Z XODIMI
// suratini yuklay olmasdi, (b) kollaj uchun ikkinchi tovar yo'q edi,
// (c) bir modelga bir necha kiyimni birga kiydirib bo'lmasdi.
// Endi: 4 ta TOVAR sloti + alohida ShAXS sloti (xodim yoki model).
// Ketma-ket kiydirish: shim → ko'ylak → oyoq kiyim (har biri
// oldingi natija ustiga qo'yiladi).
function stuRasmSlot(inp, i) {
  const f = inp && inp.files && inp.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    const im = new Image();
    im.onload = () => {
      STU.rasmlar[i] = im;
      if (i === STU.asosiy || !STU.img) { STU.img = im; STU.asl = im; STU.asosiy = i; }
      STU.fokus = { x: .5, y: .38 };
      stuSlotChiz(); stChiz(); stuVariantChiz();
    };
    im.onerror = () => toast("Rasm ochilmadi", "err");
    im.src = e.target.result;
  };
  r.readAsDataURL(f);
}
function stuAsosiy(i) {
  if (!STU.rasmlar[i]) return;
  STU.asosiy = i; STU.img = STU.rasmlar[i]; STU.asl = STU.rasmlar[i];
  stuSlotChiz(); stChiz(); stuVariantChiz();
}
function stuSlotOchir(i) {
  STU.rasmlar[i] = null;
  if (STU.asosiy === i) {
    const j = STU.rasmlar.findIndex(x => x);
    if (j >= 0) stuAsosiy(j); else { STU.img = null; STU.asl = null; }
  }
  stuSlotChiz(); stChiz(); stuVariantChiz();
}
function stuShaxsRasm(inp) {
  const f = inp && inp.files && inp.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    const im = new Image();
    im.onload = () => { STU.shaxs = im; stuSlotChiz();
      toast("Xodim surati qo'shildi — endi kiyimlarni tanlang", "ok"); };
    im.src = e.target.result;
  };
  r.readAsDataURL(f);
}
function stuSlotChiz() {
  const el = document.getElementById("stu-slotlar");
  if (el) {
    let h = "";
    for (let i = 0; i < 4; i++) {
      const im = STU.rasmlar[i];
      h += `<div class="stu-slot${i === STU.asosiy && im ? " on" : ""}">
        ${im ? `<img src="${im.src || ""}" onclick="stuAsosiy(${i})" alt="">
                <b onclick="stuSlotOchir(${i})">\u00d7</b>`
             : `<label>+<input type="file" accept="image/*" capture="environment"
                   onchange="stuRasmSlot(this, ${i})" style="display:none"></label>`}
        <span>${i === 0 ? "asosiy" : (i + 1) + "-tovar"}</span></div>`;
    }
    el.innerHTML = h;
  }
  const sh = document.getElementById("stu-shaxs");
  if (sh) sh.innerHTML = STU.shaxs
    ? `<img src="${STU.shaxs.src || ""}" alt="">
       <button onclick="STU.shaxs=null;stuSlotChiz()">O'chirish</button>`
    : `<label class="stu-yukla">\U0001f9cd Xodim yoki model suratini yuklash
         <input type="file" accept="image/*" onchange="stuShaxsRasm(this)" style="display:none"></label>`;
}

// ── Rasmni yuborishga tayyorlash (kichraytirib, oq fon bilan)
function _stuTayyor(im, maxOlcham, oqFon) {
  const c = document.createElement("canvas");
  const k = Math.min(1, (maxOlcham || 1100) / Math.max(im.width, im.height));
  c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  const x = c.getContext("2d");
  if (oqFon !== false) { x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, c.width, c.height); }
  x.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.86);
}

// ── ✅ KO'P KIYIMNI KETMA-KET KIYDIRISH
// Har kiyim alohida so'rov: natija keyingisiga shaxs bo'lib uzatiladi.
// Shu tufayli shim + ko'ylak + oyoq kiyim bitta kadrda chiqadi.
async function stuKiydirKop(manba) {
  const tanlangan = STU.rasmlar.map((im, i) => im ? i : -1).filter(i => i >= 0);
  if (!tanlangan.length) { toast("Avval kiyim suratlarini yuklang", "err"); return; }
  if (manba === "shaxs" && !STU.shaxs) {
    toast("Xodim suratini yuklang yoki AI-modelni tanlang", "err"); return;
  }
  const b = document.getElementById("stu-kiydir-kop");
  if (b) { b.disabled = true; }
  let shaxsData = manba === "shaxs" ? _stuTayyor(STU.shaxs, 1200) : null;
  const jins = manba === "ayol" ? "ayol" : "erkak";
  try {
    for (let n = 0; n < tanlangan.length; n++) {
      const i = tanlangan[n];
      stuHolat(`\U0001f457 ${n + 1}/${tanlangan.length} kiyim kiydirilmoqda\u2026`);
      const d = await stuAI("kiydir", {
        jins,
        model_image: shaxsData || undefined,
        image: _stuTayyor(STU.rasmlar[i], 1100),
        turi: (STU.kiyimTuri && STU.kiyimTuri[i]) || "auto",
      });
      if (!d) { stuHolat(""); return; }
      shaxsData = d.image;                       // natija — keyingi qadamga
    }
    STU.img = await _stuImg(shaxsData);
    STU.fon = null; STU.soya = false; STU.aiNamoyish = (manba !== "shaxs");
    STU.shab = "model";
    STU.variants = [
      { shab: "model",   pal: STU.avtoPal ? "auto" : "navy" },
      { shab: "kadr",    pal: "qora" },
      { shab: "ki01",    pal: "amber" },
      { shab: "katalog", pal: "oq" },
    ];
    STU.tanlanganV = 0;
    stuHolat(""); stuVariantChiz(); renderStudio();
    toast(tanlangan.length + " ta kiyim kiydirildi", "ok");
  } catch (e) {
    stuHolat(""); toast("Xato: " + e.message, "err");
  } finally { if (b) b.disabled = false; }
}
// kiyim turini belgilash (aniqroq natija uchun)
STU.kiyimTuri = {};
function stuKiyimTuri(i, v) { STU.kiyimTuri[i] = v; }

// ═══════════════════════════════════════════════════════════════
// ✅ ODDIY REJIM (2026-09-07) — do'konchi uchun, SMM-chi uchun emas
// ═══════════════════════════════════════════════════════════════
// Uch harakat: tovar → surat → ✨. Qolgan hamma narsa yashirin.
// Natija ekranida ham uch tugma: Kanalga · Yuklab olish · Yana.
// "Pro" — ustaxona (7 panel) faqat xohlaganlar uchun.
async function stuFonAvto(sinf, jim) {
  const d = await stuAI("fon_avto", { sinf, oldingi: STU.fonId || "" });
  if (!d) return false;
  try {
    STU.fon = await _stuImg(d.image); STU.fonId = d.fon; STU.fonNom = d.nom || "";
    if (!jim) { stChiz(); stuVariantChiz(); toast("Fon: " + STU.fonNom, "ok"); }
    return true;
  } catch (e) { return false; }
}
function stuRejim(r) {
  STU.rejim = r;
  const od = document.getElementById("stu-oddiy");
  const pr = document.getElementById("stu-pro");
  if (od) od.style.display = r === "pro" ? "none" : "block";
  if (pr) pr.style.display = r === "pro" ? "block" : "none";
  _stuLS("merx_studio_rejim", r);
  if (r === "pro") renderStudio(); else stuOddiyChiz();
}
function stuOddiyChiz() {
  // oxirgi qo'shilgan tovarlar — bir bosishda tanlash
  const el = document.getElementById("stu-od-tovarlar");
  if (el) {
    const manba = (typeof visProds === "function" ? visProds() : (db.products || []))
      .slice().sort((a, b) => (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)))
      .slice(0, 8);
    el.innerHTML = manba.map(p => {
      const on = STU.tovar && String(STU.tovar.art) === String(p.art || p.sku);
      const rasm = (p.colorImages && Object.values(p.colorImages)[0]) || p.image || "";
      return `<button class="stu-od-tov${on ? " on" : ""}"
        onclick="stuTanla('${String(p.sku).replace(/'/g, "\\'")}');stuOddiyChiz()">
        ${rasm ? `<img src="${rasm}" loading="lazy" alt="">` : `<i>◈</i>`}
        <span>${p.name || "—"}</span></button>`;
    }).join("") || `<div class="st-hint">Katalogda tovar yo'q</div>`;
  }
  const t = document.getElementById("stu-od-tovar");
  if (t) t.textContent = STU.tovar ? "✓ " + STU.tovar.nom : "Tovarni tanlang";
  const s2 = document.getElementById("stu-od-surat");
  if (s2) s2.textContent = STU.img ? "✓ Surat tayyor" : "📷 Suratga oling";
  const g = document.getElementById("stu-od-go");
  if (g) g.disabled = !(STU.tovar && STU.img);
  stuNatijaKorsat(!!STU.variants.length);
}
function stuOdamKadri(on) { STU.odamKadri = !!on; }
function stuNatijaKorsat(bor) {
  const n = document.getElementById("stu-od-natija");
  if (!n) return;
  n.style.display = bor ? "block" : "none";
  if (!bor) return;
  const c = document.getElementById("stu-od-cvs");
  if (c) stChiz(c, stFmt());
  const v = document.getElementById("stu-od-variants");
  if (v) {
    v.innerHTML = STU.variants.map((x, i) =>
      `<button class="stu-vr${i === STU.tanlanganV ? " on" : ""}" onclick="stuVariantTanla(${i});stuNatijaKorsat(true)">
         <canvas id="stu-ovc${i}" width="180" height="225"></canvas></button>`).join("");
    STU.variants.forEach((x, i) => {
      const cc = document.getElementById("stu-ovc" + i);
      if (cc) { try { stChiz(cc, { w: 180, h: 225 }, x); } catch (e) {} }
    });
  }
  const f = document.getElementById("stu-od-fmt");
  if (f) f.innerHTML = STU_FMT.map(x =>
    `<button class="${x.id === STU.fmt ? "on" : ""}" onclick="stuFmt('${x.id}');stuNatijaKorsat(true)">${x.nom}</button>`).join("");
}
async function stuYana() {
  STU.variants = stuVariantlar(STU.variants);
  STU.tanlanganV = 0;
  const v = STU.variants[0]; STU.shab = v.shab; STU.pal = v.pal;
  stuVariantChiz(); stuNatijaKorsat(true);
  toast("Yana 6 ta variant", "ok");
}
async function stuBoshqaFon() {
  const ok2 = await stuFonAvto(STU.real ? "real" : "tovar", true);
  if (ok2) { stuNatijaKorsat(true); stuVariantChiz(); toast("Fon: " + STU.fonNom, "ok"); }
}
