/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Input, message, Modal, Select, Space, Table, Tabs, Tag, Timeline } from 'antd';
import dayjs from 'dayjs';
import { requestGetReservations, requestUpdateReservation } from '../../../../config/request';

const visitTimeOptions = [
    '07:00 - 08:00',
    '08:00 - 09:00',
    '09:00 - 10:00',
    '10:00 - 11:00',
    '14:00 - 15:00',
    '15:00 - 16:00',
    '16:00 - 17:00',
    '18:00 - 19:00',
].map((value) => ({ value, label: value }));

const statusMap = {
    pending: { color: 'orange', text: 'Chờ xác nhận' },
    accepted: { color: 'green', text: 'Đã xác nhận' },
    reschedule_requested: { color: 'blue', text: 'Đề xuất đổi lịch' },
    rejected: { color: 'red', text: 'Đã từ chối' },
    cancelled: { color: 'default', text: 'Đã hủy' },
    expired: { color: 'volcano', text: 'Hết hạn giữ chỗ' },
    viewed: { color: 'cyan', text: 'Đã xem phòng' },
    no_show: { color: 'magenta', text: 'Không đến' },
};

const actionLabels = {
    create_request: 'Gửi yêu cầu',
    accepted: 'Xác nhận lịch',
    rejected: 'Từ chối',
    cancelled: 'Hủy lịch',
    reschedule_requested: 'Đề xuất đổi lịch',
    viewed: 'Đã xem phòng',
    no_show: 'Không đến xem',
    reminder_sent: 'Nhắc lịch',
    expired: 'Hết hạn',
};

