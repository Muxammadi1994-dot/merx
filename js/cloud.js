// ══════════════════════════════════════════════════════════════
// SINXRON OYNASI (2026-07-31)
// ══════════════════════════════════════════════════════════════
// MUAMMO: butun baza localStorage'da BITTA JSON bo'lib saqlanadi.
// Brauzer chegarasi ~5 MB. Sotuv tarixi esa vaqt o'tgani sari
// cheksiz o'sadi — 8 oylik tarix 4,74 MB egallab, ilova qotib
// qoldi va ma'lumot to'liq yuklanmay qoldi.
//
// YECHIM: qurilma bulutdan FAQAT oxirgi 60 kunni oladi.
// Butun tarix BULUTDA SAQLANIB QOLADI — hech narsa o'chmaydi.
// Shu bilan qurilmadagi hajm do'kon necha yil ishlashidan
// QAT'I NAZAR bir xil qoladi.
//
// ⚠️ ISTISNO: to'lanmagan qarz (remaining > 0) qancha eski bo'lsa
// ham HAR DOIM olinadi. Busiz 3 oy oldingi qarz ilovadan
// yo'qolib ketardi.
//
// Eski davr hisobotlari keyingi bosqichda (serverda hisoblash)
// qaytariladi.
// 2026-07-31: IndexedDB ishga tushgach oyna 60 → 365 kunga kengaytirildi.
// Endi butun Billz tarixi (2025-12 dan buyon) qurilmaga tushadi.
// Oyna BUTUNLAY olib tashlanmadi — 10 yildan keyin ham qurilmada
// ko'pi bilan 1 yillik ma'lumot bo'lsin, undan eskisi bulutda qoladi.
const SYNC_WINDOW_DAYS = 365;

function syncCutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - SYNC_WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}

// MERX cloud.js | v2.3 | 2026-06-11
// ================================================
// MERX — js/cloud.js  (v2 — Supabase sync)
// ================================================

let _sb = null; // Supabase client
let _sbUsedAnon = true; // oxirgi ulanish anon key bilan bo'ldimi

// ── Supabase clientini yaratish ───────────────────
// ── Shop ID — multi-tenant izolyatsiya ───────────
function getCloudShopId() {
  // 1. db.settings da saqlangan cloudShopId — eng ishonchli
  if (db.settings?.cloudShopId && db.settings.cloudShopId !== "local") {
    return db.settings.cloudShopId;
  }
  // 2. Auth session dan
  if (typeof getShopId === "function") {
    const sid = getShopId();
    if (sid && sid !== "local") return sid;
  }
  // 3. Do'kon ID topilmadi — sinxronlash MUMKIN EMAS.
  // ESKI USUL OLIB TASHLANDI: avval bu yerda Supabase URL'dan ID
  // yasalardi (masalan "satsriyleuzlrxnohecu") — bu turli qurilmalar
  // ma'lumotlarini bitta egasiz ID ostiga aralashtirib yuborardi.
  return null;
}

// ── TOKEN AVTO-YANGILASH (v166) ────────────────────────────────
// Kirish kaliti muddati tugashidan 5 daqiqa oldin (yoki tugagan
// bo'lsa darhol) yangisi olinadi — tizim endi hech qachon jimgina
// "kar" (yozolmaydigan) rejimga tushmaydi. AbuSaxiy hodisasi davosi.
let _refreshBusy = false;
async function ensureFreshToken() {
  if (_refreshBusy) return;
  try {
    const raw = localStorage.getItem("merx_sb_session")
             || sessionStorage.getItem("merx_sb_session");
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!s?.refreshToken) return; // eski sessiya (refreshsiz) — yangilab bo'lmaydi
    if (s.expiresAt && Date.now() < s.expiresAt - 5 * 60 * 1000) return; // hali yangi
    const url = db.settings?.supabaseUrl?.trim();
    const key = db.settings?.supabaseKey?.trim();
    if (!url || !key) return;
    _refreshBusy = true;
    const r = await fetch(url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refreshToken })
    });
    const d = await r.json();
    if (d.access_token) {
      s.accessToken  = d.access_token;
      s.refreshToken = d.refresh_token || s.refreshToken;
      s.expiresAt    = Date.now() + ((d.expires_in || 3600) * 1000);
      localStorage.setItem("merx_sb_session", JSON.stringify(s));
      if (typeof setSupabaseTestSession === "function") setSupabaseTestSession(s);
      console.log("🔄 Kirish kaliti avtomatik yangilandi");
    } else if (r.status === 400 || r.status === 401) {
      console.warn("❌ Sessiya butunlay eskirgan — chiqib, qayta kiring");
      if (typeof toast === "function") toast("Sessiya eskirdi — chiqib, qayta kiring", "err");
    }
  } catch (e) { console.warn("token yangilash xato:", e.message); }
  finally { _refreshBusy = false; }
}

async function initSupabase() {
  // Har ulanish oldidan token yangiligini ta'minlaymiz (v166)
  await ensureFreshToken();
  // 1. settings dan, 2. global config dan
  const url = (db.settings?.supabaseUrl?.trim()) || 
              (typeof MERX_SUPABASE_URL !== "undefined" ? MERX_SUPABASE_URL : "");
  const key = (db.settings?.supabaseKey?.trim()) || 
              (typeof MERX_SUPABASE_KEY !== "undefined" ? MERX_SUPABASE_KEY : "");
  if (!url || !key) {
    console.warn("❌ initSupabase: kalitlar topilmadi (db.settings bo'sh) — bulut o'chiq");
    return false; // endi JIM yiqilmaydi (v161)
  }
  // Settings ga ham yozamiz (bo'lmasa)
  if (db.settings && !db.settings.supabaseUrl) {
    db.settings.supabaseUrl = url;
    db.settings.supabaseKey = key;
  }

  try {
    // SEKIN INTERNET DAVOSI (v160): Supabase kutubxonasi CDN'dan hali
    // yetib kelmagan bo'lishi mumkin — 10 soniyagacha kutamiz.
    // (Guest/yangi qurilmalarda "do'kon bo'sh" muammosining sababi shu edi)
    let _lib = window.supabase || (typeof supabase !== "undefined" ? supabase : null);
    for (let i = 0; i < 40 && !_lib; i++) {
      await new Promise(r => setTimeout(r, 250));
      _lib = window.supabase || (typeof supabase !== "undefined" ? supabase : null);
    }
    if (!_lib) {
      console.warn("❌ Supabase kutubxonasi yuklanmadi (internet juda sekin) — birozdan keyin qayta uriniladi");
      return false;
    }
    const { createClient } = _lib;

    // Auth token holati
    const sbSession = typeof getSupabaseTestSession === "function"
      ? getSupabaseTestSession()
      : null;

    // Agar allaqachon token bilan ulangan bo'lsa — qaytadan yaratmaymiz
    // (bu "Multiple GoTrueClient" ogohlantirishini oldini oladi)
    // v159: token ALMASHGANini ham sezamiz — hisob almashganda eski
    // token bilan qolgan client RLS'da yangi do'konni ko'rmasdi
    const needNewClient = !_sb
      || ((sbSession?.accessToken || null) !== _sbLastToken)
      || (sbSession?.accessToken && _sbUsedAnon) || (!sbSession?.accessToken && !_sbUsedAnon);
    _sbLastToken = sbSession?.accessToken || null;

    if (needNewClient) {
      if (sbSession?.accessToken) {
        // Yangi yo'l: Supabase Auth token bilan
        _sb = createClient(url, key, {
          auth: { persistSession: false, storageKey: "merx-sb-auth" }, // v180: GoTrue ogohlantirishiga davo
          global: { headers: { Authorization: `Bearer ${sbSession.accessToken}` } }
        });
        _sbUsedAnon = false;
        console.log("✅ Cloud: Supabase Auth token bilan ulandi (yangi, xavfsiz yo'l)");
      } else {
        // Eski zaxira yo'l: anon key bilan
        _sb = createClient(url, key, { auth: { persistSession: false, storageKey: "merx-sb-anon" } }); // v180
        _sbUsedAnon = true;
        console.log("ℹ️ Cloud: anon key bilan ulandi (eski yo'l, hali ham ishlaydi)");
      }
    }

    try { _loadPushCache(); } catch(e) {}

    // Test ulanish — settings jadvalini tekshiramiz
    const { error } = await _sb.from("settings").select("shop_id").limit(1);
    if (error) throw error;

    updateCloudUI(true);
    return true;
  } catch(e) {
    console.warn("Supabase ulanmadi:", e.message);
    updateCloudUI(false);
    _sb = null;
    return false;
  }
}

// ── UI yangilash ──────────────────────────────────
function updateCloudUI(connected) {
  const badge = $("cloud-status-badge");
  const pill  = $("cloud-pill");
  const txt   = $("cloud-txt");

  if (badge) {
    badge.textContent = connected ? "Ulangan ✅" : "Ulanmagan";
    badge.className   = connected ? "bg bg-g" : "bg bg-gr";
  }
  if (pill) pill.style.display = connected ? "flex" : "none";
  if (txt)  txt.textContent    = connected ? "Yangilash" : ""; // 2026-07-10: bosilganda bulutdan yangilaydi — nom endi mos
}

// ══════════════════════════════════════════════════════════════
// SAHIFALAB O'QISH (2026-07-31)
// ══════════════════════════════════════════════════════════════
// Supabase bitta so'rovda ko'pi bilan 1000 QATOR qaytaradi va bu
// haqda XATO BERMAYDI — shunchaki qolganini tashlab ketadi.
// Ilova esa buni "bulutda shuncha bor" deb qabul qilardi. Do'kon
// o'sganda (3000 sotuv, 1500 mijoz) ma'lumot jimgina chala
// yuklanardi. Endi 1000 talab bo'lib, tugaguncha o'qiladi.
async function _selectAll(build, label) {
  const PAGE = 1000;
  let from = 0, out = [];
  for (;;) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) { console.warn(`_selectAll(${label||""}) xato:`, error.message); break; }
    const rows = data || [];
    out = out.concat(rows);
    if (rows.length < PAGE) break;
    from += PAGE;
    if (from > 200000) { console.warn("_selectAll: juda ko'p qator, to'xtatildi"); break; }
  }
  return out;
}

// ── Rasmni DARHOL omborga yuklash (2026-07-31) ────────────────
// Mavjud `_migrateImagesToStorage` har sinxronda base64 rasmlarni
// ko'chiradi. Lekin u ko'chirgunicha og'ir base64 KAMIDA BIR MARTA
// bazaga yozilib, sinxronlanadi.
// Bu yordamchi rasm TANLANGAN ZAHOTI yuklaydi — base64 bazaga
// umuman tushmaydi. Yuklashning O'ZI mavjud `_uploadOneImage` da,
// takrorlanmadi (§10.3 — yagona manba).
//
// Yuklab bo'lmasa base64 QAYTADI: internetsiz ishlash saqlanadi,
// keyin sinxron paytida eski mexanizm baribir ko'chiradi.
async function uploadImageToStorage(dataUrl, tag) {
  if (!dataUrl || !String(dataUrl).startsWith("data:image")) return dataUrl;
  try {
    if (!_sb && typeof initSupabase === "function") await initSupabase();
    const sid = getCloudShopId();
    if (!_sb || !sid) return dataUrl;
    const safe = String(tag || "img").replace(/[^\w-]/g, "_").slice(0, 40) || "img";
    return await _uploadOneImage(sid, safe, "now", dataUrl);
  } catch (e) {
    console.warn("🖼️ rasm yuklanmadi (base64 qoldi):", e.message || e);
    return dataUrl;
  }
}

// ══════════════════════════════════════════════════════════════
// DELTA SINXRON — FAQAT O'ZGARGANINI OLISH (2026-07-31, 4-bosqich)
// ══════════════════════════════════════════════════════════════
// MUAMMO: har o'zgarishda (realtime signal yoki 90 soniyalik zaxira)
// BUTUN baza qaytadan tortilardi — 3000 sotuv, 844 tovar, 847 mijoz.
// B20 da bir necha kishi bir vaqtda ishlaydi: har biri har o'zgarishda
// hammasini qayta yuklaydi. Shuning uchun telefondagi o'zgarishni
// kompyuter kech sezardi.
//
// YECHIM: "oxirgi tortishdan keyin NIMA o'zgardi" degan so'rov.
// Odatda 1-5 qator keladi — bir soniyada.
//
// XAVFSIZLIK QOIDALARI:
//  1. To'liq pull (pullFromCloud) O'ZGARMADI — birinchi yuklash,
//     "Yangilash" tugmasi va do'kon almashishida u ishlaydi
//  2. Delta faqat `data` ustuni to'la qatorlar uchun. Bittasi bo'sh
//     bo'lsa — TO'LIQ pull'ga qaytadi (eski, ishonchli yo'l)
//  3. Vaqt belgisi FAQAT serverdan kelgan qiymatlardan olinadi —
//     qurilma soati noto'g'ri bo'lsa ham ma'lumot yo'qolmaydi
//  4. Xato bo'lsa — to'liq pull'ga qaytadi
//  5. O'chirishlar `deleted_records` orqali qo'llanadi

// ── DELTA SINXRON KALITI (2026-07-31) ─────────────────────────
// Birinchi urinishda ikki xato bo'lgan (vaqt belgisi siljimasligi va
// lokal o'zgarishning bosib yozilishi). Ikkalasi ham tuzatildi va
// qo'shimcha qo'riqchilar qo'yildi (pastda pullDelta izohiga qarang).
//
// SINOV TARTIBI:
//   1) `true` qilib FAQAT Shoetest'da bir necha kun ishlating
//   2) Ikki qurilmadan bir vaqtda: tovar qo'shish, rasm qo'yish,
//      sotuv, qarz kiritish
//   3) Hech narsa yo'qolmasa — AbuSaxiy va B20 ga o'tkaziladi
// Muammo chiqsa: `false` qilib push — bir zumda eski holatga qaytadi.
const USE_DELTA = false;  // 2026-07-31: rasm masalasi hal bo'lguncha O'CHIQ

// ⚠️ DELTA FAQAT SHU DO'KONLARDA ishlaydi. Qolganlari (AbuSaxiy, B20)
// eski, sinalgan to'liq pull yo'lida qoladi — sinov ularga tegmaydi.
// Sinov muvaffaqiyatli bo'lsa ro'yxatga boshqa do'konlar qo'shiladi,
// yoki ro'yxat bo'sh qoldirilib hammasiga ochiladi.
const DELTA_SHOPS = [
  "shop_1782763300535",   // Shoetest
];

function _lastPullKey(sid) { return "merx_lastpull_" + sid; }
function _getLastPull(sid) {
  try { return localStorage.getItem(_lastPullKey(sid)) || null; } catch(e) { return null; }
}
// Vaqt belgisi 5 DAQIQA ORQAGA suriladi.
// Sabab: to'liq pull bir necha soniya davom etadi. Jadvallar ketma-ket
// o'qiladi, va oraliqda o'zgargan qator "eski" bo'lib qolib, keyingi
// delta uni olmasligi mumkin edi. Chekinish shu teshikni yopadi.
// Narxi: har delta oxirgi 5 daqiqani qayta oladi — bu bir necha
// qator, id bo'yicha birlashtirish takrorni yaratmaydi.
const _PULL_MARGIN_MS = 5 * 60 * 1000;

