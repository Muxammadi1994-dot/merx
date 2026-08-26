// ════════════════════════════════════════════════════════════════
// MERX Telegram Bot  |  api/bot.js  |  v1.3  |  2026-06-17
// ════════════════════════════════════════════════════════════════

const TOKEN        = process.env.TELEGRAM_BOT_TOKEN;

// ── GURUH ID SI (2026-07-30) ──────────────────────────────────
// Bot o'zining raqamli ID si. Token "<bot_id>:<hash>" ko'rinishida,
// shuning uchun birinchi qismi bot ID si bo'ladi.
// DIQQAT: muhit o'zgaruvchisi nomi TELEGRAM_BOT_TOKEN (boshqa nom
// yozilsa jimgina bo'sh qoladi).
const _BOT_ID = String(process.env.TELEGRAM_BOT_TOKEN || "").split(":")[0];

// Telegram bitta qo'shilishda ikkita yangilanish yuborishi mumkin
// (my_chat_member + xizmat xabari) — xabar ikki marta ketmasin
const _groupHello = new Map();
function _helloOnce(chatId) {
  const k = String(chatId), now = Date.now();
  const prev = _groupHello.get(k);
  if (prev && now - prev < 60000) return false;
  _groupHello.set(k, now);
  return true;
}

// Guruh ID sini tushunarli qilib yuborish.
// Avval do'kon egasi ID ni tashqi botlar orqali qidirishi kerak edi va
// ko'pchilik minus belgisini tushirib qoldirib xato kiritardi.
async function sendGroupIdCard(chatId, added) {
  await tg(chatId,
    (added ? "🤖 <b>MERX bot ulandi</b>\n\n" : "🆔 <b>Guruh ma'lumoti</b>\n\n") +
    "Bu guruhning ID si:\n" +
    "<code>" + chatId + "</code>\n\n" +
    "👆 Raqamga bosing — nusxa olinadi (minus belgisi bilan birga).\n\n" +
    "Ilovada: <b>Sozlamalar → SMS &amp; Bot → Xodimlar guruhi ID</b>\n" +
    "maydoniga qo'ying va saqlang.\n\n" +
    "Shundan keyin sotuv va ombor xabarlari shu guruhga keladi."
  );
}
const SB_URL       = process.env.SUPABASE_URL;
// ⚠️ 2026-08-07: BOT SERVICE KALITGA O'TDI (anon qoidalarni yopishga
// tayyorgarlik, reja 1.1-bosqich). Avval barcha so'rovlar anon kalit
// bilan ketardi — anon qoidalar o'chirilganda bot ko'r bo'lib qolardi.
// Service kalit RLS'dan o'tadi, so'rovlar esa avvalgidek shop_id bilan
// chegaralangan, ya'ni amaldagi huquq darajasi o'zgarmadi (ochiq
// qoidalar paytida ham hamma narsa ko'rinar edi). Service kalit
// sozlanmagan bo'lsa eski anon kalitga qaytadi — bot baribir ishlaydi.
// Kalit hech qachon xabar yoki havola ichiga yozilmaydi (tekshirilgan:
// barcha ishlatilishlar faqat Supabase so'rov sarlavhalarida).
const SB_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY
                  || process.env.SUPABASE_KEY;
// SERVICE kaliti alohida nomda ham qoladi — /tizim va SuperAdmin
// moliyasi (sa_income, sa_expense) shuni ishlatadi.
const SB_SERVICE   = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
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
  // ⚠️ 2026-08-04: TANLOV HISOBGA OLINADI.
  // Avval SuperAdmin shu yerda ushlanib qolardi va `shopId: null`
  // bilan qaytardi — ya'ni DOIM barcha do'kon yig'indisini ko'rardi
  // va bitta do'konni tanlay olmasdi.
  // Endi `bot_sessions` dagi tanlov o'qiladi:
  //   • shop_id bor  → o'sha do'kon (sinov uchun)
  //   • shop_id null → barcha do'kon (nazorat uchun)
  // `isSuperAdmin` HAR IKKALASIDA ham true — huquqlar saqlanadi.
  if (OWNER_ID && cid === String(OWNER_ID)) {
    let saShop = null, saName = "MERX";
    try {
      const sess = await sb("bot_sessions",
        `?chat_id=eq.${cid}&select=shop_id,shop_name&limit=1`);
      if (sess?.[0]?.shop_id) {
        saShop = sess[0].shop_id;
        saName = sess[0].shop_name || saShop;
      }
    } catch(e) { console.warn("sa sessiya o'qilmadi:", e.message); }

    const ctx = {
      shopId: saShop, shopName: saShop ? saName : "MERX",
      isOwner: true, isSuperAdmin: true, ts: Date.now()
    };
    _shopCache.set(cid, ctx);
    return ctx;
  }

  // 1.4. EGA tekshiruvi — shop_owners (2026-07-30) ─────────────────
  // NEGA ENG OLDINDA: avval `customers` tekshiruvi egadan OLDIN turardi.
  // Agar bitta raqam biror do'konda mijoz sifatida bog'langan bo'lsa,
  // funksiya o'sha yerda isOwner:false bilan qaytib ketardi va ega
  // tekshiruviga UMUMAN yetib bormasdi. Shu sabab bir do'konda mijoz
  // bo'lgan odam boshqa do'konga ega bo'la olmasdi.
  // Egalik — mijozlikdan kuchliroq da'vo, shuning uchun birinchi.
  //
  // Bu bitta indeksli so'rov (chat_id bo'yicha) — sekinlashtirmaydi.
  // Pastdagi `settings` bo'yicha ega tekshiruvi JOYIDA QOLDI: u har
  // do'kon uchun alohida so'rov qiladi, uni yuqoriga chiqarsak har
  // xabarda o'nlab so'rov ketardi.
  // ⚠️ 2026-08-03: TANLOV BIRINCHI — `bot_sessions` YUQORIGA CHIQDI.
  // Avval `shop_owners` birinchi tekshirilardi. Ega `/mendokonlarim`
  // orqali do'kon tanlasa, tanlov `bot_sessions` ga yozilardi —
  // lekin keyingi xabarda `shop_owners` uni BEKOR QILARDI.
  // Ya'ni ko'p do'konli ega uchun tanlash umuman ishlamasdi.
  // Endi: avval TANLOV, keyin egalik.
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

  // 1.5. EGA tekshiruvi — shop_owners.
  // Tanlov bo'lmasa ishlaydi (birinchi marta, yoki tanlanmagan bo'lsa).
  // ⚠️ TARTIB BERILDI: avval `limit=1` da tartib yo'q edi va qaysi
  // do'kon chiqishi ANIQLANMAGAN edi. Endi eng oxirgi bog'langani.
  //
  // NEGA MIJOZDAN OLDIN (2026-07-30): agar bitta raqam biror do'konda
  // mijoz sifatida bog'langan bo'lsa, funksiya o'sha yerda
  // isOwner:false bilan qaytib ketardi va ega tekshiruviga UMUMAN
  // yetib bormasdi. Egalik — mijozlikdan kuchliroq da'vo.
  try {
    const own = await sb("shop_owners",
      `?chat_id=eq.${cid}&select=shop_id,shop_name&order=shop_id.desc&limit=1`);
    if (own?.[0]?.shop_id) {
      const ctx = {
        shopId: own[0].shop_id, shopName: own[0].shop_name || "MERX",
        isOwner: true, isSuperAdmin: false, ts: Date.now()
      };
      _shopCache.set(cid, ctx);
      return ctx;
    }
  } catch(e) { console.warn("getShopCtx shop_owners xato:", e.message); }

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

  // 3. ⚠️ 2026-08-08: OLIB TASHLANDI — o'lik va zararli qadam edi.
  // Avval bu yerda BARCHA do'konlar aylanib chiqilib, har biri uchun
  // `settings.telegram_owner_chat_id` so'ralardi. Lekin bunday ustun
  // jadvalda UMUMAN YO'Q (§11.2) — ya'ni natija doim bo'sh edi, evaziga
  // har chaqiruvda N ta ortiqcha so'rov ketardi va do'konlar
  // ko'paygan sari bot sekinlashardi.
  // Egalik aslida yuqoridagi `shop_owners` qadami (1) orqali
  // aniqlanadi — u ishlaydi va shu yetarli.

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

