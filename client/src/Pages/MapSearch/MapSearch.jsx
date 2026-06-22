import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
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
const defaultRadiusKm = 2;

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
                radius: 46,
                blur: 34,
                maxOpacity: 0.9,
                ...layerOptions,
            };
        },

        onAdd(map) {
            this._map = map;
            if (!map.getPane('heatPane')) {
                const pane = map.createPane('heatPane');
                pane.style.zIndex = 450;
                pane.style.pointerEvents = 'none';
            }
            this._canvas = L.DomUtil.create('canvas', styles.heatCanvas);
            this._canvas.style.pointerEvents = 'none';
            this._canvas.style.position = 'absolute';
            this._canvas.style.left = '0';
            this._canvas.style.top = '0';
            map.getPane('heatPane').appendChild(this._canvas);
            map.on('moveend zoomend resize viewreset', this._reset, this);
            this._reset();
        },

        onRemove(map) {
            map.off('moveend zoomend resize viewreset', this._reset, this);
            L.DomUtil.remove(this._canvas);
        },

        setPoints(layerPoints) {
            this._points = layerPoints;
            this._draw();
        },

        _reset() {
            const size = this._map.getSize();
            const topLeft = this._map.containerPointToLayerPoint([0, 0]);
            this._topLeft = topLeft;
            L.DomUtil.setPosition(this._canvas, topLeft);
            this._canvas.width = size.x;
            this._canvas.height = size.y;
            this._canvas.style.width = `${size.x}px`;
            this._canvas.style.height = `${size.y}px`;
            this._draw();
        },

        _draw() {
            if (!this._map || !this._canvas) return;

            const context = this._canvas.getContext('2d');
            const { width, height } = this._canvas;
            context.clearRect(0, 0, width, height);

            const validPoints = this._points
                .map((item) => ({
                    point: this._map.latLngToLayerPoint([item.lat, item.lng]).subtract(this._topLeft),
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
                    <span>${formatMoney(post.price)}/tháng</span>
                    ${typeof post.distanceKm === 'number' ? `<em>Cách khoảng ${post.distanceKm} km</em>` : ''}
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

function RadiusSearchLayer({ radiusSearch }) {
    const map = useMap();
    const circleRef = useRef(null);

    useEffect(() => {
        if (!radiusSearch) {
            if (circleRef.current) {
                map.removeLayer(circleRef.current);
                circleRef.current = null;
            }
            return;
        }

        const center = [radiusSearch.lat, radiusSearch.lng];
        map.flyTo(center, Math.max(map.getZoom(), 14), { duration: 0.8 });

        if (!circleRef.current) {
            circleRef.current = L.circle(center, {
                radius: radiusSearch.radiusKm * 1000,
                color: '#0f766e',
                weight: 2,
                fillColor: '#14b8a6',
                fillOpacity: 0.12,
            });
            circleRef.current.addTo(map);
        } else {
            circleRef.current.setLatLng(center);
            circleRef.current.setRadius(radiusSearch.radiusKm * 1000);
        }
    }, [map, radiusSearch]);

    useEffect(
        () => () => {
            if (circleRef.current) {
                map.removeLayer(circleRef.current);
            }
        },
        [map],
    );

    return null;
}

function MapSearch() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showMarkers, setShowMarkers] = useState(true);
    const [searchPlace, setSearchPlace] = useState('');
    const [radiusKm, setRadiusKm] = useState(defaultRadiusKm);
    const [radiusSearch, setRadiusSearch] = useState(null);
    const lastMapRef = useRef(null);

    const fetchPostsByMap = useCallback(
        async (map, overrideRadiusSearch = radiusSearch) => {
            lastMapRef.current = map;
            const bounds = map.getBounds();
            const params = {
                north: bounds.getNorth(),
                south: bounds.getSouth(),
                east: bounds.getEast(),
                west: bounds.getWest(),
            };

            if (overrideRadiusSearch) {
                params.lat = overrideRadiusSearch.lat;
                params.lng = overrideRadiusSearch.lng;
                params.radiusKm = overrideRadiusSearch.radiusKm;
            }

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
        },
        [radiusSearch],
    );

    const handleRadiusSearch = async () => {
        const trimmedPlace = searchPlace.trim();
        if (!trimmedPlace) {
            setError('Vui lòng nhập vị trí cần tìm, ví dụ: Đại học Cần Thơ');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await axios.get('https://rsapi.goong.io/Geocode', {
                params: {
                    address: trimmedPlace,
                    api_key: import.meta.env.VITE_API_KEY,
                },
            });
            const location = res.data?.results?.[0]?.geometry?.location;
            if (!location?.lat || !location?.lng) {
                setError('Không tìm thấy tọa độ cho vị trí này');
                return;
            }

            const nextRadiusSearch = {
                label: trimmedPlace,
                lat: Number(location.lat),
                lng: Number(location.lng),
                radiusKm: Number(radiusKm) || defaultRadiusKm,
            };
            setRadiusSearch(nextRadiusSearch);
            if (lastMapRef.current) {
                await fetchPostsByMap(lastMapRef.current, nextRadiusSearch);
            }
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Không thể tìm tọa độ vị trí này');
        } finally {
            setLoading(false);
        }
    };

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            setError('Trình duyệt không hỗ trợ lấy vị trí hiện tại');
            return;
        }

        setLoading(true);
        setError('');
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const nextRadiusSearch = {
                    label: 'Vị trí hiện tại',
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    radiusKm: Number(radiusKm) || defaultRadiusKm,
                };
                setSearchPlace('Vị trí hiện tại');
                setRadiusSearch(nextRadiusSearch);
                if (lastMapRef.current) {
                    await fetchPostsByMap(lastMapRef.current, nextRadiusSearch);
                }
                setLoading(false);
            },
            () => {
                setLoading(false);
                setError('Không thể lấy vị trí hiện tại. Vui lòng cấp quyền định vị hoặc nhập địa điểm.');
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    const clearRadiusSearch = async () => {
        setRadiusSearch(null);
        setSearchPlace('');
        if (lastMapRef.current) {
            await fetchPostsByMap(lastMapRef.current, null);
        }
    };

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
                        <RadiusSearchLayer radiusSearch={radiusSearch} />
                        <HeatmapLayer posts={posts} visible={showHeatmap} />
                        {showMarkers && <ClusterMarkers posts={posts} />}
                    </MapContainer>

                    <div className={cx('mapStatus')}>
                        {loading
                            ? 'Đang tìm phòng trọ...'
                            : radiusSearch
                              ? `${posts.length} tin trong bán kính ${radiusSearch.radiusKm}km quanh ${radiusSearch.label}`
                              : `${posts.length} tin có tọa độ trong vùng đang xem`}
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
                        <span>Thấp</span>
                        <div />
                        <span>Cao</span>
                    </div>
                </div>

                <aside className={cx('resultPanel')}>
                    <div className={cx('resultHeader')}>
                        <span>Bản đồ phòng trọ</span>
                        <h1>Tìm theo vị trí</h1>
                        <p>Kéo bản đồ để xem theo vùng hoặc nhập một địa điểm rồi chọn bán kính, ví dụ tìm quanh trường đại học trong 2km.</p>
                    </div>

                    <div className={cx('radiusSearchBox')}>
                        <label htmlFor="radius-place">Vị trí trung tâm</label>
                        <input
                            id="radius-place"
                            value={searchPlace}
                            onChange={(event) => setSearchPlace(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') handleRadiusSearch();
                            }}
                            placeholder="Ví dụ: Đại học Cần Thơ"
                        />
                        <div className={cx('radiusRow')}>
                            <label htmlFor="radius-km">Bán kính</label>
                            <select id="radius-km" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
                                <option value={1}>1 km</option>
                                <option value={2}>2 km</option>
                                <option value={3}>3 km</option>
                                <option value={5}>5 km</option>
                                <option value={10}>10 km</option>
                            </select>
                        </div>
                        <div className={cx('radiusActions')}>
                            <button type="button" onClick={handleRadiusSearch} disabled={loading}>
                                Tìm quanh đây
                            </button>
                            <button type="button" onClick={handleUseCurrentLocation} disabled={loading}>
                                Vị trí của tôi
                            </button>
                            {radiusSearch && (
                                <button type="button" className={cx('ghost')} onClick={clearRadiusSearch} disabled={loading}>
                                    Bỏ bán kính
                                </button>
                            )}
                        </div>
                        {radiusSearch && (
                            <p className={cx('radiusHint')}>
                                Đang lọc quanh <strong>{radiusSearch.label}</strong> trong bán kính {radiusSearch.radiusKm}km.
                            </p>
                        )}
                    </div>

                    {error && <div className={cx('error')}>{error}</div>}

                    <div className={cx('resultList')}>
                        {posts.map((post) => (
                            <Link to={`/chi-tiet-tin-dang/${post._id}`} className={cx('resultItem')} key={post._id}>
                                <img src={post.images?.[0] || imgDefault} alt={post.title} />
                                <div>
                                    <strong>{post.title}</strong>
                                    <span>{formatMoney(post.price)}/tháng</span>
                                    {typeof post.distanceKm === 'number' && <em>Cách khoảng {post.distanceKm} km</em>}
                                    <small>{post.location}</small>
                                </div>
                            </Link>
                        ))}
                        {!loading && posts.length === 0 && (
                            <div className={cx('empty')}>
                                Chưa có bài đăng đã duyệt và có tọa độ trong vùng này. Hãy kéo bản đồ tới đúng khu vực hoặc kiểm tra bài đã được admin duyệt chưa.
                            </div>
                        )}
                    </div>
                </aside>
            </section>
        </main>
    );
}

export default MapSearch;
