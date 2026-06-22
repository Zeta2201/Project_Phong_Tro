const userRoutes = require('./users.routes');
const postRoutes = require('./posts.routes');
const paymentsRoutes = require('./payments.routes');
const messengerRoutes = require('./messenger.routes');
const favouriteRoutes = require('./favourite.routes');
const reportRoutes = require('./report.routes');
const reservationRoutes = require('./reservation.routes');
const reviewRoutes = require('./review.routes');
const commentRoutes = require('./comment.routes');
const contactRoutes = require('./contact.routes');
const depositRoutes = require('./deposit.routes');
const filterOptionRoutes = require('./filterOption.routes');
const postingPlanRoutes = require('./postingPlan.routes');
const contractRoutes = require('./contract.routes');
const voucherRoutes = require('./voucher.routes');
const bannerRoutes = require('./banner.routes');
const rewardRoutes = require('./reward.routes');
const notificationRoutes = require('./notification.routes');

const multer = require('multer');
const { uploadImageToCloudinary } = require('../utils/cloudinaryUpload');

const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

function routes(app) {
    app.post('/api/register', userRoutes);
    app.post('/api/register/request-otp', userRoutes);
    app.post('/api/login', userRoutes);
    app.post('/api/login-google', userRoutes);
    app.get('/api/auth', userRoutes);
    app.get('/api/logout', userRoutes);
    app.get('/api/refresh-token', userRoutes);
    app.get('/api/recharge-user', userRoutes);
    app.post('/api/update-user', userRoutes);
    app.post('/api/users/request-change-phone', userRoutes);
    app.post('/api/users/verify-change-phone', userRoutes);
    app.post('/api/users/request-change-email', userRoutes);
    app.post('/api/users/verify-change-email', userRoutes);
    app.post('/api/submit-cccd-verification', userRoutes);
    app.post('/api/admin/update-verification-status', userRoutes);
    app.post('/api/update-user-admin', userRoutes);
    app.patch('/api/admin/users/:id/lock', userRoutes);
    app.patch('/api/admin/users/:id/unlock', userRoutes);
    app.patch('/api/admin/users/:id/promote', userRoutes);
    app.patch('/api/admin/users/:id/demote', userRoutes);
    app.post('/api/change-password', userRoutes);

    app.get('/api/get-users', userRoutes);
    app.get('/api/get-admin-stats', userRoutes);
    app.get('/api/get-recharge-stats', userRoutes);
    app.get('/api/admin/notifications', notificationRoutes);
    app.post('/api/admin/notifications/broadcast', notificationRoutes);
    app.get('/api/admin/notifications/history', notificationRoutes);
    app.get('/api/notifications', notificationRoutes);
    app.get('/api/notifications/unread-count', notificationRoutes);
    app.patch('/api/notifications/read-all', notificationRoutes);
    app.patch('/api/notifications/:id/read', notificationRoutes);
    app.delete('/api/notifications/:id', notificationRoutes);

    app.get('/api/get-hot-search', userRoutes);
    app.get('/api/search', userRoutes);

    app.post('/api/add-search-keyword', userRoutes);
    app.get('/api/get-search-keyword', userRoutes);

    app.post('/api/forgot-password', userRoutes);
    app.post('/api/reset-password', userRoutes);

    app.post('/api/report-post', reportRoutes);
    app.get('/api/get-reports', reportRoutes);
    app.post('/api/update-report', reportRoutes);

    /// reservations
    app.post('/api/create-reservation', reservationRoutes);
    app.get('/api/get-reservations', reservationRoutes);
    app.post('/api/update-reservation', reservationRoutes);

    /// reviews
    app.get('/api/get-reviews-by-room', reviewRoutes);
    app.post('/api/create-review', reviewRoutes);
    app.post('/api/update-review', reviewRoutes);
    app.post('/api/delete-review', reviewRoutes);
    app.post('/api/reply-review', reviewRoutes);
    app.post('/api/report-review', reviewRoutes);
    app.get('/api/admin/reviews', reviewRoutes);
    app.post('/api/admin/update-review-status', reviewRoutes);

    /// comments
    app.get('/api/get-comments-by-post', commentRoutes);
    app.post('/api/create-comment', commentRoutes);
    app.post('/api/delete-comment', commentRoutes);
    app.get('/api/admin/comments', commentRoutes);
    app.post('/api/admin/update-comment-status', commentRoutes);

    /// contacts
    app.post('/api/create-contact', contactRoutes);
    app.get('/api/get-contacts', contactRoutes);
    app.post('/api/update-contact', contactRoutes);

    /// deposits
    app.post('/api/deposits', depositRoutes);
    app.post('/api/deposits/pay', depositRoutes);
    app.get('/api/deposits/payment/momo-return', depositRoutes);
    app.get('/api/deposits/payment/vnpay-return', depositRoutes);
    app.get('/api/deposits/my', depositRoutes);
    app.get('/api/deposits/landlord', depositRoutes);
    app.post('/api/deposits/tenant-confirm', depositRoutes);
    app.post('/api/deposits/landlord-confirm', depositRoutes);
    app.post('/api/deposits/cancel', depositRoutes);
    app.post('/api/deposits/dispute', depositRoutes);
    app.get('/api/admin/deposits', depositRoutes);
    app.post('/api/admin/deposits/action', depositRoutes);

    /// contracts
    app.post('/api/contracts', contractRoutes);
    app.get('/api/contracts', contractRoutes);
    app.get('/api/contracts/detail', contractRoutes);
    app.post('/api/contracts/sign-tenant', contractRoutes);
    app.post('/api/contracts/sign-landlord', contractRoutes);
    app.post('/api/contracts/generate-pdf', contractRoutes);
    app.post('/api/contracts/send-email', contractRoutes);
    app.post('/api/contracts/cancel', contractRoutes);
    app.get('/api/contracts/download', contractRoutes);
    app.get('/api/contracts/download-public', contractRoutes);

    /// filter options
    app.get('/api/filter-options', filterOptionRoutes);
    app.get('/api/admin/filter-options', filterOptionRoutes);
    app.post('/api/admin/filter-options', filterOptionRoutes);
    app.post('/api/admin/update-filter-option', filterOptionRoutes);
    app.post('/api/admin/toggle-filter-option', filterOptionRoutes);

    /// posting plans
    app.get('/api/posting-plans', postingPlanRoutes);
    app.get('/api/admin/posting-plans', postingPlanRoutes);
    app.post('/api/admin/posting-plans', postingPlanRoutes);
    app.post('/api/admin/update-posting-plan', postingPlanRoutes);
    app.post('/api/admin/toggle-posting-plan', postingPlanRoutes);

    /// vouchers
    app.post('/api/vouchers/validate', voucherRoutes);
    app.get('/api/admin/vouchers', voucherRoutes);
    app.post('/api/admin/vouchers', voucherRoutes);
    app.post('/api/admin/update-voucher', voucherRoutes);
    app.post('/api/admin/toggle-voucher', voucherRoutes);

    /// rewards
    app.get('/api/rewards/me', rewardRoutes);
    app.get('/api/rewards/history', rewardRoutes);
    app.get('/api/rewards/vouchers', rewardRoutes);
    app.post('/api/rewards/redeem/:voucherId', rewardRoutes);
    app.get('/api/rewards/my-vouchers', rewardRoutes);
    app.get('/api/admin/rewards/users', rewardRoutes);
    app.get('/api/admin/rewards/transactions', rewardRoutes);
    app.patch('/api/admin/rewards/users/:id/adjust', rewardRoutes);
    app.post('/api/admin/rewards/backfill-listing-points', rewardRoutes);
    app.get('/api/admin/rewards/vouchers', rewardRoutes);
    app.post('/api/admin/rewards/vouchers', rewardRoutes);
    app.patch('/api/admin/rewards/vouchers/:id', rewardRoutes);
    app.delete('/api/admin/rewards/vouchers/:id', rewardRoutes);

    /// banners
    app.get('/api/banners/active', bannerRoutes);
    app.get('/api/admin/banners', bannerRoutes);
    app.post('/api/admin/banners', bannerRoutes);
    app.post('/api/admin/update-banner', bannerRoutes);
    app.post('/api/admin/toggle-banner', bannerRoutes);

    /// posts
    app.post('/api/create-post', postRoutes);
    app.get('/api/get-posts', postRoutes);
    app.get('/api/posts/map', postRoutes);
    app.get('/api/get-post-by-id', postRoutes);
    app.get('/api/get-post-by-user-id', postRoutes);
    app.get('/api/owner/analytics', postRoutes);
    app.get('/api/get-new-post', postRoutes);
    app.get('/api/get-post-vip', postRoutes);
    app.patch('/api/posts/:id/delete', postRoutes);
    app.patch('/api/posts/:id/restore', postRoutes);
    app.post('/api/delete-post', postRoutes);
    app.post('/api/update-post-availability', postRoutes);

    //// admin post
    app.get('/api/get-all-posts', postRoutes);
    app.post('/api/approve-post', postRoutes);
    app.post('/api/reject-post', postRoutes);

    /// payments
    app.post('/api/payments', paymentsRoutes);
    app.get('/api/check-payment-vnpay', paymentsRoutes);
    app.get('/api/check-payment-momo', paymentsRoutes);

    /// post suggest
    app.get('/api/post-suggest', postRoutes);

    /// messenger
    app.post('/api/create-message', messengerRoutes);
    app.get('/api/get-messages', messengerRoutes);
    app.get('/api/get-messages-by-user-id', messengerRoutes);
    app.post('/api/mark-message-read', messengerRoutes);
    app.post('/api/mark-all-messages-read', messengerRoutes);

    //// favourite
    app.post('/api/create-favourite', favouriteRoutes);
    app.post('/api/delete-favourite', favouriteRoutes);
    app.get('/api/get-favourite', favouriteRoutes);

    ///// uploads
    app.post('/api/upload-images', upload.array('images'), async (req, res, next) => {
        try {
            const images = await Promise.all(req.files.map((file) => uploadImageToCloudinary(file)));

            return res.status(200).json({
                message: 'Images uploaded successfully',
                images,
            });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/upload-image', upload.single('avatar'), async (req, res, next) => {
        try {
            const image = await uploadImageToCloudinary(req.file);

            return res.status(200).json({
                message: 'Image uploaded successfully',
                image,
            });
        } catch (error) {
            next(error);
        }
    });

    app.get('/admin', userRoutes);
}

module.exports = routes;
