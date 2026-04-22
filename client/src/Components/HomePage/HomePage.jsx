import classNames from 'classnames/bind';
import styles from './HomePage.module.scss';
import {
    AimOutlined,
    ApartmentOutlined,
    BorderOutlined,
    ClockCircleOutlined,
    CompassOutlined,
    FireOutlined,
    ReloadOutlined,
    TagOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';

import CardBody from '../CardBody/CardBody';
import { requestGetNewPost, requestGetPosts, requestPostSuggest } from '../../config/request';

const cx = classNames.bind(styles);

const categoryOptions = [
    { value: 'phong-tro', label: 'Phòng trọ' },
    { value: 'nha-nguyen-can', label: 'Nhà nguyên căn' },
    { value: 'can-ho-chung-cu', label: 'Căn hộ chung cư' },
    { value: 'can-ho-mini', label: 'Căn hộ mini' },
];

const priceOptions = [
    { value: 'duoi-1-trieu', label: 'Dưới 1 triệu' },
    { value: 'tu-1-2-trieu', label: 'Từ 1 - 2 triệu' },
    { value: 'tu-2-3-trieu', label: 'Từ 2 - 3 triệu' },
    { value: 'tu-3-5-trieu', label: 'Từ 3 - 5 triệu' },
    { value: 'tu-5-7-trieu', label: 'Từ 5 - 7 triệu' },
    { value: 'tu-7-10-trieu', label: 'Từ 7 - 10 triệu' },
    { value: 'tu-10-15-trieu', label: 'Từ 10 - 15 triệu' },
    { value: 'tren-15-trieu', label: 'Trên 15 triệu' },
];

const areaOptions = [
    { value: 'duoi-20', label: 'Dưới 20 m2' },
    { value: 'tu-20-30', label: 'Từ 20 - 30 m2' },
    { value: 'tu-30-50', label: 'Từ 30 - 50 m2' },
    { value: 'tu-50-70', label: 'Từ 50 - 70 m2' },
    { value: 'tu-70-90', label: 'Từ 70 - 90 m2' },
    { value: 'tren-90', label: 'Trên 90 m2' },
];

const typeNewsOptions = [
    {
        value: 'vip',
        label: 'Đề xuất',
        description: 'Tin nổi bật được ưu tiên hiển thị',
    },
    {
        value: 'normal',
        label: 'Mới đăng',
        description: 'Cập nhật những tin vừa đăng gần đây',
    },
];

function HomePage() {
    const [dataPost, setDataPost] = useState([]);
    const [dataNewPost, setDataNewPost] = useState([]);
    const [dataPostSuggest, setDataPostSuggest] = useState([]);

    useEffect(() => {
        document.title = 'Trang chu';
    }, []);

    const getQueryParam = (param) => new URLSearchParams(window.location.search).get(param);

    const [category, setCategory] = useState(() => getQueryParam('category') || '');
    const [priceRange, setPriceRange] = useState(() => getQueryParam('priceRange') || '');
    const [areaRange, setAreaRange] = useState(() => getQueryParam('areaRange') || '');
    const [typeNews, setTypeNews] = useState(() => getQueryParam('typeNews'));

    useEffect(() => {
        const fetchData = async () => {
            const params = {
                category,
                priceRange,
                areaRange,
                typeNews,
            };
            const res = await requestGetPosts(params);
            setDataPost(res.metadata);

            const queryParams = new URLSearchParams();
            if (category) queryParams.set('category', category);
            if (priceRange) queryParams.set('priceRange', priceRange);
            if (areaRange) queryParams.set('areaRange', areaRange);
            if (typeNews) queryParams.set('typeNews', typeNews);

            const queryString = queryParams.toString();
            const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
            window.history.pushState({ path: newUrl }, '', newUrl);
        };
        fetchData();
    }, [category, priceRange, areaRange, typeNews]);

    useEffect(() => {
        const fetchData = async () => {
            const res = await requestGetNewPost();
            const resSuggest = await requestPostSuggest();
            setDataNewPost(res.metadata);
            setDataPostSuggest(resSuggest.metadata);
        };
        fetchData();
    }, []);

    const activeFilterCount = [category, priceRange, areaRange, typeNews].filter(Boolean).length;

    const resetFilters = () => {
        setCategory('');
        setPriceRange('');
        setAreaRange('');
        setTypeNews('');
    };

    const renderMiniPosts = (posts) =>
        posts.map((item) => (
            <Link to={`/chi-tiet-tin-dang/${item._id}`} key={item._id}>
                <div className={cx('postItem')}>
                    <div className={cx('postImage')}>
                        <img src={item.images[0]} alt={item.title} />
                    </div>
                    <div className={cx('postInfo')}>
                        <h4 className={cx('postTitle')}>{item.title}</h4>
                        <div className={cx('postMeta')}>
                            <span className={cx('postPrice')}>{item.price.toLocaleString('vi-VN')} VND</span>
                            <span className={cx('postTime')}>{dayjs(item.createdAt).format('DD/MM/YYYY')}</span>
                        </div>
                    </div>
                </div>
            </Link>
        ));

    return (
        <div className={cx('page')}>
            <section className={cx('hero')}>
                <div className={cx('heroContent')}>
                    <span className={cx('eyebrow')}>
                        <CompassOutlined />
                        Nền tảng tìm phòng trọ và nhà cho thuê hàng đầu Việt Nam.
                    </span>
                    <h1 className={cx('heroTitle')}>Tìm phòng nhanh hơn, lọc chính xác hơn, ra quyết định tự tin hơn.</h1>
                    <p className={cx('heroDescription')}>
                        Không gian tìm phòng được thiết kế lại theo hướng rõ ràng, dễ dùng và tạo cảm giác chuyên nghiệp
                        hơn cho người thuê nhà.
                    </p>

                    <div className={cx('heroActions')}>
                        {typeNewsOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={cx('heroAction', { active: typeNews === option.value })}
                                onClick={() => setTypeNews(option.value)}
                            >
                                <strong>{option.label}</strong>
                                <span>{option.description}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className={cx('heroStats')}>
                    <div className={cx('statCard')}>
                        <span className={cx('statIcon', 'accent')}>
                            <ApartmentOutlined />
                        </span>
                        <strong>{dataPost.length}</strong>
                        <span>Tin phù hợp đang hiển thị</span>
                    </div>
                    <div className={cx('statCard')}>
                        <span className={cx('statIcon', 'warm')}>
                            <FireOutlined />
                        </span>
                        <strong>{dataNewPost.length}</strong>
                        <span>Tin mới trong khu vực quan tâm</span>
                    </div>
                    <div className={cx('statCard')}>
                        <span className={cx('statIcon', 'soft')}>
                            <AimOutlined />
                        </span>
                        <strong>{dataPostSuggest.length}</strong>
                        <span>ợi ý gần vị trí của bạn</span>
                    </div>
                </div>
            </section>

            <section className={cx('filtersPanel')}>
                <div className={cx('panelHeader')}>
                    <div>
                        <span className={cx('panelEyebrow')}>Bộ lọc nhanh</span>
                        <h2>Lọc kết quả theo nhu cầu thực tế</h2>
                    </div>
                    <button type="button" className={cx('resetButton')} onClick={resetFilters}>
                        <ReloadOutlined />
                        Đặt lại bộ lọc
                    </button>
                </div>

                <div className={cx('filtersGrid')}>
                    <div className={cx('filterGroup')}>
                        <div className={cx('filterTitle')}>
                            <ApartmentOutlined />
                            Loại hình
                        </div>
                        <div className={cx('pillList')}>
                            {categoryOptions.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    className={cx('pill', { selected: category === item.value })}
                                    onClick={() => setCategory(category === item.value ? '' : item.value)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={cx('filterGroup')}>
                        <div className={cx('filterTitle')}>
                            <TagOutlined />
                            Mức giá
                        </div>
                        <div className={cx('pillList')}>
                            {priceOptions.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    className={cx('pill', { selected: priceRange === item.value })}
                                    onClick={() => setPriceRange(priceRange === item.value ? '' : item.value)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={cx('filterGroup')}>
                        <div className={cx('filterTitle')}>
                            <BorderOutlined />
                            Diện tích
                        </div>
                        <div className={cx('pillList')}>
                            {areaOptions.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    className={cx('pill', { selected: areaRange === item.value })}
                                    onClick={() => setAreaRange(areaRange === item.value ? '' : item.value)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <div className={cx('contentGrid')}>
                <section className={cx('listingSection')}>
                    <div className={cx('sectionHeader')}>
                        <div>
                            <span className={cx('panelEyebrow')}>Danh sách phòng trọ</span>
                            <h2>Kết quả đã được lọc và sắp xếp rõ ràng</h2>
                        </div>
                        <div className={cx('sectionMeta')}>
                            <span className={cx('metaBadge')}>
                                <ThunderboltOutlined />
                                {activeFilterCount} bộ lọc đang áp dụng
                            </span>
                            <span className={cx('metaBadge')}>
                                <ClockCircleOutlined />
                                ập nhật liên tục theo dữ liệu mới
                            </span>
                        </div>
                    </div>

                    <div className={cx('listContent')}>
                        {dataPost.length > 0 ? (
                            dataPost.map((post) => <CardBody key={post._id} post={post} />)
                        ) : (
                            <div className={cx('emptyState')}>
                                <h3>Chưa có kết quả phù hợp</h3>
                                <p>Thử đổi bộ lọc giá, diện tích hoặc loại tin để tìm được nhiều lựa chọn hơn.</p>
                                <button type="button" onClick={resetFilters}>
                                    óa bộ lọc và xem tất cả
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <aside className={cx('sidebar')}>
                    <div className={cx('sidebarCard')}>
                        <h3>Danh mục phổ biến</h3>
                        <div className={cx('sidebarLinks')}>
                            {categoryOptions.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    className={cx('sidebarLink', { selected: category === item.value })}
                                    onClick={() => setCategory(category === item.value ? '' : item.value)}
                                >
                                    <span>{item.label}</span>
                                    <small>Lọc nhanh theo nhu cầu</small>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={cx('sidebarCard')}>
                        <h3>Tin mới đăng</h3>
                        <div className={cx('miniPosts')}>{renderMiniPosts(dataNewPost)}</div>
                    </div>

                    <div className={cx('sidebarCard')}>
                        <h3>Gợi ý gần bạn</h3>
                        <div className={cx('miniPosts')}>{renderMiniPosts(dataPostSuggest)}</div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default HomePage;
