// ════════════════════════════════════════════════════════════════
// MERX Telegram Bot  |  api/bot.js  |  v1.3  |  2026-06-17
// ════════════════════════════════════════════════════════════════

const TOKEN        = process.env.TELEGRAM_BOT_TOKEN;
const SB_URL       = process.env.SUPABASE_URL;
const SB_KEY       = process.env.SUPABASE_KEY;
const OWNER_ID     = process.env.BOT_OWNER_CHAT_ID;  // Superadmin chat ID
const STAFF_GROUP  = process.env.STAFF_GROUP_ID;
const LOW_LIMIT    = parseInt(process.env.LOW_STOCK_LIMIT || "5");
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "merx_savdo_bot";

// ── Multi-tenant: chatId → shopId xaritasi (RAM cache) ──────
// Har so'rovda Supabase ga bormayslik uchun vaqtinchalik cache
const _shopCache = new Map(); // chatId → { shopId, shopName, isOwner, ts }
const CACHE_TTL  = 10 * 60 * 1000; // 10 daqiqa

// chatId uchun shopId ni topamiz
async function getShopCtx(chatId) {
  const cid = String(chatId);

  // Cache tekshiruv
  const cached = _shopCache.get(cid);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached;

  // 1. Superadmin — alohida holat
  if (OWNER_ID && cid === String(OWNER_ID)) {
    const ctx = { shopId: null, shopName: "MERX", isOwner: true, isSuperAdmin: true, ts: Date.now() };
    _shopCache.set(cid, ctx);
    return ctx;
  }

  // 2. customers jadvalidan topamiz (mijoz login qilgan)
  try {
    const custs = await sb("customers", `?telegram_chat_id=eq.${cid}&select=id,shop_id&limit=1`);
    if (custs?.[0]?.shop_id) {
      const shopId = custs[0].shop_id;
      // Shop nomini olamiz
      const shops = await sb("shops", `?id=eq.${shopId}&select=name&limit=1`);
      const shopName = shops?.[0]?.name || "MERX";
      const ctx = { shopId, shopName, isOwner: false, isSuperAdmin: false, ts: Date.now() };
      _shopCache.set(cid, ctx);
      return ctx;
    }
  } catch(e) { console.warn("getShopCtx customers xato:", e.message); }

  // 3. shops jadvalidan owner tekshiruv
  try {
    const shops = await sb("shops", `?select=id,name`);
    for (const shop of (shops || [])) {
      // settings jadvalidan owner chatId ni topamiz
      try {
        const sets = await sb("settings", `?shop_id=eq.${shop.id}&select=telegram_owner_chat_id&limit=1`);
        if (sets?.[0]?.telegram_owner_chat_id === cid) {
          const ctx = { shopId: shop.id, shopName: shop.name, isOwner: true, isSuperAdmin: false, ts: Date.now() };
          _shopCache.set(cid, ctx);
          return ctx;
        }
      } catch(e) {}
    }
  } catch(e) { console.warn("getShopCtx shops xato:", e.message); }

  // Topilmadi
  return { shopId: null, shopName: "MERX", isOwner: false, isSuperAdmin: false, ts: Date.now() };
}

// chatId uchun deep link shop tanlash (start parametridan)
async function setShopForUser(chatId, shopId) {
  const cid = String(chatId);
  try {
    const shops = await sb("shops", `?id=eq.${shopId}&select=id,name&limit=1`);
    if (!shops?.[0]) return null;
    const shopName = shops[0].name;
    // Cache ni yangi do'kon bilan yangilaymiz (eski do'konni almashtiramiz)
    const ctx = { shopId, shopName, isOwner: false, isSuperAdmin: false, ts: Date.now() };
    _shopCache.set(cid, ctx);

    // Agar customers jadvalida bu chatId bilan boshqa shop_id saqlangan bo'lsa
    // yangi do'kon uchun ham telefon so'raymiz (alohida profil)
    try {
      const existing = await sb("customers",
        `?telegram_chat_id=eq.${cid}&shop_id=eq.${shopId}&select=id&limit=1`);
      if (!existing?.[0]) {
        // Bu do'konda hali ulanmagan — telefon so'raymiz
        ctx.needsContact = true;
      }
    } catch(e) {}

    return ctx;
  } catch(e) {
    console.warn("setShopForUser xato:", e.message);
    return null;
  }
}

// sb() ga shop_id filter qo'shuvchi yordamchi
function sbShop(table, shopId, query = "") {
  const sep = query.includes("?") ? "&" : "?";
  if (!shopId) return sb(table, query); // superadmin — filtr yo'q
  return sb(table, `${query}${query ? "&" : "?"}shop_id=eq.${shopId}`);
}

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
  // Superadmin har doim ruxsat
  if (OWNER_ID && String(chatId) === String(OWNER_ID)) return true;
  // Boshqa foydalanuvchilar — /hisobot kabi komandalarga ruxsatsiz
  // (shopCtx da isOwner bo'lsa ruxsat beriladi — quyida tekshiriladi)
  return false;
}

async function isShopOwner(chatId) {
  if (OWNER_ID && String(chatId) === String(OWNER_ID)) return true;
  const ctx = await getShopCtx(chatId);
  return ctx.isOwner === true;
}

