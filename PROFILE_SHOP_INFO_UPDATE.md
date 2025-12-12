# Cập nhật hiển thị thông tin Shop trong Profile

## Tóm tắt thay đổi

### 1. Xóa trang Shop Info riêng biệt
- ✅ Xóa file `src/components/panels/ShopInfoPanel.tsx`
- ✅ Xóa route `/shop-info` khỏi `App.tsx`
- ✅ Xóa menu item "Thông tin Shop" khỏi sidebar trong `Index.tsx`
- ✅ Cập nhật Dashboard để không hiển thị feature "Thông tin Shop"

### 2. Tích hợp thông tin Shop vào Profile
Trang `/profile` giờ hiển thị đầy đủ thông tin shop đã kết nối:
- **Logo shop** (từ bảng `shops.shop_logo`)
- **Tên shop** (từ bảng `shops.shop_name`)
- **ID shop** (từ bảng `user_shops.shop_id`)
- **Region** (từ bảng `shops.region`)
- **Trạng thái hoạt động** (kiểm tra `shops.expired_at`)

### 3. Database Schema (theo migration 011)

#### Bảng chính:
- **`shops`**: Lưu tất cả thông tin shop bao gồm:
  - Token: `access_token`, `refresh_token`, `expired_at`, `expire_in`, `merchant_id`
  - Info: `shop_name`, `shop_logo`, `region`, `status`
- **`user_shops`**: Bảng liên kết user và shop (`user_id`, `shop_id`, `is_active`, `role`)

> **Lưu ý**: Bảng `shopee_tokens` đã bị xóa trong migration 011. Token giờ được lưu trong bảng `shops`.

### 4. Cập nhật Code

#### `src/hooks/useAuth.ts`
- ✅ `saveUserShop()`: Lưu token vào bảng `shops` và liên kết vào `user_shops`
- ✅ `getUserShops()`: Query từ `user_shops`

#### `src/hooks/useShopeeAuth.ts`
- ✅ `loadTokenFromSource()`: Lấy token từ bảng `shops` (không phải `shopee_tokens`)

#### `src/components/panels/UserProfilePanel.tsx`
- ✅ Fetch thông tin shop từ bảng `shops`
- ✅ Fetch `expired_at` từ bảng `shops` để kiểm tra token expiry
- ✅ Tự động gọi API Shopee nếu shop chưa có thông tin
- ✅ Hiển thị logo, tên, ID, region của shop

## Cách sử dụng

1. **Đảm bảo migration 011 đã chạy** (gộp shopee_tokens + shop_info_cache → shops)

2. **Kiểm tra trang Profile:**
   - Đăng nhập vào ứng dụng
   - Kết nối shop Shopee
   - Vào trang `/profile`
   - Xem phần "Shop đã kết nối" hiển thị đầy đủ thông tin

## Lợi ích

1. **Giao diện đơn giản hơn**: Không cần trang riêng cho Shop Info
2. **Thông tin tập trung**: Tất cả thông tin user và shop ở một nơi
3. **Schema đơn giản**: 1 bảng `shops` chứa cả token và info
4. **Tự động sync**: Tự động fetch thông tin shop từ API nếu chưa có
