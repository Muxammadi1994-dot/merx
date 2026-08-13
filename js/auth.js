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

  if (email.toLowerCase() !== String(stored || "").toLowerCase())
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
// ── Telefonni solishtirish uchun soddalashtirish (2026-08-01) ──
// AVVAL: `s.phone === phone` — AYNAN bir xil bo'lishi talab qilinardi.
// Xodim qo'shishda telefon "901234567" deb (kodsiz) saqlanardi, kirish
// oynasida esa odam "+998 90 123 45 67" deb yozardi. Ikkalasi mos
// kelmasdi va xodim tizimga UMUMAN kira olmasdi.
// Endi ikkala tomon ham faqat raqamga keltiriladi va 998 prefiksi
// hisobga olinadi — qaysi ko'rinishda yozilsa ham topiladi.
function _phKey(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
  return d;
}

// Xodimlarni qidirish: joriy `db` dan TASHQARI, saqlangan barcha
// do'kon bazalaridan ham. Sabab: chiqishda `authLogout` db ni
// almashtiradi va `db.staff` BO'SH qoladi — xodim login oynasida
// hech qachon topilmasdi.
function _allStaff() {
  const out = [];
  const seen = new Set();
  const add = (arr, sid) => (arr || []).forEach(x => {
    const k = sid + ":" + x.id;
    if (!seen.has(k)) { seen.add(k); out.push({ ...x, _sid: sid }); }
  });
  try { add(db?.staff, getShopId()); } catch(e) {}
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("merx_v5")) continue;
      const sid = k === "merx_v5" ? "local" : k.slice("merx_v5_".length);
      try { add(JSON.parse(localStorage.getItem(k) || "{}").staff, sid); } catch(e) {}
    }
  } catch(e) {}
  return out;
}

function authStaffLogin(phone, password) {
  const key = _phKey(phone);
  const pin = String(password || "").trim();
  const staff = _allStaff().find(s =>
    _phKey(s.phone) === key && String(s.pin||"").trim() === pin);
  if (!staff) return { ok: false, error: "Telefon yoki PIN noto'g'ri" };
  // Xodim qaysi do'konda ro'yxatdan o'tgan bo'lsa — o'shanga kiradi
  const sid   = staff._sid || getShopId();
  const dbKey = sid === "local" ? "merx_v5" : "merx_v5_" + sid;
  const user  = {
    id: "staff_" + staff.id, email: staff.phone,
    staffId: staff.id, shopId: sid, dbKey,
    perms: staff.perms || null,      // 2026-08-02: darhol amal qilsin
    // Do'kon nomi xodimning O'Z do'koni bazasidan
    shopName: (() => {
      try {
        if (sid === getShopId()) return db?.shop?.name || "MERX Do'koni";
        const raw = localStorage.getItem(dbKey);
        return (raw ? JSON.parse(raw)?.shop?.name : null) || "MERX Do'koni";
      } catch(e) { return "MERX Do'koni"; }
    })(),
    role: staff.role || "kassir", name: staff.name
  };
  authSave(user);
  return { ok: true, user };
}

