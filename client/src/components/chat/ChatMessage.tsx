import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, Reply, MoreHorizontal } from 'lucide-react';

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isOnline?: boolean;
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

interface ChatMessageProps {
  message: Message;
  currentUserId: string;
  onReply?: (message: Message) => void;
  onReaction?: (messageId: string, emoji: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  currentUserId,
  onReply,
  onReaction
}) => {
  const isOwnMessage = message.sender.id === currentUserId;
  const timeAgo = formatDistanceToNow(new Date(message.createdAt), { addSuffix: true });

  const handleReaction = (emoji: string) => {
    if (onReaction) {
      onReaction(message.id, emoji);
    }
  };

  const handleReply = () => {
    if (onReply) {
      onReply(message);
    }
  };

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted px-3 py-1 rounded-full text-sm text-muted-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 p-3 hover:bg-muted/50 group ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={message.sender.avatar} />
        <AvatarFallback>
          {message.sender.firstName[0]}{message.sender.lastName[0]}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div className={`flex-1 min-w-0 ${isOwnMessage ? 'text-right' : ''}`}>
        {/* Header */}
        <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
          <span className="font-medium text-sm">
            {message.sender.firstName} {message.sender.lastName}
          </span>
          <span className="text-xs text-muted-foreground">
            {timeAgo}
          </span>
          {message.sender.isOnline && (
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          )}
        </div>

        {/* Reply Reference */}
        {message.replyTo && (
          <div className={`mb-2 p-2 border-l-2 border-primary/20 bg-muted/30 rounded text-sm ${isOwnMessage ? 'text-right border-r-2 border-l-0' : ''}`}>
            <div className="font-medium text-xs text-muted-foreground">
              Replying to {message.replyTo.sender.firstName}
            </div>
            <div className="truncate">
              {message.replyTo.content}
            </div>
          </div>
        )}

        {/* Message Content */}
        <div className={`${isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted'} rounded-lg px-3 py-2 inline-block max-w-[70%]`}>
          {message.type === 'travel_request' ? (
            <div className="space-y-2">
              <div className="font-medium">🧳 Travel Partner Request</div>
              <div className="text-sm">{message.content}</div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          )}
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.reduce((acc: any[], reaction) => {
              const existing = acc.find(r => r.emoji === reaction.emoji);
              if (existing) {
                existing.count++;
                existing.users.push(reaction.user);
              } else {
                acc.push({
                  emoji: reaction.emoji,
                  count: 1,
                  users: [reaction.user]
                });
              }
              return acc;
            }, []).map((reaction, index) => (
              <button
                key={index}
                onClick={() => handleReaction(reaction.emoji)}
                className="flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/80 rounded-full text-xs"
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Message Actions */}
        <div className={`opacity-0 group-hover:opacity-100 transition-opacity mt-1 ${isOwnMessage ? 'text-right' : ''}`}>
          <div className="flex gap-1 text-xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReaction('❤️')}
              className="h-6 px-2"
            >
              <Heart className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReply}
              className="h-6 px-2"
            >
              <Reply className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
