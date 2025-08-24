# ABjee Travel - Community Chat & Travel Partner Platform

ABjee Travel is a comprehensive travel platform that connects travelers through community chat rooms and helps them find travel partners. The platform features real-time messaging, travel partner matching, and subscription-based premium features.

## 🌟 Features

### Community Chat
- **Public Chat Rooms**: Join destination-specific and topic-based chat rooms
- **Private Chat Rooms**: Exclusive chat rooms for subscription users
- **Real-time Messaging**: Instant messaging with typing indicators and user presence
- **Message Reactions**: React to messages with emojis
- **Reply System**: Reply to specific messages in conversations

### Travel Partner Matching
- **Create Travel Requests**: Post detailed travel plans to find companions
- **Smart Matching**: Find travel partners based on destination, dates, and preferences
- **Response System**: Respond to travel requests and connect with potential partners
- **Advanced Filters**: Filter by destination, travel style, budget, and interests

### Subscription System
- **Free Tier**: Basic access to public chat rooms and limited travel requests
- **Pro Tier**: Access to private chat rooms and enhanced features
- **Premium Tier**: Unlimited access to all features with priority support

### User Management
- **User Authentication**: Secure JWT-based authentication
- **Profile Management**: Customizable user profiles with travel interests
- **Online Status**: Real-time user presence indicators

## 🛠 Technology Stack

### Backend
- **Node.js** with Express.js
- **Socket.IO** for real-time communication
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **bcryptjs** for password hashing

### Frontend
- **React 19** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **Socket.IO Client** for real-time features
- **React Router** for navigation

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local or cloud instance)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ABjee
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Environment Setup**

   Create `.env` file in the server directory:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/abjee-travel
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=7d
   CLIENT_URL=http://localhost:5173
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   MAX_FILE_SIZE=5242880
   UPLOAD_PATH=uploads/
   SOCKET_CORS_ORIGIN=http://localhost:5173
   ```

   Create `.env` file in the client directory:
   ```env
   VITE_SERVER_URL=http://localhost:5000
   ```

4. **Database Setup**

   Make sure MongoDB is running, then set up demo data:
   ```bash
   cd server
   node src/scripts/setupDemo.js
   ```

5. **Start the Application**

   Start the backend server:
   ```bash
   cd server
   npm run dev
   ```

   Start the frontend development server:
   ```bash
   cd client
   npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - Socket.IO: ws://localhost:5000

## 📁 Project Structure

```
ABjee/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── chat/       # Chat-specific components
│   │   │   ├── subscription/ # Subscription components
│   │   │   └── ui/         # Base UI components
│   │   ├── lib/            # Utilities and API clients
│   │   ├── Pages/          # Page components
│   │   └── App.tsx         # Main app component
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── config/         # Database and app configuration
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # API routes
│   │   ├── scripts/        # Utility scripts
│   │   ├── socket/         # Socket.IO handlers
│   │   └── server.js       # Main server file
│   └── package.json
└── README.md
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Chat
- `GET /api/chat/rooms` - Get chat rooms
- `POST /api/chat/rooms` - Create chat room
- `GET /api/chat/rooms/:id` - Get room details
- `GET /api/chat/rooms/:id/messages` - Get room messages
- `POST /api/chat/rooms/:id/join` - Join room
- `POST /api/chat/rooms/:id/leave` - Leave room

### Travel Partners
- `GET /api/travel-partners/requests` - Get travel requests
- `POST /api/travel-partners/requests` - Create travel request
- `GET /api/travel-partners/requests/:id` - Get specific request
- `POST /api/travel-partners/requests/:id/respond` - Respond to request
- `GET /api/travel-partners/my-requests` - Get user's requests

### Subscriptions
- `GET /api/subscriptions/plans` - Get subscription plans
- `GET /api/subscriptions/current` - Get current subscription
- `POST /api/subscriptions/upgrade` - Upgrade subscription
- `POST /api/subscriptions/cancel` - Cancel subscription

## 🔌 Socket.IO Events

### Client to Server
- `join_room` - Join a chat room
- `leave_room` - Leave a chat room
- `send_message` - Send a message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `add_reaction` - Add reaction to message
- `get_rooms` - Get available rooms

### Server to Client
- `room_joined` - Successfully joined room
- `room_left` - Successfully left room
- `new_message` - New message received
- `user_joined_room` - User joined room
- `user_left_room` - User left room
- `user_typing` - User is typing
- `user_stopped_typing` - User stopped typing
- `user_status_change` - User online/offline status
- `reaction_added` - Reaction added to message
- `rooms_list` - List of available rooms

## 🧪 Testing

Run tests for the backend:
```bash
cd server
npm test
```

Run tests for the frontend:
```bash
cd client
npm test
```

## 🚀 Deployment

### Backend Deployment
1. Set production environment variables
2. Build the application: `npm run build`
3. Start with PM2: `pm2 start src/server.js`

### Frontend Deployment
1. Build the application: `npm run build`
2. Deploy the `dist` folder to your hosting service

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Email: support@abjee.com
- Create an issue in the repository
- Join our community chat for help

## 🗺 Roadmap

- [ ] Mobile app development
- [ ] Video chat integration
- [ ] Advanced travel planning tools
- [ ] Integration with booking platforms
- [ ] Multi-language support
- [ ] Push notifications
- [ ] Travel blog integration
