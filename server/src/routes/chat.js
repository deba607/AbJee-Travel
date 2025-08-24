import express from 'express';
import { body, query, validationResult } from 'express-validator';
import ChatRoom from '../models/ChatRoom.js';
import Message from '../models/Message.js';
import TravelPartnerRequest from '../models/TravelPartnerRequest.js';
import { authenticate, requireSubscription } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/chat/rooms
// @desc    Get chat rooms with filters
// @access  Private
router.get('/rooms', authenticate, [
  query('type').optional().isIn(['public', 'private', 'travel_partner']),
  query('destination').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
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

    const { 
      type = 'public', 
      destination, 
      page = 1, 
      limit = 20 
    } = req.query;

    // Build query
    let query = { isActive: true };

    if (type === 'public') {
      query.type = 'public';
    } else if (type === 'private') {
      if (!req.user.canAccessPrivateChat()) {
        return res.status(403).json({
          success: false,
          message: 'Subscription required for private chat rooms',
          upgradeRequired: true
        });
      }
      query.type = 'private';
    } else if (type === 'travel_partner') {
      query.type = 'travel_partner';
    }

    if (destination) {
      query.$or = [
        { 'destination.country': new RegExp(destination, 'i') },
        { 'destination.city': new RegExp(destination, 'i') },
        { 'destination.region': new RegExp(destination, 'i') }
      ];
    }

    const skip = (page - 1) * limit;

    const rooms = await ChatRoom.find(query)
      .populate('createdBy', 'username firstName lastName avatar')
      .populate('lastMessage', 'content type createdAt')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username firstName lastName'
        }
      })
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ChatRoom.countDocuments(query);

    res.json({
      success: true,
      data: {
        rooms: rooms.map(room => ({
          id: room._id,
          name: room.name,
          description: room.description,
          type: room.type,
          destination: room.destination,
          memberCount: room.memberCount,
          messageCount: room.messageCount,
          lastActivity: room.lastActivity,
          lastMessage: room.lastMessage,
          avatar: room.avatar,
          tags: room.tags,
          createdBy: room.createdBy,
          isMember: room.isMember(req.user._id),
          canAccess: room.canUserAccess(req.user)
        })),
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
    console.error('Get rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chat rooms'
    });
  }
});

// @route   POST /api/chat/rooms
// @desc    Create a new chat room
// @access  Private
router.post('/rooms', authenticate, [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Room name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('type')
    .isIn(['public', 'private', 'travel_partner'])
    .withMessage('Invalid room type'),
  body('destination.country').optional().isString(),
  body('destination.city').optional().isString(),
  body('destination.region').optional().isString(),
  body('tags').optional().isArray(),
  body('maxMembers').optional().isInt({ min: 2, max: 1000 })
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

    const {
      name,
      description,
      type,
      destination,
      tags,
      maxMembers = 1000
    } = req.body;

    // Check if user can create private rooms
    if (type === 'private' && !req.user.canAccessPrivateChat()) {
      return res.status(403).json({
        success: false,
        message: 'Subscription required to create private chat rooms',
        upgradeRequired: true
      });
    }

    // Create room
    const room = new ChatRoom({
      name,
      description,
      type,
      destination,
      tags: tags || [],
      maxMembers,
      createdBy: req.user._id,
      subscriptionRequired: type === 'private'
    });

    // Add creator as admin member
    room.members.push({
      user: req.user._id,
      role: 'admin',
      joinedAt: new Date(),
      lastReadAt: new Date()
    });

    await room.save();

    // Populate creator info
    await room.populate('createdBy', 'username firstName lastName avatar');

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      data: {
        room: {
          id: room._id,
          name: room.name,
          description: room.description,
          type: room.type,
          destination: room.destination,
          memberCount: room.memberCount,
          maxMembers: room.maxMembers,
          tags: room.tags,
          createdBy: room.createdBy,
          createdAt: room.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chat room'
    });
  }
});

// @route   GET /api/chat/rooms/:roomId
// @desc    Get specific room details
// @access  Private
router.get('/rooms/:roomId', authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await ChatRoom.findById(roomId)
      .populate('createdBy', 'username firstName lastName avatar')
      .populate('members.user', 'username firstName lastName avatar isOnline lastSeen');

    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user can access this room
    if (!room.canUserAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this room',
        upgradeRequired: room.type === 'private'
      });
    }

    res.json({
      success: true,
      data: {
        room: {
          id: room._id,
          name: room.name,
          description: room.description,
          type: room.type,
          destination: room.destination,
          memberCount: room.memberCount,
          maxMembers: room.maxMembers,
          messageCount: room.messageCount,
          lastActivity: room.lastActivity,
          avatar: room.avatar,
          tags: room.tags,
          rules: room.rules,
          createdBy: room.createdBy,
          createdAt: room.createdAt,
          members: room.members.map(member => ({
            user: member.user,
            role: member.role,
            joinedAt: member.joinedAt
          })),
          isMember: room.isMember(req.user._id),
          userRole: room.getMemberRole(req.user._id)
        }
      }
    });

  } catch (error) {
    console.error('Get room details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get room details'
    });
  }
});

// @route   GET /api/chat/rooms/:roomId/messages
// @desc    Get messages from a specific room
// @access  Private
router.get('/rooms/:roomId/messages', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
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

    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check if room exists and user can access it
    const room = await ChatRoom.findById(roomId);
    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (!room.canUserAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this room'
      });
    }

    // Check if user is a member
    if (!room.isMember(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member to view messages'
      });
    }

    const messages = await Message.findByChatRoom(roomId, page, limit);
    const total = await Message.countDocuments({ 
      chatRoom: roomId, 
      isDeleted: false 
    });

    // Update user's last read timestamp
    await room.updateMemberLastRead(req.user._id);

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Show oldest first
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
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get messages'
    });
  }
});

// @route   POST /api/chat/rooms/:roomId/join
// @desc    Join a chat room
// @access  Private
router.post('/rooms/:roomId/join', authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await ChatRoom.findById(roomId);
    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user can access this room
    if (!room.canUserAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this room',
        upgradeRequired: room.type === 'private'
      });
    }

    // Check if already a member
    if (room.isMember(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this room'
      });
    }

    // Add user to room
    await room.addMember(req.user._id);

    res.json({
      success: true,
      message: 'Successfully joined the room',
      data: {
        room: {
          id: room._id,
          name: room.name,
          type: room.type,
          memberCount: room.memberCount + 1
        }
      }
    });

  } catch (error) {
    console.error('Join room error:', error);
    if (error.message === 'Chat room is full') {
      return res.status(400).json({
        success: false,
        message: 'Chat room is full'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to join room'
    });
  }
});

// @route   POST /api/chat/rooms/:roomId/leave
// @desc    Leave a chat room
// @access  Private
router.post('/rooms/:roomId/leave', authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is a member
    if (!room.isMember(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this room'
      });
    }

    // Remove user from room
    await room.removeMember(req.user._id);

    res.json({
      success: true,
      message: 'Successfully left the room'
    });

  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave room'
    });
  }
});

export default router;
