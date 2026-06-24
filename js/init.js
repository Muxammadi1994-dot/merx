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

  // Supabase — faqat foydalanuvchi login qilgandan keyin
  const isAuthed = typeof isLoggedIn === "function" ? isLoggedIn() : false;
  if (isAuthed && db.settings?.supabaseUrl && db.settings?.supabaseKey) {
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

  // Auth tekshiruvi — login kerakmi?
  if (typeof initAuth === "function") {
    const authed = initAuth();
    if (!authed) return; // login ekrani ko'rsatildi
  }

  // Kassir/omborchi uchun avtomatik sahifaga o'tish initAuth da amalga oshiriladi
  // Admin/menejer uchun dashboard
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

  // Rol UI — nav dan keyin
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
