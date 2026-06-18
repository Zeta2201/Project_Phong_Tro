import { useEffect, useMemo, useState } from 'react';
import { Table, Card, Row, Col, Statistic, Button, Space, Tag, Modal, Descriptions, Image, Divider, Input, message } from 'antd';
import {
    FileTextOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    EyeOutlined,
    PhoneOutlined,
    EnvironmentOutlined,
    ClockCircleOutlined,
    UndoOutlined,
} from '@ant-design/icons';
import classNames from 'classnames/bind';
import styles from './ManagerPost.module.scss';
import { requestGetAllPosts, requestApprovePost, requestRejectPost, requestRestorePost } from '../../../../config/request';

const cx = classNames.bind(styles);

const categoryMap = {
    'phong-tro': 'Phòng trọ',
    'nha-nguyen-can': 'Nhà nguyên căn',
    'can-ho-chung-cu': 'Căn hộ chung cư',
    'can-ho-mini': 'Căn hộ mini',
};

const statusMap = {
    draft: { color: 'default', text: 'Nháp' },
    pending: { color: 'orange', text: 'Chờ duyệt' },
    inactive: { color: 'orange', text: 'Chờ duyệt' },
    approved: { color: 'green', text: 'Đã duyệt' },
    active: { color: 'green', text: 'Đã duyệt' },
    rejected: { color: 'red', text: 'Đã từ chối' },
    hidden: { color: 'gray', text: 'Đã ẩn' },
    rented: { color: 'blue', text: 'Đã cho thuê' },
    deleted: { color: 'default', text: 'Đã xóa' },
};

const availabilityMap = {
    available: { color: 'green', text: 'Còn phòng' },
    unavailable: { color: 'red', text: 'Hết phòng' },
    reserved: { color: 'orange', text: 'Đã giữ chỗ' },
    rented: { color: 'blue', text: 'Đã cho thuê' },
};

