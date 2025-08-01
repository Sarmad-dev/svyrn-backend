import UserSession from '../models/UserSession.js';
import User from '../models/User.js';

// @desc    Get online users
// @route   GET /api/status/online-users
// @access  Private
export const getOnlineUsers = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    // Get user's friends/following
    const user = await User.findById(req.user.id)
      .populate('following', '_id')
      .populate('followers', '_id');

    const contactIds = [
      ...user.following.map(f => f._id.toString()),
      ...user.followers.map(f => f._id.toString())
    ];

    console.log("Contact IDs: ", contactIds)

    // Get online sessions for contacts
    const onlineSessions = await UserSession.find({
      userId: { $in: contactIds },
      status: { $in: ['online', 'away', 'busy'] },
      isActive: true,
      lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
    })
    .populate('userId', 'name username profilePicture isVerified _id')
    .sort({ lastSeen: -1 })
    .limit(Number(limit));

    // Group by user (in case of multiple sessions)
    const onlineUsers = [];
    const seenUsers = new Set();

    onlineSessions.forEach(session => {
      const userId = session.userId._id.toString();
      if (!seenUsers.has(userId)) {
        seenUsers.add(userId);
        onlineUsers.push({
          user: session.userId,
          status: session.status,
          lastSeen: session.lastSeen,
          device: session.device
        });
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        onlineUsers,
        count: onlineUsers.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching online users',
      error: error.message
    });
  }
};

// @desc    Get specific user's online status
// @route   GET /api/status/user/:id
// @access  Private
export const getUserStatus = async (req, res) => {
  try {
    const session = await UserSession.findOne({
      user: req.params.id,
      isActive: true
    })
    .sort({ lastSeen: -1 })
    .populate('user', 'name username profilePicture');

    if (!session) {
      return res.status(200).json({
        status: 'success',
        data: {
          isOnline: false,
          status: 'offline',
          lastSeen: null
        }
      });
    }

    // Consider user online if last seen within 5 minutes
    const isOnline = new Date() - session.lastSeen < 5 * 60 * 1000;

    res.status(200).json({
      status: 'success',
      data: {
        isOnline,
        status: isOnline ? session.status : 'offline',
        lastSeen: session.lastSeen,
        device: session.device
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user status',
      error: error.message
    });
  }
};

// @desc    Update user status
// @route   PUT /api/status/update
// @access  Private
export const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['online', 'away', 'busy', 'offline'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status'
      });
    }

    // Update all active sessions for the user
    await UserSession.updateMany(
      { user: req.user.id, isActive: true },
      { status, lastSeen: new Date() }
    );

    // Broadcast status change via socket if available
    if (global.socketHandlers) {
      await global.socketHandlers.broadcastUserStatus(req.user.id, status);
    }

    res.status(200).json({
      status: 'success',
      message: 'Status updated successfully',
      data: { status }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating status',
      error: error.message
    });
  }
};

// @desc    Get user's active sessions
// @route   GET /api/status/sessions
// @access  Private
export const getSessions = async (req, res) => {
  try {
    const sessions = await UserSession.find({
      user: req.user.id,
      isActive: true
    })
    .sort({ lastSeen: -1 });

    res.status(200).json({
      status: 'success',
      data: { sessions }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching sessions',
      error: error.message
    });
  }
};

// @desc    Get status statistics
// @route   GET /api/status/stats
// @access  Private
export const getStatusStats = async (req, res) => {
  try {
    const stats = await UserSession.aggregate([
      {
        $match: {
          isActive: true,
          lastSeen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalOnline = stats.reduce((sum, stat) => 
      stat._id !== 'offline' ? sum + stat.count : sum, 0
    );

    res.status(200).json({
      status: 'success',
      data: {
        stats,
        totalOnline,
        breakdown: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching status statistics',
      error: error.message
    });
  }
};