// ================================================
// MERX — js/tarix.js
// ================================================

function renderTarix() {
  const q = ($("tarix-q")||{value:""}).value.toLowerCase();
  const list = db.sales.slice().reverse().filter(s =>
    !q || s.items.some(i => i.name.toLowerCase().includes(q)) || (s.customerName||"").toLowerCase().includes(q));
  $("tarix-body").innerHTML = list.length ? list.map(s => `<tr>
    <td style="color:var(--mut);font-size:11px">#${s.id}</td>
    <td style="font-size:12px">${s.date}<br><span style="color:var(--mut)">${s.time||""}</span></td>
    <td style="font-size:12.5px">${s.items.map(i => `${i.name} ×${i.qty}`).join("<br>")}</td>
    <td>${s.customerName||"—"}</td>
    <td><span class="bg bg-b">${PAYTYPES[s.payType]||"—"}</span></td>
    <td><span class="bg ${s.priceType==="ulgurji"?"bg-a":"bg-gr"}">${s.priceType==="ulgurji"?"Ulgurji":"Chakana"}</span></td>
    <td class="num" style="font-weight:600">${fmt(s.total)}</td>
    <td class="num" style="color:var(--grn)">${fmt(s.paid)}</td>
    <td class="num" style="color:${s.remaining>0?"var(--red)":"var(--mut)"}">${fmt(s.remaining)}</td>
    <td><span class="bg ${s.status==="qarz"?"bg-a":"bg-g"}">${s.status==="qarz"?"Qarzda":"To'langan"}</span></td>
    <td><button class="btn btn-ghost btn-icon btn-sm" onclick="printReceipt(${s.id})" title="Chek"><i class="ti ti-printer"></i></button></td>
  </tr>`).join("") : `<tr><td colspan="11" class="empty-td">Sotuv topilmadi</td></tr>`;
}

function printReceipt(id) {
  const s = db.sales.find(x => x.id === id); if (!s) return;
  const w = window.open("","_blank","width=420,height=640");
  if (!w) { toast("Pop-up bloklangan. Brauzer sozlamalarini tekshiring.","err"); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Chek #${s.id}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;font-size:13px;padding:18px;color:#111;max-width:310px;margin:0 auto}
  h1{font-size:22px;font-weight:700;text-align:center;letter-spacing:-.3px}.sub{text-align:center;font-size:11px;color:#666;margin:2px 0 12px}
  hr{border:none;border-top:1px dashed #ccc;margin:10px 0}
  .meta{font-size:11px;color:#666;margin-bottom:10px}.meta div{display:flex;justify-content:space-between;padding:1.5px 0}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  th{text-align:left;font-size:10px;color:#888;padding:3px 0;border-bottom:1px solid #eee;text-transform:uppercase}
  td{padding:5px 0;font-size:12px;border-bottom:1px solid #f5f5f5}td:last-child{text-align:right}
  .totals div{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
  .big{font-size:16px;font-weight:700}.red{color:#DC2626}.grn{color:#059669}
  .foot{text-align:center;margin-top:14px;font-size:11px;color:#999}
  @media print{body{padding:6px}}</style></head><body>
  <h1>MERX</h1><p class="sub">${db.shop.name}</p><hr>
  <div class="meta">
    <div><span>Chek #</span><span>${s.id}</span></div>
    <div><span>Sana</span><span>${s.date} ${s.time||""}</span></div>
    <div><span>To'lov turi</span><span>${PAYTYPES[s.payType]||"—"}</span></div>
    <div><span>Narx turi</span><span>${s.priceType==="ulgurji"?"Ulgurji":"Chakana"}</span></div>
    ${s.customerName?`<div><span>Mijoz</span><span>${s.customerName}</span></div>`:""}
    ${s.customerPhone?`<div><span>Tel</span><span>${s.customerPhone}</span></div>`:""}
  </div><hr>
  <table><thead><tr><th>Mahsulot</th><th>Variant</th><th>Son</th><th>Narx</th></tr></thead>
  <tbody>${s.items.map(i=>`<tr><td>${i.name}</td><td>${i.variant}</td><td>${i.qty}${i.unit?" "+i.unit:""}</td><td>${(i.price*i.qty).toLocaleString("ru-RU")}</td></tr>`).join("")}</tbody></table><hr>
  <div class="totals">
    <div><span>Jami</span><span class="big">${s.total.toLocaleString("ru-RU")} so'm</span></div>
    <div><span>To'landi</span><span class="grn">${s.paid.toLocaleString("ru-RU")} so'm</span></div>
    ${s.remaining>0?`<div><span>Qolgan qarz</span><span class="red">${s.remaining.toLocaleString("ru-RU")} so'm</span></div>`:""}
    ${s.due?`<div><span>To'lov sanasi</span><span>${s.due}</span></div>`:""}
  </div><hr>
  <div class="foot"><p>Xaridingiz uchun rahmat!</p><p style="margin-top:4px">MERX savdo platformasi</p></div>
  <script>window.onload=()=>window.print();<\\/script></body></html>`);
  w.document.close();
}