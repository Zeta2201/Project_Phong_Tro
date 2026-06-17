const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const modelUser = new Schema(
    {
        fullName: { type: String, require: true },
        email: { type: String, require: true },
        password: { type: String, require: true },
        address: { type: String, require: true },
        avatar: { type: String, require: true },
        phone: { type: String, require: true },
        isAdmin: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        balance: { type: Number, default: 0 },
        typeLogin: { type: String, enum: ['email', 'google'] },
        verificationStatus: {
            type: String,
            enum: ['none', 'pending', 'verified', 'rejected'],
            default: 'none',
            index: true,
        },
        cccdNumber: { type: String, default: '', trim: true },
        cccdFullName: { type: String, default: '', trim: true },
        cccdDob: { type: String, default: '', trim: true },
        cccdAddress: { type: String, default: '', trim: true },
        cccdImageUrl: { type: String, default: '' },
        cccdOcrRawText: { type: String, default: '' },
        verifiedAt: { type: Date, default: null },
        verificationRejectReason: { type: String, default: '', trim: true },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('user', modelUser);
