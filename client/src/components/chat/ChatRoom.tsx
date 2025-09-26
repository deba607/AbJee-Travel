import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Users, Settings, Crown } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import ModerationDialog from './ModerationDialog';
import { chatAPI } from '@/lib/api';
import socketService from '@/lib/socket';

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isOnline?: boolean;
  role?: 'user' | 'moderator' | 'admin';
}

interface Message {
  id: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system' | 'travel_request';
  sender: User;
  createdAt: string;
  reactions?: Array<{
    user: User;
    emoji: string;
    createdAt: string;
  }>;
  replyTo?: {
    id: string;
    content: string;
    sender: User;
  };
}

interface Room {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'travel_partner';
  memberCount: number;
  onlineMembers?: User[];
  destination?: {
    country: string;
    city?: string;
    region?: string;
  };
}

const ChatRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<User[]>([]);
  const [userRole, setUserRole] = useState<'user' | 'moderator' | 'admin'>('user');
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([]);
  const [moderationDialog, setModerationDialog] = useState<{
    type: 'report' | 'moderate';
    isOpen: boolean;
    messageId: string | null;
  }>({
    type: 'report',
    isOpen: false,
    messageId: null
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!roomId) return;

    loadRoomData();
    setupSocketListeners();

    return () => {
      cleanupSocketListeners();
      if (roomId) {
        socketService.leaveRoom(roomId);
      }
    };
  }, [roomId]);

  // Set user role based on room data
  useEffect(() => {
    if (room && room.onlineMembers) {
      const userMember = room.onlineMembers.find(m => m.id === currentUser.id);
      if (userMember?.role === 'admin' || userMember?.role === 'moderator') {
        setUserRole(userMember.role);
      }
    }
  }, [room]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadRoomData = async () => {
    if (!roomId) return;

    try {
      setLoading(true);
      
      // Get room details
      const roomResponse = await chatAPI.getRoomDetails(roomId);
      const roomData = roomResponse.data.data.room;
      
      setRoom(roomData);

      // Join room via socket
      const socketData = await socketService.joinRoom(roomId);
      setMessages(socketData.messages || []);
      
      if (socketData.room.onlineMembers) {
        setRoom(prev => prev ? { ...prev, onlineMembers: socketData.room.onlineMembers } : null);
      }

    } catch (err: any) {
      console.error('Failed to load room:', err);
      setError(err.response?.data?.message || 'Failed to load chat room');
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    socketService.onNewMessage(handleNewMessage);
    socketService.onUserJoinedRoom(handleUserJoined);
    socketService.onUserLeftRoom(handleUserLeft);
    socketService.onUserTyping(handleUserTyping);
    socketService.onUserStoppedTyping(handleUserStoppedTyping);
    socketService.onUserStatusChange(handleUserStatusChange);
    socketService.onReactionAdded(handleReactionAdded);
    
    // Moderation event listeners
    socketService.onMessageDeleted(handleMessageDeleted);
    socketService.onMessageModerated(handleMessageModerated);
    socketService.onMessagePinToggled(handleMessagePinToggled);
    socketService.onNewReport(handleNewReport);
  };

  const cleanupSocketListeners = () => {
    socketService.off('new_message');
    socketService.off('user_joined_room');
    socketService.off('user_left_room');
    socketService.off('user_typing');
    socketService.off('user_stopped_typing');
    socketService.off('user_status_change');
    socketService.off('reaction_added');
    socketService.off('message_deleted');
    socketService.off('message_moderated');
    socketService.off('message_pin_toggled');
    socketService.off('new_report');
  };

  const handleNewMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const handleUserJoined = (data: any) => {
    setMessages(prev => [...prev, {
      id: `system-${Date.now()}`,
      content: `${data.user.firstName} ${data.user.lastName} joined the room`,
      type: 'system' as const,
      sender: data.user,
      createdAt: new Date().toISOString()
    }]);

    // Update online members
    setRoom(prev => {
      if (!prev) return prev;
      const onlineMembers = prev.onlineMembers || [];
      if (!onlineMembers.find(u => u.id === data.user.id)) {
        return { ...prev, onlineMembers: [...onlineMembers, data.user] };
      }
      return prev;
    });
  };

  const handleUserLeft = (data: any) => {
    setMessages(prev => [...prev, {
      id: `system-${Date.now()}`,
      content: `${data.user.username} left the room`,
      type: 'system' as const,
      sender: data.user,
      createdAt: new Date().toISOString()
    }]);

    // Update online members
    setRoom(prev => {
      if (!prev) return prev;
      const onlineMembers = (prev.onlineMembers || []).filter(u => u.id !== data.user.id);
      return { ...prev, onlineMembers };
    });
  };

  const handleUserTyping = (data: any) => {
    setTypingUsers(prev => {
      if (!prev.find(u => u.id === data.user.id)) {
        return [...prev, data.user];
      }
      return prev;
    });
  };

  const handleUserStoppedTyping = (data: any) => {
    setTypingUsers(prev => prev.filter(u => u.id !== data.user.id));
  };

  const handleUserStatusChange = (data: any) => {
    setRoom(prev => {
      if (!prev) return prev;
      const onlineMembers = prev.onlineMembers || [];
      
      if (data.status === 'online') {
        if (!onlineMembers.find(u => u.id === data.user.id)) {
          return { ...prev, onlineMembers: [...onlineMembers, data.user] };
        }
      } else {
        return { ...prev, onlineMembers: onlineMembers.filter(u => u.id !== data.user.id) };
      }
      
      return prev;
    });
  };

  const handleReactionAdded = (data: any) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === data.messageId) {
        const reactions = msg.reactions || [];
        const existingReaction = reactions.find(r => r.user.id === data.user.id);
        
        if (existingReaction) {
          // Update existing reaction
          return {
            ...msg,
            reactions: reactions.map(r => 
              r.user.id === data.user.id ? { ...r, emoji: data.emoji } : r
            )
          };
        } else {
          // Add new reaction
          return {
            ...msg,
            reactions: [...reactions, {
              user: data.user,
              emoji: data.emoji,
              createdAt: new Date().toISOString()
            }]
          };
        }
      }
      return msg;
    }));
  };

  const handleSendMessage = (content: string, replyToId?: string) => {
    if (!roomId) return;
    
    socketService.sendMessage(roomId, content, 'text', replyToId);
    setReplyTo(null);
  };

  const handleReply = (message: Message) => {
    setReplyTo(message);
  };

  const handleReaction = (messageId: string, emoji: string) => {
    socketService.addReaction(messageId, emoji);
  };

  const handleTypingStart = () => {
    if (roomId) {
      socketService.startTyping(roomId);
    }
  };

  const handleTypingStop = () => {
    if (roomId) {
      socketService.stopTyping(roomId);
    }
  };

  // Moderation handlers
  const handleMessageDeleted = (data: any) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, isDeleted: true, deletedBy: data.deletedBy }
          : msg
      )
    );
  };

  const handleMessageModerated = (data: any) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === data.messageId 
          ? { 
              ...msg, 
              isModerated: true, 
              moderatedBy: data.moderatedBy,
              moderationReason: data.reason,
              content: '[Message moderated]'
            }
          : msg
      )
    );
  };

  const handleMessagePinToggled = (data: any) => {
    if (data.isPinned) {
      setPinnedMessages(prev => [...prev, data.messageId]);
    } else {
      setPinnedMessages(prev => prev.filter(id => id !== data.messageId));
    }
  };

  const handleNewReport = (data: any) => {
    if (userRole === 'moderator' || userRole === 'admin') {
      // Show notification to moderators
      console.log('New report:', data);
      // TODO: Implement moderation notification UI
    }
  };

  // Message action handlers
  const handleDeleteMessage = (message: Message) => {
    socketService.deleteMessage(message.id);
  };

  const handleReportMessage = (message: Message) => {
    setModerationDialog({
      type: 'report',
      isOpen: true,
      messageId: message.id
    });
  };

  const handleModerateMessage = (message: Message) => {
    setModerationDialog({
      type: 'moderate',
      isOpen: true,
      messageId: message.id
    });
  };

  const handleModerationSubmit = (reason: string, details?: string) => {
    if (!moderationDialog.messageId) return;

    if (moderationDialog.type === 'report') {
      socketService.reportMessage(moderationDialog.messageId, reason, details);
    } else {
      socketService.moderateMessage(moderationDialog.messageId, reason);
    }

    setModerationDialog({
      type: 'report',
      isOpen: false,
      messageId: null
    });
  };

  const handlePinMessage = (message: Message) => {
    socketService.togglePinMessage(message.id);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleBack = () => {
    navigate('/chat');
  };

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
        <div className="space-y-1">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              currentUserId={currentUser.id}
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
      <ChatInput
        onSendMessage={handleSendMessage}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        placeholder={`Message ${room.name}...`}
      />

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
