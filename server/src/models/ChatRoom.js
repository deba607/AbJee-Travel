import mongoose from 'mongoose';

const chatRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Chat room name is required'],
    trim: true,
    maxlength: [100, 'Chat room name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  type: {
    type: String,
    enum: ['public', 'private', 'travel_partner'],
    required: true,
    default: 'public'
  },
  
  // For travel destination-based rooms
  destination: {
    country: String,
    city: String,
    region: String
  },
  
  // Room settings
  isActive: {
    type: Boolean,
    default: true
  },
  maxMembers: {
    type: Number,
    default: 1000 // For public rooms
  },
  
  // Members and permissions
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'admin'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastReadAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Room creator/owner
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // For private rooms (subscription required)
  subscriptionRequired: {
    type: Boolean,
    default: false
  },
  
  // Room statistics
  messageCount: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Room image/avatar
  avatar: {
    type: String,
    default: null
  },
  
  // Tags for better discovery
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Room rules or guidelines
  rules: [{
    type: String,
    maxlength: [200, 'Rule cannot exceed 200 characters']
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
chatRoomSchema.index({ type: 1, isActive: 1 });
chatRoomSchema.index({ 'destination.country': 1 });
chatRoomSchema.index({ 'destination.city': 1 });
chatRoomSchema.index({ tags: 1 });
chatRoomSchema.index({ createdBy: 1 });
chatRoomSchema.index({ 'members.user': 1 });
chatRoomSchema.index({ lastActivity: -1 });

// Virtual for member count
chatRoomSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for online members count (would need to be populated with user data)
chatRoomSchema.virtual('onlineMemberCount').get(function() {
  return this.members.filter(member => 
    member.user && member.user.isOnline
  ).length;
});

// Method to add member to room
chatRoomSchema.methods.addMember = function(userId, role = 'member') {
  const existingMember = this.members.find(
    member => member.user.toString() === userId.toString()
  );
  
  if (existingMember) {
    return false; // Member already exists
  }
  
  if (this.members.length >= this.maxMembers) {
    throw new Error('Chat room is full');
  }
  
  this.members.push({
    user: userId,
    role: role,
    joinedAt: new Date(),
    lastReadAt: new Date()
  });
  
  return this.save();
};

// Method to remove member from room
chatRoomSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(
    member => member.user.toString() !== userId.toString()
  );
  return this.save();
};

// Method to update member's last read timestamp
chatRoomSchema.methods.updateMemberLastRead = function(userId) {
  const member = this.members.find(
    member => member.user.toString() === userId.toString()
  );
  
  if (member) {
    member.lastReadAt = new Date();
    return this.save();
  }
  
  return false;
};

// Method to check if user is member
chatRoomSchema.methods.isMember = function(userId) {
  return this.members.some(
    member => member.user.toString() === userId.toString()
  );
};

// Method to get member role
chatRoomSchema.methods.getMemberRole = function(userId) {
  const member = this.members.find(
    member => member.user.toString() === userId.toString()
  );
  return member ? member.role : null;
};

// Method to check if user can access room
chatRoomSchema.methods.canUserAccess = function(user) {
  // Public rooms are accessible to all
  if (this.type === 'public') {
    return true;
  }
  
  // Private rooms require subscription
  if (this.type === 'private' && this.subscriptionRequired) {
    return user.canAccessPrivateChat();
  }
  
  // Travel partner rooms are accessible to all but limited
  if (this.type === 'travel_partner') {
    return true;
  }
  
  return false;
};

// Static method to find public rooms by destination
chatRoomSchema.statics.findByDestination = function(country, city = null) {
  const query = {
    type: 'public',
    isActive: true,
    'destination.country': new RegExp(country, 'i')
  };
  
  if (city) {
    query['destination.city'] = new RegExp(city, 'i');
  }
  
  return this.find(query).sort({ lastActivity: -1 });
};

// Static method to find popular rooms
chatRoomSchema.statics.findPopular = function(limit = 10) {
  return this.find({ 
    type: 'public', 
    isActive: true 
  })
  .sort({ memberCount: -1, lastActivity: -1 })
  .limit(limit);
};

export default mongoose.model('ChatRoom', chatRoomSchema);
