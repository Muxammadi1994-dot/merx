-- ════════════════════════════════════════════════════════
-- MERX Multi-tenant schema.sql (Supabase PostgreSQL)
-- Har jadvalda shop_id — do'konlarni izolyatsiya qiladi
-- ════════════════════════════════════════════════════════

-- Settings (har do'kon uchun 1 qator)
CREATE TABLE IF NOT EXISTS settings (
  id             TEXT PRIMARY KEY,  -- shop_id
  shop_id        TEXT NOT NULL,
  shop_name      TEXT DEFAULT 'MERX',
  rate           INTEGER DEFAULT 12800,
  price_currency TEXT DEFAULT 'uzs',
  shop_type      TEXT DEFAULT 'ikki',
  show_chakana   BOOLEAN DEFAULT false,
  eskiz_token    TEXT,
  eskiz_sender   TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id        TEXT PRIMARY KEY,     -- shop_id + "_" + sku
  shop_id   TEXT NOT NULL,
  sku       TEXT NOT NULL,
  name      TEXT NOT NULL,
  category  TEXT,
  type      TEXT DEFAULT 'oyoq',
  unit      TEXT DEFAULT 'dona',
  in_box    INTEGER DEFAULT 1,
  barcode   TEXT,
  cost_usd  NUMERIC(10,2) DEFAULT 0,
  price_uzs BIGINT DEFAULT 0,
  ulgurji   BIGINT DEFAULT 0,
  variants  JSONB DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS products_shop_id ON products(shop_id);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id        TEXT PRIMARY KEY,
  shop_id   TEXT NOT NULL,
  local_id  INTEGER NOT NULL,
  name      TEXT NOT NULL,
  phone     TEXT,
  type      TEXT DEFAULT 'ulgurji',
  note      TEXT
);
CREATE INDEX IF NOT EXISTS customers_shop_id ON customers(shop_id);

-- Staff
CREATE TABLE IF NOT EXISTS staff (
  id        TEXT PRIMARY KEY,
  shop_id   TEXT NOT NULL,
  local_id  INTEGER NOT NULL,
  name      TEXT NOT NULL,
  phone     TEXT,
  role      TEXT DEFAULT 'kassir'
);
CREATE INDEX IF NOT EXISTS staff_shop_id ON staff(shop_id);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id             TEXT PRIMARY KEY,
  shop_id        TEXT NOT NULL,
  local_id       INTEGER NOT NULL,
  chek_num       TEXT,
  date           TEXT NOT NULL,
  time           TEXT,
  price_type     TEXT,
  pay_type       TEXT,
  staff_id       INTEGER,
  customer_id    INTEGER,
  items          JSONB DEFAULT '[]',
  subtotal       BIGINT DEFAULT 0,
  discount       BIGINT DEFAULT 0,
  total          BIGINT DEFAULT 0,
  paid           BIGINT DEFAULT 0,
  remaining      BIGINT DEFAULT 0,
  due            TEXT,
  customer_name  TEXT,
  customer_phone TEXT,
  status         TEXT DEFAULT 'tolandan',
  debt_currency  TEXT DEFAULT 'uzs',
  debt_usd       NUMERIC(10,2),
  note           TEXT
);
CREATE INDEX IF NOT EXISTS sales_shop_id ON sales(shop_id);
CREATE INDEX IF NOT EXISTS sales_date ON sales(shop_id, date);

-- Ombor (kirim tarixi)
CREATE TABLE IF NOT EXISTS ombor (
  id           TEXT PRIMARY KEY,
  shop_id      TEXT NOT NULL,
  local_id     INTEGER NOT NULL,
  date         TEXT NOT NULL,
  sku          TEXT,
  product_name TEXT NOT NULL,
  unit         TEXT,
  color        TEXT,
  size         TEXT,
  qty          INTEGER DEFAULT 0,
  boxes        INTEGER,
  kirim_narxi  BIGINT DEFAULT 0,
  ulgurji      BIGINT DEFAULT 0,
  supplier     TEXT,
  partiya      TEXT,
  pay_status   TEXT DEFAULT 'tolandan'
);
CREATE INDEX IF NOT EXISTS ombor_shop_id ON ombor(shop_id);

-- Xarajatlar
CREATE TABLE IF NOT EXISTS xarajatlar (
  id        TEXT PRIMARY KEY,
  shop_id   TEXT NOT NULL,
  local_id  INTEGER NOT NULL,
  date      TEXT NOT NULL,
  category  TEXT,
  amount    BIGINT DEFAULT 0,
  recipient TEXT,
  paid_by   TEXT,
  note      TEXT
);
CREATE INDEX IF NOT EXISTS xarajatlar_shop_id ON xarajatlar(shop_id);

-- Chiqimlar (hisobdan chiqarish)
CREATE TABLE IF NOT EXISTS chiqimlar (
  id           TEXT PRIMARY KEY,
  shop_id      TEXT NOT NULL,
  local_id     INTEGER NOT NULL,
  date         TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku          TEXT,
  color        TEXT,
  size         TEXT,
  qty          INTEGER DEFAULT 0,
  reason       TEXT,
  note         TEXT,
  cost_uzs     BIGINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS chiqimlar_shop_id ON chiqimlar(shop_id);

-- ════════════════════════════════════════════════════════
-- RLS (Row Level Security) — IXTIYORIY lekin tavsiya etiladi
-- Agar anon key ishlatilsa, quyidagi policy qo'shing:
-- ════════════════════════════════════════════════════════
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "shop_isolation" ON products
--   USING (shop_id = current_setting('app.shop_id', true));
-- (Bu Supabase Edge Functions bilan ishlaydi)
-- ════════════════════════════════════════════════════════
