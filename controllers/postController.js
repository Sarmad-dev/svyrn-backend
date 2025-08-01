import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import User from "../models/User.js";
import RecommendationEngine from "../services/RecommendationEngine.js";
import ContentAnalyzer from "../services/ContentAnalyzer.js";
import { validationResult } from "express-validator";
import {
  getFileCategory,
  getMimeTypeFromBase64,
} from "../services/ImageUrlCreate.js";
import cloudinary from "../utils/cloudinary.js";
import { getLocationName } from "../utils/location.js";
import Group from "../models/Group.js";
import Page from "../models/Page.js";

const recommendationEngine = new RecommendationEngine();
const contentAnalyzer = new ContentAnalyzer();

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
export const createPost = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation error", errors.array());
      return res.status(400).json({
        status: "error",
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { text, privacy, pageId, groupId, base64, latitude, longitude } =
      req.body;

    const postData = {
      author: req.user._id,
      content: {
        text,
      },
      privacy: privacy || "friends",
    };

    if (pageId) {
      postData.page = pageId;
    }

    if (groupId) {
      postData.group = groupId;
    }

    if (latitude && longitude) {
      const locationName = await getLocationName(latitude, longitude);
      postData.location = {
        name: locationName,
        coordinates: {
          latitude,
          longitude,
        },
      };
    }

    if (base64) {
      const mimeType = getMimeTypeFromBase64(base64);
      const fileCategory = getFileCategory(mimeType);

      const result = await cloudinary.uploader.upload(base64, {
        resource_type: fileCategory,
      });

      postData.content.media = [
        {
          type: fileCategory,
          url: result.secure_url,
          caption: "",
          size: result.bytes,
          duration: fileCategory === "video" ? result.duration : 0,
        },
      ];
    }

    const post = await Post.create(postData);
    await post.populate("author", "name username profilePicture");

    // Add the post to group or page document
    if (groupId) {
      await Group.findByIdAndUpdate(
        groupId,
        { $push: { posts: post._id } },
        { new: true }
      );
    }

    if (pageId) {
      await Page.findByIdAndUpdate(
        pageId,
        { $push: { posts: post._id } },
        { new: true }
      );
    }

    // Analyze content for recommendations
    contentAnalyzer.analyzeContent("post", post._id, post);

    res.status(201).json({
      status: "success",
      message: "Post created successfully",
      data: { post },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Error creating post",
      error: error.message,
    });
  }
};

