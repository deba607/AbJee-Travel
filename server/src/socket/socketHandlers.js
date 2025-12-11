import chatRoomService from '../models/ChatRoom.js';
import messageService from '../models/Message.js';
import userService from '../models/User.js';
import travelPartnerRequestService from '../models/TravelPartnerRequest.js';
import { 
  validateSocketPermission, 
  checkSocketRateLimit, 
  canJoinRoom,
  handleSocketDisconnect 
} from '../middleware/socketAuth.js';
import { setupModerationHandlers } from './messageModeration.js';

// Store active users and their socket connections
const activeUsers = new Map();
const userRooms = new Map(); // Track which rooms each user is in
const pingIntervals = new Map(); // Track ping intervals for each connection

// Helper function to convert Firestore Timestamp to ISO string
const convertTimestamp = (timestamp) => {
  if (!timestamp) return null;
  
  // Check if it's a Firestore Timestamp object
  if (timestamp._seconds !== undefined) {
    const milliseconds = timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000;
    return new Date(milliseconds).toISOString();
  }
  
  // Check if it's already a Date or ISO string
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  
  return null;
};

// Helper function to serialize message for sending to client
const serializeMessage = async (msg) => {
  if (!msg) return null;
  
  const serialized = {
    ...msg,
    createdAt: convertTimestamp(msg.createdAt),
    updatedAt: convertTimestamp(msg.updatedAt),
    editedAt: convertTimestamp(msg.editedAt),
    deletedAt: convertTimestamp(msg.deletedAt),
    moderatedAt: convertTimestamp(msg.moderatedAt),
  };
  
  // Populate sender if it's just an ID
  if (serialized.sender && typeof serialized.sender === 'string') {
    try {
      const senderUser = await userService.findById(serialized.sender);
      if (senderUser) {
        serialized.sender = {
          id: senderUser.id,
          username: senderUser.username,
          firstName: senderUser.firstName,
          lastName: senderUser.lastName,
          avatar: senderUser.avatar,
          isOnline: activeUsers.has(senderUser.id)
        };
      }
    } catch (err) {
      console.error('Error populating sender:', err);
    }
  }
  
  return serialized;
};

