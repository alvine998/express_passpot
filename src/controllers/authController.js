const { User } = require("../models");
const { generateOTP, sendOTPEmail } = require("../services/emailService");
const { getUniqueUserCode, validatePin } = require("../services/userService");
const { success, error } = require("../utils/responseHelper");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");

// Request OTP
exports.requestOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return error(res, "Email is required", 400);
  }

  try {
    let user = await User.findOne({ where: { email } });

    if (!user) {
      const userCode = await getUniqueUserCode();
      user = await User.create({ email, userCode });
    }

    const otp = generateOTP();
    user.otpSecret = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await user.save();

    const emailSent = await sendOTPEmail(email, otp);

    if (emailSent) {
      return success(res, "OTP sent to your email");
    } else {
      return error(res, "Failed to send OTP email", 500);
    }
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return error(res, "Email and OTP are required", 400);
  }

  try {
    const user = await User.findOne({
      where: {
        email,
        otpSecret: otp,
        otpExpires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      return error(res, "Invalid or expired OTP", 400);
    }

    // Clear OTP after verification
    user.otpSecret = null;
    user.otpExpires = null;
    await user.save();

    // If 2FA is enabled, stop here and require 2FA verification
    // if (user.twoFactorEnabled) {
    //   return success(res, "OTP verified. Please provide 2FA code.", {
    //     requires2FA: true,
    //     email: user.email,
    //   });
    // }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not defined in environment variables!");
      return error(
        res,
        "Internal server error: Security configuration missing",
        500,
      );
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    console.log(
      `Token generated for user: ${user.email} (2FA: ${user.twoFactorEnabled})`,
    );

    return success(res, "Logged in successfully", {
      token,
      user: {
        id: user.id,
        email: user.email,
        userCode: user.userCode,
        twoFactorSecret: user.twoFactorSecret,
        twoFactorEnabled: user.twoFactorEnabled,
        pinSet: !!user.pin,
      },
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Setup 2FA (TOTP)
exports.setup2FA = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return error(res, "User not found", 404);

    const secret = speakeasy.generateSecret({
      name: `Passpot (${user.email})`,
    });
    user.twoFactorSecret = secret.base32;
    await user.save();

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return success(res, "2FA setup initiated", {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Verify 2FA and Login
exports.verify2FA = async (req, res) => {
  const { email, token } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return error(res, "User not found", 404);

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token,
    });

    if (!verified) {
      return error(res, "Invalid 2FA code", 400);
    }

    if (!user.twoFactorEnabled) {
      user.twoFactorEnabled = true;
      await user.save();
    }

    const jwtToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return success(res, "Logged in successfully", {
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        userCode: user.userCode,
        twoFactorEnabled: user.twoFactorEnabled,
        pinSet: !!user.pin,
      },
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Setup PIN
exports.setupPin = async (req, res) => {
  const { pin } = req.body;

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return error(res, "User not found", 404);

    // Validate PIN quality (no sequential or identical)
    const validation = validatePin(pin);
    if (!validation.valid) {
      return error(res, validation.message, 400);
    }

    // Hash and save PIN
    const salt = await bcrypt.genSalt(10);
    user.pin = await bcrypt.hash(pin, salt);
    await user.save();

    return success(res, "PIN setup successful");
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Verify PIN
exports.verifyPin = async (req, res) => {
  const { pin } = req.body;

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return error(res, "User not found", 404);

    if (!user.pin) {
      return error(res, "PIN not set", 400);
    }

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      return error(res, "Invalid PIN", 400);
    }

    return success(res, "PIN verified successfully", { verified: true });
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Logout (Clear FCM Token)
exports.logout = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (user) {
      user.fcmToken = null;
      await user.save();
    }
    return success(res, "Logged out successfully");
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Check Auth Status (PIN & 2FA)
exports.getAuthStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return error(res, "User not found", 404);

    return success(res, "Auth status retrieved successfully", {
      pinSet: !!user.pin,
      twoFactorEnabled: user.twoFactorEnabled,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
};
