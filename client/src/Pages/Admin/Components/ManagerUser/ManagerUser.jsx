import { Table, Card, Row, Col, Statistic, Button, Space, Tag, Input, Select, message } from 'antd';
import { UserOutlined, UserAddOutlined, DollarOutlined } from '@ant-design/icons';
import classNames from 'classnames/bind';
import styles from './ManagerUser.module.scss';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestGetAdminStats, requestGetUsers, requestUpdateUserAdmin } from '../../../../config/request';
import { useStore } from '../../../../hooks/useStore';

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

            const data = usersPayload;

            const now = new Date();
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const newStats = {
                totalUsers: data.length,
                newUsers: data.filter((item) => new Date(item.user.createdAt) > thirtyDaysAgo).length,
                activeUsers: data.filter((item) => item.user.isActive).length,
                inactiveUsers: data.filter((item) => !item.user.isActive).length,
                totalRevenue,
            };

            setStats(newStats);
        } catch (error) {
            console.error(error);
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

            message.success(`Da ${record.user.isActive ? 'khoa' : 'mo khoa'} nguoi dung`);

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
            message.error(error?.response?.data?.message || 'Cap nhat trang thai that bai');
        }
    };

    const handleToggleAdmin = async (record) => {
        try {
            const nextIsAdmin = !record.user.isAdmin;

            await requestUpdateUserAdmin({
                id: record.user._id,
                isAdmin: nextIsAdmin,
            });

            message.success(`Da ${record.user.isAdmin ? 'go quyen admin' : 'dat quyen admin'} cho nguoi dung`);

            if (record.user._id === dataUser._id) {
                await fetchAuth();

                if (!nextIsAdmin) {
                    navigate('/');
                    return;
                }
            }

            await fetchData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Cap nhat quyen that bai');
        }
    };

    const columns = [
        {
            title: 'Ho va ten',
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
        },
        {
            title: 'Vai tro',
            dataIndex: ['user', 'isAdmin'],
            key: 'role',
            render: (isAdmin) => <Tag color={isAdmin ? 'purple' : 'blue'}>{isAdmin ? 'Admin' : 'User'}</Tag>,
        },
        {
            title: 'Trang thai',
            key: 'activeStatus',
            render: (_, record) => (
                <Tag color={record.user.isActive ? 'green' : 'red'}>
                    {record.user.isActive ? 'Hoat dong' : 'Bi khoa'}
                </Tag>
            ),
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
            render: (amount) => `${amount.toLocaleString('vi-VN')} VND`,
        },
        {
            title: 'Hanh dong',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button type="default" onClick={() => handleToggleActive(record)}>
                        {record.user.isActive ? 'Khoa' : 'Mo khoa'}
                    </Button>
                    <Button type="primary" danger={record.user.isAdmin} onClick={() => handleToggleAdmin(record)}>
                        {record.user.isAdmin ? 'Go admin' : 'Dat admin'}
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div className={cx('manager-user')}>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={24} md={12} lg={8}>
                    <Input.Search
                        placeholder="Tim theo ten, email hoac so dien thoai"
                        allowClear
                        enterButton="Tim"
                        onSearch={handleSearch}
                    />
                </Col>
                <Col xs={24} sm={12} md={6} lg={4}>
                    <Select
                        placeholder="Trang thai"
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
                        options={[
                            { label: 'Tat ca', value: '' },
                            { label: 'Hoat dong', value: 'active' },
                            { label: 'Khoa', value: 'inactive' },
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
                    scroll={{ x: 1500 }}
                    loading={loading}
                    rowKey={(record) => record.user._id}
                />
            </Card>
        </div>
    );
}

export default ManagerUser;
