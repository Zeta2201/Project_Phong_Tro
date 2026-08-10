const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const withdrawRequestSchema = new Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
        amount: { type: Number, required: true, min: 1 },
        bankName: { type: String, required: true, trim: true },
        bankAccountNumber: { type: String, required: true, trim: true },
        bankAccountName: { type: String, required: true, trim: true },
        note: { type: String, default: '', trim: true },
        adminNote: { type: String, default: '', trim: true },
        status: {
            type: String,
            enum: ['pending', 'approved', 'completed', 'rejected', 'cancelled'],
            default: 'pending',
            index: true,
        },
        handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
        handledAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('withdrawRequest', withdrawRequestSchema);
