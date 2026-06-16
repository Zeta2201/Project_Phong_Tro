const modelPost = require('../models/post.model');
const modelUser = require('../models/users.model');
const modelFavourite = require('../models/favourite.model');
const modelReservation = require('../models/reservation.model');
const modelDeposit = require('../models/deposit.model');
const modelMessager = require('../models/Messager.model');
const modelReport = require('../models/report.model');

const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const SendMailApprove = require('../utils/SendMail/SendMailApprove');
const SendMailReject = require('../utils/SendMail/SendMailReject');
const { getPostingFeeByPlan, inferPostingFeeFromPost } = require('../utils/postingFee');
const { normalizeVoucherCode, previewVoucher, markVoucherUsed } = require('../utils/voucher');
const { buildNumericCondition, ensureDefaultFilterOptions, getActiveFilterOption } = require('../services/filterOption.service');

const getRefundablePostingFee = (post) => {
    if (!post || post.postingFeeRefunded) return 0;
    return inferPostingFeeFromPost(post);
};

const normalizeVietnameseText = (value = '') =>
    value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase();

const locationAliases = {
    'can tho': ['Cần Thơ', 'Can Tho'],
    'ha noi': ['Hà Nội', 'Ha Noi'],
    'ho chi minh': ['Hồ Chí Minh', 'Ho Chi Minh', 'TP.HCM', 'TP HCM', 'Sài Gòn', 'Sai Gon'],
};

const getLocationSearchTerms = (province, location) => {
    const rawValue = province || location;
    if (!rawValue) return [];

    const normalizedValue = normalizeVietnameseText(rawValue).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    const terms = locationAliases[normalizedValue] || [rawValue];
    return [...new Set(terms.map(normalizeVietnameseText))];
};

const matchesLocation = (post, locationTerms) => {
    if (!locationTerms.length) return true;
    const normalizedLocation = normalizeVietnameseText(post.location);
    return locationTerms.some((term) => normalizedLocation.includes(term));
};

const parseCoordinate = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
};

