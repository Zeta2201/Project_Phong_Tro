import { useEffect, useState } from 'react';
import {
    Button,
    Card,
    Form,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Select,
    Space,
    Switch,
    Table,
    Tabs,
    Tag,
    Typography,
    message,
} from 'antd';
import { EditOutlined, GiftOutlined, PlusOutlined } from '@ant-design/icons';
import {
    requestBackfillListingRewardPoints,
    requestAdjustRewardPoints,
    requestCreateRewardVoucher,
    requestDeleteRewardVoucher,
    requestGetAdminRewardTransactions,
    requestGetAdminRewardUsers,
    requestGetAdminRewardVouchers,
    requestUpdateRewardVoucher,
} from '../../../../config/request';

const { Title } = Typography;

const rankColors = {
    bronze: 'default',
    silver: 'blue',
    gold: 'gold',
    diamond: 'purple',
};

const formatMoney = (value = 0) => Number(value || 0).toLocaleString('vi-VN');

function ManagerRewards() {
    const [users, setUsers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [backfilling, setBackfilling] = useState(false);
    const [adjustUser, setAdjustUser] = useState(null);
    const [voucherModalOpen, setVoucherModalOpen] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState(null);
    const [adjustForm] = Form.useForm();
    const [voucherForm] = Form.useForm();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, transactionsRes, vouchersRes] = await Promise.all([
                requestGetAdminRewardUsers(),
                requestGetAdminRewardTransactions(),
                requestGetAdminRewardVouchers(),
            ]);
            setUsers(usersRes.metadata || []);
            setTransactions(transactionsRes.metadata || []);
            setVouchers(vouchersRes.metadata || []);
        } catch (error) {
            message.error(error?.response?.data?.message || 'Không thể tải dữ liệu tích điểm');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openAdjustModal = (user) => {
        setAdjustUser(user);
        adjustForm.resetFields();
    };

    const handleAdjust = async () => {
        const values = await adjustForm.validateFields();
        try {
            await requestAdjustRewardPoints(adjustUser._id, values);
            message.success('Điều chỉnh điểm thành công');
            setAdjustUser(null);
            fetchData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Điều chỉnh điểm thất bại');
        }
    };

    const openVoucherModal = (voucher = null) => {
        setEditingVoucher(voucher);
        setVoucherModalOpen(true);
        voucherForm.setFieldsValue(
            voucher || {
                discountType: 'percentage',
                durationDays: 30,
                quantity: 0,
                isActive: true,
                applicableTo: ['listing_package', 'vip_upgrade'],
            },
        );
    };

    const handleSaveVoucher = async () => {
        const values = await voucherForm.validateFields();
        try {
            if (editingVoucher?._id) {
                await requestUpdateRewardVoucher(editingVoucher._id, values);
                message.success('Cập nhật voucher thành công');
            } else {
                await requestCreateRewardVoucher(values);
                message.success('Tạo voucher thành công');
            }
            setVoucherModalOpen(false);
            setEditingVoucher(null);
            fetchData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Lưu voucher thất bại');
        }
    };

    const handleDisableVoucher = async (id) => {
        try {
            await requestDeleteRewardVoucher(id);
            message.success('Đã tắt voucher');
            fetchData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Không thể tắt voucher');
        }
    };

    const handleBackfillListingPoints = async () => {
        setBackfilling(true);
        try {
            const res = await requestBackfillListingRewardPoints();
            const data = res.metadata || {};
            message.success(
                `Đã quy đổi ${data.created || 0} bài đăng cũ, cộng ${data.pointsAdded || 0} điểm. Bỏ qua ${
                    data.skipped || 0
                } bài.`,
            );
            fetchData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Quy đổi điểm bài đăng cũ thất bại');
        } finally {
            setBackfilling(false);
        }
    };

    const userColumns = [
        { title: 'Người dùng', dataIndex: 'fullName' },
        { title: 'Email', dataIndex: 'email' },
        { title: 'Số điểm', dataIndex: 'rewardPoints', sorter: (a, b) => a.rewardPoints - b.rewardPoints },
        {
            title: 'Hạng',
            dataIndex: 'memberRank',
            render: (value) => <Tag color={rankColors[value] || 'default'}>{value || 'bronze'}</Tag>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'accountStatus',
            render: (value) => <Tag color={value === 'locked' ? 'red' : 'green'}>{value || 'active'}</Tag>,
        },
        {
            title: 'Thao tác',
            render: (_, record) => (
                <Button size="small" icon={<EditOutlined />} onClick={() => openAdjustModal(record)}>
                    Chỉnh điểm
                </Button>
            ),
        },
    ];

    const transactionColumns = [
        {
            title: 'Thời gian',
            dataIndex: 'createdAt',
            render: (value) => (value ? new Date(value).toLocaleString('vi-VN') : ''),
        },
        {
            title: 'Người dùng',
            dataIndex: 'userId',
            render: (value) => value?.fullName || value?.email || 'Không rõ',
        },
        { title: 'Loại', dataIndex: 'type', render: (value) => <Tag>{value}</Tag> },
        { title: 'Nguồn', dataIndex: 'source' },
        {
            title: 'Điểm',
            dataIndex: 'points',
            render: (value) => <Typography.Text type={value >= 0 ? 'success' : 'danger'}>{value}</Typography.Text>,
        },
        { title: 'Mô tả', dataIndex: 'description' },
    ];

    const voucherColumns = [
        { title: 'Tên', dataIndex: 'name' },
        { title: 'Prefix', dataIndex: 'codePrefix' },
        { title: 'Điểm', dataIndex: 'pointsRequired' },
        {
            title: 'Giảm giá',
            render: (_, record) =>
                record.discountType === 'percentage'
                    ? `${record.discountValue}%`
                    : `${formatMoney(record.discountValue)} VNĐ`,
        },
        {
            title: 'Số lượng',
            render: (_, record) => (record.quantity > 0 ? `${record.usedCount}/${record.quantity}` : 'Không giới hạn'),
        },
        { title: 'Trạng thái', dataIndex: 'isActive', render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? 'Bật' : 'Tắt'}</Tag> },
        {
            title: 'Thao tác',
            render: (_, record) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openVoucherModal(record)}>
                        Sửa
                    </Button>
                    <Popconfirm title="Tắt voucher này?" onConfirm={() => handleDisableVoucher(record._id)}>
                        <Button size="small" danger disabled={!record.isActive}>
                            Tắt
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={3} style={{ margin: 0 }}>
                    Quản lý tích điểm
                </Title>
                <Space>
                    <Popconfirm
                        title="Quy đổi điểm cho bài đăng cũ?"
                        description="Hệ thống chỉ cộng cho bài đã duyệt/đang hiển thị, có phí đăng tin và chưa từng được cộng điểm."
                        onConfirm={handleBackfillListingPoints}
                    >
                        <Button icon={<GiftOutlined />} loading={backfilling}>
                            Quy đổi bài đăng cũ
                        </Button>
                    </Popconfirm>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openVoucherModal()}>
                        Tạo voucher đổi điểm
                    </Button>
                </Space>
            </Space>

            <Tabs
                items={[
                    {
                        key: 'users',
                        label: 'Người dùng',
                        children: <Table rowKey="_id" loading={loading} columns={userColumns} dataSource={users} scroll={{ x: 900 }} />,
                    },
                    {
                        key: 'transactions',
                        label: 'Lịch sử điểm',
                        children: (
                            <Table
                                rowKey="_id"
                                loading={loading}
                                columns={transactionColumns}
                                dataSource={transactions}
                                scroll={{ x: 1000 }}
                            />
                        ),
                    },
                    {
                        key: 'vouchers',
                        label: 'Voucher đổi điểm',
                        children: (
                            <Table rowKey="_id" loading={loading} columns={voucherColumns} dataSource={vouchers} scroll={{ x: 1000 }} />
                        ),
                    },
                ]}
            />

            <Modal open={Boolean(adjustUser)} title="Điều chỉnh điểm" onOk={handleAdjust} onCancel={() => setAdjustUser(null)}>
                <Form layout="vertical" form={adjustForm}>
                    <Form.Item label="Người dùng">
                        <Input value={adjustUser?.fullName || ''} disabled />
                    </Form.Item>
                    <Form.Item
                        label="Số điểm cộng/trừ"
                        name="points"
                        rules={[{ required: true, message: 'Nhập số điểm cần điều chỉnh' }]}
                    >
                        <InputNumber style={{ width: '100%' }} placeholder="Ví dụ: 20 hoặc -10" />
                    </Form.Item>
                    <Form.Item label="Lý do" name="reason" rules={[{ required: true, message: 'Nhập lý do điều chỉnh' }]}>
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                open={voucherModalOpen}
                title={editingVoucher ? 'Cập nhật voucher đổi điểm' : 'Tạo voucher đổi điểm'}
                onOk={handleSaveVoucher}
                onCancel={() => setVoucherModalOpen(false)}
                width={760}
            >
                <Form layout="vertical" form={voucherForm}>
                    <Form.Item label="Tên voucher" name="name" rules={[{ required: true, message: 'Nhập tên voucher' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item label="Tiền tố mã" name="codePrefix" rules={[{ required: true, message: 'Nhập tiền tố mã' }]}>
                        <Input placeholder="VD: REWARD10" />
                    </Form.Item>
                    <Space style={{ width: '100%' }} align="start">
                        <Form.Item label="Điểm cần đổi" name="pointsRequired" rules={[{ required: true }]}>
                            <InputNumber min={1} />
                        </Form.Item>
                        <Form.Item label="Loại giảm" name="discountType" rules={[{ required: true }]}>
                            <Select
                                style={{ width: 160 }}
                                options={[
                                    { value: 'percentage', label: 'Phần trăm' },
                                    { value: 'fixed', label: 'Số tiền' },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item label="Giá trị" name="discountValue" rules={[{ required: true }]}>
                            <InputNumber min={1} />
                        </Form.Item>
                        <Form.Item label="Giảm tối đa" name="maxDiscount">
                            <InputNumber min={0} />
                        </Form.Item>
                    </Space>
                    <Space style={{ width: '100%' }} align="start">
                        <Form.Item label="Đơn tối thiểu" name="minOrderValue">
                            <InputNumber min={0} />
                        </Form.Item>
                        <Form.Item label="Thời hạn ngày" name="durationDays" rules={[{ required: true }]}>
                            <InputNumber min={1} />
                        </Form.Item>
                        <Form.Item label="Số lượng" name="quantity">
                            <InputNumber min={0} />
                        </Form.Item>
                        <Form.Item label="Đang bật" name="isActive" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    </Space>
                    <Form.Item label="Áp dụng cho" name="applicableTo" rules={[{ required: true }]}>
                        <Select
                            mode="multiple"
                            options={[
                                { value: 'listing_package', label: 'Gói đăng tin' },
                                { value: 'vip_upgrade', label: 'Nâng cấp VIP' },
                                { value: 'boost_listing', label: 'Đẩy tin' },
                            ]}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
}

export default ManagerRewards;
