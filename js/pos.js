function processBarcode(code) {
  const q = code.toLowerCase();
  let p = db.products.find(x =>
    x.sku.toLowerCase() === q || (x.barcode && x.barcode.toLowerCase() === q)
  );
  let foundColor = null;
  if (!p) {
    for (const prod of db.products) {
      if (!prod.colorBarcodes) continue;
      for (const [clr, bc] of Object.entries(prod.colorBarcodes)) {
        if (bc && bc.toLowerCase() === q) { p = prod; foundColor = clr; break; }
      }
      if (p) break;
    }
  }
  if (p) {
    const lbl = foundColor ? p.name + " -- " + foundColor : p.name;
    toast("Topildi: " + lbl, "info");
    if ($("pos-q")) {
      $("pos-q").value = p.art || p.sku;
      posSearch();
      if (foundColor) {
        setTimeout(() => {
          document.querySelectorAll(".vm-color-btn").forEach(btn => {
            if (btn.textContent.trim().toLowerCase() === foundColor.toLowerCase()) btn.click();
          });
        }, 300);
      }
    }
  } else {
    if ($("pos-q")) { $("pos-q").value = code; posSearch(); }
    toast('Barcode: "' + code + '" -- qolda tanlang', 'info');
  }
}
