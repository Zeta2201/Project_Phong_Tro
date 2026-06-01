const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const depositSchema = new Schema(
    {
        roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'posts', required: true },
        tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
        landlordId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
        amount: { type: Number, required: true, min: 1 },
        paymentMethod: { type: String, enum: ['SIMULATED', 'MOMO', 'VNPAY'], required: true },
        paymentStatus: { type: String, enum: ['unpaid', 'paid', 'failed'], default: 'unpaid' },
        status: {
            type: String,
            enum: ['pending', 'holding', 'completed', 'refunded', 'cancelled', 'disputed'],
            default: 'pending',
            index: true,
        },
        tenantConfirm: { type: Boolean, default: false },
        landlordConfirm: { type: Boolean, default: false },
        balanceHeld: { type: Boolean, default: false },
        expiredAt: { type: Date, required: true },
        adminNote: { type: String, trim: true, maxlength: 2000, default: '' },
    },
    { timestamps: true },
);

depositSchema.index(
    { roomId: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['pending', 'holding', 'disputed'] } } },
);

module.exports = mongoose.model('deposit', depositSchema);
