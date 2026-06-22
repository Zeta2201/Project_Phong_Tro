const express = require('express');
const router = express.Router();
const { asyncHandler, authUser, authAdmin } = require('../auth/checkAuth');
const controllerNotification = require('../controllers/notification.controller');

router.get('/api/admin/notifications', authAdmin, asyncHandler(controllerNotification.getAdminNotifications));
router.post('/api/admin/notifications/broadcast', authAdmin, asyncHandler(controllerNotification.broadcast));
router.get('/api/admin/notifications/history', authAdmin, asyncHandler(controllerNotification.getAdminHistory));

router.get('/api/notifications', authUser, asyncHandler(controllerNotification.getNotifications));
router.get('/api/notifications/unread-count', authUser, asyncHandler(controllerNotification.getUnreadCount));
router.patch('/api/notifications/read-all', authUser, asyncHandler(controllerNotification.markAllAsRead));
router.patch('/api/notifications/:id/read', authUser, asyncHandler(controllerNotification.markAsRead));
router.delete('/api/notifications/:id', authUser, asyncHandler(controllerNotification.deleteNotification));

module.exports = router;
