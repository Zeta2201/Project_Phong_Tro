import LegalPage from './LegalPage';

const sections = [
    {
        title: 'Nguyên tắc hoạt động',
        description:
            'NESTFINDER là nền tảng kết nối người có nhu cầu thuê phòng với chủ trọ, hỗ trợ đăng tin, tìm kiếm, đặt cọc và ký hợp đồng điện tử.',
        items: [
            'Thông tin trên nền tảng cần trung thực, rõ ràng và có thể kiểm chứng.',
            'Người dùng tự chịu trách nhiệm về nội dung do mình cung cấp.',
            'NESTFINDER có quyền kiểm duyệt nội dung để bảo vệ chất lượng dịch vụ.',
        ],
    },
    {
        title: 'Trách nhiệm của chủ trọ',
        items: [
            'Cung cấp thông tin phòng trọ đúng thực tế và cập nhật tình trạng phòng kịp thời.',
            'Tôn trọng các thỏa thuận với người thuê, đặc biệt là giá thuê, tiền cọc và thời hạn thuê.',
            'Phối hợp xử lý khi có yêu cầu xác minh, báo cáo vi phạm hoặc tranh chấp.',
        ],
    },
    {
        title: 'Trách nhiệm của người thuê',
        items: [
            'Đọc kỹ thông tin phòng, chi phí và điều kiện thuê trước khi liên hệ hoặc đặt cọc.',
            'Không sử dụng thông tin trên nền tảng để lừa đảo, quấy rối hoặc gây thiệt hại cho người khác.',
            'Cung cấp thông tin chính xác khi đặt cọc, ký hợp đồng hoặc yêu cầu hỗ trợ.',
        ],
    },
    {
        title: 'Quản lý tin đăng và giao dịch',
        items: [
            'Tin đăng có thể được duyệt, từ chối, ẩn hoặc gỡ tùy theo trạng thái và mức độ tuân thủ quy định.',
            'Các giao dịch đặt cọc, xác nhận thuê và hợp đồng được ghi nhận trên hệ thống để hỗ trợ đối soát.',
            'NESTFINDER không khuyến khích giao dịch ngoài hệ thống khi chưa xác minh đầy đủ thông tin.',
        ],
    },
    {
        title: 'Giải quyết khiếu nại',
        items: [
            'Người dùng có thể gửi báo cáo hoặc liên hệ hỗ trợ khi phát hiện tin sai sự thật, lừa đảo hoặc tranh chấp.',
            'NESTFINDER sẽ xem xét dữ liệu trong hệ thống và thông tin các bên cung cấp.',
            'Tùy mức độ vi phạm, tài khoản hoặc tin đăng có thể bị hạn chế, khóa hoặc chuyển cơ quan có thẩm quyền khi cần.',
        ],
    },
];

function OperationRegulations() {
    return (
        <LegalPage
            title="Quy chế hoạt động"
            updatedAt="16/06/2026"
            intro="Quy chế này nêu nguyên tắc vận hành của NESTFINDER và trách nhiệm của các bên khi sử dụng nền tảng."
            sections={sections}
        />
    );
}

export default OperationRegulations;
