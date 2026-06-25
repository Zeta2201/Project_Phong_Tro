/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Input, message, Modal, Space, Table, Tag, Timeline, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
    requestAddDepositDisputeEvidence,
    requestAddDepositDisputeMessage,
    requestCancelDeposit,
    requestCreateContract,
    requestDisputeDeposit,
    requestGetLandlordDeposits,
    requestGetMyDeposits,
    requestLandlordConfirmDeposit,
    requestPayDeposit,
    requestTenantConfirmDeposit,
    requestUploadImages,
} from '../../../../config/request';

const statusMap = {
    pending: { color: 'orange', text: 'Chờ thanh toán' },
    holding: { color: 'blue', text: 'Đang giữ cọc' },
    completed: { color: 'green', text: 'Hoàn tất' },
    refunded: { color: 'cyan', text: 'Đã hoàn cọc' },
    cancelled: { color: 'default', text: 'Đã hủy' },
    disputed: { color: 'red', text: 'Tranh chấp' },
};

const paymentMap = {
    unpaid: { color: 'orange', text: 'Chưa thanh toán' },
    paid: { color: 'green', text: 'Đã thanh toán' },
    failed: { color: 'red', text: 'Thất bại' },
};

function ManagerDeposit({ role }) {
    const [deposits, setDeposits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [contractDeposit, setContractDeposit] = useState(null);
    const [contractDates, setContractDates] = useState([]);
    const [contractTerms, setContractTerms] = useState('');
    const [disputeDeposit, setDisputeDeposit] = useState(null);
    const [disputeNote, setDisputeNote] = useState('');
    const [disputeFiles, setDisputeFiles] = useState([]);
    const [disputeMessage, setDisputeMessage] = useState('');
    const [disputeSubmitting, setDisputeSubmitting] = useState(false);

    const fetchDeposits = async () => {
        setLoading(true);
        try {
            const res = role === 'tenant' ? await requestGetMyDeposits() : await requestGetLandlordDeposits();
            setDeposits(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Lấy danh sách cọc thất bại');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeposits();
    }, [role]);

    const runAction = async (request, depositId, successMessage) => {
        try {
            const res = await request({ depositId });
            message.success(successMessage);
            if (res.metadata?.redirectUrl) {
                window.location.href = res.metadata.redirectUrl;
                return;
            }
            fetchDeposits();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể cập nhật giao dịch');
        }
    };

    const uploadDisputeImages = async () => {
        const newFiles = disputeFiles.map((file) => file.originFileObj).filter(Boolean);
        if (!newFiles.length) return [];
        const formData = new FormData();
        newFiles.forEach((file) => formData.append('images', file));
        const res = await requestUploadImages(formData);
        return res.images || [];
    };

    const openDisputeModal = (deposit) => {
        setDisputeDeposit(deposit);
        setDisputeNote('');
        setDisputeFiles([]);
        setDisputeMessage('');
    };

    const refreshSelectedDispute = async () => {
        const res = role === 'tenant' ? await requestGetMyDeposits() : await requestGetLandlordDeposits();
        const nextDeposits = res.metadata || [];
        setDeposits(nextDeposits);
        const refreshed = nextDeposits.find((item) => item._id === disputeDeposit?._id);
        if (refreshed) setDisputeDeposit(refreshed);
    };

    const handleOpenDispute = async () => {
        if (!disputeNote.trim() && disputeFiles.length === 0) {
            message.warning('Vui lòng nhập lý do hoặc tải ảnh bằng chứng');
            return;
        }
        try {
            setDisputeSubmitting(true);
            const files = await uploadDisputeImages();
            await requestDisputeDeposit({ depositId: disputeDeposit._id, note: disputeNote, files });
            message.success('Đã mở tranh chấp và gửi bằng chứng');
            setDisputeDeposit(null);
            fetchDeposits();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể mở tranh chấp');
        } finally {
            setDisputeSubmitting(false);
        }
    };

    const handleAddEvidence = async () => {
        if (!disputeNote.trim() && disputeFiles.length === 0) {
            message.warning('Vui lòng nhập ghi chú hoặc tải ảnh bằng chứng');
            return;
        }
        try {
            setDisputeSubmitting(true);
            const files = await uploadDisputeImages();
            await requestAddDepositDisputeEvidence({ depositId: disputeDeposit._id, note: disputeNote, files });
            message.success('Đã gửi thêm bằng chứng');
            setDisputeNote('');
            setDisputeFiles([]);
            await refreshSelectedDispute();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể gửi bằng chứng');
        } finally {
            setDisputeSubmitting(false);
        }
    };

    const handleSendDisputeMessage = async () => {
        if (!disputeMessage.trim()) {
            message.warning('Vui lòng nhập nội dung tin nhắn');
            return;
        }
        try {
            await requestAddDepositDisputeMessage({ depositId: disputeDeposit._id, message: disputeMessage });
            message.success('Đã gửi tin nhắn tranh chấp');
            setDisputeMessage('');
            await refreshSelectedDispute();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể gửi tin nhắn');
        }
    };

    const renderActions = (deposit) => {
        if (role === 'tenant') {
            return (
                <Space wrap>
                    {deposit.status === 'pending' && deposit.paymentStatus === 'unpaid' && (
                        <Button type="primary" onClick={() => runAction(requestPayDeposit, deposit._id, 'Đã tạo thanh toán')}>
                            Thanh toán
                        </Button>
                    )}
                    {deposit.status === 'pending' && (
                        <Button danger onClick={() => runAction(requestCancelDeposit, deposit._id, 'Đã hủy yêu cầu cọc')}>
                            Hủy
                        </Button>
                    )}
                    {deposit.status === 'holding' && !deposit.tenantConfirm && (
                        <Button type="primary" onClick={() => runAction(requestTenantConfirmDeposit, deposit._id, 'Đã xác nhận nhận phòng')}>
                            Xác nhận nhận phòng
                        </Button>
                    )}
                    {deposit.status === 'holding' && (
                        <Button danger onClick={() => openDisputeModal(deposit)}>
                            Tranh chấp
                        </Button>
                    )}
                    {deposit.status === 'disputed' && <Button onClick={() => openDisputeModal(deposit)}>Theo dõi tranh chấp</Button>}
                </Space>
            );
        }

        return (
            <Space wrap>
                {deposit.status === 'holding' && !deposit.landlordConfirm && (
                    <Button type="primary" onClick={() => runAction(requestLandlordConfirmDeposit, deposit._id, 'Đã xác nhận cho thuê')}>
                        Xác nhận cho thuê
                    </Button>
                )}
                {deposit.status === 'holding' && (
                    <Button danger onClick={() => openDisputeModal(deposit)}>
                        Tranh chấp
                    </Button>
                )}
                {deposit.status === 'disputed' && <Button onClick={() => openDisputeModal(deposit)}>Theo dõi tranh chấp</Button>}
                {deposit.status === 'completed' && (
                    <Button type="primary" onClick={() => setContractDeposit(deposit)}>
                        Tạo hợp đồng
                    </Button>
                )}
            </Space>
        );
    };

    const handleCreateContract = async () => {
        if (!contractDates?.[0] || !contractDates?.[1]) {
            message.warning('Vui lòng chọn thời hạn hợp đồng');
            return;
        }

        try {
            await requestCreateContract({
                depositId: contractDeposit._id,
                startDate: contractDates[0].toISOString(),
                endDate: contractDates[1].toISOString(),
                terms: contractTerms,
            });
            message.success('Đã tạo hợp đồng thuê phòng');
            setContractDeposit(null);
            setContractDates([]);
            setContractTerms('');
        } catch (error) {
            message.error(error.response?.data?.message || 'Tạo hợp đồng thất bại');
        }
    };

    const columns = [
        { title: 'Mã giao dịch', dataIndex: '_id', key: '_id', render: (id) => id.slice(-8).toUpperCase() },
        { title: 'Phòng', dataIndex: ['room', 'title'], key: 'room', render: (title) => title || '-' },
        {
            title: role === 'tenant' ? 'Chủ trọ' : 'Người thuê',
            key: 'person',
            render: (_, record) => (role === 'tenant' ? record.landlord?.fullName : record.tenant?.fullName) || '-',
        },
        { title: 'Tiền cọc', dataIndex: 'amount', key: 'amount', render: (amount) => `${amount.toLocaleString('vi-VN')} VND` },
        { title: 'Thanh toán', dataIndex: 'paymentMethod', key: 'paymentMethod' },
        {
            title: 'TT thanh toán',
            dataIndex: 'paymentStatus',
            key: 'paymentStatus',
            render: (status) => <Tag color={paymentMap[status]?.color}>{paymentMap[status]?.text || status}</Tag>,
        },
        {
            title: 'TT giao dịch',
            dataIndex: 'status',
            key: 'status',
            render: (status) => <Tag color={statusMap[status]?.color}>{statusMap[status]?.text || status}</Tag>,
        },
        { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'createdAt', render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm') },
        { title: 'Hết hạn', dataIndex: 'expiredAt', key: 'expiredAt', render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm') },
        { title: 'Thao tác', key: 'actions', render: (_, record) => renderActions(record) },
    ];

    return (
        <Card>
            <Table columns={columns} dataSource={deposits} rowKey="_id" loading={loading} pagination={{ pageSize: 8 }} scroll={{ x: 1450 }} />
            <Modal
                title="Tạo hợp đồng thuê phòng"
                open={Boolean(contractDeposit)}
                onCancel={() => setContractDeposit(null)}
                onOk={handleCreateContract}
                okText="Tạo hợp đồng"
                cancelText="Hủy"
                width={720}
            >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <div>
                        <strong>Phòng:</strong> {contractDeposit?.room?.title || '-'}
                    </div>
                    <DatePicker.RangePicker
                        style={{ width: '100%' }}
                        format="DD/MM/YYYY"
                        value={contractDates}
                        onChange={(values) => setContractDates(values || [])}
                    />
                    <Input.TextArea
                        rows={6}
                        value={contractTerms}
                        onChange={(event) => setContractTerms(event.target.value)}
                        placeholder="Nhập điều khoản hợp đồng. Nếu bỏ trống, hệ thống sẽ sử dụng điều khoản mặc định." 
                    />
                </Space>
            </Modal>
            <Modal
                title={disputeDeposit?.status === 'disputed' ? 'Theo dõi tranh chấp đặt cọc' : 'Mở tranh chấp đặt cọc'}
                open={Boolean(disputeDeposit)}
                onCancel={() => setDisputeDeposit(null)}
                footer={null}
                width={820}
            >
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <div>
                        <strong>Phòng:</strong> {disputeDeposit?.room?.title || '-'}
                    </div>
                    <Input.TextArea
                        rows={4}
                        value={disputeNote}
                        onChange={(event) => setDisputeNote(event.target.value)}
                        placeholder="Mô tả vấn đề, thỏa thuận giữa hai bên hoặc ghi chú cho bằng chứng"
                    />
                    <Upload
                        multiple
                        accept="image/*"
                        listType="picture"
                        beforeUpload={() => false}
                        fileList={disputeFiles}
                        onChange={({ fileList }) => setDisputeFiles(fileList.slice(0, 10))}
                    >
                        <Button icon={<UploadOutlined />}>Tải ảnh bằng chứng</Button>
                    </Upload>
                    {disputeDeposit?.status === 'disputed' ? (
                        <Button loading={disputeSubmitting} onClick={handleAddEvidence}>
                            Gửi thêm bằng chứng
                        </Button>
                    ) : (
                        <Button type="primary" danger loading={disputeSubmitting} onClick={handleOpenDispute}>
                            Mở tranh chấp
                        </Button>
                    )}

                    {disputeDeposit?.status === 'disputed' && (
                        <>
                            <Card size="small" title="Bằng chứng đã gửi">
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    {(disputeDeposit?.dispute?.evidences || []).map((evidence) => (
                                        <div key={evidence._id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                                            <Tag>{evidence.role}</Tag>
                                            <span>{dayjs(evidence.createdAt).format('DD/MM/YYYY HH:mm')}</span>
                                            {evidence.note && <p style={{ margin: '8px 0' }}>{evidence.note}</p>}
                                            <Space wrap>
                                                {(evidence.files || []).map((file) => (
                                                    <a key={file} href={file} target="_blank" rel="noreferrer">
                                                        Xem ảnh
                                                    </a>
                                                ))}
                                            </Space>
                                        </div>
                                    ))}
                                    {!disputeDeposit?.dispute?.evidences?.length && <span>Chưa có bằng chứng.</span>}
                                </Space>
                            </Card>
                            <Card size="small" title="Chat tranh chấp 3 bên">
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                                        {(disputeDeposit?.dispute?.messages || []).map((item) => (
                                            <div key={item._id} style={{ marginBottom: 10 }}>
                                                <Tag color={item.role === 'admin' ? 'purple' : item.role === 'tenant' ? 'blue' : 'green'}>{item.role}</Tag>
                                                <span>{dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</span>
                                                <p style={{ margin: '4px 0 0' }}>{item.message}</p>
                                            </div>
                                        ))}
                                        {!disputeDeposit?.dispute?.messages?.length && <span>Chưa có tin nhắn.</span>}
                                    </div>
                                    <Input.TextArea
                                        rows={3}
                                        value={disputeMessage}
                                        onChange={(event) => setDisputeMessage(event.target.value)}
                                        placeholder="Nhập tin nhắn cho cuộc tranh chấp"
                                    />
                                    <Button onClick={handleSendDisputeMessage}>Gửi tin nhắn</Button>
                                </Space>
                            </Card>
                            <Card size="small" title="Timeline xử lý">
                                <Timeline
                                    items={(disputeDeposit?.dispute?.timeline || []).map((item) => ({
                                        children: (
                                            <div>
                                                <Tag>{item.role}</Tag>
                                                <strong>{item.action}</strong>
                                                <div>{dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</div>
                                                {item.note && <p>{item.note}</p>}
                                            </div>
                                        ),
                                    }))}
                                />
                            </Card>
                        </>
                    )}
                </Space>
            </Modal>
        </Card>
    );
}

export default ManagerDeposit;
