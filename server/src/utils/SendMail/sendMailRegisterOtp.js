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
        throw new Error(`Chưa cấu hình email gửi OTP: thiếu ${missingConfig.join(', ')}`);
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

const sendMailRegisterOtp = async (email, otp) => {
    const transport = await createTransport();

    const info = await transport.sendMail({
        from: `"NESTFINDER" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Mã OTP xác thực đăng ký NESTFINDER',
        text: `Mã OTP để xác thực đăng ký tài khoản của bạn là: ${otp}. Mã có hiệu lực trong 5 phút.`,
        html: `
            <div style="font-family:Arial,sans-serif;background:#f6f8fb;padding:24px;color:#0f172a">
                <div style="max-width:560px;margin:auto;background:#fff;border-radius:10px;padding:28px;border:1px solid #e5e7eb">
                    <h2 style="margin-top:0;color:#0f766e">Xác thực đăng ký NESTFINDER</h2>
                    <p>Vui lòng nhập mã OTP bên dưới để hoàn tất đăng ký tài khoản:</p>
                    <div style="font-size:30px;letter-spacing:8px;font-weight:700;text-align:center;margin:24px 0;padding:18px;border-radius:8px;background:#ecfeff;color:#0f766e">
                        ${otp}
                    </div>
                    <p style="color:#64748b">Mã OTP có hiệu lực trong 5 phút. Nếu bạn không yêu cầu đăng ký, vui lòng bỏ qua email này.</p>
                </div>
            </div>
        `,
    });

    console.log('Register OTP sent:', info.messageId);
};

module.exports = sendMailRegisterOtp;
