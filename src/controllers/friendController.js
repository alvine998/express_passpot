const { User, Friend } = require("../models");
const { success, error } = require("../utils/responseHelper");
const { sendPushNotification } = require("../services/notificationService");

// Add a friend (Send Request)
exports.addFriend = async (req, res) => {
  const { friendCode } = req.body;

  if (!friendCode) {
    return error(res, "friendCode is required", 400);
  }

  try {
    const friendUser = await User.findOne({ where: { userCode: friendCode } });

    if (!friendUser) {
      return error(res, "User not found", 404);
    }

    if (friendUser.id === req.user.id) {
      return error(res, "You cannot add yourself as a friend", 400);
    }

    // Check if any relationship exists
    const existingFriend = await Friend.findOne({
      where: {
        userId: req.user.id,
        friendId: friendUser.id,
      },
    });

    if (existingFriend) {
      if (existingFriend.status === "accepted") {
        return error(res, "This user is already in your friend list", 400);
      } else if (existingFriend.status === "pending") {
        return error(res, "Friend request already sent", 400);
      }
    }

    const relationship = await Friend.create({
      userId: req.user.id,
      friendId: friendUser.id,
      status: "pending",
    });

    // Send Notification to Recipient
    if (friendUser.fcmToken) {
      await sendPushNotification(friendUser.fcmToken, {
        title: "New Friend Request",
        body: `${req.user.displayName || "Someone"} wants to be your friend`,
        data: {
          type: "FRIEND_REQUEST",
          senderId: req.user.id.toString(),
        },
      });
    }

    return success(res, "Friend request sent successfully", relationship, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Get pending friend requests (received)
// Get pending friend requests (received)
exports.getFriendRequests = async (req, res) => {
  try {
    // Correctly fetching users who added me (status: "pending")
    // Using the "addedBy" association defined in models/index.js
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: User,
          as: "addedBy", // Users who added me
          through: {
            where: { status: "pending" },
            attributes: ["id", "status", "createdAt"],
          },
          attributes: ["id", "email", "userCode", "displayName", "avatar"],
        },
      ],
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    return success(res, "Friend requests retrieved successfully", user.addedBy);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Accept a friend request
exports.acceptFriend = async (req, res) => {
  const { id } = req.params; // The ID of the USER who sent the request

  try {
    // Find the request where THEY added ME
    const request = await Friend.findOne({
      where: {
        userId: id,
        friendId: req.user.id,
        status: "pending",
      },
    });

    if (!request) {
      return error(res, "Friend request not found", 404);
    }

    // Update status to accepted
    await request.update({ status: "accepted" });

    // Create reverse record so friendship is mutual (optional but good for querying 'friends')
    // Or just rely on bidirectional query. But let's create the reverse record to ensure consistency if app logic expects strict 'friends' list.
    // Actually, our getStatuses uses bidirectional, so strict reverse isn't 100% required, but standard friend systems usually imply mutual.
    // Let's perform the reverse create to be safe and "fully friends".

    const reverseCheck = await Friend.findOne({
      where: { userId: req.user.id, friendId: id },
    });

    if (!reverseCheck) {
      await Friend.create({
        userId: req.user.id,
        friendId: id,
        status: "accepted",
      });
    } else {
      await reverseCheck.update({ status: "accepted" });
    }

    // Notify the sender
    const sender = await User.findByPk(id);
    if (sender && sender.fcmToken) {
      await sendPushNotification(sender.fcmToken, {
        title: "Friend Request Accepted",
        body: `${req.user.displayName || "User"} accepted your friend request`,
        data: {
          type: "FRIEND_ACCEPT",
          accepterId: req.user.id.toString(),
        },
      });
    }

    return success(res, "Friend request accepted");
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Reject a friend request
exports.rejectFriend = async (req, res) => {
  const { id } = req.params; // The ID of the USER who sent the request

  try {
    const deleted = await Friend.destroy({
      where: {
        userId: id,
        friendId: req.user.id,
        status: "pending", // Only delete pending requests
      },
    });

    if (!deleted) {
      return error(res, "Friend request not found", 404);
    }

    return success(res, "Friend request rejected");
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Get list of friends (Only accepted)
exports.getFriends = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: User,
          as: "friends",
          through: { where: { status: "accepted" }, attributes: [] },
          attributes: ["id", "email", "userCode", "displayName", "avatar"],
        },
        {
          model: User,
          as: "addedBy",
          through: { where: { status: "accepted" }, attributes: [] },
          attributes: ["id", "email", "userCode", "displayName", "avatar"],
        },
      ],
    });

    // Combine and deduplicate
    const allFriends = [...user.friends, ...user.addedBy];
    const uniqueFriends = Array.from(
      new Map(allFriends.map((item) => [item.id, item])).values(),
    );

    return success(res, "Friends retrieved successfully", uniqueFriends);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Remove a friend
exports.removeFriend = async (req, res) => {
  const { id } = req.params; // friendId

  try {
    // Delete both directions
    await Friend.destroy({
      where: {
        userId: req.user.id,
        friendId: id,
      },
    });

    await Friend.destroy({
      where: {
        userId: id,
        friendId: req.user.id,
      },
    });

    return success(res, "Friend removed successfully");
  } catch (err) {
    return error(res, err.message, 500);
  }
};
