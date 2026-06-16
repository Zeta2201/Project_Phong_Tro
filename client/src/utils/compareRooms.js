const COMPARE_ROOMS_KEY = 'compareRooms';
const MAX_COMPARE_ROOMS = 4;

const normalizePost = (post) => ({
    _id: post._id,
    title: post.title,
    price: Number(post.price || 0),
    area: Number(post.area || 0),
    location: post.location,
    category: post.category,
    images: post.images || [],
    options: post.options || [],
    availabilityStatus: post.availabilityStatus || 'available',
    typeNews: post.typeNews,
    ratingAverage: Number(post.ratingAverage || 0),
    ratingCount: Number(post.ratingCount || 0),
    phone: post.phone,
    createdAt: post.createdAt,
    user: post.user,
});

export const getCompareRooms = () => {
    try {
        const rooms = JSON.parse(localStorage.getItem(COMPARE_ROOMS_KEY) || '[]');
        return Array.isArray(rooms) ? rooms : [];
    } catch {
        return [];
    }
};

export const isRoomCompared = (postId) => getCompareRooms().some((room) => room._id === postId);

export const saveCompareRooms = (rooms) => {
    localStorage.setItem(COMPARE_ROOMS_KEY, JSON.stringify(rooms));
    window.dispatchEvent(new Event('compareRoomsUpdated'));
};

export const addRoomToCompare = (post) => {
    const rooms = getCompareRooms();

    if (rooms.some((room) => room._id === post._id)) {
        return { status: 'exists', rooms };
    }

    if (rooms.length >= MAX_COMPARE_ROOMS) {
        return { status: 'full', rooms };
    }

    const nextRooms = [...rooms, normalizePost(post)];
    saveCompareRooms(nextRooms);
    return { status: 'added', rooms: nextRooms };
};

export const removeRoomFromCompare = (postId) => {
    const nextRooms = getCompareRooms().filter((room) => room._id !== postId);
    saveCompareRooms(nextRooms);
    return nextRooms;
};

export const clearCompareRooms = () => saveCompareRooms([]);

export { MAX_COMPARE_ROOMS };
