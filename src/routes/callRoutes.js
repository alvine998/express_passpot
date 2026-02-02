const express = require("express");
const router = express.Router();
const callController = require("../controllers/callController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Call
 *   description: Audio/Video call history
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Call:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         callerId:
 *           type: integer
 *         receiverId:
 *           type: integer
 *         callType:
 *           type: string
 *           enum: [audio, video]
 *         status:
 *           type: string
 *           enum: [missed, completed, rejected, busy]
 *         duration:
 *           type: integer
 *         startTime:
 *           type: string
 *           format: date-time
 *         endTime:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /calls:
 *   post:
 *     summary: Log a call attempt
 *     tags: [Call]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverId
 *             properties:
 *               receiverId:
 *                 type: integer
 *               callType:
 *                 type: string
 *                 enum: [audio, video]
 *     responses:
 *       201:
 *         description: Call logged
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
 *                   example: Call logged successfully
 *                 data:
 *                   $ref: '#/components/schemas/Call'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", callController.logCall);

/**
 * @swagger
 * /calls/{id}:
 *   put:
 *     summary: Update call status/duration
 *     tags: [Call]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [missed, completed, rejected, busy]
 *               duration:
 *                 type: integer
 *               endTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Call updated
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
 *                   example: Call updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Call'
 *       404:
 *         description: Call record not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:id", callController.updateCall);

/**
 * @swagger
 * /calls/history:
 *   get:
 *     summary: Get call history
 *     tags: [Call]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Call history list
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
 *                   example: Call history retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Call'
 *                       - type: object
 *                         properties:
 *                           caller:
 *                             $ref: '#/components/schemas/UserProfile'
 *                           receiver:
 *                             $ref: '#/components/schemas/UserProfile'
 */
router.get("/history", callController.getCallHistory);

module.exports = router;
