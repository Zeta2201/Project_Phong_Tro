const nodemailer = require('nodemailer');
require('dotenv').config();

const createTransport = () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        throw new Error('Missing EMAIL_USER or EMAIL_APP_PASSWORD');
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });
};

const sendContractMail = async ({
    to,
    name,
    contractCode,
    pdfUrl,
    attachments = [],
    subject = `Hợp đồng thuê phòng ${contractCode}`,
    title = 'Hợp đồng thuê phòng đã được ký đầy đủ',
    body = `Hợp đồng ${contractCode} đã được kích hoạt và sẵn sàng tải về.`,
    actionLabel = 'Tải hợp đồng PDF',
}) => {
    const transport = createTransport();

    await transport.sendMail({
        from: `"NESTFINDER" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text: `Xin chào ${name || ''}, ${body} Link: ${pdfUrl}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
                <h2>${title}</h2>
                <p>Xin chào ${name || ''},</p>
                <p>${body}</p>
                <p>
                    <a href="${pdfUrl}" style="display:inline-block;padding:12px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;">
                        ${actionLabel}
                    </a>
                </p>
                <p style="color:#64748b;font-size:13px;">Nếu nút trên không hoạt động, vui lòng mở link: ${pdfUrl}</p>
            </div>
        `,
        attachments,
    });
};

module.exports = sendContractMail;
