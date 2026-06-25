const modelReservation = require('../models/reservation.model');
const modelPost = require('../models/post.model');
const modelUser = require('../models/users.model');
const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const { createNotification } = require('../services/notification.service');
const sendReservationReminderMail = require('../utils/SendMail/sendReservationReminderMail');

const RESERVATION_HOLD_HOURS = 24;
const REMINDER_WINDOW_HOURS = 24;

const getHoldExpiresAt = () => new Date(Date.now() + RESERVATION_HOLD_HOURS * 60 * 60 * 1000);

const statusLabels = {
    accepted: 'đã được xác nhận',
    reschedule_requested: 'được đề xuất đổi lịch',
    rejected: 'bị từ chối',
    cancelled: 'đã bị hủy',
    expired: 'đã hết hạn giữ chỗ',
    viewed: 'đã xem phòng',
    no_show: 'không đến xem phòng',
};

const addTimeline = (reservation, { actorId = null, role = 'system', action, note = '' }) => {
    reservation.timeline = reservation.timeline || [];
    reservation.timeline.push({ actorId, role, action, note });
};

const getObjectId = (value) => value?._id || value;

const getVisitLabel = (reservation) => {
    if (!reservation.visitDate) return 'chưa chọn thời gian';
    const date = new Date(reservation.visitDate).toLocaleDateString('vi-VN');
    return `${reservation.visitTime || 'chưa chọn giờ'} ngay ${date}`;
};

const sendMailSafe = async (user, reservation, title, message) => {
    if (!user?.email) return;
    await sendReservationReminderMail(user.email, { title, message, reservation, post: reservation.postId });
};

const releaseRoomIfNoActiveReservation = async (postId) => {
    const activeReservation = await modelReservation.findOne({
        postId,
        status: 'accepted',
        expiresAt: { $gt: new Date() },
    });

    if (!activeReservation) {
        await modelPost.findOneAndUpdate({ _id: postId, availabilityStatus: 'unavailable' }, { availabilityStatus: 'available' });
    }
};

const expireReservations = async (postId = null) => {
    const now = new Date();
    const filter = { status: 'accepted', expiresAt: { $lte: now } };
    if (postId) filter.postId = postId;

    const expiredReservations = await modelReservation.find(filter);
    for (const reservation of expiredReservations) {
        reservation.status = 'expired';
        reservation.ownerNote = reservation.ownerNote || 'Yêu cầu giữ chỗ đã hết hạn sau 24 giờ';
        reservation.handledAt = now;
        addTimeline(reservation, { action: 'expired', note: 'Đã hết hạn giữ chỗ sau 24 giờ' });
        await reservation.save();
        await releaseRoomIfNoActiveReservation(reservation.postId);
    }
};

const sendDueReminders = async (userId = null) => {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);
    const filter = {
        status: 'accepted',
        visitDate: { $gte: now, $lte: windowEnd },
        reminderSentAt: null,
    };
    if (userId) filter.$or = [{ tenantId: userId }, { ownerId: userId }];

    const reservations = await modelReservation
        .find(filter)
        .populate('postId', 'title location')
        .populate('tenantId', 'fullName email')
        .populate('ownerId', 'fullName email');

    for (const reservation of reservations) {
        const postTitle = reservation.postId?.title || 'phong tro';
        const message = `Lịch xem phòng "${postTitle}" của bạn vào ${getVisitLabel(reservation)}.`;
        await Promise.all([
            createNotification(getObjectId(reservation.tenantId), 'Nhắc lịch xem phòng', message, 'post', '/trang-ca-nhan?tab=reservations', {
                reservationId: reservation._id,
                postId: getObjectId(reservation.postId),
            }),
            createNotification(getObjectId(reservation.ownerId), 'Nhắc lịch xem phòng', message, 'post', '/trang-ca-nhan?tab=reservations', {
                reservationId: reservation._id,
                postId: getObjectId(reservation.postId),
            }),
            sendMailSafe(reservation.tenantId, reservation, 'Nhắc lịch xem phòng', message),
            sendMailSafe(reservation.ownerId, reservation, 'Nhắc lịch xem phòng', message),
        ]);
        reservation.reminderSentAt = now;
        addTimeline(reservation, { action: 'reminder_sent', note: 'Đã gửi nhắc lịch xem phòng' });
        await reservation.save();
    }
};

