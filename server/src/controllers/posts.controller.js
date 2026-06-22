const modelPost = require('../models/post.model');
const modelUser = require('../models/users.model');
const modelFavourite = require('../models/favourite.model');
const modelReservation = require('../models/reservation.model');
const modelDeposit = require('../models/deposit.model');
const modelContract = require('../models/contract.model');
const modelMessager = require('../models/Messager.model');
const modelReport = require('../models/report.model');

const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const SendMailApprove = require('../utils/SendMail/SendMailApprove');
const SendMailReject = require('../utils/SendMail/SendMailReject');
const { getPostingFeeByPlan, inferPostingFeeFromPost } = require('../utils/postingFee');
const { normalizeVoucherCode, previewVoucher, markVoucherUsed } = require('../utils/voucher');
const { buildNumericCondition, ensureDefaultFilterOptions, getActiveFilterOption } = require('../services/filterOption.service');
const { addPoints, refundPoints, calculateEarnPoints } = require('../services/reward.service');
const { createNotification, notifyAdmins } = require('../services/notification.service');

const getRefundablePostingFee = (post) => {
    if (!post || post.postingFeeRefunded) return 0;
    return inferPostingFeeFromPost(post);
};

const PUBLIC_POST_STATUSES = ['active', 'approved'];
const PENDING_POST_STATUSES = ['inactive', 'pending'];
const BLOCKING_DEPOSIT_STATUSES = ['pending', 'holding', 'completed'];
const ACTIVE_CONTRACT_STATUSES = ['active'];

const publicPostFilter = (extra = {}) => ({
    ...extra,
    status: extra.status || { $in: PUBLIC_POST_STATUSES },
    isDeleted: { $ne: true },
});

const isPublicPost = (post) => post && PUBLIC_POST_STATUSES.includes(post.status) && post.isDeleted !== true;

const canManagePost = async (userId, post) => {
    const user = await modelUser.findById(userId).select('isAdmin');
    return Boolean(user?.isAdmin || post.userId.toString() === userId);
};

const normalizeVietnameseText = (value = '') =>
    value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/Ä‘/g, 'd')
        .replace(/Ä/g, 'D')
        .toLowerCase();

const locationAliases = {
    'can tho': ['Cáº§n ThÆ¡', 'Can Tho'],
    'ha noi': ['HÃ  Ná»™i', 'Ha Noi'],
    'ho chi minh': ['Há»“ ChÃ­ Minh', 'Ho Chi Minh', 'TP.HCM', 'TP HCM', 'SÃ i GÃ²n', 'Sai Gon'],
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
    const safeCoordinates = coordinates || {};
    const lat = parseCoordinate(safeCoordinates.lat);
    const lng = parseCoordinate(safeCoordinates.lng);
    return lat !== null && lng !== null ? { lat, lng } : { lat: null, lng: null };
};

