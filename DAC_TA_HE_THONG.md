# Đặc Tả Hệ Thống Project Phòng Trọ

## 1. Tổng quan

### 1.1. Tên hệ thống
- Hệ thống web đăng tin và tìm kiếm phòng trọ `Project_PhongTro`.
- Tên hiển thị trong giao diện quản trị hiện tại: `NESTFINDER`.

### 1.2. Mục tiêu
- Cung cấp nền tảng cho người dùng tìm kiếm phòng trọ, căn hộ mini, căn hộ chung cư và nhà nguyên căn.
- Cho phép chủ tin đăng ký tài khoản, nạp tiền, tạo bài đăng và quản lý bài đăng cá nhân.
- Cho phép quản trị viên kiểm duyệt bài đăng, theo dõi người dùng và giám sát giao dịch.
- Tích hợp gợi ý tìm kiếm bằng AI, chatbot hỗ trợ và nhắn tin thời gian thực giữa người dùng.

### 1.3. Phạm vi
- Ứng dụng web frontend cho người dùng và quản trị viên.
- Backend API phục vụ xác thực, quản lý dữ liệu, xử lý thanh toán và realtime.
- Cơ sở dữ liệu MongoDB lưu thông tin người dùng, bài đăng, giao dịch, yêu thích, tin nhắn và OTP.

## 2. Tác nhân hệ thống

### 2.1. Khách chưa đăng nhập
- Xem danh sách bài đăng.
- Xem chi tiết bài đăng.
- Tìm kiếm bài đăng, tìm kiếm AI, xem bài đăng mới, bài đăng VIP.
- Đăng ký, đăng nhập, đăng nhập Google, quên mật khẩu.

### 2.2. Người dùng đã đăng nhập
- Cập nhật thông tin cá nhân.
- Đổi mật khẩu.
- Nạp tiền qua MoMo hoặc VNPay.
- Tạo bài đăng, xóa bài đăng, xem bài đăng cá nhân.
- Lưu bài đăng yêu thích.
- Nhắn tin với người dùng khác.
- Nhận gợi ý bài đăng theo địa chỉ cá nhân.

### 2.3. Quản trị viên
- Truy cập trang quản trị.
- Xem dashboard thống kê.
- Xem danh sách người dùng.
- Xem danh sách giao dịch nạp tiền.
- Duyệt hoặc từ chối bài đăng chờ duyệt.

## 3. Chức năng nghiệp vụ

### 3.1. Quản lý tài khoản
- Đăng ký bằng email và mật khẩu.
- Đăng nhập bằng email hoặc Google OAuth.
- Xác thực phiên bằng `JWT` lưu trong cookie.
- Tự động làm mới access token bằng `refresh token`.
- Đăng xuất.
- Quên mật khẩu bằng OTP gửi email.
- Đặt lại mật khẩu bằng OTP.

### 3.2. Quản lý hồ sơ người dùng
- Cập nhật họ tên, số điện thoại, email, địa chỉ, ảnh đại diện.
- Hiển thị số dư tài khoản.
- Hiển thị lịch sử nạp tiền của người dùng.

### 3.3. Quản lý bài đăng
- Tạo bài đăng với các thông tin:
  - Tiêu đề.
  - Mô tả.
  - Giá.
  - Diện tích.
  - Loại bất động sản.
  - Địa chỉ.
  - Ảnh.
  - Thông tin liên hệ.
  - Tùy chọn tiện ích.
  - Loại tin `normal` hoặc `vip`.
  - Ngày hết hạn.
- Khấu trừ phí đăng tin từ số dư người dùng ngay khi tạo bài.
- Đưa bài đăng về trạng thái chờ duyệt trước khi hiển thị công khai.
- Lọc bài đăng theo loại, giá, diện tích, loại tin.
- Xem bài đăng mới.
- Xem bài đăng VIP.
- Xem chi tiết bài đăng và thông tin người đăng.
- Xóa bài đăng và hoàn phí đăng tin theo dữ liệu hiện có.

### 3.4. Kiểm duyệt bài đăng
- Quản trị viên xem danh sách bài đăng theo trạng thái.
- Duyệt bài đăng để chuyển sang trạng thái hoạt động.
- Từ chối bài đăng và gửi email lý do từ chối.
- Gửi email thông báo khi bài được duyệt.

