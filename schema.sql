-- =============================================
-- MERX Cloud Schema — Supabase SQL Editor da ishga tushiring
-- supabase.com → Project → SQL Editor → New Query → paste → Run
-- =============================================

-- 1. Asosiy jadval — butun ma'lumotni saqlaydi
CREATE TABLE IF NOT EXISTS merx_data (
  id          TEXT PRIMARY KEY,
  shop_name   TEXT,
  data        TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Row Level Security (RLS) — hozircha ochiq, keyinchalik login qo'shiladi
ALTER TABLE merx_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hamma operatsiyalarga ruxsat" ON merx_data
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Yangilanish vaqtini avtomatik yangilash
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER merx_data_updated_at
  BEFORE UPDATE ON merx_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- TAYYOR! Endi MERX → Egasi → Cloud bo'limiga
-- Project URL va Anon Key ni kiriting → "Ulash" bosing
-- =============================================
