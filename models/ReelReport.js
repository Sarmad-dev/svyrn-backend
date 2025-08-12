import mongoose from "mongoose";

const reelReportSchema = new mongoose.Schema(
  {
    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
      required: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: [true, "Report reason is required"],
      maxlength: [200, "Report reason cannot exceed 200 characters"],
      trim: true,
    },
    details: {
      type: String,
      maxlength: [1000, "Report details cannot exceed 1000 characters"],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "spam",
        "inappropriate",
        "violence",
        "harassment",
        "copyright",
        "fake_news",
        "hate_speech",
        "sexual_content",
        "other",
      ],
      default: "other",
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "reviewing", "resolved", "dismissed"],
      default: "pending",
    },
    moderatorNotes: String,
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    moderatedAt: Date,
    resolution: {
      type: String,
      enum: [
        "no_action",
        "warning_issued",
        "content_removed",
        "user_suspended",
        "user_banned",
        "other",
      ],
    },
    resolutionDetails: String,
    resolvedAt: Date,
    isUrgent: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    relatedReports: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ReelReport",
      },
    ],
    reportCount: {
      type: Number,
      default: 1,
    },
    lastReportedAt: {
      type: Date,
      default: Date.now,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReelReport",
    },
    evidence: [
      {
        type: {
          type: String,
          enum: ["screenshot", "link", "text", "other"],
        },
        url: String,
        description: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    tags: [String],
    language: {
      type: String,
      default: "en",
    },
    location: {
      country: String,
      region: String,
      city: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    deviceInfo: {
      userAgent: String,
      platform: String,
      browser: String,
      version: String,
    },
    ipAddress: String,
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    anonymousId: String,
    followUpRequired: {
      type: Boolean,
      default: false,
    },
    followUpNotes: String,
    followUpDate: Date,
    escalationLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    autoModerationScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    manualReviewRequired: {
      type: Boolean,
      default: false,
    },
    reviewDeadline: Date,
    isEscalated: {
      type: Boolean,
      default: false,
    },
    escalatedTo: {
      type: String,
      enum: ["senior_moderator", "admin", "legal_team", "other"],
    },
    escalatedAt: Date,
    escalationReason: String,
    timeToResolution: Number, // in milliseconds
    satisfactionRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: String,
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
reelReportSchema.index({ reel: 1, createdAt: -1 });
reelReportSchema.index({ reporter: 1, createdAt: -1 });
reelReportSchema.index({ status: 1, priority: -1 });
reelReportSchema.index({ category: 1, severity: 1 });
reelReportSchema.index({ isUrgent: 1, createdAt: -1 });
reelReportSchema.index({ "reel.author": 1, createdAt: -1 });
reelReportSchema.index({ autoModerationScore: -1 });
reelReportSchema.index({ escalationLevel: -1 });

// Virtual for report age
reelReportSchema.virtual("ageInHours").get(function () {
  const now = new Date();
  const ageInMs = now - this.createdAt;
  return Math.floor(ageInMs / (1000 * 60 * 60));
});

// Virtual for isOverdue
reelReportSchema.virtual("isOverdue").get(function () {
  if (this.reviewDeadline) {
    return new Date() > this.reviewDeadline;
  }
  return false;
});

// Pre-save middleware to update priority and urgency
reelReportSchema.pre("save", function (next) {
  // Calculate priority based on severity and category
  let priority = 0;
  
  switch (this.severity) {
    case "critical":
      priority += 8;
      break;
    case "high":
      priority += 6;
      break;
    case "medium":
      priority += 4;
      break;
    case "low":
      priority += 2;
      break;
  }
  
  // Add priority for urgent categories
  if (["violence", "harassment", "hate_speech", "sexual_content"].includes(this.category)) {
    priority += 3;
  }
  
  // Add priority for copyright and fake news
  if (["copyright", "fake_news"].includes(this.category)) {
    priority += 2;
  }
  
  // Set urgency based on priority
  this.isUrgent = priority >= 8;
  this.priority = Math.min(10, priority);
  
  // Set escalation level based on priority
  if (priority >= 9) {
    this.escalationLevel = 3;
  } else if (priority >= 7) {
    this.escalationLevel = 2;
  } else if (priority >= 5) {
    this.escalationLevel = 1;
  }
  
  // Set review deadline based on priority
  if (priority >= 8) {
    this.reviewDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
  } else if (priority >= 6) {
    this.reviewDeadline = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours
  } else if (priority >= 4) {
    this.reviewDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  } else {
    this.reviewDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
  }
  
  next();
});

// Method to update status
reelReportSchema.methods.updateStatus = function (newStatus, moderatorId = null, notes = "") {
  this.status = newStatus;
  
  if (moderatorId) {
    this.moderatedBy = moderatorId;
    this.moderatedAt = new Date();
  }
  
  if (notes) {
    this.moderatorNotes = notes;
  }
  
  if (newStatus === "resolved") {
    this.resolvedAt = new Date();
    this.timeToResolution = this.resolvedAt - this.createdAt;
  }
  
  return this.save();
};

// Method to escalate report
reelReportSchema.methods.escalate = function (level, reason = "", escalatedTo = "senior_moderator") {
  this.escalationLevel = Math.min(5, Math.max(0, level));
  this.isEscalated = true;
  this.escalatedTo = escalatedTo;
  this.escalatedAt = new Date();
  this.escalationReason = reason;
  
  return this.save();
};

// Method to add evidence
reelReportSchema.methods.addEvidence = function (evidenceData) {
  this.evidence.push(evidenceData);
  return this.save();
};

// Method to mark as duplicate
reelReportSchema.methods.markAsDuplicate = function (originalReportId) {
  this.isDuplicate = true;
  this.duplicateOf = originalReportId;
  return this.save();
};

// Method to add moderator notes
reelReportSchema.methods.addModeratorNotes = function (notes, moderatorId) {
  this.moderatorNotes = notes;
  this.moderatedBy = moderatorId;
  this.moderatedAt = new Date();
  return this.save();
};

// Method to set resolution
reelReportSchema.methods.setResolution = function (resolution, details = "") {
  this.resolution = resolution;
  this.resolutionDetails = details;
  this.resolvedAt = new Date();
  this.status = "resolved";
  this.timeToResolution = this.resolvedAt - this.createdAt;
  return this.save();
};

// Method to set follow-up
reelReportSchema.methods.setFollowUp = function (required, notes = "", date = null) {
  this.followUpRequired = required;
  this.followUpNotes = notes;
  this.followUpDate = date || new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 24 hours
  return this.save();
};

// Method to update auto-moderation score
reelReportSchema.methods.updateAutoModerationScore = function (score) {
  this.autoModerationScore = Math.min(100, Math.max(0, score));
  this.manualReviewRequired = score >= 70;
  return this.save();
};

// Method to add satisfaction rating
reelReportSchema.methods.addSatisfactionRating = function (rating, feedback = "") {
  this.satisfactionRating = Math.min(5, Math.max(1, rating));
  this.feedback = feedback;
  return this.save();
};

// Static method to get urgent reports
reelReportSchema.statics.getUrgentReports = function (limit = 50) {
  return this.find({
    isUrgent: true,
    status: { $in: ["pending", "reviewing"] },
  })
    .sort({ priority: -1, createdAt: 1 })
    .limit(limit)
    .populate("reel", "caption media author")
    .populate("reporter", "name profilePicture username");
};

// Static method to get overdue reports
reelReportSchema.statics.getOverdueReports = function (limit = 50) {
  const now = new Date();
  return this.find({
    reviewDeadline: { $lt: now },
    status: { $in: ["pending", "reviewing"] },
  })
    .sort({ reviewDeadline: 1 })
    .limit(limit)
    .populate("reel", "caption media author")
    .populate("reporter", "name profilePicture username");
};

// Static method to get reports by category
reelReportSchema.statics.getReportsByCategory = function (category, limit = 50, skip = 0) {
  return this.find({ category })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("reel", "caption media author")
    .populate("reporter", "name profilePicture username");
};

// Static method to get reports by status
reelReportSchema.statics.getReportsByStatus = function (status, limit = 50, skip = 0) {
  return this.find({ status })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("reel", "caption media author")
    .populate("reporter", "name profilePicture username");
};

// Static method to get reports for a specific reel
reelReportSchema.statics.getReportsForReel = function (reelId, limit = 50, skip = 0) {
  return this.find({ reel: reelId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("reporter", "name profilePicture username");
};

// Static method to get reports by user
reelReportSchema.statics.getReportsByUser = function (userId, limit = 50, skip = 0) {
  return this.find({ reporter: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("reel", "caption media");
};

// Static method to get escalated reports
reelReportSchema.statics.getEscalatedReports = function (limit = 50) {
  return this.find({
    isEscalated: true,
    status: { $in: ["pending", "reviewing"] },
  })
    .sort({ escalationLevel: -1, createdAt: 1 })
    .limit(limit)
    .populate("reel", "caption media author")
    .populate("reporter", "name profilePicture username");
};

// Static method to get reports requiring manual review
reelReportSchema.statics.getReportsRequiringManualReview = function (limit = 50) {
  return this.find({
    manualReviewRequired: true,
    status: { $in: ["pending", "reviewing"] },
  })
    .sort({ autoModerationScore: -1, createdAt: 1 })
    .limit(limit)
    .populate("reel", "caption media author")
    .populate("reporter", "name profilePicture username");
};

// Static method to get report statistics
reelReportSchema.statics.getReportStatistics = function (timeframe = "7d") {
  const now = new Date();
  let startDate;
  
  switch (timeframe) {
    case "24h":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalReports: { $sum: 1 },
        pendingReports: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        resolvedReports: {
          $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
        },
        urgentReports: {
          $sum: { $cond: [{ $eq: ["$isUrgent", true] }, 1, 0] },
        },
        escalatedReports: {
          $sum: { $cond: [{ $eq: ["$isEscalated", true] }, 1, 0] },
        },
        avgTimeToResolution: { $avg: "$timeToResolution" },
        avgSatisfactionRating: { $avg: "$satisfactionRating" },
      },
    },
  ]);
};

const ReelReport = mongoose.model("ReelReport", reelReportSchema);

export default ReelReport;