// ⚠️ 2026-08-07: 1000 QATOR CHEGARASI YOPILDI (kontekst §4.4, №9).
// Supabase bitta so'rovga ko'pi bilan 1000 qator qaytaradi va
// ortig'ini JIMGINA kesadi — limit=20000 yozilsa ham. Shu sabab
// /oylik va /barcha_qarzlar katta do'konda KAM ko'rsatishi mumkin
// edi. auth-v2.js dagi sbFetchAll bilan bir xil usul: sahifalab
// yig'iladi. 20 sahifa (20 000 qator) — xavfsizlik shifti; unga
// yetish amalda deyarli mumkin emas, yetilsa capped=true qaytadi.
async function sbAll(table, query = "") {
  const PAGE = 1000, MAX_PAGE = 20;
  const out = [];
  let capped = false;
  for (let page = 0; page < MAX_PAGE; page++) {
    const sep = query.includes("?") ? "&" : "?";
    const rows = await sb(table, `${query}${sep}limit=${PAGE}&offset=${page * PAGE}`);
    out.push(...rows);
    if (rows.length < PAGE) return { rows: out, capped };
    if (page === MAX_PAGE - 1) capped = true;
  }
  return { rows: out, capped };
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

// ══════════════════════════════════════════════════════════════
// UMUMIY CHEGIRMANI TOVARLARGA YOYISH (2026-08-08)
// ══════════════════════════════════════════════════════════════
// Klientdagi `spreadSaleDiscount` (utils.js) BILAN BIR XIL mantiq —
// chek ikki joyda yasalgani uchun (ilova va bot) nusxa shart.
// ⚠️ Ikkalasi BIR VAQTDA o'zgartirilishi kerak, aks holda mijoz
// ikki xil chek ko'radi.
// Sabab: umumiy chegirma alohida maydonda saqlanadi, tovar
// narxlariga tegmaydi — chekda mijoz o'zi to'lagan narxni tovar
// bo'yicha ko'rmasdi. Taqsimlash FOYDAGA mutanosib (`item.cost`),
// tannarx yo'q bo'lsa qator qiymatiga mutanosib.
function spreadDiscount(sale) {
  const items = (sale && sale.items) ? sale.items : [];
  const disc  = Number((sale && (sale.discount != null ? sale.discount
                 : (sale.data && sale.data.discount))) || 0);
  const out = items.map(it => ({
    ...it,
    effPrice: Number(it.price || 0),
    origPrice: Number(it.basePrice || it.price || 0)
  }));
  if (!(disc > 0) || !out.length) return out;

  const lineVal = it => Number(it.price || 0) * Number(it.qty || 0);
  const subtotal = out.reduce((a, it) => a + lineVal(it), 0);
  if (!(subtotal > 0) || disc >= subtotal) return out;

  const profit = it => {
    const c = Number(it.cost || 0);
    return c > 0 ? Math.max(0, (Number(it.price || 0) - c) * Number(it.qty || 0)) : 0;
  };
  const profitSum = out.reduce((a, it) => a + profit(it), 0);
  const basis = profitSum > 0 ? profit : lineVal;
  const basisSum = profitSum > 0 ? profitSum : subtotal;

  let berilgan = 0, maxIdx = 0, maxVal = -1;
  out.forEach((it, i) => {
    const ulush = Math.round(disc * (basis(it) / basisSum));
    it._d = ulush; berilgan += ulush;
    if (lineVal(it) > maxVal) { maxVal = lineVal(it); maxIdx = i; }
  });
  out[maxIdx]._d += (disc - berilgan);

  out.forEach(it => {
    const qty = Number(it.qty || 0) || 1;
    it.effPrice = Math.max(0, Math.round(Number(it.price || 0) - (it._d / qty)));
    if (it._d > 0) it.origPrice = Number(it.price || 0);
    delete it._d;
  });
  return out;
}
// ══════════════════════════════════════════════════════════════
// ⚠️ 2026-08-04: SANA — TOSHKENT VAQTIDA
// ══════════════════════════════════════════════════════════════
// `toISOString()` HAR DOIM UTC qaytaradi. Toshkent UTC dan 5 soat
// oldinda, ya'ni har kuni 00:00–05:00 oralig'ida bot KECHAGI
// sanani hisoblardi. Ulgurji do'konlar aynan ertalab 3-4 da ish
// boshlaydi — o'sha paytda `/bugun`, `/balans`, `/qarzlar`
// noto'g'ri javob berardi.
//
// Ilovada bu 2026-08-03 da tuzatilgan (utils.js), botda esa
// e'tibordan chetda qolgan. Server UTC da ishlaydi, shuning uchun
// qurilma vaqtiga tayanib bo'lmaydi — ofset ANIQ qo'shiladi.
const TZ_OFFSET_MIN = 5 * 60;          // Asia/Tashkent = UTC+5
const today = () => {
  const d = new Date(Date.now() + TZ_OFFSET_MIN * 60 * 1000);
  return d.toISOString().slice(0, 10);
};
const thisMonth = () => {
  const d = new Date(Date.now() + TZ_OFFSET_MIN * 60 * 1000);
  return d.toISOString().slice(0, 7);
};

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

  // ══ EGANI ULASH HAVOLASI (2026-07-30) ═══════════════════════════
  //   t.me/BOT?start=own_shop_XXXXX
  // Muammo: yangi do'kon egasi ega bo'lib TANILISHINING yo'li yo'q edi.
  //  · settings.telegram_owner_chat_id hech qayerda YOZILMAYDI
  //  · setShopForUser bot_sessions ga is_owner:false yozadi
  //  · shop_owners ga yozish `if (isOwner)` ICHIDA — ya'ni ega bo'lish
  //    uchun avval ega bo'lish kerak edi (yopiq doira)
  // Endi shu havola o'sha doirani ochadi.
  //
  // XAVFSIZLIK: havola FAQAT BIR MARTA ishlaydi — do'konda hali ega
  // ro'yxatdan o'tmagan bo'lsa. Ega bor bo'lsa havola kuchsiz, oddiy
  // mijoz havolasi kabi ishlaydi.
  if (param && param.startsWith("own_shop_")) {
    const shopId = param.slice(4);   // "own_" ni kesamiz

    const shops = await sb("shops", `?id=eq.${shopId}&select=id,name&limit=1`).catch(() => []);
    if (!shops?.[0]) {
      await tg(chatId, "⚠️ Do'kon topilmadi. Havolani do'kon administratoridan qayta oling.");
      return;
    }
    const shopName = shops[0].name || "MERX";

    // Bu do'konda ega allaqachon bormi?
    const already = await sb("shop_owners", `?shop_id=eq.${shopId}&select=chat_id&limit=1`).catch(() => []);
    const meAlready = (already || []).some(r => String(r.chat_id) === cid);

    if (already?.length && !meAlready) {
      await tg(chatId,
        "⚠️ Bu do'konga ega allaqachon ulangan.\n\n" +
        "Sizning ID: " + cid + "\n\n" +
        "Bu ID ni do'kon EGASIGA yuboring — u botda\n" +
        "<code>/egaqoshish " + cid + "</code>\n" +
        "deb yozsa, siz ham EGA sifatida ulanasiz.");
      return;
    }

    // shop_owners ga yozamiz
    let okOwner = false;
    try {
      const r = await fetch(`${SB_URL}/rest/v1/shop_owners?on_conflict=chat_id,shop_id`, {
        method: "POST",
        headers: {
          apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
          "Content-Type": "application/json", Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({ chat_id: cid, shop_id: shopId, shop_name: shopName })
      });
      okOwner = r.ok;
      if (!r.ok) console.error("[own_] shop_owners yozilmadi:", r.status, await r.text().catch(()=>""));
    } catch(e) { console.error("[own_] shop_owners xato:", e.message); }

    if (!okOwner) {
      await tg(chatId,
        "⚠️ Ulashda xatolik yuz berdi.\n\nSizning ID: " + cid +
        "\nShu ID ni administratorga yuboring.");
      return;
    }

    // bot_sessions — is_owner: true (setShopForUser doim false yozadi,
    // shuning uchun uni ishlatmasdan o'zimiz yozamiz)
    try {
      await fetch(`${SB_URL}/rest/v1/bot_sessions?on_conflict=chat_id`, {
        method: "POST",
        headers: {
          apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
          "Content-Type": "application/json", Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({ chat_id: cid, shop_id: shopId, shop_name: shopName, is_owner: true })
      });
    } catch(e) { console.warn("[own_] bot_sessions xato:", e.message); }

    _shopCache.set(cid, { shopId, shopName, isOwner: true, isSuperAdmin: false, ts: Date.now() });

    await tg(chatId,
      "✅ " + shopName + "\n\n" +
      "Do'kon egasi sifatida ulandingiz.\n\n" +
      "📊 /hisobot — bugungi savdo\n" +
      "💰 /balans — kassa holati\n" +
      "📦 /ombor — kam qolgan tovarlar\n" +
      "🔴 /qarzlar — muddati o'tgan qarzlar\n" +
      "❓ /help — yordam",
      { reply_markup: { remove_keyboard: true } });
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
  // ⚠️ 2026-08-04: DO'KON ANIQLANMASA — MA'LUMOT BERILMAYDI.
    // Avval `shopId` null bo'lsa `sidFilter` BO'SH qolardi va so'rov
    // BARCHA DO'KON ma'lumotini qaytarardi. Ya'ni botni topgan begona
    // odam `/hisobot` yozib hamma do'konning savdo raqamlarini
    // ko'ra olardi.
    // SuperAdmin (`OWNER_ID`) uchun istisno — u ataylab hammasini
    // ko'radi, lekin sarlavhada bu ochiq yoziladi.
    if (!ctx.shopId && !ctx.isSuperAdmin) {
      await tg(chatId, "🔒 Do'kon aniqlanmadi.\n\n" +
        "/start bosing yoki do'kon egasidan havola so'rang.");
      return;
    }

        const sidFilter = sid ? `&shop_id=eq.${sid}` : "";
    // 2026-08-07: sahifalab olinadi — 1000 qator chegarasi (§4.4, №9)
    const [sales, xarajat] = await Promise.all([
      sbAll("sales", `?date=eq.${t}&status=neq.bekor&order=created_at.desc${sidFilter}`).then(r => r.rows),
      sbAll("xarajatlar", `?date=eq.${t}${sidFilter}`).then(r => r.rows),
    ]);

    if (!sales.length) {
      await tg(chatId, `📊 Bugungi hisobot — ${t}\n\n⚪ Bugun hali sotuv yo'q`);
      return;
    }

    // ⚠️ 2026-08-04: ESKI QARZLAR KUNLIK HISOBOTDA HAM KIRMAYDI.
  // `isOldDebt` — Billz'dan ko'chirilganlar, haqiqiy sotuv emas
  // (ilovadagi `statSales()` qoidasi).
  const _sales = (sales || []).filter(x => (x?.data && x.data.isOldDebt) !== true);

  const totalSales = _sales.length;
    const totalSum   = _sales.reduce((s, x) => s + Number(x.total || 0), 0);
    const totalPaid  = _sales.reduce((s, x) => s + Number(x.paid || 0), 0);
    const totalDebt  = _sales.reduce((s, x) => s + Number(x.remaining || 0), 0);
    const totalExp   = xarajat.reduce((s, x) => s + Number(x.amount || 0), 0);
    // ⚠️ 2026-08-04: "Toza foyda" NOMI NOTO'G'RI EDI.
  // Hisob: tushum − xarajat. TANNARX umuman ayrilmaydi, ya'ni bu
  // FOYDA EMAS. Egasi 190 mln "foyda" ko'rib, aslida tovarning
  // tannarxi hali ayrilmagan bo'lardi.
  // Haqiqiy foyda uchun har sotuvdagi tovar tannarxini yig'ish
  // kerak — bu alohida ish (ilovada `calcMarkup` bor).
  // Hozircha NOM to'g'rilandi: aldamaydigan bo'ldi.
  const foyda      = totalPaid - totalExp;

    // To'lov turi bo'yicha
    const byType = {};
    for (const s of _sales) {
      const k = s.pay_type || "boshqa";
      byType[k] = (byType[k] || 0) + Number(s.total || 0);
    }
    const typeLabels = { naqd: "Naqd", karta: "Karta", otkazma: "O'tkazma", nasiya: "Nasiya" };

    // Eng ko'p sotilgan
    const itemCounts = {};
    for (const s of _sales) {
      for (const it of (s.items || [])) {
        if (!it?.name) continue;
        itemCounts[it.name] = (itemCounts[it.name] || 0) + (it.qty || 1);
      }
    }
    const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];

    // ⚠️ 2026-08-04: SUPERADMIN UCHUN SARLAVHA ANIQ BO'LSIN.
    // Avval `MERX — Bugungi savdo` deb yozilardi va bu bitta
    // do'kon hisobotiga o'xshardi. Aslida SuperAdminda BARCHA
    // do'kon yig'indisi chiqadi (`shopId` null → filtr yo'q).
    // 2026-08-04: SuperAdmin bitta do'konni tanlagan bo'lsa —
    // o'sha do'kon nomi. Tanlanmagan bo'lsa yig'indi ekani ochiq.
    const shopName = (ctx.isSuperAdmin && !ctx.shopId)
      ? "BARCHA DO'KONLAR"
      : (ctx.shopName || "MERX");
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
    txt += `💰 Tushum − xarajat: ${fmt(foyda)} so'm\n`;
  txt += `<i>   (tannarx ayrilmagan)</i>`;

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
  // ⚠️ 2026-08-04: DO'KON ANIQLANMASA — MA'LUMOT BERILMAYDI.
    // Avval `shopId` null bo'lsa `sidFilter` BO'SH qolardi va so'rov
    // BARCHA DO'KON ma'lumotini qaytarardi. Ya'ni botni topgan begona
    // odam `/hisobot` yozib hamma do'konning savdo raqamlarini
    // ko'ra olardi.
    // SuperAdmin (`OWNER_ID`) uchun istisno — u ataylab hammasini
    // ko'radi, lekin sarlavhada bu ochiq yoziladi.
    if (!ctx.shopId && !ctx.isSuperAdmin) {
      await tg(chatId, "🔒 Do'kon aniqlanmadi.\n\n" +
        "/start bosing yoki do'kon egasidan havola so'rang.");
      return;
    }

        const sidFilter = sid ? `&shop_id=eq.${sid}` : "";
    const [sales, xarajat, sets] = await Promise.all([
      sb("sales", `?date=eq.${t}&status=neq.bekor${sidFilter}`),
      sb("xarajatlar", `?date=eq.${t}${sidFilter}`),
      sid ? sb("settings", `?shop_id=eq.${sid}&limit=1`)
          : Promise.resolve([]),   // ✅ MINA-1 (2026-08-26): do'kon noma'lum — BEGONA do'kon kursi olinmaydi (avval bazadagi birinchi do'kon tushardi)
    ]);

    const rate    = Number(sets[0]?.rate) || 0;   // ✅ 565: 12800 zaxirasi o'ldi — kurs faqat do'kon sozlamasidan
    const naqd    = sales.filter(s => s.pay_type === "naqd").reduce((a, s) => a + Number(s.paid || 0), 0);
    const karta   = sales.filter(s => s.pay_type === "karta").reduce((a, s) => a + Number(s.paid || 0), 0);
    const otkazma = sales.filter(s => s.pay_type === "otkazma").reduce((a, s) => a + Number(s.paid || 0), 0);
    const nasiya  = sales.reduce((a, s) => a + Number(s.remaining || 0), 0);
    const kirim   = naqd + karta + otkazma;
    const xar     = xarajat.reduce((a, x) => a + Number(x.amount || 0), 0);
    // ⚠️ 2026-08-04: "Toza foyda" NOMI NOTO'G'RI EDI.
  // Hisob: tushum − xarajat. TANNARX umuman ayrilmaydi, ya'ni bu
  // FOYDA EMAS. Egasi 190 mln "foyda" ko'rib, aslida tovarning
  // tannarxi hali ayrilmagan bo'lardi.
  // Haqiqiy foyda uchun har sotuvdagi tovar tannarxini yig'ish
  // kerak — bu alohida ish (ilovada `calcMarkup` bor).
  // Hozircha NOM to'g'rilandi: aldamaydigan bo'ldi.
  const foyda   = kirim - xar;

    let txt = `💰 Kassa holati — ${t}\n\n`;
    txt += `💵 Naqd: ${fmt(naqd)} so'm\n`;
    txt += `💳 Karta: ${fmt(karta)} so'm\n`;
    txt += `🏦 O'tkazma: ${fmt(otkazma)} so'm\n`;
    txt += `─────────────────\n`;
    txt += `📥 Jami kirim: ${fmt(kirim)} so'm\n`;
    txt += `📤 Xarajat: ${fmt(xar)} so'm\n`;
    txt += `─────────────────\n`;
    txt += `✨ Tushum − xarajat: ${fmt(foyda)} so'm\n`;
    if (rate > 0) txt += `   ≈ $${(foyda / rate).toFixed(2)}\n`;   // ✅ 565: kurssiz — satr yo'q
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
  // ⚠️ 2026-08-04: DO'KON ANIQLANMASA — MA'LUMOT BERILMAYDI.
    // Avval `shopId` null bo'lsa `sidFilter` BO'SH qolardi va so'rov
    // BARCHA DO'KON ma'lumotini qaytarardi. Ya'ni botni topgan begona
    // odam `/hisobot` yozib hamma do'konning savdo raqamlarini
    // ko'ra olardi.
    // SuperAdmin (`OWNER_ID`) uchun istisno — u ataylab hammasini
    // ko'radi, lekin sarlavhada bu ochiq yoziladi.
    if (!ctx.shopId && !ctx.isSuperAdmin) {
      await tg(chatId, "🔒 Do'kon aniqlanmadi.\n\n" +
        "/start bosing yoki do'kon egasidan havola so'rang.");
      return;
    }

        const sidFilter = sid ? `&shop_id=eq.${sid}` : "";
    const products = await sb("products", `?order=name${sidFilter}`);

    // MULTI-TENANT (2026-07): chegara do'konning O'Z sozlamasidan
    // (settings.low_stock_limit); bo'lmasa ENV/5 zaxirasi
    let lowLimit = LOW_LIMIT;
    try {
      const st = sid ? await sb("settings", `?select=low_stock_limit&shop_id=eq.${sid}&limit=1`) : [];   // ✅ MINA-1: do'kon noma'lum — begona chegara emas, ENV/5 zaxirasi
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
  // ⚠️ 2026-08-04: DO'KON ANIQLANMASA — MA'LUMOT BERILMAYDI.
    // Avval `shopId` null bo'lsa `sidFilter` BO'SH qolardi va so'rov
    // BARCHA DO'KON ma'lumotini qaytarardi. Ya'ni botni topgan begona
    // odam `/hisobot` yozib hamma do'konning savdo raqamlarini
    // ko'ra olardi.
    // SuperAdmin (`OWNER_ID`) uchun istisno — u ataylab hammasini
    // ko'radi, lekin sarlavhada bu ochiq yoziladi.
    if (!ctx.shopId && !ctx.isSuperAdmin) {
      await tg(chatId, "🔒 Do'kon aniqlanmadi.\n\n" +
        "/start bosing yoki do'kon egasidan havola so'rang.");
      return;
    }

        const sidFilter = sid ? `&shop_id=eq.${sid}` : "";
    const query = barcha
      ? `?remaining=gt.0&status=neq.bekor&order=due${sidFilter}`
      : `?remaining=gt.0&status=neq.bekor&due=lt.${t}&order=due${sidFilter}`;

    // 2026-08-07: sahifalab olinadi — 1000 qator chegarasi (§4.4, №9)
    const debts = await sbAll("sales", query).then(r => r.rows);

    // ✅ 2026-08-18 (4-paket): TO'LOVLAR AYIRILADI + "qaytarilgan"
    // tashlanadi + valyuta ajratiladi. Avval `remaining` USTUNI
    // xomligicha yig'ilardi — egaga qarz OSHIRIB ko'rinardi (Doston:
    // ustunda 29,9 mln, haqiqiy 29,6) va dollar qarzlar so'm-ekvivalent
    // bilan aralashardi. Endi ilova/serverdagi formula: asl qarz −
    // shu chekka taqsimlangan faol to'lovlar (pul.js saleState qoidasi).
    const _payRows = await sbAll("debt_payments", `?select=data${sidFilter}`)
      .then(r => r.rows).catch(() => []);
    const _paidBy = new Map();   // saleId -> {uzs, usd}
    _payRows.forEach(p => {
      const pd = p.data || {};
      if (pd.cancelled === true || pd.cancelled === "true") return;
      (pd.allocations || []).forEach(a => {
        const k = String(a.saleId);
        if (!_paidBy.has(k)) _paidBy.set(k, { uzs: 0, usd: 0 });
        const amt = Number(a.amount) || 0;
        if (a.currency === "usd") _paidBy.get(k).usd += amt;
        else                      _paidBy.get(k).uzs += amt;
      });
    });
    let totUzs = 0, totUsd = 0;
    const rows = [];
    debts.forEach(s => {
      if (s.status === "qaytarilgan") return;
      const paid = _paidBy.get(String(s.id)) || { uzs: 0, usd: 0 };
      if (s.debt_currency === "usd") {
        const base = Number(s.orig_debt_usd != null ? s.orig_debt_usd : s.debt_usd) || 0;
        const q = Math.max(0, base - paid.usd);
        if (q <= 0.009) return;
        totUsd += q;
        rows.push({ ...s, _txt: "$" + q.toFixed(2) });
      } else {
        const base = Number(s.orig_remaining != null ? s.orig_remaining : s.remaining) || 0;
        const q = Math.max(0, base - paid.uzs);
        if (q <= 0.5) return;
        totUzs += q;
        rows.push({ ...s, _txt: fmt(Math.round(q)) + " so'm" });
      }
    });

    if (!rows.length) {
      const msg = barcha ? "✅ Hozirda hech qanday qarz yo'q" : "✅ Muddati o'tgan qarz yo'q";
      await tg(chatId, msg);
      return;
    }

    const shopName2 = ctx.shopName || "MERX";
    let txt = barcha
      ? `📋 ${shopName2} — Barcha qarzlar (${rows.length} ta)\n\n`
      : `🔴 ${shopName2} — Muddati o'tgan (${rows.length} ta)\n\n`;

    for (const d of rows.slice(0, 15)) {
      const name  = d.customer_name || "Noma'lum";
      const phone = d.customer_phone || "—";
      txt += `👤 ${name}\n`;
      txt += `   📞 ${phone}\n`;
      txt += `   💸 ${d._txt}\n`;
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

    if (rows.length > 15) txt += `...va yana ${rows.length - 15} ta\n\n`;
    txt += `─────────────────\n`;
    txt += `💰 Jami qarz: ${fmt(Math.round(totUzs))} so'm` +
           (totUsd > 0 ? ` + $${totUsd.toFixed(2)}` : ``);

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
  // ⚠️ 2026-08-05 TUZATILDI: e'lonlar `isUsd` dan OLDIN bo'lishi
  // SHART. Avval pastda edi va nasiyali sotuvda xato berardi:
  //   Cannot access '_dUsdFrozen' before initialization
  // Naqd sotuvda chiqmasdi — shuning uchun darhol bilinmagan.
  // ⚠️ 2026-08-04: XABAR MATNI HAM MUZLATILADI.
  // Chek HTML'i `origRemaining` ga o'tkazilgan (kontekst §3.5),
  // matn esa `sale.remaining` — HOZIRGI qoldiqda qolgandi.
  // Natijada mijoz to'lov qilgach xabarda bir summa, "Chekni
  // ko'rish" bosganda BOSHQA summa chiqardi.
  const _remFrozen = Number(sale.origRemaining != null
                            ? sale.origRemaining : (sale.remaining || 0));
  const _dUsdFrozen = sale.origDebtUsd != null ? Number(sale.origDebtUsd)
                    : (sale.debtUsd != null ? Number(sale.debtUsd) : 0);

  const isUsd = sale.debtCurrency === "usd" && _dUsdFrozen;

  // ⚠️ 2026-08-05: QAYTARISH — XABAR MATNIDA HAM.
  // Avval qaytarish belgisi faqat chek HTML'ida edi. Mijoz
  // xabarni ochmasdan ham nima qaytarganini ko'rsin.
  let _refTxt = "";
  try {
    const _rf = Array.isArray(sale.refunds) ? sale.refunds : [];
    if (_rf.length) {
      const _rTot = Number(sale.refundedTotal || 0)
                 || _rf.reduce((a, r) => a + Number(r.total || 0), 0);
      _refTxt = `\n<b>${sale.status === "qaytarilgan"
        ? "🔴 TO'LIQ QAYTARILGAN" : "🟠 QISMAN QAYTARILGAN"}</b>\n`;
      _refTxt += `Qaytarilgan: <b>${fmt(_rTot)} so'm</b>\n`;
      _rf.forEach(r => (r.items || []).forEach(it => {
        const q = it.qtyBox ? `${it.qtyBox} pochka` : `${it.qty || 0} dona`;
        _refTxt += `  ▫️ ${it.name || ""}${it.variant ? " (" + it.variant + ")" : ""} — ${q}\n`;
      }));
    }
  } catch (e) {}

  // Qarz satrlari
  let debtLines = [];
  if (_remFrozen > 0) {
    const newDebt = isUsd ? `$${_dUsdFrozen.toFixed(2)}` : `${fmt(_remFrozen)} so'm`;
    if (isUsd && sale.prevDebtUsd > 0) {
      const total = sale.prevDebtUsd + _dUsdFrozen;
      debtLines = [
        `Oldingi qarz: $${sale.prevDebtUsd.toFixed(2)}`,
        `+ Yangi qarz: $${_dUsdFrozen.toFixed(2)}`,
        `💳 Umumiy qarz: $${total.toFixed(2)}`,
      ];
    } else if (!isUsd && sale.prevDebtUzs > 0) {
      const total = sale.prevDebtUzs + _remFrozen;
      debtLines = [
        `Oldingi qarz: ${fmt(sale.prevDebtUzs)} so'm`,
        `+ Yangi qarz: ${fmt(_remFrozen)} so'm`,
        `💳 Umumiy qarz: ${fmt(total)} so'm`,
      ];
    } else {
      debtLines = [`💳 Qarz: ${newDebt}`];
    }
    if (sale.due) debtLines.push(`Muddat: ${sale.due}`);
  }

  // ⚠️ 2026-08-08: MATN CHEKI PDF CHEK BILAN TENGLASHTIRILDI.
  // Muammo (do'kon aytdi): Telegramdagi matn xabari va "Batafsil"
  // dagi PDF chek BOSHQA-BOSHQA kod bilan yasalar edi — natijada
  // matnda CHEGIRMA umuman ko'rinmasdi (PDF da bor), subtotal,
  // mijoz ismi, pochka hisobi va $ ekvivalenti ham yo'q edi.
  // Mijoz ikki xil chek ko'rib chalkashardi. Endi matn ham shu
  // ma'lumotlarni beradi.
  const _subtotal = Number(sale.subtotal || 0) || (Number(sale.total || 0) + Number(sale.discount || 0));
  const _disc     = Number(sale.discount || 0);
  const _discPct  = sale.discountPct != null ? sale.discountPct : sale.discount_pct;
  const _rate     = Number(sale.rate || 0);
  const _pchJami  = (sale.items || []).reduce((a, it) => a + (Number(it.qtyBox) || 0), 0);
  // Tovar darajasidagi chegirmalar yig'indisi (basePrice > price)
  const _itemDisc = (sale.items || []).reduce((a, it) =>
    a + ((Number(it.basePrice) > Number(it.price || 0))
         ? (Number(it.basePrice) - Number(it.price || 0)) * Number(it.qty || 1) : 0), 0);
  // $ ekvivalenti — kurs bo'lsa, PDF chekdagi kabi
  const _usd = (v) => (_rate > 0 && v > 0) ? ` ($${(v / _rate).toFixed(2)})` : "";

  const lines = [
    `🧾 ${shopName} — Chek`,
    `📌 ${sale.chekNum || "#" + sale.id} | ${sale.date} ${sale.time || ""}`,
    sale.customerName ? `👤 ${sale.customerName}` : null,
    "",
    ...(function () {
      // ⚠️ 2026-08-08: TOVAR NARXLARI CHEGIRMA BILAN.
      // PDF chekda asl narx chizilib yangi narx yoziladi — matn
      // xabarida ham shunday bo'lsin (do'kon talabi). Ikki xil
      // chegirma qamrab olinadi:
      //   · tovar darajasidagi (basePrice > price)
      //   · umumiy chegirma (spreadDiscount bilan yoyiladi)
      const _eff = spreadDiscount(sale);
      return (sale.items || []).map((i, idx) => {
        const e = _eff[idx] || {};
        const p = Number(e.effPrice != null ? e.effPrice : (i.price || 0));
        const asl = Number(e.origPrice || i.basePrice || i.price || 0);
        const q = i.qtyBox
          ? `${i.qtyBox} pochka / ${i.qty} ${i.unit || "dona"}`
          : `${i.qty} ${i.unit || "dona"}`;
        // Chegirma bo'lsa: asl narx chizilgan holda ko'rsatiladi
        const narx = (asl > p)
          ? `<s>${fmt(asl)}</s> ${fmt(p)}`
          : `${fmt(p)}`;
        return `▪ ${i.name} (${i.variant || ""}) × ${q} × ${narx} = ${fmt(p * (i.qty || 0))} so'm`;
      });
    })(),
    "",
    _pchJami > 0 ? `📦 Jami: ${_pchJami} pochka` : null,
    // ⚠️ 2026-08-08: ETALON — `utils.js` dagi ilova cheki (1463-1466).
    // U yerda qator "Jami (chegirmasiz)" deb yoziladi va HAR IKKALA
    // chegirma turida chiqadi. Bot tomonida esa boshqacha edi:
    // PDF chekda "Subtotal" deb, faqat UMUMIY chegirmada, va tovar
    // chegirmalarisiz qiymat bilan; matn xabarida esa umuman yo'q edi.
    // Endi uchchalasi bir xil: yorliq ham, shart ham, qiymat ham.
    (_itemDisc + _disc) > 0 ? `Jami (chegirmasiz): ${fmt(Number(sale.total || 0) + _itemDisc + _disc)} so'm` : null,
    _itemDisc > 0 ? `Tovar chegirmalari: −${fmt(_itemDisc)} so'm` : null,
    _disc > 0 ? `Umumiy chegirma: −${fmt(_disc)} so'm` : null,
    `Jami: ${fmt(sale.total)} so'm${_usd(Number(sale.total || 0))}`,
    `To'lov: ${payLabels[sale.payType] || sale.payType || "—"}`,
    ...(sale.payType === "aralash" && (sale.payBreakdown || sale.pay_breakdown)
      ? Object.entries(sale.payBreakdown || sale.pay_breakdown).map(([m,v]) => `  • ${payLabels[m]||m}: ${fmt(v)} so'm`)
      : []),
    sale.paid < sale.total ? `To'landi: ${fmt(sale.paid)} so'm` : null,
    ...(debtLines.length ? debtLines : ["✅ To'liq to'landi"]),
    // 2026-08-05: qaytarish bo'lsa — ro'yxati bilan
    _refTxt || null,
    "",
    "Rahmat! Yana kutamiz 🙏",
  ];
  return lines.filter(l => l !== null).join("\n");
}

// ═══ QARZ TO'LOVI CHEKI (2026-07) ═══════════════════════════════
// Xabar: jami qarz EDI / TO'LANDI / QOLDI + mini-app cheki tugmasi
// ✅ 2026-08-18: "BIR CHEKKA BIR XABAR" QULFI (dublikat himoyasi).
// Ilovadagi botSend navbati (utils.js) javob yo'qolganda so'rovni 90
// soniyada QAYTA yuboradi. So'rov botga yetib, Telegram'ga ketgan-u,
// faqat JAVOB yo'lda o'lgan bo'lsa — guruh/mijozga IKKI NUSXA tushardi.
// Endi: yuborishdan OLDIN `bot_sent` jadvalidan 60 daqiqalik muhr
// tekshiriladi; bor bo'lsa — yubormasdan "ok, sent, dup" qaytadi va
// navbat tinchiydi. Muvaffaqiyatdan KEYIN muhr qo'yiladi.
// Qoidalar: (a) tekshiruv yiqilsa — YUBORILADI (fail-open: chek
// yetib bormasligi dublikatdan qimmatroq); (b) 60 daqiqadan keyin
// qulf ochiq — qo'lda qayta yuborishlar bloklanmaydi; (c) send_text
// (eslatmalar) ATAYLAB qulfsiz — ular takror yuborilishi tabiiy;
// (d) muhrgacha bo'lgan soniyalarda parallel ikki so'rov nazariy
// o'tishi mumkin — qabul qilingan, kichik xavf.
// Jadval (bir marta, SQL editorda):
//   create table if not exists bot_sent(
//     key text primary key, ts timestamptz not null default now());
//   alter table bot_sent enable row level security;
async function _dupLock(kind, shopId, chekNum) {
  if (!chekNum) return { dup: false, key: null };
  const key = `${kind}|${shopId || "-"}|${chekNum}`;
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const r = await fetch(`${SB_URL}/rest/v1/bot_sent` +
      `?key=eq.${encodeURIComponent(key)}&ts=gte.${encodeURIComponent(since)}` +
      `&select=key&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    if (r.ok) {
      const j = await r.json().catch(() => []);
      if (Array.isArray(j) && j.length) return { dup: true, key };
    }
  } catch (e) { console.warn("[dupLock]", e.message); }
  return { dup: false, key };
}
async function _dupMark(key) {
  if (!key) return;
  try {
    await fetch(`${SB_URL}/rest/v1/bot_sent`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
                 "Content-Type": "application/json",
                 Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key, ts: new Date().toISOString() })
    });
    // Ahyon-ahyonda (2% ehtimol) 48 soatdan eski muhrlar tozalanadi
    if (Math.random() < 0.02) {
      const old = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      fetch(`${SB_URL}/rest/v1/bot_sent?ts=lt.${encodeURIComponent(old)}`,
        { method: "DELETE",
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } })
        .catch(() => {});
    }
  } catch (e) { console.warn("[dupMark]", e.message); }
}

async function actionSendPayReceipt(body) {
  const { customerId, customerPhone, payment, shopName } = body || {};
  if (!payment) return { ok: false, error: "payment majburiy" };
  const shopId = body.shopId || null;
  // ✅ dublikat qulfi (60 daq) — navbat qayta urganda ikki nusxa tushmasin
  const _dl = await _dupLock("payrcpt", shopId, payment.chekNum || payment.id);
  if (_dl.dup) return { ok: true, sent: true, dup: true };
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
    const rate = Number(payment.rate) || Number(payment.data && payment.data.rate) || 0;   // ✅ 565: 12800 o'ldi
    const parts = Object.entries(payment.methodBreakdown).map(([m,v]) => `${F(v)} so'm ${PM_LBL[m]||m}`);
    const totalSom = Object.values(payment.methodBreakdown).reduce((a,v)=>a+v,0);
    methodTxt = parts.join(" + ") + ` = Jami ${F(totalSom)} so'm`;
    if (payment.currency === "usd" && rate > 0) methodTxt += ` (joriy kursda $${(totalSom/rate).toFixed(2)})`;   // ✅ 565
  } else if (payment.source === "refund") {
    // 2026-07-25: tovar qaytarish hisobidan yopilgan qarz — haqiqiy pul emas
    methodTxt = `Tovar qaytarish hisobidan${payment.refundNo ? " (" + payment.refundNo + ")" : ""}`;
  } else {
    methodTxt = `${PM_LBL[payment.method] || payment.method || "Naqd"} orqali`;
  }

  const _isRef = payment.source === "refund";
  let txt = _isRef
    ? `↩️ <b>TOVAR QAYTARILDI</b>  <code>${payment.chekNum || ("#"+payment.id)}</code>\n`
    : `💵 <b>TO'LOV QABUL QILINDI</b>  <code>${payment.chekNum || ("#"+payment.id)}</code>\n`;
  txt += `🏪 ${shopName || "MERX"}\n📅 ${payment.date || ""} ${payment.time || ""}\n`;
  txt += `━━━━━━━━━━━━━━━━━━━\n`;
  // \U0001f534 2026-08-15 (egasining talabi): IKKALA VALYUTA ALOHIDA,
  // KONVERTATSIYASIZ (\u00a73.1 \u2014 qarz o'z valyutasida qotadi).
  // Masalan: "$3800.00 + 20 000 000 so'm". Nol valyuta ko'rsatilmaydi.
  const _ikkiQ = (uzs, usd) => {
    const p = [];
    const _u = Number(usd) || 0, _s = Number(uzs) || 0;
    if (_u > 0) p.push("$" + _u.toFixed(2));
    if (_s > 0) p.push(_s.toLocaleString("ru-RU") + " so'm");
    return p.length ? p.join(" + ") : "0";
  };
  const _bU = payment.debtBeforeUzs ?? payment.debt_before_uzs;
  const _bD = payment.debtBeforeUsd ?? payment.debt_before_usd;
  const _aU = payment.debtAfterUzs  ?? payment.debt_after_uzs;
  const _aD = payment.debtAfterUsd  ?? payment.debt_after_usd;
  const _bTxt = (_bU != null || _bD != null) ? _ikkiQ(_bU, _bD) : null;
  const _aTxt = (_aU != null || _aD != null) ? _ikkiQ(_aU, _aD) : null;

  if (_bTxt != null) txt += `Jami qarz edi:  <b>${_bTxt}</b>\n`;
  else if (payment.debtBefore != null) txt += `Jami qarz edi:  <b>${M(payment.debtBefore)}</b>\n`;
  txt += _isRef
    ? `Qarzdan kamaydi:  <b>${M(payment.amount)}</b>\n`
    : `To'landi:  <b>${M(payment.amount)}</b>\n${methodTxt}\n`;
  if (_aTxt != null) {
    txt += (_aTxt !== "0")
      ? `Qoldi:  <b>${_aTxt}</b>\n`
      : `Qoldi:  <b>0</b> — qarz to'liq yopildi ✅\n`;
  } else if (payment.debtAfter != null) {
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

  // ⚠️ 2026-08-05: MIJOZ GURUHIGA HAM — sotuv chekidagi kabi.
  // Avval faqat SOTUV cheki guruhga borardi, qarz to'lovi esa
  // faqat mijozga. Mijozga nima ketsa guruhga ham ketishi kerak.
  // Mijozga yuborish oqimi TEGILMAGAN — bu qo'shimcha.
  let groupSent = false;
  try {
    const gid = String(body.groupId || "").trim();
    if (/^-?\d{5,}$/.test(gid) && String(gid) !== String(chatId)) {
      const gr = await tg(gid, txt, {
        reply_markup: { inline_keyboard: [[{ text: "🧾 To'lov chekini ko'rish", url: payUrl }]] },
      });
      groupSent = !!gr.ok;
      if (!gr.ok) console.warn(`[payReceipt] guruhga yuborilmadi (${gid}):`, gr.description);
    }
  } catch (e) { console.warn("[payReceipt] guruh xato:", e.message); }

  await _dupMark(_dl.key);   // ✅ yuborildi — 60 daqiqalik muhr
  return { ok: true, sent: true, groupSent };
}

// To'lov cheki sahifasi (mini-app ichida ochiladi)
function buildPayReceiptHtml(p, shopName, ck) {
  ck = ck || {}; // 2026-07-17: chek sozlamalari (logo/shior/altbilgi)
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
    const rate = Number(p.rate) || Number(p.data && p.data.rate) || 0;   // ✅ 565: 12800 o'ldi
    const totalSom = Object.values(mb).reduce((a,v)=>a+(v||0),0);
    methodTxt = Object.entries(mb).map(([m,v]) => `${F(v)} so'm ${PM_LBL[m]||m}`).join(" + ");
    methodTxt += ` = ${F(totalSom)} so'm`;
    if (p.currency === "usd" && rate > 0) methodTxt += ` (kurs: $${(totalSom/rate).toFixed(2)})`;   // ✅ 565
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
${ck.logo ? `<div style="text-align:center;padding:6px 8px 0;background:#fff"><img src="${ck.logo}" style="width:100%;max-height:64px;object-fit:contain"></div>` : ""}
<div class="hdr">
  <div class="l">${(shopName||"MERX").toUpperCase()}</div>
  ${ck.tagline ? `<div class="s">${ck.tagline}</div>` : ""}
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
<div class="footer">${(ck && ck.footer) || "Rahmat!"} · ${shopName||"MERX"}</div>
</body></html>`;
}

async function actionRenderPayReceipt(payId, shopId) {
  const shopF = shopId ? `&shop_id=eq.${encodeURIComponent(shopId)}` : "";
  const rows = await sb("debt_payments", `?id=eq.${encodeURIComponent(payId)}${shopF}&select=*`);
  const p = rows?.[0];
  let shopName = "MERX";
  try {
    const _sf = (shopId || p?.shop_id) ? `&shop_id=eq.${encodeURIComponent(shopId || p.shop_id)}` : "";
    // ✅ MINA-1: do'kon noma'lum — sozlama SO'RALMAYDI (begona nom/logo/kurs chiqmasin)
    const sets = _sf ? await sb("settings", `?limit=1&select=shop_name,chek_config,rate${_sf}`) : [];
    shopName = sets?.[0]?.shop_name || "MERX";
    var _ck = sets?.[0]?.chek_config || {}; // 2026-07-17: logo/manzil/telefon/shior
    var _sr565 = Number(sets?.[0]?.rate) || 0;   // ✅ 565: do'kon kursi — chizuvchiga zaxira
  } catch { var _ck = {}; var _sr565 = 0; }
  if (!p) return `<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#F2F0EB;color:#888">To'lov topilmadi (biroz kutib, qayta oching)</body></html>`;
  // \u2705 2026-08-15: MINI-APP CHEKI TANLANGAN USLUBDA (egasining talabi).
  // Telegram XABARI botniki qoladi (u yaxshi ishlangan va Telegram
  // CSS qabul qilmaydi), lekin "Chekni ko'rish" \u2014 to'la HTML sahifa,
  // shuning uchun ilovadagi uslub tanlovi (qarzStyle) qo'llanadi.
  // Manba bitta: buildPayReceiptStyled (js/utils.js dan ko'chirilgan).
  try {
    const _c  = (typeof _ck !== "undefined" ? _ck : {}) || {};
    const _st = (_c.styleV2 === true) ? (_c.qarzStyle || "unified") : "unified";
    if (typeof buildPayReceiptStyled === "function") {
      // \U0001f534 2026-08-15: MAYDON NOMLARI MOSLASHTIRILADI.
      // Baza `debt_before/debt_after/chek_num/...` (pastki chiziq),
      // chizuvchi esa `debtBefore/debtAfter/chekNum` kutadi \u2014 mos
      // kelmagani uchun "qarz edi / qoldi" qatorlari CHEKDA
      // TUSHIB QOLARDI (egasining kuzatuvi).
      // ✅ 565 (2026-08-26): ICHKI VARAQ (data) ZAXIRA YO'LI. Server
      // to'lovni ikki bosqichda yozadi: avval data to'liq, ustunlar esa
      // kassa push'idan keyin to'ladi. O'sha oynada chek ochilsa ustunlar
      // bo'sh chiqardi (jonli: PAY-20260826-0005-AY — bo'sh chek va
      // yolg'on 12800 kurs). Endi yetishmagan maydon data'dan olinadi.
      const _p = {
        ...p,
        chekNum:      p.chekNum      ?? p.chek_num      ?? p.data?.chekNum,
        time:         p.time                            ?? p.data?.time,
        method:       p.method                          ?? p.data?.method,
        rate:         p.rate                            ?? p.data?.rate,
        customerName: p.customerName ?? p.customer_name ?? p.data?.customerName,
        customerPhone:p.customerPhone?? p.customer_phone?? p.data?.customerPhone,
        amountSom:    p.amountSom    ?? p.amount_som    ?? p.data?.amountSom,
        amountUsd:    p.amountUsd    ?? p.amount_usd    ?? p.data?.amountUsd,
        debtBefore:   p.debtBefore   ?? p.debt_before   ?? p.data?.debtBefore,
        debtAfter:    p.debtAfter    ?? p.debt_after    ?? p.data?.debtAfter,
        debtBeforeUzs: p.debtBeforeUzs ?? p.debt_before_uzs ?? p.data?.debtBeforeUzs,
        debtBeforeUsd: p.debtBeforeUsd ?? p.debt_before_usd ?? p.data?.debtBeforeUsd,
        debtAfterUzs:  p.debtAfterUzs  ?? p.debt_after_uzs  ?? p.data?.debtAfterUzs,
        debtAfterUsd:  p.debtAfterUsd  ?? p.debt_after_usd  ?? p.data?.debtAfterUsd,
        methodBreakdown: p.methodBreakdown ?? p.method_breakdown ?? p.data?.methodBreakdown,
        serverWritten: true
      };
      return buildPayReceiptStyled(_p, {
        style: _st,
        shopName,
        settingsRate: (typeof _sr565 !== "undefined" ? _sr565 : 0),   // ✅ 565
        staffName: p.staff_name || "",
        cfg: { ...(_c || {}), shopName }
      });
    }
  } catch (e) { console.error("[bot] qarz cheki uslubi:", e.message); }
  return buildPayReceiptHtml(p, shopName, (typeof _ck !== "undefined" ? _ck : {}));
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
  // ✅ dublikat qulfi (60 daq) — navbat qayta urganda ikki nusxa tushmasin
  const _dl = await _dupLock("receipt", shopId, sale.chekNum || sale.chek_num || sale.id);
  if (_dl.dup) return { ok: true, sent: true, dup: true, groupSent: false };

  // 1. Avval telefondan qidiramiz
  if (customerPhone) {
    const rawPhone = normPhone(customerPhone);
    const normalize = p => p.startsWith("998") ? p.slice(3) : p;
    // \U0001f534 2026-08-14: avval BUTUN ro'yxat tortilardi — baza bir
    // marta ko'pi bilan 1000 qator qaytaradi, mijoz 1000 dan keyin
    // bo'lsa TOPILMASDI (egasining kuzatuvi: "do'kon o'ssa portlaydi").
    // Endi to'g'ridan-to'g'ri telefon bo'yicha so'raladi.
    const _tail = normalize(rawPhone).slice(-9);
    let all = await sb("customers",
      `?phone=ilike.*${encodeURIComponent(_tail)}*&select=id,local_id,phone,telegram_chat_id${shopFilter}&limit=50`);
    if (!all || !all.length) {
      // zaxira yo'l: eski usul (kichik do'konlarda ishlaydi)
      all = await sb("customers", `?select=id,local_id,phone,telegram_chat_id${shopFilter}&limit=1000`);
    }
    console.log(`[sendReceipt] nomzod=${all?.length}, qidirilgan=${rawPhone}`);
    const match = (all || []).find(c => {
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

  // ✅ 2026-08-15: ILOVA YUBORGAN CHEK MATNI USTUVOR. Shu bilan
  // botdagi chek sotuv cheki BILAN BIR XIL bo'ladi — ega qaysi
  // uslubni tanlagan bo'lsa, uning bo'limlari va tartibi botga ham
  // o'tadi (egasining talabi). Matn kelmasa — avvalgi yo'l.
  const txt = (body && typeof body.receiptText === "string" && body.receiptText.trim())
    ? body.receiptText.trim()
    : formatReceiptText(sale, shopName || "MERX");
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

  // ══════════════════════════════════════════════════════════════
  // MIJOZ GURUHIGA HAM (2026-08-05)
  // ══════════════════════════════════════════════════════════════
  // Ba'zi do'konlar har mijoz bilan alohida Telegram guruh ochadi
  // (do'kon egasi + mijoz + 2-3 kishi). Mijoz kartasida "Telegram
  // guruh ID" to'ldirilgan bo'lsa chek u yerga HAM boradi.
  //
  // ⚠️ MIJOZGA YUBORISH OQIMI TEGILMAGAN — u yuqorida tugadi va
  // natijasi shu yerda o'zgarmaydi. Guruhga yuborish QO'SHIMCHA:
  // xato bo'lsa jimgina o'tkaziladi, mijoz cheki baribir ketgan.
  let groupSent = false;
  try {
    const gid = String(body.groupId || "").trim();
    // Faqat haqiqiy Telegram guruh ID (manfiy, 5+ raqam)
    if (/^-?\d{5,}$/.test(gid) && String(gid) !== String(chatId)) {
      const gr = await tg(gid, txt, {
        reply_markup: {
          inline_keyboard: [[{ text: "📄 Chekni ko'rish", url: receiptUrl }]],
        },
      });
      groupSent = !!gr.ok;
      if (!gr.ok) console.warn(`[sendReceipt] guruhga yuborilmadi (${gid}):`,
                               gr.description);
    }
  } catch (e) { console.warn("[sendReceipt] guruh xato:", e.message); }

  await _dupMark(_dl.key);   // ✅ yuborildi — 60 daqiqalik muhr
  return { ok: true, sent: true, groupSent };
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

// ══════════════════════════════════════════════════════════════
// EGASIGA XABAR (2026-08-03)
// ══════════════════════════════════════════════════════════════
// SuperAdmin paneli `?action=send_owner_notif` ni chaqiradi
// (obuna muddati eslatmasi uchun), lekin bu amal SERVERDA
// UMUMAN YO'Q edi. So'rov javobsiz qolib, xato jimgina yutilardi:
// panel "yuborildi" deb ko'rsatardi, aslida hech kim xabar olmasdi.
//
// Egasining chat_id si `shop_owners` jadvalida — u bot bilan
// bog'langanda yoziladi. Bog'lanmagan bo'lsa xabar yuborilmaydi
// va buni ochiq aytamiz (yolg'on "yuborildi" bo'lmasin).
async function actionSendOwnerNotif(body) {
  const { shopId, text } = body || {};
  if (!shopId) return { ok: false, error: "shopId majburiy" };
  if (!text)   return { ok: false, error: "text majburiy" };

  let rows = [];
  try {
    rows = await sb("shop_owners",
      `?shop_id=eq.${encodeURIComponent(shopId)}&select=chat_id,shop_name`);
  } catch (e) {
    return { ok: false, sent: false, error: "shop_owners o'qilmadi: " + e.message };
  }

  const chats = (rows || []).map(r => r.chat_id).filter(Boolean);
  if (!chats.length)
    return { ok: true, sent: false, reason: "owner_not_linked",
             error: "Egasi botga ulanmagan — xabar yuborilmadi" };

  const shopN = (rows[0] && rows[0].shop_name) || "MERX";
  const msg = `🔔 <b>${shopN}</b>\n\n${text}`;

  let sent = 0;
  for (const cid of chats) {
    try {
      const r = await tg(cid, msg);
      if (r && r.ok) sent++;
    } catch (e) { console.warn("owner notif:", cid, e.message); }
  }
  return { ok: true, sent: sent > 0, count: sent, total: chats.length };
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
  // ✅ dublikat qulfi (60 daq) — navbat qayta urganda guruhga ikki
  // nusxa tushmasin (472 da guruh xabari navbatga ulandi — bu himoya
  // usiz javob-yo'qolish holatida omborchi kartani ikki marta ko'rardi).
  const _dl = await _dupLock("staffnotif", sid, chekId);
  if (_dl.dup) return { ok: true, sent: true, dup: true };
  const shopN  = shopName || "MERX";
  const items  = sale.items || [];
  const total  = Number(sale.total || 0);
  const paid   = Number(sale.paid  || 0);
  const rem    = Number(sale.remaining || 0);

  const custName  = sale.customerName  || sale.customer_name  || "";
  const custPhone = sale.customerPhone || sale.customer_phone || "";

  // SODDALASHTIRILGAN: omborchiga to'lov/qarz TAFSILOTI kerak emas —
  // faqat mijoz va tovar tafsilotlari (nima yig'ish kerakligi) muhim.
  // ⚠️ 2026-08-07: do'kon talabi bilan BITTA istisno — yakuniy JAMI
  // summa ko'rsatiladi. sale.total ilovada chegirmadan KEYINGI,
  // mijoz to'lashi kerak bo'lgan oxirgi qiymat (pos.js: total =
  // subtotal - discount). To'langan/qarz kabi boshqa pul
  // ma'lumotlari avvalgidek yozilmaydi.
  let txt = `🆕 <b>YANGI BUYURTMA</b>  <code>${chekId}</code>\n`;
  txt += `📅 ${sale.date || ""} ${sale.time || ""}\n`;
  if (custName)  txt += `\n👤 <b>${custName}</b>`;
  if (custPhone) txt += `  📞 ${custPhone}`;
  txt += `\n`;
  if (total > 0) txt += `💰 <b>Jami: ${fmt(total)} so'm</b>\n`;

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
  await _dupMark(_dl.key);   // ✅ yuborildi — 60 daqiqalik muhr
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
    const qtyBox  = it.qtyBox  || 0;
    const unit    = it.unit    || "dona";
    const lineTotal = (it.price || 0) * (it.qty || 0);

    // ⚠️ 2026-08-04: RASM BOSILGANDA KATTALASHADI.
    // Avval rasm bosilsa `toggleDone` ishlardi — ya'ni tovar
    // belgilanardi. Telefonda esa ekran surilmay qolardi va bosish
    // hech narsa hal qilmasdi. Belgilash uchun pastda alohida
    // "Tayyor belgilash" tugmasi bor — u TEGILMADI.
    const imgHtml = it.image
      ? `<img src="${it.image}" class="item-img"  onerror="this.style.display='none'">`
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
#lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);
  z-index:999;align-items:center;justify-content:center;cursor:zoom-out}
#lb.open{display:flex}
#lb img{max-width:96vw;max-height:88vh;object-fit:contain;border-radius:8px}
.card-img-wrap img{cursor:zoom-in}
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

<!-- ⚠️ 2026-08-04: RASM KATTALASHTIRISH ISHLAMASDI.
     Bu yerda display:none INLINE yozilgan edi, openLb() esa
     .open klassini qo'shadi — lekin uning uslubi UMUMAN
     ta'riflanmagan. Inline uslub klassdan kuchli, shuning uchun
     oyna hech qachon ochilmasdi.
     Endi display klass orqali boshqariladi. -->
<div id="lb" onclick="closeLb()">
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
    // 2026-07-17 (12-qoida: data HOKIM): to'liq maydonlar (prevDebtUsd,
    // basePrice, rate, payBreakdown, subtotal...) faqat data jsonb'da —
    // ustunlar bilan birlashtiramiz, aks holda PDF chek to'liq bo'lmaydi
    if (sale && sale.data && typeof sale.data === "object") sale = { ...sale, ...sale.data };
  }

  try {
    // ✅ MINA-1 (2026-08-26): avval do'kon noma'lum bo'lsa `?limit=1`
    // bazadagi BIRINChI do'kon nomini olardi. Endi: havolada kelmasa —
    // topilgan chekning O'Z do'konidan; u ham bo'lmasa — "MERX".
    const _s3 = sid || sale?.shop_id;
    if (_s3) {
      const sets = await sb("settings",
        `?shop_id=eq.${encodeURIComponent(_s3)}&select=shop_name&limit=1`);
      shopName = sets?.[0]?.shop_name || "MERX";
    }
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
    discount:       sale.discount != null ? sale.discount : ((sale.data && sale.data.discount) || 0),
    prevDebtUsd:    sale.prevDebtUsd != null ? sale.prevDebtUsd : (sale.prev_debt_usd != null ? sale.prev_debt_usd : ((sale.data && sale.data.prevDebtUsd) || 0)),
    prevDebtUzs:    sale.prevDebtUzs != null ? sale.prevDebtUzs : (sale.prev_debt_uzs != null ? sale.prev_debt_uzs : ((sale.data && sale.data.prevDebtUzs) || 0)),
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
  // 2026-07-17 (AbuSaxiy): PDF/bot cheki endi YAGONA shablonda — POS sotuv
  // cheki bilan bir xil: logo, namuna-params bloki, pch-format, JAMI POCHKA,
  // chizilgan chegirma narxlari, $ qatori. (Eski merx-uslub tarmog'i tark etildi.)
  const F = cfg.F;
  // 2026-07-19: banner foni (headerStyle) — boshqa cheklar bilan mos
  const _hs = ["dark","light","none"].includes(opts.headerStyle) ? opts.headerStyle : "dark";
  const _hCss = _hs === "light" ? "background:#fff;color:#0D1B2A;border-bottom:2px solid #0D1B2A"
              : _hs === "none" ? "background:#fff;color:#0D1B2A" : "background:#0D1B2A;color:#fff";
  const _hSub = _hs === "dark" ? "rgba(255,255,255,.8)" : "#667";
  const addr    = opts.addr    || "";
  const tagline = opts.tagline || "Ulgurji savdo tizimi";
  const items   = (s.items || []).filter(Boolean);
  const date    = (s.date||"").includes("-") ? s.date.split("-").reverse().join(".") : (s.date||"");
  const total = Number(s.total||0), paid = Number(s.paid||0);
  // ⚠️ 2026-08-03: CHEK MUZLATILADI (kontekst §3.5).
  // Avval `s.remaining` — HOZIRGI qoldiq ishlatilardi. Mijoz
  // keyinroq to'lov qilsa qoldiq kamayardi va BOTDAGI ESKI CHEK
  // ham o'zgargandek ko'rinardi:
  //   ilovada 500 000, botda 300 000
  // `origRemaining` — sotuv paytidagi asl qarz, u o'zgarmaydi.
  // Klientdagi (utils.js) qoidaning aynan o'zi.
  // Eski sotuvlarda bu maydon yo'q — o'shanda avvalgidek ishlaydi.
  const remaining = Number(s.origRemaining != null ? s.origRemaining : (s.remaining || 0));
  const discount = Number(s.discount||0);
  const rate = Number(s.rate||0);

  // ══════════════════════════════════════════════════════════════
  // ⚠️ 2026-08-03: IKKI VALYUTALI CHEK (kontekst §3.5)
  // ══════════════════════════════════════════════════════════════
  // Klient chekida har qator ikkala valyutada ko'rsatiladi:
  //     so'm rejimi   →  "540 000 / $42.19"
  //     dollar rejimi →  "$42.19 / 540 000"
  // Botda esa faqat JAMI qatorida dollar bor edi (`usdLine`),
  // qolgan qatorlar bitta valyutada chiqardi. Ya'ni mijoz botdan
  // olgan chek ilovadagidan farq qilardi.
  //
  // Kurs SOTUV PAYTIDAGI (`s.rate`) — keyin o'zgarsa chek
  // o'zgarmaydi. Do'kon xohlasa bitta valyuta qoldirishi mumkin
  // (`chekDual: false`), eski cheklar ham buzilmaydi.
  const _pcMode = s.priceCurrency || "uzs";
  const _pcRate = rate || 0;
  const _usdStr = som => "$" + (_pcRate > 0 ? (som / _pcRate) : 0)
    .toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const _dual = (s.chekDual != null) ? !!s.chekDual : true;

  // FC — pul ko'rsatish. Kurs yo'q bo'lsa faqat so'm (bo'linish xato
  // bermasin). Eski cheklarda `rate` bo'lmasligi mumkin.
  const FC = n => {
    const som = Math.round(n || 0);
    if (!_dual || _pcRate <= 0) return _pcMode === "usd" ? _usdStr(som) : F(som);
    return _pcMode === "usd"
      ? `${_usdStr(som)} / ${F(som)}`
      : `${F(som)} / ${_usdStr(som)}`;
  };
  const payLabels = { naqd:"Naqd pul", karta:"Karta", otkazma:"Bank o'tkazmasi", aralash:"Aralash", nasiya:"Nasiya", qarz:"Nasiya" };

  // 2026-07-18 YAKUNIY: nomer, IKKI CHETDAN tekis (namunadagidek), qora chizish
  // ⚠️ 2026-08-08: UMUMIY CHEGIRMA HAM TOVARLARGA YOYILADI.
  // Avval faqat TOVAR darajasidagi chegirma (basePrice) chizilgan
  // narx bilan ko'rinardi; savatga qo'yilgan UMUMIY chegirma esa
  // pastdagi bitta qatorda qolar, tovar narxlari asl holida turardi.
  // Endi ikkalasi ham qatorda ko'rinadi (do'kon talabi).
  const _effItems = spreadDiscount(s);
  const itemsHtml = items.map((i, ix) => {
    const _e = _effItems[ix] || {};
    const _p = Number(_e.effPrice != null ? _e.effPrice : (i.price || 0));
    const _asl = Number(_e.origPrice || i.basePrice || i.price || 0);
    const sum = _p * (i.qty||0);
    const clean = (i.variant||"").replace(/\(\d+ pochka\)/gi,"").replace(/\(\d+ pch\)/gi,"").trim().replace(/\/\s*$/,"").trim();
    const nm = [i.name||"", clean, i.art||""].filter(Boolean).join(" / ");
    const bp = (_asl > _p) ? `<s>${FC(_asl)}</s> ` : "";
    const isBox = i.sellMode === "karobka" && i.qtyBox && i.inBox;
    const calcLeft = isBox
      ? `${i.qtyBox}pch × (${i.inBox} ${i.unit||"dona"} × ${bp}${FC(_p)})`
      : `${i.qty} ${i.unit||"dona"} × ${bp}${FC(_p)}`;
    return `<div class="it"><div class="itn">${ix+1}. ${nm}</div>
      <div class="itc"><span>${calcLeft}</span><span class="itv">${FC(sum)}</span></div></div>`;
  }).join("");

  const jamiPch = items.reduce((a,i)=> a + ((i.sellMode==="karobka" && i.qtyBox) ? i.qtyBox : 0), 0);
  const itemDisc = items.reduce((a,i)=> a + ((i.basePrice && i.basePrice > (i.price||0)) ? (i.basePrice-i.price)*(i.qty||1) : 0), 0);
  // 2026-08-03: `usdLine` OLIB TASHLANDI — endi FC har qatorda
  // ikki valyutani o'zi qo'shadi, ikki marta chiqmasin.

  const pb = s.payBreakdown;
  const pbRows = pb ? Object.entries(pb).filter(([,v]) => (v||0) > 0) : [];
  const payHtml = pbRows.length > 1
    ? pbRows.map(([m,v]) => `<div class="r"><span>${payLabels[m]||m}</span><span>${FC(v)}</span></div>`).join("")
    : `<div class="r"><span>To'lov turi</span><b>${payLabels[s.payType]||s.payType||"—"}</b></div>`;

  // ⚠️ 2026-08-03: QAYTARISH BELGISI (kontekst §3.6).
  // Klient chekida qaytarilgan sotuv ochiq belgilanadi, botda esa
  // UMUMAN ko'rinmasdi — mijoz qaytarib bergan tovar chekda
  // hech qanday izsiz qolardi.
  let _refundNote = "";
  try {
    const _refs = Array.isArray(s.refunds) ? s.refunds : [];
    if (_refs.length) {
      const _rTot = Number(s.refundedTotal || 0)
                 || _refs.reduce((a, r) => a + Number(r.total || 0), 0);
      const _full = s.status === "qaytarilgan";
      const _nos  = _refs.map(r => r.no).filter(Boolean).join(", ");
      _refundNote = `
        <div style="margin:8px 0 0;padding:8px 10px;border:1px dashed #B91C1C;
          border-radius:6px;background:#FEF2F2">
          <div style="font-size:12px;font-weight:800;color:#B91C1C">
            ${_full ? "TO'LIQ QAYTARILGAN" : "QISMAN QAYTARILGAN"}</div>
          <div style="font-size:11.5px;color:#000;margin-top:2px">
            Qaytarilgan summa: <b>${FC(_rTot)}</b></div>
          ${_nos ? `<div style="font-size:11px;color:#333;margin-top:2px">
            Hujjat: ${_nos}</div>` : ""}
          ${(() => {
            // ⚠️ 2026-08-05: QAYSI TOVAR QAYTARILGANI.
            // `refunds[].items` da nom, variant, miqdor va narx
            // saqlanadi (tarix.js) — lekin chekda ko'rsatilmasdi.
            // Mijoz nima qaytarganini aniq ko'rsin.
            const rows = [];
            _refs.forEach(r => (r.items || []).forEach(it => {
              const qty = it.qtyBox
                ? `${it.qtyBox} pochka` : `${it.qty || 0} dona`;
              rows.push(`<div style="font-size:11px;color:#000">
                • ${it.name || ""}${it.variant ? " (" + it.variant + ")" : ""}
                — ${qty}</div>`);
            }));
            return rows.length
              ? `<div style="margin-top:4px;padding-top:4px;
                   border-top:1px dashed #FCA5A5">${rows.join("")}</div>`
              : "";
          })()}
        </div>`;
    }
  } catch(e) {}

  // 2026-07-17 (NAMUNA): MIJOZ QARZI bo'limi DOIM — POS chek bilan bir xil
  const isUsd = s.debtCurrency === "usd" || (Number(s.prevDebtUsd) || 0) > 0; // 2026-07-18: to'langan sotuvda ham $ qarz ko'rinsin
  const DP = v => isUsd ? `$${Number(v||0).toFixed(2)}` : `${F(v||0)} so'm`;
  const dPrev = isUsd ? (s.prevDebtUsd || 0) : (s.prevDebtUzs || 0);
  // ⚠️ 2026-08-03: DOLLAR QARZI HAM MUZLATILADI.
  // `origDebtUsd` — sotuv paytidagi asl dollar qarzi. Klientdagi
  // (utils.js) qoidaning aynan o'zi. Yo'q bo'lsa eskisi ishlatiladi.
  const _dUsdFrozen = s.origDebtUsd != null ? Number(s.origDebtUsd)
                    : (s.debtUsd != null ? Number(s.debtUsd) : 0);
  const dNew  = isUsd ? (_dUsdFrozen || 0) : (remaining     || 0);
  // 2026-07-25: dollar ishlatilsa — qo'shilgan qarz "summa / kurs = $"
  // ko'rinishida (klient cheki bilan bir xil). Kurs sotuv paytidagi.
  const _sRate  = Number(s.rate) || 0;
  const _sMode  = s.priceCurrency || "uzs";
  const _showUsd = (_sMode === "both" || _sMode === "usd" || isUsd) && _sRate > 0;
  const _addedTxt = _showUsd
    ? `${F(remaining || 0)} / ${F(_sRate)} = $${(isUsd ? dNew : (remaining || 0) / _sRate).toFixed(2)}`
    : DP(dNew);
  let debtHtml = `<div class="lbl">Mijoz qarzi</div>
    <div class="r sm"><span>Xariddan oldingi qarz</span><span>${DP(dPrev)}</span></div>
    <div class="r sm"><span>+ Qarzga qo'shildi</span><span>${_addedTxt}</span></div>
    <div class="r bold"><span>Xariddan keyingi qarz</span><span>${DP(dPrev + dNew)}${isUsd ? " USD" : ""}</span></div>`;
  if (s.due && dNew > 0) debtHtml += `<div class="r sm"><span>Muddat</span><span><b>${s.due.split("-").reverse().join(".")}</b></span></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${s.chekNum||""}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:${opts.fontFamily || "'DM Sans',Arial,sans-serif"};background:#F2F0EB;display:flex;justify-content:center;padding:14px 6px}
.rc{width:330px;max-width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 18px rgba(13,27,42,.12);zoom:${opts.fontScale || 1}}
.logo{text-align:center;padding:8px 8px 2px}
.logo img{width:100%;max-height:64px;object-fit:contain}
.hd{${_hCss};text-align:center;padding:12px 10px}
.hd .nm{font-size:18px;font-weight:800;letter-spacing:.04em}
.hd .sub{font-size:10.5px;color:${_hSub};margin-top:2px}
.meta{padding:8px 14px;font-size:12.5px;line-height:1.8;border-bottom:1px dashed #ddd}
.meta b{font-weight:800}
.lbl{font-size:10px;color:#777;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:7px 14px 2px}
.it{padding:5px 14px;border-bottom:1px dashed #eee}
.itn{font-size:13px;font-weight:800;color:#0D1B2A}
.itc{font-size:13px;color:#000;margin-top:1px;display:flex;justify-content:space-between;gap:6px}
.itv{font-weight:800;white-space:nowrap}
.r{display:flex;justify-content:space-between;padding:2px 14px;font-size:13px}
.r.sm{font-size:12px;color:#555}
.r.bold{font-weight:800;font-size:14px}
.tot{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-top:2px solid #0D1B2A;border-bottom:1px dashed #ddd}
.tot .v{font-size:18px;font-weight:900;white-space:nowrap}
.ft{text-align:center;padding:10px 8px;font-size:12px;color:#444;font-style:italic}
.ft2{text-align:center;font-size:10.5px;color:#999;padding-bottom:10px}
.acts{display:flex;gap:8px;justify-content:center;padding:12px}
.btn{border:none;border-radius:9px;padding:10px 18px;font-weight:700;cursor:pointer}
@media print{
  @page{size:58mm auto;margin:0} body{background:#fff;padding:0} .rc{width:58mm;box-shadow:none;border-radius:0}
  .acts{display:none}
  ${_hs === "dark"
    ? ".hd{background:#0D1B2A !important;-webkit-print-color-adjust:exact;print-color-adjust:exact} .hd, .hd *{color:#fff !important}"
    : ".hd{background:#fff !important;border-bottom:2px solid #000} .hd, .hd *{color:#000 !important}"}
  .itn,.itc,.r,.meta,.ft,.ft2,.lbl,s{color:#000 !important}
  s{text-decoration-thickness:1.6px}
  .r,.r.sm,.meta,.itc,.itn{font-size:13.5px !important}
}
</style></head><body><div>
<div class="rc">
  ${cfg.logo ? `<div class="logo"><img src="${cfg.logo}"></div>` : ""}
  <div class="hd">
    <div class="nm">${(cfg.shopName||"MERX").toUpperCase()}</div>
    <div class="sub">${tagline}</div>
  </div>
  <div class="meta">
    <div><b>Sotuv:</b> ${s.chekNum || "#"+s.id}</div>
    ${addr ? `<div><b>Do'kon:</b> ${addr}</div>` : ""}
    <div><b>Sana:</b> ${date} ${s.time||""}</div>
    ${s.staffName ? `<div><b>Sotuvchi / Kassir:</b> ${s.staffName}</div>` : ""}
    ${cfg.contact ? `<div><b>Kontaktlar:</b> ${cfg.contact}</div>` : ""}
    <div><b>Mijoz:</b> ${s.customerName || "Noma'lum"}</div>
    ${s.customerPhone ? `<div><b>Mijoz raqami:</b> ${s.customerPhone}</div>` : ""}
  </div>
  <div class="lbl">Mahsulotlar</div>
  ${itemsHtml}
  ${jamiPch > 0 ? `<div class="r bold" style="padding-top:6px"><span>JAMI POCHKA</span><span>${jamiPch} pochka</span></div>` : ""}
  ${(itemDisc + discount) > 0 ? `<div class="r sm"><span>Jami (chegirmasiz)</span><span>${F(total + itemDisc + discount)} so'm</span></div>` : ""}
  ${itemDisc > 0 ? `<div class="r sm"><span>Tovar chegirmalari</span><span>−${FC(itemDisc)}</span></div>` : ""}
  ${discount > 0 ? `<div class="r sm"><span>Umumiy chegirma</span><span>−${FC(discount)}</span></div>` : ""}
  <div class="tot"><span style="font-weight:800">JAMI</span><span class="v">${FC(total)}</span></div>
  <div class="lbl">To'lov</div>
  ${payHtml}
  ${paid > 0 ? `<div class="r"><span>To'landi</span><span style="font-weight:700">${FC(paid)}</span></div>` : ""}
  ${debtHtml}
  ${_refundNote}
  <div class="ft">${cfg.footer}</div>
  ${(Array.isArray(opts.extraLines) && opts.extraLines.length) ? `<div style="text-align:center;font-size:12px;color:#000;padding:2px 8px 4px">${opts.extraLines.filter(Boolean).map(t=>`<div>${t}</div>`).join("")}</div>` : ""}
  <div class="ft2">${cfg.shopName} · ${date}</div>
</div>
<div class="acts">
  <button class="btn" style="background:#0D1B2A;color:#fff" onclick="window.print()">🖨 Chop etish</button>
  <button class="btn" style="background:#eee" onclick="window.close?window.close():history.back()">Yopish</button>
</div>
</div></body></html>`;
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
    // 2026-07-18 (12-qoida: data HOKIM): chegirma (basePrice/discount) va
    // prevDebtUsd/Uzs FAQAT data jsonb'da — data USTUN turadi, items ham
    // data'dan (basePrice bilan). Aks holda PDF chekda chegirma va eski
    // qarz ko'rinmasdi (AbuSaxiy bugi).
    if (sale && sale.data && typeof sale.data === "object") {
      const _d = sale.data;
      sale = { ...sale, ..._d, items: (_d.items && _d.items.length) ? _d.items : sale.items };
    }
  }

  try {
    const _sf = (shopId || sale?.shop_id) ? `&shop_id=eq.${encodeURIComponent(shopId || sale.shop_id)}` : "";
    // ✅ MINA-1: do'kon noma'lum — sozlama SO'RALMAYDI (begona nom/logo/kurs chiqmasin)
    const sets = _sf ? await sb("settings", `?limit=1&select=shop_name,chek_config,rate${_sf}`) : [];
    shopName = sets?.[0]?.shop_name || "MERX";
    var _ck = sets?.[0]?.chek_config || {}; // 2026-07-17: SHU funksiya o'z sozlamasini oladi (ReferenceError tuzatildi)
    var _sr565s = Number(sets?.[0]?.rate) || 0;   // ✅ 565
  } catch { var _ck = {}; var _sr565s = 0; }
  if (typeof _ck === "undefined") var _ck = {};

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

  // 2026-07-18 (2-bosqich): telefonlar massivi + qo'shimcha matnlar
  const _ckContact = (Array.isArray(_ck.phones) && _ck.phones.length)
    ? _ck.phones.filter(Boolean).join(", ")
    : (_ck.contact || "");
  // ✅ 2026-08-15: BARCHA USLUBLAR botda ham bor (yuqoriga ko'chirildi).
  // Uslub tanlovi: sotuvda MUHRLANGAN `chekStyle` ustuvor — eski
  // cheklar o'z ko'rinishida qoladi (§3.5). Muhr yo'q bo'lsa do'kon
  // sozlamasi. Avval faqat `merx` uzatilardi, qolganlari standartga
  // tushib qolardi (egasining kuzatuvi).
  // ✅ QP-1 (2026-08-26): qizil eslatma uchun PUL XULOSASI — refundNo
  // bo'yicha QTQ va xarajat yozuvlari. FAQAT O'QISH; shop filtri MAJBURIY
  // (MINA-1 darsi). Xato bo'lsa — eslatma pul satrsiz, chek baribir chiqadi.
  try {
    const _shp = shopId || sale?.shop_id;
    const _nos = (sale?.refunds || []).map(r => r && r.no).filter(Boolean);
    if (sale && _shp && _nos.length) {
      const _orP = _nos.map(n => `data->>refundNo.eq.${encodeURIComponent(n)}`).join(",");
      const [_pz, _xz] = await Promise.all([
        sb("debt_payments", `?select=amount,currency,data&shop_id=eq.${_shp}&data->>source=eq.refund&or=(${_orP})`),
        sb("xarajatlar", `?select=amount,method,data&shop_id=eq.${_shp}&or=(${_orP})`)
      ]);
      const _plB = _refundPulYig(sale.refunds, _pz, _xz);
      if (_plB) sale._refPul = _plB;
    }
  } catch (e) { console.warn("[receipt] pul xulosasi:", e.message); }
  return buildReceiptStyled(sale, {
    style: _botChekStyle(sale, _ck),
    _chekCfg: _ck,
    shopName,
    settingsRate: (typeof _sr565s !== "undefined" ? _sr565s : 0),   // ✅ 565
    logo:    _ck.logo    || null,
    addr:    _ck.addr    || "",
    contact: (_ck.showContact !== false ? _ckContact : "") || "",
    tagline: _ck.tagline || "Ulgurji savdo tizimi",
    footer:  _ck.footer  || "Rahmat! Yana kutamiz 🙏",
    extraLines: Array.isArray(_ck.extraLines) ? _ck.extraLines : [],
    fontScale: ({ small:0.9, large:1.12, xlarge:1.25 })[_ck.fontScale] || 1,
    fontFamily: ({ mono:"'Courier New',monospace", serif:"'Georgia',serif", sans:"'Arial',sans-serif" })[_ck.fontFamily] || "'DM Sans',Arial,sans-serif",
    headerStyle: _ck.headerStyle || "dark" // 2026-07-19: banner foni
  });
}

// ── /stat (oylik statistika) ─────────────────────────────────
async function cmdOylikStat(chatId) {
  try {
    const ctx = await getShopCtx(chatId);
    const sid = ctx.shopId;
  // ⚠️ 2026-08-04: DO'KON ANIQLANMASA — MA'LUMOT BERILMAYDI.
    // Avval `shopId` null bo'lsa `sidFilter` BO'SH qolardi va so'rov
    // BARCHA DO'KON ma'lumotini qaytarardi. Ya'ni botni topgan begona
    // odam `/hisobot` yozib hamma do'konning savdo raqamlarini
    // ko'ra olardi.
    // SuperAdmin (`OWNER_ID`) uchun istisno — u ataylab hammasini
    // ko'radi, lekin sarlavhada bu ochiq yoziladi.
    if (!ctx.shopId && !ctx.isSuperAdmin) {
      await tg(chatId, "🔒 Do'kon aniqlanmadi.\n\n" +
        "/start bosing yoki do'kon egasidan havola so'rang.");
      return;
    }

        const sidFilter = sid ? `&shop_id=eq.${sid}` : "";
    // 2026-08-04: Toshkent vaqtida (yuqoridagi `thisMonth` izohiga qarang).
  // Oy boshida UTC hali oldingi oyda bo'lardi va statistika bir kun
  // noto'g'ri chiqardi.
  const m = thisMonth();

    const [sales, xarajat] = await Promise.all([
      sbAll("sales", `?date=gte.${m}-01&status=neq.bekor&order=date.asc${sidFilter}`).then(r => r.rows),
      sbAll("xarajatlar", `?date=gte.${m}-01${sidFilter}`).then(r => r.rows),
    ]);
    // 2026-08-07: yuqorida sahifalab olindi — avval bitta so'rov 1000
    // qatordan keyin JIMGINA kesardi va oylik raqam kam chiqishi
    // mumkin edi (§4.4, №9)

    // ⚠️ 2026-08-04: SUPERADMIN UCHUN SARLAVHA ANIQ BO'LSIN.
    // Avval `MERX — Bugungi savdo` deb yozilardi va bu bitta
    // do'kon hisobotiga o'xshardi. Aslida SuperAdminda BARCHA
    // do'kon yig'indisi chiqadi (`shopId` null → filtr yo'q).
    // 2026-08-04: SuperAdmin bitta do'konni tanlagan bo'lsa —
    // o'sha do'kon nomi. Tanlanmagan bo'lsa yig'indi ekani ochiq.
    const shopName = (ctx.isSuperAdmin && !ctx.shopId)
      ? "BARCHA DO'KONLAR"
      : (ctx.shopName || "MERX");
    // ⚠️ 2026-08-04: ESKI QARZLAR STATISTIKAGA KIRMAYDI.
  // `isOldDebt` — Billz'dan ko'chirilgan eski qarzlar (335 ta).
  // Ular HAQIQIY SOTUV EMAS, faqat qarz yozuvi. Ilovadagi
  // `statSales()` ularni chiqarib tashlaydi, botda esa kirardi
  // va oylik statistikani shishirardi.
  // ⚠️ `/qarzlar` da ular QOLADI — u yerda haqiqiy qarz.
  const _oldDebt = x => (x?.data && x.data.isOldDebt) === true;
  const _statSales = sales.filter(x => !_oldDebt(x));

  const totalSum  = _statSales.reduce((a, s) => a + Number(s.total || 0), 0);
    const totalPaid = _statSales.reduce((a, s) => a + Number(s.paid || 0), 0);
    const totalDebt = _statSales.reduce((a, s) => a + Number(s.remaining || 0), 0);
    const totalExp  = xarajat.reduce((a, x) => a + Number(x.amount || 0), 0);
    // ⚠️ 2026-08-04: "Toza foyda" NOMI NOTO'G'RI EDI.
  // Hisob: tushum − xarajat. TANNARX umuman ayrilmaydi, ya'ni bu
  // FOYDA EMAS. Egasi 190 mln "foyda" ko'rib, aslida tovarning
  // tannarxi hali ayrilmagan bo'lardi.
  // Haqiqiy foyda uchun har sotuvdagi tovar tannarxini yig'ish
  // kerak — bu alohida ish (ilovada `calcMarkup` bor).
  // Hozircha NOM to'g'rilandi: aldamaydigan bo'ldi.
  const foyda     = totalPaid - totalExp;

    // Kunlik o'rtacha
    // Kun raqami ham Toshkent bo'yicha — o'rtacha hisobi to'g'ri bo'lsin
  const days = Number(today().slice(8, 10));
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
    txt += `🛍 Jami sotuvlar: ${_statSales.length} ta\n`;
    txt += `💵 Jami summa: ${fmt(totalSum)} so'm\n`;
    txt += `✅ To'langan: ${fmt(totalPaid)} so'm\n`;
    if (totalDebt > 0) txt += `🔴 Nasiya: ${fmt(totalDebt)} so'm\n`;
    txt += `💸 Xarajatlar: ${fmt(totalExp)} so'm\n`;
    txt += `💰 Tushum − xarajat: ${fmt(foyda)} so'm\n`;
  txt += `<i>   (tannarx ayrilmagan)</i>\n`;
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
// ══════════════════════════════════════════════════════════════
// /tizim — SUPERADMIN UCHUN TIZIM HOLATI (2026-08-04)
// ══════════════════════════════════════════════════════════════
// SuperAdmin panelidagi asosiy raqamlar botda. Faqat OWNER_ID
// ko'radi — boshqalarga javob berilmaydi.
// Manba: `shops`, `sa_income`, `sa_expense` va `sa_db_stats()`.
// Server kaliti bilan o'qish — faqat SuperAdmin ma'lumoti uchun.
// Kalit yo'q bo'lsa bo'sh massiv (xato bermaydi).
async function _sbService(table, query) {
  if (!SB_SERVICE) return [];
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}${query}`, {
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }
    });
    return r.ok ? await r.json() : [];
  } catch (e) { console.warn("_sbService:", e.message); return []; }
}

async function cmdTizim(chatId) {
  if (!OWNER_ID || String(chatId) !== String(OWNER_ID)) {
    await tg(chatId, "🔒 Bu buyruq faqat tizim egasi uchun.");
    return;
  }
  try {
    const [shops, inc, exp] = await Promise.all([
      // ⚠️ 2026-08-04: ustun nomi `trial_ends` (`expires_at` YO'Q).
      sb("shops", "?select=id,name,plan,trial_ends,active&order=name"),
      _sbService("sa_income",  "?select=amount,currency,rate"),
      _sbService("sa_expense", "?select=amount,currency,rate")
    ]);

    const bugun = today();
    const kunFarq = (d) => d
      ? Math.ceil((new Date(d) - new Date(bugun)) / 86400000) : null;

    let t = "👑 <b>TIZIM HOLATI</b>\n\n";

    // ── Do'konlar ──
    const faol = (shops || []).filter(x => {
      const k = kunFarq(x.trial_ends);
      return x.active !== false && (k === null || k >= 0);
    }).length;
    t += `🏪 <b>Do'konlar: ${(shops || []).length}</b> · ${faol} faol\n`;
    (shops || []).forEach(x => {
      const k = kunFarq(x.trial_ends);
      let belgi = "  ";
      if (k !== null && k < 0)       belgi = "🔴";
      else if (k !== null && k <= 7) belgi = "🟡";
      else                           belgi = "🟢";
      const muddat = x.trial_ends ? String(x.trial_ends).slice(0, 10) : "—";
      const qolgan = (k !== null && k >= 0) ? ` (${k} kun)` : (k !== null ? " (o'tgan)" : "");
      t += `${belgi} ${x.name} — ${muddat}${qolgan}\n`;
    });

    // ── Server hajmi ──
    try {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/sa_db_stats`, {
        method: "POST",
        headers: { apikey: SB_SERVICE || SB_KEY,
                   Authorization: `Bearer ${SB_SERVICE || SB_KEY}`,
                   "Content-Type": "application/json" },
        body: "{}"
      });
      if (r.ok) {
        const d = await r.json();
        const mb = b => (b / 1048576).toFixed(1);
        const pct = (b, lim) => ((b / lim) * 100).toFixed(1);
        const dbB = d?.db_bytes || 0;
        t += `\n💾 <b>Baza:</b> ${mb(dbB)} MB / 500 MB (${pct(dbB, 500*1048576)}%)\n`;
        t += `🧮 Yozuvlar: ${(d?.total_rows || 0).toLocaleString("ru-RU")}\n`;
        const top = (d?.tables || [])[0];
        if (top) t += `📊 Eng katta: ${top.name} (${mb(top.bytes)} MB)\n`;
      }
    } catch (e) { console.warn("tizim: db stats", e.message); }

    // ── Moliya ──
    // Kurs YOZUVDA muzlatilgan (kontekst §3.5) — o'zgarmaydi.
    const yig = rows => (rows || []).reduce((a, x) => {
      const v = Number(x.amount) || 0;
      return a + (x.currency === "usd" ? v * (Number(x.rate) || 12100) : v);
    }, 0);
    const dIn = yig(inc), dEx = yig(exp);
    const F2 = n => Math.round(n).toLocaleString("ru-RU");
    t += `\n📈 <b>Daromad:</b> ${F2(dIn)} so'm\n`;
    t += `📉 <b>Xarajat:</b> ${F2(dEx)} so'm\n`;
    t += `💰 <b>Foyda:</b> ${F2(dIn - dEx)} so'm\n`;

    await tg(chatId, t);
  } catch (e) {
    console.error("cmdTizim xato:", e.message);
    await tg(chatId, "⚠️ Ma'lumot olinmadi: " + e.message);
  }
}

// ══ /egaqoshish (2026-08-09) ════════════════════════════
// Oqim: sherik havolani bosadi → bot unga ID sini ko'rsatadi →
// sherik ID ni egaga yuboradi → ega botda `/egaqoshish <ID>` yozadi
// → sherik shop_owners ga qo'shiladi va unga xabar boradi.
// Xavfsizlik: yozayotgan odam O'SHA do'konda shop_owners da bo'lishi
// SHART; ko'p do'konli ega avval /mendokonlarim bilan tanlaydi.
async function cmdEgaQoshish(chatId, arg) {
  const cid = String(chatId);
  const newId = String(arg || "");
  if (!/^[0-9]{5,15}$/.test(newId)) {
    await tg(chatId,
      "ℹ️ Ishlatilishi: <code>/egaqoshish 123456789</code>\n\n" +
      "Sherik avval bot havolasini bosadi — bot unga ID sini ko'rsatadi. " +
      "Sherik shu ID ni sizga yuboradi, siz esa yuqoridagi buyruq bilan qo'shasiz.");
    return;
  }
  if (newId === cid) { await tg(chatId, "ℹ️ Bu sizning o'z ID raqamingiz."); return; }

  const mine = await sb("shop_owners",
    `?chat_id=eq.${cid}&select=shop_id,shop_name`).catch(() => []);
  if (!mine?.length) {
    await tg(chatId, "⛔ Bu buyruq faqat do'kon egasi uchun.");
    return;
  }
  let t = mine[0];
  if (mine.length > 1) {
    const ctx = await getShopCtx(chatId).catch(() => null);
    const sel = ctx && ctx.shopId ? mine.find(m => m.shop_id === ctx.shopId) : null;
    if (!sel) {
      await tg(chatId,
        "ℹ️ Sizda bir nechta do'kon bor. Avval /mendokonlarim orqali " +
        "do'konni tanlang, keyin buyruqni qayta yuboring.");
      return;
    }
    t = sel;
  }

  let ok = false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/shop_owners?on_conflict=chat_id,shop_id`, {
      method: "POST",
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json", Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({ chat_id: newId, shop_id: t.shop_id, shop_name: t.shop_name || "MERX" })
    });
    ok = r.ok;
    if (!r.ok) console.error("[egaqoshish] yozilmadi:", r.status, await r.text().catch(()=>""));
  } catch(e) { console.error("[egaqoshish] xato:", e.message); }

  if (!ok) {
    await tg(chatId, "⚠️ Qo'shishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
    return;
  }
  await tg(chatId, "✅ <b>" + newId + "</b> endi <b>" +
    (t.shop_name || t.shop_id) + "</b> do'koniga EGA sifatida ulandi.");
  // Yangi egaga xabar (u botni allaqachon /start qilgan — havolani bosganda)
  try {
    await tg(newId, "✅ Siz <b>" + (t.shop_name || "MERX") +
      "</b> do'koniga EGA sifatida ulandingiz.\n" +
      "Endi /hisobot, /balans, /qarzlar buyruqlari sizga ham ishlaydi.");
  } catch(e) {}
}

async function cmdMenDokonlarim(chatId) {
  console.log(`[mendokonlarim] chatId=${chatId} (type=${typeof chatId})`);

  // ⚠️ 2026-08-04: SUPERADMIN UCHUN ALOHIDA RO'YXAT.
  // Avval SuperAdmin `getShopCtx` ning eng boshida ushlanib qolardi
  // va do'kon TANLAY OLMASDI — har doim barcha do'kon yig'indisini
  // ko'rardi. Endi ikki rejim:
  //   • "Barcha do'konlar" — yig'indi (SuperAdmin nazorati uchun)
  //   • bitta do'kon — o'sha do'kon ma'lumoti (sinov uchun)
  // Tanlov `bot_sessions` da saqlanadi, oddiy egadagi kabi.
  if (OWNER_ID && String(chatId) === String(OWNER_ID)) {
    const all = await sb("shops", "?select=id,name&order=name");
    const cur = await sb("bot_sessions",
      `?chat_id=eq.${chatId}&select=shop_id,shop_name&limit=1`);
    const curId = cur?.[0]?.shop_id || null;

    let t = "👑 <b>SuperAdmin rejimi</b>\n\n";
    t += curId
      ? `Hozir: <b>${cur[0].shop_name || curId}</b>\n\n`
      : "Hozir: <b>Barcha do'konlar</b> (yig'indi)\n\n";
    t += "Rejimni tanlang:";

    const btns = [[{ text: (curId ? "" : "✅ ") + "📊 Barcha do'konlar",
                     callback_data: "sa_all" }]];
    (all || []).forEach(x => btns.push([{
      text: (String(x.id) === String(curId) ? "✅ " : "") + "🏪 " + x.name,
      callback_data: "sa_shop:" + x.id
    }]));

    await tg(chatId, t, { reply_markup: { inline_keyboard: btns } });
    return;
  }

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
    txt += "/balans — Kassa holati (naqd, karta, tushum)\n";
    txt += "/ombor — Kam qolgan tovarlar\n";
    txt += "/qarzlar — Muddati o'tgan qarzlar\n";
    txt += "/barcha_qarzlar — Barcha ochiq qarzlar\n";
    txt += "/stat — Bu oylik statistika\n";
    txt += "/naklad — 🤖 AI orqali naklad rasmidan tovar import qilish\n";
    // 2026-08-04: SuperAdmin buyruqlari — faqat tizim egasiga
    if (ctx.isSuperAdmin) {
      txt += "\n👑 Tizim egasi uchun:\n";
      txt += "/tizim — Do'konlar, server hajmi, moliya\n";
      txt += "/mendokonlarim — Rejim: barcha do'kon yoki bittasi\n";
    }
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
  // ⚠️ 2026-08-04: `Authorization` VA `x-merx-key` QO'SHILDI.
  // Ilova `app.merx.uz` da, bot esa `merx-rho.vercel.app` da —
  // ya'ni BOSHQA MANZIL. Brauzer `Authorization` sarlavhali
  // so'rovdan oldin ruxsat so'raydi (preflight) va ro'yxatda
  // bo'lmagan sarlavhani TO'SADI.
  // Busiz chek va guruh xabari "internet bormi?" xatosi bilan
  // to'xtab qoldi (2026-08-05).
  res.setHeader("Access-Control-Allow-Headers",
                "Content-Type, Authorization, x-merx-key");

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

  // ══════════════════════════════════════════════════════════
  // ⚠️ 2026-08-04: HTTP AMALLARI UCHUN KALIT
  // ══════════════════════════════════════════════════════════
  // `api/bot.js` manzili ochiq edi — kim bilsa chaqira olardi:
  //   send_text        → istalgan chat'ga xabar yuborish
  //   send_receipt     → soxta chek
  //   send_staff_notif → omborchi guruhiga soxta buyurtma
  //   set_done         → tovarni "tayyor" deb belgilash
  //
  // BOSQICHMA-BOSQICH: hozir kalit TEKSHIRILADI, lekin TALAB
  // QILINMAYDI — kalitsiz so'rov ham o'tadi va log yoziladi.
  // Klient kalit yubora boshlagach va loglarda kalitsiz so'rov
  // qolmagach, `MERX_BOT_STRICT=1` qo'yiladi va talab qilinadi.
  // Shunda hech narsa to'satdan to'xtamaydi.
  // ⚠️ KLIENTDAGI KALIT HIMOYA EMAS — brauzer kodini kim ochsa
  // ko'radi. Shuning uchun SUPABASE AUTH TOKENI tekshiriladi:
  // ilovada u allaqachon bor (egasi ham, xodim ham).
  // Zaxira sifatida `MERX_BOT_KEY` ham qabul qilinadi — u
  // serverdan serverga chaqiruvlar uchun (SuperAdmin paneli).
  const _BOT_KEY    = process.env.MERX_BOT_KEY || "";
  const _BOT_STRICT = process.env.MERX_BOT_STRICT === "1";
  // ⚠️ `set_done` RO'YXATDA YO'Q: u omborchi sahifasidan (Telegram
  // mini-app) chaqiriladi, u yerda Supabase sessiyasi bo'lmaydi.
  // Xavfi past — faqat "tayyor" belgisi qo'yiladi, ma'lumot
  // o'qilmaydi va xabar yuborilmaydi.
  const _PROTECTED  = ["send_text","send_receipt","send_pay_receipt",
                       "send_staff_notif","send_owner_notif"];
  const _act = req.query?.action || "";

  if (_PROTECTED.includes(_act)) {
    let _ok = false, _kim = "";

    // 1) Supabase Auth tokeni
    const _auth = req.headers["authorization"] || "";
    const _tok  = _auth.startsWith("Bearer ") ? _auth.slice(7) : "";
    if (_tok) {
      try {
        const r = await fetch(`${SB_URL}/auth/v1/user`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${_tok}` }
        });
        if (r.ok) {
          const u = await r.json();
          if (u?.id) { _ok = true; _kim = u.email || u.id; }
        }
      } catch (e) { console.warn("[bot] token tekshiruvi:", e.message); }
    }

    // 2) Zaxira: server kaliti
    if (!_ok && _BOT_KEY && req.headers["x-merx-key"] === _BOT_KEY) {
      _ok = true; _kim = "server";
    }

    // BOSQICHMA-BOSQICH: hozir rad etilmaydi, faqat log yoziladi.
    // Klient token yubora boshlagach va loglarda "RUXSATSIZ"
    // qolmagach, `MERX_BOT_STRICT=1` qo'yiladi.
    if (!_ok) {
      if (_BOT_STRICT) {
        console.warn(`[bot] RAD ETILDI: ${_act}`);
        return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });
      }
      console.warn(`[bot] RUXSATSIZ: ${_act} — hozircha o'tkazildi ` +
                   `(MERX_BOT_STRICT=1 qo'yilsa rad etiladi)`);
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
      // ⚠️ 2026-08-08: SESSIYASIZ HIMOYA (§14.C-8).
      // `set_done` ni oddiy token ro'yxatiga qo'shib bo'lmaydi:
      // u omborchining Telegram mini-app'idan chaqiriladi, u yerda
      // Supabase sessiyasi YO'Q — qo'shilsa "Tayyor" tugmasi o'lardi.
      // Shuning uchun boshqa qo'riqchi: chek raqami HAQIQATAN
      // mavjudligini bazadan tekshiramiz. Shu bilan tasodifiy yoki
      // o'ylab topilgan chek raqamlari bilan jadvalni to'ldirib
      // bo'lmaydi, omborchi oqimi esa avvalgidek ishlaydi.
      let _chekBor = false;
      try {
        const _s = await sb("sales", `?chek_num=eq.${encodeURIComponent(chekId)}&select=chek_num&limit=1`);
        _chekBor = Array.isArray(_s) && _s.length > 0;
      } catch(e) { _chekBor = true; /* baza javob bermasa oqimni to'xtatmaymiz */ }
      if (!_chekBor) {
        console.warn(`[set_done] mavjud bo'lmagan chek rad etildi: ${chekId}`);
        return res.status(200).json({ ok: true, done: [] });
      }
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
  // 2026-08-03: egasiga xabar (SuperAdmin panelidan)
  // ⚠️ 2026-08-04 TUZATILDI: `action` o'zgaruvchisi bot.js da YO'Q.
  // Bu faylda amal `req.query?.action` orqali o'qiladi (yuqoridagi
  // `send_staff_notif` kabi). Men `auth-v2.js` naqshini ko'chirib
  // xato yozganman va butun bot yiqilgan:
  //     ReferenceError: action is not defined
  // Natijada /start, /mendokonlarim, hisobot ishlamay qolgan.
  if (req.query?.action === "send_owner_notif") {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ ok: false, error: "invalid_json" });
    }
    try {
      const result = await actionSendOwnerNotif(body);
      return res.status(200).json(result);
    } catch (e) {
      console.error("send_owner_notif xato:", e.message);
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
      // ⚠️ 2026-08-04: SUPERADMIN REJIM ALMASHTIRISHI.
      // Ikki rejim: barcha do'kon yig'indisi yoki bitta do'kon.
      // Tanlov `bot_sessions` da saqlanadi.
      if (cb.data === "sa_all" || cb.data?.startsWith("sa_shop:")) {
        if (!OWNER_ID || String(chatId) !== String(OWNER_ID)) {
          await tgAnswer(cb.id);
          return res.status(200).json({ ok: true });
        }
        const pick = cb.data === "sa_all" ? null : cb.data.slice(8);
        let nom = "Barcha do'konlar";
        if (pick) {
          const sh = await sb("shops", `?id=eq.${pick}&select=name&limit=1`);
          nom = sh?.[0]?.name || pick;
        }
        try {
          await fetch(`${SB_URL}/rest/v1/bot_sessions?on_conflict=chat_id`, {
            method: "POST",
            headers: {
              apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
              "Content-Type": "application/json", Prefer: "resolution=merge-duplicates"
            },
            body: JSON.stringify({ chat_id: String(chatId), shop_id: pick,
                                   shop_name: nom, is_owner: true })
          });
        } catch (e) { console.warn("sa rejim saqlanmadi:", e.message); }

        _shopCache.delete(String(chatId));   // kesh eskirmasin
        await tgAnswer(cb.id);
        await tg(chatId, pick
          ? `🏪 <b>${nom}</b> tanlandi.\n\nEndi hisobotlar SHU do'kon bo'yicha chiqadi.\n/mendokonlarim — rejimni o'zgartirish`
          : "📊 <b>Barcha do'konlar</b> rejimi.\n\nHisobotlar yig'indi bo'lib chiqadi.\n/mendokonlarim — rejimni o'zgartirish");
        return res.status(200).json({ ok: true });
      }

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

  // ── Bot guruhga QO'SHILDI (2026-07-30) ────────────────────────
  // Telegram bot a'zoligi o'zgarganda `my_chat_member` yuboradi. Bu
  // yangilanish turi standart sozlamada ham keladi — webhook'ni qayta
  // sozlash SHART EMAS.
  if (update.my_chat_member) {
    try {
      const _mcm    = update.my_chat_member;
      const _chat   = _mcm.chat || {};
      const _status = _mcm.new_chat_member?.status;
      const _isGrp  = _chat.type === "group" || _chat.type === "supergroup";
      if (_isGrp && (_status === "member" || _status === "administrator") && _helloOnce(_chat.id)) {
        await sendGroupIdCard(_chat.id, true);
      }
    } catch(e) { console.warn("my_chat_member xato:", e.message); }
    return res.status(200).json({ ok: true });
  }

  const msg    = update.message;
  if (!msg) return res.status(200).json({ ok: true });

  const chatId = msg.chat?.id;
  const text   = (msg.text || "").trim();
  if (!chatId) return res.status(200).json({ ok: true });

  // Zaxira yo'l: my_chat_member kelmasa xizmat xabaridan bilamiz
  if (Array.isArray(msg.new_chat_members) && _BOT_ID &&
      msg.new_chat_members.some(u => String(u.id) === _BOT_ID)) {
    if (_helloOnce(chatId)) { try { await sendGroupIdCard(chatId, true); } catch(e) {} }
    return res.status(200).json({ ok: true });
  }

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

  // /id — chat ID sini ko'rsatadi. Bot ALLAQACHON qo'shilgan guruhlar
  // uchun kerak: ularda "qo'shildi" xabari o'tib ketgan bo'ladi.
  if (cmd === "/id") {
    const _t = msg.chat?.type;
    if (_t === "group" || _t === "supergroup") await sendGroupIdCard(chatId, false);
    else await tg(chatId, "🆔 Sizning chat ID: <code>" + chatId + "</code>");
    return res.status(200).json({ ok: true });
  }

  // /mendokonlarim — egasi tekshiruvisiz, hamma uchun ochiq
  if (cmd === "/mendokonlarim") {
    await cmdMenDokonlarim(chatId);
    return res.status(200).json({ ok: true });
  }

  // /egaqoshish <ID> — SHERIK-EGANI QO'SHISH (2026-08-09, C-6 davomi).
  // Havola faqat BIRINCHI egaga ishlaydi; keyingi sheriklarni mavjud
  // ega O'ZI shu buyruq bilan qo'shadi — administrator kerak emas.
  if (cmd === "/egaqoshish") {
    await cmdEgaQoshish(chatId, (text.split(" ")[1] || "").trim());
    return res.status(200).json({ ok: true });
  }

  // ── GURUHDA JIM TURISH (2026-07-31) ──────────────────────────
  // Avval bot GURUHDAGI har xabarga "⛔ Bu komanda faqat do'kon
  // egasi uchun" deb javob qaytarardi. Xodimlar o'zaro yozganda
  // ham chiqaverib, ombor guruhini to'ldirardi.
  // Endi guruhda bot FAQAT o'ziga qaratilgan buyruqqa javob beradi
  // (/id, /start, /mendokonlarim — ular yuqorida hal qilinadi).
  // Qolgan hamma narsaga JIM turadi.
  const _chatType = msg.chat?.type;
  const _inGroup  = _chatType === "group" || _chatType === "supergroup";
  if (_inGroup) return res.status(200).json({ ok: true });

  // Shop egasi tekshiruvi (faqat shaxsiy chatda)
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
    case "/tizim":          await cmdTizim(chatId);          break;
    case "/help":           await cmdHelp(chatId);           break;
    default:
      if (text.startsWith("/")) {
        await tg(chatId, `❓ Noma'lum komanda: ${cmd}\n\n/help — komandalar ro'yxati`);
      }
  }

  return res.status(200).json({ ok: true });
}

