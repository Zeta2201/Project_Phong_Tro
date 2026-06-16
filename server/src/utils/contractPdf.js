const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const FONT_REGULAR = 'AppRegular';
const FONT_BOLD = 'AppBold';

const fontCandidates = {
    regular: [
        path.join(__dirname, '..', 'assets', 'fonts', 'arial.ttf'),
        'C:\\Windows\\Fonts\\arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    ],
    bold: [
        path.join(__dirname, '..', 'assets', 'fonts', 'arialbd.ttf'),
        'C:\\Windows\\Fonts\\arialbd.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    ],
};

const findFont = (candidates) => candidates.find((fontPath) => fs.existsSync(fontPath));

const registerVietnameseFonts = (doc) => {
    const regularFont = findFont(fontCandidates.regular);
    const boldFont = findFont(fontCandidates.bold);

    if (!regularFont || !boldFont) {
        return { regular: 'Helvetica', bold: 'Helvetica-Bold' };
    }

    doc.registerFont(FONT_REGULAR, regularFont);
    doc.registerFont(FONT_BOLD, boldFont);

    return { regular: FONT_REGULAR, bold: FONT_BOLD };
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa cập nhật');
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

const drawInfoLine = (doc, fonts, label, value) => {
    doc.font(fonts.bold).text(`${label}: `, { continued: true });
    doc.font(fonts.regular).text(value || 'Chưa cập nhật');
};

const generateContractPdfBuffer = async (contract) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const fonts = registerVietnameseFonts(doc);
    const pdfPromise = collectPdfBuffer(doc);
    const room = contract.roomId || {};
    const tenant = contract.tenantId || {};
    const landlord = contract.landlordId || {};

    doc.font(fonts.bold).fontSize(18).text('HỢP ĐỒNG THUÊ PHÒNG TRỌ', { align: 'center' });
    doc.moveDown(0.4);
    doc.font(fonts.regular).fontSize(11).text(`Mã hợp đồng: ${contract.contractCode}`, { align: 'center' });
    doc.moveDown(1.2);

    doc.font(fonts.bold).fontSize(13).text('1. Thông tin phòng trọ');
    doc.moveDown(0.4);
    doc.fontSize(11);
    drawInfoLine(doc, fonts, 'Phòng', room.title);
    drawInfoLine(doc, fonts, 'Địa chỉ', room.location);
    drawInfoLine(doc, fonts, 'Giá thuê hàng tháng', formatMoney(contract.monthlyRent));
    drawInfoLine(doc, fonts, 'Tiền đặt cọc', formatMoney(contract.depositAmount));
    drawInfoLine(doc, fonts, 'Ngày bắt đầu', formatDate(contract.startDate));
    drawInfoLine(doc, fonts, 'Ngày kết thúc', formatDate(contract.endDate));
    doc.moveDown();

    doc.font(fonts.bold).fontSize(13).text('2. Thông tin các bên');
    doc.moveDown(0.4);
    drawInfoLine(doc, fonts, 'Chủ trọ', landlord.fullName || landlord.username);
    drawInfoLine(doc, fonts, 'Email chủ trọ', landlord.email);
    drawInfoLine(doc, fonts, 'Số điện thoại chủ trọ', landlord.phone);
    doc.moveDown(0.3);
    drawInfoLine(doc, fonts, 'Người thuê', tenant.fullName || tenant.username);
    drawInfoLine(doc, fonts, 'Email người thuê', tenant.email);
    drawInfoLine(doc, fonts, 'Số điện thoại người thuê', tenant.phone);
    doc.moveDown();

    doc.font(fonts.bold).fontSize(13).text('3. Điều khoản hợp đồng');
    doc.moveDown(0.4);
    doc.font(fonts.regular).fontSize(11).text(contract.terms || '', {
        align: 'justify',
        lineGap: 4,
    });
    doc.moveDown(1.2);

    doc.font(fonts.bold).fontSize(13).text('4. Chữ ký điện tử');
    doc.moveDown(0.8);

    const startY = doc.y;
    const tenantSignature = await fetchImageBuffer(contract.tenantSignatureUrl);
    const landlordSignature = await fetchImageBuffer(contract.landlordSignatureUrl);
    const colWidth = 230;

    doc.font(fonts.bold).fontSize(11).text('Người thuê', 48, startY, { width: colWidth, align: 'center' });
    doc.font(fonts.bold).fontSize(11).text('Chủ trọ', 315, startY, { width: colWidth, align: 'center' });

    if (tenantSignature) {
        doc.image(tenantSignature, 92, startY + 28, { fit: [140, 70], align: 'center' });
    }
    if (landlordSignature) {
        doc.image(landlordSignature, 359, startY + 28, { fit: [140, 70], align: 'center' });
    }

    doc.font(fonts.regular).fontSize(10);
    doc.text(`Ký lúc: ${formatDate(contract.tenantSignedAt)}`, 48, startY + 110, { width: colWidth, align: 'center' });
    doc.text(`Ký lúc: ${formatDate(contract.landlordSignedAt)}`, 315, startY + 110, { width: colWidth, align: 'center' });

    doc.end();
    return pdfPromise;
};

module.exports = {
    generateContractPdfBuffer,
};
