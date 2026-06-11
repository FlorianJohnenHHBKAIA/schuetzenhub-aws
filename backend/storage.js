/**
 * Storage abstraction for local uploads and Supabase Storage.
 */

const fs = require("fs");
const path = require("path");

const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || "").toLowerCase();
const USE_SUPABASE_STORAGE =
  STORAGE_PROVIDER === "supabase" ||
  process.env.USE_SUPABASE_STORAGE === "true" ||
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

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

if (!USE_SUPABASE_STORAGE) {
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

  if (USE_SUPABASE_STORAGE) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL fehlt fuer Supabase Storage");
    }
    return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${pathInBucket}`;
  }

  return `/uploads/${bucket}/${pathInBucket}`;
}

function getSupabaseStorageClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY sind fuer Supabase Storage erforderlich");
  }

  const { createClient } = require("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureSupabaseBucket(client, bucket) {
  const { error } = await client.storage.createBucket(bucket, { public: true });
  if (error && !/already exists|already owned|The resource already exists/i.test(error.message || "")) {
    throw error;
  }

  if (error) {
    const { error: updateError } = await client.storage.updateBucket(bucket, { public: true });
    if (updateError && !/not found/i.test(updateError.message || "")) {
      throw updateError;
    }
  }
}

async function saveFile(file, bucket, destPath) {
  const pathInBucket = normalizePath(destPath);

  if (USE_SUPABASE_STORAGE) {
    const supabase = getSupabaseStorageClient();
    const fileContent = fs.readFileSync(file.path);

    await ensureSupabaseBucket(supabase, bucket);

    const { error } = await supabase.storage
      .from(bucket)
      .upload(pathInBucket, fileContent, {
        contentType: file.mimetype,
        cacheControl: "31536000",
        upsert: true,
      });

    fs.unlinkSync(file.path);

    if (error) throw error;
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

  if (USE_SUPABASE_STORAGE) {
    const supabase = getSupabaseStorageClient();
    const { error } = await supabase.storage.from(bucket).remove([pathInBucket]);
    if (error) throw error;
  } else {
    const fullPath = path.join(UPLOAD_BASE, bucket, pathInBucket);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}

module.exports = { getPublicUrl, saveFile, deleteFile, UPLOAD_BASE };