function ManagerPost() {
    const [selectedPost, setSelectedPost] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [approvalReason, setApprovalReason] = useState('');
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);

    const stats = useMemo(
        () => ({
            totalPosts: posts.length,
            activePosts: posts.filter((post) => ['active', 'approved'].includes(post.status) && !post.isDeleted).length,
            inactivePosts: posts.filter((post) => ['inactive', 'pending'].includes(post.status) && !post.isDeleted).length,
            deletedPosts: posts.filter((post) => post.isDeleted || post.status === 'deleted').length,
        }),
        [posts],
    );

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await requestGetAllPosts();
            setPosts(res?.metadata || []);
        } catch (error) {
            console.error('Error fetching posts:', error);
            message.error(error?.response?.data?.message || 'Lấy danh sách bài viết thất bại');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleViewDetails = (post) => {
        setSelectedPost(post);
        setIsModalVisible(true);
    };

    const handleCloseModal = () => {
        setIsModalVisible(false);
        setSelectedPost(null);
        setApprovalReason('');
    };

    const handleApprove = async (postId) => {
        try {
            await requestApprovePost({ id: postId, reason: approvalReason });
            message.success('Duyệt bài viết thành công');
            handleCloseModal();
            await fetchData();
        } catch (error) {
            console.error(error);
            message.error(error?.response?.data?.message || 'Duyệt bài viết thất bại');
        }
    };

    const handleReject = async (postId) => {
        try {
            const res = await requestRejectPost({ id: postId, reason: approvalReason });
            const refundAmount = res?.metadata?.refundAmount || 0;
            message.success(
                refundAmount > 0
                    ? `Từ chối bài viết thành công. Đã hoàn ${refundAmount.toLocaleString('vi-VN')} VND cho người đăng`
                    : 'Từ chối bài viết thành công',
            );
            handleCloseModal();
            await fetchData();
        } catch (error) {
            console.error(error);
            message.error(error?.response?.data?.message || 'Từ chối bài viết thất bại');
        }
    };

    const handleRestore = async (postId) => {
        try {
            const res = await requestRestorePost(postId);
            message.success(res?.message || 'Khôi phục bài viết thành công');
            handleCloseModal();
            await fetchData();
        } catch (error) {
            console.error(error);
            message.error(error?.response?.data?.message || 'Khôi phục bài viết thất bại');
        }
    };

    const getStatusConfig = (status) => statusMap[status] || { color: 'default', text: status };
    const getAvailabilityConfig = (status) => availabilityMap[status || 'available'] || { color: 'default', text: status };
    const isPendingPost = (post) => ['inactive', 'pending'].includes(post?.status) && !post?.isDeleted;
    const isDeletedPost = (post) => post?.isDeleted || post?.status === 'deleted';

    const columns = [
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
        },
        {
            title: 'Người đăng',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: 'Loại phòng',
            dataIndex: 'category',
            key: 'category',
            render: (category) => categoryMap[category] || category,
        },
        {
            title: 'Giá',
            dataIndex: 'price',
            key: 'price',
            render: (price) => `${Number(price || 0).toLocaleString('vi-VN')} VND`,
        },
        {
            title: 'Loại tin',
            dataIndex: 'typeNews',
            key: 'typeNews',
            render: (type) => <Tag color={type === 'vip' ? 'gold' : 'blue'}>{type === 'vip' ? 'VIP' : 'Thường'}</Tag>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const config = getStatusConfig(status);
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: 'Tình trạng phòng',
            dataIndex: 'availabilityStatus',
            key: 'availabilityStatus',
            render: (status) => {
                const config = getAvailabilityConfig(status);
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: 'Ngày đăng',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => (date ? new Date(date).toLocaleDateString('vi-VN') : '-'),
        },
        {
            title: 'Thời gian xóa',
            dataIndex: 'deletedAt',
            key: 'deletedAt',
            render: (date) => (date ? new Date(date).toLocaleString('vi-VN') : '-'),
        },
        {
            title: 'Người xóa',
            dataIndex: 'deletedBy',
            key: 'deletedBy',
            render: (deletedBy) => deletedBy?.fullName || deletedBy?.email || '-',
        },
        {
            title: 'Thao tác',
            key: 'action',
            fixed: 'right',
            render: (_, record) => (
                <Space size="middle">
                    <Button type="default" icon={<EyeOutlined />} onClick={() => handleViewDetails(record)}>
                        Chi tiết
                    </Button>
                    {isDeletedPost(record) && (
                        <Button icon={<UndoOutlined />} onClick={() => handleRestore(record._id)}>
                            Khôi phục
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const selectedPostStatus = selectedPost ? getStatusConfig(selectedPost.status) : null;

    return (
        <div className={cx('manager-post')}>
            <Row gutter={[16, 16]}>
                <Col span={6}>
                    <Card>
                        <Statistic title="Tổng số bài viết" value={stats.totalPosts} prefix={<FileTextOutlined />} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="Bài viết đã duyệt"
                            value={stats.activePosts}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="Bài viết chờ duyệt"
                            value={stats.inactivePosts}
                            prefix={<CloseCircleOutlined />}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic title="Bài viết đã xóa" value={stats.deletedPosts} prefix={<UndoOutlined />} />
                    </Card>
                </Col>
            </Row>

            <Card style={{ marginTop: 16 }}>
                <Table columns={columns} dataSource={posts} pagination={{ pageSize: 10 }} scroll={{ x: 1500 }} loading={loading} rowKey="_id" />
            </Card>

            <Modal
                title="Chi tiết bài viết"
                open={isModalVisible}
                onCancel={handleCloseModal}
                footer={[
                    <Button key="close" onClick={handleCloseModal}>
                        Đóng
                    </Button>,
                    isDeletedPost(selectedPost) && (
                        <Button key="restore" icon={<UndoOutlined />} onClick={() => handleRestore(selectedPost._id)}>
                            Khôi phục
                        </Button>
                    ),
                    isPendingPost(selectedPost) && (
                        <Space key="actions" size="middle" style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button key="approve" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApprove(selectedPost._id)}>
                                Duyệt
                            </Button>
                            <Space.Compact style={{ width: '300px' }}>
                                <Input.TextArea
                                    key="reason"
                                    placeholder="Nhập lý do từ chối nếu có"
                                    value={approvalReason}
                                    onChange={(event) => setApprovalReason(event.target.value)}
                                    autoSize={{ minRows: 1, maxRows: 3 }}
                                    style={{ borderRadius: '6px 0 0 6px' }}
                                />
                                <Button
                                    key="reject"
                                    danger
                                    icon={<CloseCircleOutlined />}
                                    onClick={() => handleReject(selectedPost._id)}
                                    style={{ borderRadius: '0 6px 6px 0' }}
                                >
                                    Từ chối
                                </Button>
                            </Space.Compact>
                        </Space>
                    ),
                ]}
                width={1000}
            >
                {selectedPost && (
                    <div>
                        <div style={{ marginBottom: 16 }}>
                            <Image.PreviewGroup>
                                <Row gutter={[8, 8]}>
                                    {selectedPost.images?.map((image, index) => (
                                        <Col span={8} key={image || index}>
                                            <Image src={image} alt={`Anh ${index + 1}`} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                                        </Col>
                                    ))}
                                </Row>
                            </Image.PreviewGroup>
                        </div>

                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="Tiêu đề" span={2}>
                                {selectedPost.title}
                            </Descriptions.Item>
                            <Descriptions.Item label="Người đăng">{selectedPost.username}</Descriptions.Item>
                            <Descriptions.Item label="Số điện thoại">
                                <Space>
                                    <PhoneOutlined />
                                    {selectedPost.phone}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Loại phòng">{categoryMap[selectedPost.category] || selectedPost.category}</Descriptions.Item>
                            <Descriptions.Item label="Giá">{Number(selectedPost.price || 0).toLocaleString('vi-VN')} VND</Descriptions.Item>
                            <Descriptions.Item label="Diện tích">{selectedPost.area}m2</Descriptions.Item>
                            <Descriptions.Item label="Địa chỉ" span={2}>
                                <Space>
                                    <EnvironmentOutlined />
                                    {selectedPost.location}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Loại tin">
                                <Tag color={selectedPost.typeNews === 'vip' ? 'gold' : 'blue'}>
                                    {selectedPost.typeNews === 'vip' ? 'VIP' : 'Thường'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Phí đăng bài">
                                <Space>
                                    {Number(selectedPost.postingFee || 0).toLocaleString('vi-VN')} VND
                                    {selectedPost.postingFeeRefunded && <Tag color="cyan">Đã hoàn tiền</Tag>}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Trạng thái">
                                <Tag color={selectedPostStatus.color}>{selectedPostStatus.text}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Tình trạng phòng">
                                {(() => {
                                    const config = getAvailabilityConfig(selectedPost.availabilityStatus);
                                    return <Tag color={config.color}>{config.text}</Tag>;
                                })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày đăng">
                                <Space>
                                    <ClockCircleOutlined />
                                    {selectedPost.createdAt ? new Date(selectedPost.createdAt).toLocaleDateString('vi-VN') : '-'}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày hết hạn">
                                <Space>
                                    <ClockCircleOutlined />
                                    {selectedPost.endDate ? new Date(selectedPost.endDate).toLocaleDateString('vi-VN') : '-'}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Thời gian xóa">
                                {selectedPost.deletedAt ? new Date(selectedPost.deletedAt).toLocaleString('vi-VN') : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Người xóa">
                                {selectedPost.deletedBy?.fullName || selectedPost.deletedBy?.email || '-'}
                            </Descriptions.Item>
                        </Descriptions>

                        <Divider orientation="left">Mô tả chi tiết</Divider>
                        <div style={{ marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: selectedPost.description }} />

                        <Divider orientation="left">Tiện ích</Divider>
                        <Row gutter={[16, 16]}>
                            {selectedPost.options?.map((option, index) => (
                                <Col span={8} key={`${option}-${index}`}>
                                    <Tag color="green">{option}</Tag>
                                </Col>
                            ))}
                        </Row>
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default ManagerPost;
