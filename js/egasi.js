// ================================================
// MERX — js/egasi.js
// ================================================

function renderEgasi() {
  $("s-name").value  = db.shop.name;
  $("s-rate").value  = db.settings.rate;
  updateRatePill();
  $("sb-shop").textContent = db.shop.name;
  document.querySelectorAll("#type-seg button").forEach(b => b.classList.toggle("on", b.dataset.t === db.shop.type));
  document.querySelectorAll("#cur-seg button").forEach(b => b.classList.toggle("on", b.dataset.c === (db.settings.priceCurrency||"uzs")));
  if ($("s-sup-url"))    $("s-sup-url").value    = db.settings.supabaseUrl || "";
  if ($("s-sup-key"))    $("s-sup-key").value    = db.settings.supabaseKey || "";
  if ($("s-eskiz-token")) $("s-eskiz-token").value = db.settings.eskizToken || "";
  if ($("s-eskiz-sender")) $("s-eskiz-sender").value = db.settings.eskizSender || "MERX";
  updateCloudUI(!!supabaseClient);
  updateSmsUI();
}

function saveSetting(k, v) {
  if (k === "name")           { db.shop.name = v; $("sb-shop").textContent = v; }
  else if (k === "rate")        db.settings.rate = v;
  else if (k === "priceCurrency") {
    db.settings.priceCurrency = v;
    document.querySelectorAll("#cur-seg button").forEach(b => b.classList.toggle("on", b.dataset.c === v));
  }
  else if (k === "supabaseUrl")  db.settings.supabaseUrl = v;
  else if (k === "supabaseKey")  db.settings.supabaseKey = v;
  else if (k === "eskizToken") { db.settings.eskizToken = v; updateSmsUI(); }
  else if (k === "eskizSender")  db.settings.eskizSender = v;
  updateRatePill(); saveDB();
}

function setShopType(t) {
  db.shop.type = t; saveDB();
  document.querySelectorAll("#type-seg button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  renderPosGrid();
}