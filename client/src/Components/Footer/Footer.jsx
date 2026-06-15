import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { message } from 'antd';
import styles from './Footer.module.scss';

function Footer() {
    const [email, setEmail] = useState('');

    const handleSubscribe = (e) => {
        e.preventDefault();
        if (email) {
            message.success('Đăng ký nhận tin thành công!');
            setEmail('');
        } else {
            message.error('Vui lòng nhập email!');
        }
    };

    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                {/* Thông tin website */}
                <div className={styles.section}>
                    <div className={styles.brand}>
                        <h2 className={styles.logo}>NESTFINDER</h2>
                        <p className={styles.slogan}>Nền tảng tìm kiếm và cho thuê phòng trọ nhanh chóng, minh bạch và dễ dàng.</p>
                    </div>
                </div>

                {/* Liên kết nhanh */}
                <div className={styles.section}>
                    <h3>Liên kết nhanh</h3>
                    <ul>
                        <li><Link to="/">Trang chủ</Link></li>
                        <li><Link to="/search">Danh sách phòng</Link></li>
                        <li><Link to="/post">Đăng tin cho thuê</Link></li>
                        <li><Link to="/guide">Hướng dẫn sử dụng</Link></li>
                        <li><Link to="/contact">Liên hệ</Link></li>
                    </ul>
                </div>

                {/* Chính sách & pháp lý */}
                <div className={styles.section}>
                    <h3>Chính sách & pháp lý</h3>
                    <ul>
                        <li><Link to="/terms">Điều khoản sử dụng</Link></li>
                        <li><Link to="/privacy">Chính sách bảo mật</Link></li>
                        <li><Link to="/posting-rules">Quy định đăng tin</Link></li>
                        <li><Link to="/payment-policy">Chính sách thanh toán</Link></li>
                        <li><Link to="/operation-regulations">Quy chế hoạt động</Link></li>
                    </ul>
                </div>

                {/* Thông tin liên hệ */}
                <div className={styles.section}>
                    <h3>Thông tin liên hệ</h3>
                    <ul>
                        <li><strong>Email:</strong> nestfinder2201@gmail.com</li>
                        <li><strong>Điện thoại:</strong> 0385 095 477</li>
                        <li><strong>Địa chỉ:</strong> 123 Đường ABC, Quận Ninh Kiều, Cần Thơ</li>
                        <li><strong>Giờ làm việc:</strong> 8:00 - 18:00 (Thứ 2 - Chủ nhật)</li>
                    </ul>
                </div>

                {/* Mạng xã hội */}
                <div className={styles.section}>
                    <h3>Mạng xã hội</h3>
                    <ul className={styles.social}>
                        <li><a href="https://www.facebook.com/share/17xtNHaAB9/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer">Facebook</a></li>
                        <li><a href="https://zalo.me/nestfinder" target="_blank" rel="noopener noreferrer">Zalo</a></li>
                        <li><a href="https://tiktok.com/@nestfinder" target="_blank" rel="noopener noreferrer">TikTok</a></li>
                    </ul>
                </div>

                {/* Khu vực phổ biến */}
                <div className={styles.section}>
                    <h3>Khu vực phổ biến</h3>
                    <ul>
                        <li><Link to="/search?location=can-tho">Phòng trọ Cần Thơ</Link></li>
                        <li><Link to="/search?location=ho-chi-minh">Phòng trọ TP.HCM</Link></li>
                        <li><Link to="/search?location=ha-noi">Phòng trọ Hà Nội</Link></li>
                    </ul>
                </div>

                {/* Đăng ký nhận tin */}
                <div className={styles.section}>
                    <h3>Đăng ký nhận tin</h3>
                    <form onSubmit={handleSubscribe} className={styles.subscribe}>
                        <input
                            type="email"
                            placeholder="Nhập email của bạn"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <button type="submit">Đăng ký</button>
                    </form>
                </div>
            </div>

            {/* Bản quyền */}
            <div className={styles.copyright}>
                <p>© 2026 NESTFINDER. All rights reserved.</p>
            </div>
        </footer>
    );
}

export default Footer;