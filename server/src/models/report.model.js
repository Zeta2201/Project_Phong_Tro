const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const reportSchema = new Schema(
    {
        postId: { type: mongoose.Schema.Types.ObjectId, ref: 'posts', required: true },
        reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
        reporterName: { type: String, required: true },
        reporterEmail: { type: String, required: true },
        reason: { type: String, required: true },
        details: { type: String, default: '' },
        status: {
            type: String,
            enum: ['pending', 'resolved', 'rejected'],
            default: 'pending',
        },
        handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
        note: { type: String, default: '' },
        actionTaken: {
            type: String,
            enum: ['none', 'hide_post', 'takedown_post'],
            default: 'none',
        },
        actionAt: { type: Date, default: null },
        postStatusBefore: { type: String, default: '' },
        postStatusAfter: { type: String, default: '' },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('report', reportSchema);
