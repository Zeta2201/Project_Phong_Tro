const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const createTransport = async () => {
    if (process.env.EMAIL_USER && EMAIL_APP_PASSWORD) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: EMAIL_APP_PASSWORD,
            },
        });
    }

    const missingConfig = [
        ['EMAIL_USER', process.env.EMAIL_USER],
        ['CLIENT_ID', CLIENT_ID],
        ['CLIENT_SECRET', CLIENT_SECRET],
        ['REDIRECT_URI', REDIRECT_URI],
        ['REFRESH_TOKEN', REFRESH_TOKEN],
    ]
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingConfig.length > 0) {
        throw new Error(`Chưa cấu hình email gửi OTP: thiếu ${missingConfig.join(', ')}`);
    }

    const accessToken = await oAuth2Client.getAccessToken();
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: process.env.EMAIL_USER,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            refreshToken: REFRESH_TOKEN,
            accessToken: accessToken?.token || accessToken,
        },
    });
};

const sendMailChangePhone = async (email, otp, phone) => {
    const transport = await createTransport();
    const info = await transport.sendMail({
        from: `"NESTFINDER" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Mã OTP xác thực đổi số điện thoại NESTFINDER',
        text: `Mã OTP để xác thực đổi số điện thoại sang ${phone} là: ${otp}. Mã có hiệu lực trong 10 phút.`,
        html: `
            <div style="font-family:Arial,sans-serif;background:#f6f8fb;padding:24px;color:#111827">
                <div style="max-width:560px;margin:auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
                    <div style="background:#0f766e;color:#fff;padding:20px 24px">
                        <h2 style="margin:0;font-size:20px">Xác thực đổi số điện thoại</h2>
                    </div>
                    <div style="padding:24px">
                        <p>Bạn đang yêu cầu đổi số điện thoại tài khoản trên NESTFINDER sang <strong>${phone}</strong>.</p>
                        <p>Nhập mã OTP bên dưới để xác thực thay đổi:</p>
                        <div style="font-size:28px;font-weight:800;letter-spacing:6px;text-align:center;padding:18px;border:1px dashed #0f766e;border-radius:8px;background:#ecfdf5;color:#0f766e">${otp}</div>
                        <p style="margin-top:18px;color:#64748b">Mã OTP có hiệu lực trong 10 phút. Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email.</p>
                    </div>
                </div>
            </div>
        `,
    });

    console.log('Change phone OTP sent:', info.messageId);
};

module.exports = sendMailChangePhone;
