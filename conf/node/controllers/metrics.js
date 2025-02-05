import { intranetUrls, intranetJwts } from "../constants.js";
import {
  checkAccess as checkS3Access,
  getAgenciesFromS3,
  getSnapshotsFromS3,
} from "./s3.js";

/**
 * The metrics object.
 *
 * @typedef {Object} Metrics
 * @property {string} agency The agency the metrics are for
 * @property {number} snapshotsTaken The number of snapshots taken.
 * @property {number} mostRecentSnapshotAge The age of the most recent snapshot.
 */

/**
 * Get the metrics for a specific agency.
 *
 * @param {string} env - The environment for the intranet e.g. production or dev
 * @param {string} agency - The agency to get snapshots for e.g. hq, hmcts etc.
 * @returns {Promise<Metrics>} The metrics for the agency.
 * @throws {Error} If getSnapshotsFromS3 throws, or a date format is invalid.
 */
export const getAgencySnapshotMetrics = async (env, agency) => {
  const snapshots = await getSnapshotsFromS3(undefined, env, agency);

  if (!snapshots?.length) {
    return {
      agency,
      snapshotsTaken: 0,
      mostRecentSnapshotAge: 0,
    };
  }

  const mostRecentSnapshot = snapshots.sort((a, b) => (a > b ? -1 : 1))[0];

  // Make sure it's in the format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mostRecentSnapshot)) {
    throw new Error(`Invalid date format: ${mostRecentSnapshot}`);
  }

  return {
    agency,
    snapshotsTaken: snapshots?.length,
    mostRecentSnapshotAge: Math.floor(
      (Date.now() - new Date(mostRecentSnapshot).getTime()) / 86400000,
    ),
  };
};

/**
 * Get http metrics.
 *
 * Ensure we have a valid JWT for the various scheduled tasks, by making a fetch request to the intranet.
 * Ensure the CloudFront distribution returns the expected status codes:
 * - 200 when a signed cookie is present
 * - 403 when a signed cookie is not present
 */

export const getHttpMetrics = async () => {
  // Get envs where a JWT has been set.
  const envs = Object.entries(intranetJwts)
    .filter(([, jwt]) => jwt)
    .map(([env]) => env);

  const intranetPromise = Promise.all(
    envs.map(async (env) => {
      const url = intranetUrls[env];
      const { status } = await fetch(url, {
        redirect: "manual",
        headers: { Cookie: `jwt=${intranetJwts[env]}` },
      });
      return { target: "intranet", env, access: status === 200 };
    }),
  );

  const cloudFrontPromise 

  const [intranet, s3Access] = await Promise.all([
    intranetPromise,
    checkS3Access(),
  ]);

  const metrics = [
    ...intranet,
    { target: "s3", env: 'default', access: s3Access },
  ];

  return metrics;
};

/**
 * Get the metrics for all agencies.
 *
 * @param {string} env - The environment for the intranet e.g. production or dev
 * @returns {Promise<Metrics[]>} The metrics for all agencies.
 */

export const getMetrics = async (env) => {
  const agencies = await getAgenciesFromS3(undefined, env);

  const allAgencyMetrics = await Promise.all(
    agencies.map(async (agency) => getAgencySnapshotMetrics(env, agency)),
  );

  return allAgencyMetrics;
};
