import mongoose from "mongoose";

const reelSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    media: {
      type: {
        type: String,
        enum: ["image", "video"],
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
      thumbnail: String,
      duration: Number, // for videos in seconds
      size: Number, // file size in bytes
      dimensions: {
        width: Number,
        height: Number,
      },
    },
    caption: {
      type: String,
      maxlength: [2200, "Reel caption cannot exceed 2200 characters"],
      trim: true,
    },
    audio: {
      name: String,
      artist: String,
      isOriginal: {
        type: Boolean,
        default: true,
      },
      duration: Number,
    },
    privacy: {
      type: String,
        enum: ["public", "friends", "private", "followers"],
        default: "public",
    },
    location: {
      name: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    tags: [String],
    hashtags: [String],
    mentions: [String],
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
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    shares: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        sharedAt: {
          type: Date,
          default: Date.now,
        },
        caption: String,
      },
    ],
    saves: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        savedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    views: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
        watchTime: Number, // in seconds
        completionRate: Number, // percentage
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
    saveCount: {
      type: Number,
      default: 0,
    },
    reachCount: {
      type: Number,
      default: 0,
    },
    engagementRate: {
      type: Number,
      default: 0,
    },
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
    isArchived: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    isSponsored: {
      type: Boolean,
      default: false,
    },
    sponsoredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    category: {
      type: String,
      enum: [
        "entertainment",
        "education",
        "fitness",
        "food",
        "travel",
        "fashion",
        "beauty",
        "gaming",
        "music",
        "sports",
        "technology",
        "business",
        "lifestyle",
        "other",
      ],
      default: "other",
    },
    language: {
      type: String,
      default: "en",
    },
    isAgeRestricted: {
      type: Boolean,
      default: false,
    },
    minAge: {
      type: Number,
      min: 13,
      max: 100,
    },
    isMonetized: {
      type: Boolean,
      default: false,
    },
    monetizationSettings: {
      adsEnabled: {
        type: Boolean,
        default: false,
      },
      brandDeals: {
        type: Boolean,
        default: false,
      },
      affiliateLinks: {
        type: Boolean,
        default: false,
      },
    },
    performance: {
      avgWatchTime: Number,
      completionRate: Number,
      bounceRate: Number,
      clickThroughRate: Number,
    },
    trending: {
      isTrending: {
        type: Boolean,
        default: false,
      },
      trendScore: Number,
      trendRank: Number,
      trendCategory: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
reelSchema.index({ author: 1, createdAt: -1 });
reelSchema.index({ privacy: 1, createdAt: -1 });
reelSchema.index({ category: 1, createdAt: -1 });
reelSchema.index({ hashtags: 1 });
reelSchema.index({ "trending.isTrending": 1, "trending.trendScore": -1 });
reelSchema.index({ viewCount: -1, createdAt: -1 });
reelSchema.index({ likeCount: -1, createdAt: -1 });
reelSchema.index({ engagementRate: -1, createdAt: -1 });

// Virtual for total engagement
reelSchema.virtual("totalEngagement").get(function () {
  return this.likeCount + this.commentCount + this.shareCount + this.saveCount;
});

// Virtual for engagement rate calculation
reelSchema.virtual("calculatedEngagementRate").get(function () {
  if (this.viewCount === 0) return 0;
  return ((this.totalEngagement / this.viewCount) * 100).toFixed(2);
});

// Pre-save middleware to update counts
reelSchema.pre("save", function (next) {
  if (this.isModified("reactions")) {
    this.likeCount = this.reactions.length;
  }
  if (this.isModified("comments")) {
    this.commentCount = this.comments.length;
  }
  if (this.isModified("shares")) {
    this.shareCount = this.shares.length;
  }
  if (this.isModified("saves")) {
    this.saveCount = this.saves.length;
  }
  if (this.isModified("views")) {
    this.viewCount = this.views.length;
  }
  
  // Calculate engagement rate
  if (this.viewCount > 0) {
    this.engagementRate = parseFloat(this.calculatedEngagementRate);
  }
  
  next();
});

// Method to add reaction
reelSchema.methods.addReaction = function (userId, reactionType = "like") {
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
reelSchema.methods.removeReaction = function (userId) {
  this.reactions = this.reactions.filter(
    (reaction) => reaction.user.toString() !== userId.toString()
  );
  return this.save();
};

// Method to add view
reelSchema.methods.addView = function (userId, watchTime = 0, completionRate = 0) {
  const existingViewIndex = this.views.findIndex(
    (view) => view.user.toString() === userId.toString()
  );

  if (existingViewIndex > -1) {
    // Update existing view
    this.views[existingViewIndex].viewedAt = new Date();
    this.views[existingViewIndex].watchTime = watchTime;
    this.views[existingViewIndex].completionRate = completionRate;
  } else {
    // Add new view
    this.views.push({
      user: userId,
      viewedAt: new Date(),
      watchTime,
      completionRate,
    });
  }
  
  return this.save();
};

// Method to add comment
reelSchema.methods.addComment = function (commentId) {
  if (!this.comments.includes(commentId)) {
    this.comments.push(commentId);
  }
  return this.save();
};

// Method to remove comment
reelSchema.methods.removeComment = function (commentId) {
  this.comments = this.comments.filter(
    (comment) => comment.toString() !== commentId.toString()
  );
  return this.save();
};

// Method to add share
reelSchema.methods.addShare = function (userId, caption = "") {
  this.shares.push({
    user: userId,
    sharedAt: new Date(),
    caption,
  });
  return this.save();
};

// Method to add save
reelSchema.methods.addSave = function (userId) {
  if (!this.saves.some((save) => save.user.toString() === userId.toString())) {
    this.saves.push({
      user: userId,
      savedAt: new Date(),
    });
  }
  return this.save();
};

// Method to remove save
reelSchema.methods.removeSave = function (userId) {
  this.saves = this.saves.filter(
    (save) => save.user.toString() !== userId.toString()
  );
  return this.save();
};

// Method to check if user has reacted
reelSchema.methods.hasUserReacted = function (userId) {
  return this.reactions.some(
    (reaction) => reaction.user.toString() === userId.toString()
  );
};

// Method to check if user has saved
reelSchema.methods.hasUserSaved = function (userId) {
  return this.saves.some(
    (save) => save.user.toString() === userId.toString()
  );
};

// Method to check if user has viewed
reelSchema.methods.hasUserViewed = function (userId) {
  return this.views.some(
    (view) => view.user.toString() === userId.toString()
  );
};

// Method to get user's reaction type
reelSchema.methods.getUserReactionType = function (userId) {
  const reaction = this.reactions.find(
    (reaction) => reaction.user.toString() === userId.toString()
  );
  return reaction ? reaction.type : null;
};

// Static method to get trending reels
reelSchema.statics.getTrendingReels = function (limit = 20, category = null) {
  const query = {
    "trending.isTrending": true,
    isDeleted: false,
    isArchived: false,
  };
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query)
    .sort({ "trending.trendScore": -1, createdAt: -1 })
    .limit(limit)
    .populate("author", "name profilePicture username isVerified")
    .populate("comments", "content author createdAt")
    .populate("reactions.user", "name profilePicture _id")
    .populate("saves.user", "name profilePicture _id");
};

// Static method to get reels by category
reelSchema.statics.getReelsByCategory = function (category, limit = 20, skip = 0) {
  return this.find({
    category,
    isDeleted: false,
    isArchived: false,
    privacy: "public",
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("author", "name profilePicture username isVerified")
    .populate("comments", "content author createdAt")
    .populate("reactions.user", "name profilePicture");
};

// Static method to get reels for user feed
reelSchema.statics.getUserFeed = function (userId, followingIds, limit = 20, skip = 0) {
  const query = {
    $or: [
      { author: { $in: followingIds } },
      { privacy: "public" },
    ],
    isDeleted: false,
    isArchived: false,
  };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("author", "name profilePicture username isVerified")
    .populate("comments", "content author createdAt")
    .populate("reactions.user", "name profilePicture");
};

const Reel = mongoose.model("Reel", reelSchema);

export default Reel;
