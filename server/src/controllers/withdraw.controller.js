const modelWithdrawRequest = require('../models/withdrawRequest.model');
const modelUser = require('../models/users.model');
const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');

const MIN_WITHDRAW_AMOUNT = 50000;

const parseAmount = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAW_AMOUNT) {
        throw new BadRequestError(`Số tiền rút tối thiểu là ${MIN_WITHDRAW_AMOUNT.toLocaleString('vi-VN')} VNĐ`);
    }
    return Math.round(amount);
};

const populateRequest = (query) => query.populate('userId', 'fullName email phone balance holdBalance').populate('handledBy', 'fullName email');

const formatRequest = (request) => ({
    ...(request.toObject ? request.toObject() : request._doc),
    user: request.userId,
    handledAdmin: request.handledBy,
});

class controllerWithdraw {
    async createWithdrawRequest(req, res) {
        const { id: userId } = req.user;
        const { amount, bankName, bankAccountNumber, bankAccountName, note } = req.body;
        const withdrawAmount = parseAmount(amount);

        if (!bankName?.trim() || !bankAccountNumber?.trim() || !bankAccountName?.trim()) {
            throw new BadRequestError('Vui lòng nhập đầy đủ thông tin ngân hàng');
        }

        const user = await modelUser.findOneAndUpdate(
            { _id: userId, balance: { $gte: withdrawAmount } },
            { $inc: { balance: -withdrawAmount, holdBalance: withdrawAmount } },
            { new: true },
        );

        if (!user) {
            throw new BadRequestError('Số dư khả dụng không đủ để tạo yêu cầu rút tiền');
        }

        try {
            const request = await modelWithdrawRequest.create({
                userId,
                amount: withdrawAmount,
                bankName: bankName.trim(),
                bankAccountNumber: bankAccountNumber.trim(),
                bankAccountName: bankAccountName.trim(),
                note: String(note || '').trim(),
                status: 'pending',
            });

            new Created({ message: 'Đã tạo yêu cầu rút tiền', metadata: request }).send(res);
        } catch (error) {
            await modelUser.findByIdAndUpdate(userId, { $inc: { balance: withdrawAmount, holdBalance: -withdrawAmount } });
            throw error;
        }
    }

    async getMyWithdrawRequests(req, res) {
        const { id: userId } = req.user;
        const requests = await modelWithdrawRequest.find({ userId }).sort({ createdAt: -1 });
        new OK({ message: 'Lấy danh sách yêu cầu rút tiền thành công', metadata: requests }).send(res);
    }

    async cancelWithdrawRequest(req, res) {
        const { id: userId } = req.user;
        const { id } = req.params;
        const request = await modelWithdrawRequest.findOne({ _id: id, userId });
        if (!request) throw new BadRequestError('Yêu cầu rút tiền không tồn tại');
        if (request.status !== 'pending') throw new BadRequestError('Chỉ có thể hủy yêu cầu đang chờ duyệt');

        const user = await modelUser.findOneAndUpdate(
            { _id: userId, holdBalance: { $gte: request.amount } },
            { $inc: { balance: request.amount, holdBalance: -request.amount } },
            { new: true },
        );
        if (!user) throw new BadRequestError('Số dư đang giữ không hợp lệ');

        request.status = 'cancelled';
        request.handledAt = new Date();
        await request.save();

        new OK({ message: 'Đã hủy yêu cầu rút tiền và hoàn lại số dư', metadata: request }).send(res);
    }

    async getAdminWithdrawRequests(req, res) {
        const { status } = req.query;
        const filter = status ? { status } : {};
        const requests = await populateRequest(modelWithdrawRequest.find(filter).sort({ createdAt: -1 }));
        new OK({ message: 'Lấy danh sách yêu cầu rút tiền thành công', metadata: requests.map(formatRequest) }).send(res);
    }

    async adminAction(req, res) {
        const { id: adminId } = req.user;
        const { id } = req.params;
        const { action, adminNote } = req.body;

        const request = await modelWithdrawRequest.findById(id);
        if (!request) throw new BadRequestError('Yêu cầu rút tiền không tồn tại');

        if (action === 'approve') {
            if (request.status !== 'pending') throw new BadRequestError('Chỉ duyệt yêu cầu đang chờ');
            request.status = 'approved';
            request.handledBy = adminId;
            request.handledAt = new Date();
            request.adminNote = String(adminNote || '').trim();
            await request.save();
            return new OK({ message: 'Đã duyệt yêu cầu rút tiền', metadata: request }).send(res);
        }

        if (action === 'complete') {
            if (!['pending', 'approved'].includes(request.status)) throw new BadRequestError('Yêu cầu không thể hoàn tất');
            const user = await modelUser.findOneAndUpdate(
                { _id: request.userId, holdBalance: { $gte: request.amount } },
                { $inc: { holdBalance: -request.amount } },
                { new: true },
            );
            if (!user) throw new BadRequestError('Số dư đang giữ không hợp lệ');
            request.status = 'completed';
            request.handledBy = adminId;
            request.handledAt = request.handledAt || new Date();
            request.completedAt = new Date();
            request.adminNote = String(adminNote || request.adminNote || '').trim();
            await request.save();
            return new OK({ message: 'Đã xác nhận chuyển khoản thành công', metadata: request }).send(res);
        }

        if (action === 'reject') {
            if (!['pending', 'approved'].includes(request.status)) throw new BadRequestError('Yêu cầu không thể từ chối');
            const user = await modelUser.findOneAndUpdate(
                { _id: request.userId, holdBalance: { $gte: request.amount } },
                { $inc: { balance: request.amount, holdBalance: -request.amount } },
                { new: true },
            );
            if (!user) throw new BadRequestError('Số dư đang giữ không hợp lệ');
            request.status = 'rejected';
            request.handledBy = adminId;
            request.handledAt = new Date();
            request.adminNote = String(adminNote || '').trim();
            await request.save();
            return new OK({ message: 'Đã từ chối yêu cầu và hoàn lại số dư', metadata: request }).send(res);
        }

        throw new BadRequestError('Thao tác không hợp lệ');
    }
}

module.exports = new controllerWithdraw();
