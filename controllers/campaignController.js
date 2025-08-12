import Campaign from '../models/Campaign.js';
import AdSet from '../models/AdSet.js';
import Ad from '../models/Ad.js';
import User from '../models/User.js';
import stripe from '../utils/stripe.js';
import paypal from '../utils/paypal.js';
import cloudinary from "../utils/cloudinary.js";
import { getMimeTypeFromBase64, getFileCategory } from "../services/ImageUrlCreate.js";

// @desc    Create a new campaign
// @route   POST /api/campaigns
// @access  Private
export const createCampaign = async (req, res) => {
  try {
    const {
      name,
      image,
      objective,
      budget,
      schedule,
      targeting,
      campaignBudgetOptimization = false,
      specialAdCategories = []
    } = req.body;

    // Calculate total cost
    const startDate = new Date(schedule.startDate);
    const endDate = new Date(schedule.endDate);
    const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const totalCost = budget.type === 'daily' ? budget.amount * durationDays : budget.amount;

    let campaignImageUrl = null;

    // Handle image upload if provided
    if (image) {
      try {
        const mimeType = getMimeTypeFromBase64(image);
        const fileCategory = getFileCategory(mimeType);

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(image, {
          resource_type: fileCategory,
          folder: 'campaigns', // Organize by folder
          transformation: [
            { width: 800, height: 600, crop: 'limit' }, // Limit dimensions
            { quality: 'auto:good' } // Optimize quality
          ]
        });

        campaignImageUrl = result.secure_url;
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(400).json({
          status: 'error',
          message: 'Failed to upload campaign image',
          error: uploadError.message
        });
      }
    }

    const campaign = await Campaign.create({
      name,
      image: campaignImageUrl, // Store Cloudinary URL
      advertiser: req.user.id,
      objective,
      budget: {
        ...budget,
        spent: 0
      },
      schedule,
      targeting,
      campaignBudgetOptimization,
      specialAdCategories,
      payment: {
        totalCost,
        paymentStatus: 'pending'
      }
    });

    await campaign.populate('advertiser', 'name username email');

    res.status(201).json({
      status: 'success',
      message: 'Campaign created successfully',
      data: {
        campaign,
        totalCost,
        nextStep: 'Create ad sets'
      }
    });
  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating campaign',
      error: error.message
    });
  }
};

// @desc    Create ad set for a campaign
// @route   POST /api/campaigns/:campaignId/ad-sets
// @access  Private
export const createAdSet = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const {
      name,
      budget,
      bidStrategy,
      bidAmount,
      optimization,
      targeting,
      placement,
      schedule,
      frequencyCap
    } = req.body;

    // Verify campaign exists and belongs to user
    const campaign = await Campaign.findOne({
      _id: campaignId,
      advertiser: req.user.id
    });

    if (!campaign) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    const adSet = await AdSet.create({
      name,
      campaign: campaignId,
      advertiser: req.user.id,
      budget,
      bidStrategy,
      bidAmount,
      optimization,
      targeting,
      placement,
      schedule,
      frequencyCap
    });

    // Add ad set to campaign
    campaign.adSets.push(adSet._id);
    await campaign.save();

    await adSet.populate('campaign', 'name objective');

    res.status(201).json({
      status: 'success',
      message: 'Ad set created successfully',
      data: {
        adSet,
        nextStep: 'Create ads'
      }
    });
  } catch (error) {
    console.error('Ad set creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating ad set',
      error: error.message
    });
  }
};

// @desc    Create ad for an ad set
// @route   POST /api/ad-sets/:adSetId/ads
// @access  Private
export const createAd = async (req, res) => {
  try {
    const { adSetId } = req.params;
    const {
      title,
      description,
      creative,
      budget,
      duration,
      schedule
    } = req.body;

    // Verify ad set exists and belongs to user
    const adSet = await AdSet.findOne({
      _id: adSetId,
      advertiser: req.user.id
    }).populate('campaign');

    if (!adSet) {
      return res.status(404).json({
        status: 'error',
        message: 'Ad set not found'
      });
    }

    const ad = await Ad.create({
      title,
      description,
      adSet: adSetId,
      campaign: adSet.campaign._id,
      advertiser: req.user.id,
      creative,
      budget,
      duration,
      schedule,
      delivery: {
        totalBudget: budget.amount,
        remainingBudget: budget.amount
      }
    });

    // Add ad to ad set
    adSet.ads.push(ad._id);
    await adSet.save();

    await ad.populate('adSet campaign', 'name');

    res.status(201).json({
      status: 'success',
      message: 'Ad created successfully',
      data: {
        ad,
        nextStep: 'Review and launch'
      }
    });
  } catch (error) {
    console.error('Ad creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating ad',
      error: error.message
    });
  }
};

