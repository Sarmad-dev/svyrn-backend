import Reel from "../models/Reel.js";
import ReelComment from "../models/ReelComment.js";
import ReelAnalytics from "../models/ReelAnalytics.js";
import ReelReport from "../models/ReelReport.js";
import User from "../models/User.js";
import { validationResult } from "express-validator";
import cloudinary from "../utils/cloudinary.js";
import { getMimeTypeFromBase64, getFileCategory } from "../services/ImageUrlCreate.js";
import { extractHashtags, extractMentions, extractUrls } from "../utils/contentAnalysis.js";

// Create a new reel
export const createReel = async (req, res) => {
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

    const { 
      mediaUrl, 
      mediaType, 
      caption, 
      privacy, 
      location, 
      tags, 
      hashtags, 
      mentions 
    } = req.body;

    // Handle base64 media upload
    let mediaData = {};
    if (mediaUrl && mediaUrl.startsWith('data:')) {
      const mimeType = getMimeTypeFromBase64(mediaUrl);
      const fileCategory = getFileCategory(mimeType);

      const result = await cloudinary.uploader.upload(mediaUrl, {
        resource_type: fileCategory,
      });

      mediaData = {
        type: fileCategory,
        url: result.secure_url,
        thumbnail: result.secure_url,
        size: result.bytes,
        duration: fileCategory === "video" ? result.duration : 0,
        dimensions: {
          width: result.width,
          height: result.height,
        },
      };
    } else {
      // Handle direct URL (for testing)
      mediaData = {
        type: mediaType,
        url: mediaUrl,
        thumbnail: mediaUrl,
      };
    }

    // Extract hashtags and mentions from caption if not provided
    const extractedHashtags = hashtags || extractHashtags(caption || '');
    const extractedMentions = mentions || extractMentions(caption || '');
    const extractedUrls = extractUrls(caption || '');

    const reelData = {
      author: req.user._id,
      media: mediaData,
      caption: caption || "",
      privacy: privacy || "public",
      location: location || "",
      tags: tags || [],
      hashtags: extractedHashtags,
      mentions: extractedMentions,
      reactions: [],
      comments: [],
      shares: [],
      saves: [],
      views: [],
      trending: { score: 0, category: "general" },
      isActive: true,
      isArchived: false,
    };

    const reel = await Reel.create(reelData);
    await reel.populate("author", "name username profilePicture isVerified");

    // Create analytics entry
    await ReelAnalytics.create({
      reel: reel._id,
      author: req.user._id,
    });

    // Update user's reel count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { reelCount: 1 }
    });

    res.status(201).json({
      status: "success",
      message: "Reel created successfully",
      data: { reel },
    });
  } catch (error) {
    console.error("Error creating reel:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all reels with pagination and filters
export const getReels = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      privacy,
      author,
      trending,
      sortBy = "createdAt",
      sortOrder = "desc",
      hashtag,
      search,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?._id;

    // Build query
    let query = { isDeleted: false, isArchived: false };

    if (category) query.category = category;
    if (privacy) query.privacy = privacy;
    if (author) query.author = author;
    if (hashtag) query.hashtags = hashtag;
    if (search) {
      query.$or = [
        { caption: { $regex: search, $options: "i" } },
        { hashtags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Handle privacy for non-authenticated users
    if (!userId) {
      query.privacy = "public";
    } else if (privacy !== "public") {
      // For private/friends/followers content, check user permissions
      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }
    }

    // Handle trending filter
    if (trending === "true") {
      query["trending.isTrending"] = true;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query
    const reels = await Reel.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "name profilePicture username isVerified")
      .populate("comments", "content author createdAt")
      .populate("reactions.user", "name profilePicture _id")
      .populate("saves.user", "name profilePicture _id");

    // Get total count for pagination
    const total = await Reel.countDocuments(query);

    // Add user interaction data if authenticated
    if (userId) {
      for (let reel of reels) {
        reel = reel.toObject();
        reel.hasUserReacted = reel.reactions.some(
          (reaction) => reaction.user._id.toString() === userId
        );
        reel.userReactionType = reel.reactions.find(
          (reaction) => reaction.user._id.toString() === userId
        )?.type || null;
        reel.hasUserSaved = await Reel.findById(reel._id).then((r) =>
          r.hasUserSaved(userId)
        );
      }
    }

    console.log("Reels: ", reels)

    res.status(200).json({
      success: true,
      message: "Reels retrieved successfully",
      data: {
        reels,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting reels:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get trending reels
export const getTrendingReels = async (req, res) => {
  try {
    const { limit = 20, category } = req.query;
    const userId = req.user?._id;

    const reels = await Reel.getTrendingReels(parseInt(limit), category);

    // Add user interaction data if authenticated
    if (userId) {
      for (let reel of reels) {
        reel = reel.toObject();
        reel.hasUserReacted = reel.reactions.some(
          (reaction) => reaction.user._id.toString() === userId
        );
        reel.userReactionType = reel.reactions.find(
          (reaction) => reaction.user._id.toString() === userId
        )?.type || null;
        reel.hasUserSaved = await Reel.findById(reel._id).then((r) =>
          r.hasUserSaved(userId)
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Trending reels retrieved successfully",
      data: reels,
    });
  } catch (error) {
    console.error("Error getting trending reels:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get user's feed reels
export const getUserFeed = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get user's following list
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const followingIds = user.following || [];
    const reels = await Reel.getUserFeed(userId, followingIds, parseInt(limit), skip);

    // Get total count for pagination
    const total = await Reel.countDocuments({
      $or: [
        { author: { $in: followingIds } },
        { privacy: "public" },
      ],
      isDeleted: false,
      isArchived: false,
    });

    // Add user interaction data
    for (let reel of reels) {
      reel = reel.toObject();
      reel.hasUserReacted = reel.reactions.some(
        (reaction) => reaction.user._id.toString() === userId
      );
      reel.userReactionType = reel.reactions.find(
        (reaction) => reaction.user._id.toString() === userId
      )?.type || null;
      reel.hasUserSaved = await Reel.findById(reel._id).then((r) =>
        r.hasUserSaved(userId)
      );
    }

    res.status(200).json({
      success: true,
      message: "User feed retrieved successfully",
      data: {
        reels,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting user feed:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get a single reel by ID
export const getReelById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const reel = await Reel.findById(id)
      .populate("author", "name profilePicture username isVerified")
      .populate("comments", "content author createdAt")
      .populate("reactions.user", "name profilePicture")
      .populate("tags", "name profilePicture username")
      .populate("mentions", "name profilePicture username");

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (reel.isDeleted || reel.isArchived) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    // Check privacy settings
    if (reel.privacy === "private" && (!userId || reel.author._id.toString() !== userId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (reel.privacy === "friends" && userId) {
      const user = await User.findById(userId);
      if (!user.friends.includes(reel.author._id)) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    if (reel.privacy === "followers" && userId) {
      const user = await User.findById(userId);
      if (!user.following.includes(reel.author._id)) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    // Add user interaction data if authenticated
    if (userId) {
      reel.hasUserReacted = reel.hasUserReacted(userId);
      reel.userReactionType = reel.getUserReactionType(userId);
      reel.hasUserSaved = reel.hasUserSaved(userId);
      reel.hasUserViewed = reel.hasUserViewed(userId);
    }

    // Increment view count and add view record
    if (userId) {
      await reel.addView(userId);
      
      // Update analytics
      const analytics = await ReelAnalytics.findOne({ reel: reel._id });
      if (analytics) {
        await analytics.addView({
          device: req.headers["user-agent"]?.includes("Mobile") ? "mobile" : "desktop",
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Reel retrieved successfully",
      data: reel,
    });
  } catch (error) {
    console.error("Error getting reel:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update a reel
export const updateReel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    // Check if user is the author
    if (reel.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own reels",
      });
    }

    // Check if reel is deleted or archived
    if (reel.isDeleted || reel.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Cannot edit deleted or archived reel",
      });
    }

    // Extract hashtags and mentions from caption if updated
    if (updateData.caption) {
      const extractedHashtags = extractHashtags(updateData.caption);
      const extractedMentions = extractMentions(updateData.caption);
      updateData.hashtags = extractedHashtags;
      updateData.mentions = extractedMentions;
    }

    // Store edit history
    if (updateData.caption && updateData.caption !== reel.caption) {
      updateData.editHistory = [
        ...reel.editHistory,
        {
          content: reel.caption,
          editedAt: new Date(),
        },
      ];
      updateData.isEdited = true;
    }

    const updatedReel = await Reel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("author", "name profilePicture username isVerified");

    res.status(200).json({
      success: true,
      message: "Reel updated successfully",
      data: updatedReel,
    });
  } catch (error) {
    console.error("Error updating reel:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete a reel (soft delete)
export const deleteReel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    // Check if user is the author
    if (reel.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own reels",
      });
    }

    // Soft delete
    reel.isDeleted = true;
    reel.deletedAt = new Date();
    await reel.save();

    res.status(200).json({
      success: true,
      message: "Reel deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting reel:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Archive/Unarchive a reel
export const toggleArchiveReel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    // Check if user is the author
    if (reel.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only archive your own reels",
      });
    }

    reel.isArchived = !reel.isArchived;
    await reel.save();

    res.status(200).json({
      success: true,
      message: `Reel ${reel.isArchived ? "archived" : "unarchived"} successfully`,
      data: { isArchived: reel.isArchived },
    });
  } catch (error) {
    console.error("Error toggling reel archive:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Add/Update reaction to a reel
export const toggleReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reactionType = "like" } = req.body;
    const userId = req.user._id;

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (reel.isDeleted || reel.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Cannot react to deleted or archived reel",
      });
    }

    // Check if user has already reacted
    const hasReacted = reel.hasUserReacted(userId);
    const currentReactionType = reel.getUserReactionType(userId);

    if (hasReacted && currentReactionType === reactionType) {
      // Remove reaction
      await reel.removeReaction(userId);
      
      // Update analytics
      const analytics = await ReelAnalytics.findOne({ reel: reel._id });
      if (analytics) {
        await analytics.addEngagement("like", -1);
      }

      res.status(200).json({
        success: true,
        message: "Reaction removed successfully",
        data: { hasReacted: false, reactionType: null },
      });
    } else {
      // Add or update reaction
      await reel.addReaction(userId, reactionType);
      
      // Update analytics
      const analytics = await ReelAnalytics.findOne({ reel: reel._id });
      if (analytics) {
        if (!hasReacted) {
          await analytics.addEngagement("like", 1);
        }
      }

      res.status(200).json({
        success: true,
        message: "Reaction added successfully",
        data: { hasReacted: true, reactionType },
      });
    }
  } catch (error) {
    console.error("Error toggling reaction:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Save/Unsave a reel
export const toggleSaveReel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (reel.isDeleted || reel.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Cannot save deleted or archived reel",
      });
    }

    const hasSaved = reel.hasUserSaved(userId);

    if (hasSaved) {
      await reel.removeSave(userId);
      
      // Update analytics
      const analytics = await ReelAnalytics.findOne({ reel: reel._id });
      if (analytics) {
        await analytics.addEngagement("save", -1);
      }

      res.status(200).json({
        success: true,
        message: "Reel unsaved successfully",
        data: { hasSaved: false },
      });
    } else {
      await reel.addSave(userId);
      
      // Update analytics
      const analytics = await ReelAnalytics.findOne({ reel: reel._id });
      if (analytics) {
        await analytics.addEngagement("save", 1);
      }

      res.status(200).json({
        success: true,
        message: "Reel saved successfully",
        data: { hasSaved: true },
      });
    }
  } catch (error) {
    console.error("Error toggling save:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Share a reel
export const shareReel = async (req, res) => {
  try {
    const { id } = req.params;
    const { caption = "" } = req.body;
    const userId = req.user.id;

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (reel.isDeleted || reel.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Cannot share deleted or archived reel",
      });
    }

    await reel.addShare(userId, caption);
    
    // Update analytics
    const analytics = await ReelAnalytics.findOne({ reel: reel._id });
    if (analytics) {
      await analytics.addEngagement("share", 1);
    }

    res.status(200).json({
      success: true,
      message: "Reel shared successfully",
    });
  } catch (error) {
    console.error("Error sharing reel:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get user's saved reels
export const getSavedReels = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reels = await Reel.find({
      "saves.user": userId,
      isDeleted: false,
      isArchived: false,
    })
      .sort({ "saves.savedAt": -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "name profilePicture username isVerified")
      .populate("comments", "content author createdAt")
      .populate("reactions.user", "name profilePicture");

    // Get total count for pagination
    const total = await Reel.countDocuments({
      "saves.user": userId,
      isDeleted: false,
      isArchived: false,
    });

    // Add user interaction data
    for (let reel of reels) {
      reel = reel.toObject();
      reel.hasUserReacted = reel.reactions.some(
        (reaction) => reaction.user._id.toString() === userId
      );
      reel.userReactionType = reel.reactions.find(
        (reaction) => reaction.user._id.toString() === userId
      )?.type || null;
      reel.hasUserSaved = true; // User has saved this reel
    }

    res.status(200).json({
      success: true,
      message: "Saved reels retrieved successfully",
      data: {
        reels,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting saved reels:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get user's own reels
export const getUserReels = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?.id;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Check if user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Build query based on privacy and relationship
    let query = {
      author: targetUserId,
      isDeleted: false,
      isArchived: false,
    };

    // If viewing own reels or public reels, show all
    if (currentUserId === targetUserId) {
      // Show all reels (including private ones)
    } else {
      // For other users, only show public reels or reels based on relationship
      const currentUser = await User.findById(currentUserId);
      if (currentUser) {
        if (currentUser.friends.includes(targetUserId)) {
          query.$or = [{ privacy: "public" }, { privacy: "friends" }];
        } else if (currentUser.following.includes(targetUserId)) {
          query.$or = [{ privacy: "public" }, { privacy: "followers" }];
        } else {
          query.privacy = "public";
        }
      } else {
        query.privacy = "public";
      }
    }

    const reels = await Reel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "name profilePicture username isVerified")
      .populate("comments", "content author createdAt")
      .populate("reactions.user", "name profilePicture");

    // Get total count for pagination
    const total = await Reel.countDocuments(query);

    // Add user interaction data if authenticated
    if (currentUserId) {
      for (let reel of reels) {
        reel = reel.toObject();
        reel.hasUserReacted = reel.reactions.some(
          (reaction) => reaction.user._id.toString() === currentUserId
        );
        reel.userReactionType = reel.reactions.find(
          (reaction) => reaction.user._id.toString() === currentUserId
        )?.type || null;
        reel.hasUserSaved = await Reel.findById(reel._id).then((r) =>
          r.hasUserSaved(currentUserId)
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "User reels retrieved successfully",
      data: {
        reels,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting user reels:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get reel analytics
export const getReelAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    // Check if user is the author
    if (reel.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only view analytics for your own reels",
      });
    }

    const analytics = await ReelAnalytics.findOne({ reel: id });
    if (!analytics) {
      return res.status(404).json({
        success: false,
        message: "Analytics not found for this reel",
      });
    }

    res.status(200).json({
      success: true,
      message: "Reel analytics retrieved successfully",
      data: analytics,
    });
  } catch (error) {
    console.error("Error getting reel analytics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get user's analytics summary
export const getUserAnalyticsSummary = async (req, res) => {
  try {
    const { timeframe = "7d" } = req.query;
    const userId = req.user.id;

    const summary = await ReelAnalytics.getAnalyticsSummary(userId, timeframe);

    res.status(200).json({
      success: true,
      message: "Analytics summary retrieved successfully",
      data: summary[0] || {
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalSaves: 0,
        avgEngagementRate: 0,
        totalReels: 0,
      },
    });
  } catch (error) {
    console.error("Error getting analytics summary:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Report a reel
export const reportReel = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, details } = req.body;
    const userId = req.user.id;

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    // Check if user has already reported this reel
    const existingReport = await ReelReport.findOne({
      reel: id,
      reporter: userId,
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: "You have already reported this reel",
      });
    }

    // Create report
    const report = new ReelReport({
      reel: id,
      reporter: userId,
      reason,
      details,
    });

    await report.save();

    res.status(200).json({
      success: true,
      message: "Reel reported successfully",
    });
  } catch (error) {
    console.error("Error reporting reel:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
