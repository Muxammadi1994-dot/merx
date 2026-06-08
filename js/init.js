// MERX init.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/init.js
// Ishga tushirish va event listenerlar
// ================================================

function init() {
  if (!db) db = seedDB();
  if (!db.staff)      db.staff = [];
  if (!db.xarajatlar) db.xarajatlar = [];
  if (!db.ombor)      db.ombor = [];
  if (!db.chiqimlar)  db.chiqimlar = [];
  updateRatePill();
  $("sb-shop").textContent    = db.shop.name;
  $("debt-count").textContent = debtSales().length;
  refreshStaffList();
  if (typeof updateSmsUI === "function") updateSmsUI();
  if (db.settings?.supabaseUrl && db.settings?.supabaseKey) {
    initSupabase().then(async ok => {
      if (ok) {
        updateCloudUI(true);
        if (!db.products?.length && !db.sales?.length) {
          await pullFromCloud();
        }
      }
    });
  }

  // Auth tekshiruvi
  if (typeof authCheck === "function") {
    if (!authCheck()) return; // Parol o'rnatilgan va sessiya yo'q — login ekran
    if (typeof applyRoleUI === "function") applyRoleUI();
    if (typeof updateAuthTopbar === "function") updateAuthTopbar();
  }

  const ptw = $("price-type-wrap");
  if (ptw) ptw.style.display = db.settings?.showChakana ? "block" : "none";
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
