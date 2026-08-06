// ════════════════════════════════════════════════
// MERX — js/superadmin.js | v4.1 | 2026-06-30
// Super Admin paneli — faqat sayt egasi uchun
// ════════════════════════════════════════════════

// SHA-256 hash (auth.js dagi bilan bir xil)
async function saSha256(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2,"0")).join("");
}

const SA_KEY     = "merx_superadmin_v1";
const SA_TS_KEY  = "merx_sa_ts";
const SA_TIMEOUT = 4 * 60 * 60 * 1000;
const SHOPS_KEY  = "merx_shops_v1";

let _saSession = null;
let _saShops   = [];
let _saFilter  = "Barchasi";

// ── Session ──────────────────────────────────────
function saLoad() {
  // 2026-07-26: sessionStorage -> localStorage. sessionStorage brauzer
  // yangilanishida (ayniqsa PWA/desktop ilovada) tozalanib ketardi va
  // SuperAdmin har obnovitda chiqib qolardi. 4 soatlik muddat saqlanadi.
  try {
    const raw = localStorage.getItem(SA_KEY)   || sessionStorage.getItem(SA_KEY);
    const ts  = parseInt(localStorage.getItem(SA_TS_KEY)
                || sessionStorage.getItem(SA_TS_KEY) || "0");
    if (raw && Date.now() - ts < SA_TIMEOUT) _saSession = JSON.parse(raw);
    else {
      _saSession = null;
      localStorage.removeItem(SA_KEY);
      sessionStorage.removeItem(SA_KEY);
    }
  } catch(e) { _saSession = null; }
}

function saSave() {
  const _v = JSON.stringify(_saSession), _t = Date.now().toString();
  localStorage.setItem(SA_KEY, _v);
  localStorage.setItem(SA_TS_KEY, _t);
  sessionStorage.setItem(SA_KEY, _v);      // orqaga moslik
  sessionStorage.setItem(SA_TS_KEY, _t);
}

async function saLogout() {
  await _saFlushSync();
  _saSession = null;
  // 2026-07-26: ikkala saqlash joyi ham tozalanadi
  [SA_KEY, SA_TS_KEY, "merx_sa_pass"].forEach(k => {
    sessionStorage.removeItem(k);
    localStorage.removeItem(k);
  });

  // ⚠️ 2026-08-03: DO'KON SESSIYASI HAM TOZALANADI.
  // Avval faqat SuperAdmin sessiyasi o'chirilib panel yopilardi.
  // Ostida esa `saOpenShop` orqali kirilgan do'kon OCHIQ qolardi —
  // chiqish tugmasi bosilgach foydalanuvchi begona (ko'pincha
  // bo'sh) do'kon ekranida qolib ketardi.
  // Endi kirish oynasiga chiqadi.
  try {
    localStorage.removeItem("merx_auth_v1");
    sessionStorage.removeItem("merx_active_shop");
    sessionStorage.removeItem("merx_is_sa_view");
    sessionStorage.removeItem("merx_prev_shop");
    sessionStorage.removeItem("merx_sa_entering");
  } catch(e) {}

  hideSaPanel();
  // Kirish oynasi chiqishi uchun sahifa yangilanadi
  setTimeout(() => location.reload(), 200);
}

function saLoadShops() {
  // localStorage o'rniga faqat Supabase'dan yuklaymiz
  // (saFetchShopsFromCloud funksiyasi bu ishni bajaradi)
  _saShops = [];
}

function saSaveShops() {
  // localStorage ga yozmaymiz — Supabase birlamchi manba
  // Faqat xotirada (_saShops) saqlaymiz
}

function saIsActive(s) {
  if (s.blocked) return false;
  if (s.plan === "lifetime") return true;
  if (!s.expiresAt) return false;
  return new Date(s.expiresAt) > new Date();
}
function saIsExpired(s) {
  if (!s.expiresAt || s.plan === "lifetime") return false;
  return new Date(s.expiresAt) <= new Date();
}

