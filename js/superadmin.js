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

function buildSaPanel() {
  return `
    <div style="background:#0D1B2A;border:1px solid #1e3a5f;border-radius:20px;
      width:820px;max-width:95vw;max-height:88vh;overflow:hidden;display:flex;flex-direction:column">

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

      <!-- Stats qatori -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#1e3a5f;border-bottom:1px solid #1e3a5f">
        ${[
          { lbl:"Jami do'konlar", val: _saShops.length + " ta", clr:"#E9A500" },
          { lbl:"Faol obunalar", val: _saShops.filter(s=>saIsActive(s)).length + " ta", clr:"#36B48C" },
          { lbl:"Muddati o'tgan", val: _saShops.filter(s=>saIsExpired(s)).length + " ta", clr:"#E05A5A" },
          { lbl:"Bu oy qo'shildi", val: _saShops.filter(s=>s.createdAt?.startsWith(new Date().toISOString().slice(0,7))).length + " ta", clr:"#4C9BE8" },
        ].map(k=>`
          <div style="background:#0a1824;padding:14px 18px">
            <div style="font-size:11px;color:#4a6070;margin-bottom:4px">${k.lbl}</div>
            <div style="font-size:20px;font-weight:800;color:${k.clr}">${k.val}</div>
          </div>`).join("")}
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
      <div id="sa-shops-list" style="overflow-y:auto;flex:1;padding:16px 24px"></div>

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
            <td style="padding:12px 10px">
              <div style="font-weight:700;color:#c8d8e8">${s.name}</div>
              <div style="font-size:11px;color:#4a6070;margin-top:2px">ID: ${s.id}</div>
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
              <button onclick="saEditShop('${s.id}')"
                style="background:#1a2d40;border:1px solid #2a4060;color:#4C9BE8;
                border-radius:6px;padding:5px 12px;font-family:inherit;font-size:12px;cursor:pointer;margin-right:6px">
                ✏️ Tahrir
              </button>
              <button onclick="saToggleShop('${s.id}')"
                style="background:#1a2d40;border:1px solid #2a4060;color:${active?"#E05A5A":"#36B48C"};
                border-radius:6px;padding:5px 12px;font-family:inherit;font-size:12px;cursor:pointer">
                ${active ? "🔒 Bloklash" : "✅ Faollashtirish"}
              </button>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

// ── Yangi do'kon qo'shish ──────────────────────
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
  const expires = plan === "trial" ? addDaysToDate(now, 30)
    : plan === "monthly" ? addDaysToDate(now, 30)
    : plan === "yearly"  ? addDaysToDate(now, 365)
    : null;

  const shopId = "shop_" + Date.now();
  const newShop = {
    id:        shopId,
    name,
    ownerName: owner,
    phone,
    ownerPass: pass,
    plan,
    modules,
    expiresAt: expires,
    createdAt: now.toISOString(),
    blocked:   false,
    dbKey:     "merx_" + shopId
  };

  _saShops.push(newShop);
  saSaveShops();

  // Do'kon uchun bo'sh DB yaratish
  const shopDB = {
    shop:     { name, type:"ikki" },
    settings: { rate:12800, priceCurrency:"uzs", ownerPin:pass, modules },
    customers:[], products:[], sales:[], staff:[], ombor:[],
    xarajatlar:[], chiqimlar:[], seq:1
  };
  localStorage.setItem(newShop.dbKey, JSON.stringify(shopDB));

  // Modalni yopish
  document.getElementById("sa-add-modal").style.display = "none";

  // Tozalash
  ["sa-new-name","sa-new-owner","sa-new-phone","sa-new-pass"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });

  renderSaShops();
  showSaToast(`✅ "${name}" do'koni qo'shildi! Parol: ${pass}`);
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

// ── Super admin parolini o'zgartirish ──────────
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

// ── Joriy do'kon obuna tekshiruvi ──────────────
function checkCurrentShopSubscription() {
  // Agar joriy do'kon ro'yxatda bo'lsa va muddati o'tgan bo'lsa — ogohlantirish
  saLoadShops();
  const currentShopName = db.shop?.name;
  const shop = _saShops.find(s => s.name === currentShopName);

  if (shop && saIsExpired(shop) && !shop.blocked) {
    // Ogohlantirish — lekin to'smaymiz (sinov davri uchun)
    console.warn("MERX: Obuna muddati o'tgan. Super admin bilan bog'laning.");
  }
}

// Start
saLoad();
