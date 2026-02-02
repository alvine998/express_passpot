const admin = require("firebase-admin");

/**
 * @tip To make this fully functional, place your firebase-service-account.json
 * in the src/config directory and uncomment the initialization code below.
 */

const serviceAccount = require("../config/firebaseServiceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/**
 * Send a push notification via FCM
 * @param {string} token - Target user's FCM token
 * @param {object} payload - Notification data (title, body, etc.)
 */
const sendPushNotification = async (token, payload) => {
  if (!token) {
    console.log("No FCM token provided, skipping notification.");
    return;
  }

  // Placeholder if Firebase is not initialized
  if (admin.apps.length === 0) {
    console.log("[FCM Placeholder] Would send notification to:", token);
    console.log("[FCM Placeholder] Payload:", payload);
    return;
  }

  const message = {
    token: token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("Successfully sent FCM message:", response);
    return response;
  } catch (error) {
    console.error("Error sending FCM message:", error);
    throw error;
  }
};

module.exports = {
  sendPushNotification,
};
