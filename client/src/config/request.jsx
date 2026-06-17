import axios from 'axios';

import cookies from 'js-cookie';

const request = axios.create({
    baseURL: 'http://localhost:3000',
    withCredentials: true,
});

export const requestAddSearch = async (data) => {
    const res = await request.post('/api/add-search-keyword', data);
    return res.data;
};

export const requestResetPassword = async (data) => {
    const res = await request.post('/api/reset-password', data);
    return res.data;
};

export const requestForgotPassword = async (data) => {
    const res = await request.post('/api/forgot-password', data);
    return res.data;
};

export const requestGetHotSearch = async () => {
    const res = await request.get('/api/get-search-keyword');
    return res.data;
};

export const requestSearch = async (keyword) => {
    const res = await request.get('/api/search', { params: { keyword } });
    return res.data;
};

export const requestChatbot = async (data) => {
    const res = await request.post('/chat', data);
    return res.data;
};

export const requestPostSuggest = async () => {
    const res = await request.get('/api/post-suggest');
    return res.data;
};

export const requestAISearch = async (question) => {
    const res = await request.get('/ai-search', { params: { question } });
    return res.data;
};

export const requestRegister = async (data) => {
    const response = await request.post('/api/register', data);
    return response.data;
};

export const requestLoginGoogle = async (data) => {
    const res = await request.post('/api/login-google', data);
    return res.data;
};

export const requestGetAdmin = async () => {
    const res = await request.get('/admin');
    return res.data;
};

export const requestLogin = async (data) => {
    const res = await request.post('/api/login', data);
    return res.data;
};

export const requestAuth = async () => {
    const res = await request.get('/api/auth');
    return res.data;
};

export const requestLogout = async () => {
    const res = await request.get('/api/logout');
    return res.data;
};

export const requestRefreshToken = async () => {
    const res = await request.get('/api/refresh-token');
    return res.data;
};

export const requestUpdateUser = async (data) => {
    const res = await request.post('/api/update-user', data);
    return res.data;
};

export const requestSubmitCccdVerification = async (data) => {
    const res = await request.post('/api/submit-cccd-verification', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

export const requestUpdateVerificationStatus = async (data) => {
    const res = await request.post('/api/admin/update-verification-status', data);
    return res.data;
};

export const requestChangePassword = async (data) => {
    const res = await request.post('/api/change-password', data);
    return res.data;
};

export const requestGetUsers = async (params = {}) => {
    const res = await request.get('/api/get-users', { params });
    return res.data;
};

export const requestGetReports = async (params = {}) => {
    const res = await request.get('/api/get-reports', { params });
    return res.data;
};

export const requestUpdateReportStatus = async (data) => {
    const res = await request.post('/api/update-report', data);
    return res.data;
};

export const requestReportPost = async (data) => {
    const res = await request.post('/api/report-post', data);
    return res.data;
};

export const requestUpdateUserAdmin = async (data) => {
    const res = await request.post('/api/update-user-admin', data);
    return res.data;
};

export const requestGetAdminStats = async () => {
    const res = await request.get('/api/get-admin-stats');
    return res.data;
};

export const requestGetRechargeStats = async (params = {}) => {
    const res = await request.get('/api/get-recharge-stats', { params });
    return res.data;
};

//// posts

export const requestUploadImages = async (data) => {
    const res = await request.post('/api/upload-images', data);
    return res.data;
};

export const requestCreatePost = async (data) => {
    const res = await request.post('/api/create-post', data);
    return res.data;
};

export const requestGetNewPost = async () => {
    const res = await request.get('/api/get-new-post');
    return res.data;
};

export const requestGetPostVip = async () => {
    const res = await request.get('/api/get-post-vip');
    return res.data;
};

export const requestRejectPost = async (data) => {
    const res = await request.post('/api/reject-post', data);
    return res.data;
};

export const requestDeletePost = async (data) => {
    const res = data?.id ? await request.patch(`/api/posts/${data.id}/delete`) : await request.post('/api/delete-post', data);
    return res.data;
};

export const requestRestorePost = async (id) => {
    const res = await request.patch(`/api/posts/${id}/restore`);
    return res.data;
};

export const requestUpdatePostAvailability = async (data) => {
    const res = await request.post('/api/update-post-availability', data);
    return res.data;
};

export const requestGetAllPosts = async (data) => {
    const res = await request.get('/api/get-all-posts', { params: data });
    return res.data;
};

export const requestApprovePost = async (data) => {
    const res = await request.post('/api/approve-post', data);
    return res.data;
};

//// favourite

export const requestCreateFavourite = async (data) => {
    const res = await request.post('/api/create-favourite', data);
    return res.data;
};

export const requestDeleteFavourite = async (data) => {
    const res = await request.post('/api/delete-favourite', data);
    return res.data;
};

export const requestGetFavourite = async () => {
    const res = await request.get('/api/get-favourite');
    return res.data;
};

export const requestGetPosts = async (params) => {
    // Filter out parameters with empty string values
    const filteredParams = Object.entries(params)
        .filter(([, value]) => value !== '')
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {});

    const res = await request.get('/api/get-posts', { params: filteredParams });
    return res.data;
};

export const requestGetMapPosts = async (params) => {
    const filteredParams = Object.entries(params || {})
        .filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {});

    const res = await request.get('/api/posts/map', { params: filteredParams });
    return res.data;
};

