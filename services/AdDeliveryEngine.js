import Ad from '../models/Ad.js';
import AdSet from '../models/AdSet.js';
import Campaign from '../models/Campaign.js';
import AdDelivery from '../models/AdDelivery.js';
import User from '../models/User.js';
import UserInteraction from '../models/UserInteraction.js';

class AdDeliveryEngine {
  constructor() {
    this.deliveryWeights = {
      targeting: 0.4,     // How well user matches targeting
      bidAmount: 0.25,    // Advertiser bid amount
      relevance: 0.2,     // Ad relevance to user
      freshness: 0.1,     // How new the ad is
      performance: 0.05   // Historical ad performance
    };
  }

  // Main method to get ads for user feed
  async getAdsForUser(userId, placement = 'feed', limit = 3) {
    try {
      const user = await User.findById(userId);
      if (!user) return [];

      // Get user context
      const userContext = await this.getUserContext(user);
      
      // Get eligible ads
      const eligibleAds = await this.getEligibleAds(userContext, placement);
      
      // Score and rank ads
      const scoredAds = await this.scoreAds(eligibleAds, userContext);
      
      // Apply frequency capping
      const filteredAds = await this.applyFrequencyCapping(scoredAds, userId);
      
      // Run ad auction
      const selectedAds = this.runAdAuction(filteredAds, limit);
      
      // Record ad deliveries
      await this.recordAdDeliveries(selectedAds, userId, placement, userContext);
      
      return selectedAds.map(ad => ({
        ...ad.ad.toObject(),
        deliveryScore: ad.score,
        placement,
        isAd: true
      }));
      
    } catch (error) {
      console.error('Ad delivery error:', error);
      return [];
    }
  }

  // Get user context for ad targeting
  async getUserContext(user) {
    // Get recent user interactions
    const recentInteractions = await UserInteraction.find({
      user: user._id,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    }).limit(1000);

    // Extract interests from interactions
    const interests = this.extractUserInterests(recentInteractions);
    
    // Get user demographics
    const demographics = {
      age: user.dateOfBirth ? this.calculateAge(user.dateOfBirth) : null,
      location: user.location || null,
      language: user.language || 'en'
    };

    return {
      user,
      demographics,
      interests,
      recentInteractions,
      currentTime: new Date()
    };
  }

  // Get ads eligible for delivery
  async getEligibleAds(userContext, placement) {
    const now = new Date();
    
    const eligibleAds = await Ad.find({
      status: 'active',
      isActive: true,
      'schedule.startDate': { $lte: now },
      'schedule.endDate': { $gte: now },
      'placement.platforms': placement
    })
    .populate('campaign')
    .populate('adSet')
    .populate('creative');

    // Filter by targeting criteria
    return eligibleAds.filter(ad => 
      this.matchesTargeting(ad, userContext)
    );
  }

  // Check if user matches ad targeting
  matchesTargeting(ad, userContext) {
    const { demographics, interests } = userContext;
    const targeting = ad.adSet.targeting;

    // Age targeting
    if (targeting.demographics.ageMin && targeting.demographics.ageMax) {
      if (!demographics.age || 
          demographics.age < targeting.demographics.ageMin || 
          demographics.age > targeting.demographics.ageMax) {
        return false;
      }
    }

    // Gender targeting
    if (targeting.demographics.genders && targeting.demographics.genders.length > 0) {
      if (!targeting.demographics.genders.includes(userContext.user.gender)) {
        return false;
      }
    }

    // Interest targeting
    if (targeting.interests && targeting.interests.length > 0) {
      const hasMatchingInterest = targeting.interests.some(targetInterest =>
        interests.some(userInterest => 
          userInterest.keyword.toLowerCase().includes(targetInterest.toLowerCase())
        )
      );
      if (!hasMatchingInterest) {
        return false;
      }
    }

    // Location targeting (simplified)
    if (targeting.location.countries && targeting.location.countries.length > 0) {
      // This would need proper geolocation implementation
      // For now, we'll assume it matches
    }

    return true;
  }