// TUZATILDI: endi HAQIQIY eng katta vaqt saqlanadi. Chekinish faqat
// SO'ROV paytida qo'llanadi (_sinceQuery). Avval chekinish saqlashda
// qo'llanib, belgi hech qachon oldinga siljimasdi.
function _setLastPull(sid, iso) {
  try { if (iso) localStorage.setItem(_lastPullKey(sid), iso); } catch(e) {}
}
function _sinceQuery(iso) {
  const t = Date.parse(iso);
  return isNaN(t) ? iso : new Date(t - _PULL_MARGIN_MS).toISOString();
}

// Delta qamrab oladigan jadvallar: bulut ustuni → lokal massiv
const _DELTA_TABLES = [
  ["products",      "products"],
  ["customers",     "customers"],
  ["sales",         "sales"],
  ["ombor",         "ombor"],
  ["xarajatlar",    "xarajatlar"],
  ["debt_payments", "debtPayments"],
];

// ⚠️ O'CHIRISH KALITI jadval bo'yicha HAR XIL.
// `queueCloudDelete("products", "sku", ...)` — tovar SKU bilan
// o'chiriladi, qolganlari id bilan. Avval delta hammasini id deb
// hisoblardi, shuning uchun tovar o'chirilishi boshqa qurilmaga
// YETIB BORMASDI (telefonda o'chirilgan tovar kompyuterda qolardi).
const _DELTA_DEL_KEY = {
  products: "sku", customers: "id", sales: "id",
  ombor: "id", xarajatlar: "id", debt_payments: "id",
};

function _mergeById(arr, rows) {
  const map = new Map((arr || []).map(x => [String(x.id), x]));
  rows.forEach(r => map.set(String(r.id), r));
  return [...map.values()].sort((a, b) => (a.id || 0) - (b.id || 0));
}

// ══════════════════════════════════════════════════════════════
// DELTA — XAVFSIZ QAYTA YOZILGAN (2026-07-31, 2-urinish)
// ══════════════════════════════════════════════════════════════
// BIRINCHI URINISHDA NIMA XATO BO'LGAN:
//   Tekshiruv so'rovdan OLDIN turgan, javob esa bir necha soniyadan
//   keyin kelgan. O'sha oraliqda telefonda qo'yilgan rasm bulutdagi
//   ESKI nusxa bilan bosib yozilgan — ma'lumot yo'qolgan.
//
// ENDI TO'RTTA QO'RIQCHI:
//   1. Boshlanishda: yuborilmagan o'zgarish bo'lsa — delta yo'q
//   2. `_dbMutSeq` so'rovdan oldin olinadi va javobni QO'LLASHDAN
//      OLDIN qayta solishtiriladi. Farq bo'lsa — butunlay bekor
//      qilinadi (hech narsa yozilmaydi), keyingi safar qaytariladi
//   3. Yozish bitta qadamda: avval hammasi tayyorlanadi, keyin
//      birdaniga qo'llanadi — yarim holat qolmaydi
//   4. Har qanday xatoda — to'liq pull'ga qaytadi
//
// Qaytaradi: true — delta bajarildi, false — to'liq pull kerak
let _deltaFailStreak = 0;

async function pullDelta() {
  if (!USE_DELTA) return false;
  const sid = getCloudShopId();
  if (!_sb || !sid) return false;
  // Faqat ruxsat berilgan do'konlarda (ro'yxat bo'sh bo'lsa — hammasida)
  if (DELTA_SHOPS.length && !DELTA_SHOPS.includes(sid)) return false;

  const since = _getLastPull(sid);
  if (!since) return false;                       // hali to'liq tortilmagan

  // Har 20 deltadan keyin bir marta to'liq pull — ehtiyot uchun
  // (biror qator sababsiz o'tkazib yuborilgan bo'lsa tiklanadi)
  if (_deltaFailStreak >= 20) { _deltaFailStreak = 0; return false; }

  // ── QO'RIQCHI 1: yuborilmagan lokal o'zgarish bo'lsa — delta yo'q
  if (typeof _syncPending !== "undefined" && _syncPending) return false;

  const seq0 = (typeof window !== "undefined" && window._dbMutSeq) || 0;
  const _q = _sinceQuery(since);

  try {
    // ── Ma'lumotni YIG'AMIZ (hali hech narsa yozilmaydi) ──
    const staged = [];      // [{key, rows}]
    let maxTs = since, incoming = 0;

    for (const [tbl, key] of _DELTA_TABLES) {
      const rows = await _selectAll(() => _sb.from(tbl).select("*")
        .eq("shop_id", sid)
        .gt("updated_at", _q)
        .order("updated_at"), "delta:" + tbl);
      if (!rows.length) continue;
      // `data` bo'sh qator bo'lsa — eski, ishonchli yo'lga qaytamiz
      if (rows.some(r => !r.data || typeof r.data !== "object" || Array.isArray(r.data))) {
        return false;
      }
      staged.push({ key, rows: rows.map(r => ({ ...r.data, id: r.id })) });
      incoming += rows.length;
      rows.forEach(r => { if (r.updated_at && r.updated_at > maxTs) maxTs = r.updated_at; });
    }

    const dels = await _selectAll(() => _sb.from("deleted_records").select("*")
      .eq("shop_id", sid)
      .gt("deleted_at", _q)
      .order("deleted_at"), "delta:deleted");
    dels.forEach(d => { if (d.deleted_at && d.deleted_at > maxTs) maxTs = d.deleted_at; });

    // ── QO'RIQCHI 2: so'rov davomida lokal o'zgardimi? ──
    const seq1 = (typeof window !== "undefined" && window._dbMutSeq) || 0;
    if (seq1 !== seq0 || (typeof _syncPending !== "undefined" && _syncPending)) {
      _deltaFailStreak++;
      console.log("↩️ delta bekor qilindi — lokal o'zgarish bor (ma'lumot saqlandi)");
      return false;                                // HECH NARSA yozilmadi
    }

    if (!incoming && !dels.length) { _setLastPull(sid, maxTs); return true; }

    // ── QO'LLASH (bitta qadamda) ──
    let changed = 0;
    for (const st of staged) {
      db[st.key] = _mergeById(db[st.key], st.rows);
      changed += st.rows.length;
    }
    if (dels.length) {
      const byTable = {};
      dels.forEach(d => (byTable[d.table_name] = byTable[d.table_name] || new Set())
        .add(String(d.record_id)));
      for (const [tbl, key] of _DELTA_TABLES) {
        const ids = byTable[tbl];
        if (!ids || !Array.isArray(db[key])) continue;
        const kf = _DELTA_DEL_KEY[tbl] || "id";
        const before = db[key].length;
        db[key] = db[key].filter(x => !ids.has(String(x[kf])));
        changed += before - db[key].length;
      }
    }

    _deltaFailStreak = 0;
    _setLastPull(sid, maxTs);
    if (changed > 0) {
      try { saveDB(); } catch(e) {}
      try {
        if (typeof renderDashboard === "function") renderDashboard();
        const pg = document.querySelector(".pg.on");
        if (pg && typeof nav === "function") nav(pg.id.replace(/^p-/, ""));
      } catch(e) {}
      console.log(`⚡ Delta: ${changed} ta o'zgarish`);
    }
    return true;

  } catch (e) {
    console.warn("delta xato — to'liq pull:", e.message || e);
    return false;
  }
}

// Delta bo'lmasa to'liq pull. Realtime va zaxira shu funksiyani chaqiradi.
async function pullSmart(silent, background) {
  const ok = await pullDelta();
  if (ok) return;
  await pullFromCloud(silent, background);
}

// ── RASM HIMOYASI (2026-07-31) ────────────────────────────────
// MUAMMO: pull paytida `image: p.image || null` yozilardi. Bulutdagi
// nusxada rasm bo'lmasa (boshqa qurilma eski nusxasini yuborgan
// bo'lsa), qurilmadagi rasm O'CHIB ketardi. Natijada rasm "bir
// paydo bo'lib, bir yo'qolardi" va oxiri butunlay yo'qolardi.
//
// ENDI: bulutda rasm bo'lmasa LOKAL nusxa saqlanadi. Rasm hech
// qachon "yo'q" bilan almashtirilmaydi — faqat yangisi bilan.
// Rang rasmlari esa BIRLASHTIRILADI: bir qurilmada qora rangga,
// boshqasida oq rangga rasm qo'yilsa — ikkalasi ham qoladi.
function _keepImg(cloudVal, localVal) {
  return cloudVal || localVal || null;
}
function _keepColorImgs(cloudObj, localObj) {
  const c = cloudObj && typeof cloudObj === "object" ? cloudObj : null;
  const l = localObj && typeof localObj === "object" ? localObj : null;
  if (!c && !l) return null;
  const out = { ...(l || {}) };
  if (c) for (const k in c) { if (c[k]) out[k] = c[k]; }
  return Object.keys(out).length ? out : null;
}

// ── LocalDB → Supabase (to'liq push) ─────────────
// ── connectCloud (ESKI YO'L) OLIB TASHLANDI, 2026-07 (3-bosqich) ──
// Sabab: bu qo'lda ulash yo'li ichida "shop_"+Date.now() bilan do'kon
// yaratadigan alohida kanal bor edi — "yagona yozish kanali" prinsipiga
// zid. Endi ulanish faqat login orqali (avtomatik).
function connectCloud() {
  toast("Bu funksiya olib tashlandi — bulut login paytida avtomatik ulanadi", "err");
}
async function _setShopContext(sid) {
  if (!sid || !_sb) return;
  // v183 — MUHIM TUZATISH: avval bu yerdagi xato faqat konsolga
  // yozilib, JIM YUTILARDI. Bu funksiya RLS (xavfsizlik) uchun qaysi
  // do'kon ekanini bildiradi — agar u ishlamasa, Supabase HECH QANDAY
  // qatorni ko'rsatmaydi (0 natija), lekin bu XATO EMAS deb
  // hisoblanardi — natijada "muvaffaqiyatli, lekin BO'SH" pull qayd
  // etilib, qayta urinish TO'XTAB QOLARDI (katalog abadiy bo'sh qolib
  // ketardi, ayniqsa yangi qurilmada birinchi kirishda). Endi xato
  // QAYTA OTILADI (throw) — shunda pullFromCloud() to'xtaydi va
  // ensureCloudPull() buni HAQIQIY muvaffaqiyatsizlik deb bilib,
  // qayta uradi (token/tarmoq tayyor bo'lguncha).
  await _sb.rpc('set_current_shop_id', { p_shop_id: sid });
}

// Bu sessiyada bulutdan yuklab olish (pull) muvaffaqiyatli tugadimi?
// Push FAQAT shundan keyin ruxsat etiladi — eskirgan lokal nusxa
// bulutdagi yangi ma'lumotlarni yozib yubormasligi uchun.
let _sbLastToken = null; // client qaysi token bilan qurilgani (v159)
let _cloudPullDone = false;

// O'chirish sinxroni uchun holat:
// _cloudIds — oxirgi pull'da bulutda KO'RILGAN yozuvlar (jadval bo'yicha).
//   Push paytida lokaldan yo'qolganlari = foydalanuvchi o'chirgan.
// _tombstones — "o'chirilganlar daftari" (deleted_records jadvalidan),
//   pull/merge ularni qayta tiriltirmasligi uchun.
let _cloudIds = {};
let _tombstones = new Set();
// 2026-07-25: foydalanuvchi TUGMA BOSIB o'chirganda yoqiladi. Shunda
// "ommaviy o'chirish" himoyasi (himoya 2) chetlab o'tiladi — u tasodifiy
// o'chishdan saqlash uchun edi, ataylab qilingan amalni to'smasligi kerak.
// Bo'sh-db himoyasi (himoya 1) BARIBIR ISHLAYDI.
let _intentionalDelete = false;
// Pull QAYSI do'kon uchun bo'lgan — SA do'kon almashtirganda
// eski ro'yxat yangi do'konga qo'llanib ketmasligi uchun (KRITIK)
let _pulledShopId = null;

// v176 (2026-07-10): DELTA-PUSH KESHI — jadval -> (id -> oxirgi
// muvaffaqiyatli yuborilgan yozuvning JSON matni). Shu tufayli har
// sinxronda BUTUN baza emas, faqat O'ZGARGAN yozuvlar yuboriladi.
// Kesh xotirada (sahifa yangilansa bo'shaydi) — birinchi push to'liq,
// keyingilari mayda va tez bo'ladi.
let _pushCache = {};

// Delta-upsert: rows ichidan faqat keshdagidan farq qilganlarini
// yuboradi; kesh FAQAT muvaffaqiyatli chunk'dan keyin yangilanadi
// (xato bo'lsa, o'sha yozuvlar keyingi sinxronda qayta uriniladi).
// ══════════════════════════════════════════════════════════════
// PUSH KESHI — SAHIFA YANGILANGANDA HAM SAQLANADI (2026-07-31)
// ══════════════════════════════════════════════════════════════
// MUAMMO: kesh faqat XOTIRADA edi. Har sahifa yangilanishida u
// bo'shab, ilova BUTUN bazani qaytadan bulutga yozardi. Server
// tetigi esa har yozuvga yangi vaqt muhrini bosadi — natijada
// "hamma narsa o'zgardi" bo'lib, delta 474 qatorni qayta-qayta
// tortardi. Ya'ni delta'ning foydasi yo'qolardi.
//
// ENDI: har qatorning qisqa BARMOQ IZI localStorage'da saqlanadi.
// Sahifa yangilangach ilova nima o'zgarmaganini biladi va ortiqcha
// yozmaydi. Hajmi kichik (qator boshiga ~20 belgi).
function _fp(str) {                       // qisqa barmoq izi
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return str.length + ":" + (h >>> 0).toString(36);
}
function _pushCacheKey() { return "merx_pushfp_" + (getCloudShopId() || "x"); }
function _loadPushCache() {
  try {
    const raw = localStorage.getItem(_pushCacheKey());
    if (!raw) return;
    const o = JSON.parse(raw);
    for (const t in o) _pushCache[t] = new Map(Object.entries(o[t]));
    console.log("♻️ Push keshi tiklandi — ortiqcha yozuv bo'lmaydi");
  } catch(e) {}
}
let _pcSaveTimer = null;
function _savePushCache() {
  clearTimeout(_pcSaveTimer);
  _pcSaveTimer = setTimeout(() => {
    try {
      const o = {};
      for (const t in _pushCache) o[t] = Object.fromEntries(_pushCache[t]);
      localStorage.setItem(_pushCacheKey(), JSON.stringify(o));
    } catch(e) {}
  }, 1500);
}

