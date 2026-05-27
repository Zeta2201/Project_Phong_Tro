/* eslint-disable no-unused-vars */
import classNames from 'classnames/bind';
import styles from './Header.module.scss';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/images/logo.png';
import { Dropdown, Menu, Avatar, Space } from 'antd';
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
} from '@ant-design/icons';

import { useStore } from '../../hooks/useStore';
import { useState } from 'react';
import { requestLogout } from '../../config/request';
import { useSocket } from '../../hooks/useSocket';

const cx = classNames.bind(styles);

const navItems = [
    { to: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
    { to: '/search', label: 'Tìm phòng', icon: <SearchOutlined /> },
    { to: '/bang-gia', label: 'Bảng giá', icon: <DollarOutlined /> },
    { to: '/contact', label: 'Liên hệ', icon: <PhoneOutlined /> },
    { to: '/terms', label: 'Điều khoản', icon: <FileTextOutlined /> },
];

function Header() {
    const { dataUser, dataSearch, setValueSearch, clearAuthState } = useStore();
    const { dataMessagersUser } = useSocket();

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
                        <strong>PhongTro</strong>
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
                                <span>Đăng tin</span>
                            </Link>

                            <Link to="/tin-yeu-thich" className={cx('favourite-link')} aria-label="Tin yêu thích">
                                <HeartOutlined />
                            </Link>

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
