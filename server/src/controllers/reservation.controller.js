const modelReservation = require('../models/reservation.model');
const modelPost = require('../models/post.model');
const modelUser = require('../models/users.model');
const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');

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
            await modelPost.findByIdAndUpdate(reservation.postId, { availabilityStatus: 'available' });
        }
    }
};

class controllerReservation {
    async createReservation(req, res) {
        const { id: tenantId } = req.user;
        const { postId, note, visitDate } = req.body;

        if (!postId) {
            throw new BadRequestError('Vui long chon bai viet can giu cho');
        }

        await expireReservations(postId);

        const post = await modelPost.findById(postId);
        if (!post || post.status !== 'active') {
            throw new BadRequestError('Bai viet khong ton tai hoac chua duoc hien thi');
        }

        if ((post.availabilityStatus || 'available') !== 'available') {
            throw new BadRequestError('Phong nay hien da het phong hoac da co nguoi giu cho');
        }

        if (post.userId.toString() === tenantId) {
            throw new BadRequestError('Ban khong the giu cho bai viet cua chinh minh');
        }

        const tenant = await modelUser.findById(tenantId);
        if (!tenant) {
            throw new BadRequestError('Nguoi dung khong hop le');
        }

        const existing = await modelReservation.findOne({
            postId,
            tenantId,
            status: { $in: ['pending', 'accepted'] },
        });

        if (existing) {
            throw new BadRequestError('Ban da gui yeu cau giu cho cho bai viet nay');
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

        new Created({ message: 'Da gui yeu cau giu cho', metadata: reservation }).send(res);
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

        new OK({ message: 'Lay danh sach giu cho thanh cong', metadata }).send(res);
    }

    async updateReservation(req, res) {
        const { id: ownerId } = req.user;
        const { id, status, ownerNote } = req.body;

        if (!id || !['accepted', 'rejected', 'cancelled'].includes(status)) {
            throw new BadRequestError('Trang thai giu cho khong hop le');
        }

        const reservation = await modelReservation.findById(id);
        if (!reservation) {
            throw new BadRequestError('Yeu cau giu cho khong ton tai');
        }

        await expireReservations(reservation.postId);
        await reservation.populate('postId');

        const isOwner = reservation.ownerId.toString() === ownerId;
        const isTenant = reservation.tenantId.toString() === ownerId;

        if (status === 'cancelled') {
            if (!isTenant && !isOwner) {
                throw new BadRequestError('Ban khong co quyen huy yeu cau nay');
            }
        } else if (!isOwner) {
            throw new BadRequestError('Chi chu bai viet moi co quyen xu ly yeu cau giu cho');
        }

        if (reservation.status !== 'pending') {
            throw new BadRequestError('Yeu cau nay da duoc xu ly');
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
                { status: 'rejected', ownerNote: 'Phong da duoc giu cho boi nguoi khac', handledAt: new Date() },
            );
        }

        new OK({ message: 'Cap nhat yeu cau giu cho thanh cong', metadata: reservation }).send(res);
    }
}

module.exports = new controllerReservation();
