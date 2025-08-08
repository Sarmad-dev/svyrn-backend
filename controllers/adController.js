import Ad from "../models/Ad.js";
import cloudinary from "../utils/cloudinary.js";

// @desc    Create a new ad campaign
// @route   POST /api/ads
// @access  Private
export const createAd = async (req, res) => {
  try {
    const image = req.body.image;
    const result = await cloudinary.uploader.upload(image, {
      resource_type: "image",
    });

    const adData = {
      title: req.body.title,
      description: req.body.description,
      tags: req.body.tags,
      advertiser: req.user.id,
      image: result.secure_url,
      campaign: {
        name: req.body.title,
        campaignType: req.body.campaignType,
      },
      creative: {
        type: "image",
        media: [{ url: result.secure_url }],
      },
      duration: req.body.duration,
      budget: { amount: req.body.budget, currency: "USD" },
    };

    const ad = await Ad.create(adData);
    await ad.populate("advertiser", "name username profilePicture");

    res.status(201).json({
      status: "success",
      message: "Ad campaign created successfully",
      data: { ad },
    });
  } catch (error) {
    console.log("AD Creation Error: ", error);
    res.status(500).json({
      status: "error",
      message: "Error creating ad campaign",
      error: error.message,
    });
  }
};

// @desc    Get user's ad campaigns
// @route   GET /api/ads
// @access  Private
export const getAds = async (req, res) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    let query = { isActive: true };

    if (status) {
      query.status = status;
    }

    const ads = await Ad.find(query)
      .populate("advertiser", "name username profilePicture")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Ad.countDocuments(query);

    res.status(200).json({
      status: "success",
      data: {
        ads,
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
      message: "Error fetching ad campaigns",
      error: error.message,
    });
  }
};

// @desc    Get user's ad campaigns
// @route   GET /api/ads/user/:id
// @access  Private
export const getUserAds = async (req, res) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    let query = { advertiser: req.user._id, isActive: true };

    if (status) {
      query.status = status;
    }

    const ads = await Ad.find(query)
      .populate("advertiser", "name username profilePicture")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Ad.countDocuments(query);

    res.status(200).json({
      status: "success",
      data: {
        ads,
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
      message: "Error fetching ad campaigns",
      error: error.message,
    });
  }
};

// @desc    Get ad campaign details
// @route   GET /api/ads/:id
// @access  Private
export const getAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id).populate(
      "advertiser",
      "firstName lastName profilePicture"
    );

    if (!ad || !ad.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Ad campaign not found",
      });
    }

    if (ad.advertiser._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Access denied",
      });
    }

    res.status(200).json({
      status: "success",
      data: { ad },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching ad campaign",
      error: error.message,
    });
  }
};

// @desc    Update ad campaign
// @route   PUT /api/ads/:id
// @access  Private
export const updateAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad || !ad.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Ad campaign not found",
      });
    }

    if (ad.advertiser.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Access denied",
      });
    }

    // Cannot update active campaigns
    if (ad.status === "active") {
      return res.status(400).json({
        status: "error",
        message: "Cannot update active campaigns. Pause the campaign first.",
      });
    }

    Object.assign(ad, req.body);
    await ad.save();

    await ad.populate("advertiser", "name username profilePicture");

    res.status(200).json({
      status: "success",
      message: "Ad campaign updated successfully",
      data: { ad },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error updating ad campaign",
      error: error.message,
    });
  }
};

// @desc    Update ad campaign status
// @route   PATCH /api/ads/:id/status
// @access  Private
export const updateAdStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["active", "paused", "completed"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid status",
      });
    }

    const ad = await Ad.findById(req.params.id);

    if (!ad || !ad.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Ad campaign not found",
      });
    }

    if (ad.advertiser.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Access denied",
      });
    }

    ad.status = status;
    await ad.save();

    res.status(200).json({
      status: "success",
      message: `Ad campaign ${status} successfully`,
      data: { status: ad.status },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error updating ad status",
      error: error.message,
    });
  }
};

// @desc    Get ad performance metrics
// @route   GET /api/ads/:id/performance
// @access  Private
export const getAdPerformance = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad || !ad.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Ad campaign not found",
      });
    }

    if (ad.advertiser.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Access denied",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        performance: ad.performance,
        budget: ad.budget,
        status: ad.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching performance metrics",
      error: error.message,
    });
  }
};

// @desc    Update ad performance metrics
// @route   PATCH /api/ads/:id/performance
// @access  Private
export const updateAdPerformance = async (req, res) => {
  try {
    const {
      impressions,
      clicks,
      conversions,
      viewDuration,
      engagementActions,
      geographicData,
      demographicData,
      deviceInfo,
      interactionType,
      fraudCheck = true
    } = req.body;

    const ad = await Ad.findById(req.params.id);

    if (!ad || !ad.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Ad not found'
      });
    }

    // Check permissions - advertiser or system can update
    if (ad.advertiser.toString() !== req.user._id.toString() && req.user.role !== 'system') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    // Fraud detection for suspicious activity
    if (fraudCheck) {
      const fraudScore = await detectFraudulentActivity(req.params.id, req.body, req);
      if (fraudScore > 0.8) {
        return res.status(400).json({
          status: 'error',
          message: 'Suspicious activity detected. Performance update rejected.',
          fraudScore
        });
      }
    }

    // Create performance record
    const performanceData = {
      adId: req.params.id,
      advertiser: ad.advertiser,
      timestamp: new Date(),
      metrics: {
        impressions: impressions || 0,
        clicks: clicks || 0,
        conversions: conversions || 0,
        viewDuration: viewDuration || 0,
        engagementActions: engagementActions || {}
      },
      geographicData: geographicData || {},
      demographicData: demographicData || {},
      deviceInfo: deviceInfo || {},
      interactionType: interactionType || 'impression',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress
    };

    // Store detailed interaction record
    await AdInteraction.create(performanceData);

    // Update ad's aggregate performance
    const updatedPerformance = await updateAggregatePerformance(ad, req.body);
    
    // Update the ad document
    ad.performance = updatedPerformance;
    await ad.save();

    // Store daily performance summary
    await updateDailyPerformanceSummary(req.params.id, req.body);

    res.status(200).json({
      status: 'success',
      message: 'Ad performance updated successfully',
      data: {
        performance: updatedPerformance,
        timestamp: new Date()
      }
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating ad performance',
      error: error.message
    });
  }
};

