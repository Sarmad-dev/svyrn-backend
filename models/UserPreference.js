import mongoose from 'mongoose';

const userPreferenceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  contentPreferences: {
    categories: [{
      name: String,
      score: { type: Number, default: 0 } // -1 to 1 scale
    }],
    postTypes: [{
      type: { type: String, enum: ['text', 'image', 'video', 'link', 'poll'] },
      score: { type: Number, default: 0 }
    }],
    topics: [{
      keyword: String,
      score: { type: Number, default: 0 },
      frequency: { type: Number, default: 0 }
    }]
  },
  socialPreferences: {
    friendsWeight: { type: Number, default: 0.7 }, // How much to prioritize friends' content
    popularityWeight: { type: Number, default: 0.3 }, // How much to prioritize popular content
    recencyWeight: { type: Number, default: 0.5 }, // How much to prioritize recent content
    diversityWeight: { type: Number, default: 0.4 } // How much content diversity to maintain
  },
  locationPreferences: {
    localContentWeight: { type: Number, default: 0.6 }, // Preference for local content
    preferredLocations: [{
      city: String,
      country: String,
      score: { type: Number, default: 0 }
    }]
  },
  timePreferences: {
    activeHours: [{
      hour: { type: Number, min: 0, max: 23 },
      activity: { type: Number, default: 0 } // Activity level during this hour
    }],
    activeDays: [{
      day: { type: Number, min: 0, max: 6 }, // 0 = Sunday
      activity: { type: Number, default: 0 }
    }]
  },
  behaviorPatterns: {
    avgSessionDuration: { type: Number, default: 0 }, // Average session time in minutes
    avgPostsPerSession: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 }, // Overall engagement rate
    scrollSpeed: { type: Number, default: 0 }, // Average scroll speed
    contentConsumptionRate: { type: Number, default: 0 } // Posts viewed per minute
  },
  explicitPreferences: {
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blockedTopics: [String],
    favoriteTopics: [String],
    contentFilters: {
      showSensitiveContent: { type: Boolean, default: false },
      showAds: { type: Boolean, default: true },
      showRecommendations: { type: Boolean, default: true }
    }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
userPreferenceSchema.index({ user: 1 });
userPreferenceSchema.index({ lastUpdated: 1 });

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);
export default UserPreference;