import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { validationResult } from "express-validator";
import NotificationHelper from "./../utils/notificationHelper.js";

// @desc    Create a new conversation
// @route   POST /api/conversations
// @access  Private
export const createConversation = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { type, participants, name, description } = req.body;

    // Validate participants exist
    const users = await User.find({
      _id: { $in: participants },
      isActive: true,
    });

    if (users.length !== participants.length) {
      return res.status(400).json({
        status: "error",
        message: "One or more participants not found",
      });
    }

    // For direct conversations, check if conversation already exists
    if (type === "direct") {
      if (participants.length !== 1) {
        return res.status(400).json({
          status: "error",
          message:
            "Direct conversation must have exactly one other participant",
        });
      }

      const existingConversation = await Conversation.findOne({
        type: "direct",
        "participants.user": { $all: [req.user.id, participants[0]] },
        isActive: true,
      });

      if (existingConversation) {
        return res.status(200).json({
          status: "success",
          message: "Conversation already exists",
          data: { conversation: existingConversation },
        });
      }
    }

    // Create conversation participants array
    const conversationParticipants = [
      {
        user: req.user.id,
        role: type === "group" ? "admin" : "member",
      },
      ...participants.map((userId) => ({
        user: userId,
        role: "member",
      })),
    ];

    const conversation = await Conversation.create({
      type,
      participants: conversationParticipants,
      name: type === "group" ? name : undefined,
      description,
    });

    await conversation.populate(
      "participants.user",
      "name username profilePicture"
    );

    res.status(201).json({
      status: "success",
      message: "Conversation created successfully",
      data: { conversation },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error creating conversation",
      error: error.message,
    });
  }
};

// @desc    Get user's conversations
// @route   GET /api/conversations
// @access  Private
export const getConversations = async (req, res) => {
  try {
    const { limit = 20, page = 1, type } = req.query;
    const skip = (page - 1) * limit;

    let query = {
      "participants.user": req.user.id,
      "participants.isActive": true,
      isActive: true,
    };

    if (type) {
      query.type = type;
    }

    const conversations = await Conversation.find(query)
      .populate(
        "participants.user",
        "name username profilePicture isVerified _id"
      )
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "name username profilePicture createdAt",
        },
      })
      .sort({ lastActivity: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Conversation.countDocuments(query);

    // Add unread count for each conversation
    const conversationsWithUnread = conversations.map((conv) => {
      const participant = conv.participants.find(
        (p) => p.user.toString() === req.user.id.toString()
      );
      return {
        ...conv.toObject(),
        unreadCount: participant ? participant.unreadCount : 0,
      };
    });

    res.status(200).json({
      status: "success",
      data: {
        conversations: conversationsWithUnread,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching conversations",
      error: error.message,
    });
  }
};

// @desc    Get conversation details
// @route   GET /api/conversations/:id
// @access  Private
export const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate("participants.user", "name username profilePicture isVerified")
      .populate("lastMessage");

    if (!conversation || !conversation.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Conversation not found",
      });
    }

    const isMember = conversation.participants.find(
      (participant) =>
        participant.user._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        status: "error",
        message: "Access denied",
      });
    }

    res.status(200).json({
      status: "success",
      data: { conversation },
    });
  } catch (error) {
    console.log("Error: ", error);
    res.status(500).json({
      status: "error",
      message: "Error fetching conversation",
      error: error.message,
    });
  }
};

