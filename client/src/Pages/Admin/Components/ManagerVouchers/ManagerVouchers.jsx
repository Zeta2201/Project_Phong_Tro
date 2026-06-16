import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Form, Input, InputNumber, message, Modal, Select, Space, Switch, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import {
    requestCreateVoucher,
    requestGetAdminVouchers,
    requestToggleVoucher,
    requestUpdateVoucher,
} from '../../../../config/request';

const typeLabels = {
    normal: { label: 'Tin thường', color: 'blue' },
    vip: { label: 'Tin VIP', color: 'gold' },
};

function ManagerVouchers() {
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState(null);
    const [form] = Form.useForm();

    const fetchVouchers = async () => {
        setLoading(true);
        try {
            const res = await requestGetAdminVouchers();
            setVouchers(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể lấy danh sách voucher');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVouchers();
    }, []);

    const openCreate = () => {
        setEditingVoucher(null);
        form.setFieldsValue({
            code: '',
            name: '',
            description: '',
            discountType: 'percent',
            discountValue: 10,
            maxDiscount: 0,
            minOrderValue: 0,
            applicableTypes: ['normal', 'vip'],
            dateRange: null,
            usageLimit: 0,
            usageLimitPerUser: 1,
            isActive: true,
        });
        setModalOpen(true);
    };

    const openEdit = (voucher) => {
        setEditingVoucher(voucher);
        form.setFieldsValue({
            ...voucher,
            dateRange: voucher.startAt || voucher.endAt ? [voucher.startAt ? dayjs(voucher.startAt) : null, voucher.endAt ? dayjs(voucher.endAt) : null] : null,
        });
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        const values = await form.validateFields();
        const payload = {
            ...values,
            startAt: values.dateRange?.[0]?.toISOString() || null,
            endAt: values.dateRange?.[1]?.toISOString() || null,
        };
        delete payload.dateRange;

        try {
            if (editingVoucher) {
                await requestUpdateVoucher({ ...payload, id: editingVoucher._id });
                message.success('Đã cập nhật voucher');
            } else {
                await requestCreateVoucher(payload);
                message.success('Đã tạo voucher');
            }
            setModalOpen(false);
            fetchVouchers();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể lưu voucher');
        }
    };

    const handleToggle = async (voucher, isActive) => {
        try {
            await requestToggleVoucher({ id: voucher._id, isActive });
            message.success(isActive ? 'Đã bật voucher' : 'Đã tắt voucher');
            fetchVouchers();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể cập nhật trạng thái voucher');
        }
    };

    const columns = [
        { title: 'Mã', dataIndex: 'code', key: 'code', render: (value) => <strong>{value}</strong> },
        { title: 'Tên', dataIndex: 'name', key: 'name' },
        {
            title: 'Giảm',
            key: 'discount',
            render: (_, record) =>
                record.discountType === 'percent'
                    ? `${record.discountValue}%${record.maxDiscount ? `, tối đa ${Number(record.maxDiscount).toLocaleString('vi-VN')} VND` : ''}`
                    : `${Number(record.discountValue || 0).toLocaleString('vi-VN')} VND`,
        },
        {
            title: 'Áp dụng',
            dataIndex: 'applicableTypes',
            key: 'applicableTypes',
            render: (types = []) => (
                <Space>
                    {types.map((type) => (
                        <Tag key={type} color={typeLabels[type]?.color}>
                            {typeLabels[type]?.label || type}
                        </Tag>
                    ))}
                </Space>
            ),
        },
        {
            title: 'Lượt dùng',
            key: 'usage',
            render: (_, record) => `${record.usedCount || 0}/${record.usageLimit || '∞'}`,
        },
        {
            title: 'Thời hạn',
            key: 'date',
            render: (_, record) =>
                record.startAt || record.endAt
                    ? `${record.startAt ? dayjs(record.startAt).format('DD/MM/YYYY') : 'Bất kỳ'} - ${
                          record.endAt ? dayjs(record.endAt).format('DD/MM/YYYY') : 'Bất kỳ'
                      }`
                    : 'Không giới hạn',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (value, record) => <Switch checked={value} onChange={(checked) => handleToggle(record, checked)} />,
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_, record) => (
                <Button type="primary" onClick={() => openEdit(record)}>
                    Sửa
                </Button>
            ),
        },
    ];

    return (
        <Card title="Quản lý voucher" extra={<Button type="primary" onClick={openCreate}>Thêm voucher</Button>}>
            <Table columns={columns} dataSource={vouchers} rowKey="_id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 1400 }} />

            <Modal
                title={editingVoucher ? 'Sửa voucher' : 'Thêm voucher'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSubmit}
                okText="Lưu"
                cancelText="Hủy"
                width={820}
            >
                <Form form={form} layout="vertical">
                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item name="code" label="Mã voucher" rules={[{ required: true, message: 'Nhập mã voucher' }]}>
                            <Input style={{ width: 180 }} placeholder="VD: VIP20" />
                        </Form.Item>
                        <Form.Item name="discountType" label="Loại giảm" rules={[{ required: true }]}>
                            <Select
                                style={{ width: 160 }}
                                options={[
                                    { value: 'percent', label: 'Phần trăm' },
                                    { value: 'fixed', label: 'Số tiền' },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item name="discountValue" label="Giá trị giảm" rules={[{ required: true, message: 'Nhập giá trị giảm' }]}>
                            <InputNumber min={0} style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item name="maxDiscount" label="Giảm tối đa">
                            <InputNumber min={0} addonAfter="VND" style={{ width: 180 }} />
                        </Form.Item>
                    </Space>

                    <Form.Item name="name" label="Tên voucher" rules={[{ required: true, message: 'Nhập tên voucher' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={3} />
                    </Form.Item>

                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item name="minOrderValue" label="Đơn tối thiểu">
                            <InputNumber min={0} addonAfter="VND" style={{ width: 180 }} />
                        </Form.Item>
                        <Form.Item name="usageLimit" label="Tổng lượt dùng">
                            <InputNumber min={0} style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item name="usageLimitPerUser" label="Lượt/user">
                            <InputNumber min={0} style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item name="isActive" label="Đang bật" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    </Space>

                    <Form.Item name="applicableTypes" label="Áp dụng cho">
                        <Select
                            mode="multiple"
                            options={[
                                { value: 'normal', label: 'Tin thường' },
                                { value: 'vip', label: 'Tin VIP' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="dateRange" label="Thời gian hiệu lực">
                        <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
}

export default ManagerVouchers;
