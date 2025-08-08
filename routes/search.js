import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from './../middleware/auth.js';
import { globalSearch } from '../controllers/searchController.js';

const router = express.Router();

// Rate limiting for search endpoints
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 search requests per windowMs
  message: {
    status: 'error',
    message: 'Too many search requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to all search routes
router.use(searchLimiter);

// Global search endpoint
router.get('/global', protect, globalSearch);

export default router