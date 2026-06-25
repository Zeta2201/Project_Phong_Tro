/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { Button, Card, Input, InputNumber, message, Modal, Select, Space, Table, Tag, Timeline } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { requestAdminAddDepositDisputeMessage, requestAdminDepositAction, requestGetAdminDeposits } from '../../../../config/request';
import { exportRowsToExcel, formatCurrency } from '../../../../utils/exportReport';

const statuses = ['pending', 'holding', 'completed', 'refunded', 'cancelled', 'disputed'];

function ManagerDeposits() {
    const [deposits, setDeposits] = useState([]);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [adminNote, setAdminNote] = useState('');
    const [refundAmount, setRefundAmount] = useState(0);
    const [adminMessage, setAdminMessage] = useState('');

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
            await requestAdminDepositAction({ depositId: selected._id, action, adminNote, refundAmount });
            message.success('Đã cập nhật giao dịch cọc');
            setSelected(null);
            setAdminNote('');
            setRefundAmount(0);
            fetchDeposits();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể xử lý giao dịch');
        }
    };

    const handleSendAdminMessage = async () => {
        if (!adminMessage.trim()) {
            message.warning('Vui lòng nhập tin nhắn');
            return;
        }
        try {
            await requestAdminAddDepositDisputeMessage({ depositId: selected._id, message: adminMessage });
            message.success('Đã gửi tin nhắn tranh chấp');
            setAdminMessage('');
            fetchDeposits();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể gửi tin nhắn');
        }
    };

    const handleExportExcel = () => {
        const summary = statuses.map((itemStatus) => ({
            'Trạng thái': itemStatus,
            'Số lượng': deposits.filter((deposit) => deposit.status === itemStatus).length,
            'Tổng tiền cọc': deposits
                .filter((deposit) => deposit.status === itemStatus)
                .reduce((sum, deposit) => sum + Number(deposit.amount || 0), 0),
        }));

        exportRowsToExcel({
            fileName: 'bao_cao_giao_dich_coc',
            sheets: [
                {
                    name: 'Tổng quan',
                    rows: [
                        { 'Chi tiêu': 'Tổng giao dịch cọc', 'Giá trị': deposits.length },
                        {
                            'Chi tiêu': 'Tổng tiền cọc',
                            'Giá trị': formatCurrency(deposits.reduce((sum, deposit) => sum + Number(deposit.amount || 0), 0)),
                        },
                        ...summary.map((item) => ({
                            'Chi tiêu': `Số giao dịch ${item['Trạng thái']}`,
                            'Giá trị': item['Số lượng'],
                        })),
                    ],
                },
                {
                    name: 'Giao dịch cọc',
                    rows: deposits.map((deposit) => ({
                        'Mã giao dịch': deposit._id || '',
                        Phong: deposit.room?.title || '',
                        'Người thuê': deposit.tenant?.fullName || '',
                        'Email người thuê': deposit.tenant?.email || '',
                        'Chủ trọ': deposit.landlord?.fullName || '',
                        'Email chủ trọ': deposit.landlord?.email || '',
                        'Tiền cọc': deposit.amount || 0,
                        'PTTT': deposit.paymentMethod || '',
                        'TT thanh toán': deposit.paymentStatus || '',
                        'TT giao dịch': deposit.status || '',
                        'Người thuê xác nhận': deposit.tenantConfirm ? 'Có' : 'Không',
                        'Chủ trọ xác nhận': deposit.landlordConfirm ? 'Có' : 'Không',
                        'Ngày tạo': deposit.createdAt ? dayjs(deposit.createdAt).format('DD/MM/YYYY HH:mm') : '',
                        'Hết hạn': deposit.expiredAt ? dayjs(deposit.expiredAt).format('DD/MM/YYYY HH:mm') : '',
                        'Ghi chú admin': deposit.adminNote || '',
                    })),
                },
            ],
        });
    };

    const columns = [
        { title: 'Mã GD', dataIndex: '_id', key: '_id', render: (id) => id.slice(-8).toUpperCase() },
        { title: 'Phòng', dataIndex: ['room', 'title'], key: 'room', render: (value) => value || '-' },
        { title: 'Người thuê', dataIndex: ['tenant', 'fullName'], key: 'tenant', render: (value) => value || '-' },
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
            <Space wrap style={{ marginBottom: 16 }}>
                <Select
                    value={status}
                    onChange={setStatus}
                    style={{ width: 220 }}
                    options={[{ value: '', label: 'Tất cả trạng thái' }, ...statuses.map((value) => ({ value, label: value }))]}
                />
                <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
                    Xuất Excel
                </Button>
            </Space>
            <Table columns={columns} dataSource={deposits} rowKey="_id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 1600 }} />
            <Modal title="Xử lý giao dịch cọc" open={Boolean(selected)} onCancel={() => setSelected(null)} footer={null} width={900}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Input.TextArea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} rows={4} placeholder="Ghi chú admin" />
                    {selected?.status === 'disputed' && (
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Card size="small" title="Bằng chứng tranh chấp">
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    {(selected?.dispute?.evidences || []).map((evidence) => (
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
                                    {!selected?.dispute?.evidences?.length && <span>Chưa có bằng chứng.</span>}
                                </Space>
                            </Card>
                            <Card size="small" title="Chat tranh chấp 3 bên">
                                <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
                                    {(selected?.dispute?.messages || []).map((item) => (
                                        <div key={item._id} style={{ marginBottom: 10 }}>
                                            <Tag color={item.role === 'admin' ? 'purple' : item.role === 'tenant' ? 'blue' : 'green'}>{item.role}</Tag>
                                            <span>{dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</span>
                                            <p style={{ margin: '4px 0 0' }}>{item.message}</p>
                                        </div>
                                    ))}
                                    {!selected?.dispute?.messages?.length && <span>Chưa có tin nhắn.</span>}
                                </div>
                                <Input.TextArea rows={3} value={adminMessage} onChange={(event) => setAdminMessage(event.target.value)} placeholder="Nhắn cho người thuê và chủ trọ" />
                                <Button style={{ marginTop: 8 }} onClick={handleSendAdminMessage}>Gửi tin nhắn</Button>
                            </Card>
                            <Card size="small" title="Timeline">
                                <Timeline
                                    items={(selected?.dispute?.timeline || []).map((item) => ({
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
                            <Card size="small" title="Quyết định chia tiền">
                                <Space wrap>
                                    <span>Hoàn cho người thuê</span>
                                    <InputNumber
                                        min={0}
                                        max={selected?.amount || 0}
                                        value={refundAmount}
                                        onChange={(value) => setRefundAmount(value || 0)}
                                        formatter={(value) => `${value || 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                        parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                                    />
                                    <span>Chuyển chủ trọ: {Number((selected?.amount || 0) - refundAmount).toLocaleString('vi-VN')} VND</span>
                                    <Button type="primary" onClick={() => runAction('split')}>Chia tiền</Button>
                                </Space>
                            </Card>
                        </Space>
                    )}
                    <Space wrap>
                        <Button type="primary" onClick={() => runAction('release')}>Giải ngân</Button>
                        <Button onClick={() => runAction('refund')}>Hoàn cọc</Button>
                        <Button danger onClick={() => runAction('dispute')}>Chuyển tranh chấp</Button>
                    </Space>
                </Space>
            </Modal>
        </Card>
    );
}

export default ManagerDeposits;
