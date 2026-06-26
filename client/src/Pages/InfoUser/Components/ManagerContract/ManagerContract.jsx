/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from 'react';
import { Button, Card, Descriptions, Image, Input, message, Modal, Space, Table, Tag, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
    requestContractSignOtp,
    requestGetContracts,
    requestSignLandlordContract,
    requestSignTenantContract,
} from '../../../../config/request';

const statusMap = {
    draft: { color: 'default', text: 'Bản nháp' },
    waiting_tenant_signature: { color: 'orange', text: 'Cho người thuê ký' },
    waiting_landlord_signature: { color: 'blue', text: 'Cho chủ trọ ký' },
    active: { color: 'green', text: 'Đang hiệu lực' },
    expired: { color: 'default', text: 'Hết hạn' },
    canceled: { color: 'red', text: 'Đã hủy' },
};

function ManagerContract({ role }) {
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [signing, setSigning] = useState(null);
    const [uploadedSignature, setUploadedSignature] = useState(null);
    const [signatureOtp, setSignatureOtp] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useRef(null);

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const res = await requestGetContracts({ role });
            setContracts(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể tải danh sách hợp đồng');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, [role]);

    const getPointer = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const source = event.touches?.[0] || event;
        return {
            x: source.clientX - rect.left,
            y: source.clientY - rect.top,
        };
    };

    const startDraw = (event) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const point = getPointer(event);
        setIsDrawing(true);
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
    };

    const draw = (event) => {
        if (!isDrawing) return;
        event.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const point = getPointer(event);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#111827';
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const canvasToFile = () =>
        new Promise((resolve) => {
            canvasRef.current.toBlob((blob) => {
                resolve(new File([blob], 'signature.png', { type: 'image/png' }));
            }, 'image/png');
        });

    const openSignModal = (contract) => {
        setSigning(contract);
        setUploadedSignature(null);
        setSignatureOtp('');
    };

    const closeSignModal = () => {
        setSigning(null);
        setUploadedSignature(null);
        setSignatureOtp('');
    };

    const handleRequestOtp = async () => {
        try {
            setOtpSending(true);
            await requestContractSignOtp({ contractId: signing._id, role });
            message.success('Đã gửi OTP ký hợp đồng đến email tài khoản');
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể gửi OTP ký hợp đồng');
        } finally {
            setOtpSending(false);
        }
    };

    const handleSign = async () => {
        if (!signatureOtp.trim()) {
            message.warning('Vui lòng nhập OTP ký hợp đồng');
            return;
        }
        try {
            const signatureFile = uploadedSignature || (await canvasToFile());
            const formData = new FormData();
            formData.append('contractId', signing._id);
            formData.append('otp', signatureOtp.trim());
            formData.append('signature', signatureFile);

            if (role === 'tenant') await requestSignTenantContract(formData);
            else await requestSignLandlordContract(formData);

            message.success('Đã ký hợp đồng');
            closeSignModal();
            fetchContracts();
        } catch (error) {
            message.error(error.response?.data?.message || 'Ký hợp đồng thất bại');
        }
    };

    const canSign = (contract) =>
        (role === 'tenant' && contract.status === 'waiting_tenant_signature') ||
        (role === 'landlord' && contract.status === 'waiting_landlord_signature');

    const columns = [
        { title: 'Mã hợp đồng', dataIndex: 'contractCode', key: 'contractCode' },
        { title: 'Phòng', dataIndex: ['room', 'title'], key: 'room', render: (value) => value || '-' },
        {
            title: role === 'tenant' ? 'Chủ trọ' : 'Người thuê',
            key: 'person',
            render: (_, record) => (role === 'tenant' ? record.landlord?.fullName : record.tenant?.fullName) || '-',
        },
        { title: 'Giá thuê', dataIndex: 'monthlyRent', key: 'monthlyRent', render: (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND` },
        { title: 'Tiền cọc', dataIndex: 'depositAmount', key: 'depositAmount', render: (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND` },
        { title: 'Ngày bắt đầu', dataIndex: 'startDate', key: 'startDate', render: (value) => dayjs(value).format('DD/MM/YYYY') },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (value) => <Tag color={statusMap[value]?.color}>{statusMap[value]?.text || value}</Tag>,
        },
        {
            title: 'Thao tác',
            key: 'actions',
            render: (_, record) => (
                <Space wrap>
                    <Button onClick={() => setSelected(record)}>Chi tiết</Button>
                    {canSign(record) && <Button type="primary" onClick={() => openSignModal(record)}>Ký hợp đồng</Button>}
                    {record.pdfUrl && (
                        <Button href={`http://localhost:3000/api/contracts/download?id=${record._id}`} target="_blank">
                            Tải PDF
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card>
            <Table columns={columns} dataSource={contracts} rowKey="_id" loading={loading} pagination={{ pageSize: 8 }} scroll={{ x: 1400 }} />

            <Modal title="Chi tiết hợp đồng" open={Boolean(selected)} onCancel={() => setSelected(null)} footer={null} width={900}>
                {selected && (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="Mã hợp đồng">{selected.contractCode}</Descriptions.Item>
                            <Descriptions.Item label="Trạng thái">
                                <Tag color={statusMap[selected.status]?.color}>{statusMap[selected.status]?.text || selected.status}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Phòng">{selected.room?.title}</Descriptions.Item>
                            <Descriptions.Item label="Địa chỉ">{selected.room?.location}</Descriptions.Item>
                            <Descriptions.Item label="Chủ trọ">{selected.landlord?.fullName}</Descriptions.Item>
                            <Descriptions.Item label="Người thuê">{selected.tenant?.fullName}</Descriptions.Item>
                            <Descriptions.Item label="Giá thuê">{Number(selected.monthlyRent || 0).toLocaleString('vi-VN')} VND</Descriptions.Item>
                            <Descriptions.Item label="Tiền cọc">{Number(selected.depositAmount || 0).toLocaleString('vi-VN')} VND</Descriptions.Item>
                            <Descriptions.Item label="Ngày bắt đầu">{dayjs(selected.startDate).format('DD/MM/YYYY')}</Descriptions.Item>
                            <Descriptions.Item label="Ngày kết thúc">{dayjs(selected.endDate).format('DD/MM/YYYY')}</Descriptions.Item>
                            <Descriptions.Item label="Người thuê ký">{selected.tenantSignedAt ? dayjs(selected.tenantSignedAt).format('DD/MM/YYYY HH:mm') : 'Chưa ký'}</Descriptions.Item>
                            <Descriptions.Item label="Chủ trọ ký">{selected.landlordSignedAt ? dayjs(selected.landlordSignedAt).format('DD/MM/YYYY HH:mm') : 'Chưa ký   '}</Descriptions.Item>
                            <Descriptions.Item label="Kỳ thanh toán">
                                Ngày {selected.paymentFromDay || 1} đến {selected.paymentToDay || 5} hàng tháng
                            </Descriptions.Item>
                            <Descriptions.Item label="Tiền điện">{Number(selected.electricityRate || 0).toLocaleString('vi-VN')} VND/kWh</Descriptions.Item>
                            <Descriptions.Item label="Tiền nước">{Number(selected.waterRate || 0).toLocaleString('vi-VN')} VND</Descriptions.Item>
                            <Descriptions.Item label="Phí khác">{Number(selected.otherMonthlyFee || 0).toLocaleString('vi-VN')} VND/tháng</Descriptions.Item>
                            <Descriptions.Item label="CCCD chủ trọ">{selected.landlordIdentityNumber || selected.landlord?.cccdNumber || '-'}</Descriptions.Item>
                            <Descriptions.Item label="CCCD người thuê">{selected.tenantIdentityNumber || selected.tenant?.cccdNumber || '-'}</Descriptions.Item>
                            <Descriptions.Item label="OTP người thuê">
                                {selected.tenantSignatureOtpVerifiedAt ? dayjs(selected.tenantSignatureOtpVerifiedAt).format('DD/MM/YYYY HH:mm') : 'Chưa xác thực'}
                            </Descriptions.Item>
                            <Descriptions.Item label="OTP chủ trọ">
                                {selected.landlordSignatureOtpVerifiedAt ? dayjs(selected.landlordSignatureOtpVerifiedAt).format('DD/MM/YYYY HH:mm') : 'Chưa xác thực'}
                            </Descriptions.Item>
                        </Descriptions>
                        <Input.TextArea value={selected.terms} rows={6} readOnly />
                        <Space>
                            {selected.tenantSignatureUrl && <Image width={180} src={selected.tenantSignatureUrl} />}
                            {selected.landlordSignatureUrl && <Image width={180} src={selected.landlordSignatureUrl} />}
                        </Space>
                    </Space>
                )}
            </Modal>

            <Modal
                title="Ký điện tử hợp đồng"
                open={Boolean(signing)}
                onCancel={closeSignModal}
                onOk={handleSign}
                okText="Xác nhận ký"
                cancelText="Hủy"
                width={680}
            >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            value={signatureOtp}
                            onChange={(event) => setSignatureOtp(event.target.value)}
                            placeholder="Nhập OTP ký hợp đồng"
                            maxLength={6}
                        />
                        <Button loading={otpSending} onClick={handleRequestOtp}>
                            Gửi OTP
                        </Button>
                    </Space.Compact>
                    <canvas
                        ref={canvasRef}
                        width={560}
                        height={180}
                        style={{ width: '100%', border: '1px solid #d9d9d9', borderRadius: 8, touchAction: 'none' }}
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={() => setIsDrawing(false)}
                        onMouseLeave={() => setIsDrawing(false)}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={() => setIsDrawing(false)}
                    />
                    <Space>
                        <Button onClick={clearCanvas}>Xóa chữ ký vẽ</Button>
                        <Upload
                            beforeUpload={(file) => {
                                setUploadedSignature(file);
                                return false;
                            }}
                            maxCount={1}
                            accept="image/*"
                        >
                            <Button icon={<UploadOutlined />}>Tải ảnh chữ ký</Button>
                        </Upload>
                    </Space>
                </Space>
            </Modal>
        </Card>
    );
}

export default ManagerContract;
