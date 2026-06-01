const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const filterOptionSchema = new Schema(
    {
        field: {
            type: String,
            required: true,
            enum: ['category', 'priceRange', 'areaRange', 'typeNews'],
            index: true,
        },
        value: {
            type: String,
            required: true,
            trim: true,
        },
        label: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 300,
            default: '',
        },
        minValue: {
            type: Number,
            default: null,
        },
        maxValue: {
            type: Number,
            default: null,
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    {
        timestamps: true,
    },
);

filterOptionSchema.index({ field: 1, value: 1 }, { unique: true });
filterOptionSchema.index({ field: 1, isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('filterOption', filterOptionSchema);
