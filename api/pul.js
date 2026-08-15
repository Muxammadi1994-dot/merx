// ════════════════════════════════════════════════════════════════
// MERX — api/pul.js  ·  PUL AMALLARI SERVER DARVOZASI  ·  2026-08-13
// ════════════════════════════════════════════════════════════════
//
// NIMA UCHUN: hozirgacha qarz to'lovini KASSA o'zi yozardi —
// o'z lokal ma'lumotidan qoldiqni hisoblab, chek raqamini o'zi
// berib, keyin bulutga itarardi. Oqibatlari (13-avgust, jonli):
//   · kassa eskirgan qoldiqni ko'rib chekka noto'g'ri "edi/qoldi"
//     muhrladi (Baxtiyor aka, Umirbek aka);
//   · ikki kassa bir raqam berdi (CHK/PAY takrorlari);
//   · pull yozuvni bosib, sotuv YO'QOLDI.
//
// YECHIM: qarz to'lovini SERVER yozadi.
//   1) Kassa "men ko'rgan qoldiq — X" deb yuboradi;
//   2) Server BULUTDAN haqiqiy qoldiqni hisoblaydi;
//   3) Mos kelmasa — RAD ETADI va to'g'ri raqamni qaytaradi;
//   4) Mos kelsa — yozadi, CHEK RAQAMINI O'ZI beradi va
//      muhrlangan debtBefore/debtAfter ni qaytaradi.
// Shu bilan: eskirgan qoldiq, raqam to'qnashuvi va yo'qolish
// MEXANIZM darajasida mumkin emas.
//
// ⚠️ §3.5: debtBefore/debtAfter MUHRLANADI — chek faqat o'qiydi.
// ⚠️ Bu darvoza FAQAT yozadi; hisobot/ko'rsatish lokal qoladi.
// ════════════════════════════════════════════════════════════════

const SB_URL      = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const H = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json"
});

// Toshkent sanasi (§4.6 — server UTC da ishlaydi)
const TZ = 5 * 60;
const tashDate = () => new Date(Date.now() + TZ * 60000).toISOString().slice(0, 10);
const tashTime = () => new Date(Date.now() + TZ * 60000).toISOString().slice(11, 16);

