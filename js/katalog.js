// ================================================
// MERX — js/katalog.js
// ================================================

let editSku = null;

function renderKatalog() {
  const q = ($("kat-q")||{value:""}).value.toLowerCase();
  const ps = db.products.filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  $("katalog-body").innerHTML = ps.length ? ps.map(p => {
    const st = totalStock(p);
    const chips = p.variants.map(v =>
      `<span class="vb ${v.qty<=3?"lo":""}">${v.color}/${v.size}: ${v.qty}</span>`
    ).join("");
    return `<tr>
      <td style="font-size:11px;color:var(--mut)">${p.sku}</td>
      <td style="font-weight:600">${p.name}</td>
      <td><span class="bg bg-t">${p.unit||"dona"}</span></td>
      <td><span class="bg bg-gr">${p.category}</span></td>
      <td><div class="vsum">${chips}</div></td>
      <td style="font-size:12.5px">$${p.costUsd}</td>
      <td class="num" style="color:var(--teal);font-weight:600">${priceDisplay(p.priceUzs)}</td>
      <td class="num" style="color:var(--acc);font-weight:600">${priceDisplay(p.ulgurjiNarx||0)}</td>
      <td><span class="bg ${st<=5?"bg-r":"bg-g"}">${st} ${p.unit||"dona"}</span></td>
      <td><button class="btn btn-ghost btn-icon btn-sm" onclick="openEditProduct('${p.sku}')"><i class="ti ti-edit"></i></button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="10" class="empty-td">Mahsulot topilmadi</td></tr>`;
}

function openEditProduct(sku) {
  const p = db.products.find(x => x.sku === sku); if (!p) return;
  editSku = sku;
  $("ep-title").textContent = p.name + " — tahrirlash";
  $("ep-name").value = p.name; $("ep-cat").value = p.category;
  $("ep-cost").value = p.costUsd; $("ep-price").value = p.priceUzs;
  $("ep-ulgurji").value = p.ulgurjiNarx || 0;
  if ($("ep-unit")) $("ep-unit").value = p.unit || "dona";
  renderEpVariants(p); openModal("editprod");
}

function renderEpVariants(p) {
  $("ep-variants").innerHTML = p.variants.map((v, i) => `<tr>
    <td><input value="${v.color}" id="epv-c-${i}"></td>
    <td><input value="${v.size}" id="epv-s-${i}" style="width:70px"></td>
    <td><input type="number" value="${v.qty}" id="epv-q-${i}" min="0" style="width:80px"></td>
    <td><button class="btn btn-ghost btn-icon btn-sm" onclick="epDelVariant(${i})"><i class="ti ti-trash" style="color:var(--red)"></i></button></td>
  </tr>`).join("");
}

function epAddVariantRow() {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  p.variants.push({ color:"", size:"", qty:0 }); renderEpVariants(p);
}

function epDelVariant(i) {
  const p = db.products.find(x => x.sku === editSku);
  if (!p || p.variants.length <= 1) { toast("Kamida 1 ta variant kerak", "err"); return; }
  if (!confirm("Bu variantni o'chirasizmi?")) return;
  p.variants.splice(i, 1); renderEpVariants(p);
}

function saveEditProduct() {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  p.name     = $("ep-name").value.trim() || p.name;
  p.category = $("ep-cat").value.trim() || p.category;
  p.costUsd  = parseFloat($("ep-cost").value) || p.costUsd;
  p.priceUzs = parseFloat($("ep-price").value) || p.priceUzs;
  p.ulgurjiNarx = parseFloat($("ep-ulgurji").value) || 0;
  if ($("ep-unit")) p.unit = $("ep-unit").value || p.unit;
  p.variants.forEach((v, i) => {
    v.color = ($("epv-c-"+i)||{value:v.color}).value.trim() || v.color;
    v.size  = ($("epv-s-"+i)||{value:v.size}).value.trim()  || v.size;
    v.qty   = parseInt(($("epv-q-"+i)||{value:v.qty}).value) || 0;
  });
  p.variants = p.variants.filter(v => v.color && v.size);
  saveDB(); closeModal("editprod"); renderKatalog();
  toast(`"${p.name}" saqlandi`);
}

function deleteProduct() {
  const p = db.products.find(x => x.sku === editSku); if (!p) return;
  if (!confirm(`"${p.name}" ni o'chirasizmi? Bu amalni qaytarib bo'lmaydi.`)) return;
  db.products = db.products.filter(x => x.sku !== editSku);
  saveDB(); closeModal("editprod"); renderKatalog();
  toast(`"${p.name}" o'chirildi`, "info");
}

function apTypeChange() {
  const t = ($("ap-type")||{value:"oyoq"}).value;
  if ($("ap-cat")) $("ap-cat").innerHTML = (CATS[t]||[]).map(c => `<option>${c}</option>`).join("");
  if ($("ap-size")) $("ap-size").innerHTML = (SIZES[t]||[]).map(s => `<option>${s}</option>`).join("");
  apCostNote();
}

function apCostNote() {
  const c = parseFloat(($("ap-cost")||{value:0}).value) || 0;
  const r = db.settings.rate || 1;
  if ($("ap-cost-note")) $("ap-cost-note").textContent = c ? `Tannarx so'mda: $${c} × ${fmt(r)} = ${fmt(c*r)} so'm` : "";
}

function addProduct() {
  const name = ($("ap-name")||{value:""}).value.trim(); if (!name) { toast("Nom kiriting","err"); return; }
  const t     = ($("ap-type")||{value:"oyoq"}).value;
  const color = ($("ap-color")||{value:"-"}).value.trim() || "-";
  const size  = ($("ap-size")||{value:""}).value;
  const qty   = parseInt(($("ap-qty")||{value:0}).value) || 0;
  const cost  = parseFloat(($("ap-cost")||{value:0}).value) || 0;
  const price = parseFloat(($("ap-price")||{value:0}).value) || 0;
  const ulg   = parseFloat(($("ap-ulgurji")||{value:0}).value) || 0;
  const unit  = ($("ap-unit")||{value:"dona"}).value;
  const inBox = parseInt(($("ap-inbox")||{value:1}).value) || 1;
  let p = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (p) {
    const ex = p.variants.find(v => v.color === color && v.size === size);
    if (ex) ex.qty += qty; else p.variants.push({ color, size, qty });
  } else {
    db.products.push({ sku:`${t==="oyoq"?"SHOE":"CLTH"}-${String(db.seq++).padStart(3,"0")}`,
      name, category:($("ap-cat")||{value:""}).value, type:t, unit, inBox,
      costUsd:cost, priceUzs:price, ulgurjiNarx:ulg, variants:[{color, size, qty}] });
  }
  saveDB(); closeModal("addprod"); renderKatalog();
  toast(`"${name}" qo'shildi`);
  if ($("ap-name")) $("ap-name").value = "";
  if ($("ap-color")) $("ap-color").value = "";
  if ($("ap-qty")) $("ap-qty").value = "10";
}