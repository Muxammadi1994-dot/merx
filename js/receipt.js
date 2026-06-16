// ════════════════════════════════════════════════
// MERX — Universal chek HTML builder
// Barcha joylarda (POS, tarix, Telegram PDF) ishlatiladi
// ════════════════════════════════════════════════

function buildReceiptHtml(sale, opts) {
  opts = opts || {};
  const shopName   = opts.shopName   || (typeof db !== "undefined" && db.shop?.name) || "MERX";
  const staffName  = opts.staffName  || "—";
  const botUser    = (opts.botUsername || "").replace(/^@/, "");
  const receiptUrl = opts.receiptUrl || "";

  // Maydon normalizatsiyasi (localDB + Supabase ikkalasini qo'llab)
  const chekNum   = sale.chekNum || sale.chek_num || ("#" + sale.id);
  const date      = sale.date || "";
  const time      = sale.time || "";
  const payType   = sale.payType || sale.pay_type || "";
  const custName  = sale.customerName || sale.customer_name || "";
  const custPhone = sale.customerPhone || sale.customer_phone || "";
  const total     = Number(sale.total || 0);
  const paid      = Number(sale.paid || 0);
  const remaining = Number(sale.remaining || 0);
  const discount  = Number(sale.discount || 0);
  const subtotal  = Number(sale.subtotal || total + discount);
  const due       = sale.due || "";
  const note      = sale.note || "";
  const debtCur   = sale.debtCurrency || sale.debt_currency || "uzs";
  const debtUsd   = sale.debtUsd   != null ? Number(sale.debtUsd)   : (sale.debt_usd   != null ? Number(sale.debt_usd)   : null);
  const prevUsd   = sale.prevDebtUsd != null ? Number(sale.prevDebtUsd) : null;
  const prevUzs   = sale.prevDebtUzs != null ? Number(sale.prevDebtUzs) : null;
  const isUsd     = debtCur === "usd" && debtUsd != null;
  const items     = (sale.items || []).filter(Boolean);

  const payLabels = { naqd: "Naqd pul", karta: "Karta", otkazma: "Bank o'tkazmasi" };
  const fmtN      = n => Math.round(n || 0).toLocaleString("ru-RU");

  // ── Mahsulotlar ──────────────────────────────
  const itemsHtml = items.map((i, idx) => {
    const iTotal  = (i.price || 0) * (i.qty || 0);
    const boxLine = i.qtyBox && i.inBox
      ? `<div class="rc-it-box">${i.qtyBox} karobka × ${fmtN((i.price||0) * (i.inBox||1))} so'm/karobka</div>` : "";
    return `<div class="rc-it">
      <div class="rc-it-n">${idx + 1}</div>
      <div class="rc-it-info">
        <div class="rc-it-name">${i.name || ""}</div>
        ${i.variant ? `<div class="rc-it-var">${i.variant}</div>` : ""}
        <div class="rc-it-calc">${i.qty} ${i.unit || "dona"} × ${fmtN(i.price)} so'm</div>
        ${boxLine}
      </div>
      <div class="rc-it-sum">${fmtN(iTotal)}</div>
    </div>`;
  }).join('<div class="rc-sep"></div>');

  // ── Chegirma ─────────────────────────────────
  const discHtml = discount > 0
    ? `<div class="rc-pr"><span>Chegirma</span><span class="rc-red">−${fmtN(discount)} so'm</span></div>` : "";

  // ── Qarz ─────────────────────────────────────
  let debtHtml = "";
  if (remaining > 0) {
    if (isUsd && prevUsd > 0) {
      const tot = prevUsd + debtUsd;
      debtHtml = `
        <div class="rc-pr rc-muted"><span>Oldingi qarz</span><span>$${prevUsd.toFixed(2)}</span></div>
        <div class="rc-pr rc-muted"><span>+ Yangi qarz</span><span>$${debtUsd.toFixed(2)}</span></div>
        <div class="rc-pr rc-debt"><span>Umumiy qarz</span><span>$${tot.toFixed(2)} USD</span></div>`;
    } else if (!isUsd && prevUzs > 0) {
      const tot = prevUzs + remaining;
      debtHtml = `
        <div class="rc-pr rc-muted"><span>Oldingi qarz</span><span>${fmtN(prevUzs)} so'm</span></div>
        <div class="rc-pr rc-muted"><span>+ Yangi qarz</span><span>${fmtN(remaining)} so'm</span></div>
        <div class="rc-pr rc-debt"><span>Umumiy qarz</span><span>${fmtN(tot)} so'm</span></div>`;
    } else {
      const dAmt = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${fmtN(remaining)} so'm`;
      debtHtml = `<div class="rc-pr rc-debt"><span>Qarz</span><span>${dAmt}</span></div>`;
    }
    if (due) debtHtml += `<div class="rc-pr rc-muted"><span>To'lov muddati</span><span class="rc-red">${due}</span></div>`;
  } else {
    debtHtml = `<div class="rc-paid">✓ To'liq to'landi</div>`;
  }

  const footerBotHtml  = botUser    ? `<div class="rc-bot">🤖 Cheklarni Telegramda olish: <b>@${botUser}</b></div>` : "";
  const footerPdfHtml  = receiptUrl ? `<div class="rc-pdf"><a href="${receiptUrl}" target="_blank">📄 PDF sifatida saqlash</a></div>` : "";
  const noteHtml       = note       ? `<div class="rc-meta-row"><span>Izoh</span><b>${note}</b></div>` : "";
  const staffHtml      = staffName && staffName !== "—" ? `<div class="rc-meta-row"><span>Kassir</span><b>${staffName}</b></div>` : "";
  const custHtml       = custName   ? `<div class="rc-div"></div>
      <div class="rc-meta-row"><span>Mijoz</span><b>${custName}</b></div>
      ${custPhone ? `<div class="rc-meta-row"><span>Telefon</span><b>${custPhone}</b></div>` : ""}` : "";

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F2F0EB;display:flex;justify-content:center;padding:20px 8px}
.rc-wrap{width:360px;max-width:100%}
.rc{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(13,27,42,.1)}

