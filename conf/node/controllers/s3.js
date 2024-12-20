import fs from "fs/promises";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { S3SyncClient } from "s3-sync-client";
import mime from "mime-types";

import {
  s3BucketName,
  s3Credentials as credentials,
  s3Region,
} from "../constants.js";

/**
 * S3 client options
 *
 * @type {import("@aws-sdk/client-s3").S3ClientConfig}
 */

export const s3Options = {
  region: s3Region,
  // Add the credentials if they exist - used for minio locally.
  ...(credentials && { credentials }),
  // Add the endpoint if it exists - used for minio locally.
  ...(process.env.S3_ENDPOINT && {
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
  }),
};

/**
 * S3 client
 *
 * @type {S3Client}
 */

export const client = new S3Client(s3Options);

/**
 * S3 sync client
 *
 * @see https://github.com/jeanbmar/s3-sync-client
 */

const { sync: originalSync } = new S3SyncClient({ client });

/**
 * Sync a local directory to an S3 bucket
 *
 * @param {string} source - The source directory
 * @param {string} destination - The destination directory
 * @param {?import('s3-sync-client/dist/commands/SyncCommand').SyncOptions} options - The sync options
 *
 * @returns {Promise<import('s3-sync-client/dist/commands/SyncCommand').SyncCommandOutput>}
 */

export const sync = async (source, destination, options = {}) => {
  // Set the content type for each file
  options.commandInput = (input) => ({
    ContentType: mime.lookup(input.Key) || "text/html",
  });

  return originalSync(source, destination, options);
};

/**
 * Empty an S3 folder by using sync and deleting all files
 *
 * @param {string} path - The path to empty
 */

export const s3EmptyDir = async (path) => {
  // Make a tmp empty directory
  const emptyDir = `/tmp/${Date.now()}`;

  // Ensure the directory exists
  await fs.mkdir(emptyDir, { recursive: true });

  // Sync the empty directory to the folder
  await sync(emptyDir, `s3://${s3BucketName}/${path}`, { del: true });

  // Remove the empty directory
  await fs.rm(emptyDir, { recursive: true });
};

/**
 * Check if the bucket is accessible by listing the root of the bucket
 *
 * @param {string} bucket - The bucket name, defaults to the s3BucketName constant
 * @returns {Promise<boolean>}
 *
 * @throws {Error}
 */

export const checkAccess = async (bucket = s3BucketName) => {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
  });

  await client.send(command);

  return true;
};
