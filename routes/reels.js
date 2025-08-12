import express from "express";
import {
  createReel,
  getReels,
  getTrendingReels,
  getUserFeed,
  getReelById,
  updateReel,
  deleteReel,
  toggleArchiveReel,
  toggleReaction,
  toggleSaveReel,
  shareReel,
  getSavedReels,
  getUserReels,
  getReelAnalytics,
  getUserAnalyticsSummary,
  reportReel,
} from "../controllers/reelController.js";

import {
  createComment,
  getReelComments,
  getCommentReplies,
  updateComment,
  deleteComment,
  toggleCommentReaction,
  togglePinComment,
  toggleHideComment,
  flagCommentSpam,
  getUserComments,
  getFlaggedComments,
  moderateComment,
} from "../controllers/reelCommentController.js";

import { protect } from "../middleware/auth.js";
import { validateReel, validateComment } from "../middleware/validation.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// ==================== COMMENT ROUTES ====================

// Create a comment on a reel
router.post("/:reelId/comments", validateComment, createComment);

// Get comments for a reel
router.get("/:reelId/comments", getReelComments);

// Get replies for a comment
router.get("/comments/:commentId/replies", getCommentReplies);

// Update a comment
router.put("/comments/:commentId", validateComment, updateComment);

// Delete a comment
router.delete("/comments/:commentId", deleteComment);

// Toggle reaction on a comment
router.post("/comments/:commentId/reactions", toggleCommentReaction);

// Pin/Unpin a comment
router.patch("/comments/:commentId/pin", togglePinComment);

// Hide/Unhide a comment
router.patch("/comments/:commentId/hide", toggleHideComment);

// Flag comment as spam
router.patch("/comments/:commentId/spam", flagCommentSpam);

// Get user's comments
router.get("/comments/user", getUserComments);

// Get flagged comments for moderation
router.get("/comments/flagged", getFlaggedComments);

// Moderate a comment
router.patch("/comments/:commentId/moderate", moderateComment);

// ==================== REEL ROUTES ====================

// Create a new reel
router.post("/", validateReel, createReel);

// Get all reels with filters and pagination
router.get("/", getReels);

// Get trending reels
router.get("/trending", getTrendingReels);

// Get user's feed reels
router.get("/feed", getUserFeed);

// Get user's saved reels
router.get("/saved", getSavedReels);

// Get user's own reels
router.get("/user/:userId", getUserReels);

// Get a single reel by ID
router.get("/:id", getReelById);

// Update a reel
router.put("/:id", validateReel, updateReel);

// Delete a reel (soft delete)
router.delete("/:id", deleteReel);

// Archive/Unarchive a reel
router.patch("/:id/archive", toggleArchiveReel);

// Toggle reaction on a reel
router.post("/:id/reactions", toggleReaction);

// Toggle save on a reel
router.post("/:id/save", toggleSaveReel);

// Share a reel
router.post("/:id/share", shareReel);

// Get reel analytics
router.get("/:id/analytics", getReelAnalytics);

// Get user's analytics summary
router.get("/analytics/summary", getUserAnalyticsSummary);

// Report a reel
router.post("/:id/report", reportReel);

export default router;
