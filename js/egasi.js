// MERX egasi.js (admin.js) | v4.0 | 2026-06-24
// ================================================
// Admin Sozlamalar — Tab tizimi
// Tablar: dokon | narx | cloud | sms | tizim
// ================================================

// ── Aktiv tab ────────────────────────────────────
let _adminTab = "dokon";

function adminTabSwitch(tab) {
  _adminTab = tab;
  document.querySelectorAll(".adm-tab-btn").forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("adm-tab-on", on);
  });
  document.querySelectorAll(".adm-tab-pane").forEach(p => {
    p.style.display = p.dataset.tab === tab ? "block" : "none";
  });
}

// ── saveSetting — o'zgarmadi ──────────────────────
function saveSetting(key, val) {
  if (!db.settings) db.settings = {};
  db.settings[key] = val;
  saveDB();
  if (key === "priceCurrency") {
    document.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === val));
    if (typeof updateCostCurrency === "function") updateCostCurrency();
    if (typeof updateRatePill     === "function") updateRatePill();
    if (typeof renderKatalog      === "function") renderKatalog();
    if (typeof renderPosGrid      === "function") renderPosGrid();
  }
  if (key === "rate") {
    if (typeof updateRatePill === "function") updateRatePill();
  }
  if (key === "name") {
    if (!db.shop) db.shop = {};
    db.shop.name = val;
    const sbShop = document.getElementById("sb-shop");
    if (sbShop) sbShop.textContent = val;
    saveDB();
  }
  if (key === "telegramBotUrl") {
    _updateTgBadge(!!val);
  }
}

function _updateTgBadge(has) {
  const b = document.getElementById("tg-bot-status-badge");
  if (!b) return;
  b.textContent = has ? "Sozlangan ✅" : "Sozlanmagan";
  b.className   = has ? "bg bg-g"      : "bg bg-gr";
}

// ── Admin login ma'lumotlarini saqlash ────────────
function saveAdminCreds() {
  const email = ($("s-admin-email")||{value:""}).value.trim().toLowerCase();
  const pass  = ($("s-admin-pass") ||{value:""}).value;
  if (!email) { toast("Email kiriting","err"); return; }
  if (pass && pass.length < 4) { toast("Parol kamida 4 ta belgi","err"); return; }
  if (!db.settings) db.settings = {};
  db.settings.adminEmail = email;
  if (pass) db.settings.adminPass = pass;
  if (typeof getAuthUser === "function") {
    const u = getAuthUser();
    if (u) { u.email = email; if (typeof authSave === "function") authSave(u); }
  }
  saveDB();
  if ($("s-admin-pass")) $("s-admin-pass").value = "";
  toast("✅ Login ma'lumotlari saqlandi");
}

// ── renderEgasi (renderAdmin) — barcha tablarni to'ldiradi ──
function renderEgasi() {
  // ── DO'KON TAB ──
  if ($("s-name"))      $("s-name").value      = db.shop?.name || db.settings?.name || "";
  if ($("s-low-stock")) $("s-low-stock").value = db.settings?.lowStockLimit || 5;

  // Do'kon turi — faqat ko'rish (superadmin belgilaydi)
  const shopTypeEl = $("s-shop-type-display");
  if (shopTypeEl) {
    const typeLabels = {
      oyoq:    "👟 Faqat Oyoq kiyim",
      kiyim:   "👕 Faqat Kiyim-kechak",
      ikki:    "🧩 Oyoq kiyim + Kiyim",
      aralash: "🔀 Aralash (boshqa)"
    };
    const t = db.settings?.shopType || db.shop?.type || "ikki";
    shopTypeEl.textContent = typeLabels[t] || t;
  }

  // Kam qoldiq hisob
  const lsCount = $("s-low-stock-count");
  if (lsCount) {
    const th  = db.settings?.lowStockLimit || 5;
    let   cnt = 0;
    (db.products||[]).forEach(p => p.variants?.forEach(v => { if ((v.qty||0) <= th) cnt++; }));
    lsCount.textContent = cnt;
  }

  // ── NARX TAB ──
  if ($("s-rate")) $("s-rate").value = db.settings?.rate || 12800;
  const cur = db.settings?.priceCurrency || "uzs";
  document.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === cur));
  if ($("s-loyalty-rate"))  $("s-loyalty-rate").value  = db.settings?.loyaltyRate  || "";
  if ($("s-loyalty-value")) $("s-loyalty-value").value = db.settings?.loyaltyValue || 100;

  // ── CLOUD TAB ──
  const url = db.settings?.supabaseUrl || "";
  const key = db.settings?.supabaseKey || "";
  if ($("s-sup-url")) $("s-sup-url").value = url;
  if ($("s-sup-key")) $("s-sup-key").value = key;
  const cloudBadge = $("cloud-status-badge");
  if (cloudBadge) {
    cloudBadge.textContent = (url && key) ? "Ulangan ✅" : "Ulanmagan";
    cloudBadge.className   = (url && key) ? "bg bg-g"    : "bg bg-gr";
  }

  // ── SMS TAB ──
  if ($("s-eskiz-token"))  $("s-eskiz-token").value  = db.settings?.eskizToken  || "";
  if ($("s-eskiz-sender")) $("s-eskiz-sender").value = db.settings?.eskizSender || "";
  if (typeof updateSmsUI === "function") updateSmsUI();

  // Telegram
  if ($("s-tg-bot-url"))      $("s-tg-bot-url").value      = db.settings?.telegramBotUrl      || "";
  if ($("s-tg-bot-username")) $("s-tg-bot-username").value = db.settings?.telegramBotUsername || "";
  if ($("s-staff-group-id"))  $("s-staff-group-id").value  = db.settings?.staffGroupId        || "";
  _updateTgBadge(!!db.settings?.telegramBotUrl);

  // ── TIZIM TAB ──
  if ($("s-admin-email")) $("s-admin-email").value = db.settings?.adminEmail || "";
  if ($("s-admin-pass"))  $("s-admin-pass").value  = "";

  // Login ma'lumoti (do'kon egasiga berish uchun)
  const loginInfo = $("s-login-info");
  if (loginInfo) {
    loginInfo.textContent = db.settings?.adminEmail || "—";
  }

  if (typeof updateCostCurrency === "function") updateCostCurrency();

  // Statistika yangilash
  adminRefreshStats();
  adminRefreshSyncStats();
  // Xodimlar tab
  renderAdminXodimlar();
  // Birinchi tabni aktivlashtirish
  adminTabSwitch(_adminTab);
}