  // Score ads for ranking
  async scoreAds(ads, userContext) {
    const scoredAds = [];

    for (const ad of ads) {
      const score = await this.calculateAdScore(ad, userContext);
      scoredAds.push({ ad, score });
    }

    return scoredAds.sort((a, b) => b.score - a.score);
  }

  // Calculate individual ad score
  async calculateAdScore(ad, userContext) {
    let score = 0;

    // Targeting score
    const targetingScore = this.calculateTargetingScore(ad, userContext);
    score += targetingScore * this.deliveryWeights.targeting;

    // Bid amount score (normalized)
    const bidScore = Math.min(ad.adSet.bidAmount / 10, 1); // Normalize to 0-1
    score += bidScore * this.deliveryWeights.bidAmount;

    // Relevance score
    const relevanceScore = this.calculateRelevanceScore(ad, userContext);
    score += relevanceScore * this.deliveryWeights.relevance;

    // Freshness score
    const freshnessScore = this.calculateFreshnessScore(ad);
    score += freshnessScore * this.deliveryWeights.freshness;

    // Performance score
    const performanceScore = this.calculatePerformanceScore(ad);
    score += performanceScore * this.deliveryWeights.performance;

    return Math.max(0, Math.min(1, score));
  }

  // Calculate targeting match score
  calculateTargetingScore(ad, userContext) {
    let score = 0;
    let factors = 0;

    const targeting = ad.adSet.targeting;
    const { demographics, interests } = userContext;

    // Age match
    if (targeting.demographics.ageMin && targeting.demographics.ageMax && demographics.age) {
      const ageRange = targeting.demographics.ageMax - targeting.demographics.ageMin;
      const ageDistance = Math.abs(demographics.age - (targeting.demographics.ageMin + ageRange / 2));
      score += Math.max(0, 1 - (ageDistance / (ageRange / 2)));
      factors++;
    }

    // Interest match
    if (targeting.interests && targeting.interests.length > 0) {
      const matchingInterests = targeting.interests.filter(targetInterest =>
        interests.some(userInterest => 
          userInterest.keyword.toLowerCase().includes(targetInterest.toLowerCase())
        )
      );
      score += matchingInterests.length / targeting.interests.length;
      factors++;
    }

    return factors > 0 ? score / factors : 0.5;
  }

  // Calculate ad relevance score
  calculateRelevanceScore(ad, userContext) {
    // This would analyze ad content against user interests
    // For now, return a base score
    return 0.5;
  }

  // Calculate ad freshness score
  calculateFreshnessScore(ad) {
    const ageHours = (Date.now() - ad.createdAt) / (1000 * 60 * 60);
    return Math.max(0, 1 - (ageHours / (7 * 24))); // Decay over 7 days
  }

  // Calculate ad performance score
  calculatePerformanceScore(ad) {
    const performance = ad.performance;
    if (performance.impressions === 0) return 0.5;

    const ctr = performance.clicks / performance.impressions;
    return Math.min(ctr * 20, 1); // Normalize CTR to 0-1 scale
  }

  // Apply frequency capping
  async applyFrequencyCapping(scoredAds, userId) {
    const filtered = [];

    for (const scoredAd of scoredAds) {
      const ad = scoredAd.ad;
      const frequencyCap = ad.adSet.frequencyCap;

      // Check recent deliveries
      const recentDeliveries = await AdDelivery.countDocuments({
        ad: ad._id,
        user: userId,
        deliveredAt: {
          $gte: this.getFrequencyCapWindow(frequencyCap.timeWindow)
        }
      });

      if (recentDeliveries < frequencyCap.impressions) {
        filtered.push(scoredAd);
      }
    }

    return filtered;
  }

