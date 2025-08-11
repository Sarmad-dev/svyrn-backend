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

    const { mediaItems, privacy } = req.body;

    // Validate mediaItems array
    if (!mediaItems || !Array.isArray(mediaItems) || mediaItems.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Story media items are required and must be an array",
      });
    }

    if (mediaItems.length > 10) {
      return res.status(400).json({
        status: 'error',
        message: 'Maximum 10 media items allowed per story'
      });
    }

    // Validate each media item
    for (const item of mediaItems) {
      if (!item.url) {
        return res.status(400).json({
          status: "error",
          message: "Each media item must have a URL",
        });
      }
    }

    const mediaData = [];
    
    // Process each media item
    for (let i = 0; i < mediaItems.length; i++) {
      const item = mediaItems[i];
      
      const mimeType = getMimeTypeFromBase64(item.url);
      const fileCategory = getFileCategory(mimeType);

      const result = await cloudinary.uploader.upload(item.url, {
        resource_type: fileCategory,
      });

      const publicId = result.public_id;

      if (fileCategory === "video" && result.duration > 30) {
        return res.status(400).json({
          status: "error",
          message: "Video duration cannot exceed 30 seconds",
        });
      }

      const mediaItem = {
        type: fileCategory,
        url: result.secure_url,
        caption: item.caption || "",
        duration: fileCategory === "video" ? result.duration : 0,
        size: result.file_size,
        order: i,
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

        mediaItem.thumbnail = thumbnailUrl;
      } else {
        mediaItem.thumbnail = result.secure_url;
      }

      mediaData.push(mediaItem);
    }

    const story = await Story.create({
      author: req.user._id,
      content: {
        caption: mediaItems[0]?.caption || "", // Use first item's caption as story caption
        media: mediaData,
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
      .populate("reactions.user", "name username profilePicture")
      .populate("comments.user", "name username profilePicture")
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

      // Add reaction and comment counts to each story
      const storyWithCounts = {
        ...story.toObject(),
        hasViewed,
        reactionsCount: story.reactionsCount,
        commentsCount: story.commentsCount,
        viewsCount: story.viewsCount,
      };

      groupedStories[authorId].stories.push(storyWithCounts);
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
      .populate("author", "name username profilePicture isVerified")
      .populate("viewers.user", "name username profilePicture")
      .populate("reactions.user", "name username profilePicture")
      .populate("comments.user", "name username profilePicture");

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

    // Add counts to the story
    const storyWithCounts = {
      ...story.toObject(),
      hasViewed: story.hasViewed(req.user.id),
      reactionsCount: story.reactionsCount,
      commentsCount: story.commentsCount,
      viewsCount: story.viewsCount,
    };

    res.status(200).json({
      status: "success",
      data: {
        story: storyWithCounts,
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
    const skip = (Number(page) - 1) * Number(limit);

    const stories = await Story.find({
      author: req.user.id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .populate("viewers.user", "name username profilePicture")
      .populate("reactions.user", "name username profilePicture")
      .populate("comments.user", "name username profilePicture")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    // Add counts to each story
    const storiesWithCounts = stories.map(story => ({
      ...story.toObject(),
      reactionsCount: story.reactionsCount,
      commentsCount: story.commentsCount,
      viewsCount: story.viewsCount,
    }));

    const total = await Story.countDocuments({
      author: req.user.id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    res.status(200).json({
      status: "success",
      data: {
        stories: storiesWithCounts,
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

// @desc    React to a story
// @route   POST /api/stories/:id/react
// @access  Private
export const addReaction = async (req, res) => {
  try {
    const { type } = req.body;
    const validTypes = ["like", "love", "haha", "wow", "sad", "angry"];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid reaction type",
      });
    }

    const story = await Story.findById(req.params.id);
    if (!story || !story.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Story not found",
      });
    }

    // Check if user can view this story
    const canView = await checkStoryViewPermission(story, req.user.id);
    if (!canView) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to react to this story",
      });
    }

    // Toggle reaction
    const result = story.toggleReaction(req.user.id, type);
    await story.save();

    // Send notification to story author (except for own stories)
    if (story.author.toString() !== req.user.id.toString() && result.action === "added") {
      await NotificationHelper.createNotification({
        recipient: story.author,
        sender: req.user.id,
        type: "reaction",
        title: "Story Reaction",
        message: `reacted ${type} to your story`,
        data: { storyId: story._id, reactionType: type },
        priority: "medium",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Reaction updated successfully",
      data: {
        action: result.action,
        reactionType: result.type,
        reactionsCount: story.reactionsCount,
        userReaction: story.getUserReaction(req.user.id),
      },
    });
  } catch (error) {
    console.error("Error adding reaction:", error);
    res.status(500).json({
      status: "error",
      message: "Error updating reaction",
      error: error.message,
    });
  }
};

// @desc    Add a comment to a story
// @route   POST /api/stories/:id/comment
// @access  Private
export const addComment = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Comment text is required",
      });
    }

    if (text.length > 200) {
      return res.status(400).json({
        status: "error",
        message: "Comment cannot exceed 200 characters",
      });
    }

    const story = await Story.findById(req.params.id);
    if (!story || !story.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Story not found",
      });
    }

    // Check if user can view this story
    const canView = await checkStoryViewPermission(story, req.user.id);
    if (!canView) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to comment on this story",
      });
    }

    // Add comment
    story.addComment(req.user.id, text.trim());
    await story.save();

    // Populate user info for the new comment
    await story.populate("comments.user", "name username profilePicture");

    // Send notification to story author (except for own stories)
    if (story.author.toString() !== req.user.id.toString()) {
      await NotificationHelper.createNotification({
        recipient: story.author,
        sender: req.user.id,
        type: "comment",
        title: "Story Comment",
        message: `commented on your story`,
        data: { storyId: story._id, commentText: text },
        priority: "medium",
      });
    }

    // Get the last comment (the one we just added)
    const newComment = story.comments[story.comments.length - 1];

    res.status(201).json({
      status: "success",
      message: "Comment added successfully",
      data: {
        comment: newComment,
        commentsCount: story.commentsCount,
      },
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      status: "error",
      message: "Error adding comment",
      error: error.message,
    });
  }
};

// @desc    Get story interactions (reactions and comments) - only for story author
// @route   GET /api/stories/:id/interactions
// @access  Private
export const getStoryInteractions = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate("reactions.user", "name username profilePicture")
      .populate("comments.user", "name username profilePicture");

    if (!story || !story.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Story not found",
      });
    }

    // Only story author can see interactions
    if (story.author.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You can only view interactions for your own stories",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        reactions: story.reactions,
        comments: story.comments,
        reactionsCount: story.reactionsCount,
        commentsCount: story.commentsCount,
        viewsCount: story.viewsCount,
      },
    });
  } catch (error) {
    console.error("Error fetching story interactions:", error);
    res.status(500).json({
      status: "error",
      message: "Error fetching story interactions",
      error: error.message,
    });
  }
};
