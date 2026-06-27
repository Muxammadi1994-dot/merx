// ════════════════════════════════════════════════
// MERX POS v3.0
// ════════════════════════════════════════════════
let _carts=[{id:1,name:"Savatcha 1",items:[]}],_cartIdx=0,_lastSale=null,_posInited=false;
let _custId=null,_debtCur="usd",_discType="pct",_discVal=0;
let _payBlocked={},_staffLocked=false,_sidebarHidden=false;
function getCart(){return _carts[_cartIdx]||_carts[0];}
function getItems(){return getCart().items;}
function getRawVal(id){const el=$(id);if(!el)return 0;return parseFloat((el.value||"").replace(/[\s,]/g,""))||0;}

// ── Init ──
function initPos(){
  if(_posInited){refreshPosStaff();checkDebtAlerts();return;}
  _posInited=true;
  renderCartTabs();renderCart();refreshPosStaff();checkDebtAlerts();updatePayTotal();
  renderRecentProducts();
}

// ── Sidebar toggle ──
function togglePosSidebar(){
  _sidebarHidden=!_sidebarHidden;
  const nav=document.getElementById("main-nav");
  const btn=document.getElementById("pos-sidebar-btn");
  if(nav)nav.style.display=_sidebarHidden?"none":"";
  if(btn)btn.innerHTML=_sidebarHidden
    ?'<i class="ti ti-layout-sidebar-left-expand"></i>'
    :'<i class="ti ti-layout-sidebar-left-collapse"></i>';
}

// ── Qidiruv ──
function posSearch(){
  const inp=$("pos-q");if(!inp)return;
  const clr=$("pos-q-clr");
  const q=inp.value.trim();
  if(clr)clr.style.display=q?"block":"none";
  if(!q){renderRecentProducts();return;}
  const ql=q.toLowerCase();
  const rate=db.settings?.rate||12800;
  const matches=db.products.filter(p=>{
    if(!totalStock(p))return false;
    return p.name.toLowerCase().includes(ql)||
      (p.art&&p.art.toLowerCase().includes(ql))||
      (p.sku&&p.sku.toLowerCase().includes(ql))||
      (p.barcode&&p.barcode.toLowerCase()===ql)||
      (p.colorBarcodes&&Object.values(p.colorBarcodes).some(bc=>bc&&bc.toLowerCase()===ql));
  });
  const el=$("pos-results");if(!el)return;
  if(!matches.length){el.innerHTML=`<div class="pos-empty"><i class="ti ti-search-off" style="font-size:36px;color:#e0ddd8;display:block;margin-bottom:10px"></i><div style="font-size:13px;color:#bbb">"${q}" topilmadi</div></div>`;return;}
  el.innerHTML=matches.map(p=>_buildPosCard(p,rate)).join("");
}

function _buildPosCard(p,rate){
  rate=rate||db.settings?.rate||12800;
  const stock=totalStock(p);
  const price=p.priceUzs||0;
  const ulg=p.ulgurjiNarx||0;
  const colors=[...new Set(p.variants.map(v=>v.color))];
  const dots=colors.slice(0,6).map(c=>{
    const v=p.variants.find(x=>x.color===c);
    return`<span title="${c}" style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${v?.hex||"#888"};border:1px solid rgba(0,0,0,.15);vertical-align:middle"></span>`;
  }).join("")+(colors.length>6?`<span style="font-size:10px;color:#bbb">+${colors.length-6}</span>`:"");
  return`<div class="pos-ri" onclick="openVariantModal('${p.sku}')">
    <div style="width:46px;height:46px;border-radius:10px;background:#F0EDE8;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">
      ${p.image?`<img src="${p.image}" style="width:100%;height:100%;object-fit:cover">`:`<i class="ti ti-hanger" style="font-size:20px;color:#C0BBB4"></i>`}
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:13.5px;color:#0D1B2A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:3px">
        ${p.art?`<span style="font-size:11.5px;font-weight:700;color:#0D1B2A;font-family:monospace;background:#EEE9FF;padding:1px 7px;border-radius:5px">${p.art}</span>`:""}
        <span style="font-size:11px;color:#64748B;font-family:monospace">${p.sku}</span>
      </div>
      <div style="display:flex;align-items:center;gap:5px;margin-top:4px">${dots}<span style="font-size:11px;color:#94A3B8;margin-left:2px">${stock} dona</span></div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-weight:800;font-size:14px;color:#E9A500">${fmt(price)}<span style="font-size:11px;font-weight:600"> so'm</span></div>
      ${ulg?`<div style="font-size:11px;color:#64748B">Ulg: ${fmt(ulg)}</div>`:""}
    </div>
  </div>`;
}

function renderRecentProducts(){
  const el=$("pos-results");if(!el)return;
  const rate=db.settings?.rate||12800;
  const recent=db.products.filter(p=>totalStock(p)>0).slice(-12).reverse();
  if(!recent.length){el.innerHTML=`<div class="pos-empty"><i class="ti ti-shopping-bag" style="font-size:42px;color:#e0ddd8;display:block;margin-bottom:12px"></i><div style="font-size:14px;color:#bbb;font-weight:500">Mahsulot qidiring</div><div style="font-size:12px;color:#ccc;margin-top:4px">Nom, SKU yoki barcode</div></div>`;return;}
  el.innerHTML=`<div style="font-size:10.5px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:4px 2px 8px">Oxirgi mahsulotlar</div>`+recent.map(p=>_buildPosCard(p,rate)).join("");
}

