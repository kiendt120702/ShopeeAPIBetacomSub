-- =====================================================
-- MANUAL MIGRATION - Chạy trong Supabase SQL Editor
-- =====================================================
-- Gộp tất cả các migration cần thiết
-- Chạy từng phần một nếu gặp lỗi

-- =====================================================
-- PART 1: Create tables nếu chưa có
-- =====================================================

-- Shop performance data table
CREATE TABLE IF NOT EXISTS shop_performance_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  rating INTEGER,
  fulfillment_failed INTEGER DEFAULT 0,
  listing_failed INTEGER DEFAULT 0,
  custom_service_failed INTEGER DEFAULT 0,
  raw_response JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shop metrics data table
CREATE TABLE IF NOT EXISTS shop_metrics_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  metric_id INTEGER NOT NULL,
  metric_name TEXT NOT NULL,
  metric_type INTEGER NOT NULL,
  parent_metric_id INTEGER DEFAULT 0,
  current_period DECIMAL,
  last_period DECIMAL,
  unit INTEGER,
  target_value DECIMAL,
  target_comparator TEXT,
  is_passing BOOLEAN,
  exemption_end_date TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync jobs tracking table
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  job_type TEXT NOT NULL DEFAULT 'shop_performance',
  status TEXT NOT NULL DEFAULT 'pending',
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  job_data JSONB DEFAULT '{}'
);

-- Flash Sale data table
CREATE TABLE IF NOT EXISTS flash_sale_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  flash_sale_id BIGINT NOT NULL,
  timeslot_id BIGINT NOT NULL,
  status INTEGER NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  enabled_item_count INTEGER DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  type INTEGER NOT NULL,
  remindme_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  raw_response JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ads/Campaign data table
CREATE TABLE IF NOT EXISTS ads_campaign_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  campaign_id BIGINT NOT NULL,
  ad_type TEXT NOT NULL,
  name TEXT,
  status TEXT,
  campaign_placement TEXT,
  bidding_method TEXT,
  campaign_budget DECIMAL DEFAULT 0,
  start_time BIGINT DEFAULT 0,
  end_time BIGINT DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  roas_target DECIMAL,
  raw_response JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 2: Add UNIQUE constraints
-- =====================================================

-- user_shops unique constraint
DO $$ 
BEGIN
  -- Xóa duplicates nếu có
  DELETE FROM user_shops a USING user_shops b
  WHERE a.id < b.id AND a.user_id = b.user_id AND a.shop_id = b.shop_id;
  
  -- Thêm constraint nếu chưa có
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_shops_user_id_shop_id_key') THEN
    ALTER TABLE user_shops ADD CONSTRAINT user_shops_user_id_shop_id_key UNIQUE (user_id, shop_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'user_shops constraint error: %', SQLERRM;
END $$;

-- shop_performance_data unique constraint
DO $$ 
BEGIN
  DELETE FROM shop_performance_data a USING shop_performance_data b
  WHERE a.id < b.id AND a.shop_id = b.shop_id AND a.user_id = b.user_id;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_performance_data_shop_user_key') THEN
    ALTER TABLE shop_performance_data ADD CONSTRAINT shop_performance_data_shop_user_key UNIQUE (shop_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'shop_performance_data constraint error: %', SQLERRM;
END $$;

-- shop_metrics_data unique constraint
DO $$ 
BEGIN
  DELETE FROM shop_metrics_data a USING shop_metrics_data b
  WHERE a.id < b.id AND a.shop_id = b.shop_id AND a.metric_id = b.metric_id AND a.user_id = b.user_id;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_metrics_data_shop_metric_user_key') THEN
    ALTER TABLE shop_metrics_data ADD CONSTRAINT shop_metrics_data_shop_metric_user_key UNIQUE (shop_id, metric_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'shop_metrics_data constraint error: %', SQLERRM;
END $$;

-- ads_campaign_data unique constraint
DO $$ 
BEGIN
  DELETE FROM ads_campaign_data a USING ads_campaign_data b
  WHERE a.id < b.id AND a.shop_id = b.shop_id AND a.campaign_id = b.campaign_id AND a.user_id = b.user_id;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ads_campaign_data_shop_campaign_user_key') THEN
    ALTER TABLE ads_campaign_data ADD CONSTRAINT ads_campaign_data_shop_campaign_user_key UNIQUE (shop_id, campaign_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ads_campaign_data constraint error: %', SQLERRM;
END $$;

-- flash_sale_data unique constraint
DO $$ 
BEGIN
  DELETE FROM flash_sale_data a USING flash_sale_data b
  WHERE a.id < b.id AND a.shop_id = b.shop_id AND a.flash_sale_id = b.flash_sale_id AND a.user_id = b.user_id;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flash_sale_data_shop_flashsale_user_key') THEN
    ALTER TABLE flash_sale_data ADD CONSTRAINT flash_sale_data_shop_flashsale_user_key UNIQUE (shop_id, flash_sale_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'flash_sale_data constraint error: %', SQLERRM;
END $$;

-- =====================================================
-- PART 3: Create indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_shops_shop_id ON user_shops(shop_id);
CREATE INDEX IF NOT EXISTS idx_user_shops_user_shop ON user_shops(user_id, shop_id);

CREATE INDEX IF NOT EXISTS idx_shop_performance_shop_user ON shop_performance_data(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_shop_performance_synced ON shop_performance_data(synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_metrics_shop_user ON shop_metrics_data(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_shop_metrics_synced ON shop_metrics_data(synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_ads_campaign_shop_user ON ads_campaign_data(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ads_campaign_synced ON ads_campaign_data(synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_flash_sale_shop_user ON flash_sale_data(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_synced ON flash_sale_data(synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_next_run ON sync_jobs(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_shop_type ON sync_jobs(shop_id, job_type);

-- =====================================================
-- PART 4: Enable RLS and create policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE shop_performance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_metrics_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads_campaign_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sale_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (ignore errors if not exist)
DROP POLICY IF EXISTS "Users can view own performance data" ON shop_performance_data;
DROP POLICY IF EXISTS "Service role full access performance" ON shop_performance_data;
DROP POLICY IF EXISTS "Users can view own metrics data" ON shop_metrics_data;
DROP POLICY IF EXISTS "Service role full access metrics" ON shop_metrics_data;
DROP POLICY IF EXISTS "Users can view own campaign data" ON ads_campaign_data;
DROP POLICY IF EXISTS "Service role full access campaigns" ON ads_campaign_data;
DROP POLICY IF EXISTS "Users can view own flash sale data" ON flash_sale_data;
DROP POLICY IF EXISTS "Service role full access flash sales" ON flash_sale_data;
DROP POLICY IF EXISTS "Users can view own sync jobs" ON sync_jobs;
DROP POLICY IF EXISTS "Service role full access sync jobs" ON sync_jobs;
DROP POLICY IF EXISTS "Service role full access user_shops" ON user_shops;

-- Create new policies
CREATE POLICY "Users can view own performance data" ON shop_performance_data
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access performance" ON shop_performance_data
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own metrics data" ON shop_metrics_data
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access metrics" ON shop_metrics_data
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own campaign data" ON ads_campaign_data
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access campaigns" ON ads_campaign_data
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own flash sale data" ON flash_sale_data
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access flash sales" ON flash_sale_data
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own sync jobs" ON sync_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access sync jobs" ON sync_jobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access user_shops" ON user_shops
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- DONE! Check results
-- =====================================================
SELECT 'Migration completed successfully!' as status;
