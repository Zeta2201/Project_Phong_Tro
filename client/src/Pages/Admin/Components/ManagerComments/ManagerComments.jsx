/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Input, message, Modal, Row, Select, Space, Statistic, Table, Tag } from 'antd';
import { CommentOutlined, EyeOutlined, FileSearchOutlined } from '@ant-design/icons';
import { requestGetAdminComments, requestUpdateCommentStatus } from '../../../../config/request';

const statusConfig = {
    visible: { color: 'green', text: 'Hiển thị' },
    hidden: { color: 'orange', text: 'Đã ẩn' },
    deleted: { color: 'red', text: 'Đã xóa' },
};

function ManagerComments() {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedComment, setSelectedComment] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [processStatus, setProcessStatus] = useState('visible');
    const [moderationNote, setModerationNote] = useState('');

    const fetchComments = async () => {
        setLoading(true);
        try {
            const res = await requestGetAdminComments({
                status: statusFilter || undefined,
                q: searchQuery || undefined,
            });
            setComments(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Lay danh sach binh luan that bai');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [statusFilter, searchQuery]);

    const openProcessModal = (comment) => {
        setSelectedComment(comment);
        setProcessStatus(comment.status);
        setModerationNote(comment.moderationNote || '');
        setModalOpen(true);
    };

    const closeProcessModal = () => {
        setSelectedComment(null);
        setModalOpen(false);
        setModerationNote('');
    };

    const handleUpdateComment = async () => {
        if (!selectedComment) return;

        try {
            await requestUpdateCommentStatus({
                commentId: selectedComment._id,
                status: processStatus,
                moderationNote,
            });
            message.success('Da cap nhat binh luan');
            closeProcessModal();
            fetchComments();
        } catch (error) {
            message.error(error.response?.data?.message || 'Cap nhat binh luan that bai');
        }
    };

    const columns = [
        {
            title: 'Người bình luận',
            dataIndex: ['userId', 'fullName'],
            key: 'user',
            render: (name) => name || 'Người dùng',
        },
        {
            title: 'Bài viết',
            dataIndex: ['postId', 'title'],
            key: 'post',
            render: (title) => title || 'Không xác định',
        },
        {
            title: 'Nội dung',
            dataIndex: 'content',
            key: 'content',
            ellipsis: true,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status) => <Tag color={statusConfig[status]?.color}>{statusConfig[status]?.text || status}</Tag>,
        },
        {
            title: 'Ngày gửi',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => new Date(date).toLocaleString('vi-VN'),
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_, record) => (
                <Button type="primary" icon={<EyeOutlined />} onClick={() => openProcessModal(record)}>
                    Xem / xử lý
                </Button>
            ),
        },
    ];

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={12} lg={10}>
                    <Input.Search
                        prefix={<FileSearchOutlined />}
                        placeholder="Tìm theo nội dung bình luận"
                        allowClear
                        enterButton="Tìm"
                        onSearch={setSearchQuery}
                    />
                </Col>
                <Col xs={24} md={6} lg={4}>
                    <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        style={{ width: '100%' }}
                        options={[
                            { label: 'Tất cả', value: '' },
                            { label: 'Hiển thị', value: 'visible' },
                            { label: 'Đã ẩn', value: 'hidden' },
                            { label: 'Đã xóa', value: 'deleted' },
                        ]}
                    />
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic title="Tổng bình luận" value={comments.length} prefix={<CommentOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic title="Đang hiển thị" value={comments.filter((item) => item.status === 'visible').length} />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic title="Đã ẩn" value={comments.filter((item) => item.status === 'hidden').length} />
                    </Card>
                </Col>
            </Row>

            <Card>
                <Table
                    columns={columns}
                    dataSource={comments}
                    loading={loading}
                    rowKey="_id"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1000 }}
                />
            </Card>

            <Modal
                title="Kiểm duyệt bình luận"
                open={modalOpen}
                onCancel={closeProcessModal}
                onOk={handleUpdateComment}
                okText="Lưu xử lý"
                cancelText="Đóng"
                width={720}
            >
                {selectedComment && (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="Người bình luận">
                                {selectedComment.userId?.fullName || 'Người dùng'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Email">{selectedComment.userId?.email || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Bài viết">{selectedComment.postId?.title || 'Không xác định'}</Descriptions.Item>
                            <Descriptions.Item label="Nội dung">{selectedComment.content}</Descriptions.Item>
                            <Descriptions.Item label="Ngày gửi">
                                {new Date(selectedComment.createdAt).toLocaleString('vi-VN')}
                            </Descriptions.Item>
                        </Descriptions>

                        <Select
                            value={processStatus}
                            onChange={setProcessStatus}
                            style={{ width: '100%' }}
                            options={[
                                { label: 'Hiển thị công khai', value: 'visible' },
                                { label: 'Ẩn khỏi trang chi tiết', value: 'hidden' },
                                { label: 'Đánh dấu đã xóa', value: 'deleted' },
                            ]}
                        />
                        <Input.TextArea
                            value={moderationNote}
                            onChange={(event) => setModerationNote(event.target.value)}
                            rows={4}
                            maxLength={1000}
                            placeholder="Nhập ghi chú kiểm duyệt nội bộ..."
                        />
                    </Space>
                )}
            </Modal>
        </div>
    );
}

export default ManagerComments;
