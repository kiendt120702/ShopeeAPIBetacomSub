import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Types
interface ProductItem {
  item_id: number;
  item_status: string;
  update_time: number;
}

interface ProductBaseInfo {
  item_id: number;
  item_name: string;
  item_status: string;
  item_sku: string;
  description: string;
  category_id: number;
  create_time: number;
  update_time: number;
  condition: string;
  image: {
    image_url_list: string[];
    image_id_list: string[];
  };
  price_info: Array<{
    current_price: number;
    original_price: number;
    currency: string;
  }>;
  stock_info_v2: {
    summary_info: {
      total_reserved_stock: number;
      total_available_stock: number;
    };
    seller_stock?: Array<{ location_id: string; stock: number }>;
  };
  weight: string;
  dimension?: {
    package_length: number;
    package_width: number;
    package_height: number;
  };
  has_model: boolean;
  deboost: boolean | string;
  brand?: { brand_id: number; original_brand_name: string };
  logistic_info?: Array<{
    logistic_id: number;
    logistic_name: string;
    enabled: boolean;
    shipping_fee: number;
    is_free: boolean;
  }>;
  pre_order?: {
    is_pre_order: boolean;
    days_to_ship: number;
  };
  wholesales?: Array<{
    min_count: number;
    max_count: number;
    unit_price: number;
  }>;
  video_info?: Array<{
    video_url: string;
    thumbnail_url: string;
    duration: number;
  }>;
  attribute_list?: Array<{
    attribute_id: number;
    original_attribute_name: string;
    attribute_value_list: Array<{
      value_id: number;
      original_value_name: string;
    }>;
  }>;
  item_dangerous?: number;
  size_chart?: string;
  promotion_id?: number;
  // Extra info (merged)
  sale?: number;
  views?: number;
  likes?: number;
  rating_star?: number;
  comment_count?: number;
}

interface ProductExtraInfo {
  item_id: number;
  sale: number;
  views: number;
  likes: number;
  rating_star: number;
  comment_count: number;
}

interface GetItemListResponse {
  error: string;
  message: string;
  response?: {
    item: ProductItem[];
    total_count: number;
    has_next_page: boolean;
    next_offset: number;
  };
}

interface GetItemBaseInfoResponse {
  error: string;
  message: string;
  response?: {
    item_list: ProductBaseInfo[];
  };
}

interface GetItemExtraInfoResponse {
  error: string;
  message: string;
  response?: {
    item_list: ProductExtraInfo[];
  };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  NORMAL: { label: 'Đang bán', color: 'bg-green-100 text-green-700' },
  BANNED: { label: 'Vi phạm', color: 'bg-red-100 text-red-700' },
  UNLIST: { label: 'Đã ẩn', color: 'bg-gray-100 text-gray-600' },
  REVIEWING: { label: 'Đang duyệt', color: 'bg-yellow-100 text-yellow-700' },
  SELLER_DELETE: { label: 'Đã xóa', color: 'bg-red-100 text-red-700' },
  SHOPEE_DELETE: { label: 'Shopee xóa', color: 'bg-red-100 text-red-700' },
};

const STATUS_OPTIONS = ['NORMAL', 'BANNED', 'UNLIST', 'REVIEWING', 'SELLER_DELETE', 'SHOPEE_DELETE'];