async function _deltaUpsert(table, rows, chunkSize, conflict, onDirty) {
  if (!rows || !rows.length) return 0;
  const cache = _pushCache[table] || (_pushCache[table] = new Map());
  const pend = [];
  for (const r of rows) {
    const k = String(r.id != null ? r.id : r.shop_id);
    const j0 = _fp(JSON.stringify(r));
    if (cache.get(k) !== j0) {
      // v180: VAQT MUHRI — o'zgargan yozuvga muhr onDirty ichida
      // bosiladi (MUHRDAN KEYINGI JSON keshga yoziladi, aks holda
      // har push "o'zgargan" deb hisoblab abadiy aylanardi)
      if (onDirty) onDirty(r);
      pend.push([r, k, _fp(JSON.stringify(r))]);
    }
  }
  if (!pend.length) return 0;
  // v180: muhrlar DARHOL lokalga yoziladi (upsert xato bersa ham) —
  // oflayn tahrir stsenariysida muhr localStorage'da saqlanib qoladi.
  // saveDB EMAS — to'g'ridan-to'g'ri (13-qoida, aylanma taqiqi).
  if (onDirty) { try {
    /* 2026-07-31: og'ir jadvallar IndexedDB'da — localStorage'ga
                   YENGIL nusxa yoziladi (aks holda sotuvlar u yerda
                   qolib, 5 MB chegarasi qaytarardi) */
    localStorage.setItem(getDBKEY(), JSON.stringify((typeof _dbForLocal === "function" ? _dbForLocal() : db)));
    if (typeof scheduleHeavySave === "function") scheduleHeavySave();
  } catch(e) {} }
  const chunk = chunkSize || 50;
  for (let i = 0; i < pend.length; i += chunk) {
    const part = pend.slice(i, i + chunk);
    const { error } = await _sb.from(table)
      .upsert(part.map(p => p[0]), { onConflict: conflict || "id", ignoreDuplicates: false });
    if (error) throw error;
    part.forEach(([r, k, j]) => cache.set(k, j));
    _savePushCache();   // 2026-07-31: sahifa yangilansa ham saqlanadi
  }
  return pend.length;
}

