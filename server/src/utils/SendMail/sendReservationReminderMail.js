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

const sendReservationReminderMail = async (email, { title, message, reservation, post }) => {
    try {
        const transport = await createTransport();
        if (!transport) return;

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const postId = post?._id || reservation?.postId?._id || reservation?.postId || '';
        const postUrl = postId ? `${clientUrl}/chi-tiet-tin-dang/${postId}` : clientUrl;

        await transport.sendMail({
            from: `"NESTFINDER" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: title || 'Cập nhật lịch xem phòng',
            text: `${message}\nXem chi tiet: ${postUrl}`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2>${title || 'Cập nhật lịch xem phòng'}</h2>
                    <p>${message}</p>
                    <p><a href="${postUrl}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;">Xem phong</a></p>
                </div>
            `,
        });
    } catch (error) {
        console.log('Reservation email error:', error.message);
    }
};

module.exports = sendReservationReminderMail;
