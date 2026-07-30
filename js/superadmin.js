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

function saLogout() {
  _saSession = null;
  // 2026-07-26: ikkala saqlash joyi ham tozalanadi
  [SA_KEY, SA_TS_KEY, "merx_sa_pass"].forEach(k => {
    sessionStorage.removeItem(k);
    localStorage.removeItem(k);
  });
  hideSaPanel();
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
  overlay.style.cssText = `position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);
    backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;
    font-family:'DM Sans',sans-serif`;

  if (!_saSession) {
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:40px 36px;width:360px;
        box-shadow:0 24px 60px rgba(0,0,0,.25);text-align:center">
        <div style="width:56px;height:56px;background:#0D1B2A;border-radius:14px;
          display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <i class="ti ti-shield-bolt" style="font-size:28px;color:#E9A500"></i>
        </div>
        <div style="font-size:20px;font-weight:800;color:#0D1B2A;margin-bottom:4px">Super Admin</div>
        <div style="font-size:13px;color:#9ca3af;margin-bottom:28px">MERX boshqaruv paneli</div>
        <div id="sa-err" style="display:none;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;
          border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;font-weight:600"></div>
        <input id="sa-pass" type="password" placeholder="Super admin paroli"
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
  let todayRev = 0, todaySales = 0, totalDebt = 0;
  const m = new Date().toISOString().slice(0,7);
  _saShops.forEach(shop => {
    const s = saGetShopStats(shop); if (!s) return;
    totalRev   += s.totalRev;   totalSales += s.salesCnt;
    totalCust  += s.custCnt;    totalProd  += s.prodCnt;
    monthRev   += s.monthRev;   monthSales += s.monthCnt;
    todayRev   += s.todayRev||0; todaySales += s.todayCnt||0;
    totalDebt  += s.totalDebt||0;
  });
  const fmt = n => n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?(n/1000).toFixed(0)+"K":String(n||0);
  const active   = _saShops.filter(s=>saIsActive(s)).length;
  const expired  = _saShops.filter(s=>saIsExpired(s)).length;
  const inactive = _saShops.filter(s=>{ const st=saGetShopStats(s); return st && !st.isActive7; }).length;
  // 3 kun ichida muddati tugaydiganlar
  const soon3 = _saShops.filter(s=>{
    if (!s.expiresAt || s.plan==="lifetime") return false;
    const d = Math.ceil((new Date(s.expiresAt)-new Date())/86400000);
    return d>=0 && d<=3;
  }).length;
  const newShops = _saShops.filter(s=>s.createdAt?.startsWith(m)).length;
  const plans    = {trial:0,monthly:0,yearly:0,lifetime:0};
  _saShops.forEach(s=>{ if(plans[s.plan]!==undefined) plans[s.plan]++; });
  const savedPrices  = (()=>{ try{return JSON.parse(localStorage.getItem("merx_sa_prices")||"{}");}catch(e){return {};} })();
  const planPrices   = {trial:0, monthly:savedPrices.monthly||50000, yearly:savedPrices.yearly||500000, lifetime:0};
  const monthlyIncome= _saShops.filter(s=>saIsActive(s)).reduce((a,s)=>a+(planPrices[s.plan]||0),0);
  return `
    <!-- 1-qator: Asosiy raqamlar -->
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0;background:#F8FAFC;border-bottom:1px solid #E5E7EB">
      ${[
        {lbl:"Jami do'konlar",  val:_saShops.length+" ta",  clr:"#0D1B2A", ico:"ti-building-store", sub:""},
        {lbl:"Faol",            val:active+" ta",            clr:"#059669", ico:"ti-circle-check",   sub:"obunalar"},
        {lbl:"Muddati o'tgan",  val:expired+" ta",           clr:expired?"#DC2626":"#9CA3AF", ico:"ti-clock-x", sub:""},
        {lbl:"3 kunda tugaydi", val:soon3+" ta",             clr:soon3?"#D97706":"#9CA3AF",   ico:"ti-alert-triangle", sub:"diqqat!"},
        {lbl:"Faolsiz (7 kun)", val:inactive+" ta",          clr:inactive?"#9333EA":"#9CA3AF",ico:"ti-zzz",            sub:"sotuvsiz"},
        {lbl:"Bu oy qo'shildi", val:newShops+" ta",          clr:"#2563EB", ico:"ti-plus",           sub:"yangi"},
      ].map(k=>`
        <div style="padding:12px 14px;border-right:1px solid #E5E7EB;background:#fff">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <i class="ti ${k.ico}" style="font-size:14px;color:${k.clr}"></i>
            <div style="font-size:10px;color:#6B7280;font-weight:700;text-transform:uppercase;letter-spacing:.04em">${k.lbl}</div>
          </div>
          <div style="font-size:20px;font-weight:800;color:${k.clr}">${k.val}</div>
          ${k.sub?`<div style="font-size:10px;color:#9CA3AF;margin-top:2px">${k.sub}</div>`:""}
        </div>`).join("")}
    </div>
    <!-- 2-qator: Moliyaviy -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0;background:#fff;border-bottom:1px solid #E5E7EB">
      <div style="padding:12px 16px;border-right:1px solid #F3F4F6">
        <div style="font-size:10px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">💰 Jami tushum</div>
        <div style="font-size:18px;font-weight:800;color:#059669">${fmt(totalRev)} so'm</div>
        <div style="font-size:11px;color:#9CA3AF;margin-top:2px">Bu oy: <span style="color:#2563EB;font-weight:600">${fmt(monthRev)}</span></div>
      </div>
      <div style="padding:12px 16px;border-right:1px solid #F3F4F6">
        <div style="font-size:10px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">📅 Bugungi</div>
        <div style="font-size:18px;font-weight:800;color:#0D1B2A">${fmt(todayRev)} so'm</div>
        <div style="font-size:11px;color:#9CA3AF;margin-top:2px">${todaySales} ta sotuv</div>
      </div>
      <div style="padding:12px 16px;border-right:1px solid #F3F4F6">
        <div style="font-size:10px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">🔴 Jami qarz</div>
        <div style="font-size:18px;font-weight:800;color:${totalDebt>0?"#DC2626":"#9CA3AF"}">${fmt(totalDebt)} so'm</div>
        <div style="font-size:11px;color:#9CA3AF;margin-top:2px">barcha do'konlar</div>
      </div>
      <div style="padding:12px 16px;border-right:1px solid #F3F4F6">
        <div style="font-size:10px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">💳 Obuna daromad</div>
        <div style="font-size:18px;font-weight:800;color:#7C3AED">${fmt(monthlyIncome)} so'm</div>
        <div style="font-size:11px;color:#9CA3AF;margin-top:2px">${active} faol do'kon</div>
      </div>
      <div style="padding:12px 16px">
        <div style="font-size:10px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Obuna turlari</div>
        ${[["🧪",plans.trial,"#D97706","Sinov"],["📅",plans.monthly,"#2563EB","Oylik"],
           ["📆",plans.yearly,"#059669","Yillik"],["♾️",plans.lifetime,"#7C3AED","Umrlik"]]
          .map(([e,v,c,l])=>`<div style="display:flex;justify-content:space-between;margin-bottom:2px">
            <span style="font-size:11px;color:#6B7280">${e} ${l}</span>
            <span style="font-size:11px;font-weight:700;color:${c}">${v}</span>
          </div>`).join("")}
      </div>
    </div>`;
}

// ── Panel qurish ─────────────────────────────────
function buildSaPanel() {
  return `
    <div style="background:#fff;border-radius:20px;width:1100px;max-width:98vw;
      max-height:92vh;overflow:hidden;display:flex;flex-direction:column;
      box-shadow:0 32px 80px rgba(0,0,0,.25)">

      <!-- Header -->
      <div style="padding:18px 24px;border-bottom:1px solid #E5E7EB;
        display:flex;align-items:center;justify-content:space-between;background:#0D1B2A">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;background:#E9A500;border-radius:10px;
            display:flex;align-items:center;justify-content:center">
            <i class="ti ti-shield-bolt" style="font-size:20px;color:#0D1B2A"></i>
          </div>
          <div>
            <div style="font-size:16px;font-weight:800;color:#fff">Super Admin Panel</div>
            <div style="font-size:11px;color:#6B8096">MERX · ${_saShops.length} ta do'kon boshqaruvi</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
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
      <div style="padding:12px 20px;border-bottom:1px solid #E5E7EB;
        display:flex;align-items:center;gap:10px;background:#F9FAFB;flex-wrap:wrap">
        <button onclick="saOpenAddShop()"
          style="background:#0D1B2A;border:none;border-radius:8px;padding:8px 18px;
          font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;color:#E9A500;
          display:flex;align-items:center;gap:6px">
          <i class="ti ti-plus"></i> Yangi do'kon
        </button>
        <div style="position:relative">
          <i class="ti ti-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);
            color:#9CA3AF;font-size:14px"></i>
          <input id="sa-q" placeholder="Do'kon qidirish..."
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
              color:${f==="Barchasi"?"#0D1B2A":"#6B7280"};border:none;
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
          <input id="sa-superpass-inp" type="password" placeholder="Yangi super admin paroli"
            style="background:#fff;border:1.5px solid #E5E7EB;color:#111;
            border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;
            outline:none;width:160px" onfocus="this.style.borderColor='#E9A500'"
            onblur="this.style.borderColor='#E5E7EB'">
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
            <div style="font-size:16px;font-weight:800;color:#0D1B2A">
              <i class="ti ti-building-store" style="color:#E9A500"></i> Yangi do'kon qo'shish
            </div>
            <button onclick="document.getElementById('sa-add-modal').style.display='none'"
              style="background:#F3F4F6;border:none;border-radius:8px;padding:6px 10px;
              cursor:pointer;color:#6B7280;font-size:16px">✕</button>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Do'kon nomi *</label>
              <input id="sa-new-name" placeholder="Fashion Store" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Egasi ismi *</label>
              <input id="sa-new-owner" placeholder="Alisher Karimov" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Login (email) *</label>
              <input id="sa-new-login" placeholder="alisher@gmail.com" style="${saInputStyle()}"
                oninput="saPreviewLogin()">
              <div id="sa-login-preview" style="font-size:11px;color:#9CA3AF;margin-top:4px"></div>
            </div>
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Telefon raqam</label>
              <input id="sa-new-phone" placeholder="+998 90 123 45 67" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Do'kon paroli *</label>
              <div style="position:relative">
                <input id="sa-new-pass" type="password" placeholder="Kirish paroli" style="${saInputStyle()}">
                <button onclick="var i=document.getElementById('sa-new-pass');i.type=i.type==='password'?'text':'password'"
                  style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                  background:none;border:none;cursor:pointer;color:#9CA3AF;padding:0">
                  <i class="ti ti-eye" style="font-size:15px"></i>
                </button>
              </div>
            </div>
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Do'kon turi *</label>
              <select id="sa-new-shoptype" style="${saInputStyle()}">
                <option value="ikki">🧩 Oyoq kiyim + Kiyim</option>
                <option value="oyoq">👟 Faqat Oyoq kiyim</option>
                <option value="kiyim">👕 Faqat Kiyim-kechak</option>
                <option value="aralash">📦 Boshqa/Universal (kanstovar, aksessuar...)</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Obuna turi</label>
              <select id="sa-new-plan" style="${saInputStyle()}">
                <option value="trial">🧪 Sinov (30 kun)</option>
                <option value="monthly">📅 Oylik</option>
                <option value="yearly">📆 Yillik</option>
                <option value="lifetime">♾️ Umrlik</option>
              </select>
            </div>
            <!-- 2026-07-26: yangi do'kon uchun tarif, narx va valyuta -->
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Obuna tarifi</label>
              <select id="sa-new-tier" style="${saInputStyle()}">
                <option value="pro">Pro (hammasi ochiq)</option>
                <option value="start">Start (bot yopiq)</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Obuna narxi (so'm/oy)</label>
              <input id="sa-new-price" type="number" min="0" step="10000"
                placeholder="Masalan: 349000" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Valyuta rejimi</label>
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
              font-family:inherit;font-size:13px;cursor:pointer;color:#6B7280;font-weight:600">
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
    b.style.color      = on ? "#0D1B2A" : "#6B7280";
  });
  renderSaShops();
}

// ── Do'konlar jadvali ─────────────────────────────
function renderSaShops() {
  const el = document.getElementById("sa-shops-list"); if (!el) return;
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
    el.innerHTML = `<div style="text-align:center;padding:60px;color:#9CA3AF;font-size:14px">
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
          <th style="text-align:left;padding:10px 16px;color:#6B7280;font-size:11px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Do'kon</th>
          <th style="text-align:left;padding:10px 16px;color:#6B7280;font-size:11px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Egasi · Login</th>
          <th style="text-align:left;padding:10px 16px;color:#6B7280;font-size:11px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Obuna</th>
          <th style="text-align:left;padding:10px 16px;color:#6B7280;font-size:11px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Muddat</th>
          <th style="text-align:left;padding:10px 16px;color:#6B7280;font-size:11px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Faollik</th>
          <th style="text-align:left;padding:10px 16px;color:#6B7280;font-size:11px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700">Holat</th>
          <th style="padding:10px 16px;color:#6B7280;font-size:11px;
            text-transform:uppercase;letter-spacing:.05em;font-weight:700;text-align:center">Amallar</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(s => {
          const active  = saIsActive(s);
          const expired = saIsExpired(s);
          const statusBg   = active ? "#ECFDF5" : expired ? "#FEF2F2" : "#FFFBEB";
          const statusClr  = active ? "#059669" : expired ? "#DC2626" : "#D97706";
          const statusText = active ? "✅ Faol" : expired ? "❌ Muddati o'tgan" : "🧪 Sinov";
          const expDate = s.expiresAt ? s.expiresAt.slice(0,10) : "—";
          const planClr = planColors[s.plan] || "#6B7280";
          const login = s.ownerEmail || (s.phone ? s.phone.replace(/\D/g,"")+"@merx.uz" : "—");

          return `<tr style="border-bottom:1px solid #F3F4F6;transition:background .1s"
            onmouseover="this.style.background='#F9FAFB'" onmouseout="this.style.background=''">
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
                    <span style="font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:20px;
                      margin-left:6px;vertical-align:middle;
                      background:${(s.tier||"pro")==="pro" ? "#0D1B2A" : "#FEF3C7"};
                      color:${(s.tier||"pro")==="pro" ? "#fff" : "#92400E"}">
                      ${(s.tier||"pro")==="pro" ? "PRO" : "START"}
                    </span>
                    ${s.priceUzs ? `<span style="font-size:10px;color:#6B7280;margin-left:5px">
                      ${Number(s.priceUzs).toLocaleString("ru-RU")} so'm/oy</span>` : ""}
                  </div>
                  <div style="font-size:11px;color:#9CA3AF;font-family:monospace">
                    ${s.id.slice(0,24)}...
                  </div>
                </div>
              </div>
            </td>
            <td style="padding:13px 16px">
              <div style="font-weight:600;color:#374151">${s.ownerName || "—"}</div>
              <div style="font-size:12px;color:#6B7280;margin-top:2px">
                <i class="ti ti-mail" style="font-size:11px"></i> ${login}
              </div>
              ${s.phone ? `<div style="font-size:12px;color:#9CA3AF">📞 ${s.phone}</div>` : ""}
            </td>
            <td style="padding:13px 16px">
              <span style="background:${planClr}18;color:${planClr};border:1px solid ${planClr}40;
                border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700">
                ${planLabels[s.plan]||s.plan}
              </span>
            </td>
            <td style="padding:13px 16px;font-size:12px;color:${expired?"#DC2626":"#6B7280"}">
              ${s.plan==="lifetime" ? "<span style='color:#7C3AED;font-weight:700'>♾️ Cheksiz</span>" : expDate}
            </td>
            <td style="padding:13px 16px">
              ${(()=>{
                const st = saGetShopStats(s);
                if (!st) return '<span style="font-size:12px;color:#9CA3AF">Ma\u02BClumo\u02BC yo\u02BCq</span>';
                const lastD = st.lastSale;
                const today2 = new Date().toISOString().slice(0,10);
                const diffDays = lastD ? Math.floor((new Date(today2)-new Date(lastD))/86400000) : null;
                let actClr = "#059669", actTxt = "🟢 Faol";
                if (diffDays===null)       { actClr="#9CA3AF"; actTxt="⚪ Sotuvсиз"; }
                else if (diffDays===0)     { actClr="#059669"; actTxt="🟢 Bugun"; }
                else if (diffDays<=7)      { actClr="#D97706"; actTxt="🟡 "+diffDays+"k oldin"; }
                else if (diffDays<=30)     { actClr="#F97316"; actTxt="🟠 "+diffDays+"k oldin"; }
                else                       { actClr="#DC2626"; actTxt="🔴 "+diffDays+"k oldin"; }
                return '<div style="font-size:12px;font-weight:600;color:'+actClr+'">'+actTxt+'</div>'
                  +(st.todayCnt>0?'<div style="font-size:11px;color:#9CA3AF">Bugun: '+st.todayCnt+' sotuv</div>':'');
              })()}
            </td>
            <td style="padding:13px 16px">
              <span style="background:${statusBg};color:${statusClr};
                border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600">
                ${statusText}
              </span>
            </td>
            <td style="padding:13px 16px">
              <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
                <button onclick="saOpenShop('${s.id}')" title="Do'konga kirish"
                  style="background:#E9A500;border:none;color:#0D1B2A;border-radius:7px;
                  padding:6px 10px;font-size:12px;cursor:pointer;font-weight:700">
                  🔑</button>
                <button onclick="saCopyBotLink('${s.id}')" title="Bot havolasini nusxalash"
                  style="background:#ECFDF5;border:1px solid #BBF7D0;color:#059669;
                  border-radius:7px;padding:6px 10px;font-size:12px;cursor:pointer"
                  title="Bot havola">🔗</button>
                <button onclick="saCopyOwnerLink('${s.id}')"
                  style="background:#FEF3C7;border:1px solid #FDE68A;color:#B45309;
                  border-radius:7px;padding:6px 10px;font-size:12px;cursor:pointer"
                  title="EGA havolasi — do'kon egasini botga ulash">👑</button>
                <button onclick="saEditShopFull('${s.id}')" title="Tahrirlash"
                  style="background:#EFF6FF;border:1px solid #BFDBFE;color:#2563EB;
                  border-radius:7px;padding:6px 10px;font-size:12px;cursor:pointer">✏️</button>
                <button onclick="saOpenBackups('${s.id}','${(s.name||'').replace(/'/g,'')}')" title="Zaxiralar (tiklash)"
                  style="background:#F5F3FF;border:1px solid #DDD6FE;color:#7C3AED;
                  border-radius:7px;padding:6px 10px;font-size:12px;cursor:pointer">🗄️</button>
                <button onclick="saToggleShop('${s.id}')" title="${active?'Bloklash':'Faollashtirish'}"
                  style="background:${active?"#FEF2F2":"#ECFDF5"};
                  border:1px solid ${active?"#FECACA":"#BBF7D0"};
                  color:${active?"#DC2626":"#059669"};
                  border-radius:7px;padding:6px 10px;font-size:12px;cursor:pointer">
                  ${active ? "🔒" : "✅"}</button>
                <button onclick="saDeleteShop('${s.id}')" title="O'chirish"
                  style="background:#FEF2F2;border:1px solid #FECACA;color:#DC2626;
                  border-radius:7px;padding:6px 10px;font-size:12px;cursor:pointer">🗑️</button>
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
    const m = JSON.parse(localStorage.getItem("merx_v5") || "{}");
    _url = m?.settings?.supabaseUrl || "";
    _key = m?.settings?.supabaseKey || "";
  } catch(e) {}
  if (!_url && typeof MERX_SUPABASE_URL !== "undefined") _url = MERX_SUPABASE_URL;
  if (!_key && typeof MERX_SUPABASE_KEY !== "undefined") _key = MERX_SUPABASE_KEY;

  // Bo'sh DB yaratish
  // Asosiy do'kon bot sozlamalarini olamiz
  let _mainBotUrl = "", _mainBotUser = "";
  try {
    const _mdb = JSON.parse(localStorage.getItem("merx_v5") || "{}");
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
      const m=JSON.parse(localStorage.getItem("merx_v5")||"{}");
      botUsername=(m?.settings?.telegramBotUsername||"").replace(/^@/,"").trim();
      if (botUsername.includes("@")||botUsername.includes(".")) botUsername="";
    } catch(e){}
    const link=botUsername?`https://t.me/${botUsername}?start=${shopId}`:"";
    const d=document.createElement("div");
    d.style.cssText="position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif";
    d.innerHTML=`<div style="background:#fff;border-radius:16px;padding:28px;width:440px;max-width:95vw;box-shadow:0 24px 60px rgba(0,0,0,.3)">
      <div style="font-size:16px;font-weight:800;color:#0D1B2A;margin-bottom:16px">✅ Do'kon yaratildi</div>
      <div style="background:#F9FAFB;border-radius:10px;padding:14px;font-size:13px;line-height:2;margin-bottom:16px">
        <div><span style="color:#6B7280">Do'kon:</span> <strong>${name}</strong></div>
        <div><span style="color:#6B7280">Login:</span> <strong style="font-family:monospace">${loginEmail}</strong></div>
        <div><span style="color:#6B7280">Parol:</span> <strong style="font-family:monospace">${pass}</strong></div>
        <div><span style="color:#6B7280">Obuna:</span> <strong>${plan}</strong></div>
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
  }, 300);
}

// ── Supabase'dan do'konlarni yuklash ─────────────
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
      ownerName:   local.ownerName || "",
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
    if (dashEl) dashEl.innerHTML = buildSaDashboard();
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

  let url = "", key2 = "";
  try { const m = JSON.parse(localStorage.getItem("merx_v5")||"{}"); url=m?.settings?.supabaseUrl||""; key2=m?.settings?.supabaseKey||""; } catch(e) {}
  if (!url && typeof MERX_SUPABASE_URL !== "undefined") url  = MERX_SUPABASE_URL;
  if (!key2 && typeof MERX_SUPABASE_KEY !== "undefined") key2 = MERX_SUPABASE_KEY;

  if (!localStorage.getItem(dbKey)) {
    // Yangi do'kon — bo'sh DB yaratamiz
    const shopDB = {
      shop: { name: s.name, type: s.shop_type || s.shopType || "ikki" },
      settings: {
        rate: 12800,
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
      existing.settings.supabaseUrl = url;
      existing.settings.supabaseKey = key2;
      // adminEmail/adminPass — do'kon egasidan olamiz, asosiy do'kondan emas
      if (!existing.settings.adminEmail)
        existing.settings.adminEmail = s.ownerEmail || (s.phone ? s.phone.replace(/\D/g,"")+"@merx.uz" : id+"@merx.uz");
      if (!existing.settings.adminPass)
        existing.settings.adminPass = await saSha256(s.ownerPass || "merx123");
      // Bot sozlamalari — faqat yangi do'konda yo'q bo'lsa
      try {
        const mainDB = JSON.parse(localStorage.getItem("merx_v5") || "{}");
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
        <div style="font-size:16px;font-weight:800;color:#0D1B2A">✏️ Do'konni tahrirlash</div>
        <button onclick="document.getElementById('sa-edit-modal').remove()"
          style="background:#F3F4F6;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;color:#6B7280;font-size:16px">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div style="grid-column:1/-1">
          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Do'kon nomi *</label>
          <input id="se-name" value="${s.name||""}" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Egasi ismi</label>
          <input id="se-owner" value="${s.ownerName||""}" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Telefon raqam</label>
          <input id="se-phone" value="${s.phone||""}" placeholder="+998 90 123 45 67" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Login (email)</label>
          <input id="se-login" value="${s.ownerEmail||""}" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Yangi parol (bo'sh = o'zgarmaydi)</label>
          <input id="se-pass" type="password" placeholder="••••••••" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Do'kon turi</label>
          <select id="se-shoptype" style="${iStyle}">${shopTypeOpts}</select>
        </div>
                <div>
          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">
            Obuna tarifi
          </label>
          <select id="se-tier" style="${iStyle}">
            <option value="start"${(s.tier||"pro")==="start"?" selected":""}>Start (bot yopiq)</option>
            <option value="pro"${(s.tier||"pro")==="pro"?" selected":""}>Pro (hammasi ochiq)</option>
          </select>
          <div style="font-size:10.5px;color:#9CA3AF;margin-top:4px;line-height:1.4">
            Start: bot, portal, Telegram chek va eslatmalar YOPIQ
          </div>
        </div>
        <div>
          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">
            Obuna narxi (so'm/oy)
          </label>
          <input id="se-price" type="number" min="0" step="10000"
            value="${s.priceUzs || ""}" placeholder="Masalan: 349000" style="${iStyle}">
        </div>
        <div>
          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">
            Valyuta rejimi
          </label>
          <select id="se-curmode" style="${iStyle}">
            <option value="uzs"${(s.currencyMode||"multi")==="uzs"?" selected":""}>So'm (faqat so'm)</option>
            <option value="usd"${(s.currencyMode||"multi")==="usd"?" selected":""}>Dollar (faqat $)</option>
            <option value="multi"${(s.currencyMode||"multi")==="multi"?" selected":""}>Ko'p valyutali (do'kon tanlaydi)</option>
          </select>
          <div style="font-size:10.5px;color:#9CA3AF;margin-top:4px;line-height:1.4">
            So'm yoki Dollar tanlansa — do'kon egasi valyutani o'zgartira olmaydi
          </div>
        </div>
<div>
          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Obuna turi</label>
          <select id="se-plan" style="${iStyle}" onchange="var d=document.getElementById('se-expires');if(this.value==='lifetime'){d.value='';d.disabled=true;}else{d.disabled=false;}">${planOpts}</select>
        </div>
        <div>
          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Muddat tugashi</label>
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
          font-family:inherit;font-size:13px;cursor:pointer;color:#6B7280;font-weight:600">
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
    const today = new Date().toISOString().slice(0,10);
    const m = today.slice(0,7);
    const monthSales = sales.filter(s=>s.date?.startsWith(m));
    const todaySales = sales.filter(s=>s.date===today);
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
  const stats = saGetShopStats(shop);
  document.getElementById("sa-stats-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "sa-stats-modal";
  modal.style.cssText = `position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;
    backdrop-filter:blur(4px)`;
  const fmt = n => n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?(n/1000).toFixed(0)+"K":String(n||0);
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
      ${!stats ? `<div style="padding:48px;text-align:center;color:#9CA3AF">
          <i class="ti ti-database-off" style="font-size:40px;display:block;margin-bottom:12px"></i>
          Bu do'konda hali ma'lumot yuklanmagan</div>` : `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#E5E7EB">
        ${[
          {lbl:"Jami sotuv",   val:fmt(stats.totalRev)+" so'm", clr:"#059669"},
          {lbl:"Bu oy tushum", val:fmt(stats.monthRev)+" so'm", clr:"#2563EB"},
          {lbl:"Taxminiy foyda",val:fmt(stats.profit)+" so'm",  clr:stats.profit>=0?"#D97706":"#DC2626"},
          {lbl:"Sotuvlar",     val:stats.salesCnt+" ta",         clr:"#374151"},
          {lbl:"Mijozlar",     val:stats.custCnt+" ta",          clr:"#374151"},
          {lbl:"Qarz jami",    val:fmt(stats.totalDebt)+" so'm", clr:"#DC2626"},
          {lbl:"Mahsulotlar",  val:stats.prodCnt+" xil",         clr:"#374151"},
          {lbl:"Qoldiq",       val:stats.stockCnt+" dona",       clr:"#374151"},
          {lbl:"Bu oy sotuv",  val:stats.monthCnt+" ta",         clr:"#2563EB"},
        ].map(k=>`<div style="background:#fff;padding:14px 18px">
          <div style="font-size:11px;color:#9CA3AF;font-weight:600;margin-bottom:4px;text-transform:uppercase">${k.lbl}</div>
          <div style="font-size:15px;font-weight:800;color:${k.clr}">${k.val}</div>
        </div>`).join("")}
      </div>
      <div style="padding:14px 20px;background:#F9FAFB;display:flex;gap:8px;flex-wrap:wrap">
        ${[
          {lbl:"Obuna",   val:planL[shop.plan]||shop.plan},
          {lbl:"Muddat",  val:shop.plan==="lifetime"?"♾️":(shop.expiresAt?.slice(0,10)||"—")},
          {lbl:"Holat",   val:saIsActive(shop)?"✅ Faol":"❌ Nofaol"},
          {lbl:"Qo'shildi",val:shop.createdAt?.slice(0,10)||"—"},
        ].map(k=>`<div style="background:#fff;border:1px solid #E5E7EB;border-radius:8px;padding:8px 14px">
          <div style="font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;margin-bottom:3px">${k.lbl}</div>
          <div style="font-size:13px;font-weight:700;color:#111827">${k.val}</div>
        </div>`).join("")}
      </div>
      <div style="padding:14px 20px;border-top:1px solid #E5E7EB;display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="saOpenShop('${shop.id}');document.getElementById('sa-stats-modal').remove()"
          style="background:#0D1B2A;border:none;color:#E9A500;border-radius:8px;padding:9px 16px;
          font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
          🔑 Kirish</button>
        <button onclick="saCopyBotLink('${shop.id}')"
          style="background:#ECFDF5;border:1px solid #BBF7D0;color:#059669;
          border-radius:8px;padding:9px 16px;font-family:inherit;font-size:13px;cursor:pointer;font-weight:600">
          🔗 Bot havolasi</button>
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
  const botUrl = (()=>{ try { return JSON.parse(localStorage.getItem("merx_v5")||"{}").settings?.telegramBotUrl||""; } catch(e){return "";} })();
  if (!botUrl) return;
  try {
    const res = await fetch(botUrl+"?action=send_owner_notif", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ shopId:shop.id, ownerEmail:shop.ownerEmail, ownerPhone:shop.phone, text })
    });
    const data = await res.json();
    if (data.sent) showSaToast("📨 Egasiga xabar yuborildi");
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
function saCopyBotLink(shopId) {
  // Bot username — asosiy do'kon settings dan olamiz
  let botUsername = "";
  try {
    const mainDB = JSON.parse(localStorage.getItem("merx_v5") || "{}");
    botUsername = (mainDB?.settings?.telegramBotUsername || "").replace(/^@/,"").trim();
    // Email bo'lsa tozalaymiz
    if (botUsername.includes("@") || botUsername.includes(".")) botUsername = "";
  } catch(e) {}

  if (!botUsername) {
    showSaToast("Bot username sozlanmagan — Asosiy do'kon Sozlamalar → SMS & Bot", "err");
    return;
  }

  const link = `https://t.me/${botUsername}?start=${shopId}`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(() => {
      showSaToast("✅ Havola nusxa olindi: " + link);
    });
  } else {
    const t = document.createElement("textarea");
    t.value = link; document.body.appendChild(t);
    t.select(); document.execCommand("copy");
    document.body.removeChild(t);
    showSaToast("✅ Havola nusxa olindi!");
  }
}

