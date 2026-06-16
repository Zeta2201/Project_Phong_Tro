import LegalPage from './LegalPage';

const sections = [
    {
        title: 'Thông tin chúng tôi thu thập',
        description:
            'NESTFINDER thu thập thông tin cần thiết để vận hành tài khoản, đăng tin, liên hệ chủ trọ và xử lý các giao dịch trong hệ thống.',
        items: [
            'Thông tin tài khoản như họ tên, email, số điện thoại, địa chỉ và ảnh đại diện.',
            'Thông tin bài đăng, hình ảnh phòng trọ, lịch sử giao dịch, đặt cọc và hợp đồng.',
            'Dữ liệu kỹ thuật cơ bản như thời gian đăng nhập, thiết bị, trình duyệt và hoạt động sử dụng dịch vụ.',
        ],
    },
    {
        title: 'Mục đích sử dụng dữ liệu',
        items: [
            'Xác thực người dùng, bảo vệ tài khoản và phòng chống gian lận.',
            'Hiển thị tin đăng, hỗ trợ tìm kiếm phòng trọ và kết nối người thuê với chủ trọ.',
            'Gửi thông báo liên quan đến bài đăng, giao dịch, hợp đồng và hỗ trợ khách hàng.',
        ],
    },
    {
        title: 'Chia sẻ thông tin',
        description:
            'Chúng tôi chỉ chia sẻ thông tin ở mức cần thiết cho việc vận hành dịch vụ hoặc theo yêu cầu hợp pháp từ cơ quan có thẩm quyền.',
        items: [
            'Người thuê có thể thấy thông tin liên hệ công khai của chủ trọ trong bài đăng.',
            'Các bên trong giao dịch có thể thấy thông tin cần thiết để đặt cọc, ký hợp đồng và liên hệ.',
            'Thông tin thanh toán được xử lý theo tiêu chuẩn bảo mật của đơn vị thanh toán liên quan.',
        ],
    },
    {
        title: 'Bảo mật và lưu trữ',
        items: [
            'Mật khẩu được lưu dưới dạng đã mã hóa.',
            'Chúng tôi áp dụng kiểm soát quyền truy cập để hạn chế truy cập trái phép.',
            'Dữ liệu được lưu trong thời gian cần thiết để cung cấp dịch vụ và giải quyết tranh chấp nếu có.',
        ],
    },
    {
        title: 'Quyền của người dùng',
        items: [
            'Người dùng có thể cập nhật thông tin cá nhân trong trang cá nhân.',
            'Người dùng có thể yêu cầu hỗ trợ chỉnh sửa hoặc xóa dữ liệu không còn cần thiết.',
            'Người dùng có thể liên hệ NESTFINDER khi phát hiện dữ liệu bị sai hoặc bị sử dụng không đúng mục đích.',
        ],
    },
];

function PrivacyPolicy() {
    return (
        <LegalPage
            title="Chính sách bảo mật"
            updatedAt="16/06/2026"
            intro="Chính sách này giải thích cách NESTFINDER thu thập, sử dụng, lưu trữ và bảo vệ thông tin cá nhân của người dùng."
            sections={sections}
        />
    );
}

export default PrivacyPolicy;
