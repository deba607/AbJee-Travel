import Message from '../models/Message.js';
import UserRole from '../models/UserRole.js';
import { validateSocketPermission, checkSocketRateLimit } from '../middleware/socketAuth.js';

// Check if user has required permission for the room
const hasPermission = async (userId, roomId, permission) => {
  const userRole = await UserRole.findOne({ user: userId, chatRoom: roomId });
  return userRole && userRole.permissions.includes(permission);
};

export const setupModerationHandlers = (socket, io) => {
  // Delete message
  socket.on('delete_message', async (data) => {
    try {
      const validation = validateSocketPermission(socket, 'delete_message', data);
      if (!validation.success) {
        return socket.emit('error', validation);
      }

      const { messageId } = data;
      const message = await Message.findById(messageId);

      if (!message) {
        return socket.emit('error', {
          success: false,
          message: 'Message not found'
        });
      }

      // Check if user has permission to delete messages
      const canDelete = await hasPermission(socket.user._id, message.chatRoom, 'delete_messages');
      const isOwnMessage = message.sender.toString() === socket.user._id.toString();

      if (!canDelete && !isOwnMessage) {
        return socket.emit('error', {
          success: false,
          message: 'You do not have permission to delete this message'
        });
      }

      await message.softDelete(socket.user._id);

      // Notify room members
      io.to(message.chatRoom.toString()).emit('message_deleted', {
        messageId: message._id,
        deletedBy: {
          id: socket.user._id,
          username: socket.user.username
        }
      });

    } catch (error) {
      console.error('Delete message error:', error);
      socket.emit('error', {
        success: false,
        message: 'Failed to delete message'
      });
    }
  });

  // Report message
  socket.on('report_message', async (data) => {
    try {
      const validation = validateSocketPermission(socket, 'report_message', data);
      if (!validation.success) {
        return socket.emit('error', validation);
      }

      const rateLimit = checkSocketRateLimit(socket, 'report_message', 5, 300000); // 5 reports per 5 minutes
      if (!rateLimit.success) {
        return socket.emit('error', rateLimit);
      }

      const { messageId, reason, description } = data;
      const message = await Message.findById(messageId);

      if (!message) {
        return socket.emit('error', {
          success: false,
          message: 'Message not found'
        });
      }

      await message.report(socket.user._id, reason, description);

      // Notify moderators
      const moderators = await UserRole.find({
        chatRoom: message.chatRoom,
        permissions: 'delete_messages'
      }).populate('user', 'username');

      moderators.forEach(mod => {
        const modSocket = Array.from(io.sockets.sockets.values())
          .find(s => s.user && s.user._id.toString() === mod.user._id.toString());

        if (modSocket) {
          modSocket.emit('new_report', {
            messageId: message._id,
            reporter: {
              id: socket.user._id,
              username: socket.user.username
            },
            reason,
            description
          });
        }
      });

      socket.emit('report_submitted', { success: true });

    } catch (error) {
      console.error('Report message error:', error);
      socket.emit('error', {
        success: false,
        message: 'Failed to report message'
      });
    }
  });

  // Moderate message
  socket.on('moderate_message', async (data) => {
    try {
      const validation = validateSocketPermission(socket, 'moderate_message', data);
      if (!validation.success) {
        return socket.emit('error', validation);
      }

      const { messageId, reason } = data;
      const message = await Message.findById(messageId);

      if (!message) {
        return socket.emit('error', {
          success: false,
          message: 'Message not found'
        });
      }

      // Check if user has moderation permissions
      const canModerate = await hasPermission(socket.user._id, message.chatRoom, 'delete_messages');
      
      if (!canModerate) {
        return socket.emit('error', {
          success: false,
          message: 'You do not have permission to moderate messages'
        });
      }

      await message.moderate(socket.user._id, reason);

      // Notify room members
      io.to(message.chatRoom.toString()).emit('message_moderated', {
        messageId: message._id,
        moderatedBy: {
          id: socket.user._id,
          username: socket.user.username
        },
        reason
      });

    } catch (error) {
      console.error('Moderate message error:', error);
      socket.emit('error', {
        success: false,
        message: 'Failed to moderate message'
      });
    }
  });

  // Pin/Unpin message
  socket.on('toggle_pin_message', async (data) => {
    try {
      const validation = validateSocketPermission(socket, 'pin_message', data);
      if (!validation.success) {
        return socket.emit('error', validation);
      }

      const { messageId } = data;
      const message = await Message.findById(messageId);

      if (!message) {
        return socket.emit('error', {
          success: false,
          message: 'Message not found'
        });
      }

      // Check if user has pin permission
      const canPin = await hasPermission(socket.user._id, message.chatRoom, 'pin_messages');
      
      if (!canPin) {
        return socket.emit('error', {
          success: false,
          message: 'You do not have permission to pin messages'
        });
      }

      await message.togglePin(socket.user._id);

      // Notify room members
      io.to(message.chatRoom.toString()).emit('message_pin_toggled', {
        messageId: message._id,
        isPinned: message.isPinned,
        pinnedBy: {
          id: socket.user._id,
          username: socket.user.username
        }
      });

    } catch (error) {
      console.error('Pin message error:', error);
      socket.emit('error', {
        success: false,
        message: 'Failed to pin/unpin message'
      });
    }
  });
};