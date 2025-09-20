import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Basic Information (from existing registration form)
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // Address Information
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  zipCode: {
    type: String,
    required: [true, 'Zip code is required'],
    trim: true
  },
  
  // Profile Information
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  phone: String,
  profileImage: String,
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  
  // Travel Preferences
  travelInterests: [{
    type: String,
    enum: ['adventure', 'culture', 'food', 'nature', 'history', 'photography', 'backpacking', 'luxury', 'budget', 'solo', 'group']
  }],
  preferredDestinations: [String],
  
  // Subscription Information
  subscription: {
    type: {
      type: String,
      enum: ['free', 'pro', 'premium'],
      default: 'free'
    },
    startDate: Date,
    endDate: Date,
    isActive: {
      type: Boolean,
      default: false
    }
  },
  
  // Chat & Community
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  joinedChatRooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom'
  }],
  
  // Account Status
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Preferences
  preferences: {
    notifications: { 
      type: Boolean, 
      default: true 
    },
    theme: { 
      type: String, 
      enum: ['light', 'dark'], 
      default: 'light' 
    }
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ isOnline: 1 });
userSchema.index({ 'subscription.type': 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user has active subscription
userSchema.methods.hasActiveSubscription = function() {
  return this.subscription.isActive && 
         this.subscription.endDate && 
         this.subscription.endDate > new Date();
};

// Method to check if user can access private chat
userSchema.methods.canAccessPrivateChat = function() {
  return this.hasActiveSubscription() && 
         ['pro', 'premium'].includes(this.subscription.type);
};

// Method to update last seen
userSchema.methods.updateLastSeen = async function() {
  this.lastSeen = new Date();
  return this.save({ validateBeforeSave: false });
};

// Static method to find by credentials (email/username and password)
userSchema.statics.findByCredentials = async function(emailOrUsername, password) {
  const user = await this.findOne({
    $or: [
      { email: emailOrUsername.toLowerCase() },
      { username: emailOrUsername }
    ]
  }).select('+password');

  if (!user) {
    throw new Error('Unable to login');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Unable to login');
  }

  return user;
};

// Method to generate auth token
userSchema.methods.generateAuthToken = function() {
  const user = this;
  const token = jwt.sign(
    { _id: user._id.toString() }, 
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  return token;
};

const User = mongoose.model('User', userSchema);
export default User;