const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const postingPlanSchema = new Schema(
    {
        typeNews: { type: String, enum: ['vip', 'normal'], required: true },
        name: { type: String, required: true, trim: true },
        label: { type: String, trim: true, default: '' },
        description: { type: String, trim: true, default: '' },
        durationDays: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
        benefits: { type: [String], default: [] },
        isActive: { type: Boolean, default: true, index: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true },
);

postingPlanSchema.index({ typeNews: 1, durationDays: 1 }, { unique: true });

module.exports = mongoose.model('postingPlan', postingPlanSchema);
