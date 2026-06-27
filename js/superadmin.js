// ════════════════════════════════════════════════
// MERX — js/superadmin.js | v4.0 | 2026-06-24
// Super Admin paneli — faqat sayt egasi uchun
// ════════════════════════════════════════════════

const SA_KEY     = "merx_superadmin_v1";
const SA_TS_KEY  = "merx_sa_ts";
const SA_TIMEOUT = 4 * 60 * 60 * 1000;
const SHOPS_KEY  = "merx_shops_v1";

let _saSession = null;
let _saShops   = [];
let _saFilter  = "Barchasi";

// ── Session ──────────────────────────────────────
function saLoad() {
  try {
    const raw = localStorage.getItem(SA_KEY);
    const ts  = parseInt(localStorage.getItem(SA_TS_KEY) || "0");
    if (raw && Date.now() - ts < SA_TIMEOUT) _saSession = JSON.parse(raw);
    else { _saSession = null; localStorage.removeItem(SA_KEY); }
  } catch(e) { _saSession = null; }
}

function saSave() {
  localStorage.setItem(SA_KEY, JSON.stringify(_saSession));
  localStorage.setItem(SA_TS_KEY, Date.now().toString());
}

function saLogout() {
  _saSession = null;
  localStorage.removeItem(SA_KEY);
  localStorage.removeItem(SA_TS_KEY);
  hideSaPanel();
}

function saLoadShops() {
  try { _saShops = JSON.parse(localStorage.getItem(SHOPS_KEY) || "[]"); }
  catch(e) { _saShops = []; }
}

function saSaveShops() {
  localStorage.setItem(SHOPS_KEY, JSON.stringify(_saShops));
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
  }
}

function hideSaPanel() {
  document.getElementById("sa-overlay")?.remove();
}

