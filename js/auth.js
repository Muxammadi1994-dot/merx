// MERX auth.js | v3.3 | 2026-06-24
// ================================================
// Login ekranida 3 tab:
//   👤 Egasi/Admin  💼 Xodim  ⚡ Super Admin
// Super Admin kirsa → panel ochiladi → do'kon tanlaydi
// ================================================

const AUTH_KEY = "merx_auth_v1";
let _authUser = null;

// ── Session ──────────────────────────────────────
function authLoad() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) _authUser = JSON.parse(raw);
  } catch(e) { _authUser = null; }
  return _authUser;
}
function authSave(user) {
  _authUser = user;
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}
function authClear() {
  _authUser = null;
  localStorage.removeItem(AUTH_KEY);
}
function getAuthUser() { return _authUser; }
function isLoggedIn()  { return !!_authUser; }

// ── _buildUser ────────────────────────────────────
function _buildUser(email, shopId, role) {
  const sid   = shopId || "local";
  const dbKey = sid === "local" ? "merx_v5" : "merx_v5_" + sid;
  return {
    id:       sid === "local" ? "local_admin" : "admin_" + sid,
    email, shopId: sid, dbKey,
    shopName: db?.shop?.name || "MERX Do'koni",
    role:     role || "admin"
  };
}

// ── authLogin — db ichida tekshiradi ─────────────
// ── SHA-256 hash (Web Crypto API) ────────────────
async function sha256(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Parolni hash ga aylantirish + DB ga saqlash
async function migratePassToHash() {
  const s = db?.settings;
  if (!s || !s.adminPass || s.adminPass.length === 64) return; // allaqachon hash
  const hashed = await sha256(s.adminPass);
  s.adminPass = hashed;
  saveDB();
}

async function authLogin(email, password, shopId) {
  const stored = db?.settings?.adminEmail;
  const pass   = db?.settings?.adminPass;

  // Birinchi kirish — parol yo'q
  if (!stored) {
    if (!email || !password || password.length < 4)
      return { ok: false, error: "Email va kamida 4 ta belgili parol kiriting" };
    if (!db.settings) db.settings = {};
    db.settings.adminEmail = email.toLowerCase();
    db.settings.adminPass  = await sha256(password); // hash bilan saqlaymiz
    saveDB();
    const user = _buildUser(email, shopId);
    authSave(user);
    return { ok: true, user, firstTime: true };
  }

  if (email.toLowerCase() !== stored)
    return { ok: false, error: "Email yoki parol noto'g'ri" };

  if (!pass) {
    // Parol yo'q (eski do'kon) — to'g'ridan kirish
  } else if (pass.length === 64) {
    // Hash bilan solishtiramiz
    const inputHash = await sha256(password);
    if (inputHash !== pass)
      return { ok: false, error: "Email yoki parol noto'g'ri" };
  } else {
    // Plain text (eski) — tekshirib, hashga o'giramiz
    if (password !== pass)
      return { ok: false, error: "Email yoki parol noto'g'ri" };
    // Hashga migratsiya
    db.settings.adminPass = await sha256(password);
    saveDB();
  }

  const user = _buildUser(email, shopId);
  authSave(user);
  return { ok: true, user };
}

// ── Xodim login ──────────────────────────────────
function authStaffLogin(phone, password) {
  const staff = (db.staff||[]).find(s => s.phone === phone && s.pin === password);
  if (!staff) return { ok: false, error: "Telefon yoki PIN noto'g'ri" };
  const sid   = getShopId();
  const dbKey = sid === "local" ? "merx_v5" : "merx_v5_" + sid;
  const user  = {
    id: "staff_" + staff.id, email: staff.phone,
    staffId: staff.id, shopId: sid, dbKey,
    shopName: db?.shop?.name || "MERX Do'koni",
    role: staff.role || "kassir", name: staff.name
  };
  authSave(user);
  return { ok: true, user };
}

// ── Chiqish ──────────────────────────────────────
function authLogout() {
  authClear();
  try {
    const main = localStorage.getItem("merx_v5");
    if (main) db = JSON.parse(main);
  } catch(e) {}
  showLoginScreen();
}
function logoutConfirm() {
  if (confirm("Tizimdan chiqasizmi?")) authLogout();
}

// ── Rol tizimi ───────────────────────────────────
const ROLE_LEVELS = { superadmin:5, admin:4, menejer:3, kassir:2, omborchi:1 };
function hasRole(minRole) {
  return (ROLE_LEVELS[_authUser?.role]||0) >= (ROLE_LEVELS[minRole]||99);
}
const PAGE_ROLES = {
  dashboard:"kassir", sotuv:"kassir", katalog:"kassir",
  ombor:"omborchi", mijozlar:"kassir", qarzlar:"kassir",
  qarztarix:"kassir", tarix:"kassir",
  hisobot:"menejer", xodimlar:"menejer", moliya:"menejer",
  egasi:"admin", portal:"admin",
};
function canAccessPage(page) {
  return hasRole(PAGE_ROLES[page] || "admin");
}

// ── applyRoleUI ───────────────────────────────────
function applyRoleUI() {
  const user = _authUser; if (!user) return;
  const userEl = document.getElementById("auth-user-name");
  if (userEl) userEl.textContent = user.name || user.email || "Foydalanuvchi";
  const roleEl = document.getElementById("auth-user-role");
  if (roleEl) {
    const labels = { admin:"Admin", menejer:"Menejer", kassir:"Kassir", omborchi:"Omborchi", superadmin:"Super" };
    roleEl.textContent = labels[user.role] || user.role;
  }
  const topBtn  = document.getElementById("auth-topbar-btn");
  const topName = document.getElementById("auth-topbar-name");
  if (topBtn)  topBtn.style.display = "flex";
  if (topName) topName.textContent  = user.name || (user.email?.split("@")[0]||"").slice(0,14);
  document.querySelectorAll("[data-page]").forEach(el => {
    el.style.display = canAccessPage(el.dataset.page) ? "" : "none";
  });
  document.querySelectorAll(".ns-group").forEach(group => {
    const visible = [...group.querySelectorAll(".ni")].some(ni => ni.style.display !== "none");
    if (group.previousElementSibling) group.previousElementSibling.style.display = visible?"":"none";
    group.style.display = visible?"":"none";
  });
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = hasRole("admin") ? "" : "none";
  });
  document.querySelectorAll(".menejer-only").forEach(el => {
    el.style.display = hasRole("menejer") ? "" : "none";
  });
}

