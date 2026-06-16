// ════════════════════════════════════════════════
// MERX — Universal chek HTML builder  v2.0
// ════════════════════════════════════════════════

function buildReceiptHtml(sale, opts) {
  opts = opts || {};
  const shopName   = opts.shopName   || (typeof db !== "undefined" && db.shop?.name) || "MERX";
  const staffName  = opts.staffName  || "—";
  const botUser    = (opts.botUsername || "").replace(/^@/, "");
  const receiptUrl = opts.receiptUrl || "";

  // ── Maydonlar normalizatsiyasi ─────────────────
  const chekNum   = sale.chekNum    || sale.chek_num    || ("#" + sale.id);
  const date      = sale.date       || "";
  const time      = sale.time       || "";
  const payType   = sale.payType    || sale.pay_type    || "";
  const custName  = sale.customerName || sale.customer_name || "";
  const custPhone = sale.customerPhone || sale.customer_phone || "";
  const total     = Number(sale.total     || 0);
  const paid      = Number(sale.paid      || 0);
  const remaining = Number(sale.remaining || 0);
  const discount  = Number(sale.discount  || 0);
  const due       = sale.due  || "";
  const note      = sale.note || "";
  const debtCur   = sale.debtCurrency || sale.debt_currency || "uzs";
  const debtUsd   = sale.debtUsd   != null ? Number(sale.debtUsd)      : (sale.debt_usd   != null ? Number(sale.debt_usd)   : null);
  const prevUsd   = sale.prevDebtUsd != null ? Number(sale.prevDebtUsd) : null;
  const prevUzs   = sale.prevDebtUzs != null ? Number(sale.prevDebtUzs) : null;
  const isUsd     = debtCur === "usd" && debtUsd != null;
  const items     = (sale.items || []).filter(Boolean);

  const payLabels = { naqd: "Naqd pul", karta: "Karta", otkazma: "Bank o'tkazmasi" };
  const F = n => Math.round(n || 0).toLocaleString("ru-RU");

  // ── Mahsulotlar ───────────────────────────────
  const itemsHtml = items.map((i, idx) => {
    const sum    = (i.price || 0) * (i.qty || 0);
    const sku    = i.sku ? `<span class="it-sku">SKU: ${i.sku}</span>` : "";
    const boxRow = i.qtyBox && i.inBox
      ? `<div class="it-box">${i.qtyBox} karobka × ${F((i.price||0)*(i.inBox||1))} so'm/karobka</div>` : "";
    return `
      <div class="it">
        <div class="it-num">${idx + 1}</div>
        <div class="it-body">
          <div class="it-top">
            <div class="it-name">${i.name || ""}${sku}</div>
            <div class="it-sum">${F(sum)}</div>
          </div>
          <div class="it-det">${i.variant || ""} &nbsp;·&nbsp; ${i.qty} ${i.unit || "dona"} × ${F(i.price)} so'm</div>
          ${boxRow}
        </div>
      </div>`;
  }).join('<div class="sep-dash"></div>');

  // ── To'lov bo'limi ────────────────────────────
  const discHtml = discount > 0
    ? `<div class="pr"><span>Chegirma</span><span class="c-red">− ${F(discount)} so'm</span></div>` : "";

  let debtHtml = "";
  if (remaining > 0) {
    if (isUsd && prevUsd > 0) {
      const tot = prevUsd + debtUsd;
      debtHtml = `
        <div class="sep-dash" style="margin:6px 0"></div>
        <div class="pr pr-sm"><span>Xariddan oldingi qarz</span><span>$${prevUsd.toFixed(2)}</span></div>
        <div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>$${debtUsd.toFixed(2)}</span></div>
        <div class="pr pr-debt"><span>Xariddan keyingi qarz</span><span>$${tot.toFixed(2)} USD</span></div>`;
    } else if (!isUsd && prevUzs > 0) {
      const tot = prevUzs + remaining;
      debtHtml = `
        <div class="sep-dash" style="margin:6px 0"></div>
        <div class="pr pr-sm"><span>Xariddan oldingi qarz</span><span>${F(prevUzs)} so'm</span></div>
        <div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>${F(remaining)} so'm</span></div>
        <div class="pr pr-debt"><span>Xariddan keyingi qarz</span><span>${F(prevUzs + remaining)} so'm</span></div>`;
    } else {
      const amt = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${F(remaining)} so'm`;
      debtHtml = `<div class="pr pr-debt"><span>Qarzga</span><span>${amt}</span></div>`;
    }
    if (due) debtHtml += `<div class="pr pr-sm"><span>To'lov muddati</span><span class="c-red">${due}</span></div>`;
  } else {
    debtHtml = `<div class="paid-ok">✓ To'liq to'landi</div>`;
  }

  const botHtml  = botUser    ? `<div class="ft-bot">Cheklarni Telegramda olish: <b>@${botUser}</b></div>` : "";
  const pdfHtml  = receiptUrl ? `<div class="ft-pdf"><a href="${receiptUrl}" target="_blank">📄 Chekni yuklab olishingiz mumkin</a></div>` : "";
  const noteHtml = note       ? `<div class="note-wrap"><span class="note-lbl">Izoh</span><span>${note}</span></div>` : "";

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F2F0EB;display:flex;justify-content:center;padding:20px 8px}
.wrap{width:340px;max-width:100%}
.rc{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(13,27,42,.12)}