// ── v181: RASMLAR SUPABASE STORAGE'GA (2026-07-10) ────────────────
// Muammo: rasmlar matn (base64) ko'rinishida bazada VA telefon
// xotirasida (localStorage ~5-10MB chegara!) turardi — 1000 tovarli
// do'kon uchun bu devor. Yechim: har sinxronda bir nechta "matn-rasm"
// fayl omboriga (bucket: product-images) yuklanadi, o'rniga KICHIK
// HAVOLA (URL) qo'yiladi. UI (<img>) ham, bot ham URL bilan azaldan
// ishlaydi. Mavjud minglab tovar ham shu yo'l bilan ASTA-SEKIN,
// avtomatik ko'chadi. DIQQAT: bucket va ruxsatlar SQL bilan avval
// yaratilgan bo'lishi kerak (STORAGE-SOZLASH.sql) — bo'lmasa mexanizm
// jim chekinadi va eski (base64) yo'l ishlayveradi.
const _IMG_BUCKET = "product-images";
const _IMG_PER_SYNC = 20; // har sinxronda ko'pi bilan shuncha rasm
async function _dataUrlToBlob(d) { const r = await fetch(d); return await r.blob(); }
async function _uploadOneImage(sid, sku, tag, dataUrl) {
  const path = sid + "/" + String(sku).replace(/[^\w.-]/g, "_") + "_" + tag + "_" + Date.now() + ".jpg";
  const blob = await _dataUrlToBlob(dataUrl);
  const { error } = await _sb.storage.from(_IMG_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  const { data } = _sb.storage.from(_IMG_BUCKET).getPublicUrl(path);
  if (!data || !data.publicUrl) throw new Error("publicUrl olinmadi");
  return data.publicUrl;
}
async function _migrateImagesToStorage(sid) {
  if (!_sb || !sid) return 0;
  let moved = 0;
  try {
    for (const p of (db.products || [])) {
      if (moved >= _IMG_PER_SYNC) break;
      if (p.image && typeof p.image === "string" && p.image.startsWith("data:image")) {
        p.image = await _uploadOneImage(sid, p.sku, "main", p.image);
        moved++;
      }
      if (p.colorImages && typeof p.colorImages === "object") {
        for (const c of Object.keys(p.colorImages)) {
          if (moved >= _IMG_PER_SYNC) break;
          const v = p.colorImages[c];
          if (v && typeof v === "string" && v.startsWith("data:image")) {
            p.colorImages[c] = await _uploadOneImage(sid, p.sku, "c_" + String(c).replace(/[^\w-]/g, "_"), v);
            moved++;
          }
        }
      }
    }
  } catch (e) {
    // Bucket hali yaratilmagan / tarmoq xatosi — JIM chekinamiz:
    // eski base64 yo'l ishlashda davom etadi, keyingi sinxronda
    // qolgan rasmlar qayta uriniladi. (Yarim ko'chgan holat XAVFSIZ:
    // ko'chganlari URL, qolganlari base64 — ikkalasi ham ishlaydi.)
    console.warn("🖼️ Rasm ko'chirish to'xtadi (keyingi sinxronda davom etadi):", e.message || e);
  }
  if (moved > 0) {
    // Havolalar DARHOL lokalga (13-qoida: saveDB EMAS — aylanma taqiqi).
    // O'zgargan tovarlar delta-push'da o'zi "yangi" deb aniqlanib,
    // vaqt muhri bilan bulutga ketadi.
    try {
      /* 2026-07-31: og'ir jadvallar IndexedDB'da — localStorage'ga
                   YENGIL nusxa yoziladi (aks holda sotuvlar u yerda
                   qolib, 5 MB chegarasi qaytarardi) */
      localStorage.setItem(getDBKEY(), JSON.stringify((typeof _dbForLocal === "function" ? _dbForLocal() : db)));
      if (typeof scheduleHeavySave === "function") scheduleHeavySave();
    } catch (e) {}
    console.log("🖼️ " + moved + " ta rasm Storage'ga ko'chirildi (URL)");
  }
  return moved;
}

async function pushToCloud() {
  // v166: push oldidan token yangiligi + client mosligi ta'minlanadi
  try { await initSupabase(); } catch(e) {}
  if (!_sb) { toast("Avval ulaning","err"); return; }
  const _sid = getCloudShopId();
  if (!_sid) {
    console.warn("Cloud push o'tkazib yuborildi: do'kon ID yo'q (tizimga kirilmagan)");
    return;
  }
  if (!_cloudPullDone || _pulledShopId !== _sid) {
    console.warn("Cloud push kutmoqda: AYNAN SHU do'kon uchun pull tugashi kerak (do'kon almashgan bo'lishi mumkin)");
    if (typeof ensureCloudPull === "function") ensureCloudPull();
    return;
  }
  // 2026-07-19: BO'SH-DB HIMOYASI (push darajasida ham).
  // Agar lokal deyarli bo'sh (0-2 yozuv) lekin bulutda ko'p bor bo'lsa —
  // push umuman qilinmaydi (bo'sh db haqiqiy ma'lumotni yozib yubormasin).
  try {
    const _tl = (db.products||[]).length + (db.sales||[]).length +
                (db.customers||[]).length + (db.ombor||[]).length +
                (db.debtPayments||[]).length;
    const _tc = ((_cloudIds.products&&_cloudIds.products.size)||0) +
                ((_cloudIds.sales&&_cloudIds.sales.size)||0) +
                ((_cloudIds.customers&&_cloudIds.customers.size)||0) +
                ((_cloudIds.ombor&&_cloudIds.ombor.size)||0) +
                ((_cloudIds.debt_payments&&_cloudIds.debt_payments.size)||0);
    if (_tl <= 2 && _tc >= 5) {
      console.warn("🛡 PUSH BLOKLANDI: lokal bo'sh (" + _tl + "), bulutda " + _tc +
        " yozuv — ma'lumot himoyalandi. 'Yangilash' bosing yoki chiqib-kiring.");
      return;
    }
  } catch(e) {}
  // ── VERSIYA QO'RIQCHISI (2026-07-31: YUMSHATILDI) ────────────
  // AVVAL: versiya mos kelmasa push BUTUNLAY to'xtardi. Amalda bu
  // xavfliroq bo'lib chiqdi — tekshiruv noto'g'ri ishlaganda do'kon
  // ma'lumoti bulutga UMUMAN ketmay qolardi (sotuvlar faqat
  // qurilmada qolib ketishi mumkin edi).
  // ENDI: ogohlantiramiz, lekin YOZAMIZ. Ma'lumot yo'qolishi
  // eskirgan koddan kelib chiqadigan xavfdan og'irroq.
  try {
    if (await checkAppVersion() === false)
      console.warn("⚠️ Ilova versiyasi eskirgan — sinxron davom etmoqda, ilova tez orada yangilanadi");
  } catch(e) {}

  // v181: navbatdagi partiya rasmlarni fayl omboriga ko'chirish
  // (bucket tayyor bo'lmasa — jim o'tib ketadi, hech narsa buzilmaydi)
  try { await _migrateImagesToStorage(_sid); } catch (e) {}
  // v183: pull uchun xato qayta otilishi kerak (qayta urinish ishlashi
  // uchun), lekin push uchun shart emas — muvaffaqiyatsiz bo'lsa
  // keyingi rejalashtirilgan sinxronlashda (scheduleCloudSync) o'zi
  // qayta urinadi, hozircha jim chiqib ketamiz.
  try { await _setShopContext(_sid); }
  catch(e) { console.warn("Cloud push: do'kon konteksti o'rnatilmadi, keyinroq qayta urinamiz:", e.message); return; }
  const sid = _sid;
  try {
    // Settings
    // Settings — eski schema id=1, yangi schema shop_id
    // Settings — shop_id asosida upsert
    if (sid && sid !== "local" && sid !== "default") {
      try {
        // v176: settings ham delta orqali — o'zgarmagan bo'lsa yuborilmaydi
        await _deltaUpsert("settings", [{
          shop_id:        sid,
          shop_name:      db.shop?.name || "MERX",
          rate:           db.settings?.rate || 12800,
          price_currency: db.settings?.priceCurrency || "uzs",
          shop_type:      db.settings?.shopType || null,
          // ⚠️ 2026-07-26: currency_mode do'kondan PUSH QILINMAYDI —
          // u SuperAdmin boshqaradigan maydon. Aks holda do'kon o'z
          // eski qiymatini qaytarib yozib, SuperAdmin sozlamasini
          // bekor qilardi (12-qoida: server yozadigan ustunlar ustun).
          eskiz_token:    db.settings?.eskizToken    || null,
          eskiz_sender:   db.settings?.eskizSender   || null,
          telegram_bot:   db.settings?.telegramBotUrl || null,
          telegram_bot_username: db.settings?.telegramBotUsername || null,
          staff_group_id: db.settings?.staffGroupId  || null,
          loyalty_rate:   db.settings?.loyaltyRate   || 0,
          loyalty_value:  db.settings?.loyaltyValue  || 100,
          rate_mode:       db.settings?.rateMode      || "manual",
          rate_updated_at: db.settings?.rateUpdatedAt || null,
          debt_pay_methods_shown: db.settings?.debtPayMethodsShown || null,
          debt_cols:              db.settings?.debtCols            || null,
          unit_tags:              db.settings?.unitTags            || null, // №11a (v186)
          chek_config:            db.settings?.chekConfig          || null, // №12 (v187)
          pack_unit_tags:         db.settings?.packUnitTags        || null,
          // v172 (2026-07-10): SOZLAMALAR SINXRON SIMMETRIYASI.
          // low_stock_limit — bot Supabase'dan o'qiydi, lekin bu yerdan
          // hech qachon yozilmagan (bot doim standart 5 bilan ishlardi).
          // pos_pay_blocked/pos_staff_locked — POS qulflari avval faqat
          // bitta qurilmada qolardi, endi barcha qurilmalarga o'tadi.
          low_stock_limit:  db.settings?.lowStockLimit  ?? null,
          pos_pay_blocked:  db.settings?.posPayBlocked  || null,
          pos_staff_locked: db.settings?.posStaffLocked === true,
        }], 1, "shop_id");
      } catch(e) { console.warn("settings upsert xato:", e.message); }
    }

    // Helper — upsert id asosida, xato bo'lsa warning, davom etadi
    async function sync(table, rows) {
      // v176: faqat o'zgargan yozuvlar (delta) yuboriladi
      return _deltaUpsert(table, rows, 50);
    }

    // Customers uchun alohida sync — telegram_chat_id ni HECH QACHON o'zgartirmaymiz
    async function syncCustomers(customers) {
      if (!customers || !customers.length) return;
      // v176: avval hamma qator yig'iladi, keyin faqat o'zgarganlari ketadi
      const custRows = customers.map(c => {
          const row = {
            shop_id: sid, id: c.id, name: c.name,
            phone: c.phone || null,
            type: c.type || "ulgurji",
            balance_uzs: c.balanceUzs || 0,
            balance_usd: c.balanceUsd || 0
          };
          // Yangi schema ustunlari — mavjud bo'lsa
          if (c.phone2 !== undefined)        row.phone2         = c.phone2 || null;
          if (c.company !== undefined)       row.company        = c.company || null;
          if (c.note !== undefined)          row.note           = c.note || null;
          if (c.importantNote !== undefined) row.important_note = c.importantNote || null;
          if (c.birthday !== undefined)      row.birthday       = c.birthday || null;
          if (c.source !== undefined)        row.source         = c.source || null;
          if (c.debtLimit !== undefined)     row.debt_limit     = c.debtLimit || null;
          if (c.loyaltyPoints !== undefined)   row.loyalty_points   = c.loyaltyPoints || 0;
          if (c.telegramChatId !== undefined)  row.telegram_chat_id = c.telegramChatId || null;
          // v174 (2026-07-10): BUTUN JSON — mijoz to'liq nusxada ham
          // saqlanadi. Kelajakda yangi maydon qo'shilsa, mapping'siz
          // ham avtomatik sinxron bo'ladi.
          row.data = { ...c };
          return row;
        });
      // v180: o'zgargan mijozga vaqt muhri
      await _deltaUpsert("customers", custRows, 50, null, (row) => {
        const _t = new Date().toISOString();
        const lc = (db.customers || []).find(x => String(x.id) === String(row.id));
        if (lc) lc.updatedAt = _t;
        if (row.data) row.data.updatedAt = _t;
      });
    }

    // Har bir jadvalni mustaqil sinxronlaymiz
    // Biri xato bersada, qolganlar davom etadi
    const syncErrors = [];

    try {
      // products: sku bo'yicha upsert (id emas) — ikki marta conflict bo'lmasligi uchun
      // v173 (2026-07-10): BUTUN JSON MODELI — tovar bulutda TO'LIQ
      // nusxada ham saqlanadi ("data" ustuni). Rasmlar (image,
      // colorImages) ATAYLAB chiqarib tashlanadi — ular o'z alohida
      // ustunlarida turadi, JSON ichida takrorlansa yuklama 2 barobar
      // og'irlashardi. Endi yangi maydon qo'shilsa, u mapping'ga
      // qo'shishni unutib qo'yilsa ham data orqali AVTOMATIK sinxron
      // bo'ladi (9-qoida xatosi products uchun tugadi). Ustunlar esa
      // bot (api/bot.js faqat O'QIYDI) va SQL so'rovlar uchun qoladi.
      const _prodData = p => { const c = { ...p };
        delete c.image; delete c.colorImages; delete c.shop_id; return c; };
      const prodRows = (db.products||[])
        .filter(p => p.id != null)
        .map(p => ({
          shop_id: sid, id: p.id,
          sku: p.sku, name: p.name,
          category: p.category, type: p.type,
          unit: p.unit || "dona",
          art: p.art || "",
          cost_usd: p.costUsd || 0,
          price_uzs: p.priceUzs || 0,
          ulgurji: p.ulgurjiNarx || 0,
          variants: p.variants || [],
          image: p.image || null,
          color_images: p.colorImages || null,
          // v171 (2026-07-10): PUSH↔PULL SIMMETRIYA TUZATISHI.
          // Bu maydonlar pull'da O'QILARDI, lekin push'da YO'Q edi —
          // natijada har pull'da inBox→1, barcode→yo'q bo'lib
          // "ma'lumot o'chish" yuzaga kelardi. ESLATMA: bu ustunlar
          // Supabase'da bo'lishi SHART (SQL avval bajarilsin!).
          in_box: p.inBox || 1,
          barcode: p.barcode || null,
          pack_unit: p.packUnit || null,
          color_barcodes: p.colorBarcodes || null,
          pantone: p.pantone || null,
          color_name: p.colorName || null,
          hex: p.hex || null,
          data: _prodData(p) // v173: to'liq nusxa (rasmlarsiz)
        }));
      if (prodRows?.length) {
        // v176: delta — o'zgarmagan tovarlar (ayniqsa katta rasmlilari!)
        // endi qayta-qayta yuborilmaydi. Chunk 20 — rasm katta.
        // v180: o'zgargan tovarga vaqt muhri (lokalga HAM, data'ga HAM)
        await _deltaUpsert("products", prodRows, 20, null, (row) => {
          const _t = new Date().toISOString();
          const lp = (db.products || []).find(x => String(x.sku) === String(row.sku));
          if (lp) lp.updatedAt = _t;
          if (row.data) row.data.updatedAt = _t;
        });
      }
    } catch(e) { syncErrors.push("products: " + e.message); console.warn("sync products xato:", e.message); }

    try {
      await syncCustomers(db.customers);
    } catch(e) { syncErrors.push("customers: " + e.message); console.warn("sync customers xato:", e.message); }

    // v175 (2026-07-10): BUTUN JSON — qolgan jadvallar uchun yordamchi.
    // Rasm turidagi maydonlar (image, colorImages, photo) data'ga
    // ATAYLAB kirmaydi (hajm og'irlashmasin).
    const _dataOf = o => { const c = { ...o };
      delete c.image; delete c.colorImages; delete c.photo; delete c.shop_id; return c; };

    try {
      // Avval asosiy ustunlar (eski schema bilan mos)
      const staffRows = db.staff?.map(s => {
        const row = {
          shop_id: sid, id: s.id, name: s.name,
          phone: s.phone || null,
          role: s.role || "kassir"
        };
        // Ruxsatlar va modullarni JSON ga o'tkazamiz
        if (s.permissions) {
          try { row.permissions = typeof s.permissions === "string"
            ? s.permissions : JSON.stringify(s.permissions); } catch(e) {}
        }
        if (s.modules) {
          try { row.modules = typeof s.modules === "string"
            ? s.modules : JSON.stringify(s.modules); } catch(e) {}
        }
        if (s.pin !== undefined) row.pin = s.pin || null;
        // Maosh va ruxsatlar — YANGI (oldin sync bo'lmasdi)
        if (s.salary !== undefined)        row.salary         = s.salary || 0;
        if (s.bonusPct !== undefined)      row.bonus_pct      = s.bonusPct || 0;
        if (s.monthTarget !== undefined)   row.month_target   = s.monthTarget || 0;
        if (s.permDiscount !== undefined)  row.perm_discount  = !!s.permDiscount;
        if (s.maxDiscount !== undefined)   row.max_discount   = s.maxDiscount || 0;
        if (s.permNasiya !== undefined)    row.perm_nasiya    = !!s.permNasiya;
        if (s.permReturn !== undefined)    row.perm_return    = !!s.permReturn;
        if (s.paidMonths !== undefined)    row.paid_months    = s.paidMonths || [];
        if (s.salaryHistory !== undefined) row.salary_history = s.salaryHistory || [];
        row.data = _dataOf(s); // v175: BUTUN JSON
        return row;
      });
      await sync("staff", staffRows);
    } catch(e) { syncErrors.push("staff: " + e.message); console.warn("sync staff xato:", e.message); }

    try {
      await sync("sales", db.sales?.map(s => ({
        shop_id: sid, id: s.id,
        chek_num: s.chekNum || null,
        date: s.date, time: s.time || null,
        price_type: s.priceType, pay_type: s.payType,
        pay_breakdown: s.payBreakdown || null,
        items: (s.items || []).map(({ image, ...rest }) => rest), // image base64 ni Supabase ga yubormaymiz (juda katta)
        total: s.total || 0, paid: s.paid || 0,
        remaining: s.remaining || 0,
        due: s.due || null,
        customer_id: s.customerId || null,
        customer_name: s.customerName || null,
        customer_phone: s.customerPhone || null,
        staff_id: s.staffId || null,
        status: s.status || "tolandan",
        debt_currency: s.debtCurrency || "uzs",
        debt_usd: s.debtUsd != null ? s.debtUsd : null,
        // Asl (o'zgarmas) qiymatlar — qarz to'lovlari bularga tegmaydi.
        // Bularsiz calcSaleState() boshqa qurilmada noto'g'ri ishlaydi.
        orig_paid: s.origPaid != null ? s.origPaid : (s.paid || 0),
        orig_remaining: s.origRemaining != null ? s.origRemaining : (s.remaining || 0),
        orig_debt_usd: s.origDebtUsd != null ? s.origDebtUsd : null,
        // v174 (2026-07-10): BUTUN JSON — sotuv to'liq nusxada ham
        // saqlanadi (subtotal/discount/note kabi push'da unutilgan
        // maydonlar ham endi yo'qolmaydi). Items ichidagi rasmlar
        // yuqoridagi kabi ATAYLAB olib tashlanadi (juda katta).
        data: { ...s, items: (s.items || []).map(({ image, ...rest }) => rest) }
      })));
    } catch(e) { syncErrors.push("sales: " + e.message); console.warn("sync sales xato:", e.message); }

    try {
      await sync("ombor", db.ombor?.map(o => ({
        shop_id: sid, id: o.id, date: o.date,
        sku: o.sku || null,
        product_name: o.productName,
        unit: o.unit, color: o.color,
        size: o.size, qty: o.qty || 0,
        boxes: o.boxes || null,
        pantone: o.pantone || null,
        hex: o.hex || null,
        kirim_narxi: o.kirimNarxi || 0,
        chakana: o.chakana || 0,
        ulgurji: o.ulgurji || 0,
        supplier: o.supplier || null,
        partiya: o.partiya || null,
        pay_status: o.payStatus || "tolandan",
        barcode: o.barcode || null,
        data: _dataOf(o) // v175: BUTUN JSON
      })));
    } catch(e) { syncErrors.push("ombor: " + e.message); console.warn("sync ombor xato:", e.message); }

    try {
      await sync("xarajatlar", (db.xarajatlar||[]).map(x => ({
        shop_id: sid, id: x.id, date: x.date,
        category: x.category,
        amount: x.amount || 0,
        note: x.note || null,
        recipient: x.recipient || null,
        paid_by: x.paidBy || null,
        method: x.method || null,
        amount_usd: x.amountUsd != null ? x.amountUsd : null,
        recurring: !!x.recurring,
        sub_category: x.subCategory || null,
        xarajat_type: x.xarajatType || null,
        for_month: x.forMonth || null,
        data: _dataOf(x) // v175: BUTUN JSON
      })));
    } catch(e) { syncErrors.push("xarajatlar: " + e.message); console.warn("sync xarajatlar xato:", e.message); }

    // Chiqimlar (ombordan chiqim) — 2026-07 gacha push qilinmasdi (teshik edi)
    try {
      await sync("chiqimlar", (db.chiqimlar||[]).map(c => ({
        shop_id: sid, id: String(c.id),
        local_id: parseInt(c.id) || null,
        date: c.date, time: c.time || null,
        product_name: c.productName, sku: c.sku || null,
        color: c.color || null, size: c.size || null,
        qty: c.qty || 0, unit: c.unit || "dona",
        reason: c.reason || null, note: c.note || null,
        cost_uzs: Math.round(c.costUzs || 0),
        cost_usd_each: c.costUsdEach != null ? c.costUsdEach : null,
        data: _dataOf(c) // v175: BUTUN JSON
      })));
    } catch(e) { syncErrors.push("chiqimlar: " + e.message); console.warn("sync chiqimlar xato:", e.message); }

    try {
      await sync("debt_payments", (db.debtPayments||[]).map(p => ({
        shop_id: sid,
        id: p.id,
        chek_num: p.chekNum || null,
        date: p.date,
        time: p.time || null,
        amount: p.amount || 0,
        currency: p.currency || "uzs",
        method: p.method || "naqd",
        customer_id: p.customerId || null,
        customer_name: p.customerName || null,
        customer_phone: p.customerPhone || null,
        staff_id: p.staffId || null,
        note: p.note || null,
        allocations: p.allocations || [],
        leftover: p.leftover || 0,
        leftover_to_balance: !!p.leftoverToBalance,
        debt_before: p.debtBefore != null ? p.debtBefore : null,
        debt_after:  p.debtAfter  != null ? p.debtAfter  : null,
        method_breakdown: p.methodBreakdown || null,
        rate: p.rate || null,
        // v174 (2026-07-10): BUTUN JSON — to'lov to'liq nusxada ham
        data: { ...p }
      })));
    } catch(e) { syncErrors.push("debt_payments: " + e.message); console.warn("sync debt_payments xato:", e.message); }

    try {
      await sync("returns", (db.returns||[]).map(r => ({
        shop_id: sid, id: r.id,
        date: r.date, time: r.time || null,
        orig_sale_id: r.origSaleId || null,
        orig_chek_num: r.origChekNum || null,
        items: r.items || [],
        total: r.total || 0,
        reason: r.reason || null,
        customer_name: r.customerName || null,
        staff_id: r.staffId || null,
        // v175: BUTUN JSON — items ichidagi rasmlar sales'dagidek olib tashlanadi
        data: { ..._dataOf(r), items: (r.items || []).map(({ image, ...rest }) => rest) }
      })));
    } catch(e) { syncErrors.push("returns: " + e.message); console.warn("sync returns xato:", e.message); }

    try {
      await sync("shifts", (db.shifts||[]).map(sh => ({
        shop_id: sid, id: sh.id,
        staff_id: sh.staffId || null,
        open_time: sh.openTime || null,
        open_date: sh.openDate || null,
        open_cash: sh.openCash || 0,
        note: sh.note || null,
        close_time: sh.closeTime || null,
        close_cash: sh.closeCash != null ? sh.closeCash : null,
        diff: sh.diff != null ? sh.diff : null,
        data: _dataOf(sh) // v175: BUTUN JSON
      })));
    } catch(e) { syncErrors.push("shifts: " + e.message); console.warn("sync shifts xato:", e.message); }

    try {
      await sync("suppliers", (db.suppliers||[]).map(s => ({
        shop_id: sid, id: s.id,
        name: s.name || null,
        phone: s.phone || null,
        note: s.note || null,
        data: _dataOf(s) // v175: BUTUN JSON
      })));
    } catch(e) { syncErrors.push("suppliers: " + e.message); console.warn("sync suppliers xato:", e.message); }

    // ── O'CHIRISHLARNI SINXRONLASH ────────────────────────────────
    // Mantiq: pull'da bulutda KO'RILGAN (_cloudIds), lekin hozir lokalda
    // YO'Q yozuv = foydalanuvchi o'chirgan. Uni: (1) o'chirilganlar
    // daftariga (deleted_records) yozamiz — boshqa qurilmalarda ham
    // tirilmasin, (2) bulutdan o'chiramiz.
    // MUHIM: faqat O'ZIMIZ pull'da ko'rgan yozuvlar tekshiriladi —
    // boshqa qurilma shu orada qo'shgan yangi yozuvlarga tegilmaydi.
    try {
      const delMap = {
        products:      { rows: db.products,     key: "sku", col: "sku" },
        customers:     { rows: db.customers,    key: "id",  col: "id" },
        staff:         { rows: db.staff,        key: "id",  col: "id" },
        sales:         { rows: db.sales,        key: "id",  col: "id" },
        ombor:         { rows: db.ombor,        key: "id",  col: "id" },
        xarajatlar:    { rows: db.xarajatlar,   key: "id",  col: "id" },
        chiqimlar:     { rows: db.chiqimlar,    key: "id",  col: "id" },
        debt_payments: { rows: db.debtPayments, key: "id",  col: "id" },
        returns:       { rows: db.returns,      key: "id",  col: "id" },
        shifts:        { rows: db.shifts,       key: "id",  col: "id" },
        suppliers:     { rows: db.suppliers,    key: "id",  col: "id" }
      };
      // ═══════════════════════════════════════════════════════════
      // 2026-07-19: BO'SH-LOKAL / OMMAVIY-O'CHIRISH HIMOYASI (kritik)
      // Muammo: bo'sh yoki yarim yuklangan qurilma "bulutda bor, menda
      // yo'q" deb HAMMA yozuvni o'chirib, bulutni bo'shatardi (2 marta
      // ma'lumot yo'qolishiga sabab bo'ldi). Endi delete-sync ishlashidan
      // OLDIN xavfsizlik tekshiruvi: lokal shubhali bo'sh bo'lsa — TO'XTAB
      // TURAMIZ (o'chirish umuman yuborilmaydi, ma'lumot himoyalanadi).
      const _totalLocal = (db.products||[]).length + (db.sales||[]).length +
                          (db.customers||[]).length + (db.ombor||[]).length +
                          (db.debtPayments||[]).length;
      const _totalCloud = ((_cloudIds.products&&_cloudIds.products.size)||0) +
                          ((_cloudIds.sales&&_cloudIds.sales.size)||0) +
                          ((_cloudIds.customers&&_cloudIds.customers.size)||0) +
                          ((_cloudIds.ombor&&_cloudIds.ombor.size)||0) +
                          ((_cloudIds.debt_payments&&_cloudIds.debt_payments.size)||0);
      // Himoya 1: lokal deyarli bo'sh (0-2 yozuv) lekin bulutda ko'p (5+) bor —
      // bu bo'sh/buzuq qurilma. O'CHIRISHNI BUTUNLAY BEKOR QILAMIZ.
      if (_totalLocal <= 2 && _totalCloud >= 5) {
        console.warn("🛡 O'CHIRISH BLOKLANDI: lokal bo'sh (" + _totalLocal +
          "), bulutda " + _totalCloud + " yozuv bor — ma'lumot himoyalandi. " +
          "Bulutdan qayta yuklash uchun 'Yangilash' bosing yoki chiqib-kiring.");
        if (typeof toast === "function") toast("⚠️ Ma'lumot himoyalandi: bulut bo'sh lokal bilan almashtirilmadi", "err");
        throw new Error("empty-local-guard"); // push to'xtaydi, o'chirish yuborilmaydi
      }
      // 2026-07-26: AVVAL navbatdagi o'chirishlarni bajaramiz — ular
      // _cloudIds ga BOG'LIQ EMAS, shuning uchun ishonchli
      try { await processPendingDeletes(sid); } catch(e) {}

      for (const [table, cfg] of Object.entries(delMap)) {
        const seen = _cloudIds[table];
        // Bulutda bu jadvaldan hech narsa ko'rilmagan — o'chiradigan narsa yo'q.
        // (Bo'sh jadvallar uchun bu NORMAL: xodim, chiqim, smena bo'lmasa.)
        if (!seen || seen.size === 0) continue;
        const localSet = new Set((cfg.rows||[]).map(r => String(r[cfg.key])));
        const gone = [...seen.entries()].filter(([k]) => !localSet.has(k));
        if (!gone.length) continue;
        // Himoya 2: bitta jadvaldan bir vaqtda YARMIDAN KO'P (va 5+) o'chirilsa —
        // bu ommaviy o'chirish, shubhali. Bloklaymiz (bexosdan o'chishni to'xtatadi).
        if (!_intentionalDelete && gone.length >= 5 && gone.length > seen.size * 0.5) {
          console.warn("🛡 " + table + ": ommaviy o'chirish bloklandi (" +
            gone.length + "/" + seen.size + ") — himoya. Ataylab bo'lsa bittalab o'chiring.");
          continue; // bu jadval o'chirilmaydi
        }
        if (_intentionalDelete && gone.length >= 5) {
          console.log("✔ " + table + ": " + gone.length +
            " ta o'chirish — foydalanuvchi ataylab bosgan, himoya chetlab o'tildi");
        }
        // 1) daftarga yozamiz
        const { error: tErr } = await _sb.from("deleted_records").upsert(
          gone.map(([k]) => ({ shop_id: sid, table_name: table, record_id: k })),
          { onConflict: "shop_id,table_name,record_id" });
        if (tErr) { console.warn("deleted_records yozish xato:", tErr.message); continue; }
        // 2) bulutdan o'chiramiz (asl qiymatlar bilan, 50 talab)
        const rawVals = gone.map(([,v]) => v);
        for (let i = 0; i < rawVals.length; i += 50) {
          const { error: dErr } = await _sb.from(table)
            .delete().eq("shop_id", sid).in(cfg.col, rawVals.slice(i, i+50));
          if (dErr) { console.warn(`${table} delete xato:`, dErr.message); break; }
        }
        gone.forEach(([k]) => { seen.delete(k); _tombstones.add(table + ":" + k); });
        console.log(`🗑 ${table}: ${gone.length} ta o'chirish bulutga sinxronlandi`);
      }
    } catch(e) { console.warn("O'chirish sinxron xato:", e.message); }

    if (syncErrors.length > 0) {
      toast(`⚠️ Saqlandi, lekin xatolar: ${syncErrors.join("; ")}`, "err");
    } else {
      // v178: muvaffaqiyat endi JIM — kassirni chalg'itmaydi.
      // (Xato bo'lsa toast CHIQADI — bu muhim va qoladi.)
      console.log("✅ Cloud sinxron OK");
      // 2026-07-26: navbatda qolgan o'chirishlar bo'lsa qayta urinamiz
      try {
        if ((db._pendingDeletes || []).length) {
          console.log(`🗑 navbatda ${db._pendingDeletes.length} ta o'chirish — qayta urinilmoqda`);
          await processPendingDeletes(sid);
        }
      } catch(e) {}
    }
    updateCloudUI(true);
    // Oxirgi sync vaqtini saqlaymiz.
    // v178: MUHIM — bu yerda saveDB() CHAQIRILMAYDI! saveDB har safar
    // scheduleCloudSync'ni ishga tushirib, "push -> lastSyncAt yangi ->
    // saveDB -> 2s dan keyin yana push" CHEKSIZ AYLANMASINI hosil
    // qilardi (pastdagi tinimsiz "saqlandi" yozuvlarining ildizi).
    // localStorage'ga to'g'ridan-to'g'ri, jimgina yozamiz:
    if (!db.settings) db.settings = {};
    db.settings.lastSyncAt = new Date().toISOString();
    try {
      /* 2026-07-31: og'ir jadvallar IndexedDB'da — localStorage'ga
                   YENGIL nusxa yoziladi (aks holda sotuvlar u yerda
                   qolib, 5 MB chegarasi qaytarardi) */
      localStorage.setItem(getDBKEY(), JSON.stringify((typeof _dbForLocal === "function" ? _dbForLocal() : db)));
      if (typeof scheduleHeavySave === "function") scheduleHeavySave();
    } catch(e) {}
    if (typeof adminRefreshSyncStats === "function") adminRefreshSyncStats();
  } catch(e) {
    toast("Xato: " + e.message, "err");
    console.error("Cloud push error:", e);
  }
}

// ── VERSIYA QO'RIQCHISI (2026-07) ──────────────────────────────
// index.html — versiyalar manifesti (7-qoida: JS bilan birga push).
// Qurilma serverdagi yangi index.html'ni keshsiz o'qib, o'zining
// cloud.js versiyasi bilan solishtiradi. Eski bo'lsa: ogohlantiradi
// va PUSH bloklanadi — eski kod bulutga yozolmaydi (telefon saboqi).
let _versionOk = null;
let _versionCheckedAt = 0;
let _verWarnAt = 0;
// 2026-07-12 (AbuSaxiy — MUHIM TUZATISH): avval faqat cloud.js
// versiyasi solishtirilardi. Aksariyat sessiyalarda esa pos.js yoki
// qarzlar.js versiyasi oshib, cloud.js O'ZGARMAGAN edi — natijada
// tizim "hech narsa yangilanmagan" deb hisoblab, banner HECH QACHON
// chiqmasdi va Ctrl+Shift+R doim qo'lda kerak bo'lardi. Endi index.html
// dagi BARCHA "js/xxx.js?v=NN" versiyalari yig'ilib solishtiriladi —
// istalgan bitta fayl versiyasi oshsa ham banner chiqadi.
function _jsVersionSignature(html) {
  const m = html.match(/js\/[a-z0-9_-]+\.js\?v=\d+/gi) || [];
  return m.sort().join("|");
}
async function checkAppVersion() {
  if (_versionOk !== null && Date.now() - _versionCheckedAt < 10 * 60 * 1000)
    return _versionOk; // 10 daqiqada bir tekshirish yetadi
  try {
    // 2026-07-12: outerHTML ishonchsiz (brauzer script src larini
    // o'zgartirishi mumkin). DOM'dagi haqiqiy script teg'laridan o'qiymiz.
    // ⚠️ POYGA HIMOYASI (2026-07-31)
    // `init.js` sahifa O'RTASIDA turadi va init() ni darhol ishga
    // tushiradi. `superadmin.js` esa oxirroqda (4897-qator). Tekshiruv
    // erta bajarilsa brauzer hali oxirgi skriptlarga yetib bormagan
    // bo'ladi — DOM'da 18 ta, serverda 19 ta chiqib, ilova o'zini
    // "eskirgan" deb hisoblardi. Sekin internetda bu doim takrorlanardi.
    // Shuning uchun sahifa TO'LIQ yuklanmaguncha tekshirmaymiz.
    if (document.readyState !== "complete") {
      _versionOk = true;          // hozircha to'g'ri deb hisoblaymiz
      _versionCheckedAt = 0;      // keyingi safar qayta tekshiriladi
      return true;
    }
    const _scripts = Array.from(document.querySelectorAll('script[src]'));
    const my = _scripts
      .map(s => (s.src.match(/js\/[a-z0-9_-]+\.js\?v=\d+/i)||[])[0]||"")
      .filter(Boolean).sort().join("|");
    const r = await fetch("/index.html", { cache: "no-store" });
    const html = await r.text();
    const srv = _jsVersionSignature(html);
    // Eskirgan deb FAQAT shu holda hisoblanadi: DOM'da serverda YO'Q
    // fayl bor (ya'ni bizda eski versiya). Serverda ortiqcha fayl
    // bo'lishi — hali yuklanmagani, xato emas.
    let _domOnly = [];
    try {
      const _a = my.split("|"), _b = srv.split("|");
      _domOnly = _a.filter(x => x && !_b.includes(x));
    } catch(e) {}
    _versionOk = !srv || !my || _domOnly.length === 0;
    _versionCheckedAt = Date.now();
    if (!_versionOk) {
      // Farqni ANIQ ko'rsatamiz — qaysi fayl mos kelmayotgani bilinsin
      try {
        const a = my.split("|"), b = srv.split("|");
        console.warn("❗ Versiya farqi → DOMda bor, serverda yo'q: " +
          JSON.stringify(a.filter(x => !b.includes(x))) +
          " | Serverda bor, DOMda yo'q: " +
          JSON.stringify(b.filter(x => !a.includes(x))) +
          " | DOM soni: " + a.length + ", server soni: " + b.length);
      } catch(e) { console.warn("❗ Versiya farqi", { my, srv }); }
      // v177: Ctrl+Shift+R KERAK EMAS — bitta tugmali banner chiqadi,
      // tugma sahifani kesh chetlab qayta ochadi (?upd=vaqt bilan).
      _showUpdateBanner();
    }
  } catch(e) { _versionOk = true; _versionCheckedAt = Date.now(); } // tekshirib bo'lmasa — bloklamaymiz
  return _versionOk;
}

// ── v177: YANGI VERSIYA BANNERI ────────────────────────────────
// Do'konlarga yangi versiya AVTOMAT yetib borishi uchun: yangi versiya
// aniqlansa, tepada sariq banner chiqadi. "Yangilash" tugmasi sahifani
// kesh chetlab (?upd=vaqt) qayta ochadi — Ctrl+Shift+R umuman kerak
// emas. Avtomatik reload ATAYLAB qilinmaydi: kassir savat yig'ayotgan
// paytda sahifa o'z-o'zidan yangilanib ketishi xavfli.
let _updBannerOn = false;
// ══════════════════════════════════════════════════════════════
// JIM YANGILANISH (2026-07-31)
// ══════════════════════════════════════════════════════════════
// AVVAL: yangi versiya chiqqanda tepada sariq banner turardi va
// foydalanuvchi "Yangilash" bosishi kerak edi. Do'kon egalari va
// sotuvchilar buni xatolik deb o'ylab shubhalanardi.
//
// ENDI: yangilanish O'ZI qo'llanadi. Lekin ish o'rtasida ekran
// yopilib qolmasligi uchun faqat XAVFSIZ paytda:
//   · ochiq oyna (modal) yo'q
//   · foydalanuvchi biror maydonga yozmayapti
//   · POS savati bo'sh (sotuv o'rtasi emas)
// Bularning birortasi bo'lsa — 20 soniyadan keyin qayta uriniladi.
// Shu shartlarni `_rtBusyUI()` allaqachon tekshiradi, takrorlanmadi.
let _updScheduled = false;

function _showUpdateBanner() { _autoUpdateWhenSafe(); }   // eski nom saqlandi

// ⚠️ HALQA HIMOYASI: qayta yuklashdan keyin ham versiya mos kelmasa
// (masalan server eski nusxani berayotgan bo'lsa) ilova cheksiz
// qayta yuklanib qolardi. Endi bir sessiyada KO'PI BILAN 2 marta
// uriniladi, keyin jim to'xtaydi — foydalanuvchi ishlayveradi.
function _updTries() {
  try { return parseInt(sessionStorage.getItem("merx_upd_tries") || "0", 10) || 0; }
  catch(e) { return 0; }
}
function _updTriesInc() {
  try { sessionStorage.setItem("merx_upd_tries", String(_updTries() + 1)); } catch(e) {}
}

function _autoUpdateWhenSafe() {
  if (_updScheduled) return;
  if (_updTries() >= 2) {
    console.warn("⏸ Avtomat yangilash to'xtatildi (2 marta urinildi) — keyingi ochilishda qayta uriniladi");
    return;
  }
  _updScheduled = true;
  const tryNow = () => {
    let busy = false;
    try { busy = _rtBusyUI(); } catch(e) {}
    // ⚠️ _syncPending bo'lsa QAYTA YUKLAMAYMIZ: `beforeunload` qo'riqchisi
    // brauzer tasdiq oynasini chiqarardi ("Perezagruzit sayt?").
    // Avval o'zgarish bulutga ketsin — keyin jim qayta yuklaymiz.
    if (typeof _syncPending !== "undefined" && _syncPending) {
      try { flushCloudSync(true); } catch(e) {}
      busy = true;
    }
    if (busy) { setTimeout(tryNow, 15000); return; }
    _updTriesInc();
    console.log("🔄 Yangi versiya jim qo'llanmoqda...");
    location.replace(location.pathname + "?upd=" + Date.now());
  };
  setTimeout(tryNow, 4000);
}

// Qo'lda chaqirish uchun (⟳ tugmasi ishlatadi)
function merxUpdateNow() {
  location.href = location.pathname + "?upd=" + Date.now();
}


// v177: yangi versiyani MUNTAZAM tekshirish — foydalanuvchi hech
// narsa qilmasa ham (30s dan keyin bir marta, so'ng har 10 daqiqada).
setTimeout(() => { try { checkAppVersion(); } catch(e) {} }, 30000);
setInterval(() => { try { checkAppVersion(); } catch(e) {} }, 10 * 60 * 1000 + 5000);

// ── Pull kafolati: muvaffaqiyatgacha qayta urinish ─────────────
// Pull o'tmasa push bloklangani uchun, bu funksiya pullni bir necha
// bor takrorlaydi (5s, 15s oraliq), keyin ham bo'lmasa har 60
// soniyada fonda urinib turadi — internet qaytishi bilan tiklanadi.
let _pullBusy = false;
let _syncSuppressed = false; // v184: realtime/zaxira pull paytida push'ni to'sadi (aylanma yo'q)
async function ensureCloudPull(tries = 3) {
  const want = getCloudShopId();
  const ok = () => _cloudPullDone && _pulledShopId === want;
  if (_pullBusy || ok()) return ok();
  _pullBusy = true;
  try {
  for (let i = 0; i < tries && !ok(); i++) {
    if (i > 0) {
      console.warn(`Pull qayta urinish ${i}/${tries-1}...`);
      await new Promise(r => setTimeout(r, i * 10000 - 5000));
    }
    try { await pullFromCloud(); } catch(e) { console.warn("pull xato:", e.message); }
  }

  } finally { _pullBusy = false; }
  if (!ok()) {
    console.warn("Pull hali o'tmadi — 60 soniyadan keyin fonda yana urinamiz");
    setTimeout(() => { if (!ok()) ensureCloudPull(2); }, 60000);
  }
  return ok();
}

// ── Supabase → LocalDB ────────────────────────────
async function pullFromCloud(silent = false, skipRender = false) {
  // v184: silent = muvaffaqiyat toast'lari jim (realtime/zaxira uchun)
  //       skipRender = ekran qayta chizilmaydi (fon-yangilash uchun)
  _pushCache = {}; // v176: pull'dan keyin birinchi push to'liq bo'lsin (xavfsizlik)
  if (!_sb) {
    const ok = await initSupabase();
    if (!ok) { toast("Avval ulaning","err"); return; }
  }
  // Versiya tekshiruvi (fonda — pull bloklanmaydi, faqat ogohlantiradi)
  checkAppVersion();

  // RLS: do'kon kontekstini o'rnatamiz
  const _pullSid = getCloudShopId();
  if (!_pullSid) {
    toast("Sinxronlash uchun avval tizimga kiring", "err");
    return;
  }
  await _setShopContext(_pullSid);

  try {
    if (!silent) toast("Ma'lumotlar yuklanmoqda...", "info");

    const sid = _pullSid;

    // O'chirilganlar daftarini o'qiymiz — bular hech qachon tirilmasin
    _tombstones = new Set();
    _cloudIds = {};
    try {
      const { data: delRecs } = await _sb.from("deleted_records")
        .select("table_name,record_id").eq("shop_id", sid);
      (delRecs||[]).forEach(d => _tombstones.add(d.table_name + ":" + d.record_id));
    } catch(e) { console.warn("deleted_records o'qish xato:", e.message); }

    // MERGE uchun lokal holatni suratga olamiz: bulut yozuvlari ustun,
    // lekin lokaldagi hali bulutga yetib bormagan YANGI yozuvlar
    // (masalan, internet uzilganda qilingan sotuvlar) yo'qolmaydi.
    const _loc = {
      products:     db.products     || [],
      customers:    db.customers    || [],
      staff:        db.staff        || [],
      sales:        db.sales        || [],
      ombor:        db.ombor        || [],
      xarajatlar:   db.xarajatlar   || [],
      chiqimlar:    db.chiqimlar    || [],
      debtPayments: db.debtPayments || [],
      returns:      db.returns      || [],
      shifts:       db.shifts       || [],
      suppliers:    db.suppliers    || []
    };

    // Products — faqat bu do'kon
    const prods = await _selectAll(() => _sb.from("products").select("*").eq("shop_id", sid), "products");
    _cloudIds["products"] = new Map((prods||[]).map(r => [String(r.sku), r.sku]));
    if (prods && prods.length > 0) {
      // v171 (2026-07-10): NULL-HIMOYA — bulutdagi eski yozuvlarda
      // in_box/barcode/pack_unit hali NULL (avval push qilinmagan).
      // Bunday holatda LOKALDAGI mavjud qiymat o'chirilmasin — aks
      // holda pull har safar inBox=1, barcode=yo'q qilib qo'yardi
      // (aynan shu "ma'lumot o'chish" muammosi edi).
      const _oldBySku = new Map((db.products || []).map(x => [String(x.sku), x]));
      db.products = prods.map(p => {
        const old = _oldBySku.get(String(p.sku)) || {};
        // v173 (2026-07-10): BUTUN JSON — bulutda to'liq nusxa ("data")
        // bo'lsa, tovar UNDAN tiklanadi: barcha maydonlar (hozirgi va
        // KELAJAKDA qo'shiladiganlar ham) avtomatik, yo'qotishsiz keladi.
        // Faqat rasmlar o'z ustunlaridan olinadi (data ichida ataylab
        // yo'q) va id/sku bulutdagi rasmiy qiymatdan qat'iy olinadi.
        if (p.data && typeof p.data === "object" && !Array.isArray(p.data)) {
          // v180: VAQT MUHRI TAQQOSI — lokal nusxa buluttagidan
          // YANGIROQ bo'lsa (oflayn tahrir + brauzer yopilgan holat),
          // LOKAL saqlanadi; keyingi push uni bulutga chiqaradi.
          const _locT = Date.parse(old.updatedAt || 0) || 0;
          const _cldT = Date.parse(p.data.updatedAt || 0) || 0;
          if (_locT > _cldT) return { ...old, shop_id: sid, id: p.id };
          return { ...p.data,
            shop_id: sid, id: p.id, sku: p.sku,
            image: _keepImg(p.image, old.image),
            colorImages: _keepColorImgs(p.color_images, old.colorImages),
            variants: (p.data.variants && p.data.variants.length ? p.data.variants : (p.variants || []))
          };
        }
        // ZAXIRA YO'L (data hali yo'q — eski yozuvlar): v171/v172
        // mapping NULL-himoya bilan, O'ZGARISHSIZ.
        return {
        shop_id: sid, id: p.id, // id SAQLANADI — busiz push filtri (p.id != null)
                                // pull'dan kelgan mahsulotlarni o'tkazmasdi va
                                // boshqa qurilmadagi TAHRIR bulutga qaytmasdi
        sku: p.sku, name: p.name, category: p.category || "",
        type: p.type || "oyoq", unit: p.unit || "dona",
        inBox: p.in_box != null ? p.in_box : (old.inBox || 1),
        art: p.art || "",
        barcode: p.barcode || old.barcode || "",
        image: _keepImg(p.image, old.image),
        costUsd: p.cost_usd || 0, priceUzs: p.price_uzs || 0,
        ulgurjiNarx: p.ulgurji || 0, variants: p.variants || [],
        pantone: p.pantone || null,
        colorName: p.color_name || null, hex: p.hex || null,
        colorImages: _keepColorImgs(p.color_images, old.colorImages),
        // v171: bu ikkisi pull'da UMUMAN yo'q edi
        packUnit: p.pack_unit || old.packUnit || "pochka",
        colorBarcodes: p.color_barcodes || old.colorBarcodes || null
        };
      });
    }

    // Customers
    const custs = await _selectAll(() => _sb.from("customers").select("*").eq("shop_id", sid), "customers");
    _cloudIds["customers"] = new Map((custs||[]).map(r => [String(r.id), r.id]));
    if (custs && custs.length > 0) {
      const _oldCust = new Map((db.customers || []).map(x => [String(x.id), x])); // v180
      db.customers = custs.map(c => {
        // v174: BUTUN JSON bo'lsa — undan tiklanadi. MUHIM ISTISNO:
        // telegramChatId har doim USTUNDAN olinadi, chunki bot mijoz
        // ulanganda shu ustunni to'g'ridan-to'g'ri yozadi (data'dagi
        // nusxa eskirgan bo'lishi mumkin).
        if (c.data && typeof c.data === "object" && !Array.isArray(c.data)) {
          // v180: lokal yangiroq bo'lsa — lokal g'olib (bot ustuni
          // telegram_chat_id baribir bulutdan olinadi — 12-qoida)
          const _oc = _oldCust.get(String(c.id)) || {};
          const _lt = Date.parse(_oc.updatedAt || 0) || 0;
          const _ct = Date.parse(c.data.updatedAt || 0) || 0;
          if (_lt > _ct) return { ..._oc, id: c.id,
            telegramChatId: c.telegram_chat_id || _oc.telegramChatId || null };
          return { ...c.data, id: c.id,
            telegramChatId: c.telegram_chat_id || null };
        }
        // ZAXIRA YO'L (data hali yo'q) — avvalgi mapping o'zgarishsiz
        return {
        id: c.id, name: c.name, phone: c.phone || "", phone2: c.phone2 || "",
        type: c.type || "ulgurji", note: c.note || "", company: c.company || "",
        telegramChatId: c.telegram_chat_id || null,
        importantNote: c.important_note || "", birthday: c.birthday || "",
        source: c.source || "", debtLimit: c.debt_limit || null,
        loyaltyPoints: c.loyalty_points || 0,
        balanceUzs: c.balance_uzs || 0, balanceUsd: c.balance_usd || 0
        };
      });
    }

    // Staff
    const staffData = await _selectAll(() => _sb.from("staff").select("*").eq("shop_id", sid), "staff");
    _cloudIds["staff"] = new Map((staffData||[]).map(r => [String(r.id), r.id]));
    if (staffData && staffData.length > 0) {
      db.staff = staffData.map(s => {
        // v175: BUTUN JSON bo'lsa — undan (barcha maydonlar avtomatik)
        if (s.data && typeof s.data === "object" && !Array.isArray(s.data)) return { ...s.data, id: s.id };
        const st = {
          id: s.id, name: s.name, phone: s.phone || "", role: s.role || "kassir",
          pin: s.pin || null, salary: s.salary || 0, bonusPct: s.bonus_pct || 0,
          monthTarget: s.month_target || 0,
          permDiscount: s.perm_discount || false, maxDiscount: s.max_discount || 0,
          permNasiya: s.perm_nasiya || false, permReturn: s.perm_return || false,
          paidMonths: s.paid_months || [], salaryHistory: s.salary_history || []
        };
        if (s.permissions) {
          try { st.permissions = typeof s.permissions === "string"
            ? JSON.parse(s.permissions) : s.permissions; } catch(e) {}
        }
        if (s.modules) {
          try { st.modules = typeof s.modules === "string"
            ? JSON.parse(s.modules) : s.modules; } catch(e) {}
        }
        return st;
      });
    }

    // Sales — OYNA bilan (2026-07-31)
    // Oxirgi 60 kun + to'lanmagan qarzlar (qancha eski bo'lsa ham).
    // `_cloudIds` ham SHU natijadan to'ladi — ya'ni o'chirish nazorati
    // oynadan tashqaridagi eski sotuvlarni "o'chirilgan" deb
    // hisoblamaydi va ularga tegmaydi.
    const _cut = syncCutoffDate();
    const salesData = await _selectAll(() => _sb.from("sales").select("*")
      .eq("shop_id", sid)
      .or(`date.gte.${_cut},remaining.gt.0`)
      .order("local_id"), "sales");
    console.log(`☁️ Sotuvlar oynasi: ${_cut} dan buyon + ochiq qarzlar → ${(salesData||[]).length} ta`);
    _cloudIds["sales"] = new Map((salesData||[]).map(r => [String(r.id), r.id]));
    // 2026-07-31: delta uchun vaqt belgisi — FAQAT serverdan kelgan
    // qiymatlardan olinadi (qurilma soatiga ishonilmaydi)
    try {
      let _mx = null;
      (salesData||[]).forEach(r => { if (r.updated_at && (!_mx || r.updated_at > _mx)) _mx = r.updated_at; });
      if (_mx) _setLastPull(sid, _mx);
    } catch(e) {}
    if (salesData && salesData.length > 0) {
      db.sales = salesData.map(s => {
        // v174: BUTUN JSON bo'lsa — undan (subtotal/discount/note ham
        // yo'qolmaydi). Sotuvni faqat mijoz (sayt) yozadi, bot yozmaydi.
        if (s.data && typeof s.data === "object" && !Array.isArray(s.data)) {
          return { ...s.data, id: s.id };
        }
        // ZAXIRA YO'L (data hali yo'q) — avvalgi mapping o'zgarishsiz
        return {
        id: s.id, chekNum: s.chek_num, date: s.date, time: s.time,
        priceType: s.price_type, payType: s.pay_type,
        payBreakdown: s.pay_breakdown || null,
        staffId: s.staff_id, customerId: s.customer_id,
        items: s.items || [], subtotal: s.subtotal, discount: s.discount,
        total: s.total, paid: s.paid, remaining: s.remaining,
        due: s.due, customerName: s.customer_name,
        customerPhone: s.customer_phone, status: s.status,
        debtCurrency: s.debt_currency, debtUsd: s.debt_usd,
        note: s.note,
        origPaid: s.orig_paid != null ? s.orig_paid : s.paid,
        origRemaining: s.orig_remaining != null ? s.orig_remaining : s.remaining,
        origDebtUsd: s.orig_debt_usd != null ? s.orig_debt_usd : null
        };
      });
    }

    // Ombor
    const omborData = await _selectAll(() => _sb.from("ombor").select("*").eq("shop_id", sid).order("local_id"), "ombor");
    _cloudIds["ombor"] = new Map((omborData||[]).map(r => [String(r.id), r.id]));
    if (omborData && omborData.length > 0) {
      db.ombor = omborData.map(o => {
        // v175: BUTUN JSON bo'lsa — undan
        if (o.data && typeof o.data === "object" && !Array.isArray(o.data)) return { ...o.data, id: o.id };
        return ({
        id: o.id, date: o.date, sku: o.sku,
        productName: o.product_name, unit: o.unit,
        color: o.color, size: o.size, qty: o.qty,
        boxes: o.boxes, pantone: o.pantone, hex: o.hex,
        kirimNarxi: o.kirim_narxi, ulgurji: o.ulgurji,
        supplier: o.supplier, partiya: o.partiya,
        payStatus: o.pay_status, barcode: o.barcode,
        pantone: o.pantone || null, hex: o.hex || null,
        chakana: o.chakana || 0
      });
      });
    }

    // Xarajatlar
    const xarData = await _selectAll(() => _sb.from("xarajatlar").select("*").eq("shop_id", sid).order("local_id"), "xarajatlar");
    _cloudIds["xarajatlar"] = new Map((xarData||[]).map(r => [String(r.id), r.id]));
    if (xarData) {
      db.xarajatlar = xarData.map(x => {
        // v175: BUTUN JSON bo'lsa — undan
        if (x.data && typeof x.data === "object" && !Array.isArray(x.data)) return { ...x.data, id: x.id };
        return ({
        id: x.id, date: x.date, category: x.category,
        amount: x.amount, amountUsd: x.amount_usd || null,
        recipient: x.recipient, paidBy: x.paid_by,
        method: x.method || "naqd", note: x.note,
        recurring: x.recurring || false,
        subCategory: x.sub_category || null,
        xarajatType: x.xarajat_type || null,
        forMonth: x.for_month || null
      });
      });
    }

    // Settings
    const { data: setsArr } = await _sb.from("settings").select("*").eq("shop_id", sid).limit(1);
    const sets = setsArr?.[0] || null;
    if (sets) {
      // MUHIM: db.shop ni butunlay almashtirmaymiz — type (do'kon turi)
      // kabi lokal maydonlar saqlanib qolishi kerak
      db.shop = { ...(db.shop || {}), name: sets.shop_name };
      db.settings.rate           = sets.rate || 12800;
      db.settings.priceCurrency  = sets.price_currency || "uzs";
      if (sets.shop_type) db.settings.shopType = sets.shop_type;
      // 2026-07-26: valyuta rejimi SuperAdmin tomonidan belgilanadi —
      // do'kon egasi o'zgartira olmaydi, faqat bulutdan keladi
      // 2026-07-26: obuna tarifi — SuperAdmin belgilaydi, do'kon o'qiydi
      if (sets.tier) {
        db.settings.tier = sets.tier;
        try { if (typeof applyTierLock === "function") applyTierLock(); } catch(e) {}
      }
      if (sets.currency_mode) {
        db.settings.currencyMode = sets.currency_mode;
        // Qat'iy rejim kelgan bo'lsa darhol qo'llaymiz
        try { if (typeof enforceCurrencyMode === "function") enforceCurrencyMode(); } catch(e) {}
      }
      db.settings.showChakana    = sets.show_chakana || false;
      if (sets.eskiz_token)    db.settings.eskizToken         = sets.eskiz_token;
      if (sets.eskiz_sender)   db.settings.eskizSender        = sets.eskiz_sender;
      if (sets.telegram_bot)   db.settings.telegramBotUrl     = sets.telegram_bot;
      if (sets.telegram_bot_username) db.settings.telegramBotUsername = sets.telegram_bot_username;
      if (sets.staff_group_id) db.settings.staffGroupId       = sets.staff_group_id;
      if (sets.loyalty_rate)   db.settings.loyaltyRate        = sets.loyalty_rate;
      if (sets.loyalty_value)  db.settings.loyaltyValue       = sets.loyalty_value;
      db.settings.rateMode      = sets.rate_mode === "auto" ? "auto" : "manual";
      if (sets.rate_updated_at) db.settings.rateUpdatedAt      = sets.rate_updated_at;
      if (sets.debt_pay_methods_shown) db.settings.debtPayMethodsShown = sets.debt_pay_methods_shown;
      if (sets.debt_cols)              db.settings.debtCols            = sets.debt_cols;
      if (sets.unit_tags      != null) db.settings.unitTags      = sets.unit_tags;      // №11a (v186)
      if (sets.chek_config    != null) db.settings.chekConfig    = sets.chek_config;    // №12 (v187)
      if (sets.pack_unit_tags != null) db.settings.packUnitTags  = sets.pack_unit_tags;
      // v172 (2026-07-10): NULL-himoya bilan — bulutda qiymat hali
      // bo'lmasa (eski yozuv), lokaldagi mavjud qiymatga TEGILMAYDI.
      if (sets.low_stock_limit  != null) db.settings.lowStockLimit  = Number(sets.low_stock_limit);
      if (sets.pos_pay_blocked  != null) db.settings.posPayBlocked  = sets.pos_pay_blocked;
      if (sets.pos_staff_locked != null) db.settings.posStaffLocked = !!sets.pos_staff_locked;
    }

    // Chiqimlar
    const chiqData = await _selectAll(() => _sb.from("chiqimlar").select("*").eq("shop_id", sid).order("local_id"), "chiqimlar");
    _cloudIds["chiqimlar"] = new Map((chiqData||[]).map(r => [String(r.id), r.id]));
    if (chiqData && chiqData.length > 0) {
      db.chiqimlar = chiqData.map(c => {
        // v175: BUTUN JSON bo'lsa — undan (id konvensiyasi saqlanadi)
        if (c.data && typeof c.data === "object" && !Array.isArray(c.data)) return { ...c.data, id: c.local_id || c.data.id || c.id };
        return ({
        id:          c.local_id || c.id,
        date:        c.date,
        time:        c.time || "",
        productName: c.product_name,
        sku:         c.sku || "",
        color:       c.color,
        size:        c.size,
        qty:         c.qty,
        unit:        c.unit || "dona",
        reason:      c.reason,
        note:        c.note || "",
        costUzs:     c.cost_uzs || 0
      });
      });
    }

    // Qarz to'lovlari
    const payData = await _selectAll(() => _sb.from("debt_payments").select("*").eq("shop_id", sid).order("created_at"), "debt_payments");
    _cloudIds["debt_payments"] = new Map((payData||[]).map(r => [String(r.id), r.id]));
    if (payData) {
      db.debtPayments = payData.map(p => {
        // v174: BUTUN JSON bo'lsa — undan. Bot bu jadvalga yozmaydi.
        if (p.data && typeof p.data === "object" && !Array.isArray(p.data)) {
          return { ...p.data, id: p.id };
        }
        // ZAXIRA YO'L (data hali yo'q) — avvalgi mapping o'zgarishsiz
        return {
        id:        p.id,
        chekNum:   p.chek_num || null,
        saleId:    p.sale_id || null,
        date:      p.date,
        time:      p.time || null,
        amount:    p.amount || 0,
        currency:  p.currency || "uzs",
        method:    p.method || "naqd",
        staffId:   p.staff_id || null,
        note:      p.note || null,
        customerId:    p.customer_id || null,
        customerName:  p.customer_name || null,
        customerPhone: p.customer_phone || null,
        allocations:   p.allocations || [],
        debtBefore:    p.debt_before,
        debtAfter:     p.debt_after,
        methodBreakdown: p.method_breakdown || null,
        rate:            p.rate || null,
        leftover:      p.leftover || 0,
        leftoverToBalance: !!p.leftover_to_balance
        };
      });
    }

    // Qaytarilgan tovarlar
    const retData = await _selectAll(() => _sb.from("returns").select("*").eq("shop_id", sid).order("created_at"), "returns");
    _cloudIds["returns"] = new Map((retData||[]).map(r => [String(r.id), r.id]));
    if (retData) {
      db.returns = retData.map(r => {
        // v175: BUTUN JSON bo'lsa — undan
        if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) return { ...r.data, id: r.id };
        return ({
        id: r.id, date: r.date, time: r.time || null,
        origSaleId: r.orig_sale_id || null,
        origChekNum: r.orig_chek_num || null,
        items: r.items || [],
        total: r.total || 0,
        reason: r.reason || null,
        customerName: r.customer_name || null,
        staffId: r.staff_id || null
      });
      });
    }

    // Kassa smenalari
    const shiftData = await _selectAll(() => _sb.from("shifts").select("*").eq("shop_id", sid).order("created_at"), "shifts");
    _cloudIds["shifts"] = new Map((shiftData||[]).map(r => [String(r.id), r.id]));
    if (shiftData) {
      db.shifts = shiftData.map(sh => {
        // v175: BUTUN JSON bo'lsa — undan
        if (sh.data && typeof sh.data === "object" && !Array.isArray(sh.data)) return { ...sh.data, id: sh.id };
        return ({
        id: sh.id, staffId: sh.staff_id || null,
        openTime: sh.open_time || null,
        openDate: sh.open_date || null,
        openCash: sh.open_cash || 0,
        note: sh.note || null,
        closeTime: sh.close_time || null,
        closeCash: sh.close_cash != null ? sh.close_cash : null,
        diff: sh.diff != null ? sh.diff : null
      });
      });
    }

    // Ta'minotchilar
    const { data: supData } = await _sb.from("suppliers").select("*").eq("shop_id", sid).order("created_at");
    _cloudIds["suppliers"] = new Map((supData||[]).map(r => [String(r.id), r.id]));
    if (supData) {
      db.suppliers = supData.map(s => {
        // v175: BUTUN JSON bo'lsa — undan
        if (s.data && typeof s.data === "object" && !Array.isArray(s.data)) return { ...s.data, id: s.id };
        return ({
        id: s.id, name: s.name || "", phone: s.phone || "", note: s.note || ""
        });
      });
    }

    // ── MERGE: bulut + lokal yangi yozuvlar ──────────────────────
    // Bulutdagi yozuv ustun (bir xil id bo'lsa bulutniki qoladi),
    // bulutda YO'Q lokal yozuvlar saqlanadi va keyingi push bilan ketadi.
    const _mrg = (cur, old, key, table) => {
      cur = cur || []; old = old || [];
      const dead = (r) => _tombstones.has(table + ":" + String(r[key]));
      // Bulut ustun, lekin: (a) o'chirilganlar daftaridagilar chiqarib
      // tashlanadi, (b) bulutda yo'q lokal YANGI yozuvlar saqlanadi.
      cur = cur.filter(r => r && !dead(r));
      const seen = new Set(cur.map(r => String(r[key])));
      return cur.concat(old.filter(r => r && r[key] != null
        && !seen.has(String(r[key])) && !dead(r)));
    };
    db.products     = _mrg(db.products,     _loc.products,     "sku", "products");
    db.customers    = _mrg(db.customers,    _loc.customers,    "id",  "customers");
    db.staff        = _mrg(db.staff,        _loc.staff,        "id",  "staff");
    db.sales        = _mrg(db.sales,        _loc.sales,        "id",  "sales");
    db.ombor        = _mrg(db.ombor,        _loc.ombor,        "id",  "ombor");
    db.xarajatlar   = _mrg(db.xarajatlar,   _loc.xarajatlar,   "id",  "xarajatlar");
    db.chiqimlar    = _mrg(db.chiqimlar,    _loc.chiqimlar,    "id",  "chiqimlar");
    db.debtPayments = _mrg(db.debtPayments, _loc.debtPayments, "id",  "debt_payments");
    db.returns      = _mrg(db.returns,      _loc.returns,      "id",  "returns");
    db.shifts       = _mrg(db.shifts,       _loc.shifts,       "id",  "shifts");
    db.suppliers    = _mrg(db.suppliers,    _loc.suppliers,    "id",  "suppliers");

    // seq yangilash
    const maxId = Math.max(
      ...( db.products.map((_,i)=>i) ),
      ...(db.customers.map(c=>c.id||0)),
      ...(db.staff.map(s=>s.id||0)),
      ...(db.sales.map(s=>s.id||0)),
      ...(db.ombor.map(o=>o.id||0)),
      ...((db.xarajatlar||[]).map(x=>x.id||0)),
      ...((db.chiqimlar||[]).map(c=>c.id||0)),
      ...((db.debtPayments||[]).map(p=>p.id||0)),
      ...((db.returns||[]).map(r=>r.id||0)),
      ...((db.shifts||[]).map(sh=>sh.id||0)),
      ...((db.suppliers||[]).map(s=>s.id||0)),
      db.seq || 0
    );
    db.seq = maxId + 1;

    // Pull muvaffaqiyatli tugadi — endi push ga ruxsat beriladi
    _cloudPullDone = true;
    _pulledShopId = sid;
    try { _rtEnsure(); } catch(e) {} // v184: shu do'kon uchun realtime kanalini ochamiz

    // 2026-07-20: KUNLIK BULUT ZAXIRA — pull tugab, db to'liq bo'lgach.
    // Kuniga bir marta, fonda, ko'rinmas (egasi hech narsa ko'rmaydi).
    try { setTimeout(() => { if (typeof cloudDailyBackup === "function") cloudDailyBackup(sid); }, 5000); } catch(e) {}

    // ── 4-BOSQICH: localStorage — faqat JORIY do'kon keshi ─────────
    // Boshqa do'konlarning eski nusxalarini o'chiramiz:
    //  (1) umumiy kompyuterda begona do'kon ma'lumoti qolmaydi (maxfiylik),
    //  (2) do'konlararo qoldiq/aralashish manbalari butunlay yopiladi.
    // Bulut — yagona haqiqat: kerak bo'lsa pull qayta to'ldiradi.
    try {
      const _curKey = "merx_v5_" + sid;
      Object.keys(localStorage)
        .filter(k => (k.indexOf("merx_v5") === 0) && k !== _curKey)
        .forEach(k => {
          localStorage.removeItem(k);
          console.log("🧹 Boshqa do'kon keshi tozalandi:", k);
        });
    } catch(e) { console.warn("kesh tozalash xato:", e.message); }

    saveDB();
    updateCloudUI(true);
    // v177 (4-BOSQICH): endi dashboardga ULOQTIRILMAYDI. Foydalanuvchi
    // qaysi sahifada bo'lsa, o'sha sahifaning o'zi qayta chiziladi
    // (nav o'sha sahifaning render funksiyasini chaqiradi).
    if (!skipRender) {
      const _cur = document.querySelector("[id^='p-'].on")?.id?.slice(2) || "dashboard";
      nav(_cur);
    }
    if (!silent) toast("✅ Ma'lumotlar yangilandi");
  } catch(e) {
    toast("Yuklash xatosi: " + e.message, "err");
    console.error("Cloud pull error:", e);
  }
}

