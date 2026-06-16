import LegalPage from './LegalPage';

const sections = [
    {
        title: 'Yêu cầu về nội dung tin đăng',
        items: [
            'Tiêu đề, mô tả, giá, diện tích, địa chỉ và hình ảnh phải đúng với thực tế.',
            'Không đăng tin trùng lặp, tin gây hiểu nhầm hoặc dùng hình ảnh không thuộc phòng cho thuê.',
            'Thông tin liên hệ phải hợp lệ để người thuê có thể xác minh và trao đổi.',
        ],
    },
    {
        title: 'Hình ảnh và mô tả',
        items: [
            'Hình ảnh cần rõ ràng, không chứa nội dung phản cảm hoặc thông tin lừa đảo.',
            'Mô tả không được chèn quảng cáo không liên quan, đường dẫn độc hại hoặc nội dung xúc phạm.',
            'Nên nêu rõ tiện ích, chi phí phát sinh, quy định ở trọ và tình trạng phòng.',
        ],
    },
    {
        title: 'Duyệt tin',
        description:
            'Tin đăng mới sẽ ở trạng thái chờ duyệt. Quản trị viên có quyền duyệt hoặc từ chối nếu tin không đáp ứng quy định.',
        items: [
            'Tin được duyệt sẽ hiển thị công khai theo thời hạn gói đăng.',
            'Tin bị từ chối sẽ không hiển thị công khai.',
            'Nếu tin bị từ chối trong bước duyệt, phí đăng tin sẽ được hoàn lại vào số dư tài khoản.',
        ],
    },
    {
        title: 'Các hành vi bị cấm',
        items: [
            'Đăng tin giả, mạo danh chủ trọ hoặc yêu cầu chuyển tiền ngoài quy trình an toàn.',
            'Tăng giá, thay đổi điều kiện thuê sau khi người thuê đã đặt cọc mà không có thỏa thuận.',
            'Spam, đăng nội dung vi phạm pháp luật hoặc gây ảnh hưởng đến người dùng khác.',
        ],
    },
    {
        title: 'Xử lý vi phạm',
        items: [
            'Tin vi phạm có thể bị từ chối, ẩn hoặc gỡ khỏi hệ thống.',
            'Tài khoản vi phạm nhiều lần có thể bị hạn chế đăng tin hoặc khóa tài khoản.',
            'Các giao dịch đang tranh chấp sẽ được xem xét dựa trên dữ liệu trong hệ thống.',
        ],
    },
];

function PostingRules() {
    return (
        <LegalPage
            title="Quy định đăng tin"
            updatedAt="16/06/2026"
            intro="Quy định này giúp đảm bảo tin đăng trên NESTFINDER minh bạch, chính xác và an toàn cho người thuê lẫn chủ trọ."
            sections={sections}
        />
    );
}

export default PostingRules;
