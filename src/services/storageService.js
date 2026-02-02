const { s3Client, bucket } = require("../config/cloudflare");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

/**
 * Upload a file to Cloudflare R2
 * @param {Object} file - Express file object (from multer)
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
const uploadToR2 = async (file) => {
  if (!file) {
    throw new Error("No file provided");
  }

  const fileExtension = path.extname(file.originalname);
  const fileName = `${uuidv4()}${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read",
  });

  await s3Client.send(command);

  // Construct the public URL
  const publicDomain =
    process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN ||
    `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}`;

  return `${publicDomain}/${fileName}`;
};

module.exports = {
  uploadToR2,
};
