// MERX portal.js | v1.0 | 2026-06-10
// ================================================
// Mijoz portali — Admin boshqaruv qismi
// ================================================

// ── Portal sahifasini render qilish ──────────────
function renderPortal() {
  const el = $("p-portal"); if (!el) return;

  const sb = window._sb_portal || null;
  const sid = getCloudShopId ? getCloudShopId() : "default";

  el.innerHTML = `
    <div style="max-width:1100px">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#0D1B2A;margin:0">
            <i class="ti ti-users" style="color:var(--acc)"></i> Mijoz portali
          </h2>
          <div style="font-size:13px;color:#aaa;margin-top:3px">
            Mijozlar onlayn ko'rishi mumkin bo'lgan sahifa
          </div>
        </div>
        <a href="mijoz.html?shop=${sid}" target="_blank"
          style="display:inline-flex;align-items:center;gap:6px;background:var(--acc);
            color:#fff;padding:8px 16px;border-radius:8px;font-weight:600;font-size:13px;text-decoration:none">
          <i class="ti ti-external-link"></i> Portal ochish
        </a>
      </div>

      <!-- 2 ustun -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">

        <!-- Mijoz loginlari -->
        <div class="card">
          <div class="ch">
            <h3><i class="ti ti-key"></i> Mijoz loginlari</h3>
            <button class="btn btn-acc btn-sm" onclick="openPortalAddLogin()">
              <i class="ti ti-plus"></i> Login berish
            </button>
          </div>
          <div id="portal-logins-list" style="padding:0 16px 12px">
            <div style="color:#ccc;text-align:center;padding:20px;font-size:13px">Yuklanmoqda...</div>
          </div>
        </div>

        <!-- Bronlar -->
        <div class="card">
          <div class="ch">
            <h3><i class="ti ti-bookmark"></i> Bronlar</h3>
            <span id="portal-bookings-count" class="bg bg-a" style="font-size:12px">0</span>
          </div>
          <div id="portal-bookings-list" style="padding:0 16px 12px">
            <div style="color:#ccc;text-align:center;padding:20px;font-size:13px">Yuklanmoqda...</div>
          </div>
        </div>
      </div>

      <!-- Tovarlar ko'rinishi -->
      <div class="card">
        <div class="ch">
          <h3><i class="ti ti-eye"></i> Portal uchun tovarlar</h3>
          <div style="font-size:12px;color:#aaa">Mijozlar ko'radigan tovarlar</div>
        </div>
        <div id="portal-products-list" style="padding:0 16px 16px">
          <div style="color:#ccc;text-align:center;padding:20px;font-size:13px">Yuklanmoqda...</div>
        </div>
      </div>

    </div>

    <!-- Login berish modal -->
    <div class="ov" id="ov-portal-login" onclick="if(event.target===this)closeModal('portal-login')">
      <div class="modal" style="max-width:420px">
        <button class="m-close" onclick="closeModal('portal-login')"><i class="ti ti-x"></i></button>
        <h2>Mijozga login berish</h2>
        <div class="fld">
          <label>Mijoz tanlang</label>
          <select id="pl-cust" style="font-family:inherit;font-size:13px;padding:8px 10px;border:1.5px solid var(--brd);border-radius:8px;width:100%">
            <option value="">— Mijoz tanlang —</option>
            ${(db.customers||[]).map(c => `<option value="${c.id}">${c.name} ${c.phone ? '· '+c.phone : ''}</option>`).join('')}
          </select>
        </div>
        <div class="fld">
          <label>Telefon (login)</label>
          <input id="pl-phone" placeholder="+998901234567" style="font-family:inherit">
        </div>
        <div class="fld">
          <label>Parol</label>
          <div style="display:flex;gap:8px">
            <input id="pl-pass" placeholder="Kamida 4 ta belgi" style="font-family:inherit;flex:1">
            <button class="btn btn-sm" onclick="plGenPass()" title="Avtomatik parol">
              <i class="ti ti-refresh"></i>
            </button>
          </div>
        </div>
        <button class="btn btn-acc" style="width:100%;margin-top:8px" onclick="savePortalLogin()">
          <i class="ti ti-check"></i> Saqlash
        </button>
      </div>
    </div>

    <!-- Tovar sozlash modal -->
    <div class="ov" id="ov-portal-prod" onclick="if(event.target===this)closeModal('portal-prod')">
      <div class="modal" style="max-width:420px">
        <button class="m-close" onclick="closeModal('portal-prod')"><i class="ti ti-x"></i></button>
        <h2 id="pp-title">Tovar sozlash</h2>
        <input type="hidden" id="pp-sku">
        <div class="fld">
          <label>Ko'rinishi</label>
          <select id="pp-visible" style="font-family:inherit;font-size:13px;padding:8px 10px;border:1.5px solid var(--brd);border-radius:8px;width:100%">
            <option value="true">✅ Ko'rinadi</option>
            <option value="false">🚫 Ko'rinmaydi</option>
          </select>
        </div>
        <div class="fld">
          <label>Chegirma (%)</label>
          <input id="pp-discount" type="number" min="0" max="99" value="0" style="font-family:inherit">
        </div>
        <div class="fld">
          <label>Chegirma muddati</label>
          <input id="pp-discount-until" type="date" style="font-family:inherit">
        </div>
        <div class="fld">
          <label>Maxsus narx (so'm) — bo'sh = standart narx</label>
          <input id="pp-price" type="number" placeholder="0 = standart narx" style="font-family:inherit">
        </div>
        <button class="btn btn-acc" style="width:100%;margin-top:8px" onclick="savePortalProduct()">
          <i class="ti ti-check"></i> Saqlash
        </button>
      </div>
    </div>
  `;

  // Ma'lumotlarni yuklaymiz
  loadPortalData();
}