function posClear(){
  const inp=$("pos-q");if(inp)inp.value="";
  const clr=$("pos-q-clr");if(clr)clr.style.display="none";
  renderRecentProducts();
}

// ── Barcode ──
let _usbBuf="",_usbTimer=null;
document.addEventListener("keydown",function(e){
  if(e.key==="Enter"&&_usbBuf.length>=3){e.preventDefault();processBarcode(_usbBuf.trim());_usbBuf="";return;}
  if(e.key.length===1&&!e.ctrlKey&&!e.altKey){_usbBuf+=e.key;clearTimeout(_usbTimer);_usbTimer=setTimeout(()=>{_usbBuf="";},120);}
  const tag=document.activeElement?.tagName;
  if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"){if(e.key==="F9"){e.preventDefault();checkout();}return;}
  if(!document.getElementById("p-pos")?.classList.contains("active"))return;
  if(e.key==="/"||e.key==="F2"){e.preventDefault();$("pos-q")?.focus();}
  if(e.key==="Escape"){["variant","receipt","barcode"].forEach(m=>closeModal(m));if($("pos-q")){$("pos-q").value="";posClear();}}
  if(e.key==="Enter"&&document.getElementById("ov-variant")?.style.display!=="none"){e.preventDefault();confirmVariant();}
  if(e.key==="F9")checkout();
});

function processBarcode(code){
  const q=code.toLowerCase();
  let p=db.products.find(x=>x.sku.toLowerCase()===q||(x.barcode&&x.barcode.toLowerCase()===q));
  let foundColor=null;
  if(!p){for(const prod of db.products){if(!prod.colorBarcodes)continue;for(const[clr,bc]of Object.entries(prod.colorBarcodes)){if(bc&&bc.toLowerCase()===q){p=prod;foundColor=clr;break;}}if(p)break;}}
  if(p){
    toast("Topildi: "+p.name+(foundColor?" -- "+foundColor:""),"info");
    if($("pos-q")){$("pos-q").value=p.art||p.sku;posSearch();}
    if(foundColor){setTimeout(()=>{document.querySelectorAll(".vm-color-btn").forEach(btn=>{if(btn.textContent.trim().toLowerCase()===foundColor.toLowerCase())btn.click();});},300);}
  }else{
    if($("pos-q")){$("pos-q").value=code;posSearch();}
    toast('Barcode: "'+code+'" -- qolda tanlang',"info");
  }
}

// ── Kamera ──
let _camStream=null,_camInterval=null,_barcodeDetector=null;
async function openBarcodeCamera(){
  try{
    if(!("BarcodeDetector"in window)){toast("Brauzer barcode skanerini qo'llab-quvvatlamaydi","err");return;}
    _barcodeDetector=new BarcodeDetector({formats:["ean_13","ean_8","code_128","code_39","qr_code","upc_a","upc_e"]});
    const vid=$("barcode-video");
    _camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
    vid.srcObject=_camStream;vid.play();openModal("barcode-cam");
    const canvas=document.createElement("canvas");
    _camInterval=setInterval(async()=>{
      if(!vid.videoWidth)return;
      canvas.width=vid.videoWidth;canvas.height=vid.videoHeight;
      canvas.getContext("2d").drawImage(vid,0,0);
      const codes=await _barcodeDetector.detect(canvas).catch(()=>[]);
      if(codes.length>0){closeBarcodeCamera();processBarcode(codes[0].rawValue);}
    },300);
  }catch(e){toast("Kamera xato: "+e.message,"err");}
}
function closeBarcodeCamera(){
  clearInterval(_camInterval);
  if(_camStream){_camStream.getTracks().forEach(t=>t.stop());_camStream=null;}
  closeModal("barcode-cam");
}

