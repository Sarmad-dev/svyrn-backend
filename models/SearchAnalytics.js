import mongoose from 'mongoose';

const searchAnalyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  query: {
    type: String,
    required: true,
    trim: true
  },
  filters: [{
    type: String,
    enum: ['users', 'groups', 'pages', 'ads', 'products']
  }],
  resultsCount: {
    type: Number,
    default: 0
  },
  executionTime: {
    type: Number, // in milliseconds
    required: true
  },
  clickedResults: [{
    resultType: {
      type: String,
      enum: ['user', 'group', 'page', 'ad', 'product']
    },
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    position: Number, // Position in search results
    clickedAt: {
      type: Date,
      default: Date.now
    }
  }],
  sessionId: String,
  userAgent: String,
  ipAddress: String,
  location: {
    country: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
searchAnalyticsSchema.index({ userId: 1, createdAt: -1 });
searchAnalyticsSchema.index({ query: 1, createdAt: -1 });
searchAnalyticsSchema.index({ createdAt: -1 });

// TTL index to remove old analytics after 90 days
searchAnalyticsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const SearchAnalytics = mongoose.model('SearchAnalytics', searchAnalyticsSchema);

export default SearchAnalytics;
