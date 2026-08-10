// ════════════════════════════════════════════════════════════════
// MERX — api/mijoz.js  ·  MIJOZ PORTALI DARVOZASI  ·  2026-08-10
// (nom: mijoz.html ↔ api/mijoz.js jufti; egasi sahifasi js/portal.js — boshqa fayl)
// ════════════════════════════════════════════════════════════════
//
// NIMA UCHUN: mijoz.html avval bulutga TO'G'RIDAN-TO'G'RI anon kalit
// bilan kirardi. Oqibatlar: (1) havola ichida bulut manzili+kalit
// ochiq ketardi; (2) anon yopilgach katalog/xaridlar O'LIK bo'lib
// qolgan edi; (3) `select *` tannarx va parollarni ham oshkor
// qilardi; (4) bron bekor qilishda EGALIK tekshirilmasdi.
// Endi hamma narsa shu YAGONA darvoza orqali: server service-kalit
// bilan o'qiydi, mijozga faqat KERAKLI va XAVFSIZ maydonlar boradi.
//
// KIRISH TARTIBI: login → imzolangan CHIPTA (HMAC, 30 kun) →
// keyingi har amal chipta bilan. Chipta ichida do'kon+mijoz —
// mijoz FAQAT o'z ma'lumotini oladi, so'rovda boshqa ID yuborib
// ham ololmaydi (server chiptadan oladi, so'rovdagiga ishonmaydi).
//
// KERAKLI ENV (Vercel, asosiy ilova loyihasi):
//   MERX_PORTAL_SECRET = uzun tasodifiy satr (chipta imzosi uchun)
//
// ⚓ KELAJAK ILGAKLARI (MERX DONA rejasi, 2026-08-10 kelishuvi):
//   1) Amal-router — yangi amallar (masalan `my_import`: ulgurji
//      xaridlarni mijozning O'Z do'koni katalogiga ko'chirish)
//      shu faylga qo'shiladi, mijoz sahifasi qayta qurilmaydi.
//   2) Xaridlar javobida SKU SAQLANADI — ulgurji sotuvni dona-
//      katalogga bog'laydigan ip shu.
//   3) `config`/`login` javobida `promo` o'rni — do'kon marketingi
//      va "MERX'ni o'z do'koningizga oling" reklamasi uchun joy
//      BAND; hozircha null, keyin settings/SA'dan to'ldiriladi.
//
// ⚠️ MA'LUM QOLDIQ (alohida bosqich): portal_customers.password
// bulutda hali OCHIQ saqlanadi (eski dizayn). Bu darvoza uni hech
// bo'lmaganda javoblarda BERMAYDI; xeshlashga o'tish — keyingi ish.
// ════════════════════════════════════════════════════════════════

const crypto = require("crypto");

const SB_URL      = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET      = process.env.MERX_PORTAL_SECRET || "";

const H = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json"
});

// ── Supabase REST o'qish/yozish (service kalit bilan) ───────────
async function sb(path, opts) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: H(), ...(opts || {})
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`db ${r.status}: ${t.slice(0, 160)}`);
  }
  // 2026-08-10: "minimal" rejimda javob tanasi BO'SH keladi (201/204) —
  // bo'sh tanani JSON deb o'qish "bron yozildi-yu, xato ko'rindi"
  // jumbog'ini berardi (jonli sinov). Endi bo'sh tana = null.
  if (r.status === 204) return null;
  const t = await r.text();
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) { return null; }
}

// ── Chipta (HMAC imzoli, serverda saqlanmaydi) ──────────────────
const b64u = (s) => Buffer.from(s).toString("base64url");
const sign = (p) => crypto.createHmac("sha256", SECRET).update(p).digest("hex");

function ticketMake(shopId, customerId, phone, rowId) {
  const p = b64u(JSON.stringify({
    v: 1, s: shopId, c: customerId, p: phone, i: rowId,
    exp: Date.now() + 30 * 24 * 3600 * 1000
  }));
  return p + "." + sign(p);
}
function ticketRead(t) {
  if (!t || typeof t !== "string" || !t.includes(".")) return null;
  const [p, sig] = t.split(".");
  const ok = (() => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(sign(p), "hex"), Buffer.from(sig || "", "hex"));
    } catch (e) { return false; }
  })();
  if (!ok) return null;
  try {
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    if (!d || d.v !== 1 || !d.s || !d.c) return null;
    if (Date.now() > (d.exp || 0)) return { expired: true };
    return d;
  } catch (e) { return null; }
}

