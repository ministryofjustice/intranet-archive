import fs from "node:fs/promises";

import { jwt, s3BucketName, sensitiveFiles } from "../constants.js";
import {
  getSnapshotPaths,
  getHttrackArgs,
  runHttrack,
  waitForHttrackComplete,
} from "./httrack.js";
import { sync } from "./s3.js";

/**
 *
 * @param {props} props
 * @param {URL} props.url
 * @param {string} props.agency
 * @param {?number} props.depth
 */

export const main = async ({ url, agency, depth }) => {
  const paths = getSnapshotPaths({ host: url.host, agency });

  const httrackArgs = getHttrackArgs({
    url,
    dest: paths.fs,
    agency,
    jwt,
    depth,
  });

  runHttrack(httrackArgs);

  await waitForHttrackComplete(paths.fs);

  // Remove sensitive files - before syncing to S3
  await Promise.all(
    sensitiveFiles.map(file => fs.rm(`${paths.fs}/${file}`, { force: true }))
  );

  // Sync the snapshot to S3
  await sync(paths.fs, `s3://${s3BucketName}/${paths.s3}`);

  // Clean up the snapshot directory
  await fs.rm(paths.fs, { recursive: true, force: true });

  console.log("Snapshot complete", { url: url.href, agency, depth });
};
