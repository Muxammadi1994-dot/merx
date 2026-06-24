// MERX auth.js | v3.0 | Multi-tenant
// ================================================
// Sodda, toza arxitektura:
// - Session: merx_auth_v1 = {shopId, dbKey, email, role, ...}
// - Login → session → loadDB(dbKey) → cloud sync
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

// ── Login ─────────────────────────────────────────
// shopId: agar boshqa do'konga kirmoqchi bo'lsa kiritiladi
async function authLogin(email, password, shopId) {
  // db dan admin email/pass tekshiramiz
  // (db allaqachon dbKey asosida yuklangan)
  const stored = db?.settings?.adminEmail;
  const pass   = db?.settings?.adminPass;

  if (!stored) {
    // Birinchi kirish — hisob yaratish
    if (!email || !password || password.length < 4) {
      return { ok: false, error: "Email va kamida 4 ta belgili parol kiriting" };
    }
    if (!db.settings) db.settings = {};
    db.settings.adminEmail = email.toLowerCase();
    db.settings.adminPass  = password;
    saveDB();
    const user = _buildUser(email, shopId);
    authSave(user);
    return { ok: true, user, firstTime: true };
  }

  if (email.toLowerCase() !== stored || password !== pass) {
    return { ok: false, error: "Email yoki parol noto'g'ri" };
  }

  const user = _buildUser(email, shopId);
  authSave(user);
  return { ok: true, user };
}

function _buildUser(email, shopId) {
  const sid   = shopId || getShopId();
  const dbKey = sid === "local" ? "merx_v5" : "merx_v5_" + sid;
  return {
    id:       sid === "local" ? "local_admin" : "admin_" + sid,
    email,
    shopId:   sid,
    dbKey,
    shopName: db?.shop?.name || "MERX Do'koni",
    role:     "admin"
  };
}

