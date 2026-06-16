/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Input, message, Modal, Select, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { requestCancelContract, requestGetContracts, requestSendContractEmail } from '../../../../config/request';

const statuses = [
    'draft',
    'waiting_tenant_signature',
    'waiting_landlord_signature',
    'active',
    'expired',
    'canceled',
];

const statusColors = {
    draft: 'default',
    waiting_tenant_signature: 'orange',
    waiting_landlord_signature: 'blue',
    active: 'green',
    expired: 'default',
    canceled: 'red',
};

function ManagerContracts() {
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [keyword, setKeyword] = useState('');
    const [selected, setSelected] = useState(null);
    const [canceling, setCanceling] = useState(null);
    const [cancelReason, setCancelReason] = useState('');

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const res = await requestGetContracts({ status: status || undefined, keyword: keyword || undefined });
            setContracts(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể tải danh sách hợp đồng');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, [status]);

    const handleCancel = async () => {
        try {
            await requestCancelContract({ contractId: canceling._id, reason: cancelReason });
            message.success('Đã hủy hợp đồng');
            setCanceling(null);
            setCancelReason('');
            fetchContracts();
        } catch (error) {
            message.error(error.response?.data?.message || 'Hủy hợp đồng thất bại');
        }
    };

    const handleSendEmail = async (contract) => {
        try {
            await requestSendContractEmail({ contractId: contract._id });
            message.success('Da gui lai email hop dong');
            fetchContracts();
        } catch (error) {
            message.error(error.response?.data?.message || 'Gui email hop dong that bai');
        }
    };

    const columns = [
        { title: 'Mã hợp đồng', dataIndex: 'contractCode', key: 'contractCode' },
        { title: 'Phòng', dataIndex: ['room', 'title'], key: 'room', render: (value) => value || '-' },
        { title: 'Người thuê', dataIndex: ['tenant', 'fullName'], key: 'tenant', render: (value) => value || '-' },
        { title: 'Chủ trọ', dataIndex: ['landlord', 'fullName'], key: 'landlord', render: (value) => value || '-' },
        { title: 'Giá thuê', dataIndex: 'monthlyRent', key: 'monthlyRent', render: (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND` },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (value) => <Tag color={statusColors[value]}>{value}</Tag>,
        },
        { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'createdAt', render: (value) => dayjs(value).format('DD/MM/YYYY HH:mm') },
        { title: 'Người thuê ký', dataIndex: 'tenantSignedAt', key: 'tenantSignedAt', render: (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-') },
        { title: 'Chủ trọ ký', dataIndex: 'landlordSignedAt', key: 'landlordSignedAt', render: (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-') },
        {
            title: 'Thao tác',
            key: 'actions',
            render: (_, record) => (
                <Space wrap>
                    <Button onClick={() => setSelected(record)}>Chi tiết</Button>
                    {record.pdfUrl && (
                        <Button href={`http://localhost:3000/api/contracts/download?id=${record._id}`} target="_blank">
                            Tải PDF
                        </Button>
                    )}
                    {record.status === 'active' && (
                        <Button onClick={() => handleSendEmail(record)}>
                            Gui lai email
                        </Button>
                    )}
                    {!['canceled', 'expired'].includes(record.status) && (
                        <Button danger onClick={() => setCanceling(record)}>
                            Hủy
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card>
            <Space wrap style={{ marginBottom: 16 }}>
                <Input.Search
                    placeholder="Tìm theo mã hợp đồng"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    onSearch={fetchContracts}
                    style={{ width: 280 }}
                    allowClear
                />
                <Select
                    value={status}
                    onChange={setStatus}
                    style={{ width: 260 }}
                    options={[{ value: '', label: 'Tất cả trạng thái' }, ...statuses.map((value) => ({ value, label: value }))]}
                />
                <Button onClick={fetchContracts}>Tải lại</Button>
            </Space>

            <Table columns={columns} dataSource={contracts} rowKey="_id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 1800 }} />

            <Modal title="Chi tiết hợp đồng" open={Boolean(selected)} onCancel={() => setSelected(null)} footer={null} width={920}>
                {selected && (
                    <Descriptions bordered column={2}>
                        <Descriptions.Item label="Mã hợp đồng">{selected.contractCode}</Descriptions.Item>
                        <Descriptions.Item label="Trạng thái"><Tag color={statusColors[selected.status]}>{selected.status}</Tag></Descriptions.Item>
                        <Descriptions.Item label="Phòng">{selected.room?.title}</Descriptions.Item>
                        <Descriptions.Item label="Địa chỉ">{selected.room?.location}</Descriptions.Item>
                        <Descriptions.Item label="Người thuê">{selected.tenant?.fullName}</Descriptions.Item>
                        <Descriptions.Item label="Email người thuê">{selected.tenant?.email}</Descriptions.Item>
                        <Descriptions.Item label="Chủ trọ">{selected.landlord?.fullName}</Descriptions.Item>
                        <Descriptions.Item label="Email chủ trọ">{selected.landlord?.email}</Descriptions.Item>
                        <Descriptions.Item label="Giá thuê">{Number(selected.monthlyRent || 0).toLocaleString('vi-VN')} VND</Descriptions.Item>
                        <Descriptions.Item label="Tiền cọc">{Number(selected.depositAmount || 0).toLocaleString('vi-VN')} VND</Descriptions.Item>
                        <Descriptions.Item label="Ngày bắt đầu">{dayjs(selected.startDate).format('DD/MM/YYYY')}</Descriptions.Item>
                        <Descriptions.Item label="Ngày kết thúc">{dayjs(selected.endDate).format('DD/MM/YYYY')}</Descriptions.Item>
                        <Descriptions.Item label="Người thuê ký">{selected.tenantSignedAt ? dayjs(selected.tenantSignedAt).format('DD/MM/YYYY HH:mm') : '-'}</Descriptions.Item>
                        <Descriptions.Item label="Chủ trọ ký">{selected.landlordSignedAt ? dayjs(selected.landlordSignedAt).format('DD/MM/YYYY HH:mm') : '-'}</Descriptions.Item>
                        <Descriptions.Item label="Gửi cho người thuê">{selected.sentToTenantAt ? dayjs(selected.sentToTenantAt).format('DD/MM/YYYY HH:mm') : '-'}</Descriptions.Item>
                        <Descriptions.Item label="Gửi cho chủ trọ">{selected.sentToLandlordAt ? dayjs(selected.sentToLandlordAt).format('DD/MM/YYYY HH:mm') : '-'}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>

            <Modal
                title="Hủy hợp đồng"
                open={Boolean(canceling)}
                onCancel={() => setCanceling(null)}
                onOk={handleCancel}
                okText="Hủy hợp đồng"
                okButtonProps={{ danger: true }}
                cancelText="Đóng"
            >
                <Input.TextArea rows={4} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Lý do hủy hợp đồng" />
            </Modal>
        </Card>
    );
}

export default ManagerContracts;