// @desc    Process campaign payment (generic payment handler)
// @route   POST /api/campaigns/:id/payment
// @access  Private
export const processCampaignPayment = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { paymentMethod, paymentData } = req.body;

    const campaign = await Campaign.findOne({
      _id: campaignId,
      advertiser: req.user.id
    });

    if (!campaign) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    if (campaign.payment.paymentStatus === 'succeeded') {
      return res.status(400).json({
        status: 'error',
        message: 'Campaign already paid for'
      });
    }

    let paymentResult;

    // Route to appropriate payment processor
    if (paymentMethod === 'stripe') {
      const { paymentMethodId } = paymentData;
      paymentResult = await stripe.paymentIntents.create({
        amount: Math.round(campaign.payment.totalCost * 100),
        currency: campaign.budget.currency.toLowerCase(),
        payment_method: paymentMethodId,
        confirm: true,
        return_url: `${process.env.FRONTEND_URL}/ads/campaigns/${campaignId}/payment/success`,
        metadata: {
          campaignId: campaign._id.toString(),
          advertiserId: req.user.id,
          type: 'campaign_payment'
        }
      });

      campaign.payment.stripePaymentIntentId = paymentResult.id;
      campaign.payment.paymentStatus = paymentResult.status === 'succeeded' ? 'succeeded' : 'pending';
      campaign.payment.paymentMethod = 'stripe';
    } else if (paymentMethod === 'paypal') {
      const { orderID, payerID } = paymentData;
      const order = await paypal.orders.capture(orderID);
      
      if (order.status === 'COMPLETED') {
        paymentResult = { status: 'succeeded' };
        campaign.payment.paypalOrderId = orderID;
        campaign.payment.paypalPayerId = payerID;
        campaign.payment.paymentStatus = 'succeeded';
        campaign.payment.paymentMethod = 'paypal';
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'PayPal payment not completed'
        });
      }
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid payment method'
      });
    }

    campaign.payment.paymentDate = new Date();

    if (paymentResult.status === 'succeeded') {
      campaign.status = 'active';
    }

    await campaign.save();

    res.status(200).json({
      status: 'success',
      message: 'Payment processed successfully',
      data: {
        paymentResult,
        campaign: {
          id: campaign._id,
          status: campaign.status,
          paymentStatus: campaign.payment.paymentStatus
        }
      }
    });
  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Payment failed',
      error: error.message
    });
  }
};

// @desc    Update campaign details
// @route   PUT /api/campaigns/:id
// @access  Private
export const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const campaign = await Campaign.findOne({
      _id: id,
      advertiser: req.user.id
    });

    if (!campaign) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    // Prevent updating certain fields after campaign is active
    if (campaign.status === 'active' || campaign.status === 'completed') {
      const restrictedFields = ['budget', 'schedule', 'targeting'];
      for (const field of restrictedFields) {
        if (updateData[field]) {
          delete updateData[field];
        }
      }
    }

    // Recalculate total cost if budget or schedule changes
    if (updateData.budget || updateData.schedule) {
      const budget = updateData.budget || campaign.budget;
      const schedule = updateData.schedule || campaign.schedule;
      
      if (schedule.startDate && schedule.endDate) {
        const startDate = new Date(schedule.startDate);
        const endDate = new Date(schedule.endDate);
        const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const totalCost = budget.type === 'daily' ? budget.amount * durationDays : budget.amount;
        
        updateData.payment = {
          ...campaign.payment,
          totalCost
        };
      }
    }

    const updatedCampaign = await Campaign.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('advertiser', 'name username email');

    res.status(200).json({
      status: 'success',
      message: 'Campaign updated successfully',
      data: { campaign: updatedCampaign }
    });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating campaign',
      error: error.message
    });
  }
};

// @desc    Get all campaigns for user with optimized data structure
// @route   GET /api/campaigns
// @access  Private
export const getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ advertiser: req.user.id })
      .populate('advertiser', 'name username email')
      .populate({
        path: 'adSets',
        populate: {
          path: 'ads',
          select: 'title status performance'
        }
      })
      .sort({ createdAt: -1 });

    // Transform campaigns to include calculated performance metrics
    const transformedCampaigns = campaigns.map(campaign => {
      // Calculate aggregated performance from ad sets and ads
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalSpend = 0;
      let totalConversions = 0;
      let totalCpc = 0;
      let adCount = 0;

      campaign.adSets.forEach(adSet => {
        if (adSet.ads && adSet.ads.length > 0) {
          adSet.ads.forEach(ad => {
            if (ad.performance) {
              totalImpressions += Number(ad.performance.impressions || 0);
              totalClicks += Number(ad.performance.clicks || 0);
              totalSpend += Number(ad.performance.spend || 0);
              totalConversions += Number(ad.performance.conversions || 0);
              totalCpc += Number(ad.performance.cpc || 0);
              adCount++;
            }
          });
        }
      });

      // Calculate average CPC
      const averageCpc = adCount > 0 ? totalCpc / adCount : 0;

      return {
        _id: campaign._id,
        name: campaign.name,
        image: campaign.image,
        objective: campaign.objective,
        status: campaign.status,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        budget: campaign.budget,
        schedule: campaign.schedule,
        targeting: campaign.targeting,
        payment: campaign.payment,
        performance: {
          impressions: totalImpressions,
          clicks: totalClicks,
          spend: totalSpend,
          conversions: totalConversions,
          cpc: averageCpc,
          ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0
        },
        adSets: campaign.adSets,
        advertiser: campaign.advertiser
      };
    });

    res.status(200).json({
      status: 'success',
      data: { campaigns: transformedCampaigns }
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching campaigns',
      error: error.message
    });
  }
};