// ── buildReceiptMerx (utils.js dan ko'chirildi) ──
// ⚠️ 2026-08-15: ESKI `buildReceiptMerx` OLIB TASHLANDI — endi u
// ilovadan ko'chirilgan yangi nusxa bilan almashtirildi (fayl oxirida).
// Ikkita bir xil nomli funksiya turgani xavfli edi: JavaScript
// oxirgisini oladi, lekin o'qiyotgan odam birinchisini ko'radi.

function _tasdiqBelgisi() { return ""; }   // botda kerak emas

function debtLines(sale, opts) {
  const o = opts || {};
  const F = o.F || (n => Math.round(Number(n) || 0).toLocaleString("ru-RU"));
  const rate = Number(o.rate) || Number(sale.rate) ||
               0 || 0;

  const isUsd   = sale.debtCurrency === "usd" && Number(sale.debtUsd) > 0;
  const qoldiq  = Number(sale.remaining) || 0;          // shu xaridda qo'shilgan (so'm)
  const debtUsd = Number(sale.debtUsd)   || 0;          // shu xaridda qo'shilgan ($)
  const pUsd    = Number(sale.prevDebtUsd) || 0;        // oldingi $ qarz
  const pUzs    = Number(sale.prevDebtUzs) || 0;        // oldingi so'm qarz

  // ── OLDINGI QARZ: nol bo'lmaganlari ──
  const oldinQ = [];
  if (pUzs > 0) oldinQ.push(F(pUzs) + " so'm");
  if (pUsd > 0) oldinQ.push("$" + pUsd.toFixed(2));

  // ── QO'SHILDI: faqat shu xarid ──
  let qoshildi = "";
  if (qoldiq > 0) {
    qoshildi = isUsd
      ? (rate > 0 ? F(qoldiq) + " / " + F(rate) + " = $" + debtUsd.toFixed(2)
                  : "$" + debtUsd.toFixed(2))
      : F(qoldiq) + " so'm";
  }

  // ── KEYINGI QARZ: qo'shilgan valyuta yig'iladi, ikkinchisi o'zgarmaydi ──
  const keyinQ = [];
  const yUzs = pUzs + (isUsd ? 0 : qoldiq);
  const yUsd = pUsd + (isUsd ? debtUsd : 0);
  if (yUzs > 0) keyinQ.push(F(yUzs) + " so'm");
  if (yUsd > 0) keyinQ.push("$" + yUsd.toFixed(2));

  return {
    oldin:    oldinQ.join(" + "),
    qoshildi: qoshildi,
    keyin:    keyinQ.join(" + "),
    bor:      (oldinQ.length > 0 || keyinQ.length > 0)
  };
}