// ── Chiqish ──────────────────────────────────────
// ⚠️ 2026-08-05: CHIQISHDAN OLDIN KUTILAYOTGAN YOZUV YUBORILADI.
// Sotuv qilingach push 700 ms kechikib boshlanadi va 1-3 soniya
// davom etadi. Foydalanuvchi shu oraliqda chiqsa yozuv BULUTGA
// YETMASDAN yo'qolardi.
// 2026-08-05, Shoetest: ikki sotuv (`4285-LV`, `4286-LV`) aynan
// shunday yo'qolgan — bot cheki ketgan, bazada esa yo'q.
async function authLogout() {
  // Kutilayotgan sinxronni majburan tugatamiz (eng ko'pi 8 soniya)
  try {
    if (typeof pushToCloud === "function") {
      await Promise.race([
        pushToCloud(),
        new Promise(r => setTimeout(r, 8000))
      ]);
    }
  } catch (e) { console.warn("chiqishdan oldin sinxron:", e.message); }

  authClear();
  // 2026-07-19: chiqishda Supabase sessiyasini ham to'liq tozalaymiz —
  // aks holda eski token keyingi kirishda aralashishi mumkin (do'kon aralashuvi).
  try { if (typeof clearSupabaseTestSession === "function") clearSupabaseTestSession(); } catch(e) {}
  try {
    const main = localStorage.getItem("merx_v5");
    db = main ? JSON.parse(main) : { shop:{name:"MERX Do'koni"}, settings:{}, customers:[],products:[],sales:[],staff:[],ombor:[],xarajatlar:[],debtPayments:[],shifts:[],kassaBalances:{},seq:1 };
  } catch(e) {}
  window._loadedDbKey = null;
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
// ══════════════════════════════════════════════════════════════
// RUXSATLAR — KO'RISH / ISHLATISH (2026-08-02)
// ══════════════════════════════════════════════════════════════
// Avval kirish FAQAT rol darajasi bilan hal qilinardi va admin uni
// o'zgartira olmasdi. Endi har xodimga har sahifa bo'yicha ikki
// daraja: ko'rish (faqat o'qish) va ishlatish (to'liq).
//
// XAVFSIZLIK IKKI QATLAMDA:
//   1. UI — tugmalar yashiriladi/o'chiriladi (qulaylik uchun)
//   2. `requireUse()` — yozish funksiyalarining ICHIDA tekshiriladi.
//      Tugmani chetlab o'tgan holatda ham amal bajarilmaydi.
//
// ORQAGA MOSLIK: xodimda `perms` bo'lmasa (eski yozuvlar) — hozirgi
// rol qoidasi ishlaydi, ya'ni hech narsa buzilmaydi.

// ⚠️ 2026-08-02: SAHIFA NOMINI BIR XILLASHTIRISH.
// Menyu `data-page="sotuv"` deb chaqiradi, sahifa elementi esa
// `id="p-pos"`. Ruxsat ro'yxatida kalit — "sotuv".
// Sahifa `id` sidan nom olinganda "pos" chiqib, ruxsat topilmasdi
// va eski rol qoidasiga tushib "ruxsat yo'q" deb rad etardi —
// sotuvga ruxsat berilgan xodim ham kira olmasdi.
const _PAGE_ALIAS = { pos: "sotuv", sotuv: "sotuv" };
function _pgKey(p) { return _PAGE_ALIAS[p] || p; }

function _myPerms() {
  try {
    const u = _authUser;
    if (!u || !u.staffId) return null;              // egasi/superadmin — cheklovsiz
    const st = (db.staff || []).find(x => x.id === u.staffId);
    if (st && st.perms && typeof st.perms === "object") return st.perms;
    // ⚠️ 2026-08-02: ZAXIRA — FOYDALANUVCHI YOZUVIDAN.
    // Kirgan zahoti `db.staff` hali BO'SH bo'ladi (og'ir jadvallar
    // yuklanmagan, bulutdan tortish tugamagan). Shu payt ruxsat
    // topilmasdi va HAMMA NARSA OCHIQ ko'rinardi — xodim taqiqlangan
    // bo'limlarni ham ko'rardi. Faqat sahifa yangilangach to'g'ri
    // ishlardi.
    // Endi ruxsat kirish paytida `_authUser` ga ham yoziladi va
    // darhol amal qiladi.
    if (u.perms && typeof u.perms === "object") return u.perms;
    return null;
  } catch(e) { return null; }
}

// Sahifani OCHISH mumkinmi
function canAccessPage(page) {
  page = _pgKey(page);
  // Sozlamalar har doim faqat egada — galochka bilan ham berilmaydi
  if (page === "egasi" || page === "portal") return hasRole("admin");
  const p = _myPerms();
  if (p && p[page]) return !!p[page].view;
  return hasRole(PAGE_ROLES[page] || "admin");      // eski qoida (zaxira)
}

// Sahifada AMAL bajarish mumkinmi
function canUsePage(page) {
  page = _pgKey(page);
  const u = _authUser;
  if (!u) return false;
  if (!u.staffId) return true;                      // egasi/superadmin
  const p = _myPerms();
  if (p && p[page]) return !!p[page].use;
  return hasRole(PAGE_ROLES[page] || "admin");      // eski qoida (zaxira)
}

// ══════════════════════════════════════════════════════════════
// BAND DARAJASIDAGI RUXSAT (2026-08-02, 2-bosqich)
// ══════════════════════════════════════════════════════════════
// `permSee(page, key)` — shu bandni KO'RSATISH mumkinmi
// `permDo(page, key)`  — shu amalni BAJARISH mumkinmi
//
// ⚠️ QOIDA: ma'lumotda YASHIRILGANLAR saqlanadi (`hide`, `deny`).
// Ro'yxatda yo'q band — KO'RINADI. Shu sabab yangi band qo'shilsa
// u avtomat ochiq bo'ladi, hech kimdan yashirinib qolmaydi.
//
// ⚠️ `db.settings` GA HECH QACHON YOZILMAYDI. Ustun sozlamalari
// do'kon sozlamasi bo'lib, bulutga sinxronlanadi va EGASINIKI.
// Ruxsat esa xodim yozuvida — ikkisi butunlay alohida.
// Ko'rinadi = sozlamada yoqilgan VA ruxsatda yashirilmagan.
function permSee(page, key) {
  page = _pgKey(page);
  const u = _authUser;
  if (!u || !u.staffId) return true;          // egasi/superadmin — cheklovsiz
  const p = _myPerms();
  if (!p || !p[page]) return true;            // ruxsat berilmagan — eski qoida
  const hid = p[page].hide;
  return !(Array.isArray(hid) && hid.includes(key));
}

function permDo(page, key) {
  page = _pgKey(page);
  const u = _authUser;
  if (!u || !u.staffId) return true;
  const p = _myPerms();
  if (!p || !p[page]) return true;
  const dn = p[page].deny;
  if (Array.isArray(dn) && dn.includes(key)) return false;
  return canUsePage(page);                    // bo'lim darajasi ham tekshiriladi
}

// Amalni qo'riqlash: `if (!requireDo("katalog","del")) return;`
function requireDo(page, key) {
  if (permDo(page, key)) return true;
  try { toast("⛔ Bu amal uchun ruxsatingiz yo'q", "err"); } catch(e) {}
  return false;
}

// ⚠️ YOZISH FUNKSIYALARI SHU BILAN QO'RIQLANADI.
// Ishlatish: `if (!requireUse("katalog")) return;`
// Ruxsat yo'q bo'lsa xabar chiqadi va `false` qaytadi.
function requireUse(page) {
  if (canUsePage(page)) return true;
  try { toast("⛔ Sizda bu bo'limda faqat ko'rish huquqi bor", "err"); } catch(e) {}
  return false;
}

// KPI bloklarini ruxsat bo'yicha yashirish (2026-08-02).
// Ular alohida bloklar — `id` bo'yicha yashiriladi, boshqa
// hech narsaga tegilmaydi. Egasi kirsa hammasi ko'rinadi.
const _PERM_BLOCKS = [
  ["ombor",    "kpi", "om-kpi-row"],
  ["mijozlar", "kpi", "cust-kpi-row"],
  ["qarzlar",  "kpi", "debt-kpi-grid"],
  ["qarzlar",  "trend", "debt-kpi-trend-wrap"],
  ["moliya",   "kpi", "mol-kpi-row"],
  ["hisobot",  "kpi", "rep-kpis"],
  ["dashboard","kpi", "dash-kpis"],
  ["dashboard","kpi", "dash-kpi-panel"],

  // 3-bosqich (2026-08-02): Hisobot va Moliya bo'limlari.
  // Ularda `id` yo'q edi — index.html ga qo'shildi.
  ["hisobot", "dyn",       "rep-b-dyn"],
  ["hisobot", "dyn",       "rep-b-compare"],
  ["hisobot", "cash",      "rep-b-cash"],
  ["hisobot", "cash",      "rep-b-methods"],
  ["hisobot", "topProd",   "rep-b-topprod"],
  ["hisobot", "topCust",   "rep-b-topcust"],
  ["hisobot", "staff",     "rep-b-staff"],

  ["moliya",  "struct",    "mol-b-struct"],
  ["moliya",  "inout",     "mol-b-inout"],
  ["moliya",  "inout",     "mol-b-dyn"],
  ["moliya",  "inout",     "mol-b-sources"],
  ["moliya",  "balances",  "mol-b-balances"],
  ["moliya",  "suppliers", "mol-b-suppliers"],
];

// Amal tugmalarini ruxsat bo'yicha yashirish (2026-08-02, 4-bosqich).
// Bosilmaydigan tugma turishi noqulay — ruxsat yo'q bo'lsa umuman
// ko'rinmaydi. Haqiqiy himoya baribir funksiya ichida (`requireDo`).
const _PERM_BTNS = [
  ["katalog","add",      'onclick="apOpenAddProduct()"'],
  // 2026-08-02: TUZATILDI — tugma `openKatalogImport()` chaqiradi,
  // `openModal('import')` emas. Selektor mos kelmagani uchun tugma
  // yashirilmasdan qolgan edi.
  ["katalog","import",   'onclick="openKatalogImport()"'],
  ["katalog","narxnoma", 'onclick="openNarxnoma()"'],
  ["katalog","excel",    'onclick="exportKatalogExcel()"'],
  ["ombor","inv",        'onclick="openInvent2()"'],
  ["ombor","writeoff",   'onclick="openChiqim2()"'],
  ["mijozlar","add",     'onclick="openAddCustomer()"'],
  ["mijozlar","excel",   'onclick="exportMijozlarExcel()"'],
  ["moliya","excel",     'onclick="exportExpExcel()"'],
  ["tarix","excel",      'onclick="exportTarixExcel()"'],
  ["qarztarix","excel",  'onclick="exportQarzTarixiExcel()"'],
  ["xodimlar","add",     'onclick="openStaffModal()"'],
];

function applyPermButtons() {
  try {
    if (typeof permDo !== "function") return;
    _PERM_BTNS.forEach(([page, key, sel]) => {
      const attr = sel.slice(sel.indexOf('"') + 1, sel.lastIndexOf('"'));
      document.querySelectorAll(`[onclick="${attr}"]`).forEach(el => {
        const ok = permDo(page, key);
        if (!ok) { el.style.display = "none"; el.dataset.permHidden = "1"; }
        else if (el.dataset.permHidden) {
          el.style.display = ""; delete el.dataset.permHidden;
        }
      });
    });
  } catch(e) {}
}

function applyPermBlocks() {
  try {
    if (typeof permSee !== "function") return;
    _PERM_BLOCKS.forEach(([page, key, id]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const ok = permSee(page, key);
      // `dataset` bilan asl holat saqlanadi — boshqa kod uni
      // ko'rsatmoqchi bo'lsa buzilmasin
      if (!ok) { el.style.display = "none"; el.dataset.permHidden = "1"; }
      else if (el.dataset.permHidden) { el.style.display = ""; delete el.dataset.permHidden; }
    });
  } catch(e) {}
}

// Joriy sahifani "faqat ko'rish" holatiga o'tkazish (UI qatlami)
function applyViewOnlyUI() {
  try {
    document.querySelectorAll(".pg").forEach(pg => {
      const page = _pgKey(pg.id.replace(/^p-/, ""));
      const ro = !canUsePage(page);
      pg.classList.toggle("view-only", ro);
    });
  } catch(e) {}
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
  if (topBtn)  { topBtn.style.display = "flex"; topBtn.onclick = toggleAuthMenu; } // 2026-07-10: menyu jonlantirildi
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
  // 2026-08-02: "faqat ko'rish" sahifalarini belgilaymiz
  try { applyViewOnlyUI(); } catch(e) {}
  try { applyPermBlocks(); } catch(e) {}
  try { applyPermButtons(); } catch(e) {}
}

// ── initAuth ─────────────────────────────────────
// ── 2026-07-10: PROFIL MENYUSI JONLANTIRILDI ─────────────────────
// index.html'da auth-menu bloki azaldan bor edi, lekin uni OCHADIGAN
// kod hech qachon yozilmagan (o'lik HTML edi). Endi: topbar'dagi
// profil tugmasi bosilganda ochiladi/yopiladi, tashqariga bosilsa
// yopiladi, ism va rol avtomatik to'ldiriladi.
function toggleAuthMenu(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById("auth-menu");
  if (!m) return;
  const isOpen = m.style.display === "block";
  if (!isOpen) {
    const u = _authUser || {};
    const labels = { admin:"Admin", menejer:"Menejer", kassir:"Kassir", omborchi:"Omborchi", superadmin:"Super" };
    const nm = document.getElementById("auth-menu-name");
    const rl = document.getElementById("auth-menu-role");
    if (nm) nm.textContent = u.name || u.email || "—";
    if (rl) rl.textContent = labels[u.role] || u.role || "";
  }
  m.style.display = isOpen ? "none" : "block";
}
document.addEventListener("click", (e) => {
  const m = document.getElementById("auth-menu");
  if (!m || m.style.display !== "block") return;
  if (!e.target.closest("#auth-menu") && !e.target.closest("#auth-topbar-btn")) m.style.display = "none";
});

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

  // Cloud sync va token — sahifa yangilanganda ham ishlashi uchun
  // sessionStorage da token bo'lsa — uni ishlatamiz
  // bo'lmasa — faqat cloud sync qilamiz (anon key bilan)
  setTimeout(() => {
    _initCloudAfterLogin();
  }, 100);

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
    // Bulut — YAGONA haqiqat manbasi: kirishda HAR DOIM to'liq pull.
    // (Avval faqat lokal bo'sh bo'lsa pull bo'lardi — eskirgan lokal
    //  nusxa keyinchalik bulutni yozib yuborishi mumkin edi.)
    // pullFromCloud endi MERGE qiladi: bulut yozuvlari ustun, lekin
    // lokaldagi hali yuborilmagan yangi yozuvlar saqlab qolinadi.
    // Push esa pull tugamagunicha avtomatik bloklanadi (cloud.js).
    if (typeof pullFromCloud === "function") {
      // ensureCloudPull: muvaffaqiyatgacha qayta urinadi (2-bosqich)
      if (typeof ensureCloudPull === "function") await ensureCloudPull();
      else await pullFromCloud();
      saveDB();
      if (typeof renderDashboard === "function") renderDashboard();
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
  // Login ekrani hali HECH QANDAY do'konga tegishli emas — shuning uchun
  // qurilmada keshlangan oldingi do'kon nomi ko'rsatilmaydi (chalkashlik
  // va boshqa do'kon nomining oshkor bo'lishiga yo'l qo'ymaslik uchun)
  const shopName = "MERX Savdo tizimi";
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
              <!-- 2026-08-03: readonly hiylasi. Chrome saqlangan parol
              bo'lsa autocomplete=off ni mensimaydi va kursor
              qo'yilganda ro'yxat ochadi. readonly maydonni esa
              to'ldirmaydi — fokus tushganda olib tashlanadi. -->
              <input id="auth-pass" type="password" placeholder="••••••••" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')"
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
              autocomplete="off" name="merx-staff-phone"
              style="${iStyle}" onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
              onkeydown="if(event.key==='Enter')document.getElementById('auth-pin').focus()">
          </div>
          <div style="margin-bottom:20px">
            <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px;font-weight:600">PIN KOD</label>
            <input id="auth-pin" type="password" placeholder="••••" maxlength="6" inputmode="numeric"
              autocomplete="off" name="merx-staff-pin" readonly onfocus="this.removeAttribute('readonly')"
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
// SA paroli endi KODDA TURMAYDI — server tekshiradi (Vercel ENV:
// MERX_SA_PASS). Muvaffaqiyatli kirishda parol sessionStorage'da
// saqlanadi va keyingi SA so'rovlariga x-sa-pass sarlavhasida boradi.
async function doSuperLogin() {
  const pass    = (document.getElementById("auth-sa-pass")||{value:""}).value;
  const errEl   = document.getElementById("auth-sa-err");

  let ok = false;
  try {
    const r = await fetch("/api/auth-v2?action=sa_login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sa-pass": pass },
      body: "{}"
    });
    ok = r.ok;
  } catch(e) {
    if (errEl) { errEl.textContent = "Server bilan aloqa xatosi"; errEl.style.display = "block"; }
    return;
  }

  if (!ok) {
    if (errEl) { errEl.textContent = "Parol noto'g'ri"; errEl.style.display = "block"; }
    if (document.getElementById("auth-sa-pass")) document.getElementById("auth-sa-pass").value = "";
    return;
  }

  // sessionStorage ga saqlaymiz (localStorage emas)
  sessionStorage.setItem("merx_sa_pass", pass); // keyingi SA so'rovlari uchun
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
// ══ OBUNA DARVOZASI — YAGONA MANBA (2026-07-30) ═══════════════════
// Bloklangan/muddati tugagan do'kon kira olmasligi uchun. Hukmni
// SERVER chiqaradi (qurilma soatiga ishonilmaydi).
// Qaytaradi: "blocked" | "expired" | null (kirishga ruxsat)
// Server javob bermasa — null (fail-open): tarmoq uzilishi mijozni
// ishdan to'xtatmasligi kerak.
let _subGateChecked = null;   // shu kirish urinishida tekshirilgan shopId
async function _subGateCheck(shopId) {
  if (!shopId) return null;
  try {
    const r = await fetch("/api/auth-v2?action=shop_status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId })
    });
    const d = await r.json();
    console.log("🔎 Do'kon holati:", shopId, "→", d && d.status, d);
    _subGateChecked = shopId;
    // ⚠️ 2026-08-08: MAJBURIY SINXRON TUGMALARI bayrog'i.
    // Server do'kon uchun ochilgan-yopilganini aytadi (§5.8).
    // Standart YOPIQ — SuperAdmin kerak bo'lganda ochadi.
    try {
      window._syncToolsOn = (d && d.sync_tools === true);
      localStorage.setItem("merx_sync_tools", window._syncToolsOn ? "1" : "0");
      if (typeof applySyncToolsLock === "function") applySyncToolsLock();
    } catch(e) {}
    if (d && d.ok && (d.status === "blocked" || d.status === "expired")) return d.status;
    return null;
  } catch(e) {
    console.warn("shop_status olinmadi (kirishga ruxsat):", e.message);
    return null;
  }
}

