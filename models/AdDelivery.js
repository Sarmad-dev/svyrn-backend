import mongoose from 'mongoose';

const adDeliverySchema = new mongoose.Schema({
  ad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  adSet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdSet',
    required: true
  },
  
  // Delivery context
  placement: {
    type: String,
    enum: ['feed', 'stories', 'reels', 'marketplace', 'messenger'],
    required: true
  },
  position: {
    type: Number,
    required: true // Position in feed (1st, 2nd, 3rd, etc.)
  },
  
  // User context at delivery time
  userContext: {
    location: {
      country: String,
      region: String,
      city: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    device: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet']
    },
    platform: String, // iOS, Android, Web
    browser: String,
    userAgent: String,
    connectionType: String, // wifi, cellular, etc.
    timeOfDay: Number, // 0-23
    dayOfWeek: Number  // 0-6
  },
  
  // Targeting match score
  targetingScore: {
    overall: {
      type: Number,
      min: 0,
      max: 1
    },
    demographics: Number,
    interests: Number,
    behaviors: Number,
    location: Number,
    customAudience: Number
  },
  
  // Auction and bidding
  auction: {
    bidAmount: Number,
    estimatedCost: Number,
    competitorCount: Number,
    winningBid: Boolean,
    auctionId: String
  },
  
  // Frequency capping
  frequency: {
    impressionsToday: {
      type: Number,
      default: 0
    },
    impressionsThisWeek: {
      type: Number,
      default: 0
    },
    lastShown: Date
  },
  
  // Delivery status
  status: {
    type: String,
    enum: ['delivered', 'skipped', 'failed'],
    default: 'delivered'
  },
  
  // Interaction tracking
  interactions: [{
    type: {
      type: String,
      enum: ['impression', 'click', 'view', 'engagement', 'conversion']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  
  // Performance metrics
  metrics: {
    viewDuration: Number, // in seconds
    scrollDepth: Number,  // percentage
    clickPosition: {
      x: Number,
      y: Number
    },
    engagementScore: Number
  },
  
  deliveredAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
adDeliverySchema.index({ ad: 1, user: 1, deliveredAt: -1 });
adDeliverySchema.index({ campaign: 1, deliveredAt: -1 });
adDeliverySchema.index({ user: 1, deliveredAt: -1 });
adDeliverySchema.index({ placement: 1, deliveredAt: -1 });

// TTL index to remove old delivery records after 90 days
adDeliverySchema.index({ deliveredAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AdDelivery = mongoose.model('AdDelivery', adDeliverySchema);
export default AdDelivery;