// \u2550\u2550\u2550 SOZLAMALARNI USLUBLARGA YETKAZISH (2026-08-14) \u2550\u2550\u2550\u2550\u2550
// Muammo (egasining kuzatuvi): blok o'lchamlari, shrift, sarlavha foni
// va ikki-valyuta ko'rsatkichi FAQAT "Yagona" chekka ta'sir qilardi \u2014
// qolgan to'rt uslub ularni umuman O'QIMASDI (audit bilan tasdiqlandi).
// Bu funksiya har uslub uchun CSS ishlab beradi va uni chizuvchining
// <style> blokiga qo'shish kifoya.
//
// `sel` \u2014 uslubning sinf xaritasi: qaysi blok qaysi CSS selektorga.
// `sel._noAlign` — tekislash qo'llanmasin (Termal uchun: u BITTA matn
// bloki, shuning uchun bitta blokka "markaz" qo'yilsa BUTUN chek
// markazlashib qolardi — egasining shikoyati, 15-avgust).

function chekRows(sale, cfg, F) {
  const _f0 = F || (n => Math.round(Number(n) || 0).toLocaleString("ru-RU"));
  // \u2705 2026-08-14: IKKI VALYUTA \u2014 barcha uslublarda (egasining talabi).
  // Avval faqat "Yagona" chekda ishlardi. Yoqilgan bo'lsa har summa
  // "540 000 / $43.20" ko'rinishida chiqadi.
  const _rt = Number((cfg && cfg.rate)) ||
              0 || 0;
  const _dual = (cfg && cfg.dualCurrency !== false) && _rt > 0;
  const f = (n) => {
    const som = Math.round(Number(n) || 0);
    const t = _f0(som);
    if (!_dual) return t;
    return t + " / $" + (som / _rt).toFixed(2);
  };
  const c = cfg || {};
  const items    = (sale.items || []).filter(Boolean);
  const total    = Number(sale.total || 0);
  const paid     = Number(sale.paid  || 0);
  const discount = Number(sale.discount || 0);
  const subtotal = Number(sale.subtotal || (total + discount));
  const rate     = Number(sale.rate) || Number(c.rate) ||
                   0 || 0;
  const PAY = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash" };

  // ── 1) META (chek boshi) ──
  const meta = [];
  meta.push(["Sotuv", sale.chekNum || ("#" + sale.id)]);
  if (c.shopName)                 meta.push(["Do'kon", c.shopName]);
  meta.push(["Sana", (sale.date || "") + (sale.time ? " " + sale.time : "")]);
  if (c.showStaff !== false && c.staffName && c.staffName !== "\u2014")
    meta.push(["Sotuvchi / Kassir", c.staffName]);
  if (c.showContact !== false && c.contact) meta.push(["Kontaktlar", c.contact]);
  if (sale.customerName)  meta.push(["Mijoz", sale.customerName]);
  if (sale.customerPhone) meta.push(["Mijoz raqami", sale.customerPhone]);

  // ── 2) YIG'INDI (tovarlardan keyin) ──
  const summary = [];
  let pochka = 0, dona = 0;
  items.forEach(it => {
    const q = Number(it.qty) || 0;
    if (it.sellMode === "karobka" || it.qtyBox) pochka += Number(it.qtyBox || q) || 0;
    dona += q;
  });
  if (pochka > 0) summary.push(["JAMI POCHKA", pochka + " pochka", "big"]);
  // ✅ 2026-08-15: IKKI XIL CHEGIRMA (egasining savoli):
  //   (a) TOVAR chegirmasi — savatda har tovarga alohida berilgan.
  //       `basePrice` da asl narx, `price` da pasaytirilgani turadi.
  //   (b) UMUMIY chegirma — `sale.discount` (butun chekka).
  // Avval faqat (b) ko'rsatilardi, (a) esa boshqa uslublarda umuman
  // yo'q edi — yagona chekdagidan farq qilardi.
  const _itemDisc = items.reduce((a, i) =>
    a + ((i.basePrice && i.basePrice > (i.price || 0))
         ? (i.basePrice - i.price) * (i.qty || 1) : 0), 0);
  const _bazaJami = items.reduce((a, i) =>
    a + ((i.basePrice || i.price || 0) * (i.qty || 0)), 0);

  if (_itemDisc > 0 || discount > 0) {
    summary.push(["Jami (chegirmasiz)",
                  f(_itemDisc > 0 ? _bazaJami : subtotal) + " so'm"]);
    if (_itemDisc > 0)
      summary.push(["Tovar chegirmalari", "\u2212" + f(_itemDisc) + " so'm", "disc"]);
    if (discount > 0)
      summary.push(["Umumiy chegirma", "\u2212" + f(discount) + " so'm", "disc"]);
  }
  summary.push(["JAMI", f(total) + " so'm",
                "total", items.length + " xil \u00b7 " + dona + " dona"]);

  // ── 3) TO'LOV ──
  const payment = [];
  if (sale.payType) payment.push(["To'lov turi", PAY[sale.payType] || sale.payType]);
  const pb = sale.payBreakdown || {};
  if (Number(pb.naqd)    > 0) payment.push(["Naqd pul", f(pb.naqd)    + " so'm"]);
  if (Number(pb.karta)   > 0) payment.push(["Karta",    f(pb.karta)   + " so'm"]);
  if (Number(pb.otkazma) > 0) payment.push(["O'tkazma", f(pb.otkazma) + " so'm"]);
  if (paid > 0) payment.push(["To'landi", f(paid) + " so'm", "ok"]);

  // ── 4) QARZ (yagona manba: debtLines) ──
  const debt = [];
  const _fn = (typeof globalThis !== "undefined" && globalThis.debtLines) ||
              (typeof debtLines === "function" ? debtLines : null);
  // \u26a0\ufe0f 2026-08-15: qarz satrlariga ODDIY formatchi beriladi (_f0),
  // ikki-valyutali EMAS. `debtLines` allaqachon "so'm / kurs = $"
  // ko'rinishida yozadi — ikki-valyutali formatchi berilsa ustiga yana
  // "/ $..." qo'shib yuborardi: "10 000 000 / $837.66 / 11 938 / $1.00"
  // (jonli: Jadval cheki, 15-avgust).
  const d = (c.showDebtHistory === false || !_fn) ? null : _fn(sale, { F: _f0, rate });
  if (d && d.oldin)    debt.push(["Xariddan oldingi qarz", d.oldin]);
  if (d && d.qoshildi) debt.push(["Qarzga qo'shildi",      d.qoshildi]);
  if (d && d.keyin)    debt.push(["Xariddan keyingi qarz", d.keyin, "debt"]);
  if (sale.due)        debt.push(["To'lov muddati", sale.due, "debt"]);

  // ── 5) ALTBILGI ──
  const footer = [];
  if (c.footer) footer.push(c.footer);
  (Array.isArray(c.extraLines) ? c.extraLines : []).forEach(t => { if (t) footer.push(t); });

  return { meta, summary, payment, debt, footer, pochka, dona };
}


