const modelVoucher = require('../models/voucher.model');
const { BadRequestError } = require('../core/error.response');

const normalizeVoucherCode = (code = '') => code.toString().trim().toUpperCase();

const validateVoucherPayload = ({ voucher, userId, typeNews, orderValue, now = new Date() }) => {
    if (!voucher) throw new BadRequestError('Voucher không tồn tại');
    if (!voucher.isActive) throw new BadRequestError('Voucher đã tắt');
    if (voucher.userId && voucher.userId.toString() !== userId?.toString()) {
        throw new BadRequestError('Voucher không thuộc tài khoản của bạn');
    }
    if (voucher.startAt && new Date(voucher.startAt) > now) throw new BadRequestError('Voucher chưa đến thời gian sử dụng');
    if (voucher.endAt && new Date(voucher.endAt) < now) throw new BadRequestError('Voucher đã hết hạn');
    if (voucher.minOrderValue && orderValue < voucher.minOrderValue) {
        throw new BadRequestError(`Đơn tối thiểu để dùng voucher là ${Number(voucher.minOrderValue).toLocaleString('vi-VN')} VND`);
    }
    if (voucher.applicableTypes?.length && !voucher.applicableTypes.includes(typeNews)) {
        throw new BadRequestError('Voucher không áp dụng cho loại tin này');
    }
    if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
        throw new BadRequestError('Voucher đã hết lượt sử dụng');
    }

    const userUsedCount = (voucher.usedBy || []).filter((usage) => usage.userId?.toString() === userId?.toString()).length;
    if (voucher.usageLimitPerUser > 0 && userUsedCount >= voucher.usageLimitPerUser) {
        throw new BadRequestError('Bạn đã sử dụng hết lượt cho voucher này');
    }
};

const calculateVoucherDiscount = (voucher, orderValue) => {
    if (!voucher || orderValue <= 0) return 0;

    const rawDiscount =
        voucher.discountType === 'percent' ? Math.floor((orderValue * voucher.discountValue) / 100) : Number(voucher.discountValue || 0);
    const cappedDiscount = voucher.maxDiscount > 0 ? Math.min(rawDiscount, voucher.maxDiscount) : rawDiscount;
    return Math.max(0, Math.min(orderValue, Math.floor(cappedDiscount)));
};

const previewVoucher = async ({ code, userId, typeNews, orderValue }) => {
    const normalizedCode = normalizeVoucherCode(code);
    if (!normalizedCode) return { voucher: null, discountAmount: 0, finalAmount: orderValue };

    const voucher = await modelVoucher.findOne({ code: normalizedCode });
    validateVoucherPayload({ voucher, userId, typeNews, orderValue });

    const discountAmount = calculateVoucherDiscount(voucher, orderValue);
    return {
        voucher,
        discountAmount,
        finalAmount: Math.max(0, orderValue - discountAmount),
    };
};

const markVoucherUsed = async ({ voucherId, userId, postId, discountAmount }) => {
    if (!voucherId || discountAmount <= 0) return null;

    return modelVoucher.findByIdAndUpdate(
        voucherId,
        {
            $inc: { usedCount: 1 },
            $push: {
                usedBy: {
                    userId,
                    postId,
                    discountAmount,
                    usedAt: new Date(),
                },
            },
        },
        { new: true },
    );
};

module.exports = {
    normalizeVoucherCode,
    previewVoucher,
    markVoucherUsed,
};
