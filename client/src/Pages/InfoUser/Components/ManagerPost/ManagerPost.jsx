import React, { useEffect, useMemo, useState } from 'react';
import { Card, Typography, Button, Table, Space, Popconfirm, message, Row, Col, Statistic, Tag, Switch, Tabs } from 'antd';
import { FileTextOutlined, PlusOutlined, DeleteOutlined, UndoOutlined } from '@ant-design/icons';
import classNames from 'classnames/bind';
import styles from './ManagerPost.module.scss';
import AddPostForm from './AddPostForm';
import { requestDeletePost, requestGetPostByUserId, requestRestorePost, requestUpdatePostAvailability } from '../../../../config/request';
import { useStore } from '../../../../hooks/useStore';

const cx = classNames.bind(styles);
const { Title, Text } = Typography;

const categoryMap = {
    'phong-tro': 'Phong tro',
    'nha-nguyen-can': 'Nha nguyen can',
    'can-ho-chung-cu': 'Can ho chung cu',
    'can-ho-mini': 'Can ho mini',
};

const statusMap = {
    draft: { color: 'default', text: 'Nhap' },
    pending: { color: 'orange', text: 'Cho duyet' },
    inactive: { color: 'orange', text: 'Cho duyet' },
    approved: { color: 'green', text: 'Da duyet' },
    active: { color: 'green', text: 'Da duyet' },
    rejected: { color: 'red', text: 'Tu choi' },
    hidden: { color: 'gray', text: 'Tam an' },
    rented: { color: 'blue', text: 'Da cho thue' },
    deleted: { color: 'default', text: 'Da xoa' },
};

const availabilityMap = {
    available: { color: 'green', text: 'Con phong' },
    unavailable: { color: 'red', text: 'Het phong' },
    reserved: { color: 'orange', text: 'Da giu coc' },
    rented: { color: 'blue', text: 'Da cho thue' },
};

