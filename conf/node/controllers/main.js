import fs from "node:fs/promises";

import {
  intranetUrls,
  intranetJwts,
  s3BucketName,
  sensitiveFiles,
} from "../constants.js";
import {
  getHttrackArgs,
  runHttrack,
  getHttrackProgress,
  waitForHttrackComplete,
} from "./httrack.js";
import { getEnvironmentIndex, getSnapshotPaths } from "./paths.js";
import { retryAsync } from "./retry-async.js";
import { sync } from "./s3.js";
import { generateAndWriteIndexesToS3 } from "./generate-indexes.js";

/**
 *
 * @param {Object} props
 * @param {string} props.env
 * @param {string} props.agency
 * @param {number} [props.depth]
 */

export const main = async ({ env, agency, depth }) => {
  const paths = getSnapshotPaths({ env, agency });

  const url = new URL(intranetUrls[env]);

  const { complete } = await getHttrackProgress(paths.fs);

  // If the snapshot is already complete, skip httrack
  if (!complete) {
    const httrackArgs = getHttrackArgs({
      url,
      dest: paths.fs,
      agency,
      jwt: intranetJwts[env],
      environmentIndex: getEnvironmentIndex(env),
      depth,
    });

    runHttrack(httrackArgs);

    const { timedOut } = await waitForHttrackComplete(paths.fs);

    if (timedOut) {
      console.error("Httrack timed out", { url: url.href, agency, depth });
      return;
    }
  }

  // Remove sensitive files - before syncing to S3
  await Promise.all(
    sensitiveFiles.map((file) => fs.rm(`${paths.fs}/${file}`, { force: true })),
  );

  // Sync the snapshot to S3
  await retryAsync(() => sync(paths.fs, `s3://${s3BucketName}/${paths.s3}`));

  // Clean up the snapshot directory
  await fs.rm(paths.fs, { recursive: true, force: true });

  // Generate and write content for the agency and root index files.
  await generateAndWriteIndexesToS3(s3BucketName, env, agency);

  console.log("Snapshot complete", { url: url.href, agency, depth });
};
