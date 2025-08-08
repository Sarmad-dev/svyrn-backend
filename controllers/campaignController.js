import Campaign from '../models/Campaign.js';
import AdSet from '../models/AdSet.js';
import Ad from '../models/Ad.js';
import stripe from 'stripe';

// @desc    Create a new campaign
// @route   POST /api/campaigns
// @access  Private
export const createCampaign = async (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      advertiser: req.user.id,
      status: 'draft'
    };

    // Calculate total cost
    const campaign = new Campaign(campaignData);
    const totalCost = campaign.calculateTotalCost();
    campaign.payment.totalCost = totalCost;

    await campaign.save();
    await campaign.populate('advertiser', 'firstName lastName email');

    res.status(201).json({
      status: 'success',
      message: 'Campaign created successfully',
      data: { 
        campaign,
        totalCost,
        nextStep: 'payment'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error creating campaign',
      error: error.message
    });
  }
};

// @desc    Process campaign payment
// @route   POST /api/campaigns/:id/payment
// @access  Private
export const processCampaignPayment = async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign || campaign.advertiser.toString() !== req.user.id.toString()) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    if (campaign.payment.paymentStatus === 'succeeded') {
      return res.status(400).json({
        status: 'error',
        message: 'Campaign already paid'
      });
    }

    // Create or retrieve Stripe customer
    let stripeCustomer;
    if (campaign.payment.stripeCustomerId) {
      stripeCustomer = await stripe.customers.retrieve(campaign.payment.stripeCustomerId);
    } else {
      stripeCustomer = await stripe.customers.create({
        email: req.user.email,
        name: `${req.user.firstName} ${req.user.lastName}`,
        metadata: {
          userId: req.user.id.toString(),
          campaignId: campaign._id.toString()
        }
      });
      campaign.payment.stripeCustomerId = stripeCustomer.id;
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(campaign.payment.totalCost * 100), // Convert to cents
      currency: campaign.budget.currency.toLowerCase(),
      customer: stripeCustomer.id,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      description: `Ad Campaign: ${campaign.name}`,
      metadata: {
        campaignId: campaign._id.toString(),
        advertiserId: req.user.id.toString(),
        type: 'campaign_payment'
      }
    });

    // Update campaign with payment intent
    campaign.payment.stripePaymentIntentId = paymentIntent.id;

    if (paymentIntent.status === 'succeeded') {
      campaign.payment.paymentStatus = 'succeeded';
      campaign.payment.paymentDate = new Date();
      campaign.status = 'active';
      
      // Schedule campaign activation
      await scheduleAdActivation(campaign);
    } else if (paymentIntent.status === 'requires_action') {
      campaign.payment.paymentStatus = 'pending';
    } else {
      campaign.payment.paymentStatus = 'failed';
    }

    await campaign.save();

    res.status(200).json({
      status: 'success',
      message: paymentIntent.status === 'succeeded' ? 'Payment successful' : 'Payment requires action',
      data: {
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          client_secret: paymentIntent.client_secret
        },
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
      message: 'Payment processing failed',
      error: error.message
    });
  }
};

// @desc    Get user's campaigns
// @route   GET /api/campaigns
// @access  Private
export const getCampaigns = async (req, res) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    let query = { advertiser: req.user.id, isActive: true };
    if (status) {
      query.status = status;
    }

    const campaigns = await Campaign.find(query)
      .populate('adSets')
      .select('name objective status budget schedule payment performance createdAt')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Campaign.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        campaigns,
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
      message: 'Error fetching campaigns',
      error: error.message
    });
  }
};

// @desc    Get campaign details
// @route   GET /api/campaigns/:id
// @access  Private
export const getCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('advertiser', 'firstName lastName email')
      .populate({
        path: 'adSets',
        populate: {
          path: 'ads',
          model: 'Ad'
        }
      });

    if (!campaign || campaign.advertiser._id.toString() !== req.user.id.toString()) {
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
    res.status(500).json({
      status: 'error',
      message: 'Error fetching campaign',
      error: error.message
    });
  }
};

