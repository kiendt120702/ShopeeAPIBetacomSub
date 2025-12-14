import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface PartnerAccount {
  id: string;
  partner_id: number;
  partner_key?: string;
  name: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export function PartnerAccountsManagement() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [partners, setPartners] = useState<PartnerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerAccount | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    partner_id: '',
    partner_key: '',
    name: '',
    description: '',
  });

  const isAdmin = profile?.role_name === 'admin';
  const isSuperAdmin = profile?.role_name === 'super_admin';
  const canManagePartners = isAdmin || isSuperAdmin;

  useEffect(() => {
    if (canManagePartners) {
      loadPartners();
      // Test role functions
      testRoleFunctions();
    }
  }, [canManagePartners]);

  const testRoleFunctions = async () => {
    try {
      const { data: roleTest, error: roleError } = await supabase.rpc('get_user_system_role');
      const { data: adminTest, error: adminError } = await supabase.rpc('is_admin_or_super');
      const { data: superTest, error: superError } = await supabase.rpc('is_super_admin');
      
      console.log('Role function tests:');
      console.log('get_user_system_role:', roleTest, roleError);
      console.log('is_admin_or_super:', adminTest, adminError);
      console.log('is_super_admin:', superTest, superError);
    } catch (error) {
      console.error('Error testing role functions:', error);
    }
  };

  const loadPartners = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('partner_accounts')
        .select('id, partner_id, name, description, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPartners(data || []);
    } catch (error: any) {
      console.error('Error loading partners:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách Partner Accounts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ partner_id: '', partner_key: '', name: '', description: '' });
    setEditingPartner(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        partner_id: Number(formData.partner_id),
        partner_key: formData.partner_key,
        name: formData.name || null,
        description: formData.description || null,
        created_by: user?.id,
      };

      if (editingPartner) {
        // Update existing
        const updatePayload = { ...payload };
        if (!formData.partner_key) {
          delete updatePayload.partner_key; // Don't update if empty
        }
        
        const { error } = await supabase
          .from('partner_accounts')
          .update(updatePayload)
          .eq('id', editingPartner.id);
        if (error) throw error;
        
        toast({
          title: 'Thành công',
          description: 'Đã cập nhật Partner Account',
        });
      } else {
        // Create new
        const { error } = await supabase
          .from('partner_accounts')
          .insert(payload);
        if (error) throw error;
        
        toast({
          title: 'Thành công',
          description: 'Đã thêm Partner Account mới',
        });
      }

      resetForm();
      setShowAddDialog(false);
      loadPartners();
    } catch (error: any) {
      console.error('Error saving partner:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu Partner Account',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (partner: PartnerAccount) => {
    setFormData({
      partner_id: partner.partner_id.toString(),
      partner_key: '', // Don't show existing key for security
      name: partner.name || '',
      description: partner.description || '',
    });
    setEditingPartner(partner);
    setShowAddDialog(true);
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('partner_accounts')
        .update({ is_active: !currentActive })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Thành công',
        description: `Đã ${!currentActive ? 'kích hoạt' : 'tắt'} Partner Account`,
      });
      
      loadPartners();
    } catch (error: any) {
      console.error('Error toggling partner:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể thay đổi trạng thái',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      console.log('Attempting to delete partner:', id);
      console.log('User role:', profile?.role_name);
      console.log('Is super admin:', isSuperAdmin);
      
      // First check if user is actually super admin using RPC
      const { data: isSuperAdminRPC, error: roleError } = await supabase.rpc('is_super_admin');
      
      if (roleError) {
        console.error('Error checking super admin status:', roleError);
        throw new Error('Không thể xác minh quyền super admin');
      }
      
      if (!isSuperAdminRPC) {
        throw new Error('Chỉ Super Admin mới có quyền xóa Partner Account');
      }
      
      const { error } = await supabase
        .from('partner_accounts')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Delete error details:', error);
        
        // Provide more specific error messages
        if (error.code === '42501') {
          throw new Error('Không có quyền xóa Partner Account. Chỉ Super Admin mới được phép.');
        } else if (error.code === '23503') {
          throw new Error('Không thể xóa Partner Account đang được sử dụng bởi shop khác.');
        }
        
        throw error;
      }
      
      toast({
        title: 'Thành công',
        description: 'Đã xóa Partner Account',
      });
      
      loadPartners();
    } catch (error: any) {
      console.error('Error deleting partner:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa Partner Account',
        variant: 'destructive',
      });
    }
  };

  if (!canManagePartners) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Bạn không có quyền quản lý Partner Accounts</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Partner Accounts ({partners.length})</span>
            <Dialog open={showAddDialog} onOpenChange={(open) => {
              setShowAddDialog(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Thêm Partner
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingPartner ? 'Chỉnh sửa Partner Account' : 'Thêm Partner Account'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Partner ID *</label>
                      <Input
                        type="number"
                        required
                        value={formData.partner_id}
                        onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                        placeholder="VD: 1234567"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Partner Key {editingPartner ? '' : '*'}
                      </label>
                      <Input
                        type="password"
                        required={!editingPartner}
                        value={formData.partner_key}
                        onChange={(e) => setFormData({ ...formData, partner_key: e.target.value })}
                        placeholder={editingPartner ? '(để trống nếu không đổi)' : 'Nhập Partner Key'}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tên hiển thị</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="VD: Partner chính, Partner test..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Mô tả</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Ghi chú thêm..."
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {editingPartner ? 'Cập nhật' : 'Tạo mới'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowAddDialog(false)}
                    >
                      Hủy
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
            </div>
          ) : partners.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <p className="text-gray-500">Chưa có Partner Account nào</p>
              <p className="text-sm text-gray-400 mt-1">
                Thêm Partner Account để kết nối với Shopee API
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {partners.map((partner) => (
                <div key={partner.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {partner.name || `Partner ${partner.partner_id}`}
                      </h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm text-gray-500 font-mono">
                          ID: {partner.partner_id}
                        </span>
                        <Badge variant={partner.is_active ? 'default' : 'secondary'}>
                          {partner.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {partner.description && (
                        <p className="text-sm text-gray-500 mt-1">{partner.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Tạo: {new Date(partner.created_at).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={partner.is_active}
                      onCheckedChange={() => handleToggleActive(partner.id, partner.is_active)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(partner)}
                    >
                      Sửa
                    </Button>
                    {isSuperAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            Xóa
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xóa Partner Account?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Bạn có chắc muốn xóa Partner Account "{partner.name || `Partner ${partner.partner_id}`}"?
                              Hành động này không thể hoàn tác và có thể ảnh hưởng đến các shop đang sử dụng partner này.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(partner.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Xác nhận xóa
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hướng dẫn */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hướng dẫn</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          <ul className="space-y-1">
            <li>• Partner ID và Partner Key lấy từ Shopee Partner Center</li>
            <li>• Mỗi partner account có thể kết nối nhiều shop</li>
            <li>• Khi kết nối shop mới, chọn partner account tương ứng</li>
            <li>• Chỉ Super Admin mới có quyền xóa partner account</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}