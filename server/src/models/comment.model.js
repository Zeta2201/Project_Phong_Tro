const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const commentSchema = new Schema(
    {
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'posts',
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'user',
        },
        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
        status: {
            type: String,
            enum: ['visible', 'hidden', 'deleted'],
            default: 'visible',
            index: true,
        },
        moderationNote: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: '',
        },
        moderatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user',
            default: null,
        },
        moderatedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

commentSchema.index({ postId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('comment', commentSchema);
