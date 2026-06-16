import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Form, Input, InputNumber, message, Modal, Space, Switch, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import {
    requestCreateBanner,
    requestGetAdminBanners,
    requestToggleBanner,
    requestUpdateBanner,
} from '../../../../config/request';

function ManagerBanners() {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);
    const [form] = Form.useForm();

    const fetchBanners = async () => {
        setLoading(true);
        try {
            const res = await requestGetAdminBanners();
            setBanners(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể lấy danh sách banner');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBanners();
    }, []);

    const openCreate = () => {
        setEditingBanner(null);
        form.setFieldsValue({
            title: '',
            subtitle: '',
            badgeText: 'Ưu đãi đăng tin',
            ctaText: 'Đăng tin ngay',
            ctaLink: '/trang-ca-nhan?tab=posts',
            imageUrl: '',
            voucherCode: '',
            dateRange: null,
            priority: 0,
            isActive: true,
        });
        setModalOpen(true);
    };

    const openEdit = (banner) => {
        setEditingBanner(banner);
        form.setFieldsValue({
            ...banner,
            dateRange: banner.startAt || banner.endAt ? [banner.startAt ? dayjs(banner.startAt) : null, banner.endAt ? dayjs(banner.endAt) : null] : null,
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
            if (editingBanner) {
                await requestUpdateBanner({ ...payload, id: editingBanner._id });
                message.success('Đã cập nhật banner');
            } else {
                await requestCreateBanner(payload);
                message.success('Đã tạo banner');
            }
            setModalOpen(false);
            fetchBanners();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể lưu banner');
        }
    };

    const handleToggle = async (banner, isActive) => {
        try {
            await requestToggleBanner({ id: banner._id, isActive });
            message.success(isActive ? 'Đã bật banner' : 'Đã tắt banner');
            fetchBanners();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể cập nhật trạng thái banner');
        }
    };

    const columns = [
        { title: 'Tiêu đề', dataIndex: 'title', key: 'title' },
        { title: 'Nhãn', dataIndex: 'badgeText', key: 'badgeText', render: (value) => value || '-' },
        { title: 'Voucher', dataIndex: 'voucherCode', key: 'voucherCode', render: (value) => (value ? <Tag color="green">{value}</Tag> : '-') },
        { title: 'CTA', dataIndex: 'ctaText', key: 'ctaText' },
        { title: 'Ưu tiên', dataIndex: 'priority', key: 'priority' },
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
        <Card title="Quản lý banner giảm giá" extra={<Button type="primary" onClick={openCreate}>Thêm banner</Button>}>
            <Table columns={columns} dataSource={banners} rowKey="_id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 1300 }} />

            <Modal
                title={editingBanner ? 'Sửa banner' : 'Thêm banner'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSubmit}
                okText="Lưu"
                cancelText="Hủy"
                width={820}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề banner' }]}>
                        <Input placeholder="VD: Giảm 20% phí đăng tin VIP hôm nay" />
                    </Form.Item>
                    <Form.Item name="subtitle" label="Mô tả">
                        <Input.TextArea rows={3} placeholder="Mô tả ngắn về chương trình giảm giá" />
                    </Form.Item>

                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item name="badgeText" label="Nhãn">
                            <Input style={{ width: 180 }} />
                        </Form.Item>
                        <Form.Item name="voucherCode" label="Mã voucher">
                            <Input style={{ width: 160 }} placeholder="VD: VIP20" />
                        </Form.Item>
                        <Form.Item name="priority" label="Ưu tiên">
                            <InputNumber style={{ width: 120 }} />
                        </Form.Item>
                        <Form.Item name="isActive" label="Đang bật" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    </Space>

                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item name="ctaText" label="Nút CTA">
                            <Input style={{ width: 180 }} />
                        </Form.Item>
                        <Form.Item name="ctaLink" label="Link CTA">
                            <Input style={{ width: 360 }} placeholder="/trang-ca-nhan?tab=posts" />
                        </Form.Item>
                    </Space>

                    <Form.Item name="imageUrl" label="Ảnh nền">
                        <Input placeholder="Dán URL ảnh nếu muốn dùng ảnh nền" />
                    </Form.Item>
                    <Form.Item name="dateRange" label="Thời gian hiển thị">
                        <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
}

export default ManagerBanners;
