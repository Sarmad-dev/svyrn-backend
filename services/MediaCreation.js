import cloudinary from "../utils/cloudinary.js";
import Media from "../models/Media.js";
import {
  getFileCategory,
  getMimeTypeFromBase64,
} from "../services/ImageUrlCreate.js";

class MediaCreation {
  constructor() {
    this.media = [];
  }

  async createMedia({ base64, caption, post, page, group, author }) {
    const mimeType = getMimeTypeFromBase64(base64);
    const fileCategory = getFileCategory(mimeType);

    const result = await cloudinary.uploader.upload(base64, {
      resource_type: fileCategory,
    });
    const media = new Media({
      type: fileCategory,
      post: post,
      page: page,
      group: group,
      author: author,
      url: result.secure_url,
      caption: caption || "",
      size: result.bytes,
      duration: fileCategory === "video" ? result.duration : 0,
    });

    await media.save();
    this.media.push(media);
    return media;
  }
}

export default MediaCreation;