const parseCoordinates = (coordinates = {}) => {
    const lat = parseCoordinate(coordinates.lat);
    const lng = parseCoordinate(coordinates.lng);
    return lat !== null && lng !== null ? { lat, lng } : { lat: null, lng: null };
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getLandlordReputation = async (landlordId) => {
    const posts = await modelPost.find({ userId: landlordId }).select('_id availabilityStatus ratingAverage ratingCount').lean();
    const postIds = posts.map((post) => post._id);
    const postCount = posts.length;

    const ratingTotals = posts.reduce(
        (total, post) => {
            const count = Number(post.ratingCount || 0);
            return {
                count: total.count + count,
                sum: total.sum + Number(post.ratingAverage || 0) * count,
            };
        },
        { count: 0, sum: 0 },
    );

    const averageRating = ratingTotals.count ? ratingTotals.sum / ratingTotals.count : 0;
    const rentedPostCount = posts.filter((post) => post.availabilityStatus === 'rented').length;
    const completedDepositCount = await modelDeposit.countDocuments({ landlordId, status: 'completed' });
    const rentedCount = Math.max(rentedPostCount, completedDepositCount);

    const [incomingMessages, outgoingMessages, complaintCount] = await Promise.all([
        modelMessager.find({ receiverId: landlordId }).select('senderId').lean(),
        modelMessager.find({ senderId: landlordId }).select('receiverId').lean(),
        postIds.length
            ? modelReport.countDocuments({ postId: { $in: postIds }, status: { $in: ['pending', 'resolved'] } })
            : 0,
    ]);

    const incomingUserIds = [...new Set(incomingMessages.map((message) => message.senderId?.toString()).filter(Boolean))];
    const repliedUserIds = new Set(outgoingMessages.map((message) => message.receiverId?.toString()).filter(Boolean));
    const repliedCount = incomingUserIds.filter((senderId) => repliedUserIds.has(senderId)).length;
    const responseRate = incomingUserIds.length ? repliedCount / incomingUserIds.length : null;
    const complaintRate = postCount ? complaintCount / postCount : 0;

    const reviewBoost = ratingTotals.count ? clamp((averageRating - 3) * 0.55, -1.1, 1.1) : 0;
    const rentedBoost = clamp(rentedCount, 0, 10) * 0.08;
    const responseBoost = responseRate === null ? 0 : clamp((responseRate - 0.5) * 0.8, -0.4, 0.4);
    const complaintPenalty = clamp(complaintRate * 1.5, 0, 1.2);
    const score = Number(clamp(3.2 + reviewBoost + rentedBoost + responseBoost - complaintPenalty, 1, 5).toFixed(1));

    return {
        score,
        maxScore: 5,
        rentedCount,
        averageRating: Number(averageRating.toFixed(1)),
        ratingCount: ratingTotals.count,
        responseRate: responseRate === null ? null : Math.round(responseRate * 100),
        complaintRate: Math.round(complaintRate * 100),
        complaintCount,
    };
};

const expireAcceptedReservations = async () => {
    const now = new Date();
    const expiredReservations = await modelReservation.find({
        status: 'accepted',
        expiresAt: { $lte: now },
    });

    for (const reservation of expiredReservations) {
        reservation.status = 'expired';
        reservation.ownerNote = reservation.ownerNote || 'Yeu cau giu cho da het han sau 24 gio';
        reservation.handledAt = now;
        await reservation.save();

        const activeReservation = await modelReservation.findOne({
            postId: reservation.postId,
            status: 'accepted',
            expiresAt: { $gt: now },
        });

        if (!activeReservation) {
            await modelPost.findOneAndUpdate(
                { _id: reservation.postId, availabilityStatus: 'unavailable' },
                { availabilityStatus: 'available' },
            );
        }
    }
};

class controllerPosts {
    async createPost(req, res) {
        const { id } = req.user;
        const {
            title,
            description,
            price,
            images,
            category,
            area,
            username,
            phone,
            options,
            location,
            endDate,
            typeNews,
            dateEnd,
            voucherCode,
            coordinates,
        } = req.body;
        if (
            !title ||
            !description ||
            !price ||
            !images ||
            !category ||
            !area ||
            !username ||
            !phone ||
            !options ||
            !location ||
            !endDate ||
            !typeNews ||
            !dateEnd
        ) {
            throw new BadRequestError('Vui lòng nhập đầy đủ thông tin');
        }

        const user = await modelUser.findById(id);
        if (!user) {
            throw new BadRequestError('User not found');
        }

        const postingFeeOriginal = await getPostingFeeByPlan(typeNews, dateEnd);

        if (!postingFeeOriginal) {
            throw new BadRequestError('Goi dang tin khong hop le');
        }

        const normalizedVoucherCode = normalizeVoucherCode(voucherCode);
        const voucherResult = normalizedVoucherCode
            ? await previewVoucher({
                  code: normalizedVoucherCode,
                  userId: id,
                  typeNews,
                  orderValue: postingFeeOriginal,
              })
            : { voucher: null, discountAmount: 0, finalAmount: postingFeeOriginal };

        const postingFee = voucherResult.finalAmount;

        if (user.balance < postingFee) {
            throw new BadRequestError('Số dư không đủ');
        }

        const chargedUser = await modelUser.findOneAndUpdate(
            { _id: id, balance: { $gte: postingFee } },
            { $inc: { balance: -postingFee } },
            { new: true },
        );

        if (!chargedUser) {
            throw new BadRequestError('Sá»‘ dÆ° khÃ´ng Ä‘á»§');
        }

        let post;
        try {
            post = await modelPost.create({
                title,
                description,
                price,
                location,
                coordinates: parseCoordinates(coordinates),
                images,
                category,
                area,
                username,
                phone,
                options,
                status: 'inactive',
                availabilityStatus: 'available',
                userId: id,
                endDate: endDate ? endDate : null,
                typeNews,
                postingFee,
                postingFeeOriginal,
                voucherCode: voucherResult.voucher?.code || '',
                voucherDiscount: voucherResult.discountAmount,
                voucherId: voucherResult.voucher?._id || null,
            });
            await markVoucherUsed({
                voucherId: voucherResult.voucher?._id,
                userId: id,
                postId: post._id,
                discountAmount: voucherResult.discountAmount,
            });
        } catch (error) {
            await modelUser.findByIdAndUpdate(id, { $inc: { balance: postingFee } });
            throw error;
        }

        return new Created({
            message: 'Post created successfully',
            metadata: post,
        }).send(res);
    }

    async getPosts(req, res) {
        await expireAcceptedReservations();
        await ensureDefaultFilterOptions();
        const { category, priceRange, areaRange, typeNews, province, location } = req.query;

        const filter = { status: 'active' };
        const locationTerms = getLocationSearchTerms(province, location);

        const [categoryOption, typeNewsOption, priceOption, areaOption] = await Promise.all([
            getActiveFilterOption('category', category),
            getActiveFilterOption('typeNews', typeNews),
            getActiveFilterOption('priceRange', priceRange),
            getActiveFilterOption('areaRange', areaRange),
        ]);

        if (categoryOption) filter.category = categoryOption.value;
        if (typeNewsOption) filter.typeNews = typeNewsOption.value;
        if (priceOption) filter.price = buildNumericCondition(priceOption);
        if (areaOption) filter.area = buildNumericCondition(areaOption);
        const dataPost = (await modelPost.find(filter).sort({ createdAt: -1 })).filter((post) => matchesLocation(post, locationTerms));

        const data = await Promise.all(
            dataPost.map(async (item) => {
                const user = await modelUser.findById(item.userId);
                return { ...item._doc, user: { _id: user._id, fullName: user.fullName, avatar: user.avatar } };
            }),
        );

        return new OK({
            message: 'Posts fetched successfully',
            metadata: data,
        }).send(res);
    }

    async getPostById(req, res) {
        await expireAcceptedReservations();
        const { id } = req.query;
        const data = await modelPost.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }, { new: true });
        if (!data) {
            throw new BadRequestError('Post not found');
        }
        const findUser = await modelUser.findById(data.userId);
        const findFavourite = await modelFavourite.find({ postId: id });

        const userFavourite = findFavourite.map((item) => item.userId);

        const [lengthPost, reputation] = await Promise.all([
            modelPost.countDocuments({ userId: data.userId }),
            getLandlordReputation(data.userId),
        ]);
        let statusUser = '';
        const socket = global.usersMap.get(findUser._id.toString());

        if (socket) {
            statusUser = 'Đang hoạt động';
        } else {
            statusUser = 'Đang offline';
        }
        const dataUser = {
            _id: findUser._id,
            username: findUser.fullName,
            avatar: findUser.avatar,
            createdAt: findUser.createdAt,
            phone: findUser.phone,
            lengthPost,
            status: statusUser,
            reputation,
        };

        return new OK({
            message: 'Post fetched successfully',
            metadata: {
                data,
                dataUser,
                userFavourite,
            },
        }).send(res);
    }

    async getPostByUserId(req, res) {
        const { id } = req.user;
        const data = await modelPost.find({ userId: id });
        return new OK({
            message: 'Post fetched successfully',
            metadata: data,
        }).send(res);
    }

    async getNewPost(req, res) {
        await expireAcceptedReservations();
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 3);

        const data = await modelPost
            .find({
                createdAt: { $gte: fiveDaysAgo },
                status: 'active',
            })
            .sort({ createdAt: -1 })
            .limit(8);

        return new OK({
            message: 'Post fetched successfully',
            metadata: data,
        }).send(res);
    }

    async getPostVip(req, res) {
        await expireAcceptedReservations();
        const data = await modelPost.find({ typeNews: 'vip', status: 'active' }).limit(5);
        return new OK({
            message: 'Post fetched successfully',
            metadata: data,
        }).send(res);
    }

    async deletePost(req, res) {
        const { id: userId } = req.user;
        const { id } = req.body;
        const findPost = await modelPost.findById(id);
        if (!findPost) {
            throw new BadRequestError('Post not found');
        }
        if (findPost.userId.toString() !== userId) {
            throw new BadRequestError('Bạn không có quyền xóa bài viết này');
        }
        const activeDeposit = await modelDeposit.exists({
            roomId: id,
            status: { $in: ['pending', 'holding', 'disputed'] },
        });
        if (activeDeposit) {
            throw new BadRequestError('Phòng đang có giao dịch cọc, không thể xóa bài viết');
        }
        const refundAmount = getRefundablePostingFee(findPost);

        await modelPost.findByIdAndDelete(id);
        await modelFavourite.deleteMany({ postId: id });
        if (refundAmount > 0) {
            await modelUser.findByIdAndUpdate(findPost.userId, { $inc: { balance: refundAmount } });
        }
        return new OK({
            message: 'Xoá bài viết thành công',
            metadata: { ...findPost._doc, refundAmount },
        }).send(res);
    }

    async getOwnerAnalytics(req, res) {
        const { id: ownerId } = req.user;
        const posts = await modelPost.find({ userId: ownerId }).sort({ createdAt: -1 }).lean();
        const postIds = posts.map((post) => post._id);

        const [favoriteStats, depositStats, incomingChatCount, chatSenders] = await Promise.all([
            modelFavourite.aggregate([
                { $match: { postId: { $in: postIds } } },
                { $group: { _id: '$postId', count: { $sum: 1 } } },
            ]),
            modelDeposit.aggregate([
                { $match: { roomId: { $in: postIds } } },
                { $group: { _id: '$roomId', count: { $sum: 1 } } },
            ]),
            modelMessager.countDocuments({ receiverId: ownerId }),
            modelMessager.distinct('senderId', { receiverId: ownerId }),
        ]);

        const favoriteMap = new Map(favoriteStats.map((item) => [item._id.toString(), item.count]));
        const depositMap = new Map(depositStats.map((item) => [item._id.toString(), item.count]));

        const postAnalytics = posts.map((post) => {
            const postId = post._id.toString();
            const viewCount = Number(post.viewCount || 0);
            const favouriteCount = favoriteMap.get(postId) || 0;
            const depositCount = depositMap.get(postId) || 0;
            const conversionRate = viewCount > 0 ? Number(((depositCount / viewCount) * 100).toFixed(2)) : 0;

            return {
                _id: post._id,
                title: post.title,
                status: post.status,
                typeNews: post.typeNews,
                price: post.price,
                viewCount,
                favouriteCount,
                depositCount,
                conversionRate,
            };
        });

        const totals = postAnalytics.reduce(
            (acc, item) => {
                acc.viewCount += item.viewCount;
                acc.favouriteCount += item.favouriteCount;
                acc.depositCount += item.depositCount;
                return acc;
            },
            { viewCount: 0, favouriteCount: 0, depositCount: 0 },
        );

        totals.chatCount = incomingChatCount;
        totals.chatUserCount = chatSenders.length;
        totals.conversionRate = totals.viewCount > 0 ? Number(((totals.depositCount / totals.viewCount) * 100).toFixed(2)) : 0;

        new OK({
            message: 'Lấy phân tích chủ trọ thành công',
            metadata: {
                totals,
                posts: postAnalytics,
            },
        }).send(res);
    }

    async getMapPosts(req, res) {
        await expireAcceptedReservations();
        await ensureDefaultFilterOptions();
        const { north, south, east, west, category, priceRange, areaRange, typeNews, province, location } = req.query;

        const bounds = {
            north: parseCoordinate(north),
            south: parseCoordinate(south),
            east: parseCoordinate(east),
            west: parseCoordinate(west),
        };

        if (Object.values(bounds).some((value) => value === null)) {
            throw new BadRequestError('Vùng bản đồ không hợp lệ');
        }

        const filter = {
            status: 'active',
            'coordinates.lat': { $gte: bounds.south, $lte: bounds.north },
            'coordinates.lng': { $gte: bounds.west, $lte: bounds.east },
        };
        const locationTerms = getLocationSearchTerms(province, location);

        const [categoryOption, typeNewsOption, priceOption, areaOption] = await Promise.all([
            getActiveFilterOption('category', category),
            getActiveFilterOption('typeNews', typeNews),
            getActiveFilterOption('priceRange', priceRange),
            getActiveFilterOption('areaRange', areaRange),
        ]);

        if (categoryOption) filter.category = categoryOption.value;
        if (typeNewsOption) filter.typeNews = typeNewsOption.value;
        if (priceOption) filter.price = buildNumericCondition(priceOption);
        if (areaOption) filter.area = buildNumericCondition(areaOption);

        const posts = (await modelPost.find(filter).sort({ createdAt: -1 }).limit(300)).filter((post) =>
            matchesLocation(post, locationTerms),
        );

        new OK({ message: 'Lấy bài đăng trên bản đồ thành công', metadata: posts }).send(res);
    }

    async updatePostAvailability(req, res) {
        const { id: userId } = req.user;
        const { id, availabilityStatus } = req.body;

        if (!id || !['available', 'unavailable'].includes(availabilityStatus)) {
            throw new BadRequestError('Trạng thái phòng không hợp lệ');
        }

        const findPost = await modelPost.findById(id);
        if (!findPost) {
            throw new BadRequestError('Post not found');
        }

        if (findPost.userId.toString() !== userId) {
            throw new BadRequestError('Bạn không có quyền cập nhật bài viết này');
        }

        const activeDeposit = await modelDeposit.exists({
            roomId: id,
            status: { $in: ['holding', 'disputed'] },
        });
        if (activeDeposit) {
            throw new BadRequestError('Phòng đang có giao dịch cọc, không thể cập nhật thủ công');
        }

        const updatedPost = await modelPost.findByIdAndUpdate(id, { availabilityStatus }, { new: true });
        return new OK({
            message: availabilityStatus === 'available' ? 'Đã cập nhật còn phòng' : 'Đã cập nhật hết phòng',
            metadata: updatedPost,
        }).send(res);
    }

    async getAllPosts(req, res) {
        const { status } = req.query;
        const filter = {};
        if (status) {
            filter.status = status;
        }
        const data = await modelPost.find(filter).sort({ createdAt: -1 });
        return new OK({
            message: 'Posts fetched successfully',
            metadata: data,
        }).send(res);
    }

    async approvePost(req, res) {
        const { id } = req.body;
        const findPost = await modelPost.findById(id);
        if (!findPost) {
            throw new BadRequestError('Post not found');
        }
        if (findPost.status !== 'inactive') {
            throw new BadRequestError('Chỉ có thể duyệt bài viết đang chờ duyệt');
        }
        const findUser = await modelUser.findById(findPost.userId);
        if (!findUser) {
            throw new BadRequestError('User not found');
        }
        const updatedPost = await modelPost.findByIdAndUpdate(id, { status: 'active' }, { new: true });
        await SendMailApprove(findUser.email, findPost);
        return new OK({
            message: 'Duyệt bài viết thành công',
            metadata: updatedPost,
        }).send(res);
    }

    async rejectPost(req, res) {
        const { id, reason } = req.body;
        const findPost = await modelPost.findById(id);
        if (!findPost) {
            throw new BadRequestError('Post not found');
        }
        if (findPost.status !== 'inactive') {
            throw new BadRequestError('Chỉ có thể từ chối bài viết đang chờ duyệt');
        }
        const findUser = await modelUser.findById(findPost.userId);
        if (!findUser) {
            throw new BadRequestError('User not found');
        }

        const refundAmount = getRefundablePostingFee(findPost);
        const updatedPost = await modelPost.findOneAndUpdate(
            { _id: id, status: 'inactive' },
            {
                status: 'rejected',
                postingFeeRefunded: true,
                postingFeeRefundedAt: new Date(),
            },
            { new: true },
        );

        if (!updatedPost) {
            throw new BadRequestError('Bài viết đã được xử lý trước đó');
        }

        if (refundAmount > 0) {
            await modelUser.findByIdAndUpdate(findPost.userId, { $inc: { balance: refundAmount } });
        }

        await SendMailReject(findUser.email, updatedPost, reason);
        return new OK({
            message: 'Từ chối bài viết thành công',
            metadata: { ...updatedPost._doc, refundAmount },
        }).send(res);
    }

    async postSuggest(req, res) {
        await expireAcceptedReservations();
        const { id } = req.user;
        const findUser = await modelUser.findById(id);
        const address = findUser.address;

        if (address) {
            // Lấy phần quận/huyện + tỉnh/thành
            const addressParts = address.split(',');
            const districtCity = addressParts.slice(-2).join(',').trim(); // "Hoàng Mai, Hà Nội"

            // Tìm bài viết có location chứa "Hoàng Mai, Hà Nội"
            const data = await modelPost.find({
                location: { $regex: new RegExp(districtCity, 'i') },
                status: 'active',
            });

            return new OK({
                message: 'Post fetched successfully',
                metadata: data.length ? data : await modelPost.find({ status: 'active' }).sort({ createdAt: -1 }).limit(8),
            }).send(res);
        } else {
            const data = await modelPost.find({ status: 'active' }).sort({ createdAt: -1 }).limit(8);
            return new OK({
                message: 'Post fetched successfully',
                metadata: data,
            }).send(res);
        }
    }
}

module.exports = new controllerPosts();
