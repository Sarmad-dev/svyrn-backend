import mongoose from "mongoose";

const reelCommentSchema = new mongoose.Schema(
  {
    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "Comment content is required"],
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
      trim: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReelComment",
      default: null, // for replies
    },
    replies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ReelComment",
      },
    ],
    replyCount: {
      type: Number,
      default: 0,
    },
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        type: {
          type: String,
          enum: ["like", "love", "haha", "wow", "sad", "angry"],
          default: "like",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reactionCount: {
      type: Number,
      default: 0,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    hashtags: [String],
    isEdited: {
      type: Boolean,
      default: false,
    },
    editHistory: [
      {
        content: String,
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    isHidden: {
      type: Boolean,
      default: false,
    },
    hiddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    hiddenAt: Date,
    hiddenReason: String,
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    pinnedAt: Date,
    isSpam: {
      type: Boolean,
      default: false,
    },
    spamScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "flagged"],
      default: "approved",
    },
    moderationNotes: String,
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    moderatedAt: Date,
    language: {
      type: String,
      default: "en",
    },
    sentiment: {
      type: String,
      enum: ["positive", "negative", "neutral"],
      default: "neutral",
    },
    sentimentScore: {
      type: Number,
      default: 0,
      min: -1,
      max: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
reelCommentSchema.index({ reel: 1, createdAt: -1 });
reelCommentSchema.index({ author: 1, createdAt: -1 });
reelCommentSchema.index({ parentComment: 1, createdAt: -1 });
reelCommentSchema.index({ "reactions.user": 1 });
reelCommentSchema.index({ moderationStatus: 1 });
reelCommentSchema.index({ isSpam: 1, spamScore: -1 });

// Virtual for total engagement
reelCommentSchema.virtual("totalEngagement").get(function () {
  return this.reactionCount + this.replyCount;
});

// Pre-save middleware to update counts
reelCommentSchema.pre("save", function (next) {
  if (this.isModified("reactions")) {
    this.reactionCount = this.reactions.length;
  }
  if (this.isModified("replies")) {
    this.replyCount = this.replies.length;
  }
  next();
});

// Method to add reaction
reelCommentSchema.methods.addReaction = function (userId, reactionType = "like") {
  const existingReactionIndex = this.reactions.findIndex(
    (reaction) => reaction.user.toString() === userId.toString()
  );

  if (existingReactionIndex > -1) {
    // Update existing reaction
    this.reactions[existingReactionIndex].type = reactionType;
    this.reactions[existingReactionIndex].createdAt = new Date();
  } else {
    // Add new reaction
    this.reactions.push({
      user: userId,
      type: reactionType,
      createdAt: new Date(),
    });
  }
  
  return this.save();
};

// Method to remove reaction
reelCommentSchema.methods.removeReaction = function (userId) {
  this.reactions = this.reactions.filter(
    (reaction) => reaction.user.toString() !== userId.toString()
  );
  return this.save();
};

// Method to add reply
reelCommentSchema.methods.addReply = function (commentId) {
  if (!this.replies.includes(commentId)) {
    this.replies.push(commentId);
  }
  return this.save();
};

// Method to remove reply
reelCommentSchema.methods.removeReply = function (commentId) {
  this.replies = this.replies.filter(
    (reply) => reply.toString() !== commentId.toString()
  );
  return this.save();
};

// Method to check if user has reacted
reelCommentSchema.methods.hasUserReacted = function (userId) {
  return this.reactions.some(
    (reaction) => reaction.user.toString() === userId.toString()
  );
};

// Method to get user's reaction type
reelCommentSchema.methods.getUserReactionType = function (userId) {
  const reaction = this.reactions.find(
    (reaction) => reaction.user.toString() === userId.toString()
  );
  return reaction ? reaction.type : null;
};

// Method to soft delete comment
reelCommentSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Method to restore comment
reelCommentSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = undefined;
  return this.save();
};

// Method to hide comment
reelCommentSchema.methods.hide = function (userId, reason = "") {
  this.isHidden = true;
  this.hiddenBy = userId;
  this.hiddenAt = new Date();
  this.hiddenReason = reason;
  return this.save();
};

// Method to unhide comment
reelCommentSchema.methods.unhide = function () {
  this.isHidden = false;
  this.hiddenBy = undefined;
  this.hiddenAt = undefined;
  this.hiddenReason = undefined;
  return this.save();
};

// Method to pin comment
reelCommentSchema.methods.pin = function (userId) {
  this.isPinned = true;
  this.pinnedBy = userId;
  this.pinnedAt = new Date();
  return this.save();
};

// Method to unpin comment
reelCommentSchema.methods.unpin = function () {
  this.isPinned = false;
  this.pinnedBy = undefined;
  this.pinnedAt = undefined;
  return this.save();
};

// Method to flag as spam
reelCommentSchema.methods.flagAsSpam = function (score = 50) {
  this.isSpam = true;
  this.spamScore = Math.min(100, Math.max(0, score));
  return this.save();
};

// Method to unflag spam
reelCommentSchema.methods.unflagSpam = function () {
  this.isSpam = false;
  this.spamScore = 0;
  return this.save();
};

// Method to moderate comment
reelCommentSchema.methods.moderate = function (status, notes = "", moderatorId = null) {
  this.moderationStatus = status;
  this.moderationNotes = notes;
  if (moderatorId) {
    this.moderatedBy = moderatorId;
  }
  this.moderatedAt = new Date();
  return this.save();
};

// Static method to get comments for a reel
reelCommentSchema.statics.getReelComments = function (reelId, limit = 20, skip = 0, includeReplies = false) {
  const query = {
    reel: reelId,
    parentComment: null, // Only top-level comments
    isDeleted: false,
    isHidden: false,
    moderationStatus: "approved",
  };
  
  let comments = this.find(query)
    .sort({ isPinned: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("author", "name profilePicture username isVerified")
    .populate("reactions.user", "name profilePicture");
  
  if (includeReplies) {
    comments = comments.populate({
      path: "replies",
      populate: {
        path: "author",
        select: "name profilePicture username isVerified",
      },
      options: {
        sort: { createdAt: 1 },
        limit: 5, // Limit replies per comment
      },
    });
  }
  
  return comments;
};

// Static method to get replies for a comment
reelCommentSchema.statics.getCommentReplies = function (commentId, limit = 20, skip = 0) {
  return this.find({
    parentComment: commentId,
    isDeleted: false,
    isHidden: false,
    moderationStatus: "approved",
  })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit)
    .populate("author", "name profilePicture username isVerified")
    .populate("reactions.user", "name profilePicture");
};

// Static method to get user's comments
reelCommentSchema.statics.getUserComments = function (userId, limit = 20, skip = 0) {
  return this.find({
    author: userId,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("reel", "caption media")
    .populate("reactions.user", "name profilePicture");
};

// Static method to get flagged comments for moderation
reelCommentSchema.statics.getFlaggedComments = function (limit = 50, skip = 0) {
  return this.find({
    $or: [
      { moderationStatus: "flagged" },
      { isSpam: true },
      { spamScore: { $gte: 70 } },
    ],
    isDeleted: false,
  })
    .sort({ spamScore: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("author", "name profilePicture username")
    .populate("reel", "caption media");
};

const ReelComment = mongoose.model("ReelComment", reelCommentSchema);

export default ReelComment;
