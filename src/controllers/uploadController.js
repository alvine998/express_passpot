const { uploadToR2 } = require("../services/storageService");
const { success, error } = require("../utils/responseHelper");

exports.uploadFile = async (req, res) => {
  if (!req.file) {
    return error(res, "No file uploaded", 400);
  }

  try {
    const url = await uploadToR2(req.file);

    return success(res, "File uploaded successfully", { url });
  } catch (err) {
    console.error("Upload error:", err);
    return error(res, err.message, 500);
  }
};
