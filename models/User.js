import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import NotificationHelper from "../utils/notificationHelper.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    // username: {
    //   type: String,
    //   required: false,
    //   unique: true,
    //   trim: true,
    //   maxlength: [50, 'Username cannot exceed 50 characters']
    // },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    coverPhoto: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },
    currentJob: {
      type: String,
      maxlength: [100, "Current job cannot exceed 100 characters"],
      default: "",
    },
    worksAt: {
      type: String,
      maxlength: [100, "Works at cannot exceed 100 characters"],
      default: "",
    },
    livesIn: {
      type: String,
      maxlength: [100, "Lives in cannot exceed 100 characters"],
      default: "",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    From: {
      type: String,
      maxlength: [100, "From cannot exceed 100 characters"],
      default: "",
    },
    martialStatus: {
      type: String,
      enum: [
        "single",
        "married",
        "engaged",
        "in a relationship",
        "complicated",
      ],
      default: "single",
    },
    location: {
      type: String,
      maxlength: [100, "Location cannot exceed 100 characters"],
    },
    website: {
      type: String,
      maxlength: [200, "Website URL cannot exceed 200 characters"],
    },
    dateOfBirth: {
      type: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    privacy: {
      profileVisibility: {
        type: String,
        enum: ["public", "friends", "private"],
        default: "public",
      },
      postVisibility: {
        type: String,
        enum: ["public", "friends", "private"],
        default: "friends",
      },
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friends: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "blocked"],
          default: "pending",
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
      },
    ],
    pages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Page",
      },
    ],
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerificationToken: String,
    emailVerificationExpire: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ name: 1 });
userSchema.index({ isActive: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.post("save", async function (doc, next) {
  if (this.isNew) {
    try {
      // Create a system welcome notification
      await NotificationHelper.createNotification({
        recipient: this._id,
        sender: this._id, // Self-notification for system messages
        type: "system",
        title: "Welcome to Social Network!",
        message:
          "Welcome to our platform! Start by completing your profile and connecting with friends.",
        data: {},
        priority: "high",
      });
    } catch (error) {
      console.error("Error creating welcome notification:", error);
    }
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get followers count
userSchema.virtual("followersCount").get(function () {
  return this.followers ? this.followers.length : 0;
});

// Get following count
userSchema.virtual("followingCount").get(function () {
  return this.following ? this.following.length : 0;
});

const User = mongoose.model("User", userSchema);
export default User;
