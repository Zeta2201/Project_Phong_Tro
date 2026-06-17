/* eslint-disable no-undef */
import classNames from 'classnames/bind';
import styles from './RegisterUser.module.scss';
import Header from '../../Components/Header/Header';
import { Form, Input, Button, Tabs, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, HeatMapOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const cx = classNames.bind(styles);
const { TabPane } = Tabs;
const { Text } = Typography;

import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { requestLoginGoogle, requestRegister, requestRegisterOtp } from '../../config/request';

function RegisterUser() {
    const [form] = Form.useForm();
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [registering, setRegistering] = useState(false);
    const googleClientId = import.meta.env.VITE_CLIENT_ID;

    const navigate = useNavigate();

    const handleSendOtp = async () => {
        try {
            const values = await form.validateFields(['name', 'email', 'phone', 'address', 'password']);
            setSendingOtp(true);
            const res = await requestRegisterOtp({ email: values.email });
            setOtpSent(true);
            message.success(res.message);
        } catch (error) {
            if (error?.errorFields) return;
            message.error(error.response?.data?.message || 'Không thể gửi OTP đăng ký');
        } finally {
            setSendingOtp(false);
        }
    };

    const onFinish = async (values) => {
        if (!otpSent) {
            message.warning('Vui lòng gửi và xác thực OTP trước khi đăng ký');
            return;
        }

        const data = {
            fullName: values.name,
            email: values.email,
            password: values.password,
            phone: values.phone,
            address: values.address,
            otp: values.otp,
        };

        try {
            setRegistering(true);
            const res = await requestRegister(data);
            message.success(res.message);
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            navigate('/');
        } catch (error) {
            message.error(error.response?.data?.message || 'Đăng ký thất bại');
        } finally {
            setRegistering(false);
        }
    };

    const handleSuccess = async (response) => {
        const { credential } = response;
        try {
            const res = await requestLoginGoogle({ credential });
            message.success(res.message);
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            navigate('/');
        } catch (error) {
            message.error(error.response?.data?.message || 'Đăng nhập Google thất bại');
        }
    };

    useEffect(() => {
        document.title = 'Đăng ký';
    }, []);

    return (
        <div className={cx('wrapper')}>
            <header>
                <Header />
            </header>

            <main className={cx('main')}>
                <div className={cx('login-container')}>
                    <Tabs defaultActiveKey="1" centered className={cx('login-tabs')}>
                        <TabPane tab="Tạo tài khoản mới" key="1">
                            <Form form={form} name="register" className={cx('login-form')} onFinish={onFinish}>
                                <Form.Item name="name" rules={[{ required: true, message: 'Vui lòng nhập họ tên!' }]}>
                                    <Input prefix={<UserOutlined />} placeholder="Họ tên" size="large" />
                                </Form.Item>

                                <Form.Item
                                    name="email"
                                    rules={[
                                        { required: true, message: 'Vui lòng nhập email!' },
                                        { type: 'email', message: 'Email không hợp lệ!' },
                                    ]}
                                >
                                    <Input prefix={<MailOutlined />} placeholder="Email" size="large" onChange={() => setOtpSent(false)} />
                                </Form.Item>

                                <Form.Item name="phone" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại!' }]}>
                                    <Input prefix={<PhoneOutlined />} placeholder="Số điện thoại" size="large" />
                                </Form.Item>

                                <Form.Item name="address" rules={[{ required: true, message: 'Vui lòng nhập địa chỉ!' }]}>
                                    <Input prefix={<HeatMapOutlined />} placeholder="Địa chỉ" size="large" />
                                </Form.Item>

                                <Form.Item name="password" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}>
                                    <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" size="large" />
                                </Form.Item>

                                <Space.Compact className={cx('otp-row')} block>
                                    <Form.Item
                                        name="otp"
                                        className={cx('otp-input')}
                                        rules={[
                                            { required: true, message: 'Vui lòng nhập mã OTP!' },
                                            { len: 6, message: 'Mã OTP gồm 6 chữ số!' },
                                        ]}
                                    >
                                        <Input prefix={<SafetyCertificateOutlined />} placeholder="Mã OTP email" size="large" maxLength={6} />
                                    </Form.Item>
                                    <Button size="large" loading={sendingOtp} onClick={handleSendOtp}>
                                        {otpSent ? 'Gửi lại OTP' : 'Gửi OTP'}
                                    </Button>
                                </Space.Compact>

                                {otpSent && (
                                    <Text type="secondary" className={cx('otp-note')}>
                                        Mã OTP đã được gửi đến email của bạn và có hiệu lực trong 5 phút.
                                    </Text>
                                )}

                                <div className={cx('footer')}>
                                    <Form.Item>
                                        <Link className={cx('forgot-password')} to="/login">
                                            Bạn đã có tài khoản
                                        </Link>
                                    </Form.Item>

                                    <Form.Item>
                                        <Link className={cx('forgot-password')} to="/forgot-password">
                                            Bạn quên mật khẩu?
                                        </Link>
                                    </Form.Item>
                                </div>

                                <Form.Item>
                                    {googleClientId ? (
                                        <GoogleOAuthProvider clientId={googleClientId}>
                                            <GoogleLogin onSuccess={handleSuccess} onError={() => message.error('Đăng nhập Google thất bại')} />
                                        </GoogleOAuthProvider>
                                    ) : (
                                        <Text type="danger">Chưa cấu hình VITE_CLIENT_ID cho đăng nhập Google.</Text>
                                    )}
                                </Form.Item>

                                <Form.Item>
                                    <Button type="primary" htmlType="submit" className={cx('login-button')} block size="large" loading={registering}>
                                        Đăng ký
                                    </Button>
                                </Form.Item>

                                <div className={cx('terms')}>
                                    <Text>
                                        Qua việc đăng nhập hoặc tạo tài khoản, bạn đồng ý với các{' '}
                                        <Link to="/operation-regulations">Quy chế hoạt động </Link> cũng như{' '}
                                        <Link to="/privacy">Chính sách bảo mật</Link> của chúng tôi
                                    </Text>
                                </div>
                            </Form>
                        </TabPane>
                    </Tabs>
                </div>
            </main>
        </div>
    );
}

export default RegisterUser;
