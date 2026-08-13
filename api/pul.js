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
    if (!r.ok) break;
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// Foydalanuvchi tokenidan shop_id — kassa boshqa do'konga yoza olmaydi
async function shopFromToken(token) {
  if (!token) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return (u && u.user_metadata && u.user_metadata.shop_id) || null;
  } catch (e) { return null; }
}

// Sotuvning JORIY qoldig'i — muzlatilgan asl qiymatdan faol
// to'lovlar ayiriladi (ilovadagi calcSaleState bilan bir xil mantiq)
function saleState(sale, pays) {
  const d = sale.data || {};
  const isUsd = (d.debtCurrency || sale.debt_currency) === "usd";
  const origRem = Number(d.origRemaining != null ? d.origRemaining : sale.remaining) || 0;
  const origUsd = Number(d.origDebtUsd  != null ? d.origDebtUsd  : sale.debt_usd)  || 0;
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
  const shopId = await shopFromToken(token);
  if (!shopId)
    return res.status(401).json({ ok: false, error: "Token yaroqsiz — qayta kiring" });

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
      const [sales, pays] = await Promise.all([
        sbAll(`sales?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&customer_id=eq.${encodeURIComponent(custId)}&select=*`),
        sbAll(`debt_payments?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&customer_id=eq.${encodeURIComponent(custId)}&select=*`)
      ]);
      const ochiq = sales
        .filter(s => {
          const d = s.data || {};
          if (d.cancelled === true || d.cancelled === "true") return false;
          if ((d.status || s.status) === "qaytarilgan") return false;
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
      const kunlik = await sbAll(
        `debt_payments?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&date=eq.${tashDate()}&select=data`);
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
          chekNum: (s.data || {}).chekNum || ("#" + s.id),
          amount: Math.round(ber * 100) / 100, currency: cur,
          fullyPaid: after <= (cur === "usd" ? 0.005 : 0.5),
          remainingAfter: after
        });
        qoldi -= ber;
      }

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
      return res.status(200).json({ ok: true, payment: rec.data });
    }

    // ── QOLDIQNI SO'RASH (oyna ochilganda) ────────────────────
    if (action === "debt") {
      const custId = String(body.customerId || "");
      if (!custId) return res.status(400).json({ ok: false, error: "customerId kerak" });
      const [sales, pays] = await Promise.all([
        sbAll(`sales?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&customer_id=eq.${encodeURIComponent(custId)}&select=*`),
        sbAll(`debt_payments?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&customer_id=eq.${encodeURIComponent(custId)}&select=*`)
      ]);
      let uzs = 0, usd = 0;
      sales.forEach(s => {
        const d = s.data || {};
        if (d.cancelled === true || d.cancelled === "true") return;
        if ((d.status || s.status) === "qaytarilgan") return;
        const st = saleState(s, pays);
        uzs += st.remaining; usd += st.debtUsd;
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
