import { useEffect, useState } from 'react';
import { Card, Col, message, Row, Statistic, Table, Tag, Typography } from 'antd';
import {
    BarChartOutlined,
    EyeOutlined,
    HeartOutlined,
    MessageOutlined,
    SafetyCertificateOutlined,
    RiseOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { requestGetOwnerAnalytics } from '../../../../config/request';

const { Title, Text } = Typography;

const statusConfig = {
    active: { color: 'green', text: 'Đã duyệt' },
    inactive: { color: 'orange', text: 'Chờ duyệt' },
    rejected: { color: 'red', text: 'Từ chối' },
};

function OwnerAnalytics() {
    const [loading, setLoading] = useState(false);
    const [analytics, setAnalytics] = useState({ totals: {}, posts: [] });

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await requestGetOwnerAnalytics();
            setAnalytics(res.metadata || { totals: {}, posts: [] });
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể lấy dữ liệu phân tích');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const totals = analytics.totals || {};

    const columns = [
        {
            title: 'Bài đăng',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const config = statusConfig[status] || { color: 'default', text: status };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: 'Lượt xem',
            dataIndex: 'viewCount',
            key: 'viewCount',
            sorter: (a, b) => a.viewCount - b.viewCount,
        },
        {
            title: 'Lượt lưu',
            dataIndex: 'favouriteCount',
            key: 'favouriteCount',
            sorter: (a, b) => a.favouriteCount - b.favouriteCount,
        },
        {
            title: 'Lượt đặt cọc',
            dataIndex: 'depositCount',
            key: 'depositCount',
            sorter: (a, b) => a.depositCount - b.depositCount,
        },
        {
            title: 'Tỷ lệ chuyển đổi',
            dataIndex: 'conversionRate',
            key: 'conversionRate',
            render: (value) => `${Number(value || 0).toFixed(2)}%`,
            sorter: (a, b) => a.conversionRate - b.conversionRate,
        },
    ];

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <Title level={4} style={{ marginBottom: 4 }}>
                    Phân tích hiệu quả bài đăng
                </Title>
                <Text type="secondary">
                    Lượt chat hiện được tính ở mức tổng chủ trọ vì tin nhắn hiện chưa gắn trực tiếp với từng bài đăng.
                </Text>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={8} xl={4}>
                    <Card>
                        <Statistic title="Lượt xem" value={totals.viewCount || 0} prefix={<EyeOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} md={8} xl={4}>
                    <Card>
                        <Statistic title="Lượt lưu" value={totals.favouriteCount || 0} prefix={<HeartOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} md={8} xl={4}>
                    <Card>
                        <Statistic title="Tin nhắn" value={totals.chatCount || 0} prefix={<MessageOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} md={8} xl={4}>
                    <Card>
                        <Statistic title="Người đã chat" value={totals.chatUserCount || 0} prefix={<UserOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} md={8} xl={4}>
                    <Card>
                        <Statistic title="Lượt đặt cọc" value={totals.depositCount || 0} prefix={<SafetyCertificateOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} md={8} xl={4}>
                    <Card>
                        <Statistic
                            title="Tỷ lệ chuyển đổi"
                            value={totals.conversionRate || 0}
                            precision={2}
                            suffix="%"
                            prefix={<RiseOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title={<><BarChartOutlined /> Chi tiết theo bài đăng</>}>
                <Table
                    columns={columns}
                    dataSource={analytics.posts || []}
                    rowKey="_id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                    scroll={{ x: 900 }}
                />
            </Card>
        </div>
    );
}

export default OwnerAnalytics;
