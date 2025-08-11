import mongoose from 'mongoose';

const adInteractionSchema = new mongoose.Schema({
  ad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad',
    required: true
  },
  adSet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdSet',
    required: true
  },
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['impression', 'click', 'conversion', 'view'],
    required: true
  },
  // Interaction details
  timestamp: {
    type: Date,
    default: Date.now
  },
  // User context
  userAgent: String,
  ipAddress: String,
  location: {
    country: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  device: {
    type: String,
    enum: ['mobile', 'desktop', 'tablet'],
    default: 'desktop'
  },
  platform: {
    type: String,
    enum: ['web', 'ios', 'android'],
    default: 'web'
  },
  // Conversion tracking
  conversion: {
    value: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    category: String,
    action: String
  },
  // Cost tracking
  cost: {
    type: Number,
    default: 0
  },
  // Session tracking
  sessionId: String,
  referrer: String,
  // Fraud prevention
  isBot: {
    type: Boolean,
    default: false
  },
  qualityScore: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  }
}, {
  timestamps: true
});

// Indexes for performance
adInteractionSchema.index({ ad: 1, type: 1, timestamp: 1 });
adInteractionSchema.index({ campaign: 1, type: 1, timestamp: 1 });
adInteractionSchema.index({ user: 1, timestamp: 1 });
adInteractionSchema.index({ timestamp: 1 });

// Compound index for analytics queries
adInteractionSchema.index({ campaign: 1, adSet: 1, ad: 1, type: 1, timestamp: 1 });

const AdInteraction = mongoose.model('AdInteraction', adInteractionSchema);

export default AdInteraction;