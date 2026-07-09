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
const GEMINI_KEY    = process.env.GEMINI_API_KEY;   // AI-naklad uchun (2026-07)
const GEMINI_MODEL  = "gemini-2.5-flash";  // 2026-07-08: flash-latest o'rniga — bir xil ishlaydi, ~4-5x arzon oddiy tuzilma-chiqarish vazifalari uchun

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

  // 1.5. bot_sessions — DOIMIY saqlangan bog'lanish (Vercel cache muammosini hal qiladi)
  try {
    const sess = await sb("bot_sessions", `?chat_id=eq.${cid}&select=shop_id,shop_name,is_owner&limit=1`);
    if (sess?.[0]?.shop_id) {
      const ctx = {
        shopId: sess[0].shop_id, shopName: sess[0].shop_name || "MERX",
        isOwner: !!sess[0].is_owner, isSuperAdmin: false, ts: Date.now()
      };
      _shopCache.set(cid, ctx);
      return ctx;
    }
  } catch(e) { console.warn("getShopCtx bot_sessions xato:", e.message); }

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

    // DOIMIY saqlash — bot_sessions jadvaliga (Vercel cache yo'qolsa ham ishlasin)
    try {
      await fetch(`${SB_URL}/rest/v1/bot_sessions?on_conflict=chat_id`, {
        method: "POST",
        headers: {
          apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
          "Content-Type": "application/json", Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({ chat_id: cid, shop_id: shopId, shop_name: shopName, is_owner: false })
      });
    } catch(e) { console.warn("bot_sessions saqlash xato:", e.message); }

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

// Rasm + matn (caption) bilan yuborish — guruhga buyurtma rasmi uchun
// photoSrc: http(s) URL YOKI base64 data-url (data:image/...;base64,...)
async function tgPhoto(chatId, photoSrc, caption, extra = {}) {
  // base64 bo'lsa — multipart/form-data orqali fayl sifatida yuboramiz
  if (photoSrc && photoSrc.startsWith("data:image")) {
    try {
      const base64Data = photoSrc.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append("caption", caption || "");
      form.append("parse_mode", "HTML");
      if (extra.reply_markup) form.append("reply_markup", JSON.stringify(extra.reply_markup));
      form.append("photo", new Blob([buffer], { type: "image/jpeg" }), "photo.jpg");

      const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
        method: "POST",
        body: form,
      });
      return res.json();
    } catch(e) {
      console.error("[tgPhoto] base64 yuborish xato:", e.message);
      return { ok: false, description: e.message };
    }
  }

  // Oddiy URL bo'lsa — to'g'ridan yuboramiz
  const body = { chat_id: chatId, photo: photoSrc, caption, parse_mode: "HTML", ...extra };
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Fayl (document) yuborish — AI-naklad natijasi CSV uchun (2026-07)
async function tgDocument(chatId, filename, content, caption) {
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) { form.append("caption", caption); form.append("parse_mode", "HTML"); }
    form.append("document", new Blob([content], { type: "text/csv;charset=utf-8" }), filename);
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendDocument`, { method: "POST", body: form });
    return res.json();
  } catch (e) {
    console.error("[tgDocument] xato:", e.message);
    return { ok: false, description: e.message };
  }
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

// ⚠️ ISHLATILMAYDI (2026-06 audit) — hech qayerdan chaqirilmaydi, kelajakda tozalash uchun belgilangan
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
  if (ctx.isOwner === true) return true;
  // shop_owners jadvalidan ham tekshiramiz (ko'p do'konli egalar uchun)
  if (ctx.shopId) {
    try {
      const rows = await sb("shop_owners", `?chat_id=eq.${chatId}&shop_id=eq.${ctx.shopId}&select=shop_id&limit=1`);
      if (rows?.length) return true;
    } catch(e) {}
  }
  return false;
}

// ════════════════════════════════════════════════════════════════
// AI-NAKLAD (2026-07): naklad rasmidan Gemini orqali tovar jadvali
// chiqarib, MERX import shabloniga mos CSV qaytaradi.
// ════════════════════════════════════════════════════════════════

const NAKLAD_PROMPT = `Bu — Xitoydan kelayotgan tovar nakladnoyi (proforma invoice) jadvali rasmi.
Jadvaldagi HAR BIR qatorni (har rang/variant alohida qator) JSON sifatida chiqar.

Har element uchun:
- nom: tovar nomi/turi (masalan "Krossovka", "Ayollar tufli"). Aniq nom yo'q
  bo'lsa, LOGO/brend nomidan foydalanib qisqa umumiy nom yoz.
- artikul: model/stil kodi (Styles NO, Art.No, model raqami — jadvalda odatda
  bor ustun). MAJBURIY va NOYOB bo'lishi kerak: bir xil rangli lekin boshqa
  model kodli qatorlarni ALOHIDA element deb hisobla, birlashtirma.
- rang: rang nomi (COLOR ustuni qiymati, masalan "navy", "black").
- olcham: agar jadvalda o'lcham ustunlari (39,40,41...) bo'lib qiymatlari
  bir xil takrorlansa — eng kichik va eng katta o'lchamni "39-44" formatida
  yoz. O'lcham ustunlari yo'q bo'lsa — bo'sh qoldir ("").
- pochka_soni: CTN ustuni (karobka/karton soni).
- birlik_soni: 1 karobkada nechta DONA (PRS/CTN nisbati, yoki o'lcham
  ustunlaridagi qiymatlar yig'indisi, masalan 2+2+2+2+2+2=12).
- birlik_narx_cny: U.Price ustuni — bitta DONA narxi, Xitoy yuanida (CNY),
  faqat raqam (valyuta belgisiz).

Faqat jadvaldagi haqiqiy tovar qatorlarini chiqar, jami/summary qatorlarni
o'tkazib yubor.

MUHIM — NARX HAR DOIM TO'LDIRILISHI SHART (bu eng ko'p xato qiladigan joy):
- Ba'zi jadvallarda narx ustuni faqat GURUHNING BIRINCHI qatorida
  ko'rsatilib, qolgan rang/variant qatorlarida katak BO'SH yoki
  birlashtirilgan (merged) bo'ladi — bunda o'sha narxni guruhdagi
  BARCHA qatorlarga (pastga qarab) qo'llash kerak, HECH QAYSI qatorni
  narxsiz qoldirma.
- Ba'zan ustunda T.Price (JAMI summa) ko'rsatiladi, U.Price (bitta
  DONA narxi) emas — bunday holda birlik_narx_cny ni T.Price ni
  jami donaga (pochka_soni × birlik_soni) BO'LIB hisobla.
- Agar bir nechta narx ustuni bo'lsa (masalan turli hajm/rangga oid),
  o'sha QATORGA tegishli ustundagi narxni ol, boshqa qatorning
  narxini ishlatma.
- Qiymatni aniq o'qib bo'lmasa ham eng mantiqiy taxminni ber
— hech qachon maydonni bo'sh/noaniq qoldirma.`;

const NAKLAD_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nom:             { type: "STRING" },
          artikul:         { type: "STRING" },
          rang:            { type: "STRING" },
          olcham:          { type: "STRING" },
          pochka_soni:     { type: "NUMBER" },
          birlik_soni:     { type: "NUMBER" },
          birlik_narx_cny: { type: "NUMBER" },
        },
        required: ["rang", "pochka_soni", "birlik_soni", "birlik_narx_cny"],
      },
    },
  },
  required: ["items"],
};

// Gemini Vision orqali naklad rasmlaridan tovar ro'yxatini chiqarish
async function geminiExtractNaklad(images) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY sozlanmagan (Vercel ENV)");
  const parts = [
    { text: NAKLAD_PROMPT },
    ...images.map(im => ({ inlineData: { mimeType: im.mimeType, data: im.buffer.toString("base64") } })),
  ];
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: NAKLAD_SCHEMA, temperature: 0.1 },
  };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const data = await r.json();
  if (!r.ok) throw new Error("Gemini xato: " + (data?.error?.message || r.status));
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini bo'sh javob qaytardi");
  const parsed = JSON.parse(text);
  return parsed.items || [];
}

// Kurs + yo'l xarajatini QIYMATGA mutanosib taqsimlab, har dona tannarxini hisoblash
function computeNakladCosts(items, kurs, logistics) {
  const withValue = items.map(it => {
    const jamiDona = Math.max(0, Math.round((it.pochka_soni || 0) * (it.birlik_soni || 0)));
    const valueCny = (it.birlik_narx_cny || 0) * jamiDona;
    return { ...it, jamiDona, valueCny };
  });
  const totalValueCny = withValue.reduce((a, it) => a + it.valueCny, 0) || 1;
  return withValue.map(it => {
    const valueSom = it.valueCny * (kurs || 0);
    const share = logistics > 0 ? logistics * (it.valueCny / totalValueCny) : 0;
    const costPerUnitSom = it.jamiDona > 0 ? Math.round((valueSom + share) / it.jamiDona) : 0;
    return { ...it, costPerUnitSom };
  });
}

