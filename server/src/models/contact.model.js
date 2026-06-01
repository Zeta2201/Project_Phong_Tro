const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const contactSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            maxlength: 160,
        },
        phone: {
            type: String,
            trim: true,
            maxlength: 30,
            default: '',
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 3000,
        },
        status: {
            type: String,
            enum: ['pending', 'resolved', 'rejected'],
            default: 'pending',
            index: true,
        },
        adminNote: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: '',
        },
        handledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user',
            default: null,
        },
        handledAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

contactSchema.index({ createdAt: -1 });

module.exports = mongoose.model('contact', contactSchema);
