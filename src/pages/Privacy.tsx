import { Link } from "react-router-dom";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <div className="mb-8">
          <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Quay lại trang chủ
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Chính sách bảo mật</h1>
        <p className="text-sm text-gray-500 mb-8">Cập nhật lần cuối: 13/01/2026</p>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Giới thiệu</h2>
            <p>
              Betacom Agency ("chúng tôi") cam kết bảo vệ quyền riêng tư của bạn. Chính sách bảo mật này 
              giải thích cách chúng tôi xử lý thông tin khi bạn sử dụng dịch vụ tại ops.betacom.agency 
              cho cả Shopee và TikTok Shop.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Thông tin chúng tôi thu thập</h2>
            <p>
              Chúng tôi <strong>không thu thập</strong> bất kỳ dữ liệu cá nhân nào của bạn. Dịch vụ của chúng tôi 
              hoạt động mà không cần lưu trữ thông tin người dùng. Mọi dữ liệu từ Shopee và TikTok Shop được xử lý 
              trực tiếp thông qua API và không được lưu trữ trên hệ thống của chúng tôi.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Cách chúng tôi sử dụng thông tin</h2>
            <p>
              Vì chúng tôi không thu thập dữ liệu cá nhân, nên không có thông tin nào được sử dụng, 
              chia sẻ hoặc bán cho bên thứ ba. Dịch vụ hoạt động hoàn toàn dựa trên kết nối API trực tiếp 
              với Shopee và TikTok Shop theo phiên làm việc của bạn.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Chia sẻ thông tin</h2>
            <p>
              Chúng tôi không thu thập, lưu trữ hay chia sẻ bất kỳ thông tin cá nhân nào của bạn với bên thứ ba.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Bảo mật</h2>
            <p>
              Mặc dù chúng tôi không lưu trữ dữ liệu cá nhân, chúng tôi vẫn áp dụng các biện pháp bảo mật 
              để đảm bảo kết nối API an toàn và bảo vệ phiên làm việc của bạn.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Cookie</h2>
            <p>
              Chúng tôi có thể sử dụng cookie cần thiết để duy trì phiên đăng nhập của bạn. 
              Không có cookie theo dõi hoặc phân tích nào được sử dụng.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Quyền của bạn</h2>
            <p>
              Vì chúng tôi không thu thập dữ liệu cá nhân, bạn không cần lo lắng về việc yêu cầu 
              truy cập, chỉnh sửa hoặc xóa dữ liệu. Bạn có toàn quyền kiểm soát dữ liệu của mình.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Thay đổi chính sách</h2>
            <p>
              Chúng tôi có thể cập nhật Chính sách bảo mật này theo thời gian. Mọi thay đổi sẽ được 
              đăng trên trang này với ngày cập nhật mới.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Liên hệ</h2>
            <p>
              Nếu bạn có câu hỏi về Chính sách bảo mật này, 
              vui lòng liên hệ: <a href="mailto:kiendt120702@gmail.com" className="text-blue-600 hover:underline">kiendt120702@gmail.com</a>
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            © 2026 Betacom Agency. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
