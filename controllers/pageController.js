import Page from '../models/Page.js';
import Post from '../models/Post.js';
import NotificationHelper from '../utils/notificationHelper.js';
import cloudinary from '../utils/cloudinary.js';
import { getFileCategory, getMimeTypeFromBase64 } from '../services/ImageUrlCreate.js';

// @desc    Create a new page
// @route   POST /api/pages
// @access  Private
export const createPage = async (req, res) => {
  try {
    const { name, description, category, privacy, username, profilePicture, coverPhoto } = req.body;

    // Check if username is already taken
    if (username) {
      const existingPage = await Page.findOne({ username: username.toLowerCase() });
      if (existingPage) {
        return res.status(400).json({
          status: 'error',
          message: 'Username is already taken'
        });
      }
    }

    const pageData = {
      name,
      description,
      category,
      username: username?.toLowerCase(),
      privacy,
      owner: req.user.id,
      admins: [{
        user: req.user.id,
        role: 'owner'
      }]
    };

    // Handle profile picture upload
    if (profilePicture) {
      const mimeType = getMimeTypeFromBase64(profilePicture);
      const fileCategory = getFileCategory(mimeType);

      if (fileCategory !== 'image') {
        return res.status(400).json({
          status: 'error',
          message: 'Profile picture must be an image file'
        });
      }

      const result = await cloudinary.uploader.upload(profilePicture, {
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto' }
        ]
      });

      pageData.profilePicture = result.secure_url;
    }

    // Handle cover photo upload
    if (coverPhoto) {
      const mimeType = getMimeTypeFromBase64(coverPhoto);
      const fileCategory = getFileCategory(mimeType);

      if (fileCategory !== 'image') {
        return res.status(400).json({
          status: 'error',
          message: 'Cover photo must be an image file'
        });
      }

      const result = await cloudinary.uploader.upload(coverPhoto, {
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 400, crop: 'fill' },
          { quality: 'auto' }
        ]
      });

      pageData.coverPhoto = result.secure_url;
    }

    const page = await Page.create(pageData);
    await page.populate('owner', 'firstName lastName username profilePicture');

    res.status(201).json({
      status: 'success',
      message: 'Page created successfully',
      data: { page }
    });
  } catch (error) {
    console.log("Page Error: ", error)
    res.status(500).json({
      status: 'error',
      message: 'Error creating page',
      error: error.message
    });
  }
};

// @desc    Search/browse pages
// @route   GET /api/pages
// @access  Private
export const getPages = async (req, res) => {
  try {
    const { search, category, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    let query = { isActive: true };

    if (search) {
      query.$text = { $search: search };
    }

    if (category) {
      query.category = category;
    }

    const pages = await Page.find(query)
      .populate('owner', 'firstName lastName profilePicture')
      .select('name username profilePicture category followersCount isVerified')
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Page.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        pages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching pages',
      error: error.message
    });
  }
};

// @desc    Get user's owned pages
// @route   GET /api/pages/my-pages
// @access  Private
export const getMyPages = async (req, res) => {
  try {
    const pages = await Page.find({ 
      owner: req.user.id,
      isActive: true 
    })
    .populate('owner', 'firstName lastName username profilePicture')
    .select('name username profilePicture category followersCount postsCount isVerified privacy isActive createdAt')
    .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: { pages }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching your pages',
      error: error.message
    });
  }
};

// @desc    Get user's followed pages
// @route   GET /api/pages/followed
// @access  Private
export const getFollowedPages = async (req, res) => {
  try {
    const pages = await Page.find({ 
      followers: req.user.id,
      isActive: true 
    })
    .populate('owner', 'firstName lastName username profilePicture')
    .select('name username profilePicture category followersCount postsCount isVerified privacy isActive createdAt')
    .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: { pages }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching followed pages',
      error: error.message
    });
  }
};

// @desc    Get page posts with pagination
// @route   GET /api/pages/:id/posts
// @access  Private
export const getPagePosts = async (req, res) => {
  try {
    const { limit = 10, cursor } = req.query;
    const limitNum = parseInt(limit);

    const page = await Page.findById(req.params.id);
    if (!page || !page.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Page not found'
      });
    }

    // Check privacy settings
    const isOwner = page.owner.toString() === req.user.id.toString();
    const isAdmin = page.admins.some(admin => admin.user.toString() === req.user.id.toString());
    const isFollower = page.followers.includes(req.user.id);

    if (page.privacy === 'private' && !isOwner && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'This page is private'
      });
    }

    if (page.privacy === 'friends' && !isOwner && !isAdmin && !isFollower) {
      return res.status(403).json({
        status: 'error',
        message: 'You must follow this page to view posts'
      });
    }

    // Build query for posts
    let query = { 
      page: req.params.id,
      isActive: true 
    };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    const posts = await Post.find(query)
      .populate('author', 'firstName lastName username profilePicture isVerified')
      .populate('tags', 'firstName lastName username profilePicture')
      .sort({ isPinned: -1, createdAt: -1, _id: -1 })
      .limit(limitNum + 1)
      .lean();

    let hasNextPage = false;
    let nextCursor = null;

    if (posts.length > limitNum) {
      hasNextPage = true;
      posts.splice(limitNum);
      nextCursor = posts[posts.length - 1]._id.toString();
    }

    res.status(200).json({
      status: 'success',
      data: {
        posts,
        pagination: {
          hasNextPage,
          nextCursor,
          limit: limitNum,
          total: posts.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching page posts',
      error: error.message
    });
  }
};