// ── initAuth ─────────────────────────────────────
function initAuth() {
  const user = authLoad();
  if (!user) { showLoginScreen(); return false; }
  if (user.dbKey) {
    try {
      const raw = localStorage.getItem(user.dbKey);
      if (raw) db = JSON.parse(raw);
    } catch(e) {}
  }
  // Plain text parolni hashga o'tkazamiz (bir martalik)
  migratePassToHash();
  applyRoleUI();
  return true;
}

// ── Cloud sync login dan keyin ────────────────────
function _initCloudAfterLogin() {
  let url = db?.settings?.supabaseUrl;
  let key = db?.settings?.supabaseKey;
  if (!url && typeof MERX_SUPABASE_URL !== "undefined") url = MERX_SUPABASE_URL;
  if (!key && typeof MERX_SUPABASE_KEY !== "undefined") key = MERX_SUPABASE_KEY;
  if (!url || !key) return;
  if (db?.settings) {
    if (!db.settings.supabaseUrl) db.settings.supabaseUrl = url;
    if (!db.settings.supabaseKey) db.settings.supabaseKey = key;
    saveDB();
  }

  // initSupabase allaqachon doLogin() ichida chaqirilgan va token bilan ulangan.
  // Qayta chaqirmaslik — "Multiple GoTrueClient" ogohlantirishini oldini oladi.
  // Faqat _sb mavjud bo'lsa davom etamiz, bo'lmasa initSupabase chaqiramiz.
  const proceed = async () => {
    if (!_sb) {
      if (typeof initSupabase !== "function") return;
      const ok = await initSupabase();
      if (!ok) return;
    }
    if (typeof updateCloudUI === "function") updateCloudUI(true);
    // Settings ni HAR DOIM cloud dan yuklaymiz (bot, telegram sozlamalari uchun)
    if (typeof pullFromCloud === "function") {
      const hasLocalData = (db.products?.length > 0) || (db.sales?.length > 0);
      if (!hasLocalData) {
        // Bo'sh do'kon — to'liq pull
        await pullFromCloud(); saveDB();
        if (typeof renderDashboard === "function") renderDashboard();
      } else {
        // Ma'lumotlar bor — settings ni Supabase dan yangilaymiz
        try {
          if (typeof _sb !== "undefined" && _sb) {
            // cloudShopId yoki session dan sid olamiz
            const sid = (db.settings?.cloudShopId && db.settings.cloudShopId !== "local")
              ? db.settings.cloudShopId
              : (typeof getShopId === "function" ? getShopId() : null);

            if (sid && sid !== "local") {
              const { data: setsArr } = await _sb.from("settings")
                .select("eskiz_token,eskiz_sender,telegram_bot,telegram_bot_username,staff_group_id,loyalty_rate,loyalty_value")
                .eq("shop_id", sid).limit(1);
              const sets = setsArr?.[0];
              if (sets) {
                if (!db.settings) db.settings = {};
                if (sets.eskiz_token)           db.settings.eskizToken         = sets.eskiz_token;
                if (sets.eskiz_sender)          db.settings.eskizSender        = sets.eskiz_sender;
                if (sets.telegram_bot)          db.settings.telegramBotUrl     = sets.telegram_bot;
                if (sets.telegram_bot_username) db.settings.telegramBotUsername = sets.telegram_bot_username;
                if (sets.staff_group_id)        db.settings.staffGroupId       = sets.staff_group_id;
                if (sets.loyalty_rate)          db.settings.loyaltyRate        = sets.loyalty_rate;
                if (sets.loyalty_value)         db.settings.loyaltyValue       = sets.loyalty_value;
                saveDB();
              }
            }
          }
        } catch(e) { console.warn("Settings pull xato:", e.message); }
      }
    }
  };
  proceed();
}

