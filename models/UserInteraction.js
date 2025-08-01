import mongoose from 'mongoose';

const userInteractionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetType: {
    type: String,
    enum: ['post', 'user', 'group', 'page', 'product'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  interactionType: {
    type: String,
    enum: [
      'view', 'like', 'comment', 'share', 'click', 'follow', 'unfollow',
      'save', 'hide', 'report', 'dwell_time', 'scroll_past', 'engage', 'recommendation_shown'
    ],
    required: true
  },
  value: {
    type: Number,
    default: 1 // Weight of the interaction
  },
  metadata: {
    dwellTime: Number, // Time spent viewing content (seconds)
    scrollDepth: Number, // How much of the content was viewed (0-100%)
    deviceType: String,
    sessionId: String,
    referrer: String,
    location: {
      latitude: Number,
      longitude: Number,
      city: String,
      country: String
    },
    timeOfDay: Number, // Hour of day (0-23)
    dayOfWeek: Number // Day of week (0-6)
  },
  context: {
    feedPosition: Number, // Position in feed when interacted
    contentAge: Number, // Age of content in hours when interacted
    isOrganic: Boolean, // Whether content was recommended or organic
    recommendationScore: Number // Original recommendation score
  }
}, {
  timestamps: true
});

// Indexes for performance
userInteractionSchema.index({ user: 1, createdAt: -1 });
userInteractionSchema.index({ targetType: 1, targetId: 1 });
userInteractionSchema.index({ interactionType: 1, createdAt: -1 });
userInteractionSchema.index({ user: 1, targetType: 1, interactionType: 1 });
userInteractionSchema.index({ 'metadata.location.city': 1 });
userInteractionSchema.index({ 'metadata.timeOfDay': 1, 'metadata.dayOfWeek': 1 });

// TTL index to remove old interactions after 90 days
userInteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const UserInteraction = mongoose.model('UserInteraction', userInteractionSchema);
export default UserInteraction;