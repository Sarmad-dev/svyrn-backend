import express from 'express';
import { protect } from '../middleware/auth.js';
import * as marketplaceController from '../controllers/marketplaceController.js';

const router = express.Router();

// Marketplace routes
router.post('/products', protect, marketplaceController.createProduct);
router.get('/products', protect, marketplaceController.getProducts);
router.get('/products/:id', protect, marketplaceController.getProduct);
router.get('/products/user/:id', protect, marketplaceController.getUserProducts);
router.put('/products/:id', protect, marketplaceController.updateProduct);
router.put('/products/:id/review', protect, marketplaceController.addReview);
router.post('/products/:id/interest', protect, marketplaceController.expressInterest);
router.get('/categories', protect, marketplaceController.getCategories);
router.delete('/products/:id', protect, marketplaceController.deleteProduct);

export default router;