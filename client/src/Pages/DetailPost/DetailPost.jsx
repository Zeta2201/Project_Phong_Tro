import classNames from 'classnames/bind';
import styles from './DetailPost.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPhoneAlt, faShareAlt, faFlag, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
import { faHeart } from '@fortawesome/free-regular-svg-icons';

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import userDefault from '../../assets/images/user-default.svg';

import dayjs from 'dayjs';

import {
    requestCreateReservation,
    requestCreateFavourite,
    requestDeleteFavourite,
    requestGetPostById,
    requestGetPostVip,
    requestReportPost,
} from '../../config/request';
import { useStore } from '../../hooks/useStore';
import { useSocket } from '../../hooks/useSocket';
import Messager from '../../utils/Messager/Messager';
import ChatButton from '../../utils/ChatButton/ChatButton';
import { message, Modal, Select, Input, DatePicker } from 'antd';

const cx = classNames.bind(styles);

function DetailPost() {
    const [selectedImg, setSelectedImg] = useState('');

    const [user, setUser] = useState({});

    const [post, setPost] = useState({});

    const { id } = useParams();

    const [userHeart, setUserHeart] = useState([]);

    const [postVip, setPostVip] = useState([]);
    const isAvailable = (post?.availabilityStatus || 'available') === 'available';

    const fetchPost = async () => {
        const res = await requestGetPostById(id);
        setPost(res.metadata.data);
        setSelectedImg(res?.metadata?.data?.images[0]);
        setUser(res?.metadata?.dataUser);
        setUserHeart(res?.metadata?.userFavourite);
        document.title = `${res.metadata.data.title} - PhongTro123`;
    };

    useEffect(() => {
        fetchPost();
    }, [id]);

    useEffect(() => {
        const fetchPostVip = async () => {
            const res = await requestGetPostVip();
            setPostVip((res.metadata || []).filter((item) => item?.status === 'active'));
        };
        fetchPostVip();
    }, []);

    const { dataUser, setDataMessages } = useStore();
    const isFavourite = userHeart.find((item) => item === dataUser?._id);
    const { usersMessage, setUsersMessage } = useSocket();
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDetails, setReportDetails] = useState('');
    const [reservationModalOpen, setReservationModalOpen] = useState(false);
    const [reservationNote, setReservationNote] = useState('');
    const [reservationVisitDate, setReservationVisitDate] = useState(null);
    const reportOptions = [
        { value: 'spam', label: 'Nội dung spam' },
        { value: 'wrong-info', label: 'Thông tin sai sự thật' },
        { value: 'scam', label: 'Nghi gian lận / lừa đảo' },
        { value: 'other', label: 'Khác' },
    ];

    const handleCreateFavourite = async () => {
        try {
            const data = {
                postId: post._id,
            };
            const res = await requestCreateFavourite(data);
            fetchPost();
            message.success(res.message);
        } catch (error) {
            message.error(error.response.data.message);
        }
    };

    const handleDeleteFavourite = async () => {
        try {
            const data = {
                postId: post._id,
            };
            const res = await requestDeleteFavourite(data);
            fetchPost();
            message.error(res.message);
        } catch (error) {
            message.error(error.response?.data?.message || 'Xóa tin lưu thất bại');
        }
    };

    const handleSubmitReport = async () => {
        if (!dataUser?._id) {
            message.warning('Vui lòng đăng nhập để báo cáo bài viết');
            return;
        }
        if (!reportReason) {
            message.warning('Vui lòng chọn lý do báo cáo');
            return;
        }
        try {
            await requestReportPost({
                postId: post._id,
                reason: reportReason,
                details: reportDetails,
            });
            message.success('Báo cáo của bạn đã được gửi');
            setReportModalOpen(false);
            setReportReason('');
            setReportDetails('');
        } catch (error) {
            message.error(error.response?.data?.message || 'Gửi báo cáo thất bại');
        }
    };

    const handleSubmitReservation = async () => {
        if (!dataUser?._id) {
            message.warning('Vui lòng đăng nhập để gửi yêu cầu giữ chỗ');
            return;
        }
        if (!isAvailable) {
            message.warning('Phòng này hiện không còn trống');
            return;
        }
        try {
            await requestCreateReservation({
                postId: post._id,
                note: reservationNote,
                visitDate: reservationVisitDate ? reservationVisitDate.toISOString() : null,
            });
            message.success('Đã gửi yêu cầu giữ chỗ cho chủ bài viết');
            setReservationModalOpen(false);
            setReservationNote('');
            setReservationVisitDate(null);
        } catch (error) {
            message.error(error.response?.data?.message || 'Gửi yêu cầu giữ chỗ thất bại');
        }
    };

    return (
        <div className={cx('wrapper')}>
            <main className={cx('container')}>
                <div className={cx('content')}>
                    <div className={cx('left')}>
                        <div className={cx('slider-container')}>
                            <div className={cx('slide-item')}>
                                <img src={selectedImg} alt="" />
                            </div>
                            <div className={cx('select-img')}>
                                {post?.images?.map((image, index) => (
                                    <img key={index} src={image} alt="" onClick={() => setSelectedImg(image)} />
                                ))}
                            </div>
                        </div>

                        <div className={cx('property-details')}>
                            <div className={cx('property-header')}>
                                <span className={cx('availability-tag', { unavailable: !isAvailable })}>
                                    {isAvailable ? 'Còn phòng' : 'Hết phòng'}
                                </span>
                                {post?.typeNews === 'vip' && <span className={cx('vip-tag')}>TIN VIP NỔI BẬT</span>}
                                <h1 className={cx('property-title')}> {post?.title}</h1>
                                <div className={cx('property-location')}>
                                    <span>{post?.location}</span>
                                </div>
                                <div className={cx('property-meta')}>
                                    <div className={cx('price')}>{post?.price?.toLocaleString()} VNĐ/tháng</div>
                                    <div className={cx('area')}>{post?.area} m²</div>
                                </div>
                            </div>

                            <div className={cx('property-description')}>
                                <h2>Thông tin mô tả</h2>
                                <p dangerouslySetInnerHTML={{ __html: post?.description }} />
                            </div>

                            <div className={cx('property-features')}>
                                <h2>Nổi bật</h2>
                                <div className={cx('features-grid')}>
                                    {post?.options?.map((option, index) => (
                                        <div className={cx('feature-item')} key={index}>
                                            <span className={cx('feature-icon', 'check')}></span>
                                            <span>{option}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className={cx('map-section')}>
                            <h3 className={cx('section-title')}>Vị trí & bản đồ</h3>
                            <div className={cx('map-container')}>
                                <div className={cx('address-bar')}>
                                    <FontAwesomeIcon icon={faMapMarkerAlt} className={cx('location-icon')} />
                                    <span className={cx('address-text')}>{post?.location}</span>
                                </div>
                                <div className={cx('map-frame')}>
                                    <iframe
                                        src={`https://www.google.com/maps?q=${post?.location}&output=embed`}
                                        width="600"
                                        height="450"
                                        style={{ border: 0 }}
                                        allowFullScreen
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                        title="Property Location"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={cx('right')}>
                        <div className={cx('contact-card')}>
                            <div className={cx('user-info')}>
                                <div className={cx('avatar')}>
                                    <img src={user?.avatar || userDefault} alt="Avatar" />
                                </div>
                                <div className={cx('user-details')}>
                                    <h3 className={cx('user-name')}>{user?.username || user?.fullName}</h3>
                                    <div className={cx('user-status')}>
                                        <span className={cx('status-dot')}></span>
                                        <span className={cx('status-text')}>{user?.status || 'Đang hoạt động'}</span>
                                    </div>
                                    <div className={cx('user-stats')}>
                                        <span>{user?.lengthPost} tin đăng</span>
                                        <span className={cx('dot-separator')}></span>
                                        <span>Tham gia từ: {dayjs(user?.createdAt).format('DD/MM/YYYY')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={cx('contact-buttons')}>
                                <a href={`tel:${user?.phone}`} className={cx('btn', 'btn-phone')}>
                                    <FontAwesomeIcon icon={faPhoneAlt} />
                                    {user?.phone || 'chưa cập nhật'}
                                </a>
                                <button
                                    className={cx('btn', 'btn-reserve')}
                                    disabled={!isAvailable}
                                    onClick={() => setReservationModalOpen(true)}
                                >
                                    Giữ chỗ
                                </button>
                                <ChatButton
                                    userId={user._id}
                                    username={user.username || user.fullName}
                                    avatar={user.avatar}
                                    status={user.status}
                                    className={cx('btn', 'btn-zalo')}
                                    icon={false}
                                />
                            </div>

                            <div className={cx('action-buttons')}>
                                <button
                                    onClick={isFavourite ? handleDeleteFavourite : handleCreateFavourite}
                                    className={cx('action-btn', { saved: isFavourite })}
                                >
                                    <FontAwesomeIcon icon={faHeart} />
                                    {userHeart.find((item) => item === dataUser?._id) ? 'Đã lưu' : 'Lưu tin'}
                                </button>
                                <button className={cx('action-btn')}>
                                    <FontAwesomeIcon icon={faShareAlt} />
                                    Chia sẻ
                                </button>
                                <button className={cx('action-btn', 'report-btn')} onClick={() => setReportModalOpen(true)}>
                                    <FontAwesomeIcon icon={faFlag} />
                                    Báo cáo
                                </button>
                            </div>
                        </div>

                        <Modal
                            title="Yêu cầu giữ chỗ"
                            open={reservationModalOpen}
                            onCancel={() => setReservationModalOpen(false)}
                            onOk={handleSubmitReservation}
                            okText="Gửi yêu cầu"
                            cancelText="Hủy"
                        >
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', marginBottom: 8 }}>Ngày muốn xem phòng</label>
                                <DatePicker
                                    value={reservationVisitDate}
                                    onChange={setReservationVisitDate}
                                    style={{ width: '100%' }}
                                    format="DD/MM/YYYY"
                                    placeholder="Chọn ngày xem phòng"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>Ghi chú cho chủ phòng</label>
                                <Input.TextArea
                                    value={reservationNote}
                                    onChange={(e) => setReservationNote(e.target.value)}
                                    rows={4}
                                    placeholder="Ví dụ: Tôi muốn giữ chỗ và hẹn xem phòng buổi tối..."
                                />
                            </div>
                        </Modal>

                        <Modal
                        title="Báo cáo bài viết"
                        open={reportModalOpen}
                        onCancel={() => setReportModalOpen(false)}
                        onOk={handleSubmitReport}
                        okText="Gửi báo cáo"
                        cancelText="Hủy"
                    >
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', marginBottom: 8 }}>Lý do</label>
                            <Select
                                value={reportReason}
                                onChange={(value) => setReportReason(value)}
                                options={reportOptions}
                                placeholder="Chọn lý do báo cáo"
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8 }}>Chi tiết (không bắt buộc)</label>
                            <Input.TextArea
                                value={reportDetails}
                                onChange={(e) => setReportDetails(e.target.value)}
                                rows={4}
                                placeholder="Mô tả thêm thông tin về vấn đề"
                            />
                        </div>
                    </Modal>
                    <div className={cx('featured-listings')}>
                            <h3 className={cx('featured-title')}>Tin đăng nổi bật</h3>
                            {postVip.map((item, index) => (
                                <div className={cx('listing-item')} key={index}>
                                    <div className={cx('listing-image')}>
                                        <img src={item.images[0]} alt="Phòng trọ cao cấp" />
                                    </div>
                                    <div className={cx('listing-content')}>
                                        <h4 className={cx('listing-name')}>{item.title}</h4>
                                        <div className={cx('listing-price')}>
                                            {item.price.toLocaleString()} VNĐ/tháng
                                        </div>
                                        <div className={cx('listing-time')}>
                                            {dayjs(item.createdAt).format('DD/MM/YYYY')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default DetailPost;