// @desc    Get aggregated analytics for all user campaigns
// @route   GET /api/campaigns/analytics/overview
// @access  Private
export const getCampaignsOverview = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ advertiser: req.user.id })
      .populate({
        path: 'adSets',
        populate: {
          path: 'ads',
          select: 'performance'
        }
      });

    // Calculate overall metrics
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpend = 0;
    let totalConversions = 0;
    let totalCampaigns = campaigns.length;
    let activeCampaigns = 0;
    let totalBudget = 0;

    // Aggregate performance data
    campaigns.forEach(campaign => {
      if (campaign.status === 'active') activeCampaigns++;
      
      totalBudget += Number(campaign.budget?.amount || 0);
      
      campaign.adSets.forEach(adSet => {
        if (adSet.ads && adSet.ads.length > 0) {
          adSet.ads.forEach(ad => {
            if (ad.performance) {
              totalImpressions += Number(ad.performance.impressions || 0);
              totalClicks += Number(ad.performance.clicks || 0);
              totalSpend += Number(ad.performance.spend || 0);
              totalConversions += Number(ad.performance.conversions || 0);
            }
          });
        }
      });
    });

    // Calculate derived metrics
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const roi = totalSpend > 0 ? ((totalConversions * 100 - totalSpend) / totalSpend) * 100 : 0;

    // Get performance trends (last 12 months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const trends = Array.from({ length: 12 }, (_, idx) => {
      const monthIndex = (now.getMonth() - (11 - idx) + 12) % 12;
      const monthName = monthNames[monthIndex];
      
      // Filter campaigns created in this month
      const monthCampaigns = campaigns.filter(campaign => {
        const created = new Date(campaign.createdAt);
        return created.getMonth() === monthIndex && created.getFullYear() === now.getFullYear();
      });

      let monthImpressions = 0;
      let monthClicks = 0;
      
      monthCampaigns.forEach(campaign => {
        campaign.adSets.forEach(adSet => {
          if (adSet.ads && adSet.ads.length > 0) {
            adSet.ads.forEach(ad => {
              if (ad.performance) {
                monthImpressions += Number(ad.performance.impressions || 0);
                monthClicks += Number(ad.performance.clicks || 0);
              }
            });
          }
        });
      });

      return {
        month: monthName,
        impressions: monthImpressions,
        clicks: monthClicks
      };
    });

    // Get objective distribution
    const objectiveCounts = campaigns.reduce((acc, campaign) => {
      const objective = campaign.objective || 'unknown';
      acc[objective] = (acc[objective] || 0) + 1;
      return acc;
    }, {});

    const objectiveDistribution = Object.entries(objectiveCounts)
      .filter(([key]) => key !== 'unknown')
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
        value,
        color: getObjectiveColor(name)
      }));

    // Get top performing campaigns
    const campaignPerformance = campaigns.map(campaign => {
      let impressions = 0;
      let clicks = 0;
      let spend = 0;
      
      campaign.adSets.forEach(adSet => {
        if (adSet.ads && adSet.ads.length > 0) {
          adSet.ads.forEach(ad => {
            if (ad.performance) {
              impressions += Number(ad.performance.impressions || 0);
              clicks += Number(ad.performance.clicks || 0);
              spend += Number(ad.performance.spend || 0);
            }
          });
        }
      });

      return {
        _id: campaign._id,
        name: campaign.name,
        impressions,
        clicks,
        spend,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0
      };
    });

    const topPerformers = campaignPerformance
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);

    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          totalCampaigns,
          activeCampaigns,
          totalBudget,
          totalImpressions,
          totalClicks,
          totalSpend,
          totalConversions,
          ctr: Math.round(ctr * 100) / 100,
          conversionRate: Math.round(conversionRate * 100) / 100,
          averageCpc: Math.round(averageCpc * 100) / 100,
          roi: Math.round(roi * 100) / 100
        },
        trends,
        objectiveDistribution,
        topPerformers
      }
    });
  } catch (error) {
    console.error('Get campaigns overview error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching campaigns overview',
      error: error.message
    });
  }
};