// ── Auto-sync: saveDB() chaqirilganda ────────────
let _syncTimer = null;
let _syncPending = false;

function scheduleCloudSync() {
  if (!_sb) return;
  // v184/v185: suppressed paytdagi chaqiruv — bu PULL ichidagi saveDB
  // (pull o'zi push qilmasligi kerak, aks holda to'liq-push aylanmasi).
  // Foydalanuvchi tahriri esa v185 himoyalari bilan saqlanadi:
  // (1) _syncPending borida realtime/zaxira pull KUTADI (poyga yopildi),
  // (2) katalog saqlashda updatedAt muhri — pull eski nusxani ustiga yozmaydi.
  if (_syncSuppressed) return;
  _syncPending = true;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    if (!_syncPending) return;
    _syncPending = false;
    try { await pushToCloud(); } catch(e) { console.warn("scheduleCloudSync push xato:", e.message); }
    // v178: pill endi o'ynamaydi — "Avto-saqlash" tinch turadi,
    // sinxron orqa fonda jim ishlaydi (faqat xato toast bo'ladi).
  }, 700); // 2026-07-25: 2000 -> 700ms. 2 soniya ichida F5 bosilsa
           // o'zgarish YO'QOLARDI (o'chirilgan tovar tirilib qolardi).
}