// Qatorlarni HTML ga aylantirish \u2014 uslub o'z sinflarini beradi.
// `K` = {row, label, val, sep, big, total, disc, ok, debt, ft}
function chekRowsHtml(R, K) {
  const k = K || {};
  const row = (l, v, c, sub) =>
    `<div class="${k.row || "row"}${c ? " " + (k[c] || c) : ""}">` +
    `<span class="${k.label || ""}">${l}${sub ? `<br><small style="opacity:.6">${sub}</small>` : ""}</span>` +
    `<b class="${k.val || ""}">${v}</b></div>`;
  const sep = k.sep ? `<div class="${k.sep}"></div>` : "";
  const blok = (arr) => arr.map(x => row(x[0], x[1], x[2], x[3])).join("");
  return {
    meta:    blok(R.meta),
    summary: blok(R.summary),
    payment: R.payment.length ? sep + blok(R.payment) : "",
    debt:    R.debt.length    ? sep + blok(R.debt)    : "",
    footer:  R.footer.map((t, i) =>
      `<div class="${k.ft || "ft"}"${i ? ' style="font-size:11px;opacity:.8"' : ""}>${t}</div>`).join("")
  };
}


// \u2550\u2550\u2550 QAYTARISH OGOHLANTIRISHI \u2014 HAMMA USLUBGA (2026-08-15) \u2550\u2550
// Egasining kuzatuvi: qaytarish belgisi FAQAT "Yagona" chekda bor edi \u2014
// boshqa uslub tanlansa mijoz chekda qaytarilganini KO'RMASDI.
// Asl chek o'zgarmaydi (\u00a73.6), faqat pastiga qizil belgi qo'shiladi.

