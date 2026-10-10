// MERX akt.js | v1 | 2026-10-10 | AKT-1 — Solishtirma akt (mijoz bo'yicha)
// ═══════════════════════════════════════════════════════════════
// ALOHIDA FAYL (egasi qarori, 10-okt): yangi mustaqil imkoniyat
// mavjud fayllarga tegmasdan. `qarzlar.js` dan KEYIN yuklanadi —
// `debtCust`, `findCustomerDebts`, `_cphCustomer` (qarzlar.js) va
// `calcSaleState`, `activePays`, `fmt`, `today`, `nowTime`, `_devCode`
// (utils.js) ga tayanadi. Bu faylda xato bo'lsa — faqat Akt tugmasi
// ishlamaydi, qarz sahifasi va to'lovlar ta'sirlanmaydi.
// FAQAT O'QIYDI: bazaga, db ga, localStorage ga yozuv yo'q, server yo'q.
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// ✅ AKT-1 (2026-10-10): SOLISHTIRMA AKT — mijoz bo'yicha bitta varaq.
// FAQAT O'QIYDI: ochiq cheklar `findCustomerDebts` (kassa qarz ro'yxati
// bilan BIR XIL manba), qoldiq `calcSaleState` (server bilan bir qoida),
// to'lovlar `activePays`. Hech narsa yozilmaydi, saqlanmaydi.
// Ko'rinish: to'lov cheki oynasi (iframe + chop etish) uslubida.
// Raqam: AKT-yymmdd-NN-qurilma — faqat varaqda, bazaga yozilmaydi
// (hujjat emas, ko'rinish; takror ochilsa NN shu seansda oshadi).
// ═══════════════════════════════════════════════════════════════
let _aktSeq = 0;
function _aktEsc(t) { return String(t == null ? "" : t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function _aktDate(d) { if (!d) return "—"; const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : String(d); }
function _aktPul(v, cur) { return cur === "usd" ? "$" + (Math.round(v * 100) / 100).toLocaleString("ru-RU", {minimumFractionDigits:2, maximumFractionDigits:2}) : fmt(Math.round(v)) + " so'm"; }

// Mijozning akt ma'lumotlari — toza obyekt (stendda tekshiriladi)
function aktMalumot(customerName, customerPhone) {
  const t = today();
  // mijozning birorta sotuvi orqali findCustomerDebts ga kiramiz (u customerId/ism+tel bilan ishlaydi)
  const namuna = (db.sales || []).find(s => { const cu = debtCust(s); return cu.name === customerName && cu.phone === customerPhone; });
  const ochiq = namuna ? findCustomerDebts(namuna) : [];
  const cheklar = ochiq.map(s => {
    const st = calcSaleState(s);
    const usd = s.debtCurrency === "usd";
    const qarz = usd ? Number(s.origDebtUsd != null ? s.origDebtUsd : s.debtUsd || 0) : Number(s.origRemaining != null ? s.origRemaining : s.remaining || 0);
    const qoldi = usd ? Number(st.debtUsd || 0) : Number(st.remaining || 0);
    return { chek: s.chekNum || ("#" + s.id), sana: s.date || "", muddat: s.due || "", cur: usd ? "usd" : "uzs",
             qarz, qoldi: Math.max(0, qoldi), otgan: !!(s.due && s.due < t),
             kun: s.due ? Math.round((Date.parse(t) - Date.parse(s.due)) / 86400000) : null };
  }).filter(c => c.qoldi > 0.005);
  const tolovlar = activePays()
    .filter(p => p.customerName === customerName && p.customerPhone === customerPhone)
    .map(p => ({ sana: p.date || "", vaqt: p.time || "", chek: p.chekNum || p.refundNo || ("#" + p.id),
                 usul: p.source === "refund" ? "qaytarish" : (p.method || "naqd"), cur: p.currency === "usd" ? "usd" : "uzs", summa: Number(p.amount || 0) }))
    .sort((a, b) => (a.sana + a.vaqt).localeCompare(b.sana + b.vaqt));
  const jami = { usd: 0, uzs: 0, otganUsd: 0, otganUzs: 0, otganCnt: 0 };
  cheklar.forEach(c => { jami[c.cur] += c.qoldi; if (c.otgan) { jami[c.cur === "usd" ? "otganUsd" : "otganUzs"] += c.qoldi; jami.otganCnt++; } });
  const tolJami = { usd: 0, uzs: 0 }; tolovlar.forEach(p => { tolJami[p.cur] += p.summa; });
  // To'lov jadvali: muddat bo'yicha (o'tganlar "hozir")
  const jadval = [];
  const hozir = { usd: 0, uzs: 0 }; cheklar.filter(c => c.otgan || !c.muddat).forEach(c => { hozir[c.cur] += c.qoldi; });
  if (hozir.usd || hozir.uzs) jadval.push({ sana: "hozir", usd: hozir.usd, uzs: hozir.uzs, izoh: "muddati o'tgan" });
  const byDue = {};
  cheklar.filter(c => !c.otgan && c.muddat).forEach(c => { (byDue[c.muddat] = byDue[c.muddat] || { usd: 0, uzs: 0 })[c.cur] += c.qoldi; });
  Object.keys(byDue).sort().forEach(d => jadval.push({ sana: d, usd: byDue[d].usd, uzs: byDue[d].uzs, izoh: "" }));
  const davrBosh = cheklar.length ? cheklar.reduce((a, c) => (!a || c.sana < a) ? c.sana : a, "") : t;
  return { mijoz: customerName, tel: customerPhone, sana: t, vaqt: (typeof nowTime === "function" ? nowTime() : ""),
           davr: [davrBosh, t], cheklar, tolovlar, jami, tolJami, jadval };
}

function aktHtml(m, opts) {
  opts = opts || {};
  const shopName = db.shop?.name || db.settings?.name || "MERX";
  const manzil = db.settings?.address || db.shop?.address || "";
  const tel = db.settings?.phone || db.shop?.phone || "";
  const no = opts.no || "AKT";
  const E = _aktEsc, D = _aktDate, P = _aktPul;
  const jamiTxt = [m.jami.usd ? P(m.jami.usd, "usd") : "", m.jami.uzs ? P(m.jami.uzs, "uzs") : ""].filter(Boolean).join("  +  ") || "0";
  const otganTxt = [m.jami.otganUsd ? P(m.jami.otganUsd, "usd") : "", m.jami.otganUzs ? P(m.jami.otganUzs, "uzs") : ""].filter(Boolean).join(" + ");
  const tolTxt = [m.tolJami.usd ? P(m.tolJami.usd, "usd") : "", m.tolJami.uzs ? P(m.tolJami.uzs, "uzs") : ""].filter(Boolean).join(" + ") || "0";
  const rows = m.cheklar.map(c => `<tr class="${c.otgan ? "ot" : ""}">
    <td>${E(c.chek)}</td><td>${D(c.sana)}</td><td>${c.muddat ? D(c.muddat) + (c.otgan ? " ⚠" : "") : "—"}</td>
    <td class="n">${P(c.qarz, c.cur)}</td><td class="n b">${P(c.qoldi, c.cur)}</td></tr>`).join("");
  const pays = m.tolovlar.length ? m.tolovlar.map(p => `<tr><td>${D(p.sana)}</td><td>${E(p.chek)}</td><td>${E(p.usul)}</td><td class="n">${P(p.summa, p.cur)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="mut">to'lov yo'q</td></tr>`;
  const jad = m.jadval.map(j => `<tr><td class="b">${j.sana === "hozir" ? "hozir" : D(j.sana) + " gacha"}</td>
    <td class="n b">${[j.usd ? P(j.usd, "usd") : "", j.uzs ? P(j.uzs, "uzs") : ""].filter(Boolean).join(" + ")}</td><td class="mut">${E(j.izoh)}</td></tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${E(no)}</title><style>
    @page{size:A4;margin:14mm} body{font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#111;margin:0;padding:16px}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0D1B2A;padding-bottom:8px;margin-bottom:10px}
    .hd h1{font-size:18px;margin:0;color:#0D1B2A}.hd .r{text-align:right;font-size:12px}.hd .t{font-size:15px;font-weight:800}
    h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#555;margin:14px 0 5px;border-bottom:1px solid #ddd;padding-bottom:3px}
    table{width:100%;border-collapse:collapse}th,td{padding:5px 6px;border-bottom:1px solid #e5e5e5;text-align:left;vertical-align:top}
    th{font-size:11px;color:#666;font-weight:700;background:#f6f6f6}.n{text-align:right;white-space:nowrap}.b{font-weight:700}.mut{color:#888}
    tr.ot td{background:#FFF1F1;color:#9B1C1C}.jami{margin-top:12px;padding:10px 12px;background:#F3F4F6;border-radius:6px;font-size:14px}
    .jami .big{font-size:17px;font-weight:800}.imz{display:flex;justify-content:space-between;margin-top:28px;font-size:12px}
    .imz div{width:45%;border-top:1px solid #333;padding-top:4px}.ft{margin-top:10px;font-size:10.5px;color:#888}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="hd"><div><h1>${E(shopName)}</h1><div style="font-size:11.5px;color:#555">${E(manzil)}${manzil && tel ? " · " : ""}${E(tel)}</div></div>
    <div class="r"><div class="t">SOLISHTIRMA AKT</div><div>№ ${E(no)}</div><div>${D(m.sana)} ${E(m.vaqt)}</div></div></div>
  <table><tr><td style="border:0;padding:2px 0"><b>Mijoz:</b> ${E(m.mijoz)}</td><td style="border:0;padding:2px 0" class="n"><b>Tel:</b> ${E(m.tel || "—")}</td></tr>
    <tr><td style="border:0;padding:2px 0" colspan="2"><b>Davr:</b> ${D(m.davr[0])} — ${D(m.davr[1])}</td></tr></table>
  <h2>Ochiq cheklar (${m.cheklar.length})</h2>
  <table><thead><tr><th>Chek</th><th>Sotuv</th><th>Muddat</th><th class="n">Qarz</th><th class="n">Qolgan</th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="mut">ochiq chek yo'q</td></tr>`}</tbody></table>
  <h2>To'lovlar (davrda)</h2>
  <table><thead><tr><th>Sana</th><th>Hujjat</th><th>Usul</th><th class="n">Summa</th></tr></thead><tbody>${pays}</tbody>
    <tfoot><tr><td colspan="3" class="b">Jami to'langan</td><td class="n b">${tolTxt}</td></tr></tfoot></table>
  <div class="jami">JAMI QOLGAN: <span class="big">${jamiTxt}</span>${otganTxt ? `<div style="font-size:12.5px;color:#9B1C1C;margin-top:3px">shundan muddati o'tgan: <b>${otganTxt}</b> (${m.jami.otganCnt} chek)</div>` : ""}</div>
  ${m.jadval.length ? `<h2>To'lov jadvali</h2><table><tbody>${jad}</tbody></table>` : ""}
  <div class="ft">Dollar qarzlar — chekda muzlatilgan kurs bo'yicha. Qoldiq kassa qarz ro'yxati bilan bir xil manbadan.</div>
  <div class="imz"><div>Tuzdi: ${E((db.currentStaff && db.currentStaff.name) || db.settings?.ownerName || "")}</div><div>Mijoz: </div></div>
  </body></html>`;
}

function aktOchish() {
  try {
    const { name, phone } = _cphCustomer || {};
    if (!name) { toast("Mijoz tanlanmagan", "err"); return; }
    const m = aktMalumot(name, phone || "");
    _aktSeq++;
    const no = "AKT-" + today().replace(/-/g, "").slice(2) + "-" + String(_aktSeq).padStart(2, "0") + "-" + (typeof _devCode === "function" ? _devCode() : "");
    const html = aktHtml(m, { no });
    // To'lov cheki oynasi bilan bir xil ko'rinish (iframe + chop etish)
    let ov = document.getElementById("ov-akt");
    if (!ov) {
      ov = document.createElement("div"); ov.className = "ov"; ov.id = "ov-akt";
      ov.innerHTML = '<div class="modal" style="max-width:720px"></div>';
      document.body.appendChild(ov);
      ov.addEventListener("click", e => { if (e.target === ov) ov.classList.remove("on"); });
    }
    ov.querySelector(".modal").innerHTML = `
      <button class="m-close" onclick="document.getElementById('ov-akt').classList.remove('on')"><i class="ti ti-x"></i></button>
      <iframe id="akt-frame" style="width:100%;height:72vh;border:0;background:#fff" srcdoc="${html.replace(/"/g, "&quot;")}"></iframe>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-acc" style="flex:1" onclick="(function(){try{const f=document.getElementById('akt-frame');f.contentWindow.focus();f.contentWindow.print();}catch(e){}})()"><i class="ti ti-printer"></i> Chop etish</button>
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('ov-akt').classList.remove('on')">Yopish</button>
      </div>`;
    ov.classList.add("on");
  } catch (e) { console.warn("akt:", e.message); toast("Akt tayyorlanmadi: " + e.message, "err"); }
}
