import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mock data for demo
const mockUsers = new Map();
const mockRooms = new Map();
const mockMessages = new Map();

// Initialize demo data
const initDemoData = () => {
  // Demo user
  const demoUser = {
    id: 'demo-user-1',
    username: 'demo_user',
    email: 'demo@abjee.com',
    firstName: 'Demo',
    lastName: 'User',
    avatar: null,
    subscription: { type: 'free', isActive: true }
  };
  mockUsers.set('demo@abjee.com', demoUser);

  // Demo rooms
  const demoRooms = [
    {
      id: 'room-1',
      name: 'General Travel Chat',
      description: 'General discussion about travel experiences',
      type: 'public',
      memberCount: 15,
      onlineCount: 3,
      destination: { country: 'Global', region: 'Worldwide' },
      lastActivity: new Date().toISOString(),
      canAccess: true,
      isMember: false
    },
    {
      id: 'room-2',
      name: 'Europe Backpackers',
      description: 'Connect with fellow backpackers exploring Europe',
      type: 'public',
      memberCount: 28,
      onlineCount: 7,
      destination: { country: 'Europe', region: 'Multiple Countries' },
      lastActivity: new Date().toISOString(),
      canAccess: true,
      isMember: false
    },
    {
      id: 'room-3',
      name: 'VIP Travel Lounge',
      description: 'Exclusive chat for premium travelers',
      type: 'private',
      memberCount: 8,
      onlineCount: 2,
      destination: { country: 'Global', region: 'Worldwide' },
      lastActivity: new Date().toISOString(),
      canAccess: false,
      isMember: false
    }
  ];

  demoRooms.forEach(room => mockRooms.set(room.id, room));
};

// Mock API routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'ABjee Travel Demo Server is running',
    timestamp: new Date().toISOString(),
    mode: 'DEMO - No Database Required'
  });
});

// Mock auth routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'demo@abjee.com' && password === 'demo123') {
    const user = mockUsers.get(email);
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token: 'demo-jwt-token-' + Date.now()
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials. Use demo@abjee.com / demo123'
    });
  }
});

app.post('/api/auth/register', (req, res) => {
  res.json({
    success: true,
    message: 'Registration successful (demo mode)',
    data: {
      user: mockUsers.get('demo@abjee.com'),
      token: 'demo-jwt-token-' + Date.now()
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({
    success: true,
    data: { user: mockUsers.get('demo@abjee.com') }
  });
});

// Mock chat routes
app.get('/api/chat/rooms', (req, res) => {
  const rooms = Array.from(mockRooms.values());
  res.json({
    success: true,
    data: {
      rooms,
      pagination: {
        page: 1,
        limit: 20,
        total: rooms.length,
        pages: 1,
        hasNext: false,
        hasPrev: false
      }
    }
  });
});

app.get('/api/chat/rooms/:roomId', (req, res) => {
  const room = mockRooms.get(req.params.roomId);
  if (room) {
    res.json({
      success: true,
      data: { room }
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Room not found'
    });
  }
});

// Mock subscription routes
app.get('/api/subscriptions/plans', (req, res) => {
  res.json({
    success: true,
    data: {
      plans: {
        free: {
          type: 'free',
          name: 'Free Plan',
          price: { amount: 0, currency: 'USD' }
        },
        pro: {
          type: 'pro',
          name: 'Pro Plan',
          price: { amount: 90, currency: 'USD', interval: 'monthly' }
        },
        premium: {
          type: 'premium',
          name: 'Premium Plan',
          price: { amount: 150, currency: 'USD', interval: 'monthly' }
        }
      }
    }
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Demo user connected: ${socket.id}`);
  
  socket.on('join_room', (data) => {
    const { roomId } = data;
    const room = mockRooms.get(roomId);
    
    if (room) {
      socket.join(roomId);
      socket.emit('room_joined', {
        success: true,
        room,
        messages: [
          {
            id: 'msg-1',
            content: 'Welcome to the demo chat room! This is a demonstration message.',
            type: 'system',
            sender: { id: 'system', firstName: 'System', lastName: '' },
            createdAt: new Date().toISOString()
          }
        ]
      });
    } else {
      socket.emit('error', { success: false, message: 'Room not found' });
    }
  });
  
  socket.on('send_message', (data) => {
    const { roomId, content } = data;
    const message = {
      id: 'msg-' + Date.now(),
      content,
      type: 'text',
      sender: mockUsers.get('demo@abjee.com'),
      createdAt: new Date().toISOString()
    };
    
    io.to(roomId).emit('new_message', message);
  });
  
  socket.on('get_rooms', () => {
    const rooms = Array.from(mockRooms.values());
    socket.emit('rooms_list', {
      success: true,
      rooms,
      pagination: { page: 1, limit: 20, hasMore: false }
    });
  });
  
  socket.on('disconnect', () => {
    console.log(`Demo user disconnected: ${socket.id}`);
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found (Demo Mode)' });
});

const PORT = process.env.PORT || 5000;

// Initialize demo data
initDemoData();

server.listen(PORT, () => {
  console.log(`🚀 ABjee Travel Demo Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'} (DEMO MODE)`);
  console.log(`📡 Socket.IO enabled with CORS origin: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
  console.log(`💡 Demo Login: demo@abjee.com / demo123`);
  console.log(`💡 This is a demo version - no database required!`);
});

export default app;
