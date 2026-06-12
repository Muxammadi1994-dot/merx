// MERX portal.js | v2.0 | 2026-06-12
// ================================================
// Mijoz portali — Admin boshqaruv qismi
// ================================================

/* ── Render ──────────────────────────────────── */
function renderPortal() {
  const el = $("p-portal"); if (!el) return;
  const sid = getCloudShopId ? getCloudShopId() : "default";

  el.innerHTML = `
<style>
.portal-hero{
  background:linear-gradient(135deg,#0a1628 0%,#0D1B2A 55%,#162336 100%);
  border-radius:16px;padding:26px 28px;margin-bottom:20px;color:#fff;
  display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.ph-icon{width:46px;height:46px;background:var(--acc);border-radius:12px;
  display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
.ph-stat{display:flex;flex-direction:column;align-items:center;text-align:center;
  padding:10px 20px;background:rgba(255,255,255,.07);border-radius:12px;
  border:1px solid rgba(255,255,255,.08);min-width:76px}
.ph-stat .v{font-family:'Sora',sans-serif;font-size:24px;font-weight:800;line-height:1.1}
.ph-stat .l{font-size:10px;color:rgba(255,255,255,.4);font-weight:700;
  text-transform:uppercase;letter-spacing:.5px;margin-top:4px}
.portal-link-box{display:flex;align-items:center;gap:8px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);
  border-radius:10px;padding:9px 12px;cursor:pointer;transition:.15s;max-width:260px}
.portal-link-box:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.2)}
.pav{width:36px;height:36px;border-radius:9px;font-weight:700;font-size:13px;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  color:#fff;letter-spacing:-.5px}
.plogin-row{display:flex;align-items:center;justify-content:space-between;
  padding:11px 0;border-bottom:1px solid var(--brd);gap:8px}
.plogin-row:last-child{border-bottom:none}
.pbron-row{padding:12px 0;border-bottom:1px solid var(--brd)}
.pbron-row:last-child{border-bottom:none}
.pprod-card{display:flex;align-items:center;gap:10px;padding:9px 10px;
  border:1.5px solid var(--brd);border-radius:10px;background:var(--bg);
  transition:border-color .15s,background .15s}
.pprod-card:hover{border-color:var(--acc);background:#fffdf7}
.pprod-card.ppc-hidden{border-color:#fecaca;background:#fef9f9}
.portal-empty{text-align:center;padding:30px 16px;color:#ccc}
.portal-empty i{font-size:34px;display:block;margin:0 auto 10px;opacity:.3}
.portal-empty .pe-t{font-size:13px;font-weight:600;color:#bbb;margin-bottom:3px}
.portal-empty .pe-s{font-size:12px}
</style>

<div style="max-width:1140px">

  <!-- ── Hero ── -->
  <div class="portal-hero">
    <div style="display:flex;align-items:center;gap:14px">
      <div class="ph-icon">🛒</div>
      <div>
        <div style="font-family:'Sora',sans-serif;font-size:19px;font-weight:700;line-height:1.2">
          Mijoz portali
        </div>
        <div style="font-size:12.5px;color:rgba(255,255,255,.4);margin-top:3px">
          Mijozlar onlayn katalog ko'radi va bron qiladi
        </div>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <div class="ph-stat">
        <span class="v" id="ps-logins" style="color:#A5B4FC">—</span>
        <span class="l">Login</span>
      </div>
      <div class="ph-stat">
        <span class="v" id="ps-bookings" style="color:var(--acc)">—</span>
        <span class="l">Yangi bron</span>
      </div>
      <div class="ph-stat">
        <span class="v" id="ps-prods" style="color:#6EE7B7">—</span>
        <span class="l">Ko'rinadigan</span>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0">
      <button onclick="openPortalPage()" style="display:inline-flex;align-items:center;gap:8px;
        background:var(--acc);color:#0D1B2A;padding:11px 20px;border-radius:10px;
        font-weight:700;font-size:13.5px;border:none;cursor:pointer;
        transition:filter .15s;font-family:inherit"
        onmouseover="this.style.filter='brightness(1.1)'"
        onmouseout="this.style.filter=''">
        <i class="ti ti-external-link" style="font-size:15px"></i> Portalni ochish
      </button>
      <div class="portal-link-box" onclick="copyPortalLink()">
        <i class="ti ti-link" style="font-size:14px;color:rgba(255,255,255,.35);flex-shrink:0"></i>
        <span style="font-size:11px;color:rgba(255,255,255,.5);font-family:monospace;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">
          mijoz.html?shop=${sid}
        </span>
        <i class="ti ti-copy" style="font-size:13px;color:rgba(255,255,255,.35);flex-shrink:0"></i>
      </div>
    </div>
  </div>

  <!-- ── 2 ustun ── -->
  <div class="g2" style="margin-bottom:16px">

    <!-- Loginlar -->
    <div class="card">
      <div class="ch">
        <h3>
          <span style="width:26px;height:26px;background:#EEF2FF;border-radius:7px;
            display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="ti ti-users" style="font-size:13px;color:#4F46E5"></i>
          </span>
          Mijoz loginlari
        </h3>
        <button class="btn btn-acc btn-sm" onclick="openPortalAddLogin()">
          <i class="ti ti-plus"></i> Login berish
        </button>
      </div>
      <div id="portal-logins-list" style="padding:0 16px 4px">
        <div class="portal-empty">
          <i class="ti ti-loader-2"></i>
          <div class="pe-t">Yuklanmoqda...</div>
        </div>
      </div>
    </div>

    <!-- Bronlar -->
    <div class="card">
      <div class="ch">
        <h3>
          <span style="width:26px;height:26px;background:#FEF3C7;border-radius:7px;
            display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="ti ti-bookmark" style="font-size:13px;color:#D97706"></i>
          </span>
          Bronlar
        </h3>
        <div style="display:flex;gap:6px;align-items:center">
          <span id="portal-bookings-count" class="bg bg-a" style="font-size:12px">0</span>
          <select id="pbron-filter" onchange="loadPortalData()"
            style="font-size:12px;padding:4px 8px;border-radius:8px;border:1.5px solid var(--brd);
              font-family:inherit;cursor:pointer;color:var(--ink);background:#fff">
            <option value="kutilmoqda">⏳ Kutilmoqda</option>
            <option value="tasdiqlandi">✅ Tasdiqlandi</option>
            <option value="bekor">❌ Bekor</option>
            <option value="all">Barchasi</option>
          </select>
        </div>
      </div>
      <div id="portal-bookings-list" style="padding:0 16px 4px">
        <div class="portal-empty">
          <i class="ti ti-loader-2"></i>
          <div class="pe-t">Yuklanmoqda...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Tovarlar ── -->
  <div class="card">
    <div class="ch">
      <h3>
        <span style="width:26px;height:26px;background:#D1FAE5;border-radius:7px;
          display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ti-eye" style="font-size:13px;color:#059669"></i>
        </span>
        Portal tovarlar ko'rinishi
      </h3>
      <div style="display:flex;gap:12px;align-items:center">
        <div style="font-size:12.5px;color:var(--mut);display:flex;gap:10px">
          <span style="color:var(--grn);font-weight:600">
            <i class="ti ti-eye"></i> <span id="pv-visible">—</span> ko'rinadigan
          </span>
          <span style="color:var(--red);font-weight:600">
            <i class="ti ti-eye-off"></i> <span id="pv-hidden">—</span> yashirin
          </span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="loadPortalData()" title="Yangilash">
          <i class="ti ti-refresh"></i>
        </button>
      </div>
    </div>
    <div style="padding:8px 16px 6px;border-bottom:1px solid var(--brd)">
      <div style="font-size:12px;color:var(--mut)">
        <i class="ti ti-info-circle"></i>
        Tovar yonidagi <i class="ti ti-settings"></i> tugmani bosib ko'rinish va chegirma sozlang
      </div>
    </div>
    <div id="portal-products-list" style="padding:12px 16px 16px">
      <div class="portal-empty"><i class="ti ti-loader-2"></i><div class="pe-t">Yuklanmoqda...</div></div>
    </div>
  </div>

</div>

<!-- ── Login berish modal ── -->
<div class="ov" id="ov-portal-login" onclick="if(event.target===this)closeModal('portal-login')">
  <div class="modal" style="max-width:440px">
    <button class="m-close" onclick="closeModal('portal-login')"><i class="ti ti-x"></i></button>
    <h2 style="display:flex;align-items:center;gap:8px">
      <i class="ti ti-key" style="color:var(--acc)"></i> Mijozga login berish
    </h2>
    <div class="fld">
      <label>Mijoz tanlang</label>
      <select id="pl-cust" style="font-family:inherit;font-size:14px;color:var(--ink);
        background:#fff;border:1.5px solid var(--brd);border-radius:var(--rs);padding:9px 11px;width:100%">
        <option value="">— Mijoz tanlang —</option>
        ${(db.customers||[]).map(c=>`<option value="${c.id}">${c.name}${c.phone?' · '+c.phone:''}</option>`).join('')}
      </select>
    </div>
    <div class="r2">
      <div class="fld">
        <label>Telefon (login)</label>
        <input id="pl-phone" placeholder="+998901234567">
      </div>
      <div class="fld">
        <label>Parol</label>
        <div style="display:flex;gap:6px">
          <input id="pl-pass" placeholder="Min. 4 belgi" style="flex:1">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="plGenPass()"
            title="Tasodifiy parol" style="padding:9px 10px;flex-shrink:0">
            <i class="ti ti-dice"></i>
          </button>
        </div>
      </div>
    </div>
    <button class="btn btn-acc" style="width:100%;padding:12px;margin-top:4px"
      onclick="savePortalLogin()">
      <i class="ti ti-check"></i> Saqlash
    </button>
  </div>
</div>

<!-- ── Tovar sozlash modal ── -->
<div class="ov" id="ov-portal-prod" onclick="if(event.target===this)closeModal('portal-prod')">
  <div class="modal" style="max-width:420px">
    <button class="m-close" onclick="closeModal('portal-prod')"><i class="ti ti-x"></i></button>
    <h2 id="pp-title" style="font-size:15px;word-break:break-word">Tovar sozlash</h2>
    <input type="hidden" id="pp-sku">
    <div class="fld">
      <label>Ko'rinishi</label>
      <select id="pp-visible" style="font-family:inherit;font-size:14px;color:var(--ink);
        background:#fff;border:1.5px solid var(--brd);border-radius:var(--rs);padding:9px 11px;width:100%">
        <option value="true">👁 Ko'rinadi</option>
        <option value="false">🚫 Ko'rinmaydi</option>
      </select>
    </div>
    <div class="r2">
      <div class="fld">
        <label>Chegirma (%)</label>
        <input id="pp-discount" type="number" min="0" max="99" value="0">
      </div>
      <div class="fld">
        <label>Chegirma muddati</label>
        <input id="pp-discount-until" type="date">
      </div>
    </div>
    <div class="fld">
      <label>Portal narxi (so'm) — bo'sh = standart narx</label>
      <input id="pp-price" type="number" placeholder="bo'sh = standart narx">
    </div>
    <button class="btn btn-acc" style="width:100%;padding:12px;margin-top:4px"
      onclick="savePortalProduct()">
      <i class="ti ti-check"></i> Saqlash
    </button>
  </div>
</div>
  `;

  loadPortalData();
}

