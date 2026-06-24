// MERX init.js | v2.2 | 2026-06-06 06:00
// ================================================
// MERX — js/init.js
// Ishga tushirish va event listenerlar
// ================================================

function init() {
  if (!db) db = seedDB();
  if (!db.staff)        db.staff = [];
  if (!db.xarajatlar)   db.xarajatlar = [];
  if (!db.ombor)        db.ombor = [];
  if (!db.chiqimlar)    db.chiqimlar = [];
  if (!db.debtPayments) db.debtPayments = [];
  updateRatePill();
  $("sb-shop").textContent    = db.shop.name;
  $("debt-count").textContent = debtSales().length;
  refreshStaffList();
  if (typeof updateSmsUI === "function") updateSmsUI();

  // 1. Avval auth tekshirish
  if (typeof initAuth === "function") {
    const authed = initAuth();
    if (!authed) return; // login ekrani ko'rsatildi, init to'xtatiladi
  }

  // 2. Auth muvaffaqiyatli — Supabase ulanish (session bor, refresh holatida)
  // Yangi do'konda URL/Key yo'q bo'lsa asosiy do'kondan olamiz
  if (!db.settings?.supabaseUrl || !db.settings?.supabaseKey) {
    try {
      const mainDB = JSON.parse(localStorage.getItem("merx_v5") || "{}");
      if (mainDB?.settings?.supabaseUrl) {
        if (!db.settings) db.settings = {};
        db.settings.supabaseUrl = mainDB.settings.supabaseUrl;
        db.settings.supabaseKey = mainDB.settings.supabaseKey;
        saveDB();
      }
    } catch(e) {}
  }
  if (db.settings?.supabaseUrl && db.settings?.supabaseKey) {
    initSupabase().then(async ok => {
      if (ok) {
        updateCloudUI(true);
        if (!db.products?.length && !db.sales?.length) {
          await pullFromCloud();
        } else {
          if (typeof renderDashboard === "function") renderDashboard();
        }
      }
    });
  }

  // 3. Rolga qarab sahifaga o'tish
  const user = typeof getAuthUser === "function" ? getAuthUser() : null;
  if (!user || user.role === "admin" || user.role === "menejer" || user.role === "superadmin") {
    nav("dashboard");
  } else if (user.role === "kassir") {
    nav("pos");
  } else if (user.role === "omborchi") {
    nav("ombor");
  } else {
    nav("dashboard");
  }

  // 4. Rol UI — nav dan keyin
  if (typeof applyRoleUI === "function") applyRoleUI();

  // Obuna tekshiruvi (SA do'konlari uchun)
  if (typeof checkCurrentShopSubscription === "function") {
    checkCurrentShopSubscription();
  }
  // Modullar cheklash
  if (typeof applyShopModules === "function") {
    applyShopModules();
  }
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
