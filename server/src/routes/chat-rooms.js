const express = require('express');
const router = express.Router();
const ChatRoom = require('../models/ChatRoom');
const { auth } = require('../middleware/auth');
const { validateRoom } = require('../middleware/validation');

// Create a new chat room
router.post('/', auth, validateRoom, async (req, res) => {
  try {
    console.log('Creating new chat room with user:', req.user);
    const { name, description, type, destination } = req.body;
    console.log('Room data:', { name, description, type, destination });

    // Check if user has permission to create this type of room
    if (type === 'private') {
      const canCreate = await req.user.canAccessPrivateChat();
      if (!canCreate) {
        return res.status(403).json({
          success: false,
          message: 'You need a subscription to create private rooms'
        });
      }
    }

    const roomData = {
      name,
      description,
      type,
      destination,
      createdBy: req.user._id,
      members: [{
        user: req.user._id,
        role: 'admin'
      }]
    };
    console.log('Creating room with data:', roomData);

    const room = new ChatRoom(roomData);
    console.log('Room model instance created');

    await room.save();
    console.log('Room saved successfully');

    // Populate creator and member info
    await room.populate('createdBy', 'username firstName lastName avatar');
    await room.populate('members.user', 'username firstName lastName avatar');

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      data: { room }
    });
  } catch (error) {
    console.error('Create room error:', error);
    // Send more specific error messages
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map(err => err.message).join(', ')
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A room with this name already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create chat room. Please try again later.'
    });
  }
});

// Get all public rooms
router.get('/public', auth, async (req, res) => {
  try {
    const rooms = await ChatRoom.findPublicRooms();
    res.json({
      success: true,
      data: { rooms }
    });
  } catch (error) {
    console.error('Get public rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch public rooms'
    });
  }
});

// Get user's rooms
router.get('/my', auth, async (req, res) => {
  try {
    const rooms = await ChatRoom.findUserRooms(req.user._id);
    res.json({
      success: true,
      data: { rooms }
    });
  } catch (error) {
    console.error('Get user rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user rooms'
    });
  }
});

// Get room by ID
router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId)
      .populate('creator', 'username firstName lastName avatar')
      .populate('members', 'username firstName lastName avatar')
      .populate('moderators', 'username firstName lastName avatar');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is banned
    if (room.bannedUsers.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are banned from this room'
      });
    }

    res.json({
      success: true,
      data: { room }
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room details'
    });
  }
});

// Update room
router.patch('/:roomId', auth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check permissions
    if (!room.creator.equals(req.user._id) && !room.moderators.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this room'
      });
    }

    const allowedUpdates = ['name', 'description', 'type', 'destination'];
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    Object.assign(room, updates);
    await room.save();

    res.json({
      success: true,
      message: 'Room updated successfully',
      data: { room }
    });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update room'
    });
  }
});

// Join room
router.post('/:roomId/join', auth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is banned
    if (room.bannedUsers.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are banned from this room'
      });
    }

    // Check if room is private
    if (room.type === 'private') {
      return res.status(403).json({
        success: false,
        message: 'This is a private room. You need an invitation to join.'
      });
    }

    await room.addMember(req.user._id);

    res.json({
      success: true,
      message: 'Joined room successfully',
      data: { room }
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join room'
    });
  }
});

// Leave room
router.post('/:roomId/leave', auth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Creator can't leave their own room
    if (room.creator.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'Room creator cannot leave the room'
      });
    }

    await room.removeMember(req.user._id);
    await room.removeModerator(req.user._id);

    res.json({
      success: true,
      message: 'Left room successfully'
    });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave room'
    });
  }
});

module.exports = router;