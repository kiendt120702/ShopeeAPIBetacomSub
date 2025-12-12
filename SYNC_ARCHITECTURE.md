# Kiến trúc Sync mới - Frontend đọc từ DB

## Tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  • Chỉ đọc/ghi Supabase Database                                │
│  • Realtime subscriptions (instant updates)                     │
│  • Không gọi Shopee API trực tiếp                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Realtime / REST
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                            │
│  • sync_status (tracking last sync time)                        │
│  • shop_performance_data, shop_metrics_data                     │
│  • ads_campaign_data, flash_sale_data                           │
│  • sync_jobs (pending sync jobs)                                │
└─────────────────────┬───────────────────────────────────────────┘
                      │ 
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              EDGE FUNCTIONS (Background Workers)                │
│                                                                 │
│  shopee-sync-worker                                             │
│  ├── sync-shop-performance                                      │
│  ├── sync-ads-campaign-data                                     │
│  └── sync-flash-sale-data                                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SHOPEE API                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Lợi ích

| Aspect | Trước (V1) | Sau (V2) |
|--------|------------|----------|
| Tốc độ load | 1-3s (chờ API) | <100ms (từ DB) |
| Rate limit | Dễ bị limit | Không bao giờ |
| Realtime | Không | Có (Supabase Realtime) |
| Multi-user | Mỗi user gọi API | Share data từ DB |
| Offline | Không | Có thể cache |

## Files mới

### Database Migration
- `supabase/migrations/008_sync_architecture.sql` - Tạo các tables mới

### Hooks
- `src/hooks/useSyncData.ts` - Hook quản lý sync và realtime data

### Components V2
- `src/components/panels/ShopPerformancePanelV2.tsx`
- `src/components/panels/AdsPanelV2.tsx`
- `src/components/panels/FlashSalePanelV2.tsx`

## Cách sử dụng

### 1. Chạy migration

```bash
# Local development
supabase db reset

# Hoặc apply migration
supabase migration up
```

### 2. Deploy Edge Functions

```bash
supabase functions deploy shopee-sync-worker
```

### 3. Sử dụng V2 Components

Thay thế import trong App.tsx hoặc các pages:

```tsx
// Trước
import ShopPerformancePanel from '@/components/panels/ShopPerformancePanel';
import AdsPanel from '@/components/panels/AdsPanel';
import FlashSalePanel from '@/components/panels/FlashSalePanel';

// Sau
import ShopPerformancePanelV2 from '@/components/panels/ShopPerformancePanelV2';
import AdsPanelV2 from '@/components/panels/AdsPanelV2';
import FlashSalePanelV2 from '@/components/panels/FlashSalePanelV2';
```

## Hooks API

### useSyncData

```tsx
const { 
  syncStatus,    // Trạng thái sync hiện tại
  isSyncing,     // Đang sync hay không
  lastError,     // Lỗi gần nhất
  triggerSync,   // Function trigger sync thủ công
  isDataStale,   // Check data có cũ không
} = useSyncData({
  shopId: 123456,
  userId: 'user-uuid',
  autoSyncOnMount: true,      // Auto sync khi mount
  syncType: 'campaigns',      // 'campaigns' | 'flash_sales' | 'shop_performance' | 'all'
  staleMinutes: 5,            // Data cũ hơn X phút sẽ auto sync
});
```

### useRealtimeData

```tsx
const { 
  data,      // Array data từ DB
  loading,   // Đang load hay không
  error,     // Lỗi nếu có
  refetch,   // Function refetch thủ công
} = useRealtimeData<Campaign>(
  'ads_campaign_data',  // Table name
  shopId,
  userId,
  { 
    orderBy: 'synced_at',
    orderAsc: false,
    filter: { status: 'ongoing' }
  }
);
```

## Sync Flow

1. User vào trang → Hook check `sync_status` table
2. Nếu data cũ (> staleMinutes) → Trigger background sync
3. Sync worker gọi Shopee API → Lưu vào DB
4. Realtime subscription nhận update → UI tự động refresh
5. User thấy data mới ngay lập tức

## Rate Limit Protection

- Frontend KHÔNG gọi Shopee API trực tiếp
- Sync worker có thể implement queue/delay
- Nhiều user cùng shop → Share data từ DB
- Sync interval có thể config (mặc định 5 phút)

## TODO

- [ ] Implement Cron job để auto sync định kỳ
- [ ] Add retry logic cho failed syncs
- [ ] Implement priority queue (active shops sync trước)
- [ ] Add webhook support cho real-time order updates