### 3.5. Thanh toán và số dư
- Tạo giao dịch nạp tiền qua `MoMo`.
- Tạo giao dịch nạp tiền qua `VNPay`.
- Cập nhật số dư người dùng sau khi thanh toán thành công.
- Lưu lịch sử giao dịch nạp tiền.
- Gửi sự kiện realtime khi nạp tiền thành công.

### 3.6. Yêu thích bài đăng
- Thêm bài đăng vào danh sách yêu thích.
- Xóa bài đăng khỏi danh sách yêu thích.
- Xem danh sách bài đăng yêu thích.
- Gửi thông báo realtime cho chủ bài khi có người thêm yêu thích.

### 3.7. Nhắn tin thời gian thực
- Tạo cuộc hội thoại giữa hai người dùng.
- Gửi tin nhắn trực tiếp.
- Xem danh sách cuộc trò chuyện.
- Đánh dấu đã đọc cho một tin nhắn hoặc toàn bộ tin nhắn.
- Hiển thị trạng thái online/offline của người dùng.

### 3.8. Tìm kiếm và AI
- Tìm kiếm bài đăng theo bộ lọc chuẩn.
- Gợi ý từ khóa tìm kiếm bằng AI.
- Tìm kiếm bài đăng bằng ngôn ngữ tự nhiên qua AI.
- Lưu và thống kê từ khóa tìm kiếm phổ biến.
- Chatbot hỗ trợ trả lời dựa trên danh sách bài đăng hiện có.

### 3.9. Gợi ý cá nhân hóa
- Gợi ý bài đăng theo khu vực trong địa chỉ của người dùng đã đăng nhập.

## 4. Yêu cầu phi chức năng

### 4.1. Hiệu năng
- Hệ thống cần phản hồi nhanh cho các thao tác đọc dữ liệu phổ biến như xem danh sách, xem chi tiết và tìm kiếm.
- Các tác vụ realtime phải truyền tin nhắn và thông báo gần thời gian thực qua `Socket.IO`.

### 4.2. Bảo mật
- Mật khẩu được băm bằng `bcrypt`.
- Phiên đăng nhập sử dụng `JWT` và `refresh token`.
- Cookie có `httpOnly` cho token quan trọng.
- Phân quyền tách biệt giữa người dùng thường và quản trị viên.

### 4.3. Sẵn sàng và tin cậy
- Hệ thống cần duy trì kết nối ổn định với MongoDB.
- Cần có khả năng xử lý lỗi ở tầng API và trả về thông báo rõ ràng.

### 4.4. Khả năng mở rộng
- Kiến trúc tách `client` và `server`, thuận lợi để mở rộng giao diện và API.
- Có thể mở rộng thêm cổng thanh toán, bộ lọc tìm kiếm và loại bài đăng.

## 5. Kiến trúc hệ thống

### 5.1. Kiến trúc tổng thể
- Mô hình `client-server`.
- Frontend là ứng dụng SPA viết bằng React.
- Backend là REST API viết bằng ExpressJS.
- Realtime dùng `Socket.IO`.
- Dữ liệu lưu trên MongoDB.
- AI dùng Google Gemini `gemini-1.5-flash`.

### 5.2. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 18, Vite, React Router, Ant Design, Sass, Axios, Socket.IO Client |
| Backend | Node.js, Express 5, Socket.IO, Multer, JWT, Bcrypt |
| Cơ sở dữ liệu | MongoDB với Mongoose |
| AI | Google Generative AI |
| Thanh toán | MoMo, VNPay |
| Email | Nodemailer |

### 5.3. Phân rã module
- `client`: giao diện người dùng và quản trị.
- `server/src/controllers`: xử lý nghiệp vụ.
- `server/src/routes`: định nghĩa endpoint.
- `server/src/models`: mô hình dữ liệu MongoDB.
- `server/src/services`: token và socket.
- `server/src/utils`: AI, email, tính phí đăng tin.

## 6. Thiết kế dữ liệu