// ── Variant modal ──
let _vmSku=null,_vmColor=null,_vmSize=null;
function openVariantModal(sku){
  const p=db.products.find(x=>x.sku===sku);if(!p)return;
  _vmSku=sku;_vmColor=null;_vmSize=null;
  const el=$("vm-body");if(!el)return;
  const rate=db.settings?.rate||12800;
  const price=p.priceUzs||0;
  const ulg=p.ulgurjiNarx||0;
  const colors=[...new Set(p.variants.map(v=>v.color))];

  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:14px;padding:16px;background:#0D1B2A;border-radius:12px;margin-bottom:16px">
      <div style="width:56px;height:56px;border-radius:10px;background:#1a2d42;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">
        ${p.image?`<img src="${p.image}" style="width:100%;height:100%;object-fit:cover">`:`<i class="ti ti-hanger" style="font-size:24px;color:#64748B"></i>`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:#fff">${p.name}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          ${p.art?`<span style="font-size:12px;font-family:monospace;background:#E9A500;color:#0D1B2A;padding:2px 8px;border-radius:5px;font-weight:700">${p.art}</span>`:""}
          <span style="font-size:12px;color:#64748B;font-family:monospace">${p.sku}</span>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:800;color:#E9A500">${fmt(price)}</div>
        <div style="font-size:11px;color:#64748B">so'm</div>
        ${ulg?`<div style="font-size:11px;color:#94A3B8;margin-top:2px">Ulg: ${fmt(ulg)}</div>`:""}
      </div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:10.5px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Rang</div>
      <div id="vm-colors" style="display:flex;flex-wrap:wrap;gap:8px">
        ${colors.map(c=>{
          const v0=p.variants.find(x=>x.color===c);
          const hex=v0?.hex||"#888";
          const qty=p.variants.filter(x=>x.color===c).reduce((a,x)=>a+(x.qty||0),0);
          const bc=p.colorBarcodes?.[c]||"";
          return`<button class="vm-color-btn" data-color="${c}" onclick="vmSelectColor('${c.replace(/'/g,"\\'")}')"\n            style="display:flex;align-items:center;gap:6px;padding:7px 12px;border:2px solid #E8E5E0;border-radius:10px;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;transition:all .15s">\n            <span style="width:14px;height:14px;border-radius:4px;background:${hex};border:1px solid rgba(0,0,0,.12);flex-shrink:0"></span>\n            <span style="color:#0D1B2A">${c}</span>\n            <span style="font-size:11px;color:#94A3B8;font-weight:400">${qty}</span>\n            ${bc?`<span style="font-size:10px;color:#C0BBB4;font-family:monospace">${bc}</span>`:""}\n          </button>`;
        }).join("")}
      </div>
    </div>
    <div id="vm-sizes-wrap" style="display:none;margin-bottom:14px">
      <div style="font-size:10.5px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">O'lcham</div>
      <div id="vm-sizes" style="display:flex;flex-wrap:wrap;gap:8px"></div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:10.5px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Miqdor (pochka)</div>
      <div style="display:flex;align-items:center;gap:10px">
        <button onclick="vmQtyChange(-1)" style="width:38px;height:38px;border-radius:10px;border:2px solid #E8E5E0;background:#fff;font-size:18px;font-weight:700;cursor:pointer;color:#0D1B2A">-</button>
        <input id="vm-qty" type="number" min="1" value="1" oninput="renderVmChips()" style="width:70px;text-align:center;font-size:18px;font-weight:700;border:2px solid #E8E5E0;border-radius:10px;padding:7px;font-family:inherit;color:#0D1B2A">
        <button onclick="vmQtyChange(1)"  style="width:38px;height:38px;border-radius:10px;border:2px solid #E8E5E0;background:#fff;font-size:18px;font-weight:700;cursor:pointer;color:#0D1B2A">+</button>
        <div id="vm-qty-chips" style="display:flex;gap:5px;flex-wrap:wrap"></div>
      </div>
    </div>
    <button onclick="confirmVariant()" id="vm-add-btn" disabled
      style="width:100%;padding:13px;background:#E9A500;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .15s;opacity:.4">
      <i class="ti ti-shopping-cart-plus" style="font-size:17px"></i> Savatga qo'shish
    </button>`;
  openModal("variant");
  renderVmChips();
}

function vmSelectColor(color){
  _vmColor=color;_vmSize=null;
  document.querySelectorAll(".vm-color-btn").forEach(btn=>{
    const on=btn.dataset.color===color;
    btn.style.borderColor=on?"#E9A500":"#E8E5E0";
    btn.style.background=on?"#FFF8E7":"#fff";
  });
  const p=db.products.find(x=>x.sku===_vmSku);if(!p)return;
  const variants=p.variants.filter(v=>v.color===color&&(v.qty||0)>0);
  const sw=$("vm-sizes-wrap"),sz=$("vm-sizes");
  if(!sz)return;
  if(!variants.length){if(sw)sw.style.display="none";const b=$("vm-add-btn");if(b){b.disabled=true;b.style.opacity=".4";}toast("Bu rangda stok yo'q","err");return;}
  if(variants.every(v=>!v.size)){
    _vmSize="";if(sw)sw.style.display="none";
    const b=$("vm-add-btn");if(b){b.disabled=false;b.style.opacity="1";}
  }else{
    if(sw)sw.style.display="block";
    sz.innerHTML=variants.map(v=>`<button class="vm-size-btn" data-size="${v.size}" onclick="vmSelectSize('${v.size.replace(/'/g,"\\'")}')"\n      style="padding:7px 14px;border:2px solid #E8E5E0;border-radius:9px;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:#0D1B2A;transition:all .15s">\n      ${v.size} <span style="font-size:10.5px;color:#94A3B8;font-weight:400">(${v.qty})</span>\n    </button>`).join("");
    const b=$("vm-add-btn");if(b){b.disabled=true;b.style.opacity=".4";}
  }
  renderVmChips();
}

function vmSelectSize(size){
  _vmSize=size;
  document.querySelectorAll(".vm-size-btn").forEach(btn=>{
    const on=btn.dataset.size===size;
    btn.style.borderColor=on?"#E9A500":"#E8E5E0";
    btn.style.background=on?"#FFF8E7":"#fff";
  });
  const b=$("vm-add-btn");if(b){b.disabled=false;b.style.opacity="1";}
}

function vmQtyChange(d){const inp=$("vm-qty");if(!inp)return;inp.value=Math.max(1,(parseInt(inp.value)||1)+d);renderVmChips();}
function vmSetQty(n){if($("vm-qty")){$("vm-qty").value=n;renderVmChips();}}
function renderVmChips(){
  const el=$("vm-qty-chips");if(!el)return;
  const cur=parseInt($("vm-qty")?.value)||1;
  el.innerHTML=[1,2,3,5,10].map(n=>`<button onclick="vmSetQty(${n})" style="padding:5px 11px;border:none;border-radius:8px;background:${cur===n?"#E9A500":"#F0EDE8"};cursor:pointer;font-size:12.5px;font-weight:600;font-family:inherit;color:${cur===n?"#fff":"#0D1B2A"};transition:.15s">${n}</button>`).join("");
}

