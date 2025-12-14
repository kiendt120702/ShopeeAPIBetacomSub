-- Create shop_info_cache table for caching shop information from Shopee API
CREATE TABLE IF NOT EXISTS shop_info_cache (
  shop_id BIGINT PRIMARY KEY,
  shop_name TEXT,
  region TEXT,
  status TEXT,
  is_cb BOOLEAN DEFAULT FALSE,
  is_sip BOOLEAN DEFAULT FALSE,
  is_upgraded_cbsc BOOLEAN DEFAULT FALSE,
  merchant_id BIGINT,
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
  shop_logo TEXT,
  description TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shop_info_cache_cached_at ON shop_info_cache(cached_at);

-- Enable RLS
ALTER TABLE shop_info_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read cache for shops they have access to
CREATE POLICY "Users can read shop cache" ON shop_info_cache
  FOR SELECT USING (
    shop_id IN (
      SELECT sm.shop_id FROM shop_members sm WHERE sm.user_id = auth.uid()
    )
  );

-- Policy: Service role can do everything
CREATE POLICY "Service role full access to shop cache" ON shop_info_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Comment
COMMENT ON TABLE shop_info_cache IS 'Cache for shop information from Shopee API';
