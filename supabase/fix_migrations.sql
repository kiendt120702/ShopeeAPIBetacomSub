-- Fix script: Drop existing policies before migrations run
-- Run this via: supabase db execute --file supabase/fix_migrations.sql

-- ============================================
-- DROP ALL EXISTING POLICIES
-- ============================================

-- sync_status policies
DROP POLICY IF EXISTS "Users can view own sync status" ON sync_status;
DROP POLICY IF EXISTS "Users can update own sync status" ON sync_status;
DROP POLICY IF EXISTS "Users can insert own sync status" ON sync_status;
DROP POLICY IF EXISTS "Users can delete own sync status" ON sync_status;

-- shop_performance_data policies
DROP POLICY IF EXISTS "Users can view own shop performance" ON shop_performance_data;
DROP POLICY IF EXISTS "Service role can manage shop performance" ON shop_performance_data;

-- shop_metrics_data policies
DROP POLICY IF EXISTS "Users can view own shop metrics" ON shop_metrics_data;
DROP POLICY IF EXISTS "Service role can manage shop metrics" ON shop_metrics_data;

-- ads_campaign_data policies
DROP POLICY IF EXISTS "Users can view own campaigns" ON ads_campaign_data;
DROP POLICY IF EXISTS "Service role can manage campaigns" ON ads_campaign_data;

-- flash_sale_data policies
DROP POLICY IF EXISTS "Users can view own flash sales" ON flash_sale_data;
DROP POLICY IF EXISTS "Service role can manage flash sales" ON flash_sale_data;

-- sync_jobs policies
DROP POLICY IF EXISTS "Users can view own sync jobs" ON sync_jobs;
DROP POLICY IF EXISTS "Users can create sync jobs" ON sync_jobs;
DROP POLICY IF EXISTS "Service role can manage sync jobs" ON sync_jobs;

-- shopee_tokens policies (from migration 010)
DROP POLICY IF EXISTS "Users can view tokens for their shops" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can insert tokens for their shops" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can update tokens for their shops" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can delete tokens for their shops" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can view own tokens" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON shopee_tokens;

-- shops policies (from migration 011)
DROP POLICY IF EXISTS "Users can view their shops" ON shops;
DROP POLICY IF EXISTS "Users can insert their shops" ON shops;
DROP POLICY IF EXISTS "Users can update their shops" ON shops;
DROP POLICY IF EXISTS "Users can delete their shops" ON shops;

SELECT 'All policies dropped successfully' as status;
