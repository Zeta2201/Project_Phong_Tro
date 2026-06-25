const { google } = require('googleapis');
const nodemailer = require('nodemailer');

require('dotenv').config();

const requiredEnv = ['CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI', 'REFRESH_TOKEN', 'EMAIL_USER'];

const createTransport = async () => {
    if (requiredEnv.some((key) => !process.env[key])) return null;

    const oAuth2Client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
    oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
    const accessToken = await oAuth2Client.getAccessToken();

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: process.env.EMAIL_USER,
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            refreshToken: process.env.REFRESH_TOKEN,
            accessToken,
        },
    });
};

const sendSavedSearchMail = async (email, savedSearch, post) => {
    try {
        const transport = await createTransport();
        if (!transport) return;

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const postUrl = `${clientUrl}/chi-tiet-tin-dang/${post._id}`;

        await transport.sendMail({
            from: `"NESTFINDER" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Có phòng mới khớp tìm kiếm đã lưu',
            text: `Phòng "${post.title}" vừa khớp với tìm kiếm "${savedSearch.name}". Xem tại: ${postUrl}`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2>Có phòng mới khớp tìm kiếm đã lưu</h2>
                    <p>Phòng <strong>${post.title}</strong> vừa khớp với tiêu chí <strong>${savedSearch.name}</strong>.</p>
                    <p>Giá: <strong>${Number(post.price || 0).toLocaleString('vi-VN')} VND/tháng</strong></p>
                    <p>Địa chỉ: ${post.location || '-'}</p>
                    <p><a href="${postUrl}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;">Xem phòng</a></p>
                </div>
            `,
        });
    } catch (error) {
        console.log('Saved search email error:', error.message);
    }
};

module.exports = sendSavedSearchMail;