// @desc    Batch update ad performance (for high-volume scenarios)
// @route   PATCH /api/ads/performance/batch
// @access  Private (System only)
export const batchUpdatePerformance = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Updates array is required'
      });
    }

    if (updates.length > 1000) {
      return res.status(400).json({
        status: 'error',
        message: 'Maximum 1000 updates per batch'
      });
    }

    const results = [];
    const errors = [];

    // Process updates in parallel batches of 50
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (update) => {
        try {
          const { adId, ...performanceData } = update;
          
          const ad = await Ad.findById(adId);
          if (!ad) {
            throw new Error(`Ad ${adId} not found`);
          }

          // Create interaction record
          await AdInteraction.create({
            adId,
            advertiser: ad.advertiser,
            timestamp: new Date(),
            ...performanceData
          });

          // Update aggregate performance
          const updatedPerformance = await updateAggregatePerformance(ad, performanceData);
          ad.performance = updatedPerformance;
          await ad.save();

          return { adId, status: 'success' };
        } catch (error) {
          return { adId: update.adId, status: 'error', error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r.status === 'success'));
      errors.push(...batchResults.filter(r => r.status === 'error'));
    }

    res.status(200).json({
      status: 'success',
      message: 'Batch update completed',
      data: {
        successful: results.length,
        failed: errors.length,
        errors: errors.slice(0, 10) // Return first 10 errors
      }
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Batch update failed',
      error: error.message
    });
  }
};

// Helper function to detect fraudulent activity
export const detectFraudulentActivity = async (adId, performanceData, req) => {
  let fraudScore = 0;

  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check for excessive clicks from same IP
    const recentInteractions = await AdInteraction.countDocuments({
      adId,
      ipAddress,
      timestamp: { $gte: oneHourAgo },
      'metrics.clicks': { $gt: 0 }
    });

    if (recentInteractions > 10) fraudScore += 0.4;

    // Check for suspicious user agent patterns
    if (!userAgent || userAgent.length < 20) fraudScore += 0.2;

    // Check for impossible click-through rates
    const { impressions = 0, clicks = 0 } = performanceData.metrics || performanceData;
    if (impressions > 0 && clicks > 0) {
      const ctr = clicks / impressions;
      if (ctr > 0.5) fraudScore += 0.3; // CTR above 50% is suspicious
    }

    // Check for rapid-fire interactions
    const lastInteraction = await AdInteraction.findOne({
      adId,
      ipAddress
    }).sort({ timestamp: -1 });

    if (lastInteraction) {
      const timeDiff = now - lastInteraction.timestamp;
      if (timeDiff < 1000) fraudScore += 0.3; // Less than 1 second
    }

    // Check for missing geographic data (bots often lack this)
    if (!performanceData.geographicData || Object.keys(performanceData.geographicData).length === 0) {
      fraudScore += 0.1;
    }

    return Math.min(fraudScore, 1.0);
  } catch (error) {
    console.error('Fraud detection error:', error);
    return 0; // Default to no fraud if detection fails
  }
};

// Helper function to update aggregate performance
export const updateAggregatePerformance = async (ad, performanceData) => {
  const { metrics = {} } = performanceData;
  const currentPerf = ad.performance;

  // Update aggregate metrics
  const newImpressions = currentPerf.impressions + (metrics.impressions || 0);
  const newClicks = currentPerf.clicks + (metrics.clicks || 0);
  const newConversions = currentPerf.conversions + (metrics.conversions || 0);
  const newSpend = currentPerf.spend + (metrics.spend || 0);

  // Calculate derived metrics
  const ctr = newImpressions > 0 ? (newClicks / newImpressions) * 100 : 0;
  const cpc = newClicks > 0 ? newSpend / newClicks : 0;
  const cpm = newImpressions > 0 ? (newSpend / newImpressions) * 1000 : 0;
  const conversionRate = newClicks > 0 ? (newConversions / newClicks) * 100 : 0;

  return {
    impressions: newImpressions,
    clicks: newClicks,
    conversions: newConversions,
    spend: newSpend,
    ctr: Math.round(ctr * 100) / 100,
    cpc: Math.round(cpc * 100) / 100,
    cpm: Math.round(cpm * 100) / 100,
    conversionRate: Math.round(conversionRate * 100) / 100,
    lastUpdated: new Date()
  };
};

// Helper function to update daily performance summary
export const updateDailyPerformanceSummary = async (adId, performanceData) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { metrics = {} } = performanceData;

    await AdPerformance.findOneAndUpdate(
      { adId, date: today },
      {
        $inc: {
          impressions: metrics.impressions || 0,
          clicks: metrics.clicks || 0,
          conversions: metrics.conversions || 0,
          spend: metrics.spend || 0
        },
        $set: { lastUpdated: new Date() }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error updating daily performance summary:', error);
  }
};