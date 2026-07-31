// ══════════════════════════════════════════════════════════════
// TIZIM DARAJASIDAGI QIYMATLAR (2026-07-30)
// ══════════════════════════════════════════════════════════════
// Bot BITTA — u barcha do'konlarga xizmat qiladi, do'konlar shop_id
// bo'yicha ajratiladi. Demak bu ikki qiymat har do'konda bir xil
// bo'lishi SHART. Do'kon egasi ularni qo'lda yozmasligi kerak:
// bitta xato belgi bot bilan aloqani uzadi va mijozga chek
// yuborilmay qoladi.
// Sozlamalar oynasida maydonlar `readonly`, qiymat esa quyida
// majburlanadi — yangi do'kon birinchi ochilishidayoq tayyor turadi.
// Bot o'zgarsa FAQAT shu ikki qatorni yangilash kifoya.
const MERX_BOT_URL      = "https://merx-rho.vercel.app/api/bot";
const MERX_BOT_USERNAME = "merx_savdo_bot";

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

  // ── 1.5. OG'IR JADVALLAR (2026-07-31) ──────────────────────
  // sales/xarajatlar/... endi IndexedDB'da. Ular ASINXRON keladi,
  // shuning uchun yuklangach ekranni qayta chizamiz. Bu bulutdan
  // pull kelganda allaqachon ishlatiladigan usul — yangi emas.
  if (typeof hydrateHeavy === "function") {
    hydrateHeavy().then(() => {
      try {
        if ($("debt-count")) $("debt-count").textContent = debtSales().length;
        if (typeof renderDashboard === "function") renderDashboard();
        const p = document.querySelector(".pg.on");
        if (p && typeof nav === "function") nav(p.id.replace(/^p-/, ""));
      } catch(e) {}
    }).catch(e => console.warn("hydrateHeavy:", e.message));
  }

  // ── 2. DB tekshiruvi — auth dan keyin db to'g'ri yuklangan ──
  if (!db) db = seedDB();
  if (!db.staff)        db.staff = [];
  if (!db.xarajatlar)   db.xarajatlar = [];
  if (!db.ombor)        db.ombor = [];
  // №11a (v143): JUFT→DONA migratsiyasi (bir martalik, idempotent).
  // Birlik faqat YORLIQ (chek/ro'yxatda ko'rinadigan so'z) — narx, qoldiq,
  // pochka hisoblari unga bog'liq emas, shuning uchun xavfsiz.
  try {
    if (!db.settings.juftMigrated) {
      let _jm = 0;
      (db.products || []).forEach(p => { if ((p.unit||"") === "juft") { p.unit = "dona"; _jm++; } });
      db.settings.juftMigrated = true;
      if (_jm) console.log("juft→dona migratsiya:", _jm, "tovar");
    }
  } catch(e) {}
  if (!db.chiqimlar)    db.chiqimlar = [];
  if (!db.debtPayments) db.debtPayments = [];

  // ── 3. UI yangilash — endi getShopId() to'g'ri shopId qaytaradi ──
  // 2026-07-26: SuperAdmin belgilagan valyuta rejimini majburlaymiz
  try { if (typeof enforceCurrencyMode === "function") enforceCurrencyMode(); } catch(e) {}
  // 2026-07-26: obuna tarifi cheklovi (Start'da bot bo'limlari yopiq)
  try { if (typeof applyTierLock === "function") applyTierLock(); } catch(e) {}
  updateRatePill();
  if ($("sb-shop")) $("sb-shop").textContent = db.shop?.name || "MERX";
  if ($("debt-count")) $("debt-count").textContent = debtSales().length;
  refreshStaffList();
  if (typeof updateSmsUI === "function") updateSmsUI();

  // ── 3.5. Bot sozlamalarini majburlash (2026-07-30) ──
  // Yangi do'kon uchun avtomat to'ldiriladi, eskisida noto'g'ri
  // yozilgan bo'lsa to'g'rilanadi. Faqat qiymat farq qilsa yoziladi —
  // keraksiz sinxron bo'lmasin.
  try {
    if (!db.settings) db.settings = {};
    let _botFixed = false;
    if (db.settings.telegramBotUrl !== MERX_BOT_URL) {
      db.settings.telegramBotUrl = MERX_BOT_URL; _botFixed = true;
    }
    if (db.settings.telegramBotUsername !== MERX_BOT_USERNAME) {
      db.settings.telegramBotUsername = MERX_BOT_USERNAME; _botFixed = true;
    }
    if (_botFixed) { saveDB(); console.log("🤖 Bot sozlamalari avtomat to'ldirildi"); }
  } catch(e) { console.warn("bot sozlamalari:", e.message); }

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

  // ── 4.5. Kalitlar hali ham yo'qmi — SERVERDAN olamiz (2026-07-30) ──
  // Yuqoridagi blok kalitlarni faqat `merx_v5` (asosiy do'kon) dan
  // qidiradi. Do'kon egasining O'Z qurilmasida esa `merx_v5` umuman
  // yo'q. Kirish paytida auth.js buni client_config orqali hal qiladi,
  // lekin foydalanuvchi allaqachon kirgan bo'lsa (F5, PWA) o'sha yo'l
  // ishlamaydi va do'kon jimgina "lokal rejim"da qolib ketardi.
  // Sozlamalardagi maydonlar endi YOPIQ — qo'lda tuzatib bo'lmaydi,
  // shuning uchun bu bo'shliqni yopish SHART.
  if (!db.settings?.supabaseUrl || !db.settings?.supabaseKey) {
    (async () => {
      try {
        const _r = await fetch("/api/auth-v2?action=client_config", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
        });
        const _cfg = await _r.json();
        if (!_cfg?.ok || !_cfg.url || !_cfg.key) return;
        if (!db.settings) db.settings = {};
        db.settings.supabaseUrl = _cfg.url;
        db.settings.supabaseKey = _cfg.key;
        saveDB();
        console.log("☁️ Bulut kalitlari serverdan olindi");
        // Kalitlar endi bor — pastdagi blok allaqachon o'tib ketgan,
        // shuning uchun ulanishni shu yerda o'zimiz boshlaymiz
        if (typeof initSupabase === "function" && await initSupabase()) {
          if (typeof updateCloudUI === "function") updateCloudUI(true);
          const _empty = !db.products?.length && !db.sales?.length;
          if (_empty && typeof pullFromCloud === "function") await pullFromCloud();
          else if (typeof renderDashboard === "function") renderDashboard();
        }
      } catch(e) { console.warn("client_config olinmadi:", e.message); }
    })();
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
  // v142 (№4): F5'dan keyin AMALDAGI oynada qolish — nav (utils v151)
  // eslab qolgan sahifani tiklaymiz. Himoya: sahifa mavjud bo'lishi va
  // rol ruxsati bo'lishi shart, aks holda eski rol-standarti ishlaydi.
  let savedPage = null;
  try { savedPage = localStorage.getItem("merx_last_page"); } catch(e) {}
  // 2026-07-30: qo'shimcha shart — uzoq tanaffusdan keyin (ertasi kun
  // yoki 4 soatdan ko'p) oxirgi sahifa TIKLANMAYDI, rolga mos standart
  // sahifa (egasi uchun Dashboard) ochiladi.
  // MUHIM: bu qaror faqat SHU YERDA, ilova ochilganda bir marta olinadi.
  // Ishlash paytida sahifa hech qachon o'zgartirilmaydi (v151 xatosi
  // qaytmasligi uchun).
  const canRestore = savedPage && document.getElementById("p-" + savedPage) &&
    (typeof canAccessPage !== "function" || canAccessPage(savedPage)) &&
    (typeof shouldRestoreLastPage !== "function" || shouldRestoreLastPage());
  if (canRestore) {
    nav(savedPage);
  } else {
    nav(typeof defaultPageForRole === "function" ? defaultPageForRole(user) : "dashboard");
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
