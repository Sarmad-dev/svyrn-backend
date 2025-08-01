# Social Networking API

A comprehensive Node.js social networking API built with Express.js, MongoDB, Socket.IO, and better-auth.

## Features

### 🔐 Authentication & User Management
- User registration with email verification
- JWT-based authentication
- Profile management with privacy settings
- Follow/unfollow system
- Password reset functionality

### 📝 Post Management
- Create, read, update, delete posts
- Support for text, images, and videos
- Privacy settings (public, friends, private)
- Post sharing and reactions
- Pagination and sorting

### 💬 Interactive Features
- Comment system with nested replies (3 levels)
- Multiple reaction types (like, love, wow, etc.)
- Real-time interactions
- Comment editing and deletion

### 👥 Groups
- Create and manage groups
- Role-based permissions (admin, moderator, member)
- Group privacy settings
- Join requests and approval system

### 📄 Pages
- Business/fan page creation
- Page analytics and insights
- Role management
- Content scheduling

### 🛒 Marketplace
- Product listing creation
- Advanced search and filtering
- Category management
- Order tracking system

### 📊 Advertising
- Ad campaign creation
- Audience targeting
- Performance metrics
- Budget management

### 💬 Messaging System
- Direct messaging between users
- Group conversations with admin controls
- Real-time message delivery and read receipts
- Message reactions with emoji support
- Message editing and deletion
- Media sharing (images, videos, audio, documents)
- Location sharing
- Disappearing messages
- Message search and pagination
- Participant management for group chats

### 🔔 Real-time Features
- **Socket.IO Integration**: Real-time messaging and notifications
- **Online Status**: Live user presence tracking
- **Typing Indicators**: Real-time typing status in conversations
- **Push Notifications**: Instant notifications for all activities
- **Live Updates**: Real-time post reactions, comments, and interactions
- **User Sessions**: Multi-device session management
- **Status Broadcasting**: Online/offline status updates to contacts

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO for WebSocket connections
- **Authentication**: better-auth with MongoDB adapter
- **Validation**: Joi
- **File Upload**: Multer with Sharp for image processing
- **Security**: Helmet, CORS, rate limiting
- **Documentation**: OpenAPI/Swagger ready

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local or cloud)

### Installation

1. Clone and install dependencies:
```bash
npm install
```

2. Environment setup:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users/search` - Search users
- `PUT /api/users/profile` - Update profile
- `POST /api/users/:id/follow` - Follow user
- `DELETE /api/users/:id/unfollow` - Unfollow user
- `GET /api/users/:id` - Get user profile

### Posts
- `POST /api/posts` - Create post
- `GET /api/posts/feed` - Get user feed
- `GET /api/posts/:id` - Get specific post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/react` - React to post
- `POST /api/posts/:id/comments` - Add comment

### Groups
- `POST /api/groups` - Create group
- `GET /api/groups` - Browse groups
- `GET /api/groups/:id` - Get group details
- `POST /api/groups/:id/join` - Join group
- `DELETE /api/groups/:id/leave` - Leave group

### Pages
- `POST /api/pages` - Create page
- `GET /api/pages` - Browse pages
- `GET /api/pages/:id` - Get page details
- `POST /api/pages/:id/follow` - Follow page
- `GET /api/pages/:id/analytics` - Page analytics

### Marketplace
- `POST /api/marketplace/products` - List product
- `GET /api/marketplace/products` - Browse products
- `GET /api/marketplace/products/:id` - Product details
- `PUT /api/marketplace/products/:id` - Update listing
- `POST /api/marketplace/products/:id/interest` - Show interest
- `GET /api/marketplace/categories` - Get categories

### Advertising
- `POST /api/ads` - Create ad campaign
- `GET /api/ads` - Get campaigns
- `GET /api/ads/:id` - Campaign details
- `PUT /api/ads/:id` - Update campaign
- `PATCH /api/ads/:id/status` - Update status
- `GET /api/ads/:id/performance` - Performance metrics

### Conversations & Messaging
- `POST /api/conversations` - Create conversation
- `GET /api/conversations` - Get user conversations
- `GET /api/conversations/:id` - Get conversation details
- `POST /api/conversations/:id/messages` - Send message
- `GET /api/conversations/:id/messages` - Get messages
- `PUT /api/conversations/:conversationId/messages/:messageId` - Edit message
- `DELETE /api/conversations/:conversationId/messages/:messageId` - Delete message
- `POST /api/conversations/:conversationId/messages/:messageId/react` - React to message
- `POST /api/conversations/:id/participants` - Add participants
- `DELETE /api/conversations/:id/participants/:userId` - Remove participant

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification
- `GET /api/notifications/unread-count` - Get unread count

