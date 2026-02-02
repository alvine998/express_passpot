const { Conversation, Message, User, sequelize } = require("../models");
const { success, error } = require("../utils/responseHelper");
const { sendPushNotification } = require("../services/notificationService");
const { uploadToR2 } = require("../services/storageService");

// Get all conversations for current user
exports.getConversations = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: Conversation,
          include: [
            {
              model: User,
              attributes: ["id", "email", "displayName", "avatar"],
              through: { attributes: [] },
            },
            {
              model: Message,
              as: "lastMessage",
            },
          ],
        },
      ],
      order: [[Conversation, "updatedAt", "DESC"]],
    });

    return success(
      res,
      "Conversations retrieved successfully",
      user.Conversations || [],
    );
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Get messages for a specific conversation
exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;

  try {
    const messages = await Message.findAll({
      where: { conversationId },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "email", "displayName", "avatar"],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    return success(res, "Messages retrieved successfully", messages);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Create a new conversation
exports.createConversation = async (req, res) => {
  const { participantCode } = req.body;

  try {
    const participant = await User.findOne({
      where: { userCode: participantCode },
    });
    if (!participant) return error(res, "User not found", 404);

    // Check if 1-on-1 conversation already exists
    // This is a bit more complex in SQL, we'll check if there's a conversation where both are participants
    const conversations = await Conversation.findAll({
      where: { isGroup: false },
      include: [
        {
          model: User,
          where: { id: [req.user.id, participant.id] },
        },
      ],
    });

    // Filter for conversations that have exactly these two participants
    let conversation = conversations.find(
      (c) =>
        c.Users.length === 2 &&
        c.Users.some((u) => u.id === req.user.id) &&
        c.Users.some((u) => u.id === participant.id),
    );

    if (!conversation) {
      conversation = await Conversation.create({ isGroup: false });
      await conversation.addUsers([req.user.id, participant.id]);
    }

    return success(res, "Conversation created successfully", conversation, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  console.log("sendMessage received body:", JSON.stringify(req.body));
  console.log(
    "sendMessage received file:",
    req.file ? req.file.originalname : "none",
  );

  let { conversationId, recipientId, recipientCode, participantCode, content } =
    req.body;
  const userCode = recipientCode || participantCode;

  const t = await sequelize.transaction();

  try {
    // 1. If conversationId is not provided, find or create it using recipientId or userCode
    if (!conversationId && (recipientId || userCode)) {
      const where = recipientId ? { id: recipientId } : { userCode };
      const participant = await User.findOne({ where });

      if (!participant) {
        await t.rollback();
        return error(res, "Recipient user not found", 404);
      }

      // Check for existing 1-on-1 conversation
      const conversations = await Conversation.findAll({
        where: { isGroup: false },
        include: [
          {
            model: User,
            where: { id: [req.user.id, participant.id] },
          },
        ],
      });

      let existingConv = conversations.find(
        (c) =>
          c.Users.length === 2 &&
          c.Users.some((u) => u.id === req.user.id) &&
          c.Users.some((u) => u.id === participant.id),
      );

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const newConv = await Conversation.create(
          { isGroup: false },
          { transaction: t },
        );
        await newConv.addUsers([req.user.id, participant.id], {
          transaction: t,
        });
        conversationId = newConv.id;
      }
    }

    if (!conversationId) {
      await t.rollback();
      return error(res, "conversationId or recipientCode is required", 400);
    }

    // Handle message type and content
    let { messageType } = req.body;
    let messageContent = content;

    // If file is uploaded, upload to R2 and use URL as content
    if (req.file) {
      try {
        const imageUrl = await uploadToR2(req.file);
        messageContent = imageUrl;
        messageType = req.file.mimetype.startsWith("image/") ? "image" : "file";
      } catch (uploadErr) {
        await t.rollback();
        return error(res, "Failed to upload file: " + uploadErr.message, 500);
      }
    }

    if (!messageContent) {
      await t.rollback();
      return error(res, "Message content or file is required", 400);
    }

    const message = await Message.create(
      {
        conversationId,
        senderId: req.user.id,
        content: messageContent,
        messageType: messageType || "text",
      },
      { transaction: t },
    );

    // Update last message in conversation
    await Conversation.update(
      {
        lastMessageId: message.id,
      },
      {
        where: { id: conversationId },
        transaction: t,
      },
    );

    await t.commit();

    // Trigger Real-time Socket Update
    const io = req.app.get("io");
    if (io) {
      console.log(`Broadcasting new_message to room: ${conversationId}`);
      io.to(conversationId.toString()).emit("new_message", {
        id: message.id,
        conversationId,
        senderId: req.user.id,
        content: messageContent,
        messageType: messageType || "text",
        createdAt: message.createdAt,
        sender: {
          id: req.user.id,
          displayName: req.user.displayName,
          avatar: req.user.avatar,
        },
      });
    } else {
      console.log("Socket.io instance not found!");
    }

    // Trigger Push Notification asynchronously
    try {
      const conversation = await Conversation.findByPk(conversationId, {
        include: [
          {
            model: User,
            attributes: ["id", "fcmToken", "displayName"],
            through: { attributes: [] },
          },
        ],
      });

      const recipient = conversation.Users.find((u) => u.id !== req.user.id);
      console.log(
        `Push notification - Recipient: ${recipient?.id}, FCM Token: ${recipient?.fcmToken ? "present" : "missing"}`,
      );

      if (recipient && recipient.fcmToken) {
        // Determine notification body based on message type
        let notificationBody = messageContent;
        if ((messageType || "text") === "image") {
          notificationBody = "📷 Sent an image";
        } else if ((messageType || "text") === "file") {
          notificationBody = "📎 Sent a file";
        } else if (messageContent && messageContent.length > 50) {
          notificationBody = messageContent.substring(0, 50) + "...";
        }

        await sendPushNotification(recipient.fcmToken, {
          title: `New message from ${req.user.userCode || "Friend"}`,
          body: "**********",
          data: {
            conversationId: conversationId.toString(),
            type: "CHAT",
          },
        });
        console.log("Push notification sent successfully");
      } else {
        console.log(
          "Skipping push notification - no recipient or no FCM token",
        );
      }
    } catch (pushErr) {
      console.error("Failed to send push notification:", pushErr);
    }

    return success(res, "Message sent successfully", message, 201);
  } catch (err) {
    await t.rollback();
    return error(res, err.message, 500);
  }
};
