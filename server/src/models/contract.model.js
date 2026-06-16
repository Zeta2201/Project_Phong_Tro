const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const contractSchema = new Schema(
    {
        depositId: { type: mongoose.Schema.Types.ObjectId, ref: 'deposit', required: true, unique: true },
        roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'posts', required: true, index: true },
        tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
        landlordId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
        contractCode: { type: String, required: true, unique: true, index: true },
        monthlyRent: { type: Number, required: true, min: 0 },
        depositAmount: { type: Number, required: true, min: 0 },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        terms: { type: String, required: true, trim: true },
        tenantSignatureUrl: { type: String, default: '' },
        landlordSignatureUrl: { type: String, default: '' },
        tenantSignedAt: { type: Date, default: null },
        landlordSignedAt: { type: Date, default: null },
        pdfUrl: { type: String, default: '' },
        pdfPublicId: { type: String, default: '' },
        status: {
            type: String,
            enum: [
                'draft',
                'waiting_tenant_signature',
                'waiting_landlord_signature',
                'active',
                'expired',
                'canceled',
            ],
            default: 'draft',
            index: true,
        },
        sentToTenantAt: { type: Date, default: null },
        sentToLandlordAt: { type: Date, default: null },
        canceledAt: { type: Date, default: null },
        cancelReason: { type: String, trim: true, default: '' },
    },
    { timestamps: true },
);

module.exports = mongoose.model('contract', contractSchema);