export default function ProductPanel() {
  const { toast } = useToast();
  const { token, isAuthenticated } = useShopeeAuth();
  
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [products, setProducts] = useState<ProductBaseInfo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string[]>(['NORMAL']);
  const [selectedProduct, setSelectedProduct] = useState<ProductBaseInfo | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const pageSize = 20;

  const formatPrice = (price: number, currency = 'VND') => {
    if (currency === 'VND') return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
    return new Intl.NumberFormat('vi-VN').format(price) + ' ' + currency;
  };

  const formatDate = (timestamp: number | string) => {
    const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
    return date.toLocaleString('vi-VN');
  };

  // Load từ database (cache)
  const loadFromCache = async () => {
    if (!token?.shop_id) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('apishopee_products')
        .select('*', { count: 'exact' })
        .eq('shop_id', token.shop_id)
        .in('item_status', statusFilter)
        .order('update_time', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // Transform DB data to UI format
        const items = data.map(transformDbToUi);
        setProducts(items);
        setTotalCount(count || items.length);
        setLastSyncedAt(data[0]?.synced_at);
      } else {
        setProducts([]);
        setTotalCount(0);
      }
    } catch (e) {
      console.error('Load cache error:', e);
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Transform database row to UI format
  const transformDbToUi = (row: Record<string, unknown>): ProductBaseInfo => ({
    item_id: row.item_id as number,
    item_name: row.item_name as string,
    item_status: row.item_status as string,
    item_sku: row.item_sku as string || '',
    description: row.description as string || '',
    category_id: row.category_id as number,
    create_time: row.create_time ? Math.floor(new Date(row.create_time as string).getTime() / 1000) : 0,
    update_time: row.update_time ? Math.floor(new Date(row.update_time as string).getTime() / 1000) : 0,
    condition: row.condition as string || 'NEW',
    image: {
      image_url_list: (row.image_urls as string[]) || [row.image_url as string].filter(Boolean),
      image_id_list: [],
    },
    price_info: row.current_price ? [{
      current_price: row.current_price as number,
      original_price: row.original_price as number,
      currency: row.currency as string || 'VND',
    }] : [],
    stock_info_v2: {
      summary_info: {
        total_available_stock: row.total_available_stock as number || 0,
        total_reserved_stock: row.total_reserved_stock as number || 0,
      },
    },
    weight: row.weight?.toString() || '',
    dimension: row.package_length ? {
      package_length: row.package_length as number,
      package_width: row.package_width as number,
      package_height: row.package_height as number,
    } : undefined,
    has_model: row.has_model as boolean || false,
    deboost: row.deboost as boolean || false,
    brand: row.brand_id ? {
      brand_id: row.brand_id as number,
      original_brand_name: row.brand_name as string || '',
    } : undefined,
    pre_order: row.is_pre_order ? {
      is_pre_order: true,
      days_to_ship: row.days_to_ship as number || 0,
    } : undefined,
    video_info: row.has_video ? [{ video_url: '', thumbnail_url: '', duration: 0 }] : undefined,
    sale: row.sale as number || 0,
    views: row.views as number || 0,
    likes: row.likes as number || 0,
    rating_star: row.rating_star as number || 0,
    comment_count: row.comment_count as number || 0,
  });

  // Sync từ API và lưu vào database
  const syncProducts = async () => {
    if (!token?.shop_id) return;
    
    setSyncing(true);
    let syncedTotal = 0;
    let currentOffset = 0;
    
    try {
      // Sync tất cả pages
      while (true) {
        const { data, error } = await supabase.functions.invoke('shopee-product', {
          body: {
            action: 'sync-products',
            shop_id: token.shop_id,
            offset: currentOffset,
            page_size: 50,
            item_status: statusFilter,
          },
        });

        if (error) throw new Error(error.message);
        if (data.error) throw new Error(data.message || data.error);

        syncedTotal += data.synced || 0;
        
        if (!data.has_next_page) break;
        currentOffset = data.next_offset;
        
        // Tránh rate limit
        await new Promise(r => setTimeout(r, 500));
      }

      toast({ title: 'Đồng bộ thành công', description: `Đã đồng bộ ${syncedTotal} sản phẩm` });
      
      // Reload từ cache
      await loadFromCache();
    } catch (e) {
      toast({ title: 'Lỗi đồng bộ', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const toggleStatus = (status: string) => {
    setStatusFilter(prev => {
      if (prev.includes(status)) {
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== status);
      }
      return [...prev, status];
    });
  };

  // Load từ cache khi mount hoặc đổi filter
  useEffect(() => {
    if (isAuthenticated && token?.shop_id) {
      loadFromCache();
    }
  }, [isAuthenticated, token?.shop_id, statusFilter]);


  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Sản phẩm</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {totalCount > 0 && <span>{totalCount} sản phẩm</span>}
              {lastSyncedAt && (
                <span className="text-xs">• Đồng bộ: {new Date(lastSyncedAt).toLocaleString('vi-VN')}</span>
              )}
            </div>
          </div>
          <Button 
            onClick={syncProducts} 
            disabled={syncing || !isAuthenticated}
            variant={products.length > 0 ? "outline" : "default"}
          >
            {syncing ? 'Đang đồng bộ...' : products.length > 0 ? 'Đồng bộ lại' : 'Đồng bộ sản phẩm'}
          </Button>
        </div>

        {/* Status Filter */}
        <div className="px-4 py-2 border-t flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Trạng thái:</span>
          {STATUS_OPTIONS.map(status => {
            const isActive = statusFilter.includes(status);
            const { label, color } = STATUS_MAP[status];
            return (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  isActive ? color : "bg-gray-100 text-gray-400"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!isAuthenticated ? (
          <div className="text-center py-12 text-gray-400">
            <p className="font-medium">Chưa đăng nhập</p>
            <p className="text-sm mt-1">Vui lòng kết nối shop Shopee</p>
          </div>
        ) : loading && products.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Đang tải sản phẩm...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="font-medium">Chưa có sản phẩm</p>
            <p className="text-sm mt-1">Nhấn "Đồng bộ sản phẩm" để tải từ Shopee</p>
          </div>
        ) : (
          <>
            {/* Product Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map(item => (
                <div 
                  key={item.item_id} 
                  className="bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedProduct(item)}
                >
                  {/* Image */}
                  <div className="aspect-square bg-gray-100 relative">
                    {item.image?.image_url_list?.[0] ? (
                      <img 
                        src={item.image.image_url_list[0]} 
                        alt={item.item_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      <span className={cn("text-xs px-2 py-0.5 rounded", STATUS_MAP[item.item_status]?.color || 'bg-gray-100')}>
                        {STATUS_MAP[item.item_status]?.label || item.item_status}
                      </span>
                      {(item.deboost === true || item.deboost === 'true') && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Bị hạ rank</span>
                      )}
                    </div>
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {item.has_model && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Có biến thể</span>
                      )}
                      {item.pre_order?.is_pre_order && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">Pre-order</span>
                      )}
                    </div>
                    {/* Video indicator */}
                    {item.video_info && item.video_info.length > 0 && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                        Video
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 mb-2 min-h-[40px]" title={item.item_name}>
                      {item.item_name}
                    </h3>
                    
                    {/* Price */}
                    <div className="flex items-center gap-2 mb-2">
                      {item.price_info?.[0] ? (
                        <>
                          <span className="text-orange-600 font-semibold">
                            {formatPrice(item.price_info[0].current_price, item.price_info[0].currency)}
                          </span>
                          {item.price_info[0].original_price > item.price_info[0].current_price && (
                            <span className="text-gray-400 text-xs line-through">
                              {formatPrice(item.price_info[0].original_price, item.price_info[0].currency)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400 text-sm">Xem biến thể</span>
                      )}
                    </div>

                    {/* Stock & Brand */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Kho: {item.stock_info_v2?.summary_info?.total_available_stock ?? '-'}</span>
                      {item.brand?.original_brand_name && (
                        <span className="text-blue-600">{item.brand.original_brand_name}</span>
                      )}
                    </div>

                    {/* Sales & Rating */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Đã bán: {item.sale ?? 0}</span>
                      <div className="flex items-center gap-1">
                        {item.rating_star !== undefined && item.rating_star > 0 && (
                          <>
                            <svg className="w-3 h-3 text-yellow-400 fill-current" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span>{item.rating_star.toFixed(1)}</span>
                          </>
                        )}
                        {item.comment_count !== undefined && item.comment_count > 0 && (
                          <span className="text-gray-400">({item.comment_count})</span>
                        )}
                      </div>
                    </div>

                    {/* Views & Likes */}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {item.views !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {item.views}
                        </span>
                      )}
                      {item.likes !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          {item.likes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>


      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Chi tiết sản phẩm</DialogTitle>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-4">
              {/* Images */}
              <div className="grid grid-cols-6 gap-2">
                {selectedProduct.image?.image_url_list?.slice(0, 6).map((url, idx) => (
                  <img 
                    key={idx} 
                    src={url} 
                    alt={`${selectedProduct.item_name} - ${idx + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border"
                  />
                ))}
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Tên sản phẩm" value={selectedProduct.item_name} full />
                <InfoRow label="ID" value={selectedProduct.item_id} />
                <InfoRow label="SKU" value={selectedProduct.item_sku || '-'} />
                <InfoRow label="Trạng thái" value={STATUS_MAP[selectedProduct.item_status]?.label || selectedProduct.item_status} />
                <InfoRow label="Tình trạng" value={selectedProduct.condition === 'NEW' ? 'Mới' : 'Đã qua sử dụng'} />
                <InfoRow label="Thương hiệu" value={selectedProduct.brand?.original_brand_name || '-'} />
                <InfoRow label="Danh mục ID" value={selectedProduct.category_id} />
                {(selectedProduct.deboost === true || selectedProduct.deboost === 'true') && (
                  <InfoRow label="Bị hạ rank" value="Có" className="text-red-600" />
                )}
              </div>

              {/* Price */}
              {selectedProduct.price_info?.[0] && (
                <div className="bg-orange-50 rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">Giá bán</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Giá hiện tại:</span>
                      <span className="ml-2 font-semibold text-orange-600">
                        {formatPrice(selectedProduct.price_info[0].current_price, selectedProduct.price_info[0].currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Giá gốc:</span>
                      <span className="ml-2">
                        {formatPrice(selectedProduct.price_info[0].original_price, selectedProduct.price_info[0].currency)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats - Extra Info */}
              <div className="grid grid-cols-5 gap-2">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-green-600">{selectedProduct.sale ?? 0}</p>
                  <p className="text-xs text-gray-500">Đã bán</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-600">{selectedProduct.views ?? 0}</p>
                  <p className="text-xs text-gray-500">Lượt xem</p>
                </div>
                <div className="bg-pink-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-pink-600">{selectedProduct.likes ?? 0}</p>
                  <p className="text-xs text-gray-500">Yêu thích</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-yellow-600">
                    {selectedProduct.rating_star ? selectedProduct.rating_star.toFixed(1) : '-'}
                  </p>
                  <p className="text-xs text-gray-500">Đánh giá</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-purple-600">{selectedProduct.comment_count ?? 0}</p>
                  <p className="text-xs text-gray-500">Bình luận</p>
                </div>
              </div>

              {/* Stock */}
              <div className="bg-blue-50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">Tồn kho</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Có sẵn:</span>
                    <span className="ml-2 font-semibold text-blue-600">
                      {selectedProduct.stock_info_v2?.summary_info?.total_available_stock ?? '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Đang giữ:</span>
                    <span className="ml-2">
                      {selectedProduct.stock_info_v2?.summary_info?.total_reserved_stock ?? '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dimension & Weight */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">Cân nặng</h4>
                  <p className="text-sm">{selectedProduct.weight ? `${selectedProduct.weight} kg` : '-'}</p>
                </div>
                {selectedProduct.dimension && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-medium text-sm mb-2">Kích thước (DxRxC)</h4>
                    <p className="text-sm">
                      {selectedProduct.dimension.package_length} x {selectedProduct.dimension.package_width} x {selectedProduct.dimension.package_height} cm
                    </p>
                  </div>
                )}
              </div>

              {/* Pre-order */}
              {selectedProduct.pre_order?.is_pre_order && (
                <div className="bg-purple-50 rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-1">Pre-order</h4>
                  <p className="text-sm">Thời gian giao hàng: {selectedProduct.pre_order.days_to_ship} ngày</p>
                </div>
              )}

              {/* Wholesales */}
              {selectedProduct.wholesales && selectedProduct.wholesales.length > 0 && (
                <div className="bg-green-50 rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">Giá sỉ</h4>
                  <div className="space-y-1 text-sm">
                    {selectedProduct.wholesales.map((w, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{w.min_count} - {w.max_count} sản phẩm</span>
                        <span className="font-medium text-green-600">{formatPrice(w.unit_price)}/sp</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attributes */}
              {selectedProduct.attribute_list && selectedProduct.attribute_list.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">Thuộc tính</h4>
                  <div className="space-y-1 text-sm">
                    {selectedProduct.attribute_list.map((attr, idx) => (
                      <div key={idx} className="flex">
                        <span className="text-gray-500 w-1/3">{attr.original_attribute_name}:</span>
                        <span className="flex-1">
                          {attr.attribute_value_list.map(v => v.original_value_name).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Logistics */}
              {selectedProduct.logistic_info && selectedProduct.logistic_info.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">Vận chuyển</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.logistic_info.filter(l => l.enabled).map((l, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-white rounded border">
                        {l.logistic_name}
                        {l.is_free && <span className="ml-1 text-green-600">(Miễn phí)</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedProduct.description && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">Mô tả</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-6">
                    {selectedProduct.description}
                  </p>
                </div>
              )}

              {/* Timestamps */}
              <div className="text-xs text-gray-400 flex justify-between pt-2 border-t">
                <span>Tạo: {formatDate(selectedProduct.create_time)}</span>
                <span>Cập nhật: {formatDate(selectedProduct.update_time)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component
function InfoRow({ label, value, full, className }: { label: string; value: string | number; full?: boolean; className?: string }) {
  return (
    <div className={cn(full && "col-span-2")}>
      <span className="text-xs text-gray-500">{label}</span>
      <p className={cn("text-sm font-medium", className)}>{value}</p>
    </div>
  );
}