function confirmVariant(){
  const p=db.products.find(x=>x.sku===_vmSku);if(!p)return;
  if(_vmColor===null){toast("Rangni tanlang","err");return;}
  if(_vmSize===null){toast("O'lchamni tanlang","err");return;}
  const qtyBox=parseInt($("vm-qty")?.value)||1;
  const colorVars=p.variants.filter(v=>v.color===_vmColor);
  const inBox=colorVars.length||p.inBox||1;
  const totalDona=qtyBox*inBox;
  const cart=getCart();
  const key=p.sku+"|"+_vmColor+"|"+_vmSize;
  const ex=cart.items.find(i=>i._key===key);
  if(ex){ex.qty+=totalDona;ex.qtyBox=(ex.qtyBox||0)+qtyBox;}
  else{
    cart.items.push({
      _key:key,sku:p.sku,name:p.name,art:p.art||"",color:_vmColor,size:_vmSize,
      qty:totalDona,qtyBox,price:p.priceUzs||0,ulgurji:p.ulgurjiNarx||0,
      image:p.image||null,barcode:(p.colorBarcodes?.[_vmColor])||p.barcode||null,
      discount:0,discType:"pct"
    });
  }
  logPosAction("Savatga qo'shildi",`${p.name} ${_vmColor} x${qtyBox} pochka`);
  closeModal("variant");renderCart();
  toast(`${p.name} - ${_vmColor} (${qtyBox} pochka)`);
}

// ── Savatcha ──
function _itemDiscAmt(it){
  const base=it.price||0;
  const d=parseFloat((it.discount||"0").toString().replace(/\s/g,""))||0;
  if((it.discType||"pct")==="pct")return Math.round(base*d/100);
  return Math.min(d,base);
}

function renderCart(){
  const el=$("cart-items");if(!el)return;
  const items=getItems();
  if(!items.length){
    el.innerHTML=`<div class="cart-mt"><i class="ti ti-shopping-cart"></i><p style="font-size:13px">Mahsulot tanlang</p></div>`;
    updateCartTotal();return;
  }
  el.innerHTML=items.map((it,idx)=>{
    const base=it.price||0;
    const disc=_itemDiscAmt(it);
    const final=Math.max(0,base-disc);
    const total=final*it.qty;
    const hex=db.products.find(p=>p.sku===it.sku)?.variants.find(v=>v.color===it.color)?.hex||"#888";
    return`<div style="padding:11px 14px;border-bottom:1px solid #F0EDE8;display:flex;align-items:flex-start;gap:10px">
      <div style="width:42px;height:42px;border-radius:9px;background:#F0EDE8;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center">
        ${it.image?`<img src="${it.image}" style="width:100%;height:100%;object-fit:cover">`:`<span style="width:14px;height:14px;border-radius:4px;background:${hex};border:1px solid rgba(0,0,0,.1)"></span>`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;color:#0D1B2A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.name}</div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:2px">
          ${it.art?`<span style="font-size:11px;font-weight:700;color:#6B4FBB;font-family:monospace">${it.art}</span>`:""}
          <span style="width:10px;height:10px;border-radius:3px;background:${hex};border:1px solid rgba(0,0,0,.12);display:inline-block"></span>
          <span style="font-size:11.5px;color:#64748B;font-weight:600">${it.color}</span>
          ${it.size?`<span style="font-size:11px;color:#94A3B8">· ${it.size}</span>`:""}
          <span style="font-size:11px;color:#94A3B8">· ${it.qtyBox||1} pochka</span>
        </div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:5px">
          <input type="text" data-price placeholder="Chegirma" value="${it.discount||""}"
            oninput="fmtInput(this);_setItemDisc(${idx},this.value,'${it.discType||"pct"}')"
            style="width:80px;font-size:12px;border:1px solid #E8E5E0;border-radius:7px;padding:3px 7px;font-family:inherit">
          <button onclick="_toggleDiscType(${idx},'pct')" style="padding:3px 7px;border:1px solid #E8E5E0;border-radius:6px;font-size:11.5px;cursor:pointer;font-family:inherit;background:${(it.discType||"pct")==="pct"?"#E9A500":"#fff"};color:${(it.discType||"pct")==="pct"?"#fff":"#64748B"}">%</button>
          <button onclick="_toggleDiscType(${idx},'sum')" style="padding:3px 7px;border:1px solid #E8E5E0;border-radius:6px;font-size:11.5px;cursor:pointer;font-family:inherit;background:${it.discType==="sum"?"#E9A500":"#fff"};color:${it.discType==="sum"?"#fff":"#64748B"}">So'm</button>
          ${disc>0?`<span style="font-size:11px;color:#E05A5A;font-weight:600">-${fmt(disc)}</span>`:""}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-weight:800;font-size:14px;color:#0D1B2A">${fmt(total)}</div>
        <div style="font-size:10.5px;color:#94A3B8">so'm</div>
        ${disc>0?`<div style="font-size:11px;color:#94A3B8;text-decoration:line-through">${fmt(base*it.qty)}</div>`:""}
        <div style="display:flex;gap:4px;margin-top:5px;justify-content:flex-end">
          <button onclick="cartQtyChange(${idx},-1)" style="width:26px;height:26px;border:1px solid #E8E5E0;border-radius:7px;background:#fff;cursor:pointer;font-size:14px;font-weight:700;color:#64748B">-</button>
          <button onclick="cartQtyChange(${idx},1)"  style="width:26px;height:26px;border:1px solid #E8E5E0;border-radius:7px;background:#fff;cursor:pointer;font-size:14px;font-weight:700;color:#64748B">+</button>
          <button onclick="cartRemove(${idx})" style="width:26px;height:26px;border:1px solid #FEE2E2;border-radius:7px;background:#FFF5F5;cursor:pointer;font-size:12px;color:#E05A5A"><i class="ti ti-x"></i></button>
        </div>
      </div>
    </div>`;
  }).join("");
  updateCartTotal();
}

