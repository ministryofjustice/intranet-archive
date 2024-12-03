import fs from "fs/promises";
import { afterAll, beforeEach, expect, it, jest } from "@jest/globals";

import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

import { main } from "./main.js";
import { getSnapshotPaths } from "./httrack.js";
import { client as s3Client, s3EmptyDir } from "./s3.js";
import { s3BucketName } from "../constants.js";

// Skip long tests when running in watch mode.
const skipLongTests = process.env.npm_lifecycle_event === "test:watch";

describe("main", () => {
  const url = new URL("https://intranet.justice.gov.uk/");
  const agency = "hq";
  const paths = getSnapshotPaths({ host: url.host, agency });

  beforeAll(async () => {
    // Mock console.log so the tests are quiet.
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    // Restore console.log
    jest.restoreAllMocks();

    // Close the client
    s3Client.destroy();
  });

  beforeEach(async () => {
    // Clean out the directory
    await fs.rm(paths.fs, { recursive: true, force: true });

    // Clean out the s3 bucket folder
    await s3EmptyDir(paths.s3);
  });

  it("should get index files on a shallow scrape", async () => {
    await main({ url, agency, depth: 1 });

    // The snapshot should be on s3
    const objects = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: s3BucketName,
        Prefix: paths.s3,
      }),
    );

    // Ensure there's an index.html file
    const httrackIndexHtml = objects.Contents.find(
      (object) => object.Key === `${paths.s3}/index.html`,
    );

    expect(httrackIndexHtml).toBeDefined();

    const intranetIndexHtml = objects.Contents.find(
      (object) => object.Key === `${paths.s3}/${url.host}/index.html`,
    );

    expect(intranetIndexHtml).toBeDefined();
  }, 10_000);

  it("should delete sensitive files and cleanup local fs", async () => {
    await main({ url, agency, depth: 1 });

    // The snapshot should be on s3
    const objects = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: s3BucketName,
        Prefix: paths.s3,
      }),
    );

    const sensitiveFiles = [
      `${paths.s3}/cookies.txt`,
      `${paths.s3}/hts-log.txt`,
      `${paths.s3}/hts-cache/doit.log`,
      `${paths.s3}/hts-cache/new.zip`,
    ]

    const foundSensitiveFiles = objects.Contents.find(
      (object) => sensitiveFiles.includes(object.Key),
    );

    expect(foundSensitiveFiles).toBeUndefined();

    // Ensure the local fs is cleaned up
    const pathExists = await fs.stat(paths.fs).catch(() => false);

    expect(pathExists).toBe(false);
  }, 10_000);

  /**
   * Long running tests...
   */

  if (skipLongTests) {
    it.skip("should get styles.css from the cdn", async () => {});
    return;
  }

  it("should get styles.css from the cdn", async () => {
    await main({ url, agency, depth: 2 });

    // The snapshot should be on s3
    const objects = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: s3BucketName,
        Prefix: paths.s3,
      }),
    );

    const cdnCss = objects.Contents.find((object) =>
      object.Key.match(
        new RegExp(
          `^${paths.s3}/cdn.${url.host}/build/[0-9a-f]{8}/app/themes/clarity/dist/css/style.css$`,
        ),
      ),
    );

    expect(cdnCss).toBeDefined();

    const res = await s3Client.send(
      new GetObjectCommand({
        Bucket: s3BucketName,
        Key: cdnCss.Key,
      }),
    );

    const bodyString = await res.Body.transformToString();

    expect(bodyString).toBeTruthy();
    expect(bodyString).toContain("display:none");
  }, 120_000);
});
