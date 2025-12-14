/**
 * useAuth - Hook quản lý đăng nhập/đăng ký tài khoản người dùng
 * Sử dụng Supabase Auth
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'super_admin'; // Legacy role field
  role_name: string; // New role system
  role_display_name: string;
  promoted_from_user: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    isLoading: true,
    error: null,
  });

  // Load profile khi có user
  const loadProfile = async (userId: string) => {
    const profile = await getUserProfile(userId);
    setState(prev => ({ ...prev, profile: profile as Profile | null }));
  };

  useEffect(() => {
    // Lấy session hiện tại
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isLoading: false,
      }));
      
      // Load profile nếu có user
      if (session?.user) {
        loadProfile(session.user.id);
      }
    });

    // Lắng nghe thay đổi auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          profile: session?.user ? prev.profile : null,
          isLoading: false,
        }));
        
        // Load profile nếu có user mới
        if (session?.user) {
          loadProfile(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);


  // Đăng ký tài khoản mới
  const signUp = async (email: string, password: string, fullName?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (error) throw error;

      setState(prev => ({
        ...prev,
        user: data.user,
        session: data.session,
        isLoading: false,
      }));

      return { success: true, needsConfirmation: !data.session };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đăng ký thất bại';
      setState(prev => ({ ...prev, error: message, isLoading: false }));
      return { success: false, error: message };
    }
  };

  // Đăng nhập
  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setState(prev => ({
        ...prev,
        user: data.user,
        session: data.session,
        isLoading: false,
      }));

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đăng nhập thất bại';
      setState(prev => ({ ...prev, error: message, isLoading: false }));
      return { success: false, error: message };
    }
  };

  // Đăng xuất
  const signOut = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await supabase.auth.signOut();
      setState({ user: null, session: null, profile: null, isLoading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đăng xuất thất bại';
      setState(prev => ({ ...prev, error: message, isLoading: false }));
    }
  };

  // Clear error
  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  // Update profile function
  const updateProfile = async () => {
    if (state.user) {
      await loadProfile(state.user.id);
    }
  };

  return {
    user: state.user,
    session: state.session,
    profile: state.profile,
    isAuthenticated: !!state.session,
    isLoading: state.isLoading,
    error: state.error,
    signUp,
    signIn,
    signOut,
    clearError,
    updateProfile,
  };
}


// Lưu thông tin shop Shopee vào database
export async function saveUserShop(
  userId: string,
  shopId: number,
  accessToken: string,
  refreshToken: string,
  expiredAt: number,
  merchantId?: number,
  partnerAccountId?: string
) {
  console.log('[saveUserShop] Starting...', { userId, shopId, partnerAccountId });

  // 1. Upsert vào bảng shops (token được lưu trong bảng shops)
  const { error: shopError } = await supabase
    .from('shops')
    .upsert({
      shop_id: shopId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expired_at: expiredAt,
      merchant_id: merchantId,
      partner_account_id: partnerAccountId,
      token_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'shop_id',
    });

  if (shopError) {
    console.error('[saveUserShop] Shop error:', shopError);
    throw shopError;
  }
  console.log('[saveUserShop] shops upserted successfully');

  // 2. Tạo shop member relationship
  const { error: memberError } = await supabase
    .from('shop_members')
    .upsert({
      user_id: userId,
      shop_id: shopId,
      role: 'admin', // User kết nối shop sẽ là admin của shop đó
    }, {
      onConflict: 'user_id,shop_id',
    });

  if (memberError) {
    console.error('[saveUserShop] Shop member error:', memberError);
    throw memberError;
  }
  console.log('[saveUserShop] shop_members upserted successfully');
}

// Lấy thông tin shop của user thông qua shop_members
export async function getUserShops(userId: string) {
  try {
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
      .eq('user_id', userId);

    if (error) {
      console.error('[getUserShops] Error:', error);
      return [];
    }

    // Transform data
    return (data || []).map(item => {
      const shop = item.shops as any;
      return {
        shop_id: item.shop_id,
        shop_name: shop?.shop_name || `Shop ${item.shop_id}`,
        region: shop?.region || 'VN',
        shop_logo: shop?.shop_logo,
        access_type: 'direct',
        access_level: item.role,
      };
    });
  } catch (error) {
    console.error('[getUserShops] Error:', error);
    return [];
  }
}

// Lấy profile user với role information - tự động tạo nếu chưa có
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      roles (
        name,
        display_name
      )
    `)
    .eq('id', userId)
    .single();

  if (error) {
    // Nếu không tìm thấy profile, tự động tạo mới
    if (error.code === 'PGRST116') {
      console.log('[getUserProfile] Profile not found, creating new one...');
      
      // Lấy thông tin user từ auth
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get default member role
      const { data: memberRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'member')
        .single();
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: user?.email || '',
          full_name: user?.user_metadata?.full_name || '',
          role_id: memberRole?.id,
        })
        .select(`
          *,
          roles (
            name,
            display_name
          )
        `)
        .single();

      if (insertError) {
        console.error('[getUserProfile] Error creating profile:', insertError);
        return null;
      }

      // Transform the data to include role_name and role_display_name
      return {
        ...newProfile,
        role_name: newProfile.roles?.name || 'member',
        role_display_name: newProfile.roles?.display_name || 'Member',
      };
    }
    
    console.error('[getUserProfile] Error:', error);
    return null;
  }

  // Transform the data to include role_name and role_display_name
  return {
    ...data,
    role_name: data.roles?.name || 'member',
    role_display_name: data.roles?.display_name || 'Member',
  };
}
