/**
 * Order Panel - Quản lý đơn hàng Shopee
 */

import { useState, useEffect } from 'react';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { useToast } from '@/hooks/use-toast';
import { getOrderList, getOrderDetail, getEscrowDetail, getEscrowList, getTrackingInfo } from '@/lib/shopee/order-client';
import type { OrderListItem, OrderDetail, OrderStatus, GetOrderListResponse, GetEscrowDetailResponse, OrderIncome, EscrowListItem, TrackingEvent } from '@/lib/shopee/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; color: string }> = {
  UNPAID: { label: 'Chờ thanh toán', color: 'bg-yellow-100 text-yellow-700' },
  READY_TO_SHIP: { label: 'Chờ lấy hàng', color: 'bg-blue-100 text-blue-700' },
  PROCESSED: { label: 'Đang xử lý', color: 'bg-purple-100 text-purple-700' },
  SHIPPED: { label: 'Đang giao', color: 'bg-cyan-100 text-cyan-700' },
  COMPLETED: { label: 'Hoàn thành', color: 'bg-green-100 text-green-700' },
  IN_CANCEL: { label: 'Đang hủy', color: 'bg-orange-100 text-orange-700' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-red-100 text-red-700' },
  INVOICE_PENDING: { label: 'Chờ hóa đơn', color: 'bg-gray-100 text-gray-700' },
};

const STATUS_OPTIONS: OrderStatus[] = [
  'READY_TO_SHIP',
  'SHIPPED',
  'COMPLETED',
  'UNPAID',
  'IN_CANCEL',
  'CANCELLED',
];