// ═══ DARHOL SINXRON (2026-07-25) ═══
// Muhim amallar (o'chirish, sotuv, tovar qo'shish) kutmasdan yuboriladi.
// Sahifa yopilishi/yashirilishi oldidan ham shu chaqiriladi.
async function flushCloudSync(intentionalDelete) {
  if (!_sb) return false;
  if (_syncSuppressed) return false;
  clearTimeout(_syncTimer);
  if (!_syncPending) return true;   // yuboriladigan narsa yo'q
  _syncPending = false;
  if (intentionalDelete) _intentionalDelete = true;
  try {
    await pushToCloud();
    return true;
  } catch (e) {
    _syncPending = true;            // yuborilmadi — keyingi urinishga qoladi
    console.warn("flushCloudSync xato:", e.message);
    return false;
  } finally {
    _intentionalDelete = false;     // bayroq faqat SHU push uchun
  }
}

// Kutilayotgan o'zgarish bormi (F5 ogohlantirishi uchun)
function hasPendingSync() { return !!_syncPending; }

// ── Sahifa yashirilganda/yopilganda DARHOL yuborish ──
// Telefonda ilova fonga o'tganda ham ishlaydi (visibilitychange).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && _syncPending) {
    flushCloudSync();
  }
});

// F5 / tab yopish — yuborilmagan o'zgarish bo'lsa ogohlantiramiz
window.addEventListener("beforeunload", (e) => {
  if (!_syncPending) return;
  flushCloudSync();                 // ulgursa yuboriladi
  e.preventDefault();
  e.returnValue = "";               // brauzer o'z savolini ko'rsatadi
  return "";
});

