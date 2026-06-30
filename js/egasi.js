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
  if (key === "eskizToken") {
    // Token qo'lda yangilandi — eski "eskirgan" ogohlantirishni tozalaymiz
    db.settings.eskizTokenExpired = false;
    saveDB();
    if (typeof updateSmsUI === "function") updateSmsUI();
  }
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
  if (key === "telegramBotUsername") {
    // Faqat @ belgisi bo'lsa email deb hisoblaymiz (merx_savdo_bot.uz emas)
    // Faqat harf va _ belgisi bo'lishi kerak (telefon, email, URL emas)
    const cleanVal = val.replace(/^@/, "").trim();
    const isPhone = /^[+\d\s\-()]{6,}$/.test(cleanVal);
    const isEmail = cleanVal.includes("@");
    const isUrl   = cleanVal.includes(".");
    if (isPhone || isEmail || isUrl) {
      if (db.settings) db.settings.telegramBotUsername = "";
      const msg = isPhone
        ? "Bu telefon raqam! Bot username kiriting: merx_savdo_bot"
        : "Bot username noto'g'ri — merx_savdo_bot kabi kiriting (@ siz)";
      toast(msg, "err");
      const inp = document.getElementById("s-tg-bot-username");
      if (inp) inp.value = "";
      return;
    }
    _updateTgMijozLink();
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

  // Mijoz Telegram havolasini ko'rsatamiz
  _updateTgMijozLink();

  // Chek sozlamalari
  const chekCfg = db.settings?.chekConfig || {};
  const ceContact = document.getElementById("chek-contact");
  const ceFooter  = document.getElementById("chek-footer");
  const ceStaff   = document.getElementById("chek-show-staff");
  const ceContact2= document.getElementById("chek-show-contact");
  const ceDebtH   = document.getElementById("chek-show-debt-history");
  const cePosStyle   = document.getElementById("chek-pos-style");
  const ceTarixStyle = document.getElementById("chek-tarix-style");
  const ceQarzStyle  = document.getElementById("chek-qarz-style");
  if (ceContact) ceContact.value = chekCfg.contact  || "";
  if (ceFooter)  ceFooter.value  = chekCfg.footer   || "Rahmat! Yana kutamiz 🙏";
  if (ceStaff)   ceStaff.checked   = chekCfg.showStaff   !== false;
  if (ceContact2) ceContact2.checked = chekCfg.showContact !== false;
  if (ceDebtH)   ceDebtH.checked  = chekCfg.showDebtHistory !== false;
  if (cePosStyle) {
    // Yangi uslublar qo'shamiz (agar yo'q bo'lsa)
    const posStyleOpts = [
      {v:"merx",       l:"MERX brend (zamonaviy)"},
      {v:"thermal",    l:"Termal printer (72mm)"},
      {v:"wholesale",  l:"Ulgurji hujjat (A4)"},
      {v:"full",       l:"To'liq (eski)"},
      {v:"compact",    l:"Ixcham"},
      {v:"table",      l:"Jadval (USD+UZS)"},
    ];
    if (cePosStyle.options.length < 4) {
      cePosStyle.innerHTML = posStyleOpts.map(o =>
        `<option value="${o.v}">${o.l}</option>`).join("");
    }
    cePosStyle.value = chekCfg.posStyle || "merx";
  }
  if (ceTarixStyle) {
    const tarixStyleOpts = [
      {v:"merx",      l:"MERX brend (zamonaviy)"},
      {v:"thermal",   l:"Termal printer (72mm)"},
      {v:"wholesale", l:"Ulgurji hujjat (A4)"},
      {v:"full",      l:"To'liq (eski)"},
      {v:"compact",   l:"Ixcham"},
    ];
    if (ceTarixStyle.options.length < 3) {
      ceTarixStyle.innerHTML = tarixStyleOpts.map(o =>
        `<option value="${o.v}">${o.l}</option>`).join("");
    }
    ceTarixStyle.value = chekCfg.tarixStyle || "merx";
  }
  if (ceQarzStyle) {
    const qarzStyleOpts = [
      {v:"merx",      l:"MERX brend (zamonaviy)"},
      {v:"thermal",   l:"Termal printer (72mm)"},
      {v:"wholesale", l:"Ulgurji hujjat (A4)"},
      {v:"compact",   l:"Ixcham (eski)"},
    ];
    if (ceQarzStyle.options.length < 3) {
      ceQarzStyle.innerHTML = qarzStyleOpts.map(o =>
        `<option value="${o.v}">${o.l}</option>`).join("");
    }
    ceQarzStyle.value = chekCfg.qarzStyle || "merx";
  }
  // Logo preview
  const logoPreview = document.getElementById("chek-logo-preview");
  if (logoPreview) {
    logoPreview.src   = chekCfg.logo || "";
    logoPreview.style.display = chekCfg.logo ? "block" : "none";
  }

  // SMS shablonlar
  const tplDebt = document.getElementById("s-sms-tpl-debt");
  const tplSale = document.getElementById("s-sms-tpl-sale");
  const tplPaid = document.getElementById("s-sms-tpl-paid");
  if (tplDebt) tplDebt.value = db.settings?.smsTemplateDebt ||
    "{dokon}: Hurmatli {ism}, umumiy qarzingiz: {qarz}. Iltimos to'lovni amalga oshiring.";
  if (tplSale) tplSale.value = db.settings?.smsTemplateSale ||
    "{dokon} | {chek}\n{tovarlar}\nJami: {jami}\nTo'landi: {tolandi}\nQarz: {qarz} ({muddat})";
  if (tplPaid) tplPaid.value = db.settings?.smsTemplatePaid ||
    "{dokon} | {chek}\n{tovarlar}\nJami: {jami} - To'liq qabul qilindi. Rahmat!";

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
async function adminRefreshSyncStats() {
  const sc = id => document.getElementById(id);

  // Avval local ma'lumotlarni ko'rsatamiz (tez)
  if (sc("sc-prod"))  sc("sc-prod").textContent  = (db.products||[]).length + " (local)";
  if (sc("sc-sales")) sc("sc-sales").textContent = (db.sales||[]).length    + " (local)";
  if (sc("sc-custs")) sc("sc-custs").textContent = (db.customers||[]).length+ " (local)";

  // Oxirgi sync vaqti
  const lastSync = db.settings?.lastSyncAt;
  const el = sc("sc-last-sync");
  if (el) {
    if (lastSync) {
      const d    = new Date(lastSync);
      const diff = Math.round((new Date() - d) / 60000);
      el.textContent = diff < 1 ? "Hozirgina"
        : diff < 60   ? diff + " daqiqa oldin"
        : diff < 1440 ? Math.round(diff/60) + " soat oldin"
        : d.toLocaleDateString("uz-UZ");
    } else {
      el.textContent = "Hali sinxronlanmagan";
    }
  }

  // Supabase dan real raqamlarni olamiz
  if (typeof _sb === "undefined" || !_sb) return;
  try {
    const sid = typeof getCloudShopId === "function" ? getCloudShopId() : null;
    if (!sid) return;
    const [rProd, rSales, rCusts] = await Promise.all([
      _sb.from("products").select("id", { count:"exact", head:true }).eq("shop_id", sid),
      _sb.from("sales").select("id",    { count:"exact", head:true }).eq("shop_id", sid),
      _sb.from("customers").select("id",{ count:"exact", head:true }).eq("shop_id", sid),
    ]);
    if (sc("sc-prod"))  sc("sc-prod").textContent  = (rProd.count  ?? "—") + " (cloud)";
    if (sc("sc-sales")) sc("sc-sales").textContent = (rSales.count ?? "—") + " (cloud)";
    if (sc("sc-custs")) sc("sc-custs").textContent = (rCusts.count ?? "—") + " (cloud)";
  } catch(e) {
    console.warn("Cloud statistika xato:", e.message);
  }
}

// ── Tizim statistikasi ────────────────────────────
function adminRefreshStats() {
  const sc = id => document.getElementById(id);
  if (sc("tiz-prod"))  sc("tiz-prod").textContent  = (db.products||[]).length  + " ta";
  if (sc("tiz-sales")) sc("tiz-sales").textContent = (db.sales||[]).length     + " ta";
  if (sc("tiz-custs")) sc("tiz-custs").textContent = (db.customers||[]).length + " ta";
  if (sc("tiz-staff")) sc("tiz-staff").textContent = (db.staff||[]).length     + " ta";

  // localStorage hajmi
  const lsEl = sc("tiz-ls-size");
  if (lsEl) {
    try {
      const key  = typeof getDBKEY === "function" ? getDBKEY() : "merx_v5";
      const size = (localStorage.getItem(key) || "").length;
      const kb   = (size / 1024).toFixed(0);
      const pct  = Math.round(size / 51200); // ~5MB max
      lsEl.textContent = kb + " KB (" + pct + "% ishlatilgan)";
      lsEl.style.color = pct > 80 ? "#DC2626" : pct > 60 ? "#D97706" : "#059669";
    } catch(e) { lsEl.textContent = "—"; }
  }

  // Login ma'lumotlari
  const loginCard = sc("s-login-info-card");
  if (loginCard) loginCard.textContent = db.settings?.adminEmail || "—";
  const loginWrap = sc("s-login-info");
  if (loginWrap) loginWrap.textContent = db.settings?.adminEmail || "—";

  // Do'kon login ma'lumoti (nusxa olish uchun)
  const loginDisplay = sc("tiz-login-display");
  if (loginDisplay) loginDisplay.textContent = db.settings?.adminEmail || "—";
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
        <button onclick="adminEditStaff(${s.id})" title="Tahrirlash"
          style="background:#F3F4F6;border:none;border-radius:8px;padding:7px 10px;
          cursor:pointer;color:#6B7280;flex-shrink:0">
          <i class="ti ti-edit" style="font-size:14px"></i>
        </button>
      </div>`;
  }).join("");
}

// ── SMS UI badge yangilash ────────────────────────
function updateSmsUI() {
  const token  = db.settings?.eskizToken || "";
  const badge  = document.getElementById("sms-status-badge");
  if (!badge) return;
  if (token && db.settings?.eskizTokenExpired) {
    badge.textContent = "⚠️ Token eskirgan — yangilang";
    badge.className   = "bg bg-r";
  } else if (token) {
    badge.textContent = "Ulangan ✅";
    badge.className   = "bg bg-g";
  } else {
    badge.textContent = "Test rejimi";
    badge.className   = "bg bg-gr";
  }
}

// ── Login nusxalash ───────────────────────────────
function adminCopyLogin() {
  const email = db.settings?.adminEmail || "";
  if (!email) { toast("Login ma'lumoti yo'q", "err"); return; }
  const text = `Sayt: merx-rho.vercel.app\nLogin: ${email}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast("✅ Nusxa olindi!"));
  } else {
    const t = document.createElement("textarea");
    t.value = text; document.body.appendChild(t);
    t.select(); document.execCommand("copy");
    document.body.removeChild(t);
    toast("✅ Nusxa olindi!");
  }
}