### Status & Presence
- `GET /api/status/online-users` - Get online users
- `GET /api/status/user/:id` - Get user status
- `PUT /api/status/update` - Update status
- `GET /api/status/sessions` - Get user sessions

### File Upload
- `POST /api/upload/image` - Upload image
- `POST /api/upload/video` - Upload video
- `POST /api/upload/multiple` - Upload multiple files

## Real-time Events (Socket.IO)

### Connection Events
- `connection` - User connects
- `disconnect` - User disconnects
- `user_status_change` - User status updates

### Messaging Events
- `send_message` - Send message
- `new_message` - Receive message
- `message_read` - Message read receipt
- `typing_start` - User starts typing
- `typing_stop` - User stops typing
- `user_typing` - Typing indicator

### Notification Events
- `new_notification` - New notification received
- `notification_read` - Notification marked as read
- `pending_notifications` - Pending notifications on connect

### Conversation Events
- `join_conversation` - Join conversation room
- `leave_conversation` - Leave conversation room
- `conversation_joined` - Confirmation of joining
- `conversation_left` - Confirmation of leaving

### Call Events (Future Implementation)
- `call_user` - Initiate call
- `incoming_call` - Receive call
- `call_response` - Accept/decline call
- `call_ended` - Call terminated

## Messaging Features

### Direct Messages
- One-on-one conversations between users
- Automatic conversation creation when messaging
- Message delivery and read receipts
- Real-time status updates

### Group Conversations
- Multi-participant group chats
- Admin and member roles
- Participant management (add/remove)
- Group settings and permissions

### Message Types
- **Text Messages**: Standard text communication
- **Media Messages**: Images, videos, audio files, documents
- **Location Messages**: Share current location
- **System Messages**: Automated notifications

### Advanced Features
- **Message Reactions**: React with emojis
- **Message Editing**: Edit sent messages (15-minute window)
- **Message Deletion**: Delete messages
- **Reply System**: Reply to specific messages
- **Disappearing Messages**: Auto-delete after set time
- **Read Receipts**: Track message delivery and read status
- **Unread Counts**: Track unread messages per conversation
- **Message Search**: Search through conversation history

## Real-time Features

### Online Presence
- **Live Status Tracking**: Real-time online/offline status
- **Multi-device Support**: Track sessions across devices
- **Status Broadcasting**: Notify contacts of status changes
- **Last Seen**: Track when users were last active

### Instant Notifications
- **Real-time Delivery**: Instant notification delivery
- **Push Notifications**: Background notifications for offline users
- **Notification Types**: Likes, comments, follows, messages, mentions
- **Priority Levels**: Different priority levels for notifications

### Live Messaging
- **Instant Delivery**: Real-time message delivery
- **Typing Indicators**: Show when users are typing
- **Read Receipts**: Real-time read status updates
- **Message Reactions**: Live emoji reactions

## Security Features

- JWT token authentication
- Socket.IO authentication middleware
- Password hashing with bcrypt
- Rate limiting
- Input validation and sanitization
- CORS protection
- Helmet security headers
- MongoDB injection prevention
- Real-time session management

## Data Models

The API includes comprehensive data models for:
- Users with privacy settings
- Posts with media support
- Comments with nested structure
- Groups with role management
- Pages with analytics
- Products with marketplace features
- Ads with targeting options
- Conversations with participant management
- Messages with rich content support
- Notifications with real-time delivery
- User sessions with presence tracking

## Socket.IO Client Usage

### Connection
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Sending Messages
```javascript
socket.emit('send_message', {
  conversationId: 'conversation-id',
  content: {
    text: 'Hello world!'
  },
  type: 'text'
});
```

### Receiving Messages
```javascript
socket.on('new_message', (data) => {
  console.log('New message:', data.message);
});
```

### Typing Indicators
```javascript
// Start typing
socket.emit('typing_start', { conversationId: 'conversation-id' });

// Stop typing
socket.emit('typing_stop', { conversationId: 'conversation-id' });

// Listen for typing
socket.on('user_typing', (data) => {
  console.log(`User ${data.userId} is typing: ${data.isTyping}`);
});
```

### Status Updates
```javascript
// Update status
socket.emit('status_change', { status: 'away' });

// Listen for status changes
socket.on('user_status_change', (data) => {
  console.log(`User ${data.userId} is now ${data.status}`);
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.