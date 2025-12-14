import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface PartnerAccount {
  id: string;
  partner_id: number;
  name: string | null;
  is_active: boolean;
}

interface ShopConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ShopConnectionDialog({ open, onOpenChange, onSuccess }: ShopConnectionDialogProps) {
  const { login: connectShop } = useShopeeAuth();
  const { toast } = useToast();
  
  const [partnerAccounts, setPartnerAccounts] = useState<PartnerAccount[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [connectingShop, setConnectingShop] = useState(false);

  useEffect(() => {
    if (open) {
      loadPartnerAccounts();
    }
  }, [open]);

  const loadPartnerAccounts = async () => {
    setLoadingPartners(true);
    try {
      console.log('Loading partner accounts for dialog...');
      const { data, error } = await supabase
        .from('partner_accounts')
        .select('id, partner_id, name, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      console.log('Partner accounts result:', { data, error });

      if (error) {
        console.error('Partner accounts error:', error);
        toast({
          title: 'Lỗi',
          description: `Không thể tải Partner Accounts: ${error.message}`,
          variant: 'destructive',
        });
        setPartnerAccounts([]);
        return;
      }

      if (data) {
        console.log('Setting partner accounts:', data);
        setPartnerAccounts(data);
        if (data.length > 0) {
          setSelectedPartnerId(data[0].id);
        }
      } else {
        console.log('No partner accounts data');
        setPartnerAccounts([]);
      }
    } catch (err) {
      console.error('Error loading partner accounts:', err);
      toast({
        title: 'Lỗi',
        description: 'Lỗi không xác định khi tải Partner Accounts',
        variant: 'destructive',
      });
      setPartnerAccounts([]);
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleConnectShop = async (partnerId?: string) => {
    setConnectingShop(true);
    try {
      await connectShop(undefined, partnerId);
      toast({
        title: 'Thành công',
        description: 'Đã kết nối shop thành công',
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error connecting shop:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể kết nối shop',
        variant: 'destructive',
      });
    } finally {
      setConnectingShop(false);
    }
  };

  const handleConnectWithPartner = () => {
    if (!selectedPartnerId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn Partner Account',
        variant: 'destructive',
      });
      return;
    }
    handleConnectShop(selectedPartnerId);
  };

  const EmptyPartnerState = () => (
    <div className="text-center py-6 space-y-4">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1221 9z" />
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-900">Chưa có Partner Account nào</h3>
        <p className="text-sm text-gray-500 mt-1">
          Bạn cần thêm Partner Account trước khi kết nối shop
        </p>
      </div>
      <div className="space-y-2">
        <Button 
          variant="outline" 
          onClick={() => {
            onOpenChange(false);
            toast({
              title: 'Hướng dẫn',
              description: 'Vui lòng vào tab "Partner Accounts" để thêm Partner Account trước',
            });
          }}
        >
          Đi tới Partner Accounts
        </Button>
        <p className="text-xs text-gray-400">
          Hoặc liên hệ admin để được hỗ trợ
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kết nối Shop Shopee</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {loadingPartners ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
              <span className="ml-2 text-gray-600">Đang tải Partner Accounts...</span>
            </div>
          ) : partnerAccounts.length === 0 ? (
            <EmptyPartnerState />
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700">Partner Account</label>
                <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Chọn Partner Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {partnerAccounts.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.name || `Partner ${partner.partner_id}`} (ID: {partner.partner_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Shop sẽ được kết nối qua Partner Account này
                </p>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Hủy
                </Button>
                <Button 
                  onClick={handleConnectWithPartner} 
                  disabled={connectingShop || !selectedPartnerId}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  {connectingShop ? 'Đang kết nối...' : 'Kết nối với Shopee'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}