// Darvoza yopilganda: sessiyani tozalab, kirish oynasida xabar
function _subGateDeny(status, btn) {
  try { if (typeof clearSupabaseTestSession === "function") clearSupabaseTestSession(); } catch(e) {}
  try { authClear(); } catch(e) {}
  if (btn) { btn.innerHTML = '<i class="ti ti-login"></i> Kirish'; btn.disabled = false; }
  showAuthErr(status === "blocked"
    ? "🔒 Do'kon bloklangan. Administrator bilan bog'laning: +998 97 770 80 13"
    : "⏰ Obuna muddati tugagan. Administrator bilan bog'laning: +998 97 770 80 13");
  console.warn("⛔ Kirish rad etildi — do'kon holati:", status);
}

// ══ ZAXIRA KIRISH — XAVFSIZ VARIANT (2026-07-30) ══════════════════
// Bulut sozlangan, lekin `shops` jadvalidan do'kon TOPILMADI.
// Avval bu holatda to'g'ridan authLogin chaqirilardi. Toza (gost)
// brauzerda `db.settings.adminEmail` bo'sh bo'ladi — authLogin esa
// buni "birinchi kirish" deb hisoblab, ISTALGAN email va 4 belgili
// parol bilan YANGI bo'sh do'kon yaratib kiritib yuborardi.
// Ya'ni obuna darvozasini butunlay chetlab o'tish yo'li bor edi.
// Endi: lokal hisob allaqachon bo'lsa — oflayn kirishga ruxsat,
// bo'lmasa — rad etamiz.
async function _cloudFallbackLogin(email, pass) {
  if (!db?.settings?.adminEmail) {
    console.warn("⛔ Zaxira kirish rad etildi: bulutda do'kon topilmadi, lokal hisob ham yo'q");
    // ⚠️ 2026-08-09 (C-5): MATN TO'G'RILANDI. Bu holatga eng ko'p
    // NOTO'G'RI PAROL olib keladi (parol katta-kichik harfga sezgir,
    // §1) — avvalgi "Do'kon topilmadi" foydalanuvchini chalg'itardi.
    return { ok:false, error:"Email yoki parol noto'g'ri bo'lishi mumkin — parol KATTA-kichik harfga sezgir. Internet aloqasini ham tekshirib, qayta urinib ko'ring yoki administrator bilan bog'laning." };
  }
  return await authLogin(email, pass);
}