function addDaysToDate(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ── Panel ochish ─────────────────────────────────
function openSaPanel() {
  saLoad();
  const existing = document.getElementById("sa-overlay");
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement("div");
  overlay.id = "sa-overlay";
  // ⚠️ 2026-08-03: PANEL TO'LIQ EKRANLI.
  // Avval modal edi: orqada qorong'i fon va BEGONA do'kon ko'rinib
  // turardi. SuperAdmin alohida ish joyi — orqa fonning ma'nosi yo'q.
  overlay.style.cssText = `position:fixed;inset:0;z-index:99999;background:#F4F3F0;
    display:flex;align-items:stretch;justify-content:center;
    font-family:'DM Sans',sans-serif`;

  if (!_saSession) {
    overlay.innerHTML = `
      <div class="sa-login-card" style="background:#fff;border-radius:20px;padding:40px 36px;width:360px;
        max-width:92vw;margin:auto;
        box-shadow:0 24px 60px rgba(0,0,0,.25);text-align:center">
        <div style="width:56px;height:56px;background:#0D1B2A;border-radius:14px;
          display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <i class="ti ti-shield-bolt" style="font-size:28px;color:#E9A500"></i>
        </div>
        <div style="font-size:20px;font-weight:800;color:#0D1B2A;margin-bottom:4px">Super Admin</div>
        <div style="font-size:13px;color:#9ca3af;margin-bottom:28px">MERX boshqaruv paneli</div>
        <div id="sa-err" style="display:none;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;
          border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;font-weight:600"></div>
        <input id="sa-pass" type="password" placeholder="Super admin paroli" autocomplete="off" name="merx-sa-key" data-lpignore="true" data-form-type="other" readonly onfocus="this.removeAttribute('readonly')"
          onkeydown="if(event.key==='Enter')saDoLogin()"
          style="width:100%;box-sizing:border-box;background:#F9FAFB;border:1.5px solid #E5E7EB;
          color:#111;border-radius:10px;padding:12px 16px;font-family:inherit;
          font-size:15px;outline:none;margin-bottom:12px"
          onfocus="this.style.borderColor='#E9A500'" onblur="this.style.borderColor='#E5E7EB'">
        <button onclick="saDoLogin()"
          style="width:100%;background:#0D1B2A;border:none;border-radius:10px;
          padding:13px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;color:#E9A500">
          Kirish →
        </button>
        <button onclick="document.getElementById('sa-overlay').remove()"
          style="width:100%;margin-top:10px;background:transparent;border:none;
          color:#9ca3af;font-family:inherit;font-size:13px;cursor:pointer;padding:6px">
          Bekor qilish
        </button>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById("sa-pass")?.focus(), 50);
  } else {
    saLoadShops();
    overlay.innerHTML = buildSaPanel();
    document.body.appendChild(overlay);
    renderSaShops();
    // Panel to'liq yuklanib bo'lgach, Supabase'dan yangilaymiz
    setTimeout(() => {
      saFetchShopsFromCloud()
        .catch(e => console.warn("Cloud shops yuklash xato:", e.message));
    }, 300);
  }
}

function hideSaPanel() {
  document.getElementById("sa-overlay")?.remove();
}

async function saDoLogin() {
  const pass    = document.getElementById("sa-pass")?.value || "";
  const errEl   = document.getElementById("sa-err");
  // SA parol serverda tekshiriladi (Vercel ENV: MERX_SA_PASS)
  let _ok = false;
  try {
    const r = await fetch("/api/auth-v2?action=sa_login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sa-pass": pass },
      body: "{}"
    });
    _ok = r.ok;
  } catch(e) { _ok = false; }
  if (!_ok) {
    if (errEl) { errEl.textContent = "Parol noto'g'ri"; errEl.style.display = "block"; }
    if (document.getElementById("sa-pass")) document.getElementById("sa-pass").value = "";
    return;
  }
  // ⚠️ 2026-08-03: MAYDON DARHOL TOZALANADI.
  // Chrome parolli maydon QIYMATI BILAN yo'q bo'lishini
  // "muvaffaqiyatli kirish" deb biladi va "parolni saqlaymizmi?"
  // deb so'raydi. Maydon bo'sh bo'lsa — so'ramaydi.
  try {
    const _pf = document.getElementById("sa-pass");
    if (_pf) { _pf.value = ""; _pf.blur(); }
  } catch(e) {}

  sessionStorage.setItem("merx_sa_pass", pass);
  localStorage.setItem("merx_sa_pass", pass);   // obnovitdan omon qolsin
  _saSession = { loggedIn: true, ts: Date.now() };
  saSave(); saLoadShops();
  const overlay = document.getElementById("sa-overlay");
  if (overlay) { overlay.innerHTML = buildSaPanel(); renderSaShops(); }

  setTimeout(() => {
    saFetchShopsFromCloud()
      .catch(e => console.warn("Cloud shops yuklash xato:", e.message));
  }, 300);
}

// ── Dashboard statistika ─────────────────────────
function buildSaDashboard() {
  let totalRev = 0, totalSales = 0, totalCust = 0, totalProd = 0, monthRev = 0, monthSales = 0;
  // ⚠️ 2026-08-03: O'LIK KOD OLIB TASHLANDI.
  // Pul kartalari (Jami tushum, Bugungi, Jami qarz) olib
  // tashlangach bu hisob-kitob HECH QAYERDA ishlatilmaydi.
  // Ustiga u `localStorage` dan o'qirdi — kirilmagan do'kon
  // uchun baribir nol berardi.
  const fmt = n => n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?(n/1000).toFixed(0)+"K":String(n||0);
  const active   = _saShops.filter(s=>saIsActive(s)).length;
  const expired  = _saShops.filter(s=>saIsExpired(s)).length;
  // `inactive` ham ishlatilmaydi — "Faolsiz" kartasi olib tashlangan
  // 3 kun ichida muddati tugaydiganlar
  const soon3 = _saShops.filter(s=>{
    if (!s.expiresAt || s.plan==="lifetime") return false;
    const d = Math.ceil((new Date(s.expiresAt)-new Date())/86400000);
    return d>=0 && d<=3;
  }).length;
  // ⚠️ 2026-08-03 TUZATILDI: `m` (joriy oy) e'loni o'lik kod bilan
  // birga olib tashlangan edi va "Bu oy qo'shildi" kartasi
  // "m is not defined" xatosi bilan yiqilardi — butun do'konlar
  // ro'yxati chizilmay qolardi.
  const _oy = (() => {
    const d = new Date(), p2 = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
  })();
  const newShops = _saShops.filter(s => (s.createdAt || "").startsWith(_oy)).length;
  const plans    = {trial:0,monthly:0,yearly:0,lifetime:0};
  _saShops.forEach(s=>{ if(plans[s.plan]!==undefined) plans[s.plan]++; });
  // ⚠️ 2026-08-03: DAROMAD ENDI HAQIQIY YOZUVLARDAN.
  // Avval `localStorage` dagi taxminiy narx × faol do'kon soni
  // hisoblanardi — bu HAQIQIY tushum emas, faqat taxmin edi.
  // Endi `sa_income` jadvalidagi haqiqiy to'lovlar yig'iladi
  // (`saLoadFinance` to'ldiradi).
  const monthlyIncome = 0;   // pastda `sa-inc-val` orqali yangilanadi
  return `
    <!-- 1-qator: Asosiy raqamlar -->
    <div class="sa-kpi5" style="display:grid;grid-template-columns:repeat(5,1fr);gap:0;background:#F8FAFC;border-bottom:1px solid #E5E7EB">
      ${[
        {lbl:"Jami do'konlar",  val:_saShops.length+" ta",  clr:"#0D1B2A", ico:"ti-building-store", sub:""},
        {lbl:"Faol",            val:active+" ta",            clr:"#059669", ico:"ti-circle-check",   sub:"obunalar"},
        {lbl:"Muddati o'tgan",  val:expired+" ta",           clr:expired?"#DC2626":"#334155", ico:"ti-clock-x", sub:""},
        {lbl:"3 kunda tugaydi", val:soon3+" ta",             clr:soon3?"#D97706":"#334155",   ico:"ti-alert-triangle", sub:"diqqat!"},
        // 2026-08-03: "Faolsiz (7 kun)" olib tashlandi — u localStorage
        // dan hisoblanardi, SuperAdmin kirmagan do'kon har doim
        // "faolsiz" ko'rinardi. Noto'g'ri ma'lumot.
        {lbl:"Bu oy qo'shildi", val:newShops+" ta",          clr:"#2563EB", ico:"ti-plus",           sub:"yangi"},
      ].map(k=>`
        <div style="padding:7px 12px;border-right:1px solid #E5E7EB;background:#fff">
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px">
            <i class="ti ${k.ico}" style="font-size:14px;color:${k.clr}"></i>
            <div style="font-size:10px;color:#374151;font-weight:700;text-transform:uppercase;letter-spacing:.04em">${k.lbl}</div>
          </div>
          <div style="font-size:19px;font-weight:800;color:${k.clr}">${k.val}</div>
          ${k.sub?`<div style="font-size:10px;color:#334155;margin-top:2px">${k.sub}</div>`:""}
        </div>`).join("")}
    </div>
    <!-- 2-qator: Obuna -->
    <div class="sa-kpi4" style="display:grid;grid-template-columns:.9fr 1fr 1.1fr 1.4fr;gap:0;background:#fff;border-bottom:1px solid #E5E7EB">
      <!-- 2026-08-03: uch pul kartasi olib tashlandi (Jami tushum,
           Bugungi, Jami qarz) - ular qurilma xotirasidan
           hisoblanardi va kirilmagan do'konda NOL chiqardi. -->
<div style="padding:8px 14px;border-right:1px solid #F3F4F6">
        <!-- 2026-08-03: MOLIYA — haqiqiy daromad, xarajat va foyda.
             Yozuvlar sa_income va sa_expense jadvallarida. -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <div style="font-size:11.5px;color:#334155;font-weight:800;text-transform:uppercase;
            letter-spacing:.04em">💳 Moliya</div>
          <div style="display:flex;gap:4px">
            <button onclick="saOpenFinance('income')" title="Daromad qo'shish"
              style="background:#ECFDF5;border:1px solid #A7F3D0;color:#047857;border-radius:6px;
              padding:2px 7px;font-size:11px;cursor:pointer;font-family:inherit">+ Daromad</button>
            <button onclick="saOpenFinance('expense')" title="Xarajat qo'shish"
              style="background:#FEF2F2;border:1px solid #FECACA;color:#DC2626;border-radius:6px;
              padding:2px 7px;font-size:11px;cursor:pointer;font-family:inherit">+ Xarajat</button>
          </div>
        </div>
        ${[["📈","Daromad","sa-inc","#047857"],["📉","Xarajat","sa-exp","#DC2626"],
           ["💰","Foyda","sa-prf","#7C3AED"],["💱","Kurs","sa-rate","#334155"]]
          .map(([e,l,id,c])=>`<div style="display:flex;justify-content:space-between;
            align-items:baseline;gap:8px;margin-bottom:2px">
            <span style="font-size:12.5px;color:#1F2937">${e} ${l}</span>
            <b id="${id}-val" style="font-size:12.5px;font-weight:800;color:${c}">—</b>
          </div>`).join("")}
      </div>
      <div style="padding:8px 14px;border-right:1px solid #F3F4F6">
        <div style="font-size:11.5px;color:#334155;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Obuna turlari</div>
        ${[["🧪",plans.trial,"#D97706","Sinov"],["📅",plans.monthly,"#2563EB","Oylik"],
           ["📆",plans.yearly,"#059669","Yillik"],["♾️",plans.lifetime,"#7C3AED","Umrlik"]]
          .map(([e,v,c,l])=>`<div style="display:flex;justify-content:space-between;margin-bottom:2px">
            <span style="font-size:12.5px;color:#1F2937">${e} ${l}</span>
            <span style="font-size:12.5px;font-weight:800;color:${c}">${v}</span>
          </div>
`).join("")}
      </div>
<!-- SERVER HOLATI (2026-08-03) — BITTA karta, satr uslubida
           (obuna turlari kabi). Avval uchta alohida karta edi va
           ular ko'p joy egallardi. -->
      <div style="padding:8px 14px">
        <div style="font-size:11.5px;color:#334155;font-weight:800;text-transform:uppercase;
          letter-spacing:.04em;margin-bottom:6px">🖥 Server holati</div>
        ${[["🗄","Baza","sa-db"],["🖼","Rasmlar","sa-img"],
           ["🧮","Jami yozuv","sa-row"]]
          .map(([e,l,id])=>`<div style="display:flex;justify-content:space-between;
            align-items:baseline;gap:8px;margin-bottom:2px">
            <span style="font-size:12.5px;color:#1F2937;white-space:nowrap">${e} ${l}</span>
            <span style="font-size:12.5px;font-weight:800;color:#0D1B2A;
              text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              <span id="${id}-val">—</span>
              <span id="${id}-sub" style="font-weight:600;color:#334155;font-size:11.5px"></span>
            </span>
          </div>`).join("")}
      </div>
      <!-- JADVALLAR (2026-08-03) — eng katta jadvallar ro'yxati.
           Qaysi biri o'sib ketayotganini bir qarashda ko'rish uchun. -->
      <div style="padding:8px 14px">
        <div style="font-size:11.5px;color:#334155;font-weight:800;text-transform:uppercase;
          letter-spacing:.04em;margin-bottom:6px">📋 Jadvallar</div>
        <div id="sa-tables-list" style="font-size:12.5px;color:#334155">—</div>
      </div>
    </div>
      
    `;
}

// ── Panel qurish ─────────────────────────────────
function buildSaPanel() {
  return `
    <!-- 2026-08-03: to'liq ekran — modal emas, alohida ish joyi -->
    <div class="sa-panel" style="background:#fff;width:100%;height:100vh;height:100dvh;
      overflow:hidden;display:flex;flex-direction:column">

      <!-- Header -->
      <div class="sa-head" style="padding:18px 24px;border-bottom:1px solid #E5E7EB;
        display:flex;align-items:center;justify-content:space-between;background:#0D1B2A">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;background:#E9A500;border-radius:10px;
            display:flex;align-items:center;justify-content:center">
            <i class="ti ti-shield-bolt" style="font-size:20px;color:#0D1B2A"></i>
          </div>
          <div>
            <div style="font-size:19px;font-weight:800;color:#fff">Super Admin Panel</div>
            <!-- 2026-08-03: matn soddalashtirildi. Avval "0 ta do'kon
                 boshqaruvi" deb turardi — ro'yxat yuklanmagan paytda
                 nol chiqib, keyin yangilanmasdi. Endi id bilan
                 belgilandi va ro'yxat kelgach yangilanadi. -->
            <div id="sa-shopcount" style="font-size:11px;color:#6B8096">MERX · ${_saShops.length} ta do'kon</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button id="sa-refresh-btn" onclick="saRefreshPanel(this)" title="Bulutdan yangilash"
            style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
            color:#fff;border-radius:8px;padding:6px 12px;font-family:inherit;
            font-size:12px;cursor:pointer;font-weight:600">
            <i class="ti ti-refresh"></i> Yangilash
          </button>
          <button onclick="saLogout()"
            style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
            color:#fca5a5;border-radius:8px;padding:6px 14px;font-family:inherit;
            font-size:12px;cursor:pointer;font-weight:600">
            <i class="ti ti-logout"></i> Chiqish
          </button>
          <button onclick="hideSaPanel()"
            style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
            color:#fff;border-radius:8px;padding:6px 12px;font-family:inherit;
            font-size:16px;cursor:pointer">✕</button>
        </div>
      </div>

      <!-- Dashboard -->
      <div id="sa-dashboard">${buildSaDashboard()}</div>

      <!-- Toolbar -->
      <div class="sa-toolbar" style="padding:12px 20px;border-bottom:1px solid #E5E7EB;
        display:flex;align-items:center;gap:10px;background:#F9FAFB;flex-wrap:wrap">
        <button onclick="saOpenAddShop()"
          style="background:#0D1B2A;border:none;border-radius:8px;padding:8px 18px;
          font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;color:#E9A500;
          display:flex;align-items:center;gap:6px">
          <i class="ti ti-plus"></i> Yangi do'kon
        </button>
        <div style="position:relative">
          <i class="ti ti-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);
            color:#334155;font-size:14px"></i>
          <input id="sa-q" placeholder="Do'kon qidirish..." autocomplete="off" name="nopick-sa-q"
            oninput="renderSaShops()"
            style="background:#fff;border:1.5px solid #E5E7EB;color:#111;
            border-radius:8px;padding:8px 12px 8px 32px;font-family:inherit;font-size:13px;
            outline:none;width:200px" onfocus="this.style.borderColor='#E9A500'"
            onblur="this.style.borderColor='#E5E7EB'">
        </div>
        <div style="display:flex;gap:4px;background:#E5E7EB;border-radius:8px;padding:3px">
          ${["Barchasi","Faol","Muddati o'tgan","Sinov"].map(f=>`
            <button class="sa-fb" data-f="${f}" onclick="saSetFilter(this)"
              style="background:${f==="Barchasi"?"#fff":"transparent"};
              color:${f==="Barchasi"?"#0D1B2A":"#374151"};border:none;
              border-radius:6px;padding:5px 12px;font-family:inherit;
              font-size:12px;font-weight:600;cursor:pointer;transition:all .15s">${f}</button>`).join("")}
        </div>
        <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
          <button onclick="saCheckExpiringSoon()"
            style="background:#FFFBEB;border:1.5px solid #FDE68A;color:#D97706;
            border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;
            font-weight:600;cursor:pointer" title="Muddati yaqin do'konlar">
            ⏰ Muddatlar
          </button>
          <button onclick="saSendExpiryReminders()"
            style="background:#FFF7ED;border:1.5px solid #FED7AA;color:#EA580C;
            border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;
            font-weight:600;cursor:pointer" title="Telegram eslatma yuborish">
            📨 Eslatma
          </button>
          <button onclick="saShowDevices()"
            style="background:#EFF6FF;border:1.5px solid #BFDBFE;color:#1D4ED8;
            border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;
            font-weight:600;cursor:pointer" title="Qaysi qurilma yozayapti, sinxron kechikayaptimi">
            📱 Qurilmalar
          </button>
          <button onclick="saShowInactiveShops()"
            style="background:#F5F3FF;border:1.5px solid #DDD6FE;color:#7C3AED;
            border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;
            font-weight:600;cursor:pointer" title="Faolsiz do'konlar">
            😴 Faolsiz
          </button>
          <button onclick="saOpenPriceSettings()"
            style="background:#F0FDF4;border:1.5px solid #BBF7D0;color:#059669;
            border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;
            font-weight:600;cursor:pointer" title="Obuna narxlarini sozlash">
            💳 Narxlar
          </button>
          <!-- 2026-07-26: merx.uz landing tarif narxlari -->
          <button onclick="saOpenTariffs()"
            style="background:#FFF7ED;border:1.5px solid #FCD9A8;color:#B45309;
            border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;
            font-weight:600;cursor:pointer" title="merx.uz sahifasidagi tarif narxlari">
            🌐 Landing tariflari
          </button>
          <input id="sa-superpass-inp" type="password" placeholder="Yangi super admin paroli" autocomplete="off" name="merx-sa-newkey" data-lpignore="true" data-form-type="other" readonly onfocus="this.removeAttribute('readonly')"
            style="background:#fff;border:1.5px solid #E5E7EB;color:#111;
            border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;
            outline:none;width:160px" onfocus="this.style.borderColor='#E9A500'"
            onblur="this.style.borderColor='#E5E7EB'"
            onkeydown="if(event.key==='Enter')saChangeSuperPass()">
          <button onclick="saChangeSuperPass()"
            style="background:#fff;border:1.5px solid #7C3AED;color:#7C3AED;
            border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;
            font-weight:600;cursor:pointer">
            <i class="ti ti-key"></i> Parol
          </button>
        </div>
      </div>

      <!-- Jadval -->
      <div id="sa-shops-list" style="overflow-y:auto;overflow-x:auto;flex:1"></div>

      <!-- Yangi do'kon modal -->
      <div id="sa-add-modal" style="display:none;position:absolute;inset:0;
        background:rgba(0,0,0,.5);align-items:center;justify-content:center;
        backdrop-filter:blur(2px)">
        <div style="background:#fff;border-radius:16px;padding:28px;width:520px;
          max-width:95vw;box-shadow:0 24px 60px rgba(0,0,0,.2)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            <div style="font-size:19px;font-weight:800;color:#0D1B2A">
              <i class="ti ti-building-store" style="color:#E9A500"></i> Yangi do'kon qo'shish
            </div>
            <button onclick="document.getElementById('sa-add-modal').style.display='none'"
              style="background:#F3F4F6;border:none;border-radius:8px;padding:6px 10px;
              cursor:pointer;color:#374151;font-size:16px">✕</button>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Do'kon nomi *</label>
              <input id="sa-new-name" placeholder="Fashion Store" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Egasi ismi *</label>
              <input id="sa-new-owner" placeholder="Alisher Karimov" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Login (email) *</label>
              <input id="sa-new-login" placeholder="alisher@gmail.com" autocomplete="off" name="nopick-sa-login" style="${saInputStyle()}"
                oninput="saPreviewLogin()">
              <div id="sa-login-preview" style="font-size:12.5px;color:#334155;margin-top:4px"></div>
            </div>
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Telefon raqam</label>
              <input id="sa-new-phone" placeholder="+998 90 123 45 67" autocomplete="off" name="nopick-sa-phone" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Do'kon paroli *</label>
              <div style="position:relative">
                <input id="sa-new-pass" type="password" placeholder="Kirish paroli" autocomplete="new-password" name="sa-nopick-2" style="${saInputStyle()}">
                <button onclick="var i=document.getElementById('sa-new-pass');i.type=i.type==='password'?'text':'password'"
                  style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                  background:none;border:none;cursor:pointer;color:#334155;padding:0">
                  <i class="ti ti-eye" style="font-size:15px"></i>
                </button>
              </div>
            </div>
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Do'kon turi *</label>
              <select id="sa-new-shoptype" style="${saInputStyle()}">
                <option value="ikki">🧩 Oyoq kiyim + Kiyim</option>
                <option value="oyoq">👟 Faqat Oyoq kiyim</option>
                <option value="kiyim">👕 Faqat Kiyim-kechak</option>
                <option value="aralash">📦 Boshqa/Universal (kanstovar, aksessuar...)</option>
              </select>
            </div>
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Obuna turi</label>
              <!-- 2026-08-03: obuna turi o'zgarsa narx ham yangilanadi
                   (yillik tanlansa YILLIK narx tortiladi) -->
              <select id="sa-new-plan" onchange="saNewTierPrice()" style="${saInputStyle()}">
                <option value="trial">🧪 Sinov (30 kun)</option>
                <option value="monthly">📅 Oylik</option>
                <option value="yearly">📆 Yillik</option>
                <option value="lifetime">♾️ Umrlik</option>
              </select>
            </div>
            <!-- 2026-07-26: yangi do'kon uchun tarif, narx va valyuta -->
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Obuna tarifi</label>
              <!-- 2026-08-03: tarif tanlansa narx AVTOMAT qo'yiladi
                   (Narxlar oynasida belgilangan qiymatdan). Kerak
                   bo'lsa qo'lda o'zgartirish mumkin — chegirma
                   berish uchun. -->
              <select id="sa-new-tier" onchange="saNewTierPrice()" style="${saInputStyle()}">
                <option value="pro">Pro (hammasi ochiq)</option>
                <option value="start">Start (bot yopiq)</option>
              </select>
            </div>
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase"><span id="sa-new-price-lbl">Obuna narxi</span></label>
              <input id="sa-new-price" type="number" min="0" step="10000"
                placeholder="Masalan: 349000" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Valyuta rejimi</label>
              <select id="sa-new-curmode" style="${saInputStyle()}">
                <option value="uzs">So'm (faqat so'm)</option>
                <option value="usd">Dollar (faqat $)</option>
                <option value="multi">Ko'p valyutali</option>
              </select>
            </div>
          <!-- Login preview -->
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;
            padding:12px 16px;margin-top:16px">
            <div style="font-size:11px;color:#059669;font-weight:700;margin-bottom:4px">
              <i class="ti ti-info-circle"></i> Kirish ma'lumotlari
            </div>
            <div style="font-size:13px;color:#065F46">
              Login: <strong id="sa-preview-email">—</strong>
            </div>
          </div>

          <div style="display:flex;gap:10px;margin-top:16px">
            <button onclick="saAddShop()"
              style="flex:1;background:#0D1B2A;border:none;border-radius:10px;
              padding:13px;font-family:inherit;font-size:14px;font-weight:700;
              cursor:pointer;color:#E9A500">
              <i class="ti ti-plus"></i> Do'kon yaratish
            </button>
            <button onclick="document.getElementById('sa-add-modal').style.display='none'"
              style="background:#F3F4F6;border:none;border-radius:10px;padding:13px 20px;
              font-family:inherit;font-size:13px;cursor:pointer;color:#374151;font-weight:600">
              Bekor
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function saInputStyle() {
  return `background:#F9FAFB;border:1.5px solid #E5E7EB;color:#111;border-radius:8px;
    padding:9px 12px;font-family:inherit;font-size:13px;outline:none;width:100%;
    box-sizing:border-box`;
}

// Login preview
function saPreviewLogin() {
  const raw = document.getElementById("sa-new-login")?.value.trim() || "";
  const preview = document.getElementById("sa-login-preview");
  const previewEmail = document.getElementById("sa-preview-email");

  let login = raw;
  // Agar faqat raqam bo'lsa — @merx.uz qo'shamiz
  if (/^\d+$/.test(raw.replace(/[\s+\-()]/g, ""))) {
    const clean = raw.replace(/\D/g, "");
    login = clean + "@merx.uz";
    if (preview) preview.textContent = `→ ${login}`;
  } else {
    if (preview) preview.textContent = "";
  }
  if (previewEmail) previewEmail.textContent = login || "—";
}

// ── Filter ────────────────────────────────────────
function saSetFilter(btn) {
  _saFilter = btn.dataset.f;
  document.querySelectorAll(".sa-fb").forEach(b => {
    const on = b.dataset.f === _saFilter;
    b.style.background = on ? "#fff" : "transparent";
    b.style.color      = on ? "#0D1B2A" : "#374151";
  });
  renderSaShops();
}

// ── Do'konlar jadvali ─────────────────────────────

// ══════════════════════════════════════════════════════════════
// SERVER HOLATI (2026-08-03)
// ══════════════════════════════════════════════════════════════
// Bepul rejada baza 500 MB, rasmlar 1 GB. Chegaraga
// yaqinlashganini SEZMAY QOLMASLIK uchun rang bilan ogohlantiradi:
//   70% dan oshsa sariq, 85% dan qizil.
function _saMB(bytes) {
  const mb = (bytes || 0) / 1048576;
  return mb >= 1024 ? (mb / 1024).toFixed(2) + " GB" : mb.toFixed(1) + " MB";
}
function _saUseClr(pct) {
  return pct >= 85 ? "#DC2626" : pct >= 70 ? "#D97706" : "#059669";
}

async function saLoadServerStats() {
  const set = (id, txt, clr) => {
    const e = document.getElementById(id);
    if (!e) return;
    e.textContent = txt;
    if (clr) e.style.color = clr;
  };
  try {
    const d = await _saApi("server_stats", {});
    if (!d || !d.ok) throw new Error(d?.error || "javob yo'q");

    // ── Baza ──
    const dbPct = d.db_limit ? (d.db_bytes / d.db_limit) * 100 : 0;
    set("sa-db-val", _saMB(d.db_bytes), _saUseClr(dbPct));
    set("sa-db-sub", `(${dbPct.toFixed(1)}%)`);

    // ── Rasmlar ──
    const imgPct = d.img_limit ? (d.img_bytes / d.img_limit) * 100 : 0;
    set("sa-img-val", _saMB(d.img_bytes), _saUseClr(imgPct));
    set("sa-img-sub", `(${imgPct.toFixed(1)}% · ${d.img_count || 0} ta)`);

    // ── Jadvallar ro'yxati (2026-08-03) ──
    // Qaysi jadval o'sib ketayotganini bir qarashda ko'rish uchun.
    const tl = document.getElementById("sa-tables-list");
    if (tl) {
      const rows = (d.tables || []).slice(0, 5);
      tl.innerHTML = rows.length ? rows.map(t => `
        <div style="display:flex;justify-content:space-between;align-items:baseline;
          gap:8px;margin-bottom:2px">
          <span style="color:#1F2937;white-space:nowrap;overflow:hidden;
            text-overflow:ellipsis">${t.name}</span>
          <span style="white-space:nowrap;color:#334155">
            <b style="color:#0D1B2A">${_saMB(t.bytes)}</b>
            <span style="font-size:11.5px">· ${(t.rows||0).toLocaleString("ru-RU")}</span>
          </span>
        </div>`).join("") : "ma'lumot yo'q";
    }

    // ── Jami yozuv (2026-08-03) ──
    set("sa-row-val", (d.total_rows || 0).toLocaleString("ru-RU"));
    set("sa-row-sub", "");

    // Chegaraga yaqin bo'lsa ochiq ogohlantirish
    if (dbPct >= 85 || imgPct >= 85) {
      showSaToast("⚠️ Server hajmi chegaraga yaqin — tarifni ko'taring", "err");
    }
  } catch (e) {
    ["sa-db","sa-img","sa-row"].forEach(k => {
      const v = document.getElementById(k + "-val");
      const b = document.getElementById(k + "-sub");
      if (v) v.textContent = "—";
      if (b) b.textContent = "olinmadi";
    });
    console.warn("server_stats:", e.message);
  }
}


// ══════════════════════════════════════════════════════════════
// MOLIYA — DAROMAD VA XARAJAT (2026-08-03)
// ══════════════════════════════════════════════════════════════
// Daromad: do'kon obuna to'lovi. Xarajat: Supabase, Cloud, domen...
// Ikkalasi ham teg uslubida, valyuta va sana bilan.
// KPI kartasi shu yozuvlardan hisoblanadi (taxminiy narxdan emas).
let _saFin = { income: [], expense: [], tariffs: [] };
// 2026-08-03: joriy Markaziy bank kursi — kartada ko'rsatiladi
// va yangi yozuvlarda shu muzlatiladi.
let _saRate = 0;
// 2026-08-03: do'kon faolligi BULUTDAN (avval localStorage dan
// olinardi va kirilmagan do'kon "Ma'lumot yo'q" ko'rsatardi).
let _saAct = {};

async function saLoadActivity() {
  try {
    const d = await _saApi("sa_finance", { op: "activity" });
    if (d && d.ok) { _saAct = d.activity || {}; renderSaShops(); }
  } catch (e) { console.warn("faollik:", e.message); }
}

async function saLoadRate() {
  try {
    const r = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/");
    const j = await r.json();
    _saRate = parseFloat(j?.[0]?.Rate) || 0;
  } catch (e) { console.warn("kurs olinmadi:", e.message); }
  try { saRenderFinKpi(); } catch(e) {}
}

const SA_EXP_TAGS_DEF = ["Supabase", "Vercel", "Domen", "Telegram bot",
                         "Reklama", "Dizayn", "Boshqa"];

// ⚠️ 2026-08-03: TEGLAR BAZADAN HAM OLINADI.
// Yangi teg yozilsa u xarajat yozuvi bilan birga Supabase'ga
// tushadi — keyingi safar ro'yxatda avtomat chiqadi.
// Alohida jadval kerak emas: mavjud yozuvlardan yig'iladi.
function saExpTags() {
  const bazadan = [...new Set((_saFin.expense || [])
    .map(x => (x.tag || "").trim()).filter(Boolean))];
  return [...new Set([...SA_EXP_TAGS_DEF, ...bazadan])];
}

async function saLoadFinance() {
  try {
    const d = await _saApi("sa_finance", { op: "load" });
    if (!d || !d.ok) return;
    _saFin = { income: d.income || [], expense: d.expense || [], tariffs: d.tariffs || [] };
    _saTariffs = _saFin.tariffs;
    saRenderFinKpi();
  } catch (e) { console.warn("moliya:", e.message); }
}

// Dollar summalarni so'mga keltirib jamlaymiz
// ⚠️ 2026-08-03: KURS YOZUVNING O'ZIDAN OLINADI.
// Avval `db.settings.rate` ishlatilardi — u SuperAdmin qaysi
// do'konga kirganiga bog'liq edi va kurs o'zgarsa O'TMISH ham
// o'zgarardi. Endi har yozuvda o'z kursi muzlatilgan (§3.5).
function _saSum(rows) {
  return (rows || []).reduce((a, r) => {
    const amt = +r.amount || 0;
    if (r.currency !== "usd") return a + amt;
    const rt = +r.rate || 12100;      // eski yozuvlar uchun zaxira
    return a + amt * rt;
  }, 0);
}

function saRenderFinKpi() {
  // 2026-08-06: QISQARTIRISH OLIB TASHLANDI (2.0M → 2 019 400).
  // Yagona manba: utils.js dagi fmt().
  const inc = _saSum(_saFin.income);
  const exp = _saSum(_saFin.expense);
  const set = (id, v, clr) => {
    const e = document.getElementById(id);
    if (!e) return;
    e.textContent = fmt(Math.round(v) || 0) + " so'm";
    if (clr) e.style.color = clr;
  };
  set("sa-inc-val", inc);
  set("sa-exp-val", exp);
  set("sa-prf-val", inc - exp, (inc - exp) >= 0 ? "#7C3AED" : "#DC2626");
  // 2026-08-03: joriy kurs — yangi yozuvlar shu bilan muzlatiladi
  const rEl = document.getElementById("sa-rate-val");
  if (rEl) rEl.textContent = _saRate
    ? Math.round(_saRate).toLocaleString("ru-RU") + " so'm"
    : "yuklanmoqda...";
}

// ── Qo'shish va ro'yxat oynasi ──
async function saOpenFinance(kind) {
  // 2026-08-03: tarif va yozuvlar yuklanmagan bo'lsa — avval olamiz.
  // Busiz daromad oynasida tarif ro'yxati bo'sh chiqardi va
  // avtomat narx ishlamasdi.
  if (!(_saTariffs || []).length || !(_saFin.income || []).length) {
    try { await saLoadFinance(); } catch(e) {}
  }
  document.getElementById("sa-fin-modal")?.remove();
  const isInc = kind === "income";
  const m = document.createElement("div");
  m.id = "sa-fin-modal";
  m.style.cssText = "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.5);" +
    "display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif";
  const iCss = "width:100%;font-family:inherit;font-size:13.5px;border:1.5px solid #E5E7EB;" +
               "border-radius:8px;padding:8px 10px;box-sizing:border-box";
  const bugun = new Date();
  const p2 = n => String(n).padStart(2, "0");
  const dStr = `${bugun.getFullYear()}-${p2(bugun.getMonth()+1)}-${p2(bugun.getDate())}`;

  m.innerHTML = `<div style="background:#fff;border-radius:16px;padding:22px;width:660px;
    max-width:96vw;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.25)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:16px;font-weight:800;color:#0D1B2A">
        ${isInc ? "📈 Daromadlar" : "📉 Xarajatlar"}</div>
      <button onclick="document.getElementById('sa-fin-modal').remove()"
        style="background:none;border:none;font-size:24px;cursor:pointer;color:#334155">×</button>
    </div>

    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;
      padding:14px;margin-bottom:14px">
      <div style="font-size:12.5px;font-weight:800;color:#334155;margin-bottom:9px">
        Yangi ${isInc ? "daromad" : "xarajat"}</div>
      ${isInc ? `
      <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:9px;margin-bottom:9px">
        <div><label style="font-size:11.5px;color:#334155;font-weight:700">Do'kon</label>
          <select id="fin-shop" style="${iCss}">
            <option value="">— tanlang —</option>
            ${(_saShops||[]).map(sh=>`<option value="${sh.id}">${sh.name}</option>`).join("")}
          </select></div>
        <div><label style="font-size:11.5px;color:#334155;font-weight:700">Tarif</label>
          <select id="fin-tariff" style="${iCss}">
            ${(_saTariffs||[]).map(t=>`<option value="${t.id}">${t.title}</option>`).join("")}
          </select></div>
        <div><label style="font-size:11.5px;color:#334155;font-weight:700">Davr</label>
          <select id="fin-period" onchange="saFinAutoPrice()" style="${iCss}">
            <option value="oylik">Oylik</option><option value="yillik">Yillik</option>
          </select></div>
      </div>` : `
      <div style="margin-bottom:9px">
        <label style="font-size:11.5px;color:#334155;font-weight:700">Turi</label>
        <div id="fin-tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px">
          ${saExpTags().map((t,i)=>`
            <button type="button" onclick="saFinPickTag('${t}')" id="fintag-${i}"
              style="border:1.5px solid ${i===0?'#0D1B2A':'#E5E7EB'};
              background:${i===0?'#0D1B2A':'#fff'};color:${i===0?'#fff':'#334155'};
              border-radius:20px;padding:5px 13px;font-size:12.5px;cursor:pointer;
              font-family:inherit">${t}</button>`).join("")}
        </div>
        <input type="hidden" id="fin-tag" value="${saExpTags()[0]}">
        <div style="display:flex;gap:6px;margin-top:7px">
          <input id="fin-newtag" placeholder="Yangi teg yozing..."
            onkeydown="if(event.key==='Enter'){event.preventDefault();saFinAddTag();}"
            style="flex:1;font-family:inherit;font-size:12.5px;border:1.5px solid #E5E7EB;
            border-radius:20px;padding:5px 13px;box-sizing:border-box">
          <button type="button" onclick="saFinAddTag()"
            style="border:1.5px solid #0D1B2A;background:#fff;color:#0D1B2A;border-radius:20px;
            padding:5px 14px;font-size:12.5px;cursor:pointer;font-family:inherit;
            font-weight:700">+ Qo'shish</button>
        </div>
      </div>`}
      <div style="display:grid;grid-template-columns:1.2fr .8fr 1fr;gap:9px;margin-bottom:9px">
        <div><label style="font-size:11.5px;color:#334155;font-weight:700">Summa</label>
          <input id="fin-amount" type="number" min="0" step="0.01" placeholder="0" style="${iCss}"></div>
        <div><label style="font-size:11.5px;color:#334155;font-weight:700">Valyuta</label>
          <select id="fin-cur" style="${iCss}">
            <option value="uzs">so'm</option><option value="usd">USD</option></select></div>
        <div><label style="font-size:11.5px;color:#334155;font-weight:700">Sana</label>
          <input id="fin-date" type="date" value="${dStr}" style="${iCss}"></div>
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:11.5px;color:#334155;font-weight:700">Izoh</label>
        <input id="fin-note" placeholder="ixtiyoriy" style="${iCss}"></div>
      <button onclick="saFinAdd('${kind}')"
        style="width:100%;background:${isInc?'#047857':'#DC2626'};color:#fff;border:none;
        border-radius:9px;padding:10px;font-family:inherit;font-size:13.5px;
        font-weight:700;cursor:pointer">Qo'shish</button>
    </div>

    <!-- 2026-08-03: qidiruv va sana filtri -->
    <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;
      margin-bottom:11px;align-items:end">
      <div><label style="font-size:11.5px;color:#334155;font-weight:700">Qidiruv</label>
        <input id="fin-q" placeholder="izoh, do'kon, teg..." oninput="saFinRenderList('${kind}')"
          style="${iCss}"></div>
      <div><label style="font-size:11.5px;color:#334155;font-weight:700">Dan</label>
        <input id="fin-f1" type="date" onchange="saFinRenderList('${kind}')" style="${iCss}"></div>
      <div><label style="font-size:11.5px;color:#334155;font-weight:700">Gacha</label>
        <input id="fin-f2" type="date" onchange="saFinRenderList('${kind}')" style="${iCss}"></div>
      <button onclick="saFinQuick('${kind}')" title="Shu oy"
        style="border:1.5px solid #E5E7EB;background:#fff;color:#334155;border-radius:8px;
        padding:8px 12px;font-size:12.5px;cursor:pointer;font-family:inherit;
        white-space:nowrap">Shu oy</button>
    </div>
    <div id="fin-list"></div>
  </div>`;
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
  if (isInc) saFinAutoPrice();
  saFinRenderList(kind);
}

// Tarif va davrga qarab summani avtomat qo'yamiz
function saFinAutoPrice() {
  const tid = document.getElementById("fin-tariff")?.value;
  const per = document.getElementById("fin-period")?.value;
  const a   = document.getElementById("fin-amount");
  const t = (_saTariffs || []).find(x => x.id === tid);
  // ⚠️ 2026-08-03: TARIF NARXI QO'YILMAGAN BO'LSA — OCHIQ AYTAMIZ.
  // Avval jimgina o'tib ketardi va "avtomat ishlamadi" deb
  // ko'rinardi. Aslida `sa_tariffs` da narx 0 edi.
  if (!t) {
    if (a) a.placeholder = "Tariflar yuklanmadi";
    return;
  }
  const amt = per === "yillik" ? (+t.price_year || 0) : (+t.price_month || 0);
  if (a) {
    if (amt > 0) { a.value = amt; a.placeholder = "0"; }
    else { a.value = ""; a.placeholder = "Narxlar oynasida tarif narxini kiriting"; }
  }
  const c = document.getElementById("fin-cur");
  if (c && t.currency) c.value = t.currency;
}

// Yangi teg qo'shish (2026-08-03).
// Teg alohida jadvalda saqlanmaydi — xarajat yozuvi bilan birga
// Supabase'ga tushadi va keyingi safar ro'yxatda avtomat chiqadi.
function saFinAddTag() {
  const inp = document.getElementById("fin-newtag"); if (!inp) return;
  const t = (inp.value || "").trim();
  if (!t) { inp.focus(); return; }
  const box = document.getElementById("fin-tags"); if (!box) return;
  // allaqachon bormi
  const bor = [...box.querySelectorAll("button")].some(
    b => b.textContent.trim().toLowerCase() === t.toLowerCase());
  if (!bor) {
    const i = box.querySelectorAll("button").length;
    const b = document.createElement("button");
    b.type = "button"; b.id = "fintag-" + i; b.textContent = t;
    b.style.cssText = "border:1.5px solid #E5E7EB;background:#fff;color:#334155;" +
      "border-radius:20px;padding:5px 13px;font-size:12.5px;cursor:pointer;font-family:inherit";
    b.onclick = () => saFinPickTag(t);
    box.appendChild(b);
  }
  saFinPickTag(t);
  inp.value = "";
}

function saFinPickTag(tag) {
  const h = document.getElementById("fin-tag"); if (h) h.value = tag;
  // 2026-08-03: qo'lda qo'shilgan teglar ham bor — DOM dan olamiz
  const box = document.getElementById("fin-tags"); if (!box) return;
  box.querySelectorAll("button").forEach(b => {
    const on = b.textContent.trim() === tag;
    b.style.borderColor = on ? "#0D1B2A" : "#E5E7EB";
    b.style.background  = on ? "#0D1B2A" : "#fff";
    b.style.color       = on ? "#fff"    : "#334155";
  });
}

async function saFinAdd(kind) {
  const isInc = kind === "income";
  const amount = parseFloat(document.getElementById("fin-amount")?.value) || 0;
  if (!(amount > 0)) { showSaToast("⚠️ Summani kiriting", "err"); return; }
  const row = {
    amount,
    currency: document.getElementById("fin-cur")?.value || "uzs",
    date:     document.getElementById("fin-date")?.value || null,
    note:     document.getElementById("fin-note")?.value.trim() || null
  };
  if (isInc) {
    const sid = document.getElementById("fin-shop")?.value || "";
    const sh  = (_saShops || []).find(x => x.id === sid);
    row.shop_id   = sid || null;
    row.shop_name = sh ? sh.name : null;
    row.tariff    = document.getElementById("fin-tariff")?.value || null;
    row.period    = document.getElementById("fin-period")?.value || null;
  } else {
    row.tag = document.getElementById("fin-tag")?.value || "Boshqa";
  }
  try {
    const d = await _saApi("sa_finance", { op: isInc ? "add_income" : "add_expense", row });
    if (!d || !d.ok) throw new Error(d?.error || "saqlanmadi");
    showSaToast("✅ Qo'shildi");
    document.getElementById("fin-amount").value = "";
    document.getElementById("fin-note").value = "";
    await saLoadFinance();
    saFinRenderList(kind);
  } catch (e) { showSaToast("⚠️ " + e.message, "err"); }
}

// ⚠️ 2026-08-03: RO'YXAT CHEKLANADI.
// Yozuvlar to'planib borsa oyna cheksiz uzayardi. Endi oxirgi
// 20 tasi ko'rsatiladi, ro'yxat o'z ichida aylanadi, pastda
// "hammasini ko'rish" tugmasi bor.
// 2026-08-03: 20 tadan varaqlanadi (avval "hammasini ko'rish"
// tugmasi bor edi va ro'yxat baribir uzayib ketardi).
let _saFinPage = 1;
const SA_FIN_PER = 20;

function saFinRenderList(kind) {
  const el = document.getElementById("fin-list"); if (!el) return;
  const isInc = kind === "income";
  let hammasi = (isInc ? _saFin.income : _saFin.expense) || [];

  // 2026-08-03: qidiruv va sana oralig'i
  const q  = (document.getElementById("fin-q")?.value || "").trim().toLowerCase();
  const f1 = document.getElementById("fin-f1")?.value || "";
  const f2 = document.getElementById("fin-f2")?.value || "";
  if (q) hammasi = hammasi.filter(r =>
    [r.note, r.shop_name, r.tag, r.tariff, r.period, String(r.amount)]
      .some(v => (v || "").toString().toLowerCase().includes(q)));
  if (f1) hammasi = hammasi.filter(r => (r.date || "") >= f1);
  if (f2) hammasi = hammasi.filter(r => (r.date || "") <= f2);

  // Filtr o'zgarsa birinchi sahifaga qaytamiz
  if (q || f1 || f2) { if (_saFinPage > Math.ceil(hammasi.length / SA_FIN_PER)) _saFinPage = 1; }

  const sahifalar = Math.max(1, Math.ceil(hammasi.length / SA_FIN_PER));
  if (_saFinPage > sahifalar) _saFinPage = sahifalar;
  const rows = hammasi.slice((_saFinPage - 1) * SA_FIN_PER, _saFinPage * SA_FIN_PER);
  const money = r => (r.currency === "usd" ? "$" : "") +
    (+r.amount || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) +
    (r.currency === "usd" ? "" : " so'm");
  if (!rows.length) {
    el.innerHTML = `<div style="text-align:center;color:#334155;padding:22px">
      Hali yozuv yo'q</div>`;
    return;
  }
  const jami = hammasi.length;
  const yigindi = _saSum(hammasi);
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;
      margin-bottom:7px;font-size:12.5px;color:#334155">
      <span>${(document.getElementById("fin-q")?.value ||
        document.getElementById("fin-f1")?.value ||
        document.getElementById("fin-f2")?.value) ? "Topildi" : "Jami"}
        <b style="color:#0D1B2A">${jami}</b> yozuv</span>
      <span>Yig'indi: <b style="color:${isInc ? "#047857" : "#DC2626"}">
        ${Math.round(yigindi).toLocaleString("ru-RU")} so'm</b></span>
    </div>
    <div style="max-height:300px;overflow-y:auto;border:1px solid #E5E7EB;border-radius:10px">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#F9FAFB">
      <th style="text-align:left;padding:8px 10px;font-size:11.5px;color:#334155">SANA</th>
      <th style="text-align:left;padding:8px 10px;font-size:11.5px;color:#334155">
        ${isInc ? "DO'KON" : "TURI"}</th>
      <th style="text-align:left;padding:8px 10px;font-size:11.5px;color:#334155">IZOH</th>
      <th style="text-align:right;padding:8px 10px;font-size:11.5px;color:#334155">SUMMA</th>
      <th style="width:36px"></th>
    </tr></thead><tbody>
    ${rows.map(r => `<tr style="border-top:1px solid #F3F4F6">
      <td style="padding:8px 10px;color:#334155">${r.date || "—"}</td>
      <td style="padding:8px 10px;color:#1F2937;font-weight:600">
        ${isInc ? (r.shop_name || "—") : (r.tag || "—")}
        ${isInc && r.period ? `<span style="font-size:11px;color:#334155"> · ${r.period}</span>` : ""}</td>
      <td style="padding:8px 10px;color:#334155">${r.note || ""}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:800;
        color:${isInc ? "#047857" : "#DC2626"}">${money(r)}</td>
      <td style="padding:8px 6px;text-align:right">
        <button onclick="saFinDel('${kind}',${r.id})" title="O'chirish"
          style="background:none;border:none;color:#DC2626;cursor:pointer;font-size:14px">🗑</button></td>
    </tr>`).join("")}</tbody></table></div>
    ${sahifalar > 1 ? `
    <div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:9px">
      <button onclick="saFinPage('${kind}',-1)" ${_saFinPage<=1?"disabled":""}
        style="border:1px solid #E5E7EB;background:#fff;color:#334155;border-radius:7px;
        padding:5px 12px;font-size:12.5px;cursor:${_saFinPage<=1?"default":"pointer"};
        opacity:${_saFinPage<=1?".4":"1"};font-family:inherit">‹ Oldingi</button>
      <span style="font-size:12.5px;color:#334155">
        ${_saFinPage} / ${sahifalar}</span>
      <button onclick="saFinPage('${kind}',1)" ${_saFinPage>=sahifalar?"disabled":""}
        style="border:1px solid #E5E7EB;background:#fff;color:#334155;border-radius:7px;
        padding:5px 12px;font-size:12.5px;cursor:${_saFinPage>=sahifalar?"default":"pointer"};
        opacity:${_saFinPage>=sahifalar?".4":"1"};font-family:inherit">Keyingi ›</button>
    </div>` : ""}`;
}

// "Shu oy" tugmasi — sana oralig'ini oyning boshi va oxiriga
// qo'yadi. Ikkinchi bosishda tozalaydi (2026-08-03).
function saFinPage(kind, d) {
  _saFinPage = Math.max(1, _saFinPage + d);
  saFinRenderList(kind);
}

function saFinQuick(kind) {
  const f1 = document.getElementById("fin-f1");
  const f2 = document.getElementById("fin-f2");
  if (!f1 || !f2) return;
  if (f1.value || f2.value) { f1.value = ""; f2.value = ""; }
  else {
    const d = new Date(), p2 = n => String(n).padStart(2, "0");
    const y = d.getFullYear(), m = d.getMonth();
    const oxir = new Date(y, m + 1, 0).getDate();
    f1.value = `${y}-${p2(m + 1)}-01`;
    f2.value = `${y}-${p2(m + 1)}-${p2(oxir)}`;
  }
  saFinRenderList(kind);
}

async function saFinDel(kind, id) {
  if (!confirm("Bu yozuv o'chirilsinmi?")) return;
  try {
    const d = await _saApi("sa_finance",
      { op: kind === "income" ? "del_income" : "del_expense", id });
    if (!d || !d.ok) throw new Error(d?.error || "o'chmadi");
    await saLoadFinance();
    saFinRenderList(kind);
    showSaToast("✅ O'chirildi");
  } catch (e) { showSaToast("⚠️ " + e.message, "err"); }
}

// Tarif tanlanganda narxni avtomat qo'yamiz (2026-08-03).
// Narx `sa_tariffs` dan — Narxlar oynasida belgilanadi.
// Qo'lda o'zgartirish mumkin: alohida do'konga chegirma berish uchun.
function saNewTierPrice() {
  const id   = document.getElementById("sa-new-tier")?.value;
  const plan = document.getElementById("sa-new-plan")?.value || "monthly";
  const p    = document.getElementById("sa-new-price");
  const lbl  = document.getElementById("sa-new-price-lbl");
  if (!p) return;
  const t = (_saTariffs || []).find(x => x.id === id);
  if (!t) { p.placeholder = "Tariflar yuklanmadi"; return; }

  // ⚠️ 2026-08-03: DAVRGA QARAB NARX.
  // Avval oyna faqat OYLIK narxni tortardi — yillik tanlansa ham
  // o'sha chiqardi. Sarlavhada ham "(so'm/oy)" qotib qolgandi.
  const yillik = plan === "yearly";
  const amt = yillik ? (+t.price_year || 0) : (+t.price_month || 0);
  const bir = t.currency === "usd" ? "$" : "so'm";

  if (lbl) lbl.textContent = plan === "trial"    ? "Obuna narxi (sinov)"
                           : plan === "lifetime" ? `Obuna narxi (${bir}, umrlik)`
                           : yillik              ? `Obuna narxi (${bir}/yil)`
                           :                       `Obuna narxi (${bir}/oy)`;

  if (plan === "trial") { p.value = ""; p.placeholder = "Sinov — bepul"; return; }
  if (amt > 0) { p.value = Math.round(amt); p.placeholder = "0"; }
  else { p.value = ""; p.placeholder = "Narxlar oynasida tarif narxini kiriting"; }
}

// ══════════════════════════════════════════════════════════════
// ASOSIY DB — YAGONA MANBA (2026-08-03)
// ══════════════════════════════════════════════════════════════
// ⚠️ Kodda 7 joyda `localStorage.getItem("merx_v5")` yozilgan edi.
// Bu ESKI, do'konsiz kalit. Hozirgi tizimda do'kon bazasi
// `merx_v5_shop_xxx` ko'rinishida — ya'ni u yo'q va hamma joyda
// bo'sh obyekt qaytardi. Oqibati: bot havolasi ishlamagan,
// do'kon ochilganda kalitlar bo'shab qolgan.
// Endi yagona funksiya: avval eski kalit, topilmasa birinchi
// to'ldirilgan do'kon bazasi.
function _saMainDB() {
  try {
    const eski = _saMainDB();
    if (eski && eski.settings) return eski;
  } catch(e) {}
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("merx_v5")) continue;
      const d = JSON.parse(localStorage.getItem(k) || "{}");
      if (d && d.settings) return d;
    }
  } catch(e) {}
  return {};
}

// ⚠️ 2026-08-05: SAHIFA QAYTA YUKLANISHIDAN OLDIN SINXRON.
// Chiqish, do'kon almashtirish va qaytish — hammasi
// `location.reload()` qiladi. Kutilayotgan yozuv (sotuv, tahrir)
// bulutga yetmagan bo'lsa YO'QOLADI.
// 2026-08-05, Shoetest: ikki sotuv aynan shunday yo'qolgan.
async function _saFlushSync() {
  try {
    if (typeof pushToCloud === "function") {
      await Promise.race([
        pushToCloud(),
        new Promise(r => setTimeout(r, 8000))
      ]);
    }
  } catch (e) { console.warn("sinxron tugallanmadi:", e.message); }
}

function renderSaShops() {
  const el = document.getElementById("sa-shops-list"); if (!el) return;
  // 2026-08-03: server holati bir marta yuklanadi
  if (!window._saStatsLoaded) {
    window._saStatsLoaded = true;
    try { saLoadServerStats(); } catch(e) {}
    try { saLoadFinance(); } catch(e) {}
    try { saLoadRate(); } catch(e) {}
    try { saLoadActivity(); } catch(e) {}
  }
  // 2026-08-03: sarlavhadagi do'kon soni ro'yxat kelgach yangilanadi
  try {
    const _c = document.getElementById("sa-shopcount");
    if (_c) _c.textContent = `MERX · ${_saShops.length} ta do'kon`;
  } catch(e) {}
  const q  = document.getElementById("sa-q")?.value.toLowerCase() || "";

  let list = [..._saShops].sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
  if (q) list = list.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.ownerName||"").toLowerCase().includes(q) ||
    (s.phone||"").includes(q) ||
    (s.ownerEmail||"").toLowerCase().includes(q)
  );
  if (_saFilter === "Faol")           list = list.filter(s => saIsActive(s));
  if (_saFilter === "Muddati o'tgan") list = list.filter(s => saIsExpired(s));
  if (_saFilter === "Sinov")          list = list.filter(s => s.plan === "trial");

  if (!list.length) {
    el.innerHTML = `<div style="text-align:center;padding:60px;color:#334155;font-size:14px">
      <i class="ti ti-building-off" style="font-size:40px;display:block;margin-bottom:12px"></i>
      ${q ? `"${q}" topilmadi` : "Do'konlar yo'q"}</div>`;
    return;
  }

  const planColors = {trial:"#D97706",monthly:"#2563EB",yearly:"#059669",lifetime:"#7C3AED"};
  const planLabels = {trial:"Sinov",monthly:"Oylik",yearly:"Yillik",lifetime:"Umrlik"};

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#F9FAFB;border-bottom:2px solid #E5E7EB">
          <!-- 2026-08-03: tartib raqami ustuni -->
          <th style="text-align:center;padding:10px 8px;color:#374151;font-size:13.5px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700;width:42px">№</th>
          <th style="text-align:left;padding:10px 16px;color:#374151;font-size:13.5px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Do'kon</th>
          <th style="text-align:left;padding:10px 16px;color:#374151;font-size:13.5px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Egasi · Login</th>
          <th style="text-align:left;padding:10px 16px;color:#374151;font-size:13.5px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Obuna</th>
          <th style="text-align:left;padding:10px 16px;color:#374151;font-size:13.5px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Muddat</th>
          <th style="text-align:left;padding:10px 16px;color:#374151;font-size:13.5px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Faollik</th>
          <th style="text-align:left;padding:10px 16px;color:#374151;font-size:13.5px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Holat</th>
          <th style="padding:10px 16px;color:#374151;font-size:13.5px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700;text-align:center">Amallar</th>
        </tr>
      </thead>
      <tbody>
        ${list.map((s, _i) => {
          const active  = saIsActive(s);
          const expired = saIsExpired(s);
          const statusBg   = active ? "#ECFDF5" : expired ? "#FEF2F2" : "#FFFBEB";
          const statusClr  = active ? "#059669" : expired ? "#DC2626" : "#D97706";
          const statusText = active ? "✅ Faol" : expired ? "❌ Muddati o'tgan" : "🧪 Sinov";
          const expDate = s.expiresAt ? s.expiresAt.slice(0,10) : "—";
          const planClr = planColors[s.plan] || "#374151";
          const login = s.ownerEmail || (s.phone ? s.phone.replace(/\D/g,"")+"@merx.uz" : "—");

          return `<tr style="border-bottom:1px solid #F3F4F6;transition:background .1s"
            onmouseover="this.style.background='#F9FAFB'" onmouseout="this.style.background=''">
            <!-- 2026-08-03: tartib raqami -->
            <td style="padding:13px 8px;text-align:center;color:#334155;
              font-size:13px;font-weight:700">${_i + 1}</td>
            <td style="padding:13px 16px">
              <div style="font-weight:700;color:#111827;cursor:pointer;display:flex;align-items:center;gap:8px"
                onclick="saShowStats('${s.id}')">
                <div style="width:32px;height:32px;background:#F3F4F6;border-radius:8px;
                  display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
                  ${s.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style="color:#0D1B2A;font-weight:700">${s.name}
                    <!-- 2026-07-26: obuna tarifi belgisi -->
                    <span style="font-size:13.5px;font-weight:800;padding:2px 7px;border-radius:20px;
                      margin-left:6px;vertical-align:middle;
                      background:${(s.tier||"pro")==="pro" ? "#0D1B2A" : "#FEF3C7"};
                      color:${(s.tier||"pro")==="pro" ? "#fff" : "#92400E"}">
                      ${(s.tier||"pro")==="pro" ? "PRO" : "START"}
                    </span>
                    ${s.priceUzs ? `<span style="font-size:11.5px;color:#374151;margin-left:5px">
                      ${Number(s.priceUzs).toLocaleString("ru-RU")} so'm/oy</span>` : ""}
                  </div>
                  <div style="font-size:13.5px;color:#334155;font-family:monospace">
                    ${s.id.slice(0,24)}...
                  </div>
                </div>
              </div>
            </td>
            <td style="padding:13px 16px">
              <div style="font-weight:600;color:#374151">${s.ownerName || "—"}</div>
              <div style="font-size:13px;color:#374151;margin-top:2px">
                <i class="ti ti-mail" style="font-size:13.5px"></i> ${login}
              </div>
              ${s.phone ? `<div style="font-size:13px;color:#334155">📞 ${s.phone}</div>` : ""}
            </td>
            <td style="padding:13px 16px">
              <span style="background:${planClr}18;color:${planClr};border:1px solid ${planClr}40;
                border-radius:6px;padding:3px 10px;font-size:13px;font-weight:700">
                ${planLabels[s.plan]||s.plan}
              </span>
            </td>
            <td style="padding:13px 16px;font-size:13px;color:${expired?"#DC2626":"#374151"}">
              ${s.plan==="lifetime" ? "<span style='color:#7C3AED;font-weight:700'>♾️ Cheksiz</span>" : expDate}
            </td>
            <td style="padding:13px 16px">
              ${(()=>{
                // 2026-08-03: BULUTDAN. Matndagi kirill harflari ham
                // tuzatildi ("Sotuvсиз" da s va i kirill edi).
                const key = s.cloudShopId || s.shop_id || s.id;
                const st  = _saAct[key];
                if (!st) return '<span style="font-size:13px;color:#334155">—</span>';
                const p2 = n => String(n).padStart(2,"0");
                const d  = new Date();
                const bugun = `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
                const kun = st.last
                  ? Math.floor((new Date(bugun) - new Date(st.last)) / 86400000) : null;
                let clr = "#334155", txt = "⚪ Sotuvsiz";
                if (kun === 0)      { clr = "#059669"; txt = "🟢 Bugun"; }
                else if (kun === null) {}
                else if (kun <= 7)  { clr = "#D97706"; txt = "🟡 " + kun + " kun oldin"; }
                else if (kun <= 30) { clr = "#F97316"; txt = "🟠 " + kun + " kun oldin"; }
                else                { clr = "#DC2626"; txt = "🔴 " + kun + " kun oldin"; }
                return '<div style="font-size:13px;font-weight:600;color:' + clr + '">' + txt + '</div>'
                  + (st.today > 0
                     ? '<div style="font-size:12.5px;color:#334155">Bugun: ' + st.today + ' sotuv</div>'
                     : '');
              })()}
            </td>
            <td style="padding:13px 16px">
              <span style="background:${statusBg};color:${statusClr};
                border-radius:6px;padding:4px 10px;font-size:13px;font-weight:600">
                ${statusText}
              </span>
            </td>
            <td style="padding:13px 16px">
              <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
                <button onclick="saOpenShop('${s.id}')" title="Do'konga kirish"
                  style="background:#E9A500;border:none;color:#0D1B2A;border-radius:7px;
                  padding:6px 10px;font-size:13px;cursor:pointer;font-weight:700">
                  🔑</button>
                
                <button onclick="saCopyOwnerLink('${s.id}')"
                  style="background:#FEF3C7;border:1px solid #FDE68A;color:#B45309;
                  border-radius:7px;padding:6px 10px;font-size:13px;cursor:pointer"
                  title="EGA havolasi — do'kon egasini botga ulash">👑</button>
                <button onclick="saEditShopFull('${s.id}')" title="Tahrirlash"
                  style="background:#EFF6FF;border:1px solid #BFDBFE;color:#2563EB;
                  border-radius:7px;padding:6px 10px;font-size:13px;cursor:pointer">✏️</button>
                <button onclick="saOpenBackups('${s.id}','${(s.name||'').replace(/'/g,'')}')" title="Zaxiralar (tiklash)"
                  style="background:#F5F3FF;border:1px solid #DDD6FE;color:#7C3AED;
                  border-radius:7px;padding:6px 10px;font-size:13px;cursor:pointer">🗄️</button>
                <button onclick="saToggleShop('${s.id}')" title="${active?'Bloklash':'Faollashtirish'}"
                  style="background:${active?"#FEF2F2":"#ECFDF5"};
                  border:1px solid ${active?"#FECACA":"#BBF7D0"};
                  color:${active?"#DC2626":"#059669"};
                  border-radius:7px;padding:6px 10px;font-size:13px;cursor:pointer">
                  ${active ? "🔒" : "✅"}</button>
                <button onclick="saDeleteShop('${s.id}')" title="O'chirish"
                  style="background:#FEF2F2;border:1px solid #FECACA;color:#DC2626;
                  border-radius:7px;padding:6px 10px;font-size:13px;cursor:pointer">🗑️</button>
              </div>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

// ── Do'kon yaratish ───────────────────────────────
function saOpenAddShop() {
  const modal = document.getElementById("sa-add-modal");
  if (modal) { modal.style.display = "flex"; saPreviewLogin(); }
}

async function saAddShop() {
  const name    = document.getElementById("sa-new-name")?.value.trim();
  const owner   = document.getElementById("sa-new-owner")?.value.trim();
  const rawLogin= document.getElementById("sa-new-login")?.value.trim();
  const pass    = document.getElementById("sa-new-pass")?.value.trim();
  const plan    = document.getElementById("sa-new-plan")?.value || "trial";
  // 2026-07-26: tarif, narx va valyuta rejimi
  const tier     = document.getElementById("sa-new-tier")?.value || "pro";
  const priceUzs = parseInt(document.getElementById("sa-new-price")?.value) || 0;
  const curMode  = document.getElementById("sa-new-curmode")?.value || "uzs";
  const modSel  = document.getElementById("sa-new-modules");
  const modules = modSel ? Array.from(modSel.selectedOptions).map(o=>o.value) : ["pos","ombor","hisobot"];

  if (!name || !owner || !rawLogin || !pass) {
    showSaToast("Barcha maydonlarni to\'ldiring", "err"); return;
  }

  // Email/login takrorlanishini tekshiramiz
  let checkLogin = rawLogin;
  if (/^\d+$/.test(rawLogin.replace(/[\s+\-()]/g, ""))) {
    checkLogin = rawLogin.replace(/\D/g, "") + "@merx.uz";
  }
  const dupShop = _saShops.find(s => s.ownerEmail && s.ownerEmail.toLowerCase() === checkLogin.toLowerCase());
  if (dupShop) {
    showSaToast(`"${checkLogin}" login allaqachon "${dupShop.name}" do\'konida ishlatilgan!`, "err");
    return;
  }

  const phone    = document.getElementById("sa-new-phone")?.value.trim() || "";
  const shopType = document.getElementById("sa-new-shoptype")?.value || "ikki";

  // Login aniqlash — raqam bo'lsa @merx.uz qo'shamiz
  let loginEmail = rawLogin;
  if (/^\d+$/.test(rawLogin.replace(/[\s+\-()]/g, ""))) {
    loginEmail = rawLogin.replace(/\D/g, "") + "@merx.uz";
  }

  const now    = new Date();
  const expires= plan === "lifetime" ? null : addDaysToDate(now, plan === "yearly" ? 365 : 30);
  // Xavfsiz shop_id: eski "shop_"+Date.now() o'rniga kriptografik tasodifiy
  const shopId = "shop_" + Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => b.toString(16).padStart(2,"0")).join("");
  const dbKey  = "merx_v5_" + shopId;

  const newShop = {
    id: shopId, name, ownerName: owner,
    ownerEmail: loginEmail,
    phone: phone,
    ownerPass: pass, plan, modules, shopType, // ownerPass plain text (login uchun kerak)
    expiresAt: expires, createdAt: now.toISOString(),
    // 2026-07-26: yangi do'kon standart PRO (keyin SuperAdmin o'zgartiradi)
    tier, priceUzs, currencyMode: curMode,
    blocked: false, dbKey
  };

  _saShops.push(newShop);
  saSaveShops();

  // Supabase URL/Key asosiy do'kondan
  let _url = "", _key = "";
  try {
    const m = _saMainDB();
    _url = m?.settings?.supabaseUrl || "";
    _key = m?.settings?.supabaseKey || "";
  } catch(e) {}
  if (!_url && typeof MERX_SUPABASE_URL !== "undefined") _url = MERX_SUPABASE_URL;
  if (!_key && typeof MERX_SUPABASE_KEY !== "undefined") _key = MERX_SUPABASE_KEY;

  // Bo'sh DB yaratish
  // Asosiy do'kon bot sozlamalarini olamiz
  let _mainBotUrl = "", _mainBotUser = "";
  try {
    const _mdb = _saMainDB();
    _mainBotUrl  = _mdb?.settings?.telegramBotUrl || "";
    _mainBotUser = _mdb?.settings?.telegramBotUsername || "";
  } catch(e) {}

  const shopDB = {
    shop: { name, type: shopType },
    settings: {
      rate: 12800, priceCurrency: "uzs",
      shopType: shopType,
      cloudShopId: shopId,
      adminEmail: loginEmail, adminPass: await saSha256(pass), modules,
      supabaseUrl: _url, supabaseKey: _key,
      telegramBotUrl: _mainBotUrl,
      telegramBotUsername: _mainBotUser,
    },
    customers:[], products:[], sales:[], staff:[],
    ombor:[], xarajatlar:[], debtPayments:[], shifts:[],
    kassaBalances:{}, seq: 1
  };
  localStorage.setItem(dbKey, JSON.stringify(shopDB));

  // ── Supabase'ga yozish — FAQAT BITTA KANAL: create_shop API ──
  // (Avval bu yerda _saAddShopToSupabase ham chaqirilardi — ikkilangan
  //  yozuv edi, RLS baribir bloklardi. Olib tashlandi, 2026-07.)
  // create_shop: Auth hisob + shops + settings — barchasini service
  // kalit bilan yaratadi. Busiz RLS ishlamaydi.
  fetch("/api/auth-v2?action=create_shop", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sa-pass": (sessionStorage.getItem("merx_sa_pass") || localStorage.getItem("merx_sa_pass") || "") },
    body: JSON.stringify({
      email: loginEmail,
      password: pass,
      shopId: shopId,
      shopName: name,
      plan: plan,
      // 2026-07-26: tarif, narx va valyuta rejimi ham serverga
      tier: tier,
      priceUzs: priceUzs,
      currencyMode: curMode,
      shopType: shopType
    })
  })
  .then(r => r.json())
  .then(d => {
    if (d.ok) {
      console.log("✅ Supabase Auth hisobi yaratildi:", d.message);
    } else {
      console.warn("⚠️ Supabase Auth hisobi yaratilmadi:", d.error);
    }
  })
  .catch(e => console.warn("Supabase Auth xato:", e.message));
  // ── ────────────────────────────────────────────────────────────

  document.getElementById("sa-add-modal").style.display = "none";
  ["sa-new-name","sa-new-owner","sa-new-login","sa-new-phone","sa-new-pass"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  const stEl = document.getElementById("sa-new-shoptype");
  if (stEl) stEl.value = "ikki";
  const prev = document.getElementById("sa-login-preview");
  const pe   = document.getElementById("sa-preview-email");
  if (prev) prev.textContent = "";
  if (pe)   pe.textContent   = "—";

  renderSaShops();

  // Yangi do'kon ma'lumotlari va bot havolasini ko'rsatish
  setTimeout(() => {
    let botUsername="";
    try {
      const m=_saMainDB();
      botUsername=(m?.settings?.telegramBotUsername||"").replace(/^@/,"").trim();
      if (botUsername.includes("@")||botUsername.includes(".")) botUsername="";
    } catch(e){}
    const link=botUsername?`https://t.me/${botUsername}?start=${shopId}`:"";
    const d=document.createElement("div");
    d.style.cssText="position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif";
    d.innerHTML=`<div style="background:#fff;border-radius:16px;padding:28px;width:440px;max-width:95vw;box-shadow:0 24px 60px rgba(0,0,0,.3)">
      <div style="font-size:19px;font-weight:800;color:#0D1B2A;margin-bottom:16px">✅ Do'kon yaratildi</div>
      <div style="background:#F9FAFB;border-radius:10px;padding:14px;font-size:13px;line-height:2;margin-bottom:16px">
        <div><span style="color:#374151">Do'kon:</span> <strong>${name}</strong></div>
        <div><span style="color:#374151">Login:</span> <strong style="font-family:monospace">${loginEmail}</strong></div>
        <div><span style="color:#374151">Parol:</span> <strong style="font-family:monospace">${pass}</strong></div>
        <div><span style="color:#374151">Obuna:</span> <strong>${plan}</strong></div>
      </div>
      ${link?`<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:12px 14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:#065F46;margin-bottom:6px">🔗 Bot havolasi (mijozlarga yuboring)</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;font-family:monospace;font-size:11px;color:#065F46;word-break:break-all">${link}</div>
          <button onclick="navigator.clipboard?.writeText('${link}').then(()=>this.textContent='✓ Nusxa')"
            style="background:#059669;border:none;border-radius:6px;padding:6px 10px;color:#fff;cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0">📋 Nusxa</button>
        </div>
      </div>`:`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:#92400E">
        ⚠️ Bot havolasi: Sozlamalar → SMS & Bot → Bot username kiriting
      </div>`}
      <button onclick="this.closest('div[style*=fixed]').remove()"
        style="width:100%;background:#0D1B2A;border:none;border-radius:10px;padding:12px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;color:#E9A500">
        Tushunarli
      </button>
    </div>`;
    document.body.appendChild(d);
  // 2026-08-03: oyna ochilganda tarif narxini qo'yamiz
  // 2026-08-03: tariflar hali yuklanmagan bo'lsa — avval yuklaymiz
  try {
    if (!(_saTariffs || []).length) {
      saLoadFinance().then(() => { try { saNewTierPrice(); } catch(e) {} });
    } else setTimeout(saNewTierPrice, 30);
  } catch(e) {}
  }, 300);
}

// ── Supabase'dan do'konlarni yuklash ─────────────
// ── Panelni bulutdan yangilash (2026-08-06) ───────
// ⚠️ Yangi mantiq YO'Q — mavjud saFetchShopsFromCloud() chaqiriladi,
//    u ro'yxatni ham, jamlanmani ham o'zi qayta chizadi.
async function saRefreshPanel(btn) {
  const ico = btn ? btn.querySelector("i") : null;
  if (btn) { btn.disabled = true; btn.style.opacity = ".55"; }
  if (ico) ico.style.animation = "spin 1s linear infinite";
  try {
    await saFetchShopsFromCloud();
    showSaToast("Yangilandi");
  } catch (e) {
    showSaToast("Yangilab bo'lmadi: " + (e.message || "xato"), "err");
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ""; }
    if (ico) ico.style.animation = "";
  }
}

async function saFetchShopsFromCloud() {
  try {
    const res = await fetch("/api/auth-v2?action=get_shops", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sa-pass": (sessionStorage.getItem("merx_sa_pass") || localStorage.getItem("merx_sa_pass") || "") },
      body: JSON.stringify({})
    });
    const d = await res.json();
    if (!d.ok || !d.shops?.length) return;

  // Supabase'dagi do'konlarni localStorage bilan birlashtirамiz
  // (localStorage'da qo'shimcha ma'lumotlar bo'lishi mumkin: ownerPass, modules va h.k.)
  const merged = d.shops.map(cloudShop => {
    const local = _saShops.find(s => s.id === cloudShop.id) || {};
    return {
      ...local,
      id:          cloudShop.id,
      name:        cloudShop.name,
      ownerEmail:  cloudShop.owner_email || local.ownerEmail || "",
      plan:        cloudShop.plan        || local.plan || "trial",
      blocked:     cloudShop.blocked     || local.blocked || false,
      expiresAt:   cloudShop.trial_ends  || local.expiresAt || null,
      // 2026-07-26: valyuta rejimi BULUTDAN (settings jadvalidan) keladi
      currencyMode: cloudShop.currency_mode || local.currencyMode || "multi",
      tier:         cloudShop.tier      || local.tier || "pro",
      priceUzs:     cloudShop.price_uzs || local.priceUzs || 0,
      createdAt:   cloudShop.created_at  || local.createdAt || new Date().toISOString(),
      // ⚠️ 2026-08-03: BULUTDAGI QIYMAT USTUVOR.
      // Avval faqat `local.ownerName` o'qilardi — bulutga saqlangan
      // ism qaytib kelmasdi. Panel yopib-ochilganda lokal xotirada
      // turardi, F5 dan keyin esa yo'qolardi.
      ownerName:   cloudShop.owner_name  || local.ownerName || "",
      phone:       cloudShop.owner_phone || local.phone     || "",
      ownerPass:   local.ownerPass || "",
      modules:     local.modules || {},
    };
  });

  // localStorage'da bor, lekin Supabase'da yo'q do'konlarni ham qo'shamiz
  _saShops.forEach(local => {
    if (!merged.find(m => m.id === local.id)) merged.push(local);
  });

  _saShops = merged;
  // localStorage ga yozmaymiz — xotirada saqlaymiz xolos
  const saList = document.getElementById("sa-shops-list");
  if (saList) {
    renderSaShops();
    // Statistikani ham yangilaymiz
    const dashEl = document.getElementById("sa-dashboard");
    if (dashEl) {
      dashEl.innerHTML = buildSaDashboard();
      // ⚠️ 2026-08-03: DASHBOARD QAYTA CHIZILGACH RAQAMLAR TIKLANADI.
      // Server holati va moliya raqamlari `id` orqali to'ldiriladi.
      // Dashboard qayta chizilganda ular BO'SHAB qolardi — shuning
      // uchun birinchi ochilishda "—" turib, faqat oyna ochilgach
      // to'lardi.
      try { saRenderFinKpi(); } catch(e) {}
      try { saLoadServerStats(); } catch(e) {}
    }
  }
  console.log(`✅ Supabase'dan ${d.shops.length} ta do'kon yuklandi`);
  } catch(e) { console.warn("saFetchShopsFromCloud xato:", e.message); }
}

// ── Supabase ga yozish ────────────────────────────
// ESLATMA (2026-07): bu yerda _saAddShopToSupabase funksiyasi bor edi —
// olib tashlandi. Sabab: u create_shop API bilan parallel ravishda
// settings jadvaliga yozmoqchi bo'lardi (ikkilangan yozuv), lekin RLS
// uni baribir bloklardi. Yagona yozish kanali: /api/auth-v2?action=create_shop

// ── Do'konga kirish ───────────────────────────────
async function saOpenShop(id) {
  const s = _saShops.find(x => x.id === id); if (!s) return;
  const dbKey = "merx_v5_" + id;

  // ⚠️ 2026-08-06: KALIT IZLASH TARTIBI TUZATILDI.
  // Avval `merx_v5` bilan boshlanadigan HAR QANDAY bazadan birinchi
  // topilgan kalit olinardi — ya'ni B20 ga kirayotganda sinov
  // do'konining kaliti ishlatilishi mumkin edi. Hozir zarar yo'q
  // (uchala do'kon bitta Supabase loyihasida), lekin do'kon boshqa
  // loyihaga ko'chirilsa NOTO'G'RI BAZAGA ulanardi va buni sezish
  // qiyin bo'lardi. Endi tartib auth.js dagi ensureCloudKeys() bilan
  // bir xil: O'Z bazasi → server → (oxirgi chora) boshqa do'kon.
  let url = "", key2 = "";

  // 1) Kiriladigan do'konning O'Z bazasi
  try {
    const own = JSON.parse(localStorage.getItem(dbKey) || "{}");
    if (own?.settings?.supabaseUrl && own?.settings?.supabaseKey) {
      url = own.settings.supabaseUrl; key2 = own.settings.supabaseKey;
    }
  } catch(e) {}

  // 2) Server (auth.js dagi `ensureCloudKeys` bilan bir xil yo'l)
  if (!url || !key2) {
    try {
      const r = await fetch("/api/auth-v2?action=client_config", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
      });
      const cfg = await r.json();
      if (cfg.ok && cfg.url && cfg.key) { url = cfg.url; key2 = cfg.key; }
    } catch(e) { console.warn("client_config:", e.message); }
  }

  // 3) OXIRGI CHORA — boshqa do'kon bazasidan. Server ishlamay
  //    qolganda do'kon ochilmay qolmasin uchun saqlandi.
  if (!url || !key2) {
    try {
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith("merx_v5")) continue;
        const d = JSON.parse(localStorage.getItem(k) || "{}");
        if (d?.settings?.supabaseUrl && d?.settings?.supabaseKey) {
          url = d.settings.supabaseUrl; key2 = d.settings.supabaseKey;
          console.warn("⚠️ Bulut kaliti BOSHQA do'kon bazasidan olindi:", k);
          break;
        }
      }
    } catch(e) {}
  }
  if (!url || !key2) {
    showSaToast("Bulut kalitlari topilmadi — do'kon ochilmadi", "err");
    return;
  }

  if (!localStorage.getItem(dbKey)) {
    // Yangi do'kon — bo'sh DB yaratamiz
    const shopDB = {
      shop: { name: s.name, type: s.shop_type || s.shopType || "ikki" },
      settings: {
        // 2026-08-03: kurs QOTIRILMAYDI — do'kon bulutdan tortadi.
        // Avval 12800 yozilardi va yangi do'kon noto'g'ri kurs
        // bilan boshlanardi.
        // 2026-07-26: valyuta rejimi SuperAdmin belgilaydi
        currencyMode: s.currency_mode || s.currencyMode || "multi",
        priceCurrency: (s.currency_mode || s.currencyMode) === "usd" ? "usd" : "uzs",
        tier: s.tier || "pro",
        shopType: s.shop_type || s.shopType || "ikki",
        cloudShopId: id,
        adminEmail: s.ownerEmail || (s.phone ? s.phone.replace(/\D/g,"")+"@merx.uz" : id+"@merx.uz"),
        adminPass: await saSha256(s.ownerPass || "merx123"),
        supabaseUrl: url, supabaseKey: key2
      },
      customers:[],products:[],sales:[],staff:[],
      ombor:[],xarajatlar:[],debtPayments:[],shifts:[],
      kassaBalances:{}, seq:1
    };
    localStorage.setItem(dbKey, JSON.stringify(shopDB));
  } else {
    // Mavjud do'kon — faqat texnik sozlamalarni yangilaymiz
    try {
      const existing = JSON.parse(localStorage.getItem(dbKey));
      if (!existing.settings) existing.settings = {};
      existing.settings.cloudShopId = id;
      // ⚠️ 2026-08-06: DO'KON NOMI DARHOL TO'G'RI BO'LSIN.
      // Avval kirilganda sarlavhada "MERX Do'koni" turardi —
      // lokal nusxadagi standart nom. To'g'ri nom faqat qo'lda
      // "Yangilash" bosilgandan keyin chiqardi. Nomni SuperAdmin
      // ro'yxatidan bilamiz, shuning uchun shu yerda yozamiz.
      // ⚠️ Bulutga TA'SIR QILMAYDI: push'da standart nomlar
      // ("MERX", "MERX Do'koni") baribir yuborilmaydi (cloud.js §5.3).
      if (s.name) existing.shop = { ...(existing.shop || {}), name: s.name };
      // ⚠️ Bo'sh qiymat mavjudini BOSMAYDI (kontekst §10.7)
      if (url)  existing.settings.supabaseUrl = url;
      if (key2) existing.settings.supabaseKey = key2;
      // adminEmail/adminPass — do'kon egasidan olamiz, asosiy do'kondan emas
      if (!existing.settings.adminEmail)
        existing.settings.adminEmail = s.ownerEmail || (s.phone ? s.phone.replace(/\D/g,"")+"@merx.uz" : id+"@merx.uz");
      if (!existing.settings.adminPass)
        existing.settings.adminPass = await saSha256(s.ownerPass || "merx123");
      // Bot sozlamalari — faqat yangi do'konda yo'q bo'lsa
      try {
        const mainDB = _saMainDB();
        if (!existing.settings.telegramBotUrl && mainDB?.settings?.telegramBotUrl)
          existing.settings.telegramBotUrl = mainDB.settings.telegramBotUrl;
        if (!existing.settings.telegramBotUsername && mainDB?.settings?.telegramBotUsername)
          existing.settings.telegramBotUsername = mainDB.settings.telegramBotUsername;
      } catch(e) {}
      localStorage.setItem(dbKey, JSON.stringify(existing));
    } catch(e) {}
  }

  const user = {
    id: "admin_" + id,
    email: s.ownerEmail || (s.phone.replace(/\D/g,"")+"@merx.uz"),
    shopId: id, dbKey, shopName: s.name,
    role: "admin", saAccess: true
  };
  localStorage.setItem("merx_auth_v1", JSON.stringify(user));
  // ⚠️ 2026-08-03: PANEL QAYTA OCHILMASIN.
  // `saRestorePanelIfLoggedIn()` sahifa yuklangach 400ms da
  // panelni O'ZI ochadi (SA sessiyasi ochiq bo'lgani uchun).
  // Natijada do'konga kirilardi-yu, panel darhol ustiga qaytardi.
  // Bu belgi bir martalik — panel ochilmaydi, keyin o'chiriladi.
  // ⚠️ 2026-08-05: DO'KON ALMASHTIRISHDAN OLDIN SINXRON.
  // `saOpenShop` sahifani qayta yuklaydi. Kutilayotgan yozuv
  // (sotuv, tahrir) bulutga yetmagan bo'lsa YO'QOLADI —
  // chiqishdagi bilan bir xil xato.
  await _saFlushSync();

  try {
    sessionStorage.setItem("merx_sa_entering", "1");
    // ⚠️ 2026-08-03: QAYTISH LENTASI UCHUN BELGI.
    // `renderSaViewBanner()` shu belgiga qaraydi, lekin u
    // HECH QAYERDA qo'yilmasdi — faqat o'chirilardi. Natijada
    // do'konga kirilgach SuperAdminga qaytish yo'li ko'rinmasdi.
    sessionStorage.setItem("merx_is_sa_view", "1");
  } catch(e) {}
  hideSaPanel();
  showSaToast(`"${s.name}" ga kirilmoqda...`);
  setTimeout(() => location.reload(), 600);
}

