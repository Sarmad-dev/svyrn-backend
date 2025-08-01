import mongoose from 'mongoose';

const contentScoreSchema = new mongoose.Schema({
  contentType: {
    type: String,
    enum: ['post', 'product', 'ad'],
    required: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scores: {
    popularity: { type: Number, default: 0 }, // Based on likes, comments, shares
    engagement: { type: Number, default: 0 }, // Engagement rate
    quality: { type: Number, default: 0 }, // Content quality score
    recency: { type: Number, default: 1 }, // Time decay factor
    virality: { type: Number, default: 0 }, // Viral potential
    relevance: { type: Number, default: 0 }, // Topic relevance
    diversity: { type: Number, default: 0 } // Content diversity factor
  },
  metrics: {
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    clickThroughRate: { type: Number, default: 0 },
    avgDwellTime: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 }
  },
  demographics: {
    ageGroups: [{
      range: String, // e.g., "18-24", "25-34"
      engagement: Number
    }],
    locations: [{
      city: String,
      country: String,
      engagement: Number
    }],
    interests: [{
      topic: String,
      relevance: Number
    }]
  },
  lastCalculated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
contentScoreSchema.index({ contentType: 1, contentId: 1 }, { unique: true });
contentScoreSchema.index({ author: 1, 'scores.popularity': -1 });
contentScoreSchema.index({ 'scores.recency': -1, 'scores.popularity': -1 });
contentScoreSchema.index({ lastCalculated: 1 });

// TTL index to remove old scores after 30 days
contentScoreSchema.index({ lastCalculated: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const ContentScore = mongoose.model('ContentScore', contentScoreSchema);
export default ContentScore;