/* ── Ma'lumotlarni yuklash ──────────────────────── */
async function loadPortalData() {
  if (!_sb) {
    ["portal-logins-list","portal-bookings-list","portal-products-list"].forEach(id => {
      const el = $(id); if (!el) return;
      el.innerHTML = `<div class="portal-empty"><i class="ti ti-cloud-off"></i>
        <div class="pe-t">Cloud ulanmagan</div>
        <div class="pe-s">Egasi → Sozlamalar → Cloud (Supabase) ga ulaning</div></div>`;
    });
    return;
  }
  const sid = getCloudShopId();

  try {
    const bf = ($("pbron-filter")||{value:"kutilmoqda"}).value;
    let bronQuery = _sb.from("portal_bookings").select("*").eq("shop_id", sid)
      .order("created_at", { ascending: false });
    if (bf !== "all") bronQuery = bronQuery.eq("status", bf);

    const [{ data: logins }, { data: bookings }, { data: prods }] = await Promise.all([
      _sb.from("portal_customers").select("*").eq("shop_id", sid),
      bronQuery,
      _sb.from("portal_products").select("*").eq("shop_id", sid)
    ]);

    renderPortalLogins(logins || []);
    renderPortalBookings(bookings || []);
    renderPortalProducts(prods || []);

    // Stats
    const activeLogins = (logins||[]).filter(l => l.is_active).length;
    const visibleProds = (db.products||[]).length - (prods||[]).filter(p => p.is_visible === false).length;
    const psL = $("ps-logins"), psB = $("ps-bookings"), psP = $("ps-prods");
    if (psL) psL.textContent = activeLogins;
    if (psB) psB.textContent = bf === "kutilmoqda" || bf === "all"
      ? (bookings||[]).filter(b => b.status === "kutilmoqda").length
      : (bookings||[]).length;
    if (psP) psP.textContent = visibleProds;

  } catch(e) {
    console.warn("Portal data xatosi:", e.message);
  }
}

