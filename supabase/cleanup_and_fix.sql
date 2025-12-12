-- =====================================================
-- CLEANUP & FIX DATABASE
-- Chạy trong Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: Tạo flash_sales_cache (đang thiếu trong schema)
-- =====================================================

CREATE TABLE IF NOT EXISTS flash_sales_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  flash_sale_id BIGINT NOT NULL,
  timeslot_id BIGINT NOT NULL,
  status INTEGER NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  enabled_item_count INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  type INTEGER NOT NULL,
  remindme_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  raw_data JSONB,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, flash_sale_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_sales_cache_shop_id ON flash_sales_cache(shop_id);

ALTER TABLE flash_sales_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on flash_sales_cache" ON flash_sales_cache;
CREATE POLICY "Allow all on flash_sales_cache" ON flash_sales_cache FOR ALL USING (true);

-- =====================================================
-- PART 2: Thêm UNIQUE constraints cho các tables
-- =====================================================

-- user_shops
DO $$ 
BEGIN
  DELETE FROM user_shops a USING user_shops b
  WHERE a.id < b.id AND a.user_id = b.user_id AND a.shop_id = b.shop_id;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_shops_user_id_shop_id_key') THEN
    ALTER TABLE user_shops ADD CONSTRAINT user_shops_user_id_shop_id_key UNIQUE (user_id, shop_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'user_shops: %', SQLERRM;
END $$;

-- shop_performance_data
DO $$ 
BEGIN
  DELETE FROM shop_performance_data a USING shop_performance_data b
  WHERE a.id < b.id AND a.shop_id = b.shop_id AND a.user_id = b.user_id;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_performance_data_shop_user_key') THEN
    ALTER TABLE shop_performance_data ADD CONSTRAINT shop_performance_data_shop_user_key UNIQUE (shop_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'shop_performance_data: %', SQLERRM;
END $$;

-- shop_metrics_data
DO $$ 
BEGIN
  DELETE FROM shop_metrics_data a USING shop_metrics_data b
  WHERE a.id < b.id AND a.shop_id = b.shop_id AND a.metric_id = b.metric_id AND a.user_id = b.user_id;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_metrics_data_shop_metric_user_key') THEN
    ALTER TABLE shop_metrics_data ADD CONSTRAINT shop_metrics_data_shop_metric_user_key UNIQUE (shop_id, metric_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'shop_metrics_data: %', SQLERRM;
END $$;

-- ads_campaign_data
DO $$ 
BEGIN
  DELETE FROM ads_campaign_data a USING ads_campaign_data b
  WHERE a.id < b.id AND a.shop_id = b.shop_id AND a.campaign_id = b.campaign_id AND a.user_id = b.user_id;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ads_campaign_data_shop_campaign_user_key') THEN
    ALTER TABLE ads_campaign_data ADD CONSTRAINT ads_campaign_data_shop_campaign_user_key UNIQUE (shop_id, campaign_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ads_campaign_data: %', SQLERRM;
END $$;

-- flash_sale_data
DO $$ 
BEGIN
  DELETE FROM flash_sale_data a USING flash_sale_data b
  WHERE a.id < b.id AND a.shop_id = b.shop_id AND a.flash_sale_id = b.flash_sale_id AND a.user_id = b.user_id;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flash_sale_data_shop_flashsale_user_key') THEN
    ALTER TABLE flash_sale_data ADD CONSTRAINT flash_sale_data_shop_flashsale_user_key UNIQUE (shop_id, flash_sale_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'flash_sale_data: %', SQLERRM;
END $$;

-- campaigns_cache
DO $$ 
BEGIN
  DELETE FROM campaigns_cache a USING campaigns_cache b
  WHERE a.id < b.id AND a.shop_id = b.shop_id AND a.campaign_id = b.campaign_id;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_cache_shop_campaign_key') THEN
    ALTER TABLE campaigns_cache ADD CONSTRAINT campaigns_cache_shop_campaign_key UNIQUE (shop_id, campaign_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'campaigns_cache: %', SQLERRM;
END $$;

-- =====================================================
-- PART 3: Thêm indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_shops_shop_id ON user_shops(shop_id);
CREATE INDEX IF NOT EXISTS idx_user_shops_user_shop ON user_shops(user_id, shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_performance_shop_user ON shop_performance_data(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_shop_metrics_shop_user ON shop_metrics_data(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ads_campaign_shop_user ON ads_campaign_data(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_shop_user ON flash_sale_data(shop_id, user_id);

-- =====================================================
-- PART 4: Fix RLS policies cho service role
-- =====================================================

-- shop_performance_data
ALTER TABLE shop_performance_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access performance" ON shop_performance_data;
CREATE POLICY "Service role full access performance" ON shop_performance_data
  FOR ALL USING (auth.role() = 'service_role');

-- shop_metrics_data  
ALTER TABLE shop_metrics_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access metrics" ON shop_metrics_data;
CREATE POLICY "Service role full access metrics" ON shop_metrics_data
  FOR ALL USING (auth.role() = 'service_role');

-- ads_campaign_data
ALTER TABLE ads_campaign_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access campaigns" ON ads_campaign_data;
CREATE POLICY "Service role full access campaigns" ON ads_campaign_data
  FOR ALL USING (auth.role() = 'service_role');

-- flash_sale_data
ALTER TABLE flash_sale_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access flash_sale" ON flash_sale_data;
CREATE POLICY "Service role full access flash_sale" ON flash_sale_data
  FOR ALL USING (auth.role() = 'service_role');

-- user_shops
DROP POLICY IF EXISTS "Service role full access user_shops" ON user_shops;
CREATE POLICY "Service role full access user_shops" ON user_shops
  FOR ALL USING (auth.role() = 'service_role');

-- sync_jobs
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access sync_jobs" ON sync_jobs;
CREATE POLICY "Service role full access sync_jobs" ON sync_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- DONE
-- =====================================================
SELECT 'Cleanup completed!' as status;