// ── /start ───────────────────────────────────────────────────
async function cmdStart(chatId, param) {
  const cid = String(chatId);

  // ── Superadmin ──
  if (OWNER_ID && cid === String(OWNER_ID)) {
    await tg(chatId,
      "🛡 MERX Super Admin\n\n" +
      "Barcha do'konlarni boshqarish uchun:\n" +
      "📊 /hisobot — bugungi savdo\n" +
      "💰 /balans — kassa holati\n" +
      "📦 /ombor — kam qolgan tovarlar\n" +
      "🔴 /qarzlar — muddati o'tgan qarzlar\n" +
      "❓ /help — yordam"
    );
    return;
  }

  // ── Deep link: /start shop_XXXXX ──
  // Do'kon egasi yoki mijoz havoladan kirgan
  if (param && param.startsWith("shop_")) {
    const shopId = param;
    const ctx = await setShopForUser(chatId, shopId);
    if (ctx) {
      // Do'kon egasimi tekshiramiz
      const isOwner = await isShopOwner(chatId);
      if (isOwner) {
        await tg(chatId,
          "🏪 " + ctx.shopName + "\n\n" +
          "Do'kon egasi sifatida kirildi.\n\n" +
          "📊 /hisobot — bugungi savdo\n" +
          "💰 /balans — kassa holati\n" +
          "📦 /ombor — kam qolgan tovarlar\n" +
          "🔴 /qarzlar — muddati o'tgan qarzlar\n" +
          "❓ /help — yordam"
        );
      } else {
        // Mijoz — telefon so'raymiz
        await tg(chatId,
          "🟡 " + ctx.shopName + "\n\n" +
          "Xush kelibsiz! Xaridlaringiz uchun cheklarni shu botda avtomatik olishingiz mumkin.\n\n" +
          "Davom etish uchun telefon raqamingizni ulashing 👇",
          {
            reply_markup: {
              keyboard: [[{ text: "📱 Raqamni ulashish", request_contact: true }]],
              resize_keyboard: true, one_time_keyboard: true,
            },
          }
        );
      }
      return;
    }
  }

  // ── Oddiy /start — do'kon tanlanmagan ──
  // Barcha faol do'konlar ro'yxatini ko'rsatamiz
  try {
    const shops = await sb("shops", "?active=eq.true&select=id,name&order=name");
    if (shops?.length === 1) {
      // Bitta do'kon — avtomatik tanlash
      await cmdStart(chatId, shops[0].id);
      return;
    }
    if (shops?.length > 1) {
      const btns = shops.map(s => [{ text: "🏪 " + s.name, callback_data: "shop:" + s.id }]);
      await tg(chatId,
        "🟡 MERX Savdo tizimi\n\nQaysi do'kondan xarid qildingiz?",
        { reply_markup: { inline_keyboard: btns } }
      );
      return;
    }
  } catch(e) { console.warn("shops list xato:", e.message); }

  // Fallback
  await tg(chatId,
    "🟡 MERX do'koniga xush kelibsiz!\n\n" +
    "Davom etish uchun telefon raqamingizni ulashing 👇",
    {
      reply_markup: {
        keyboard: [[{ text: "📱 Raqamni ulashish", request_contact: true }]],
        resize_keyboard: true, one_time_keyboard: true,
      },
    }
  );
}

