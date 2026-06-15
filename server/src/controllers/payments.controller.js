const axios = require('axios');
const crypto = require('crypto');
const { VNPay, ignoreLogger, ProductCode, VnpLocale, dateFormat } = require('vnpay');

const { BadRequestError } = require('../core/error.response');
const { OK } = require('../core/success.response');

const modelUser = require('../models/users.model');
const modelRechargeUser = require('../models/RechargeUser.model');

const { v4: uuidv4 } = require('uuid');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE || 'DH2F13SW';
const VNPAY_SECURE_SECRET = process.env.VNPAY_SECURE_SECRET || 'NXZM3DWFR0LC4R5VBK85OJZS1UE9KI6F';
const MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || 'MOMO';
const MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85';
const MOMO_SECRET_KEY = process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
const MOMO_ENDPOINT = process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';

const createVnpayClient = () =>
    new VNPay({
        tmnCode: VNPAY_TMN_CODE,
        secureSecret: VNPAY_SECURE_SECRET,
        vnpayHost: 'https://sandbox.vnpayment.vn',
        testMode: true,
        hashAlgorithm: 'SHA512',
        loggerFn: ignoreLogger,
    });

const completeRechargePayment = async ({ userId, amount, typePayment, paymentOrderId }) => {
    const parsedAmount = Number(amount);
    if (!userId || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !paymentOrderId) {
        return null;
    }

    const existingRecharge = await modelRechargeUser.findOne({ paymentOrderId });
    if (existingRecharge) {
        return existingRecharge;
    }

    const findUser = await modelUser.findById(userId);
    if (!findUser) {
        return null;
    }

    try {
        const recharge = await modelRechargeUser.create({
            userId: findUser._id,
            amount: parsedAmount,
            typePayment,
            status: 'success',
            paymentOrderId,
        });

        findUser.balance += parsedAmount;
        await findUser.save();

        const socket = global.usersMap?.get(findUser._id.toString());
        if (socket) {
            socket.emit('new-payment', {
                userId: findUser._id,
                amount: parsedAmount,
                date: recharge.createdAt,
                typePayment,
            });
        }

        return recharge;
    } catch (error) {
        if (error.code === 11000) {
            return modelRechargeUser.findOne({ paymentOrderId });
        }
        throw error;
    }
};

class PaymentsController {
    async payments(req, res) {
        const { id } = req.user;
        const { typePayment, amountUser } = req.body;
        const amount = Number(amountUser);

        if (!typePayment || !Number.isFinite(amount) || amount < 10000) {
            throw new BadRequestError('Vui lòng nhập đầy đủ thông tin');
        }

        if (!['MOMO', 'VNPAY'].includes(typePayment)) {
            throw new BadRequestError('Phương thức thanh toán không hợp lệ');
        }

        if (typePayment === 'MOMO') {
            var partnerCode = MOMO_PARTNER_CODE;
            var accessKey = MOMO_ACCESS_KEY;
            var secretkey = MOMO_SECRET_KEY;
            var requestId = partnerCode + new Date().getTime();
            var orderId = requestId;
            var orderInfo = `nap tien ${id}`; // nội dung giao dịch thanh toán
            var redirectUrl = `${SERVER_URL}/api/check-payment-momo`;
            var ipnUrl = redirectUrl;
            var requestType = 'captureWallet';
            var extraData = ''; //pass empty value if your merchant does not have stores

            var rawSignature =
                'accessKey=' +
                accessKey +
                '&amount=' +
                amount +
                '&extraData=' +
                extraData +
                '&ipnUrl=' +
                ipnUrl +
                '&orderId=' +
                orderId +
                '&orderInfo=' +
                orderInfo +
                '&partnerCode=' +
                partnerCode +
                '&redirectUrl=' +
                redirectUrl +
                '&requestId=' +
                requestId +
                '&requestType=' +
                requestType;
            //puts raw signature

            //signature
            var signature = crypto.createHmac('sha256', secretkey).update(rawSignature).digest('hex');

            //json object send to MoMo endpoint
            const requestBody = JSON.stringify({
                partnerCode: partnerCode,
                accessKey: accessKey,
                requestId: requestId,
                amount: amount,
                orderId: orderId,
                orderInfo: orderInfo,
                redirectUrl: redirectUrl,
                ipnUrl: ipnUrl,
                extraData: extraData,
                requestType: requestType,
                signature: signature,
                lang: 'en',
            });

            const response = await axios.post(MOMO_ENDPOINT, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            new OK({ message: 'Thanh toán thông báo', metadata: response.data }).send(res);
        }
        if (typePayment === 'VNPAY') {
            const vnpay = createVnpayClient();
            const uuid = uuidv4();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const vnpayResponse = await vnpay.buildPaymentUrl({
                vnp_Amount: amount,
                vnp_IpAddr: req.ip || '127.0.0.1',
                vnp_TxnRef: `${id}-${uuid}`,
                vnp_OrderInfo: `nap tien ${id}`,
                vnp_OrderType: ProductCode.Other,
                vnp_ReturnUrl: `${SERVER_URL}/api/check-payment-vnpay`,
                vnp_Locale: VnpLocale.VN,
                vnp_CreateDate: dateFormat(new Date()),
                vnp_ExpireDate: dateFormat(tomorrow),
            });
            new OK({ message: 'Thanh toán thông báo', metadata: vnpayResponse }).send(res);
        }
    }

    async checkPaymentMomo(req, res, next) {
        const { orderInfo, resultCode, amount, orderId, requestId } = req.query;

        if (resultCode === '0') {
            const result = orderInfo.split(' ')[2];
            await completeRechargePayment({
                userId: result,
                amount,
                typePayment: 'MOMO',
                paymentOrderId: orderId || requestId,
            });
        }

        return res.redirect(`${CLIENT_URL}/trang-ca-nhan`);
    }

    async checkPaymentVnpay(req, res) {
        const verification = createVnpayClient().verifyReturnUrl(req.query);

        if (verification.isVerified && verification.isSuccess) {
            const result = verification.vnp_OrderInfo?.split(' ')[2];
            await completeRechargePayment({
                userId: result,
                amount: verification.vnp_Amount,
                typePayment: 'VNPAY',
                paymentOrderId: verification.vnp_TxnRef,
            });
        }

        return res.redirect(`${CLIENT_URL}/trang-ca-nhan`);
    }
}
module.exports = new PaymentsController();
