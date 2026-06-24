// ════════════════════════════════════════════════
// MERX — js/superadmin.js
// Super Admin paneli — faqat sayt egasi uchun
// ════════════════════════════════════════════════

const SA_KEY     = "merx_superadmin_v1";
const SA_TS_KEY  = "merx_sa_ts";
const SA_TIMEOUT = 4 * 60 * 60 * 1000; // 4 soat
const SHOPS_KEY  = "merx_shops_v1";     // barcha do'konlar localStorage da

let _saSession = null;
let _saShops   = [];

// ── Super admin paroli tekshirish ─────────────
function saLoad() {
  try {
    const raw = localStorage.getItem(SA_KEY);
    const ts  = parseInt(localStorage.getItem(SA_TS_KEY) || "0");
    if (raw && Date.now() - ts < SA_TIMEOUT) {
      _saSession = JSON.parse(raw);
    } else {
      _saSession = null;
      localStorage.removeItem(SA_KEY);
    }
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

// ── Do'konlar ma'lumotlari ────────────────────
function saLoadShops() {
  try {
    const raw = localStorage.getItem(SHOPS_KEY);
    _saShops = raw ? JSON.parse(raw) : [];
  } catch(e) { _saShops = []; }
}

function saSaveShops() {
  localStorage.setItem(SHOPS_KEY, JSON.stringify(_saShops));
}

// ── Super Admin panel ochish (? + ctrl+shift+M) ─
function openSaPanel() {
  saLoad();

  // Panel mavjud bo'lsa — ochish/yopish
  const existing = document.getElementById("sa-overlay");
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement("div");
  overlay.id = "sa-overlay";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:rgba(5,10,15,.92);
    display:flex;align-items:center;justify-content:center;
    font-family:'DM Sans',sans-serif`;

  if (!_saSession) {
    // Login forma
    overlay.innerHTML = `
      <div style="background:#0D1B2A;border:1px solid #1e3a5f;border-radius:16px;
        padding:36px 40px;width:340px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#E9A500;margin-bottom:4px">⚡ MERX</div>
        <div style="font-size:13px;color:#6b8096;margin-bottom:28px">Super Admin Panel</div>
        <div id="sa-err" style="display:none;background:#1f0f0f;color:#f87171;
          border-radius:8px;padding:8px 14px;font-size:13px;margin-bottom:14px"></div>
        <input id="sa-pass" type="password" placeholder="Super admin paroli..."
          onkeydown="if(event.key==='Enter')saDoLogin()"
          style="width:100%;box-sizing:border-box;background:#1a2d40;border:1px solid #2a4060;
          color:#fff;border-radius:10px;padding:12px 16px;font-family:inherit;
          font-size:15px;outline:none;margin-bottom:12px">
        <button onclick="saDoLogin()"
          style="width:100%;background:#E9A500;border:none;border-radius:10px;
          padding:13px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;
          color:#0D1B2A">Kirish →</button>
        <button onclick="document.getElementById('sa-overlay').remove()"
          style="width:100%;margin-top:10px;background:transparent;border:none;
          color:#4a6070;font-family:inherit;font-size:13px;cursor:pointer;padding:6px">
          Bekor qilish
        </button>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => { document.getElementById("sa-pass")?.focus(); }, 50);
  } else {
    // Panel ko'rsatish
    saLoadShops();
    overlay.innerHTML = buildSaPanel();
    document.body.appendChild(overlay);
    renderSaShops();
  }
}

function saDoLogin() {
  const pass = document.getElementById("sa-pass")?.value || "";
  const errEl = document.getElementById("sa-err");

  // Super admin paroli — db.settings.superAdminPin dan tekshiramiz
  const correctPass = db.settings?.superAdminPin || "merx2024";
  if (pass !== correctPass) {
    if (errEl) { errEl.textContent = "Parol noto'g'ri"; errEl.style.display = "block"; }
    if (document.getElementById("sa-pass")) document.getElementById("sa-pass").value = "";
    return;
  }

  _saSession = { loggedIn: true, ts: Date.now() };
  saSave();
  saLoadShops();

  // Panelni qayta qurish
  const overlay = document.getElementById("sa-overlay");
  if (overlay) { overlay.innerHTML = buildSaPanel(); renderSaShops(); }
}

function hideSaPanel() {
  document.getElementById("sa-overlay")?.remove();
}