/* ── Loginlar ro'yxati ─────────────────────────── */
function renderPortalLogins(logins) {
  const el = $("portal-logins-list"); if (!el) return;

  if (!logins.length) {
    el.innerHTML = `<div class="portal-empty">
      <i class="ti ti-users-off"></i>
      <div class="pe-t">Hali login berilmagan</div>
      <div class="pe-s">"Login berish" tugmasini bosing</div>
    </div>`;
    return;
  }

  const palette = ["#4F46E5","#0D9488","#D97706","#DC2626","#7C3AED","#2563EB","#059669","#C2410C"];

  el.innerHTML = logins.map((l, i) => {
    const cust = (db.customers||[]).find(c => c.id === l.customer_id);
    const nm = cust?.name || "Noma'lum";
    const initials = nm.split(" ").map(w => w[0] || "").join("").slice(0, 2).toUpperCase() || "??";
    const bg = palette[i % palette.length];

    return `<div class="plogin-row">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        <div class="pav" style="background:${bg}">${initials}</div>
        <div style="min-width:0">
          <div style="font-weight:600;font-size:13.5px;color:var(--ink);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nm}</div>
          <div style="font-size:12px;color:var(--mut);display:flex;align-items:center;
            gap:5px;margin-top:2px;flex-wrap:wrap">
            <i class="ti ti-phone" style="font-size:11px"></i>${l.phone}
            <span style="color:#ddd">·</span>
            <code style="background:var(--bg);padding:1px 7px;border-radius:5px;
              font-size:11px;letter-spacing:.5px">${l.password}</code>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
        <span class="bg ${l.is_active ? 'bg-g' : 'bg-r'}" style="font-size:11px">
          ${l.is_active ? '● Faol' : '○ Bloklangan'}
        </span>
        <button class="btn btn-ghost btn-icon btn-sm"
          title="${l.is_active ? 'Bloklash' : 'Faollashtirish'}"
          onclick="togglePortalLogin('${l.id}', ${!l.is_active})" style="padding:6px">
          <i class="ti ti-${l.is_active ? 'lock' : 'lock-open'}" style="font-size:14px;color:var(--mut)"></i>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" title="O'chirish"
          onclick="deletePortalLogin('${l.id}')" style="padding:6px">
          <i class="ti ti-trash" style="font-size:14px;color:var(--red)"></i>
        </button>
      </div>
    </div>`;
  }).join("");
}

