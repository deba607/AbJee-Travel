import express from 'express';
import { body, validationResult } from 'express-validator';
import userService from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }),
  body('bio').optional().trim().isLength({ max: 500 }),
  body('travelInterests').optional().isArray(),
  body('preferredDestinations').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const allowedUpdates = [
      'firstName', 'lastName', 'bio', 'travelInterests', 
      'preferredDestinations', 'address', 'city', 'zipCode'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// @route   GET /api/users/search
// @desc    Search users for travel partners
// @access  Private
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q, interests, destination, page = 1, limit = 20 } = req.query;

    let query = { 
      isActive: true,
      _id: { $ne: req.user._id } // Exclude current user
    };

    if (q) {
      query.$or = [
        { username: new RegExp(q, 'i') },
        { firstName: new RegExp(q, 'i') },
        { lastName: new RegExp(q, 'i') }
      ];
    }

    if (interests) {
      const interestArray = interests.split(',').map(i => i.trim());
      query.travelInterests = { $in: interestArray };
    }

    if (destination) {
      query.preferredDestinations = new RegExp(destination, 'i');
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select('username firstName lastName avatar bio travelInterests preferredDestinations isOnline lastSeen')
      .sort({ isOnline: -1, lastSeen: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users'
    });
  }
});

export default router;
