// ═══════════════════════════════════════════════════════════════════
// js/kunlik.js — KUNLIK HISOBOT (PDF)  · v1 · 2026-08-23
// ═══════════════════════════════════════════════════════════════════
// NIMA QILADI: Hisobot bo'limidagi bitta tugma — do'kon egasi tushunadigan
// tilda bir kunlik to'liq hisobot yasaydi va brauzer orqali PDF qilib
// saqlash imkonini beradi.
//
// XAVFSIZLIK QOIDALARI (dizayn):
//   1. FAQAT O'QIYDI — bazaga, sinxronga, serverga hech narsa yozilmaydi.
//   2. ALOHIDA FAYL — `hisobot.js` ga tegilmagan. Bu fayl yiqilsa ham
//      Hisobot oynasi avvalgidek ishlaydi (hammasi try/catch ichida).
//   3. PUL RAQAMLARI SERVERDAN — `report_stats` (Hisobot ekrani bilan
//      AYNAN bir manba, ya'ni raqamlar hech qachon farq qilmaydi).
//      Oflaynda hisobot YASALMAYDI — yarim/lokal raqam chiqarilmaydi.
//   4. RO'YXATLAR lokal `db` dan (kassirlar, bekor qilinganlar...).
//      Lokal sotuv soni server sonidan farq qilsa — PDF boshida OCHIQ
//      ogohlantirish chiqadi ("ro'yxatlar chala bo'lishi mumkin").
//   5. RUXSAT — `requireDo("hisobot","kunlik")`, Excel bilan bir xil naqsh.
//   6. CHOP ETISH — o'z IFRAME'ida, o'z A4 uslubi bilan. Ilovaning
//      58mm termal-printer uslubiga (index.html `@page`) TEGILMAYDI.
// ═══════════════════════════════════════════════════════════════════

function _kunFmt(n) {
  try { return (Math.round(Number(n) || 0)).toLocaleString("ru-RU").replace(/\u00A0/g, " "); }
  catch (e) { return String(Math.round(Number(n) || 0)); }
}
function _kunEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function _kunSana(d) {
  try {
    const [y, m, g] = String(d).split("-");
    const oy = ["yanvar","fevral","mart","aprel","may","iyun","iyul",
                "avgust","sentabr","oktabr","noyabr","dekabr"][(+m) - 1] || m;
    return `${+g}-${oy} ${y}`;
  } catch (e) { return d; }
}

