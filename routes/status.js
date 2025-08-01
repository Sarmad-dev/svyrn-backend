import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getOnlineUsers,
  getUserStatus,
  updateStatus,
  getSessions,
  getStatusStats,
} from "../controllers/statusController.js";

const router = express.Router();

// Status routes
router.get("/online-users", protect, getOnlineUsers);
router.get("/user/:id", protect, getUserStatus);
router.put("/update", protect, updateStatus);
router.get("/sessions", protect, getSessions);
router.get("/stats", protect, getStatusStats);

export default router;