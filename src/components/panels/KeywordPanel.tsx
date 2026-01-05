import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { cn } from '@/lib/utils';
import {
  getRecommendedKeywordList,
  type SuggestedKeyword,
} from '@/lib/shopee/keyword-client';

interface ProductItem {
  item_id: number;
  item_name: string;
  image?: string;
}

interface KeywordHistory {
  id: string;
  item_id: number;
  item_name: string;
  input_keyword: string;
  keywords: SuggestedKeyword[];
  searched_at: string;
}

interface TrackedKeyword {
  id: string;
  keyword: string;
  item_id?: number;
  item_name?: string;
  is_active: boolean;
  created_at: string;
  latest_volume?: number;
  latest_date?: string;
  volume_history?: { date: string; volume: number }[];
}

type TabType = 'search' | 'tracking' | 'history';

interface KeywordPanelProps {
  initialTab?: TabType;
}

export default function KeywordPanel({ initialTab = 'search' }: KeywordPanelProps) {
  const { toast } = useToast();
  const { token, isAuthenticated } = useShopeeAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Search state
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [inputKeyword, setInputKeyword] = useState('');
  const [keywords, setKeywords] = useState<SuggestedKeyword[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  // Tracking state
  const [trackedKeywords, setTrackedKeywords] = useState<TrackedKeyword[]>([]);
  const [refreshingTracking, setRefreshingTracking] = useState(false);
  
  // History state
  const [history, setHistory] = useState<KeywordHistory[]>([]);
  
  // Sort state
  const [sortBy, setSortBy] = useState<'search_volume' | 'quality_score' | 'suggested_bid'>('search_volume');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const formatNumber = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
  const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + 'đ';

  useEffect(() => {
    if (isAuthenticated && token?.shop_id) {
      loadProducts();
      loadHistory();
      loadTrackedKeywords();
    }
  }, [isAuthenticated, token?.shop_id]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadProducts = async () => {
    if (!token?.shop_id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('apishopee_products')
        .select('item_id, item_name, image_url')
        .eq('shop_id', token.shop_id)
        .order('item_name', { ascending: true })
        .limit(500);
      
      setProducts(data?.map(p => ({ ...p, image: p.image_url })) || []);
    } catch (e) {
      console.error('Load products error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!token?.shop_id) return;
    try {
      const { data } = await supabase
        .from('apishopee_keyword_history')
        .select('*')
        .eq('shop_id', token.shop_id)
        .order('searched_at', { ascending: false })
        .limit(50);
      
      setHistory(data || []);
    } catch (e) {
      console.error('Load history error:', e);
    }
  };

  const loadTrackedKeywords = async () => {
    if (!token?.shop_id) return;
    try {
      // Load tracked keywords with latest volume
      const { data: tracked } = await supabase
        .from('apishopee_keyword_tracking')
        .select('*')
        .eq('shop_id', token.shop_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!tracked || tracked.length === 0) {
        setTrackedKeywords([]);
        return;
      }

      // Load volume history for each keyword
      const trackingIds = tracked.map(t => t.id);
      const { data: volumes } = await supabase
        .from('apishopee_keyword_volume_history')
        .select('*')
        .in('tracking_id', trackingIds)
        .order('recorded_date', { ascending: false });

      const keywordsWithVolume = tracked.map(t => {
        const history = volumes?.filter(v => v.tracking_id === t.id) || [];
        const latest = history[0];
        return {
          ...t,
          latest_volume: latest?.search_volume,
          latest_date: latest?.recorded_date,
          volume_history: history.slice(0, 7).map(h => ({
            date: h.recorded_date,
            volume: h.search_volume
          })).reverse()
        };
      });

      setTrackedKeywords(keywordsWithVolume);
    } catch (e) {
      console.error('Load tracked keywords error:', e);
    }
  };

  const searchKeywords = async () => {
    if (!token?.shop_id || !selectedProduct) {
      toast({ title: 'Vui lòng chọn sản phẩm', variant: 'destructive' });
      return;
    }

    setSearchLoading(true);
    try {
      const res = await getRecommendedKeywordList({
        shop_id: token.shop_id,
        item_id: selectedProduct.item_id,
        input_keyword: inputKeyword || undefined,
      });

      if (res.error && res.error !== '') {
        toast({ title: 'Lỗi', description: res.message, variant: 'destructive' });
        return;
      }

      const keywordList = res.response?.suggested_keyword_list || res.response?.suggested_keywords || [];
      setKeywords(keywordList);

      // Save to history
      if (keywordList.length > 0) {
        await supabase.from('apishopee_keyword_history').insert({
          shop_id: token.shop_id,
          item_id: selectedProduct.item_id,
          item_name: selectedProduct.item_name,
          input_keyword: inputKeyword || '',
          keywords: keywordList,
          searched_at: new Date().toISOString(),
        });
        loadHistory();
      }

      toast({ 
        title: 'Thành công', 
        description: `Tìm thấy ${keywordList.length} từ khóa` 
      });
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSearchLoading(false);
    }
  };

  const addToTracking = async (kw: SuggestedKeyword) => {
    if (!token?.shop_id) return;
    
    try {
      // Insert or get existing tracking
      const { data: existing } = await supabase
        .from('apishopee_keyword_tracking')
        .select('id')
        .eq('shop_id', token.shop_id)
        .eq('keyword', kw.keyword)
        .single();

      let trackingId = existing?.id;

      if (!trackingId) {
        const { data: newTracking, error } = await supabase
          .from('apishopee_keyword_tracking')
          .insert({
            shop_id: token.shop_id,
            keyword: kw.keyword,
            item_id: selectedProduct?.item_id,
            item_name: selectedProduct?.item_name,
            is_active: true
          })
          .select('id')
          .single();

        if (error) throw error;
        trackingId = newTracking?.id;
      }

      // Insert volume for today (upsert)
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('apishopee_keyword_volume_history')
        .upsert({
          tracking_id: trackingId,
          shop_id: token.shop_id,
          keyword: kw.keyword,
          search_volume: kw.search_volume,
          quality_score: kw.quality_score,
          suggested_bid: kw.suggested_bid,
          recorded_date: today
        }, { onConflict: 'tracking_id,recorded_date' });

      toast({ title: 'Đã thêm vào danh sách theo dõi', description: kw.keyword });
      loadTrackedKeywords();
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const removeFromTracking = async (id: string) => {
    if (!confirm('Xóa từ khóa này khỏi danh sách theo dõi?')) return;
    
    await supabase
      .from('apishopee_keyword_tracking')
      .update({ is_active: false })
      .eq('id', id);
    
    toast({ title: 'Đã xóa' });
    loadTrackedKeywords();
  };

  const refreshTrackingVolumes = async () => {
    if (!token?.shop_id || trackedKeywords.length === 0) return;
    
    setRefreshingTracking(true);
    toast({ title: 'Đang cập nhật...', description: 'Vui lòng đợi' });

    try {
      // Group keywords by item_id
      const keywordsByItem = trackedKeywords.reduce((acc, kw) => {
        const itemId = kw.item_id || 0;
        if (!acc[itemId]) acc[itemId] = [];
        acc[itemId].push(kw);
        return acc;
      }, {} as Record<number, TrackedKeyword[]>);

      const today = new Date().toISOString().split('T')[0];
      let updated = 0;
      let notFound = 0;

      for (const [itemId, kws] of Object.entries(keywordsByItem)) {
        if (Number(itemId) === 0) continue;

        // First, get all keywords without input_keyword filter
        const res = await getRecommendedKeywordList({
          shop_id: token.shop_id,
          item_id: Number(itemId),
        });

        const apiKeywords = res.response?.suggested_keyword_list || res.response?.suggested_keywords || [];

        for (const tracked of kws) {
          // Try to find exact match first
          let found = apiKeywords.find(k => k.keyword === tracked.keyword);
          
          // If not found, try with input_keyword parameter
          if (!found) {
            const resWithInput = await getRecommendedKeywordList({
              shop_id: token.shop_id,
              item_id: Number(itemId),
              input_keyword: tracked.keyword,
            });
            const inputKeywords = resWithInput.response?.suggested_keyword_list || resWithInput.response?.suggested_keywords || [];
            found = inputKeywords.find(k => k.keyword === tracked.keyword);
          }

          if (found) {
            await supabase
              .from('apishopee_keyword_volume_history')
              .upsert({
                tracking_id: tracked.id,
                shop_id: token.shop_id,
                keyword: tracked.keyword,
                search_volume: found.search_volume,
                quality_score: found.quality_score,
                suggested_bid: found.suggested_bid,
                recorded_date: today
              }, { onConflict: 'tracking_id,recorded_date' });
            updated++;
          } else {
            notFound++;
          }
        }
      }

      const message = notFound > 0 
        ? `Đã cập nhật ${updated} từ khóa. ${notFound} từ khóa không tìm thấy trong API.`
        : `Đã cập nhật ${updated} từ khóa`;
      toast({ title: 'Hoàn tất', description: message });
      loadTrackedKeywords();
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setRefreshingTracking(false);
    }
  };

  const deleteHistory = async (id: string) => {
    if (!confirm('Xóa mục này?')) return;
    await supabase.from('apishopee_keyword_history').delete().eq('id', id);
    toast({ title: 'Đã xóa' });
    loadHistory();
  };

  const viewHistoryKeywords = (item: KeywordHistory) => {
    setKeywords(item.keywords || []);
    setSelectedProduct({ item_id: item.item_id, item_name: item.item_name });
    setInputKeyword(item.input_keyword || '');
    setActiveTab('search');
  };

  const copyKeyword = (keyword: string) => {
    navigator.clipboard.writeText(keyword);
    toast({ title: 'Đã copy', description: keyword });
  };

  const copyAllKeywords = () => {
    const text = sortedKeywords.map(k => k.keyword).join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: 'Đã copy tất cả', description: `${sortedKeywords.length} từ khóa` });
  };

  const filteredProducts = products.filter(p => 
    p.item_name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.item_id.toString().includes(productSearch)
  );

  const sortedKeywords = [...keywords].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-50';
    if (score >= 5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getVolumeLevel = (volume: number) => {
    if (volume >= 10000) return { label: 'Rất cao', color: 'bg-green-500' };
    if (volume >= 5000) return { label: 'Cao', color: 'bg-blue-500' };
    if (volume >= 1000) return { label: 'Trung bình', color: 'bg-yellow-500' };
    return { label: 'Thấp', color: 'bg-gray-400' };
  };

  const isKeywordTracked = (keyword: string) => {
    return trackedKeywords.some(t => t.keyword === keyword);
  };

  const getVolumeTrend = (history: { date: string; volume: number }[] | undefined) => {
    if (!history || history.length < 2) return null;
    const latest = history[history.length - 1]?.volume || 0;
    const previous = history[history.length - 2]?.volume || 0;
    if (latest > previous) return { direction: 'up', diff: latest - previous };
    if (latest < previous) return { direction: 'down', diff: previous - latest };
    return { direction: 'same', diff: 0 };
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'search' && (
          <div className="p-4 space-y-4">
            {/* Search Form */}
            <div className="bg-white rounded-xl border p-4 space-y-4">
              {/* Product Selector */}
              <div className="relative">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Chọn sản phẩm <span className="text-red-500">*</span>
                </label>
                <div className="relative" onFocus={() => setShowProductDropdown(true)}>
                  <Input
                    placeholder="Tìm sản phẩm theo tên hoặc ID..."
                    value={selectedProduct ? selectedProduct.item_name : productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setSelectedProduct(null);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                  />
                  {selectedProduct && (
                    <button
                      onClick={() => { setSelectedProduct(null); setProductSearch(''); setKeywords([]); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                    >
                      <XIcon className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
                
                {/* Dropdown */}
                {showProductDropdown && !selectedProduct && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowProductDropdown(false)} />
                    <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                      {loading ? (
                        <div className="p-4 text-center text-gray-500">Đang tải...</div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          {products.length === 0 ? 'Chưa có sản phẩm. Vui lòng đồng bộ từ tab Sản phẩm.' : 'Không tìm thấy'}
                        </div>
                      ) : (
                        filteredProducts.slice(0, 20).map(p => (
                          <button
                            key={p.item_id}
                            onClick={() => { setSelectedProduct(p); setProductSearch(''); setShowProductDropdown(false); }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                          >
                            {p.image && <img src={p.image} alt="" className="w-10 h-10 rounded object-cover" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.item_name}</p>
                              <p className="text-xs text-gray-400">ID: {p.item_id}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Input Keyword */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Từ khóa tìm kiếm (tùy chọn)</label>
                <Input placeholder="Để trống để lấy tất cả từ khóa đề xuất..." value={inputKeyword} onChange={(e) => setInputKeyword(e.target.value)} />
              </div>

              <Button onClick={searchKeywords} disabled={searchLoading || !selectedProduct} className="w-full bg-orange-500 hover:bg-orange-600">
                {searchLoading ? <><LoadingIcon className="w-4 h-4 mr-2 animate-spin" />Đang tra cứu...</> : <><SearchIcon className="w-4 h-4 mr-2" />Tra cứu từ khóa</>}
              </Button>
            </div>

            {/* Results */}
            {keywords.length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-800">Kết quả: {keywords.length} từ khóa</h4>
                    {selectedProduct && <p className="text-sm text-gray-500 truncate max-w-md">{selectedProduct.item_name}</p>}
                  </div>
                  <Button variant="outline" size="sm" onClick={copyAllKeywords}><CopyIcon className="w-4 h-4 mr-1" />Copy tất cả</Button>
                </div>

                <div className="grid grid-cols-[1fr_80px_110px_100px_70px] gap-2 px-4 py-3 bg-gray-100 border-b text-xs font-medium text-gray-600">
                  <div>Từ khóa</div>
                  <button onClick={() => toggleSort('quality_score')} className={cn("text-center flex items-center justify-center gap-1", sortBy === 'quality_score' && "text-orange-600")}>Điểm CL<SortIcon active={sortBy === 'quality_score'} order={sortOrder} /></button>
                  <button onClick={() => toggleSort('search_volume')} className={cn("text-center flex items-center justify-center gap-1", sortBy === 'search_volume' && "text-orange-600")}>Lượt tìm kiếm<SortIcon active={sortBy === 'search_volume'} order={sortOrder} /></button>
                  <button onClick={() => toggleSort('suggested_bid')} className={cn("text-right flex items-center justify-end gap-1", sortBy === 'suggested_bid' && "text-orange-600")}>Giá bid<SortIcon active={sortBy === 'suggested_bid'} order={sortOrder} /></button>
                  <div className="text-center">Thao tác</div>
                </div>

                <div className="divide-y max-h-[400px] overflow-auto">
                  {sortedKeywords.map((k, idx) => {
                    const volumeLevel = getVolumeLevel(k.search_volume);
                    const tracked = isKeywordTracked(k.keyword);
                    return (
                      <div key={idx} className="grid grid-cols-[1fr_80px_110px_100px_70px] gap-2 px-4 py-3 items-center hover:bg-gray-50">
                        <div className="font-medium text-sm text-gray-800">{k.keyword}</div>
                        <div className="text-center"><span className={cn("text-xs px-2 py-1 rounded-full font-medium", getQualityColor(k.quality_score))}>{k.quality_score}/10</span></div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", volumeLevel.color)}></span>
                            <span className="text-sm font-medium">{formatNumber(k.search_volume)}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">{volumeLevel.label}</span>
                        </div>
                        <div className="text-right text-sm font-medium text-orange-600">{formatPrice(k.suggested_bid)}</div>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => copyKeyword(k.keyword)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600" title="Copy"><CopyIcon className="w-4 h-4" /></button>
                          <button onClick={() => addToTracking(k)} disabled={tracked} className={cn("p-1.5 rounded", tracked ? "text-green-500" : "text-gray-400 hover:text-orange-500 hover:bg-orange-50")} title={tracked ? "Đã theo dõi" : "Thêm vào theo dõi"}>
                            {tracked ? <CheckIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 bg-gray-50 border-t flex items-center gap-4 text-xs text-gray-500">
                  <span className="font-medium">Mức độ:</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>Rất cao</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Cao</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span>TB</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span>Thấp</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tracking' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Từ khóa đang theo dõi</h3>
              <Button variant="outline" size="sm" onClick={refreshTrackingVolumes} disabled={refreshingTracking || trackedKeywords.length === 0}>
                {refreshingTracking ? <><LoadingIcon className="w-4 h-4 mr-1 animate-spin" />Đang cập nhật...</> : <><RefreshIcon className="w-4 h-4 mr-1" />Cập nhật volume</>}
              </Button>
            </div>

            {trackedKeywords.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><StarIcon className="w-8 h-8 text-orange-500" /></div>
                <h3 className="font-semibold text-gray-800 mb-2">Chưa có từ khóa theo dõi</h3>
                <p className="text-sm text-gray-500">Tra cứu từ khóa và nhấn nút + để thêm vào danh sách theo dõi</p>
              </div>
            ) : (
              (() => {
                // Get all unique dates from all keywords
                const allDates = [...new Set(trackedKeywords.flatMap(t => t.volume_history?.map(h => h.date) || []))].sort().reverse().slice(0, 7);
                const formatDateFull = (d: string) => {
                  const date = new Date(d);
                  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                };
                
                return (
                  <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead>
                          <tr className="bg-gray-50 border-b text-xs font-medium text-gray-500">
                            <th className="text-left px-4 py-3 sticky left-0 bg-gray-50 min-w-[200px]">Từ khóa</th>
                            {allDates.map(date => (
                              <th key={date} className="text-center px-3 py-3 min-w-[100px]">
                                <div className="font-semibold text-gray-700">Dung lượng</div>
                                <div className="text-[10px] text-gray-400 font-normal">{formatDateFull(date)}</div>
                              </th>
                            ))}
                            <th className="text-center px-3 py-3 w-[50px]">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {trackedKeywords.map(t => {
                            const volumeByDate = (t.volume_history || []).reduce((acc, h) => {
                              acc[h.date] = h.volume;
                              return acc;
                            }, {} as Record<string, number>);
                            
                            return (
                              <tr key={t.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 sticky left-0 bg-white">
                                  <p className="font-medium text-sm">{t.keyword}</p>
                                </td>
                                {allDates.map((date, idx) => {
                                  const vol = volumeByDate[date];
                                  const prevVol = idx < allDates.length - 1 ? volumeByDate[allDates[idx + 1]] : undefined;
                                  const diff = vol && prevVol ? vol - prevVol : 0;
                                  return (
                                    <td key={date} className="text-center px-3 py-3">
                                      {vol ? (
                                        <div>
                                          <span className="text-sm font-medium">{formatNumber(vol)}</span>
                                          {diff !== 0 && (
                                            <div className={cn("text-[10px]", diff > 0 ? "text-green-600" : "text-red-600")}>
                                              {diff > 0 ? '+' : ''}{formatNumber(diff)}
                                            </div>
                                          )}
                                        </div>
                                      ) : <span className="text-gray-300">-</span>}
                                    </td>
                                  );
                                })}
                                <td className="text-center px-3 py-3">
                                  <button onClick={() => removeFromTracking(t.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><XIcon className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-4">
            {history.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><HistoryIcon className="w-8 h-8 text-gray-400" /></div>
                <h3 className="font-semibold text-gray-800 mb-2">Chưa có lịch sử</h3>
                <p className="text-sm text-gray-500">Lịch sử tra cứu từ khóa sẽ hiển thị ở đây</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="grid grid-cols-[1fr_120px_80px_100px] gap-2 px-4 py-3 bg-gray-50 border-b text-xs font-medium text-gray-500">
                  <div>Sản phẩm</div><div className="text-center">Từ khóa</div><div className="text-center">Kết quả</div><div className="text-right">Thời gian</div>
                </div>
                <div className="divide-y">
                  {history.map(h => (
                    <div key={h.id} className="grid grid-cols-[1fr_120px_80px_100px] gap-2 px-4 py-3 items-center hover:bg-gray-50 cursor-pointer" onClick={() => viewHistoryKeywords(h)}>
                      <div className="min-w-0"><p className="text-sm font-medium truncate">{h.item_name}</p><p className="text-xs text-gray-400">ID: {h.item_id}</p></div>
                      <div className="text-center"><span className="text-xs px-2 py-1 bg-gray-100 rounded truncate block">{h.input_keyword || '(Tất cả)'}</span></div>
                      <div className="text-center"><span className="text-sm font-medium text-orange-600">{h.keywords?.length || 0}</span></div>
                      <div className="text-right flex items-center justify-end gap-2">
                        <span className="text-xs text-gray-400">{new Date(h.searched_at).toLocaleDateString('vi-VN')}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteHistory(h.id); }} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><XIcon className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Icons
function SearchIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
}
function HistoryIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function StarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>;
}
function CopyIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
}
function XIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
}
function LoadingIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;
}
function PlusIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}
function CheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
}
function RefreshIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
}
function TrendUpIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
}
function TrendDownIcon({ className = "w-5 h-5" }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>;
}
function SortIcon({ active, order }: { active: boolean; order: 'asc' | 'desc' }) {
  return <svg className={cn("w-3 h-3", active ? "text-orange-500" : "text-gray-400")} fill="currentColor" viewBox="0 0 20 20">
    {order === 'desc' || !active ? <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    : <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />}
  </svg>;
}
