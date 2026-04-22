# Ghi Chú Thanh Toán - Project Phòng Trọ

## Tổng Quan

Hệ thống thanh toán của ứng dụng phòng trọ hỗ trợ 2 phương thức thanh toán online:

- **MOMO** - Ví điện tử MOMO
- **VNPay** - Cổng thanh toán VNPay

## Phương Thức Thanh Toán

### 1. MOMO Payment

- **Partner Code**: MOMO
- **Access Key**: F8BBA842ECF85
- **Secret Key**: K951B6PE1waDMi640xX08PD3vg6EkVlz
- **Redirect URL**: http://localhost:3000/api/check-payment-momo
- **IPN URL**: http://localhost:3000/api/check-payment-momo

### 2. VNPay Payment

- Sử dụng thư viện `vnpay` npm package
- Hỗ trợ các định dạng: ProductCode, VnpLocale, dateFormat

## API Endpoints

### Tạo Thanh Toán

```
POST /api/payments
Headers: Authorization (JWT token)
Body:
{
  "typePayment": "MOMO" | "VNPAY",
  "amountUser": number
}
```

### Kiểm Tra Thanh Toán

```
GET /api/check-payment-vnpay
GET /api/check-payment-momo
```

## Quy Trình Thanh Toán

1. **Client gửi request** tạo thanh toán với loại payment và số tiền
2. **Server tạo order** với thông tin tương ứng (MOMO/VNPay)
3. **Server trả về URL** thanh toán cho client
4. **Client redirect** đến trang thanh toán của provider
5. **Sau khi thanh toán**, provider callback về IPN URL
6. **Server xử lý** kết quả và cập nhật trạng thái user

## Models Liên Quan

### RechargeUser Model

- Lưu trữ lịch sử nạp tiền của user
- Liên kết với Users model qua userId

### Users Model

- Cập nhật số dư (balance) sau khi thanh toán thành công

## Lưu Ý Quan Trọng

### Bảo Mật

- ⚠️ **KHÔNG** commit secret keys lên Git
- Sử dụng environment variables cho production
- MOMO keys hiện tại là test keys

### Testing

- Sử dụng MOMO test environment
- VNPay có sandbox mode

### Error Handling

- Xử lý các trường hợp thanh toán thất bại
- Timeout khi chờ callback từ provider
- Validate dữ liệu đầu vào

## Cần Cải Thiện

1. **Environment Variables**: Chuyển tất cả keys sang .env
2. **Logging**: Thêm logging chi tiết cho transactions
3. **Security**: Thêm signature verification cho callbacks
4. **Database**: Thêm transaction logs table
5. **Testing**: Unit tests cho payment flows

## Dependencies

- `axios`: HTTP requests
- `crypto`: Hashing cho signatures
- `vnpay`: VNPay integration
- `uuid`: Tạo order IDs

--
TEST môi trường SANDBOX

- Thanh toán với MOMO
  http://localhost:3000/api/check-payment-momo?orderInfo=nap%20tien%20<USER_ID>&resultCode=0&amount=20000
- Thanh toán với VNPAY
  http://localhost:3000/api/check-payment-vnpay?vnp_ResponseCode=00&vnp_OrderInfo=nap%20tien%20<USER_ID>&vnp_Amount=2000000
