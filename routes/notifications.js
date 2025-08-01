import express from 'express';
import { protect } from '../middleware/auth.js';
import * as notificationController from '../controllers/notificationController.js';

const router = express.Router();

// Notification routes
router.get('/', protect, notificationController.getNotifications);
router.put('/:id/read', protect, notificationController.markAsRead);
router.put('/read-all', protect, notificationController.markAllAsRead);
router.delete('/:id', protect, notificationController.deleteNotification);
router.get('/unread-count', protect, notificationController.getUnreadCount);

export default router;