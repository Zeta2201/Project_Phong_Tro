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
        visitTime: { type: String, default: '' },
        proposedVisitDate: { type: Date, default: null },
        proposedVisitTime: { type: String, default: '' },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'reschedule_requested', 'rejected', 'cancelled', 'expired', 'viewed', 'no_show'],
            default: 'pending',
        },
        ownerNote: { type: String, default: '' },
        tenantNote: { type: String, default: '' },
        handledAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null },
        reminderSentAt: { type: Date, default: null },
        viewedAt: { type: Date, default: null },
        timeline: [
            {
                actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
                role: { type: String, enum: ['tenant', 'owner', 'system'], default: 'system' },
                action: { type: String, required: true },
                note: { type: String, default: '' },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('reservation', reservationSchema);