/* HEAD */
.rc-head{background:#0D1B2A;color:#fff;padding:18px 18px 14px;text-align:center}
.rc-logo{font-family:'Sora',sans-serif;font-size:22px;font-weight:800;letter-spacing:1px}
.rc-sub{font-size:10px;color:#9aa7b5;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px}

/* META */
.rc-meta{padding:11px 16px;border-bottom:1px dashed #E8E5E0;font-size:11.5px;color:#666}
.rc-meta-row{display:flex;justify-content:space-between;padding:2px 0}
.rc-meta-row b{color:#0D1B2A;font-weight:600}
.rc-div{border-top:1px solid #F0EDE8;margin:6px 0}

/* ITEMS */
.rc-items-lbl{padding:9px 16px 5px;font-size:10px;font-weight:700;color:#bbb;letter-spacing:1px;text-transform:uppercase}
.rc-items{padding:0 16px}
.rc-it{display:flex;align-items:flex-start;padding:9px 0;gap:8px}
.rc-sep{border-top:1px dashed #F0EDE8}
.rc-it-n{font-size:10.5px;color:#ccc;font-weight:700;min-width:14px;padding-top:2px}
.rc-it-info{flex:1;min-width:0}
.rc-it-name{font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#0D1B2A}
.rc-it-var{font-size:11px;color:#999;margin-top:1px}
.rc-it-calc{font-size:11px;color:#bbb;margin-top:1px}
.rc-it-box{font-size:10px;color:#c4a35a;margin-top:1px}
.rc-it-sum{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#0D1B2A;white-space:nowrap;padding-top:2px}

/* TOTAL */
.rc-total{margin:0 16px;padding:9px 0;border-top:2px solid #0D1B2A;border-bottom:1px dashed #E8E5E0;display:flex;justify-content:space-between;align-items:center}
.rc-total-lbl{font-family:'Sora',sans-serif;font-weight:700;font-size:12.5px;color:#0D1B2A;letter-spacing:.5px}
.rc-total-cnt{font-size:10px;color:#bbb;margin-top:1px}
.rc-total-val{font-family:'Sora',sans-serif;font-weight:800;font-size:19px;color:#0D1B2A}

/* PAYMENT */
.rc-pay{padding:9px 16px;background:#F9F8F6;border-bottom:1px dashed #E8E5E0}
.rc-pr{display:flex;justify-content:space-between;font-size:12.5px;color:#555;padding:2.5px 0}
.rc-pr.rc-muted span{color:#bbb!important}
.rc-pr.rc-debt{border-top:1px dashed #fca5a5;margin-top:4px;padding-top:5px;font-weight:700;color:#dc2626}
.rc-red{color:#dc2626!important}
.rc-paid{font-size:12px;font-weight:700;color:#059669;text-align:center;padding:5px 0;background:#ECFDF5;border-radius:8px;margin-top:4px}

/* FOOTER */
.rc-foot{padding:12px 16px 16px;text-align:center}
.rc-thanks{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#0D1B2A}
.rc-date{font-size:10px;color:#bbb;margin-top:2px}
.rc-bot{font-size:11px;color:#229ED9;margin-top:8px}
.rc-pdf{margin-top:6px}
.rc-pdf a{font-size:11.5px;color:#0D1B2A;font-weight:600;text-decoration:none;background:#F0EDE8;padding:5px 14px;border-radius:20px;display:inline-block}

/* ACTIONS */
.rc-actions{max-width:360px;margin:10px auto 0;display:flex;gap:8px}
.rc-actions button{flex:1;border:none;border-radius:10px;padding:11px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}
.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #E8E5E0!important}
@media print{
  body{background:#fff;padding:0}
  .rc-wrap,.rc{border-radius:0;box-shadow:none;width:72mm}
  .rc-actions{display:none}
}
</style></head><body>
<div class="rc-wrap">
  <div class="rc">
    <div class="rc-head">
      <div class="rc-logo">${shopName.toUpperCase()}</div>
      <div class="rc-sub">Savdo cheki</div>
    </div>

    <div class="rc-meta">
      <div class="rc-meta-row"><span>Chek</span><b>${chekNum}</b></div>
      <div class="rc-meta-row"><span>Sana / Vaqt</span><b>${date} ${time}</b></div>
      ${staffHtml}
      ${custHtml}
      ${noteHtml ? `<div class="rc-div"></div>${noteHtml}` : ""}
    </div>

    <div class="rc-items-lbl">Mahsulotlar</div>
    <div class="rc-items">${itemsHtml}</div>

    <div class="rc-total">
      <div>
        <div class="rc-total-lbl">JAMI</div>
        <div class="rc-total-cnt">${items.length} tur · ${items.reduce((a,i)=>a+(i.qty||0),0)} dona</div>
      </div>
      <div class="rc-total-val">${fmtN(total)}<span style="font-size:12px;font-weight:600"> so'm</span></div>
    </div>

    <div class="rc-pay">
      <div class="rc-pr"><span>To'lov turi</span><b style="color:#0D1B2A">${payLabels[payType] || payType || "—"}</b></div>
      ${discHtml}
      <div class="rc-pr"><span>To'landi</span><span style="color:#059669;font-weight:700">${fmtN(paid)} so'm</span></div>
      ${debtHtml}
    </div>

    <div class="rc-foot">
      <div class="rc-thanks">Rahmat! Yana kutamiz 🙏</div>
      <div class="rc-date">${shopName} · ${date}</div>
      ${footerBotHtml}
      ${footerPdfHtml}
    </div>
  </div>
  <div class="rc-actions">
    <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
    <button class="btn-c" onclick="window.close ? window.close() : history.back()">Yopish</button>
  </div>
</div>
</body></html>`;
}
