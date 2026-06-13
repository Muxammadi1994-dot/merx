// ════════════════════════════════════════════════════════════════
// MERX Telegram Bot  |  api/bot.js  |  v1.0  |  2026-06-13
// Vercel Serverless Function — faqat shu fayl kerak
//
// SOZLASH (Vercel → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN   — BotFather dan olingan token
//   SUPABASE_URL         — https://xxxx.supabase.co
//   SUPABASE_KEY         — anon/service key
//   BOT_OWNER_CHAT_ID    — Egasining Telegram chat ID si
//   LOW_STOCK_LIMIT      — (ixtiyoriy) kam qoldiq chegarasi, default: 5
//
// WEBHOOK ULASH (bir marta brauzerda ochiladi):
//   https://merx-rho.vercel.app/api/bot?setup=1
// ════════════════════════════════════════════════════════════════

const TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const SB_URL   = process.env.SUPABASE_URL;
const SB_KEY   = process.env.SUPABASE_KEY;
const OWNER_ID = process.env.BOT_OWNER_CHAT_ID;
const LOW_LIMIT = parseInt(process.env.LOW_STOCK_LIMIT || "5");

const TG = (method, body) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(r => r.json());

// ── Supabase so'rov yordamchi ─────────────────────────────────
async function sb(table, query = "") {
  const res = await fetch(`${SB_URL}/rest/v1/${table}${query}`, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Supabase [${table}]: ${res.status}`);
  return res.json();
}

// ── Supabase PATCH (to'lov qabul qilish uchun) ───────────────
async function sbPatch(table, query, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}${query}`, {
    method: "PATCH",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH [${table}]: ${res.status}`);
  return true;
}

// ── Son formatlash ────────────────────────────────────────────
const fmt = n => Math.round(n || 0).toLocaleString("ru-RU");
const today = () => new Date().toISOString().slice(0, 10);

// ── Ruxsat tekshiruvi ────────────────────────────────────────
// Hozircha faqat OWNER_ID — keyinroq xodim IDlarini
// settings jadvaliga qo'shib kengaytirish mumkin
function isAllowed(chatId) {
  if (!OWNER_ID) return true; // Agar ID o'rnatilmagan — ochiq
  return String(chatId) === String(OWNER_ID);
}

// ════════════════════════════════════════════════════════════════
// KOMANDALAR
// ════════════════════════════════════════════════════════════════

// /start — boshlash xabari
async function cmdStart(chatId) {
  const txt =
    `🟡 *MERX Savdo Tizimi*\n\n` +
    `Salom\\! Men sizning do'koningiz boshqaruvchisiman\\.\n\n` +
    `*Komandalar:*\n` +
    `📊 /hisobot — bugungi savdo hisoboti\n` +
    `💰 /balans — kassa holati\n` +
    `📦 /ombor — kam qolgan tovarlar\n` +
    `🔴 /qarzlar — muddati o'tgan qarzlar\n` +
    `📋 /barcha\\_qarzlar — barcha qarzlar\n` +
    `❓ /help — yordam`;

  await TG("sendMessage", {
    chat_id: chatId,
    text: txt,
    parse_mode: "MarkdownV2",
  });
}

// /hisobot — bugungi savdo hisoboti
async function cmdHisobot(chatId) {
  try {
    const t = today();

    // Bugungi sotuvlar
    const sales = await sb(
      "sales",
      `?date=eq.${t}&order=created_at.desc`
    );

    if (!sales.length) {
      await TG("sendMessage", {
        chat_id: chatId,
        text: `📊 *Bugungi hisobot* — ${t}\n\n⚪ Bugun hali sotuv yo'q\\.`,
        parse_mode: "MarkdownV2",
      });
      return;
    }

    // Hisob-kitob
    const totalSales = sales.length;
    const totalSum   = sales.reduce((s, x) => s + Number(x.total || 0), 0);
    const totalPaid  = sales.reduce((s, x) => s + Number(x.paid || 0), 0);
    const totalDebt  = sales.reduce((s, x) => s + Number(x.remaining || 0), 0);

    // To'lov turi bo'yicha
    const byType = {};
    for (const s of sales) {
      const k = s.pay_type || "boshqa";
      byType[k] = (byType[k] || 0) + Number(s.total || 0);
    }
    const typeLabels = { naqd: "Naqd", karta: "Karta", otkazma: "O'tkazma", nasiya: "Nasiya" };

    // Eng ko'p sotilgan mahsulot
    const itemCounts = {};
    for (const s of sales) {
      for (const it of (s.items || [])) {
        if (!it?.name) continue;
        itemCounts[it.name] = (itemCounts[it.name] || 0) + (it.qty || 1);
      }
    }
    const topItem = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])[0];

    // Xarajatlar
    const xarajat = await sb("xarajatlar", `?date=eq.${t}`);
    const totalExp = xarajat.reduce((s, x) => s + Number(x.amount || 0), 0);
    const foyda    = totalPaid - totalExp;

    // Xabar matni
    let txt =
      `📊 *Bugungi savdo hisoboti*\n` +
      `📅 ${t}\n\n` +
      `🛍 Sotuvlar: *${totalSales} ta*\n` +
      `💵 Jami summa: *${fmt(totalSum)} so'm*\n` +
      `✅ To'langan: *${fmt(totalPaid)} so'm*\n` +
      (totalDebt > 0 ? `🔴 Nasiya: *${fmt(totalDebt)} so'm*\n` : "") +
      `\n📌 *To'lov turlari:*\n`;

    for (const [k, v] of Object.entries(byType)) {
      txt += `  ${typeLabels[k] || k}: ${fmt(v)} so'm\n`;
    }

    if (topItem) {
      txt += `\n🏆 Eng ko'p sotilgan: *${topItem[0]}* \\(${topItem[1]} dona\\)\n`;
    }

    txt +=
      `\n💸 Xarajatlar: *${fmt(totalExp)} so'm*\n` +
      `💰 Toza kirim: *${fmt(foyda)} so'm*`;

    await TG("sendMessage", {
      chat_id: chatId,
      text: escapeMd(txt),
      parse_mode: "MarkdownV2",
    });
  } catch (e) {
    await sendError(chatId, "hisobot", e);
  }
}