// ── setShopType — hozir admin uchun o'chirilgan ──
// Superadmin belgilaydi, bu funksiya faqat moslik uchun qolgan
function setShopType(t) {
  // Admin uchun o'chirilgan — superadmin belgilaydi
  toast("Do'kon turini faqat Super Admin o'zgartira oladi", "info");
}

// ── Sync statistikasi ─────────────────────────────
function adminRefreshSyncStats() {
  const prod  = (db.products||[]).length;
  const sales = (db.sales||[]).length;
  const custs = (db.customers||[]).length;
  const sc = id => document.getElementById(id);
  if (sc("sc-prod"))  sc("sc-prod").textContent  = prod;
  if (sc("sc-sales")) sc("sc-sales").textContent = sales;
  if (sc("sc-custs")) sc("sc-custs").textContent = custs;
}

// ── Tizim statistikasi ────────────────────────────
function adminRefreshStats() {
  const sc = id => document.getElementById(id);
  if (sc("tiz-prod"))  sc("tiz-prod").textContent  = (db.products||[]).length  + " ta";
  if (sc("tiz-sales")) sc("tiz-sales").textContent = (db.sales||[]).length     + " ta";
  if (sc("tiz-custs")) sc("tiz-custs").textContent = (db.customers||[]).length + " ta";
  if (sc("tiz-staff")) sc("tiz-staff").textContent = (db.staff||[]).length     + " ta";

  // Login card
  const loginCard = sc("s-login-info-card");
  if (loginCard) loginCard.textContent = db.settings?.adminEmail || "—";
  const loginWrap = sc("s-login-info");
  if (loginWrap) loginWrap.textContent = db.settings?.adminEmail || "—";
}

// renderEgasi chaqirilganda statistikani ham yangilash
// ── Xodimlar tab render ───────────────────────────
const ROLE_PERMS_TABLE = [
  { lbl:"Sotuv (POS)",        kassir:true,  menejer:true,  omborchi:false, admin:true  },
  { lbl:"Chegirma berish",    kassir:false, menejer:true,  omborchi:false, admin:true, note:"* Alohida ruxsat bilan" },
  { lbl:"Nasiya sotuv",       kassir:false, menejer:true,  omborchi:false, admin:true, note:"* Alohida ruxsat bilan" },
  { lbl:"Qaytarish",          kassir:false, menejer:true,  omborchi:false, admin:true, note:"* Alohida ruxsat bilan" },
  { lbl:"Mijozlar ko'rish",   kassir:true,  menejer:true,  omborchi:false, admin:true  },
  { lbl:"Qarzlar ko'rish",    kassir:true,  menejer:true,  omborchi:false, admin:true  },
  { lbl:"Ombor",              kassir:false, menejer:true,  omborchi:true,  admin:true  },
  { lbl:"Katalog boshqarish", kassir:false, menejer:true,  omborchi:true,  admin:true  },
  { lbl:"Sotuv tarixi",       kassir:true,  menejer:true,  omborchi:false, admin:true  },
  { lbl:"Hisobot",            kassir:false, menejer:true,  omborchi:false, admin:true  },
  { lbl:"Moliya",             kassir:false, menejer:true,  omborchi:false, admin:true  },
  { lbl:"Xodimlar",          kassir:false, menejer:true,  omborchi:false, admin:true  },
  { lbl:"Sozlamalar",         kassir:false, menejer:false, omborchi:false, admin:true  },
];

