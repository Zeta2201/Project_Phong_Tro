import { useEffect, useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { MailOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import classNames from 'classnames/bind';
import styles from './ForgotPassword.module.scss';
import Header from '../../Components/Header/Header';
import { requestForgotPassword, requestResetPassword } from '../../config/request';
import { useNavigate } from 'react-router-dom';

const cx = classNames.bind(styles);
const { Title, Text } = Typography;
const OTP_RESEND_COOLDOWN = 60;

function ForgotPassword() {
    const [form] = Form.useForm();
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const navigate = useNavigate();

    useEffect(() => {
        if (resendCooldown <= 0) {
            return undefined;
        }

        const timer = setInterval(() => {
            setResendCooldown((current) => Math.max(current - 1, 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handleSendOTP = async (values) => {
        try {
            setLoading(true);
            await requestForgotPassword({ email: values.email });
            message.success('Mã xác thực đã được gửi đến email của bạn');
            setEmail(values.email);
            setResendCooldown(OTP_RESEND_COOLDOWN);
            setStep(2);
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể gửi mã xác thực');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        if (!email || resendCooldown > 0) {
            return;
        }

        await handleSendOTP({ email });
    };

    const handleVerifyAndReset = async (values) => {
        try {
            setLoading(true);
            const data = {
                email,
                otp: values.otp,
                password: values.password,
                confirmPassword: values.confirmPassword,
            };

            await requestResetPassword(data);
            message.success('Đặt lại mật khẩu thành công');
            navigate('/login');
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể đặt lại mật khẩu');
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <Form form={form} onFinish={handleSendOTP}>
            <Form.Item
                name="email"
                rules={[
                    { required: true, message: 'Vui lòng nhập email' },
                    { type: 'email', message: 'Email không hợp lệ' },
                ]}
            >
                <Input prefix={<MailOutlined />} placeholder="Nhập email của bạn" size="large" />
            </Form.Item>
            <Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                    Gửi mã xác thực
                </Button>
            </Form.Item>
        </Form>
    );

    const renderStep2 = () => (
        <Form form={form} onFinish={handleVerifyAndReset}>
            <Form.Item
                name="otp"
                rules={[
                    { required: true, message: 'Vui lòng nhập mã OTP' },
                    { len: 6, message: 'Mã OTP phải có 6 số' },
                ]}
            >
                <Input prefix={<SafetyCertificateOutlined />} placeholder="Nhập mã OTP" size="large" />
            </Form.Item>
            <Form.Item
                name="password"
                rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                    { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' },
                ]}
            >
                <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu mới" size="large" />
            </Form.Item>
            <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                    { required: true, message: 'Vui lòng xác nhận mật khẩu' },
                    ({ getFieldValue }) => ({
                        validator(_, value) {
                            if (!value || getFieldValue('password') === value) {
                                return Promise.resolve();
                            }
                            return Promise.reject(new Error('Mật khẩu không khớp'));
                        },
                    }),
                ]}
            >
                <Input.Password prefix={<LockOutlined />} placeholder="Xác nhận mật khẩu mới" size="large" />
            </Form.Item>
            <Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                    Đặt lại mật khẩu
                </Button>
            </Form.Item>
            <Form.Item>
                <Button
                    type="default"
                    htmlType="button"
                    block
                    size="large"
                    loading={loading}
                    disabled={resendCooldown > 0}
                    onClick={handleResendOTP}
                >
                    {resendCooldown > 0 ? `Gửi lại mã sau ${resendCooldown}s` : 'Gửi lại mã OTP'}
                </Button>
            </Form.Item>
        </Form>
    );

    return (
        <div className={cx('wrapper')}>
            <header>
                <Header />
            </header>
            <div className={cx('content')}>
                <Card className={cx('card')}>
                    <Title level={2} className={cx('title')}>
                        Quên mật khẩu
                    </Title>
                    <Text className={cx('description')}>
                        {step === 1 && 'Nhập email của bạn để nhận mã xác thực'}
                        {step === 2 && 'Nhập mã OTP và mật khẩu mới cho tài khoản của bạn'}
                    </Text>
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                </Card>
            </div>
        </div>
    );
}

export default ForgotPassword;
