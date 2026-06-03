const express = require('express');
const router = express.Router();
const { asyncHandler, authAdmin } = require('../auth/checkAuth');
const controllerPostingPlan = require('../controllers/postingPlan.controller');

router.get('/api/posting-plans', asyncHandler(controllerPostingPlan.getPublicPlans));
router.get('/api/admin/posting-plans', authAdmin, asyncHandler(controllerPostingPlan.getAdminPlans));
router.post('/api/admin/posting-plans', authAdmin, asyncHandler(controllerPostingPlan.createPlan));
router.post('/api/admin/update-posting-plan', authAdmin, asyncHandler(controllerPostingPlan.updatePlan));
router.post('/api/admin/toggle-posting-plan', authAdmin, asyncHandler(controllerPostingPlan.togglePlan));

module.exports = router;
