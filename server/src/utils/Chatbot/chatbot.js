const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const modelPost = require('../../models/post.model');

const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }) : null;

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
        `Gia: ${formatPrice(post.price)}`,
        `Dien tich: ${post.area || '-'} m2`,
        `Dia chi: ${post.location || '-'}`,
        `Loai phong: ${post.category || '-'}`,
        `Tinh trang: ${post.availabilityStatus || 'available'}`,
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
            'Hien tai minh chua tim thay phong phu hop trong danh sach dang hien thi.',
            'Ban co the cho minh them khu vuc, muc gia du kien, dien tich mong muon va so nguoi o de minh loc lai chinh xac hon.',
        ].join('\n');
    }

    const top = suggestions[0];
    return [
        `Minh tim thay ${suggestions.length} phong co the phu hop voi nhu cau cua ban.`,
        `Goi y noi bat: ${top.title}, gia ${formatPrice(top.price)}, dien tich ${top.area || '-'} m2 tai ${top.location || 'khu vuc dang cap nhat'}.`,
        'Ban nen xem ky vi tri, tien ich, tinh trang phong va lien he chu tro de xac nhan phong con trong truoc khi dat coc.',
    ].join('\n');
};

async function askQuestion(question) {
    const cleanQuestion = String(question || '').trim();
    if (!cleanQuestion) {
        return {
            answer: 'Ban hay cho minh biet khu vuc, ngan sach va dien tich mong muon de minh goi y phong phu hop.',
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
Ban la AI Chatbot ho tro thue phong tro cho website tim phong tai Viet Nam.

Nhiem vu:
- Tra loi bang tieng Viet tu nhien, than thien, ngan gon.
- Tu van nguoi thue ve khu vuc, ngan sach, dien tich, tien ich, tinh trang phong, dat coc va hop dong.
- Chi goi y phong dua tren danh sach bai dang cong khai ben duoi.
- Neu thong tin nguoi dung chua du, hay hoi lai 1-2 cau hoi ro rang.
- Nhac nguoi dung khong chuyen tien coc khi chua xac minh chu tro, phong va dieu khoan.
- Khong noi rang ban co the thuc hien giao dich thay nguoi dung.

Danh sach phong dang hien thi:
${postData || 'Chua co phong cong khai phu hop.'}

Cau hoi cua nguoi dung: ${cleanQuestion}
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
