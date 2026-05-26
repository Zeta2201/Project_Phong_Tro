const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const reservationSchema = new Schema(
    {
        postId: { type: mongoose.Schema.Types.ObjectId, ref: 'posts', required: true },
        tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
        tenantName: { type: String, required: true },
        tenantPhone: { type: String, default: '' },
        note: { type: String, default: '' },
        visitDate: { type: Date, default: null },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected', 'cancelled', 'expired'],
            default: 'pending',
        },
        ownerNote: { type: String, default: '' },
        handledAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('reservation', reservationSchema);
