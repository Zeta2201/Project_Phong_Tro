import { useEffect, useState } from 'react';
import { Button, Card, Input, message, Select, Space, Table, Tabs, Tag } from 'antd';
import dayjs from 'dayjs';
import { requestGetReservations, requestUpdateReservation } from '../../../../config/request';

const statusMap = {
    pending: { color: 'orange', text: 'Chờ xử lý' },
    accepted: { color: 'green', text: 'Đã giữ chỗ' },
    rejected: { color: 'red', text: 'Đã từ chối' },
    cancelled: { color: 'default', text: 'Đã hủy' },
    expired: { color: 'volcano', text: 'Hết hạn' },
};

function ManagerReservation() {
    const [role, setRole] = useState('owner');
    const [status, setStatus] = useState('');
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [ownerNotes, setOwnerNotes] = useState({});

    const fetchReservations = async () => {
        setLoading(true);
        try {
            const res = await requestGetReservations({ role, status: status || undefined });
            setReservations(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Lấy danh sách giữ chỗ thất bại');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReservations();
    }, [role, status]);

    const handleUpdate = async (record, nextStatus) => {
        try {
            await requestUpdateReservation({
                id: record._id,
                status: nextStatus,
                ownerNote: ownerNotes[record._id] || '',
            });
            message.success('Cập nhật yêu cầu giữ chỗ thành công');
            fetchReservations();
        } catch (error) {
            message.error(error.response?.data?.message || 'Cập nhật yêu cầu giữ chỗ thất bại');
        }
    };

    const columns = [
        {
            title: 'Bài viết',
            dataIndex: ['post', 'title'],
            key: 'post',
            render: (title, record) => (
                <Space direction="vertical" size={2}>
                    <strong>{title || 'Bài viết không tồn tại'}</strong>
                    <span>{record.post?.location || '-'}</span>
                    {record.post?.price ? <span>{record.post.price.toLocaleString('vi-VN')} VNĐ/tháng</span> : null}
                </Space>
            ),
        },
        {
            title: role === 'owner' ? 'Người giữ chỗ' : 'Chủ bài',
            key: 'person',
            render: (_, record) => {
                const person = role === 'owner' ? record.tenant : record.owner;
                return (
                    <Space direction="vertical" size={2}>
                        <span>{person?.fullName || record.tenantName || '-'}</span>
                        <span>{person?.phone || record.tenantPhone || '-'}</span>
                    </Space>
                );
            },
        },
        {
            title: 'Ngày xem phòng',
            dataIndex: 'visitDate',
            key: 'visitDate',
            render: (date) => (date ? dayjs(date).format('DD/MM/YYYY') : '-'),
        },
        {
            title: 'Hạn giữ chỗ',
            dataIndex: 'expiresAt',
            key: 'expiresAt',
            render: (date, record) =>
                record.status === 'accepted' && date ? dayjs(date).format('HH:mm DD/MM/YYYY') : '-',
        },
        {
            title: 'Ghi chú',
            dataIndex: 'note',
            key: 'note',
            render: (note) => note || '-',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (value) => <Tag color={statusMap[value]?.color}>{statusMap[value]?.text || value}</Tag>,
        },
        {
            title: 'Xử lý',
            key: 'action',
            render: (_, record) =>
                record.status === 'pending' ? (
                    role === 'owner' ? (
                        <Space direction="vertical" size={8}>
                            <Input.TextArea
                                rows={2}
                                placeholder="Ghi chú phản hồi"
                                value={ownerNotes[record._id] || ''}
                                onChange={(event) =>
                                    setOwnerNotes((prev) => ({ ...prev, [record._id]: event.target.value }))
                                }
                            />
                            <Space>
                                <Button type="primary" onClick={() => handleUpdate(record, 'accepted')}>
                                    Chấp nhận
                                </Button>
                                <Button danger onClick={() => handleUpdate(record, 'rejected')}>
                                    Từ chối
                                </Button>
                            </Space>
                        </Space>
                    ) : (
                        <Button danger onClick={() => handleUpdate(record, 'cancelled')}>
                            Hủy yêu cầu
                        </Button>
                    )
                ) : (
                    record.ownerNote || '-'
                ),
        },
    ];

    return (
        <Card>
            <Tabs
                activeKey={role}
                onChange={setRole}
                items={[
                    { key: 'owner', label: 'Yêu cầu nhận được' },
                    { key: 'tenant', label: 'Yêu cầu đã gửi' },
                ]}
            />

            <Space style={{ marginBottom: 16 }}>
                <Select
                    value={status}
                    onChange={setStatus}
                    style={{ width: 180 }}
                    options={[
                        { value: '', label: 'Tất cả trạng thái' },
                        { value: 'pending', label: 'Chờ xử lý' },
                        { value: 'accepted', label: 'Đã giữ chỗ' },
                        { value: 'rejected', label: 'Đã từ chối' },
                        { value: 'cancelled', label: 'Đã hủy' },
                        { value: 'expired', label: 'Hết hạn' },
                    ]}
                />
            </Space>

            <Table
                columns={columns}
                dataSource={reservations}
                rowKey="_id"
                loading={loading}
                pagination={{ pageSize: 8 }}
                scroll={{ x: 1100 }}
            />
        </Card>
    );
}

export default ManagerReservation;
