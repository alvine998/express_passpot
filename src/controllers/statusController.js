const { Status, User } = require("../models");
const { Op } = require("sequelize");
const { success, error } = require("../utils/responseHelper");

// Post a status
exports.postStatus = async (req, res) => {
  const { content, type } = req.body;

  if (!content) {
    return error(res, "Content is required", 400);
  }

  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours

    const status = await Status.create({
      userId: req.user.id,
      content,
      type: type || "text",
      expiresAt,
    });

    return success(res, "Status posted successfully", status, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Get all active statuses (from friends or self)
exports.getStatuses = async (req, res) => {
  try {
    // 1. Get current user's friend IDs (bidirectional visibility)
    const currentUser = await User.findByPk(req.user.id, {
      include: [
        {
          model: User,
          as: "friends", // People I added
          attributes: ["id"],
          through: { attributes: [] },
        },
        {
          model: User,
          as: "addedBy", // People who added me
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
    });

    const myFriendIds = currentUser.friends.map((f) => f.id);
    const addedByIds = currentUser.addedBy.map((f) => f.id);

    // Combine and deduplicate IDs
    const allFriendIds = [...new Set([...myFriendIds, ...addedByIds])];
    const allowedIds = [req.user.id, ...allFriendIds];

    console.log(`Getting statuses for User ${req.user.id}`);
    console.log(`Friends (I added): ${myFriendIds}`);
    console.log(`Added By (They added me): ${addedByIds}`);
    console.log(`Allowed Status IDs: ${allowedIds}`);

    // 2. Fetch statuses from allowed IDs
    const statuses = await Status.findAll({
      where: {
        expiresAt: {
          [Op.gt]: new Date(),
        },
        userId: {
          [Op.in]: allowedIds,
        },
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "displayName", "avatar"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Grouping by user for a WhatsApp-like list
    const groupedStatuses = statuses.reduce((acc, status) => {
      const userId = status.userId;
      if (!acc[userId]) {
        acc[userId] = {
          user: status.user,
          stories: [],
        };
      }
      acc[userId].stories.push(status);
      return acc;
    }, {});

    return success(
      res,
      "Statuses retrieved successfully",
      Object.values(groupedStatuses),
    );
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Delete a status
exports.deleteStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const status = await Status.findOne({
      where: { id, userId: req.user.id },
    });

    if (!status) {
      return error(res, "Status not found or unauthorized", 404);
    }

    await status.destroy();
    return success(res, "Status deleted successfully");
  } catch (err) {
    return error(res, err.message, 500);
  }
};
