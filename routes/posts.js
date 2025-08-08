import express from 'express';
import { protect } from '../middleware/auth.js';
import { validate, createPostSchema, createCommentSchema } from '../middleware/validation.js';
import * as postController from '../controllers/postController.js';

const router = express.Router();

// Post routes
router.post('/', protect, postController.createPost);
router.get('/feed', protect, postController.getFeed);
router.get('/:id', protect, postController.getPost);
router.put('/:id', protect, postController.updatePost);
router.delete('/:id', protect, postController.deletePost);
router.post('/:id/react', protect, postController.reactToPost);
router.post('/:id/comments', protect, validate(createCommentSchema), postController.addComment);
router.post('/:id/share', protect, postController.sharePost);
router.post('/:id/save', protect, postController.savePost);
router.post('/:id/hide', protect, postController.hidePost);
router.get('/:id/media', protect, postController.getMedia);
router.get('/:id/comments', protect, postController.getComments)


export default router;