function _setItemDisc(idx,val,type){
  const it=getItems()[idx];if(!it)return;
  it.discount=parseFloat((val||"").replace(/\s/g,""))||0;
  it.discType=type;updateCartTotal();
}
function _toggleDiscType(idx,type){
  const it=getItems()[idx];if(!it)return;
  it.discType=type;renderCart();
}
function cartQtyChange(idx,d){
  const it=getItems()[idx];if(!it)return;
  const p=db.products.find(x=>x.sku===it.sku);
  const inBox=p?(p.variants.filter(v=>v.color===it.color).length||p.inBox||1):1;
  it.qty=Math.max(inBox,it.qty+d*inBox);it.qtyBox=Math.round(it.qty/inBox);
  renderCart();
}
function cartRemove(idx){
  const items=getCart().items;
  const name=items[idx]?.name||"";
  items.splice(idx,1);logPosAction("Savatdan o'chirildi",name);renderCart();
}
function clearCart(){
  if(!getItems().length)return;
  if(!confirm("Savatchani tozalaysizmi?"))return;
  getCart().items=[];logPosAction("Savatcha tozalandi","");renderCart();toast("Savatcha tozalandi");
}
function getCartTotal(){
  return getItems().reduce((a,it)=>a+Math.max(0,(it.price||0)-_itemDiscAmt(it))*it.qty,0);
}
function updateCartTotal(){
  const total=getCartTotal();
  const rate=db.settings?.rate||12800;
  const items=getItems();
  const cnt=$("cart-cnt");if(cnt)cnt.textContent=items.length?items.length+" ta":"bo'sh";
  const tot=$("cart-total");if(tot)tot.textContent=fmt(total)+" so'm";
  const usd=$("cart-total-usd");if(usd)usd.textContent=total>0?"≈ $"+(total/rate).toFixed(0):"";
  const cntEl=$("cart-items-count");if(cntEl)cntEl.textContent=items.reduce((a,i)=>a+i.qty,0)+" dona";
  updatePayTotal();updatePayRemaining();
}

// ── Parallel savatchalar ──
function renderCartTabs(){
  const el=$("cart-tabs");if(!el)return;
  el.innerHTML=_carts.map((c,i)=>`<button onclick="switchCart(${i})" style="padding:5px 12px;border-radius:7px;border:1.5px solid ${i===_cartIdx?"#E9A500":"rgba(255,255,255,.2)"};background:${i===_cartIdx?"#E9A500":"transparent"};color:${i===_cartIdx?"#0D1B2A":"rgba(255,255,255,.7)"};font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.15s">${c.name}${c.items.length?" ("+c.items.length+")":""}</button>`).join("")+
  `<button onclick="addCart()" style="padding:5px 10px;border-radius:7px;border:1.5px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.5);font-family:inherit;font-size:14px;cursor:pointer;line-height:1">+</button>`;
}
function switchCart(i){_cartIdx=i;renderCartTabs();renderCart();}
function addCart(){
  if(_carts.length>=5){toast("Maksimal 5 ta savatcha","err");return;}
  _carts.push({id:Date.now(),name:"Savatcha "+(_carts.length+1),items:[]});
  _cartIdx=_carts.length-1;renderCartTabs();renderCart();
}

// ── To'lov paneli ──
function refreshPosStaff(){
  const el=$("pos-staff");if(!el)return;
  const cur=el.value;
  el.innerHTML=`<option value="">- Kassirni tanlang -</option>`+(db.staff||[]).map(s=>`<option value="${s.id}" ${String(s.id)===String(cur)?"selected":""}>${s.name}</option>`).join("");
  if(_staffLocked){el.disabled=true;el.style.opacity=".6";}else{el.disabled=false;el.style.opacity="1";}
  const sess=typeof getSession==="function"?getSession():null;
  if(!el.value&&sess?.staffId)el.value=sess.staffId;
}

function updatePayTotal(){
  const total=getCartTotal();
  const el=$("pos-pay-total");if(el)el.textContent=fmt(total)+" so'm";
}

function updatePayRemaining(){
  const total=getCartTotal();
  const naqd=getRawVal("pay-naqd");
  const karta=getRawVal("pay-karta");
  const otkazma=getRawVal("pay-otkazma");
  const qarz=getRawVal("pay-qarz");
  const paid=naqd+karta+otkazma;
  const total_entered=paid+qarz;
  const rem=Math.max(0,total-total_entered);

  const remEl=$("pay-remaining");
  if(remEl){remEl.textContent=rem>0?fmt(rem)+" so'm":"0";remEl.style.color=rem>0?"#E05A5A":"#22C55E";}

  const badge=$("pay-mode-badge");
  if(badge){
    if(qarz>0){badge.innerHTML=`<span style="background:#FEF3C7;color:#92400E;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">Nasiya</span>`;}
    else if(total_entered>=total&&total>0){badge.innerHTML=`<span style="background:#D1FAE5;color:#065F46;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">To'liq</span>`;}
    else{badge.innerHTML="";}
  }

  const nastBox=$("nasiya-box");
  if(nastBox)nastBox.style.display=qarz>0?"block":"none";
}

