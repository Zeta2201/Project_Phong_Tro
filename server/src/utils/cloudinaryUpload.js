const crypto = require('crypto');

const CLOUDINARY_UPLOAD_URL = (cloudName, resourceType = 'image') =>
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

const buildSignature = (params, apiSecret) => {
    const payload = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&');

    return crypto
        .createHash('sha1')
        .update(`${payload}${apiSecret}`)
        .digest('hex');
};

const uploadImageToCloudinary = async (file, folder = 'phongtro') => {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new Error('Missing Cloudinary environment variables');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
        folder,
        timestamp,
    };

    const formData = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype });

    formData.append('file', blob, file.originalname);
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp);
    formData.append('folder', folder);
    formData.append('signature', buildSignature(params, CLOUDINARY_API_SECRET));

    const response = await fetch(CLOUDINARY_UPLOAD_URL(CLOUDINARY_CLOUD_NAME), {
        method: 'POST',
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Cloudinary upload failed');
    }

    return data.secure_url;
};

const uploadBufferToCloudinary = async ({ buffer, mimetype, originalname, folder = 'phongtro', resourceType = 'auto' }) => {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new Error('Missing Cloudinary environment variables');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
        folder,
        timestamp,
    };

    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimetype });

    formData.append('file', blob, originalname);
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp);
    formData.append('folder', folder);
    formData.append('signature', buildSignature(params, CLOUDINARY_API_SECRET));

    const response = await fetch(CLOUDINARY_UPLOAD_URL(CLOUDINARY_CLOUD_NAME, resourceType), {
        method: 'POST',
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Cloudinary upload failed');
    }

    return {
        url: data.secure_url,
        publicId: data.public_id,
    };
};

module.exports = {
    uploadImageToCloudinary,
    uploadBufferToCloudinary,
};
