/* eslint-disable no-unused-vars */
import { Row, Col, Card, Typography, Table, Modal, Form, Input, Button, Upload, message, AutoComplete, Tag, Descriptions, Alert, Space } from 'antd';
import {
    UserOutlined,
    PhoneOutlined,
    MailOutlined,
    EnvironmentOutlined,
    HeartOutlined,
    EditOutlined,
    UploadOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import classNames from 'classnames/bind';
import styles from './PersonalInfo.module.scss';
import { useStore } from '../../../../hooks/useStore';
import { useState, useEffect } from 'react';
import {
    requestGetFavourite,
    requestChangeEmailOtp,
    requestChangePhoneOtp,
    requestSubmitCccdVerification,
    requestUpdateUser,
    requestUploadImage,
    requestUploadImages,
    requestVerifyChangeEmail,
    requestVerifyChangePhone,
} from '../../../../config/request';
import axios from 'axios';
import useDebounce from '../../../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';

import userNotFound from '../../../../assets/images/img_default.png';

const cx = classNames.bind(styles);
const { Text, Title } = Typography;

function PersonalInfo() {
    const navigate = useNavigate();
    const { dataUser, fetchAuth, clearAuthState } = useStore();
    const [favourite, setFavourite] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
    const [isPhoneOtpModalVisible, setIsPhoneOtpModalVisible] = useState(false);
    const [emailChangeStep, setEmailChangeStep] = useState('email');
    const [emailChangeLoading, setEmailChangeLoading] = useState(false);
    const [phoneChangeLoading, setPhoneChangeLoading] = useState(false);
    const [pendingProfileValues, setPendingProfileValues] = useState(null);
    const [form] = Form.useForm();
    const [emailForm] = Form.useForm();
    const [otpForm] = Form.useForm();
    const [phoneOtpForm] = Form.useForm();
    const [cccdForm] = Form.useForm();
    const [avatarUrl, setAvatarUrl] = useState(dataUser?.avatar || '');
    const [cccdUploading, setCccdUploading] = useState(false);
    const [valueSearch, setValueSearch] = useState('');
    const [dataSearch, setDataSearch] = useState([]);

    const debouncedSearch = useDebounce(valueSearch, 500);
    const isGoogleAccount = dataUser.provider === 'google' || dataUser.typeLogin === 'google';
    const hasRequiredCccdInfo = Boolean(String(dataUser.cccdFullName || '').trim() && String(dataUser.cccdNumber || '').trim());

    useEffect(() => {
        const fetchData = async () => {
            if (debouncedSearch) {
                const res = await axios.get(`https://rsapi.goong.io/Place/AutoComplete`, {
                    params: {
                        input: debouncedSearch,
                        api_key: '3HcKy9jen6utmzxno4HwpkN1fJYll5EM90k53N4K',
                    },
                });
                setDataSearch(res.data.predictions);
            } else {
                setDataSearch([]);
            }
        };
        fetchData();
    }, [debouncedSearch]);

    useEffect(() => {
        cccdForm.setFieldsValue({
            cccdFullName: dataUser.cccdFullName || dataUser.fullName || '',
            cccdNumber: dataUser.cccdNumber || '',
            cccdDob: dataUser.cccdDob || '',
            cccdAddress: dataUser.cccdAddress || dataUser.address || '',
        });
    }, [cccdForm, dataUser]);

    useEffect(() => {
        const fetchFavourite = async () => {
            const res = await requestGetFavourite();
            setFavourite(res.metadata);
        };
        fetchFavourite();
    }, []);

    const handleEdit = () => {
        form.setFieldsValue({
            fullName: dataUser.fullName,
            phone: dataUser.phone,
            email: dataUser.email,
            address: dataUser.address,
        });
        setAvatarUrl(dataUser?.avatar || '');
        setIsModalVisible(true);
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            const { email, phone, ...editableValues } = values;
            const nextPhone = String(phone || '').trim();
            const currentPhone = String(dataUser.phone || '').trim();
            const data = {
                ...editableValues,
                avatar: avatarUrl,
            };

            if (nextPhone !== currentPhone) {
                setPhoneChangeLoading(true);
                const res = await requestChangePhoneOtp({ phone: nextPhone });
                message.success(res.message);
                setPendingProfileValues(data);
                setIsPhoneOtpModalVisible(true);
                return;
            }

            const res = await requestUpdateUser(data);
            message.success(res.message);
            setIsModalVisible(false);
            fetchAuth();
        } catch (error) {
            if (error?.errorFields) return;
            message.error(error?.response?.data?.message || 'Cập nhật thông tin thất bại');
        } finally {
            setPhoneChangeLoading(false);
        }
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
        setAvatarUrl(dataUser?.avatar || '');
        setPendingProfileValues(null);
        setIsPhoneOtpModalVisible(false);
        phoneOtpForm.resetFields();
    };

    const closePhoneOtpModal = () => {
        setIsPhoneOtpModalVisible(false);
        phoneOtpForm.resetFields();
    };

    const handleVerifyChangePhone = async () => {
        try {
            const values = await phoneOtpForm.validateFields();
            setPhoneChangeLoading(true);
            const phoneRes = await requestVerifyChangePhone({ otp: values.otp });
            if (pendingProfileValues) {
                await requestUpdateUser(pendingProfileValues);
            }
            message.success(phoneRes.message);
            closePhoneOtpModal();
            setIsModalVisible(false);
            setPendingProfileValues(null);
            form.resetFields();
            await fetchAuth();
        } catch (error) {
            if (error?.errorFields) return;
            message.error(error?.response?.data?.message || 'Xác thực OTP đổi số điện thoại thất bại');
        } finally {
            setPhoneChangeLoading(false);
        }
    };

    const openEmailModal = () => {
        if (isGoogleAccount) {
            message.info('Email của tài khoản này được quản lý bởi Google và không thể thay đổi trong hệ thống.');
            return;
        }

        setEmailChangeStep('email');
        emailForm.resetFields();
        otpForm.resetFields();
        setIsEmailModalVisible(true);
    };

    const closeEmailModal = () => {
        setIsEmailModalVisible(false);
        setEmailChangeStep('email');
        emailForm.resetFields();
        otpForm.resetFields();
    };

    const handleRequestChangeEmail = async () => {
        try {
            const values = await emailForm.validateFields();
            setEmailChangeLoading(true);
            const res = await requestChangeEmailOtp({ email: values.email });
            message.success(res.message);
            setEmailChangeStep('otp');
        } catch (error) {
            if (error?.errorFields) return;
            message.error(error?.response?.data?.message || 'Không thể gửi OTP đổi email');
        } finally {
            setEmailChangeLoading(false);
        }
    };

    const handleVerifyChangeEmail = async () => {
        try {
            const values = await otpForm.validateFields();
            setEmailChangeLoading(true);
            const res = await requestVerifyChangeEmail({ otp: values.otp });
            message.success(res.message);
            closeEmailModal();
            clearAuthState();
            navigate('/login');
        } catch (error) {
            if (error?.errorFields) return;
            message.error(error?.response?.data?.message || 'Xác thực OTP thất bại');
        } finally {
            setEmailChangeLoading(false);
        }
    };

    const beforeUpload = (file) => {
        const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
        if (!isJpgOrPng) {
            message.error('Bạn chỉ có thể tải lên file JPG/PNG!');
        }
        const isLt2M = file.size / 1024 / 1024 < 2;
        if (!isLt2M) {
            message.error('Ảnh phải nhỏ hơn 2MB!');
        }
        return isJpgOrPng && isLt2M;
    };

    const handleAvatarChange = async (info) => {
        if (info.file.status === 'done') {
            setAvatarUrl(info.file.response.image);
            message.success('Tải ảnh lên thành công!');
        } else if (info.file.status === 'error') {
            message.error('Tải ảnh lên thất bại!');
        }
    };

    const getVerificationConfig = (status) =>
        ({
            none: { color: 'default', text: 'Chưa xác thực' },
            pending: { color: 'orange', text: 'Chờ admin duyệt' },
            verified: { color: 'green', text: 'Đã xác thực' },
            rejected: { color: 'red', text: 'Bị từ chối' },
        })[status || 'none'] || { color: 'default', text: status };

    const handleSubmitCccd = async ({ file, onSuccess, onError }) => {
        setCccdUploading(true);

        try {
            const values = await cccdForm.validateFields();
            const formData = new FormData();
            formData.append('cccd', file);
            formData.append('cccdFullName', values.cccdFullName || '');
            formData.append('cccdNumber', values.cccdNumber || '');
            formData.append('cccdDob', values.cccdDob || '');
            formData.append('cccdAddress', values.cccdAddress || '');

            const res = await requestSubmitCccdVerification(formData);
            message.success(res.message);
            await fetchAuth();
            onSuccess?.(res);
        } catch (error) {
            if (error?.errorFields) {
                message.error('Vui lòng nhập họ tên và số CCCD trước khi tải ảnh');
            } else {
                message.error(error.response?.data?.message || 'Gửi xác thực CCCD thất bại');
            }
            onError?.(error);
        } finally {
            setCccdUploading(false);
        }
    };

    const favoriteColumns = [
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: 'Giá',
            dataIndex: 'price',
            key: 'price',
            render: (price) => `${price.toLocaleString('vi-VN')} VNĐ`,
        },
        {
            title: 'Ngày đăng',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => new Date(date).toLocaleDateString('vi-VN'),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'endDate',
            key: 'status',
            render: (endDate) => {
                const currentDate = new Date();
                const postEndDate = new Date(endDate);
                const isExpired = postEndDate < currentDate;
                return (
                    <span style={{ color: isExpired ? '#ff4d4f' : '#52c41a' }}>
                        {isExpired ? 'Đã hết hạn' : 'Đang đăng'}
                    </span>
                );
            },
        },
    ];

    // Mock data - replace with actual data from your API
    const favoritePosts = favourite.map((item) => ({
        key: item._id,
        title: item.title,
        price: item.price,
        createdAt: item.createdAt,
        endDate: item.endDate,
    }));

    const handleSelectAddress = (value, option) => {
        form.setFieldsValue({ address: value });
    };

    return (
        <div className={cx('personalInfo')}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
                    Chỉnh sửa thông tin
                </Button>
            </div>

            <Row gutter={[24, 24]}>
                <Col span={12}>
                    <Card size="small" className={cx('info-card')}>
                        <div className={cx('info-item')}>
                            <UserOutlined className={cx('info-icon')} />
                            <div>
                                <Text strong>Họ và tên</Text>
                                <div>{dataUser.fullName}</div>
                            </div>
                        </div>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card size="small" className={cx('info-card')}>
                        <div className={cx('info-item')}>
                            <PhoneOutlined className={cx('info-icon')} />
                            <div>
                                <Text strong>Số điện thoại</Text>
                                <div>{dataUser.phone}</div>
                            </div>
                        </div>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card size="small" className={cx('info-card')}>
                        <div className={cx('info-item')}>
                            <MailOutlined className={cx('info-icon')} />
                            <div>
                                <Text strong>Email</Text>
                                <Space size={8} wrap>
                                    <span>{dataUser.email}</span>
                                    <Button size="small" onClick={openEmailModal} disabled={isGoogleAccount}>
                                        Đổi email
                                    </Button>
                                </Space>
                                {isGoogleAccount && (
                                    <Text type="secondary" className={cx('email-note')}>
                                        Email của tài khoản này được quản lý bởi Google và không thể thay đổi trong hệ thống.
                                    </Text>
                                )}
                            </div>
                        </div>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card size="small" className={cx('info-card')}>
                        <div className={cx('info-item')}>
                            <EnvironmentOutlined className={cx('info-icon')} />
                            <div>
                                <Text strong>Địa chỉ</Text>
                                <div>{dataUser.address}</div>
                            </div>
                        </div>
                    </Card>
                </Col>
            </Row>

            <div style={{ marginTop: '24px' }}>
                <Card style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <SafetyCertificateOutlined style={{ fontSize: 20, marginRight: 8, color: '#0f766e' }} />
                            <Title level={4} style={{ margin: 0 }}>
                                Xác thực chủ trọ bằng CCCD
                            </Title>
                        </div>
                        <Tag color={getVerificationConfig(dataUser.verificationStatus).color}>
                            {getVerificationConfig(dataUser.verificationStatus).text}
                        </Tag>
                    </div>

                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="Họ tên OCR">{dataUser.cccdFullName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Số CCCD">{dataUser.cccdNumber || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Ngày sinh">{dataUser.cccdDob || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Địa chỉ">{dataUser.cccdAddress || '-'}</Descriptions.Item>
                        {dataUser.verificationRejectReason && (
                            <Descriptions.Item label="Lý do từ chối">{dataUser.verificationRejectReason}</Descriptions.Item>
                        )}
                    </Descriptions>

                    {dataUser.verificationStatus === 'verified' && !hasRequiredCccdInfo && (
                        <Alert
                            type="warning"
                            showIcon
                            style={{ marginTop: 14 }}
                            message="Tài khoản đã được duyệt nhưng thông tin OCR CCCD đang trống. Vui lòng tải lại ảnh CCCD rõ hơn để cập nhật dữ liệu."
                        />
                    )}

                    {dataUser.cccdImageUrl && dataUser.verificationStatus !== 'verified' && (
                        <div style={{ marginTop: 14 }}>
                            <img
                                src={dataUser.cccdImageUrl}
                                alt="CCCD"
                                style={{ width: 260, maxWidth: '100%', borderRadius: 8, border: '1px solid #e5e7eb' }}
                            />
                        </div>
                    )}

                    <Form form={cccdForm} layout="vertical" style={{ marginTop: 14 }}>
                        <Row gutter={12}>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="cccdFullName"
                                    label="Họ tên trên CCCD"
                                    rules={[{ required: true, message: 'Vui lòng nhập họ tên trên CCCD' }]}
                                >
                                    <Input placeholder="Nhập họ tên trên CCCD" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="cccdNumber"
                                    label="Số CCCD"
                                    rules={[{ required: true, message: 'Vui lòng nhập số CCCD' }]}
                                >
                                    <Input placeholder="Nhập số CCCD" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="cccdDob" label="Ngày sinh">
                                    <Input placeholder="VD: 01/01/2000" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="cccdAddress" label="Địa chỉ trên CCCD">
                                    <Input placeholder="Nhập địa chỉ trên CCCD" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>

                    <Upload
                        accept="image/png,image/jpeg,image/webp"
                        showUploadList={false}
                        customRequest={handleSubmitCccd}
                        disabled={cccdUploading}
                        beforeUpload={(file) => {
                            const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
                            if (!isImage) message.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP');
                            const isLt5M = file.size / 1024 / 1024 < 5;
                            if (!isLt5M) message.error('Ảnh CCCD phải nhỏ hơn 5MB');
                            return isImage && isLt5M;
                        }}
                    >
                        <Button type="primary" icon={<UploadOutlined />} loading={cccdUploading} style={{ marginTop: 14 }}>
                            Tải ảnh CCCD và gửi xác thực
                        </Button>
                    </Upload>
                </Card>

                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                        <HeartOutlined style={{ fontSize: '20px', marginRight: '8px', color: '#ff4d4f' }} />
                        <Title level={4} style={{ margin: 0 }}>
                            Tin yêu thích
                        </Title>
                    </div>
                    <Table columns={favoriteColumns} dataSource={favoritePosts} pagination={{ pageSize: 5 }} />
                </Card>
            </div>

            <Modal
                title="Chỉnh sửa thông tin cá nhân"
                open={isModalVisible}
                onOk={handleOk}
                onCancel={handleCancel}
                okText="Lưu"
                okButtonProps={{ loading: phoneChangeLoading }}
                cancelText="Hủy"
                width={600}
            >
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <img
                            src={avatarUrl || userNotFound}
                            alt="avatar"
                            style={{
                                width: avatarUrl ? '150px' : '140px',
                                height: avatarUrl ? '150px' : '140px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                            }}
                        />
                    </div>
                    <Upload
                        name="avatar"
                        showUploadList={false}
                        beforeUpload={beforeUpload}
                        onChange={handleAvatarChange}
                        action="http://localhost:3000/api/upload-image"
                    >
                        <Button icon={<UploadOutlined />}>Tải ảnh lên</Button>
                    </Upload>
                </div>
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="fullName"
                        label="Họ và tên"
                        rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
                    >
                        <Input prefix={<UserOutlined />} />
                    </Form.Item>
                    <Form.Item
                        name="phone"
                        label="Số điện thoại"
                        rules={[
                            { required: true, message: 'Vui lòng nhập số điện thoại' },
                            { pattern: /^(0|\+84)[0-9]{9,10}$/, message: 'Số điện thoại không hợp lệ' },
                        ]}
                    >
                        <Input prefix={<PhoneOutlined />} />
                    </Form.Item>
                    <Form.Item name="email" label="Email">
                        <Input
                            prefix={<MailOutlined />}
                            disabled
                            addonAfter={
                                !isGoogleAccount ? (
                                    <Button type="link" size="small" onClick={openEmailModal}>
                                        Đổi email
                                    </Button>
                                ) : null
                            }
                        />
                    </Form.Item>
                    {isGoogleAccount && (
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="Email của tài khoản này được quản lý bởi Google và không thể thay đổi trong hệ thống."
                        />
                    )}
                    <Form.Item
                        name="address"
                        label="Địa chỉ"
                        rules={[{ required: true, message: 'Vui lòng nhập địa chỉ' }]}
                    >
                        <AutoComplete
                            options={dataSearch.map((item) => ({
                                value: item.description,
                                label: item.description,
                            }))}
                            onSelect={handleSelectAddress}
                            onSearch={setValueSearch}
                            notFoundContent={valueSearch ? 'Không tìm thấy địa chỉ' : null}
                        >
                            <Input prefix={<EnvironmentOutlined />} placeholder="Nhập địa chỉ của bạn" />
                        </AutoComplete>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Xác thực đổi số điện thoại"
                open={isPhoneOtpModalVisible}
                onCancel={closePhoneOtpModal}
                footer={[
                    <Button key="cancel" onClick={closePhoneOtpModal}>
                        Hủy
                    </Button>,
                    <Button key="verify" type="primary" loading={phoneChangeLoading} onClick={handleVerifyChangePhone}>
                        Xác thực
                    </Button>,
                ]}
            >
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Mã OTP đã được gửi đến email tài khoản của bạn. Nhập mã để hoàn tất đổi số điện thoại."
                />
                <Form form={phoneOtpForm} layout="vertical">
                    <Form.Item
                        name="otp"
                        label="Mã OTP"
                        rules={[
                            { required: true, message: 'Vui lòng nhập mã OTP' },
                            { len: 6, message: 'OTP gồm 6 chữ số' },
                        ]}
                    >
                        <Input maxLength={6} placeholder="Nhập 6 chữ số" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Đổi email đăng nhập"
                open={isEmailModalVisible}
                onCancel={closeEmailModal}
                footer={
                    emailChangeStep === 'email'
                        ? [
                              <Button key="cancel" onClick={closeEmailModal}>
                                  Hủy
                              </Button>,
                              <Button key="send" type="primary" loading={emailChangeLoading} onClick={handleRequestChangeEmail}>
                                  Gửi OTP
                              </Button>,
                          ]
                        : [
                              <Button key="back" onClick={() => setEmailChangeStep('email')}>
                                  Đổi email mới
                              </Button>,
                              <Button key="verify" type="primary" loading={emailChangeLoading} onClick={handleVerifyChangeEmail}>
                                  Xác thực và đăng xuất
                              </Button>,
                          ]
                }
            >
                {emailChangeStep === 'email' ? (
                    <>
                        <Alert
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="Email mới chỉ được cập nhật sau khi bạn xác thực OTP gửi đến email đó."
                        />
                        <Form form={emailForm} layout="vertical">
                            <Form.Item
                                name="email"
                                label="Email mới"
                                rules={[
                                    { required: true, message: 'Vui lòng nhập email mới' },
                                    { type: 'email', message: 'Email không hợp lệ' },
                                ]}
                            >
                                <Input prefix={<MailOutlined />} placeholder="email-moi@example.com" />
                            </Form.Item>
                        </Form>
                    </>
                ) : (
                    <>
                        <Alert
                            type="success"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="Mã OTP đã được gửi đến email mới. Mã có hiệu lực trong 10 phút."
                        />
                        <Form form={otpForm} layout="vertical">
                            <Form.Item
                                name="otp"
                                label="Mã OTP"
                                rules={[
                                    { required: true, message: 'Vui lòng nhập mã OTP' },
                                    { len: 6, message: 'OTP gồm 6 chữ số' },
                                ]}
                            >
                                <Input maxLength={6} placeholder="Nhập 6 chữ số" />
                            </Form.Item>
                        </Form>
                    </>
                )}
            </Modal>
        </div>
    );
}

export default PersonalInfo;



