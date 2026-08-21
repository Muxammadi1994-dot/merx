// ════════════════════════════════════════════════════════════════
// MERX — VALYUTA KURSI  |  api/rate.js  |  2026-08-20
// ════════════════════════════════════════════════════════════════
// Ikki rejim:
//   1) (standart)        — Markaziy Bank rasmiy kursi (2026-07-09 dan beri)
//   2) ?mode=banks       — TIJORAT BANKLARI: har birining SOTUV kursi
//                          ro'yxati qaytariladi, klient eng yuqorisini
//                          (yoki admin belgilagan banklardan eng yuqorisini)
//                          tanlaydi.
//   3) ?debug=1          — har manba nima qaytargani (tekshiruv uchun)
//
// ⚠️ NEGA KO'P MANBA: bank.uz da ochiq JSON API yo'q (/api/v1/currency
// → 404, 2026-08-20 da tekshirildi). Sahifadan o'qish esa sayt
// tuzilishi o'zgarsa buziladi. Shuning uchun bir nechta manba
// ketma-ket sinaladi va BIRORTASI ishlasa yetarli. Hech biri
// ishlamasa — Markaziy Bank kursi qaytariladi (`fallback: true`),
// ya'ni kurs HECH QACHON yo'qolmaydi.
//
// QOIDA: bu yerda faqat MA'LUMOT yig'iladi. Qaysi bankni olish va
// qanday qo'llash — klient qarori (sozlamalarda).
// ════════════════════════════════════════════════════════════════

const UA = { "User-Agent": "Mozilla/5.0 (MERX savdo tizimi)" };

// ── 1. Markaziy Bank (asos — har doim ishlaydi) ──────────────────
async function cbuOl() {
  const r = await fetch("https://cbu.uz/en/arkhiv-kursov-valyut/json/USD/", { headers: UA });
  if (!r.ok) throw new Error("CBU: " + r.status);
  const data = await r.json();
  const row = Array.isArray(data)
    ? (data.find(x => x && (x.Ccy === "USD" || x.CcyNm_EN === "US Dollar")) || data[0])
    : data;
  const rate = parseFloat(row?.Rate);
  if (!rate || rate <= 0) throw new Error("CBU: kurs noto'g'ri");
  return { rate, date: row?.Date || null };
}

// ── 2. NBU (Milliy bank) — ochiq JSON ────────────────────────────
async function nbuOl() {
  const r = await fetch("https://nbu.uz/exchange-rates/json/", { headers: UA });
  if (!r.ok) throw new Error("NBU: " + r.status);
  const j = await r.json();
  const arr = Array.isArray(j) ? j : (j.data || j.result || []);
  const usd = arr.find(x => (x.code === "USD" || x.title === "USD" ||
                             x.ccy === "USD" || x.currency === "USD"));
  if (!usd) throw new Error("NBU: USD topilmadi");
  // Sotuv maydoni turli nomlarda uchraydi — hammasini sinaymiz
  const sell = parseFloat(usd.nbu_cell_price ?? usd.cell_price ?? usd.sell ??
                          usd.sale ?? usd.sell_price ?? usd.nbu_sell);
  const buy  = parseFloat(usd.nbu_buy_price ?? usd.buy_price ?? usd.buy ??
                          usd.purchase ?? usd.nbu_buy);
  if (!sell || sell <= 0) throw new Error("NBU: sotuv kursi yo'q");
  return [{ bank: "NBU (Milliy bank)", sell, buy: buy || null }];
}

