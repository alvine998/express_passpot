const express = require("express");
const router = express.Router();
const statusController = require("../controllers/statusController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Status
 *   description: 24h Status Stories (WhatsApp style)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Status:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         userId:
 *           type: integer
 *         content:
 *           type: string
 *         type:
 *           type: string
 *           enum: [text, image, video]
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /status:
 *   post:
 *     summary: Post a status story
 *     tags: [Status]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [text, image, video]
 *                 default: text
 *     responses:
 *       201:
 *         description: Status posted successfully
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
 *                   example: Status posted successfully
 *                 data:
 *                   $ref: '#/components/schemas/Status'
 */
router.post("/", statusController.postStatus);

/**
 * @swagger
 * /status:
 *   get:
 *     summary: Get active statuses (grouped by user)
 *     tags: [Status]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active stories grouped by user
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
 *                   example: Statuses retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         $ref: '#/components/schemas/UserProfile'
 *                       stories:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/Status'
 */
router.get("/", statusController.getStatuses);

/**
 * @swagger
 * /status/{id}:
 *   delete:
 *     summary: Delete a status
 *     tags: [Status]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Status deleted successfully
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
 *                   example: Status deleted successfully
 *       404:
 *         description: Status not found or unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:id", statusController.deleteStatus);

module.exports = router;
