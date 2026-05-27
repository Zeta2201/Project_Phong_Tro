const modelReview = require('../models/review.model');
const modelPost = require('../models/post.model');
const modelReservation = require('../models/reservation.model');
const modelUser = require('../models/users.model');
const mongoose = require('mongoose');
const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');

const REVIEW_EDIT_RATING_DAYS = 7;
const REVIEW_REPORT_THRESHOLD = 5;
const REVIEW_REPORT_REASONS = ['spam', 'inappropriate', 'false-info', 'offensive'];
const REVIEW_STATUSES = ['visible', 'hidden', 'reported', 'deleted'];

const ensureRating = (value, fieldName) => {
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new BadRequestError(`${fieldName} khong hop le`);
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
            throw new BadRequestError('Vui long chon phong can xem danh gia');
        }

        const reviews = await modelReview
            .find({ roomId, status: 'visible' })
            .sort({ createdAt: -1 })
            .populate('userId', 'fullName avatar')
            .populate('reply.ownerId', 'fullName avatar');

        new OK({
            message: 'Lay danh sach danh gia thanh cong',
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
            throw new BadRequestError('Phong tro khong ton tai');
        }

        if (post.userId.toString() === userId) {
            throw new BadRequestError('Chu tro khong the danh gia phong cua chinh minh');
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
            rating: ensureRating(rating, 'Diem tong'),
            cleanlinessRating: ensureRating(cleanlinessRating, 'Diem ve sinh'),
            securityRating: ensureRating(securityRating, 'Diem an ninh'),
            locationRating: ensureRating(locationRating, 'Diem vi tri'),
            priceRating: ensureRating(priceRating, 'Diem gia'),
            content,
            images: normalizeImages(images),
        });

        await recalculatePostRating(roomId);

        new Created({ message: 'Tao danh gia thanh cong', metadata: review }).send(res);
    }

    async updateReview(req, res) {
        const { id: userId } = req.user;
        const { reviewId, rating, cleanlinessRating, securityRating, locationRating, priceRating, content, images } = req.body;

        const review = await modelReview.findById(reviewId);
        if (!review || review.status === 'deleted') {
            throw new BadRequestError('Danh gia khong ton tai');
        }

        if (review.userId.toString() !== userId) {
            throw new BadRequestError('Ban khong co quyen sua danh gia nay');
        }

        const updateRating = [rating, cleanlinessRating, securityRating, locationRating, priceRating].some((value) => value !== undefined);
        if (updateRating && !canEditRating(review)) {
            throw new BadRequestError('Chi duoc sua diem danh gia trong vong 7 ngay');
        }

        if (content !== undefined) {
            review.content = content;
        }

        if (images !== undefined) {
            review.images = normalizeImages(images);
        }

        if (rating !== undefined) review.rating = ensureRating(rating, 'Diem tong');
        if (cleanlinessRating !== undefined) review.cleanlinessRating = ensureRating(cleanlinessRating, 'Diem ve sinh');
        if (securityRating !== undefined) review.securityRating = ensureRating(securityRating, 'Diem an ninh');
        if (locationRating !== undefined) review.locationRating = ensureRating(locationRating, 'Diem vi tri');
        if (priceRating !== undefined) review.priceRating = ensureRating(priceRating, 'Diem gia');

        await review.save();
        await recalculatePostRating(review.roomId);

        new OK({ message: 'Cap nhat danh gia thanh cong', metadata: review }).send(res);
    }

    async deleteReview(req, res) {
        const { id: userId } = req.user;
        const { reviewId } = req.body;

        const review = await modelReview.findById(reviewId);
        if (!review || review.status === 'deleted') {
            throw new BadRequestError('Danh gia khong ton tai');
        }

        if (review.userId.toString() !== userId) {
            throw new BadRequestError('Ban khong co quyen xoa danh gia nay');
        }

        review.status = 'deleted';
        await review.save();
        await recalculatePostRating(review.roomId);

        new OK({ message: 'Da xoa danh gia', metadata: review }).send(res);
    }

    async replyReview(req, res) {
        const { id: ownerId } = req.user;
        const { reviewId, content } = req.body;

        const review = await modelReview.findById(reviewId).populate('roomId');
        if (!review || review.status === 'deleted') {
            throw new BadRequestError('Danh gia khong ton tai');
        }

        if (review.roomId.userId.toString() !== ownerId) {
            throw new BadRequestError('Chi chu tro moi duoc phan hoi danh gia');
        }

        if (review.reply?.content) {
            throw new BadRequestError('Moi danh gia chi duoc phan hoi mot lan');
        }

        review.reply = {
            content,
            ownerId,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await review.save();

        new OK({ message: 'Da phan hoi danh gia', metadata: review }).send(res);
    }

    async reportReview(req, res) {
        const { id: userId } = req.user;
        const { reviewId, reason, details } = req.body;

        if (!REVIEW_REPORT_REASONS.includes(reason)) {
            throw new BadRequestError('Ly do bao cao khong hop le');
        }

        const review = await modelReview.findById(reviewId);
        if (!review || review.status === 'deleted') {
            throw new BadRequestError('Danh gia khong ton tai');
        }

        const hasReported = review.reports.some((report) => report.userId.toString() === userId);
        if (hasReported) {
            throw new BadRequestError('Ban da bao cao danh gia nay');
        }

        review.reports.push({ userId, reason, details: details || '' });
        review.reportCount = review.reports.length;

        if (review.reportCount >= REVIEW_REPORT_THRESHOLD && review.status === 'visible') {
            review.status = 'reported';
        }

        await review.save();
        await recalculatePostRating(review.roomId);

        new OK({ message: 'Da gui bao cao danh gia', metadata: review }).send(res);
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

        new OK({ message: 'Lay tat ca danh gia thanh cong', metadata: reviews }).send(res);
    }

    async updateReviewStatus(req, res) {
        const { reviewId, status } = req.body;

        if (!REVIEW_STATUSES.includes(status)) {
            throw new BadRequestError('Trang thai danh gia khong hop le');
        }

        const review = await modelReview.findByIdAndUpdate(reviewId, { status }, { new: true });
        if (!review) {
            throw new BadRequestError('Danh gia khong ton tai');
        }

        await recalculatePostRating(review.roomId);

        new OK({ message: 'Cap nhat trang thai danh gia thanh cong', metadata: review }).send(res);
    }
}

module.exports = new controllerReview();
