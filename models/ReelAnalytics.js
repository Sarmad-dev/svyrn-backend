import mongoose from "mongoose";

const reelAnalyticsSchema = new mongoose.Schema(
  {
    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
      required: true,
      unique: true,
    },
    // View metrics
    views: {
      total: {
        type: Number,
        default: 0,
      },
      unique: {
        type: Number,
        default: 0,
      },
      organic: {
        type: Number,
        default: 0,
      },
      paid: {
        type: Number,
        default: 0,
      },
      viral: {
        type: Number,
        default: 0,
      },
      byDevice: {
        mobile: { type: Number, default: 0 },
        desktop: { type: Number, default: 0 },
        tablet: { type: Number, default: 0 },
      },
      byLocation: [
        {
          country: String,
          region: String,
          city: String,
          count: { type: Number, default: 0 },
        },
      ],
      byTimeOfDay: [
        {
          hour: Number,
          count: { type: Number, default: 0 },
        },
      ],
      byDayOfWeek: [
        {
          day: Number, // 0-6 (Sunday-Saturday)
          count: { type: Number, default: 0 },
        },
      ],
    },
    // Engagement metrics
    engagement: {
      likes: {
        total: { type: Number, default: 0 },
        byType: {
          like: { type: Number, default: 0 },
          love: { type: Number, default: 0 },
          haha: { type: Number, default: 0 },
          wow: { type: Number, default: 0 },
          sad: { type: Number, default: 0 },
          angry: { type: Number, default: 0 },
        },
      },
      comments: {
        total: { type: Number, default: 0 },
        replies: { type: Number, default: 0 },
        uniqueCommenters: { type: Number, default: 0 },
      },
      shares: {
        total: { type: Number, default: 0 },
        internal: { type: Number, default: 0 },
        external: { type: Number, default: 0 },
      },
      saves: {
        total: { type: Number, default: 0 },
        uniqueUsers: { type: Number, default: 0 },
      },
      clicks: {
        total: { type: Number, default: 0 },
        profileClicks: { type: Number, default: 0 },
        linkClicks: { type: Number, default: 0 },
        hashtagClicks: { type: Number, default: 0 },
      },
    },
    // Watch time metrics
    watchTime: {
      total: { type: Number, default: 0 }, // in seconds
      average: { type: Number, default: 0 }, // in seconds
      median: { type: Number, default: 0 }, // in seconds
      byDuration: [
        {
          range: String, // e.g., "0-10s", "10-30s", "30s+"
          count: { type: Number, default: 0 },
        },
      ],
      completionRates: [
        {
          percentage: Number, // e.g., 25, 50, 75, 100
          count: { type: Number, default: 0 },
        },
      ],
    },
    // Audience metrics
    audience: {
      demographics: {
        ageGroups: [
          {
            range: String, // e.g., "13-17", "18-24", "25-34"
            count: { type: Number, default: 0 },
            percentage: { type: Number, default: 0 },
          },
        ],
        genders: [
          {
            gender: String,
            count: { type: Number, default: 0 },
            percentage: { type: Number, default: 0 },
          },
        ],
        languages: [
          {
            language: String,
            count: { type: Number, default: 0 },
            percentage: { type: Number, default: 0 },
          },
        ],
      },
      interests: [
        {
          category: String,
          count: { type: Number, default: 0 },
          percentage: { type: Number, default: 0 },
        },
      ],
      followers: {
        total: { type: Number, default: 0 },
        new: { type: Number, default: 0 },
        retained: { type: Number, default: 0 },
      },
    },
    // Performance metrics
    performance: {
      reach: {
        total: { type: Number, default: 0 },
        organic: { type: Number, default: 0 },
        paid: { type: Number, default: 0 },
        viral: { type: Number, default: 0 },
      },
      impressions: {
        total: { type: Number, default: 0 },
        unique: { type: Number, default: 0 },
      },
      engagementRate: {
        overall: { type: Number, default: 0 },
        byView: { type: Number, default: 0 },
        byReach: { type: Number, default: 0 },
      },
      clickThroughRate: {
        type: Number,
        default: 0,
      },
      bounceRate: {
        type: Number,
        default: 0,
      },
      retentionRate: {
        type: Number,
        default: 0,
      },
    },
    // Trending metrics
    trending: {
      isTrending: {
        type: Boolean,
        default: false,
      },
      trendScore: {
        type: Number,
        default: 0,
      },
      trendRank: {
        type: Number,
        default: 0,
      },
      trendCategory: String,
      trendDuration: Number, // in hours
      peakViews: {
        type: Number,
        default: 0,
      },
      peakEngagement: {
        type: Number,
        default: 0,
      },
    },
    // Revenue metrics (if monetized)
    revenue: {
      total: {
        type: Number,
        default: 0,
      },
      bySource: {
        ads: { type: Number, default: 0 },
        brandDeals: { type: Number, default: 0 },
        affiliate: { type: Number, default: 0 },
        tips: { type: Number, default: 0 },
      },
      cpm: { type: Number, default: 0 }, // Cost per mille
      cpc: { type: Number, default: 0 }, // Cost per click
    },
    // Content insights
    contentInsights: {
      bestPerformingTime: {
        hour: Number,
        dayOfWeek: Number,
      },
      bestPerformingHashtags: [
        {
          hashtag: String,
          performance: Number,
        },
      ],
      audienceRetention: {
        type: Number,
        default: 0,
      },
      contentQuality: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
    },
    // Historical data
    history: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        views: Number,
        likes: Number,
        comments: Number,
        shares: Number,
        saves: Number,
        engagementRate: Number,
      },
    ],
    // Last updated
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
reelAnalyticsSchema.index({ reel: 1 });
reelAnalyticsSchema.index({ "trending.isTrending": 1, "trending.trendScore": -1 });
reelAnalyticsSchema.index({ "performance.engagementRate.overall": -1 });
reelAnalyticsSchema.index({ "views.total": -1 });
reelAnalyticsSchema.index({ "engagement.likes.total": -1 });
reelAnalyticsSchema.index({ createdAt: -1 });

