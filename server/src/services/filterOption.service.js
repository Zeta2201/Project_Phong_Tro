const modelFilterOption = require('../models/filterOption.model');

const FILTER_FIELDS = ['category', 'priceRange', 'areaRange', 'typeNews'];
const NUMERIC_FIELDS = ['priceRange', 'areaRange'];
const ENUM_VALUES = {
    category: ['phong-tro', 'nha-nguyen-can', 'can-ho-chung-cu', 'can-ho-mini'],
    typeNews: ['vip', 'normal'],
};

const DEFAULT_FILTER_OPTIONS = [
    { field: 'category', value: 'phong-tro', label: 'Phòng trọ', sortOrder: 10 },
    { field: 'category', value: 'nha-nguyen-can', label: 'Nhà nguyên căn', sortOrder: 20 },
    { field: 'category', value: 'can-ho-chung-cu', label: 'Căn hộ chung cư', sortOrder: 30 },
    { field: 'category', value: 'can-ho-mini', label: 'Căn hộ mini', sortOrder: 40 },
    { field: 'priceRange', value: 'duoi-1-trieu', label: 'Dưới 1 triệu', maxValue: 1000000, sortOrder: 10 },
    { field: 'priceRange', value: 'tu-1-2-trieu', label: '1 - 2 triệu', minValue: 1000000, maxValue: 2000000, sortOrder: 20 },
    { field: 'priceRange', value: 'tu-2-3-trieu', label: '2 - 3 triệu', minValue: 2000000, maxValue: 3000000, sortOrder: 30 },
    { field: 'priceRange', value: 'tu-3-5-trieu', label: '3 - 5 triệu', minValue: 3000000, maxValue: 5000000, sortOrder: 40 },
    { field: 'priceRange', value: 'tu-5-7-trieu', label: '5 - 7 triệu', minValue: 5000000, maxValue: 7000000, sortOrder: 50 },
    { field: 'priceRange', value: 'tu-7-10-trieu', label: '7 - 10 triệu', minValue: 7000000, maxValue: 10000000, sortOrder: 60 },
    { field: 'priceRange', value: 'tu-10-15-trieu', label: '10 - 15 triệu', minValue: 10000000, maxValue: 15000000, sortOrder: 70 },
    { field: 'priceRange', value: 'tren-15-trieu', label: 'Trên 15 triệu', minValue: 15000000, sortOrder: 80 },
    { field: 'areaRange', value: 'duoi-20', label: 'Dưới 20 m²', maxValue: 20, sortOrder: 10 },
    { field: 'areaRange', value: 'tu-20-30', label: '20 - 30 m²', minValue: 20, maxValue: 30, sortOrder: 20 },
    { field: 'areaRange', value: 'tu-30-50', label: '30 - 50 m²', minValue: 30, maxValue: 50, sortOrder: 30 },
    { field: 'areaRange', value: 'tu-50-70', label: '50 - 70 m²', minValue: 50, maxValue: 70, sortOrder: 40 },
    { field: 'areaRange', value: 'tu-70-90', label: '70 - 90 m²', minValue: 70, maxValue: 90, sortOrder: 50 },
    { field: 'areaRange', value: 'tren-90', label: 'Trên 90 m²', minValue: 90, sortOrder: 60 },
    {
        field: 'typeNews',
        value: 'vip',
        label: 'Tin nổi bật',
        description: 'Ưu tiên các tin chất lượng, dễ xem nhanh.',
        sortOrder: 10,
    },
    {
        field: 'typeNews',
        value: 'normal',
        label: 'Tin mới đăng',
        description: 'Theo dõi các lựa chọn vừa được cập nhật.',
        sortOrder: 20,
    },
];

const ensureDefaultFilterOptions = async () => {
    await modelFilterOption.bulkWrite(
        DEFAULT_FILTER_OPTIONS.map((option) => ({
            updateOne: {
                filter: { field: option.field, value: option.value },
                update: { $setOnInsert: option },
                upsert: true,
            },
        })),
    );
};

const buildNumericCondition = (option) => {
    const condition = {};
    if (option.minValue !== null && option.minValue !== undefined) condition.$gte = option.minValue;
    if (option.maxValue !== null && option.maxValue !== undefined) condition.$lt = option.maxValue;
    return condition;
};

const getActiveFilterOption = async (field, value) => {
    if (!value) return null;
    return modelFilterOption.findOne({ field, value, isActive: true });
};

module.exports = {
    FILTER_FIELDS,
    NUMERIC_FIELDS,
    ENUM_VALUES,
    ensureDefaultFilterOptions,
    buildNumericCondition,
    getActiveFilterOption,
};