// ── 3. bank.uz sahifasidan o'qish (JSON API yo'q) ────────────────
// Sahifadagi jadvaldan bank nomi + sotuv kursini ajratamiz.
// Sayt tuzilishi o'zgarsa bu manba jim yiqiladi — qolganlari ishlaydi.
async function bankUzOl(cbRate) {
  const r = await fetch("https://bank.uz/uz/currency", { headers: UA });
  if (!r.ok) throw new Error("bank.uz: " + r.status);
  let html = await r.text();

  // ⚠️ 2026-08-20 (jonli xato): tahlilchi SVG ichidagi raqamlarni
  // olib, kurs 19 193 deb yozgan va bank nomi o'rniga `clip-path`
  // bo'lagi chiqqan. Shuning uchun AVVAL sahifa tozalanadi.
  html = html
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const juft = /(1[0-9][\s\u00a0]?[0-9]{3}(?:[.,][0-9]{1,2})?)[^0-9]{1,80}?(1[0-9][\s\u00a0]?[0-9]{3}(?:[.,][0-9]{1,2})?)/g;
  const N = x => parseFloat(String(x).replace(/[\s\u00a0]/g, "").replace(",", "."));

  // Bank nomi HAQIQIY nomga o'xshashi shart — HTML qoldiqlari rad etiladi
  const nomToza = (t) => {
    const toza = t.replace(/<[^>]*>/g, "|").replace(/&[a-z#0-9]+;/gi, " ");
    const bolaklar = toza.split("|").map(x => x.trim())
      .filter(x => /[A-Za-z\u0410-\u044f]{3,}/.test(x));
    for (let i = bolaklar.length - 1; i >= 0; i--) {
      const n = bolaklar[i].replace(/\s+/g, " ").slice(0, 40);
      if (/[<>=\/{}\[\]]/.test(n)) continue;                 // HTML qoldig'i
      if (/path|clip|svg|xmlns|href|width|height|fill|http|www/i.test(n)) continue;
      if (!/^[A-Za-z\u0410-\u044f\u040e\u045e\u049a\u049b\u0492\u0493\u04b2\u04b3]/.test(n)) continue;
      if (n.length < 3) continue;
      return n;
    }
    return "";
  };

  const out = [];
  let m, sanoq = 0;
  while ((m = juft.exec(html)) !== null && sanoq < 80) {
    const a = N(m[1]), b = N(m[2]);
    if (!a || !b) continue;
    const sell = Math.max(a, b), buy = Math.min(a, b);
    // ✅ ASOSIY HIMOYA: Markaziy Bank kursidan 10% dan ko'p farq
    // qilgan raqam — kurs EMAS (sahifadagi boshqa son yoki EUR).
    if (cbRate > 0) {
      if (Math.abs(sell - cbRate) > cbRate * 0.10) continue;
      if (Math.abs(buy  - cbRate) > cbRate * 0.10) continue;
    } else if (sell < 9000 || sell > 20000) continue;
    if (sell - buy < 0 || sell - buy > sell * 0.08) continue;   // oluv/sotuv juftimi
    const nom = nomToza(html.slice(Math.max(0, m.index - 200), m.index));
    if (!nom) continue;                                          // nomi yo'q — ishonmaymiz
    if (/markaziy|central|cbu/i.test(nom)) continue;
    out.push({ bank: nom, sell, buy });
    sanoq++;
  }
  if (!out.length) throw new Error("bank.uz: ishonchli qator topilmadi");
  return out;
}

// ══════════════════════════════════════════════════════════════════
// 534 (2026-08-22) — MANBA QIDIRUVI (`?probe=1`) · FAQAT TEKSHIRUV
// ══════════════════════════════════════════════════════════════════
// NIMA UCHUN: 2026-08-22 da `?mode=banks&debug=1` shuni ko'rsatdi —
//   nbu     → "NBU: 404"                (manzil endi mavjud emas)
//   bank.uz → "ishonchli qator topilmadi" (sahifa tuzilishi o'zgargan)
//   banklar → []
// Ya'ni tijorat bank kursi UMUMAN ishlamayapti va jimgina Markaziy
// Bank kursiga tushib qolgan.
//
// Yangi manbani YODDAN yozish xato bo'lardi — `nbu.uz` ning 404 bo'lishi
// aynan shuni ko'rsatdi. Shuning uchun nomzodlarni SERVERNING O'ZI
// tekshiradi: qaysi manzil javob beradi, JSON mi yoki HTML mi, ichida
// kursga o'xshash raqamlar bormi va nechta.
//
// Bu yerda HECH QANDAY mantiq o'zgarmaydi — mavjud rejimlar tegilmagan.
// Natijaga qarab keyingi paketda to'g'ri manba ulanadi.
const NOMZODLAR = [
  // Ishlayotgani — nazorat namunasi
  ["cbu-json",      "https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/"],
  // NBU — manzil o'zgargan bo'lishi mumkin, bir necha variant
  ["nbu-eski",      "https://nbu.uz/exchange-rates/json/"],
  ["nbu-uz",        "https://nbu.uz/uz/exchange-rates/json/"],
  ["nbu-api",       "https://nbu.uz/api/exchange-rates/json/"],
  // Agregatorlar
  ["bankuz-html",   "https://bank.uz/uz/currency"],
  ["kursuz-html",   "https://kurs.uz/uz"],
  ["kursuz-api",    "https://kurs.uz/api/v1/kurs"],
  // Yirik banklar (ochiq API bo'lishi mumkin)
  ["kapital",       "https://kapitalbank.uz/uz/services/exchange-rates/"],
  ["hamkor",        "https://hamkorbank.uz/uz/exchange-rates/"],
  ["infin",         "https://infinbank.com/uz/private/exchange-rates/"],
];

async function _probeOne(nom, url) {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 7000);
  try {
    const r = await fetch(url, { headers: UA, signal: ac.signal });
    const ct = r.headers.get("content-type") || "";
    const txt = await r.text();
    const ms = Date.now() - t0;
    if (!r.ok) return { nom, url, status: r.status, ms, xato: "HTTP " + r.status };

    // JSON mi?
    let json = null;
    try { json = JSON.parse(txt); } catch (e) {}

    // Kursga o'xshash raqamlar (11 000–13 000 oralig'i, MB kursi atrofi)
    const toza = txt.replace(/<svg[\s\S]*?<\/svg>/gi, " ")
                    .replace(/<script[\s\S]*?<\/script>/gi, " ")
                    .replace(/<style[\s\S]*?<\/style>/gi, " ");
    const raqamlar = (toza.match(/1[12][\s\u00a0]?[0-9]{3}(?:[.,][0-9]{1,2})?/g) || [])
      .map(x => parseFloat(String(x).replace(/[\s\u00a0]/g, "").replace(",", ".")))
      .filter(n => n >= 10000 && n <= 14000);
    const noyob = [...new Set(raqamlar)];

    // Birinchi raqam atrofidan namuna — parserni to'g'ri yozish uchun
    let namuna = "";
    if (noyob.length) {
      const i = toza.search(/1[12][\s\u00a0]?[0-9]{3}/);
      if (i > 0) namuna = toza.slice(Math.max(0, i - 220), i + 120)
                             .replace(/\s+/g, " ").slice(0, 320);
    }
    return { nom, url, status: r.status, ms,
             tur: json ? "JSON" : (ct.includes("html") ? "HTML" : ct.slice(0, 40)),
             hajm: txt.length,
             json_kalitlar: json ? (Array.isArray(json)
               ? ("massiv[" + json.length + "] · " + Object.keys(json[0] || {}).slice(0, 12).join(","))
               : Object.keys(json).slice(0, 12).join(",")) : null,
             kurs_raqamlari: noyob.length,
             namuna_raqamlar: noyob.slice(0, 8),
             namuna_matn: namuna };
  } catch (e) {
    return { nom, url, ms: Date.now() - t0,
             xato: (e && e.name === "AbortError") ? "vaqt tugadi (7 s)" : String(e.message || e) };
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  const mode  = String(req.query?.mode || "");
  const debug = String(req.query?.debug || "") === "1";

  // ══════════════════════════════════════════════════════════════
  // 538 — OXIRGI QIDIRUV (`?probe=5`) · RASMIY MANBA IZLARI
  // ══════════════════════════════════════════════════════════════
  // `?probe=4` natijasi: CBU ning rasmiy JSON i FAQAT Markaziy Bank
  // kurslarini beradi (74 valyuta), tijorat banklari YO'Q — uchala
  // nomzod 404. Lekin havolalar orasida ikki kuchli iz chiqdi:
  //   · `https://bankxizmatlari.uz/uz/` — CBU sahifasidan havola,
  //     ya'ni Markaziy Bankning BANK XIZMATLARI portali. Banklarni
  //     solishtiradigan rasmiy sayt bo'lishi mumkin.
  //   · `https://cbu.uz/uz/services/open_data/rates/csv/` — ochiq
  //     ma'lumot, CSV.
  // Bu OXIRGI qidiruv qadami. Rasmiy manba topilmasa, bank.uz ning
  // BANK SAHIFALARI yo'lidan boramiz — u yerda "Sotib olish"/"Sotish"
  // yorliqlari bor (536 tasdiqladi), ya'ni taxmin qilinmaydi.
  if (String(req.query?.probe || "") === "5") {
    let cb = 0;
    try { cb = (await cbuOl()).rate; } catch (e) {}
    const KALIT = /(kurs|valyut|valut|exchange|rate|dollar|usd)/i;
    const out = { ok: true, cb, izoh:
      "538 · rasmiy manba izlari. `havolalar` — kurs/valyuta so'zli " +
      "manzillar. `kurs_raqamlari` — MB kursi atrofidagi noyob raqamlar.",
      sahifalar: [] };

    const SAHIFA = [
      ["bankxizmatlari",  "https://bankxizmatlari.uz/uz/"],
      ["cbu-csv",         "https://cbu.uz/uz/services/open_data/rates/csv/"],
      ["cbu-opendata",    "https://cbu.uz/uz/services/open_data/"],
      ["cbu-statistика",  "https://cbu.uz/uz/statistics/rates/"],
      ["cbu-almashinuv",  "https://cbu.uz/uz/credit-organizations/banks/exchange-offices/"],
    ];
    for (const [nom, url] of SAHIFA) {
      try {
        const r = await fetch(url, { headers: UA });
        const xom = await r.text();
        let t = xom.replace(/<svg[\s\S]*?<\/svg>/gi, " ")
                   .replace(/<script[\s\S]*?<\/script>/gi, " ")
                   .replace(/<style[\s\S]*?<\/style>/gi, " ")
                   .replace(/\s(?:href|src|srcset|data-[a-z-]+)="[^"]*"/gi, " ");
        const re = /1[12][\s\u00a0]?[0-9]{3}(?:[.,][0-9]{1,2})?/g;
        const joy = []; let m;
        while ((m = re.exec(t)) !== null && joy.length < 60) {
          const n = parseFloat(String(m[0]).replace(/[\s\u00a0]/g, "").replace(",", "."));
          if (cb && Math.abs(n - cb) > cb * 0.06) continue;
          joy.push({ n, i: m.index });
        }
        const hav = (xom.match(/(?:href)="([^"]{3,140})"/gi) || [])
          .map(x => x.replace(/^href="/i, "").replace(/"$/, ""))
          .filter(x => KALIT.test(x))
          .filter(x => !/\.(css|png|jpe?g|svg|woff2?|ico|gif)/i.test(x));
        out.sahifalar.push({ nom, url, status: r.status, hajm: xom.length,
          tur: (xom.trim()[0] === "{" || xom.trim()[0] === "[") ? "JSON"
             : (/^[^<]{0,80}[;,]/.test(xom.trim()) ? "CSV(?)" : "HTML"),
          kurs_raqamlari: [...new Set(joy.map(x => x.n))].slice(0, 14),
          havolalar: [...new Set(hav)].slice(0, 18),
          bosh: xom.trim().slice(0, 240).replace(/\s+/g, " "),
          namuna: joy.length
            ? t.slice(Math.max(0, joy[0].i - 380), joy[0].i + 140).replace(/\s+/g, " ")
            : "" });
      } catch (e) {
        out.sahifalar.push({ nom, url, xato: String(e.message || e) });
      }
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(out);
  }

  // ══════════════════════════════════════════════════════════════
  // 537 — MARKAZIY BANKDA TIJORAT BANK KURSLARI BORMI (`?probe=4`)
  // ══════════════════════════════════════════════════════════════
  // Egasining savoli (2026-08-22): "markaziy bankda boshqa banklar
  // kurslari yo'qmi, shuning API si orqali bila olmaymizmi?"
  // Bilganimiz: ishlatayotgan CBU manzili FAQAT rasmiy kursni beradi
  // (bitta qator: Code, Ccy, Rate, Date). Taxmin qilgan
  // `.../informatsiya-o-kursakh-valyut-kommercheskikh-bankov/` — 404.
  // Ya'ni "yo'q" emas, MANZILNI TOPA OLMADIM.
  // Shuning uchun manzilni TAXMIN QILMASDAN topamiz: CBU sahifalaridagi
  // havolalarni o'qib, "kurs/valyut/bank/api/open-data" so'zlilarini
  // ajratamiz. bank.uz da aynan shu usul ish berdi.
  if (String(req.query?.probe || "") === "4") {
    const SAHIFA = [
      ["cbu-bosh",     "https://cbu.uz/uz/"],
      ["cbu-xizmat",   "https://cbu.uz/uz/services/"],
      ["cbu-arxiv",    "https://cbu.uz/uz/arkhiv-kursov-valyut/"],
      ["cbu-opendata", "https://cbu.uz/uz/open-data/"],
    ];
    const KALIT = /(kurs|valyut|valut|exchange|rate|bank|api|open.?data|json)/i;
    const havolalar = [];
    const sahifaHolat = [];
    for (const [nom, url] of SAHIFA) {
      try {
        const r = await fetch(url, { headers: UA });
        const t = await r.text();
        sahifaHolat.push({ nom, url, status: r.status, hajm: t.length });
        if (!r.ok) continue;
        const hav = (t.match(/(?:href|src)="([^"]{3,160})"/gi) || [])
          .map(x => x.replace(/^(?:href|src)="/i, "").replace(/"$/, ""))
          .filter(x => KALIT.test(x))
          .filter(x => !/\.(css|png|jpe?g|svg|woff2?|ico|gif)/i.test(x));
        hav.forEach(h => havolalar.push(h));
      } catch (e) {
        sahifaHolat.push({ nom, url, xato: String(e.message || e) });
      }
    }
    // Nomzod JSON manzillari — status bilan
    const NOMZOD = [
      ["json-usd",     "https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/"],
      ["json-hammasi", "https://cbu.uz/uz/arkhiv-kursov-valyut/json/"],
      ["banklar-1",    "https://cbu.uz/uz/services/bank-rates/json/"],
      ["banklar-2",    "https://cbu.uz/uz/kurs-valyut-kommercheskikh-bankov/"],
      ["banklar-3",    "https://cbu.uz/uz/services/kurs-valyut-kommercheskikh-bankov/"],
      ["opendata",     "https://data.gov.uz/uz/datasets"],
    ];
    const nomzodlar = await Promise.all(NOMZOD.map(([n, u]) => _probeOne(n, u)));

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, izoh:
      "537 · CBU sahifalaridagi kurs/bank/api so'zli havolalar. " +
      "Tijorat bank kurslari sahifasi shu ro'yxatda ko'rinishi mumkin.",
      sahifaHolat,
      havolalar: [...new Set(havolalar)].slice(0, 60),
      nomzodlar });
  }

  // ══════════════════════════════════════════════════════════════
  // 536 — BANK SAHIFASI (`?probe=3`) · FAQAT TEKSHIRUV
  // ══════════════════════════════════════════════════════════════
  // `?probe=2` bank.uz tuzilmasini ko'rsatdi:
  //   <span class="medium-text"> BANK NOMI </span> ... </div>
  //   <span class="medium-text green-date"> 11 850 so'm </span>
  // Ya'ni parser yozsa bo'ladi. LEKIN bitta ANIQLANMAGAN narsa qoldi:
  // topilgan raqamlarning HAMMASI 11 850 dan past, MB kursi esa 11 847.
  // Demak bular banklarning SOTIB OLISH kursi bo'lishi mumkin —
  // egaga esa SOTISH kursi kerak ("eng qimmat sotilayotgan").
  // Buni tekshirmasdan parser yozilsa, kurs muntazam PAST chiqadi va
  // bu to'g'ridan-to'g'ri narxlarga ta'sir qiladi.
  // `?probe=2` dagi `havolalar` har bankning o'z sahifasini ko'rsatdi
  // (`/uz/currency/bank/nbu`). Shu sahifada ikkala kurs bo'lishi kerak.
  if (String(req.query?.probe || "") === "3") {
    let cb = 0;
    try { cb = (await cbuOl()).rate; } catch (e) {}
    const MANZIL = [
      ["nbu-bank",     "https://bank.uz/uz/currency/bank/nbu"],
      ["asia-alliance","https://bank.uz/uz/currency/bank/asia-alliance-bank"],
      ["kapitalbank",  "https://bank.uz/uz/currency/bank/kapitalbank"],
    ];
    const natija = [];
    for (const [nom, url] of MANZIL) {
      try {
        const r = await fetch(url, { headers: UA });
        let html = await r.text();
        html = html.replace(/<svg[\s\S]*?<\/svg>/gi, " ")
                   .replace(/<script[\s\S]*?<\/script>/gi, " ")
                   .replace(/<style[\s\S]*?<\/style>/gi, " ")
                   .replace(/<!--[\s\S]*?-->/g, " ")
                   .replace(/\s(?:href|src|srcset|data-[a-z-]+)="[^"]*"/gi, " ");
        const re = /1[12][\s\u00a0]?[0-9]{3}(?:[.,][0-9]{1,2})?/g;
        const joy = []; let m;
        while ((m = re.exec(html)) !== null && joy.length < 60) {
          const n = parseFloat(String(m[0]).replace(/[\s\u00a0]/g, "").replace(",", "."));
          if (cb && Math.abs(n - cb) > cb * 0.06) continue;
          joy.push({ n, i: m.index });
        }
        natija.push({ nom, url, status: r.status, topildi: joy.length,
          raqamlar: joy.slice(0, 12).map(x => x.n),
          // Sotib olish / sotish so'zlari sahifada bormi
          soz_sotib: /sotib\s*ol|\u043f\u043e\u043a\u0443\u043f|buy/i.test(html),
          soz_sotish: /sotish|\u043f\u0440\u043e\u0434\u0430\u0436|sell/i.test(html),
          namunalar: joy.slice(0, 3).map(x =>
            html.slice(Math.max(0, x.i - 450), x.i + 150).replace(/\s+/g, " ")) });
      } catch (e) {
        natija.push({ nom, url, xato: String(e.message || e) });
      }
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, cb, izoh:
      "536 · bank sahifasida SOTIB OLISH va SOTISH kursi ajratilganmi. " +
      "`soz_sotib`/`soz_sotish` — sahifada shu so'zlar bormi. " +
      "`namunalar` — raqam atrofidagi HTML.", natija });
  }

  // ══════════════════════════════════════════════════════════════
  // 535 — CHUQUR NAMUNA (`?probe=2`) · FAQAT TEKSHIRUV
  // ══════════════════════════════════════════════════════════════
  // `?probe=1` shuni ko'rsatdi: bank.uz TIRIK (200, 386 KB) va ichida
  // 18 ta kursga o'xshash raqam bor (11 815…11 850 — MB 11 847 atrofida).
  // Ya'ni MANBA emas, O'QISH MANTIQI buzilgan.
  // Lekin probe=1 dagi namuna foydasiz chiqdi: u CSS manzilidagi
  // `?1712567840422` raqamini "kurs" deb olib, atrofidan `<link>` teglarini
  // ko'rsatdi. Sabab — raqam oynasi juda keng (10 000–14 000) va atribut
  // ichidagi raqamlar tozalanmagan.
  // Bu yerda ikkalasi tuzatildi:
  //   · `href`/`src`/`data-*` atributlari OLIB TASHLANADI;
  //   · faqat MB kursidan ±5% ichidagi raqamlar olinadi (langar).
  // Qo'shimcha: sahifadagi "currency/kurs/valyut" so'zli havolalar ham
  // qaytariladi — agar sayt o'zining AJAX/JSON manzilidan foydalansa,
  // regex o'rniga o'shani ishlatgan MA'QUL (mo'rt bo'lmaydi).
  if (String(req.query?.probe || "") === "2") {
    let cb = 0;
    try { cb = (await cbuOl()).rate; } catch (e) {}
    const out = { ok: true, cb, izoh:
      "535 · `namunalar` — haqiqiy kurs raqami atrofidagi HTML. " +
      "Parser aynan shu tuzilma bo'yicha yoziladi. `havolalar` — saytning " +
      "o'z API manzili bo'lishi mumkin.", bankuz: null, yangi: [] };

    let _xom = "", _st = 0;
    try {
      const r = await fetch("https://bank.uz/uz/currency", { headers: UA });
      _st = r.status; _xom = await r.text();
    } catch (e) { out.bankuz = { xato: String(e.message || e) }; }

    try {
      let html = _xom;
      html = html.replace(/<svg[\s\S]*?<\/svg>/gi, " ")
                 .replace(/<script[\s\S]*?<\/script>/gi, " ")
                 .replace(/<style[\s\S]*?<\/style>/gi, " ")
                 .replace(/<!--[\s\S]*?-->/g, " ")
                 .replace(/\s(?:href|src|srcset|data-[a-z-]+)="[^"]*"/gi, " ");
      const re = /1[12][\s\u00a0]?[0-9]{3}(?:[.,][0-9]{1,2})?/g;
      const joy = []; let m;
      while ((m = re.exec(html)) !== null && joy.length < 300) {
        const n = parseFloat(String(m[0]).replace(/[\s\u00a0]/g, "").replace(",", "."));
        if (cb && Math.abs(n - cb) > cb * 0.05) continue;   // langar
        joy.push({ n, i: m.index });
      }
      out.bankuz = {
        status: _st, hajm: html.length, topildi: joy.length,
        raqamlar: joy.slice(0, 20).map(x => x.n),
        namunalar: joy.slice(0, 3).map(x =>
          html.slice(Math.max(0, x.i - 500), x.i + 150).replace(/\s+/g, " "))
      };
    } catch (e) { out.bankuz = { xato: String(e.message || e) }; }

    // Saytning o'z API manzili bormi — XOM HTML dan havolalarni olamiz
    // (yuqorida bir marta yuklangan — qayta so'ramaymiz)
    try {
      const hav = (_xom.match(/["'\(]([^"'\)\s]{4,120}(?:currency|kurs|valyut|valut|exchange|rate)[^"'\)\s]{0,60})["'\)]/gi) || [])
        .map(x => x.replace(/^["'\(]|["'\)]$/g, ""))
        .filter(x => !/\.(css|png|jpg|svg|woff|ico)/i.test(x));
      out.havolalar = [...new Set(hav)].slice(0, 25);
    } catch (e) { out.havolalar = ["xato: " + String(e.message || e)]; }

    // Qo'shimcha nomzodlar — MB tijorat banklar sahifasi va boshqalar
    const QOSHIMCHA = [
      ["cbu-tijorat", "https://cbu.uz/uz/services/informatsiya-o-kursakh-valyut-kommercheskikh-bankov/"],
      ["nbu-bosh",    "https://nbu.uz/uz/"],
      ["bankuz-dollar","https://bank.uz/uz/currency/dollar"],
      ["kapital-api", "https://kapitalbank.uz/api/exchange-rates"],
      ["tbc",         "https://tbcbank.uz/uz/exchange-rates"],
    ];
    out.yangi = await Promise.all(QOSHIMCHA.map(([n, u]) => _probeOne(n, u)));

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(out);
  }

  // ── 534: MANBA QIDIRUVI — faqat tekshiruv, mantiqqa tegmaydi ──
  if (String(req.query?.probe || "") === "1") {
    const natija = await Promise.all(NOMZODLAR.map(([n, u]) => _probeOne(n, u)));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      izoh: "534 · manba qidiruvi. `kurs_raqamlari` — sahifada topilgan " +
            "kursga o'xshash noyob raqamlar soni. JSON manbada `json_kalitlar` " +
            "muhim; HTML manbada `namuna_matn` parser yozish uchun kerak.",
      natija
    });
  }

  // ── Standart: Markaziy Bank (eski xatti-harakat — o'zgarmagan) ──
  if (mode !== "banks" && !debug) {
    try {
      const { rate, date } = await cbuOl();
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
      return res.status(200).json({ ok: true, rate, date,
                                    source: "CBU (Markaziy Bank)" });
    } catch (e) {
      console.error("rate.js CBU xato:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── Tijorat banklari ────────────────────────────────────────────
  const tashxis = [];
  let banklar = [];
  // ✅ 2026-08-20: MB kursi AVVAL olinadi — u "langar" bo'ladi.
  // Har bir manbadan kelgan raqam shunga solishtiriladi; 10% dan
  // ko'p farq qilsa rad etiladi (jonli xato: 19 193 yozilib qolgan).
  let cbAnchor = 0;
  try { cbAnchor = (await cbuOl()).rate; } catch (e) {}
  for (const [nom, fn] of [["nbu", nbuOl], ["bank.uz", bankUzOl]]) {
    try {
      const r0 = await fn(cbAnchor);
      const r = (r0 || []).filter(x => !cbAnchor ||
        (x.sell > 0 && Math.abs(x.sell - cbAnchor) <= cbAnchor * 0.10));
      if (!r.length) throw new Error("kurslar MB dan juda uzoq");
      banklar = banklar.concat(r);
      tashxis.push({ manba: nom, ok: true, soni: r.length,
                     namuna: r.slice(0, 3) });
    } catch (e) {
      tashxis.push({ manba: nom, ok: false, xato: e.message });
    }
  }

  // Bir bank ikki manbadan kelsa — bittasini qoldiramiz (eng yuqorisi)
  const xarita = new Map();
  banklar.forEach(b => {
    const k = b.bank.toLowerCase().replace(/[^a-zа-я0-9]/gi, "").slice(0, 20);
    if (!xarita.has(k) || xarita.get(k).sell < b.sell) xarita.set(k, b);
  });
  banklar = [...xarita.values()].sort((a, b) => b.sell - a.sell);

  const cb = cbAnchor || null;

  if (debug)
    return res.status(200).json({ ok: true, cb, banklar, tashxis });

  if (!banklar.length) {
    // Hech bir manba ishlamadi — MB kursi bilan qaytamiz (kurs yo'qolmaydi)
    if (!cb) return res.status(500).json({ ok: false, error: "Manbalar ishlamadi" });
    return res.status(200).json({ ok: true, rate: cb, cb, banklar: [],
      fallback: true, source: "CBU (Markaziy Bank) — tijorat manbalari ishlamadi" });
  }

  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate");
  return res.status(200).json({ ok: true,
    rate: banklar[0].sell, bank: banklar[0].bank,
    cb, banklar, source: "Tijorat banklari (eng yuqori sotuv)" });
}
