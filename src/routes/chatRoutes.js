const express = require("express");
const router = express.Router();
const multer = require("multer");
const chatController = require("../controllers/chatController");
const { protect } = require("../middleware/authMiddleware");

const upload = multer({ storage: multer.memoryStorage() });

router.use(protect); // Protect all chat routes

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Messaging and conversations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         conversationId:
 *           type: integer
 *         senderId:
 *           type: integer
 *         content:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *     Conversation:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         isGroup:
 *           type: boolean
 *         lastMessageId:
 *           type: integer
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /chat/conversations:
 *   get:
 *     summary: Get all conversations for current user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Conversations retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Conversation'
 *                       - type: object
 *                         properties:
 *                           Users:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/UserProfile'
 *                           lastMessage:
 *                             $ref: '#/components/schemas/Message'
 */
router.get("/conversations", chatController.getConversations);

/**
 * @swagger
 * /chat/conversations:
 *   post:
 *     summary: Create or get existing conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantCode
 *             properties:
 *               participantCode:
 *                 type: string
 *                 example: A3B7X2
 *     responses:
 *       201:
 *         description: Conversation created/retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Conversation created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Conversation'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/conversations", chatController.createConversation);

/**
 * @swagger
 * /chat/messages/{conversationId}:
 *   get:
 *     summary: Get messages for a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of messages retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Messages retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Message'
 *                       - type: object
 *                         properties:
 *                           sender:
 *                             $ref: '#/components/schemas/UserProfile'
 */
router.get("/messages/:conversationId", chatController.getMessages);

/**
 * @swagger
 * /chat/messages:
 *   post:
 *     summary: Send a message (text, image, or file)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               conversationId:
 *                 type: integer
 *                 description: Required if recipientId/recipientCode is not provided
 *               recipientId:
 *                 type: integer
 *                 description: Database ID of recipient
 *               recipientCode:
 *                 type: string
 *                 description: User code of recipient (e.g., A3B7X2)
 *               content:
 *                 type: string
 *                 description: Text content (required if no file)
 *               messageType:
 *                 type: string
 *                 enum: [text, image, file]
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image or file to upload
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               conversationId:
 *                 type: integer
 *               recipientId:
 *                 type: integer
 *               recipientCode:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 */
router.post("/messages", upload.single("file"), chatController.sendMessage);

module.exports = router;
