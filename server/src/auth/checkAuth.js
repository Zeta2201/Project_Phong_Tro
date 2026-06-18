const { BadUserRequestError, BadUser2RequestError } = require('../core/error.response');
const { verifyToken } = require('../services/tokenSevices');
const modelUser = require('../models/users.model');

const asyncHandler = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

const isLockedUser = (user) => !user || user.isActive === false || user.accountStatus === 'locked';

const authUser = async (req, res, next) => {
    try {
        const accessToken = req.cookies.token;
        if (!accessToken) throw new BadUserRequestError('Vui lòng đăng nhập');

        const decoded = await verifyToken(accessToken, 'access');
        const findUser = await modelUser.findById(decoded.id);

        if (isLockedUser(findUser)) {
            throw new BadUserRequestError('Tài khoản của bạn đã bị khóa');
        }

        req.user = decoded;
        next();
    } catch (error) {
        next(error);
    }
};

const authAdmin = async (req, res, next) => {
    try {
        const accessToken = req.cookies.token;
        if (!accessToken) throw new BadUserRequestError('Bạn không có quyền truy cập');

        const decoded = await verifyToken(accessToken, 'access');
        const findUser = await modelUser.findById(decoded.id);

        if (isLockedUser(findUser)) {
            throw new BadUserRequestError('Tài khoản của bạn đã bị khóa');
        }

        const role = findUser.role || (findUser.isAdmin ? 'admin' : 'user');
        if (!['admin', 'super_admin'].includes(role) && findUser.isAdmin === false) {
            throw new BadUser2RequestError('Bạn không có quyền truy cập');
        }

        req.user = { ...decoded, role };
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    asyncHandler,
    authUser,
    authAdmin,
    isLockedUser,
};

