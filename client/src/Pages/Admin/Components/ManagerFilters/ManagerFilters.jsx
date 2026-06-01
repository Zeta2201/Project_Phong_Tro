import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, message, Modal, Select, Space, Switch, Table, Tag } from 'antd';
import { EditOutlined, FilterOutlined, PlusOutlined } from '@ant-design/icons';
import {
    requestCreateFilterOption,
    requestGetAdminFilterOptions,
    requestToggleFilterOption,
    requestUpdateFilterOption,
} from '../../../../config/request';

const fieldConfig = {
    category: { label: 'Loại hình', numeric: false },
    priceRange: { label: 'Mức giá', numeric: true },
    areaRange: { label: 'Diện tích', numeric: true },
    typeNews: { label: 'Loại tin', numeric: false },
};

const fieldOptions = Object.entries(fieldConfig).map(([value, config]) => ({ value, label: config.label }));
const formatNumber = (value) => (value === null || value === undefined ? '-' : Number(value).toLocaleString('vi-VN'));

function ManagerFilters() {
    const [form] = Form.useForm();
    const [filters, setFilters] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState(null);
    const [fieldFilter, setFieldFilter] = useState('');
    const selectedField = Form.useWatch('field', form);

    const fetchFilters = useCallback(async () => {
        setLoading(true);
        try {
            const res = await requestGetAdminFilterOptions({ field: fieldFilter || undefined });
            setFilters(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Lấy cấu hình bộ lọc thất bại');
        } finally {
            setLoading(false);
        }
    }, [fieldFilter]);

    useEffect(() => {
        fetchFilters();
    }, [fetchFilters]);

    const openCreateModal = () => {
        setSelectedFilter(null);
        form.setFieldsValue({
            field: 'priceRange',
            value: '',
            label: '',
            description: '',
            minValue: null,
            maxValue: null,
            sortOrder: 0,
            isActive: true,
        });
        setModalOpen(true);
    };

    const openEditModal = (filter) => {
        setSelectedFilter(filter);
        form.setFieldsValue(filter);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedFilter(null);
        form.resetFields();
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (selectedFilter) {
                await requestUpdateFilterOption({ id: selectedFilter._id, ...values });
                message.success('Đã cập nhật bộ lọc');
            } else {
                await requestCreateFilterOption(values);
                message.success('Đã tạo bộ lọc');
            }
            closeModal();
            fetchFilters();
        } catch (error) {
            if (error.errorFields) return;
            message.error(error.response?.data?.message || 'Lưu bộ lọc thất bại');
        }
    };

    const handleToggle = async (filter, isActive) => {
        try {
            await requestToggleFilterOption({ id: filter._id, isActive });
            message.success(isActive ? 'Đã bật bộ lọc' : 'Đã tắt bộ lọc');
            fetchFilters();
        } catch (error) {
            message.error(error.response?.data?.message || 'Cập nhật trạng thái thất bại');
        }
    };

    const columns = [
        {
            title: 'Nhóm lọc',
            dataIndex: 'field',
            key: 'field',
            render: (field) => fieldConfig[field]?.label || field,
        },
        { title: 'Giá trị', dataIndex: 'value', key: 'value' },
        { title: 'Nhãn hiển thị', dataIndex: 'label', key: 'label' },
        {
            title: 'Khoảng áp dụng',
            key: 'range',
            render: (_, filter) =>
                fieldConfig[filter.field]?.numeric ? `${formatNumber(filter.minValue)} → ${formatNumber(filter.maxValue)}` : '-',
        },
        { title: 'Thứ tự', dataIndex: 'sortOrder', key: 'sortOrder' },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive) => <Tag color={isActive ? 'green' : 'default'}>{isActive ? 'Đang bật' : 'Đã tắt'}</Tag>,
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_, filter) => (
                <Space>
                    <Button icon={<EditOutlined />} onClick={() => openEditModal(filter)}>
                        Sửa
                    </Button>
                    <Switch checked={filter.isActive} onChange={(checked) => handleToggle(filter, checked)} />
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Card style={{ marginBottom: 16 }}>
                <Space wrap>
                    <FilterOutlined />
                    <Select
                        value={fieldFilter}
                        onChange={setFieldFilter}
                        style={{ width: 190 }}
                        options={[{ value: '', label: 'Tất cả nhóm lọc' }, ...fieldOptions]}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                        Thêm bộ lọc
                    </Button>
                </Space>
            </Card>

            <Card>
                <Table
                    rowKey="_id"
                    columns={columns}
                    dataSource={filters}
                    loading={loading}
                    pagination={{ pageSize: 12 }}
                    scroll={{ x: 1000 }}
                />
            </Card>

            <Modal
                title={selectedFilter ? 'Cập nhật bộ lọc' : 'Thêm bộ lọc'}
                open={modalOpen}
                onCancel={closeModal}
                onOk={handleSubmit}
                okText="Lưu"
                cancelText="Đóng"
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="field" label="Nhóm lọc" rules={[{ required: true, message: 'Chọn nhóm lọc' }]}>
                        <Select options={fieldOptions} />
                    </Form.Item>
                    <Form.Item
                        name="value"
                        label="Giá trị gửi lên API"
                        rules={[{ required: true, message: 'Nhập giá trị bộ lọc' }]}
                        extra="Dùng chữ thường, số và dấu gạch ngang. Loại hình và loại tin phải khớp enum bài đăng."
                    >
                        <Input placeholder="Ví dụ: tu-2-3-trieu" />
                    </Form.Item>
                    <Form.Item name="label" label="Nhãn hiển thị" rules={[{ required: true, message: 'Nhập nhãn hiển thị' }]}>
                        <Input placeholder="Ví dụ: 2 - 3 triệu" maxLength={120} />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={2} maxLength={300} />
                    </Form.Item>
                    {fieldConfig[selectedField]?.numeric && (
                        <Space size={16} style={{ display: 'flex' }}>
                            <Form.Item name="minValue" label="Cận dưới" style={{ flex: 1 }}>
                                <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                            <Form.Item name="maxValue" label="Cận trên" style={{ flex: 1 }}>
                                <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                        </Space>
                    )}
                    <Form.Item name="sortOrder" label="Thứ tự hiển thị">
                        <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="isActive" label="Hiển thị cho người dùng" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default ManagerFilters;
