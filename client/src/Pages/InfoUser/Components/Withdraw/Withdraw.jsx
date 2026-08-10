import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Popconfirm, Space, Table, Tag, message } from 'antd';
import { requestCancelWithdraw, requestCreateWithdraw, requestGetMyWithdraws } from '../../../../config/request';
import { useStore } from '../../../../hooks/useStore';

const statusMap = {
    pending: { color: 'orange', text: 'Chờ duyệt' },
    approved: { color: 'blue', text: 'Đã duyệt' },
    completed: { color: 'green', text: 'Hoàn tất' },
    rejected: { color: 'red', text: 'Từ chối' },
    cancelled: { color: 'default', text: 'Đã hủy' },
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

function Withdraw() {
    const [form] = Form.useForm();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { dataUser, fetchAuth } = useStore();

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await requestGetMyWithdraws();
            setRequests(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể tải yêu cầu rút tiền');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleSubmit = async (values) => {
        setSubmitting(true);
        try {
            await requestCreateWithdraw(values);
            message.success('Đã gửi yêu cầu rút tiền');
            form.resetFields();
            await fetchRequests();
            await fetchAuth();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể tạo yêu cầu rút tiền');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async (id) => {
        try {
            await requestCancelWithdraw(id);
            message.success('Đã hủy yêu cầu và hoàn lại số dư');
            await fetchRequests();
            await fetchAuth();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể hủy yêu cầu');
        }
    };

    const columns = [
        { title: 'Số tiền', dataIndex: 'amount', render: formatMoney },
        { title: 'Ngân hàng', dataIndex: 'bankName' },
        { title: 'Số tài khoản', dataIndex: 'bankAccountNumber' },
        { title: 'Chủ tài khoản', dataIndex: 'bankAccountName' },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (status) => <Tag color={statusMap[status]?.color}>{statusMap[status]?.text || status}</Tag>,
        },
        { title: 'Ghi chú admin', dataIndex: 'adminNote', render: (value) => value || '-' },
        { title: 'Ngày tạo', dataIndex: 'createdAt', render: (date) => new Date(date).toLocaleString('vi-VN') },
        {
            title: 'Thao tác',
            render: (_, record) =>
                record.status === 'pending' ? (
                    <Popconfirm title="Hủy yêu cầu rút tiền này?" onConfirm={() => handleCancel(record._id)}>
                        <Button danger>Hủy</Button>
                    </Popconfirm>
                ) : (
                    '-'
                ),
        },
    ];

    return (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card>
                <Space size={24} wrap>
                    <strong>Số dư khả dụng: {formatMoney(dataUser?.balance)}</strong>
                    <strong>Đang giữ: {formatMoney(dataUser?.holdBalance)}</strong>
                </Space>
            </Card>
            <Card title="Tạo yêu cầu rút tiền">
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="amount" label="Số tiền rút" rules={[{ required: true, message: 'Vui lòng nhập số tiền' }]}>
                        <InputNumber min={50000} step={10000} style={{ width: '100%' }} formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(value) => value.replace(/,/g, '')} />
                    </Form.Item>
                    <Form.Item name="bankName" label="Ngân hàng" rules={[{ required: true, message: 'Vui lòng nhập ngân hàng' }]}>
                        <Input placeholder="Ví dụ: Vietcombank" />
                    </Form.Item>
                    <Form.Item name="bankAccountNumber" label="Số tài khoản" rules={[{ required: true, message: 'Vui lòng nhập số tài khoản' }]}>
                        <Input placeholder="Nhập số tài khoản nhận tiền" />
                    </Form.Item>
                    <Form.Item name="bankAccountName" label="Tên chủ tài khoản" rules={[{ required: true, message: 'Vui lòng nhập tên chủ tài khoản' }]}>
                        <Input placeholder="Tên in trên tài khoản ngân hàng" />
                    </Form.Item>
                    <Form.Item name="note" label="Ghi chú">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={submitting}>
                        Gửi yêu cầu rút tiền
                    </Button>
                </Form>
            </Card>
            <Card title="Lịch sử yêu cầu rút tiền">
                <Table rowKey="_id" columns={columns} dataSource={requests} loading={loading} scroll={{ x: 900 }} />
            </Card>
        </Space>
    );
}

export default Withdraw;