### 6.1. Bảng/collection `user`
- `fullName`: họ tên.
- `email`: email đăng nhập.
- `password`: mật khẩu đã băm.
- `address`: địa chỉ người dùng.
- `avatar`: ảnh đại diện.
- `phone`: số điện thoại.
- `isAdmin`: cờ quản trị.
- `isActive`: trạng thái tài khoản.
- `balance`: số dư tài khoản.
- `typeLogin`: `email` hoặc `google`.
- `createdAt`, `updatedAt`: thời gian tạo và cập nhật.

### 6.2. Bảng/collection `posts`
- `title`: tiêu đề bài đăng.
- `price`: giá cho thuê.
- `description`: mô tả.
- `images`: danh sách ảnh.
- `userId`: người tạo bài.
- `category`: loại bất động sản.
- `location`: địa chỉ hiển thị.
- `phone`: số điện thoại liên hệ.
- `username`: tên người đăng.
- `area`: diện tích.
- `options`: tiện ích, thuộc tính mở rộng.
- `status`: trạng thái bài đăng.
- `typeNews`: `vip` hoặc `normal`.
- `postingFee`: phí đăng tin.
- `endDate`: ngày hết hạn.
- `createdAt`, `updatedAt`: thời gian tạo và cập nhật.

### 6.3. Bảng/collection `rechargeuser`
- `userId`: người nạp tiền.
- `amount`: số tiền nạp.
- `typePayment`: phương thức thanh toán.
- `status`: trạng thái giao dịch.
- `createdAt`, `updatedAt`: thời gian tạo và cập nhật.

### 6.4. Bảng/collection `favourite`
- `userId`: người dùng yêu thích.
- `postId`: bài đăng được yêu thích.
- `createdAt`, `updatedAt`: thời gian tạo và cập nhật.

### 6.5. Bảng/collection `messager`
- `senderId`: người gửi.
- `receiverId`: người nhận.
- `message`: nội dung tin nhắn.
- `status`: trạng thái tin nhắn.
- `isRead`: đã đọc hay chưa.
- `createdAt`, `updatedAt`: thời gian tạo và cập nhật.

### 6.6. Bảng/collection bổ trợ
- `otp`: lưu OTP phục vụ quên mật khẩu.
- `apiKey`: lưu khóa phiên/phục vụ xác thực nội bộ.
- `keyWordSearch`: lưu từ khóa tìm kiếm phổ biến.

## 7. Đặc tả API mức cao

### 7.1. Nhóm xác thực và người dùng
- `POST /api/register`
- `POST /api/login`
- `POST /api/login-google`
- `GET /api/auth`
- `GET /api/logout`
- `GET /api/refresh-token`
- `POST /api/forgot-password`
- `POST /api/reset-password`
- `POST /api/update-user`
- `POST /api/change-password`
- `GET /api/recharge-user`

### 7.2. Nhóm quản trị
- `GET /admin`
- `GET /api/get-users`
- `GET /api/get-admin-stats`
- `GET /api/get-recharge-stats`

### 7.3. Nhóm bài đăng
- `POST /api/create-post`
- `GET /api/get-posts`
- `GET /api/get-post-by-id`
- `GET /api/get-post-by-user-id`
- `GET /api/get-new-post`
- `GET /api/get-post-vip`
- `POST /api/delete-post`
- `GET /api/get-all-posts`
- `POST /api/approve-post`
- `POST /api/reject-post`
- `GET /api/post-suggest`

### 7.4. Nhóm thanh toán
- `POST /api/payments`
- `GET /api/check-payment-vnpay`
- `GET /api/check-payment-momo`

### 7.5. Nhóm yêu thích
- `POST /api/create-favourite`
- `POST /api/delete-favourite`
- `GET /api/get-favourite`

### 7.6. Nhóm nhắn tin
- `POST /api/create-message`
- `GET /api/get-messages`
- `GET /api/get-messages-by-user-id`
- `POST /api/mark-message-read`
- `POST /api/mark-all-messages-read`

### 7.7. Nhóm AI và tìm kiếm
- `POST /chat`
- `GET /ai-search`
- `POST /api/add-search-keyword`
- `GET /api/get-search-keyword`
- `GET /api/search`

### 7.8. Nhóm upload
- `POST /api/upload-images`
- `POST /api/upload-image`

