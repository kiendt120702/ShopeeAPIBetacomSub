-- Enable pg_cron extension (cần enable trong Supabase Dashboard trước)
-- Vào Database > Extensions > Tìm "pg_cron" > Enable

-- Tạo function để gọi Edge Function shopee-scheduler với action process
CREATE OR REPLACE FUNCTION process_scheduled_flash_sales()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  -- Lấy config từ vault hoặc hardcode (cần thay đổi)
  -- Trong thực tế, bạn cần setup Supabase Vault để lưu secrets
  
  -- Cập nhật các lịch pending đã đến giờ thành 'ready'
  -- Edge Function sẽ được gọi từ client hoặc external cron
  UPDATE scheduled_flash_sales 
  SET status = 'ready'
  WHERE status = 'pending' 
    AND scheduled_at <= NOW();
    
  RAISE NOTICE 'Marked ready schedules for processing';
END;
$$;

-- Tạo cron job chạy mỗi phút (cần pg_cron extension)
-- Uncomment sau khi enable pg_cron extension
-- SELECT cron.schedule(
--   'process-flash-sale-schedules',
--   '* * * * *',  -- Mỗi phút
--   $$SELECT process_scheduled_flash_sales()$$
-- );

-- Alternative: Tạo trigger để tự động xử lý khi có lịch ready
-- Hoặc sử dụng Supabase Realtime để client tự poll

COMMENT ON FUNCTION process_scheduled_flash_sales IS 
'Function để đánh dấu các lịch hẹn giờ Flash Sale đã đến hạn. 
Cần setup cron job hoặc external service để gọi định kỳ.';
