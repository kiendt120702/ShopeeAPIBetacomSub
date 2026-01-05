import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { cn } from '@/lib/utils';
import { 
  getHourlyPerformance, 
  getDailyPerformance, 
  getCampaignDailyPerformance,
  getCampaignHourlyPerformance,
  getCampaignsFromCache,
  type HourlyPerformance, 
  type DailyPerformance,
  type CampaignPerformance,
  type CampaignHourlyPerformance,
  type CachedCampaign
} from '@/lib/shopee/ads-client';

type ViewType = 'hourly' | 'daily' | 'campaign';
type CampaignViewMode = 'daily' | 'hourly';

export default function AdsPerformancePanel() {
  const { toast } = useToast();
  const { token } = useShopeeAuth();
  
  const [viewType, setViewType] = useState<ViewType>('hourly');
  const [loading, setLoading] = useState(false);
  
  // Hourly state
  const [hourlyDate, setHourlyDate] = useState(() => {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getFullYear()}`;
  });
  const [hourlyData, setHourlyData] = useState<HourlyPerformance[]>([]);
  
  // Daily state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return `${d.getDate().toString().padStart(2,'0')}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getFullYear()}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getFullYear()}`;
  });
  const [dailyData, setDailyData] = useState<DailyPerformance[]>([]);

  // Campaign state
  const [campaigns, setCampaigns] = useState<CachedCampaign[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<number[]>([]);
  const [campaignData, setCampaignData] = useState<CampaignPerformance[]>([]);
  const [campaignHourlyData, setCampaignHourlyData] = useState<CampaignHourlyPerformance[]>([]);
  const [expandedCampaign, setExpandedCampaign] = useState<number | null>(null);
  const [campaignViewMode, setCampaignViewMode] = useState<CampaignViewMode>('daily');
  const [campaignDate, setCampaignDate] = useState(() => {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getFullYear()}`;
  });

  const formatNumber = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
  const formatMoney = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
  const formatPercent = (n: number) => n.toFixed(2) + '%';

  // Load campaigns for selection
  useEffect(() => {
    if (token?.shop_id && viewType === 'campaign') {
      loadCampaigns();
    }
  }, [token?.shop_id, viewType]);

  const loadCampaigns = async () => {
    if (!token?.shop_id) return;
    const cached = await getCampaignsFromCache(token.shop_id);
    // Sort: ongoing first, then by name
    const sorted = cached.sort((a, b) => {
      if (a.status === 'ongoing' && b.status !== 'ongoing') return -1;
      if (a.status !== 'ongoing' && b.status === 'ongoing') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    setCampaigns(sorted);
  };

  const fetchHourly = async () => {
    if (!token?.shop_id) return;
    setLoading(true);
    try {
      const res = await getHourlyPerformance(token.shop_id, hourlyDate);
      if (res.error && res.error !== '') {
        toast({ title: 'Lỗi', description: res.message || res.error, variant: 'destructive' });
        return;
      }
      setHourlyData(res.response || []);
      toast({ title: 'Thành công', description: `Đã tải ${res.response?.length || 0} records` });
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchDaily = async () => {
    if (!token?.shop_id) return;
    setLoading(true);
    try {
      const res = await getDailyPerformance(token.shop_id, startDate, endDate);
      if (res.error && res.error !== '') {
        toast({ title: 'Lỗi', description: res.message || res.error, variant: 'destructive' });
        return;
      }
      setDailyData(res.response || []);
      toast({ title: 'Thành công', description: `Đã tải ${res.response?.length || 0} ngày` });
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignPerformance = async () => {
    if (!token?.shop_id || selectedCampaigns.length === 0) {
      toast({ title: 'Thông báo', description: 'Vui lòng chọn ít nhất 1 campaign', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await getCampaignDailyPerformance(token.shop_id, selectedCampaigns, startDate, endDate);
      console.log('[Campaign Performance] Response:', res);
      
      if (res.error && res.error !== '') {
        toast({ title: 'Lỗi', description: res.message || res.error, variant: 'destructive' });
        return;
      }
      
      // Response can be array or object with campaign_list
      let campaignList: CampaignPerformance[] = [];
      if (Array.isArray(res.response)) {
        campaignList = res.response?.[0]?.campaign_list || [];
      } else if (res.response && 'campaign_list' in res.response) {
        campaignList = (res.response as any).campaign_list;
      }
      
      setCampaignData(campaignList);
      toast({ title: 'Thành công', description: `Đã tải ${campaignList.length} campaigns` });
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignHourlyPerformance = async () => {
    if (!token?.shop_id || selectedCampaigns.length === 0) {
      toast({ title: 'Thông báo', description: 'Vui lòng chọn ít nhất 1 campaign', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await getCampaignHourlyPerformance(token.shop_id, selectedCampaigns, campaignDate);
      console.log('[Campaign Hourly Performance] Response:', res);
      
      if (res.error && res.error !== '') {
        toast({ title: 'Lỗi', description: res.message || res.error, variant: 'destructive' });
        return;
      }
      
      let campaignList: CampaignHourlyPerformance[] = [];
      if (Array.isArray(res.response)) {
        campaignList = res.response?.[0]?.campaign_list || [];
      } else if ((res.response as any)?.campaign_list) {
        campaignList = (res.response as any).campaign_list;
      }
      
      setCampaignHourlyData(campaignList);
      toast({ title: 'Thành công', description: `Đã tải ${campaignList.length} campaigns` });
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaignSelection = (campaignId: number) => {
    setSelectedCampaigns(prev => 
      prev.includes(campaignId) 
        ? prev.filter(id => id !== campaignId)
        : prev.length < 100 ? [...prev, campaignId] : prev
    );
  };

  const selectAllCampaigns = () => {
    if (selectedCampaigns.length === campaigns.length) {
      setSelectedCampaigns([]);
    } else {
      setSelectedCampaigns(campaigns.slice(0, 100).map(c => c.campaign_id));
    }
  };

  // Calculate totals
  const hourlyTotals = hourlyData.reduce((acc, h) => ({
    impression: acc.impression + h.impression,
    clicks: acc.clicks + h.clicks,
    direct_order: acc.direct_order + h.direct_order,
    broad_order: acc.broad_order + h.broad_order,
    direct_gmv: acc.direct_gmv + h.direct_gmv,
    broad_gmv: acc.broad_gmv + h.broad_gmv,
    expense: acc.expense + h.expense,
  }), { impression: 0, clicks: 0, direct_order: 0, broad_order: 0, direct_gmv: 0, broad_gmv: 0, expense: 0 });

  const dailyTotals = dailyData.reduce((acc, d) => ({
    impression: acc.impression + d.impression,
    clicks: acc.clicks + d.clicks,
    direct_order: acc.direct_order + d.direct_order,
    broad_order: acc.broad_order + d.broad_order,
    direct_gmv: acc.direct_gmv + d.direct_gmv,
    broad_gmv: acc.broad_gmv + d.broad_gmv,
    expense: acc.expense + d.expense,
  }), { impression: 0, clicks: 0, direct_order: 0, broad_order: 0, direct_gmv: 0, broad_gmv: 0, expense: 0 });

  // Calculate campaign totals
  const getCampaignTotals = (metrics: CampaignPerformance['metrics_list']) => {
    return metrics.reduce((acc, m) => ({
      impression: acc.impression + m.impression,
      clicks: acc.clicks + m.clicks,
      expense: acc.expense + m.expense,
      broad_gmv: acc.broad_gmv + m.broad_gmv,
      broad_order: acc.broad_order + m.broad_order,
      direct_gmv: acc.direct_gmv + m.direct_gmv,
      direct_order: acc.direct_order + m.direct_order,
    }), { impression: 0, clicks: 0, expense: 0, broad_gmv: 0, broad_order: 0, direct_gmv: 0, direct_order: 0 });
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b p-4 flex-shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            <button onClick={() => setViewType('hourly')} className={cn("px-4 py-2 rounded-lg text-sm font-medium", viewType === 'hourly' ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600")}>Theo giờ</button>
            <button onClick={() => setViewType('daily')} className={cn("px-4 py-2 rounded-lg text-sm font-medium", viewType === 'daily' ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600")}>Theo ngày</button>
            <button onClick={() => setViewType('campaign')} className={cn("px-4 py-2 rounded-lg text-sm font-medium", viewType === 'campaign' ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600")}>Theo Campaign</button>
          </div>
          
          {viewType === 'hourly' && (
            <div className="flex items-center gap-2">
              <Input type="text" value={hourlyDate} onChange={e => setHourlyDate(e.target.value)} placeholder="DD-MM-YYYY" className="w-32" />
              <Button onClick={fetchHourly} disabled={loading}>{loading ? 'Đang tải...' : 'Xem'}</Button>
            </div>
          )}
          
          {viewType === 'daily' && (
            <div className="flex items-center gap-2">
              <Input type="text" value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="DD-MM-YYYY" className="w-32" />
              <span className="text-gray-400">→</span>
              <Input type="text" value={endDate} onChange={e => setEndDate(e.target.value)} placeholder="DD-MM-YYYY" className="w-32" />
              <Button onClick={fetchDaily} disabled={loading}>
                {loading ? 'Đang tải...' : 'Xem'}
              </Button>
            </div>
          )}
          
          {viewType === 'campaign' && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button 
                  onClick={() => setCampaignViewMode('daily')} 
                  className={cn("px-3 py-1 rounded text-xs font-medium", campaignViewMode === 'daily' ? "bg-white shadow text-gray-800" : "text-gray-500")}
                >
                  Theo ngày
                </button>
                <button 
                  onClick={() => setCampaignViewMode('hourly')} 
                  className={cn("px-3 py-1 rounded text-xs font-medium", campaignViewMode === 'hourly' ? "bg-white shadow text-gray-800" : "text-gray-500")}
                >
                  Theo giờ
                </button>
              </div>
              {campaignViewMode === 'daily' ? (
                <>
                  <Input type="text" value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="DD-MM-YYYY" className="w-32" />
                  <span className="text-gray-400">→</span>
                  <Input type="text" value={endDate} onChange={e => setEndDate(e.target.value)} placeholder="DD-MM-YYYY" className="w-32" />
                </>
              ) : (
                <Input type="text" value={campaignDate} onChange={e => setCampaignDate(e.target.value)} placeholder="DD-MM-YYYY" className="w-32" />
              )}
              <Button onClick={campaignViewMode === 'daily' ? fetchCampaignPerformance : fetchCampaignHourlyPerformance} disabled={loading}>
                {loading ? 'Đang tải...' : 'Xem'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {((viewType === 'hourly' && hourlyData.length > 0) || (viewType === 'daily' && dailyData.length > 0)) && (
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {(() => {
            const totals = viewType === 'hourly' ? hourlyTotals : dailyTotals;
            const roas = totals.expense > 0 ? totals.broad_gmv / totals.expense : 0;
            return (
              <>
                <SummaryCard label="Hiển thị" value={formatNumber(totals.impression)} color="blue" />
                <SummaryCard label="Clicks" value={formatNumber(totals.clicks)} color="purple" />
                <SummaryCard label="Đơn hàng" value={formatNumber(totals.broad_order)} color="green" />
                <SummaryCard label="Doanh thu" value={formatMoney(totals.broad_gmv)} color="orange" />
                <SummaryCard label="Chi phí" value={formatMoney(totals.expense)} color="red" />
                <SummaryCard label="ROAS" value={roas.toFixed(2)} color="teal" />
                <SummaryCard label="Lợi nhuận" value={formatMoney(totals.broad_gmv - totals.expense)} color={totals.broad_gmv > totals.expense ? 'green' : 'red'} />
              </>
            );
          })()}
        </div>
      )}

      {/* Data Table */}
      <div className="flex-1 overflow-auto p-4">
        {viewType === 'hourly' && (
          hourlyData.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ChartIcon className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Xem hiệu suất theo giờ</h3>
              <p className="text-sm text-gray-500">Nhập ngày (DD-MM-YYYY) và nhấn Xem</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs font-medium text-gray-500">
                      <th className="text-left px-4 py-3">Giờ</th>
                      <th className="text-right px-3 py-3">Hiển thị</th>
                      <th className="text-right px-3 py-3">Clicks</th>
                      <th className="text-right px-3 py-3">CTR</th>
                      <th className="text-right px-3 py-3">Đơn hàng</th>
                      <th className="text-right px-3 py-3">Doanh thu</th>
                      <th className="text-right px-3 py-3">Chi phí</th>
                      <th className="text-right px-3 py-3">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {hourlyData.sort((a,b) => a.hour - b.hour).map(h => (
                      <tr key={h.hour} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{h.hour.toString().padStart(2,'0')}:00</td>
                        <td className="text-right px-3 py-3">{formatNumber(h.impression)}</td>
                        <td className="text-right px-3 py-3">{formatNumber(h.clicks)}</td>
                        <td className="text-right px-3 py-3">{formatPercent(h.ctr)}</td>
                        <td className="text-right px-3 py-3">{formatNumber(h.broad_order)}</td>
                        <td className="text-right px-3 py-3 text-green-600">{formatMoney(h.broad_gmv)}</td>
                        <td className="text-right px-3 py-3 text-red-600">{formatMoney(h.expense)}</td>
                        <td className="text-right px-3 py-3 font-medium">{h.broad_roas.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {viewType === 'daily' && (
          dailyData.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CalendarIcon className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Xem hiệu suất theo ngày</h3>
              <p className="text-sm text-gray-500">Chọn khoảng thời gian và nhấn Xem</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs font-medium text-gray-500">
                      <th className="text-left px-4 py-3">Ngày</th>
                      <th className="text-right px-3 py-3">Hiển thị</th>
                      <th className="text-right px-3 py-3">Clicks</th>
                      <th className="text-right px-3 py-3">CTR</th>
                      <th className="text-right px-3 py-3">Đơn hàng</th>
                      <th className="text-right px-3 py-3">Doanh thu</th>
                      <th className="text-right px-3 py-3">Chi phí</th>
                      <th className="text-right px-3 py-3">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dailyData.map(d => (
                      <tr key={d.date} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{d.date}</td>
                        <td className="text-right px-3 py-3">{formatNumber(d.impression)}</td>
                        <td className="text-right px-3 py-3">{formatNumber(d.clicks)}</td>
                        <td className="text-right px-3 py-3">{formatPercent(d.ctr)}</td>
                        <td className="text-right px-3 py-3">{formatNumber(d.broad_order)}</td>
                        <td className="text-right px-3 py-3 text-green-600">{formatMoney(d.broad_gmv)}</td>
                        <td className="text-right px-3 py-3 text-red-600">{formatMoney(d.expense)}</td>
                        <td className="text-right px-3 py-3 font-medium">{d.broad_roas.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {viewType === 'campaign' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Campaign Selector */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Chọn Campaign</h3>
                <button onClick={selectAllCampaigns} className="text-xs text-orange-600 hover:underline">
                  {selectedCampaigns.length === campaigns.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>
              {campaigns.length === 0 ? (
                <p className="text-sm text-gray-500">Chưa có campaign. Vui lòng đồng bộ từ trang Quản lý Ads.</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-auto">
                  {campaigns.map(c => (
                    <label key={c.campaign_id} className={cn(
                      "flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                      selectedCampaigns.includes(c.campaign_id) ? "bg-orange-50 border border-orange-200" : "hover:bg-gray-50 border border-transparent"
                    )}>
                      <input
                        type="checkbox"
                        checked={selectedCampaigns.includes(c.campaign_id)}
                        onChange={() => toggleCampaignSelection(c.campaign_id)}
                        className="mt-1 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.name || `Campaign ${c.campaign_id}`}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("text-xs px-1.5 py-0.5 rounded", c.ad_type === 'auto' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
                            {c.ad_type}
                          </span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded", c.status === 'ongoing' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                            {c.status}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3">Đã chọn: {selectedCampaigns.length}/100</p>
            </div>

            {/* Campaign Performance Results */}
            <div className="lg:col-span-3">
              {(campaignViewMode === 'daily' ? campaignData.length === 0 : campaignHourlyData.length === 0) ? (
                <div className="bg-white rounded-xl border p-8 text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CampaignIcon className="w-8 h-8 text-purple-500" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Xem hiệu suất từng Campaign</h3>
                  <p className="text-sm text-gray-500">
                    {campaignViewMode === 'daily' 
                      ? 'Chọn campaigns bên trái, chọn khoảng thời gian và nhấn Xem'
                      : 'Chọn campaigns bên trái, chọn ngày và nhấn Xem'}
                  </p>
                </div>
              ) : campaignViewMode === 'daily' ? (
                <div className="space-y-4">
                  {campaignData.map(campaign => {
                    const totals = getCampaignTotals(campaign.metrics_list);
                    const roas = totals.expense > 0 ? totals.broad_gmv / totals.expense : 0;
                    const isExpanded = expandedCampaign === campaign.campaign_id;
                    
                    return (
                      <div key={campaign.campaign_id} className="bg-white rounded-xl border overflow-hidden">
                        {/* Campaign Header */}
                        <button
                          onClick={() => setExpandedCampaign(isExpanded ? null : campaign.campaign_id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", campaign.ad_type === 'auto' ? "bg-blue-100" : "bg-purple-100")}>
                              <CampaignIcon className={cn("w-5 h-5", campaign.ad_type === 'auto' ? "text-blue-600" : "text-purple-600")} />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-gray-800">{campaign.ad_name || `Campaign ${campaign.campaign_id}`}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn("text-xs px-1.5 py-0.5 rounded", campaign.ad_type === 'auto' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
                                  {campaign.ad_type}
                                </span>
                                <span className="text-xs text-gray-500">{campaign.campaign_placement}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Doanh thu</p>
                              <p className="font-semibold text-green-600">{formatMoney(totals.broad_gmv)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Chi phí</p>
                              <p className="font-semibold text-red-600">{formatMoney(totals.expense)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">ROAS</p>
                              <p className="font-semibold text-gray-800">{roas.toFixed(2)}</p>
                            </div>
                            <svg className={cn("w-5 h-5 text-gray-400 transition-transform", isExpanded && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        
                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="border-t">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-50 border-b text-xs font-medium text-gray-500">
                                    <th className="text-left px-4 py-3">Ngày</th>
                                    <th className="text-right px-3 py-3">Hiển thị</th>
                                    <th className="text-right px-3 py-3">Clicks</th>
                                    <th className="text-right px-3 py-3">CTR</th>
                                    <th className="text-right px-3 py-3">Đơn hàng</th>
                                    <th className="text-right px-3 py-3">Doanh thu</th>
                                    <th className="text-right px-3 py-3">Chi phí</th>
                                    <th className="text-right px-3 py-3">ROAS</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {campaign.metrics_list.map(m => (
                                    <tr key={m.date} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 font-medium">{m.date}</td>
                                      <td className="text-right px-3 py-3">{formatNumber(m.impression)}</td>
                                      <td className="text-right px-3 py-3">{formatNumber(m.clicks)}</td>
                                      <td className="text-right px-3 py-3">{formatPercent(m.ctr)}</td>
                                      <td className="text-right px-3 py-3">{formatNumber(m.broad_order)}</td>
                                      <td className="text-right px-3 py-3 text-green-600">{formatMoney(m.broad_gmv)}</td>
                                      <td className="text-right px-3 py-3 text-red-600">{formatMoney(m.expense)}</td>
                                      <td className="text-right px-3 py-3 font-medium">{m.broad_roi.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Hourly Campaign View */
                <div className="space-y-4">
                  {campaignHourlyData.map(campaign => {
                    const totals = campaign.metrics_list.reduce((acc, m) => ({
                      impression: acc.impression + m.impression,
                      clicks: acc.clicks + m.clicks,
                      expense: acc.expense + m.expense,
                      broad_gmv: acc.broad_gmv + m.broad_gmv,
                      broad_order: acc.broad_order + m.broad_order,
                    }), { impression: 0, clicks: 0, expense: 0, broad_gmv: 0, broad_order: 0 });
                    const roas = totals.expense > 0 ? totals.broad_gmv / totals.expense : 0;
                    const isExpanded = expandedCampaign === campaign.campaign_id;
                    
                    return (
                      <div key={campaign.campaign_id} className="bg-white rounded-xl border overflow-hidden">
                        <button
                          onClick={() => setExpandedCampaign(isExpanded ? null : campaign.campaign_id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", campaign.ad_type === 'auto' ? "bg-blue-100" : "bg-purple-100")}>
                              <CampaignIcon className={cn("w-5 h-5", campaign.ad_type === 'auto' ? "text-blue-600" : "text-purple-600")} />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-gray-800">{campaign.ad_name || `Campaign ${campaign.campaign_id}`}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn("text-xs px-1.5 py-0.5 rounded", campaign.ad_type === 'auto' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
                                  {campaign.ad_type}
                                </span>
                                <span className="text-xs text-gray-500">{campaign.campaign_placement}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Doanh thu</p>
                              <p className="font-semibold text-green-600">{formatMoney(totals.broad_gmv)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Chi phí</p>
                              <p className="font-semibold text-red-600">{formatMoney(totals.expense)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">ROAS</p>
                              <p className="font-semibold text-gray-800">{roas.toFixed(2)}</p>
                            </div>
                            <svg className={cn("w-5 h-5 text-gray-400 transition-transform", isExpanded && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        
                        {isExpanded && (
                          <div className="border-t">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-50 border-b text-xs font-medium text-gray-500">
                                    <th className="text-left px-4 py-3">Giờ</th>
                                    <th className="text-right px-3 py-3">Hiển thị</th>
                                    <th className="text-right px-3 py-3">Clicks</th>
                                    <th className="text-right px-3 py-3">CTR</th>
                                    <th className="text-right px-3 py-3">Đơn hàng</th>
                                    <th className="text-right px-3 py-3">Doanh thu</th>
                                    <th className="text-right px-3 py-3">Chi phí</th>
                                    <th className="text-right px-3 py-3">ROAS</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {campaign.metrics_list.sort((a, b) => a.hour - b.hour).map(m => (
                                    <tr key={m.hour} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 font-medium">{m.hour.toString().padStart(2,'0')}:00</td>
                                      <td className="text-right px-3 py-3">{formatNumber(m.impression)}</td>
                                      <td className="text-right px-3 py-3">{formatNumber(m.clicks)}</td>
                                      <td className="text-right px-3 py-3">{formatPercent(m.ctr)}</td>
                                      <td className="text-right px-3 py-3">{formatNumber(m.broad_order)}</td>
                                      <td className="text-right px-3 py-3 text-green-600">{formatMoney(m.broad_gmv)}</td>
                                      <td className="text-right px-3 py-3 text-red-600">{formatMoney(m.expense)}</td>
                                      <td className="text-right px-3 py-3 font-medium">{m.broad_roi.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Components
function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    red: 'bg-red-50 text-red-700',
    teal: 'bg-teal-50 text-teal-700',
  };
  return (
    <div className={cn("rounded-xl p-3", colors[color] || 'bg-gray-50')}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function ChartIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}

function CalendarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}

function CampaignIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>;
}