function saDoLogin() {
  const pass    = document.getElementById("sa-pass")?.value || "";
  const errEl   = document.getElementById("sa-err");
  const correct = db.settings?.superAdminPin || "merx2024";
  if (pass !== correct) {
    if (errEl) { errEl.textContent = "Parol noto'g'ri"; errEl.style.display = "block"; }
    if (document.getElementById("sa-pass")) document.getElementById("sa-pass").value = "";
    return;
  }
  _saSession = { loggedIn: true, ts: Date.now() };
  saSave(); saLoadShops();
  const overlay = document.getElementById("sa-overlay");
  if (overlay) { overlay.innerHTML = buildSaPanel(); renderSaShops(); }
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
                <option value="aralash">🔀 Aralash (boshqa)</option>
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
            <div>
              <label style="font-size:11px;color:#6B7280;font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase">Modullar</label>
              <select id="sa-new-modules" multiple style="${saInputStyle()} height:76px">
                <option value="pos" selected>📦 POS · Sotuv</option>
                <option value="ombor" selected>🏭 Ombor</option>
                <option value="hisobot" selected>📊 Hisobot</option>
                <option value="sms">📱 SMS (Eskiz)</option>
                <option value="cloud">☁️ Cloud sync</option>
              </select>
            </div>
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
                  <div style="color:#0D1B2A;font-weight:700">${s.name}</div>
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
                <button onclick="saEditShopFull('${s.id}')" title="Tahrirlash"
                  style="background:#EFF6FF;border:1px solid #BFDBFE;color:#2563EB;
                  border-radius:7px;padding:6px 10px;font-size:12px;cursor:pointer">✏️</button>
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

function saAddShop() {
  const name    = document.getElementById("sa-new-name")?.value.trim();
  const owner   = document.getElementById("sa-new-owner")?.value.trim();
  const rawLogin= document.getElementById("sa-new-login")?.value.trim();
  const pass    = document.getElementById("sa-new-pass")?.value.trim();
  const plan    = document.getElementById("sa-new-plan")?.value || "trial";
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
  const shopId = "shop_" + Date.now();
  const dbKey  = "merx_v5_" + shopId;

  const newShop = {
    id: shopId, name, ownerName: owner,
    ownerEmail: loginEmail,
    phone: phone,
    ownerPass: pass, plan, modules, shopType,
    expiresAt: expires, createdAt: now.toISOString(),
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
      adminEmail: loginEmail, adminPass: pass, modules,
      supabaseUrl: _url, supabaseKey: _key,
      telegramBotUrl: _mainBotUrl,
      telegramBotUsername: _mainBotUser,
    },
    customers:[], products:[], sales:[], staff:[],
    ombor:[], xarajatlar:[], debtPayments:[], shifts:[],
    kassaBalances:{}, seq: 1
  };
  localStorage.setItem(dbKey, JSON.stringify(shopDB));

  // Supabase ga yozish
  _saAddShopToSupabase(newShop).catch(e => console.warn("Supabase shops sync xato:", e.message));

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

// ── Supabase ga yozish ────────────────────────────
async function _saAddShopToSupabase(shop) {
  if (!_sb && typeof initSupabase === "function") await initSupabase();
  if (!_sb) return;
  try {
    await _sb.from("shops").upsert({
      id: shop.id, name: shop.name, owner_email: shop.ownerEmail,
      plan: shop.plan, active: !shop.blocked,
      trial_ends: shop.expiresAt ? shop.expiresAt.slice(0,10) : null
    });
    try {
      await _sb.from("settings").upsert({
        shop_id: shop.id, shop_name: shop.name,
        rate: 12800, price_currency: "uzs"
      });
    } catch(e2) { console.warn("settings upsert:", e2.message); }
  } catch(e) { console.warn("shops upsert xato:", e.message); }
}

// ── Do'konga kirish ───────────────────────────────
function saOpenShop(id) {
  const s = _saShops.find(x => x.id === id); if (!s) return;
  const dbKey = "merx_v5_" + id;

  let url = "", key2 = "";
  try { const m = JSON.parse(localStorage.getItem("merx_v5")||"{}"); url=m?.settings?.supabaseUrl||""; key2=m?.settings?.supabaseKey||""; } catch(e) {}
  if (!url && typeof MERX_SUPABASE_URL !== "undefined") url  = MERX_SUPABASE_URL;
  if (!key2 && typeof MERX_SUPABASE_KEY !== "undefined") key2 = MERX_SUPABASE_KEY;

  if (!localStorage.getItem(dbKey)) {
    // Yangi do'kon — bo'sh DB yaratamiz
    const shopDB = {
      shop: { name: s.name, type: s.shopType || "ikki" },
      settings: {
        rate: 12800, priceCurrency: "uzs",
        shopType: s.shopType || "ikki",
        cloudShopId: id,
        adminEmail: s.ownerEmail || (s.phone ? s.phone.replace(/\D/g,"")+"@merx.uz" : id+"@merx.uz"),
        adminPass: s.ownerPass || "merx123",
        supabaseUrl: url, supabaseKey: key2
      },
      customers:[],products:[],sales:[],staff:[],
      ombor:[],xarajatlar:[],debtPayments:[],shifts:[],
      kassaBalances:{}, seq:1
    };
    localStorage.setItem(dbKey, JSON.stringify(shopDB));
  } else {
    // Mavjud do'kon — cloudShopId va supabase key ni yangilaymiz
    try {
      const existing = JSON.parse(localStorage.getItem(dbKey));
      if (!existing.settings) existing.settings = {};
      existing.settings.cloudShopId = id;
      existing.settings.supabaseUrl = url;
      existing.settings.supabaseKey = key2;
      // Asosiy do'kon bot sozlamalarini ko'chiramiz (agar yangi do'konda yo'q bo'lsa)
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
  const expires  = document.getElementById("se-expires")?.value;

  if (!name) { showSaToast("Do'kon nomini kiriting", "err"); return; }

  s.name      = name;
  s.ownerName = owner || s.ownerName;
  s.phone     = phone;
  s.shopType  = shopType;
  s.plan      = plan;
  if (login)                  s.ownerEmail = login;
  if (pass && pass.length>=4) s.ownerPass  = pass;
  if (plan === "lifetime")    s.expiresAt  = null;
  else if (expires)           s.expiresAt  = new Date(expires).toISOString();

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
      shopDB.settings.shopType = shopType;
      if (login)                  shopDB.settings.adminEmail = login;
      if (pass && pass.length>=4) shopDB.settings.adminPass  = pass;
      localStorage.setItem(dbKey, JSON.stringify(shopDB));
    }
  } catch(e) {}

  saSaveShops();
  renderSaShops();
  document.getElementById("sa-edit-modal")?.remove();
  showSaToast(`✅ "${name}" yangilandi`);
  // Supabase da ham yangilaymiz
  _saUpdateShopInSupabase(id, { name, owner_email: s.ownerEmail, plan: s.plan,
    trial_ends: s.expiresAt ? s.expiresAt.slice(0,10) : null,
    active: !s.blocked }).catch(e => console.warn("Supabase update xato:", e.message));
}

async function _saUpdateShopInSupabase(shopId, data) {
  if (!_sb && typeof initSupabase === "function") await initSupabase();
  if (!_sb) return;
  await _sb.from("shops").update(data).eq("id", shopId);
}

// ── Eski saEditShop → saEditShopFull ──────────────
function saEditShop(id) { saEditShopFull(id); }

// ── Bloklash / faollashtirish ─────────────────────
function saToggleShop(id) {
  const s = _saShops.find(x => x.id === id); if (!s) return;
  s.blocked = !s.blocked;
  if (!s.blocked && s.plan !== "lifetime") s.expiresAt = addDaysToDate(new Date(), 30);
  saSaveShops(); renderSaShops();
  showSaToast(s.blocked ? `"${s.name}" bloklandi` : `"${s.name}" faollashtirildi`);
  // Supabase da ham yangilaymiz
  _saUpdateShopInSupabase(s.id, { active: !s.blocked })
    .catch(e => console.warn("Supabase toggle xato:", e.message));
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
  _saDeleteShopFromSupabase(id).catch(e => console.warn("Supabase delete xato:", e.message));
}

async function _saDeleteShopFromSupabase(shopId) {
  if (!_sb && typeof initSupabase === "function") await initSupabase();
  if (!_sb) return;
  // active = false qilamiz (to'liq o'chirish xavfli)
  await _sb.from("shops").update({ active: false }).eq("id", shopId);
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
          {lbl:"Mahsulotlar",  val:stats.prodCnt+" tur",         clr:"#374151"},
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
  _saUpdateShopInSupabase(id, { trial_ends: s.expiresAt.slice(0,10) })
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
function saChangeSuperPass() {
  const newPass = document.getElementById("sa-superpass-inp")?.value.trim();
  if (!newPass || newPass.length < 6) { showSaToast("Parol kamida 6 ta belgi", "err"); return; }
  if (!db.settings) db.settings = {};
  db.settings.superAdminPin = newPass;
  saveDB();
  document.getElementById("sa-superpass-inp").value = "";
  showSaToast("✅ Super admin paroli saqlandi");
}

// ── Do'kon almashtirish (eski funksiya — saOpenShop bilan bir xil) ──
function saSwitchToShop(shopId) { saOpenShop(shopId); }

// ── SA ko'rish banneri ────────────────────────────
function saReturnToMainShop() {
  const prevKey = localStorage.getItem("merx_prev_shop") || "merx_v5";
  localStorage.setItem("merx_active_shop", prevKey);
  localStorage.removeItem("merx_is_sa_view");
  localStorage.removeItem("merx_prev_shop");
  localStorage.removeItem("merx_auth_v1");
  window.location.reload();
}

function renderSaViewBanner() {
  const isSaView = localStorage.getItem("merx_is_sa_view") === "1";
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
  const activeKey = localStorage.getItem("merx_active_shop");
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
  const activeKey = db._currentKey || localStorage.getItem("merx_active_shop");
  if (activeKey && activeKey !== "merx_v5") {
    try { localStorage.setItem(activeKey, JSON.stringify(db)); } catch(e) {}
    if (typeof scheduleCloudSync === "function") scheduleCloudSync();
    return;
  }
  if (typeof _origSaveDB === "function") _origSaveDB();
};

(function() {
  const isSaView = localStorage.getItem("merx_is_sa_view") === "1";
  if (isSaView) {
    const loaded = saLoadActiveShop();
    if (!loaded) {
      localStorage.removeItem("merx_is_sa_view");
      localStorage.removeItem("merx_active_shop");
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
function checkCurrentShopSubscription() {
  saLoadShops();
  if (localStorage.getItem("merx_is_sa_view") === "1") return;
  const activeKey = localStorage.getItem("merx_active_shop") || "merx_v5";
  if (activeKey === "merx_v5") return;
  const shop = _saShops.find(s => s.dbKey === activeKey);
  if (!shop) return;
  if (shop.blocked) { showSubscriptionWall("blocked", shop); return; }
  if (saIsExpired(shop)) { showSubscriptionWall("expired", shop); return; }
  if (shop.expiresAt && shop.plan !== "lifetime") {
    const daysLeft = Math.ceil((new Date(shop.expiresAt) - new Date()) / 86400000);
    if (daysLeft <= 3) showSubscriptionWarning(daysLeft, shop);
  }
}

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
  const prevKey = localStorage.getItem("merx_prev_shop");
  if (prevKey) {
    localStorage.setItem("merx_active_shop", prevKey);
    localStorage.removeItem("merx_is_sa_view");
    localStorage.removeItem("merx_prev_shop");
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
  const activeKey = localStorage.getItem("merx_active_shop");
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
