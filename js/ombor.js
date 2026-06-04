// ================================================
// MERX — js/ombor.js
// ================================================

function renderOmbor() {
  const q = ($("om-q")||{value:""}).value.toLowerCase();
  const t = today(), m = t.slice(0, 7);
  const todayIn  = db.ombor.filter(o => o.date === t).reduce((a, o) => a + o.qty, 0);
  const monthVal = db.ombor.filter(o => o.date.startsWith(m)).reduce((a, o) => a + (o.kirimNarxi||0) * o.qty, 0);
  const supDebt  = db.ombor.filter(o => o.payStatus === "qarz").reduce((a, o) => a + (o.kirimNarxi||0) * o.qty, 0);
  const totalVal = db.products.reduce((a, p) => a + p.variants.reduce((b, v) => b + (p.costUsd*(db.settings.rate||1)) * v.qty, 0), 0);

  $("om-today").textContent  = todayIn + " dona";
  $("om-val").textContent    = fmt(monthVal) + " so'm";
  $("om-debt").textContent   = fmt(supDebt) + " so'm";
  $("om-total").textContent  = fmt(totalVal) + " so'm";

  const list = db.ombor.filter(o => !q || o.productName.toLowerCase().includes(q) || (o.supplier||"").toLowerCase().includes(q)).slice().reverse();
  $("ombor-body").innerHTML = list.length ? list.map(o => `<tr>
    <td style="font-size:12px">${o.date}</td>
    <td style="font-weight:600">${o.productName}</td>
    <td><span class="bg bg-t">${o.unit||"dona"}</span></td>
    <td>${o.color} / ${o.size}</td>
    <td><span class="bg bg-g">+${o.qty}</span></td>
    <td class="num">${o.kirimNarxi ? fmt(o.kirimNarxi)+" so'm" : "—"}</td>
    <td class="num" style="color:var(--teal)">${o.chakana ? fmt(o.chakana)+" so'm" : "—"}</td>
    <td class="num" style="font-weight:600">${o.kirimNarxi ? fmt(o.kirimNarxi*o.qty)+" so'm" : "—"}</td>
    <td>${o.supplier||"—"}</td>
    <td style="font-size:12px;color:var(--mut)">${o.partiya||"—"}</td>
    <td><span class="bg ${o.payStatus==="qarz"?"bg-r":"bg-g"}">${o.payStatus==="qarz"?"To'lanmagan":"To'langan"}</span></td>
  </tr>`).join("") : `<tr><td colspan="11" class="empty-td">Kirim yo'q</td></tr>`;
}

function qbAutofill(val) {
  $("qb-list").innerHTML = db.products.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).map(p => `<option value="${p.name}">`).join("");
  const p = db.products.find(x => x.name.toLowerCase() === val.toLowerCase());
  if (p) {
    if ($("qb-unit")) $("qb-unit").value = p.unit || "dona";
    $("qb-colors").innerHTML = [...new Set(p.variants.map(v => v.color))].map(c => `<option value="${c}">`).join("");
    $("qb-sizes").innerHTML  = [...new Set(p.variants.map(v => v.size))].map(s => `<option value="${s}">`).join("");
    $("qb-info").textContent = `Joriy: chakana ${fmt(p.priceUzs)} so'm · ulgurji ${fmt(p.ulgurjiNarx||0)} so'm · qoldiq: ${p.variants.map(v => v.color+"/"+v.size+"("+v.qty+")").join(", ")}`;
    if ($("qb-price")) $("qb-price").placeholder = fmt(p.priceUzs) + " (joriy)";
    if ($("qb-ulgurji")) $("qb-ulgurji").placeholder = fmt(p.ulgurjiNarx||0) + " (joriy)";
  } else {
    if ($("qb-info")) $("qb-info").textContent = "";
  }
}

function qabulOl() {
  const name   = ($("qb-name")||{value:""}).value.trim();   if (!name) { toast("Mahsulot nomini kiriting","err"); return; }
  const color  = ($("qb-color")||{value:""}).value.trim();  if (!color) { toast("Rang kiriting","err"); return; }
  const size   = ($("qb-size")||{value:""}).value.trim();   if (!size)  { toast("O'lcham kiriting","err"); return; }
  const qty    = parseInt(($("qb-qty")||{value:0}).value) || 0; if (qty <= 0) { toast("Miqdor kiriting","err"); return; }
  const kirimN = parseFloat(($("qb-cost")||{value:0}).value) || 0;
  const newChk = parseFloat(($("qb-price")||{value:0}).value) || 0;
  const newUlg = parseFloat(($("qb-ulgurji")||{value:0}).value) || 0;
  const unit   = ($("qb-unit")||{value:"dona"}).value;
  let p = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (p) {
    const v = p.variants.find(x => x.color === color && x.size === size);
    if (v) v.qty += qty; else p.variants.push({ color, size, qty });
    if (newChk > 0) p.priceUzs = newChk;
    if (newUlg > 0) p.ulgurjiNarx = newUlg;
    p.unit = unit;
  } else {
    db.products.push({ sku:"RECV-"+String(db.seq++).padStart(3,"0"), name, category:"Qabul qilingan",
      type:"oyoq", unit, inBox:1, costUsd:kirimN/(db.settings.rate||1), priceUzs:newChk||0, ulgurjiNarx:newUlg||0, variants:[{color, size, qty}] });
    p = db.products[db.products.length - 1];
  }
  db.ombor.push({ id:db.seq++, date:today(), sku:p.sku, productName:name, unit, color, size, qty,
    kirimNarxi:kirimN, chakana:newChk||p.priceUzs||0, ulgurji:newUlg||p.ulgurjiNarx||0,
    supplier:($("qb-sup")||{value:""}).value, partiya:($("qb-partiya")||{value:""}).value,
    payStatus:($("qb-pay")||{value:"tolandan"}).value });
  saveDB(); closeModal("qabul"); renderOmbor(); renderKatalog();
  // Clear form
  ["qb-name","qb-color","qb-size","qb-sup","qb-partiya"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("qb-qty")) $("qb-qty").value = "10";
  if ($("qb-cost")) $("qb-cost").value = "";
  if ($("qb-info")) $("qb-info").textContent = "";
  toast(`✅ ${name} (${color}/${size}) — ${qty} ${unit} qabul qilindi`);
}