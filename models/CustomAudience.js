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
    enum: ['custom', 'lookalike', 'website', 'email', 'app', 'engagement'],
    required: true
  },
  source: {
    type: String,
    enum: ['website_visitors', 'email_list', 'app_users', 'engagement', 'customer_file', 'lookalike'],
    required: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  // Audience data
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // For website visitors
  websiteData: {
    domain: String,
    pages: [String],
    events: [String], // page_view, purchase, add_to_cart, etc.
    retentionDays: {
      type: Number,
      default: 180
    }
  },
  // For email lists
  emailData: {
    emails: [String],
    source: String, // newsletter, purchase, signup, etc.
    lastUpdated: Date
  },
  // For app users
  appData: {
    appId: String,
    events: [String],
    retentionDays: Number
  },
  // For engagement audiences
  engagementData: {
    postIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post'
    }],
    interactionTypes: [String], // like, comment, share, save
    minInteractions: {
      type: Number,
      default: 1
    },
    timeFrame: {
      type: Number, // days
      default: 365
    }
  },
  // Lookalike settings
  lookalikeSettings: {
    sourceAudience: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomAudience'
    },
    percentage: {
      type: Number,
      min: 1,
      max: 10,
      default: 1
    },
    countries: [String]
  },
  // Audience size and stats
  stats: {
    totalUsers: {
      type: Number,
      default: 0
    },
    activeUsers: {
      type: Number,
      default: 0
    },
    lastCalculated: {
      type: Date,
      default: Date.now
    }
  },
  // Targeting options
  targeting: {
    countries: [String],
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
    }],
    languages: [String],
    interests: [String],
    behaviors: [String]
  },
  // Status and settings
  status: {
    type: String,
    enum: ['draft', 'processing', 'ready', 'expired', 'archived'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Privacy and compliance
  privacy: {
    dataSource: String,
    retentionPolicy: String,
    complianceStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }
}, {
  timestamps: true
});

// Indexes
customAudienceSchema.index({ advertiser: 1, status: 1 });
customAudienceSchema.index({ type: 1, source: 1 });
customAudienceSchema.index({ 'stats.lastCalculated': 1 });

// Method to calculate audience size
customAudienceSchema.methods.calculateSize = function() {
  if (this.users && this.users.length > 0) {
    this.stats.totalUsers = this.users.length;
  }
  
  if (this.type === 'lookalike' && this.lookalikeSettings.sourceAudience) {
    // Lookalike audiences are typically 1-10% of source audience
    this.stats.totalUsers = Math.floor(this.lookalikeSettings.sourceAudience.stats.totalUsers * (this.lookalikeSettings.percentage / 100));
  }
  
  this.stats.lastCalculated = new Date();
};

// Method to add users to audience
customAudienceSchema.methods.addUsers = function(userIds) {
  if (!this.users) {
    this.users = [];
  }
  
  // Add new users (avoid duplicates)
  userIds.forEach(userId => {
    if (!this.users.includes(userId)) {
      this.users.push(userId);
    }
  });
  
  this.calculateSize();
};

// Method to remove users from audience
customAudienceSchema.methods.removeUsers = function(userIds) {
  if (!this.users) return;
  
  this.users = this.users.filter(userId => !userIds.includes(userId));
  this.calculateSize();
};

const CustomAudience = mongoose.model('CustomAudience', customAudienceSchema);

export default CustomAudience;
