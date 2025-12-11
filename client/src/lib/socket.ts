import io from 'socket.io-client';

import type { 
  Message,
  UserEvent,
  MessageEvent,
  ModerationEvent,
  ReactionEvent,
  RoomJoinResponse,
  ISocketService,
  User
} from '@/types/chat';



interface SocketResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
}

interface AuthError extends Error {
  code?: string;
  [key: string]: unknown;
}

class SocketService implements ISocketService {
  private socket: ReturnType<typeof io> | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private onTokenRefreshNeeded: (() => Promise<string>) | null = null;
  private connectionPromise: Promise<void> | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastError: Error | null = null;
  private eventListeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private isRefreshingToken = false;
  private pendingRequests: (() => void)[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private disconnectRequested = false; // Track intentional disconnects
  private connectionLock = false; // Prevent concurrent connections
  
  setTokenRefreshCallback(callback: () => Promise<string>): void {
    this.onTokenRefreshNeeded = callback;
  }

  private getBackoffDelay(): number {
    const baseDelay = 1000;
    const maxDelay = 30000;
    return Math.min(maxDelay, baseDelay * Math.pow(2, this.reconnectAttempts)) + Math.random() * 1000;
  }

  // In socket.ts, enhance the connect method
  private setupHeartbeat() {
    if (!this.socket) return;
    
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Set up ping listener at the engine level to respond to server pings
    ((this.socket as any).io.engine).on('ping', () => {
      console.debug('[Socket] Engine ping received from server, auto-responding with pong');
      // The engine automatically responds to pings, but we can monitor it
    });
    
    console.log('[Socket] Heartbeat setup complete - engine handles ping/pong automatically');
  }

  private cleanup(): void {
    this.connectionPromise = null;
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

   private async handleConnectionError(socketError: AuthError): Promise<void> {
    console.error('Connection error:', {
      code: socketError.code,
      message: socketError.message,
      stack: socketError.stack
    });
    this.lastError = socketError;

    // Handle authentication errors
    const isAuthError = socketError.message.includes('Authentication') || 
                       socketError.code === 'AUTH_ERROR' ||
                       socketError.code === 'TOKEN_EXPIRED';

    if (isAuthError && this.onTokenRefreshNeeded && !this.isRefreshingToken) {
      try {
        this.isRefreshingToken = true;
        console.log('Attempting to refresh authentication token...');
        
        const newToken = await this.onTokenRefreshNeeded();
        if (newToken) {
          this.token = newToken;
          console.log('Token refreshed successfully, reconnecting...');
          await this.connect(newToken, true);
          
          // Process any pending requests
          while (this.pendingRequests.length > 0) {
            const request = this.pendingRequests.shift();
            request?.();
          }
          return;
        }
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
      } finally {
        this.isRefreshingToken = false;
      }
    }

    // Handle reconnection with exponential backoff
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.getBackoffDelay();
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      return new Promise<void>((resolve, reject) => {
        this.reconnectTimeout = setTimeout(async () => {
          try {
            if (!this.token) {
              throw new Error('No token available for reconnection');
            }
            await this.connect(this.token, true);
            resolve();
          } catch (error) {
            reject(error);
          }
        }, delay);
      });
    }

    this.reconnectAttempts = 0;
    throw new Error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
  }

    async connect(token: string, isReconnect = false): Promise<void> {
    // If already connected with the same token, return immediately
    if (this.socket?.connected && this.token === token && !this.disconnectRequested) {
      console.log('[Socket] Already connected, reusing existing connection');
      return Promise.resolve();
    }

    // If connection is in progress, wait for it
    if (this.connectionLock && this.connectionPromise) {
      console.log('[Socket] Connection already in progress, waiting...');
      return this.connectionPromise;
    }

    // Acquire connection lock
    this.connectionLock = true;
    this.lastError = null;
    this.disconnectRequested = false;

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      this.connectionTimeout = setTimeout(() => {
        this.cleanup();
        reject(new Error('Connection timeout after 20s'));
      }, 20000);

      // Only disconnect if we're intentionally reconnecting or changing tokens
      if (this.socket && (this.token !== token || isReconnect)) {
        console.log('[Socket] Cleaning up existing connection for reconnect');
        try {
          this.clearAllListeners();
          this.socket.disconnect();
          this.socket = null;
        } catch (error) {
          console.error('Error cleaning up existing socket:', error);
        }
      }

      // If socket already exists and is connected, just resolve
      if (this.socket?.connected && this.token === token) {
        console.log('[Socket] Reusing existing connected socket');
        this.cleanup();
        this.connectionLock = false;
        resolve();
        return;
      }

      this.token = token;
      
      console.log(isReconnect ? 'Reconnecting socket...' : 'Initializing socket connection...');
      
      const socketOptions: any = {
        auth: { token },
        transportOptions: {
          polling: {
            extraHeaders: { 
              Authorization: `Bearer ${token}`,
              'X-Client-Version': '1.0.0' // Add version header
            }
          }
        },
        transports: ['websocket', 'polling'],
        // Note: allowEIO3 is not part of the official ConnectOpts type and is omitted.
        // Some options like pingTimeout/pingInterval/connectTimeout are not present in
        // the 'ConnectOpts' type; cast to 'any' above to avoid TypeScript errors.
        // Use engine.io options under 'transportOptions' if needed by the server.
        pingTimeout: 30000, // Match server's 30s pingTimeout
        pingInterval: 10000, // Match server's 10s pingInterval
        connectTimeout: 45000, // Match server's 45s connectTimeout
        reconnection: false, // Disable automatic reconnection, we handle it manually
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        forceNew: false, // Reuse existing connection if available
        autoConnect: true,
        upgrade: true,
        rememberUpgrade: true,
        withCredentials: true,
        rejectUnauthorized: false // Only for development with self-signed certs
      };
      
      this.socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:5000', socketOptions);

      // Set up event listeners
      this.setupEventListeners(resolve, reject);
    });

