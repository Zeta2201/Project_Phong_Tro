const axios = require('axios');
const crypto = require('crypto');
const { VNPay, ignoreLogger, ProductCode, VnpLocale, dateFormat } = require('vnpay');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const modelDeposit = require('../models/deposit.model');
const modelPost = require('../models/post.model');
const modelUser = require('../models/users.model');
const { Created, OK } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');

const ACTIVE_STATUSES = ['pending', 'holding', 'disputed'];
const DEPOSIT_STATUSES = ['pending', 'holding', 'completed', 'refunded', 'cancelled', 'disputed'];
const PAYMENT_METHODS = ['SIMULATED', 'MOMO', 'VNPAY'];
const DEPOSIT_RATE = 0.1;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE || 'DH2F13SW';
const VNPAY_SECURE_SECRET = process.env.VNPAY_SECURE_SECRET || 'NXZM3DWFR0LC4R5VBK85OJZS1UE9KI6F';
const MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || 'MOMO';
const MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85';
const MOMO_SECRET_KEY = process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
const MOMO_ENDPOINT = process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';
const getExpiredAt = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
const getHoldingExpiredAt = () => new Date(Date.now() + 72 * 60 * 60 * 1000);
const normalizeNote = (value) => (typeof value === 'string' ? value.trim() : '');
const calculateDepositAmount = (roomPrice) => Math.ceil(Number(roomPrice) * DEPOSIT_RATE);
const createVnpayClient = () =>
    new VNPay({
        tmnCode: VNPAY_TMN_CODE,
        secureSecret: VNPAY_SECURE_SECRET,
        vnpayHost: 'https://sandbox.vnpayment.vn',
        testMode: true,
        hashAlgorithm: 'SHA512',
        loggerFn: ignoreLogger,
    });

const populateDeposit = (query) =>
    query
        .populate('roomId', 'title location price images availabilityStatus status')
        .populate('tenantId', 'fullName email phone avatar')
        .populate('landlordId', 'fullName email phone avatar');

const formatDeposit = (deposit) => ({
    ...deposit._doc,
    room: deposit.roomId,
    tenant: deposit.tenantId,
    landlord: deposit.landlordId,
});

const releaseRoom = async (roomId) => {
    await modelPost.findOneAndUpdate(
        { _id: roomId, availabilityStatus: 'reserved' },
        { availabilityStatus: 'available' },
    );
};

const releaseHeldBalance = async (deposit, recipientId) => {
    const updated = await modelDeposit.findOneAndUpdate(
        { _id: deposit._id, balanceHeld: true },
        { balanceHeld: false },
        { new: true },
    );
    if (updated) {
        deposit.balanceHeld = false;
        await modelUser.findByIdAndUpdate(recipientId, { $inc: { balance: deposit.amount } });
    }
};

const expirePendingDeposits = async () => {
    const expiredDeposits = await modelDeposit.find({
        status: 'pending',
        paymentStatus: 'unpaid',
        expiredAt: { $lte: new Date() },
    });
    for (const deposit of expiredDeposits) {
        await releaseHeldBalance(deposit, deposit.tenantId);
        deposit.status = 'cancelled';
        deposit.adminNote = 'Yeu cau coc het han thanh toan';
        await deposit.save();
    }
};

const markDepositPaid = async (depositId, expectedAmount = null) => {
    const deposit = await modelDeposit.findById(depositId);
    if (!deposit) throw new BadRequestError('Giao dich coc khong ton tai');
    if (deposit.status !== 'pending') return deposit;
    if (expectedAmount !== null && Number(expectedAmount) !== deposit.amount) {
        throw new BadRequestError('So tien thanh toan coc khong khop');
    }

    const room = await modelPost.findOneAndUpdate(
        { _id: deposit.roomId, availabilityStatus: 'available' },
        { availabilityStatus: 'reserved' },
        { new: true },
    );
    if (!room) {
        if (deposit.paymentMethod !== 'SIMULATED') {
            deposit.balanceHeld = true;
        }
        deposit.paymentStatus = 'failed';
        deposit.status = 'cancelled';
        deposit.adminNote = 'Phong khong con trong khi xac nhan thanh toan';
        await deposit.save();
        await releaseHeldBalance(deposit, deposit.tenantId);
        throw new BadRequestError('Phong khong con trong');
    }

    deposit.paymentStatus = 'paid';
    deposit.status = 'holding';
    deposit.balanceHeld = true;
    deposit.expiredAt = getHoldingExpiredAt();
    await deposit.save();
    return deposit;
};