// /balans — kassa holati
async function cmdBalans(chatId) {
  try {
    const t = today();

    const [sales, xarajat, settings] = await Promise.all([
      sb("sales",      `?date=eq.${t}`),
      sb("xarajatlar", `?date=eq.${t}`),
      sb("settings",   `?limit=1`),
    ]);

    const rate = Number(settings[0]?.rate || 12800);

    const naqd    = sales.filter(s => s.pay_type === "naqd")
                         .reduce((a, s) => a + Number(s.paid || 0), 0);
    const karta   = sales.filter(s => s.pay_type === "karta")
                         .reduce((a, s) => a + Number(s.paid || 0), 0);
    const otkazma = sales.filter(s => s.pay_type === "otkazma")
                         .reduce((a, s) => a + Number(s.paid || 0), 0);
    const nasiya  = sales.reduce((a, s) => a + Number(s.remaining || 0), 0);
    const kirim   = naqd + karta + otkazma;

    const xar     = xarajat.reduce((a, x) => a + Number(x.amount || 0), 0);
    const foyda   = kirim - xar;
    const foydaUsd = (foyda / rate).toFixed(2);

    const txt =
      `💰 *Kassa holati* — ${t}\n\n` +
      `💵 Naqd: ${fmt(naqd)} so'm\n` +
      `💳 Karta: ${fmt(karta)} so'm\n` +
      `🏦 O'tkazma: ${fmt(otkazma)} so'm\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📥 Jami kirim: *${fmt(kirim)} so'm*\n` +
      `📤 Xarajat: ${fmt(xar)} so'm\n` +
      `━━━━━━━━━━━━━━━\n` +
      `✨ Toza foyda: *${fmt(foyda)} so'm*\n` +
      `    ≈ $${foydaUsd}\n\n` +
      (nasiya > 0 ? `🔴 Bugun nasiyaga: ${fmt(nasiya)} so'm` : `✅ Barcha to'lovlar qabul qilindi`);

    await TG("sendMessage", {
      chat_id: chatId,
      text: escapeMd(txt),
      parse_mode: "MarkdownV2",
    });
  } catch (e) {
    await sendError(chatId, "balans", e);
  }
}

