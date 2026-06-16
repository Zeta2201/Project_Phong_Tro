import { Layout, Menu, Avatar, Typography, Row, Col, Card, Divider, Button } from 'antd';
import { UserOutlined, FileTextOutlined, DollarCircleOutlined, LockOutlined, ScheduleOutlined, SafetyCertificateOutlined, AuditOutlined } from '@ant-design/icons';
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

import userNotFound from '../../assets/images/img_default.png';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

function InfoUser() {
    const [searchParams] = useSearchParams();
    const initialTab = searchParams.get('tab');
    const [selectedMenu, setSelectedMenu] = useState(initialTab || 'personal');

    const { dataUser, fetchAuth } = useStore();

    useEffect(() => {
        fetchAuth();
    }, []);

    const menuItems = [
        {
            key: 'personal',
            icon: <UserOutlined />,
            label: 'Thông tin cá nhân',
        },
        {
            key: 'change-password',
            icon: <LockOutlined />,
            label: 'Đổi mật khẩu',
        },
        {
            key: 'posts',
            icon: <FileTextOutlined />,
            label: 'Quản lý bài viết',
        },
        {
            key: 'reservations',
            icon: <ScheduleOutlined />,
            label: 'Quản lý giữ chỗ',
        },
        {
            key: 'recharge',
            icon: <DollarCircleOutlined />,
            label: 'Nạp tiền',
        },
        {
            key: 'tenant-deposits',
            icon: <SafetyCertificateOutlined />,
            label: 'Lịch sử đặt cọc',
        },
        {
            key: 'landlord-deposits',
            icon: <SafetyCertificateOutlined />,
            label: 'Quản lý cọc chủ trọ',
        },
        {
            key: 'tenant-contracts',
            icon: <AuditOutlined />,
            label: 'Hợp đồng của tôi',
        },
        {
            key: 'landlord-contracts',
            icon: <AuditOutlined />,
            label: 'Quản lý hợp đồng',
        },
    ];

    const handleMenuClick = (e) => {
        setSelectedMenu(e.key);
    };

    return (
        <Layout style={{ minHeight: '100vh', width: '80%', margin: '100px auto' }}>
            <Header />
            <Layout
                style={{
                    marginTop: '20px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                }}
            >
                <Sider
                    width={300}
                    theme="light"
                    style={{
                        padding: '20px 0',
                        borderRight: '1px solid #f0f0f0',
                        background: 'linear-gradient(to bottom, #f9f9f9, #ffffff)',
                    }}
                >
                    <div
                        style={{
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                            margin: '-20px -20px 20px -20px',
                            padding: '30px 20px',
                            color: 'white',
                            width: '107%',
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
                                <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                                    Số điện thoại {dataUser.phone}
                                </Text>
                            </Col>
                            <Col span={24}>
                                <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                                    Số dư : {dataUser?.balance?.toLocaleString()} VNĐ
                                </Text>
                            </Col>
                        </Row>
                    </div>
                    <Menu
                        mode="inline"
                        selectedKeys={[selectedMenu]}
                        items={menuItems}
                        onClick={handleMenuClick}
                        style={{
                            borderRight: 0,
                            fontSize: '16px',
                        }}
                    />
                </Sider>
                <Content style={{ padding: '24px', background: '#fff' }}>
                    <Card
                        style={{
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                        }}
                        title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Title level={3} style={{ margin: 0 }}>
                                    {selectedMenu === 'personal' && 'Thông tin cá nhân'}
                                    {selectedMenu === 'posts' && 'Quản lý bài viết'}
                                    {selectedMenu === 'reservations' && 'Quản lý giữ chỗ'}
                                    {selectedMenu === 'recharge' && 'Nạp tiền'}
                                    {selectedMenu === 'change-password' && 'Đổi mật khẩu'}
                                    {selectedMenu === 'tenant-deposits' && 'Lịch sử đặt cọc'}
                                    {selectedMenu === 'landlord-deposits' && 'Quản lý cọc chủ trọ'}
                                    {selectedMenu === 'tenant-contracts' && 'Hợp đồng của tôi'}
                                    {selectedMenu === 'landlord-contracts' && 'Quản lý hợp đồng'}
                                </Title>
                            </div>
                        }
                    >
                        {selectedMenu === 'personal' && <PersonalInfo />}
                        {selectedMenu === 'posts' && <ManagerPost />}
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