class controllerReservationV2 {
    async createReservation(req, res) {
        const { id: tenantId } = req.user;
        const { postId, note, visitDate, visitTime } = req.body;

        if (!postId) throw new BadRequestError('Vui lòng chọn bài viết cần hẹn xem phòng');
        if (!visitDate || !visitTime) throw new BadRequestError('Vui lòng chọn ngày và khung giờ xem phòng');

        await expireReservations(postId);

        const post = await modelPost.findById(postId);
        if (!post || !['active', 'approved'].includes(post.status) || post.isDeleted) {
            throw new BadRequestError('Bài viết không tồn tại hoặc chưa được hiển thị');
        }
        if ((post.availabilityStatus || 'available') !== 'available') {
            throw new BadRequestError('Phòng này hiện đã hết phòng hoặc đã có người giữ chỗ');
        }
        if (post.userId.toString() === tenantId) throw new BadRequestError('Bạn không thể hẹn xem phòng của chính mình');

        const tenant = await modelUser.findById(tenantId);
        if (!tenant) throw new BadRequestError('Người dùng không hợp lệ');

        const existing = await modelReservation.findOne({
            postId,
            tenantId,
            status: { $in: ['pending', 'accepted', 'reschedule_requested'] },
        });
        if (existing) throw new BadRequestError('Bạn đã gửi yêu cầu xem phòng cho bài viết này.');

        const reservation = await modelReservation.create({
            postId,
            tenantId,
            ownerId: post.userId,
            tenantName: tenant.fullName,
            tenantPhone: tenant.phone,
            note: note || '',
            visitDate,
            visitTime,
            timeline: [
                {
                    actorId: tenantId,
                    role: 'tenant',
                    action: 'create_request',
                    note: `Đề xuất xem phòng lúc ${visitTime}`,
                },
            ],
        });

        await createNotification(
            post.userId,
            'Có lịch xem phòng mới',
            `${tenant.fullName || 'Người thuê'} vừa gửi yêu cầu xem phòng "${post.title || ''}" vào ${getVisitLabel(reservation)}`,
            'post',
            '/trang-ca-nhan?tab=reservations',
            { reservationId: reservation._id, postId },
        );

        new Created({ message: 'Đã gửi yêu cầu xem phòng', metadata: reservation }).send(res);
    }

    async getReservations(req, res) {
        const { id: userId } = req.user;
        const { role = 'tenant', status } = req.query;

        await expireReservations();
        await sendDueReminders(userId);

        const filter = role === 'owner' ? { ownerId: userId } : { tenantId: userId };
        if (status) filter.status = status;

        const reservations = await modelReservation
            .find(filter)
            .sort({ createdAt: -1 })
            .populate('postId', 'title price location images availabilityStatus status')
            .populate('tenantId', 'fullName phone email avatar')
            .populate('ownerId', 'fullName phone email avatar');

        const metadata = reservations.map((item) => ({
            ...item._doc,
            post: item.postId,
            tenant: item.tenantId,
            owner: item.ownerId,
        }));

        new OK({ message: 'Lấy danh sách lịch hẹn thành công', metadata }).send(res);
    }

