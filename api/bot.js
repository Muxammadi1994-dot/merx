// ════════════════════════════════════════════════════════════════
// MERX Telegram Bot  |  api/bot.js  |  v1.2  |  2026-06-13
// ════════════════════════════════════════════════════════════════

const TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const SB_URL    = process.env.SUPABASE_URL;
const SB_KEY    = process.env.SUPABASE_KEY;
const OWNER_ID  = process.env.BOT_OWNER_CHAT_ID;
const LOW_LIMIT = parseInt(process.env.LOW_STOCK_LIMIT || "5");
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "merx_savdo_bot";

// Telegram xabar yuborish
async function tg(chatId, text, extra = {}) {
  const body = { chat_id: chatId, text, ...extra };
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
  const phone = normPhone(contact.phone_number);

  try {
    // customers jadvalida shu raqamga mos mijozni topamiz
    const all = await sb("customers", `?select=id,phone,name,telegram_chat_id`);
    const match = all.find(c => {
      const cp = normPhone(c.phone);
      // 998901234567 va 901234567 ikkalasini ham solishtiramiz
      return cp && (cp === phone || cp === phone.replace(/^998/, "") || phone === cp.replace(/^998/, ""));
    });

    if (!match) {
      await tg(chatId,
        "⚠️ Raqamingiz bizning mijozlar bazasida topilmadi.\n\n" +
        "Birinchi xaridingizdan so'ng avtomatik bog'lanadi. Iltimos, do'konda xarid qiling.",
        { reply_markup: { remove_keyboard: true } }
      );
      return;
    }

    // telegram_chat_id ni yangilaymiz (local_id yoki id bo'yicha)
    // Supabase da customers jadvalida primary key har xil bo'lishi mumkin
    // Shuning uchun ikkala variantni ham sinab ko'ramiz
    try {
      await sbPatch("customers", `?local_id=eq.${match.id}`, { telegram_chat_id: String(chatId) });
    } catch {
      await sbPatch("customers", `?id=eq.${match.id}`, { telegram_chat_id: String(chatId) });
    }

    await tg(chatId,
      `✅ Rahmat, ${match.name}!\n\n` +
      "Endi har bir xaridingiz uchun chek shu yerga avtomatik keladi. 🧾",
      { reply_markup: { remove_keyboard: true } }
    );
  } catch (e) {
    console.error("contact xato:", e.message);
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
    sale.paid < sale.total
      ? `To'landi: ${fmt(sale.paid)} so'm`
      : null,
    sale.remaining > 0
      ? `Qarz: ${sale.debtCurrency === "usd" && sale.debtUsd ? "$" + Number(sale.debtUsd).toFixed(2) : fmt(sale.remaining) + " so'm"}`
      : "✅ To'liq to'landi",
    sale.due ? `Muddat: ${sale.due}` : null,
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

  // 1. Avval telefondan qidiramiz (eng ishonchli)
  if (customerPhone) {
    const phone = normPhone(customerPhone);
    const all = await sb("customers", `?select=id,phone,telegram_chat_id`);
    const match = all.find(c => {
      const cp = normPhone(c.phone || "");
      return cp && (cp === phone || cp === phone.replace(/^998/, "") || phone === cp.replace(/^998/, ""));
    });
    if (match?.telegram_chat_id) chatId = match.telegram_chat_id;
  }

  // 2. Telefon orqali topilmasa customerId bo'yicha urinamiz
  if (!chatId && customerId) {
    // local_id bo'yicha qidirish
    const byLocalId = await sb("customers", `?local_id=eq.${customerId}&select=id,telegram_chat_id`);
    if (byLocalId?.[0]?.telegram_chat_id) {
      chatId = byLocalId[0].telegram_chat_id;
    } else {
      // to'g'ridan id bo'yicha
      const byId = await sb("customers", `?id=eq.${customerId}&select=id,telegram_chat_id`);
      if (byId?.[0]?.telegram_chat_id) chatId = byId[0].telegram_chat_id;
    }
  }

  if (!chatId) {
    return { ok: false, sent: false, reason: "no_telegram" };
  }

  const txt = formatReceiptText(sale, shopName || "MERX");
  const chekId = sale.chekNum || ("ID" + sale.id);

  // Sale ma'lumotlarini base64 ga o'tkazib URL ga qo'shamiz
  // (Supabase da hali sync bo'lmagan bo'lishi mumkin)
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

// ── Chek sahifasi (HTML, Print/PDF uchun) ──────────────────────
function renderReceiptHtml(sale, shopName) {
  const payLabels = { naqd: "Naqd pul", karta: "Karta", otkazma: "Bank o'tkazmasi" };
  const items = sale.items || [];
  const itemsSum = items.reduce((a, i) => a + Number(i.price || 0) * Number(i.qty || 0), 0);

  const itemsHtml = items.map(i => `
        <div class="it-row">
          <div class="it-info">
            <div class="it-name">${i.name || ""}</div>
            <div class="it-meta">${i.variant || ""} ${i.variant ? "·" : ""} ${i.qty || 0} ${i.unit || "dona"} × ${fmt(i.price)} so'm</div>
          </div>
          <div class="it-sum">${fmt(Number(i.price || 0) * Number(i.qty || 0))}</div>
        </div>`).join("");

  const remaining = Number(sale.remaining || 0);
  const debtUsd   = sale.debt_usd != null ? Number(sale.debt_usd) : null;
  const debtRow = remaining > 0 ? `
        <div class="sum-row debt"><span>Qarz</span><span>${sale.debt_currency === "usd" && debtUsd ? "$" + debtUsd.toFixed(2) : fmt(remaining) + " so'm"}</span></div>
        ${sale.due ? `<div class="sum-row debt-due"><span>To'lov muddati</span><span>${sale.due}</span></div>` : ""}` : `
        <div class="status-ok">✓ To'liq to'landi</div>`;

  return `<!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Chek ${sale.chek_num || "#" + sale.id}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'DM Sans',sans-serif;background:#F2F0EB;display:flex;justify-content:center;padding:24px 12px}
      .receipt{background:#fff;width:380px;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(13,27,42,.08)}
      .head{background:#0D1B2A;color:#fff;padding:24px 22px 20px;text-align:center}
      .head .logo{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;letter-spacing:.5px}
      .head .sub{font-size:11px;color:#9aa7b5;margin-top:2px;letter-spacing:1px;text-transform:uppercase}
      .head .check{display:inline-block;margin-top:14px;width:36px;height:36px;border-radius:50%;background:#E9A500;color:#0D1B2A;font-size:18px;line-height:36px;font-weight:800}
      .body{padding:20px 22px}
      .meta{display:flex;justify-content:space-between;font-size:11.5px;color:#8a8f98;margin-bottom:16px;padding-bottom:14px;border-bottom:1px dashed #E8E5E0}
      .meta b{color:#0D1B2A;font-weight:700}
      .items{margin-bottom:6px}
      .it-row{display:flex;justify-content:space-between;align-items:flex-start;padding:9px 0;border-bottom:1px solid #F6F4EF}
      .it-row:last-child{border-bottom:none}
      .it-info{flex:1;min-width:0;padding-right:10px}
      .it-name{font-family:'Sora',sans-serif;font-weight:600;font-size:13.5px;color:#0D1B2A}
      .it-meta{font-size:11px;color:#a3a8af;margin-top:2px}
      .it-sum{font-family:'Sora',sans-serif;font-weight:700;font-size:13.5px;color:#0D1B2A;white-space:nowrap}
      .summary{margin-top:14px;padding-top:14px;border-top:1px dashed #E8E5E0}
      .sum-row{display:flex;justify-content:space-between;font-size:13px;color:#666;padding:3px 0}
      .sum-row.debt span:last-child{color:#dc2626;font-weight:700}
      .sum-row.debt-due span:last-child{color:#dc2626}
      .total-row{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:12px;border-top:2px solid #0D1B2A}
      .total-row .lbl{font-family:'Sora',sans-serif;font-weight:700;font-size:14px;color:#0D1B2A;letter-spacing:.5px}
      .total-row .val{font-family:'Sora',sans-serif;font-weight:800;font-size:22px;color:#0D1B2A}
      .pay-info{margin-top:14px;background:#F6F4EF;border-radius:12px;padding:12px 14px}
      .pay-info .sum-row{font-size:12.5px}
      .status-ok{margin-top:8px;text-align:center;background:#ECFDF5;color:#059669;font-weight:700;font-size:12.5px;border-radius:10px;padding:8px;letter-spacing:.3px}
      .footer{padding:18px 22px 24px;text-align:center}
      .footer .thanks{font-family:'Sora',sans-serif;font-weight:700;font-size:14px;color:#0D1B2A;margin-bottom:4px}
      .footer .sub{font-size:11px;color:#a3a8af}
      .badge-row{display:flex;justify-content:space-between;font-size:11px;color:#a3a8af;margin-top:12px;padding-top:12px;border-top:1px dashed #E8E5E0}
      .actions{max-width:380px;margin:14px auto 0;display:flex;gap:10px}
      .actions button{flex:1;border:none;border-radius:12px;padding:12px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;cursor:pointer}
      .btn-print{background:#0D1B2A;color:#fff}
      @media print{
        body{background:#fff;padding:0}
        .receipt{box-shadow:none;border-radius:0;width:100%;max-width:380px}
        .actions{display:none}
      }
    </style></head><body>
    <div>
      <div class="receipt">
        <div class="head">
          <div class="logo">${(shopName||"MERX").toUpperCase()}</div>
          <div class="sub">Savdo cheki</div>
          <div class="check">✓</div>
        </div>
        <div class="body">
          <div class="meta">
            <span>${sale.chek_num || "#" + sale.id}</span>
            <b>${sale.date || ""} ${sale.time || ""}</b>
          </div>
          <div class="items">${itemsHtml}</div>
          <div class="summary">
            <div class="sum-row"><span>Mahsulotlar (${items.length} tur)</span><span>${fmt(itemsSum)} so'm</span></div>
            <div class="total-row">
              <span class="lbl">JAMI</span>
              <span class="val">${fmt(sale.total)}<span style="font-size:13px;font-weight:600"> so'm</span></span>
            </div>
          </div>
          <div class="pay-info">
            <div class="sum-row"><span>To'lov turi</span><span><b style="color:#0D1B2A">${payLabels[sale.pay_type] || sale.pay_type || "—"}</b></span></div>
            <div class="sum-row"><span>To'landi</span><span style="color:#059669;font-weight:700">${fmt(sale.paid)} so'm</span></div>
            ${debtRow}
          </div>
          <div class="badge-row">
            <span>Mijoz: <b style="color:#0D1B2A">${sale.customer_name || "—"}</b></span>
            <span>${shopName || "MERX"}</span>
          </div>
        </div>
        <div class="footer">
          <div class="thanks">Rahmat! Yana kutamiz 🙏</div>
          <div class="sub">${shopName || "MERX"} · ${sale.date || ""}</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn-print" onclick="window.print()">🖨 PDF sifatida saqlash</button>
      </div>
    </div>
    </body></html>`;
}

async function actionRenderReceipt(chekId, saleData) {
  let sale = null;
  let shopName = "MERX";

  // Agar sale ma'lumotlari URL da kelgan bo'lsa — to'g'ridan-to'g'ri ishlatamiz
  if (saleData) {
    try {
      sale = JSON.parse(Buffer.from(saleData, "base64").toString("utf8"));
    } catch {}
  }

  // Supabase dan qidirish
  if (!sale) {
    const isNumericId = /^ID\d+$/.test(chekId);
    const query = isNumericId
      ? `?id=eq.${chekId.slice(2)}&select=*`
      : `?chek_num=eq.${encodeURIComponent(chekId)}&select=*`;
    const rows = await sb("sales", query);
    sale = rows?.[0] || null;
  }

  // Shop nomi
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

  // sale localDB formatida kelsa — Supabase formatiga moslashtirish
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

  return renderReceiptHtml(sale, shopName);
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

  // Chek sahifasi (HTML, Print/PDF) — brauzerda ochiladi
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

  // Kontakt ulashish — mijoz raqamini bog'lash (egasi bo'lmasa ham ochiq)
  if (msg.contact) {
    await handleContact(chatId, msg.contact);
    return res.status(200).json({ ok: true });
  }

  // /start — egasi yoki mijoz, ikkalasi ham ruxsatsiz ishlaydi
  const cmd = text.split(" ")[0].toLowerCase().split("@")[0];
  if (cmd === "/start") {
    await cmdStart(chatId);
    return res.status(200).json({ ok: true });
  }

  // Qolgan barcha komandalar — faqat do'kon egasi
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
