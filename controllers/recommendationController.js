
import RecommendationEngine from '../services/RecommendationEngine.js';
import UserInteraction from '../models/UserInteraction.js';
import UserPreference from '../models/UserPreference.js';

const recommendationEngine = new RecommendationEngine();

// @desc    Get personalized feed recommendations
// @route   GET /api/recommendations/feed
// @access  Private
export const getRecommendedFeed = async (req, res) => {
  try {
    const {
      limit = 20,
      page = 1,
      includeAds = true,
      diversityFactor = 0.3,
      latitude,
      longitude
    } = req.query;

    const location = latitude && longitude ? {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    } : null;

    const recommendations = await recommendationEngine.getRecommendedFeed(
      req.user.id,
      {
        limit: Number(limit),
        page: Number(page),
        includeAds: includeAds === 'true',
        diversityFactor: parseFloat(diversityFactor),
        location
      }
    );

    res.status(200).json({
      status: 'success',
      data: recommendations
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error generating recommendations',
      error: error.message
    });
  }
};

// @desc    Track user interaction for learning
// @route   POST /api/recommendations/interaction
// @access  Private
export const trackInteraction = async (req, res) => {
  try {
    const {
      targetType,
      targetId,
      interactionType,
      dwellTime,
      scrollDepth,
      feedPosition,
      deviceType,
      latitude,
      longitude,
      city,
      country
    } = req.body;

    const metadata = {
      dwellTime,
      scrollDepth,
      deviceType,
      feedPosition,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay()
    };

    if (latitude && longitude) {
      metadata.location = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        city,
        country
      };
    }

    await recommendationEngine.trackInteraction(
      req.user.id,
      targetType,
      targetId,
      interactionType,
      metadata
    );

    res.status(200).json({
      status: 'success',
      message: 'Interaction tracked successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error tracking interaction',
      error: error.message
    });
  }
};

// @desc    Get user's recommendation preferences
// @route   GET /api/recommendations/preferences
// @access  Private
export const getPreferences = async (req, res) => {
  try {
    
    let preferences = await UserPreference.findOne({ user: req.user.id });
    if (!preferences) {
      preferences = await recommendationEngine.initializeUserPreferences(req.user.id);
    }

    res.status(200).json({
      status: 'success',
      data: { preferences }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching preferences',
      error: error.message
    });
  }
};

// @desc    Update user's recommendation preferences
// @route   PUT /api/recommendations/preferences
// @access  Private
export const updatePreferences = async (req, res) => {
  try {
    const updates = req.body;

    const preferences = await UserPreference.findOneAndUpdate(
      { user: req.user.id },
      { ...updates, lastUpdated: new Date() },
      { new: true, upsert: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Preferences updated successfully',
      data: { preferences }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating preferences',
      error: error.message
    });
  }
};

// @desc    Get recommendation analytics for user
// @route   GET /api/recommendations/analytics
// @access  Private
export const getAnalytics = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get interaction analytics
    const interactions = await UserInteraction.aggregate([
      {
        $match: {
          user: req.user.id,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            type: '$interactionType',
            day: { $dayOfYear: '$createdAt' }
          },
          count: { $sum: 1 },
          avgDwellTime: { $avg: '$metadata.dwellTime' }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          totalCount: { $sum: '$count' },
          avgDwellTime: { $avg: '$avgDwellTime' },
          dailyBreakdown: {
            $push: {
              day: '$_id.day',
              count: '$count'
            }
          }
        }
      }
    ]);

    // Get top topics
    const topTopics = await UserInteraction.aggregate([
      {
        $match: {
          user: req.user.id,
          targetType: 'post',
          createdAt: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'posts',
          localField: 'targetId',
          foreignField: '_id',
          as: 'post'
        }
      },
      {
        $unwind: '$post'
      },
      {
        $project: {
          topics: {
            $regexFindAll: {
              input: '$post.content.text',
              regex: /\b\w{4,}\b/g
            }
          }
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        interactions,
        topTopics,
        period: `${days} days`
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

// @desc    Provide feedback on recommendations
// @route   POST /api/recommendations/feedback
// @access  Private
export const provideFeedback = async (req, res) => {
  try {
    const { postId, feedback, reason } = req.body;

    // Track negative feedback
    if (feedback === 'negative') {
      await recommendationEngine.trackInteraction(
        req.user.id,
        'post',
        postId,
        'hide',
        { reason }
      );
    }

    res.status(200).json({
      status: 'success',
      message: 'Feedback recorded successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error recording feedback',
      error: error.message
    });
  }
};

// @desc    Get users with similar interests
// @route   GET /api/recommendations/similar-users
// @access  Private
export const getSimilarUsers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get current user's preferences
    const userPrefs = await UserPreference.findOne({ user: req.user.id });
    if (!userPrefs) {
      return res.status(200).json({
        status: 'success',
        data: { users: [] }
      });
    }

    // Find users with similar topic interests
    const userTopics = userPrefs.contentPreferences.topics
      .filter(t => t.score > 0)
      .map(t => t.keyword);

    const similarUsers = await UserPreference.aggregate([
      {
        $match: {
          user: { $ne: req.user.id },
          'contentPreferences.topics.keyword': { $in: userTopics }
        }
      },
      {
        $addFields: {
          similarity: {
            $size: {
              $setIntersection: [
                '$contentPreferences.topics.keyword',
                userTopics
              ]
            }
          }
        }
      },
      {
        $sort: { similarity: -1 }
      },
      {
        $limit: Number(limit)
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $project: {
          user: {
            _id: '$userInfo._id',
            name: '$userInfo.name',
            username: '$userInfo.username',
            profilePicture: '$userInfo.profilePicture',
            isVerified: '$userInfo.isVerified'
          },
          similarity: 1,
          commonTopics: {
            $setIntersection: [
              '$contentPreferences.topics.keyword',
              userTopics
            ]
          }
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: { users: similarUsers.map(user => ({ ...user.user, id: user._id })) }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error finding similar users',
      error: error.message
    });
  }
};