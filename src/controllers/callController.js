const { Call, User } = require("../models");
const { Op } = require("sequelize");
const { success, error } = require("../utils/responseHelper");
const { sendPushNotification } = require("../services/notificationService");

// Helper to validate UUID
const isValidUUID = (uuid) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Log a new call
exports.logCall = async (req, res) => {
  const { receiverId, callType, status, duration, startTime, endTime } =
    req.body;

  console.log("[logCall] Request Body:", JSON.stringify(req.body));
  console.log("[logCall] Caller ID:", req.user.id);

  if (!receiverId) {
    return error(res, "receiverId is required", 400);
  }

  if (!isValidUUID(receiverId)) {
    return error(
      res,
      `Invalid receiverId format. Expected UUID, got: ${receiverId}`,
      400,
    );
  }

  try {
    const call = await Call.create({
      callerId: req.user.id,
      receiverId,
      callType: callType || "audio",
      status: status || "missed",
      duration: duration || 0,
      startTime: startTime || new Date(),
      endTime,
    });

    // Trigger Push Notification for incoming call
    try {
      const receiver = await User.findByPk(receiverId);
      if (receiver && receiver.fcmToken) {
        await sendPushNotification(receiver.fcmToken, {
          title: `Incoming ${callType || "audio"} call`,
          body: `${req.user.displayName || "Someone"} is calling you...`,
          data: {
            type: "CALL",
            callId: call.id.toString(),
            callerId: req.user.id.toString(),
            callerName: req.user.displayName || "Someone",
            callType: callType || "audio",
          },
        });
      }
    } catch (pushErr) {
      console.error("Failed to send call notification:", pushErr);
    }

    return success(res, "Call logged successfully", call, 201);
  } catch (err) {
    console.error("[logCall] Error:", err);
    return error(res, err.message || "Failed to log call", 500);
  }
};

// Update an existing call (e.g., when it ends)
exports.updateCall = async (req, res) => {
  const { id } = req.params;
  const { status, duration, endTime } = req.body;

  try {
    const call = await Call.findByPk(id);
    if (!call) return error(res, "Call record not found", 404);

    if (status) call.status = status;
    if (duration) call.duration = duration;
    if (endTime) call.endTime = endTime;

    await call.save();
    return success(res, "Call updated successfully", call);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Get call history for current user
exports.getCallHistory = async (req, res) => {
  try {
    const history = await Call.findAll({
      where: {
        [Op.or]: [{ callerId: req.user.id }, { receiverId: req.user.id }],
      },
      include: [
        {
          model: User,
          as: "caller",
          attributes: ["id", "email", ["displayName", "name"], "avatar"],
        },
        {
          model: User,
          as: "receiver",
          attributes: ["id", "email", ["displayName", "name"], "avatar"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return success(res, "Call history retrieved successfully", history);
  } catch (err) {
    return error(res, err.message, 500);
  }
};
