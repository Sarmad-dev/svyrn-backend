import express from 'express';
import { protect } from '../middleware/auth.js';
import * as adController from '../controllers/adController.js';

const router = express.Router();

// Ad routes
router.post('/', protect, adController.createAd);
router.get('/', protect, adController.getAds);
router.get('/user/:id', protect, adController.getUserAds)
router.get('/:id', protect, adController.getAd);
router.put('/:id', protect, adController.updateAd);
router.patch('/:id/status', protect, adController.updateAdStatus);
router.get('/:id/performance', protect, adController.getAdPerformance);

export default router;
