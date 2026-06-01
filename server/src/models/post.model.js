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
            enum: ['active', 'inactive', 'rejected'],
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
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('posts', modelPost);
