import fs from "node:fs";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

import { s3Options, checkAccess, sync, s3EmptyDir } from "./s3";
import { s3BucketName } from "../constants.js";

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
  });

  afterAll(async () => {
    // Remove the test file
    await fs.promises.unlink("/tmp/s3-test/test.txt");
  });

  it("should sync the files", async () => {
    // Add your test here
    await sync("/tmp/s3-test", `s3://${s3BucketName}/test`);

    // Check the file exists in S3
    const res = await client.send(new GetObjectCommand(commandArgs));

    const bodyString = await res.Body.transformToString();

    expect(bodyString).toBe(fileContent);
  });

  it("should throw an error if the source directory doesn't exist", async () => {
    await expect(
      sync("/tmp/invalid-directory", `s3://${s3BucketName}/test`),
    ).rejects.toThrow();
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
