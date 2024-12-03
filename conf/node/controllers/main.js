import { jwt, s3BucketName } from "../constants.js";
import {
  getSnapshotDir,
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
  const directory = getSnapshotDir({ host: url.host, agency });

  const httrackArgs = getHttrackArgs({
    url,
    dest: directory,
    agency,
    jwt,
    depth,
  });

  runHttrack(httrackArgs);

  await waitForHttrackComplete(directory);

    // Delete any sensitive files before syncing to S3

  // Sync the snapshot to S3
  await sync(directory, `s3://${s3BucketName}${directory}`);
};
