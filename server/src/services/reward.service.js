const crypto = require('crypto');
const modelUser = require('../models/users.model');
const modelPointTransaction = require('../models/pointTransaction.model');
const modelRewardVoucher = require('../models/rewardVoucher.model');
const modelVoucher = require('../models/voucher.model');
const { BadRequestError } = require('../core/error.response');

const POINTS_PER_VND = 10000;

const getMemberRank = (points = 0) => {
    if (points >= 700) return 'diamond';
    if (points >= 300) return 'gold';
    if (points >= 100) return 'silver';
    return 'bronze';
};

const getRankProgress = (points = 0) => {
    const ranks = [
        { rank: 'bronze', min: 0, next: 100 },
        { rank: 'silver', min: 100, next: 300 },
        { rank: 'gold', min: 300, next: 700 },
        { rank: 'diamond', min: 700, next: null },
    ];
    const current = ranks.find((item) => points >= item.min && (item.next === null || points < item.next)) || ranks[0];

    if (!current.next) {
        return {
            currentRank: current.rank,
            nextRank: null,
            currentPoints: points,
            pointsToNextRank: 0,
            progressPercent: 100,
        };
    }

    const progressPercent = Math.floor(((points - current.min) / (current.next - current.min)) * 100);
    return {
        currentRank: current.rank,
        nextRank: getMemberRank(current.next),
        currentPoints: points,
        pointsToNextRank: current.next - points,
        progressPercent: Math.max(0, Math.min(100, progressPercent)),
    };
};

const calculateEarnPoints = (amount = 0) => Math.max(0, Math.floor(Number(amount || 0) / POINTS_PER_VND));

const updateMemberRank = async (userId) => {
    const user = await modelUser.findById(userId);
    if (!user) throw new BadRequestError('Không tìm thấy người dùng');

    const nextRank = getMemberRank(user.rewardPoints || 0);
    if (user.memberRank !== nextRank) {
        user.memberRank = nextRank;
        await user.save();
    }
    return user;
};

const addPoints = async ({ userId, points, source, referenceId = '', description = '' }) => {
    const parsedPoints = Math.floor(Number(points || 0));
    if (!userId || parsedPoints <= 0) return null;

    const existed = referenceId
        ? await modelPointTransaction.findOne({ userId, source, referenceId: referenceId.toString(), type: 'earn' })
        : null;
    if (existed) return existed;

    const transaction = await modelPointTransaction.create({
        userId,
        type: 'earn',
        points: parsedPoints,
        source,
        referenceId: referenceId ? referenceId.toString() : '',
        description,
    });

    await modelUser.findByIdAndUpdate(userId, { $inc: { rewardPoints: parsedPoints } });
    await updateMemberRank(userId);
    return transaction;
};

const refundPoints = async ({ userId, source, referenceId = '', description = '' }) => {
    if (!userId || !referenceId) return null;

    const earnTransaction = await modelPointTransaction.findOne({
        userId,
        source,
        referenceId: referenceId.toString(),
        type: 'earn',
    });
    if (!earnTransaction) return null;

    const existedRefund = await modelPointTransaction.findOne({
        userId,
        source: 'refund',
        referenceId: referenceId.toString(),
        type: 'refund',
    });
    if (existedRefund) return existedRefund;

    const pointsToDeduct = Math.abs(Number(earnTransaction.points || 0));
    if (pointsToDeduct <= 0) return null;

    const user = await modelUser.findById(userId);
    if (!user) return null;

    const nextPoints = Math.max(0, Number(user.rewardPoints || 0) - pointsToDeduct);
    user.rewardPoints = nextPoints;
    user.memberRank = getMemberRank(nextPoints);
    await user.save();

    return modelPointTransaction.create({
        userId,
        type: 'refund',
        points: -pointsToDeduct,
        source: 'refund',
        referenceId: referenceId.toString(),
        description: description || `Thu hồi điểm từ giao dịch ${source}`,
    });
};

