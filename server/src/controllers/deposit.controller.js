const axios = require('axios');
const crypto = require('crypto');
const { VNPay, ignoreLogger, ProductCode, VnpLocale, dateFormat } = require('vnpay');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const modelDeposit = require('../models/deposit.model');
const modelPost = require('../models/post.model');
const modelUser = require('../models/users.model');
const modelReservation = require('../models/reservation.model');
const { Created, OK } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const { createNotification, notifyAdmins } = require('../services/notification.service');

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
const clampAmount = (value, max) => Math.min(Math.max(Number(value) || 0, 0), max);
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
        .populate('tenantId', 'fullName email phone avatar cccdNumber verificationStatus')
        .populate('landlordId', 'fullName email phone avatar cccdNumber verificationStatus');

const formatDeposit = (deposit) => ({
    ...deposit._doc,
    room: deposit.roomId,
    tenant: deposit.tenantId,
    landlord: deposit.landlordId,
});

const depositLink = (tab) => `/trang-ca-nhan?tab=${tab}`;

const getDepositRole = (deposit, userId, isAdmin = false) => {
    if (isAdmin) return 'admin';
    if (deposit.tenantId?.toString() === userId) return 'tenant';
    if (deposit.landlordId?.toString() === userId) return 'landlord';
    return '';
};

const pushTimeline = (deposit, { actorId = null, role = 'system', action, note = '' }) => {
    deposit.dispute = deposit.dispute || {};
    deposit.dispute.timeline = deposit.dispute.timeline || [];
    deposit.dispute.timeline.push({
        actorId,
        role,
        action,
        note: normalizeNote(note),
        createdAt: new Date(),
    });
};

const normalizeFiles = (files) => (Array.isArray(files) ? files.filter(Boolean).map((file) => String(file).trim()).filter(Boolean).slice(0, 10) : []);

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

const releasePartialHeldBalance = async (deposit, tenantAmount, landlordAmount) => {
    if (!deposit.balanceHeld) return;
    const total = Number(tenantAmount || 0) + Number(landlordAmount || 0);
    if (total !== deposit.amount) {
        throw new BadRequestError('Tong so tien xu ly tranh chap khong khop tien coc');
    }

    const updated = await modelDeposit.findOneAndUpdate(
        { _id: deposit._id, balanceHeld: true },
        { balanceHeld: false },
        { new: true },
    );
    if (!updated) return;

    deposit.balanceHeld = false;
    if (tenantAmount > 0) await modelUser.findByIdAndUpdate(deposit.tenantId, { $inc: { balance: tenantAmount } });
    if (landlordAmount > 0) await modelUser.findByIdAndUpdate(deposit.landlordId, { $inc: { balance: landlordAmount } });
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
        deposit.adminNote = 'Yêu cầu cọc hết hạn thanh toán';
        await deposit.save();
    }
};

