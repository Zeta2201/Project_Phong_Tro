const express = require('express');
const router = express.Router();

const { asyncHandler, authUser, authAdmin } = require('../auth/checkAuth');
const controllerReview = require('../controllers/review.controller');

router.get('/api/get-reviews-by-room', asyncHandler(controllerReview.getReviewsByRoom));
router.post('/api/create-review', authUser, asyncHandler(controllerReview.createReview));
router.post('/api/update-review', authUser, asyncHandler(controllerReview.updateReview));
router.post('/api/delete-review', authUser, asyncHandler(controllerReview.deleteReview));
router.post('/api/reply-review', authUser, asyncHandler(controllerReview.replyReview));
router.post('/api/report-review', authUser, asyncHandler(controllerReview.reportReview));

router.get('/api/admin/reviews', authAdmin, asyncHandler(controllerReview.getAllReviews));
router.post('/api/admin/update-review-status', authAdmin, asyncHandler(controllerReview.updateReviewStatus));

module.exports = router;