// ── XAVFSIZ maydon xaritalari ───────────────────────────────────
// Tovar: tannarx/yetkazuvchi CHIQMAYDI. UI'ga yangi maydon kerak
// bo'lsa shu ro'yxatga bitta qator qo'shiladi.
function safeProduct(p) {
  return {
    sku: p.sku, art: p.art || null, name: p.name,
    category: p.category || null,
    // ⚠️ 2026-08-10: PORTAL NARXI = ULGURJI → bo'lmasa chakana.
    // Ilovada ikkita narx bor: `ulgurji` (ulgurjiNarx) va `price_uzs`
    // (chakana). Portal mijozlari — ulgurji xaridorlar; avval faqat
    // chakana o'qilardi — ulgurji do'konlarda u bo'sh, narx 0 chiqardi
    // (jonli sinov 2026-08-10). Maxsus `portal_price` baribir ustun
    // (mijoz.html getPrice shunday).
    price_uzs: p.ulgurji || p.price_uzs || 0,
    ulgurji:   p.ulgurji || 0,      // kelajak UI uchun alohida ham beriladi
    chakana:   p.price_uzs || 0,
    image: p.image || p.img || null,
    qty: p.qty || 0,
    variants: Array.isArray(p.variants)
      ? p.variants.map(v => ({
          color: v.color || "", size: v.size || "", qty: v.qty || 0 }))
      : (typeof p.variants === "string"
          ? (() => { try { return JSON.parse(p.variants).map(v => ({
              color: v.color || "", size: v.size || "", qty: v.qty || 0 })); }
            catch (e) { return []; } })()
          : [])
  };
}
// Sotuv: item ichidagi TANNARX (costUzs) olib tashlanadi; SKU
// ataylab QOLADI (⚓ kelajak ilgagi №2 — Dona importi).
function safeSale(row) {
  let d = row.data;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { d = null; } }
  d = d || {};
  const items = Array.isArray(d.items) ? d.items.map(it => ({
    sku: it.sku || null, name: it.name || "",
    color: it.color || "", size: it.size || "",
    qty: it.qty || 0, price: it.price || 0
  })) : [];
  return {
    id: row.id,
    chekNum: d.chekNum || row.chek_num || row.id,
    date: row.date || d.date || null,
    status: row.status || d.status || "",
    total: row.total ?? d.total ?? 0,
    paid: row.paid ?? d.paid ?? 0,
    remaining: row.remaining ?? d.remaining ?? 0,
    payType: d.payType || row.pay_type || null,
    items
  };
}

const esc = (s) => encodeURIComponent(String(s));

