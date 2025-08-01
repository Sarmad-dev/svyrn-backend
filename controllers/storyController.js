import Story from "../models/Story.js";
import User from "../models/User.js";
import {
  getFileCategory,
  getMimeTypeFromBase64,
} from "../services/ImageUrlCreate.js";
import cloudinary from "../utils/cloudinary.js";
import NotificationHelper from "../utils/notificationHelper.js";
import { validationResult } from "express-validator";

// @desc    Create a new story
// @route   POST /api/stories
// @access  Private
export const createStory = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { content, privacy } = req.body;

    // Validate content array
    // if (!content || !Array.isArray(content) || content.length === 0) {
    //   return res.status(400).json({
    //     status: "error",
    //     message: "Story content is required and must be an array",
    //   });
    // }

    // if (content.length > 10) {
    //   return res.status(400).json({
    //     status: 'error',
    //     message: 'Maximum 10 items allowed per story'
    //   });
    // }

    // Validate each content item
    // for (const item of content) {
    //   if (!item.type || !["image", "video"].includes(item.type)) {
    //     return res.status(400).json({
    //       status: "error",
    //       message: "Each content item must have a valid type (image or video)",
    //     });
    //   }

    //   if (!item.url) {
    //     return res.status(400).json({
    //       status: "error",
    //       message: "Each content item must have a URL",
    //     });
    //   }

    //   if (item.type === "video" && item.duration && item.duration > 30) {
    //     return res.status(400).json({
    //       status: "error",
    //       message: "Video duration cannot exceed 30 seconds",
    //     });
    //   }
    // }

    if (!content.url) {
      return res.status(400).json({
        status: "error",
        message: "Each content item must have a an image or video",
      });
    }

    const mimeType = getMimeTypeFromBase64(content.url);
    const fileCategory = getFileCategory(mimeType);

    const results = await cloudinary.uploader.upload(content.url, {
      resource_type: fileCategory,
    });

    const publicId = results.public_id;

    if (fileCategory === "video" && results.duration > 30) {
      return res.status(400).json({
        status: "error",
        message: "Video duration cannot exceed 30 seconds",
      });
    }

    const mediaData = {
      type: fileCategory,
      url: results.secure_url,
      duration: results.duration,
      size: results.file_size,
    };

    if (fileCategory === "video") {
      // Generate thumbnail (e.g., at 3 seconds)
      const thumbnailUrl = cloudinary.url(`${publicId}.jpg`, {
        resource_type: "video",
        start_offset: 3,
        width: 400,
        height: 300,
        crop: "fill",
      });

      mediaData.thumbnail = thumbnailUrl;
    } else {
      mediaData.thumbnail = results.secure_url;
    }

    const story = await Story.create({
      author: req.user._id,
      content: {
        caption: content.caption,
        media: [mediaData],
      },
      privacy: privacy || "friends",
    });

    await story.populate("author", "name username profilePicture isVerified");

    res.status(201).json({
      status: "success",
      message: "Story created successfully",
      data: { story },
    });
  } catch (error) {
    console.log("Story Creation Error: ", error);
    res.status(500).json({
      status: "error",
      message: "Error creating story",
      error: error.message,
    });
  }
};

