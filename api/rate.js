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
// ══════════════════════════════════════════════════════════════════
// 543 (2026-08-22) — `nbuOl` va `bankUzOl` OLIB TASHLANDI
// ══════════════════════════════════════════════════════════════════
// Ikkalasi ham 2026-08-22 o'lchovida O'LIK chiqdi:
//   · NBU (`nbu.uz/exchange-rates/json/`) → HTTP 404, uch xil manzil
//     sinaldi, hammasi 404. Manzil butunlay yo'qolgan.
//   · bank.uz umumiy ro'yxati → "ishonchli qator topilmadi": sahifa
//     tuzilmasi o'zgargan. Ustiga u faqat SOTIB OLISH kursini beradi,
//     bizga esa SOTISH kerak (536 tasdiqladi).
// Ular o'rniga `bxOl` (bankxizmatlari.uz) ishlatiladi — bitta so'rovda
// 30 ta bank, yorliqlar matn bilan.
// Kod SAQLANMADI: ishlamaydigan manba zaxira bo'la olmaydi, noto'g'ri
// ma'lumot esa ma'lumot yo'qligidan yomonroq. Zaxira — Markaziy Bank.

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

// ══════════════════════════════════════════════════════════════════
// 540 (2026-08-22) — bankxizmatlari.uz PARSERI
// ══════════════════════════════════════════════════════════════════
// Manba tanlandi (534-539 qidiruvi asosida):
//   · NBU JSON — 404, manzil yo'qolgan
//   · CBU JSON/CSV/XML — faqat RASMIY kurs, tijorat banklari yo'q
//   · kurs.uz, Kapitalbank, Hamkor, TBC, Infin — 403/404/ulanmadi
//   · bank.uz — ishlaydi, lekin har bank uchun ALOHIDA so'rov kerak
//   · bankxizmatlari.uz — CBU sahifasidan havola qilingan portal,
//     BITTA so'rovda hamma bank, yorliqlar MATN bilan yozilgan
//     ("Sotish" / "Sotib olish"), ustiga sotish bo'yicha SARALASH
//     manzil orqali beriladi.
// Shuning uchun asosiy manba — bankxizmatlari.uz.
//
// TUZILMA (539 o'lchovidan, taxmin emas):
//   <div class="js-currency">
//     <div class="js-currency-type">            ← yashirin bo'lsa display:none
//       <li><div class="item__params--value">11890 <small>UZS</small></div>
//           <div class="item__params--label">Sotish</div></li>
//       <li><div class="item__params--value">11810 ...</div>
//           <div class="item__params--label">Sotib olish</div></li>
//
// ⚠️ YASHIRIN BLOKLAR TASHLANADI: sahifada `display: none` bilan
// yashirilgan nusxalar bor (naqd/naqdsiz variantlari). Ularni olsak
// noto'g'ri kurs chiqishi mumkin.
async function bxOl(cbRate) {
  const url = "https://bankxizmatlari.uz/uz/rates/?currency=USD" +
              "&sort_field=sale&sort_method=desc";
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error("bankxizmatlari: " + r.status);
  let html = await r.text();
  html = html.replace(/<svg[\s\S]*?<\/svg>/gi, " ")
             .replace(/<script[\s\S]*?<\/script>/gi, " ")
             .replace(/<style[\s\S]*?<\/style>/gi, " ")
             .replace(/<!--[\s\S]*?-->/g, " ");

  const N = x => parseFloat(String(x).replace(/[\s\u00a0]/g, "").replace(",", "."));
  const out = [];
  // Har bank bloki `js-currency` bilan boshlanadi
  const bloklar = html.split(/<div class="js-currency"/i);
  for (let bi = 1; bi < bloklar.length && out.length < 60; bi++) {
    const b = bloklar[bi];
    // KO'RINADIGAN currency-type (yashirin nusxa tashlanadi)
    const ct = b.match(/<div class="js-currency-type"([^>]*)>([\s\S]{0,1600}?)<\/ul>/i);
    if (!ct) continue;
    if (/display\s*:\s*none/i.test(ct[1])) continue;
    const ich = ct[2];

    // qiymat + yorliq juftlari
    let sell = 0, buy = 0;
    const juft = ich.match(/item__params--value"[^>]*>\s*([0-9\s\u00a0.,]{4,12})[\s\S]{0,160}?item__params--label"[^>]*>\s*([^<]{2,24})/gi) || [];
    for (const j of juft) {
      const mv = j.match(/item__params--value"[^>]*>\s*([0-9\s\u00a0.,]{4,12})/i);
      const ml = j.match(/item__params--label"[^>]*>\s*([^<]{2,24})/i);
      if (!mv || !ml) continue;
      const n = N(mv[1]); const yorliq = ml[1].trim().toLowerCase();
      if (!n) continue;
      if (/^sotish/.test(yorliq)) sell = sell || n;
      else if (/^sotib/.test(yorliq)) buy = buy || n;
    }
    if (!sell) continue;

    // Bank nomi — shu blokdan OLDINGI matndan (eng yaqin haqiqiy nom)
    const oldin = bloklar.slice(0, bi).join(" ").slice(-2500);
    let nom = "";
    const nomzod = (oldin.match(/>([^<>{}\[\]]{3,44})</g) || [])
      .map(x => x.replace(/^>|<$/g, "").replace(/\s+/g, " ").trim())
      .filter(x => /[A-Za-z\u0410-\u044f]{3,}/.test(x))
      .filter(x => !/^\d|UZS|USD|sotish|sotib|yangilanish|vaqti|so'm|filial|batafsil|barcha/i.test(x))
      .filter(x => !/[<>=\/{}\[\]]/.test(x));
    if (nomzod.length) nom = nomzod[nomzod.length - 1].slice(0, 40);
    if (!nom) continue;

    // Langar: MB kursidan uzoq raqam — kurs emas
    if (cbRate > 0 && Math.abs(sell - cbRate) > cbRate * 0.03) continue;
    if (buy && (buy > sell || sell - buy > sell * 0.08)) buy = 0;
    out.push({ bank: nom, sell, buy: buy || null });
  }
  if (!out.length) throw new Error("bankxizmatlari: ishonchli qator topilmadi");
  return out;
}

// ══════════════════════════════════════════════════════════════════
// 541 (2026-08-22) — KELISHUV QOIDASI: yolg'iz kurs olinmaydi
// ══════════════════════════════════════════════════════════════════
// JONLI DALIL (540 quruq sinovi, 2026-08-22):
//   AVO bank        sotish 12 202.57   ← YOLG'IZ
//   Garant bank     sotish 11 905
//   Universal bank  sotish 11 905
//   ... jami O'N BIR bank 11 905 deydi
// `11847.16 × 1.03 = 12202.57` — AVO bank kursni MB ± 3% qilib
// qo'ygan (valyuta almashtirishni xohlamaydigan bank). Bu XATO EMAS,
// haqiqiy kurs. Lekin "eng yuqorisini ol" qoidasi uni tanlardi va
// do'kondagi hamma dollarli narx 2,5% ga SHISHARDI.
// Langar (±3%) uni to'sib qola olmadi — chegaraga aynan tegib o'tdi.
//
// QOIDA: eng yuqori kurs olinadi, LEKIN unga YAQIN (0,5%) yana kamida
// bitta bank bo'lishi shart. Yolg'iz raqam — xato o'qilganmi yoki
// g'alati kurs qo'ygan bankmi — farqi yo'q, TASHLANADI.
// Bugungi ma'lumotda natija: 11 905 (11 ta bank tasdiqlaydi).
// ══════════════════════════════════════════════════════════════════
// 542 (2026-08-22) — ISHONCHLI BANKLAR RO'YXATI (egasining qarori)
// ══════════════════════════════════════════════════════════════════
// Egasi: "yaxshisi eng mashhur 5-6 bankdan qidirsin, shunda AVO kabi
// banklar ro'yxatga kirmaydi".
// Bu — qoidaga emas, TUZILISHGA tayangan himoya: g'alati kurs qo'ygan
// bank umuman hisobga olinmaydi. Kelishuv qoidasi (541) esa ikkinchi
// qatlam bo'lib qoladi — xato O'QILGAN raqamdan himoya qiladi.
//
// Nomlar 540 quruq sinovidagi HAQIQIY nomlardan olindi (taxmin emas):
//   Kapitalbank · Xalq banki · InFinBank · Aloqabank ·
//   Orient Finans bank · Universal bank · O'zbekiston Milliy banki
// Moslash BO'LAK bo'yicha — sayt nomni biroz boshqacha yozsa ham
// topiladi (masalan "NBU" yoki "Milliy bank").
const ISHONCHLI = [
  ["Kapitalbank",           /kapital/i],
  ["Milliy bank (NBU)",     /milliy|(^|[^a-z])nbu([^a-z]|$)/i],
  ["Xalq banki",            /xalq/i],
  ["InFinBank",             /infin/i],
  ["Aloqabank",             /aloqa/i],
  ["Orient Finans bank",    /orient/i],
  ["Universal bank",        /universal/i],
];
function _ishonchliMi(nom) {
  const t = String(nom || "");
  for (const [yorliq, re] of ISHONCHLI) if (re.test(t)) return yorliq;
  return null;
}

function _kelishuvBilanTanla(banklar) {
  const r = (banklar || []).filter(b => b && b.sell > 0)
                           .sort((a, b) => b.sell - a.sell);
  for (let i = 0; i < r.length; i++) {
    const qollab = r.filter((x, j) => j !== i &&
      Math.abs(x.sell - r[i].sell) <= r[i].sell * 0.005);
    if (qollab.length >= 1) {
      return { tanlangan: r[i], qollab: qollab.length, tashlangan: i,
               tashlanganlar: r.slice(0, i).map(x => x.bank + " " + x.sell) };
    }
  }
  return null;   // hech biri tasdiqlanmadi — kurs O'ZGARTIRILMAYDI
}

// Yakuniy tanlov: ISHONCHLI ro'yxat → kelishuv → zaxira o'rta qiymat
function _kursniTanla(hammaBanklar) {
  const hamma = (hammaBanklar || []).filter(b => b && b.sell > 0);
  // 1-qatlam: faqat ishonchli banklar
  const ishonchli = hamma
    .map(b => ({ ...b, yorliq: _ishonchliMi(b.bank) }))
    .filter(b => b.yorliq)
    .sort((a, b) => b.sell - a.sell);

  if (ishonchli.length < 2) {
    return { xato: "ishonchli banklardan " + ishonchli.length +
                   " tasi topildi — kurs o'zgartirilmaydi",
             ishonchli, hamma_soni: hamma.length };
  }
  // 2-qatlam: kelishuv (xato o'qilgan raqamdan himoya)
  const k = _kelishuvBilanTanla(ishonchli);
  if (k) {
    return { tanlangan: k.tanlangan, usul: "kelishuv",
             qollab: k.qollab, tashlangan: k.tashlanganlar,
             ishonchli, hamma_soni: hamma.length };
  }
  // 3-qatlam: kelishuv bo'lmasa — O'RTA qiymat (yakka chetlashuv ta'sir qilmaydi)
  const s = ishonchli.map(x => x.sell).sort((a, b) => a - b);
  const orta = s.length % 2 ? s[(s.length - 1) / 2]
                            : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  const eng = ishonchli.find(x => x.sell === orta) || ishonchli[0];
  return { tanlangan: { bank: eng.bank, sell: orta, buy: eng.buy },
           usul: "o'rta qiymat (kelishuv bo'lmadi)",
           ishonchli, hamma_soni: hamma.length };
}

export default async function handler(req, res) {
  const mode  = String(req.query?.mode || "");
  const debug = String(req.query?.debug || "") === "1";

  // ── 540: QURUQ SINOV — parser nima ajratganini ko'rsatadi ──
  // Jonli rejimga HALI ULANMAGAN. Avval natija tekshiriladi.
  if (String(req.query?.probe || "") === "7") {
    let cb = 0;
    try { cb = (await cbuOl()).rate; } catch (e) {}
    let bx = null, xato = null;
    try { bx = await bxOl(cb); } catch (e) { xato = String(e.message || e); }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, cb, izoh:
      "540 · QURUQ SINOV. Parser nima ajratdi — jonli rejim TEGILMAGAN. " +
      "`banklar[0]` eng yuqori sotish kursi bo'lishi kerak.",
      xato, soni: bx ? bx.length : 0,
      eng_yuqori_xom: bx && bx.length ? bx[0] : null,
      natija: bx ? _kursniTanla(bx) : null,
      hamma_banklar: bx ? bx.map(x => x.bank + " · " + x.sell) : [] });
  }

  // ══════════════════════════════════════════════════════════════
  // 539 — `bankxizmatlari.uz/uz/rates/` TUZILMASI (`?probe=6`)
  // ══════════════════════════════════════════════════════════════
  // `?probe=5` natijasi: `bankxizmatlari.uz` (CBU sahifasidan havola
  // qilingan portal) ichida MB kursidan YUQORI raqamlar bor —
  // 11 880 · 11 870 · 11 855 (MB 11 847). Bular SOTISH kurslariga
  // o'xshaydi. Sahifada `/uz/rates/` havolasi ham chiqdi.
  // Bu — bank.uz dan yaxshiroq nomzod: rasmiyroq, ya'ni tuzilishi
  // kamroq o'zgaradi.
  // Bu yerda o'sha sahifaning tuzilmasi olinadi: bank nomi bilan kurs
  // qanday bog'langan, sotib olish/sotish ajratilganmi, JSON/AJAX
  // manzili bormi. Shundan keyin parser YOZILADI — qidiruv tugaydi.
  if (String(req.query?.probe || "") === "6") {
    let cb = 0;
    try { cb = (await cbuOl()).rate; } catch (e) {}
    const MANZIL = [
      ["rates",      "https://bankxizmatlari.uz/uz/rates/"],
      ["rates-usd",  "https://bankxizmatlari.uz/uz/rates/?currency=USD"],
    ];
    const natija = [];
    for (const [nom, url] of MANZIL) {
      try {
        const r = await fetch(url, { headers: UA });
        const xom = await r.text();
        let t = xom.replace(/<svg[\s\S]*?<\/svg>/gi, " ")
                   .replace(/<style[\s\S]*?<\/style>/gi, " ")
                   .replace(/<!--[\s\S]*?-->/g, " ")
                   .replace(/\s(?:href|src|srcset|data-[a-z-]+)="[^"]*"/gi, " ");
        // JS ichidagi ma'lumot ham qiziq — script'ni ALOHIDA ko'ramiz
        const skript = (xom.match(/<script[^>]*>([\s\S]{0,4000}?)<\/script>/gi) || [])
          .filter(x => /1[12][\s\u00a0]?[0-9]{3}/.test(x) &&
                       /(bank|kurs|rate|usd|sotish)/i.test(x))
          .slice(0, 2)
          .map(x => x.replace(/\s+/g, " ").slice(0, 400));
        t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");

        const re = /1[12][\s\u00a0]?[0-9]{3}(?:[.,][0-9]{1,2})?/g;
        const joy = []; let m;
        while ((m = re.exec(t)) !== null && joy.length < 120) {
          const n = parseFloat(String(m[0]).replace(/[\s\u00a0]/g, "").replace(",", "."));
          if (cb && Math.abs(n - cb) > cb * 0.06) continue;
          joy.push({ n, i: m.index });
        }
        // AJAX/JSON manzillari
        const api = [...new Set((xom.match(/["'\(]\/?[a-z0-9_\-\/\.]*(?:api|ajax|json|rates)[a-z0-9_\-\/\.\?=&]{0,60}["'\)]/gi) || [])
          .map(x => x.replace(/^["'\(]|["'\)]$/g, ""))
          .filter(x => !/\.(css|png|jpe?g|svg|woff2?|ico)/i.test(x)))].slice(0, 20);

        natija.push({ nom, url, status: r.status, hajm: xom.length,
          topildi: joy.length,
          raqamlar: [...new Set(joy.map(x => x.n))].slice(0, 20),
          sotib_sotish: { sotib: /sotib\s*ol/i.test(t), sotish: /sotish/i.test(t) },
          api_manzillar: api,
          skript_namuna: skript,
          namunalar: joy.slice(0, 4).map(x =>
            t.slice(Math.max(0, x.i - 420), x.i + 160).replace(/\s+/g, " ")) });
      } catch (e) {
        natija.push({ nom, url, xato: String(e.message || e) });
      }
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, cb, izoh:
      "539 · bankxizmatlari.uz/uz/rates/ tuzilmasi. `namunalar` — parser " +
      "uchun. `api_manzillar` — JSON bo'lsa regex kerak emas.", natija });
  }

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
  // 🔴 543 (2026-08-22): MANBA ALMASHTIRILDI.
  // Eski zanjir `[nbu, bank.uz]` ikkalasi ham O'LIK edi (534 o'lchovi):
  //   · NBU JSON → 404, manzil butunlay yo'qolgan;
  //   · bank.uz umumiy ro'yxati → tuzilma o'zgargan, "qator topilmadi".
  // Natijada tijorat rejimi jimgina Markaziy Bank kursiga tushib
  // qolgan edi — ya'ni bo'lim ishlamas holatda turgan.
  // Yangi manba: `bankxizmatlari.uz` (CBU sahifasidan havola qilingan
  // portal) — bitta so'rovda 30 ta bank, "Sotish"/"Sotib olish"
  // yorliqlari MATN bilan yozilgan (539/540 tasdiqladi).
  // ⚠️ bank.uz zanjirdan OLIB TASHLANDI: uning umumiy ro'yxati faqat
  // SOTIB OLISH kursini beradi. Noto'g'ri ma'lumot — ma'lumot yo'qligidan
  // YOMONROQ, shuning uchun zaxira sifatida ham qoldirilmadi.
  // Zaxira yo'l — pastdagi Markaziy Bank kursi (o'zgarmagan).
  for (const [nom, fn] of [["bankxizmatlari", bxOl]]) {
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

  // ── 543: TANLOV — ishonchli ro'yxat → kelishuv → o'rta qiymat ──
  const tanlov = _kursniTanla(banklar);
  if (!tanlov || !tanlov.tanlangan) {
    // Ishonchli bank topilmadi yoki kelishuv yo'q — KURS TAXMIN
    // QILINMAYDI. Markaziy Bank kursi bilan qaytamiz; klientdagi
    // "sakrash qo'riqchisi" ham shu javobni ko'radi.
    if (!cb) return res.status(500).json({ ok: false, error: "Manbalar ishlamadi" });
    return res.status(200).json({ ok: true, rate: cb, cb, banklar: [],
      fallback: true,
      sabab: (tanlov && tanlov.xato) || "ishonchli bank topilmadi",
      source: "CBU (Markaziy Bank) — tijorat kursi tasdiqlanmadi" });
  }

  // ⚡ 543: KESH 15 → 5 DAQIQA. Egasining talabi: kurs kun davomida
  // 10 daqiqalik aniqlikda yangilansin. Klient tomonidagi 30 daqiqalik
  // qo'riqchi ham keyingi paketda qisqartiriladi.
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
  return res.status(200).json({ ok: true,
    rate: tanlov.tanlangan.sell,
    bank: tanlov.tanlangan.bank,
    buy:  tanlov.tanlangan.buy || null,
    usul: tanlov.usul,
    qollab: tanlov.qollab || 0,
    tashlangan: tanlov.tashlangan || [],
    hamma_soni: tanlov.hamma_soni,
    cb,
    banklar: tanlov.ishonchli,
    source: "Ishonchli banklar · eng yuqori sotuv (tasdiqlangan)" });
}