//// filter options

export const requestGetFilterOptions = async () => {
    const res = await request.get('/api/filter-options');
    return res.data;
};

export const requestGetAdminFilterOptions = async (params = {}) => {
    const res = await request.get('/api/admin/filter-options', { params });
    return res.data;
};

export const requestGetPostingPlans = async () => {
    const res = await request.get('/api/posting-plans');
    return res.data;
};

export const requestGetAdminPostingPlans = async () => {
    const res = await request.get('/api/admin/posting-plans');
    return res.data;
};

export const requestCreatePostingPlan = async (data) => {
    const res = await request.post('/api/admin/posting-plans', data);
    return res.data;
};

export const requestUpdatePostingPlan = async (data) => {
    const res = await request.post('/api/admin/update-posting-plan', data);
    return res.data;
};

export const requestTogglePostingPlan = async (data) => {
    const res = await request.post('/api/admin/toggle-posting-plan', data);
    return res.data;
};

export const requestValidateVoucher = async (data) => {
    const res = await request.post('/api/vouchers/validate', data);
    return res.data;
};

export const requestGetAdminVouchers = async () => {
    const res = await request.get('/api/admin/vouchers');
    return res.data;
};

export const requestCreateVoucher = async (data) => {
    const res = await request.post('/api/admin/vouchers', data);
    return res.data;
};

export const requestUpdateVoucher = async (data) => {
    const res = await request.post('/api/admin/update-voucher', data);
    return res.data;
};

export const requestToggleVoucher = async (data) => {
    const res = await request.post('/api/admin/toggle-voucher', data);
    return res.data;
};

export const requestGetActiveBanner = async () => {
    const res = await request.get('/api/banners/active');
    return res.data;
};

export const requestGetAdminBanners = async () => {
    const res = await request.get('/api/admin/banners');
    return res.data;
};

export const requestCreateBanner = async (data) => {
    const res = await request.post('/api/admin/banners', data);
    return res.data;
};

export const requestUpdateBanner = async (data) => {
    const res = await request.post('/api/admin/update-banner', data);
    return res.data;
};

export const requestToggleBanner = async (data) => {
    const res = await request.post('/api/admin/toggle-banner', data);
    return res.data;
};

export const requestCreateFilterOption = async (data) => {
    const res = await request.post('/api/admin/filter-options', data);
    return res.data;
};

export const requestUpdateFilterOption = async (data) => {
    const res = await request.post('/api/admin/update-filter-option', data);
    return res.data;
};

