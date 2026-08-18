const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const modelPost = require('../../models/post.model');

const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-3.5-flash' }) : null;

const PUBLIC_POST_STATUSES = ['active', 'approved'];
const MAX_CONTEXT_POSTS = 24;
const MAX_SUGGESTIONS = 5;

const normalizeText = (value = '') =>
    value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const publicPostFilter = {
    status: { $in: PUBLIC_POST_STATUSES },
    isDeleted: { $ne: true },
};

const formatPrice = (price) => `${Number(price || 0).toLocaleString('vi-VN')} VND/thang`;

const formatPostForPrompt = (post, index) =>
    [
        `${index + 1}. ${post.title}`,
        `Giá: ${formatPrice(post.price)}`,
        `Điênn tích: ${post.area || '-'} m2`,
        `Địa chỉ: ${post.location || '-'}`,
        `Loại phòng: ${post.category || '-'}`,
        `Tình trạng: ${post.availabilityStatus || 'available'}`,
    ].join(' | ');

const formatSuggestion = (post) => ({
    _id: post._id,
    title: post.title,
    price: post.price,
    area: post.area,
    location: post.location,
    image: post.images?.[0] || '',
    availabilityStatus: post.availabilityStatus || 'available',
});

const scorePost = (post, question) => {
    const normalizedQuestion = normalizeText(question);
    const searchable = normalizeText([post.title, post.location, post.category, post.description, ...(post.options || [])].join(' '));
    const words = normalizedQuestion.split(/\s+/).filter((word) => word.length >= 3);
    const keywordScore = words.reduce((score, word) => score + (searchable.includes(word) ? 2 : 0), 0);
    const availableScore = (post.availabilityStatus || 'available') === 'available' ? 2 : 0;
    const vipScore = post.typeNews === 'vip' ? 1 : 0;
    const freshnessScore = post.createdAt ? Math.max(0, 1 - (Date.now() - new Date(post.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000)) : 0;
    return keywordScore + availableScore + vipScore + freshnessScore;
};

const getRelevantPosts = async (question) => {
    const posts = await modelPost.find(publicPostFilter).sort({ createdAt: -1 }).limit(80).lean();
    return posts
        .map((post) => ({ post, score: scorePost(post, question) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CONTEXT_POSTS)
        .map((item) => item.post);
};

const buildFallbackAnswer = (question, suggestions) => {
    if (!suggestions.length) {
        return [
            'Hiện tại mình chưa tìm thấy phong phù hợp trong danh sách đang hiển thị.',
            'Bạn có thể cho mình thêm khu vực, mức giá dự kiến, diện tích mong muốn và số người ở để mình lọc lại chính xác hơn.',
        ].join('\n');
    }

    const top = suggestions[0];
    return [
        `Mình tìm thấy ${suggestions.length} phòng có thể phù hợp với nhu cầu của bạn.`,
        `Gợi ý nổi bật: ${top.title}, giá ${formatPrice(top.price)}, diện tích ${top.area || '-'} m2 tại ${top.location || 'khu vực đang cập nhật'}.`,
        'Bạn nên xem kỹ vị trí, tiện ích, tình trạng phòng và liên hệ chủ trọ để xác nhận phòng còn trong trước khi đặt cọc.',
    ].join('\n');
};

async function askQuestion(question) {
    const cleanQuestion = String(question || '').trim();
    if (!cleanQuestion) {
        return {
            answer: 'Bạn hay cho mình biết khu vực, ngân sách và diện tích mong muốn để mình gợi ý phòng phù hợp.',
            suggestions: [],
        };
    }

    const relevantPosts = await getRelevantPosts(cleanQuestion);
    const suggestions = relevantPosts.slice(0, MAX_SUGGESTIONS).map(formatSuggestion);

    if (!model) {
        return {
            answer: buildFallbackAnswer(cleanQuestion, suggestions),
            suggestions,
        };
    }

    try {
        const postData = relevantPosts.map(formatPostForPrompt).join('\n');
        const prompt = `
Bạn là AI Chatbot hỗ trơ thuê phòng trọ cho website tìm phòng tại Việt Nam.

Nhiệm vụ:
- Trả lời bằng tiếng Việt tự nhiên, thân thiện, ngắn gọn.
- Tư vấn người thuê về khu vực, ngân sách, diện tích, tiện ích, tình trạng phòng, đặt cọc và hợp đồng.
- Chỉ gợi ý phòng dựa trên danh sách bài đăng công khai bên dưới.
- Nếu thông tin người dùng chưa đủ, hay hỏi lại 1-2 câu hỏi rõ ràng.
- Nhắc người dùng không chuyển tiền cọc khi chưa xác minh chủ trọ, phòng và điều khoản.
- Không nói rằng bạn có thể thực hiện giao dịch thay người dùng.

Danh sách phòng đang hiển thị:
${postData || 'Chưa có phòng công khai phù hợp.'}

Câu hỏi của người dùng: ${cleanQuestion}
`;

        const result = await model.generateContent(prompt);
        const answer = result.response.text();
        return {
            answer,
            suggestions,
        };
    } catch (error) {
        console.log('Chatbot error:', error.message);
        return {
            answer: buildFallbackAnswer(cleanQuestion, suggestions),
            suggestions,
        };
    }
}

module.exports = { askQuestion };
