const modelUser = require('../models/users.model');
const modelApiKey = require('../models/apiKey.model');
const modelRechargeUser = require('../models/RechargeUser.model');
const modelPost = require('../models/post.model');
const modelKeyWordSearch = require('../models/keyWordSearch.model');
const modelOtp = require('../models/otp.model');

const sendMailForgotPassword = require('../utils/SendMail/sendMailForgotPassword');
const { BadRequestError } = require('../core/error.response');
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

const buildCookieOptions = (maxAge, httpOnly = true) => ({
    httpOnly,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge,
});

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
            note: 'Chua cau hinh GOOGLE_API_KEY, vui long kiem tra thu cong',
        };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
Doc thong tin tren anh CCCD/CMND Viet Nam.
Chi tra ve JSON hop le, khong markdown:
{
  "fullName": "",
  "cccdNumber": "",
  "dob": "",
  "address": "",
  "rawText": ""
}
Neu khong thay truong nao thi de chuoi rong.
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
    async register(req, res) {
        const { fullName, email, password, phone } = req.body;

        if (!fullName || !email || !password || !phone) {
            throw new BadRequestError('Vui lòng nhập đày đủ thông tin');
        }
        const user = await modelUser.findOne({ email });
        if (user) {
            throw new BadRequestError('Người dùng đã tồn tại');
        } else {
            const saltRounds = 10;
            const salt = bcrypt.genSaltSync(saltRounds);
            const passwordHash = bcrypt.hashSync(password, salt);
            const newUser = await modelUser.create({
                fullName,
                email,
                password: passwordHash,
                typeLogin: 'email',
                phone,
                isActive: true,
            });
            await newUser.save();
            await createApiKey(newUser._id);
            const token = await createToken({ id: newUser._id });
            const refreshToken = await createRefreshToken({ id: newUser._id });
            res.cookie('token', token, buildCookieOptions(15 * 60 * 1000));

            res.cookie('logged', 1, buildCookieOptions(7 * 24 * 60 * 60 * 1000, false));

            // Đặt cookie HTTP-Only cho refreshToken (tùy chọn)
            res.cookie('refreshToken', refreshToken, buildCookieOptions(7 * 24 * 60 * 60 * 1000));
            new Created({ message: 'Đăng ký thành công', metadata: { token, refreshToken } }).send(res);
        }
    }
    async login(req, res) {
        const { email, password } = req.body;
        if (!email || !password) {
            throw new BadRequestError('Vui lòng nhập đầy đủ thông tin');
        }
        const user = await modelUser.findOne({ email });
        if (!user) {
            throw new BadRequestError('Tài khoản hoặc mật khẩu không chính xác');
        }
        if (user.typeLogin === 'google') {
            throw new BadRequestError('Tài khoản đăng nhập bằng google');
        }

        if (user.isActive === false) {
            throw new BadRequestError('Tai khoan cua ban da bi khoa');
        }

        const checkPassword = bcrypt.compareSync(password, user.password);
        if (!checkPassword) {
            throw new BadRequestError('Tài khoản hoặc mật khẩu không chính xác');
        }
        await createApiKey(user._id);
        const token = await createToken({ id: user._id });
        const refreshToken = await createRefreshToken({ id: user._id });

        res.cookie('token', token, buildCookieOptions(15 * 60 * 1000));

        res.cookie('logged', 1, buildCookieOptions(7 * 24 * 60 * 60 * 1000, false));

        // Đặt cookie HTTP-Only cho refreshToken (tùy chọn)
        res.cookie('refreshToken', refreshToken, buildCookieOptions(7 * 24 * 60 * 60 * 1000));

        new OK({ message: 'Đăng nhập thành công', metadata: { token, refreshToken } }).send(res);
    }

    async loginGoogle(req, res) {
        const { credential } = req.body;
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        if (!googleClientId) {
            throw new BadRequestError('Chua cau hinh GOOGLE_CLIENT_ID');
        }
        if (!credential) {
            throw new BadRequestError('Khong nhan duoc Google credential');
        }

        let dataToken;
        try {
            const ticket = await googleOAuthClient.verifyIdToken({
                idToken: credential,
                audience: googleClientId,
            });
            dataToken = ticket.getPayload();
        } catch {
            throw new BadRequestError('Google credential khong hop le');
        }

        if (!dataToken?.email || dataToken.email_verified !== true) {
            throw new BadRequestError('Email Google chua duoc xac minh');
        }

        const user = await modelUser.findOne({ email: dataToken.email });
        if (user) {
            if (user.isActive === false) {
                throw new BadRequestError('Tai khoan cua ban da bi khoa');
            }
            await createApiKey(user._id);
            const token = await createToken({ id: user._id });
            const refreshToken = await createRefreshToken({ id: user._id });
            res.cookie('token', token, buildCookieOptions(15 * 60 * 1000));
            res.cookie('logged', 1, buildCookieOptions(7 * 24 * 60 * 60 * 1000, false));
            res.cookie('refreshToken', refreshToken, buildCookieOptions(7 * 24 * 60 * 60 * 1000));
            new OK({ message: 'Đăng nhập thành công', metadata: { token, refreshToken } }).send(res);
        } else {
            const newUser = await modelUser.create({
                fullName: dataToken.name,
                email: dataToken.email,
                typeLogin: 'google',
                isActive: true,
            });
            await newUser.save();
            await createApiKey(newUser._id);
            const token = await createToken({ id: newUser._id });
            const refreshToken = await createRefreshToken({ id: newUser._id });
            res.cookie('token', token, buildCookieOptions(15 * 60 * 1000));
            res.cookie('logged', 1, buildCookieOptions(7 * 24 * 60 * 60 * 1000, false));
            res.cookie('refreshToken', refreshToken, buildCookieOptions(7 * 24 * 60 * 60 * 1000));
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
        const user = req.user;
        await modelApiKey.deleteOne({ userId: user.id });
        res.clearCookie('token');
        res.clearCookie('refreshToken');
        res.clearCookie('logged');

        new OK({ message: 'Đăng xuất thành công' }).send(res);
    }

    async refreshToken(req, res) {
        const refreshToken = req.cookies.refreshToken;

        const decoded = await verifyToken(refreshToken);

        const user = await modelUser.findById(decoded.id);
        if (!user || user.isActive === false) {
            throw new BadRequestError('Tai khoan cua ban da bi khoa');
        }
        const token = await createToken({ id: user._id });
        res.cookie('token', token, buildCookieOptions(15 * 60 * 1000));

        res.cookie('logged', 1, buildCookieOptions(7 * 24 * 60 * 60 * 1000, false));

        new OK({ message: 'Refresh token thành công', metadata: { token } }).send(res);
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
            throw new BadRequestError('Vui lòng nhập đày đủ thông tin');
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
        const { fullName, phone, email, address, avatar } = req.body;
        const user = await modelUser.findByIdAndUpdate(id, { fullName, phone, email, address, avatar }, { new: true });
        new OK({ message: 'Cập nhật thông tin thành công', metadata: user }).send(res);
    }

    async submitCccdVerification(req, res) {
        const { id } = req.user;
        if (!req.file) {
            throw new BadRequestError('Vui long tai anh CCCD');
        }

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) {
            throw new BadRequestError('Chi ho tro anh JPG, PNG hoac WEBP');
        }

        const imageUrl = await uploadImageToCloudinary(req.file, 'phongtro/cccd-verifications');
        let ocrResult = { data: {}, rawText: '', note: '' };

        try {
            ocrResult = await extractCccdInfo(req.file);
        } catch (error) {
            ocrResult.note = `OCR that bai: ${error.message}`;
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
            message: 'Da gui CCCD de xac thuc, vui long cho admin duyet',
            metadata: updatedUser,
        }).send(res);
    }

    async updateVerificationStatus(req, res) {
        const { id, status, reason } = req.body;
        if (!id || !['verified', 'rejected'].includes(status)) {
            throw new BadRequestError('Trang thai xac thuc khong hop le');
        }

        const updatedUser = await modelUser.findByIdAndUpdate(
            id,
            {
                verificationStatus: status,
                verifiedAt: status === 'verified' ? new Date() : null,
                verificationRejectReason: status === 'rejected' ? reason || '' : '',
            },
            { new: true },
        );

        if (!updatedUser) {
            throw new BadRequestError('Khong tim thay nguoi dung');
        }

        new OK({
            message: status === 'verified' ? 'Da xac thuc chu tro' : 'Da tu choi xac thuc',
            metadata: updatedUser,
        }).send(res);
    }

    async updateUserAdmin(req, res) {
        const { id, isActive, isAdmin } = req.body;
        if (!id) {
            throw new BadRequestError('Id người dùng bắt buộc');
        }

        const updateData = {};
        if (typeof isActive === 'boolean') updateData.isActive = isActive;
        if (typeof isAdmin === 'boolean') updateData.isAdmin = isAdmin;

        const user = await modelUser.findByIdAndUpdate(id, updateData, { new: true });
        if (!user) {
            throw new BadRequestError('Không tìm thấy người dùng');
        }

        new OK({ message: 'Cập nhật người dùng thành công', metadata: user }).send(res);
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

        if (role === 'admin') {
            filter.isAdmin = true;
        } else if (role === 'user') {
            filter.isAdmin = false;
        }

        const dataUser = await modelUser.find(filter).sort({ createdAt: -1 });
        const data = await Promise.all(
            dataUser.map(async (user) => {
                const post = await modelPost.find({
                    userId: user._id,
                    status: { $in: ['active', 'approved'] },
                    isDeleted: { $ne: true },
                });
                const totalPost = post.length;
                const totalSpent = post.reduce((sum, post) => sum + inferPostingFeeFromPost(post), 0);
                return { user, totalPost, totalSpent };
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