// /ombor — kam qolgan tovarlar
async function cmdOmbor(chatId) {
  try {
    // Barcha mahsulotlarni olish va variants ichidan tekshirish
    const products = await sb("products", `?order=name`);

    const low = [];
    for (const p of products) {
      const variants = p.variants || [];
      for (const v of variants) {
        if (Number(v.qty || 0) <= LOW_LIMIT && Number(v.qty || 0) > 0) {
          low.push({
            name: p.name,
            color: v.color || "—",
            size: v.size || "—",
            qty: v.qty,
          });
        }
      }
      // Nol qolganlar
      const zeroVars = variants.filter(v => Number(v.qty || 0) === 0);
      if (zeroVars.length && zeroVars.length === variants.length) {
        low.push({ name: p.name, color: "barcha", size: "ranglar", qty: 0 });
      }
    }

    if (!low.length) {
      await TG("sendMessage", {
        chat_id: chatId,
        text: `📦 *Ombor holati*\n\n✅ Barcha tovarlar yetarli \\(>${LOW_LIMIT} dona\\)`,
        parse_mode: "MarkdownV2",
      });
      return;
    }

    // Maksimal 30 ta ko'rsatamiz
    const shown = low.slice(0, 30);
    let txt = `📦 *Kam qolgan tovarlar* \\(≤${LOW_LIMIT} dona\\)\n`;
    txt += `Jami: ${low.length} ta variant\n\n`;

    for (const item of shown) {
      const emoji = item.qty === 0 ? "🔴" : item.qty <= 2 ? "🟠" : "🟡";
      txt += `${emoji} ${item.name}\n`;
      txt += `   ${item.color} / ${item.size} — *${item.qty} dona*\n`;
    }

    if (low.length > 30) {
      txt += `\n_...va yana ${low.length - 30} ta_`;
    }

    await TG("sendMessage", {
      chat_id: chatId,
      text: escapeMd(txt),
      parse_mode: "MarkdownV2",
    });
  } catch (e) {
    await sendError(chatId, "ombor", e);
  }
}

// /qarzlar — muddati o'tgan qarzlar
async function cmdQarzlar(chatId, barcha = false) {
  try {
    const t = today();
    const query = barcha
      ? `?remaining=gt.0&order=due`
      : `?remaining=gt.0&due=lt.${t}&order=due`;

    const debts = await sb("sales", query);

    if (!debts.length) {
      const msg = barcha
        ? `✅ Hozirda hech qanday qarz yo'q`
        : `✅ Muddati o'tgan qarz yo'q`;
      await TG("sendMessage", { chat_id: chatId, text: msg });
      return;
    }

    const totalDebt = debts.reduce((a, s) => a + Number(s.remaining || 0), 0);

    let txt = barcha
      ? `📋 *Barcha qarzlar* — ${debts.length} ta\n\n`
      : `🔴 *Muddati o'tgan qarzlar* — ${debts.length} ta\n\n`;

    // Har bir qarz uchun
    for (const d of debts.slice(0, 20)) {
      const name  = d.customer_name || "Noma'lum";
      const phone = d.customer_phone || "—";
      const sum   = fmt(d.remaining);
      const due   = d.due || "—";

      // Necha kun o'tgan?
      let overdue = "";
      if (d.due && d.due < t) {
        const days = Math.floor(
          (new Date(t) - new Date(d.due)) / 86400000
        );
        overdue = ` \\(${days} kun kechikkan\\)`;
      }

      txt += `👤 *${name}*\n`;
      txt += `   📞 ${phone}\n`;
      txt += `   💸 ${sum} so'm\n`;
      txt += `   📅 Muddat: ${due}${overdue}\n\n`;
    }

    if (debts.length > 20) {
      txt += `_...va yana ${debts.length - 20} ta_\n\n`;
    }

    txt += `━━━━━━━━━━━━━━━\n`;
    txt += `💰 Jami qarz: *${fmt(totalDebt)} so'm*`;

    // Tugmalar
    const buttons = [];
    if (!barcha) {
      buttons.push([{ text: "📋 Barcha qarzlarni ko'rish", callback_data: "barcha_qarzlar" }]);
    }

    const opts = {
      chat_id: chatId,
      text: escapeMd(txt),
      parse_mode: "MarkdownV2",
    };
    if (buttons.length) {
      opts.reply_markup = { inline_keyboard: buttons };
    }

    await TG("sendMessage", opts);
  } catch (e) {
    await sendError(chatId, "qarzlar", e);
  }
}

