// ════════════════════════════════════════════════════════════════
// MERX Telegram Bot  |  api/bot.js  |  v1.3  |  2026-06-17
// ════════════════════════════════════════════════════════════════

const TOKEN        = process.env.TELEGRAM_BOT_TOKEN;
const SB_URL       = process.env.SUPABASE_URL;
const SB_KEY       = process.env.SUPABASE_KEY;
const OWNER_ID     = process.env.BOT_OWNER_CHAT_ID;
const STAFF_GROUP  = process.env.STAFF_GROUP_ID;   // ← YANGI: ishchilar guruh ID
const LOW_LIMIT    = parseInt(process.env.LOW_STOCK_LIMIT || "5");
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "merx_savdo_bot";

// Telegram xabar yuborish
async function tg(chatId, text, extra = {}) {
  const body = { chat_id: chatId, text, parse_mode: "HTML", ...extra };
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Telegram callback javob
async function tgAnswer(callbackId) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId }),
  });
}

// Supabase GET
async function sb(table, query = "") {
  const url = `${SB_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${table}: ${res.status} — ${err}`);
  }
  return res.json();
}

// Supabase PATCH (yozuvni yangilash)
async function sbPatch(table, query, body) {
  const url = `${SB_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase PATCH ${table}: ${res.status} — ${err}`);
  }
  return res.json();
}

// Telefon raqamini faqat raqamlarga keltirish (solishtirish uchun)
function normPhone(p) {
  return (p || "").replace(/\D/g, "");
}

const fmt   = n => Math.round(n || 0).toLocaleString("ru-RU");
const today = () => new Date().toISOString().slice(0, 10);

function isAllowed(chatId) {
  if (!OWNER_ID) return true;
  return String(chatId) === String(OWNER_ID);
}

