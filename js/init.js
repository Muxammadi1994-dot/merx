// MERX init.js | v2.3 | 2026-06-24
// ================================================
// MERX — js/init.js
// Ishga tushirish va event listenerlar
// ================================================

function init() {
  // ── 1. AUTH BIRINCHI — shopId shu yerdan aniqlanadi ──
  // initAuth() → user.dbKey → db qayta yuklanadi → getShopId() to'g'ri ishlaydi
  if (typeof initAuth === "function") {
    const authed = initAuth();
    if (!authed) return; // login ekrani ko'rsatildi, init to'xtatiladi
  }

  // ── 2. DB tekshiruvi — auth dan keyin db to'g'ri yuklangan ──
  if (!db) db = seedDB();
  if (!db.staff)        db.staff = [];
  if (!db.xarajatlar)   db.xarajatlar = [];
  if (!db.ombor)        db.ombor = [];
  if (!db.chiqimlar)    db.chiqimlar = [];
  if (!db.debtPayments) db.debtPayments = [];

  // ── 3. UI yangilash — endi getShopId() to'g'ri shopId qaytaradi ──
  updateRatePill();
  if ($("sb-shop")) $("sb-shop").textContent = db.shop?.name || "MERX";
  if ($("debt-count")) $("debt-count").textContent = debtSales().length;
  refreshStaffList();
  if (typeof updateSmsUI === "function") updateSmsUI();

  // ── 4. Supabase ulanish ──
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
        const isEmpty = !db.products?.length && !db.sales?.length;
        const cloudId = db.settings?.cloudShopId;
        if (isEmpty && cloudId && cloudId !== "local") {
          // Yangi qurilma yoki yangi do'kon — Supabase dan yuklaymiz
          await pullFromCloud();
        } else if (typeof renderDashboard === "function") {
          renderDashboard();
        }
      }
    });
  }

  // ── 5. Rolga qarab sahifaga o'tish ──
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

  // ── 6. Rol UI — nav dan keyin ──
  if (typeof applyRoleUI === "function") applyRoleUI();

  // ── 7. Obuna va modul tekshiruvi ──
  if (typeof checkCurrentShopSubscription === "function") {
    checkCurrentShopSubscription();
  }
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

// ── Start app ──────────────────────────────────────
// MUHIM: db avval "local" sifatida yuklanadi,
// keyin init() ichida initAuth() to'g'ri shopId asosida qayta yuklaydi
db = loadDB() || seedDB();
init();
