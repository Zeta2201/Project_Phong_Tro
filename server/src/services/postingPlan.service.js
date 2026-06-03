const modelPostingPlan = require('../models/postingPlan.model');

const DEFAULT_POSTING_PLANS = [
    {
        typeNews: 'normal',
        name: 'Tin thường',
        label: 'Tiết kiệm',
        description: 'Phù hợp với chủ trọ cần đăng tin ổn định, chi phí tiết kiệm.',
        benefits: ['Hiển thị trong danh sách tin mới', 'Có đầy đủ hình ảnh và thông tin phòng', 'Dễ quản lý trong trang cá nhân'],
        prices: [
            { durationDays: 3, price: 10000 },
            { durationDays: 7, price: 60000 },
            { durationDays: 30, price: 1000000 },
        ],
        sortOrder: 20,
    },
    {
        typeNews: 'vip',
        name: 'Tin VIP',
        label: 'Nổi bật',
        description: 'Tăng độ nổi bật cho phòng cần cho thuê nhanh và tiếp cận nhiều người hơn.',
        benefits: ['Ưu tiên xuất hiện ở khu vực nổi bật', 'Nhãn tin VIP giúp người thuê chú ý hơn', 'Phù hợp tin cần đẩy nhanh hiệu quả'],
        prices: [
            { durationDays: 3, price: 50000 },
            { durationDays: 7, price: 315000 },
            { durationDays: 30, price: 1200000 },
        ],
        sortOrder: 10,
    },
];

const ensureDefaultPostingPlans = async () => {
    const count = await modelPostingPlan.countDocuments();
    if (count) return;

    const docs = DEFAULT_POSTING_PLANS.flatMap((plan) =>
        plan.prices.map((priceItem, index) => ({
            typeNews: plan.typeNews,
            name: plan.name,
            label: plan.label,
            description: plan.description,
            benefits: plan.benefits,
            durationDays: priceItem.durationDays,
            price: priceItem.price,
            sortOrder: plan.sortOrder + index,
        })),
    );

    await modelPostingPlan.insertMany(docs);
};

const getActivePostingPlans = async () => {
    await ensureDefaultPostingPlans();
    return modelPostingPlan.find({ isActive: true }).sort({ sortOrder: 1, typeNews: 1, durationDays: 1 }).lean();
};

const getAllPostingPlans = async () => {
    await ensureDefaultPostingPlans();
    return modelPostingPlan.find().sort({ sortOrder: 1, typeNews: 1, durationDays: 1 }).lean();
};

const getPostingFeeByPlan = async (typeNews, durationInDays) => {
    await ensureDefaultPostingPlans();
    const duration = Number(durationInDays);
    if (!typeNews || !Number.isFinite(duration) || duration <= 0) return 0;

    const plan = await modelPostingPlan
        .findOne({
            typeNews,
            durationDays: duration,
            isActive: true,
        })
        .lean();

    return plan?.price || 0;
};

module.exports = {
    DEFAULT_POSTING_PLANS,
    ensureDefaultPostingPlans,
    getActivePostingPlans,
    getAllPostingPlans,
    getPostingFeeByPlan,
};
