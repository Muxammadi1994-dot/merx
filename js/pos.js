// ================================================
// MERX — js/pos.js
// ================================================

let cart = [], posPayMode = "full", posPayType = "naqd", posPriceType = "chakana";
let posActiveCat = "Barchasi", vmProd = null, selColor = null, selSize = null;

function renderPosGrid() {
  const q = ($("pos-q")||{value:""}).value.toLowerCase();
  const ps = visProds();
  const allCats = ["Barchasi", ...new Set(ps.map(p => p.category))];
  $("pos-cats").innerHTML = allCats.map(c =>
    `<span class="pcat${c===posActiveCat?" on":""}" onclick="posSetCat(this,'${c.replace(/'/g,"\\'")}')"> ${c}</span>`
  ).join("");
  const filtered = ps.filter(p => (!q || p.name.toLowerCase().includes(q)) && (posActiveCat === "Barchasi" || p.category === posActiveCat));
  $("pos-grid").innerHTML = filtered.map(p => {
    const narx = posPriceType === "ulgurji" ? (p.ulgurjiNarx || p.priceUzs) : p.priceUzs;
    const st = totalStock(p);
    return `<div class="pc" onclick="openVariantModal('${p.sku}')">
      <div class="pn">${p.name}</div>
      <div class="pm">${p.category}</div>
      <div class="pp">${priceDisplay(narx)} <span class="pu">/ ${p.unit||"dona"}</span></div>
      ${p.ulgurjiNarx && posPriceType !== "ulgurji" ? `<div class="pc-ulg">Ulgurji: ${priceDisplay(p.ulgurjiNarx)}</div>` : ""}
      <div class="ps ${st<=3?"text-red":""}">${st} ${p.unit||"dona"} qoldiq</div>
    </div>`;
  }).join("") || `<div style="color:var(--mut);padding:22px;font-size:13px">Topilmadi</div>`;
}

function posSetCat(el, c) {
  posActiveCat = c;
  document.querySelectorAll(".pcat").forEach(x => x.classList.remove("on"));
  el.classList.add("on");
  renderPosGrid();
}

function setPriceType(t) {
  posPriceType = t;
  document.querySelectorAll("#price-type-seg button").forEach(b => b.classList.toggle("on", b.dataset.pt === t));
  renderPosGrid(); renderCart();
}

function openVariantModal(sku) {
  vmProd = db.products.find(p => p.sku === sku); if (!vmProd) return;
  selColor = null; selSize = null;
  $("vm-title").textContent = vmProd.name;
  $("vm-qty").value = 1;
  renderVmChips(); openModal("variant");
}

function renderVmChips() {
  const colors = [...new Set(vmProd.variants.map(v => v.color))];
  const sizes  = [...new Set(vmProd.variants.map(v => v.size))];
  $("vm-colors").innerHTML = colors.map(c =>
    `<div class="vchip${vmProd.variants.some(v => v.color===c && v.qty>0)?"":" out"}${c===selColor?" on":""}" onclick="vmSel('c','${c.replace(/'/g,"\\'")}')"> ${c}</div>`
  ).join("");
  $("vm-sizes").innerHTML = sizes.map(s =>
    `<div class="vchip${(!selColor || vmProd.variants.some(v => v.size===s && v.color===selColor && v.qty>0))?"":" out"}${s===selSize?" on":""}" onclick="vmSel('s','${s.replace(/'/g,"\\'")}')"> ${s}</div>`
  ).join("");
  const v = selColor && selSize ? vmProd.variants.find(x => x.color===selColor && x.size===selSize) : null;
  const narx = posPriceType === "ulgurji" ? (vmProd.ulgurjiNarx||vmProd.priceUzs) : vmProd.priceUzs;
  const qty = parseInt(($("vm-qty")||{value:1}).value) || 1;
  $("vm-info").textContent = v ? `Qoldiq: ${v.qty} ${vmProd.unit||"dona"}` : selColor ? "O'lcham tanlang" : "Rang tanlang";
  if ($("vm-price-lbl")) $("vm-price-lbl").textContent = (posPriceType==="ulgurji"?"Ulgurji":"Chakana") + " narx × " + qty + ":";
  if ($("vm-price-val")) $("vm-price-val").textContent = priceDisplay(narx * qty);
}

function vmSel(t, v) { if (t === "c") { selColor = v; selSize = null; } else selSize = v; renderVmChips(); }

function confirmVariant() {
  if (!selColor || !selSize) { toast("Rang va o'lchamni tanlang","err"); return; }
  const v = vmProd.variants.find(x => x.color===selColor && x.size===selSize);
  if (!v || v.qty <= 0) { toast("Bu variant tugagan","err"); return; }
  const qty = Math.max(1, parseInt(($("vm-qty")||{value:1}).value) || 1);
  if (qty > v.qty) { toast(`Faqat ${v.qty} ${vmProd.unit||"dona"} bor`,"err"); return; }
  const narx = posPriceType === "ulgurji" ? (vmProd.ulgurjiNarx||vmProd.priceUzs) : vmProd.priceUzs;
  const ex = cart.find(c => c.sku===vmProd.sku && c.color===selColor && c.size===selSize);
  if (ex) ex.qty += qty; else cart.push({ sku:vmProd.sku, name:vmProd.name, color:selColor, size:selSize, unit:vmProd.unit||"dona", price:narx, priceType:posPriceType, qty });
  closeModal("variant"); renderCart();
  toast(`${vmProd.name} (${selColor}/${selSize}) × ${qty} savatchaga qo'shildi`);
}

