/**
 * Ads Panel V2 - Kiến trúc mới
 * Đọc data từ Supabase DB với Realtime updates
 */

import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { useSyncData, useRealtimeData } from '@/hooks/useSyncData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import AdsBudgetSchedulerPanel from './AdsBudgetSchedulerPanel';

interface Campaign {
  id: string;
  shop_id: number;
  campaign_id: number;
  ad_type: string;
  name: string;
  status: string;
  campaign_placement: string;
  bidding_method: string;
  campaign_budget: number;
  start_time: number;
  end_time: number;
  item_count: number;
  roas_target: number | null;
  synced_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ongoing: { label: 'Đang chạy', color: 'bg-green-100 text-green-700' },
  scheduled: { label: 'Đã lên lịch', color: 'bg-blue-100 text-blue-700' },
  ended: { label: 'Kết thúc', color: 'bg-gray-100 text-gray-600' },
  paused: { label: 'Tạm dừng', color: 'bg-yellow-100 text-yellow-700' },
  deleted: { label: 'Đã xóa', color: 'bg-red-100 text-red-700' },
  closed: { label: 'Đã đóng', color: 'bg-gray-100 text-gray-600' },
};

const AD_TYPE_MAP: Record<string, { label: string; color: string }> = {
  auto: { label: 'Tự động', color: 'bg-purple-100 text-purple-700' },
  manual: { label: 'Thủ công', color: 'bg-indigo-100 text-indigo-700' },
};

const PLACEMENT_MAP: Record<string, string> = {
  all: 'Tất cả',
  search: 'Tìm kiếm',
  discovery: 'Khám phá',
};

const STATUS_PRIORITY: Record<string, number> = {
  ongoing: 1, scheduled: 2, paused: 3, ended: 4, deleted: 5, closed: 6,
};