async function doLogin() {
  const email = (document.getElementById("auth-email")||{value:""}).value.trim().toLowerCase();
  const pass  = (document.getElementById("auth-pass") ||{value:""}).value;
  const btn   = document.getElementById("auth-btn");

  if (!email || !pass) { showAuthErr("Email va parol kiriting"); return; }
  if (btn) { btn.innerHTML = '<i class="ti ti-loader spin"></i> Tekshirilmoqda...'; btn.disabled = true; }

  let res = { ok: false };

  // 1. Supabase dan shop topamiz
  let _sbUrl = (typeof MERX_SUPABASE_URL !== "undefined" && MERX_SUPABASE_URL)
    ? MERX_SUPABASE_URL
    : (db?.settings?.supabaseUrl || "");
  let _sbKey = (typeof MERX_SUPABASE_KEY !== "undefined" && MERX_SUPABASE_KEY)
    ? MERX_SUPABASE_KEY
    : (db?.settings?.supabaseKey || "");

  // TOZA QURILMA (v168): kalitlar lokal yo'q bo'lsa — serverdan olamiz.
  // Busiz yangi/guest brauzer jimgina "lokal rejim"ga tushib bo'sh ko'rinardi.
  if (!_sbUrl || !_sbKey) {
    try {
      const _r = await fetch("/api/auth-v2?action=client_config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: (typeof getCloudShopId === "function" ? getCloudShopId() : "") })
      }); // API faqat POST qabul qiladi (v169 tuzatishi)
      const _cfg = await _r.json();
      // ✅ 2026-08-13: DO'KON REJIMI serverdan (sinxronga bog'liq emas)
      try {
        if (_cfg && _cfg.serverPay != null) {
          if (!db.settings) db.settings = {};
          db.settings.serverPay = _cfg.serverPay === true;
        }
      } catch (e) {}
      if (_cfg.ok && _cfg.url && _cfg.key) {
        _sbUrl = _cfg.url; _sbKey = _cfg.key;
        // KRITIK (v173, v170 ning qayta tiklanishi): initSupabase kalitlarni
        // db.settings dan o'qiydi — shu yerga yozmasak client qurilmaydi.
        if (!db.settings) db.settings = {};
        db.settings.supabaseUrl = _sbUrl;
        db.settings.supabaseKey = _sbKey;
      }
    } catch(e) { console.warn("client_config olinmadi:", e.message); }
  }


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
          // ── 2026-07-19: DO'KON ARALASHUVIGA QARSHI QAT'IY QO'RIQCHI ──
          // Token yangi shop_id qaytarsa va joriy xotira BOSHQA do'konники
          // bo'lsa — begona do'kon KESHINI (localStorage) o'chiramiz, lekin
          // joriy `db`ni BO'SH QILMAYMIZ (bo'sh db bulutga yozilib ma'lumotni
          // o'chirishi mumkin — xavfli). Quyida shopDB har doim Supabase'dan
          // to'g'ri yuklanadi, _loadedDbKey esa pull'ni yangi do'konga yo'naltiradi.
          const _newSid = sbAuthRes.shopId;
          const _curSid = db?.settings?.cloudShopId || null;
          if (_newSid && _curSid && _newSid !== _curSid) {
            console.log("🔁 Boshqa do'konga kirish — begona kesh tozalanmoqda:", _curSid, "→", _newSid);
            // Faqat ESKI (begona) do'kon keshini o'chiramiz — yangisi pull bilan keladi
            try { localStorage.removeItem("merx_v5_" + _curSid); } catch(e) {}
            window._loadedDbKey = "merx_v5_" + _newSid;
          }
        } else {
          console.warn("ℹ️ Supabase Auth token olinmadi:", sbAuthRes.error);
        }
      } catch(e) {
        console.warn("ℹ️ Supabase Auth token xatosi:", e.message);
      }

      // ══ DARVOZA — 1-nuqta: token shop_id qaytardi ═══════════════
      // 2026-07-30: avval darvoza faqat `shops` jadvali muvaffaqiyatli
      // O'QILGANDA ishlardi. RLS/tarmoq tufayli o'qish bo'sh qaytsa
      // tekshiruv umuman bajarilmasdi va pastdagi zaxira yo'l bilan
      // kirilardi. Endi shop_id ma'lum bo'lishi bilanoq tekshiramiz.
      try {
        const _tokSid = getSupabaseTestSession()?.shopId || null;
        if (_tokSid) {
          const _bad = await _subGateCheck(_tokSid);
          if (_bad) { _subGateDeny(_bad, btn); return; }
        }
      } catch(e) { console.warn("darvoza (1-nuqta):", e.message); }

      // initSupabase orqali ulanamiz — bu "Multiple GoTrueClient" ogohlantirishini oldini oladi
      // (avval token olingan, shuning uchun initSupabase token bilan ulanadi)
      let _isOk = false;
      if (typeof initSupabase === "function") {
        try { _isOk = await initSupabase(); } catch(e) { console.warn("🧪 initSupabase xato:", e.message); }
      }
      const sb = _sb;

      // Token ichidagi shop_id bo'yicha qidiramiz (RLS bilan mos)
      // Agar token yo'q bo'lsa — owner_email bo'yicha (eski usul, zaxira)
      const sbSession = getSupabaseTestSession();
      let shops = null;
      if (sbSession?.shopId && sb) {
        const { data, error } = await sb.from("shops").select("id,name").eq("id", sbSession.shopId).limit(1);
        shops = data;
      }
      if (!shops?.length && sb) {
        const { data, error } = await sb.from("shops").select("id,name").ilike("owner_email", email).limit(1); // katta-kichik harfga befarq (v168)
        shops = data;
      }

      if (shops?.length) {
        const shop   = shops[0];
        const shopId = shop.id;

        // ══ DARVOZA — 2-nuqta: shops jadvalidan topilgan shopId ══
        // (token shop_id bermagan, email bo'yicha topilgan holat)
        if (_subGateChecked !== shopId) {
          const _bad2 = await _subGateCheck(shopId);
          if (_bad2) { _subGateDeny(_bad2, btn); return; }
        }

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
        // ── ARALASHISHGA QARSHI QO'RIQCHI (v167, silliq usul) ──
        // Sahifa BOSHQA do'kon ma'lumoti bilan yuklangan bo'lsa, xotirani
        // shu yerning o'zida yangi do'kon kalitiga toza o'tkazamiz.
        // Busiz: eski db yangi do'kon nomi ostida saqlanib, bulutga oqib
        // o'tardi (Shoetest↔D_60 aralashuvi) yoki eski adminEmail tufayli
        // "parol xato" chiqardi.
        const _targetKey = "merx_v5_" + shopId;
        if (window._loadedDbKey && window._loadedDbKey !== _targetKey) {
          // db YUQORIDA allaqachon to'g'ri nusxaga (shopDB) almashtirilgan —
          // qayta almashtirmaymiz (v171: guest'da bulut sozlamalari
          // yo'qolib, pull ishlamay qolayotgan edi). Faqat belgilaymiz:
          window._loadedDbKey = _targetKey;
          console.log("🔁 Do'kon almashdi — xotira toza kalitga o'tkazildi:", _targetKey);
        }

        // Emailni ham HAR DOIM yangilaymiz — Supabase Auth allaqachon tasdiqlagan,
        // eski/xato yozilgan email (masalan katta harfli) lokal nusxada qolib ketmasin
        db.settings.adminEmail = email;
        // 2026-07-19 TUZATISH: adminPass'ni HAR kirishda yozish PAROLNI BUZAR EDI
        // (kiritilgan parol yangi parol sifatida o'rnatilib, keyingi authLogin
        // shu bilan solishtirib doim "to'g'ri" chiqarardi — do'kon aralashuvida
        // begona parol o'rnatilib qolardi). Supabase Auth SERVER tomonda parolni
        // ALLAQACHON tekshirdi — bu yagona haqiqiy tekshiruv. Lokal adminPass
        // faqat oflayn zaxira: uni FAQAT bo'lmaganda (birinchi marta) yozamiz.
        if (!db.settings.adminPass) {
          db.settings.adminPass = await sha256(pass);
        }

        // Supabase Auth tasdiqladi — lokal parol tekshiruvini CHETLAB O'TAMIZ
        // (aks holda eski/boshqa do'kon adminPass'i bilan solishtirib xato berardi).
        res = { ok: true, user: _buildUser(email, shopId), viaSupabase: true };
        authSave(res.user);
        /* 2026-07-31: og'ir jadvallar IndexedDB'da — localStorage'ga
                   YENGIL nusxa yoziladi (aks holda sotuvlar u yerda
                   qolib, 5 MB chegarasi qaytarardi) */
        localStorage.setItem(dbKey, JSON.stringify((typeof _dbForLocal === "function" ? _dbForLocal() : db)));
        if (typeof scheduleHeavySave === "function") scheduleHeavySave();
      } else {
        res = await _cloudFallbackLogin(email, pass);
      }
    } catch(e) {
      console.warn("Supabase login xato:", e.message);
      res = await _cloudFallbackLogin(email, pass);
    }
  } else {
    res = await authLogin(email, pass);
  }

  if (btn) { btn.innerHTML = '<i class="ti ti-login"></i> Kirish'; btn.disabled = false; }

  if (res.ok) {
    hideLoginScreen();
    toast(res.firstTime ? "✅ Hisob yaratildi!" : "✅ Xush kelibsiz!");
    applyRoleUI();
    // 2026-07-30: parol bilan kirilganda HAR DOIM rolga mos standart
    // sahifa ochiladi (egasi uchun Dashboard). Oldingi sessiyada qayerda
    // chiqib ketilgan bo'lsa — o'sha sahifa qolib ketmasin.
    try {
      localStorage.removeItem("merx_last_page");
      localStorage.setItem("merx_last_page_at", String(Date.now()));
      if (typeof nav === "function" && typeof defaultPageForRole === "function")
        nav(defaultPageForRole(res.user));
    } catch(e) {}
    // 2026-07-31: og'ir jadvallar (sales va h.k.) IndexedDB'da —
    // kirishdan keyin ham yuklab, ekranni yangilaymiz
    if (typeof hydrateHeavy === "function") {
      hydrateHeavy().then(() => {
        try {
          if ($("debt-count")) $("debt-count").textContent = debtSales().length;
          if (typeof renderDashboard === "function") renderDashboard();
        } catch(e) {}
      }).catch(() => {});
    }
    _initCloudAfterLogin();
    // 2026-07-30: kirishdan keyin obuna holatini ham tekshiramiz.
    // Yuqoridagi darvoza asosiy himoya; bu ikkinchi qatlam (masalan
    // lokal/oflayn yo'l bilan kirilgan holat uchun).
    if (typeof checkCurrentShopSubscription === "function") {
      setTimeout(() => { try { checkCurrentShopSubscription(); } catch(e) {} }, 1200);
    }
  } else {
    showAuthErr(res.error || "Kirish xatoligi");
  }
}

