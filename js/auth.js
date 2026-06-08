// ════════════════════════════════════════════════
// MERX — js/auth.js  (Login / Auth tizimi)
// ════════════════════════════════════════════════
// 3 daraja:
//   superadmin — sayt egasi (barcha do'konlar)
//   owner      — do'kon egasi (o'z do'koni)
//   staff      — kassir/xodim (ruxsat berilgan bo'limlar)

const AUTH_KEY      = "merx_auth_v1";
const SUPERADMIN_HASH = "merx2024super"; // Oddiy hash — keyinroq bcrypt bilan almashtiriladi

// Ruxsat matritsasi — har rol uchun bo'limlar
const ROLE_PERMS = {
  superadmin: {
    pages:  ["dashboard","sotuv","katalog","ombor","mijozlar","qarzlar","tarix","hisobot","xodimlar","moliya","egasi"],
    canEdit: true, canDelete: true, canViewFinance: true, canManageStaff: true,
    canViewCost: true, canExport: true, canSettings: true
  },
  owner: {
    pages:  ["dashboard","sotuv","katalog","ombor","mijozlar","qarzlar","tarix","hisobot","xodimlar","moliya","egasi"],
    canEdit: true, canDelete: true, canViewFinance: true, canManageStaff: true,
    canViewCost: true, canExport: true, canSettings: true
  },
  menejer: {
    pages:  ["dashboard","sotuv","katalog","ombor","mijozlar","qarzlar","tarix","hisobot"],
    canEdit: true, canDelete: false, canViewFinance: true, canManageStaff: false,
    canViewCost: true, canExport: true, canSettings: false
  },
  kassir: {
    pages:  ["dashboard","sotuv","mijozlar","qarzlar","tarix"],
    canEdit: false, canDelete: false, canViewFinance: false, canManageStaff: false,
    canViewCost: false, canExport: false, canSettings: false
  }
};

// Joriy sessiya
let _authSession = null;

// ── Sessiyani yuklash ─────────────────────────────
function authLoad() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (raw) _authSession = JSON.parse(raw);
  } catch(e) { _authSession = null; }
}

function authSave() {
  try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(_authSession)); }
  catch(e) {}
}

// ── Kirish tekshiruvi ─────────────────────────────
function authCheck() {
  authLoad();
  // Agar parol o'rnatilmagan bo'lsa — login shart emas
  const ownerPin = db.settings?.ownerPin;
  if (!ownerPin) {
    _authSession = { role:"owner", name: db.shop?.name || "Ega", staffId: null };
    authSave();
    return true;
  }
  if (_authSession) return true;
  // Login ekrani — appni yashiramiz
  const app = document.getElementById("app");
  if (app) app.style.display = "none";
  showLoginScreen();
  return false;
}

function authIsLoggedIn() { return !!_authSession; }

function authRole()  { return _authSession?.role  || "kassir"; }
function authName()  { return _authSession?.name  || ""; }
function authStaffId(){ return _authSession?.staffId || null; }

// ── Ruxsat tekshiruvi ─────────────────────────────
function canDo(perm) {
  const role = authRole();
  return !!(ROLE_PERMS[role]?.[perm]);
}

function canSeePage(pageId) {
  const role = authRole();
  return (ROLE_PERMS[role]?.pages || []).includes(pageId);
}

