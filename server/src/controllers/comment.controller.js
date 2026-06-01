const mongoose = require('mongoose');
const modelComment = require('../models/comment.model');
const modelPost = require('../models/post.model');
const { Created, OK } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');

const COMMENT_STATUSES = ['visible', 'hidden', 'deleted'];
const normalizeContent = (content) => (typeof content === 'string' ? content.trim() : '');

class controllerComment {
    async getCommentsByPost(req, res) {
        const { postId } = req.query;
        if (!mongoose.isValidObjectId(postId)) {
            throw new BadRequestError('Bai viet khong hop le');
        }

        const comments = await modelComment
            .find({
                postId,
                $or: [{ status: 'visible' }, { status: { $exists: false } }],
            })
            .sort({ createdAt: -1 })
            .populate('userId', 'fullName avatar');

        new OK({ message: 'Lay binh luan thanh cong', metadata: comments }).send(res);
    }

    async createComment(req, res) {
        const { id: userId } = req.user;
        const { postId } = req.body;
        const content = normalizeContent(req.body.content);

        if (!mongoose.isValidObjectId(postId) || !(await modelPost.exists({ _id: postId }))) {
            throw new BadRequestError('Bai viet khong ton tai');
        }
        if (!content) {
            throw new BadRequestError('Vui long nhap noi dung binh luan');
        }
        if (content.length > 1000) {
            throw new BadRequestError('Binh luan khong duoc vuot qua 1000 ky tu');
        }

        const comment = await modelComment.create({ postId, userId, content });
        await comment.populate('userId', 'fullName avatar');

        new Created({ message: 'Da gui binh luan', metadata: comment }).send(res);
    }

    async deleteComment(req, res) {
        const { id: userId } = req.user;
        const { commentId } = req.body;

        if (!mongoose.isValidObjectId(commentId)) {
            throw new BadRequestError('Binh luan khong hop le');
        }

        const comment = await modelComment.findById(commentId);
        if (!comment) {
            throw new BadRequestError('Binh luan khong ton tai');
        }
        if (comment.userId.toString() !== userId) {
            throw new BadRequestError('Ban khong co quyen xoa binh luan nay');
        }

        comment.status = 'deleted';
        await comment.save();
        new OK({ message: 'Da xoa binh luan' }).send(res);
    }

    async getAllComments(req, res) {
        const { status, q } = req.query;
        const filter = {};

        if (status) {
            if (!COMMENT_STATUSES.includes(status)) {
                throw new BadRequestError('Trang thai binh luan khong hop le');
            }
            filter.status = status;
            if (status === 'visible') {
                delete filter.status;
                filter.$or = [{ status: 'visible' }, { status: { $exists: false } }];
            }
        }

        if (q) {
            filter.content = { $regex: q, $options: 'i' };
        }

        const comments = await modelComment
            .find(filter)
            .sort({ createdAt: -1 })
            .populate('userId', 'fullName email avatar')
            .populate('postId', 'title status')
            .populate('moderatedBy', 'fullName email');

        new OK({ message: 'Lay danh sach binh luan thanh cong', metadata: comments }).send(res);
    }

    async updateCommentStatus(req, res) {
        const { commentId, status } = req.body;
        const moderationNote = normalizeContent(req.body.moderationNote);

        if (!mongoose.isValidObjectId(commentId)) {
            throw new BadRequestError('Binh luan khong hop le');
        }
        if (!COMMENT_STATUSES.includes(status)) {
            throw new BadRequestError('Trang thai binh luan khong hop le');
        }
        if (moderationNote.length > 1000) {
            throw new BadRequestError('Ghi chu khong duoc vuot qua 1000 ky tu');
        }

        const comment = await modelComment.findByIdAndUpdate(
            commentId,
            {
                status,
                moderationNote,
                moderatedBy: req.user.id,
                moderatedAt: new Date(),
            },
            { new: true },
        );

        if (!comment) {
            throw new BadRequestError('Binh luan khong ton tai');
        }

        new OK({ message: 'Cap nhat binh luan thanh cong', metadata: comment }).send(res);
    }
}

module.exports = new controllerComment();
