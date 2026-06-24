// MERX auth.js | v1.0 | 2026-06-24
// ═══════════════════════════════════════════════════
// Login / Session / ShopId boshqaruvi
// ═══════════════════════════════════════════════════

const AUTH_KEY   = "merx_auth_v1";   // localStorage session
const SHOP_KEY   = "merx_shop_v1";   // aktiv shopId

let _authUser = null; // { id, email, shopId, shopName, role }

// ── Session o'qish ───────────────────────────────
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
  localStorage.removeItem(SHOP_KEY);
}

function getAuthUser() { return _authUser; }
function isLoggedIn()  { return !!_authUser; }

// ── Supabase Auth orqali kirish ──────────────────
async function authLogin(email, password) {
  // AVVAL local login tekshiramiz (adminEmail/adminPass localStorage da)
  const localRes = authLocalLogin(email, password);
  if (localRes.ok) {
    // ShopId ni auth ga yozgandan keyin DB ni qayta yuklaymiz
    _reloadDBForShop();
    return localRes;
  }

  // Local hisob bo'lmasa yoki email mos kelmasa — Supabase ga urinamiz
  const url = (db?.settings?.supabaseUrl || "").trim();
  const key = (db?.settings?.supabaseKey || "").trim();
  if (!url || !key) return localRes; // Supabase yo'q — local xatoni qaytaramiz

  try {
    const { createClient } = window.supabase || supabase;
    const sb = createClient(url, key);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const userId = data.user.id;
    const { data: shops } = await sb.from("shops")
      .select("id,name,role")
      .eq("owner_id", userId)
      .limit(1);

    const shop = shops?.[0];
    const user = {
      id:       userId,
      email:    data.user.email,
      shopId:   shop?.id   || userId,
      shopName: shop?.name || "MERX Do'koni",
      role:     shop?.role || "admin",
      token:    data.session?.access_token
    };
    authSave(user);
    _reloadDBForShop();
    return { ok: true, user };
  } catch(e) {
    return localRes;
  }
}

// Login dan keyin to'g'ri shopId bilan DB qayta yuklanadi
function _reloadDBForShop() {
  if (typeof loadDB === "function" && typeof seedDB === "function") {
    const loaded = loadDB();
    if (typeof db !== "undefined") {
      // eslint-disable-next-line no-global-assign
      db = loaded || seedDB();
    }
  }
}

// ── Local login (Supabase yo'q bo'lganda) ────────
function authLocalLogin(email, password) {
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
    const user = {
      id: "local_admin", email, shopId: "local",
      shopName: db.shop?.name || "MERX Do'koni", role: "admin"
    };
    authSave(user);
    return { ok: true, user, firstTime: true };
  }

  if (email.toLowerCase() !== stored || password !== pass) {
    return { ok: false, error: "Email yoki parol noto'g'ri" };
  }
  const user = {
    id: "local_admin", email, shopId: "local",
    shopName: db.shop?.name || "MERX Do'koni", role: "admin"
  };
  authSave(user);
  return { ok: true, user };
}

// ── Xodim login (telefon + parol) ────────────────
function authStaffLogin(phone, password) {
  const staff = (db.staff||[]).find(s =>
    s.phone === phone && s.pin === password
  );
  if (!staff) return { ok: false, error: "Telefon yoki PIN noto'g'ri" };

  const user = {
    id:       "staff_" + staff.id,
    email:    staff.phone,
    staffId:  staff.id,
    shopId:   "local",
    shopName: db.shop?.name || "MERX Do'koni",
    role:     staff.role || "kassir",
    name:     staff.name
  };
  authSave(user);
  return { ok: true, user };
}

// Login dan keyin Supabase ulanish
function _initCloudAfterLogin() {
  if (!db?.settings?.supabaseUrl || !db?.settings?.supabaseKey) return;
  if (typeof initSupabase !== "function") return;
  initSupabase().then(async ok => {
    if (ok) {
      if (typeof updateCloudUI === "function") updateCloudUI(true);
      // Ma'lumot yo'q bo'lsa cloud dan yukla
      if (!db.products?.length && !db.sales?.length) {
        if (typeof pullFromCloud === "function") await pullFromCloud();
      }
    }
  });
}

// ── Chiqish ──────────────────────────────────────
function authLogout() {
  authClear();
  showLoginScreen();
}

// ── Rol tekshiruvi ───────────────────────────────
const ROLE_LEVELS = { superadmin:5, admin:4, menejer:3, kassir:2, omborchi:1 };

function hasRole(minRole) {
  const level = ROLE_LEVELS[_authUser?.role] || 0;
  return level >= (ROLE_LEVELS[minRole] || 99);
}

// Sahifalar ruxsati
const PAGE_ROLES = {
  dashboard:  "kassir",
  sotuv:      "kassir",   // data-page="sotuv"
  katalog:    "kassir",
  ombor:      "omborchi",
  mijozlar:   "kassir",
  qarzlar:    "kassir",
  qarztarix:  "kassir",
  tarix:      "kassir",
  hisobot:    "menejer",
  xodimlar:   "menejer",
  moliya:     "menejer",
  egasi:      "admin",
  portal:     "admin",
};