export default function AdsPanelV2() {
  const { toast } = useToast();
  const { token, isAuthenticated, user } = useShopeeAuth();
  const userId = user?.id || '';
  const shopId = token?.shop_id || 0;

  // Tab state
  const [mainTab, setMainTab] = useState<'campaigns' | 'scheduler'>('campaigns');
  
  // Filter state
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Edit Budget Dialog
  const [editBudgetOpen, setEditBudgetOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [newBudget, setNewBudget] = useState<string>('');
  const [savingBudget, setSavingBudget] = useState(false);

  // Sync hook
  const { isSyncing, triggerSync, syncStatus } = useSyncData({
    shopId,
    userId,
    autoSyncOnMount: true,
    syncType: 'campaigns',
    staleMinutes: 5,
  });

  // Realtime data từ DB
  const { data: campaigns, loading } = useRealtimeData<Campaign>(
    'ads_campaign_data',
    shopId,
    userId,
    { orderBy: 'synced_at', orderAsc: false }
  );

  // Filter and sort campaigns
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];
    
    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(c => c.ad_type === filterType);
    }
    
    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(c => c.status === filterStatus);
    }
    
    // Sort by status priority
    result.sort((a, b) => {
      const priorityA = STATUS_PRIORITY[a.status] || 99;
      const priorityB = STATUS_PRIORITY[b.status] || 99;
      return priorityA - priorityB;
    });
    
    return result;
  }, [campaigns, filterType, filterStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);
  const paginatedCampaigns = filteredCampaigns.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatPrice = (price: number) => new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Không giới hạn';
    return new Date(timestamp * 1000).toLocaleDateString('vi-VN');
  };
  const formatSyncTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('vi-VN');
  };

  const openEditBudget = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setNewBudget(campaign.campaign_budget?.toString() || '0');
    setEditBudgetOpen(true);
  };

  const handleSaveBudget = async () => {
    if (!editingCampaign) return;

    const budgetValue = parseFloat(newBudget);
    if (isNaN(budgetValue) || budgetValue < 0) {
      toast({ title: 'Lỗi', description: 'Ngân sách không hợp lệ', variant: 'destructive' });
      return;
    }

    setSavingBudget(true);
    try {
      // Gọi API để update budget trên Shopee
      const { data, error } = await supabase.functions.invoke('shopee-api', {
        body: {
          action: 'edit-campaign-budget',
          shop_id: shopId,
          campaign_id: editingCampaign.campaign_id,
          ad_type: editingCampaign.ad_type,
          budget: budgetValue,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Lỗi', description: data.message || data.error, variant: 'destructive' });
        return;
      }

      // Update local DB
      await supabase
        .from('ads_campaign_data')
        .update({ campaign_budget: budgetValue })
        .eq('id', editingCampaign.id);

      toast({ title: 'Thành công', description: 'Đã cập nhật ngân sách' });
      setEditBudgetOpen(false);
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSavingBudget(false);
    }
  };

  const handleToggleStatus = async (campaign: Campaign) => {
    const newAction = campaign.status === 'ongoing' ? 'pause' : 'resume';

    try {
      const { data, error } = await supabase.functions.invoke('shopee-api', {
        body: {
          action: 'edit-campaign-status',
          shop_id: shopId,
          campaign_id: campaign.campaign_id,
          ad_type: campaign.ad_type,
          status_action: newAction,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Lỗi', description: data.message || data.error, variant: 'destructive' });
        return;
      }

      // Update local DB
      const newStatus = newAction === 'pause' ? 'paused' : 'ongoing';
      await supabase
        .from('ads_campaign_data')
        .update({ status: newStatus })
        .eq('id', campaign.id);

      toast({ title: 'Thành công', description: `Đã ${newAction === 'pause' ? 'tạm dừng' : 'tiếp tục'} chiến dịch` });
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
    }
  };

  // Render Scheduler Tab
  if (mainTab === 'scheduler') {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white border-b border-slate-200 px-4 py-2">
          <div className="flex gap-1">
            <button
              onClick={() => setMainTab('campaigns')}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 rounded-lg"
            >
              📊 Chiến dịch
            </button>
            <button
              onClick={() => setMainTab('scheduler')}
              className="px-4 py-2 text-sm font-medium bg-emerald-100 text-emerald-700 rounded-lg"
            >
              ⏰ Lịch ngân sách
            </button>
          </div>
        </div>
        <AdsBudgetSchedulerPanel />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-50 min-h-full">
      {/* Tab Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => setMainTab('campaigns')}
            className="px-4 py-2 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg"
          >
            📊 Chiến dịch
          </button>
          <button
            onClick={() => setMainTab('scheduler')}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 rounded-lg"
          >
            ⏰ Lịch ngân sách
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Quản lý Quảng cáo</h2>
              <p className="text-sm text-slate-400">
                {filteredCampaigns.length}/{campaigns.length} chiến dịch
                {totalPages > 1 && ` • Trang ${currentPage}/${totalPages}`}
                {isSyncing && <span className="ml-2 text-blue-500">• Đang sync...</span>}
                {syncStatus?.campaigns_synced_at && !isSyncing && (
                  <span className="ml-2 text-slate-300">
                    • Sync: {formatSyncTime(syncStatus.campaigns_synced_at)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32 bg-slate-50">
                <SelectValue placeholder="Loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="auto">🤖 Tự động</SelectItem>
                <SelectItem value="manual">✋ Thủ công</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(value) => {
              setFilterStatus(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-32 bg-slate-50">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="ongoing">🟢 Đang chạy</SelectItem>
                <SelectItem value="paused">🟡 Tạm dừng</SelectItem>
                <SelectItem value="scheduled">🔵 Đã lên lịch</SelectItem>
                <SelectItem value="ended">⚫ Kết thúc</SelectItem>
              </SelectContent>
            </Select>

            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  ←
                </Button>
                <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                  {currentPage}/{totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  →
                </Button>
              </div>
            )}

            <Button
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              onClick={() => triggerSync('campaigns')}
              disabled={isSyncing || !isAuthenticated}
            >
              {isSyncing ? 'Đang sync...' : 'Sync'}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white">
        {!isAuthenticated ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-500">Vui lòng kết nối Shopee để tiếp tục</p>
          </div>
        ) : loading ? (
          <div className="h-full flex items-center justify-center">
            <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : paginatedCampaigns.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                </svg>
              </div>
              <p className="text-slate-400 mb-4">Chưa có dữ liệu chiến dịch</p>
              <Button onClick={() => triggerSync('campaigns')} disabled={isSyncing}>
                {isSyncing ? 'Đang sync...' : 'Sync dữ liệu'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table className="min-w-[1200px]">
              <TableHeader className="sticky top-0 bg-slate-50 z-10">
                <TableRow>
                  <TableHead className="w-[350px]">Chiến dịch</TableHead>
                  <TableHead className="text-center">Vị trí</TableHead>
                  <TableHead className="text-center">Đấu giá</TableHead>
                  <TableHead className="text-center">Ngân sách</TableHead>
                  <TableHead className="text-center">ROAS</TableHead>
                  <TableHead className="text-center">SP</TableHead>
                  <TableHead className="text-center">Thời gian</TableHead>
                  <TableHead className="text-center w-[100px]">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCampaigns.map((campaign) => {
                  const statusInfo = STATUS_MAP[campaign.status];
                  const typeInfo = AD_TYPE_MAP[campaign.ad_type];
                  
                  return (
                    <TableRow key={campaign.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeInfo?.color}`}>
                              {typeInfo?.label}
                            </span>
                            {statusInfo && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-slate-800">{campaign.name || `Campaign ${campaign.campaign_id}`}</p>
                          <p className="text-xs text-slate-400">ID: {campaign.campaign_id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm text-slate-600">
                        {PLACEMENT_MAP[campaign.campaign_placement] || '-'}
                      </TableCell>
                      <TableCell className="text-center text-sm text-slate-600">
                        {campaign.bidding_method === 'auto' ? 'Tự động' : 'Thủ công'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-slate-700">
                          {campaign.campaign_budget === 0 ? 'Không giới hạn' : formatPrice(campaign.campaign_budget)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {campaign.roas_target ? (
                          <span className="font-medium text-purple-600">{campaign.roas_target}x</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium text-slate-700">
                        {campaign.item_count}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <div className="text-slate-600">{formatDate(campaign.start_time)}</div>
                        <div className="text-slate-400">→ {formatDate(campaign.end_time)}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditBudget(campaign)} className="p-1.5 hover:bg-slate-100 rounded-md" title="Chỉnh sửa ngân sách">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {(campaign.status === 'ongoing' || campaign.status === 'paused') && (
                            <button
                              onClick={() => handleToggleStatus(campaign)}
                              className={`p-1.5 rounded-md ${campaign.status === 'ongoing' ? 'hover:bg-yellow-100 text-yellow-600' : 'hover:bg-green-100 text-green-600'}`}
                              title={campaign.status === 'ongoing' ? 'Tạm dừng' : 'Tiếp tục'}
                            >
                              {campaign.status === 'ongoing' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Budget Dialog */}
      <Dialog open={editBudgetOpen} onOpenChange={setEditBudgetOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa ngân sách</DialogTitle>
            <DialogDescription>{editingCampaign?.name || `Campaign ${editingCampaign?.campaign_id}`}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-slate-700 mb-2 block">Ngân sách hàng ngày (VNĐ)</label>
            <Input type="number" value={newBudget} onChange={(e) => setNewBudget(e.target.value)} placeholder="Nhập ngân sách (0 = không giới hạn)" min="0" step="1000" />
            <p className="text-xs text-slate-400 mt-2">Nhập 0 để đặt ngân sách không giới hạn</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBudgetOpen(false)}>Hủy</Button>
            <Button onClick={handleSaveBudget} disabled={savingBudget} className="bg-gradient-to-r from-blue-500 to-indigo-500">
              {savingBudget ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
