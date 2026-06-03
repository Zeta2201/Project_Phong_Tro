/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Button, Card, Row, Col, Statistic, Table, Space, message } from 'antd';
import { DownloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import moment from 'moment';
import axios from 'axios';
import { requestGetRechargeStats } from '../../../../config/request';
import { exportRowsToExcel, formatCurrency } from '../../../../utils/exportReport';

function ManagerRechange() {
    const [rechargeStats, setRechargeStats] = useState({
        totalTransactions: 0,
        totalRevenue: 0,
        recentTransactions: 0,
        transactionGrowth: 0,
        recentRevenue: 0,
        revenueGrowth: 0,
    });
    const [rechargeData, setRechargeData] = useState([]);
    const [loading, setLoading] = useState(false);

    const columns = [
        {
            title: 'Người dùng',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: 'Số tiền',
            dataIndex: 'amount',
            key: 'amount',
            render: (amount) => `${amount.toLocaleString('vi-VN')} VNĐ`,
        },
        {
            title: 'Phương thức',
            dataIndex: 'typePayment',
            key: 'typePayment',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <span style={{ color: status === 'success' ? '#52c41a' : '#ff4d4f' }}>
                    {status === 'success' ? 'Thành công' : 'Thất bại'}
                </span>
            ),
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => moment(date).format('DD/MM/YYYY HH:mm'),
        },
    ];

    const fetchRechargeData = async () => {
        try {
            setLoading(true);
            const response = await requestGetRechargeStats();
            const { metadata } = response;

            setRechargeStats({
                totalTransactions: metadata.totalTransactions,
                totalRevenue: metadata.totalRevenue,
                recentTransactions: metadata.recentTransactions,
                transactionGrowth: metadata.transactionGrowth,
                recentRevenue: metadata.recentRevenue,
                revenueGrowth: metadata.revenueGrowth,
            });

            setRechargeData(metadata.transactions);
        } catch (error) {
            console.error('Error fetching recharge data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRechargeData();
    }, []);

    const handleExportExcel = async () => {
        try {
            const response = await requestGetRechargeStats({ export: 'all' });
            const metadata = response.metadata || {};
            const transactions = metadata.transactions || rechargeData;

            exportRowsToExcel({
                fileName: 'bao_cao_giao_dich',
                sheets: [
                    {
                        name: 'Tổng quan',
                        rows: [
                            { 'Chi tiêu': 'Tổng số giao dịch', 'Giá trị': metadata.totalTransactions ?? rechargeStats.totalTransactions },
                            { 'Chi tiêu': 'Tổng doanh thu', 'Giá trị': formatCurrency(metadata.totalRevenue ?? rechargeStats.totalRevenue) },
                            { 'Chi tiêu': 'Giao dịch gần đây', 'Giá trị': metadata.recentTransactions ?? rechargeStats.recentTransactions },
                            { 'Chi tiêu': 'Tăng trưởng giao dịch', 'Giá trị': `${metadata.transactionGrowth ?? rechargeStats.transactionGrowth}%` },
                            { 'Chi tiêu': 'Doanh thu gần đây', 'Giá trị': formatCurrency(metadata.recentRevenue ?? rechargeStats.recentRevenue) },
                            { 'Chi tiêu': 'Tăng trưởng doanh thu', 'Giá trị': `${metadata.revenueGrowth ?? rechargeStats.revenueGrowth}%` },
                        ],
                    },
                    {
                        name: 'Giao dịch',
                        rows: transactions.map((item) => ({
                            'Người dùng': item.username || '',
                            'Số tiền': item.amount || 0,
                            'Phương thức': item.typePayment || '',
                            'Trạng thái': item.status || '',
                            'Ngày tạo': item.createdAt ? moment(item.createdAt).format('DD/MM/YYYY HH:mm') : '',
                        })),
                    },
                ],
            });
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể xuất báo cáo giao dịch');
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Row gutter={16}>
                    <Col span={12}>
                        <Card>
                            <Statistic
                                title="Tổng số giao dịch"
                                value={rechargeStats.totalTransactions}
                                loading={loading}
                            />
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card>
                            <Statistic
                                title="Tổng doanh thu"
                                value={rechargeStats.totalRevenue}
                                loading={loading}
                                formatter={(value) => `${value.toLocaleString('vi-VN')} VNĐ`}
                            />
                        </Card>
                    </Col>
                </Row>

                <Card
                    title="Danh sách giao dịch gần đây"
                    extra={
                        <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
                            Xuất Excel
                        </Button>
                    }
                >
                    <Table
                        columns={columns}
                        dataSource={rechargeData}
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                    />
                </Card>
            </Space>
        </div>
    );
}

export default ManagerRechange;