// @desc    Send a message
// @route   POST /api/conversations/:id/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { content, type = "text", replyTo } = req.body;

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Conversation not found",
      });
    }

    if (!conversation.isParticipant(req.user.id)) {
      return res.status(403).json({
        status: "error",
        message: "You are not a participant in this conversation",
      });
    }

    // Validate reply message exists
    if (replyTo) {
      const replyMessage = await Message.findOne({
        _id: replyTo,
        conversation: req.params.id,
        isDeleted: false,
      });

      if (!replyMessage) {
        return res.status(404).json({
          status: "error",
          message: "Reply message not found",
        });
      }
    }

    // Create message
    const messageData = {
      conversation: req.params.id,
      sender: req.user._id,
      content,
      type,
      replyTo,
    };

    // Set expiration for disappearing messages
    if (conversation.settings.disappearingMessages.enabled) {
      const expirationTime = new Date();
      expirationTime.setHours(
        expirationTime.getHours() +
          conversation.settings.disappearingMessages.duration
      );
      messageData.expiresAt = expirationTime;
    }

    const message = await Message.create(messageData);
    await message.populate("sender", "name username profilePicture");

    if (replyTo) {
      await message.populate("replyTo", "content sender");
    }

    // Update conversation last message and activity
    conversation.lastMessage = message._id;
    conversation.lastActivity = new Date();

    // Update unread counts for other participants
    conversation.participants.forEach((participant) => {
      if (
        participant.user.toString() !== req.user.id.toString() &&
        participant.isActive
      ) {
        participant.unreadCount += 1;
      }
    });

    await conversation.save();

    // Send message notifications to offline participants
    const offlineParticipants = conversation.participants.filter(
      (p) =>
        p.user.toString() !== req.user.id.toString() &&
        p.isActive &&
        (!global.socketHandlers ||
          !global.socketHandlers.isUserOnline(p.user.toString()))
    );

    for (const participant of offlineParticipants) {
      await NotificationHelper.notifyMessage(
        req.params.id,
        message._id,
        req.user.id,
        participant.user
      );
    }

    res.status(201).json({
      status: "success",
      message: "Message sent successfully",
      data: { message },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error sending message",
      error: error.message,
    });
  }
};

// @desc    Get conversation messages
// @route   GET /api/conversations/:id/messages
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const { limit = 50, page = 1, before } = req.query;
    const skip = (page - 1) * limit;

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Conversation not found",
      });
    }

    if (!conversation.isParticipant(req.user.id)) {
      return res.status(403).json({
        status: "error",
        message: "Access denied",
      });
    }

    let query = {
      conversation: req.params.id,
      isDeleted: false,
    };

    // For pagination with cursor (before timestamp)
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate("sender", "name username profilePicture")
      .populate("replyTo", "content sender")
      .populate("reactions.user", "name username profilePicture")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Message.countDocuments({
      conversation: req.params.id,
      isDeleted: false,
    });

    // Mark messages as read
    const unreadMessages = messages.filter(
      (msg) =>
        !msg.isReadBy(req.user.id) &&
        msg.sender.toString() !== req.user.id.toString()
    );

    for (const message of unreadMessages) {
      message.markAsRead(req.user.id);
      await message.save();
    }

    // Reset unread count for user
    const participant = conversation.getParticipant(req.user.id);
    if (participant) {
      participant.unreadCount = 0;
      participant.lastSeen = new Date();
      await conversation.save();
    }

    console.log("Messages: ", messages);

    res.status(200).json({
      status: "success",
      data: {
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
          hasMore: skip + messages.length < total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching messages",
      error: error.message,
    });
  }
};

// @desc    Edit a message
// @route   PUT /api/conversations/:conversationId/messages/:messageId
// @access  Private
export const editMessage = async (req, res) => {
  try {
    const { content } = req.body;

    const message = await Message.findOne({
      _id: req.params.messageId,
      conversation: req.params.conversationId,
      isDeleted: false,
    });

    if (!message) {
      return res.status(404).json({
        status: "error",
        message: "Message not found",
      });
    }

    if (message.sender.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You can only edit your own messages",
      });
    }

    // Check if message is too old to edit (15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.createdAt < fifteenMinutesAgo) {
      return res.status(400).json({
        status: "error",
        message: "Message is too old to edit",
      });
    }

    // Save edit history
    if (message.content.text !== content.text) {
      message.editHistory.push({
        content: message.content.text,
        editedAt: new Date(),
      });
      message.isEdited = true;
    }

    message.content = content;
    await message.save();

    await message.populate("sender", "firstName lastName profilePicture");

    res.status(200).json({
      status: "success",
      message: "Message updated successfully",
      data: { message },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error updating message",
      error: error.message,
    });
  }
};

// @desc    Delete a message
// @route   DELETE /api/conversations/:conversationId/messages/:messageId
// @access  Private
export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.messageId,
      conversation: req.params.conversationId,
    });

    if (!message) {
      return res.status(404).json({
        status: "error",
        message: "Message not found",
      });
    }

    if (message.sender.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You can only delete your own messages",
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    res.status(200).json({
      status: "success",
      message: "Message deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error deleting message",
      error: error.message,
    });
  }
};

