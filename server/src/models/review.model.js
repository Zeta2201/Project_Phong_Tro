const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const reviewSchema = new Schema(
    {
        roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'posts', required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
        rentalId: { type: mongoose.Schema.Types.ObjectId, required: true },
        rentalType: {
            type: String,
            enum: ['reservation', 'rental', 'booking', 'contract'],
            default: 'reservation',
        },
        rating: { type: Number, required: true, min: 1, max: 5 },
        cleanlinessRating: { type: Number, required: true, min: 1, max: 5 },
        securityRating: { type: Number, required: true, min: 1, max: 5 },
        locationRating: { type: Number, required: true, min: 1, max: 5 },
        priceRating: { type: Number, required: true, min: 1, max: 5 },
        content: { type: String, required: true, trim: true, maxlength: 2000 },
        images: { type: [String], default: [] },
        reply: {
            content: { type: String, trim: true, maxlength: 1000 },
            ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
            createdAt: { type: Date },
            updatedAt: { type: Date },
        },
        status: {
            type: String,
            enum: ['visible', 'hidden', 'reported', 'deleted'],
            default: 'visible',
        },
        reports: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
                reason: {
                    type: String,
                    enum: ['spam', 'inappropriate', 'false-info', 'offensive'],
                    required: true,
                },
                details: { type: String, trim: true, maxlength: 1000, default: '' },
                createdAt: { type: Date, default: Date.now },
            },
        ],
        reportCount: { type: Number, default: 0 },
    },
    {
        timestamps: true,
    },
);

reviewSchema.index({ userId: 1, rentalId: 1 }, { unique: true });
reviewSchema.index({ roomId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('review', reviewSchema);
