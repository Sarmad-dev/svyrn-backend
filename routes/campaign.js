import express from 'express';
import { protect } from '../middleware/auth.js';
import { validate, createCampaignSchema, updateCampaignSchema, processPaymentSchema } from '../middleware/validation.js';
import * as campaignController from '../controllers/campaignController.js';

const router = express.Router();

// Campaign routes
router.post('/', protect, validate(createCampaignSchema), campaignController.createCampaign);
router.get('/', protect, campaignController.getCampaigns);
router.get('/:id', protect, campaignController.getCampaign);
router.put('/:id', protect, validate(updateCampaignSchema), campaignController.updateCampaign);
router.patch('/:id/status', protect, campaignController.updateCampaignStatus);
router.post('/:id/payment', protect, validate(processPaymentSchema), campaignController.processCampaignPayment);
router.get('/:id/analytics', protect, campaignController.getCampaignAnalytics);

// Ad Set routes
router.post('/:campaignId/ad-sets', protect, campaignController.createAdSet);

// Ad routes
router.post('/ad-sets/:adSetId/ads', protect, campaignController.createAd);

export default router;