-- ================================================
-- MERX — Supabase Schema
-- SQL Editor da ishga tushiring
-- ================================================

-- 1. Mahsulotlar
create table if not exists products (
  id          bigint primary key,
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
  created_at  timestamptz default now()
);

-- 2. Sotuvlar
create table if not exists sales (
  id              bigint primary key,
  chek_num        text,
  date            date,
  time            text,
  price_type      text,
  pay_type        text,
  staff_id        bigint,
  customer_id     bigint,
  items           jsonb default '[]',
  subtotal        numeric(15,0) default 0,
  discount        numeric(15,0) default 0,
  total           numeric(15,0) default 0,
  paid            numeric(15,0) default 0,
  remaining       numeric(15,0) default 0,
  due             date,
  customer_name   text,
  customer_phone  text,
  status          text default 'tolandan',
  debt_currency   text default 'uzs',
  debt_usd        numeric(10,2),
  note            text,
  created_at      timestamptz default now()
);

-- 3. Mijozlar
create table if not exists customers (
  id         bigint primary key,
  name       text not null,
  phone      text,
  type       text default 'ulgurji',
  note       text,
  created_at timestamptz default now()
);

-- 4. Xodimlar
create table if not exists staff (
  id         bigint primary key,
  name       text not null,
  phone      text,
  role       text default 'kassir',
  created_at timestamptz default now()
);

-- 5. Ombor kirim
create table if not exists ombor (
  id           bigint primary key,
  date         date,
  sku          text,
  product_name text,
  unit         text,
  color        text,
  size         text,
  qty          int default 0,
  boxes        int,
  pantone      text,
  hex          text,
  kirim_narxi  numeric(15,0) default 0,
  chakana      numeric(15,0) default 0,
  ulgurji      numeric(15,0) default 0,
  supplier     text,
  partiya      text,
  pay_status   text default 'tolandan',
  barcode      text,
  created_at   timestamptz default now()
);

-- 6. Xarajatlar
create table if not exists xarajatlar (
  id         bigint primary key,
  date       date,
  category   text,
  amount     numeric(15,0) default 0,
  recipient  text,
  paid_by    text,
  note       text,
  created_at timestamptz default now()
);

-- 7. Sozlamalar (bitta qator)
create table if not exists settings (
  id              int primary key default 1,
  shop_name       text default 'MERX Do''koni #1',
  rate            numeric(10,0) default 12800,
  price_currency  text default 'uzs',
  shop_type       text default 'ikki',
  show_chakana    boolean default false,
  eskiz_token     text,
  eskiz_sender    text,
  supabase_url    text,
  supabase_key    text,
  updated_at      timestamptz default now()
);

-- RLS (Row Level Security) - agar kerak bo'lsa yoqish mumkin
-- Hozircha ochiq (anon key bilan o'qish/yozish)
alter table products   enable row level security;
alter table sales      enable row level security;
alter table customers  enable row level security;
alter table staff      enable row level security;
alter table ombor      enable row level security;
alter table xarajatlar enable row level security;
alter table settings   enable row level security;

-- Anon uchun ruxsat (hozircha to'liq ruxsat)
create policy "anon_all_products"   on products   for all using (true) with check (true);
create policy "anon_all_sales"      on sales      for all using (true) with check (true);
create policy "anon_all_customers"  on customers  for all using (true) with check (true);
create policy "anon_all_staff"      on staff      for all using (true) with check (true);
create policy "anon_all_ombor"      on ombor      for all using (true) with check (true);
create policy "anon_all_xarajatlar" on xarajatlar for all using (true) with check (true);
create policy "anon_all_settings"   on settings   for all using (true) with check (true);

-- Insert default settings
insert into settings (id, shop_name) values (1, 'MERX Do''koni #1')
on conflict (id) do nothing;
