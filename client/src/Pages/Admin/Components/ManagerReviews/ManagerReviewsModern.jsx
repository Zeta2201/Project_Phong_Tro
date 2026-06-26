import { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { Button, Card, Descriptions, Image, message, Modal, Rate, Select, Space, Table, Tag, Tooltip } from 'antd';
import {
    EyeOutlined,
    EyeInvisibleOutlined,
    FlagOutlined,
    StarOutlined,
    StopOutlined,
} from '@ant-design/icons';
import { requestGetAdminReviews, requestUpdateReviewStatus } from '../../../../config/request';
import styles from './ManagerReviewsModern.module.scss';

const cx = classNames.bind(styles);

const statusConfig = {
    visible: { color: 'success', text: 'Hiển thị' },
    hidden: { color: 'warning', text: 'Đã ẩn' },
    reported: { color: 'error', text: 'Bị báo cáo' },
    deleted: { color: 'default', text: 'Đã xóa' },
};

const reasonText = {
    spam: 'Spam',
    inappropriate: 'Nội dung không phù hợp',
    'false-info': 'Thông tin sai sự thật',
    offensive: 'Ngôn từ xúc phạm',
};

const statusOptions = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'visible', label: 'Hiển thị' },
    { value: 'hidden', label: 'Đã ẩn' },
    { value: 'reported', label: 'Bị báo cáo' },
    { value: 'deleted', label: 'Đã xóa' },
];

const actionOptions = statusOptions.filter((item) => item.value);

