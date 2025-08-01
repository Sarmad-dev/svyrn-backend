import express from 'express';
import { protect } from '../middleware/auth.js';
import * as pageController from '../controllers/pageController.js';

const router = express.Router();

// Page routes
router.post('/', protect, pageController.createPage);
router.get('/', protect, pageController.getPages);
router.get('/:id', protect, pageController.getPage);
router.post('/:id/follow', protect, pageController.followPage);
router.delete('/:id/unfollow', protect, pageController.unfollowPage);
router.get('/:id/analytics', protect, pageController.getPageAnalytics);
router.put('/:id', protect, pageController.updatePage);

export default router;