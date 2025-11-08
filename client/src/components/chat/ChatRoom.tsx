import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Crown, Settings, Users } from 'lucide-react';

// Import necessary types and services
import { User, Message, Room } from '@/types/chat';
import { socketService } from '@/lib/socket';
import { chatAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';
import TypingIndicator from '@/components/chat/TypingIndicator';
import ModerationDialog from '@/components/chat/ModerationDialog';

const ChatRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // State with proper types
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<User[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [userRole, setUserRole] = useState<'user' | 'moderator' | 'admin'>('user');
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([]);
  const [moderationDialog, setModerationDialog] = useState<{
    isOpen: boolean;
    type: 'report' | 'moderate';
    messageId: string | null;
  }>({
    isOpen: false,
    type: 'report',
    messageId: null
  });

  // Helper functions
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Socket event handlers
  const setupSocketListeners = useCallback(() => {
    if (!roomId) return;

    const handleNewMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    };

    const handleUserTyping = (user: User) => {
      setTypingUsers(prev => 
        prev.some(u => u.id === user.id) ? prev : [...prev, user]
      );
    };

    const handleUserStoppedTyping = (userId: string) => {
      setTypingUsers(prev => prev.filter(user => user.id !== userId));
    };

    const handleMessagePinToggled = (data: { messageId: string; isPinned: boolean }) => {
      if (data.isPinned) {
        setPinnedMessages(prev => [...prev, data.messageId]);
      } else {
        setPinnedMessages(prev => prev.filter(id => id !== data.messageId));
      }
    };

    // Add all socket listeners
    socketService.on('new_message', handleNewMessage);
    socketService.on('user_typing', handleUserTyping);
    socketService.on('user_stopped_typing', handleUserStoppedTyping);
    socketService.on('message_pin_toggled', handleMessagePinToggled);

    // Cleanup function
    return () => {
      socketService.off('new_message', handleNewMessage);
      socketService.off('user_typing', handleUserTyping);
      socketService.off('user_stopped_typing', handleUserStoppedTyping);
      socketService.off('message_pin_toggled', handleMessagePinToggled);
    };
  }, [roomId, scrollToBottom]);

  // Load room data
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const loadRoomData = async () => {
      if (!roomId || !mounted) return;

      try {
        setLoading(true);
        
        // Get room details
        const roomResponse = await chatAPI.getRoomDetails(roomId);
        if (!roomResponse.data?.data?.room) {
          throw new Error('Room not found');
        }

        const roomData = roomResponse.data.data.room;
        
        // Socket connection is managed by AuthContext
        // Wait a bit if socket is not connected yet (AuthContext might still be connecting)
        if (!socketService.isConnected()) {
          console.log('[ChatRoom] Socket not connected, waiting for AuthContext to establish connection...');
          
          // Wait up to 5 seconds for socket to connect
          let waitTime = 0;
          const maxWait = 5000;
          const checkInterval = 200;
          
          while (!socketService.isConnected() && waitTime < maxWait) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waitTime += checkInterval;
          }
          
          if (!socketService.isConnected()) {
            throw new Error('Socket connection not established. Please refresh the page and try again.');
          }
          
          console.log('[ChatRoom] Socket connected after waiting');
        }

        // Join room
        console.log('[ChatRoom] Joining room:', roomId);
        const socketData = await socketService.joinRoom(roomId);
        if (!socketData?.room) {
          throw new Error('Failed to join room');
        }

        // Update state
        if (mounted) {
          setRoom({
            ...roomData,
            onlineMembers: socketData.room.onlineMembers || roomData.onlineMembers || []
          });
          setMessages(socketData.messages || []);
          setupSocketListeners();
        }
      } catch (error) {
        console.error('Error loading room:', error);
        
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to load room');
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : 'Failed to load room'
          });
          
          // Retry logic
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            console.log(`Retrying in ${delay}ms...`);
            setTimeout(loadRoomData, delay);
            return;
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadRoomData();

    return () => {
      mounted = false;
      if (roomId) {
        socketService.leaveRoom(roomId).catch(console.error);
      }
    };
  }, [roomId, setupSocketListeners]);

  // Set user role based on room data
  useEffect(() => {
    if (room && room.onlineMembers) {
      const currentUserId = localStorage.getItem('userId');
      if (currentUserId) {
        const userMember = room.onlineMembers.find(m => m.id === currentUserId);
        if (userMember?.role === 'admin' || userMember?.role === 'moderator') {
          setUserRole(userMember.role);
        }
      }
    }
  }, [room]);

  // In ChatRoom.tsx, add reconnection handling