// ── Ma'lumotlarni yuklash ─────────────────────────
async function loadPortalData() {
  if (!_sb) return;
  const sid = getCloudShopId();

  try {
    // Loginlar
    const { data: logins } = await _sb.from("portal_customers")
      .select("*").eq("shop_id", sid);
    renderPortalLogins(logins || []);

    // Bronlar
    const { data: bookings } = await _sb.from("portal_bookings")
      .select("*").eq("shop_id", sid).eq("status", "kutilmoqda").order("created_at", {ascending: false});
    renderPortalBookings(bookings || []);

    // Tovarlar
    const { data: prods } = await _sb.from("portal_products")
      .select("*").eq("shop_id", sid);
    renderPortalProducts(prods || []);

  } catch(e) {
    console.warn("Portal data xatosi:", e.message);
  }
}

// ── Loginlar ro'yxati ─────────────────────────────
function renderPortalLogins(logins) {
  const el = $("portal-logins-list"); if (!el) return;
  if (!logins.length) {
    el.innerHTML = `<div style="color:#ccc;text-align:center;padding:20px;font-size:13px">
      Hali login berilmagan
    </div>`;
    return;
  }
  el.innerHTML = logins.map(l => {
    const cust = (db.customers||[]).find(c => c.id === l.customer_id);
    return `<div style="display:flex;justify-content:space-between;align-items:center;
        padding:10px 0;border-bottom:1px solid var(--brd)">
      <div>
        <div style="font-weight:600;font-size:13px">${cust?.name || "Noma'lum"}</div>
        <div style="font-size:12px;color:#aaa">${l.phone} · Parol: <code style="background:var(--bg);padding:1px 5px;border-radius:4px">${l.password}</code></div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="bg ${l.is_active ? 'bg-g' : 'bg-r'}" style="font-size:11px">
          ${l.is_active ? 'Faol' : 'Bloklangan'}
        </span>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="togglePortalLogin('${l.id}', ${!l.is_active})"
          title="${l.is_active ? 'Bloklash' : 'Faollashtirish'}">
          <i class="ti ti-${l.is_active ? 'lock' : 'lock-open'}"></i>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="deletePortalLogin('${l.id}')" title="O'chirish">
          <i class="ti ti-trash" style="color:var(--red)"></i>
        </button>
      </div>
    </div>`;
  }).join("");
}

