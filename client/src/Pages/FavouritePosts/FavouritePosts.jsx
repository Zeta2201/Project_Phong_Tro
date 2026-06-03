import classNames from 'classnames/bind';
import { useEffect, useState } from 'react';
import { message } from 'antd';

import styles from './FavouritePosts.module.scss';
import CardBody from '../../Components/CardBody/CardBody';
import { requestGetFavourite } from '../../config/request';

const cx = classNames.bind(styles);

function FavouritePosts() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = 'Tin yeu thich';
    }, []);

    useEffect(() => {
        const fetchFavouritePosts = async () => {
            try {
                const res = await requestGetFavourite();
                setPosts(res.metadata || []);
            } catch (error) {
                message.error(error?.response?.data?.message || 'Không thể tải danh sách yêu thích');
            } finally {
                setLoading(false);
            }
        };

        fetchFavouritePosts();
    }, []);

    return (
        <div className={cx('page')}>
            {/* <section className={cx('hero')}>
                <span className={cx('eyebrow')}>Không gian riêng của bạn </span>
                <h2>Tin yêu thích</h2>
                <p>Luu lai nhung bai dang ban quan tam de xem lai nhanh hon va so sanh de dang hon.</p>
            </section> */}

            <section className={cx('content')}>
                <div className={cx('headerRow')}>
                    <div>
                        <h2>Danh sách đã lưu</h2>
                        <span>{loading ? 'Đang tải dữ liệu...' : `${posts.length} tin đang trong danh sách yêu thích`}</span>
                    </div>
                </div>

                {loading ? (
                    <div className={cx('emptyState')}>
                        <h3>Đang tải tin yêu thích</h3>
                        <p>Dữ liệu đang được cập nhật, vui lòng đợi trong giây lát.</p>
                    </div>
                ) : posts.length > 0 ? (
                    <div className={cx('list')}>
                        {posts.map((post) => (
                            <CardBody key={post._id} post={post} />
                        ))}
                    </div>
                ) : (
                    <div className={cx('emptyState')}>
                        <h3>Bạn chưa lưu tin nào</h3>
                        <p>Hãy mở một bài đăng và bấm nút "Lưu tin" để đưa vào danh sách yêu thích.</p>
                    </div>
                )}
            </section>
        </div>
    );
}

export default FavouritePosts;
