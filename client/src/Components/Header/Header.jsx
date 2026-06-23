/* eslint-disable no-unused-vars */
import classNames from 'classnames/bind';
import styles from './Header.module.scss';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/images/logo.png';
import { Avatar, Badge, Button, Dropdown, Empty, List, Menu, Space, Typography, message } from 'antd';
import {
    UserOutlined,
    LogoutOutlined,
    ProfileOutlined,
    SearchOutlined,
    DashboardOutlined,
    HeartOutlined,
    PlusCircleOutlined,
    HomeOutlined,
    PhoneOutlined,
    MenuOutlined,
    DollarOutlined,
    FileTextOutlined,
    BarChartOutlined,
    EnvironmentOutlined,
    BellOutlined,
    DeleteOutlined,
} from '@ant-design/icons';

import { useStore } from '../../hooks/useStore';
import { useState } from 'react';
import { requestDeleteNotification, requestLogout, requestMarkAllNotificationsRead, requestMarkNotificationRead } from '../../config/request';
import { useSocket } from '../../hooks/useSocket';

const cx = classNames.bind(styles);
const { Text } = Typography;

const navItems = [
    { to: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
    // { to: '/search', label: 'Tìm phòng', icon: <SearchOutlined /> },
    { to: '/ban-do', label: 'Bản đồ', icon: <EnvironmentOutlined /> },
    { to: '/so-sanh', label: 'So sánh', icon: <BarChartOutlined /> },
    { to: '/bang-gia', label: 'Bảng giá', icon: <DollarOutlined /> },
    { to: '/contact', label: 'Liên hệ', icon: <PhoneOutlined /> },
    { to: '/terms', label: 'Điều khoản', icon: <FileTextOutlined /> },
];

function Header() {
    const { dataUser, dataSearch, setValueSearch, clearAuthState } = useStore();
    const { notifications, setNotifications, notificationUnreadCount, setNotificationUnreadCount } = useSocket();

    const navigate = useNavigate();
    const location = useLocation();

    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await requestLogout();
            clearAuthState();
            navigate('/');
        } catch (error) {
            console.log(error);
        }
    };

    const menu = (
        <Menu
            items={[
                ...(dataUser.isAdmin
                    ? [
                          {
                              key: 'admin',
                              icon: <DashboardOutlined />,
                              label: <Link to="/admin">Trang quản trị</Link>,
                          },
                      ]
                    : []),
                {
                    key: 'profile',
                    icon: <ProfileOutlined />,
                    label: <Link to="/trang-ca-nhan">Trang cá nhân</Link>,
                },
                {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: 'Đăng xuất',
                    onClick: handleLogout,
                },
            ]}
        />
    );

    const handleNavigateSearch = (value = searchValue) => {
        const keyword = value.trim();
        if (!keyword) return;
        setSearchValue(keyword);
        setValueSearch(keyword);
        setIsMobileMenuOpen(false);
        navigate(`/search/${encodeURIComponent(keyword)}`);
    };

    const markNotificationLocal = (id, changes) => {
        setNotifications((current) => current.map((item) => (item._id === id ? { ...item, ...changes } : item)));
    };

    const handleOpenNotification = async (notification) => {
        try {
            if (!notification.isRead) {
                const res = await requestMarkNotificationRead(notification._id);
                markNotificationLocal(notification._id, { isRead: true });
                setNotificationUnreadCount(res.metadata?.unreadCount || 0);
            }
            if (notification.link) navigate(notification.link);
        } catch (error) {
            message.error(error?.response?.data?.message || 'Không thể mở thông báo');
        }
    };

    const handleMarkAllNotificationsRead = async () => {
        try {
            await requestMarkAllNotificationsRead();
            setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
            setNotificationUnreadCount(0);
        } catch (error) {
            message.error(error?.response?.data?.message || 'Không thể đánh dấu đã đọc');
        }
    };

    const handleDeleteNotification = async (event, notificationId) => {
        event.stopPropagation();
        try {
            const res = await requestDeleteNotification(notificationId);
            setNotifications((current) => current.filter((item) => item._id !== notificationId));
            setNotificationUnreadCount(res.metadata?.unreadCount || 0);
        } catch (error) {
            message.error(error?.response?.data?.message || 'Không thể xóa thông báo');
        }
    };

    const notificationDropdown = (
        <div className={cx('notificationDropdown')}>
            <div className={cx('notificationHeader')}>
                <strong>Thông báo</strong>
                <Button type="link" size="small" onClick={handleMarkAllNotificationsRead} disabled={!notificationUnreadCount}>
                    Đọc tất cả
                </Button>
            </div>
            {notifications?.length ? (
                <List
                    className={cx('notificationList')}
                    dataSource={notifications}
                    renderItem={(item) => (
                        <List.Item
                            className={cx('notificationItem', { unread: !item.isRead })}
                            onClick={() => handleOpenNotification(item)}
                            actions={[
                                <Button
                                    key="delete"
                                    type="text"
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    onClick={(event) => handleDeleteNotification(event, item._id)}
                                    aria-label="Xóa thông báo"
                                />,
                            ]}
                        >
                            <List.Item.Meta
                                title={
                                    <Space size={6}>
                                        {!item.isRead && <span className={cx('unreadDot')} />}
                                        <span>{item.title}</span>
                                    </Space>
                                }
                                description={
                                    <>
                                        <Text type="secondary">{item.message}</Text>
                                        <div className={cx('notificationTime')}>
                                            {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}
                                        </div>
                                    </>
                                }
                            />
                        </List.Item>
                    )}
                />
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông báo" />
            )}
        </div>
    );

    const renderNav = () => (
        <nav className={cx('nav')} aria-label="Điều hướng chính">
            {navItems.map((item) => (
                <Link
                    key={item.to}
                    to={item.to}
                    className={cx('navLink', { active: location.pathname === item.to })}
                    onClick={() => setIsMobileMenuOpen(false)}
                >
                    {item.icon}
                    <span>{item.label}</span>
                </Link>
            ))}
        </nav>
    );

    return (
        <div className={cx('wrapper')}>
            <div className={cx('inner')}>
                <Link to="/" className={cx('brand')} onClick={() => setIsMobileMenuOpen(false)}>
                    <img src={logo} alt="Logo PhongTro" />
                    <div>
                        <strong>PHÒNG TRỌ</strong>
                        <span>Kênh thuê trọ tin cậy</span>
                    </div>
                </Link>

                {renderNav()}

                <div className={cx('search')}>
                    <div className={cx('search-input-container')}>
                        <input
                            type="text"
                            placeholder="Tìm khu vực, tên phòng..."
                            value={searchValue}
                            onChange={(e) => {
                                setSearchValue(e.target.value);
                                setValueSearch(e.target.value);
                            }}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => {
                                setTimeout(() => setIsSearchFocused(false), 200);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.value.trim()) {
                                    handleNavigateSearch(e.target.value.trim());
                                }
                            }}
                        />
                        <button type="button" className={cx('searchButton')} onClick={() => handleNavigateSearch()} aria-label="Tìm kiếm">
                            <SearchOutlined />
                        </button>
                    </div>
                    {isSearchFocused && (
                        <div className={cx('result-search')}>
                            <ul>
                                {(dataSearch || []).map((item, index) => (
                                    <li onClick={() => handleNavigateSearch(item.title)} key={index}>
                                        <span>
                                            <SearchOutlined /> {item.title}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className={cx('actions')}>
                    {dataUser._id ? (
                        <>
                            <Link to="/trang-ca-nhan?tab=posts" className={cx('post-link')}>
                                <PlusCircleOutlined />
                                {/* <span>Đăng tin</span> */}
                            </Link>

                            <Link to="/tin-yeu-thich" className={cx('favourite-link')} aria-label="Tin yêu thích">
                                <HeartOutlined />
                            </Link>

                            <Dropdown dropdownRender={() => notificationDropdown} trigger={['click']} placement="bottomRight">
                                <button type="button" className={cx('notificationButton')} aria-label="Thông báo">
                                    <Badge count={notificationUnreadCount} size="small" overflowCount={99}>
                                        <BellOutlined />
                                    </Badge>
                                </button>
                            </Dropdown>

                            <Dropdown overlay={menu} placement="bottomRight">
                                <a onClick={(e) => e.preventDefault()} className={cx('user-menu-link')}>
                                    <Space>
                                        <Avatar
                                            size="large"
                                            src={dataUser.avatar || null}
                                            icon={!dataUser.avatar ? <UserOutlined /> : null}
                                        />
                                        <span className={cx('user-name')}>{dataUser.fullName || 'User'}</span>
                                    </Space>
                                </a>
                            </Dropdown>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className={cx('loginLink')}>
                                Đăng nhập
                            </Link>
                            <Link to="/register" className={cx('registerLink')}>
                                Đăng ký
                            </Link>
                        </>
                    )}
                </div>

                <button
                    type="button"
                    className={cx('mobileToggle')}
                    onClick={() => setIsMobileMenuOpen((current) => !current)}
                    aria-label="Mở menu"
                    aria-expanded={isMobileMenuOpen}
                >
                    <MenuOutlined />
                </button>
            </div>

            <div className={cx('mobilePanel', { open: isMobileMenuOpen })}>
                {renderNav()}
                <div className={cx('mobileActions')}>
                    {dataUser._id ? (
                        <Link to="/trang-ca-nhan?tab=posts" className={cx('post-link')} onClick={() => setIsMobileMenuOpen(false)}>
                            <PlusCircleOutlined />
                            <span>Đăng tin mới</span>
                        </Link>
                    ) : (
                        <>
                            <Link to="/login" className={cx('loginLink')} onClick={() => setIsMobileMenuOpen(false)}>
                                Đăng nhập
                            </Link>
                            <Link to="/register" className={cx('registerLink')} onClick={() => setIsMobileMenuOpen(false)}>
                                Đăng ký
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Header;
