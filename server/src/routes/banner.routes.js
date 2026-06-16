const express = require('express');
const router = express.Router();

const { asyncHandler, authAdmin } = require('../auth/checkAuth');
const controllerBanner = require('../controllers/banner.controller');

router.get('/api/banners/active', asyncHandler(controllerBanner.getActiveBanner));
router.get('/api/admin/banners', authAdmin, asyncHandler(controllerBanner.getAdminBanners));
router.post('/api/admin/banners', authAdmin, asyncHandler(controllerBanner.createBanner));
router.post('/api/admin/update-banner', authAdmin, asyncHandler(controllerBanner.updateBanner));
router.post('/api/admin/toggle-banner', authAdmin, asyncHandler(controllerBanner.toggleBanner));

module.exports = router;
