const mongoose = require('mongoose');
const modelVoucher = require('../models/voucher.model');
const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const { normalizeVoucherCode, previewVoucher } = require('../utils/voucher');
const { createBroadcastNotification } = require('../services/notification.service');

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeApplicableTypes = (value) => {
    const types = Array.isArray(value) ? value : [];
    const validTypes = types.filter((type) => ['normal', 'vip'].includes(type));
    return validTypes.length ? [...new Set(validTypes)] : ['normal', 'vip'];
};

const parseOptionalDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestError('Thời gian voucher không hợp lệ');
    return date;
};

const buildVoucherPayload = (body) => {
    const code = normalizeVoucherCode(body.code);
    const name = normalizeString(body.name);
    const discountType = normalizeString(body.discountType);
    const discountValue = Number(body.discountValue);
    const maxDiscount = body.maxDiscount === undefined || body.maxDiscount === '' ? 0 : Number(body.maxDiscount);
    const minOrderValue = body.minOrderValue === undefined || body.minOrderValue === '' ? 0 : Number(body.minOrderValue);
    const usageLimit = body.usageLimit === undefined || body.usageLimit === '' ? 0 : Number(body.usageLimit);
    const usageLimitPerUser =
        body.usageLimitPerUser === undefined || body.usageLimitPerUser === '' ? 1 : Number(body.usageLimitPerUser);

    if (!code) throw new BadRequestError('Vui lòng nhập mã voucher');
    if (!name) throw new BadRequestError('Vui lòng nhập tên voucher');
    if (!['percent', 'fixed'].includes(discountType)) throw new BadRequestError('Loại giảm giá không hợp lệ');
    if (!Number.isFinite(discountValue) || discountValue <= 0) throw new BadRequestError('Giá trị giảm không hợp lệ');
    if (discountType === 'percent' && discountValue > 100) throw new BadRequestError('Phần trăm giảm không được vượt quá 100%');
    if (![maxDiscount, minOrderValue, usageLimit, usageLimitPerUser].every((value) => Number.isFinite(value) && value >= 0)) {
        throw new BadRequestError('Thiết lập giới hạn voucher không hợp lệ');
    }

    const startAt = parseOptionalDate(body.startAt);
    const endAt = parseOptionalDate(body.endAt);
    if (startAt && endAt && startAt > endAt) throw new BadRequestError('Ngày bắt đầu phải trước ngày kết thúc');

    return {
        code,
        name,
        description: normalizeString(body.description),
        discountType,
        discountValue,
        maxDiscount,
        minOrderValue,
        applicableTypes: normalizeApplicableTypes(body.applicableTypes),
        startAt,
        endAt,
        usageLimit,
        usageLimitPerUser,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    };
};

class VoucherController {
    async validateVoucher(req, res) {
        const { id: userId } = req.user;
        const { code, typeNews, orderValue } = req.body;
        const parsedOrderValue = Number(orderValue);
        if (!code || !['normal', 'vip'].includes(typeNews) || !Number.isFinite(parsedOrderValue) || parsedOrderValue < 0) {
            throw new BadRequestError('Thông tin voucher không hợp lệ');
        }

        const result = await previewVoucher({ code, userId, typeNews, orderValue: parsedOrderValue });
        new OK({
            message: 'Voucher hợp lệ',
            metadata: {
                code: result.voucher.code,
                name: result.voucher.name,
                discountAmount: result.discountAmount,
                finalAmount: result.finalAmount,
            },
        }).send(res);
    }

    async getAdminVouchers(req, res) {
        const vouchers = await modelVoucher.find().sort({ createdAt: -1 });
        new OK({ message: 'Lấy danh sách voucher thành công', metadata: vouchers }).send(res);
    }

    async createVoucher(req, res) {
        const payload = buildVoucherPayload(req.body);
        try {
            const voucher = await modelVoucher.create(payload);
            if (voucher.isActive) {
                await createBroadcastNotification(
                    'all',
                    'Có voucher mới',
                    `Voucher "${voucher.name}" vừa được phát hành`,
                    'voucher',
                    '/trang-ca-nhan?tab=rewards',
                    { voucherId: voucher._id, code: voucher.code },
                    req.user.id,
                );
            }
            new Created({ message: 'Tạo voucher thành công', metadata: voucher }).send(res);
        } catch (error) {
            if (error.code === 11000) throw new BadRequestError('Mã voucher đã tồn tại');
            throw error;
        }
    }

    async updateVoucher(req, res) {
        const { id } = req.body;
        if (!mongoose.isValidObjectId(id)) throw new BadRequestError('Voucher không hợp lệ');

        const payload = buildVoucherPayload(req.body);
        try {
            const voucher = await modelVoucher.findByIdAndUpdate(id, payload, { new: true });
            if (!voucher) throw new BadRequestError('Voucher không tồn tại');
            new OK({ message: 'Cập nhật voucher thành công', metadata: voucher }).send(res);
        } catch (error) {
            if (error.code === 11000) throw new BadRequestError('Mã voucher đã tồn tại');
            throw error;
        }
    }

    async toggleVoucher(req, res) {
        const { id, isActive } = req.body;
        if (!mongoose.isValidObjectId(id)) throw new BadRequestError('Voucher không hợp lệ');

        const voucher = await modelVoucher.findByIdAndUpdate(id, { isActive: Boolean(isActive) }, { new: true });
        if (!voucher) throw new BadRequestError('Voucher không tồn tại');
        new OK({ message: isActive ? 'Đã bật voucher' : 'Đã tắt voucher', metadata: voucher }).send(res);
    }
}

module.exports = new VoucherController();
