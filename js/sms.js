// ================================================
// MERX — js/sms.js  |  v1.1
// Eskiz SMS + Telegram integratsiyasi
// ================================================

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
    const res = await resp.json();
    if (res.status === "waiting") toast("✅ SMS yuborildi: " + phone);
    else toast("SMS yuborilmadi: " + (res.message||"xato"), "err");
  } catch(e) { toast("SMS xatosi — internet bor?","err"); }
}

async function testSms() {
  const phone = prompt("Test SMS uchun telefon raqam (+998...):");
  if (!phone) return;
  await sendSms(phone, "MERX test SMS. Tizim to'g'ri ishlayapti! " + new Date().toLocaleTimeString());
}

// ================================================
// Telegram: mijozga chek yuborish
// ================================================

async function sendTelegramReceipt(customerId, sale, customerPhone) {
  const botUrl = db.settings?.telegramBotUrl;
  if (!botUrl || (!customerId && !customerPhone)) return;

  try {
    const res = await fetch(botUrl + "?action=send_receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId:    customerId    || null,
        customerPhone: customerPhone || null,
        sale,
        shopName: db.shop?.name || db.settings?.name || "MERX"
      })
    });
    const data = await res.json();
    if (data.sent) toast("📨 Chek mijozga Telegram orqali yuborildi");
  } catch (e) {
    console.warn("Telegram chek yuborilmadi:", e.message);
  }
}

// ================================================
// Telegram: ishchilar guruhiga sotuv bildirishnomasi
// ================================================

async function sendStaffNotification(sale) {
  const botUrl       = db.settings?.telegramBotUrl;
  const staffGroupId = db.settings?.staffGroupId;

  // Debug: nima bo'layotganini console da ko'rish
  console.log("[staffNotif] botUrl:", botUrl || "YO'Q");
  console.log("[staffNotif] staffGroupId:", staffGroupId || "YO'Q");

  if (!botUrl) {
    console.warn("[staffNotif] botUrl sozlanmagan — o'tkazib yuborildi");
    return;
  }
  if (!staffGroupId) {
    console.warn("[staffNotif] staffGroupId sozlanmagan — o'tkazib yuborildi");
    return;
  }

  try {
    const res = await fetch(botUrl + "?action=send_staff_notif", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sale,
        shopName:     db.shop?.name || db.settings?.name || "MERX",
        staffGroupId: staffGroupId
      })
    });
    const data = await res.json();
    console.log("[staffNotif] server javobi:", data);
    if (data.sent) {
      toast("📢 Ishchilar guruhiga bildirishnoma yuborildi");
    } else {
      console.warn("[staffNotif] yuborilmadi:", data);
    }
  } catch (e) {
    console.error("[staffNotif] xato:", e.message);
  }
}

// ================================================
// Sozlamalar: Bot ulanishini tekshirish
// ================================================

async function testTelegramBot() {
  const botUrl = ($("s-tg-bot-url")||{value:""}).value.trim();
  if (!botUrl) { toast("Bot manzilini kiriting","err"); return; }

  try {
    const res  = await fetch(botUrl);
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