// ══════════════════════════════════════════════════════════════
// XODIM KIRISHI — BULUTDAN QIDIRISH (2026-08-02)
// ══════════════════════════════════════════════════════════════
// MUAMMO: kirish FAQAT qurilmadagi ma'lumotdan qidirardi
// (`_allStaff()` → localStorage). Qurilmada o'sha do'kon bazasi
// bo'lmasa — yangi kompyuter, tozalangan brauzer, yoki xodim
// boshqa qurilmada qo'shilgan bo'lsa — "Telefon yoki PIN
// noto'g'ri" chiqardi. Egasi bir joyda xodim yaratsa, kassada
// kirib bo'lmasdi.
// ENDI: lokal topilmasa server orqali bulutdan qidiriladi
// (`api/auth-v2?action=staff_login`). Qurilmaga bog'liq emas.
// ══════════════════════════════════════════════════════════════
// BULUT KALITLARI — HAR KIRISHDA (2026-08-02)
// ══════════════════════════════════════════════════════════════
// MUAMMO: kalitlarni serverdan olish FAQAT `doLogin` (admin
// kirishi) ichida edi. Xodim kirishi bu yo'ldan o'tmasdi.
// Natijada xodimda `db.settings` bo'sh qolib, `initSupabase`
// "kalitlar topilmadi — bulut o'chiq" deb to'xtardi.
// Bulut o'chiq → tortish yo'q → sozlamalar hech qachon kelmaydi.
// Yopiq halqa: kurs 12800 da qotib qolardi va F5 ham yordam
// bermasdi.
// ENDI: ikkala kirish ham shu funksiyani chaqiradi.
async function ensureCloudKeys() {
  try {
    if (!db.settings) db.settings = {};
    if (db.settings.supabaseUrl && db.settings.supabaseKey) return true;

    // Boshqa do'kon bazasida saqlangan bo'lsa — o'shandan
    try {
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith("merx_v5")) continue;
        const d = JSON.parse(localStorage.getItem(k) || "{}");
        if (d?.settings?.supabaseUrl && d?.settings?.supabaseKey) {
          db.settings.supabaseUrl = d.settings.supabaseUrl;
          db.settings.supabaseKey = d.settings.supabaseKey;
          return true;
        }
      }
    } catch(e) {}

    // Serverdan
    const r = await fetch("/api/auth-v2?action=client_config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId: (typeof getCloudShopId === "function" ? getCloudShopId() : "") })
    });
    const cfg = await r.json();
    // ✅ 2026-08-13: DO'KON REJIMI serverdan
    try {
      if (cfg && cfg.serverPay != null) db.settings.serverPay = cfg.serverPay === true;
    } catch (e) {}
    if (cfg.ok && cfg.url && cfg.key) {
      db.settings.supabaseUrl = cfg.url;
      db.settings.supabaseKey = cfg.key;
      console.log("🔑 Bulut kalitlari serverdan olindi");
      return true;
    }
  } catch(e) { console.warn("bulut kalitlari olinmadi:", e.message); }
  return false;
}

