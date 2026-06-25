const modelNotification = require('../models/notification.model');
const modelUser = require('../models/users.model');

const getUserRoom = (userId) => `user:${userId}`;

const normalizeUserId = (userId) => {
    if (!userId) return null;
    if (userId._id) return userId._id;
    return userId;
};

const getUnreadCount = async (userId) =>
    modelNotification.countDocuments({
        userId,
        isRead: false,
        isDeleted: false,
    });

const emitNotification = async (notification) => {
    const io = global.io;
    if (!io || !notification?.userId) return;

    const userId = notification.userId.toString();
    io.to(getUserRoom(userId)).emit('notification:new', notification);
    io.to(getUserRoom(userId)).emit('notification:unread-count', {
        count: await getUnreadCount(userId),
    });
};

const createNotification = async (userId, title, message, type = 'system', link = '', metadata = {}) => {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId || !title || !message) return null;

    const notification = await modelNotification.create({
        userId: normalizedUserId,
        title,
        message,
        type,
        link,
        metadata,
    });

    await emitNotification(notification);
    return notification;
};

const createNotifications = async (userIds = [], title, message, type = 'system', link = '', metadata = {}, options = {}) => {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean).map((id) => id.toString()))];
    return Promise.all(
        uniqueUserIds.map(async (userId) => {
            const notification = await modelNotification.create({
                userId,
                title,
                message,
                type,
                link,
                metadata,
                createdBy: options.createdBy || null,
                isBroadcast: Boolean(options.isBroadcast),
                targetRole: options.targetRole || 'user',
            });
            await emitNotification(notification);
            return notification;
        }),
    );
};

const getUserIdsByTargetRole = async (targetRole = 'all') => {
    const baseFilter = { isActive: true, accountStatus: { $ne: 'locked' } };
    const filters = {
        all: baseFilter,
        user: { ...baseFilter, role: { $nin: ['landlord', 'admin', 'super_admin'] }, isAdmin: { $ne: true } },
        landlord: { ...baseFilter, role: 'landlord' },
        admin: { ...baseFilter, $or: [{ role: { $in: ['admin', 'super_admin'] } }, { isAdmin: true }] },
    };

    const users = await modelUser.find(filters[targetRole] || filters.all).select('_id').lean();
    return users.map((user) => user._id);
};

const createBroadcastNotification = async (targetRole, title, message, type = 'system', link = '', metadata = {}, createdBy = null) => {
    const userIds = await getUserIdsByTargetRole(targetRole);
    return createNotifications(userIds, title, message, type, link, metadata, {
        createdBy,
        isBroadcast: true,
        targetRole,
    });
};

const markAsRead = async (notificationId, userId = null) => {
    const filter = { _id: notificationId, isDeleted: false };
    if (userId) filter.userId = userId;
    return modelNotification.findOneAndUpdate(filter, { isRead: true }, { new: true });
};

const markAllAsRead = async (userId) =>
    modelNotification.updateMany({ userId, isRead: false, isDeleted: false }, { isRead: true });

const getAdminUserIds = async () => {
    const admins = await modelUser
        .find({
            isActive: true,
            accountStatus: { $ne: 'locked' },
            $or: [{ role: { $in: ['admin', 'super_admin'] } }, { isAdmin: true }],
        })
        .select('_id')
        .lean();

    return admins.map((admin) => admin._id);
};

const notifyAdmins = async (title, message, type = 'system', link = '/admin', metadata = {}) => {
    const adminIds = await getAdminUserIds();
    return createNotifications(adminIds, title, message, type, link, metadata, { targetRole: 'admin' });
};

module.exports = {
    createNotification,
    createBroadcastNotification,
    createNotifications,
    emitNotification,
    getAdminUserIds,
    getUserIdsByTargetRole,
    getUnreadCount,
    getUserRoom,
    markAllAsRead,
    markAsRead,
    notifyAdmins,
};