// ── Kesh tozalash ─────────────────────────────────
function adminClearCache() {
  if (!confirm("Faqat vaqtinchalik kesh tozalanadi. Asosiy ma'lumotlar saqlanib qoladi. Davom etasizmi?")) return;
  try {
    // Faqat merx bo'lmagan kalitlarni o'chirish
    const keys = Object.keys(localStorage);
    let removed = 0;
    keys.forEach(k => {
      if (!k.startsWith("merx_") && !k.startsWith("supabase")) {
        localStorage.removeItem(k);
        removed++;
      }
    });
    adminRefreshStats();
    toast(`✅ Kesh tozalandi (${removed} ta element)`);
  } catch(e) {
    toast("Kesh tozalashda xato", "err");
  }
}

// ── Sozlamalardan xodimni tahrirlash ─────────────
function adminEditStaff(id) {
  // Xodimlar bo'limiga o'tib, o'sha xodimni ochamiz
  nav("xodimlar");
  setTimeout(() => {
    if (typeof openStaffModal === "function") openStaffModal(id);
  }, 150);
}

// ── SMS shablonlarni saqlash ──────────────────────
function saveSmsTemplates() {
  if (!db.settings) db.settings = {};
  const tplDebt = document.getElementById("s-sms-tpl-debt");
  const tplSale = document.getElementById("s-sms-tpl-sale");
  const tplPaid = document.getElementById("s-sms-tpl-paid");
  if (tplDebt) db.settings.smsTemplateDebt = tplDebt.value;
  if (tplSale) db.settings.smsTemplateSale = tplSale.value;
  if (tplPaid) db.settings.smsTemplatePaid = tplPaid.value;
  saveDB();
  toast("✅ SMS shablonlar saqlandi");
}

