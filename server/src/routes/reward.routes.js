const express = require('express');
const router = express.Router();

const { asyncHandler, authUser, authAdmin } = require('../auth/checkAuth');
const controllerReward = require('../controllers/reward.controller');

router.get('/api/rewards/me', authUser, asyncHandler(controllerReward.getMyReward));
router.get('/api/rewards/history', authUser, asyncHandler(controllerReward.getHistory));
router.get('/api/rewards/vouchers', authUser, asyncHandler(controllerReward.getRewardVouchers));
router.post('/api/rewards/redeem/:voucherId', authUser, asyncHandler(controllerReward.redeem));
router.get('/api/rewards/my-vouchers', authUser, asyncHandler(controllerReward.getMyVouchers));

router.get('/api/admin/rewards/users', authAdmin, asyncHandler(controllerReward.getRewardUsers));
router.get('/api/admin/rewards/transactions', authAdmin, asyncHandler(controllerReward.getTransactions));
router.patch('/api/admin/rewards/users/:id/adjust', authAdmin, asyncHandler(controllerReward.adjustUserPoints));
router.post('/api/admin/rewards/backfill-listing-points', authAdmin, asyncHandler(controllerReward.backfillListingPoints));
router.get('/api/admin/rewards/vouchers', authAdmin, asyncHandler(controllerReward.getAdminRewardVouchers));
router.post('/api/admin/rewards/vouchers', authAdmin, asyncHandler(controllerReward.createRewardVoucher));
router.patch('/api/admin/rewards/vouchers/:id', authAdmin, asyncHandler(controllerReward.updateRewardVoucher));
router.delete('/api/admin/rewards/vouchers/:id', authAdmin, asyncHandler(controllerReward.deleteRewardVoucher));

module.exports = router;
