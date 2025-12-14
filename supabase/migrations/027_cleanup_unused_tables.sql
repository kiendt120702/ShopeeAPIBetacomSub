-- Migration: Cleanup unused tables
-- Date: 2024-12-14
-- Description: Remove tables that are not being used in the application

-- =====================================================
-- DROP TRIGGERS AND FUNCTIONS FIRST
-- =====================================================

-- Drop token_logs trigger and function (must be done before dropping table)
DROP TRIGGER IF EXISTS trigger_log_token_change ON shops;
DROP FUNCTION IF EXISTS log_token_change();

-- =====================================================
-- DROP UNUSED TABLES
-- =====================================================

-- 1. campaigns_cache - replaced by ads_campaign_data
DROP TABLE IF EXISTS public.campaigns_cache CASCADE;

-- 2. shop_access_assignments - not used in code
DROP TABLE IF EXISTS public.shop_access_assignments CASCADE;

-- 3. shop_metrics_data - not used in code
DROP TABLE IF EXISTS public.shop_metrics_data CASCADE;

-- 4. shop_performance_data - not used in code
DROP TABLE IF EXISTS public.shop_performance_data CASCADE;

-- 5. token_logs - not used in code
DROP TABLE IF EXISTS public.token_logs CASCADE;

-- =====================================================
-- DROP UNUSED RPC FUNCTIONS
-- =====================================================
DROP FUNCTION IF EXISTS get_member_accessible_shops();
DROP FUNCTION IF EXISTS get_admin_dashboard_stats();

-- =====================================================
-- SUMMARY
-- =====================================================
-- Removed:
-- - trigger_log_token_change trigger
-- - log_token_change() function
-- - get_member_accessible_shops() RPC
-- - get_admin_dashboard_stats() RPC
-- - 5 unused tables:
--   - campaigns_cache (replaced by ads_campaign_data)
--   - shop_access_assignments (not implemented)
--   - shop_metrics_data (not implemented)
--   - shop_performance_data (not implemented)
--   - token_logs (not implemented)
