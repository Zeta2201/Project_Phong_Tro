const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const voucherUsageSchema = new Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
        postId: { type: mongoose.Schema.Types.ObjectId, ref: 'posts', default: null },
        discountAmount: { type: Number, default: 0 },
        usedAt: { type: Date, default: Date.now },
    },
    { _id: false },
);

const voucherSchema = new Schema(
    {
        code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: '' },
        discountType: { type: String, enum: ['percent', 'fixed'], required: true },
        discountValue: { type: Number, required: true, min: 0 },
        maxDiscount: { type: Number, default: 0, min: 0 },
        minOrderValue: { type: Number, default: 0, min: 0 },
        applicableTypes: { type: [{ type: String, enum: ['normal', 'vip'] }], default: ['normal', 'vip'] },
        startAt: { type: Date, default: null },
        endAt: { type: Date, default: null },
        usageLimit: { type: Number, default: 0, min: 0 },
        usageLimitPerUser: { type: Number, default: 1, min: 0 },
        usedCount: { type: Number, default: 0, min: 0 },
        usedBy: { type: [voucherUsageSchema], default: [] },
        isActive: { type: Boolean, default: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null, index: true },
        source: { type: String, enum: ['admin', 'reward'], default: 'admin', index: true },
        rewardVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'rewardVoucher', default: null },
    },
    { timestamps: true },
);

module.exports = mongoose.model('voucher', voucherSchema);