function ManagerPost() {
    const [posts, setPosts] = useState([]);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [editingPost, setEditingPost] = useState(null);

    const { fetchAuth } = useStore();

    const activePosts = useMemo(() => posts.filter((post) => !post.isDeleted && post.status !== 'deleted'), [posts]);
    const deletedPosts = useMemo(() => posts.filter((post) => post.isDeleted || post.status === 'deleted'), [posts]);

    const fetchPosts = async () => {
        const res = await requestGetPostByUserId();
        setPosts(res.metadata || []);
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    const postStats = useMemo(() => {
        const stats = {
            total: activePosts.length,
            byCategory: {
                'phong-tro': 0,
                'nha-nguyen-can': 0,
                'can-ho-chung-cu': 0,
                'can-ho-mini': 0,
            },
        };
        activePosts.forEach((post) => {
            if (post.category && stats.byCategory[post.category] !== undefined) {
                stats.byCategory[post.category]++;
            }
        });
        return stats;
    }, [activePosts]);

    const handleAddPost = () => {
        setEditingPost(null);
        setIsFormVisible(true);
    };

    const handleDeletePost = async (postId) => {
        try {
            const res = await requestDeletePost({ id: postId });
            message.success(res.message);
            await fetchPosts();
            await fetchAuth();
        } catch (error) {
            message.error(error.response?.data?.message || 'Khong the xoa bai viet');
        }
    };

    const handleRestorePost = async (postId) => {
        try {
            const res = await requestRestorePost(postId);
            message.success(res.message);
            await fetchPosts();
        } catch (error) {
            message.error(error.response?.data?.message || 'Khong the khoi phuc bai viet');
        }
    };

    const handleUpdateAvailability = async (postId, checked) => {
        try {
            const availabilityStatus = checked ? 'available' : 'unavailable';
            const res = await requestUpdatePostAvailability({ id: postId, availabilityStatus });
            message.success(res.message);
            fetchPosts();
        } catch (error) {
            message.error(error.response?.data?.message || 'Cap nhat trang thai phong that bai');
        }
    };

    const handleFormFinish = async () => {
        await fetchPosts();
        await fetchAuth();
        setIsFormVisible(false);
        setEditingPost(null);
    };

    const handleFormCancel = () => {
        setIsFormVisible(false);
        setEditingPost(null);
    };

    const columns = [
        {
            title: 'Tieu de',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
        },
        {
            title: 'Gia (VND)',
            dataIndex: 'price',
            key: 'price',
            render: (price) => price?.toLocaleString('vi-VN'),
        },
        {
            title: 'Loai hinh',
            dataIndex: 'category',
            key: 'category',
            render: (category) => categoryMap[category] || category,
        },
        {
            title: 'Dien tich (m2)',
            dataIndex: 'area',
            key: 'area',
        },
        {
            title: 'Dia chi',
            dataIndex: 'location',
            key: 'location',
            ellipsis: true,
        },
        {
            title: 'Trang thai',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const config = statusMap[status] || { color: 'default', text: status };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: 'Tinh trang phong',
            dataIndex: 'availabilityStatus',
            key: 'availabilityStatus',
            render: (availabilityStatus, record) => {
                const isAvailable = (availabilityStatus || 'available') === 'available';
                const config = availabilityMap[availabilityStatus || 'available'] || { color: 'default', text: availabilityStatus };
                const isDeleted = record.isDeleted || record.status === 'deleted';
                return (
                    <Space direction="vertical" size={4}>
                        <Tag color={config.color}>{config.text}</Tag>
                        <Switch
                            size="small"
                            checked={isAvailable}
                            disabled={isDeleted || ['reserved', 'rented'].includes(availabilityStatus)}
                            checkedChildren="Con"
                            unCheckedChildren="Het"
                            onChange={(checked) => handleUpdateAvailability(record._id, checked)}
                        />
                    </Space>
                );
            },
        },
        {
            title: 'Hanh dong',
            key: 'action',
            width: 132,
            align: 'center',
            render: (_, record) => {
                const isDeleted = record.isDeleted || record.status === 'deleted';
                return isDeleted ? (
                    <Popconfirm
                        title="Khoi phuc bai viet nay?"
                        onConfirm={() => handleRestorePost(record._id)}
                        okText="Khoi phuc"
                        cancelText="Huy"
                    >
                        <Button className={cx('restore-button')} icon={<UndoOutlined />}>
                            Khoi phuc
                        </Button>
                    </Popconfirm>
                ) : (
                    <Popconfirm
                        title="Ban chac chan muon xoa bai viet?"
                        description="Bai viet se bi xoa mem va khong hien thi cong khai."
                        onConfirm={() => handleDeletePost(record._id)}
                        okText="Xoa"
                        cancelText="Huy"
                    >
                        <Button className={cx('delete-button')} icon={<DeleteOutlined />} danger>
                            Xoa
                        </Button>
                    </Popconfirm>
                );
            },
        },
    ];

    const deletedColumns = [
        ...columns.slice(0, -1),
        {
            title: 'Thoi gian xoa',
            dataIndex: 'deletedAt',
            key: 'deletedAt',
            render: (date) => (date ? new Date(date).toLocaleString('vi-VN') : '-'),
        },
        columns[columns.length - 1],
    ];

    return (
        <div>
            {isFormVisible ? (
                <AddPostForm onFinish={handleFormFinish} onCancel={handleFormCancel} initialValues={editingPost} />
            ) : (
                <div>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 24,
                        }}
                    >
                        <Title level={4} style={{ margin: 0 }}>
                            Thong ke bai viet
                        </Title>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPost}>
                            Them bai viet moi
                        </Button>
                    </div>

                    {activePosts.length > 0 && (
                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={6}>
                                <Card bordered={false}>
                                    <Statistic title="Tong so bai viet" value={postStats.total} />
                                </Card>
                            </Col>
                            {Object.entries(postStats.byCategory).map(([key, value]) => (
                                <Col span={4} key={key}>
                                    <Card bordered={false}>
                                        <Statistic title={categoryMap[key]} value={value} />
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    )}

                    {posts.length > 0 ? (
                        <>
                            <Title level={5} style={{ marginBottom: 16 }}>
                                Danh sach chi tiet
                            </Title>
                            <Tabs
                                items={[
                                    {
                                        key: 'active',
                                        label: `Bai viet dang quan ly (${activePosts.length})`,
                                        children: <Table columns={columns} dataSource={activePosts} rowKey="_id" bordered pagination={false} />,
                                    },
                                    {
                                        key: 'deleted',
                                        label: `Bai viet da xoa (${deletedPosts.length})`,
                                        children: (
                                            <Table
                                                columns={deletedColumns}
                                                dataSource={deletedPosts}
                                                rowKey="_id"
                                                bordered
                                                pagination={false}
                                                scroll={{ x: 980 }}
                                            />
                                        ),
                                    },
                                ]}
                            />
                        </>
                    ) : (
                        <Card className={cx('content-card')}>
                            <FileTextOutlined className={cx('content-icon')} />
                            <Title level={4}>Chua co bai viet nao</Title>
                            <Text>Nhan "Them bai viet moi" de bat dau dang tin.</Text>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}

export default ManagerPost;