// ── Login ekranini ko'rsatish ─────────────────────
function showLoginScreen() {
  const app = document.getElementById("app");
  if (!app) return;
  app.style.display = "none";

  let loginEl = document.getElementById("login-screen");
  if (!loginEl) {
    loginEl = document.createElement("div");
    loginEl.id = "login-screen";
    document.body.appendChild(loginEl);
  }

  const shopName = db.shop?.name || "MERX";
  loginEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#0D1B2A 0%,#1a2f44 100%);font-family:'DM Sans',sans-serif">
      <div style="background:#fff;border-radius:20px;padding:36px 40px;width:100%;max-width:380px;
        box-shadow:0 24px 60px rgba(0,0,0,.3);text-align:center">

        <!-- Logo -->
        <div style="width:64px;height:64px;background:#0D1B2A;border-radius:16px;
          display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <span style="color:#E9A500;font-weight:900;font-size:22px">MX</span>
        </div>
        <h2 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#0D1B2A">${shopName}</h2>
        <p style="margin:0 0 28px;font-size:13px;color:#aaa">Tizimga kirish</p>

        <!-- Xato xabari -->
        <div id="login-err" style="display:none;background:#FEF2F2;color:#DC2626;
          border-radius:8px;padding:9px 14px;font-size:13px;margin-bottom:16px;text-align:left"></div>

        <!-- Rol tanlash -->
        <div style="display:flex;gap:8px;margin-bottom:20px">
          <button class="login-role-btn on" data-role="owner" onclick="loginRolePick(this)"
            style="flex:1;padding:10px;border-radius:10px;border:2px solid #0D1B2A;background:#0D1B2A;
            color:#E9A500;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
            👑 Ega
          </button>
          <button class="login-role-btn" data-role="kassir" onclick="loginRolePick(this)"
            style="flex:1;padding:10px;border-radius:10px;border:2px solid #e5e7eb;background:#fff;
            color:#555;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
            💼 Kassir
          </button>
          <button class="login-role-btn" data-role="menejer" onclick="loginRolePick(this)"
            style="flex:1;padding:10px;border-radius:10px;border:2px solid #e5e7eb;background:#fff;
            color:#555;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
            📊 Menejer
          </button>
        </div>

        <!-- Kassir tanlash (kassir roli bo'lganda) -->
        <div id="login-staff-wrap" style="display:none;margin-bottom:16px;text-align:left">
          <label style="font-size:12px;color:#888;font-weight:600;margin-bottom:5px;display:block">Xodimni tanlang</label>
          <select id="login-staff-sel"
            style="width:100%;font-family:inherit;font-size:14px;border:2px solid #e5e7eb;
            border-radius:10px;padding:10px 12px;background:#fff">
            <option value="">— Tanlang —</option>
          </select>
        </div>

        <!-- PIN / Parol input -->
        <div style="margin-bottom:20px;text-align:left">
          <label id="login-pin-lbl" style="font-size:12px;color:#888;font-weight:600;margin-bottom:5px;display:block">
            Parol
          </label>
          <!-- PIN display (4 ta box) -->
          <div id="login-pin-boxes" style="display:none;justify-content:center;gap:10px;margin-bottom:12px">
            ${[0,1,2,3].map(i=>`<div id="pinbox-${i}" style="width:44px;height:54px;border:2px solid #e5e7eb;
              border-radius:10px;display:flex;align-items:center;justify-content:center;
              font-size:22px;font-weight:800;color:#0D1B2A">•</div>`).join("")}
          </div>
          <input id="login-pass" type="password" placeholder="Parolni kiriting..."
            onkeydown="if(event.key==='Enter')doLogin()"
            style="width:100%;box-sizing:border-box;font-family:inherit;font-size:15px;
            border:2px solid #e5e7eb;border-radius:10px;padding:12px 16px;outline:none;
            transition:border-color .2s"
            onfocus="this.style.borderColor='#0D1B2A'"
            onblur="this.style.borderColor='#e5e7eb'">
        </div>

        <!-- PIN klaviatura (kassir uchun) -->
        <div id="login-numpad" style="display:none;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
          ${[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map(n=>`
            <button onclick="pinPress('${n}')"
              style="padding:14px;border:1.5px solid #e5e7eb;border-radius:10px;background:#fff;
              font-family:inherit;font-size:18px;font-weight:700;cursor:pointer;color:#0D1B2A;
              ${n===""?"visibility:hidden":""}">${n}</button>`).join("")}
        </div>

        <button onclick="doLogin()"
          style="width:100%;padding:14px;background:#E9A500;border:none;border-radius:12px;
          font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;color:#0D1B2A;
          transition:opacity .2s" onmouseover="this.style.opacity='.9'" onmouseout="this.style.opacity='1'">
          Kirish →
        </button>

        <p style="margin:16px 0 0;font-size:11.5px;color:#ccc">
          MERX Savdo tizimi
        </p>
      </div>
    </div>`;

  loginEl.style.display = "block";
  _loginRole = "owner";
  _loginPin  = "";
  renderLoginStaffList();
  setTimeout(() => { const p = document.getElementById("login-pass"); if(p) p.focus(); }, 100);
}

let _loginRole = "owner";
let _loginPin  = "";

function loginRolePick(btn) {
  document.querySelectorAll(".login-role-btn").forEach(b => {
    b.style.background  = "#fff";
    b.style.color       = "#555";
    b.style.borderColor = "#e5e7eb";
  });
  btn.style.background  = "#0D1B2A";
  btn.style.color       = "#E9A500";
  btn.style.borderColor = "#0D1B2A";
  _loginRole = btn.dataset.role;
  _loginPin  = "";

  const staffWrap  = document.getElementById("login-staff-wrap");
  const numpad     = document.getElementById("login-numpad");
  const pinBoxes   = document.getElementById("login-pin-boxes");
  const passInput  = document.getElementById("login-pass");
  const pinLbl     = document.getElementById("login-pin-lbl");

  if (_loginRole === "kassir") {
    if (staffWrap)  staffWrap.style.display  = "block";
    if (numpad)     numpad.style.display     = "grid";
    if (pinBoxes)   pinBoxes.style.display   = "flex";
    if (passInput)  passInput.style.display  = "none";
    if (pinLbl)     pinLbl.textContent       = "PIN kod";
  } else {
    if (staffWrap)  staffWrap.style.display  = "none";
    if (numpad)     numpad.style.display     = "none";
    if (pinBoxes)   pinBoxes.style.display   = "none";
    if (passInput)  passInput.style.display  = "block";
    if (pinLbl)     pinLbl.textContent       = "Parol";
    updatePinBoxes();
    setTimeout(() => { if(passInput) passInput.focus(); }, 50);
  }
  updatePinBoxes();
}

function renderLoginStaffList() {
  const sel = document.getElementById("login-staff-sel"); if (!sel) return;
  const staffWithPin = (db.staff||[]).filter(s => s.pin);
  sel.innerHTML = '<option value="">— Tanlang —</option>' +
    staffWithPin.map(s => `<option value="${s.id}">${s.name} (${s.role||"kassir"})</option>`).join("");
}

function pinPress(val) {
  if (val === "⌫") {
    _loginPin = _loginPin.slice(0, -1);
  } else if (val !== "" && _loginPin.length < 4) {
    _loginPin += val;
  }
  updatePinBoxes();
  if (_loginPin.length === 4) {
    setTimeout(doLogin, 200);
  }
}

function updatePinBoxes() {
  for (let i = 0; i < 4; i++) {
    const box = document.getElementById(`pinbox-${i}`);
    if (!box) continue;
    box.textContent = i < _loginPin.length ? "●" : "○";
    box.style.borderColor = i < _loginPin.length ? "#0D1B2A" : "#e5e7eb";
    box.style.background  = i < _loginPin.length ? "#f8f9fa" : "#fff";
  }
}

// ── Kirish tekshiruvi ─────────────────────────────
function doLogin() {
  const errEl = document.getElementById("login-err");
  function showErr(msg) {
    if (errEl) { errEl.textContent = msg; errEl.style.display = "block"; }
    // Titratish animatsiyasi
    const card = errEl?.closest("div[style*='background:#fff']");
    if (card) {
      card.style.animation = "shake .4s";
      setTimeout(() => card.style.animation = "", 400);
    }
  }

  if (_loginRole === "kassir") {
    // Kassir: xodim + PIN
    const staffId = parseInt(document.getElementById("login-staff-sel")?.value) || 0;
    if (!staffId) { showErr("Xodimni tanlang"); return; }
    const staff = (db.staff||[]).find(s => s.id === staffId);
    if (!staff) { showErr("Xodim topilmadi"); return; }
    if (!staff.pin) { showErr("Bu xodim uchun PIN o'rnatilmagan"); return; }
    if (staff.pin !== _loginPin) { showErr("PIN noto'g'ri"); _loginPin = ""; updatePinBoxes(); return; }

    const role = staff.role === "menejer" ? "menejer" : "kassir";
    _authSession = { role, name: staff.name, staffId: staff.id };

  } else if (_loginRole === "menejer") {
    const pass = document.getElementById("login-pass")?.value || "";
    if (!db.settings.menejerPassword) { showErr("Menejer paroli o'rnatilmagan"); return; }
    if (pass !== db.settings.menejerPassword) { showErr("Parol noto'g'ri"); return; }
    _authSession = { role:"menejer", name:"Menejer", staffId: null };

  } else {
    // Owner: parol
    const pass = document.getElementById("login-pass")?.value || "";
    if (!db.settings.ownerPin) { showErr("Ega paroli o'rnatilmagan"); return; }
    if (pass !== db.settings.ownerPin) { showErr("Parol noto'g'ri"); return; }
    _authSession = { role:"owner", name: db.shop?.name || "Ega", staffId: null };
  }

  authSave();
  hideLoginScreen();
  applyRoleUI();
  toast(`✅ Xush kelibsiz, ${_authSession.name}!`);
}

// ── Chiqish ───────────────────────────────────────
function authLogout() {
  if (!confirm("Tizimdan chiqasizmi?")) return;
  _authSession = null;
  try { sessionStorage.removeItem(AUTH_KEY); } catch(e) {}
  showLoginScreen();
}

function hideLoginScreen() {
  const loginEl = document.getElementById("login-screen");
  if (loginEl) loginEl.style.display = "none";
  const app = document.getElementById("app");
  if (app) app.style.display = "flex"; // sidebar + main flex layout
}

// ── Rol bo'yicha UI sozlash ───────────────────────
function applyRoleUI() {
  const role  = authRole();
  const perms = ROLE_PERMS[role] || ROLE_PERMS.kassir;

  // Sidebar havolalarni yashirish/ko'rsatish
  // data-page atributi bilan .ni elementlarini boshqaramiz
  document.querySelectorAll(".ni[data-page]").forEach(el => {
    const page = el.dataset.page;
    el.style.display = perms.pages.includes(page) ? "" : "none";
  });

  // Topbar da foydalanuvchi ko'rsatish
  updateAuthTopbar();
}

// ── Topbar da foydalanuvchi ────────────────────────
function updateAuthTopbar() {
  const el = document.getElementById("auth-topbar-btn"); if (!el) return;
  const role  = authRole();
  const roleIcon = { owner:"👑", menejer:"📊", kassir:"💼", superadmin:"⚡" };
  const name = authName() || role;
  el.innerHTML = `${roleIcon[role]||"👤"} ${name} <i class="ti ti-chevron-down" style="font-size:11px"></i>`;
}

// ── PIN boshqaruvi (egasi sozlamalarida) ──────────
function saveOwnerPassword() {
  const cur = ($("owner-cur-pass")||{value:""}).value;
  const nw  = ($("owner-new-pass")||{value:""}).value;
  const rep = ($("owner-rep-pass")||{value:""}).value;

  // Birinchi marta o'rnatilayotgan bo'lsa
  if (db.settings.ownerPin && cur !== db.settings.ownerPin) {
    toast("Joriy parol noto'g'ri","err"); return;
  }
  if (nw.length < 4) { toast("Parol kamida 4 ta belgi","err"); return; }
  if (nw !== rep)    { toast("Parollar mos kelmadi","err"); return; }

  db.settings.ownerPin = nw;
  saveDB();
  toast("✅ Parol saqlandi");
  if ($("owner-cur-pass")) $("owner-cur-pass").value = "";
  if ($("owner-new-pass")) $("owner-new-pass").value = "";
  if ($("owner-rep-pass")) $("owner-rep-pass").value = "";
}

function saveStaffPin(staffId) {
  const pin = ($("staff-pin-"+staffId)||{value:""}).value;
  if (pin && (pin.length < 4 || !/^\d+$/.test(pin))) {
    toast("PIN 4 ta raqam bo'lishi kerak","err"); return;
  }
  const s = (db.staff||[]).find(x => x.id === staffId);
  if (!s) return;
  s.pin = pin || null;
  saveDB();
  toast(pin ? `✅ ${s.name} uchun PIN saqlandi` : `${s.name} PIN o'chirildi`);
}

// ── Auth menu (topbar) ───────────────────────────
function showAuthMenu() {
  const menu = document.getElementById("auth-menu"); if (!menu) return;
  const isOpen = menu.style.display !== "none";
  menu.style.display = isOpen ? "none" : "block";
  if (!isOpen) {
    const role  = authRole();
    const roleNames = { owner:"👑 Do'kon egasi", menejer:"📊 Menejer", kassir:"💼 Kassir", superadmin:"⚡ Super admin" };
    const nameEl = document.getElementById("auth-menu-name");
    const roleEl = document.getElementById("auth-menu-role");
    if (nameEl) nameEl.textContent = authName();
    if (roleEl) roleEl.textContent = roleNames[role] || role;
    // Tashqarini bosganda yopilsin
    setTimeout(() => {
      document.addEventListener("click", function closeMenu(e) {
        if (!e.target.closest("#auth-menu") && !e.target.closest("#auth-topbar-btn")) {
          menu.style.display = "none";
          document.removeEventListener("click", closeMenu);
        }
      });
    }, 10);
  }
}

// CSS animatsiya
const _authStyle = document.createElement("style");
_authStyle.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-8px)}
    40%{transform:translateX(8px)}
    60%{transform:translateX(-5px)}
    80%{transform:translateX(5px)}
  }
`;
document.head.appendChild(_authStyle);
