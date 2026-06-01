const express = require('express');
const router = express.Router();
const { asyncHandler, authUser, authAdmin } = require('../auth/checkAuth');
const controllerDeposit = require('../controllers/deposit.controller');

router.post('/api/deposits', authUser, asyncHandler(controllerDeposit.createDeposit));
router.post('/api/deposits/pay', authUser, asyncHandler(controllerDeposit.payDeposit));
router.get('/api/deposits/payment/momo-return', asyncHandler(controllerDeposit.momoReturn));
router.get('/api/deposits/payment/vnpay-return', asyncHandler(controllerDeposit.vnpayReturn));
router.get('/api/deposits/my', authUser, asyncHandler(controllerDeposit.getMyDeposits));
router.get('/api/deposits/landlord', authUser, asyncHandler(controllerDeposit.getLandlordDeposits));
router.post('/api/deposits/tenant-confirm', authUser, asyncHandler(controllerDeposit.tenantConfirm));
router.post('/api/deposits/landlord-confirm', authUser, asyncHandler(controllerDeposit.landlordConfirm));
router.post('/api/deposits/cancel', authUser, asyncHandler(controllerDeposit.cancelDeposit));
router.post('/api/deposits/dispute', authUser, asyncHandler(controllerDeposit.disputeDeposit));
router.get('/api/admin/deposits', authAdmin, asyncHandler(controllerDeposit.getAllDeposits));
router.post('/api/admin/deposits/action', authAdmin, asyncHandler(controllerDeposit.adminAction));

module.exports = router;
