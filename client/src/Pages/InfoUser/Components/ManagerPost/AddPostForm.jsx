import React, { useState, useEffect, useMemo } from 'react';
import {
    Form,
    Input,
    InputNumber,
    Select,
    Upload,
    Button,
    message,
    Row,
    Col,
    Checkbox,
    Divider,
    Typography,
    AutoComplete,
    Table,
    Statistic,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

import { Editor } from '@tinymce/tinymce-react';
import { requestCreatePost, requestGetPostingPlans, requestUploadImages, requestValidateVoucher } from '../../../../config/request';

const { Option } = Select;
const { Title } = Typography;

import axios from 'axios';
import useDebounce from '../../../../hooks/useDebounce';

// Helper function for Upload component
const normFile = (e) => {
    if (Array.isArray(e)) {
        return e;
    }
    return e && e.fileList;
};

// Checkbox options list (from ManagerPost.jsx for consistency, or define here)
const optionLabels = [
    'Đầy đủ nội thất',
    'Có gác',
    'Có kệ bếp',
    'Có máy lạnh',
    'Có máy giặt',
    'Có tủ lạnh',
    'Có thang máy',
    'Không chung chủ',
    'Giờ giấc tự do',
    'Có bảo vệ 24/24',
    'Có hầm để xe',
];

const defaultMapCenter = { lat: 10.0452, lng: 105.7469 };
const defaultMarkerIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

function MapCenterSync({ center }) {
    const map = useMap();

    useEffect(() => {
        if (center?.lat && center?.lng) {
            map.setView([center.lat, center.lng], Math.max(map.getZoom(), 15));
        }
    }, [center, map]);

    return null;
}

function LocationClickHandler({ onPick }) {
    useMapEvents({
        click(event) {
            onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
        },
    });

    return null;
}

function LocationPickerMap({ coordinates, onPick }) {
    const center = coordinates?.lat && coordinates?.lng ? coordinates : defaultMapCenter;

    return (
        <div style={{ height: 420, borderRadius: 8, overflow: 'hidden', border: '1px solid #d9d9d9' }}>
            <MapContainer center={[center.lat, center.lng]} zoom={15} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapCenterSync center={center} />
                <LocationClickHandler onPick={onPick} />
                {coordinates?.lat && coordinates?.lng && (
                    <Marker
                        position={[coordinates.lat, coordinates.lng]}
                        icon={defaultMarkerIcon}
                        draggable
                        eventHandlers={{
                            dragend: (event) => {
                                const nextPosition = event.target.getLatLng();
                                onPick({ lat: nextPosition.lat, lng: nextPosition.lng });
                            },
                        }}
                    />
                )}
            </MapContainer>
        </div>
    );
}

// Example suggestions for AutoComplete

function AddPostForm({ onFinish, onCancel, initialValues }) {
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [description, setDescription] = useState(initialValues?.description || '');
    const [valueSearch, setValueSearch] = useState('');
    const [dataSearch, setDataSearch] = useState([]);
    const [selectedCoordinates, setSelectedCoordinates] = useState(initialValues?.coordinates || null);
    const [locating, setLocating] = useState(false);
    const debouncedSearch = useDebounce(valueSearch, 500);
    // State for calculated cost
    const [estimatedCost, setEstimatedCost] = useState(0);
    const [postingPlans, setPostingPlans] = useState([]);
    const [voucherPreview, setVoucherPreview] = useState(null);

    // Get form values to watch for changes
    const selectedDuration = Form.useWatch('duration', form);
    const selectedTypeNews = Form.useWatch('typeNews', form);
    const voucherCode = Form.useWatch('voucherCode', form);

    const compressImageFile = (file) =>
        new Promise((resolve) => {
            if (!file?.type?.startsWith('image/') || file.size < 1024 * 1024) {
                resolve(file);
                return;
            }

            const image = new Image();
            const objectUrl = URL.createObjectURL(file);
            image.onload = () => {
                URL.revokeObjectURL(objectUrl);
                const maxSide = 1600;
                const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(image.width * scale);
                canvas.height = Math.round(image.height * scale);
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(file);
                            return;
                        }
                        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
                    },
                    'image/jpeg',
                    0.82,
                );
            };
            image.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(file);
            };
            image.src = objectUrl;
        });

    const geocodeAddress = async (address) => {
        if (!address?.trim()) return null;
        try {
            const res = await axios.get('https://rsapi.goong.io/Geocode', {
                params: {
                    address,
                    api_key: import.meta.env.VITE_API_KEY,
                },
            });
            const location = res.data?.results?.[0]?.geometry?.location;
            if (location?.lat && location?.lng) {
                return { lat: Number(location.lat), lng: Number(location.lng) };
            }
        } catch {
            return null;
        }

        return null;
    };

    const resolveCoordinatesByAddress = async (address) => {
        if (selectedCoordinates?.lat && selectedCoordinates?.lng) return selectedCoordinates;
        const coordinates = await geocodeAddress(address);
        if (coordinates?.lat && coordinates?.lng) {
            setSelectedCoordinates(coordinates);
            return coordinates;
        }
        return null;
    };

    const reverseGeocodeCoordinates = async ({ lat, lng }) => {
        try {
            const res = await axios.get('https://rsapi.goong.io/Geocode', {
                params: {
                    latlng: `${lat},${lng}`,
                    api_key: import.meta.env.VITE_API_KEY,
                },
            });
            return res.data?.results?.[0]?.formatted_address || '';
        } catch {
            return '';
        }
    };

    const handlePickMapLocation = async (coordinates) => {
        const nextCoordinates = {
            lat: Number(coordinates.lat.toFixed(7)),
            lng: Number(coordinates.lng.toFixed(7)),
        };
        setSelectedCoordinates(nextCoordinates);

        const currentAddress = form.getFieldValue('location');

        const address = await reverseGeocodeCoordinates(nextCoordinates);
        if (address) {
            form.setFieldsValue({ location: address });
            message.success('Đã ghim vị trí và cập nhật địa chỉ');
        } else if (currentAddress?.trim()) {
            message.info('Đã ghim vị trí. Địa chỉ đã nhập sẽ được giữ nguyên.');
        } else {
            message.warning('Đã ghim vị trí. Vui lòng nhập địa chỉ hiển thị cho bài đăng.');
        }
    };

    const typeNewsOptions = useMemo(() => {
        const uniqueTypes = [...new Set(postingPlans.map((plan) => plan.typeNews))];
        return uniqueTypes.map((value) => ({
            value,
            label: postingPlans.find((plan) => plan.typeNews === value)?.name || (value === 'vip' ? 'Tin VIP' : 'Tin thường'),
        }));
    }, [postingPlans]);

    const activeDurationOptions = useMemo(
        () =>
            postingPlans
                .filter((plan) => plan.typeNews === selectedTypeNews)
                .map((plan) => ({ label: `${plan.durationDays} ngày`, value: plan.durationDays }))
                .sort((a, b) => a.value - b.value),
        [postingPlans, selectedTypeNews],
    );

    const pricingDurations = useMemo(
        () => [...new Set(postingPlans.map((plan) => plan.durationDays))].sort((a, b) => a - b),
        [postingPlans],
    );

    const pricingRows = useMemo(() => {
        const grouped = postingPlans.reduce((acc, plan) => {
            if (!acc[plan.typeNews]) {
                acc[plan.typeNews] = {
                    key: plan.typeNews,
                    typeNews: plan.name || (plan.typeNews === 'vip' ? 'Tin VIP' : 'Tin thường'),
                };
            }
            acc[plan.typeNews][`${plan.durationDays} ngày`] = plan.price;
            return acc;
        }, {});
        return Object.values(grouped);
    }, [postingPlans]);

    const pricingColumns = useMemo(
        () => [
            {
                title: 'Loại tin',
                dataIndex: 'typeNews',
                key: 'typeNews',
            },
            ...pricingDurations.map((duration) => ({
                title: `${duration} ngày`,
                dataIndex: `${duration} ngày`,
                key: `${duration} ngày`,
                render: (price) => (typeof price === 'number' ? `${price.toLocaleString('vi-VN')} VNĐ` : '-'),
            })),
        ],
        [pricingDurations],
    );

    // Effect to recalculate cost based on duration and typeNews
    useEffect(() => {
        const selectedPlan = postingPlans.find(
            (plan) => plan.typeNews === selectedTypeNews && plan.durationDays === selectedDuration,
        );
        const calculatedCost = selectedPlan?.price || 0;
        setEstimatedCost(calculatedCost);
        setVoucherPreview(null);
    }, [postingPlans, selectedDuration, selectedTypeNews]);

    useEffect(() => {
        const fetchPostingPlans = async () => {
            try {
                const res = await requestGetPostingPlans();
                setPostingPlans(res.metadata || []);
            } catch (error) {
                message.error(error.response?.data?.message || 'Không thể lấy bảng giá đăng tin');
            }
        };

        fetchPostingPlans();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (debouncedSearch) {
                const res = await axios.get(`https://rsapi.goong.io/Place/AutoComplete`, {
                    params: {
                        input: debouncedSearch,
                        api_key: import.meta.env.VITE_API_KEY,
                    },
                });
                setDataSearch(res.data.predictions);
            }
        };
        fetchData();
    }, [debouncedSearch]);

    useEffect(() => {
        if (initialValues) {
            const initialData = {
                ...initialValues,
                location: initialValues.location || initialValues.address,
                options: Array.isArray(initialValues.options) ? initialValues.options : [],
            };
            form.setFieldsValue(initialData);
            if (initialValues.description) {
                setDescription(initialValues.description);
            }
            setSelectedCoordinates(initialValues.coordinates || null);

            if (initialValues.images && Array.isArray(initialValues.images)) {
                setFileList(
                    initialValues.images.map((img, index) => {
                        if (img && typeof img === 'object' && img.uid) {
                            return img;
                        }
                        const name =
                            typeof img === 'string'
                                ? img.substring(img.lastIndexOf('/') + 1)
                                : `image-${index + 1}.png`;
                        return {
                            uid: `-${index + 1}`,
                            name: name,
                            status: 'done',
                            url: typeof img === 'string' ? img : undefined,
                            thumbUrl: typeof img === 'string' ? img : undefined,
                        };
                    }),
                );
            } else {
                setFileList([]);
            }
        } else {
            form.resetFields();
            setFileList([]);
            setDescription('');
            setEstimatedCost(0);
            setSelectedCoordinates(null);
        }
    }, [initialValues, form]);

    const handleFinish = async (values) => {
        if (submitting) return;

        try {
            setSubmitting(true);
            const newImageFiles = fileList.map((file) => file.originFileObj).filter(Boolean);
            if (!initialValues && newImageFiles.length === 0) {
                message.warning('Vui lòng tải lên ít nhất 1 hình ảnh');
                return;
            }

            if (!values.location?.trim()) {
                message.error('Vui lòng nhập địa chỉ hiển thị cho bài đăng.');
                return;
            }

            const resolvedCoordinates = await resolveCoordinatesByAddress(values.location);
            if (!resolvedCoordinates) {
                message.error('Chưa có tọa độ cho bài đăng. Vui lòng bấm "Định vị theo địa chỉ" hoặc click chọn vị trí trên bản đồ rồi đăng lại.');
                return;
            }

            const compressedFiles = await Promise.all(newImageFiles.map((file) => compressImageFile(file)));
            // Calculate endDate based on selected duration
            const today = dayjs();
            const endDate = values.duration ? today.add(values.duration, 'day').utc().toISOString() : null;
            const resImages = compressedFiles.length > 0 ? await uploadImagesWithRetry(compressedFiles) : { images: [] };

            const data = {
                title: values.title,
                price: values.price,
                description: description,
                category: values.category,
                area: values.area,
                phone: values.phone,
                username: values.username,
                options: values.options,
                location: values.location,
                coordinates: resolvedCoordinates,
                typeNews: values.typeNews,
                endDate: endDate,
                images: [...fileList.filter((file) => !file.originFileObj).map((file) => file.url).filter(Boolean), ...resImages.images],
                dateEnd: values.duration,
                voucherCode: values.voucherCode,
            };

            await requestCreatePost(data);
            message.success(
                initialValues
                    ? 'Cập nhật bài viết thành công'
                    : 'Tạo bài viết thành công. Bài sẽ hiển thị trên bản đồ sau khi admin duyệt.',
            );
            form.resetFields();
            setFileList([]);
            setDescription('');
            setEstimatedCost(0);
            setSelectedCoordinates(null);
            setVoucherPreview(null);
            onFinish(data);
        } catch (error) {
            message.error(error.response?.data?.message || error.message || 'Có lỗi xảy ra khi tạo/cập nhật bài viết.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setFileList([]);
        setDescription('');
        setEstimatedCost(0);
        setSelectedCoordinates(null);
        setVoucherPreview(null);
        onCancel();
    };

    const handleUploadChange = ({ fileList: newFileList }) => {
        setFileList(newFileList.slice(0, 8));
    };

    const beforeImageUpload = (file) => {
        if (!file.type?.startsWith('image/')) {
            message.error('Chỉ hỗ trợ tải lên file hình ảnh');
            return Upload.LIST_IGNORE;
        }

        if (file.size / 1024 / 1024 > 8) {
            message.error('Mỗi ảnh phải nhỏ hơn 8MB');
            return Upload.LIST_IGNORE;
        }

        return false;
    };

    // Handler for AutoComplete search input change
    const handleLocationSearch = (searchText) => {
        setValueSearch(searchText);
    };

    const handleLocationChange = (value) => {
        setValueSearch(value);
        setSelectedCoordinates(null);
    };

    // Handler for selecting an item from AutoComplete
    const handleLocationSelect = async (selectedValue, option) => {
        form.setFieldsValue({ location: selectedValue });
        setSelectedCoordinates(null);

        if (!option?.placeId) return;

        try {
            const res = await axios.get('https://rsapi.goong.io/Place/Detail', {
                params: {
                    place_id: option.placeId,
                    api_key: import.meta.env.VITE_API_KEY,
                },
            });
            const location = res.data?.result?.geometry?.location;
            if (location?.lat && location?.lng) {
                setSelectedCoordinates({ lat: Number(location.lat), lng: Number(location.lng) });
            }
        } catch {
            message.warning('Không thể lấy tọa độ địa chỉ, bài đăng sẽ không hiển thị trên bản đồ');
        }
    };

    const uploadImagesWithRetry = async (files) => {
        const formData = new FormData();
        files.forEach((file) => {
            formData.append('images', file);
        });

        try {
            return await requestUploadImages(formData);
        } catch (firstError) {
            await new Promise((resolve) => setTimeout(resolve, 800));
            try {
                return await requestUploadImages(formData);
            } catch (secondError) {
                throw secondError || firstError;
            }
        }
    };

    const handleLocateTypedAddress = async () => {
        const address = form.getFieldValue('location');
        if (!address?.trim()) {
            message.warning('Vui lòng nhập địa chỉ trước khi định vị');
            return;
        }

        try {
            setLocating(true);
            const coordinates = await geocodeAddress(address);
            if (coordinates?.lat && coordinates?.lng) {
                setSelectedCoordinates(coordinates);
                message.success('Đã định vị địa chỉ trên bản đồ');
            } else {
                message.warning('Không tìm thấy tọa độ cho địa chỉ này');
            }
        } finally {
            setLocating(false);
        }
    };

    const handleApplyVoucher = async () => {
        if (!voucherCode?.trim()) {
            message.warning('Vui lòng nhập mã voucher');
            return;
        }
        if (!selectedTypeNews || !selectedDuration || estimatedCost <= 0) {
            message.warning('Vui lòng chọn loại tin và thời gian đăng trước');
            return;
        }

        try {
            const res = await requestValidateVoucher({
                code: voucherCode,
                typeNews: selectedTypeNews,
                orderValue: estimatedCost,
            });
            setVoucherPreview(res.metadata);
            message.success(`Áp dụng voucher thành công, giảm ${Number(res.metadata.discountAmount || 0).toLocaleString('vi-VN')} VNĐ`);
        } catch (error) {
            setVoucherPreview(null);
            message.error(error.response?.data?.message || 'Voucher không hợp lệ');
        }
    };

    const finalCost = voucherPreview ? voucherPreview.finalAmount : estimatedCost;

    return (
        <Form form={form} layout="vertical" onFinish={handleFinish}>
            <Title level={5}>Thông tin cơ bản</Title>
            <Row gutter={24}>
                <Col span={12}>
                    <Form.Item
                        name="title"
                        label="Tiêu đề"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                    >
                        <Input placeholder="Ví dụ: Phòng trọ giá rẻ gần DH Bách Khoa" />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item
                        name="price"
                        label="Giá (VNĐ/tháng)"
                        rules={[{ required: true, message: 'Vui lòng nhập giá' }]}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                            placeholder="Ví dụ: 2,500,000"
                        />
                    </Form.Item>
                </Col>
            </Row>

            <div style={{ width: '100%' }}>
                <Editor
                    apiKey="hfm046cu8943idr5fja0r5l2vzk9l8vkj5cp3hx2ka26l84x"
                    init={{
                        plugins:
                            'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount',
                        toolbar:
                            'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table | align lineheight | numlist bullist indent outdent | emoticons charmap | removeformat',
                    }}
                    initialValue="Mô tả phòng trọ"
                    // eslint-disable-next-line no-unused-vars
                    onEditorChange={(content, editor) => setDescription(content)}
                />
            </div>

            <Divider />

            <Title level={5}>Thông tin chi tiết</Title>
            <Row gutter={24}>
                <Col span={12}>
                    <Form.Item
                        name="category"
                        label="Loại hình"
                        rules={[{ required: true, message: 'Vui lòng chọn loại hình' }]}
                    >
                        <Select placeholder="Chọn loại hình">
                            <Option value="phong-tro">Phòng trọ</Option>
                            <Option value="nha-nguyen-can">Nhà nguyên căn</Option>
                            <Option value="can-ho-chung-cu">Căn hộ chung cư</Option>
                            <Option value="can-ho-mini">Căn hộ mini</Option>
                        </Select>
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item
                        name="area"
                        label="Diện tích (m²)"
                        rules={[{ required: true, message: 'Vui lòng nhập diện tích' }]}
                    >
                        <InputNumber style={{ width: '100%' }} min={1} placeholder="Ví dụ: 25" />
                    </Form.Item>
                </Col>
            </Row>

            <Divider />

            <Title level={5}>Thông tin liên hệ</Title>
            <Row gutter={24}>
                <Col span={12}>
                    <Form.Item
                        name="username"
                        label="Tên người đăng"
                        rules={[{ required: true, message: 'Vui lòng nhập tên người đăng' }]}
                    >
                        <Input placeholder="Tên người cho thuê" />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item
                        name="phone"
                        label="Số điện thoại liên hệ"
                        rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
                    >
                        <Input placeholder="Số điện thoại người đăng" />
                    </Form.Item>
                </Col>
            </Row>

            <Form.Item
                name="location"
                label="Địa chỉ"
                rules={[{ required: true, message: 'Vui lòng nhập hoặc chọn địa chỉ' }]}
            >
                <AutoComplete
                    options={dataSearch?.map((item) => ({ value: item.description, placeId: item.place_id }))}
                    onSearch={handleLocationSearch}
                    onChange={handleLocationChange}
                    onSelect={handleLocationSelect}
                    placeholder="Nhập địa chỉ hoặc chọn từ gợi ý..."
                >
                    <Input />
                </AutoComplete>
            </Form.Item>

            <div>
                <Row align="middle" justify="space-between" style={{ marginBottom: 12, gap: 12 }}>
                    <Col>
                        <h4 style={{ margin: 0 }}>Vị trí & bản đồ</h4>
                        <Typography.Text type="secondary">
                            Click vào bản đồ hoặc kéo marker để ghim vị trí chính xác. Hệ thống sẽ tự cập nhật địa chỉ nếu tìm được.
                        </Typography.Text>
                    </Col>
                    <Col>
                        <Button onClick={handleLocateTypedAddress} loading={locating} disabled={submitting}>
                            Định vị theo địa chỉ
                        </Button>
                    </Col>
                </Row>
                <LocationPickerMap coordinates={selectedCoordinates} onPick={handlePickMapLocation} />
                {selectedCoordinates?.lat && selectedCoordinates?.lng && (
                    <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        Tọa độ đã ghim: {selectedCoordinates.lat}, {selectedCoordinates.lng}
                    </Typography.Text>
                )}
            </div>

            <Divider />

            <Title level={5}>Hình ảnh</Title>
            <Form.Item name="images" valuePropName="fileList" getValueFromEvent={normFile}>
                <Upload
                    listType="picture-card"
                    multiple
                    beforeUpload={beforeImageUpload}
                    fileList={fileList}
                    onChange={handleUploadChange}
                    accept="image/*"
                    disabled={submitting}
                >
                    {fileList.length >= 8 ? null : (
                        <div>
                            <UploadOutlined />
                            <div style={{ marginTop: 8 }}>Tải ảnh lên</div>
                        </div>
                    )}
                </Upload>
            </Form.Item>

            <Divider />

            <Title level={5}>Tiện nghi & Tùy chọn</Title>
            <Form.Item name="options">
                <Checkbox.Group style={{ width: '100%' }}>
                    <Row gutter={[16, 16]}>
                        {optionLabels.map((label) => (
                            <Col xs={24} sm={12} md={8} key={label}>
                                <Checkbox value={label}>{label}</Checkbox>
                            </Col>
                        ))}
                    </Row>
                </Checkbox.Group>
            </Form.Item>

            <Divider />

            <Row gutter={24} align="bottom">
                <Col xs={24} md={8}>
                    <Form.Item
                        name="typeNews"
                        label="Loại tin"
                        rules={[{ required: true, message: 'Vui lòng chọn loại tin' }]}
                    >
                        <Select placeholder="Chọn loại tin" onChange={() => form.setFieldValue('duration', undefined)}>
                            {typeNewsOptions.map((opt) => (
                                <Option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    <Form.Item
                        name="duration"
                        label="Thời gian đăng"
                        rules={[{ required: true, message: 'Vui lòng chọn thời gian đăng' }]}
                    >
                        <Select placeholder="Chọn số ngày">
                            {activeDurationOptions.map((opt) => (
                                <Option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} md={8} style={{ paddingBottom: '24px' }}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Statistic
                                title="Tạm tính (VNĐ)"
                                value={estimatedCost > 0 ? estimatedCost : '-'}
                                precision={0}
                                formatter={(value) =>
                                    typeof value === 'number' ? value.toLocaleString('vi-VN') : value
                                }
                            />
                        </Col>
                        <Col span={12}>
                            <Statistic
                                title="Thanh toán (VNĐ)"
                                value={finalCost > 0 ? finalCost : '-'}
                                precision={0}
                                formatter={(value) =>
                                    typeof value === 'number' ? value.toLocaleString('vi-VN') : value
                                }
                            />
                        </Col>
                    </Row>
                </Col>
            </Row>

            <Row gutter={12} align="bottom">
                <Col xs={24} md={12}>
                    <Form.Item name="voucherCode" label="Voucher giảm phí đăng tin">
                        <Input placeholder="Nhập mã voucher nếu có" onChange={() => setVoucherPreview(null)} />
                    </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                    <Form.Item>
                        <Button block onClick={handleApplyVoucher}>
                            Áp dụng
                        </Button>
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    {voucherPreview && (
                        <div style={{ paddingBottom: 24, color: '#0f766e', fontWeight: 700 }}>
                            Đã giảm {Number(voucherPreview.discountAmount || 0).toLocaleString('vi-VN')} VNĐ
                        </div>
                    )}
                </Col>
            </Row>

            <div style={{ marginBottom: 24 }}>
                <h4 style={{ marginBottom: 16 }}>Bảng giá dịch vụ</h4>
                <Table dataSource={pricingRows} columns={pricingColumns} pagination={false} size="small" bordered />
            </div>

            <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
                <Button onClick={handleCancel} style={{ marginRight: 8 }} disabled={submitting}>
                    Hủy
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting} disabled={submitting}>
                    {initialValues ? 'Cập nhật bài viết' : 'Thêm bài viết'}
                </Button>
            </Form.Item>
        </Form>
    );
}

export default AddPostForm;


