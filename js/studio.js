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
function stPal() { return STU_PAL.find(p => p.id === STU.pal) || STU_PAL[0]; }
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
const STU_SHRIFT = '"Inter","Archivo",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

// manba → matn
function stManba(m) {
  const t = STU.tovar || {};
  switch (m) {
    case "nom":       return t.nom || "Tovar nomi";
    case "tafsilot": {
      const q = [];
      if (t.art)    q.push("ART " + t.art);
      if (t.rang)   q.push(t.rang);
      if (t.olcham) q.push(t.olcham);
      return q.join("  ·  ");
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
function stChiz(cvs, fmt) {
  const F = fmt || stFmt(), P = stPal(), S = stShab();
  const c = cvs || document.getElementById("stu-cvs");
  if (!c) return;
  c.width = F.w; c.height = F.h;
  const ctx = c.getContext("2d");
  const W = F.w, H = F.h;
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  S.qatlamlar.forEach(L => {
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
          const k = Math.min(bw / im.width, bh / im.height) * z;
          const dw = im.width * k, dh = im.height * k;
          ctx.drawImage(im,
            bx + (bw - dw) / 2 + (STU.imgAdj.dx || 0) * W,
            by + (bh - dh) / 2 + (STU.imgAdj.dy || 0) * H, dw, dh);
          break;
        }

        case "matn": {
          const matn = stManba(L.manba);
          if (!matn) break;
          const maxW = (L.max || .9) * W;
          let px = stFit(ctx, matn, maxW, L.o * W, L.vazn || 700);
          const qatorlar = stWrap(ctx, matn, maxW, px, L.vazn || 700, L.satr || 1);
          ctx.fillStyle = stRang(P, L.rang);
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
              const yy = L.y * H + i * px * 1.06;
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
            const by = L.y * H - bh * .78;
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
          ctx.font = `${L.vazn || 900} ${px}px ${STU_SHRIFT}`;
          ctx.fillText(matn, x, L.y * H);
          ctx.font = `700 ${px * .30}px ${STU_SHRIFT}`;
          ctx.fillText(" so'm", x + wMatn + px * .06, L.y * H);
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
          const by = L.y * H;
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
          if (!STU.belgi) break;
          const px = L.o * W;
          ctx.fillStyle = stRang(P, L.rang);
          ctx.globalAlpha = .8;
          ctx.font = `700 ${px}px ${STU_SHRIFT}`;
          ctx.textAlign = L.anchor === "right" ? "right" : "left";
          ctx.fillText("merx.uz", L.x * W, L.y * H);
          ctx.textAlign = "left"; ctx.globalAlpha = 1;
          break;
        }
      }
    } catch (e) { console.warn("[studio] qatlam:", L.tur, e.message); }
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
  if (!STU._limitOlindi) { STU._limitOlindi = true; stuLimit(); }
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
    olcham: olch.length > 1 ? (olch[0] + "-" + olch[olch.length - 1]) : (olch[0] || ""),
    narx: Number(p.ulgurjiNarx || p.priceUzs) || 0,
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
    if (!d || !d.ok) {
      stuHolat("");
      toast((d && d.error) || "Xato", "err");
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
async function stuFonTozala() {
  if (!STU.img) { toast("Avval surat yuklang", "err"); return; }
  if (!STU.asl) STU.asl = STU.img;
  // kichraytirib yuboramiz (tezlik + hajm)
  const c = document.createElement("canvas");
  const k = Math.min(1, 1400 / Math.max(STU.img.width, STU.img.height));
  c.width = Math.round(STU.img.width * k); c.height = Math.round(STU.img.height * k);
  c.getContext("2d").drawImage(STU.img, 0, 0, c.width, c.height);
  const d = await stuAI("fon", { image: c.toDataURL("image/jpeg", 0.9) });
  if (!d) return;
  try {
    STU.img = await _stuImg(d.image);
    stuHolat(""); toast("Fon tozalandi", "ok"); stChiz();
  } catch (e) { stuHolat(""); toast("Natija ochilmadi", "err"); }
}
// Sahna — fon generatsiyasi (tovarsiz), tovar ustiga qo'yiladi
async function stuSahna(tur) {
  const d = await stuAI("sahna", { sahna: tur });
  if (!d) return;
  try {
    STU.fon = await _stuImg(d.image);
    stuHolat(""); toast("Sahna tayyor", "ok"); stChiz();
  } catch (e) { stuHolat(""); toast("Sahna ochilmadi", "err"); }
}
function stuAsliga() {
  if (STU.asl) STU.img = STU.asl;
  STU.fon = null;
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
