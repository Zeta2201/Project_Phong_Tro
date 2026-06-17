const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const modelApiKey = require('../models/apiKey.model');
const { BadUserRequestError } = require('../core/error.response');

require('dotenv').config();

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

const createApiKey = async (userId) => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

    const privateKeyString = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const publicKeyString = publicKey.export({ type: 'spki', format: 'pem' });

    await modelApiKey.deleteMany({ userId: userId.toString() });
    return await modelApiKey.create({ userId, publicKey: publicKeyString, privateKey: privateKeyString });
};

const createSignedToken = async (payload, tokenType, expiresIn) => {
    const findApiKey = await modelApiKey.findOne({ userId: payload.id.toString() });

    if (!findApiKey?.privateKey) {
        throw new Error('Private key not found for user');
    }

    return jwt.sign({ ...payload, tokenType }, findApiKey.privateKey, {
        algorithm: 'RS256',
        expiresIn,
    });
};

const createToken = async (payload) => createSignedToken(payload, 'access', ACCESS_TOKEN_EXPIRES_IN);

const createRefreshToken = async (payload) => createSignedToken(payload, 'refresh', REFRESH_TOKEN_EXPIRES_IN);

const verifyToken = async (token, expectedType) => {
    try {
        if (!token) {
            throw new BadUserRequestError('Vui lòng đăng nhập lại');
        }

        const decodedPayload = jwt.decode(token);
        if (!decodedPayload?.id) {
            throw new BadUserRequestError('Phiên đăng nhập không hợp lệ');
        }

        const findApiKey = await modelApiKey.findOne({ userId: decodedPayload.id });
        if (!findApiKey) {
            throw new BadUserRequestError('Vui lòng đăng nhập lại');
        }

        const decoded = jwt.verify(token, findApiKey.publicKey, {
            algorithms: ['RS256'],
        });

        if (expectedType && decoded.tokenType !== expectedType) {
            throw new BadUserRequestError('Phiên đăng nhập không hợp lệ');
        }

        return decoded;
    } catch (error) {
        throw new BadUserRequestError('Vui lòng đăng nhập lại');
    }
};

module.exports = {
    createApiKey,
    createToken,
    createRefreshToken,
    verifyToken,
};
