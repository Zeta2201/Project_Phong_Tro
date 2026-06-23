const modelContact = require('../models/contact.model');
const { Created, OK } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const { notifyAdmins } = require('../services/notification.service');

const CONTACT_STATUSES = ['pending', 'resolved', 'rejected'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

class controllerContact {
    async createContact(req, res) {
        const name = normalizeText(req.body.name);
        const email = normalizeText(req.body.email).toLowerCase();
        const phone = normalizeText(req.body.phone);
        const message = normalizeText(req.body.message);

        if (!name || !email || !message) {
            throw new BadRequestError('Vui lòng nhập họ tên, email va nội dung liên hệ');
        }
        if (!emailPattern.test(email)) {
            throw new BadRequestError('Email không hợp lệ');
        }
        if (name.length > 120 || email.length > 160 || phone.length > 30 || message.length > 3000) {
            throw new BadRequestError('Thông tin liên hệ vượt quá giới hạn cho phép');
        }

        const contact = await modelContact.create({ name, email, phone, message });
        await notifyAdmins(
            'Có liên hệ mới',
            `${name} vừa gửi yêu cầu liên hệ`,
            'system',
            '/admin?type=contacts',
            { contactId: contact._id, email },
        );
        new Created({ message: 'Đã gửi yêu cầu liên hệ', metadata: contact }).send(res);
    }

    async getContacts(req, res) {
        const { status, q } = req.query;
        const filter = {};

        if (status) {
            if (!CONTACT_STATUSES.includes(status)) {
                throw new BadRequestError('Trạng thái liên hệ không hợp lệ');
            }
            filter.status = status;
        }

        if (q) {
            filter.$or = [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } },
                { message: { $regex: q, $options: 'i' } },
            ];
        }

        const contacts = await modelContact
            .find(filter)
            .sort({ createdAt: -1 })
            .populate('handledBy', 'fullName email');

        new OK({ message: 'Lấy danh sách liên hệ thành công', metadata: contacts }).send(res);
    }

    async updateContact(req, res) {
        const { id, status } = req.body;
        const adminNote = normalizeText(req.body.adminNote);

        if (!id || !CONTACT_STATUSES.includes(status)) {
            throw new BadRequestError('Id và trạng thái liên hệ hợp lệ là bắt buộc');
        }
        if (adminNote.length > 2000) {
            throw new BadRequestError('Ghi chú không được vượt quá 2000 ký tự');
        }

        const contact = await modelContact.findByIdAndUpdate(
            id,
            {
                status,
                adminNote,
                handledBy: req.user.id,
                handledAt: new Date(),
            },
            { new: true },
        );

        if (!contact) {
            throw new BadRequestError('Yêu cầu liên hệ không tồn tại');
        }

        new OK({ message: 'Cập nhật liên hệ thành công', metadata: contact }).send(res);
    }
}

module.exports = new controllerContact();
