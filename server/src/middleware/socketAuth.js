import admin from '../config/firebase-admin.js';
import userService from '../models/User.js';

// Socket.IO authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    // Try to get token from auth object first
    let token = socket.handshake.auth?.token;
    
    // If no token in auth, check headers (for polling transport)
    if (!token && socket.handshake.headers.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    }
    
    if (!token) {
      console.error('[SocketAuth] No token found in socket connection');
      return next(new Error('Authentication error: No token provided'));
    }
    
    try {
      // Remove any 'Bearer ' prefix if present (in case it wasn't handled above)
      token = token.replace('Bearer ', '');
      
      // Basic token validation
      if (!token.includes('.') || token.split('.').length !== 3) {
        console.error('[SocketAuth] Invalid token format - not a valid JWT structure');
        return next(new Error('Authentication error: Invalid token format'));
      }

      // Parse token parts for debugging (header and payload only)
      try {
        const [headerB64, payloadB64] = token.split('.');
        const header = JSON.parse(Buffer.from(headerB64, 'base64').toString());
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
        
        console.log('[SocketAuth] Token validation:', {
          header: { alg: header.alg, typ: header.typ },
          payload: {
            iss: payload.iss,
            aud: payload.aud,
            sub: payload.sub,
            exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'none',
            iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : 'none'
          }
        });
      } catch (parseError) {
        console.warn('[SocketAuth] Could not parse token parts (non-fatal):', parseError);
      }

      // Verify Firebase token
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Get user from database
      let user = await userService.findByFirebaseUid(decodedToken.uid);
      
      if (!user) {
        // Create new user if they don't exist
        const displayName = decodedToken.name || '';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        user = await userService.createWithId(decodedToken.uid, {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email,
          emailVerified: decodedToken.email_verified || false,
          displayName: displayName,
          firstName: firstName,
          lastName: lastName,
          username: decodedToken.email?.split('@')[0] || '',
          avatar: decodedToken.picture || '',
          isActive: true
        });
        console.log(`[SocketAuth] Created new user: ${user.email} (${user.id})`);
      } else if (!user.isActive) {
        console.error(`[SocketAuth] Authentication failed: Account deactivated for user ${user.id}`);
        return next(new Error('Authentication error: Account deactivated'));
      } else {
        // Check if existing user needs firstName/lastName populated
        if ((!user.firstName || !user.lastName) && user.displayName) {
          const nameParts = user.displayName.split(' ');
          const updates = {};
          if (!user.firstName && nameParts[0]) {
            updates.firstName = nameParts[0];
          }
          if (!user.lastName && nameParts.length > 1) {
            updates.lastName = nameParts.slice(1).join(' ');
          }
          if (!user.username && user.email) {
            updates.username = user.email.split('@')[0];
          }
          
          if (Object.keys(updates).length > 0) {
            try {
              await userService.update(user.id, updates);
              // Update the user object with the new values
              user = { ...user, ...updates };
              console.log(`[SocketAuth] Updated user ${user.id} with missing fields:`, updates);
            } catch (updateError) {
              console.error(`[SocketAuth] Failed to update user fields:`, updateError);
            }
          }
        }
      }
      
      // Update user's last active timestamp
      // In socketAuth.js, around line 70 where updateLastActive is called
      try {
        await userService.updateLastActive(user.id);
      } catch (updateError) {
        console.error(`[SocketAuth] Failed to update last active for user ${user.id}:`, updateError);
        // Don't fail the authentication if this fails
      }
      
      // Attach user to socket
      socket.user = user;
      socket.userId = user.id;
      
      console.log(`[SocketAuth] Authenticated user: ${user.email} (${user.id})`);
      next();
      
    } catch (tokenError) {
      console.error('[SocketAuth] Token verification error:', {
        code: tokenError.code,
        message: tokenError.message,
        stack: tokenError.stack
      });
      
      // Handle specific Firebase auth errors
      if (tokenError.code === 'auth/id-token-expired') {
        return next(new Error('Authentication error: Token expired'));
      } else if (tokenError.code === 'auth/argument-error' || 
                 tokenError.code === 'auth/invalid-id-token') {
        return next(new Error('Authentication error: Invalid token'));
      } else if (tokenError.code === 'auth/user-disabled') {
        return next(new Error('Authentication error: Account disabled'));
      } else {
        console.error('[SocketAuth] Unexpected authentication error:', tokenError);
        return next(new Error('Authentication error: Token verification failed'));
      }
    }
    
  } catch (error) {
    console.error('[SocketAuth] Unexpected error during authentication:', {
      error: error.message,
      stack: error.stack
    });
    return next(new Error('Authentication error: Internal server error'));
  }
};

// Middleware to check if user can access private chat rooms
const requireSubscriptionForSocket = (socket, next) => {
  if (!socket.user) {
    return next(new Error('Authentication required'));
  }
  
  if (!userService.canAccessPrivateChat(socket.user)) {
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
      if (!userService.canAccessPrivateChat(socket.user)) {
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
const handleSocketDisconnect = async (socket) => {
  try {
    if (socket.user) {
      // Update user offline status
      await userService.updateStatus(socket.user.id, false);
      console.log(`User ${socket.user.username || socket.user.email} disconnected and marked offline`);
    }
  } catch (error) {
    console.error('Socket disconnect cleanup error:', error);
  }
};

// Rate limiting for socket events
const rateLimits = new Map();

const checkSocketRateLimit = (socket, action, maxRequests, timeWindow) => {
  const userId = socket.user.id;
  const key = `${userId}:${action}`;
  const now = Date.now();
  
  // Get or initialize rate limit data
  const limit = rateLimits.get(key) || {
    requests: [],
    lastReset: now
  };
  
  // Clear old requests
  limit.requests = limit.requests.filter(time => time > now - timeWindow);
  
  // Check if limit is exceeded
  if (limit.requests.length >= maxRequests) {
    return {
      success: false,
      message: `Rate limit exceeded for ${action}. Please try again later.`
    };
  }
  
  // Add new request
  limit.requests.push(now);
  rateLimits.set(key, limit);
  
  return { success: true };
};

// Validate socket event permissions
const validateSocketPermission = (socket, action, data = {}) => {
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
      if (!userService.canAccessPrivateChat(socket.user)) {
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

// In socketAuth.js, right before calling updateLastActive
console.log('UserService methods:', Object.keys(Object.getPrototypeOf(userService)));
console.log('updateLastActive exists:', typeof userService.updateLastActive);

export {
  authenticateSocket,
  requireSubscriptionForSocket,
  handleSocketDisconnect,
  validateSocketPermission,
  checkSocketRateLimit
};
