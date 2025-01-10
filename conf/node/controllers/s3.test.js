import fs from "node:fs";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

import { s3BucketName } from "../constants.js";
import {
  s3Options,
  checkAccess,
  createHeartbeat,
  sync,
  s3EmptyDir,
  writeToS3,
  getAgenciesFromS3,
  getSnapshotsFromS3,
} from "./s3";

describe("checkAccess", () => {
  let client;

  beforeAll(() => {
    client = new S3Client(s3Options);
  });

  it("should return true if the bucket is accessible", async () => {
    const result = await checkAccess();
    expect(result).toBe(true);
  });

  it("should throw an error if the bucket is not accessible", async () => {
    await expect(checkAccess("invalid-bucket-name")).rejects.toThrow();
  });
});

describe("createHeartbeat", () => {
  let client;

  beforeAll(() => {
    client = new S3Client(s3Options);
  });

  it("should create /auth/heartbeat if it doesn't exist", async () => {
    await s3EmptyDir("test/auth");

    await createHeartbeat(undefined, "test/auth/heartbeat");

    const objects = await client.send(
      new ListObjectsV2Command({
        Bucket: s3BucketName,
        Prefix: "test/auth/heartbeat",
      }),
    );

    expect(objects.Contents.length).toBe(1);
  });
});

describe("sync", () => {
  let client;

  const fileContent = "Hello, World!";

  const commandArgs = {
    Bucket: s3BucketName,
    Key: "test/test.txt",
  };

  beforeAll(async () => {
    client = new S3Client(s3Options);

    // Delete the test file from S3 if it exists.
    try {
      await client.send(new DeleteObjectCommand(commandArgs));
    } catch (e) {
      // Ignore the error if the file doesn't exist
      if (e.name !== "NoSuchKey") {
        throw e;
      }
    }

    // Ensure the directory exists
    await fs.promises.mkdir("/tmp/s3-test", { recursive: true });

    // Create a test file in /tmp/s3-test
    await fs.promises.writeFile("/tmp/s3-test/test.txt", fileContent);

    await fs.promises.writeFile(
      "/tmp/s3-test/test.html",
      "<html><body><h1>Hello, World!</h1></body></html>",
    );
  });

  afterAll(async () => {
    // Remove the test files
    await fs.promises.unlink("/tmp/s3-test/test.txt");
    await fs.promises.unlink("/tmp/s3-test/test.html");

    await client.destroy();
  });

  it("should sync the files", async () => {
    // Add your test here
    await sync("/tmp/s3-test", `s3://${s3BucketName}/test`);

    // Check the file exists in S3
    const res = await client.send(new GetObjectCommand(commandArgs));

    const bodyString = await res.Body.transformToString();

    expect(bodyString).toBe(fileContent);
  });

  it("should add content type to the destination files", async () => {
    await sync("/tmp/s3-test", `s3://${s3BucketName}/test-types`);

    const object = await client.send(
      new GetObjectCommand({
        Bucket: s3BucketName,
        Key: "test-types/test.txt",
      }),
    );

    expect(object.ContentType).toBe("text/plain");

    const htmlObject = await client.send(
      new GetObjectCommand({
        Bucket: s3BucketName,
        Key: "test-types/test.html",
      }),
    );

    expect(htmlObject.ContentType).toBe("text/html");
  });
});

describe("S3EmptyDir", () => {
  let client;

  const fileContent = "Hello, World!";

  beforeAll(async () => {
    client = new S3Client(s3Options);

    // Create a test file in /tmp/s3-test
    await fs.promises.writeFile("/tmp/s3-test/test.txt", fileContent);

    // Put the file in S3
    await client.send(
      new PutObjectCommand({
        Bucket: s3BucketName,
        Key: "test/s3-test/test.txt",
        Body: fs.createReadStream("/tmp/s3-test/test.txt"),
      }),
    );

    // Verify file is in S3 with ListObjectsV2Command
    const objects = await client.send(
      new ListObjectsV2Command({
        Bucket: s3BucketName,
        Prefix: "test/s3-test",
      }),
    );

    expect(objects.Contents.length).toBe(1);
  });

  it("should empty the directory", async () => {
    await s3EmptyDir("test/s3-test");

    const objects = await client.send(
      new ListObjectsV2Command({
        Bucket: s3BucketName,
        Prefix: "test/s3-test",
      }),
    );

    expect(objects.Contents).toBeUndefined();
  });
});

describe("writeToS3", () => {
  let client;

  const fileContent = "Hello, World!";

  const commandArgs = {
    Bucket: s3BucketName,
    Key: "test/writeToS3.txt",
  };

  beforeAll(async () => {
    client = new S3Client(s3Options);

    // Delete the test file from S3 if it exists.
    try {
      await client.send(new DeleteObjectCommand(commandArgs));
    } catch (e) {
      // Ignore the error if the file doesn't exist
      if (e.name !== "NoSuchKey") {
        throw e;
      }
    }
  });

  afterAll(async () => {
    // Remove the test file
    await client.send(new DeleteObjectCommand(commandArgs));

    client.destroy();
  });

  it("should write the file to S3", async () => {
    await writeToS3(undefined, "test/writeToS3.txt", fileContent);

    const res = await client.send(new GetObjectCommand(commandArgs));

    const bodyString = await res.Body.transformToString();

    expect(bodyString).toBe(fileContent);
  });
});

describe("getAgenciesFromS3", () => {
  let client;

  beforeAll(async () => {
    client = new S3Client(s3Options);

    // Make a folder on s3 for the test
    await client.send(
      new PutObjectCommand({
        Bucket: s3BucketName,
        Key: "test.get.agencies/hmcts/2024-01-01/index.html",
        Body: "test",
      }),
    );

    await client.send(
      new PutObjectCommand({
        Bucket: s3BucketName,
        Key: "test.get.agencies/hq/2024-01-01/index.html",
        Body: "test",
      }),
    );
  });

  afterAll(() => {
    // Remove the test folder
    client.send(
      new DeleteObjectCommand({
        Bucket: s3BucketName,
        Key: "test.get.agencies/",
      }),
    );

    client.destroy();
  });

  it("should return an array of agencies", async () => {
    const agencies = await getAgenciesFromS3(undefined, "test.get.agencies");

    expect(agencies).toBeInstanceOf(Array);
    expect(agencies).toStrictEqual(["hmcts", "hq"]);
  });
});

describe("getSnapshotsFromS3", () => {
  let client;

  beforeAll(async () => {
    client = new S3Client(s3Options);

    // Make a folder on s3 for the test
    await client.send(
      new PutObjectCommand({
        Bucket: s3BucketName,
        Key: "test.get.snapshots/hq/2024-01-01/index.html",
        Body: "test",
      }),
    );

    await client.send(
      new PutObjectCommand({
        Bucket: s3BucketName,
        Key: "test.get.snapshots/hq/2024-01-02/index.html",
        Body: "test",
      }),
    );
  });

  afterAll(() => {
    // Remove the test folder
    client.send(
      new DeleteObjectCommand({
        Bucket: s3BucketName,
        Key: "test.get.snapshots/",
      }),
    );

    client.destroy();
  });

  it("should return an array of snapshots", async () => {
    const snapshots = await getSnapshotsFromS3(
      undefined,
      "test.get.snapshots",
      "hq",
    );

    expect(snapshots).toBeInstanceOf(Array);
    expect(snapshots).toStrictEqual(["2024-01-01", "2024-01-02"]);
  });
});
