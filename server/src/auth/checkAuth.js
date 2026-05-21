const { BadUserRequestError, BadUser2RequestError } = require('../core/error.response');
const { verifyToken } = require('../services/tokenSevices');
const modelUser = require('../models/users.model');

const asyncHandler = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

const authUser = async (req, res, next) => {
    try {
        const user = req.cookies.token;
        if (!user) throw new BadUserRequestError('Vui long dang nhap');

        const decoded = await verifyToken(user);
        const findUser = await modelUser.findById(decoded.id);

        if (!findUser || findUser.isActive === false) {
            throw new BadUserRequestError('Tai khoan cua ban da bi khoa');
        }

        req.user = decoded;
        next();
    } catch (error) {
        next(error);
    }
};

const authAdmin = async (req, res, next) => {
    try {
        const user = req.cookies.token;
        if (!user) throw new BadUserRequestError('Ban khong co quyen truy cap');

        const decoded = await verifyToken(user);
        const findUser = await modelUser.findById(decoded.id);

        if (!findUser || findUser.isActive === false) {
            throw new BadUserRequestError('Tai khoan cua ban da bi khoa');
        }

        if (findUser.isAdmin === false) {
            throw new BadUser2RequestError('Ban khong co quyen truy cap');
        }

        req.user = decoded;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    asyncHandler,
    authUser,
    authAdmin,
};