## 8. Giao diện và màn hình chính

### 8.1. Phía người dùng
- Trang chủ.
- Trang chi tiết bài đăng.
- Trang đăng nhập.
- Trang đăng ký.
- Trang quên mật khẩu.
- Trang tìm kiếm AI.
- Trang liên hệ.
- Trang điều khoản.
- Trang tin yêu thích.
- Trang cá nhân.

### 8.2. Phía quản trị
- Dashboard thống kê.
- Quản lý người dùng.
- Quản lý bài đăng.
- Quản lý giao dịch nạp tiền.

## 9. Luồng xử lý chính

### 9.1. Luồng đăng ký và đăng nhập
1. Người dùng nhập thông tin đăng ký hoặc đăng nhập.
2. Backend kiểm tra dữ liệu hợp lệ.
3. Hệ thống tạo token và refresh token.
4. Token được lưu trong cookie.
5. Người dùng truy cập các chức năng cần xác thực.

### 9.2. Luồng tạo bài đăng
1. Người dùng tải ảnh lên hệ thống.
2. Người dùng nhập thông tin bài đăng.
3. Backend kiểm tra số dư và gói tin.
4. Hệ thống trừ phí đăng tin.
5. Bài đăng được tạo ở trạng thái chờ duyệt.
6. Quản trị viên duyệt hoặc từ chối bài đăng.

### 9.3. Luồng nạp tiền
1. Người dùng chọn cổng thanh toán và số tiền.
2. Backend tạo URL thanh toán.
3. Người dùng hoàn thành thanh toán trên cổng trung gian.
4. Backend nhận callback và cập nhật số dư.
5. Hệ thống lưu lịch sử giao dịch và phát sự kiện realtime.

### 9.4. Luồng nhắn tin
1. Người dùng mở cuộc trò chuyện với người đăng bài.
2. Tin nhắn được gửi qua API.
3. Backend lưu dữ liệu và phát socket tới người nhận.
4. Người nhận đọc tin nhắn và hệ thống cập nhật trạng thái đã đọc.

## 10. Tích hợp ngoài hệ thống
- Google OAuth cho đăng nhập.
- Google Gemini cho chatbot và AI search.
- MoMo Sandbox cho nạp tiền.
- VNPay Sandbox cho nạp tiền.
- SMTP/Nodemailer cho email quên mật khẩu và kiểm duyệt bài đăng.

## 11. Điều kiện triển khai

### 11.1. Backend
- Node.js.
- Biến môi trường cho:
  - `CONNECT_DB`
  - `JWT_SECRET`
  - `SECRET_CRYPTO`
  - `CLIENT_URL`
  - `GOOGLE_API_KEY`

### 11.2. Frontend
- Chạy trên Vite.
- Mặc định gọi API tại `http://localhost:3000`.

## 12. Ràng buộc và giả định hiện tại
- Hệ thống hiện dùng cookie để duy trì phiên đăng nhập.
- Dữ liệu bài đăng chỉ hiển thị công khai khi được duyệt.
- Phí đăng tin phụ thuộc vào loại tin và thời lượng đăng.
- Hệ thống đang thiết kế ưu tiên chạy môi trường local với frontend `localhost:5173` và backend `localhost:3000`.

## 13. Hướng mở rộng đề xuất
- Bổ sung phân trang và sắp xếp cho danh sách bài đăng.
- Tách cấu hình thanh toán, email và AI ra biến môi trường đầy đủ.
- Bổ sung logging, audit và rate limiting.
- Chuẩn hóa trạng thái bài đăng và trạng thái tin nhắn.
- Bổ sung test API, test giao diện và tài liệu OpenAPI.

## 14. Kết luận
- `Project_PhongTro` là hệ thống web hỗ trợ tìm kiếm và đăng tin cho thuê phòng trọ với các chức năng cốt lõi gồm xác thực, quản lý bài đăng, thanh toán, yêu thích, nhắn tin realtime và AI hỗ trợ tìm kiếm.
- Kiến trúc hiện tại phù hợp cho đồ án hoặc sản phẩm MVP, đồng thời có nền tảng để tiếp tục mở rộng theo hướng thương mại hóa.
