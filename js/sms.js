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
