import express from 'express';
import { protect } from '../middleware/auth.js';
import * as uploadController from '../controllers/uploadController.js';

const router = express.Router();

// Upload routes
router.post('/cloudinary', protect, uploadController.uploadToCloudinary);
router.delete('/cloudinary/:publicId', protect, uploadController.deleteFromCloudinary);

export default router;