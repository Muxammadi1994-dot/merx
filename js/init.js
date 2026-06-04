// ================================================
// MERX — js/init.js
// Ishga tushirish va event listenerlar
// ================================================

function init() {
  if (!db) db = seedDB();
  if (!db.staff)      db.staff = [];
  if (!db.xarajatlar) db.xarajatlar = [];
  if (!db.ombor)      db.ombor = [];
  updateRatePill();
  $("sb-shop").textContent    = db.shop.name;
  $("debt-count").textContent = debtSales().length;
  refreshStaffList();
  updateSmsUI();
  if (db.settings?.supabaseUrl && db.settings?.supabaseKey) {
    initSupabase().then(ok => { if (ok) updateCloudUI(true); });
  }
  nav("dashboard");
}

// Nav event listeners
document.querySelectorAll(".ni").forEach(n => n.onclick = () => nav(n.dataset.p));

// vm-qty input listener (modal element)
document.addEventListener("DOMContentLoaded", () => {
  const e = $("vm-qty"); if (e) e.addEventListener("input", () => renderVmChips());
});

// Start app
db = loadDB() || seedDB();
init();