/* HEAD */
.hd{background:#0D1B2A;padding:18px 20px 14px;text-align:center;color:#fff}
.hd-logo{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;letter-spacing:1.5px}
.hd-sub{font-size:9.5px;color:#9aa7b5;letter-spacing:2px;text-transform:uppercase;margin-top:3px}

/* META */
.meta{padding:10px 16px;font-size:11.5px;border-bottom:1px dashed #E8E5E0}
.mr{display:flex;justify-content:space-between;padding:2px 0;color:#555}
.mr b{color:#0D1B2A;font-weight:600;text-align:right;max-width:60%}
.sep{border-top:1px solid #F0EDE8;margin:5px 0}

/* NOTE */
.note-wrap{padding:7px 16px;background:#FFFBEB;border-bottom:1px dashed #FDE68A;font-size:11.5px;color:#92400E;display:flex;gap:8px}
.note-lbl{font-weight:700;white-space:nowrap}

/* ITEMS */
.it-lbl{padding:8px 16px 4px;font-size:9.5px;font-weight:700;color:#bbb;letter-spacing:1.5px;text-transform:uppercase}
.items{padding:0 16px}
.it{display:flex;gap:8px;padding:9px 0;align-items:flex-start}
.it-num{font-size:10px;color:#ccc;font-weight:700;min-width:13px;padding-top:3px}
.it-body{flex:1;min-width:0}
.it-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.it-name{font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#0D1B2A;flex:1}
.it-sku{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:500;color:#bbb;display:block;margin-top:1px}
.it-sum{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#0D1B2A;white-space:nowrap}
.it-det{font-size:11px;color:#bbb;margin-top:2px}
.it-box{font-size:10.5px;color:#C4943A;margin-top:2px}
.sep-dash{border-top:1px dashed #F0EDE8}

/* JAMI */
.tot{margin:0 16px;padding:9px 0;border-top:2px solid #0D1B2A;border-bottom:1px dashed #E8E5E0;display:flex;justify-content:space-between;align-items:center}
.tot-lbl{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#0D1B2A;letter-spacing:.5px}
.tot-cnt{font-size:9.5px;color:#bbb;margin-top:2px;font-weight:400}
.tot-val{font-family:'Sora',sans-serif;font-weight:800;font-size:20px;color:#0D1B2A}
.tot-uzs{font-size:12px;font-weight:600}

/* TO'LOV */
.pay{padding:9px 16px 10px;border-bottom:1px dashed #E8E5E0}
.pay-lbl{font-size:9.5px;font-weight:700;color:#bbb;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.pr{display:flex;justify-content:space-between;font-size:12.5px;color:#555;padding:2.5px 0}
.pr.pr-sm{font-size:11px;color:#aaa}
.pr.pr-sm span:last-child{color:#aaa}
.pr.pr-debt{border-top:1px dashed #fca5a5;margin-top:3px;padding-top:5px;font-weight:700;color:#dc2626;font-size:13px}
.c-red{color:#dc2626!important;font-weight:600}
.paid-ok{text-align:center;background:#ECFDF5;color:#059669;font-weight:700;font-size:12px;border-radius:8px;padding:6px;margin-top:4px}

/* FOOTER */
.ft{padding:12px 16px 16px;text-align:center}
.ft-thanks{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#0D1B2A}
.ft-date{font-size:10px;color:#bbb;margin-top:2px}
.ft-bot{font-size:11px;color:#229ED9;margin-top:8px;line-height:1.4}
.ft-pdf{margin-top:5px}
.ft-pdf a{font-size:11.5px;color:#0D1B2A;font-weight:600;text-decoration:none;background:#F0EDE8;padding:5px 14px;border-radius:20px;display:inline-block}

/* ACTIONS */
.acts{max-width:340px;margin:10px auto 0;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:10px;padding:11px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}
.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #E8E5E0!important}
@media print{
  body{background:#fff;padding:0}
  .wrap,.rc{border-radius:0;box-shadow:none;width:72mm;max-width:72mm}
  .acts{display:none}
}
</style></head><body>
<div class="wrap">
  <div class="rc">

    <div class="hd">
      <div class="hd-logo">${shopName.toUpperCase()}</div>
      <div class="hd-sub">Savdo cheki</div>
    </div>

    <div class="meta">
      <div class="mr"><span>Chek raqami</span><b>${chekNum}</b></div>
      <div class="mr"><span>Sana / Vaqt</span><b>${date} ${time}</b></div>
      ${staffName && staffName !== "—" ? `<div class="mr"><span>Kassir</span><b>${staffName}</b></div>` : ""}
      ${custName ? `<div class="sep"></div>
      <div class="mr"><span>Mijoz</span><b>${custName}</b></div>
      ${custPhone ? `<div class="mr"><span>Telefon</span><b>${custPhone}</b></div>` : ""}` : ""}
    </div>

    ${noteHtml}

    <div class="it-lbl">Mahsulotlar</div>
    <div class="items">
      ${itemsHtml}
    </div>

    <div class="tot">
      <div>
        <div class="tot-lbl">JAMI</div>
        <div class="tot-cnt">${items.length} tur · ${items.reduce((a,i)=>a+(+i.qty||0),0)} dona</div>
      </div>
      <div class="tot-val">${F(total)}<span class="tot-uzs"> so'm</span></div>
    </div>

    <div class="pay">
      <div class="pay-lbl">To'lov</div>
      <div class="pr"><span>To'lov turi</span><b style="color:#0D1B2A">${payLabels[payType]||payType||"—"}</b></div>
      ${discHtml}
      <div class="pr"><span>To'landi</span><span style="color:#059669;font-weight:700">${F(paid)} so'm</span></div>
      ${debtHtml}
    </div>

    <div class="ft">
      <div class="ft-thanks">Rahmat! Yana kutamiz 🙏</div>
      <div class="ft-date">${shopName} · ${date}</div>
      ${botHtml}
      ${pdfHtml}
    </div>

  </div>
  <div class="acts">
    <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
    <button class="btn-c" onclick="window.close?window.close():history.back()">Yopish</button>
  </div>
</div>
</body></html>`;
}
