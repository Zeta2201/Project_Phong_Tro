const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const pointTransactionSchema = new Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
        type: { type: String, enum: ['earn', 'redeem', 'refund', 'adjust'], required: true, index: true },
        points: { type: Number, required: true },
        source: {
            type: String,
            enum: ['listing_payment', 'vip_upgrade', 'boost_listing', 'voucher_exchange', 'refund', 'admin_adjust'],
            required: true,
            index: true,
        },
        referenceId: { type: String, default: '', trim: true, index: true },
        description: { type: String, default: '', trim: true },
    },
    { timestamps: true },
);

pointTransactionSchema.index(
    { userId: 1, source: 1, referenceId: 1, type: 1 },
    { unique: true, partialFilterExpression: { referenceId: { $type: 'string', $gt: '' } } },
);

module.exports = mongoose.model('pointTransaction', pointTransactionSchema);
