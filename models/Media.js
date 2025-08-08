import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['image', 'video'],
        required: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
    },
    page: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Page',
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    url: String,
    caption: String,
    size: Number,
    duration: Number,
})

const Media = mongoose.model("Media", mediaSchema);
export default Media;
