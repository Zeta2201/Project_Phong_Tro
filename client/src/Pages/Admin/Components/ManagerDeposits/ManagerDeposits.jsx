/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { Button, Card, Input, message, Modal, Select, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { requestAdminDepositAction, requestGetAdminDeposits } from '../../../../config/request';

const statuses = ['pending', 'holding', 'completed', 'refunded', 'cancelled', 'disputed'];

function ManagerDeposits() {
    const [deposits, setDeposits] = useState([]);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [adminNote, setAdminNote] = useState('');

    const fetchDeposits = async () => {
        setLoading(true);
        try {
            const res = await requestGetAdminDeposits({ status: status || undefined });
            setDeposits(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Lay danh sach coc that bai');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeposits();
    }, [status]);

    const runAction = async (action) => {
        try {
            await requestAdminDepositAction({ depositId: selected._id, action, adminNote });
            message.success('Da cap nhat giao dich coc');
            setSelected(null);
            setAdminNote('');
            fetchDeposits();
        } catch (error) {
            message.error(error.response?.data?.message || 'Khong the xu ly giao dich');
        }
    };

    const columns = [
        { title: 'Mã GD', dataIndex: '_id', key: '_id', render: (id) => id.slice(-8).toUpperCase() },
        { title: 'Phòng', dataIndex: ['room', 'title'], key: 'room', render: (value) => value || '-' },
        { title: 'Người thuê', dataIndex: ['tenant', 'fullName'], key: 'tenant', render: (value) => value || '-' },
        { title: 'Chủ trọ', dataIndex: ['landlord', 'fullName'], key: 'landlord', render: (value) => value || '-' },
        { title: 'Tiền cọc', dataIndex: 'amount', key: 'amount', render: (amount) => `${amount.toLocaleString('vi-VN')} VND` },
        { title: 'PTTT', dataIndex: 'paymentMethod', key: 'paymentMethod' },
        { title: 'TT thanh toán', dataIndex: 'paymentStatus', key: 'paymentStatus', render: (value) => <Tag>{value}</Tag> },
        { title: 'TT giao dịch', dataIndex: 'status', key: 'status', render: (value) => <Tag color={value === 'disputed' ? 'red' : 'blue'}>{value}</Tag> },
        { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'createdAt', render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm') },
        { title: 'Hết hạn', dataIndex: 'expiredAt', key: 'expiredAt', render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm') },
        { title: 'Thao tác', key: 'action', render: (_, record) => <Button onClick={() => { setSelected(record); setAdminNote(record.adminNote || ''); }}>Xử lý</Button> },
    ];

    return (
        <Card>
            <Select
                value={status}
                onChange={setStatus}
                style={{ width: 220, marginBottom: 16 }}
                options={[{ value: '', label: 'Tat ca trang thai' }, ...statuses.map((value) => ({ value, label: value }))]}
            />
            <Table columns={columns} dataSource={deposits} rowKey="_id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 1600 }} />
            <Modal title="Xử lý giao dịch cọc" open={Boolean(selected)} onCancel={() => setSelected(null)} footer={null}>
                <Input.TextArea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} rows={4} placeholder="Ghi chú admin" />
                <Space wrap style={{ marginTop: 16 }}>
                    <Button type="primary" onClick={() => runAction('release')}>Giải ngân</Button>
                    <Button onClick={() => runAction('refund')}>Hoàn cọc</Button>
                    <Button danger onClick={() => runAction('dispute')}>Chuyển tranh chấp</Button>
                </Space>
            </Modal>
        </Card>
    );
}

export default ManagerDeposits;
