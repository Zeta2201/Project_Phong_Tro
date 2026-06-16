const express = require('express');
const multer = require('multer');
const router = express.Router();
const { asyncHandler, authUser, authAdmin } = require('../auth/checkAuth');
const controllerContract = require('../controllers/contract.controller');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/api/contracts/download-public', asyncHandler(controllerContract.downloadPublicContract.bind(controllerContract)));
router.post('/api/contracts', authUser, asyncHandler(controllerContract.createContract.bind(controllerContract)));
router.get('/api/contracts', authUser, asyncHandler(controllerContract.getContracts.bind(controllerContract)));
router.get('/api/contracts/detail', authUser, asyncHandler(controllerContract.getContractDetail.bind(controllerContract)));
router.post(
    '/api/contracts/sign-tenant',
    authUser,
    upload.single('signature'),
    asyncHandler(controllerContract.signAsTenant.bind(controllerContract)),
);
router.post(
    '/api/contracts/sign-landlord',
    authUser,
    upload.single('signature'),
    asyncHandler(controllerContract.signAsLandlord.bind(controllerContract)),
);
router.post('/api/contracts/generate-pdf', authUser, asyncHandler(controllerContract.generatePdf.bind(controllerContract)));
router.post('/api/contracts/send-email', authUser, asyncHandler(controllerContract.sendEmails.bind(controllerContract)));
router.post('/api/contracts/cancel', authAdmin, asyncHandler(controllerContract.cancelContract.bind(controllerContract)));
router.get('/api/contracts/download', authUser, asyncHandler(controllerContract.downloadContract.bind(controllerContract)));

module.exports = router;
