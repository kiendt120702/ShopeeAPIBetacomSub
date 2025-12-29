/**
 * Auth Page - Trang đăng nhập/đăng ký
 */

import { useState } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo_betacom.png" alt="BETACOM" className="w-12 h-12 rounded-xl object-contain" />
            <h1 className="text-3xl font-bold text-red-500">BETACOM</h1>
          </div>
          <p className="text-slate-500 text-sm">Công cụ quản lý Shop Shopee</p>
        </div>

        {/* Form */}
        {isLogin ? (
          <LoginForm onToggleMode={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onToggleMode={() => setIsLogin(true)} />
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by BETACOM × Shopee API
        </p>
      </div>
    </div>
  );
}