// ── Xodim login ──────────────────────────────────
function authStaffLogin(phone, password) {
  const staff = (db.staff||[]).find(s => s.phone === phone && s.pin === password);
  if (!staff) return { ok: false, error: "Telefon yoki PIN noto'g'ri" };
  const sid   = getShopId();
  const dbKey = sid === "local" ? "merx_v5" : "merx_v5_" + sid;
  const user = {
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
  showLoginScreen();
}

function logoutConfirm() {
  if (confirm("Tizimdan chiqasizmi?")) authLogout();
}

// ── Rol tizimi ───────────────────────────────────
const ROLE_LEVELS = { superadmin:5, admin:4, menejer:3, kassir:2, omborchi:1 };

function hasRole(minRole) {
  const level = ROLE_LEVELS[_authUser?.role] || 0;
  return level >= (ROLE_LEVELS[minRole] || 99);
}

const PAGE_ROLES = {
  dashboard:"kassir", sotuv:"kassir", katalog:"kassir",
  ombor:"omborchi", mijozlar:"kassir", qarzlar:"kassir",
  qarztarix:"kassir", tarix:"kassir",
  hisobot:"menejer", xodimlar:"menejer", moliya:"menejer",
  egasi:"admin", portal:"admin",
};

function canAccessPage(page) {
  const minRole = PAGE_ROLES[page] || "admin";
  return hasRole(minRole);
}

// ── applyRoleUI ───────────────────────────────────
function applyRoleUI() {
  const user = _authUser;
  if (!user) return;

  // Sidebar foydalanuvchi
  const userEl = document.getElementById("auth-user-name");
  if (userEl) userEl.textContent = user.name || user.email || "Foydalanuvchi";

  const roleEl = document.getElementById("auth-user-role");
  if (roleEl) {
    const labels = { admin:"Admin", menejer:"Menejer", kassir:"Kassir", omborchi:"Omborchi", superadmin:"Super" };
    roleEl.textContent = labels[user.role] || user.role;
  }

  // Topbar
  const topBtn  = document.getElementById("auth-topbar-btn");
  const topName = document.getElementById("auth-topbar-name");
  if (topBtn)  topBtn.style.display = "flex";
  if (topName) topName.textContent  = user.name || (user.email?.split("@")[0] || "").slice(0, 14);

  // Menyu
  document.querySelectorAll("[data-page]").forEach(el => {
    el.style.display = canAccessPage(el.dataset.page) ? "" : "none";
  });

  // Bo'sh group larni yashirish
  document.querySelectorAll(".ns-group").forEach(group => {
    const visible = [...group.querySelectorAll(".ni")].some(ni => ni.style.display !== "none");
    if (group.previousElementSibling) group.previousElementSibling.style.display = visible ? "" : "none";
    group.style.display = visible ? "" : "none";
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
  if (!user) {
    showLoginScreen();
    return false;
  }

  // dbKey asosida DB ni qayta yuklaymiz
  if (user.dbKey) {
    try {
      const raw = localStorage.getItem(user.dbKey);
      if (raw) db = JSON.parse(raw);
    } catch(e) {}
  }

  applyRoleUI();
  return true;
}

// ── Cloud sync ────────────────────────────────────
function _initCloudAfterLogin() {
  // URL/Key: 1) db.settings, 2) global config
  let url = db?.settings?.supabaseUrl;
  let key = db?.settings?.supabaseKey;

  if (!url && typeof MERX_SUPABASE_URL !== "undefined") url = MERX_SUPABASE_URL;
  if (!key && typeof MERX_SUPABASE_KEY !== "undefined") key = MERX_SUPABASE_KEY;

  if (!url || !key) return;

  // Settings ga yozamiz
  if (db?.settings) {
    if (!db.settings.supabaseUrl) db.settings.supabaseUrl = url;
    if (!db.settings.supabaseKey) db.settings.supabaseKey = key;
    saveDB();
  }

  if (typeof initSupabase !== "function") return;
  initSupabase().then(async ok => {
    if (!ok) return;
    if (typeof updateCloudUI === "function") updateCloudUI(true);
    const isEmpty = !db.products?.length && !db.sales?.length;
    if (isEmpty) {
      if (typeof pullFromCloud === "function") {
        await pullFromCloud();
        saveDB();
        if (typeof renderDashboard === "function") renderDashboard();
      }
    } else {
      if (typeof pushToCloud === "function") pushToCloud();
    }
  });
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

  const hasAdmin  = !!(db?.settings?.adminEmail);
  const shopName  = db?.shop?.name || "MERX Savdo tizimi";

  screen.innerHTML = `
    <div style="width:100%;max-width:400px">
      <div style="text-align:center;margin-bottom:32px">
        <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="width:44px;height:44px;background:#E9A500;border-radius:12px;display:flex;align-items:center;justify-content:center">
            <i class="ti ti-building-store" style="font-size:24px;color:#0D1B2A"></i>
          </div>
          <span style="font-size:28px;font-weight:800;color:#fff;font-family:'Sora',sans-serif">MERX</span>
        </div>
        <div style="font-size:13px;color:rgba(255,255,255,.4)">${shopName}</div>
      </div>

      <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:28px">
        <h2 style="color:#fff;font-size:18px;margin:0 0 6px;font-family:'Sora',sans-serif">
          ${!hasAdmin ? "Hisob yaratish" : "Kirish"}
        </h2>
        <p style="font-size:13px;color:rgba(255,255,255,.4);margin:0 0 20px">
          ${!hasAdmin ? "Administrator hisob yarating" : "Hisobingizga kiring"}
        </p>

        <!-- Tab -->
        <div style="display:flex;background:rgba(255,255,255,.08);border-radius:10px;padding:3px;gap:3px;margin-bottom:20px">
          <button onclick="switchAuthTab('admin')" id="tab-admin"
            style="flex:1;padding:8px;border:none;border-radius:8px;background:#E9A500;color:#0D1B2A;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">
            👤 Egasi / Admin
          </button>
          <button onclick="switchAuthTab('staff')" id="tab-staff"
            style="flex:1;padding:8px;border:none;border-radius:8px;background:transparent;color:rgba(255,255,255,.5);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit">
            💼 Xodim
          </button>
        </div>

        <!-- Admin forma -->
        <div id="auth-admin-form">
          <div style="margin-bottom:12px">
            <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px;font-weight:600">EMAIL</label>
            <input id="auth-email" type="email" placeholder="admin@example.com" autocomplete="email"
              style="width:100%;padding:11px 14px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-family:inherit;font-size:14px;box-sizing:border-box;outline:none"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
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
              style="width:100%;padding:11px 14px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-family:inherit;font-size:14px;box-sizing:border-box;outline:none"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
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
      </div>
      <div style="text-align:center;margin-top:20px;font-size:12px;color:rgba(255,255,255,.2)">MERX © 2026</div>
    </div>`;

  setTimeout(() => { document.getElementById("auth-email")?.focus(); }, 100);
}

function switchAuthTab(tab) {
  const isAdmin = tab === "admin";
  document.getElementById("auth-admin-form").style.display = isAdmin ? "block" : "none";
  document.getElementById("auth-staff-form").style.display = isAdmin ? "none"  : "block";
  document.getElementById("tab-admin").style.cssText = isAdmin
    ? "flex:1;padding:8px;border:none;border-radius:8px;background:#E9A500;color:#0D1B2A;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit"
    : "flex:1;padding:8px;border:none;border-radius:8px;background:transparent;color:rgba(255,255,255,.5);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit";
  document.getElementById("tab-staff").style.cssText = isAdmin
    ? "flex:1;padding:8px;border:none;border-radius:8px;background:transparent;color:rgba(255,255,255,.5);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit"
    : "flex:1;padding:8px;border:none;border-radius:8px;background:#E9A500;color:#0D1B2A;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit";
  setTimeout(() => {
    if (isAdmin) document.getElementById("auth-email")?.focus();
    else document.getElementById("auth-phone")?.focus();
  }, 50);
}

function toggleAuthPass() {
  const inp = document.getElementById("auth-pass");
  const ico = document.getElementById("auth-eye");
  if (!inp) return;
  inp.type = inp.type === "password" ? "text" : "password";
  if (ico) ico.className = inp.type === "password" ? "ti ti-eye" : "ti ti-eye-off";
}

async function doLogin() {
  const email = (document.getElementById("auth-email")||{value:""}).value.trim();
  const pass  = (document.getElementById("auth-pass") ||{value:""}).value;
  const btn   = document.getElementById("auth-btn");

  if (!email || !pass) { showAuthErr("Email va parol kiriting"); return; }
  if (btn) { btn.innerHTML = '<i class="ti ti-loader spin"></i> Tekshirilmoqda...'; btn.disabled = true; }

  // 1. Avval local DB da tekshirish
  let res = await authLogin(email, pass);

  // 2. Local da topilmadi — Supabase dan do'konni topamiz
  if (!res.ok && (typeof MERX_SUPABASE_URL !== "undefined")) {
    try {
      const { createClient } = window.supabase || supabase;
      const sb = createClient(MERX_SUPABASE_URL, MERX_SUPABASE_KEY,
        { auth: { persistSession: false } });

      // shops jadvalidan email bo'yicha topamiz
      const { data: shops } = await sb.from("shops")
        .select("id,name")
        .eq("owner_email", email.toLowerCase())
        .limit(1);

      if (shops?.length) {
        const shop    = shops[0];
        const shopId  = shop.id;
        const dbKey   = "merx_v5_" + shopId;

        // settings jadvalidan parol tekshiramiz
        const { data: sets } = await sb.from("settings")
          .select("*").eq("shop_id", shopId).single();

        if (sets) {
          // Local DB ga settings ni yozamiz
          if (!localStorage.getItem(dbKey)) {
            const shopDB = {
              shop: { name: shop.name, type: "ikki" },
              settings: {
                rate: sets.rate || 12800,
                priceCurrency: sets.price_currency || "uzs",
                adminEmail: email.toLowerCase(),
                adminPass: pass,
                supabaseUrl: MERX_SUPABASE_URL,
                supabaseKey: MERX_SUPABASE_KEY
              },
              customers:[], products:[], sales:[], staff:[],
              ombor:[], xarajatlar:[], debtPayments:[], shifts:[],
              kassaBalances:{}, seq: 1
            };
            localStorage.setItem(dbKey, JSON.stringify(shopDB));
          }

          // DB ni yuklaymiz
          try { db = JSON.parse(localStorage.getItem(dbKey)); } catch(e) {}

          // Login tekshirish
          res = await authLogin(email, pass, shopId);

          if (!res.ok) {
            // Parol DB da yo'q — birinchi kirish sifatida qabul qilamiz
            db.settings.adminEmail = email.toLowerCase();
            db.settings.adminPass  = pass;
            localStorage.setItem(dbKey, JSON.stringify(db));
            res = await authLogin(email, pass, shopId);
          }
        }
      }
    } catch(e) {
      console.warn("Supabase login xato:", e.message);
    }
  }

  if (btn) { btn.innerHTML = '<i class="ti ti-login"></i> Kirish'; btn.disabled = false; }

  if (res.ok) {
    hideLoginScreen();
    toast(res.firstTime ? "✅ Hisob yaratildi!" : `✅ Xush kelibsiz!`);
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