function chekStyleCss(cfg, sel) {
  try {
    if (!cfg) return "";
    const b = cfg.blocks || {};
    const out = [];

    // 1) SHRIFT OILASI (butun chek)
    const FAM = {
      dm:      "'DM Sans',system-ui,sans-serif",
      inter:   "Inter,system-ui,sans-serif",
      roboto:  "Roboto,system-ui,sans-serif",
      mono:    "'Courier New',monospace",
      serif:   "Georgia,'Times New Roman',serif"
    };
    // \U0001f534 2026-08-15: TERMALGA shrift QO'LLANMAYDI. U bo'shliqlar
    // bilan ikki tomonlama tekislanadi va faqat MONOSHRIFTDA to'g'ri
    // chiqadi. Avval "DM Sans" ga almashib, chek chapga yopishib
    // qolardi (egasining shikoyati, 15-avgust).
    if (cfg.fontFamily && FAM[cfg.fontFamily] && !(sel && sel._noAlign))
      out.push(`.doc,.wrap{font-family:${FAM[cfg.fontFamily]}}`);

    // 2) UMUMIY O'LCHAM (kichik / normal / katta)
    const SC = { kichik: 0.9, normal: 1, katta: 1.12 };
    const k = SC[cfg.fontScale] || 1;
    // Termalda o'lcham ham cheklangan — 40 belgi sig'masa tekislash buziladi
    if (k !== 1) out.push((sel && sel._noAlign)
      ? `.doc,.wrap{font-size:${(13 * k).toFixed(1)}px}`
      : `.doc,.wrap,.rc{font-size:${(13 * k).toFixed(1)}px}`);

    // 3) BLOK BO'YICHA: o'lcham, qalin, kursiv, tekislash, ko'rsatish
    for (const key in (sel || {})) {
      const cssSel = sel[key];
      const o = b[key];
      if (!cssSel || !o) continue;
      const d = [];
      if (o.size)   d.push(`font-size:${Number(o.size) * k}px`);
      if (o.bold)   d.push("font-weight:800");
      if (o.italic) d.push("font-style:italic");
      if (o.align && !(sel && sel._noAlign)) d.push(`text-align:${o.align}`);
      if (d.length) out.push(`${cssSel}{${d.join(";")} !important}`);
      if (o.show === false) out.push(`${cssSel}{display:none !important}`);
    }

    // 4) SARLAVHA FONI (och / to'q)
    if (cfg.headerStyle === "light")
      out.push(".hd{background:#fff !important;color:#000 !important}" +
               ".hd *{color:#000 !important}");
    else if (cfg.headerStyle === "dark")
      out.push(".hd{background:#0D1B2A !important;color:#fff !important}" +
               ".hd *{color:#fff !important}");

    return out.join("\n");
  } catch (e) { return ""; }
}

// Chek pastidagi qo'shimcha qatorlar (reklama, ish vaqti) \u2014 hamma uslubga
// ═══ ✅ QP-1 (2026-08-26): QAYTARISH PUL XULOSASI — yagona yig'uvchi ═══
// Qizil eslatma uchun refundNo bo'yicha MAVJUD yozuvlar o'qiladi:
// QTQ to'lovlari (qarzdan qoplangan qism + o'sha paytdagi jami qarz)
// va "Tovar qaytarish" xarajati (kassadan qaytarilgan qism).
// FAQAT O'QIYDI — pul mantiqiga tegmaydi; xato → null (eslatma
// avvalgidek chiqadi). Egizak: utils.js ↔ bot.js (C8) — BIR XIL.
function _refundPulYig(refs, pays, xars) {
  try {
    const nos = new Set((refs || []).map(r => r && r.no).filter(Boolean));
    if (!nos.size) return null;
    let bU=null,bD=null,aU=null,aD=null,qU=0,qD=0,somU=0,kSum=0,kMet="";
    let qRate=0, qRateBir=true;
    const mx=(o,v)=>(o==null?v:Math.max(o,v)), mn=(o,v)=>(o==null?v:Math.min(o,v));
    (pays || []).forEach(p => {
      const d = p && (p.data || p);
      if (!d || d.source !== "refund" || !nos.has(d.refundNo)) return;
      const cur = d.currency || p.currency || "uzs";
      const am  = Number(d.amount != null ? d.amount : p.amount) || 0;
      // ✅ QP-2: yangi yozuvlarda IKKALA valyuta muhri bor — ustuvor;
      // eski yozuvlarda faqat o'z valyutasi (halol: borini ko'rsatamiz).
      const bfU=Number(d.debtBeforeUzs), bfD=Number(d.debtBeforeUsd);
      const afU=Number(d.debtAfterUzs),  afD=Number(d.debtAfterUsd);
      if (!isNaN(bfU) || !isNaN(bfD)) {
        if (!isNaN(bfU)) bU=mx(bU,bfU);  if (!isNaN(bfD)) bD=mx(bD,bfD);
        if (!isNaN(afU)) aU=mn(aU,afU);  if (!isNaN(afD)) aD=mn(aD,afD);
      } else {
        const bf=Number(d.debtBefore), af=Number(d.debtAfter);
        if (cur === "usd") { if(!isNaN(bf)) bD=mx(bD,bf); if(!isNaN(af)) aD=mn(aD,af); }
        else               { if(!isNaN(bf)) bU=mx(bU,bf); if(!isNaN(af)) aU=mn(aU,af); }
      }
      if (cur === "usd") {
        qD += am; somU += Number(d.amountSom) || 0;
        const r = Number(d.rate) || 0;
        if (r > 0) { if (qRate > 0 && Math.abs(qRate - r) > 1) qRateBir = false; qRate = r; }
      } else qU += am;
    });
    (xars || []).forEach(x => {
      const d = x && (x.data || x);
      if (!d || !nos.has(d.refundNo)) return;
      kSum += Number(x.amount != null ? x.amount : d.amount) || 0;
      if (!kMet) kMet = ((x.method || d.method) === "karta") ? "Karta" : "Naqd";
    });
    if (!qRateBir) qRate = 0;   // kurslar har xil — bo'lish ko'rsatilmaydi
    if (qU<=0 && qD<=0 && kSum<=0) return null;
    return { bU,bD,aU,aD,qU,qD,somU,qRate,kSum,kMet };
  } catch (e) { return null; }
}
// Xulosani [nom, qiymat] satrlarga aylantiradi — hamma chizuvchi
// (HTML, termal, Telegram matni) BIR XIL satrlarni ishlatadi.
function _refundPulSatrlar(pl, f) {
  const S = [];
  if (!pl) return S;
  const iq = (u, d) => { const p=[]; const _d=Number(d)||0, _u=Number(u)||0;
    if (_d>0) p.push("$"+_d.toFixed(2)); if (_u>0) p.push(f(_u)+" so'm");
    return p.length ? p.join(" + ") : "0"; };
  if (pl.bU!=null || pl.bD!=null) S.push(["Qaytarishdan oldingi qarz", iq(pl.bU,pl.bD)]);
  if (pl.qU>0 || pl.qD>0) {
    // ✅ QP-2: sotuv chekidagi uslub — "12 000 000 / 11 779 = $1018.76".
    // Kurs — QTQ yozuvidagi qotgan kurs; har xil bo'lsa bo'lish yozilmaydi.
    let v;
    if (pl.qD > 0) {
      v = (pl.somU > 0
            ? f(pl.somU) + (pl.qRate > 0 ? " / " + f(pl.qRate) : "") + " = "
            : "") + "$" + pl.qD.toFixed(2);
      if (pl.qU > 0) v += " + " + f(pl.qU) + " so'm";
    } else v = f(pl.qU) + " so'm";
    S.push(["Qarzdan qoplandi", v]);
  }
  if (pl.aU!=null || pl.aD!=null) {
    const v = iq(pl.aU,pl.aD);
    S.push(["Qaytarishdan keyingi qarz", v === "0" ? "0 — qarz yo'q" : v]);
  }
  if (pl.kSum>0) S.push(["Kassadan qaytarildi ("+(pl.kMet||"Naqd")+")", f(pl.kSum)+" so'm"]);
  return S;
}

function chekRefundNote(sale, F, matnli) {
  try {
    const refs = (sale && sale.refunds) || [];
    if (!refs.length) return "";
    const f = F || (n => Math.round(Number(n) || 0).toLocaleString("ru-RU"));
    const tot  = sale.refundedTotal || refs.reduce((a, r) => a + (r.total || 0), 0);
    const full = sale.status === "qaytarilgan";
    const nos  = refs.map(r => r.no).filter(Boolean).join(", ");
    const bosh = full ? "TO'LIQ QAYTARILGAN" : "QISMAN QAYTARILGAN";
    // ✅ QP-1: pul xulosasi — botda oldindan yuklangan (sale._refPul),
    // kassada lokal bazadan yig'iladi. Topilmasa — satrlar shunchaki yo'q.
    const _pl = (sale && sale._refPul) ||
      ((typeof db !== "undefined" && db)
        ? _refundPulYig(refs, db.debtPayments, db.xarajatlar) : null);
    const pulSatr = _refundPulSatrlar(_pl, f);
    if (matnli) {
      // Termal (matnli chek) uchun
      const out = ["", "=".repeat(40), "  " + bosh,
                   "  Qaytarilgan: " + f(tot) + " so'm"];
      if (nos) out.push("  Qaytarish cheki: " + nos);
      pulSatr.forEach(([k, v]) => out.push("  " + k + ": " + v));   // ✅ QP-1
      refs.forEach(r => (r.items || []).forEach(it => {
        if (!it) return;
        const q = Number(it.qty) || 0;
        const _r = it.color || it.variant || "";
        // ✅ 2026-08-16 (egasining talabi): pochka ham — "2 pochka (10 dona)"
        const _qb = Number(it.qtyBox) || 0;
        const _bl = it.unit || "dona";
        const _mk = q ? (_qb > 0 ? _qb + " pochka (" + q + " " + _bl + ")" : q + " " + _bl) : "";
        out.push("  • " + (it.name || "") + (_r ? " " + _r : "") +
                 (it.art ? " " + it.art : "") + (_mk ? " — " + _mk : ""));
      }));
      out.push("=".repeat(40));
      return out.join("\n");
    }
    // ✅ 2026-08-15: QAYSI TOVARLAR qaytgani ham yoziladi (egasining
    // talabi — avval faqat summa va chek raqami bor edi).
    // ✅ 2026-08-15: NOM · RANG · ART — eski yozuvlarda rang `variant`
    // maydonida saqlangan, shuning uchun ikkalasi ham tekshiriladi.
    const tovarlar = [];
    refs.forEach(r => (r.items || []).forEach(it => {
      if (!it) return;
      const q    = Number(it.qty) || 0;
      const rang = it.color || it.variant || "";
      const art  = it.art || "";
      // ✅ 2026-08-16 (egasining talabi): pochka ham — "2 pochka (10 dona)"
      const qb   = Number(it.qtyBox) || 0;
      const bl   = it.unit || "dona";
      const mk   = q ? (qb > 0 ? qb + " pochka (" + q + " " + bl + ")" : q + " " + bl) : "";
      tovarlar.push((it.name || "") +
        (rang ? " · " + rang : "") +
        (art  ? " · " + art  : "") +
        (mk ? " — " + mk : ""));
    }));
    return `<div style="margin:8px 0 0;padding:8px 10px;border:1px dashed #B91C1C;
        border-radius:6px;background:#FEF2F2">
        <div style="font-size:11.5px;font-weight:800;color:#B91C1C">${bosh}</div>
        <div style="font-size:11px;color:#000;margin-top:2px">
          Qaytarilgan summa: <b>${f(tot)} so'm</b>
          ${nos ? `<br>Qaytarish cheki: <b>${nos}</b>` : ""}
          ${pulSatr.map(([k, v]) => `<br>${k}: <b>${v}</b>`).join("")}
        </div>
        ${tovarlar.length ? `<div style="font-size:10.5px;color:#000;margin-top:4px;
          border-top:1px dotted #B91C1C;padding-top:4px">
          ${tovarlar.map(t => "• " + t).join("<br>")}</div>` : ""}
      </div>`;
  } catch (e) { return ""; }
}


