/**
 * Flash Sale List Page
 * Layout: Table với cột Chi tiết mở rộng
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronUp, Copy, Trash2, Eye, X } from 'lucide-react';

interface FlashSaleItem {
  item_id: number;
  model_id: number;
  item_name: string;
  model_name: string;
  original_price: number;
  flash_sale_price: number;
  stock: number;
  sold: number;
  image?: string;
}

interface FlashSale {
  flash_sale_id: number;
  timeslot_id: number;
  status: number;
  start_time: number;
  end_time: number;
  enabled_item_count: number;
  item_count: number;
  type: number;
  remindme_count: number;
  click_count: number;
}

interface ApiResponse {
  error?: string;
  message?: string;
  request_id?: string;
  response?: {
    total_count: number;
    flash_sale_list: FlashSale[];
  };
}

interface FlashSaleItemsResponse {
  error?: string;
  message?: string;
  response?: {
    item_list: FlashSaleItem[];
  };
}

interface TimeSlot {
  timeslot_id: number;
  start_time: number;
  end_time: number;
}

interface TimeSlotsResponse {
  error?: string;
  message?: string;
  response?: {
    timeslot_list: TimeSlot[];
  };
}

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: 'Đã xóa', color: 'bg-gray-100 text-gray-600' },
  1: { label: 'Bật', color: 'bg-green-100 text-green-700' },
  2: { label: 'Tắt', color: 'bg-yellow-100 text-yellow-700' },
  3: { label: 'Từ chối', color: 'bg-red-100 text-red-700' },
};

const TYPE_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'Sắp tới', color: 'bg-blue-100 text-blue-700' },
  2: { label: 'Đang chạy', color: 'bg-orange-100 text-orange-700' },
  3: { label: 'Kết thúc', color: 'bg-gray-100 text-gray-600' },
};

const FlashSaleList = () => {
  const { toast } = useToast();
  const { token, isAuthenticated, isLoading: authLoading } = useShopeeAuth();
  const [loading, setLoading] = useState(false);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filterType, setFilterType] = useState<string>('0');
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [flashSaleItems, setFlashSaleItems] = useState<Record<number, FlashSaleItem[]>>({});
  
  // Copy dialog state
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedFlashSale, setSelectedFlashSale] = useState<FlashSale | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [timeSlotsLoading, setTimeSlotsLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const limit = 20;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const fetchFlashSales = async (newOffset = 0) => {
    if (!token?.shop_id) {
      toast({
        title: 'Lỗi',
        description: 'Chưa đăng nhập Shopee.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<ApiResponse>(
        'shopee-flash-sale',
        {
          body: {
            action: 'get-flash-sale-list',
            shop_id: token.shop_id,
            type: Number(filterType),
            offset: newOffset,
            limit: limit,
          },
        }
      );

      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Lỗi', description: data.message || data.error, variant: 'destructive' });
        return;
      }

      setFlashSales(data?.response?.flash_sale_list || []);
      setTotalCount(data?.response?.total_count || 0);
      setOffset(newOffset);
      setExpandedId(null);
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchFlashSaleItems = async (flashSaleId: number) => {
    if (!token?.shop_id) return;
    
    if (flashSaleItems[flashSaleId]) {
      return; // Already loaded
    }

    setItemsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<FlashSaleItemsResponse>(
        'shopee-flash-sale',
        {
          body: {
            action: 'get-flash-sale-items',
            shop_id: token.shop_id,
            flash_sale_id: flashSaleId,
          },
        }
      );

      if (error) throw error;
      if (data?.response?.item_list) {
        setFlashSaleItems(prev => ({
          ...prev,
          [flashSaleId]: data.response!.item_list,
        }));
      }
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể tải danh sách sản phẩm', variant: 'destructive' });
    } finally {
      setItemsLoading(false);
    }
  };

  const fetchTimeSlots = async () => {
    if (!token?.shop_id) return;
    
    setTimeSlotsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<TimeSlotsResponse>(
        'shopee-flash-sale',
        {
          body: {
            action: 'get-timeslot-list',
            shop_id: token.shop_id,
          },
        }
      );

      if (error) throw error;
      if (data?.response?.timeslot_list) {
        setTimeSlots(data.response.timeslot_list);
      }
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể tải danh sách time slot', variant: 'destructive' });
    } finally {
      setTimeSlotsLoading(false);
    }
  };

  const handleToggleExpand = async (sale: FlashSale) => {
    if (expandedId === sale.flash_sale_id) {
      setExpandedId(null);
    } else {
      setExpandedId(sale.flash_sale_id);
      await fetchFlashSaleItems(sale.flash_sale_id);
    }
  };

  const handleOpenCopyDialog = async (sale: FlashSale) => {
    setSelectedFlashSale(sale);
    setCopyDialogOpen(true);
    await fetchTimeSlots();
  };

  const handleCopyFlashSale = async () => {
    if (!selectedFlashSale || !selectedTimeSlot || !token?.shop_id) return;
    
    setCopyLoading(true);
    try {
      const items = flashSaleItems[selectedFlashSale.flash_sale_id] || [];
      
      const { data, error } = await supabase.functions.invoke(
        'shopee-flash-sale',
        {
          body: {
            action: 'create-flash-sale',
            shop_id: token.shop_id,
            timeslot_id: Number(selectedTimeSlot),
            items: items.map(item => ({
              item_id: item.item_id,
              model_id: item.model_id,
              flash_sale_price: item.flash_sale_price,
              stock: item.stock,
            })),
          },
        }
      );

      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Lỗi', description: data.message || data.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Thành công', description: 'Đã copy Flash Sale sang time slot mới' });
      setCopyDialogOpen(false);
      setSelectedTimeSlot('');
      fetchFlashSales(offset);
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setCopyLoading(false);
    }
  };

  const handleOpenDeleteDialog = (sale: FlashSale) => {
    setSelectedFlashSale(sale);
    setDeleteDialogOpen(true);
  };

  const handleDeleteFlashSale = async () => {
    if (!selectedFlashSale || !token?.shop_id) return;
    
    setDeleteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'shopee-flash-sale',
        {
          body: {
            action: 'delete-flash-sale',
            shop_id: token.shop_id,
            flash_sale_id: selectedFlashSale.flash_sale_id,
          },
        }
      );

      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Lỗi', description: data.message || data.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Thành công', description: 'Đã xóa Flash Sale' });
      setDeleteDialogOpen(false);
      fetchFlashSales(offset);
    } catch (err) {
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-blue-500 hover:underline text-sm">← Quay lại</a>
            <h1 className="text-lg font-bold">Flash Sale</h1>
            {totalCount > 0 && (
              <span className="text-sm text-gray-500">
                {totalCount} chương trình • Trang {currentPage}/{totalPages}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated && token?.shop_id && (
              <span className="text-sm text-green-600">● Shop: {token.shop_id}</span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Tất cả</SelectItem>
                <SelectItem value="1">Sắp diễn ra</SelectItem>
                <SelectItem value="2">Đang diễn ra</SelectItem>
                <SelectItem value="3">Đã kết thúc</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => fetchFlashSales(offset - limit)} 
              disabled={offset === 0 || loading}
            >
              ←
            </Button>
            <span className="text-sm text-gray-500 min-w-[60px] text-center">
              {currentPage}/{totalPages || 1}
            </span>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => fetchFlashSales(offset + limit)} 
              disabled={offset + limit >= totalCount || loading}
            >
              →
            </Button>
            <Button 
              onClick={() => fetchFlashSales(0)} 
              disabled={loading || !isAuthenticated}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {loading ? 'Đang tải...' : 'Tải danh sách'}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="p-4">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[180px]">Thời gian</TableHead>
                <TableHead className="w-[100px]">Trạng thái</TableHead>
                <TableHead className="w-[80px] text-center">Sản phẩm</TableHead>
                <TableHead className="w-[70px] text-center">Clicks</TableHead>
                <TableHead className="w-[70px] text-center">Nhắc nhở</TableHead>
                <TableHead className="w-[200px] text-center">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flashSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                    {loading ? 'Đang tải...' : 'Nhấn "Tải danh sách" để bắt đầu'}
                  </TableCell>
                </TableRow>
              ) : (
                flashSales.map((sale) => (
                  <>
                    <TableRow key={sale.flash_sale_id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${TYPE_MAP[sale.type]?.color}`}>
                              {TYPE_MAP[sale.type]?.label}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${STATUS_MAP[sale.status]?.color}`}>
                              {STATUS_MAP[sale.status]?.label}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">{formatDate(sale.start_time)}</div>
                            <div className="text-xs text-gray-500">→ {formatDate(sale.end_time)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${TYPE_MAP[sale.type]?.color}`}>
                          {TYPE_MAP[sale.type]?.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{sale.enabled_item_count}</span>
                        <span className="text-gray-400">/{sale.item_count}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{sale.click_count}</TableCell>
                      <TableCell className="text-center text-sm">{sale.remindme_count}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleExpand(sale)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Chi tiết
                            {expandedId === sale.flash_sale_id ? (
                              <ChevronUp className="w-4 h-4 ml-1" />
                            ) : (
                              <ChevronDown className="w-4 h-4 ml-1" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenCopyDialog(sale)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDeleteDialog(sale)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Row - Product Details */}
                    {expandedId === sale.flash_sale_id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-orange-50 p-0">
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-4">
                                <div className="bg-white rounded-lg px-3 py-2 shadow-sm">
                                  <div className="text-xs text-gray-500">Flash Sale ID</div>
                                  <div className="font-mono text-sm font-medium">{sale.flash_sale_id}</div>
                                </div>
                                <div className="text-sm">
                                  <span className="text-gray-500">Thời gian: </span>
                                  <span className="font-medium">{formatDate(sale.start_time)} → {formatDate(sale.end_time)}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenCopyDialog(sale)}
                                  className="text-green-600 border-green-300 hover:bg-green-50"
                                >
                                  <Copy className="w-4 h-4 mr-1" />
                                  Copy sang Time Slot khác
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenDeleteDialog(sale)}
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Xóa
                                </Button>
                              </div>
                            </div>
                            
                            <div className="text-sm font-medium mb-2">
                              Sản phẩm ({sale.item_count})
                            </div>
                            
                            {itemsLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
                              </div>
                            ) : (
                              <div className="bg-white rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-gray-100">
                                      <TableHead className="w-[50%]">Sản phẩm</TableHead>
                                      <TableHead className="text-right">Giá gốc</TableHead>
                                      <TableHead className="text-right">Giá Flash Sale</TableHead>
                                      <TableHead className="text-right">Kho</TableHead>
                                      <TableHead className="text-right">Đã bán</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(flashSaleItems[sale.flash_sale_id] || []).length === 0 ? (
                                      <TableRow>
                                        <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                                          Không có sản phẩm
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      (flashSaleItems[sale.flash_sale_id] || []).map((item, idx) => (
                                        <TableRow key={`${item.item_id}-${item.model_id}-${idx}`}>
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              {item.image && (
                                                <img 
                                                  src={item.image} 
                                                  alt="" 
                                                  className="w-10 h-10 rounded object-cover"
                                                />
                                              )}
                                              <div>
                                                <div className="font-medium text-sm line-clamp-1">{item.item_name}</div>
                                                {item.model_name && (
                                                  <div className="text-xs text-gray-500">{item.model_name}</div>
                                                )}
                                                <div className="text-xs text-gray-400">ID: {item.item_id}</div>
                                              </div>
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right text-sm text-gray-500 line-through">
                                            {formatPrice(item.original_price)}
                                          </TableCell>
                                          <TableCell className="text-right text-sm font-medium text-orange-600">
                                            {formatPrice(item.flash_sale_price)}
                                          </TableCell>
                                          <TableCell className="text-right text-sm">{item.stock}</TableCell>
                                          <TableCell className="text-right text-sm">{item.sold}</TableCell>
                                        </TableRow>
                                      ))
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Copy Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Flash Sale sang Time Slot khác</DialogTitle>
            <DialogDescription>
              Chọn time slot để copy các sản phẩm từ Flash Sale này
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {selectedFlashSale && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="text-sm text-gray-500">Flash Sale hiện tại</div>
                <div className="font-medium">
                  {formatDate(selectedFlashSale.start_time)} → {formatDate(selectedFlashSale.end_time)}
                </div>
                <div className="text-sm text-gray-500">
                  {selectedFlashSale.item_count} sản phẩm
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Chọn Time Slot đích</label>
              {timeSlotsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500" />
                </div>
              ) : (
                <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn time slot..." />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot.timeslot_id} value={String(slot.timeslot_id)}>
                        {formatDate(slot.start_time)} → {formatDate(slot.end_time)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              Hủy
            </Button>
            <Button 
              onClick={handleCopyFlashSale} 
              disabled={!selectedTimeSlot || copyLoading}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {copyLoading ? 'Đang copy...' : 'Copy Flash Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa Flash Sale</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa Flash Sale này? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          
          {selectedFlashSale && (
            <div className="bg-red-50 rounded-lg p-3 my-4">
              <div className="text-sm text-red-600">Flash Sale sẽ bị xóa</div>
              <div className="font-medium">
                {formatDate(selectedFlashSale.start_time)} → {formatDate(selectedFlashSale.end_time)}
              </div>
              <div className="text-sm text-gray-500">
                ID: {selectedFlashSale.flash_sale_id} • {selectedFlashSale.item_count} sản phẩm
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Hủy
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteFlashSale} 
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Đang xóa...' : 'Xóa Flash Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlashSaleList;
