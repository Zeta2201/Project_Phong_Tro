const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const modelPost = new Schema(
    {
        title: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        images: {
            type: Array,
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'user',
        },
        category: {
            type: String,
            required: true,
            enum: ['phong-tro', 'nha-nguyen-can', 'can-ho-chung-cu', 'can-ho-mini'],
        },
        location: {
            type: String,
            required: true,
        },
        coordinates: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null },
        },
        phone: {
            type: String,
            required: true,
        },
        username: {
            type: String,
            required: true,
        },
        area: {
            type: Number,
            required: true,
        },
        options: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        status: {
            type: String,
            required: true,
            enum: ['draft', 'pending', 'approved', 'rejected', 'hidden', 'rented', 'deleted', 'active', 'inactive'],
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user',
            default: null,
        },
        availabilityStatus: {
            type: String,
            required: true,
            enum: ['available', 'unavailable', 'reserved', 'rented'],
            default: 'available',
        },
        typeNews: {
            type: String,
            required: true,
            enum: ['vip', 'normal'],
        },
        postingFee: {
            type: Number,
            default: 0,
        },
        postingFeeOriginal: {
            type: Number,
            default: 0,
        },
        voucherCode: {
            type: String,
            default: '',
            trim: true,
            uppercase: true,
        },
        voucherDiscount: {
            type: Number,
            default: 0,
        },
        voucherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'voucher',
            default: null,
        },
        postingFeeRefunded: {
            type: Boolean,
            default: false,
        },
        postingFeeRefundedAt: {
            type: Date,
            default: null,
        },
        endDate: {
            type: Date,
            required: true,
        },
        ratingAverage: {
            type: Number,
            default: 0,
        },
        ratingCount: {
            type: Number,
            default: 0,
        },
        viewCount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('posts', modelPost);