export const requestToggleFilterOption = async (data) => {
    const res = await request.post('/api/admin/toggle-filter-option', data);
    return res.data;
};

export const requestGetPostById = async (id) => {
    const res = await request.get(`/api/get-post-by-id`, { params: { id } });
    return res.data;
};

export const requestPayments = async (data) => {
    const res = await request.post('/api/payments', data);
    return res.data;
};

export const requestGetRechargeUser = async () => {
    const res = await request.get('/api/recharge-user');
    return res.data;
};

export const requestGetPostByUserId = async () => {
    const res = await request.get('/api/get-post-by-user-id');
    return res.data;
};

export const requestGetOwnerAnalytics = async () => {
    const res = await request.get('/api/owner/analytics');
    return res.data;
};

//// reservations

export const requestCreateReservation = async (data) => {
    const res = await request.post('/api/create-reservation', data);
    return res.data;
};

export const requestGetReservations = async (params = {}) => {
    const res = await request.get('/api/get-reservations', { params });
    return res.data;
};

export const requestUpdateReservation = async (data) => {
    const res = await request.post('/api/update-reservation', data);
    return res.data;
};

//// deposits

export const requestCreateDeposit = async (data) => {
    const res = await request.post('/api/deposits', data);
    return res.data;
};

export const requestPayDeposit = async (data) => {
    const res = await request.post('/api/deposits/pay', data);
    return res.data;
};

export const requestGetMyDeposits = async () => {
    const res = await request.get('/api/deposits/my');
    return res.data;
};

export const requestGetLandlordDeposits = async () => {
    const res = await request.get('/api/deposits/landlord');
    return res.data;
};

export const requestTenantConfirmDeposit = async (data) => {
    const res = await request.post('/api/deposits/tenant-confirm', data);
    return res.data;
};

export const requestLandlordConfirmDeposit = async (data) => {
    const res = await request.post('/api/deposits/landlord-confirm', data);
    return res.data;
};

export const requestCancelDeposit = async (data) => {
    const res = await request.post('/api/deposits/cancel', data);
    return res.data;
};

export const requestDisputeDeposit = async (data) => {
    const res = await request.post('/api/deposits/dispute', data);
    return res.data;
};

export const requestGetAdminDeposits = async (params = {}) => {
    const res = await request.get('/api/admin/deposits', { params });
    return res.data;
};

export const requestAdminDepositAction = async (data) => {
    const res = await request.post('/api/admin/deposits/action', data);
    return res.data;
};

//// contracts

export const requestCreateContract = async (data) => {
    const res = await request.post('/api/contracts', data);
    return res.data;
};

export const requestGetContracts = async (params = {}) => {
    const res = await request.get('/api/contracts', { params });
    return res.data;
};

export const requestGetContractDetail = async (id) => {
    const res = await request.get('/api/contracts/detail', { params: { id } });
    return res.data;
};

export const requestSignTenantContract = async (data) => {
    const res = await request.post('/api/contracts/sign-tenant', data);
    return res.data;
};

export const requestSignLandlordContract = async (data) => {
    const res = await request.post('/api/contracts/sign-landlord', data);
    return res.data;
};

export const requestGenerateContractPdf = async (data) => {
    const res = await request.post('/api/contracts/generate-pdf', data);
    return res.data;
};

export const requestSendContractEmail = async (data) => {
    const res = await request.post('/api/contracts/send-email', data);
    return res.data;
};

export const requestCancelContract = async (data) => {
    const res = await request.post('/api/contracts/cancel', data);
    return res.data;
};

//// reviews

export const requestGetReviewsByRoom = async (roomId) => {
    const res = await request.get('/api/get-reviews-by-room', { params: { roomId } });
    return res.data;
};

export const requestCreateReview = async (data) => {
    const res = await request.post('/api/create-review', data);
    return res.data;
};

