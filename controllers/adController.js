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