// ── Login ekrani ─────────────────────────────────
function showLoginScreen() {
  let screen = document.getElementById("auth-screen");
  if (!screen) {
    screen = document.createElement("div");
    screen.id = "auth-screen";
    screen.style.cssText = "position:fixed;inset:0;background:linear-gradient(160deg,#0a1628 0%,#0D1B2A 60%,#122034 100%);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
    document.body.appendChild(screen);
  }

  const hasAdmin = !!(db?.settings?.adminEmail);
  const shopName = db?.shop?.name || "MERX Savdo tizimi";
  const iStyle   = "width:100%;padding:11px 14px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-family:inherit;font-size:14px;box-sizing:border-box;outline:none";

  screen.innerHTML = `
    <div style="width:100%;max-width:400px">
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="width:44px;height:44px;background:#E9A500;border-radius:12px;display:flex;align-items:center;justify-content:center">
            <i class="ti ti-building-store" style="font-size:24px;color:#0D1B2A"></i>
          </div>
          <span style="font-size:28px;font-weight:800;color:#fff;font-family:'Sora',sans-serif">MERX</span>
        </div>
        <div style="font-size:13px;color:rgba(255,255,255,.4)">${shopName}</div>
      </div>

      <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:28px">

        <!-- 3 tab -->
        <div style="display:flex;background:rgba(255,255,255,.08);border-radius:10px;padding:3px;gap:3px;margin-bottom:20px">
          <button onclick="switchAuthTab('admin')" id="tab-admin"
            style="flex:1;padding:8px;border:none;border-radius:8px;background:#E9A500;color:#0D1B2A;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit">
            👤 Admin
          </button>
          <button onclick="switchAuthTab('staff')" id="tab-staff"
            style="flex:1;padding:8px;border:none;border-radius:8px;background:transparent;color:rgba(255,255,255,.5);font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">
            💼 Xodim
          </button>
          <button onclick="switchAuthTab('super')" id="tab-super"
            style="flex:1;padding:8px;border:none;border-radius:8px;background:transparent;color:rgba(255,255,255,.5);font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">
            ⚡ Super Admin
          </button>
        </div>

        <!-- Egasi forma -->
        <div id="auth-admin-form">
          <div style="margin-bottom:12px">
            <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px;font-weight:600">EMAIL</label>
            <input id="auth-email" type="email" placeholder="admin@example.com" autocomplete="email"
              style="${iStyle}" onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
              onkeydown="if(event.key==='Enter')document.getElementById('auth-pass').focus()">
          </div>
          <div style="margin-bottom:20px">
            <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px;font-weight:600">PAROL</label>
            <div style="position:relative">
              <input id="auth-pass" type="password" placeholder="••••••••" autocomplete="current-password"
                style="width:100%;padding:11px 40px 11px 14px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-family:inherit;font-size:14px;box-sizing:border-box;outline:none"
                onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
                onkeydown="if(event.key==='Enter')doLogin()">
              <button onclick="toggleAuthPass()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:rgba(255,255,255,.4);padding:0">
                <i class="ti ti-eye" id="auth-eye" style="font-size:16px"></i>
              </button>
            </div>
          </div>
          <div id="auth-err" style="display:none;background:#FEE2E2;color:#991B1B;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px;font-weight:600"></div>
          <button onclick="doLogin()" id="auth-btn"
            style="width:100%;padding:13px;background:#E9A500;border:none;border-radius:12px;color:#0D1B2A;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
            <i class="ti ti-login"></i> ${!hasAdmin ? "Hisob yaratish" : "Kirish"}
          </button>
        </div>

        <!-- Xodim forma -->
        <div id="auth-staff-form" style="display:none">
          <div style="margin-bottom:12px">
            <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px;font-weight:600">TELEFON</label>
            <input id="auth-phone" type="tel" placeholder="+998 90 000 00 00"
              style="${iStyle}" onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
              onkeydown="if(event.key==='Enter')document.getElementById('auth-pin').focus()">
          </div>
          <div style="margin-bottom:20px">
            <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px;font-weight:600">PIN KOD</label>
            <input id="auth-pin" type="password" placeholder="••••" maxlength="6" inputmode="numeric"
              style="width:100%;padding:11px 14px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-family:inherit;font-size:20px;letter-spacing:8px;box-sizing:border-box;outline:none"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
              onkeydown="if(event.key==='Enter')doStaffLogin()">
          </div>
          <div id="auth-staff-err" style="display:none;background:#FEE2E2;color:#991B1B;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px;font-weight:600"></div>
          <button onclick="doStaffLogin()"
            style="width:100%;padding:13px;background:#E9A500;border:none;border-radius:12px;color:#0D1B2A;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
            <i class="ti ti-login"></i> Kirish
          </button>
        </div>

        <!-- Super Admin forma -->
        <div id="auth-super-form" style="display:none">
          <div style="text-align:center;margin-bottom:16px">
            <div style="display:inline-flex;width:48px;height:48px;background:#E9A500;border-radius:12px;align-items:center;justify-content:center;margin-bottom:8px">
              <i class="ti ti-shield-bolt" style="font-size:24px;color:#0D1B2A"></i>
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,.4)">Faqat tizim egasi uchun</div>
          </div>
          <div style="margin-bottom:20px">
            <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px;font-weight:600">SUPER ADMIN PAROLI</label>
            <input id="auth-sa-pass" type="password" placeholder="••••••••"
              style="${iStyle}" onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
              onkeydown="if(event.key==='Enter')doSuperLogin()">
          </div>
          <div id="auth-sa-err" style="display:none;background:#FEE2E2;color:#991B1B;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px;font-weight:600"></div>
          <button onclick="doSuperLogin()"
            style="width:100%;padding:13px;background:#E9A500;border:none;border-radius:12px;color:#0D1B2A;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
            <i class="ti ti-shield-check"></i> Super Admin kirish
          </button>
        </div>

      </div>
      <div style="text-align:center;margin-top:20px;font-size:12px;color:rgba(255,255,255,.2)">MERX © 2026</div>
    </div>`;

  setTimeout(() => document.getElementById("auth-email")?.focus(), 100);
}

