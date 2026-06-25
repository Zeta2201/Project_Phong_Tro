const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const savedSearchSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'user', required: true, index: true },
        name: { type: String, trim: true, maxlength: 120, default: 'Tìm kiếm đã lưu' },
        criteria: {
            category: { type: String, trim: true, default: '' },
            priceRange: { type: String, trim: true, default: '' },
            areaRange: { type: String, trim: true, default: '' },
            typeNews: { type: String, trim: true, default: '' },
            province: { type: String, trim: true, default: '' },
            keyword: { type: String, trim: true, default: '' },
        },
        notifyInApp: { type: Boolean, default: true },
        notifyEmail: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true, index: true },
        lastNotifiedPostIds: [{ type: Schema.Types.ObjectId, ref: 'posts' }],
    },
    { timestamps: true },
);

savedSearchSchema.index({ userId: 1, isActive: 1, createdAt: -1 });

module.exports = mongoose.model('savedSearch', savedSearchSchema);
