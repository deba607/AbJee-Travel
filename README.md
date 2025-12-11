
# ABjee Travel

New A modern travel community platform with real-time chat functionality, built with React, Node.js, Socket.IO, and Firebase.

## 🚀 Features

### Chat System
- **Real-time messaging** with Socket.IO
- **Multiple room types**: Public, Private (subscription-based), Travel Partner
- **Rich messaging features**:
  - Message reactions (emoji)
  - Reply to messages
  - Typing indicators
  - Online/offline status
  - Message moderation
  - Pin messages
  - Report messages
- **User roles**: User, Moderator, Admin
- **Destination-based rooms** for travel planning

### Authentication
- Firebase Authentication
- Email/Password login
- Google OAuth
- JWT token-based API authentication

### Subscription System
- Free tier (public rooms only)
- Pro/Premium tiers (private rooms access)

## 📁 Project Structure

```
AbJee-Travel/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/      # Chat components
│   │   │   ├── ui/        # Reusable UI components
│   │   │   └── ...
│   │   ├── contexts/      # React contexts (Auth, etc.)
│   │   ├── lib/           # Utilities (API, Socket, Firebase)
│   │   ├── Pages/         # Page components
│   │   └── types/         # TypeScript types
│   └── package.json
│
└── server/                # Node.js backend
    ├── src/
    │   ├── config/        # Configuration (Firebase, Database)
    │   ├── middleware/    # Auth, validation, error handling
    │   ├── models/        # Firestore service classes
    │   ├── routes/        # Express routes
    │   └── socket/        # Socket.IO handlers
    └── package.json
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase project with:
  - Authentication enabled (Email/Password, Google)
  - Firestore database
  - Service account credentials

### 1. Firebase Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication**:
   - Email/Password provider
   - Google provider
4. Enable **Firestore Database**
5. Create a **Service Account**:
   - Project Settings → Service Accounts
   - Generate new private key
   - Save as `firebase-service-account.json` in `server/` directory

#### Get Firebase Config
1. Project Settings → General → Your apps
2. Add a web app
3. Copy the config object

### 2. Backend Setup

```bash
cd server
npm install
```

#### Configure Firebase Admin

Place your `firebase-service-account.json` in the `server/` directory:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

#### Start Server

```bash
npm run dev
```

Server will run on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd client
npm install
```

#### Create Environment File

Create `client/.env` with your Firebase config:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
VITE_SERVER_URL=http://localhost:5000
```

#### Start Client

```bash
npm run dev
```

Client will run on `http://localhost:5173`

## 🔧 Recent Fixes Applied

### Backend Fixes
1. **Fixed `canAccessPrivateChat` method calls** - Changed from `req.user.canAccessPrivateChat()` to `userService.canAccessPrivateChat(req.user)`
2. **Fixed inconsistent user ID references** - Standardized to use `user.id` instead of mixing `user.id` and `user._id`
3. **Removed duplicate route file** - `chat-rooms.js` was unused (only `chat.js` is active)

### Client Fixes
1. **Fixed AuthContext token refresh** - Removed comma operator error in `setTokenRefreshCallback`

## 🎯 How to Use the Chat

### For Users

1. **Sign Up/Login**
   - Navigate to `/auth`
   - Create account or login with email/password or Google

2. **Browse Chat Rooms**
   - Go to `/chat`
   - View public, private, or travel partner rooms
   - Search and filter rooms

3. **Join a Room**
   - Click on any room card
   - Start chatting immediately

4. **Send Messages**
   - Type in the input box
   - Press Enter or click Send
   - Use Shift+Enter for new lines

5. **Interact with Messages**
   - React with emojis
   - Reply to specific messages
   - Report inappropriate content

### For Moderators/Admins

- Delete messages
- Moderate content
- Pin important messages
- View reports

## 🐛 Troubleshooting

### Socket Connection Issues

**Problem**: "Authentication error" or socket not connecting

**Solutions**:
1. Check Firebase token is valid:
   ```javascript
   // In browser console
   localStorage.getItem('token')
   ```
2. Verify server is running on port 5000
3. Check CORS settings in `server/src/server.js`
4. Ensure Firebase Admin SDK is properly initialized

### Messages Not Sending

**Problem**: Messages don't appear after sending

**Solutions**:
1. Check browser console for errors
2. Verify you've joined the room (socket event `join_room`)
3. Check server logs for socket errors
4. Ensure Firestore has proper permissions

### User Not Found Errors

**Problem**: "No user found" or authentication failures

**Solutions**:
1. User is auto-created on first login via `socketAuth.js` and `auth.js` middleware
2. Check Firebase Admin SDK can access Firestore
3. Verify service account has Firestore permissions

### Private Rooms Access Denied

**Problem**: Can't access private rooms

**Solutions**:
1. Private rooms require active subscription
2. Update user's subscription in Firestore:
   ```javascript
   // In Firestore console, update user document:
   {
     subscription: {
       type: 'pro',  // or 'premium'
       isActive: true,
       startDate: <timestamp>,
       endDate: <future timestamp>
     }
   }
   ```

## 📡 API Endpoints

### Chat Routes (`/api/chat`)

- `GET /rooms` - Get chat rooms (with filters)
- `POST /rooms` - Create new room
- `GET /rooms/:roomId` - Get room details
- `GET /rooms/:roomId/messages` - Get room messages
- `POST /rooms/:roomId/join` - Join a room
- `POST /rooms/:roomId/leave` - Leave a room

### Auth Routes (`/api/auth`)

- `GET /me` - Get current user profile

### User Routes (`/api/users`)

- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile

## 🔌 Socket.IO Events

### Client → Server

- `join_room` - Join a chat room
- `leave_room` - Leave a chat room
- `send_message` - Send a message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `add_reaction` - Add emoji reaction
- `delete_message` - Delete message (moderator)
- `report_message` - Report message
- `moderate_message` - Moderate message (moderator)
- `toggle_pin_message` - Pin/unpin message (moderator)

### Server → Client

- `room_joined` - Successfully joined room
- `new_message` - New message received
- `user_joined_room` - User joined the room
- `user_left_room` - User left the room
- `user_typing` - User is typing
- `user_stopped_typing` - User stopped typing
- `user_status_change` - User online/offline status
- `reaction_added` - Reaction added to message
- `message_deleted` - Message was deleted
- `message_moderated` - Message was moderated
- `message_pin_toggled` - Message pin status changed
- `error` - Error occurred

## 🔐 Security Features

- Firebase Authentication for user identity
- JWT token verification on all API requests
- Socket.IO authentication middleware
- Rate limiting on API and socket events
- Input validation and sanitization
- Role-based access control (RBAC)
- Content moderation system

## 📝 Development Notes

### Database Schema (Firestore)

**Collections**:

1. **users**
   - User profiles and settings
   - Subscription information
   - Online status

2. **chatRooms**
   - Room metadata
   - Members list with roles
   - Room settings

3. **messages**
   - Message content
   - Sender information
   - Reactions, replies
   - Moderation status

### Tech Stack

**Frontend**:
- React 19
- TypeScript
- Vite
- TailwindCSS
- Radix UI
- Socket.IO Client
- Firebase SDK
- React Router
- Axios

**Backend**:
- Node.js
- Express
- Socket.IO
- Firebase Admin SDK
- Firestore
- express-validator
- helmet (security)
- cors

## 📄 License

MIT

## 👥 Support

For issues or questions, please check the troubleshooting section above or create an issue in the repository.
