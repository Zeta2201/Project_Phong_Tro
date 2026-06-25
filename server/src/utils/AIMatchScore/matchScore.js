const { GoogleGenerativeAI } = require('@google/generative-ai');

require('dotenv').config();

const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }) : null;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeText = (value = '') =>
    value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const toNumber = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const getCategoryLabel = (category) =>
    ({
        'phong-tro': 'Phòng trọ',
        'nha-nguyen-can': 'Nhà nguyên căn',
        'can-ho-chung-cu': 'Căn hộ chung cư',
        'can-ho-mini': 'Căn hộ mini',
    })[category] || category || 'Chưa rõ';

const getScoreLabel = (score) => {
    if (score >= 85) return 'Rất phù hợp';
    if (score >= 70) return 'Phù hợp';
    if (score >= 55) return 'Có thể cân nhắc';
    return 'Chưa thật sự phù hợp';
};

const splitOptions = (value) => {
    if (Array.isArray(value)) return value.map((item) => item.toString().trim()).filter(Boolean);
    return String(value || '')
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
};

const addFactor = (factors, key, label, score, weight, reason) => {
    factors.push({
        key,
        label,
        score: Math.round(clamp(score, 0, 100)),
        weight,
        reason,
    });
};

const calculateHeuristicMatch = ({ post, landlordReputation = {}, preferences = {} }) => {
    const factors = [];
    const matched = [];
    const concerns = [];

    const budgetMax = toNumber(preferences.budgetMax);
    const areaMin = toNumber(preferences.areaMin);
    const preferredLocation = String(preferences.location || '').trim();
    const preferredCategory = String(preferences.category || '').trim();
    const requiredOptions = splitOptions(preferences.requiredOptions);
    const note = String(preferences.note || '').trim();
    const postPrice = toNumber(post.price);
    const postArea = toNumber(post.area);
    const postOptions = Array.isArray(post.options) ? post.options : [];
    const normalizedPostLocation = normalizeText(post.location);
    const normalizedTextPool = normalizeText([post.title, post.location, post.description, post.category, ...postOptions].join(' '));

    if (budgetMax > 0) {
        const priceRatio = postPrice / budgetMax;
        const priceScore = priceRatio <= 1 ? 100 : clamp(100 - (priceRatio - 1) * 160, 0, 100);
        addFactor(
            factors,
            'budget',
            'Ngân sách',
            priceScore,
            25,
            priceRatio <= 1 ? 'Giá thuê nằm trong ngân sách đã nhập.' : 'Giá thuê cao hơn ngân sách mong muốn.',
        );
        if (priceRatio <= 1) matched.push('Giá thuê nằm trong ngân sách');
        else concerns.push('Giá thuê cao hơn ngân sách');
    } else {
        addFactor(factors, 'budget', 'Ngân sách', 72, 12, 'Bạn chưa nhập ngân sách nên hệ thống chấm trung lập.');
    }

    if (preferredLocation) {
        const locationWords = normalizeText(preferredLocation).split(/\s+/).filter((word) => word.length >= 2);
        const matchedWords = locationWords.filter((word) => normalizedPostLocation.includes(word));
        const locationScore = locationWords.length ? (matchedWords.length / locationWords.length) * 100 : 60;
        addFactor(
            factors,
            'location',
            'Vị trí',
            locationScore,
            20,
            locationScore >= 60 ? 'Địa chỉ có nhiều điểm trùng với khu vực mong muốn.' : 'Vị trí chưa khớp rõ với khu vực mong muốn.',
        );
        if (locationScore >= 60) matched.push('Vị trí gần khu vực bạn quan tâm');
        else concerns.push('Vị trí chưa khớp mạnh với khu vực mong muốn');
    } else {
        addFactor(factors, 'location', 'Vị trí', 70, 10, 'Bạn chưa nhập khu vực ưu tiên.');
    }

    if (areaMin > 0) {
        const areaScore = postArea >= areaMin ? 100 : clamp((postArea / areaMin) * 100, 0, 100);
        addFactor(
            factors,
            'area',
            'Diện tích',
            areaScore,
            15,
            postArea >= areaMin ? 'Diện tích đáp ứng mức tối thiểu.' : 'Diện tích nhỏ hơn mức bạn mong muốn.',
        );
        if (postArea >= areaMin) matched.push('Diện tích đáp ứng nhu cầu');
        else concerns.push('Diện tích nhỏ hơn mong muốn');
    } else {
        addFactor(factors, 'area', 'Diện tích', 72, 8, 'Bạn chưa nhập diện tích tối thiểu.');
    }

    if (preferredCategory) {
        const categoryScore = post.category === preferredCategory ? 100 : 45;
        addFactor(
            factors,
            'category',
            'Loại phòng',
            categoryScore,
            10,
            categoryScore === 100 ? 'Loại phòng đúng với lựa chọn.' : 'Loại phòng khác lựa chọn.',
        );
        if (categoryScore === 100) matched.push(`Đúng loại ${getCategoryLabel(preferredCategory)}`);
        else concerns.push('Loại phòng chưa đúng lựa chọn');
    }

    if (requiredOptions.length) {
        const normalizedOptions = postOptions.map(normalizeText);
        const optionHits = requiredOptions.filter((option) =>
            normalizedOptions.some((postOption) => postOption.includes(normalizeText(option)) || normalizeText(option).includes(postOption)),
        );
        const optionScore = (optionHits.length / requiredOptions.length) * 100;
        addFactor(
            factors,
            'amenities',
            'Tiện ích',
            optionScore,
            20,
            optionHits.length
                ? `Khớp ${optionHits.length}/${requiredOptions.length} tiện ích đã nhập.`
                : 'Chưa thấy tiện ích mong muốn trong tin đăng.',
        );
        if (optionHits.length) matched.push(`Có ${optionHits.length} tiện ích bạn cần`);
        if (optionHits.length < requiredOptions.length) concerns.push('Một số tiện ích mong muốn chưa có trong tin');
    } else {
        addFactor(factors, 'amenities', 'Tiện ích', postOptions.length ? 76 : 55, 8, 'Bạn chưa nhập tiện ích bắt buộc.');
    }

    if (note) {
        const noteWords = normalizeText(note).split(/\s+/).filter((word) => word.length >= 3);
        const noteHits = noteWords.filter((word) => normalizedTextPool.includes(word));
        const noteScore = noteWords.length ? clamp((noteHits.length / noteWords.length) * 100 + 20, 0, 100) : 65;
        addFactor(
            factors,
            'note',
            'Nhu cầu khác',
            noteScore,
            12,
            noteScore >= 60 ? 'Mô tả phòng có một số điểm khớp ghi chú.' : 'Ghi chú chưa khớp rõ với mô tả phòng.',
        );
    }

    const availableScore = (post.availabilityStatus || 'available') === 'available' ? 100 : 35;
    addFactor(
        factors,
        'availability',
        'Tình trạng phòng',
        availableScore,
        10,
        availableScore === 100 ? 'Phòng đang còn trống.' : 'Phòng hiện không ở trạng thái còn trống.',
    );
    if (availableScore === 100) matched.push('Phòng đang còn trống');
    else concerns.push('Cần xác nhận lại tình trạng phòng');

    const reputationScore = clamp(toNumber(landlordReputation.score) * 20, 45, 100);
    addFactor(
        factors,
        'reputation',
        'Uy tín chủ trọ',
        reputationScore,
        10,
        landlordReputation.score ? 'Có dữ liệu uy tín chủ trọ để tham khảo.' : 'Chưa có nhiều dữ liệu uy tín chủ trọ.',
    );
    if (reputationScore >= 80) matched.push('Chủ trọ có điểm uy tín tốt');
    if (reputationScore < 60) concerns.push('Nên hỏi kỹ thêm thông tin chủ trọ');

    const totalWeight = factors.reduce((total, factor) => total + factor.weight, 0) || 1;
    const score = Math.round(factors.reduce((total, factor) => total + factor.score * factor.weight, 0) / totalWeight);

    return {
        score: clamp(score, 0, 100),
        label: getScoreLabel(score),
        summary:
            score >= 70
                ? 'Phòng này có nhiều điểm khớp với nhu cầu bạn nhập. Bạn vẫn nên xác nhận lại tình trạng phòng, chi phí phát sinh và điều khoản đặt cọc.'
                : 'Phòng này chỉ khớp một phần với nhu cầu. Nên so sánh thêm vài lựa chọn khác trước khi đặt cọc.',
        matched: [...new Set(matched)].slice(0, 5),
        concerns: [...new Set(concerns)].slice(0, 5),
        factors,
    };
};