// ── Tahrirlash ────────────────────────────────────
// ── Tahrirlash (to'liq modal) ────────────────────────
function saEditShopFull(id) {
  const s = _saShops.find(x => x.id === id); if (!s) return;
  document.getElementById("sa-edit-modal")?.remove();

  const modal = document.createElement("div");
  modal.id = "sa-edit-modal";
  modal.style.cssText = "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;backdrop-filter:blur(2px)";

  const iStyle = "background:#F9FAFB;border:1.5px solid #E5E7EB;color:#111;border-radius:8px;padding:9px 12px;font-family:inherit;font-size:13px;outline:none;width:100%;box-sizing:border-box";

  const shopTypeOpts = [
    {val:"ikki",    lbl:"🧩 Oyoq kiyim + Kiyim"},
    {val:"oyoq",    lbl:"👟 Faqat Oyoq kiyim"},
    {val:"kiyim",   lbl:"👕 Faqat Kiyim-kechak"},
    {val:"aralash", lbl:"🔀 Aralash (boshqa)"},
  ].map(o => `<option value="${o.val}" ${(s.shopType||"ikki")===o.val?"selected":""}>${o.lbl}</option>`).join("");

  const planOpts = [
    {val:"trial",    lbl:"🧪 Sinov (30 kun)"},
    {val:"monthly",  lbl:"📅 Oylik"},
    {val:"yearly",   lbl:"📆 Yillik"},
    {val:"lifetime", lbl:"♾️ Umrlik"},
  ].map(o => `<option value="${o.val}" ${s.plan===o.val?"selected":""}>${o.lbl}</option>`).join("");

  const expVal = s.plan === "lifetime" ? "" : (s.expiresAt ? s.expiresAt.slice(0,10) : "");

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;width:500px;
      max-width:95vw;box-shadow:0 24px 60px rgba(0,0,0,.2)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:19px;font-weight:800;color:#0D1B2A">✏️ Do'konni tahrirlash</div>
        <button onclick="document.getElementById('sa-edit-modal').remove()"
          style="background:#F3F4F6;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;color:#374151;font-size:16px">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div style="grid-column:1/-1">
          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Do'kon nomi *</label>
          <input id="se-name" value="${s.name||""}" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Egasi ismi</label>
          <input id="se-owner" value="${s.ownerName||""}" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Telefon raqam</label>
          <input id="se-phone" value="${s.phone||""}" placeholder="+998 90 123 45 67" autocomplete="off" name="nopick-se-phone" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Login (email)</label>
          <input id="se-login" value="${s.ownerEmail||""}" autocomplete="off" name="nopick-se-login" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Yangi parol (bo'sh = o'zgarmaydi)</label>
          <input id="se-pass" type="password" placeholder="••••••••" autocomplete="new-password" name="sa-nopick-3" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Do'kon turi</label>
          <select id="se-shoptype" style="${iStyle}">${shopTypeOpts}</select>
        </div>
                <div>
          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">
            Obuna tarifi
          </label>
          <select id="se-tier" style="${iStyle}">
            <option value="start"${(s.tier||"pro")==="start"?" selected":""}>Start (bot yopiq)</option>
            <option value="pro"${(s.tier||"pro")==="pro"?" selected":""}>Pro (hammasi ochiq)</option>
          </select>
          <div style="font-size:12px;color:#334155;margin-top:4px;line-height:1.4">
            Start: bot, portal, Telegram chek va eslatmalar YOPIQ
          </div>
        </div>
        <div>
          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">
            Obuna narxi (so'm/oy)
          </label>
          <input id="se-price" type="number" min="0" step="10000"
            value="${s.priceUzs || ""}" placeholder="Masalan: 349000" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">
            Valyuta rejimi
          </label>
          <select id="se-curmode" style="${iStyle}">
            <option value="uzs"${(s.currencyMode||"multi")==="uzs"?" selected":""}>So'm (faqat so'm)</option>
            <option value="usd"${(s.currencyMode||"multi")==="usd"?" selected":""}>Dollar (faqat $)</option>
            <option value="multi"${(s.currencyMode||"multi")==="multi"?" selected":""}>Ko'p valyutali (do'kon tanlaydi)</option>
          </select>
          <div style="font-size:12px;color:#334155;margin-top:4px;line-height:1.4">
            So'm yoki Dollar tanlansa — do'kon egasi valyutani o'zgartira olmaydi
          </div>
        </div>