function renderAdminXodimlar() {
  // Rol jadvali
  const tbody = document.getElementById("adm-role-table-body");
  if (tbody) {
    const yes = `<td style="text-align:center;padding:10px 12px;border-bottom:1px solid #F3F4F6">
      <span style="color:#059669;font-size:16px">✅</span></td>`;
    const no  = `<td style="text-align:center;padding:10px 12px;border-bottom:1px solid #F3F4F6">
      <span style="color:#E5E7EB;font-size:16px">—</span></td>`;
    const partial = `<td style="text-align:center;padding:10px 12px;border-bottom:1px solid #F3F4F6">
      <span style="color:#D97706;font-size:12px;font-weight:700">✳️</span></td>`;

    tbody.innerHTML = ROLE_PERMS_TABLE.map((row, i) => {
      const bg = i % 2 === 0 ? "" : "background:#FAFAFA";
      const kassirCell = row.note && !row.kassir ? partial : (row.kassir ? yes : no);
      return `<tr style="${bg}">
        <td style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-weight:600;color:#374151">
          ${row.lbl}
          ${row.note ? `<span style="font-size:10px;color:#9CA3AF;font-weight:400;display:block">${row.note}</span>` : ""}
        </td>
        ${kassirCell}
        ${row.menejer ? yes : no}
        ${row.omborchi ? yes : no}
        ${row.admin ? yes : no}
      </tr>`;
    }).join("");
  }

  // Xodimlar ruxsatlari
  const permsEl = document.getElementById("adm-staff-perms");
  if (!permsEl) return;

  const staff = db.staff || [];
  if (!staff.length) {
    permsEl.innerHTML = `<div style="text-align:center;padding:32px;color:var(--mut)">
      <i class="ti ti-users-off" style="font-size:32px;display:block;margin-bottom:8px"></i>
      Xodimlar yo'q — avval xodim qo'shing
    </div>`;
    return;
  }

  const roleLabel = { kassir:"💼 Kassir", menejer:"📊 Menejer", omborchi:"📦 Omborchi", admin:"🔑 Admin" };
  const roleColor = { kassir:"#4C9BE8",   menejer:"#8B5CF6",    omborchi:"#36B48C",      admin:"#E9A500" };

  permsEl.innerHTML = staff.map(s => {
    const clr  = roleColor[s.role]  || "#9CA3AF";
    const rlbl = roleLabel[s.role]  || s.role || "—";
    const perms = [];
    if (s.permDiscount) perms.push(`✂️ Chegirma${s.maxDiscount ? " (max "+s.maxDiscount+"%)" : ""}`);
    if (s.permNasiya)   perms.push("💳 Nasiya");
    if (s.permReturn)   perms.push("↩ Qaytarish");

    return `
      <div style="display:flex;align-items:center;gap:14px;padding:12px 0;
        border-bottom:1px solid var(--brd)">
        <div style="width:40px;height:40px;background:${clr}18;border-radius:10px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ti-user" style="color:${clr};font-size:18px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;color:var(--ink);font-size:14px">${s.name}</div>
          <div style="font-size:12px;color:var(--mut)">${s.phone || "—"}</div>
        </div>
        <div style="text-align:right">
          <span style="background:${clr}18;color:${clr};border-radius:6px;
            padding:3px 10px;font-size:12px;font-weight:700;display:inline-block;margin-bottom:4px">
            ${rlbl}
          </span>
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
            ${perms.length
              ? perms.map(p => `<span style="background:#EFF6FF;color:#2563EB;border-radius:5px;
                  padding:2px 8px;font-size:11px;font-weight:600">${p}</span>`).join("")
              : `<span style="font-size:11px;color:var(--mut)">Qo'shimcha ruxsat yo'q</span>`
            }
          </div>
        </div>
        <button onclick="nav('xodimlar')" title="Tahrirlash"
          style="background:#F3F4F6;border:none;border-radius:8px;padding:7px 10px;
          cursor:pointer;color:#6B7280;flex-shrink:0">
          <i class="ti ti-edit" style="font-size:14px"></i>
        </button>
      </div>`;
  }).join("");
}
