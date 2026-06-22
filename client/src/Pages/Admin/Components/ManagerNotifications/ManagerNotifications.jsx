import { useEffect, useMemo, useState } from 'react';
import {
    Button,
    DatePicker,
    Form,
    Input,
    Select,
    Space,
    Table,
    Tag,
    Typography,
    message,
} from 'antd';
import { SendOutlined, ReloadOutlined } from '@ant-design/icons';
import {
    requestBroadcastNotification,
    requestGetAdminNotificationHistory,
    requestGetAdminNotifications,
} from '../../../../config/request';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const notificationTypes = [
    { label: 'Bài đăng', value: 'post' },
    { label: 'Đặt cọc', value: 'deposit' },
    { label: 'Hợp đồng', value: 'contract' },
    { label: 'Chat', value: 'chat' },
    { label: 'Voucher', value: 'voucher' },
    { label: 'Báo cáo', value: 'report' },
    { label: 'Xác thực', value: 'verification' },
    { label: 'Bảo trì', value: 'maintenance' },
    { label: 'Hệ thống', value: 'system' },
];

const targetRoles = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Người thuê', value: 'user' },
    { label: 'Chủ trọ', value: 'landlord' },
    { label: 'Admin', value: 'admin' },
];

const typeColors = {
    post: 'blue',
    deposit: 'green',
    contract: 'purple',
    chat: 'cyan',
    voucher: 'gold',
    report: 'red',
    verification: 'magenta',
    maintenance: 'orange',
    system: 'default',
};