async function _staffLoginCloud(phone, pin) {
  try {
    const r = await fetch("/api/auth-v2?action=staff_login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, pin })
    });
    const j = await r.json();
    if (!j || !j.ok || !j.staff) return null;
    console.log("🔑 Xodim bulutdan topildi:", j.staff.name, "·", j.staff.shopName);
    // ⚠️ 2026-08-03: SESSIYA HAM O'TKAZILADI.
    // Server xodim uchun Supabase Auth sessiyasi qaytaradi
    // (`user_metadata.shop_id` bilan). Busiz xodim `anon` kalitda
    // qolardi va bazadagi `shop_isolation_*` qoidalari unga
    // qo'llanmasdi.
    if (j.session) j.staff._session = j.session;
    if (j.authWarn) console.warn("xodim auth:", j.authWarn);
    return j.staff;
  } catch (e) {
    console.warn("bulutdan xodim qidirish xatosi:", e.message);
    return null;
  }
}

let _staffLoginBusy = false;

async function doStaffLogin() {
  const phone = (document.getElementById("auth-phone")||{value:""}).value.trim();
  const pin   = (document.getElementById("auth-pin") ||{value:""}).value;
  if (!phone || !pin) { showAuthErr("Telefon va PIN kiriting", true); return; }
  if (_staffLoginBusy) return;
  _staffLoginBusy = true;
  try {
  let res = authStaffLogin(phone, pin);
  if (!res.ok) {
    showAuthErr("Tekshirilmoqda...", true);
    const cs = await _staffLoginCloud(phone, pin);
    if (cs) {
      const dbKey = "merx_v5_" + cs.shopId;
      const user = {
        id: "staff_" + cs.id, email: cs.phone,
        staffId: cs.id, shopId: cs.shopId, dbKey,
        perms: cs.perms || null,     // 2026-08-02: darhol amal qilsin
        shopName: cs.shopName, role: cs.role, name: cs.name
      };
      // Keyingi safar internetsiz ham kira olsin
      try {
        const raw = localStorage.getItem(dbKey);
        const d = raw ? JSON.parse(raw) : null;
        if (d) {
          d.staff = Array.isArray(d.staff) ? d.staff : [];
          if (!d.staff.some(x => String(x.id) === String(cs.id))) {
            d.staff.push({ id: cs.id, name: cs.name, phone: cs.phone,
              // 2026-08-09: bulutda ochiq PIN endi yo'q — TERILGAN pin saqlanadi
              pin: cs.pin || pin, pinHash: cs.pin_hash || undefined,
              role: cs.role, perms: cs.perms || undefined,
              permDiscount: cs.permDiscount, permNasiya: cs.permNasiya,
              permReturn: cs.permReturn, maxDiscount: cs.maxDiscount });
            localStorage.setItem(dbKey, JSON.stringify(d));
          }
        }
      } catch (e) {}
      authSave(user);

      // ⚠️ 2026-08-03: XODIM SESSIYASINI SAQLAYMIZ.
      // Server `staff_login` da Supabase Auth sessiyasi qaytaradi
      // (`user_metadata.shop_id` bilan). `cloud.js` shu yerdan
      // o'qiydi va token bilan ulanadi. Busiz xodim `anon` kalitda
      // qolardi va bazadagi `shop_isolation_*` qoidalari unga
      // qo'llanmasdi.
      try {
        if (cs._session && cs._session.accessToken) {
          _supabaseTestSession = cs._session;
          localStorage.setItem("merx_sb_session", JSON.stringify(cs._session));
          console.log("✅ Xodim uchun Auth sessiyasi olindi — RLS faol");
        } else {
          console.warn("ℹ️ Xodim sessiyasiz kirdi — anon kalit ishlatiladi");
        }
      } catch(e) { console.warn("xodim sessiyasi saqlanmadi:", e.message); }

      // ⚠️ Bulut kalitlarini ta'minlaymiz — busiz sozlamalar
      // (kurs, do'kon nomi) hech qachon yuklanmaydi.
      try { await ensureCloudKeys(); } catch(e) {}
      res = { ok: true, user };
    }
  }
  if (res.ok) {
    // ⚠️ 2026-08-02: LOKAL YO'L UCHUN HAM.
    // Xodim qurilmada topilsa `_staffLoginCloud` chaqirilmaydi —
    // kalitlar baribir kerak, aks holda bulut o'chiq qoladi.
    try { await ensureCloudKeys(); } catch(e) {}

    // ⚠️ 2026-08-09: TAKROR KIRISHDA TOKEN KUTIB OLINADI (avval FONDA edi).
    // Fonda so'ralganda sinxron tokendan OLDIN boshlanardi: push RLSga
    // urilib "Saqlandi, lekin xatolar: products/..." toasti chiqardi,
    // pull esa bo'sh qaytardi — kurs va do'kon nomi "Yangilash"
    // bosilguncha eskicha turardi. Endi internet bor bo'lsa bitta tez
    // so'rov KUTIB olinadi (eng ko'pi 6 s, odatda ~1 s); kechiksa ham
    // natija baribir saqlanadi. Internet yo'q bo'lsa — avvalgidek
    // oflayn kiradi, push token kelguncha jim kutadi (cloud.js
    // qo'riqchisi + _staffTokenRetry).
    try {
      if (!getSupabaseTestSession()?.accessToken) {
        let _tokWaited = false; // race tugadimi (kech token belgisi)
        const _tokSave = (cs2) => {
          if (cs2 && cs2._session && cs2._session.accessToken) {
            _supabaseTestSession = cs2._session;
            try { localStorage.setItem("merx_sb_session",
                    JSON.stringify(cs2._session)); } catch(e) {}
            // Bulutdagi eng yangi rol/ruxsat DARHOL amal qilsin
            try {
              if (cs2.perms || cs2.role || cs2.name) {
                const u2 = Object.assign({}, res.user, {
                  perms: cs2.perms || res.user.perms,
                  role:  cs2.role  || res.user.role,
                  name:  cs2.name  || res.user.name });
                authSave(u2); res.user = u2;
              }
            } catch(e) {}
            console.log("✅ Xodim sessiyasi olindi — RLS faol");
            // Bulut ulanishini token bilan qayta ochamiz
            try { if (typeof initSupabase === "function") initSupabase(); } catch(e) {}
            // Kech kelgan token (6 s dan keyin): kirish o'tib bo'lgan —
            // sinxron va sozlamalar (kurs, nom) DARHOL yangilanadi,
            // 90 soniyalik zaxira kutilmaydi.
            if (_tokWaited) {
              try { if (typeof scheduleCloudSync === "function") scheduleCloudSync(); } catch(e) {}
              try {
                const _pl = (typeof ensureCloudPull === "function") ? ensureCloudPull()
                          : (typeof pullFromCloud === "function") ? pullFromCloud() : null;
                if (_pl && _pl.then) _pl.then(() => { try { saveDB();
                  if (typeof renderDashboard === "function") renderDashboard(); } catch(e) {} });
              } catch(e) {}
            }
            return true;
          }
          console.warn("ℹ️ Xodim sessiyasiz — push token kelguncha kutadi");
          return false;
        };
        const _p = _staffLoginCloud(phone, pin);
        _p.then(_tokSave).catch(e => console.warn("xodim sessiyasi:", e.message));
        if (typeof navigator === "undefined" || navigator.onLine !== false) {
          showAuthErr("Tekshirilmoqda...", true);
          await Promise.race([
            _p.catch(() => null),
            new Promise(r => setTimeout(r, 6000))
          ]);
        }
        _tokWaited = true; // bundan keyin kelgan token — "kech"
      }
    } catch(e) {}
    hideLoginScreen();
    toast(`✅ Xush kelibsiz, ${res.user.name}!`);
    applyRoleUI();
    // 2026-07-30: parol bilan kirilganda HAR DOIM rolga mos standart
    // sahifa ochiladi (egasi uchun Dashboard). Oldingi sessiyada qayerda
    // chiqib ketilgan bo'lsa — o'sha sahifa qolib ketmasin.
    try {
      localStorage.removeItem("merx_last_page");
      localStorage.setItem("merx_last_page_at", String(Date.now()));
      if (typeof nav === "function" && typeof defaultPageForRole === "function")
        nav(defaultPageForRole(res.user));
    } catch(e) {}
    // 2026-07-31: og'ir jadvallar (sales va h.k.) IndexedDB'da —
    // kirishdan keyin ham yuklab, ekranni yangilaymiz
    if (typeof hydrateHeavy === "function") {
      hydrateHeavy().then(() => {
        try {
          if ($("debt-count")) $("debt-count").textContent = debtSales().length;
          if (typeof renderDashboard === "function") renderDashboard();
        } catch(e) {}
      }).catch(() => {});
    }
    _initCloudAfterLogin();
    // 2026-07-30: xodim kirsa ham do'kon holati tekshiriladi —
    // aks holda bloklangan do'konda xodim ishlashda davom etardi
    if (typeof checkCurrentShopSubscription === "function") {
      setTimeout(() => { try { checkCurrentShopSubscription(); } catch(e) {} }, 1200);
    }
  } else {
    showAuthErr(res.error, true);
  }
  } finally { _staffLoginBusy = false; }
}