function canAccessPage(page) {
  const minRole = PAGE_ROLES[page] || "admin";
  return hasRole(minRole);
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
  const hasSupabase = !!(db?.settings?.supabaseUrl && db?.settings?.supabaseKey);

  screen.innerHTML = `
    <div style="width:100%;max-width:400px">
      <!-- Logo -->
      <div style="text-align:center;margin-bottom:32px">
        <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="width:44px;height:44px;background:#E9A500;border-radius:12px;display:flex;align-items:center;justify-content:center">
            <i class="ti ti-building-store" style="font-size:24px;color:#0D1B2A"></i>
          </div>
          <span style="font-size:28px;font-weight:800;color:#fff;font-family:'Sora',sans-serif">MERX</span>
        </div>
        <div style="font-size:13px;color:rgba(255,255,255,.4)">${db?.shop?.name || "Savdo boshqaruv tizimi"}</div>
      </div>

      <!-- Login forma -->
      <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:28px">
        <h2 style="color:#fff;font-size:18px;margin:0 0 6px;font-family:'Sora',sans-serif">
          ${!hasAdmin ? "Birinchi kirish" : "Kirish"}
        </h2>
        <p style="font-size:13px;color:rgba(255,255,255,.4);margin:0 0 20px">
          ${!hasAdmin ? "Administrator hisob yarating" : "Hisobingizga kiring"}
        </p>

        <!-- Tab: Admin / Xodim -->
        <div style="display:flex;background:rgba(255,255,255,.08);border-radius:10px;padding:3px;gap:3px;margin-bottom:20px" id="auth-tabs">
          <button onclick="switchAuthTab('admin')" id="tab-admin"
            style="flex:1;padding:8px;border:none;border-radius:8px;background:#E9A500;color:#0D1B2A;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">
            👤 Egasi / Admin
          </button>
          <button onclick="switchAuthTab('staff')" id="tab-staff"
            style="flex:1;padding:8px;border:none;border-radius:8px;background:transparent;color:rgba(255,255,255,.5);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit">
            💼 Xodim
          </button>
        </div>

        <!-- Admin login -->
        <div id="auth-admin-form">
          <div style="margin-bottom:12px">
            <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px;font-weight:600">EMAIL</label>
            <input id="auth-email" type="email" placeholder="admin@example.com" autocomplete="email"
              style="width:100%;padding:11px 14px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.15);
              border-radius:10px;color:#fff;font-family:inherit;font-size:14px;box-sizing:border-box;outline:none"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
              onkeydown="if(event.key==='Enter')document.getElementById('auth-pass').focus()">
          </div>
          <div style="margin-bottom:20px">
            <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px;font-weight:600">PAROL</label>
            <div style="position:relative">
              <input id="auth-pass" type="password" placeholder="••••••••" autocomplete="current-password"
                style="width:100%;padding:11px 40px 11px 14px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.15);
                border-radius:10px;color:#fff;font-family:inherit;font-size:14px;box-sizing:border-box;outline:none"
                onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
                onkeydown="if(event.key==='Enter')doLogin()">
              <button onclick="toggleAuthPass()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);
                background:none;border:none;cursor:pointer;color:rgba(255,255,255,.4);padding:0">
                <i class="ti ti-eye" id="auth-eye" style="font-size:16px"></i>
              </button>
            </div>
          </div>
          <div id="auth-err" style="display:none;background:#FEE2E2;color:#991B1B;border-radius:8px;
            padding:10px 14px;font-size:13px;margin-bottom:12px;font-weight:600"></div>
          <button onclick="doLogin()" id="auth-btn"
            style="width:100%;padding:13px;background:#E9A500;border:none;border-radius:12px;
            color:#0D1B2A;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;
            transition:opacity .15s" onmouseover="this.style.opacity='.9'" onmouseout="this.style.opacity='1'">
            <i class="ti ti-login"></i> ${!hasAdmin ? "Hisob yaratish" : "Kirish"}
          </button>
        </div>

        <!-- Xodim login -->
        <div id="auth-staff-form" style="display:none">
          <div style="margin-bottom:12px">
            <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px;font-weight:600">TELEFON</label>
            <input id="auth-phone" type="tel" placeholder="+998 90 000 00 00"
              style="width:100%;padding:11px 14px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.15);
              border-radius:10px;color:#fff;font-family:inherit;font-size:14px;box-sizing:border-box;outline:none"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
              onkeydown="if(event.key==='Enter')document.getElementById('auth-pin').focus()">
          </div>
          <div style="margin-bottom:20px">
            <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px;font-weight:600">PIN KOD</label>
            <input id="auth-pin" type="password" placeholder="••••" maxlength="6" inputmode="numeric"
              style="width:100%;padding:11px 14px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.15);
              border-radius:10px;color:#fff;font-family:inherit;font-size:20px;letter-spacing:8px;box-sizing:border-box;outline:none"
              onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
              onkeydown="if(event.key==='Enter')doStaffLogin()">
          </div>
          <div id="auth-staff-err" style="display:none;background:#FEE2E2;color:#991B1B;border-radius:8px;
            padding:10px 14px;font-size:13px;margin-bottom:12px;font-weight:600"></div>
          <button onclick="doStaffLogin()"
            style="width:100%;padding:13px;background:#E9A500;border:none;border-radius:12px;
            color:#0D1B2A;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
            <i class="ti ti-login"></i> Kirish
          </button>
        </div>
      </div>

      <div style="text-align:center;margin-top:20px;font-size:12px;color:rgba(255,255,255,.2)">
        MERX © 2026 · Savdo boshqaruv tizimi
      </div>
    </div>
  `;

  // Email ga focus
  setTimeout(() => { const el = document.getElementById("auth-email"); if(el) el.focus(); }, 100);
}

