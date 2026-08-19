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
      // ✅ 2026-08-16: `time` ham olinadi — teng sanani uzish uchun (quyida).
      const SALE_COLS = "id,date,time,status,remaining,debt_usd,debt_currency," +
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
        .sort((a, b) =>
          String(a.date).localeCompare(String(b.date)) ||
          String(a.time || "").localeCompare(String(b.time || "")) ||
          ((Number(a.id) || 0) - (Number(b.id) || 0)));

      // ✅ 2026-08-16: BOSILGAN CHEK USTUVOR. Kassa qaysi chek ochilganini
      // yuboradi (saleId) — taqsimot AVVAL o'sha chekka, ortiqchasi
      // yuqoridagi tartibda davom etadi. Jonli isbot (B20, Abdulboqiy
      // aka, 16-avg): ikkala ESKI qarz bir sanada — server "boshqasini"
      // tanlab, sotuvchi 4 marta urinib 3 tasini atkaz qilgan.
      // Guruh to'lovida kassa eng eski chekni yuboradi — FIFO saqlanadi.
      // Eski kassalar saleId yubormaydi — tartib avvalgidek qoladi.
      const _ck = String(body.saleId || "");
      if (_ck) {
        const _ci = ochiq.findIndex(s => String(s.id) === _ck);
        if (_ci > 0) ochiq.unshift(ochiq.splice(_ci, 1)[0]);
      }

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

      // ✅ 2026-08-18 (4-paket): "UMUMIY QARZ" — SERVER MUHRI (§3.27).
      // Sotuv xabaridagi jami avval KASSADA hisoblanardi — qurilma
      // chala yuklangan payt mijozga noto'g'ri jami ketardi (Doston
      // hodisasi sinfi; eslatmalar 468 da yopilgan, sotuv xabari ochiq
      // edi). Endi server `debt` amalidagi AYNAN o'sha formulada
      // hisoblab, sotuvga muhrlaydi. Xato bo'lsa sotuv TO'XTAMAYDI —
      // kassa hisoblagani qoladi (oflayn/zaxira xulqi o'zgarmagan).
      // Bu nuqta sotuv YOZILISHIDAN OLDIN — yangi chek jami ichiga
      // qo'shilib ketmaydi.
      try {
        const _pdCid = String(sale.customerId || "");
        const _pdBor = (Number(sale.remaining) || 0) > 0 ||
                       (Number(sale.debtUsd)   || 0) > 0;
        if (_pdCid && _pdBor) {
          const [_pdS, _pdP] = await Promise.all([
            sbAll(`sales?shop_id=eq.${encodeURIComponent(shopId)}` +
                  `&customer_id=eq.${encodeURIComponent(_pdCid)}` +
                  `&or=(remaining.gt.0,debt_usd.gt.0)` +
                  `&select=id,date,status,remaining,debt_usd,debt_currency,orig_remaining,orig_debt_usd`),
            sbAll(`debt_payments?shop_id=eq.${encodeURIComponent(shopId)}` +
                  `&customer_id=eq.${encodeURIComponent(_pdCid)}&select=id,amount,currency,data`)
          ]);
          let _pdUzs = 0, _pdUsd = 0;
          _pdS.forEach(s2 => {
            if (s2.status === "bekor" || s2.status === "qaytarilgan") return;
            const st2 = saleState(s2, _pdP);
            if (s2.debt_currency === "usd") _pdUsd += st2.debtUsd;
            else                            _pdUzs += st2.remaining;
          });
          d.prevDebtUzs = Math.round(_pdUzs);
          d.prevDebtUsd = Math.round(_pdUsd * 100) / 100;
        }
      } catch (e) { console.warn("[pul] prevDebt muhri:", e.message); }
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

      // ✅ 2026-08-18 (2-sessiya): TAKROR-QULF (opKey, ixtiyoriy).
      // Oflayn sotuv tasdiqlashida javob yo'lda yo'qolsa, navbat qayta
      // uradi — qulfsiz qoldiq IKKI MARTA ayirilardi. Endi:
      // 1) avval `bot_sent` ga da'vo yoziladi (ignore-duplicates);
      // 2) allaqachon bor bo'lsa — merx_sell CHAQIRILMAYDI, joriy
      //    qoldiq qaytariladi (klient shu bilan tenglashadi);
      // 3) merx_sell YIQILSA — da'vo O'CHIRILADI (keyingi urinish
      //    to'silmasin). Jadval yo'q/xato bo'lsa — qulfsiz davom
      //    (fail-open): tasdiqlash to'xtamasin.
      const opKey = body.opKey ? String(body.opKey).slice(0, 120) : null;
      const _lockKey = opKey ? `stockq|${shopId}|${opKey}` : null;
      let _claimed = false;
      if (_lockKey) {
        try {
          const cr = await fetch(`${SB_URL}/rest/v1/bot_sent`, {
            method: "POST",
            headers: { ...H(), "Content-Type": "application/json",
                       Prefer: "resolution=ignore-duplicates,return=representation" },
            body: JSON.stringify({ key: _lockKey, ts: new Date().toISOString() })
          });
          if (cr.ok) {
            const cj = await cr.json().catch(() => []);
            if (Array.isArray(cj)) {
              if (cj.length > 0) _claimed = true;
              else {
                // Da'vo allaqachon bor — bu TAKROR so'rov
                const _sk = [...new Set(talab.map(x => x.sku))];
                const _il = _sk.map(x => '"' + x.replace(/"/g, "") + '"').join(",");
                const prods0 = await sbAll(
                  `products?shop_id=eq.${encodeURIComponent(shopId)}` +
                  `&sku=in.(${encodeURIComponent(_il)})&select=sku,variants`);
                return res.status(200).json({ ok: true, dup: true, products: prods0 });
              }
            }
          }
        } catch (e) { console.warn("[stock] opKey da'vosi:", e.message); }
      }
      const _unclaim = async () => {
        if (!_lockKey || !_claimed) return;
        try {
          await fetch(`${SB_URL}/rest/v1/bot_sent?key=eq.${encodeURIComponent(_lockKey)}`,
            { method: "DELETE", headers: H() });
        } catch (e) {}
      };

      const rq = await fetch(`${SB_URL}/rest/v1/rpc/merx_sell`, {
        method: "POST", headers: H(),
        body: JSON.stringify({ p_shop: shopId, p_items: talab })
      });
      if (!rq.ok) {
        const t = await rq.text().catch(() => "");
        await _unclaim();   // ✅ yiqildi — da'vo ochiladi
        return res.status(200).json({ ok: false, error: "Ombor amali bajarilmadi: " + t.slice(0, 120) });
      }
      const rj = await rq.json().catch(() => null);
      if (rj && rj.ok === false) {
        await _unclaim();   // ✅ qoldiq yetmadi — da'vo ochiladi
        return res.status(200).json({ ok: false, code: "stock", error: "Qoldiq yetmaydi", items: rj.items || [] });
      }

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

    // ═══════════════════════════════════════════════════════════════
    // ✅ 2026-08-19 (3-bosqich): MIJOZ VA XODIM YOZUVI SERVER ORQALI
    // ═══════════════════════════════════════════════════════════════
    // Ildiz (B20, 18-avg): uch xodim ABU SAXIY dan B20 ga NUSXALANDI —
    // bir xil id, bir xil ism, bir soniyada, PIN xeshisiz. Klient
    // pushida do'kon tekshiruvi faqat QURILMADA edi; qurilma esa
    // do'kon almashganda adashishi mumkin.
    // Endi yozuv shu darvozadan o'tadi:
    //  1) `shop_id` SERVERDA qo'yiladi (token egasidan) — begona
    //     do'konga yozib bo'lmaydi, klient nima yuborishidan qat'i nazar;
    //  2) YANGI yozuvda takror tekshiriladi (mijoz: telefon/ism,
    //     xodim: telefon) — ikki kassa bir vaqtda kiritsa ikkilanmaydi;
    //  3) TAHRIRDA vaqt muhri solishtiriladi — oradan boshqa qurilma
    //     yangilagan bo'lsa `conflict` qaytadi, oxirgisi jimgina
    //     yutmaydi (486 dagi kartochka qoidasi).
    // Ruxsat etilgan jadvallar faqat shu ikkitasi.
    if (action === "save_record") {
      if (!(await _verify))
        return res.status(401).json({ ok: false, error: "Token yaroqsiz" });
      const tbl = String(body.table || "");
      if (tbl !== "customers" && tbl !== "staff")
        return res.status(400).json({ ok: false, error: "Jadval ruxsat etilmagan" });
      const row = (body.row && typeof body.row === "object") ? { ...body.row } : null;
      if (!row || !row.id)
        return res.status(400).json({ ok: false, error: "row/id kerak" });

      const idQ = `id=eq.${encodeURIComponent(String(row.id))}`;
      const bor = await sbAll(`${tbl}?shop_id=eq.${encodeURIComponent(shopId)}` +
                              `&${idQ}&select=id,name,phone,data`);
      const eski = (bor && bor[0]) || null;

      // (3) Tahrirda to'qnashuv tekshiruvi
      if (eski && body.baseAt) {
        const _sAt = (eski.data && eski.data.updatedAt) ? Date.parse(eski.data.updatedAt) : 0;
        const _bAt = Date.parse(body.baseAt) || 0;
        if (_sAt && _bAt && _sAt > _bAt + 1000)
          return res.status(200).json({ ok: false, code: "conflict",
            error: "Boshqa qurilma yangilagan", row: eski });
      }

      // (2) Yangi yozuvda takror tekshiruvi
      if (!eski) {
        const tel = String(row.phone || "").trim();
        const nom = String(row.name  || "").trim().toLowerCase();
        const hammasi = await sbAll(`${tbl}?shop_id=eq.${encodeURIComponent(shopId)}` +
                                    `&select=id,name,phone`);
        const takror = (hammasi || []).find(x =>
          (tel && String(x.phone || "").trim() === tel) ||
          (tbl === "customers" && nom &&
           String(x.name || "").trim().toLowerCase() === nom));
        if (takror)
          return res.status(200).json({ ok: false, code: "dup",
            error: "Allaqachon ro'yxatda", row: takror });
      }

      // (1) shop_id SERVERDA — klientnikiga ishonilmaydi
      const now = new Date().toISOString();
      const data = (row.data && typeof row.data === "object") ? row.data : row;
      delete data.shop_id;
      data.updatedAt = now;
      const yoz = {
        shop_id: shopId,
        id: row.id,
        name:  row.name  || data.name  || "",
        phone: row.phone || data.phone || "",
        data,
        updated_at: now
      };
      // Xodimda ochiq PIN bulutga yozilmaydi (C-1 qoidasi)
      if (tbl === "staff") { delete yoz.data.pin; delete yoz.data.pinHash; }

      const r = await fetch(`${SB_URL}/rest/v1/${tbl}`, {
        method: "POST",
        headers: { ...H(), "Content-Type": "application/json",
                   Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(yoz)
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        return res.status(200).json({ ok: false, error: t.slice(0, 160) });
      }
      const j = await r.json().catch(() => []);
      return res.status(200).json({ ok: true, row: (j && j[0]) || yoz });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ 2026-08-19 (1-bosqich): HISOBOT KO'RSATKICHLARI SERVERDAN
    // ═══════════════════════════════════════════════════════════════
    // Ildiz: Hisobotning 11 ta ko'rsatkichi lokal `db.sales` va
    // `db.products` dan hisoblanardi. Ro'yxat chala tortilsa —
    // foyda, tushum, tannarx JIMGINA yolg'on chiqardi (o'sha "foyda
    // 60,9M ↔ 160,1M sakrardi" sinfi).
    // Endi hisob SERVERDA. Formulalar `hisobot.js` bilan AYNAN bir xil:
    //  · sotuvlar: bekor va eski-qarz tashlanadi (statSales)
    //  · kassaga tushdi: payBreakdown (naqd+karta+o'tkazma), aks holda
    //    nasiya=0, qolganda paid + davr qarz to'lovlari (refund emas)
    //  · tannarx: 1) chekdagi muzlatilgan costUzs, 2) sku bo'yicha
    //    tovar, 3) nom bo'yicha (aynan shu tartib — 09-avg tuzatishi)
    //  · realProfit: har chek to'langan ulushiga mutanosib + qarz
    //    to'lovlaridan grossMargin ulushi
    //  · xarajatlar: davrdagi jami; sof foyda ikki xil (kassa/haqiqiy)
    if (action === "report_stats") {
      const from = String(body.from || "").slice(0, 10);
      const to   = String(body.to   || "").slice(0, 10);
      if (!from || !to)
        return res.status(400).json({ ok: false, error: "from/to kerak" });
      const rate = Number(body.rate) || 12800;

      const [sales, pays, prods, xars] = await Promise.all([
        sbAll(`sales?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&date=gte.${from}&date=lte.${to}` +
              `&select=id,date,status,total,paid,pay_type,remaining,debt_usd,` +
              `debt_currency,orig_remaining,orig_debt_usd,items,data`),
        sbAll(`debt_payments?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&select=id,date,amount,currency,data`),
        sbAll(`products?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&select=sku,name,data`),
        sbAll(`xarajatlar?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&date=gte.${from}&date=lte.${to}&select=id,amount`)
      ]);

      // Tovar xaritalari (tannarx qidirish tartibi uchun)
      const bySku = new Map(), byName = new Map();
      (prods || []).forEach(p2 => {
        const d = (p2.data && typeof p2.data === "object") ? p2.data : {};
        const cost = (d.costUzs != null && d.costUzs > 0)
          ? Math.round(d.costUzs)
          : Math.round((d.costUsd || 0) * rate);
        if (p2.sku && !bySku.has(String(p2.sku)))   bySku.set(String(p2.sku), cost);
        const nm = d.name || p2.name;
        if (nm && !byName.has(String(nm)))          byName.set(String(nm), cost);
      });

      // Chekdan to'langan summa (payBreakdown qoidasi)
      const _chekPaid = (s, d) => {
        const pb = d.payBreakdown;
        if (pb && (pb.naqd || pb.karta || pb.otkazma))
          return (pb.naqd || 0) + (pb.karta || 0) + (pb.otkazma || 0);
        return ((d.payType || s.pay_type) === "nasiya") ? 0 : (Number(s.paid) || 0);
      };

      let cnt = 0, rev = 0, debt = 0, paid = 0, costTotal = 0,
          grossProfit = 0, realProfit = 0;

      (sales || []).forEach(s => {
        const d = (s.data && typeof s.data === "object") ? s.data : {};
        if (d.cancelled === true || d.cancelled === "true") return;   // statSales
        if (d.isOldDebt === true) return;
        cnt++;
        const total = Number(s.total) || 0;
        rev += total;
        const st = saleState(s, pays || []);
        debt += st.remaining;

        const sPaid = _chekPaid(s, d);
        paid += sPaid;

        let saleCost = 0;
        const items = Array.isArray(s.items) ? s.items
                    : (Array.isArray(d.items) ? d.items : []);
        items.forEach(it => {
          const qty = Number(it.qty) || 0;
          if (Number(it.costUzs) > 0) { saleCost += Number(it.costUzs) * qty; return; }
          let c = null;
          if (it.sku && bySku.has(String(it.sku))) c = bySku.get(String(it.sku));
          if (c == null && it.name && byName.has(String(it.name))) c = byName.get(String(it.name));
          if (c == null) return;
          saleCost += c * qty;
        });
        costTotal   += saleCost;
        grossProfit += total - saleCost;
        const ratio  = total > 0 ? (sPaid / total) : 0;
        realProfit  += (total - saleCost) * ratio;
      });

      // Davr qarz to'lovlari (refund manbali HISOBGA KIRMAYDI — cashPays)
      let debtPaid = 0;
      (pays || []).forEach(p2 => {
        const d = (p2.data && typeof p2.data === "object") ? p2.data : {};
        if (d.cancelled === true || d.cancelled === "true") return;
        if (d.source === "refund") return;
        const dt = String(p2.date || "");
        if (dt < from || dt > to) return;
        debtPaid += (p2.currency === "usd")
          ? Math.round((Number(p2.amount) || 0) * rate)
          : (Number(p2.amount) || 0);
      });
      paid += debtPaid;
      const grossMargin = rev > 0 ? (grossProfit / rev) : 0;
      realProfit += debtPaid * grossMargin;

      grossProfit = Math.round(grossProfit);
      realProfit  = Math.round(realProfit);
      const periodExp = (xars || []).reduce((a, x) => a + (Number(x.amount) || 0), 0);

      return res.status(200).json({ ok: true,
        cnt, rev: Math.round(rev), debt: Math.round(debt), paid: Math.round(paid),
        cost: Math.round(costTotal), profit: grossProfit, realProfit,
        margin:     rev  > 0 ? Math.round(grossProfit / rev  * 100) : 0,
        realMargin: paid > 0 ? Math.round(realProfit  / paid * 100) : 0,
        expenses:   Math.round(periodExp),
        netProfit:  Math.round(realProfit  - periodExp),
        netMargin:  paid > 0 ? Math.round((realProfit  - periodExp) / paid * 100) : 0,
        trueNet:    Math.round(grossProfit - periodExp),
        trueMargin: rev  > 0 ? Math.round((grossProfit - periodExp) / rev * 100) : 0
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ 2026-08-19: QARZ KO'RSATKICHLARI SERVERDAN (debt_stats)
    // ═══════════════════════════════════════════════════════════════
    // Ildiz (ABU SAXIY, 19-avg videolari): KPI lokal `db.sales` dan
    // hisoblanardi. Pull sahifalab tortadi; sahifa o'rtasida xato
    // bo'lsa `_selectAll` JIM to'xtab, chala ro'yxat qaytaradi va
    // lokal nusxa o'sha chala nusxa bilan almashadi. Natijada ekranda
    // 6,29 mlrd / 182 kishi o'rniga 767 mln / 54 kishi ko'rindi,
    // keyingi to'liq pull'da o'ziga qaytdi ("har zamon" shikoyati).
    // Endi to'rtta raqam SERVERDA sanaladi — qurilmadagi ro'yxat
    // to'liq bo'lishi SHART EMAS. Bu hisobotdagi o'sha sinfning
    // ildiz davosi (§3.23 SERVER HAQIQAT).
    // Hisob `debt` amali bilan AYNAN bir xil: saleState, valyuta
    // ajratilgan, bekor/qaytarilgan tashlanadi.
    if (action === "debt_stats") {
      const bugun = new Date(Date.now() + 5 * 3600 * 1000)
        .toISOString().slice(0, 10);          // Toshkent sanasi
      const [sales, pays] = await Promise.all([
        sbAll(`sales?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&or=(remaining.gt.0,debt_usd.gt.0)` +
              `&select=id,customer_id,customer_name,date,due,status,` +
              `remaining,debt_usd,debt_currency,orig_remaining,orig_debt_usd`),
        sbAll(`debt_payments?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&select=id,customer_id,amount,currency,data`)
      ]);
      const payByCust = new Map();
      pays.forEach(p2 => {
        const k = String(p2.customer_id || "");
        if (!payByCust.has(k)) payByCust.set(k, []);
        payByCust.get(k).push(p2);
      });
      let uzs = 0, usd = 0, over = 0;
      const custlar = new Set();
      let soni = 0;
      sales.forEach(s => {
        if (s.status === "bekor" || s.status === "qaytarilgan") return;
        const k  = String(s.customer_id || "");
        const st = saleState(s, payByCust.get(k) || []);
        const qoldi = (s.debt_currency === "usd") ? st.debtUsd : st.remaining;
        if (!(qoldi > 0.009)) return;          // yopilganlar sanalmaydi
        if (s.debt_currency === "usd") usd += st.debtUsd;
        else                            uzs += st.remaining;
        soni++;
        custlar.add(s.customer_name || k || String(s.id));
        if (s.due && String(s.due) < bugun) over++;
      });
      return res.status(200).json({ ok: true,
        uzs:  Math.round(uzs),
        usd:  Math.round(usd * 100) / 100,
        over, cnt: custlar.size, sales: soni });
    }

    // ✅ 2026-08-18 (3-teshik, yakuni): YANGI TOVAR RAQAMI SERVERDAN.
    // Ildiz: SKU qurilmada, KETMA-KET beriladi (`db.seq` + lokal
    // ro'yxatdan bo'sh raqam qidiriladi). Ikki kassa deyarli bir vaqtda
    // tovar qo'shsa, IKKALASI HAM bir xil raqamni oladi — push (sku,
    // shop_id) kaliti bilan yozgani uchun ikkinchisi birinchisini
    // JIMGINA BOSIB KETADI: tovar ham, qoldig'i ham yo'qoladi
    // (Shoetest'dagi "12 tovar sir bo'lib yo'qoldi" sinfi).
    // Endi raqam serverdan olinadi — chek raqamlari qoidasi (§3.14).
    // `count` bilan bir yo'la bir nechta raqam ajratsa ham bo'ladi
    // (import/ko'p rang qo'shish uchun).
    if (action === "next_sku") {
      if (!(await _verify))
        return res.status(401).json({ ok: false, error: "Token yaroqsiz" });
      // ✅ 2026-08-18: import uchun `IMP` prefiksi ham qo'llab-quvvatlanadi
      const _pf = String(body.prefix || "").toUpperCase();
      const pref = (_pf === "SHOE" || _pf === "IMP") ? _pf : "CLTH";
      const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 200);
      const rows = await sbAll(
        `products?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&sku=like.${encodeURIComponent(pref + "-%")}&select=sku`);
      let mx = 0;
      (rows || []).forEach(r => {
        const m = String(r.sku || "").match(/^[A-Z]+-(\d+)/);
        if (m) { const n = parseInt(m[1]); if (n > mx) mx = n; }
      });
      const band = new Set((rows || []).map(r => String(r.sku)));
      const skus = [];
      let n = mx;
      while (skus.length < count) {
        n++;
        const s = `${pref}-${String(n).padStart(pref === "IMP" ? 4 : 3, "0")}`;
        if (!band.has(s)) skus.push(s);
        if (n > mx + 5000) break;                 // cheksiz aylanish himoyasi
      }
      return res.status(200).json({ ok: true, skus, next: n });
    }

    // ✅ 2026-08-18 (4-paket): KO'P MIJOZ QARZI BIR CHAQIRUVDA.
    // "Barchaga eslatma" avval har mijoz jamini LOKALDAN olardi —
    // qurilma eskirgan bo'lsa yuzlab mijozga noto'g'ri raqam ketardi.
    // Yuzlab alohida `debt` chaqiruvi o'rniga: 80 talik bo'laklarda
    // 2 ta yalpi so'rov; hisob `debt` amali bilan AYNAN bir xil
    // (saleState, valyuta ajratilgan, bekor/qaytarilgan tashlanadi).
    if (action === "debt_bulk") {
      const ids = Array.isArray(body.customerIds)
        ? body.customerIds.map(x => String(x || "")).filter(Boolean).slice(0, 500)
        : [];
      if (!ids.length)
        return res.status(400).json({ ok: false, error: "customerIds kerak" });
      const totals = {};
      ids.forEach(k => { totals[k] = { uzs: 0, usd: 0 }; });
      for (let i = 0; i < ids.length; i += 80) {
        const part = ids.slice(i, i + 80);
        const inList = encodeURIComponent(
          "(" + part.map(x => '"' + x.replace(/"/g, "") + '"').join(",") + ")");
        const [ss, pp] = await Promise.all([
          sbAll(`sales?shop_id=eq.${encodeURIComponent(shopId)}` +
                `&customer_id=in.${inList}` +
                `&or=(remaining.gt.0,debt_usd.gt.0)` +
                `&select=id,customer_id,date,status,remaining,debt_usd,` +
                `debt_currency,orig_remaining,orig_debt_usd`),
          sbAll(`debt_payments?shop_id=eq.${encodeURIComponent(shopId)}` +
                `&customer_id=in.${inList}&select=id,customer_id,amount,currency,data`)
        ]);
        const payByCust = new Map();
        pp.forEach(p => {
          const k = String(p.customer_id || "");
          if (!payByCust.has(k)) payByCust.set(k, []);
          payByCust.get(k).push(p);
        });
        ss.forEach(s2 => {
          if (s2.status === "bekor" || s2.status === "qaytarilgan") return;
          const k = String(s2.customer_id || "");
          if (!totals[k]) return;
          const st2 = saleState(s2, payByCust.get(k) || []);
          if (s2.debt_currency === "usd") totals[k].usd += st2.debtUsd;
          else                            totals[k].uzs += st2.remaining;
        });
      }
      Object.keys(totals).forEach(k => {
        totals[k].uzs = Math.round(totals[k].uzs);
        totals[k].usd = Math.round(totals[k].usd * 100) / 100;
      });
      return res.status(200).json({ ok: true, totals });
    }

    return res.status(400).json({ ok: false, error: "Noma'lum amal: " + action });
  } catch (e) {
    console.error("[pul]", action, e.message);
    return res.status(200).json({ ok: false, error: "Server xatosi: " + e.message });
  }
};