// @desc    Update campaign
// @route   PUT /api/campaigns/:id
// @access  Private
export const updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);

    if (!campaign || campaign.advertiser.toString() !== req.user.id.toString()) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    // Prevent updates to active campaigns with certain restrictions
    if (campaign.status === 'active') {
      const allowedUpdates = ['name', 'budget.amount', 'schedule.endDate'];
      const updates = Object.keys(req.body);
      const restrictedUpdates = updates.filter(update => !allowedUpdates.includes(update));
      
      if (restrictedUpdates.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot modify targeting or major settings of active campaign',
          restrictedFields: restrictedUpdates
        });
      }
    }

    Object.assign(campaign, req.body);
    
    // Recalculate cost if budget or schedule changed
    if (req.body.budget || req.body.schedule) {
      campaign.payment.totalCost = campaign.calculateTotalCost();
    }

    await campaign.save();
    await campaign.populate('advertiser', 'firstName lastName email');

    res.status(200).json({
      status: 'success',
      message: 'Campaign updated successfully',
      data: { campaign }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating campaign',
      error: error.message
    });
  }
};

// @desc    Pause/Resume campaign
// @route   PATCH /api/campaigns/:id/status
// @access  Private
export const updateCampaignStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'paused'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status. Use "active" or "paused"'
      });
    }

    const campaign = await Campaign.findById(req.params.id);

    if (!campaign || campaign.advertiser.toString() !== req.user.id.toString()) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    if (campaign.payment.paymentStatus !== 'succeeded') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot activate campaign without successful payment'
      });
    }

    campaign.status = status;
    await campaign.save();

    // Update all ad sets and ads status
    await AdSet.updateMany(
      { campaign: campaign._id },
      { status: status }
    );

    await Ad.updateMany(
      { campaign: campaign._id },
      { status: status }
    );

    res.status(200).json({
      status: 'success',
      message: `Campaign ${status} successfully`,
      data: { 
        campaignId: campaign._id,
        status: campaign.status 
      }
    });
  } catch (error) {
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
    const { dateRange = '7d' } = req.query;
    
    const campaign = await Campaign.findById(req.params.id);

    if (!campaign || campaign.advertiser.toString() !== req.user.id.toString()) {
      return res.status(404).json({
        status: 'error',
        message: 'Campaign not found'
      });
    }

    // Get detailed analytics from AdPerformance collection
    const AdPerformance = require('../models/AdPerformance');
    
    let dateFilter = {};
    const now = new Date();
    
    switch (dateRange) {
      case '1d':
        dateFilter = { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
        break;
      case '7d':
        dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      default:
        dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    }

    const analytics = await AdPerformance.aggregate([
      {
        $match: {
          advertiser: campaign.advertiser,
          date: dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          totalConversions: { $sum: '$conversions' },
          totalSpend: { $sum: '$spend' },
          avgCTR: { $avg: '$ctr' },
          avgCPC: { $avg: '$cpc' },
          avgCPM: { $avg: '$cpm' }
        }
      }
    ]);

    const result = analytics[0] || {
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalSpend: 0,
      avgCTR: 0,
      avgCPC: 0,
      avgCPM: 0
    };

    res.status(200).json({
      status: 'success',
      data: {
        campaign: {
          id: campaign._id,
          name: campaign.name,
          status: campaign.status
        },
        analytics: result,
        dateRange,
        performance: campaign.performance
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching campaign analytics',
      error: error.message
    });
  }
};

// Helper function to schedule ad activation
export const scheduleAdActivation = async (campaign) => {
  try {
    const BackgroundJobManager = require('../services/BackgroundJobManager');
    
    // Schedule activation job if start date is in the future
    if (campaign.schedule.startDate > new Date()) {
      BackgroundJobManager.scheduleAdActivation(campaign._id, campaign.schedule.startDate);
    }
    
    // Schedule deactivation job
    BackgroundJobManager.scheduleAdDeactivation(campaign._id, campaign.schedule.endDate);
    
  } catch (error) {
    console.error('Error scheduling ad activation:', error);
  }
};