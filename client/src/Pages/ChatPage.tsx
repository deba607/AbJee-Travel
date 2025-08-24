import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageCircle, 
  Plus, 
  Search, 
  Users, 
  Crown, 
  MapPin,
  Filter,
  Settings
} from 'lucide-react';
import { chatAPI } from '@/lib/api';
import socketService from '@/lib/socket';
import Header from '@/components/mvpblocks/header-1';
import { useAuth } from '@/contexts/AuthContext';

interface Room {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'travel_partner';
  memberCount: number;
  onlineCount?: number;
  lastMessage?: {
    content: string;
    createdAt: string;
  };
  lastActivity: string;
  destination?: {
    country: string;
    city?: string;
  };
  avatar?: string;
  isMember: boolean;
  canAccess: boolean;
}

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('public');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const { currentUser } = useAuth();

  // Check if we're in a specific room
  const isInRoom = location.pathname.includes('/chat/room/');

  useEffect(() => {
    initializeChat();
    loadRooms();
  }, [activeTab]);

  useEffect(() => {
    // Extract room ID from URL
    const roomMatch = location.pathname.match(/\/chat\/room\/(.+)/);
    if (roomMatch) {
      setSelectedRoom(roomMatch[1]);
    } else {
      setSelectedRoom(null);
    }
  }, [location.pathname]);

  const initializeChat = async () => {
    try {
      if (!currentUser) {
        // Allow viewing chat page without authentication
        // Users will need to login to participate in chats
        console.log('No user authenticated. Users can view but not participate in chats.');
        return;
      }

      // Get Firebase ID token for backend authentication
      const token = await currentUser.getIdToken();

      if (!socketService.isConnected()) {
        await socketService.connect(token);
      }
    } catch (error) {
      console.error('Failed to initialize chat:', error);
    }
  };

  const loadRooms = async () => {
    try {
      setLoading(true);

      if (!currentUser) {
        // Show demo/placeholder rooms for unauthenticated users
        setRooms([
          {
            id: 'demo-1',
            name: 'General Travel Chat',
            description: 'General discussion about travel experiences',
            type: 'public' as const,
            memberCount: 15,
            onlineCount: 3,
            lastActivity: new Date().toISOString(),
            canAccess: false,
            isMember: false
          },
          {
            id: 'demo-2',
            name: 'Europe Backpackers',
            description: 'Connect with fellow backpackers exploring Europe',
            type: 'public' as const,
            memberCount: 28,
            onlineCount: 7,
            lastActivity: new Date().toISOString(),
            canAccess: false,
            isMember: false
          }
        ]);
        return;
      }

      const response = await chatAPI.getRooms({
        type: activeTab,
        page: 1,
        limit: 50
      });

      setRooms(response.data.data.rooms);
    } catch (error) {
      console.error('Failed to load rooms:', error);
      // Show error message or fallback content
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRoomClick = (room: Room) => {
    if (!currentUser) {
      // Show login prompt for unauthenticated users
      alert('Please login to join chat rooms. Click "Get Started" to create an account or login.');
      return;
    }

    if (!room.canAccess) {
      // Show upgrade modal or message
      alert('This feature requires a subscription upgrade');
      return;
    }

    navigate(`/chat/room/${room.id}`);
  };

  const handleCreateRoom = () => {
    // Navigate to create room page or open modal
    navigate('/chat/create-room');
  };

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.destination?.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.destination?.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatLastActivity = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`;
    }
  };

  const RoomList = () => (
    <div className="space-y-2">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No chat rooms found</p>
          {activeTab === 'public' && (
            <Button variant="outline" className="mt-4" onClick={handleCreateRoom}>
              Create a Room
            </Button>
          )}
        </div>
      ) : (
        filteredRooms.map((room) => (
          <div
            key={room.id}
            onClick={() => handleRoomClick(room)}
            className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
              selectedRoom === room.id ? 'bg-muted border-primary' : ''
            } ${!room.canAccess ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={room.avatar} />
                <AvatarFallback>
                  {room.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{room.name}</h3>
                  <div className="flex items-center gap-1">
                    {room.type === 'private' && (
                      <Badge variant="default" className="text-xs">
                        <Crown className="h-3 w-3 mr-1" />
                        Pro
                      </Badge>
                    )}
                    {room.destination && (
                      <Badge variant="secondary" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {room.destination.city || room.destination.country}
                      </Badge>
                    )}
                  </div>
                </div>

                {room.description && (
                  <p className="text-sm text-muted-foreground truncate mb-1">
                    {room.description}
                  </p>
                )}

                {room.lastMessage && (
                  <p className="text-sm text-muted-foreground truncate mb-1">
                    {room.lastMessage.content}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    <span>{room.onlineCount || 0}/{room.memberCount}</span>
                  </div>
                  <span>{formatLastActivity(room.lastActivity)}</span>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  if (isInRoom) {
    return (
      <div className="h-screen flex">
        {/* Sidebar - hidden on mobile when in room */}
        <div className="hidden lg:block w-80 border-r bg-background">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-semibold">Chat</h1>
              <Button size="sm" onClick={handleCreateRoom}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-3 m-4">
              <TabsTrigger value="public">Public</TabsTrigger>
              <TabsTrigger value="private">Private</TabsTrigger>
              <TabsTrigger value="travel_partner">Travel</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="p-4 pt-0">
                <RoomList />
              </div>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation Header */}
      <Header />

      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-2">
            <div className="text-center flex-1">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Community Chat</h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Connect with fellow travelers and find your perfect travel companions
              </p>
            </div>
            <Button
              onClick={handleCreateRoom}
              className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2 rounded-lg font-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Room
            </Button>
          </div>

          {/* Login prompt for unauthenticated users */}
          {!currentUser && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Join the Community!</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Login or create an account to participate in chat rooms and connect with fellow travelers.
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/auth')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Get Started
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 max-w-6xl">

        {/* Search and Filter Section */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-80 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Button variant="outline" className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>

        {/* Tabs Section */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <TabsTrigger
              value="public"
              className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Public Rooms
            </TabsTrigger>
            <TabsTrigger
              value="private"
              className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white"
            >
              <Crown className="h-4 w-4 mr-2" />
              Private Rooms
            </TabsTrigger>
            <TabsTrigger
              value="travel_partner"
              className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Travel Partners
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 bg-muted rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded mb-2"></div>
                        <div className="h-3 bg-muted rounded w-2/3"></div>
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                ))
              ) : filteredRooms.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No rooms found</h3>
                  <p className="text-muted-foreground mb-4">
                    {activeTab === 'public' 
                      ? "Be the first to create a public chat room!"
                      : activeTab === 'private'
                      ? "Upgrade to Pro to access private chat rooms"
                      : "No travel partner rooms available"
                    }
                  </p>
                  {activeTab === 'public' && (
                    <Button onClick={handleCreateRoom}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Room
                    </Button>
                  )}
                </div>
              ) : (
                filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => handleRoomClick(room)}
                    className={`group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 hover:-translate-y-1 ${
                      !room.canAccess ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Room Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                          {room.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {room.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {room.type === 'private' && (
                              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-xs px-2 py-1">
                                <Crown className="h-3 w-3 mr-1" />
                                Pro
                              </Badge>
                            )}
                            {room.destination && (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs px-2 py-1">
                                <MapPin className="h-3 w-3 mr-1" />
                                {room.destination.city || room.destination.country}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Room Description */}
                    {room.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                        {room.description}
                      </p>
                    )}

                    {/* Room Stats */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">{room.memberCount}</span>
                          <span>members</span>
                        </div>
                        {room.onlineCount !== undefined && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-green-600 dark:text-green-400 font-medium text-sm">
                              {room.onlineCount} online
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatLastActivity(room.lastActivity)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ChatPage;
