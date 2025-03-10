import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { s3BucketName } from "../constants.js";
import {
  generateRootIndex,
  generateAgencyIndex,
  generateAndWriteIndexesToS3,
} from "./generate-indexes.js";
import { s3Options, s3EmptyDir } from "./s3.js";

let client;

beforeAll(async () => {
  client = new S3Client(s3Options);

  // Empty the bucket
  await s3EmptyDir("");

  // Make a folder on s3 for the test
  await client.send(
    new PutObjectCommand({
      Bucket: s3BucketName,
      Key: "laa/2024-01-01/index.html",
      Body: "test",
    }),
  );

  await client.send(
    new PutObjectCommand({
      Bucket: s3BucketName,
      Key: "dev-hmcts/2024-01-01/index.html",
      Body: "test",
    }),
  );

  await client.send(
    new PutObjectCommand({
      Bucket: s3BucketName,
      Key: "dev-hq/2024-01-01/index.html",
      Body: "test",
    }),
  );
});

afterAll(async () => {
  // Empty the bucket
  await s3EmptyDir("");

  await client.destroy();
});

describe("generateRootIndex", () => {
  it("should throw an error if the env is not provided", async () => {
    await expect(generateRootIndex(undefined, undefined)).rejects.toThrow(
      "Env is required",
    );
  });

  it("should return the agencies as a string", async () => {
    const result = await generateRootIndex(s3BucketName, "dev");
    expect(result).toMatchSnapshot();
  });
});

describe("generateAgencyIndex", () => {
  it("should throw an error if the env is not provided", async () => {
    await expect(
      generateAgencyIndex(undefined, undefined, undefined),
    ).rejects.toThrow("Env is required");
  });

  it("should throw an error if the agency is not provided", async () => {
    await expect(
      generateAgencyIndex(undefined, "dev", undefined),
    ).rejects.toThrow("Agency is required");
  });

  it("should return the snapshots as a string", async () => {
    const result = await generateAgencyIndex(s3BucketName, "dev", "hmcts");
    expect(result).toMatchSnapshot();
  });
});

describe("generateAndWriteIndexesToS3", () => {
  beforeEach(async () => {
    // Delete the root index file
    await client.send(
      new DeleteObjectCommand({
        Bucket: s3BucketName,
        Key: "dev.html",
      }),
    );

    // Delete the agency index file
    await client.send(
      new DeleteObjectCommand({
        Bucket: s3BucketName,
        Key: "dev-hmcts/index.html",
      }),
    );
  });

  it("should throw an error if the env is not provided", async () => {
    await expect(
      generateAndWriteIndexesToS3(undefined, undefined, undefined),
    ).rejects.toThrow("Env is required");
  });

  it("should throw an error if the agency is not provided", async () => {
    await expect(
      generateAndWriteIndexesToS3(undefined, "dev", undefined),
    ).rejects.toThrow("Agency is required");
  });

  it("should return an array of promises", async () => {
    const promise = generateAndWriteIndexesToS3(s3BucketName, "dev", "hmcts");
    expect(promise).toBeInstanceOf(Promise);
    const result = await promise;
    expect(result).toHaveLength(2);
  });

  it("should write the root index file to s3", async () => {
    // Read the root index file
    const rootHtmlList = await client.send(
      new ListObjectsV2Command({
        Bucket: s3BucketName,
        Prefix: "dev.html",
      }),
    );

    // Expect it to be empty
    expect(rootHtmlList.KeyCount).toBe(0);

    await generateAndWriteIndexesToS3(s3BucketName, "dev", "hmcts");

    // Read the root index file
    const rootHtml = await client.send(
      new GetObjectCommand({
        Bucket: s3BucketName,
        Key: "dev.html",
      }),
    );

    // Expect it to be there
    expect(rootHtml).toBeDefined();
  });

  it("should write the agency index file to s3", async () => {
    // Read the agency index file
    const rootHtmlList = await client.send(
      new ListObjectsV2Command({
        Bucket: s3BucketName,
        Prefix: "dev-hmcts/index.html",
      }),
    );

    // Expect it to be empty
    expect(rootHtmlList.KeyCount).toBe(0);

    await generateAndWriteIndexesToS3(s3BucketName, "dev", "hmcts");

    // Read the agency index file
    const rootHtml = await client.send(
      new GetObjectCommand({
        Bucket: s3BucketName,
        Key: "dev-hmcts/index.html",
      }),
    );

    // Expect it to be there
    expect(rootHtml).toBeDefined();
  });
});
