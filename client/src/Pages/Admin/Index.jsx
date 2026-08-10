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
    MailOutlined,
    CommentOutlined,
    SafetyCertificateOutlined,
    FilterOutlined,
    TagsOutlined,
    GiftOutlined,
    PictureOutlined,
    AuditOutlined,
    TrophyOutlined,
    BellOutlined,
    WalletOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { requestLogout } from '../../config/request';
import Dashboard from './Components/Dashborad/Dashborad';
import classNames from 'classnames/bind';
import styles from './Index.module.scss';

import ManagerUser from './Components/ManagerUser/ManagerUser';
import ManagerPost from './Components/ManagerPost/ManagerPost';
import ManagerRechange from './Components/ManagerRechange/ManagerRechange';
import ManagerReports from './Components/ManagerReports/ManagerReports';
import ManagerReviews from './Components/ManagerReviews/ManagerReviewsModern';
import ManagerContacts from './Components/ManagerContacts/ManagerContacts';
import ManagerComments from './Components/ManagerComments/ManagerComments';
import ManagerDeposits from './Components/ManagerDeposits/ManagerDeposits';
import ManagerFilters from './Components/ManagerFilters/ManagerFilters';
import ManagerPostingPlans from './Components/ManagerPostingPlans/ManagerPostingPlans';
import ManagerContracts from './Components/ManagerContracts/ManagerContracts';
import ManagerVouchers from './Components/ManagerVouchers/ManagerVouchers';
import ManagerBanners from './Components/ManagerBanners/ManagerBanners';
import ManagerRewards from './Components/ManagerRewards/ManagerRewards';
import ManagerNotifications from './Components/ManagerNotifications/ManagerNotifications';
import ManagerWithdraws from './Components/ManagerWithdraws/ManagerWithdraws';
import { useStore } from '../../hooks/useStore';

const { Header, Sider, Content } = Layout;
const cx = classNames.bind(styles);

function Admin() {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { clearAuthState } = useStore();
    const [type, setType] = useState('dashboard');

    useEffect(() => {
        const nextType = new URLSearchParams(location.search).get('type');
        if (nextType) setType(nextType);
    }, [location.search]);

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

    const menuItems = [
        {
            key: 'dashboard',
            icon: <DashboardOutlined />,
            label: 'Trang chủ',
            onClick: () => setType('dashboard'),
        },
        {
            key: 'users',
            icon: <UserOutlined />,
            label: 'Quản lý người dùng',
            onClick: () => setType('users'),
        },
        {
            key: 'posts',
            icon: <HomeOutlined />,
            label: 'Quản lý bài viết',
            onClick: () => setType('posts'),
        },
        {
            key: 'reports',
            icon: <GlobalOutlined />,
            label: 'Quản lý báo cáo',
            onClick: () => setType('reports'),
        },
        {
            key: 'reviews',
            icon: <StarOutlined />,
            label: 'Quản lý đánh giá',
            onClick: () => setType('reviews'),
        },
        {
            key: 'transactions',
            icon: <DollarOutlined />,
            label: 'Quản lý giao dịch',
            onClick: () => setType('transactions'),
        },
        {
            key: 'withdraws',
            icon: <WalletOutlined />,
            label: 'Yêu cầu rút tiền',
            onClick: () => setType('withdraws'),
        },
        {
            key: 'contacts',
            icon: <MailOutlined />,
            label: 'Quản lý liên hệ',
            onClick: () => setType('contacts'),
        },
        {
            key: 'comments',
            icon: <CommentOutlined />,
            label: 'Quản lý bình luận',
            onClick: () => setType('comments'),
        },
        {
            key: 'deposits',
            icon: <SafetyCertificateOutlined />,
            label: 'Quản lý giao dịch cọc',
            onClick: () => setType('deposits'),
        },
        {
            key: 'contracts',
            icon: <AuditOutlined />,
            label: 'Quản lý hợp đồng',
            onClick: () => setType('contracts'),
        },
        {
            key: 'posting-plans',
            icon: <TagsOutlined />,
            label: 'Quản lý gói đăng tin',
            onClick: () => setType('posting-plans'),
        },
        {
            key: 'vouchers',
            icon: <GiftOutlined />,
            label: 'Quản lý voucher',
            onClick: () => setType('vouchers'),
        },
        {
            key: 'rewards',
            icon: <TrophyOutlined />,
            label: 'Quản lý tích điểm',
            onClick: () => setType('rewards'),
        },
        {
            key: 'banners',
            icon: <PictureOutlined />,
            label: 'Quản lý banner',
            onClick: () => setType('banners'),
        },
        {
            key: 'notifications',
            icon: <BellOutlined />,
            label: 'Quản lý thông báo',
            onClick: () => setType('notifications'),
        },
        {
            key: 'filters',
            icon: <FilterOutlined />,
            label: 'Quản lý bộ lọc',
            onClick: () => setType('filters'),
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
                <Menu theme="dark" mode="inline" selectedKeys={[type]} items={menuItems} className={cx('menu')} />
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
                            Đăng xuất
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
                    {type === 'withdraws' && <ManagerWithdraws />}
                    {type === 'contacts' && <ManagerContacts />}
                    {type === 'comments' && <ManagerComments />}
                    {type === 'deposits' && <ManagerDeposits />}
                    {type === 'contracts' && <ManagerContracts />}
                    {type === 'posting-plans' && <ManagerPostingPlans />}
                    {type === 'vouchers' && <ManagerVouchers />}
                    {type === 'rewards' && <ManagerRewards />}
                    {type === 'banners' && <ManagerBanners />}
                    {type === 'notifications' && <ManagerNotifications />}
                    {type === 'filters' && <ManagerFilters />}
                </Content>
            </Layout>
        </Layout>
    );
}

export default Admin;
