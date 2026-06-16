import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import classNames from 'classnames/bind';

import { requestGetMapPosts } from '../../config/request';
import imgDefault from '../../assets/images/img_default.png';
import styles from './MapSearch.module.scss';

const cx = classNames.bind(styles);

const defaultCenter = [10.0452, 105.7469];
const defaultZoom = 13;

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

function ClusterMarkers({ posts }) {
    const map = useMap();
    const clusterRef = useRef(null);

    useEffect(() => {
        if (!clusterRef.current) {
            clusterRef.current = L.markerClusterGroup({
                showCoverageOnHover: false,
                maxClusterRadius: 48,
            });
            map.addLayer(clusterRef.current);
        }

        const cluster = clusterRef.current;
        cluster.clearLayers();

        posts.forEach((post) => {
            const lat = Number(post.coordinates?.lat);
            const lng = Number(post.coordinates?.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

            const marker = L.marker([lat, lng], { icon: defaultIcon });
            marker.bindPopup(`
                <div class="${styles.popup}">
                    <img src="${post.images?.[0] || imgDefault}" alt="" />
                    <strong>${post.title || ''}</strong>
                    <span>${formatMoney(post.price)}/tháng</span>
                    <small>${post.location || ''}</small>
                    <a href="/chi-tiet-tin-dang/${post._id}">Xem chi tiết</a>
                </div>
            `);
            cluster.addLayer(marker);
        });

        return () => {
            cluster.clearLayers();
        };
    }, [map, posts]);

    useEffect(
        () => () => {
            if (clusterRef.current) {
                map.removeLayer(clusterRef.current);
            }
        },
        [map],
    );

    return null;
}

function MapMoveHandler({ onBoundsChange }) {
    const map = useMapEvents({
        moveend: () => onBoundsChange(map),
        zoomend: () => onBoundsChange(map),
    });

    useEffect(() => {
        onBoundsChange(map);
    }, [map, onBoundsChange]);

    return null;
}

function MapSearch() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchPostsByMap = useCallback(async (map) => {
        const bounds = map.getBounds();
        const params = {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
        };

        setLoading(true);
        setError('');
        try {
            const res = await requestGetMapPosts(params);
            setPosts(res.metadata || []);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Không thể tải bài đăng trên bản đồ');
        } finally {
            setLoading(false);
        }
    }, []);

    return (
        <main className={cx('page')}>
            <section className={cx('mapShell')}>
                <div className={cx('mapPanel')}>
                    <MapContainer center={defaultCenter} zoom={defaultZoom} className={cx('map')} scrollWheelZoom>
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapMoveHandler onBoundsChange={fetchPostsByMap} />
                        <ClusterMarkers posts={posts} />
                    </MapContainer>
                    <div className={cx('mapStatus')}>
                        {loading ? 'Đang tìm quanh khu vực bản đồ...' : `${posts.length} tin có tọa độ trong vùng đang xem`}
                    </div>
                </div>

                <aside className={cx('resultPanel')}>
                    <div className={cx('resultHeader')}>
                        <span>Bản đồ phòng trọ</span>
                        <h1>Search as move</h1>
                        <p>Kéo hoặc zoom bản đồ, danh sách và marker sẽ tự cập nhật theo vùng đang xem.</p>
                    </div>

                    {error && <div className={cx('error')}>{error}</div>}

                    <div className={cx('resultList')}>
                        {posts.map((post) => (
                            <Link to={`/chi-tiet-tin-dang/${post._id}`} className={cx('resultItem')} key={post._id}>
                                <img src={post.images?.[0] || imgDefault} alt={post.title} />
                                <div>
                                    <strong>{post.title}</strong>
                                    <span>{formatMoney(post.price)}/tháng</span>
                                    <small>{post.location}</small>
                                </div>
                            </Link>
                        ))}
                        {!loading && posts.length === 0 && (
                            <div className={cx('empty')}>
                                Chưa có bài đăng có tọa độ trong vùng này. Các bài cũ cần được cập nhật tọa độ để hiện trên bản đồ.
                            </div>
                        )}
                    </div>
                </aside>
            </section>
        </main>
    );
}

export default MapSearch;
