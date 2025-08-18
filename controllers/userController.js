import Post from "../models/Post.js";
import User from "../models/User.js";
import { validationResult } from "express-validator";
import NotificationHelper from "../utils/notificationHelper.js";
import Media from "../models/Media.js";

// @desc    Search users
// @route   GET /api/users/search
// @access  Private
export const searchUsers = async (req, res) => {
  try {
    const { q, limit = 10, page = 1 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        status: "error",
        message: "Search query must be at least 2 characters",
      });
    }

    const searchRegex = new RegExp(q.trim(), "i");
    const skip = (page - 1) * limit;

    const users = await User.find({
      $and: [
        {
          $or: [
            { name: searchRegex },
            { username: searchRegex },
            { email: searchRegex },
          ],
        },
        { _id: { $ne: req.user.id } },
        { isActive: true },
      ],
    })
      .select("name username profilePicture bio isVerified _id")
      .limit(Number(limit))
      .skip(skip);

    const total = await User.countDocuments({
      $and: [
        {
          $or: [
            { name: searchRegex },
            { username: searchRegex },
            { email: searchRegex },
          ],
        },
        { _id: { $ne: req.user.id } },
        { isActive: true },
      ],
    });

    res.status(200).json({
      status: "success",
      data: {
        users,
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
      message: "Error searching users",
      error: error.message,
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res) => {
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

    const updates = req.body;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: { user },
    });
  } catch (error) {
    console.log("Error updating profile: ", error);
    res.status(500).json({
      status: "error",
      message: "Error updating profile",
      error: error.message,
    });
  }
};

// @desc    Get user posts
// @route   GET /api/users/:id/posts
// @access  Private
export const getUserPosts = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const { id } = req.params;

    const skip = (page - 1) * limit;

    const posts = await Post.find({
      author: id,
    })
      .populate("author", "name username profilePicture isVerified")
      .populate("group", "_id name profilePicture") // optional: populate group info
      .populate("page", "_id name profilePicture") // optional: populate page info
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    // Add isGroup flag
    const formattedPosts = posts.map((post) => ({
      ...post.toObject(),
      isGroup: post.group ? true : false,
    }));

    const total = await Post.countDocuments({ author: req.user._id });

    res.status(200).json({
      status: "success",
      data: {
        posts: formattedPosts,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch user's posts",
      error: error.message,
    });
  }
};

// @desc    Follow a user
// @route   POST /api/users/:id/follow
// @access  Private
export const followUser = async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.id);
    if (!userToFollow) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    if (req.params.id === req.user.id.toString()) {
      return res.status(400).json({
        status: "error",
        message: "You cannot follow yourself",
      });
    }

    const currentUser = await User.findById(req.user.id);

    // Check if already following
    if (currentUser.following.includes(req.params.id)) {
      return res.status(400).json({
        status: "error",
        message: "You are already following this user",
      });
    }

    // Add to following list
    currentUser.following.push(req.params.id);
    await currentUser.save();

    // Add to followers list
    userToFollow.followers.push(req.user.id);
    await userToFollow.save();

    await NotificationHelper.notifyFollow(req.user.id, req.params.id);

    res.status(200).json({
      status: "success",
      message: "User followed successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error following user",
      error: error.message,
    });
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/users/:id/unfollow
// @access  Private
export const unfollowUser = async (req, res) => {
  try {
    const userToUnfollow = await User.findById(req.params.id);
    if (!userToUnfollow) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const currentUser = await User.findById(req.user.id);

    // Check if not following
    if (!currentUser.following.includes(req.params.id)) {
      return res.status(400).json({
        status: "error",
        message: "You are not following this user",
      });
    }

    // Remove from following list
    currentUser.following = currentUser.following.filter(
      (id) => id.toString() !== req.params.id
    );
    await currentUser.save();

    // Remove from followers list
    userToUnfollow.followers = userToUnfollow.followers.filter(
      (id) => id.toString() !== req.user.id.toString()
    );
    await userToUnfollow.save();

    res.status(200).json({
      status: "success",
      message: "User unfollowed successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error unfollowing user",
      error: error.message,
    });
  }
};

