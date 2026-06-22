const modelReview = require('../models/review.model');
const modelPost = require('../models/post.model');
const modelReservation = require('../models/reservation.model');
const modelDeposit = require('../models/deposit.model');
const modelUser = require('../models/users.model');
const mongoose = require('mongoose');
const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const { createNotification, notifyAdmins } = require('../services/notification.service');

const REVIEW_EDIT_RATING_DAYS = 7;
const REVIEW_REPORT_THRESHOLD = 5;
const REVIEW_REPORT_REASONS = ['spam', 'inappropriate', 'false-info', 'offensive'];
const REVIEW_STATUSES = ['visible', 'hidden', 'reported', 'deleted'];

const ensureRating = (value, fieldName) => {
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new BadRequestError(`${fieldName} không hợp lệ`);
    }
    return rating;
};

const normalizeImages = (images) => (Array.isArray(images) ? images.filter(Boolean).slice(0, 8) : []);

const canEditRating = (review) => {
    const editableUntil = new Date(review.createdAt).getTime() + REVIEW_EDIT_RATING_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() <= editableUntil;
};

const recalculatePostRating = async (roomId) => {
    const result = await modelReview.aggregate([
        {
            $match: {
                roomId: typeof roomId === 'string' ? new mongoose.Types.ObjectId(roomId) : roomId,
                status: 'visible',
            },
        },
        {
            $group: {
                _id: '$roomId',
                ratingAverage: { $avg: '$rating' },
                ratingCount: { $sum: 1 },
            },
        },
    ]);

    const ratingAverage = result[0]?.ratingAverage ? Number(result[0].ratingAverage.toFixed(1)) : 0;
    const ratingCount = result[0]?.ratingCount || 0;

    await modelPost.findByIdAndUpdate(roomId, { ratingAverage, ratingCount });
    return { ratingAverage, ratingCount };
};

const buildSummary = (reviews) => {
    const visibleReviews = reviews.filter((review) => review.status === 'visible');
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    visibleReviews.forEach((review) => {
        distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    });

    const ratingCount = visibleReviews.length;
    const ratingAverage = ratingCount
        ? Number((visibleReviews.reduce((total, review) => total + review.rating, 0) / ratingCount).toFixed(1))
        : 0;

    return { ratingAverage, ratingCount, distribution };
};

const findValidRental = async ({ roomId, userId, rentalId }) => {
    const depositFilter = {
        roomId,
        tenantId: userId,
        status: 'completed',
        paymentStatus: 'paid',
    };

    if (rentalId) {
        depositFilter._id = rentalId;
    }

    const completedDeposit = await modelDeposit.findOne(depositFilter).sort({ updatedAt: -1 });
    if (completedDeposit) {
        return { document: completedDeposit, type: 'deposit' };
    }

    const optionalTransactions = [
        {
            modelName: 'rental',
            type: 'rental',
            filter: { roomId, userId, status: 'completed' },
        },
        {
            modelName: 'booking',
            type: 'booking',
            filter: { roomId, userId, status: 'confirmed' },
        },
        {
            modelName: 'contract',
            type: 'contract',
            filter: { roomId, userId, status: 'active' },
        },
    ];

    for (const transaction of optionalTransactions) {
        const TransactionModel = mongoose.models[transaction.modelName];
        if (!TransactionModel) continue;

        const filter = { ...transaction.filter };
        if (rentalId) filter._id = rentalId;

        const validTransaction = await TransactionModel.findOne(filter).sort({ updatedAt: -1 });
        if (validTransaction) {
            return { document: validTransaction, type: transaction.type };
        }
    }

    const filter = {
        postId: roomId,
        tenantId: userId,
        status: 'accepted',
    };

    if (rentalId) {
        filter._id = rentalId;
    }

    const reservation = await modelReservation.findOne(filter).sort({ handledAt: -1, updatedAt: -1 });
    return reservation ? { document: reservation, type: 'reservation' } : null;
};

