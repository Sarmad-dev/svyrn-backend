import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  ipAddress: {
    type: String,
  },
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  socketId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['online', 'away', 'busy', 'offline'],
    default: 'online'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  device: {
    type: String,
    enum: ['web', 'mobile', 'desktop'],
    default: 'web'
  },
  userAgent: String,
  ipAddress: String,
  location: {
    country: String,
    city: String,
    timezone: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for performance
sessionSchema.index({ user: 1, isActive: 1 });
sessionSchema.index({ socketId: 1 });
sessionSchema.index({ status: 1, lastSeen: -1 });

// TTL index to automatically remove old sessions after 30 days
sessionSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const UserSession = mongoose.model('UserSession', sessionSchema);
export default UserSession;