// ── /start ───────────────────────────────────────────────────
async function cmdStart(chatId) {
  // Agar bu do'kon egasi bo'lsa — to'liq menyu
  if (OWNER_ID && String(chatId) === String(OWNER_ID)) {
    const txt =
      "🟡 MERX Savdo Tizimi\n\n" +
      "Salom! Men sizning do'koningiz yordamchisiman.\n\n" +
      "Komandalar:\n" +
      "📊 /hisobot — bugungi savdo\n" +
      "💰 /balans — kassa holati\n" +
      "📦 /ombor — kam qolgan tovarlar\n" +
      "🔴 /qarzlar — muddati o'tgan qarzlar\n" +
      "📋 /barcha_qarzlar — barcha qarzlar\n" +
      "❓ /help — yordam";
    await tg(chatId, txt);
    return;
  }

  // Mijoz uchun — telefon raqamini so'raymiz
  const txt =
    "🟡 MERX do'konimizga xush kelibsiz!\n\n" +
    "Endi xaridlaringiz uchun cheklarni shu botda avtomatik olishingiz mumkin.\n\n" +
    "Davom etish uchun telefon raqamingizni ulashing 👇";

  await tg(chatId, txt, {
    reply_markup: {
      keyboard: [[{ text: "📱 Raqamni ulashish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

// ── Kontakt qabul qilish (mijoz raqamini ulashganda) ──────────
async function handleContact(chatId, contact) {
  const rawPhone = normPhone(contact.phone_number);

  try {
    // Barcha customers ni olamiz
    const all = await sb("customers", `?select=*`);
    console.log(`[handleContact] phone=${rawPhone}, customers=${all?.length}`);

    // Telefon formatlarini solishtirish (998 prefix bilan va siz)
    const match = all.find(c => {
      const cp = normPhone(c.phone || "");
      if (!cp) return false;
      // Har ikki tomonni 9 xonali formatga keltirib solishtirish
      const normalize = p => p.startsWith("998") ? p.slice(3) : p;
      return normalize(cp) === normalize(rawPhone);
    });

    if (!match) {
      console.log(`[handleContact] topilmadi: ${rawPhone}`);
      await tg(chatId,
        "⚠️ Raqamingiz bizning mijozlar bazasida topilmadi.\n\n" +
        "Birinchi xaridingizdan so'ng avtomatik bog'lanadi. Iltimos, do'konda xarid qiling.",
        { reply_markup: { remove_keyboard: true } }
      );
      return;
    }

    console.log(`[handleContact] topildi: id=${match.id}, local_id=${match.local_id}, phone=${match.phone}, existing_chat_id=${match.telegram_chat_id}`);

    // Telefon raqami bo'yicha PATCH — eng ishonchli usul
    let patchResult = null;

    // 1. Telefon bo'yicha yangilash
    try {
      patchResult = await sbPatch("customers", `?phone=eq.${encodeURIComponent(match.phone)}`, { telegram_chat_id: String(chatId) });
      console.log(`[handleContact] phone patch result: ${JSON.stringify(patchResult)}`);
    } catch(e) {
      console.log(`[handleContact] phone patch xato: ${e.message}`);
    }

    // 2. Agar phone patch ishlamasa, local_id bo'yicha
    if (!patchResult?.length && match.local_id != null) {
      try {
        patchResult = await sbPatch("customers", `?local_id=eq.${match.local_id}`, { telegram_chat_id: String(chatId) });
        console.log(`[handleContact] local_id patch: ${JSON.stringify(patchResult)}`);
      } catch(e) {
        console.log(`[handleContact] local_id patch xato: ${e.message}`);
      }
    }

    // 3. id bo'yicha (Supabase auto id)
    if (!patchResult?.length && match.id != null) {
      try {
        patchResult = await sbPatch("customers", `?id=eq.${match.id}`, { telegram_chat_id: String(chatId) });
        console.log(`[handleContact] id patch: ${JSON.stringify(patchResult)}`);
      } catch(e) {
        console.log(`[handleContact] id patch xato: ${e.message}`);
      }
    }

    console.log(`[handleContact] yakuniy natija: ${patchResult?.length ? "✅ yangilandi" : "❌ yangilanmadi"}`);

    await tg(chatId,
      `✅ Rahmat, ${match.name}!\n\n` +
      "Endi har bir xaridingiz uchun chek shu yerga avtomatik keladi. 🧾",
      { reply_markup: { remove_keyboard: true } }
    );
  } catch (e) {
    console.error("[handleContact] xato:", e.message);
    await tg(chatId, `⚠️ Xato yuz berdi: ${e.message}`, { reply_markup: { remove_keyboard: true } });
  }
}

// ── /hisobot ─────────────────────────────────────────────────
async function cmdHisobot(chatId) {
  try {
    const t = today();
    const [sales, xarajat] = await Promise.all([
      sb("sales", `?date=eq.${t}&order=created_at.desc`),
      sb("xarajatlar", `?date=eq.${t}`),
    ]);

    if (!sales.length) {
      await tg(chatId, `📊 Bugungi hisobot — ${t}\n\n⚪ Bugun hali sotuv yo'q`);
      return;
    }

    const totalSales = sales.length;
    const totalSum   = sales.reduce((s, x) => s + Number(x.total || 0), 0);
    const totalPaid  = sales.reduce((s, x) => s + Number(x.paid || 0), 0);
    const totalDebt  = sales.reduce((s, x) => s + Number(x.remaining || 0), 0);
    const totalExp   = xarajat.reduce((s, x) => s + Number(x.amount || 0), 0);
    const foyda      = totalPaid - totalExp;

    // To'lov turi bo'yicha
    const byType = {};
    for (const s of sales) {
      const k = s.pay_type || "boshqa";
      byType[k] = (byType[k] || 0) + Number(s.total || 0);
    }
    const typeLabels = { naqd: "Naqd", karta: "Karta", otkazma: "O'tkazma", nasiya: "Nasiya" };

    // Eng ko'p sotilgan
    const itemCounts = {};
    for (const s of sales) {
      for (const it of (s.items || [])) {
        if (!it?.name) continue;
        itemCounts[it.name] = (itemCounts[it.name] || 0) + (it.qty || 1);
      }
    }
    const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];

    let txt = `📊 Bugungi savdo hisoboti\n`;
    txt += `📅 ${t}\n\n`;
    txt += `🛍 Sotuvlar: ${totalSales} ta\n`;
    txt += `💵 Jami summa: ${fmt(totalSum)} so'm\n`;
    txt += `✅ To'langan: ${fmt(totalPaid)} so'm\n`;
    if (totalDebt > 0) txt += `🔴 Nasiya: ${fmt(totalDebt)} so'm\n`;
    txt += `\n📌 To'lov turlari:\n`;
    for (const [k, v] of Object.entries(byType)) {
      txt += `  ${typeLabels[k] || k}: ${fmt(v)} so'm\n`;
    }
    if (topItem) txt += `\n🏆 Eng ko'p: ${topItem[0]} (${topItem[1]} dona)\n`;
    txt += `\n💸 Xarajatlar: ${fmt(totalExp)} so'm\n`;
    txt += `💰 Toza foyda: ${fmt(foyda)} so'm`;

    await tg(chatId, txt);
  } catch (e) {
    console.error("hisobot xato:", e.message);
    await tg(chatId, `⚠️ Xato: ${e.message}`);
  }
}

// ── /balans ──────────────────────────────────────────────────
async function cmdBalans(chatId) {
  try {
    const t = today();
    const [sales, xarajat, sets] = await Promise.all([
      sb("sales", `?date=eq.${t}`),
      sb("xarajatlar", `?date=eq.${t}`),
      sb("settings", `?limit=1`),
    ]);

    const rate    = Number(sets[0]?.rate || 12800);
    const naqd    = sales.filter(s => s.pay_type === "naqd").reduce((a, s) => a + Number(s.paid || 0), 0);
    const karta   = sales.filter(s => s.pay_type === "karta").reduce((a, s) => a + Number(s.paid || 0), 0);
    const otkazma = sales.filter(s => s.pay_type === "otkazma").reduce((a, s) => a + Number(s.paid || 0), 0);
    const nasiya  = sales.reduce((a, s) => a + Number(s.remaining || 0), 0);
    const kirim   = naqd + karta + otkazma;
    const xar     = xarajat.reduce((a, x) => a + Number(x.amount || 0), 0);
    const foyda   = kirim - xar;

    let txt = `💰 Kassa holati — ${t}\n\n`;
    txt += `💵 Naqd: ${fmt(naqd)} so'm\n`;
    txt += `💳 Karta: ${fmt(karta)} so'm\n`;
    txt += `🏦 O'tkazma: ${fmt(otkazma)} so'm\n`;
    txt += `─────────────────\n`;
    txt += `📥 Jami kirim: ${fmt(kirim)} so'm\n`;
    txt += `📤 Xarajat: ${fmt(xar)} so'm\n`;
    txt += `─────────────────\n`;
    txt += `✨ Toza foyda: ${fmt(foyda)} so'm\n`;
    txt += `   ≈ $${(foyda / rate).toFixed(2)}\n`;
    if (nasiya > 0) {
      txt += `\n🔴 Bugun nasiyaga: ${fmt(nasiya)} so'm`;
    } else {
      txt += `\n✅ Barcha to'lovlar qabul qilindi`;
    }

    await tg(chatId, txt);
  } catch (e) {
    console.error("balans xato:", e.message);
    await tg(chatId, `⚠️ Xato: ${e.message}`);
  }
}

// ── /ombor ───────────────────────────────────────────────────
async function cmdOmbor(chatId) {
  try {
    const products = await sb("products", `?order=name`);

    const low = [];
    for (const p of products) {
      for (const v of (p.variants || [])) {
        if (Number(v.qty || 0) <= LOW_LIMIT) {
          low.push({
            name: p.name,
            color: v.color || "",
            size: v.size || "",
            qty: Number(v.qty || 0),
          });
        }
      }
    }

    if (!low.length) {
      await tg(chatId, `📦 Ombor holati\n\n✅ Barcha tovarlar yetarli (>${LOW_LIMIT} dona)`);
      return;
    }

    let txt = `📦 Kam qolgan tovarlar (≤${LOW_LIMIT} dona)\n`;
    txt += `Jami: ${low.length} ta variant\n\n`;

    for (const item of low.slice(0, 25)) {
      const emoji = item.qty === 0 ? "🔴" : item.qty <= 2 ? "🟠" : "🟡";
      txt += `${emoji} ${item.name}`;
      if (item.color) txt += ` / ${item.color}`;
      if (item.size)  txt += ` / ${item.size}`;
      txt += ` — ${item.qty} dona\n`;
    }
    if (low.length > 25) txt += `\n...va yana ${low.length - 25} ta`;

    await tg(chatId, txt);
  } catch (e) {
    console.error("ombor xato:", e.message);
    await tg(chatId, `⚠️ Xato: ${e.message}`);
  }
}

// ── /qarzlar ─────────────────────────────────────────────────
async function cmdQarzlar(chatId, barcha = false) {
  try {
    const t = today();
    const query = barcha
      ? `?remaining=gt.0&order=due`
      : `?remaining=gt.0&due=lt.${t}&order=due`;

    const debts = await sb("sales", query);

    if (!debts.length) {
      const msg = barcha ? "✅ Hozirda hech qanday qarz yo'q" : "✅ Muddati o'tgan qarz yo'q";
      await tg(chatId, msg);
      return;
    }

    const totalDebt = debts.reduce((a, s) => a + Number(s.remaining || 0), 0);
    let txt = barcha
      ? `📋 Barcha qarzlar — ${debts.length} ta\n\n`
      : `🔴 Muddati o'tgan qarzlar — ${debts.length} ta\n\n`;

    for (const d of debts.slice(0, 15)) {
      const name  = d.customer_name || "Noma'lum";
      const phone = d.customer_phone || "—";
      txt += `👤 ${name}\n`;
      txt += `   📞 ${phone}\n`;
      txt += `   💸 ${fmt(d.remaining)} so'm\n`;
      if (d.due) {
        let overdue = "";
        if (d.due < t) {
          const days = Math.floor((new Date(t) - new Date(d.due)) / 86400000);
          overdue = ` (${days} kun kechikkan)`;
        }
        txt += `   📅 Muddat: ${d.due}${overdue}\n`;
      }
      txt += "\n";
    }

    if (debts.length > 15) txt += `...va yana ${debts.length - 15} ta\n\n`;
    txt += `─────────────────\n`;
    txt += `💰 Jami qarz: ${fmt(totalDebt)} so'm`;

    const opts = {};
    if (!barcha) {
      opts.reply_markup = {
        inline_keyboard: [[{ text: "📋 Barcha qarzlarni ko'rish", callback_data: "barcha_qarzlar" }]],
      };
    }

    await tg(chatId, txt, opts);
  } catch (e) {
    console.error("qarzlar xato:", e.message);
    await tg(chatId, `⚠️ Xato: ${e.message}`);
  }
}

// ── Mijozga chek yuborish ──────────────────────────────────────
function formatReceiptText(sale, shopName) {
  const payLabels = { naqd: "Naqd", karta: "Karta", otkazma: "O'tkazma" };
  const isUsd = sale.debtCurrency === "usd" && sale.debtUsd;

  // Qarz satrlari
  let debtLines = [];
  if (sale.remaining > 0) {
    const newDebt = isUsd ? `$${Number(sale.debtUsd).toFixed(2)}` : `${fmt(sale.remaining)} so'm`;
    if (isUsd && sale.prevDebtUsd > 0) {
      const total = sale.prevDebtUsd + Number(sale.debtUsd);
      debtLines = [
        `Oldingi qarz: $${sale.prevDebtUsd.toFixed(2)}`,
        `+ Yangi qarz: $${Number(sale.debtUsd).toFixed(2)}`,
        `💳 Umumiy qarz: $${total.toFixed(2)}`,
      ];
    } else if (!isUsd && sale.prevDebtUzs > 0) {
      const total = sale.prevDebtUzs + sale.remaining;
      debtLines = [
        `Oldingi qarz: ${fmt(sale.prevDebtUzs)} so'm`,
        `+ Yangi qarz: ${fmt(sale.remaining)} so'm`,
        `💳 Umumiy qarz: ${fmt(total)} so'm`,
      ];
    } else {
      debtLines = [`💳 Qarz: ${newDebt}`];
    }
    if (sale.due) debtLines.push(`Muddat: ${sale.due}`);
  }

  const lines = [
    `🧾 ${shopName} — Chek`,
    `📌 ${sale.chekNum || "#" + sale.id} | ${sale.date} ${sale.time || ""}`,
    "",
    ...(sale.items || []).map(i =>
      `▪ ${i.name} (${i.variant || ""}) × ${i.qty} ${i.unit || ""} = ${fmt((i.price || 0) * (i.qty || 0))} so'm`
    ),
    "",
    `Jami: ${fmt(sale.total)} so'm`,
    `To'lov: ${payLabels[sale.payType] || sale.payType || "—"}`,
    sale.paid < sale.total ? `To'landi: ${fmt(sale.paid)} so'm` : null,
    ...(debtLines.length ? debtLines : ["✅ To'liq to'landi"]),
    "",
    "Rahmat! Yana kutamiz 🙏",
  ];
  return lines.filter(l => l !== null).join("\n");
}

async function actionSendReceipt(body) {
  const { customerId, customerPhone, sale, shopName } = body || {};
  if (!sale) {
    return { ok: false, error: "sale majburiy" };
  }

  let chatId = null;
  console.log(`[sendReceipt] customerId=${customerId}, phone=${customerPhone}`);

  // 1. Avval telefondan qidiramiz
  if (customerPhone) {
    const rawPhone = normPhone(customerPhone);
    const normalize = p => p.startsWith("998") ? p.slice(3) : p;
    const all = await sb("customers", `?select=id,local_id,phone,telegram_chat_id`);
    console.log(`[sendReceipt] customers count=${all?.length}, searching phone=${rawPhone}`);
    const match = all.find(c => {
      const cp = normPhone(c.phone || "");
      return cp && normalize(cp) === normalize(rawPhone);
    });
    console.log(`[sendReceipt] phone match:`, match
      ? `id=${match.id} local_id=${match.local_id} chat_id=${match.telegram_chat_id}`
      : "topilmadi");
    if (match?.telegram_chat_id) chatId = match.telegram_chat_id;
  }

  // 2. customerId bo'yicha urinamiz
  if (!chatId && customerId) {
    const byLocalId = await sb("customers", `?local_id=eq.${customerId}&select=id,telegram_chat_id`);
    if (byLocalId?.[0]?.telegram_chat_id) {
      chatId = byLocalId[0].telegram_chat_id;
    } else {
      const byId = await sb("customers", `?id=eq.${customerId}&select=id,telegram_chat_id`);
      if (byId?.[0]?.telegram_chat_id) chatId = byId[0].telegram_chat_id;
    }
  }

  console.log(`[sendReceipt] chatId=${chatId}`);

  if (!chatId) {
    return { ok: false, sent: false, reason: "no_telegram" };
  }

  const txt = formatReceiptText(sale, shopName || "MERX");
  const chekId = sale.chekNum || ("ID" + sale.id);

  const saleB64 = Buffer.from(JSON.stringify(sale)).toString("base64");
  const receiptUrl = `https://merx-rho.vercel.app/api/bot?action=receipt&id=${encodeURIComponent(chekId)}&d=${encodeURIComponent(saleB64)}`;

  const r = await tg(chatId, txt, {
    reply_markup: {
      inline_keyboard: [[{ text: "📄 Chekni ko'rish / PDF", url: receiptUrl }]],
    },
  });

  if (!r.ok) {
    return { ok: false, sent: false, reason: "telegram_error", detail: r.description };
  }
  return { ok: true, sent: true };
}

// ════════════════════════════════════════════════════════════════
// YANGI: Ishchilar guruhiga sotuv bildirishnomasi yuborish
// ════════════════════════════════════════════════════════════════

async function actionSendStaffNotification(body) {
  const { sale, shopName, staffGroupId } = body || {};
  if (!sale) return { ok: false, error: "sale majburiy" };

  // staffGroupId: frontend'dan keladi (settings dan), yoki env dan
  const groupId = staffGroupId || STAFF_GROUP;
  if (!groupId) return { ok: false, reason: "no_group_id" };

  const payLabels = { naqd: "💵 Naqd", karta: "💳 Karta", otkazma: "🏦 O'tkazma", nasiya: "📋 Nasiya" };
  const chekId   = sale.chekNum || ("ID" + sale.id);
  const shopN    = shopName || "MERX";
  const items    = sale.items || [];
  const total    = Number(sale.total || 0);
  const paid     = Number(sale.paid  || 0);
  const rem      = Number(sale.remaining || 0);
  const payType  = sale.payType || sale.pay_type || "";

  // ── Xabar matni ────────────────────────────────────────────
  // Sarlavha
  let txt = `🆕 <b>Yangi buyurtma</b>\n`;
  txt += `🏷 Buyurtma ID: <b>${chekId}</b>\n`;
  txt += `📅 Vaqt: ${sale.date || ""} ${sale.time || ""}\n`;

  // Mijoz
  const custName  = sale.customerName  || sale.customer_name  || "";
  const custPhone = sale.customerPhone || sale.customer_phone || "";
  if (custName)  txt += `👤 Mijoz: <b>${custName}</b>\n`;
  if (custPhone) txt += `📞 Tel: ${custPhone}\n`;

  // To'lov
  txt += `💳 Mijoz: <b>${payLabels[payType] || payType || "—"}</b>\n`;

  // Mahsulotlar ro'yxati
  txt += `\n📦 <b>Mahsulotlar (${items.length} tur):</b>\n`;
  for (const it of items) {
    const variant = it.variant ? ` <i>${it.variant}</i>` : "";
    const lineSum = fmt((it.price || 0) * (it.qty || 0));
    const artTag  = it.art ? ` <code>${it.art}</code>` : "";
    txt += `▪ ${it.name}${artTag}${variant} × <b>${it.qty}</b> ${it.unit || "dona"}\n`;
    txt += `   = ${lineSum} so'm\n`;
  }

  // Jami
  const debtCur = sale.debtCurrency || sale.debt_currency || "uzs";
  const debtUsd = sale.debtUsd != null ? Number(sale.debtUsd) : (sale.debt_usd != null ? Number(sale.debt_usd) : null);
  const isUsd   = debtCur === "usd" && debtUsd != null && rem > 0;

  txt += `\n💰 <b>Jami: ${fmt(total)} so'm</b>\n`;
  if (rem > 0) {
    txt += `✅ To'landi: ${fmt(paid)} so'm\n`;
    const debtStr = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${fmt(rem)} so'm`;
    txt += `🔴 Qarz: <b>${debtStr}</b>`;
    if (sale.due) txt += ` (muddat: ${sale.due})`;
    txt += "\n";
  } else {
    txt += `✅ To'liq to'landi\n`;
  }

  // Catalog URL — faqat chekId (URL qisqa bo'lishi uchun)
  const catalogUrl = `https://merx-rho.vercel.app/api/bot?action=staff_order&id=${encodeURIComponent(chekId)}`;

  const r = await tg(groupId, txt, {
    reply_markup: {
      inline_keyboard: [[
        { text: "📋 Batafsil ko'rish", url: catalogUrl }
      ]],
    },
  });

  if (!r.ok) {
    console.error("[staffNotif] tg error:", r.description);
    return { ok: false, reason: "telegram_error", detail: r.description };
  }
  return { ok: true, sent: true };
}

// ── Ishchilar uchun buyurtma katalogi (HTML sahifa) ─────────────
function buildStaffOrderHtml(sale, shopName) {
  const chekId   = sale.chekNum || sale.chek_num || ("#" + sale.id);
  const date     = sale.date || "";
  const time     = sale.time || "";
  const items    = (sale.items || []).filter(Boolean);
  const total    = Number(sale.total    || 0);
  const paid     = Number(sale.paid     || 0);
  const rem      = Number(sale.remaining || 0);
  const payType  = sale.payType || sale.pay_type || "";
  const custName  = sale.customerName  || sale.customer_name  || "";
  const fmtN = n => Math.round(n || 0).toLocaleString("ru-RU");

  const payLabels = { naqd: "Naqd", karta: "Karta", otkazma: "O'tkazma", nasiya: "Nasiya" };

  // Mahsulot kartochkalari
  const cardsHtml = items.map(it => {
    const variant = it.variant || "";
    const color   = it.color   || "";
    const size    = it.size    || "";
    // rang teglari
    const tags = [
      color ? `<span class="tag tag-color">${color}</span>` : "",
      size  ? `<span class="tag tag-size">${size}</span>`   : "",
      variant && variant !== color && variant !== size
            ? `<span class="tag tag-var">${variant}</span>` : "",
    ].filter(Boolean).join("");

    const imgHtml = it.image
      ? `<img src="${it.image}" class="item-img" onerror="this.style.display='none'">`
      : `<div class="item-img item-img-ph">${(it.name||"?")[0].toUpperCase()}</div>`;

    const codeTags = [
      it.art     ? `<span class="tag tag-sku">ART ${it.art}</span>`     : "",
      it.barcode ? `<span class="tag tag-bar">BAR ${it.barcode}</span>` : "",
    ].filter(Boolean).join("");

    return `
    <div class="card-item">
      ${imgHtml}
      <div class="item-qty-badge">×${it.qty}</div>
      <div class="item-body">
        <div class="item-name">${it.name}</div>
        ${tags ? `<div class="item-tags">${tags}</div>` : ""}
        ${codeTags ? `<div class="item-tags">${codeTags}</div>` : ""}
        <div class="item-meta">
          <span>${it.qty} ${it.unit || "dona"} × ${fmtN(it.price)} so'm</span>
          <span class="item-sum">${fmtN((it.price || 0) * (it.qty || 0))} so'm</span>
        </div>
      </div>
    </div>`;
  }).join("");

  // To'lov bloki — dollar yoki so'm qarz
  const debtCurH = sale.debtCurrency || sale.debt_currency || "uzs";
  const debtUsdH = sale.debtUsd != null ? Number(sale.debtUsd) : (sale.debt_usd != null ? Number(sale.debt_usd) : null);
  const isUsdH   = debtCurH === "usd" && debtUsdH != null && rem > 0;
  const debtDisp = isUsdH ? `$${debtUsdH.toFixed(2)} USD` : `${fmtN(rem)} so'm`;

  const payHtml = rem > 0
    ? `<div class="pay-row"><span>To'landi</span><b>${fmtN(paid)} so'm</b></div>
       <div class="pay-row debt"><span>Qarz</span><b>${debtDisp}</b></div>
       ${sale.due ? `<div class="pay-row muted"><span>Muddat</span><span>${sale.due}</span></div>` : ""}`
    : `<div class="paid-badge">✅ To'liq to'landi</div>`;

  return `<!DOCTYPE html>
<html lang="uz"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Buyurtma ${chekId}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F2F0EB;min-height:100vh;padding:0 0 32px}

/* HEADER */
.hdr{background:#0D1B2A;color:#fff;padding:18px 16px 14px;text-align:center;position:sticky;top:0;z-index:10}
.hdr-logo{font-family:'Sora',sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;color:#E9A500;text-transform:uppercase}
.hdr-title{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;margin-top:4px}
.hdr-sub{font-size:12px;color:#9aa7b5;margin-top:3px}

/* STATUS CHIP */
.status-bar{background:#1a2d42;display:flex;justify-content:center;gap:16px;padding:10px 16px}
.chip{display:flex;align-items:center;gap:5px;font-size:12px;color:#cdd5de}
.chip b{color:#fff;font-size:13px}
.chip-pay{background:#E9A50022;border-radius:20px;padding:4px 12px;color:#E9A500;font-weight:700;font-size:12.5px}

/* INFO CARD */
.info-card{margin:12px 12px 0;background:#fff;border-radius:12px;padding:12px 14px;display:flex;flex-wrap:wrap;gap:8px}
.info-f{flex:1;min-width:120px}
.info-lbl{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.8px;font-weight:700}
.info-val{font-size:14px;font-weight:700;color:#0D1B2A;margin-top:2px}

/* SECTION TITLE */
.sec-title{padding:14px 14px 6px;font-size:11px;font-weight:800;color:#aaa;text-transform:uppercase;letter-spacing:1px}

/* CARDS */
.card-item{background:#fff;border-radius:12px;margin:6px 12px;padding:12px 14px;display:flex;align-items:flex-start;gap:12px;position:relative;overflow:hidden}
.card-item::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#E9A500}
.item-qty-badge{background:#0D1B2A;color:#E9A500;font-family:'Sora',sans-serif;font-weight:800;font-size:13px;border-radius:8px;min-width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.item-body{flex:1;min-width:0}
.item-name{font-family:'Sora',sans-serif;font-size:14px;font-weight:700;color:#0D1B2A;line-height:1.3}
.item-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.tag{padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
.tag-color{background:#EEF2FF;color:#4F46E5}
.tag-size{background:#F0FDF4;color:#16A34A}
.tag-var{background:#FFF7ED;color:#C2410C}
.item-meta{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:12px;color:#999}
.item-sum{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#0D1B2A}
.item-img{width:64px;height:64px;border-radius:10px;object-fit:cover;flex-shrink:0;border:1px solid #f0ede8}
.item-img-ph{background:#0D1B2A;color:#E9A500;font-family:'Sora',sans-serif;font-weight:800;font-size:22px;display:flex;align-items:center;justify-content:center}
.tag-sku{background:#F0F9FF;color:#0369A1}
.tag-bar{background:#FDF4FF;color:#7E22CE}

/* TOTAL */
.total-card{background:#0D1B2A;margin:10px 12px 0;border-radius:12px;padding:14px 16px}
.total-row{display:flex;justify-content:space-between;align-items:center}
.total-lbl{font-family:'Sora',sans-serif;font-size:12px;color:#9aa7b5;font-weight:700;letter-spacing:.5px}
.total-cnt{font-size:11px;color:#6b7a8d;margin-top:2px}
.total-val{font-family:'Sora',sans-serif;font-weight:800;font-size:24px;color:#fff}
.total-val span{font-size:13px;font-weight:600;color:#9aa7b5}

/* PAYMENT */
.pay-card{background:#fff;margin:8px 12px 0;border-radius:12px;padding:12px 14px}
.pay-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px;color:#555}
.pay-row.debt{color:#DC2626;border-top:1px dashed #fca5a5;margin-top:4px;padding-top:8px;font-weight:700}
.pay-row.muted{color:#aaa;font-size:12px}
.paid-badge{text-align:center;background:#ECFDF5;color:#059669;font-weight:700;font-size:13px;padding:8px;border-radius:8px}

/* FOOTER */
.footer{text-align:center;margin-top:20px;font-size:11px;color:#bbb;padding:0 12px}

/* DESKTOP */
@media(min-width:640px){
  body{padding:24px 16px 48px}
  .hdr{border-radius:16px 16px 0 0;max-width:900px;margin:0 auto}
  .status-bar{max-width:900px;margin:0 auto}
  .page-inner{max-width:900px;margin:0 auto}
  .info-card{margin:12px 0 0}
  .sec-title{padding:14px 0 6px}
  .items-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0}
  .card-item{margin:0}
  .total-card,.pay-card{margin:10px 0 0}
  .footer{max-width:900px;margin:20px auto 0}
}
</style></head>
<body>

<div class="hdr">
  <div class="hdr-logo">${shopName.toUpperCase()} · BUYURTMA</div>
  <div class="hdr-title">${chekId}</div>
  <div class="hdr-sub">📅 ${date} ${time}</div>
</div>

<div class="status-bar">
  <div class="chip">🏬 <b>${items.reduce((a,i)=>a+(i.qty||0),0)}</b> dona</div>
  <div class="chip">📦 <b>${items.length}</b> tur</div>
  <div class="chip-pay">${payLabels[payType] || payType || "—"}</div>
</div>

${custName ? `<div class="info-card">
  <div class="info-f"><div class="info-lbl">Mijoz</div><div class="info-val">👤 ${custName}</div></div>
  ${sale.customerPhone || sale.customer_phone ? `<div class="info-f"><div class="info-lbl">Telefon</div><div class="info-val">📞 ${sale.customerPhone || sale.customer_phone}</div></div>` : ""}
</div>` : ""}

<div class="page-inner">
<div class="sec-title">Mahsulotlar (${items.length} tur)</div>
<div class="items-grid">
${cardsHtml}
</div>

<div class="total-card">
  <div class="total-row">
    <div>
      <div class="total-lbl">JAMI SUMMA</div>
      <div class="total-cnt">${items.length} tur · ${items.reduce((a,i)=>a+(i.qty||0),0)} dona</div>
    </div>
    <div class="total-val">${fmtN(total)}<span> so'm</span></div>
  </div>
</div>

<div class="pay-card">
  ${payHtml}
</div>

<div class="footer">@${BOT_USERNAME} · ${shopName}</div>
</div>

</body></html>`;
}

async function actionRenderStaffOrder(chekId, saleData) {
  let sale = null;
  let shopName = "MERX";

  if (saleData) {
    try {
      sale = JSON.parse(Buffer.from(saleData, "base64").toString("utf8"));
    } catch {}
  }

  if (!sale) {
    const isNumericId = /^ID\d+$/.test(chekId);
    const query = isNumericId
      ? `?id=eq.${chekId.slice(2)}&select=*`
      : `?chek_num=eq.${encodeURIComponent(chekId)}&select=*`;
    const rows = await sb("sales", query);
    sale = rows?.[0] || null;
  }

  try {
    const sets = await sb("settings", `?limit=1&select=shop_name`);
    shopName = sets?.[0]?.shop_name || "MERX";
  } catch {}

  // items dagi sku lar bo'yicha products dan rasmlarni olish
  if (sale?.items?.length) {
    try {
      const skus = [...new Set(sale.items.map(i => i.sku).filter(Boolean))];
      if (skus.length) {
        const skuFilter = skus.map(s => `sku.eq.${encodeURIComponent(s)}`).join(",");
        const prods = await sb("products", `?or=(${skuFilter})&select=sku,image`);
        const imgMap = {};
        for (const p of (prods || [])) { if (p.sku && p.image) imgMap[p.sku] = p.image; }
        sale.items = sale.items.map(i => ({ ...i, image: i.image || imgMap[i.sku] || null }));
      }
    } catch(e) { console.warn("[staffOrder] rasm olishda xato:", e.message); }
  }

  if (!sale) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Topilmadi</title></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#F2F0EB">
        <div style="text-align:center;color:#888"><div style="font-size:40px">⚠️</div><div>Buyurtma topilmadi: ${chekId}</div></div>
      </body></html>`;
  }

  return buildStaffOrderHtml(sale, shopName);
}

// ── Chek sahifasi (HTML, Print/PDF uchun) ──────────────────────
function buildReceiptHtml(sale, opts) {
  opts = opts || {};
  const shopName   = opts.shopName   || "MERX";
  const staffName  = opts.staffName  || "—";
  const botUser    = (opts.botUsername || "").replace(/^@/, "");
  const receiptUrl = opts.receiptUrl || "";

  const chekNum   = sale.chekNum || sale.chek_num || ("#" + sale.id);
  const date      = sale.date || "";
  const time      = sale.time || "";
  const payType   = sale.payType || sale.pay_type || "";
  const custName  = sale.customerName || sale.customer_name || "";
  const custPhone = sale.customerPhone || sale.customer_phone || "";
  const total     = Number(sale.total || 0);
  const paid      = Number(sale.paid || 0);
  const remaining = Number(sale.remaining || 0);
  const discount  = Number(sale.discount || 0);
  const subtotal  = Number(sale.subtotal || total + discount);
  const due       = sale.due || "";
  const note      = sale.note || "";
  const debtCur   = sale.debtCurrency || sale.debt_currency || "uzs";
  const debtUsd   = sale.debtUsd   != null ? Number(sale.debtUsd)   : (sale.debt_usd   != null ? Number(sale.debt_usd)   : null);
  const prevUsd   = sale.prevDebtUsd != null ? Number(sale.prevDebtUsd) : null;
  const prevUzs   = sale.prevDebtUzs != null ? Number(sale.prevDebtUzs) : null;
  const isUsd     = debtCur === "usd" && debtUsd != null;
  const items     = (sale.items || []).filter(Boolean);

  const payLabels = { naqd: "Naqd pul", karta: "Karta", otkazma: "Bank o'tkazmasi" };
  const fmtN      = n => Math.round(n || 0).toLocaleString("ru-RU");

  const itemsHtml = items.map((i, idx) => {
    const iTotal  = (i.price || 0) * (i.qty || 0);
    const boxLine = i.qtyBox && i.inBox
      ? `<div class="rc-it-box">${i.qtyBox} karobka × ${fmtN((i.price||0) * (i.inBox||1))} so'm/karobka</div>` : "";
    return `<div class="rc-it">
      <div class="rc-it-n">${idx + 1}</div>
      <div class="rc-it-info">
        <div class="rc-it-name">${i.name || ""}</div>
        ${i.variant ? `<div class="rc-it-var">${i.variant}</div>` : ""}
        <div class="rc-it-calc">${i.qty} ${i.unit || "dona"} × ${fmtN(i.price)} so'm</div>
        ${boxLine}
      </div>
      <div class="rc-it-sum">${fmtN(iTotal)}</div>
    </div>`;
  }).join('<div class="rc-sep"></div>');

  const discHtml = discount > 0
    ? `<div class="rc-pr"><span>Chegirma</span><span class="rc-red">−${fmtN(discount)} so'm</span></div>` : "";

  let debtHtml = "";
  if (remaining > 0) {
    if (isUsd && prevUsd > 0) {
      const tot = prevUsd + debtUsd;
      debtHtml = `
        <div class="rc-pr rc-muted"><span>Oldingi qarz</span><span>$${prevUsd.toFixed(2)}</span></div>
        <div class="rc-pr rc-muted"><span>+ Yangi qarz</span><span>$${debtUsd.toFixed(2)}</span></div>
        <div class="rc-pr rc-debt"><span>Umumiy qarz</span><span>$${tot.toFixed(2)} USD</span></div>`;
    } else if (!isUsd && prevUzs > 0) {
      const tot = prevUzs + remaining;
      debtHtml = `
        <div class="rc-pr rc-muted"><span>Oldingi qarz</span><span>${fmtN(prevUzs)} so'm</span></div>
        <div class="rc-pr rc-muted"><span>+ Yangi qarz</span><span>${fmtN(remaining)} so'm</span></div>
        <div class="rc-pr rc-debt"><span>Umumiy qarz</span><span>${fmtN(tot)} so'm</span></div>`;
    } else {
      const dAmt = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${fmtN(remaining)} so'm`;
      debtHtml = `<div class="rc-pr rc-debt"><span>Qarz</span><span>${dAmt}</span></div>`;
    }
    if (due) debtHtml += `<div class="rc-pr rc-muted"><span>To'lov muddati</span><span class="rc-red">${due}</span></div>`;
  } else {
    debtHtml = `<div class="rc-paid">✓ To'liq to'landi</div>`;
  }

  const footerBotHtml  = botUser    ? `<div class="rc-bot">🤖 Cheklarni Telegramda olish: <b>@${botUser}</b></div>` : "";
  const footerPdfHtml  = receiptUrl ? `<div class="rc-pdf"><a href="${receiptUrl}" target="_blank">📄 PDF sifatida saqlash</a></div>` : "";
  const noteHtml       = note       ? `<div class="rc-meta-row"><span>Izoh</span><b>${note}</b></div>` : "";
  const staffHtml      = staffName && staffName !== "—" ? `<div class="rc-meta-row"><span>Kassir</span><b>${staffName}</b></div>` : "";
  const custHtml       = custName   ? `<div class="rc-div"></div>
      <div class="rc-meta-row"><span>Mijoz</span><b>${custName}</b></div>
      ${custPhone ? `<div class="rc-meta-row"><span>Telefon</span><b>${custPhone}</b></div>` : ""}` : "";

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F2F0EB;display:flex;justify-content:center;padding:20px 8px}
.rc-wrap{width:360px;max-width:100%}
.rc{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(13,27,42,.1)}
.rc-head{background:#0D1B2A;color:#fff;padding:18px 18px 14px;text-align:center}
.rc-logo{font-family:'Sora',sans-serif;font-size:22px;font-weight:800;letter-spacing:1px}
.rc-sub{font-size:10px;color:#9aa7b5;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px}
.rc-meta{padding:11px 16px;border-bottom:1px dashed #E8E5E0;font-size:11.5px;color:#666}
.rc-meta-row{display:flex;justify-content:space-between;padding:2px 0}
.rc-meta-row b{color:#0D1B2A;font-weight:600}
.rc-div{border-top:1px solid #F0EDE8;margin:6px 0}
.rc-items-lbl{padding:9px 16px 5px;font-size:10px;font-weight:700;color:#bbb;letter-spacing:1px;text-transform:uppercase}
.rc-items{padding:0 16px}
.rc-it{display:flex;align-items:flex-start;padding:9px 0;gap:8px}
.rc-sep{border-top:1px dashed #F0EDE8}
.rc-it-n{font-size:10.5px;color:#ccc;font-weight:700;min-width:14px;padding-top:2px}
.rc-it-info{flex:1;min-width:0}
.rc-it-name{font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#0D1B2A}
.rc-it-var{font-size:11px;color:#999;margin-top:1px}
.rc-it-calc{font-size:11px;color:#bbb;margin-top:1px}
.rc-it-box{font-size:10px;color:#c4a35a;margin-top:1px}
.rc-it-sum{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#0D1B2A;white-space:nowrap;padding-top:2px}
.rc-total{margin:0 16px;padding:9px 0;border-top:2px solid #0D1B2A;border-bottom:1px dashed #E8E5E0;display:flex;justify-content:space-between;align-items:center}
.rc-total-lbl{font-family:'Sora',sans-serif;font-weight:700;font-size:12.5px;color:#0D1B2A;letter-spacing:.5px}
.rc-total-cnt{font-size:10px;color:#bbb;margin-top:1px}
.rc-total-val{font-family:'Sora',sans-serif;font-weight:800;font-size:19px;color:#0D1B2A}
.rc-pay{padding:9px 16px;background:#F9F8F6;border-bottom:1px dashed #E8E5E0}
.rc-pr{display:flex;justify-content:space-between;font-size:12.5px;color:#555;padding:2.5px 0}
.rc-pr.rc-muted span{color:#bbb!important}
.rc-pr.rc-debt{border-top:1px dashed #fca5a5;margin-top:4px;padding-top:5px;font-weight:700;color:#dc2626}
.rc-red{color:#dc2626!important}
.rc-paid{font-size:12px;font-weight:700;color:#059669;text-align:center;padding:5px 0;background:#ECFDF5;border-radius:8px;margin-top:4px}
.rc-foot{padding:12px 16px 16px;text-align:center}
.rc-thanks{font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:#0D1B2A}
.rc-date{font-size:10px;color:#bbb;margin-top:2px}
.rc-bot{font-size:11px;color:#229ED9;margin-top:8px}
.rc-pdf{margin-top:6px}
.rc-pdf a{font-size:11.5px;color:#0D1B2A;font-weight:600;text-decoration:none;background:#F0EDE8;padding:5px 14px;border-radius:20px;display:inline-block}
.rc-actions{max-width:360px;margin:10px auto 0;display:flex;gap:8px}
.rc-actions button{flex:1;border:none;border-radius:10px;padding:11px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}
.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #E8E5E0!important}
@media print{
  body{background:#fff;padding:0}
  .rc-wrap,.rc{border-radius:0;box-shadow:none;width:72mm}
  .rc-actions{display:none}
}
</style></head><body>
<div class="rc-wrap">
  <div class="rc">
    <div class="rc-head">
      <div class="rc-logo">${shopName.toUpperCase()}</div>
      <div class="rc-sub">Savdo cheki</div>
    </div>

    <div class="rc-meta">
      <div class="rc-meta-row"><span>Chek</span><b>${chekNum}</b></div>
      <div class="rc-meta-row"><span>Sana / Vaqt</span><b>${date} ${time}</b></div>
      ${staffHtml}
      ${custHtml}
      ${noteHtml ? `<div class="rc-div"></div>${noteHtml}` : ""}
    </div>

    <div class="rc-items-lbl">Mahsulotlar</div>
    <div class="rc-items">${itemsHtml}</div>

    <div class="rc-total">
      <div>
        <div class="rc-total-lbl">JAMI</div>
        <div class="rc-total-cnt">${items.length} tur · ${items.reduce((a,i)=>a+(i.qty||0),0)} dona</div>
      </div>
      <div class="rc-total-val">${fmtN(total)}<span style="font-size:12px;font-weight:600"> so'm</span></div>
    </div>

    <div class="rc-pay">
      <div class="rc-pr"><span>To'lov turi</span><b style="color:#0D1B2A">${payLabels[payType] || payType || "—"}</b></div>
      ${discHtml}
      <div class="rc-pr"><span>To'landi</span><span style="color:#059669;font-weight:700">${fmtN(paid)} so'm</span></div>
      ${debtHtml}
    </div>

    <div class="rc-foot">
      <div class="rc-thanks">Rahmat! Yana kutamiz 🙏</div>
      <div class="rc-date">${shopName} · ${date}</div>
      ${footerBotHtml}
      ${footerPdfHtml}
    </div>
  </div>
  <div class="rc-actions">
    <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
    <button class="btn-c" onclick="window.close ? window.close() : history.back()">Yopish</button>
  </div>
</div>
</body></html>`;
}

async function actionRenderReceipt(chekId, saleData) {
  let sale = null;
  let shopName = "MERX";

  if (saleData) {
    try {
      sale = JSON.parse(Buffer.from(saleData, "base64").toString("utf8"));
    } catch {}
  }

  if (!sale) {
    const isNumericId = /^ID\d+$/.test(chekId);
    const query = isNumericId
      ? `?id=eq.${chekId.slice(2)}&select=*`
      : `?chek_num=eq.${encodeURIComponent(chekId)}&select=*`;
    const rows = await sb("sales", query);
    sale = rows?.[0] || null;
  }

  try {
    const sets = await sb("settings", `?limit=1&select=shop_name`);
    shopName = sets?.[0]?.shop_name || "MERX";
  } catch {}

  if (!sale) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Chek topilmadi</title></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#F2F0EB">
        <div style="text-align:center;color:#888">
          <div style="font-size:40px;margin-bottom:8px">⚠️</div>
          <div>Chek topilmadi: ${chekId}</div>
        </div>
      </body></html>`;
  }

  if (!sale.chek_num && sale.chekNum) {
    sale = {
      ...sale,
      chek_num:      sale.chekNum,
      pay_type:      sale.payType,
      customer_name: sale.customerName,
      debt_currency: sale.debtCurrency,
      debt_usd:      sale.debtUsd,
    };
  }

  return buildReceiptHtml(sale, { shopName });
}

// ── /help ────────────────────────────────────────────────────
async function cmdHelp(chatId) {
  const txt =
    "❓ MERX Bot — Yordam\n\n" +
    "/hisobot — Bugungi savdo: sotuvlar, summa, foyda\n\n" +
    "/balans — Kassa: naqd, karta, xarajat, foyda\n\n" +
    `/ombor — Kam qolgan tovarlar (≤${LOW_LIMIT} dona)\n\n` +
    "/qarzlar — Muddati o'tgan qarzlar\n\n" +
    "/barcha_qarzlar — Barcha ochiq qarzlar";
  await tg(chatId, txt);
}

// ════════════════════════════════════════════════════════════════
// VERCEL HANDLER
// ════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Webhook o'rnatish
  if (req.method === "GET" && req.query?.setup === "1") {
    const host = req.headers.host || "merx-rho.vercel.app";
    const webhookUrl = `https://${host}/api/bot`;
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    }).then(x => x.json());
    return res.json({
      ok: r.ok,
      message: r.ok ? `✅ Webhook ulandi: ${webhookUrl}` : `❌ ${r.description}`,
    });
  }

  // Chek sahifasi (HTML) — mijoz uchun
  if (req.method === "GET" && req.query?.action === "receipt") {
    try {
      const chekId   = String(req.query.id || "");
      const saleData = req.query.d || null;
      if (!chekId) return res.status(400).send("Chek ID kerak");
      const html = await actionRenderReceipt(chekId, saleData);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    } catch (e) {
      console.error("receipt xato:", e.message);
      return res.status(500).send("Xato: " + e.message);
    }
  }

  // Ishchilar buyurtma katalogi (HTML) — YANGI
  if (req.method === "GET" && req.query?.action === "staff_order") {
    try {
      const chekId   = String(req.query.id || "");
      const saleData = req.query.d || null;
      if (!chekId) return res.status(400).send("Chek ID kerak");
      const html = await actionRenderStaffOrder(chekId, saleData);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    } catch (e) {
      console.error("staff_order xato:", e.message);
      return res.status(500).send("Xato: " + e.message);
    }
  }

  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, info: "MERX Bot ishlamoqda" });
  }

  // MERX dan: mijozga chek yuborish
  if (req.query?.action === "send_receipt") {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ ok: false, error: "invalid_json" });
    }
    try {
      const result = await actionSendReceipt(body);
      return res.status(200).json(result);
    } catch (e) {
      console.error("send_receipt xato:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // MERX dan: ishchilar guruhiga bildirishnoma — YANGI
  if (req.query?.action === "send_staff_notif") {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ ok: false, error: "invalid_json" });
    }
    try {
      const result = await actionSendStaffNotification(body);
      return res.status(200).json(result);
    } catch (e) {
      console.error("send_staff_notif xato:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  let update;
  try {
    update = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(200).json({ ok: false });
  }

  // Callback tugmalar
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id;
    await tgAnswer(cb.id);
    if (chatId && isAllowed(chatId) && cb.data === "barcha_qarzlar") {
      await cmdQarzlar(chatId, true);
    }
    return res.status(200).json({ ok: true });
  }

  const msg    = update.message;
  if (!msg) return res.status(200).json({ ok: true });

  const chatId = msg.chat?.id;
  const text   = (msg.text || "").trim();
  if (!chatId) return res.status(200).json({ ok: true });

  if (msg.contact) {
    await handleContact(chatId, msg.contact);
    return res.status(200).json({ ok: true });
  }

  const cmd = text.split(" ")[0].toLowerCase().split("@")[0];
  if (cmd === "/start") {
    await cmdStart(chatId);
    return res.status(200).json({ ok: true });
  }

  if (!isAllowed(chatId)) {
    await tg(chatId, "⛔ Bu komanda faqat do'kon egasi uchun.\n\n/start — qaytadan boshlash");
    return res.status(200).json({ ok: true });
  }

  switch (cmd) {
    case "/hisobot":        await cmdHisobot(chatId);        break;
    case "/balans":         await cmdBalans(chatId);         break;
    case "/ombor":          await cmdOmbor(chatId);          break;
    case "/qarzlar":        await cmdQarzlar(chatId, false); break;
    case "/barcha_qarzlar": await cmdQarzlar(chatId, true);  break;
    case "/help":           await cmdHelp(chatId);           break;
    default:
      if (text.startsWith("/")) {
        await tg(chatId, `❓ Noma'lum komanda: ${cmd}\n\n/help — komandalar ro'yxati`);
      }
  }

  return res.status(200).json({ ok: true });
}
