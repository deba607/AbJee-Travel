import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      this.token = token;
      
      this.socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:5000', {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        resolve(this.socket!);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Chat room methods
  joinRoom(roomId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('join_room', { roomId });
      
      this.socket.once('room_joined', (data) => {
        if (data.success) {
          resolve(data);
        } else {
          reject(new Error(data.message));
        }
      });

      this.socket.once('error', (error) => {
        reject(new Error(error.message));
      });
    });
  }

  leaveRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('leave_room', { roomId });
      
      this.socket.once('room_left', (data) => {
        if (data.success) {
          resolve();
        } else {
          reject(new Error('Failed to leave room'));
        }
      });
    });
  }

  sendMessage(roomId: string, content: string, type: string = 'text', replyTo?: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('send_message', {
      roomId,
      content,
      type,
      replyTo
    });
  }

  startTyping(roomId: string) {
    if (this.socket) {
      this.socket.emit('typing_start', { roomId });
    }
  }

  stopTyping(roomId: string) {
    if (this.socket) {
      this.socket.emit('typing_stop', { roomId });
    }
  }

  addReaction(messageId: string, emoji: string) {
    if (this.socket) {
      this.socket.emit('add_reaction', { messageId, emoji });
    }
  }

  getRooms(type: string = 'public', page: number = 1, limit: number = 20) {
    if (this.socket) {
      this.socket.emit('get_rooms', { type, page, limit });
    }
  }

  // Event listeners
  onNewMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('new_message', callback);
    }
  }

  onUserJoinedRoom(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_joined_room', callback);
    }
  }

  onUserLeftRoom(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_left_room', callback);
    }
  }

  onUserTyping(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_typing', callback);
    }
  }

  onUserStoppedTyping(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_stopped_typing', callback);
    }
  }

  onUserStatusChange(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_status_change', callback);
    }
  }

  onReactionAdded(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('reaction_added', callback);
    }
  }

  onRoomsList(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('rooms_list', callback);
    }
  }

  // Remove event listeners
  off(event: string, callback?: Function) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketService = new SocketService();
export default socketService;
