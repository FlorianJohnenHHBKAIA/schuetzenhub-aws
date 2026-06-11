/**
 * Storage abstraction for local uploads and optional AWS S3 storage.
 */

const fs = require("fs");
const path = require("path");

const USE_S3 = process.env.USE_S3 === "true";

const UPLOAD_BASE = path.resolve(
  __dirname,
  process.env.UPLOAD_DIR || "uploads"
);

const BUCKETS = [
  "avatars",
  "club-assets",
  "company-assets",
  "gallery-images",
  "documents",
  "post-images",
];

if (!USE_S3) {
  BUCKETS.forEach((bucket) => {
    const dir = path.join(UPLOAD_BASE, bucket);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function normalizePath(filePath) {
  return String(filePath || "").replace(/^\/+/, "");
}

function getPublicUrl(bucket, filePath) {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) return filePath;
  if (filePath.startsWith("/uploads/")) return filePath;

  const normalizedPath = normalizePath(filePath);
  const pathInBucket = normalizedPath.startsWith(`${bucket}/`)
    ? normalizedPath.slice(bucket.length + 1)
    : normalizedPath;

  if (USE_S3) {
    const region = process.env.AWS_REGION || "eu-central-1";
    const bucketName = process.env.AWS_S3_BUCKET || "schuetzenhub-uploads";
    return `https://${bucketName}.s3.${region}.amazonaws.com/${bucket}/${pathInBucket}`;
  }

  return `/uploads/${bucket}/${pathInBucket}`;
}

async function saveFile(file, bucket, destPath) {
  const pathInBucket = normalizePath(destPath);

  if (USE_S3) {
    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });
    const fileContent = fs.readFileSync(file.path);

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `${bucket}/${pathInBucket}`,
        Body: fileContent,
        ContentType: file.mimetype,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    fs.unlinkSync(file.path);
  } else {
    const targetDir = path.join(UPLOAD_BASE, bucket, path.dirname(pathInBucket));
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(UPLOAD_BASE, bucket, pathInBucket);
    fs.renameSync(file.path, targetPath);
  }

  return getPublicUrl(bucket, pathInBucket);
}

async function deleteFile(bucket, filePath) {
  if (!filePath) return;
  const pathInBucket = normalizePath(filePath);

  if (USE_S3) {
    const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `${bucket}/${pathInBucket}`,
      })
    );
  } else {
    const fullPath = path.join(UPLOAD_BASE, bucket, pathInBucket);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}

module.exports = { getPublicUrl, saveFile, deleteFile, UPLOAD_BASE };
