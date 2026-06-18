const modelUser = require('../models/users.model');
const modelApiKey = require('../models/apiKey.model');
const modelRechargeUser = require('../models/RechargeUser.model');
const modelPost = require('../models/post.model');
const modelKeyWordSearch = require('../models/keyWordSearch.model');
const modelOtp = require('../models/otp.model');
const modelFavourite = require('../models/favourite.model');
const modelReservation = require('../models/reservation.model');
const modelDeposit = require('../models/deposit.model');
const modelContract = require('../models/contract.model');
const modelMessager = require('../models/Messager.model');
const modelReport = require('../models/report.model');
const modelComment = require('../models/comment.model');
const modelReview = require('../models/review.model');
const modelVoucher = require('../models/voucher.model');
const modelContact = require('../models/contact.model');

const sendMailForgotPassword = require('../utils/SendMail/sendMailForgotPassword');
const sendMailChangeEmail = require('../utils/SendMail/sendMailChangeEmail');
const sendMailRegisterOtp = require('../utils/SendMail/sendMailRegisterOtp');
const { BadRequestError, BadUser2RequestError } = require('../core/error.response');
const { createApiKey, createToken, createRefreshToken, verifyToken } = require('../services/tokenSevices');
const { Created, OK } = require('../core/success.response');

const bcrypt = require('bcrypt');
const CryptoJS = require('crypto-js');
const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
const { google } = require('googleapis');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { AiSearchKeyword } = require('../utils/AISearch/AISearch');
const { inferPostingFeeFromPost } = require('../utils/postingFee');
const { uploadImageToCloudinary } = require('../utils/cloudinaryUpload');

const googleOAuthClient = new google.auth.OAuth2();
const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_CHANGE_OTP_EXPIRES_MS = 10 * 60 * 1000;
const REGISTER_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const ADMIN_ROLES = ['admin', 'super_admin'];

const getEffectiveRole = (user) => {
    if (!user) return 'user';
    if (user.role === 'super_admin') return 'super_admin';
    if (user.role === 'admin' || user.isAdmin === true) return 'admin';
    if (user.role === 'landlord') return 'landlord';
    return 'user';
};

const isAdminRole = (role) => ADMIN_ROLES.includes(role);
const isSuperAdminRole = (role) => role === 'super_admin';

const buildRoleUpdate = (role) => ({
    role,
    isAdmin: isAdminRole(role),
});

const getActiveAdminFilter = (excludeId = null) => {
    const filter = {
        isActive: true,
        accountStatus: { $ne: 'locked' },
        $or: [{ role: { $in: ADMIN_ROLES } }, { isAdmin: true }],
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return filter;
};

const ensureAdminWillRemain = async (targetUserId) => {
    const remainingAdminCount = await modelUser.countDocuments(getActiveAdminFilter(targetUserId));
    if (remainingAdminCount <= 0) {
        throw new BadUser2RequestError('Không thể thao tác với tài khoản quản trị cuối cùng của hệ thống');
    }
};

const getAdminActorAndTarget = async (actorId, targetId) => {
    const [actor, target] = await Promise.all([modelUser.findById(actorId), modelUser.findById(targetId)]);
    if (!actor) throw new BadUser2RequestError('Không xác định được tài khoản quản trị hiện tại');
    if (!target) throw new BadRequestError('Không tìm thấy người dùng');

    const actorRole = getEffectiveRole(actor);
    const targetRole = getEffectiveRole(target);
    if (!isAdminRole(actorRole)) {
        throw new BadUser2RequestError('Bạn không có quyền thực hiện thao tác này');
    }

    return { actor, target, actorRole, targetRole, isSelf: actor._id.toString() === target._id.toString() };
};

const assertCanChangeActiveStatus = async ({ actorRole, targetRole, isSelf, target, nextIsActive }) => {
    if (isSelf && nextIsActive === false) {
        throw new BadUser2RequestError('Không thể tự khóa tài khoản đang đăng nhập');
    }
    if (actorRole === 'admin' && isAdminRole(targetRole)) {
        throw new BadUser2RequestError('Admin thường không được khóa hoặc mở khóa admin khác');
    }
    if (nextIsActive === false && isAdminRole(targetRole)) {
        await ensureAdminWillRemain(target._id);
    }
};

const assertCanChangeRole = async ({ actorRole, targetRole, isSelf, target, nextRole }) => {
    if (!isSuperAdminRole(actorRole)) {
        throw new BadUser2RequestError('Chỉ super admin mới được cấp hoặc gỡ quyền admin');
    }
    if (isSelf && targetRole === 'super_admin' && nextRole !== 'super_admin') {
        throw new BadUser2RequestError('Không thể tự gỡ quyền super admin của chính mình');
    }
    if (isSelf && isAdminRole(targetRole) && !isAdminRole(nextRole)) {
        throw new BadUser2RequestError('Không thể tự gỡ quyền admin của chính mình');
    }
    if (isAdminRole(targetRole) && !isAdminRole(nextRole)) {
        await ensureAdminWillRemain(target._id);
    }
};

const buildCookieOptions = (maxAge, httpOnly = true) => ({
    httpOnly,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge,
});

const ACCESS_TOKEN_COOKIE_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const clearSessionCookies = (res) => {
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.clearCookie('logged');
};

const isLockedUser = (user) => !user || user.isActive === false || user.accountStatus === 'locked';

const issueLoginSession = async (user, res) => {
    await createApiKey(user._id);
    user.lastLoginAt = new Date();
    user.accountStatus = user.accountStatus === 'locked' ? 'locked' : 'active';
    user.isActive = user.accountStatus === 'active';
    await user.save();

    const token = await createToken({ id: user._id });
    const refreshToken = await createRefreshToken({ id: user._id });

    res.cookie('token', token, buildCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE));
    res.cookie('logged', 1, buildCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE, false));
    res.cookie('refreshToken', refreshToken, buildCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE));

    return { token, refreshToken };
};

