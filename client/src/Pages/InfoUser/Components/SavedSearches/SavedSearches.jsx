import { useEffect, useState } from 'react';
import { Button, Card, message, Space, Switch, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { requestDeleteSavedSearch, requestGetSavedSearches, requestUpdateSavedSearch } from '../../../../config/request';

const criteriaLabels = {
    category: 'Loại phòng',
    priceRange: 'Giá',
    areaRange: 'Diện tích',
    typeNews: 'Loại tin',
    province: 'Khu vực',
    keyword: 'Từ khóa',
};

function SavedSearches() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchSavedSearches = async () => {
        setLoading(true);
        try {
            const res = await requestGetSavedSearches();
            setItems(res.metadata || []);
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể lấy tìm kiếm đã lưu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSavedSearches();
    }, []);

    const updateSavedSearch = async (record, data) => {
        try {
            await requestUpdateSavedSearch(record._id, data);
            message.success('Đã cập nhật tìm kiếm đã lưu');
            fetchSavedSearches();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể cập nhật');
        }
    };

    const deleteSavedSearch = async (record) => {
        try {
            await requestDeleteSavedSearch(record._id);
            message.success('Đã xóa tìm kiếm đã lưu');
            fetchSavedSearches();
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể xóa');
        }
    };

    const columns = [
        {
            title: 'Tên tìm kiếm',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Tiêu chí',
            dataIndex: 'criteria',
            key: 'criteria',
            render: (criteria = {}) => (
                <Space wrap>
                    {Object.entries(criteria)
                        .filter(([, value]) => value)
                        .map(([key, value]) => (
                            <Tag key={key}>
                                {criteriaLabels[key] || key}: {value}
                            </Tag>
                        ))}
                </Space>
            ),
        },
        {
            title: 'Đang theo dõi',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (value, record) => <Switch checked={value} onChange={(checked) => updateSavedSearch(record, { isActive: checked })} />,
        },
        {
            title: 'Email',
            dataIndex: 'notifyEmail',
            key: 'notifyEmail',
            render: (value, record) => <Switch checked={value} onChange={(checked) => updateSavedSearch(record, { notifyEmail: checked })} />,
        },
        {
            title: 'Ngày lưu',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm'),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            render: (_, record) => (
                <Button danger onClick={() => deleteSavedSearch(record)}>
                    Xóa
                </Button>
            ),
        },
    ];

    return (
        <Card>
            <Table columns={columns} dataSource={items} rowKey="_id" loading={loading} pagination={{ pageSize: 8 }} scroll={{ x: 900 }} />
        </Card>
    );
}

export default SavedSearches;
