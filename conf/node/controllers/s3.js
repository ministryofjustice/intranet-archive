import fs from "fs/promises";
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { S3SyncClient } from "s3-sync-client";
import mime from "mime-types";

import {
  s3BucketName,
  s3Credentials as credentials,
  s3Region,
  heartbeatEndpoint,
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
 * Create dummy /auth/heartbeat at bucket root, if it doesn't exist.
 *
 * @param {string} bucket - The bucket name, defaults to the s3BucketName constant
 * @returns {Promise<void>}
 *
 * @throws {Error}
 */

export const createHeartbeat = async (
  bucket = s3BucketName,
  file = heartbeatEndpoint,
) => {
  const objects = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: file,
    }),
  );

  if (!objects.Contents?.length) {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: file,
        Body: "OK",
      }),
    );
  }

  return;
};

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

/**
 * Returns an array of all the agencies in the bucket's host folder.
 *
 * This function looks in the bucket in the host folder and returns an array of all the agencies.
 * e.g looks in s3://s3BucketName/intranet.justice.gov.uk/ and returns an array of hq,hmcts etc.
 *
 * @param {string} bucket - The bucket name, defaults to the s3BucketName constant
 * @param {string} host - The host to the intranet e.g. intranet.justice.gov.uk or dev.intranet.justice.gov.uk
 * @returns {Promise<string[]>}
 *
 * @throws {Error}
 */

export const getAgenciesFromS3 = async (bucket = s3BucketName, host) => {
  if (!host) {
    throw new Error("Host is required");
  }

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: `${host}/`,
    Delimiter: "/",
  });

  const { CommonPrefixes } = await client.send(command);

  return CommonPrefixes.map((folder) =>
    folder.Prefix.replace(`${host}/`, "").replace("/", ""),
  );
};

/**
 * Get an agencies snapshots from S3
 *
 * @param {string} bucket - The bucket name, defaults to the s3BucketName constant
 * @param {string} host - The host to the intranet e.g. intranet.justice.gov.uk or dev.intranet.justice.gov.uk
 * @param {string} agency - The agency to get snapshots for e.g. hq, hmcts etc.
 * @returns {Promise<string[]>}
 *
 * @throws {Error}
 */

export const getSnapshotsFromS3 = async (
  bucket = s3BucketName,
  host,
  agency,
) => {
  if (!host) {
    throw new Error("Host is required");
  }

  if (!agency) {
    throw new Error("Agency is required");
  }

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: `${host}/${agency}/`,
    Delimiter: "/",
  });

  const { CommonPrefixes } = await client.send(command);

  return CommonPrefixes.map(({ Prefix }) =>
    // Remove the host and agency from the Prefix
    Prefix.replace(`${host}/${agency}/`, "").replace("/", ""),
  ).filter((folder) =>
    // Filter out any folders that are not in the format YYYY-MM-DD
    /^\d{4}-\d{2}-\d{2}$/.test(folder),
  );
};

/**
 * Write string to an S3 file.
 *
 * @param {string} bucket - The bucket name, defaults to the s3BucketName constant
 * @param {string} path - The path to write to
 * @param {string} content - The content to write
 * @param {Object} [options] - The options object
 * @param {number} [options.cacheMaxAge] - The cache max age in seconds - a simpler alternative to invalidating CloudFront cache
 *
 * @returns {Promise<void>}
 */

export const writeToS3 = async (
  bucket = s3BucketName,
  path,
  content,
  { cacheMaxAge } = {},
) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: path,
    Body: content,
    ContentType: mime.lookup(path) || "text/html",
    ...(cacheMaxAge && { CacheControl: `max-age=${cacheMaxAge}` }),
  });

  await client.send(command);
};
