import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  
  // Message type
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system', 'travel_request'],
    default: 'text'
  },
  
  // Sender information
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Chat room this message belongs to
  chatRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true
  },
  
  // For file/image messages
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String
  }],
  
  // For travel partner requests
  travelRequest: {
    destination: {
      country: String,
      city: String,
      region: String
    },
    startDate: Date,
    endDate: Date,
    budget: {
      min: Number,
      max: Number,
      currency: {
        type: String,
        default: 'USD'
      }
    },
    groupSize: {
      type: Number,
      min: 1,
      max: 20,
      default: 1
    },
    interests: [String],
    description: String
  },
  
  // Message status
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  
  // Message reactions
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
  
  // Reply to another message
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Message read status (for private chats)
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
  
  // For system messages
  systemData: {
    action: {
      type: String,
      enum: ['user_joined', 'user_left', 'room_created', 'member_promoted', 'member_demoted']
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    metadata: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
messageSchema.index({ chatRoom: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ type: 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ 'travelRequest.destination.country': 1 });
messageSchema.index({ 'travelRequest.startDate': 1 });

// Virtual for reaction count
messageSchema.virtual('reactionCount').get(function() {
  return this.reactions.length;
});

// Virtual for reply count (would need aggregation)
messageSchema.virtual('replyCount').get(function() {
  // This would typically be calculated via aggregation
  return 0;
});

// Method to add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(
    reaction => reaction.user.toString() !== userId.toString()
  );
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji: emoji,
    createdAt: new Date()
  });
  
  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(userId, emoji = null) {
  if (emoji) {
    this.reactions = this.reactions.filter(
      reaction => !(reaction.user.toString() === userId.toString() && reaction.emoji === emoji)
    );
  } else {
    // Remove all reactions from this user
    this.reactions = this.reactions.filter(
      reaction => reaction.user.toString() !== userId.toString()
    );
  }
  
  return this.save();
};

// Method to mark as read by user
messageSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(
    read => read.user.toString() === userId.toString()
  );
  
  if (!existingRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Method to edit message
messageSchema.methods.editContent = function(newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

// Method to soft delete message
messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.content = '[Message deleted]';
  return this.save();
};

// Static method to find messages by chat room with pagination
messageSchema.statics.findByChatRoom = function(chatRoomId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  
  return this.find({ 
    chatRoom: chatRoomId, 
    isDeleted: false 
  })
  .populate('sender', 'username firstName lastName avatar isOnline')
  .populate('replyTo', 'content sender')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Static method to find travel requests
messageSchema.statics.findTravelRequests = function(filters = {}) {
  const query = {
    type: 'travel_request',
    isDeleted: false,
    ...filters
  };
  
  return this.find(query)
  .populate('sender', 'username firstName lastName avatar')
  .populate('chatRoom', 'name type')
  .sort({ createdAt: -1 });
};

export default mongoose.model('Message', messageSchema);
