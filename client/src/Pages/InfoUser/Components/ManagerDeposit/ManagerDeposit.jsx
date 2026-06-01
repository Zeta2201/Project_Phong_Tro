/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { Button, Card, message, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import {
    requestCancelDeposit,
    requestDisputeDeposit,
    requestGetLandlordDeposits,
    requestGetMyDeposits,
    requestLandlordConfirmDeposit,
    requestPayDeposit,
    requestTenantConfirmDeposit,
} from '../../../../config/request';

const statusMap = {
    pending: { color: 'orange', text: 'Cho thanh toan' },
    holding: { color: 'blue', text: 'Dang giu coc' },
    completed: { color: 'green', text: 'Hoan tat' },
    refunded: { color: 'cyan', text: 'Da hoan coc' },
    cancelled: { color: 'default', text: 'Da huy' },
    disputed: { color: 'red', text: 'Tranh chap' },
};

const paymentMap = {
    unpaid: { color: 'orange', text: 'Chua thanh toan' },
    paid: { color: 'green', text: 'Da thanh toan' },
    failed: { color: 'red', text: 'That bai' },
};

function ManagerDeposit({ role }) {
    const [deposits, setDeposits] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchDeposits = async () => {
        setLoading(true);
        try {
            const res = role === 'tenant' ? await requestGetMyDeposits() : await requestGetLandlordDeposits();
            setDeposits(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Lay danh sach coc that bai');
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
            message.error(error.response?.data?.message || 'Khong the cap nhat giao dich');
        }
    };

    const renderActions = (deposit) => {
        if (role === 'tenant') {
            return (
                <Space wrap>
                    {deposit.status === 'pending' && deposit.paymentStatus === 'unpaid' && (
                        <Button type="primary" onClick={() => runAction(requestPayDeposit, deposit._id, 'Da tao thanh toan')}>
                            Thanh toan
                        </Button>
                    )}
                    {deposit.status === 'pending' && (
                        <Button danger onClick={() => runAction(requestCancelDeposit, deposit._id, 'Da huy yeu cau coc')}>
                            Huy
                        </Button>
                    )}
                    {deposit.status === 'holding' && !deposit.tenantConfirm && (
                        <Button type="primary" onClick={() => runAction(requestTenantConfirmDeposit, deposit._id, 'Da xac nhan nhan phong')}>
                            Xac nhan nhan phong
                        </Button>
                    )}
                    {deposit.status === 'holding' && (
                        <Button danger onClick={() => runAction(requestDisputeDeposit, deposit._id, 'Da mo tranh chap')}>
                            Tranh chap
                        </Button>
                    )}
                </Space>
            );
        }

        return (
            <Space wrap>
                {deposit.status === 'holding' && !deposit.landlordConfirm && (
                    <Button type="primary" onClick={() => runAction(requestLandlordConfirmDeposit, deposit._id, 'Da xac nhan cho thue')}>
                        Xac nhan cho thue
                    </Button>
                )}
                {deposit.status === 'holding' && (
                    <Button danger onClick={() => runAction(requestDisputeDeposit, deposit._id, 'Da mo tranh chap')}>
                        Tranh chap
                    </Button>
                )}
            </Space>
        );
    };

    const columns = [
        { title: 'Ma giao dich', dataIndex: '_id', key: '_id', render: (id) => id.slice(-8).toUpperCase() },
        { title: 'Phong', dataIndex: ['room', 'title'], key: 'room', render: (title) => title || '-' },
        {
            title: role === 'tenant' ? 'Chu tro' : 'Nguoi thue',
            key: 'person',
            render: (_, record) => (role === 'tenant' ? record.landlord?.fullName : record.tenant?.fullName) || '-',
        },
        { title: 'Tien coc', dataIndex: 'amount', key: 'amount', render: (amount) => `${amount.toLocaleString('vi-VN')} VND` },
        { title: 'Thanh toan', dataIndex: 'paymentMethod', key: 'paymentMethod' },
        {
            title: 'TT thanh toan',
            dataIndex: 'paymentStatus',
            key: 'paymentStatus',
            render: (status) => <Tag color={paymentMap[status]?.color}>{paymentMap[status]?.text || status}</Tag>,
        },
        {
            title: 'TT giao dich',
            dataIndex: 'status',
            key: 'status',
            render: (status) => <Tag color={statusMap[status]?.color}>{statusMap[status]?.text || status}</Tag>,
        },
        { title: 'Ngay tao', dataIndex: 'createdAt', key: 'createdAt', render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm') },
        { title: 'Het han', dataIndex: 'expiredAt', key: 'expiredAt', render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm') },
        { title: 'Thao tac', key: 'actions', render: (_, record) => renderActions(record) },
    ];

    return (
        <Card>
            <Table columns={columns} dataSource={deposits} rowKey="_id" loading={loading} pagination={{ pageSize: 8 }} scroll={{ x: 1450 }} />
        </Card>
    );
}

export default ManagerDeposit;