const getDistanceKm = (fromLat, fromLng, toLat, toLng) => {
    const toRadians = (value) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRadians(toLat - fromLat);
    const dLng = toRadians(toLng - fromLng);
    const lat1 = toRadians(fromLat);
    const lat2 = toRadians(toLat);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const buildRadiusBounds = (lat, lng, radiusKm) => {
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180) || 1);
    return {
        north: lat + latDelta,
        south: lat - latDelta,
        east: lng + lngDelta,
        west: lng - lngDelta,
    };
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getLandlordReputation = async (landlordId) => {
    const posts = await modelPost
        .find({ userId: landlordId, isDeleted: { $ne: true }, status: { $ne: 'deleted' } })
        .select('_id availabilityStatus ratingAverage ratingCount')
        .lean();
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
            throw new BadRequestError('Vui lÃ²ng nháº­p Ä‘áº§y Ä‘á»§ thÃ´ng tin');
        }

        const user = await modelUser.findById(id);
        if (!user) {
            throw new BadRequestError('User not found');
        }

        const postingFeeOriginal = await getPostingFeeByPlan(typeNews, dateEnd);

        if (!postingFeeOriginal) {
            throw new BadRequestError('Goi dang tin khong hop le');
        }

        const recentPost = await modelPost.findOne({
            userId: id,
            createdAt: { $gte: new Date(Date.now() - 30 * 1000) },
            status: { $ne: 'deleted' },
        }).select('_id');

        if (recentPost) {
            throw new BadRequestError('Vui lÃ²ng chá» má»™t chÃºt trÆ°á»›c khi Ä‘Äƒng bÃ i tiáº¿p theo');
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
            throw new BadRequestError('Sá»‘ dÆ° khÃ´ng Ä‘á»§');
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
                status: 'pending',
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
            await addPoints({
                userId: id,
                points: calculateEarnPoints(postingFee),
                source: typeNews === 'vip' ? 'vip_upgrade' : 'listing_payment',
                referenceId: post._id,
                description: `Tich diem thanh toan dang tin: ${post.title}`,
            });
            await notifyAdmins(
                'Có tin đăng chờ duyệt',
                `Tin "${post.title}" vừa được gửi và đang chờ duyệt`,
                'post',
                '/admin?type=posts',
                { postId: post._id, ownerId: id },
            );
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

        const filter = publicPostFilter();
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
        const data = await modelPost.findOneAndUpdate(
            { _id: id, status: { $in: PUBLIC_POST_STATUSES }, isDeleted: { $ne: true } },
            { $inc: { viewCount: 1 } },
            { new: true },
        );
        if (!data || !isPublicPost(data)) {
            throw new BadRequestError('Post not found');
        }
        const findUser = await modelUser.findById(data.userId);
        const findFavourite = await modelFavourite.find({ postId: id });

        const userFavourite = findFavourite.map((item) => item.userId);

        const [lengthPost, reputation] = await Promise.all([
            modelPost.countDocuments({ userId: data.userId, isDeleted: { $ne: true }, status: { $ne: 'deleted' } }),
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
        const data = await modelPost.find({ userId: id }).populate('deletedBy', 'fullName email').sort({ createdAt: -1 });
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
            .find(publicPostFilter({
                createdAt: { $gte: fiveDaysAgo },
            }))
            .sort({ createdAt: -1 })
            .limit(8);

        return new OK({
            message: 'Post fetched successfully',
            metadata: data,
        }).send(res);
    }

    async getPostVip(req, res) {
        await expireAcceptedReservations();
        const data = await modelPost.find(publicPostFilter({ typeNews: 'vip' })).limit(5);
        return new OK({
            message: 'Post fetched successfully',
            metadata: data,
        }).send(res);
    }

    async softDeletePost(req, res) {
        const { id: userId } = req.user;
        const id = req.params.id || req.body.id;
        const findPost = await modelPost.findById(id);
        if (!findPost) {
            throw new BadRequestError('Post not found');
        }
        if (findPost.isDeleted || findPost.status === 'deleted') {
            throw new BadRequestError('Bai viet da bi xoa truoc do');
        }
        if (!(await canManagePost(userId, findPost))) {
            throw new BadRequestError('Báº¡n khÃ´ng cÃ³ quyá»n xÃ³a bÃ i viáº¿t nÃ y');
        }
        const activeDeposit = await modelDeposit.exists({
            roomId: id,
            status: { $in: BLOCKING_DEPOSIT_STATUSES },
        });
        if (activeDeposit) {
            throw new BadRequestError('Bai viet dang co giao dich dat coc dang xu ly/da hoan tat, khong the xoa');
        }
        const activeContract = await modelContract.exists({
            roomId: id,
            status: { $in: ACTIVE_CONTRACT_STATUSES },
            endDate: { $gte: new Date() },
        });
        if (activeContract) {
            throw new BadRequestError('Bai viet dang co hop dong con hieu luc, khong the xoa');
        }

        const updatedPost = await modelPost.findByIdAndUpdate(
            id,
            {
                status: 'deleted',
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: userId,
            },
            { new: true },
        ).populate('deletedBy', 'fullName email');

        return new OK({
            message: 'Xoa bai viet thanh cong',
            metadata: updatedPost,
        }).send(res);
    }

    async deletePost(req, res) {
        return this.softDeletePost(req, res);
    }

    async restorePost(req, res) {
        const { id: userId } = req.user;
        const id = req.params.id || req.body.id;
        const findPost = await modelPost.findById(id);
        if (!findPost) {
            throw new BadRequestError('Post not found');
        }
        if (!(await canManagePost(userId, findPost))) {
            throw new BadRequestError('Ban khong co quyen khoi phuc bai viet nay');
        }
        if (!findPost.isDeleted && findPost.status !== 'deleted') {
            throw new BadRequestError('Chi co the khoi phuc bai viet da bi xoa');
        }

        const restoredStatus = findPost.availabilityStatus === 'rented' ? 'rented' : 'pending';
        const updatedPost = await modelPost.findByIdAndUpdate(
            id,
            {
                status: restoredStatus,
                isDeleted: false,
                deletedAt: null,
                deletedBy: null,
            },
            { new: true },
        ).populate('deletedBy', 'fullName email');

        return new OK({
            message: 'Khoi phuc bai viet thanh cong',
            metadata: updatedPost,
        }).send(res);
    }

    async getOwnerAnalytics(req, res) {
        const { id: ownerId } = req.user;
        const posts = await modelPost
            .find({ userId: ownerId, isDeleted: { $ne: true }, status: { $ne: 'deleted' } })
            .sort({ createdAt: -1 })
            .lean();
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
            message: 'Láº¥y phÃ¢n tÃ­ch chá»§ trá» thÃ nh cÃ´ng',
            metadata: {
                totals,
                posts: postAnalytics,
            },
        }).send(res);
    }

    async getMapPosts(req, res) {
        await expireAcceptedReservations();
        await ensureDefaultFilterOptions();
        const { north, south, east, west, lat, lng, radiusKm, category, priceRange, areaRange, typeNews, province, location } = req.query;

        const centerLat = parseCoordinate(lat);
        const centerLng = parseCoordinate(lng);
        const radius = parseCoordinate(radiusKm);
        const hasRadiusSearch = centerLat !== null && centerLng !== null && radius !== null;
        const radiusLimit = hasRadiusSearch ? Math.max(0.1, Math.min(radius, 50)) : null;

        const bounds = hasRadiusSearch
            ? buildRadiusBounds(centerLat, centerLng, radiusLimit)
            : {
                  north: parseCoordinate(north),
                  south: parseCoordinate(south),
                  east: parseCoordinate(east),
                  west: parseCoordinate(west),
              };

        if (Object.values(bounds).some((value) => value === null)) {
            throw new BadRequestError('Vùng bản đồ không hợp lệ');
        }

        const filter = {
            status: { $in: PUBLIC_POST_STATUSES },
            isDeleted: { $ne: true },
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

        const posts = (await modelPost.find(filter).sort({ createdAt: -1 }).limit(300))
            .filter((post) => matchesLocation(post, locationTerms))
            .map((post) => {
                if (!hasRadiusSearch) return post;
                const postLat = Number(post.coordinates?.lat);
                const postLng = Number(post.coordinates?.lng);
                const distanceKm = getDistanceKm(centerLat, centerLng, postLat, postLng);
                return { post, distanceKm };
            })
            .filter((item) => {
                if (!hasRadiusSearch) return true;
                return Number.isFinite(item.distanceKm) && item.distanceKm <= radiusLimit;
            })
            .sort((a, b) => {
                if (!hasRadiusSearch) return 0;
                return a.distanceKm - b.distanceKm;
            })
            .map((item) => {
                if (!hasRadiusSearch) return item;
                return { ...item.post._doc, distanceKm: Number(item.distanceKm.toFixed(2)) };
            });

        new OK({ message: 'Lấy bài đăng trên bản đồ thành công', metadata: posts }).send(res);
    }
    async updatePostAvailability(req, res) {
        const { id: userId } = req.user;
        const { id, availabilityStatus } = req.body;

        if (!id || !['available', 'unavailable'].includes(availabilityStatus)) {
            throw new BadRequestError('Tráº¡ng thÃ¡i phÃ²ng khÃ´ng há»£p lá»‡');
        }

        const findPost = await modelPost.findById(id);
        if (!findPost) {
            throw new BadRequestError('Post not found');
        }
        if (findPost.isDeleted || findPost.status === 'deleted') {
            throw new BadRequestError('Bai viet da bi xoa, khong the cap nhat');
        }

        if (findPost.userId.toString() !== userId) {
            throw new BadRequestError('Báº¡n khÃ´ng cÃ³ quyá»n cáº­p nháº­t bÃ i viáº¿t nÃ y');
        }

        const activeDeposit = await modelDeposit.exists({
            roomId: id,
            status: { $in: ['holding', 'disputed'] },
        });
        if (activeDeposit) {
            throw new BadRequestError('PhÃ²ng Ä‘ang cÃ³ giao dá»‹ch cá»c, khÃ´ng thá»ƒ cáº­p nháº­t thá»§ cÃ´ng');
        }

        const updatedPost = await modelPost.findByIdAndUpdate(id, { availabilityStatus }, { new: true });
        return new OK({
            message: availabilityStatus === 'available' ? 'ÄÃ£ cáº­p nháº­t cÃ²n phÃ²ng' : 'ÄÃ£ cáº­p nháº­t háº¿t phÃ²ng',
            metadata: updatedPost,
        }).send(res);
    }

    async getAllPosts(req, res) {
        const { status } = req.query;
        const filter = {};
        if (status) {
            if (status === 'deleted') {
                filter.$or = [{ status: 'deleted' }, { isDeleted: true }];
            } else {
                filter.status = status;
            }
        }
        const data = await modelPost.find(filter).populate('deletedBy', 'fullName email').sort({ createdAt: -1 });
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
        if (findPost.isDeleted || findPost.status === 'deleted') {
            throw new BadRequestError('Khong the duyet bai viet da bi xoa');
        }
        if (!PENDING_POST_STATUSES.includes(findPost.status)) {
            throw new BadRequestError('Chá»‰ cÃ³ thá»ƒ duyá»‡t bÃ i viáº¿t Ä‘ang chá» duyá»‡t');
        }
        const findUser = await modelUser.findById(findPost.userId);
        if (!findUser) {
            throw new BadRequestError('User not found');
        }
        const updatedPost = await modelPost.findByIdAndUpdate(id, { status: 'approved' }, { new: true });
        await SendMailApprove(findUser.email, findPost);
        await createNotification(
            findPost.userId,
            'Tin đăng đã được duyệt',
            `Tin "${findPost.title}" đã được duyệt và hiển thị`,
            'post',
            `/chi-tiet-tin-dang/${findPost._id}`,
            { postId: findPost._id },
        );
        return new OK({
            message: 'Duyá»‡t bÃ i viáº¿t thÃ nh cÃ´ng',
            metadata: updatedPost,
        }).send(res);
    }

    async rejectPost(req, res) {
        const { id, reason } = req.body;
        const findPost = await modelPost.findById(id);
        if (!findPost) {
            throw new BadRequestError('Post not found');
        }
        if (findPost.isDeleted || findPost.status === 'deleted') {
            throw new BadRequestError('Khong the tu choi bai viet da bi xoa');
        }
        if (!PENDING_POST_STATUSES.includes(findPost.status)) {
            throw new BadRequestError('Chá»‰ cÃ³ thá»ƒ tá»« chá»‘i bÃ i viáº¿t Ä‘ang chá» duyá»‡t');
        }
        const findUser = await modelUser.findById(findPost.userId);
        if (!findUser) {
            throw new BadRequestError('User not found');
        }

        const refundAmount = getRefundablePostingFee(findPost);
        const updatedPost = await modelPost.findOneAndUpdate(
            { _id: id, status: { $in: PENDING_POST_STATUSES }, isDeleted: { $ne: true } },
            {
                status: 'rejected',
                postingFeeRefunded: true,
                postingFeeRefundedAt: new Date(),
            },
            { new: true },
        );

        if (!updatedPost) {
            throw new BadRequestError('BÃ i viáº¿t Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½ trÆ°á»›c Ä‘Ã³');
        }

        if (refundAmount > 0) {
            await modelUser.findByIdAndUpdate(findPost.userId, { $inc: { balance: refundAmount } });
            await refundPoints({
                userId: findPost.userId,
                source: findPost.typeNews === 'vip' ? 'vip_upgrade' : 'listing_payment',
                referenceId: findPost._id,
                description: `Thu hoi diem do bai dang bi tu choi: ${findPost.title}`,
            });
        }

        await SendMailReject(findUser.email, updatedPost, reason);
        await createNotification(
            findPost.userId,
            'Tin đăng bị từ chối',
            `Tin "${findPost.title}" đã bị từ chối${reason ? `: ${reason}` : ''}`,
            'post',
            '/trang-ca-nhan?tab=posts',
            { postId: findPost._id, reason },
        );
        return new OK({
            message: 'Tá»« chá»‘i bÃ i viáº¿t thÃ nh cÃ´ng',
            metadata: { ...updatedPost._doc, refundAmount },
        }).send(res);
    }

    async postSuggest(req, res) {
        await expireAcceptedReservations();
        const { id } = req.user;
        const findUser = await modelUser.findById(id);
        const address = findUser.address;

        if (address) {
            // Láº¥y pháº§n quáº­n/huyá»‡n + tá»‰nh/thÃ nh
            const addressParts = address.split(',');
            const districtCity = addressParts.slice(-2).join(',').trim(); // "HoÃ ng Mai, HÃ  Ná»™i"

            // TÃ¬m bÃ i viáº¿t cÃ³ location chá»©a "HoÃ ng Mai, HÃ  Ná»™i"
            const data = await modelPost.find({
                location: { $regex: new RegExp(districtCity, 'i') },
                status: { $in: PUBLIC_POST_STATUSES },
                isDeleted: { $ne: true },
            });

            return new OK({
                message: 'Post fetched successfully',
                metadata: data.length ? data : await modelPost.find(publicPostFilter()).sort({ createdAt: -1 }).limit(8),
            }).send(res);
        } else {
            const data = await modelPost.find(publicPostFilter()).sort({ createdAt: -1 }).limit(8);
            return new OK({
                message: 'Post fetched successfully',
                metadata: data,
            }).send(res);
        }
    }
}

module.exports = new controllerPosts();