const parseJsonFromText = (text = '') => {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return {};

    try {
        return JSON.parse(match[0]);
    } catch {
        return {};
    }
};

const extractCccdInfo = async (file) => {
    if (!genAI) {
        return {
            rawText: '',
            data: {},
            note: 'Chưa cấu hình GOOGLE_API_KEY, vui lòng kiểm tra thủ công',
        };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
Đọc thông tin trên ảnh CCCD/CMND Việt Nam.
Chỉ trả về JSON hợp lệ, không markdown:
{
  "fullName": "",
  "cccdNumber": "",
  "dob": "",
  "address": "",
  "rawText": ""
}
Nếu không thấy trường nào thì để chuỗi rỗng.
`;

    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype,
            },
        },
    ]);

    const text = result.response.text();
    const data = parseJsonFromText(text);

    return {
        rawText: data.rawText || text,
        data,
        note: '',
    };
};

class controllerUsers {
    async requestRegisterOtp(req, res) {
        const email = String(req.body.email || '').trim().toLowerCase();

        if (!email) {
            throw new BadRequestError('Vui lòng nhập email');
        }

        if (!emailPattern.test(email)) {
            throw new BadRequestError('Email không hợp lệ');
        }

        const user = await modelUser.findOne({ email });
        if (user) {
            throw new BadRequestError('Email này đã được đăng ký');
        }

        const latestOtp = await modelOtp.findOne({ email, type: 'verifyAccount' }).sort({ createdAt: -1 });
        if (latestOtp) {
            const remainingMs = REGISTER_OTP_RESEND_COOLDOWN_MS - (Date.now() - latestOtp.createdAt.getTime());
            if (remainingMs > 0) {
                throw new BadRequestError(`Vui lòng thử lại sau ${Math.ceil(remainingMs / 1000)} giây`);
            }
        }

        const otp = await otpGenerator.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false,
        });
        const hash = await bcrypt.hash(otp, 10);

        await modelOtp.deleteMany({ email, type: 'verifyAccount' });
        const createdOtp = await modelOtp.create({
            email,
            otp: hash,
            type: 'verifyAccount',
        });

        try {
            await sendMailRegisterOtp(email, otp);
        } catch (error) {
            await modelOtp.deleteOne({ _id: createdOtp._id });
            throw error;
        }

        new OK({ message: 'Đã gửi mã OTP đăng ký. Vui lòng kiểm tra email.' }).send(res);
    }

    async register(req, res) {
        const { fullName, password, phone, otp } = req.body;
        const email = String(req.body.email || '').trim().toLowerCase();

        if (!fullName || !email || !password || !phone || !otp) {
            throw new BadRequestError('Vui lòng nhập đầy đủ thông tin');
        }

        if (!emailPattern.test(email)) {
            throw new BadRequestError('Email không hợp lệ');
        }

        const user = await modelUser.findOne({ email });
        if (user) {
            throw new BadRequestError('Người dùng đã tồn tại');
        } else {
            const findOTP = await modelOtp.findOne({ email, type: 'verifyAccount' }).sort({ createdAt: -1 });
            if (!findOTP) {
                throw new BadRequestError('Vui lòng lấy mã OTP đăng ký');
            }

            const isMatch = await bcrypt.compare(String(otp).trim(), findOTP.otp);
            if (!isMatch) {
                throw new BadRequestError('Mã OTP không chính xác hoặc đã hết hạn');
            }

            const saltRounds = 10;
            const salt = bcrypt.genSaltSync(saltRounds);
            const passwordHash = bcrypt.hashSync(password, salt);
            const newUser = await modelUser.create({
                fullName,
                email,
                password: passwordHash,
                typeLogin: 'email',
                provider: 'local',
                emailVerified: true,
                phone,
                isActive: true,
                accountStatus: 'active',
            });
            await modelOtp.deleteOne({ _id: findOTP._id });
            const { token, refreshToken } = await issueLoginSession(newUser, res);
            new Created({ message: 'Đăng ký thành công', metadata: { token, refreshToken } }).send(res);
        }
    }
    async login(req, res) {
        const { email, password } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (!normalizedEmail || !password) {
            throw new BadRequestError('Vui lòng nhập đầy đủ thông tin');
        }
        const user = await modelUser.findOne({ email: normalizedEmail });
        if (!user) {
            throw new BadRequestError('Tài khoản hoặc mật khẩu không chính xác');
        }
        if (user.typeLogin === 'google') {
            throw new BadRequestError('Tài khoản đăng nhập bằng Google');
        }

        if (isLockedUser(user)) {
            throw new BadRequestError('Tài khoản của bạn đã bị khóa');
        }

        const checkPassword = bcrypt.compareSync(password, user.password);
        if (!checkPassword) {
            throw new BadRequestError('Tài khoản hoặc mật khẩu không chính xác');
        }
        const { token, refreshToken } = await issueLoginSession(user, res);
        new OK({ message: 'Đăng nhập thành công', metadata: { token, refreshToken } }).send(res);
    }

    async loginGoogle(req, res) {
        const { credential } = req.body;
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        if (!googleClientId) {
            throw new BadRequestError('Chưa cấu hình GOOGLE_CLIENT_ID');
        }
        if (!credential) {
            throw new BadRequestError('Không nhận được Google credential');
        }

        let dataToken;
        try {
            const ticket = await googleOAuthClient.verifyIdToken({
                idToken: credential,
                audience: googleClientId,
            });
            dataToken = ticket.getPayload();
        } catch {
            throw new BadRequestError('Google credential không hợp lệ');
        }

        if (!dataToken?.email || dataToken.email_verified !== true) {
            throw new BadRequestError('Email Google chưa được xác minh');
        }

        const googleEmail = dataToken.email.toLowerCase().trim();
        const user = await modelUser.findOne({ email: googleEmail });
        if (user) {
            if (isLockedUser(user)) {
                throw new BadRequestError('Tài khoản của bạn đã bị khóa');
            }
            const { token, refreshToken } = await issueLoginSession(user, res);
            new OK({ message: 'Đăng nhập thành công', metadata: { token, refreshToken } }).send(res);
        } else {
            const newUser = await modelUser.create({
                fullName: dataToken.name,
                email: googleEmail,
                typeLogin: 'google',
                provider: 'google',
                emailVerified: true,
                isActive: true,
                accountStatus: 'active',
            });
            const { token, refreshToken } = await issueLoginSession(newUser, res);
            new OK({ message: 'Đăng nhập thành công', metadata: { token, refreshToken } }).send(res);
        }
    }

    async authUser(req, res) {
        const user = req.user;
        const findUser = await modelUser.findOne({ _id: user.id });
        if (!findUser) {
            throw new BadRequestError('Tài khoản hoặc mật khẩu không chính xác');
        }
        const userString = JSON.stringify(findUser);
        const auth = CryptoJS.AES.encrypt(userString, process.env.SECRET_CRYPTO).toString();
        new OK({ message: 'success', metadata: { auth } }).send(res);
    }

    async logout(req, res) {
        const accessToken = req.cookies.token;
        const refreshToken = req.cookies.refreshToken;
        let decoded = null;

        try {
            decoded = refreshToken ? await verifyToken(refreshToken, 'refresh') : await verifyToken(accessToken, 'access');
        } catch (error) {
            decoded = null;
        }

        if (decoded?.id) {
            await modelApiKey.deleteOne({ userId: decoded.id });
        }

        clearSessionCookies(res);
        new OK({ message: 'Đăng xuất thành công' }).send(res);
    }

    async refreshToken(req, res) {
        const refreshToken = req.cookies.refreshToken;

        try {
            const decoded = await verifyToken(refreshToken, 'refresh');
            const user = await modelUser.findById(decoded.id);

            if (isLockedUser(user)) {
                await modelApiKey.deleteOne({ userId: decoded.id });
                clearSessionCookies(res);
                throw new BadRequestError('Tài khoản của bạn đã bị khóa');
            }

            const token = await createToken({ id: user._id });
            res.cookie('token', token, buildCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE));
            res.cookie('logged', 1, buildCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE, false));

            new OK({ message: 'Làm mới phiên đăng nhập thành công', metadata: { token } }).send(res);
        } catch (error) {
            clearSessionCookies(res);
            throw error;
        }
    }

    async getAdminStats(req, res) {
        try {
            // Get total users count
            const totalUsers = await modelUser.countDocuments();

            // Get new users in the last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const newUsers = await modelUser.countDocuments({
                createdAt: { $gte: thirtyDaysAgo },
            });

            // Calculate user growth percentage
            const previousPeriodUsers = await modelUser.countDocuments({
                createdAt: {
                    $gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
                    $lt: thirtyDaysAgo,
                },
            });
            const userGrowth = previousPeriodUsers > 0 ? ((newUsers / previousPeriodUsers) * 100).toFixed(1) : 100;

            // Get total posts count
            const totalPosts = await modelPost.countDocuments();

            // Get active posts count
            const activePosts = await modelPost.countDocuments({
                status: { $in: ['active', 'approved'] },
                isDeleted: { $ne: true },
            });

            // Get new posts in the last 30 days
            const newPosts = await modelPost.countDocuments({
                createdAt: { $gte: thirtyDaysAgo },
            });

            // Calculate post growth percentage
            const previousPeriodPosts = await modelPost.countDocuments({
                createdAt: {
                    $gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
                    $lt: thirtyDaysAgo,
                },
            });
            const postGrowth = previousPeriodPosts > 0 ? ((newPosts / previousPeriodPosts) * 100).toFixed(1) : 100;

            // Get total transactions and revenue
            const totalTransactions = await modelRechargeUser.countDocuments();
            // Get transactions in the last 30 days
            const recentTransactions = await modelRechargeUser.countDocuments({
                createdAt: { $gte: thirtyDaysAgo },
            });

            // Calculate transaction growth percentage
            const previousPeriodTransactions = await modelRechargeUser.countDocuments({
                createdAt: {
                    $gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
                    $lt: thirtyDaysAgo,
                },
            });
            const transactionGrowth =
                previousPeriodTransactions > 0
                    ? ((recentTransactions / previousPeriodTransactions) * 100).toFixed(1)
                    : 100;

            const allPosts = await modelPost.find();
            const recentRevenueValue = allPosts
                .filter((post) => new Date(post.createdAt) >= thirtyDaysAgo)
                .reduce((sum, post) => sum + inferPostingFeeFromPost(post), 0);

            const previousPeriodStart = new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000);
            const previousRevenueValue = allPosts
                .filter((post) => {
                    const createdAt = new Date(post.createdAt);
                    return createdAt >= previousPeriodStart && createdAt < thirtyDaysAgo;
                })
                .reduce((sum, post) => sum + inferPostingFeeFromPost(post), 0);

            const totalRevenueValue = allPosts.reduce((sum, post) => sum + inferPostingFeeFromPost(post), 0);

            const revenueGrowth =
                previousRevenueValue > 0 ? ((recentRevenueValue / previousRevenueValue) * 100).toFixed(1) : 100;

            // Get posts data for the last 7 days
            const last7DaysArray = Array.from({ length: 7 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - i);
                return date.toISOString().split('T')[0];
            }).reverse();

            const last7Days = new Date();
            last7Days.setDate(last7Days.getDate() - 7);

            const postsData = await modelPost.aggregate([
                {
                    $match: {
                        createdAt: { $gte: last7Days },
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        posts: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            // Map posts data to ensure all 7 days are included
            const formattedPostsData = last7DaysArray.map((date) => {
                const dayData = postsData.find((item) => item._id === date);
                return {
                    date: date,
                    posts: dayData ? dayData.posts : 0,
                };
            });

            // Get recent transactions
            const recentTransactionsList = await modelRechargeUser
                .find()
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('userId', 'fullName');

            const formattedRecentTransactions = recentTransactionsList.map((transaction) => ({
                _id: transaction._id.toString(),
                userId: transaction.userId._id || transaction.userId,
                username: transaction.userId.fullName || 'Unknown User',
                amount: transaction.amount,
                typePayment: transaction.typePayment,
                status: transaction.status,
                createdAt: transaction.createdAt,
            }));

            // Get top users by post count
            const topUsers = await modelPost.aggregate([
                {
                    $group: {
                        _id: '$userId',
                        posts: { $sum: 1 },
                    },
                },
                { $sort: { posts: -1 } },
                { $limit: 5 },
            ]);

            const topUsersWithDetails = await Promise.all(
                topUsers.map(async (user) => {
                    const userDetails = await modelUser.findById(user._id);
                    return {
                        id: user._id,
                        name: userDetails ? userDetails.fullName : 'Unknown User',
                        posts: user.posts,
                        avatar: userDetails ? userDetails.avatar : null,
                    };
                }),
            );

            new OK({
                message: 'Lấy thống kê thành công',
                metadata: {
                    // User statistics
                    totalUsers,
                    newUsers,
                    userGrowth: parseFloat(userGrowth),

                    // Post statistics
                    totalPosts,
                    activePosts,
                    newPosts,
                    postGrowth: parseFloat(postGrowth),

                    // Transaction statistics
                    totalTransactions,
                    totalRevenue: totalRevenueValue,
                    recentTransactions,
                    transactionGrowth: parseFloat(transactionGrowth),

                    // Revenue statistics
                    recentRevenue: recentRevenueValue,
                    revenueGrowth: parseFloat(revenueGrowth),

                    // Posts data for chart
                    postsData: formattedPostsData,

                    // Recent transactions
                    recentTransactions: formattedRecentTransactions,

                    // Top users
                    topUsers: topUsersWithDetails,
                },
            }).send(res);
        } catch (error) {
            console.error('Error in getAdminStats:', error);
            throw new BadRequestError('Lỗi khi lấy thống kê');
        }
    }

    async changePassword(req, res) {
        const { id } = req.user;
        const { oldPassword, newPassword, confirmPassword } = req.body;
        if (!oldPassword || !newPassword || !confirmPassword) {
            throw new BadRequestError('Vui lòng nhập đầy đủ thông tin');
        }

        if (newPassword !== confirmPassword) {
            throw new BadRequestError('Mật khẩu không khớp');
        }

        const user = await modelUser.findById(id);
        if (!user) {
            throw new BadRequestError('Không tìm thấy người dùng');
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            throw new BadRequestError('Mật khẩu cũ không chính xác');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;
        await user.save();
        new OK({ message: 'Đổi mật khẩu thành công' }).send(res);
    }

    async getRechargeUser(req, res) {
        const { id } = req.user;
        const rechargeUser = await modelRechargeUser.find({ userId: id }).sort({ createdAt: -1 });
        new OK({ message: 'Lấy thông tin nạp tiền thành công', metadata: rechargeUser }).send(res);
    }

    async updateUser(req, res) {
        const { id } = req.user;
        const { fullName, phone, address, avatar } = req.body;
        const user = await modelUser.findByIdAndUpdate(id, { fullName, phone, address, avatar }, { new: true });
        new OK({ message: 'Cập nhật thông tin thành công', metadata: user }).send(res);
    }

    async requestChangeEmail(req, res) {
        const { id } = req.user;
        const newEmail = String(req.body.email || '').trim().toLowerCase();

        if (!newEmail) {
            throw new BadRequestError('Vui lòng nhập email mới');
        }

        if (!emailPattern.test(newEmail)) {
            throw new BadRequestError('Email mới không hợp lệ');
        }

        const user = await modelUser.findById(id);
        if (!user) {
            throw new BadRequestError('Không tìm thấy người dùng');
        }

        const provider = user.provider || (user.typeLogin === 'google' ? 'google' : 'local');
        if (provider === 'google' || user.typeLogin === 'google') {
            throw new BadRequestError('Email của tài khoản này được quản lý bởi Google và không thể thay đổi trong hệ thống.');
        }

        if (newEmail === String(user.email || '').toLowerCase()) {
            throw new BadRequestError('Email mới phải khác email hiện tại');
        }

        const existingUser = await modelUser.findOne({ email: newEmail, _id: { $ne: user._id } });
        if (existingUser) {
            throw new BadRequestError('Email này đã tồn tại trong hệ thống');
        }

        const otp = await otpGenerator.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false,
        });
        const hash = await bcrypt.hash(otp, 10);

        user.pendingEmail = newEmail;
        user.emailChangeOtp = hash;
        user.emailChangeOtpExpires = new Date(Date.now() + EMAIL_CHANGE_OTP_EXPIRES_MS);
        await user.save();

        try {
            await sendMailChangeEmail(newEmail, otp);
        } catch (error) {
            user.pendingEmail = '';
            user.emailChangeOtp = '';
            user.emailChangeOtpExpires = null;
            await user.save();
            throw error;
        }

        new OK({ message: 'Đã gửi mã OTP đến email mới. Vui lòng kiểm tra hộp thư.' }).send(res);
    }

    async verifyChangeEmail(req, res) {
        const { id } = req.user;
        const otp = String(req.body.otp || '').trim();

        if (!otp) {
            throw new BadRequestError('Vui lòng nhập mã OTP');
        }

        const user = await modelUser.findById(id);
        if (!user) {
            throw new BadRequestError('Không tìm thấy người dùng');
        }

        const provider = user.provider || (user.typeLogin === 'google' ? 'google' : 'local');
        if (provider === 'google' || user.typeLogin === 'google') {
            throw new BadRequestError('Email của tài khoản này được quản lý bởi Google và không thể thay đổi trong hệ thống.');
        }

        if (!user.pendingEmail || !user.emailChangeOtp || !user.emailChangeOtpExpires) {
            throw new BadRequestError('Vui lòng yêu cầu đổi email trước');
        }

        if (user.emailChangeOtpExpires.getTime() < Date.now()) {
            user.pendingEmail = '';
            user.emailChangeOtp = '';
            user.emailChangeOtpExpires = null;
            await user.save();
            throw new BadRequestError('Mã OTP đã hết hạn, vui lòng yêu cầu mã mới');
        }

        const isMatch = await bcrypt.compare(otp, user.emailChangeOtp);
        if (!isMatch) {
            throw new BadRequestError('Mã OTP không chính xác');
        }

        const existingUser = await modelUser.findOne({ email: user.pendingEmail, _id: { $ne: user._id } });
        if (existingUser) {
            throw new BadRequestError('Email này đã tồn tại trong hệ thống');
        }

        user.email = user.pendingEmail;
        user.pendingEmail = '';
        user.emailChangeOtp = '';
        user.emailChangeOtpExpires = null;
        user.emailVerified = true;
        user.provider = 'local';
        await user.save();
        await modelApiKey.deleteOne({ userId: user._id.toString() });

        res.clearCookie('token');
        res.clearCookie('refreshToken');
        res.clearCookie('logged');

        new OK({ message: 'Đổi email thành công. Vui lòng đăng nhập lại.' }).send(res);
    }
    async submitCccdVerification(req, res) {
        const { id } = req.user;
        if (!req.file) {
            throw new BadRequestError('Vui lòng tải ảnh CCCD');
        }

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) {
            throw new BadRequestError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP');
        }

        const imageUrl = await uploadImageToCloudinary(req.file, 'phongtro/cccd-verifications');
        let ocrResult = { data: {}, rawText: '', note: '' };

        try {
            ocrResult = await extractCccdInfo(req.file);
        } catch (error) {
            ocrResult.note = `OCR thất bại: ${error.message}`;
        }

        const extracted = ocrResult.data || {};
        const updatedUser = await modelUser.findByIdAndUpdate(
            id,
            {
                cccdImageUrl: imageUrl,
                cccdFullName: extracted.fullName || '',
                cccdNumber: extracted.cccdNumber || '',
                cccdDob: extracted.dob || '',
                cccdAddress: extracted.address || '',
                cccdOcrRawText: ocrResult.rawText || ocrResult.note || '',
                verificationStatus: 'pending',
                verificationRejectReason: '',
                verifiedAt: null,
            },
            { new: true },
        );

        new OK({
            message: 'Đã gửi CCCD để xác thực, vui lòng chờ admin duyệt',
            metadata: updatedUser,
        }).send(res);
    }

    async updateVerificationStatus(req, res) {
        const { id, status, reason } = req.body;
        if (!id || !['verified', 'rejected'].includes(status)) {
            throw new BadRequestError('Trạng thái xác thực không hợp lệ');
        }

        const updatedUser = await modelUser.findByIdAndUpdate(
            id,
            {
                verificationStatus: status,
                verifiedAt: status === 'verified' ? new Date() : null,
                verificationRejectReason: status === 'rejected' ? reason || '' : '',
                ...(status === 'verified' ? { role: 'landlord' } : {}),
            },
            { new: true },
        );

        if (updatedUser && isAdminRole(getEffectiveRole(updatedUser))) {
            updatedUser.role = getEffectiveRole(updatedUser);
            updatedUser.isAdmin = true;
            await updatedUser.save();
        }

        if (!updatedUser) {
            throw new BadRequestError('Không tìm thấy người dùng');
        }

        new OK({
            message: status === 'verified' ? 'Đã xác thực chủ trọ' : 'Đã từ chối xác thực',
            metadata: updatedUser,
        }).send(res);
    }

    async updateUserAdmin(req, res) {
        const { id, isActive, isAdmin } = req.body;
        if (!id) {
            throw new BadRequestError('Id ngu?i d�ng b?t bu?c');
        }

        const { actorRole, target, targetRole, isSelf } = await getAdminActorAndTarget(req.user.id, id);
        const updateData = {};
        const shouldUpdateActive = typeof isActive === 'boolean';

        if (shouldUpdateActive) {
            await assertCanChangeActiveStatus({ actorRole, targetRole, isSelf, target, nextIsActive: isActive });
            updateData.isActive = isActive;
            updateData.accountStatus = isActive ? 'active' : 'locked';
        }

        if (typeof isAdmin === 'boolean') {
            const nextRole = isAdmin ? 'admin' : targetRole === 'landlord' ? 'landlord' : 'user';
            await assertCanChangeRole({ actorRole, targetRole, isSelf, target, nextRole });
            Object.assign(updateData, buildRoleUpdate(nextRole));
        }

        const user = await modelUser.findByIdAndUpdate(id, updateData, { new: true });
        if (!user) {
            throw new BadRequestError('Kh�ng t�m th?y ngu?i d�ng');
        }

        if (shouldUpdateActive && !isActive) {
            await modelApiKey.deleteOne({ userId: user._id.toString() });
        }

        new OK({ message: 'C?p nh?t ngu?i d�ng th�nh c�ng', metadata: user }).send(res);
    }

    async lockUser(req, res) {
        const { actorRole, target, targetRole, isSelf } = await getAdminActorAndTarget(req.user.id, req.params.id);
        await assertCanChangeActiveStatus({ actorRole, targetRole, isSelf, target, nextIsActive: false });

        target.isActive = false;
        target.accountStatus = 'locked';
        await target.save();
        await modelApiKey.deleteOne({ userId: target._id.toString() });

        new OK({ message: '�� kh�a t�i kho?n', metadata: target }).send(res);
    }

    async unlockUser(req, res) {
        const { actorRole, target, targetRole, isSelf } = await getAdminActorAndTarget(req.user.id, req.params.id);
        await assertCanChangeActiveStatus({ actorRole, targetRole, isSelf, target, nextIsActive: true });

        target.isActive = true;
        target.accountStatus = 'active';
        await target.save();

        new OK({ message: '�� m? kh�a t�i kho?n', metadata: target }).send(res);
    }

    async promoteUser(req, res) {
        const { actorRole, target, targetRole, isSelf } = await getAdminActorAndTarget(req.user.id, req.params.id);
        await assertCanChangeRole({ actorRole, targetRole, isSelf, target, nextRole: 'admin' });

        Object.assign(target, buildRoleUpdate('admin'));
        await target.save();

        new OK({ message: '�� c?p quy?n admin', metadata: target }).send(res);
    }

    async demoteUser(req, res) {
        const { actorRole, target, targetRole, isSelf } = await getAdminActorAndTarget(req.user.id, req.params.id);
        const nextRole = target.role === 'landlord' ? 'landlord' : 'user';
        await assertCanChangeRole({ actorRole, targetRole, isSelf, target, nextRole });

        Object.assign(target, buildRoleUpdate(nextRole));
        await target.save();
        await modelApiKey.deleteOne({ userId: target._id.toString() });

        new OK({ message: '�� g? quy?n admin', metadata: target }).send(res);
    }
    async getUsers(req, res) {
        const { q, status, role } = req.query;
        const filter = {};

        if (q) {
            filter.$or = [
                { fullName: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } },
                { address: { $regex: q, $options: 'i' } },
            ];
        }

        if (status === 'active') {
            filter.isActive = true;
        } else if (status === 'inactive') {
            filter.isActive = false;
        }

        const rawUsers = await modelUser.find(filter).sort({ createdAt: -1 });
        const dataUser = role ? rawUsers.filter((user) => getEffectiveRole(user) === role) : rawUsers;
        const data = await Promise.all(
            dataUser.map(async (user) => {
                const post = await modelPost.find({
                    userId: user._id,
                    status: { $in: ['active', 'approved'] },
                    isDeleted: { $ne: true },
                });
                const totalPost = post.length;
                const totalSpent = post.reduce((sum, post) => sum + inferPostingFeeFromPost(post), 0);
                return { user: { ...user._doc, role: getEffectiveRole(user) }, totalPost, totalSpent };
            }),
        );

        new OK({ message: 'Lấy danh sách người dùng thành công', metadata: data }).send(res);
    }

    async getRechargeStats(req, res) {
        try {
            // Get total transactions and revenue
            const totalTransactions = await modelRechargeUser.countDocuments();
            const totalRevenue = await modelRechargeUser.aggregate([
                { $match: { status: 'success' } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]);

            // Get recent transactions (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const recentTransactions = await modelRechargeUser.countDocuments({
                createdAt: { $gte: sevenDaysAgo },
            });

            // Get previous period transactions (7-14 days ago)
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
            const previousPeriodTransactions = await modelRechargeUser.countDocuments({
                createdAt: {
                    $gte: fourteenDaysAgo,
                    $lt: sevenDaysAgo,
                },
            });

            // Calculate transaction growth
            const transactionGrowth =
                previousPeriodTransactions > 0
                    ? ((recentTransactions / previousPeriodTransactions) * 100 - 100).toFixed(1)
                    : 100;

            // Get recent revenue (last 7 days)
            const recentRevenue = await modelRechargeUser.aggregate([
                {
                    $match: {
                        createdAt: { $gte: sevenDaysAgo },
                        status: 'success',
                    },
                },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]);

            // Get previous period revenue (7-14 days ago)
            const previousPeriodRevenue = await modelRechargeUser.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: fourteenDaysAgo,
                            $lt: sevenDaysAgo,
                        },
                        status: 'success',
                    },
                },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]);

            // Calculate revenue growth
            const revenueGrowth =
                previousPeriodRevenue.length > 0 && previousPeriodRevenue[0].total > 0
                    ? (
                          ((recentRevenue.length > 0 ? recentRevenue[0].total : 0) / previousPeriodRevenue[0].total) *
                              100 -
                          100
                      ).toFixed(1)
                    : 100;

            // Get recent transactions list with user details
            const exportAll = req.query.export === 'all';
            const recentTransactionsQuery = modelRechargeUser
                .find()
                .sort({ createdAt: -1 })
                .populate('userId', 'fullName');

            if (!exportAll) {
                recentTransactionsQuery.limit(50);
            }

            const recentTransactionsList = await recentTransactionsQuery;

            const formattedTransactions = recentTransactionsList.map((transaction) => ({
                key: transaction._id.toString(),
                username: transaction.userId?.fullName || 'Unknown User',
                amount: transaction.amount,
                typePayment: transaction.typePayment,
                status: transaction.status,
                createdAt: transaction.createdAt,
            }));

            new OK({
                message: 'Lấy thống kê nạp tiền thành công',
                metadata: {
                    totalTransactions,
                    totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
                    recentTransactions,
                    transactionGrowth: parseFloat(transactionGrowth),
                    recentRevenue: recentRevenue.length > 0 ? recentRevenue[0].total : 0,
                    revenueGrowth: parseFloat(revenueGrowth),
                    transactions: formattedTransactions,
                },
            }).send(res);
        } catch (error) {
            console.error('Error in getRechargeStats:', error);
            throw new BadRequestError('Lỗi khi lấy thống kê nạp tiền');
        }
    }

    async searchKeyword(req, res) {
        const { keyword } = req.query;
        if (!keyword) {
            const hotSearch = await modelKeyWordSearch.find().sort({ count: -1 }).limit(5);
            return new OK({ message: 'Lấy từ khóa tìm kiếm thành công', metadata: hotSearch }).send(res);
        } else {
            const result = await AiSearchKeyword(keyword);
            return new OK({ message: 'Lấy từ khóa tìm kiếm thành công', metadata: result }).send(res);
        }
    }

    async addSearchKeyword(req, res) {
        const { title } = req.body;
        const keyWordSearch = await modelKeyWordSearch.findOne({ title });
        if (keyWordSearch) {
            keyWordSearch.count++;
            await keyWordSearch.save();
        } else {
            await modelKeyWordSearch.create({ title, count: 1 });
        }
        return new OK({ message: 'Thêm từ khóa tìm kiếm thành công' }).send(res);
    }

    async forgotPassword(req, res) {
        const { email } = req.body;
        const resendCooldownMs = 60 * 1000;

        if (!email) {
            throw new BadRequestError('Vui lòng nhập email');
        }

        const user = await modelUser.findOne({ email });
        if (!user) {
            throw new BadRequestError('Email không tồn tại');
        }

        if (user.typeLogin === 'google') {
            throw new BadRequestError('Tài khoản này đăng nhập bằng Google');
        }

        const latestOtp = await modelOtp.findOne({ email: user.email, type: 'forgotPassword' }).sort({ createdAt: -1 });
        if (latestOtp) {
            const remainingMs = resendCooldownMs - (Date.now() - latestOtp.createdAt.getTime());
            if (remainingMs > 0) {
                throw new BadRequestError(`Vui lòng thử lại sau ${Math.ceil(remainingMs / 1000)} giây`);
            }
        }

        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '5m' });
        const otp = await otpGenerator.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false,
        });

        const hash = await bcrypt.hash(otp, 10);
        await modelOtp.deleteMany({ email: user.email, type: 'forgotPassword' });
        const createdOtp = await modelOtp.create({
            email: user.email,
            otp: hash,
            type: 'forgotPassword',
        });

        try {
            await sendMailForgotPassword(email, otp);
        } catch (error) {
            await modelOtp.deleteOne({ _id: createdOtp._id });
            throw error;
        }

        res.cookie('tokenResetPassword', token, buildCookieOptions(5 * 60 * 1000));
        return new OK({ message: 'Gửi mã OTP thành công' }).send(res);
    }

    async resetPassword(req, res) {
        const token = req.cookies.tokenResetPassword;
        const { otp, password, confirmPassword } = req.body;

        if (!token) {
            throw new BadRequestError('Vui lòng gửi yêu cầu quên mật khẩu');
        }

        if (!otp || !password || !confirmPassword) {
            throw new BadRequestError('Vui lòng nhập đầy đủ thông tin');
        }

        if (password.length < 6) {
            throw new BadRequestError('Mật khẩu phải có ít nhất 6 ký tự');
        }

        if (password !== confirmPassword) {
            throw new BadRequestError('Mật khẩu không khớp');
        }

        let decode;
        try {
            decode = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            throw new BadRequestError('Sai mã OTP hoặc đã hết hạn, vui lòng lấy OTP mới');
        }

        const findOTP = await modelOtp.findOne({ email: decode.email, type: 'forgotPassword' }).sort({ createdAt: -1 });
        if (!findOTP) {
            throw new BadRequestError('Sai mã OTP hoặc đã hết hạn, vui lòng lấy OTP mới');
        }

        // So sánh OTP
        const isMatch = await bcrypt.compare(otp, findOTP.otp);
        if (!isMatch) {
            throw new BadRequestError('Sai mã OTP hoặc đã hết hạn, vui lòng lấy OTP mới');
        }

        // Hash mật khẩu mới
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Tìm người dùng
        const findUser = await modelUser.findOne({ email: decode.email });
        if (!findUser) {
            throw new BadRequestError('Người dùng không tồn tại');
        }

        // Cập nhật mật khẩu mới
        findUser.password = hashedPassword;
        await findUser.save();

        // Xóa OTP sau khi đặt lại mật khẩu thành công
        await modelOtp.deleteOne({ _id: findOTP._id });
        res.clearCookie('tokenResetPassword');
        return new OK({ message: 'Đặt lại mật khẩu thành công' }).send(res);
    }
}

module.exports = new controllerUsers();