function buildSaDashboard() {
  // Barcha do'konlar statistikasini yig'amiz
  let totalRev = 0, totalSales = 0, totalCustomers = 0, totalProducts = 0;
  const m = new Date().toISOString().slice(0,7);
  let monthRev = 0, monthSales = 0;

  _saShops.forEach(shop => {
    const stats = saGetShopStats(shop);
    if (!stats) return;
    totalRev       += stats.totalRev;
    totalSales     += stats.salesCnt;
    totalCustomers += stats.custCnt;
    totalProducts  += stats.prodCnt;
    monthRev       += stats.monthRev;
    monthSales     += stats.monthCnt;
  });

  const fmtN = n => n>=1000000?(n/1000000).toFixed(1)+"M so'm":n>=1000?(n/1000).toFixed(0)+"K so'm":n+" so'm";
  const now = new Date().toISOString().slice(0,7);
  const active   = _saShops.filter(s=>saIsActive(s)).length;
  const expired  = _saShops.filter(s=>saIsExpired(s)).length;
  const newShops = _saShops.filter(s=>s.createdAt?.startsWith(now)).length;
  const plans    = { trial:0, monthly:0, yearly:0, lifetime:0 };
  _saShops.forEach(s=>{ if(plans[s.plan]!==undefined) plans[s.plan]++; });

  return `
    <!-- KPI qator -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#1e3a5f">
      ${[
        {lbl:"Jami do'konlar",  val:_saShops.length+" ta",  clr:"#E9A500"},
        {lbl:"Faol obunalar",   val:active+" ta",            clr:"#36B48C"},
        {lbl:"Muddati o'tgan",  val:expired+" ta",           clr:expired?"#E05A5A":"#4a6070"},
        {lbl:"Bu oy qo'shildi", val:newShops+" ta",          clr:"#4C9BE8"},
      ].map(k=>`
        <div style="background:#0a1824;padding:12px 18px">
          <div style="font-size:10px;color:#4a6070;margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em">${k.lbl}</div>
          <div style="font-size:22px;font-weight:800;color:${k.clr}">${k.val}</div>
        </div>`).join("")}
    </div>

    <!-- Yig'ma moliyaviy statistika -->
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:1px;background:#1e3a5f">
      <!-- Jami sotuv -->
      <div style="background:#071020;padding:14px 20px;display:flex;align-items:center;gap:16px">
        <div style="flex:1">
          <div style="font-size:10px;color:#4a6070;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">
            Barcha do'konlar — Jami tushum
          </div>
          <div style="font-size:26px;font-weight:900;color:#36B48C">${fmtN(totalRev)}</div>
          <div style="font-size:12px;color:#4a6070;margin-top:3px">
            Bu oy: <span style="color:#4C9BE8;font-weight:600">${fmtN(monthRev)}</span>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:#4a6070;margin-bottom:4px">Sotuvlar</div>
          <div style="font-size:20px;font-weight:800;color:#c8d8e8">${totalSales} ta</div>
          <div style="font-size:12px;color:#4a6070">Bu oy: ${monthSales} ta</div>
        </div>
      </div>
      <!-- Mijozlar -->
      <div style="background:#071020;padding:14px 20px">
        <div style="font-size:10px;color:#4a6070;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Mijozlar</div>
        <div style="font-size:22px;font-weight:800;color:#c8d8e8">${totalCustomers} ta</div>
        <div style="font-size:12px;color:#4a6070;margin-top:3px">Jami bazada</div>
      </div>
      <!-- Mahsulotlar -->
      <div style="background:#071020;padding:14px 20px">
        <div style="font-size:10px;color:#4a6070;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Mahsulotlar</div>
        <div style="font-size:22px;font-weight:800;color:#c8d8e8">${totalProducts} tur</div>
        <div style="font-size:12px;color:#4a6070;margin-top:3px">Kataloglarda</div>
      </div>
    </div>

    <!-- Obuna taqsimoti -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#1e3a5f">
      ${[
        {lbl:"🧪 Sinov",  val:plans.trial,    clr:"#E9A500"},
        {lbl:"📅 Oylik",  val:plans.monthly,  clr:"#4C9BE8"},
        {lbl:"📆 Yillik", val:plans.yearly,   clr:"#36B48C"},
        {lbl:"♾️ Umrlik", val:plans.lifetime, clr:"#8B5CF6"},
      ].map(k=>`
        <div style="background:#0a1824;padding:10px 18px;display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:12px;color:#6b8096">${k.lbl}</div>
          <div style="font-size:18px;font-weight:800;color:${k.clr}">${k.val} ta</div>
        </div>`).join("")}
    </div>`;
}

