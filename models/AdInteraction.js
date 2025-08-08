import mongoose from 'mongoose';

const adInteractionSchema = new mongoose.Schema({
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad',
    required: true
  },
  advertiser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sessionId: String,
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  interactionType: {
    type: String,
    enum: [
      'impression', 'click', 'conversion', 'view', 'hover',
      'like', 'share', 'comment', 'save', 'hide', 'report'
    ],
    required: true
  },
  metrics: {
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    viewDuration: {
      type: Number, // in seconds
      default: 0
    },
    spend: {
      type: Number,
      default: 0
    },
    engagementActions: {
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      saves: { type: Number, default: 0 }
    }
  },
  geographicData: {
    country: String,
    countryCode: String,
    region: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    timezone: String
  },
  demographicData: {
    ageGroup: {
      type: String,
      enum: ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'unknown']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'unknown']
    },
    interests: [String],
    language: String
  },
  deviceInfo: {
    type: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'smart_tv', 'unknown']
    },
    platform: String, // iOS, Android, Windows, macOS, Linux
    browser: String,
    browserVersion: String,
    screenResolution: String,
    userAgent: String
  },
  contextData: {
    placement: String, // feed, sidebar, story, etc.
    position: Number, // position in feed
    referrer: String,
    pageUrl: String,
    previousAction: String
  },
  fraudDetection: {
    score: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    flags: [String], // suspicious_ip, bot_like, rapid_clicks, etc.
    verified: {
      type: Boolean,
      default: true
    }
  },
  ipAddress: String,
  userAgent: String,
  isValid: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for performance and analytics
adInteractionSchema.index({ adId: 1, timestamp: -1 });
adInteractionSchema.index({ advertiser: 1, timestamp: -1 });
adInteractionSchema.index({ userId: 1, timestamp: -1 });
adInteractionSchema.index({ interactionType: 1, timestamp: -1 });
adInteractionSchema.index({ ipAddress: 1, timestamp: -1 });
adInteractionSchema.index({ sessionId: 1, timestamp: -1 });

// Compound indexes for common queries
adInteractionSchema.index({ adId: 1, interactionType: 1, timestamp: -1 });
adInteractionSchema.index({ 'geographicData.country': 1, timestamp: -1 });
adInteractionSchema.index({ 'deviceInfo.type': 1, timestamp: -1 });

// TTL index to remove old interactions after 1 year
adInteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Virtual for calculating engagement rate
adInteractionSchema.virtual('engagementRate').get(function() {
  const totalEngagement = 
    this.metrics.engagementActions.likes +
    this.metrics.engagementActions.shares +
    this.metrics.engagementActions.comments +
    this.metrics.engagementActions.saves;
  
  return this.metrics.impressions > 0 ? totalEngagement / this.metrics.impressions : 0;
});

module.exports = mongoose.model('AdInteraction', adInteractionSchema);