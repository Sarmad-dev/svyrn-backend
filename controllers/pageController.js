import Page from '../models/Page.js';

// @desc    Create a new page
// @route   POST /api/pages
// @access  Private
export const createPage = async (req, res) => {
  try {
    const { name, description, category, privacy } = req.body;

    const page = await Page.create({
      name,
      description,
      category,
      owner: req.user.id,
      privacy,
      admins: [{
        user: req.user.id,
        role: 'owner'
      }]
    });

    await page.populate('owner', 'name username profilePicture');

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