// MERX import shabloniga mos CSV (Ulgurji narx bo'sh — sotuvchi to'ldiradi)
function buildNakladCsv(rows) {
  const headers = ["Nom", "ART", "Rang", "O'lcham", "1 pochkada nechta", "Pochka soni", "Tannarx", "Ulgurji narx"];
  const esc = v => { const s = String(v ?? ""); return (s.includes(";") || s.includes(",") || s.includes('"')) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = rows.map(r => [
    r.nom || "Tovar", r.artikul || "", r.rang || "", r.olcham || "",
    r.birlik_soni || "", r.pochka_soni || "", r.costPerUnitSom || "", "",
  ]);
  return "sep=;\r\n" + [headers, ...lines].map(r => r.map(esc).join(";")).join("\r\n");
}

// Telegram fayl (rasm) yuklab olish
async function tgGetFileBuffer(fileId) {
  const infoRes = await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${fileId}`);
  const info = await infoRes.json();
  if (!info.ok) throw new Error("Telegram getFile xato: " + (info.description || ""));
  const filePath = info.result.file_path;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${filePath}`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  const mimeType = filePath.endsWith(".png") ? "image/png"
    : filePath.endsWith(".webp") ? "image/webp"
    : filePath.endsWith(".pdf")  ? "application/pdf"
    : "image/jpeg";
  return { buffer, mimeType };
}

// Sessiya: Supabase'dagi naklad_sessions jadvalida (chat_id PK)
async function nkGet(chatId) {
  try {
    const rows = await sb("naklad_sessions", `?chat_id=eq.${chatId}&select=*&limit=1`);
    return rows?.[0] || null;
  } catch (e) { return null; }
}
async function nkSave(chatId, patch) {
  try {
    await fetch(`${SB_URL}/rest/v1/naklad_sessions?on_conflict=chat_id`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ chat_id: String(chatId), updated_at: new Date().toISOString(), ...patch }),
    });
  } catch (e) { console.warn("nkSave xato:", e.message); }
}
async function nkClear(chatId) {
  try {
    await fetch(`${SB_URL}/rest/v1/naklad_sessions?chat_id=eq.${chatId}`, {
      method: "DELETE", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
  } catch (e) {}
}

async function cmdNakladStart(chatId) {
  await nkClear(chatId);
  await nkSave(chatId, { step: "collecting", images: [] });
  await tg(chatId,
    "📦 <b>AI orqali naklad import</b>\n\n" +
    "Naklad rasm(lar)ini yuboring (bir nechta bo'lsa ketma-ket).\n\n" +
    "Tugatgach: /tayyor\nBekor qilish: /bekor"
  );
}

// Faol naklad sessiyasidagi xabarni (rasm yoki matn) tegishli qadamga yo'naltiradi.
// true qaytarsa — xabar shu yerda "yutilgan", oddiy komanda routeriga o'tmaydi.
async function handleNakladFlow(chatId, msg, sess) {
  const text = (msg.text || "").trim();
  if (text === "/bekor") { await nkClear(chatId); await tg(chatId, "❌ Bekor qilindi."); return true; }

  if (sess.step === "collecting") {
    const isImg = msg.photo?.length || (msg.document && (msg.document.mime_type || "").startsWith("image/"));
    if (isImg) {
      const fid = msg.photo?.length ? msg.photo[msg.photo.length - 1].file_id : msg.document.file_id;
      const imgs = [...(sess.images || []), { file_id: fid }];
      await nkSave(chatId, { images: imgs });
      await tg(chatId, `✅ Rasm qabul qilindi (${imgs.length} ta).\nYana yuboring yoki /tayyor deb yozing.`);
      return true;
    }
    if (text === "/tayyor") {
      if (!sess.images?.length) { await tg(chatId, "Avval kamida 1 ta rasm yuboring."); return true; }
      await nkSave(chatId, { step: "kurs" });
      await tg(chatId, "💱 1 CNY (yuan) necha so'm? (masalan: 1750)");
      return true;
    }
    await tg(chatId, "Naklad rasmini yuboring yoki /tayyor deb yozing.\n(Bekor qilish: /bekor)");
    return true;
  }

  if (sess.step === "kurs") {
    const v = parseFloat(text.replace(/[^\d.]/g, ""));
    if (!v || v <= 0) { await tg(chatId, "Iltimos, to'g'ri son kiriting (masalan: 1750)"); return true; }
    await nkSave(chatId, { kurs: v, step: "logistics" });
    await tg(chatId, "🚚 Jami yo'l xarajati necha so'm? (yo'q bo'lsa 0 yozing)");
    return true;
  }

  if (sess.step === "logistics") {
    const v = parseFloat(text.replace(/[^\d.]/g, ""));
    if (isNaN(v) || v < 0) { await tg(chatId, "Iltimos, to'g'ri son kiriting (yo'q bo'lsa 0)"); return true; }
    await nkSave(chatId, { logistics: v, step: "processing" });
    await processNaklad(chatId, { ...sess, logistics: v });
    return true;
  }

  return false;
}

async function processNaklad(chatId, sess) {
  await tg(chatId, "⏳ Tahlil qilinmoqda, biroz kuting (yarim daqiqagacha)...");
  try {
    const images = [];
    for (const im of (sess.images || [])) images.push(await tgGetFileBuffer(im.file_id));
    const items = await geminiExtractNaklad(images);
    if (!items.length) throw new Error("Tovarlar aniqlanmadi — rasm sifatini tekshirib qayta urining");
    const computed = computeNakladCosts(items, sess.kurs, sess.logistics || 0);
    const csv = buildNakladCsv(computed);
    await tgDocument(chatId, `merx_naklad_${Date.now()}.csv`, csv,
      `✅ <b>${computed.length} ta tovar aniqlandi</b>\n\n` +
      `Tannarx avtomat hisoblangan (kurs: ${sess.kurs} so'm/CNY, yo'l xarajati: ${Math.round(sess.logistics || 0).toLocaleString("ru-RU")} so'm taqsimlangan).\n\n` +
      `⚠️ Import qilishdan oldin ma'lumotlarni tekshiring va Ulgurji narxni to'ldiring — AI xato qilishi mumkin!`
    );
  } catch (e) {
    console.error("processNaklad xato:", e.message);
    await tg(chatId, `❌ Xato: ${e.message}\n\nQaytadan urinib ko'ring: /naklad`);
  } finally {
    await nkClear(chatId);
  }
}

// Egasi bo'lgan barcha do'konlar ro'yxati
async function getOwnerShops(chatId) {
  try {
    return await sb("shop_owners", `?chat_id=eq.${chatId}&select=shop_id,shop_name&order=shop_name`);
  } catch(e) { return []; }
}

// Mijoz sifatida bog'langan barcha do'konlar ro'yxati
async function getCustomerShops(chatId) {
  try {
    const rows = await sb("customers", `?telegram_chat_id=eq.${chatId}&select=shop_id&limit=50`);
    if (!rows?.length) return [];
    const shopIds = [...new Set(rows.map(r => r.shop_id).filter(Boolean))];
    if (!shopIds.length) return [];
    const inList = shopIds.map(id => `"${id}"`).join(",");
    const shops = await sb("shops", `?id=in.(${inList})&select=id,name`);
    return shops || [];
  } catch(e) { return []; }
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
        // shop_owners jadvaliga doimiy yozamiz (ko'p do'konli egalar uchun)
        try {
          await fetch(`${SB_URL}/rest/v1/shop_owners?on_conflict=chat_id,shop_id`, {
            method: "POST",
            headers: {
              apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
              "Content-Type": "application/json", Prefer: "resolution=merge-duplicates"
            },
            body: JSON.stringify({ chat_id: String(chatId), shop_id: shopId, shop_name: ctx.shopName })
          });
        } catch(e) { console.warn("shop_owners saqlash xato:", e.message); }

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
    // shopId — getShopCtx orqali (bot_sessions jadvalidan, ishonchli)
    let ctx = await getShopCtx(chatId);
    let shopId = ctx.shopId;

    // shopId hali ham topilmasa — do'kon tanlanmagan, xato qilib taxmin qilmaymiz
    if (!shopId) {
      console.log(`[handleContact] shopId topilmadi, chatId=${chatId} — do'kon tanlashni so'raymiz`);
      try {
        const shops = await sb("shops", "?active=eq.true&select=id,name&order=name");
        if (shops?.length > 1) {
          const btns = shops.map(s => [{ text: "🏪 " + s.name, callback_data: "shop:" + s.id }]);
          await tg(chatId,
            "🟡 Avval qaysi do'kondan xarid qilganingizni tanlang:",
            { reply_markup: { inline_keyboard: btns } }
          );
          return;
        }
        if (shops?.length === 1) {
          shopId = shops[0].id;
        }
      } catch(e) { console.warn("[handleContact] shops fallback xato:", e.message); }
    }
    if (!shopId) {
      await tg(chatId, "⚠️ Do'kon aniqlanmadi. /start buyrug'ini qaytadan bosing.");
      return;
    }
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
      // Global qidiruv o'chirildi — har do'kon faqat o'z mijozlarini ko'radi
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

    // MULTI-TENANT (2026-07): chegara do'konning O'Z sozlamasidan
    // (settings.low_stock_limit); bo'lmasa ENV/5 zaxirasi
    let lowLimit = LOW_LIMIT;
    try {
      const st = await sb("settings", `?select=low_stock_limit${sid ? `&shop_id=eq.${sid}` : ""}&limit=1`);
      if (st?.[0]?.low_stock_limit != null && Number(st[0].low_stock_limit) > 0)
        lowLimit = Number(st[0].low_stock_limit);
    } catch {}

    const low = [];
    for (const p of products) {
      for (const v of (p.variants || [])) {
        if (Number(v.qty || 0) <= lowLimit) {
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
      await tg(chatId, `📦 Ombor holati\n\n✅ Barcha tovarlar yetarli (>${lowLimit} dona)`);
      return;
    }

    let txt = `📦 Kam qolgan tovarlar (≤${lowLimit} dona)\n`;
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

// ═══ QARZ TO'LOVI CHEKI (2026-07) ═══════════════════════════════
// Xabar: jami qarz EDI / TO'LANDI / QOLDI + mini-app cheki tugmasi
async function actionSendPayReceipt(body) {
  const { customerId, customerPhone, payment, shopName } = body || {};
  if (!payment) return { ok: false, error: "payment majburiy" };
  const shopId = body.shopId || null;
  const shopFilter = shopId ? `&shop_id=eq.${shopId}` : "";

  // Mijoz chat_id sini topish (telefon → id tartibida)
  let chatId = null;
  if (customerPhone) {
    const rawPhone = normPhone(customerPhone);
    const normalize = p => p.startsWith("998") ? p.slice(3) : p;
    const all = await sb("customers", `?select=id,local_id,phone,telegram_chat_id${shopFilter}`);
    const match = (all||[]).find(c => {
      const cp = normPhone(c.phone || "");
      return cp && normalize(cp) === normalize(rawPhone);
    });
    if (match?.telegram_chat_id) chatId = match.telegram_chat_id;
  }
  if (!chatId && customerId) {
    const rows = await sb("customers",
      `?or=(id.eq.${customerId},local_id.eq.${customerId})&select=telegram_chat_id${shopFilter}`);
    if (rows?.[0]?.telegram_chat_id) chatId = rows[0].telegram_chat_id;
  }
  if (!chatId) return { ok: true, sent: false, reason: "no_chat_id" };

  const F = n => Math.round(n||0).toLocaleString("ru-RU");
  const M = n => payment.currency === "usd" ? ("$" + (Math.round((n||0)*100)/100).toFixed(2)) : (F(n) + " so'm");
  const PM_LBL = { naqd: "Naqd", karta: "Karta", otkazma: "O'tkazma" };

  // v179: to'lov usullari taqsimoti (naqd/karta/o'tkazma so'mda) +
  // joriy kursda dollor ekvivalenti — USD qarzda ham sotuvchi qanday
  // to'langanini (naqd/karta) aniq ko'rsin.
  let methodTxt;
  if (payment.methodBreakdown) {
    const rate = payment.rate || 12800;
    const parts = Object.entries(payment.methodBreakdown).map(([m,v]) => `${F(v)} so'm ${PM_LBL[m]||m}`);
    const totalSom = Object.values(payment.methodBreakdown).reduce((a,v)=>a+v,0);
    methodTxt = parts.join(" + ") + ` = Jami ${F(totalSom)} so'm`;
    if (payment.currency === "usd") methodTxt += ` (joriy kursda $${(totalSom/rate).toFixed(2)})`;
  } else {
    methodTxt = `${PM_LBL[payment.method] || payment.method || "Naqd"} orqali`;
  }

  let txt = `💵 <b>TO'LOV QABUL QILINDI</b>  <code>${payment.chekNum || ("#"+payment.id)}</code>\n`;
  txt += `🏪 ${shopName || "MERX"}\n📅 ${payment.date || ""} ${payment.time || ""}\n`;
  txt += `━━━━━━━━━━━━━━━━━━━\n`;
  if (payment.debtBefore != null) txt += `Jami qarz edi:  <b>${M(payment.debtBefore)}</b>\n`;
  txt += `To'landi:  <b>${M(payment.amount)}</b>\n${methodTxt}\n`;
  if (payment.debtAfter != null) {
    txt += payment.debtAfter > 0
      ? `Qoldi:  <b>${M(payment.debtAfter)}</b>\n`
      : `Qoldi:  <b>0</b> — qarz to'liq yopildi ✅\n`;
  }
  const alloc = payment.allocations || [];
  if (alloc.length) {
    txt += `━━━━━━━━━━━━━━━━━━━\n<b>Yopilgan/kamaytirilgan cheklar:</b>\n`;
    alloc.slice(0, 6).forEach(a => {
      txt += `▫️ <code>${a.chekNum}</code> — ${a.fullyPaid ? "to'liq yopildi ✅" : M(a.amount) + " (qoldi " + M(a.remainingAfter) + ")"}\n`;
    });
    if (alloc.length > 6) txt += `<i>…yana ${alloc.length - 6} chek — chek ichida</i>\n`;
  }
  if (payment.leftover > 0) txt += `➕ Ortiqcha ${M(payment.leftover)} — balansingizga qo'shildi\n`;

  const _pp = `PAY__${payment.id}${shopId ? "__" + shopId : ""}`;
  const _ppEnc = _pp.replace(/[^a-zA-Z0-9_]/g, m => "x" + m.charCodeAt(0).toString(16));
  const payUrl = `https://t.me/${BOT_USERNAME}/ombor?startapp=${_ppEnc}`;

  const r = await tg(chatId, txt, {
    reply_markup: { inline_keyboard: [[{ text: "🧾 To'lov chekini ko'rish", url: payUrl }]] },
  });
  if (!r.ok) return { ok: false, sent: false, reason: "telegram_error", detail: r.description };
  return { ok: true, sent: true };
}

// To'lov cheki sahifasi (mini-app ichida ochiladi)
function buildPayReceiptHtml(p, shopName) {
  const F = n => Math.round(n||0).toLocaleString("ru-RU");
  const M = n => p.currency === "usd" ? ("$" + (Math.round((n||0)*100)/100).toFixed(2)) : (F(n) + " so'm");
  const alloc = Array.isArray(p.allocations) ? p.allocations : [];
  const PM_LBL = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", balans:"Balansdan" };
  const methodL = PM_LBL[p.method] || p.method || "";
  // v179: to'lov usullari taqsimoti (naqd/karta/o'tkazma) + joriy kursda
  // dollor ekvivalenti — USD qarzda ham sotuvchi qaysi usulda qancha
  // to'laganini aniq ko'rsatadi.
  const mb = p.method_breakdown || p.methodBreakdown || null;
  let methodTxt = methodL;
  if (mb) {
    const rate = p.rate || 12800;
    const totalSom = Object.values(mb).reduce((a,v)=>a+(v||0),0);
    methodTxt = Object.entries(mb).map(([m,v]) => `${F(v)} so'm ${PM_LBL[m]||m}`).join(" + ");
    methodTxt += ` = ${F(totalSom)} so'm`;
    if (p.currency === "usd") methodTxt += ` (kurs: $${(totalSom/rate).toFixed(2)})`;
  }
  const rows = alloc.map(a => `
    <tr><td class="c"><code>${a.chekNum||""}</code></td>
        <td class="a">${M(a.amount)}</td>
        <td class="s ${a.fullyPaid?"ok":""}">${a.fullyPaid ? "✅ To'liq" : "qoldi " + M(a.remainingAfter)}</td></tr>`).join("");
  return `<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>To'lov ${p.chek_num||p.chekNum||""}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F2F0EB;padding-bottom:30px}
.hdr{background:#0D1B2A;padding:16px;text-align:center}
.hdr .l{font-family:'Sora';font-size:11px;color:#E9A500;letter-spacing:2px;font-weight:700}
.hdr .t{font-family:'Sora';font-size:19px;color:#fff;font-weight:800;margin-top:3px}
.hdr .s{font-size:12px;color:#c5cdd6;margin-top:2px}
.amt{background:#fff;margin:12px;border-radius:14px;padding:18px;text-align:center}
.amt .v{font-family:'Sora';font-size:34px;font-weight:800;color:#059669}
.amt .m{font-size:13px;color:#374151;font-weight:700;margin-top:4px}
.box{background:#fff;margin:0 12px 10px;border-radius:12px;padding:12px 14px}
.row{display:flex;justify-content:space-between;padding:7px 0;font-size:16px;color:#111827;font-weight:700;border-bottom:1px solid #F0EDE8}
.row:last-child{border-bottom:none}
.row .k{color:#4B5563;font-weight:700}
.row .v{font-weight:800;color:#0B1220}
.row.red .v{color:#DC2626}
.row.ok .v{color:#059669}
.sec{padding:12px 16px 6px;font-size:11px;font-weight:800;color:#444;letter-spacing:1px;text-transform:uppercase}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;margin:0 0 10px}
.tblwrap{margin:0 12px}
td{padding:11px 10px;font-size:15px;font-weight:700;color:#0B1220;border-bottom:1px solid #F0EDE8}
td.c code{background:#EEF2FF;color:#4F46E5;padding:3px 8px;border-radius:6px;font-size:14px}
td.a{text-align:right;white-space:nowrap}
td.s{text-align:right;font-size:13px;color:#B45309;white-space:nowrap}
td.s.ok{color:#059669}
.footer{text-align:center;margin-top:16px;font-size:11px;color:#999}
</style></head><body>
<div class="hdr">
  <div class="l">${(shopName||"MERX").toUpperCase()}</div>
  <div class="t">🧾 TO'LOV CHEKI  ${p.chek_num||p.chekNum||""}</div>
  <div class="s">📅 ${p.date||""} ${p.time||""}${p.customer_name||p.customerName ? " · 👤 " + (p.customer_name||p.customerName) : ""}</div>
</div>
<div class="amt"><div class="v">${M(p.amount)}</div><div class="m">${methodTxt}</div></div>
<div class="box">
  ${p.debt_before!=null||p.debtBefore!=null ? `<div class="row"><span class="k">Jami qarz edi</span><span class="v">${M(p.debt_before!=null?p.debt_before:p.debtBefore)}</span></div>` : ""}
  <div class="row ok"><span class="k">To'landi</span><span class="v">${M(p.amount)}</span></div>
  ${p.debt_after!=null||p.debtAfter!=null ? `<div class="row ${(p.debt_after!=null?p.debt_after:p.debtAfter)>0?"red":"ok"}"><span class="k">Qoldi</span><span class="v">${M(p.debt_after!=null?p.debt_after:p.debtAfter)}</span></div>` : ""}
  ${Number(p.leftover||0)>0 ? `<div class="row ok"><span class="k">Balansga qo'shildi</span><span class="v">+${M(p.leftover)}</span></div>` : ""}
</div>
${rows ? `<div class="sec">Yopilgan cheklar (${alloc.length})</div><div class="tblwrap"><table>${rows}</table></div>` : ""}
<div class="footer">Rahmat! · ${shopName||"MERX"}</div>
</body></html>`;
}

async function actionRenderPayReceipt(payId, shopId) {
  const shopF = shopId ? `&shop_id=eq.${encodeURIComponent(shopId)}` : "";
  const rows = await sb("debt_payments", `?id=eq.${encodeURIComponent(payId)}${shopF}&select=*`);
  const p = rows?.[0];
  let shopName = "MERX";
  try {
    const _sf = (shopId || p?.shop_id) ? `&shop_id=eq.${encodeURIComponent(shopId || p.shop_id)}` : "";
    const sets = await sb("settings", `?limit=1&select=shop_name${_sf}`);
    shopName = sets?.[0]?.shop_name || "MERX";
  } catch {}
  if (!p) return `<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#F2F0EB;color:#888">To'lov topilmadi (biroz kutib, qayta oching)</body></html>`;
  return buildPayReceiptHtml(p, shopName);
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

  // 2026-07: chek endi TELEGRAM ICHIDA ochiladi (mini-app) — tashqi
  // brauzer/PDF yuklamasi yo'q. "CHK__" belgisi kirish sahifasiga
  // buni chek ekanini aytadi (omborchi sahifasidan farqlash uchun).
  const _rp = `CHK__${chekId}${shopId ? "__" + shopId : ""}`;
  const _rpEnc = _rp.replace(/[^a-zA-Z0-9_]/g, m => "x" + m.charCodeAt(0).toString(16));
  const receiptUrl = `https://t.me/${BOT_USERNAME}/ombor?startapp=${_rpEnc}`;

  const r = await tg(chatId, txt, {
    reply_markup: {
      inline_keyboard: [[{ text: "📄 Chekni ko'rish", url: receiptUrl }]],
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

  // MULTI-TENANT (2026-07): do'kon O'Z guruhini sozlamagan bo'lsa —
  // xabar YUBORILMAYDI. ENV zaxirasi olib tashlandi: begona do'kon
  // savdosi asosiy do'kon guruhiga tushib qolmasligi uchun.
  const groupId = staffGroupId || null;
  if (!groupId) return { ok: true, sent: false, reason: "no_group_id" };
  const sid = shopId || null;

  const chekId = sale.chekNum || ("ID" + sale.id);
  const shopN  = shopName || "MERX";
  const items  = sale.items || [];
  const total  = Number(sale.total || 0);
  const paid   = Number(sale.paid  || 0);
  const rem    = Number(sale.remaining || 0);

  const custName  = sale.customerName  || sale.customer_name  || "";
  const custPhone = sale.customerPhone || sale.customer_phone || "";

  // SODDALASHTIRILGAN: omborchiga pul/qarz ma'lumoti kerak emas —
  // faqat mijoz va tovar tafsilotlari (nima yig'ish kerakligi) muhim.
  let txt = `🆕 <b>YANGI BUYURTMA</b>  <code>${chekId}</code>\n`;
  txt += `📅 ${sale.date || ""} ${sale.time || ""}\n`;
  if (custName)  txt += `\n👤 <b>${custName}</b>`;
  if (custPhone) txt += `  📞 ${custPhone}`;
  txt += `\n`;

  const totalBoxesTxt = items.reduce((a, it) => a + (it.qtyBox || 0), 0);
  const totalDonaTxt  = items.reduce((a, it) => a + (it.qty || 0), 0);
  txt += `\n📦 <b>${items.length} xil tovar · ${totalBoxesTxt || totalDonaTxt} ${totalBoxesTxt ? "pochka" : "dona"}</b>\n`;
  txt += `━━━━━━━━━━━━━━━━━━━\n`;

  // IXCHAM FORMAT (2026-07): har tovar — bitta qator, ko'pi bilan 6 ta;
  // to'liq tafsilot "Batafsil" sahifasida (rasm, artikul, belgilash)
  const MAX_LINES = 6;
  items.slice(0, MAX_LINES).forEach(it => {
    const qtyTxt = it.qtyBox
      ? `${it.qtyBox} pochka`
      : `${it.qty} ${it.unit || "dona"}`;
    const extras = [it.color, it.size].filter(Boolean).join(" · ");
    txt += `🔸 <b>${it.name}</b> — <b>${qtyTxt}</b>${extras ? ` (${extras})` : ""}\n`;
  });
  if (items.length > MAX_LINES) {
    txt += `<i>…yana ${items.length - MAX_LINES} tovar — "Batafsil" da</i>\n`;
  }
  txt += `━━━━━━━━━━━━━━━━━━━`;

  // "Batafsil ko'rish" — Telegram Web App orqali (BotFather: /newapp, short_name=ombor)
  // startapp parametri orqali chekId+shopId uzatiladi (Telegram faqat
  // harf/raqam/pastki chiziqcha qabul qiladi, shuning uchun maxsus kodlaymiz)
  const startParam  = sid ? `${chekId}__${sid}` : chekId;
  const startParamEnc = startParam.replace(/[^a-zA-Z0-9_]/g, m => "x" + m.charCodeAt(0).toString(16));
  const catalogUrl  = `https://t.me/${BOT_USERNAME}/ombor?startapp=${startParamEnc}`;

  const replyMarkup = {
    inline_keyboard: [[
      { text: "📋 Batafsil ko'rish — tovarlarni belgilash", url: catalogUrl }
    ]],
  };

  // ESLATMA: agar 2+ xil tovar bo'lsa, faqat 1 ta rasm yuborish chalkashtiradi
  // (qaysi rasm qaysi tovarga tegishli ekani noaniq bo'ladi).
  // Shuning uchun: 1 ta tovar bo'lsa — rasm bilan yuboramiz.
  //                2+ tovar bo'lsa — faqat matn, rasmlar "Batafsil" sahifasida ko'rinadi.
  const singleImg = items.length === 1
    ? (items[0].image && (items[0].image.startsWith("http") || items[0].image.startsWith("data:image")) ? items[0].image : null)
    : null;

  let r;
  if (singleImg) {
    let caption = txt;
    if (caption.length > 1000) {
      caption = caption.slice(0, 980) + "\n\n…(to'liq ma'lumot \"Batafsil\" da)";
    }
    r = await tgPhoto(groupId, singleImg, caption, { reply_markup: replyMarkup });
    if (!r.ok) {
      console.warn("[staffNotif] rasm bilan yuborish muvaffaqiyatsiz, matn bilan urinib ko'ramiz:", r.description);
      r = await tg(groupId, txt, { reply_markup: replyMarkup });
    }
  } else {
    r = await tg(groupId, txt, { reply_markup: replyMarkup });
  }

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
      ${color ? `<div class="attr-row"><span class="attr-k k-r">R</span><span class="attr-v">${color}</span></div>` : ""}
      ${size ? `<div class="attr-row"><span class="attr-k k-o">O</span><span class="attr-v">${size}</span></div>` : ""}
      ${art ? `<div class="attr-row"><span class="attr-k k-a">A</span><span class="attr-v code">${art}</span></div>` : ""}
      ${barcode ? `<div class="attr-row"><span class="attr-k k-b">B</span><span class="attr-v code sm">${barcode}</span></div>` : ""}
    </div>
  </div>
  <button class="done-btn" onclick="toggleDone(${idx},null)" id="dbtn-${idx}">
    Tayyor belgilash
  </button>
</div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="uz"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">
<title>${chekId}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F2F0EB;padding-bottom:40px;-webkit-text-size-adjust:100%}

/* HEADER */
.hdr{background:#0D1B2A;padding:16px 16px 12px;text-align:center;position:sticky;top:0;z-index:10}
.hdr-logo{font-family:'Sora',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;color:#E9A500;text-transform:uppercase}
.hdr-id{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;color:#fff;margin-top:3px}
.hdr-sub{font-size:12px;color:#c5cdd6;margin-top:2px}

/* CHIPS */
.chips{background:#1a2d42;display:flex;justify-content:center;gap:12px;padding:9px 16px;flex-wrap:wrap}
.chip{font-size:13px;color:#e2e7ec;font-weight:600}
.chip b{color:#fff;font-size:15px}

/* MIJOZ */
.cust-card{margin:10px 12px 0;background:#fff;border-radius:12px;padding:12px 14px}
.cust-lbl{font-size:11px;color:#555;font-weight:700;text-transform:uppercase;letter-spacing:.8px}
.cust-val{font-size:18px;font-weight:700;color:#0D1B2A;margin-top:2px}

/* SECTION */
.sec{padding:14px 14px 8px;font-size:11px;font-weight:800;color:#444;text-transform:uppercase;letter-spacing:1px}

/* KARTA — 2 USTUNLI TO'R (2026-07): ko'p tovarda sahifa 2x qisqaradi.
   Shrift KATTALIKLARI o'zgarmagan, ranglar TINIQLASHTIRILGAN. */
.cards-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 10px}
.cards-grid > .card:only-child{grid-column:1/-1}
.card{background:#fff;border-radius:14px;margin:0;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07)}
.card.done{opacity:.55;border:2px solid #22C55E}

/* Rasm */
.card-img-wrap{position:relative;width:100%;height:min(200px,44vw);background:#F0EDE8;overflow:hidden}
.card-img-wrap img{width:100%;height:100%;object-fit:contain;cursor:pointer;display:block}
.card-done-overlay{display:none;position:absolute;inset:0;background:rgba(34,197,94,.85);color:#fff;font-family:'Sora',sans-serif;font-size:32px;font-weight:800;align-items:center;justify-content:center;letter-spacing:1px}
.card-done-overlay.show{display:flex}
.card-done-bar{background:#22C55E;color:#fff;font-family:'Sora',sans-serif;font-size:20px;font-weight:800;text-align:center;padding:10px;letter-spacing:1px}

/* Karta body */
.card-body{padding:12px 12px 10px}
.qty-row{margin-bottom:4px}
.qty-badge{background:#0D1B2A;color:#FFC93C;font-family:'Sora',sans-serif;font-weight:800;font-size:20px;border-radius:8px;padding:5px 12px;display:inline-block;white-space:nowrap}

/* Nom */
.card-name{font-family:'Sora',sans-serif;font-size:21px;font-weight:800;color:#050B14;line-height:1.15;margin:7px 0 9px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* Atributlar */
.card-attrs{display:flex;flex-direction:column;gap:0}
/* 2026-07: har ma'lumot BIR QATORDA, chip-yorliq (R/O/A/B), matn TINIQ */
.attr-row{display:flex;align-items:center;gap:8px;padding:4px 0;white-space:nowrap;overflow:hidden}
.attr-k{font-family:'Sora',sans-serif;font-size:12px;font-weight:800;letter-spacing:.5px;padding:3px 9px;border-radius:6px;flex-shrink:0}
.k-r{background:#DCFCE7;color:#15803D}
.k-o{background:#FEF3C7;color:#B45309}
.k-a{background:#DBEAFE;color:#1D4ED8}
.k-b{background:#F3E8FF;color:#7C3AED}
.attr-v{font-size:18px;font-weight:800;color:#0B1220;overflow:hidden;text-overflow:ellipsis}
.attr-v.code{font-family:'DM Sans',monospace;font-size:17px;letter-spacing:.3px}
.attr-v.sm{font-size:14px;font-weight:700;color:#1F2937;letter-spacing:.5px}

/* Narx */
.price-row{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:2px dashed #E8E5E0}
.price-per{font-size:17px;color:#6B7280;font-weight:700}
.price-sum{font-family:'Sora',sans-serif;font-weight:800;font-size:30px;color:#0D1B2A}

/* Tayyor tugma */
.done-btn{width:100%;padding:13px;border:none;background:#F0FDF4;color:#16A34A;font-family:'Sora',sans-serif;font-size:17px;font-weight:800;cursor:pointer;border-top:1px solid #BBF7D0;transition:background .2s;letter-spacing:.5px}
.done-btn:active{background:#DCFCE7}
.card.done .done-btn{background:#DCFCE7;color:#15803D}

/* JAMI */
.total-card{background:#0D1B2A;margin:4px 12px 0;border-radius:12px;padding:16px}
.total-row{display:flex;justify-content:space-between;align-items:center}
.total-lbl{font-family:'Sora',sans-serif;font-size:12px;color:#c5cdd6;font-weight:700;letter-spacing:.5px}
.total-cnt{font-size:12px;color:#cdd5de;margin-top:3px}
.total-val{font-family:'Sora',sans-serif;font-weight:800;font-size:30px;color:#fff}
.total-val span{font-size:14px;font-weight:600;color:#c5cdd6}

/* TO'LOV */
.pay-card{background:#fff;margin:8px 12px 0;border-radius:12px;padding:14px 16px}
.pay-row{display:flex;justify-content:space-between;padding:5px 0;font-size:14px;color:#555}
.pay-row.debt{color:#DC2626;border-top:1px dashed #fca5a5;margin-top:6px;padding-top:10px;font-weight:800;font-size:17px}
.pay-row.muted{color:#555;font-size:12px}
.paid-badge{text-align:center;background:#ECFDF5;color:#059669;font-weight:700;font-size:15px;padding:10px;border-radius:8px}

/* FOOTER */
.footer{text-align:center;margin-top:20px;font-size:11px;color:#bbb}

/* Desktop */
@media(min-width:640px){
  .hdr,.chips,.sec,.footer{max-width:720px;margin-left:auto;margin-right:auto}
  .cards-grid,.cust-card,.total-card,.pay-card{max-width:720px;margin-left:auto;margin-right:auto}
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
  <div class="chip" style="background:#E9A50022;border-radius:20px;padding:2px 12px">
    <span id="progress-text" style="color:#E9A500;font-weight:800">0/${totalTur} tayyor</span>
  </div>
</div>
<div style="height:4px;background:#1a2d42">
  <div id="prog-bar-fill" style="height:100%;background:#22C55E;width:0%;transition:width .3s"></div>
</div>

${custName ? `
<div class="cust-card">
  <div class="cust-lbl">Mijoz</div>
  <div class="cust-val">👤 ${custName}</div>
  ${custPhone ? `<div class="cust-val" style="font-size:15px;color:#555;margin-top:4px">📞 ${custPhone}</div>` : ""}
</div>` : ""}

<div class="sec">Mahsulotlar (${totalTur} xil)</div>

<div class="cards-grid">
${cardsHtml}
</div>

<div class="total-card">
  <div class="total-row">
    <div>
      <div class="total-lbl">JAMI YIG'ISH KERAK</div>
      <div class="total-cnt">${totalTur} xil mahsulot</div>
    </div>
    <div class="total-val">${totalBoxes || items.reduce((a,i)=>a+(i.qty||0),0)}<span> ${totalBoxes ? "pochka" : "dona"}</span></div>
  </div>
</div>

<div class="footer">@${BOT_USERNAME} · ${shopName}</div>

<script>
// Tayyor belgilash — server orqali REAL-TIME
var doneItems = {};
var CHEK_ID   = "${chekId}";
var TOTAL_TUR2 = ${totalTur};
var API_BASE  = window.location.origin + "/api/bot";

function applyDone() {
  var total = ${totalTur};
  var cnt = 0;
  for (var i = 0; i < total; i++) {
    var card    = document.getElementById('card-' + i);
    var overlay = document.getElementById('done-' + i);
    var btn     = document.getElementById('dbtn-' + i);
    var done    = !!doneItems[i];
    if (done) cnt++;
    if (card)    card.classList.toggle('done', done);
    if (overlay) {
      if (overlay.classList.contains('card-done-overlay')) {
        overlay.classList.toggle('show', done);
      } else {
        overlay.style.display = done ? 'block' : 'none';
      }
    }
    if (btn) btn.textContent = done ? '↩ Bekor qilish' : 'Tayyor belgilash';
  }
  // Progress
  var prog = document.getElementById('progress-text');
  if (prog) {
    prog.textContent = cnt + '/' + total + ' tayyor';
    prog.style.color = cnt === total ? '#22C55E' : '#E9A500';
  }
  // Header progress bar
  var bar = document.getElementById('prog-bar-fill');
  if (bar) bar.style.width = (total > 0 ? Math.round(cnt/total*100) : 0) + '%';
}

function toggleDone(idx) {
  doneItems[idx] = !doneItems[idx];
  applyDone();
  fetch(API_BASE + '?action=set_done&id=' + encodeURIComponent(CHEK_ID), {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ idx: idx, val: !!doneItems[idx] })
  }).catch(function(){});
}

// Har 4 soniyada serverdan yangilash
function fetchDone() {
  fetch(API_BASE + '?action=get_done&id=' + encodeURIComponent(CHEK_ID))
    .then(function(r){ return r.json(); })
    .then(function(data) {
      if (data.ok && Array.isArray(data.done)) {
        var nd = {};
        data.done.forEach(function(i){ nd[i] = true; });
        doneItems = nd;
        applyDone();
      }
    }).catch(function(){});
}
setInterval(fetchDone, 2000); // 2 soniyada bir — tezroq sinxronlash

// Lightbox
function openLb(src){document.getElementById('lb-img').src=src;document.getElementById('lb').classList.add('open');document.body.style.overflow='hidden';}
function closeLb(){document.getElementById('lb').classList.remove('open');document.body.style.overflow='';}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLb();});
document.querySelectorAll('.card-img-wrap img').forEach(function(img) {
  img.onclick = function(e) { e.stopPropagation(); openLb(this.src); };
});

// Ishga tushirish
fetchDone();
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
        const prods = await sb("products", `?or=(${skuFilter})&select=sku,art,image,color_images${prodShopF}`);
        const prodMap = {};
        for (const p of (prods || [])) {
          if (p.sku) prodMap[p.sku] = { art: p.art || "", image: p.image || null, colorImages: p.color_images || null };
        }
        sale.items = sale.items.map(i => {
          const pm = prodMap[i.sku];
          // Ustuvorlik: 1) sotuv vaqtidagi rasm (i.image) 2) shu rangning rasmi
          // 3) mahsulotning umumiy rasmi (zaxira)
          const colorImg = pm?.colorImages && i.color ? pm.colorImages[i.color] : null;
          return {
            ...i,
            art:   i.art   || pm?.art || null,
            image: i.image || colorImg || pm?.image || null,
          };
        });
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
  // snake_case → camelCase normalizatsiya (Supabase dan kelgan sale uchun)
  const s = {
    ...sale,
    chekNum:        sale.chekNum || sale.chek_num,
    payType:        sale.payType || sale.pay_type,
    payBreakdown:   sale.payBreakdown || sale.pay_breakdown,
    customerName:   sale.customerName || sale.customer_name,
    customerPhone:  sale.customerPhone || sale.customer_phone,
    debtCurrency:   sale.debtCurrency || sale.debt_currency || "uzs",
    debtUsd:        sale.debtUsd != null ? sale.debtUsd : sale.debt_usd,
    prevDebtUsd:    sale.prevDebtUsd != null ? sale.prevDebtUsd : sale.prev_debt_usd,
    prevDebtUzs:    sale.prevDebtUzs != null ? sale.prevDebtUzs : sale.prev_debt_uzs,
    discountPct:    sale.discountPct != null ? sale.discountPct : sale.discount_pct,
    priceType:      sale.priceType || sale.price_type,
    subtotal:       sale.subtotal != null ? sale.subtotal : (Number(sale.total||0) + Number(sale.discount||0)),
  };
  const cfg = {
    shopName:    opts.shopName    || "MERX",
    staffName:   opts.staffName   || "—",
    botUser:     (opts.botUsername || "").replace(/^@/, ""),
    logo:        opts.logo        || null,
    contact:     opts.contact     || "",
    footer:      opts.footer      || "Rahmat! Yana kutamiz 🙏",
    showStaff:   opts.showStaff   !== false,
    showContact: opts.showContact !== false,
    F: n => Math.round(n||0).toLocaleString("ru-RU")
  };
  return buildReceiptMerx(s, opts, cfg);
}

async function actionRenderReceipt(chekId, saleData, shopId) {
  let sale = null;
  let shopName = "MERX";

  if (saleData) {
    try {
      sale = JSON.parse(Buffer.from(saleData, "base64").toString("utf8"));
    } catch {}
  }

  if (!sale) {
    const isNumericId = /^ID\d+$/.test(chekId);
    const shopF = shopId ? `&shop_id=eq.${encodeURIComponent(shopId)}` : "";
    const query = isNumericId
      ? `?id=eq.${chekId.slice(2)}${shopF}&select=*`
      : `?chek_num=eq.${encodeURIComponent(chekId)}${shopF}&select=*`;
    const rows = await sb("sales", query);
    sale = rows?.[0] || null;
  }

  try {
    const _sf = (shopId || sale?.shop_id) ? `&shop_id=eq.${encodeURIComponent(shopId || sale.shop_id)}` : "";
    const sets = await sb("settings", `?limit=1&select=shop_name${_sf}`);
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

// ── /mendokonlarim — egasi/mijoz bo'lgan barcha do'konlar ──────
async function cmdMenDokonlarim(chatId) {
  console.log(`[mendokonlarim] chatId=${chatId} (type=${typeof chatId})`);
  const ownerShops = await getOwnerShops(chatId);
  const custShops   = await getCustomerShops(chatId);
  console.log(`[mendokonlarim] ownerShops=${JSON.stringify(ownerShops)}, custShops=${JSON.stringify(custShops)}`);

  if (!ownerShops.length && !custShops.length) {
    await tg(chatId, "Siz hali hech qaysi do'konga ulanmagansiz.\n\n/start orqali do'kon tanlang.");
    return;
  }

  let txt = "🏪 Sizning do'konlaringiz:\n\n";
  const btns = [];

  if (ownerShops.length) {
    txt += "👤 Egasi bo'lgan do'konlar:\n";
    ownerShops.forEach(s => { txt += `  • ${s.shop_name}\n`; });
    ownerShops.forEach(s => btns.push([{ text: "📊 " + s.shop_name + " (egasi)", callback_data: "switch_owner:" + s.shop_id }]));
    txt += "\n";
  }

  if (custShops.length) {
    txt += "🛍 Mijoz bo'lgan do'konlar:\n";
    custShops.forEach(s => { txt += `  • ${s.name}\n`; });
    custShops.forEach(s => btns.push([{ text: "🧾 " + s.name + " cheklari", callback_data: "switch_cust:" + s.id }]));
  }

  await tg(chatId, txt, { reply_markup: { inline_keyboard: btns } });
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
    txt += "/naklad — 🤖 AI orqali naklad rasmidan tovar import qilish\n";
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
  if (req.method === "GET" && req.query?.action === "pay_receipt") {
    try {
      const payId = String(req.query.id || "");
      const shopQ = req.query.shop || null;
      if (!payId) return res.status(400).send("To'lov ID kerak");
      const html = await actionRenderPayReceipt(payId, shopQ);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, private");
      return res.status(200).send(html);
    } catch (e) {
      console.error("pay_receipt xato:", e.message);
      return res.status(500).send("Xato: " + e.message);
    }
  }

  if (req.method === "GET" && req.query?.action === "receipt") {
    try {
      const chekId   = String(req.query.id || "");
      const saleData = req.query.d || null;
      const shopQ    = req.query.shop || null; // multi-tenant filtr (2026-07)
      if (!chekId) return res.status(400).send("Chek ID kerak");
      const html = await actionRenderReceipt(chekId, saleData, shopQ);
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
      let chekId   = String(req.query.id || "");
      const saleData = req.query.d    || null;
      let shopId   = req.query.shop || null;

      // Agar to'g'ridan ID kelmagan bo'lsa — bu Telegram Web App orqali
      // ochilgan, va Web App initData'ni Telegram skripti JS orqali
      // beradi (server tomonda ko'rinmaydi). Shuning uchun avval bo'sh
      // sahifa qaytaramiz, u tg.initDataUnsafe.start_param ni o'qib,
      // shu sahifaga ?id=... bilan qayta yo'naltiradi.
      if (!chekId) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, private");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Surrogate-Control", "no-store");
        return res.status(200).send(`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
</head><body style="background:#F2F0EB;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
<div id="msg" style="color:#888">Yuklanmoqda…</div>
<script>
  var tg = window.Telegram.WebApp;
  tg.ready();
  var param = tg.initDataUnsafe && tg.initDataUnsafe.start_param;
  if (param) {
    // startapp kodlangan edi (xNN — maxsus belgilar uchun) — dekodlaymiz
    var decoded = param.replace(/x([0-9a-f]{2})/g, function(m, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
    var parts = decoded.split("__");
    var url;
    if (parts[0] === "PAY") {
      url = "/api/bot?action=pay_receipt&id=" + encodeURIComponent(parts[1] || "");
      if (parts[2]) url += "&shop=" + encodeURIComponent(parts[2]);
    } else if (parts[0] === "CHK") {
      // Mijoz cheki (2026-07): Telegram ichida ochiladi
      url = "/api/bot?action=receipt&id=" + encodeURIComponent(parts[1] || "");
      if (parts[2]) url += "&shop=" + encodeURIComponent(parts[2]);
    } else {
      url = "/api/bot?action=staff_order&id=" + encodeURIComponent(parts[0]);
      if (parts[1]) url += "&shop=" + encodeURIComponent(parts[1]);
    }
    window.location.replace(url);
  } else {
    document.getElementById("msg").textContent = "⚠️ Buyurtma ID topilmadi.";
  }
</script>
</body></html>`);
      }

      const html = await actionRenderStaffOrder(chekId, saleData, shopId);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("ETag", ""); // ETag asosidagi 304 javoblarni oldini olish
      res.removeHeader("ETag");
      res.setHeader("Surrogate-Control", "no-store"); // Vercel CDN/Edge kesh oldini olish
      return res.status(200).send(html);
    } catch (e) {
      console.error("staff_order xato:", e.message);
      return res.status(500).send("Xato: " + e.message);
    }
  }

  // Done state — GET (Supabase orqali, BARCHA omborchilar uchun sinxron)
  // MUHIM: bu POST-tekshiruvdan OLDIN bo'lishi shart, aks holda GET so'rovlar
  // hech qachon ishlamaydi (avvalgi bug — shu yerda edi)
  if (req.method === "GET" && req.query?.action === "get_done") {
    const chekId = String(req.query?.id || "");
    try {
      const rows = await sb("done_items", `?chek_id=eq.${encodeURIComponent(chekId)}&done=eq.true&select=item_idx`);
      const done = (rows || []).map(r => r.item_idx);
      return res.status(200).json({ ok: true, done });
    } catch(e) {
      console.error("[get_done] xato:", e.message);
      return res.status(200).json({ ok: true, done: [] });
    }
  }

  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, info: "MERX Bot ishlamoqda" });
  }

  // MERX dan: mijozga chek yuborish
  if (req.query?.action === "send_pay_receipt") {
    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ ok: false, error: "invalid_json" }); }
    try {
      const result = await actionSendPayReceipt(body);
      return res.status(200).json(result);
    } catch (e) {
      console.error("send_pay_receipt xato:", e.message);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

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

  // Done state — SET (Supabase orqali, BARCHA omborchilar uchun sinxron)
  if (req.method === "POST" && req.query?.action === "set_done") {
    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; } catch { body = {}; }
    const chekId = String(req.query?.id || body?.id || "");
    const idx2   = parseInt(body?.idx);
    const val    = body?.val === true || body?.val === "true";

    if (chekId && !isNaN(idx2)) {
      try {
        if (val) {
          await fetch(`${SB_URL}/rest/v1/done_items?on_conflict=chek_id,item_idx`, {
            method: "POST",
            headers: {
              apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
              "Content-Type": "application/json", Prefer: "resolution=merge-duplicates"
            },
            body: JSON.stringify({ chek_id: chekId, item_idx: idx2, done: true })
          });
        } else {
          await fetch(`${SB_URL}/rest/v1/done_items?chek_id=eq.${encodeURIComponent(chekId)}&item_idx=eq.${idx2}`, {
            method: "DELETE",
            headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
          });
        }
      } catch(e) { console.error("[set_done] xato:", e.message); }
    }

    try {
      const rows = await sb("done_items", `?chek_id=eq.${encodeURIComponent(chekId)}&done=eq.true&select=item_idx`);
      const done = (rows || []).map(r => r.item_idx);
      return res.status(200).json({ ok: true, done });
    } catch(e) {
      return res.status(200).json({ ok: true, done: [] });
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

      // Egasi sifatida do'kon almashtirish (/mendokonlarim dan)
      if (cb.data?.startsWith("switch_owner:")) {
        const shopId = cb.data.slice(13);
        const ctx = await setShopForUser(chatId, shopId);
        if (ctx) {
          // shop_owners ga ham yozamiz (allaqachon bo'lishi kerak, lekin tasdiqlaymiz)
          try {
            await fetch(`${SB_URL}/rest/v1/shop_owners?on_conflict=chat_id,shop_id`, {
              method: "POST",
              headers: {
                apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
                "Content-Type": "application/json", Prefer: "resolution=merge-duplicates"
              },
              body: JSON.stringify({ chat_id: String(chatId), shop_id: shopId, shop_name: ctx.shopName })
            });
          } catch(e) {}
          // isOwner=true qilib cache yangilaymiz
          _shopCache.set(String(chatId), { ...ctx, isOwner: true, ts: Date.now() });
          await tg(chatId,
            "📊 " + ctx.shopName + " tanlandi (egasi sifatida).\n\n" +
            "Endi /hisobot, /balans, /qarzlar kabi komandalar shu do'kon uchun ishlaydi."
          );
        }
      }

      // Mijoz sifatida do'kon tanlash — shu do'kondan kelgan cheklarni ko'rsatish
      if (cb.data?.startsWith("switch_cust:")) {
        const shopId = cb.data.slice(12);
        try {
          const shops = await sb("shops", `?id=eq.${shopId}&select=name&limit=1`);
          const shopName = shops?.[0]?.name || "Do'kon";
          const sales = await sb("sales",
            `?shop_id=eq.${shopId}&select=chek_num,date,total,customer_phone&order=date.desc&limit=10`);
          // Faqat shu mijozga tegishli (telefon orqali)
          const custRows = await sb("customers",
            `?telegram_chat_id=eq.${chatId}&shop_id=eq.${shopId}&select=phone&limit=1`);
          const myPhone = custRows?.[0]?.phone ? normPhone(custRows[0].phone) : null;
          const mySales = myPhone
            ? (sales || []).filter(s => s.customer_phone && normPhone(s.customer_phone) === myPhone)
            : [];

          if (!mySales.length) {
            await tg(chatId, `🧾 ${shopName}\n\nHali xaridlar topilmadi.`);
          } else {
            let txt = `🧾 ${shopName} — so'ngi xaridlaringiz:\n\n`;
            mySales.slice(0, 10).forEach(s => {
              txt += `${s.chek_num || "—"} · ${s.date} · ${fmt(s.total||0)} so'm\n`;
            });
            await tg(chatId, txt);
          }
        } catch(e) {
          console.warn("switch_cust xato:", e.message);
          await tg(chatId, "⚠️ Cheklar topilmadi.");
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

  // /mendokonlarim — egasi tekshiruvisiz, hamma uchun ochiq
  if (cmd === "/mendokonlarim") {
    await cmdMenDokonlarim(chatId);
    return res.status(200).json({ ok: true });
  }

  // Shop egasi tekshiruvi
  const allowed = await isShopOwner(chatId);
  if (!allowed) {
    await tg(chatId, "⛔ Bu komanda faqat do'kon egasi uchun.\n\n/start — qaytadan boshlash\n/mendokonlarim — do'konlaringiz ro'yxati");
    return res.status(200).json({ ok: true });
  }

  // AI-NAKLAD (2026-07): faol sessiya bo'lsa, xabar (rasm/matn) shu
  // oqimga yo'naltiriladi — /naklad bundan mustasno (qayta boshlash uchun)
  if (cmd !== "/naklad") {
    const nkSess = await nkGet(chatId);
    if (nkSess) {
      const handled = await handleNakladFlow(chatId, msg, nkSess);
      if (handled) return res.status(200).json({ ok: true });
    }
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
    case "/naklad":         await cmdNakladStart(chatId);    break;
    case "/help":           await cmdHelp(chatId);           break;
    default:
      if (text.startsWith("/")) {
        await tg(chatId, `❓ Noma'lum komanda: ${cmd}\n\n/help — komandalar ro'yxati`);
      }
  }

  return res.status(200).json({ ok: true });
}

// ── buildReceiptMerx (utils.js dan ko'chirildi) ──
function buildReceiptMerx(sale, opts, cfg) {
  const {shopName, staffName, botUser, logo, contact, footer, showStaff, showContact, F} = cfg;
  const chekNum  = sale.chekNum || ("#" + sale.id);
  const date     = (sale.date||"").split("-").reverse().join(".");
  const time     = sale.time || "";
  const total    = Number(sale.total    || 0);
  const subtotal = Number(sale.subtotal || total);
  const paid     = Number(sale.paid     || 0);
  const remaining= Number(sale.remaining|| 0);
  const discount = Number(sale.discount || 0);
  const items    = (sale.items||[]).filter(Boolean);
  const payType  = sale.payType || "";
  const payBreakdown = sale.payBreakdown || null;
  const isUsd    = sale.debtCurrency === "usd" && sale.debtUsd;
  const debtUsd  = Number(sale.debtUsd || 0);
  const prevUsd  = Number(sale.prevDebtUsd || 0);
  const prevUzs  = Number(sale.prevDebtUzs || 0);
  const note     = sale.note || "";
  const due      = sale.due  || "";
  const priceType= sale.priceType || "";
  const payLabels= {naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash"};

  const totalBoxes = items.reduce((a,i) => a + (i.qtyBox||0), 0);
  const totalDona  = items.reduce((a,i) => a + (i.qty||0), 0);

  // Tovarlar — 2 qator: nom+art / rang+o'lcham+pochka
  const itemsHtml = items.map((it, idx) => {
    const isBox  = it.sellMode === "karobka" && it.qtyBox;
    const art    = it.art ? `<span class="it-art">${it.art}</span>` : "";
    const sum     = (it.price||0)*(it.qty||0);
    // Har doim: dona soni × dona narxi = summa
    const qtyShow = it.qty || 0;       // jami dona
    const unitShow= it.unit || "dona"; // birlik
    const pricePer= it.price || 0;     // 1 dona narxi
    const colorStr= it.color || "";
    // Pochka bo'lsa qavs ichida pochka soni
    const pchkNote= isBox && it.qtyBox ? ` (${it.qtyBox} pchk)` : "";
    // info: rang · o'lcham (agar dona) yoki rang (pochkada o'lcham yo'q)
    const colorStr2 = it.color || "";
    // Tovar qatori: Rang  Qty dona/pchk × Narx = Summa
    const calcStr = `${F(qtyShow)} ${unitShow} × ${F(pricePer)} = ${F(sum)}${pchkNote}`;
    return `<div class="it">
      <div class="it-top">
        <div class="it-num">${idx+1}</div>
        <div class="it-name">${it.name} ${art}</div>
        <div class="it-sum">${F(sum)}</div>
      </div>
      <div class="it-info">
        ${colorStr2 ? `<span class="it-color">${colorStr2}</span>` : ""}
        <span class="it-calc">${calcStr}</span>
      </div>
    </div>`;
  }).join("");

  // To'lov
  let payHtml = "";
  if (payType === "aralash" && payBreakdown) {
    const lblMap = {naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma"};
    payHtml = Object.entries(payBreakdown)
      .filter(([m,v]) => m !== "qarz" && v > 0)
      .map(([m,v]) => `<div class="pr"><span>${lblMap[m]||m}</span><span>${F(v)} so'm</span></div>`).join("");
  } else if (payType !== "qarz") {
    payHtml = `<div class="pr"><span>${payLabels[payType]||payType}</span><span style="color:#059669;font-weight:700">${F(paid)} so'm</span></div>`;
  }

  // Qarz bo'limi
  let debtHtml = "";
  if (remaining > 0) {
    const newDebtAmt = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${F(remaining)} so'm`;
    debtHtml += `<div class="sep-dash" style="margin:6px 0"></div>`;
    if (isUsd && prevUsd > 0) {
      debtHtml += `<div class="pr pr-sm"><span>Oldingi qarz</span><span>$${prevUsd.toFixed(2)}</span></div>`;
      debtHtml += `<div class="pr pr-sm"><span>Yangi qarz</span><span>$${debtUsd.toFixed(2)}</span></div>`;
      debtHtml += `<div class="pr pr-debt-total"><span>JAMI QARZ</span><span>$${(prevUsd+debtUsd).toFixed(2)} USD</span></div>`;
    } else if (!isUsd && prevUzs > 0) {
      debtHtml += `<div class="pr pr-sm"><span>Oldingi qarz</span><span>${F(prevUzs)} so'm</span></div>`;
      debtHtml += `<div class="pr pr-sm"><span>Yangi qarz</span><span>${F(remaining)} so'm</span></div>`;
      debtHtml += `<div class="pr pr-debt-total"><span>JAMI QARZ</span><span>${F(prevUzs+remaining)} so'm</span></div>`;
    } else {
      debtHtml += `<div class="pr pr-debt"><span>QARZ</span><span>${newDebtAmt}</span></div>`;
    }
    if (due) debtHtml += `<div class="pr pr-sm"><span>Muddat</span><span style="color:#dc2626;font-weight:700">${due}</span></div>`;
  } else {
    debtHtml = `<div class="paid-ok">✓ To'liq to'landi</div>`;
  }

  const discHtml = discount > 0
    ? `<div class="pr" style="color:#dc2626"><span>Chegirma${sale.discountPct ? " -"+sale.discountPct+"%" : ""}</span><span>−${F(discount)} so'm</span></div>` : "";

  const logoHtml = logo
    ? `<div style="text-align:center;padding:10px 0 4px"><img src="${logo}" style="max-height:55px;max-width:170px;object-fit:contain"></div>` : "";

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F2F0EB;display:flex;flex-direction:column;align-items:center;padding:16px 8px}
.wrap{width:340px;max-width:100%}
.rc{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(13,27,42,.12)}
.hd{background:#0D1B2A;padding:14px 18px;text-align:center;color:#fff}
.hd-name{font-family:'Sora',sans-serif;font-size:18px;font-weight:800;letter-spacing:1.5px}
.hd-meta{font-size:12px;color:#b8c5d0;margin-top:4px;line-height:1.6;font-weight:500}
.hd-meta b{color:#E9A500}
.badge-ulgurji{display:inline-block;background:#E9A500;color:#0D1B2A;font-size:9px;font-weight:800;padding:1px 7px;border-radius:8px;letter-spacing:.5px;margin-top:3px}
.cust{padding:7px 16px;background:#F0F8FF;border-bottom:1px dashed #C7E3F5;font-size:12px;color:#0D1B2A;display:flex;justify-content:space-between}
.note-w{padding:6px 16px;background:#FFFBEB;border-bottom:1px dashed #FDE68A;font-size:11.5px;color:#92400E}
.items-lbl{padding:8px 16px 4px;font-size:10px;font-weight:800;color:#555;letter-spacing:1.5px;text-transform:uppercase}
.items{padding:0 16px}
.it{padding:7px 0;border-bottom:1px dashed #E8E5E0}
.it:last-child{border-bottom:none}
.it-top{display:flex;align-items:baseline;gap:6px}
.it-num{font-size:10px;color:#999;font-weight:700;min-width:14px}
.it-name{flex:1;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#0D1B2A}
.it-art{font-family:'DM Sans',sans-serif;font-size:10px;color:#6366F1;background:#EEF2FF;padding:1px 6px;border-radius:4px;font-weight:600;margin-left:4px;vertical-align:middle}
.it-sum{font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:#0D1B2A;white-space:nowrap}
.it-info{font-size:12px;color:#374151;margin-top:3px;padding-left:20px;font-weight:500}
.it-color{color:#374151;font-weight:600;margin-right:8px}.it-calc{color:#111;font-weight:700}
.tot{margin:0 16px;padding:8px 0;border-top:2px solid #0D1B2A;display:flex;justify-content:space-between;align-items:center}
.tot-l{font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:#0D1B2A}
.tot-cnt{font-size:11px;color:#555;font-weight:600;margin-top:1px}
.tot-v{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;color:#0D1B2A}
.pay{padding:8px 16px 10px;border-top:1px dashed #ddd}
.pay-lbl{font-size:10px;font-weight:800;color:#374151;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.pr{display:flex;justify-content:space-between;font-size:13px;color:#111;padding:3px 0;font-weight:500}
.pr.pr-sm{font-size:12px;color:#555;font-weight:600}
.pr.pr-debt{color:#dc2626;font-weight:800;font-size:14px;border-top:1px solid #fca5a5;padding-top:6px;margin-top:2px}
.pr.pr-debt-total{color:#dc2626;font-weight:800;font-size:16px;border-top:2px solid #dc2626;padding-top:8px;margin-top:4px}
.sep-dash{border-top:1px dashed #ddd}
.paid-ok{background:#ECFDF5;color:#059669;font-weight:700;font-size:12px;text-align:center;padding:7px;border-radius:8px;margin-top:4px}
.ft{padding:10px 16px 14px;text-align:center;border-top:1px dashed #ddd}
.ft-txt{font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:#0D1B2A}
.ft-sub{font-size:11px;color:#666;margin-top:3px}
.ft-bot{font-size:11px;color:#229ED9;margin-top:6px}
.acts{width:340px;max-width:100%;margin:10px 0 0;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:10px;padding:11px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #E8E5E0}
@media print{
  body{background:#fff;padding:0}
  .wrap,.rc{width:72mm;max-width:72mm;border-radius:0;box-shadow:none}
  .acts{display:none}
  .hd,.hd-meta b{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pr.pr-debt,.pr.pr-debt-total{color:#000!important}
}
</style></head><body>
<div class="wrap">
  <div class="rc">
    ${logoHtml}
    <div class="hd">
      <div class="hd-name">${shopName.toUpperCase()}</div>
      <div class="hd-meta">
        <b>${chekNum}</b> · ${date} · ${time}
        ${showStaff && staffName && staffName !== "—" ? `<br>${staffName}` : ""}
        ${showContact && contact ? `<br>${contact}` : ""}
      </div>
      ${priceType === "ulgurji" ? `<div class="badge-ulgurji">ULGURJI SAVDO</div>` : ""}
    </div>

    ${sale.customerName ? `<div class="cust">
      <span>👤 ${sale.customerName}</span>
      <span>${sale.customerPhone||""}</span>
    </div>` : ""}

    ${note ? `<div class="note-w">📝 ${note}</div>` : ""}

    <div class="items-lbl">Mahsulotlar</div>
    <div class="items">${itemsHtml}</div>

    <div class="tot">
      <div>
        <div class="tot-l">JAMI</div>
        <div class="tot-cnt">${items.length} tur · ${totalBoxes ? totalBoxes + " pochka" : totalDona + " dona"}</div>
      </div>
      <div class="tot-v">${F(total)} <span style="font-size:13px;font-weight:600">so'm</span></div>
    </div>

    <div class="pay">
      <div class="pay-lbl">To'lov</div>
      ${discHtml}
      ${payHtml}
      ${debtHtml}
    </div>

    <div class="ft">
      <div class="ft-txt">${footer || "Rahmat! Yana kutamiz 🙏"}</div>
      <div class="ft-sub">${shopName} · ${date}</div>
      ${botUser ? `<div class="ft-bot">@${botUser}</div>` : ""}
    </div>
  </div>
  <div class="acts">
    <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
    <button class="btn-c" onclick="window.close?window.close():history.back()">Yopish</button>
  </div>
</div>
</body></html>`;
}

