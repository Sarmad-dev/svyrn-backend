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

  async createMedia({ url, type, duration, size, caption, post, author }) {

    const media = new Media({
      type,
      post,
      author,
      url,
      caption: caption || "",
      size,
      duration: type === "video" ? duration : 0,
    });

    await media.save();
    this.media.push(media);
    return media;
  }
}

export default MediaCreation;
