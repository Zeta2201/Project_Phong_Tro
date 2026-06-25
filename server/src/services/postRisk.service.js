const modelPost = require('../models/post.model');
const modelReport = require('../models/report.model');
const modelUser = require('../models/users.model');

const normalizeText = (value = '') =>
    value
        .toString()
        .replace(/<[^>]*>/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const getWords = (value) => [...new Set(normalizeText(value).split(' ').filter((word) => word.length >= 3))];

const getSimilarity = (left, right) => {
    const leftWords = getWords(left);
    const rightWords = new Set(getWords(right));
    if (!leftWords.length || !rightWords.size) return 0;
    const matched = leftWords.filter((word) => rightWords.has(word)).length;
    return matched / Math.max(leftWords.length, rightWords.size);
};

const getRiskLevel = (score) => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
};

const buildRiskItem = (type, severity, title, description, score) => ({
    type,
    severity,
    title,
    description,
    score,
});

const getLocationToken = (location = '') => normalizeText(location).split(' ').slice(-2).join(' ');

const assessPostRisk = async (postInput) => {
    const post = typeof postInput.toObject === 'function' ? postInput.toObject() : postInput;
    if (!post?._id) return { score: 0, level: 'low', label: 'Rủi ro thấp', warnings: [], signals: {} };

    const warnings = [];
    const postId = post._id.toString();
    const locationToken = getLocationToken(post.location);

    const [owner, phonePosts, sameCategoryPosts, reportsByPhone] = await Promise.all([
        modelUser.findById(post.userId).select('verificationStatus emailVerified phone').lean(),
        post.phone
            ? modelPost.find({ phone: post.phone, _id: { $ne: post._id }, isDeleted: { $ne: true } }).select('_id').lean()
            : [],
        modelPost
            .find({
                _id: { $ne: post._id },
                category: post.category,
                status: { $in: ['active', 'approved'] },
                isDeleted: { $ne: true },
            })
            .select('title price location description')
            .limit(120)
            .lean(),
        post.phone
            ? modelReport.countDocuments({
                  status: { $in: ['pending', 'resolved'] },
                  postId: {
                      $in: await modelPost.find({ phone: post.phone }).distinct('_id'),
                  },
              })
            : 0,
    ]);

    const comparablePosts = sameCategoryPosts.filter((item) => {
        if (!locationToken) return true;
        return normalizeText(item.location).includes(locationToken);
    });
    const priceSamples = comparablePosts.map((item) => Number(item.price || 0)).filter((price) => price > 0).sort((a, b) => a - b);
    const medianPrice = priceSamples.length ? priceSamples[Math.floor(priceSamples.length / 2)] : 0;
    const currentPrice = Number(post.price || 0);
    const priceRatio = medianPrice && currentPrice ? currentPrice / medianPrice : null;

    if (priceRatio !== null && priceRatio < 0.55 && priceSamples.length >= 4) {
        warnings.push(
            buildRiskItem(
                'low_price',
                'high',
                'Giá thấp bất thường',
                `Giá thấp hơn đáng kể so với mặt bằng các tin cùng loại/khu vực. Trung vị tham chiếu khoảng ${medianPrice.toLocaleString('vi-VN')} VND.`,
                30,
            ),
        );
    } else if (priceRatio !== null && priceRatio < 0.75 && priceSamples.length >= 4) {
        warnings.push(
            buildRiskItem(
                'low_price',
                'medium',
                'Giá thấp hơn mặt bằng',
                'Giá đang thấp hơn nhiều tin tương tự, nên xác minh kỹ phí phát sinh và tình trạng phòng.',
                16,
            ),
        );
    }

    const imageCount = Array.isArray(post.images) ? post.images.filter(Boolean).length : 0;
    if (imageCount < 2) {
        warnings.push(buildRiskItem('few_images', 'high', 'Thiếu ảnh phòng', 'Tin có quá ít ảnh để kiểm tra thực tế phòng.', 22));
    } else if (imageCount < 4) {
        warnings.push(buildRiskItem('few_images', 'medium', 'Ảnh còn ít', 'Nên yêu cầu thêm ảnh/video thực tế trước khi đặt cọc.', 10));
    }

    const duplicateCandidate = sameCategoryPosts
        .map((item) => ({
            title: item.title,
            similarity: getSimilarity(post.description || post.title, item.description || item.title),
        }))
        .sort((a, b) => b.similarity - a.similarity)[0];

    if (duplicateCandidate?.similarity >= 0.82) {
        warnings.push(
            buildRiskItem(
                'duplicate_description',
                'high',
                'Mô tả giống tin khác',
                'Nội dung mô tả trùng lặp cao với một tin khác, cần kiểm tra tính xác thực.',
                24,
            ),
        );
    } else if (duplicateCandidate?.similarity >= 0.65) {
        warnings.push(
            buildRiskItem(
                'duplicate_description',
                'medium',
                'Mô tả có dấu hiệu lặp lại',
                'Một phần mô tả giống các tin khác trong hệ thống.',
                12,
            ),
        );
    }

    if (reportsByPhone >= 3) {
        warnings.push(
            buildRiskItem(
                'reported_phone',
                'high',
                'Số điện thoại từng bị báo cáo nhiều',
                `Có ${reportsByPhone} báo cáo liên quan tới các tin dùng số điện thoại này.`,
                28,
            ),
        );
    } else if (reportsByPhone > 0) {
        warnings.push(
            buildRiskItem(
                'reported_phone',
                'medium',
                'Số điện thoại từng có báo cáo',
                `Có ${reportsByPhone} báo cáo liên quan tới số điện thoại này.`,
                12,
            ),
        );
    }

    if (owner?.verificationStatus !== 'verified') {
        warnings.push(
            buildRiskItem(
                'unverified_owner',
                'medium',
                'Chủ trọ chưa xác minh CCCD',
                'Tài khoản đăng tin chưa có trạng thái xác minh danh tính hoàn tất.',
                14,
            ),
        );
    }

    if (phonePosts.length >= 8) {
        warnings.push(
            buildRiskItem(
                'phone_many_posts',
                'medium',
                'Số điện thoại đăng nhiều tin',
                'Số điện thoại này xuất hiện ở nhiều bài đăng, nên kiểm tra chủ sở hữu và địa chỉ thực tế.',
                10,
            ),
        );
    }

    const score = Math.min(100, warnings.reduce((total, warning) => total + warning.score, 0));
    const level = getRiskLevel(score);
    const label = level === 'high' ? 'Rủi ro cao' : level === 'medium' ? 'Cần xác minh thêm' : 'Rủi ro thấp';

    return {
        score,
        level,
        label,
        warnings,
        signals: {
            imageCount,
            medianPrice,
            priceRatio,
            reportsByPhone,
            ownerVerificationStatus: owner?.verificationStatus || 'none',
            samePhonePostCount: phonePosts.length + 1,
            duplicateSimilarity: duplicateCandidate?.similarity || 0,
        },
    };
};

module.exports = {
    assessPostRisk,
};
