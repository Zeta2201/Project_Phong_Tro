/* eslint-disable react-hooks/exhaustive-deps */
import classNames from 'classnames/bind';
import styles from './DetailPost.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPhoneAlt, faShareAlt, faFlag, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
import { faHeart } from '@fortawesome/free-regular-svg-icons';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, DatePicker, Input, message, Modal, Rate, Select, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
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
    const [depositAmount, setDepositAmount] = useState('');
    const [depositPaymentMethod, setDepositPaymentMethod] = useState('SIMULATED');
    const [depositSubmitting, setDepositSubmitting] = useState(false);

    const [reviewSummary, setReviewSummary] = useState({ ratingAverage: 0, ratingCount: 0, distribution: {} });
    const [reviews, setReviews] = useState([]);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [editingReview, setEditingReview] = useState(null);
    const [reviewForm, setReviewForm] = useState(emptyReviewForm);
    const [reviewImageFiles, setReviewImageFiles] = useState([]);

    const [reviewReportModalOpen, setReviewReportModalOpen] = useState(false);
    const [selectedReviewReport, setSelectedReviewReport] = useState(null);
    const [reviewReportReason, setReviewReportReason] = useState('');
    const [reviewReportDetails, setReviewReportDetails] = useState('');

    const [replyModalOpen, setReplyModalOpen] = useState(false);
    const [selectedReplyReview, setSelectedReplyReview] = useState(null);
    const [replyContent, setReplyContent] = useState('');

    const isAvailable = (post?.availabilityStatus || 'available') === 'available';
    const availabilityLabel =
        {
            available: 'Còn phòng',
            unavailable: 'Hết phòng',
            reserved: 'Đã giữ cọc',
            rented: 'Đã cho thuê',
        }[post?.availabilityStatus || 'available'] || 'Hết phòng';
    const isFavourite = userHeart.find((item) => item === dataUser?._id);
    const isPostOwner = post?.userId === dataUser?._id || post?.userId?._id === dataUser?._id;

    const fetchPost = async () => {
        const res = await requestGetPostById(id);
        const postData = res.metadata.data;
        setPost(postData);
        setSelectedImg(postData?.images?.[0] || '');
        setUser(res.metadata.dataUser || {});
        setUserHeart(res.metadata.userFavourite || []);
        document.title = `${postData.title} - PhongTro`;
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

    const handleCreateFavourite = async () => {
        try {
            const res = await requestCreateFavourite({ postId: post._id });
            fetchPost();
            message.success(res.message);
        } catch (error) {
            message.error(error.response?.data?.message || 'Luu tin that bai');
        }
    };

    const handleDeleteFavourite = async () => {
        try {
            const res = await requestDeleteFavourite({ postId: post._id });
            fetchPost();
            message.success(res.message);
        } catch (error) {
            message.error(error.response?.data?.message || 'Xoa tin luu that bai');
        }
    };

    const handleSubmitComment = async () => {
        if (!dataUser?._id) {
            message.warning('Vui long dang nhap de binh luan');
            return;
        }
        if (!commentContent.trim()) {
            message.warning('Vui long nhap noi dung binh luan');
            return;
        }

        try {
            setCommentSubmitting(true);
            await requestCreateComment({ postId: post._id, content: commentContent });
            setCommentContent('');
            await fetchComments();
            message.success('Da gui binh luan');
        } catch (error) {
            message.error(error.response?.data?.message || 'Khong the gui binh luan');
        } finally {
            setCommentSubmitting(false);
        }
    };

    const handleDeleteComment = (commentId) => {
        Modal.confirm({
            title: 'Xoa binh luan',
            content: 'Ban co chac muon xoa binh luan nay?',
            okText: 'Xoa',
            cancelText: 'Huy',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await requestDeleteComment({ commentId });
                    await fetchComments();
                    message.success('Da xoa binh luan');
                } catch (error) {
                    message.error(error.response?.data?.message || 'Khong the xoa binh luan');
                }
            },
        });
    };

    const handleSubmitReport = async () => {
        if (!dataUser?._id) {
            message.warning('Vui long dang nhap de bao cao bai viet');
            return;
        }
        if (!reportReason) {
            message.warning('Vui long chon ly do bao cao');
            return;
        }
        try {
            await requestReportPost({ postId: post._id, reason: reportReason, details: reportDetails });
            message.success('Bao cao cua ban da duoc gui');
            setReportModalOpen(false);
            setReportReason('');
            setReportDetails('');
        } catch (error) {
            message.error(error.response?.data?.message || 'Gui bao cao that bai');
        }
    };

    const handleSubmitReservation = async () => {
        if (!dataUser?._id) {
            message.warning('Vui long dang nhap de gui yeu cau giu cho');
            return;
        }
        if (!isAvailable) {
            message.warning('Phong nay hien khong con trong');
            return;
        }
        try {
            await requestCreateReservation({
                postId: post._id,
                note: reservationNote,
                visitDate: reservationVisitDate ? reservationVisitDate.toISOString() : null,
            });
            message.success('Da gui yeu cau giu cho cho chu bai viet');
            setReservationModalOpen(false);
            setReservationNote('');
            setReservationVisitDate(null);
        } catch (error) {
            message.error(error.response?.data?.message || 'Gui yeu cau giu cho that bai');
        }
    };

    const handleSubmitDeposit = async () => {
        if (!dataUser?._id) {
            message.warning('Vui long dang nhap de dat coc');
            return;
        }
        if (!isAvailable) {
            message.warning('Phong nay hien khong con trong');
            return;
        }

        try {
            setDepositSubmitting(true);
            const created = await requestCreateDeposit({
                roomId: post._id,
                amount: Number(depositAmount),
                paymentMethod: depositPaymentMethod,
            });
            const payment = await requestPayDeposit({ depositId: created.metadata._id });
            message.success(payment.message);
            setDepositModalOpen(false);
            setDepositAmount('');
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
            message.warning('Vui long dang nhap de danh gia');
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
            message.warning('Vui long chon so sao cho tat ca tieu chi');
            return;
        }
        if (!reviewForm.content.trim()) {
            message.warning('Vui long nhap noi dung danh gia');
            return;
        }

        try {
            const uploadedImages = await getReviewImages();
            const payload = { ...reviewForm, roomId: post._id, images: uploadedImages };

            if (editingReview) {
                await requestUpdateReview({ ...payload, reviewId: editingReview._id });
                message.success('Da cap nhat danh gia');
            } else {
                await requestCreateReview(payload);
                message.success('Da gui danh gia');
            }

            setReviewModalOpen(false);
            setEditingReview(null);
            setReviewForm(emptyReviewForm);
            setReviewImageFiles([]);
            fetchReviews();
            fetchPost();
        } catch (error) {
            message.error(error.response?.data?.message || 'Khong the luu danh gia');
        }
    };

    const handleDeleteReview = (review) => {
        Modal.confirm({
            title: 'Xoa danh gia',
            content: 'Danh gia se duoc xoa mem va khong con hien thi.',
            okText: 'Xoa',
            cancelText: 'Huy',
            okButtonProps: { danger: true },
            onOk: async () => {
                await requestDeleteReview({ reviewId: review._id });
                message.success('Da xoa danh gia');
                fetchReviews();
                fetchPost();
            },
        });
    };

    const handleOpenReportReview = (review) => {
        if (!dataUser?._id) {
            message.warning('Vui long dang nhap de bao cao danh gia');
            return;
        }
        setSelectedReviewReport(review);
        setReviewReportReason('');
        setReviewReportDetails('');
        setReviewReportModalOpen(true);
    };

    const handleSubmitReviewReport = async () => {
        if (!reviewReportReason) {
            message.warning('Vui long chon ly do bao cao');
            return;
        }
        try {
            await requestReportReview({
                reviewId: selectedReviewReport._id,
                reason: reviewReportReason,
                details: reviewReportDetails,
            });
            message.success('Da gui bao cao danh gia');
            setReviewReportModalOpen(false);
            fetchReviews();
        } catch (error) {
            message.error(error.response?.data?.message || 'Gui bao cao danh gia that bai');
        }
    };

    const handleOpenReplyReview = (review) => {
        setSelectedReplyReview(review);
        setReplyContent('');
        setReplyModalOpen(true);
    };

    const handleSubmitReplyReview = async () => {
        if (!replyContent.trim()) {
            message.warning('Vui long nhap phan hoi');
            return;
        }
        try {
            await requestReplyReview({ reviewId: selectedReplyReview._id, content: replyContent });
            message.success('Da phan hoi danh gia');
            setReplyModalOpen(false);
            fetchReviews();
        } catch (error) {
            message.error(error.response?.data?.message || 'Khong the phan hoi danh gia');
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
                                {post?.typeNews === 'vip' && <span className={cx('vip-tag')}>TIN VIP NOI BAT</span>}
                                <h1 className={cx('property-title')}>{post?.title}</h1>
                                <div className={cx('property-location')}>
                                    <span>{post?.location}</span>
                                </div>
                                <div className={cx('property-meta')}>
                                    <div className={cx('price')}>{post?.price?.toLocaleString()} VND/thang</div>
                                    <div className={cx('area')}>{post?.area} m2</div>
                                </div>
                            </div>

                            <div className={cx('property-description')}>
                                <h2>Thong tin mo ta</h2>
                                <p dangerouslySetInnerHTML={{ __html: post?.description }} />
                            </div>

                            <div className={cx('property-features')}>
                                <h2>Noi bat</h2>
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
                                        <span>{user?.lengthPost} tin dang</span>
                                        <span className={cx('dot-separator')}></span>
                                        <span>Tham gia từ: {dayjs(user?.createdAt).format('DD/MM/YYYY')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={cx('contact-buttons')}>
                                <a href={`tel:${user?.phone}`} className={cx('btn', 'btn-phone')}>
                                    <FontAwesomeIcon icon={faPhoneAlt} />
                                    {user?.phone || 'chua cap nhat'}
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
                                                        Xoa
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    ))
                                ) : (
                                    <p className={cx('comment-empty')}>Chua co binh luan nao.</p>
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
                okText="Tao yeu cau va thanh toan"
                cancelText="Huy"
                confirmLoading={depositSubmitting}
            >
                <p style={{ marginBottom: 16 }}>
                    So du hien tai: <strong>{(dataUser?.balance || 0).toLocaleString('vi-VN')} VND</strong>. He thong se tam giu
                    tien coc trong vi cua ban khi tao yeu cau.
                </p>
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>So tien coc</label>
                    <Input
                        type="number"
                        min={1}
                        value={depositAmount}
                        onChange={(event) => setDepositAmount(event.target.value)}
                        placeholder="Nhap so tien coc"
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: 8 }}>Phuong thuc thanh toan</label>
                    <Select
                        value={depositPaymentMethod}
                        onChange={setDepositPaymentMethod}
                        style={{ width: '100%' }}
                        options={[
                            { value: 'SIMULATED', label: 'Thanh toan bang so du (gia lap)' },
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
                    <label style={{ display: 'block', marginBottom: 8 }}>Ngay muon xem phong</label>
                    <DatePicker
                        value={reservationVisitDate}
                        onChange={setReservationVisitDate}
                        style={{ width: '100%' }}
                        format="DD/MM/YYYY"
                        placeholder="Chon ngay xem phong"
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: 8 }}>Ghi chu cho chu phong</label>
                    <Input.TextArea
                        value={reservationNote}
                        onChange={(e) => setReservationNote(e.target.value)}
                        rows={4}
                        placeholder="Vi du: Toi muon giu cho va hen xem phong buoi toi..."
                    />
                </div>
            </Modal>

            <Modal
                title="Bao cao bai viet"
                open={reportModalOpen}
                onCancel={() => setReportModalOpen(false)}
                onOk={handleSubmitReport}
                okText="Gui bao cao"
                cancelText="Huy"
            >
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>Ly do</label>
                    <Select
                        value={reportReason}
                        onChange={(value) => setReportReason(value)}
                        options={postReportOptions}
                        placeholder="Chon ly do bao cao"
                        style={{ width: '100%' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: 8 }}>Chi tiet</label>
                    <Input.TextArea
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        rows={4}
                        placeholder="Mo ta them thong tin ve van de"
                    />
                </div>
            </Modal>

            <Modal
                title={editingReview ? 'Sua danh gia' : 'Tao danh gia'}
                open={reviewModalOpen}
                onCancel={() => setReviewModalOpen(false)}
                onOk={handleSubmitReview}
                okText={editingReview ? 'Cap nhat' : 'Gui danh gia'}
                cancelText="Huy"
                width={720}
            >
                <div className={cx('review-form-grid')}>
                    {[
                        ['rating', 'Diem tong'],
                        ['cleanlinessRating', 'Ve sinh'],
                        ['securityRating', 'An ninh'],
                        ['locationRating', 'Vi tri'],
                        ['priceRating', 'Gia ca'],
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
                    <span>Noi dung danh gia</span>
                    <Input.TextArea
                        value={reviewForm.content}
                        onChange={(e) => setReviewForm((current) => ({ ...current, content: e.target.value }))}
                        rows={4}
                        placeholder="Chia se trai nghiem thuc te khi thue hoac giu cho phong nay"
                    />
                </label>
                <div className={cx('review-form-field')}>
                    <span>Anh danh gia</span>
                    <Upload
                        listType="picture"
                        multiple
                        accept="image/*"
                        fileList={reviewImageFiles}
                        beforeUpload={() => false}
                        onChange={({ fileList }) => setReviewImageFiles(fileList.slice(0, 8))}
                    >
                        <Button icon={<UploadOutlined />}>Chon anh</Button>
                    </Upload>
                </div>
            </Modal>

            <Modal
                title="Bao cao danh gia"
                open={reviewReportModalOpen}
                onCancel={() => setReviewReportModalOpen(false)}
                onOk={handleSubmitReviewReport}
                okText="Gui bao cao"
                cancelText="Huy"
            >
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>Ly do</label>
                    <Select
                        value={reviewReportReason}
                        onChange={(value) => setReviewReportReason(value)}
                        options={reviewReportOptions}
                        placeholder="Chon ly do bao cao"
                        style={{ width: '100%' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: 8 }}>Chi tiet</label>
                    <Input.TextArea
                        value={reviewReportDetails}
                        onChange={(e) => setReviewReportDetails(e.target.value)}
                        rows={4}
                        placeholder="Mo ta them van de cua danh gia"
                    />
                </div>
            </Modal>

            <Modal
                title="Phan hoi danh gia"
                open={replyModalOpen}
                onCancel={() => setReplyModalOpen(false)}
                onOk={handleSubmitReplyReview}
                okText="Gui phan hoi"
                cancelText="Huy"
            >
                <Input.TextArea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={4}
                    placeholder="Nhap phan hoi cua chu tro"
                />
            </Modal>
        </div>
    );
}

export default DetailPost;
