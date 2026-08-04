// ================================================
// MERX — js/sms.js
// Eskiz SMS + Telegram integratsiyasi
// ================================================

// ⚠️ 2026-08-04: BOT SO'ROVLARIGA AUTH TOKENI.
// `api/bot.js` manzili ochiq edi — kim bilsa soxta chek yoki
// guruh xabari yubora olardi. Endi server tokenni tekshiradi.
// Token ilovada allaqachon bor (egasi ham, xodim ham).
function _botHeaders() {
  const h = { "Content-Type": "application/json" };
  try {
    const t = (typeof getSupabaseTestSession === "function")
      ? getSupabaseTestSession()?.accessToken : null;
    if (t) h["Authorization"] = "Bearer " + t;
  } catch (e) {}
  return h;
}

async function sendSms(phone, text) {
  const token = db.settings.eskizToken;
  if (!token) {
    toast("📩 SMS (test) → " + (phone||"mijoz") + " | " + text.slice(0,60) + (text.length>60?"...":""));
    return;
  }
  try {
    const clean = (phone||"").replace(/\D/g, "");
    if (!clean || clean.length < 9) { toast("Telefon raqam noto'g'ri","err"); return; }
    const resp = await fetch("https://notify.eskiz.uz/api/message/sms/send", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ mobile_phone:clean, message:text, from:db.settings.eskizSender||"MERX", callback_url:"" })
    });
    // Token eskirgan/yaroqsiz bo'lsa, Eskiz odatda 401 qaytaradi —
    // buni "ko'rinadigan" qilamiz, aks holda hech kim sezmaydi.
    if (resp.status === 401) {
      db.settings.eskizTokenExpired = true;
      saveDB();
      if (typeof updateSmsUI === "function") updateSmsUI();
      toast("⚠️ Eskiz token eskirgan — Sozlamalar > SMS bo'limidan yangilang", "err");
      return;
    }
    const res = await resp.json();
    if (res.status === "waiting") {
      toast("✅ SMS yuborildi: " + phone);
      // Muvaffaqiyatli yuborildi — eski ogohlantirish bo'lsa, tozalaymiz
      if (db.settings.eskizTokenExpired) {
        db.settings.eskizTokenExpired = false;
        saveDB();
        if (typeof updateSmsUI === "function") updateSmsUI();
      }
    } else {
      toast("SMS yuborilmadi: " + (res.message||"xato"), "err");
    }
  } catch(e) { toast("SMS xatosi — internet bor?","err"); }
}

async function testSms() {
  const phone = prompt("Test SMS uchun telefon raqam (+998...):");
  if (!phone) return;
  await sendSms(phone, "MERX test SMS. Tizim to'g'ri ishlayapti! " + new Date().toLocaleTimeString());
}

// ================================================
// Telegram bot orqali mijozga chek yuborish
// ================================================

async function sendTelegramReceipt(customerId, sale, customerPhone) {
  const botUrl = db.settings?.telegramBotUrl;
  if (!botUrl || (!customerId && !customerPhone)) return;

  // shopId: cloudShopId yoki session dan — "local" bo'lmasligi kerak
  const _sid = (() => {
    if (db.settings?.cloudShopId && db.settings.cloudShopId !== "local")
      return db.settings.cloudShopId;
    if (typeof getShopId === "function") {
      const s = getShopId();
      if (s && s !== "local") return s;
    }
    return null;
  })();

  try {
    const res = await fetch(botUrl + "?action=send_receipt", {
      method: "POST",
      headers: _botHeaders(),
      body: JSON.stringify({
        customerId: customerId || null,
        customerPhone: customerPhone || null,
        sale,
        shopName: db.shop?.name || db.settings?.name || "MERX",
        shopId: _sid
      })
    });
    const data = await res.json();
    if (data.sent) {
      toast("📨 Chek mijozga Telegram orqali yuborildi");
    }
  } catch (e) {
    console.warn("Telegram chek yuborilmadi:", e.message);
  }
}

// ================================================
// Telegram bot orqali oddiy matn xabar yuborish (qarz eslatmalari)
// ================================================

async function sendTelegramText(customerId, customerPhone, text) {
  const botUrl = db.settings?.telegramBotUrl;
  if (!botUrl || (!customerId && !customerPhone)) {
    return { ok: false, reason: "no_bot_or_customer" };
  }
  // shopId: cloudShopId yoki session dan
  const _txtSid = (() => {
    if (db.settings?.cloudShopId && db.settings.cloudShopId !== "local")
      return db.settings.cloudShopId;
    if (typeof getShopId === "function") {
      const s = getShopId(); if (s && s !== "local") return s;
    }
    return null;
  })();
  try {
    const res = await fetch(botUrl + "?action=send_text", {
      method: "POST",
      headers: _botHeaders(),
      body: JSON.stringify({
        customerId: customerId || null,
        customerPhone: customerPhone || null,
        text,
        shopId: _txtSid
      })
    });
    const data = await res.json();
    if (data.sent) toast("📨 Telegram orqali yuborildi");
    else toast("Telegram: mijoz botga ulanmagan", "info");
    return data;
  } catch (e) {
    console.warn("Telegram xabar yuborilmadi:", e.message);
    return { ok: false, error: e.message };
  }
}

// ================================================
// Telegram bot orqali ishchilar guruhiga bildirishnoma
// ================================================

async function sendStaffNotification(sale) {
  const botUrl       = db.settings?.telegramBotUrl;
  const staffGroupId = db.settings?.staffGroupId;

  // Guruh ID yo'q bo'lsa — jimgina o'tamiz
  if (!botUrl || !staffGroupId) return;

  const shopId = (() => {
    if (db.settings?.cloudShopId && db.settings.cloudShopId !== "local")
      return db.settings.cloudShopId;
    if (typeof getShopId === "function") {
      const s = getShopId(); if (s && s !== "local") return s;
    }
    return null;
  })();

  try {
    const res = await fetch(botUrl + "?action=send_staff_notif", {
      method: "POST",
      headers: _botHeaders(),
      body: JSON.stringify({
        sale,
        shopName:     db.shop?.name || db.settings?.name || "MERX",
        staffGroupId: staffGroupId,
        shopId:       shopId
      })
    });
    const data = await res.json();
    if (data.sent) {
      toast("📢 Ishchilar guruhiga bildirishnoma yuborildi");
    }
  } catch (e) {
    console.warn("Ishchilar guruhi bildirishnomasi yuborilmadi:", e.message);
  }
}

// ================================================
// Ulanishni tekshirish (Sozlamalar sahifasi)
// ================================================

async function testTelegramBot() {
  const botUrl = ($("#s-tg-bot-url")||{value:""}).value.trim();
  if (!botUrl) { toast("Bot manzilini kiriting","err"); return; }

  try {
    const res = await fetch(botUrl);
    const data = await res.json();
    if (data.ok) {
      toast("✅ Bot bilan ulanish muvaffaqiyatli!");
    } else {
      toast("Bot javob berdi, lekin xato bor","err");
    }
  } catch (e) {
    toast("❌ Bot manzilga ulanib bo'lmadi","err");
  }
}
