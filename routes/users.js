import express from 'express';
import { protect } from '../middleware/auth.js';
import { validate, updateProfileSchema } from '../middleware/validation.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// User routes
router.get('/search', protect, userController.searchUsers);
router.put('/profile', protect, userController.updateProfile);
router.get('/my-profile', protect, userController.getMyProfile);
router.get('/:id/posts', protect, userController.getUserPosts);
router.post('/:id/follow', protect, userController.followUser);
router.delete('/:id/unfollow', protect, userController.unfollowUser);
router.get('/:id', protect, userController.getUserProfile);
router.get('/:id/followers', protect, userController.getUserFollowers);
router.get('/:id/following', protect, userController.getUserFollowing);
router.get('/:id/photos', protect, userController.getUserPhotos);
router.get('/:id/videos', protect, userController.getUserVideos);

export default router;