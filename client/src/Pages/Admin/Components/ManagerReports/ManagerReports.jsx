import { useEffect, useState } from 'react';
import { Table, Card, Row, Col, Statistic, Button, Space, Select, Input, Tag, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, FileSearchOutlined } from '@ant-design/icons';
import classNames from 'classnames/bind';
import styles from './ManagerReports.module.scss';
import { requestGetReports, requestUpdateReportStatus } from '../../../../config/request';

const cx = classNames.bind(styles);

function ManagerReports() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await requestGetReports({
                status: statusFilter || undefined,
                q: searchQuery || undefined,
            });
            setReports(res.metadata);
        } catch (error) {
            console.error(error);
            message.error('Lấy danh sách báo cáo thất bại');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [statusFilter, searchQuery]);

    const handleUpdateStatus = async (report, status) => {
        try {
            await requestUpdateReportStatus({ id: report._id, status });
            message.success('Cập nhật báo cáo thành công');
            fetchReports();
        } catch (error) {
            console.error(error);
            message.error('Cập nhật báo cáo thất bại');
        }
    };

    const statusColor = {
        pending: 'orange',
        resolved: 'green',
        rejected: 'red',
    };

    const columns = [
        {
            title: 'Bài viết',
            dataIndex: ['post', 'title'],
            key: 'postTitle',
            render: (title) => title || 'Không xác định',
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
            render: (details) => details || '-'
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status) => <Tag color={statusColor[status]}>{status === 'pending' ? 'Chờ xử lý' : status === 'resolved' ? 'Đã xử lý' : 'Đã từ chối'}</Tag>,
        },
        {
            title: 'Ngày báo cáo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => new Date(date).toLocaleString('vi-VN'),
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_, record) => (
                <Space wrap>
                    <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        disabled={record.status === 'resolved'}
                        onClick={() => handleUpdateStatus(record, 'resolved')}
                    >
                        Xử lý
                    </Button>
                    <Button
                        danger
                        icon={<CloseCircleOutlined />}
                        disabled={record.status === 'rejected'}
                        onClick={() => handleUpdateStatus(record, 'rejected')}
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
                        <Statistic
                            title="Chờ xử lý"
                            value={reports.filter((item) => item.status === 'pending').length}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Card>
                        <Statistic
                            title="Đã xử lý"
                            value={reports.filter((item) => item.status === 'resolved').length}
                        />
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
                    scroll={{ x: 1400 }}
                />
            </Card>
        </div>
    );
}

export default ManagerReports;