<div>
          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Obuna turi</label>
          <select id="se-plan" style="${iStyle}" onchange="var d=document.getElementById('se-expires');if(this.value==='lifetime'){d.value='';d.disabled=true;}else{d.disabled=false;}">${planOpts}</select>
        </div>
        <div>
          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Muddat tugashi</label>
          <input id="se-expires" type="date" value="${expVal}" ${s.plan==="lifetime"?"disabled":""} style="${iStyle}">
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="saEditSave('${id}')"
          style="flex:1;background:#0D1B2A;border:none;border-radius:10px;
          padding:13px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;color:#E9A500">
          ✓ Saqlash
        </button>
        <button onclick="document.getElementById('sa-edit-modal').remove()"
          style="background:#F3F4F6;border:none;border-radius:10px;padding:13px 20px;
          font-family:inherit;font-size:13px;cursor:pointer;color:#374151;font-weight:600">
          Bekor
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function saEditSave(id) {
  const s = _saShops.find(x => x.id === id); if (!s) return;
  const name     = document.getElementById("se-name")?.value.trim();
  const owner    = document.getElementById("se-owner")?.value.trim();
  const phone    = document.getElementById("se-phone")?.value.trim();
  const login    = document.getElementById("se-login")?.value.trim();
  const pass     = document.getElementById("se-pass")?.value.trim();
  const shopType = document.getElementById("se-shoptype")?.value || "ikki";
  const plan     = document.getElementById("se-plan")?.value || s.plan;
  // 2026-07-26: valyuta rejimi — do'kon egasi o'zgartira olmaydi
  const curMode  = document.getElementById("se-curmode")?.value || s.currencyMode || "multi";
  // 2026-07-26: obuna tarifi va narxi
  const tier     = document.getElementById("se-tier")?.value || s.tier || "pro";
  const priceUzs = parseInt(document.getElementById("se-price")?.value) || 0;
  const expires  = document.getElementById("se-expires")?.value;

  if (!name) { showSaToast("Do'kon nomini kiriting", "err"); return; }

  s.name      = name;
  s.ownerName = owner || s.ownerName;
  s.phone     = phone;
  s.shopType     = shopType;
  s.currencyMode = curMode;
  s.tier         = tier;
  s.priceUzs     = priceUzs;
  s.plan      = plan;
  if (login)                  s.ownerEmail = login;
  if (pass && pass.length>=4) s.ownerPass  = pass;
  // 2026-07-26: tarif o'zgarganda muddat ham to'g'ri belgilanadi
  if (plan === "lifetime") {
    s.expiresAt = null;
    s.blocked   = false;          // umrbod tarif — bloklanmagan
  } else if (expires) {
    s.expiresAt = new Date(expires).toISOString();
  } else if (!s.expiresAt || new Date(s.expiresAt) <= new Date()) {
    // Muddat kiritilmagan va eskisi tugagan — 30 kun beramiz
    s.expiresAt = addDaysToDate(new Date(), 30);
  }

  // ═══ 2026-07-26: BULUTGA YOZISH (shops jadvali) ═══
  // Avval faqat xotira va lokal baza yangilanardi — shuning uchun
  // tarif/muddat/nom o'zgarishi bulutga yetmasdi va sahifa yangilangach
  // eski holat qaytardi ("muddati tugagan" muammosi).
  // Server SERVICE_KEY bilan yozadi (brauzerdan RLS to'sadi).
  try {
    const _cloudId = s.cloudShopId || s.shop_id || id;
    const _payload = {
      name: name,
      owner_email: login || s.ownerEmail || null,
      // ⚠️ 2026-08-03: EGASI ISMI VA TELEFONI QO'SHILDI.
      // Avval ular faqat brauzer xotirasiga (`s.ownerName`, `s.phone`)
      // yozilardi va bulutga UMUMAN ketmasdi: boshqa qurilmada ochsangiz
      // bo'sh chiqardi, do'kon ilovasiga ham yetib bormasdi.
      // (POS'da "Akmal (admin)" ko'rinishi uchun shu kerak edi.)
      // Bo'sh qiymat yuborilmaydi — mavjudini o'chirmasin.
      ...(owner ? { owner_name:  owner } : {}),
      ...(phone ? { owner_phone: phone } : {}),
      plan: plan,
      shop_type: shopType,
      tier:      tier,
      price_uzs: priceUzs || null,
      trial_ends: (plan === "lifetime") ? null
                  : (s.expiresAt ? s.expiresAt.slice(0,10) : null),
      // 2026-07-30: bloklash `active` ga tegmaydi (yuqoridagi izohga qarang)
      active: true,
      blocked: !!s.blocked
    };
    _saApi("update_shop", { shopId: _cloudId, data: _payload })
      .then(d => {
        console.log(d.ok
          ? `☁️ "${name}" bulutda yangilandi (tarif: ${plan})`
          : "❌ Bulutga yozilmadi: " + (d.error || ""));
        // 2026-08-03: login o'zgarganda Auth hisobi bilan bog'liq
        // ogohlantirish bo'lsa — OCHIQ ko'rsatamiz. Busiz egasi
        // yangi login bilan kira olmay qolgani bilinmasdi.
        if (d.ok && d.authWarn) showSaToast("⚠️ " + d.authWarn, "err");
        // Bulutdan qayta o'qib ro'yxatni yangilaymiz — haqiqiy holat ko'rinsin
        if (d.ok && typeof saFetchShopsFromCloud === "function")
          setTimeout(() => saFetchShopsFromCloud().catch(()=>{}), 600);
      })
      .catch(e => console.warn("update_shop xato:", e.message));
  } catch(e) { console.warn("Bulutga yozish:", e.message); }

  // LocalStorage DB ni ham yangilaymiz
  try {
    const dbKey = "merx_v5_" + id;
    const raw   = localStorage.getItem(dbKey);
    if (raw) {
      const shopDB = JSON.parse(raw);
      if (!shopDB.shop)     shopDB.shop     = {};
      if (!shopDB.settings) shopDB.settings = {};
      shopDB.shop.name        = name;
      shopDB.shop.type        = shopType;
      shopDB.settings.shopType     = shopType;
      // 2026-07-26: valyuta rejimi ham do'kon sozlamalariga yoziladi
      shopDB.settings.currencyMode = curMode;
      if (curMode === "uzs" || curMode === "usd") {
        shopDB.settings.priceCurrency = curMode;   // qat'iy rejim — majburlaymiz
      }
      if (login)                  shopDB.settings.adminEmail = login;
      if (pass && pass.length>=4) shopDB.settings.adminPass  = pass;
      localStorage.setItem(dbKey, JSON.stringify(shopDB));
    }
  } catch(e) {}

  // 2026-07-26: valyuta rejimini BULUTGA ham yozamiz — do'kon boshqa
  // qurilmadan kirsa ham shu rejimda ochilsin
  try {
    const _cloudId = s.cloudShopId || s.shop_id || id;
    _saApi("set_currency_mode", { shopId: _cloudId, mode: curMode })
      .then(d => console.log(d.ok
        ? `💱 ${_cloudId}: valyuta rejimi "${curMode}" saqlandi`
        : "❌ Valyuta rejimi: " + (d.error || "")))
      .catch(e => console.warn("Valyuta rejimi xato:", e.message));
  } catch(e) { console.warn("Valyuta rejimi bulutga:", e.message); }

  saSaveShops();
  renderSaShops();
  document.getElementById("sa-edit-modal")?.remove();
  showSaToast(`✅ "${name}" yangilandi`);

  // 2026-07-26: bu yerda yozish OLIB TASHLANDI — yuqorida _saApi
  // ("update_shop") orqali SERVER tomonida bajariladi. Brauzerdan
  // yozish RLS tufayli jimgina muvaffaqiyatsiz bo'lardi.

  // Parol o'zgargan bo'lsa — Supabase Auth va localStorage da ham yangilaymiz
  if (pass && pass.length >= 4) {
    // localStorage'da hash bilan saqlaymiz
    (async () => {
      try {
        const dbKey = "merx_v5_" + id;
        const raw = localStorage.getItem(dbKey);
        if (raw) {
          const shopDB = JSON.parse(raw);
          if (!shopDB.settings) shopDB.settings = {};
          shopDB.settings.adminPass = await saSha256(pass);
          localStorage.setItem(dbKey, JSON.stringify(shopDB));
        }
      } catch(e) {}
    })();

    // Supabase Auth'da ham yangilaymiz
    fetch("/api/auth-v2?action=update_shop_password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sa-pass": (sessionStorage.getItem("merx_sa_pass") || localStorage.getItem("merx_sa_pass") || "") },
      body: JSON.stringify({ email: s.ownerEmail, newPassword: pass })
    })
    .then(r => r.json())
    .then(d => {
      if (d.ok) console.log("✅ Supabase Auth parol yangilandi");
      else console.warn("⚠️ Supabase Auth parol yangilanmadi:", d.error);
    })
    .catch(e => console.warn("Supabase Auth parol xato:", e.message));
  }
}