// 2026-07-10: INTERNET QAYTDI tinglovchisi — ulanish tiklanishi bilan
// kutayotgan o'zgarishlar DARHOL yuboriladi (avval keyingi amalgacha
// kutardi). Delta-kesh tufayli faqat yuborilmagan yozuvlar ketadi.
window.addEventListener("online", () => {
  try { if (_sb) { scheduleCloudSync(); _rtEnsure(); } } catch(e) {} // v184: realtime kanalini ham tiklaymiz
});

// ═══════════════════════════════════════════════════════════════════
// REALTIME (2026-07-13, v184) — "signal → mavjud pull" modeli
// Boshqa qurilmada o'zgarish bo'lsa, Supabase WebSocket signal beradi
// va biz mavjud, sinalgan pullFromCloud'ni JIM ishga tushiramiz.
// Yangi sinxron mantiq YOZILMAGAN — merge / timestamp / tombstone o'z joyida.
// Push aylanmasi _syncSuppressed bilan to'siladi (scheduleCloudSync qarang).
// ═══════════════════════════════════════════════════════════════════
const _RT_TABLES = ['products','sales','customers','staff','ombor','xarajatlar',
  'debt_payments','shifts','settings','suppliers','returns','chiqimlar','deleted_records'];
let _rtChannel = null;
let _rtSubscribedSid = null;
let _rtPullTimer = null;

// Ekranni hozir qayta chizish xavfsizmi? Band bo'lsa — kutamiz, ishni buzmaymiz.
function _rtBusyUI() {
  // Ochiq modal (statik: .ov.on)
  if (document.querySelector(".ov.on")) return true;
  // Ochiq modal (dinamik: ko'rinadigan .ov)
  for (const ov of document.querySelectorAll(".ov")) {
    const cs = getComputedStyle(ov);
    if (cs.display !== "none" && cs.visibility !== "hidden" && ov.offsetWidth > 0) return true;
  }
  // Foydalanuvchi biror maydonga yozyapti
  const ae = document.activeElement;
  if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return true;
  // POS savatida tovar bor — sotuv o'rtasida ekranni buzmaymiz
  try {
    const c = posCartsState?.carts?.[posCartsState.activeIdx]?.items;
    if (Array.isArray(c) && c.length > 0) return true;
  } catch (e) {}
  return false;
}

