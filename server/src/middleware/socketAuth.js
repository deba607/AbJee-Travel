import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Socket.IO authentication middleware
export const authenticateSocket = async (socket, next) => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      if (!user.isActive) {
        return next(new Error('Authentication error: Account deactivated'));
      }
      
      // Update user online status
      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();
      
      // Attach user to socket
      socket.user = user;
      socket.userId = user._id.toString();
      
      console.log(`Socket authenticated for user: ${user.username} (${user._id})`);
      next();
      
    } catch (tokenError) {
      if (tokenError.name === 'TokenExpiredError') {
        return next(new Error('Authentication error: Token expired'));
      } else if (tokenError.name === 'JsonWebTokenError') {
        return next(new Error('Authentication error: Invalid token'));
      } else {
        throw tokenError;
      }
    }
    
  } catch (error) {
    console.error('Socket authentication error:', error);
    return next(new Error('Authentication error: Failed to authenticate'));
  }
};

// Middleware to check if user can access private chat rooms
export const requireSubscriptionForSocket = (socket, next) => {
  if (!socket.user) {
    return next(new Error('Authentication required'));
  }
  
  if (!socket.user.canAccessPrivateChat()) {
    return next(new Error('Subscription required for private chat access'));
  }
  
  next();
};

// Middleware to check if user can join specific room
export const canJoinRoom = async (socket, roomId, roomType = 'public') => {
  try {
    if (!socket.user) {
      return { success: false, message: 'Authentication required' };
    }
    
    // For public rooms, all authenticated users can join
    if (roomType === 'public') {
      return { success: true };
    }
    
    // For private rooms, check subscription
    if (roomType === 'private') {
      if (!socket.user.canAccessPrivateChat()) {
        return { 
          success: false, 
          message: 'Active subscription required for private chat rooms',
          upgradeRequired: true
        };
      }
    }
    
    // For travel partner rooms, basic authentication is enough
    if (roomType === 'travel_partner') {
      return { success: true };
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('Room access check error:', error);
    return { success: false, message: 'Failed to verify room access' };
  }
};

// Handle socket disconnection and cleanup
export const handleSocketDisconnect = async (socket) => {
  try {
    if (socket.user) {
      // Update user offline status
      const user = await User.findById(socket.user._id);
      if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();
        await user.save();
        
        console.log(`User ${user.username} disconnected and marked offline`);
      }
    }
  } catch (error) {
    console.error('Socket disconnect cleanup error:', error);
  }
};

// Validate socket event permissions
export const validateSocketPermission = (socket, action, data = {}) => {
  if (!socket.user) {
    return { success: false, message: 'Authentication required' };
  }
  
  switch (action) {
    case 'send_message':
      // Basic validation for sending messages
      if (!data.content || data.content.trim().length === 0) {
        return { success: false, message: 'Message content is required' };
      }
      
      if (data.content.length > 2000) {
        return { success: false, message: 'Message too long (max 2000 characters)' };
      }
      
      return { success: true };
      
    case 'create_private_room':
      if (!socket.user.canAccessPrivateChat()) {
        return { 
          success: false, 
          message: 'Subscription required to create private rooms',
          upgradeRequired: true
        };
      }
      return { success: true };
      
    case 'send_travel_request':
      // Check if user can send travel partner requests
      return { success: true };
      
    case 'join_room':
      if (!data.roomId) {
        return { success: false, message: 'Room ID is required' };
      }
      return { success: true };
      
    case 'leave_room':
      if (!data.roomId) {
        return { success: false, message: 'Room ID is required' };
      }
      return { success: true };
      
    case 'typing_start':
    case 'typing_stop':
      if (!data.roomId) {
        return { success: false, message: 'Room ID is required' };
      }
      return { success: true };
      
    default:
      return { success: false, message: 'Unknown action' };
  }
};

// Rate limiting for socket events
const socketRateLimits = new Map();

export const checkSocketRateLimit = (socket, action, limit = 10, windowMs = 60000) => {
  const key = `${socket.userId}:${action}`;
  const now = Date.now();
  
  if (!socketRateLimits.has(key)) {
    socketRateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true };
  }
  
  const rateLimit = socketRateLimits.get(key);
  
  if (now > rateLimit.resetTime) {
    // Reset the rate limit
    rateLimit.count = 1;
    rateLimit.resetTime = now + windowMs;
    return { success: true };
  }
  
  if (rateLimit.count >= limit) {
    return { 
      success: false, 
      message: `Rate limit exceeded for ${action}. Try again later.`,
      retryAfter: Math.ceil((rateLimit.resetTime - now) / 1000)
    };
  }
  
  rateLimit.count++;
  return { success: true };
};

// Clean up rate limit data periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of socketRateLimits.entries()) {
    if (now > data.resetTime) {
      socketRateLimits.delete(key);
    }
  }
}, 300000); // Clean up every 5 minutes