// \u2550\u2550\u2550 BOT CHEKI \u2014 SOTUV CHEKI BILAN PARALLEL (2026-08-15) \u2550\u2550
// Egasining talabi: botdagi chek sotuv cheki bilan BIR XIL bo'lsin \u2014
// qaysi uslub tanlangan bo'lsa, uning BO'LIMLARI va TARTIBI botga ham
// o'tsin. Telegram HTML qabul qiladi (CSS emas), shuning uchun ko'rinish
// emas, MAZMUN va TARTIB birlashtiriladi \u2014 manba bitta: chekRows().

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
  const _dMapM = (typeof chekItemDisc === "function") ? chekItemDisc(sale) : {};
  const itemsHtml = items.map((it, idx) => {
    const isBox  = it.sellMode === "karobka" && it.qtyBox;
    const art    = it.art ? `<span class="it-art">${it.art}</span>` : "";
    // ✅ 2026-08-15: chegirma taqsimlangan narx (yagona chekdagi kabi)
    const _pShow  = (typeof chekItemPrice === "function")
      ? chekItemPrice(sale, idx, it, _dMapM) : (it.price||0);
    const sum     = _pShow*(it.qty||0);
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
    // ✅ 2026-08-15: CHEGIRMA ko'rinadi — asl narx chizib beriladi
    // (Ulgurji/Jadvaldagi kabi). Avval `pricePer` chegirmasiz edi.
    const _bM = (typeof chekItemBase === "function")
      ? chekItemBase(sale, idx, it, _dMapM) : null;
    const _narxM = (_bM && _bM > _pShow)
      ? `<s style="color:#666">${F(_bM)}</s> ${F(_pShow)}`
      : F(_pShow);
    const calcStr = `${F(qtyShow)} ${unitShow} × ${_narxM} = ${F(sum)}${pchkNote}`;
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
    payHtml = `<div class="pr"><span>${payLabels[payType]||payType}</span><span style="color:#000;font-weight:700">${F(paid)} so'm</span></div>`;
  }

  // Qarz bo'limi
  let debtHtml = "";
  if (remaining > 0) {
    const newDebtAmt = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${F(remaining)} so'm`;
    debtHtml += `<div class="sep-dash" style="margin:6px 0"></div>`;
    // \u2705 2026-08-14: IKKALA VALYUTA \u2014 yagona manba (debtLines).
    // Avval faqat dollar qarzi ko'rsatilardi, so'm qarzi tushib qolardi.
    let _dM = (typeof debtLines === "function") ? debtLines(sale, { F }) : null;
  // ✅ 2026-08-14: "Qarz tarixi" belgilagichi hamma uslubga ta'sir qiladi
  if (cfg && cfg.showDebtHistory === false) _dM = null;
    if (_dM && (_dM.oldin || _dM.keyin)) {
      if (_dM.oldin)
        debtHtml += `<div class="pr pr-sm"><span>Oldingi qarz</span><span>${_dM.oldin}</span></div>`;
      if (_dM.qoshildi)
        debtHtml += `<div class="pr pr-sm"><span>Qarzga qo'shildi</span><span>${_dM.qoshildi}</span></div>`;
      if (_dM.keyin)
        debtHtml += `<div class="pr pr-debt-total"><span>JAMI QARZ</span><span>${_dM.keyin}</span></div>`;

    } else {
      debtHtml += `<div class="pr pr-debt"><span>QARZ</span><span>${newDebtAmt}</span></div>`;
    }
    if (due) debtHtml += `<div class="pr pr-sm"><span>Muddat</span><span style="color:#000;font-weight:700">${due}</span></div>`;
  } else {
    debtHtml = `<div class="paid-ok">✓ To'liq to'landi</div>`;
  }

  // ✅ 2026-08-14: chegirmasiz jami — yagona chekdagi kabi
  const discHtml = discount > 0
    ? `<div class="pr pr-sm"><span>Jami (chegirmasiz)</span><span>${F(subtotal)} so'm</span></div>` +
      `<div class="pr" style="color:#000"><span>Chegirma${sale.discountPct ? " -"+sale.discountPct+"%" : ""}</span><span>−${F(discount)} so'm</span></div>` : "";

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
.hd{${cfg.headerStyle === "dark" ? "background:#0D1B2A;color:#fff" : "background:#fff;color:#000;border-bottom:2px solid #000"};padding:14px 18px;text-align:center}
.hd-name{font-family:'Sora',sans-serif;font-size:18px;font-weight:800;letter-spacing:1.5px}
.hd-meta{font-size:12px;color:#b8c5d0;margin-top:4px;line-height:1.6;font-weight:500}
.hd-meta b{color:#E9A500}
.badge-ulgurji{display:inline-block;background:#E9A500;color:#0D1B2A;font-size:9px;font-weight:800;padding:1px 7px;border-radius:8px;letter-spacing:.5px;margin-top:3px}
.cust{padding:7px 16px;background:#F0F8FF;border-bottom:1px dashed #C7E3F5;font-size:12px;color:#0D1B2A;display:flex;justify-content:space-between}
.note-w{padding:6px 16px;background:#FFFBEB;border-bottom:1px dashed #FDE68A;font-size:11.5px;color:#000}
.items-lbl{padding:8px 16px 4px;font-size:10px;font-weight:800;color:#555;letter-spacing:1.5px;text-transform:uppercase}
.items{padding:0 16px}
.it{padding:7px 0;border-bottom:1px dashed #E8E5E0}
.it:last-child{border-bottom:none}
.it-top{display:flex;align-items:baseline;gap:6px}
.it-num{font-size:10px;color:#555;font-weight:700;min-width:14px}
.it-name{flex:1;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#0D1B2A}
.it-art{font-family:'DM Sans',sans-serif;font-size:10px;color:#000;background:#EEF2FF;padding:1px 6px;border-radius:4px;font-weight:600;margin-left:4px;vertical-align:middle}
.it-sum{font-family:'Sora',sans-serif;font-size:13px;font-weight:800;color:#0D1B2A;white-space:nowrap}
.it-info{font-size:12px;color:#333;margin-top:3px;padding-left:20px;font-weight:500}
.it-color{color:#333;font-weight:600;margin-right:8px}.it-calc{color:#111;font-weight:700}
.tot{margin:0 16px;padding:8px 0;border-top:2px solid #0D1B2A;display:flex;justify-content:space-between;align-items:center}
.tot-l{font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:#0D1B2A}
.tot-cnt{font-size:11px;color:#555;font-weight:600;margin-top:1px}
.tot-v{font-family:'Sora',sans-serif;font-size:20px;font-weight:800;color:#0D1B2A}
.pay{padding:8px 16px 10px;border-top:1px dashed #ddd}
.pay-lbl{font-size:10px;font-weight:800;color:#333;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.pr{display:flex;justify-content:space-between;font-size:13px;color:#000;padding:3px 0;font-weight:500}
.pr.pr-sm{font-size:12px;color:#555;font-weight:600}
.pr.pr-debt{color:#000;font-weight:800;font-size:14px;border-top:1px solid #fca5a5;padding-top:6px;margin-top:2px}
.pr.pr-debt-total{color:#000;font-weight:800;font-size:16px;border-top:2px solid #dc2626;padding-top:8px;margin-top:4px}
.sep-dash{border-top:1px dashed #ddd}
.paid-ok{background:#ECFDF5;color:#000;font-weight:700;font-size:12px;text-align:center;padding:7px;border-radius:8px;margin-top:4px}
.ft{padding:10px 16px 14px;text-align:center;border-top:1px dashed #ddd}
.ft-txt{font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:#0D1B2A}
.ft-sub{font-size:11px;color:#444;margin-top:3px}
.ft-bot{font-size:11px;color:#000;margin-top:6px}
.acts{width:340px;max-width:100%;margin:10px 0 0;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:10px;padding:11px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#0D1B2A;color:#fff}.btn-c{background:#fff;color:#0D1B2A;border:1.5px solid #E8E5E0}
@media print{
  body{background:#fff;padding:0}
  .wrap,.rc{width:${cfg.paperWidth || 72}mm;max-width:${cfg.paperWidth || 72}mm;border-radius:0;box-shadow:none}
  .acts{display:none}
  .hd,.hd-meta b{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pr.pr-debt,.pr.pr-debt-total{color:#000!important}
}

  ${typeof chekPrintFix === "function" ? chekPrintFix(cfg && cfg.paperWidth) : ""}
  ${typeof chekStyleCss === "function" ? chekStyleCss(cfg, {shop:".hd-name",tagline:".hd-meta",meta:".cust",
      itemName:".it-name",itemPrice:".it-calc,.it-sum",total:".tot-v,.tot",
      debt:".pr-debt,.pr-debt-total,.pr",footer:".ft"}) : ""}
  </style></head><body>
<div class="wrap">
  ${_tasdiqBelgisi(sale, opts && opts.type)}
  <div class="rc">

    ${logoHtml}
    <div class="hd">
      <div class="hd-name">${shopName.toUpperCase()}</div>
      ${cfg.tagline ? `<div class="hd-meta tagline" style="margin-top:2px">${cfg.tagline}</div>` : ""}
      ${cfg.addr ? `<div class="hd-meta addr" style="margin-top:1px">${cfg.addr}</div>` : ""}
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

    ${(() => {
    // \u2705 2026-08-14: BO'LIMLAR YAGONA TARTIBDA (chekRows) \u2014
    // yig'indi \u2192 to'lov \u2192 qarz. Tovarlar qismi yuqorida, o'z uslubida.
    try {
      const _R = chekRows(sale, cfg, F);
      const _H = chekRowsHtml(_R, { row:"pr", sep:"sep-dash", ft:"ft",
                                    big:"pr-sm", total:"pr-debt-total", debt:"pr-debt" });
      return `<div class="tot"><div><div class="tot-l">JAMI</div>` +
             `<div class="tot-cnt">${items.length} xil \u00b7 ${totalBoxes ? totalBoxes + " pochka" : totalDona + " dona"}</div></div>` +
             `<div class="tot-v">${F(total)} <span style="font-size:13px;font-weight:600">so'm</span></div></div>` +
             `<div class="pay"><div class="pay-lbl">To'lov</div>` +
             _H.summary + _H.payment + _H.debt +
             (typeof chekRefundNote === "function" ? chekRefundNote(sale, F) : "");
    } catch (e) { return ""; }
  })()}
    </div>

    <div class="ft">
      <div class="ft-txt">${footer || "Rahmat! Yana kutamiz 🙏"}</div>
    ${(() => { try {
      const _R = chekRows(sale, cfg, F);
      // ✅ 2026-08-14: qo'shimcha matn qatorlari (reklama, ish vaqti)
      return _R.footer.slice(1).map(t =>
        `<div class="ft-sub" style="font-size:11px;opacity:.8">${t}</div>`).join("");
    } catch (e) { return ""; } })()}
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


// ════════════════════════════════════════════════
// №9 (v152): QIDIRUV QATORLARI — YAGONA UX
// Har qidiruvda ✕ (bir bosishda tozalash), POS'dagidek qulay o'lcham,
// sahifadan chiqilganda avtomatik tozalanish (nav ichidagi guard bilan).
// pos-q va tarix-q allaqachon o'z ✕ tugmasiga ega — ular faqat
// avto-tozalash ro'yxatida.
// ════════════════════════════════════════════════
const _SEARCH_UX = [
  { id: "kat-q",   render: () => { if (typeof renderKatalog === "function") renderKatalog(); } },
  { id: "om-q",    render: () => { if (typeof omSearch === "function") omSearch(); } },
  { id: "cust-q",  render: () => { if (typeof renderMijozlar === "function") renderMijozlar(); } },
  { id: "debt-q",  render: () => { if (typeof renderDebts === "function") renderDebts(); } },
  { id: "qt-q",    render: () => { if (typeof renderQarzlarTarixi === "function") renderQarzlarTarixi(); } },
  { id: "exp-q",   render: () => { if (typeof renderMoliya === "function") renderMoliya(); } },
];
const _SEARCH_PRE = [ // o'z ✕ tugmasi bor maydonlar: [input, tugma, render]
  { id: "pos-q",   btn: "pos-q-clr",   render: () => { if (typeof posSearch === "function") posSearch(); } },
  { id: "tarix-q", btn: "tarix-q-clr", render: () => { if (typeof renderTarix === "function") renderTarix(); } },
];
function buildReceiptThermal(sale, opts, cfg) {
  const {shopName, staffName, botUser, contact, footer, showStaff, showContact, F} = cfg;
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
  const debtUsd  = Number(sale.debtUsd  || 0);
  const prevUsd  = Number(sale.prevDebtUsd || 0);
  const prevUzs  = Number(sale.prevDebtUzs || 0);
  const note     = sale.note || "";
  const due      = sale.due  || "";
  const priceType= sale.priceType || "";
  const payLabels= {naqd:"Naqd", karta:"Karta", otkazma:"Otkazma", aralash:"Aralash"};
  const W = 40;
  const EQ = "=".repeat(W);
  const DA = "-".repeat(W);

  const totalBoxes = items.reduce((a,i) => a+(i.qtyBox||0), 0);
  const totalDona  = items.reduce((a,i) => a+(i.qty||0), 0);

  // Chiziqni markazga
  const center = (s) => {
    const sp = Math.max(0, W - s.length);
    return " ".repeat(Math.floor(sp/2)) + s;
  };
  // Ikki ustun
  const lr = (l, r) => {
    const lStr = String(l), rStr = String(r);
    const gap = Math.max(1, W - lStr.length - rStr.length);
    return lStr + " ".repeat(gap) + rStr;
  };

  // TOVARLAR — 2 qator
  // Qator 1: N. Nom [ART]
  // Qator 2:   Rang  Qty x Narx = Summa
  // ✅ 2026-08-15: chegirma hisobga olinadi (boshqa uslublardagi kabi)
  const _dMapT = (typeof chekItemDisc === "function") ? chekItemDisc(sale) : {};
  const itemLines = items.map((it, i) => {
    const isBox   = it.sellMode === "karobka" && it.qtyBox;
    const qty     = it.qty || 0;  // jami dona soni
    const unit    = it.unit || "dona";
    const price   = it.price || 0;  // 1 dona narxi
    const sum     = price * qty;
    const art     = it.art ? ` [${it.art}]` : "";
    const color   = it.color || "";
    // Pochka bo'lsa: "(3 pchk)" ko'rsatamiz
    const pchkStr = isBox && it.qtyBox ? ` (${it.qtyBox} pchk)` : "";

    const row1 = `${i+1}. ${it.name}${art}${pchkStr}`;
    // Chegirmali narx; asl narx qavsda (matnli chekda chizish yo'q)
    const _pT   = (typeof chekItemPrice === "function")
      ? Math.round(chekItemPrice(sale, i, it, _dMapT)) : price;
    const _bT   = (typeof chekItemBase === "function")
      ? chekItemBase(sale, i, it, _dMapT) : null;
    const _aslT = (_bT && _bT > _pT) ? ` (asl ${F(_bT)})` : "";
    const calc  = `${color ? color+"  " : ""}${F(qty)}${unit} x ${F(_pT)}${_aslT} = ${F(_pT * qty)}`;
    return row1 + "\n   " + calc;
  }).join("\n" + DA + "\n");

  // TO'LOV
  const payLines = () => {
    const lbls = {naqd:"Naqd", karta:"Karta", otkazma:"Otkazma"};
    if (payType === "aralash" && payBreakdown) {
      return Object.entries(payBreakdown)
        .filter(([m,v]) => m !== "qarz" && v > 0)
        .map(([m,v]) => lr(lbls[m]||m+":", F(v)+" som"))
        .join("\n");
    }
    if (payType !== "qarz") return lr((payLabels[payType]||payType)+":", F(paid)+" som");
    return "";
  };

  // QARZ
  const debtLines = () => {
    if (remaining <= 0) return lr("TO'LIQ TO'LANDI", "✓");
    const dAmt = isUsd ? `$${debtUsd.toFixed(2)} USD` : `${F(remaining)} som`;
    const lines = [lr("QARZ:", dAmt)];
    // \u2705 2026-08-14: IKKALA VALYUTA \u2014 yagona manba (debtLines)
    // ⚠️ Termal ichida `debtLines` nomli MAHALLIY funksiya bor —
    // global yagona manbani `window` orqali chaqiramiz (aks holda
    // o'zini-o'zi chaqirib cheksiz halqaga tushardi).
    const _fn = (typeof window !== "undefined" && window.debtLines) ||
                (typeof globalThis !== "undefined" && globalThis.debtLines);
    let _dT = (typeof _fn === "function") ? _fn(sale, { F }) : null;
  // ✅ 2026-08-14: "Qarz tarixi" belgilagichi hamma uslubga ta'sir qiladi
  if (cfg && cfg.showDebtHistory === false) _dT = null;
    if (_dT && (_dT.oldin || _dT.keyin)) {
      if (_dT.oldin)    lines.push(lr("  Oldingi qarz:", _dT.oldin));
      if (_dT.qoshildi) lines.push(lr("  Qarzga qo'shildi:", _dT.qoshildi));
      if (_dT.keyin)    lines.push(lr("  JAMI QARZ:", _dT.keyin));

    }
    if (due) lines.push(lr("  Muddat:", due));
    return lines.join("\n");
  };

  const rows = [
    EQ,
    center(shopName.toUpperCase()),
    // ✅ 2026-08-14: shior va manzil — yagona chekdagi kabi
    cfg.tagline ? center(cfg.tagline) : null,
    cfg.addr    ? center(cfg.addr)    : null,
    showContact && contact ? center(contact) : null,
    priceType === "ulgurji" ? center("[ ULGURJI SAVDO ]") : null,
    EQ,
    lr("Chek: " + chekNum, date + " " + time),
    showStaff && staffName && staffName !== "—" ? ("Kassir: " + staffName) : null,
    sale.customerName ? ("Mijoz: " + sale.customerName) : null,
    sale.customerPhone ? ("Tel:   " + sale.customerPhone) : null,
    DA,
    itemLines,
    // \u2705 2026-08-14: BO'LIMLAR YAGONA TARTIBDA (chekRows) \u2014
    // yig'indi \u2192 to'lov \u2192 qarz. Tovarlar qismi yuqorida (matnli).
    EQ,
    ...(() => {
      try {
        const _R = chekRows(sale, cfg, F);
        const out = [];
        _R.summary.forEach(x => out.push(lr(x[0] + ":", x[1])));
        if (_R.payment.length) { out.push(EQ); _R.payment.forEach(x => out.push(lr(x[0] + ":", x[1]))); }
        if (_R.debt.length)    { out.push(DA); _R.debt.forEach(x => out.push(lr(x[0] + ":", x[1]))); }
        return out;
      } catch (e) { return []; }
    })(),
    note ? (DA + "\nIzoh: " + note) : null,
    EQ,
    (typeof chekRefundNote === "function" ? chekRefundNote(sale, F, true) : null),
    center(footer || "Rahmat! Yana kutamiz"),
    // ✅ 2026-08-14: qo'shimcha matn qatorlari
    ...(() => { try {
      const _R = chekRows(sale, cfg, F);
      return _R.footer.slice(1).map(t => center(t));
    } catch (e) { return []; } })(),
    botUser ? center("@" + botUser) : null,
    EQ,
  ].filter(l => l !== null && l !== "").join("\n");

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',Courier,monospace;background:#f0f0f0;
     display:flex;flex-direction:column;align-items:center;padding:16px 8px}
.rc{background:#fff;padding:18px 16px;
    /* ✅ 2026-08-14: ZAMONAVIY ko'rinish (egasining talabi) — avval
       eski matn-terminal uslubida edi. Endi tiniq monoshrift, yumshoq
       oraliq va tabiiy rang. Tuzilma o'zgarmagan: chop etishda
       avvalgidek tekis chiqadi. */
    /* \u26a0\ufe0f 2026-08-15: satr 40 BELGI. Shrift katta bo'lsa satrlar
       sig'may O'RALIB ketadi va ikki tomonlama tekislash buziladi
       (chap tomonga yopishib qoladi \u2014 egasining shikoyati).
       Endi: oralish YOQ (pre) va shrift 40 belgi bemalol
       sig'adigan o'lchamda. */
    white-space:pre;word-break:normal;
    font-family:'JetBrains Mono','SF Mono','Consolas','Courier New',monospace;
    font-size:11.5px;line-height:1.65;color:#111;letter-spacing:0;
    /* ✅ 2026-08-15: blok MATN ENIGA moslashadi va markazda turadi —
       avval o'ngda katta bo'sh joy qolardi (egasining shikoyati). */
    width:fit-content;max-width:100%;margin:0 auto;overflow-x:hidden;
    border-radius:14px;box-shadow:0 2px 14px rgba(0,0,0,.07);
    border:1px solid #ECEAE6}
.acts{width:340px;max-width:100%;margin:10px 0 0;display:flex;gap:8px}
.acts button{flex:1;border:none;border-radius:7px;padding:11px;
             font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.btn-p{background:#000;color:#fff}
.btn-c{background:#fff;color:#000;border:1.5px solid #ccc}
@media print{
  /* \u2705 2026-08-12: qog'oz eni SOZLAMADAN (avval 72mm qotib qolgandi \u2014
     58/80 mm tanlansa ham termal chek 72mm da chiqardi). Shrift ham
     uslub sozlamasiga ergashadi. */
  @page{size:${cfg.paperWidth || 72}mm auto;margin:0}
  body{background:#fff;padding:0}
  .rc{width:${cfg.paperWidth || 72}mm;max-width:${cfg.paperWidth || 72}mm;
      border-radius:0;box-shadow:none;
      font-size:${({small:10,normal:11,large:12.5,xlarge:14})[cfg.fontScale] || 11}px;
      line-height:1.5;padding:4px 6px}
  .acts{display:none}
}

  ${typeof chekPrintFix === "function" ? chekPrintFix(cfg && cfg.paperWidth) : ""}
  ${typeof chekStyleCss === "function" ? chekStyleCss(cfg, {_noAlign:true,
      shop:".rc",tagline:".rc",meta:".rc",
      itemName:".rc",itemPrice:".rc",total:".rc",debt:".rc",footer:".rc"}) : ""}
  </style></head><body>
${cfg.logo ? `<div style="text-align:center;padding:6px 0 2px"><img src="${cfg.logo}" style="max-height:44px;max-width:70%;object-fit:contain"></div>` : ""}
  <div class="rc">
  ${_tasdiqBelgisi(sale, opts && opts.type)}${rows.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
<div class="acts">
  <button class="btn-p" onclick="window.print()">🖨 Chop etish</button>
  <button class="btn-c" onclick="window.close?window.close():history.back()">Yopish</button>
</div>
</body></html>`;
}

// ════════════════════════════════════════════════
// WHOLESALE CHEK — Compact ulgurji hujjat
// B5 format, jadval, imzo joyi
// ════════════════════════════════════════════════
function buildReceiptWholesale(sale, opts, cfg) {
  // \u2550\u2550 ULGURJI CHEK (2026-08-12, qayta yozildi) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // Egasining talabi: PDF namunadagi ULGURJI HUJJAT tarkibi, lekin
  // A4 emas \u2014 TERMAL qog'ozda (58/72/80 mm, sozlamadan). Ranglar,
  // soyalar, to'q sarlavha YO'Q: faqat OQ FON + QORA YOZUV (printerda
  // aniq chiqadi va siyoh tejaydi).
  // Namunadan olingan tarkib: boshlang'ich qoldiq, MODEL (artikul)
  // ustuni, dona narx va jami IKKI VALYUTADA, oxirida
  // Jami / To'landi / Qoldiq uch qatori.
  const {shopName, staffName, contact, footer, showStaff, showContact, F} = cfg;
  const W        = parseInt(cfg.paperWidth) || 72;
  const chekNum  = sale.chekNum || ("#" + sale.id);
  const date     = (sale.date||"").split("-").reverse().join(".");
  const time     = sale.time || "";
  const total    = Number(sale.total    || 0);
  const paid     = Number(sale.paid     || 0);
  const remaining= Number(sale.remaining|| 0);
  const discount = Number(sale.discount || 0);
  const subtotal = Number(sale.subtotal || (total + discount));   // 2026-08-14
  const items    = (sale.items||[]).filter(Boolean);
  const payType  = sale.payType || "";
  const isUsd    = sale.debtCurrency === "usd" && sale.debtUsd;
  const debtUsd  = Number(sale.debtUsd || 0);
  const prevUsd  = Number(sale.prevDebtUsd || 0);
  const prevUzs  = Number(sale.prevDebtUzs || 0);
  const due      = sale.due  || "";
  const rate     = Number(sale.rate) || Number(opts && opts.settingsRate) || 0;   // ✅ 565: 12800 o'ldi
  // ✅ 565: bu uslub $/so'm ikki ustunli — kurs yo'q bo'lsa yolg'on
  // raqam chizmaymiz, yagona uslubga qaytamiz (u kurssiz ham to'g'ri).
  if (!(rate > 0)) return buildReceiptHtml(sale, opts);
  const payLabels= {naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash"};
  const D        = n => "$" + (Number(n)||0).toFixed(2);

  const totalDona  = items.reduce((a,i) => a + (i.qty||0), 0);
  const totalBoxes = items.reduce((a,i) => a + (i.qtyBox||0), 0);

  // Tovar qatorlari: MODEL / soni / dona narx ($ va so'm) / jami
  // ✅ 2026-08-15: CHEGIRMA tovar narxiga taqsimlanadi — yagona
  // chekdagi kabi (avval bu uslublarda chegirma HIS QILINMASDI).
  const _dMap = (typeof chekItemDisc === "function") ? chekItemDisc(sale) : {};
  const itemRows = items.map((it, idx) => {
    const isBox   = it.sellMode === "karobka" && it.qtyBox;
    // ✅ 2026-08-15: TOVAR NOMI birinchi. Avval `it.art || it.name` edi —
    // artikul bo'lsa NOM umuman chiqmasdi, chekda faqat kod ko'rinardi
    // ("Q.17", "LR-01" — egasining shikoyati).
    const model   = it.name || it.art || "\u2014";
    const _artSub = (it.art && it.art !== it.name) ? it.art : "";
    // ✅ 2026-08-15: RANG zaxirasi — savat namunasida rang `variant`
    // maydonida keladi ("Qora (1 pochka)"), `color` bo'sh bo'lishi
    // mumkin. Shu sabab savat chekida rang ko'rinmasdi.
    const _rangY  = it.color ||
      (it.variant ? String(it.variant).split(" (")[0].split(" / ")[0] : "");
    const rang    = [_artSub, _rangY, isBox ? (it.groupSizes||"") : (it.size||"")]
                      .filter(Boolean).join(" / ");
    const qtyShow = isBox ? (it.qtyBox + " pchk (" + (it.qty||0) + ")")
                          : ((it.qty||0) + " " + (it.unit||"dona"));
    const perUzs  = (typeof chekItemPrice === "function")
      ? chekItemPrice(sale, idx, it, _dMap) : Number(it.price||0);
    const sumUzs  = perUzs * Number(it.qty||0);
    return `<tr>
      <td class="c">${idx+1}</td>
      <td class="l"><b>${model}</b>${rang ? `<div class="sub">${rang}</div>` : ""}</td>
      <td class="c">${qtyShow}</td>
      <td class="r">${(() => {
        // ✅ 2026-08-15: ASL narx chizib ko'rsatiladi (yagona chekdagi kabi)
        const _b = (typeof chekItemBase === "function") ? chekItemBase(sale, idx, it, _dMap) : null;
        return (_b && _b > perUzs)
          ? `<span style="text-decoration:line-through;color:#666;display:block;line-height:1.15">${F(_b)}</span><span style="display:block">${F(perUzs)}</span>`
          : F(perUzs);
      })()}<div class="sub">${D(perUzs / (rate||1))}</div></td>
      <td class="r b">${F(sumUzs)}<div class="sub">${D(sumUzs / (rate||1))}</div></td>
    </tr>`;
  }).join("");

  // Oldingi qarz (namunadagi "\u041d\u0430\u0447\u0430\u043b\u044c\u043d\u0430\u044f \u043e\u0441\u0442\u0430\u0442\u043a\u0430")
  // \u2705 2026-08-14: IKKALA valyuta (yagona manba)
  let _dW = (typeof debtLines === "function") ? debtLines(sale, { F, rate }) : null;
  // ✅ 2026-08-14: "Qarz tarixi" belgilagichi hamma uslubga ta'sir qiladi
  if (cfg && cfg.showDebtHistory === false) _dW = null;
  const boshRow = (_dW && _dW.oldin)
    ? `<div class="row"><span>Oldingi qarz</span><b>${_dW.oldin}</b></div>` : "";

  // Yakun: Jami / To'landi / Qoldiq
  const yakun =
    `<div class="row big"><span>JAMI</span><b>${F(total)} so'm${
      isUsd || prevUsd > 0 ? " / " + D(total / (rate||1)) : ""}</b></div>` +
    // ✅ 2026-08-14: chegirmasiz jami — yagona chekdagi kabi
    (discount > 0 ? `<div class="row"><span>Jami (chegirmasiz)</span><span>${F(subtotal)}</span></div>` : "") +
    (discount > 0 ? `<div class="row"><span>Chegirma</span><b>-${F(discount)}</b></div>` : "") +
    `<div class="row"><span>To'landi (${payLabels[payType]||payType||"\u2014"})</span><b>${F(paid)} so'm</b></div>` +
    (remaining > 0
      ? `<div class="row big"><span>QOLDIQ</span><b>${
          isUsd ? D(debtUsd) : F(remaining) + " so'm"}</b></div>` +
        ((_dW && _dW.keyin)
          ? `<div class="row"><span>Umumiy qarz</span><b>${_dW.keyin}</b></div>` : "") +
        (due ? `<div class="row"><span>Muddat</span><b>${due}</b></div>` : "")
      : `<div class="row big"><span>QOLDIQ</span><b>0</b></div>`);

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ulgurji chek ${chekNum}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',Arial,sans-serif;background:#fff;color:#000;
     padding:6px;font-size:11.5px;line-height:1.35}
.doc{width:${W}mm;max-width:${W}mm;margin:0 auto;background:#fff}
.hd{text-align:center;border-bottom:1px solid #000;padding-bottom:5px;margin-bottom:5px}
.shop{font-size:15px;font-weight:800;letter-spacing:.02em}
.sm{font-size:10px}
.meta{font-size:10.5px;margin-bottom:5px}
.meta div{display:flex;justify-content:space-between;gap:6px}
table{width:100%;border-collapse:collapse;font-size:10.5px;border:0}
th{border-top:1px solid #000;border-bottom:1px solid #000;padding:3px 2px;
   font-size:9.5px;font-weight:700;text-align:center}
td{padding:3px 2px;border-bottom:1px dotted #999;vertical-align:top}
.c{text-align:center}.r{text-align:right}.l{text-align:left}.b{font-weight:700}
.sub{font-size:9px;color:#000;opacity:.75}
.tot{border-top:1px solid #000;margin-top:5px;padding-top:4px}
.row{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0;font-size:11px}
.row.big{font-size:13px;font-weight:800;border-top:1px dashed #000;
         border-bottom:1px dashed #000;padding:3px 0;margin:3px 0}
.ft{text-align:center;font-size:10px;margin-top:6px;border-top:1px dashed #000;padding-top:5px}
@media print{
  @page{margin:0}
  body{padding:0}
  .doc{width:${W}mm}
}

  ${typeof chekPrintFix === "function" ? chekPrintFix(cfg && cfg.paperWidth) : ""}
  ${typeof chekStyleCss === "function" ? chekStyleCss(cfg, {shop:".shop",tagline:".sm",meta:".meta",
      itemName:".l",itemPrice:".r",total:".tot,.big",
      debt:".row",footer:".ft"}) : ""}
  </style></head><body>
<div class="doc">
  ${_tasdiqBelgisi(sale, opts && opts.type)}
  ${cfg.logo ? `<div style="text-align:center;padding:6px 0 2px"><img src="${cfg.logo}" style="max-height:44px;max-width:70%;object-fit:contain"></div>` : ""}
  <div class="hd">
    <div class="shop">${shopName}</div>
    ${cfg.tagline ? `<div class="sm tagline">${cfg.tagline}</div>` : ""}
    ${cfg.addr ? `<div class="sm addr">${cfg.addr}</div>` : ""}
    ${showContact && contact ? `<div class="sm">${contact}</div>` : ""}
  </div>
  <div class="meta">
    <div><span>Chek</span><b>${chekNum}</b></div>
    <div><span>Sana</span><span>${date} ${time}</span></div>
    ${sale.customerName ? `<div><span>Mijoz</span><b>${sale.customerName}</b></div>` : ""}
    ${sale.customerPhone ? `<div><span>Mijoz raqami</span><span>${sale.customerPhone}</span></div>` : ""}
    ${showStaff && staffName ? `<div><span>Sotuvchi</span><span>${staffName}</span></div>` : ""}
    <div><span>Kurs</span><span>${F(rate)}</span></div>
  </div>
  <!-- ✅ 2026-08-14: "Oldingi qarz" endi pastdagi QARZ bo'limida -->
  <table style="table-layout:fixed;width:100%">
    <thead><tr>
      <th style="width:7%">\u2116</th><th class="l" style="width:33%">Model</th>
      <th style="width:15%">Soni</th><th class="r" style="width:23%">Narx</th><th class="r" style="width:22%">Jami</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  ${(() => {
    // \u2705 2026-08-14: BO'LIMLAR YAGONA TARTIBDA (chekRows) \u2014
    // meta \u2192 tovarlar \u2192 yig'indi \u2192 to'lov \u2192 qarz \u2192 altbilgi.
    // Faqat TOVARLAR qismi uslubga xos (yuqoridagi jadval).
    try {
      const _R = chekRows(sale, cfg, F);
      const _H = chekRowsHtml(_R, { row:"row", sep:"", ft:"ft",
                                    big:"big", total:"tot", debt:"b" });
      return `<div class="tot">${_H.summary}${_H.payment}${_H.debt}</div>${(typeof chekRefundNote === "function" ? chekRefundNote(sale, F) : "")}${_H.footer}`;
    } catch (e) { return ""; }
  })()}
  </div>
  </body></html>`;
}
function buildReceiptTable(sale, opts, cfg) {
  // \u2550\u2550 JADVAL (2026-08-12: PDF namunasi darajasiga chiqarildi) \u2550\u2550
  // Egasining namunasi (ALEX GIARDINI hujjati) tuzilishi:
  //   sarlavha + tel + KURS \u2192 mijoz/sotuvchi \u2192 chek \u2116 va sana \u2192
  //   BOSHLANG'ICH QOLDIQ ($) \u2192 jadval: \u2116 | Model | Soni |
  //   Narx ($ va so'm) | Jami ($ va so'm) \u2192 ITOGO ikki valyutada \u2192
  //   To'landi \u2192 QOLDIQ. Oq fon, qora yozuv; eni sozlamadan (58/72/80).
  const {shopName, staffName, contact, footer, showStaff, showContact, F} = cfg;
  const W        = parseInt(cfg.paperWidth) || 72;
  const dark     = (cfg.headerStyle || "dark") === "dark";
  const chekNum  = sale.chekNum || ("#" + sale.id);
  const date     = (sale.date||"").split("-").reverse().join(".");
  const time     = sale.time || "";
  const total    = Number(sale.total    || 0);
  const paid     = Number(sale.paid     || 0);
  const remaining= Number(sale.remaining|| 0);
  const discount = Number(sale.discount || 0);
  const subtotal = Number(sale.subtotal || (total + discount));   // 2026-08-14
  const items    = (sale.items||[]).filter(Boolean);
  const payType  = sale.payType || "";
  const isUsd    = sale.debtCurrency === "usd" && sale.debtUsd;
  const debtUsd  = Number(sale.debtUsd || 0);
  const prevUsd  = Number(sale.prevDebtUsd || 0);
  const prevUzs  = Number(sale.prevDebtUzs || 0);
  const due      = sale.due  || "";
  const rate     = Number(sale.rate) || Number(opts && opts.settingsRate) || 0;   // ✅ 565: 12800 o'ldi
  // ✅ 565: $ birinchi ustun — kurssiz yagona uslubga qaytamiz.
  if (!(rate > 0)) return buildReceiptHtml(sale, opts);
  const payLabels= {naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash"};
  const D  = n => (Number(n)||0).toFixed(2);
  const hdrCss = dark ? "background:#0D1B2A;color:#fff"
                      : "background:#fff;color:#000;border-bottom:2px solid #000";

  const totalDona  = items.reduce((a,i) => a + (i.qty||0), 0);
  const totalBoxes = items.reduce((a,i) => a + (i.qtyBox||0), 0);
  const totalUsd   = total / (rate || 1);

  // ✅ 2026-08-15: chegirma tovar narxiga taqsimlanadi (yagona chekdagi kabi)
  const _dMap = (typeof chekItemDisc === "function") ? chekItemDisc(sale) : {};
  const rows = items.map((it, idx) => {
    const isBox   = it.sellMode === "karobka" && it.qtyBox;
    // ✅ 2026-08-15: TOVAR NOMI birinchi. Avval `it.art || it.name` edi —
    // artikul bo'lsa NOM umuman chiqmasdi, chekda faqat kod ko'rinardi
    // ("Q.17", "LR-01" — egasining shikoyati).
    const model   = it.name || it.art || "\u2014";
    const _artSub = (it.art && it.art !== it.name) ? it.art : "";
    // ✅ 2026-08-15: RANG zaxirasi — savat namunasida rang `variant`
    // maydonida keladi ("Qora (1 pochka)"), `color` bo'sh bo'lishi
    // mumkin. Shu sabab savat chekida rang ko'rinmasdi.
    const _rangY  = it.color ||
      (it.variant ? String(it.variant).split(" (")[0].split(" / ")[0] : "");
    const izoh    = [_artSub, _rangY, isBox ? (it.groupSizes||"") : (it.size||"")]
                      .filter(Boolean).join(" / ");
    const qtyShow = isBox ? (it.qtyBox + " pchk") : String(it.qty || 0);
    const qtySub  = isBox ? ((it.qty||0) + " dona") : (it.unit || "dona");
    const perUzs  = (typeof chekItemPrice === "function")
      ? chekItemPrice(sale, idx, it, _dMap) : Number(it.price||0);
    const sumUzs  = perUzs * Number(it.qty||0);
    // PDF namunasidagi kabi: dona narx $ da yaxlitlanadi, jami esa
    // O'SHA yaxlitlangan narx \u00d7 soni (aks holda tiyinlarda farq chiqadi).
    const perUsd  = Math.round((perUzs / (rate||1)) * 100) / 100;
    return `<tr>
      <td class="c">${idx+1}</td>
      <td class="l"><b>${model}</b>${izoh ? `<div class="sub">${izoh}</div>` : ""}</td>
      <td class="c">${qtyShow}<div class="sub">${qtySub}</div></td>
      <td class="r">${D(perUsd)}<div class="sub">${(() => {
        const _b = (typeof chekItemBase === "function") ? chekItemBase(sale, idx, it, _dMap) : null;
        return (_b && _b > perUzs)
          ? `<span style="text-decoration:line-through;color:#666;display:block;line-height:1.15">${F(_b)}</span><span style="display:block">${F(perUzs)}</span>`
          : F(perUzs);
      })()}</div></td>
      <td class="r b">${D(perUsd * Number(it.qty||0))}<div class="sub">${F(sumUzs)}</div></td>
    </tr>`;
  }).join("");

  // \u2705 2026-08-14: IKKALA valyuta (yagona manba)
  let _dJ = (typeof debtLines === "function") ? debtLines(sale, { F, rate }) : null;
  // ✅ 2026-08-14: "Qarz tarixi" belgilagichi hamma uslubga ta'sir qiladi
  if (cfg && cfg.showDebtHistory === false) _dJ = null;
  const boshRow = (_dJ && _dJ.oldin)
    ? `<div class="mrow"><span>Oldingi qarz</span><b>${_dJ.oldin}</b></div>` : "";

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chek ${chekNum}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',Arial,sans-serif;background:#fff;color:#000;
     padding:6px;font-size:11px;line-height:1.35}
.doc{width:${W}mm;max-width:${W}mm;margin:0 auto;background:#fff}
.hd{${hdrCss};padding:9px 10px;text-align:center}
.shop{font-size:14px;font-weight:800;letter-spacing:.02em}
.sm{font-size:9.5px;opacity:.85}
.meta{font-size:10px;padding:5px 0;border-bottom:1px solid #000}
.mrow{display:flex;justify-content:space-between;gap:6px;padding:1px 0}
table{width:100%;border-collapse:collapse;font-size:10px;margin-top:5px;border:1px solid #000}
th{border:1px solid #000;padding:3px 1px;font-size:9px;font-weight:700}
th .u{display:block;font-size:8px;font-weight:600;opacity:.7}
td{padding:3px 2px;border:1px solid #000;vertical-align:top}
.c{text-align:center}.r{text-align:right}.l{text-align:left}.b{font-weight:700}
.sub{font-size:8.5px;opacity:.72;margin-top:1px}
.tot{border-top:1px solid #000;margin-top:4px;padding-top:4px}
.trow{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0;font-size:11px}
.trow.big{font-size:12.5px;font-weight:800;border-top:1px dashed #000;
          border-bottom:1px dashed #000;padding:3px 0;margin:3px 0}
.ft{text-align:center;font-size:9.5px;margin-top:6px;border-top:1px dashed #000;padding-top:5px}
@media print{ @page{margin:0} body{padding:0} .doc{width:${W}mm} }

  ${typeof chekPrintFix === "function" ? chekPrintFix(cfg && cfg.paperWidth) : ""}
  ${typeof chekStyleCss === "function" ? chekStyleCss(cfg, {shop:".shop",tagline:".sm",meta:".meta",
      itemName:".l",itemPrice:".r",total:".tot,.big",
      debt:".trow",footer:".ft"}) : ""}
  </style></head><body>
<div class="doc">
  ${_tasdiqBelgisi(sale, opts && opts.type)}
  ${cfg.logo ? `<div style="text-align:center;padding:6px 0 2px"><img src="${cfg.logo}" style="max-height:44px;max-width:70%;object-fit:contain"></div>` : ""}
  <div class="hd">
    <div class="shop">${shopName}</div>
    ${cfg.tagline ? `<div class="sm tagline">${cfg.tagline}</div>` : ""}
    ${cfg.addr ? `<div class="sm addr">${cfg.addr}</div>` : ""}
    ${showContact && contact ? `<div class="sm">Tel: ${contact}</div>` : ""}
    <div class="sm">Kurs: ${F(rate)}</div>
  </div>
  <div class="meta">
    ${sale.customerName ? `<div class="mrow"><span>Mijoz</span><b>${sale.customerName}</b></div>` : ""}
    ${sale.customerPhone ? `<div class="mrow"><span>Mijoz raqami</span><span>${sale.customerPhone}</span></div>` : ""}
    ${showStaff && staffName ? `<div class="mrow"><span>Sotuvchi</span><span>${staffName}</span></div>` : ""}
    <div class="mrow"><span>Chek \u2116</span><b>${chekNum}</b></div>
    <div class="mrow"><span>Sana</span><span>${date} ${time}</span></div>
    <!-- ✅ 2026-08-14: "Oldingi qarz" TEPADAN olib tashlandi — u endi
         pastdagi QARZ bo'limida, yagona tartib bo'yicha -->
  </div>
  <table style="table-layout:fixed;width:100%">
    <thead><tr>
      <th style="width:7%">\u2116</th>
      <th class="l" style="width:33%">Model</th>
      <th style="width:15%">Soni</th>
      <th class="r" style="width:23%">Narx<span class="u">$ / so'm</span></th>
      <th class="r" style="width:22%">Jami<span class="u">$ / so'm</span></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${(() => {
    // \u2705 2026-08-14: BO'LIMLAR YAGONA TARTIBDA (chekRows)
    try {
      const _R = chekRows(sale, cfg, F);
      const _H = chekRowsHtml(_R, { row:"trow", sep:"", ft:"ft",
                                    big:"big", total:"tot", debt:"b" });
      return `<div class="tot">${_H.summary}${_H.payment}${_H.debt}</div>${(typeof chekRefundNote === "function" ? chekRefundNote(sale, F) : "")}${_H.footer}`;
    } catch (e) { return ""; }
  })()}
  </div>
  </body></html>`;
}
function _botChekStyle(sale, chekCfg) {
  try {
    // \u26a0\ufe0f MUHR ustuvor (\u00a73.5). Muhr YO'Q bo'lsa \u2014 "unified":
    // eski sotuvlar aynan shu ko'rinishda chizilgan edi, shuning
    // uchun ular O'ZGARMAYDI (ilovadagi qoida bilan bir xil).
    const s = (sale && (sale.chekStyle || (sale.data && sale.data.chekStyle))) || "";
    return s || "unified";
  } catch (e) { return "unified"; }
}

// Uslub bo'yicha chizish (mavjud `buildReceiptHtml` — "unified")
function buildReceiptStyled(sale, opts, chekCfg) {
  chekCfg = chekCfg || (opts && opts._chekCfg) || {};
  const style = _botChekStyle(sale, chekCfg);
  if (style === "unified" || !style) return buildReceiptHtml(sale, opts);
  const c = chekCfg || {};
  const cfg = {
    shopName: opts.shopName || "MERX",
    staffName: opts.staffName || "",
    logo: opts.logo || c.logo || null,
    contact: opts.contact || c.contact || "",
    addr: c.addr || "", tagline: c.tagline || "",
    footer: opts.footer || c.footer || "Rahmat! Yana kutamiz",
    showStaff: c.showStaff !== false, showContact: c.showContact !== false,
    showDebtHistory: c.showDebtHistory !== false,
    dualCurrency: c.dualCurrency !== false,
    paperWidth: c.paperWidth || 72,
    headerStyle: c.headerStyle || "dark",
    fontScale: c.fontScale || "normal", fontFamily: c.fontFamily || "dm",
    blocks: c.blocks || null, extraLines: c.extraLines || [],
    rate: Number(sale.rate) || Number(opts && opts.settingsRate) || 0,   // ✅ 565
    F: n => Math.round(Number(n) || 0).toLocaleString("ru-RU")
  };
  try {
    if (style === "merx")      return buildReceiptMerx(sale, opts, cfg);
    if (style === "thermal")   return buildReceiptThermal(sale, opts, cfg);
    if (style === "wholesale") return buildReceiptWholesale(sale, opts, cfg);
    if (style === "table")     return buildReceiptTable(sale, opts, cfg);
  } catch (e) { console.error("[bot] uslub chizishda xato:", e.message); }
  return buildReceiptHtml(sale, opts);
}


function chekItemDisc(sale) {
  const map = {};
  try {
    const items = (sale.items || []).filter(Boolean);
    const disc  = Number(sale.discount) || 0;
    if (!(disc > 0) || !items.length) return map;

    const profits = items.map(i => {
      const line = (i.price || 0) * (i.qty || 0);
      const cost = (i.cost != null ? i.cost : 0) * (i.qty || 0);
      const p = line - cost;
      return p > 0 ? p : 0;
    });
    let weights = profits, totW = profits.reduce((a, b) => a + b, 0);
    if (totW <= 0) {
      weights = items.map(i => (i.price || 0) * (i.qty || 0));
      totW = weights.reduce((a, b) => a + b, 0);
    }
    if (totW <= 0) return map;

    let allocated = 0, lastIdx = -1;
    items.forEach((it, ix) => { if (weights[ix] > 0) lastIdx = ix; });
    items.forEach((it, ix) => {
      if (weights[ix] <= 0) { map[ix] = 0; return; }
      const d = Math.floor(disc * weights[ix] / totW);
      map[ix] = d; allocated += d;
    });
    if (lastIdx >= 0) map[lastIdx] += (disc - allocated);  // qoldiq
  } catch (e) {}
  return map;
}

// Tovarning chekda ko'rsatiladigan DONA narxi (chegirma taqsimlangan)

function chekItemPrice(sale, idx, it, discMap) {
  try {
    const q = Number(it.qty) || 0;
    const p = Number(it.price) || 0;
    if (!q) return p;
    const d = (discMap || {})[idx] || 0;
    return Math.max(0, p - (d / q));
  } catch (e) { return Number(it.price) || 0; }
}

function chekPrintFix(W) {
  // \U0001f534 2026-08-15 ILDIZ (uch urinishdan keyin aniqlandi):
  // Chizuvchida `@page{size:Wmm}` bor edi, men esa `size:auto` qo'ydim.
  // `auto` \u2014 QOG'OZ enini oladi (80mm), BOSILADIGAN enni emas
  // (72.1mm). Shuning uchun o'ng ~8mm qirqilardi. Egasining o'lchovi
  // buni tasdiqladi: printer "80(72.1)".
  // YECHIM: sahifa eni chizuvchi bilan BIR XIL qoladi, hujjat esa
  // undan 4mm TOR \u2014 shunda har qanday drayverda sig'adi.
  const w  = Number(W) || 72;
  // Chapga tekislanganda katta zaxira kerak emas — 2mm yetadi.
  // (4mm edi: markazga qo'yilgani uchun ikki tomondan olinardi.)
  const wd = Math.max(40, w - 2);
  return `
  @media print {
    /* \U0001f534 2026-08-15 (4-urinish, endi ildiz): SAHIFA o'lchami
       QOG'OZDAN olinadi (size:auto \u2014 80mm), hujjat esa BOSILADIGAN
       enda (72mm) va CHAPGA yopishadi.
       Avval sahifa 72mm deb belgilangandi \u2014 drayver uni 80mm
       qog'ozga KATTALASHTIRIB bosardi (72\u219280 = +11%), shuning uchun
       o'ng chekka bosiladigan qismdan chiqib ketardi. Endi sahifa =
       qog'oz, kattalashtirish YO'Q. */
    @page { size: auto; margin: 0 }
    html, body { width:auto !important; margin:0 !important; padding:0 !important }
    .doc, .wrap, .rc {
      width:${w}mm !important; max-width:${w}mm !important;
      /* \U0001f534 2026-08-15: CHAPGA tekislanadi, MARKAZGA emas.
         Rasm ko'rsatdi: chapda katta bo'sh joy, o'ngda kesik \u2014
         yani mazmun ongga surilgan. Sabab: markazga qoyish hujjatni
         QOG'OZ o'rtasiga qo'yardi, bosiladigan qism esa CHAPDAN
         boshlanadi. Endi chapga yopishadi \u2014 o'ng chekka chiqmaydi. */
      margin:0 !important; padding:0 !important;
      box-shadow:none !important; border:none !important;
      box-sizing:border-box !important }
    table { width:100% !important; table-layout:fixed !important;
            border-collapse:collapse !important }
    table, td, th { box-sizing:border-box !important }
    td, th { word-break:break-word !important; overflow-wrap:anywhere !important;
             padding-left:1px !important; padding-right:1px !important }
    /* \u2116 ustuni: ikki xonali raqam BO'LINMASIN */
    td.c:first-child, th.c:first-child, td:first-child, th:first-child {
      white-space:nowrap !important; padding:0 !important; text-align:center !important }
    td.r, th.r { white-space:nowrap !important }
    /* Chizilgan asl narx: AYRIM qatorda, o'lchami yangisiga TENG */
    td.r s, td.r span[style*="line-through"] {
      display:block !important; line-height:1.15 !important;
      font-size:inherit !important; color:#000 !important; opacity:1 !important }
    /* Barcha matn QORA \u2014 termal printer xira rangni bosmaydi */
    *, .sub, .sm, .lbl, .calc, .it-art, .it-info, .tot-cnt, .hd-meta,
    .ft-sub, .meta span, small, s, del,
    span[style*="line-through"], span[style*="opacity"] {
      color:#000 !important; opacity:1 !important }
  }`;
}
function chekItemBase(sale, idx, it, discMap) {
  try {
    const p = Number(it.price) || 0;
    const b = Number(it.basePrice) || 0;
    const d = (discMap || {})[idx] || 0;
    if (b > p) return b;          // savatdagi tovar chegirmasi
    if (d > 0) return p;          // umumiy chegirma taqsimlangan
    return null;
  } catch (e) { return null; }
}

function buildPayReceiptStyled(payment, opts) {
  const o = opts || {};
  const style = o.style || "unified";
  const cfg   = o.cfg || {};
  const W     = parseInt(cfg.paperWidth) || 72;
  const dark  = (cfg.headerStyle || "dark") === "dark";
  const F     = n => Math.round(Number(n) || 0).toLocaleString("ru-RU");
  const D     = n => "$" + (Number(n) || 0).toFixed(2);

  const cur   = payment.currency === "usd" ? "usd" : "uzs";
  const rate  = Number(payment.rate) || Number(payment.data && payment.data.rate) || Number(o.settingsRate) || 0;   // ✅ 565: 12800 o'ldi
  const somAmt = Number(payment.amountSom) ||
                 (cur === "usd" ? (rate > 0 ? Math.round(Number(payment.amount || 0) * rate) : 0)
                                : Number(payment.amount || 0));   // ✅ 565

  // To'landi qatori + OCHIQ HISOB (egasining talabi)
  const paidMain = cur === "usd" ? D(payment.amount) : F(payment.amount) + " so'm";
  const hisobLine = (cur === "usd" && somAmt && rate > 0)   // ✅ 565
    ? F(somAmt) + " / " + F(rate) + " = " + D(payment.amount)
    : "";

  // Muhrlangan qarz holati \u2014 FAQAT O'QIYMIZ
  const dB = payment.debtBefore, dA = payment.debtAfter;
  const M  = v => (v == null) ? "" : (cur === "usd" ? D(v) : F(v) + " so'm");

  // \U0001f534 2026-08-15 (egasining talabi): IKKALA VALYUTA ALOHIDA,
  // KONVERTATSIYASIZ. Mijozda so'm VA dollar qarzi bir vaqtda bo'lishi
  // mumkin \u2014 to'lov bittasini kamaytiradi, ikkinchisi O'Z holicha
  // qoladi. Masalan: "3800$ + 20 000 000 so'm".
  // Nol bo'lgan valyuta KO'RSATILMAYDI.
  // (\u00a73.1: qarz belgilangan valyutada qotadi \u2014 shuning uchun
  //  umumiy qarzni so'mga aylantirib ko'rsatish NOTO'G'RI edi.)
  const _ikki = (uzs, usd) => {
    const p = [];
    if (Number(usd) > 0) p.push(D(usd));
    if (Number(uzs) > 0) p.push(F(uzs) + " so'm");
    return p.length ? p.join(" + ") : "0";
  };
  const _bIkki = (payment.debtBeforeUzs != null || payment.debtBeforeUsd != null)
    ? _ikki(payment.debtBeforeUzs, payment.debtBeforeUsd) : null;
  const _aIkki = (payment.debtAfterUzs != null || payment.debtAfterUsd != null)
    ? _ikki(payment.debtAfterUzs, payment.debtAfterUsd) : null;
  // Muhr bo'lsa ikkala valyuta, bo'lmasa (eski cheklar) avvalgidek
  const MB = _bIkki != null ? _bIkki : M(dB);
  const MA = _aIkki != null ? _aIkki : M(dA);

  // To'lov usuli
  const payLabels = { naqd:"Naqd", karta:"Karta", otkazma:"O'tkazma", aralash:"Aralash" };
  const mb = payment.methodBreakdown || null;
  const mbRows = mb ? Object.keys(mb).filter(k => (mb[k] || 0) > 0) : [];
  const usulHtml = mbRows.length > 1
    ? mbRows.map(k => `<div class="r"><span>${payLabels[k] || k}</span><b>${F(mb[k])} so'm</b></div>`).join("")
    : `<div class="r"><span>Usul</span><b>${payLabels[payment.method] || payment.method || "\u2014"}</b></div>`;

  const ixcham = (style === "compact" || style === "thermal");
  const oq     = (style === "wholesale") || !dark;
  const hdrCss = oq ? "background:#fff;color:#000;border-bottom:2px solid #000"
                    : "background:#0D1B2A;color:#fff";
  const bodyFs = ixcham ? "11px" : "12px";

  // Jadval uslubi: ikki valyuta ustunda
  const jadval = (style === "table") && rate > 0;   // ✅ 565

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>To'lov cheki ${payment.chekNum || ""}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',Arial,sans-serif;background:#fff;color:#000;
     padding:6px;font-size:${bodyFs};line-height:1.4}
.doc{width:${W}mm;max-width:${W}mm;margin:0 auto;background:#fff}
.hd{${hdrCss};padding:${ixcham ? "8px 10px" : "11px 14px"};text-align:center}
.shop{font-size:${ixcham ? "13px" : "15px"};font-weight:800}
.sm{font-size:10px;opacity:.85}
.meta{font-size:10.5px;padding:5px 0;border-bottom:1px dashed #000}
.meta div{display:flex;justify-content:space-between;gap:6px}
.sec{padding:6px 0;border-bottom:1px dashed #000}
.lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;
     letter-spacing:.04em;opacity:.7;margin-bottom:3px}
.r{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0}
.big{font-size:${ixcham ? "15px" : "18px"};font-weight:800;text-align:right}
.calc{font-size:10px;text-align:right;opacity:.75;margin-top:1px}
.qold{font-size:${ixcham ? "13px" : "15px"};font-weight:800}
table{width:100%;border-collapse:collapse;font-size:10.5px}
th{border-top:1px solid #000;border-bottom:1px solid #000;padding:3px 2px;
   font-size:9.5px;font-weight:700}
td{padding:3px 2px;border-bottom:1px dotted #999}
.r2{text-align:right}
.ft{text-align:center;font-size:10px;margin-top:6px;padding-top:5px;
    border-top:1px dashed #000}
@media print{ @page{margin:0} body{padding:0} .doc{width:${W}mm} }
  /* ✅ 2026-08-15: oq fon, qora yozuv — xiralashtirilmagan (egasining talabi) */
  .doc,.doc *{color:#000}
  .doc{background:#fff}
  .sm,.lbl,.calc{opacity:1}
  ${typeof chekPrintFix === "function" ? chekPrintFix(cfg && cfg.paperWidth) : ""}
  ${typeof chekStyleCss === "function" ? chekStyleCss(cfg, {
      shop:".shop", tagline:".sm.tagline", meta:".meta",
      itemPrice:".calc", total:".big", debt:".qold,.r2", footer:".ft"
    }) : ""}

  /* \U0001f534 2026-08-15: USLUBLAR CHINDAN FARQ QILSIN.
     Tekshiruv ko'rsatdi: Termal va Ixcham Yagona bilan AYNAN bir xil
     chiqardi \u2014 nomi bor, ichi yo'q edi (egasining kuzatuvi).
     Endi:
       \u2022 TERMAL  \u2014 monoshrift, tor, ramkasiz (tor qog'oz uchun)
       \u2022 IXCHAM  \u2014 faqat asosiy: summa, hisob, edi \u2192 qoldi
                    (sarlavha tafsilotlari va meta qisqaradi) */
  ${o.style === "thermal" ? `
    .doc{font-family:'JetBrains Mono','Consolas','Courier New',monospace;
         font-size:11.5px;line-height:1.55;letter-spacing:0}
    .hd{border-bottom:1px dashed #000;padding-bottom:6px}
    .shop{font-size:13px;letter-spacing:.06em}
    .sec{border:none;border-top:1px dashed #000;border-radius:0;padding:6px 0}
    .big{font-size:15px}
    .doc *{border-radius:0 !important}
  ` : ""}
  ${o.style === "compact" ? `
    .hd .sm:not(.addr){display:none}
    .hd .addr{display:none}
    .meta div:nth-child(n+3){display:none}
    .sec{padding:6px 8px}
    .lbl{font-size:10px}
    .big{font-size:19px}
    .doc{font-size:12px}
  ` : ""}
  </style>
  </head><body>
<div class="doc">
  ${_tasdiqBelgisi(payment, "qarz")}
  ${cfg.logo ? `<div style="text-align:center;padding:6px 0 2px"><img src="${cfg.logo}" style="max-height:44px;max-width:70%;object-fit:contain"></div>` : ""}
  <div class="hd">
    <div class="shop">${cfg.shopName || o.shopName || "MERX"}</div>
    ${cfg.tagline ? `<div class="sm tagline">${cfg.tagline}</div>` : ""}
    ${cfg.addr    ? `<div class="sm addr">${cfg.addr}</div>` : ""}
    ${cfg.showContact && cfg.contact ? `<div class="sm">${cfg.contact}</div>` : ""}
    <div class="sm">TO'LOV CHEKI</div>
  </div>
  <div class="meta">
    <div><span>Chek</span><b>${payment.chekNum || ""}</b></div>
    <div><span>Sana</span><span>${payment.date || ""} ${payment.time || ""}</span></div>
    ${payment.customerName ? `<div><span>Mijoz</span><b>${payment.customerName}</b></div>` : ""}
    ${payment.customerPhone ? `<div><span>Mijoz raqami</span><span>${payment.customerPhone}</span></div>` : ""}
    ${cfg.showStaff && o.staffName ? `<div><span>Qabul qildi</span><span>${o.staffName}</span></div>` : ""}
  </div>

  <div class="sec">
    <div class="lbl">To'landi</div>
    <div class="big">${paidMain}</div>
    ${hisobLine ? `<div class="calc">${hisobLine}</div>` : ""}
    ${cur === "usd" && rate > 0 ? `<div class="calc">Kurs: ${F(rate)} so'm</div>` : ""}
  </div>

  <div class="sec">
    <div class="lbl">To'lov usuli</div>
    ${usulHtml}
  </div>

  <div class="sec">
    <div class="lbl">Qarz holati</div>
    ${jadval
      ? `<table>
           <tr><th>&nbsp;</th><th class="r2">So'm</th><th class="r2">USD</th></tr>
           ${dB != null ? `<tr><td>Edi</td><td class="r2">${
             cur === "usd" ? F(dB * rate) : F(dB)}</td><td class="r2">${
             cur === "usd" ? D(dB) : D(dB / (rate || 1))}</td></tr>` : ""}
           <tr><td>To'landi</td><td class="r2">${F(somAmt)}</td><td class="r2">${
             D(cur === "usd" ? payment.amount : somAmt / (rate || 1))}</td></tr>
           ${dA != null ? `<tr><td><b>Qoldi</b></td><td class="r2"><b>${
             cur === "usd" ? F(dA * rate) : F(dA)}</b></td><td class="r2"><b>${
             cur === "usd" ? D(dA) : D(dA / (rate || 1))}</b></td></tr>` : ""}
         </table>`
      : `${dB != null ? `<div class="r"><span>Jami qarz edi</span><b>${MB}</b></div>` : ""}
         ${dA != null ? `<div class="r qold"><span>${
           Number(dA) > 0 ? "Qoldi" : "To'liq yopildi"}</span><b>${MA}</b></div>` : ""}`}
    ${o.dueLine ? `<div class="r"><span>Muddat</span><b>${o.dueLine}</b></div>` : ""}
  </div>

  <div class="ft">${cfg.footer || "Rahmat! Yana kutamiz"}</div>
  ${(Array.isArray(cfg.extraLines) ? cfg.extraLines : [])
      .filter(Boolean)
      .map(t => `<div class="ft" style="font-size:11px">${t}</div>`).join("")}
</div>
</body></html>`;
}


// \u2550\u2550\u2550 CHEKDAGI "TASDIQLANMAGAN" BELGISI (2026-08-13, B2) \u2550\u2550\u2550
// Internet yo'q paytda chiqarilgan chekda ochiq yoziladi \u2014 mijoz ham,
// kassir ham biladi. Yozuv bulutga yetgach belgi o'zi yo'qoladi
// (chek qayta chop etilsa toza chiqadi).
