const PDFDocument = require('pdfkit');

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa cập nhật');
const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND`;

const fetchImageBuffer = async (url) => {
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
};

const collectPdfBuffer = (doc) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });

const drawInfoLine = (doc, label, value) => {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value || 'Chưa cập nhật');
};

const generateContractPdfBuffer = async (contract) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const pdfPromise = collectPdfBuffer(doc);
    const room = contract.roomId || {};
    const tenant = contract.tenantId || {};
    const landlord = contract.landlordId || {};

    doc.font('Helvetica-Bold').fontSize(18).text('HỢP ĐỒNG THUÊ PHÒNG TRỌ', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(11).text(`Mã hợp đồng: ${contract.contractCode}`, { align: 'center' });
    doc.moveDown(1.2);

    doc.font('Helvetica-Bold').fontSize(13).text('1. Thông tin phòng trọ');
    doc.moveDown(0.4);
    doc.fontSize(11);
    drawInfoLine(doc, 'Phòng', room.title);
    drawInfoLine(doc, 'Địa chỉ', room.location);
    drawInfoLine(doc, 'Giá thuê hàng tháng', formatMoney(contract.monthlyRent));
    drawInfoLine(doc, 'Tiền đặt cọc', formatMoney(contract.depositAmount));
    drawInfoLine(doc, 'Ngày bắt đầu', formatDate(contract.startDate));
    drawInfoLine(doc, 'Ngày kết thúc', formatDate(contract.endDate));
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(13).text('2. Thông tin các bên');
    doc.moveDown(0.4);
    drawInfoLine(doc, 'Chủ trọ', landlord.fullName || landlord.username);
    drawInfoLine(doc, 'Email chủ trọ', landlord.email);
    drawInfoLine(doc, 'Số điện thoại chủ trọ', landlord.phone);
    doc.moveDown(0.3);
    drawInfoLine(doc, 'Người thuê', tenant.fullName || tenant.username);
    drawInfoLine(doc, 'Email người thuê', tenant.email);
    drawInfoLine(doc, 'Số điện thoại người thuê', tenant.phone);
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(13).text('3. Điều khoản hợp đồng');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(11).text(contract.terms || '', {
        align: 'justify',
        lineGap: 4,
    });
    doc.moveDown(1.2);

    doc.font('Helvetica-Bold').fontSize(13).text('4. Chữ ký điện tử');
    doc.moveDown(0.8);

    const startY = doc.y;
    const tenantSignature = await fetchImageBuffer(contract.tenantSignatureUrl);
    const landlordSignature = await fetchImageBuffer(contract.landlordSignatureUrl);
    const colWidth = 230;

    doc.font('Helvetica-Bold').fontSize(11).text('Người thuê', 48, startY, { width: colWidth, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(11).text('Chủ trọ', 315, startY, { width: colWidth, align: 'center' });

    if (tenantSignature) {
        doc.image(tenantSignature, 92, startY + 28, { fit: [140, 70], align: 'center' });
    }
    if (landlordSignature) {
        doc.image(landlordSignature, 359, startY + 28, { fit: [140, 70], align: 'center' });
    }

    doc.font('Helvetica').fontSize(10);
    doc.text(`Ky luc: ${formatDate(contract.tenantSignedAt)}`, 48, startY + 110, { width: colWidth, align: 'center' });
    doc.text(`Ky luc: ${formatDate(contract.landlordSignedAt)}`, 315, startY + 110, { width: colWidth, align: 'center' });

    doc.end();
    return pdfPromise;
};

module.exports = {
    generateContractPdfBuffer,
};
