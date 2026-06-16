const mongoose = require('mongoose');
const modelBanner = require('../models/banner.model');
const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const parseOptionalDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestError('Thời gian banner không hợp lệ');
    return date;
};

const buildBannerPayload = (body) => {
    const title = normalizeString(body.title);
    const priority = body.priority === undefined || body.priority === '' ? 0 : Number(body.priority);
    const startAt = parseOptionalDate(body.startAt);
    const endAt = parseOptionalDate(body.endAt);

    if (!title) throw new BadRequestError('Vui lòng nhập tiêu đề banner');
    if (!Number.isFinite(priority)) throw new BadRequestError('Độ ưu tiên banner không hợp lệ');
    if (startAt && endAt && startAt > endAt) throw new BadRequestError('Ngày bắt đầu phải trước ngày kết thúc');

    return {
        title,
        subtitle: normalizeString(body.subtitle),
        badgeText: normalizeString(body.badgeText),
        ctaText: normalizeString(body.ctaText) || 'Xem ngay',
        ctaLink: normalizeString(body.ctaLink) || '/trang-ca-nhan?tab=posts',
        imageUrl: normalizeString(body.imageUrl),
        voucherCode: normalizeString(body.voucherCode).toUpperCase(),
        startAt,
        endAt,
        priority,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    };
};

const buildActiveBannerFilter = () => {
    const now = new Date();
    return {
        isActive: true,
        $and: [
            { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
            { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
        ],
    };
};

class BannerController {
    async getActiveBanner(req, res) {
        const banner = await modelBanner.findOne(buildActiveBannerFilter()).sort({ priority: -1, createdAt: -1 });
        new OK({ message: 'Lấy banner thành công', metadata: banner }).send(res);
    }

    async getAdminBanners(req, res) {
        const banners = await modelBanner.find().sort({ priority: -1, createdAt: -1 });
        new OK({ message: 'Lấy danh sách banner thành công', metadata: banners }).send(res);
    }

    async createBanner(req, res) {
        const banner = await modelBanner.create(buildBannerPayload(req.body));
        new Created({ message: 'Tạo banner thành công', metadata: banner }).send(res);
    }

    async updateBanner(req, res) {
        const { id } = req.body;
        if (!mongoose.isValidObjectId(id)) throw new BadRequestError('Banner không hợp lệ');

        const banner = await modelBanner.findByIdAndUpdate(id, buildBannerPayload(req.body), { new: true });
        if (!banner) throw new BadRequestError('Banner không tồn tại');
        new OK({ message: 'Cập nhật banner thành công', metadata: banner }).send(res);
    }

    async toggleBanner(req, res) {
        const { id, isActive } = req.body;
        if (!mongoose.isValidObjectId(id)) throw new BadRequestError('Banner không hợp lệ');

        const banner = await modelBanner.findByIdAndUpdate(id, { isActive: Boolean(isActive) }, { new: true });
        if (!banner) throw new BadRequestError('Banner không tồn tại');
        new OK({ message: isActive ? 'Đã bật banner' : 'Đã tắt banner', metadata: banner }).send(res);
    }
}

module.exports = new BannerController();
