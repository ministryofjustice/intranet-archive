import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { s3BucketName } from "../constants.js";
import { generateRootIndex, generateAgencyIndex } from "./generate-indexes.js";

import { s3Options } from "./s3.js";

let client;

beforeAll(async () => {
  client = new S3Client(s3Options);

  // Make a folder on s3 for the test
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

afterAll(() => {
  // Remove the test folder
  client.send(
    new DeleteObjectCommand({
      Bucket: s3BucketName,
      Key: "dev-hmcts/",
    }),
  );

  client.send(
    new DeleteObjectCommand({
      Bucket: s3BucketName,
      Key: "dev-hq/",
    }),
  );

  client.destroy();
});

describe("generateRootIndex", () => {
  it("should throw an error if the env is not provided", async () => {
    await expect(generateRootIndex(undefined, undefined)).rejects.toThrow(
      "Env is required",
    );
  });

  it("should return the agencies as a string", async () => {
    const result = await generateRootIndex(
      s3BucketName,
      "dev",
    );
    expect(result).toMatchSnapshot();
  });
});

describe("generateAgencyIndex", () => {
  it("should throw an error if the env is not provided", async () => {
    await expect(generateAgencyIndex(undefined, undefined, undefined)).rejects.toThrow(
      "Env is required",
    );
  });

  it("should throw an error if the agency is not provided", async () => {
    await expect(generateAgencyIndex(undefined, "dev", undefined)).rejects.toThrow(
      "Agency is required",
    );
  });

  it("should return the snapshots as a string", async () => {
    const result = await generateAgencyIndex(
      s3BucketName,
      "dev",
      "hmcts",
    );
    expect(result).toMatchSnapshot();
  });
});