// Helper function to broadcast user status
const broadcastUserStatus = (socket, io, status) => {
  const userId = socket.user.id;
  const rooms = userRooms.get(userId);
  
  if (rooms) {
    rooms.forEach(roomId => {
      socket.to(roomId).emit('user_status_change', {
        user: {
          id: socket.user.id,
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
  if (!room?.members) return [];
  const onlineMembers = [];
  
  for (const member of room.members) {
    if (activeUsers.has(String(member.user))) {
      const user = await userService.findById(member.user);
      if (user) {
        onlineMembers.push({
          id: user.id,
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
  if (!room?.members) return 0;
  let count = 0;
  for (const member of room.members) {
    if (activeUsers.has(String(member.user))) {
      count++;
    }
  }
  return count;
};

// Helper function to clean up user connection
const cleanupUserConnection = async (socket, userId, io) => {
  // Clear ping interval
  if (pingIntervals.has(userId)) {
    clearInterval(pingIntervals.get(userId));
    pingIntervals.delete(userId);
  }

  // Update user connection state
  const userConnection = activeUsers.get(userId);
  if (userConnection) {
    userConnection.connectionState = 'disconnected';
  }

  // Clean up user data
  activeUsers.delete(userId);
  userRooms.delete(userId);
  
  // Handle database cleanup
  await handleSocketDisconnect(socket);
  
  // Broadcast user offline status
  broadcastUserStatus(socket, io, 'offline');

  console.log(`User ${socket.user?.username || userId} disconnected`);
};

// Sets up socket event handlers for a user
const setupSocketHandlers = (socket, io, userId) => {
  // Handle joining a chat room
  socket.on('join_room', async (data, ack) => {
  const errorResponse = (message, code = 'ROOM_ERROR') => {
    const err = { success: false, message, code };
    if (typeof ack === 'function') return ack(err);
    return socket.emit('error', err);
  };

  try {
    // 1. Handle reconnection case
    if (socket.recovered) {
      console.log(`User ${socket.user?.username} is reconnecting to room...`);
      const room = await chatRoomService.findById(data.roomId);
      if (!room) {
        return errorResponse('Room not found', 'NOT_FOUND');
      }
      
      // Rejoin room without duplicate checks
      await socket.join(data.roomId);
      userRooms.get(socket.user.id)?.add(data.roomId);
      
      const [messages, onlineMembers] = await Promise.all([
        messageService.findByChatRoom(data.roomId, 1, 50),
        getOnlineRoomMembers(room)
      ]);

      return ack?.({
        success: true,
        reconnected: true,
        room: {
          id: room.id,
          name: room.name,
          type: room.type,
          description: room.description,
          memberCount: chatRoomService.getMemberCount(room),
          onlineMembers
        },
        messages: messages.reverse()
      });
    }

    // 2. New connection handling
    if (!socket.connected) {
      return errorResponse('Socket not connected', 'SOCKET_ERROR');
    }

    if (!socket.user?.id) {
      return errorResponse('User session invalid', 'AUTH_ERROR');
    }

    const validation = validateSocketPermission(socket, 'join_room', data);
    if (!validation.success) {
      return errorResponse(validation.message, 'PERMISSION_ERROR');
    }
    
    // 3. Rate limiting with better error handling
    try {
      const rateLimit = checkSocketRateLimit(socket, 'join_room', 10, 60000);
      if (!rateLimit.success) {
        return errorResponse(rateLimit.message, 'RATE_LIMIT');
      }
    } catch (rateLimitError) {
      console.error('Rate limit check failed:', rateLimitError);
      return errorResponse('Service unavailable', 'SERVICE_UNAVAILABLE');
    }
    
    const { roomId } = data;
    if (!roomId) {
      return errorResponse('Room ID is required', 'VALIDATION_ERROR');
    }
    
    // 4. Room fetch with better timeout handling
    let room;
    try {
      room = await Promise.race([
        chatRoomService.findById(roomId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Room fetch timeout')), 5000)
        )
      ]);
    } catch (fetchError) {
      console.error('Error fetching room:', fetchError);
      return errorResponse('Failed to fetch room information', 'SERVICE_UNAVAILABLE');
    }

    if (!room) {
      return errorResponse('Room not found', 'NOT_FOUND');
    }

    if (!room.isActive) {
      return errorResponse('Room is inactive', 'ROOM_INACTIVE');
    }
    
    // 5. Room access check with timeout
    let accessCheck;
    try {
      accessCheck = await Promise.race([
        canJoinRoom(socket, roomId, room.type),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Access check timeout')), 3000)
        )
      ]);
    } catch (accessError) {
      console.error('Access check failed:', accessError);
      return errorResponse('Failed to verify room access', 'SERVICE_UNAVAILABLE');
    }

    if (!accessCheck.success) {
      return errorResponse(accessCheck.message, 'ACCESS_DENIED');
    }
    
    // 6. Room joining with transaction-like behavior
    try {
      // Leave previous rooms
      const currentRooms = Array.from(socket.rooms || []);
      await Promise.all(
        currentRooms
          .filter(r => r !== socket.id && r !== roomId) // Don't leave the room we're trying to join
          .map(r => socket.leave(r).catch(console.error)) // Handle potential leave errors
      );

      // Add user to room if not already a member
      const alreadyMember = Array.isArray(room.members) && 
        room.members.some(m => String(m.user) === String(socket.user.id));
      
      if (!alreadyMember) {
        try {
          await chatRoomService.addMember(roomId, socket.user.id);
        } catch (addMemberError) {
          console.error('Failed to add member:', addMemberError);
          // Continue anyway as the user might have been added by another instance
        }
      }
      
      // Join socket room and update tracking
      await socket.join(roomId);
      if (!userRooms.has(socket.user.id)) {
        userRooms.set(socket.user.id, new Set());
      }
      userRooms.get(socket.user.id).add(roomId);
      
      // 7. Fetch room data with error handling
      let messages, onlineMembers;
      try {
        [messages, onlineMembers] = await Promise.all([
          messageService.findByChatRoom(roomId, 1, 50).catch(() => []), // Return empty array if fetch fails
          getOnlineRoomMembers(room).catch(() => []) // Return empty array if fetch fails
        ]);
      } catch (fetchError) {
        console.error('Error fetching room data:', fetchError);
        messages = [];
        onlineMembers = [];
      }

      // Serialize messages with populated user data
      const serializedMessages = await Promise.all(
        (messages?.reverse() || []).map(msg => serializeMessage(msg))
      );

      const payload = {
        success: true,
        room: {
          id: room.id,
          name: room.name,
          type: room.type,
          description: room.description,
          memberCount: chatRoomService.getMemberCount(room),
          onlineMembers
        },
        messages: serializedMessages
      };

      // 8. Send response with timeout
      const sendResponse = () => {
        if (typeof ack === 'function') {
          ack(payload);
        } else {
          socket.emit('room_joined', payload);
        }
      };

      // Ensure response is sent even if there are issues with notifications
      try {
        // Notify others
        socket.to(roomId).emit('user_joined_room', {
          user: {
            id: socket.user.id,
            username: socket.user.username,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            avatar: socket.user.avatar
          },
          room: { id: roomId, name: room.name }
        });
        sendResponse();
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
        sendResponse(); // Still send response to the user
      }

      console.log(`User ${socket.user.firstName} ${socket.user.lastName} (${socket.user.username}) joined room ${room.name}`);
      
    } catch (joinError) {
      console.error('Error in room join process:', joinError);
      try {
        socket.leave(roomId).catch(console.error);
        userRooms.get(socket.user.id)?.delete(roomId);
      } catch (cleanupError) {
        console.error('Cleanup after failed join error:', cleanupError);
      }
      throw joinError;
    }

  } catch (error) {
    console.error('Join room error:', error);
    return errorResponse(
      error.message || 'Failed to join room',
      error.code || 'INTERNAL_ERROR'
    );
  }
});

  // Handle leaving a chat room
  socket.on('leave_room', async (data, ack) => {
    try {
      const validation = validateSocketPermission(socket, 'leave_room', data);
      if (!validation.success) {
        if (typeof ack === 'function') return ack(validation);
        return socket.emit('error', validation);
      }
      
      const { roomId } = data;
      if (!roomId) {
        throw new Error('Room ID is required');
      }
      
      // If not connected to that room, just ack success
      if (!userRooms.get(userId)?.has(roomId)) {
        const ok = { success: true, roomId, note: 'Not in room' };
        if (typeof ack === 'function') return ack(ok);
        return socket.emit('room_left', ok);
      }

      // Leave room and update tracking
      await socket.leave(roomId);
      userRooms.get(userId)?.delete(roomId);
      
      // Update last read timestamp
      const room = await chatRoomService.findById(roomId);
      if (room) {
        await chatRoomService.updateMemberLastRead(roomId, userId);
        
        // Notify others
        socket.to(roomId).emit('user_left_room', {
          user: {
            id: socket.user.id,
            username: socket.user.username
          },
          room: { id: roomId, name: room.name }
        });
      }
      
      const ok = { success: true, roomId };
      if (typeof ack === 'function') return ack(ok);
      socket.emit('room_left', ok);
      
    } catch (error) {
      console.error('Leave room error:', error);
      const err = {
        success: false,
        message: 'Failed to leave room',
        detail: error?.message || String(error)
      };
      if (typeof ack === 'function') return ack(err);
      socket.emit('error', err);
    }
  });

  // Handle sending messages
  socket.on('send_message', async (data, ack) => {
    try {
      const validation = validateSocketPermission(socket, 'send_message', data);
      if (!validation.success) {
        if (typeof ack === 'function') return ack(validation);
        return socket.emit('error', validation);
      }
      
      const rateLimit = checkSocketRateLimit(socket, 'send_message', 30, 60000);
      if (!rateLimit.success) {
        if (typeof ack === 'function') return ack(rateLimit);
        return socket.emit('error', rateLimit);
      }
      
      const { roomId, content, type = 'text', replyTo } = data;
      
      // Verify room membership
      if (!userRooms.get(userId)?.has(roomId)) {
        const err = {
          success: false,
          message: 'You must join the room first'
        };
        if (typeof ack === 'function') return ack(err);
        return socket.emit('error', err);
      }
      
      // Create and save message
      const msg = await messageService.create({
        content: content.trim(),
        type,
        sender: userId,
        chatRoom: roomId,
        replyTo: replyTo || null
      });

      await chatRoomService.incrementMessageCount(roomId);
      
      // Use current timestamp since Firestore serverTimestamp() is not immediately available
      const timestamp = new Date().toISOString();
      
      // Prepare sender object with full user details
      const senderData = {
        id: socket.user.id,
        username: socket.user.username,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        avatar: socket.user.avatar,
        isOnline: true
      };
      
      // Broadcast to room
      io.to(roomId).emit('new_message', {
        id: msg.id,
        content: msg.content,
        type: msg.type,
        sender: senderData,
        chatRoom: roomId,
        replyTo: msg.replyTo,
        createdAt: timestamp,
        reactions: msg.reactions || []
      });
      
      // Acknowledge success to sender
      if (typeof ack === 'function') {
        ack({
          success: true,
          data: {
            id: msg.id,
            createdAt: timestamp
          }
        });
      }
      
    } catch (error) {
      console.error('Send message error:', error);
      const err = {
        success: false,
        message: 'Failed to send message',
        detail: error?.message || String(error)
      };
      if (typeof ack === 'function') return ack(err);
      socket.emit('error', err);
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const validation = validateSocketPermission(socket, 'typing_start', data);
    if (!validation.success) return;
    
    const { roomId } = data;
    if (userRooms.get(userId)?.has(roomId)) {
      socket.to(roomId).emit('user_typing', {
        user: {
          id: socket.user.id,
          username: socket.user.username,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          avatar: socket.user.avatar
        },
        roomId
      });
    }
  });

  socket.on('typing_stop', (data) => {
    const validation = validateSocketPermission(socket, 'typing_stop', data);
    if (!validation.success) return;
    
    const { roomId } = data;
    if (userRooms.get(userId)?.has(roomId)) {
      socket.to(roomId).emit('user_stopped_typing', {
        user: {
          id: socket.user.id,
          username: socket.user.username,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          avatar: socket.user.avatar
        },
        roomId
      });
    }
  });

  // Handle reactions
  socket.on('add_reaction', async (data) => {
    try {
      const { messageId, emoji } = data;
      
      const message = await messageService.findById(messageId);
      if (!message) {
        return socket.emit('error', {
          success: false,
          message: 'Message not found'
        });
      }
      
      if (!userRooms.get(userId)?.has(String(message.chatRoom))) {
        return socket.emit('error', {
          success: false,
          message: 'Access denied'
        });
      }
      
      await messageService.addReaction(messageId, userId, emoji);
      
      io.to(String(message.chatRoom)).emit('reaction_added', {
        messageId,
        emoji,
        user: {
          id: socket.user.id,
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

  // Handle room list requests
  socket.on('get_rooms', async (data) => {
    try {
      const { type = 'public', page = 1, limit = 20 } = data;
      const offset = (page - 1) * limit;

      let rooms = [];
      if (type === 'public') {
        rooms = await chatRoomService.findByType('public', { limit, offset });
      } else if (type === 'private' && socket.user.canAccessPrivateChat()) {
        rooms = await chatRoomService.findByType('private', { limit, offset });
      } else if (type === 'travel_partner') {
        rooms = await chatRoomService.findByType('travel_partner', { limit, offset });
      }
      
      const roomsWithOnlineCount = await Promise.all(
        rooms.map(async (room) => ({
          id: room.id,
          name: room.name,
          description: room.description,
          type: room.type,
          memberCount: chatRoomService.getMemberCount(room),
          onlineCount: await getOnlineRoomMemberCount(room),
          lastMessage: room.lastMessage || null,
          lastActivity: room.lastActivity,
          avatar: room.avatar || null,
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
};

export const handleSocketConnection = async (socket, io) => {
  try {
    // Initial validation
    if (!socket.user?.id) {
      console.error('No user ID found in socket connection');
      socket.disconnect(true);
      return;
    }

    const userId = socket.user.id;
    console.log(`New socket connection from user ${userId} (${socket.user.email})`);
    
    // Clean up any existing connection
    try {
      if (activeUsers.has(userId)) {
        const existingConnection = activeUsers.get(userId);
        if (existingConnection && existingConnection.socketId !== socket.id) {
          const existingSocket = io.sockets.sockets.get(existingConnection.socketId);
          
          if (existingSocket) {
            console.log(`Cleaning up previous socket connection for user ${userId}`);
            try {
              await cleanupUserConnection(existingSocket, userId, io);
              existingSocket.disconnect(true);
              console.log(`Successfully cleaned up previous connection for user ${userId}`);
            } catch (cleanupError) {
              console.error(`Error during cleanup of previous connection for user ${userId}:`, cleanupError);
            }
          }
        }
      }
    } catch (cleanupError) {
      console.error('Error during connection cleanup:', cleanupError);
    }
    
    // Initialize user session
    try {
      // Initialize session data with enhanced connection info
      const connectionData = {
        socketId: socket.id,
        user: socket.user,
        joinedAt: new Date(),
        lastActivity: new Date(),
        transport: socket.conn.transport.name,
        connectionState: 'connecting',
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'] || 'unknown'
      };
      
      activeUsers.set(userId, connectionData);
      
      // Initialize user rooms tracking
      if (!userRooms.has(userId)) {
        userRooms.set(userId, new Set());
      }
      
      // Set up connection monitoring with error handling
      const heartbeatInterval = 10000; // 10 seconds
      const heartbeatTimeout = 30000; // 30 seconds
      let lastHeartbeat = Date.now();
      let connectionActive = true;
      
      const interval = setInterval(() => {
        if (!connectionActive) return;
        
        if (Date.now() - lastHeartbeat > heartbeatTimeout) {
          console.warn(`No heartbeat from user ${userId} for ${heartbeatTimeout}ms, disconnecting...`);
          clearInterval(interval);
          pingIntervals.delete(userId);
          socket.disconnect(true);
          return;
        }
        
        try {
          socket.emit('ping');
        } catch (pingError) {
          console.error(`Error sending ping to user ${userId}:`, pingError);
          clearInterval(interval);
          pingIntervals.delete(userId);
          connectionActive = false;
        }
      }, heartbeatInterval);

      // Store the interval reference
      pingIntervals.set(userId, interval);
      
      // Set up event handlers with error handling
      const onPong = () => {
        lastHeartbeat = Date.now();
        const userConnection = activeUsers.get(userId);
        if (userConnection) {
          userConnection.lastActivity = new Date();
        }
      };

      const onDisconnect = async (reason) => {
        console.log(`User ${userId} disconnected. Reason: ${reason}`);
        clearInterval(interval);
        pingIntervals.delete(userId);
        await cleanupUserConnection(socket, userId, io);
      };

      const onError = (error) => {
        console.error(`Socket error for user ${userId}:`, error);
        clearInterval(interval);
        pingIntervals.delete(userId);
        socket.disconnect(true);
      };

      const onUpgrade = (transport) => {
        const userConnection = activeUsers.get(userId);
        if (userConnection) {
          userConnection.transport = transport.name;
          userConnection.lastActivity = new Date();
          console.log(`Transport upgraded for user ${userId} to ${transport.name}`);
        }
      };

      // Add event listeners
      socket.on('pong', onPong);
      socket.on('disconnect', onDisconnect);
      socket.on('error', onError);
      socket.conn.on('upgrade', onUpgrade);

      // Cleanup function for event listeners
      const cleanup = () => {
        socket.off('pong', onPong);
        socket.off('disconnect', onDisconnect);
        socket.off('error', onError);
        if (socket.conn) {
          socket.conn.off('upgrade', onUpgrade);
        }
        clearInterval(interval);
        pingIntervals.delete(userId);
      };

      // Initialize socket handlers
      try {
        setupSocketHandlers(socket, io, userId);
        setupModerationHandlers(socket, io);
      } catch (handlerError) {
        console.error('Error setting up socket handlers:', handlerError);
        cleanup();
        throw handlerError;
      }
      
      // Mark connection as ready
      const userConnection = activeUsers.get(userId);
      if (userConnection) {
        userConnection.connectionState = 'connected';
        userConnection.lastActivity = new Date();
      }
      
      // Broadcast initial status
      try {
        await broadcastUserStatus(socket, io, 'online');
        console.log(`User ${socket.user.email} connected successfully with socket ${socket.id}`);
      } catch (broadcastError) {
        console.error('Error broadcasting user status:', broadcastError);
        // Don't fail the connection for broadcast errors
      }
      
      // Return cleanup function
      return cleanup;
      
    } catch (initError) {
      console.error('Error initializing socket connection:', initError);
      try {
        await cleanupUserConnection(socket, userId, io);
      } catch (cleanupError) {
        console.error('Error during connection cleanup after init failure:', cleanupError);
      }
      socket.disconnect(true);
      throw initError;
    }
    
  } catch (error) {
    console.error('Fatal error in socket connection:', error);
    try {
      socket.disconnect(true);
    } catch (disconnectError) {
      console.error('Error during forced socket disconnection:', disconnectError);
    }
    // Re-throw to allow the caller to handle the error if needed
    throw error;
  }
};