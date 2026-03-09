/**
 * Storage-Abstraktion: Lokal gespeichert, AWS S3-fähig
 *
 * Um später auf S3 zu wechseln:
 * 1. npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 * 2. USE_S3=true in .env setzen
 * 3. AWS_* Variablen in .env eintragen
 * 4. Diese Datei muss NICHT geändert werden – der Rest des Codes auch nicht.
 */

const fs = require("fs");
const path = require("path");

const USE_S3 = process.env.USE_S3 === "true";

// ─── Lokaler Speicher ─────────────────────────────────────────────────────────

const UPLOAD_BASE = path.resolve(
  __dirname,
  process.env.UPLOAD_DIR || "uploads"
);

// Sicherstellen, dass alle Bucket-Ordner existieren
const BUCKETS = [
  "avatars",
  "club-assets",
  "company-assets",
  "gallery-images",
  "documents",
  "post-images",
];

BUCKETS.forEach((bucket) => {
  const dir = path.join(UPLOAD_BASE, bucket);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Gibt die öffentliche URL einer gespeicherten Datei zurück.
 * @param {string} bucket  z.B. "avatars"
 * @param {string} filePath  z.B. "club_123/logo.png"
 */
function getPublicUrl(bucket, filePath) {
  if (!filePath) return null;
  if (USE_S3) {
    const region = process.env.AWS_REGION || "eu-central-1";
    const bucketName = process.env.AWS_S3_BUCKET || "schuetzenhub-uploads";
    return `https://${bucketName}.s3.${region}.amazonaws.com/${bucket}/${filePath}`;
  }
  // Lokale URL – Express liefert /uploads/... statisch aus
  return `/uploads/${bucket}/${filePath}`;
}

/**
 * Speichert eine hochgeladene Datei (von multer) in den richtigen Bucket-Ordner.
 * @param {object} file  multer-Dateiobjekt
 * @param {string} bucket  z.B. "avatars"
 * @param {string} destPath  Zielpfad innerhalb des Buckets, z.B. "club_123/logo.png"
 */
async function saveFile(file, bucket, destPath) {
  if (USE_S3) {
    // AWS S3 Upload
    const {
      S3Client,
      PutObjectCommand,
    } = require("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: process.env.AWS_REGION });
    const fileContent = fs.readFileSync(file.path);
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `${bucket}/${destPath}`,
        Body: fileContent,
        ContentType: file.mimetype,
      })
    );
    // Temp-Datei löschen
    fs.unlinkSync(file.path);
  } else {
    const targetDir = path.join(UPLOAD_BASE, bucket, path.dirname(destPath));
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = path.join(UPLOAD_BASE, bucket, destPath);
    fs.renameSync(file.path, targetPath);
  }
  return getPublicUrl(bucket, destPath);
}

/**
 * Löscht eine Datei aus dem Speicher.
 */
async function deleteFile(bucket, filePath) {
  if (!filePath) return;
  if (USE_S3) {
    const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: process.env.AWS_REGION });
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `${bucket}/${filePath}`,
      })
    );
  } else {
    const fullPath = path.join(UPLOAD_BASE, bucket, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}

module.exports = { getPublicUrl, saveFile, deleteFile, UPLOAD_BASE };
