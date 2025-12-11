import express from 'express';
import { authenticate } from '../middleware/auth.js';
import userService from '../models/User.js';

const router = express.Router();

// @route   GET /api/auth/me
// @desc    Get current user profile (Firebase)
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // req.user is already populated by middleware with Firebase user data
    const user = { ...req.user };

    return res.json({ success: true, data: { user } });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user profile' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (mark offline)
// @access  Private
router.post('/logout', authenticate, async (req, res) => {
  try {
    if (req.user && req.user.id) {
      await userService.updateStatus(req.user.id, false);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

export default router;