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
import { getAgencyPath, getSnapshotPaths } from "./paths.js";
import { retryAsync } from "./retry-async.js";
import { createHeartbeat, sync, writeToS3 } from "./s3.js";
import { generateRootIndex, generateAgencyIndex } from "./generate-indexes.js";

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

  // Add a file at /auth/heartbeat for the intranet's heartbeat script.
  await retryAsync(() => createHeartbeat());

  // Sync the snapshot to S3
  await retryAsync(() => sync(paths.fs, `s3://${s3BucketName}/${paths.s3}`));

  // Clean up the snapshot directory
  await fs.rm(paths.fs, { recursive: true, force: true });

  // Generate and write content for the agency index file.
  const agencyIndexHtml = await retryAsync(() =>
    generateAgencyIndex(s3BucketName, env, agency),
  );
  await retryAsync(() =>
    writeToS3(
      s3BucketName,
      `${getAgencyPath(env, agency)}/index.html`,
      agencyIndexHtml,
      { cacheMaxAge: 600 },
    ),
  );

  // Generate and write content for the root index file.
  const rootIndexHtml = await retryAsync(() =>
    generateRootIndex(s3BucketName, env),
  );
  await retryAsync(() =>
    writeToS3(
      s3BucketName,
      "production" === env ? `index.html` : `${env}.html`,
      rootIndexHtml,
      {
        cacheMaxAge: 600,
      },
    ),
  );

  console.log("Snapshot complete", { url: url.href, agency, depth });
};
