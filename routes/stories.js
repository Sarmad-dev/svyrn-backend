import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createStory,
  getTimelineStories,
  getStory,
  getMyStories,
  deleteStory,
  getStoryViewers,
  addReaction,
  addComment,
  getStoryInteractions,
} from "../controllers/storyController.js";
import backgroundJobManager from "../services/BackgroundJobManager.js";

const router = express.Router();

// Story routes
router.post("/", protect, createStory);
router.get("/timeline", protect, getTimelineStories);
router.get("/my-stories", protect, getMyStories);
router.get("/:id", protect, getStory);
router.delete("/:id", protect, deleteStory);
router.get("/:id/viewers", protect, getStoryViewers);

// Story interaction routes
router.post("/:id/react", protect, addReaction);
router.post("/:id/comment", protect, addComment);
router.get("/:id/interactions", protect, getStoryInteractions);

// Admin/testing routes
router.post("/cleanup", protect, async (req, res) => {
  try {
    const deletedCount = await backgroundJobManager.deleteExpiredStoriesNow();

    res.status(200).json({
      status: "success",
      message: "Story cleanup completed",
      data: { deletedCount },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error running story cleanup",
      error: error.message,
    });
  }
});

export default router;