function onPayInput(method){
  const total=getCartTotal();
  const naqd=getRawVal("pay-naqd");
  const karta=getRawVal("pay-karta");
  const otkazma=getRawVal("pay-otkazma");
  const qarz=getRawVal("pay-qarz");
  const sum=naqd+karta+otkazma+qarz;

  if(sum>=total&&total>0){
    ["naqd","karta","otkazma","qarz"].forEach(m=>{
      if(_payBlocked[m])return;
      const v=getRawVal("pay-"+m);
      const inp=$("pay-"+m);const row=$("pay-row-"+m);
      if(v===0&&inp&&!inp.disabled){inp.disabled=true;if(row)row.style.opacity=".5";}
    });
  }else{
    ["naqd","karta","otkazma","qarz"].forEach(m=>{
      if(_payBlocked[m])return;
      const inp=$("pay-"+m);const row=$("pay-row-"+m);
      if(inp)inp.disabled=false;if(row)row.style.opacity="1";
    });
  }
  updatePayRemaining();
}

function getMixedTotal(){
  return getRawVal("pay-naqd")+getRawVal("pay-karta")+getRawVal("pay-otkazma")+getRawVal("pay-qarz");
}

function toggleStaffLock(){
  _staffLocked=!_staffLocked;
  const btn=$("pos-staff-lock-btn");
  if(btn){btn.innerHTML=_staffLocked?'<i class="ti ti-lock" style="color:#E9A500"></i>':'<i class="ti ti-lock-open" style="color:#94A3B8"></i>';btn.title=_staffLocked?"Kassir bloklangan":"Kassirni bloklash";}
  refreshPosStaff();toast(_staffLocked?"Kassir bloklandi":"Kassir bloki ochildi");
}

function togglePayMethodBlock(method){
  _payBlocked[method]=!_payBlocked[method];
  const btn=$("pay-lock-"+method);
  if(btn)btn.innerHTML=_payBlocked[method]?'<i class="ti ti-lock" style="color:#E9A500"></i>':'<i class="ti ti-lock-open" style="color:#CBD5E1"></i>';
  const inp=$("pay-"+method);const row=$("pay-row-"+method);
  if(_payBlocked[method]){
    if(inp){inp.disabled=true;inp.value="";}
    if(row){row.style.opacity=".4";row.style.pointerEvents="none";}
  }else{
    if(inp)inp.disabled=false;
    if(row){row.style.opacity="1";row.style.pointerEvents="auto";}
  }
  updatePayRemaining();
  toast((_payBlocked[method]?"Bloklandi: ":"Ochildi: ")+method);
}

function setDebtCurrency(cur){
  _debtCur=cur;
  document.querySelectorAll(".dcur-btn").forEach(b=>{
    const on=b.dataset.c===cur;
    b.style.background=on?"#0D1B2A":"#F0EDE8";
    b.style.color=on?"#fff":"#64748B";
    b.style.borderColor=on?"#0D1B2A":"#E8E5E0";
  });
}

// ── Mijoz ──
function custSearch(q){
  const dd=$("cust-dropdown");if(!dd)return;
  if(!q||q.length<1){dd.style.display="none";return;}
  const matches=(db.customers||[]).filter(c=>c.name.toLowerCase().includes(q.toLowerCase())||(c.phone||"").includes(q)).slice(0,8);
  if(!matches.length){dd.style.display="none";return;}
  dd.style.display="block";
  dd.innerHTML=matches.map(c=>{
    const debt=_custTotalDebt(c.id);
    return`<div onclick="custSelect(${c.id})" style="padding:9px 14px;cursor:pointer;border-bottom:1px solid #F0EDE8;display:flex;align-items:center;gap:10px" onmouseover="this.style.background='#FFF8E7'" onmouseout="this.style.background=''">
      <div style="width:34px;height:34px;border-radius:50%;background:#E9A500;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;flex-shrink:0">${(c.name[0]||"?").toUpperCase()}</div>
      <div style="flex:1"><div style="font-weight:600;font-size:13px;color:#0D1B2A">${c.name}</div><div style="font-size:11.5px;color:#64748B">${c.phone||""}</div></div>
      ${debt>0?`<div style="font-size:11px;color:#E05A5A;font-weight:700">-${fmt(debt)}</div>`:""}
    </div>`;
  }).join("")+
  `<div onclick="custCreateNew()" style="padding:9px 14px;cursor:pointer;color:#E9A500;font-size:12.5px;font-weight:600;border-top:1px solid #F0EDE8;display:flex;align-items:center;gap:6px" onmouseover="this.style.background='#FFF8E7'" onmouseout="this.style.background=''">
    <i class="ti ti-user-plus"></i> Yangi mijoz qo'shish
  </div>`;
}

function _custTotalDebt(custId){
  return(db.sales||[]).filter(s=>s.customerId===custId&&s.status==="qarz").reduce((a,s)=>{
    const st=typeof calcSaleState==="function"?calcSaleState(s):{remaining:s.remaining||0};
    return a+(st.remaining||0);
  },0);
}

function custSelect(id){
  const c=(db.customers||[]).find(x=>x.id===id);if(!c)return;
  _custId=id;
  const inp=$("cust-search-inp");if(inp)inp.value="";
  const dd=$("cust-dropdown");if(dd)dd.style.display="none";
  const card=$("cust-selected-card");if(card)card.style.display="block";
  const nm=$("cust-sel-name");if(nm)nm.textContent=c.name;
  const ph=$("cust-sel-phone");if(ph)ph.textContent=c.phone||"";
  const cn=$("c-name");if(cn)cn.value=c.name;
  const cp=$("c-phone");if(cp)cp.value=c.phone||"";
  const cc=$("c-cust");if(cc)cc.value=id;
  const clr=$("cust-clear-btn");if(clr)clr.style.display="inline-flex";
  const debt=_custTotalDebt(id);
  const db2=$("cust-debt-badge");if(db2)db2.style.display=debt>0?"block":"none";
  const dv=$("cust-debt-val");if(dv)dv.textContent=fmt(debt)+" so'm";
}