// ── Bronlar ro'yxati ──────────────────────────────
function renderPortalBookings(bookings) {
  const el = $("portal-bookings-list"); if (!el) return;
  const cnt = $("portal-bookings-count");
  if (cnt) cnt.textContent = bookings.length;

  if (!bookings.length) {
    el.innerHTML = `<div style="color:#ccc;text-align:center;padding:20px;font-size:13px">Bron yo'q</div>`;
    return;
  }
  el.innerHTML = bookings.map(b => {
    const cust = (db.customers||[]).find(c => c.id === b.customer_id);
    return `<div style="padding:10px 0;border-bottom:1px solid var(--brd)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:600;font-size:13px">${b.product_name}</div>
          <div style="font-size:12px;color:#aaa">
            ${b.color || ''} ${b.size || ''} · ${b.qty} ta
            · ${cust?.name || 'Noma\'lum'}
          </div>
          ${b.note ? `<div style="font-size:11.5px;color:#856404;margin-top:2px">📝 ${b.note}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" style="background:var(--grn);color:#fff;border-color:var(--grn)"
            onclick="confirmBooking('${b.id}')">
            <i class="ti ti-check"></i>
          </button>
          <button class="btn btn-sm btn-ghost" onclick="cancelBooking('${b.id}')">
            <i class="ti ti-x" style="color:var(--red)"></i>
          </button>
        </div>
      </div>
      <div style="font-size:11px;color:#ccc;margin-top:4px">${b.created_at?.slice(0,16)||''}</div>
    </div>`;
  }).join("");
}

// ── Tovarlar ko'rinishi ───────────────────────────
function renderPortalProducts(portalProds) {
  const el = $("portal-products-list"); if (!el) return;
  const prods = db.products || [];

  el.innerHTML = `
    <div style="margin-bottom:12px;font-size:12.5px;color:#aaa">
      Barcha tovarlar default ko'rinadi. Sozlash uchun tovar yonidagi tugmani bosing.
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
      ${prods.map(p => {
        const pp = portalProds.find(x => x.sku === p.sku);
        const isVisible = pp ? pp.is_visible : true;
        const discount = pp?.discount || 0;
        const discUntil = pp?.discount_until || '';
        const isExpired = discUntil && discUntil < today();
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px;
            border:1.5px solid ${isVisible ? 'var(--brd)' : '#fecaca'};
            border-radius:10px;background:${isVisible ? 'var(--bg)' : '#FEF2F2'}">
          ${p.image
            ? `<img src="${p.image}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;flex-shrink:0">`
            : `<div style="width:44px;height:44px;background:#f0ede8;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ccc"><i class="ti ti-photo"></i></div>`}
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
            <div style="font-size:11.5px;color:#aaa">${fmt(p.priceUzs||0)} so'm</div>
            ${discount > 0 && !isExpired
              ? `<span style="font-size:11px;background:#FEF2F2;color:var(--red);padding:1px 6px;border-radius:4px">−${discount}% chegirma${discUntil ? ' · '+discUntil+' gacha' : ''}</span>`
              : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            <span class="bg ${isVisible ? 'bg-g' : 'bg-r'}" style="font-size:10.5px">
              ${isVisible ? '👁 Ko\'rinadi' : '🚫 Yashirin'}
            </span>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="openPortalProd('${p.sku}')" title="Sozlash">
              <i class="ti ti-settings"></i>
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

// ── Login berish ──────────────────────────────────
function openPortalAddLogin() {
  // Mijozlar selectini yangilaymiz
  const sel = $("pl-cust");
  if (sel) {
    sel.innerHTML = '<option value="">— Mijoz tanlang —</option>' +
      (db.customers||[]).map(c => `<option value="${c.id}">${c.name}${c.phone?' · '+c.phone:''}</option>`).join('');
  }
  if ($("pl-phone")) $("pl-phone").value = "";
  if ($("pl-pass"))  $("pl-pass").value  = "";
  openModal("portal-login");

  // Mijoz tanlanganda telefoni avtomatik to'ladi
  if (sel) sel.onchange = () => {
    const c = db.customers.find(x => x.id === parseInt(sel.value));
    if (c?.phone && $("pl-phone")) $("pl-phone").value = c.phone;
  };
}

function plGenPass() {
  const pass = Math.floor(1000 + Math.random() * 9000).toString();
  if ($("pl-pass")) $("pl-pass").value = pass;
}

async function savePortalLogin() {
  if (!_sb) { toast("Avval cloud ga ulaning", "err"); return; }
  const custId = parseInt(($("pl-cust")||{value:""}).value);
  const phone  = ($("pl-phone")||{value:""}).value.trim();
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
      phone:       phone.replace(/\s/g,""),
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

// ── Tovar sozlash ─────────────────────────────────
function openPortalProd(sku) {
  const p = (db.products||[]).find(x => x.sku === sku); if (!p) return;
  if ($("pp-title"))   $("pp-title").textContent = p.name;
  if ($("pp-sku"))     $("pp-sku").value = sku;
  if ($("pp-discount")) $("pp-discount").value = 0;
  if ($("pp-discount-until")) $("pp-discount-until").value = "";
  if ($("pp-price"))   $("pp-price").value = "";
  if ($("pp-visible")) $("pp-visible").value = "true";

  // Mavjud sozlamalarni yuklaymiz
  if (_sb) {
    const sid = getCloudShopId();
    _sb.from("portal_products").select("*").eq("id", sid+"_"+sku).single()
      .then(({data}) => {
        if (!data) return;
        if ($("pp-visible")) $("pp-visible").value = String(data.is_visible !== false);
        if ($("pp-discount")) $("pp-discount").value = data.discount || 0;
        if ($("pp-discount-until")) $("pp-discount-until").value = data.discount_until || "";
        if ($("pp-price")) $("pp-price").value = data.portal_price || "";
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

// ── Bron tasdiqlash/bekor qilish ──────────────────
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
