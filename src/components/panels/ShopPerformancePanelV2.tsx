/**
 * Shop Performance Panel V2 - Kiến trúc mới
 * Đọc data từ Supabase DB với Realtime updates
 * Background sync từ Shopee API
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { useSyncData, useRealtimeData } from '@/hooks/useSyncData';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ShopPerformance {
  id: string;
  shop_id: number;
  rating: number;
  fulfillment_failed: number;
  listing_failed: number;
  custom_service_failed: number;
  synced_at: string;
}

interface ShopMetric {
  id: string;
  shop_id: number;
  metric_id: number;
  metric_name: string;
  metric_type: number;
  current_period: number | null;
  last_period: number | null;
  unit: number;
  target_value: number;
  target_comparator: string;
  is_passing: boolean;
  exemption_end_date: string | null;
  synced_at: string;
}

const RATING_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'Kém', color: 'text-red-700 bg-red-100' },
  2: { label: 'Cần cải thiện', color: 'text-yellow-700 bg-yellow-100' },
  3: { label: 'Tốt', color: 'text-green-700 bg-green-100' },
  4: { label: 'Xuất sắc', color: 'text-blue-700 bg-blue-100' },
};

const METRIC_TYPE_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'Thực hiện đơn hàng', color: 'bg-blue-100 text-blue-700' },
  2: { label: 'Chất lượng listing', color: 'bg-green-100 text-green-700' },
  3: { label: 'Dịch vụ khách hàng', color: 'bg-purple-100 text-purple-700' },
};

const UNIT_MAP: Record<number, string> = {
  1: '', 2: '%', 3: 's', 4: 'ngày', 5: 'giờ',
};

const METRIC_NAME_MAP: Record<string, string> = {
  'non_fulfillment_rate': 'Tỷ lệ không thực hiện',
  'cancellation_rate': 'Tỷ lệ hủy đơn',
  'return_refund_rate': 'Tỷ lệ trả hàng/hoàn tiền',
  'late_shipment_rate': 'Tỷ lệ giao hàng trễ',
  'preparation_time': 'Thời gian chuẩn bị',
  'same_day_handover_rate': 'Tỷ lệ bàn giao cùng ngày',
  'severe_listing_violations': 'Vi phạm listing nghiêm trọng',
  'spam_listings': 'Listing spam',
  'counterfeit_ip_infringement': 'Hàng giả/Vi phạm bản quyền',
  'prohibited_listings': 'Listing bị cấm',
  'pre_order_listing_rate': 'Tỷ lệ listing pre-order',
  'response_rate': 'Tỷ lệ phản hồi chat',
  'response_time': 'Thời gian phản hồi',
  'shop_rating': 'Đánh giá shop',
};

interface ShopPerformancePanelProps {
  shopId: number;
}

export default function ShopPerformancePanelV2({ shopId }: ShopPerformancePanelProps) {
  const { toast } = useToast();
  const { token, isAuthenticated, user } = useShopeeAuth();
  const userId = user?.id || '';

  // Sync hook - auto sync nếu data cũ
  const { isSyncing, triggerSync, syncStatus } = useSyncData({
    shopId: token?.shop_id || 0,
    userId,
    autoSyncOnMount: true,
    syncType: 'shop_performance',
    staleMinutes: 30, // Shop performance không cần sync thường xuyên
  });

  // Realtime data từ DB
  const { 
    data: performanceData, 
    loading: loadingPerformance 
  } = useRealtimeData<ShopPerformance>(
    'shop_performance_data',
    token?.shop_id || 0,
    userId
  );

  const { 
    data: metricsData, 
    loading: loadingMetrics 
  } = useRealtimeData<ShopMetric>(
    'shop_metrics_data',
    token?.shop_id || 0,
    userId,
    { orderBy: 'metric_type' }
  );

  const performance = performanceData[0];
  const loading = loadingPerformance || loadingMetrics;

  const formatValue = (value: number | null, unit: number): string => {
    if (value === null) return '-';
    return `${value}${UNIT_MAP[unit] || ''}`;
  };

  const formatSyncTime = (timestamp: string | null) => {
    if (!timestamp) return 'Chưa sync';
    return new Date(timestamp).toLocaleString('vi-VN');
  };

  // Group metrics by type
  const groupedMetrics = metricsData.reduce((acc, metric) => {
    const type = metric.metric_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(metric);
    return acc;
  }, {} as Record<number, ShopMetric[]>);

  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-700 mb-2">Chưa kết nối Shopee</h3>
          <p className="text-slate-500">Vui lòng kết nối tài khoản Shopee để xem hiệu suất shop</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Hiệu suất Shop</h2>
            <p className="text-sm text-slate-400">
              Shop ID: {shopId}
              {syncStatus?.shop_performance_synced_at && (
                <span className="ml-2">• Sync: {formatSyncTime(syncStatus.shop_performance_synced_at)}</span>
              )}
              {isSyncing && <span className="ml-2 text-blue-500">• Đang sync...</span>}
            </p>
          </div>
        </div>
        
        <Button 
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600" 
          onClick={() => triggerSync('shop_performance')} 
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Đang sync...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync ngay
            </>
          )}
        </Button>
      </div>

      {loading && !performance ? (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-slate-400">Đang tải dữ liệu...</p>
          </div>
        </div>
      ) : !performance ? (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-slate-400 mb-4">Chưa có dữ liệu hiệu suất</p>
            <Button onClick={() => triggerSync('shop_performance')} disabled={isSyncing}>
              {isSyncing ? 'Đang sync...' : 'Sync dữ liệu'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Overall Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Tổng quan hiệu suất
              </CardTitle>
              <CardDescription>
                Đánh giá tổng thể về hiệu suất shop của bạn
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className={`text-2xl font-bold mb-2 px-3 py-1 rounded-full inline-block ${RATING_MAP[performance.rating]?.color}`}>
                    {RATING_MAP[performance.rating]?.label || 'N/A'}
                  </div>
                  <p className="text-sm text-slate-500">Xếp hạng tổng thể</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-700 mb-2">
                    {performance.fulfillment_failed}
                  </div>
                  <p className="text-sm text-slate-500">Thực hiện đơn hàng</p>
                  <p className="text-xs text-slate-400">chỉ số không đạt</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-700 mb-2">
                    {performance.listing_failed}
                  </div>
                  <p className="text-sm text-slate-500">Chất lượng listing</p>
                  <p className="text-xs text-slate-400">chỉ số không đạt</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-700 mb-2">
                    {performance.custom_service_failed}
                  </div>
                  <p className="text-sm text-slate-500">Dịch vụ khách hàng</p>
                  <p className="text-xs text-slate-400">chỉ số không đạt</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Metrics */}
          {Object.entries(groupedMetrics).map(([typeStr, metrics]) => {
            const type = Number(typeStr);
            const typeInfo = METRIC_TYPE_MAP[type];
            
            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="secondary" className={typeInfo?.color}>
                      {typeInfo?.label}
                    </Badge>
                    <span className="text-sm text-slate-500">({metrics.length} chỉ số)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chỉ số</TableHead>
                        <TableHead className="text-center">Hiện tại</TableHead>
                        <TableHead className="text-center">Kỳ trước</TableHead>
                        <TableHead className="text-center">Mục tiêu</TableHead>
                        <TableHead className="text-center">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.map((metric) => {
                        const metricDisplayName = METRIC_NAME_MAP[metric.metric_name] || metric.metric_name;
                        
                        return (
                          <TableRow key={metric.metric_id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-700">{metricDisplayName}</p>
                                <p className="text-xs text-slate-400">ID: {metric.metric_id}</p>
                                {metric.exemption_end_date && (
                                  <p className="text-xs text-orange-600">
                                    Miễn trừ đến: {new Date(metric.exemption_end_date).toLocaleDateString('vi-VN')}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`font-medium ${metric.is_passing ? 'text-green-600' : 'text-red-600'}`}>
                                {formatValue(metric.current_period, metric.unit)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-slate-500">
                              {formatValue(metric.last_period, metric.unit)}
                            </TableCell>
                            <TableCell className="text-center text-slate-600">
                              {metric.target_comparator} {formatValue(metric.target_value, metric.unit)}
                            </TableCell>
                            <TableCell className="text-center">
                              {metric.is_passing ? (
                                <Badge variant="secondary" className="bg-green-100 text-green-700">
                                  ✓ Đạt
                                </Badge>
                              ) : metric.current_period === null ? (
                                <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                  - Chưa có dữ liệu
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-red-100 text-red-700">
                                  ✗ Không đạt
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