// ── Tab almashtirish ──────────────────────────────
function switchAuthTab(tab) {
  const tabs  = { admin:"auth-admin-form", staff:"auth-staff-form", super:"auth-super-form" };
  const tBtns = { admin:"tab-admin", staff:"tab-staff", super:"tab-super" };
  const focus = { admin:"auth-email", staff:"auth-phone", super:"auth-sa-pass" };

  Object.entries(tabs).forEach(([t, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = t === tab ? "block" : "none";
  });
  Object.entries(tBtns).forEach(([t, id]) => {
    const btn = document.getElementById(id); if (!btn) return;
    const on  = t === tab;
    btn.style.background = on ? "#E9A500" : "transparent";
    btn.style.color      = on ? "#0D1B2A" : "rgba(255,255,255,.5)";
  });
  setTimeout(() => document.getElementById(focus[tab])?.focus(), 50);
}

function toggleAuthPass() {
  const inp = document.getElementById("auth-pass");
  const ico = document.getElementById("auth-eye");
  if (!inp) return;
  inp.type = inp.type === "password" ? "text" : "password";
  if (ico) ico.className = inp.type === "password" ? "ti ti-eye" : "ti ti-eye-off";
}

// ── Super Admin login ─────────────────────────────
function doSuperLogin() {
  const pass    = (document.getElementById("auth-sa-pass")||{value:""}).value;
  const errEl   = document.getElementById("auth-sa-err");
  const correct = db.settings?.superAdminPin || "merx2024";

  if (pass !== correct) {
    if (errEl) { errEl.textContent = "Parol noto'g'ri"; errEl.style.display = "block"; }
    if (document.getElementById("auth-sa-pass")) document.getElementById("auth-sa-pass").value = "";
    return;
  }

  // sessionStorage ga saqlaymiz (localStorage emas)
  sessionStorage.setItem("merx_superadmin_v1", JSON.stringify({ loggedIn: true, ts: Date.now() }));
  sessionStorage.setItem("merx_sa_ts", Date.now().toString());

  hideLoginScreen();

  // Super Admin panelini ochamiz
  setTimeout(() => {
    const overlay = document.createElement("div");
    overlay.id = "sa-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif";
    overlay.innerHTML = typeof buildSaPanel === "function" ? buildSaPanel() : "<div style='color:#fff'>Yuklanmoqda...</div>";
    document.body.appendChild(overlay);
    if (typeof renderSaShops === "function") renderSaShops();

    // Supabase'dan do'konlarni yuklaymiz
    if (typeof saFetchShopsFromCloud === "function") {
      saFetchShopsFromCloud().catch(e => console.warn("SA shops yuklash xato:", e.message));
    }
  }, 100);
}

// ── Egasi/Admin login ─────────────────────────────
async function doLogin() {
  const email = (document.getElementById("auth-email")||{value:""}).value.trim().toLowerCase();
  const pass  = (document.getElementById("auth-pass") ||{value:""}).value;
  const btn   = document.getElementById("auth-btn");

  if (!email || !pass) { showAuthErr("Email va parol kiriting"); return; }
  if (btn) { btn.innerHTML = '<i class="ti ti-loader spin"></i> Tekshirilmoqda...'; btn.disabled = true; }

  let res = { ok: false };

  // 1. Supabase dan shop topamiz
  const _sbUrl = (typeof MERX_SUPABASE_URL !== "undefined" && MERX_SUPABASE_URL)
    ? MERX_SUPABASE_URL
    : (db?.settings?.supabaseUrl || "");
  const _sbKey = (typeof MERX_SUPABASE_KEY !== "undefined" && MERX_SUPABASE_KEY)
    ? MERX_SUPABASE_KEY
    : (db?.settings?.supabaseKey || "");

  if (_sbUrl && _sbKey) {
    try {
      // ── YANGI TARTIB: avval token olamiz, keyin shops'dan o'qiymiz ──
      // Sabab: shops jadvali endi RLS bilan himoyalangan —
      // token bo'lmasdan o'qib bo'lmaydi.
      let sbTokenOk = false;
      try {
        const sbAuthRes = await authLoginSupabaseTest(email, pass);
        if (sbAuthRes.ok) {
          sbTokenOk = true;
          console.log("✅ Supabase Auth token olindi — RLS xavfsizligi faol");
        } else {
          console.warn("ℹ️ Supabase Auth token olinmadi:", sbAuthRes.error);
        }
      } catch(e) {
        console.warn("ℹ️ Supabase Auth token xatosi:", e.message);
      }

      // initSupabase orqali ulanamiz — bu "Multiple GoTrueClient" ogohlantirishini oldini oladi
      // (avval token olingan, shuning uchun initSupabase token bilan ulanadi)
      if (typeof initSupabase === "function") {
        try { await initSupabase(); } catch(e) {}
      }
      const sb = _sb; // global _sb ni ishlatamiz — yangi instance yaratmaymiz

      // Token ichidagi shop_id bo'yicha qidiramiz (RLS bilan mos)
      // Agar token yo'q bo'lsa — owner_email bo'yicha (eski usul, zaxira)
      const sbSession = getSupabaseTestSession();
      let shops = null;
      if (sbSession?.shopId && sb) {
        const { data } = await sb.from("shops").select("id,name").eq("id", sbSession.shopId).limit(1);
        shops = data;
      }
      if (!shops?.length && sb) {
        const { data } = await sb.from("shops").select("id,name").eq("owner_email", email).limit(1);
        shops = data;
      }

      if (shops?.length) {
        const shop   = shops[0];
        const shopId = shop.id;
        const dbKey  = "merx_v5_" + shopId;
        let shopDB   = null;
        try { shopDB = JSON.parse(localStorage.getItem(dbKey)); } catch(e) {}

        // Settings ni HAR DOIM Supabase dan olamiz (yangi qurilma uchun ham)
        let sets = null;
        try {
          const { data: setsArr2 } = await sb.from("settings").select("*").eq("shop_id", shopId).limit(1);
          sets = setsArr2?.[0] || null;
        } catch(e) { console.warn("Settings yuklash xato:", e.message); }

        if (!shopDB) {
          shopDB = {
            shop: { name: shop.name, type: sets?.shop_type || "ikki" },
            settings: {
              rate: sets?.rate || 12800, priceCurrency: sets?.price_currency || "uzs",
              supabaseUrl: _sbUrl, supabaseKey: _sbKey
            },
            customers:[],products:[],sales:[],staff:[],
            ombor:[],xarajatlar:[],debtPayments:[],shifts:[],
            kassaBalances:{}, seq:1
          };
        }
        if (!shopDB.settings) shopDB.settings = {};
        shopDB.settings.supabaseUrl  = _sbUrl;
        shopDB.settings.supabaseKey  = _sbKey;
        shopDB.settings.cloudShopId  = shopId;
        // Settings dan bot/eskiz ma'lumotlarini har doim yangilaymiz
        if (sets) {
          if (sets.eskiz_token)           shopDB.settings.eskizToken         = sets.eskiz_token;
          if (sets.eskiz_sender)          shopDB.settings.eskizSender        = sets.eskiz_sender;
          if (sets.telegram_bot)          shopDB.settings.telegramBotUrl     = sets.telegram_bot;
          if (sets.telegram_bot_username) shopDB.settings.telegramBotUsername = sets.telegram_bot_username;
          if (sets.staff_group_id)        shopDB.settings.staffGroupId       = sets.staff_group_id;
          if (sets.loyalty_rate)          shopDB.settings.loyaltyRate        = sets.loyalty_rate;
          if (sets.loyalty_value)         shopDB.settings.loyaltyValue       = sets.loyalty_value;
          if (sets.shop_type)             shopDB.settings.shopType           = sets.shop_type;
          if (sets.shop_name)             shopDB.shop.name                   = sets.shop_name;
          if (sets.rate)                  shopDB.settings.rate               = sets.rate;
        }
        db = shopDB;

        // Parolni har doim yangilaymiz — boshqa qurilmada ham to'g'ri ishlashi uchun
        // (SuperAdmin parolni o'zgartirganda, yangi qurilmada ham mos bo'ladi)
        if (!db.settings.adminEmail) db.settings.adminEmail = email;
        db.settings.adminPass = await sha256(pass);

        res = await authLogin(email, pass, shopId);
        localStorage.setItem(dbKey, JSON.stringify(db));
      } else {
        res = await authLogin(email, pass);
      }
    } catch(e) {
      console.warn("Supabase login xato:", e.message);
      res = await authLogin(email, pass);
    }
  } else {
    res = await authLogin(email, pass);
  }

  if (btn) { btn.innerHTML = '<i class="ti ti-login"></i> Kirish'; btn.disabled = false; }

  if (res.ok) {
    hideLoginScreen();
    toast(res.firstTime ? "✅ Hisob yaratildi!" : "✅ Xush kelibsiz!");
    applyRoleUI();
    _initCloudAfterLogin();
  } else {
    showAuthErr(res.error || "Kirish xatoligi");
  }
}

function doStaffLogin() {
  const phone = (document.getElementById("auth-phone")||{value:""}).value.trim();
  const pin   = (document.getElementById("auth-pin") ||{value:""}).value;
  if (!phone || !pin) { showAuthErr("Telefon va PIN kiriting", true); return; }
  const res = authStaffLogin(phone, pin);
  if (res.ok) {
    hideLoginScreen();
    toast(`✅ Xush kelibsiz, ${res.user.name}!`);
    applyRoleUI();
    _initCloudAfterLogin();
  } else {
    showAuthErr(res.error, true);
  }
}

function showAuthErr(msg, isStaff = false) {
  const id = isStaff ? "auth-staff-err" : "auth-err";
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

function hideLoginScreen() {
  const screen = document.getElementById("auth-screen");
  if (screen) {
    screen.style.opacity = "0";
    screen.style.transition = "opacity .3s";
    setTimeout(() => screen.remove(), 300);
  }
}

// ════════════════════════════════════════════════════════════════
// ⚠️ SINOV UCHUN — Supabase Auth (yangi tizim, 2-bosqich)
// ════════════════════════════════════════════════════════════════
// Bu funksiyalar HOZIRCHA login ekraniga ULANMAGAN — faqat brauzer
// konsolida qo'lda chaqirish uchun (masalan: await authLoginSupabaseTest(...)).
// Mavjud authLogin/authLogout funksiyalariga HECH QANDAY ta'sir qilmaydi.
// Maqsad: yangi tizimni xavfsiz, alohida sinab ko'rish.
// ════════════════════════════════════════════════════════════════

let _supabaseTestSession = null; // sessiya — _authUser bilan ARALASHMAYDI
let _sbTokenRefreshTimer = null; // avtomatik yangilash timer

// Sahifa yuklanganda sessionStorage dan token va parolni tiklaymiz
(function restoreSessionFromStorage() {
  try {
    const saved = sessionStorage.getItem("merx_sb_session");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Token muddati tugaganmi tekshiramiz
      if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
        _supabaseTestSession = parsed;
      } else {
        sessionStorage.removeItem("merx_sb_session");
      }
    }
  } catch(e) {}
})();

