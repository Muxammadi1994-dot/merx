// ═══════════════════════════════════════════════════════════════
// MERX Service Worker — 2026-07-20 (PWA-1)
// Strategiya: NETWORK-FIRST dastur fayllari uchun.
//   - Online: doim yangi kod (internetdan) → yangilanish muammosi YO'Q
//   - Offline: keshdan (oxirgi ishlagan nusxa)
// Ma'lumot (Supabase/API) HECH QACHON keshlanmaydi — doim jonli.
// ═══════════════════════════════════════════════════════════════
// deploy 1

// MUHIM: har push'da bu raqamni +1 qiling — eski kesh avtomat o'chadi.
const CACHE_VERSION = "merx-v196";
const CACHE_NAME = CACHE_VERSION;

// Boshlang'ich keshlanadigan fayllar (offline'da kamida shular bo'lsin)
const CORE_ASSETS = [
  "/index.html",
  "/style.css",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// ── O'RNATISH: yangi SW o'rnatiladi, darhol faollashsin ──
self.addEventListener("install", (event) => {
  self.skipWaiting(); // yangi versiya kutmasin, darhol o'rnatilsin
  // ⚠️ 2026-08-01: KESHLASHNI KUTMAYMIZ.
  // Avval `event.waitUntil(cache.addAll(...))` edi — sekin internetda
  // bu tugamasdi va o'rnatish yakunlanmasdi. Natijada yangi SW
  // "waiting to activate" holatida qolib, ESKI SW eski index.html
  // ni berishda davom etardi: kod yangilangan, brauzer eskisini
  // ko'rsatib turardi ("push qildim, o'zgarmadi").
  // Endi keshlash fonda ketadi, o'rnatish DARHOL tugaydi.
  caches.open(CACHE_NAME).then((cache) =>
    cache.addAll(CORE_ASSETS).catch(() => {})
  ).catch(() => {});
});

// ── FAOLLASHISH: eski versiyalarning keshini o'chiramiz ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // barcha oynalarni darhol boshqaramiz
     // ⚠️ 2026-08-02: OCHIQ OYNALARGA XABAR BERAMIZ.
     // Yangi SW faollashsa ham, ochiq turgan sahifa ESKI kod bilan
     // ishlashda davom etardi. Foydalanuvchi buni bilmaydi va
     // qo'lda yangilashni ham bilmaydi (kassada Ctrl+Shift+R
     // aytib bo'lmaydi). Endi sahifa xabar olib O'ZI yangilanadi.
     .then(() => self.clients.matchAll({ type: "window" }))
     .then((cs) => cs.forEach((c) => {
       try { c.postMessage({ type: "SW_UPDATED", v: CACHE_VERSION }); } catch (e) {}
     }))
  );
});

// ── SO'ROVLARNI USHLASH ──
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) FAQAT GET so'rovlar keshlanadi. POST/PUT (sotuv yuborish) — hech qachon.
  if (req.method !== "GET") return;

  // 2) Supabase, API, real-time — HECH QACHON keshlanmaydi (ma'lumot jonli bo'lsin)
  const noCacheHosts = [
    "supabase.co", "supabase.in",
    "/api/",
    "eskiz.uz",
    "googleapis.com/rate", "cbu.uz"
  ];
  const isNoCache = noCacheHosts.some((h) => req.url.includes(h));
  if (isNoCache) {
    // To'g'ridan-to'g'ri tarmoqqa — keshsiz (offline bo'lsa tabiiy xato beradi)
    return; // SW aralashmaydi, brauzer o'zi hal qiladi
  }

  // 3) Realtime WebSocket (wss://) — aralashmaymiz
  if (url.protocol === "wss:" || url.protocol === "ws:") return;

  // ── Yordamchi: fetch + timeout (sekin internetda osilib qolmasin) ──
  const fetchWithTimeout = (request, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });

  // 4a) NAVIGATSIYA (index.html / sahifa ochilishi) — NETWORK-FIRST + 3s timeout.
  //     Internet tez → yangi sahifa. Sekin/yo'q → 3s dan keyin keshdan (osilmaydi).
  // ⚠️ 2026-08-02: VERSIYA TEKSHIRUVI SW DAN BUTUNLAY CHIQARILADI.
  // Ilova o'zining eskirganini bilish uchun serverdagi index.html ni
  // `?cb=<vaqt>` bilan so'raydi. Agar SW bu so'rovni ushlab keshdan
  // javob bersa — ilova o'zini "yangi" deb hisoblaydi va HECH QACHON
  // yangilanmaydi. Aynan shu sabab qurilma eski kodda qolib ketardi.
  if (url.searchParams.has("cb")) return;   // to'g'ridan tarmoqqa

  const isNavigate = req.mode === "navigate" || req.destination === "document"
    || (url.pathname === "/" || url.pathname.endsWith("/index.html"));
  if (isNavigate) {
    event.respondWith(
      fetchWithTimeout(req, 8000)   // 2026-08-01: 3s sekin internetda
                                    // yetmasdi — eski HTML berilardi
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put("/index.html", clone).catch(() => {}));
          }
          return res;
        })
        .catch(() =>
          // 3s ichida javob yo'q (sekin/offline) — keshdan beramiz
          caches.match("/index.html").then((cached) =>
            cached || caches.match(req) || new Response(
              "<h2 style='font-family:sans-serif;text-align:center;margin-top:40px'>Internet sekin yoki yo'q.<br>Bir ozdan keyin qayta urinib ko'ring.</h2>",
              { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
            )
          )
        )
    );
    return;
  }

  // 4b) BOSHQA FAYLLAR (CSS, JS, ikonka, CDN) — NETWORK-FIRST + timeout
  //
  // ⚠️ 2026-08-01: VERSIYALANGAN FAYLLARGA UZUNROQ MUDDAT.
  // Manzilida `?v=` bo'lgan fayl (style.css?v=157, js/*.js?v=N) —
  // bu YANGI versiya, keshda umuman yo'q. Sekin internetda 5 soniya
  // yetmasdi va SW eski nusxani berardi: kod yangilangan, lekin
  // brauzer eskisini ko'rsatib turardi.
  // Versiyalangan manzil o'zi kesh buzadi, shuning uchun 20 soniya.
  const _isVersioned = /[?&]v=\d+/.test(req.url);
  event.respondWith(
    fetchWithTimeout(req, _isVersioned ? 20000 : 5000)
      .then((res) => {
        // Muvaffaqiyatli javob — keshni yangilaymiz (offline uchun zaxira)
        if (res && res.status === 200 && (res.type === "basic" || res.type === "cors")) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone).catch(() => {});
          });
        }
        return res;
      })
      .catch(() => {
        // Internet yo'q/sekin — keshdan beramiz (oxirgi ishlagan nusxa)
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          // Boshqa hech narsa yo'q — tabiiy xato
          return new Response("Offline — internet yo'q", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        });
      })
  );
});

// ── Yangi versiyaga darhol o'tish uchun xabar (index.html chaqiradi) ──
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