// @desc    React to a message
// @route   POST /api/conversations/:conversationId/messages/:messageId/react
// @access  Private
export const reactToMessage = async (req, res) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        status: "error",
        message: "Emoji is required",
      });
    }

    const message = await Message.findOne({
      _id: req.params.messageId,
      conversation: req.params.conversationId,
      isDeleted: false,
    });

    if (!message) {
      return res.status(404).json({
        status: "error",
        message: "Message not found",
      });
    }

    // Check if user already reacted
    const existingReaction = message.reactions.find(
      (reaction) => reaction.user.toString() === req.user.id.toString()
    );

    if (existingReaction) {
      if (existingReaction.emoji === emoji) {
        // Remove reaction if same emoji
        message.reactions = message.reactions.filter(
          (reaction) => reaction.user.toString() !== req.user.id.toString()
        );
      } else {
        // Update reaction
        existingReaction.emoji = emoji;
        existingReaction.createdAt = new Date();
      }
    } else {
      // Add new reaction
      message.reactions.push({
        user: req.user.id,
        emoji,
        createdAt: new Date(),
      });
    }

    await message.save();

    // Send reaction notification to message author (if not self-reaction)
    if (message.sender.toString() !== req.user.id.toString()) {
      await NotificationHelper.notifyReaction(
        req.params.messageId,
        req.params.conversationId,
        req.user.id,
        message.sender
      );
    }

    res.status(200).json({
      status: "success",
      message: "Reaction updated successfully",
      data: {
        reactionsCount: message.reactionsCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error updating reaction",
      error: error.message,
    });
  }
};

// @desc    Add participants to group conversation
// @route   POST /api/conversations/:id/participants
// @access  Private
export const addParticipants = async (req, res) => {
  try {
    const { participants } = req.body;

    if (
      !participants ||
      !Array.isArray(participants) ||
      participants.length === 0
    ) {
      return res.status(400).json({
        status: "error",
        message: "Participants array is required",
      });
    }

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Conversation not found",
      });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({
        status: "error",
        message: "Can only add participants to group conversations",
      });
    }

    const userParticipant = conversation.getParticipant(req.user.id);
    if (!userParticipant || !userParticipant.isActive) {
      return res.status(403).json({
        status: "error",
        message: "You are not a participant in this conversation",
      });
    }

    // Check permissions
    if (
      !conversation.settings.allowMemberInvites &&
      userParticipant.role !== "admin"
    ) {
      return res.status(403).json({
        status: "error",
        message: "Only admins can add participants",
      });
    }

    // Validate new participants
    const users = await User.find({
      _id: { $in: participants },
      isActive: true,
    });

    if (users.length !== participants.length) {
      return res.status(400).json({
        status: "error",
        message: "One or more users not found",
      });
    }

    // Add new participants
    const newParticipants = participants.filter(
      (userId) =>
        !conversation.participants.some((p) => p.user.toString() === userId)
    );

    newParticipants.forEach((userId) => {
      conversation.participants.push({
        user: userId,
        role: "member",
        joinedAt: new Date(),
      });
    });

    await conversation.save();
    await conversation.populate(
      "participants.user",
      "firstName lastName profilePicture"
    );

    res.status(200).json({
      status: "success",
      message: "Participants added successfully",
      data: { conversation },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error adding participants",
      error: error.message,
    });
  }
};

// @desc    Remove participant from group conversation
// @route   DELETE /api/conversations/:id/participants/:userId
// @access  Private
export const removeParticipant = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Conversation not found",
      });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({
        status: "error",
        message: "Can only remove participants from group conversations",
      });
    }

    const userParticipant = conversation.getParticipant(req.user.id);
    const targetParticipant = conversation.getParticipant(req.params.userId);

    if (!userParticipant || !userParticipant.isActive) {
      return res.status(403).json({
        status: "error",
        message: "You are not a participant in this conversation",
      });
    }

    if (!targetParticipant) {
      return res.status(404).json({
        status: "error",
        message: "User is not a participant",
      });
    }

    // Check permissions
    const isSelfLeaving = req.params.userId === req.user.id.toString();
    const isAdminRemoving = userParticipant.role === "admin" && !isSelfLeaving;

    if (!isSelfLeaving && !isAdminRemoving) {
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    // Update participant status
    targetParticipant.isActive = false;
    targetParticipant.leftAt = new Date();

    await conversation.save();

    res.status(200).json({
      status: "success",
      message: isSelfLeaving
        ? "Left conversation successfully"
        : "Participant removed successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error removing participant",
      error: error.message,
    });
  }
};
