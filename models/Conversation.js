import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group'],
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    unreadCount: {
      type: Number,
      default: 0
    }
  }],
  name: {
    type: String,
    maxlength: [100, 'Conversation name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  avatar: {
    type: String,
    default: ''
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  settings: {
    allowMemberInvites: {
      type: Boolean,
      default: true
    },
    muteNotifications: {
      type: Boolean,
      default: false
    },
    disappearingMessages: {
      enabled: {
        type: Boolean,
        default: false
      },
      duration: {
        type: Number, // in hours
        default: 24
      }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for performance
conversationSchema.index({ participants: 1, lastActivity: -1 });
conversationSchema.index({ type: 1, isActive: 1 });
conversationSchema.index({ lastActivity: -1 });

// Virtual for active participants count
conversationSchema.virtual('activeParticipantsCount').get(function() {
  return this.participants.filter(p => p.isActive).length;
});

// Method to check if user is participant
conversationSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => 
    p.user.toString() === userId.toString() && p.isActive
  );
};

// Method to get participant info
conversationSchema.methods.getParticipant = function(userId) {
  return this.participants.find(p => 
    p.user.toString() === userId.toString()
  );
};

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;