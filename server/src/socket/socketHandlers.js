import ChatRoom from '../models/ChatRoom.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import TravelPartnerRequest from '../models/TravelPartnerRequest.js';
import { 
  validateSocketPermission, 
  checkSocketRateLimit, 
  canJoinRoom,
  handleSocketDisconnect 
} from '../middleware/socketAuth.js';

// Store active users and their socket connections
const activeUsers = new Map();
const userRooms = new Map(); // Track which rooms each user is in

export const handleSocketConnection = (socket, io) => {
  const userId = socket.user._id.toString();
  
  // Store user connection
  activeUsers.set(userId, {
    socketId: socket.id,
    user: socket.user,
    joinedAt: new Date()
  });
  
  // Initialize user rooms tracking
  if (!userRooms.has(userId)) {
    userRooms.set(userId, new Set());
  }
  
  console.log(`User ${socket.user.username} connected with socket ${socket.id}`);
  
  // Emit user online status to all rooms they're in
  broadcastUserStatus(socket, io, 'online');
  
  // Handle joining a chat room
  socket.on('join_room', async (data) => {
    try {
      const validation = validateSocketPermission(socket, 'join_room', data);
      if (!validation.success) {
        return socket.emit('error', validation);
      }
      
      const rateLimit = checkSocketRateLimit(socket, 'join_room', 10, 60000);
      if (!rateLimit.success) {
        return socket.emit('error', rateLimit);
      }
      
      const { roomId } = data;
      
      // Get room details
      const room = await ChatRoom.findById(roomId);
      if (!room || !room.isActive) {
        return socket.emit('error', { 
          success: false, 
          message: 'Room not found or inactive' 
        });
      }
      
      // Check if user can access this room
      const accessCheck = await canJoinRoom(socket, roomId, room.type);
      if (!accessCheck.success) {
        return socket.emit('error', accessCheck);
      }
      
      // Add user to room if not already a member
      if (!room.isMember(userId)) {
        await room.addMember(userId);
      }
      
      // Join socket room
      socket.join(roomId);
      userRooms.get(userId).add(roomId);
      
      // Get recent messages
      const messages = await Message.findByChatRoom(roomId, 1, 50);
      
      // Get online members
      const onlineMembers = await getOnlineRoomMembers(room);
      
      socket.emit('room_joined', {
        success: true,
        room: {
          id: room._id,
          name: room.name,
          type: room.type,
          description: room.description,
          memberCount: room.memberCount,
          onlineMembers
        },
        messages: messages.reverse() // Reverse to show oldest first
      });
      
      // Notify other room members
      socket.to(roomId).emit('user_joined_room', {
        user: {
          id: socket.user._id,
          username: socket.user.username,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          avatar: socket.user.avatar
        },
        room: { id: roomId, name: room.name }
      });
      
      console.log(`User ${socket.user.username} joined room ${room.name}`);
      
    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { 
        success: false, 
        message: 'Failed to join room' 
      });
    }
  });
  
  // Handle leaving a chat room
  socket.on('leave_room', async (data) => {
    try {
      const validation = validateSocketPermission(socket, 'leave_room', data);
      if (!validation.success) {
        return socket.emit('error', validation);
      }
      
      const { roomId } = data;
      
      // Leave socket room
      socket.leave(roomId);
      userRooms.get(userId).delete(roomId);
      
      // Update last read timestamp
      const room = await ChatRoom.findById(roomId);
      if (room) {
        await room.updateMemberLastRead(userId);
        
        // Notify other room members
        socket.to(roomId).emit('user_left_room', {
          user: {
            id: socket.user._id,
            username: socket.user.username
          },
          room: { id: roomId, name: room.name }
        });
      }
      
      socket.emit('room_left', { success: true, roomId });
      
    } catch (error) {
      console.error('Leave room error:', error);
      socket.emit('error', { 
        success: false, 
        message: 'Failed to leave room' 
      });
    }
  });
  
  // Handle sending a message
  socket.on('send_message', async (data) => {
    try {
      const validation = validateSocketPermission(socket, 'send_message', data);
      if (!validation.success) {
        return socket.emit('error', validation);
      }
      
      const rateLimit = checkSocketRateLimit(socket, 'send_message', 30, 60000);
      if (!rateLimit.success) {
        return socket.emit('error', rateLimit);
      }
      
      const { roomId, content, type = 'text', replyTo } = data;
      
      // Verify user is in the room
      if (!userRooms.get(userId).has(roomId)) {
        return socket.emit('error', { 
          success: false, 
          message: 'You must join the room first' 
        });
      }
      
      // Create message
      const message = new Message({
        content: content.trim(),
        type,
        sender: userId,
        chatRoom: roomId,
        replyTo: replyTo || undefined
      });
      
      await message.save();
      
      // Populate sender info
      await message.populate('sender', 'username firstName lastName avatar isOnline');
      if (replyTo) {
        await message.populate('replyTo', 'content sender');
      }
      
      // Update room's last activity and message count
      await ChatRoom.findByIdAndUpdate(roomId, {
        lastActivity: new Date(),
        lastMessage: message._id,
        $inc: { messageCount: 1 }
      });
      
      // Emit message to all room members
      io.to(roomId).emit('new_message', {
        id: message._id,
        content: message.content,
        type: message.type,
        sender: message.sender,
        chatRoom: roomId,
        replyTo: message.replyTo,
        createdAt: message.createdAt,
        reactions: message.reactions
      });
      
      console.log(`Message sent by ${socket.user.username} in room ${roomId}`);
      
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { 
        success: false, 
        message: 'Failed to send message' 
      });
    }
  });
  
  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const validation = validateSocketPermission(socket, 'typing_start', data);
    if (!validation.success) return;
    
    const { roomId } = data;
    if (userRooms.get(userId).has(roomId)) {
      socket.to(roomId).emit('user_typing', {
        user: {
          id: socket.user._id,
          username: socket.user.username
        },
        roomId
      });
    }
  });
  
  socket.on('typing_stop', (data) => {
    const validation = validateSocketPermission(socket, 'typing_stop', data);
    if (!validation.success) return;
    
    const { roomId } = data;
    if (userRooms.get(userId).has(roomId)) {
      socket.to(roomId).emit('user_stopped_typing', {
        user: {
          id: socket.user._id,
          username: socket.user.username
        },
        roomId
      });
    }
  });
  
  // Handle message reactions
  socket.on('add_reaction', async (data) => {
    try {
      const { messageId, emoji } = data;
      
      const message = await Message.findById(messageId);
      if (!message) {
        return socket.emit('error', { 
          success: false, 
          message: 'Message not found' 
        });
      }
      
      // Check if user is in the room
      if (!userRooms.get(userId).has(message.chatRoom.toString())) {
        return socket.emit('error', { 
          success: false, 
          message: 'Access denied' 
        });
      }
      
      await message.addReaction(userId, emoji);
      
      // Emit reaction update to room
      io.to(message.chatRoom.toString()).emit('reaction_added', {
        messageId,
        emoji,
        user: {
          id: socket.user._id,
          username: socket.user.username
        }
      });
      
    } catch (error) {
      console.error('Add reaction error:', error);
      socket.emit('error', { 
        success: false, 
        message: 'Failed to add reaction' 
      });
    }
  });
  
  // Handle getting room list
  socket.on('get_rooms', async (data) => {
    try {
      const { type = 'public', page = 1, limit = 20 } = data;
      
      let query = { isActive: true };
      
      if (type === 'public') {
        query.type = 'public';
      } else if (type === 'private' && socket.user.canAccessPrivateChat()) {
        query.type = 'private';
      } else if (type === 'travel_partner') {
        query.type = 'travel_partner';
      }
      
      const rooms = await ChatRoom.find(query)
        .populate('lastMessage', 'content createdAt')
        .sort({ lastActivity: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      const roomsWithOnlineCount = await Promise.all(
        rooms.map(async (room) => ({
          id: room._id,
          name: room.name,
          description: room.description,
          type: room.type,
          memberCount: room.memberCount,
          onlineCount: await getOnlineRoomMemberCount(room),
          lastMessage: room.lastMessage,
          lastActivity: room.lastActivity,
          avatar: room.avatar,
          destination: room.destination
        }))
      );
      
      socket.emit('rooms_list', {
        success: true,
        rooms: roomsWithOnlineCount,
        pagination: {
          page,
          limit,
          hasMore: rooms.length === limit
        }
      });
      
    } catch (error) {
      console.error('Get rooms error:', error);
      socket.emit('error', { 
        success: false, 
        message: 'Failed to get rooms' 
      });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`User ${socket.user.username} disconnected`);
    
    // Clean up user data
    activeUsers.delete(userId);
    userRooms.delete(userId);
    
    // Handle database cleanup
    await handleSocketDisconnect(socket);
    
    // Broadcast user offline status
    broadcastUserStatus(socket, io, 'offline');
  });
};

// Helper function to broadcast user status
const broadcastUserStatus = (socket, io, status) => {
  const userId = socket.user._id.toString();
  const rooms = userRooms.get(userId);
  
  if (rooms) {
    rooms.forEach(roomId => {
      socket.to(roomId).emit('user_status_change', {
        user: {
          id: socket.user._id,
          username: socket.user.username
        },
        status,
        timestamp: new Date()
      });
    });
  }
};

// Helper function to get online room members
const getOnlineRoomMembers = async (room) => {
  const onlineMembers = [];
  
  for (const member of room.members) {
    if (activeUsers.has(member.user.toString())) {
      const user = await User.findById(member.user).select('username firstName lastName avatar');
      if (user) {
        onlineMembers.push({
          id: user._id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          role: member.role
        });
      }
    }
  }
  
  return onlineMembers;
};

// Helper function to get online member count
const getOnlineRoomMemberCount = async (room) => {
  let count = 0;
  for (const member of room.members) {
    if (activeUsers.has(member.user.toString())) {
      count++;
    }
  }
  return count;
};
