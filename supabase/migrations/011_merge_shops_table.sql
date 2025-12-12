-- Migration: Gộp shopee_tokens + shop_info_cache → shops
-- Mục tiêu: 1 bảng shops chứa tất cả thông tin của shop

-- ============================================
-- 1. TẠO BẢNG SHOPS MỚI
-- ============================================

CREATE TABLE IF NOT EXISTS shops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL UNIQUE,
  
  -- Token info (từ shopee_tokens)
  access_token TEXT,
  refresh_token TEXT,
  expire_in INTEGER DEFAULT 14400,
  expired_at BIGINT,
  merchant_id BIGINT,
  
  -- Shop info (từ shop_info_cache)
  shop_name TEXT,
  region TEXT,
  status TEXT,  -- BANNED, FROZEN, NORMAL
  shop_logo TEXT,
  description TEXT,
  is_cb BOOLEAN DEFAULT FALSE,
  is_sip BOOLEAN DEFAULT FALSE,
  is_upgraded_cbsc BOOLEAN DEFAULT FALSE,
  shop_fulfillment_flag TEXT,
  is_main_shop BOOLEAN DEFAULT FALSE,
  is_direct_shop BOOLEAN DEFAULT FALSE,
  linked_main_shop_id BIGINT,
  linked_direct_shop_list JSONB,
  sip_affi_shops JSONB,
  is_one_awb BOOLEAN,
  is_mart_shop BOOLEAN,
  is_outlet_shop BOOLEAN,
  auth_time BIGINT,
  expire_time BIGINT,
  
  -- Timestamps
  token_updated_at TIMESTAMPTZ,
  info_cached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shops_shop_id ON shops(shop_id);
CREATE INDEX IF NOT EXISTS idx_shops_expired_at ON shops(expired_at);
CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status);

-- ============================================
-- 2. MIGRATE DATA TỪ CÁC BẢNG CŨ
-- ============================================

-- Migrate từ shopee_tokens
INSERT INTO shops (shop_id, access_token, refresh_token, expire_in, expired_at, merchant_id, token_updated_at, created_at)
SELECT 
  shop_id,
  access_token,
  refresh_token,
  expire_in,
  expired_at,
  merchant_id,
  updated_at,
  created_at
FROM shopee_tokens
ON CONFLICT (shop_id) DO UPDATE SET
  access_token = EXCLUDED.access_token,
  refresh_token = EXCLUDED.refresh_token,
  expire_in = EXCLUDED.expire_in,
  expired_at = EXCLUDED.expired_at,
  merchant_id = EXCLUDED.merchant_id,
  token_updated_at = EXCLUDED.token_updated_at;

-- Migrate từ shop_info_cache
INSERT INTO shops (shop_id, shop_name, region, status, shop_logo, description, is_cb, is_sip, 
  is_upgraded_cbsc, shop_fulfillment_flag, is_main_shop, is_direct_shop, linked_main_shop_id,
  linked_direct_shop_list, sip_affi_shops, is_one_awb, is_mart_shop, is_outlet_shop,
  auth_time, expire_time, info_cached_at)
SELECT 
  shop_id,
  shop_name,
  region,
  status,
  shop_logo,
  description,
  is_cb,
  is_sip,
  is_upgraded_cbsc,
  shop_fulfillment_flag,
  is_main_shop,
  is_direct_shop,
  linked_main_shop_id,
  linked_direct_shop_list,
  sip_affi_shops,
  is_one_awb,
  is_mart_shop,
  is_outlet_shop,
  auth_time,
  expire_time,
  cached_at
FROM shop_info_cache
ON CONFLICT (shop_id) DO UPDATE SET
  shop_name = EXCLUDED.shop_name,
  region = EXCLUDED.region,
  status = EXCLUDED.status,
  shop_logo = EXCLUDED.shop_logo,
  description = EXCLUDED.description,
  is_cb = EXCLUDED.is_cb,
  is_sip = EXCLUDED.is_sip,
  is_upgraded_cbsc = EXCLUDED.is_upgraded_cbsc,
  shop_fulfillment_flag = EXCLUDED.shop_fulfillment_flag,
  is_main_shop = EXCLUDED.is_main_shop,
  is_direct_shop = EXCLUDED.is_direct_shop,
  linked_main_shop_id = EXCLUDED.linked_main_shop_id,
  linked_direct_shop_list = EXCLUDED.linked_direct_shop_list,
  sip_affi_shops = EXCLUDED.sip_affi_shops,
  is_one_awb = EXCLUDED.is_one_awb,
  is_mart_shop = EXCLUDED.is_mart_shop,
  is_outlet_shop = EXCLUDED.is_outlet_shop,
  auth_time = EXCLUDED.auth_time,
  expire_time = EXCLUDED.expire_time,
  info_cached_at = EXCLUDED.info_cached_at;

-- ============================================
-- 3. CẬP NHẬT user_shops FK
-- ============================================

-- Thêm FK từ user_shops → shops (nếu chưa có)
-- Lưu ý: Chỉ thêm nếu shop_id đã tồn tại trong shops
INSERT INTO shops (shop_id)
SELECT DISTINCT us.shop_id 
FROM user_shops us
WHERE NOT EXISTS (SELECT 1 FROM shops s WHERE s.shop_id = us.shop_id)
ON CONFLICT (shop_id) DO NOTHING;

-- ============================================
-- 4. ENABLE RLS
-- ============================================

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- RLS Policies (dựa trên user_shops)
CREATE POLICY "Users can view their shops"
  ON shops FOR SELECT
  USING (shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their shops"
  ON shops FOR INSERT
  WITH CHECK (shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their shops"
  ON shops FOR UPDATE
  USING (shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their shops"
  ON shops FOR DELETE
  USING (shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = auth.uid()));

-- ============================================
-- 5. XÓA BẢNG CŨ
-- ============================================

-- Drop policies trước
DROP POLICY IF EXISTS "Users can view tokens for their shops" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can insert tokens for their shops" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can update tokens for their shops" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can delete tokens for their shops" ON shopee_tokens;

-- Drop tables
DROP TABLE IF EXISTS shopee_tokens;
DROP TABLE IF EXISTS shop_info_cache;

-- ============================================
-- 6. TRIGGER CHO updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_shops_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_shops_updated_at ON shops;
CREATE TRIGGER trigger_shops_updated_at
  BEFORE UPDATE ON shops
  FOR EACH ROW
  EXECUTE FUNCTION update_shops_updated_at();

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON shops TO authenticated;

-- ============================================
-- 8. COMMENTS
-- ============================================

COMMENT ON TABLE shops IS 'Thông tin shop bao gồm token và cache info';
COMMENT ON COLUMN shops.shop_id IS 'Shopee Shop ID (unique)';
COMMENT ON COLUMN shops.access_token IS 'OAuth access token';
COMMENT ON COLUMN shops.refresh_token IS 'OAuth refresh token';
COMMENT ON COLUMN shops.expired_at IS 'Token expiry timestamp (ms)';
COMMENT ON COLUMN shops.status IS 'Shop status: BANNED, FROZEN, NORMAL';
