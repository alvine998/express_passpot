const { User } = require("../models");
const { Op } = require("sequelize");
const { success, error } = require("../utils/responseHelper");
const { uploadToR2 } = require("../services/storageService");

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    return success(res, "Profile retrieved successfully", req.user);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Update user profile (includes optional avatar upload to R2)
exports.updateProfile = async (req, res) => {
  const { displayName, avatar } = req.body;

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return error(res, "User not found", 404);

    if (displayName) user.displayName = displayName;

    // Handle profile picture upload if file is provided
    if (req.file) {
      const url = await uploadToR2(req.file);
      user.avatar = url;
    } else if (avatar) {
      // Still allow passing a direct URL if needed
      user.avatar = avatar;
    }

    await user.save();
    return success(res, "Profile updated successfully", user);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// List/Search users
exports.getUsers = async (req, res) => {
  const { search } = req.query;

  try {
    let where = {
      id: { [Op.ne]: req.user.id }, // Exclude current user
    };

    if (search) {
      where[Op.or] = [
        { email: { [Op.like]: `%${search}%` } },
        { displayName: { [Op.like]: `%${search}%` } },
      ];
    }

    const users = await User.findAll({
      where,
      attributes: ["id", "email", "userCode", "displayName", "avatar"],
    });

    return success(res, "Users retrieved successfully", users);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Deactivate user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return error(res, "User not found", 404);

    // In a real app, you might want to just set a flag instead of hard delete
    await user.destroy();
    return success(res, "User account deleted");
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Update FCM Token
exports.updateFCMToken = async (req, res) => {
  const { fcmToken, pushToken } = req.body;
  const token = fcmToken || pushToken;

  if (!token) return error(res, "Token is required", 400);

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return error(res, "User not found", 404);

    user.fcmToken = token;
    await user.save();

    return success(res, "FCM token updated successfully");
  } catch (err) {
    return error(res, err.message, 500);
  }
};
