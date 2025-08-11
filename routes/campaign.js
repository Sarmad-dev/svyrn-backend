import express from 'express';
import { protect } from '../middleware/auth.js';
import { validate, createCampaignSchema, updateCampaignSchema, processPaymentSchema, createAdSetSchema, createAdSchema } from '../middleware/validation.js';
import * as campaignController from '../controllers/campaignController.js';

const router = express.Router();

// Campaign routes
router.post('/', protect, validate(createCampaignSchema), campaignController.createCampaign);
router.get('/', protect, campaignController.getCampaigns);
router.get('/analytics/overview', protect, campaignController.getCampaignsOverview);
router.get('/:id', protect, campaignController.getCampaign);
router.put('/:id', protect, validate(updateCampaignSchema), campaignController.updateCampaign);
router.patch('/:id/status', protect, campaignController.updateCampaignStatus);
router.post('/:id/payment', protect, validate(processPaymentSchema), campaignController.processCampaignPayment);
router.get('/:id/analytics', protect, campaignController.getCampaignAnalytics);
router.delete('/:id', protect, campaignController.deleteCampaign);

// Ad Set routes
router.post('/:campaignId/ad-sets', protect, campaignController.createAdSet);
router.get('/:campaignId/ad-sets', protect, campaignController.getCampaignAdSets);

// Ad routes
router.post('/ad-sets/:adSetId/ads', protect, validate(createAdSchema), campaignController.createAd);
router.get('/ad-sets/:adSetId/ads', protect, campaignController.getAdSetAds);

export default router;