// /help — yordam
async function cmdHelp(chatId) {
  const txt =
    `❓ *MERX Bot — Yordam*\n\n` +
    `*Mavjud komandalar:*\n\n` +
    `📊 /hisobot\n` +
    `Bugungi savdo: sotuvlar soni, jami summa, to'lov turlari, eng ko'p sotilgan mahsulot, xarajatlar, toza foyda\n\n` +
    `💰 /balans\n` +
    `Kassa holati: naqd, karta, o'tkazma, xarajat, toza foyda \\(so'm va dollar\\)\n\n` +
    `📦 /ombor\n` +
    `Kam qolgan tovarlar — ${LOW_LIMIT} dona va undan kam bo'lganlar\n\n` +
    `🔴 /qarzlar\n` +
    `Muddati o'tgan qarzlar ro'yxati\n\n` +
    `📋 /barcha\\_qarzlar\n` +
    `Barcha ochiq qarzlar \\(muddatidan qat'i nazar\\)\n\n` +
    `━━━━━━━━━━━━━━━\n` +
    `Muammo bo'lsa: @merxsupport`;

  await TG("sendMessage", {
    chat_id: chatId,
    text: escapeMd(txt),
    parse_mode: "MarkdownV2",
  });
}

// ════════════════════════════════════════════════════════════════
// KUNLIK AVTOMATIK HISOBOTLAR (cron trigger uchun)
// Vercel Cron yoki tashqaridan GET so'rov bilan chaqiriladi:
//   GET /api/bot?cron=morning  — ertalab 9:00
//   GET /api/bot?cron=evening  — kechqurun 20:00
// ════════════════════════════════════════════════════════════════

async function cronMorning() {
  if (!OWNER_ID) return;
  // Kechagi hisobot
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yd = yesterday.toISOString().slice(0, 10);

  try {
    const sales = await sb("sales", `?date=eq.${yd}`);
    const xar   = await sb("xarajatlar", `?date=eq.${yd}`);

    const kirim  = sales.reduce((a, s) => a + Number(s.paid || 0), 0);
    const chiqim = xar.reduce((a, x) => a + Number(x.amount || 0), 0);

    const txt =
      `☀️ *Xayrli tong\\!*\n\n` +
      `📊 *Kechagi natija \\(${yd}\\):*\n` +
      `🛍 Sotuvlar: ${sales.length} ta\n` +
      `📥 Kirim: ${fmt(kirim)} so'm\n` +
      `📤 Xarajat: ${fmt(chiqim)} so'm\n` +
      `💰 Foyda: *${fmt(kirim - chiqim)} so'm*\n\n` +
      `Bugun ham omad\\! 💪`;

    await TG("sendMessage", {
      chat_id: OWNER_ID,
      text: escapeMd(txt),
      parse_mode: "MarkdownV2",
    });
  } catch (e) {
    await TG("sendMessage", {
      chat_id: OWNER_ID,
      text: `⚠️ Ertalabki hisobotda xato: ${e.message}`,
    });
  }
}

async function cronEvening() {
  if (!OWNER_ID) return;
  const t = today();

  try {
    // Kam qolganlar
    const products = await sb("products", `?order=name`);
    const low = [];
    for (const p of products) {
      for (const v of (p.variants || [])) {
        if (Number(v.qty || 0) <= LOW_LIMIT) {
          low.push(`${p.name} ${v.color || ""} ${v.size || ""} — ${v.qty} dona`);
        }
      }
    }

    // Muddati o'tgan qarzlar
    const debts = await sb("sales", `?remaining=gt.0&due=lt.${t}`);
    const totalDebt = debts.reduce((a, s) => a + Number(s.remaining || 0), 0);

    let txt = `🌙 *Kechki xulosa \\(${t}\\)*\n\n`;

    if (low.length) {
      txt += `📦 *Kam qolgan tovarlar:* ${low.length} ta\n`;
      txt += low.slice(0, 5).map(l => `  • ${l}`).join("\n");
      if (low.length > 5) txt += `\n  _...va yana ${low.length - 5} ta_`;
      txt += "\n\n";
    } else {
      txt += `📦 Ombor holati: ✅ yetarli\n\n`;
    }

    if (debts.length) {
      txt +=
        `🔴 *Muddati o'tgan qarzlar:* ${debts.length} ta\n` +
        `💸 Jami: ${fmt(totalDebt)} so'm\n\n` +
        `/qarzlar — ko'rish`;
    } else {
      txt += `💸 Qarzlar: ✅ muddati o'tgan yo'q`;
    }

    await TG("sendMessage", {
      chat_id: OWNER_ID,
      text: escapeMd(txt),
      parse_mode: "MarkdownV2",
    });
  } catch (e) {
    await TG("sendMessage", {
      chat_id: OWNER_ID,
      text: `⚠️ Kechki hisobotda xato: ${e.message}`,
    });
  }
}