function ManagerViewingSchedule() {
    const [role, setRole] = useState('owner');
    const [status, setStatus] = useState('');
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [ownerNotes, setOwnerNotes] = useState({});
    const [rescheduleRecord, setRescheduleRecord] = useState(null);
    const [proposedVisitDate, setProposedVisitDate] = useState(null);
    const [proposedVisitTime, setProposedVisitTime] = useState('');

    const fetchReservations = async () => {
        setLoading(true);
        try {
            const res = await requestGetReservations({ role, status: status || undefined });
            setReservations(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Lấy danh sách lịch hẹn thất bại');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReservations();
    }, [role, status]);

    const handleUpdate = async (record, nextStatus, extra = {}) => {
        try {
            await requestUpdateReservation({
                id: record._id,
                status: nextStatus,
                ownerNote: ownerNotes[record._id] || '',
                ...extra,
            });
            message.success('Cập nhật lịch hẹn thành công');
            fetchReservations();
        } catch (error) {
            message.error(error.response?.data?.message || 'Cập nhật lịch hẹn thất bại');
        }
    };

    const openReschedule = (record) => {
        setRescheduleRecord(record);
        setProposedVisitDate(record.visitDate ? dayjs(record.visitDate) : null);
        setProposedVisitTime(record.visitTime || '');
    };

    const submitReschedule = async () => {
        if (!rescheduleRecord || !proposedVisitDate || !proposedVisitTime) {
            message.warning('Vui lòng chọn ngày và giờ để đề xuất mới');
            return;
        }
        await handleUpdate(rescheduleRecord, 'reschedule_requested', {
            proposedVisitDate: proposedVisitDate.toISOString(),
            proposedVisitTime,
        });
        setRescheduleRecord(null);
        setProposedVisitDate(null);
        setProposedVisitTime('');
    };

    const renderTimeline = (record) => {
        const items = (record.timeline || []).map((item) => ({
            children: (
                <Space direction="vertical" size={0}>
                    <span>{actionLabels[item.action] || item.action}</span>
                    <small>{item.createdAt ? dayjs(item.createdAt).format('HH:mm DD/MM/YYYY') : ''}</small>
                    {item.note ? <small>{item.note}</small> : null}
                </Space>
            ),
        }));

        if (!items.length) return '-';
        return <Timeline items={items} />;
    };

    const renderActions = (record) => {
        if (record.status === 'pending' && role === 'owner') {
            return (
                <Space direction="vertical" size={8}>
                    <Input.TextArea
                        rows={2}
                        placeholder="Ghi chú phản hồi (tùy chọn)"
                        value={ownerNotes[record._id] || ''}
                        onChange={(event) => setOwnerNotes((prev) => ({ ...prev, [record._id]: event.target.value }))}
                    />
                    <Space wrap>
                        <Button type="primary" onClick={() => handleUpdate(record, 'accepted')}>
                            Xác nhận
                        </Button>
                        <Button onClick={() => openReschedule(record)}>Đổi lịch</Button>
                        <Button danger onClick={() => handleUpdate(record, 'rejected')}>
                            Từ chối
                        </Button>
                    </Space>
                </Space>
            );
        }

        if (record.status === 'reschedule_requested' && role === 'tenant') {
            return (
                <Space wrap>
                    <Button type="primary" onClick={() => handleUpdate(record, 'accepted')}>
                        Đồng ý lịch mới
                    </Button>
                    <Button danger onClick={() => handleUpdate(record, 'cancelled')}>
                        Hủy
                    </Button>
                </Space>
            );
        }

        if (record.status === 'accepted') {
            return (
                <Space wrap>
                    <Button type="primary" onClick={() => handleUpdate(record, 'viewed')}>
                        Đã xem phòng
                    </Button>
                    {role === 'owner' ? (
                        <Button danger onClick={() => handleUpdate(record, 'no_show')}>
                            Không đến
                        </Button>
                    ) : (
                        <Button danger onClick={() => handleUpdate(record, 'cancelled')}>
                            Hủy lịch
                        </Button>
                    )}
                </Space>
            );
        }

        if (record.status === 'viewed' && role === 'tenant') {
            return (
                <Button type="primary" href={`/chi-tiet-tin-dang/${record.post?._id || record.postId?._id}`}>
                    Đặt cọc
                </Button>
            );
        }

        return record.ownerNote || record.tenantNote || '-';
    };

    const columns = [
        {
            title: 'Bài viết',
            dataIndex: ['post', 'title'],
            key: 'post',
            width: 260,
            render: (title, record) => (
                <Space direction="vertical" size={2}>
                    <strong>{title || 'Bài viết không tồn tại'}</strong>
                    <span>{record.post?.location || '-'}</span>
                    {record.post?.price ? <span>{record.post.price.toLocaleString('vi-VN')} VND/thang</span> : null}
                </Space>
            ),
        },
        {
            title: role === 'owner' ? 'Người thuê' : 'Chủ trọ',
            key: 'person',
            width: 180,
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
            title: 'Lịch xem',
            key: 'visit',
            width: 180,
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    <strong>{record.visitDate ? dayjs(record.visitDate).format('DD/MM/YYYY') : '-'}</strong>
                    <span>{record.visitTime || '-'}</span>
                    {record.status === 'reschedule_requested' ? (
                        <Tag color="blue">
                            Mới: {record.proposedVisitTime} {record.proposedVisitDate ? dayjs(record.proposedVisitDate).format('DD/MM/YYYY') : ''}
                        </Tag>
                    ) : null}
                </Space>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 150,
            render: (value) => <Tag color={statusMap[value]?.color}>{statusMap[value]?.text || value}</Tag>,
        },
        {
            title: 'Timeline',
            key: 'timeline',
            width: 240,
            render: (_, record) => renderTimeline(record),
        },
        {
            title: 'Xử lý',
            key: 'action',
            width: 300,
            render: (_, record) => renderActions(record),
        },
    ];

    return (
        <Card>
            <Tabs
                activeKey={role}
                onChange={setRole}
                items={[
                    { key: 'owner', label: 'Lịch hẹn nhận được' },
                    { key: 'tenant', label: 'Lịch hẹn đã gửi' },
                ]}
            />

            <Space style={{ marginBottom: 16 }}>
                <Select
                    value={status}
                    onChange={setStatus}
                    style={{ width: 210 }}
                    options={[
                        { value: '', label: 'Tất cả trạng thái' },
                        { value: 'pending', label: 'Chờ xác nhận' },
                        { value: 'accepted', label: 'Đã xác nhận' },
                        { value: 'reschedule_requested', label: 'Đề xuất đổi lịch' },
                        { value: 'viewed', label: 'Đã xem phòng' },
                        { value: 'rejected', label: 'Đã từ chối' },
                        { value: 'cancelled', label: 'Đã hủy' },
                        { value: 'expired', label: 'Đã hết hạn' },
                        { value: 'no_show', label: 'Không đến' },
                    ]}
                />
            </Space>

            <Table
                columns={columns}
                dataSource={reservations}
                rowKey="_id"
                loading={loading}
                pagination={{ pageSize: 8 }}
                scroll={{ x: 1350 }}
            />

            <Modal
                title="Đề xuất đổi lịch xem phòng"
                open={Boolean(rescheduleRecord)}
                onCancel={() => setRescheduleRecord(null)}
                onOk={submitReschedule}
                okText="Gửi đề xuất"
                cancelText="Hủy"
            >
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <DatePicker
                        value={proposedVisitDate}
                        onChange={setProposedVisitDate}
                        style={{ width: '100%' }}
                        format="DD/MM/YYYY"
                        placeholder="Chọn ngày mới"
                    />
                    <Select
                        value={proposedVisitTime}
                        onChange={setProposedVisitTime}
                        style={{ width: '100%' }}
                        placeholder="Chọn khung giờ mới"
                        options={visitTimeOptions}
                    />
                </Space>
            </Modal>
        </Card>
    );
}

export default ManagerViewingSchedule;