async function sbAll(path) {
  const out = [];
  for (let p = 0; p < 30; p++) {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${SB_URL}/rest/v1/${path}${sep}limit=1000&offset=${p * 1000}`,
                          { headers: H() });
    // 🔴 2026-08-13: XATO JIM YUTILMAYDI. Avval `if (!r.ok) break`
    // edi \u2014 so'rov rad etilsa (masalan mavjud bo'lmagan ustun so'ralsa)
    // funksiya BO'SH ro'yxat qaytarardi va server "qarz = 0" deb
    // hisoblardi. Bu \u2014 pul mantiqida eng xavfli xato turi.
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error("db " + r.status + ": " + t.slice(0, 200));
    }
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// ⚡ 2026-08-13 TEZLIK: token ikki bosqichda.
//   (a) shop_id JWT ichidan O'QILADI — tarmoqsiz, darhol (so'rovlarni
//       shu bilan boshlaymiz);
//   (b) tokenning HAQIQIYLIGI Supabase'da tekshiriladi — lekin
//       PARALLEL, so'rovlar bilan bir vaqtda. Yozishdan OLDIN javob
//       kutiladi: soxta token bilan hech narsa yozilmaydi.
// Avval (b) ketma-ket edi va har to'lovga ~250-350 ms qo'shardi.
function shopFromJwt(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    const d = JSON.parse(json);
    return (d && d.user_metadata && d.user_metadata.shop_id) || null;
  } catch (e) { return null; }
}
async function verifyToken(token, shopId) {
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return false;
    const u = await r.json();
    return !!(u && u.user_metadata && u.user_metadata.shop_id === shopId);
  } catch (e) { return false; }
}

// Sotuvning JORIY qoldig'i — muzlatilgan asl qiymatdan faol
// to'lovlar ayiriladi (ilovadagi calcSaleState bilan bir xil mantiq)
function saleState(sale, pays) {
  // ⚡ 2026-08-13 TEZLIK: qiymatlar USTUNLARDAN — `data` JSON (ichida
  // butun tovarlar ro'yxati) endi umuman tortilmaydi.
  const isUsd = sale.debt_currency === "usd";
  const origRem = Number(sale.orig_remaining != null ? sale.orig_remaining : sale.remaining) || 0;
  const origUsd = Number(sale.orig_debt_usd  != null ? sale.orig_debt_usd  : sale.debt_usd)  || 0;
  let paidUzs = 0, paidUsd = 0;
  pays.forEach(p => {
    const pd = p.data || {};
    if (pd.cancelled === true || pd.cancelled === "true") return;
    (pd.allocations || []).forEach(a => {
      if (String(a.saleId) !== String(sale.id)) return;
      if (a.currency === "usd") paidUsd += Number(a.amount) || 0;
      else                      paidUzs += Number(a.amount) || 0;
    });
  });
  return {
    isUsd,
    remaining: Math.max(0, origRem - paidUzs),
    debtUsd:   Math.max(0, origUsd - paidUsd)
  };
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "POST kerak" });
  if (!SB_URL || !SERVICE_KEY)
    return res.status(500).json({ ok: false, error: "Server sozlanmagan" });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); }
  catch (e) { return res.status(400).json({ ok: false, error: "invalid_json" }); }

  const action = String(body.action || "");
  const token  = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const shopId = shopFromJwt(token);
  if (!shopId)
    return res.status(401).json({ ok: false, error: "Token yaroqsiz — qayta kiring" });
  // Haqiqiylik tekshiruvi PARALLEL boshlanadi, yozishdan oldin kutiladi
  const _verify = verifyToken(token, shopId);

  try {
    // ── QARZ TO'LOVI ──────────────────────────────────────────
    if (action === "pay") {
      const custId  = String(body.customerId || "");
      const amount  = Number(body.amount) || 0;
      const cur     = body.currency === "usd" ? "usd" : "uzs";
      const seen    = Number(body.seenDebt);      // kassa ko'rgan qoldiq
      const devCode = String(body.device || "??").slice(0, 4);
      if (!custId || amount <= 0)
        return res.status(400).json({ ok: false, error: "Mijoz va summa kerak" });

      // 1) BULUTDAN haqiqiy holat
      // ⚡ TEZLIK: (a) `data` JSON tortilmaydi; (b) faqat QARZI BOR
      // sotuvlar; (c) kunlik chek-raqami PARALLEL olinadi.
      const _t0 = Date.now();
      // \u26a0\ufe0f `cancelled` USTUN EMAS (u data JSON ichida) \u2014 so'rovga
      // qo'shilsa baza butun so'rovni rad etadi. Bekor qilingan sotuv
      // `status = "bekor"` bo'ladi, shuni ishlatamiz.
      const SALE_COLS = "id,date,status,remaining,debt_usd,debt_currency," +
                        "orig_remaining,orig_debt_usd";
      const [sales, pays, kunlik] = await Promise.all([
        sbAll(`sales?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&customer_id=eq.${encodeURIComponent(custId)}` +
              `&or=(remaining.gt.0,debt_usd.gt.0)&select=${SALE_COLS}`),
        sbAll(`debt_payments?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&customer_id=eq.${encodeURIComponent(custId)}&select=id,amount,currency,data`),
        sbAll(`debt_payments?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&date=eq.${tashDate()}&select=data`)
      ]);
      const ochiq = sales
        .filter(s => {
          if (s.status === "bekor" || s.status === "qaytarilgan") return false;
          // \U0001f534 2026-08-14: SOTUV VALYUTASI bo'yicha ajratiladi.
          // Avval ajratilmasdi — DOLLAR qarzli sotuvning so'mdagi
          // qiymati ham so'm-qarzga qo'shilardi. Jonli (B20, Shaboz aka
          // 8669): 51 900 000 so'm + $2100 → server "77 100 000" dedi
          // va to'lovni RAD ETDI.
          const _isU = (s.debt_currency === "usd");
          if (cur === "usd" ? !_isU : _isU) return false;
          const st = saleState(s, pays);
          return cur === "usd" ? st.debtUsd > 0.005 : st.remaining > 0.5;
        })
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

      const haqiqiy = ochiq.reduce((n, s) => {
        const st = saleState(s, pays);
        return n + (cur === "usd" ? st.debtUsd : st.remaining);
      }, 0);

      // 2) KASSA KO'RGANI bilan solishtirish
      const eps = cur === "usd" ? 0.02 : 100;
      if (Number.isFinite(seen) && Math.abs(seen - haqiqiy) > eps) {
        return res.status(200).json({
          ok: false, code: "stale",
          error: "Qarz qoldig'i o'zgargan — qayta ko'ring",
          seen, actual: Math.round(haqiqiy * 100) / 100
        });
      }
      if (amount > haqiqiy + eps) {
        return res.status(200).json({
          ok: false, code: "over",
          error: "Qarzdan ortiq to'lov",
          actual: Math.round(haqiqiy * 100) / 100
        });
      }

      // 3) CHEK RAQAMI — serverda, to'qnashuvsiz
      const dp = tashDate().replace(/-/g, "");
      let mx = 0;
      kunlik.forEach(p => {
        const m = /^PAY-\d{8}-(\d+)/.exec(String((p.data || {}).chekNum || ""));
        if (m) { const n = parseInt(m[1], 10) || 0; if (n > mx) mx = n; }
      });
      const chekNum = `PAY-${dp}-${String(mx + 1).padStart(4, "0")}-${devCode}`;

      // 4) TAQSIMLASH (eng eskidan)
      let qoldi = amount;
      const allocations = [];
      for (const s of ochiq) {
        if (qoldi <= (cur === "usd" ? 0.005 : 0.5)) break;
        const st = saleState(s, pays);
        const bor = cur === "usd" ? st.debtUsd : st.remaining;
        const ber = Math.min(bor, qoldi);
        const after = Math.round((bor - ber) * 100) / 100;
        allocations.push({
          saleId: s.id, saleDate: s.date,
          chekNum: "#" + s.id,
          amount: Math.round(ber * 100) / 100, currency: cur,
          fullyPaid: after <= (cur === "usd" ? 0.005 : 0.5),
          remainingAfter: after
        });
        qoldi -= ber;
      }

      // ⚠️ Yozishdan OLDIN token haqiqiyligi tasdiqlanadi
      if (!(await _verify))
        return res.status(401).json({ ok: false, error: "Token yaroqsiz — qayta kiring" });

      // 5) YOZISH — muhrlar SERVERDA qo'yiladi
      const now = Date.now();
      const rec = {
        id: String(now), shop_id: shopId, customer_id: custId,
        date: tashDate(), amount: Math.round(amount * 100) / 100,
        currency: cur,
        data: {
          id: String(now), chekNum,
          date: tashDate(), time: tashTime(),
          customerId: custId, customerName: body.customerName || "",
          customerPhone: body.customerPhone || "",
          staffId: body.staffId || null,
          amount: Math.round(amount * 100) / 100,
          amountSom: body.amountSom || null,
          currency: cur, method: body.method || "naqd",
          methodBreakdown: body.methodBreakdown || null,
          rate: body.rate || null,
          allocations,
          // ⚠️ §3.5 MUHR — serverning haqiqiy hisobidan
          debtBefore: Math.round(haqiqiy * 100) / 100,
          debtAfter:  Math.round((haqiqiy - amount) * 100) / 100,
          createdTs: now,
          updatedAt: new Date().toISOString(),
          serverWritten: true          // kelib chiqishi ko'rinib tursin
        },
        updated_at: new Date().toISOString()
      };
      const w = await fetch(`${SB_URL}/rest/v1/debt_payments`, {
        method: "POST",
        headers: { ...H(), Prefer: "return=minimal" },
        body: JSON.stringify(rec)
      });
      if (!w.ok) {
        const t = await w.text().catch(() => "");
        return res.status(200).json({ ok: false, error: "Yozib bo'lmadi: " + t.slice(0, 150) });
      }
      return res.status(200).json({ ok: true, payment: rec.data,
        ms: Date.now() - _t0 });
    }

    // ── SOTUV (B3, 2026-08-13) ────────────────────────────────
    // Nima uchun: 13-avgust voqeasi — kassa chek raqamini O'ZI berardi
    // va sotuvni o'ziga yozardi. Pull kelganda yuborilmagan sotuv
    // YO'QOLDI, keyingi sotuv esa AYNAN O'SHA raqamni oldi
    // (CHK-20260813-0009-BK ikki sotuvda). Endi: raqamni SERVER beradi
    // va sotuvni SERVER yozadi — ikkalasi ham mumkin emas.
    // ⚠️ Tovar qoldig'i hozircha lokal hisoblanadi (C-bosqich).
    if (action === "sale") {
      const sale = body.sale || {};
      const devCode = String(body.device || "??").slice(0, 4);
      if (!sale || !Array.isArray(sale.items) || !sale.items.length)
        return res.status(400).json({ ok: false, error: "Bo'sh sotuv" });

      // 1) CHEK RAQAMI — serverda, to'qnashuvsiz
      const dp = tashDate().replace(/-/g, "");
      const kunlik = await sbAll(
        `sales?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&date=eq.${tashDate()}&select=chek_num`);
      let mx = 0;
      kunlik.forEach(r => {
        const m = new RegExp("^CHK-" + dp + "-(\\d+)-" + devCode + "$")
                    .exec(String(r.chek_num || ""));
        if (m) { const n = parseInt(m[1], 10) || 0; if (n > mx) mx = n; }
      });
      const chekNum = `CHK-${dp}-${String(mx + 1).padStart(4, "0")}-${devCode}`;

      // 2) \u2705 C-BOSQICH (2026-08-14): QOLDIQ \u2014 ATOMAR (X18).
      // Bazadagi `merx_sell` funksiyasi tovar qatorini QULFLAB
      // tekshiradi VA ayiradi \u2014 bitta amalda. Ikki kassa bir soniyada
      // sotsa, ikkinchisi birinchisi tugaguncha KUTADI va yangilangan
      // qoldiqni ko'radi. Avval server faqat tekshirardi, ayirish esa
      // lokalda edi \u2014 ikkalasi ham "13 bor" deb o'tib ketardi.
      const _talab = [];
      {
        const yigin = new Map();
        (sale.items || []).forEach(it => {
          if (!it || !it.sku) return;
          const k = String(it.sku) + "|" + (it.color || "") + "|" + (it.size || "");
          yigin.set(k, (yigin.get(k) || 0) + (Number(it.qty) || 0));
        });
        for (const [k, qty] of yigin) {
          const [sku, color, size] = k.split("|");
          _talab.push({ sku, color, size, qty });
        }
      }
      if (_talab.length) {
        const rq = await fetch(`${SB_URL}/rest/v1/rpc/merx_sell`, {
          method: "POST", headers: H(),
          body: JSON.stringify({ p_shop: shopId, p_items: _talab })
        });
        if (!rq.ok) {
          const t = await rq.text().catch(() => "");
          console.error("[pul] merx_sell:", rq.status, t.slice(0, 200));
          return res.status(200).json({ ok: false,
            error: "Qoldiq tekshiruvi ishlamadi: " + t.slice(0, 120) });
        }
        const rj = await rq.json().catch(() => null);
        if (rj && rj.ok === false) {
          return res.status(200).json({
            ok: false, code: "stock", error: "Qoldiq yetmaydi",
            items: rj.items || []
          });
        }
      }

      // 3) Token haqiqiyligi (yozishdan oldin)
      if (!(await _verify))
        return res.status(401).json({ ok: false, error: "Token yaroqsiz — qayta kiring" });

      // 3) YOZISH — id ham serverda
      const now = Date.now();
      const items = sale.items.map(({ image, ...rest }) => rest);
      const d = { ...sale, id: String(now), chekNum, items,
                  updatedAt: new Date().toISOString(), serverWritten: true };
      const rec = {
        shop_id: shopId, id: String(now), chek_num: chekNum,
        date: sale.date || tashDate(), time: sale.time || tashTime(),
        price_type: sale.priceType || null, pay_type: sale.payType || null,
        pay_breakdown: sale.payBreakdown || null,
        items, total: sale.total || 0, paid: sale.paid || 0,
        remaining: sale.remaining != null ? sale.remaining : 0,
        due: sale.due || null,
        customer_id: sale.customerId || null,
        customer_name: sale.customerName || null,
        customer_phone: sale.customerPhone || null,
        staff_id: sale.staffId || null,
        status: sale.status || null,
        debt_currency: sale.debtCurrency || "uzs",
        debt_usd: sale.debtUsd != null ? sale.debtUsd : null,
        orig_paid: sale.origPaid != null ? sale.origPaid : (sale.paid || 0),
        orig_remaining: sale.origRemaining != null ? sale.origRemaining
                        : (sale.remaining != null ? sale.remaining : 0),
        orig_debt_usd: sale.origDebtUsd != null ? sale.origDebtUsd : null,
        ...(sale.discount != null ? { discount: sale.discount } : {}),
        ...(sale.subtotal != null ? { subtotal: sale.subtotal } : {}),
        data: d,
        updated_at: new Date().toISOString()
      };
      const w = await fetch(`${SB_URL}/rest/v1/sales`, {
        method: "POST",
        headers: { ...H(), Prefer: "return=minimal" },
        body: JSON.stringify(rec)
      });
      if (!w.ok) {
        const t = await w.text().catch(() => "");
        return res.status(200).json({ ok: false, error: "Yozib bo'lmadi: " + t.slice(0, 150) });
      }
      // \U0001f534 2026-08-14: YANGI QOLDIQ qaytariladi — kassa aynan
      // shuni qo'yadi. Avval kassa lokal qoldiqni ESKI holatiga
      // tiklardi va o'sha eski son keyingi sinxronda bulutga qaytib
      // yozilardi — serverning ayirgani BEKOR bo'lardi
      // ("katalogdan tovar ayrilmayapti", 14-avgust jonli).
      let _prods = [];
      try {
        const _sk = [...new Set((sale.items || []).map(i => String(i.sku || "")).filter(Boolean))];
        if (_sk.length) {
          const _in = _sk.map(x => '"' + x.replace(/"/g, "") + '"').join(",");
          _prods = await sbAll(
            `products?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&sku=in.(${encodeURIComponent(_in)})&select=sku,variants`);
        }
      } catch (e) {}
      return res.status(200).json({ ok: true, sale: d, products: _prods });
    }

    // ── BEKOR QILISH (3-band, 2026-08-14) ─────────────────────
    // Nima uchun: sotuv SERVERDA yoziladi, bekor qilish esa LOKALDA
    // edi \u2014 ya'ni "bekor qilingan-qilinmagan" holati kassalar orasida
    // vaqtincha HAR XIL bo'lardi (Nuriddin voqeasining ildizi:
    // bir kassada atkaz, bulutda hali faol \u2192 chekda $640 farq).
    // Endi bekor qilishni ham SERVER yozadi \u2014 holat bitta.
    if (action === "cancel") {
      const tur = String(body.tur || "");      // "sale" | "payment"
      const id  = String(body.id || "");
      if (!id || !["sale", "payment"].includes(tur))
        return res.status(400).json({ ok: false, error: "tur va id kerak" });
      if (!(await _verify))
        return res.status(401).json({ ok: false, error: "Token yaroqsiz \u2014 qayta kiring" });

      const jadval = tur === "sale" ? "sales" : "debt_payments";
      const cur = await sbAll(
        `${jadval}?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&id=eq.${encodeURIComponent(id)}&select=id,data`);
      if (!cur.length)
        return res.status(200).json({ ok: false, error: "Yozuv bulutda topilmadi" });

      const d0 = cur[0].data || {};
      if (d0.cancelled === true || d0.cancelled === "true")
        return res.status(200).json({ ok: true, already: true, data: d0 });

      const d = { ...d0,
        cancelled: true,
        cancelledAt: tashDate() + " " + tashTime(),
        cancelledBy: body.by || "",
        cancelReason: body.reason || "",
        updatedAt: new Date().toISOString(),
        serverCancelled: true
      };
      // ✅ 2026-08-16 (X21 darsi): "bekor" muhri JSON varag'iga HAM.
      // Avval faqat ustunlarga yozilardi; kassa esa sotuvni JSONdan
      // o'qiydi va keyingi push'da eski "qarz"ni ustunlarga qaytarib
      // yozardi — server bilan kassa kelisha olmasdi
      // (CHK-20260815-0020-DW voqeasi, farq $83.77).
      if (tur === "sale") { d.status = "bekor"; d.remaining = 0; }
      const patch = { data: d, updated_at: new Date().toISOString() };
      if (tur === "sale") { patch.status = "bekor"; patch.remaining = 0; }

      const w = await fetch(
        `${SB_URL}/rest/v1/${jadval}?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&id=eq.${encodeURIComponent(id)}`,
        { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" },
          body: JSON.stringify(patch) });
      if (!w.ok) {
        const t = await w.text().catch(() => "");
        return res.status(200).json({ ok: false, error: "Bekor qilinmadi: " + t.slice(0, 150) });
      }
      return res.status(200).json({ ok: true, data: d });
    }

    // ── QAYTARISH: tovarni omborga qaytarish (3-band) ─────────
    // Qaytarishda qoldiq OSHADI \u2014 uni ham server qulf bilan qiladi
    // (sotuvdagi `merx_sell` ning teskarisi: manfiy son beriladi).
    if (action === "restock") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return res.status(400).json({ ok: false, error: "items kerak" });
      if (!(await _verify))
        return res.status(401).json({ ok: false, error: "Token yaroqsiz" });
      const talab = items.map(it => ({
        sku: String(it.sku || ""), color: it.color || "", size: it.size || "",
        qty: -Math.abs(Number(it.qty) || 0)      // MANFIY \u2192 qoldiq oshadi
      })).filter(x => x.sku && x.qty);
      if (!talab.length) return res.status(200).json({ ok: true });
      const rq = await fetch(`${SB_URL}/rest/v1/rpc/merx_sell`, {
        method: "POST", headers: H(),
        body: JSON.stringify({ p_shop: shopId, p_items: talab })
      });
      if (!rq.ok) {
        const t = await rq.text().catch(() => "");
        return res.status(200).json({ ok: false, error: "Qaytarilmadi: " + t.slice(0, 120) });
      }
      return res.status(200).json({ ok: true });
    }

    // ── OMBOR AMALI (5-band, 2026-08-14) ──────────────────────
    // Kirim, chiqim, rang qo'shish, qoldiq tahriri, inventarizatsiya \u2014
    // hammasi qoldiqni o'zgartiradi. Sotuvdagi kabi QULF bilan
    // bajariladi va YANGI QOLDIQ qaytariladi \u2014 kassa uni qo'yadi,
    // shunda "ikki marta qo'shildi" holati bo'lmaydi.
    // items[].qty: MUSBAT = ayiriladi, MANFIY = qo'shiladi.
    if (action === "stock") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return res.status(400).json({ ok: false, error: "items kerak" });
      if (!(await _verify))
        return res.status(401).json({ ok: false, error: "Token yaroqsiz" });

      const talab = items.map(it => ({
        sku: String(it.sku || ""), color: it.color || "", size: it.size || "",
        qty: Number(it.qty) || 0
      })).filter(x => x.sku && x.qty);
      if (!talab.length) return res.status(200).json({ ok: true, products: [] });

      const rq = await fetch(`${SB_URL}/rest/v1/rpc/merx_sell`, {
        method: "POST", headers: H(),
        body: JSON.stringify({ p_shop: shopId, p_items: talab })
      });
      if (!rq.ok) {
        const t = await rq.text().catch(() => "");
        return res.status(200).json({ ok: false, error: "Ombor amali bajarilmadi: " + t.slice(0, 120) });
      }
      const rj = await rq.json().catch(() => null);
      if (rj && rj.ok === false)
        return res.status(200).json({ ok: false, code: "stock", error: "Qoldiq yetmaydi", items: rj.items || [] });

      // Yangi qoldiqni qaytaramiz \u2014 kassa shuni qo'yadi
      const skus = [...new Set(talab.map(x => x.sku))];
      const inList = skus.map(x => '"' + x.replace(/"/g, "") + '"').join(",");
      const prods = await sbAll(
        `products?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&sku=in.(${encodeURIComponent(inList)})&select=sku,variants`);
      return res.status(200).json({ ok: true, products: prods });
    }

    // ── SOZLAMA O'ZGARTIRISH (4-band, 2026-08-14) ─────────────
    // Nima uchun: sozlama qatori BUTUNLAY qayta yozilardi \u2014 qurilma
    // o'z nusxasini yuborganda boshqa kassa yangilagan maydonlar
    // BOSILIB ketardi (chek shiori yo'qolishi; `server_pay` false
    // bo'lib qolishi). Endi: server FAQAT berilgan maydonlarni
    // qulf ostida QO'SHADI (merge), qolganiga tegmaydi.
    if (action === "settings") {
      const patch = body.patch && typeof body.patch === "object" ? body.patch : null;
      if (!patch || !Object.keys(patch).length)
        return res.status(400).json({ ok: false, error: "patch kerak" });
      if (!(await _verify))
        return res.status(401).json({ ok: false, error: "Token yaroqsiz" });

      // Faqat RUXSAT ETILGAN ustunlar (begona maydon yozilmasin)
      const RUXSAT = new Set([
        "rate", "rate_mode", "rate_updated_at", "price_currency", "show_chakana",
        "shop_name", "shop_type", "owner_name",
        "chek_config", "debt_cols", "debt_pay_methods_shown",
        "unit_tags", "pack_unit_tags", "exp_tags_kunlik", "exp_tags_oylik",
        "low_stock_limit", "pos_pay_blocked", "pos_staff_locked",
        "loyalty_rate", "loyalty_value",
        "eskiz_token", "eskiz_sender", "telegram_bot", "telegram_bot_username",
        "staff_group_id", "ext_services", "server_pay"
      ]);
      const toza = {};
      for (const k in patch) if (RUXSAT.has(k)) toza[k] = patch[k];
      if (!Object.keys(toza).length)
        return res.status(400).json({ ok: false, error: "Ruxsat etilgan maydon yo'q" });
      toza.updated_at = new Date().toISOString();

      const w = await fetch(
        `${SB_URL}/rest/v1/settings?shop_id=eq.${encodeURIComponent(shopId)}`,
        { method: "PATCH", headers: { ...H(), Prefer: "return=representation" },
          body: JSON.stringify(toza) });
      if (!w.ok) {
        const t = await w.text().catch(() => "");
        return res.status(200).json({ ok: false, error: "Saqlanmadi: " + t.slice(0, 150) });
      }
      const rows = await w.json().catch(() => []);
      return res.status(200).json({ ok: true, settings: rows[0] || null });
    }

    // ── QOLDIQNI SO'RASH (oyna ochilganda) ────────────────────
    if (action === "debt") {
      const custId = String(body.customerId || "");
      if (!custId) return res.status(400).json({ ok: false, error: "customerId kerak" });
      const [sales, pays] = await Promise.all([
        sbAll(`sales?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&customer_id=eq.${encodeURIComponent(custId)}` +
              `&or=(remaining.gt.0,debt_usd.gt.0)` +
              `&select=id,date,status,remaining,debt_usd,debt_currency,orig_remaining,orig_debt_usd`),
        sbAll(`debt_payments?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&customer_id=eq.${encodeURIComponent(custId)}&select=id,amount,currency,data`)
      ]);
      let uzs = 0, usd = 0;
      sales.forEach(s => {
        if (s.status === "bekor" || s.status === "qaytarilgan") return;
        // 2026-08-14: valyuta bo'yicha ajratiladi (yuqoridagi izoh)
        const st = saleState(s, pays);
        if (s.debt_currency === "usd") usd += st.debtUsd;
        else                            uzs += st.remaining;
      });
      return res.status(200).json({ ok: true,
        uzs: Math.round(uzs), usd: Math.round(usd * 100) / 100 });
    }

    return res.status(400).json({ ok: false, error: "Noma'lum amal: " + action });
  } catch (e) {
    console.error("[pul]", action, e.message);
    return res.status(200).json({ ok: false, error: "Server xatosi: " + e.message });
  }
};
