import Ad from '../models/Ad.js';
import AdSet from '../models/AdSet.js';
import Campaign from '../models/Campaign.js';
import AdInteraction from '../models/AdInteraction.js';
import User from '../models/User.js';

class AdDeliveryEngine {
  constructor() {
    this.activeAds = new Map();
    this.userAdHistory = new Map();
    this.loadActiveAds();
  }

  // Load all active ads into memory for fast access
  async loadActiveAds() {
    try {
      const activeAds = await Ad.find({
        status: 'active',
        'delivery.isDelivering': true,
        'schedule.startDate': { $lte: new Date() },
        'schedule.endDate': { $gte: new Date() }
      }).populate('adSet campaign');

      this.activeAds.clear();
      activeAds.forEach(ad => {
        this.activeAds.set(ad._id.toString(), ad);
      });

      console.log(`Loaded ${activeAds.length} active ads`);
    } catch (error) {
      console.error('Error loading active ads:', error);
    }
  }

  // Get ads for a specific user based on targeting
  async getAdsForUser(userId, placement = 'feed', limit = 5) {
    try {
      const user = await User.findById(userId);
      if (!user) return [];

      const eligibleAds = [];
      const now = new Date();

      for (const [adId, ad] of this.activeAds) {
        if (this.isAdEligibleForUser(ad, user, placement)) {
          eligibleAds.push(ad);
        }
      }

      // Sort by relevance score and select top ads
      const scoredAds = eligibleAds
        .map(ad => ({
          ad,
          score: this.calculateRelevanceScore(ad, user)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.ad);

      return scoredAds;
    } catch (error) {
      console.error('Error getting ads for user:', error);
      return [];
    }
  }

  // Check if an ad is eligible for a specific user
  isAdEligibleForUser(ad, user, placement) {
    // Check placement
    if (!ad.adSet.placement.platforms.includes(placement)) {
      return false;
    }

    // Check if user has already seen this ad too many times
    const userHistory = this.userAdHistory.get(user._id.toString()) || new Map();
    const adHistory = userHistory.get(ad._id.toString()) || { impressions: 0, clicks: 0 };
    
    if (adHistory.impressions >= ad.adSet.frequencyCap.impressions) {
      return false;
    }

    // Check targeting
    if (!this.matchesTargeting(ad.adSet.targeting, user)) {
      return false;
    }

    // Check budget
    if (ad.delivery.remainingBudget <= 0) {
      return false;
    }

    return true;
  }

  // Check if user matches ad set targeting
  matchesTargeting(targeting, user) {
    // Demographics targeting
    if (targeting.demographics) {
      const userAge = this.calculateUserAge(user.dateOfBirth);
      if (userAge < targeting.demographics.ageMin || userAge > targeting.demographics.ageMax) {
        return false;
      }

      if (targeting.demographics.genders.length > 0 && 
          !targeting.demographics.genders.includes(user.gender)) {
        return false;
      }
    }

    // Location targeting
    if (targeting.location && user.location) {
      if (targeting.location.countries.length > 0 && 
          !targeting.location.countries.includes(user.location.country)) {
        return false;
      }
    }

    // Interests targeting (simplified - you can expand this)
    if (targeting.interests && targeting.interests.length > 0) {
      const userInterests = user.interests || [];
      const hasMatchingInterest = targeting.interests.some(interest => 
        userInterests.includes(interest.category)
      );
      if (!hasMatchingInterest) {
        return false;
      }
    }

    return true;
  }

  // Calculate relevance score for ad ranking
  calculateRelevanceScore(ad, user) {
    let score = 0;

    // Base score
    score += 10;

    // Interest matching
    if (ad.adSet.targeting.interests && user.interests) {
      const matchingInterests = ad.adSet.targeting.interests.filter(interest =>
        user.interests.includes(interest.category)
      );
      score += matchingInterests.length * 5;
    }

    // Performance score
    if (ad.performance.ctr > 0) {
      score += Math.min(ad.performance.ctr * 10, 20);
    }

    // Freshness score (newer ads get higher scores)
    const daysSinceCreation = (new Date() - new Date(ad.createdAt)) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - daysSinceCreation);

    return score;
  }

  // Record ad impression
  async recordImpression(adId, userId, context = {}) {
    try {
      const ad = this.activeAds.get(adId);
      if (!ad) return;

      // Update ad performance
      ad.performance.impressions += 1;
      ad.updatePerformance();

      // Update ad set performance
      const adSet = await AdSet.findById(ad.adSet);
      if (adSet) {
        adSet.performance.impressions += 1;
        adSet.updatePerformance();
        await adSet.save();
      }

      // Update campaign performance
      const campaign = await Campaign.findById(ad.campaign);
      if (campaign) {
        campaign.performance.impressions += 1;
        campaign.updatePerformance();
        await campaign.save();
      }

      // Save ad performance
      await ad.save();

      // Record interaction
      await AdInteraction.create({
        ad: adId,
        adSet: ad.adSet,
        campaign: ad.campaign,
        user: userId,
        type: 'impression',
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        device: context.device,
        platform: context.platform
      });

      // Update user history
      this.updateUserHistory(userId, adId, 'impression');

    } catch (error) {
      console.error('Error recording impression:', error);
    }
  }

  // Record ad click
  async recordClick(adId, userId, context = {}) {
    try {
      const ad = this.activeAds.get(adId);
      if (!ad) return;

      // Update ad performance
      ad.performance.clicks += 1;
      ad.updatePerformance();

      // Update ad set performance
      const adSet = await AdSet.findById(ad.adSet);
      if (adSet) {
        adSet.performance.clicks += 1;
        adSet.updatePerformance();
        await adSet.save();
      }

      // Update campaign performance
      const campaign = await Campaign.findById(ad.campaign);
      if (campaign) {
        campaign.performance.clicks += 1;
        campaign.updatePerformance();
        await campaign.save();
      }

      // Save ad performance
      await ad.save();

      // Record interaction
      await AdInteraction.create({
        ad: adId,
        adSet: ad.adSet,
        campaign: ad.campaign,
        user: userId,
        type: 'click',
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        device: context.device,
        platform: context.platform
      });

      // Update user history
      this.updateUserHistory(userId, adId, 'click');

    } catch (error) {
      console.error('Error recording click:', error);
    }
  }

  // Record ad conversion
  async recordConversion(adId, userId, conversionData = {}, context = {}) {
    try {
      const ad = this.activeAds.get(adId);
      if (!ad) return;

      // Update ad performance
      ad.performance.conversions += 1;
      ad.updatePerformance();

      // Update ad set performance
      const adSet = await AdSet.findById(ad.adSet);
      if (adSet) {
        adSet.performance.conversions += 1;
        adSet.updatePerformance();
        await adSet.save();
      }

      // Update campaign performance
      const campaign = await Campaign.findById(ad.campaign);
      if (campaign) {
        campaign.performance.conversions += 1;
        campaign.updatePerformance();
        await campaign.save();
      }

      // Save ad performance
      await ad.save();

      // Record interaction
      await AdInteraction.create({
        ad: adId,
        adSet: ad.adSet,
        campaign: ad.campaign,
        user: userId,
        type: 'conversion',
        conversion: conversionData,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        device: context.device,
        platform: context.platform
      });

    } catch (error) {
      console.error('Error recording conversion:', error);
    }
  }

  // Update user ad history
  updateUserHistory(userId, adId, action) {
    if (!this.userAdHistory.has(userId)) {
      this.userAdHistory.set(userId, new Map());
    }

    const userHistory = this.userAdHistory.get(userId);
    if (!userHistory.has(adId)) {
      userHistory.set(adId, { impressions: 0, clicks: 0 });
    }

    const adHistory = userHistory.get(adId);
    if (action === 'impression') {
      adHistory.impressions += 1;
    } else if (action === 'click') {
      adHistory.clicks += 1;
    }
  }

  // Calculate user age from date of birth
  calculateUserAge(dateOfBirth) {
    if (!dateOfBirth) return 25; // Default age if not provided
    
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  // Refresh active ads (called periodically)
  async refreshActiveAds() {
    await this.loadActiveAds();
  }

  // Get ad delivery statistics
  async getDeliveryStats() {
    try {
      const stats = {
        totalActiveAds: this.activeAds.size,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        averageCTR: 0,
        averageCPC: 0
      };

      for (const ad of this.activeAds.values()) {
        stats.totalImpressions += ad.performance.impressions;
        stats.totalClicks += ad.performance.clicks;
        stats.totalConversions += ad.performance.conversions;
      }

      if (stats.totalImpressions > 0) {
        stats.averageCTR = (stats.totalClicks / stats.totalImpressions) * 100;
      }

      return stats;
    } catch (error) {
      console.error('Error getting delivery stats:', error);
      return {};
    }
  }
}

// Create singleton instance
const adDeliveryEngine = new AdDeliveryEngine();

// Refresh active ads every 5 minutes
setInterval(() => {
  adDeliveryEngine.refreshActiveAds();
}, 5 * 60 * 1000);

export default adDeliveryEngine;