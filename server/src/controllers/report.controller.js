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
            throw new BadRequestError('Post ID va ly do bao cao bat buoc');
        }

        const post = await modelPost.findById(postId);
        if (!post) {
            throw new BadRequestError('Bai viet khong ton tai');
        }

        const user = await modelUser.findById(id);
        if (!user) {
            throw new BadRequestError('Nguoi dung khong hop le');
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

        new Created({ message: 'Bao cao bai viet thanh cong', metadata: report }).send(res);
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

        new OK({ message: 'Lay danh sach bao cao thanh cong', metadata }).send(res);
    }

    async updateReport(req, res) {
        const { id, status, note, postAction = 'none' } = req.body;
        if (!id || !status) {
            throw new BadRequestError('Id bao cao va trang thai bat buoc');
        }

        if (!['pending', 'resolved', 'rejected'].includes(status)) {
            throw new BadRequestError('Trang thai khong hop le');
        }

        if (!['none', 'hide_post', 'takedown_post'].includes(postAction)) {
            throw new BadRequestError('Hanh dong xu ly bai viet khong hop le');
        }

        const report = await modelReport.findById(id);
        if (!report) {
            throw new BadRequestError('Bao cao khong ton tai');
        }

        let postStatusBefore = report.postStatusBefore || '';
        let postStatusAfter = report.postStatusAfter || '';

        if (status === 'resolved' && postAction !== 'none') {
            const post = await modelPost.findById(report.postId);
            if (!post) {
                throw new BadRequestError('Bai viet duoc bao cao khong ton tai');
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

        new OK({ message: 'Cap nhat bao cao thanh cong', metadata: updated }).send(res);
    }
}

module.exports = new controllerReport();
