import Joi from 'joi';
import { body, validationResult } from "express-validator";

export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    next();
  };
};

// User validation schemas
export const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  dateOfBirth: Joi.date().iso().optional()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional(),
  currentJob: Joi.string().trim().min(2).max(50).optional(),
  worksAt: Joi.string().trim().min(2).max(50).optional(),
  livesIn: Joi.string().trim().min(2).max(50).optional(),
  From: Joi.string().trim().min(2).max(50).optional(),
  martialStatus: Joi.string().valid('single', 'married', 'engaged', 'in a relationship', 'complicated').optional(),
  bio: Joi.string().max(500).allow('').optional(),
  location: Joi.string().max(100).allow('').optional(),
  website: Joi.string().max(200).allow('').optional(),
  privacy: Joi.object({
    profileVisibility: Joi.string().valid('public', 'friends', 'private').optional(),
    postVisibility: Joi.string().valid('public', 'friends', 'private').optional()
  }).optional()
});

// Post validation schemas
export const createPostSchema = Joi.object({
  content: Joi.object({
    text: Joi.string().max(5000).allow('').optional(),
    media: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('image', 'video', 'document').required(),
        url: Joi.string().uri().required(),
        caption: Joi.string().allow('').optional()
      })
    ).optional()
  }).required(),
  privacy: Joi.string().valid('public', 'friends', 'private').optional(),
  location: Joi.object({
    name: Joi.string().optional(),
    coordinates: Joi.object({
      latitude: Joi.number().min(-90).max(90).optional(),
      longitude: Joi.number().min(-180).max(180).optional()
    }).optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).optional()
});

// Comment validation schemas
export const createCommentSchema = Joi.object({
  content: Joi.string().trim().min(1).max(1000).required(),
  parentComment: Joi.string().optional()
});

// Group validation schemas
export const createGroupSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  description: Joi.string().max(2000).allow('').optional(),
  privacy: Joi.string().valid('public', 'private', 'secret').optional(),
  image: Joi.string().optional(),
  category: Joi.string().valid(
    'general', 'business', 'education', 'entertainment', 'gaming',
    'health', 'lifestyle', 'music', 'news', 'photography',
    'politics', 'science', 'sports', 'technology', 'travel'
  ).optional()
});

// Product validation schemas
export const createProductSchema = Joi.object({
  title: Joi.string().trim().min(5).max(200).required(),
  description: Joi.string().trim().min(10).max(5000).required(),
  price: Joi.object({
    amount: Joi.number().min(0).required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD').optional()
  }).required(),
  category: Joi.string().valid(
    'electronics', 'clothing', 'home', 'books', 'sports',
    'automotive', 'toys', 'beauty', 'jewelry', 'art',
    'music', 'tools', 'garden', 'pets', 'food', 'other'
  ).optional(),
  condition: Joi.string().valid('new', 'like_new', 'good', 'fair', 'poor').optional(),
  location: Joi.object({
    address: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    country: Joi.string().optional()
  }).optional(),
  privacy: Joi.string().valid('public', 'friends').optional(),
  images: Joi.array().items(Joi.string()).optional(),
  contact: Joi.object({
    email: Joi.string().email().optional(),
    phone: Joi.string().optional()
  }).optional()
});

// Story validation schemas
export const createStorySchema = Joi.object({
  content: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('image', 'video').required(),
      url: Joi.string().uri().required(),
      caption: Joi.string().max(200).allow('').optional(),
      duration: Joi.number().min(1).max(30).optional(),
      size: Joi.number().optional(),
      thumbnail: Joi.string().uri().optional()
    })
  ).min(1).max(10).required(),
  privacy: Joi.string().valid('public', 'friends', 'close_friends').optional(),
  location: Joi.object({
    name: Joi.string().optional(),
    coordinates: Joi.object({
      latitude: Joi.number().min(-90).max(90).optional(),
      longitude: Joi.number().min(-180).max(180).optional()
    }).optional()
  }).optional(),
  backgroundColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
  music: Joi.object({
    title: Joi.string().optional(),
    artist: Joi.string().optional(),
    url: Joi.string().uri().optional()
  }).optional()
});