export const requestUpdateReview = async (data) => {
    const res = await request.post('/api/update-review', data);
    return res.data;
};

export const requestDeleteReview = async (data) => {
    const res = await request.post('/api/delete-review', data);
    return res.data;
};

export const requestReplyReview = async (data) => {
    const res = await request.post('/api/reply-review', data);
    return res.data;
};

export const requestReportReview = async (data) => {
    const res = await request.post('/api/report-review', data);
    return res.data;
};

export const requestGetAdminReviews = async (params = {}) => {
    const res = await request.get('/api/admin/reviews', { params });
    return res.data;
};

export const requestUpdateReviewStatus = async (data) => {
    const res = await request.post('/api/admin/update-review-status', data);
    return res.data;
};

//// comments

export const requestGetCommentsByPost = async (postId) => {
    const res = await request.get('/api/get-comments-by-post', { params: { postId } });
    return res.data;
};

export const requestCreateComment = async (data) => {
    const res = await request.post('/api/create-comment', data);
    return res.data;
};

export const requestDeleteComment = async (data) => {
    const res = await request.post('/api/delete-comment', data);
    return res.data;
};

export const requestGetAdminComments = async (params = {}) => {
    const res = await request.get('/api/admin/comments', { params });
    return res.data;
};

export const requestUpdateCommentStatus = async (data) => {
    const res = await request.post('/api/admin/update-comment-status', data);
    return res.data;
};

//// contacts

export const requestCreateContact = async (data) => {
    const res = await request.post('/api/create-contact', data);
    return res.data;
};

export const requestGetContacts = async (params = {}) => {
    const res = await request.get('/api/get-contacts', { params });
    return res.data;
};

export const requestUpdateContact = async (data) => {
    const res = await request.post('/api/update-contact', data);
    return res.data;
};

//// messenger

export const requestCreateMessage = async (data) => {
    const res = await request.post('/api/create-message', data);
    return res.data;
};

export const requestGetMessages = async (data) => {
    const res = await request.get('/api/get-messages', { params: data });
    return res.data;
};

export const requestGetMessagesByUserId = async () => {
    const res = await request.get('/api/get-messages-by-user-id');
    return res.data;
};

export const requestMarkMessageRead = async (data) => {
    const res = await request.post('/api/mark-message-read', data);
    return res.data;
};

export const requestMarkAllMessagesRead = async (data) => {
    const res = await request.post('/api/mark-all-messages-read', data);
    return res.data;
};

export const requestUploadImage = async (data) => {
    const res = await request.post('/api/upload-image', data);
    return res.data;
};

let isRefreshing = false;
let failedRequestsQueue = [];

request.interceptors.response.use(
    (response) => response, // Trả về nếu không có lỗi
    async (error) => {
        const originalRequest = error.config;

        // Nếu lỗi 401 (Unauthorized) và request chưa từng thử refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            if (!isRefreshing) {
                isRefreshing = true;

                try {
                    // Gửi yêu cầu refresh token
                    const token = cookies.get('logged');
                    if (!token) {
                        return;
                    }
                    await requestRefreshToken();

                    // Xử lý lại tất cả các request bị lỗi 401 trước đó
                    failedRequestsQueue.forEach((req) => req.resolve());
                    failedRequestsQueue = [];
                } catch (refreshError) {
                    // Nếu refresh thất bại, đăng xuất
                    failedRequestsQueue.forEach((req) => req.reject(refreshError));
                    failedRequestsQueue = [];
                    localStorage.clear();
                    window.location.href = '/login'; // Chuyển về trang đăng nhập
                } finally {
                    isRefreshing = false;
                }
            }

            // Trả về một Promise để retry request sau khi token mới được cập nhật
            return new Promise((resolve, reject) => {
                failedRequestsQueue.push({
                    resolve: () => {
                        resolve(request(originalRequest));
                    },
                    reject: (err) => reject(err),
                });
            });
        }

        return Promise.reject(error);
    },
);
