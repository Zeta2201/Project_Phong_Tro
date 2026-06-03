import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, message, Modal, Select, Space, Switch, Table, Tag } from 'antd';
import {
    requestCreatePostingPlan,
    requestGetAdminPostingPlans,
    requestTogglePostingPlan,
    requestUpdatePostingPlan,
} from '../../../../config/request';

const typeLabels = {
    vip: { label: 'Tin VIP', color: 'gold' },
    normal: { label: 'Tin thường', color: 'blue' },
};

function ManagerPostingPlans() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [form] = Form.useForm();

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const res = await requestGetAdminPostingPlans();
            setPlans(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể lấy gói đăng tin');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const openCreate = () => {
        setEditingPlan(null);
        form.setFieldsValue({
            typeNews: 'normal',
            name: 'Tin thường',
            label: '',
            description: '',
            durationDays: 3,
            price: 0,
            benefitsText: '',
            isActive: true,
            sortOrder: 0,
        });
        setModalOpen(true);
    };

    const openEdit = (plan) => {
        setEditingPlan(plan);
        form.setFieldsValue({
            ...plan,
            benefitsText: (plan.benefits || []).join('\n'),
        });
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        const values = await form.validateFields();
        const payload = {
            ...values,
            benefits: values.benefitsText
                ? values.benefitsText
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean)
                : [],
        };
        delete payload.benefitsText;

        try {
            if (editingPlan) {
                await requestUpdatePostingPlan({ ...payload, id: editingPlan._id });
                message.success('Đã cập nhật gói đăng tin');
            } else {
                await requestCreatePostingPlan(payload);
                message.success('Đã tạo gói đăng tin');
            }
            setModalOpen(false);
            fetchPlans();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể lưu gói đăng tin');
        }
    };

    const handleToggle = async (plan, isActive) => {
        try {
            await requestTogglePostingPlan({ id: plan._id, isActive });
            message.success(isActive ? 'Đã bật gói đăng tin' : 'Đã tắt gói đăng tin');
            fetchPlans();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể cập nhật trạng thái');
        }
    };

    const columns = [
        {
            title: 'Loại tin',
            dataIndex: 'typeNews',
            key: 'typeNews',
            render: (value) => <Tag color={typeLabels[value]?.color}>{typeLabels[value]?.label || value}</Tag>,
        },
        { title: 'Tên gói', dataIndex: 'name', key: 'name' },
        { title: 'Nhãn', dataIndex: 'label', key: 'label', render: (value) => value || '-' },
        { title: 'Thời hạn', dataIndex: 'durationDays', key: 'durationDays', render: (value) => `${value} ngày` },
        { title: 'Giá', dataIndex: 'price', key: 'price', render: (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND` },
        { title: 'Thứ tự', dataIndex: 'sortOrder', key: 'sortOrder' },
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
        <Card
            title="Quản lý gói đăng tin"
            extra={
                <Button type="primary" onClick={openCreate}>
                    Thêm gói
                </Button>
            }
        >
            <Table columns={columns} dataSource={plans} rowKey="_id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 1200 }} />

            <Modal
                title={editingPlan ? 'Sửa gói đăng tin' : 'Thêm gói đăng tin'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSubmit}
                okText="Lưu"
                cancelText="Hủy"
                width={720}
            >
                <Form form={form} layout="vertical">
                    <Space style={{ width: '100%' }} size={16} align="start">
                        <Form.Item name="typeNews" label="Loại tin" rules={[{ required: true, message: 'Chọn loại tin' }]}>
                            <Select
                                style={{ width: 180 }}
                                options={[
                                    { value: 'normal', label: 'Tin thường' },
                                    { value: 'vip', label: 'Tin VIP' },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item name="durationDays" label="Thời hạn" rules={[{ required: true, message: 'Nhập thời hạn' }]}>
                            <InputNumber min={1} addonAfter="ngày" style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item name="price" label="Giá" rules={[{ required: true, message: 'Nhập giá' }]}>
                            <InputNumber min={0} addonAfter="VND" style={{ width: 180 }} />
                        </Form.Item>
                    </Space>

                    <Form.Item name="name" label="Tên gói" rules={[{ required: true, message: 'Nhập tên gói' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="label" label="Nhãn">
                        <Input placeholder="Ví dụ: Tiết kiệm, Nổi bật" />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item name="benefitsText" label="Quyền lợi">
                        <Input.TextArea rows={5} placeholder="Mỗi dòng là một quyền lợi" />
                    </Form.Item>
                    <Space size={16}>
                        <Form.Item name="sortOrder" label="Thứ tự">
                            <InputNumber />
                        </Form.Item>
                        <Form.Item name="isActive" label="Đang bật" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    </Space>
                </Form>
            </Modal>
        </Card>
    );
}

export default ManagerPostingPlans;