// ── Kun uchun lokal ro'yxatlarni yig'ish (FAQAT O'QIYDI) ──────────
function _kunYigish(kun) {
  const chiq = {
    sotuvlar: [], bekor: [], qaytarish: [], tolovlar: [],
    xarajatlar: [], ombor: [], kassirlar: new Map(),
    mijozlar: new Map(), tovarlar: new Map(), yangiMijoz: 0,
    // 557: TO'LOV TURLARI — dashboard.js:95-130 bilan AYNAN bir qoida
    naqd: 0, karta: 0, otkazma: 0,      // sotuvdan + qarz to'lovidan
    sotNaqd: 0, sotKarta: 0, sotOtkazma: 0,
    qarzNaqd: 0, qarzKarta: 0, qarzOtkazma: 0,
    usdTolov: 0, usdSom: 0,              // USD qarz to'lovi va uning so'mdagi qiymati
    // 559: XARAJAT ham to'lov turi bo'yicha (dashboard.js:128 qoidasi:
    // `x.method || "naqd"`). Sotuvchi uchun eng muhim savol —
    // "bugun qo'limda qancha pul qoldi".
    xarNaqd: 0, xarKarta: 0, xarOtkazma: 0
  };
  try {
    const xodimNomi = (id) => {
      if (!id) return "Admin (ega)";   // 555: xodim biriktirilmagan sotuv
      const x = (db.staff || []).find(s => String(s.id) === String(id));
      return x ? (x.name || ("#" + id)) : ("#" + id);
    };

    (db.sales || []).forEach(s => {
      if (s.date !== kun) return;
      if (s.isOldDebt) return;                       // eski qarz — savdo emas
      if (s.cancelled) { chiq.bekor.push(s); return; }
      chiq.sotuvlar.push(s);

      // 557: to'lov turi — payBreakdown bo'lsa undan, bo'lmasa payType dan
      const pb = s.payBreakdown;
      if (pb && (pb.naqd || pb.karta || pb.otkazma)) {
        chiq.sotNaqd    += Number(pb.naqd)    || 0;
        chiq.sotKarta   += Number(pb.karta)   || 0;
        chiq.sotOtkazma += Number(pb.otkazma) || 0;
      } else if (s.payType !== "nasiya") {
        const p0 = Number(s.paid) || 0;
        if (s.payType === "karta")        chiq.sotKarta   += p0;
        else if (s.payType === "otkazma") chiq.sotOtkazma += p0;
        else                              chiq.sotNaqd    += p0;
      }

      const k = xodimNomi(s.staffId);
      const kv = chiq.kassirlar.get(k) ||
                 { nom: k, chek: 0, jami: 0, naqd: 0, qarz: 0, chegirma: 0 };
      kv.chek++;
      kv.jami    += Number(s.total) || 0;
      kv.naqd    += Number(s.paid)  || 0;
      kv.qarz    += Number(s.remaining) || 0;
      kv.chegirma += Number(s.discount) || 0;
      chiq.kassirlar.set(k, kv);

      if (s.customerName) {
        const m = chiq.mijozlar.get(s.customerName) ||
                  { nom: s.customerName, chek: 0, jami: 0 };
        m.chek++; m.jami += Number(s.total) || 0;
        chiq.mijozlar.set(s.customerName, m);
      }
      (s.items || []).forEach(it => {
        const nom = (it.name || it.sku || "—") +
                    (it.color ? " · " + it.color : "");
        const t = chiq.tovarlar.get(nom) ||
                  { nom, dona: 0, pochka: 0, inBox: 0, jami: 0 };
        // 556: POCHKA TILIDA — chekda qanday sotilgan bo'lsa shunday
        // ko'rsatiladi (pos.js:1882 bilan bir qoida: karobka → qtyBox).
        const dona = Number(it.qty) || 0;
        t.dona += dona;
        if (it.sellMode === "karobka" && it.qtyBox) t.pochka += Number(it.qtyBox) || 0;
        else if (it.inBox > 1) t.pochka += dona / Number(it.inBox);
        if (!t.inBox && it.inBox > 1) t.inBox = Number(it.inBox);
        t.jami += dona * (Number(it.price) || 0);
        chiq.tovarlar.set(nom, t);
      });
    });

    (db.returns || []).forEach(r => { if (r.date === kun) chiq.qaytarish.push(r); });
    const _rate = (db.settings && db.settings.rate) || 12800;
    (db.debtPayments || []).forEach(p => {
      if (p.date !== kun || p.cancelled) return;
      chiq.tolovlar.push(p);
      // 557: USD to'lov so'mga o'giriladi (dashboard qoidasi: avval
      // `amountSom`, u yo'q bo'lsa joriy kurs bilan)
      const som = Number(p.amountSom) ||
                  (p.currency === "usd" ? Math.round((Number(p.amount) || 0) * _rate)
                                        : (Number(p.amount) || 0));
      if (p.currency === "usd") { chiq.usdTolov += Number(p.amount) || 0; chiq.usdSom += som; }
      const mb = p.methodBreakdown;
      const mbBor = mb && Object.keys(mb).some(x => (Number(mb[x]) || 0) > 0);
      if (mbBor) {
        chiq.qarzNaqd    += Number(mb.naqd)    || 0;
        chiq.qarzKarta   += Number(mb.karta)   || 0;
        chiq.qarzOtkazma += Number(mb.otkazma) || 0;
      } else {
        const m = p.method || "naqd";
        if (m === "karta")        chiq.qarzKarta   += som;
        else if (m === "otkazma") chiq.qarzOtkazma += som;
        else if (m === "balans")  { /* balansdan — kassaga pul kirmaydi */ }
        else                      chiq.qarzNaqd    += som;
      }
    });
    (db.xarajatlar || []).forEach(x => {
      if (x.date !== kun) return;
      chiq.xarajatlar.push(x);
      const m = x.method || "naqd";              // 559
      const sm = Number(x.amount) || 0;
      if (m === "karta")        chiq.xarKarta   += sm;
      else if (m === "otkazma") chiq.xarOtkazma += sm;
      else                      chiq.xarNaqd    += sm;
    });
    (db.ombor || []).forEach(o => { if (o.date === kun) chiq.ombor.push(o); });
    (db.customers || []).forEach(c => {
      const d = String(c.createdAt || c.date || "").slice(0, 10);
      if (d === kun) chiq.yangiMijoz++;
    });
    chiq.naqd    = chiq.sotNaqd    + chiq.qarzNaqd;
    chiq.karta   = chiq.sotKarta   + chiq.qarzKarta;
    chiq.otkazma = chiq.sotOtkazma + chiq.qarzOtkazma;
  } catch (e) { console.warn("[kunlik] yig'ish:", e.message); }
  return chiq;
}