class controllerReview {
    async getReviewsByRoom(req, res) {
        const { roomId } = req.query;

        if (!roomId) {
            throw new BadRequestError('Vui lòng chọn phòng cần xem đánh giá');
        }

        const reviews = await modelReview
            .find({ roomId, status: 'visible' })
            .sort({ createdAt: -1 })
            .populate('userId', 'fullName avatar')
            .populate('reply.ownerId', 'fullName avatar');

        new OK({
            message: 'Lấy danh sách giá thành công',
            metadata: {
                reviews,
                summary: buildSummary(reviews),
            },
        }).send(res);
    }

    async createReview(req, res) {
        const { id: userId } = req.user;
        const {
            roomId,
            rentalId,
            rating,
            cleanlinessRating,
            securityRating,
            locationRating,
            priceRating,
            content,
            images,
        } = req.body;

        const post = await modelPost.findById(roomId);
        if (!post) {
            throw new BadRequestError('Phòng trọ không tồn tại');
        }

        if (post.userId.toString() === userId) {
            throw new BadRequestError('Chủ trọ không thể đánh giá phòng của chính mình');
        }

        const validRental = await findValidRental({ roomId, userId, rentalId });
        if (!validRental) {
            throw new BadRequestError('Bạn chỉ có thể đánh giá sau khi thuê hoặc giao dịch thành công');
        }

        const existedReview = await modelReview.findOne({ userId, rentalId: validRental.document._id });
        if (existedReview) {
            throw new BadRequestError('Bạn đã đánh giá giao dịch này');
        }

        const review = await modelReview.create({
            roomId,
            userId,
            rentalId: validRental.document._id,
            rentalType: validRental.type,
            rating: ensureRating(rating, 'Điểm tổng'),
            cleanlinessRating: ensureRating(cleanlinessRating, 'Điểm vệ sinh'),
            securityRating: ensureRating(securityRating, 'Điểm an ninh'),
            locationRating: ensureRating(locationRating, 'Điểm vị trí'),
            priceRating: ensureRating(priceRating, 'Điểm giá'),
            content,
            images: normalizeImages(images),
        });

        await recalculatePostRating(roomId);
        await createNotification(
            post.userId,
            'Có đánh giá mới',
            `Phòng "${post.title || ''}" vừa nhận đánh giá mới`,
            'post',
            `/chi-tiet-tin-dang/${roomId}`,
            { reviewId: review._id, roomId },
        );

        new Created({ message: 'Tạo đánh giá thành công', metadata: review }).send(res);
    }

    async updateReview(req, res) {
        const { id: userId } = req.user;
        const { reviewId, rating, cleanlinessRating, securityRating, locationRating, priceRating, content, images } = req.body;

        const review = await modelReview.findById(reviewId);
        if (!review || review.status === 'deleted') {
            throw new BadRequestError('Đánh giá không tồn tại');
        }

        if (review.userId.toString() !== userId) {
            throw new BadRequestError('Bạn không có quyền sửa đánh giá này');
        }

        const updateRating = [rating, cleanlinessRating, securityRating, locationRating, priceRating].some((value) => value !== undefined);
        if (updateRating && !canEditRating(review)) {
            throw new BadRequestError('Chỉ được sửa điểm đánh giá trong vòng 7 ngày');
        }

        if (content !== undefined) {
            review.content = content;
        }

        if (images !== undefined) {
            review.images = normalizeImages(images);
        }

        if (rating !== undefined) review.rating = ensureRating(rating, 'Điểm tổng');
        if (cleanlinessRating !== undefined) review.cleanlinessRating = ensureRating(cleanlinessRating, 'Điểm vệ sinh');
        if (securityRating !== undefined) review.securityRating = ensureRating(securityRating, 'Điểm an ninh');
        if (locationRating !== undefined) review.locationRating = ensureRating(locationRating, 'Điểm vị trí');
        if (priceRating !== undefined) review.priceRating = ensureRating(priceRating, 'Điểm giá');
        await review.save();
        await recalculatePostRating(review.roomId);

        new OK({ message: 'Cập nhật đánh giá thành công', metadata: review }).send(res);
    }