// ── SMS shablonni standartga qaytarish ────────────
function resetSmsTemplate(type) {
  const defaults = {
    debt: "{dokon}: Hurmatli {ism}, umumiy qarzingiz: {qarz}. Iltimos to'lovni amalga oshiring.",
    sale: "{dokon} | {chek}\n{tovarlar}\nJami: {jami}\nTo'landi: {tolandi}\nQarz: {qarz} ({muddat})",
    paid: "{dokon} | {chek}\n{tovarlar}\nJami: {jami} - To'liq qabul qilindi. Rahmat!"
  };
  const el = document.getElementById("s-sms-tpl-" + type);
  if (el) { el.value = defaults[type]; el.style.borderColor = "#E9A500"; }
}

// ── Chek sozlamalarini saqlash ────────────────────
function saveChekConfig() {
  if (!db.settings) db.settings = {};
  const cfg = db.settings.chekConfig || {};

  cfg.contact = document.getElementById("chek-contact")?.value || "";
  cfg.footer  = document.getElementById("chek-footer")?.value  || "Rahmat! Yana kutamiz 🙏";
  cfg.showStaff        = document.getElementById("chek-show-staff")?.checked !== false;
  cfg.showContact      = document.getElementById("chek-show-contact")?.checked !== false;
  cfg.showDebtHistory  = document.getElementById("chek-show-debt-history")?.checked !== false;
  cfg.posStyle   = document.getElementById("chek-pos-style")?.value   || "merx";
  cfg.tarixStyle = document.getElementById("chek-tarix-style")?.value || "merx";
  cfg.qarzStyle  = document.getElementById("chek-qarz-style")?.value  || "merx";

  db.settings.chekConfig = cfg;
  saveDB();
  toast("✅ Chek sozlamalari saqlandi");
}

