import express from 'express';
import { protect } from '../middleware/auth.js';
import * as uploadController from '../controllers/uploadController.js';

const router = express.Router();

// Upload routes
router.post('/image', protect, uploadController.upload.single('image'), uploadController.uploadImage);
router.post('/video', protect, uploadController.upload.single('video'), uploadController.uploadVideo);
router.post('/multiple', protect, uploadController.upload.array('files', 10), uploadController.uploadMultiple);
router.post('/profile-picture', protect, uploadController.upload.single('image'), uploadController.uploadProfilePicture);
router.post('/cover-photo', protect, uploadController.upload.single('image'), uploadController.uploadCoverPhoto);

export default router;