async function _saUpdateShopInSupabase(shopId, data) {
  // 2026-07-26: ZAXIRA — endi SERVER orqali yo'naltiriladi
  try { return await _saApi("update_shop", { shopId, data }); } catch(e) {}
  // shops jadvali RLS bilan himoyalangan — service_role endpoint orqali yangilaymiz
  try {
    const sbUrl = (typeof MERX_SUPABASE_URL !== "undefined" && MERX_SUPABASE_URL)
      ? MERX_SUPABASE_URL : (db?.settings?.supabaseUrl || "");
    if (!sbUrl) return;

    const res = await fetch("/api/auth-v2?action=update_shop", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sa-pass": (sessionStorage.getItem("merx_sa_pass") || localStorage.getItem("merx_sa_pass") || "") },
      body: JSON.stringify({ shopId, data })
    });
    const d = await res.json();
    if (!d.ok) console.warn("shops yangilash xato:", d.error);
  } catch(e) {
    console.warn("_saUpdateShopInSupabase xato:", e.message);
  }
}

// ── Eski saEditShop → saEditShopFull ──────────────
function saEditShop(id) { saEditShopFull(id); }

// ── Bloklash / faollashtirish ─────────────────────
function saToggleShop(id) {
  const s = _saShops.find(x => x.id === id); if (!s) return;

  // ⚠️ 2026-07-26 TUZATISH: avval faqat `blocked` teskari qilinardi.
  // MUDDATI TUGAGAN (lekin bloklanmagan) do'konda tugma "Faollashtirish"
  // deb turardi, bosilganda esa do'konni BLOKLAB qo'yardi — teskari ish.
  // Endi HOLATGA qarab ishlaydi: faol bo'lsa → bloklash, faol bo'lmasa
  // (bloklangan YOKI muddati tugagan) → to'liq faollashtirish.
  const wasActive = saIsActive(s);

  if (wasActive) {
    s.blocked = true;                       // faol edi → bloklaymiz
  } else {
    s.blocked = false;                      // faol emas → ochamiz
    // Muddati tugagan yoki yo'q bo'lsa — 30 kun beramiz
    if (s.plan !== "lifetime") {
      const exp = s.expiresAt ? new Date(s.expiresAt) : null;
      if (!exp || exp <= new Date()) s.expiresAt = addDaysToDate(new Date(), 30);
    }
  }

  saSaveShops(); renderSaShops();
  // 2026-07-30: AVVAL bu yerda darhol "bloklandi" deb yozilardi —
  // server javobi kutilmasdi. Bulutga yozish muvaffaqiyatsiz bo'lsa
  // (xato faqat konsolga chiqardi) panel "bloklandi" ko'rsatardi,
  // do'kon esa bulutda FAOL qolardi va egasi bemalol ishlardi.
  // Endi haqiqiy natija kutiladi va xato bo'lsa holat QAYTARILADI.
  showSaToast(s.blocked ? "Bloklanmoqda..." : "Faollashtirilmoqda...");
  const _wantBlocked = !!s.blocked;
  // 2026-07-26: SERVER orqali (brauzerdan RLS to'sardi)
  const _cid = s.cloudShopId || s.shop_id || s.id;
  _saApi("update_shop", { shopId: _cid, data: {
    // 2026-07-30: `active` ENDI TEGILMAYDI. Avval bloklashda
    // active=false yozilardi, `get_shops` esa active=not.is.false
    // bilan filtrlaydi — bloklangan do'kon ro'yxatdan YO'QOLARDI va
    // yangi qurilmadan uni ochib bo'lmasdi. Endi active faqat
    // "o'chirilgan" ma'nosini bildiradi (delete_shop yozadi).
    active:  true,
    blocked: !!s.blocked,
    trial_ends: (s.plan === "lifetime") ? null : (s.expiresAt || null)
  }})
    .then(d => {
      if (d && d.ok) {
        console.log(`☁️ "${s.name}" ${_wantBlocked ? "bloklandi" : "faollashtirildi"} (bulutda)`);
        showSaToast(_wantBlocked
          ? `🔒 "${s.name}" bloklandi (bulutda tasdiqlandi)`
          : `✅ "${s.name}" faollashtirildi${s.expiresAt ? " (" + String(s.expiresAt).slice(0,10) + " gacha)" : ""}`);
        if (typeof saFetchShopsFromCloud === "function")
          setTimeout(() => saFetchShopsFromCloud().catch(()=>{}), 600);
      } else {
        // BULUTGA YETMADI — lokal holatni qaytaramiz, aks holda panel
        // yolg'on ko'rsatadi
        s.blocked = !_wantBlocked;
        saSaveShops(); renderSaShops();
        showSaToast("❌ Bulutga yozilmadi: " + ((d && d.error) || "noma'lum xato") +
                    " — holat o'zgarmadi", "err");
        console.error("update_shop rad etdi:", d);
      }
    })
    .catch(e => {
      s.blocked = !_wantBlocked;
      saSaveShops(); renderSaShops();
      showSaToast("❌ Tarmoq xatosi: " + e.message + " — holat o'zgarmadi", "err");
      console.error("toggle xato:", e);
    });
}

