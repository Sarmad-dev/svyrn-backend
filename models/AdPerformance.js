import mongoose from 'mongoose';

const adPerformanceSchema = new mongoose.Schema({
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
  date: {
    type: Date,
    required: true
  },
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
  spend: {
    type: Number,
    default: 0
  },
  ctr: {
    type: Number,
    default: 0
  },
  cpc: {
    type: Number,
    default: 0
  },
  cpm: {
    type: Number,
    default: 0
  },
  conversionRate: {
    type: Number,
    default: 0
  },
  demographics: {
    ageGroups: [{
      range: String, // e.g., "18-24", "25-34"
      impressions: Number,
      clicks: Number,
      conversions: Number
    }],
    genders: [{
      gender: {
        type: String,
        enum: ['male', 'female', 'other', 'unknown']
      },
      impressions: Number,
      clicks: Number,
      conversions: Number
    }],
    locations: [{
      country: String,
      city: String,
      impressions: Number,
      clicks: Number,
      conversions: Number
    }]
  },
  devices: [{
    type: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown']
    },
    platform: String, // iOS, Android, Windows, etc.
    browser: String,
    impressions: Number,
    clicks: Number,
    conversions: Number
  }],
  hourlyBreakdown: [{
    hour: {
      type: Number,
      min: 0,
      max: 23
    },
    impressions: Number,
    clicks: Number,
    conversions: Number
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
adPerformanceSchema.index({ adId: 1, date: -1 });
adPerformanceSchema.index({ advertiser: 1, date: -1 });
adPerformanceSchema.index({ date: -1 });

// Compound index for unique ad per day
adPerformanceSchema.index({ adId: 1, date: 1 }, { unique: true });

// TTL index to remove old performance data after 2 years
adPerformanceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

module.exports = mongoose.model('AdPerformance', adPerformanceSchema);