// @desc    Get page details
// @route   GET /api/pages/:id
// @access  Private
export const getPage = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id)
      .populate('owner', 'name username profilePicture')
      .populate('admins.user', 'name username profilePicture')
      .populate('posts', 'content author createdAt')
      .populate({
        path: 'posts',
        populate: {
          path: 'author',
          select: 'name username profilePicture'
        }
      });

    if (!page || !page.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Page not found'
      });
    }

    const isFollowing = page.followers.includes(req.user.id);
    const userRole = page.admins.find(
      admin => admin.user._id.toString() === req.user.id.toString()
    )?.role || null;

    res.status(200).json({
      status: 'success',
      data: {
        page,
        isFollowing,
        userRole
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching page',
      error: error.message
    });
  }
};

// @desc    Follow a page
// @route   POST /api/pages/:id/follow
// @access  Private
export const followPage = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);

    if (!page || !page.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Page not found'
      });
    }

    if (page.followers.includes(req.user.id)) {
      return res.status(400).json({
        status: 'error',
        message: 'You are already following this page'
      });
    }

    page.followers.push(req.user.id);
    await page.save();

    // Notify page owner about new follower (if notifications are enabled)
    if (page.owner.toString() !== req.user.id.toString() && page.settings?.notifyOnFollow) {
      await NotificationHelper.createNotification({
        recipient: page.owner,
        sender: req.user.id,
        type: 'page_follow',
        title: 'New Page Follower',
        message: `started following your page "${page.name}"`,
        data: { 
          pageId: page._id,
          pageName: page.name,
          followerId: req.user.id
        }
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Page followed successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error following page',
      error: error.message
    });
  }
};

// @desc    Unfollow a page
// @route   DELETE /api/pages/:id/unfollow
// @access  Private
export const unfollowPage = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);

    if (!page || !page.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Page not found'
      });
    }

    if (!page.followers.includes(req.user.id)) {
      return res.status(400).json({
        status: 'error',
        message: 'You are not following this page'
      });
    }

    page.followers = page.followers.filter(
      id => id.toString() !== req.user.id.toString()
    );
    await page.save();

    res.status(200).json({
      status: 'success',
      message: 'Page unfollowed successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error unfollowing page',
      error: error.message
    });
  }
};

// @desc    Get page analytics
// @route   GET /api/pages/:id/analytics
// @access  Private (Page admins only)
export const getPageAnalytics = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);

    if (!page || !page.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Page not found'
      });
    }

    const userRole = page.admins.find(
      admin => admin.user.toString() === req.user.id.toString()
    )?.role;

    if (!userRole) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You must be a page admin.'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        analytics: page.analytics,
        followersCount: page.followersCount,
        postsCount: page.postsCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching analytics',
      error: error.message
    });
  }
};

// @desc    Update page
// @route   PUT /api/pages/:id
// @access  Private
export const updatePage = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);

    if (!page || !page.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Page not found'
      });
    }

    const userRole = page.admins.find(
      admin => admin.user.toString() === req.user.id.toString()
    )?.role;

    if (!userRole || !['owner', 'admin'].includes(userRole)) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You must be a page admin.'
      });
    }

    Object.assign(page, req.body);
    await page.save();

    await page.populate('owner', 'firstName lastName profilePicture');

    res.status(200).json({
      status: 'success',
      message: 'Page updated successfully',
      data: { page }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating page',
      error: error.message
    });
  }
};

// @desc    Handle page comment notification
// @access  Private
export const notifyPageComment = async (pageId, commentId, commenterId, commentContent) => {
  try {
    const page = await Page.findById(pageId).populate('owner', 'firstName lastName username');
    
    if (!page || !page.settings?.notifyOnComment) {
      return;
    }

    // Notify page owner about new comment (if not self-comment)
    if (page.owner._id.toString() !== commenterId.toString()) {
      await NotificationHelper.createNotification({
        recipient: page.owner._id,
        sender: commenterId,
        type: 'page_comment',
        title: 'New Page Comment',
        message: `commented on your page "${page.name}"`,
        data: { 
          pageId: page._id,
          pageName: page.name,
          commentId: commentId,
          commentContent: commentContent.substring(0, 100) // Limit content length
        }
      });
    }
  } catch (error) {
    console.error('Error sending page comment notification:', error);
  }
};

// @desc    Handle page post notification
// @access  Private
export const notifyPagePost = async (pageId, postId, postAuthorId, postContent) => {
  try {
    const page = await Page.findById(pageId).populate('followers');
    
    if (!page) {
      return;
    }

    // Notify all page followers about new post
    const followersToNotify = page.followers.filter(followerId => 
      followerId.toString() !== postAuthorId.toString()
    );

    for (const followerId of followersToNotify) {
      await NotificationHelper.createNotification({
        recipient: followerId,
        sender: postAuthorId,
        type: 'page_post',
        title: 'New Page Post',
        message: `posted on "${page.name}"`,
        data: { 
          pageId: page._id,
          pageName: page.name,
          postId: postId,
          postContent: postContent.substring(0, 100) // Limit content length
        }
      });
    }
  } catch (error) {
    console.error('Error sending page post notification:', error);
  }
};