const modelReport = require('../models/report.model');
const modelUser = require('../models/users.model');
const modelPost = require('../models/post.model');
const { OK, Created } = require('../core/success.response');
const { BadRequestError } = require('../core/error.response');
const { notifyAdmins } = require('../services/notification.service');

class controllerReport {
    async createReport(req, res) {
        const { id } = req.user;
        const { postId, reason, details } = req.body;

        if (!postId || !reason) {
            throw new BadRequestError('Post ID va lý do báo cáo là bắt buộc');
        }

        const post = await modelPost.findById(postId);
        if (!post) {
            throw new BadRequestError('Bài viết không tồn tại');
        }

        const user = await modelUser.findById(id);
        if (!user) {
            throw new BadRequestError('Người dùng không hợp lệ');
        }

        const report = await modelReport.create({
            postId,
            reporterId: id,
            reporterName: user.fullName,
            reporterEmail: user.email,
            reason,
            details: details || '',
        });
        await notifyAdmins(
            'Có báo cáo mới',
            `${user.fullName || 'Người dùng'} vừa báo cáo một bài đăng`,
            'report',
            '/admin?type=reports',
            { reportId: report._id, postId },
        );

        new Created({ message: 'Báo cáo bài viết thành công', metadata: report }).send(res);
    }

    async getReports(req, res) {
        const { status, q } = req.query;
        const filter = {};

        if (status) {
            filter.status = status;
        }

        if (q) {
            filter.$or = [
                { reporterName: { $regex: q, $options: 'i' } },
                { reporterEmail: { $regex: q, $options: 'i' } },
                { reason: { $regex: q, $options: 'i' } },
                { details: { $regex: q, $options: 'i' } },
            ];
        }

        const reports = await modelReport
            .find(filter)
            .sort({ createdAt: -1 })
            .populate('reporterId', 'fullName email')
            .populate('postId', 'title status availabilityStatus location price');

        const metadata = reports.map((report) => ({
            ...report._doc,
            reporter: report.reporterId,
            post: report.postId,
        }));

        new OK({ message: 'Lấy danh sách báo cáo thành công', metadata }).send(res);
    }

    async updateReport(req, res) {
        const { id, status, note, postAction = 'none' } = req.body;
        if (!id || !status) {
            throw new BadRequestError('Id báo cáo và trạng thái là bắt buộc');
        }

        if (!['pending', 'resolved', 'rejected'].includes(status)) {
            throw new BadRequestError('Trạng thái không hợp lệ');
        }

        if (!['none', 'hide_post', 'takedown_post'].includes(postAction)) {
            throw new BadRequestError('Hành động xử lý bài viết không hợp lệ');
        }

        const report = await modelReport.findById(id);
        if (!report) {
            throw new BadRequestError('Báo cáo không tồn tại');
        }

        let postStatusBefore = report.postStatusBefore || '';
        let postStatusAfter = report.postStatusAfter || '';

        if (status === 'resolved' && postAction !== 'none') {
            const post = await modelPost.findById(report.postId);
            if (!post) {
                throw new BadRequestError('Bài viết được báo cáo không tồn tại');
            }

            postStatusBefore = post.status;
            post.status = postAction === 'hide_post' ? 'inactive' : 'rejected';
            postStatusAfter = post.status;
            await post.save();
        }

        const updated = await modelReport.findByIdAndUpdate(
            id,
            {
                status,
                note: note || report.note,
                handledBy: req.user.id,
                actionTaken: status === 'resolved' ? postAction : report.actionTaken,
                actionAt: status === 'resolved' ? new Date() : report.actionAt,
                postStatusBefore,
                postStatusAfter,
            },
            { new: true },
        );

        new OK({ message: 'Cập nhật báo cáo thành công', metadata: updated }).send(res);
    }
}

module.exports = new controllerReport();
