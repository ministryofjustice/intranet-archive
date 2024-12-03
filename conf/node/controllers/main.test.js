import fs from "fs/promises";
import { afterAll, beforeEach, expect, it, jest } from "@jest/globals";

import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

import { main } from "./main.js";
import { getSnapshotDir } from "./httrack.js";
import { client as s3Client, s3EmptyDir } from "./s3.js";
import { s3BucketName } from "../constants.js";

// Skip long tests when running in watch mode.
const skipLongTests = process.env.npm_lifecycle_event === "test:watch";

describe("main", () => {
  const url = new URL("https://intranet.justice.gov.uk/");
  const agency = "hq";
  const directory = getSnapshotDir({ host: url.host, agency });

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
    await fs.rm(directory, { recursive: true, force: true });

    // Clean out the s3 bucket folder
    await s3EmptyDir(directory);
  });

  it("should get index files on a shallow scrape", async () => {
    await main({ url, agency, depth: 1 });

    const pathPrefix = directory.replace(/^\//, "");

    // The snapshot should be on s3
    const objects = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: s3BucketName,
        Prefix: pathPrefix,
      }),
    );

    // Ensure there's an index.html file
    const httrackIndexHtml = objects.Contents.find(
      (object) => object.Key === `${pathPrefix}/index.html`,
    );

    expect(httrackIndexHtml).toBeDefined();

    const intranetIndexHtml = objects.Contents.find(
      (object) => object.Key === `${pathPrefix}/${url.host}/index.html`,
    );

    expect(intranetIndexHtml).toBeDefined();
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

    // Remove the leading slash, for S3 path
    const pathPrefix = directory.replace(/^\//, "");

    // The snapshot should be on s3
    const objects = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: s3BucketName,
        Prefix: pathPrefix,
      }),
    );

    const cdnCss = objects.Contents.find((object) =>
      object.Key.match(
        new RegExp(
          `^${pathPrefix}/cdn.${url.host}/build/[0-9a-f]{8}/app/themes/clarity/dist/css/style.css$`,
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
