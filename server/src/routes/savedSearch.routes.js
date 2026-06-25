const express = require('express');
const router = express.Router();
const { asyncHandler, authUser } = require('../auth/checkAuth');
const controllerSavedSearch = require('../controllers/savedSearch.controller');

router.post('/api/saved-searches', authUser, asyncHandler(controllerSavedSearch.create));
router.get('/api/saved-searches', authUser, asyncHandler(controllerSavedSearch.getMine));
router.patch('/api/saved-searches/:id', authUser, asyncHandler(controllerSavedSearch.update));
router.delete('/api/saved-searches/:id', authUser, asyncHandler(controllerSavedSearch.remove));

module.exports = router;