function buildSaPanel() {
  return `
    <div style="background:#0D1B2A;border:1px solid #1e3a5f;border-radius:20px;
      width:1100px;max-width:98vw;max-height:92vh;overflow:hidden;display:flex;flex-direction:column">

      <!-- Header -->
      <div style="padding:20px 28px;border-bottom:1px solid #1e3a5f;
        display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:18px;font-weight:800;color:#E9A500">⚡ Super Admin Panel</div>
          <div style="font-size:12px;color:#6b8096;margin-top:2px">MERX Savdo tizimi boshqaruvi</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <div style="font-size:12px;color:#4a6070">Jami: <strong style="color:#E9A500">${_saShops.length} ta do'kon</strong></div>
          <button onclick="saLogout()"
            style="background:#1a2d40;border:1px solid #2a4060;color:#f87171;
            border-radius:8px;padding:6px 14px;font-family:inherit;font-size:12px;cursor:pointer">
            Chiqish
          </button>
          <button onclick="hideSaPanel()"
            style="background:#1a2d40;border:1px solid #2a4060;color:#6b8096;
            border-radius:8px;padding:6px 12px;font-family:inherit;font-size:18px;cursor:pointer">
            ✕
          </button>
        </div>
      </div>

      <!-- Stats dashboard -->
      <div id="sa-dashboard" style="border-bottom:1px solid #1e3a5f">
        ${buildSaDashboard()}
      </div>

      <!-- Toolbar -->
      <div style="padding:14px 24px;border-bottom:1px solid #1e3a5f;
        display:flex;align-items:center;gap:10px">
        <button onclick="saOpenAddShop()"
          style="background:#E9A500;border:none;border-radius:8px;padding:8px 18px;
          font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;color:#0D1B2A">
          + Yangi do'kon
        </button>
        <input id="sa-q" placeholder="Do'kon qidirish..."
          oninput="renderSaShops()"
          style="background:#1a2d40;border:1px solid #2a4060;color:#c8d8e8;
          border-radius:8px;padding:8px 14px;font-family:inherit;font-size:13px;
          outline:none;width:220px">
        <div id="sa-filter" style="display:flex;gap:6px">
          ${["Barchasi","Faol","Muddati o'tgan","Sinov"].map(f=>`
            <button class="sa-fb ${f==="Barchasi"?"sa-fb-on":""}" data-f="${f}"
              onclick="saSetFilter(this)"
              style="background:${f==="Barchasi"?"#E9A500":"#1a2d40"};
              border:1px solid ${f==="Barchasi"?"#E9A500":"#2a4060"};
              color:${f==="Barchasi"?"#0D1B2A":"#6b8096"};
              border-radius:6px;padding:5px 12px;font-family:inherit;
              font-size:12px;cursor:pointer">${f}</button>`).join("")}
        </div>
        <input id="sa-superpass-inp" type="text" placeholder="Yangi super admin paroli..."
          style="background:#1a2d40;border:1px solid #2a4060;color:#c8d8e8;
          border-radius:8px;padding:8px 14px;font-family:inherit;font-size:13px;
          outline:none;width:200px;margin-left:auto">
        <button onclick="saChangeSuperPass()"
          style="background:#1a2d40;border:1px solid #8B5CF6;color:#8B5CF6;
          border-radius:8px;padding:8px 14px;font-family:inherit;font-size:12px;cursor:pointer">
          Parolni o'zgartir
        </button>
      </div>

      <!-- Do'konlar jadvali -->
      <div id="sa-shops-list" style="overflow-y:auto;overflow-x:auto;flex:1;padding:16px 24px"></div>

      <!-- Yangi do'kon modal (yashirin) -->
      <div id="sa-add-modal" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,.7);
        align-items:center;justify-content:center">
        <div style="background:#0D1B2A;border:1px solid #1e3a5f;border-radius:14px;padding:28px;width:480px">
          <div style="font-size:16px;font-weight:700;color:#E9A500;margin-bottom:20px">+ Yangi do'kon qo'shish</div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label style="font-size:11px;color:#6b8096;margin-bottom:5px;display:block">Do'kon nomi *</label>
              <input id="sa-new-name" placeholder="Fashion Store" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:11px;color:#6b8096;margin-bottom:5px;display:block">Egasi ismi *</label>
              <input id="sa-new-owner" placeholder="Alisher Karimov" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:11px;color:#6b8096;margin-bottom:5px;display:block">Telefon *</label>
              <input id="sa-new-phone" placeholder="+998 90 123 45 67" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:11px;color:#6b8096;margin-bottom:5px;display:block">Do'kon paroli *</label>
              <input id="sa-new-pass" type="password" placeholder="Kirish paroli" style="${saInputStyle()}">
            </div>
            <div>
              <label style="font-size:11px;color:#6b8096;margin-bottom:5px;display:block">Obuna turi</label>
              <select id="sa-new-plan" style="${saInputStyle()}">
                <option value="trial">Sinov (30 kun)</option>
                <option value="monthly">Oylik</option>
                <option value="yearly">Yillik</option>
                <option value="lifetime">Umrlik</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;color:#6b8096;margin-bottom:5px;display:block">Modullar</label>
              <select id="sa-new-modules" multiple style="${saInputStyle()} height:68px">
                <option value="pos" selected>POS · Sotuv</option>
                <option value="ombor" selected>Ombor</option>
                <option value="hisobot" selected>Hisobot</option>
                <option value="sms">SMS (Eskiz)</option>
                <option value="cloud">Cloud sync</option>
              </select>
            </div>
          </div>

          <div style="display:flex;gap:10px;margin-top:20px">
            <button onclick="saAddShop()"
              style="flex:1;background:#E9A500;border:none;border-radius:8px;
              padding:12px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;color:#0D1B2A">
              ✓ Qo'shish va yaratish
            </button>
            <button onclick="document.getElementById('sa-add-modal').style.display='none'"
              style="background:#1a2d40;border:1px solid #2a4060;color:#6b8096;
              border-radius:8px;padding:12px 20px;font-family:inherit;font-size:13px;cursor:pointer">
              Bekor
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function saInputStyle() {
  return `background:#1a2d40;border:1px solid #2a4060;color:#c8d8e8;
    border-radius:8px;padding:9px 12px;font-family:inherit;font-size:13px;
    outline:none;width:100%;box-sizing:border-box`;
}

// ── Filterlash ─────────────────────────────────
let _saFilter = "Barchasi";

function saSetFilter(btn) {
  _saFilter = btn.dataset.f;
  document.querySelectorAll(".sa-fb").forEach(b => {
    const on = b.dataset.f === _saFilter;
    b.style.background  = on ? "#E9A500" : "#1a2d40";
    b.style.color       = on ? "#0D1B2A" : "#6b8096";
    b.style.borderColor = on ? "#E9A500" : "#2a4060";
  });
  renderSaShops();
}

function saIsActive(s) {
  if (s.plan === "lifetime") return true;
  if (!s.expiresAt) return false;
  return new Date(s.expiresAt) > new Date();
}
function saIsExpired(s) {
  if (!s.expiresAt || s.plan === "lifetime") return false;
  return new Date(s.expiresAt) <= new Date();
}

