const express = require('express');
const router = express.Router();

const { asyncHandler, authUser, authAdmin } = require('../auth/checkAuth');
const controllerComment = require('../controllers/comment.controller');

router.get('/api/get-comments-by-post', asyncHandler(controllerComment.getCommentsByPost));
router.post('/api/create-comment', authUser, asyncHandler(controllerComment.createComment));
router.post('/api/delete-comment', authUser, asyncHandler(controllerComment.deleteComment));
router.get('/api/admin/comments', authAdmin, asyncHandler(controllerComment.getAllComments));
router.post('/api/admin/update-comment-status', authAdmin, asyncHandler(controllerComment.updateCommentStatus));

module.exports = router;
