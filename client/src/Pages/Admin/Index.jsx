/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { Layout, Menu, Button, message } from 'antd';
import {
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    DashboardOutlined,
    UserOutlined,
    HomeOutlined,
    DollarOutlined,
    GlobalOutlined,
    LogoutOutlined,
    StarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { requestGetAdmin, requestLogout } from '../../config/request';
import Dashboard from './Components/Dashborad/Dashborad';
import classNames from 'classnames/bind';
import styles from './Index.module.scss';

import ManagerUser from './Components/ManagerUser/ManagerUser';
import ManagerPost from './Components/ManagerPost/ManagerPost';
import ManagerRechange from './Components/ManagerRechange/ManagerRechange';
import ManagerReports from './Components/ManagerReports/ManagerReports';
import ManagerReviews from './Components/ManagerReviews/ManagerReviews';
import { useStore } from '../../hooks/useStore';

const { Header, Sider, Content } = Layout;
const cx = classNames.bind(styles);

function Admin() {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const { clearAuthState } = useStore();
    const [type, setType] = useState('dashboard');

    const handleLogout = async () => {
        try {
            await requestLogout();
            clearAuthState();
            message.success('Dang xuat thanh cong');
            navigate('/login');
        } catch (error) {
            message.error(error?.response?.data?.message || 'Dang xuat that bai');
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                await requestGetAdmin();
            } catch (error) {
                navigate('/');
            }
        };

        fetchData();
    }, [navigate]);

    const menuItems = [
        {
            key: 'dashboard',
            icon: <DashboardOutlined />,
            label: 'Trang chu',
            onClick: () => setType('dashboard'),
        },
        {
            key: 'users',
            icon: <UserOutlined />,
            label: 'Quan ly nguoi dung',
            onClick: () => setType('users'),
        },
        {
            key: 'posts',
            icon: <HomeOutlined />,
            label: 'Quan ly bai viet',
            onClick: () => setType('posts'),
        },
        {
            key: 'reports',
            icon: <GlobalOutlined />,
            label: 'Quan ly bao cao',
            onClick: () => setType('reports'),
        },
        {
            key: 'reviews',
            icon: <StarOutlined />,
            label: 'Quan ly danh gia',
            onClick: () => setType('reviews'),
        },
        {
            key: 'transactions',
            icon: <DollarOutlined />,
            label: 'Quan ly giao dich',
            onClick: () => setType('transactions'),
        },
    ];

    return (
        <Layout className={cx('admin-layout')}>
            <Sider trigger={null} collapsible collapsed={collapsed} className={cx('sider')} width={280}>
                <div className={cx('logo')}>
                    <div className={cx('logo-icon')}>
                        <GlobalOutlined />
                    </div>
                    {!collapsed && (
                        <div className={cx('logo-text')}>
                            <h1>NESTFINDER</h1>
                            <span>Admin Portal</span>
                        </div>
                    )}
                </div>
                <Menu theme="dark" mode="inline" defaultSelectedKeys={['dashboard']} items={menuItems} className={cx('menu')} />
            </Sider>
            <Layout>
                <Header className={cx('header')}>
                    <div className={cx('header-left')}>
                        {collapsed ? (
                            <MenuUnfoldOutlined className={cx('trigger')} onClick={() => setCollapsed(!collapsed)} />
                        ) : (
                            <MenuFoldOutlined className={cx('trigger')} onClick={() => setCollapsed(!collapsed)} />
                        )}
                    </div>
                    <div className={cx('header-right')}>
                        <Button type="primary" icon={<LogoutOutlined />} danger onClick={handleLogout}>
                            Dang xuat
                        </Button>
                    </div>
                </Header>
                <Content className={cx('content')}>
                    {type === 'dashboard' && <Dashboard />}
                    {type === 'users' && <ManagerUser />}
                    {type === 'posts' && <ManagerPost />}
                    {type === 'reports' && <ManagerReports />}
                    {type === 'reviews' && <ManagerReviews />}
                    {type === 'transactions' && <ManagerRechange />}
                </Content>
            </Layout>
        </Layout>
    );
}

export default Admin;