// Virtual for total engagement
reelAnalyticsSchema.virtual("totalEngagement").get(function () {
  return (
    this.engagement.likes.total +
    this.engagement.comments.total +
    this.engagement.shares.total +
    this.engagement.saves.total
  );
});

// Virtual for engagement rate calculation
reelAnalyticsSchema.virtual("calculatedEngagementRate").get(function () {
  if (this.views.total === 0) return 0;
  return ((this.totalEngagement / this.views.total) * 100).toFixed(2);
});

// Pre-save middleware to update calculated fields
reelAnalyticsSchema.pre("save", function (next) {
  // Update engagement rate
  if (this.views.total > 0) {
    this.performance.engagementRate.overall = parseFloat(this.calculatedEngagementRate);
    this.performance.engagementRate.byView = parseFloat(this.calculatedEngagementRate);
  }
  
  // Update last updated timestamp
  this.lastUpdated = new Date();
  
  next();
});

// Method to add view
reelAnalyticsSchema.methods.addView = function (viewData = {}) {
  this.views.total += 1;
  
  // Update device type
  if (viewData.device) {
    switch (viewData.device.toLowerCase()) {
      case "mobile":
        this.views.byDevice.mobile += 1;
        break;
      case "desktop":
        this.views.byDevice.desktop += 1;
        break;
      case "tablet":
        this.views.byDevice.tablet += 1;
        break;
    }
  }
  
  // Update location
  if (viewData.location) {
    const existingLocation = this.views.byLocation.find(
      (loc) => loc.city === viewData.location.city
    );
    if (existingLocation) {
      existingLocation.count += 1;
    } else {
      this.views.byLocation.push({
        country: viewData.location.country || "Unknown",
        region: viewData.location.region || "Unknown",
        city: viewData.location.city || "Unknown",
        count: 1,
      });
    }
  }
  
  // Update time of day
  const hour = new Date().getHours();
  const existingHour = this.views.byTimeOfDay.find((h) => h.hour === hour);
  if (existingHour) {
    existingHour.count += 1;
  } else {
    this.views.byTimeOfDay.push({ hour, count: 1 });
  }
  
  // Update day of week
  const dayOfWeek = new Date().getDay();
  const existingDay = this.views.byDayOfWeek.find((d) => d.day === dayOfWeek);
  if (existingDay) {
    existingDay.count += 1;
  } else {
    this.views.byDayOfWeek.push({ day: dayOfWeek, count: 1 });
  }
  
  return this.save();
};

// Method to add engagement
reelAnalyticsSchema.methods.addEngagement = function (type, count = 1) {
  switch (type) {
    case "like":
      this.engagement.likes.total += count;
      break;
    case "comment":
      this.engagement.comments.total += count;
      break;
    case "share":
      this.engagement.shares.total += count;
      break;
    case "save":
      this.engagement.saves.total += count;
      break;
  }
  
  return this.save();
};

// Method to add watch time
reelAnalyticsSchema.methods.addWatchTime = function (duration, completionRate) {
  this.watchTime.total += duration;
  this.watchTime.average = this.watchTime.total / this.views.total;
  
  // Update completion rate distribution
  const percentage = Math.round(completionRate / 25) * 25; // Round to nearest 25%
  const existingCompletion = this.watchTime.completionRates.find(
    (c) => c.percentage === percentage
  );
  if (existingCompletion) {
    existingCompletion.count += 1;
  } else {
    this.watchTime.completionRates.push({ percentage, count: 1 });
  }
  
  return this.save();
};

