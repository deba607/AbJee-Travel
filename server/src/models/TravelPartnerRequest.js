import mongoose from 'mongoose';

const travelPartnerRequestSchema = new mongoose.Schema({
  // Request creator
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Travel details
  destination: {
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    region: {
      type: String,
      trim: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Travel dates
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Start date must be in the future'
    }
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  
  // Budget information
  budget: {
    min: {
      type: Number,
      min: 0
    },
    max: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY']
    },
    isFlexible: {
      type: Boolean,
      default: true
    }
  },
  
  // Group preferences
  groupSize: {
    preferred: {
      type: Number,
      min: 1,
      max: 20,
      default: 2
    },
    maximum: {
      type: Number,
      min: 1,
      max: 20,
      default: 4
    }
  },
  
  // Travel preferences
  travelStyle: {
    type: String,
    enum: ['budget', 'mid-range', 'luxury', 'backpacking', 'adventure', 'relaxed', 'cultural', 'party'],
    required: true
  },
  
  accommodation: {
    type: [String],
    enum: ['hostel', 'hotel', 'airbnb', 'camping', 'guesthouse', 'resort'],
    default: ['hotel', 'airbnb']
  },
  
  transportation: {
    type: [String],
    enum: ['flight', 'train', 'bus', 'car', 'bike', 'walking', 'local_transport'],
    default: ['flight', 'local_transport']
  },
  
  // Interests and activities
  interests: [{
    type: String,
    enum: [
      'adventure', 'culture', 'food', 'nature', 'history', 'photography', 
      'nightlife', 'shopping', 'museums', 'beaches', 'mountains', 'cities',
      'festivals', 'sports', 'wellness', 'volunteering', 'learning'
    ]
  }],
  
  // Request details
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  // Partner requirements
  partnerRequirements: {
    ageRange: {
      min: {
        type: Number,
        min: 18,
        max: 100
      },
      max: {
        type: Number,
        min: 18,
        max: 100
      }
    },
    gender: {
      type: String,
      enum: ['any', 'male', 'female', 'non-binary'],
      default: 'any'
    },
    languages: [String],
    experience: {
      type: String,
      enum: ['any', 'beginner', 'intermediate', 'experienced'],
      default: 'any'
    }
  },
  
  // Request status
  status: {
    type: String,
    enum: ['active', 'matched', 'completed', 'cancelled', 'expired'],
    default: 'active'
  },
  
  // Responses and matches
  responses: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: {
      type: String,
      maxlength: [500, 'Response message cannot exceed 500 characters']
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    respondedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Matched partners
  matchedPartners: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Request settings
  isPublic: {
    type: Boolean,
    default: true
  },
  allowDirectContact: {
    type: Boolean,
    default: true
  },
  
  // Expiration
  expiresAt: {
    type: Date,
    default: function() {
      // Default expiration: 30 days from creation or start date, whichever is sooner
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      return this.startDate < thirtyDaysFromNow ? this.startDate : thirtyDaysFromNow;
    }
  },
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  responseCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
travelPartnerRequestSchema.index({ requester: 1, status: 1 });
travelPartnerRequestSchema.index({ 'destination.country': 1, status: 1 });
travelPartnerRequestSchema.index({ 'destination.city': 1, status: 1 });
travelPartnerRequestSchema.index({ startDate: 1, status: 1 });
travelPartnerRequestSchema.index({ travelStyle: 1, status: 1 });
travelPartnerRequestSchema.index({ interests: 1, status: 1 });
travelPartnerRequestSchema.index({ expiresAt: 1 });
travelPartnerRequestSchema.index({ createdAt: -1 });

// Virtual for duration in days
travelPartnerRequestSchema.virtual('durationDays').get(function() {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for days until trip
travelPartnerRequestSchema.virtual('daysUntilTrip').get(function() {
  if (this.startDate) {
    const diffTime = this.startDate - new Date();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Method to add response
travelPartnerRequestSchema.methods.addResponse = function(userId, message) {
  // Check if user already responded
  const existingResponse = this.responses.find(
    response => response.user.toString() === userId.toString()
  );
  
  if (existingResponse) {
    throw new Error('User has already responded to this request');
  }
  
  this.responses.push({
    user: userId,
    message: message,
    status: 'pending',
    respondedAt: new Date()
  });
  
  this.responseCount = this.responses.length;
  return this.save();
};

// Method to accept/reject response
travelPartnerRequestSchema.methods.updateResponseStatus = function(responseId, status) {
  const response = this.responses.id(responseId);
  if (!response) {
    throw new Error('Response not found');
  }
  
  response.status = status;
  
  // If accepted, add to matched partners
  if (status === 'accepted') {
    if (!this.matchedPartners.includes(response.user)) {
      this.matchedPartners.push(response.user);
    }
    
    // Check if we've reached the maximum group size
    if (this.matchedPartners.length >= this.groupSize.maximum) {
      this.status = 'matched';
    }
  }
  
  return this.save();
};

// Method to increment views
travelPartnerRequestSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to check if request is expired
travelPartnerRequestSchema.methods.isExpired = function() {
  return this.expiresAt < new Date() || this.startDate < new Date();
};

// Static method to find matching requests
travelPartnerRequestSchema.statics.findMatching = function(criteria) {
  const query = {
    status: 'active',
    isPublic: true,
    expiresAt: { $gt: new Date() },
    startDate: { $gt: new Date() }
  };
  
  if (criteria.destination) {
    if (criteria.destination.country) {
      query['destination.country'] = new RegExp(criteria.destination.country, 'i');
    }
    if (criteria.destination.city) {
      query['destination.city'] = new RegExp(criteria.destination.city, 'i');
    }
  }
  
  if (criteria.dateRange) {
    query.startDate = { 
      $gte: criteria.dateRange.start,
      $lte: criteria.dateRange.end
    };
  }
  
  if (criteria.travelStyle) {
    query.travelStyle = criteria.travelStyle;
  }
  
  if (criteria.interests && criteria.interests.length > 0) {
    query.interests = { $in: criteria.interests };
  }
  
  return this.find(query)
    .populate('requester', 'username firstName lastName avatar')
    .sort({ createdAt: -1 });
};

// Static method to clean up expired requests
travelPartnerRequestSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    {
      status: 'active',
      $or: [
        { expiresAt: { $lt: new Date() } },
        { startDate: { $lt: new Date() } }
      ]
    },
    { status: 'expired' }
  );
};

export default mongoose.model('TravelPartnerRequest', travelPartnerRequestSchema);
