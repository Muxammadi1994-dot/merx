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
    else console.warn("\u26a0\ufe0f Bot so'rovi TOKENSIZ — STRICT rejimda rad etiladi");
  } catch (e) {}
  return h;
}

// ══════════════════════════════════════════════════════════════
// 524 (2026-08-21) — SMS ASOSIY TUGMASI (egasining talabi)
// ══════════════════════════════════════════════════════════════
// ILDIZ (2026-08-21 jonli konsol): har sotuv/to'lovda brauzerdan
// to'g'ridan-to'g'ri `notify.eskiz.uz` ga so'rov ketardi va Eskiz uni
// CORS bilan rad etardi:
//   "blocked by CORS policy: No 'Access-Control-Allow-Origin' header"
// Ya'ni SMS HECH QACHON yetib bormagan, lekin har amalda:
//   · konsol xato bilan to'lardi;
//   · Eskizga bekorga so'rov ketardi;
//   · token brauzerdan ochiq yuborilardi (qurilmaga tegib ko'rgan
//     odam uni o'qiy oladi).
// Ustiga — do'konda Telegram bot ishlaydi, ko'p do'konga SMS umuman
// kerak emas.
//
// QARORI (egasi): SMS butun tizimda BITTA TUGMA bilan boshqariladi.
//   · O'CHIQ (standart) — SMS hech qayerda sezilmaydi: so'rov ketmaydi,
//     xabar chiqmaydi, tugmalari ham ko'rinmaydi;
//   · YOQILGAN — Sozlamalarda ko'rsatma chiqadi, do'kon Eskiz kalitini
//     o'zi kiritadi va shundan keyin ishlay boshlaydi.
//
// QO'YILISH JOYI MUHIM: qalqon aynan SHU YERDA, chunki SMS 9 joydan
// chaqiriladi (pos, qarzlar ×5, mijozlar ×3) va hammasi shu funksiyaga
// keladi. Bitta joyda yopilsa — hammasi yopiladi, 9 faylga tegilmaydi.
function smsYoqilganmi() {
  try { return db.settings?.smsEnabled === true; } catch (e) { return false; }
}

// SMS o'chiq bo'lsa — SMS tugmalari hech qayerda ko'rinmaydi.
// Usuli: `body` ga `sms-off` belgisi qo'yiladi, `index.html` dagi bitta
// CSS qoidasi `.sms-only` elementlarni yashiradi. Shu bilan Qarzlar
// ro'yxati qayta chizilganda ham tugmalar o'zi yashirin qoladi —
// har chizuvchiga alohida shart qo'shish kerak emas (kam tegish).
function applySmsVisibility() {
  try {
    document.body.classList.toggle("sms-off", !smsYoqilganmi());
  } catch (e) {}
}

// Sozlamalardagi asosiy tugma
function smsToggle(on) {
  try {
    if (!db.settings) db.settings = {};
    db.settings.smsEnabled = !!on;
    if (typeof saveDB === "function") saveDB();
    if (typeof scheduleCloudSync === "function") scheduleCloudSync();
    applySmsVisibility();
    if (typeof updateSmsUI === "function") updateSmsUI();
    if (typeof toast === "function") {
      toast(on ? "SMS bo'limi yoqildi — Eskiz kalitini kiriting"
               : "SMS bo'limi o'chirildi — hech qayerda ko'rinmaydi");
    }
    // Qarzlar ochiq bo'lsa tugmalar darhol yangilansin
    try { if (typeof renderDebts === "function" &&
              document.querySelector("#p-qarzlar.on")) renderDebts(); } catch (e) {}
  } catch (e) { console.warn("[sms] toggle:", e.message); }
}