function ManagerNotifications() {
    const [form] = Form.useForm();
    const [filters, setFilters] = useState({ page: 1, limit: 20 });
    const [notifications, setNotifications] = useState([]);
    const [history, setHistory] = useState([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
    const [historyPagination, setHistoryPagination] = useState({ current: 1, pageSize: 20, total: 0 });
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [sending, setSending] = useState(false);

    const normalizeFilters = (values = filters) => {
        const [from, to] = values.range || [];
        return {
            page: values.page || 1,
            limit: values.limit || 20,
            type: values.type || undefined,
            targetRole: values.targetRole || undefined,
            from: from ? from.startOf('day').toISOString() : undefined,
            to: to ? to.endOf('day').toISOString() : undefined,
        };
    };

    const fetchNotifications = async (nextFilters = filters) => {
        setLoading(true);
        try {
            const params = normalizeFilters(nextFilters);
            const res = await requestGetAdminNotifications(params);
            const metadata = res.metadata || {};
            setNotifications(metadata.notifications || []);
            setPagination({
                current: metadata.pagination?.page || 1,
                pageSize: metadata.pagination?.limit || 20,
                total: metadata.pagination?.total || 0,
            });
        } catch (error) {
            message.error(error?.response?.data?.message || 'Không thể tải danh sách thông báo');
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async (nextFilters = filters) => {
        setHistoryLoading(true);
        try {
            const params = normalizeFilters(nextFilters);
            const res = await requestGetAdminNotificationHistory(params);
            const metadata = res.metadata || {};
            setHistory(metadata.notifications || []);
            setHistoryPagination({
                current: metadata.pagination?.page || 1,
                pageSize: metadata.pagination?.limit || 20,
                total: metadata.pagination?.total || 0,
            });
        } catch (error) {
            message.error(error?.response?.data?.message || 'Không thể tải lịch sử thông báo');
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications(filters);
        fetchHistory(filters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    const handleFilterChange = (changed) => {
        setFilters((prev) => ({ ...prev, ...changed, page: 1 }));
    };

    const handleSend = async (values) => {
        setSending(true);
        try {
            const res = await requestBroadcastNotification({
                targetRole: values.targetRole,
                title: values.title,
                message: values.message,
                type: values.type,
                link: values.link || '',
            });
            message.success(`Đã gửi ${res.metadata?.sentCount || 0} thông báo`);
            form.resetFields();
            setFilters((prev) => ({ ...prev, page: 1 }));
            fetchNotifications({ ...filters, page: 1 });
            fetchHistory({ ...filters, page: 1 });
        } catch (error) {
            message.error(error?.response?.data?.message || 'Gửi thông báo thất bại');
        } finally {
            setSending(false);
        }
    };

    const columns = useMemo(
        () => [
            {
                title: 'Tiêu đề',
                dataIndex: 'title',
                key: 'title',
                render: (value, record) => (
                    <Space direction="vertical" size={2}>
                        <Text strong>{value}</Text>
                        <Text type="secondary">{record.message}</Text>
                    </Space>
                ),
            },
            {
                title: 'Người nhận',
                dataIndex: 'userId',
                key: 'userId',
                width: 180,
                render: (user) => user?.fullName || user?.email || 'Không xác định',
            },
            {
                title: 'Loại',
                dataIndex: 'type',
                key: 'type',
                width: 120,
                render: (value) => <Tag color={typeColors[value]}>{value}</Tag>,
            },
            {
                title: 'Đối tượng',
                dataIndex: 'targetRole',
                key: 'targetRole',
                width: 130,
                render: (value) => targetRoles.find((item) => item.value === value)?.label || value,
            },
            {
                title: 'Trạng thái',
                dataIndex: 'isRead',
                key: 'isRead',
                width: 120,
                render: (isRead) => <Tag color={isRead ? 'green' : 'orange'}>{isRead ? 'Đã đọc' : 'Chưa đọc'}</Tag>,
            },
            {
                title: 'Thời gian',
                dataIndex: 'createdAt',
                key: 'createdAt',
                width: 180,
                render: (value) => (value ? new Date(value).toLocaleString('vi-VN') : '-'),
            },
        ],
        [],
    );

    return (
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <div>
                <Title level={3}>Quản lý thông báo</Title>
                <Text type="secondary">Gửi thông báo hàng loạt và theo dõi lịch sử thông báo trong hệ thống.</Text>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={handleSend}
                initialValues={{ targetRole: 'all', type: 'system' }}
                style={{ background: '#fff', padding: 24, borderRadius: 8 }}
            >
                <Space align="start" wrap style={{ width: '100%' }}>
                    <Form.Item
                        label="Tiêu đề"
                        name="title"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                        style={{ minWidth: 260 }}
                    >
                        <Input placeholder="Nhập tiêu đề thông báo" />
                    </Form.Item>
                    <Form.Item
                        label="Loại"
                        name="type"
                        rules={[{ required: true, message: 'Chọn loại thông báo' }]}
                        style={{ minWidth: 180 }}
                    >
                        <Select options={notificationTypes} />
                    </Form.Item>
                    <Form.Item
                        label="Đối tượng nhận"
                        name="targetRole"
                        rules={[{ required: true, message: 'Chọn đối tượng nhận' }]}
                        style={{ minWidth: 180 }}
                    >
                        <Select options={targetRoles} />
                    </Form.Item>
                    <Form.Item label="Link điều hướng" name="link" style={{ minWidth: 260 }}>
                        <Input placeholder="/trang-ca-nhan?tab=rewards" />
                    </Form.Item>
                </Space>
                <Form.Item
                    label="Nội dung"
                    name="message"
                    rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
                >
                    <Input.TextArea rows={4} placeholder="Nhập nội dung thông báo" />
                </Form.Item>
                <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={sending}>
                    Gửi thông báo
                </Button>
            </Form>

            <Space wrap>
                <Select
                    allowClear
                    placeholder="Lọc theo loại"
                    style={{ width: 180 }}
                    options={notificationTypes}
                    onChange={(type) => handleFilterChange({ type })}
                />
                <Select
                    allowClear
                    placeholder="Lọc theo đối tượng"
                    style={{ width: 190 }}
                    options={targetRoles}
                    onChange={(targetRole) => handleFilterChange({ targetRole })}
                />
                <RangePicker onChange={(range) => handleFilterChange({ range })} />
                <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                        fetchNotifications(filters);
                        fetchHistory(filters);
                    }}
                >
                    Tải lại
                </Button>
            </Space>

            <Table
                title={() => 'Tất cả thông báo'}
                rowKey="_id"
                columns={columns}
                dataSource={notifications}
                loading={loading}
                pagination={pagination}
                onChange={(nextPagination) =>
                    setFilters((prev) => ({
                        ...prev,
                        page: nextPagination.current,
                        limit: nextPagination.pageSize,
                    }))
                }
            />

            <Table
                title={() => 'Lịch sử thông báo hàng loạt'}
                rowKey="_id"
                columns={columns}
                dataSource={history}
                loading={historyLoading}
                pagination={historyPagination}
                onChange={(nextPagination) =>
                    setFilters((prev) => ({
                        ...prev,
                        page: nextPagination.current,
                        limit: nextPagination.pageSize,
                    }))
                }
            />
        </Space>
    );
}

export default ManagerNotifications;