    try {
      await this.connectionPromise;
      this.setupHeartbeat(); // Ensure heartbeat is set up after connection
      this.connectionLock = false; // Release lock on success
    } catch (error) {
      this.cleanup();
      this.connectionLock = false; // Release lock on error
      throw error;
    }

    return this.connectionPromise;
  }


   private setupEventListeners(resolve: () => void, reject: (error: Error) => void) {
    if (!this.socket) return;

    // Add ping/pong handlers for connection health monitoring
    ((this.socket as any).io.engine).on('ping', () => {
      console.debug('[Socket] Engine ping received from server');
    });

    ((this.socket as any).io.engine).on('pong', (latency: number) => {
      console.debug(`[Socket] Engine pong received, latency: ${latency}ms`);
    });

    // Add ping listener to respond to server pings - MUST be set up before connection
    this.socket.on('ping', () => {
      console.debug('[Socket] Ping received from server, sending pong');
      this.socket?.emit('pong');
    });

    // Monitor connection state changes
    ((this.socket as any).io.engine).on('upgrade', () => {
      console.log('[Socket] Connection upgraded to', (this.socket as any)?.io.engine.transport.name);
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.reconnectAttempts = 0;
      this.cleanup();
      resolve();
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Socket connect error:', error);
      this.cleanup();
      this.handleConnectionError(error as AuthError)
        .then(resolve)
        .catch(reject);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[Socket] Disconnected. Reason:', reason);
      
      // Clean up any active intervals
      if ((this.socket as any)?.heartbeatInterval) {
        clearInterval((this.socket as any).heartbeatInterval);
      }

      // Handle different disconnection reasons
      if (reason === 'io server disconnect') {
        // Server explicitly disconnected us
        console.log('[Socket] Server disconnected the socket');
      } else if (reason === 'io client disconnect') {
        // We explicitly disconnected
        console.log('[Socket] Client intentionally disconnected');
        this.cleanup();
      } else if (reason === 'ping timeout' || reason === 'transport close') {
        // Connection lost
        console.log(`[Socket] Connection lost (${reason})`);
      } else {
        // Other disconnection reasons
        console.log('[Socket] Disconnected for other reason');
      }
      
      this.handleConnectionError({
        name: 'DisconnectError',
        message: reason,
        [reason]: true
      } as AuthError).catch(console.error);
    });

    this.socket.on('error', (error: Error) => {
      console.error('Socket error:', error);
      if (error.message.includes('Authentication failed')) {
        this.handleConnectionError(error as AuthError).catch(console.error);
      }
    });

    // Start the connection
    console.log('Attempting socket connection...');
    this.socket.connect();
  }



  getSocket(): ReturnType<typeof io> | null {
    return this.socket;
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  getLastError(): Error | null {
    return this.lastError;
  }

  private async ensureConnected(): Promise<void> {
    // If already connected, return immediately
    if (this.socket?.connected) {
      console.log('[Socket] Already connected');
      return;
    }

    console.log('[Socket] Ensuring connection...');

    try {
      let token = this.token;
      
      // If we're already refreshing the token, wait for it to complete
      if (this.isRefreshingToken && this.connectionPromise) {
        console.log('[Socket] Waiting for token refresh to complete...');
        await this.connectionPromise;
        return;
      }

      // If no token but we have a refresh callback, get a fresh token
      if (!token && this.onTokenRefreshNeeded) {
        try {
          console.log('[Socket] Getting fresh token...');
          token = await this.onTokenRefreshNeeded();
          this.token = token;
        } catch (error) {
          console.error('Failed to refresh token:', error);
          throw new Error('Authentication failed: Could not refresh token');
        }
      }

      if (!token) {
        throw new Error('No token available for socket connection');
      }

      // If no socket instance or socket exists but not connected, connect
      if (!this.socket || !this.socket.connected) {
        console.log('[Socket] Connecting to server...');
        await this.connect(token, true);
        
        // Wait a bit for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!this.socket?.connected) {
          throw new Error('Failed to establish socket connection');
        }
        console.log('[Socket] Connection established successfully');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Socket] Failed to ensure connection:', message);
      throw new Error(`Failed to ensure socket connection: ${message}`);
    }
  }


  async joinRoom(roomId: string): Promise<RoomJoinResponse> {
    console.log(`[Socket] Attempting to join room: ${roomId}`);
    
    try {
      await this.ensureConnected();
    } catch (error) {
      console.error('[Socket] Failed to ensure connection before joining room:', error);
      throw new Error('Cannot join room: Socket connection failed. Please refresh the page.');
    }

    if (!this.socket?.connected) {
      console.error('[Socket] Socket not connected after ensureConnected');
      throw new Error('Socket not connected. Please refresh the page and try again.');
    }

    console.log('[Socket] Socket connected, emitting join_room event');

    return new Promise<RoomJoinResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        console.error('[Socket] Join room timeout');
        reject(new Error('Join room request timed out. Please try again.'));
      }, 10000);

      const onDisconnect = () => {
        cleanup();
        console.error('[Socket] Socket disconnected while joining room');
        reject(new Error('Socket disconnected while joining room. Please try again.'));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        if (this.socket) {
          this.socket.off('disconnect', onDisconnect);
        }
      };

      this.socket!.once('disconnect', onDisconnect);

      this.socket!.emit('join_room', { roomId }, (response: SocketResponse<RoomJoinResponse>) => {
        cleanup();
        console.log('[Socket] Join room response:', response);
        
        // The server sends data directly in response (response.room, response.messages)
        // not nested under response.data
        if (response.success) {
          // Check if it's the new format (data at root) or old format (nested under data)
          const hasRoomAtRoot = 'room' in response && 'messages' in response;
          const responseData = hasRoomAtRoot ? (response as any) : response.data;
          
          if (responseData && responseData.room) {
            console.log('[Socket] Successfully joined room');
            resolve(responseData as RoomJoinResponse);
          } else {
            console.error('[Socket] Invalid response format:', response);
            reject(new Error('Invalid response format from server'));
          }
        } else {
          console.error('[Socket] Failed to join room:', response.message);
          reject(new Error(response.message || 'Failed to join room'));
        }
      });
    });
  }

  async leaveRoom(roomId: string): Promise<void> {
    if (!this.socket?.connected) return;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(); // Don't reject on timeout, just clean up
      }, 5000);

      const cleanup = () => {
        clearTimeout(timeout);
      };

      this.socket!.emit('leave_room', { roomId }, (response: SocketResponse) => {
        cleanup();
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.message || 'Failed to leave room'));
        }
      });
    });
  }

  async sendMessage(roomId: string, content: string, type = 'text', replyTo?: string): Promise<unknown> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Send message timeout'));
      }, 10000);

      this.socket!.emit('send_message', {
        roomId,
        content,
        type,
        replyTo
      }, (response: SocketResponse) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.message || 'Failed to send message'));
        }
      });
    });
  }

  startTyping(roomId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing_start', { roomId });
    }
  }

  stopTyping(roomId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing_stop', { roomId });
    }
  }

  addReaction(messageId: string, emoji: string): void {
    if (this.socket?.connected) {
      this.socket.emit('add_reaction', { messageId, emoji });
    }
  }

  async getRooms(type = 'public', page = 1, limit = 20): Promise<unknown> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Get rooms timeout'));
      }, 10000);

      this.socket!.emit('get_rooms', { type, page, limit }, (response: SocketResponse) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.message || 'Failed to get rooms'));
        }
      });
    });
  }

  on<K extends string>(event: K, callback: (...args: any[]) => void): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    let callbacks = this.eventListeners.get(String(event));
    if (!callbacks) {
      callbacks = new Set();
      this.eventListeners.set(String(event), callbacks);
    }
    callbacks.add(callback as any);
    this.socket.on(String(event), callback as any);
  }

  once<K extends string>(event: K, callback: (...args: any[]) => void): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    const wrapper = (...args: any[]) => {
      (callback as any)(...args);
      this.off(event, wrapper as any);
    };

    let callbacks = this.eventListeners.get(String(event));
    if (!callbacks) {
      callbacks = new Set();
      this.eventListeners.set(String(event), callbacks);
    }
    callbacks.add(wrapper as any);
    this.socket.once(String(event), wrapper);
  }

  off<K extends string>(event: K, callback?: (...args: any[]) => void): void {
    if (!this.socket) return;

    const callbacks = this.eventListeners.get(String(event));
    if (!callbacks) return;

    if (callback) {
      callbacks.delete(callback);
      this.socket.off(String(event), callback);
    } else {
      callbacks.forEach(cb => this.socket?.off(String(event), cb));
      this.eventListeners.delete(String(event));
    }
  }

  clearAllListeners(): void {
    if (!this.socket) return;

    this.eventListeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => this.socket?.off(event, callback));
    });

    this.eventListeners.clear();
  }

  // High-level event handlers
  onNewMessage(callback: (message: Message) => void): void {
    this.on('new_message', callback);
  }

  onUserJoinedRoom(callback: (data: UserEvent) => void): void {
    this.on('user_joined_room', callback);
  }

  onUserLeftRoom(callback: (data: UserEvent) => void): void {
    this.on('user_left_room', callback);
  }

  onUserTyping(callback: (data: UserEvent) => void): void {
    this.on('user_typing', callback);
  }

  onUserStoppedTyping(callback: (data: UserEvent) => void): void {
    this.on('user_stopped_typing', callback);
  }

  onUserStatusChange(callback: (data: { user: User; status: 'online' | 'offline' }) => void): void {
    this.on('user_status_change', callback);
  }

  onReactionAdded(callback: (data: ReactionEvent) => void): void {
    this.on('reaction_added', callback);
  }

  onMessageDeleted(callback: (data: MessageEvent) => void): void {
    this.on('message_deleted', callback);
  }

  onMessageModerated(callback: (data: ModerationEvent) => void): void {
    this.on('message_moderated', callback);
  }

  onMessagePinToggled(callback: (data: { messageId: string; isPinned: boolean }) => void): void {
    this.on('message_pin_toggled', callback);
  }

  onNewReport(callback: (data: ModerationEvent) => void): void {
    this.on('new_report', callback);
  }

  // Moderation methods
  async deleteMessage(messageId: string): Promise<void> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Delete message timeout'));
      }, 10000);

      this.socket!.emit('delete_message', { messageId }, (response: SocketResponse) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.message || 'Failed to delete message'));
        }
      });
    });
  }

  async reportMessage(messageId: string, reason: string, description?: string): Promise<void> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Report message timeout'));
      }, 10000);

      this.socket!.emit('report_message', { messageId, reason, description }, (response: SocketResponse) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.message || 'Failed to report message'));
        }
      });
    });
  }

  async moderateMessage(messageId: string, reason: string): Promise<void> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Moderate message timeout'));
      }, 10000);

      this.socket!.emit('moderate_message', { messageId, reason }, (response: SocketResponse) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.message || 'Failed to moderate message'));
        }
      });
    });
  }

  async togglePinMessage(messageId: string): Promise<void> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Toggle pin message timeout'));
      }, 10000);

      this.socket!.emit('toggle_pin_message', { messageId }, (response: SocketResponse) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.message || 'Failed to toggle pin message'));
        }
      });
    });
  }

  disconnect(): void {
    this.disconnectRequested = true; // Mark as intentional disconnect
    this.cleanup();
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.socket) {
      this.clearAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Release lock
    this.connectionLock = false;
  }
}

export const socketService = new SocketService();
export default socketService;