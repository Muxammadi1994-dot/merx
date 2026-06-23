-- ================================================
-- MERX Multi-Tenant Schema v2.0
-- Supabase SQL Editor da ishga tushiring
-- ================================================

-- ── 0. Shops (do'konlar) jadvali ─────────────────
create table if not exists shops (
  id          text primary key default gen_random_uuid()::text,
  name        text not null default 'MERX Do''koni',
  owner_id    text,          -- Supabase auth.users.id
  owner_email text,
  plan        text default 'trial',   -- trial | standart | pro
  trial_ends  date default (now() + interval '14 days'),
  active      boolean default true,
  created_at  timestamptz default now()
);

-- ── 1. Mahsulotlar ───────────────────────────────
create table if not exists products (
  id          bigint,
  shop_id     text not null references shops(id) on delete cascade,
  sku         text,
  name        text not null,
  category    text,
  type        text,
  unit        text default 'dona',
  in_box      int  default 1,
  barcode     text,
  cost_usd    numeric(10,2) default 0,
  price_uzs   numeric(15,0) default 0,
  ulgurji     numeric(15,0) default 0,
  image       text,
  variants    jsonb default '[]',
  created_at  timestamptz default now(),
  primary key (id, shop_id)
);

-- ── 2. Sotuvlar ──────────────────────────────────
create table if not exists sales (
  id              bigint,
  shop_id         text not null references shops(id) on delete cascade,
  chek_num        text,
  date            date,
  time            text,
  price_type      text,
  pay_type        text,
  pay_breakdown   jsonb,
  staff_id        bigint,
  customer_id     bigint,
  items           jsonb default '[]',
  subtotal        numeric(15,0) default 0,
  discount        numeric(15,0) default 0,
  total           numeric(15,0) default 0,
  paid            numeric(15,0) default 0,
  orig_paid       numeric(15,0),
  remaining       numeric(15,0) default 0,
  orig_remaining  numeric(15,0),
  due             date,
  customer_name   text,
  customer_phone  text,
  status          text default 'tolandan',
  debt_currency   text default 'uzs',
  debt_usd        numeric(10,2),
  note            text,
  created_at      timestamptz default now(),
  primary key (id, shop_id)
);

-- ── 3. Mijozlar ──────────────────────────────────
create table if not exists customers (
  id              bigint,
  shop_id         text not null references shops(id) on delete cascade,
  name            text not null,
  phone           text,
  phone2          text,
  type            text default 'ulgurji',
  company         text,
  note            text,
  important_note  text,
  birthday        text,
  source          text,
  debt_limit      numeric(15,0),
  loyalty_points  int default 0,
  balance_uzs     numeric(15,0) default 0,
  balance_usd     numeric(10,2) default 0,
  created_at      timestamptz default now(),
  primary key (id, shop_id)
);

-- ── 4. Xodimlar ──────────────────────────────────
create table if not exists staff (
  id              bigint,
  shop_id         text not null references shops(id) on delete cascade,
  name            text not null,
  phone           text,
  pin             text,
  role            text default 'kassir',
  salary          numeric(15,0) default 0,
  bonus_pct       numeric(5,2) default 0,
  month_target    numeric(15,0) default 0,
  start_date      date,
  birthday        text,
  address         text,
  note            text,
  perm_discount   boolean default false,
  max_discount    numeric(5,2) default 0,
  perm_nasiya     boolean default false,
  perm_return     boolean default false,
  paid_months     jsonb default '[]',
  salary_history  jsonb default '[]',
  created_at      timestamptz default now(),
  primary key (id, shop_id)
);

-- ── 5. Ombor kirim ───────────────────────────────
create table if not exists ombor (
  id           bigint,
  shop_id      text not null references shops(id) on delete cascade,
  date         date,
  sku          text,
  product_name text,
  unit         text,
  color        text,
  size         text,
  qty          int default 0,
  boxes        int,
  kirim_narxi  numeric(15,0) default 0,
  chakana      numeric(15,0) default 0,
  ulgurji      numeric(15,0) default 0,
  supplier     text,
  partiya      text,
  pay_status   text default 'tolandan',
  barcode      text,
  created_at   timestamptz default now(),
  primary key (id, shop_id)
);

-- ── 6. Xarajatlar ────────────────────────────────
create table if not exists xarajatlar (
  id          bigint,
  shop_id     text not null references shops(id) on delete cascade,
  date        date,
  category    text,
  amount      numeric(15,0) default 0,
  amount_usd  numeric(10,2),
  recipient   text,
  paid_by     text,
  method      text default 'naqd',
  note        text,
  recurring   boolean default false,
  created_at  timestamptz default now(),
  primary key (id, shop_id)
);

-- ── 7. Qarz to'lovlari ───────────────────────────
create table if not exists debt_payments (
  id          text primary key default gen_random_uuid()::text,
  shop_id     text not null references shops(id) on delete cascade,
  sale_id     bigint,
  date        date,
  amount      numeric(15,0) default 0,
  currency    text default 'uzs',
  method      text default 'naqd',
  staff_id    bigint,
  note        text,
  created_at  timestamptz default now()
);

-- ── 8. Smenalar ──────────────────────────────────
create table if not exists shifts (
  id              text primary key default gen_random_uuid()::text,
  shop_id         text not null references shops(id) on delete cascade,
  staff_id        bigint,
  open_time       text,
  open_date       date,
  open_cash       numeric(15,0) default 0,
  close_time      text,
  close_cash      numeric(15,0),
  expected_cash   numeric(15,0),
  diff            numeric(15,0),
  note            text,
  close_note      text,
  created_at      timestamptz default now()
);

-- ── 9. Sozlamalar (har do'kon uchun) ─────────────
create table if not exists settings (
  shop_id         text primary key references shops(id) on delete cascade,
  shop_name       text default 'MERX Do''koni',
  rate            numeric(10,0) default 12800,
  price_currency  text default 'uzs',
  shop_type       text default 'ikki',
  eskiz_token     text,
  eskiz_sender    text,
  telegram_bot    text,
  loyalty_rate    int default 0,
  loyalty_value   int default 100,
  updated_at      timestamptz default now()
);

-- ── 10. Portal (mijoz login) ─────────────────────
create table if not exists portal_customers (
  id          text primary key default gen_random_uuid()::text,
  shop_id     text not null references shops(id) on delete cascade,
  customer_id bigint,
  phone       text not null,
  password    text not null,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- ── 11. Portal bronlar ───────────────────────────
create table if not exists portal_bookings (
  id           text primary key,
  shop_id      text not null references shops(id) on delete cascade,
  customer_id  bigint,
  sku          text,
  product_name text,
  color        text,
  size         text,
  qty          int default 1,
  note         text,
  status       text default 'kutilmoqda',
  created_at   timestamptz default now()
);

-- ── 12. Portal tovarlar sozlama ──────────────────
create table if not exists portal_products (
  shop_id        text not null references shops(id) on delete cascade,
  sku            text not null,
  is_visible     boolean default true,
  discount       int default 0,
  discount_until date,
  portal_price   numeric(15,0),
  primary key (shop_id, sku)
);

-- ════════════════════════════════════════════════
-- RLS (Row Level Security) — har do'kon o'z data
-- ════════════════════════════════════════════════

-- Shops
alter table shops enable row level security;
create policy "shop_owner_access" on shops
  for all using (true) with check (true);

-- Har jadval uchun shop_id asosida RLS
do $$ 
declare t text;
begin
  foreach t in array array['products','sales','customers','staff','ombor',
    'xarajatlar','debt_payments','shifts','settings',
    'portal_customers','portal_bookings','portal_products']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "shop_isolation_%s" on %I for all using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- ════════════════════════════════════════════════
-- SUPERADMIN: Barcha do'konlarni ko'rish uchun
-- (keyinroq Supabase Auth bilan bog'lanadi)
-- ════════════════════════════════════════════════

create table if not exists superadmins (
  email       text primary key,
  created_at  timestamptz default now()
);
