import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      text: {
        type: String,
        maxlength: [5000, "Post content cannot exceed 5000 characters"],
      },
      media: [
        {
          type: {
            type: String,
            enum: ["image", "video", "document"],
            required: true,
          },
          url: {
            type: String,
            required: true,
          },
          caption: String,
          size: Number,
          duration: Number, // for videos
        },
      ],
    },
    privacy: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "friends",
    },
    location: {
      name: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
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
        destination: {
          type: String,
          enum: ["feed", "group", "conversation"],
          default: "feed",
        },
        targetId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "shares.targetModel",
        },
        targetModel: {
          type: String,
          enum: ["Group", "Conversation"],
          required: function() {
            return this.destination && this.destination !== "feed" && this.targetId;
          },
        },
      },
    ],
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    page: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Page",
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
    isActive: {
      type: Boolean,
      default: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ privacy: 1, isActive: 1 });
postSchema.index({ group: 1, createdAt: -1 });
postSchema.index({ page: 1, createdAt: -1 });
postSchema.index({ "location.coordinates": "2dsphere" });
postSchema.index({ "content.text": "text" });

// Virtual for reactions count
postSchema.virtual("reactionsCount").get(function () {
  return this.reactions.length;
});

// Virtual for comments count
postSchema.virtual("commentsCount").get(function () {
  return this.comments.length;
});

// Virtual for shares count
postSchema.virtual("sharesCount").get(function () {
  return this.shares.length;
});

const Post = mongoose.model("Post", postSchema);
export default Post;