// ── Oddiy tildagi xulosa ──────────────────────────────────────────
function _kunXulosa(kun, r, y) {
  const gaplar = [];
  const chek = y.sotuvlar.length;
  const jami = y.sotuvlar.reduce((a, s) => a + (Number(s.total) || 0), 0);
  if (!chek) gaplar.push("Bu kuni savdo qilinmagan.");
  else {
    gaplar.push(`Bugun <b>${chek} ta chek</b> yozildi, jami <b>${_kunFmt(jami)} so'm</b> savdo bo'ldi.`);
    const naqd = y.sotuvlar.reduce((a, s) => a + (Number(s.paid) || 0), 0);
    const qarz = y.sotuvlar.reduce((a, s) => a + (Number(s.remaining) || 0), 0);
    const kassa = y.naqd + y.karta + y.otkazma;
    gaplar.push(`Kassaga <b>${_kunFmt(kassa)} so'm</b> tushdi` +
      (qarz > 0 ? `, <b>${_kunFmt(qarz)} so'm</b> nasiyaga berildi.` : "."));
    // 560: TEPADAGI XULOSADA HAM TO'LIQ ZANJIR — egasining talabi:
    // "naqdning qaysi qismi qayerdan kelgani, xarajat nimadan ayirilgani".
    const zanjir = (belgi, nom, sot, qar, xar) => {
      const qoldi = sot + qar - xar;
      return `${belgi} <b>${nom}: ${_kunFmt(qoldi)} so'm</b> — ` +
             `sotuvdan ${_kunFmt(sot)}` +
             (qar ? ` + qarz to'lovidan ${_kunFmt(qar)}` : ` + qarz to'lovidan 0`) +
             (xar ? ` − xarajat ${_kunFmt(xar)}` : "") + `.`;
    };
    gaplar.push(`<u>Kun oxirida pul qayerda:</u>`);
    gaplar.push(zanjir("💵", "Qo'lda naqd", y.sotNaqd, y.qarzNaqd, y.xarNaqd));
    gaplar.push(zanjir("💳", "Kartada", y.sotKarta, y.qarzKarta, y.xarKarta));
    if (y.sotOtkazma || y.qarzOtkazma || y.xarOtkazma)
      gaplar.push(zanjir("🏦", "Hisobda (o'tkazma)", y.sotOtkazma, y.qarzOtkazma, y.xarOtkazma));
    if (r && r.ok) {
      const ust = (r.cost > 0 && r.profit != null)
        ? Math.round(r.profit / r.cost * 100) : null;
      gaplar.push(`Sof foyda <b>${_kunFmt(r.netProfit || r.trueNet || 0)} so'm</b>` +
        (r.netMargin != null
          ? ` (margin ${r.netMargin}%${ust != null ? `, ustama ${ust}%` : ""}).` : "."));
    }
    const kass = [...y.kassirlar.values()].sort((a, b) => b.jami - a.jami)[0];
    if (kass) gaplar.push(`Eng ko'p sotgan: <b>${_kunEsc(kass.nom)}</b> — ${kass.chek} ta chek, ${_kunFmt(kass.jami)} so'm.`);
  }
  const qarzJami = y.qarzNaqd + y.qarzKarta + y.qarzOtkazma;
  if (qarzJami) gaplar.push(`Qarz to'lovi: <b>${_kunFmt(qarzJami)} so'm</b>` +
    (y.usdTolov ? ` — shundan <b>$${_kunFmt(y.usdTolov)}</b> (${_kunFmt(y.usdSom)} so'm, joriy kurs bo'yicha).` : "."));
  const xar = y.xarajatlar.reduce((a, x) => a + (Number(x.amount) || 0), 0);
  if (xar) gaplar.push(`Xarajat: <b>${_kunFmt(xar)} so'm</b>.`);

  const ogoh = [];
  if (y.bekor.length)     ogoh.push(`${y.bekor.length} ta chek bekor qilingan`);
  if (y.qaytarish.length) ogoh.push(`${y.qaytarish.length} ta qaytarish`);
  const cheg = [...y.kassirlar.values()].reduce((a, k) => a + k.chegirma, 0);
  if (cheg > 0) ogoh.push(`${_kunFmt(cheg)} so'm chegirma berilgan`);
  return { gaplar, ogoh };
}