// @desc    Get user profile
// @route   GET /api/users/:id
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("followers", "name profilePicture username isVerified _id")
      .populate("following", "name profilePicture username isVerified _id");

    if (!user || !user.isActive) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Check privacy settings
    const isOwnProfile = req.params.id === req.user._id.toString();
    const isFollowing = user.followers.some(
      (follower) => follower._id.toString() === req.user._id.toString()
    );

    if (!isOwnProfile && user.privacy.profileVisibility === "private") {
      return res.status(403).json({
        status: "error",
        message: "This profile is private",
      });
    }

    if (
      !isOwnProfile &&
      user.privacy.profileVisibility === "friends" &&
      !isFollowing
    ) {
      return res.status(403).json({
        status: "error",
        message: "This profile is only visible to friends",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: isOwnProfile ? user.email : undefined,
          profilePicture: user.profilePicture,
          coverPhoto: user.coverPhoto,
          bio: user.bio,
          currentJob: user.currentJob,
          gender: user.gender,
          worksAt: user.worksAt,
          livesIn: user.livesIn,
          From: user.From,
          martialStatus: user.martialStatus,
          location: user.location,
          website: user.website,
          dateOfBirth: isOwnProfile ? user.dateOfBirth : undefined,
          isVerified: user.isVerified,
          privacy: isOwnProfile ? user.privacy : undefined,
          followersCount: user.followers.length,
          followingCount: user.following.length,
          isFollowing,
          createdAt: user.createdAt,
          isOwnProfile,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching user profile",
      error: error.message,
    });
  }
};

// @desc    Get current user
// @route   GET /api/users/me
// @access  Private
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("followers", "name profilePicture username isVerified _id")
      .populate("following", "name profilePicture username isVerified _id");

    return res.status(200).json({
      status: "success",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture,
          coverPhoto: user.coverPhoto,
          bio: user.bio,
          currentJob: user.currentJob,
          gender: user.gender,
          worksAt: user.worksAt,
          livesIn: user.livesIn,
          From: user.From,
          martialStatus: user.martialStatus,
          location: user.location,
          website: user.website,
          dateOfBirth: user.dateOfBirth,
          isVerified: user.isVerified,
          privacy: user.privacy,
          followers: user.followers,
          following: user.following,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Get Me Error: ", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching user profile",
      error: error.message,
    });
  }
};

// @desc    Get user's followers
// @route   GET /api/users/:id/followers
// @access  Private
export const getUserFollowers = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.params.id).populate({
      path: "followers",
      select: "name profilePicture username isVerified _id",
      options: {
        limit: Number(limit),
        skip: skip,
      },
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const total = user.followers.length;

    res.status(200).json({
      status: "success",
      data: {
        followers: user.followers,
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
      message: "Error fetching followers",
      error: error.message,
    });
  }
};

// @desc    Get user's following
// @route   GET /api/users/:id/following
// @access  Private
export const getUserFollowing = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.params.id).populate({
      path: "following",
      select: "name profilePicture username isVerified _id",
      options: {
        limit: Number(limit),
        skip: skip,
      },
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const total = user.following.length;

    res.status(200).json({
      status: "success",
      data: {
        following: user.following,
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
      message: "Error fetching following",
      error: error.message,
    });
  }
};

// @desc    Get user's photos
// @route   GET /api/users/:id/photos
// @access  Private
export const getUserPhotos = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const photos = await Media.find({
      author: user._id,
      type: "image",
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .select("url _id createdAt");

    const total = await Media.countDocuments({
      author: user._id,
      type: "image",
    });

    res.status(200).json({
      status: "success",
      data: {
        photos,
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
      message: "Error fetching following",
      error: error.message,
    });
  }
};

// @desc    Get user's videos
// @route   GET /api/users/:id/videos
// @access  Private
export const getUserVideos = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const videos = await Media.find({
      author: user._id,
      type: "video",
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .select("url _id createdAt");

    const total = await Media.countDocuments({
      author: user._id,
      type: "video",
    });

    res.status(200).json({
      status: "success",
      data: {
        videos,
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
      message: "Error fetching following",
      error: error.message,
    });
  }
};