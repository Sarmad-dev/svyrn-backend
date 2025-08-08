import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.js';
import * as adController from '../controllers/adController.js';

const router = express.Router();

// Rate limiting for performance updates
const performanceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 1000 performance updates per minute
  message: {
    status: 'error',
    message: 'Too many performance updates, please try again later.'
  }
});
// Ad routes
router.post('/', protect, adController.createAd);
router.get('/', protect, adController.getAds);
router.get('/:id', protect, adController.getAd);
router.put('/:id', protect, adController.updateAd);
router.patch('/:id/status', protect, adController.updateAdStatus);
router.get('/:id/performance', protect, adController.getAdPerformance);
router.patch('/:id/performance', protect, performanceLimiter, adController.updateAdPerformance);
router.patch('/performance/batch', protect, performanceLimiter, adController.batchUpdatePerformance);

export default router;