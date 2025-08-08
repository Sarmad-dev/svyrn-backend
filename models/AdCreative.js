import mongoose from 'mongoose';

const adCreativeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Creative name is required'],
    trim: true,
    maxlength: [100, 'Creative name cannot exceed 100 characters']
  },
  advertiser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['single_image', 'single_video', 'carousel', 'collection', 'story'],
    required: true
  },
  format: {
    type: String,
    enum: ['image', 'video', 'slideshow', 'canvas'],
    required: true
  },
  content: {
    // For single image/video ads
    primaryMedia: {
      type: {
        type: String,
        enum: ['image', 'video']
      },
      url: String,
      thumbnailUrl: String,
      duration: Number, // for videos
      dimensions: {
        width: Number,
        height: Number
      }
    },
    
    // For carousel ads
    carouselCards: [{
      media: {
        type: String,
        enum: ['image', 'video']
      },
      url: String,
      headline: String,
      description: String,
      callToAction: {
        type: String,
        enum: ['learn_more', 'shop_now', 'sign_up', 'download', 'contact_us', 'book_now']
      },
      destinationUrl: String
    }],
    
    // Text content
    headline: {
      type: String,
      maxlength: [125, 'Headline cannot exceed 125 characters']
    },
    description: {
      type: String,
      maxlength: [2200, 'Description cannot exceed 2200 characters']
    },
    displayLink: String,
    
    // Call to action
    callToAction: {
      type: String,
      enum: ['learn_more', 'shop_now', 'sign_up', 'download', 'contact_us', 'book_now', 'watch_more'],
      required: true
    },
    destinationUrl: {
      type: String,
      required: true
    },
    
    // Branding
    brandName: String,
    logo: String
  },
  
  // Story-specific content
  storyContent: {
    backgroundType: {
      type: String,
      enum: ['image', 'video', 'gradient']
    },
    backgroundUrl: String,
    backgroundColor: String,
    textOverlay: {
      text: String,
      position: {
        type: String,
        enum: ['top', 'center', 'bottom']
      },
      style: {
        fontSize: Number,
        fontColor: String,
        fontWeight: String
      }
    }
  },
  
  // Technical specifications
  specifications: {
    aspectRatio: String, // e.g., "16:9", "1:1", "9:16"
    resolution: String,  // e.g., "1080x1080"
    fileSize: Number,    // in bytes
    format: String       // e.g., "jpg", "mp4", "png"
  },
  
  // A/B testing variants
  variants: [{
    name: String,
    content: mongoose.Schema.Types.Mixed,
    performance: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      ctr: { type: Number, default: 0 }
    }
  }],
  
  // Approval status
  approval: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'needs_review'],
      default: 'pending'
    },
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectionReason: String,
    guidelines: [String]
  },
  
  // Performance tracking
  performance: {
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    ctr: {
      type: Number,
      default: 0
    },
    engagementRate: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
adCreativeSchema.index({ advertiser: 1, type: 1 });
adCreativeSchema.index({ 'approval.status': 1 });
adCreativeSchema.index({ isActive: 1 });

const AdCreative = mongoose.model('AdCreative', adCreativeSchema);
export default AdCreative;