function renderCart() {
  $("cart-cnt").textContent = cart.length ? cart.reduce((a, c) => a + c.qty, 0) + " ta" : "bo'sh";
  const total = cart.reduce((a, c) => a + c.price * c.qty, 0);
  if (!cart.length) {
    $("cart-items").innerHTML = `<div class="cart-mt"><i class="ti ti-shopping-cart"></i><p style="font-size:13px">Mahsulot tanlang</p></div>`;
    $("cart-total").textContent = "0 so'm"; updateRem(); return;
  }
  $("cart-items").innerHTML = cart.map((c, i) => `<div class="ci">
    <div class="ci-inf">
      <div class="ci-nm">${c.name}</div>
      <div class="ci-vr">${c.color} / ${c.size} · <span class="bg bg-t" style="font-size:10px;padding:1px 6px">${c.unit}</span></div>
      <div class="ci-row">
        <div class="qty-ctrl">
          <button onclick="ciQty(${i},-1)">−</button>
          <input type="number" value="${c.qty}" min="1" oninput="ciQtySet(${i},+this.value)" style="width:38px;text-align:center;border:none;outline:none;font-weight:600">
          <button onclick="ciQty(${i},1)">+</button>
        </div>
        <span class="ci-pr">${priceDisplay(c.price * c.qty)}</span>
        <button class="ci-rm" onclick="removeFromCart(${i})"><i class="ti ti-x"></i></button>
      </div>
    </div>
  </div>`).join("");
  $("cart-total").textContent = priceDisplay(total); updateRem();
}

function ciQty(i, d) { cart[i].qty = Math.max(1, cart[i].qty + d); renderCart(); }

function ciQtySet(i, v) { cart[i].qty = Math.max(1, v || 1); renderCart(); }

function removeFromCart(i) { cart.splice(i, 1); renderCart(); }

function clearCart() { cart = []; renderCart(); }

function setPayType(t) {
  posPayType = t;
  document.querySelectorAll(".ptbtn").forEach(b => b.classList.toggle("on", b.dataset.pt === t));
}

function setPayMode(m) {
  posPayMode = m;
  document.querySelectorAll(".pmode-btn").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  $("part-box").style.display = m === "part" ? "block" : "none";
  if (m === "part") {
    refreshCustList();
    if ($("c-due") && !$("c-due").value) $("c-due").value = addDays(today(), 30);
  }
}

function updateRem() {
  const total = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const paid  = parseFloat(($("c-paid")||{value:0}).value) || 0;
  if ($("rem-view")) $("rem-view").textContent = fmt(Math.max(0, total - paid)) + " so'm";
}

async function checkout() {
  if (!cart.length) { toast("Savatcha bo'sh","err"); return; }
  const total = cart.reduce((a, c) => a + c.price * c.qty, 0);
  let paid = total, rem = 0, due = "", cName = "", cPhone = "", status = "tolandan";
  if (posPayMode === "part") {
    cName = ($("c-name")||{value:""}).value.trim();
    if (!cName) { toast("Mijoz ismini kiriting","err"); return; }
    cPhone = ($("c-phone")||{value:""}).value.trim();
    paid = parseFloat(($("c-paid")||{value:0}).value) || 0;
    due  = ($("c-due")||{value:""}).value;
    rem  = Math.max(0, total - paid);
    status = rem > 0 ? "qarz" : "tolandan";
  }
  const staffId = parseInt(($("pos-staff")||{value:0}).value) || null;
  // Decrement stock
  cart.forEach(c => {
    const p = db.products.find(x => x.sku === c.sku);
    if (p) { const v = p.variants.find(x => x.color===c.color && x.size===c.size); if (v) v.qty = Math.max(0, v.qty - c.qty); }
  });
  const newSale = { id:db.seq++, date:today(), time:nowTime(), priceType:cart[0]?.priceType||"chakana",
    payType:posPayType, staffId, items:cart.map(c => ({name:c.name, variant:`${c.color} / ${c.size}`, qty:c.qty, price:c.price, unit:c.unit})),
    total, paid, remaining:rem, due, customerName:cName, customerPhone:cPhone, status };
  db.sales.push(newSale); saveDB();
  // SMS
  const smsText = rem > 0
    ? `MERX: Xaridingiz uchun rahmat! Jami: ${fmt(total)} so'm. To'landi: ${fmt(paid)} so'm. Qolgan qarz: ${fmt(rem)} so'm. Sana: ${due||"—"}.`
    : `MERX: Xaridingiz uchun rahmat! Jami: ${fmt(total)} so'm (${PAYTYPES[posPayType]||"to'liq"}) qabul qilindi.`;
  await sendSms(cPhone || "Mijoz", smsText);
  // Reset
  cart = []; renderCart(); setPayMode("full");
  if ($("c-name"))  $("c-name").value = "";
  if ($("c-phone")) $("c-phone").value = "";
  if ($("c-paid"))  $("c-paid").value = "0";
  if ($("c-due"))   $("c-due").value = "";
  if ($("c-cust"))  $("c-cust").value = "";
  $("debt-count").textContent = debtSales().length;
  if (confirm("Chek chiqarilsinmi?")) printReceipt(newSale.id);
}