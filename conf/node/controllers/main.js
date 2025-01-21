import fs from "node:fs/promises";

import { intranetJwts, s3BucketName, sensitiveFiles } from "../constants.js";
import {
  getSnapshotPaths,
  getHttrackArgs,
  runHttrack,
  getHttrackProgress,
  waitForHttrackComplete,
} from "./httrack.js";
import { createHeartbeat, sync, writeToS3 } from "./s3.js";
import { generateRootIndex, generateAgencyIndex } from "./generate-indexes.js";

/**
 *
 * @param {Object} props
 * @param {URL} props.url
 * @param {string} props.agency
 * @param {number} [props.depth]
 */

export const main = async ({ url, agency, depth }) => {
  const paths = getSnapshotPaths({ host: url.host, agency });

  const { complete } = await getHttrackProgress(paths.fs);

  // If the snapshot is already complete, skip httrack
  if (!complete) {
    const httrackArgs = getHttrackArgs({
      url,
      dest: paths.fs,
      agency,
      jwt: intranetJwts[url.hostname],
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
  await createHeartbeat();

  // Sync the snapshot to S3
  await sync(paths.fs, `s3://${s3BucketName}/${paths.s3}`);

  // Clean up the snapshot directory
  await fs.rm(paths.fs, { recursive: true, force: true });

  // Generate and write content for the agency index file.
  const agencyIndexHtml = await generateAgencyIndex(
    s3BucketName,
    url.host,
    agency,
  );
  await writeToS3(
    s3BucketName,
    `${url.host}/${agency}/index.html`,
    agencyIndexHtml,
    { cacheMaxAge: 600 },
  );

  // Generate and write content for the root index file.
  const rootIndexHtml = await generateRootIndex(s3BucketName, url.host);
  await writeToS3(s3BucketName, `index.html`, rootIndexHtml, {
    cacheMaxAge: 600,
  });

  console.log("Snapshot complete", { url: url.href, agency, depth });
};
