import { Server } from 'socket.io';
import socketAuth from './socketAuth.js';
import SocketHandlers from './socketHandlers.js';

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Initialize socket handlers
  const socketHandlers = new SocketHandlers(io);

  // Authentication middleware
  io.use(socketAuth);

  // Handle connections
  io.on('connection', (socket) => {
    socketHandlers.handleConnection(socket);
  });

  io.on('disconnect', (socket) => {
    socketHandlers.handleDisconnection(socket);
  });

  // Make socket handlers available globally
  global.socketHandlers = socketHandlers;
  global.io = io;

  console.log('Socket.IO initialized');
  return io;
};

export default initializeSocket;