const markDepositPaid = async (depositId, expectedAmount = null) => {
    const deposit = await modelDeposit.findById(depositId);
    if (!deposit) throw new BadRequestError('Giao dịch cọc không tồn tại');
    if (deposit.status !== 'pending') return deposit;
    if (expectedAmount !== null && Number(expectedAmount) !== deposit.amount) {
        throw new BadRequestError('Số tiền thanh toán cọc không khớp');
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
        deposit.adminNote = 'Phòng không còn trong khi xác nhận thanh toán';
        await deposit.save();
        await releaseHeldBalance(deposit, deposit.tenantId);
        throw new BadRequestError('Phòng không còn trong');
    }

    deposit.paymentStatus = 'paid';
    deposit.status = 'holding';
    deposit.balanceHeld = true;
    deposit.expiredAt = getHoldingExpiredAt();
    await deposit.save();
    await createNotification(
        deposit.tenantId,
        'Đặt cọc thành công',
        'Thanh toán đặt cọc của bạn đã được ghi nhận',
        'deposit',
        depositLink('tenant-deposits'),
        { depositId: deposit._id, roomId: deposit.roomId },
    );
    await createNotification(
        deposit.landlordId,
        'Có người đặt cọc phòng',
        'Một người thuê vừa đặt cọc phòng của bạn',
        'deposit',
        depositLink('landlord-deposits'),
        { depositId: deposit._id, roomId: deposit.roomId },
    );
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

        if (!mongoose.isValidObjectId(roomId)) throw new BadRequestError('Phòng không hợp lệ');
        if (!PAYMENT_METHODS.includes(paymentMethod)) throw new BadRequestError('Phương thức thanh toán không hợp lệ');

        const room = await modelPost.findById(roomId);
        if (!room || !['active', 'approved'].includes(room.status) || room.isDeleted) {
            throw new BadRequestError('Phòng không tồn tại hoặc chưa được hiển thị');
        }
        if ((room.availabilityStatus || 'available') !== 'available') throw new BadRequestError('Phòng hiện không còn trống');
        if (room.userId.toString() === tenantId) throw new BadRequestError('Bạn không thể đặt cọc phòng của chính mình');

        const viewedReservation = await modelReservation.findOne({
            postId: roomId,
            tenantId,
            status: 'viewed',
        });
        if (!viewedReservation) throw new BadRequestError('Bạn cần hoàn tất lịch xem phòng trước khi đặt cọc');

        const depositAmount = calculateDepositAmount(room.price);
        if (!Number.isFinite(depositAmount) || depositAmount <= 0) throw new BadRequestError('Giá phòng không hợp lệ để tính tiền cọc');

        const activeDeposit = await modelDeposit.findOne({ roomId, status: { $in: ACTIVE_STATUSES } });
        if (activeDeposit) throw new BadRequestError('Phòng đã có giao dịch cọc đang xử lý');

        let walletCharged = false;
        if (paymentMethod === 'SIMULATED') {
            const tenant = await modelUser.findOneAndUpdate(
                { _id: tenantId, balance: { $gte: depositAmount } },
                { $inc: { balance: -depositAmount } },
                { new: true },
            );
            if (!tenant) throw new BadRequestError('Số dư không đủ để đặt cọc');
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
            await createNotification(
                room.userId,
                'Có yêu cầu đặt cọc mới',
                `Người thuê vừa tạo yêu cầu đặt cọc cho phòng "${room.title || 'của bạn'}"`,
                'deposit',
                depositLink('landlord-deposits'),
                { depositId: deposit._id, roomId },
            );
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
        if (!deposit || deposit.tenantId.toString() !== req.user.id) throw new BadRequestError('Bạn không có quyền xác nhận giao dịch này');
        if (deposit.status !== 'holding') throw new BadRequestError('Giao dịch không ở trạng thái giữ cọc');
        deposit.tenantConfirm = true;
        await deposit.save();
        await completeIfConfirmed(deposit);
        new OK({ message: 'Đã xác nhận nhận phòng', metadata: deposit }).send(res);
    }

    async landlordConfirm(req, res) {
        const deposit = await modelDeposit.findById(req.body.depositId);
        if (!deposit || deposit.landlordId.toString() !== req.user.id) throw new BadRequestError('Bạn không có quyền xác nhận giao dịch này');
        if (deposit.status !== 'holding') throw new BadRequestError('Giao dịch không ở trạng thái giữ cọc');
        deposit.landlordConfirm = true;
        await deposit.save();
        await completeIfConfirmed(deposit);
        await createNotification(
            deposit.tenantId,
            'Chủ trọ đã xác nhận đặt cọc',
            'Chủ trọ đã xác nhận giao dịch đặt cọc của bạn',
            'deposit',
            depositLink('tenant-deposits'),
            { depositId: deposit._id, roomId: deposit.roomId },
        );
        new OK({ message: 'Đã xác nhận cho thuê', metadata: deposit }).send(res);
    }

    async cancelDeposit(req, res) {
        const deposit = await modelDeposit.findById(req.body.depositId);
        if (!deposit || deposit.tenantId.toString() !== req.user.id) throw new BadRequestError('ạn không có quyền hủy giao dịch này');
        if (deposit.status !== 'pending') throw new BadRequestError('Chỉ có thể hủy yêu cầu chưa thanh toán');
        deposit.status = 'cancelled';
        await deposit.save();
        await releaseHeldBalance(deposit, deposit.tenantId);
        new OK({ message: 'Đã hủy yêu cầu cọc', metadata: deposit }).send(res);
    }

    async disputeDeposit(req, res) {
        const deposit = await modelDeposit.findById(req.body.depositId);
        if (!deposit) throw new BadRequestError('Giao dich coc khong ton tai');
        const role = getDepositRole(deposit, req.user.id);
        if (!role || deposit.status !== 'holding') throw new BadRequestError('Khong the mo tranh chap giao dich nay');
        const note = normalizeNote(req.body.note);
        const files = normalizeFiles(req.body.files);
        deposit.status = 'disputed';
        deposit.adminNote = note;
        deposit.dispute = {
            ...(deposit.dispute || {}),
            openedBy: req.user.id,
            openedByRole: role,
            reason: note,
            openedAt: new Date(),
            evidences: [
                ...((deposit.dispute && deposit.dispute.evidences) || []),
                ...(note || files.length ? [{ submittedBy: req.user.id, role, note, files, createdAt: new Date() }] : []),
            ],
            messages: (deposit.dispute && deposit.dispute.messages) || [],
            timeline: (deposit.dispute && deposit.dispute.timeline) || [],
        };
        pushTimeline(deposit, { actorId: req.user.id, role, action: 'open_dispute', note });
        await deposit.save();
        await notifyAdmins(
            'Có tranh chấp đặt cọc',
            'Một giao dịch đặt cọc vừa được chuyển sang trạng thái tranh chấp',
            'deposit',
            '/admin?type=deposits',
            { depositId: deposit._id, roomId: deposit.roomId },
        );
        new OK({ message: 'Đã chuyển giao dịch sang tranh chấp', metadata: deposit }).send(res);
    }

    async addDisputeEvidence(req, res) {
        const deposit = await modelDeposit.findById(req.body.depositId);
        if (!deposit) throw new BadRequestError('Giao dich coc khong ton tai');
        const role = getDepositRole(deposit, req.user.id);
        if (!role || deposit.status !== 'disputed') throw new BadRequestError('Khong the gui bang chung cho giao dich nay');

        const note = normalizeNote(req.body.note);
        const files = normalizeFiles(req.body.files);
        if (!note && !files.length) throw new BadRequestError('Vui long nhap ghi chu hoac tai len bang chung');

        deposit.dispute = deposit.dispute || {};
        deposit.dispute.evidences = deposit.dispute.evidences || [];
        deposit.dispute.evidences.push({ submittedBy: req.user.id, role, note, files, createdAt: new Date() });
        pushTimeline(deposit, { actorId: req.user.id, role, action: 'add_evidence', note });
        await deposit.save();
        await notifyAdmins(
            'Co bang chung tranh chap moi',
            'Mot ben vua bo sung bang chung cho giao dich dat coc dang tranh chap',
            'deposit',
            '/admin?type=deposits',
            { depositId: deposit._id, roomId: deposit.roomId },
        );
        new OK({ message: 'Da gui bang chung tranh chap', metadata: deposit }).send(res);
    }

    async addDisputeMessage(req, res) {
        const deposit = await modelDeposit.findById(req.body.depositId);
        if (!deposit) throw new BadRequestError('Giao dich coc khong ton tai');
        const role = getDepositRole(deposit, req.user.id, ['admin', 'super_admin'].includes(req.user.role));
        if (!role || deposit.status !== 'disputed') throw new BadRequestError('Khong the nhan tin trong tranh chap nay');

        const chatMessage = normalizeNote(req.body.message);
        if (!chatMessage) throw new BadRequestError('Vui long nhap noi dung tin nhan');

        deposit.dispute = deposit.dispute || {};
        deposit.dispute.messages = deposit.dispute.messages || [];
        deposit.dispute.messages.push({ senderId: req.user.id, role, message: chatMessage, createdAt: new Date() });
        pushTimeline(deposit, { actorId: req.user.id, role, action: 'send_message', note: chatMessage });
        await deposit.save();

        const notifyUserIds = [deposit.tenantId, deposit.landlordId].filter((userId) => userId.toString() !== req.user.id);
        await Promise.all(
            notifyUserIds.map((userId) =>
                createNotification(
                    userId,
                    'Co tin nhan tranh chap dat coc',
                    'Giao dich dat coc dang tranh chap vua co tin nhan moi',
                    'deposit',
                    depositLink(userId.toString() === deposit.tenantId.toString() ? 'tenant-deposits' : 'landlord-deposits'),
                    { depositId: deposit._id, roomId: deposit.roomId },
                ),
            ),
        );

        new OK({ message: 'Da gui tin nhan tranh chap', metadata: deposit }).send(res);
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
            deposit.dispute = deposit.dispute || {};
            deposit.dispute.resolution = {
                decidedBy: req.user.id,
                action: 'refund',
                refundAmount: deposit.amount,
                releaseAmount: 0,
                note: deposit.adminNote,
                decidedAt: new Date(),
            };
            pushTimeline(deposit, { actorId: req.user.id, role: 'admin', action: 'resolve_refund', note: deposit.adminNote });
            await releaseRoom(deposit.roomId);
            await releaseHeldBalance(deposit, deposit.tenantId);
        } else if (action === 'release') {
            if (!['holding', 'disputed'].includes(deposit.status)) throw new BadRequestError('Không thể giải ngân giao dịch này');
            if (deposit.paymentStatus !== 'paid') throw new BadRequestError('Giao dịch chưa thanh toán');
            deposit.status = 'completed';
            deposit.tenantConfirm = true;
            deposit.landlordConfirm = true;
            deposit.dispute = deposit.dispute || {};
            deposit.dispute.resolution = {
                decidedBy: req.user.id,
                action: 'release',
                refundAmount: 0,
                releaseAmount: deposit.amount,
                note: deposit.adminNote,
                decidedAt: new Date(),
            };
            pushTimeline(deposit, { actorId: req.user.id, role: 'admin', action: 'resolve_release', note: deposit.adminNote });
            await releaseHeldBalance(deposit, deposit.landlordId);
            await modelPost.findByIdAndUpdate(deposit.roomId, { availabilityStatus: 'rented' });
        } else if (action === 'split') {
            if (deposit.status !== 'disputed') throw new BadRequestError('Chi co the chia tien voi giao dich dang tranh chap');
            if (deposit.paymentStatus !== 'paid') throw new BadRequestError('Giao dịch chưa thanh toán');
            const refundAmount = clampAmount(req.body.refundAmount, deposit.amount);
            const releaseAmount = deposit.amount - refundAmount;
            deposit.status = releaseAmount > 0 ? 'completed' : 'refunded';
            deposit.tenantConfirm = releaseAmount > 0;
            deposit.landlordConfirm = releaseAmount > 0;
            deposit.dispute = deposit.dispute || {};
            deposit.dispute.resolution = {
                decidedBy: req.user.id,
                action: 'split',
                refundAmount,
                releaseAmount,
                note: deposit.adminNote,
                decidedAt: new Date(),
            };
            pushTimeline(deposit, {
                actorId: req.user.id,
                role: 'admin',
                action: 'resolve_split',
                note: `Hoan nguoi thue ${refundAmount}, chuyen chu tro ${releaseAmount}. ${deposit.adminNote}`,
            });
            await releasePartialHeldBalance(deposit, refundAmount, releaseAmount);
            if (releaseAmount > 0) {
                await modelPost.findByIdAndUpdate(deposit.roomId, { availabilityStatus: 'rented' });
            } else {
                await releaseRoom(deposit.roomId);
            }
        } else if (action === 'dispute') {
            if (!['pending', 'holding'].includes(deposit.status)) throw new BadRequestError('Không thể chuyển tranh chấp giao dịch này');
            deposit.status = 'disputed';
            deposit.dispute = {
                ...(deposit.dispute || {}),
                openedBy: req.user.id,
                openedByRole: 'admin',
                reason: deposit.adminNote,
                openedAt: new Date(),
            };
            pushTimeline(deposit, { actorId: req.user.id, role: 'admin', action: 'admin_open_dispute', note: deposit.adminNote });
        } else {
            throw new BadRequestError('Hành động admin không hợp lệ');
        }
        await deposit.save();
        await Promise.all([
            createNotification(
                deposit.tenantId,
                'Cap nhat tranh chap dat coc',
                'Admin vua cap nhat ket qua xu ly giao dich dat coc',
                'deposit',
                depositLink('tenant-deposits'),
                { depositId: deposit._id, roomId: deposit.roomId },
            ),
            createNotification(
                deposit.landlordId,
                'Cap nhat tranh chap dat coc',
                'Admin vua cap nhat ket qua xu ly giao dich dat coc',
                'deposit',
                depositLink('landlord-deposits'),
                { depositId: deposit._id, roomId: deposit.roomId },
            ),
        ]);
        new OK({ message: 'Đã cập nhật giao dịch cọc', metadata: deposit }).send(res);
    }
}

module.exports = new controllerDeposit();
