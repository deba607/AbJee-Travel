import express from 'express';
import { body, query, validationResult } from 'express-validator';
import chatRoomService from '../models/ChatRoom.js';
import messageService from '../models/Message.js';
import travelPartnerRequestService from '../models/TravelPartnerRequest.js';
import userService from '../models/User.js';
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

    const numericPage = parseInt(page);
    const numericLimit = parseInt(limit);
    const offset = (numericPage - 1) * numericLimit;

    // Access check for private rooms
    if (type === 'private' && !userService.canAccessPrivateChat(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Subscription required for private chat rooms',
        upgradeRequired: true
      });
    }

    let rooms = [];
    if (destination) {
      // Use destination as country keyword for simple search
      rooms = await chatRoomService.findByDestination(destination);
    } else {
      const targetType = type === 'travel_partner' ? 'travel_partner' : type;
      rooms = await chatRoomService.findByType(targetType, { limit: numericLimit, offset });
    }

    const mapped = rooms.map(room => ({
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      destination: room.destination,
      memberCount: chatRoomService.getMemberCount(room),
      messageCount: room.messageCount || 0,
      lastActivity: room.lastActivity,
      lastMessage: room.lastMessage || null,
      avatar: room.avatar || null,
      tags: room.tags || [],
      createdBy: room.createdBy || null,
      isMember: chatRoomService.isMember(room, req.user.id),
      canAccess: room.type !== 'private' || userService.canAccessPrivateChat(req.user)
    }));

    // Firestore doesn't provide cheap counts; estimate pagination
    const hasNext = mapped.length === numericLimit;

    res.json({
      success: true,
      data: {
        rooms: mapped,
        pagination: {
          page: numericPage,
          limit: numericLimit,
          total: null,
          pages: null,
          hasNext,
          hasPrev: numericPage > 1
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
    if (type === 'private' && !userService.canAccessPrivateChat(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Subscription required to create private chat rooms',
        upgradeRequired: true
      });
    }

    // Create room in Firestore
    const room = await chatRoomService.create({
      name,
      description,
      type,
      destination,
      tags: tags || [],
      maxMembers,
      createdBy: req.user.id,
      subscriptionRequired: type === 'private'
    });

    // Add creator as admin member
    await chatRoomService.addMember(room.id, req.user.id, 'admin');

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      data: {
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
          type: room.type,
          destination: room.destination,
          memberCount: chatRoomService.getMemberCount(room) + 1,
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

    const room = await chatRoomService.findById(roomId);

    if (!room || room.isActive === false) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const canAccess = room.type !== 'private' || userService.canAccessPrivateChat(req.user);
    if (!canAccess) {
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
          id: room.id,
          name: room.name,
          description: room.description,
          type: room.type,
          destination: room.destination,
          memberCount: chatRoomService.getMemberCount(room),
          maxMembers: room.maxMembers,
          messageCount: room.messageCount,
          lastActivity: room.lastActivity,
          avatar: room.avatar,
          tags: room.tags,
          rules: room.rules,
          createdBy: room.createdBy,
          createdAt: room.createdAt,
          members: (room.members || []).map(member => ({
            user: member.user,
            role: member.role,
            joinedAt: member.joinedAt
          })),
          isMember: chatRoomService.isMember(room, req.user.id),
          userRole: chatRoomService.getMemberRole(room, req.user.id)
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
    const room = await chatRoomService.findById(roomId);
    if (!room || room.isActive === false) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.type === 'private' && !userService.canAccessPrivateChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied to this room' });
    }

    // Check if user is a member
    if (!chatRoomService.isMember(room, req.user.id)) {
      return res.status(403).json({ success: false, message: 'You must be a member to view messages' });
    }

    const numericPage = parseInt(page);
    const numericLimit = parseInt(limit);

    const messages = await messageService.findByChatRoom(roomId, numericPage, numericLimit);

    // Update user's last read timestamp
    await chatRoomService.updateMemberLastRead(roomId, req.user.id);

    res.json({
      success: true,
      data: {
        messages: messages.reverse(),
        pagination: {
          page: numericPage,
          limit: numericLimit,
          total: null,
          pages: null,
          hasNext: messages.length === numericLimit,
          hasPrev: numericPage > 1
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

    const room = await chatRoomService.findById(roomId);
    if (!room || room.isActive === false) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.type === 'private' && !userService.canAccessPrivateChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied to this room', upgradeRequired: true });
    }

    if (chatRoomService.isMember(room, req.user.id)) {
      return res.status(400).json({ success: false, message: 'You are already a member of this room' });
    }

    await chatRoomService.addMember(roomId, req.user.id, 'member');

    res.json({
      success: true,
      message: 'Successfully joined the room',
      data: {
        room: {
          id: room.id,
          name: room.name,
          type: room.type,
          memberCount: chatRoomService.getMemberCount(room) + 1
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

    const room = await chatRoomService.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (!chatRoomService.isMember(room, req.user.id)) {
      return res.status(400).json({ success: false, message: 'You are not a member of this room' });
    }

    await chatRoomService.removeMember(roomId, req.user.id);

    res.json({ success: true, message: 'Successfully left the room' });

  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave room'
    });
  }
});

export default router;
