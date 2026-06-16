const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const bannerSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        subtitle: { type: String, trim: true, default: '' },
        badgeText: { type: String, trim: true, default: '' },
        ctaText: { type: String, trim: true, default: 'Xem ngay' },
        ctaLink: { type: String, trim: true, default: '/trang-ca-nhan?tab=posts' },
        imageUrl: { type: String, trim: true, default: '' },
        voucherCode: { type: String, trim: true, uppercase: true, default: '' },
        startAt: { type: Date, default: null },
        endAt: { type: Date, default: null },
        priority: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true },
);

module.exports = mongoose.model('banner', bannerSchema);
