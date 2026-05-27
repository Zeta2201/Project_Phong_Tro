import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Descriptions, Image, message, Modal, Rate, Row, Select, Space, Statistic, Table, Tag } from 'antd';
import { EyeOutlined, StarOutlined } from '@ant-design/icons';
import { requestGetAdminReviews, requestUpdateReviewStatus } from '../../../../config/request';

const statusConfig = {
    visible: { color: 'green', text: 'Hiển thị' },
    hidden: { color: 'orange', text: 'Đã ẩn' },
    reported: { color: 'red', text: 'Bị báo cáo' },
    deleted: { color: 'default', text: 'Đã xóa' },
};

const reasonText = {
    spam: 'Spam',
    inappropriate: 'Nội dung không phù hợp',
    'false-info': 'Thông tin sai sự thật',
    offensive: 'Ngôn từ xúc phạm',
};

function ManagerReviews() {
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

    const columns = [
        {
            title: 'Phòng',
            dataIndex: ['roomId', 'title'],
            key: 'room',
            render: (title) => title || 'Không xác định',
        },
        {
            title: 'Người đánh giá',
            dataIndex: ['userId', 'fullName'],
            key: 'user',
            render: (name, record) => (
                <Space direction="vertical" size={2}>
                    <span>{name || 'Không xác định'}</span>
                    <small>{record.userId?.email}</small>
                </Space>
            ),
        },
        {
            title: 'Điểm',
            dataIndex: 'rating',
            key: 'rating',
            render: (rating) => <Rate disabled value={rating} />,
        },
        {
            title: 'Nội dung',
            dataIndex: 'content',
            key: 'content',
            ellipsis: true,
        },
        {
            title: 'Báo cáo',
            dataIndex: 'reportCount',
            key: 'reportCount',
            render: (count) => <Tag color={count >= 5 ? 'red' : count > 0 ? 'orange' : 'default'}>{count || 0}</Tag>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status) => <Tag color={statusConfig[status]?.color}>{statusConfig[status]?.text || status}</Tag>,
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => new Date(date).toLocaleString('vi-VN'),
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_, record) => (
                <Space wrap>
                    <Button icon={<EyeOutlined />} onClick={() => openDetail(record)}>
                        Xem
                    </Button>
                    <Select
                        value={record.status}
                        style={{ width: 130 }}
                        onChange={(status) => updateStatus(record._id, status)}
                        options={[
                            { value: 'visible', label: 'Hiển thị' },
                            { value: 'hidden', label: 'Ẩn' },
                            { value: 'reported', label: 'Bị báo cáo' },
                            { value: 'deleted', label: 'Xóa mềm' },
                        ]}
                    />
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={6}>
                    <Card>
                        <Statistic title="Tổng đánh giá" value={stats.total} prefix={<StarOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} md={6}>
                    <Card>
                        <Statistic title="Đang hiển thị" value={stats.visible} valueStyle={{ color: '#16a34a' }} />
                    </Card>
                </Col>
                <Col xs={24} md={6}>
                    <Card>
                        <Statistic title="Bị báo cáo" value={stats.reported} valueStyle={{ color: '#dc2626' }} />
                    </Card>
                </Col>
                <Col xs={24} md={6}>
                    <Card>
                        <Statistic title="Đã ẩn" value={stats.hidden} valueStyle={{ color: '#f97316' }} />
                    </Card>
                </Col>
            </Row>

            <Card>
                <Space style={{ marginBottom: 16 }}>
                    <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        style={{ width: 180 }}
                        options={[
                            { value: '', label: 'Tất cả trạng thái' },
                            { value: 'visible', label: 'Hiển thị' },
                            { value: 'hidden', label: 'Đã ẩn' },
                            { value: 'reported', label: 'Bị báo cáo' },
                            { value: 'deleted', label: 'Đã xóa' },
                        ]}
                    />
                </Space>
                <Table columns={columns} dataSource={reviews} rowKey="_id" loading={loading} scroll={{ x: 1300 }} />
            </Card>

            <Modal title="Chi tiết đánh giá" open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={820}>
                {selectedReview && (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="Phòng">{selectedReview.roomId?.title || 'Không xác định'}</Descriptions.Item>
                            <Descriptions.Item label="Người đánh giá">
                                {selectedReview.userId?.fullName || 'Không xác định'} - {selectedReview.userId?.email || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Điểm tổng">
                                <Rate disabled value={selectedReview.rating} />
                            </Descriptions.Item>
                            <Descriptions.Item label="Điểm chi tiết">
                                Vệ sinh: {selectedReview.cleanlinessRating}/5, An ninh: {selectedReview.securityRating}/5, Vị trí:{' '}
                                {selectedReview.locationRating}/5, Giá: {selectedReview.priceRating}/5
                            </Descriptions.Item>
                            <Descriptions.Item label="Nội dung">{selectedReview.content}</Descriptions.Item>
                            <Descriptions.Item label="Trạng thái">
                                <Tag color={statusConfig[selectedReview.status]?.color}>{statusConfig[selectedReview.status]?.text}</Tag>
                            </Descriptions.Item>
                        </Descriptions>

                        {selectedReview.images?.length > 0 && (
                            <Image.PreviewGroup>
                                <Space wrap>
                                    {selectedReview.images.map((image) => (
                                        <Image key={image} src={image} width={120} height={90} style={{ objectFit: 'cover' }} />
                                    ))}
                                </Space>
                            </Image.PreviewGroup>
                        )}

                        <Card title={`Báo cáo (${selectedReview.reportCount || 0})`} size="small">
                            {selectedReview.reports?.length > 0 ? (
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    {selectedReview.reports.map((report) => (
                                        <Descriptions key={report._id || `${report.userId?._id}-${report.createdAt}`} bordered column={1} size="small">
                                            <Descriptions.Item label="Người báo cáo">
                                                {report.userId?.fullName || 'Không xác định'} - {report.userId?.email || '-'}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Lý do">{reasonText[report.reason] || report.reason}</Descriptions.Item>
                                            <Descriptions.Item label="Chi tiết">{report.details || '-'}</Descriptions.Item>
                                            <Descriptions.Item label="Ngày báo cáo">
                                                {new Date(report.createdAt).toLocaleString('vi-VN')}
                                            </Descriptions.Item>
                                        </Descriptions>
                                    ))}
                                </Space>
                            ) : (
                                <span>Chưa có báo cáo.</span>
                            )}
                        </Card>
                    </Space>
                )}
            </Modal>
        </div>
    );
}

export default ManagerReviews;