/* ── Bronlar ro'yxati ──────────────────────────── */
function renderPortalBookings(bookings) {
  const el = $("portal-bookings-list"); if (!el) return;
  const cnt = $("portal-bookings-count");
  if (cnt) cnt.textContent = bookings.length;

  if (!bookings.length) {
    el.innerHTML = `<div class="portal-empty">
      <i class="ti ti-bookmark-off"></i>
      <div class="pe-t">Yangi bronlar yo'q</div>
      <div class="pe-s">Mijozlar bron qilganda bu yerda ko'rinadi</div>
    </div>`;
    return;
  }

  el.innerHTML = bookings.map(b => {
    const cust = (db.customers||[]).find(c => c.id === b.customer_id);
    const prod = (db.products||[]).find(p => p.sku === b.sku);
    const dt = (b.created_at || "").slice(0, 16).replace("T", " ");

    return `<div class="pbron-row">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div style="display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0">
          ${prod?.image
            ? `<img src="${prod.image}" style="width:44px;height:44px;border-radius:9px;
                object-fit:cover;flex-shrink:0;border:1px solid var(--brd)">`
            : `<div style="width:44px;height:44px;border-radius:9px;background:var(--bg);
                display:flex;align-items:center;justify-content:center;flex-shrink:0;
                border:1px solid var(--brd)">
                <i class="ti ti-shirt" style="color:#ddd;font-size:18px"></i>
               </div>`}
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13.5px;white-space:nowrap;
              overflow:hidden;text-overflow:ellipsis">${b.product_name}</div>
            <div style="font-size:12px;color:var(--mut);margin-top:3px;
              display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              ${b.color ? `<span style="display:inline-flex;align-items:center;gap:3px">
                <span style="width:11px;height:11px;border-radius:50%;
                  background:${getColorHex(b.color)};border:1.5px solid rgba(0,0,0,.1);
                  display:inline-block"></span>${b.color}</span>` : ""}
              ${b.size ? `<span>· ${b.size}</span>` : ""}
              · <b>${b.qty} ta</b>
              · <span style="font-weight:700;color:var(--ink)">${cust?.name || "?"}</span>
            </div>
            ${b.note ? `<div style="font-size:11.5px;color:#856404;margin-top:5px;
              padding:4px 9px;background:#FFFBEB;border-radius:6px;
              border-left:3px solid #FCD34D">💬 ${b.note}</div>` : ""}
            <div style="font-size:11px;color:#bbb;margin-top:4px">${dt}</div>
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="btn btn-sm" style="background:var(--grn);color:#fff;
            border-color:var(--grn);padding:7px 12px;border-radius:var(--rs)"
            onclick="confirmBooking('${b.id}')" title="Tasdiqlash">
            <i class="ti ti-check"></i>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="cancelBooking('${b.id}')"
            title="Bekor qilish" style="padding:7px 10px">
            <i class="ti ti-x" style="color:var(--red)"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join("");
}

/* ── Tovarlar ko'rinishi ─────────────────────── */
function renderPortalProducts(portalProds) {
  const el = $("portal-products-list"); if (!el) return;
  const prods = db.products || [];

  const visibleCount = prods.filter(p => {
    const pp = portalProds.find(x => x.sku === p.sku);
    return pp ? pp.is_visible !== false : true;
  }).length;
  const hiddenCount = prods.length - visibleCount;

  const pvV = $("pv-visible"), pvH = $("pv-hidden");
  if (pvV) pvV.textContent = visibleCount;
  if (pvH) pvH.textContent = hiddenCount;
  if ($("ps-prods")) $("ps-prods").textContent = visibleCount;

  if (!prods.length) {
    el.innerHTML = `<div class="portal-empty">
      <i class="ti ti-package-off"></i>
      <div class="pe-t">Tovarlar yo'q</div>
    </div>`;
    return;
  }

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(265px,1fr));gap:9px">
    ${prods.map(p => {
      const pp = portalProds.find(x => x.sku === p.sku);
      const isVisible = pp ? pp.is_visible !== false : true;
      const discount = pp?.discount || 0;
      const discUntil = pp?.discount_until || "";
      const isExpired = discUntil && discUntil < today();
      const hasDiscount = discount > 0 && !isExpired;
      const basePrice = pp?.portal_price || p.priceUzs || p.ulgurjiNarx || 0;
      const cols = [...new Set((p.variants||[]).map(v => v.color).filter(Boolean))];

      return `<div class="pprod-card ${isVisible ? '' : 'ppc-hidden'}">
        ${p.image
          ? `<img src="${p.image}" style="width:48px;height:48px;object-fit:cover;
              border-radius:9px;flex-shrink:0;border:1px solid var(--brd)">`
          : `<div style="width:48px;height:48px;background:var(--bg);border-radius:9px;
              display:flex;align-items:center;justify-content:center;flex-shrink:0;
              border:1px solid var(--brd)">
              <i class="ti ti-photo" style="color:#ccc;font-size:18px"></i>
             </div>`}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;
            text-overflow:ellipsis">${p.name}</div>
          <div style="font-size:11.5px;color:var(--mut);margin-top:1px">
            ${basePrice > 0 ? fmt(basePrice) + " so'm" : "—"}
          </div>
          <div style="display:flex;align-items:center;gap:5px;margin-top:4px;flex-wrap:wrap">
            ${cols.slice(0,5).map(c => {
              const v = (p.variants||[]).find(x => x.color === c);
              const hex = v?.hex || getColorHex(c);
              return `<span style="width:12px;height:12px;border-radius:50%;
                background:${hex};border:1.5px solid rgba(0,0,0,.1);
                display:inline-block" title="${c}"></span>`;
            }).join("")}
            ${hasDiscount ? `<span style="font-size:10.5px;background:var(--red2);
              color:var(--red);padding:1px 7px;border-radius:4px;font-weight:700;
              margin-left:2px">−${discount}%</span>` : ""}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">
          <span class="bg ${isVisible ? 'bg-g' : 'bg-r'}" style="font-size:10.5px;white-space:nowrap">
            ${isVisible ? '👁 Ko\'rinadi' : '🚫 Yashirin'}
          </span>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="openPortalProd('${p.sku}')"
            title="Sozlash" style="padding:5px 7px">
            <i class="ti ti-settings" style="font-size:14px"></i>
          </button>
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

/* ── Login berish ──────────────────────────────── */
function openPortalAddLogin() {
  const sel = $("pl-cust");
  if (sel) {
    sel.innerHTML = '<option value="">— Mijoz tanlang —</option>' +
      (db.customers||[]).map(c =>
        `<option value="${c.id}">${c.name}${c.phone ? ' · ' + c.phone : ''}</option>`
      ).join('');
  }
  if ($("pl-phone")) $("pl-phone").value = "";
  if ($("pl-pass"))  $("pl-pass").value  = "";
  openModal("portal-login");

  if (sel) sel.onchange = () => {
    const c = (db.customers||[]).find(x => x.id === parseInt(sel.value));
    if (c?.phone && $("pl-phone")) $("pl-phone").value = c.phone;
  };
}

function plGenPass() {
  const digits = "0123456789";
  const pass = Array.from({ length: 5 }, () =>
    digits[Math.floor(Math.random() * digits.length)]
  ).join("");
  const inp = $("pl-pass");
  if (inp) { inp.value = pass; inp.focus(); inp.select(); }
}

async function savePortalLogin() {
  if (!_sb) { toast("Avval cloud ga ulaning", "err"); return; }
  const custId = parseInt(($("pl-cust")||{value:""}).value);
  const phone  = ($("pl-phone")||{value:""}).value.trim().replace(/\s/g, "");
  const pass   = ($("pl-pass")||{value:""}).value.trim();

  if (!custId) { toast("Mijoz tanlang", "err"); return; }
  if (!phone)  { toast("Telefon kiriting", "err"); return; }
  if (pass.length < 4) { toast("Parol kamida 4 ta belgi", "err"); return; }

  const sid = getCloudShopId();
  try {
    await _sb.from("portal_customers").upsert({
      id:          sid + "_" + custId,
      shop_id:     sid,
      customer_id: custId,
      phone:       phone,
      password:    pass,
      is_active:   true
    });
    toast("✅ Login saqlandi");
    closeModal("portal-login");
    loadPortalData();
  } catch(e) {
    toast("Xato: " + e.message, "err");
  }
}

async function togglePortalLogin(id, newStatus) {
  if (!_sb) return;
  await _sb.from("portal_customers").update({ is_active: newStatus }).eq("id", id);
  toast(newStatus ? "✅ Faollashtirildi" : "🔒 Bloklandi");
  loadPortalData();
}

async function deletePortalLogin(id) {
  if (!confirm("Bu loginni o'chirasizmi?")) return;
  if (!_sb) return;
  await _sb.from("portal_customers").delete().eq("id", id);
  toast("O'chirildi");
  loadPortalData();
}

/* ── Tovar sozlash ─────────────────────────────── */
function openPortalProd(sku) {
  const p = (db.products||[]).find(x => x.sku === sku); if (!p) return;
  const t = $("pp-title");
  if (t) t.innerHTML = `<i class="ti ti-settings" style="color:var(--acc)"></i> ${p.name}`;
  if ($("pp-sku"))            $("pp-sku").value = sku;
  if ($("pp-discount"))       $("pp-discount").value = 0;
  if ($("pp-discount-until")) $("pp-discount-until").value = "";
  if ($("pp-price"))          $("pp-price").value = "";
  if ($("pp-visible"))        $("pp-visible").value = "true";

  if (_sb) {
    const sid = getCloudShopId();
    _sb.from("portal_products").select("*").eq("id", sid + "_" + sku).single()
      .then(({ data }) => {
        if (!data) return;
        if ($("pp-visible"))        $("pp-visible").value = String(data.is_visible !== false);
        if ($("pp-discount"))       $("pp-discount").value = data.discount || 0;
        if ($("pp-discount-until")) $("pp-discount-until").value = data.discount_until || "";
        if ($("pp-price"))          $("pp-price").value = data.portal_price || "";
      });
  }
  openModal("portal-prod");
}

async function savePortalProduct() {
  if (!_sb) { toast("Avval cloud ga ulaning", "err"); return; }
  const sku      = ($("pp-sku")||{value:""}).value;
  const visible  = ($("pp-visible")||{value:"true"}).value === "true";
  const discount = parseInt(($("pp-discount")||{value:0}).value) || 0;
  const until    = ($("pp-discount-until")||{value:""}).value;
  const price    = parseInt(($("pp-price")||{value:""}).value) || null;
  const sid      = getCloudShopId();

  try {
    await _sb.from("portal_products").upsert({
      id:             sid + "_" + sku,
      shop_id:        sid,
      sku,
      is_visible:     visible,
      discount,
      discount_until: until || null,
      portal_price:   price
    });
    toast("✅ Saqlandi");
    closeModal("portal-prod");
    loadPortalData();
  } catch(e) {
    toast("Xato: " + e.message, "err");
  }
}

/* ── Bron tasdiqlash / bekor qilish ──────────── */
async function confirmBooking(id) {
  if (!_sb) return;
  await _sb.from("portal_bookings").update({ status: "tasdiqlandi" }).eq("id", id);
  toast("✅ Bron tasdiqlandi");
  loadPortalData();
}

async function cancelBooking(id) {
  if (!_sb) return;
  await _sb.from("portal_bookings").update({ status: "bekor" }).eq("id", id);
  toast("Bron bekor qilindi");
  loadPortalData();
}

/* ── Portal link ─────────────────────────────── */
function getPortalLink() {
  const sid  = getCloudShopId ? getCloudShopId() : "default";
  const url  = db?.settings?.supabaseUrl || "";
  const key  = db?.settings?.supabaseKey || "";
  const creds = btoa(url + "|||" + key);
  return location.origin + "/mijoz.html?shop=" + sid + "&c=" + creds;
}

function openPortalPage() {
  window.open(getPortalLink(), "_blank");
}

function copyPortalLink() {
  const link = getPortalLink();
  navigator.clipboard.writeText(link).then(() => {
    toast("✅ Link nusxa olindi — mijozga yuboring");
  }).catch(() => {
    prompt("Linkni nusxa oling:", link);
  });
}

/* ── Rang nomi → hex ─────────────────────────── */
function getColorHex(name) {
  if (!name) return "#888";
  const m = {
    "qora":"#1A1A1A","oq":"#F5F5F5","ko'k":"#154360","moviy":"#5DADE2",
    "qizil":"#C0392B","yashil":"#1E8449","sariq":"#D4AC0D","jigarrang":"#784212",
    "kulrang":"#95A5A6","to'q kulrang":"#2C3E50","binafsha":"#7D3C98",
    "pushti":"#E91E8C","to'q sariq":"#CA6F1E","krem":"#F0E6D3",
    "navy":"#0D1B2A","gray":"#95A5A6","black":"#1A1A1A","white":"#F5F5F5",
    "blue":"#154360","red":"#C0392B","green":"#1E8449","brown":"#784212",
    "purple":"#7D3C98","pink":"#E91E8C","orange":"#CA6F1E","beige":"#F0E6D3",
    "to'q yashil":"#145A32","to'q ko'k":"#1A5276","to'q qizil":"#922B21"
  };
  return m[(name||"").toLowerCase().trim()] || "#888";
}