// @desc    Get personalized user feed with recommendations
// @route   GET /api/posts/feed
// @access  Private
export const getFeed = async (req, res) => {
  try {
    const {
      limit = 10,
      page = 1,
      algorithm = "recommended",
      latitude,
      longitude,
    } = req.query;

    let posts;
    let metadata = {};

    // if (algorithm === "recommended") {
    //   const location =
    //     latitude &&
    //     latitude !== "undefined" &&
    //     longitude &&
    //     longitude !== "undefined"
    //       ? {
    //           latitude: parseFloat(latitude),
    //           longitude: parseFloat(longitude),
    //         }
    //       : null;

    //   const recommendations = await recommendationEngine.getRecommendedFeed(
    //     req.user.id,
    //     {
    //       limit: Number(limit),
    //       page: Number(page),
    //       location: location ?? location,
    //     }
    //   );

    //   // Filter out posts that have a group or page
    //   posts = recommendations.posts
    //     .map((item) => item.post || item)
    //     .filter((post) => !post.group && !post.page);

    //   metadata = recommendations.metadata;
    // } else {
      // Chronological feed
      const skip = (page - 1) * limit;
      const user = await User.findById(req.user.id);
      const followingIds = user.following;

      posts = await Post.find({
        $and: [
          {
            $or: [
              { author: req.user.id },
              {
                author: { $in: followingIds },
                privacy: { $in: ["public", "friends"] },
              },
              { privacy: "public" },
            ],
          },
          { isActive: true },
          { group: null }, // exclude group posts
          { page: null }, // exclude page posts
        ],
      })
        .populate("author", "name username profilePicture isVerified")
        .populate("tags", "name username profilePicture")
        .populate({
          path: "comments",
          populate: {
            path: "author",
            select: "name username profilePicture",
          },
          options: { sort: { createdAt: -1 } },
        })
        .sort({ isPinned: -1, createdAt: -1 })
        .limit(Number(limit))
        .skip(skip);

      metadata = { algorithm: "chronological" };
    // }

    // Track feed view
    if (posts.length > 0) {
      posts.forEach((post) => {
        recommendationEngine.trackInteraction(
          req.user.id,
          "post",
          post._id,
          "view",
          {
            algorithm,
            location: latitude && longitude ? { latitude, longitude } : null,
          }
        );
      });
    }

    const total = posts.length;

    res.status(200).json({
      status: "success",
      data: {
        posts,
        metadata,
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
      message: "Error fetching feed",
      error: error.message,
    });
  }
};

// @desc    Get a specific post
// @route   GET /api/posts/:id
// @access  Private
export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "name username profilePicture isVerified")
      .populate("tags", "name username profilePicture")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "name username profilePicture",
        },
      });

    if (!post || !post.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Post not found",
      });
    }

    // Check if user can view this post
    const canView =
      post.privacy === "public" ||
      post.author._id.toString() === req.user.id.toString() ||
      (post.privacy === "friends" &&
        req.user.following.includes(post.author._id));

    if (!canView) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to view this post",
      });
    }

    // Track post view for recommendations
    recommendationEngine.trackInteraction(
      req.user.id,
      "post",
      req.params.id,
      "view",
      {
        dwellTime: 0,
        postAuthor: post.author._id.toString(),
      }
    );

    res.status(200).json({
      status: "success",
      data: { post },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching post",
      error: error.message,
    });
  }
};

// @desc    Update a post
// @route   PUT /api/posts/:id
// @access  Private
export const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post || !post.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Post not found",
      });
    }

    if (post.author.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You can only edit your own posts",
      });
    }

    // Save edit history
    if (req.body.content && req.body.content.text !== post.content.text) {
      post.editHistory.push({
        content: post.content.text,
        editedAt: new Date(),
      });
      post.isEdited = true;
    }

    Object.assign(post, req.body);
    await post.save();

    await post.populate("author", "firstName lastName profilePicture");

    // Re-analyze content after edit
    contentAnalyzer.analyzeContent("post", post._id, post);

    res.status(200).json({
      status: "success",
      message: "Post updated successfully",
      data: { post },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error updating post",
      error: error.message,
    });
  }
};

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        status: "error",
        message: "Post not found",
      });
    }

    if (post.author.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You can only delete your own posts",
      });
    }

    post.isActive = false;
    await post.save();

    res.status(200).json({
      status: "success",
      message: "Post deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error deleting post",
      error: error.message,
    });
  }
};

// @desc    React to a post
// @route   POST /api/posts/:id/react
// @access  Private
export const reactToPost = async (req, res) => {
  try {
    const { type = "like" } = req.body;
    const validTypes = ["like", "love", "haha", "wow", "sad", "angry"];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid reaction type",
      });
    }

    const post = await Post.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Post not found",
      });
    }

    // Check if user already reacted
    const existingReaction = post.reactions.find(
      (reaction) => reaction.user.toString() === req.user.id.toString()
    );

    if (existingReaction) {
      if (existingReaction.type === type) {
        // Remove reaction if same type
        post.reactions = post.reactions.filter(
          (reaction) => reaction.user.toString() !== req.user.id.toString()
        );
      } else {
        // Update reaction type
        existingReaction.type = type;
        existingReaction.createdAt = new Date();
      }
    } else {
      // Add new reaction
      post.reactions.push({
        user: req.user.id,
        type,
        createdAt: new Date(),
      });
    }

    await post.save();

    // Track interaction for recommendations
    recommendationEngine.trackInteraction(
      req.user.id,
      "post",
      req.params.id,
      "like",
      {
        reactionType: type,
        postAuthor: post.author.toString(),
      }
    );

    res.status(200).json({
      status: "success",
      message: "Reaction updated successfully",
      data: {
        reactionsCount: post.reactionsCount,
        userReaction: existingReaction ? existingReaction.type : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error updating reaction",
      error: error.message,
    });
  }
};

