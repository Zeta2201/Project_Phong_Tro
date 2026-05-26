import { useEffect, useState } from 'react';
import { Table, Card, Row, Col, Statistic, Button, Space, Select, Input, Tag, message, Modal, Descriptions } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, FileSearchOutlined, EyeOutlined } from '@ant-design/icons';
import classNames from 'classnames/bind';
import styles from './ManagerReports.module.scss';
import { requestGetReports, requestUpdateReportStatus } from '../../../../config/request';

const cx = classNames.bind(styles);

const statusColor = {
    pending: 'orange',
    resolved: 'green',
    rejected: 'red',
};

const postStatusMap = {
    active: { color: 'green', text: 'Đang hiển thị' },
    inactive: { color: 'orange', text: 'Đã ẩn' },
    rejected: { color: 'red', text: 'Đã gỡ xuống' },
};

const actionMap = {
    none: { color: 'default', text: 'Không tác động bài viết' },
    hide_post: { color: 'orange', text: 'Ẩn bài viết' },
    takedown_post: { color: 'red', text: 'Gỡ bài viết' },
};

function ManagerReports() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReport, setSelectedReport] = useState(null);
    const [processModalOpen, setProcessModalOpen] = useState(false);
    const [processAction, setProcessAction] = useState('none');
    const [processNote, setProcessNote] = useState('');

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await requestGetReports({
                status: statusFilter || undefined,
                q: searchQuery || undefined,
            });
            setReports(res.metadata || []);
        } catch (error) {
            console.error(error);
            message.error(error.response?.data?.message || 'Lấy danh sách báo cáo thất bại');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [statusFilter, searchQuery]);

    const openProcessModal = (report) => {
        setSelectedReport(report);
        setProcessAction(report.actionTaken || 'none');
        setProcessNote(report.note || '');
        setProcessModalOpen(true);
    };

    const closeProcessModal = () => {
        setSelectedReport(null);
        setProcessAction('none');
        setProcessNote('');
        setProcessModalOpen(false);
    };

    const handleResolveReport = async () => {
        if (!selectedReport) return;

        try {
            await requestUpdateReportStatus({
                id: selectedReport._id,
                status: 'resolved',
                postAction: processAction,
                note: processNote,
            });
            message.success('Đã xử lý báo cáo');
            closeProcessModal();
            fetchReports();
        } catch (error) {
            console.error(error);
            message.error(error.response?.data?.message || 'Xử lý báo cáo thất bại');
        }
    };

    const handleRejectReport = async (report) => {
        try {
            await requestUpdateReportStatus({ id: report._id, status: 'rejected', postAction: 'none' });
            message.success('Đã từ chối báo cáo');
            fetchReports();
        } catch (error) {
            console.error(error);
            message.error(error.response?.data?.message || 'Từ chối báo cáo thất bại');
        }
    };

    const columns = [
        {
            title: 'Bài viết',
            dataIndex: ['post', 'title'],
            key: 'postTitle',
            render: (title, record) => (
                <Space direction="vertical" size={4}>
                    <span>{title || 'Không xác định'}</span>
                    {record.post?.status ? (
                        <Tag color={postStatusMap[record.post.status]?.color || 'default'}>
                            {postStatusMap[record.post.status]?.text || record.post.status}
                        </Tag>
                    ) : null}
                </Space>
            ),
        },
        {
            title: 'Người báo cáo',
            dataIndex: ['reporter', 'fullName'],
            key: 'reporterName',
        },
        {
            title: 'Email',
            dataIndex: ['reporter', 'email'],
            key: 'reporterEmail',
        },
        {
            title: 'Lý do',
            dataIndex: 'reason',
            key: 'reason',
        },
        {
            title: 'Chi tiết',
            dataIndex: 'details',
            key: 'details',
            ellipsis: true,
            render: (details) => details || '-',
        },
        {
            title: 'Báo cáo',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={statusColor[status]}>
                    {status === 'pending' ? 'Chờ xử lý' : status === 'resolved' ? 'Đã xử lý' : 'Đã từ chối'}
                </Tag>
            ),
        },
        {
            title: 'Hành động đã áp dụng',
            dataIndex: 'actionTaken',
            key: 'actionTaken',
            render: (action = 'none') => <Tag color={actionMap[action]?.color}>{actionMap[action]?.text}</Tag>,
        },
        {
            title: 'Ngày báo cáo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => new Date(date).toLocaleString('vi-VN'),
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_, record) => (
                <Space wrap>
                    <Button type="primary" icon={<EyeOutlined />} onClick={() => openProcessModal(record)}>
                        Xem / xử lý
                    </Button>
                    <Button
                        danger
                        icon={<CloseCircleOutlined />}
                        disabled={record.status === 'rejected'}
                        onClick={() => handleRejectReport(record)}
                    >
                        Từ chối
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div className={cx('manager-reports')}>
            <Row gutter={[16, 16]} className={cx('filter-row')}>
                <Col xs={24} sm={24} md={12} lg={10}>
                    <Input.Search
                        prefix={<FileSearchOutlined />}
                        placeholder="Tìm theo người báo cáo, email, lý do"
                        allowClear
                        enterButton="Tìm"
                        onSearch={(value) => setSearchQuery(value)}
                    />
                </Col>
                <Col xs={24} sm={12} md={6} lg={4}>
                    <Select
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
                        style={{ width: '100%' }}
                        options={[
                            { label: 'Tất cả', value: '' },
                            { label: 'Chờ xử lý', value: 'pending' },
                            { label: 'Đã xử lý', value: 'resolved' },
                            { label: 'Đã từ chối', value: 'rejected' },
                        ]}
                    />
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8}>
                    <Card>
                        <Statistic title="Tổng báo cáo" value={reports.length} />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Card>
                        <Statistic title="Chờ xử lý" value={reports.filter((item) => item.status === 'pending').length} />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Card>
                        <Statistic title="Đã xử lý" value={reports.filter((item) => item.status === 'resolved').length} />
                    </Card>
                </Col>
            </Row>

            <Card>
                <Table
                    columns={columns}
                    dataSource={reports}
                    pagination={{ pageSize: 10 }}
                    loading={loading}
                    rowKey="_id"
                    scroll={{ x: 1500 }}
                />
            </Card>

            <Modal
                title="Xử lý báo cáo"
                open={processModalOpen}
                onCancel={closeProcessModal}
                width={760}
                footer={[
                    <Button key="close" onClick={closeProcessModal}>
                        Đóng
                    </Button>,
                    <Button key="reject" danger onClick={() => selectedReport && handleRejectReport(selectedReport)}>
                        Từ chối báo cáo
                    </Button>,
                    <Button key="resolve" type="primary" icon={<CheckCircleOutlined />} onClick={handleResolveReport}>
                        Xác nhận xử lý
                    </Button>,
                ]}
            >
                {selectedReport && (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="Bài viết">
                                <Space direction="vertical" size={4}>
                                    <span>{selectedReport.post?.title || 'Không xác định'}</span>
                                    {selectedReport.post?.status ? (
                                        <Tag color={postStatusMap[selectedReport.post.status]?.color || 'default'}>
                                            {postStatusMap[selectedReport.post.status]?.text || selectedReport.post.status}
                                        </Tag>
                                    ) : null}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Người báo cáo">
                                {selectedReport.reporter?.fullName || selectedReport.reporterName}
                            </Descriptions.Item>
                            <Descriptions.Item label="Email">
                                {selectedReport.reporter?.email || selectedReport.reporterEmail}
                            </Descriptions.Item>
                            <Descriptions.Item label="Lý do">{selectedReport.reason}</Descriptions.Item>
                            <Descriptions.Item label="Chi tiết">{selectedReport.details || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Ghi chú đã lưu">{selectedReport.note || '-'}</Descriptions.Item>
                        </Descriptions>

                        <div>
                            <label className={cx('field-label')}>Hành động với bài viết</label>
                            <Select
                                value={processAction}
                                onChange={setProcessAction}
                                style={{ width: '100%' }}
                                options={[
                                    { value: 'none', label: 'Chỉ đánh dấu báo cáo đã xử lý' },
                                    { value: 'hide_post', label: 'Ẩn bài viết khỏi trang công khai' },
                                    { value: 'takedown_post', label: 'Gỡ bài viết xuống do vi phạm' },
                                ]}
                            />
                        </div>

                        <div>
                            <label className={cx('field-label')}>Ghi chú xử lý</label>
                            <Input.TextArea
                                value={processNote}
                                onChange={(event) => setProcessNote(event.target.value)}
                                rows={4}
                                placeholder="Nhập ghi chú nội bộ, lý do ẩn/gỡ bài hoặc hướng xử lý..."
                            />
                        </div>
                    </Space>
                )}
            </Modal>
        </div>
    );
}

export default ManagerReports;