    async deleteReview(req, res) {
        const { id: userId } = req.user;
        const { reviewId } = req.body;

        const review = await modelReview.findById(reviewId);
        if (!review || review.status === 'deleted') {
            throw new BadRequestError('Đánh giá không tồn tại');
        }

        if (review.userId.toString() !== userId) {
            throw new BadRequestError('Bạn không có quyền xóa đánh giá này');
        }

        review.status = 'deleted';
        await review.save();
        await recalculatePostRating(review.roomId);

        new OK({ message: 'Đã xóa đánh giá', metadata: review }).send(res);
    }

    async replyReview(req, res) {
        const { id: ownerId } = req.user;
        const { reviewId, content } = req.body;

        const review = await modelReview.findById(reviewId).populate('roomId');
        if (!review || review.status === 'deleted') {
            throw new BadRequestError('Đánh giá không tồn tại');
        }

        if (review.roomId.userId.toString() !== ownerId) {
            throw new BadRequestError('Chỉ chủ trọ mới được phản hồi đánh giá');
        }

        if (review.reply?.content) {
            throw new BadRequestError('Đánh giá chỉ được phản hồi một lần');
        }

        review.reply = {
            content,
            ownerId,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await review.save();

        new OK({ message: 'Đã phản hồi đánh giá', metadata: review }).send(res);
    }

    async reportReview(req, res) {
        const { id: userId } = req.user;
        const { reviewId, reason, details } = req.body;

        if (!REVIEW_REPORT_REASONS.includes(reason)) {
            throw new BadRequestError('Lý do báo cáo không hợp lệ');
        }

        const review = await modelReview.findById(reviewId);
        if (!review || review.status === 'deleted') {
            throw new BadRequestError('Đánh giá không tồn tại');
        }

        const hasReported = review.reports.some((report) => report.userId.toString() === userId);
        if (hasReported) {
            throw new BadRequestError('Bạn đã báo cáo đánh giá này');
        }

        review.reports.push({ userId, reason, details: details || '' });
        review.reportCount = review.reports.length;

        if (review.reportCount >= REVIEW_REPORT_THRESHOLD && review.status === 'visible') {
            review.status = 'reported';
        }

        await review.save();
        await recalculatePostRating(review.roomId);
        await notifyAdmins(
            'Có báo cáo đánh giá mới',
            'Một đánh giá vừa được người dùng báo cáo',
            'report',
            '/admin?type=reviews',
            { reviewId: review._id, roomId: review.roomId, reason },
        );

        new OK({ message: 'Đã gửi báo cáo đánh giá', metadata: review }).send(res);
    }

    async getAllReviews(req, res) {
        const { status, roomId } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (roomId) filter.roomId = roomId;

        const reviews = await modelReview
            .find(filter)
            .sort({ createdAt: -1 })
            .populate('roomId', 'title userId')
            .populate('userId', 'fullName email avatar')
            .populate('reports.userId', 'fullName email avatar');

        new OK({ message: 'Lấy tất cả đánh giá thành công', metadata: reviews }).send(res);
    }

    async updateReviewStatus(req, res) {
        const { reviewId, status } = req.body;

        if (!REVIEW_STATUSES.includes(status)) {
            throw new BadRequestError('Trạng thái đánh giá không hợp lệ');
        }

        const review = await modelReview.findByIdAndUpdate(reviewId, { status }, { new: true });
        if (!review) {
            throw new BadRequestError('Đánh giá không tồn tại');
        }

        await recalculatePostRating(review.roomId);

        new OK({ message: 'Cập nhật trạng thái đánh giá thành công', metadata: review }).send(res);
    }
}

module.exports = new controllerReview();
