import mongoose from 'mongoose';

const customAudienceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Audience name is required'],
    trim: true,
    maxlength: [100, 'Audience name cannot exceed 100 characters']
  },
  advertiser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['custom', 'lookalike', 'saved', 'website_visitors', 'app_users'],
    required: true
  },
  source: {
    type: String,
    enum: ['customer_list', 'website_traffic', 'app_activity', 'engagement', 'video_views'],
    required: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Custom audience data
  audienceData: {
    // For customer list audiences
    customerList: {
      emails: [String],
      phoneNumbers: [String],
      userIds: [String],
      hashedData: Boolean
    },
    
    // For website visitors
    websiteRules: [{
      urlContains: String,
      urlEquals: String,
      timeSpent: Number, // in seconds
      eventType: String,
      dateRange: {
        start: Date,
        end: Date
      }
    }],
    
    // For app users
    appEvents: [{
      eventName: String,
      parameters: mongoose.Schema.Types.Mixed,
      dateRange: {
        start: Date,
        end: Date
      }
    }],
    
    // For engagement audiences
    engagementRules: [{
      type: String, // 'page_engagement', 'video_views', 'lead_form'
      pageId: mongoose.Schema.Types.ObjectId,
      videoId: mongoose.Schema.Types.ObjectId,
      engagementType: String, // 'liked', 'commented', 'shared'
      timeframe: Number // days
    }]
  },
  
  // Lookalike audience settings
  lookalike: {
    sourceAudience: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomAudience'
    },
    similarity: {
      type: Number,
      min: 1,
      max: 10,
      default: 1
    },
    location: {
      countries: [String],
      regions: [String]
    }
  },
  
  // Audience size and statistics
  statistics: {
    size: {
      type: Number,
      default: 0
    },
    reach: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    updateFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily'
    }
  },
  
  // Privacy and compliance
  privacy: {
    dataRetentionDays: {
      type: Number,
      default: 180
    },
    consentRequired: {
      type: Boolean,
      default: true
    },
    gdprCompliant: {
      type: Boolean,
      default: false
    }
  },
  
  // Sharing settings
  sharing: {
    sharedWith: [{
      advertiser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      permissions: [{
        type: String,
        enum: ['view', 'use', 'edit']
      }],
      sharedAt: {
        type: Date,
        default: Date.now
      }
    }],
    isPublic: {
      type: Boolean,
      default: false
    }
  },
  
  status: {
    type: String,
    enum: ['creating', 'ready', 'updating', 'error'],
    default: 'creating'
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
customAudienceSchema.index({ advertiser: 1, type: 1 });
customAudienceSchema.index({ status: 1, isActive: 1 });
customAudienceSchema.index({ 'sharing.isPublic': 1 });

// Method to calculate audience overlap
customAudienceSchema.methods.calculateOverlap = function(otherAudience) {
  // Implementation for calculating audience overlap
  // This would involve comparing user lists and returning overlap percentage
  return 0; // Placeholder
};

const CustomAudience = mongoose.model('CustomAudience', customAudienceSchema);
export default CustomAudience;
