import mongoose, { Schema } from "mongoose";

const adSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Ad title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Ad description is required"],
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    advertiser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adSet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdSet",
      required: true,
    },
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    creative: {
      type: {
        type: String,
        enum: ["image", "video", "carousel", "slideshow", "collection", "text"],
        required: true,
      },
      media: [
        {
          url: String,
          thumbnail: String,
          caption: String,
          altText: String,
          duration: Number, // for videos
          order: Number, // for carousels
        },
      ],
      primaryText: {
        type: String,
        maxlength: [125, "Primary text cannot exceed 125 characters"],
        required: true,
      },
      headline: {
        type: String,
        maxlength: [40, "Headline cannot exceed 40 characters"],
        required: true,
      },
      callToAction: {
        type: String,
        enum: [
          "learn_more",
          "shop_now",
          "sign_up",
          "download",
          "contact_us",
          "book_now",
          "get_quote",
          "apply_now",
          "donate_now",
          "subscribe",
        ],
        required: true,
        default: "learn_more",
      },
      destinationUrl: {
        type: String,
        required: false,
      },
      // Facebook specific creative options
      dynamicAdCreative: {
        type: Boolean,
        default: false,
      },
      brandSafety: {
        type: Boolean,
        default: true,
      },
    },
    targeting: {
      demographics: {
        ageMin: {
          type: Number,
          min: 13,
          max: 65,
        },
        ageMax: {
          type: Number,
          min: 13,
          max: 65,
        },
        genders: [
          {
            type: String,
            enum: ["male", "female", "other"],
          },
        ],
      },
      location: {
        countries: [String],
        cities: [String],
        radius: Number, // in kilometers
      },
      interests: [String],
      behaviors: [String],
      customAudience: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
    },
    budget: {
      type: {
        type: String,
        enum: ["daily", "lifetime"],
        required: true,
        default: "lifetime",
      },
      amount: {
        type: Number,
        required: true,
        min: [1, "Budget must be at least $1"],
      },
      currency: {
        type: String,
        default: "USD",
      },
      bidStrategy: {
        type: String,
        enum: ["lowest_cost", "cost_cap", "bid_cap"],
        default: "lowest_cost",
      },
    },
    tags: [String],
    duration: {
      type: Number,
      required: true,
      min: [1, "Duration must be at least 1 day"],
    },
    schedule: {
      startDate: {
        type: Date,
        // required: true,
      },
      endDate: Date,
      timezone: {
        type: String,
        default: "UTC",
      },
      adSchedule: [
        {
          day: {
            type: String,
            enum: [
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ],
          },
          startTime: String,
          endTime: String,
        },
      ],
    },
    status: {
      type: String,
      enum: [
        "draft",
        "pending_review",
        "active",
        "paused",
        "completed",
        "rejected",
      ],
      default: "draft",
    },
    performance: {
      impressions: {
        type: Number,
        default: 0,
      },
      clicks: {
        type: Number,
        default: 0,
      },
      conversions: {
        type: Number,
        default: 0,
      },
      spend: {
        type: Number,
        default: 0,
      },
      ctr: {
        type: Number,
        default: 0,
      },
      cpc: {
        type: Number,
        default: 0,
      },
      cpm: {
        type: Number,
        default: 0,
      },
      reach: {
        type: Number,
        default: 0,
      },
      frequency: {
        type: Number,
        default: 0,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },
    // Ad delivery tracking
    delivery: {
      startTime: Date,
      endTime: Date,
      totalBudget: Number,
      remainingBudget: Number,
      isDelivering: {
        type: Boolean,
        default: false,
      },
    },
    // Ad review
    review: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      feedback: String,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reviewedAt: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    likes: [{
      type: Schema.Types.ObjectId,
      ref: "User",
    }],
    comments: [{
      type: Schema.Types.ObjectId,
      ref: "Comment",
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
adSchema.index({ advertiser: 1, status: 1 });
adSchema.index({ adSet: 1, status: 1 });
adSchema.index({ campaign: 1, status: 1 });
adSchema.index({ "schedule.startDate": 1, "schedule.endDate": 1 });
adSchema.index({ status: 1, isActive: 1 });
adSchema.index({ "delivery.isDelivering": 1 });

// Method to update performance metrics
adSchema.methods.updatePerformance = function() {
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
  
  // Calculate frequency
  if (this.performance.reach > 0) {
    this.performance.frequency = this.performance.impressions / this.performance.reach;
  }
  
  this.performance.lastUpdated = new Date();
};

// Method to check if ad is currently active
adSchema.methods.isCurrentlyActive = function() {
  const now = new Date();
  return this.status === 'active' && 
         this.delivery.isDelivering &&
         now >= this.schedule.startDate && 
         now <= this.schedule.endDate;
};

const Ad = mongoose.model("Ad", adSchema);
export default Ad;