const tryGenerateAiNarrative = async ({ post, preferences, heuristic }) => {
    if (!model) return heuristic;

    try {
        const prompt = `
Bạn là trợ lý AI tư vấn thuê phòng trọ tại Việt Nam.
Hãy dựa vào dữ liệu bên dưới để trả về JSON hợp lệ, không markdown:
{
  "summary": "1-2 câu ngắn bằng tiếng Việt",
  "matched": ["tối đa 4 điểm phù hợp"],
  "concerns": ["tối đa 4 điểm cần cân nhắc"]
}

Dữ liệu phòng:
- Tiêu đề: ${post.title || ''}
- Giá: ${post.price || 0} VND/tháng
- Diện tích: ${post.area || 0} m2
- Địa chỉ: ${post.location || ''}
- Loại phòng: ${getCategoryLabel(post.category)}
- Tiện ích: ${(post.options || []).join(', ')}
- Tình trạng: ${post.availabilityStatus || 'available'}

Nhu cầu người thuê:
- Ngân sách tối đa: ${preferences.budgetMax || 'chưa nhập'}
- Khu vực ưu tiên: ${preferences.location || 'chưa nhập'}
- Diện tích tối thiểu: ${preferences.areaMin || 'chưa nhập'}
- Loại phòng: ${preferences.category || 'chưa nhập'}
- Tiện ích cần có: ${preferences.requiredOptions || 'chưa nhập'}
- Ghi chú: ${preferences.note || 'không có'}

Điểm hệ thống đã tính: ${heuristic.score}/100 (${heuristic.label})
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(text);

        return {
            ...heuristic,
            summary: parsed.summary || heuristic.summary,
            matched: Array.isArray(parsed.matched) && parsed.matched.length ? parsed.matched.slice(0, 4) : heuristic.matched,
            concerns: Array.isArray(parsed.concerns) && parsed.concerns.length ? parsed.concerns.slice(0, 4) : heuristic.concerns,
        };
    } catch {
        return heuristic;
    }
};

const scoreRoomMatch = async ({ post, landlordReputation, preferences }) => {
    const heuristic = calculateHeuristicMatch({ post, landlordReputation, preferences });
    return tryGenerateAiNarrative({ post, preferences, heuristic });
};

module.exports = {
    scoreRoomMatch,
};