function custClear(){
  _custId=null;
  ["cust-search-inp","c-name","c-phone","c-cust"].forEach(id=>{const el=$(id);if(el)el.value="";});
  const card=$("cust-selected-card");if(card)card.style.display="none";
  const dd=$("cust-dropdown");if(dd)dd.style.display="none";
  const clr=$("cust-clear-btn");if(clr)clr.style.display="none";
  const db2=$("cust-debt-badge");if(db2)db2.style.display="none";
}

function custCreateNew(){
  const q=$("cust-search-inp")?.value?.trim()||"";
  const cn=$("c-name");if(cn)cn.value=q;
  const dd=$("cust-dropdown");if(dd)dd.style.display="none";
}

// ── Checkout ──
async function checkout(){
  const items=getItems();
  if(!items.length){toast("Savatcha bo'sh","err");return;}
  const total=getCartTotal();if(total<=0){toast("Jami summa 0","err");return;}

  const naqd=getRawVal("pay-naqd");
  const karta=getRawVal("pay-karta");
  const otkazma=getRawVal("pay-otkazma");
  const qarzInp=getRawVal("pay-qarz");
  const paid=naqd+karta+otkazma;
  const allPaid=paid+qarzInp;
  const isNasiya=qarzInp>0;
  const rem=Math.max(0,total-paid);

  if(paid<0||qarzInp<0){toast("Manfiy summa bo'lishi mumkin emas","err");return;}
  if(allPaid>total+100){toast("To'lov summasi jami dan oshib ketdi","err");return;}

  if(isNasiya){
    const cName=$("c-name")?.value?.trim();
    if(!cName){toast("Nasiyada mijoz ismi majburiy","err");return;}
    const due=$("pos-due")?.value;
    if(!due){toast("Nasiyada muddat majburiy","err");$("pos-due")?.focus();return;}
  }

  const rate=db.settings?.rate||12800;
  const shopName=db.shop?.name||"MERX";
  const staffId=parseInt($("pos-staff")?.value)||null;
  const staffObj=db.staff?.find(s=>s.id===staffId);
  const due=$("pos-due")?.value||"";
  const note=$("pos-note")?.value?.trim()||"";
  const cName=$("c-name")?.value?.trim()||"";
  const cPhone=$("c-phone")?.value?.trim()||"";
  const custVal=$("c-cust")?.value;
  const custId=custVal?parseInt(custVal):(_custId||null);

  let customerId=custId;
  if(cName&&!custId){
    const nc={id:db.seq++,name:cName,phone:cPhone,type:"ulgurji",note:"",createdAt:new Date().toISOString()};
    db.customers.push(nc);customerId=nc.id;
  }

  let debtUsd=0;
  if(isNasiya&&rem>0&&_debtCur==="usd"){debtUsd=parseFloat((rem/rate).toFixed(2));}

  const chekNum=typeof genChekNum==="function"?genChekNum():("CHK-"+Date.now());
  const methods=[];
  if(naqd>0)methods.push("naqd");
  if(karta>0)methods.push("karta");
  if(otkazma>0)methods.push("otkazma");
  if(isNasiya)methods.push("qarz");
  const payType=methods.length===0?"naqd":methods.length===1?methods[0]:"aralash";

  const newSale={
    id:db.seq++,date:today(),time:nowTime(),chekNum,
    priceType:"ulgurji",payType,staffId,staffName:staffObj?.name||"",
    items:items.map(it=>({
      sku:it.sku,name:it.name,art:it.art,color:it.color,size:it.size,
      qty:it.qty,qtyBox:it.qtyBox,price:it.price,
      discount:it.discount||0,discType:it.discType||"pct",
      barcode:it.barcode||null,image:it.image||null,
    })),
    total,paid:isNasiya?paid:total,
    payBreakdown:{naqd,karta,otkazma,qarz:qarzInp},
    remaining:isNasiya?rem:0,debtUzs:isNasiya&&_debtCur==="uzs"?rem:0,debtUsd,
    due:isNasiya?due:"",status:isNasiya?"qarz":"tolandan",
    customerName:cName,customerPhone:cPhone,customerId,note,
  };

  items.forEach(it=>{
    const p=db.products.find(x=>x.sku===it.sku);if(!p)return;
    p.variants.forEach(v=>{
      if(v.color===it.color&&(v.size===it.size||!it.size))v.qty=Math.max(0,(v.qty||0)-it.qty);
    });
  });

  db.sales.push(newSale);_lastSale=newSale;
  logPosAction("Sotuv yakunlandi",`${chekNum} - ${fmt(total)} so'm`);
  saveDB();
  getCart().items=[];renderCartTabs();renderCart();custClear();

  ["pay-naqd","pay-karta","pay-otkazma","pay-qarz"].forEach(id=>{const el=$(id);if(el)el.value="";});
  const due2=$("pos-due");if(due2)due2.value="";
  const note2=$("pos-note");if(note2)note2.value="";
  ["naqd","karta","otkazma","qarz"].forEach(m=>{
    if(_payBlocked[m])return;
    const inp=$("pay-"+m);const row=$("pay-row-"+m);
    if(inp)inp.disabled=false;if(row){row.style.opacity="1";row.style.pointerEvents="auto";}
  });
  updatePayRemaining();updatePayTotal();

  try{
    if(typeof sendTelegramReceipt==="function"&&customerId)sendTelegramReceipt(customerId,newSale,cPhone);
    if(typeof sendStaffNotification==="function")sendStaffNotification(newSale);
  }catch(e){console.warn("Xabar xato:",e.message);}

  showReceiptModal(newSale);toast("Sotuv yakunlandi!");
}

