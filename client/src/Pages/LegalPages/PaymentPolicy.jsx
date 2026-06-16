import LegalPage from './LegalPage';

const sections = [
    {
        title: 'Số dư tài khoản',
        description:
            'Người dùng có thể nạp tiền vào ví NESTFINDER để thanh toán phí đăng tin và các giao dịch được hỗ trợ trong hệ thống.',
        items: [
            'Số dư được cập nhật sau khi giao dịch nạp tiền thành công.',
            'Người dùng cần kiểm tra kỹ số tiền và nội dung giao dịch trước khi thanh toán.',
            'Nếu phát sinh lỗi hiển thị số dư, người dùng nên liên hệ hỗ trợ kèm mã giao dịch.',
        ],
    },
    {
        title: 'Phí đăng tin',
        items: [
            'Phí đăng tin phụ thuộc vào loại tin và thời hạn hiển thị mà người dùng chọn.',
            'Phí được trừ khỏi số dư khi người dùng gửi tin đăng.',
            'Tin chờ duyệt chưa được hiển thị công khai cho đến khi quản trị viên chấp thuận.',
        ],
    },
    {
        title: 'Hoàn tiền',
        description:
            'NESTFINDER hỗ trợ hoàn tiền trong các trường hợp hợp lý để bảo vệ quyền lợi người dùng.',
        items: [
            'Nếu bài đăng bị từ chối trong quá trình duyệt, phí đăng tin được hoàn vào số dư tài khoản.',
            'Một bài đăng chỉ được hoàn phí một lần để tránh phát sinh hoàn tiền trùng lặp.',
            'Các khoản đặt cọc được xử lý theo trạng thái giao dịch và xác nhận của các bên liên quan.',
        ],
    },
    {
        title: 'Đặt cọc và tranh chấp',
        items: [
            'Tiền đặt cọc có thể được giữ trong hệ thống trong thời gian hai bên xác nhận giao dịch.',
            'Khi có tranh chấp, quản trị viên có thể xem xét thông tin và thực hiện hoàn cọc hoặc giải ngân.',
            'Người dùng cần cung cấp bằng chứng rõ ràng khi yêu cầu hỗ trợ xử lý tranh chấp.',
        ],
    },
    {
        title: 'Liên hệ hỗ trợ thanh toán',
        description:
            'Mọi yêu cầu liên quan đến thanh toán cần gửi kèm email tài khoản, mã giao dịch, thời gian giao dịch và mô tả vấn đề.',
    },
];

function PaymentPolicy() {
    return (
        <LegalPage
            title="Chính sách thanh toán"
            updatedAt="16/06/2026"
            intro="Chính sách này mô tả cách tính phí, trừ tiền, hoàn tiền và xử lý các giao dịch thanh toán trên NESTFINDER."
            sections={sections}
        />
    );
}

export default PaymentPolicy;