// ── O'chirish ─────────────────────────────────────
function saDeleteShop(id) {
  const s = _saShops.find(x => x.id === id); if (!s) return;
  if (!confirm(`"${s.name}" o'chirilsinmi?\nBu amalni bekor qilib bo'lmaydi!`)) return;
  localStorage.removeItem("merx_v5_" + id);
  _saShops = _saShops.filter(x => x.id !== id);
  saSaveShops(); renderSaShops();
  showSaToast(`"${s.name}" o'chirildi`);
  // Supabase dan ham o'chiramiz
  // 2026-07-26: SERVER orqali (SERVICE_KEY) — brauzerdan RLS to'sardi
  _saApi("delete_shop", { shopId: id })
    .then(d => console.log(d.ok ? `🗑 "${s.name}" bulutdan o'chirildi` : "❌ " + (d.error||"")))
    .catch(e => console.warn("Do'kon o'chirish xato:", e.message));
}

async function _saDeleteShopFromSupabase(shopId) {
  if (!_sb && typeof initSupabase === "function") await initSupabase();
  if (!_sb) return;
  // 2026-07-26: SERVER orqali (brauzerdan RLS to'sardi)
  try { return await _saApi("delete_shop", { shopId }); } catch(e) {}
}

// ── Statistika modal ──────────────────────────────
function saGetShopStats(shop) {
  try {
    const raw = localStorage.getItem(shop.dbKey); if (!raw) return null;
    const sdb = JSON.parse(raw);
    const sales=sdb.sales||[], custs=sdb.customers||[], prods=sdb.products||[];
    const rate = sdb.settings?.rate || 12800;
    const totalRev  = sales.reduce((a,s)=>a+(s.paid||0),0);
    const totalDebt = sales.filter(s=>s.remaining>0).reduce((a,s)=>a+(s.remaining||0),0);
    const totalStock= prods.reduce((a,p)=>a+p.variants.reduce((b,v)=>b+(v.qty||0),0),0);
    let costTotal = 0;
    sales.forEach(s=>{ s.items?.forEach(i=>{ const p=prods.find(x=>x.name===i.name); if(p) costTotal+=Math.round((p.costUsd||0)*rate)*(i.qty||0); }); });
    // ⚠️ 2026-08-06: sana QURILMA vaqtidan — utils.js dagi today()
    // orqali (kontekst §4.6, yagona manba). Avval toISOString() ishlatilardi,
    // u UTC qaytaradi va Toshkentda 00:00-05:00 oraligida "bugungi sotuv"
    // kechagi kunga tushib ketardi.
    // ⚠️ O'zgaruvchi nomi `bugun` — avvalgi `today` global today() ni
    // to'sib qo'yardi va uni chaqirib bo'lmasdi (§13.8).
    const bugun = typeof today === "function"
      ? today()
      : new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
    const m = bugun.slice(0,7);
    const monthSales = sales.filter(s=>s.date?.startsWith(m));
    const todaySales = sales.filter(s=>s.date===bugun);
    // Oxirgi sotuv sanasi
    const lastSale = sales.length ? sales[sales.length-1].date : null;
    // Faollik: so'nggi 7 kunda sotuv bo'ldimi?
    const week = new Date(); week.setDate(week.getDate()-7);
    const weekStr = week.toISOString().slice(0,10);
    const isActive7 = sales.some(s=>s.date>=weekStr);
    const isActive30 = sales.some(s=>s.date>=(()=>{const d=new Date();d.setDate(d.getDate()-30);return d.toISOString().slice(0,10);})());
    return { salesCnt:sales.length, monthCnt:monthSales.length, todayCnt:todaySales.length,
      totalRev, monthRev:monthSales.reduce((a,s)=>a+(s.paid||0),0),
      todayRev:todaySales.reduce((a,s)=>a+(s.paid||0),0),
      totalDebt, profit:totalRev-costTotal,
      custCnt:custs.length, prodCnt:prods.length, stockCnt:totalStock,
      lastSale, isActive7, isActive30 };
  } catch(e) { return null; }
}

function saShowStats(shopId) {
  const shop = _saShops.find(s=>s.id===shopId); if (!shop) return;
  // ⚠️ 2026-08-03: STATISTIKA BULUTDAN.
  // Avval `localStorage` dan o'qirdi va SuperAdmin kirmagan do'kon
  // uchun raqamlar BO'SH chiqardi. Endi server hisoblab beradi.
  // Lokal nusxa zaxira sifatida qoladi (tezroq ko'rinadi).
  let stats = saGetShopStats(shop) || {};
  document.getElementById("sa-stats-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "sa-stats-modal";
  modal.style.cssText = `position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;
    backdrop-filter:blur(4px)`;
  // ⚠️ 2026-08-06: MAHALLIY `fmt` OLIB TASHLANDI. U global fmt() ni
  // butun funksiya bo'ylab TO'SIB QO'YARDI — shu sababli "18225.4M so'm"
  // chiqardi va oldingi tuzatish ham ishlamasdi (u ham shu mahalliy
  // nusxani chaqirardi). Endi utils.js dagi yagona fmt() ishlatiladi.
  const planL = {trial:"Sinov",monthly:"Oylik",yearly:"Yillik",lifetime:"Umrlik"};
  const login = shop.ownerEmail || (shop.phone ? shop.phone.replace(/\D/g,"")+"@merx.uz" : "—");
  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:580px;max-width:95vw;
      overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.25)">
      <div style="padding:20px 24px;background:#0D1B2A;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:17px;font-weight:800;color:#E9A500">${shop.name}</div>
          <div style="font-size:12px;color:#6B8096;margin-top:2px">
            ${shop.ownerName||"—"} · ${shop.phone||""} · ${login}
          </div>
        </div>
        <button onclick="document.getElementById('sa-stats-modal').remove()"
          style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
          color:#fff;border-radius:8px;padding:6px 12px;font-family:inherit;cursor:pointer;font-size:16px">✕</button>
      </div>
      ${false ? "" : `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#E5E7EB">
        ${[
          // 2026-08-03: har kartaga `id` — bulutdan kelgan raqam
          // shu yerga yoziladi. "Taxminiy foyda" OLIB TASHLANDI:
          // u tannarxdan hisoblanadi, tannarx esa `data` ichida —
          // serverda hisoblash og'ir va noaniq bo'lardi.
          {id:"sst-rev",   lbl:"Jami sotuv",   val:fmt(stats.totalRev||0)+" so'm", clr:"#059669"},
          {id:"sst-month", lbl:"Bu oy tushum", val:fmt(stats.monthRev||0)+" so'm", clr:"#2563EB"},
          {id:"sst-debt",  lbl:"Qarz jami",    val:fmt(stats.totalDebt||0)+" so'm", clr:"#DC2626"},
          {id:"sst-sales", lbl:"Sotuvlar",     val:(stats.salesCnt||0)+" ta",  clr:"#374151"},
          {id:"sst-cust",  lbl:"Mijozlar",     val:(stats.custCnt||0)+" ta",   clr:"#374151"},
          {id:"sst-mcnt",  lbl:"Bu oy sotuv",  val:(stats.monthCnt||0)+" ta",  clr:"#2563EB"},
          {id:"sst-prod",  lbl:"Mahsulotlar",  val:(stats.prodCnt||0)+" xil",  clr:"#374151"},
          {id:"sst-stock", lbl:"Qoldiq",       val:(stats.stockCnt||0)+" dona",clr:"#374151"},
        ].map(k=>`<div style="background:#fff;padding:14px 18px">
          <div style="font-size:12.5px;color:#334155;font-weight:600;margin-bottom:4px;text-transform:uppercase">${k.lbl}</div>
          <div id="${k.id}" style="font-size:15px;font-weight:800;color:${k.clr}">${k.val}</div>
        </div>`).join("")}
      </div>
      <div style="padding:14px 20px;background:#F9FAFB;display:flex;gap:8px;flex-wrap:wrap">
        ${[
          {lbl:"Obuna",   val:planL[shop.plan]||shop.plan},
          {lbl:"Muddat",  val:shop.plan==="lifetime"?"♾️":(shop.expiresAt?.slice(0,10)||"—")},
          {lbl:"Holat",   val:saIsActive(shop)?"✅ Faol":"❌ Nofaol"},
          {lbl:"Qo'shildi",val:shop.createdAt?.slice(0,10)||"—"},
        ].map(k=>`<div style="background:#fff;border:1px solid #E5E7EB;border-radius:8px;padding:8px 14px">
          <div style="font-size:10px;color:#334155;font-weight:600;text-transform:uppercase;margin-bottom:3px">${k.lbl}</div>
          <div style="font-size:13px;font-weight:700;color:#111827">${k.val}</div>
        </div>`).join("")}
      </div>
      <div style="padding:14px 20px;border-top:1px solid #E5E7EB;display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="saOpenShop('${shop.id}');document.getElementById('sa-stats-modal').remove()"
          style="background:#0D1B2A;border:none;color:#E9A500;border-radius:8px;padding:9px 16px;
          font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
          🔑 Kirish</button>
        <!-- 2026-08-03: takror "Bot havolasi" olib tashlandi —
             yonidagi tugma xuddi shu ishni to'g'ri bajaradi. -->
        <button onclick="saCopyOwnerLink('${shop.id}')"
          style="background:#FEF3C7;border:1px solid #FDE68A;color:#B45309;
          border-radius:8px;padding:9px 16px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">
          👑 Ega havolasi</button>
        <button onclick="saToggleShop('${shop.id}');document.getElementById('sa-stats-modal').remove()"
          style="background:${saIsActive(shop)?"#FEF2F2":"#ECFDF5"};
          border:1px solid ${saIsActive(shop)?"#FECACA":"#BBF7D0"};
          color:${saIsActive(shop)?"#DC2626":"#059669"};
          border-radius:8px;padding:9px 16px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">
          ${saIsActive(shop)?"🔒 Bloklash":"✅ Faollashtirish"}</button>
        <button onclick="saExtendShop('${shop.id}');document.getElementById('sa-stats-modal').remove()"
          style="margin-left:auto;background:#EFF6FF;border:1px solid #BFDBFE;color:#2563EB;
          border-radius:8px;padding:9px 16px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">
          ➕ Uzaytirish</button>
      </div>`}
    </div>`;
  document.body.appendChild(modal);

  // 2026-08-03: bulutdagi haqiqiy raqamlarni tortamiz
  (async () => {
    try {
      const key = shop.cloudShopId || shop.shop_id || shop.id;
      const d = await _saApi("sa_finance", { op: "shop_stats", shopId: key });
      if (!d || !d.ok || !d.stats) return;
      const st = d.stats;
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      // 2026-08-06: QISQARTIRISH OLIB TASHLANDI (18225.4M → 18 225 400 000).
      // Yagona manba: utils.js dagi fmt() — bo'sh joy bilan ajratadi.
      set("sst-rev",   fmt(st.totalRev || 0) + " so'm");
      set("sst-month", fmt(st.monthRev || 0) + " so'm");
      // Qarz — ikki valyuta ALOHIDA (server 2026-08-06 dan beri ajratib beradi)
      const _dUzs = st.debtUzs != null ? st.debtUzs : (st.totalDebt || 0);
      const _dUsd = st.debtUsd || 0;
      const _dEl  = document.getElementById("sst-debt");
      if (_dEl) {
        _dEl.innerHTML = (_dUzs > 0 || _dUsd <= 0)
          ? fmt(_dUzs) + " so'm" +
            (_dUsd > 0 ? `<div style="font-size:13px;color:#1B4F72;margin-top:2px">$${_dUsd.toFixed(2)}</div>` : "")
          : `<span style="color:#1B4F72">$${_dUsd.toFixed(2)}</span>`;
      }
      set("sst-sales", (st.salesCnt || 0).toLocaleString("ru-RU"));
      set("sst-cust",  (st.custCnt  || 0).toLocaleString("ru-RU"));
      set("sst-prod",  (st.prodCnt  || 0).toLocaleString("ru-RU"));
      set("sst-stock", (st.stockCnt || 0).toLocaleString("ru-RU"));
      set("sst-mcnt",  (st.monthCnt || 0) + " ta");
      // ⚠️ Server 20 000 yozuvdan oshsa kesadi — buni JIMGINA o'tkazmaymiz
      if (st.capped) {
        const _c = document.getElementById("sst-rev");
        if (_c && !document.getElementById("sst-capped")) {
          const w = document.createElement("div");
          w.id = "sst-capped";
          w.style.cssText = "font-size:10.5px;color:#B45309;font-weight:600;margin-top:3px";
          w.textContent = "⚠️ 20 000 yozuv chegarasi — raqamlar to'liq emas";
          _c.parentElement.appendChild(w);
        }
      }
    } catch (e) { console.warn("shop_stats:", e.message); }
  })();

}

function saExtendShop(id) {
  const s = _saShops.find(x=>x.id===id); if (!s) return;
  const days = parseInt(prompt("Necha kun uzaytirish?","30"))||30;
  const base = s.expiresAt && new Date(s.expiresAt)>new Date() ? new Date(s.expiresAt) : new Date();
  s.expiresAt = addDaysToDate(base, days);
  saSaveShops(); renderSaShops();
  showSaToast(`✅ "${s.name}" — ${days} kun uzaytirildi (${s.expiresAt.slice(0,10)})`);
  _saApi("update_shop", { shopId: (s.cloudShopId || s.shop_id || id),
    data: { trial_ends: s.expiresAt.slice(0,10), active: true, blocked: false } })
    .then(d => console.log(d.ok
      ? `☁️ "${s.name}" muddati bulutda uzaytirildi: ${s.expiresAt.slice(0,10)}`
      : "❌ " + (d.error || "")))
    .catch(e=>console.warn("Supabase extend:", e.message));
}

async function _saSendOwnerNotif(shop, text) {
  const botUrl = (()=>{ try { return _saMainDB().settings?.telegramBotUrl||""; } catch(e){return "";} })();
  if (!botUrl) return;
  try {
    const res = await fetch(botUrl+"?action=send_owner_notif", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ shopId:shop.id, ownerEmail:shop.ownerEmail, ownerPhone:shop.phone, text })
    });
    const data = await res.json();
    // 2026-08-03: yuborilmasa ham AYTAMIZ.
    // Avval faqat muvaffaqiyat ko'rsatilardi — egasi botga ulanmagan
    // bo'lsa siz bilmay qolardingiz va xabar yetdi deb o'ylardingiz.
    if (data.sent) showSaToast("📨 Egasiga xabar yuborildi");
    else showSaToast("⚠️ " + (data.error || "Xabar yuborilmadi — egasi botga ulanmagan"));
  } catch(e) { console.warn("owner notif:", e.message); }
}

async function saSendExpiryReminders() {
  const soon = _saShops.filter(s=>{
    if (!s.expiresAt||s.plan==="lifetime"||s.blocked) return false;
    const d=Math.ceil((new Date(s.expiresAt)-new Date())/86400000);
    return d>=0&&d<=7;
  });
  if (!soon.length) { showSaToast("Eslatma yuborish kerak bo\'lgan do\'kon yo\'q"); return; }
  let sent=0;
  for (const s of soon) {
    const d=Math.ceil((new Date(s.expiresAt)-new Date())/86400000);
    await _saSendOwnerNotif(s, `⚠️ ${s.name}, obunangiz ${d} kun ichida tugaydi (${s.expiresAt.slice(0,10)}). Uzaytirish uchun murojaat qiling.`);
    sent++;
  }
  showSaToast(`✅ ${sent} ta do\'kon egasiga eslatma yuborildi`);
}

// ── Bot havolasini nusxalash ─────────────────────
// ⚠️ 2026-08-03: `saCopyBotLink` OLIB TASHLANDI.
// U bot nomini eski `merx_v5` kalitidan o'qirdi — hozirgi
// tizimda do'kon bazasi `merx_v5_shop_xxx` ko'rinishida, ya'ni
// nom hech qachon topilmasdi va tugma doim xato berardi.
// Xuddi shu ishni `saCopyOwnerLink` bajaradi (u `_saBotUsername()`
// orqali to'g'ri manbadan oladi — 2026-07-30 da tuzatilgan).


function _saBotUsername() {
  // 2026-07-30 TUZATILDI. Avval faqat localStorage["merx_v5"] o'qilardi.
  // Lekin bulutga ulangan do'kon ma'lumoti "merx_v5_<shopId>" kalitida
  // saqlanadi ("merx_v5" — faqat lokal rejim uchun). Ya'ni bulut orqali
  // kirgan SuperAdmin qurilmasida o'sha kalit BO'SH bo'lardi va tugma
  // "Bot username sozlanmagan" deb qizil xato berardi.
  //
  // Endi tartib: 1) tizim konstantasi, 2) joriy do'kon, 3) eski kalit.
  try {
    // 1) init.js dagi tizim qiymati — eng ishonchli manba
    if (typeof MERX_BOT_USERNAME === "string" && MERX_BOT_USERNAME.trim()) {
      return MERX_BOT_USERNAME.replace(/^@/,"").trim();
    }
  } catch(e) {}
  try {
    // 2) Joriy ochiq do'kon sozlamasi
    let u = (db?.settings?.telegramBotUsername || "").replace(/^@/,"").trim();
    if (u && !u.includes("@") && !u.includes(".")) return u;
  } catch(e) {}
  try {
    // 3) Eski lokal do'kon (zaxira)
    const mainDB = _saMainDB();
    let u = (mainDB?.settings?.telegramBotUsername || "").replace(/^@/,"").trim();
    if (u.includes("@") || u.includes(".")) u = "";
    return u;
  } catch(e) { return ""; }
}

function saCopyOwnerLink(shopId) {
  const botUsername = _saBotUsername();
  if (!botUsername) {
    showSaToast("Bot username sozlanmagan — Asosiy do'kon Sozlamalar → SMS & Bot", "err");
    return;
  }

  const shop = (_saShops || []).find(x => (x.cloudShopId || x.shop_id || x.id) === shopId
                                       || x.id === shopId);
  const shopName = shop ? shop.name : "";
  const link = `https://t.me/${botUsername}?start=own_${shopId}`;

  const copy = (txt) => {
    if (navigator.clipboard) return navigator.clipboard.writeText(txt).catch(() => {});
    const t = document.createElement("textarea");
    t.value = txt; document.body.appendChild(t);
    t.select(); document.execCommand("copy");
    document.body.removeChild(t);
  };
  copy(link);

  // Nusxa olindi, lekin havolani ko'rsatib ham qo'yamiz — telefonda
  // clipboard ba'zan ishlamaydi, qo'lda belgilab olish mumkin bo'lsin
  alert(
    "👑 EGA HAVOLASI" + (shopName ? "\n\nDo'kon: " + shopName : "") + "\n\n" +
    link + "\n\n" +
    "Nusxa olindi.\n\n" +
    "Shu havolani DO'KON EGASIGA yuboring. U bosgach bot uni ega sifatida\n" +
    "taniydi va /hisobot, /balans, /ombor, /qarzlar ochiladi.\n\n" +
    "⚠️ Havola BIR MARTA ishlaydi — faqat birinchi bosgan odam ega bo'ladi.\n" +
    "Shuning uchun uni faqat egasiga yuboring.\n\n" +
    "Mijozlar uchun oddiy havola (🔗 tugmasi) ishlatiladi."
  );
  showSaToast("👑 Ega havolasi nusxa olindi");
}

