import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { toNodeHandler } from 'better-auth/node';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import groupRoutes from './routes/groups.js';
import pageRoutes from './routes/pages.js';
import marketplaceRoutes from './routes/marketplace.js';
import adRoutes from './routes/ads.js';
import uploadRoutes from './routes/upload.js';
import conversationRoutes from './routes/conversations.js';
import notificationRoutes from './routes/notifications.js';
import statusRoutes from './routes/status.js';
import recommendationRoutes from './routes/recommendations.js';
import storyRoutes from './routes/stories.js';
import backgroundJobManager from './services/BackgroundJobManager.js';
import initializeSocket from './socket/index.js';

// Import middleware
import errorHandler from './middleware/errorHandler.js';
// import initializeSocket from '../socket/index.js';

import { initAuth, getAuth } from './config/auth.js';

import { connectDB } from './config/database.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

await connectDB()
await initAuth(); // <--- wait for DB, then setup Better Auth

const auth = getAuth();

// Initialize Socket.IO
initializeSocket(server);

// Initialize background jobs
backgroundJobManager.init();

app.set('trust proxy', true);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.all("/api/auth/*", toNodeHandler(auth));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization
app.use(mongoSanitize());

// Compression and logging
app.use(compression());
app.use(morgan('combined'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/stories', storyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Social Networking API is running',
    timestamp: new Date().toISOString(),
    socketConnections: global.socketHandlers ? global.socketHandlers.getOnlineUsers().length : 0,
    architecture: 'MVC Pattern'
  });
});

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for connections`);
  console.log(`🧠 Recommendation engine initialized`);
  console.log(`🏗️  Architecture: MVC Pattern`);
  console.log(`📁 Controllers: Organized business logic`);
  console.log(`🛣️  Routes: Clean API endpoints`);
  console.log(`📊 Models: Data layer with Mongoose`);
});

export default app;