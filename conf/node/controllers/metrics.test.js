import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { isCi, s3BucketName } from "../constants.js";
import { s3Options, s3EmptyDir } from "./s3.js";

import {
  getEnvsForMetrics,
  getAgencySnapshotMetrics,
  getAllMetrics,
  getMetricsString,
} from "./metrics.js";

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

  // Clear ot the agency snapshots
  const agencies = snapshots.map(({ agency }) => agency);

  for (const agency of [...new Set(agencies)]) {
    await s3EmptyDir(`local-${agency}`);
  }

  // Let's put some snapshots into the bucket with the agency name 'hq'
  const createPromises = snapshots.map(async ({ agency, date }) => {
    const putObjectCommand = new PutObjectCommand({
      Bucket: s3BucketName,
      Key: `local-${agency}/${date}/contents`,
      Body: "contents",
    });
    return client.send(putObjectCommand);
  });

  return Promise.all(createPromises);
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

describe("getEnvsForMetrics", () => {
  it("should return the environments for metrics", () => {
    const envs = getEnvsForMetrics();
    expect(envs).toStrictEqual(["dev", "production", "local"]);
  });
});

describe("getAgencySnapshotMetrics", () => {
  const agency = "hq";

  it("should return metrics for an agency", async () => {
    const metrics = await getAgencySnapshotMetrics("local", agency);

    expect(metrics).toStrictEqual([
      {
        name: "snapshot_count",
        facets: [{ env: "local", agency, value: 3 }],
      },
      {
        name: "most_recent_snapshot_age",
        facets: [{ env: "local", agency, value: 2 }],
      },
    ]);
  });
});

describe("getAllMetrics", () => {
  if (isCi) {
    it.skip("should return metrics for all agencies", async () => {});
    return;
  }

  it("should return metrics for all agencies", async () => {
    const metrics = await getAllMetrics(["local"]);

    expect(metrics).toStrictEqual([
      {
        name: "bucket_access",
        value: 1,
      },
      {
        name: "cdn_forbidden",
        value: 0,
      },
      {
        name: "intranet_access",
        facets: [
          {
            env: "local",
            value: 1,
          },
        ],
      },
      {
        name: "snapshot_count",
        facets: [
          {
            agency: "hmcts",
            env: "local",
            value: 2,
          },
          {
            agency: "hq",
            env: "local",
            value: 3,
          },
        ],
      },
      {
        name: "most_recent_snapshot_age",
        facets: [
          { env: "local", agency: "hmcts", value: 1 },
          { env: "local", agency: "hq", value: 2 },
        ],
      },
    ]);
  }, 15_000);
});

describe("getMetricsString", () => {
  it("should return metrics in opentelemetry format", async () => {
    const metrics = [
      {
        name: "bucket_access",
        value: 1,
      },
      {
        name: "cdn_forbidden",
        value: 1,
      },
      {
        name: "intranet_access",
        facets: [
          {
            env: "dev",
            value: 1,
          },
          {
            env: "production",
            value: 0,
          },
        ],
      },
      {
        name: "snapshot_count",
        facets: [
          {
            env: "dev",
            agency: "hmcts",
            value: 3,
          },
          {
            env: "dev",
            agency: "hq",
            value: 3,
          },
          {
            env: "production",
            agency: "hmcts",
            value: 1,
          },
          {
            env: "production",
            agency: "hq",
            value: 1,
          },
        ],
      },
      {
        name: "most_recent_snapshot_age",
        facets: [
          {
            env: "dev",
            agency: "hmcts",
            value: 1,
          },
          {
            env: "dev",
            agency: "hq",
            value: 2,
          },
          {
            env: "production",
            agency: "hmcts",
            value: 14,
          },
          {
            env: "production",
            agency: "hq",
            value: 7,
          },
        ],
      },
    ];

    const metricsString = getMetricsString(metrics);

    const expectedString =
      `# HELP bucket_access Can the service access the S3 bucket
    # TYPE bucket_access gauge
    bucket_access 1

    # HELP cdn_forbidden Is unauthorised access to the CDN forbidden
    # TYPE cdn_forbidden gauge
    cdn_forbidden 1
    
    # HELP intranet_access Can the service access the intranet
    # TYPE intranet_access gauge
    intranet_access{env="dev"} 1
    intranet_access{env="production"} 0

    # HELP snapshot_count The number of snapshots taken
    # TYPE snapshot_count gauge
    snapshot_count{env="dev",agency="hmcts"} 3
    snapshot_count{env="dev",agency="hq"} 3
    snapshot_count{env="production",agency="hmcts"} 1
    snapshot_count{env="production",agency="hq"} 1

    # HELP most_recent_snapshot_age The age of the most recent snapshot
    # TYPE most_recent_snapshot_age gauge
    # UNIT most_recent_snapshot_age days
    most_recent_snapshot_age{env="dev",agency="hmcts"} 1
    most_recent_snapshot_age{env="dev",agency="hq"} 2
    most_recent_snapshot_age{env="production",agency="hmcts"} 14
    most_recent_snapshot_age{env="production",agency="hq"} 7

    EOF
    `
        // Remove leading whitespace
        .replace(/    /g, "");

    expect(metricsString).toStrictEqual(expectedString);
  });
});
