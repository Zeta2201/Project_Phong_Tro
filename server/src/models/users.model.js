const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const modelUser = new Schema(
    {
        fullName: { type: String, require: true },
        email: { type: String, require: true, trim: true, lowercase: true },
        password: { type: String, require: true },
        address: { type: String, require: true },
        avatar: { type: String, require: true },
        phone: { type: String, require: true },
        isAdmin: { type: Boolean, default: false },
        role: { type: String, enum: ['user', 'landlord', 'admin', 'super_admin'], default: 'user', index: true },
        isActive: { type: Boolean, default: true },
        accountStatus: { type: String, enum: ['active', 'locked'], default: 'active', index: true },
        lastLoginAt: { type: Date, default: null },
        balance: { type: Number, default: 0 },
        rewardPoints: { type: Number, default: 0, min: 0 },
        memberRank: { type: String, enum: ['bronze', 'silver', 'gold', 'diamond'], default: 'bronze', index: true },
        typeLogin: { type: String, enum: ['email', 'google'] },
        provider: { type: String, enum: ['local', 'google'], default: 'local' },
        emailVerified: { type: Boolean, default: false },
        pendingEmail: { type: String, default: '', trim: true, lowercase: true },
        emailChangeOtp: { type: String, default: '' },
        emailChangeOtpExpires: { type: Date, default: null },
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