  // Get frequency cap time window
  getFrequencyCapWindow(timeWindow) {
    const now = new Date();
    switch (timeWindow) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  // Run ad auction to select final ads
  runAdAuction(scoredAds, limit) {
    // Simple auction: select top scoring ads
    return scoredAds.slice(0, limit);
  }

  // Record ad deliveries for tracking
  async recordAdDeliveries(selectedAds, userId, placement, userContext) {
    const deliveries = selectedAds.map((scoredAd, index) => ({
      ad: scoredAd.ad._id,
      user: userId,
      campaign: scoredAd.ad.campaign,
      adSet: scoredAd.ad.adSet,
      placement,
      position: index + 1,
      userContext: {
        location: userContext.demographics.location,
        device: 'web', // This would come from request headers
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay()
      },
      targetingScore: {
        overall: scoredAd.score
      },
      deliveredAt: new Date()
    }));

    await AdDelivery.insertMany(deliveries);
  }

  // Extract user interests from interactions
  extractUserInterests(interactions) {
    const interestMap = new Map();

    interactions.forEach(interaction => {
      if (interaction.metadata && interaction.metadata.topics) {
        interaction.metadata.topics.forEach(topic => {
          const current = interestMap.get(topic) || { keyword: topic, score: 0, frequency: 0 };
          current.score += this.getInteractionWeight(interaction.interactionType);
          current.frequency += 1;
          interestMap.set(topic, current);
        });
      }
    });

    return Array.from(interestMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Top 20 interests
  }

  // Get interaction weight for interest calculation
  getInteractionWeight(interactionType) {
    const weights = {
      'view': 0.1,
      'like': 0.3,
      'comment': 0.5,
      'share': 0.7,
      'save': 0.6,
      'click': 0.4
    };
    return weights[interactionType] || 0.1;
  }

  // Calculate user age from date of birth
  calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  // Track ad interaction
  async trackAdInteraction(adId, userId, interactionType, metadata = {}) {
    try {
      const ad = await Ad.findById(adId);
      if (!ad) return;

      // Update ad performance
      switch (interactionType) {
        case 'impression':
          ad.performance.impressions += 1;
          break;
        case 'click':
          ad.performance.clicks += 1;
          break;
        case 'conversion':
          ad.performance.conversions += 1;
          break;
      }

      // Recalculate derived metrics
      if (ad.performance.impressions > 0) {
        ad.performance.ctr = (ad.performance.clicks / ad.performance.impressions) * 100;
      }

      ad.performance.lastUpdated = new Date();
      await ad.save();

      // Update campaign and ad set performance
      await this.updateCampaignPerformance(ad.campaign, interactionType);
      await this.updateAdSetPerformance(ad.adSet, interactionType);

    } catch (error) {
      console.error('Error tracking ad interaction:', error);
    }
  }

  // Update campaign performance
  async updateCampaignPerformance(campaignId, interactionType) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return;

    switch (interactionType) {
      case 'impression':
        campaign.performance.impressions += 1;
        break;
      case 'click':
        campaign.performance.clicks += 1;
        break;
      case 'conversion':
        campaign.performance.conversions += 1;
        break;
    }

    // Recalculate derived metrics
    if (campaign.performance.impressions > 0) {
      campaign.performance.ctr = (campaign.performance.clicks / campaign.performance.impressions) * 100;
    }

    campaign.performance.lastUpdated = new Date();
    await campaign.save();
  }

  // Update ad set performance
  async updateAdSetPerformance(adSetId, interactionType) {
    const adSet = await AdSet.findById(adSetId);
    if (!adSet) return;

    switch (interactionType) {
      case 'impression':
        adSet.performance.impressions += 1;
        break;
      case 'click':
        adSet.performance.clicks += 1;
        break;
      case 'conversion':
        adSet.performance.conversions += 1;
        break;
    }

    // Recalculate derived metrics
    if (adSet.performance.impressions > 0) {
      adSet.performance.ctr = (adSet.performance.clicks / adSet.performance.impressions) * 100;
    }

    adSet.performance.lastUpdated = new Date();
    await adSet.save();
  }
}

export default AdDeliveryEngine;