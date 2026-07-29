// ═══════════════════════════════════════════════════════════════
// MERX Service Worker — 2026-07-20 (PWA-1)
// Strategiya: NETWORK-FIRST dastur fayllari uchun.
//   - Online: doim yangi kod (internetdan) → yangilanish muammosi YO'Q
//   - Offline: keshdan (oxirgi ishlagan nusxa)
// Ma'lumot (Supabase/API) HECH QACHON keshlanmaydi — doim jonli.
// ═══════════════════════════════════════════════════════════════

// MUHIM: har push'da bu raqamni +1 qiling — eski kesh avtomat o'chadi.
const CACHE_VERSION = "merx-v104";
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
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Core fayllarni oldindan keshlaymiz (xato bo'lsa ham SW o'rnatiladi)
      cache.addAll(CORE_ASSETS).catch(() => {})
    )
  );
});

// ── FAOLLASHISH: eski versiyalarning keshini o'chiramiz ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // barcha oynalarni darhol boshqaramiz
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
  const isNavigate = req.mode === "navigate" || req.destination === "document"
    || (url.pathname === "/" || url.pathname.endsWith("/index.html"));
  if (isNavigate) {
    event.respondWith(
      fetchWithTimeout(req, 3000)
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

  // 4b) BOSHQA FAYLLAR (CSS, JS, ikonka, CDN) — NETWORK-FIRST + 5s timeout
  event.respondWith(
    fetchWithTimeout(req, 5000)
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
