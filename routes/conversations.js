import express from 'express';
import { protect } from '../middleware/auth.js';
import * as conversationController from '../controllers/conversationController.js';

const router = express.Router();

// Conversation routes
router.post('/', protect, conversationController.createConversation);
router.get('/', protect, conversationController.getConversations);
router.get('/:id', protect, conversationController.getConversation);
router.post('/:id/messages', protect, conversationController.sendMessage);
router.get('/:id/messages', protect, conversationController.getMessages);
router.put('/:conversationId/messages/:messageId', protect, conversationController.editMessage);
router.delete('/:conversationId/messages/:messageId', protect, conversationController.deleteMessage);
router.post('/:conversationId/messages/:messageId/react', protect, conversationController.reactToMessage);
router.post('/:id/participants', protect, conversationController.addParticipants);
router.delete('/:id/participants/:userId', protect, conversationController.removeParticipant);

export default router;