// Campaign validation schemas
export const createCampaignSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  image: Joi.string().optional(), // Accept base64 data
  objective: Joi.string().valid(
    'awareness', 'reach', 'traffic', 'engagement', 'app_installs',
    'video_views', 'lead_generation', 'messages', 'conversions', 'catalog_sales'
  ).required(),
  budget: Joi.object({
    type: Joi.string().valid('daily', 'lifetime').required(),
    amount: Joi.number().min(1).required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD').default('USD')
  }).required(),
  schedule: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
  }).required(),
  targeting: Joi.object({
    demographics: Joi.object({
      ageMin: Joi.number().min(13).max(65).required(),
      ageMax: Joi.number().min(Joi.ref('ageMin')).max(65).required(),
      genders: Joi.array().items(Joi.string().valid('male', 'female', 'other')).optional(),
      languages: Joi.array().items(Joi.string()).optional()
    }).required(),
    location: Joi.object({
      countries: Joi.array().items(Joi.string()).optional(),
      regions: Joi.array().items(Joi.string()).optional(),
      cities: Joi.array().items(Joi.string()).optional(),
      radius: Joi.number().min(1).max(1000).optional(),
      coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90).optional(),
        longitude: Joi.number().min(-180).max(180).optional()
      }).optional()
    }).optional(),
    interests: Joi.array().items(
      Joi.object({
        category: Joi.string().required(),
        subcategory: Joi.string().optional(),
        weight: Joi.number().min(1).max(10).default(1)
      })
    ).optional(),
    behaviors: Joi.array().items(
      Joi.object({
        type: Joi.string().required(),
        description: Joi.string().optional()
      })
    ).optional()
  }).optional(),
  campaignBudgetOptimization: Joi.boolean().default(false),
  specialAdCategories: Joi.array().items(Joi.string()).optional()
});

export const updateCampaignSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  objective: Joi.string().valid(
    'awareness', 'reach', 'traffic', 'engagement', 'app_installs',
    'video_views', 'lead_generation', 'messages', 'conversions', 'catalog_sales'
  ).optional(),
  budget: Joi.object({
    type: Joi.string().valid('daily', 'lifetime').optional(),
    amount: Joi.number().min(1).optional(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD').optional()
  }).optional(),
  schedule: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
  }).optional(),
  targeting: Joi.object({
    demographics: Joi.object({
      ageMin: Joi.number().min(13).max(65).optional(),
      ageMax: Joi.number().min(Joi.ref('ageMin')).max(65).optional(),
      genders: Joi.array().items(Joi.string().valid('male', 'female', 'other')).optional(),
      languages: Joi.array().items(Joi.string()).optional()
    }).optional(),
    location: Joi.object({
      countries: Joi.array().items(Joi.string()).optional(),
      regions: Joi.array().items(Joi.string()).optional(),
      cities: Joi.array().items(Joi.string()).optional(),
      radius: Joi.number().min(1).max(1000).optional(),
      coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90).optional(),
        longitude: Joi.number().min(-180).max(180).optional()
      }).optional()
    }).optional(),
    interests: Joi.array().items(
      Joi.object({
        category: Joi.string().required(),
        subcategory: Joi.string().optional(),
        weight: Joi.number().min(1).max(10).default(1)
      })
    ).optional(),
    behaviors: Joi.array().items(
      Joi.object({
        type: Joi.string().required(),
        description: Joi.string().optional()
      })
    ).optional()
  }).optional(),
  campaignBudgetOptimization: Joi.boolean().optional(),
  specialAdCategories: Joi.array().items(Joi.string()).optional()
});

export const processPaymentSchema = Joi.object({
  paymentMethod: Joi.string().valid('stripe', 'paypal').required(),
  paymentData: Joi.object({
    paymentMethodId: Joi.string().when('paymentMethod', {
      is: 'stripe',
      then: Joi.required()
    }),
    orderID: Joi.string().when('paymentMethod', {
      is: 'paypal',
      then: Joi.required()
    }),
    payerID: Joi.string().when('paymentMethod', {
      is: 'paypal',
      then: Joi.required()
    })
  }).required()
});

// Ad Set validation schemas
export const createAdSetSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  budget: Joi.object({
    type: Joi.string().valid('daily', 'lifetime').required(),
    amount: Joi.number().min(1).required()
  }).required(),
  bidStrategy: Joi.string().valid('lowest_cost', 'cost_cap', 'bid_cap', 'target_cost').default('lowest_cost'),
  bidAmount: Joi.number().min(0).optional(),
  optimization: Joi.object({
    goal: Joi.string().valid('impressions', 'clicks', 'conversions', 'reach', 'engagement').default('clicks'),
    eventType: Joi.string().optional(),
    conversionWindow: Joi.number().min(1).max(28).default(1)
  }).optional(),
  targeting: Joi.object({
    demographics: Joi.object({
      ageMin: Joi.number().min(13).max(65).optional(),
      ageMax: Joi.number().min(13).max(65).optional(),
      genders: Joi.array().items(Joi.string().valid('male', 'female', 'other')).optional(),
      relationshipStatus: Joi.array().items(Joi.string()).optional(),
      education: Joi.array().items(Joi.string()).optional(),
      jobTitles: Joi.array().items(Joi.string()).optional(),
      income: Joi.array().items(Joi.string()).optional()
    }).optional(),
    location: Joi.object({
      countries: Joi.array().items(Joi.string()).optional(),
      regions: Joi.array().items(Joi.string()).optional(),
      cities: Joi.array().items(Joi.string()).optional(),
      radius: Joi.number().min(1).max(1000).optional(),
      coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90).optional(),
        longitude: Joi.number().min(-180).max(180).optional()
      }).optional()
    }).optional(),
    interests: Joi.array().items(
      Joi.object({
        category: Joi.string().required(),
        subcategory: Joi.string().optional(),
        weight: Joi.number().min(1).max(10).default(1)
      })
    ).optional(),
    behaviors: Joi.array().items(
      Joi.object({
        type: Joi.string().required(),
        description: Joi.string().optional()
      })
    ).optional()
  }).optional(),
  placement: Joi.object({
    platforms: Joi.array().items(Joi.string().valid('facebook', 'instagram', 'google', 'twitter', 'linkedin')).optional(),
    devices: Joi.array().items(Joi.string().valid('desktop', 'mobile', 'tablet')).optional(),
    positions: Joi.array().items(Joi.string().valid('feed', 'stories', 'reels', 'search', 'display')).optional()
  }).optional(),
  schedule: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    adSchedule: Joi.array().items(
      Joi.object({
        day: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').required(),
        startTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        endTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
      })
    ).optional()
  }).required(),
  frequencyCap: Joi.object({
    impressions: Joi.number().min(1).optional(),
    period: Joi.string().valid('day', 'week', 'month').optional()
  }).optional()
});