// ── Muddati yaqin do'konlarga eslatma ────────────
function saCheckExpiringSoon() {
  const soon = _saShops.filter(s => {
    if (!s.expiresAt || s.plan === "lifetime" || s.blocked) return false;
    const d = Math.ceil((new Date(s.expiresAt) - new Date()) / 86400000);
    return d >= 0 && d <= 7;
  });

  if (!soon.length) { showSaToast("Muddati yaqin do'konlar yo'q ✅"); return; }

  const list = soon.map(s => {
    const d = Math.ceil((new Date(s.expiresAt) - new Date()) / 86400000);
    return `• ${s.name} — ${d} kun qoldi (${s.expiresAt.slice(0,10)})`;
  }).join("\n");

  alert(`⚠️ Muddati yaqin do'konlar (${soon.length} ta):\n\n${list}\n\nUzaytirish uchun do'konni tanlang.`);
}

// ── Faolsiz do'konlar hisoboti ────────────────────
// ── QURILMALAR FAOLLIGI (2026-08-06) ──────────────
// Bugungi B20 tekshiruvida eng kerakli bo'lgan ma'lumot: qaysi
// qurilma yozayapti, qachondan beri jim, sinxron kechikayaptimi.
// Ma'lumot MAVJUD narsalardan olinadi — chek raqamidagi qurilma
// kodi va `created_at`. Yangi jadval yo'q, hech narsa yozilmaydi.
// ⚠️ Ilova versiyasi va qurilmadagi tovar soni bu yerda YO'Q —
//    ular chekda saqlanmaydi. Ular 1-bosqichda qo'shiladi.
async function saShowDevices() {
  document.getElementById("sa-dev-modal")?.remove();
  const m = document.createElement("div");
  m.id = "sa-dev-modal";
  m.style.cssText = `position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;
    backdrop-filter:blur(4px);padding:12px`;
  m.innerHTML = `<div style="background:#fff;border-radius:16px;width:820px;max-width:96vw;
    max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.25)">
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:16px 20px;background:#0D1B2A;border-radius:16px 16px 0 0">
      <div>
        <div style="font-size:16px;font-weight:800;color:#E9A500">📱 Qurilmalar faolligi</div>
        <div style="font-size:11px;color:#6B8096;margin-top:2px">Oxirgi 7 kun · chek raqamidagi qurilma kodi bo'yicha</div>
      </div>
      <button onclick="document.getElementById('sa-dev-modal').remove()"
        style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
        color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:16px">✕</button>
    </div>
    <div id="sa-dev-body" style="padding:18px 20px;color:#334155;font-size:14px">
      Yuklanmoqda...
    </div>
  </div>`;
  document.body.appendChild(m);

  let d;
  try {
    d = await _saApi("sa_finance", { op: "devices" });
  } catch (e) {
    const b = document.getElementById("sa-dev-body");
    if (b) b.innerHTML = `<div style="color:#DC2626">Xato: ${e.message || "so'rov bajarilmadi"}</div>`;
    return;
  }
  const body = document.getElementById("sa-dev-body");
  if (!body) return;
  const list = (d && d.ok && d.devices) || [];
  if (!list.length) {
    body.innerHTML = `<div style="text-align:center;padding:30px;color:#334155">
      Oxirgi 7 kunda chek yozilmagan</div>`;
    return;
  }

  // Do'kon nomi — SuperAdmin ro'yxatidan
  const nameOf = (sid) => {
    const s = (_saShops || []).find(x =>
      x.cloudShopId === sid || x.shop_id === sid || x.id === sid);
    return s ? s.name : sid;
  };
  const delayColor = (n) => n == null ? "#9ca3af"
    : n <= 10 ? "#059669" : n <= 60 ? "#D97706" : "#DC2626";
  const quietColor = (lastDate) => {
    if (!lastDate) return "#9ca3af";
    const kun = Math.round((Date.now() - Date.parse(lastDate + "T00:00:00Z")) / 86400000);
    return kun <= 1 ? "#059669" : kun <= 3 ? "#D97706" : "#DC2626";
  };

  body.innerHTML = `
    ${d.capped ? `<div style="background:#FFFBEB;border:1px solid #FDE68A;color:#B45309;
      border-radius:8px;padding:8px 12px;font-size:12px;font-weight:600;margin-bottom:12px">
      ⚠️ 20 000 yozuv chegarasi — ro'yxat to'liq emas</div>` : ""}
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#F9FAFB;border-bottom:2px solid #E5E7EB">
        <th style="text-align:left;padding:9px 10px;font-weight:700">Do'kon</th>
        <th style="text-align:center;padding:9px 6px;font-weight:700">Qurilma</th>
        <th style="text-align:center;padding:9px 6px;font-weight:700">Bugun</th>
        <th style="text-align:center;padding:9px 6px;font-weight:700">7 kun</th>
        <th style="text-align:left;padding:9px 10px;font-weight:700">Oxirgi chek</th>
        <th style="text-align:center;padding:9px 6px;font-weight:700">Kechikish</th>
      </tr></thead>
      <tbody>
        ${list.map(r => `<tr style="border-bottom:1px solid #F3F4F6${r.legacy?";opacity:.55":""}">
          <td style="padding:9px 10px;font-weight:600">${nameOf(r.shopId)}</td>
          <td style="padding:9px 6px;text-align:center">
            ${r.legacy
              ? `<span style="font-size:11px;color:#9ca3af">eski chek</span>`
              : `<span style="font-family:monospace;font-weight:800;background:#EFF6FF;
                  color:#1D4ED8;border-radius:6px;padding:2px 8px">${r.device}</span>`}</td>
          <td style="padding:9px 6px;text-align:center;font-weight:700;
            color:${r.today > 0 ? "#059669" : "#9ca3af"}">${r.today}</td>
          <td style="padding:9px 6px;text-align:center">${r.week}</td>
          <td style="padding:9px 10px;color:${quietColor(r.lastDate)};font-weight:600">
            ${r.lastDate || "—"} ${r.lastTime || ""}</td>
          <td style="padding:9px 6px;text-align:center;font-weight:700;
            color:${delayColor(r.delayAvg)}">
            ${r.delayAvg == null ? "—" : r.delayAvg + " daq"}
            ${r.delayMax > 60 ? `<div style="font-size:10px;color:#9ca3af;font-weight:400">eng ko'pi ${r.delayMax}</div>` : ""}
          </td>
        </tr>`).join("")}
      </tbody>
    </table>
    <div style="margin-top:12px;font-size:11.5px;color:#6B7280;line-height:1.5">
      <b>Kechikish</b> — chek yozilgan vaqt bilan bulutga kelgan vaqt orasidagi farq
      (<code>created_at</code> bo'yicha). Yashil ≤10 daq · sariq ≤60 daq · qizil undan ko'p.<br>
      <b>Oxirgi chek</b> qizil bo'lsa — qurilma 3 kundan beri jim.<br>
      <b>"eski chek"</b> — chek raqamida qurilma kodi yo'q (eski format). Bu qurilma emas.<br>
      ⚠️ Qo'lda tiklangan sotuvlar kechikishni katta ko'rsatadi — ular sotilganidan
      ancha keyin bazaga yozilgan.
    </div>`;
}

function saShowInactiveShops() {
  // ⚠️ 2026-08-03: BULUTDAGI MA'LUMOTDAN.
  // Avval `localStorage` dan o'qirdi — SuperAdmin kirmagan do'kon
  // ro'yxatga UMUMAN tushmasdi (`if (!st) return false`), ya'ni
  // aynan tekshirilishi kerak bo'lgan do'konlar ko'rinmasdi.
  if (!Object.keys(_saAct || {}).length) {
    showSaToast("Ma'lumot yuklanmoqda — bir soniyadan keyin urining");
    try { saLoadActivity(); } catch(e) {}
    return;
  }
  const p2 = n => String(n).padStart(2, "0");
  const d  = new Date();
  const bugun = `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
  const kunlar = (last) => last
    ? Math.floor((new Date(bugun) - new Date(last)) / 86400000) : null;

  const inactive = _saShops.filter(s => {
    const st = _saAct[s.cloudShopId || s.shop_id || s.id];
    const k  = kunlar(st && st.last);
    return k === null || k > 30;        // sotuvsiz yoki 30 kundan ko'p
  });

  if (!inactive.length) { showSaToast("Barcha do'konlar faol ✅"); return; }

  const list = inactive.map(s => {
    const st = _saAct[s.cloudShopId || s.shop_id || s.id];
    const last = (st && st.last) || "hech qachon";
    const k = kunlar(st && st.last);
    return `• ${s.name} — oxirgi sotuv: ${last}${k !== null ? ` (${k} kun)` : ""}`;
  }).join("\n");

  alert(`😴 Faolsiz do'konlar (30 kunda sotuvsiz, ${inactive.length} ta):\n\n${list}`);
}

// ── Super admin paroli o'zgartirish ───────────────
// ── Super admin paroli o'zgartirish ───────────────
// SA parol endi serverda (Vercel ENV: MERX_SA_PASS) tekshiriladi.
// ══════════════════════════════════════════════════════════════
// SUPERADMIN PAROLINI O'ZGARTIRISH (2026-08-03)
// ══════════════════════════════════════════════════════════════
// Avval bu funksiya HECH NARSA QILMASDI — faqat "Vercel'ga
// kiring" degan qizil xabar chiqarardi. Yonidagi maydon esa
// aldardi: parol yozilardi, lekin hech qayerga bormasdi.
//
// Endi parol bazada (SHA-256 xesh) saqlanadi. `MERX_SA_PASS`
// ZAXIRA bo'lib qoladi — ikkalasi ham ishlaydi. Ya'ni Vercel
// hisobiga kira olmasangiz ham parolni o'zgartira olasiz, va
// bazadagi parol yo'qolsa eski ENV bilan kira olasiz.
async function saChangeSuperPass() {
  const inp = document.getElementById("sa-superpass-inp");
  const yangi = (inp?.value || "").trim();

  if (yangi.length < 6) {
    showSaToast("Parol kamida 6 belgi bo'lsin", "err");
    inp?.focus();
    return;
  }
  if (!confirm("SuperAdmin paroli o'zgartirilsinmi?\n\n" +
               "Eski parol ishlamay qoladi. Vercel'dagi MERX_SA_PASS " +
               "esa ZAXIRA bo'lib qoladi — u bilan ham kira olasiz.")) return;

  try {
    const d = await _saApi("change_sa_pass", { newPass: yangi });
    if (!d || !d.ok) throw new Error(d?.error || "saqlanmadi");

    // Yangi parolni sessiyaga yozamiz — chiqib qolmaslik uchun
    try {
      sessionStorage.setItem("merx_sa_pass", yangi);
      if (localStorage.getItem("merx_sa_pass")) {
        localStorage.setItem("merx_sa_pass", yangi);
      }
    } catch(e) {}

    // 2026-08-03: Chrome so'ramasin — darhol tozalaymiz
    if (inp) { inp.value = ""; inp.blur(); }
    showSaToast("✅ Parol o'zgartirildi");
  } catch (e) {
    showSaToast("⚠️ " + e.message, "err");
  }
}

// ── Do'kon almashtirish (eski funksiya — saOpenShop bilan bir xil) ──
function saSwitchToShop(shopId) { saOpenShop(shopId); }

// ── SA ko'rish banneri ────────────────────────────
async function saReturnToMainShop() {
  await _saFlushSync();
  const prevKey = sessionStorage.getItem("merx_prev_shop") || "merx_v5";
  sessionStorage.setItem("merx_active_shop", prevKey);
  sessionStorage.removeItem("merx_is_sa_view");
  sessionStorage.removeItem("merx_prev_shop");
  localStorage.removeItem("merx_auth_v1");
  window.location.reload();
}

// ── Lenta (banner) idishi — 2026-08-06 ────────────
// UCHTA XATO TUZATILDI:
//  1) Ikkala lenta ham position:fixed;top:0 edi — biri ikkinchisini
//     BUTUNLAY yopardi. Endi bitta idishda, ustma-ust emas, ketma-ket.
//  2) Bo'shliq 36px deb QOTIRILGAN edi. Telefonda lenta ikki qatorga
//     bo'linsa ~60px bo'ladi va tepa qatorni (sendvich tugmasini)
//     yopardi. Endi haqiqiy balandlik OLCHANADI.
//  3) Obuna lentasidagi X bosilganda lenta o'chardi, lekin bo'shliq
//     joyida qolardi — tepada 36px bo'sh chiziq sahifa yangilanmaguncha
//     turardi. Endi yopilgach qayta o'lchanadi.
function _bannerStack() {
  let st = document.getElementById("banner-stack");
  if (!st) {
    st = document.createElement("div");
    st.id = "banner-stack";
    st.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999";
    document.body.prepend(st);
  }
  return st;
}

// Bo'shliqni haqiqiy balandlik bo'yicha qayta hisoblaydi
function _bannerReflow() {
  const st = document.getElementById("banner-stack");
  const h  = (st && st.children.length) ? st.offsetHeight : 0;
  const main = document.getElementById("main");
  const sb   = document.getElementById("sb");
  if (main) main.style.paddingTop = h ? h + "px" : "";
  if (sb)   sb.style.paddingTop   = h ? h + "px" : "";
}

// X tugmasi shuni chaqiradi — o'chiradi VA bo'shliqni tiklaydi
function _bannerClose(btn) {
  const box = btn && btn.closest("#banner-stack > div");
  if (box) box.remove();
  _bannerReflow();
}

// Ekran burilganda yoki o'lcham o'zgarganda qayta o'lchash
window.addEventListener("resize", () => {
  if (document.getElementById("banner-stack")) _bannerReflow();
});

function renderSaViewBanner() {
  const isSaView = sessionStorage.getItem("merx_is_sa_view") === "1";
  if (!isSaView) return;
  if (document.getElementById("sa-view-banner")) return;
  const banner = document.createElement("div");
  banner.id = "sa-view-banner";
  banner.style.cssText = `position:relative;
    background:linear-gradient(90deg,#4c1d95,#7c3aed);
    color:#fff;padding:8px 20px;font-family:'DM Sans',sans-serif;
    font-size:13px;font-weight:600;display:flex;align-items:center;gap:12px;
    flex-wrap:wrap;
    box-shadow:0 2px 12px rgba(0,0,0,.3)`;
  banner.innerHTML = `
    <span style="opacity:.7">⚡ Super Admin ko'rinishi:</span>
    <strong>${db.shop?.name||"Do'kon"}</strong>
    <span style="background:rgba(255,255,255,.2);border-radius:4px;padding:2px 8px;font-size:11px">Faqat ko'rish</span>
    <button onclick="saReturnToMainShop()"
      style="margin-left:auto;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);
      color:#fff;border-radius:6px;padding:4px 14px;font-family:inherit;font-size:12px;cursor:pointer">
      ← Asosiy do'konga qaytish
    </button>`;
  _bannerStack().prepend(banner);   // SuperAdmin lentasi eng tepada
  _bannerReflow();
}

function saLoadActiveShop() {
  const activeKey = sessionStorage.getItem("merx_active_shop");
  if (!activeKey || activeKey === "merx_v5") return false;
  try {
    const raw = localStorage.getItem(activeKey); if (!raw) return false;
    const shopDB = JSON.parse(raw);
    shopDB._currentKey = activeKey;
    db = shopDB;
    return true;
  } catch(e) { return false; }
}

const _origSaveDB = window.saveDB;
window.saveDB = function() {
  const activeKey = db._currentKey || sessionStorage.getItem("merx_active_shop");
  if (activeKey && activeKey !== "merx_v5") {
    try { localStorage.setItem(activeKey, JSON.stringify(db)); } catch(e) {}
    if (typeof scheduleCloudSync === "function") scheduleCloudSync();
    return;
  }
  if (typeof _origSaveDB === "function") _origSaveDB();
};

(function() {
  const isSaView = sessionStorage.getItem("merx_is_sa_view") === "1";
  if (isSaView) {
    const loaded = saLoadActiveShop();
    if (!loaded) {
      sessionStorage.removeItem("merx_is_sa_view");
      sessionStorage.removeItem("merx_active_shop");
    }
  }
})();

