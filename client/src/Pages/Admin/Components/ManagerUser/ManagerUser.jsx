/* eslint-disable react-hooks/exhaustive-deps */
import { Table, Card, Row, Col, Statistic, Button, Space, Tag, Input, Select, message } from 'antd';
import { DownloadOutlined, UserOutlined, UserAddOutlined, DollarOutlined } from '@ant-design/icons';
import classNames from 'classnames/bind';
import styles from './ManagerUser.module.scss';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestGetAdminStats, requestGetUsers, requestUpdateUserAdmin } from '../../../../config/request';
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

            message.success(`Đã ${record.user.isActive ? 'khóa' : 'mở khóa'} người dùng`);

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
            message.error(error?.response?.data?.message || 'Không thể cập nhật trạng thái');
        }
    };

    const handleToggleAdmin = async (record) => {
        try {
            const nextIsAdmin = !record.user.isAdmin;

            await requestUpdateUserAdmin({
                id: record.user._id,
                isAdmin: nextIsAdmin,
            });

            message.success(`Đã ${record.user.isAdmin ? 'gỡ quyền admin' : 'cấp quyền admin'} cho người dùng`);

            if (record.user._id === dataUser._id) {
                await fetchAuth();

                if (!nextIsAdmin) {
                    navigate('/');
                    return;
                }
            }

            await fetchData();
        } catch (error) {
            message.error(error?.response?.data?.message || 'Không thể cập nhật quyền');
        }
    };

    const handleExportExcel = () => {
        exportRowsToExcel({
            fileName: 'bao_cao_nguoi_dung',
            sheets: [
                {
                    name: 'Tổng quan',
                    rows: [
                        { 'Chi tiêu': 'ổng số người dùng', 'Giá trị': stats.totalUsers },
                        { 'Chi tiêu': 'Người dùng mới 30 ngày', 'Giá trị': stats.newUsers },
                        { 'Chi tiêu': 'Người dùng hoạt động', 'Giá trị': stats.activeUsers },
                        { 'Chi tiêu': 'Người dùng bị khóa', 'Giá trị': stats.inactiveUsers },
                        { 'Chi tiêu': 'Tổng doanh thu', 'Giá trị': formatCurrency(stats.totalRevenue) },
                    ],
                },
                {
                    name: 'Người dùng',
                    rows: userData.map((item) => ({
                        'Họ và tên': item.user?.fullName || '',
                        Email: item.user?.email || '',
                        'Số điện thoại': item.user?.phone || '',
                        'Địa chỉ': item.user?.address || '',
                        'Vai trò': item.user?.isAdmin ? 'Admin' : 'User',
                        'Trạng thái': item.user?.isActive ? 'Hoạt động' : 'Bị khóa',
                        'Ngày tham gia': item.user?.createdAt ? new Date(item.user.createdAt).toLocaleString('vi-VN') : '',
                        'Số bài đăng': item.totalPost || 0,
                        'Tổng chi tiêu': item.totalSpent || 0,
                    })),
                },
            ],
        });
    };

    const columns = [
        {
            title: 'Họ và tên',
            dataIndex: ['user', 'fullName'],
            key: 'fullName',
        },
        {
            title: 'Email',
            dataIndex: ['user', 'email'],
            key: 'email',
        },
        {
            title: 'Số điện thoại',
            dataIndex: ['user', 'phone'],
            key: 'phone',
        },
        {
            title: 'Địa chỉ',
            dataIndex: ['user', 'address'],
            key: 'address',
        },
        {
            title: 'Vai trò',
            dataIndex: ['user', 'isAdmin'],
            key: 'role',
            render: (isAdmin) => <Tag color={isAdmin ? 'purple' : 'blue'}>{isAdmin ? 'Admin' : 'User'}</Tag>,
        },
        {
            title: 'Trạng thái',
            key: 'activeStatus',
            render: (_, record) => (
                <Tag color={record.user.isActive ? 'green' : 'red'}>
                    {record.user.isActive ? 'Hoạt động' : 'Bị khóa'}
                </Tag>
            ),
        },
        {
            title: 'Ngày tham gia',
            dataIndex: ['user', 'createdAt'],
            key: 'joinDate',
            render: (date) => new Date(date).toLocaleDateString('vi-VN'),
        },
        {
            title: 'Số bài đăng',
            dataIndex: 'totalPost',
            key: 'totalPost',
        },
        {
            title: 'Tổng chi tiêu',
            dataIndex: 'totalSpent',
            key: 'totalSpent',
            render: (amount) => `${amount.toLocaleString('vi-VN')} VND`,
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button type="default" onClick={() => handleToggleActive(record)}>
                        {record.user.isActive ? 'Khóa' : 'Mở khóa'}
                    </Button>
                    <Button type="primary" danger={record.user.isAdmin} onClick={() => handleToggleAdmin(record)}>
                        {record.user.isAdmin ? 'Gỡ admin' : 'Cấp admin'}
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
                        placeholder="Tìm theo tên, email hoặc số điện thoại"
                        allowClear
                        enterButton="Tìm"
                        onSearch={handleSearch}
                    />
                </Col>
                <Col xs={24} sm={12} md={6} lg={4}>
                    <Select
                        placeholder="Trạng thái"
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
                        options={[
                            { label: 'Tất cả', value: '' },
                            { label: 'Hoạt động', value: 'active' },
                            { label: 'Bị khóa', value: 'inactive' },
                        ]}
                        style={{ width: '100%' }}
                    />
                </Col>
                <Col xs={24} sm={12} md={6} lg={4}>
                    <Select
                        placeholder="Vai trò"
                        value={roleFilter}
                        onChange={(value) => setRoleFilter(value)}
                        options={[
                            { label: 'Tất cả', value: '' },
                            { label: 'Admin', value: 'admin' },
                            { label: 'User', value: 'user' },
                        ]}
                        style={{ width: '100%' }}
                    />
                </Col>
                <Col xs={24} sm={12} md={6} lg={4}>
                    <Button icon={<DownloadOutlined />} onClick={handleExportExcel} block>
                        Xuất Excel
                    </Button>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Card>
                        <Statistic title="Tổng số người dùng" value={stats.totalUsers} prefix={<UserOutlined />} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Người dùng mới"
                            value={stats.newUsers}
                            prefix={<UserAddOutlined />}
                            valueStyle={{ color: '#3f8600' }}
                        />
                    </Card>
                </Col>

                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Tổng doanh thu"
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
