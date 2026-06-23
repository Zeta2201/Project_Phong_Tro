const modelReservation = require('../models/reservation.model');
const modelPost = require('../models/post.model');
const modelUser = require('../models/users.model');
const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const { createNotification } = require('../services/notification.service');

const RESERVATION_HOLD_HOURS = 24;

const getHoldExpiresAt = () => new Date(Date.now() + RESERVATION_HOLD_HOURS * 60 * 60 * 1000);

const expireReservations = async (postId = null) => {
    const now = new Date();
    const filter = {
        status: 'accepted',
        expiresAt: { $lte: now },
    };

    if (postId) {
        filter.postId = postId;
    }

    const expiredReservations = await modelReservation.find(filter);

    for (const reservation of expiredReservations) {
        reservation.status = 'expired';
        reservation.ownerNote = reservation.ownerNote || 'Yeu cau giu cho da het han sau 24 gio';
        reservation.handledAt = now;
        await reservation.save();

        const activeReservation = await modelReservation.findOne({
            postId: reservation.postId,
            status: 'accepted',
            expiresAt: { $gt: now },
        });

        if (!activeReservation) {
            await modelPost.findOneAndUpdate(
                { _id: reservation.postId, availabilityStatus: 'unavailable' },
                { availabilityStatus: 'available' },
            );
        }
    }
};

class controllerReservation {
    async createReservation(req, res) {
        const { id: tenantId } = req.user;
        const { postId, note, visitDate } = req.body;

        if (!postId) {
            throw new BadRequestError('Vui lòng chọn bài viết cần giữ chỗ');
        }

        await expireReservations(postId);

        const post = await modelPost.findById(postId);
        if (!post || !['active', 'approved'].includes(post.status) || post.isDeleted) {
            throw new BadRequestError('Bài viết không tồn tại hoặc chưa được hiển thị');
        }

        if ((post.availabilityStatus || 'available') !== 'available') {
            throw new BadRequestError('Phòng này hiện đã hết phòng hoặc đã có người giữ chỗ');
        }

        if (post.userId.toString() === tenantId) {
            throw new BadRequestError('Bạn không thể giữ chỗ bài viết của chính mình');
        }

        const tenant = await modelUser.findById(tenantId);
        if (!tenant) {
            throw new BadRequestError('Người dùng không hợp lệ');
        }

        const existing = await modelReservation.findOne({
            postId,
            tenantId,
            status: { $in: ['pending', 'accepted'] },
        });

        if (existing) {
            throw new BadRequestError('Bạn đã gửi yêu cầu giữ chỗ cho bài viết này');
        }

        const reservation = await modelReservation.create({
            postId,
            tenantId,
            ownerId: post.userId,
            tenantName: tenant.fullName,
            tenantPhone: tenant.phone,
            note: note || '',
            visitDate: visitDate || null,
        });
        await createNotification(
            post.userId,
            'Có lịch xem phòng mới',
            `${tenant.fullName || 'Người thuê'} vừa gửi yêu cầu xem phòng "${post.title || ''}"`,
            'post',
            '/trang-ca-nhan?tab=reservations',
            { reservationId: reservation._id, postId },
        );

        new Created({ message: 'Đã gửi yêu cầu giữ chỗ', metadata: reservation }).send(res);
    }

    async getReservations(req, res) {
        const { id: userId } = req.user;
        const { role = 'tenant', status } = req.query;

        await expireReservations();

        const filter = role === 'owner' ? { ownerId: userId } : { tenantId: userId };
        if (status) {
            filter.status = status;
        }

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

        new OK({ message: 'Lấy danh sách giữ chỗ thành công', metadata }).send(res);
    }

    async updateReservation(req, res) {
        const { id: ownerId } = req.user;
        const { id, status, ownerNote } = req.body;

        if (!id || !['accepted', 'rejected', 'cancelled'].includes(status)) {
            throw new BadRequestError('Trạng thái giữ chỗ không hợp lệ');
        }

        const reservation = await modelReservation.findById(id);
        if (!reservation) {
            throw new BadRequestError('Yêu cầu giữ chỗ không tồn tại');
        }

        await expireReservations(reservation.postId);
        await reservation.populate('postId');

        const isOwner = reservation.ownerId.toString() === ownerId;
        const isTenant = reservation.tenantId.toString() === ownerId;

        if (status === 'cancelled') {
            if (!isTenant && !isOwner) {
                throw new BadRequestError('Bạn không có quyền hủy yêu cầu này');
            }
        } else if (!isOwner) {
            throw new BadRequestError('Chỉ chủ bài viết mới có quyền xử lý yêu cầu giữ chỗ');
        }

        if (reservation.status !== 'pending') {
            throw new BadRequestError('Yêu cầu này đã được xử lý');
        }

        reservation.status = status;
        reservation.ownerNote = ownerNote || reservation.ownerNote;
        reservation.handledAt = new Date();
        reservation.expiresAt = status === 'accepted' ? getHoldExpiresAt() : reservation.expiresAt;
        await reservation.save();

        if (status === 'accepted') {
            await modelPost.findByIdAndUpdate(reservation.postId, { availabilityStatus: 'unavailable' });
            await modelReservation.updateMany(
                { postId: reservation.postId, _id: { $ne: reservation._id }, status: 'pending' },
                { status: 'rejected', ownerNote: 'Phòng đã được giữ chỗ bởi người khác', handledAt: new Date() },
            );
        }
        const statusText = status === 'accepted' ? 'được xác nhận' : status === 'rejected' ? 'bị từ chối' : 'đã bị hủy';
        const receiverId = status === 'cancelled' && isTenant ? reservation.ownerId : reservation.tenantId;
        await createNotification(
            receiverId,
            'Cập nhật lịch xem phòng',
            `Yêu cầu xem phòng của bạn ${statusText}`,
            'post',
            '/trang-ca-nhan?tab=reservations',
            { reservationId: reservation._id, postId: reservation.postId, status },
        );

        new OK({ message: 'Cập nhật yêu cầu giữ chỗ thành công', metadata: reservation }).send(res);
    }
}

module.exports = new controllerReservation();
