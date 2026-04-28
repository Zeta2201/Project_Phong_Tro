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
                message.error(error?.response?.data?.message || 'Khong the tai danh sach yeu thich');
            } finally {
                setLoading(false);
            }
        };

        fetchFavouritePosts();
    }, []);

    return (
        <div className={cx('page')}>
            <section className={cx('hero')}>
                <span className={cx('eyebrow')}>Khong gian rieng cua ban</span>
                <h1>Tin yeu thich</h1>
                <p>Luu lai nhung bai dang ban quan tam de xem lai nhanh hon va so sanh de dang hon.</p>
            </section>

            <section className={cx('content')}>
                <div className={cx('headerRow')}>
                    <div>
                        <h2>Danh sach da luu</h2>
                        <span>{loading ? 'Dang tai du lieu...' : `${posts.length} tin dang trong danh sach yeu thich`}</span>
                    </div>
                </div>

                {loading ? (
                    <div className={cx('emptyState')}>
                        <h3>Dang tai tin yeu thich</h3>
                        <p>Du lieu dang duoc cap nhat, vui long doi trong giay lat.</p>
                    </div>
                ) : posts.length > 0 ? (
                    <div className={cx('list')}>
                        {posts.map((post) => (
                            <CardBody key={post._id} post={post} />
                        ))}
                    </div>
                ) : (
                    <div className={cx('emptyState')}>
                        <h3>Ban chua luu tin nao</h3>
                        <p>Hay mo mot bai dang va bam nut luu tin de dua vao danh sach yeu thich.</p>
                    </div>
                )}
            </section>
        </div>
    );
}

export default FavouritePosts;
