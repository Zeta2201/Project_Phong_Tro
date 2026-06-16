/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Input, message, Modal, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import {
    requestCancelDeposit,
    requestCreateContract,
    requestDisputeDeposit,
    requestGetLandlordDeposits,
    requestGetMyDeposits,
    requestLandlordConfirmDeposit,
    requestPayDeposit,
    requestTenantConfirmDeposit,
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
                        <Button danger onClick={() => runAction(requestDisputeDeposit, deposit._id, 'Đã mở tranh chấp')}>
                            Tranh chấp
                        </Button>
                    )}
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
                    <Button danger onClick={() => runAction(requestDisputeDeposit, deposit._id, 'Đã mở tranh chấp')}>
                        Tranh chấp
                    </Button>
                )}
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
        </Card>
    );
}

export default ManagerDeposit;
