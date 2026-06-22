const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const notificationSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'user', required: true, index: true },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: ['post', 'deposit', 'contract', 'chat', 'voucher', 'report', 'verification', 'maintenance', 'system'],
            default: 'system',
            index: true,
        },
        link: { type: String, default: '', trim: true },
        isRead: { type: Boolean, default: false, index: true },
        isDeleted: { type: Boolean, default: false, index: true },
        metadata: { type: Schema.Types.Mixed, default: {} },
        createdBy: { type: Schema.Types.ObjectId, ref: 'user', default: null, index: true },
        isBroadcast: { type: Boolean, default: false, index: true },
        targetRole: { type: String, enum: ['all', 'user', 'landlord', 'admin'], default: 'user', index: true },
    },
    { timestamps: true },
);

notificationSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('notification', notificationSchema);
