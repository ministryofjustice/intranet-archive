import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { S3SyncClient } from "s3-sync-client";

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

const client = new S3Client(s3Options);

/**
 * S3 sync client
 *
 * @type {S3SyncClient}
 * 
 * @see https://github.com/jeanbmar/s3-sync-client
 */

const { sync } = new S3SyncClient({ client });

export { sync };

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
