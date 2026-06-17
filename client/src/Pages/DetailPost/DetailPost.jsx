/* eslint-disable react-hooks/exhaustive-deps */
import classNames from 'classnames/bind';
import styles from './DetailPost.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPhoneAlt, faShareAlt, faFlag, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
import { faHeart } from '@fortawesome/free-regular-svg-icons';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, DatePicker, Input, message, Modal, Rate, Select, Upload } from 'antd';
import { BarChartOutlined, CheckOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import userDefault from '../../assets/images/user-default.svg';
import {
    requestCreateComment,
    requestCreateDeposit,
    requestCreateFavourite,
    requestCreateReservation,
    requestCreateReview,
    requestDeleteComment,
    requestDeleteFavourite,
    requestDeleteReview,
    requestGetCommentsByPost,
    requestGetPostById,
    requestGetReviewsByRoom,
    requestPayDeposit,
    requestReplyReview,
    requestReportPost,
    requestReportReview,
    requestUpdateReview,
    requestUploadImages,
} from '../../config/request';
import { useStore } from '../../hooks/useStore';
import ChatButton from '../../utils/ChatButton/ChatButton';
import { addRoomToCompare, isRoomCompared, MAX_COMPARE_ROOMS, removeRoomFromCompare } from '../../utils/compareRooms';

const cx = classNames.bind(styles);

const emptyReviewForm = {
    rating: 0,
    cleanlinessRating: 0,
    securityRating: 0,
    locationRating: 0,
    priceRating: 0,
    content: '',
};

const reviewReportOptions = [
    { value: 'spam', label: 'Spam' },
    { value: 'inappropriate', label: 'Noi dung khong phu hop' },
    { value: 'false-info', label: 'Thong tin sai su that' },
    { value: 'offensive', label: 'Ngon tu xuc pham' },
];

const postReportOptions = [
    { value: 'spam', label: 'Noi dung spam' },
    { value: 'wrong-info', label: 'Thong tin sai su that' },
    { value: 'scam', label: 'Nghi gian lan / lua dao' },
    { value: 'other', label: 'Khac' },
];

function DetailPost() {
    const { id } = useParams();
    const { dataUser } = useStore();

    const [selectedImg, setSelectedImg] = useState('');
    const [user, setUser] = useState({});
    const [post, setPost] = useState({});
    const [userHeart, setUserHeart] = useState([]);
    const [comments, setComments] = useState([]);
    const [commentContent, setCommentContent] = useState('');
    const [commentSubmitting, setCommentSubmitting] = useState(false);

    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDetails, setReportDetails] = useState('');

    const [reservationModalOpen, setReservationModalOpen] = useState(false);
    const [reservationNote, setReservationNote] = useState('');
    const [reservationVisitDate, setReservationVisitDate] = useState(null);
    const [depositModalOpen, setDepositModalOpen] = useState(false);
    const [depositPaymentMethod, setDepositPaymentMethod] = useState('SIMULATED');
    const [depositSubmitting, setDepositSubmitting] = useState(false);

    const [reviewSummary, setReviewSummary] = useState({ ratingAverage: 0, ratingCount: 0, distribution: {} });
    const [reviews, setReviews] = useState([]);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [editingReview, setEditingReview] = useState(null);
    const [reviewForm, setReviewForm] = useState(emptyReviewForm);
    const [reviewImageFiles, setReviewImageFiles] = useState([]);
    const [compared, setCompared] = useState(false);

    const [reviewReportModalOpen, setReviewReportModalOpen] = useState(false);
    const [selectedReviewReport, setSelectedReviewReport] = useState(null);
    const [reviewReportReason, setReviewReportReason] = useState('');
    const [reviewReportDetails, setReviewReportDetails] = useState('');

    const [replyModalOpen, setReplyModalOpen] = useState(false);
    const [selectedReplyReview, setSelectedReplyReview] = useState(null);
    const [replyContent, setReplyContent] = useState('');

    const isAvailable = (post?.availabilityStatus || 'available') === 'available';
    const requiredDepositAmount = Math.ceil(Number(post?.price || 0) * 0.1);
    const availabilityLabel =
        {
            available: 'Còn phòng',
            unavailable: 'Hết phòng',
            reserved: 'Đã giữ cọc',
            rented: 'Đã cho thuê',
        }[post?.availabilityStatus || 'available'] || 'Hết phòng';
    const isFavourite = userHeart.find((item) => item === dataUser?._id);
    const isPostOwner = post?.userId === dataUser?._id || post?.userId?._id === dataUser?._id;
    const landlordReputation = user?.reputation || {};
    const reputationScore = Number(landlordReputation.score || 0);
    const reputationLabel =
        reputationScore >= 4.5
            ? 'Rất uy tín'
            : reputationScore >= 4
              ? 'Uy tín tốt'
              : reputationScore >= 3
                ? 'Đang xây dựng uy tín'
                : 'Cần thêm dữ liệu';
    const formatPercent = (value) => (value === null || value === undefined ? 'Chưa có dữ liệu' : `${value}%`);

    const fetchPost = async () => {
        const res = await requestGetPostById(id);
        const postData = res.metadata.data;
        setPost(postData);
        setSelectedImg(postData?.images?.[0] || '');
        setUser(res.metadata.dataUser || {});
        setUserHeart(res.metadata.userFavourite || []);
        document.title = `${postData.title} - NestFinder`;
    };

    const fetchReviews = async () => {
        const res = await requestGetReviewsByRoom(id);
        setReviews(res.metadata?.reviews || []);
        setReviewSummary(res.metadata?.summary || { ratingAverage: 0, ratingCount: 0, distribution: {} });
    };

    const fetchComments = async () => {
        const res = await requestGetCommentsByPost(id);
        setComments(res.metadata || []);
    };

    useEffect(() => {
        fetchPost();
        fetchReviews();
        fetchComments();
    }, [id]);

    useEffect(() => {
        const syncCompared = () => setCompared(isRoomCompared(id));

        syncCompared();
        window.addEventListener('compareRoomsUpdated', syncCompared);

        return () => window.removeEventListener('compareRoomsUpdated', syncCompared);
    }, [id]);

    const handleCompareRoom = () => {
        if (!post?._id) return;

        if (compared) {
            removeRoomFromCompare(post._id);
            setCompared(false);
            message.success('Đã bỏ phòng khỏi danh sách so sánh');
            return;
        }

        const result = addRoomToCompare({ ...post, user });

        if (result.status === 'full') {
            message.warning(`Chỉ có thể so sánh tối đa ${MAX_COMPARE_ROOMS} phòng`);
            return;
        }

        setCompared(true);
        message.success('Đã thêm phòng vào danh sách so sánh');
    };

    const handleCreateFavourite = async () => {
        try {
            const res = await requestCreateFavourite({ postId: post._id });
            fetchPost();
            message.success(res.message);
        } catch (error) {
            message.error(error.response?.data?.message || 'Lưu tin thất bại');
        }
    };

    const handleDeleteFavourite = async () => {
        try {
            const res = await requestDeleteFavourite({ postId: post._id });
            fetchPost();
            message.success(res.message);
        } catch (error) {
            message.error(error.response?.data?.message || 'Xóa tin lưu thất bại');
        }
    };

    const handleSubmitComment = async () => {
        if (!dataUser?._id) {
            message.warning('Vui lòng đăng nhập để bình luận');
            return;
        }
        if (!commentContent.trim()) {
            message.warning('Vui lòng nhập nội dung bình luận');
            return;
        }

        try {
            setCommentSubmitting(true);
            await requestCreateComment({ postId: post._id, content: commentContent });
            setCommentContent('');
            await fetchComments();
            message.success('Đã gửi bình luận');
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể gửi bình luận');
        } finally {
            setCommentSubmitting(false);
        }
    };

    const handleDeleteComment = (commentId) => {
        Modal.confirm({
            title: 'Xóa bình luận',
            content: 'Bạn có chắc muốn xóa bình luận này?',
            okText: 'Xóa',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await requestDeleteComment({ commentId });
                    await fetchComments();
                    message.success('Đã xóa bình luận');
                } catch (error) {
                    message.error(error.response?.data?.message || 'Không thể xóa bình luận');
                }
            },
        });
    };

    const handleSubmitReport = async () => {
        if (!dataUser?._id) {
            message.warning('Vui lòng đăng nhập để báo cáo bài viết');
            return;
        }
        if (!reportReason) {
            message.warning('Vui lòng chọn lý do báo cáo');
            return;
        }
        try {
            await requestReportPost({ postId: post._id, reason: reportReason, details: reportDetails });
            message.success('Báo cáo của bạn đã được gửi đi');
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
            message.warning('Phòng này hiện không còn trong');
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

    const handleSubmitDeposit = async () => {
        if (!dataUser?._id) {
            message.warning('Vui lòng đăng nhập để đặt cọc');
            return;
        }
        if (!isAvailable) {
            message.warning('Phòng này hiện không còn trong');
            return;
        }

        try {
            setDepositSubmitting(true);
            const created = await requestCreateDeposit({
                roomId: post._id,
                paymentMethod: depositPaymentMethod,
            });
            const payment = await requestPayDeposit({ depositId: created.metadata._id });
            message.success(payment.message);
            setDepositModalOpen(false);
            await fetchPost();
            if (payment.metadata?.redirectUrl) {
                window.location.href = payment.metadata.redirectUrl;
            }
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể tạo yêu cầu đặt cọc');
        } finally {
            setDepositSubmitting(false);
        }
    };

    const getReviewImages = async () => {
        const existedImages = reviewImageFiles.filter((file) => file.url && !file.originFileObj).map((file) => file.url);
        const newImages = reviewImageFiles.filter((file) => file.originFileObj);

        if (!newImages.length) return existedImages;

        const formData = new FormData();
        newImages.forEach((file) => formData.append('images', file.originFileObj));
        const res = await requestUploadImages(formData);
        return [...existedImages, ...(res.images || [])];
    };

    const handleOpenCreateReview = () => {
        if (!dataUser?._id) {
            message.warning('Vui lòng đăng nhập để đánh giá');
            return;
        }
        setEditingReview(null);
        setReviewForm(emptyReviewForm);
        setReviewImageFiles([]);
        setReviewModalOpen(true);
    };

    const handleOpenEditReview = (review) => {
        setEditingReview(review);
        setReviewForm({
            rating: review.rating,
            cleanlinessRating: review.cleanlinessRating,
            securityRating: review.securityRating,
            locationRating: review.locationRating,
            priceRating: review.priceRating,
            content: review.content || '',
        });
        setReviewImageFiles(
            (review.images || []).map((image, index) => ({
                uid: `existing-${index}`,
                name: `review-image-${index + 1}`,
                status: 'done',
                url: image,
            })),
        );
        setReviewModalOpen(true);
    };

    const handleReviewRatingChange = (field, value) => {
        setReviewForm((current) => ({ ...current, [field]: value }));
    };

    const handleSubmitReview = async () => {
        const ratingFields = ['rating', 'cleanlinessRating', 'securityRating', 'locationRating', 'priceRating'];
        if (ratingFields.some((field) => !reviewForm[field])) {
            message.warning('Vui lòng chọn số sao cho tất cả tiêu chí đánh giá');
            return;
        }
        if (!reviewForm.content.trim()) {
            message.warning('Vui lòng nhập nội dung đánh giá');
            return;
        }

        try {
            const uploadedImages = await getReviewImages();
            const payload = { ...reviewForm, roomId: post._id, images: uploadedImages };

            if (editingReview) {
                await requestUpdateReview({ ...payload, reviewId: editingReview._id });
                message.success('Đã cập nhật đánh giá');
            } else {
                await requestCreateReview(payload);
                message.success('Đã gửi đánh giá');
            }

            setReviewModalOpen(false);
            setEditingReview(null);
            setReviewForm(emptyReviewForm);
            setReviewImageFiles([]);
            fetchReviews();
            fetchPost();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể lưu đánh giá');
        }
    };

    const handleDeleteReview = (review) => {
        Modal.confirm({
            title: 'Xóa danh giá',
            content: 'Danh giá sẽ được xóa vĩnh viễn và không còn hiển thị.',
            okText: 'Xoá',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: async () => {
                await requestDeleteReview({ reviewId: review._id });
                message.success('Đã xóa đánh giá');
                fetchReviews();
                fetchPost();
            },
        });
    };

    const handleOpenReportReview = (review) => {
        if (!dataUser?._id) {
            message.warning('Vui lòng đăng nhập để báo cáo đánh giá');
            return;
        }
        setSelectedReviewReport(review);
        setReviewReportReason('');
        setReviewReportDetails('');
        setReviewReportModalOpen(true);
    };

    const handleSubmitReviewReport = async () => {
        if (!reviewReportReason) {
            message.warning('Vui lòng chọn lý do báo cáo');
            return;
        }
        try {
            await requestReportReview({
                reviewId: selectedReviewReport._id,
                reason: reviewReportReason,
                details: reviewReportDetails,
            });
            message.success('Đã gửi báo cáo đánh giá');
            setReviewReportModalOpen(false);
            fetchReviews();
        } catch (error) {
            message.error(error.response?.data?.message || 'Gửi báo cáo đánh giá thất bại');
        }
    };

    const handleOpenReplyReview = (review) => {
        setSelectedReplyReview(review);
        setReplyContent('');
        setReplyModalOpen(true);
    };

    const handleSubmitReplyReview = async () => {
        if (!replyContent.trim()) {
            message.warning('Vui lòng nhập phần hồi');
            return;
        }
        try {
            await requestReplyReview({ reviewId: selectedReplyReview._id, content: replyContent });
            message.success('Đã phản hồi đánh giá');
            setReplyModalOpen(false);
            fetchReviews();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể phản hồi đánh giá');
        }
    };

    const isReviewOwner = (review) => review.userId?._id === dataUser?._id || review.userId === dataUser?._id;

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
                                    {availabilityLabel}
                                </span>
                                {post?.typeNews === 'vip' && <span className={cx('vip-tag')}>TIN VIP NỔI BẬT</span>}
                                <h1 className={cx('property-title')}>{post?.title}</h1>
                                <div className={cx('property-location')}>
                                    <span>{post?.location}</span>
                                </div>
                                <div className={cx('property-meta')}>
                                    <div className={cx('price')}>{post?.price?.toLocaleString()} VND/tháng</div>
                                    <div className={cx('area')}>{post?.area} m2</div>
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
                            <h3 className={cx('section-title')}>Vị trí và bản đồ</h3>
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

                        <section className={cx('review-section')}>
                            <div className={cx('review-header')}>
                                <div>
                                    <h2>Đánh giá phòng trọ</h2>
                                    <div className={cx('review-score')}>
                                        <strong>{reviewSummary.ratingAverage || 0}</strong>
                                        <Rate disabled allowHalf value={reviewSummary.ratingAverage || 0} />
                                        <span>{reviewSummary.ratingCount || 0} lượt đánh giá</span>
                                    </div>
                                </div>
                                <button type="button" className={cx('review-create-btn')} onClick={handleOpenCreateReview}>
                                    Tạo đánh giá
                                </button>
                            </div>

                            <div className={cx('rating-breakdown')}>
                                {[5, 4, 3, 2, 1].map((star) => {
                                    const count = reviewSummary.distribution?.[star] || 0;
                                    const percent = reviewSummary.ratingCount ? Math.round((count / reviewSummary.ratingCount) * 100) : 0;
                                    return (
                                        <div className={cx('rating-row')} key={star}>
                                            <span>{star} sao</span>
                                            <div>
                                                <i style={{ width: `${percent}%` }} />
                                            </div>
                                            <strong>{count}</strong>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={cx('review-list')}>
                                {reviews.length > 0 ? (
                                    reviews.map((review) => (
                                        <article className={cx('review-card')} key={review._id}>
                                            <div className={cx('review-card-header')}>
                                                <div className={cx('review-user')}>
                                                    <img src={review.userId?.avatar || userDefault} alt="" />
                                                    <div>
                                                        <strong>{review.userId?.fullName || 'Nguoi dung'}</strong>
                                                        <span>{dayjs(review.createdAt).format('DD/MM/YYYY')}</span>
                                                    </div>
                                                </div>
                                                <Rate disabled value={review.rating} />
                                            </div>

                                            <div className={cx('review-subratings')}>
                                                <span>Vệ sinh: {review.cleanlinessRating}/5</span>
                                                <span>An ninh: {review.securityRating}/5</span>
                                                <span>Vị trí: {review.locationRating}/5</span>
                                                <span>Giá: {review.priceRating}/5</span>
                                            </div>

                                            <p>{review.content}</p>

                                            {review.images?.length > 0 && (
                                                <div className={cx('review-images')}>
                                                    {review.images.map((image) => (
                                                        <img src={image} alt="Anh danh gia" key={image} />
                                                    ))}
                                                </div>
                                            )}

                                            {review.reply?.content && (
                                                <div className={cx('review-reply')}>
                                                    <strong>Phản hồi từ chủ trọ</strong>
                                                    <p>{review.reply.content}</p>
                                                </div>
                                            )}

                                            <div className={cx('review-actions')}>
                                                {isReviewOwner(review) && (
                                                    <>
                                                        <button type="button" onClick={() => handleOpenEditReview(review)}>
                                                            Sửa
                                                        </button>
                                                        <button type="button" onClick={() => handleDeleteReview(review)}>
                                                            Xóa
                                                        </button>
                                                    </>
                                                )}
                                                {isPostOwner && !review.reply?.content && (
                                                    <button type="button" onClick={() => handleOpenReplyReview(review)}>
                                                        Phản hồi
                                                    </button>
                                                )}
                                                <button type="button" onClick={() => handleOpenReportReview(review)}>
                                                    Báo cáo
                                                </button>
                                            </div>
                                        </article>
                                    ))
                                ) : (
                                    <div className={cx('review-empty')}>Chưa có đánh giá nào cho phòng này.</div>
                                )}
                            </div>
                        </section>
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
                                        <span className={cx('status-text')}>{user?.status || 'Dang hoat dong'}</span>
                                    </div>
                                    <div className={cx('user-stats')}>
                                        <span>{user?.lengthPost} tin đăng</span>
                                        <span className={cx('dot-separator')}></span>
                                        <span>Tham gia từ: {dayjs(user?.createdAt).format('DD/MM/YYYY')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={cx('reputation-card')}>
                                <div className={cx('reputation-title')}>
                                    <span>Hệ thống uy tín chủ trọ</span>
                                    <strong>{reputationLabel}</strong>
                                </div>
                                <div className={cx('reputation-score')}>
                                    <Rate disabled allowHalf value={reputationScore} />
                                    <span>{reputationScore || 0}/5</span>
                                </div>
                                <div className={cx('reputation-grid')}>
                                    <div>
                                        <span>Số phòng đã cho thuê</span>
                                        <strong>{landlordReputation.rentedCount || 0}</strong>
                                    </div>
                                    <div>
                                        <span>Đánh giá</span>
                                        <strong>
                                            {landlordReputation.averageRating || 0}/5 ({landlordReputation.ratingCount || 0})
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Tỷ lệ phản hồi</span>
                                        <strong>{formatPercent(landlordReputation.responseRate)}</strong>
                                    </div>
                                    <div>
                                        <span>Tỷ lệ khiếu nại</span>
                                        <strong>{formatPercent(landlordReputation.complaintRate)}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className={cx('contact-buttons')}>
                                <a href={`tel:${user?.phone}`} className={cx('btn', 'btn-phone')}>
                                    <FontAwesomeIcon icon={faPhoneAlt} />
                                    {user?.phone || 'Chưa cập nhật'}
                                </a>
                                <button className={cx('btn', 'btn-reserve')} disabled={!isAvailable} onClick={() => setReservationModalOpen(true)}>
                                    Giữ chỗ
                                </button>
                                <button className={cx('btn', 'btn-deposit')} disabled={!isAvailable} onClick={() => setDepositModalOpen(true)}>
                                    Đặt cọc trung gian
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
                                <button onClick={isFavourite ? handleDeleteFavourite : handleCreateFavourite} className={cx('action-btn', { saved: isFavourite })}>
                                    <FontAwesomeIcon icon={faHeart} />
                                    {isFavourite ? 'Đã lưu' : 'Lưu tin'}
                                </button>
                                <button onClick={handleCompareRoom} className={cx('action-btn', { compared })}>
                                    {compared ? <CheckOutlined /> : <BarChartOutlined />}
                                    {compared ? 'Đã chọn' : 'So sanh'}
                                </button>
                                <button className={cx('action-btn')}>
                                    <FontAwesomeIcon icon={faShareAlt} />
                                    Chia sẻ
                                </button>
                                <button className={cx('action-btn', 'report-btn')} onClick={() => setReportModalOpen(true)}>
                                    <FontAwesomeIcon icon={faFlag} />
                                   Báo cáo
                                </button>
                            </div>
                        </div>

                        <div className={cx('comment-card')}>
                            <div className={cx('comment-header')}>
                                <h3>Bình luận</h3>
                                <span>{comments.length}</span>
                            </div>

                            {dataUser?._id ? (
                                <div className={cx('comment-form')}>
                                    <Input.TextArea
                                        value={commentContent}
                                        onChange={(event) => setCommentContent(event.target.value)}
                                        maxLength={1000}
                                        rows={3}
                                        placeholder="Nhập bình luận của bạn..."
                                    />
                                    <Button type="primary" loading={commentSubmitting} onClick={handleSubmitComment}>
                                        Gửi bình luận
                                    </Button>
                                </div>
                            ) : (
                                <p className={cx('comment-login-note')}>Vui lòng đăng nhập để bình luận.</p>
                            )}

                            <div className={cx('comment-list')}>
                                {comments.length > 0 ? (
                                    comments.map((comment) => (
                                        <article className={cx('comment-item')} key={comment._id}>
                                            <img src={comment.userId?.avatar || userDefault} alt="" />
                                            <div className={cx('comment-body')}>
                                                <div className={cx('comment-meta')}>
                                                    <strong>{comment.userId?.fullName || 'Nguoi dung'}</strong>
                                                    <span>{dayjs(comment.createdAt).format('DD/MM/YYYY HH:mm')}</span>
                                                </div>
                                                <p>{comment.content}</p>
                                                {comment.userId?._id === dataUser?._id && (
                                                    <button type="button" onClick={() => handleDeleteComment(comment._id)}>
                                                        Xóa
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    ))
                                ) : (
                                    <p className={cx('comment-empty')}>Chưa có bình luận nào.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Modal
                title="Đặt cọc trung gian"
                open={depositModalOpen}
                onCancel={() => setDepositModalOpen(false)}
                onOk={handleSubmitDeposit}
                okText="Tạo yêu cầu và thanh toán"
                cancelText="Hủy"
                confirmLoading={depositSubmitting}
            >
                <p style={{ marginBottom: 16 }}>
                    Số dư hiện tại: <strong>{(dataUser?.balance || 0).toLocaleString('vi-VN')} VND</strong>. Tiền cọc trung gian
                    bắt buộc là 10% giá thuê phòng.
                </p>
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>Số tiền cọc cần thanh toán</label>
                    <strong>{requiredDepositAmount.toLocaleString('vi-VN')} VND</strong>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: 8 }}>Phương thức thanh toán</label>
                    <Select
                        value={depositPaymentMethod}
                        onChange={setDepositPaymentMethod}
                        style={{ width: '100%' }}
                        options={[
                            { value: 'SIMULATED', label: 'Thanh toán bằng số dư (Giả lập).' },
                            { value: 'MOMO', label: 'MoMo sandbox' },
                            { value: 'VNPAY', label: 'VNPay sandbox' },
                        ]}
                    />
                </div>
            </Modal>

            <Modal
                title="Yêu cầu giữ chỗ"
                open={reservationModalOpen}
                onCancel={() => setReservationModalOpen(false)}
                onOk={handleSubmitReservation}
                okText="Gửi yêu cầu"
                cancelText="Hủy"
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
                        placeholder="Ví dụ: Tôi muốn xem phòng vào cuối tuần này, vui lòng sắp xếp thời gian phù hợp. Cảm ơn!"
                    />
                </div>
            </Modal>

            <Modal
                title="Báo cáo bài viết"
                open={reportModalOpen}
                onCancel={() => setReportModalOpen(false)}
                onOk={handleSubmitReport}
                okText="Gửi báo cáo"
                cancelText="Hủy"
            >
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>Lý do</label>
                    <Select
                        value={reportReason}
                        onChange={(value) => setReportReason(value)}
                        options={postReportOptions}
                        placeholder="Chon lý do báo cáo"
                        style={{ width: '100%' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: 8 }}>Chi tiết</label>
                    <Input.TextArea
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        rows={4}
                        placeholder="Mô tả thêm thông tin về vấn đề"
                    />
                </div>
            </Modal>

            <Modal
                title={editingReview ? 'Sửa đánh giá' : 'Tạo đánh giá'}
                open={reviewModalOpen}
                onCancel={() => setReviewModalOpen(false)}
                onOk={handleSubmitReview}
                okText={editingReview ? 'Cập nhật' : 'Gửi đánh giá'}
                cancelText="Hủy"
                width={720}
            >
                <div className={cx('review-form-grid')}>
                    {[
                        ['rating', 'Điểm tổng'],
                        ['cleanlinessRating', 'Vệ sinh'],
                        ['securityRating', 'An ninh'],
                        ['locationRating', 'Vị trí'],
                        ['priceRating', 'Giá cả'],
                    ].map(([field, label]) => (
                        <div className={cx('review-rating-field')} key={field}>
                            <span className={cx('review-rating-label')}>{label}</span>
                            <Rate
                                className={cx('review-rating-input')}
                                value={reviewForm[field]}
                                onChange={(value) => handleReviewRatingChange(field, value)}
                            />
                        </div>
                    ))}
                </div>
                <label className={cx('review-form-field')}>
                    <span>Nội dung đánh giá</span>
                    <Input.TextArea
                        value={reviewForm.content}
                        onChange={(e) => setReviewForm((current) => ({ ...current, content: e.target.value }))}
                        rows={4}
                        placeholder="Chia sẻ trải nghiệm thực tế khi thuê phòng trọ này..."
                    />
                </label>
                <div className={cx('review-form-field')}>
                    <span>Ảnh đánh giá</span>
                    <Upload
                        listType="picture"
                        multiple
                        accept="image/*"
                        fileList={reviewImageFiles}
                        beforeUpload={() => false}
                        onChange={({ fileList }) => setReviewImageFiles(fileList.slice(0, 8))}
                    >
                        <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
                    </Upload>
                </div>
            </Modal>

            <Modal
                title="Báo cáo đánh giá"
                open={reviewReportModalOpen}
                onCancel={() => setReviewReportModalOpen(false)}
                onOk={handleSubmitReviewReport}
                okText="Gửi báo cáo"
                cancelText="Hủy"
            >
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>Lý do</label>
                    <Select
                        value={reviewReportReason}
                        onChange={(value) => setReviewReportReason(value)}
                        options={reviewReportOptions}
                        placeholder="Chọn lý do báo cáo"
                        style={{ width: '100%' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: 8 }}>Chi tiết</label>
                    <Input.TextArea
                        value={reviewReportDetails}
                        onChange={(e) => setReviewReportDetails(e.target.value)}
                        rows={4}
                        placeholder="Mô tả thêm vấn đề của đánh giá"
                    />
                </div>
            </Modal>

            <Modal
                title="Phản hồi đánh giá"
                open={replyModalOpen}
                onCancel={() => setReplyModalOpen(false)}
                onOk={handleSubmitReplyReview}
                okText="Gửi phản hồi"
                cancelText="Hủy"
            >
                <Input.TextArea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={4}
                    placeholder="Nhập phản hồi của chủ trọ"
                />
            </Modal>
        </div>
    );
}

export default DetailPost;
