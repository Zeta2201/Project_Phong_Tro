const mongoose = require('mongoose');
const modelNotification = require('../models/notification.model');
const { OK } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const {
    createBroadcastNotification,
    getUnreadCount,
    markAllAsRead: markAllNotificationsAsRead,
    markAsRead: markNotificationAsRead,
} = require('../services/notification.service');

const NOTIFICATION_TYPES = ['post', 'deposit', 'contract', 'chat', 'voucher', 'report', 'verification', 'maintenance', 'system'];
const TARGET_ROLES = ['all', 'user', 'landlord', 'admin'];

const buildAdminFilter = (query = {}) => {
    const filter = { isDeleted: false };
    if (query.type) filter.type = query.type;
    if (query.targetRole) filter.targetRole = query.targetRole;
    if (query.isBroadcast !== undefined) filter.isBroadcast = query.isBroadcast === 'true';
    if (query.from || query.to) {
        filter.createdAt = {};
        if (query.from) filter.createdAt.$gte = new Date(query.from);
        if (query.to) filter.createdAt.$lte = new Date(query.to);
    }
    return filter;
};

class controllerNotification {
    async getNotifications(req, res) {
        const { id: userId } = req.user;
        const page = Math.max(Number(req.query.page || 1), 1);
        const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);
        const skip = (page - 1) * limit;

        const filter = { userId, isDeleted: false };
        const [notifications, total, unreadCount] = await Promise.all([
            modelNotification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            modelNotification.countDocuments(filter),
            getUnreadCount(userId),
        ]);

        new OK({
            message: 'Lay danh sach thong bao thanh cong',
            metadata: {
                notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
                unreadCount,
            },
        }).send(res);
    }

    async getUnreadCount(req, res) {
        const count = await getUnreadCount(req.user.id);
        new OK({ message: 'Lay so thong bao chua doc thanh cong', metadata: { count } }).send(res);
    }

    async markAsRead(req, res) {
        const { id: userId } = req.user;
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) throw new BadRequestError('Thong bao khong hop le');

        const notification = await markNotificationAsRead(id, userId);
        if (!notification) throw new BadRequestError('Thong bao khong ton tai');

        new OK({
            message: 'Da danh dau thong bao da doc',
            metadata: { notification, unreadCount: await getUnreadCount(userId) },
        }).send(res);
    }

    async markAllAsRead(req, res) {
        const { id: userId } = req.user;
        await markAllNotificationsAsRead(userId);
        new OK({ message: 'Da danh dau tat ca thong bao da doc', metadata: { unreadCount: 0 } }).send(res);
    }

    async deleteNotification(req, res) {
        const { id: userId } = req.user;
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) throw new BadRequestError('Thong bao khong hop le');

        const notification = await modelNotification.findOneAndUpdate(
            { _id: id, userId, isDeleted: false },
            { isDeleted: true },
            { new: true },
        );
        if (!notification) throw new BadRequestError('Thong bao khong ton tai');

        new OK({
            message: 'Da xoa thong bao',
            metadata: { notification, unreadCount: await getUnreadCount(userId) },
        }).send(res);
    }

    async getAdminNotifications(req, res) {
        const page = Math.max(Number(req.query.page || 1), 1);
        const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
        const skip = (page - 1) * limit;
        const filter = buildAdminFilter(req.query);

        const [notifications, total] = await Promise.all([
            modelNotification
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'fullName email role isAdmin')
                .populate('createdBy', 'fullName email role'),
            modelNotification.countDocuments(filter),
        ]);

        new OK({
            message: 'Lay danh sach thong bao he thong thanh cong',
            metadata: {
                notifications,
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            },
        }).send(res);
    }

    async getAdminHistory(req, res) {
        const page = Math.max(Number(req.query.page || 1), 1);
        const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
        const skip = (page - 1) * limit;
        const filter = { ...buildAdminFilter(req.query), isBroadcast: true };

        const [notifications, total] = await Promise.all([
            modelNotification
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'fullName email role isAdmin')
                .populate('createdBy', 'fullName email role'),
            modelNotification.countDocuments(filter),
        ]);

        new OK({
            message: 'Lay lich su thong bao hang loat thanh cong',
            metadata: {
                notifications,
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            },
        }).send(res);
    }

    async broadcast(req, res) {
        const targetRole = req.body.targetRole || 'all';
        const type = req.body.type || 'system';
        const title = String(req.body.title || '').trim();
        const message = String(req.body.message || '').trim();
        const link = String(req.body.link || '').trim();

        if (!title || !message) throw new BadRequestError('Tieu de va noi dung thong bao la bat buoc');
        if (!TARGET_ROLES.includes(targetRole)) throw new BadRequestError('Doi tuong nhan thong bao khong hop le');
        if (!NOTIFICATION_TYPES.includes(type)) throw new BadRequestError('Loai thong bao khong hop le');

        const notifications = await createBroadcastNotification(
            targetRole,
            title,
            message,
            type,
            link,
            req.body.metadata || {},
            req.user.id,
        );

        new OK({
            message: 'Da gui thong bao hang loat',
            metadata: { sentCount: notifications.filter(Boolean).length },
        }).send(res);
    }
}

module.exports = new controllerNotification();
