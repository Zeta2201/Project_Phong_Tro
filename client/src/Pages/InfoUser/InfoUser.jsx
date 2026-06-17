/* eslint-disable react-hooks/exhaustive-deps */
import { Layout, Menu, Avatar, Typography, Row, Col, Card } from 'antd';
import classNames from 'classnames/bind';
import {
    UserOutlined,
    FileTextOutlined,
    DollarCircleOutlined,
    LockOutlined,
    ScheduleOutlined,
    SafetyCertificateOutlined,
    AuditOutlined,
    BarChartOutlined,
} from '@ant-design/icons';
import Header from '../../Components/Header/Header';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PersonalInfo from './Components/PersonalInfo/PersonalInfo';
import ManagerPost from './Components/ManagerPost/ManagerPost';
import { useStore } from '../../hooks/useStore';
import RechargeUser from './Components/RechargeUser/RechargeUser';
import ChangePassword from './Components/ChangePassword/ChangePassword';
import ManagerReservation from './Components/ManagerReservation/ManagerReservation';
import ManagerDeposit from './Components/ManagerDeposit/ManagerDeposit';
import ManagerContract from './Components/ManagerContract/ManagerContract';
import OwnerAnalytics from './Components/OwnerAnalytics/OwnerAnalytics';
import styles from './InfoUser.module.scss';

import userNotFound from '../../assets/images/img_default.png';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const cx = classNames.bind(styles);

function InfoUser() {
    const [searchParams] = useSearchParams();
    const initialTab = searchParams.get('tab');
    const [selectedMenu, setSelectedMenu] = useState(initialTab || 'personal');
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 900px)').matches : false,
    );

    const { dataUser, fetchAuth } = useStore();

    useEffect(() => {
        fetchAuth();
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 900px)');
        const handleChange = (event) => setIsMobile(event.matches);

        setIsMobile(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const menuItems = [
        { key: 'personal', icon: <UserOutlined />, label: 'Thông tin cá nhân' },
        { key: 'change-password', icon: <LockOutlined />, label: 'Đổi mật khẩu' },
        { key: 'posts', icon: <FileTextOutlined />, label: 'Quản lý bài viết' },
        { key: 'analytics', icon: <BarChartOutlined />, label: 'Phân tích chủ trọ' },
        { key: 'reservations', icon: <ScheduleOutlined />, label: 'Quản lý giữ chỗ' },
        { key: 'recharge', icon: <DollarCircleOutlined />, label: 'Nạp tiền' },
        { key: 'tenant-deposits', icon: <SafetyCertificateOutlined />, label: 'Lịch sử đặt cọc' },
        { key: 'landlord-deposits', icon: <SafetyCertificateOutlined />, label: 'Quản lý cọc chủ trọ' },
        { key: 'tenant-contracts', icon: <AuditOutlined />, label: 'Hợp đồng của tôi' },
        { key: 'landlord-contracts', icon: <AuditOutlined />, label: 'Quản lý hợp đồng' },
    ];

    const pageTitles = {
        personal: 'Thông tin cá nhân',
        posts: 'Quản lý bài viết',
        analytics: 'Phân tích chủ trọ',
        reservations: 'Quản lý giữ chỗ',
        recharge: 'Nạp tiền',
        'change-password': 'Đổi mật khẩu',
        'tenant-deposits': 'Lịch sử đặt cọc',
        'landlord-deposits': 'Quản lý cọc chủ trọ',
        'tenant-contracts': 'Hợp đồng của tôi',
        'landlord-contracts': 'Quản lý hợp đồng',
    };

    const handleMenuClick = (e) => {
        setSelectedMenu(e.key);
    };

    const profileContent = (
        <>
            <div
                className={cx('profileHero')}
                style={{
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                    color: 'white',
                }}
            >
                <Avatar
                    size={dataUser?.avatar ? 100 : 90}
                    src={dataUser?.avatar || userNotFound}
                    icon={<UserOutlined />}
                    style={{
                        border: '4px solid white',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    }}
                />
                <Title level={4} style={{ marginTop: 16, marginBottom: 4, color: 'white' }}>
                    {dataUser.fullName}
                </Title>
                <Row>
                    <Col span={24}>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Số điện thoại {dataUser.phone}</Text>
                    </Col>
                    <Col span={24}>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                            Số dư : {dataUser?.balance?.toLocaleString()} VNĐ
                        </Text>
                    </Col>
                </Row>
            </div>
            <Menu
                mode={isMobile ? 'horizontal' : 'inline'}
                selectedKeys={[selectedMenu]}
                items={menuItems}
                onClick={handleMenuClick}
                className={cx('profileMenu')}
                style={{
                    borderRight: 0,
                    fontSize: '16px',
                }}
            />
        </>
    );

    return (
        <Layout className={cx('page')}>
            <Header />
            <Layout className={cx('shell', { mobileShell: isMobile })}>
                {isMobile ? (
                    <aside className={cx('profileSider', 'mobileProfile')}>{profileContent}</aside>
                ) : (
                    <Sider width={300} theme="light" className={cx('profileSider')}>
                        {profileContent}
                    </Sider>
                )}

                <Content className={cx('content')}>
                    <Card
                        className={cx('contentCard')}
                        style={{
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                        }}
                        title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Title level={3} style={{ margin: 0 }}>
                                    {pageTitles[selectedMenu]}
                                </Title>
                            </div>
                        }
                    >
                        {selectedMenu === 'personal' && <PersonalInfo />}
                        {selectedMenu === 'posts' && <ManagerPost />}
                        {selectedMenu === 'analytics' && <OwnerAnalytics />}
                        {selectedMenu === 'reservations' && <ManagerReservation />}
                        {selectedMenu === 'recharge' && <RechargeUser />}
                        {selectedMenu === 'change-password' && <ChangePassword />}
                        {selectedMenu === 'tenant-deposits' && <ManagerDeposit role="tenant" />}
                        {selectedMenu === 'landlord-deposits' && <ManagerDeposit role="landlord" />}
                        {selectedMenu === 'tenant-contracts' && <ManagerContract role="tenant" />}
                        {selectedMenu === 'landlord-contracts' && <ManagerContract role="landlord" />}
                    </Card>
                </Content>
            </Layout>
        </Layout>
    );
}

export default InfoUser;