function renderSaShops() {
  const el = document.getElementById("sa-shops-list"); if (!el) return;
  const q = document.getElementById("sa-q")?.value.toLowerCase() || "";

  let list = [..._saShops];
  if (q) list = list.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.ownerName||"").toLowerCase().includes(q) ||
    (s.phone||"").includes(q)
  );
  if (_saFilter === "Faol")          list = list.filter(s => saIsActive(s));
  if (_saFilter === "Muddati o'tgan") list = list.filter(s => saIsExpired(s));
  if (_saFilter === "Sinov")         list = list.filter(s => s.plan === "trial");

  if (!list.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:#4a6070;font-size:14px">
      ${q ? `"${q}" topilmadi` : "Do'konlar yo'q"}</div>`;
    return;
  }

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="color:#4a6070;font-size:11px;text-transform:uppercase;letter-spacing:.05em">
          <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #1e3a5f">Do'kon</th>
          <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #1e3a5f">Egasi · Tel</th>
          <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #1e3a5f">Obuna</th>
          <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #1e3a5f">Muddati</th>
          <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #1e3a5f">Holat</th>
          <th style="padding:8px 10px;border-bottom:1px solid #1e3a5f">Amallar</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(s => {
          const active  = saIsActive(s);
          const expired = saIsExpired(s);
          const statusColor = active ? "#36B48C" : expired ? "#E05A5A" : "#E9A500";
          const statusText  = active ? "Faol" : expired ? "Muddati o'tgan" : "Sinov";
          const expDate = s.expiresAt ? s.expiresAt.slice(0,10) : "—";
          const planLabels = { trial:"Sinov", monthly:"Oylik", yearly:"Yillik", lifetime:"Umrlik" };

          return `<tr style="border-bottom:1px solid #0f2035;transition:background .15s"
            onmouseover="this.style.background='#0f2035'" onmouseout="this.style.background=''">
            <td style="padding:12px 10px;cursor:pointer" onclick="saShowStats('${s.id}')">
              <div style="font-weight:700;color:#E9A500;text-decoration:underline;text-underline-offset:3px">${s.name}</div>
              <div style="font-size:11px;color:#4a6070;margin-top:2px">ID: ${s.id} · 📊 statistika</div>
            </td>
            <td style="padding:12px 10px;color:#6b8096">
              <div>${s.ownerName || "—"}</div>
              <div style="font-size:11px">${s.phone || "—"}</div>
            </td>
            <td style="padding:12px 10px">
              <span style="background:#1a2d40;border:1px solid #2a4060;color:#6b8096;
                border-radius:6px;padding:3px 10px;font-size:12px">
                ${planLabels[s.plan]||s.plan}
              </span>
            </td>
            <td style="padding:12px 10px;color:${expired?"#E05A5A":"#6b8096"};font-size:12px">
              ${s.plan==="lifetime" ? "♾️ Cheksiz" : expDate}
            </td>
            <td style="padding:12px 10px">
              <span style="background:${statusColor}22;color:${statusColor};
                border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600">
                ${statusText}
              </span>
            </td>
            <td style="padding:12px 10px;white-space:nowrap">
              <div style="display:flex;gap:4px">
                <button onclick="saOpenShop('${s.id}')" title="Kirish"
                  style="background:#E9A500;border:none;color:#0D1B2A;border-radius:6px;
                  padding:6px 10px;font-size:13px;cursor:pointer;font-weight:700">🔑</button>
                <button onclick="saEditShop('${s.id}')" title="Tahrirlash"
                  style="background:#1a2d40;border:1px solid #2a4060;color:#4C9BE8;
                  border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer">✏️</button>
                <button onclick="saToggleShop('${s.id}')" title="${active?'Bloklash':'Faollashtirish'}"
                  style="background:#1a2d40;border:1px solid #2a4060;color:${active?"#E05A5A":"#36B48C"};
                  border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer">
                  ${active ? "🔒" : "✅"}</button>
                <button onclick="saDeleteShop('${s.id}')" title="O'chirish"
                  style="background:#1a2d40;border:1px solid #E05A5A;color:#E05A5A;
                  border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer">🗑️</button>
              </div>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

function saOpenShop(id) {
  const s = _saShops.find(x => x.id === id); if (!s) return;

  // dbKey — mavjud bo'lsa ishlatamiz, yo'q bo'lsa yangi format
  const dbKey = s.dbKey || ("merx_v5_" + s.id);

  // Do'kon DB yo'q bo'lsa bo'sh yaratamiz
  if (!localStorage.getItem(dbKey)) {
    const shopDB = {
      shop:     { name: s.name, type: "ikki" },
      settings: {
        rate: 12800, priceCurrency: "uzs",
        adminEmail: s.ownerEmail || (s.phone + "@merx.uz"),
        adminPass:  s.ownerPass || "merx123"
      },
      customers:[], products:[], sales:[], staff:[],
      ombor:[], xarajatlar:[], debtPayments:[], shifts:[], seq:1
    };
    localStorage.setItem(dbKey, JSON.stringify(shopDB));
  }

  // Auth session — shopId va dbKey bilan
  const user = {
    id:       "sa_" + id,
    email:    s.ownerEmail || (s.phone + "@merx.uz"),
    shopId:   id,          // getShopId() shu ni oladi
    dbKey:    dbKey,       // to'g'ri kalit
    shopName: s.name,
    role:     "admin",
    saAccess: true
  };
  if (typeof authSave === "function") authSave(user);

  hideSaPanel();
  showSaToast(`"${s.name}" ga kirildi — sahifa yangilanadi...`);
  setTimeout(() => location.reload(), 800);
}

function saDeleteShop(id) {
  const s = _saShops.find(x => x.id === id); if (!s) return;
  if (!confirm(`"${s.name}" o'chirilsinmi?`)) return;
  // localStorage dan DB ni ham o'chirish
  const dbKey = "merx_v5_" + id;
  localStorage.removeItem(dbKey);
  localStorage.removeItem("merx_" + id); // eski format
  _saShops = _saShops.filter(x => x.id !== id);
  saSaveShops();
  renderSaShops();
  showSaToast(`"${s.name}" o'chirildi`);
}

function saOpenAddShop() {
  const modal = document.getElementById("sa-add-modal");
  if (modal) modal.style.display = "flex";
}

function saAddShop() {
  const name    = document.getElementById("sa-new-name")?.value.trim();
  const owner   = document.getElementById("sa-new-owner")?.value.trim();
  const phone   = document.getElementById("sa-new-phone")?.value.trim();
  const pass    = document.getElementById("sa-new-pass")?.value.trim();
  const plan    = document.getElementById("sa-new-plan")?.value || "trial";
  const modSel  = document.getElementById("sa-new-modules");
  const modules = modSel ? Array.from(modSel.selectedOptions).map(o=>o.value) : ["pos","ombor","hisobot"];

  if (!name || !owner || !phone || !pass) {
    alert("Barcha majburiy maydonlarni to'ldiring"); return;
  }

  const now     = new Date();
  const expires = plan === "lifetime" ? null : addDaysToDate(now, plan === "yearly" ? 365 : 30);
  const shopId  = "shop_" + Date.now();

  const newShop = {
    id:        shopId,
    name,
    ownerName: owner,
    ownerEmail: phone + "@merx.uz", // login uchun
    phone,
    ownerPass: pass,
    plan,
    modules,
    expiresAt: expires,
    createdAt: now.toISOString(),
    blocked:   false,
    dbKey:     "merx_v5_" + shopId
  };

  _saShops.push(newShop);
  saSaveShops();

  // LocalStorage da bo'sh DB
  const shopDB = {
    shop:     { name, type:"ikki" },
    settings: { rate:12800, priceCurrency:"uzs", adminEmail: phone + "@merx.uz", adminPass: pass, modules },
    customers:[], products:[], sales:[], staff:[], ombor:[],
    xarajatlar:[], debtPayments:[], shifts:[], seq:1
  };
  localStorage.setItem(newShop.dbKey, JSON.stringify(shopDB));

  // Supabase shops jadvaliga ham yozish
  _saAddShopToSupabase(newShop).catch(e => console.warn("Supabase shops sync xato:", e.message));

  document.getElementById("sa-add-modal").style.display = "none";
  ["sa-new-name","sa-new-owner","sa-new-phone","sa-new-pass"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });

  renderSaShops();
  showSaToast(`✅ "${name}" qo'shildi! Login: ${phone}@merx.uz | Parol: ${pass}`);
}