    async updateReservation(req, res) {
        const { id: userId } = req.user;
        const { id, status, ownerNote, tenantNote, proposedVisitDate, proposedVisitTime } = req.body;

        if (!id || !['accepted', 'rejected', 'cancelled', 'reschedule_requested', 'viewed', 'no_show'].includes(status)) {
            throw new BadRequestError('Trạng thái lịch hẹn không hợp lệ');
        }

        const reservation = await modelReservation.findById(id);
        if (!reservation) throw new BadRequestError('Yêu cầu xem phòng không tồn tại');

        await expireReservations(reservation.postId);
        await reservation.populate('postId');
        await reservation.populate('tenantId', 'fullName email phone');
        await reservation.populate('ownerId', 'fullName email phone');

        const isOwner = reservation.ownerId._id.toString() === userId;
        const isTenant = reservation.tenantId._id.toString() === userId;
        if (!isOwner && !isTenant) throw new BadRequestError('Bạn không có quyền cập nhật lịch hẹn này');

        if (['reschedule_requested', 'rejected', 'no_show'].includes(status) && !isOwner) {
            throw new BadRequestError('Chỉ chủ trọ mới có thể thực hiện thao tác này');
        }
        if (status === 'accepted' && reservation.status === 'pending' && !isOwner) {
            throw new BadRequestError('Chi chủ trọ mới có thể đồng ý lịch hẹn');
        }
        if (status === 'accepted' && reservation.status === 'reschedule_requested' && !isTenant) {
            throw new BadRequestError('Chi người thuê mới có thể đồng ý lịch mới');
        }

        const allowedTransitions = {
            pending: ['accepted', 'rejected', 'cancelled', 'reschedule_requested'],
            reschedule_requested: ['accepted', 'rejected', 'cancelled'],
            accepted: ['cancelled', 'viewed', 'no_show'],
            viewed: [],
            rejected: [],
            cancelled: [],
            expired: [],
            no_show: [],
        };
        if (!allowedTransitions[reservation.status]?.includes(status)) {
            throw new BadRequestError('Yêu cầu này đã được xử lý hoặc không thể chuyển trạng thái');
        }

        if (status === 'reschedule_requested') {
            if (!proposedVisitDate || !proposedVisitTime) throw new BadRequestError('Vui lòng chọn ngày giờ đề xuất mới');
            reservation.proposedVisitDate = proposedVisitDate;
            reservation.proposedVisitTime = proposedVisitTime;
            reservation.reminderSentAt = null;
        }

        if (status === 'accepted' && reservation.status === 'reschedule_requested') {
            reservation.visitDate = reservation.proposedVisitDate || reservation.visitDate;
            reservation.visitTime = reservation.proposedVisitTime || reservation.visitTime;
            reservation.proposedVisitDate = null;
            reservation.proposedVisitTime = '';
            reservation.reminderSentAt = null;
        }

        reservation.status = status;
        reservation.ownerNote = ownerNote || reservation.ownerNote;
        reservation.tenantNote = tenantNote || reservation.tenantNote;
        reservation.handledAt = new Date();
        reservation.expiresAt = status === 'accepted' ? getHoldExpiresAt() : reservation.expiresAt;
        reservation.viewedAt = status === 'viewed' ? new Date() : reservation.viewedAt;
        addTimeline(reservation, {
            actorId: userId,
            role: isOwner ? 'owner' : 'tenant',
            action: status,
            note: ownerNote || tenantNote || '',
        });
        await reservation.save();

        if (status === 'accepted') {
            await modelPost.findByIdAndUpdate(reservation.postId, { availabilityStatus: 'unavailable' });
            await modelReservation.updateMany(
                { postId: reservation.postId, _id: { $ne: reservation._id }, status: 'pending' },
                { status: 'rejected', ownerNote: 'Phòng đã được giữ cho người khác', handledAt: new Date() },
            );
        }

        if (['viewed', 'no_show', 'cancelled', 'rejected'].includes(status)) {
            await releaseRoomIfNoActiveReservation(reservation.postId);
        }

        const receiver = status === 'cancelled' && isTenant ? reservation.ownerId : reservation.tenantId;
        const notifyMessage =
            status === 'reschedule_requested'
                ? `Chủ trọ đề xuất đổi lịch xem phòng sang ${proposedVisitTime} ngày ${new Date(proposedVisitDate).toLocaleDateString('vi-VN')}`
                : `Yêu cầu xem phòng của bạn ${statusLabels[status] || status}`;

        await createNotification(
            getObjectId(receiver),
            'Cập nhật lịch xem phòng',
            notifyMessage,
            'post',
            '/trang-ca-nhan?tab=reservations',
            { reservationId: reservation._id, postId: getObjectId(reservation.postId), status },
        );
        await sendMailSafe(receiver, reservation, 'Cập nhật lịch xem phòng', notifyMessage);

        new OK({ message: 'Cập nhật lịch hẹn thành công', metadata: reservation }).send(res);
    }
}

module.exports = new controllerReservationV2();