// ════════════════════════════════════════════════════════════════
module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "POST kerak" });
  if (!SB_URL || !SERVICE_KEY)
    return res.status(500).json({ ok: false, error: "Server sozlanmagan (Supabase env)" });
  if (!SECRET)
    return res.status(500).json({ ok: false,
      error: "Server sozlanmagan: Vercel ENV'da MERX_PORTAL_SECRET o'rnating" });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); }
  catch (e) { return res.status(400).json({ ok: false, error: "invalid_json" }); }
  const act = String(body.action || "");

  try {
    // ── 1. CONFIG — kirishgacha: do'kon nomi (+ promo o'rni) ─────
    if (act === "config") {
      const sid = String(body.shopId || "");
      if (!sid) return res.status(400).json({ ok: false, error: "shopId kerak" });
      const s = await sb(`settings?shop_id=eq.${esc(sid)}&select=shop_name&limit=1`);
      return res.status(200).json({ ok: true,
        shopName: s?.[0]?.shop_name || "MERX",
        promo: null   // ⚓ ilgak №3: marketing/reklama shu yerdan keladi
      });
    }

    // ── 2. LOGIN — telefon+parol → chipta ────────────────────────
    if (act === "login") {
      const sid = String(body.shopId || "");
      const ph  = String(body.phone || "").replace(/\s/g, "");
      const pw  = String(body.pass || "");
      if (!sid || !ph || !pw)
        return res.status(400).json({ ok: false, error: "Telefon va parol kiriting" });
      const rows = await sb(
        `portal_customers?shop_id=eq.${esc(sid)}&phone=eq.${esc(ph)}` +
        `&password=eq.${esc(pw)}&is_active=eq.true&select=*&limit=1`);
      if (!rows?.length)
        return res.status(200).json({ ok: false, error: "Telefon yoki parol noto'g'ri" });
      const row = rows[0];
      let nm = ph;
      try {
        const sd = await sb(`sales?shop_id=eq.${esc(sid)}` +
          `&customer_id=eq.${esc(row.customer_id)}&select=customer_name&limit=1`);
        if (sd?.[0]?.customer_name) nm = sd[0].customer_name;
      } catch (e) {}
      const st = await sb(`settings?shop_id=eq.${esc(sid)}&select=shop_name&limit=1`)
        .catch(() => null);
      return res.status(200).json({ ok: true,
        ticket: ticketMake(sid, row.customer_id, ph, row.id),
        customerId: row.customer_id, customerName: nm, phone: ph,
        loyaltyPoints: row.loyalty_points || 0,
        birthday: row.birthday || "",
        loyaltyRate: row.loyalty_rate || 0,
        shopName: st?.[0]?.shop_name || "MERX",
        promo: null
      });
    }

    // ── Qolgan amallar CHIPTA talab qiladi ───────────────────────
    const tk = ticketRead(body.ticket);
    if (!tk)          return res.status(401).json({ ok: false, error: "Chipta noto'g'ri" });
    if (tk.expired)   return res.status(401).json({ ok: false, error: "expired" });
    const SID = tk.s, CID = tk.c;   // faqat chiptadan — so'rovdagiga ishonilmaydi

    // ── 3. KATALOG ───────────────────────────────────────────────
    if (act === "catalog") {
      const [pr, pp] = await Promise.all([
        sb(`products?shop_id=eq.${esc(SID)}&select=*`),
        sb(`portal_products?shop_id=eq.${esc(SID)}&select=*`).catch(() => [])
      ]);
      return res.status(200).json({ ok: true,
        products: (pr || []).map(safeProduct),
        portal:   pp || []
      });
    }

    // ── 4. XARIDLARIM ────────────────────────────────────────────
    if (act === "mysales") {
      const rows = await sb(`sales?shop_id=eq.${esc(SID)}` +
        `&customer_id=eq.${esc(CID)}&select=*&order=date.desc&limit=300`);
      return res.status(200).json({ ok: true, sales: (rows || []).map(safeSale) });
    }

    // ── 5. BRONLAR ───────────────────────────────────────────────
    if (act === "bookings") {
      const rows = await sb(`portal_bookings?shop_id=eq.${esc(SID)}` +
        `&customer_id=eq.${esc(CID)}&select=*&order=created_at.desc&limit=50`);
      return res.status(200).json({ ok: true, bookings: rows || [] });
    }

    if (act === "booking_new") {
      const sku = String(body.sku || "");
      const qty = Math.max(1, Math.min(999, parseInt(body.qty, 10) || 1));
      if (!sku) return res.status(400).json({ ok: false, error: "sku kerak" });
      // Nomni serverning o'zi topadi — klient yuborganiga ishonilmaydi
      const p = await sb(`products?shop_id=eq.${esc(SID)}` +
        `&sku=eq.${esc(sku)}&select=name&limit=1`);
      const nomi = p?.[0]?.name || String(body.product_name || "").slice(0, 120) || sku;
      await sb(`portal_bookings`, {
        method: "POST",
        headers: { ...H(), Prefer: "return=minimal" },
        body: JSON.stringify({
          id: SID + "_b_" + Date.now(),
          shop_id: SID, customer_id: CID,
          sku, product_name: nomi,
          color: String(body.color || "").slice(0, 40),
          size:  String(body.size  || "").slice(0, 40),
          qty,
          note: body.note ? String(body.note).slice(0, 300) : null,
          status: "kutilmoqda"
        })
      });
      return res.status(200).json({ ok: true });
    }

    if (act === "booking_cancel") {
      const id = String(body.id || "");
      if (!id) return res.status(400).json({ ok: false, error: "id kerak" });
      // ⚠️ EGALIK sharti: faqat O'Z broni (avval bu tekshiruv YO'Q edi)
      await sb(`portal_bookings?id=eq.${esc(id)}` +
        `&shop_id=eq.${esc(SID)}&customer_id=eq.${esc(CID)}`, {
        method: "PATCH",
        headers: { ...H(), Prefer: "return=minimal" },
        body: JSON.stringify({ status: "bekor" })
      });
      return res.status(200).json({ ok: true });
    }

    // ⚓ ilgak №1: kelajak amallari shu yerga qo'shiladi
    // (masalan `my_import` — MERX Dona katalog importi).

    return res.status(400).json({ ok: false, error: "Noma'lum amal: " + act });
  } catch (e) {
    console.error("[mijoz]", act, e.message);
    return res.status(200).json({ ok: false, error: "Server xatosi: " + e.message });
  }
};