// ⚠️ 2026-08-09: XODIM TOKENINI KEYIN TIKLASH (oflayn kirgan xodim uchun).
// Internet qaytganda ("online" tinglovchisi) yoki push urinishida
// (cloud.js qo'riqchisi) chaqiriladi. Qurilmada keshlangan xodim
// ma'lumoti bilan server so'raladi; muvaffaqiyatda sinxron va
// sozlamalar (kurs, do'kon nomi) O'ZI yangilanadi — "Yangilash" shart emas.
let _staffTokRetryBusy = false;
async function _staffTokenRetry() {
  if (_staffTokRetryBusy) return false;
  try {
    const u = (typeof getAuthUser === "function") ? getAuthUser() : null;
    if (!u || u.staffId == null) return false;              // faqat xodim
    if (getSupabaseTestSession()?.accessToken) return true; // token bor
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    const st = ((db && db.staff) || []).find(x => String(x.id) === String(u.staffId));
    if (!st || !st.phone || !st.pin) return false;
    _staffTokRetryBusy = true;
    const cs = await _staffLoginCloud(st.phone, st.pin);
    if (cs && cs._session && cs._session.accessToken) {
      _supabaseTestSession = cs._session;
      try { localStorage.setItem("merx_sb_session", JSON.stringify(cs._session)); } catch(e) {}
      console.log("✅ Xodim sessiyasi tiklandi — RLS faol");
      try { if (typeof initSupabase === "function") await initSupabase(); } catch(e) {}
      try { if (typeof scheduleCloudSync === "function") scheduleCloudSync(); } catch(e) {}
      try {
        const _pl = (typeof ensureCloudPull === "function") ? ensureCloudPull()
                  : (typeof pullFromCloud === "function") ? pullFromCloud() : null;
        if (_pl && _pl.then) _pl.then(() => { try { saveDB();
          if (typeof renderDashboard === "function") renderDashboard(); } catch(e) {} });
      } catch(e) {}
      return true;
    }
    console.warn("ℹ️ Xodim tokeni tiklanmadi — keyinroq qayta uriniladi");
  } catch(e) { console.warn("xodim token retry:", e.message);
  } finally { _staffTokRetryBusy = false; }
  return false;
}
window._staffTokenRetry = _staffTokenRetry;

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
    // v175: localStorage — brauzer yopilib-ochilsa ham sessiya yashaydi
    // (AbuSaxiy hodisasi: sessionStorage o'chib, tizim "kar" bo'lib qolgan)
    const saved = localStorage.getItem("merx_sb_session")
               || sessionStorage.getItem("merx_sb_session");
    if (saved) {
      const parsed = JSON.parse(saved);
      // refreshToken bo'lsa — muddati o'tgan bo'lsa ham SAQLAYMIZ:
      // cloud.js ensureFreshToken uni avtomatik yangilaydi
      if (parsed.refreshToken || (parsed.expiresAt && Date.now() < parsed.expiresAt)) {
        _supabaseTestSession = parsed;
        try { localStorage.setItem("merx_sb_session", JSON.stringify(parsed)); } catch(e) {}
      } else {
        localStorage.removeItem("merx_sb_session");
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
      // v175: localStorage — brauzer qayta ochilsa ham sessiya yashaydi.
      // ESKI "yangilash taymeri" OLIB TASHLANDI: u 55 daqiqadan keyin
      // token'ni o'chirib, tizimni jimgina huquqsiz rejimga tushirardi
      // (AbuSaxiy hodisasining ildizi). Endi yangilash cloud.js dagi
      // ensureFreshToken zimmasida — token O'LMASDAN yangilanadi.
      try {
        localStorage.setItem("merx_sb_session", JSON.stringify(data));
        sessionStorage.removeItem("merx_sb_session");
      } catch(e) {}
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

// v175: cloud.js token yangilaganda xotiradagi nusxani ham yangilaydi
function setSupabaseTestSession(s) {
  _supabaseTestSession = s;
}

function clearSupabaseTestSession() {
  _supabaseTestSession = null;
  try { localStorage.removeItem("merx_sb_session"); sessionStorage.removeItem("merx_sb_session"); } catch(e) {}
  if (_sbTokenRefreshTimer) { clearTimeout(_sbTokenRefreshTimer); _sbTokenRefreshTimer = null; }
}
