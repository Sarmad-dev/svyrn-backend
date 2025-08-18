import multer from "multer";
import sharp from "sharp";
import cloudinary from "./../utils/cloudinary.js";
import Group from "../models/Group.js";
import Page from "../models/Page.js";
import User from "../models/User.js";
import MediaCreation from "../services/MediaCreation.js";

// Configure multer for memory storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"), false);
    }
  },
});

// @desc    Upload and process image
// @route   POST /api/upload/image
// @access  Private
export const uploadImage = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        status: "error",
        message: "No image file provided",
      });
    }

    // Process image with Sharp
    const processedImage = await sharp(image)
      .resize(1200, 1200, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85,
        progressive: true,
      })
      .toBuffer();

    // In a real application, you would upload to cloud storage (AWS S3, Cloudinary, etc.)
    // For demo purposes, we'll return a mock URL

    res.status(200).json({
      status: "success",
      message: "Image uploaded successfully",
      data: {
        url: result.secure_url,
        size: processedImage.length,
        originalName: image,
        type: "image",
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error uploading image",
      error: error.message,
    });
  }
};

// @desc    Upload video
// @route   POST /api/upload/video
// @access  Private
export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "No video file provided",
      });
    }

    // In a real application, you would process and upload to cloud storage
    // For demo purposes, we'll return a mock URL
    const videoUrl = `https://api.example.com/uploads/videos/${Date.now()}-${
      req.file.originalname
    }`;

    res.status(200).json({
      status: "success",
      message: "Video uploaded successfully",
      data: {
        url: videoUrl,
        size: req.file.size,
        originalName: req.file.originalname,
        type: "video",
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error uploading video",
      error: error.message,
    });
  }
};

// @desc    Upload multiple files
// @route   POST /api/upload/multiple
// @access  Private
export const uploadMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No files provided",
      });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      let processedFile;
      let fileUrl;

      if (file.mimetype.startsWith("image/")) {
        // Process image
        processedFile = await sharp(file.buffer)
          .resize(1200, 1200, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({
            quality: 85,
            progressive: true,
          })
          .toBuffer();

        fileUrl = `https://api.example.com/uploads/images/${Date.now()}-${
          file.originalname
        }`;
      } else {
        // Video file
        fileUrl = `https://api.example.com/uploads/videos/${Date.now()}-${
          file.originalname
        }`;
      }

      uploadedFiles.push({
        url: fileUrl,
        type: file.mimetype.startsWith("image/") ? "image" : "video",
        size: processedFile ? processedFile.length : file.size,
        originalName: file.originalname,
      });
    }

    res.status(200).json({
      status: "success",
      message: "Files uploaded successfully",
      data: {
        files: uploadedFiles,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error uploading files",
      error: error.message,
    });
  }
};

// @desc    Upload profile picture
// @route   POST /api/upload/profile-picture?groupId=&pageId=&userId=
// @access  Private
export const uploadProfilePicture = async (req, res) => {
  try {
    const { image } = req.body;
    const { groupId, pageId, userId } = req.query;

    if (!image) {
      return res.status(400).json({
        status: "error",
        message: "No image file provided",
      });
    }

    const result = await cloudinary.uploader.upload(image, {
      resource_type: "image",
    });

    if (groupId && groupId !== "undefined") {
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          status: "error",
          message: "Group not found",
        });
      }

      group.profilePicture = result.secure_url;
      await group.save();
    }

    if (pageId && pageId !== "undefined") {
      const page = await Page.findById(pageId);
      if (!page) {
        return res.status(404).json({
          status: "error",
          message: "Page not found",
        });
      }
      page.profilePicture = result.secure_url;
      await page.save();
    }

    if (userId && userId !== "undefined") {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }
      user.profilePicture = result.secure_url;
      await user.save();
    }

    await new MediaCreation().createMedia({
      url: result.secure_url,
      type: "image",
      size: result.bytes,
      duration: 0,
      caption: "",
      author: userId,
    });

    res.status(200).json({
      status: "success",
      message: "Profile picture updated successfully",
      data: {
        url: result.secure_url,
        size: result.bytes,
      },
    });
  } catch (error) {
    console.error("ERROR: ", error);
    res.status(500).json({
      status: "error",
      message: "Error uploading profile picture",
      error: error.message,
    });
  }
};

// @desc    Upload cover photo
// @route   POST /api/upload/cover-photo?groupId=&pageId=&userId=
// @access  Private
export const uploadCoverPhoto = async (req, res) => {
  try {
    const { image } = req.body;
    const { groupId, pageId, userId } = req.query;

    if (!image) {
      return res.status(400).json({
        status: "error",
        message: "No image file provided",
      });
    }

    const result = await cloudinary.uploader.upload(image, {
      resource_type: "image",
    });

    if (groupId && groupId !== "undefined") {
      const group = await Group.findById(String(groupId));
      if (!group) {
        return res.status(404).json({
          status: "error",
          message: "Group not found",
        });
      }
      group.coverPhoto = result.secure_url;
      await group.save();
    }

    if (pageId && pageId !== "undefined") {
      const page = await Page.findById(String(pageId));
      if (!page) {
        return res.status(404).json({
          status: "error",
          message: "Page not found",
        });
      }
      page.coverPhoto = result.secure_url;
      await page.save();
    }

    if (userId && userId !== "undefined") {
      const user = await User.findById(String(userId));
      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }
      user.coverPhoto = result.secure_url;
      await user.save();
    }

    await new MediaCreation().createMedia({
      url: result.secure_url,
      type: "image",
      size: result.bytes,
      duration: 0,
      caption: "",
      author: userId,
    });

    res.status(200).json({
      status: "success",
      message: "Cover photo updated successfully",
      data: {
        url: result.secure_url,
        size: result.bytes,
      },
    });
  } catch (error) {
    console.error("ERROR: ", error);
    res.status(500).json({
      status: "error",
      message: "Error uploading cover photo",
      error: error.message,
    });
  }
};

// @desc    Upload image to Cloudinary
// @route   POST /api/upload/cloudinary
// @access  Private
export const uploadToCloudinary = async (req, res) => {
  try {
    const { image, folder = "general" } = req.body;

    if (!image) {
      return res.status(400).json({
        status: "error",
        message: "Image data is required",
      });
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${image}`,
      {
        folder: folder,
        resource_type: "image",
        transformation: [
          { width: 800, height: 600, crop: "limit" }, // Limit dimensions
          { quality: "auto:good" }, // Optimize quality
        ],
      }
    );

    res.status(200).json({
      status: "success",
      message: "Image uploaded successfully",
      data: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        size: uploadResult.bytes,
      },
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to upload image",
      error: error.message,
    });
  }
};

// @desc    Delete image from Cloudinary
// @route   DELETE /api/upload/cloudinary/:publicId
// @access  Private
export const deleteFromCloudinary = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        status: "error",
        message: "Public ID is required",
      });
    }

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === "ok") {
      res.status(200).json({
        status: "success",
        message: "Image deleted successfully",
      });
    } else {
      res.status(400).json({
        status: "error",
        message: "Failed to delete image",
      });
    }
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete image",
      error: error.message,
    });
  }
};
