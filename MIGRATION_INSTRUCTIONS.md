# Migration Instructions

## Cần chạy Migration để tạo bảng Flash Sale và Ads

Vì Docker không chạy local, bạn cần chạy migration thủ công:

### Cách 1: Supabase Dashboard (Khuyến nghị)

1. Mở Supabase Dashboard: https://supabase.com/dashboard/project/omgvvnqwroypavmpwbup
2. Vào **SQL Editor**
3. Copy và paste nội dung file `supabase/migrations/20241211_add_flash_sale_ads_tables.sql`
4. Chạy SQL

### Cách 2: Command Line (nếu có connection string đúng)

```bash
cd supabase
npx supabase migration up --db-url "YOUR_CORRECT_DB_URL"
```

## Kiểm tra sau khi chạy Migration

Sau khi chạy migration, kiểm tra các bảng đã được tạo:

```sql
-- Kiểm tra bảng flash_sale_data
SELECT * FROM flash_sale_data LIMIT 1;

-- Kiểm tra bảng ads_campaign_data  
SELECT * FROM ads_campaign_data LIMIT 1;

-- Kiểm tra sync_jobs có column job_data
\d sync_jobs;
```

## Test Database-First Architecture

Sau khi migration xong, test các panels:

1. **Flash Sale Panel**: Vào panel và click "Tải danh sách"
2. **Ads Panel**: Vào panel và click "Tải danh sách"  
3. **Shop Performance Panel**: Đã hoạt động với database

### Expected Behavior:

- Lần đầu: Sẽ báo "Chưa có dữ liệu" và trigger sync từ Shopee API
- Sync thành công: Dữ liệu sẽ được lưu vào database
- Lần sau: Đọc từ database, chỉ sync lại khi dữ liệu cũ (> 1 giờ)

## Troubleshooting

Nếu có lỗi:

1. **"Table does not exist"**: Migration chưa chạy
2. **"RLS policy violation"**: Kiểm tra user authentication
3. **"Edge Function error"**: Kiểm tra logs trong Supabase Dashboard > Functions

## Architecture Summary

✅ **Shop Performance**: Database-first ✅  
🔄 **Flash Sale**: Chuyển sang Database-first (cần migration)  
🔄 **Ads**: Chuyển sang Database-first (cần migration)  

Tất cả panels sẽ sử dụng cùng kiến trúc:
- UI → Shopee API (Edge Function) → Database
- Background sync qua Sync Worker
- Cache thay thế bằng database storage