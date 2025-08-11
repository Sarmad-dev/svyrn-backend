import mongoose from 'mongoose'

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Campaign name is required'],
    trim: true,
    maxlength: [100, 'Campaign name cannot exceed 100 characters']
  },
  image: {
    type: String,
    required: false,
    default: null
  },
  advertiser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  objective: {
    type: String,
    enum: [
      'awareness', 'reach', 'traffic', 'engagement', 'app_installs',
      'video_views', 'lead_generation', 'messages', 'conversions', 'catalog_sales'
    ],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending_payment', 'active', 'paused', 'completed', 'cancelled'],
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
    currency: {
      type: String,
      default: 'USD'
    },
    spent: {
      type: Number,
      default: 0
    }
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
    timezone: {
      type: String,
      default: 'UTC'
    },
    adSchedule: [{
      day: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      },
      startTime: String, // Format: "HH:MM"
      endTime: String    // Format: "HH:MM"
    }]
  },
  targeting: {
    demographics: {
      ageMin: {
        type: Number,
        min: 13,
        max: 65,
        default: 18
      },
      ageMax: {
        type: Number,
        min: 13,
        max: 65,
        default: 65
      },
      genders: [{
        type: String,
        enum: ['male', 'female', 'other']
      }],
      languages: [String]
    },
    location: {
      countries: [String],
      regions: [String],
      cities: [String],
      radius: Number, // in kilometers
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    interests: [{
      category: String,
      subcategory: String,
      weight: {
        type: Number,
        default: 1
      }
    }],
    behaviors: [{
      type: String,
      description: String
    }],
    customAudiences: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomAudience'
    }],
    lookalikeSources: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomAudience'
    }]
  },
  adSets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdSet'
  }],
  payment: {
    stripePaymentIntentId: String,
    stripeCustomerId: String,
    paypalOrderId: String,
    paypalPayerId: String,
    totalCost: {
      type: Number,
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'cancelled'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['stripe', 'paypal'],
      required: false // Made optional since it's only known after payment
    },
    paymentDate: Date,
    refundAmount: {
      type: Number,
      default: 0
    }
  },
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
    conversionRate: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  // Facebook Ads specific fields
  campaignBudgetOptimization: {
    type: Boolean,
    default: false
  },
  specialAdCategories: [String],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for performance
campaignSchema.index({ advertiser: 1, status: 1 });
campaignSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
campaignSchema.index({ status: 1, isActive: 1 });
campaignSchema.index({ 'payment.paymentStatus': 1 });

// Virtual for campaign duration in days
campaignSchema.virtual('durationDays').get(function() {
  const start = new Date(this.schedule.startDate);
  const end = new Date(this.schedule.endDate);
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
});

// Method to calculate total cost
campaignSchema.methods.calculateTotalCost = function() {
  const days = this.durationDays;
  if (this.budget.type === 'daily') {
    return this.budget.amount * days;
  }
  return this.budget.amount; // lifetime budget
};

// Method to check if campaign is currently active
campaignSchema.methods.isCurrentlyActive = function() {
  const now = new Date();
  return this.status === 'active' && 
         now >= this.schedule.startDate && 
         now <= this.schedule.endDate;
};

// Method to update performance metrics
campaignSchema.methods.updatePerformance = function() {
  // Calculate CTR
  if (this.performance.impressions > 0) {
    this.performance.ctr = (this.performance.clicks / this.performance.impressions) * 100;
  }
  
  // Calculate CPM (cost per 1000 impressions)
  if (this.performance.impressions > 0) {
    this.performance.cpm = (this.performance.spend / this.performance.impressions) * 1000;
  }
  
  // Calculate CPC (cost per click)
  if (this.performance.clicks > 0) {
    this.performance.cpc = this.performance.spend / this.performance.clicks;
  }
  
  // Calculate conversion rate
  if (this.performance.clicks > 0) {
    this.performance.conversionRate = (this.performance.conversions / this.performance.clicks) * 100;
  }
  
  this.performance.lastUpdated = new Date();
};

const Campaign = mongoose.model('Campaign', campaignSchema);

export default Campaign;