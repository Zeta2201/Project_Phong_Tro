import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Progress, Row, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd';
import { GiftOutlined, TrophyOutlined } from '@ant-design/icons';
import {
    requestGetMyRewardVouchers,
    requestGetMyRewards,
    requestGetRewardHistory,
    requestGetRewardVouchers,
    requestRedeemRewardVoucher,
} from '../../../../config/request';

const { Text, Title } = Typography;

const rankColors = {
    bronze: 'default',
    silver: 'blue',
    gold: 'gold',
    diamond: 'purple',
};

const formatMoney = (value = 0) => Number(value || 0).toLocaleString('vi-VN');

function Rewards() {
    const [summary, setSummary] = useState(null);
    const [history, setHistory] = useState([]);
    const [rewardVouchers, setRewardVouchers] = useState([]);
    const [myVouchers, setMyVouchers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [redeemingId, setRedeemingId] = useState('');

    const rewardPoints = Number(summary?.rewardPoints || 0);
    const progress = summary?.progress || {};

    const fetchRewards = async () => {
        setLoading(true);
        try {
            const [summaryRes, historyRes, vouchersRes, myVouchersRes] = await Promise.all([
                requestGetMyRewards(),
                requestGetRewardHistory(),
                requestGetRewardVouchers(),
                requestGetMyRewardVouchers(),
            ]);
            setSummary(summaryRes.metadata);
            setHistory(historyRes.metadata || []);
            setRewardVouchers(vouchersRes.metadata || []);
            setMyVouchers(myVouchersRes.metadata || []);
        } catch (error) {
            message.error(error?.response?.data?.message || 'Không thể tải dữ liệu điểm thưởng');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRewards();
    }, []);

    const handleRedeem = async (voucherId) => {
        setRedeemingId(voucherId);
        try {
            await requestRedeemRewardVoucher(voucherId);
            message.success('Đổi voucher thành công');
            fetchRewards();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Đổi voucher thất bại');
        } finally {
            setRedeemingId('');
        }
    };

    const voucherColumns = useMemo(
        () => [
            {
                title: 'Voucher',
                dataIndex: 'name',
                render: (value, record) => (
                    <Space direction="vertical" size={2}>
                        <Text strong>{value}</Text>
                        <Text type="secondary">
                            {record.discountType === 'percentage'
                                ? `Giảm ${record.discountValue}%`
                                : `Giảm ${formatMoney(record.discountValue)} VNĐ`}
                            {record.maxDiscount ? `, tối đa ${formatMoney(record.maxDiscount)} VNĐ` : ''}
                        </Text>
                    </Space>
                ),
            },
            {
                title: 'Điểm cần',
                dataIndex: 'pointsRequired',
                width: 120,
                render: (value) => <Tag color="blue">{value} điểm</Tag>,
            },
            {
                title: 'Thời hạn',
                dataIndex: 'durationDays',
                width: 110,
                render: (value) => `${value} ngày`,
            },
            {
                title: 'Thao tác',
                key: 'action',
                width: 140,
                render: (_, record) => {
                    const soldOut = record.remainingQuantity === 0;
                    return (
                        <Button
                            type="primary"
                            icon={<GiftOutlined />}
                            disabled={!record.canRedeem || soldOut}
                            loading={redeemingId === record._id}
                            onClick={() => handleRedeem(record._id)}
                        >
                            Đổi ngay
                        </Button>
                    );
                },
            },
        ],
        [redeemingId],
    );

    const historyColumns = [
        {
            title: 'Thời gian',
            dataIndex: 'createdAt',
            width: 160,
            render: (value) => (value ? new Date(value).toLocaleString('vi-VN') : ''),
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            width: 110,
            render: (value) => <Tag color={value === 'earn' ? 'green' : value === 'redeem' ? 'orange' : 'red'}>{value}</Tag>,
        },
        {
            title: 'Điểm',
            dataIndex: 'points',
            width: 100,
            render: (value) => <Text type={value >= 0 ? 'success' : 'danger'}>{value > 0 ? `+${value}` : value}</Text>,
        },
        { title: 'Nguồn', dataIndex: 'source', width: 150 },
        { title: 'Mô tả', dataIndex: 'description' },
    ];

    const myVoucherColumns = [
        { title: 'Mã', dataIndex: 'code', width: 170, render: (value) => <Text copyable strong>{value}</Text> },
        { title: 'Tên', dataIndex: 'name' },
        {
            title: 'Hạn dùng',
            dataIndex: 'endAt',
            width: 140,
            render: (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : ''),
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 120,
            render: (_, record) => (
                <Tag color={record.isActive ? 'green' : 'default'}>{record.isActive ? 'Có thể dùng' : 'Đã tắt'}</Tag>
            ),
        },
    ];

    return (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                    <Card>
                        <Statistic title="Điểm hiện có" value={rewardPoints} suffix="điểm" prefix={<GiftOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card>
                        <Statistic
                            title="Hạng thành viên"
                            value={summary?.memberRank || 'bronze'}
                            prefix={<TrophyOutlined />}
                            valueStyle={{ textTransform: 'capitalize' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Text strong>Tiến trình lên hạng</Text>
                            <Progress percent={progress.progressPercent || 0} />
                            {progress.nextRank ? (
                                <Text type="secondary">
                                    Còn {progress.pointsToNextRank} điểm để lên hạng {progress.nextRank}
                                </Text>
                            ) : (
                                <Text type="secondary">Bạn đang ở hạng cao nhất</Text>
                            )}
                        </Space>
                    </Card>
                </Col>
            </Row>

            <Card>
                <Title level={4} style={{ marginTop: 0 }}>
                    <Tag color={rankColors[summary?.memberRank] || 'default'}>{summary?.memberRank || 'bronze'}</Tag>
                    Điểm thưởng NestFinder
                </Title>
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Quy đổi điểm thưởng"
                    description="Mỗi 10.000 VNĐ thanh toán phí đăng tin hoặc nâng cấp tin VIP thành công sẽ được quy đổi thành 1 điểm thưởng. Điểm không áp dụng cho tiền thuê phòng hoặc tiền đặt cọc."
                />
                <Tabs
                    items={[
                        {
                            key: 'store',
                            label: 'Kho voucher',
                            children: rewardVouchers.length ? (
                                <Table
                                    rowKey="_id"
                                    loading={loading}
                                    columns={voucherColumns}
                                    dataSource={rewardVouchers}
                                    pagination={{ pageSize: 5 }}
                                    scroll={{ x: 760 }}
                                />
                            ) : (
                                <Empty description="Chưa có voucher đổi điểm" />
                            ),
                        },
                        {
                            key: 'mine',
                            label: 'Voucher của tôi',
                            children: (
                                <Table
                                    rowKey="_id"
                                    loading={loading}
                                    columns={myVoucherColumns}
                                    dataSource={myVouchers}
                                    pagination={{ pageSize: 5 }}
                                    scroll={{ x: 640 }}
                                />
                            ),
                        },
                        {
                            key: 'history',
                            label: 'Lịch sử điểm',
                            children: (
                                <Table
                                    rowKey="_id"
                                    loading={loading}
                                    columns={historyColumns}
                                    dataSource={history}
                                    pagination={{ pageSize: 8 }}
                                    scroll={{ x: 760 }}
                                />
                            ),
                        },
                    ]}
                />
            </Card>
        </Space>
    );
}

export default Rewards;
