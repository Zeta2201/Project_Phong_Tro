const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const modelFavourite = new Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, require: true, ref: 'user' },
        postId: { type: mongoose.Schema.Types.ObjectId, require: true, ref: 'posts' },
    },
    {
        timestamps: true,
    },
);

module.exports = mongoose.model('favourite', modelFavourite);
