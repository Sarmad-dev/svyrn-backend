import express from 'express';
import { protect } from '../middleware/auth.js';
import * as campaignController from '../controllers/campaignController.js';

const router = express.Router();

// Campaign routes
router.post('/', protect, campaignController.createCampaign);
router.get('/', protect, campaignController.getCampaigns);
router.get('/:id', protect, campaignController.getCampaign);
router.put('/:id', protect, campaignController.updateCampaign);
router.patch('/:id/status', protect, campaignController.updateCampaignStatus);
router.post('/:id/payment', protect, campaignController.processCampaignPayment);
router.get('/:id/analytics', protect, campaignController.getCampaignAnalytics);

export default router;