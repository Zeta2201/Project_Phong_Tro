import classNames from 'classnames/bind';
import styles from './HomePage.module.scss';
import {
    AimOutlined,
    ApartmentOutlined,
    BorderOutlined,
    ClockCircleOutlined,
    CompassOutlined,
    EnvironmentOutlined,
    FireOutlined,
    ReloadOutlined,
    SearchOutlined,
    TagOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';

import CardBody from '../CardBody/CardBody';
import imgDefault from '../../assets/images/img_default.png';
import { requestGetFilterOptions, requestGetNewPost, requestGetPosts, requestPostSuggest } from '../../config/request';

const cx = classNames.bind(styles);

const defaultFilterOptions = {
    category: [
    { value: 'phong-tro', label: 'Phòng trọ' },
    { value: 'nha-nguyen-can', label: 'Nhà nguyên căn' },
    { value: 'can-ho-chung-cu', label: 'Căn hộ chung cư' },
    { value: 'can-ho-mini', label: 'Căn hộ mini' },
    ],
    priceRange: [
    { value: 'duoi-1-trieu', label: 'Dưới 1 triệu' },
    { value: 'tu-1-2-trieu', label: '1 - 2 triệu' },
    { value: 'tu-2-3-trieu', label: '2 - 3 triệu' },
    { value: 'tu-3-5-trieu', label: '3 - 5 triệu' },
    { value: 'tu-5-7-trieu', label: '5 - 7 triệu' },
    { value: 'tu-7-10-trieu', label: '7 - 10 triệu' },
    { value: 'tu-10-15-trieu', label: '10 - 15 triệu' },
    { value: 'tren-15-trieu', label: 'Trên 15 triệu' },
    ],
    areaRange: [
    { value: 'duoi-20', label: 'Dưới 20 m²' },
    { value: 'tu-20-30', label: '20 - 30 m²' },
    { value: 'tu-30-50', label: '30 - 50 m²' },
    { value: 'tu-50-70', label: '50 - 70 m²' },
    { value: 'tu-70-90', label: '70 - 90 m²' },
    { value: 'tren-90', label: 'Trên 90 m²' },
    ],
    typeNews: [
    {
        value: 'vip',
        label: 'Tin nổi bật',
        description: 'Ưu tiên các tin chất lượng, dễ xem nhanh.',
    },
    {
        value: 'normal',
        label: 'Tin mới đăng',
        description: 'Theo dõi các lựa chọn vừa được cập nhật.',
    },
    ],
};

const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || '';
const keepActiveSelection = (options, value) => (options.some((option) => option.value === value) ? value : '');

const publicPostsOnly = (posts = []) => posts.filter((post) => post?.status === 'active');

function HomePage() {
    const [dataPost, setDataPost] = useState([]);
    const [dataNewPost, setDataNewPost] = useState([]);
    const [dataPostSuggest, setDataPostSuggest] = useState([]);
    const [filterOptions, setFilterOptions] = useState(defaultFilterOptions);

    useEffect(() => {
        document.title = 'Trang chủ';
    }, []);

    const getQueryParam = (param) => new URLSearchParams(window.location.search).get(param);

    const [category, setCategory] = useState(() => getQueryParam('category') || '');
    const [priceRange, setPriceRange] = useState(() => getQueryParam('priceRange') || '');
    const [areaRange, setAreaRange] = useState(() => getQueryParam('areaRange') || '');
    const [typeNews, setTypeNews] = useState(() => getQueryParam('typeNews') || '');
    const categoryOptions = filterOptions.category;
    const priceOptions = filterOptions.priceRange;
    const areaOptions = filterOptions.areaRange;
    const typeNewsOptions = filterOptions.typeNews;

    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const res = await requestGetFilterOptions();
                const options = res.metadata || [];
                const groupedOptions = {
                    category: options.filter((item) => item.field === 'category'),
                    priceRange: options.filter((item) => item.field === 'priceRange'),
                    areaRange: options.filter((item) => item.field === 'areaRange'),
                    typeNews: options.filter((item) => item.field === 'typeNews'),
                };
                setFilterOptions(groupedOptions);
                setCategory((value) => keepActiveSelection(groupedOptions.category, value));
                setPriceRange((value) => keepActiveSelection(groupedOptions.priceRange, value));
                setAreaRange((value) => keepActiveSelection(groupedOptions.areaRange, value));
                setTypeNews((value) => keepActiveSelection(groupedOptions.typeNews, value));
            } catch {
                setFilterOptions(defaultFilterOptions);
            }
        };
        fetchFilterOptions();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            const params = {
                category,
                priceRange,
                areaRange,
                typeNews,
            };
            const res = await requestGetPosts(params);
            setDataPost(publicPostsOnly(res.metadata || []));

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
            setDataNewPost(publicPostsOnly(res.metadata || []));
            setDataPostSuggest(publicPostsOnly(resSuggest.metadata || []));
        };
        fetchData();
    }, []);

    const activeFilterCount = [category, priceRange, areaRange, typeNews].filter(Boolean).length;

    const activeFilters = [
        {
            key: 'category',
            label: 'Loại hình',
            value: getOptionLabel(categoryOptions, category),
            onClear: () => setCategory(''),
        },
        {
            key: 'price',
            label: 'Mức giá',
            value: getOptionLabel(priceOptions, priceRange),
            onClear: () => setPriceRange(''),
        },
        {
            key: 'area',
            label: 'Diện tích',
            value: getOptionLabel(areaOptions, areaRange),
            onClear: () => setAreaRange(''),
        },
        {
            key: 'typeNews',
            label: 'Loại tin',
            value: getOptionLabel(typeNewsOptions, typeNews),
            onClear: () => setTypeNews(''),
        },
    ].filter((item) => item.value);

    const featuredPosts = useMemo(() => {
        const posts = [...dataPost, ...dataNewPost, ...dataPostSuggest];
        const uniquePosts = posts.filter((post, index, array) => array.findIndex((item) => item._id === post._id) === index);
        return uniquePosts.slice(0, 4);
    }, [dataPost, dataNewPost, dataPostSuggest]);

    const resetFilters = () => {
        setCategory('');
        setPriceRange('');
        setAreaRange('');
        setTypeNews('');
    };

    const renderMiniPosts = (posts) =>
        posts.slice(0, 5).map((item) => (
            <Link to={`/chi-tiet-tin-dang/${item._id}`} key={item._id}>
                <div className={cx('miniPost')}>
                    <div className={cx('miniPostImage')}>
                        <img src={item.images?.[0] || imgDefault} alt={item.title} />
                    </div>
                    <div className={cx('miniPostInfo')}>
                        <h4>{item.title}</h4>
                        <div>
                            <span>{item.price?.toLocaleString('vi-VN')} VNĐ</span>
                            <small>{dayjs(item.createdAt).format('DD/MM/YYYY')}</small>
                        </div>
                    </div>
                </div>
            </Link>
        ));

    return (
        <main className={cx('pageShell')}>
            <section className={cx('hero')}>
                <div className={cx('heroContent')}>
                    <div className={cx('heroText')}>
                        <span className={cx('eyebrow')}>
                            <CompassOutlined />
                            Tìm phòng trọ và nhà cho thuê
                        </span>
                        <h2>Tìm nơi ở phù hợp nhanh hơn, rõ ràng hơn.</h2>
                        <p>
                            Lọc theo loại hình, mức giá và diện tích ngay trên trang chủ. Kết quả được trình bày gọn,
                            dễ so sánh và ưu tiên những thông tin quan trọng khi thuê phòng.
                        </p>
                    </div>

                    <div className={cx('quickSearch')}>
                        <div className={cx('quickSearchHeader')}>
                            <SearchOutlined />
                            <span>Bắt đầu lọc tin</span>
                        </div>

                        <div className={cx('quickSelectGrid')}>
                            <div className={cx('quickSelect')}>
                                <label>Loại hình</label>
                                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                                    <option value="">Tất cả loại hình</option>
                                    {categoryOptions.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={cx('quickSelect')}>
                                <label>Mức giá</label>
                                <select value={priceRange} onChange={(event) => setPriceRange(event.target.value)}>
                                    <option value="">Tất cả mức giá</option>
                                    {priceOptions.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={cx('quickSelect')}>
                                <label>Diện tích</label>
                                <select value={areaRange} onChange={(event) => setAreaRange(event.target.value)}>
                                    <option value="">Tất cả diện tích</option>
                                    {areaOptions.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={cx('heroPreview')} aria-label="Một số tin đăng nổi bật">
                    {featuredPosts.length > 0 ? (
                        featuredPosts.map((post, index) => (
                            <Link
                                to={`/chi-tiet-tin-dang/${post._id}`}
                                key={post._id}
                                className={cx('previewTile', { large: index === 0 })}
                            >
                                <img src={post.images?.[0] || imgDefault} alt={post.title} />
                                <span>{post.price?.toLocaleString('vi-VN')} VNĐ/tháng</span>
                            </Link>
                        ))
                    ) : (
                        <div className={cx('previewEmpty')}>
                            <ApartmentOutlined />
                            <span>Đang tải tin đăng</span>
                        </div>
                    )}
                </div>
            </section>

            <section className={cx('summaryBar')}>
                <div className={cx('summaryItem')}>
                    <ApartmentOutlined />
                    <strong>{dataPost.length}</strong>
                    <span>Tin đang hiển thị</span>
                </div>
                <div className={cx('summaryItem')}>
                    <FireOutlined />
                    <strong>{dataNewPost.length}</strong>
                    <span>Tin mới đăng</span>
                </div>
                <div className={cx('summaryItem')}>
                    <AimOutlined />
                    <strong>{dataPostSuggest.length}</strong>
                    <span>Gợi ý gần bạn</span>
                </div>
                <div className={cx('summaryItem')}>
                    <ThunderboltOutlined />
                    <strong>{activeFilterCount}</strong>
                    <span>Bộ lọc đang bật</span>
                </div>
            </section>

            <section className={cx('activeFilters')}>
                <div>
                    <span className={cx('sectionKicker')}>Bộ lọc hiện tại</span>
                    <h2>Kết quả thay đổi ngay khi bạn chọn tiêu chí</h2>
                </div>

                <div className={cx('activeFilterActions')}>
                    {activeFilters.length > 0 ? (
                        activeFilters.map((item) => (
                            <button key={item.key} type="button" className={cx('filterChip')} onClick={item.onClear}>
                                <span>{item.label}</span>
                                <strong>{item.value}</strong>
                            </button>
                        ))
                    ) : (
                        <p>Chưa chọn bộ lọc. Bạn có thể lọc theo loại hình, giá hoặc diện tích để thu hẹp kết quả.</p>
                    )}
                    {activeFilterCount > 0 ? (
                        <button type="button" className={cx('resetButton')} onClick={resetFilters}>
                            <ReloadOutlined />
                            Đặt lại
                        </button>
                    ) : null}
                </div>
            </section>

            <div className={cx('contentGrid')}>
                <aside className={cx('filterColumn')}>
                    <section className={cx('filterPanel')}>
                        <div className={cx('panelHeader')}>
                            <div>
                                <span className={cx('sectionKicker')}>Lọc nhanh</span>
                                <h2>Chọn tiêu chí thuê phòng</h2>
                            </div>
                            <button type="button" onClick={resetFilters} aria-label="Đặt lại bộ lọc">
                                <ReloadOutlined />
                            </button>
                        </div>

                        <div className={cx('filterGroup')}>
                            <h3>
                                <ApartmentOutlined />
                                Loại hình
                            </h3>
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
                            <h3>
                                <TagOutlined />
                                Mức giá
                            </h3>
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
                            <h3>
                                <BorderOutlined />
                                Diện tích
                            </h3>
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

                        <div className={cx('filterGroup')}>
                            <h3>
                                <ClockCircleOutlined />
                                Loại tin
                            </h3>
                            <div className={cx('typeList')}>
                                {typeNewsOptions.map((item) => (
                                    <button
                                        key={item.value}
                                        type="button"
                                        className={cx('typeOption', { selected: typeNews === item.value })}
                                        onClick={() => setTypeNews(typeNews === item.value ? '' : item.value)}
                                    >
                                        <strong>{item.label}</strong>
                                        <span>{item.description}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>
                </aside>

                <section className={cx('resultsPanel')}>
                    <div className={cx('resultsHeader')}>
                        <div>
                            <span className={cx('sectionKicker')}>Danh sách tin đăng</span>
                            <h2>{dataPost.length} lựa chọn phù hợp</h2>
                        </div>
                        <div className={cx('resultsMeta')}>
                            <span>
                                <EnvironmentOutlined />
                                Ưu tiên tin còn hoạt động
                            </span>
                            <span>
                                <ClockCircleOutlined />
                                Cập nhật theo dữ liệu mới
                            </span>
                        </div>
                    </div>

                    <div className={cx('postList')}>
                        {dataPost.length > 0 ? (
                            dataPost.map((post) => <CardBody key={post._id} post={post} />)
                        ) : (
                            <div className={cx('emptyState')}>
                                <h3>Chưa có kết quả phù hợp</h3>
                                <p>Hãy thử nới mức giá, diện tích hoặc bỏ bớt bộ lọc để xem thêm lựa chọn.</p>
                                <button type="button" onClick={resetFilters}>
                                    Xem tất cả tin
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <aside className={cx('sideColumn')}>
                    <section className={cx('sidePanel')}>
                        <h2>Tin mới đăng</h2>
                        <div className={cx('miniPostList')}>{renderMiniPosts(dataNewPost)}</div>
                    </section>

                    <section className={cx('sidePanel')}>
                        <h2>Gợi ý gần bạn</h2>
                        <div className={cx('miniPostList')}>{renderMiniPosts(dataPostSuggest)}</div>
                    </section>
                </aside>
            </div>
        </main>
    );
}

export default HomePage;
