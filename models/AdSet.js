import mongoose from 'mongoose';

const adSetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ad set name is required'],
    trim: true,
    maxlength: [100, 'Ad set name cannot exceed 100 characters']
  },
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  advertiser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed'],
    default: 'draft'
  },
  budget: {
    type: {
      type: String,
      enum: ['daily', 'lifetime'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Budget must be at least $1']
    },
    spent: {
      type: Number,
      default: 0
    }
  },
  bidStrategy: {
    type: String,
    enum: ['lowest_cost', 'cost_cap', 'bid_cap', 'target_cost'],
    default: 'lowest_cost'
  },
  bidAmount: {
    type: Number,
    min: 0
  },
  optimization: {
    goal: {
      type: String,
      enum: ['impressions', 'clicks', 'conversions', 'reach', 'engagement'],
      default: 'clicks'
    },
    eventType: String // For conversion optimization
  },
  targeting: {
    demographics: {
      ageMin: {
        type: Number,
        min: 13,
        max: 65
      },
      ageMax: {
        type: Number,
        min: 13,
        max: 65
      },
      genders: [{
        type: String,
        enum: ['male', 'female', 'other']
      }]
    },
    location: {
      countries: [String],
      cities: [String],
      radius: Number
    },
    interests: [String],
    behaviors: [String],
    customAudiences: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomAudience'
    }]
  },
  placement: {
    platforms: [{
      type: String,
      enum: ['feed', 'stories', 'reels', 'marketplace', 'messenger'],
      default: 'feed'
    }],
    devices: [{
      type: String,
      enum: ['mobile', 'desktop', 'tablet']
    }]
  },
  schedule: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    adSchedule: [{
      day: String,
      startTime: String,
      endTime: String
    }]
  },
  frequencyCap: {
    impressions: {
      type: Number,
      default: 3
    },
    timeWindow: {
      type: String,
      enum: ['hour', 'day', 'week'],
      default: 'day'
    }
  },
  ads: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad'
  }],
  performance: {
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
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
adSetSchema.index({ campaign: 1, status: 1 });
adSetSchema.index({ advertiser: 1, status: 1 });
adSetSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });

const AdSet = mongoose.model('AdSet', adSetSchema);
export default AdSet;
