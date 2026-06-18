const modelUser = require('../models/users.model');
const modelPost = require('../models/post.model');
const modelPointTransaction = require('../models/pointTransaction.model');
const modelRewardVoucher = require('../models/rewardVoucher.model');
const modelVoucher = require('../models/voucher.model');
const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const { getRankProgress, adjustPoints, redeemVoucher, addPoints, calculateEarnPoints } = require('../services/reward.service');

const DEFAULT_REWARD_VOUCHERS = [
    {
        name: 'Giảm 10% phí đăng tin',
        codePrefix: 'REWARD10',
        pointsRequired: 50,
        discountType: 'percentage',
        discountValue: 10,
        maxDiscount: 50000,
        minOrderValue: 0,
        durationDays: 30,
        quantity: 0,
        applicableTo: ['listing_package', 'vip_upgrade'],
    },
    {
        name: 'Giảm 50.000 VNĐ phí VIP',
        codePrefix: 'VIP50K',
        pointsRequired: 120,
        discountType: 'fixed',
        discountValue: 50000,
        maxDiscount: 50000,
        minOrderValue: 100000,
        durationDays: 30,
        quantity: 0,
        applicableTo: ['vip_upgrade'],
    },
    {
        name: 'Giảm 30.000 VNĐ phí đăng tin',
        codePrefix: 'POST30K',
        pointsRequired: 80,
        discountType: 'fixed',
        discountValue: 30000,
        maxDiscount: 30000,
        minOrderValue: 50000,
        durationDays: 30,
        quantity: 0,
        applicableTo: ['listing_package'],
    },
];

const ensureDefaultRewardVouchers = async () => {
    const count = await modelRewardVoucher.countDocuments();
    if (count) return;
    await modelRewardVoucher.insertMany(DEFAULT_REWARD_VOUCHERS);
};

const buildRewardVoucherPayload = (body = {}) => {
    const payload = {
        name: body.name,
        codePrefix: body.codePrefix,
        pointsRequired: Number(body.pointsRequired || 0),
        discountType: body.discountType,
        discountValue: Number(body.discountValue || 0),
        maxDiscount: Number(body.maxDiscount || 0),
        minOrderValue: Number(body.minOrderValue || 0),
        durationDays: Number(body.durationDays || 30),
        quantity: Number(body.quantity || 0),
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        applicableTo: Array.isArray(body.applicableTo) ? body.applicableTo : [],
    };

    if (!payload.name || !payload.codePrefix) throw new BadRequestError('Vui lòng nhập tên và tiền tố voucher');
    if (payload.pointsRequired <= 0) throw new BadRequestError('Số điểm đổi voucher không hợp lệ');
    if (!['percentage', 'fixed'].includes(payload.discountType)) throw new BadRequestError('Loại giảm giá không hợp lệ');
    if (payload.discountValue <= 0) throw new BadRequestError('Giá trị giảm giá không hợp lệ');
    if (payload.durationDays <= 0) throw new BadRequestError('Thời hạn voucher không hợp lệ');
    if (!payload.applicableTo.length) payload.applicableTo = ['listing_package', 'vip_upgrade'];

    payload.codePrefix = payload.codePrefix.toString().trim().toUpperCase();
    return payload;
};

class RewardController {
    async getMyReward(req, res) {
        const user = await modelUser.findById(req.user.id).select('rewardPoints memberRank');
        if (!user) throw new BadRequestError('Không tìm thấy người dùng');

        return new OK({
            message: 'Lấy thông tin điểm thưởng thành công',
            metadata: {
                rewardPoints: user.rewardPoints || 0,
                memberRank: user.memberRank || 'bronze',
                progress: getRankProgress(user.rewardPoints || 0),
            },
        }).send(res);
    }

    async getHistory(req, res) {
        const history = await modelPointTransaction.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
        return new OK({
            message: 'Lấy lịch sử điểm thưởng thành công',
            metadata: history,
        }).send(res);
    }

    async getRewardVouchers(req, res) {
        await ensureDefaultRewardVouchers();
        const user = await modelUser.findById(req.user.id).select('rewardPoints').lean();
        const vouchers = await modelRewardVoucher.find({ isActive: true }).sort({ pointsRequired: 1, createdAt: -1 }).lean();
        const points = Number(user?.rewardPoints || 0);

        return new OK({
            message: 'Lấy kho voucher đổi điểm thành công',
            metadata: vouchers.map((voucher) => ({
                ...voucher,
                remainingQuantity: voucher.quantity > 0 ? Math.max(0, voucher.quantity - voucher.usedCount) : null,
                canRedeem: points >= voucher.pointsRequired && (voucher.quantity === 0 || voucher.usedCount < voucher.quantity),
            })),
        }).send(res);
    }

