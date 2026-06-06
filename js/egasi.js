// MERX egasi.js | v2.2 | 2026-06-06
// Egasi sozlamalari — renderEgasi utils.js/egasi moduli tomonidan boshqariladi

function renderEgasi() {
  // Do'kon nomi
  if ($("s-name")) $("s-name").value = db.shop?.name || db.settings?.name || "";
  if ($("s-rate")) $("s-rate").value = db.settings?.rate || 12800;

  // Narx ko'rinishi tugmalari
  const cur = db.settings?.priceCurrency || "uzs";
  document.querySelectorAll("[data-c]").forEach(b =>
    b.classList.toggle("on", b.dataset.c === cur));

  // Do'kon turi
  const st = db.settings?.shopType || "ikki";
  document.querySelectorAll("[data-t]").forEach(b =>
    b.classList.toggle("on", b.dataset.t === st));

  // Cloud
  const url = db.settings?.supabaseUrl || "";
  const key = db.settings?.supabaseKey || "";
  if ($("s-sup-url")) $("s-sup-url").value = url;
  if ($("s-sup-key")) $("s-sup-key").value = key;

  const badge = $("cloud-status-badge");
  if (badge) {
    if (url && key) {
      badge.textContent = "Ulangan ✅";
      badge.className = "bg bg-g";
    } else {
      badge.textContent = "Ulanmagan";
      badge.className = "bg bg-gr";
    }
  }

  // SMS
  if ($("s-eskiz-token"))  $("s-eskiz-token").value  = db.settings?.eskizToken  || "";
  if ($("s-eskiz-sender")) $("s-eskiz-sender").value = db.settings?.eskizSender || "";
  if (typeof updateSmsUI === "function") updateSmsUI();

  // Chakana toggle
  if (typeof initChakanaToggle === "function") initChakanaToggle();
}

function setShopType(t) {
  if (!db.settings) db.settings = {};
  db.settings.shopType = t;
  document.querySelectorAll("[data-t]").forEach(b =>
    b.classList.toggle("on", b.dataset.t === t));
  saveDB();
  toast("Do'kon turi saqlandi");
}
