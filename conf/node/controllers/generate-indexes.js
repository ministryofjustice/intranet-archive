import { intranetUrls, s3BucketName, indexCss } from "../constants.js";
import { getEnvironmentIndex, getAgencyPath } from "./paths.js";
import { getAgenciesFromS3, getSnapshotsFromS3 } from "./s3.js";

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

  // Get any other envs that have agencies, so that we can link to them.
  // This will only be shown on dev, so the presentation is not a priority.
  const otherLinks = (
    await Promise.all(
      Object.keys(intranetUrls)
        // Remove the current env
        .filter((e) => e !== env)
        // Check if each env has agencies and map to an object with the href and label
        .map(async (e) => ({
          hasAgencies: (await getAgenciesFromS3(bucket, e))?.length > 0,
          href: `/${getEnvironmentIndex(e)}`,
          label: `${e}`,
        })),
    )
  )
    // Only show links to envs with agencies
    .filter(({ hasAgencies }) => hasAgencies);

  const html = `<!doctype html><html lang="en">
    <head><title>Intranet Archive Index</title><style>${indexCss}</style></head>
    <body>
      <main>
        <div class="container container--flex">
          <h1>Ministry of Justice Intranet Archive</h1>
          ${
            otherLinks.length > 0
              ? `<nav class="top-links">
                  Switch target environment: 
                  ${otherLinks
                    .map((link) => `<a href="${link.href}" >${link.label}</a>`)
                    .join(" | ")}
                </nav>`
              : ``
          }
        </div>
        <div class="container">
          <h2>${hostname}</h2>
          <ul class="list-group">
            ${agencies
              .map(
                (agency) => `
                <li class="list-group-item">
                  <a href="/${getAgencyPath(
                    env,
                    agency,
                  )}/index.html">${agency}</a>
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
        <div class="container container--flex">
          <h1>Ministry of Justice Intranet Archive</h1>
          <nav class="top-links">
            <a href="/${getEnvironmentIndex(env)}">Switch to other intranet</a>
          </nav>
        </div>
        <div class="container">
          <h2>${url.hostname} - ${agency}</h2>
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
