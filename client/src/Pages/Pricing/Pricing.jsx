import classNames from 'classnames/bind';
import { CheckCircleOutlined, CrownOutlined, FireOutlined, HomeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import styles from './Pricing.module.scss';
import { requestGetPostingPlans } from '../../config/request';

const cx = classNames.bind(styles);

function Pricing() {
    const [postingPlans, setPostingPlans] = useState([]);

    useEffect(() => {
        document.title = 'Bảng giá dịch vụ';
    }, []);

    useEffect(() => {
        const fetchPlans = async () => {
            const res = await requestGetPostingPlans();
            setPostingPlans(res.metadata || []);
        };

        fetchPlans();
    }, []);

    const servicePlans = useMemo(() => {
        const grouped = postingPlans.reduce((acc, plan) => {
            if (!acc[plan.typeNews]) {
                acc[plan.typeNews] = {
                    key: plan.typeNews,
                    name: plan.name,
                    label: plan.label,
                    description: plan.description,
                    accent: plan.typeNews === 'vip' ? 'vip' : 'standard',
                    icon: plan.typeNews === 'vip' ? <CrownOutlined /> : <HomeOutlined />,
                    prices: [],
                    benefits: plan.benefits || [],
                };
            }

            acc[plan.typeNews].prices.push({
                duration: `${plan.durationDays} ngày`,
                price: `${Number(plan.price || 0).toLocaleString('vi-VN')} VNĐ`,
            });
            return acc;
        }, {});

        return Object.values(grouped).map((plan) => ({
            ...plan,
            prices: plan.prices.sort((a, b) => Number(a.duration.split(' ')[0]) - Number(b.duration.split(' ')[0])),
        }));
    }, [postingPlans]);

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
                        Bảng giá được đồng bộ theo cấu hình gói đăng tin hiện tại. Chủ trọ có thể chọn thời hạn ngắn
                        để thử hiệu quả hoặc gói dài ngày khi cần duy trì hiển thị.
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
                        Tin VIP phù hợp khi bạn cần tăng khả năng tiếp cận nhanh. Tin thường phù hợp cho nhu cầu duy
                        trì hiển thị với chi phí thấp hơn.
                    </p>
                </div>
            </section>
        </main>
    );
}

export default Pricing;
