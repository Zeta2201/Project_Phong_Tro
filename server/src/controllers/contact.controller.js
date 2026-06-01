const modelContact = require('../models/contact.model');
const { Created, OK } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');

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
            throw new BadRequestError('Vui long nhap ho ten, email va noi dung lien he');
        }
        if (!emailPattern.test(email)) {
            throw new BadRequestError('Email khong hop le');
        }
        if (name.length > 120 || email.length > 160 || phone.length > 30 || message.length > 3000) {
            throw new BadRequestError('Thong tin lien he vuot qua gioi han cho phep');
        }

        const contact = await modelContact.create({ name, email, phone, message });
        new Created({ message: 'Da gui yeu cau lien he', metadata: contact }).send(res);
    }

    async getContacts(req, res) {
        const { status, q } = req.query;
        const filter = {};

        if (status) {
            if (!CONTACT_STATUSES.includes(status)) {
                throw new BadRequestError('Trang thai lien he khong hop le');
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

        new OK({ message: 'Lay danh sach lien he thanh cong', metadata: contacts }).send(res);
    }

    async updateContact(req, res) {
        const { id, status } = req.body;
        const adminNote = normalizeText(req.body.adminNote);

        if (!id || !CONTACT_STATUSES.includes(status)) {
            throw new BadRequestError('Id va trang thai lien he hop le la bat buoc');
        }
        if (adminNote.length > 2000) {
            throw new BadRequestError('Ghi chu khong duoc vuot qua 2000 ky tu');
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
            throw new BadRequestError('Yeu cau lien he khong ton tai');
        }

        new OK({ message: 'Cap nhat lien he thanh cong', metadata: contact }).send(res);
    }
}

module.exports = new controllerContact();