    async redeem(req, res) {
        const voucher = await redeemVoucher({ userId: req.user.id, rewardVoucherId: req.params.voucherId });
        return new Created({
            message: 'Đổi voucher thành công',
            metadata: voucher,
        }).send(res);
    }

    async getMyVouchers(req, res) {
        const vouchers = await modelVoucher.find({ userId: req.user.id, source: 'reward' }).sort({ createdAt: -1 }).lean();
        return new OK({
            message: 'Lấy voucher của tôi thành công',
            metadata: vouchers,
        }).send(res);
    }

    async getRewardUsers(req, res) {
        const users = await modelUser
            .find()
            .select('fullName email phone rewardPoints memberRank isActive accountStatus')
            .sort({ rewardPoints: -1, createdAt: -1 })
            .lean();
        return new OK({
            message: 'Lấy danh sách điểm người dùng thành công',
            metadata: users,
        }).send(res);
    }

    async getTransactions(req, res) {
        const transactions = await modelPointTransaction
            .find()
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();
        return new OK({
            message: 'Lấy lịch sử điểm thưởng thành công',
            metadata: transactions,
        }).send(res);
    }

    async adjustUserPoints(req, res) {
        const points = Number(req.body.points || 0);
        const reason = req.body.reason || req.body.description || '';
        const transaction = await adjustPoints({
            userId: req.params.id,
            points,
            description: reason || 'Admin điều chỉnh điểm',
        });
        const user = await modelUser.findById(req.params.id).select('fullName email rewardPoints memberRank').lean();

        return new OK({
            message: 'Điều chỉnh điểm thành công',
            metadata: { user, transaction },
        }).send(res);
    }

    async getAdminRewardVouchers(req, res) {
        await ensureDefaultRewardVouchers();
        const vouchers = await modelRewardVoucher.find().sort({ createdAt: -1 }).lean();
        return new OK({
            message: 'Lấy danh sách voucher đổi điểm thành công',
            metadata: vouchers,
        }).send(res);
    }

    async createRewardVoucher(req, res) {
        const voucher = await modelRewardVoucher.create(buildRewardVoucherPayload(req.body));
        return new Created({
            message: 'Tạo voucher đổi điểm thành công',
            metadata: voucher,
        }).send(res);
    }

    async updateRewardVoucher(req, res) {
        const payload = buildRewardVoucherPayload(req.body);
        const voucher = await modelRewardVoucher.findByIdAndUpdate(req.params.id, payload, { new: true });
        if (!voucher) throw new BadRequestError('Không tìm thấy voucher đổi điểm');

        return new OK({
            message: 'Cập nhật voucher đổi điểm thành công',
            metadata: voucher,
        }).send(res);
    }

    async deleteRewardVoucher(req, res) {
        const voucher = await modelRewardVoucher.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!voucher) throw new BadRequestError('Không tìm thấy voucher đổi điểm');

        return new OK({
            message: 'Đã tắt voucher đổi điểm',
            metadata: voucher,
        }).send(res);
    }

    async backfillListingPoints(req, res) {
        const posts = await modelPost
            .find({
                postingFee: { $gt: 0 },
                postingFeeRefunded: { $ne: true },
                isDeleted: { $ne: true },
                status: { $in: ['approved', 'active'] },
            })
            .select('_id userId title typeNews postingFee')
            .lean();

        let scanned = 0;
        let created = 0;
        let skipped = 0;
        let pointsAdded = 0;

        for (const post of posts) {
            scanned += 1;
            const points = calculateEarnPoints(post.postingFee);
            if (points <= 0) {
                skipped += 1;
                continue;
            }

            const source = post.typeNews === 'vip' ? 'vip_upgrade' : 'listing_payment';
            const existed = await modelPointTransaction.exists({
                userId: post.userId,
                source,
                referenceId: post._id.toString(),
                type: 'earn',
            });
            if (existed) {
                skipped += 1;
                continue;
            }

            await addPoints({
                userId: post.userId,
                points,
                source,
                referenceId: post._id,
                description: `Truy thu điểm cho bài đăng cũ: ${post.title}`,
            });

            created += 1;
            pointsAdded += points;
        }

        return new OK({
            message: 'Quy đổi điểm cho bài đăng cũ hoàn tất',
            metadata: {
                scanned,
                created,
                skipped,
                pointsAdded,
            },
        }).send(res);
    }
}

module.exports = new RewardController();
