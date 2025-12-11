# BETACOM - Shopee Management Tool

Công cụ quản lý Shop Shopee hiệu quả với các tính năng tự động hóa Flash Sale, quảng cáo và theo dõi sản phẩm.

## ✨ Tính năng chính

- 🏪 **Quản lý thông tin Shop**: Xem trạng thái, thời gian ủy quyền và các tính năng shop
- 🔥 **Flash Sale Manager**: Quản lý Flash Sale và hẹn giờ tự động đăng ký
- 📊 **Quản lý Quảng cáo**: Quản lý chiến dịch và lên lịch ngân sách tự động
- 📦 **Thông tin Sản phẩm**: Tra cứu thông tin chi tiết sản phẩm
- � ***Hiệu suất Shop**: Theo dõi các chỉ số hiệu suất và đánh giá shop từ Shopee
- 👤 **Quản lý Tài khoản**: Thông tin tài khoản và cài đặt

## 🛠️ Công nghệ sử dụng

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router DOM
- **Authentication**: Supabase Auth
- **Database**: Supabase
- **API Integration**: Shopee SDK (@congminh1254/shopee-sdk)
- **Form Handling**: React Hook Form + Zod validation

## 📋 Yêu cầu hệ thống

- Node.js 18+ 
- npm/pnpm/yarn
- Tài khoản Supabase
- Shopee Partner API credentials

## 🚀 Cài đặt và chạy dự án

### 1. Clone repository

```bash
git clone <repository-url>
cd shopee-management-tool
```

### 2. Cài đặt dependencies

```bash
# Sử dụng npm
npm install

# Hoặc sử dụng pnpm (khuyến nghị)
pnpm install
```

### 3. Cấu hình môi trường

Sao chép file `.env.example` thành `.env` và điền thông tin:

```bash
cp .env.example .env
```

Cập nhật các biến môi trường trong `.env`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Shopee API Configuration
VITE_SHOPEE_PARTNER_ID=your_partner_id
VITE_SHOPEE_PARTNER_KEY=your_partner_key
VITE_SHOPEE_REDIRECT_URL=your_redirect_url
```

### 4. Cấu hình Supabase

Chạy migrations để tạo database schema:

```bash
# Cài đặt Supabase CLI (nếu chưa có)
npm install -g supabase

# Khởi tạo Supabase local (tùy chọn)
supabase start

# Chạy migrations
supabase db push
```

### 5. Chạy ứng dụng

```bash
# Development mode
npm run dev
# hoặc
pnpm dev

# Build cho production
npm run build
# hoặc
pnpm build

# Preview build
npm run preview
# hoặc
pnpm preview
```

Ứng dụng sẽ chạy tại `http://localhost:8080`

## 📁 Cấu trúc dự án

```
src/
├── components/          # React components
│   ├── panels/         # Các panel chính của ứng dụng
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
│   ├── useAuth.ts      # Authentication hook
│   └── useShopeeAuth.ts # Shopee API authentication
├── lib/                # Utility libraries
├── pages/              # Page components
├── utils/              # Utility functions
└── main.tsx           # Entry point

supabase/
├── functions/          # Edge functions
├── migrations/         # Database migrations
└── config.toml        # Supabase configuration
```

## 🔧 Scripts có sẵn

- `npm run dev` - Chạy development server
- `npm run build` - Build cho production
- `npm run build:dev` - Build với development mode
- `npm run lint` - Chạy ESLint
- `npm run preview` - Preview production build

## 🔐 Authentication Flow

1. **User Authentication**: Sử dụng Supabase Auth (email/password)
2. **Shopee Authorization**: OAuth2 flow với Shopee Partner API
3. **Token Management**: Tự động refresh và lưu trữ tokens

## 📱 Responsive Design

Ứng dụng được thiết kế responsive, hỗ trợ:
- Desktop (1024px+)
- Tablet (768px - 1023px)  
- Mobile (< 768px)

## 🚀 Deployment

### Vercel (Khuyến nghị)

1. Push code lên GitHub
2. Kết nối repository với Vercel
3. Cấu hình environment variables
4. Deploy tự động

### Netlify

1. Build project: `npm run build`
2. Upload thư mục `dist` lên Netlify
3. Cấu hình redirects cho SPA

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Tạo Pull Request

## 📄 License

Dự án này được phân phối dưới MIT License. Xem file `LICENSE` để biết thêm chi tiết.

## 📞 Hỗ trợ

Nếu bạn gặp vấn đề hoặc có câu hỏi, vui lòng:
- Tạo issue trên GitHub
- Liên hệ qua email: [email]

## 🔄 Changelog

### v0.0.0 (Current)
- ✅ Cấu hình cơ bản React + TypeScript + Vite
- ✅ Tích hợp Supabase Authentication  
- ✅ Tích hợp Shopee SDK
- ✅ UI cơ bản với shadcn/ui
- ✅ Routing và navigation
- ✅ Shop Performance tracking (hiệu suất shop)
- 🚧 Flash Sale management (đang phát triển)
- 🚧 Ads management (đang phát triển)
- 🚧 Product information (đang phát triển)

---

**Made with ❤️ by BETACOM Team**