// ── HTML yasash ───────────────────────────────────────────────────
function _kunHtml(kun, r, y, ogohMatn) {
  const X = _kunEsc, F = _kunFmt;
  const xul = _kunXulosa(kun, r, y);
  // 555: do'kon nomi `db.shop.name` da (egasi.js:1121 bilan bir manba)
  const dok = (db.shop && db.shop.name) ||
              (db.settings && (db.settings.shopName || db.settings.name)) || "MERX";
  const hozir = (typeof today === "function" ? today() : kun) + " " +
                (typeof nowTime === "function" ? nowTime() : "");

  const kassirlar = [...y.kassirlar.values()].sort((a, b) => b.jami - a.jami);
  const mijozlar  = [...y.mijozlar.values()].sort((a, b) => b.jami - a.jami).slice(0, 10);
  const tovarlar  = [...y.tovarlar.values()].sort((a, b) => b.jami - a.jami).slice(0, 10);

  const kpi = (nom, qiy, izoh) => `
    <div class="kpi"><div class="kpi-l">${X(nom)}</div>
    <div class="kpi-v">${qiy}</div>${izoh ? `<div class="kpi-i">${X(izoh)}</div>` : ""}</div>`;

  const jadval = (sarlavha, boshlar, qatorlar, bosh) => {
    if (!qatorlar.length) return `<h3>${X(sarlavha)}</h3><p class="bosh">${X(bosh || "Ma'lumot yo'q")}</p>`;
    return `<h3>${X(sarlavha)}</h3><table>
      <thead><tr>${boshlar.map(b => `<th>${X(b)}</th>`).join("")}</tr></thead>
      <tbody>${qatorlar.map(q => `<tr>${q.map((c, i) =>
        `<td${i ? ' class="r"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  };

  const jamiSotuv = y.sotuvlar.reduce((a, s) => a + (Number(s.total) || 0), 0);
  const jamiNaqd  = y.sotuvlar.reduce((a, s) => a + (Number(s.paid)  || 0), 0);
  const jamiQarz  = y.sotuvlar.reduce((a, s) => a + (Number(s.remaining) || 0), 0);
  const jamiXar   = y.xarajatlar.reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const jamiTolovU = y.tolovlar.reduce((a, p) => a + (p.currency === "usd" ? 0 : Number(p.amount) || 0), 0);
  const jamiTolovD = y.tolovlar.reduce((a, p) => a + (p.currency === "usd" ? Number(p.amount) || 0 : 0), 0);

  return `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8">
<title>Kunlik hisobot — ${X(kun)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
         font-size: 11px; color: #1a1a1a; margin: 0; line-height: 1.45; }
  h1 { font-size: 19px; margin: 0 0 2px; color: #0F2D52; }
  h2 { font-size: 13px; margin: 16px 0 6px; color: #0F2D52;
       border-bottom: 2px solid #0F2D52; padding-bottom: 3px; }
  h3 { font-size: 12px; margin: 12px 0 5px; color: #333; }
  .sub { color: #666; font-size: 10px; margin-bottom: 10px; }
  .xul { background: #F3F7FC; border-left: 4px solid #0F2D52;
         padding: 10px 12px; margin: 10px 0 14px; font-size: 12px; }
  .xul p { margin: 0 0 5px; }
  .ogoh { background: #FFF6E5; border-left: 4px solid #E07B39;
          padding: 8px 12px; margin: 10px 0; font-size: 11px; }
  .xato { background: #FDECEC; border-left: 4px solid #C0392B;
          padding: 8px 12px; margin: 10px 0; font-size: 11px; font-weight: 600; }
  .kpis { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
  .kpi { border: 1px solid #DDE3EA; border-radius: 6px; padding: 7px 9px;
         min-width: 108px; flex: 1 1 108px; }
  .kpi-l { font-size: 9px; color: #6B7280; text-transform: uppercase; letter-spacing: .3px; }
  .kpi-v { font-size: 14px; font-weight: 700; color: #0F2D52; margin-top: 2px; }
  .kpi-i { font-size: 9px; color: #8A94A0; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; }
  th { background: #0F2D52; color: #fff; font-size: 10px; text-align: left;
       padding: 5px 6px; font-weight: 600; }
  td { border-bottom: 1px solid #E8EDF2; padding: 4px 6px; font-size: 10.5px; }
  td.r, th:not(:first-child) { text-align: right; }
  tbody tr:nth-child(even) { background: #FAFBFC; }
  .bosh { color: #8A94A0; font-style: italic; font-size: 10.5px; margin: 2px 0 10px; }
  .oxir { margin-top: 18px; padding-top: 8px; border-top: 1px solid #DDE3EA;
          font-size: 9px; color: #8A94A0; }
  @media print { .noprint { display: none !important; } }
</style></head><body>

<h1>Kunlik hisobot — ${X(_kunSana(kun))}</h1>
<div class="sub">${X(dok)} · tayyorlandi: ${X(hozir)} · raqamlar manbai: server</div>

${ogohMatn ? `<div class="xato">⚠️ ${X(ogohMatn)}</div>` : ""}

<div class="xul">
  ${xul.gaplar.map(g => `<p>${g}</p>`).join("")}
  ${xul.ogoh.length ? `<p style="margin-top:6px"><b>E'tibor:</b> ${X(xul.ogoh.join(" · "))}</p>` : ""}
</div>

<h2>Kun ko'rsatkichlari</h2>
<div class="kpis">
  ${kpi("Chek soni", y.sotuvlar.length + " ta")}
  ${kpi("Jami savdo", F(jamiSotuv) + " so'm")}
  ${kpi("O'rtacha chek", F(y.sotuvlar.length ? jamiSotuv / y.sotuvlar.length : 0) + " so'm")}
  ${kpi("Kassaga tushdi", F(y.naqd + y.karta + y.otkazma) + " so'm",
        "sotuvdan " + F(y.sotNaqd + y.sotKarta + y.sotOtkazma) +
        " + qarz to'lovidan " + F(y.qarzNaqd + y.qarzKarta + y.qarzOtkazma) +
        (y.usdSom ? " (shundan $" + F(y.usdTolov) + " = " + F(y.usdSom) + " so'm)" : ""))}
  ${kpi("💵 Qo'lda naqd qoldi", F(y.naqd - y.xarNaqd) + " so'm",
        "sotuvdan " + F(y.sotNaqd) + " + qarzdan " + F(y.qarzNaqd) +
        (y.xarNaqd ? " − xarajat " + F(y.xarNaqd) : ""))}
  ${kpi("💳 Kartaga tushdi", F(y.karta - y.xarKarta) + " so'm",
        "sotuvdan " + F(y.sotKarta) + " + qarzdan " + F(y.qarzKarta) +
        (y.xarKarta ? " − xarajat " + F(y.xarKarta) : ""))}
  ${(y.otkazma || y.xarOtkazma) ? kpi("🏦 Hisobga o'tkazma", F(y.otkazma - y.xarOtkazma) + " so'm",
        "sotuvdan " + F(y.sotOtkazma) + " + qarzdan " + F(y.qarzOtkazma) +
        (y.xarOtkazma ? " − xarajat " + F(y.xarOtkazma) : "")) : ""}
  ${kpi("Nasiyaga berildi", F(jamiQarz) + " so'm", "bugun qarzga yozildi")}
  ${kpi("Qarz to'lovi", F(y.qarzNaqd + y.qarzKarta + y.qarzOtkazma) + " so'm",
        y.usdTolov ? "shundan $" + F(y.usdTolov) + " = " + F(y.usdSom) + " so'm" : "")}
  ${kpi("Xarajat", F(jamiXar) + " so'm")}
  ${r && r.ok ? kpi("Tannarx", F(r.cost || 0) + " so'm") : ""}
  ${r && r.ok ? kpi("Sof foyda", F(r.netProfit != null ? r.netProfit : (r.trueNet || 0)) + " so'm",
        (r.netMargin != null ? "margin " + r.netMargin + "%" : "") +
        (r.cost > 0 && r.profit != null
          ? " · ustama " + Math.round(r.profit / r.cost * 100) + "%" : "")) : ""}
</div>

<h3>Kassaga tushgan pul — tafsilot</h3>
<table>
  <thead><tr><th>Turi</th><th>Sotuvdan</th><th>Qarz to'lovidan</th><th>Xarajat</th><th>QOLDI</th></tr></thead>
  <tbody>
    <tr><td>💵 Naqd</td><td class="r">${F(y.sotNaqd)}</td><td class="r">${F(y.qarzNaqd)}</td>
        <td class="r">${y.xarNaqd ? "−" + F(y.xarNaqd) : "—"}</td>
        <td class="r"><b>${F(y.naqd - y.xarNaqd)}</b></td></tr>
    <tr><td>💳 Karta</td><td class="r">${F(y.sotKarta)}</td><td class="r">${F(y.qarzKarta)}</td>
        <td class="r">${y.xarKarta ? "−" + F(y.xarKarta) : "—"}</td>
        <td class="r"><b>${F(y.karta - y.xarKarta)}</b></td></tr>
    <tr><td>🏦 O'tkazma</td><td class="r">${F(y.sotOtkazma)}</td><td class="r">${F(y.qarzOtkazma)}</td>
        <td class="r">${y.xarOtkazma ? "−" + F(y.xarOtkazma) : "—"}</td>
        <td class="r"><b>${F(y.otkazma - y.xarOtkazma)}</b></td></tr>
    <tr style="background:#F3F7FC"><td><b>JAMI</b></td>
        <td class="r"><b>${F(y.sotNaqd + y.sotKarta + y.sotOtkazma)}</b></td>
        <td class="r"><b>${F(y.qarzNaqd + y.qarzKarta + y.qarzOtkazma)}</b></td>
        <td class="r"><b>${(y.xarNaqd + y.xarKarta + y.xarOtkazma) ? "−" + F(y.xarNaqd + y.xarKarta + y.xarOtkazma) : "—"}</b></td>
        <td class="r"><b>${F(y.naqd + y.karta + y.otkazma - y.xarNaqd - y.xarKarta - y.xarOtkazma)}</b></td></tr>
  </tbody>
</table>
${y.usdTolov ? `<p class="bosh">Qarz to'lovidagi <b>$${F(y.usdTolov)}</b> joriy kurs bo'yicha
  <b>${F(y.usdSom)} so'm</b> deb hisoblangan va yuqoridagi jamiga qo'shilgan.</p>` : ""}
${jamiQarz ? `<p class="bosh">Nasiyaga berilgan <b>${F(jamiQarz)} so'm</b> bu jadvalga KIRMAYDI —
  u kassaga tushmagan, mijoz qarzi bo'lib yozilgan.</p>` : ""}

<h2>Kassirlar</h2>
${jadval("", ["Kassir", "Chek", "Jami savdo", "Kassaga", "Nasiya", "Chegirma"],
  kassirlar.map(k => [X(k.nom), k.chek, F(k.jami), F(k.naqd), F(k.qarz), F(k.chegirma)]),
  "Bu kuni sotuv bo'lmagan")}

<h2>Mijozlar</h2>
<div class="kpis">
  ${kpi("Xarid qilgan mijoz", y.mijozlar.size + " ta")}
  ${kpi("Yangi mijoz", y.yangiMijoz + " ta")}
</div>
${jadval("Eng ko'p olganlar", ["Mijoz", "Chek", "Summa"],
  mijozlar.map(m => [X(m.nom), m.chek, F(m.jami)]), "Mijoz biriktirilmagan")}

<h2>Tovarlar</h2>
${jadval("Eng ko'p sotilgan 10 ta", ["Tovar", "Pochka", "Dona", "Summa"],
  tovarlar.map(t => [X(t.nom),
    t.pochka ? (Math.round(t.pochka * 10) / 10) + " pch" : "—",
    F(t.dona), F(t.jami)]), "Sotuv bo'lmagan")}

<h2>Qarz to'lovlari</h2>
${jadval("", ["Chek", "Mijoz", "Summa", "Usul"],
  y.tolovlar.map(p => [X(p.chekNum || "—"), X(p.customerName || "—"),
    (p.currency === "usd" ? "$" + F(p.amount) : F(p.amount) + " so'm"),
    X(p.method || "naqd")]),
  "Bu kuni qarz to'lovi bo'lmagan")}

<h2>Xarajatlar</h2>
${jadval("", ["Izoh", "Turi", "Summa"],
  y.xarajatlar.map(x => [X(x.note || x.name || "—"), X(x.type || x.category || "—"), F(x.amount)]),
  "Xarajat yozilmagan")}

<h2>⚠️ Bekor qilingan va qaytarilganlar</h2>
${jadval("Bekor qilingan cheklar", ["Chek", "Kassir", "Summa", "Sabab"],
  y.bekor.map(s => [X(s.chekNum || "—"), X(s.cancelledBy || "—"),
    F(s.total), X(s.cancelReason || "—")]),
  "Bekor qilingan chek yo'q ✔")}
${jadval("Qaytarishlar", ["Hujjat", "Chek", "Summa", "Sabab"],
  y.qaytarish.map(q => [X(q.refundNo || "—"), X(q.origChekNum || "—"),
    F(q.total), X(q.reason || "—")]),
  "Qaytarish yo'q ✔")}

<h2>Ombor harakati</h2>
${jadval("", ["Tovar", "Rang / o'lcham", "Manba", "Soni"],
  y.ombor.slice(0, 30).map(o => [
    X(o.productName || o.name || o.sku || "—"),
    X([o.color, o.size].filter(Boolean).join(" · ") || "—"),
    X(o.partiya || o.supplier || "—"),
    F(o.qty)]), "Ombor harakati bo'lmagan")}

<div class="oxir">
  <b>Raqamlar qanday hisoblangan:</b> pul ko'rsatkichlari (tannarx, foyda,
  margin) serverda, Hisobot ekrani bilan bir xil usulda hisoblanadi.
  Ro'yxatlar shu qurilmadagi ma'lumotdan olinadi.
  <b>Sof foyda</b> = savdo − tannarx − xarajat.
  <b>Margin</b> = foyda ÷ savdo (savdoning necha foizi foyda).
  <b>Ustama</b> = foyda ÷ tannarx (tovar ustiga necha foiz qo'yilgan).
  <b>QOLDI</b> ustuni = sotuvdan + qarz to'lovidan − o'sha usuldagi xarajat
  (naqd xarajat naqddan, karta xarajati kartadan ayiriladi).
  Dollardagi qarz to'lovlari joriy kurs bo'yicha so'mga o'girilib qo'shiladi
  (Dashboard bilan bir xil qoida).
  Eski qarz yozuvlari (daftardan ko'chirilgan) savdoga qo'shilmaydi.
  <br>MERX · ${X(hozir)}
</div>
</body></html>`;
}

// ── Asosiy funksiya (tugma shuni chaqiradi) ───────────────────────
async function kunlikHisobot() {
  try {
    // 1) RUXSAT — Excel bilan bir xil naqsh
    if (typeof requireDo === "function" && !requireDo("hisobot", "kunlik")) return;

    // 2) Sana — Hisobotdagi tanlangan davrning BOSHI (bir kunlik hisobot)
    let kun = (typeof today === "function") ? today() : "";
    try {
      if (typeof repDateRange === "function") {
        const d = repDateRange();
        if (d && d.from) kun = d.from;
        if (d && d.from && d.to && d.from !== d.to) {
          if (!confirm(`Tanlangan davr: ${d.from} — ${d.to}\n\n` +
                       `Kunlik hisobot FAQAT ${d.from} sanasi uchun tayyorlanadi.\n` +
                       `Davom etamizmi?`)) return;
        }
      }
    } catch (e) {}

    // 3) OFLAYNDA YASALMAYDI — yarim raqam chiqmasin
    const onlayn = (typeof navigator === "undefined") || navigator.onLine !== false;
    const srv = (typeof _serverRejimi === "function") && _serverRejimi()
                && (typeof _serverPay === "function");
    if (!onlayn || !srv) {
      if (typeof toast === "function")
        toast("⚠️ Kunlik hisobot uchun internet kerak — pul raqamlari serverdan olinadi", "err");
      return;
    }

    if (typeof toast === "function") toast("📄 Hisobot tayyorlanmoqda...", "info");
    const t0 = Date.now();

    // 4) PUL RAQAMLARI — serverdan (Hisobot ekrani bilan AYNAN bir manba)
    let r = null;   // 555: yarim tun qo'riqchisi qayta yozishi mumkin
    try {
      r = await _serverPay({ action: "report_stats", from: kun, to: kun,
                             rate: (db.settings && db.settings.rate) || 12800 });
    } catch (e) { console.warn("[kunlik] server:", e.message); }
    if (!r || !r.ok) {
      if (typeof toast === "function")
        toast("⚠️ Server ko'rsatkichlari olinmadi — hisobot yasalmadi", "err");
      return;
    }

    // 5) RO'YXATLAR — lokal (faqat o'qish)
    let y = _kunYigish(kun);

    // ═══════════════════════════════════════════════════════════
    // 🔴 555: YARIM TUN QO'RIQCHISI
    // ═══════════════════════════════════════════════════════════
    // Jonli holat (2026-08-24, 00:33): egasi kun yakunini olmoqchi
    // bo'ldi, lekin yangi kun boshlangani uchun BO'SH hisobot chiqdi.
    // Endi: tanlangan kun BUGUN, savdo YO'Q va vaqt 00:00-06:00 orasida
    // bo'lsa — kechagi kun taklif qilinadi.
    try {
      const soat = parseInt(String((typeof nowTime === "function" ? nowTime() : "12:00")).slice(0, 2), 10);
      const bugunmi = (typeof today === "function") && kun === today();
      if (bugunmi && !y.sotuvlar.length && soat >= 0 && soat < 6) {
        const kecha = (typeof addDays === "function") ? addDays(kun, -1) : null;
        if (kecha && confirm(
              `Bugun (${kun}) hali savdo yo'q — soat ${soat}:00.\n\n` +
              `Kechagi kun (${kecha}) uchun hisobot olasizmi?`)) {
          kun = kecha;
          const r2 = await _serverPay({ action: "report_stats", from: kun, to: kun,
                       rate: (db.settings && db.settings.rate) || 12800 });
          if (r2 && r2.ok) r = r2;
          y = _kunYigish(kun);
        }
      }
    } catch (e) { console.warn("[kunlik] yarim tun:", e.message); }

    // 6) O'ZINI TEKSHIRISH: lokal chek soni ≠ server chek soni → ogohlantirish
    let ogoh = "";
    if (r.cnt != null && Number(r.cnt) !== y.sotuvlar.length) {
      ogoh = `Diqqat: serverda ${r.cnt} ta chek, bu qurilmada ${y.sotuvlar.length} ta. ` +
             `Pul raqamlari to'g'ri (serverdan), lekin quyidagi RO'YXATLAR chala bo'lishi mumkin. ` +
             `Sinxronlab, hisobotni qayta oling.`;
    }

    // 7) Chiqarish
    const html = _kunHtml(kun, r, y, ogoh);
    _kunChop(html, kun);
    console.log("📄 Kunlik hisobot tayyor:", (Date.now() - t0) + " ms · " + kun);
  } catch (e) {
    console.warn("[kunlik] xato:", e && e.message);
    try { toast("Hisobot yasalmadi: " + (e && e.message), "err"); } catch (e2) {}
  }
}

// ── Chop etish: O'Z IFRAME'ida (ilovaning 58mm uslubiga tegmaydi) ──
function _kunChop(html, kun) {
  try {
    const eski = document.getElementById("kunlik-frame");
    if (eski) eski.remove();
    const f = document.createElement("iframe");
    f.id = "kunlik-frame";
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(f);
    const d = f.contentWindow.document;
    d.open(); d.write(html); d.close();
    const chop = () => {
      try { f.contentWindow.focus(); f.contentWindow.print(); }
      catch (e) {
        // Zaxira yo'l: yangi oynada ochiladi
        try {
          const w = window.open("", "_blank");
          if (w) { w.document.write(html); w.document.close(); w.focus(); }
          else if (typeof toast === "function")
            toast("Chop etish oynasi ochilmadi — brauzer bloklagan bo'lishi mumkin", "err");
        } catch (e2) {}
      }
    };
    if (f.contentWindow.document.readyState === "complete") setTimeout(chop, 120);
    else f.onload = () => setTimeout(chop, 120);
    if (typeof toast === "function")
      toast("📄 \"PDF sifatida saqlash\" ni tanlang · sahifa sarlavhasi/havolasi " +
            "chiqmasligi uchun \"Sarlavha va kolontitullar\" belgisini oching", "info");
  } catch (e) {
    console.warn("[kunlik] chop:", e.message);
    try { toast("Chop etish ochilmadi", "err"); } catch (e2) {}
  }
}