// ── Logo yuklash ──────────────────────────────────
function uploadChekLogo(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 200 * 1024) { toast("Logo 200KB dan kichik bo'lishi kerak", "err"); return; }
  const reader = new FileReader();
  reader.onload = e => {
    if (!db.settings) db.settings = {};
    if (!db.settings.chekConfig) db.settings.chekConfig = {};
    db.settings.chekConfig.logo = e.target.result;
    saveDB();
    const prev = document.getElementById("chek-logo-preview");
    if (prev) { prev.src = e.target.result; prev.style.display = "block"; }
    toast("✅ Logo saqlandi");
  };
  reader.readAsDataURL(file);
}

// ── Logo o'chirish ────────────────────────────────
function removeChekLogo() {
  if (!db.settings?.chekConfig) return;
  db.settings.chekConfig.logo = "";
  saveDB();
  const prev = document.getElementById("chek-logo-preview");
  if (prev) { prev.src = ""; prev.style.display = "none"; }
  const inp = document.getElementById("chek-logo-input");
  if (inp) inp.value = "";
  toast("Logo o'chirildi");
}

// ── Chek preview ──────────────────────────────────
function previewChek(style) {
  // Test sotuv ma'lumotlari bilan preview
  const testSale = {
    id: 999, chekNum: "CHK-TEST-001",
    date: new Date().toISOString().slice(0,10),
    time: new Date().toLocaleTimeString("uz-UZ").slice(0,5),
    payType: "naqd",
    items: [
      { name: "Krossovka", variant: "Ko'k / 42", qty: 2, price: 850000, unit: "juft" },
      { name: "Futbolka",  variant: "Oq / L",    qty: 3, price: 120000, unit: "dona" },
    ],
    total: 2060000, paid: 1000000, remaining: 1060000,
    discount: 0, debtCurrency: "uzs",
    customerName: "Alisher Karimov", customerPhone: "+998 90 123 45 67",
    prevDebtUzs: 500000, due: "2026-07-15"
  };
  const staffObj = db.staff?.[0];
  const html = buildReceiptHtml(testSale, {
    shopName: db.shop?.name || "MERX",
    staffName: staffObj?.name || "Kassir",
    style
  });
  const w = window.open("", "_blank", "width=440,height=700");
  if (!w) { toast("Pop-up bloklangan", "err"); return; }
  w.document.write(html);
  w.document.close();
}


