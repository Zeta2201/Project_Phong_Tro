const express = require('express');
const router = express.Router();

const { asyncHandler, authUser, authAdmin } = require('../auth/checkAuth');
const controllerReport = require('../controllers/report.controller');

router.post('/api/report-post', authUser, asyncHandler(controllerReport.createReport));
router.get('/api/get-reports', authAdmin, asyncHandler(controllerReport.getReports));
router.post('/api/update-report', authAdmin, asyncHandler(controllerReport.updateReport));

module.exports = router;