useEffect(() => {
  const handleDisconnect = () => {
    console.log('Socket disconnected, attempting to reconnect...');
    // Add visual feedback to user
    toast({
      title: "Connection Lost",
      description: "Reconnecting..."
    });
  };

  const handleReconnect = () => {
    toast({
      title: "Reconnected!",
      description: "Connection restored successfully"
    });
    // Rejoin room if needed
    if (roomId) {
      socketService.joinRoom(roomId).catch(console.error);
    }
  };

  socketService.on('disconnect', handleDisconnect);
  socketService.on('reconnect', handleReconnect);

  return () => {
    socketService.off('disconnect', handleDisconnect);
    socketService.off('reconnect', handleReconnect);
  };
}, [roomId]); // Remove toast from dependencies as it's stable

  // Message handlers
  const handleSendMessage = useCallback((content: string, replyToId?: string) => {
    if (!roomId) return;
    socketService.sendMessage(roomId, content, 'text', replyToId);
    setReplyTo(null);
  }, [roomId]);

  const handleReply = useCallback((message: Message) => {
    setReplyTo(message);
  }, []);

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    socketService.addReaction(messageId, emoji);
  }, []);

  const handleTypingStart = useCallback(() => {
    if (roomId) {
      socketService.startTyping(roomId);
    }
  }, [roomId]);

  const handleTypingStop = useCallback(() => {
    if (roomId) {
      socketService.stopTyping(roomId);
    }
  }, [roomId]);

  // Moderation handlers
  const handleDeleteMessage = useCallback((message: Message) => {
    socketService.deleteMessage(message.id);
  }, []);

  const handleReportMessage = useCallback((message: Message) => {
    setModerationDialog({
      type: 'report',
      isOpen: true,
      messageId: message.id
    });
  }, []);

  const handleModerateMessage = useCallback((message: Message) => {
    setModerationDialog({
      type: 'moderate',
      isOpen: true,
      messageId: message.id
    });
  }, []);

  const handleModerationSubmit = useCallback((reason: string, details: string = '') => {
    if (!moderationDialog.messageId) return;

    if (moderationDialog.type === 'report') {
      socketService.reportMessage(moderationDialog.messageId, reason, details);
    } else {
      socketService.moderateMessage(moderationDialog.messageId, reason);
    }

    setModerationDialog(prev => ({ ...prev, isOpen: false }));
  }, [moderationDialog.messageId, moderationDialog.type]);

  const handlePinMessage = useCallback((message: Message) => {
    socketService.togglePinMessage(message.id);
  }, []);

  const handleBack = useCallback(() => {
    navigate('/chat');
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p>Loading chat room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={handleBack}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="mb-4">Room not found</p>
          <Button onClick={handleBack}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold">{room.name}</h1>
              <Badge variant={room.type === 'private' ? 'default' : 'secondary'}>
                {room.type === 'private' && <Crown className="h-3 w-3 mr-1" />}
                {room.type}
              </Badge>
            </div>
            
            {room.description && (
              <p className="text-sm text-muted-foreground">{room.description}</p>
            )}
            
            {room.destination && (
              <p className="text-sm text-muted-foreground">
                📍 {room.destination.city ? `${room.destination.city}, ` : ''}{room.destination.country}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{room.onlineMembers?.length || 0}/{room.memberCount}</span>
            </div>
            
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              currentUserId={localStorage.getItem('userId') || ''}
              onReply={handleReply}
              onReaction={handleReaction}
              onDelete={handleDeleteMessage}
              onReport={handleReportMessage}
              onModerate={handleModerateMessage}
              onPin={handlePinMessage}
              userRole={userRole}
              isPinned={pinnedMessages.includes(message.id)}
            />
          ))}
          
          {typingUsers.length > 0 && (
            <TypingIndicator users={typingUsers} />
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <ChatInput
          onSendMessage={handleSendMessage}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          placeholder={`Message ${room.name}...`}
        />
      </div>

      {/* Moderation Dialog */}
      <ModerationDialog
        isOpen={moderationDialog.isOpen}
        onClose={() => setModerationDialog(prev => ({ ...prev, isOpen: false }))}
        onSubmit={handleModerationSubmit}
        type={moderationDialog.type}
      />
    </div>
  );
};

export default ChatRoom;