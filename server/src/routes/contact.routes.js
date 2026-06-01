const express = require('express');
const router = express.Router();

const { asyncHandler, authAdmin } = require('../auth/checkAuth');
const controllerContact = require('../controllers/contact.controller');

router.post('/api/create-contact', asyncHandler(controllerContact.createContact));
router.get('/api/get-contacts', authAdmin, asyncHandler(controllerContact.getContacts));
router.post('/api/update-contact', authAdmin, asyncHandler(controllerContact.updateContact));

module.exports = router;
