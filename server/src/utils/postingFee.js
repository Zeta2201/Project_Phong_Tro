const postingFeeTable = {
    vip: {
        3: 50000,
        7: 315000,
        30: 1200000,
    },
    normal: {
        3: 10000,
        7: 60000,
        30: 1000000,
    },
};

const resolveDurationBucket = (durationInDays) => {
    const duration = Number(durationInDays);

    if (!duration || Number.isNaN(duration)) {
        return null;
    }

    if (duration <= 3) {
        return 3;
    }

    if (duration <= 7) {
        return 7;
    }

    return 30;
};

const getPostingFeeByPlan = (typeNews, durationInDays) => {
    const bucket = resolveDurationBucket(durationInDays);

    if (!bucket || !postingFeeTable[typeNews]) {
        return 0;
    }

    return postingFeeTable[typeNews][bucket] || 0;
};

const inferPostingFeeFromPost = (post) => {
    if (typeof post.postingFee === 'number' && post.postingFee > 0) {
        return post.postingFee;
    }

    if (!post.createdAt || !post.endDate || !post.typeNews) {
        return 0;
    }

    const createdAt = new Date(post.createdAt);
    const endDate = new Date(post.endDate);
    const durationInDays = Math.round((endDate - createdAt) / (1000 * 60 * 60 * 24));

    return getPostingFeeByPlan(post.typeNews, durationInDays);
};

module.exports = {
    getPostingFeeByPlan,
    inferPostingFeeFromPost,
};
