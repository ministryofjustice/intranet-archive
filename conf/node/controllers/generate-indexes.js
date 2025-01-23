import { intranetUrls, s3BucketName, indexCss } from "../constants.js";
import { getAgenciesFromS3, getSnapshotsFromS3 } from "./s3.js";
import { getAgencyPath } from "./paths.js";

/**
 * Generate the root index html
 *
 * @param {string} bucket - The bucket name, defaults to the s3BucketName constant
 * @param {string} env - The env of the intranet e.g. production or dev.
 * @returns {Promise<string>}
 *
 * @throws {Error}
 */

export const generateRootIndex = async (bucket = s3BucketName, env) => {
  if (!env) {
    throw new Error("Env is required");
  }

  const agencies = await getAgenciesFromS3(bucket, env);

  const hostname = new URL(intranetUrls[env]).hostname;

  const html = `<!doctype html><html lang="en">
    <head><title>Intranet Archive Index</title><style>${indexCss}</style></head>
    <body>
      <main>
        <div class="container px-4 py-5">
          <h1>Ministry of Justice Intranet Archive</h1>
          <h2 class="pb-2 border-bottom">${hostname}</h2>
          <ul class="list-group">
            ${agencies
              .map(
                (agency) => `
                <li class="list-group-item">
                  <a href="/${getAgencyPath(
                    env,
                    agency,
                  )}/index.html" target="_blank">${agency}</a>
                </li>`,
              )
              .join("\n")}
          </ul>
        </div>
      </main>
    </body>
  </html>`;

  return html;
};

/**
 * Generate the agency index html
 *
 * @param {string} bucket - The bucket name, defaults to the s3BucketName constant
 * @param {string} env - The environment for the intranet e.g. production or dev
 * @param {string} agency - The agency to get snapshots for e.g. hq, hmcts etc.
 * @returns {Promise<string>}
 *
 * @throws {Error}
 */

export const generateAgencyIndex = async (
  bucket = s3BucketName,
  env,
  agency,
) => {
  if (!env) {
    throw new Error("Env is required");
  }

  if (!agency) {
    throw new Error("Agency is required");
  }

  const url = new URL(intranetUrls[env]);

  const snapshots = await getSnapshotsFromS3(bucket, env, agency);

  const html = `<!doctype html><html lang="en">
    <head><title>Intranet Archive Index</title><style>${indexCss}</style></head>
    <body>
      <main>
        <div class="container px-4 py-5">
          <h1>Ministry of Justice Intranet Archive</h1>
          <h2 class="pb-2 border-bottom">${url.hostname} - ${agency}</h2>
          <ul class="list-group">
            ${snapshots
              .map(
                (snapshot) => `
                <li class="list-group-item">
                  <a href="/${getAgencyPath(env, agency)}/${snapshot}/${
                  url.hostname
                }/index.html" target="_blank">${snapshot}</a>
                </li>`,
              )
              .join("\n")}
          </ul>
        </div>
      </main>
    </body>
  </html>`;

  return html;
};
