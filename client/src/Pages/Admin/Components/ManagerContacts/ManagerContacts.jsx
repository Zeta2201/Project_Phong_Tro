/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Input, message, Modal, Row, Select, Space, Statistic, Table, Tag } from 'antd';
import { EyeOutlined, FileSearchOutlined, MailOutlined } from '@ant-design/icons';
import { requestGetContacts, requestUpdateContact } from '../../../../config/request';

const statusConfig = {
    pending: { color: 'orange', text: 'Chờ xử lý' },
    resolved: { color: 'green', text: 'Đã xử lý' },
    rejected: { color: 'red', text: 'Từ chối' },
};

function ManagerContacts() {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContact, setSelectedContact] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [processStatus, setProcessStatus] = useState('pending');
    const [adminNote, setAdminNote] = useState('');

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const res = await requestGetContacts({
                status: statusFilter || undefined,
                q: searchQuery || undefined,
            });
            setContacts(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Lấy danh sách liên hệ thất bại');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, [statusFilter, searchQuery]);

    const openProcessModal = (contact) => {
        setSelectedContact(contact);
        setProcessStatus(contact.status);
        setAdminNote(contact.adminNote || '');
        setModalOpen(true);
    };

    const closeProcessModal = () => {
        setSelectedContact(null);
        setModalOpen(false);
        setAdminNote('');
    };

    const handleUpdateContact = async () => {
        if (!selectedContact) return;

        try {
            await requestUpdateContact({
                id: selectedContact._id,
                status: processStatus,
                adminNote,
            });
            message.success('Đã cập nhật liên hệ');
            closeProcessModal();
            fetchContacts();
        } catch (error) {
            message.error(error.response?.data?.message || 'Cập nhật liên hệ thất bại');
        }
    };

    const columns = [
        {
            title: 'Người gửi',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Số điện thoại',
            dataIndex: 'phone',
            key: 'phone',
            render: (phone) => phone || '-',
        },
        {
            title: 'Nội dung',
            dataIndex: 'message',
            key: 'message',
            ellipsis: true,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status) => <Tag color={statusConfig[status]?.color}>{statusConfig[status]?.text || status}</Tag>,
        },
        {
            title: 'Ngày gửi',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => new Date(date).toLocaleString('vi-VN'),
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_, record) => (
                <Button type="primary" icon={<EyeOutlined />} onClick={() => openProcessModal(record)}>
                    Xem / xử lý
                </Button>
            ),
        },
    ];

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={12} lg={10}>
                    <Input.Search
                        prefix={<FileSearchOutlined />}
                        placeholder="Tìm theo tên, email, số điện thoại, nội dung"
                        allowClear
                        enterButton="Tìm"
                        onSearch={setSearchQuery}
                    />
                </Col>
                <Col xs={24} md={6} lg={4}>
                    <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        style={{ width: '100%' }}
                        options={[
                            { label: 'Tất cả', value: '' },
                            { label: 'Chờ xử lý', value: 'pending' },
                            { label: 'Đã xử lý', value: 'resolved' },
                            { label: 'Từ chối', value: 'rejected' },
                        ]}
                    />
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic title="Tổng liên hệ" value={contacts.length} prefix={<MailOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic title="Chờ xử lý" value={contacts.filter((item) => item.status === 'pending').length} />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic title="Đã xử lý" value={contacts.filter((item) => item.status === 'resolved').length} />
                    </Card>
                </Col>
            </Row>

            <Card>
                <Table
                    columns={columns}
                    dataSource={contacts}
                    loading={loading}
                    rowKey="_id"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1100 }}
                />
            </Card>

            <Modal
                title="Xử lý liên hệ"
                open={modalOpen}
                onCancel={closeProcessModal}
                onOk={handleUpdateContact}
                okText="Lưu xử lý"
                cancelText="Đóng"
                width={720}
            >
                {selectedContact && (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="Người gửi">{selectedContact.name}</Descriptions.Item>
                            <Descriptions.Item label="Email">{selectedContact.email}</Descriptions.Item>
                            <Descriptions.Item label="Số điện thoại">{selectedContact.phone || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Nội dung">{selectedContact.message}</Descriptions.Item>
                            <Descriptions.Item label="Ngày gửi">
                                {new Date(selectedContact.createdAt).toLocaleString('vi-VN')}
                            </Descriptions.Item>
                        </Descriptions>

                        <Select
                            value={processStatus}
                            onChange={setProcessStatus}
                            style={{ width: '100%' }}
                            options={[
                                { label: 'Chờ xử lý', value: 'pending' },
                                { label: 'Đã xử lý', value: 'resolved' },
                                { label: 'Từ chối', value: 'rejected' },
                            ]}
                        />
                        <Input.TextArea
                            value={adminNote}
                            onChange={(event) => setAdminNote(event.target.value)}
                            rows={4}
                            maxLength={2000}
                            placeholder="Nhập ghi chú xử lý nội bộ..."
                        />
                    </Space>
                )}
            </Modal>
        </div>
    );
}

export default ManagerContacts;
