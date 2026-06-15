const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const modelRechargeUser = new Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, require: true, ref: 'user' },
        amount: { type: Number, require: true },
        typePayment: { type: String, require: true },
        status: { type: String, require: true },
        paymentOrderId: { type: String, unique: true, sparse: true },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('rechargeuser', modelRechargeUser);
