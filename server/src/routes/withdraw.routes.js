const express = require('express');
const router = express.Router();
const { asyncHandler, authUser, authAdmin } = require('../auth/checkAuth');
const controllerWithdraw = require('../controllers/withdraw.controller');

router.post('/api/withdraw-requests', authUser, asyncHandler(controllerWithdraw.createWithdrawRequest));
router.get('/api/withdraw-requests/me', authUser, asyncHandler(controllerWithdraw.getMyWithdrawRequests));
router.patch('/api/withdraw-requests/:id/cancel', authUser, asyncHandler(controllerWithdraw.cancelWithdrawRequest));
router.get('/api/admin/withdraw-requests', authAdmin, asyncHandler(controllerWithdraw.getAdminWithdrawRequests));
router.patch('/api/admin/withdraw-requests/:id/action', authAdmin, asyncHandler(controllerWithdraw.adminAction));

module.exports = router;
