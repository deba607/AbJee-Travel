import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

interface TypingIndicatorProps {
  users: User[];
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ users }) => {
  if (users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].firstName} is typing...`;
    } else if (users.length === 2) {
      return `${users[0].firstName} and ${users[1].firstName} are typing...`;
    } else {
      return `${users[0].firstName} and ${users.length - 1} others are typing...`;
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 text-sm text-muted-foreground">
      <div className="flex -space-x-2">
        {users.slice(0, 3).map((user) => (
          <Avatar key={user.id} className="h-6 w-6 border-2 border-background">
            <AvatarImage src={user.avatar} />
            <AvatarFallback className="text-xs">
              {user.firstName[0]}{user.lastName[0]}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      
      <div className="flex items-center gap-2">
        <span>{getTypingText()}</span>
        <div className="flex space-x-1">
          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
