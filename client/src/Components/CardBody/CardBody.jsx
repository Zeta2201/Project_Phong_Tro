import classNames from 'classnames/bind';
import styles from './CardBody.module.scss';

import {
    BarChartOutlined,
    CheckOutlined,
    DollarOutlined,
    EnvironmentOutlined,
    HomeOutlined,
} from '@ant-design/icons';
import { message } from 'antd';

import imgDefault from '../../assets/images/img_default.png';

import { Link } from 'react-router-dom';

import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { addRoomToCompare, isRoomCompared, MAX_COMPARE_ROOMS, removeRoomFromCompare } from '../../utils/compareRooms';

const cx = classNames.bind(styles);

function CardBody({ post }) {
    const [compared, setCompared] = useState(false);
    const isAvailable = (post.availabilityStatus || 'available') === 'available';
    const availabilityLabel =
        {
            available: 'Còn phòng',
            unavailable: 'Hết phòng',
            reserved: 'Đã giữ cọc',
            rented: 'Đã cho thuê',
        }[post.availabilityStatus || 'available'] || 'Hết phòng';

    useEffect(() => {
        const syncCompared = () => setCompared(isRoomCompared(post._id));

        syncCompared();
        window.addEventListener('compareRoomsUpdated', syncCompared);

        return () => window.removeEventListener('compareRoomsUpdated', syncCompared);
    }, [post._id]);

    const handleCompare = () => {
        if (compared) {
            removeRoomFromCompare(post._id);
            setCompared(false);
            message.success('Đã bỏ phòng khỏi danh sách so sánh');
            return;
        }

        const result = addRoomToCompare(post);

        if (result.status === 'full') {
            message.warning(`Chỉ có thể so sánh tối đa ${MAX_COMPARE_ROOMS} phòng`);
            return;
        }

        setCompared(true);
        message.success('Đã thêm phòng vào danh sách so sánh');
    };

    return (
        <div className={cx('list-item')}>
            <Link to={`/chi-tiet-tin-dang/${post._id}`}>
                <div className={cx('parent')}>
                    <span className={cx('availability-badge', { unavailable: !isAvailable })}>
                        {availabilityLabel}
                    </span>
                    <div className={cx('div1')}>
                        <img src={post.images?.[0] || imgDefault} alt={post.title} />
                    </div>
                    <div className={cx('div2')}>
                        <img src={post.images?.[1] || imgDefault} alt={post.title} />
                    </div>
                    <div className={cx('div3')}>
                        <img src={post.images?.[2] || imgDefault} alt={post.title} />
                    </div>
                    <div className={cx('div4')}>
                        <img src={post.images?.[3] || imgDefault} alt={post.title} />
                    </div>
                </div>
            </Link>
            <div className={cx('room-info')}>
                <h2 className={cx('room-title')}>
                    <HomeOutlined className={cx('icon')} />
                    {post.title}
                </h2>
                <div className={cx('room-meta')}>
                    <span className={cx('price')}>
                        <DollarOutlined className={cx('icon')} />
                        {post.price?.toLocaleString('vi-VN')} VNĐ/tháng
                    </span>
                    <span className={cx('area')}>
                        <HomeOutlined className={cx('icon')} />
                        {post.area} m²
                    </span>
                    <span className={cx('location')}>
                        <EnvironmentOutlined className={cx('icon')} />
                        {post.location}
                    </span>
                </div>
                <button type="button" className={cx('compareButton', { selected: compared })} onClick={handleCompare}>
                    {compared ? <CheckOutlined /> : <BarChartOutlined />}
                    <span>{compared ? 'Đã chọn so sánh' : 'So sánh'}</span>
                </button>
            </div>
            <div className={cx('user-info')}>
                <img src={post.user?.avatar || imgDefault} alt="" />
                <div className={cx('info-container')}>
                    <div className={cx('user-header')}>
                        <h4>{post.user?.fullName}</h4>
                        <span>{dayjs(post.createdAt).format('HH:mm DD/MM/YYYY')}</span>
                    </div>
                    <div className={cx('user-actions')}>
                        <span>{post.phone}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CardBody;