// ── Toast ─────────────────────────────────────────
function showSaToast(msg, type="ok") {
  const t = document.createElement("div");
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:999999;
    background:${type==="err"?"#FEF2F2":"#ECFDF5"};
    color:${type==="err"?"#DC2626":"#059669"};
    border:1px solid ${type==="err"?"#FECACA":"#BBF7D0"};
    border-radius:12px;padding:13px 20px;font-family:'DM Sans',sans-serif;
    font-size:13px;font-weight:600;max-width:360px;
    box-shadow:0 8px 24px rgba(0,0,0,.12)`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ── Klaviatura shortcut: Ctrl+Shift+A ─────────────
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.shiftKey && e.key === "A") { e.preventDefault(); openSaPanel(); }
});

// ── Obuna narxlarini sozlash ─────────────────────
// ══════════════════════════════════════════════════════════════
// TARIF NARXLARI (2026-08-03)
// ══════════════════════════════════════════════════════════════
// Avval oyna faqat ikki raqamni `localStorage` ga yozardi va
// u HECH QAYERGA ta'sir qilmasdi — do'kon yaratishda ham,
// tahrirda ham ishlatilmasdi.
// Endi bazada (`sa_tariffs`), Start va Pro uchun alohida:
// oylik narx, yillik narx, yillikdagi chegirma foizi.
// Yillik narx chegirma bilan avtomat hisoblanadi, lekin qo'lda
// ham o'zgartirish mumkin.
let _saTariffs = [];

async function saOpenPriceSettings() {
  document.getElementById("sa-price-modal")?.remove();
  const m = document.createElement("div");
  m.id = "sa-price-modal";
  m.style.cssText = "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.5);" +
    "display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif";
  m.innerHTML = `<div style="background:#fff;border-radius:16px;padding:22px;width:620px;
    max-width:96vw;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.25)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:16px;font-weight:800;color:#0D1B2A">💵 Tarif narxlari</div>
      <button onclick="document.getElementById('sa-price-modal').remove()"
        style="background:none;border:none;font-size:24px;cursor:pointer;color:#334155">×</button>
    </div>
    <div id="sa-tf-body" style="color:#334155">Yuklanmoqda...</div>
  </div>`;
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);

  try {
    const d = await _saApi("sa_finance", { op: "load" });
    if (!d || !d.ok) throw new Error(d?.error || "yuklanmadi");
    _saTariffs = d.tariffs || [];
    saRenderTariffs();
  } catch (e) {
    const b = document.getElementById("sa-tf-body");
    if (b) b.innerHTML = `<div style="color:#DC2626">Xato: ${e.message}</div>`;
  }
}

function saRenderTariffs() {
  const b = document.getElementById("sa-tf-body"); if (!b) return;
  const iCss = "width:100%;font-family:inherit;font-size:13.5px;border:1.5px solid #E5E7EB;" +
               "border-radius:8px;padding:8px 10px;box-sizing:border-box";
  b.innerHTML = _saTariffs.map(t => `
    <div style="border:1px solid #E5E7EB;border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="font-size:14px;font-weight:800;color:#0D1B2A;margin-bottom:10px">
        ${t.title || t.id}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 90px 90px;gap:10px;align-items:end">
        <div>
          <label style="font-size:11.5px;color:#334155;font-weight:700">Oylik narx</label>
          <input id="tf-m-${t.id}" type="number" min="0" value="${+t.price_month || 0}"
            oninput="saTfCalcYear('${t.id}')" style="${iCss}">
        </div>
        <div>
          <label style="font-size:11.5px;color:#334155;font-weight:700">Yillik narx</label>
          <input id="tf-y-${t.id}" type="number" min="0" value="${+t.price_year || 0}"
            style="${iCss}">
        </div>
        <div>
          <label style="font-size:11.5px;color:#334155;font-weight:700">Chegirma %</label>
          <input id="tf-d-${t.id}" type="number" min="0" max="90" value="${+t.discount_pct || 0}"
            oninput="saTfCalcYear('${t.id}')" style="${iCss}">
        </div>
        <div>
          <label style="font-size:11.5px;color:#334155;font-weight:700">Valyuta</label>
          <select id="tf-c-${t.id}" style="${iCss}">
            <option value="uzs"${t.currency==="uzs"?" selected":""}>so'm</option>
            <option value="usd"${t.currency==="usd"?" selected":""}>USD</option>
          </select>
        </div>
      </div>
      <div id="tf-hint-${t.id}" style="font-size:11.5px;color:#334155;margin-top:7px"></div>
    </div>`).join("") + `
    <button onclick="saSaveTariffPrices()" class="btn"
      style="width:100%;background:#0D1B2A;color:#fff;border:none;border-radius:10px;
      padding:11px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer">
      Saqlash</button>
    <div style="font-size:11.5px;color:#334155;margin-top:10px;line-height:1.5">
      Yillik narx chegirma bilan avtomat hisoblanadi — qo'lda ham o'zgartirsangiz bo'ladi.
      Bu narxlar yangi do'kon yaratishda avtomat qo'yiladi.
    </div>`;
  _saTariffs.forEach(t => saTfCalcYear(t.id));
}

// Oylik narx yoki chegirma o'zgarsa — yillikni qayta hisoblaymiz
function saTfCalcYear(id) {
  const mo = parseFloat(document.getElementById("tf-m-" + id)?.value) || 0;
  const dc = parseFloat(document.getElementById("tf-d-" + id)?.value) || 0;
  const yr = Math.round(mo * 12 * (1 - dc / 100));
  const yEl = document.getElementById("tf-y-" + id);
  if (yEl) yEl.value = yr;
  const h = document.getElementById("tf-hint-" + id);
  if (h) h.textContent = mo
    ? `12 oy × ${mo.toLocaleString("ru-RU")} = ${(mo*12).toLocaleString("ru-RU")}, ` +
      `${dc}% chegirma → ${yr.toLocaleString("ru-RU")}`
    : "";
}

async function saSaveTariffPrices() {
  try {
    for (const t of _saTariffs) {
      await _saApi("sa_finance", { op: "save_tariff", tariff: {
        id: t.id, title: t.title,
        price_month:  parseFloat(document.getElementById("tf-m-" + t.id)?.value) || 0,
        price_year:   parseFloat(document.getElementById("tf-y-" + t.id)?.value) || 0,
        discount_pct: parseFloat(document.getElementById("tf-d-" + t.id)?.value) || 0,
        currency:     document.getElementById("tf-c-" + t.id)?.value || "uzs",
        sort_order:   t.sort_order
      }});
    }
    showSaToast("✅ Tarif narxlari saqlandi");
    document.getElementById("sa-price-modal")?.remove();
  } catch (e) {
    showSaToast("⚠️ Saqlanmadi: " + e.message, "err");
  }
}

// 2026-08-03: eski `saSavePriceSettings` olib tashlandi — u
// narxni `localStorage` ga yozardi va hech qayerga ta'sir
// qilmasdi. O'rniga `saSaveTariffPrices` (bazaga yozadi).


function showSubscriptionWall(reason, shop) {
  const app = document.getElementById("app");
  if (app) app.style.display = "none";
  document.getElementById("sub-wall")?.remove();
  const wall = document.createElement("div");
  wall.id = "sub-wall";
  wall.style.cssText = `position:fixed;inset:0;z-index:99998;
    background:linear-gradient(135deg,#0D1B2A 0%,#1a2f44 100%);
    display:flex;align-items:center;justify-content:center;
    font-family:'DM Sans',sans-serif`;
  const isBlocked = reason === "blocked";
  wall.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:40px;width:100%;max-width:440px;
      text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.3)">
      <div style="font-size:48px;margin-bottom:16px">${isBlocked?"🔒":"⏰"}</div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0D1B2A">
        ${isBlocked?"Do'kon bloklangan":"Obuna muddati tugadi"}</h2>
      <p style="color:#888;font-size:14px;margin:0 0 24px">
        ${isBlocked?`Bu do'kon administrator tomonidan vaqtincha bloklangan.`
          :`"${shop.name}" obunasining muddati tugagan. Davom etish uchun obunani yangilang.`}</p>
      <div style="background:#F9FAFB;border-radius:12px;padding:16px;margin-bottom:24px;text-align:left">
        <div style="font-size:13px;color:#555;margin-bottom:6px">📞 <strong>Administrator bilan bog'laning:</strong></div>
        <div style="font-size:14px;font-weight:600;color:#0D1B2A">MERX Savdo tizimi</div>
      </div>
      <button onclick="saWallLogout()"
        style="width:100%;background:#0D1B2A;border:none;border-radius:12px;
        padding:14px;font-family:inherit;font-size:15px;font-weight:700;
        cursor:pointer;color:#E9A500">Boshqa hisobdan kirish</button>
    </div>`;
  document.body.appendChild(wall);
}

async function saWallLogout() {
  await _saFlushSync();
  const prevKey = sessionStorage.getItem("merx_prev_shop");
  if (prevKey) {
    sessionStorage.setItem("merx_active_shop", prevKey);
    sessionStorage.removeItem("merx_is_sa_view");
    sessionStorage.removeItem("merx_prev_shop");
  }
  localStorage.removeItem("merx_auth_v1");
  window.location.reload();
}

function showSubscriptionWarning(daysLeft, shop) {
  if (document.getElementById("sub-warning")) return;
  const el = document.createElement("div");
  el.id = "sub-warning";
  el.style.cssText = `position:relative;
    background:#92400E;color:#FDE68A;padding:8px 20px;font-family:'DM Sans',sans-serif;
    font-size:13px;font-weight:600;display:flex;align-items:center;
    justify-content:center;gap:12px;flex-wrap:wrap`;
  el.innerHTML = `⚠️ Obuna muddati ${daysLeft} kun ichida tugaydi!
    <button onclick="_bannerClose(this)"
      style="background:transparent;border:none;color:#FDE68A;cursor:pointer;font-size:16px">✕</button>`;
  _bannerStack().appendChild(el);
  _bannerReflow();
}

// ── Modullar cheklash ─────────────────────────────
function applyShopModules() {
  saLoadShops();
  const activeKey = sessionStorage.getItem("merx_active_shop");
  if (!activeKey || activeKey === "merx_v5") return;
  const shop = _saShops.find(s => s.dbKey === activeKey);
  if (!shop || !shop.modules) return;
  const modules = shop.modules || [];
  const modulePages = {pos:["sotuv","tarix","qarzlar"],ombor:["ombor"],hisobot:["hisobot","moliya","xodimlar"],sms:[],cloud:[]};
  const hiddenPages = [];
  Object.entries(modulePages).forEach(([mod,pages])=>{ if(!modules.includes(mod)) hiddenPages.push(...pages); });
  document.querySelectorAll(".ni[data-page]").forEach(el=>{
    if (hiddenPages.includes(el.dataset.page)) el.style.display="none";
  });
  if (!modules.includes("sms")) { document.querySelector(".sms-section, #sms-wrap")?.style?.setProperty("display","none"); }
  if (!modules.includes("cloud")) { document.getElementById("cloud-pill")?.style?.setProperty("display","none"); }
}

// ── Start ─────────────────────────────────────────
saLoad();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderSaViewBanner);
} else {
  setTimeout(renderSaViewBanner, 100);
}

// ═══════════════════════════════════════════════════════════════
// 2026-07-20: SUPERADMIN — DO'KON ZAXIRALARI (bulut, tiklash)
// Faqat SuperAdmin ko'radi va tiklaydi. Egasi hech narsa ko'rmaydi.
// ═══════════════════════════════════════════════════════════════
let _saBackupShopId = null;
let _saBackupShopName = "";

async function saOpenBackups(shopId, shopName) {
  _saBackupShopId = shopId;
  _saBackupShopName = shopName || shopId;

  document.getElementById("sa-backups-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "sa-backups-modal";
  modal.style.cssText = `position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;
    backdrop-filter:blur(4px)`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:480px;max-width:95vw;
      overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.25)">
      <div style="padding:20px 24px;background:#0D1B2A;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:19px;font-weight:800;color:#E9A500">🗄️ Zaxiralar</div>
          <div style="font-size:12px;color:#6B8096;margin-top:2px">${_saBackupShopName}</div>
        </div>
        <button onclick="document.getElementById('sa-backups-modal').remove()"
          style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
          color:#fff;border-radius:8px;padding:6px 12px;font-family:inherit;cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="padding:14px 18px 6px;font-size:13px;color:#334155">
        Tiklash joriy ma'lumot ustiga yozadi. Faqat zarur bo'lganda ishlating.
      </div>
      <div id="sa-backups-list" style="padding:8px 18px 20px;max-height:380px;overflow-y:auto">
        <div style="text-align:center;padding:26px;color:#334155">
          <i class="ti ti-loader" style="font-size:26px;display:block;margin-bottom:8px"></i>Yuklanmoqda...</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  const el = document.getElementById("sa-backups-list");
  if (typeof saListBackups !== "function") {
    if (el) el.innerHTML = `<div style="text-align:center;padding:20px;color:#DC2626">Zaxira moduli yuklanmadi (cloud.js)</div>`;
    return;
  }
  const list = await saListBackups(shopId);
  if (el) {
    el.innerHTML = list.length ? list.map(b => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;
        padding:12px 14px;border:1px solid #E5E7EB;border-radius:10px;margin-bottom:8px">
        <div>
          <div style="font-weight:700;font-size:14px;color:#111827">${b.date}</div>
          <div style="font-size:13px;color:#334155">${b.records||0} ta yozuv</div>
        </div>
        <button onclick="saDoRestore(${b.id},'${b.date}')"
          style="background:#7C3AED;border:none;color:#fff;border-radius:8px;
          padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer">Tiklash</button>
      </div>`).join("") :
      `<div style="text-align:center;padding:30px;color:#334155">
        <i class="ti ti-database-off" style="font-size:32px;display:block;margin-bottom:10px"></i>
        Bu do'kon uchun hali bulut zaxira yo'q.<br>
        <span style="font-size:12px">Do'kon egasi kirganda avtomat olinadi.</span>
      </div>`;
  }
}

async function saDoRestore(backupId, date) {
  if (!confirm("⚠️ DIQQAT — ZAXIRADAN TIKLASH\n\n" +
      "Do'kon: " + _saBackupShopName + "\n" +
      "Sana: " + date + "\n\n" +
      "Bu do'konning HOZIRGI ma'lumoti O'CHIRILIB, o'rniga shu zaxira yoziladi.\n" +
      "Tiklashdan keyingi o'zgarishlar yo'qoladi.\n\n" +
      "Davom etasizmi?")) return;

  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = "Tiklanmoqda..."; }

  if (typeof saRestoreBackup !== "function") {
    alert("Tiklash moduli yuklanmadi (cloud.js)");
    return;
  }
  // 2026-07-30: natija endi HAQIQIY. Avval saRestoreBackup har doim
  // ok:true qaytarardi — hech nima tiklanmasa ham "✅ TIKLANDI"
  // yozilardi. Endi har jadval bo'yicha nechta yozuv o'chirilgani va
  // nechta yozilgani ko'rsatiladi.
  const res = await saRestoreBackup(backupId, (t, done, total) => {
    if (btn) btn.textContent = `${t} ${done}/${total}`;
  });

  const _nice = { products:"Tovarlar", customers:"Mijozlar", sales:"Sotuvlar",
    debt_payments:"Qarz to'lovlari", ombor:"Ombor", xarajatlar:"Xarajatlar", staff:"Xodimlar" };
  const _lines = (arr) => (arr || []).map(x =>
    `  · ${_nice[x.table] || x.table}: ${x.inserted} ta yozildi (${x.deleted} ta o'chirildi)`).join("\n");

  if (res.ok) {
    alert("✅ TIKLANDI\n\n" +
      "Do'kon: " + _saBackupShopName + "\n" +
      "Sana: " + res.date + "\n\n" +
      _lines(res.tables) + "\n\n" +
      "JAMI: " + (res.records || 0) + " ta yozuv\n" +
      (res.tombOk ? "" : "\n⚠️ O'chirilganlar daftari tozalanmadi — ba'zi yozuvlar yashirin qolishi mumkin.\n") +
      "\nDo'kon egasi qurilmasida 'Yangilash' bossa, tiklangan ma'lumot keladi.");
    document.getElementById("sa-backups-modal")?.remove();
  } else {
    alert("❌ TIKLASH TO'XTADI\n\n" +
      (res.error || "noma'lum xato") + "\n\n" +
      (res.done && res.done.length
        ? "Tiklanib bo'lgan jadvallar:\n" + _lines(res.done) +
          "\n\n⚠️ DIQQAT: tiklash yarim qoldi. Xatoni tuzatib SHU ZAXIRANI QAYTA tiklang — " +
          "aks holda ma'lumot chala holatda qoladi."
        : "Hech qanday o'zgarish kiritilmadi — ma'lumot avvalgi holatda."));
    if (btn) { btn.disabled = false; btn.textContent = "Tiklash"; }
  }
}

// ═══ VALYUTA REJIMINI BULUTGA YOZISH (2026-07-26) ═══
// SuperAdmin belgilagan rejim do'konning Supabase settings jadvaliga
// yoziladi — shunda do'kon istalgan qurilmadan kirsa ham shu rejimda
// ochiladi va egasi o'zgartira olmaydi.
async function saPushCurrencyMode(shopId, mode) {
  if (!shopId || !mode) return false;
  let url = "", key = "";
  try {
    const m = _saMainDB();
    url = m?.settings?.supabaseUrl || "";
    key = m?.settings?.supabaseKey || "";
  } catch(e) {}
  if (!url && typeof MERX_SUPABASE_URL !== "undefined") url = MERX_SUPABASE_URL;
  if (!key && typeof MERX_SUPABASE_KEY !== "undefined") key = MERX_SUPABASE_KEY;
  if (!url || !key) { console.warn("Supabase kaliti yo'q"); return false; }

  const body = { shop_id: shopId, currency_mode: mode };
  // Qat'iy rejimda ko'rsatish valyutasi ham majburlanadi
  if (mode === "uzs" || mode === "usd") body.price_currency = mode;

  try {
    const res = await fetch(`${url}/rest/v1/settings?on_conflict=shop_id`, {
      method: "POST",
      headers: {
        "apikey": key, "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify([body])
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn("Valyuta rejimi yozilmadi:", t);
      return false;
    }
    console.log(`💱 ${shopId}: valyuta rejimi "${mode}" bulutga yozildi`);
    return true;
  } catch(e) {
    console.warn("Valyuta rejimi xato:", e.message);
    return false;
  }
}


// ═══ SUPERADMIN SERVER CHAQIRUVI (2026-07-26) ═══
// SuperAdmin amallari SERVICE_KEY bilan serverda bajariladi —
// brauzerdagi ochiq kalit boshqa do'kon yozuvini o'zgartira olmaydi.
async function _saApi(action, payload) {
  const res = await fetch(`/api/auth-v2?action=${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sa-pass": (sessionStorage.getItem("merx_sa_pass") || localStorage.getItem("merx_sa_pass") || "")
    },
    body: JSON.stringify(payload || {})
  });
  return res.json();
}

// ═══ F5 DAN KEYIN PANELNI TIKLASH (2026-07-26) ═══
// Avval sahifa yangilangach SuperAdmin paneli o'zi ochilmasdi —
// foydalanuvchi asosiy ilovaga tushib qolib, "chiqarib yubordi" deb
// o'ylardi. Endi amaldagi sessiya bo'lsa panel avtomat qaytadi.
function saRestorePanelIfLoggedIn() {
  try {
    // 2026-08-03: do'konga kirilyapti — panel ochilmaydi
    if (sessionStorage.getItem("merx_sa_entering") === "1") {
      sessionStorage.removeItem("merx_sa_entering");
      console.log("🏪 Do'konga kirildi — SuperAdmin paneli ochilmadi");
      return false;
    }
    saLoad();
    if (!_saSession) return false;
    // ⚠️ openSaPanel() toggle qiladi (ochiq bo'lsa YOPADI) — shuning
    // uchun faqat panel YO'Q bo'lganda chaqiramiz
    if (document.getElementById("sa-overlay")) return true;
    openSaPanel();
    console.log("🔐 SuperAdmin sessiyasi tiklandi");
    return true;
  } catch(e) { return false; }
}

// Ilova yuklangach tekshiramiz (DOM tayyor bo'lgach)
if (typeof window !== "undefined") {
  // ⚠️ 2026-08-03: QAYTISH LENTASI HAM CHIZILADI.
  // `renderSaViewBanner()` yozilgan, lekin HECH QAYERDA
  // chaqirilmasdi — do'konga kirilgach SuperAdminga qaytish
  // tugmasi ko'rinmasdi.
  const _saBoot = () => setTimeout(() => {
    try { renderSaViewBanner(); } catch(e) {}
    saRestorePanelIfLoggedIn();
  }, 400);
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", _saBoot);
  else _saBoot();
}

// ═══════════════════════════════════════════════════════════════
// LANDING TARIF NARXLARI (2026-07-26)
// merx.uz sahifasidagi tarif kartalari narxi va imkoniyatlar
// ro'yxatini shu yerdan boshqariladi.
// ═══════════════════════════════════════════════════════════════
async function saOpenTariffs() {
  document.getElementById("sa-tariff-modal")?.remove();

  const d = await _saApi("get_tariffs", {}).catch(() => ({ ok: false }));
  const list = (d && d.ok && d.tariffs?.length) ? d.tariffs : [];

  const iSt = "width:100%;padding:9px 11px;border:1.5px solid #E5E7EB;border-radius:9px;" +
              "font-family:inherit;font-size:14px;box-sizing:border-box";

  const m = document.createElement("div");
  m.id = "sa-tariff-modal";
  m.style.cssText = "position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.6);" +
    "display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto";
  m.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:26px;max-width:600px;width:100%;
      max-height:90vh;overflow:auto;font-family:'DM Sans',sans-serif">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <h3 style="margin:0;font-size:19px;font-weight:800;color:#0D1B2A">
          💰 Landing tarif narxlari
        </h3>
        <button onclick="document.getElementById('sa-tariff-modal').remove()"
          style="background:none;border:none;font-size:24px;cursor:pointer;color:#334155">×</button>
      </div>
      <p style="font-size:12.5px;color:#374151;margin:0 0 20px;line-height:1.5">
        Bu narxlar <b>merx.uz</b> sahifasida ko'rinadi. O'zgartirsangiz sayt
        5 daqiqa ichida yangilanadi.
      </p>

      ${list.length ? list.map(t => `
        <div style="border:1.5px solid #E5E7EB;border-radius:12px;padding:18px;margin-bottom:14px;
          background:${t.tier === "pro" ? "#FAFAF9" : "#fff"}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
            <span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:20px;
              background:${t.tier === "pro" ? "#0D1B2A" : "#FEF3C7"};
              color:${t.tier === "pro" ? "#fff" : "#92400E"}">
              ${(t.tier || "").toUpperCase()}
            </span>
            <input id="tf-title-${t.tier}" value="${t.title || ""}"
              style="${iSt};flex:1;font-weight:700" placeholder="Tarif nomi">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:4px">
                NARX (so'm)</label>
              <input id="tf-price-${t.tier}" type="number" min="0" step="10000"
                value="${t.price_uzs || 0}" style="${iSt};font-weight:800">
            </div>
            <div>
              <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:4px">
                DAVR</label>
              <input id="tf-period-${t.tier}" value="${t.period || "oyiga"}" style="${iSt}">
            </div>
          </div>

          <label style="font-size:12.5px;color:#1F2937;font-weight:700;display:block;margin-bottom:4px">
            IMKONIYATLAR <span style="font-weight:400">(har qator — alohida band)</span></label>
          <textarea id="tf-feat-${t.tier}" rows="6" style="${iSt};resize:vertical;line-height:1.5"
            >${(Array.isArray(t.features) ? t.features : []).join("\\n")}</textarea>

          <button onclick="saSaveTariff('${t.tier}')"
            style="width:100%;margin-top:12px;background:#0D1B2A;color:#fff;border:none;
            border-radius:9px;padding:11px;font-weight:700;font-size:14px;cursor:pointer">
            ✓ ${t.title || t.tier} tarifini saqlash
          </button>
        </div>`).join("") : `
        <div style="text-align:center;padding:30px;color:#334155">
          Tariflar topilmadi.<br>
          <span style="font-size:12px">OBUNA-TARIFLARI.sql ni ishga tushirganmisiz?</span>
        </div>`}
    </div>`;
  document.body.appendChild(m);
}

async function saSaveTariff(tier) {
  const price  = parseInt(document.getElementById(`tf-price-${tier}`)?.value) || 0;
  const title  = document.getElementById(`tf-title-${tier}`)?.value.trim() || tier;
  const period = document.getElementById(`tf-period-${tier}`)?.value.trim() || "oyiga";
  const raw    = document.getElementById(`tf-feat-${tier}`)?.value || "";
  const features = raw.split("\n").map(x => x.trim()).filter(Boolean);

  if (price <= 0 && !confirm("Narx 0 — bu to'g'rimi?")) return;

  const d = await _saApi("update_tariff", {
    tier, title, price_uzs: price, period, features
  }).catch(e => ({ ok: false, error: e.message }));

  if (d && d.ok) {
    showSaToast(`✅ ${title}: ${Number(price).toLocaleString("ru-RU")} so'm saqlandi`);
    console.log(`💰 ${tier} tarifi yangilandi: ${price}`);
  } else {
    showSaToast("❌ Saqlanmadi: " + (d?.error || "xato"), "err");
  }
}
