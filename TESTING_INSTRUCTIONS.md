# Testing Instructions - Database-First Architecture

## 🚨 Vấn đề hiện tại:

**Token không được lưu vào database** khi user login Shopee, dẫn đến sync worker không thể lấy token để gọi Shopee API.

## 🔍 Root Cause:

1. ✅ User đã đăng nhập Supabase (user ID: `cc316c20-7306-478e-8305-9d897c12b563`)
2. ✅ Token được lưu trong localStorage 
3. ❌ Token KHÔNG được lưu vào database (bảng `user_shops` trống)
4. ❌ Sync worker không tìm thấy token → "Shopee API error: undefined"

## 🛠️ Cách khắc phục:

### Option 1: Login lại Shopee (Khuyến nghị)

1. **Vào tab "Cài đặt"**
2. **Click "Đăng xuất"** (nếu đã login Shopee)
3. **Click "Đăng nhập với Shopee"** lại
4. **Xem console logs** để kiểm tra:

```javascript
[AUTH] Current user for saving: cc316c20-7306-478e-8305-9d897c12b563
[AUTH] Saving shop to database: {
  userId: "cc316c20-7306-478e-8305-9d897c12b563",
  shopId: 594424281,
  hasAccessToken: true,
  hasRefreshToken: true
}
[AUTH] Shop saved to database successfully
```

### Option 2: Manual Database Insert (Temporary)

Nếu Option 1 không work, có thể insert token thủ công vào database qua Supabase Dashboard:

```sql
INSERT INTO user_shops (
  user_id,
  shop_id, 
  access_token,
  refresh_token,
  token_expired_at,
  is_active
) VALUES (
  'cc316c20-7306-478e-8305-9d897c12b563',
  594424281,
  'YOUR_REAL_ACCESS_TOKEN',
  'YOUR_REAL_REFRESH_TOKEN', 
  NOW() + INTERVAL '4 hours',
  true
);
```

## 🧪 Test Steps sau khi có token:

### 1. Kiểm tra token trong database:
```bash
node check-database.js
```

Kết quả mong đợi:
```
📊 user_shops table: [
  {
    user_id: "cc316c20-7306-478e-8305-9d897c12b563",
    shop_id: 594424281,
    access_token: "...",
    refresh_token: "...",
    ...
  }
]
```

### 2. Test Sync Worker:
```bash
node test-edge-functions.js
```

Kết quả mong đợi:
```
✅ shopee-sync-worker - Success: { success: true, flash_sale_count: X }
✅ shopee-sync-worker - Success: { success: true, campaign_count: Y }
```

### 3. Test UI Panels:

1. **Flash Sale Panel**: 
   - Click "Tải danh sách"
   - Lần đầu: Sync từ Shopee → Lưu database
   - Lần sau: Đọc từ database (nhanh)

2. **Ads Panel**:
   - Click "Tải danh sách" 
   - Lần đầu: Sync từ Shopee → Lưu database
   - Lần sau: Đọc từ database (nhanh)

## 🎯 Expected Behavior:

### Database-First Flow:
```
UI Panel → Shopee API (Edge Function) → Database
    ↑                                      ↓
    └── Background Sync Worker ←───────────┘
```

### Performance:
- **Lần đầu**: ~2-3s (sync từ Shopee)
- **Lần sau**: ~200-500ms (đọc từ database)
- **Auto refresh**: Khi dữ liệu cũ > 1 giờ

## 🔧 Debug Commands:

```bash
# Kiểm tra database
node check-database.js

# Test Edge Functions  
node test-edge-functions.js

# Xem logs trong Supabase Dashboard
# https://supabase.com/dashboard/project/omgvvnqwroypavmpwbup/logs
```

---

**Next Step**: Login lại Shopee để trigger save token vào database!