const express = require('express');
const router = express.Router();

const { asyncHandler, authAdmin } = require('../auth/checkAuth');
const controllerFilterOption = require('../controllers/filterOption.controller');

router.get('/api/filter-options', asyncHandler(controllerFilterOption.getPublicOptions));
router.get('/api/admin/filter-options', authAdmin, asyncHandler(controllerFilterOption.getAdminOptions));
router.post('/api/admin/filter-options', authAdmin, asyncHandler(controllerFilterOption.createOption));
router.post('/api/admin/update-filter-option', authAdmin, asyncHandler(controllerFilterOption.updateOption));
router.post('/api/admin/toggle-filter-option', authAdmin, asyncHandler(controllerFilterOption.toggleOption));

module.exports = router;
