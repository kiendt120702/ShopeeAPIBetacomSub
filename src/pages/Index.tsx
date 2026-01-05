/**
 * Dashboard - Modern Single Page App with URL Routing
 * Hỗ trợ Demo Mode cho Shopee API Review
 */

import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import FlashSaleManagerPanel from '@/components/panels/FlashSaleManagerPanel';
import FlashSalePanel from '@/components/panels/FlashSalePanel';
import ScheduledPanel from '@/components/panels/ScheduledPanel';
import AdsPanel from '@/components/panels/AdsPanel';
import AdsPerformancePanel from '@/components/panels/AdsPerformancePanel';
import UserProfilePanel from '@/components/panels/UserProfilePanel';
import ProductPanel from '@/components/panels/ProductPanel';
import OrderPanel from '@/components/panels/OrderPanel';
import KeywordPanel from '@/components/panels/KeywordPanel';
import { UserProfileInfo } from '@/components/profile/UserProfileInfo';
import { UserManagementPanel } from '@/components/profile/UserManagementPanel';
import { ShopManagementPanel } from '@/components/profile/ShopManagementPanel';

import AuthPage from '@/pages/Auth';
import { cn } from '@/lib/utils';
import { ShopConnectionDialog } from '@/components/profile/ShopConnectionDialog';

type MenuId = 'dashboard' | 'flash-sale' | 'flash-sale-list' | 'flash-sale-schedule' | 'ads' | 'ads-manage' | 'ads-performance' | 'ads-budget' | 'keywords' | 'keywords-search' | 'keywords-tracking' | 'products' | 'orders' | 'profile' | 'profile-info' | 'profile-users' | 'profile-shops';

interface MenuItem {
  id: MenuId;
  path: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { 
    id: 'dashboard',
    path: '/dashboard',
    label: 'Tổng quan', 
    icon: <DashboardIcon />,
    description: 'Giới thiệu các chức năng'
  },
  { 
    id: 'flash-sale',
    path: '/flash-sale',
    label: 'Flash Sale', 
    icon: <FlameIcon />,
    description: 'Quản lý Flash Sale & Lịch hẹn giờ',
    children: [
      {
        id: 'flash-sale-list',
        path: '/flash-sale',
        label: 'Flash Sale',
        icon: <FlameIcon />,
      },
      {
        id: 'flash-sale-schedule',
        path: '/flash-sale/schedule',
        label: 'Lịch hẹn giờ',
        icon: <ClockIcon />,
      },
    ]
  },
  { 
    id: 'ads',
    path: '/ads',
    label: 'Quảng cáo', 
    icon: <AdsIcon />,
    description: 'Quản lý chiến dịch quảng cáo',
    children: [
      {
        id: 'ads-manage',
        path: '/ads',
        label: 'Quản lý',
        icon: <AdsIcon />,
      },
      {
        id: 'ads-performance',
        path: '/ads/performance',
        label: 'Hiệu suất',
        icon: <ChartIcon />,
      },
    ]
  },
  { 
    id: 'keywords',
    path: '/keywords',
    label: 'Từ khóa', 
    icon: <KeywordIcon />,
    description: 'Tra cứu dung lượng từ khóa',
    children: [
      {
        id: 'keywords-search',
        path: '/keywords',
        label: 'Tra cứu',
        icon: <SearchIcon />,
      },
      {
        id: 'keywords-tracking',
        path: '/keywords/tracking',
        label: 'Theo dõi',
        icon: <StarIcon />,
      },
    ]
  },
  { 
    id: 'products',
    path: '/products',
    label: 'Sản phẩm', 
    icon: <ProductIcon />,
    description: 'Quản lý sản phẩm'
  },
  { 
    id: 'orders',
    path: '/orders',
    label: 'Đơn hàng', 
    icon: <OrderIcon />,
    description: 'Quản lý đơn hàng'
  },
  { 
    id: 'profile',
    path: '/profile',
    label: 'Tài khoản', 
    icon: <UserIcon />,
    description: 'Thông tin tài khoản của bạn',
    children: [
      {
        id: 'profile-info',
        path: '/profile',
        label: 'Thông tin cá nhân',
        icon: <UserIcon />,
      },
      {
        id: 'profile-users',
        path: '/profile/users',
        label: 'Quản lý User',
        icon: <UsersIcon />,
      },
      {
        id: 'profile-shops',
        path: '/profile/shops',
        label: 'Quản lý Shop',
        icon: <ShopIcon />,
      },
    ]
  },
];