function switchAuthTab(tab) {
  const isAdmin = tab === "admin";
  document.getElementById("auth-admin-form").style.display = isAdmin ? "block" : "none";
  document.getElementById("auth-staff-form").style.display = isAdmin ? "none"  : "block";
  document.getElementById("tab-admin").style.background    = isAdmin ? "#E9A500" : "transparent";
  document.getElementById("tab-admin").style.color         = isAdmin ? "#0D1B2A" : "rgba(255,255,255,.5)";
  document.getElementById("tab-staff").style.background    = isAdmin ? "transparent" : "#E9A500";
  document.getElementById("tab-staff").style.color         = isAdmin ? "rgba(255,255,255,.5)" : "#0D1B2A";
  if (isAdmin) setTimeout(()=>{ document.getElementById("auth-email")?.focus(); },50);
  else         setTimeout(()=>{ document.getElementById("auth-phone")?.focus(); },50);
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
  const errEl = document.getElementById("auth-err");
  const btn   = document.getElementById("auth-btn");

  if (!email || !pass) { showAuthErr("Email va parol kiriting"); return; }

  if (btn) { btn.innerHTML = '<i class="ti ti-loader spin"></i> Tekshirilmoqda...'; btn.disabled = true; }

  const res = await authLogin(email, pass);

  if (btn) { btn.innerHTML = `<i class="ti ti-login"></i> Kirish`; btn.disabled = false; }

  if (res.ok) {
    hideLoginScreen();
    if (res.firstTime) toast("✅ Administrator hisob yaratildi. Xush kelibsiz!");
    else toast(`✅ Xush kelibsiz, ${res.user.email}!`);
    // Menyu va sahifalarni roleга qarab sozlash
    applyRoleUI();
    // Login dan keyin Supabase ulanish
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
    // Kassir uchun avtomatik POS ga o'tish
    if (res.user.role === "kassir") {
      setTimeout(() => { if (typeof nav === "function") nav("pos"); }, 300);
    }
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

// ── Rol asosida UI sozlash ────────────────────────
function applyRoleUI() {
  const user = _authUser;
  if (!user) return;

  // Sidebar foydalanuvchi info
  const userEl = document.getElementById("auth-user-name");
  if (userEl) userEl.textContent = user.name || user.email || "Foydalanuvchi";

  const roleEl = document.getElementById("auth-user-role");
  if (roleEl) {
    const labels = { admin:"Admin", menejer:"Menejer", kassir:"Kassir", omborchi:"Omborchi", superadmin:"Super Admin" };
    roleEl.textContent = labels[user.role] || user.role;
  }

  // Topbar foydalanuvchi
  const topBtn  = document.getElementById("auth-topbar-btn");
  const topName = document.getElementById("auth-topbar-name");
  if (topBtn)  topBtn.style.display  = "flex";
  if (topName) topName.textContent   = user.name || user.email?.split("@")[0] || "Foydalanuvchi";

  // Sidebar menyu elementlarini yashirish/ko'rsatish
  document.querySelectorAll("[data-page]").forEach(el => {
    const page = el.dataset.page;
    el.style.display = (page && !canAccessPage(page)) ? "none" : "";
  });

  // Bo'sh sidebar group larni ham yashirish
  document.querySelectorAll(".ns-group").forEach(group => {
    const visibleItems = [...group.querySelectorAll(".ni")].filter(
      ni => ni.style.display !== "none"
    );
    const toggle = group.previousElementSibling;
    if (toggle) toggle.style.display = visibleItems.length ? "" : "none";
    group.style.display = visibleItems.length ? "" : "none";
  });

  // Admin / menejer only
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = hasRole("admin") ? "" : "none";
  });
  document.querySelectorAll(".menejer-only").forEach(el => {
    el.style.display = hasRole("menejer") ? "" : "none";
  });
}

// ── App init — sahifa ochilganda ─────────────────
function initAuth() {
  const user = authLoad();
  if (!user) {
    showLoginScreen();
    return false;
  }
  // Session bor — UI sozlash
  applyRoleUI();
  return true;
}

// ── Chiqish tugmasi ──────────────────────────────
function logoutConfirm() {
  if (confirm("Tizimdan chiqasizmi?")) authLogout();
}
