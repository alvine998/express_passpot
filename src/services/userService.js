const { User } = require("../models");

const generateUserCode = () => {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const getUniqueUserCode = async () => {
  let code;
  let isUnique = false;
  while (!isUnique) {
    code = generateUserCode();
    const existingUser = await User.findOne({ where: { userCode: code } });
    if (!existingUser) {
      isUnique = true;
    }
  }
  return code;
};

const validatePin = (pin) => {
  // Check if it's 6 digits
  if (!/^\d{6}$/.test(pin)) {
    return { valid: false, message: "PIN must be exactly 6 digits." };
  }

  // Check for identical digits (e.g., 000000)
  if (/^(\d)\1{5}$/.test(pin)) {
    return { valid: false, message: "PIN cannot consist of identical digits." };
  }

  // Check for sequential digits (e.g., 123456, 654321)
  const sequentialAsc = "0123456789";
  const sequentialDesc = "9876543210";
  if (sequentialAsc.includes(pin) || sequentialDesc.includes(pin)) {
    return { valid: false, message: "PIN cannot be sequential." };
  }

  return { valid: true };
};

module.exports = {
  getUniqueUserCode,
  validatePin,
};