// Partner Accounts đã được tích hợp vào trang Profile

function DashboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}



function AdsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function KeywordIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function ProductIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function OrderIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}


// Shop Selector Component
function ShopSelector() {
  const { token, shops, selectedShopId, switchShop, isLoading } = useShopeeAuth();
  const [open, setOpen] = useState(false);
  
  const currentShop = shops.find(s => s.shop_id === selectedShopId) || 
    (token?.shop_id ? { shop_id: token.shop_id, shop_name: `Shop ${token.shop_id}`, region: 'VN' } : null);
  
  if (!currentShop) return null;
  
  const handleSwitchShop = async (shopId: number) => {
    setOpen(false);
    if (shopId !== selectedShopId) {
      await switchShop(shopId);
      // Reload page để refresh data
      window.location.reload();
    }
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isLoading || shops.length <= 1}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors",
          shops.length > 1 
            ? "bg-orange-50 border-orange-200 hover:bg-orange-100 cursor-pointer" 
            : "bg-slate-50 border-slate-200 cursor-default"
        )}
      >
        <div className="w-6 h-6 bg-orange-100 rounded flex items-center justify-center">
          <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-slate-700 max-w-[150px] truncate">
            {currentShop.shop_name || `Shop ${currentShop.shop_id}`}
          </p>
        </div>
        {shops.length > 1 && (
          <svg className={cn("w-4 h-4 text-slate-400 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      
      {/* Dropdown */}
      {open && shops.length > 1 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-20 max-h-80 overflow-auto">
            <p className="px-3 py-1 text-xs text-slate-400 font-medium">Chọn shop</p>
            {shops.map((shop) => (
              <button
                key={shop.shop_id}
                onClick={() => handleSwitchShop(shop.shop_id)}
                className={cn(
                  "w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-3",
                  shop.shop_id === selectedShopId && "bg-orange-50"
                )}
              >
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {shop.shop_name || `Shop ${shop.shop_id}`}
                  </p>
                  <p className="text-xs text-slate-400">ID: {shop.shop_id}</p>
                </div>
                {shop.shop_id === selectedShopId && (
                  <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Banner kết nối shop cho tài khoản mới
function ConnectShopBanner({ onConnect, error, isLoading, canConnect }: { onConnect: () => void; error?: string | null; isLoading?: boolean; canConnect?: boolean }) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          {canConnect ? 'Kết nối Shop Shopee' : 'Chưa có quyền truy cập Shop'}
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          {canConnect 
            ? 'Kết nối shop để quản lý Flash Sale, hẹn giờ và xem thông tin sản phẩm.'
            : 'Liên hệ Admin để được phân quyền truy cập shop.'}
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
        {canConnect && (
          <button
            onClick={onConnect}
            disabled={isLoading}
            className="px-5 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Đang kết nối...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Kết nối với Shopee
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// Dashboard Panel - Tổng quan với thống kê và thông tin chi tiết
function DashboardPanel({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { token, shops } = useShopeeAuth();
  const { user, profile } = useAuthContext();
  
  const currentShop = shops.find(s => s.shop_id === token?.shop_id);
  const shopName = currentShop?.shop_name || `Shop ${token?.shop_id}`;

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              Xin chào, {profile?.full_name || user?.email?.split('@')[0]}! 👋
            </h1>
            <p className="text-orange-100 text-sm">
              Chào mừng bạn đến với BETACOM - Công cụ quản lý Shop Shopee
            </p>
            {token?.shop_id && (
              <div className="mt-4 flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2 w-fit">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-sm font-medium">{shopName}</span>
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-white/20 rounded-2xl flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          label="Flash Sale"
          value="Quản lý"
          color="orange"
          onClick={() => onNavigate('/flash-sale')}
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Hẹn giờ"
          value="Tự động"
          color="blue"
          onClick={() => onNavigate('/flash-sale')}
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            </svg>
          }
          label="Quảng cáo"
          value="Campaigns"
          color="purple"
          onClick={() => onNavigate('/ads')}
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Ngân sách"
          value="Scheduler"
          color="green"
          onClick={() => onNavigate('/ads')}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flash Sale Section */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Flash Sale Manager</h3>
                <p className="text-xs text-slate-500">Quản lý & hẹn giờ đăng ký</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('/flash-sale')}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
            >
              Xem chi tiết
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="p-4 space-y-3">
            <FeatureItem
              icon="🔥"
              title="Xem Flash Sale"
              description="Danh sách Flash Sale đang mở đăng ký"
            />
            <FeatureItem
              icon="⏰"
              title="Hẹn giờ tự động"
              description="Đặt lịch đăng ký sản phẩm vào Flash Sale"
            />
            <FeatureItem
              icon="📊"
              title="Theo dõi kết quả"
              description="Xem trạng thái đăng ký và kết quả"
            />
          </div>
        </div>

        {/* Ads Section */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Ads Manager</h3>
                <p className="text-xs text-slate-500">Quản lý chiến dịch quảng cáo</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('/ads')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              Xem chi tiết
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="p-4 space-y-3">
            <FeatureItem
              icon="📈"
              title="Quản lý Campaigns"
              description="Xem và điều chỉnh chiến dịch quảng cáo"
            />
            <FeatureItem
              icon="💰"
              title="Lên lịch ngân sách"
              description="Tự động thay đổi ngân sách theo lịch"
            />
            <FeatureItem
              icon="⚡"
              title="Bật/Tắt nhanh"
              description="Điều khiển trạng thái chiến dịch"
            />
          </div>
        </div>
      </div>

      {/* API Integration Info */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800 mb-1">Tích hợp Shopee Open Platform API</h3>
            <p className="text-sm text-slate-600 mb-3">
              Dữ liệu được đồng bộ trực tiếp từ Shopee thông qua API chính thức, đảm bảo tính chính xác và real-time.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 bg-white rounded-full text-slate-600 border border-slate-200">
                🔐 Bảo mật OAuth 2.0
              </span>
              <span className="text-xs px-2 py-1 bg-white rounded-full text-slate-600 border border-slate-200">
                ⚡ Real-time Sync
              </span>
              <span className="text-xs px-2 py-1 bg-white rounded-full text-slate-600 border border-slate-200">
                🛡️ Official API
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  icon, 
  label, 
  value, 
  color, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  color: string;
  onClick?: () => void;
}) {
  const colorClasses: Record<string, string> = {
    orange: 'bg-orange-100 text-orange-600 group-hover:bg-orange-200',
    blue: 'bg-blue-100 text-blue-600 group-hover:bg-blue-200',
    purple: 'bg-purple-100 text-purple-600 group-hover:bg-purple-200',
    green: 'bg-green-100 text-green-600 group-hover:bg-green-200',
  };

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-sm font-semibold text-slate-800">{value}</p>
        </div>
      </div>
    </button>
  );
}

// Feature Item Component
function FeatureItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}




const Index = () => {
  // Routing
  const location = useLocation();
  const navigate = useNavigate();
  
  // Auth states
  const { user, profile, isAuthenticated: isUserAuthenticated, isLoading: isUserLoading, signOut } = useAuthContext();
  const { token, isLoading: isShopeeLoading, error: shopeeError, login: connectShopee, logout: disconnectShopee, shops } = useShopeeAuth();
  
  const canManageShops = profile?.role_name === 'admin' || profile?.role_name === 'super_admin';
  const canManageUsers = profile?.role_name === 'admin' || profile?.role_name === 'super_admin';
  
  // Filter menu items based on role
  const allMenuItems = useMemo(() => {
    return menuItems.map(item => {
      if (item.id === 'profile' && item.children) {
        return {
          ...item,
          children: item.children.filter(child => {
            // Hide "Quản lý User" for members
            if (child.id === 'profile-users' && !canManageUsers) {
              return false;
            }
            return true;
          })
        };
      }
      return item;
    });
  }, [canManageUsers]);
  const [connectingShopee, setConnectingShopee] = useState(false);

  const handleConnectShopee = async () => {
    console.log('[Index] handleConnectShopee called');
    setConnectingShopee(true);
    try {
      await connectShopee();
      console.log('[Index] connectShopee completed (should redirect)');
    } catch (err) {
      console.error('[Index] Connect error:', err);
      setConnectingShopee(false);
    }
    // Không set false ở finally vì sẽ redirect
  };
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAddShopDialog, setShowAddShopDialog] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['flash-sale', 'ads', 'keywords']);

  const isShopConnected = !!token?.shop_id;
  
  // Get active menu from URL path - check children too
  const getActiveMenu = () => {
    // Check direct match first
    const directMatch = allMenuItems.find(m => m.path === location.pathname);
    if (directMatch) return directMatch.id;
    
    // Check children
    for (const item of allMenuItems) {
      if (item.children) {
        const childMatch = item.children.find(c => c.path === location.pathname);
        if (childMatch) return childMatch.id;
      }
    }
    return 'dashboard';
  };
  
  const activeMenu = getActiveMenu();
  const currentMenuItem = allMenuItems.find(m => m.id === activeMenu) || 
    allMenuItems.flatMap(m => m.children || []).find(c => c.id === activeMenu);

  const toggleSubmenu = (menuId: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) ? prev.filter(id => id !== menuId) : [...prev, menuId]
    );
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const renderContent = () => {
    // Dashboard
    if (activeMenu === 'dashboard') {
      return <DashboardPanel onNavigate={handleNavigate} />;
    }
    
    // Profile routes
    if (activeMenu === 'profile' || activeMenu === 'profile-info') {
      return (
        <div className="p-6 max-w-6xl mx-auto">
          <UserProfileInfo />
        </div>
      );
    }
    
    if (activeMenu === 'profile-users') {
      return (
        <div className="p-6 max-w-6xl mx-auto">
          <UserManagementPanel />
        </div>
      );
    }
    
    if (activeMenu === 'profile-shops') {
      return (
        <div className="p-6 max-w-6xl mx-auto">
          <ShopManagementPanel />
        </div>
      );
    }
    
    // Các trang khác cần kết nối shop
    if (!isShopConnected) {
      return <ConnectShopBanner onConnect={handleConnectShopee} error={shopeeError} isLoading={connectingShopee} canConnect={canManageShops} />;
    }
    
    switch (activeMenu) {
      case 'flash-sale':
      case 'flash-sale-list':
        return <FlashSalePanel />;
      case 'flash-sale-schedule':
        return <ScheduledPanel />;
      case 'ads':
      case 'ads-manage':
        return <AdsPanel />;
      case 'ads-performance':
        return <AdsPerformancePanel />;
      case 'keywords':
      case 'keywords-search':
        return <KeywordPanel initialTab="search" />;
      case 'keywords-tracking':
        return <KeywordPanel initialTab="tracking" />;
      case 'products':
        return <ProductPanel />;
      case 'orders':
        return <OrderPanel />;
      default:
        return <DashboardPanel onNavigate={handleNavigate} />;
    }
  };

  // Hiển thị loading khi đang kiểm tra auth
  if (isUserLoading || isShopeeLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    );
  }

  // Chưa đăng nhập tài khoản -> hiển thị trang Auth
  if (!isUserAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
      {/* Sidebar - Fixed */}
      <aside className={cn(
        "bg-white border-r border-slate-200 flex flex-col transition-all duration-300 shadow-sm h-full",
        sidebarCollapsed ? "w-16" : "w-64"
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
          {!sidebarCollapsed && (
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
              <img src="/logo_betacom.png" alt="BETACOM" className="w-8 h-8 rounded-lg object-contain" />
              <h1 className="font-bold text-xl text-red-500">BETACOM</h1>
            </a>
          )}
          {sidebarCollapsed && (
            <a href="/" className="hover:opacity-80 transition-opacity cursor-pointer">
              <img src="/logo_betacom.png" alt="BETACOM" className="w-8 h-8 rounded-lg object-contain" />
            </a>
          )}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className={cn("w-4 h-4 text-slate-400 transition-transform", sidebarCollapsed && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>




        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {allMenuItems.map((item) => {
            const isActive = activeMenu === item.id || item.children?.some(c => c.id === activeMenu);
            const isExpanded = expandedMenus.includes(item.id);
            const hasChildren = item.children && item.children.length > 0;
            
            return (
              <div key={item.id}>
                <button
                  onClick={() => {
                    if (hasChildren) {
                      toggleSubmenu(item.id);
                      // Navigate to first child if not already on a child
                      if (!item.children?.some(c => c.id === activeMenu)) {
                        handleNavigate(item.children![0].path);
                      }
                    } else {
                      handleNavigate(item.path);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                    isActive 
                      ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25" 
                      : "text-slate-600 hover:bg-slate-50",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className={cn(
                    "transition-colors",
                    isActive ? "text-white" : "text-slate-400 group-hover:text-orange-500"
                  )}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
                      {hasChildren && (
                        <svg 
                          className={cn(
                            "w-4 h-4 transition-transform",
                            isExpanded ? "rotate-180" : "",
                            isActive ? "text-white" : "text-slate-400"
                          )} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </>
                  )}
                </button>
                
                {/* Submenu */}
                {hasChildren && isExpanded && !sidebarCollapsed && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children!.map((child) => {
                      const isChildActive = activeMenu === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => handleNavigate(child.path)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group",
                            isChildActive 
                              ? "bg-orange-50 text-orange-600 border-l-2 border-orange-500" 
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                          )}
                        >
                          <span className={cn(
                            "transition-colors",
                            isChildActive ? "text-orange-500" : "text-slate-400 group-hover:text-orange-500"
                          )}>
                            {child.icon}
                          </span>
                          <span className="text-sm">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-slate-100">
            <div className="text-center">
              <p className="text-[10px] text-slate-400">Powered by</p>
              <p className="text-xs font-medium text-slate-500">BETACOM × Shopee API</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Bar - Fixed */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">
            {currentMenuItem?.label || 'Dashboard'}
          </h2>
          
          <div className="flex items-center gap-3">
            {/* Shop Selector */}
            {isShopConnected && (
              <ShopSelector />
            )}
            
            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 rounded-full px-3 py-1.5 transition-colors"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden bg-orange-500">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xs font-bold">
                      {(profile?.full_name || user?.email)?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-sm text-slate-600 max-w-[120px] truncate">
                  {profile?.full_name || user?.email}
                </span>
                <svg className={cn("w-4 h-4 text-slate-400 transition-transform", showUserMenu && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown menu */}
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
                    <button
                      onClick={() => { handleNavigate('/profile'); setShowUserMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Thông tin tài khoản
                    </button>
                    <hr className="my-1 border-slate-100" />
                    <button
                      onClick={() => { disconnectShopee(); signOut(); setShowUserMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Đăng xuất
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-auto bg-slate-50">
          {renderContent()}
        </div>
      </main>
      </div>
      
      {/* Add Shop Dialog */}
      <ShopConnectionDialog
        open={showAddShopDialog}
        onOpenChange={setShowAddShopDialog}
        onSuccess={() => {
          setShowAddShopDialog(false);
          window.location.reload();
        }}
      />
    </div>
  );
};

export default Index;
