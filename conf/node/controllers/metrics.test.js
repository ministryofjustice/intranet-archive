import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { s3BucketName } from "../constants.js";
import { s3Options } from "./s3.js";

import {
  getAgencySnapshotMetrics,
  getHttpMetrics,
  getMetrics,
} from "./metrics";

let client;

// Test dates in the format YYYY-MM-DD
const snapshots = [
  // 2 days ago
  {
    date: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
    agency: "hq",
  },
  // 5 days ago
  {
    date: new Date(Date.now() - 86400000 * 5).toISOString().split("T")[0],
    agency: "hq",
  },
  // 14 days ago
  {
    date: new Date(Date.now() - 86400000 * 14).toISOString().split("T")[0],
    agency: "hq",
  },
  // 1 day ago
  {
    date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    agency: "hmcts",
  },
  // 3 days ago
  {
    date: new Date(Date.now() - 86400000 * 3).toISOString().split("T")[0],
    agency: "hmcts",
  },
];

beforeAll(async () => {
  client = new S3Client(s3Options);

  // Let's put some snapshots into the bucket with the agency name 'hq'
  const promises = snapshots.map(async ({ agency, date }) => {
    const putObjectCommand = new PutObjectCommand({
      Bucket: s3BucketName,
      Key: `local-${agency}/${date}/contents`,
      Body: "contents",
    });
    return client.send(putObjectCommand);
  });

  return Promise.all(promises);
});

afterAll(async () => {
  // Let's clean up the snapshots we put into the bucket
  const promises = snapshots.map(async ({ agency, date }) => {
    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: s3BucketName,
      Key: `local-${agency}/${date}/contents`,
    });

    await client.send(deleteObjectCommand);
  });

  return Promise.all(promises);
});

describe("getAgencySnapshotMetrics", () => {
  const agency = "hq";

  it("should return metrics for an agency", async () => {
    const metrics = await getAgencySnapshotMetrics("local", agency);
    // console.log(metrics);
    expect(metrics).toStrictEqual({
      agency: "hq",
      snapshotsTaken: 3,
      mostRecentSnapshotAge: 2,
    });
  });
});

describe("getHttpMetrics", () => {
  it("should return metrics for http requests", async () => {
    const metrics = await getHttpMetrics();

    console.log(metrics);

    // S3
    const s3 = metrics.find((status) => status.target === "s3");
    expect(s3).toStrictEqual({
      target: "s3",
      env: "default",
      access: true,
    });

    // Intranet
    const devIntranet = metrics.find(
      (status) => status.env === "dev" && status.target === "intranet"
    );

    const prodIntranet = metrics.find(
      (status) => status.env === "production"
    );
    
    expect(devIntranet.access).toStrictEqual(expect.any(Boolean));
    expect(prodIntranet.access).toStrictEqual(expect.any(Boolean));
  });
});

describe("getMetrics", () => {
  it("should return metrics for all agencies", async () => {
    const metrics = await getMetrics("local");
    // console.log(metrics);
    expect(metrics).toStrictEqual([
      {
        agency: "hmcts",
        snapshotsTaken: 3,
        mostRecentSnapshotAge: 1,
      },
      {
        agency: "hq",
        snapshotsTaken: 3,
        mostRecentSnapshotAge: 2,
      },
    ]);
  });
});
