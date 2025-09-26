export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isOnline?: boolean;
}

export interface Message {
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
  isModerated?: boolean;
  moderatedBy?: User;
  moderationReason?: string;
}

export interface RoomData {
  name: string;
  description?: string;
  type: 'public' | 'private' | 'travel_partner';
  destination?: {
    country: string;
    city?: string;
    region?: string;
  };
}

export interface Room extends RoomData {
  id: string;
  creator: User;
  members: User[];
  moderators: User[];
  memberCount: number;
  onlineMembers?: User[];
  isArchived?: boolean;
  lastActivity: string;
  pinnedMessages?: string[];
  bannedUsers?: string[];
  createdAt: string;
  updatedAt: string;
}