// @desc    Get stories for user's timeline (friends' stories)
// @route   GET /api/stories/timeline
// @access  Private
export const getTimelineStories = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    // Get user's following list
    const user = await User.findById(req.user.id);
    const followingIds = [...user.following, req.user.id]; // Include own stories

    // Get active stories from followed users
    const stories = await Story.find({
      author: { $in: followingIds },
      isActive: true,
      expiresAt: { $gt: new Date() }, // Not expired
      $or: [
        { privacy: "public" },
        {
          privacy: "friends",
          author: { $in: followingIds },
        },
        { author: req.user.id }, // Always show own stories
      ],
    })
      .populate("author", "name username profilePicture isVerified")
      .populate("viewers.user", "name username profilePicture")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    // Group stories by author
    const groupedStories = {};
    stories.forEach((story) => {
      const authorId = story.author._id.toString();
      if (!groupedStories[authorId]) {
        groupedStories[authorId] = {
          author: story.author,
          stories: [],
          hasUnviewed: false,
        };
      }

      const hasViewed = story.hasViewed(req.user.id);
      if (!hasViewed) {
        groupedStories[authorId].hasUnviewed = true;
      }

      groupedStories[authorId].stories.push({
        ...story.toObject(),
        hasViewed,
      });
    });

    // Convert to array and sort by latest story
    const timelineStories = Object.values(groupedStories).sort((a, b) => {
      // Prioritize unviewed stories
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;

      // Then sort by latest story
      const latestA = Math.max(...a.stories.map((s) => new Date(s.createdAt)));
      const latestB = Math.max(...b.stories.map((s) => new Date(s.createdAt)));
      return latestB - latestA;
    });

    const total = timelineStories.length;

    res.status(200).json({
      status: "success",
      data: {
        stories: timelineStories,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching timeline stories",
      error: error.message,
    });
  }
};

// @desc    Get specific story
// @route   GET /api/stories/:id
// @access  Private
export const getStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate("author", "firstName lastName profilePicture isVerified")
      .populate("viewers.user", "firstName lastName profilePicture");

    if (!story || !story.isActive || story.expiresAt < new Date()) {
      return res.status(404).json({
        status: "error",
        message: "Story not found or has expired",
      });
    }

    // Check privacy permissions
    const canView = await checkStoryViewPermission(story, req.user.id);
    if (!canView) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to view this story",
      });
    }

    // Add viewer if not already viewed
    if (!story.hasViewed(req.user.id)) {
      story.addViewer(req.user.id);
      await story.save();

      // Notify story author about the view (except for own stories)
      if (story.author._id.toString() !== req.user.id.toString()) {
        await NotificationHelper.createNotification({
          recipient: story.author._id,
          sender: req.user.id,
          type: "system",
          title: "Story View",
          message: "viewed your story",
          data: { storyId: story._id },
          priority: "low",
        });
      }
    }

    res.status(200).json({
      status: "success",
      data: {
        story: {
          ...story.toObject(),
          hasViewed: story.hasViewed(req.user.id),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching story",
      error: error.message,
    });
  }
};

// @desc    Get user's own stories
// @route   GET /api/stories/my-stories
// @access  Private
export const getMyStories = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const stories = await Story.find({
      author: req.user.id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .populate("viewers.user", "firstName lastName profilePicture")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Story.countDocuments({
      author: req.user.id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    res.status(200).json({
      status: "success",
      data: {
        stories,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching your stories",
      error: error.message,
    });
  }
};

// @desc    Delete a story
// @route   DELETE /api/stories/:id
// @access  Private
export const deleteStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);

    if (!story || !story.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Story not found",
      });
    }

    if (story.author.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You can only delete your own stories",
      });
    }

    story.isActive = false;
    await story.save();

    res.status(200).json({
      status: "success",
      message: "Story deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error deleting story",
      error: error.message,
    });
  }
};

// @desc    Get story viewers
// @route   GET /api/stories/:id/viewers
// @access  Private
export const getStoryViewers = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id).populate(
      "viewers.user",
      "firstName lastName profilePicture isVerified"
    );

    if (!story || !story.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Story not found",
      });
    }

    if (story.author.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You can only view your own story viewers",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        viewers: story.viewers.sort((a, b) => b.viewedAt - a.viewedAt),
        viewsCount: story.viewsCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching story viewers",
      error: error.message,
    });
  }
};

// Helper function to check story view permissions
export const checkStoryViewPermission = async (story, userId) => {
  if (story.author._id.toString() === userId.toString()) {
    return true; // Own story
  }

  if (story.privacy === "public") {
    return true;
  }

  if (story.privacy === "friends") {
    const user = await User.findById(userId);
    return user.following.includes(story.author._id);
  }

  if (story.privacy === "close_friends") {
    // For now, treat close_friends same as friends
    // In future, implement close friends list
    const user = await User.findById(userId);
    return user.following.includes(story.author._id);
  }

  return false;
};
