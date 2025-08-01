import express from "express";
import { protect } from "../middleware/auth.js";
import { validate, createGroupSchema } from "../middleware/validation.js";
import * as groupController from "../controllers/groupController.js";

const router = express.Router();

// Group routes
router.post('/', protect, validate(createGroupSchema), groupController.createGroup);
router.get('/my-groups', protect, groupController.getUserGroups);
router.get('/my-groups/posts', protect, groupController.getUserGroupFeed);
router.get('/', protect, groupController.getGroups);
router.get('/:id', protect, groupController.getGroup);
router.post('/:id/join', protect, groupController.joinGroup);
router.delete('/:id/leave', protect, groupController.leaveGroup);
router.put('/:id', protect, groupController.updateGroup);

export default router;