import classNames from 'classnames/bind';
import { Button, Empty, message } from 'antd';
import {
    BarChartOutlined,
    CheckCircleOutlined,
    DeleteOutlined,
    EnvironmentOutlined,
    ExpandOutlined,
    HomeOutlined,
    PhoneOutlined,
    StarFilled,
    TrophyOutlined,
    WalletOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

import imgDefault from '../../assets/images/img_default.png';
import styles from './CompareRooms.module.scss';
import { clearCompareRooms, getCompareRooms, removeRoomFromCompare } from '../../utils/compareRooms';

const cx = classNames.bind(styles);

const availabilityLabels = {
    available: 'Còn phòng',
    unavailable: 'Hết phòng',
    reserved: 'Đã giữ chỗ',
    rented: 'Đã cho thuê',
};

const categoryLabels = {
    'phong-tro': 'Phòng trọ',
    'nha-nguyen-can': 'Nhà nguyên căn',
    'can-ho-chung-cu': 'Căn hộ chung cư',
    'can-ho-mini': 'Căn hộ mini',
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;
const formatArea = (value) => `${Number(value || 0).toLocaleString('vi-VN')} m²`;
const getPricePerArea = (room) => (room.area ? Math.round(Number(room.price || 0) / Number(room.area)) : 0);

const getScore = (room, rooms) => {
    const prices = rooms.map((item) => Number(item.price || 0)).filter(Boolean);
    const pricePerAreas = rooms.map((item) => getPricePerArea(item)).filter(Boolean);
    const areas = rooms.map((item) => Number(item.area || 0)).filter(Boolean);

    const maxPrice = Math.max(...prices, 1);
    const maxPricePerArea = Math.max(...pricePerAreas, 1);
    const maxArea = Math.max(...areas, 1);

    const priceScore = room.price ? 1 - Number(room.price) / maxPrice : 0;
    const valueScore = getPricePerArea(room) ? 1 - getPricePerArea(room) / maxPricePerArea : 0;
    const areaScore = room.area ? Number(room.area) / maxArea : 0;
    const ratingScore = Number(room.ratingAverage || 0) / 5;
    const availableScore = room.availabilityStatus === 'available' ? 1 : 0;

    return Math.round((priceScore * 25 + valueScore * 30 + areaScore * 20 + ratingScore * 15 + availableScore * 10) * 10) / 10;
};

function CompareRooms() {
    const [rooms, setRooms] = useState([]);

    useEffect(() => {
        document.title = 'So sánh phòng trọ';

        const syncRooms = () => setRooms(getCompareRooms());

        syncRooms();
        window.addEventListener('compareRoomsUpdated', syncRooms);

        return () => window.removeEventListener('compareRoomsUpdated', syncRooms);
    }, []);

    const scoredRooms = useMemo(
        () =>
            rooms
                .map((room) => ({ ...room, compareScore: getScore(room, rooms) }))
                .sort((a, b) => b.compareScore - a.compareScore),
        [rooms],
    );

    const bestRoom = scoredRooms[0];

    const lowestPriceRoom = useMemo(
        () => rooms.filter((room) => room.price).sort((a, b) => Number(a.price) - Number(b.price))[0],
        [rooms],
    );

    const largestRoom = useMemo(
        () => rooms.filter((room) => room.area).sort((a, b) => Number(b.area) - Number(a.area))[0],
        [rooms],
    );

    const allOptions = useMemo(() => {
        const optionSet = new Set();
        rooms.forEach((room) => {
            (room.options || []).forEach((option) => optionSet.add(option));
        });
        return Array.from(optionSet).slice(0, 14);
    }, [rooms]);

    const handleRemove = (roomId) => {
        setRooms(removeRoomFromCompare(roomId));
        message.success('Đã xóa phòng khỏi bảng so sánh');
    };

    const handleClear = () => {
        clearCompareRooms();
        setRooms([]);
        message.success('Đã xóa tất cả phòng đang so sánh');
    };

    const renderRow = (label, getValue, className) => (
        <tr>
            <th>{label}</th>
            {rooms.map((room) => (
                <td key={room._id} className={className ? cx(className) : undefined}>
                    {getValue(room)}
                </td>
            ))}
        </tr>
    );

    return (
        <div className={cx('page')}>
            <section className={cx('header')}>
                <div className={cx('headerText')}>
                    <span className={cx('eyebrow')}>
                        <BarChartOutlined />
                        Công cụ so sánh
                    </span>
                    <h1>Chọn phòng hợp lý bằng dữ liệu rõ ràng</h1>
                    <p>Đặt các phòng đang cân nhắc lên cùng một bảng để so giá, diện tích, vị trí, đánh giá và tiện ích.</p>
                </div>

                <div className={cx('headerActions')}>
                    <Link to="/" className={cx('backLink')}>
                        <HomeOutlined />
                        Tìm thêm phòng
                    </Link>
                    {rooms.length > 0 && (
                        <Button danger icon={<DeleteOutlined />} onClick={handleClear}>
                            Xóa tất cả
                        </Button>
                    )}
                </div>
            </section>

            {rooms.length === 0 ? (
                <section className={cx('emptyState')}>
                    <Empty description="Chưa có phòng nào trong danh sách so sánh" />
                    <Link to="/" className={cx('primaryLink')}>
                        Chọn phòng để so sánh
                    </Link>
                </section>
            ) : (
                <>
                    <section className={cx('summaryGrid')}>
                        <div className={cx('summaryItem')}>
                            <BarChartOutlined />
                            <div>
                                <span>Số phòng</span>
                                <strong>{rooms.length}/4</strong>
                            </div>
                        </div>
                        <div className={cx('summaryItem')}>
                            <TrophyOutlined />
                            <div>
                                <span>Gợi ý tốt</span>
                                <strong>{bestRoom?.title || 'Chưa có'}</strong>
                            </div>
                        </div>
                        <div className={cx('summaryItem')}>
                            <WalletOutlined />
                            <div>
                                <span>Giá thấp nhất</span>
                                <strong>{lowestPriceRoom ? formatMoney(lowestPriceRoom.price) : 'Chưa có'}</strong>
                            </div>
                        </div>
                        <div className={cx('summaryItem')}>
                            <ExpandOutlined />
                            <div>
                                <span>Diện tích lớn nhất</span>
                                <strong>{largestRoom ? formatArea(largestRoom.area) : 'Chưa có'}</strong>
                            </div>
                        </div>
                    </section>

                    <section className={cx('roomStrip')}>
                        {rooms.map((room) => {
                            const score = getScore(room, rooms);
                            const isBest = room._id === bestRoom?._id;

                            return (
                                <article className={cx('roomCard', { best: isBest })} key={room._id}>
                                    {isBest && (
                                        <span className={cx('bestBadge')}>
                                            <StarFilled />
                                            Gợi ý tốt
                                        </span>
                                    )}
                                    <img src={room.images?.[0] || imgDefault} alt={room.title} />
                                    <div className={cx('roomBody')}>
                                        <div className={cx('scorePill')}>{score}/100</div>
                                        <h2>{room.title}</h2>
                                        <div className={cx('roomFacts')}>
                                            <span>
                                                <WalletOutlined />
                                                {formatMoney(room.price)}/tháng
                                            </span>
                                            <span>
                                                <ExpandOutlined />
                                                {formatArea(room.area)}
                                            </span>
                                            <span>
                                                <EnvironmentOutlined />
                                                {room.location || 'Chưa cập nhật'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={cx('cardActions')}>
                                        <Link to={`/chi-tiet-tin-dang/${room._id}`}>Xem chi tiết</Link>
                                        <button type="button" onClick={() => handleRemove(room._id)}>
                                            Xóa
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </section>

                    <section className={cx('sectionBlock')}>
                        <div className={cx('sectionHeader')}>
                            <h2>Bảng tiêu chí chính</h2>
                            <span>{rooms.length} phòng đang được đặt cạnh nhau</span>
                        </div>
                        <div className={cx('tableWrap')}>
                            <table className={cx('compareTable')}>
                                <thead>
                                    <tr>
                                        <th>Tiêu chí</th>
                                        {rooms.map((room) => (
                                            <th key={room._id} className={cx('roomColumnTitle')}>
                                                {room.title}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {renderRow('Điểm gợi ý', (room) => `${getScore(room, rooms)}/100`, 'scoreCell')}
                                    {renderRow('Giá thuê', (room) => formatMoney(room.price), 'priceCell')}
                                    {renderRow('Diện tích', (room) => formatArea(room.area))}
                                    {renderRow('Giá mỗi m²', (room) => `${formatMoney(getPricePerArea(room))}/m²`)}
                                    {renderRow('Tình trạng', (room) => (
                                        <span className={cx('statusPill', { available: room.availabilityStatus === 'available' })}>
                                            {availabilityLabels[room.availabilityStatus] || 'Chưa rõ'}
                                        </span>
                                    ))}
                                    {renderRow('Loại phòng', (room) => categoryLabels[room.category] || room.category || 'Chưa rõ')}
                                    {renderRow('Đánh giá', (room) =>
                                        room.ratingCount ? `${Number(room.ratingAverage || 0).toFixed(1)}/5 (${room.ratingCount})` : 'Chưa có',
                                    )}
                                    {renderRow('Vị trí', (room) => room.location || 'Chưa cập nhật')}
                                    {renderRow('Liên hệ', (room) => (
                                        <span className={cx('phoneValue')}>
                                            <PhoneOutlined />
                                            {room.phone || 'Chưa cập nhật'}
                                        </span>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {allOptions.length > 0 && (
                        <section className={cx('sectionBlock')}>
                            <div className={cx('sectionHeader')}>
                                <h2>So sánh tiện ích</h2>
                                <span>Các tiện ích xuất hiện trong những phòng đã chọn</span>
                            </div>
                            <div className={cx('tableWrap')}>
                                <table className={cx('compareTable')}>
                                    <thead>
                                        <tr>
                                            <th>Tiện ích</th>
                                            {rooms.map((room) => (
                                                <th key={room._id} className={cx('roomColumnTitle')}>
                                                    {room.title}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allOptions.map((option) =>
                                            renderRow(option, (room) =>
                                                (room.options || []).includes(option) ? (
                                                    <span className={cx('yesValue')}>
                                                        <CheckCircleOutlined />
                                                        Có
                                                    </span>
                                                ) : (
                                                    <span className={cx('noValue')}>Không</span>
                                                ),
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}

export default CompareRooms;
