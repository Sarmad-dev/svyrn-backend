import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import UserSession from "../models/UserSession.js";
import User from "../models/User.js";
import NotificationHelper from "./../utils/notificationHelper.js";

class SocketHandlers {
  constructor(io) {
    this.io = io;
    this.onlineUsers = new Map(); // userId -> Set of socketIds
  }

  // Handle user connection
  async handleConnection(socket) {
    try {
      const userId = socket.userId;
      console.log(`User ${userId} connected with socket ${socket.id}`);

      // Add to online users
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId).add(socket.id);

      // Create or update user session
      await this.createUserSession(socket);

      // Join user to their personal room
      socket.join(`user:${userId}`);

      // Join user to their conversation rooms
      await this.joinUserConversations(socket);

      // Broadcast user online status
      await this.broadcastUserStatus(userId, "online");

      // Send pending notifications
      await this.sendPendingNotifications(socket);

      // Set up event handlers
      this.setupEventHandlers(socket);
    } catch (error) {
      console.error("Connection error:", error);
      socket.emit("error", { message: "Connection failed" });
    }
  }

  // Handle user disconnection
  async handleDisconnection(socket) {
    try {
      const userId = socket.userId;
      console.log(`User ${userId} disconnected from socket ${socket.id}`);

      // Remove from online users
      if (this.onlineUsers.has(userId)) {
        this.onlineUsers.get(userId).delete(socket.id);

        // If no more sockets for this user, mark as offline
        if (this.onlineUsers.get(userId).size === 0) {
          this.onlineUsers.delete(userId);
          await this.broadcastUserStatus(userId, "offline");
        }
      }

      // Update user session
      await this.updateUserSession(socket, false);
    } catch (error) {
      console.error("Disconnection error:", error);
    }
  }

  // Create user session
  async createUserSession(socket) {
    try {
      const sessionData = {
        socketId: socket.id,
        status: "online",
        isActive: true,
        lastSeen: new Date(),
        token: socket.handshake.auth.token,
        userAgent: socket.handshake.headers["user-agent"],
        ipAddress: socket.handshake.address,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      // Check if a session already exists for this user
      const existingSession = await UserSession.findOne({
        userId: socket.userId,
      });

      if (existingSession) {
        // Update the existing session
        await UserSession.updateOne({ userId: socket.userId }, sessionData);
      } else {
        // Create a new session
        await UserSession.create({
          userId: socket.userId,
          ...sessionData,
        });
      }
    } catch (error) {
      console.error("Error creating or updating user session:", error);
    }
  }

  // Update user session
  async updateUserSession(socket, isActive = true) {
    try {
      await UserSession.findOneAndUpdate(
        { socketId: socket.id },
        {
          lastSeen: new Date(),
          isActive,
          status: isActive ? "online" : "offline",
        }
      );
    } catch (error) {
      console.error("Error updating user session:", error);
    }
  }

  // Join user to their conversation rooms
  async joinUserConversations(socket) {
    try {
      const conversations = await Conversation.find({
        "participants.user": socket.userId,
        "participants.isActive": true,
        isActive: true,
      }).select("_id");

      conversations.forEach((conv) => {
        socket.join(`conversation:${conv._id}`);
      });
    } catch (error) {
      console.error("Error joining conversations:", error);
    }
  }

  // Broadcast user online status
  async broadcastUserStatus(userId, status) {
    try {
      // Get user's friends/followers to notify
      const user = await User.findById(userId)
        .populate("followers", "_id")
        .populate("following", "_id");

      const contactIds = [
        ...user.followers.map((f) => f._id.toString()),
        ...user.following.map((f) => f._id.toString()),
      ];

      // Broadcast to contacts
      contactIds.forEach((contactId) => {
        this.io.to(`user:${contactId}`).emit("user_status_change", {
          userId,
          status,
          timestamp: new Date(),
        });
      });
    } catch (error) {
      console.error("Error broadcasting user status:", error);
    }
  }

  // Send pending notifications
  async sendPendingNotifications(socket) {
    try {
      const notifications = await Notification.find({
        recipient: socket.userId,
        isRead: false,
        isActive: true,
      })
        .populate("sender", "firstName lastName profilePicture")
        .sort({ createdAt: -1 })
        .limit(50);

      if (notifications.length > 0) {
        socket.emit("pending_notifications", {
          notifications,
          count: notifications.length,
        });
      }
    } catch (error) {
      console.error("Error sending pending notifications:", error);
    }
  }

  // Setup event handlers for socket
  setupEventHandlers(socket) {
    console.log("Triggered setup event handlers: ", socket.userId);
    // Message events
    socket.on("send_message", (data) => this.handleSendMessage(socket, data));
    socket.on("message_read", (data) => this.handleMessageRead(socket, data));
    socket.on("typing_start", (data) => this.handleTypingStart(socket, data));
    socket.on("typing_stop", (data) => this.handleTypingStop(socket, data));

    // Conversation events
    socket.on("join_conversation", (data) =>
      this.handleJoinConversation(socket, data)
    );
    socket.on("leave_conversation", (data) =>
      this.handleLeaveConversation(socket, data)
    );

    // Status events
    socket.on("status_change", (data) => this.handleStatusChange(socket, data));

    // Notification events
    socket.on("mark_notification_read", (data) =>
      this.handleMarkNotificationRead(socket, data)
    );
    socket.on("mark_all_notifications_read", () =>
      this.handleMarkAllNotificationsRead(socket)
    );

    // Call events (for future video/voice calls)
    socket.on("call_user", (data) => this.handleCallUser(socket, data));
    socket.on("call_response", (data) => this.handleCallResponse(socket, data));
    socket.on("call_end", (data) => this.handleCallEnd(socket, data));

    // Disconnect handler
    socket.on("disconnect", () => this.handleDisconnection(socket));
  }

  // Handle send message
  async handleSendMessage(socket, data) {
    try {
      const { conversationId, content, type = "text", replyTo } = data;

      // Validate conversation access
      const conversation = await Conversation.findById(conversationId);
      if (
        !conversation ||
        !conversation.participants.some(
          (p) => p.user.toString() === socket.userId
        )
      ) {
        socket.emit("error", { message: "Access denied to conversation" });
        return;
      }

      // Create message (this would typically go through the API route)
      const messageData = {
        conversation: conversationId,
        sender: socket.userId,
        content,
        type,
        replyTo,
      };

      const message = await Message.create(messageData);
      await message.populate("sender", "name username profilePicture");

      if (replyTo) {
        await message.populate("replyTo", "content sender");
      }

      // Update conversation
      conversation.lastMessage = message._id;
      conversation.lastActivity = new Date();

      // Update unread counts
      conversation.participants.forEach((participant) => {
        if (
          participant.user.toString() !== socket.userId &&
          participant.isActive
        ) {
          participant.unreadCount += 1;
        }
      });

      await conversation.save();

      // Emit to conversation room
      this.io.to(`conversation:${conversationId}`).emit("new_message", {
        message,
        conversationId,
      });

      // Send push notifications to offline users
      await this.sendMessageNotifications(message, conversation);

      // Also use NotificationHelper for consistent notification creation
      const offlineParticipants = conversation.participants.filter(
        (p) =>
          p.user.toString() !== socket.userId &&
          p.isActive &&
          !this.onlineUsers.has(p.user.toString())
      );

      for (const participant of offlineParticipants) {
        await NotificationHelper.notifyMessage(
          conversationId,
          message._id,
          socket.userId,
          participant.user
        );
      }
    } catch (error) {
      console.error("Error handling send message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  }

  // Handle message read
  async handleMessageRead(socket, data) {
    try {
      const { messageId, conversationId } = data;

      const message = await Message.findById(messageId);
      if (!message) return;

      // Mark as read
      if (!message.isReadBy(socket.userId)) {
        message.markAsRead(socket.userId);
        await message.save();

        // Emit read receipt to conversation
        this.io.to(`conversation:${conversationId}`).emit("message_read", {
          messageId,
          userId: socket.userId,
          readAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Error handling message read:", error);
    }
  }

  // Handle typing indicators
  async handleTypingStart(socket, data) {
    const { conversationId } = data;
    const user = await User.findById(socket.userId);
    socket.to(`conversation:${conversationId}`).emit("user_typing", {
      name: user.name,
      username: user.username,
      profilePicture: user.profilePicture,
      userId: socket.userId,
      conversationId,
      isTyping: true,
    });
  }

  async handleTypingStop(socket, data) {
    const { conversationId } = data;
    socket.to(`conversation:${conversationId}`).emit("user_typing", {
      userId: socket.userId,
      conversationId,
      isTyping: false,
    });
  }

  // Handle join conversation
  async handleJoinConversation(socket, data) {
    const { conversationId } = data;
    console.log("Triggered join conversation");
    // Validate access
    const conversation = await Conversation.findById(conversationId);
    if (
      conversation &&
      conversation.participants.some((p) => p.user.toString() === socket.userId)
    ) {
      socket.join(`conversation:${conversationId}`);
      socket.emit("conversation_joined", { conversationId });
    }
  }

  // Handle leave conversation
  async handleLeaveConversation(socket, data) {
    const { conversationId } = data;
    socket.leave(`conversation:${conversationId}`);
    socket.emit("conversation_left", { conversationId });
  }

  // Handle status change
  async handleStatusChange(socket, data) {
    try {
      const { status } = data;
      const validStatuses = ["online", "away", "busy", "offline"];

      if (!validStatuses.includes(status)) return;

      // Update user session
      await UserSession.findOneAndUpdate(
        { socketId: socket.id },
        { status, lastSeen: new Date() }
      );

      // Broadcast status change
      await this.broadcastUserStatus(socket.userId, status);
    } catch (error) {
      console.error("Error handling status change:", error);
    }
  }

  // Handle mark notification as read
  async handleMarkNotificationRead(socket, data) {
    try {
      const { notificationId } = data;

      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: socket.userId },
        { isRead: true, readAt: new Date() },
        { new: true }
      );

      if (notification) {
        socket.emit("notification_read", { notificationId });
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  // Handle mark all notifications as read
  async handleMarkAllNotificationsRead(socket) {
    try {
      await Notification.updateMany(
        { recipient: socket.userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );

      socket.emit("all_notifications_read");
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }

  // Handle call user (for future implementation)
  async handleCallUser(socket, data) {
    const { userId, type = "voice" } = data;

    this.io.to(`user:${userId}`).emit("incoming_call", {
      from: socket.userId,
      type,
      callId: data.callId,
    });
  }

  // Handle call response
  async handleCallResponse(socket, data) {
    const { callId, accepted, userId } = data;

    this.io.to(`user:${userId}`).emit("call_response", {
      callId,
      accepted,
      from: socket.userId,
    });
  }

  // Handle call end
  async handleCallEnd(socket, data) {
    const { callId, userId } = data;

    this.io.to(`user:${userId}`).emit("call_ended", {
      callId,
      from: socket.userId,
    });
  }

  // Send message notifications to offline users
  async sendMessageNotifications(message, conversation) {
    try {
      const offlineParticipants = conversation.participants.filter(
        (p) =>
          p.user.toString() !== message.sender.toString() &&
          p.isActive &&
          !this.onlineUsers.has(p.user.toString())
      );

      for (const participant of offlineParticipants) {
        await Notification.create({
          recipient: participant.user,
          sender: message.sender,
          type: "message",
          title: "New Message",
          message: `You have a new message`,
          data: {
            conversationId: conversation._id,
            messageId: message._id,
          },
        });
      }
    } catch (error) {
      console.error("Error sending message notifications:", error);
    }
  }

  // Get online users
  getOnlineUsers() {
    return Array.from(this.onlineUsers.keys());
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }

  // Send notification to user
  async sendNotificationToUser(userId, notification) {
    try {
      // Save to database
      const savedNotification = await Notification.create(notification);
      await savedNotification.populate(
        "sender",
        "firstName lastName profilePicture"
      );

      // Send to online user
      this.io.to(`user:${userId}`).emit("new_notification", savedNotification);

      return savedNotification;
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }
}

export default SocketHandlers;
