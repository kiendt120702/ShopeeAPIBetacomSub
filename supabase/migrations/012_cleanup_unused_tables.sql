-- Migration: Cleanup unused tables after removing shop-performance feature
-- Date: 2025-12-14

-- ============================================
-- 1. XÓA CÁC BẢNG LIÊN QUAN ĐẾN SHOP PERFORMANCE
-- ============================================

-- Drop shop_metrics_data table (không còn dùng)
DROP TABLE IF EXISTS shop_metrics_data CASCADE;

-- Drop shop_performance_data table (không còn dùng)
DROP TABLE IF EXISTS shop_performance_data CASCADE;

-- ============================================
-- 2. XÓA CÁC BẢNG CACHE KHÔNG CÒN DÙNG
-- ============================================

-- Drop campaigns_cache (đã dùng ads_campaign_data thay thế)
DROP TABLE IF EXISTS campaigns_cache CASCADE;

-- Drop flash_sales_cache nếu còn tồn tại
DROP TABLE IF EXISTS flash_sales_cache CASCADE;

-- ============================================
-- 3. CẬP NHẬT BẢNG sync_status - XÓA CỘT KHÔNG DÙNG
-- ============================================

-- Xóa cột shop_performance_synced_at vì không còn sync shop performance
ALTER TABLE sync_status DROP COLUMN IF EXISTS shop_performance_synced_at;

-- ============================================
-- 4. XÓA CÁC FUNCTIONS LIÊN QUAN
-- ============================================

-- Drop functions liên quan đến shop performance
DROP FUNCTION IF EXISTS get_shop_performance_history CASCADE;
DROP FUNCTION IF EXISTS get_metric_trends CASCADE;

-- ============================================
-- 5. CLEANUP REALTIME PUBLICATION
-- ============================================

-- Remove tables from realtime publication (ignore errors if table not in publication)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE shop_metrics_data;
EXCEPTION 
  WHEN undefined_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE shop_performance_data;
EXCEPTION 
  WHEN undefined_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- ============================================
-- SUMMARY: Các bảng còn lại đang được sử dụng
-- ============================================
-- 1. shops - Thông tin shop và tokens
-- 2. user_shops - Liên kết user với shop
-- 3. profiles - Thông tin user
-- 4. partners - Thông tin partner
-- 5. ads_campaign_data - Dữ liệu chiến dịch quảng cáo
-- 6. flash_sale_data - Dữ liệu flash sale
-- 7. scheduled_ads_budget - Lịch hẹn ngân sách quảng cáo
-- 8. scheduled_flash_sales - Lịch hẹn flash sale
-- 9. ads_budget_logs - Log thay đổi ngân sách
-- 10. sync_status - Trạng thái sync
-- 11. sync_jobs - Queue sync jobs
-- 12. shop_info_cache - Cache thông tin shop
-- 13. shopee_tokens - Tokens (có thể đã migrate sang shops)