// ── Telegram mijoz havolasi ───────────────────────
function _updateTgMijozLink() {
  const el = document.getElementById("tg-mijoz-link");
  if (!el) return;

  // Bot username — @merx_savdo_bot shaklida, emailni filtrlaymiz
  let botUsername = (db.settings?.telegramBotUsername || "").replace(/^@/, "").trim();
  // Email bo'lsa — bo'sh qilamiz (noto'g'ri kiritilgan)
  // Telefon, email, URL bo'lsa tozalaymiz
  if (botUsername.includes("@") || botUsername.includes(".") ||
      /^[+\d\s\-()]{6,}$/.test(botUsername)) {
    botUsername = "";
  }

  // ShopId — session, cloudShopId yoki local dan
  let shopId = typeof getShopId === "function" ? getShopId() : null;
  if (!shopId || shopId === "local") {
    shopId = db.settings?.cloudShopId || null;
  }

  if (!botUsername) {
    el.textContent = "Bot username kiriting (masalan: merx_savdo_bot)";
    el.style.color = "#9CA3AF";
    return;
  }
  if (!shopId) {
    el.textContent = "Do'kon ID kiriting (Cloud tab → Do'kon ID)";
    el.style.color = "#9CA3AF";
    return;
  }

  const link = `https://t.me/${botUsername}?start=${shopId}`;
  el.textContent = link;
  el.style.color = "#065F46";
}

function copyTgLink() {
  const el = document.getElementById("tg-mijoz-link");
  if (!el || el.textContent === "—" || el.style.color === "rgb(156, 163, 175)") {
    toast("Havola yaratilmagan — Bot username va Cloud ulanish kerak", "err");
    return;
  }
  const link = el.textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(() => toast("✅ Havola nusxa olindi!"));
  } else {
    const t = document.createElement("textarea");
    t.value = link; document.body.appendChild(t);
    t.select(); document.execCommand("copy");
    document.body.removeChild(t);
    toast("✅ Havola nusxa olindi!");
  }
}
// ── Cloud Shop ID qo'lda saqlash ──────────────────
function saveCloudShopId() {
  const inp = document.getElementById("s-cloud-shop-id");
  const val = inp?.value.trim();
  if (!val || !val.startsWith("shop_")) {
    toast("Shop ID noto'g'ri — shop_XXXXX ko'rinishida bo'lishi kerak", "err");
    return;
  }
  if (!db.settings) db.settings = {};
  db.settings.cloudShopId = val;
  saveDB();
  const cur = document.getElementById("s-cloud-shop-id-current");
  if (cur) cur.textContent = val;
  if (inp) inp.value = "";
  toast("✅ Shop ID saqlandi: " + val);
  // Havola yangilash
  if (typeof _updateTgMijozLink === "function") _updateTgMijozLink();
}

// renderEgasi da cloud shop id ko'rsatish