// Realtime signalidan keyin — debounce bilan JIM pull (xavfsiz bo'lsa ekranni yangilaydi)
function _rtSchedulePull() {
  clearTimeout(_rtPullTimer);
  _rtPullTimer = setTimeout(async () => {
    if (_syncPending) { _rtSchedulePull(); return; } // v185: YUBORILMAGAN lokal o'zgarish bor — avval push ketsin (tahrir yo'qolishi poygasi yopildi)
    if (_pullBusy)   { _rtSchedulePull(); return; } // boshqa pull ketyapti — biroz kutamiz
    if (_rtBusyUI()) { _rtSchedulePull(); return; } // foydalanuvchi band — biroz kutamiz
    _pullBusy = true; _syncSuppressed = true;
    // 2026-07-31: avval DELTA (odatda 1-5 qator). Ishlamasa to'liq pull.
    try { await pullSmart(true, false); }            // JIM, ekran yangilanadi
    catch (e) { console.warn("realtime pull xato:", e.message); }
    finally { _syncSuppressed = false; _pullBusy = false; }
  }, 1500);
}

// Kanalni ochish (do'kon bo'yicha filtr). Idempotent: bir do'konga bir marta.
function _rtEnsure() {
  if (!_sb) return;
  const sid = getCloudShopId();
  if (!sid) return;
  if (_rtChannel && _rtSubscribedSid === sid) return; // allaqachon ulangan
  if (_rtChannel) { try { _sb.removeChannel(_rtChannel); } catch (e) {} _rtChannel = null; _rtSubscribedSid = null; }

  const ch = _sb.channel("merx-rt-" + sid);
  _RT_TABLES.forEach(tbl => {
    ch.on("postgres_changes",
      { event: "*", schema: "public", table: tbl, filter: "shop_id=eq." + sid },
      () => _rtSchedulePull());
  });
  ch.subscribe(status => {
    console.log("🔔 realtime:", status);
    if (status === "SUBSCRIBED") _rtSubscribedSid = sid;
  });
  _rtChannel = ch;
}

// ZAXIRA: har 90 soniyada JIM, ekranSIZ pull — realtime signal biror sabab
// bilan yetib kelmasa ham ma'lumot to'g'ri qoladi (ekran keyingi harakatda yangilanadi).
setInterval(async () => {
  try {
    if (!_sb || !getCloudShopId() || !_cloudPullDone || _pullBusy || _syncPending) return; // v185: _syncPending — avval push
    _pullBusy = true; _syncSuppressed = true;
    // 2026-07-31: zaxira ham delta bilan — fon so'rovi yengil bo'lsin
    try { await pullSmart(true, true); }              // JIM + ekransiz (fon)
    catch (e) { console.warn("zaxira pull xato:", e.message); }
    finally { _syncSuppressed = false; _pullBusy = false; }
  } catch (e) {}
}, 90000);

// ═══════════════════════════════════════════════════════════════
// 2026-07-20: KUNLIK BULUT ZAXIRA (uch qatlamli himoyaning 2-qatlami)
// Har do'kon uchun kuniga bir marta joriy db'ni Supabase 'backups'
// jadvaliga yozadi (rasmsiz, jsonb). SuperAdmin bu zaxiralardan
// istalgan do'konni tiklaydi. Oxirgi 7 kun qoladi.
// Egasi HECH NARSA ko'rmaydi — butunlay fonda ishlaydi.
// ═══════════════════════════════════════════════════════════════
async function cloudDailyBackup(sid) {
  try {
    if (!_sb || !sid) return;
    if (!db || !db.products) return;
    // Bo'sh db'ni zaxiralamaymiz (himoya: bo'sh zaxira zararli)
    const total = (db.products||[]).length + (db.sales||[]).length +
                  (db.ombor||[]).length + (db.customers||[]).length;
    if (total < 2) return;

    const bugun = today();

    // Bugun allaqachon zaxira bormi? (kuniga 1 marta)
    const { data: bor } = await _sb.from("backups")
      .select("id").eq("shop_id", sid).eq("date", bugun).limit(1);
    if (bor && bor.length) return; // bugungi zaxira bor

    // Rasmlarni chiqarib tashlaymiz (hajm katta bo'lmasin)
    const light = JSON.parse(JSON.stringify(db, (k, v) => {
      if (k === "image" || k === "colorImages" || k === "photo") return undefined;
      return v;
    }));

    const { error } = await _sb.from("backups").insert({
      shop_id: sid, date: bugun, data: light, records: total
    });
    if (error) { console.warn("Bulut zaxira xatosi:", error.message); return; }
    console.log("☁💾 Kunlik bulut zaxira olindi:", bugun, "(" + total + " yozuv)");

    // Eski zaxiralarni tozalash (7 kundan eskisini o'chiramiz)
    const chegara = addDays(bugun, -7);
    await _sb.from("backups").delete().eq("shop_id", sid).lt("date", chegara);
  } catch (e) {
    console.warn("cloudDailyBackup xato:", e.message);
  }
}

// ══════════════════════════════════════════════════════════════
// SUPERADMIN ZAXIRA / TIKLASH — SERVER ORQALI (2026-07-30)
// AVVAL: bu funksiyalar brauzerdagi anon kalit (`_sb`) bilan
// ishlardi. §4.5 bo'yicha anon kalit BOSHQA do'kon yozuviga tega
// olmaydi va xato JIMGINA YUTILADI. Natijada:
//   · zaxiralar ro'yxati bo'sh chiqardi ("zaxira yo'q")
//   · tiklash hech nima qilmasa ham "✅ TIKLANDI" deb yozardi
//     (funksiya HAR DOIM ok:true qaytarardi)
// Endi: o'qish/yozish SERVICE_KEY bilan serverda, natija HAQIQIY.
// Jadvalga o'girish (_bkMap*) esa shu faylda qoladi — YAGONA MANBA.
// ══════════════════════════════════════════════════════════════

// ── Do'kon zaxiralari ro'yxati ──
async function saListBackups(shopId) {
  if (!shopId) return [];
  if (typeof _saApi !== "function") { console.warn("saListBackups: _saApi yo'q"); return []; }
  try {
    const d = await _saApi("list_backups", { shopId });
    if (!d || !d.ok) { console.warn("saListBackups xato:", d && d.error); return []; }
    return d.backups || [];
  } catch (e) { console.warn("saListBackups xato:", e.message); return []; }
}

// ── Bitta zaxirani to'liq o'qish ──
async function saGetBackup(backupId) {
  if (!backupId) return null;
  if (typeof _saApi !== "function") return null;
  try {
    const d = await _saApi("get_backup", { backupId });
    if (!d || !d.ok) { console.warn("saGetBackup xato:", d && d.error); return null; }
    return d.backup || null;
  } catch (e) { console.warn("saGetBackup xato:", e.message); return null; }
}

// ── Zaxirani do'kon ma'lumotiga TIKLASH ──
// Qaytaradi: { ok, records, tables:[{table,deleted,inserted}], tombOk }
// yoki xato bo'lsa: { ok:false, error, stoppedAt, done:[...] }
// MUHIM: har jadval uchun o'chirish va yozish natijasi tekshiriladi.
// Birinchi xatoda TO'XTAYDI va qaysi jadvalda to'xtaganini aytadi.
async function saRestoreBackup(backupId, onProgress) {
  if (typeof _saApi !== "function")
    return { ok:false, error:"SuperAdmin API yordamchisi topilmadi (superadmin.js yuklanmagan)" };

  const bk = await saGetBackup(backupId);
  if (!bk)        return { ok:false, error:"Zaxira o'qilmadi" };
  const sid = bk.shop_id;
  const d   = bk.data;
  if (!sid)       return { ok:false, error:"Zaxirada do'kon ID yo'q" };
  if (!d)         return { ok:false, error:"Zaxira bo'sh (data yo'q)" };

  const tables = [
    { t:"products",      arr:d.products||[],      map:_bkMapProduct },
    { t:"customers",     arr:d.customers||[],     map:_bkMapCustomer },
    { t:"sales",         arr:d.sales||[],         map:_bkMapSale },
    { t:"debt_payments", arr:d.debtPayments||[],  map:_bkMapDebtPay },
    { t:"ombor",         arr:d.ombor||[],         map:_bkMapOmbor },
    { t:"xarajatlar",    arr:d.xarajatlar||[],    map:_bkMapXarajat },
    { t:"staff",         arr:d.staff||[],         map:_bkMapStaff },
  ];

  // HIMOYA: bo'sh zaxira bilan tiklash = ma'lumotni o'chirish
  const totalRows = tables.reduce((a,x) => a + x.arr.length, 0);
  if (totalRows < 1)
    return { ok:false, error:"Zaxirada bironta yozuv yo'q — tiklash bekor qilindi (himoya)" };

  const report = [];
  for (const { t, arr, map } of tables) {
    const rows = arr.map(x => { try { return map(x, sid); } catch(e) { return null; } }).filter(Boolean);
    const line = { table:t, deleted:0, inserted:0 };

    // Yozuv yo'q — faqat eski qatorlarni tozalaymiz
    if (!rows.length) {
      const r = await _saApi("restore_write", { shopId:sid, table:t, rows:[], wipe:true })
        .catch(e => ({ ok:false, error:e.message }));
      if (!r || !r.ok)
        return { ok:false, stoppedAt:t, done:report,
                 error:`"${t}": ${(r && r.error) || "noma'lum xato"}` };
      line.deleted = r.deleted || 0;
      report.push(line);
      continue;
    }

    // Birinchi bo'lakda eski qatorlar o'chiriladi (wipe), keyingilarida yo'q
    let first = true;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const r = await _saApi("restore_write", { shopId:sid, table:t, rows:chunk, wipe:first })
        .catch(e => ({ ok:false, error:e.message }));
      if (!r || !r.ok) {
        if (line.inserted || line.deleted) report.push(line);
        return { ok:false, stoppedAt:t, done:report,
                 error:`"${t}" jadvalida to'xtadi (${(r && r.step) || "yozish"}): ` +
                       `${(r && r.error) || "noma'lum xato"}` };
      }
      if (first) { line.deleted = r.deleted || 0; first = false; }
      line.inserted += chunk.length;
      if (typeof onProgress === "function") {
        try { onProgress(t, line.inserted, rows.length); } catch(e) {}
      }
    }
    report.push(line);
  }

  // Tombstone (o'chirilganlar daftari) tozalanadi — aks holda tiklangan
  // yozuvlar "o'chirilgan" deb yashirilishi mumkin
  let tombOk = true;
  try {
    const r = await _saApi("restore_write", { shopId:sid, table:"deleted_records", rows:[], wipe:true });
    tombOk = !!(r && r.ok);
  } catch(e) { tombOk = false; }

  const inserted = report.reduce((a,x) => a + (x.inserted || 0), 0);
  console.log("♻️ Tiklash yakuni:", report);
  return { ok:true, shop_id:sid, date:bk.date, records:inserted, tables:report, tombOk };
}

// Zaxira JSON'ini Supabase ustunlariga o'giruvchi yordamchilar (data jsonb ham saqlanadi)
function _bkMapProduct(p, sid) {
  return { shop_id:sid, sku:p.sku, name:p.name, category:p.category, type:p.type,
    unit:p.unit, in_box:p.inBox, barcode:p.barcode, cost_usd:p.costUsd,
    price_uzs:p.priceUzs, ulgurji:p.ulgurjiNarx, variants:p.variants,
    art:p.art, color_barcodes:p.colorBarcodes, pantone:p.pantone,
    color_name:p.colorName, hex:p.hex, pack_unit:p.packUnit, data:p };
}
function _bkMapCustomer(c, sid) {
  return { shop_id:sid, name:c.name, phone:c.phone, type:c.type, note:c.note,
    balance_uzs:c.balanceUzs, balance_usd:c.balanceUsd, data:c };
}
function _bkMapSale(s, sid) {
  return { shop_id:sid, chek_num:s.chekNum, date:s.date, time:s.time,
    price_type:s.priceType, pay_type:s.payType, pay_breakdown:s.payBreakdown,
    staff_id:s.staffId, customer_id:s.customerId, items:s.items,
    subtotal:s.subtotal, discount:s.discount, total:s.total, paid:s.paid,
    remaining:s.remaining, customer_name:s.customerName, customer_phone:s.customerPhone,
    status:s.status, debt_currency:s.debtCurrency, debt_usd:s.debtUsd, note:s.note, data:s };
}
function _bkMapDebtPay(p, sid) {
  return { shop_id:sid, customer_id:p.customerId, sale_id:p.saleId, amount:p.amount,
    currency:p.currency, method:p.method, date:p.date, data:p };
}
function _bkMapOmbor(o, sid) {
  return { shop_id:sid, date:o.date, sku:o.sku, product_name:o.productName,
    unit:o.unit, color:o.color, size:o.size, qty:o.qty, boxes:o.boxes,
    kirim_narxi:o.kirimNarxi, supplier:o.supplier, partiya:o.partiya, data:o };
}
function _bkMapXarajat(x, sid) {
  return { shop_id:sid, date:x.date, amount:x.amount, category:x.category,
    note:x.note, method:x.method, data:x };
}
function _bkMapStaff(s, sid) {
  return { shop_id:sid, name:s.name, phone:s.phone, role:s.role, data:s };
}

// ═══════════════════════════════════════════════════════════════
// O'CHIRISH NAVBATI (2026-07-26) — "tirilish" muammosining ILDIZ YECHIMI
//
// Muammo: o'chirish bulutga faqat _cloudIds to'lgan bo'lsa yetardi.
// _cloudIds esa pull tugagandan keyin to'ladi va sahifa yangilanganda
// bo'shab qoladi. Ya'ni pull tugamasdan o'chirilsa — o'chirish JIMGINA
// tashlab yuborilardi, keyingi pull yozuvni QAYTARARDI.
//
// Yechim: har o'chirish db'ga NAVBATGA yoziladi (localStorage'da
// saqlanadi, sahifa yangilansa ham yo'qolmaydi). Har push'da navbat
// qayta ishlanadi — bulutdan o'chiriladi va tombstone yoziladi.
// Muvaffaqiyatli bo'lgach navbatdan chiqadi.
// ═══════════════════════════════════════════════════════════════
function queueCloudDelete(table, keyCol, keyVal) {
  if (!table || keyVal == null) return;
  if (!db._pendingDeletes) db._pendingDeletes = [];
  const k = String(keyVal);
  if (db._pendingDeletes.some(d => d.table === table && String(d.val) === k)) return;
  db._pendingDeletes.push({ table, keyCol, val: k, at: Date.now() });
  try { saveDB(); } catch(e) {}
  console.log(`🗑 navbatga: ${table}.${keyCol}=${k}`);
}

async function processPendingDeletes(sid) {
  const q = db._pendingDeletes || [];
  if (!q.length || !_sb || !sid) return 0;

  let done = 0;
  const left = [];
  for (const d of q) {
    try {
      // 1) Tombstone — boshqa qurilmalar ham bilsin
      await _sb.from("deleted_records").upsert(
        [{ shop_id: sid, table_name: d.table, record_id: d.val }],
        { onConflict: "shop_id,table_name,record_id" }
      );
      // 2) Bulutdan o'chiramiz
      const { error } = await _sb.from(d.table)
        .delete().eq("shop_id", sid).eq(d.keyCol, d.val);
      if (error) { left.push(d); continue; }

      _tombstones.add(d.table + ":" + d.val);
      if (_cloudIds[d.table]) _cloudIds[d.table].delete(d.val);
      done++;
    } catch (e) {
      left.push(d);   // keyingi push'da qayta uriniladi
    }
  }
  db._pendingDeletes = left;
  if (done > 0) {
    try { saveDB(); } catch(e) {}
    console.log(`🗑 ${done} ta o'chirish bulutda tasdiqlandi` +
      (left.length ? ` · ${left.length} tasi navbatda qoldi` : ""));
  }
  return done;
}