// @desc    Add a comment to a post
// @route   POST /api/posts/:id/comments
// @access  Private
export const addComment = async (req, res) => {
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

    const { content, parentComment } = req.body;

    const post = await Post.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Post not found",
      });
    }

    let level = 0;
    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      if (!parent) {
        return res.status(404).json({
          status: "error",
          message: "Parent comment not found",
        });
      }
      level = parent.level + 1;
      if (level > 2) {
        return res.status(400).json({
          status: "error",
          message: "Maximum nesting level reached",
        });
      }
    }

    const comment = await Comment.create({
      author: req.user.id,
      post: req.params.id,
      content,
      parentComment,
      level,
    });

    // Add comment to post
    post.comments.push(comment._id);
    await post.save();

    // Add reply to parent comment if applicable
    if (parentComment) {
      await Comment.findByIdAndUpdate(parentComment, {
        $push: { replies: comment._id },
      });
    }

    // Track interaction for recommendations
    recommendationEngine.trackInteraction(
      req.user.id,
      "post",
      req.params.id,
      "comment",
      {
        commentLength: content.length,
        postAuthor: post.author.toString(),
        isReply: !!parentComment,
      }
    );

    res.status(201).json({
      status: "success",
      message: "Comment added successfully",
      data: { comment },
    });
  } catch (error) {
    console.log("Comment Error: ", error);
    res.status(500).json({
      status: "error",
      message: "Error adding comment",
      error: error.message,
    });
  }
};

// @desc    Share a post
// @route   POST /api/posts/:id/share
// @access  Private
export const sharePost = async (req, res) => {
  try {
    const { caption } = req.body;

    const post = await Post.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Post not found",
      });
    }

    // Check if user already shared
    const existingShare = post.shares.find(
      (share) => share.user.toString() === req.user.id.toString()
    );

    if (existingShare) {
      return res.status(400).json({
        status: "error",
        message: "You have already shared this post",
      });
    }

    // Add share
    post.shares.push({
      user: req.user.id,
      sharedAt: new Date(),
      caption: caption || "",
    });

    await post.save();

    // Track interaction for recommendations
    recommendationEngine.trackInteraction(
      req.user.id,
      "post",
      req.params.id,
      "share",
      {
        hasCaption: !!caption,
        postAuthor: post.author.toString(),
      }
    );

    res.status(200).json({
      status: "success",
      message: "Post shared successfully",
      data: {
        sharesCount: post.sharesCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error sharing post",
      error: error.message,
    });
  }
};

// @desc    Save a post
// @route   POST /api/posts/:id/save
// @access  Private
export const savePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Post not found",
      });
    }

    // Track save interaction
    recommendationEngine.trackInteraction(
      req.user.id,
      "post",
      req.params.id,
      "save",
      {
        postAuthor: post.author.toString(),
      }
    );

    res.status(200).json({
      status: "success",
      message: "Post saved successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error saving post",
      error: error.message,
    });
  }
};

// @desc    Hide a post from feed
// @route   POST /api/posts/:id/hide
// @access  Private
export const hidePost = async (req, res) => {
  try {
    const { reason } = req.body;

    const post = await Post.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Post not found",
      });
    }

    // Track hide interaction with negative weight
    recommendationEngine.trackInteraction(
      req.user.id,
      "post",
      req.params.id,
      "hide",
      {
        reason: reason || "not_interested",
        postAuthor: post.author.toString(),
      }
    );

    res.status(200).json({
      status: "success",
      message: "Post hidden from your feed",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error hiding post",
      error: error.message,
    });
  }
};
