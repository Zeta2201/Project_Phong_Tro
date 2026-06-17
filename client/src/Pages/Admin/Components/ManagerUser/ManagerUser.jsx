/* eslint-disable react-hooks/exhaustive-deps */
import { Table, Card, Row, Col, Statistic, Button, Space, Tag, Input, Select, message, Popconfirm } from 'antd';
import { DownloadOutlined, UserOutlined, UserAddOutlined, DollarOutlined } from '@ant-design/icons';
import classNames from 'classnames/bind';
import styles from './ManagerUser.module.scss';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestGetAdminStats, requestGetUsers, requestUpdateUserAdmin, requestUpdateVerificationStatus } from '../../../../config/request';
import { useStore } from '../../../../hooks/useStore';
import { exportRowsToExcel, formatCurrency } from '../../../../utils/exportReport';

const cx = classNames.bind(styles);

function ManagerUser() {
    const navigate = useNavigate();
    const { dataUser, fetchAuth, clearAuthState } = useStore();
    const [userData, setUserData] = useState([]);
    const [stats, setStats] = useState({
        totalUsers: 0,
        newUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        totalRevenue: 0,
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, statsRes] = await Promise.all([
                requestGetUsers({
                    q: searchQuery || undefined,
                    status: statusFilter || undefined,
                    role: roleFilter || undefined,
                }),
                requestGetAdminStats().catch(() => null),
            ]);

            const usersPayload = Array.isArray(usersRes.metadata) ? usersRes.metadata : usersRes.metadata?.users || [];
            const summaryPayload = Array.isArray(usersRes.metadata) ? null : usersRes.metadata?.summary;

            setUserData(usersPayload);

            const totalRevenueFromUsers = usersPayload.reduce((sum, item) => sum + (item.totalSpent || 0), 0);
            const totalRevenue =
                typeof summaryPayload?.totalRevenue === 'number'
                    ? summaryPayload.totalRevenue
                    : typeof statsRes?.metadata?.totalRevenue === 'number'
                      ? statsRes.metadata.totalRevenue
                      : totalRevenueFromUsers;

            const now = new Date();
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            setStats({
                totalUsers: usersPayload.length,
                newUsers: usersPayload.filter((item) => new Date(item.user.createdAt) > thirtyDaysAgo).length,
                activeUsers: usersPayload.filter((item) => item.user.isActive).length,
                inactiveUsers: usersPayload.filter((item) => !item.user.isActive).length,
                totalRevenue,
            });
        } catch (error) {
            console.error(error);
            message.error(error?.response?.data?.message || 'Khong the tai danh sach nguoi dung');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [searchQuery, statusFilter, roleFilter]);

    const handleSearch = (value) => {
        setSearchQuery(value.trim());
    };

    const handleToggleActive = async (record) => {
        try {
            const nextIsActive = !record.user.isActive;

            await requestUpdateUserAdmin({
                id: record.user._id,
                isActive: nextIsActive,
            });

            message.success(nextIsActive ? 'Da mo khoa nguoi dung' : 'Da khoa nguoi dung');

            if (record.user._id === dataUser._id) {
                if (!nextIsActive) {
                    clearAuthState();
                    navigate('/login');
                    return;
                }
                await fetchAuth();
            }

            await fetchData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Khong the cap nhat trang thai');
        }
    };

    const handleToggleAdmin = async (record) => {
        try {
            const nextIsAdmin = !record.user.isAdmin;

            await requestUpdateUserAdmin({
                id: record.user._id,
                isAdmin: nextIsAdmin,
            });

            message.success(nextIsAdmin ? 'Da cap quyen admin' : 'Da go quyen admin');

            if (record.user._id === dataUser._id) {
                await fetchAuth();
                if (!nextIsAdmin) {
                    navigate('/');
                    return;
                }
            }

            await fetchData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Khong the cap nhat quyen');
        }
    };

    const handleVerificationAction = async (record, status) => {
        try {
            await requestUpdateVerificationStatus({
                id: record.user._id,
                status,
                reason: status === 'rejected' ? 'Thong tin CCCD chua hop le hoac anh khong ro' : '',
            });
            message.success(status === 'verified' ? 'Da xac thuc chu tro' : 'Da tu choi xac thuc');
            await fetchData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Khong the cap nhat xac thuc');
        }
    };

    const getVerificationConfig = (status) =>
        ({
            none: { color: 'default', text: 'Chua gui' },
            pending: { color: 'orange', text: 'Cho duyet' },
            verified: { color: 'green', text: 'Da xac thuc' },
            rejected: { color: 'red', text: 'Tu choi' },
        })[status || 'none'] || { color: 'default', text: status };

    const handleExportExcel = () => {
        exportRowsToExcel({
            fileName: 'bao_cao_nguoi_dung',
            sheets: [
                {
                    name: 'Tong quan',
                    rows: [
                        { 'Chi tieu': 'Tong so nguoi dung', 'Gia tri': stats.totalUsers },
                        { 'Chi tieu': 'Nguoi dung moi 30 ngay', 'Gia tri': stats.newUsers },
                        { 'Chi tieu': 'Nguoi dung hoat dong', 'Gia tri': stats.activeUsers },
                        { 'Chi tieu': 'Nguoi dung bi khoa', 'Gia tri': stats.inactiveUsers },
                        { 'Chi tieu': 'Tong doanh thu', 'Gia tri': formatCurrency(stats.totalRevenue) },
                    ],
                },
                {
                    name: 'Nguoi dung',
                    rows: userData.map((item) => ({
                        'Ho ten': item.user?.fullName || '',
                        Email: item.user?.email || '',
                        'So dien thoai': item.user?.phone || '',
                        'Dia chi': item.user?.address || '',
                        'Vai tro': item.user?.isAdmin ? 'Admin' : 'User',
                        'Trang thai': item.user?.isActive ? 'Hoat dong' : 'Bi khoa',
                        'Xac thuc CCCD': getVerificationConfig(item.user?.verificationStatus).text,
                        'So CCCD': item.user?.cccdNumber || '',
                        'Ngay tham gia': item.user?.createdAt ? new Date(item.user.createdAt).toLocaleString('vi-VN') : '',
                        'So bai dang': item.totalPost || 0,
                        'Tong chi tieu': item.totalSpent || 0,
                    })),
                },
            ],
        });
    };

    const columns = [
        {
            title: 'Ho ten',
            dataIndex: ['user', 'fullName'],
            key: 'fullName',
        },
        {
            title: 'Email',
            dataIndex: ['user', 'email'],
            key: 'email',
        },
        {
            title: 'So dien thoai',
            dataIndex: ['user', 'phone'],
            key: 'phone',
        },
        {
            title: 'Dia chi',
            dataIndex: ['user', 'address'],
            key: 'address',
            ellipsis: true,
        },
        {
            title: 'Vai tro',
            dataIndex: ['user', 'isAdmin'],
            key: 'role',
            render: (isAdmin) => <Tag color={isAdmin ? 'purple' : 'blue'}>{isAdmin ? 'Admin' : 'User'}</Tag>,
        },
        {
            title: 'Xac thuc CCCD',
            key: 'verificationStatus',
            render: (_, record) => {
                const config = getVerificationConfig(record.user.verificationStatus);
                return (
                    <Space direction="vertical" size={4}>
                        <Tag color={config.color}>{config.text}</Tag>
                        {record.user.cccdFullName && <span>{record.user.cccdFullName}</span>}
                        {record.user.cccdNumber && <span>CCCD: {record.user.cccdNumber}</span>}
                        {record.user.cccdDob && <span>NS: {record.user.cccdDob}</span>}
                        {record.user.cccdImageUrl && (
                            <a href={record.user.cccdImageUrl} target="_blank" rel="noreferrer">
                                Xem anh CCCD
                            </a>
                        )}
                    </Space>
                );
            },
        },
        {
            title: 'Trang thai',
            key: 'activeStatus',
            render: (_, record) => <Tag color={record.user.isActive ? 'green' : 'red'}>{record.user.isActive ? 'Hoat dong' : 'Bi khoa'}</Tag>,
        },
        {
            title: 'Ngay tham gia',
            dataIndex: ['user', 'createdAt'],
            key: 'joinDate',
            render: (date) => new Date(date).toLocaleDateString('vi-VN'),
        },
        {
            title: 'So bai dang',
            dataIndex: 'totalPost',
            key: 'totalPost',
        },
        {
            title: 'Tong chi tieu',
            dataIndex: 'totalSpent',
            key: 'totalSpent',
            render: (amount = 0) => `${amount.toLocaleString('vi-VN')} VND`,
        },
        {
            title: 'Hanh dong',
            key: 'action',
            fixed: 'right',
            render: (_, record) => (
                <Space size="middle" wrap>
                    <Button type="default" onClick={() => handleToggleActive(record)}>
                        {record.user.isActive ? 'Khoa' : 'Mo khoa'}
                    </Button>
                    <Button type="primary" danger={record.user.isAdmin} onClick={() => handleToggleAdmin(record)}>
                        {record.user.isAdmin ? 'Go admin' : 'Cap admin'}
                    </Button>
                    {record.user.verificationStatus === 'pending' && (
                        <>
                            <Button type="primary" onClick={() => handleVerificationAction(record, 'verified')}>
                                Duyet CCCD
                            </Button>
                            <Popconfirm
                                title="Tu choi xac thuc CCCD?"
                                onConfirm={() => handleVerificationAction(record, 'rejected')}
                                okText="Tu choi"
                                cancelText="Huy"
                            >
                                <Button danger>Tu choi CCCD</Button>
                            </Popconfirm>
                        </>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div className={cx('manager-user')}>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={24} md={12} lg={8}>
                    <Input.Search placeholder="Tim theo ten, email hoac so dien thoai" allowClear enterButton="Tim" onSearch={handleSearch} />
                </Col>
                <Col xs={24} sm={12} md={6} lg={4}>
                    <Select
                        placeholder="Trang thai"
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
                        options={[
                            { label: 'Tat ca', value: '' },
                            { label: 'Hoat dong', value: 'active' },
                            { label: 'Bi khoa', value: 'inactive' },
                        ]}
                        style={{ width: '100%' }}
                    />
                </Col>
                <Col xs={24} sm={12} md={6} lg={4}>
                    <Select
                        placeholder="Vai tro"
                        value={roleFilter}
                        onChange={(value) => setRoleFilter(value)}
                        options={[
                            { label: 'Tat ca', value: '' },
                            { label: 'Admin', value: 'admin' },
                            { label: 'User', value: 'user' },
                        ]}
                        style={{ width: '100%' }}
                    />
                </Col>
                <Col xs={24} sm={12} md={6} lg={4}>
                    <Button icon={<DownloadOutlined />} onClick={handleExportExcel} block>
                        Xuat Excel
                    </Button>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Card>
                        <Statistic title="Tong so nguoi dung" value={stats.totalUsers} prefix={<UserOutlined />} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Nguoi dung moi"
                            value={stats.newUsers}
                            prefix={<UserAddOutlined />}
                            valueStyle={{ color: '#3f8600' }}
                        />
                    </Card>
                </Col>

                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Tong doanh thu"
                            value={stats.totalRevenue}
                            prefix={<DollarOutlined />}
                            formatter={(value) => `${value.toLocaleString('vi-VN')} VND`}
                            valueStyle={{ color: '#cf1322' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Card style={{ marginTop: 16 }}>
                <Table
                    columns={columns}
                    dataSource={userData}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1800 }}
                    loading={loading}
                    rowKey={(record) => record.user._id}
                />
            </Card>
        </div>
    );
}

export default ManagerUser;