const adjustPoints = async ({ userId, points, description = '' }) => {
    const parsedPoints = Math.floor(Number(points || 0));
    if (!userId || parsedPoints === 0) throw new BadRequestError('Số điểm điều chỉnh không hợp lệ');

    const user = await modelUser.findById(userId);
    if (!user) throw new BadRequestError('Không tìm thấy người dùng');

    const nextPoints = Math.max(0, Number(user.rewardPoints || 0) + parsedPoints);
    user.rewardPoints = nextPoints;
    user.memberRank = getMemberRank(nextPoints);
    await user.save();

    return modelPointTransaction.create({
        userId,
        type: 'adjust',
        points: parsedPoints,
        source: 'admin_adjust',
        referenceId: crypto.randomUUID(),
        description,
    });
};

const mapRewardDiscountType = (type) => (type === 'percentage' ? 'percent' : 'fixed');

const mapApplicableTypes = (applicableTo = []) => {
    const types = new Set();
    if (applicableTo.includes('listing_package')) types.add('normal');
    if (applicableTo.includes('vip_upgrade')) types.add('vip');
    if (applicableTo.includes('boost_listing')) {
        types.add('normal');
        types.add('vip');
    }
    return types.size ? [...types] : ['normal', 'vip'];
};

const redeemVoucher = async ({ userId, rewardVoucherId }) => {
    const rewardVoucher = await modelRewardVoucher.findById(rewardVoucherId);
    if (!rewardVoucher || !rewardVoucher.isActive) {
        throw new BadRequestError('Voucher đổi điểm không tồn tại hoặc đã tắt');
    }
    if (rewardVoucher.quantity > 0 && rewardVoucher.usedCount >= rewardVoucher.quantity) {
        throw new BadRequestError('Voucher đổi điểm đã hết số lượng');
    }

    const user = await modelUser.findById(userId);
    if (!user) throw new BadRequestError('Không tìm thấy người dùng');
    if (Number(user.rewardPoints || 0) < rewardVoucher.pointsRequired) {
        throw new BadRequestError('Bạn không đủ điểm để đổi voucher này');
    }

    const code = `${rewardVoucher.codePrefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date();
    const endAt = new Date(now.getTime() + rewardVoucher.durationDays * 24 * 60 * 60 * 1000);

    user.rewardPoints = Math.max(0, Number(user.rewardPoints || 0) - rewardVoucher.pointsRequired);
    user.memberRank = getMemberRank(user.rewardPoints);
    await user.save();

    const personalVoucher = await modelVoucher.create({
        code,
        name: rewardVoucher.name,
        description: `Voucher đổi từ ${rewardVoucher.pointsRequired} điểm thưởng`,
        discountType: mapRewardDiscountType(rewardVoucher.discountType),
        discountValue: rewardVoucher.discountValue,
        maxDiscount: rewardVoucher.maxDiscount,
        minOrderValue: rewardVoucher.minOrderValue,
        applicableTypes: mapApplicableTypes(rewardVoucher.applicableTo),
        startAt: now,
        endAt,
        usageLimit: 1,
        usageLimitPerUser: 1,
        userId,
        source: 'reward',
        rewardVoucherId: rewardVoucher._id,
        isActive: true,
    });

    rewardVoucher.usedCount += 1;
    await rewardVoucher.save();

    await modelPointTransaction.create({
        userId,
        type: 'redeem',
        points: -rewardVoucher.pointsRequired,
        source: 'voucher_exchange',
        referenceId: personalVoucher._id.toString(),
        description: `Đổi voucher ${rewardVoucher.name}`,
    });

    return personalVoucher;
};

module.exports = {
    POINTS_PER_VND,
    calculateEarnPoints,
    getMemberRank,
    getRankProgress,
    updateMemberRank,
    addPoints,
    refundPoints,
    adjustPoints,
    redeemVoucher,
};
