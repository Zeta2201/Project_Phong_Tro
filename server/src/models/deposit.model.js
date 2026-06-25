const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const disputeEvidenceSchema = new Schema(
    {
        submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
        role: { type: String, enum: ['tenant', 'landlord', 'admin'], required: true },
        note: { type: String, trim: true, maxlength: 2000, default: '' },
        files: [{ type: String, trim: true }],
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true },
);

const disputeMessageSchema = new Schema(
    {
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
        role: { type: String, enum: ['tenant', 'landlord', 'admin'], required: true },
        message: { type: String, trim: true, maxlength: 2000, required: true },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true },
);

const disputeTimelineSchema = new Schema(
    {
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
        role: { type: String, enum: ['tenant', 'landlord', 'admin', 'system'], default: 'system' },
        action: { type: String, required: true, trim: true },
        note: { type: String, trim: true, maxlength: 2000, default: '' },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true },
);

const disputeResolutionSchema = new Schema(
    {
        decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
        action: { type: String, enum: ['refund', 'release', 'split'], default: null },
        refundAmount: { type: Number, default: 0, min: 0 },
        releaseAmount: { type: Number, default: 0, min: 0 },
        note: { type: String, trim: true, maxlength: 2000, default: '' },
        decidedAt: { type: Date, default: null },
    },
    { _id: false },
);

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
        dispute: {
            openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
            openedByRole: { type: String, enum: ['tenant', 'landlord', 'admin', ''], default: '' },
            reason: { type: String, trim: true, maxlength: 2000, default: '' },
            openedAt: { type: Date, default: null },
            evidences: [disputeEvidenceSchema],
            messages: [disputeMessageSchema],
            timeline: [disputeTimelineSchema],
            resolution: { type: disputeResolutionSchema, default: () => ({}) },
        },
    },
    { timestamps: true },
);

depositSchema.index(
    { roomId: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['pending', 'holding', 'disputed'] } } },
);

module.exports = mongoose.model('deposit', depositSchema);