// Helper function to get color for objectives
function getObjectiveColor(objective) {
  const colors = {
    awareness: '#4dabf7',
    reach: '#6f3ef0',
    traffic: '#34d399',
    engagement: '#f59e0b',
    lead_generation: '#ef4444',
    conversions: '#2f2f2f'
  };
  return colors[objective] || '#4dabf7';
}

// @desc    Get campaign by ID
// @route   GET /api/campaigns/:id
// @access  Private
export const getCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      advertiser: req.user.id
    })
      .populate('advertiser', 'name username email')
      .populate({
        path: 'adSets',
        populate: {
          path: 'ads',
          select: 'title status performance creative'
        }
      });

    if (!campaign) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { campaign }
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching campaign',
      error: error.message
    });
  }
};

// @desc    Update campaign status
// @route   PATCH /api/campaigns/:id/status
// @access  Private
export const updateCampaignStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const campaign = await Campaign.findOne({
      _id: id,
      advertiser: req.user.id
    });

    if (!campaign) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    // Validate status transition
    const validTransitions = {
      draft: ['pending_payment', 'cancelled'],
      pending_payment: ['active', 'cancelled'],
      active: ['paused', 'completed'],
      paused: ['active', 'completed'],
      completed: [],
      cancelled: []
    };

    if (!validTransitions[campaign.status].includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot transition from ${campaign.status} to ${status}`
      });
    }

    campaign.status = status;
    await campaign.save();

    res.status(200).json({
      status: 'success',
      message: 'Campaign status updated successfully',
      data: { campaign }
    });
  } catch (error) {
    console.error('Update campaign status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating campaign status',
      error: error.message
    });
  }
};

// @desc    Get campaign analytics
// @route   GET /api/campaigns/:id/analytics
// @access  Private
export const getCampaignAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { dateRange = '7d' } = req.query;

    const campaign = await Campaign.findOne({
      _id: id,
      advertiser: req.user.id
    });

    if (!campaign) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    // Calculate date range
    const endDate = new Date();
    let startDate;
    
    switch (dateRange) {
      case '1d':
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get analytics data
    const analytics = {
      campaign: campaign.performance,
      adSets: [],
      ads: [],
      dateRange: {
        start: startDate,
        end: endDate
      }
    };

    // Get ad set analytics
    const adSets = await AdSet.find({ campaign: id });
    for (const adSet of adSets) {
      analytics.adSets.push({
        id: adSet._id,
        name: adSet.name,
        performance: adSet.performance
      });
    }

    // Get ad analytics
    const ads = await Ad.find({ campaign: id });
    for (const ad of ads) {
      analytics.ads.push({
        id: ad._id,
        title: ad.title,
        performance: ad.performance
      });
    }

    res.status(200).json({
      status: 'success',
      data: analytics
    });
  } catch (error) {
    console.error('Get campaign analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching campaign analytics',
      error: error.message
    });
  }
};

// @desc    Delete campaign
// @route   DELETE /api/campaigns/:id
// @access  Private
export const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findOne({
      _id: id,
      advertiser: req.user.id
    });

    if (!campaign) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    // Check if campaign can be deleted (e.g., not active)
    if (campaign.status === 'active') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete active campaign. Please pause it first.'
      });
    }

    // Delete associated ad sets and ads
    await AdSet.deleteMany({ campaign: id });
    await Ad.deleteMany({ campaign: id });
    
    // Delete the campaign
    await Campaign.findByIdAndDelete(id);

    res.status(200).json({
      status: 'success',
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting campaign',
      error: error.message
    });
  }
};

// @desc    Get campaign ad sets
// @route   GET /api/campaigns/:campaignId/ad-sets
// @access  Private
export const getCampaignAdSets = async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Verify campaign ownership
    const campaign = await Campaign.findOne({
      _id: campaignId,
      advertiser: req.user.id
    });

    if (!campaign) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    const adSets = await AdSet.find({ campaign: campaignId })
      .populate('ads', 'title status performance')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: { adSets }
    });
  } catch (error) {
    console.error('Get campaign ad sets error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching ad sets',
      error: error.message
    });
  }
};

// @desc    Get ad set ads
// @route   GET /api/campaigns/ad-sets/:adSetId/ads
// @access  Private
export const getAdSetAds = async (req, res) => {
  try {
    const { adSetId } = req.params;

    // Verify ad set ownership through campaign
    const adSet = await AdSet.findById(adSetId).populate('campaign', 'advertiser');
    
    if (!adSet || adSet.campaign.advertiser.toString() !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        message: 'Ad set not found'
      });
    }

    const ads = await Ad.find({ adSet: adSetId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: { ads }
    });
  } catch (error) {
    console.error('Get ad set ads error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching ads',
      error: error.message
    });
  }
};