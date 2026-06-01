const modelFilterOption = require('../models/filterOption.model');
const { Created, OK } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const {
    FILTER_FIELDS,
    NUMERIC_FIELDS,
    ENUM_VALUES,
    ensureDefaultFilterOptions,
} = require('../services/filterOption.service');

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeNullableNumber = (value) => (value === '' || value === null || value === undefined ? null : Number(value));

const validatePayload = (body) => {
    const field = normalizeText(body.field);
    const value = normalizeText(body.value);
    const label = normalizeText(body.label);
    const description = normalizeText(body.description);
    const minValue = normalizeNullableNumber(body.minValue);
    const maxValue = normalizeNullableNumber(body.maxValue);
    const sortOrder = Number(body.sortOrder || 0);

    if (!FILTER_FIELDS.includes(field) || !value || !label) {
        throw new BadRequestError('Nhóm lọc, giá trị và nhãn hiển thị là bắt buộc');
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
        throw new BadRequestError('Giá trị bộ lọc chỉ gồm chữ thường, số và dấu gạch ngang');
    }
    if (label.length > 120 || description.length > 300 || !Number.isFinite(sortOrder)) {
        throw new BadRequestError('Thông tin bộ lọc không hợp lệ');
    }
    if (ENUM_VALUES[field] && !ENUM_VALUES[field].includes(value)) {
        throw new BadRequestError('Giá trị không phù hợp với dữ liệu bài đăng');
    }
    if (NUMERIC_FIELDS.includes(field)) {
        if ((minValue === null && maxValue === null) || (minValue !== null && !Number.isFinite(minValue)) || (maxValue !== null && !Number.isFinite(maxValue))) {
            throw new BadRequestError('Khoảng lọc cần ít nhất một cận số hợp lệ');
        }
        if ((minValue !== null && minValue < 0) || (maxValue !== null && maxValue <= 0) || (minValue !== null && maxValue !== null && minValue >= maxValue)) {
            throw new BadRequestError('Cận trên phải lớn hơn cận dưới và không được âm');
        }
    }

    return {
        field,
        value,
        label,
        description,
        minValue: NUMERIC_FIELDS.includes(field) ? minValue : null,
        maxValue: NUMERIC_FIELDS.includes(field) ? maxValue : null,
        sortOrder,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    };
};

class controllerFilterOption {
    async getPublicOptions(req, res) {
        await ensureDefaultFilterOptions();
        const options = await modelFilterOption.find({ isActive: true }).sort({ field: 1, sortOrder: 1, createdAt: 1 });
        new OK({ message: 'Lấy bộ lọc thành công', metadata: options }).send(res);
    }

    async getAdminOptions(req, res) {
        await ensureDefaultFilterOptions();
        const filter = {};
        if (req.query.field) {
            if (!FILTER_FIELDS.includes(req.query.field)) {
                throw new BadRequestError('Nhóm bộ lọc không hợp lệ');
            }
            filter.field = req.query.field;
        }
        const options = await modelFilterOption.find(filter).sort({ field: 1, sortOrder: 1, createdAt: 1 });
        new OK({ message: 'Lấy cấu hình bộ lọc thành công', metadata: options }).send(res);
    }

    async createOption(req, res) {
        const payload = validatePayload(req.body);
        const exists = await modelFilterOption.exists({ field: payload.field, value: payload.value });
        if (exists) {
            throw new BadRequestError('Giá trị bộ lọc đã tồn tại trong nhóm này');
        }
        const option = await modelFilterOption.create(payload);
        new Created({ message: 'Tạo bộ lọc thành công', metadata: option }).send(res);
    }

    async updateOption(req, res) {
        const { id } = req.body;
        if (!id) throw new BadRequestError('Id bộ lọc là bắt buộc');
        const payload = validatePayload(req.body);
        const duplicated = await modelFilterOption.exists({ _id: { $ne: id }, field: payload.field, value: payload.value });
        if (duplicated) {
            throw new BadRequestError('Giá trị bộ lọc đã tồn tại trong nhóm này');
        }
        const option = await modelFilterOption.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
        if (!option) throw new BadRequestError('Bộ lọc không tồn tại');
        new OK({ message: 'Cập nhật bộ lọc thành công', metadata: option }).send(res);
    }

    async toggleOption(req, res) {
        const { id, isActive } = req.body;
        if (!id || typeof isActive !== 'boolean') {
            throw new BadRequestError('Id và trạng thái bộ lọc là bắt buộc');
        }
        const option = await modelFilterOption.findByIdAndUpdate(id, { isActive }, { new: true });
        if (!option) throw new BadRequestError('Bộ lọc không tồn tại');
        new OK({ message: isActive ? 'Đã bật bộ lọc' : 'Đã tắt bộ lọc', metadata: option }).send(res);
    }
}

module.exports = new controllerFilterOption();
