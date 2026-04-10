import { useState } from 'react';
import { message } from 'antd';
import styles from './Contact.module.scss';

function Contact() {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.name || !formData.email || !formData.message) {
            message.error('Vui lòng điền tên, email và nội dung thông điệp.');
            return;
        }

        message.success('Cám ơn bạn! Thông tin đã được gửi.');
        setFormData({ name: '', email: '', phone: '', message: '' });
    };

    return (
        <div className={styles.contactPage}>
            <div className={styles.header}>
                <h1>Liên hệ NESTFINDER</h1>
                <p>Chúng tôi luôn sẵn sàng hỗ trợ bạn tìm phòng trọ nhanh chóng và minh bạch.</p>
            </div>

            <div className={styles.content}>
                <div className={styles.infoBox}>
                    <h2>Thông tin liên hệ</h2>
                    <p>
                        <strong>Email hỗ trợ:</strong> support@nestfinder.vn
                    </p>
                    <p>
                        <strong>Điện thoại:</strong> 0772 185 477
                    </p>
                    <p>
                        <strong>Địa chỉ:</strong> 123 Đường ABC, Quận Ninh Kiều, Cần Thơ
                    </p>
                    <p>
                        <strong>Giờ làm việc:</strong> 8:00 - 18:00 (Thứ 2 - Chủ nhật)
                    </p>

                    <div className={styles.socialLinks}>
                        <a href="https://www.facebook.com/share/17xtNHaAB9/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer">
                            Facebook
                        </a>
                        <a href="https://zalo.me/nestfinder" target="_blank" rel="noopener noreferrer">
                            Zalo
                        </a>
                        <a href="https://tiktok.com/@nestfinder" target="_blank" rel="noopener noreferrer">
                            TikTok
                        </a>
                    </div>
                </div>

                <div className={styles.formBox}>
                    <h2>Gửi yêu cầu hỗ trợ</h2>
                    <form onSubmit={handleSubmit} className={styles.contactForm}>
                        <label>
                            Họ và tên
                            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Nhập họ và tên" />
                        </label>
                        <label>
                            Email
                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Nhập email của bạn" />
                        </label>
                        <label>
                            Số điện thoại
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Nhập số điện thoại" />
                        </label>
                        <label>
                            Nội dung
                            <textarea name="message" value={formData.message} onChange={handleChange} placeholder="Nhập nội dung cần hỗ trợ" rows="6" />
                        </label> 
                        <button type="submit">Gửi</button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Contact;
