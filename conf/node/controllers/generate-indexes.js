import { s3BucketName, indexCss } from "../constants.js";
import { getAgenciesFromS3, getSnapshotsFromS3 } from "./s3.js";

/**
 * Generate the root index html
 *
 * @param {string} bucket - The bucket name, defaults to the s3BucketName constant
 * @param {string} host - The host to the intranet e.g. intranet.justice.gov.uk or dev.intranet.justice.gov.uk
 * @returns {Promise<string>}
 *
 * @throws {Error}
 */

export const generateRootIndex = async (bucket = s3BucketName, host) => {
  if (!host) {
    throw new Error("Host is required");
  }

  const agencies = await getAgenciesFromS3(bucket, host);

  const html = `<!doctype html><html lang="en">
    <head><title>Intranet Archive Index</title><style>${indexCss}</style></head>
    <body>
      <main>
        <div class="container px-4 py-5">
          <h1>Ministry of Justice Intranet Archive</h1>
          <h2 class="pb-2 border-bottom">${host}</h2>
          <ul class="list-group">
            ${agencies.map(
              (agency) => `<li class="list-group-item">
                  <a href="/${host}/${agency}/index.html" target="_blank">${agency}</a>
                </li>`,
            )}
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
 * @param {string} host - The host to the intranet e.g. intranet.justice.gov.uk or dev.intranet.justice.gov.uk
 * @param {string} agency - The agency to get snapshots for e.g. hq, hmcts etc.
 * @returns {Promise<string>}
 *
 * @throws {Error}
 */

export const generateAgencyIndex = async (
  bucket = s3BucketName,
  host,
  agency,
) => {
  if (!host) {
    throw new Error("Host is required");
  }

  if (!agency) {
    throw new Error("Agency is required");
  }

  const snapshots = await getSnapshotsFromS3(bucket, host, agency);

  const html = `<!doctype html><html lang="en">
    <head><title>Intranet Archive Index</title><style>${indexCss}</style></head>
    <body>
      <main>
        <div class="container px-4 py-5">
          <h1>Ministry of Justice Intranet Archive</h1>
          <h2 class="pb-2 border-bottom">${host} - ${agency}</h2>
          <ul class="list-group">
            ${snapshots.map(
              (snapshot) => `<li class="list-group-item">
                  <a href="/${host}/${agency}/${snapshot}/${host}/index.html" target="_blank">${snapshot}</a>
                </li>`,
            )}
          </ul>
        </div>
      </main>
    </body>
  </html>`;

  return html;
};
