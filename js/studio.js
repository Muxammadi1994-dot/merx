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
    id:"narx", nom:"Katta narx", uchun:"Ulgurji — narx birinchi",
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
    id:"lenta", nom:"Yon lenta", uchun:"Kiyim — tovar katta ko'rinadi",
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
    id:"sarlavha", nom:"Sarlavha", uchun:"To'plam va mavsum e'loni",
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
    id:"burchak", nom:"Diagonal", uchun:"E'lon va narx bir kadrda",
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
    id:"katalog", nom:"Katalog", uchun:"Ulgurji xaridor — hamma ma'lumot",
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
    id:"kadr", nom:"Kadr", uchun:"Real shaxs — to'liq kadr, pastda yozuv",
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
    id:"yonkadr", nom:"Yon yozuv", uchun:"Real shaxs — yon lentali",
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
    id:"sokin", nom:"Sokin", uchun:"Real shaxs — minimal, faqat narx",
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
    id:"model", nom:"Modelda", uchun:"Kiyim — to'liq kadr (modelli surat)",
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
    id:"chegirma", nom:"Chegirma", uchun:"Aksiya — eski narx chizilgan",
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
];

// ── Holat ──────────────────────────────────────────────────────
const STU = {
  shab: "narx", pal: "navy", fmt: "post",
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
function stPal() {
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
function stFit(ctx, matn, maxW, px, vazn) {
  let p = px;
  while (p > 8) {
    ctx.font = `${vazn} ${p}px ${STU_SHRIFT}`;
    if (ctx.measureText(matn).width <= maxW) break;
    p -= Math.max(1, Math.round(p * 0.04));
  }
  return p;
}
// ikki satrga bo'lish
function stWrap(ctx, matn, maxW, px, vazn, satr) {
  ctx.font = `${vazn} ${px}px ${STU_SHRIFT}`;
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
const STU_SHRIFT = '"Inter","Archivo",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

// manba → matn
function stManba(m) {
  const t = STU.tovar || {};
  switch (m) {
    case "nom":       return t.nom || "Tovar nomi";
    case "tafsilot": {
      // ✅ S4b: bo'sh qiymatlar tashlanadi — jonlida "qora · ·"
      // ko'rinishida ortiqcha ajratkichlar chiqib qolgan edi.
      return [t.art ? "ART " + t.art : "", t.rang || "", t.olcham || ""]
        .map(x => String(x).trim()).filter(Boolean).join("  ·  ");
    }
    case "yorliq":    return STU.yorliq || "";
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

// ── ChIZUVChI (retseptni o'qiydi) ──────────────────────────────
function stChiz(cvs, fmt, opt) {
  // ✅ S1: `opt` — {shab, pal} bo'lsa O'ShA variant chiziladi
  // (galereyadagi 6 namuna shu bilan quriladi), aks holda joriy holat.
  const F = fmt || stFmt();
  const S = (opt && opt.shab)
    ? (STU_SHAB.find(x => x.id === opt.shab) || stShab()) : stShab();
  const P = (opt && opt.pal)
    ? (typeof opt.pal === "object" ? opt.pal
       : (opt.pal === "auto" && STU.avtoPal ? STU.avtoPal
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
      else if (L.tur === "fon" || L.tur === "blok" || L.tur === "burchak") { _a = 1; }
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

        case "blok":
          ctx.fillStyle = stRang(P, L.rang);
          ctx.fillRect(L.x * W, L.y * H, L.w * W, L.h * H);
          break;

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
            ctx.font = `600 ${Math.round(W * .028)}px ${STU_SHRIFT}`;
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
          if (L.moda === "cover") {          // ✅ S4b: ortiqchasi kesiladi
            ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
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
          const matn = stManba(L.manba);
          if (!matn) break;
          const maxW = (L.max || .9) * W;
          let px = stFit(ctx, matn, maxW, L.o * W, L.vazn || 700);
          const qatorlar = stWrap(ctx, matn, maxW, px, L.vazn || 700, L.satr || 1);
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
          if (L.burchak) {
            ctx.translate(L.x * W, L.y * H);
            ctx.rotate(L.burchak * Math.PI / 180);
            ctx.font = `${L.vazn || 700} ${px}px ${STU_SHRIFT}`;
            ctx.fillText(matn, 0, 0);
          } else {
            qatorlar.forEach((q, i) => {
              ctx.font = `${L.vazn || 700} ${px}px ${STU_SHRIFT}`;
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
          ctx.font = `${L.vazn || 900} ${px}px ${STU_SHRIFT}`;
          const wSom = px * .30;
          px = stFit(ctx, matn, W * .86 - wSom, px, L.vazn || 900);
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
          ctx.font = `${L.vazn || 900} ${px}px ${STU_SHRIFT}`;
          ctx.fillText(matn, x, _ny);
          ctx.font = `700 ${px * .30}px ${STU_SHRIFT}`;
          ctx.fillText(" so'm", x + wMatn + px * .06, _ny);
          break;
        }

        case "belgi": {
          const matn = stManba(L.manba);
          if (!matn) break;
          const px = L.o * W, pad = px * .42;
          ctx.font = `800 ${px}px ${STU_SHRIFT}`;
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
            let px = stFit(ctx, matn, r * 1.6, r * .52, 900);
            ctx.textAlign = "center";
            ctx.font = `900 ${px}px ${STU_SHRIFT}`;
            ctx.fillText(matn, cx, cy + px * .18);
            ctx.font = `700 ${r * .20}px ${STU_SHRIFT}`;
            ctx.fillText("so'm", cx, cy + px * .18 + r * .34);
            ctx.textAlign = "left";
          }
          break;
        }

        case "logo": {
          // ✅ S4: AI-modelli natijada halollik belgisi
          if (STU.aiNamoyish) {
            const pz = W * .022, pad = pz * .5;
            ctx.font = `700 ${pz}px ${STU_SHRIFT}`;
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
          ctx.font = `700 ${px}px ${STU_SHRIFT}`;
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
  const sh = document.getElementById("stu-shab");
  if (sh) sh.innerHTML = STU_SHAB.map(s =>
    `<button class="stu-chip${s.id === STU.shab ? " on" : ""}" onclick="stuShab('${s.id}')">
       ${s.nom}</button>`).join("");
  // palitra lentasi
  const pl = document.getElementById("stu-pal");
  if (pl) pl.innerHTML = STU_PAL.map(p =>
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
  const yr = document.getElementById("stu-yorliq");
  if (yr && yr.value !== STU.yorliq) yr.value = STU.yorliq;
  stChiz();
  if (!STU._limitOlindi) { STU._limitOlindi = true; stuLimit(); stuModellar(); }
}
function stuShab(id) { STU.shab = id; renderStudio(); }
function stuPal(id)  { STU.pal  = id; renderStudio(); }
function stuFmt(id)  { STU.fmt  = id; renderStudio(); }
function stuYorliq(v){ STU.yorliq = String(v || "").slice(0, 28); stChiz(); }
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
    im.onload = () => { STU.img = im; STU.imgAdj = { zoom:1, dx:0, dy:0 }; stChiz(); };
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
  if (el) el.textContent = `Bu oyda: ${n}/${ch}`;
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
  const k = Math.min(1, 1400 / Math.max(STU.img.width, STU.img.height));
  c.width = Math.round(STU.img.width * k); c.height = Math.round(STU.img.height * k);
  c.getContext("2d").drawImage(STU.img, 0, 0, c.width, c.height);
  const d = await stuAI("fon", { image: c.toDataURL("image/jpeg", 0.9) });
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
    if (d.sahna) STU.sahnaKesh[kat + "|" + d.sahna] = STU.fon;
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
  if (d && d.ok) stuSarf(d.sarf, d.chegara);
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
  if (bor(["oyoq", "krossovka", "botinka", "tufli", "shippak", "sandal",
           "poyabzal", "ked", "sneaker"])) return "oyoq";
  if (bor(["sumka", "ryukzak", "kamar", "aksessuar", "hamyon"])) return "sumka";
  if (bor(["ko'ylak", "koylak", "shim", "kiyim", "kostyum", "futbolka",
           "palto", "kurtka", "sviter", "shortik", "yubka", "kofta"]))
    return "kiyim";
  return "umumiy";
}

// ── Olti variant (uslub × palitra)
function stuVariantlar() {
  const A = STU.avtoPal ? "auto" : "navy";
  return [
    { shab: "narx",     pal: A },
    { shab: "sarlavha", pal: "amber" },
    { shab: "lenta",    pal: "qogoz" },
    { shab: "burchak",  pal: A },
    { shab: "katalog",  pal: "oq" },
    { shab: "chegirma", pal: "qizil" },
  ];
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
    stuHolat("1/3 · Tovar fondan ajratilmoqda…");
    await stuFonTozala(true);
    STU.avtoPal = stuPalitraChiqar(STU.img);   // ✅ S3: rang sahnadan OLDIN
    stuHolat("2/3 · Sahna tanlanmoqda…");
    await stuSahna(null, true);      // ✅ S3: server o'zi tanlaydi
    stuHolat("3/3 · Variantlar chizilmoqda…");
    STU.variants = stuVariantlar();
    STU.tanlanganV = 0;
    stuVariantChiz();
    const v = STU.variants[0];
    STU.shab = v.shab; STU.pal = v.pal;
    renderStudio();
    stuHolat("");
    toast("6 ta variant tayyor — yoqqanini tanlang", "ok");
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
       <canvas id="stu-vc${i}" width="360" height="450"></canvas>
       <span>${(STU_SHAB.find(s => s.id === v.shab) || {}).nom || ""}</span>
     </button>`).join("");
  STU.variants.forEach((v, i) => {
    const c = document.getElementById("stu-vc" + i);
    if (c) stChiz(c, { w: 360, h: 450 }, v);
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
  const k = Math.min(1, 1200 / Math.max(src.width, src.height));
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  const cx = c.getContext("2d");
  cx.fillStyle = "#FFFFFF"; cx.fillRect(0, 0, c.width, c.height);  // shaffofsiz
  cx.drawImage(src, 0, 0, c.width, c.height);
  const d = await stuAI("kiydir", { jins, image: c.toDataURL("image/jpeg", 0.92) });
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