function ManagerReviewsModern() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedReview, setSelectedReview] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const res = await requestGetAdminReviews({ status: statusFilter || undefined });
            setReviews(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Lấy danh sách đánh giá thất bại');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [statusFilter]);

    const stats = useMemo(
        () => ({
            total: reviews.length,
            visible: reviews.filter((item) => item.status === 'visible').length,
            reported: reviews.filter((item) => item.status === 'reported').length,
            hidden: reviews.filter((item) => item.status === 'hidden').length,
        }),
        [reviews],
    );

    const updateStatus = async (reviewId, status) => {
        try {
            await requestUpdateReviewStatus({ reviewId, status });
            message.success('Đã cập nhật trạng thái đánh giá');
            fetchReviews();
        } catch (error) {
            message.error(error.response?.data?.message || 'Cập nhật trạng thái thất bại');
        }
    };

    const openDetail = (review) => {
        setSelectedReview(review);
        setDetailOpen(true);
    };

    const statCards = [
        { label: 'Tổng đánh giá', value: stats.total, icon: <StarOutlined />, tone: 'total' },
        { label: 'Đang hiển thị', value: stats.visible, icon: <EyeOutlined />, tone: 'visible' },
        { label: 'Bị báo cáo', value: stats.reported, icon: <FlagOutlined />, tone: 'reported' },
        { label: 'Đã ẩn', value: stats.hidden, icon: <EyeInvisibleOutlined />, tone: 'hidden' },
    ];

    const columns = [
        {
            title: 'Phòng',
            dataIndex: ['roomId', 'title'],
            key: 'room',
            width: 190,
            render: (title, record) => (
                <div className={cx('roomCell')}>
                    <strong>{title || 'Không xác định'}</strong>
                    <span>{record.roomId?.location || 'Chưa có địa chỉ'}</span>
                </div>
            ),
        },
        {
            title: 'Người đánh giá',
            dataIndex: ['userId', 'fullName'],
            key: 'user',
            width: 190,
            render: (name, record) => (
                <div className={cx('userCell')}>
                    <strong>{name || 'Không xác định'}</strong>
                    <span>{record.userId?.email || '-'}</span>
                </div>
            ),
        },
        {
            title: 'Điểm',
            dataIndex: 'rating',
            key: 'rating',
            width: 130,
            render: (rating) => (
                <Space direction="vertical" size={2}>
                    <Rate disabled value={rating} />
                    <span className={cx('ratingText')}>{rating || 0}/5</span>
                </Space>
            ),
        },
        {
            title: 'Nội dung',
            dataIndex: 'content',
            key: 'content',
            width: 260,
            render: (content) => (
                <Tooltip title={content}>
                    <p className={cx('contentPreview')}>{content || 'Không có nội dung'}</p>
                </Tooltip>
            ),
        },
        {
            title: 'Báo cáo',
            dataIndex: 'reportCount',
            key: 'reportCount',
            width: 95,
            render: (count = 0) => (
                <Tag className={cx('reportTag', count > 0 && 'hasReport')} color={count >= 5 ? 'red' : count > 0 ? 'orange' : 'default'}>
                    {count}
                </Tag>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status) => <Tag color={statusConfig[status]?.color}>{statusConfig[status]?.text || status}</Tag>,
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 150,
            render: (date) => <span className={cx('dateText')}>{date ? new Date(date).toLocaleString('vi-VN') : '-'}</span>,
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 190,
            render: (_, record) => (
                <Space className={cx('actionCell')} size={8}>
                    <Button icon={<EyeOutlined />} onClick={() => openDetail(record)}>
                        Xem
                    </Button>
                    <Select
                        value={record.status}
                        className={cx('statusSelect')}
                        onChange={(status) => updateStatus(record._id, status)}
                        options={actionOptions}
                    />
                </Space>
            ),
        },
    ];

    return (
        <div className={cx('wrapper')}>
            <div className={cx('statsGrid')}>
                {statCards.map((item) => (
                    <Card className={cx('statCard', item.tone)} key={item.tone}>
                        <div className={cx('statIcon')}>{item.icon}</div>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                    </Card>
                ))}
            </div>

            <Card className={cx('tableCard')}>
                <div className={cx('toolbar')}>
                    <div>
                        <h2>Quản lý đánh giá</h2>
                        <p>Kiểm duyệt đánh giá, báo cáo vi phạm và trạng thái hiển thị.</p>
                    </div>
                    <Select value={statusFilter} onChange={setStatusFilter} className={cx('filterSelect')} options={statusOptions} />
                </div>

                <Table
                    className={cx('reviewTable')}
                    columns={columns}
                    dataSource={reviews}
                    rowKey="_id"
                    loading={loading}
                    scroll={{ x: 1240 }}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                />
            </Card>

            <Modal title="Chi tiết đánh giá" open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={900}>
                {selectedReview && (
                    <Space direction="vertical" size={16} className={cx('detailBody')}>
                        <div className={cx('detailHeader')}>
                            <div>
                                <span>Phòng</span>
                                <h3>{selectedReview.roomId?.title || 'Không xác định'}</h3>
                            </div>
                            <Tag color={statusConfig[selectedReview.status]?.color}>{statusConfig[selectedReview.status]?.text}</Tag>
                        </div>

                        <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="Người đánh giá">
                                {selectedReview.userId?.fullName || 'Không xác định'} - {selectedReview.userId?.email || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Điểm tổng">
                                <Space>
                                    <Rate disabled value={selectedReview.rating} />
                                    <strong>{selectedReview.rating || 0}/5</strong>
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Điểm chi tiết">
                                Vệ sinh: {selectedReview.cleanlinessRating}/5, An ninh: {selectedReview.securityRating}/5, Vị trí:{' '}
                                {selectedReview.locationRating}/5, Giá: {selectedReview.priceRating}/5
                            </Descriptions.Item>
                            <Descriptions.Item label="Nội dung">{selectedReview.content || '-'}</Descriptions.Item>
                        </Descriptions>

                        {selectedReview.images?.length > 0 && (
                            <Image.PreviewGroup>
                                <div className={cx('imageGrid')}>
                                    {selectedReview.images.map((image) => (
                                        <Image key={image} src={image} width={128} height={92} className={cx('reviewImage')} />
                                    ))}
                                </div>
                            </Image.PreviewGroup>
                        )}

                        <Card
                            className={cx('reportCard')}
                            title={
                                <Space>
                                    <FlagOutlined />
                                    Báo cáo ({selectedReview.reportCount || 0})
                                </Space>
                            }
                            size="small"
                        >
                            {selectedReview.reports?.length > 0 ? (
                                <Space direction="vertical" className={cx('reportList')}>
                                    {selectedReview.reports.map((report) => (
                                        <Descriptions key={report._id || `${report.userId?._id}-${report.createdAt}`} bordered column={1} size="small">
                                            <Descriptions.Item label="Người báo cáo">
                                                {report.userId?.fullName || 'Không xác định'} - {report.userId?.email || '-'}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Lý do">{reasonText[report.reason] || report.reason}</Descriptions.Item>
                                            <Descriptions.Item label="Chi tiết">{report.details || '-'}</Descriptions.Item>
                                            <Descriptions.Item label="Ngày báo cáo">
                                                {report.createdAt ? new Date(report.createdAt).toLocaleString('vi-VN') : '-'}
                                            </Descriptions.Item>
                                        </Descriptions>
                                    ))}
                                </Space>
                            ) : (
                                <div className={cx('emptyReport')}>
                                    <StopOutlined />
                                    Chưa có báo cáo.
                                </div>
                            )}
                        </Card>
                    </Space>
                )}
            </Modal>
        </div>
    );
}

export default ManagerReviewsModern;
