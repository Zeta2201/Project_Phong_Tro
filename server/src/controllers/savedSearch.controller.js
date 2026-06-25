const modelSavedSearch = require('../models/savedSearch.model');
const { Created, OK } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');

const normalizeCriteria = (criteria = {}) => ({
    category: criteria.category || '',
    priceRange: criteria.priceRange || '',
    areaRange: criteria.areaRange || '',
    typeNews: criteria.typeNews || '',
    province: criteria.province || '',
    keyword: criteria.keyword || '',
});

class SavedSearchController {
    async create(req, res) {
        const criteria = normalizeCriteria(req.body.criteria || {});
        const hasCriteria = Object.values(criteria).some((value) => String(value || '').trim());
        if (!hasCriteria) {
            throw new BadRequestError('Vui lòng chọn ít nhất một tiêu chí để lưu tìm kiếm');
        }

        const savedSearch = await modelSavedSearch.create({
            userId: req.user.id,
            name: req.body.name || 'Tìm kiếm phòng đã lưu',
            criteria,
            notifyInApp: req.body.notifyInApp !== false,
            notifyEmail: Boolean(req.body.notifyEmail),
        });

        new Created({ message: 'Đã lưu tìm kiếm', metadata: savedSearch }).send(res);
    }

    async getMine(req, res) {
        const savedSearches = await modelSavedSearch.find({ userId: req.user.id }).sort({ createdAt: -1 });
        new OK({ message: 'Đã lấy danh sách tìm kiếm đã lưu', metadata: savedSearches }).send(res);
    }

    async update(req, res) {
        const savedSearch = await modelSavedSearch.findOne({ _id: req.params.id, userId: req.user.id });
        if (!savedSearch) throw new BadRequestError('Không tìm thấy tìm kiếm đã lưu');

        if (req.body.name !== undefined) savedSearch.name = req.body.name;
        if (req.body.criteria) savedSearch.criteria = normalizeCriteria(req.body.criteria);
        if (req.body.notifyInApp !== undefined) savedSearch.notifyInApp = Boolean(req.body.notifyInApp);
        if (req.body.notifyEmail !== undefined) savedSearch.notifyEmail = Boolean(req.body.notifyEmail);
        if (req.body.isActive !== undefined) savedSearch.isActive = Boolean(req.body.isActive);

        await savedSearch.save();
        new OK({ message: 'Đã cập nhật tìm kiếm đã lưu', metadata: savedSearch }).send(res);
    }

    async remove(req, res) {
        const deleted = await modelSavedSearch.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!deleted) throw new BadRequestError('Không tìm thấy tìm kiếm đã lưu');
        new OK({ message: 'Đã xóa tìm kiếm đã lưu', metadata: deleted }).send(res);
    }
}

module.exports = new SavedSearchController();
