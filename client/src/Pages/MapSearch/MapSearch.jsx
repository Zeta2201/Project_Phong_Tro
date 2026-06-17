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

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND`;

const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const heatGradient = [
    { stop: 0.25, color: [37, 99, 235] },
    { stop: 0.45, color: [34, 197, 94] },
    { stop: 0.68, color: [250, 204, 21] },
    { stop: 0.86, color: [249, 115, 22] },
    { stop: 1, color: [220, 38, 38] },
];

const getHeatColor = (value) => {
    const normalizedValue = Math.max(0, Math.min(1, value));
    const colorStop = heatGradient.find((item) => normalizedValue <= item.stop) || heatGradient[heatGradient.length - 1];
    return colorStop.color;
};

const createHeatLayer = (points, options = {}) => {
    const HeatLayer = L.Layer.extend({
        initialize(layerPoints, layerOptions) {
            this._points = layerPoints;
            this._options = {
                radius: 34,
                blur: 22,
                maxOpacity: 0.72,
                ...layerOptions,
            };
        },

        onAdd(map) {
            this._map = map;
            this._canvas = L.DomUtil.create('canvas', styles.heatCanvas);
            this._canvas.style.pointerEvents = 'none';
            map.getPanes().overlayPane.appendChild(this._canvas);
            map.on('moveend zoomend resize', this._reset, this);
            this._reset();
        },

        onRemove(map) {
            map.off('moveend zoomend resize', this._reset, this);
            L.DomUtil.remove(this._canvas);
        },

        setPoints(layerPoints) {
            this._points = layerPoints;
            this._draw();
        },

        _reset() {
            const size = this._map.getSize();
            const topLeft = this._map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(this._canvas, topLeft);
            this._canvas.width = size.x;
            this._canvas.height = size.y;
            this._draw();
        },

        _draw() {
            if (!this._map || !this._canvas) return;

            const context = this._canvas.getContext('2d');
            const { width, height } = this._canvas;
            context.clearRect(0, 0, width, height);

            const validPoints = this._points
                .map((item) => ({
                    point: this._map.latLngToContainerPoint([item.lat, item.lng]),
                    intensity: item.intensity || 1,
                }))
                .filter((item) => Number.isFinite(item.point.x) && Number.isFinite(item.point.y));

            if (!validPoints.length) return;

            const alphaCanvas = document.createElement('canvas');
            alphaCanvas.width = width;
            alphaCanvas.height = height;
            const alphaContext = alphaCanvas.getContext('2d');
            const maxIntensity = Math.max(...validPoints.map((item) => item.intensity), 1);
            const radius = this._options.radius;
            const blur = this._options.blur;
            const outerRadius = radius + blur;

            validPoints.forEach(({ point, intensity }) => {
                const gradient = alphaContext.createRadialGradient(point.x, point.y, radius * 0.2, point.x, point.y, outerRadius);
                const opacity = Math.min(this._options.maxOpacity, 0.2 + (intensity / maxIntensity) * this._options.maxOpacity);

                gradient.addColorStop(0, `rgba(0,0,0,${opacity})`);
                gradient.addColorStop(0.55, `rgba(0,0,0,${opacity * 0.42})`);
                gradient.addColorStop(1, 'rgba(0,0,0,0)');

                alphaContext.fillStyle = gradient;
                alphaContext.beginPath();
                alphaContext.arc(point.x, point.y, outerRadius, 0, Math.PI * 2);
                alphaContext.fill();
            });

            const imageData = alphaContext.getImageData(0, 0, width, height);
            const pixels = imageData.data;

            for (let index = 0; index < pixels.length; index += 4) {
                const alpha = pixels[index + 3];
                if (!alpha) continue;

                const [red, green, blue] = getHeatColor(alpha / 255);
                pixels[index] = red;
                pixels[index + 1] = green;
                pixels[index + 2] = blue;
                pixels[index + 3] = Math.min(alpha, 210);
            }

            context.putImageData(imageData, 0, 0);
        },
    });

    return new HeatLayer(points, options);
};

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
                    <span>${formatMoney(post.price)}/thang</span>
                    <small>${post.location || ''}</small>
                    <a href="/chi-tiet-tin-dang/${post._id}">Xem chi tiet</a>
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

function HeatmapLayer({ posts, visible }) {
    const map = useMap();
    const heatLayerRef = useRef(null);

    useEffect(() => {
        const points = posts
            .map((post) => {
                const lat = Number(post.coordinates?.lat);
                const lng = Number(post.coordinates?.lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

                return {
                    lat,
                    lng,
                    intensity: post.typeNews === 'vip' ? 1.35 : 1,
                };
            })
            .filter(Boolean);

        if (!visible) {
            if (heatLayerRef.current) {
                map.removeLayer(heatLayerRef.current);
                heatLayerRef.current = null;
            }
            return;
        }

        if (!heatLayerRef.current) {
            heatLayerRef.current = createHeatLayer(points);
            map.addLayer(heatLayerRef.current);
        } else {
            heatLayerRef.current.setPoints(points);
        }
    }, [map, posts, visible]);

    useEffect(
        () => () => {
            if (heatLayerRef.current) {
                map.removeLayer(heatLayerRef.current);
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
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showMarkers, setShowMarkers] = useState(true);

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
            setError(requestError.response?.data?.message || 'Khong the tai bai dang tren ban do');
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
                        <HeatmapLayer posts={posts} visible={showHeatmap} />
                        {showMarkers && <ClusterMarkers posts={posts} />}
                    </MapContainer>

                    <div className={cx('mapStatus')}>
                        {loading ? 'Dang tim quanh khu vuc ban do...' : `${posts.length} tin co toa do trong vung dang xem`}
                    </div>

                    <div className={cx('mapControls')}>
                        <button type="button" className={cx({ active: showHeatmap })} onClick={() => setShowHeatmap((value) => !value)}>
                            Heatmap
                        </button>
                        <button type="button" className={cx({ active: showMarkers })} onClick={() => setShowMarkers((value) => !value)}>
                            Marker
                        </button>
                    </div>

                    <div className={cx('heatLegend')} aria-hidden="true">
                        <span>Thap</span>
                        <div />
                        <span>Cao</span>
                    </div>
                </div>

                <aside className={cx('resultPanel')}>
                    <div className={cx('resultHeader')}>
                        <span>Ban do phong tro</span>
                        <h1>Search as move</h1>
                        <p>Keo hoac zoom ban do, danh sach, marker va heatmap se tu cap nhat theo vung dang xem.</p>
                    </div>

                    {error && <div className={cx('error')}>{error}</div>}

                    <div className={cx('resultList')}>
                        {posts.map((post) => (
                            <Link to={`/chi-tiet-tin-dang/${post._id}`} className={cx('resultItem')} key={post._id}>
                                <img src={post.images?.[0] || imgDefault} alt={post.title} />
                                <div>
                                    <strong>{post.title}</strong>
                                    <span>{formatMoney(post.price)}/thang</span>
                                    <small>{post.location}</small>
                                </div>
                            </Link>
                        ))}
                        {!loading && posts.length === 0 && (
                            <div className={cx('empty')}>
                                Chua co bai dang co toa do trong vung nay. Cac bai cu can duoc cap nhat toa do de hien tren ban do.
                            </div>
                        )}
                    </div>
                </aside>
            </section>
        </main>
    );
}

export default MapSearch;
