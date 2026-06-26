const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const modelContract = require('../models/contract.model');
const modelDeposit = require('../models/deposit.model');
const modelUser = require('../models/users.model');
const { Created, OK } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const { uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');
const { generateContractPdfBuffer } = require('../utils/contractPdf');
const sendContractMail = require('../utils/SendMail/sendContractMail');
const { createNotification } = require('../services/notification.service');

const CONTRACT_STATUSES = [
    'draft',
    'waiting_tenant_signature',
    'waiting_landlord_signature',
    'active',
    'expired',
    'canceled',
];

const SIGNATURE_OTP_EXPIRES_MS = 10 * 60 * 1000;

const populateContract = (query) =>
    query
        .populate('roomId', 'title price location images category area')
        .populate('tenantId', 'fullName email phone avatar address cccdNumber verificationStatus')
        .populate('landlordId', 'fullName email phone avatar address cccdNumber verificationStatus')
        .populate('depositId');

const formatContract = (contract) => ({
    ...(() => {
        const data = contract.toObject ? contract.toObject() : contract._doc;
        delete data.tenantSignatureOtpHash;
        delete data.landlordSignatureOtpHash;
        return data;
    })(),
    room: contract.roomId,
    tenant: contract.tenantId,
    landlord: contract.landlordId,
    deposit: contract.depositId,
});

const createContractCode = () => `HD-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;

const ensureValidObjectId = (id, message) => {
    if (!mongoose.isValidObjectId(id)) throw new BadRequestError(message);
};

const toOptionalNumber = (value, fallback = 0) => {
    if (value === undefined || value === null || value === '') return fallback;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new BadRequestError('Thông tin số tiền/phí không hợp lệ');
    return number;
};

const toDayOfMonth = (value, fallback) => {
    const number = Number(value || fallback);
    if (!Number.isInteger(number) || number < 1 || number > 31) throw new BadRequestError('Ngày thanh toán phải từ 1 đến 31');
    return number;
};

const parseOptionalDate = (value, message) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestError(message);
    return date;
};

const normalizeLegalPayload = (body, deposit) => {
    const paymentFromDay = toDayOfMonth(body.paymentFromDay, 1);
    const paymentToDay = toDayOfMonth(body.paymentToDay, 5);
    if (paymentFromDay > paymentToDay) throw new BadRequestError('Ngày bắt đầu thanh toán không được sau ngày kết thúc thanh toán');

    return {
        paymentFromDay,
        paymentToDay,
        electricityRate: toOptionalNumber(body.electricityRate, 0),
        waterRate: toOptionalNumber(body.waterRate, 0),
        otherMonthlyFee: toOptionalNumber(body.otherMonthlyFee, 0),
        otherFeeNote: String(body.otherFeeNote || '').trim(),
        landlordIdentityNumber: String(body.landlordIdentityNumber || deposit.landlordId?.cccdNumber || '').trim(),
        landlordIdentityIssueDate: parseOptionalDate(body.landlordIdentityIssueDate, 'Ngày cấp CCCD/Hộ chiếu chủ trọ không hợp lệ'),
        landlordIdentityIssuePlace: String(body.landlordIdentityIssuePlace || '').trim(),
        tenantIdentityNumber: String(body.tenantIdentityNumber || deposit.tenantId?.cccdNumber || '').trim(),
        tenantIdentityIssueDate: parseOptionalDate(body.tenantIdentityIssueDate, 'Ngày cấp CCCD/Hộ chiếu người thuê không hợp lệ'),
        tenantIdentityIssuePlace: String(body.tenantIdentityIssuePlace || '').trim(),
        landlordBankAccount: String(body.landlordBankAccount || '').trim(),
        landlordBankName: String(body.landlordBankName || '').trim(),
    };
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND`;

const buildDefaultTerms = (room, legalData, endDate) =>
    [
        `3.1. Thanh toán: Bên thuê thanh toán tiền thuê phòng từ ngày ${legalData.paymentFromDay} đến ngày ${legalData.paymentToDay} hàng tháng bằng chuyển khoản hoặc phương thức hai bên thống nhất. Nếu chậm thanh toán quá 05 ngày mà không có lý do chính đáng, Bên cho thuê có quyền đơn phương chấm dứt hợp đồng và thu hồi phòng theo thỏa thuận.`,
        '3.2. Trách nhiệm sử dụng: Bên thuê giữ gìn tài sản, vệ sinh, an ninh khu trọ; không tự ý thay đổi kết cấu, khoan đục hoặc cho người khác thuê lại khi chưa được Bên cho thuê đồng ý. Hư hỏng tài sản do lỗi của Bên thuê phải bồi thường theo giá trị thị trường hoặc chi phí sửa chữa thực tế.',
        '3.3. Trách nhiệm chủ trọ: Bên cho thuê bảo đảm quyền sử dụng phòng độc lập, an toàn trong thời hạn hợp đồng; bàn giao phòng đúng hiện trạng đã thỏa thuận và hỗ trợ đăng ký tạm trú theo quy định.',
        `3.4. Xử lý tiền đặt cọc: Bên thuê được hoàn trả 100% tiền đặt cọc khi kết thúc hợp đồng vào ngày ${new Date(endDate).toLocaleDateString('vi-VN')}, sau khi đối chiếu hoàn thành công nợ điện, nước, phí khác và bàn giao phòng nguyên vẹn. Bên thuê mất toàn bộ tiền đặt cọc nếu tự ý trả phòng trước hạn, dọn đi trước thời hạn hợp đồng hoặc vi phạm nghiêm trọng quy định phòng cháy chữa cháy, an ninh khu trọ.`,
        `3.5. Chi phí dịch vụ: Tiền điện ${legalData.electricityRate ? formatMoney(legalData.electricityRate) + '/kWh' : 'theo chỉ số đồng hồ và đơn giá hai bên ghi nhận'}; tiền nước ${legalData.waterRate ? formatMoney(legalData.waterRate) + '/người hoặc theo khối' : 'theo thỏa thuận thực tế'}; phí khác ${legalData.otherMonthlyFee ? formatMoney(legalData.otherMonthlyFee) + '/tháng' : 'không có hoặc theo phụ lục'}. ${legalData.otherFeeNote || ''}`.trim(),
        `3.6. Quy trình thu hồi phòng khi khách bỏ trốn/nợ tiền: Nếu Bên B chậm thanh toán tiền nhà quá 05 ngày và cắt liên lạc, Bên B đồng ý chấp thuận cho Bên A toàn quyền: Cắt điện, nước; Mở khóa phòng trọ công khai để kiểm kê, đóng gói tài sản của Bên B (có quay phim làm bằng chứng); Thanh lý tài sản đó để khấu trừ vào tiền nợ và cho người khác thuê phòng mà không cấu thành hành vi vi phạm pháp luật.`
        `Phòng thuê: ${room.title || ''} - ${room.location || ''}.`,
    ].join('\n\n');

const createNumericOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

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
            .populate('tenantId', 'fullName email phone avatar address cccdNumber verificationStatus')
            .populate('landlordId', 'fullName email phone avatar address cccdNumber verificationStatus');

        if (!deposit) throw new BadRequestError('Giao dịch thuê không tồn tại');
        if (deposit.landlordId._id.toString() !== landlordId) throw new BadRequestError('Bạn không có quyền tạo hợp đồng này');
        if (deposit.status !== 'completed') throw new BadRequestError('Chỉ tạo hợp đồng từ giao dịch đã xác nhận hoàn tất');

        const existed = await modelContract.findOne({ depositId });
        if (existed) throw new BadRequestError('Giao dịch này đã có hợp đồng');
        const legalData = normalizeLegalPayload(req.body, deposit);

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
            ...legalData,
            terms: terms?.trim() || buildDefaultTerms(deposit.roomId, legalData, endDate),
            status: 'waiting_tenant_signature',
        });

        await this.notifyContractCreated(contract);
        await createNotification(
            contract.tenantId,
            'Hợp đồng cần ký',
            `Hợp đồng ${contract.contractCode} đang chờ bạn ký`,
            'contract',
            '/trang-ca-nhan?tab=tenant-contracts',
            { contractId: contract._id, contractCode: contract.contractCode },
        );
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

    async requestSignatureOtp(req, res) {
        const { contractId, role } = req.body;
        const contract = await this.getContractForSigning(contractId);
        const isTenant = role === 'tenant';
        const isLandlord = role === 'landlord';
        if (!isTenant && !isLandlord) throw new BadRequestError('Vai trò ký hợp đồng không hợp lệ');
        if (isTenant && contract.tenantId.toString() !== req.user.id) throw new BadRequestError('Người thuê chỉ được lấy OTP cho hợp đồng của mình');
        if (isLandlord && contract.landlordId.toString() !== req.user.id) throw new BadRequestError('Chủ trọ chỉ được lấy OTP cho hợp đồng của mình');
        if (isTenant && contract.status !== 'waiting_tenant_signature') throw new BadRequestError('Hợp đồng chưa đến lượt người thuê ký');
        if (isLandlord && contract.status !== 'waiting_landlord_signature') throw new BadRequestError('Hợp đồng chưa đến lượt chủ trọ ký');

        const signer = await modelUser.findById(req.user.id).select('fullName email phone');
        if (!signer?.email) throw new BadRequestError('Tài khoản cần có email để nhận OTP ký hợp đồng');

        const otp = createNumericOtp();
        const hash = await bcrypt.hash(otp, 10);
        if (isTenant) {
            contract.tenantSignatureOtpHash = hash;
            contract.tenantSignatureOtpExpires = new Date(Date.now() + SIGNATURE_OTP_EXPIRES_MS);
        } else {
            contract.landlordSignatureOtpHash = hash;
            contract.landlordSignatureOtpExpires = new Date(Date.now() + SIGNATURE_OTP_EXPIRES_MS);
        }
        await contract.save();

        await sendContractMail({
            to: signer.email,
            name: signer.fullName,
            contractCode: contract.contractCode,
            pdfUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/trang-ca-nhan?tab=${isTenant ? 'tenant-contracts' : 'landlord-contracts'}`,
            subject: `OTP ký hợp đồng ${contract.contractCode}`,
            title: 'Mã OTP ký hợp đồng điện tử',
            body: `Mã OTP để ký hợp đồng ${contract.contractCode} là ${otp}. Mã có hiệu lực trong 10 phút. Số điện thoại tài khoản dùng để ghi nhận xác thực: ${signer.phone || 'chưa cập nhật'}.`,
            actionLabel: 'Mở hợp đồng',
        });
        await createNotification(
            signer._id,
            'Đã gửi OTP ký hợp đồng',
            `OTP ký hợp đồng ${contract.contractCode} đã được gửi đến email tài khoản.`,
            'contract',
            `/trang-ca-nhan?tab=${isTenant ? 'tenant-contracts' : 'landlord-contracts'}`,
            { contractId: contract._id, contractCode: contract.contractCode },
        );

        new OK({ message: 'Đã gửi OTP ký hợp đồng đến email tài khoản' }).send(res);
    }

    async signAsTenant(req, res) {
        const contract = await this.getContractForSigning(req.body.contractId);
        if (contract.tenantId.toString() !== req.user.id) throw new BadRequestError('Tenant chỉ được ký hợp đồng của mình');
        if (contract.status !== 'waiting_tenant_signature') throw new BadRequestError('Hợp đồng không cho phép người thuê ký lúc này');

        const signer = await this.verifySignatureOtp(contract, req.user.id, 'tenant', req.body.otp);
        const signatureUrl = await this.uploadSignature(req);
        contract.tenantSignatureUrl = signatureUrl;
        contract.tenantSignedAt = new Date();
        contract.tenantSignatureOtpVerifiedAt = new Date();
        contract.tenantSignatureVerifiedPhone = signer.phone || '';
        contract.tenantSignatureIp = req.ip || '';
        contract.tenantSignatureUserAgent = req.get('user-agent') || '';
        contract.tenantSignatureOtpHash = '';
        contract.tenantSignatureOtpExpires = null;
        contract.status = 'waiting_landlord_signature';
        await contract.save();
        await this.notifyLandlordTenantSigned(contract);
        await createNotification(
            contract.landlordId,
            'Hợp đồng cần chủ trọ ký',
            `Người thuê đã ký hợp đồng ${contract.contractCode}`,
            'contract',
            '/trang-ca-nhan?tab=landlord-contracts',
            { contractId: contract._id, contractCode: contract.contractCode },
        );

        const populated = await populateContract(modelContract.findById(contract._id));
        new OK({ message: 'Người thuê đã ký hợp đồng', metadata: formatContract(populated) }).send(res);
    }

    async signAsLandlord(req, res) {
        const contract = await this.getContractForSigning(req.body.contractId);
        if (contract.landlordId.toString() !== req.user.id) throw new BadRequestError('Landlord chỉ được ký hợp đồng của mình');
        if (contract.status !== 'waiting_landlord_signature') throw new BadRequestError('Hợp đồng chưa sẵn sàng để chủ trọ ký');

        const signer = await this.verifySignatureOtp(contract, req.user.id, 'landlord', req.body.otp);
        const signatureUrl = await this.uploadSignature(req);
        contract.landlordSignatureUrl = signatureUrl;
        contract.landlordSignedAt = new Date();
        contract.landlordSignatureOtpVerifiedAt = new Date();
        contract.landlordSignatureVerifiedPhone = signer.phone || '';
        contract.landlordSignatureIp = req.ip || '';
        contract.landlordSignatureUserAgent = req.get('user-agent') || '';
        contract.landlordSignatureOtpHash = '';
        contract.landlordSignatureOtpExpires = null;
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

    async verifySignatureOtp(contract, userId, role, otp) {
        const cleanOtp = String(otp || '').trim();
        if (!cleanOtp) throw new BadRequestError('Vui lòng nhập OTP ký hợp đồng');
        const isTenant = role === 'tenant';
        const hash = isTenant ? contract.tenantSignatureOtpHash : contract.landlordSignatureOtpHash;
        const expires = isTenant ? contract.tenantSignatureOtpExpires : contract.landlordSignatureOtpExpires;
        if (!hash || !expires) throw new BadRequestError('Vui lòng yêu cầu OTP ký hợp đồng trước khi ký');
        if (new Date(expires).getTime() < Date.now()) throw new BadRequestError('OTP ký hợp đồng đã hết hạn');
        const matched = await bcrypt.compare(cleanOtp, hash);
        if (!matched) throw new BadRequestError('OTP ký hợp đồng không chính xác');
        const signer = await modelUser.findById(userId).select('fullName email phone');
        if (!signer) throw new BadRequestError('Tài khoản ký hợp đồng không tồn tại');
        return signer;
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
        if (!freshContract.tenantSignatureOtpVerifiedAt || !freshContract.landlordSignatureOtpVerifiedAt) {
            throw new BadRequestError('Chỉ kích hoạt hợp đồng khi cả hai bên đã xác thực OTP');
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
        await createNotification(
            freshContract.tenantId,
            'Hợp đồng đã hoàn tất',
            `Hợp đồng ${freshContract.contractCode} đã được ký hoàn tất`,
            'contract',
            '/trang-ca-nhan?tab=tenant-contracts',
            { contractId: freshContract._id, contractCode: freshContract.contractCode },
        );
        await createNotification(
            freshContract.landlordId,
            'Hợp đồng đã hoàn tất',
            `Hợp đồng ${freshContract.contractCode} đã được ký hoàn tất`,
            'contract',
            '/trang-ca-nhan?tab=landlord-contracts',
            { contractId: freshContract._id, contractCode: freshContract.contractCode },
        );
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
        if (!contract.tenantSignatureOtpVerifiedAt || !contract.landlordSignatureOtpVerifiedAt) {
            throw new BadRequestError('Chỉ sinh PDF khi cả hai bên đã xác thực OTP');
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
        if (!contract.tenantSignatureOtpVerifiedAt || !contract.landlordSignatureOtpVerifiedAt) {
            throw new BadRequestError('Hợp đồng chưa có đủ xác thực OTP để tải PDF');
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
        if (!contract.tenantSignatureOtpVerifiedAt || !contract.landlordSignatureOtpVerifiedAt) {
            throw new BadRequestError('Hợp đồng chưa có đủ xác thực OTP để tải PDF');
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