// ══════════════════════════════════════════════════════════════
// EGA HAVOLASI (2026-07-30)
// ══════════════════════════════════════════════════════════════
// Yangi do'kon egasini botga ulash uchun. Oddiy bot havolasidan
// farqi: `own_` prefiksi bilan ketadi va bot uni EGA sifatida
// ro'yxatdan o'tkazadi (shop_owners + bot_sessions.is_owner=true).
//
// Nega kerak: avval yangi do'kon egasi ega bo'lib TANILISHINING yo'li
// yo'q edi — shop_owners ga yozish `if (isOwner)` ichida turardi,
// ya'ni ega bo'lish uchun avval ega bo'lish kerak edi.
//
// Havola BIR MARTA ishlaydi: do'konda ega ro'yxatdan o'tgach kuchini
// yo'qotadi.
//
// Eslatma: bot username o'qish mantiqi saCopyBotLink da ham bor.
// Ataylab takrorlandi — ishlab turgan funksiyaga tegmaslik uchun.
// Keyinchalik ikkalasini shu yordamchiga o'tkazsa bo'ladi.
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
    const mainDB = JSON.parse(localStorage.getItem("merx_v5") || "{}");
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
function saShowInactiveShops() {
  const inactive = _saShops.filter(s => {
    const st = saGetShopStats(s); if (!st) return false;
    return !st.isActive30;
  });

  if (!inactive.length) { showSaToast("Barcha do'konlar faol ✅"); return; }

  const list = inactive.map(s => {
    const st = saGetShopStats(s);
    const last = st?.lastSale || "hech qachon";
    return `• ${s.name} — oxirgi sotuv: ${last}`;
  }).join("\n");

  alert(`😴 Faolsiz do'konlar (30 kunda sotuvsiz, ${inactive.length} ta):\n\n${list}`);
}

