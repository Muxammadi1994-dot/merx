// ================================================
// MERX — js/sms.js
// Eskiz SMS API integratsiyasi
// ================================================

async function sendSms(phone, text) {
  const token = db.settings.eskizToken;
  if (!token) {
    toast("\u{1F4E9} SMS (test) \u2192 " + (phone||"mijoz") + " | " + text.slice(0,60) + (text.length>60?"...":""));
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
    if (res.status === "waiting") toast("\u2705 SMS yuborildi: " + phone);
    else toast("SMS yuborilmadi: " + (res.message||"xato"), "err");
  } catch(e) { toast("SMS xatosi — internet bor?","err"); }
}

async function testSms() {
  const phone = prompt("Test SMS uchun telefon raqam (+998...):");
  if (!phone) return;
  await sendSms(phone, "MERX test SMS. Tizim to'g'ri ishlayapti! " + new Date().toLocaleTimeString());
}

// ================================================
// Telegram bot orqali chek yuborish
// ================================================

// Mijozga avtomatik chek yuborish (sotuv yakunlangach chaqiriladi)
async function sendTelegramReceipt(customerId, sale, customerPhone) {
  const botUrl = db.settings?.telegramBotUrl;
  // telefon yoki customerId dan biri bo'lsa yubora olamiz
  if (!botUrl || (!customerId && !customerPhone)) return;

  try {
    const res = await fetch(botUrl + "?action=send_receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customerId || null,
        customerPhone: customerPhone || null,
        sale,
        shopName: db.shop?.name || "MERX"
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

// Sozlamalardan "Ulanishni tekshirish" tugmasi
async function testTelegramBot() {
  const botUrl = ($("s-tg-bot-url")||{value:""}).value.trim();
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
