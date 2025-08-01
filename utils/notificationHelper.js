import Notification from '../models/Notification.js';

class NotificationHelper {
  // Create and send notification
  static async createNotification({
    recipient,
    sender,
    type,
    title,
    message,
    data = {},
    priority = 'medium'
  }) {
    try {
      const notification = await Notification.create({
        recipient,
        sender,
        type,
        title,
        message,
        data,
        priority
      });

      await notification.populate('sender', 'firstName lastName profilePicture');

      // Send via socket if user is online
      if (global.socketHandlers) {
        global.socketHandlers.sendNotificationToUser(recipient, notification);
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Notification templates
  static async notifyLike(postId, likedBy, postAuthor) {
    if (likedBy.toString() === postAuthor.toString()) return;

    return this.createNotification({
      recipient: postAuthor,
      sender: likedBy,
      type: 'like',
      title: 'New Like',
      message: 'liked your post',
      data: { postId }
    });
  }

  static async notifyComment(postId, commentId, commentBy, postAuthor) {
    if (commentBy.toString() === postAuthor.toString()) return;

    return this.createNotification({
      recipient: postAuthor,
      sender: commentBy,
      type: 'comment',
      title: 'New Comment',
      message: 'commented on your post',
      data: { postId, commentId }
    });
  }

  static async notifyFollow(followerId, followedId) {
    return this.createNotification({
      recipient: followedId,
      sender: followerId,
      type: 'follow',
      title: 'New Follower',
      message: 'started following you',
      data: {}
    });
  }

  static async notifyFriendRequest(senderId, recipientId) {
    return this.createNotification({
      recipient: recipientId,
      sender: senderId,
      type: 'friend_request',
      title: 'Friend Request',
      message: 'sent you a friend request',
      data: {},
      priority: 'high'
    });
  }

  static async notifyFriendAccept(accepterId, requesterId) {
    return this.createNotification({
      recipient: requesterId,
      sender: accepterId,
      type: 'friend_accept',
      title: 'Friend Request Accepted',
      message: 'accepted your friend request',
      data: {},
      priority: 'high'
    });
  }

  static async notifyGroupInvite(groupId, inviterId, invitedId) {
    return this.createNotification({
      recipient: invitedId,
      sender: inviterId,
      type: 'group_invite',
      title: 'Group Invitation',
      message: 'invited you to join a group',
      data: { groupId },
      priority: 'high'
    });
  }

  static async notifyMention(postId, mentionedBy, mentionedUser) {
    return this.createNotification({
      recipient: mentionedUser,
      sender: mentionedBy,
      type: 'mention',
      title: 'You were mentioned',
      message: 'mentioned you in a post',
      data: { postId },
      priority: 'high'
    });
  }

  static async notifyMessage(conversationId, messageId, senderId, recipientId) {
    return this.createNotification({
      recipient: recipientId,
      sender: senderId,
      type: 'message',
      title: 'New Message',
      message: 'sent you a message',
      data: { conversationId, messageId }
    });
  }

  static async notifyGroupJoin(groupId, joinerId, adminId, groupName) {
    return this.createNotification({
      recipient: adminId,
      sender: joinerId,
      type: 'group_join',
      title: 'New Group Member',
      message: `joined the group "${groupName}"`,
      data: { groupId }
    });
  }

  static async notifyPageFollow(pageId, followerId, pageOwnerId, pageName) {
    return this.createNotification({
      recipient: pageOwnerId,
      sender: followerId,
      type: 'page_follow',
      title: 'New Page Follower',
      message: `started following your page "${pageName}"`,
      data: { pageId }
    });
  }

  static async notifyProductInterest(productId, interestedUserId, sellerId, productTitle) {
    return this.createNotification({
      recipient: sellerId,
      sender: interestedUserId,
      type: 'system',
      title: 'Product Interest',
      message: `showed interest in your product "${productTitle}"`,
      data: { productId },
      priority: 'medium'
    });
  }

  static async notifyReaction(messageId, conversationId, reactedBy, messageAuthor) {
    if (reactedBy.toString() === messageAuthor.toString()) return;

    return this.createNotification({
      recipient: messageAuthor,
      sender: reactedBy,
      type: 'reaction',
      title: 'Message Reaction',
      message: 'reacted to your message',
      data: { messageId, conversationId }
    });
  }

  static async notifyStoryView(storyId, viewerId, storyAuthor) {
    return this.createNotification({
      recipient: storyAuthor,
      sender: viewerId,
      type: 'system',
      title: 'Story View',
      message: 'viewed your story',
      data: { storyId },
      priority: 'low'
    });
  }
}

export default NotificationHelper;