import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShopConnectionDialog } from './ShopConnectionDialog';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Shop {
  shop_id: number;
  shop_name: string;
  region: string;
  access_level: string;
}

interface DashboardStats {
  managed_users_count: number;
  managed_shops_count: number;
  total_shop_assignments: number;
  recent_assignments_count: number;
}



export function UserProfileInfo() {
  const { user, profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [userShops, setUserShops] = useState<Shop[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  
  // Form states
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  // Shop connection states
  const [showAddShopDialog, setShowAddShopDialog] = useState(false);

  const isAdmin = profile?.role_name === 'admin';
  const isSuperAdmin = profile?.role_name === 'super_admin';
  const canManageUsers = isAdmin || isSuperAdmin;

  useEffect(() => {
    if (user?.id) {
      loadUserShops();
      if (canManageUsers) {
        loadDashboardStats();
      }
    }
  }, [user?.id, canManageUsers]);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setAvatarUrl(profile?.avatar_url || '');
  }, [profile]);

  const loadUserShops = async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('shop_members')
        .select(`
          shop_id,
          role,
          shops (
            shop_id,
            shop_name,
            region,
            shop_logo
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Transform data
      const shops = (data || []).map(item => ({
        shop_id: item.shop_id,
        shop_name: (item.shops as any)?.shop_name || `Shop ${item.shop_id}`,
        region: (item.shops as any)?.region || 'VN',
        access_level: item.role,
      }));
      
      setUserShops(shops);
    } catch (error) {
      console.error('Error loading user shops:', error);
    }
  };

  const loadDashboardStats = async () => {
    try {
      // Đếm số user được quản lý (distinct user_id trong shop_members)
      const { data: usersData } = await supabase
        .from('shop_members')
        .select('user_id');
      const uniqueUsers = new Set(usersData?.map(u => u.user_id) || []);
      
      // Đếm số shop (distinct shop_id trong shops)
      const { data: shopsData } = await supabase
        .from('shops')
        .select('shop_id');
      
      // Đếm tổng phân quyền
      const { count: totalAssignments } = await supabase
        .from('shop_members')
        .select('*', { count: 'exact', head: true });
      
      // Đếm phân quyền tuần này
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const { count: recentAssignments } = await supabase
        .from('shop_members')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo.toISOString());
      
      setDashboardStats({
        managed_users_count: uniqueUsers.size,
        managed_shops_count: shopsData?.length || 0,
        total_shop_assignments: totalAssignments || 0,
        recent_assignments_count: recentAssignments || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (error) throw error;

      // Update local profile state
      await updateProfile();
      
      toast({
        title: 'Thành công',
        description: 'Đã cập nhật thông tin tài khoản',
      });
      
      setEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật thông tin',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };



  const handleShopConnectionSuccess = () => {
    loadUserShops();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'member': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAccessBadgeColor = (level: string) => {
    return level === 'admin' 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getAccessLabel = (level: string) => {
    return level === 'admin' ? 'Quản trị viên' : 'Thành viên';
  };

  return (
    <div className="space-y-6">
      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Thông tin tài khoản</span>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Chỉnh sửa
              </Button>
            ) : (
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setEditing(false);
                  setFullName(profile?.full_name || '');
                  setAvatarUrl(profile?.avatar_url || '');
                }}>
                  Hủy
                </Button>
                <Button size="sm" onClick={handleUpdateProfile} disabled={loading}>
                  {loading ? 'Đang lưu...' : 'Lưu'}
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start space-x-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <Avatar className="w-20 h-20">
                <AvatarImage src={editing ? avatarUrl : profile?.avatar_url} />
                <AvatarFallback className="text-lg font-semibold bg-orange-100 text-orange-600">
                  {(profile?.full_name || user?.email)?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Họ tên</label>
                  {editing ? (
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nhập họ tên"
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">
                      {profile?.full_name || 'Chưa cập nhật'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{user?.email}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Vai trò</label>
                  <div className="mt-1">
                    <Badge className={getRoleBadgeColor(profile?.role_name || 'member')}>
                      {profile?.role_display_name || 'Member'}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Ngày tạo</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                  </p>
                </div>

                {editing && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">URL Avatar</label>
                    <Input
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Dashboard Stats */}
      {canManageUsers && dashboardStats && (
        <Card>
          <CardHeader>
            <CardTitle>Thống kê quản lý</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{dashboardStats.managed_users_count}</div>
                <div className="text-sm text-blue-600">User được quản lý</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{dashboardStats.managed_shops_count}</div>
                <div className="text-sm text-green-600">Shop quản lý</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{dashboardStats.total_shop_assignments}</div>
                <div className="text-sm text-orange-600">Tổng phân quyền</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{dashboardStats.recent_assignments_count}</div>
                <div className="text-sm text-purple-600">Phân quyền tuần này</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Shops */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Shop có quyền truy cập ({userShops.length})</span>
            {canManageUsers && (
              <>
                <Button
                  size="sm"
                  onClick={() => setShowAddShopDialog(true)}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Kết nối Shop
                </Button>
                <ShopConnectionDialog
                  open={showAddShopDialog}
                  onOpenChange={setShowAddShopDialog}
                  onSuccess={handleShopConnectionSuccess}
                />
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {userShops.map((shop) => (
              <div key={shop.shop_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{shop.shop_name}</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {shop.region}
                      </Badge>
                      <Badge className={getAccessBadgeColor(shop.access_level)}>
                        {getAccessLabel(shop.access_level)}
                      </Badge>
                    </div>

                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">ID: {shop.shop_id}</p>
                </div>
              </div>
            ))}
            {userShops.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-gray-500">Chưa có shop nào được kết nối</p>
                <p className="text-sm text-gray-400 mt-1 mb-4">
                  {canManageUsers 
                    ? 'Kết nối shop Shopee để bắt đầu sử dụng các tính năng'
                    : 'Liên hệ Admin để được phân quyền truy cập shop'}
                </p>
                
                {canManageUsers && (
                  <>
                    <Button 
                      onClick={() => setShowAddShopDialog(true)}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Kết nối Shop
                    </Button>
                    <ShopConnectionDialog
                      open={showAddShopDialog}
                      onOpenChange={setShowAddShopDialog}
                      onSuccess={handleShopConnectionSuccess}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}