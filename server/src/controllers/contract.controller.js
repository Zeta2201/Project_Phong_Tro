const mongoose = require('mongoose');
const modelContract = require('../models/contract.model');
const modelDeposit = require('../models/deposit.model');
const modelUser = require('../models/users.model');
const { Created, OK } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const { uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');
const { generateContractPdfBuffer } = require('../utils/contractPdf');
const sendContractMail = require('../utils/SendMail/sendContractMail');

const CONTRACT_STATUSES = [
    'draft',
    'waiting_tenant_signature',
    'waiting_landlord_signature',
    'active',
    'expired',
    'canceled',
];

const populateContract = (query) =>
    query
        .populate('roomId', 'title price location images category area')
        .populate('tenantId', 'fullName email phone avatar address')
        .populate('landlordId', 'fullName email phone avatar address')
        .populate('depositId');

const formatContract = (contract) => ({
    ...contract._doc,
    room: contract.roomId,
    tenant: contract.tenantId,
    landlord: contract.landlordId,
    deposit: contract.depositId,
});

const createContractCode = () => `HD-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;

const ensureValidObjectId = (id, message) => {
    if (!mongoose.isValidObjectId(id)) throw new BadRequestError(message);
};

const buildDefaultTerms = (room) =>
    [
        'Bên thuê thanh toán tiền thuê đúng hạn theo thỏa thuận hàng tháng.',
        'Bên thuê có trách nhiệm giữ gìn tài sản, vệ sinh và an ninh khu trọ.',
        'Bên cho thuê đảm bảo quyền sử dụng phòng trong thời hạn hợp đồng.',
        'Tiền đặt cọc được xử lý theo thỏa thuận khi kết thúc hợp đồng và sau khi đối chiếu công nợ, hiện trạng phòng.',
    ].join('\n') + `\nPhòng thuê   : ${room.title || ''} - ${room.location || ''}.`;

class controllerContract {
    async createContract(req, res) {
        const { id: landlordId } = req.user;
        const { depositId, startDate, endDate, terms } = req.body;

        ensureValidObjectId(depositId, 'Giao dịch thuê không hợp lệ');
        if (!startDate || !endDate) throw new BadRequestError('Vui lòng nhập ngày thuê và ngày kết thúc hợp đồng');
        if (new Date(startDate) >= new Date(endDate)) throw new BadRequestError('Ngày kết thúc phải sau ngày bắt đầu');

        const deposit = await modelDeposit
            .findById(depositId)
            .populate('roomId')
            .populate('tenantId', 'fullName email phone avatar address')
            .populate('landlordId', 'fullName email phone avatar address');

        if (!deposit) throw new BadRequestError('Giao dịch thuê không tồn tại');
        if (deposit.landlordId._id.toString() !== landlordId) throw new BadRequestError('ạn không có quyền tạo hợp đồng này');
        if (deposit.status !== 'completed') throw new BadRequestError('Chỉ tạo hợp đồng từ giao dịch đã xác nhận hoàn tất');

        const existed = await modelContract.findOne({ depositId });
        if (existed) throw new BadRequestError('Giao dịch này đã có hơp đồng');

        const contract = await modelContract.create({
            depositId,
            roomId: deposit.roomId._id,
            tenantId: deposit.tenantId._id,
            landlordId: deposit.landlordId._id,
            contractCode: createContractCode(),
            monthlyRent: deposit.roomId.price,
            depositAmount: deposit.amount,
            startDate,
            endDate,
            terms: terms?.trim() || buildDefaultTerms(deposit.roomId),
            status: 'waiting_tenant_signature',
        });

        await this.notifyContractCreated(contract);
        const populated = await populateContract(modelContract.findById(contract._id));
        new Created({ message: 'Đã tạo hợp đồng và gửi thông báo cho người thuê', metadata: formatContract(populated) }).send(res);
    }

    async notifyContractCreated(contract) {
        const populated = await populateContract(modelContract.findById(contract._id));
        const tenant = populated.tenantId;
        if (!tenant?.email) return;
        try {
            await sendContractMail({
                to: tenant.email,
                name: tenant.fullName,
                contractCode: populated.contractCode,
                pdfUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/trang-ca-nhan?tab=tenant-contracts`,
                subject: `Vui lòng ký hợp đồng ${populated.contractCode}`,
                title: 'Hợp đồng thuê phòng đang chờ bạn ký',
                body: `Chủ trọ đã tạo hợp đồng ${populated.contractCode}. Vui lòng đăng nhập để xem và ký điện tử.`,
                actionLabel: 'Xem hợp đồng',
            });
        } catch (error) {
            console.log('Cannot send tenant contract notification:', error.message);
        }
    }

    async getContracts(req, res) {
        const { id: userId } = req.user;
        const user = await modelUser.findById(userId);
        const { status, keyword, role } = req.query;
        const filter = {};

        if (status) {
            if (!CONTRACT_STATUSES.includes(status)) throw new BadRequestError('Trạng thái hợp đồng không hợp lệ');
            filter.status = status;
        }
        if (keyword) {
            filter.contractCode = { $regex: keyword.trim(), $options: 'i' };
        }
        if (!user?.isAdmin) {
            if (role === 'landlord') filter.landlordId = userId;
            else if (role === 'tenant') filter.tenantId = userId;
            else filter.$or = [{ tenantId: userId }, { landlordId: userId }];
        }

        const contracts = await populateContract(modelContract.find(filter).sort({ createdAt: -1 }));
        new OK({ message: 'Lấy danh sách hợp đồng thành công', metadata: contracts.map(formatContract) }).send(res);
    }

    async getContractDetail(req, res) {
        const { id } = req.query;
        ensureValidObjectId(id, 'Hợp đồng không hợp lệ');
        const contract = await populateContract(modelContract.findById(id));
        if (!contract) throw new BadRequestError('Hợp đồng không tồn tại');
        await this.ensureCanView(req.user.id, contract);
        new OK({ message: 'Lấy chi tiết hợp đồng thành công', metadata: formatContract(contract) }).send(res);
    }

    async signAsTenant(req, res) {
        const contract = await this.getContractForSigning(req.body.contractId);
        if (contract.tenantId.toString() !== req.user.id) throw new BadRequestError('Tenant chỉ được ký hợp đồng của mình');
        if (contract.status !== 'waiting_tenant_signature') throw new BadRequestError('Hợp đồng không cho phép người thuê ký lúc này');

        const signatureUrl = await this.uploadSignature(req);
        contract.tenantSignatureUrl = signatureUrl;
        contract.tenantSignedAt = new Date();
        contract.status = 'waiting_landlord_signature';
        await contract.save();
        await this.notifyLandlordTenantSigned(contract);

        const populated = await populateContract(modelContract.findById(contract._id));
        new OK({ message: 'Người thuê đã ký hợp đồng', metadata: formatContract(populated) }).send(res);
    }

    async signAsLandlord(req, res) {
        const contract = await this.getContractForSigning(req.body.contractId);
        if (contract.landlordId.toString() !== req.user.id) throw new BadRequestError('Landlord chỉ được ký hợp đồng của mình');
        if (contract.status !== 'waiting_landlord_signature') throw new BadRequestError('Hợp đồng chưa sẵn sàng để chủ trọ ký');

        const signatureUrl = await this.uploadSignature(req);
        contract.landlordSignatureUrl = signatureUrl;
        contract.landlordSignedAt = new Date();
        await contract.save();

        await this.activateContract(contract);
        const populated = await populateContract(modelContract.findById(contract._id));
        new OK({ message: 'Chủ trọ đã ký hợp đồng và hợp đồng đã có hiệu lực', metadata: formatContract(populated) }).send(res);
    }

    async getContractForSigning(contractId) {
        ensureValidObjectId(contractId, 'Hợp đồng không hợp lệ');
        const contract = await modelContract.findById(contractId);
        if (!contract) throw new BadRequestError('Hợp đồng không tồn tại');
        if (['active', 'expired', 'canceled'].includes(contract.status)) {
            throw new BadRequestError('Hợp đồng không thể ký tiếp');
        }
        return contract;
    }

    async uploadSignature(req) {
        if (!req.file) throw new BadRequestError('Vui lòng vẽ hoặc tải ảnh chữ ký lên');
        const uploaded = await uploadBufferToCloudinary({
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
            originalname: req.file.originalname || 'signature.png',
            folder: 'phongtro/contracts/signatures',
            resourceType: 'image',
        });
        return uploaded.url;
    }

    async notifyLandlordTenantSigned(contract) {
        const populated = await populateContract(modelContract.findById(contract._id));
        const landlord = populated.landlordId;
        if (!landlord?.email) return;
        try {
            await sendContractMail({
                to: landlord.email,
                name: landlord.fullName,
                contractCode: populated.contractCode,
                pdfUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/trang-ca-nhan?tab=landlord-contracts`,
                subject: `Người thuê đã ký hợp đồng ${populated.contractCode}`,
                title: 'Hợp đồng đang chờ chủ trọ ký',
                body: `Người thuê đã ký hợp đồng ${populated.contractCode}. Vui lòng đăng nhập để ký và kích hoạt hợp đồng.`,
                actionLabel: 'Xem hợp đồng',
            });
        } catch (error) {
            console.log('Cannot send landlord contract notification:', error.message);
        }
    }

    async activateContract(contract) {
        const freshContract = await populateContract(modelContract.findById(contract._id));
        if (!freshContract.tenantSignatureUrl || !freshContract.landlordSignatureUrl) {
            throw new BadRequestError('Chỉ kích hoạt hợp đồng khi cả hai bên đã ký');
        }

        const pdfBuffer = await generateContractPdfBuffer(freshContract);
        const uploaded = await uploadBufferToCloudinary({
            buffer: pdfBuffer,
            mimetype: 'application/pdf',
            originalname: `${freshContract.contractCode}.pdf`,
            folder: 'phongtro/contracts/pdfs',
            resourceType: 'raw',
        });

        freshContract.pdfUrl = uploaded.url;
        freshContract.pdfPublicId = uploaded.publicId;
        freshContract.status = 'active';
        await freshContract.save();
        await this.sendFinalContractEmails(freshContract, pdfBuffer);
    }

    async generatePdf(req, res) {
        const { contractId } = req.body;
        ensureValidObjectId(contractId, 'Hợp đồng không hợp lệ');
        const contract = await populateContract(modelContract.findById(contractId));
        if (!contract) throw new BadRequestError('Hợp đồng không tồn tại');
        await this.ensureCanManage(req.user.id, contract);
        if (!contract.tenantSignatureUrl || !contract.landlordSignatureUrl) {
            throw new BadRequestError('Chỉ sinh PDF khi cả hai bên đã ký');
        }
        await this.activateContract(contract);
        const updated = await populateContract(modelContract.findById(contractId));
        new OK({ message: 'Đã sinh PDF hợp đồng ', metadata: formatContract(updated) }).send(res);
    }

    async sendFinalContractEmails(contract, pdfBuffer = null) {
        if (!contract.pdfUrl) return;
        const tenant = contract.tenantId;
        const landlord = contract.landlordId;
        const now = new Date();
        const attachmentBuffer = pdfBuffer || (await generateContractPdfBuffer(contract));
        const attachments = [
            {
                filename: `${contract.contractCode}.pdf`,
                content: attachmentBuffer,
                contentType: 'application/pdf',
            },
        ];
        const downloadUrl = `${process.env.SERVER_URL || 'http://localhost:3000'}/api/contracts/download-public?id=${contract._id}&code=${contract.contractCode}`;

        if (tenant?.email) {
            await sendContractMail({
                to: tenant.email,
                name: tenant.fullName,
                contractCode: contract.contractCode,
                pdfUrl: downloadUrl,
                body: `Hop dong ${contract.contractCode} da duoc kich hoat. File PDF duoc dinh kem trong email nay.`,
                attachments,
            });
            contract.sentToTenantAt = now;
        }
        if (landlord?.email) {
            await sendContractMail({
                to: landlord.email,
                name: landlord.fullName,
                contractCode: contract.contractCode,
                pdfUrl: downloadUrl,
                body: `Hợp đồng ${contract.contractCode} đã được kích hoạt. File PDF được đính kèm trong email này.`,
                attachments,
            });
            contract.sentToLandlordAt = now;
        }
        await contract.save();
    }

    async sendEmails(req, res) {
        const { contractId } = req.body;
        ensureValidObjectId(contractId, 'Hợp đồng không hợp lệ');
        const contract = await populateContract(modelContract.findById(contractId));
        if (!contract) throw new BadRequestError('Hợp đồng không tồn tại');
        await this.ensureCanManage(req.user.id, contract);
        if (contract.status !== 'active' || !contract.pdfUrl) throw new BadRequestError('Hợp đồng chưa có PDF hoàn chỉnh để gửi email');
        await this.sendFinalContractEmails(contract);
        new OK({ message: 'Đã gửi email hợp đồng', metadata: formatContract(contract) }).send(res);
    }

    async cancelContract(req, res) {
        const { contractId, reason } = req.body;
        ensureValidObjectId(contractId, 'Hợp đồng không hợp lệ');
        const contract = await modelContract.findById(contractId);
        if (!contract) throw new BadRequestError('Hợp đồng không tồn tại');

        const user = await modelUser.findById(req.user.id);
        if (!user?.isAdmin) throw new BadRequestError('Chỉ admin có quyền hủy hợp đồng');
        if (['expired', 'canceled'].includes(contract.status)) throw new BadRequestError('Hợp đồng không thể hủy');

        contract.status = 'canceled';
        contract.cancelReason = reason || '';
        contract.canceledAt = new Date();
        await contract.save();

        const populated = await populateContract(modelContract.findById(contract._id));
        new OK({ message: 'Đã hủy hợp đồng', metadata: formatContract(populated) }).send(res);
    }

    async downloadContract(req, res) {
        const { id } = req.query;
        ensureValidObjectId(id, 'Hợp đồng không hợp lệ');
        const contract = await populateContract(modelContract.findById(id));
        if (!contract) throw new BadRequestError('Hợp đồng không tồn tại');
        await this.ensureCanView(req.user.id, contract);
        if (!contract.tenantSignatureUrl || !contract.landlordSignatureUrl) {
            throw new BadRequestError('Hợp đồng chưa có đủ chữ ký để tải PDF');
        }
        const pdfBuffer = await generateContractPdfBuffer(contract);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${contract.contractCode}.pdf"`);
        return res.send(pdfBuffer);
    }

    async downloadPublicContract(req, res) {
        const { id, code } = req.query;
        ensureValidObjectId(id, 'Hợp đồng không hợp lệ');
        const contract = await populateContract(modelContract.findOne({ _id: id, contractCode: code, status: 'active' }));
        if (!contract) throw new BadRequestError('Hợp đồng không tồn tại hoặc chưa có hiệu lực');
        if (!contract.tenantSignatureUrl || !contract.landlordSignatureUrl) {
            throw new BadRequestError('Hợp đồng chưa có đủ chữ ký để tải PDF');
        }
        const pdfBuffer = await generateContractPdfBuffer(contract);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${contract.contractCode}.pdf"`);
        return res.send(pdfBuffer);
    }

    async ensureCanView(userId, contract) {
        const user = await modelUser.findById(userId);
        if (user?.isAdmin) return;
        const isParticipant = [contract.tenantId?._id || contract.tenantId, contract.landlordId?._id || contract.landlordId].some(
            (id) => id?.toString() === userId,
        );
        if (!isParticipant) throw new BadRequestError('Bạn không có quyền xem hợp đồng này');
    }

    async ensureCanManage(userId, contract) {
        const user = await modelUser.findById(userId);
        if (user?.isAdmin || (contract.landlordId?._id || contract.landlordId).toString() === userId) return;
        throw new BadRequestError('Bạn không có quyền thao tác hợp đồng này');
    }
}

module.exports = new controllerContract();
