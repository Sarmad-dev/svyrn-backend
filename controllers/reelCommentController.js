import ReelComment from "../models/ReelComment.js";
import Reel from "../models/Reel.js";
import ReelAnalytics from "../models/ReelAnalytics.js";
import User from "../models/User.js";
import { extractHashtags, extractMentions } from "../utils/contentAnalysis.js";

// Create a new comment on a reel
export const createComment = async (req, res) => {
  try {
    const { reelId } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 1000 characters",
      });
    }

    // Check if reel exists and is accessible
    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (reel.isDeleted || reel.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Cannot comment on deleted or archived reel",
      });
    }

    // Check privacy settings for the reel
    if (reel.privacy === "private" && reel.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check if parent comment exists (for replies)
    let parentComment = null;
    if (parentCommentId) {
      parentComment = await ReelComment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: "Parent comment not found",
        });
      }
      if (parentComment.reel.toString() !== reelId) {
        return res.status(400).json({
          success: false,
          message: "Parent comment does not belong to this reel",
        });
      }
    }

    // Extract hashtags and mentions
    const hashtags = extractHashtags(content);
    const mentions = extractMentions(content);

    // Create new comment
    const newComment = new ReelComment({
      reel: reelId,
      author: userId,
      content: content.trim(),
      parentComment: parentCommentId || null,
      hashtags,
      mentions,
    });

    const savedComment = await newComment.save();

    // Add comment to reel
    await reel.addComment(savedComment._id);

    // Update analytics
    const analytics = await ReelAnalytics.findOne({ reel: reelId });
    if (analytics) {
      await analytics.addEngagement("comment", 1);
    }

    // If this is a reply, add it to parent comment
    if (parentCommentId && parentComment) {
      await parentComment.addReply(savedComment._id);
    }

    // Populate author information
    await savedComment.populate("author", "name profilePicture username isVerified");

    res.status(201).json({
      success: true,
      message: "Comment created successfully",
      data: savedComment,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get comments for a reel
export const getReelComments = async (req, res) => {
  try {
    const { reelId } = req.params;
    const { cursor, limit = 20, includeReplies = false } = req.query;
    const userId = req.user?.id;

    // Check if reel exists and is accessible
    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (reel.isDeleted || reel.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Cannot view comments on deleted or archived reel",
      });
    }

    // Check privacy settings
    if (reel.privacy === "private" && (!userId || reel.author.toString() !== userId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Build query for cursor-based pagination
    let query = {
      reel: reelId,
      parentComment: null, // Only top-level comments
      isDeleted: false,
      isHidden: false,
      moderationStatus: "approved",
    };

    // Add cursor condition if provided
    if (cursor) {
      const cursorComment = await ReelComment.findById(cursor);
      if (cursorComment) {
        query.createdAt = { $lt: cursorComment.createdAt };
      }
    }

    // Get comments with cursor-based pagination
    const comments = await ReelComment.find(query)
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(parseInt(limit) + 1) // Get one extra to check if there are more
      .populate("author", "name profilePicture username isVerified")
      .populate("reactions.user", "name profilePicture");

    // Check if there are more comments
    const hasNextPage = comments.length > parseInt(limit);
    const actualComments = hasNextPage ? comments.slice(0, parseInt(limit)) : comments;
    
    // Get the next cursor (ID of the last comment)
    const nextCursor = hasNextPage && actualComments.length > 0 
      ? actualComments[actualComments.length - 1]._id.toString() 
      : null;

    // Add user interaction data if authenticated
    if (userId) {
      for (let comment of actualComments) {
        comment = comment.toObject();
        comment.hasUserReacted = comment.reactions.some(
          (reaction) => reaction.user._id.toString() === userId
        );
        comment.userReactionType = comment.reactions.find(
          (reaction) => reaction.user._id.toString() === userId
        )?.type || null;
      }
    }

    res.status(200).json({
      success: true,
      message: "Comments retrieved successfully",
      data: {
        comments: actualComments,
        pagination: {
          hasNextPage,
          nextCursor,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting comments:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get replies for a comment
export const getCommentReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?.id;

    // Check if comment exists
    const comment = await ReelComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if reel is accessible
    const reel = await Reel.findById(comment.reel);
    if (!reel || reel.isDeleted || reel.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Cannot view replies for this comment",
      });
    }

    // Check privacy settings
    if (reel.privacy === "private" && (!userId || reel.author.toString() !== userId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Get replies
    const replies = await ReelComment.getCommentReplies(
      commentId,
      parseInt(limit),
      skip
    );

    // Get total count for pagination
    const total = await ReelComment.countDocuments({
      parentComment: commentId,
      isDeleted: false,
      isHidden: false,
      moderationStatus: "approved",
    });

    // Add user interaction data if authenticated
    if (userId) {
      for (let reply of replies) {
        reply = reply.toObject();
        reply.hasUserReacted = reply.reactions.some(
          (reaction) => reaction.user._id.toString() === userId
        );
        reply.userReactionType = reply.reactions.find(
          (reaction) => reaction.user._id.toString() === userId
        )?.type || null;
      }
    }

    res.status(200).json({
      success: true,
      message: "Replies retrieved successfully",
      data: {
        replies,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting replies:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update a comment
export const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 1000 characters",
      });
    }

    const comment = await ReelComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is the author
    if (comment.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own comments",
      });
    }

    // Check if comment is deleted or hidden
    if (comment.isDeleted || comment.isHidden) {
      return res.status(400).json({
        success: false,
        message: "Cannot edit deleted or hidden comment",
      });
    }

    // Store edit history
    const editHistory = [
      ...comment.editHistory,
      {
        content: comment.content,
        editedAt: new Date(),
      },
    ];

    // Extract new hashtags and mentions
    const hashtags = extractHashtags(content);
    const mentions = extractMentions(content);

    // Update comment
    const updatedComment = await ReelComment.findByIdAndUpdate(
      commentId,
      {
        content: content.trim(),
        editHistory,
        isEdited: true,
        hashtags,
        mentions,
      },
      { new: true, runValidators: true }
    ).populate("author", "name profilePicture username isVerified");

    res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: updatedComment,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete a comment (soft delete)
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await ReelComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is the author or has admin privileges
    if (comment.author.toString() !== userId) {
      // Check if user is admin or moderator (you can implement this logic)
      return res.status(403).json({
        success: false,
        message: "You can only delete your own comments",
      });
    }

    // Check if comment is already deleted
    if (comment.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Comment is already deleted",
      });
    }

    // Soft delete
    await comment.softDelete();

    // Remove comment from reel
    const reel = await Reel.findById(comment.reel);
    if (reel) {
      await reel.removeComment(comment._id);
    }

    // Update analytics
    const analytics = await ReelAnalytics.findOne({ reel: comment.reel });
    if (analytics) {
      await analytics.addEngagement("comment", -1);
    }

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Add/Update reaction to a comment
export const toggleCommentReaction = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reactionType = "like" } = req.body;
    const userId = req.user.id;

    const comment = await ReelComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    if (comment.isDeleted || comment.isHidden) {
      return res.status(400).json({
        success: false,
        message: "Cannot react to deleted or hidden comment",
      });
    }

    // Check if user has already reacted
    const hasReacted = comment.hasUserReacted(userId);
    const currentReactionType = comment.getUserReactionType(userId);

    if (hasReacted && currentReactionType === reactionType) {
      // Remove reaction
      await comment.removeReaction(userId);

      res.status(200).json({
        success: true,
        message: "Reaction removed successfully",
        data: { hasReacted: false, reactionType: null },
      });
    } else {
      // Add or update reaction
      await comment.addReaction(userId, reactionType);

      res.status(200).json({
        success: true,
        message: "Reaction added successfully",
        data: { hasReacted: true, reactionType },
      });
    }
  } catch (error) {
    console.error("Error toggling comment reaction:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Pin/Unpin a comment
export const togglePinComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await ReelComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is the reel author or has admin privileges
    const reel = await Reel.findById(comment.reel);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (reel.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the reel author can pin comments",
      });
    }

    if (comment.isPinned) {
      await comment.unpin();
      res.status(200).json({
        success: true,
        message: "Comment unpinned successfully",
        data: { isPinned: false },
      });
    } else {
      await comment.pin(userId);
      res.status(200).json({
        success: true,
        message: "Comment pinned successfully",
        data: { isPinned: true },
      });
    }
  } catch (error) {
    console.error("Error toggling comment pin:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Hide/Unhide a comment
export const toggleHideComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason = "" } = req.body;
    const userId = req.user.id;

    const comment = await ReelComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is the reel author or has admin privileges
    const reel = await Reel.findById(comment.reel);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (reel.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the reel author can hide comments",
      });
    }

    if (comment.isHidden) {
      await comment.unhide();
      res.status(200).json({
        success: true,
        message: "Comment unhidden successfully",
        data: { isHidden: false },
      });
    } else {
      await comment.hide(userId, reason);
      res.status(200).json({
        success: true,
        message: "Comment hidden successfully",
        data: { isHidden: true },
      });
    }
  } catch (error) {
    console.error("Error toggling comment hide:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Flag comment as spam
export const flagCommentSpam = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { score = 50 } = req.body;
    const userId = req.user.id;

    const comment = await ReelComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is the reel author or has admin privileges
    const reel = await Reel.findById(comment.reel);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (reel.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the reel author can flag comments as spam",
      });
    }

    await comment.flagAsSpam(score);

    res.status(200).json({
      success: true,
      message: "Comment flagged as spam successfully",
      data: { isSpam: true, spamScore: score },
    });
  } catch (error) {
    console.error("Error flagging comment as spam:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get user's comments
export const getUserComments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const comments = await ReelComment.getUserComments(
      userId,
      parseInt(limit),
      skip
    );

    // Get total count for pagination
    const total = await ReelComment.countDocuments({
      author: userId,
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      message: "User comments retrieved successfully",
      data: {
        comments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting user comments:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get flagged comments for moderation
export const getFlaggedComments = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.id;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Check if user has admin privileges (you can implement this logic)
    // For now, we'll allow any authenticated user to view flagged comments

    const comments = await ReelComment.getFlaggedComments(
      parseInt(limit),
      skip
    );

    // Get total count for pagination
    const total = await ReelComment.countDocuments({
      $or: [
        { moderationStatus: "flagged" },
        { isSpam: true },
        { spamScore: { $gte: 70 } },
      ],
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      message: "Flagged comments retrieved successfully",
      data: {
        comments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting flagged comments:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Moderate a comment
export const moderateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { status, notes = "" } = req.body;
    const userId = req.user.id;

    // Validate status
    if (!["pending", "approved", "rejected", "flagged"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid moderation status",
      });
    }

    const comment = await ReelComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user has admin privileges (you can implement this logic)
    // For now, we'll allow any authenticated user to moderate comments

    await comment.moderate(status, notes, userId);

    res.status(200).json({
      success: true,
      message: "Comment moderated successfully",
      data: { moderationStatus: status },
    });
  } catch (error) {
    console.error("Error moderating comment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
