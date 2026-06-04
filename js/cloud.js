// ================================================
// MERX — js/cloud.js
// Supabase cloud sinxronizatsiya
// ================================================

let supabaseClient = null;
let syncTimer = null;

function updateCloudUI(ok) {
  const badge = $("cloud-status-badge"), pill = $("cloud-pill");
  if (badge) { badge.textContent = ok ? "Ulangan" : "Ulanmagan"; badge.className = "bg " + (ok?"bg-g":"bg-gr"); }
  if (pill)  pill.style.display = ok ? "flex" : "none";
}
function updateSmsUI() {
  const b = $("sms-status-badge"); if (!b) return;
  const ok = !!db.settings.eskizToken;
  b.textContent = ok ? "Faol" : "Test rejimi";
  b.className = "bg " + (ok ? "bg-g" : "bg-gr");
}
function scheduleCloudSync() {
  if (!supabaseClient) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushToCloud, 5000);
}
async function initSupabase() {
  const url = db.settings.supabaseUrl, key = db.settings.supabaseKey;
  if (!url || !key) return false;
  try {
    if (!window.supabase) return false;
    supabaseClient = window.supabase.createClient(url, key);
    const { error } = await supabaseClient.from("merx_data").select("id").limit(1);
    if (error) { supabaseClient = null; return false; }
    updateCloudUI(true); return true;
  } catch(e) { supabaseClient = null; return false; }
}
async function connectCloud() {
  toast("Supabase ga ulanmoqda...", "info");
  const ok = await initSupabase();
  if (ok) { await pushToCloud(); toast("\u2705 Cloud ga ulandi! Ma'lumotlar sinxronlandi."); }
  else toast("Ulanmadi — URL va key ni tekshiring", "err");
}
async function pushToCloud() {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from("merx_data").upsert({
      id:"main", shop_name:db.shop.name,
      data:JSON.stringify(db), updated_at:new Date().toISOString()
    });
  } catch(e) { console.error("Cloud push:", e); }
}
async function pullFromCloud() {
  if (!supabaseClient) { toast("Avval cloud ga ulaning","err"); return; }
  toast("Clouddan yuklanmoqda...", "info");
  try {
    const { data, error } = await supabaseClient.from("merx_data").select("data").eq("id","main").single();
    if (error||!data) { toast("Cloud da ma'lumot topilmadi","err"); return; }
    db = JSON.parse(data.data);
    try { localStorage.setItem(DBKEY, JSON.stringify(db)); } catch(e) {}
    init(); toast("\u2705 Cloud dan yangilandi!");
  } catch(e) { toast("Yuklashda xatolik","err"); }
}