// Ad validation schemas
export const createAdSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().min(1).max(500).required(),
  creative: Joi.object({
    type: Joi.string().valid('image', 'video', 'carousel', 'slideshow', 'collection', 'text').required(),
    media: Joi.array().items(
      Joi.object({
        url: Joi.string().optional(),
        thumbnail: Joi.string().optional(),
        caption: Joi.string().max(200).optional(),
        altText: Joi.string().max(200).optional(),
        duration: Joi.number().min(0).optional(),
        order: Joi.number().min(0).optional()
      })
    ).optional(),
    primaryText: Joi.string().max(125).required(),
    headline: Joi.string().max(40).required(),
    callToAction: Joi.string().valid(
      'learn_more', 'shop_now', 'sign_up', 'download', 'contact_us', 'book_now',
      'get_quote', 'apply_now', 'donate_now', 'subscribe'
    ).default('learn_more'),
    destinationUrl: Joi.string().uri().optional(),
    dynamicAdCreative: Joi.boolean().default(false),
    brandSafety: Joi.boolean().default(true)
  }).required(),
  budget: Joi.object({
    type: Joi.string().valid('daily', 'lifetime').required(),
    amount: Joi.number().min(1).required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD').default('USD'),
    bidStrategy: Joi.string().valid('lowest_cost', 'cost_cap', 'bid_cap').default('lowest_cost')
  }).required(),
  duration: Joi.number().min(1).required(),
  schedule: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    timezone: Joi.string().default('UTC')
  }).required(),
  tags: Joi.array().items(Joi.string()).optional()
});

// Validation for reels
export const validateReel = [
  body("mediaType")
    .isIn(["image", "video"])
    .withMessage("Media type must be either 'image' or 'video'"),
  
  body("mediaUrl")
    .notEmpty()
    .withMessage("Media URL is required"),
  
  body("caption")
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage("Caption must be between 1 and 500 characters"),
  
  body("privacy")
    .optional()
    .isIn(["public", "friends", "private", "followers"])
    .withMessage("Invalid privacy setting"),
  
  body("location")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Location must be less than 100 characters"),
  
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),
  
  body("hashtags")
    .optional()
    .isArray()
    .withMessage("Hashtags must be an array"),
  
  body("mentions")
    .optional()
    .isArray()
    .withMessage("Mentions must be an array"),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

// Validation for comments
export const validateComment = [
  body("content")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Comment content must be between 1 and 1000 characters"),
  
  body("parentCommentId")
    .optional()
    .isMongoId()
    .withMessage("Parent comment ID must be a valid MongoDB ID"),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

// Validation for reactions
export const validateReaction = [
  body("reactionType")
    .optional()
    .isIn(["like", "love", "haha", "wow", "sad", "angry"])
    .withMessage("Invalid reaction type"),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

// Validation for sharing
export const validateShare = [
  body("caption")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Share caption cannot exceed 500 characters"),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

// Validation for reporting
export const validateReport = [
  body("reason")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Report reason must be between 1 and 200 characters"),
  
  body("details")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Report details cannot exceed 1000 characters"),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

// Validation for comment moderation
export const validateModeration = [
  body("status")
    .isIn(["pending", "approved", "rejected", "flagged"])
    .withMessage("Invalid moderation status"),
  
  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Moderation notes cannot exceed 500 characters"),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

// Validation for comment hiding
export const validateHideComment = [
  body("reason")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Hide reason cannot exceed 200 characters"),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

// Validation for spam flagging
export const validateSpamFlag = [
  body("score")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Spam score must be between 0 and 100"),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];