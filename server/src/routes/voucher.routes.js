const express = require('express');
const router = express.Router();

const { asyncHandler, authUser, authAdmin } = require('../auth/checkAuth');
const controllerVoucher = require('../controllers/voucher.controller');

router.post('/api/vouchers/validate', authUser, asyncHandler(controllerVoucher.validateVoucher));
router.get('/api/admin/vouchers', authAdmin, asyncHandler(controllerVoucher.getAdminVouchers));
router.post('/api/admin/vouchers', authAdmin, asyncHandler(controllerVoucher.createVoucher));
router.post('/api/admin/update-voucher', authAdmin, asyncHandler(controllerVoucher.updateVoucher));
router.post('/api/admin/toggle-voucher', authAdmin, asyncHandler(controllerVoucher.toggleVoucher));

module.exports = router;
