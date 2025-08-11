import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      caption: {
        type: String,
        maxlength: [200, "Caption cannot exceed 200 characters"],
      },
      media: [
        {
          type: {
            type: String,
            enum: ["image", "video"],
            required: true,
          },
          url: {
            type: String,
            required: true,
          },
          caption: {
            type: String,
            maxlength: [100, "Media caption cannot exceed 100 characters"],
          },
          duration: {
            type: Number, // Duration in seconds for videos
            min: 0, // Allow 0 for images
            max: 30, // Max 30 seconds per story item
          },
          size: Number,
          thumbnail: String, // Thumbnail URL for videos
          order: {
            type: Number,
            default: 0,
          },
        },
      ],
    },
    privacy: {
      type: String,
      enum: ["public", "friends", "close_friends"],
      default: "friends",
    },
    viewers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        type: {
          type: String,
          enum: ["like", "love", "haha", "wow", "sad", "angry"],
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          maxlength: [200, "Comment cannot exceed 200 characters"],
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    location: {
      name: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    backgroundColor: {
      type: String,
      default: "#000000",
    },
    music: {
      title: String,
      artist: String,
      url: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: function () {
        return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      },
      index: { expireAfterSeconds: 0 }, // MongoDB TTL index
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
storySchema.index({ author: 1, createdAt: -1 });
storySchema.index({ expiresAt: 1 }); // TTL index for auto-deletion
storySchema.index({ "viewers.user": 1 });
storySchema.index({ "reactions.user": 1 });
storySchema.index({ "comments.user": 1 });
storySchema.index({ privacy: 1, isActive: 1 });

// Virtual for views count
storySchema.virtual("viewsCount").get(function () {
  return this.viewers.length;
});

// Virtual for reactions count
storySchema.virtual("reactionsCount").get(function () {
  return this.reactions.length;
});

// Virtual for comments count
storySchema.virtual("commentsCount").get(function () {
  return this.comments.length;
});

// Method to check if user has viewed the story
storySchema.methods.hasViewed = function (userId) {
  return this.viewers.some(
    (viewer) => viewer.user.toString() === userId.toString()
  );
};

// Method to add viewer
storySchema.methods.addViewer = function (userId) {
  if (!this.hasViewed(userId)) {
    this.viewers.push({
      user: userId,
      viewedAt: new Date(),
    });
  }
};

// Method to check if user has reacted
storySchema.methods.hasReacted = function (userId) {
  return this.reactions.some(
    (reaction) => reaction.user.toString() === userId.toString()
  );
};

// Method to get user's reaction
storySchema.methods.getUserReaction = function (userId) {
  const reaction = this.reactions.find(
    (reaction) => reaction.user.toString() === userId.toString()
  );
  return reaction ? reaction.type : null;
};

// Method to toggle reaction
storySchema.methods.toggleReaction = function (userId, reactionType) {
  const existingReactionIndex = this.reactions.findIndex(
    (reaction) => reaction.user.toString() === userId.toString()
  );

  if (existingReactionIndex !== -1) {
    if (this.reactions[existingReactionIndex].type === reactionType) {
      // Remove reaction if same type
      this.reactions.splice(existingReactionIndex, 1);
      return { action: "removed", type: null };
    } else {
      // Update reaction type
      this.reactions[existingReactionIndex].type = reactionType;
      this.reactions[existingReactionIndex].createdAt = new Date();
      return { action: "updated", type: reactionType };
    }
  } else {
    // Add new reaction
    this.reactions.push({
      user: userId,
      type: reactionType,
      createdAt: new Date(),
    });
    return { action: "added", type: reactionType };
  }
};

// Method to add comment
storySchema.methods.addComment = function (userId, text) {
  this.comments.push({
    user: userId,
    text,
    createdAt: new Date(),
  });
};

export default mongoose.model("Story", storySchema);
