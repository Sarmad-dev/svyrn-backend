import express from 'express';
import { protect } from '../middleware/auth.js';
import * as recommendationController from '../controllers/recommendationController.js';

const router = express.Router();

// Recommendation routes
router.get('/feed', protect, recommendationController.getRecommendedFeed);
router.post('/interaction', protect, recommendationController.trackInteraction);
router.get('/preferences', protect, recommendationController.getPreferences);
router.put('/preferences', protect, recommendationController.updatePreferences);
router.get('/analytics', protect, recommendationController.getAnalytics);
router.post('/feedback', protect, recommendationController.provideFeedback);
router.get('/similar-users', protect, recommendationController.getSimilarUsers);

export default router;