const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const rewardVoucherSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        codePrefix: { type: String, required: true, trim: true, uppercase: true },
        pointsRequired: { type: Number, required: true, min: 1 },
        discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
        discountValue: { type: Number, required: true, min: 0 },
        maxDiscount: { type: Number, default: 0, min: 0 },
        minOrderValue: { type: Number, default: 0, min: 0 },
        durationDays: { type: Number, default: 30, min: 1 },
        quantity: { type: Number, default: 0, min: 0 },
        usedCount: { type: Number, default: 0, min: 0 },
        isActive: { type: Boolean, default: true, index: true },
        applicableTo: {
            type: [{ type: String, enum: ['listing_package', 'vip_upgrade', 'boost_listing'] }],
            default: ['listing_package', 'vip_upgrade', 'boost_listing'],
        },
    },
    { timestamps: true },
);

module.exports = mongoose.model('rewardVoucher', rewardVoucherSchema);