// ── Kontakt qabul qilish (mijoz raqamini ulashganda) ──────────
async function handleContact(chatId, contact) {
  const rawPhone = normPhone(contact.phone_number);

  try {
    // shopId — cache dan olamiz (start bosganida saqlangan)
    const ctx = await getShopCtx(chatId);
    const shopId = ctx.shopId;
    const shopFilter = shopId ? `&shop_id=eq.${shopId}` : "";

    // Shu do'kon customers ni olamiz (yoki shop_id yo'q bo'lsa barchani)
    const all = await sb("customers", `?select=*${shopFilter}`);
    console.log(`[handleContact] phone=${rawPhone}, shopId=${shopId}, customers=${all?.length}`);

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
      // Agar shop_id bilan topilmasa — barchada qidiramiz
      if (shopFilter) {
        const allGlobal = await sb("customers", `?select=*`);
        const globalMatch = allGlobal?.find(c => {
          const cp = normPhone(c.phone || "");
          if (!cp) return false;
          const normalize = p => p.startsWith("998") ? p.slice(3) : p;
          return normalize(cp) === normalize(rawPhone);
        });
        if (globalMatch) {
          // Topildi, lekin boshqa do'konda — bildiramiz
          await tg(chatId,
            "⚠️ Raqamingiz boshqa do'konda topildi.\n\n" +
            "Siz hozir tanlagan do'konda hali xarid qilmagansiz.\n" +
            "Do'konda birinchi xaridingizdan so'ng avtomatik bog'lanadi.",
            { reply_markup: { remove_keyboard: true } }
          );
          return;
        }
      }
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
    const matchShopId = match.shop_id || shopId || null;

    // Cache ga shopId ni saqlaymiz
    if (matchShopId) {
      const shops = await sb("shops", `?id=eq.${matchShopId}&select=name&limit=1`).catch(() => []);
      const shopName = shops?.[0]?.name || "MERX";
      _shopCache.set(String(chatId), { shopId: matchShopId, shopName, isOwner: false, isSuperAdmin: false, ts: Date.now() });
    }

    // 1. Telefon bo'yicha yangilash
    try {
      patchResult = await sbPatch("customers",
        `?phone=eq.${encodeURIComponent(match.phone)}${matchShopId ? "&shop_id=eq."+matchShopId : ""}`,
        { telegram_chat_id: String(chatId) }
      );
      console.log(`[handleContact] phone patch result: ${JSON.stringify(patchResult)}`);
    } catch(e) {
      console.log(`[handleContact] phone patch xato: ${e.message}`);
    }

    // 2. Agar phone patch ishlamasa, local_id bo'yicha
    if (!patchResult?.length && match.local_id != null) {
      try {
        patchResult = await sbPatch("customers", `?local_id=eq.${match.local_id}${matchShopId?"&shop_id=eq."+matchShopId:""}`, { telegram_chat_id: String(chatId) });
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
    const ctx = await getShopCtx(chatId);
    const sid = ctx.shopId;
    const sidFilter = sid ? `&shop_id=eq.${sid}` : "";
    const [sales, xarajat] = await Promise.all([
      sb("sales", `?date=eq.${t}&order=created_at.desc${sidFilter}`),
      sb("xarajatlar", `?date=eq.${t}${sidFilter}`),
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

    const shopName = ctx.shopName || "MERX";
    let txt = `📊 ${shopName} — Bugungi savdo\n`;
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
    const ctx = await getShopCtx(chatId);
    const sid = ctx.shopId;
    const sidFilter = sid ? `&shop_id=eq.${sid}` : "";
    const [sales, xarajat, sets] = await Promise.all([
      sb("sales", `?date=eq.${t}${sidFilter}`),
      sb("xarajatlar", `?date=eq.${t}${sidFilter}`),
      sid ? sb("settings", `?shop_id=eq.${sid}&limit=1`) : sb("settings", `?limit=1`),
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
    const ctx = await getShopCtx(chatId);
    const sid = ctx.shopId;
    const sidFilter = sid ? `&shop_id=eq.${sid}` : "";
    const products = await sb("products", `?order=name${sidFilter}`);

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
    const ctx = await getShopCtx(chatId);
    const sid = ctx.shopId;
    const sidFilter = sid ? `&shop_id=eq.${sid}` : "";
    const query = barcha
      ? `?remaining=gt.0&order=due${sidFilter}`
      : `?remaining=gt.0&due=lt.${t}&order=due${sidFilter}`;

    const debts = await sb("sales", query);

    if (!debts.length) {
      const msg = barcha ? "✅ Hozirda hech qanday qarz yo'q" : "✅ Muddati o'tgan qarz yo'q";
      await tg(chatId, msg);
      return;
    }

    const totalDebt = debts.reduce((a, s) => a + Number(s.remaining || 0), 0);
    const shopName2 = ctx.shopName || "MERX";
    let txt = barcha
      ? `📋 ${shopName2} — Barcha qarzlar (${debts.length} ta)\n\n`
      : `🔴 ${shopName2} — Muddati o'tgan (${debts.length} ta)\n\n`;

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
  const payLabels = { naqd: "Naqd", karta: "Karta", otkazma: "O'tkazma", aralash: "Aralash" };
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
    ...(sale.payType === "aralash" && (sale.payBreakdown || sale.pay_breakdown)
      ? Object.entries(sale.payBreakdown || sale.pay_breakdown).map(([m,v]) => `  • ${payLabels[m]||m}: ${fmt(v)} so'm`)
      : []),
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

  // shop_id ni body dan olamiz
  const shopId = body.shopId || body.shop_id || null;
  const shopFilter = shopId ? `&shop_id=eq.${shopId}` : "";

  // 1. Avval telefondan qidiramiz
  if (customerPhone) {
    const rawPhone = normPhone(customerPhone);
    const normalize = p => p.startsWith("998") ? p.slice(3) : p;
    const all = await sb("customers", `?select=id,local_id,phone,telegram_chat_id${shopFilter}`);
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
    const byLocalId = await sb("customers", `?local_id=eq.${customerId}&select=id,telegram_chat_id${shopFilter}`);
    if (byLocalId?.[0]?.telegram_chat_id) {
      chatId = byLocalId[0].telegram_chat_id;
    } else {
      const byId = await sb("customers", `?id=eq.${customerId}&select=id,telegram_chat_id${shopFilter}`);
      if (byId?.[0]?.telegram_chat_id) chatId = byId[0].telegram_chat_id;
    }
  }

  console.log(`[sendReceipt] chatId=${chatId}`);

  if (!chatId) {
    return { ok: false, sent: false, reason: "no_telegram" };
  }

  const txt = formatReceiptText(sale, shopName || "MERX");
  const chekId = sale.chekNum || ("ID" + sale.id);

  // URL da image (base64) bo'lmasligi kerak — juda katta bo'ladi
  const saleLight = {
    ...sale,
    items: (sale.items || []).map(({ image, ...rest }) => rest)
  };
  const saleB64 = Buffer.from(JSON.stringify(saleLight)).toString("base64");
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

// MERX dan: oddiy matn xabar yuborish (qarz eslatmalari uchun)
async function actionSendTextMessage(body) {
  const { customerId, customerPhone, text } = body || {};
  if (!text) return { ok: false, error: "text majburiy" };

  let chatId = null;

  const shopId2 = body.shopId || body.shop_id || null;
  const shopFilter2 = shopId2 ? `&shop_id=eq.${shopId2}` : "";

  if (customerPhone) {
    const rawPhone = normPhone(customerPhone);
    const normalize = p => p.startsWith("998") ? p.slice(3) : p;
    const all = await sb("customers", `?select=id,local_id,phone,telegram_chat_id${shopFilter2}`);
    const match = all.find(c => {
      const cp = normPhone(c.phone || "");
      return cp && normalize(cp) === normalize(rawPhone);
    });
    if (match?.telegram_chat_id) chatId = match.telegram_chat_id;
  }

  if (!chatId && customerId) {
    const byLocalId = await sb("customers", `?local_id=eq.${customerId}&select=id,telegram_chat_id${shopFilter2}`);
    if (byLocalId?.[0]?.telegram_chat_id) {
      chatId = byLocalId[0].telegram_chat_id;
    } else {
      const byId = await sb("customers", `?id=eq.${customerId}&select=id,telegram_chat_id${shopFilter2}`);
      if (byId?.[0]?.telegram_chat_id) chatId = byId[0].telegram_chat_id;
    }
  }

  if (!chatId) return { ok: false, sent: false, reason: "no_telegram" };

  const r = await tg(chatId, text);
  return { ok: true, sent: true, result: r };
}

async function actionSendStaffNotification(body) {
  const { sale, shopName, staffGroupId, shopId } = body || {};
  if (!sale) return { ok: false, error: "sale majburiy" };

  // staffGroupId: frontend dan keladi (settings dan), yoki env dan
  const groupId = staffGroupId || STAFF_GROUP;
  if (!groupId) return { ok: false, reason: "no_group_id" };
  const sid = shopId || null;

  const payLabels = { naqd: "💵 Naqd", karta: "💳 Karta", otkazma: "🏦 O'tkazma", nasiya: "📋 Nasiya", aralash: "🔀 Aralash" };
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

  // Mahsulotlar ro'yxati — omborchi uchun katta va aniq
  const totalBoxesTxt = items.reduce((a, it) => a + (it.qtyBox || 0), 0);
  txt += `\n📦 <b>${items.length} xil tovar · ${totalBoxesTxt || items.reduce((a,it)=>a+(it.qty||0),0)} pochka</b>\n`;
  txt += `${"─".repeat(28)}\n`;
  for (const it of items) {
    const qtyBox  = it.qtyBox || 0;
    const color   = it.color   || "";
    const size    = it.size    || "";
    const art     = it.art     || "";
    const lineSum = fmt((it.price || 0) * (it.qty || 0));
    txt += `\n📌 <b>${it.name}</b>`;
    if (art) txt += ` <code>${art}</code>`;
    txt += `\n`;
    if (qtyBox) txt += `   📦 <b>${qtyBox} pochka</b> (${it.qty} ${it.unit || "dona"})\n`;
    else        txt += `   🔢 <b>${it.qty} ${it.unit || "dona"}</b>\n`;
    if (color)  txt += `   🎨 Rang: <b>${color}</b>\n`;
    if (size)   txt += `   📏 O'lcham: <b>${size}</b>\n`;
    txt += `   💵 ${fmt(it.price)} × ${it.qty} = <b>${lineSum} so'm</b>\n`;
  }
  txt += `${"─".repeat(28)}\n`;

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

  // Catalog URL — shopId bilan (multi-tenant)
  const shopParam  = sid ? `&shop=${encodeURIComponent(sid)}` : "";
  const catalogUrl = `https://merx-rho.vercel.app/api/bot?action=staff_order&id=${encodeURIComponent(chekId)}${shopParam}`;

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
  const chekId    = sale.chekNum || sale.chek_num || ("#" + sale.id);
  const date      = sale.date || "";
  const time      = sale.time || "";
  const items     = (sale.items || []).filter(Boolean);
  const total     = Number(sale.total     || 0);
  const paid      = Number(sale.paid      || 0);
  const rem       = Number(sale.remaining || 0);
  const payType   = sale.payType || sale.pay_type || "";
  const custName  = sale.customerName  || sale.customer_name  || "";
  const custPhone = sale.customerPhone || sale.customer_phone || "";
  const fmtN = n => Math.round(n || 0).toLocaleString("ru-RU");

  // Jami pochkalar (barcha itemlar)
  const totalBoxes = items.reduce((a, it) => a + (it.qtyBox || 0), 0);
  const totalTur   = items.length;

  const payLabels = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", nasiya:"Nasiya", aralash:"Aralash" };

  // Mahsulot kartochkalari
  const cardsHtml = items.map((it, idx) => {
    const color   = it.color   || "";
    const size    = it.size    || "";
    const art     = it.art     || "";
    const barcode = it.barcode || "";
    const qtyBox  = it.qtyBox  || 0;
    const unit    = it.unit    || "dona";
    const lineTotal = (it.price || 0) * (it.qty || 0);

    // Rang rangi
    const colorBg = (() => {
      const cm = {
        "qora":"#1A1A1A","oq":"#F0F0F0","ko'k":"#1E40AF","yashil":"#16A34A",
        "qizil":"#DC2626","sariq":"#EAB308","kulrang":"#6B7280",
        "jigarrang":"#92400E","binafsha":"#7C3AED","pushti":"#EC4899",
        "to'q ko'k":"#1E3A8A","navy":"#1E3A8A","orange":"#EA580C"
      };
      const cl = color.toLowerCase();
      for (const [k,v] of Object.entries(cm)) { if (cl.includes(k)) return v; }
      return "#888";
    })();

    const imgHtml = it.image
      ? `<img src="${it.image}" class="item-img" onclick="toggleDone(${idx},this)" onerror="this.style.display='none'">`
      : "";

    const qtyLabel = qtyBox
      ? `${qtyBox} pochka / ${it.qty} ${unit}`
      : `${it.qty} ${unit}`;

    return `
<div class="card" id="card-${idx}">
  ${imgHtml ? `<div class="card-img-wrap">${imgHtml}<div class="card-done-overlay" id="done-${idx}">✅ TAYYOR</div></div>` : `<div class="card-done-bar" id="done-${idx}" style="display:none">✅ TAYYOR</div>`}
  <div class="card-body">
    <div class="qty-row">
      <span class="qty-badge">×${qtyBox || it.qty} ${qtyBox ? "pochka" : unit}</span>
    </div>
    <div class="card-name">${it.name}</div>
    <div class="card-attrs">
      ${color ? `<div class="attr-row">
        <span class="attr-k">Rang</span>
        <span class="attr-v"><span class="color-dot" style="background:${colorBg}"></span>${color}</span>
      </div>` : ""}
      ${size ? `<div class="attr-row">
        <span class="attr-k">O'lcham</span>
        <span class="attr-v">${size}</span>
      </div>` : ""}
      ${art ? `<div class="attr-row">
        <span class="attr-k">Artikul</span>
        <span class="attr-v code">${art}</span>
      </div>` : ""}
      ${barcode ? `<div class="attr-row">
        <span class="attr-k">Barcode</span>
        <span class="attr-v code">${barcode}</span>
      </div>` : ""}
    </div>
    <div class="price-row">
      <span class="price-per">${qtyLabel} × ${fmtN(it.price)} so'm</span>
      <span class="price-sum">${fmtN(lineTotal)} so'm</span>
    </div>
  </div>
  <button class="done-btn" onclick="toggleDone(${idx},null)" id="dbtn-${idx}">
    Tayyor belgilash
  </button>
</div>`;
  }).join("");

  // To'lov
  const debtCurH = sale.debtCurrency || sale.debt_currency || "uzs";
  const debtUsdH = sale.debtUsd != null ? Number(sale.debtUsd) : (sale.debt_usd != null ? Number(sale.debt_usd) : null);
  const isUsdH   = debtCurH === "usd" && debtUsdH != null && rem > 0;
  const debtDisp = isUsdH ? `$${debtUsdH.toFixed(2)} USD` : `${fmtN(rem)} so'm`;
  const payBreakdownH = sale.payBreakdown || sale.pay_breakdown || null;
  const mixedHtml = payType === "aralash" && payBreakdownH
    ? Object.entries(payBreakdownH)
        .filter(([m,v]) => m !== "qarz" && v > 0)
        .map(([m,v]) => `<div class="pay-row muted"><span>${payLabels[m]||m}</span><span>${fmtN(v)} so'm</span></div>`)
        .join("")
    : "";
  const payHtml = rem > 0
    ? `${mixedHtml}
       <div class="pay-row"><span>To'landi</span><b>${fmtN(paid)} so'm</b></div>
       <div class="pay-row debt"><span>Qarz</span><b>${debtDisp}</b></div>
       ${sale.due ? `<div class="pay-row muted"><span>Muddat</span><span>${sale.due}</span></div>` : ""}`
    : `${mixedHtml}<div class="paid-badge">✅ To'liq to'landi</div>`;

  return `<!DOCTYPE html>
<html lang="uz"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>${chekId}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F2F0EB;padding-bottom:40px}

/* HEADER */
.hdr{background:#0D1B2A;padding:16px 16px 12px;text-align:center;position:sticky;top:0;z-index:10}
.hdr-logo{font-family:'Sora',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;color:#E9A500;text-transform:uppercase}
.hdr-id{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;color:#fff;margin-top:3px}
.hdr-sub{font-size:12px;color:#9aa7b5;margin-top:2px}

/* CHIPS */
.chips{background:#1a2d42;display:flex;justify-content:center;gap:12px;padding:9px 16px;flex-wrap:wrap}
.chip{font-size:13px;color:#cdd5de;font-weight:600}
.chip b{color:#fff;font-size:15px}

/* MIJOZ */
.cust-card{margin:10px 12px 0;background:#fff;border-radius:12px;padding:12px 14px}
.cust-lbl{font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:.8px}
.cust-val{font-size:18px;font-weight:700;color:#0D1B2A;margin-top:2px}

/* SECTION */
.sec{padding:14px 14px 8px;font-size:11px;font-weight:800;color:#999;text-transform:uppercase;letter-spacing:1px}

/* KARTA */
.card{background:#fff;border-radius:14px;margin:0 12px 12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07)}
.card.done{opacity:.55;border:2px solid #22C55E}

/* Rasm */
.card-img-wrap{position:relative;width:100%;height:200px;background:#F0EDE8;overflow:hidden}
.card-img-wrap img{width:100%;height:100%;object-fit:cover;cursor:pointer;display:block}
.card-done-overlay{display:none;position:absolute;inset:0;background:rgba(34,197,94,.85);color:#fff;font-family:'Sora',sans-serif;font-size:32px;font-weight:800;align-items:center;justify-content:center;letter-spacing:1px}
.card-done-overlay.show{display:flex}
.card-done-bar{background:#22C55E;color:#fff;font-family:'Sora',sans-serif;font-size:20px;font-weight:800;text-align:center;padding:10px;letter-spacing:1px}

/* Karta body */
.card-body{padding:16px 16px 14px}
.qty-row{margin-bottom:8px}
.qty-badge{background:#0D1B2A;color:#E9A500;font-family:'Sora',sans-serif;font-weight:800;font-size:26px;border-radius:10px;padding:7px 20px;display:inline-block}

/* Nom */
.card-name{font-family:'Sora',sans-serif;font-size:30px;font-weight:800;color:#0D1B2A;line-height:1.2;margin:10px 0 16px}

/* Atributlar */
.card-attrs{display:flex;flex-direction:column;gap:0}
.attr-row{display:flex;align-items:center;padding:9px 0;border-bottom:1px solid #F0EDE8}
.attr-row:last-child{border-bottom:none}
.attr-k{font-size:18px;font-weight:700;color:#9CA3AF;min-width:100px}
.attr-v{font-size:22px;font-weight:800;color:#0D1B2A;display:flex;align-items:center;gap:8px}
.color-dot{width:26px;height:26px;border-radius:7px;flex-shrink:0;border:2px solid rgba(0,0,0,.12);display:inline-block}
.code{font-family:monospace;background:#EEF2FF;color:#4F46E5;padding:4px 14px;border-radius:7px;font-size:20px;font-weight:700}

/* Narx */
.price-row{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:2px dashed #E8E5E0}
.price-per{font-size:15px;color:#9CA3AF;font-weight:600}
.price-sum{font-family:'Sora',sans-serif;font-weight:800;font-size:26px;color:#0D1B2A}

/* Tayyor tugma */
.done-btn{width:100%;padding:16px;border:none;background:#F0FDF4;color:#16A34A;font-family:'Sora',sans-serif;font-size:18px;font-weight:800;cursor:pointer;border-top:1px solid #BBF7D0;transition:background .2s;letter-spacing:.5px}
.done-btn:active{background:#DCFCE7}
.card.done .done-btn{background:#DCFCE7;color:#15803D}

/* JAMI */
.total-card{background:#0D1B2A;margin:4px 12px 0;border-radius:12px;padding:16px}
.total-row{display:flex;justify-content:space-between;align-items:center}
.total-lbl{font-family:'Sora',sans-serif;font-size:12px;color:#9aa7b5;font-weight:700;letter-spacing:.5px}
.total-cnt{font-size:12px;color:#6b7a8d;margin-top:3px}
.total-val{font-family:'Sora',sans-serif;font-weight:800;font-size:30px;color:#fff}
.total-val span{font-size:14px;font-weight:600;color:#9aa7b5}

/* TO'LOV */
.pay-card{background:#fff;margin:8px 12px 0;border-radius:12px;padding:14px 16px}
.pay-row{display:flex;justify-content:space-between;padding:5px 0;font-size:14px;color:#555}
.pay-row.debt{color:#DC2626;border-top:1px dashed #fca5a5;margin-top:6px;padding-top:10px;font-weight:800;font-size:17px}
.pay-row.muted{color:#aaa;font-size:12px}
.paid-badge{text-align:center;background:#ECFDF5;color:#059669;font-weight:700;font-size:15px;padding:10px;border-radius:8px}

/* FOOTER */
.footer{text-align:center;margin-top:20px;font-size:11px;color:#bbb}

/* Desktop */
@media(min-width:640px){
  .hdr,.chips,.sec,.footer{max-width:560px;margin-left:auto;margin-right:auto}
  .card,.cust-card,.total-card,.pay-card{max-width:560px;margin-left:auto;margin-right:auto}
  .card{margin-bottom:12px}
}
</style></head>
<body>

<div class="hdr">
  <div class="hdr-logo">${shopName.toUpperCase()} · OMBORCHI</div>
  <div class="hdr-id">${chekId}</div>
  <div class="hdr-sub">📅 ${date} ${time}</div>
</div>

<div class="chips">
  <div class="chip"><b>${totalTur}</b> xil tovar</div>
  <div class="chip"><b>${totalBoxes || items.reduce((a,i)=>a+(i.qty||0),0)}</b> pochka</div>
</div>

${custName ? `
<div class="cust-card">
  <div class="cust-lbl">Mijoz</div>
  <div class="cust-val">👤 ${custName}</div>
  ${custPhone ? `<div class="cust-val" style="font-size:15px;color:#555;margin-top:4px">📞 ${custPhone}</div>` : ""}
</div>` : ""}

<div class="sec">Mahsulotlar (${totalTur} xil)</div>

${cardsHtml}

<div class="total-card">
  <div class="total-row">
    <div>
      <div class="total-lbl">JAMI SUMMA</div>
      <div class="total-cnt">${totalTur} xil · ${totalBoxes || items.reduce((a,i)=>a+(i.qty||0),0)} pochka</div>
    </div>
    <div class="total-val">${fmtN(total)}<span> so'm</span></div>
  </div>
</div>

<div class="pay-card">${payHtml}</div>

<div class="footer">@${BOT_USERNAME} · ${shopName}</div>

<script>
// Tayyor belgilash
var doneItems = {};
function toggleDone(idx, imgEl) {
  doneItems[idx] = !doneItems[idx];
  var card   = document.getElementById('card-' + idx);
  var overlay = document.getElementById('done-' + idx);
  var btn    = document.getElementById('dbtn-' + idx);
  var done   = doneItems[idx];
  card.classList.toggle('done', done);
  if (overlay) {
    if (overlay.classList.contains('card-done-overlay')) {
      overlay.classList.toggle('show', done);
    } else {
      overlay.style.display = done ? 'block' : 'none';
    }
  }
  if (btn) btn.textContent = done ? '↩ Bekor qilish' : 'Tayyor belgilash';
  // Progress yangilash
  var total = ${totalTur};
  var cnt = Object.values(doneItems).filter(Boolean).length;
  var prog = document.getElementById('progress-text');
  if (prog) prog.textContent = cnt + '/' + total + ' tayyor';
}
// Lightbox (rasm bosish)
function openLb(src){document.getElementById('lb-img').src=src;document.getElementById('lb').classList.add('open');document.body.style.overflow='hidden';}
function closeLb(){document.getElementById('lb').classList.remove('open');document.body.style.overflow='';}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLb();});
// Rasmga bosish = Lightbox (rasm bo'lsa), tayyor tugma = belgilash
document.querySelectorAll('.card-img-wrap img').forEach(function(img, i) {
  img.onclick = function(e) {
    e.stopPropagation();
    openLb(this.src);
  };
});
</script>

<div style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:999;align-items:center;justify-content:center;cursor:zoom-out" id="lb" onclick="closeLb()">
  <div style="position:absolute;top:16px;right:16px;color:#fff;font-size:28px;cursor:pointer;background:rgba(255,255,255,.15);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center" onclick="closeLb()">✕</div>
  <img id="lb-img" src="" style="max-width:95vw;max-height:90vh;object-fit:contain;border-radius:10px">
</div>

</body></html>`;
}


async function actionRenderStaffOrder(chekId, saleData, shopId) {
  let sale = null;
  let shopName = "MERX";
  const sid = shopId || null;

  if (saleData) {
    try {
      sale = JSON.parse(Buffer.from(saleData, "base64").toString("utf8"));
    } catch {}
  }

  if (!sale) {
    const isNumericId = /^ID\d+$/.test(chekId);
    const shopFilter  = sid ? `&shop_id=eq.${encodeURIComponent(sid)}` : "";
    const query = isNumericId
      ? `?id=eq.${chekId.slice(2)}&select=*${shopFilter}`
      : `?chek_num=eq.${encodeURIComponent(chekId)}&select=*${shopFilter}`;
    const rows = await sb("sales", query);
    sale = rows?.[0] || null;
  }

  try {
    const setsQ = sid
      ? `?shop_id=eq.${sid}&select=shop_name&limit=1`
      : `?limit=1&select=shop_name`;
    const sets = await sb("settings", setsQ);
    shopName = sets?.[0]?.shop_name || "MERX";
  } catch {}

  // items dagi sku lar bo'yicha products dan art va rasm olish
  if (sale?.items?.length) {
    try {
      const skus = [...new Set(sale.items.map(i => i.sku).filter(Boolean))];
      if (skus.length) {
        const skuFilter = skus.map(s => `sku.eq.${encodeURIComponent(s)}`).join(",");
        const prodShopF = sid ? `&shop_id=eq.${sid}` : "";
        const prods = await sb("products", `?or=(${skuFilter})&select=sku,art,image${prodShopF}`);
        const prodMap = {};
        for (const p of (prods || [])) {
          if (p.sku) prodMap[p.sku] = { art: p.art || "", image: p.image || null };
        }
        sale.items = sale.items.map(i => ({
          ...i,
          art:   i.art   || prodMap[i.sku]?.art   || null,
          image: i.image || prodMap[i.sku]?.image  || null,
        }));
      }
    } catch(e) { console.warn("[staffOrder] products ma'lumot olishda xato:", e.message); }
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
  const payBreakdown = sale.payBreakdown || sale.pay_breakdown || null;
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

  const payLabels = { naqd: "Naqd pul", karta: "Karta", otkazma: "Bank o'tkazmasi", aralash: "Aralash" };
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
      ${payType === "aralash" && payBreakdown ? Object.entries(payBreakdown).map(([m,v]) =>
        `<div class="rc-pr" style="padding-left:12px"><span style="color:#999">${payLabels[m]||m}</span><span style="color:#666">${fmtN(v)} so'm</span></div>`
      ).join("") : ""}
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

// ── /stat (oylik statistika) ─────────────────────────────────
async function cmdOylikStat(chatId) {
  try {
    const ctx = await getShopCtx(chatId);
    const sid = ctx.shopId;
    const sidFilter = sid ? `&shop_id=eq.${sid}` : "";
    const m = new Date().toISOString().slice(0, 7); // 2026-06

    const [sales, xarajat] = await Promise.all([
      sb("sales", `?date=gte.${m}-01&order=date.asc${sidFilter}`),
      sb("xarajatlar", `?date=gte.${m}-01${sidFilter}`),
    ]);

    const shopName = ctx.shopName || "MERX";
    const totalSum  = sales.reduce((a, s) => a + Number(s.total || 0), 0);
    const totalPaid = sales.reduce((a, s) => a + Number(s.paid || 0), 0);
    const totalDebt = sales.reduce((a, s) => a + Number(s.remaining || 0), 0);
    const totalExp  = xarajat.reduce((a, x) => a + Number(x.amount || 0), 0);
    const foyda     = totalPaid - totalExp;

    // Kunlik o'rtacha
    const days = new Date().getDate();
    const avgDay = Math.round(totalPaid / days);

    // Top 3 mahsulot
    const itemCounts = {};
    for (const s of sales) {
      for (const it of (s.items || [])) {
        if (!it?.name) continue;
        itemCounts[it.name] = (itemCounts[it.name] || 0) + (it.qty || 1);
      }
    }
    const top3 = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 3);

    let txt = `📈 ${shopName} — ${m} oylik statistika\n\n`;
    txt += `🛍 Jami sotuvlar: ${sales.length} ta\n`;
    txt += `💵 Jami summa: ${fmt(totalSum)} so'm\n`;
    txt += `✅ To'langan: ${fmt(totalPaid)} so'm\n`;
    if (totalDebt > 0) txt += `🔴 Nasiya: ${fmt(totalDebt)} so'm\n`;
    txt += `💸 Xarajatlar: ${fmt(totalExp)} so'm\n`;
    txt += `💰 Toza foyda: ${fmt(foyda)} so'm\n`;
    txt += `📊 Kunlik o'rtacha: ${fmt(avgDay)} so'm\n`;
    if (top3.length) {
      txt += `\n🏆 Top mahsulotlar:\n`;
      top3.forEach(([name, qty], i) => {
        txt += `  ${i+1}. ${name} — ${qty} dona\n`;
      });
    }
    await tg(chatId, txt);
  } catch(e) {
    console.error("oylik stat xato:", e.message);
    await tg(chatId, `⚠️ Xato: ${e.message}`);
  }
}

// ── /help ────────────────────────────────────────────────────
async function cmdHelp(chatId) {
  const ctx = await getShopCtx(chatId);
  const isOwner = ctx.isOwner || ctx.isSuperAdmin;
  const shopName = ctx.shopName || "MERX";

  let txt = `❓ ${shopName} — Bot komandalar\n\n`;

  if (isOwner) {
    txt += "👤 Do'kon egasi uchun:\n";
    txt += "/hisobot — Bugungi savdo hisoboti\n";
    txt += "/balans — Kassa holati (naqd, karta, foyda)\n";
    txt += "/ombor — Kam qolgan tovarlar\n";
    txt += "/qarzlar — Muddati o'tgan qarzlar\n";
    txt += "/barcha_qarzlar — Barcha ochiq qarzlar\n";
    txt += "/stat — Bu oylik statistika\n";
    txt += "\n📱 Mijoz havolasi:\n";
    txt += `t.me/merx_savdo_bot?start=${ctx.shopId || ""}`;
  } else {
    txt += "🛍 Xaridlar va cheklaringiz:\n";
    txt += "Har bir xaridingizda chek avtomatik yuboriladi.\n\n";
    txt += "Qarz va balans holatini do'kondan so'rang.";
  }

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
      const saleData = req.query.d    || null;
      const shopId   = req.query.shop || null;
      if (!chekId) return res.status(400).send("Chek ID kerak");
      const html = await actionRenderStaffOrder(chekId, saleData, shopId);
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

  // MERX dan: oddiy matn xabar (qarz eslatmalari) — YANGI
  if (req.query?.action === "send_text") {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ ok: false, error: "invalid_json" });
    }
    try {
      const result = await actionSendTextMessage(body);
      return res.status(200).json(result);
    } catch (e) {
      console.error("send_text xato:", e.message);
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

    if (chatId) {
      // Do'kon tanlash callback: "shop:shop_XXXXX"
      if (cb.data?.startsWith("shop:")) {
        const shopId = cb.data.slice(5);
        const ctx = await setShopForUser(chatId, shopId);
        if (ctx) {
          await tg(chatId,
            "✅ " + ctx.shopName + " tanlandi!\n\n" +
            "Telefon raqamingizni ulashing 👇",
            {
              reply_markup: {
                keyboard: [[{ text: "📱 Raqamni ulashish", request_contact: true }]],
                resize_keyboard: true, one_time_keyboard: true,
              },
            }
          );
        }
      }

      // Barcha qarzlar
      if (cb.data === "barcha_qarzlar") {
        const allowed2 = await isShopOwner(chatId);
        if (allowed2) await cmdQarzlar(chatId, true);
      }
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
    // Deep link parametrini olamiz: /start shop_XXXXX
    const param = text.split(" ")[1] || "";
    await cmdStart(chatId, param);
    return res.status(200).json({ ok: true });
  }

  // Shop egasi tekshiruvi
  const allowed = await isShopOwner(chatId);
  if (!allowed) {
    await tg(chatId, "⛔ Bu komanda faqat do'kon egasi uchun.\n\n/start — qaytadan boshlash");
    return res.status(200).json({ ok: true });
  }

  switch (cmd) {
    case "/hisobot":
    case "/bugun":          await cmdHisobot(chatId);        break;
    case "/balans":         await cmdBalans(chatId);         break;
    case "/ombor":          await cmdOmbor(chatId);          break;
    case "/qarzlar":        await cmdQarzlar(chatId, false); break;
    case "/barcha_qarzlar": await cmdQarzlar(chatId, true);  break;
    case "/stat":
    case "/oylik":          await cmdOylikStat(chatId);      break;
    case "/help":           await cmdHelp(chatId);           break;
    default:
      if (text.startsWith("/")) {
        await tg(chatId, `❓ Noma'lum komanda: ${cmd}\n\n/help — komandalar ro'yxati`);
      }
  }

  return res.status(200).json({ ok: true });
}
