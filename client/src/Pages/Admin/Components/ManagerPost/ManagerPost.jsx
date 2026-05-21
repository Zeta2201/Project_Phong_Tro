import { Table, Card, Row, Col, Statistic, Button, Space, Tag, Modal, Descriptions, Image, Divider, Input, message } from 'antd';
import {
    FileTextOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    EyeOutlined,
    PhoneOutlined,
    EnvironmentOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons';
import classNames from 'classnames/bind';
import styles from './ManagerPost.module.scss';
import { useEffect, useState } from 'react';
import { requestGetAllPosts, requestApprovePost, requestRejectPost } from '../../../../config/request';

const cx = classNames.bind(styles);

function ManagerPost() {
    const [selectedPost, setSelectedPost] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [approvalReason, setApprovalReason] = useState('');
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        totalPosts: 0,
        activePosts: 0,
        inactivePosts: 0,
        rejectedPosts: 0,
    });

    const handleViewDetails = (post) => {
        setSelectedPost(post);
        setIsModalVisible(true);
    };

    const handleCloseModal = () => {
        setIsModalVisible(false);
        setSelectedPost(null);
        setApprovalReason('');
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await requestGetAllPosts();
            if (res && res.metadata) {
                setPosts(res.metadata);

                setStats({
                    totalPosts: res.metadata.length,
                    activePosts: res.metadata.filter((post) => post.status === 'active').length,
                    inactivePosts: res.metadata.filter((post) => post.status === 'inactive').length,
                    rejectedPosts: res.metadata.filter((post) => post.status === 'rejected').length,
                });
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
            message.error(error?.response?.data?.message || 'Lay danh sach bai viet that bai');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleApprove = async (postId) => {
        try {
            await requestApprovePost({ id: postId, reason: approvalReason });
            message.success('Duyet bai viet thanh cong');
            handleCloseModal();
            await fetchData();
        } catch (error) {
            console.error(error);
            message.error(error?.response?.data?.message || 'Duyet bai viet that bai');
        }
    };

    const handleReject = async (postId) => {
        try {
            await requestRejectPost({ id: postId, reason: approvalReason });
            message.success('Tu choi bai viet thanh cong');
            handleCloseModal();
            await fetchData();
        } catch (error) {
            console.error(error);
            message.error(error?.response?.data?.message || 'Tu choi bai viet that bai');
        }
    };

    const getCategoryName = (category) => {
        const categoryMap = {
            'phong-tro': 'Phong tro',
            'nha-nguyen-can': 'Nha nguyen can',
            'can-ho-chung-cu': 'Can ho chung cu',
            'can-ho-mini': 'Can ho mini',
        };
        return categoryMap[category] || category;
    };

    const getStatusConfig = (status) => {
        return (
            {
                active: { color: 'green', text: 'Da duyet' },
                inactive: { color: 'orange', text: 'Cho duyet' },
                rejected: { color: 'red', text: 'Da tu choi' },
            }[status] || { color: 'default', text: status }
        );
    };

    const columns = [
        {
            title: 'Tieu de',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: 'Nguoi dang',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: 'Loai phong',
            dataIndex: 'category',
            key: 'category',
            render: (category) => getCategoryName(category),
        },
        {
            title: 'Gia',
            dataIndex: 'price',
            key: 'price',
            render: (price) => `${price.toLocaleString('vi-VN')} VND`,
        },
        {
            title: 'Dien tich',
            dataIndex: 'area',
            key: 'area',
            render: (area) => `${area}m²`,
        },
        {
            title: 'Dia chi',
            dataIndex: 'location',
            key: 'location',
        },
        {
            title: 'Loai tin',
            dataIndex: 'typeNews',
            key: 'typeNews',
            render: (type) => <Tag color={type === 'vip' ? 'gold' : 'blue'}>{type === 'vip' ? 'VIP' : 'Thuong'}</Tag>,
        },
        {
            title: 'Trang thai',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const config = getStatusConfig(status);
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: 'Ngay dang',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => new Date(date).toLocaleDateString('vi-VN'),
        },
        {
            title: 'Thao tac',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button type="default" icon={<EyeOutlined />} onClick={() => handleViewDetails(record)}>
                        Chi tiet
                    </Button>
                </Space>
            ),
        },
    ];

    const selectedPostStatus = selectedPost ? getStatusConfig(selectedPost.status) : null;

    return (
        <div className={cx('manager-post')}>
            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Card>
                        <Statistic title="Tong so bai viet" value={stats.totalPosts} prefix={<FileTextOutlined />} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Bai viet da duyet"
                            value={stats.activePosts}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Bai viet cho duyet"
                            value={stats.inactivePosts}
                            prefix={<CloseCircleOutlined />}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Card style={{ marginTop: 16 }}>
                <Table
                    columns={columns}
                    dataSource={posts}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1500 }}
                    loading={loading}
                    rowKey="_id"
                />
            </Card>

            <Modal
                title="Chi tiet bai viet"
                open={isModalVisible}
                onCancel={handleCloseModal}
                footer={[
                    <Button key="close" onClick={handleCloseModal}>
                        Dong
                    </Button>,
                    selectedPost?.status === 'inactive' && (
                        <Space key="actions" size="middle" style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button key="approve" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApprove(selectedPost._id)}>
                                Duyet
                            </Button>
                            <Space.Compact style={{ width: '300px' }}>
                                <Input.TextArea
                                    key="reason"
                                    placeholder="Nhap ly do tu choi"
                                    value={approvalReason}
                                    onChange={(e) => setApprovalReason(e.target.value)}
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
                                    Tu choi
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
                                        <Col span={8} key={index}>
                                            <Image
                                                src={image}
                                                alt={`Anh ${index + 1}`}
                                                style={{ width: '100%', height: 200, objectFit: 'cover' }}
                                            />
                                        </Col>
                                    ))}
                                </Row>
                            </Image.PreviewGroup>
                        </div>

                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="Tieu de" span={2}>
                                {selectedPost.title}
                            </Descriptions.Item>
                            <Descriptions.Item label="Nguoi dang">{selectedPost.username}</Descriptions.Item>
                            <Descriptions.Item label="So dien thoai">
                                <Space>
                                    <PhoneOutlined />
                                    {selectedPost.phone}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Loai phong">
                                {getCategoryName(selectedPost.category)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Gia">
                                {selectedPost.price.toLocaleString('vi-VN')} VND
                            </Descriptions.Item>
                            <Descriptions.Item label="Dien tich">{selectedPost.area}m²</Descriptions.Item>
                            <Descriptions.Item label="Dia chi" span={2}>
                                <Space>
                                    <EnvironmentOutlined />
                                    {selectedPost.location}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Loai tin">
                                <Tag color={selectedPost.typeNews === 'vip' ? 'gold' : 'blue'}>
                                    {selectedPost.typeNews === 'vip' ? 'VIP' : 'Thuong'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Trang thai">
                                <Tag color={selectedPostStatus.color}>{selectedPostStatus.text}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngay dang">
                                <Space>
                                    <ClockCircleOutlined />
                                    {new Date(selectedPost.createdAt).toLocaleDateString('vi-VN')}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngay het han">
                                <Space>
                                    <ClockCircleOutlined />
                                    {new Date(selectedPost.endDate).toLocaleDateString('vi-VN')}
                                </Space>
                            </Descriptions.Item>
                        </Descriptions>

                        <Divider orientation="left">Mo ta chi tiet</Divider>
                        <div style={{ marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: selectedPost.description }} />

                        <Divider orientation="left">Tien ich</Divider>
                        <Row gutter={[16, 16]}>
                            {selectedPost.options &&
                                selectedPost.options.map((option, index) => (
                                    <Col span={8} key={index}>
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