const markPaymentFailed = async (depositId) => {
    if (!mongoose.isValidObjectId(depositId)) return;
    const deposit = await modelDeposit.findOne({ _id: depositId, status: 'pending' });
    if (!deposit) return;
    await releaseHeldBalance(deposit, deposit.tenantId);
    deposit.paymentStatus = 'failed';
    deposit.status = 'cancelled';
    await deposit.save();
};

const completeIfConfirmed = async (deposit) => {
    if (deposit.status === 'holding' && deposit.tenantConfirm && deposit.landlordConfirm) {
        deposit.status = 'completed';
        await deposit.save();
        await releaseHeldBalance(deposit, deposit.landlordId);
        await modelPost.findByIdAndUpdate(deposit.roomId, { availabilityStatus: 'rented' });
    }
    return deposit;
};

class controllerDeposit {
    async createDeposit(req, res) {
        await expirePendingDeposits();
        const { id: tenantId } = req.user;
        const { roomId, paymentMethod = 'SIMULATED' } = req.body;

        if (!mongoose.isValidObjectId(roomId)) throw new BadRequestError('Phong khong hop le');
        if (!PAYMENT_METHODS.includes(paymentMethod)) throw new BadRequestError('Phuong thuc thanh toan khong hop le');

        const room = await modelPost.findById(roomId);
        if (!room || !['active', 'approved'].includes(room.status) || room.isDeleted) {
            throw new BadRequestError('Phong khong ton tai hoac chua duoc hien thi');
        }
        if ((room.availabilityStatus || 'available') !== 'available') throw new BadRequestError('Phong hien khong con trong');
        if (room.userId.toString() === tenantId) throw new BadRequestError('Ban khong the dat coc phong cua chinh minh');

        const depositAmount = calculateDepositAmount(room.price);
        if (!Number.isFinite(depositAmount) || depositAmount <= 0) throw new BadRequestError('Gia phong khong hop le de tinh tien coc');

        const activeDeposit = await modelDeposit.findOne({ roomId, status: { $in: ACTIVE_STATUSES } });
        if (activeDeposit) throw new BadRequestError('Phong da co giao dich coc dang xu ly');

        let walletCharged = false;
        if (paymentMethod === 'SIMULATED') {
            const tenant = await modelUser.findOneAndUpdate(
                { _id: tenantId, balance: { $gte: depositAmount } },
                { $inc: { balance: -depositAmount } },
                { new: true },
            );
            if (!tenant) throw new BadRequestError('So du khong du de dat coc');
            walletCharged = true;
        }

        try {
            const deposit = await modelDeposit.create({
                roomId,
                tenantId,
                landlordId: room.userId,
                amount: depositAmount,
                paymentMethod,
                balanceHeld: walletCharged,
                expiredAt: getExpiredAt(),
            });
            new Created({ message: 'Đã tạo yêu cầu đặt cọc', metadata: deposit }).send(res);
        } catch (error) {
            if (walletCharged) {
                await modelUser.findByIdAndUpdate(tenantId, { $inc: { balance: depositAmount } });
            }
            if (error.code === 11000) throw new BadRequestError('Phong da co giao dich coc dang xu ly');
            throw error;
        }
    }

