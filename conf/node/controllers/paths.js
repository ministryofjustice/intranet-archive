import { intranetUrls, allowedTargetAgencies } from "../constants.js";

/**
 * A helper function to get the index page for an environment.
 *
 * @param {string} env
 * @returns {string} the index page
 */

export const getEnvironmentIndex = (env) => {
  if (!Object.keys(intranetUrls).includes(env)) {
    throw new Error(`Invalid environment: ${env}`);
  }

  return env === "production" ? "index.html" : `${env}.html`;
};

/**
 * A helper function to get the folder for the agency.
 *
 * The folder is prefixed with the environment if it is not production.
 * Then, it is followed by the agency.
 *
 * @param {string} env
 * @param {string} agency
 * @returns {string} the folder name
 */

export const getAgencyPath = (env, agency) => {
  if (!Object.keys(intranetUrls).includes(env)) {
    throw new Error(`Invalid environment: ${env}`);
  }

  if (!allowedTargetAgencies.includes(agency)) {
    throw new Error(`Invalid agency: ${agency}`);
  }

  return env === "production" ? `${agency}` : `${env}-${agency}`;
};

/**
 * A helper function to get the directory for the snapshot.
 *
 * @param {Object} props
 * @param {string} props.env
 * @param {string} props.agency
 * @returns {{s3: string, fs: string}} the s3 and fs paths
 */

export const getSnapshotPaths = ({ env, agency }) => {
  // Get date in format: 2023-01-17
  const dateString = new Date().toISOString().slice(0, 10);

  const s3Path = `${getAgencyPath(env, agency)}/${dateString}`;

  const fsPath = `/tmp/snapshots/${s3Path}`;

  // Return directory for the snapshot
  return { s3: s3Path, fs: fsPath };
};
