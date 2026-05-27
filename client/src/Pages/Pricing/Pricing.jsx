import classNames from 'classnames/bind';
import { CheckCircleOutlined, CrownOutlined, FireOutlined, HomeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import styles from './Pricing.module.scss';

const cx = classNames.bind(styles);

const servicePlans = [
    {
        key: 'normal',
        name: 'Tin thường',
        label: 'Tiết kiệm',
        description: 'Phù hợp với chủ trọ cần đăng tin ổn định, chi phí tiết kiệm.',
        accent: 'standard',
        icon: <HomeOutlined />,
        prices: [
            { duration: '3 ngày', price: '10.000 VNĐ' },
            { duration: '7 ngày', price: '60.000 VNĐ' },
            { duration: '30 ngày', price: '1.000.000 VNĐ' },
        ],
        benefits: ['Hiển thị trong danh sách tin mới', 'Có đầy đủ hình ảnh và thông tin phòng', 'Dễ quản lý trong trang cá nhân'],
    },
    {
        key: 'vip',
        name: 'Tin VIP',
        label: 'Nổi bật',
        description: 'Tăng độ nổi bật cho phòng cần cho thuê nhanh và tiếp cận nhiều người hơn.',
        accent: 'vip',
        icon: <CrownOutlined />,
        prices: [
            { duration: '3 ngày', price: '50.000 VNĐ' },
            { duration: '7 ngày', price: '315.000 VNĐ' },
            { duration: '30 ngày', price: '1.200.000 VNĐ' },
        ],
        benefits: ['Ưu tiên xuất hiện ở khu vực nổi bật', 'Nhãn tin VIP giúp người thuê chú ý hơn', 'Phù hợp tin cần đẩy nhanh hiệu quả'],
    },
];

function Pricing() {
    useEffect(() => {
        document.title = 'Bảng giá dịch vụ';
    }, []);

    return (
        <main className={cx('pageShell')}>
            <section className={cx('hero')}>
                <div>
                    <span className={cx('eyebrow')}>
                        <ThunderboltOutlined />
                        Bảng giá dịch vụ
                    </span>
                    <h1>Chọn gói đăng tin phù hợp với tốc độ cho thuê</h1>
                    <p>
                        Bảng giá được đồng bộ theo phí đăng tin hiện tại. Chủ trọ có thể chọn thời hạn ngắn để thử hiệu quả
                        hoặc gói dài ngày khi cần duy trì hiển thị.
                    </p>
                </div>
                <Link to="/trang-ca-nhan?tab=posts" className={cx('heroAction')}>
                    Đăng tin ngay
                </Link>
            </section>

            <section className={cx('pricingGrid')}>
                {servicePlans.map((plan) => (
                    <article key={plan.key} className={cx('pricingCard', plan.accent)}>
                        <div className={cx('planTop')}>
                            <div>
                                <span>{plan.label}</span>
                                <h2>{plan.name}</h2>
                            </div>
                            {plan.icon}
                        </div>
                        <p>{plan.description}</p>

                        <div className={cx('priceRows')}>
                            {plan.prices.map((item) => (
                                <div key={item.duration} className={cx('priceRow')}>
                                    <span>{item.duration}</span>
                                    <strong>{item.price}</strong>
                                </div>
                            ))}
                        </div>

                        <div className={cx('benefitList')}>
                            {plan.benefits.map((benefit) => (
                                <span key={benefit}>
                                    <CheckCircleOutlined />
                                    {benefit}
                                </span>
                            ))}
                        </div>

                        <Link to="/trang-ca-nhan?tab=posts" className={cx('planAction')}>
                            Chọn gói này
                        </Link>
                    </article>
                ))}
            </section>

            <section className={cx('notePanel')}>
                <FireOutlined />
                <div>
                    <h2>Lưu ý khi chọn gói</h2>
                    <p>
                        Tin VIP phù hợp khi bạn cần tăng khả năng tiếp cận nhanh. Tin thường phù hợp cho nhu cầu duy trì hiển thị
                        với chi phí thấp hơn.
                    </p>
                </div>
            </section>
        </main>
    );
}

export default Pricing;