async function sendSms(phone, text) {
  // ── QALQON 1: bo'lim umuman yoqilmagan — JIM chiqamiz ──
  // Konsolga ham yozilmaydi: o'chiq bo'lsa hech qayerda sezilmasin.
  if (!smsYoqilganmi()) return { ok: false, skipped: true };

  // ── QALQON 2: yoqilgan, lekin kalit kiritilmagan ──
  const token = (() => { try { return db.settings?.eskizToken || ""; }
                         catch (e) { return ""; } })();
  if (!token) {
    toast("📩 SMS yoqilgan, lekin Eskiz kaliti kiritilmagan — " +
          "Sozlamalar > SMS bo'limiga qarang", "err");
    return { ok: false, skipped: true };
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

  // ⚠️ 2026-08-09 (C-9): NAVBATLI YUBORISH. Avval bitta urinish edi —
  // internet o'sha soniyada uzilsa mijoz cheki HAM, omborchi guruhidagi
  // buyurtma kartochkasi HAM (server ikkalasini shu chaqiruvda yuboradi)
  // butunlay yo'qolardi. Endi botSend (utils.js) navbatga qo'yadi.
  const _payload = {
    customerId: customerId || null,
    customerPhone: customerPhone || null,
    sale,
    // ✅ 2026-08-15: chek MATNI ilovada tayyorlanadi — botdagi chek
    // sotuv cheki bilan bir xil bo'lsin (bo'limlar va tartib bitta
    // manbadan: chekRows). Bot bu matnni ustuvor deb oladi.
    receiptText: (() => {
      try {
        if (typeof chekTelegramText !== "function") return "";
        const _c = (typeof getChekCfg === "function") ? getChekCfg("sotuv") : {};
        return chekTelegramText(sale, _c);
      } catch (e) { return ""; }
    })(),
    shopName: db.shop?.name || db.settings?.name || "MERX",
    shopId: _sid,
    // ⚠️ 2026-08-05: MIJOZ GURUHI (ixtiyoriy) — avvalgidek.
    groupId: (() => {
      try {
        const c = (db.customers || []).find(
          x => String(x.id) === String(customerId));
        const g = (c && c.groupId) ? String(c.groupId).trim() : "";
        return /^-?\d{5,}$/.test(g) ? g : null;
      } catch (e) { return null; }
    })()
  };
  const data = await botSend(botUrl + "?action=send_receipt", _payload,
    "chk-" + (sale?.chekNum || sale?.id || Date.now()));
  if (!data) {
    toast("📮 Chek navbatga qo'yildi — internet qaytishi bilan o'zi yuboriladi");
    return;
  }
  if (data.sent) {
    toast(data.groupSent
      ? "📨 Chek mijozga va guruhga yuborildi"
      : "📨 Chek mijozga Telegram orqali yuborildi");
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

  // ✅ 2026-08-18: `botSend` ORQALI — avval to'g'ridan-to'g'ri `fetch`
  // edi: kalit rad etilsa (401) xabar JIMGINA YO'QOLARDI, na navbat,
  // na qayta urinish bo'lardi. Jonli isbot (B20, 18-avg): CHK-0034-DY
  // (10:25) va CHK-0037-DY (11:31) guruhga tushmagan — Vercel jurnali:
  // "[bot] RAD ETILDI: send_staff_notif". Endi `botSend`: kalitni
  // yangilaydi, 401 da majburan qayta uradi, baribir bo'lmasa
  // NAVBATGA qo'yadi va har 90 soniyada o'zi urinadi.
  // Kalit = chek raqami → navbatda takror nusxa yig'ilmaydi.
  const data = await botSend(botUrl + "?action=send_staff_notif", {
    sale,
    shopName:     db.shop?.name || db.settings?.name || "MERX",
    staffGroupId: staffGroupId,
    shopId:       shopId
  }, "staffnotif:" + (sale.chekNum || sale.id));

  if (data && data.sent) {
    toast("📢 Ishchilar guruhiga bildirishnoma yuborildi");
  } else if (!data) {
    toast("📮 Guruh xabari navbatda — aloqa tiklanganda o'zi ketadi");
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