// ── Super admin paroli o'zgartirish ───────────────
// ── Super admin paroli o'zgartirish ───────────────
// SA parol endi serverda (Vercel ENV: MERX_SA_PASS) tekshiriladi.
function saChangeSuperPass() {
  showSaToast("SA parolini o'zgartirish: Vercel > Settings > Environment Variables > MERX_SA_PASS", "err");
}

// ── Do'kon almashtirish (eski funksiya — saOpenShop bilan bir xil) ──
function saSwitchToShop(shopId) { saOpenShop(shopId); }

// ── SA ko'rish banneri ────────────────────────────
function saReturnToMainShop() {
  const prevKey = sessionStorage.getItem("merx_prev_shop") || "merx_v5";
  sessionStorage.setItem("merx_active_shop", prevKey);
  sessionStorage.removeItem("merx_is_sa_view");
  sessionStorage.removeItem("merx_prev_shop");
  localStorage.removeItem("merx_auth_v1");
  window.location.reload();
}

function renderSaViewBanner() {
  const isSaView = sessionStorage.getItem("merx_is_sa_view") === "1";
  if (!isSaView) return;
  if (document.getElementById("sa-view-banner")) return;
  const banner = document.createElement("div");
  banner.id = "sa-view-banner";
  banner.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:9999;
    background:linear-gradient(90deg,#4c1d95,#7c3aed);
    color:#fff;padding:8px 20px;font-family:'DM Sans',sans-serif;
    font-size:13px;font-weight:600;display:flex;align-items:center;gap:12px;
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
  document.body.prepend(banner);
  const main=document.getElementById("main"), sb=document.getElementById("sb");
  if (main) main.style.paddingTop="36px";
  if (sb)   sb.style.paddingTop="36px";
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
function saOpenPriceSettings() {
  document.getElementById("sa-price-modal")?.remove();
  const prices = (() => {
    try { return JSON.parse(localStorage.getItem("merx_sa_prices")||"{}"); } catch(e){ return {}; }
  })();
  const monthly  = prices.monthly  || 50000;
  const yearly   = prices.yearly   || 500000;

  const modal = document.createElement("div");
  modal.id = "sa-price-modal";
  modal.style.cssText = "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif";
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;width:400px;max-width:95vw;box-shadow:0 24px 60px rgba(0,0,0,.25)">
      <div style="font-size:16px;font-weight:800;color:#0D1B2A;margin-bottom:20px">💳 Obuna narxlari</div>
      <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px">
        <div>
          <label style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;display:block;margin-bottom:5px">📅 Oylik narx (so'm)</label>
          <input id="sa-price-monthly" type="number" value="${monthly}" step="10000"
            style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:8px;padding:10px 12px;font-family:inherit;font-size:15px;font-weight:700">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;display:block;margin-bottom:5px">📆 Yillik narx (so'm)</label>
          <input id="sa-price-yearly" type="number" value="${yearly}" step="50000"
            style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:8px;padding:10px 12px;font-family:inherit;font-size:15px;font-weight:700">
        </div>
        <div style="background:#F0FDF4;border-radius:8px;padding:10px 14px;font-size:12px;color:#065F46">
          Ushbu narxlar dashboard da ko\'rsatiladigan taxminiy daromad hisoblash uchun
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="saSavePriceSettings()"
          style="flex:1;background:#0D1B2A;border:none;border-radius:10px;padding:12px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;color:#E9A500">
          ✓ Saqlash
        </button>
        <button onclick="document.getElementById('sa-price-modal').remove()"
          style="background:#F3F4F6;border:none;border-radius:10px;padding:12px 18px;font-family:inherit;font-size:13px;cursor:pointer;color:#6B7280">
          Bekor
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function saSavePriceSettings() {
  const monthly = parseInt(document.getElementById("sa-price-monthly")?.value)||50000;
  const yearly  = parseInt(document.getElementById("sa-price-yearly")?.value)||500000;
  localStorage.setItem("merx_sa_prices", JSON.stringify({monthly,yearly}));
  document.getElementById("sa-price-modal")?.remove();
  showSaToast("✅ Narxlar saqlandi");
  // Dashboard yangilaymiz
  const dash = document.getElementById("sa-dashboard");
  if (dash) dash.innerHTML = buildSaDashboard();
}

// ── Obuna tekshiruvi ──────────────────────────────
// 2026-07-30 QAYTA YOZILDI. Avvalgi variant `sessionStorage`dagi
// "merx_active_shop" kalitiga tayanardi — u kalit KOD BO'YICHA HECH
// QAYERDA YOZILMASDI, shuning uchun funksiya har safar birinchi
// qatorda chiqib ketardi. Natija: SuperAdmin do'konni bloklasa ham
// do'kon egasi hech narsa sezmasdi.
//
// Endi holat BULUTDAN (server hukmi bilan) olinadi:
//   /api/auth-v2?action=shop_status  →  ok | blocked | expired | unknown
//
// Himoyalar:
//  · Internet yo'q bo'lsa — oxirgi ma'lum holat ishlatiladi
//  · Hech qachon tekshirilmagan bo'lsa — CHEKLANMAYDI (fail-open)
//  · SuperAdmin "do'kon sifatida kirish" rejimida devor chiqmaydi
async function checkCurrentShopSubscription() {
  // 1) SuperAdmin ko'rinishi — cheklov qo'llanmaydi
  try {
    const u = JSON.parse(localStorage.getItem("merx_auth_v1") || "{}");
    if (u && (u.saAccess === true || u.role === "superadmin")) return;
  } catch(e) {}

  // 2) Do'kon ID — busiz tekshirib bo'lmaydi (faqat lokal rejim)
  const sid = (typeof getCloudShopId === "function") ? getCloudShopId() : null;
  if (!sid) return;

  const CK = "merx_sub_status_" + sid;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(CK) || "null"); } catch(e) {}

  // 3) Serverdan so'raymiz
  let fresh = null;
  try {
    const r = await fetch("/api/auth-v2?action=shop_status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId: sid })
    });
    const d = await r.json();
    if (d && d.ok && d.status) {
      fresh = d;
      try {
        localStorage.setItem(CK, JSON.stringify({
          status: d.status, daysLeft: d.days_left,
          name: d.name, expiresAt: d.expires_at, at: Date.now()
        }));
      } catch(e) {}
    }
  } catch(e) { /* internet yo'q — pastda oxirgi ma'lum holat ishlatiladi */ }

  // 4) Hukm. Server ham, kesh ham yo'q bo'lsa — "ok" (fail-open)
  const status   = (fresh && fresh.status)     || (cached && cached.status)   || "ok";
  const daysLeft = (fresh ? fresh.days_left    : (cached ? cached.daysLeft   : null));
  const shopInfo = {
    name:      (fresh && fresh.name) || (cached && cached.name) || db?.shop?.name || "Do'kon",
    expiresAt: (fresh && fresh.expires_at) || (cached && cached.expiresAt) || null,
    plan:      (fresh && fresh.plan) || null
  };

  if (status === "blocked") { showSubscriptionWall("blocked", shopInfo); return; }
  if (status === "expired") { showSubscriptionWall("expired", shopInfo); return; }

  // Devor yo'q — agar avval chiqarilgan bo'lsa olib tashlaymiz
  // (masalan SuperAdmin faollashtirgan bo'lsa)
  if (status === "ok") {
    const w = document.getElementById("sub-wall");
    if (w) { w.remove(); const a = document.getElementById("app"); if (a) a.style.display = ""; }
    if (daysLeft != null && daysLeft <= 3) showSubscriptionWarning(daysLeft, shopInfo);
  }
}

// Har 30 daqiqada qayta tekshiramiz — aks holda kun bo'yi ochiq
// turgan ilovada bloklash faqat sahifa yangilangach ta'sir qilardi.
setInterval(() => {
  try { checkCurrentShopSubscription(); } catch(e) {}
}, 30 * 60 * 1000);

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

function saWallLogout() {
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
  el.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:9998;
    background:#92400E;color:#FDE68A;padding:8px 20px;font-family:'DM Sans',sans-serif;
    font-size:13px;font-weight:600;display:flex;align-items:center;
    justify-content:center;gap:12px`;
  el.innerHTML = `⚠️ Obuna muddati ${daysLeft} kun ichida tugaydi!
    <button onclick="this.parentElement.remove()"
      style="background:transparent;border:none;color:#FDE68A;cursor:pointer;font-size:16px">✕</button>`;
  document.body.prepend(el);
  const main=document.getElementById("main"), sb=document.getElementById("sb");
  if (main) main.style.paddingTop=(parseInt(main.style.paddingTop)||0)+36+"px";
  if (sb)   sb.style.paddingTop  =(parseInt(sb.style.paddingTop)||0)+36+"px";
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
          <div style="font-size:16px;font-weight:800;color:#E9A500">🗄️ Zaxiralar</div>
          <div style="font-size:12px;color:#6B8096;margin-top:2px">${_saBackupShopName}</div>
        </div>
        <button onclick="document.getElementById('sa-backups-modal').remove()"
          style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
          color:#fff;border-radius:8px;padding:6px 12px;font-family:inherit;cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="padding:14px 18px 6px;font-size:12px;color:#9CA3AF">
        Tiklash joriy ma'lumot ustiga yozadi. Faqat zarur bo'lganda ishlating.
      </div>
      <div id="sa-backups-list" style="padding:8px 18px 20px;max-height:380px;overflow-y:auto">
        <div style="text-align:center;padding:26px;color:#9CA3AF">
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
          <div style="font-size:12px;color:#9CA3AF">${b.records||0} ta yozuv</div>
        </div>
        <button onclick="saDoRestore(${b.id},'${b.date}')"
          style="background:#7C3AED;border:none;color:#fff;border-radius:8px;
          padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer">Tiklash</button>
      </div>`).join("") :
      `<div style="text-align:center;padding:30px;color:#9CA3AF">
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
    const m = JSON.parse(localStorage.getItem("merx_v5") || "{}");
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
  const _saBoot = () => setTimeout(saRestorePanelIfLoggedIn, 400);
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
          style="background:none;border:none;font-size:24px;cursor:pointer;color:#9CA3AF">×</button>
      </div>
      <p style="font-size:12.5px;color:#6B7280;margin:0 0 20px;line-height:1.5">
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
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:4px">
                NARX (so'm)</label>
              <input id="tf-price-${t.tier}" type="number" min="0" step="10000"
                value="${t.price_uzs || 0}" style="${iSt};font-weight:800">
            </div>
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:4px">
                DAVR</label>
              <input id="tf-period-${t.tier}" value="${t.period || "oyiga"}" style="${iSt}">
            </div>
          </div>

          <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:4px">
            IMKONIYATLAR <span style="font-weight:400">(har qator — alohida band)</span></label>
          <textarea id="tf-feat-${t.tier}" rows="6" style="${iSt};resize:vertical;line-height:1.5"
            >${(Array.isArray(t.features) ? t.features : []).join("\\n")}</textarea>

          <button onclick="saSaveTariff('${t.tier}')"
            style="width:100%;margin-top:12px;background:#0D1B2A;color:#fff;border:none;
            border-radius:9px;padding:11px;font-weight:700;font-size:14px;cursor:pointer">
            ✓ ${t.title || t.tier} tarifini saqlash
          </button>
        </div>`).join("") : `
        <div style="text-align:center;padding:30px;color:#9CA3AF">
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