    async payDeposit(req, res) {
        const { id: userId } = req.user;
        const { depositId } = req.body;
        const deposit = await modelDeposit.findById(depositId);
        if (!deposit || deposit.tenantId.toString() !== userId) throw new BadRequestError('Ban khong co quyen thanh toan giao dich nay');
        if (deposit.status !== 'pending' || deposit.paymentStatus !== 'unpaid') throw new BadRequestError('Giao dich khong the thanh toan');
        if (deposit.expiredAt <= new Date()) throw new BadRequestError('Yeu cau coc da het han');

        if (deposit.paymentMethod === 'SIMULATED') {
            await markDepositPaid(deposit._id);
            return new OK({ message: 'Thanh toán giả lập thành công', metadata: { redirectUrl: `${CLIENT_URL}/trang-ca-nhan?tab=tenant-deposits` } }).send(res);
        }
        if (deposit.paymentMethod === 'MOMO') {
            const partnerCode = MOMO_PARTNER_CODE;
            const accessKey = MOMO_ACCESS_KEY;
            const secretKey = MOMO_SECRET_KEY;
            const requestId = partnerCode + Date.now();
            const orderId = deposit._id.toString();
            const orderInfo = `deposit ${deposit._id}`;
            const redirectUrl = `${SERVER_URL}/api/deposits/payment/momo-return`;
            const ipnUrl = redirectUrl;
            const requestType = 'captureWallet';
            const extraData = '';
            const rawSignature = `accessKey=${accessKey}&amount=${deposit.amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
            const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
            const response = await axios.post(MOMO_ENDPOINT, {
                partnerCode, accessKey, requestId, amount: deposit.amount, orderId, orderInfo, redirectUrl, ipnUrl,
                extraData, requestType, signature, lang: 'vi',
            });
            return new OK({ message: 'Đã tạo URL thanh toán MoMo', metadata: { redirectUrl: response.data.payUrl } }).send(res);
        }

        const vnpay = createVnpayClient();
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const redirectUrl = await vnpay.buildPaymentUrl({
            vnp_Amount: deposit.amount,
            vnp_IpAddr: req.ip || '127.0.0.1',
            vnp_TxnRef: `${deposit._id}-${uuidv4()}`,
            vnp_OrderInfo: `deposit ${deposit._id}`,
            vnp_OrderType: ProductCode.Other,
            vnp_ReturnUrl: `${SERVER_URL}/api/deposits/payment/vnpay-return`,
            vnp_Locale: VnpLocale.VN,
            vnp_CreateDate: dateFormat(new Date()),
            vnp_ExpireDate: dateFormat(tomorrow),
        });
        new OK({ message: 'Đã tạo URL thanh toán VNPay', metadata: { redirectUrl } }).send(res);
    }

    async momoReturn(req, res) {
        const accessKey = MOMO_ACCESS_KEY;
        const secretKey = MOMO_SECRET_KEY;
        const { amount, extraData, message, orderId, orderInfo, orderType, partnerCode, payType, requestId, responseTime, resultCode, transId, signature } = req.query;
        const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
        const expectedSignature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
        if (signature === expectedSignature) {
            if (resultCode === '0') await markDepositPaid(orderId, amount);
            else await markPaymentFailed(orderId);
        }
        return res.redirect(`${CLIENT_URL}/trang-ca-nhan?tab=tenant-deposits`);
    }

    async vnpayReturn(req, res) {
        const verification = createVnpayClient().verifyReturnUrl(req.query);
        if (verification.isVerified && verification.isSuccess) {
            const depositId = verification.vnp_OrderInfo?.split(' ')[1];
            await markDepositPaid(depositId, verification.vnp_Amount);
        } else if (verification.isVerified) {
            await markPaymentFailed(verification.vnp_OrderInfo?.split(' ')[1]);
        }
        return res.redirect(`${CLIENT_URL}/trang-ca-nhan?tab=tenant-deposits`);
    }

    async getMyDeposits(req, res) {
        await expirePendingDeposits();
        const deposits = await populateDeposit(modelDeposit.find({ tenantId: req.user.id }).sort({ createdAt: -1 }));
        new OK({ message: 'Đã lấy danh sách cọc thành công', metadata: deposits.map(formatDeposit) }).send(res);
    }

    async getLandlordDeposits(req, res) {
        await expirePendingDeposits();
        const deposits = await populateDeposit(modelDeposit.find({ landlordId: req.user.id }).sort({ createdAt: -1 }));
        new OK({ message: 'Đã lấy danh sách cọc chủ trọ thành công', metadata: deposits.map(formatDeposit) }).send(res);
    }

    async tenantConfirm(req, res) {
        const deposit = await modelDeposit.findById(req.body.depositId);
        if (!deposit || deposit.tenantId.toString() !== req.user.id) throw new BadRequestError('Ban khong co quyen xac nhan giao dich nay');
        if (deposit.status !== 'holding') throw new BadRequestError('Giao dich khong o trang thai giu coc');
        deposit.tenantConfirm = true;
        await deposit.save();
        await completeIfConfirmed(deposit);
        new OK({ message: 'Đã xác nhận nhận phòng', metadata: deposit }).send(res);
    }

    async landlordConfirm(req, res) {
        const deposit = await modelDeposit.findById(req.body.depositId);
        if (!deposit || deposit.landlordId.toString() !== req.user.id) throw new BadRequestError('Ban khong co quyen xac nhan giao dich nay');
        if (deposit.status !== 'holding') throw new BadRequestError('Giao dich khong o trang thai giu coc');
        deposit.landlordConfirm = true;
        await deposit.save();
        await completeIfConfirmed(deposit);
        new OK({ message: 'Đã xác nhận cho thuê', metadata: deposit }).send(res);
    }

    async cancelDeposit(req, res) {
        const deposit = await modelDeposit.findById(req.body.depositId);
        if (!deposit || deposit.tenantId.toString() !== req.user.id) throw new BadRequestError('Ban khong co quyen huy giao dich nay');
        if (deposit.status !== 'pending') throw new BadRequestError('Chi co the huy yeu cau chua thanh toan');
        deposit.status = 'cancelled';
        await deposit.save();
        await releaseHeldBalance(deposit, deposit.tenantId);
        new OK({ message: 'Đã hủy yêu cầu cọc', metadata: deposit }).send(res);
    }

    async disputeDeposit(req, res) {
        const deposit = await modelDeposit.findById(req.body.depositId);
        if (!deposit) throw new BadRequestError('Giao dich coc khong ton tai');
        const canDispute = [deposit.tenantId, deposit.landlordId].some((id) => id.toString() === req.user.id);
        if (!canDispute || deposit.status !== 'holding') throw new BadRequestError('Khong the mo tranh chap giao dich nay');
        deposit.status = 'disputed';
        deposit.adminNote = normalizeNote(req.body.note);
        await deposit.save();
        new OK({ message: 'Đã chuyển giao dịch sang tranh chấp', metadata: deposit }).send(res);
    }

    async getAllDeposits(req, res) {
        await expirePendingDeposits();
        if (req.query.status && !DEPOSIT_STATUSES.includes(req.query.status)) {
            throw new BadRequestError('Trạng thái cọc không hợp lệ');
        }
        const filter = req.query.status ? { status: req.query.status } : {};
        const deposits = await populateDeposit(modelDeposit.find(filter).sort({ createdAt: -1 }));
        new OK({ message: 'Đã lấy tất cả giao dịch cọc thành công', metadata: deposits.map(formatDeposit) }).send(res);
    }

    async adminAction(req, res) {
        const { depositId, action } = req.body;
        const deposit = await modelDeposit.findById(depositId);
        if (!deposit) throw new BadRequestError('Giao dịch cọc không tồn tại');
        deposit.adminNote = normalizeNote(req.body.adminNote);

        if (action === 'refund') {
            if (!['holding', 'disputed'].includes(deposit.status)) throw new BadRequestError('Không thể hoàn cọc giao dịch này');
            if (deposit.paymentStatus !== 'paid') throw new BadRequestError('Giao dịch chưa thanh toán');
            deposit.status = 'refunded';
            await releaseRoom(deposit.roomId);
            await releaseHeldBalance(deposit, deposit.tenantId);
        } else if (action === 'release') {
            if (!['holding', 'disputed'].includes(deposit.status)) throw new BadRequestError('Không thể giải ngân giao dịch này');
            if (deposit.paymentStatus !== 'paid') throw new BadRequestError('Giao dịch chưa thanh toán');
            deposit.status = 'completed';
            deposit.tenantConfirm = true;
            deposit.landlordConfirm = true;
            await releaseHeldBalance(deposit, deposit.landlordId);
            await modelPost.findByIdAndUpdate(deposit.roomId, { availabilityStatus: 'rented' });
        } else if (action === 'dispute') {
            if (!['pending', 'holding'].includes(deposit.status)) throw new BadRequestError('Không thể chuyển tranh chấp giao dịch này');
            deposit.status = 'disputed';
        } else {
            throw new BadRequestError('Hành động admin không hợp lệ');
        }
        await deposit.save();
        new OK({ message: 'Đã cập nhật giao dịch cọc', metadata: deposit }).send(res);
    }
}

module.exports = new controllerDeposit();
