/**
 * Partner Accounts Panel - Quản lý Shopee Partner credentials
 * Chỉ admin/super_admin mới có quyền truy cập
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface PartnerAccount {
  id: string;
  partner_id: number;
  partner_key?: string;
  name: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function PartnerAccountsPanel() {
  const { user, profile } = useAuth();
  const [partners, setPartners] = useState<PartnerAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    partner_id: '',
    partner_key: '',
    name: '',
    description: '',
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  useEffect(() => {
    if (isAdmin) {
      loadPartners();
    }
  }, [isAdmin]);

  const loadPartners = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('partner_accounts')
        .select('id, partner_id, name, description, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPartners(data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const payload = {
        partner_id: Number(formData.partner_id),
        partner_key: formData.partner_key,
        name: formData.name || null,
        description: formData.description || null,
        created_by: user?.id,
      };

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('partner_accounts')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('partner_accounts')
          .insert(payload);
        if (error) throw error;
      }

      // Reset form and reload
      setFormData({ partner_id: '', partner_key: '', name: '', description: '' });
      setShowForm(false);
      setEditingId(null);
      loadPartners();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (partner: PartnerAccount) => {
    setFormData({
      partner_id: partner.partner_id.toString(),
      partner_key: '', // Không hiển thị key cũ vì bảo mật
      name: partner.name || '',
      description: partner.description || '',
    });
    setEditingId(partner.id);
    setShowForm(true);
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('partner_accounts')
        .update({ is_active: !currentActive })
        .eq('id', id);
      if (error) throw error;
      loadPartners();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa partner account này?')) return;
    
    try {
      const { error } = await supabase
        .from('partner_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      loadPartners();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          ⛔ Bạn không có quyền truy cập trang này. Chỉ Admin mới được quản lý Partner Accounts.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🔐 Partner Accounts</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({ partner_id: '', partner_key: '', name: '', description: '' });
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          {showForm ? '✕ Đóng' : '+ Thêm Partner'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          {error}
        </div>
      )}

      {/* Form thêm/sửa */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? '✏️ Sửa Partner Account' : '➕ Thêm Partner Account'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Partner ID *
                </label>
                <input
                  type="number"
                  required
                  value={formData.partner_id}
                  onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="VD: 1234567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Partner Key *
                </label>
                <input
                  type="password"
                  required={!editingId}
                  value={formData.partner_key}
                  onChange={(e) => setFormData({ ...formData, partner_key: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder={editingId ? '(để trống nếu không đổi)' : 'Nhập Partner Key'}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên hiển thị
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="VD: Partner chính, Partner test..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mô tả
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                rows={2}
                placeholder="Ghi chú thêm..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                {editingId ? '💾 Cập nhật' : '✓ Tạo mới'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách Partner Accounts */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">📋 Danh sách Partner Accounts</h2>
        </div>
        
        {partners.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Chưa có partner account nào. Click "Thêm Partner" để bắt đầu.
          </div>
        ) : (
          <div className="divide-y">
            {partners.map((partner) => (
              <div key={partner.id} className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {partner.name || `Partner ${partner.partner_id}`}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      partner.is_active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {partner.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    <span className="font-mono">ID: {partner.partner_id}</span>
                    {partner.description && (
                      <span className="ml-3">• {partner.description}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Tạo: {new Date(partner.created_at).toLocaleDateString('vi-VN')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(partner.id, partner.is_active)}
                    className={`px-3 py-1 text-sm rounded ${
                      partner.is_active
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {partner.is_active ? 'Tắt' : 'Bật'}
                  </button>
                  <button
                    onClick={() => handleEdit(partner)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Sửa
                  </button>
                  {profile?.role === 'super_admin' && (
                    <button
                      onClick={() => handleDelete(partner.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hướng dẫn */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
        <h3 className="font-semibold mb-2">💡 Hướng dẫn</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Partner ID và Partner Key lấy từ Shopee Partner Center</li>
          <li>Mỗi partner account có thể kết nối nhiều shop</li>
          <li>Khi connect shop mới, chọn partner account tương ứng</li>
          <li>Chỉ super_admin mới có quyền xóa partner account</li>
        </ul>
      </div>
    </div>
  );
}
