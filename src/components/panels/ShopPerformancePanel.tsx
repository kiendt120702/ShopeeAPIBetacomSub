/**
 * Shop Performance Panel - Hiển thị hiệu suất shop từ Shopee API
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Badge,
} from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MetricTarget {
  value: number;
  comparator: string;
}

interface Metric {
  metric_id: number;
  parent_metric_id: number;
  metric_name: string;
  metric_type: number;
  current_period: number | null;
  last_period: number | null;
  unit: number;
  target: MetricTarget;
  exemption_end_date?: string;
}

interface OverallPerformance {
  rating: number;
  fulfillment_failed: number;
  listing_failed: number;
  custom_service_failed: number;
}

interface ShopPerformanceResponse {
  error?: string;
  message?: string;
  request_id?: string;
  response?: {
    overall_performance: OverallPerformance;
    metric_list: Metric[];
  };
}



interface ShopPerformancePanelProps {
  shopId: number;
}

const RATING_MAP: Record<number, { label: string; color: string; bgColor: string }> = {
  1: { label: 'Kém', color: 'text-red-700', bgColor: 'bg-red-100' },
  2: { label: 'Cần cải thiện', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  3: { label: 'Tốt', color: 'text-green-700', bgColor: 'bg-green-100' },
  4: { label: 'Xuất sắc', color: 'text-blue-700', bgColor: 'bg-blue-100' },
};

const METRIC_TYPE_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'Thực hiện đơn hàng', color: 'bg-blue-100 text-blue-700' },
  2: { label: 'Chất lượng listing', color: 'bg-green-100 text-green-700' },
  3: { label: 'Dịch vụ khách hàng', color: 'bg-purple-100 text-purple-700' },
};

const UNIT_MAP: Record<number, string> = {
  1: '',
  2: '%',
  3: 's',
  4: 'ngày',
  5: 'giờ',
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
  'the_amount_of_pre_order_listing': 'Số ngày vi phạm pre-order',
  'other_listing_violations': 'Vi phạm listing khác',
  'response_rate': 'Tỷ lệ phản hồi chat',
  'response_time': 'Thời gian phản hồi',
  'shop_rating': 'Đánh giá shop',
};



export default function ShopPerformancePanel({ shopId }: ShopPerformancePanelProps) {
  const { toast } = useToast();
  const { token, isAuthenticated } = useShopeeAuth();
  const [loading, setLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState<ShopPerformanceResponse['response'] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);


  const fetchShopPerformance = async () => {
    if (!token?.shop_id || !isAuthenticated) {
      toast({ title: 'Lỗi', description: 'Chưa đăng nhập Shopee.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<ShopPerformanceResponse>('shopee-shop-performance', {
        body: { 
          action: 'get-shop-performance',
          shop_id: token.shop_id
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        toast({ title: 'Lỗi', description: data.message || data.error, variant: 'destructive' });
        return;
      }

      setPerformanceData(data?.response || null);
      setLastUpdated(new Date().toLocaleString('vi-VN'));
      toast({ title: 'Thành công', description: 'Đã tải dữ liệu hiệu suất shop' });
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };



  // Auto-load on mount
  useEffect(() => {
    if (isAuthenticated && token?.shop_id) {
      fetchShopPerformance();
    }
  }, [isAuthenticated, token?.shop_id]);

  const formatValue = (value: number | null, unit: number): string => {
    if (value === null) return '-';
    const unitSymbol = UNIT_MAP[unit] || '';
    return `${value}${unitSymbol}`;
  };

  const getMetricStatus = (metric: Metric): { status: 'pass' | 'fail' | 'unknown'; color: string } => {
    if (metric.current_period === null) return { status: 'unknown', color: 'text-gray-500' };
    
    const { value, comparator } = metric.target;
    const current = metric.current_period;
    
    let passes = false;
    switch (comparator) {
      case '<':
        passes = current < value;
        break;
      case '<=':
        passes = current <= value;
        break;
      case '>':
        passes = current > value;
        break;
      case '>=':
        passes = current >= value;
        break;
      case '=':
        passes = current === value;
        break;
      default:
        return { status: 'unknown', color: 'text-gray-500' };
    }
    
    return {
      status: passes ? 'pass' : 'fail',
      color: passes ? 'text-green-600' : 'text-red-600'
    };
  };

  const groupedMetrics = performanceData?.metric_list.reduce((acc, metric) => {
    const type = metric.metric_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(metric);
    return acc;
  }, {} as Record<number, Metric[]>) || {};



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
          <p className="text-slate-500 mb-4">Vui lòng kết nối tài khoản Shopee để xem hiệu suất shop</p>
          <p className="text-sm text-slate-400">Đi đến tab "Cài đặt" để kết nối tài khoản</p>
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
              {lastUpdated && ` • Cập nhật: ${lastUpdated}`}
            </p>
          </div>
        </div>
        
        <Button 
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600" 
          onClick={fetchShopPerformance} 
          disabled={loading}
        >
          {loading ? 'Đang tải...' : 'Tải dữ liệu'}
        </Button>
      </div>

      {!performanceData ? (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-slate-400">{loading ? 'Đang tải...' : 'Nhấn "Tải dữ liệu" để xem hiệu suất shop'}</p>
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
                  <div className={`text-2xl font-bold mb-2 ${RATING_MAP[performanceData.overall_performance.rating]?.color}`}>
                    {RATING_MAP[performanceData.overall_performance.rating]?.label}
                  </div>
                  <p className="text-sm text-slate-500">Xếp hạng tổng thể</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-700 mb-2">
                    {performanceData.overall_performance.fulfillment_failed}
                  </div>
                  <p className="text-sm text-slate-500">Thực hiện đơn hàng</p>
                  <p className="text-xs text-slate-400">chỉ số không đạt</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-700 mb-2">
                    {performanceData.overall_performance.listing_failed}
                  </div>
                  <p className="text-sm text-slate-500">Chất lượng listing</p>
                  <p className="text-xs text-slate-400">chỉ số không đạt</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-700 mb-2">
                    {performanceData.overall_performance.custom_service_failed}
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
                        const status = getMetricStatus(metric);
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
                              <span className={`font-medium ${status.color}`}>
                                {formatValue(metric.current_period, metric.unit)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-slate-500">
                              {formatValue(metric.last_period, metric.unit)}
                            </TableCell>
                            <TableCell className="text-center text-slate-600">
                              {metric.target.comparator} {formatValue(metric.target.value, metric.unit)}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                {status.status === 'pass' && (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                                    ✓ Đạt
                                  </Badge>
                                )}
                                {status.status === 'fail' && (
                                  <Badge variant="secondary" className="bg-red-100 text-red-700">
                                    ✗ Không đạt
                                  </Badge>
                                )}
                                {status.status === 'unknown' && (
                                  <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                    - Chưa có dữ liệu
                                  </Badge>
                                )}
                              </div>
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