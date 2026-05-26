const modelPost = require('../models/post.model');
const modelUser = require('../models/users.model');
const modelFavourite = require('../models/favourite.model');
const modelReservation = require('../models/reservation.model');

const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const SendMailApprove = require('../utils/SendMail/SendMailApprove');
const SendMailReject = require('../utils/SendMail/SendMailReject');
const { getPostingFeeByPlan, inferPostingFeeFromPost } = require('../utils/postingFee');

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
            await modelPost.findByIdAndUpdate(reservation.postId, { availabilityStatus: 'available' });
        }
    }
};

const pricePostVip = [
    { date: 3, price: 50000 },
    { date: 7, price: 315000 },
    { date: 30, price: 1200000 },
];

const pricePostNormal = [
    { date: 3, price: 10000 },
    { date: 7, price: 60000 },
    { date: 30, price: 1000000 },
];

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

        const postingFee = getPostingFeeByPlan(typeNews, dateEnd);

        if (!postingFee) {
            throw new BadRequestError('Goi dang tin khong hop le');
        }

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
        const { category, priceRange, areaRange, typeNews } = req.query;

        const filter = { status: 'active' };

        if (category) {
            filter.category = category;
        }

        if (typeNews) {
            filter.typeNews = typeNews;
        }

        if (priceRange) {
            const priceConditions = {
                'duoi-1-trieu': { $lt: 1000000 },
                'tu-1-2-trieu': { $gte: 1000000, $lt: 2000000 },
                'tu-2-3-trieu': { $gte: 2000000, $lt: 3000000 },
                'tu-3-5-trieu': { $gte: 3000000, $lt: 5000000 },
                'tu-5-7-trieu': { $gte: 5000000, $lt: 7000000 },
                'tu-7-10-trieu': { $gte: 7000000, $lt: 10000000 },
                'tu-10-15-trieu': { $gte: 10000000, $lt: 15000000 },
                'tren-15-trieu': { $gte: 15000000 },
            };
            if (priceConditions[priceRange]) {
                filter.price = priceConditions[priceRange];
            }
        }

        // Implement area filtering now that 'area' field is Number type
        if (areaRange) {
            const areaConditions = {
                'duoi-20': { $lt: 20 },
                'tu-20-30': { $gte: 20, $lt: 30 },
                'tu-30-50': { $gte: 30, $lt: 50 },
                'tu-50-70': { $gte: 50, $lt: 70 },
                'tu-70-90': { $gte: 70, $lt: 90 },
                'tren-90': { $gte: 90 },
            };
            if (areaConditions[areaRange]) {
                filter.area = areaConditions[areaRange];
            }
        }

        const dataPost = await modelPost.find(filter).sort({ createdAt: -1 });

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
        const data = await modelPost.findById(id);
        const findUser = await modelUser.findById(data.userId);
        const findFavourite = await modelFavourite.find({ postId: id });

        const userFavourite = findFavourite.map((item) => item.userId);

        const lengthPost = await modelPost.countDocuments({ userId: data.userId });
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
        const { id } = req.body;
        const findPost = await modelPost.findById(id);
        if (!findPost) {
            throw new BadRequestError('Post not found');
        }
        await modelPost.findByIdAndDelete(id);
        await modelFavourite.deleteMany({ postId: id });
        await modelUser.findByIdAndUpdate(findPost.userId, { $inc: { balance: inferPostingFeeFromPost(findPost) } });
        return new OK({
            message: 'Xoá bài viết thành công',
            metadata: findPost,
        }).send(res);
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
        const findUser = await modelUser.findById(findPost.userId);
        await modelPost.findByIdAndUpdate(id, { status: 'active' });
        await SendMailApprove(findUser.email, findPost);
        return new OK({
            message: 'Duyệt bài viết thành công',
            metadata: findPost,
        }).send(res);
    }

    async rejectPost(req, res) {
        const { id, reason } = req.body;
        const findPost = await modelPost.findById(id);
        if (!findPost) {
            throw new BadRequestError('Post not found');
        }
        const findUser = await modelUser.findById(findPost.userId);
        await modelPost.findByIdAndUpdate(id, { status: 'rejected' });
        await SendMailReject(findUser.email, findPost, reason);
        return new OK({
            message: 'Từ chối bài viết thành công',
            metadata: findPost,
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