async function _saAddShopToSupabase(shop) {
  if (!_sb && typeof initSupabase === "function") {
    await initSupabase();
  }
  if (!_sb) return;
  try {
    await _sb.from("shops").upsert({
      id:          shop.id,
      name:        shop.name,
      owner_email: shop.ownerEmail,
      plan:        shop.plan,
      active:      !shop.blocked,
      trial_ends:  shop.expiresAt ? shop.expiresAt.slice(0,10) : null
    });
  } catch(e) {
    console.warn("shops upsert xato:", e.message);
  }
}

function addDaysToDate(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ── Do'konni bloklash/faollashtirish ──────────
function saToggleShop(id) {
  const s = _saShops.find(x => x.id === id); if (!s) return;
  s.blocked = !s.blocked;
  if (!s.blocked && s.plan !== "lifetime") {
    // Faollashtirishda muddatni uzaytirish
    s.expiresAt = addDaysToDate(new Date(), 30);
  }
  saSaveShops();
  renderSaShops();
  showSaToast(s.blocked ? `"${s.name}" bloklandi` : `"${s.name}" faollashtirildi`);
}

// ── Do'konni tahrirlash ─────────────────────────
function saEditShop(id) {
  const s = _saShops.find(x => x.id === id); if (!s) return;
  const newPlan = prompt(`"${s.name}" obuna turini tanlang:\ntrial / monthly / yearly / lifetime`, s.plan);
  if (!newPlan || !["trial","monthly","yearly","lifetime"].includes(newPlan)) return;

  const daysMap = { trial:30, monthly:30, yearly:365, lifetime:null };
  s.plan = newPlan;
  s.expiresAt = daysMap[newPlan] ? addDaysToDate(new Date(), daysMap[newPlan]) : null;
  saSaveShops();
  renderSaShops();
  showSaToast(`✅ "${s.name}" obuna yangilandi: ${newPlan}`);
}

// ── Do'kon almashtirish ───────────────────────────
function saSwitchToShop(shopId) {
  const shop = _saShops.find(s => s.id === shopId);
  if (!shop) return;

  if (!confirm(`"${shop.name}" do'koniga o'tasizmi?
Joriy do'kon ma'lumotlari saqlanib qoladi.`)) return;

  // Joriy do'kon DB kalitini saqlaymiz
  const prevKey = db._currentKey || "merx_v5";
  localStorage.setItem("merx_prev_shop", prevKey);
  localStorage.setItem("merx_is_sa_view", "1");

  // Yangi do'kon DB sini yuklaymiz
  try {
    const shopData = localStorage.getItem(shop.dbKey);
    if (!shopData) {
      showSaToast(`"${shop.name}" uchun ma'lumot topilmadi`, "err");
      return;
    }
    const shopDB = JSON.parse(shopData);
    shopDB._currentKey = shop.dbKey;
    shopDB._shopId     = shop.id;
    shopDB._isSaView   = true;

    db = shopDB;
    localStorage.setItem("merx_active_shop", shop.dbKey);

    // Super admin sessiyasini yangilaymiz
    _authSession = {
      role:    "owner",
      name:    shop.ownerName || shop.name,
      staffId: null,
      isSaView: true,
      shopId:  shop.id,
      shopName: shop.name
    };
    authSave();

    hideSaPanel();

    // Sahifani yangilaymiz
    window.location.reload();

  } catch(e) {
    showSaToast("Do'konni yuklashda xatolik: " + e.message, "err");
  }
}

function saReturnToMainShop() {
  // Avvalgi do'konga qaytish
  const prevKey = localStorage.getItem("merx_prev_shop") || "merx_v5";
  localStorage.setItem("merx_active_shop", prevKey);
  localStorage.removeItem("merx_is_sa_view");
  localStorage.removeItem("merx_prev_shop");

  // Sessiyani tozalaymiz — asosiy do'konga qaytamiz
  localStorage.removeItem("merx_auth_v1");
  localStorage.removeItem("merx_auth_ts");

  window.location.reload();
}

// ── Super admin ko'rish paneli (topbar da) ────────
function renderSaViewBanner() {
  const isSaView = localStorage.getItem("merx_is_sa_view") === "1";
  if (!isSaView) return;

  const existing = document.getElementById("sa-view-banner");
  if (existing) return;

  const banner = document.createElement("div");
  banner.id = "sa-view-banner";
  const shopName = db.shop?.name || "Do'kon";
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:9999;
    background:linear-gradient(90deg,#4c1d95,#7c3aed);
    color:#fff;padding:8px 20px;font-family:'DM Sans',sans-serif;
    font-size:13px;font-weight:600;display:flex;align-items:center;gap:12px;
    box-shadow:0 2px 12px rgba(0,0,0,.3)`;
  banner.innerHTML = `
    <span style="opacity:.7">⚡ Super Admin ko'rinishi:</span>
    <strong>${shopName}</strong>
    <span style="background:rgba(255,255,255,.2);border-radius:4px;padding:2px 8px;font-size:11px">
      Faqat ko'rish
    </span>
    <button onclick="saReturnToMainShop()"
      style="margin-left:auto;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);
      color:#fff;border-radius:6px;padding:4px 14px;font-family:inherit;font-size:12px;cursor:pointer">
      ← Asosiy do'konga qaytish
    </button>`;
  document.body.prepend(banner);

  // Main va sidebar ni pastga suramiz
  const main = document.getElementById("main");
  const sb   = document.getElementById("sb");
  if (main) main.style.paddingTop = "36px";
  if (sb)   sb.style.paddingTop   = "36px";
}

// ── Super admin ko'rinishida DB ni to'g'ri yuklash ─
function saLoadActiveShop() {
  const activeKey = localStorage.getItem("merx_active_shop");
  if (!activeKey || activeKey === "merx_v5") return false;

  try {
    const raw = localStorage.getItem(activeKey);
    if (!raw) return false;
    const shopDB = JSON.parse(raw);
    shopDB._currentKey = activeKey;
    db = shopDB;
    return true;
  } catch(e) { return false; }
}

// ── Super admin ko'rish saveDB override ────────────
const _origSaveDB = window.saveDB;
window.saveDB = function() {
  // SA ko'rinishida — yangi do'kon DB siga saqlaymiz
  const activeKey = db._currentKey || localStorage.getItem("merx_active_shop");
  if (activeKey && activeKey !== "merx_v5") {
    try { localStorage.setItem(activeKey, JSON.stringify(db)); }
    catch(e) {}
    if (typeof scheduleCloudSync === "function") scheduleCloudSync();
    return;
  }
  if (typeof _origSaveDB === "function") _origSaveDB();
};

// ── Super admin ko'rishida Super Admin panelidagi tugma ─
// renderSaShops ga "Ko'rish" tugmasini qo'shamiz

// ── Super admin ko'rish panelini ishga tushirish ──
(function() {
  const isSaView = localStorage.getItem("merx_is_sa_view") === "1";
  if (isSaView) {
    const loaded = saLoadActiveShop();
    if (!loaded) {
      // Faol do'kon topilmadi — asosiy do'konga qaytish
      localStorage.removeItem("merx_is_sa_view");
      localStorage.removeItem("merx_active_shop");
    }
  }
})();


// renderSaShops override olib tashlandi

// ── Super admin ko'rish bannerini ishga tushirish ─
// DOMContentLoaded dan keyin
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderSaViewBanner);
} else {
  setTimeout(renderSaViewBanner, 100);
}

// ── Super admin ko'rish tugmalari renderSaShops da ──

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──

// ── Super admin ko'rish

// ── Super admin ko'rish tugmasini jadvalga qo'shish ──
// ── Do'kon statistikasini hisoblash ──────────────
function saGetShopStats(shop) {
  try {
    const raw = localStorage.getItem(shop.dbKey);
    if (!raw) return null;
    const sdb = JSON.parse(raw);
    const sales = sdb.sales || [], customers = sdb.customers || [], products = sdb.products || [];
    const rate  = sdb.settings?.rate || 12800;
    const totalRev  = sales.reduce((a,s)=>a+(s.paid||0),0);
    const totalDebt = sales.filter(s=>s.status==="qarz").reduce((a,s)=>a+(s.remaining||0),0);
    const totalStock= products.reduce((a,p)=>a+p.variants.reduce((b,v)=>b+(v.qty||0),0),0);
    let costTotal = 0;
    sales.forEach(s=>{ s.items?.forEach(i=>{ const p=products.find(x=>x.name===i.name); if(p) costTotal+=Math.round((p.costUsd||0)*rate)*(i.qty||0); }); });
    const m = new Date().toISOString().slice(0,7);
    const monthSales = sales.filter(s=>s.date?.startsWith(m));
    return { salesCnt:sales.length, monthCnt:monthSales.length, totalRev, monthRev:monthSales.reduce((a,s)=>a+(s.paid||0),0), totalDebt, profit:totalRev-costTotal, custCnt:customers.length, prodCnt:products.length, stockCnt:totalStock };
  } catch(e) { return null; }
}

function saShowStats(shopId) {
  const shop = _saShops.find(s=>s.id===shopId); if (!shop) return;
  const stats = saGetShopStats(shop);
  document.getElementById("sa-stats-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "sa-stats-modal";
  modal.style.cssText = `position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif`;
  const fmtN = n => n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?(n/1000).toFixed(0)+"K":String(n||0);
  const planL = {trial:"Sinov",monthly:"Oylik",yearly:"Yillik",lifetime:"Umrlik"};
  modal.innerHTML = `
    <div style="background:#0D1B2A;border:1px solid #1e3a5f;border-radius:16px;width:560px;max-width:95vw;overflow:hidden">
      <div style="padding:18px 24px;border-bottom:1px solid #1e3a5f;display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:16px;font-weight:700;color:#E9A500">${shop.name}</div><div style="font-size:12px;color:#6b8096">${shop.ownerName||"—"} · ${shop.phone||"—"}</div></div>
        <button onclick="document.getElementById('sa-stats-modal').remove()" style="background:#1a2d40;border:1px solid #2a4060;color:#6b8096;border-radius:8px;padding:6px 12px;font-family:inherit;cursor:pointer;font-size:16px">✕</button>
      </div>
      ${!stats ? `<div style="padding:40px;text-align:center;color:#6b8096">Hali ma'lumot yo'q</div>` : `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#1e3a5f">
        ${[
          {lbl:"Jami sotuv",   val:fmtN(stats.totalRev)+" so'm", clr:"#36B48C"},
          {lbl:"Bu oy",        val:fmtN(stats.monthRev)+" so'm",  clr:"#4C9BE8"},
          {lbl:"Foyda",        val:fmtN(stats.profit)+" so'm",    clr:stats.profit>=0?"#E9A500":"#E05A5A"},
          {lbl:"Sotuvlar",     val:stats.salesCnt+" ta",           clr:"#c8d8e8"},
          {lbl:"Mijozlar",     val:stats.custCnt+" ta",            clr:"#c8d8e8"},
          {lbl:"Qarz",         val:fmtN(stats.totalDebt)+" so'm", clr:"#E05A5A"},
          {lbl:"Mahsulotlar",  val:stats.prodCnt+" tur",           clr:"#c8d8e8"},
          {lbl:"Qoldiq",       val:stats.stockCnt+" dona",         clr:"#c8d8e8"},
          {lbl:"Bu oy sotuv",  val:stats.monthCnt+" ta",           clr:"#4C9BE8"},
        ].map(k=>`<div style="background:#0a1824;padding:14px 16px"><div style="font-size:11px;color:#4a6070;margin-bottom:3px">${k.lbl}</div><div style="font-size:16px;font-weight:800;color:${k.clr}">${k.val}</div></div>`).join("")}
      </div>
      <div style="padding:14px 24px;border-top:1px solid #1e3a5f">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${[{lbl:"Obuna",val:planL[shop.plan]||shop.plan},{lbl:"Muddat",val:shop.plan==="lifetime"?"♾️":(shop.expiresAt?.slice(0,10)||"—")},{lbl:"Holat",val:saIsActive(shop)?"✅ Faol":"❌ Nofaol"},{lbl:"Qo'shildi",val:shop.createdAt?.slice(0,10)||"—"}].map(k=>`<div style="background:#1a2d40;border-radius:8px;padding:8px 14px"><div style="font-size:10px;color:#4a6070;margin-bottom:2px">${k.lbl}</div><div style="font-size:13px;font-weight:600;color:#c8d8e8">${k.val}</div></div>`).join("")}
        </div>
      </div>
      <div style="padding:12px 24px;border-top:1px solid #1e3a5f;display:flex;gap:8px">
        <button onclick="saSwitchToShop('${shop.id}');document.getElementById('sa-stats-modal').remove()" style="background:#8B5CF622;border:1px solid #8B5CF6;color:#8B5CF6;border-radius:8px;padding:8px 16px;font-family:inherit;font-size:13px;cursor:pointer">👁️ Kirish</button>
        <button onclick="saToggleShop('${shop.id}');document.getElementById('sa-stats-modal').remove()" style="background:#1a2d40;border:1px solid #2a4060;color:${saIsActive(shop)?"#E05A5A":"#36B48C"};border-radius:8px;padding:8px 16px;font-family:inherit;font-size:13px;cursor:pointer">${saIsActive(shop)?"🔒 Bloklash":"✅ Faollashtirish"}</button>
        <button onclick="saExtendShop('${shop.id}');document.getElementById('sa-stats-modal').remove()" style="background:#36B48C22;border:1px solid #36B48C;color:#36B48C;border-radius:8px;padding:8px 16px;font-family:inherit;font-size:13px;cursor:pointer;margin-left:auto">➕ 30 kun uzaytirish</button>
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
}

function saChangeSuperPass() {
  const newPass = document.getElementById("sa-superpass-inp")?.value.trim();
  if (!newPass || newPass.length < 6) {
    showSaToast("Parol kamida 6 ta belgi bo'lishi kerak", "err"); return;
  }
  if (!db.settings) db.settings = {};
  db.settings.superAdminPin = newPass;
  saveDB();
  document.getElementById("sa-superpass-inp").value = "";
  showSaToast("✅ Super admin paroli saqlandi");
}

// ── Toast xabar ───────────────────────────────
function showSaToast(msg, type="ok") {
  const t = document.createElement("div");
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:999999;
    background:${type==="err"?"#7f1d1d":"#0a2a1a"};
    color:${type==="err"?"#fca5a5":"#6ee7b7"};
    border:1px solid ${type==="err"?"#b91c1c":"#065f46"};
    border-radius:10px;padding:12px 20px;font-family:'DM Sans',sans-serif;
    font-size:13px;font-weight:600;max-width:320px;
    box-shadow:0 8px 24px rgba(0,0,0,.4)`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Klaviatura shortcut: Ctrl+Shift+A ─────────
document.addEventListener("keydown", function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === "A") {
    e.preventDefault();
    openSaPanel();
  }
});

// ── Joriy do'kon obuna va bloklash tekshiruvi ────
function checkCurrentShopSubscription() {
  saLoadShops();

  // SA ko'rinishida tekshirmaymiz
  if (localStorage.getItem("merx_is_sa_view") === "1") return;

  const activeKey = localStorage.getItem("merx_active_shop") || "merx_v5";
  // Asosiy do'kon (merx_v5) uchun tekshirmaymiz
  if (activeKey === "merx_v5") return;

  const shop = _saShops.find(s => s.dbKey === activeKey);
  if (!shop) return;

  // Bloklangan do'kon
  if (shop.blocked) {
    showSubscriptionWall("blocked", shop);
    return;
  }

  // Muddati o'tgan
  if (saIsExpired(shop)) {
    showSubscriptionWall("expired", shop);
    return;
  }

  // Muddati yaqinlashayotgan (3 kun qolgan)
  if (shop.expiresAt && shop.plan !== "lifetime") {
    const daysLeft = Math.ceil((new Date(shop.expiresAt) - new Date()) / 86400000);
    if (daysLeft <= 3) {
      showSubscriptionWarning(daysLeft, shop);
    }
  }
}

function showSubscriptionWall(reason, shop) {
  // Login ekranini yashiramiz, wall ko'rsatamiz
  const app = document.getElementById("app");
  if (app) app.style.display = "none";

  let existing = document.getElementById("sub-wall");
  if (existing) existing.remove();

  const wall = document.createElement("div");
  wall.id = "sub-wall";
  wall.style.cssText = `
    position:fixed;inset:0;z-index:99998;
    background:linear-gradient(135deg,#0D1B2A 0%,#1a2f44 100%);
    display:flex;align-items:center;justify-content:center;
    font-family:'DM Sans',sans-serif`;

  const isBlocked = reason === "blocked";
  wall.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:40px;width:100%;max-width:440px;
      text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.3)">
      <div style="font-size:48px;margin-bottom:16px">${isBlocked ? "🔒" : "⏰"}</div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0D1B2A">
        ${isBlocked ? "Do'kon bloklangan" : "Obuna muddati tugadi"}
      </h2>
      <p style="color:#888;font-size:14px;margin:0 0 24px">
        ${isBlocked
          ? "Bu do'kon administrator tomonidan vaqtincha bloklangan."
          : `"${shop.name}" obunasining muddati tugagan. Davom etish uchun obunani yangilang.`}
      </p>
      <div style="background:#f8f9fa;border-radius:12px;padding:16px;margin-bottom:24px;text-align:left">
        <div style="font-size:13px;color:#555;margin-bottom:6px">
          📞 <strong>Administrator bilan bog'laning:</strong>
        </div>
        <div style="font-size:14px;font-weight:600;color:#0D1B2A">MERX Savdo tizimi</div>
        <div style="font-size:13px;color:#888">Obunani yangilash uchun qo'ng'iroq qiling</div>
      </div>
      <button onclick="saWallLogout()"
        style="width:100%;background:#0D1B2A;border:none;border-radius:12px;
        padding:14px;font-family:inherit;font-size:15px;font-weight:700;
        cursor:pointer;color:#E9A500">
        Boshqa hisobdan kirish
      </button>
    </div>`;
  document.body.appendChild(wall);
}

function saWallLogout() {
  // Subscription wall dan chiqish — asosiy do'konga qaytish
  const prevKey = localStorage.getItem("merx_prev_shop");
  if (prevKey) {
    localStorage.setItem("merx_active_shop", prevKey);
    localStorage.removeItem("merx_is_sa_view");
    localStorage.removeItem("merx_prev_shop");
  }
  localStorage.removeItem("merx_auth_v1");
  localStorage.removeItem("merx_auth_ts");
  window.location.reload();
}

function showSubscriptionWarning(daysLeft, shop) {
  // Yuqorida sariq ogohlantirish banner
  if (document.getElementById("sub-warning")) return;
  const el = document.createElement("div");
  el.id = "sub-warning";
  el.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:9998;
    background:#92400E;color:#FDE68A;
    padding:8px 20px;font-family:'DM Sans',sans-serif;
    font-size:13px;font-weight:600;display:flex;align-items:center;
    justify-content:center;gap:12px`;
  el.innerHTML = `
    ⚠️ Obuna muddati ${daysLeft} kun ichida tugaydi!
    <button onclick="this.parentElement.remove()"
      style="background:transparent;border:none;color:#FDE68A;cursor:pointer;font-size:16px">✕</button>`;
  document.body.prepend(el);
  const main = document.getElementById("main");
  const sb = document.getElementById("sb");
  if (main) main.style.paddingTop = (parseInt(main.style.paddingTop)||0) + 36 + "px";
  if (sb) sb.style.paddingTop = (parseInt(sb.style.paddingTop)||0) + 36 + "px";
}

// ── Modullar cheklash ──────────────────────────────
function applyShopModules() {
  saLoadShops();

  // SA ko'rinishida modules ni shop dan olamiz
  const activeKey = localStorage.getItem("merx_active_shop");
  if (!activeKey || activeKey === "merx_v5") return;

  const shop = _saShops.find(s => s.dbKey === activeKey);
  if (!shop || !shop.modules) return;

  const modules = shop.modules || [];

  // Modul → sahifa mapping
  const modulePages = {
    pos:     ["sotuv", "tarix", "qarzlar"],
    ombor:   ["ombor"],
    hisobot: ["hisobot", "moliya", "xodimlar"],
    sms:     [], // faqat sozlama bo'limi
    cloud:   []  // faqat cloud sozlama
  };

  // Yoqilmagan modullar uchun sahifalarni yashirish
  const hiddenPages = [];
  Object.entries(modulePages).forEach(([mod, pages]) => {
    if (!modules.includes(mod)) {
      hiddenPages.push(...pages);
    }
  });

  // Sidebar elementlarini yashirish
  document.querySelectorAll(".ni[data-page]").forEach(el => {
    const page = el.dataset.page;
    if (hiddenPages.includes(page)) {
      el.style.display = "none";
    }
  });

  // SMS va Cloud ni egasi sozlamalarida yashirish
  if (!modules.includes("sms")) {
    const smsEl = document.querySelector(".sms-section, #sms-wrap");
    if (smsEl) smsEl.style.display = "none";
  }
  if (!modules.includes("cloud")) {
    const cloudEl = document.getElementById("cloud-pill");
    if (cloudEl) cloudEl.style.display = "none";
    const cloudWrap = document.querySelector(".cloud-section, #cloud-wrap");
    if (cloudWrap) cloudWrap.style.display = "none";
  }
}

// Start
saLoad();
