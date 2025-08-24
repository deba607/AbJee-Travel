import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Subscription plan details
  plan: {
    type: {
      type: String,
      enum: ['free', 'pro', 'premium'],
      required: true,
      default: 'free'
    },
    name: {
      type: String,
      required: true
    },
    price: {
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'INR']
      },
      interval: {
        type: String,
        enum: ['monthly', 'yearly'],
        required: function() {
          return this.plan.type !== 'free';
        }
      }
    }
  },
  
  // Subscription status
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'expired', 'past_due', 'trialing'],
    default: 'active'
  },
  
  // Subscription dates
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: function() {
      return this.plan.type !== 'free';
    }
  },
  trialEndDate: {
    type: Date
  },
  
  // Payment information
  paymentMethod: {
    type: {
      type: String,
      enum: ['card', 'paypal', 'bank_transfer', 'free'],
      default: 'free'
    },
    last4: String, // Last 4 digits of card
    brand: String, // Visa, Mastercard, etc.
    expiryMonth: Number,
    expiryYear: Number
  },
  
  // External payment provider data
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  paypalSubscriptionId: String,
  
  // Billing information
  billingHistory: [{
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'failed', 'refunded'],
      required: true
    },
    invoiceId: String,
    paymentDate: {
      type: Date,
      default: Date.now
    },
    description: String,
    failureReason: String
  }],
  
  // Next billing date
  nextBillingDate: {
    type: Date
  },
  
  // Subscription features and limits
  features: {
    privateChatAccess: {
      type: Boolean,
      default: false
    },
    maxPrivateChats: {
      type: Number,
      default: 0
    },
    travelPartnerRequests: {
      type: Number,
      default: 1 // Free users get 1 active request
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    advancedFilters: {
      type: Boolean,
      default: false
    },
    profileBoost: {
      type: Boolean,
      default: false
    },
    fileUploadLimit: {
      type: Number,
      default: 5 // MB
    },
    customDestinations: {
      type: Boolean,
      default: false
    }
  },
  
  // Usage tracking
  usage: {
    privateChatsUsed: {
      type: Number,
      default: 0
    },
    travelRequestsUsed: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },
  
  // Cancellation information
  cancellation: {
    cancelledAt: Date,
    reason: String,
    feedback: String,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    }
  },
  
  // Auto-renewal settings
  autoRenew: {
    type: Boolean,
    default: true
  },
  
  // Promotional codes
  promoCode: {
    code: String,
    discount: {
      type: Number,
      min: 0,
      max: 100
    },
    appliedAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
subscriptionSchema.index({ user: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endDate: 1 });
subscriptionSchema.index({ nextBillingDate: 1 });
subscriptionSchema.index({ 'plan.type': 1 });

// Virtual for days remaining
subscriptionSchema.virtual('daysRemaining').get(function() {
  if (this.endDate && this.status === 'active') {
    const diffTime = this.endDate - new Date();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for is active
subscriptionSchema.virtual('isActive').get(function() {
  return this.status === 'active' && 
         (!this.endDate || this.endDate > new Date());
});

// Virtual for is trial
subscriptionSchema.virtual('isTrial').get(function() {
  return this.status === 'trialing' && 
         this.trialEndDate && 
         this.trialEndDate > new Date();
});

// Method to check if user can access feature
subscriptionSchema.methods.canAccessFeature = function(featureName) {
  if (!this.isActive && !this.isTrial) {
    return false;
  }
  
  return this.features[featureName] || false;
};

// Method to check usage limits
subscriptionSchema.methods.canUseFeature = function(featureName) {
  if (!this.canAccessFeature(featureName)) {
    return false;
  }
  
  switch (featureName) {
    case 'privateChatAccess':
      return this.usage.privateChatsUsed < this.features.maxPrivateChats;
    case 'travelPartnerRequests':
      return this.usage.travelRequestsUsed < this.features.travelPartnerRequests;
    default:
      return true;
  }
};

// Method to increment usage
subscriptionSchema.methods.incrementUsage = function(featureName) {
  switch (featureName) {
    case 'privateChats':
      this.usage.privateChatsUsed += 1;
      break;
    case 'travelRequests':
      this.usage.travelRequestsUsed += 1;
      break;
  }
  return this.save();
};

// Method to reset monthly usage
subscriptionSchema.methods.resetMonthlyUsage = function() {
  this.usage.privateChatsUsed = 0;
  this.usage.travelRequestsUsed = 0;
  this.usage.lastResetDate = new Date();
  return this.save();
};

// Method to upgrade subscription
subscriptionSchema.methods.upgrade = function(newPlan, endDate) {
  this.plan = newPlan;
  this.endDate = endDate;
  this.status = 'active';
  
  // Update features based on plan
  this.updateFeatures();
  
  return this.save();
};

// Method to cancel subscription
subscriptionSchema.methods.cancel = function(reason, cancelAtPeriodEnd = true) {
  this.cancellation = {
    cancelledAt: new Date(),
    reason: reason,
    cancelAtPeriodEnd: cancelAtPeriodEnd
  };
  
  if (!cancelAtPeriodEnd) {
    this.status = 'cancelled';
    this.endDate = new Date();
  }
  
  this.autoRenew = false;
  return this.save();
};

// Method to add billing record
subscriptionSchema.methods.addBillingRecord = function(billingData) {
  this.billingHistory.push({
    amount: billingData.amount,
    currency: billingData.currency || 'USD',
    status: billingData.status,
    invoiceId: billingData.invoiceId,
    paymentDate: billingData.paymentDate || new Date(),
    description: billingData.description,
    failureReason: billingData.failureReason
  });
  
  return this.save();
};

// Method to update features based on plan type
subscriptionSchema.methods.updateFeatures = function() {
  switch (this.plan.type) {
    case 'free':
      this.features = {
        privateChatAccess: false,
        maxPrivateChats: 0,
        travelPartnerRequests: 1,
        prioritySupport: false,
        advancedFilters: false,
        profileBoost: false,
        fileUploadLimit: 5,
        customDestinations: false
      };
      break;
    case 'pro':
      this.features = {
        privateChatAccess: true,
        maxPrivateChats: 10,
        travelPartnerRequests: 5,
        prioritySupport: true,
        advancedFilters: true,
        profileBoost: false,
        fileUploadLimit: 25,
        customDestinations: true
      };
      break;
    case 'premium':
      this.features = {
        privateChatAccess: true,
        maxPrivateChats: -1, // Unlimited
        travelPartnerRequests: -1, // Unlimited
        prioritySupport: true,
        advancedFilters: true,
        profileBoost: true,
        fileUploadLimit: 100,
        customDestinations: true
      };
      break;
  }
};

// Static method to find expiring subscriptions
subscriptionSchema.statics.findExpiring = function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'active',
    endDate: {
      $gte: new Date(),
      $lte: futureDate
    }
  }).populate('user', 'email firstName lastName');
};

// Static method to find subscriptions due for billing
subscriptionSchema.statics.findDueForBilling = function() {
  return this.find({
    status: 'active',
    autoRenew: true,
    nextBillingDate: {
      $lte: new Date()
    }
  }).populate('user', 'email firstName lastName');
};

// Pre-save middleware to set features
subscriptionSchema.pre('save', function(next) {
  if (this.isModified('plan.type')) {
    this.updateFeatures();
  }
  next();
});

export default mongoose.model('Subscription', subscriptionSchema);
