const express = require("express");
const router = express.Router();
const friendController = require("../controllers/friendController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Friends
 *   description: Friend management
 */

/**
 * @swagger
 * /friends:
 *   post:
 *     summary: Send a friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - friendCode
 *             properties:
 *               friendCode:
 *                 type: string
 *                 example: A3B7X2
 *     responses:
 *       201:
 *         description: Friend request sent
 *       400:
 *         description: Invalid request or already friends
 *       404:
 *         description: User not found
 */
router.post("/", friendController.addFriend);

/**
 * @swagger
 * /friends/requests:
 *   get:
 *     summary: Get pending friend requests
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending requests
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
 *                   example: Friend requests retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserProfile'
 */
router.get("/requests", friendController.getFriendRequests);

/**
 * @swagger
 * /friends/{id}/accept:
 *   post:
 *     summary: Accept a friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID of the sender (the one who sent the request)
 *     responses:
 *       200:
 *         description: Friend request accepted
 *       404:
 *         description: Request not found
 */
router.post("/:id/accept", friendController.acceptFriend);

/**
 * @swagger
 * /friends/{id}/reject:
 *   post:
 *     summary: Reject a friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID of the sender
 *     responses:
 *       200:
 *         description: Friend request rejected
 *       404:
 *         description: Request not found
 */
router.post("/:id/reject", friendController.rejectFriend);

/**
 * @swagger
 * /friends:
 *   get:
 *     summary: Get all friends (accepted only)
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of friends retrieved
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
 *                   example: Friends retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserProfile'
 */
router.get("/", friendController.getFriends);

/**
 * @swagger
 * /friends/{id}:
 *   delete:
 *     summary: Remove a friend
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID of the friend to remove
 *     responses:
 *       200:
 *         description: Friend removed
 *       404:
 *         description: Friend not found
 */
router.delete("/:id", friendController.removeFriend);

module.exports = router;