// ════════════════════════════════════════════════════════════════
// YORDAMCHI FUNKSIYALAR
// ════════════════════════════════════════════════════════════════

// MarkdownV2 uchun maxsus belgilarni escape qilish
function escapeMd(text) {
  // Faqat * va _ ni saqlab, qolgan maxsus belgilarni escape qilamiz
  // * va _ allaqachon formatlash uchun ishlatilgan
  return text.replace(/([()[\]{}.!+\-=|<>#~`])/g, "\\$1");
}

async function sendError(chatId, cmd, err) {
  console.error(`[${cmd}]`, err);
  await TG("sendMessage", {
    chat_id: chatId,
    text: `⚠️ /${cmd} komandada xato yuz berdi.\nSupabase ulanishini tekshiring.`,
  });
}

// ════════════════════════════════════════════════════════════════
// VERCEL HANDLER — asosiy kirish nuqtasi
// ════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");

  // ── Webhook o'rnatish (bir marta) ────────────────────────────
  if (req.method === "GET" && req.query?.setup === "1") {
    const host = req.headers.host || "merx-rho.vercel.app";
    const webhookUrl = `https://${host}/api/bot`;
    const result = await TG("setWebhook", { url: webhookUrl });
    return res.json({
      ok: result.ok,
      message: result.ok
        ? `✅ Webhook ulandi: ${webhookUrl}`
        : `❌ Xato: ${result.description}`,
    });
  }

  // ── Cron hisobotlar ──────────────────────────────────────────
  if (req.method === "GET" && req.query?.cron) {
    const cron = req.query.cron;
    // Xavfsizlik: oddiy token tekshiruvi
    const cronToken = req.query.token;
    if (cronToken !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (cron === "morning") await cronMorning();
    if (cron === "evening") await cronEvening();
    return res.json({ ok: true, cron });
  }

  // ── Webhook xabari ───────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, info: "MERX Bot ishlamoqda" });
  }

  let update;
  try {
    update = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(200).json({ ok: false });
  }

  // ── Callback tugmalar ────────────────────────────────────────
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id;
    await TG("answerCallbackQuery", { callback_query_id: cb.id });

    if (chatId && isAllowed(chatId)) {
      if (cb.data === "barcha_qarzlar") {
        await cmdQarzlar(chatId, true);
      }
    }
    return res.status(200).json({ ok: true });
  }

  // ── Oddiy xabar ──────────────────────────────────────────────
  const msg    = update.message;
  if (!msg) return res.status(200).json({ ok: true });

  const chatId = msg.chat?.id;
  const text   = (msg.text || "").trim();

  if (!chatId) return res.status(200).json({ ok: true });

  // Ruxsat tekshiruvi
  if (!isAllowed(chatId)) {
    await TG("sendMessage", {
      chat_id: chatId,
      text: "⛔ Siz bu botdan foydalana olmaysiz.\n\nBot faqat do'kon egasi uchun.",
    });
    return res.status(200).json({ ok: true });
  }

  // Komanda yo'naltirish
  const cmd = text.split(" ")[0].toLowerCase().replace("@", "").split("@")[0];

  switch (cmd) {
    case "/start":             await cmdStart(chatId);         break;
    case "/hisobot":           await cmdHisobot(chatId);       break;
    case "/balans":            await cmdBalans(chatId);        break;
    case "/ombor":             await cmdOmbor(chatId);         break;
    case "/qarzlar":           await cmdQarzlar(chatId, false); break;
    case "/barcha_qarzlar":    await cmdQarzlar(chatId, true);  break;
    case "/help":              await cmdHelp(chatId);          break;
    default:
      if (text.startsWith("/")) {
        await TG("sendMessage", {
          chat_id: chatId,
          text: `❓ Noma'lum komanda: ${cmd}\n\n/help — komandalar ro'yxati`,
        });
      }
  }

  return res.status(200).json({ ok: true });
}
