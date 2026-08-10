import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { requestAdminWithdrawAction, requestGetAdminWithdraws } from '../../../../config/request';

const statusMap = {
    pending: { color: 'orange', text: 'Chờ duyệt' },
    approved: { color: 'blue', text: 'Đã duyệt' },
    completed: { color: 'green', text: 'Hoàn tất' },
    rejected: { color: 'red', text: 'Từ chối' },
    cancelled: { color: 'default', text: 'Đã hủy' },
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

function ManagerWithdraws() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [actionTarget, setActionTarget] = useState(null);
    const [adminNote, setAdminNote] = useState('');

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await requestGetAdminWithdraws(status ? { status } : {});
            setRequests(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể tải yêu cầu rút tiền');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [status]);

    const openAction = (record, action) => {
        setActionTarget({ record, action });
        setAdminNote('');
    };

    const submitAction = async () => {
        try {
            await requestAdminWithdrawAction(actionTarget.record._id, {
                action: actionTarget.action,
                adminNote,
            });
            message.success('Đã cập nhật yêu cầu rút tiền');
            setActionTarget(null);
            await fetchRequests();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể cập nhật yêu cầu');
        }
    };

    const columns = [
        { title: 'Người yêu cầu', render: (_, record) => record.user?.fullName || '-' },
        { title: 'Email', render: (_, record) => record.user?.email || '-' },
        { title: 'Số tiền', dataIndex: 'amount', render: formatMoney },
        { title: 'Ngân hàng', dataIndex: 'bankName' },
        { title: 'Số tài khoản', dataIndex: 'bankAccountNumber' },
        { title: 'Chủ tài khoản', dataIndex: 'bankAccountName' },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (value) => <Tag color={statusMap[value]?.color}>{statusMap[value]?.text || value}</Tag>,
        },
        { title: 'Ngày tạo', dataIndex: 'createdAt', render: (date) => new Date(date).toLocaleString('vi-VN') },
        {
            title: 'Thao tác',
            fixed: 'right',
            render: (_, record) => (
                <Space wrap>
                    {record.status === 'pending' && <Button onClick={() => openAction(record, 'approve')}>Duyệt</Button>}
                    {['pending', 'approved'].includes(record.status) && (
                        <Button type="primary" onClick={() => openAction(record, 'complete')}>
                            Đã chuyển khoản
                        </Button>
                    )}
                    {['pending', 'approved'].includes(record.status) && (
                        <Button danger onClick={() => openAction(record, 'reject')}>
                            Từ chối
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Select
                    value={status}
                    style={{ width: 180 }}
                    onChange={setStatus}
                    options={[
                        { value: '', label: 'Tất cả trạng thái' },
                        { value: 'pending', label: 'Chờ duyệt' },
                        { value: 'approved', label: 'Đã duyệt' },
                        { value: 'completed', label: 'Hoàn tất' },
                        { value: 'rejected', label: 'Từ chối' },
                        { value: 'cancelled', label: 'Đã hủy' },
                    ]}
                />
            </Space>
            <Table rowKey="_id" columns={columns} dataSource={requests} loading={loading} scroll={{ x: 1200 }} />
            <Modal
                title="Xác nhận xử lý yêu cầu rút tiền"
                open={Boolean(actionTarget)}
                onCancel={() => setActionTarget(null)}
                onOk={submitAction}
                okText="Xác nhận"
                cancelText="Hủy"
            >
                <p>Số tiền: {formatMoney(actionTarget?.record?.amount)}</p>
                <Input.TextArea rows={4} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Ghi chú cho người dùng" />
            </Modal>
        </div>
    );
}

export default ManagerWithdraws;
