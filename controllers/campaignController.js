import Campaign from '../models/Campaign.js';
import AdSet from '../models/AdSet.js';
import Ad from '../models/Ad.js';
import User from '../models/User.js';
import stripe from '../utils/stripe.js';
import paypal from '../utils/paypal.js';

// @desc    Create a new campaign
// @route   POST /api/campaigns
// @access  Private
export const createCampaign = async (req, res) => {
  try {
    const {
      name,
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

    const campaign = await Campaign.create({
      name,
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

// @desc    Get all campaigns for user
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

    res.status(200).json({
      status: 'success',
      data: { campaigns }
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