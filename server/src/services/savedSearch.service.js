const modelSavedSearch = require('../models/savedSearch.model');
const { createNotification } = require('./notification.service');
const sendSavedSearchMail = require('../utils/SendMail/sendSavedSearchMail');

const normalizeText = (value = '') =>
    value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const priceRanges = {
    'duoi-1-trieu': [0, 1000000],
    'tu-1-2-trieu': [1000000, 2000000],
    'tu-2-3-trieu': [2000000, 3000000],
    'tu-3-5-trieu': [3000000, 5000000],
    'tu-5-7-trieu': [5000000, 7000000],
    'tu-7-10-trieu': [7000000, 10000000],
    'tu-10-15-trieu': [10000000, 15000000],
    'tren-15-trieu': [15000000, Infinity],
};

const areaRanges = {
    'duoi-20': [0, 20],
    'tu-20-30': [20, 30],
    'tu-30-50': [30, 50],
    'tu-50-70': [50, 70],
    'tu-70-90': [70, 90],
    'tren-90': [90, Infinity],
};

const inRange = (value, range) => {
    if (!range) return true;
    const numberValue = Number(value || 0);
    return numberValue >= range[0] && numberValue <= range[1];
};

const matchesSavedSearch = (post, criteria = {}) => {
    if (criteria.category && post.category !== criteria.category) return false;
    if (criteria.typeNews && post.typeNews !== criteria.typeNews) return false;
    if (criteria.priceRange && !inRange(post.price, priceRanges[criteria.priceRange])) return false;
    if (criteria.areaRange && !inRange(post.area, areaRanges[criteria.areaRange])) return false;

    const normalizedLocation = normalizeText(post.location);
    if (criteria.province && !normalizedLocation.includes(normalizeText(criteria.province))) return false;

    const keyword = normalizeText(criteria.keyword);
    if (keyword) {
        const searchable = normalizeText([post.title, post.location, post.description, ...(post.options || [])].join(' '));
        if (!searchable.includes(keyword)) return false;
    }

    return true;
};

const notifySavedSearchMatches = async (post) => {
    if (!post || !['active', 'approved'].includes(post.status) || post.isDeleted) return [];

    const savedSearches = await modelSavedSearch
        .find({
            isActive: true,
            lastNotifiedPostIds: { $ne: post._id },
        })
        .populate('userId', 'email fullName')
        .lean();

    const matchedSearches = savedSearches.filter((savedSearch) => matchesSavedSearch(post, savedSearch.criteria));

    await Promise.all(
        matchedSearches.map(async (savedSearch) => {
            const link = `/chi-tiet-tin-dang/${post._id}`;
            if (savedSearch.notifyInApp) {
                await createNotification(
                    savedSearch.userId._id || savedSearch.userId,
                    'Có phòng mới khớp tìm kiếm đã lưu',
                    `Phòng "${post.title}" vừa khớp với "${savedSearch.name}"`,
                    'post',
                    link,
                    { postId: post._id, savedSearchId: savedSearch._id },
                );
            }

            if (savedSearch.notifyEmail && savedSearch.userId?.email) {
                await sendSavedSearchMail(savedSearch.userId.email, savedSearch, post);
            }

            await modelSavedSearch.findByIdAndUpdate(savedSearch._id, {
                $addToSet: { lastNotifiedPostIds: post._id },
            });
        }),
    );

    return matchedSearches;
};

module.exports = {
    matchesSavedSearch,
    notifySavedSearchMatches,
};
