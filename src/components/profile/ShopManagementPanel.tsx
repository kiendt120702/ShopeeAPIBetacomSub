/**
 * Shop Management Panel - Quản lý danh sách shop
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { DataTable, CellShopInfo, CellBadge, CellText, CellActions } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Shop {
  shop_id: number;
  shop_name: string | null;
  shop_logo: string | null;
  region: string | null;
  partner_id: number | null;
  created_at: string;
  token_updated_at: string | null;
  expired_at: number | null;
  auth_time: number | null;
  expire_time: number | null;
  access_token: string | null;
  refresh_token: string | null;
}

interface ShopWithRole extends Shop {
  role: string;
}

export function ShopManagementPanel() {
  const { toast } = useToast();
  const { user, login } = useShopeeAuth();
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<ShopWithRole[]>([]);
  const [refreshingShop, setRefreshingShop] = useState<number | null>(null);
  const [reconnectingShop, setReconnectingShop] = useState<number | null>(null);
  
  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shopToDelete, setShopToDelete] = useState<ShopWithRole | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState<number | null>(null);

  const loadShops = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('shop_members')
        .select('shop_id, role')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      if (!memberData || memberData.length === 0) {
        setShops([]);
        setLoading(false);
        return;
      }

      const shopIds = memberData.map(m => m.shop_id);
      const roleMap = new Map(memberData.map(m => [m.shop_id, m.role]));

      const { data: shopsData, error: shopsError } = await supabase
        .from('shops')
        .select('shop_id, shop_name, shop_logo, region, partner_id, created_at, token_updated_at, expired_at, auth_time, expire_time, access_token, refresh_token')
        .in('shop_id', shopIds);

      if (shopsError) throw shopsError;

      const shopsWithRole: ShopWithRole[] = (shopsData || []).map(shop => ({
        ...shop,
        role: roleMap.get(shop.shop_id) || 'member',
      }));

      setShops(shopsWithRole);
    } catch (err) {
      console.error('Error loading shops:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách shop',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, [user?.id]);

  const handleRefreshShopName = async (shopId: number) => {
    setRefreshingShop(shopId);
    try {
      const { data, error } = await supabase.functions.invoke('shopee-shop', {
        body: { action: 'get-full-info', shop_id: shopId, force_refresh: true },
      });

      if (error) throw error;

      if (data?.shop_name) {
        setShops(prev => prev.map(s => 
          s.shop_id === shopId ? { ...s, shop_name: data.shop_name, shop_logo: data.shop_logo } : s
        ));
        toast({ title: 'Thành công', description: `Đã cập nhật: ${data.shop_name}` });
      }
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRefreshingShop(null);
    }
  };

  const handleReconnectShop = async (shop: ShopWithRole) => {
    setReconnectingShop(shop.shop_id);
    try {
      let partnerInfo = null;
      if (shop.partner_id) {
        const { data: partnerData } = await supabase
          .from('partner_accounts')
          .select('partner_id, partner_key, partner_name')
          .eq('partner_id', shop.partner_id)
          .single();
        
        if (partnerData) {
          partnerInfo = {
            partner_id: partnerData.partner_id,
            partner_key: partnerData.partner_key,
            partner_name: partnerData.partner_name,
          };
        }
      }

      await login(undefined, undefined, partnerInfo || undefined);
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });
      setReconnectingShop(null);
    }
  };

  const handleDeleteShop = async () => {
    if (!shopToDelete) return;

    setDeleting(true);
    try {
      const { error: membersError } = await supabase
        .from('shop_members')
        .delete()
        .eq('shop_id', shopToDelete.shop_id);

      if (membersError) throw membersError;

      const { error: shopError } = await supabase
        .from('shops')
        .delete()
        .eq('shop_id', shopToDelete.shop_id);

      if (shopError) throw shopError;

      setShops(prev => prev.filter(s => s.shop_id !== shopToDelete.shop_id));
      setDeleteDialogOpen(false);
      setShopToDelete(null);

      toast({ title: 'Thành công', description: 'Đã xóa shop' });
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleConnectNewShop = async () => {
    try {
      await login();
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Kiểm tra trạng thái token
  const getTokenStatus = (shop: ShopWithRole) => {
    if (!shop.access_token) {
      return { status: 'missing', label: 'Chưa có token', color: 'bg-slate-100 text-slate-600', expireTime: null };
    }
    
    if (!shop.expired_at) {
      return { status: 'unknown', label: 'Không rõ', color: 'bg-slate-100 text-slate-600', expireTime: null };
    }

    const now = Date.now();
    const expiredAt = shop.expired_at;
    const timeLeft = expiredAt - now;
    
    // Format thời gian hết hạn: "19:11 29/12"
    const expireDate = new Date(expiredAt);
    const expireTime = expireDate.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
    
    if (timeLeft <= 0) {
      return { status: 'expired', label: `Hết hạn lúc ${expireTime}`, color: 'bg-red-100 text-red-700', expireTime };
    }
    
    // Còn dưới 30 phút - cảnh báo đỏ
    if (timeLeft < 30 * 60 * 1000) {
      return { status: 'expiring', label: `⚠️ ${expireTime}`, color: 'bg-red-100 text-red-700', expireTime };
    }
    
    // Còn dưới 1 giờ - cảnh báo vàng
    if (timeLeft < 60 * 60 * 1000) {
      return { status: 'warning', label: `⚠️ ${expireTime}`, color: 'bg-amber-100 text-amber-700', expireTime };
    }
    
    // Còn hạn - màu xanh
    return { status: 'valid', label: expireTime, color: 'bg-green-100 text-green-700', expireTime };
  };

  // Refresh token thủ công
  const handleRefreshToken = async (shop: ShopWithRole) => {
    if (!shop.refresh_token) {
      toast({
        title: 'Lỗi',
        description: 'Không có refresh token. Vui lòng kết nối lại shop.',
        variant: 'destructive',
      });
      return;
    }

    setRefreshingToken(shop.shop_id);
    try {
      const { data, error } = await supabase.functions.invoke('shopee-auth', {
        body: {
          action: 'refresh-token',
          refresh_token: shop.refresh_token,
          shop_id: shop.shop_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);

      // Reload shops để cập nhật thông tin mới
      await loadShops();
      
      toast({ 
        title: 'Thành công', 
        description: `Đã refresh token cho ${shop.shop_name || shop.shop_id}` 
      });
    } catch (err) {
      toast({
        title: 'Lỗi refresh token',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRefreshingToken(null);
    }
  };

  const columns = [
    {
      key: 'shop',
      header: 'Shop',
      width: '280px',
      render: (shop: ShopWithRole) => (
        <CellShopInfo
          logo={shop.shop_logo}
          name={shop.shop_name || `Shop ${shop.shop_id}`}
          region={shop.region || 'VN'}
          onRefresh={() => handleRefreshShopName(shop.shop_id)}
          refreshing={refreshingShop === shop.shop_id}
        />
      ),
    },
    {
      key: 'shop_id',
      header: 'ID',
      render: (shop: ShopWithRole) => (
        <CellText mono>{shop.shop_id}</CellText>
      ),
    },
    {
      key: 'role',
      header: 'Quyền',
      render: (shop: ShopWithRole) => (
        <CellBadge variant={shop.role === 'admin' ? 'success' : 'default'}>
          {shop.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
        </CellBadge>
      ),
    },
    {
      key: 'auth_time',
      header: 'Ủy quyền',
      render: (shop: ShopWithRole) => (
        <CellText muted>{formatDate(shop.auth_time)}</CellText>
      ),
    },
    {
      key: 'expire_time',
      header: 'Hết hạn UQ',
      render: (shop: ShopWithRole) => (
        <CellText muted>{formatDate(shop.expire_time)}</CellText>
      ),
    },
    {
      key: 'token_status',
      header: 'Token Status',
      render: (shop: ShopWithRole) => {
        const tokenStatus = getTokenStatus(shop);
        return (
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${tokenStatus.color}`}>
              {tokenStatus.label}
            </span>
            {shop.refresh_token && (tokenStatus.status === 'expired' || tokenStatus.status === 'expiring' || tokenStatus.status === 'warning') && (
              <button
                onClick={(e) => { e.stopPropagation(); handleRefreshToken(shop); }}
                disabled={refreshingToken === shop.shop_id}
                className="p-1 hover:bg-slate-100 rounded text-violet-600"
                title="Refresh token"
              >
                {refreshingToken === shop.shop_id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (shop: ShopWithRole) => (
        <CellActions>
          <Button
            variant="outline"
            size="sm"
            className="text-slate-600 hover:text-slate-800"
            onClick={(e) => { e.stopPropagation(); handleReconnectShop(shop); }}
            disabled={reconnectingShop === shop.shop_id}
          >
            {reconnectingShop === shop.shop_id ? (
              <Spinner size="sm" />
            ) : (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Kết nối lại
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2"
            onClick={(e) => {
              e.stopPropagation();
              setShopToDelete(shop);
              setDeleteDialogOpen(true);
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </CellActions>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Đang tải..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <span>Shop có quyền truy cập ({shops.length})</span>
            <Button 
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleConnectNewShop}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Kết nối Shop
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={shops}
            keyExtractor={(shop) => shop.shop_id}
            emptyMessage="Chưa có shop nào được kết nối"
            emptyDescription="Nhấn 'Kết nối Shop' để bắt đầu"
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Xác nhận xóa Shop</DialogTitle>
            <DialogDescription>
              Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan đến shop sẽ bị xóa.
            </DialogDescription>
          </DialogHeader>
          {shopToDelete && (
            <div className="py-4">
              <div className="bg-red-50 rounded-lg p-4">
                <p className="font-medium text-slate-800">
                  {shopToDelete.shop_name || `Shop ${shopToDelete.shop_id}`}
                </p>
                <p className="text-sm text-slate-500">ID: {shopToDelete.shop_id}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDeleteShop} disabled={deleting}>
              {deleting ? 'Đang xóa...' : 'Xóa Shop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
