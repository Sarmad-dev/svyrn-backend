import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    text: {
      type: String,
      maxlength: [5000, 'Message cannot exceed 5000 characters']
    },
    media: [{
      type: {
        type: String,
        enum: ['image', 'video', 'audio', 'document'],
        required: true
      },
      url: {
        type: String,
        required: true
      },
      filename: String,
      size: Number,
      duration: Number // for audio/video
    }],
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    }
  },
  type: {
    type: String,
    enum: ['text', 'media', 'location', 'system'],
    default: 'text'
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  deliveredTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  expiresAt: Date // for disappearing messages
}, {
  timestamps: true
});

// Indexes for performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for reactions count
messageSchema.virtual('reactionsCount').get(function() {
  return this.reactions.length;
});

// Method to check if message is read by user
messageSchema.methods.isReadBy = function(userId) {
  return this.readBy.some(read => 
    read.user.toString() === userId.toString()
  );
};

// Method to mark as read
messageSchema.methods.markAsRead = function(userId) {
  if (!this.isReadBy(userId)) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
  }
};

const Message = mongoose.model('Message', messageSchema);
export default Message;