// Method to update trending status
reelAnalyticsSchema.methods.updateTrendingStatus = function (isTrending, score = 0, rank = 0, category = null) {
  this.trending.isTrending = isTrending;
  this.trending.trendScore = score;
  this.trending.trendRank = rank;
  if (category) {
    this.trending.trendCategory = category;
  }
  
  if (isTrending) {
    this.trending.peakViews = Math.max(this.trending.peakViews, this.views.total);
    this.trending.peakEngagement = Math.max(this.trending.peakEngagement, this.totalEngagement);
  }
  
  return this.save();
};

// Method to add historical data point
reelAnalyticsSchema.methods.addHistoryPoint = function () {
  const historyPoint = {
    date: new Date(),
    views: this.views.total,
    likes: this.engagement.likes.total,
    comments: this.engagement.comments.total,
    shares: this.engagement.shares.total,
    saves: this.engagement.saves.total,
    engagementRate: this.performance.engagementRate.overall,
  };
  
  this.history.push(historyPoint);
  
  // Keep only last 30 days of history
  if (this.history.length > 30) {
    this.history = this.history.slice(-30);
  }
  
  return this.save();
};

// Method to calculate audience demographics
reelAnalyticsSchema.methods.calculateDemographics = function (userData) {
  // Age group calculation
  if (userData.age) {
    let ageGroup = "other";
    if (userData.age >= 13 && userData.age <= 17) ageGroup = "13-17";
    else if (userData.age >= 18 && userData.age <= 24) ageGroup = "18-24";
    else if (userData.age >= 25 && userData.age <= 34) ageGroup = "25-34";
    else if (userData.age >= 35 && userData.age <= 44) ageGroup = "35-44";
    else if (userData.age >= 45 && userData.age <= 54) ageGroup = "45-54";
    else if (userData.age >= 55) ageGroup = "55+";
    
    const existingAgeGroup = this.audience.demographics.ageGroups.find(
      (ag) => ag.range === ageGroup
    );
    if (existingAgeGroup) {
      existingAgeGroup.count += 1;
    } else {
      this.audience.demographics.ageGroups.push({ range: ageGroup, count: 1, percentage: 0 });
    }
  }
  
  // Gender calculation
  if (userData.gender) {
    const existingGender = this.audience.demographics.genders.find(
      (g) => g.gender === userData.gender
    );
    if (existingGender) {
      existingGender.count += 1;
    } else {
      this.audience.demographics.genders.push({ gender: userData.gender, count: 1, percentage: 0 });
    }
  }
  
  // Language calculation
  if (userData.language) {
    const existingLanguage = this.audience.demographics.languages.find(
      (l) => l.language === userData.language
    );
    if (existingLanguage) {
      existingLanguage.count += 1;
    } else {
      this.audience.demographics.languages.push({ language: userData.language, count: 1, percentage: 0 });
    }
  }
  
  // Calculate percentages
  this.calculatePercentages();
  
  return this.save();
};

// Method to calculate percentages for demographics
reelAnalyticsSchema.methods.calculatePercentages = function () {
  const totalViews = this.views.total;
  
  // Age groups
  this.audience.demographics.ageGroups.forEach((ag) => {
    ag.percentage = totalViews > 0 ? ((ag.count / totalViews) * 100).toFixed(2) : 0;
  });
  
  // Genders
  this.audience.demographics.genders.forEach((g) => {
    g.percentage = totalViews > 0 ? ((g.count / totalViews) * 100).toFixed(2) : 0;
  });
  
  // Languages
  this.audience.demographics.languages.forEach((l) => {
    l.percentage = totalViews > 0 ? ((l.count / totalViews) * 100).toFixed(2) : 0;
  });
};

// Static method to get trending reels analytics
reelAnalyticsSchema.statics.getTrendingAnalytics = function (limit = 20) {
  return this.find({
    "trending.isTrending": true,
  })
    .sort({ "trending.trendScore": -1 })
    .limit(limit)
    .populate("reel", "caption media author");
};

// Static method to get top performing reels
reelAnalyticsSchema.statics.getTopPerformingReels = function (limit = 20, metric = "views") {
  const sortField = `views.total`;
  return this.find({})
    .sort({ [sortField]: -1 })
    .limit(limit)
    .populate("reel", "caption media author");
};

// Static method to get analytics summary
reelAnalyticsSchema.statics.getAnalyticsSummary = function (userId, timeframe = "7d") {
  const now = new Date();
  let startDate;
  
  switch (timeframe) {
    case "24h":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  return this.aggregate([
    {
      $match: {
        "reel.author": userId,
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: "$views.total" },
        totalLikes: { $sum: "$engagement.likes.total" },
        totalComments: { $sum: "$engagement.comments.total" },
        totalShares: { $sum: "$engagement.shares.total" },
        totalSaves: { $sum: "$engagement.saves.total" },
        avgEngagementRate: { $avg: "$performance.engagementRate.overall" },
        totalReels: { $sum: 1 },
      },
    },
  ]);
};

const ReelAnalytics = mongoose.model("ReelAnalytics", reelAnalyticsSchema);

export default ReelAnalytics;
