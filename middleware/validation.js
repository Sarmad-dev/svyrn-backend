import Joi from 'joi';

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