// ── Chek ──
function showReceiptModal(sale){
  _lastSale=sale;
  const el=$("receipt-body");if(!el)return;
  const shopName=db.shop?.name||"MERX";
  const staffObj=db.staff?.find(s=>s.id===sale.staffId);
  const botUser=(db.settings?.telegramBotUsername||"").replace(/^@/,"");
  const botUrl=db.settings?.telegramBotUrl||"";
  const chekCfg=db.settings?.chekConfig||{};
  const posStyle=chekCfg.posStyle||"full";
  const receiptUrl=botUrl?`${botUrl}?action=receipt&id=${encodeURIComponent(sale.chekNum||("ID"+sale.id))}`:"";
  let html="";
  if(typeof buildReceiptHtml==="function"){html=buildReceiptHtml(sale,{shopName,staffName:staffObj?.name||"--",botUsername:botUser,receiptUrl,style:posStyle});}
  el.innerHTML=`<div style="background:#fff;border-radius:12px;overflow:hidden">${html}</div>`;
  openModal("receipt");
}
function closeReceipt(){closeModal("receipt");}
function printReceiptPos(){
  if(!_lastSale)return;
  const sale=_lastSale;const shopName=db.shop?.name||"MERX";
  const staffObj=db.staff?.find(s=>s.id===sale.staffId);
  const botUser=(db.settings?.telegramBotUsername||"").replace(/^@/,"");
  const botUrl=db.settings?.telegramBotUrl||"";
  const receiptUrl=botUrl?`${botUrl}?action=receipt&id=${encodeURIComponent(sale.chekNum||("ID"+sale.id))}`:"";
  const html=typeof buildReceiptHtml==="function"?buildReceiptHtml(sale,{shopName,staffName:staffObj?.name||"--",botUsername:botUser,receiptUrl}):"<p>Chek yo'q</p>";
  const w=window.open("","_blank","width=420,height=700");
  if(!w){toast("Pop-up bloklangan","err");return;}
  w.document.write(html);w.document.close();w.focus();
}

// ── Qarz eslatmasi ──
function checkDebtAlerts(){
  const t=today();
  const overdue=(db.sales||[]).filter(s=>s.status==="qarz"&&s.due&&s.due<t&&(s.remaining||0)>0);
  const banner=$("debt-alert-banner");const text=$("debt-alert-text");
  if(!banner)return;
  if(overdue.length){banner.style.display="block";if(text)text.textContent=overdue.length+" ta muddati o'tgan qarz";}
  else banner.style.display="none";
}

// ── Log ──
function logPosAction(action,details){
  if(!db.posLogs)db.posLogs=[];
  const staffId=parseInt($("pos-staff")?.value)||null;
  const staffObj=db.staff?.find(s=>s.id===staffId);
  db.posLogs.push({date:today(),time:nowTime(),action,details,staffId,staffName:staffObj?.name||"--",cartName:getCart().name});
  if(db.posLogs.length>500)db.posLogs=db.posLogs.slice(-500);
}
function openPosLogs(){openModal("poslogs");renderPosLogs();}
function renderPosLogs(){
  const el=$("poslogs-body");if(!el)return;
  const logs=(db.posLogs||[]).filter(l=>l.date===today()).slice().reverse();
  if(!logs.length){el.innerHTML=`<div style="padding:40px;text-align:center;color:var(--mut)"><i class="ti ti-history" style="font-size:32px;display:block;margin-bottom:10px;opacity:.4"></i>Bugun hali operatsiya bo'lmagan</div>`;return;}
  const icons={"Savatga qo'shildi":{i:"ti-plus",c:"var(--grn)"},"Savatdan o'chirildi":{i:"ti-minus",c:"var(--red)"},"Savatcha tozalandi":{i:"ti-trash",c:"var(--red)"},"Sotuv yakunlandi":{i:"ti-check",c:"var(--acc)"}};
  el.innerHTML=`<table style="width:100%"><thead><tr><th style="padding:8px 12px;font-size:11px;color:var(--mut);text-align:left">VAQT</th><th style="padding:8px 12px;font-size:11px;color:var(--mut);text-align:left">AMAL</th><th style="padding:8px 12px;font-size:11px;color:var(--mut);text-align:left">TAFSILOT</th><th style="padding:8px 12px;font-size:11px;color:var(--mut);text-align:left">KASSIR</th></tr></thead><tbody>${logs.map(l=>{const ai=icons[l.action]||{i:"ti-point",c:"var(--mut)"};return`<tr style="border-top:1px solid var(--brd)"><td style="padding:8px 12px;font-size:12px;color:var(--mut)">${l.time}</td><td style="padding:8px 12px;font-size:12.5px"><i class="ti ${ai.i}" style="color:${ai.c};margin-right:5px"></i>${l.action}</td><td style="padding:8px 12px;font-size:12px;color:var(--mut)">${l.details||"--"}</td><td style="padding:8px 12px;font-size:12px">${l.staffName||"--"}</td></tr>`;}).join("")}</tbody></table>`;
}
function showLastSale(){
  if(!db.sales?.length){toast("Hali sotuv yo'q","err");return;}
  showReceiptModal(db.sales[db.sales.length-1]);
}
function totalStock(p){return(p.variants||[]).reduce((a,v)=>a+(v.qty||0),0);}
