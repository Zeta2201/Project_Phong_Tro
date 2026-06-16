const mongoose = require('mongoose');
const modelPostingPlan = require('../models/postingPlan.model');
const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const { ensureDefaultPostingPlans, getActivePostingPlans, getAllPostingPlans } = require('../services/postingPlan.service');

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeBenefits = (value) => (Array.isArray(value) ? value.map(normalizeText).filter(Boolean).slice(0, 8) : []);

const buildPayload = (body) => {
    const typeNews = normalizeText(body.typeNews);
    const durationDays = Number(body.durationDays);
    const price = Number(body.price);
    const sortOrder = body.sortOrder === undefined || body.sortOrder === '' ? 0 : Number(body.sortOrder);

    if (!['vip', 'normal'].includes(typeNews)) throw new BadRequestError('Loai tin khong hop le');
    if (!Number.isInteger(durationDays) || durationDays <= 0) throw new BadRequestError('Thoi gian dang khong hop le');
    if (!Number.isFinite(price) || price < 0) throw new BadRequestError('Gia goi dang tin khong hop le');
    if (!Number.isFinite(sortOrder)) throw new BadRequestError('Thu tu sap xep khong hop le');

    return {
        typeNews,
        name: normalizeText(body.name) || (typeNews === 'vip' ? 'Tin VIP' : 'Tin thường'),
        label: normalizeText(body.label),
        description: normalizeText(body.description),
        durationDays,
        price,
        benefits: normalizeBenefits(body.benefits),
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        sortOrder,
    };
};

class controllerPostingPlan {
    async getPublicPlans(req, res) {
        const plans = await getActivePostingPlans();
        new OK({ message: 'Lấy gói đăng tin thành công', metadata: plans }).send(res);
    }

    async getAdminPlans(req, res) {
        const plans = await getAllPostingPlans();
        new OK({ message: 'Lấy tất cả gói đăng tin thành công', metadata: plans }).send(res);
    }

    async createPlan(req, res) {
        await ensureDefaultPostingPlans();
        const payload = buildPayload(req.body);
        try {
            const plan = await modelPostingPlan.create(payload);
            new Created({ message: 'Tạo gói đăng tin thành công', metadata: plan }).send(res);
        } catch (error) {
            if (error.code === 11000) throw new BadRequestError('Gói đăng tin đã tồn tại');
            throw error;
        }
    }

    async updatePlan(req, res) {
        const { id } = req.body;
        if (!mongoose.isValidObjectId(id)) throw new BadRequestError('Goi dang tin khong hop le');

        const payload = buildPayload(req.body);
        try {
            const plan = await modelPostingPlan.findByIdAndUpdate(id, payload, { new: true });
            if (!plan) throw new BadRequestError('Gói đăng tin không tồn tại');
            new OK({ message: 'Đã cập nhật gói đăng tin thành công', metadata: plan }).send(res);
        } catch (error) {
            if (error.code === 11000) throw new BadRequestError('Gói đăng tin đã tồn tại');
            throw error;
        }
    }

    async togglePlan(req, res) {
        const { id, isActive } = req.body;
        if (!mongoose.isValidObjectId(id)) throw new BadRequestError('Gói đăng tin không hợp lệ');

        const plan = await modelPostingPlan.findByIdAndUpdate(id, { isActive: Boolean(isActive) }, { new: true });
        if (!plan) throw new BadRequestError('ói đăng tin không tồn tại');
        new OK({ message: isActive ? 'Đã bật gói đăng tin' : 'Đã tắt gói đăng tin', metadata: plan }).send(res);
    }
}

module.exports = new controllerPostingPlan();