export default function OrderPanel() {
  const { toast } = useToast();
  const { token, isAuthenticated } = useShopeeAuth();

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [orderDetails, setOrderDetails] = useState<Map<string, OrderDetail>>(new Map());
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('READY_TO_SHIP');
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string>('');
  const [statusCounts, setStatusCounts] = useState<Record<OrderStatus, number>>({} as Record<OrderStatus, number>);
  
  // Order detail
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Escrow detail (thông tin tài chính)
  const [escrowData, setEscrowData] = useState<OrderIncome | null>(null);
  const [loadingEscrow, setLoadingEscrow] = useState(false);
  
  // Escrow list (danh sách đã giải ngân)
  const [escrowMap, setEscrowMap] = useState<Map<string, EscrowListItem>>(new Map());
  
  // Tracking info (lịch sử đơn hàng)
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);

  // Date range (mặc định 7 ngày)
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dateTo, setDateTo] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  const getTimeRange = () => {
    // Shopee giới hạn tối đa 15 ngày
    const diffDays = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
    
    let fromDate = dateFrom;
    if (diffDays > 15) {
      fromDate = new Date(dateTo);
      fromDate.setDate(fromDate.getDate() - 15);
    }
    
    return {
      time_from: Math.floor(fromDate.getTime() / 1000),
      time_to: Math.floor(dateTo.getTime() / 1000),
    };
  };

  const formatPrice = (price: number | undefined | null, currency = 'VND') => {
    if (price === undefined || price === null || isNaN(price)) return '-';
    if (currency === 'VND') return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
    return new Intl.NumberFormat('vi-VN').format(price) + ' ' + currency;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('vi-VN');
  };


  const loadOrders = async (reset = true) => {
    if (!token?.shop_id) return;

    setLoading(true);
    try {
      const { time_from, time_to } = getTimeRange();
      const result = await getOrderList(token.shop_id, {
        time_range_field: 'create_time',
        time_from,
        time_to,
        page_size: 50,
        cursor: reset ? undefined : cursor,
        order_status: selectedStatus,
        response_optional_fields: 'order_status',
      });

      if (result.error) {
        throw new Error(result.message || result.error);
      }

      if (result.response) {
        if (reset) {
          setOrders(result.response.order_list);
          setOrderDetails(new Map()); // Reset details
        } else {
          setOrders(prev => [...prev, ...result.response!.order_list]);
        }
        setHasMore(result.response.more);
        setCursor(result.response.next_cursor);
        
        // Load order details cho danh sách
        if (result.response.order_list.length > 0) {
          loadOrderDetailsForList(result.response.order_list.map(o => o.order_sn));
        }
        
        // Load escrow list cho đơn COMPLETED
        if (selectedStatus === 'COMPLETED') {
          loadEscrowList();
        }
      }
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadEscrowList = async () => {
    if (!token?.shop_id) return;
    
    try {
      const { time_from, time_to } = getTimeRange();
      // Lấy escrow list trong 30 ngày gần nhất
      const result = await getEscrowList(token.shop_id, time_from, time_to, 100, 1);
      
      if (result.response?.escrow_list) {
        const map = new Map<string, EscrowListItem>();
        result.response.escrow_list.forEach(item => {
          map.set(item.order_sn, item);
        });
        setEscrowMap(map);
      }
    } catch (e) {
      console.warn('Failed to load escrow list:', e);
    }
  };

  const loadOrderDetailsForList = async (orderSnList: string[]) => {
    if (!token?.shop_id || orderSnList.length === 0) return;
    
    try {
      const result = await getOrderDetail(token.shop_id, orderSnList);
      
      if (result.response?.order_list) {
        setOrderDetails(prev => {
          const newMap = new Map(prev);
          result.response!.order_list.forEach(order => {
            newMap.set(order.order_sn, order);
          });
          return newMap;
        });
      }
    } catch (e) {
      console.warn('Failed to load order details for list:', e);
    }
  };

  const loadOrderDetail = async (orderSn: string) => {
    if (!token?.shop_id) return;

    setLoadingDetail(true);
    setEscrowData(null);
    setTrackingEvents([]);
    
    // Dùng cache nếu có
    const cachedOrder = orderDetails.get(orderSn);
    if (cachedOrder) {
      setSelectedOrder(cachedOrder);
      setLoadingDetail(false);
      // Load escrow + tracking song song
      Promise.all([
        loadEscrowDetail(orderSn),
        loadTrackingInfo(orderSn)
      ]);
      return;
    }
    
    try {
      // Gọi tất cả API song song
      const [orderResult] = await Promise.all([
        getOrderDetail(token.shop_id, [orderSn]),
      ]);

      if (orderResult.error) {
        throw new Error(orderResult.message || orderResult.error);
      }

      if (orderResult.response?.order_list?.[0]) {
        setSelectedOrder(orderResult.response.order_list[0]);
        setLoadingDetail(false);
        // Load escrow + tracking song song (không block UI)
        Promise.all([
          loadEscrowDetail(orderSn),
          loadTrackingInfo(orderSn)
        ]);
      }
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
      setLoadingDetail(false);
    }
  };

  const loadEscrowDetail = async (orderSn: string) => {
    if (!token?.shop_id) return;

    setLoadingEscrow(true);
    try {
      const result = await getEscrowDetail(token.shop_id, orderSn);

      if (result.error && result.error !== '') {
        console.warn('Escrow detail error:', result.message || result.error);
        // Không throw error, chỉ log warning vì escrow có thể không có cho một số đơn
        return;
      }

      if (result.response?.order_income) {
        setEscrowData(result.response.order_income);
      }
    } catch (e) {
      console.warn('Failed to load escrow detail:', (e as Error).message);
    } finally {
      setLoadingEscrow(false);
    }
  };

  const loadTrackingInfo = async (orderSn: string) => {
    if (!token?.shop_id) return;

    setLoadingTracking(true);
    try {
      const result = await getTrackingInfo(token.shop_id, orderSn);

      if (result.error && result.error !== '') {
        console.warn('Tracking info error:', result.message || result.error);
        return;
      }

      if (result.response?.tracking_info) {
        // Sort by time descending (newest first)
        const sorted = [...result.response.tracking_info].sort((a, b) => b.update_time - a.update_time);
        setTrackingEvents(sorted);
      }
    } catch (e) {
      console.warn('Failed to load tracking info:', (e as Error).message);
    } finally {
      setLoadingTracking(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && token?.shop_id) {
      loadOrders(true);
    }
  }, [isAuthenticated, token?.shop_id, selectedStatus, dateFrom, dateTo]);

  // Load status counts khi date range thay đổi
  useEffect(() => {
    if (isAuthenticated && token?.shop_id) {
      loadStatusCounts();
    }
  }, [isAuthenticated, token?.shop_id, dateFrom, dateTo]);

  const loadStatusCounts = async () => {
    if (!token?.shop_id) return;
    
    const { time_from, time_to } = getTimeRange();
    const counts: Record<OrderStatus, number> = {} as Record<OrderStatus, number>;
    
    // Load count cho mỗi status song song - chỉ lấy page đầu để ước tính
    await Promise.all(
      STATUS_OPTIONS.map(async (status) => {
        try {
          const result = await getOrderList(token.shop_id!, {
            time_range_field: 'create_time',
            time_from,
            time_to,
            page_size: 100, // Lấy nhiều hơn để đếm chính xác hơn
            order_status: status,
          });
          
          if (result.response) {
            // Nếu có more = true, hiển thị "99+" thay vì đếm hết
            const count = result.response.order_list.length;
            counts[status] = result.response.more ? -1 : count; // -1 = có nhiều hơn
          }
        } catch (e) {
          console.warn(`Failed to load count for ${status}:`, e);
          counts[status] = 0;
        }
      })
    );
    
    setStatusCounts(counts);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Đơn hàng</h2>
            <p className="text-sm text-gray-500">{orders.length} đơn hàng</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-sm font-normal">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {format(dateFrom, 'dd/MM', { locale: vi })} - {format(dateTo, 'dd/MM', { locale: vi })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-3 border-b">
                  <p className="text-sm font-medium">Chọn khoảng thời gian</p>
                  <p className="text-xs text-gray-500">Tối đa 15 ngày</p>
                </div>
                <div className="flex">
                  <div className="border-r">
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50">Từ ngày</div>
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => date && setDateFrom(date)}
                      disabled={(date) => date > dateTo || date > new Date()}
                      locale={vi}
                    />
                  </div>
                  <div>
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50">Đến ngày</div>
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => date && setDateTo(date)}
                      disabled={(date) => date < dateFrom || date > new Date()}
                      locale={vi}
                    />
                  </div>
                </div>
                <div className="p-3 border-t flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const now = new Date();
                      const from = new Date();
                      from.setDate(now.getDate() - 7);
                      from.setHours(0, 0, 0, 0);
                      now.setHours(23, 59, 59, 999);
                      setDateFrom(from);
                      setDateTo(now);
                    }}
                  >
                    7 ngày
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const now = new Date();
                      const from = new Date();
                      from.setDate(now.getDate() - 15);
                      from.setHours(0, 0, 0, 0);
                      now.setHours(23, 59, 59, 999);
                      setDateFrom(from);
                      setDateTo(now);
                    }}
                  >
                    15 ngày
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button onClick={() => loadOrders(true)} disabled={loading} variant="outline" size="sm">
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Đang tải...
                </span>
              ) : 'Làm mới'}
            </Button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="px-4 py-2 border-t flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Trạng thái:</span>
          {STATUS_OPTIONS.map(status => {
            const isActive = selectedStatus === status;
            const { label, color } = ORDER_STATUS_MAP[status];
            const count = statusCounts[status];
            const displayCount = count === -1 ? '99+' : count;
            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1",
                  isActive ? color : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                )}
              >
                {label}
                {displayCount !== undefined && displayCount !== 0 && (
                  <span className={cn(
                    "min-w-[18px] h-[18px] rounded-full text-[10px] flex items-center justify-center",
                    isActive ? "bg-white/30" : "bg-gray-200"
                  )}>
                    {displayCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!isAuthenticated ? (
          <EmptyState title="Chưa đăng nhập" description="Vui lòng kết nối shop Shopee" />
        ) : loading && orders.length === 0 ? (
          <LoadingState />
        ) : orders.length === 0 ? (
          <EmptyState 
            title="Không có đơn hàng" 
            description={`Không tìm thấy đơn hàng ${ORDER_STATUS_MAP[selectedStatus].label.toLowerCase()}`} 
          />
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <OrderCard
                key={order.order_sn}
                order={order}
                onClick={() => loadOrderDetail(order.order_sn)}
                escrowInfo={escrowMap.get(order.order_sn)}
                orderDetail={orderDetails.get(order.order_sn)}
                formatPrice={formatPrice}
                formatDate={formatDate}
                showEscrow={selectedStatus === 'COMPLETED'}
              />
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="text-center pt-4">
                <Button onClick={() => loadOrders(false)} disabled={loading} variant="outline">
                  {loading ? 'Đang tải...' : 'Tải thêm'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder || loadingDetail} onOpenChange={() => { setSelectedOrder(null); setEscrowData(null); setTrackingEvents([]); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết đơn hàng</DialogTitle>
          </DialogHeader>
          
          {loadingDetail ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Đang tải...</p>
            </div>
          ) : selectedOrder && (
            <OrderDetailView 
              order={selectedOrder} 
              formatPrice={formatPrice} 
              formatDate={formatDate}
              escrowData={escrowData}
              loadingEscrow={loadingEscrow}
              escrowInfo={escrowMap.get(selectedOrder.order_sn)}
              trackingEvents={trackingEvents}
              loadingTracking={loadingTracking}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


// Sub-components
function OrderCard({ 
  order, 
  onClick, 
  escrowInfo,
  orderDetail,
  formatPrice,
  formatDate,
  showEscrow,
}: { 
  order: OrderListItem; 
  onClick: () => void;
  escrowInfo?: EscrowListItem;
  orderDetail?: OrderDetail;
  formatPrice: (price: number | undefined | null, currency?: string) => string;
  formatDate: (timestamp: number) => string;
  showEscrow?: boolean;
}) {
  const status = ORDER_STATUS_MAP[order.order_status] || { label: order.order_status, color: 'bg-gray-100 text-gray-600' };
  const firstItem = orderDetail?.item_list?.[0];
  const itemCount = orderDetail?.item_list?.length || 0;
  
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex gap-3">
        {/* Product Image */}
        <div className="flex-shrink-0">
          {firstItem?.image_info?.image_url ? (
            <img 
              src={firstItem.image_info.image_url} 
              alt={firstItem.item_name}
              className="w-16 h-16 object-cover rounded-lg"
            />
          ) : (
            <div className="w-16 h-16 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm text-gray-900">{order.order_sn}</p>
              {firstItem && (
                <p className="text-sm text-gray-600 truncate mt-0.5">
                  {firstItem.item_name}
                  {itemCount > 1 && <span className="text-gray-400"> +{itemCount - 1} sản phẩm</span>}
                </p>
              )}
              {orderDetail?.create_time && (
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(orderDetail.create_time)}
                </p>
              )}
            </div>
            <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0", status.color)}>
              {status.label}
            </span>
          </div>
          
          {/* Bottom row: Price & Escrow */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <div>
              {orderDetail?.total_amount !== undefined && (
                <p className="text-sm font-semibold text-orange-600">
                  {formatPrice(orderDetail.total_amount, orderDetail.currency)}
                </p>
              )}
            </div>
            {showEscrow && (
              <div className="text-right">
                <p className={cn("text-sm font-semibold", escrowInfo ? "text-emerald-600" : "text-gray-400")}>
                  {escrowInfo ? formatPrice(escrowInfo.payout_amount) : '-'}
                </p>
                <p className="text-xs text-gray-400">
                  {escrowInfo ? 'Đã giải ngân' : 'Chưa giải ngân'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailView({ 
  order, 
  formatPrice, 
  formatDate,
  escrowData,
  loadingEscrow,
  escrowInfo,
  trackingEvents,
  loadingTracking,
}: { 
  order: OrderDetail; 
  formatPrice: (price: number | undefined | null, currency?: string) => string;
  formatDate: (timestamp: number) => string;
  escrowData: OrderIncome | null;
  loadingEscrow: boolean;
  escrowInfo?: EscrowListItem;
  trackingEvents: TrackingEvent[];
  loadingTracking: boolean;
}) {
  const status = ORDER_STATUS_MAP[order.order_status as OrderStatus] || { label: order.order_status, color: 'bg-gray-100' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">{order.order_sn}</p>
          <p className="text-sm text-gray-500">Tạo: {formatDate(order.create_time)}</p>
        </div>
        <span className={cn("text-sm px-3 py-1 rounded-full font-medium", status.color)}>
          {status.label}
        </span>
      </div>

      {/* Amount & Payment */}
      <div className="bg-orange-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Tổng tiền</span>
          <span className="text-xl font-bold text-orange-600">
            {formatPrice(order.total_amount, order.currency)}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Phí ship (dự kiến)</span>
            <span>{formatPrice(order.estimated_shipping_fee, order.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Phí ship (thực tế)</span>
            <span>{formatPrice(order.actual_shipping_fee, order.currency)}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-gray-500">Thanh toán:</span>
          <span className="font-medium">{order.payment_method || '-'}</span>
          {order.cod && (
            <span className="text-xs bg-orange-200 text-orange-700 px-2 py-0.5 rounded">COD</span>
          )}
        </div>
        {order.pay_time && (
          <div className="mt-1 text-xs text-gray-500">
            Đã thanh toán: {formatDate(order.pay_time)}
          </div>
        )}
      </div>

      {/* Escrow/Financial Details */}
      {loadingEscrow ? (
        <div className="bg-emerald-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Đang tải thông tin tài chính...</span>
          </div>
        </div>
      ) : escrowData && (
        <div className="space-y-3">
          {/* Số tiền cuối cùng */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium text-gray-700">Số tiền cuối cùng</span>
              </div>
              <span className="text-2xl font-bold text-orange-600">
                {formatPrice(escrowData.escrow_amount, order.currency)}
              </span>
            </div>
          </div>

          {/* Thanh toán của Người Mua */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Thanh toán của Người Mua
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tổng tiền sản phẩm</span>
                <span>{formatPrice(escrowData.order_discounted_price || escrowData.cost_of_goods_sold, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phí vận chuyển</span>
                <span>{formatPrice(escrowData.buyer_paid_shipping_fee || 0, order.currency)}</span>
              </div>
              {escrowData.voucher_from_shopee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Shopee Voucher</span>
                  <span className="text-red-500">-{formatPrice(escrowData.voucher_from_shopee, order.currency)}</span>
                </div>
              )}
              {escrowData.voucher_from_seller > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Mã giảm giá của Shop</span>
                  <span className="text-red-500">-{formatPrice(escrowData.voucher_from_seller, order.currency)}</span>
                </div>
              )}
              {escrowData.coins > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Xu Shopee</span>
                  <span className="text-red-500">-{formatPrice(escrowData.coins, order.currency)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-blue-200 font-medium">
                <span>Tổng tiền Thanh toán</span>
                <span className="text-blue-700">{formatPrice(escrowData.buyer_total_amount, order.currency)}</span>
              </div>
            </div>
          </div>

          {/* Chi tiết doanh thu */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Chi tiết doanh thu
            </h4>
            
            <div className="space-y-3 text-sm">
              {/* Tổng tiền sản phẩm */}
              <div>
                <div className="flex justify-between font-medium">
                  <span>Tổng tiền sản phẩm</span>
                  <span>{formatPrice(escrowData.order_discounted_price || escrowData.cost_of_goods_sold, order.currency)}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                  <span>Giá sản phẩm</span>
                  <span>{formatPrice(escrowData.order_discounted_price || escrowData.cost_of_goods_sold, order.currency)}</span>
                </div>
              </div>

              {/* Tổng phí vận chuyển ước tính */}
              <div>
                <div className="flex justify-between font-medium">
                  <span>Tổng phí vận chuyển ước tính</span>
                  <span>{formatPrice(escrowData.buyer_paid_shipping_fee || 0, order.currency)}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                  <span>Phí vận chuyển Người mua trả</span>
                  <span>{formatPrice(escrowData.buyer_paid_shipping_fee || 0, order.currency)}</span>
                </div>
                {(escrowData.estimated_shipping_fee || 0) > 0 && (
                  <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                    <span>Phí vận chuyển ước tính</span>
                    <span className="text-red-500">-{formatPrice(escrowData.estimated_shipping_fee || 0, order.currency)}</span>
                  </div>
                )}
                {escrowData.shopee_shipping_rebate > 0 && (
                  <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                    <span>Phí vận chuyển được trợ giá từ Shopee ước tính</span>
                    <span className="text-emerald-600">{formatPrice(escrowData.shopee_shipping_rebate, order.currency)}</span>
                  </div>
                )}
              </div>

              {/* Phụ phí */}
              {(() => {
                const commissionFee = escrowData.commission_fee || 0;
                const pishipFee = escrowData.shipping_seller_protection_fee_amount || 0;
                const serviceFee = escrowData.service_fee || 0;
                const transactionFee = escrowData.seller_transaction_fee || 0;
                const totalFees = commissionFee + pishipFee + serviceFee + transactionFee;
                return totalFees > 0 ? (
                  <div>
                    <div className="flex justify-between font-medium">
                      <span>Phụ phí</span>
                      <span className="text-red-600">-{formatPrice(totalFees, order.currency)}</span>
                    </div>
                    {commissionFee > 0 && (
                      <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                        <span>Phí cố định</span>
                        <span className="text-red-500">-{formatPrice(commissionFee, order.currency)}</span>
                      </div>
                    )}
                    {pishipFee > 0 && (
                      <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                        <span>Phí dịch vụ PiShip</span>
                        <span className="text-red-500">-{formatPrice(pishipFee, order.currency)}</span>
                      </div>
                    )}
                    {serviceFee > 0 && (
                      <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                        <span>Phí Dịch Vụ</span>
                        <span className="text-red-500">-{formatPrice(serviceFee, order.currency)}</span>
                      </div>
                    )}
                    {transactionFee > 0 && (
                      <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                        <span>Phí thanh toán</span>
                        <span className="text-red-500">-{formatPrice(transactionFee, order.currency)}</span>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Thuế */}
              {(() => {
                const vatTax = escrowData.withholding_vat_tax || 0;
                const pitTax = escrowData.withholding_pit_tax || 0;
                const totalTax = vatTax + pitTax;
                return totalTax > 0 ? (
                  <div>
                    <div className="flex justify-between font-medium">
                      <span>Thuế</span>
                      <span className="text-red-600">-{formatPrice(totalTax, order.currency)}</span>
                    </div>
                    {vatTax > 0 && (
                      <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                        <span>Thuế GTGT</span>
                        <span className="text-red-500">-{formatPrice(vatTax, order.currency)}</span>
                      </div>
                    )}
                    {pitTax > 0 && (
                      <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                        <span>Thuế TNCN</span>
                        <span className="text-red-500">-{formatPrice(pitTax, order.currency)}</span>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Phí khác nếu có */}
              {(() => {
                const campaignFee = escrowData.campaign_fee || 0;
                const amsFee = escrowData.order_ams_commission_fee || 0;
                const otherFees = campaignFee + amsFee;
                return otherFees > 0 ? (
                  <div>
                    <div className="flex justify-between font-medium">
                      <span>Phí khác</span>
                      <span className="text-red-600">-{formatPrice(otherFees, order.currency)}</span>
                    </div>
                    {campaignFee > 0 && (
                      <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                        <span>Phí chiến dịch</span>
                        <span className="text-red-500">-{formatPrice(campaignFee, order.currency)}</span>
                      </div>
                    )}
                    {amsFee > 0 && (
                      <div className="flex justify-between text-gray-500 text-xs mt-1 pl-3">
                        <span>Phí quảng cáo AMS</span>
                        <span className="text-red-500">-{formatPrice(amsFee, order.currency)}</span>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Tổng phụ dịch vụ giá trị gia tăng cho người mua */}
              <div className="flex justify-between text-gray-600">
                <span>Tổng phụ dịch vụ giá trị gia tăng cho người mua</span>
                <span>{formatPrice(0, order.currency)}</span>
              </div>

              {/* Doanh thu đơn hàng ước tính */}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Doanh thu đơn hàng ước tính</span>
                  <span className="text-xl font-bold text-orange-600">
                    {formatPrice(escrowData.escrow_amount, order.currency)}
                  </span>
                </div>
              </div>

              {/* Trạng thái giải ngân */}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Giải ngân
                  </span>
                  {escrowInfo ? (
                    <div className="text-right">
                      <span className="text-lg font-bold text-emerald-600">
                        {formatPrice(escrowInfo.payout_amount, order.currency)}
                      </span>
                      <p className="text-xs text-gray-500">{formatDate(escrowInfo.escrow_release_time)}</p>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Chưa giải ngân</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buyer Info */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Người mua
        </h4>
        <p className="text-sm font-medium">{order.buyer_username}</p>
        {order.recipient_address && (
          <div className="mt-2 text-sm text-gray-600">
            <p className="font-medium">{order.recipient_address.name} - {order.recipient_address.phone}</p>
            <p className="text-xs mt-1">{order.recipient_address.full_address}</p>
          </div>
        )}
      </div>

      {/* Items */}
      {order.item_list && order.item_list.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-3">Sản phẩm ({order.item_list.length})</h4>
          <div className="space-y-3">
            {order.item_list.map((item, idx) => (
              <div key={idx} className="flex gap-3 bg-white rounded-lg p-3">
                {item.image_info?.image_url ? (
                  <img 
                    src={item.image_info.image_url} 
                    alt={item.item_name}
                    className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2">{item.item_name}</p>
                  {item.model_name && (
                    <p className="text-xs text-gray-500 mt-0.5">Phân loại: {item.model_name}</p>
                  )}
                  {(item.model_sku || item.item_sku) && (
                    <p className="text-xs text-gray-400 mt-0.5">SKU: {item.model_sku || item.item_sku}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <span className="text-orange-600 font-medium text-sm">
                        {formatPrice(item.model_discounted_price)}
                      </span>
                      {item.model_original_price > item.model_discounted_price && (
                        <span className="text-gray-400 text-xs line-through ml-2">
                          {formatPrice(item.model_original_price)}
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 text-sm">x{item.model_quantity_purchased}</span>
                  </div>
                  {item.weight > 0 && (
                    <p className="text-xs text-gray-400 mt-1">Khối lượng: {item.weight}kg</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipping */}
      {(order.shipping_carrier || order.package_list?.length > 0) && (
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Vận chuyển
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Đơn vị vận chuyển</span>
              <span className="font-medium">{order.shipping_carrier || order.checkout_shipping_carrier || '-'}</span>
            </div>
            {order.ship_by_date && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Giao trước</span>
                <span>{formatDate(order.ship_by_date)}</span>
              </div>
            )}
            {order.pickup_done_time && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Đã lấy hàng</span>
                <span>{formatDate(order.pickup_done_time)}</span>
              </div>
            )}
            {order.order_chargeable_weight_gram && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Khối lượng tính phí</span>
                <span>{order.order_chargeable_weight_gram}g</span>
              </div>
            )}
          </div>
          
          {/* Package/Tracking Info */}
          {order.package_list && order.package_list.length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <p className="text-xs text-gray-500 mb-2">Mã vận đơn:</p>
              {order.package_list.map((pkg, idx) => (
                <div key={idx} className="bg-white rounded p-2 mb-2 last:mb-0">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono text-green-700">{pkg.package_number}</code>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      {pkg.logistics_status?.replace(/_/g, ' ') || 'N/A'}
                    </span>
                  </div>
                  {pkg.shipping_carrier && (
                    <p className="text-xs text-gray-500 mt-1">{pkg.shipping_carrier}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Note */}
      {order.message_to_seller && (
        <div className="bg-yellow-50 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-1">Ghi chú từ người mua</h4>
          <p className="text-sm text-gray-600">{order.message_to_seller}</p>
        </div>
      )}

      {/* Cancel Info */}
      {order.cancel_reason && (
        <div className="bg-red-50 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-1 text-red-700">Lý do hủy</h4>
          <p className="text-sm text-red-600">{order.cancel_reason}</p>
          {order.cancel_by && <p className="text-xs text-gray-500 mt-1">Hủy bởi: {order.cancel_by}</p>}
        </div>
      )}

      {/* Order Timeline / Lịch sử đơn hàng */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Lịch sử đơn hàng
        </h4>
        
        {loadingTracking ? (
          <div className="flex items-center gap-2 text-gray-500 py-4">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Đang tải lịch sử...</span>
          </div>
        ) : trackingEvents.length > 0 ? (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />
            
            <div className="space-y-4">
              {trackingEvents.map((event, idx) => {
                const isFirst = idx === 0;
                const isCompleted = event.logistics_status === 'LOGISTICS_DELIVERY_DONE' || 
                                   event.logistics_status === 'LOGISTICS_CONFIRMED_RECEIVE';
                const isPaid = event.logistics_status === 'LOGISTICS_CONFIRMED_RECEIVE' ||
                              event.description?.toLowerCase().includes('thanh toán') ||
                              event.description?.toLowerCase().includes('chuyển khoản');
                
                return (
                  <div key={idx} className="relative flex gap-3 pl-1">
                    {/* Timeline dot */}
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 z-10",
                      isFirst ? "bg-teal-500" : "bg-white border-2 border-gray-300"
                    )}>
                      {isCompleted || isPaid ? (
                        <svg className={cn("w-3 h-3", isFirst ? "text-white" : "text-teal-500")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isFirst ? (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      ) : null}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pb-1">
                      <p className={cn(
                        "font-medium text-sm",
                        isFirst ? "text-teal-600" : "text-gray-700"
                      )}>
                        {event.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(event.update_time)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic py-2">Chưa có lịch sử</p>
        )}
      </div>

      {/* Timestamps */}
      <div className="text-xs text-gray-400 pt-2 border-t space-y-1">
        <div className="flex justify-between">
          <span>Tạo đơn:</span>
          <span>{formatDate(order.create_time)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cập nhật:</span>
          <span>{formatDate(order.update_time)}</span>
        </div>
        {order.fulfillment_flag && (
          <div className="flex justify-between">
            <span>Fulfillment:</span>
            <span className="capitalize">{order.fulfillment_flag.replace(/_/g, ' ')}</span>
          </div>
        )}
        {order.days_to_ship && (
          <div className="flex justify-between">
            <span>Thời gian giao hàng:</span>
            <span>{order.days_to_ship} ngày</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="font-medium">{title}</p>
      <p className="text-sm mt-1">{description}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="text-center py-12">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-gray-500">Đang tải đơn hàng...</p>
    </div>
  );
}
