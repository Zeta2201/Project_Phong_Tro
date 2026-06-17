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
    'phong-tro': 'Phòng trọ',
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
    rejected: { color: 'red', text: 'Từ chối' },
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
            message.error(error.response?.data?.message || 'Không thể xóa bài viết');
        }
    };

    const handleRestorePost = async (postId) => {
        try {
            const res = await requestRestorePost(postId);
            message.success(res.message);
            await fetchPosts();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể khôi phục bài viết');
        }
    };

    const handleUpdateAvailability = async (postId, checked) => {
        try {
            const availabilityStatus = checked ? 'available' : 'unavailable';
            const res = await requestUpdatePostAvailability({ id: postId, availabilityStatus });
            message.success(res.message);
            fetchPosts();
        } catch (error) {
            message.error(error.response?.data?.message || 'Cập nhật trạng thái phòng thất bại');
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
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
        },
        {
            title: 'Giá (VND)',
            dataIndex: 'price',
            key: 'price',
            render: (price) => price?.toLocaleString('vi-VN'),
        },
        {
            title: 'Loại hình',
            dataIndex: 'category',
            key: 'category',
            render: (category) => categoryMap[category] || category,
        },
        {
            title: 'Diện tích (m2)',
            dataIndex: 'area',
            key: 'area',
        },
        {
            title: 'Địa chỉ',
            dataIndex: 'location',
            key: 'location',
            ellipsis: true,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const config = statusMap[status] || { color: 'default', text: status };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: 'Tình trạng phòng',
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
                            checkedChildren="Còn"
                            unCheckedChildren="Hết"
                            onChange={(checked) => handleUpdateAvailability(record._id, checked)}
                        />
                    </Space>
                );
            },
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 132,
            align: 'center',
            render: (_, record) => {
                const isDeleted = record.isDeleted || record.status === 'deleted';
                return isDeleted ? (
                    <Popconfirm
                        title="Khôi phục bài viết này?"
                        onConfirm={() => handleRestorePost(record._id)}
                        okText="Khôi phục"
                        cancelText="Hủy"
                    >
                        <Button className={cx('restore-button')} icon={<UndoOutlined />}>
                            Khôi phục
                        </Button>
                    </Popconfirm>
                ) : (
                    <Popconfirm
                        title="Bạn chắc chắn muốn xóa bài viết?"
                        description="Bài viết sẽ bị xóa mềm và không hiển thị công khai."
                        onConfirm={() => handleDeletePost(record._id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button className={cx('delete-button')} icon={<DeleteOutlined />} danger>
                            Xóa
                        </Button>
                    </Popconfirm>
                );
            },
        },
    ];

    const deletedColumns = [
        ...columns.slice(0, -1),
        {
            title: 'Thời gian xóa',
            dataIndex: 'deletedAt',
            key: 'deletedAt',
            render: (date) => (date ? new Date(date).toLocaleString('vi-VN') : '-'),
        },
        columns[columns.length - 1],
    ];

    return (
        <div className={cx('managerPost')}>
            {isFormVisible ? (
                <AddPostForm onFinish={handleFormFinish} onCancel={handleFormCancel} initialValues={editingPost} />
            ) : (
                <div>
                    <div className={cx('toolbar')}>
                        <Title level={4} style={{ margin: 0 }}>
                            Thống kê bài viết
                        </Title>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPost}>
                            Thêm bài viết mới
                        </Button>
                    </div>

                    {activePosts.length > 0 && (
                        <Row gutter={[12, 12]} className={cx('statsRow')}>
                            <Col span={6}>
                                <Card bordered={false}>
                                    <Statistic title="Tổng số bài viết" value={postStats.total} />
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
                                Danh sách chi tiết
                            </Title>
                            <Tabs
                                items={[
                                    {
                                        key: 'active',
                                        label: `Bài viết đang quản lý (${activePosts.length})`,
                                        children: (
                                            <Table
                                                columns={columns}
                                                dataSource={activePosts}
                                                rowKey="_id"
                                                bordered
                                                pagination={false}
                                                scroll={{ x: 980 }}
                                            />
                                        ),
                                    },
                                    {
                                        key: 'deleted',
                                        label: `Bài viết đã xóa (${deletedPosts.length})`,
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
                            <Title level={4}>Chưa có bài viết nào</Title>
                            <Text>Nhấn "Thêm bài viết mới" để bắt đầu đăng tin.</Text>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}

export default ManagerPost;
