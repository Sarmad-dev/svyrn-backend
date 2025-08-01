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
    image: {
      type: String,
      required: true,
    },
    campaign: {
      name: {
        type: String,
        required: true,
      },
      campaignType: String,
      objective: {
        type: String,
        enum: ["awareness", "traffic", "engagement", "leads", "sales"],
        default: "awareness",
      },
    },
    creative: {
      type: {
        type: String,
        enum: ["image", "video", "carousel", "text"],
        required: true,
      },
      media: [
        {
          url: String,
          caption: String,
        },
      ],
      callToAction: {
        type: String,
        enum: [
          "learn_more",
          "shop_now",
          "sign_up",
          "download",
          "contact_us",
          "book_now",
        ],
        required: true,
        default: "learn_more",
      },
      destinationUrl: {
        type: String,
        required: false,
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
adSchema.index({ "schedule.startDate": 1, "schedule.endDate": 1 });
adSchema.index({ status: 1, isActive: 1 });

const Ad = mongoose.model("Ad", adSchema);
export default Ad;