async function authLoginSupabaseTest(email, password) {
  try {
    const res = await fetch("/api/auth-v2?action=login_test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.ok) {
      // expiresAt ni hisoblaymiz (hozirdan + expiresIn soniya)
      data.expiresAt = Date.now() + ((data.expiresIn || 3600) * 1000);
      _supabaseTestSession = data;
      // sessionStorage ga saqlaymiz — sahifa yangilanganda ham token saqlanadi
      try {
        sessionStorage.setItem("merx_sb_session", JSON.stringify(data));
      } catch(e) {}
      // ── Token avtomatik yangilash ──────────────────────────────
      if (_sbTokenRefreshTimer) clearTimeout(_sbTokenRefreshTimer);
      const refreshIn = ((data.expiresIn || 3600) - 300) * 1000; // 55 daqiqa
      _sbTokenRefreshTimer = setTimeout(async () => {
        sessionStorage.removeItem("merx_sb_session");
        _supabaseTestSession = null;
        _sb = null;
        if (typeof initSupabase === "function") {
          await initSupabase();
          console.log("ℹ️ Token muddati tugadi — anon key zaxirasiga o'tildi");
        }
      }, refreshIn);
      // ── Avtomatik yangilash qo'shildi ──────────────────────────
    } else {
      console.warn("❌ Supabase kirish xato:", data.error);
    }
    return data;
  } catch (e) {
    console.error("Supabase kirish — tarmoq xatosi:", e.message);
    return { ok: false, error: e.message };
  }
}

function getSupabaseTestSession() {
  return _supabaseTestSession;
}

function clearSupabaseTestSession() {
  _supabaseTestSession = null;
  if (_sbTokenRefreshTimer) { clearTimeout(_sbTokenRefreshTimer); _sbTokenRefreshTimer = null; }
}
