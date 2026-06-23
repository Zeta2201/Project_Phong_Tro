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

        new OK({ message: 'Lấy bình luận thành công', metadata: comments }).send(res);
    }

    async createComment(req, res) {
        const { id: userId } = req.user;
        const { postId } = req.body;
        const content = normalizeContent(req.body.content);

        if (!mongoose.isValidObjectId(postId) || !(await modelPost.exists({ _id: postId }))) {
            throw new BadRequestError('Bai viet khong ton tai');
        }
        if (!content) {
            throw new BadRequestError('Vui lòng nhập nội dung bình luận');
        }
        if (content.length > 1000) {
            throw new BadRequestError('Bình luận không được vượt quá 1000 ký tự');
        }

        const comment = await modelComment.create({ postId, userId, content });
        await comment.populate('userId', 'fullName avatar');

        new Created({ message: 'Đã gửi bình luận', metadata: comment }).send(res);
    }

    async deleteComment(req, res) {
        const { id: userId } = req.user;
        const { commentId } = req.body;

        if (!mongoose.isValidObjectId(commentId)) {
            throw new BadRequestError('Bình luận không hợp lệ');
        }

        const comment = await modelComment.findById(commentId);
        if (!comment) {
            throw new BadRequestError('Bình luận không tồn tại');
        }
        if (comment.userId.toString() !== userId) {
            throw new BadRequestError('Bạn không có quyền xóa bình luận này');
        }

        comment.status = 'deleted';
        await comment.save();
        new OK({ message: 'Đã xóa bình luận' }).send(res);
    }

    async getAllComments(req, res) {
        const { status, q } = req.query;
        const filter = {};

        if (status) {
            if (!COMMENT_STATUSES.includes(status)) {
                throw new BadRequestError('Trạng thái bình luận không hợp lệ');
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

        new OK({ message: 'Lấy danh sách bình luận thành công', metadata: comments }).send(res);
    }

    async updateCommentStatus(req, res) {
        const { commentId, status } = req.body;
        const moderationNote = normalizeContent(req.body.moderationNote);

        if (!mongoose.isValidObjectId(commentId)) {
            throw new BadRequestError('Bình luận không hợp lệ');
        }
        if (!COMMENT_STATUSES.includes(status)) {
            throw new BadRequestError('Trạng thái bình luận không hợp lệ');
        }
        if (moderationNote.length > 1000) {
            throw new BadRequestError('Ghi chú không được vượt quá 1000 ký tự');
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
            throw new BadRequestError('Bình luận không tồn tại');
        }

        new OK({ message: 'Cập nhật bình luận thành công', metadata: comment }).send(res);
    }
}

module.exports = new controllerComment();
